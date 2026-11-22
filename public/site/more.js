// Tap a caption to jump to that point in the test call; the current line is highlighted while it plays.
(() => {
  const audio = document.getElementById('callaudio');
  const items = [...document.querySelectorAll('#caps li')];
  if (!audio || !items.length) return;
  audio.addEventListener('timeupdate', () => {
    let current = null;
    for (const li of items) if (audio.currentTime >= Number(li.dataset.t)) current = li;
    for (const li of items) li.classList.toggle('on', li === current);
  });
  for (const li of items) li.addEventListener('click', () => { audio.currentTime = Number(li.dataset.t); audio.play().catch(() => {}); });
})();
