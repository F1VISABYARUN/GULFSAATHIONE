import type { Express, RequestHandler } from 'express';
import { gateDecision,contextFromRecipient } from './live.ts';
import { languages,relay } from './relay.ts';
import { findPlace,normalizeKind,placeForSms,voiceDirections } from './voice-maps.ts';
import { placeSms } from './family-sms.ts';
import { store } from './store.ts';

export function registerVoiceTools(app:Express,guard:RequestHandler) {
  const paths=['/api/translate','/tools/translate','/tools/find-place','/tools/directions','/tools/send-place-sms'];
  app.post(paths,guard,async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!process.env.SAATHI_SECRET)return res.status(503).json({error:'Configure SAATHI_SECRET'});
    const b=req.body??{};
    const clean=(key:string)=>typeof b[key]==='string'?b[key].trim():'';
    const api=req.path==='/api/translate';
    const text=clean(api?'text':'caller_said'),other=req.path==='/tools/translate'?clean('other_said'):'';
    if((!text && !(req.path==='/tools/translate'&&other)) || text.length>4000 || other.length>4000)return res.status(400).json({error:'Supply exact utterance, maximum 4000 characters'});
    const worker=clean('case_id')?await store.worker(clean('case_id')):undefined;
    const ctx=contextFromRecipient(b.recipient_data);
    if(worker){
      ctx.codePhrase=worker.codePhrase||ctx.codePhrase;
      ctx.promise=worker.promise;
      ctx.names=[...(ctx.names??[]),worker.name,worker.promise.agentName,worker.promise.employerName].filter((name):name is string=>Boolean(name));
      ctx.places=[...(ctx.places??[]),...(worker.promise.places??[])];
    }
    for(const utterance of [text,other].filter(Boolean)){
      const gate=gateDecision([{text:utterance}],ctx);
      if(gate.action==='ESCALATE'||/يضربني|يضربونني|خطفوني|احتجزوني|मार रहे हैं|मुझे अगवा|مجھے اغوا|എന്നെ തല്ലുന്നു/u.test(utterance)){
        const sayTe=gate.slots.codePhrase?gate.sayTe:'ఇప్పుడు మాట్లాడటం సురక్షితమేనా? మనిషి సహాయం తీసుకుందాం.';
        return res.json({status:'emergency',escalate:true,sayTe,say_to_worker:sayTe,say_to_other:'',locked_ok:false});
      }
    }
    if(api||req.path==='/tools/translate'){
      const from=api?clean('from'):other?clean('target_lang'):'te';
      const to=api?clean('to'):other?'te':clean('target_lang');
      if(!languages.includes(from)||!languages.includes(to)||from===to||(api && b.mode!==undefined&&!['relay','translate'].includes(b.mode)))return res.status(400).json({error:'Invalid language pair or mode'});
      if(other && text)return res.status(400).json({error:'Supply one speaker turn at a time'});
      const result=await relay(other||text,from,to,ctx);
      return res.json({...result,sayTe:result.say_to_worker});
    }
    if(req.path==='/tools/find-place'){
      const kind=normalizeKind(clean('what')||text);
      if(!kind)return res.json({status:'needs_kind',sayTe:'మీకు ఏం కావాలి? మందుల షాపు, ఆసుపత్రి, పోలీస్ లేదా ఎంబసీ?'});
      return res.json(await findPlace(text,clean('city'),kind));
    }
    if(req.path==='/tools/directions'){
      if(!['walking','transit'].includes(b.mode))return res.status(400).json({error:'Use walking or transit'});
      return res.json(await voiceDirections(text,clean('city'),clean('destination'),b.mode));
    }
    if(!worker||!worker.consent||!(b.confirmed===true || b.confirmed==='true')||!['worker','family'].includes(b.recipient))return res.status(400).json({error:'Confirmed recipient and registered case required'});
    const phone=b.recipient==='family'?worker.familyPhone:worker.phone;
    if(!phone || !clean('place_id'))return res.status(400).json({error:'Missing destination or selected place'});
    if(!process.env.MSG91_AUTH_KEY||!process.env.MSG91_PLACE_TEMPLATE_ID)return res.json({status:'dry-run',sayTe:'పరీక్ష మాత్రమే. సందేశం పంపలేదు.'});
    const place=await placeForSms(clean('place_id'));if(!place)return res.status(422).json({error:'Cannot verify selected place'});
    const status=await placeSms(phone,place.name,place.link);
    return res.json({status,sayTe:status==='accepted'?'సందేశాన్ని పంపడానికి సేవ స్వీకరించింది.':'సందేశం పంపినట్లు నిర్ధారణ కాలేదు.'});
  });
}
