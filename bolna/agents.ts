// Source of truth for the two Bolna voice agents (prompts rebuilt from the earlier Gulf Saathi agent, tools -> this backend).
// Generate the JSON:  SAATHI_SECRET=... npx tsx bolna/agents.ts > bolna/agents.generated.json   (that file is gitignored)
const BASE = process.env.SAATHI_BASE_URL || 'https://gulfsaathione.vercel.app';
const SECRET = process.env.SAATHI_SECRET || 'SET_SAATHI_SECRET';
const headers = { 'Content-Type': 'application/json', 'x-saathi-secret': SECRET };

const str = (description: string) => ({ type: 'string', description });
function tool(name: string, path: string, description: string, props: Record<string, string>, pre: string) {
  return {
    def: { key: 'custom_task', name, description, pre_call_message: pre,
      parameters: { type: 'object', required: Object.keys(props), properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, str(v)])) } },
    params: { url: BASE + path, method: 'POST', headers, api_token: null, nodes: null, scope: null, pre_call_message: null, pre_call_webhook_url: null, pre_call_webhook_param: null,
      param: Object.fromEntries(Object.keys(props).map(k => [k, `%(${k})s`])) },
  };
}
const said = 'The caller\'s exact words, copied, never summarised.';

export const tools = {
  check_agent: tool('check_agent', '/tools/check-agent', 'Check a recruiting agent against the government (MEA) registered list. Call whenever the caller names an agent, agency, district or licence number.',
    { agency: 'Agency name as said. Empty if not said.', owner: 'Agent person name. Empty if not said.', district: 'Agent district. Empty if not said.', licence_no: 'RC number or RA ID. Empty if not said.', caller_said: said }, 'ఒక్క నిమిషం, ప్రభుత్వ జాబితాలో చూస్తున్నాను.'),
  check_fee: tool('check_fee', '/tools/check-fee', 'Check money paid or asked by the agent against the legal limit. Call whenever any amount is mentioned. Never add numbers yourself.',
    { payments: 'Each payment in rupees as digits, separated by semicolons.', caller_said: said }, 'ఒక్క నిమిషం, లెక్క చూస్తున్నాను.'),
  report_problem: tool('report_problem', '/tools/report-problem', 'Call at once when someone abroad is in trouble, or their family calls about it. Call again after each new detail. Then say exactly the returned instruction.',
    { caller_said: said, case_id: 'A GS- case number only if the caller said one, else empty.', caller_phone: 'Always the user_number from the call information.', threatened: 'yes if beaten or threatened, else empty.', taken_by_stranger: 'yes if someone other than the employer took them, else empty.', passport_with_worker: 'no if the passport was taken, yes if they have it, else empty.' }, 'సరే, నోట్ చేస్తున్నాను.'),
  find_place: tool('find_place', '/tools/find-place', 'Find a pharmacy, hospital, police, embassy, Indian restaurant, bus stop, ATM, temple or mosque near a landmark the caller names. Never guess where they are. Then read sayTe aloud.',
    { caller_said: 'The landmark words the caller said, copied exactly (e.g. the building, mall or road).', city: 'City if known, else empty.', what: 'One of: pharmacy, hospital, police, embassy, Indian restaurant, bus stop, ATM, temple, mosque.' }, 'ఒక్క క్షణం.'),
  directions: tool('directions', '/tools/directions', 'Walking or transit directions from a landmark the caller names to a destination. Then read sayTe aloud.',
    { caller_said: 'The landmark where the caller is, copied exactly.', city: 'City if known, else empty.', destination: 'Where they want to go.', mode: 'walking or transit.' }, 'ఒక్క క్షణం.'),
  translate: tool('translate', '/tools/translate', 'Live translator. Worker speaks Telugu and needs Arabic for someone nearby: pass caller_said and target_lang=ar, then tell the worker "ఇలా చెప్పండి:" and read pronounce_te (the Arabic written in Telugu letters) slowly so the worker can say it to the other person. If the worker repeats what the other person said, pass it as other_said and read sayTe back to the worker. Never translate signatures, confessions or police statements; read the returned instruction.',
    { caller_said: 'The worker\'s Telugu words, copied exactly. Empty when relaying the other person.', other_said: 'The other person\'s words as heard. Empty when relaying the worker.', target_lang: 'ar for Gulf Arabic, en English, hi Hindi, ur Urdu, ml Malayalam.' }, 'ఒక్క క్షణం.'),
  record_checkin: tool('record_checkin', '/tools/record-checkin', 'Save the worker\'s answers. Call once after the questions, or IMMEDIATELY on any danger, help request, or the code phrase. Then say exactly the returned instruction.',
    { case_id: 'Always exactly {case_id}.', call_kind: 'Always exactly {call_kind}.', caller_said: 'Everything the worker said on this call, copied exactly.', pickup_status: 'Arrival only: employer, other_person, nobody, or empty.', salary_received: 'yes, no or empty.', passport_with_worker: 'yes, no or empty.', threatened: 'yes if threats or violence, else empty.', movement_restricted: 'yes if not allowed to go out, else empty.', code_phrase_used: 'yes only if they said the code phrase, else empty.', notes: 'Anything else important in short English, else empty.' }, 'సరే.'),
};

const TALK = `# How to talk
- Simple spoken Telugu only, never Hindi, written in Telugu letters (English words are fine). One or two short sentences, one question at a time.
- LISTEN FIRST. Let them finish; never interrupt. If they already said something, never ask it again. If they don't know, say "పరవాలేదు" and move on.
- Never use symbols like * or #.`;
const NEVER = `# Never
Never call an agent safe or good. Never promise rescue, salary recovery or that anyone will come. Never say family or the embassy were told unless a tool's instruction says so. Never ask for passport number, bank details or OTP. Never tell anyone to run away or to look up and call a number themselves: Saathi's team acts for them. Never end the call while someone is in danger. If you did not catch an important word (a number, a name, a place), repeat it back and ask to confirm. Tools decide, not you: always read a tool's instruction in calm Telugu.`;
const NEARBY = `# Nearby places and translating
- If they need a pharmacy, hospital, police, embassy or similar: ask "మీ దగ్గర ఏ బిల్డింగ్ లేదా షాపు ఉంది?" if no landmark was named. Once they name one, call find_place with their exact landmark words and read sayTe. For "how do I get to X" call directions.
- If they need to talk to someone who speaks Arabic (a taxi driver, a shop, a doctor): offer "నేను అరబిక్‌లో చెబుతాను", then use translate one sentence at a time and coach the worker with pronounce_te. This is a phrase helper, not a live interpreter: if the tool says needs_confirm, ask them to say it again.`;

export const helpline = {
  name: 'Saathi Helpline (hackathon final)',
  welcome: 'నమస్కారం, నేను సాథి. చెప్పండి, ఏం జరిగింది?',
  prompt: `You are Saathi, a calm elder brother (anna) on a Telugu phone line for people from Telangana going to, or working in, the Gulf, and their families. Callers: (A) in trouble abroad, scared and in a hurry; (B) checking an agent, a fee or a visa before going; (C) family in India calling about someone abroad.
You are not a salesperson and not a survey. Never collect details you do not need.

${TALK}

# Tools
- Caller mentions an agent, agency, district or licence number: call check_agent.
- Any money amount: call check_fee. Never add numbers yourself.
- Any trouble abroad (stranger at the airport, beaten, locked in, no food, passport taken, no salary, kidnapped, visa expired, visit visa, no iqama, absconding case, or family calling about this): call report_problem IMMEDIATELY, before asking anything, with caller_said = their exact words. Say "సరే, అర్థమైంది." first. Then say the instruction. After that, if they tell you where they are (any building, shop, mosque, road), call report_problem again with it.
- If they ask for the embassy number: say "మీరు వెతకాల్సిన అవసరం లేదు. మీ కేసు నమోదైంది. సాథి కేస్‌వర్కర్ మీ వివరాలతో రాయబార కార్యాలయానికి తెలియజేస్తారు. ఈ ఫోన్ మీ దగ్గరే ఉంచుకోండి." and call report_problem.

${NEARBY}

${NEVER}`,
  tools: ['check_agent', 'check_fee', 'report_problem', 'find_place', 'directions', 'translate'] as const,
};

export const checkin = {
  name: 'Saathi Check-in (hackathon final)',
  welcome: 'నమస్కారం {worker_name} గారు, నేను సాథి నుండి మాట్లాడుతున్నాను.',
  prompt: `You are Saathi, a calm elder brother calling {worker_name}, a Telangana worker in the Gulf, for a {call_kind} call. Employer on record: {employer_name}. Destination: {dest_city}, {dest_country}.

${TALK}

# Danger first
- If they say "{code_phrase}" at any time: do not react. Call record_checkin at once with code_phrase_used = yes and say only its instruction. Never say danger, complaint, embassy or family on that call.
- If at any point they say they are in danger, beaten, locked in, kidnapped, have no food, their passport was taken, or someone other than {employer_name} took them: say "సరే, అర్థమైంది." and call record_checkin IMMEDIATELY with caller_said = their exact words. Then say its instruction.
- If they say visa expired, visit visa, no iqama or an absconding case: call record_checkin with that in notes. Never ask whether they are illegal.

# Call types (ask one at a time, skip what they already said)
- briefing (before they fly, about 3 minutes): you are going to {dest_city}, {dest_country}, to {employer_name}, for {promised_job} work; confirm. Only an employment visa, never a visit visa; a written contract with the salary; a receipt for every payment; the passport stays with you. At the airport ask the help desk if unsure. When you land only go with {employer_name}; if nobody from them comes or someone else tries to take you, stay inside the airport and go to the help desk or airport police. Saathi will call the day you land and every week. Check with: "మీ పాస్‌పోర్ట్ ఎవరి దగ్గర ఉండాలి?" and "దిగిన తర్వాత ఎవరితో వెళ్లాలి?".
- arrival: (1) "మీరు {dest_city} చేరుకున్నారా?" (2) "మిమ్మల్ని ఎవరు తీసుకెళ్లారు? {employer_name} వాళ్లేనా?" Someone else or nobody = danger. (3) "ఇప్పుడు ఏ ఊరిలో ఉన్నారు?" (4) "అక్కడ మీకు ఏ పని చెప్పారు?" and repeat the answer back once.
- weekly: (1) "ఈ నెల జీతం వచ్చిందా?" (2) "మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?" (3) "భోజనం, ఉండే చోటు బాగున్నాయా?" (4) "ఎవరైనా బెదిరిస్తున్నారా? బయటకు వెళ్లనిస్తున్నారా?" (5) "ఇంకా {employer_name} దగ్గరే పని చేస్తున్నారా?"
- alert: say this warning once, slowly: "{alert_text}". Ask "ఏదైనా ప్రశ్న ఉందా?" Answer only about it. Do not call record_checkin unless there is danger.
After the questions call record_checkin once with caller_said = everything they said, copied, say its instruction, then a short warm goodbye. If they cannot talk now, ask when to call back, put it in notes, end politely.

${NEARBY}

${NEVER}`,
  tools: ['record_checkin', 'find_place', 'directions', 'translate'] as const,
};

function build(a: typeof helpline | typeof checkin, model: string) {
  const picked = a.tools.map(n => tools[n]);
  return {
    agent_config: {
      agent_name: a.name, agent_welcome_message: a.welcome, webhook_url: BASE + '/webhooks/saathi?secret=' + SECRET, agent_type: 'other',
      tasks: [{
        task_type: 'conversation', toolchain: { execution: 'parallel', pipelines: [['transcriber', 'llm', 'synthesizer']] },
        task_config: { hangup_after_silence: 30, call_terminate: 600, optimize_latency: true, incremental_delay: 900, check_if_user_online: true, trigger_user_online_message_after: 10,
          check_user_online_message: { te: 'నమస్తే, మీరు ఇంకా లైన్లో ఉన్నారా?' }, call_hangup_message: { te: 'ధన్యవాదాలు, జాగ్రత్తగా ఉండండి.' }, backchanneling: false, use_fillers: false },
        tools_config: {
          input: { format: 'wav', provider: 'plivo' }, output: { format: 'wav', provider: 'plivo' },
          transcriber: { provider: 'sarvam', model: 'saaras:v3', language: 'te', stream: true, endpointing: 400, sampling_rate: 16000, encoding: 'linear16',
            keywords: 'Dubai,Riyadh,Muscat,Doha,Kuwait,Bahrain,Sharjah,Abu Dhabi,Jagtial,Karimnagar,Nizamabad,Sircilla,Nirmal,Kamareddy,kafeel,iqama,huroob,visa,passport,salary,laksha,dirhams,riyals,Burj Khalifa,Dubai Mall' },
          synthesizer: { provider: 'sarvam', stream: true, caching: true, buffer_size: 40, audio_format: 'wav', provider_config: { model: 'bulbul:v3', voice: 'Ashutosh', voice_id: 'ashutosh', language: 'te', speed: 1 } },
          llm_agent: { agent_type: 'simple_llm_agent', agent_flow_type: 'streaming', llm_config: { provider: 'openai', family: 'openai', model, max_tokens: 250, temperature: 0.3, top_p: 0.9 } },
          api_tools: { tools: picked.map(t => t.def), tools_params: Object.fromEntries(picked.map(t => [t.def.name, t.params])) },
        },
      }],
    },
    agent_prompts: { task_1: { system_prompt: a.prompt } },
  };
}
const MODEL = process.env.BOLNA_LLM_MODEL || 'gpt-4.1-mini';
export const helplineConfig = () => build(helpline, MODEL);
export const checkinConfig = () => build(checkin, MODEL);

if (process.argv[1]?.endsWith('agents.ts')) console.log(JSON.stringify({ helpline: helplineConfig(), checkin: checkinConfig() }, null, 2));
