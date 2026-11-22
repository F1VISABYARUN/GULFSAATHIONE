// "Get a call" form: asks the server to phone the visitor. Messages follow the page language chosen with the toggle.
(() => {
const form = document.getElementById('callform');
const message = document.getElementById('callmsg');
const button = document.getElementById('callbtn');
const phone = document.getElementById('phone');
const consent = document.getElementById('consent');
const HELP = '+91 80659 52403';
const text = {
  requested: ['Call requested. Keep your phone nearby. If it does not ring within a minute, call ' + HELP + ' yourself.', 'కాల్ అభ్యర్థన పంపాం. ఫోన్ దగ్గర ఉంచుకోండి. ఒక నిమిషంలో మోగకపోతే మీరే ' + HELP + 'కు కాల్ చేయండి.'],
  bad_number: ['Please enter a valid phone number.', 'సరైన ఫోన్ నంబర్ ఇవ్వండి.'],
  consent_required: ['Please tick the box to agree.', 'అంగీకార పెట్టెను టిక్ చేయండి.'],
  closed: ['Call requests are not open right now. You can call ' + HELP + ' yourself.', 'కాల్ అభ్యర్థనలు ప్రస్తుతం అందుబాటులో లేవు. మీరే ' + HELP + 'కు కాల్ చేయవచ్చు.'],
  not_approved: ['This number is not on the demo list yet. You can call ' + HELP + ' yourself.', 'ఈ నంబర్ ఇంకా డెమో జాబితాలో లేదు. మీరే ' + HELP + 'కు కాల్ చేయవచ్చు.'],
  too_many_calls: ['This number has reached today’s limit. Please try tomorrow.', 'ఈ నంబర్‌కు ఈ రోజు పరిమితి పూర్తయింది. రేపు ప్రయత్నించండి.'],
  busy: ['Too many requests right now. Please try again later.', 'ఇప్పుడు చాలా అభ్యర్థనలు ఉన్నాయి. కొంతసేపటి తర్వాత ప్రయత్నించండి.'],
  failed: ['We could not place the call. Please try again, or call ' + HELP + '.', 'కాల్ చేయలేకపోయాం. మళ్ళీ ప్రయత్నించండి, లేదా ' + HELP + 'కు కాల్ చేయండి.'],
};
const alias = { slow_down: 'busy', daily_limit: 'busy', call_failed: 'failed', unavailable: 'failed' };
const show = (key, ok = false) => {
  const pair = text[alias[key] ?? key] ?? text.failed;
  message.textContent = pair[document.documentElement.lang === 'te' ? 1 : 0];
  message.className = ok ? 'ok' : 'err';
};
if (form) {
  fetch('/api/call-me/status').then(r => r.json()).then(s => { if (s.mode === 'closed') { button.disabled = true; show('closed'); } }).catch(() => {});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!consent.checked) { show('consent_required'); return; }
    button.disabled = true; message.textContent = ''; message.className = '';
    try {
      const response = await fetch('/api/call-me/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: phone.value, consent: true }) });
      const result = await response.json().catch(() => ({}));
      show(result.status ?? 'failed', result.status === 'requested');
      if (result.status === 'requested') return;
    } catch { show('failed'); }
    button.disabled = false;
  });
}
})();
