/* Shared appearance, loaded before styles to avoid a light-theme flash. */
(() => {
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let settings = {};
  function read() {
    try { settings = JSON.parse(localStorage.getItem('smp_settings') || '{}') || {}; } catch { settings = {}; }
  }
  function apply(next) {
    if (next) settings = next;
    let dark = settings.theme === 'dark' || (!['light', 'dark'].includes(settings.theme) && !!media?.matches);
    if (settings.invert) dark = !dark;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#181818' : '#fafafa';
  }
  read();
  apply();
  media?.addEventListener?.('change', () => apply());
  window.addEventListener('storage', e => { if (e.key === 'smp_settings' || e.key === null) { read(); apply(); } });
  window.siteAppearance = { apply };
})();
