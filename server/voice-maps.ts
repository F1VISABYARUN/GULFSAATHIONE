import missions from './data/missions.json' with {type:'json'};
import {extractAnchor,mapsFetch,foldLatin} from './assistant.ts';
import {tokenize} from './harness/tokens.ts';

export const kinds=['hospital','police','embassy','Indian restaurant','bus stop','pharmacy','ATM','temple','mosque'];
const need={status:'needs_landmark',sayTe:'దగ్గరలో కనిపించే భవనం లేదా రోడ్డు పేరు చెప్పండి.'};
const unavailable={status:'unavailable',sayTe:'ఇప్పుడు మ్యాప్ సమాచారం అందుబాటులో లేదు.'};
interface Point { latitude:number;longitude:number }
interface Place {id:string;displayName:{text:string};location:Point}
function distance(a:Point,b:Point) {
  const rad=Math.PI/180;
  const x=Math.sin((b.latitude-a.latitude)*rad/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin((b.longitude-a.longitude)*rad/2)**2;
  return Math.round(12742000*Math.asin(Math.sqrt(Math.min(1,x))));
}

// Approximate a Latin display name in Telugu for pronunciation, keeping the original alongside it.
export function pronounce(name:string) {
  const consonants:Record<string,string>={sh:'ష',ch:'చ',th:'త',dh:'ధ',ph:'ఫ',kh:'ఖ',gh:'ఘ',ng:'ంగ',b:'బ',c:'క',d:'డ',f:'ఫ',g:'గ',h:'హ',j:'జ',k:'క',l:'ల',m:'మ',n:'న',p:'ప',q:'క',r:'ర',s:'స',t:'ట',v:'వ',w:'వ',x:'క్స',y:'య',z:'జ'};
  const vowels:Record<string,[string,string]>={a:['అ',''],aa:['ఆ','ా'],e:['ఎ','ె'],ee:['ఈ','ీ'],i:['ఇ','ి'],o:['ఒ','ొ'],oo:['ఊ','ూ'],u:['ఉ','ు'],ai:['ఐ','ై'],ou:['ఔ','ౌ']};
  return name.replace(/[a-z]+/gi,word=>{
    let out='',pending=false;
    for(const part of word.toLowerCase().match(/sh|ch|th|dh|ph|kh|gh|ng|aa|ee|oo|ai|ou|./g)??[]){
      if(vowels[part]){out+=vowels[part][pending?1:0];pending=false;}
      else {if(pending)out+='్';out+=consonants[part]??part;pending=true;}
    }
    return out+(pending?'్':'');
  });
}

async function search(query:string,near?:Point):Promise<Place[]|undefined>{
  const key=process.env.GOOGLE_MAPS_API_KEY;if(!key)return;
  const r=await mapsFetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',
    headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.location'},
    body:JSON.stringify({textQuery:query,languageCode:'en',maxResultCount:3,...(near?{locationBias:{circle:{center:near,radius:5000}}}:{})})});
  if(!r?.ok)return;
  const data=await r.json().catch(()=>null);if(!data)return;
  return (data.places??[]).filter((p:Place)=>p.id&&p.displayName?.text&&Number.isFinite(p.location?.latitude)&&Number.isFinite(p.location?.longitude));
}
const KIND_WORDS:[RegExp,string][]=[[/(ph|f)arm|medic|mandu|chemist/,'pharmacy'],[/hospit|aaspat|aspat|clinic|doctor/,'hospital'],[/polic|polis/,'police'],[/embas|consul|rayabar/,'embassy'],[/restaur|hotel|food|tindi|bhojan/,'Indian restaurant'],[/bus/,'bus stop'],[/\batm\b|bank/,'ATM'],[/templ|gudi|mandir/,'temple'],[/mosq|masjid/,'mosque']];
/** Accept what the LLM actually sends ("Pharmacy", "medical shop", "మందుల షాపు") and map it to a supported kind. */
export function normalizeKind(what:string):string|undefined{
  if(kinds.includes(what))return what;
  const f=foldLatin(tokenize(what).map(t=>t.norm).join(' ')+' '+what);
  return KIND_WORDS.find(([re])=>re.test(f))?.[1];
}
const FILLERS=/^(avunandi|avunu|haa|ha|andi|sare|ok|okay|yes|nenu|ikkada|unnanu|daggara|near|lo|undi|unnadi|ante|aa|ee|oka)$/;
/** The tool is only called after the bot asked "which building or shop is near you?", so a bare answer IS the landmark. */
export function bareLandmark(text:string,city:string):string|undefined{
  const words=tokenize(text).map(t=>t.norm).filter(w=>w&&!FILLERS.test(w));
  const s=words.join(' ').trim();
  if(!s||s.length>60||foldLatin(s)===foldLatin(city)||normalizeKind(s))return;
  return s;
}
export async function findPlace(text:string,city:string,what:string){
  const location=extractAnchor(text);city=city||location.city||'';
  const anchor=location.anchor||bareLandmark(text,city);
  if(!anchor || anchor.toLowerCase()===city.trim().toLowerCase())return need;
  if(what==='embassy'){
    const mission=missions.find(m=>m.city.toLowerCase()===city.trim().toLowerCase());
    if(mission)return {status:'official',places:[{...mission,place_id:'mission:'+mission.city,name_te:pronounce(mission.name),distance_m:null}],sayTe:`${pronounce(mission.name)}. సంప్రదింపు: ${mission.phone}. దూరం నిర్ధారించలేదు.`};
    if(!city)return {status:'needs_city',sayTe:'మీరు ఏ నగరంలో ఉన్నారు?'};
  }
  const origins=await search([anchor,city].filter(Boolean).join(', '));
  if(!origins)return unavailable;
  const exact=origins.filter(p=>p.displayName.text.toLowerCase()===anchor.toLowerCase());
  const origin=origins.length===1?origins[0]:exact.length===1?exact[0]:undefined;
  if(!origin)return {...need,sayTe:'ఆ గుర్తు ఖచ్చితంగా దొరకలేదు. ప్రాంతం లేదా మరో గుర్తు చెప్పండి.'};
  const queryKind=what==='embassy'?'Embassy or Consulate of India':what;
  const results=await search(`${queryKind} near ${anchor}, ${city}`,origin.location);
  if(!results)return unavailable;
  const places=results.slice(0,3).map(p=>({place_id:p.id,name:p.displayName.text,name_te:pronounce(p.displayName.text),distance_m:distance(origin.location,p.location)})).sort((a,b)=>a.distance_m-b.distance_m);
  return {status:'found',places,sayTe:places.length?places.map(p=>`${p.name_te}, గుర్తు నుంచి నేరుగా సుమారు ${p.distance_m} మీటర్లు.`).join(' '):'దగ్గరలో ఫలితాలు దొరకలేదు.'};
}
export async function voiceDirections(text:string,city:string,destination:string,mode:'walking'|'transit'){
  const location=extractAnchor(text);const anchor=location.anchor;city=city||location.city||'';if(!anchor || anchor.toLowerCase()===city.trim().toLowerCase())return need;
  if(!destination)return {status:'needs_destination',sayTe:'మీరు ఎక్కడికి వెళ్లాలి?'};
  const taxi={status:'unavailable',sayTe:'దారి సమాచారం అందుబాటులో లేదు. టాక్సీ డ్రైవర్‌కు ఈ మాట చెప్పవచ్చు.',taxi_ar:`من فضلك خذني إلى ${destination}.`};
  const key=process.env.GOOGLE_MAPS_API_KEY;if(!key)return taxi;
  const params=new URLSearchParams({origin:[anchor,city].filter(Boolean).join(', '),destination,mode,language:'te',key});
  const r=await mapsFetch('https://maps.googleapis.com/maps/api/directions/json?'+params);
  const data=r?.ok?await r.json().catch(()=>null):null;
  if(data?.status!=='OK')return taxi;
  const all=data.routes?.[0]?.legs?.[0]?.steps;
  if(!Array.isArray(all)||!all.length)return taxi;
  const steps=all.slice(0,4).map(s=>{
    const t=s.transit_details;
    if(t?.departure_stop?.name&&t.arrival_stop?.name)return `${t.departure_stop.name} వద్ద ${t.line?.short_name||t.line?.name||'సర్వీసు'} ఎక్కండి. ${t.arrival_stop.name} వద్ద దిగండి.`;
    return String(s.html_instructions??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  });
  if(steps.some(s=>!s||!/[\u0C00-\u0C7F]/.test(s)))return taxi;
  return {status:'route',steps,more_steps:all.length>4,sayTe:steps.join(' ') + (all.length>4?' ఇవి మొదటి నాలుగు దశలు.':'')};
}

export async function placeForSms(id:string){
  if(id.startsWith('mission:')){
    const m=missions.find(m=>id==='mission:'+m.city);
    if(m)return {name:m.name,link:'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:m.name+', '+m.city})};
    return;
  }
  if(!/^[A-Za-z0-9_-]{5,250}$/.test(id)||!process.env.GOOGLE_MAPS_API_KEY)return;
  const r=await mapsFetch('https://places.googleapis.com/v1/places/'+id,{headers:{'X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'id,displayName'}});
  if(!r?.ok)return;
  const p=await r.json().catch(()=>null);if(p?.id!==id||!p.displayName?.text)return;
  return {name:String(p.displayName.text),link:'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:p.displayName.text,query_place_id:id})};
}
