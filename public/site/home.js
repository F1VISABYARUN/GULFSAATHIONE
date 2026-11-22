const button = document.getElementById('lang');
const translated = [...document.querySelectorAll('[data-te]')].map(node => ({node, en: node.textContent}));
function language(te) {
  document.documentElement.lang = te ? 'te' : 'en';
  for (const {node, en} of translated) node.textContent = te ? node.dataset.te : en;
  button.textContent = te ? 'English' : 'తెలుగు';
  button.lang = te ? 'en' : 'te';
  button.setAttribute('aria-label', te ? 'Read in English' : 'తెలుగులో చదవండి');
}
let telugu = false;
try { telugu = localStorage.getItem('saathi-language') === 'te'; } catch {}
language(telugu);
button.hidden = false;
button.addEventListener('click', () => {
  telugu = !telugu;
  language(telugu);
  try { localStorage.setItem('saathi-language', telugu ? 'te' : 'en'); } catch {}
});
