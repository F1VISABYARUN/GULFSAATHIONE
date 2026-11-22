import 'dotenv/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { PhoneSession, disclosure, type Services, type Output } from './session.ts';
import { services, agentServices, type Config } from './providers.ts';
import { AgentSession, type AgentServices, type AgentOutput } from './agent.ts';

// Plivo V3 GET canonicalization: URL-decoded, sorted first value of each query key.
// Routes are fixed ASCII paths. Use the configured public origin behind a TLS proxy.
export function signed(req: IncomingMessage, url: URL, token: string) {
  const nonce = req.headers['x-plivo-signature-v3-nonce'];
  const signature = req.headers['x-plivo-signature-v3'];
  if (typeof nonce !== 'string' || typeof signature !== 'string') return false;
  const query = [...new Set(url.searchParams.keys())].sort().map(k=>k+'='+url.searchParams.get(k)).join('&');
  const data = url.origin + url.pathname + (query ? '?'+query : '') + '.' + nonce;
  const expected = createHmac('sha256',token).update(data).digest('base64');
  return signature.split(',').some(s=>Buffer.byteLength(s) === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

const trace = (event:string,data:object={}) => console.info(JSON.stringify({component:'phone-interpreter',event,...data}));
export function createInterpreter(config: Config, makeServices: (c:Config,call:string,caseId?:string)=>Services = services,
  makeAgent: (c:Config,call:string,caseId?:string,from?:string)=>AgentServices = agentServices) {
  if (!Object.hasOwn(disclosure,config.target) || !/^\+[1-9]\d{6,14}$/.test(config.human)) throw Error('Invalid interpreter destination');
  const tickets = new Map<string,{call:string;caseId?:string;from?:string;mode:string;expires:number}>();
  const used = new Map<string,number>();
  const ws = new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
  const server = createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const url = new URL(config.origin + (req.url || '/'));
    if (req.method !== 'GET' || !['/answer','/human','/human-result'].includes(url.pathname)) { res.writeHead(404).end(); return; }
    if (!signed(req,url,config.authToken)) { res.writeHead(403).end(); return; }
    const now = Date.now();
    for (const [k,v] of tickets) if (v.expires <= now) tickets.delete(k);
    for (const [k,v] of used) if (v <= now) used.delete(k);
    const nonce = String(req.headers['x-plivo-signature-v3-nonce']);
    if (used.has(nonce)) { res.writeHead(403).end(); return; }
    used.set(nonce,now + 3600000);
    const call = url.searchParams.get('CallUUID') || '';
    if (!/^[\w-]{1,80}$/.test(call)) { res.writeHead(400).end(); return; }
    res.setHeader('Content-Type','application/xml');
    if (url.pathname === '/human') {
      // Plivo calls the action URL when the dial ends; that is the only evidence of what happened.
      res.end('<Response><Dial timeout="25" action="'+config.origin+'/human-result" method="GET"><Number>'+config.human+'</Number></Dial></Response>'); return;
    }
    if (url.pathname === '/human-result') {
      const status = url.searchParams.get('DialStatus') ?? url.searchParams.get('DialBLegStatus') ?? 'unknown';
      console.info(JSON.stringify({component:'phone-interpreter',event:'human_dial_ended',call,status}));
      // Not connected: return the caller to the interpreter instead of hanging up. Parameter names are unverified against Plivo.
      res.end(status === 'completed' ? '<Response/>' : '<Response><Redirect method="GET">'+config.origin+'/answer</Redirect></Response>'); return;
    }
    const ticket = randomBytes(24).toString('hex');
    const caseId = url.searchParams.get('case_id') ?? undefined;
    if (caseId !== undefined && !/^GS-[a-zA-Z0-9-]{1,48}$/.test(caseId)) { res.writeHead(400).end(); return; }
    const mode = url.searchParams.get('mode') ?? config.mode ?? 'agent';
    if (!['agent','keypad'].includes(mode)) { res.writeHead(400).end(); return; }
    tickets.set(ticket,{call,caseId,from:url.searchParams.get('From') ?? undefined,mode,expires:now+60000});
    trace('answer',{mode,bound:Boolean(caseId)});
    const address = config.origin.replace(/^https:/,'wss:')+'/media/'+ticket;
    res.end('<Response><Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">'+address+'</Stream></Response>');
  });
  server.on('upgrade',(req,socket,head)=>{
    const match = /^\/media\/([a-f0-9]{48})$/.exec(req.url||'');
    const key = match?.[1] || '';
    const ticket = tickets.get(key);
    tickets.delete(key);
    if (!ticket || ticket.expires <= Date.now()) {socket.destroy(); return;}
    ws.handleUpgrade(req,socket,head,peer=>{
      const counts: Record<string,number> = {};
      trace('stream_connected',{mode:ticket.mode});
      let stream = '';
      const send = (message:object) => { if (peer.readyState === peer.OPEN) peer.send(JSON.stringify(message)); };
      const output: AgentOutput & Output = {
        metric:(event,ms)=>console.info(JSON.stringify({component:'phone-interpreter',event,ms})),
        play:(bytes,name)=>{
          for (let offset = 0; offset < bytes.length; offset += 8000) {
            send({event:'playAudio',streamId:stream,media:{contentType:'audio/x-mulaw',sampleRate:8000,
              payload:bytes.subarray(offset,offset+8000).toString('base64')}});
          }
          send({event:'checkpoint',streamId:stream,name});
        },
        clear:()=>send({event:'clearAudio',streamId:stream}),close:()=>peer.close(),
      };
      const session = ticket.mode === 'agent'
        ? new AgentSession(config.target,makeAgent(config,ticket.call,ticket.caseId,ticket.from),output)
        : new PhoneSession(config.target,makeServices(config,ticket.call,ticket.caseId),output);
      const timeout = setTimeout(()=>peer.terminate(),30*60*1000).unref();
      const startup = setTimeout(()=>peer.terminate(),15000).unref();
      peer.on('close',(code)=>{ clearTimeout(timeout); clearTimeout(startup); session.close(); trace('stream_closed',{code,counts}); });
      peer.on('error',()=>peer.terminate());
      peer.on('message',async(raw,binary)=>{
        try {
          if (binary) throw Error();
          const event = JSON.parse(raw.toString());
          const kind = String(event.event) + (event.event === 'media' ? ':' + String(event.media?.track ?? 'notrack') : '');
          counts[kind] = (counts[kind] ?? 0) + 1;
          if (event.event !== 'media' && event.event !== 'start') trace('plivo_event',{kind,name:event.name ?? event.playedStream?.name,digit:event.dtmf?.digit});
          if (event.event === 'start') {
            const id = event.start?.streamId ?? event.streamId;
            if (stream || event.start?.callId !== ticket.call || typeof id !== 'string' || !id) throw Error();
            const format = event.start.mediaFormat;
            if (format?.encoding !== 'audio/x-mulaw' || Number(format.sampleRate)!==8000) throw Error();
            stream = id;
            trace('stream_start',{encoding:format.encoding,rate:format.sampleRate});
            clearTimeout(startup); await session.start();
          } else if (stream) {
            if (event.streamId && event.streamId !== stream) throw Error();
            if (event.event === 'media' && (!event.media?.track || event.media.track==='inbound')) {
              if (typeof event.media?.payload !== 'string') throw Error();
              await session.media(Buffer.from(event.media.payload,'base64'));
            } else if (event.event === 'dtmf') await session.digit(event.dtmf?.digit);
            else if (event.event === 'playedStream') session.played(event.name ?? event.playedStream?.name);
            else if (event.event === 'stop') peer.close();
          }
        } catch {peer.close(1008,'Invalid stream');}
      });
    });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const required = (name:string) => { const value=process.env[name]; if (!value) throw Error('Set '+name); return value; };
  function origin(name:string) {
    const url = new URL(required(name));
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Expected HTTPS origin for '+name);
    return url.origin;
  }
  createInterpreter({origin:origin('INTERPRETER_ORIGIN'),backend:origin('SAATHI_URL'),secret:required('SAATHI_SECRET'),
    authId:required('PLIVO_AUTH_ID'),authToken:required('PLIVO_AUTH_TOKEN'),human:required('INTERPRETER_HUMAN_NUMBER'),
    openai:required('OPENAI_API_KEY'),target:process.env.INTERPRETER_TARGET || 'ar',mode:process.env.INTERPRETER_MODE === 'keypad' ? 'keypad' : 'agent'}).listen(Number(process.env.PORT || 8080));
}
