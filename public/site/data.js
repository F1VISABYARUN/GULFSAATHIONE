// Renders the data page. Counts, dates and links come from /api/data-sources (read from the data files); the explanations are fixed text in both languages.
(() => {
const grid = document.getElementById('datagrid');
const copy = {
  ra_list: { title: ['Registered recruiting agents (Ministry of External Affairs)', 'నమోదైన రిక్రూటింగ్ ఏజెంట్లు (విదేశాంగ శాఖ)'],
    why: ['To tell a caller whether the agent they paid is on the government’s list of active registered agents, by name, agency, district or licence number.', 'ఏజెంట్ ప్రభుత్వ నమోదిత ఏజెంట్ల జాబితాలో ఉన్నారో లేదో పేరు, సంస్థ, జిల్లా లేదా లైసెన్స్ నంబర్‌తో కాలర్‌కు చెప్పడానికి.'],
    limits: ['Read automatically from a PDF, so a name can contain a reading mistake. A name missing from the list does not prove an agent is illegal; check on emigrate.gov.in.', 'PDF నుంచి ఆటోమేటిక్‌గా చదివినందున పేరులో పొరపాటు ఉండవచ్చు. జాబితాలో పేరు లేకపోవడం ఏజెంట్ చట్టవిరుద్ధం అని రుజువు కాదు; emigrate.gov.inలో చూడండి.'] },
  fee_cap: { title: ['Recruitment fee limit', 'రిక్రూట్‌మెంట్ ఫీజు పరిమితి'],
    why: ['To tell whether an agent asked for more than the legal fee, before the money is paid.', 'డబ్బు ఇచ్చే ముందే ఏజెంట్ చట్టబద్ధమైన ఫీజు కంటే ఎక్కువ అడిగారో లేదో చెప్పడానికి.'],
    limits: ['Taken from the Ministry’s advisories. The current figure must be confirmed on emigrate.gov.in.', 'మంత్రిత్వ శాఖ సూచనల నుంచి తీసుకున్నది. ప్రస్తుత మొత్తాన్ని emigrate.gov.inలో నిర్ధారించుకోవాలి.'] },
  missions: { title: ['Indian embassy and consulate contacts', 'భారత రాయబార, కాన్సులేట్ సంప్రదింపులు'],
    why: ['To give the right emergency number for the worker’s country and city, so nobody is told to search for one.', 'కార్మికుడి దేశం, నగరానికి సరైన అత్యవసర నంబర్ ఇవ్వడానికి; ఎవరినీ వెతుక్కోమని చెప్పకుండా ఉండటానికి.'],
    limits: ['Numbers change. Always confirm on the embassy website.', 'నంబర్లు మారుతుంటాయి. ఎల్లప్పుడూ రాయబార కార్యాలయ వెబ్‌సైట్‌లో నిర్ధారించుకోండి.'] },
  exit_rules: { title: ['Visa-ending and overstay rules', 'వీసా ముగింపు, గడువు దాటిన నియమాలు'],
    why: ['To explain fines, extension fees and the leave-the-country steps when a visa is ending, without inventing any figure.', 'వీసా ముగుస్తున్నప్పుడు జరిమానాలు, పొడిగింపు ఫీజులు, దేశం విడిచే అడుగులు చెప్పడానికి; ఏ సంఖ్యనూ ఊహించకుండా.'],
    limits: ['Only facts read on an official page are spoken. Everything else is listed as not verified and the caller is sent to the embassy.', 'అధికారిక పేజీలో చదివిన విషయాలనే చెబుతాం. మిగిలినవి “నిర్ధారించలేదు” అని ఉంచి, కాలర్‌ను రాయబార కార్యాలయానికి పంపుతాం.'] },
  districts: { title: ['Telangana districts and mandals', 'తెలంగాణ జిల్లాలు, మండలాలు'],
    why: ['To understand village and mandal names a caller says, and to send a case to the right district team.', 'కాలర్ చెప్పే గ్రామం, మండలం పేర్లు అర్థం చేసుకోవడానికి, కేసును సరైన జిల్లా బృందానికి పంపడానికి.'],
    limits: ['Covers only these districts so far, not all of Telangana. Place names are spelled many ways; unclear ones are read back to the caller.', 'ఇప్పటివరకు ఈ జిల్లాలు మాత్రమే, తెలంగాణ అంతా కాదు. ప్రాంతాల పేర్లు చాలా రకాలుగా రాస్తారు; స్పష్టత లేనివి కాలర్‌కు తిరిగి చదివి వినిపిస్తాం.'] },
  helplines: { title: ['Helpline and welfare contacts', 'హెల్ప్‌లైన్, సంక్షేమ సంప్రదింపులు'],
    why: ['To give a worker or a family a number that can help.', 'కార్మికుడికి లేదా కుటుంబానికి సహాయం చేయగల నంబర్ ఇవ్వడానికి.'],
    limits: ['Checked when added; confirm before relying on one.', 'చేర్చినప్పుడు పరిశీలించాం; ఆధారపడే ముందు నిర్ధారించుకోండి.'] },
};
const labels = { what: ['What it is', 'ఇది ఏమిటి'], source: ['Source', 'మూలం'], asof: ['As of', 'తేదీ'], why: ['Why we need it', 'ఎందుకు అవసరం'], limits: ['Limits', 'పరిమితులు'], gov: ['GOVERNMENT', 'ప్రభుత్వం'], pub: ['PUBLIC', 'ప్రజా సమాచారం'] };
let sources = [];
function facts(s, i) {
  const n = new Intl.NumberFormat('en-IN');
  const te = i === 1;
  if (s.id === 'ra_list') return [(te ? n.format(s.count) + ' నమోదులు' : n.format(s.count) + ' records') + ' — ' + s.listDate, s.asOf];
  if (s.id === 'fee_cap') return [s.value, null];
  if (s.id === 'missions') return [(te ? s.count + ' కార్యాలయాలు: ' : s.count + ' offices: ') + s.places.join(', '), null];
  if (s.id === 'exit_rules') return [(te
    ? s.confirmedFigures + ' విషయాలు అధికారిక పేజీల్లో నిర్ధారించాం (' + s.countriesWithFigures.join(', ') + '; సౌదీకి కార్మిక శాఖ సంప్రదింపు కేంద్రం వివరాలు మాత్రమే). మిగిలిన దేశాలకు (' + s.countriesEmbassyLineOnly.join(', ') + ') రాయబార కార్యాలయ నంబర్ మాత్రమే. ' + s.notVerified + ' అంశాలు నిర్ధారించలేదు.'
    : s.confirmedFigures + ' facts confirmed on official pages (' + s.countriesWithFigures.join(', ') + '; for Saudi Arabia only the labour ministry contact-centre page). Other countries (' + s.countriesEmbassyLineOnly.join(', ') + ') get the embassy number only. ' + s.notVerified + ' items are listed as not verified.'), s.asOf];
  if (s.id === 'districts') return [(te ? s.count + ' జిల్లాలు (' + s.names.join(', ') + '), ' + s.mandals + ' మండలాలు' : s.count + ' districts (' + s.names.join(', ') + '), ' + s.mandals + ' mandals'), s.asOf];
  if (s.id === 'helplines') return [(te ? s.count + ' సంప్రదింపులు' : s.count + ' contacts'), null];
  return ['', null];
}
function render() {
  if (!grid) return;
  const i = document.documentElement.lang === 'te' ? 1 : 0;
  grid.replaceChildren(...sources.filter(s => copy[s.id]).map(s => {
    const [what, asof] = facts(s, i);
    const c = copy[s.id];
    const card = document.createElement('article'); card.className = 'datacard';
    const seen = new Set();
    const row = (label, value, links) => {
      const dt = document.createElement('dt'); dt.textContent = label[i];
      const dd = document.createElement('dd');
      if (links) for (const url of links) { const host = new URL(url).hostname; if (seen.has(host)) continue; seen.add(host); const a = document.createElement('a'); a.href = url; a.textContent = host + ' ↗'; a.rel = 'noopener'; dd.append(a, ' '); }
      else dd.textContent = value;
      return [dt, dd];
    };
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = (s.kind === 'government' ? labels.gov : labels.pub)[i];
    const h = document.createElement('h2'); h.textContent = c.title[i];
    const dl = document.createElement('dl');
    dl.append(...row(labels.what, what));
    if (s.sources?.length) dl.append(...row(labels.source, '', s.sources));
    if (asof) dl.append(...row(labels.asof, asof));
    dl.append(...row(labels.why, c.why[i]), ...row(labels.limits, c.limits[i]));
    card.append(tag, h, dl);
    return card;
  }));
}
fetch('/api/data-sources').then(r => r.json()).then(d => { sources = d.sources; render(); }).catch(() => { if (grid) grid.textContent = 'The data list could not be loaded. Please try again.'; });
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
