const el=id=>document.getElementById(id);
let key='', selected='', records=[];
function show(message){el('msg').textContent=message;}
function action(fn){return async event=>{event.preventDefault();try{await fn();}catch(err){show(err.message);}};}
async function api(path,body){
  const r=await fetch('/api/saathi/cases'+path,{cache:'no-store',headers:{'x-saathi-secret':key,'content-type':'application/json'},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw Error(r.status===401?'Access denied. Check your access key.':'Request failed ('+r.status+'). Refresh the desk and try again.');
  return r.headers.get('content-type')?.includes('application/json')?r.json():null;
}
function element(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
const path=id=>'/'+encodeURIComponent(id);
async function queue(){
  records=await api('?'+new URLSearchParams(['level','status'].filter(k=>el(k).value).map(k=>[k,el(k).value])));
  selected='';el('detail').hidden=true;el('cases').replaceChildren();
  for(const w of records){
    const li=element('li',''), b=element('button',w.caseId+' · '+(w.name||'Worker'));
    b.onclick=action(()=>openCase(w));li.append(b,' '+w.riskLevel+' · '+w.status+(w.overdue?' · overdue':''));el('cases').append(li);
  }
  show(records.length+' cases');el('desk').hidden=false;el('login').hidden=true;
}
async function openCase(w){
  selected=w.caseId;el('detail').hidden=true;
  const [file,reviews]=await Promise.all([api(path(w.caseId)+'/file'),api(path(w.caseId)+'/translations')]);
  if(selected!==w.caseId)return;
  el('caseTitle').textContent=w.caseId;el('file').textContent=JSON.stringify(file,null,2);
  el('notes').replaceChildren(...w.notes.map(n=>element('li',n.at+' · '+n.text)));
  el('handoff').textContent=w.acknowledged?'Acknowledged by '+w.acknowledged.by+' · '+w.acknowledged.at:'Awaiting caseworker acknowledgement';
  el('claimForm').hidden=!!w.acknowledged || w.status!=='alert';
  el('smsState').textContent=w.familySms?'Family SMS · '+w.familySms.status+(w.familySms.providerId?' · '+w.familySms.providerId:''):'Family SMS has no recorded attempt';
  el('receiptForm').hidden=!(w.familySms?.status==='accepted' && w.familySms.providerId);
  el('receiptId').value='';
  el('noteForm').hidden=el('closeForm').hidden=w.status==='closed';
  el('note').value=el('source').value='';el('reviews').replaceChildren();
  for(const r of reviews){
    const card=element('article','');card.append(element('strong',r.from==='te'?'Telugu → Arabic':'Arabic → Telugu'),element('p',r.source));
    if(r.reviewedAt)card.append(element('p',r.approved),element('small','Approved by '+r.reviewer));
    else{
      const text=element('textarea','');text.value=r.draft||'';text.setAttribute('aria-label','Reviewed translation');
      const name=element('input','');name.placeholder='Reviewer name';name.setAttribute('aria-label','Reviewer name');
      const approve=element('button','Approve translation');
      approve.onclick=action(async()=>{await api(path(w.caseId)+'/translations/'+r.id+'/approve',{text:text.value,reviewer:name.value});await openCase(w);});
      card.append(element('p','Check the wording in both languages before approval.'),text,name,approve);
    }
    el('reviews').append(card);
  }
  el('detail').hidden=false;
}
el('login').onsubmit=action(async()=>{key=el('secret').value;await queue();el('secret').value='';});
el('logout').onclick=()=>location.reload();
el('level').onchange=el('status').onchange=el('reload').onclick=action(queue);
el('noteForm').onsubmit=action(async()=>{await api(path(selected)+'/note',{note:el('note').value});await queue();});
el('closeForm').onsubmit=action(async()=>{await api(path(selected)+'/close',{outcome:el('outcome').value});await queue();});
el('translate').onsubmit=action(async()=>{const w=records.find(r=>r.caseId===selected);await api(path(selected)+'/translations',{from:el('from').value,text:el('source').value});await openCase(w);});

el('claimForm').onsubmit=action(async()=>{await api(path(selected)+'/acknowledge',{caseworker:el('claimName').value});await queue();});
el('receiptForm').onsubmit=action(async()=>{await api(path(selected)+'/family-sms/delivery',{caseworker:el('receiptBy').value,providerId:el('receiptId').value,status:el('receiptStatus').value});await queue();});
