'use strict';

const LS = {
  catalog: 'smp_published',
  vault: 'smp_vault',
  social: 'smp_social',
  ghToken: 'smp_ghToken',
  siteStatus: 'smp_siteStatus',
  texts: 'smp_texts',
  layout: 'smp_layout',
  featured: 'smp_featured',
  faq: 'smp_faq',
  genres: 'smp_genres',
  seen: 'smp_seen',
  settings: 'smp_settings',
  access: 'smp_access',
  friend: 'smp_friend',
  theme: 'smp_theme',
  skip: 'smp_skipConfirmUntil'
};

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAeojVpO6WGphfugsijSNz6u8lk0V5sjck',
  authDomain: 'website-cc5f8.firebaseapp.com',
  projectId: 'website-cc5f8',
  appId: '1:16463386766:web:8f03322c3b8f91c36251df'
};

const FB_READY = FIREBASE_CONFIG.projectId && !FIREBASE_CONFIG.projectId.startsWith('PASTE');

let fbdb = null;

let fbTools = null;

let fbAuth = null;

let fbAuthTools = null;

let fbUser = null;

let fbContent = null;

let fbActive = false;

let stateLoaded = false;

const DRAFT_KEY = 'smp_localDraft';

const ANALYTICS_CODE = 'unbranded1';

let viewCounts = {};

let vaultDiff = '';

let catalogDiff = '';

let PUBLISHED = null;

const HASH_FRIENDS = '310ced37200b1a0dae25edb263fe52c491f6e467268acab0ffec06666e2ed959';

const HASH_ADMIN = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

const FAVOURITE_GENRE = 'J-Pop';

const TAGS = [...ScoreModel.ensembles,'Piano'];

const DIFFS = ['Beginner','Intermediate','Inter-Advanced','Advanced','Professional','Impossible'];

const DEFAULT_GENRES = ['J-Pop','Pop','K-Pop','Classical','Anime','Video Game','Film/OST','Rock','Jazz','EDM / Electronic','Lo-Fi','Other'];

const TEXT_LABELS = {"dtTitle": "Maintenance title", "dtSub": "Maintenance description", "dtActiveLabel": "Maintenance timer label", "dtEtaLabel": "Maintenance estimate label", "faqTitle": "FAQ heading", "faqSub": "FAQ description", "contactTitle": "Contact heading", "contactSub": "Contact description", "catalogTitle": "Scores heading", "catalogSub": "Scores description", "portalTitle": "Friends sign-in heading", "portalSub": "Friends sign-in description", "vaultWelcome": "Friends welcome text", "vaultTitle": "Friends Vault heading", "vaultSub": "Friends Vault description", "footerNote": "Footer note"};

const DEFAULT_TEXTS = {};

const DEFAULTS = {
  "catalog": [
    {
      "id": "pub-1",
      "title": "Canon in D",
      "artist": "Johann Pachelbel",
      "arrangement": "Solo Piano",
      "desc": "",
      "video": "",
      "tags": [
        "Piano"
      ],
      "links": []
    },
    {
      "id": "pub-2",
      "title": "Greensleeves",
      "artist": "Traditional",
      "arrangement": "Flute & Guitar Duet",
      "desc": "",
      "video": "",
      "tags": [
        "Flute",
        "Guitar"
      ],
      "links": []
    }
  ],
  "vault": [],
  "social": {
    "youtube": "https://www.youtube.com/@unbranded_branden",
    "instagram": "https://instagram.com/unbranded_branden",
    "downloads": ""
  },
  "genres": [
    "J-Pop",
    "Pop",
    "K-Pop",
    "Classical",
    "Anime",
    "Video Game",
    "Film/OST",
    "Rock",
    "Jazz",
    "EDM / Electronic",
    "Lo-Fi",
    "Other"
  ],
  "siteStatus": {
    "down": false,
    "downSince": 0,
    "etaMin": ""
  },
  "layout": {
    "vault": "grid",
    "catalog": "grid"
  },
  "faq": [
    {
      "id": "faq-2",
      "q": "Where do I get the sheet music?",
      "a": "Every published score has store links where it can be purchased or downloaded."
    },
    {
      "id": "faq-3",
      "q": "Can I use an arrangement in my own video or performance?",
      "a": "Use with credit is usually allowed, but licensing depends on the original song. Send a message through the contact form to confirm permission."
    }
  ]
};
DEFAULTS.vault=window.InitialArrangements||[];

const DEFAULT_SETTINGS = { theme:'system', speed:1, motion:'system', lite:false, text:'m', invert:false };

let state = { catalog:[], vault:[], social:{}, genres:[], texts:{}, layout:{ vault:'grid', catalog:'grid' }, featured:'', faq:[], seen:{}, settings:{ ...DEFAULT_SETTINGS }, access:'none' };

let vaultEns = '';

let vaultInst = [];

let catalogEns = '';

let catalogInst = [];

let vaultSearch = '';

let catalogSearch = '';

let editing = { vault:null, catalog:null };

let pickerSel = { vault:new Set(), catalog:new Set() };

let pickerGen = { vault:new Set(), catalog:new Set() };

let editModalKey = null;

let confirmCb = null;

let confirmForce = false;

let faqEditing = null;

const $ = id => document.getElementById(id);

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

const clone = v => JSON.parse(JSON.stringify(v));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function attr(s) { return esc(s).replace(/`/g,'&#96;'); }

function safeUrl(u) {
  const t = String(u || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+([\/?#].*)?$/.test(t)) return 'https://' + t;
  return '';
}

function isDraft() {
  try { return localStorage.getItem(DRAFT_KEY) === '1'; } catch { return false; }
}

function markDraft() {
  try { localStorage.setItem(DRAFT_KEY, '1'); localStorage.setItem('smp_draftVersion','4'); } catch {}
  renderDraftStatus();
}

function rawLoad(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}

function loadContent(key, pubField, fallback) {
  let base = PUBLISHED && PUBLISHED[pubField] !== undefined ? clone(PUBLISHED[pubField]) : clone(fallback);
  if (isDraft()) {
    const local = rawLoad(key);
    if (local !== null) base = local;
  }
  return base;
}

function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? clone(fallback) : JSON.parse(raw);
  } catch { return clone(fallback); }
}

function saveKey(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('localStorage save failed:', e); }
}

function friendPersisted() {
  try { return localStorage.getItem(LS.friend) === '1'; } catch { return false; }
}

function loadAccess() {
  if (fbUser) return 'admin';
  try { if (!FB_READY && JSON.parse(sessionStorage.getItem(LS.access) || 'null') === 'admin') return 'admin'; } catch {}
  return friendPersisted() ? 'friends' : 'none';
}

function persistFriend(on) {
  try { on ? localStorage.setItem(LS.friend, '1') : localStorage.removeItem(LS.friend); } catch {}
}

function persistAdmin(on) {
  try { on ? sessionStorage.setItem(LS.access, JSON.stringify('admin')) : sessionStorage.removeItem(LS.access); } catch {}
}

function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function validContentRecord(item) {
  return isRecord(item) && typeof item.id === 'string' && /^[\w-]+$/.test(item.id) && typeof item.title === 'string';
}

function contentRecords(value, fallback, valid) {
  return Array.isArray(value) ? value.filter(valid) : clone(fallback);
}

function migrateScores(list) {
  let changed = false;
  list.forEach(x => {
    if (!x.tags && x.instruments) { x.tags = x.instruments; delete x.instruments; changed = true; }
    if (!Array.isArray(x.tags)) { x.tags = []; changed = true; }
    if ('videoFile' in x) { delete x.videoFile; changed = true; }
    if (typeof x.artist !== 'string') { x.artist = ''; changed = true; }
    if (typeof x.arrangement !== 'string') { x.arrangement = ''; changed = true; }
    if (typeof x.difficulty !== 'string') { x.difficulty = ''; changed = true; }
    if (typeof x.dateAdded !== 'string') { x.dateAdded = ''; changed = true; }
    if (!Array.isArray(x.genres)) { x.genres = []; changed = true; }
    if (typeof x.previewImg !== 'string') { x.previewImg = ''; changed = true; }
    if ('pdf' in x) { delete x.pdf; changed = true; }
    if (typeof x.driveLink !== 'string') { x.driveLink = ''; changed = true; }
    if (typeof x.musescoreLink !== 'string') { x.musescoreLink = ''; changed = true; }
    if (typeof x.audioFile !== 'string') { x.audioFile = ''; changed = true; }
    if (typeof x.pdfFile !== 'string') { x.pdfFile = ''; changed = true; }
    if (!Array.isArray(x.links)) { x.links = []; changed = true; }
    x.links = x.links.filter(l => l && safeUrl(l.url)).slice(0, 3).map(l => ({ label: String(l.label || ''), url: safeUrl(l.url) }));
  });
  return changed;
}

function loadState() {
  state.catalog = contentRecords(loadContent(LS.catalog, 'catalog', DEFAULTS.catalog), DEFAULTS.catalog, validScoreRecord);
  state.vault = contentRecords(loadContent(LS.vault, 'vault', DEFAULTS.vault), DEFAULTS.vault, validScoreRecord);
  if (migrateScores(state.catalog)) saveKey(LS.catalog, state.catalog);
  if (migrateScores(state.vault)) saveKey(LS.vault, state.vault);
  state.social = loadContent(LS.social, 'social', DEFAULTS.social);
  if (!state.social || typeof state.social !== 'object') state.social = clone(DEFAULTS.social);
  if (typeof state.social.downloads !== 'string') state.social.downloads = '';
  state.genres = loadContent(LS.genres, 'genres', DEFAULTS.genres);
  state.siteStatus = loadContent(LS.siteStatus, 'siteStatus', DEFAULTS.siteStatus);
  if (!state.siteStatus || typeof state.siteStatus !== 'object' || Array.isArray(state.siteStatus)) state.siteStatus = clone(DEFAULTS.siteStatus);
  state.siteStatus = { down: state.siteStatus.down === true, downSince: typeof state.siteStatus.downSince === 'number' ? state.siteStatus.downSince : 0, etaMin: typeof state.siteStatus.etaMin === 'number' && state.siteStatus.etaMin > 0 ? state.siteStatus.etaMin : '' };
  if (!Array.isArray(state.genres)) state.genres = clone(DEFAULTS.genres);
  state.genres = state.genres.filter(g => typeof g === 'string' && g.trim()).map(g => g.trim());
  state.texts = loadContent(LS.texts, 'texts', {});
  if (!state.texts || typeof state.texts !== 'object' || Array.isArray(state.texts)) state.texts = {};
  state.layout = Object.assign({ vault:'grid', catalog:'grid' }, loadKey(LS.layout, DEFAULTS.layout));
  state.featured = loadContent(LS.featured, 'featured', '');
  if (typeof state.featured !== 'string') state.featured = '';
  state.faq = loadContent(LS.faq, 'faq', DEFAULTS.faq);
  if (!Array.isArray(state.faq)) state.faq = [];
  state.faq = state.faq.filter(f => f && typeof f.q === 'string' && typeof f.a === 'string').map(f => ({ id: f.id || uid(), q: f.q, a: f.a }));
  state.seen = loadKey(LS.seen, {});
  if (typeof state.seen !== 'object' || state.seen === null || Array.isArray(state.seen)) state.seen = {};
  const st = loadKey(LS.settings, DEFAULT_SETTINGS);
  state.settings = { ...DEFAULT_SETTINGS, ...(st && typeof st === 'object' && !Array.isArray(st) ? st : {}) };
  if (![0.1,0.5,1,1.5,2,4,100].includes(Number(state.settings.speed))) state.settings.speed = 1;
  state.settings.speed = Number(state.settings.speed);
  if (!['system','reduced','extra'].includes(state.settings.motion)) state.settings.motion = 'system';
  if (!['s','m','l'].includes(state.settings.text)) state.settings.text = 'm';
  state.settings.lite = Boolean(state.settings.lite);
  state.settings.invert = Boolean(state.settings.invert);
  if (!PUBLISHED || Number(PUBLISHED.version || 0) < 4) ['catalogSub','vaultSub','faqSub','contactSub'].forEach(key => { state.texts[key] = ''; });
  state.access = loadAccess();
  state.catalog = ScoreModel.normalizeLibrary(state.catalog);
  let draftVersion=0;try{draftVersion=Number(localStorage.getItem('smp_draftVersion'))||0;}catch{}
  if ((!PUBLISHED || Number(PUBLISHED.version||0)<4) && (!isDraft()||draftVersion<4)) {
    state.vault=ScoreModel.seedLibrary(state.vault,window.InitialArrangements||[]);
    if(isDraft()){saveKey(LS.vault,state.vault);try{localStorage.setItem('smp_draftVersion','4');}catch{}}
  }
  state.vault = ScoreModel.normalizeLibrary(state.vault);
  if (!PUBLISHED || Number(PUBLISHED.version || 0) < 4) state.catalog.forEach(score => { score.desc = ''; score.variants.forEach(variant => { variant.desc = ''; }); });
}

function ytId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function validAudioPath(v) {
  const t = String(v || '').trim();
  if (!t) return '';
  if (/^https?:/i.test(t)) {
    return t.startsWith(location.origin + '/') && /\.(mp3|m4a|wav|ogg)$/i.test(t) ? t : null;
  }
  return /^[\w][\w./ %-]*\.(mp3|m4a|wav|ogg)$/i.test(t) ? t : null;
}

function pauseAudioEls(except) {
  document.querySelectorAll('audio').forEach(a => { if (a !== except) a.pause(); });
}

function audioBlock(item, kind) {
  if (kind !== 'vault' || !item.audioFile) return '';
  return `<div class="score-preview"><span>Audio preview<small>MuseScore Studio</small></span><audio controls preload="none" class="w-full" src="${attr(item.audioFile)}" aria-label="Audio: ${attr(item.title)}"></audio></div>`;
}

function validPdfPath(v) {
  const t = String(v || '').trim();
  if (!t) return '';
  if (/^https?:/i.test(t)) return t.startsWith(location.origin + '/') && /\.pdf$/i.test(t) ? t : null;
  return /^[\w][\w./ %-]*\.pdf$/i.test(t) ? t : null;
}

function adminSaveGhToken() {
  const v = $('gh-token').value.trim();
  if (!v) { toast('Paste a token first.', false); return; }
  try { localStorage.setItem(LS.ghToken, v); } catch {}
  $('gh-token').value = '';
  ghTokenStatus();
  toast('Token saved on this device.');
}

function adminClearGhToken() {
  try { localStorage.removeItem(LS.ghToken); } catch {}
  ghTokenStatus();
  toast('Token removed.');
}

let ghBusy = false;

function validPreviewPath(p) {
  const t = String(p || '').trim();
  if (!t) return '';
  if (/^https?:/i.test(t)) {
    return t.startsWith(location.origin + '/') ? t : null;
  }
  return /^[\w][\w./ %-]*\.(png|jpe?g|webp|gif)$/i.test(t) ? t : null;
}

function iframeHTML(id, title) {
  return `<iframe class="w-full h-full" src="https://www.youtube-nocookie.com/embed/${id}" title="${attr(title)}" loading="lazy" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
}

function embedBlock(item, kind) {
  const id = kind === 'vault' ? null : ytId(item.video);
  if (id && state.settings.lite) {
    return `<div class="embed-slot relative aspect-video bg-sunken">
      <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover opacity-80" />
      <button data-vid="${id}" data-title="${attr(item.title)}" onclick="event.stopPropagation();loadEmbed(this)" class="ui-btn absolute inset-0 grid place-items-center" aria-label="Load video: ${attr(item.title)}">
        <span class="rounded-xl bg-surface/90 border border-line px-4 py-2 text-sm font-bold text-ink">&#9654; Load video</span>
      </button>
    </div>`;
  }
  if (id) return `<div class="embed-slot aspect-video bg-sunken">${iframeHTML(id, item.title)}</div>`;
  if (item.previewImg) return `<div class="aspect-video bg-sunken overflow-hidden"><img src="${attr(item.previewImg)}" alt="Sheet preview: ${attr(item.title)}" loading="lazy" class="w-full h-full object-cover object-top" /></div>`;
  return `<div class="aspect-video bg-gradient-to-br from-surface to-sunken flex flex-col items-center justify-center gap-1 text-faint"><span class="font-display text-4xl" aria-hidden="true">&#9835;</span><span class="text-xs">No preview yet</span></div>`;
}

function loadEmbed(btn) {
  const slot = btn.closest('.embed-slot');
  if (slot) slot.innerHTML = iframeHTML(btn.dataset.vid, btn.dataset.title);
}

let toastTimer = null;

function toast(msg, ok = true) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] rounded-xl px-5 py-3 text-sm shadow-2xl border ' +
    (ok ? 'bg-surface border-accent/40 text-accent' : 'bg-surface border-danger/40 text-danger');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

function skipActive() {
  try { return Date.now() < Number(sessionStorage.getItem(LS.skip) || 0); } catch { return false; }
}

function setSkip() {
  try { sessionStorage.setItem(LS.skip, String(Date.now() + 15 * 60 * 1000)); } catch {}
}

function confirmAction(msg, cb, force = false) {
  if (!force && skipActive()) { cb(); return; }
  $('confirm-modal-msg').textContent = msg;
  $('confirm-skip').checked = false;
  $('confirm-skip-row').classList.toggle('hidden', force);
  confirmCb = cb;
  confirmForce = force;
  $('confirm-modal').showModal();
}

function closeConfirmModal(yes) {
  const cb = confirmCb;
  const force = confirmForce;
  confirmCb = null;
  if (yes && !force && $('confirm-skip').checked) setSkip();
  $('confirm-modal').close();
  if (yes && cb) cb();
}

function motionReduced() {
  const m = document.documentElement.dataset.motion;
  if (m === 'reduced') return true;
  if (m === 'extra') return false;
  return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applySettings() {
  const el = document.documentElement;
  const s = state.settings;
  window.siteAppearance.apply(s);
  $('set-theme').value = ['light','dark'].includes(s.theme) ? s.theme : 'system';
  el.style.setProperty('--speed', String(s.speed));
  if (s.motion === 'system') el.removeAttribute('data-motion'); else el.dataset.motion = s.motion;
  if (s.lite) el.dataset.lite = '1'; else el.removeAttribute('data-lite');
  el.dataset.text = s.text;
  if (s.invert) el.dataset.invert = '1'; else el.removeAttribute('data-invert');
  $('set-motion').value = s.motion;
  $('set-speed').value = String(s.speed);
  $('set-text').value = s.text;
  $('set-lite').checked = s.lite;
  $('set-invert').checked = s.invert;
}

function setSetting(key, val) {
  if (key === 'speed') val = Number(val);
  const wasLite = state.settings.lite;
  state.settings[key] = val;
  saveKey(LS.settings, state.settings);
  applySettings();
  if (key === 'lite' && wasLite !== val) {
    renderVault();
    renderCatalog();
    renderFeatured();
  }
  toast('Setting applied.');
}

function openSettings() {
  applySettings();
  $('settings-modal').showModal();
}

const INAPP = /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|Snapchat|MicroMessenger|Twitter|GSA\/|; wv\)/i.test(navigator.userAgent);

const IS_ANDROID = /android/i.test(navigator.userAgent);

if (INAPP) $('inapp-bar').classList.remove('hidden');

function dismissInapp() {
  $('inapp-bar').classList.add('hidden');
}

function inappHint() {
  $('inapp-more').textContent = IS_ANDROID
    ? 'If nothing happened: tap the \u22EE menu (top right) and choose \u201COpen in browser\u201D - or use Copy link and paste it into Chrome.'
    : 'This app blocks automatic opening. Tap the \u2026 or \u22EF menu (top right) and choose \u201COpen in external browser\u201D - or use Copy link and paste it into Safari.';
  $('inapp-more').classList.remove('hidden');
}

function openExternalBrowser() {
  const url = location.href;
  if (IS_ANDROID) {
    const intent = 'intent://' + location.host + location.pathname + location.search + '#Intent;scheme=https;S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
    const a = document.createElement('a');
    a.href = intent;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    try { window.open(url, '_blank'); } catch {}
  }
  setTimeout(() => { if (document.visibilityState === 'visible') inappHint(); }, 700);
}

function copySiteLink() {
  const url = location.href;
  const done = () => { toast('Link copied - paste it into your browser.'); inappHint(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => copyFallback(url, done));
  } else copyFallback(url, done);
}

function copyFallback(text, done) {
  const t = document.createElement('textarea');
  t.value = text;
  t.style.position = 'fixed';
  t.style.opacity = '0';
  document.body.appendChild(t);
  t.select();
  try { document.execCommand('copy'); done(); } catch { toast('Copy failed - long-press the address bar instead.', false); }
  t.remove();
}

window.addEventListener('scroll', () => {
  const m = $('mobile-menu');
  if (!m || !m.classList.contains('open')) return;
  if (Date.now() - menuOpenT < 350) return;
  if (Math.abs(window.scrollY - menuOpenY) < 24) return;
  toggleMobileMenu();
}, { passive: true });

function scrollTopSmooth() {
  window.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' });
}

function markSeen(flag) {
  if (state.seen[flag]) return;
  state.seen[flag] = true;
  saveKey(LS.seen, state.seen);
}

const VIEWS = ['home','scores','access','admin'];

const ROUTES = { home:'', scores:'#/scores', access:'#/friends', admin:'#/admin' };

let currentView = 'home';

let suppressRoute = false;

function renderView(view) {
  if (view === 'admin') {
    $('admin-login').classList.toggle('hidden', state.access === 'admin');
    $('admin-center').classList.toggle('hidden', state.access !== 'admin');
  }
  if (view === 'access') $('friends-entry').classList.toggle('hidden', state.access !== 'none');
  if (sitedownActive() && !['home','admin'].includes(view)) view = 'home';
  currentView = view;
  document.querySelectorAll('[data-view]').forEach(a => { if (a.dataset.view === view) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  pauseAudioEls(null);
  if (typeof applySiteStatus === 'function' && state.siteStatus) applySiteStatus();
  stopAudio();
  VIEWS.forEach(v => $('view-' + v).classList.toggle('hidden', v !== view));
  if ($('mobile-menu').classList.contains('open')) toggleMobileMenu();

  window.scrollTo({ top: 0, behavior: 'auto' });
}

function setHash(h) {
  if ((location.hash || '') === h) return;
  if (h === '') { history.pushState('', document.title, location.pathname + location.search); return; }
  suppressRoute = true;
  location.hash = h;
}

function navigateView(event, view) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return true;
  showView(view);
  return false;
}

function showView(view) {
  renderView(view);
  setHash(ROUTES[currentView]);
  if (window.goatcounter && window.goatcounter.count) {
    try { window.goatcounter.count({ path: '/' + (view === 'home' ? '' : view) }); } catch {}
  }
}

function applyRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const modal = $('score-modal');
  if (h === 'main-content') { $('main-content').focus({ preventScroll: true }); return; }
  if (h === 'contact') {
    if (modal.open) modal.close();
    renderView('home');
    if (!sitedownActive()) { $('contact').scrollIntoView({ behavior: 'auto' }); $('contact').focus({ preventScroll: true }); }
    return;
  }
  if (h.startsWith('s/')) { openScoreById(h.slice(2)); return; }
  if (modal.open) modal.close();
  if (h === 'scores') renderView('scores');
  else if (h === 'friends') renderView('access');
  else if (h === 'admin') renderView('admin');
  else renderView('home');
}

window.addEventListener('hashchange', () => {
  if (suppressRoute) { suppressRoute = false; return; }
  applyRoute();
});

function gotoScore(id) {
  openScoreById(id);
  setHash('#/s/' + id);
}

function goToFriends() { showView('access'); }

function toggleMobileMenu() {
  const m = $('mobile-menu'), b = $('mobile-menu-btn');
  const open = m.classList.toggle('open');
  m.hidden = !open;
  m.inert = !open;
  b.setAttribute('aria-expanded', String(open));
  if (open) { menuOpenY = window.scrollY; menuOpenT = Date.now(); }
}

let menuOpenY = 0;

let menuOpenT = 0;

function captureDefaultTexts() {
  document.querySelectorAll('[data-edit]').forEach(el => {
    if (!(el.dataset.edit in DEFAULT_TEXTS)) DEFAULT_TEXTS[el.dataset.edit] = el.textContent;
  });
}

function defaultText(key) { return DEFAULT_TEXTS[key] || ''; }

function applyTexts() {
  document.querySelectorAll('[data-edit]').forEach(el => {
    const key = el.dataset.edit;
    el.textContent = Object.hasOwn(state.texts, key) ? state.texts[key] : defaultText(key);
  });
}

function resetText(key) {
  delete state.texts[key];
  saveKey(LS.texts, state.texts);
  afterContentChange();
  applyTexts();
  renderEditButtons();
  renderAdminTextList();
  renderDashboard();
  toast('Changes saved.');
}

function openEditModal(key) {
  editModalKey = key;
  $('edit-modal-title').textContent = 'Edit: ' + (TEXT_LABELS[key] || key);
  $('edit-modal-input').value = Object.hasOwn(state.texts, key) ? state.texts[key] : defaultText(key);
  $('edit-modal').showModal();
  $('edit-modal-input').focus();
}

function closeEditModal() {
  editModalKey = null;
  $('edit-modal').close();
}

function saveEditModal() {
  const key = editModalKey;
  const val = $('edit-modal-input').value.trim();
  if (!key) { closeEditModal(); return; }
  closeEditModal();
  confirmAction('Save this text change?', () => {
    state.texts[key] = val;
    saveKey(LS.texts, state.texts);
    afterContentChange();
    applyTexts();
    renderEditButtons();
    renderAdminTextList();
    renderDashboard();
    toast('Changes saved.');
  });
}

function renderEditButtons() {
  document.querySelectorAll('.edit-text-btn').forEach(b => b.remove());
  if (state.access !== 'admin') return;
  document.querySelectorAll('[data-edit]').forEach(el => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-btn edit-text-btn ml-2 align-middle text-[11px] font-semibold rounded-lg border border-admin/60 text-admin px-2 py-0.5 hover:bg-admin/10 transition-colors';
    btn.textContent = 'Edit';
    btn.setAttribute('aria-label', 'Edit ' + el.dataset.edit);
    btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(el.dataset.edit); });
    const host = el.closest('button,a') || el;
    host.insertAdjacentElement('afterend', btn);
  });
}

function renderAdminTextList() {
  if (state.access !== 'admin') return;
  $('admin-text-list').innerHTML = Object.keys(TEXT_LABELS).map(key => {
    const edited = Object.hasOwn(state.texts, key);
    const current = Object.hasOwn(state.texts, key) ? state.texts[key] : defaultText(key);
    return `<li class="flex items-center justify-between gap-3 bg-sunken border border-line rounded-xl px-3 py-2.5">
      <div class="min-w-0">
        <p class="text-xs text-faint">${esc(TEXT_LABELS[key])}${edited ? ' <span class="text-admin">(edited)</span>' : ''}</p>
        <p class="truncate text-ink">${esc(current)}</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button onclick="openEditModal('${key}')" class="ui-btn text-xs font-semibold rounded-lg border border-admin/60 text-admin px-3 py-1.5 hover:bg-admin/10">Edit</button>
        ${edited ? `<button onclick="resetText('${key}')" class="ui-btn text-xs font-semibold rounded-lg border border-line text-mute px-3 py-1.5 hover:text-ink">Reset</button>` : ''}
      </div>
    </li>`;
  }).join('');
}

function applySocial() {
  const yt = state.social.youtube || '#';
  const ig = state.social.instagram || '#';
  const dl = state.social.downloads || '';
  ['icon-youtube','foot-youtube'].forEach(id => { $(id).href = yt; });
  ['icon-instagram','foot-instagram'].forEach(id => { $(id).href = ig; });
  ['nav-downloads','nav-downloads-m'].forEach(id => {
    $(id).href = dl || '#';
    $(id).classList.toggle('hidden', !dl);
  });
  $('soc-youtube').value = state.social.youtube || '';
  $('soc-instagram').value = state.social.instagram || '';
  $('soc-downloads').value = state.social.downloads || '';
}

let dtTimer = null;

function fmtDur(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(t / 3600) + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

function sitedownActive() {
  return Boolean(state.siteStatus && state.siteStatus.down && state.access !== 'admin');
}

function downtimeAdmin() {
  showView('admin');
  if (state.access !== 'admin') $('al-email').focus();
}

function adminSaveSiteStatus() {
  const on = $('st-down').checked;
  confirmAction(on ? 'Take the site down for everyone?' : 'Bring the site back up?', () => {
    const h = Number($('st-eta-h').value) || 0;
    const m = Number($('st-eta-m').value) || 0;
    const eta = h * 60 + m;
    const desc = $('st-desc').value.trim();
    state.texts.dtSub = desc;
    saveKey(LS.texts, state.texts);
    applyTexts();
    state.siteStatus = {
      down: on,
      downSince: on ? (state.siteStatus.down ? state.siteStatus.downSince : Date.now()) : 0,
      etaMin: eta > 0 ? eta : ''
    };
    saveKey(LS.siteStatus, state.siteStatus);
    afterContentChange();
    applySiteStatus();
    toast(on ? 'Site is now in downtime mode.' : 'Site is back up.');
  });
}

function adminSaveSocial() {
  const yt = $('soc-youtube').value.trim();
  const ig = $('soc-instagram').value.trim();
  const dl = $('soc-downloads').value.trim();
  const ytSafe = safeUrl(yt);
  const igSafe = safeUrl(ig);
  const dlSafe = safeUrl(dl);
  if ((yt && !ytSafe) || (ig && !igSafe) || (dl && !dlSafe)) { toast('Links must be normal web URLs (https://\u2026).', false); return; }
  confirmAction('Save these social links?', () => {
    state.social = { youtube: ytSafe, instagram: igSafe, downloads: dlSafe };
    saveKey(LS.social, state.social);
    afterContentChange();
    applySocial();
    renderDashboard();
    toast('Changes saved.');
  });
}

let ytApiLoaded = false;

let ytApiRequested = false;

const ytQueue = [];

window.onYouTubeIframeAPIReady = () => {
  ytApiLoaded = true;
  ytQueue.splice(0).forEach(f => { try { f(); } catch (e) { console.warn(e); } });
};

function withYT(cb) {
  if (ytApiLoaded) { cb(); return; }
  ytQueue.push(cb);
  if (!ytApiRequested) {
    ytApiRequested = true;
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api';
    sc.onerror = () => {
      ytApiRequested = false;
      ytQueue.length = 0;
      sc.remove();
      audioBarClose();
      toast('The audio player could not load. Check your connection and try again.', false);
    };
    document.head.appendChild(sc);
  }
}

let ytPlayer = null;

let ytPlayerReady = false;

const ytPlayerQueue = [];

let currentAudio = null;

let audioRequest = 0;

let audioState = 'paused';

function withPlayer(cb) {
  if (ytPlayer && ytPlayerReady) { cb(); return; }
  ytPlayerQueue.push(cb);
  if (!ytPlayer) {
    ytPlayer = new YT.Player('yt-audio-player', {
      height: '1',
      width: '1',
      playerVars: { playsinline: 1 },
      events: {
        onReady: () => { ytPlayerReady = true; ytPlayerQueue.splice(0).forEach(f => { try { f(); } catch (e) { console.warn(e); } }); },
        onStateChange: onAudioStateChange,
        onError: () => { toast('The song could not be played. Try another preview.', false); currentAudio = null; audioState = 'paused'; refreshAudioUI(); }
      }
    });
  }
}

function onAudioStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING) audioState = 'playing';
  else if (e.data === YT.PlayerState.ENDED) { audioState = 'paused'; currentAudio = null; }
  else audioState = 'paused';
  refreshAudioUI();
}

let audioTitle = '';

let seekDragging = false;

let barTimer = null;

function refreshAudioUI() {
  document.querySelectorAll('[data-akey]').forEach(b => {
    const cur = currentAudio === b.dataset.akey;
    const playing = cur && audioState === 'playing';
    b.classList.toggle('border-accent', cur);
    b.classList.toggle('text-accent', cur);
    b.classList.toggle('bg-accent/10', cur);
    b.classList.toggle('border-line', !cur);
    b.classList.toggle('text-mute', !cur);
    b.innerHTML = uiIcon(playing ? 'pause' : 'play');
    b.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + (b.dataset.atitle || ''));
  });
  audioBarSync();
}

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

function audioBarSync() {
  const bar = $('audio-bar');
  if (!bar) return;
  if (!currentAudio) {
    bar.classList.add('hidden');
    document.body.classList.remove('audio-open');
    if (barTimer) { clearInterval(barTimer); barTimer = null; }
    return;
  }
  bar.classList.remove('hidden');
  document.body.classList.add('audio-open');
  $('ab-title').textContent = audioTitle || 'Now playing';
  $('ab-toggle').innerHTML = uiIcon(audioState === 'playing' ? 'pause' : 'play');
  $('ab-toggle').setAttribute('aria-label', audioState === 'playing' ? 'Pause' : 'Play');
  if (!barTimer) barTimer = setInterval(audioBarTick, 500);
  audioBarTick();
}

function audioBarTick() {
  if (!ytPlayer || !ytPlayerReady || seekDragging) return;
  let cur = 0, dur = 0;
  try { cur = ytPlayer.getCurrentTime() || 0; dur = ytPlayer.getDuration() || 0; } catch { return; }
  const sl = $('ab-seek');
  sl.max = dur > 0 ? Math.floor(dur) : 0;
  sl.value = Math.floor(cur);
  $('ab-cur').textContent = fmtClock(cur);
  $('ab-dur').textContent = fmtClock(dur);
}

function audioSeekInput() {
  seekDragging = true;
  $('ab-cur').textContent = fmtClock(Number($('ab-seek').value));
}

function audioSeekCommit() {
  if (ytPlayer && ytPlayerReady) { try { ytPlayer.seekTo(Number($('ab-seek').value), true); } catch {} }
  seekDragging = false;
}

function audioBarToggle() {
  if (!ytPlayer || !ytPlayerReady) return;
  if (audioState === 'playing') ytPlayer.pauseVideo(); else ytPlayer.playVideo();
}

function audioBarClose() {
  audioRequest++;
  if (ytPlayer && ytPlayerReady) { try { ytPlayer.pauseVideo(); } catch {} }
  currentAudio = null;
  audioState = 'paused';
  refreshAudioUI();
}

function toggleAudioKey(key, vid, title) {
  if (!vid) return;
  if (title) audioTitle = title;
  pauseAudioEls(null);
  if (currentAudio === key && ytPlayer && ytPlayerReady) {
    if (audioState === 'playing') ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
    return;
  }
  const request = ++audioRequest;
  currentAudio = key;
  audioState = 'playing';
  refreshAudioUI();
  withYT(() => {
    if (request !== audioRequest) return;
    withPlayer(() => { if (request === audioRequest) ytPlayer.loadVideoById(vid); });
  });
}

function stopAudio() {
  audioRequest++;
  if (ytPlayer && ytPlayerReady && audioState === 'playing') ytPlayer.pauseVideo();
  audioState = 'paused';
  refreshAudioUI();
}

async function adminLogin() {
  const feedback = $('admin-login-feedback');
  const button = $('admin-login-submit');
  if (button.disabled) return;
  feedback.textContent = '';
  if (!fbAuth || !fbAuthTools) { feedback.textContent = 'Sign-in is unavailable. Check your connection and reload the page.'; return; }
  const email = $('al-email').value.trim();
  const pass = $('al-pass').value;
  if (!email || !pass) { feedback.textContent = 'Enter your email and password.'; return; }
  button.disabled = true;
  button.textContent = 'Signing in…';
  try {
    await fbAuthTools.signInWithEmailAndPassword(fbAuth, email, pass);
    $('al-pass').value = '';
    $('admin-login').classList.add('hidden');
    showView('admin');
  } catch {
    feedback.textContent = 'Sign-in failed. Check your email and password and try again.';
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
}

function genreLabel(g) { return g === FAVOURITE_GENRE ? g + ' \u2605' : g; }

function listOf(kind) { return kind === 'vault' ? state.vault : state.catalog; }

function lsOf(kind) { return kind === 'vault' ? LS.vault : LS.catalog; }

function prefixOf(kind) { return kind === 'vault' ? 'v' : 'c'; }

function isNew(item) {
  if (!item.dateAdded) return false;
  const t = Date.parse(item.dateAdded);
  return Number.isFinite(t) && (Date.now() - t) < 30 * 24 * 60 * 60 * 1000;
}

function badgeRow(item) {
  const parts = [];
  if (isNew(item)) parts.push('<span class="text-[11px] font-bold rounded-full px-2 py-0.5 bg-accent/10 border border-accent/60 text-accent">New</span>');
  if (item.difficulty) parts.push(`<span class="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-sunken border border-line text-mute">${esc(item.difficulty)}</span>`);
  return parts.join(' ');
}

function metaLine(item) {
  return [item.artist, item.arrangement].filter(Boolean).map(esc).join(' &middot; ');
}

function scoreLinkButtons(item, size = 'sm') {
  const pad = size === 'lg' ? 'px-5 py-2.5' : 'px-4 py-2';
  const btns = (item.links || []).map((l, i) =>
    `<a href="${attr(l.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="ui-btn inline-flex items-center gap-1.5 rounded-xl ${i === 0 ? 'bg-accent text-oninv hover:bg-accent-hi' : 'border border-accent/60 text-accent hover:bg-accent/10'} ${pad} text-sm font-bold transition-colors">${esc(l.label || 'Sheet Music')}</a>`);
  if (item.driveLink) btns.push(`<a href="${attr(item.driveLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="ui-btn inline-flex items-center gap-1.5 rounded-xl bg-accent text-oninv hover:bg-accent-hi ${pad} text-sm font-bold transition-colors">&#8595; Download</a>`);
  if (item.musescoreLink) btns.push(`<a href="${attr(item.musescoreLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="ui-btn inline-flex items-center gap-1.5 rounded-xl border border-accent/60 text-accent hover:bg-accent/10 ${pad} text-sm font-bold transition-colors">&#9835; MuseScore</a>`);
  if (item.pdfFile) btns.push(`<a href="${attr(item.pdfFile)}" download onclick="event.stopPropagation()" class="ui-btn inline-flex items-center gap-1.5 rounded-xl border border-accent/60 text-accent hover:bg-accent/10 ${pad} text-sm font-bold transition-colors">&#8595; PDF</a>`);
  return btns.join('');
}

function adminItemButtons(kind, id) {
  if (state.access !== 'admin') return '';
  return `<div class="flex gap-1.5 ml-auto">
    <button onclick="event.stopPropagation();startEdit('${kind}','${id}')" class="ui-btn text-xs font-semibold text-admin hover:text-admin-hi border border-admin/40 rounded-xl px-3 py-2 hover:bg-admin/10">Edit</button>
    <button onclick="event.stopPropagation();deleteScore('${kind}','${id}')" class="ui-btn text-xs font-semibold text-danger hover:text-danger-hi border border-danger/40 rounded-xl px-3 py-2 hover:bg-danger/10">Delete</button>
  </div>`;
}

function uiIcon(name) {
  const paths = { play:'<path d="m8 5 11 7-11 7Z"/>', pause:'<path d="M8 5v14M16 5v14"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>', up:'<path d="m6 14 6-6 6 6"/>', down:'<path d="m6 10 6 6 6-6"/>' };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.play}</svg>`;
}

function scorePreview(item, kind) {
  if (kind === 'vault') return audioBlock(item, kind);
  if (!ytId(item.video)) return '';
  const key = 'score:' + kind + ':' + item.id;
  const playing = currentAudio === key && audioState === 'playing';
  return `<div class="score-preview"><button class="ui-btn icon-button border border-line" data-akey="${key}" data-atitle="${attr(item.title)}" onclick="playScoreAudio('${kind}','${item.id}')" aria-label="${playing ? 'Pause' : 'Play'} ${attr(item.title)}">${uiIcon(playing ? 'pause' : 'play')}</button><span>Audio preview<small>MuseScore Studio</small></span></div>`;
}

const scoreGenres = { catalog:'', vault:'' };

function toggleFilters(kind) {
  const panel = $(kind+'-filters');
  panel.hidden = !panel.hidden;
  $(kind+'-filters-toggle').setAttribute('aria-expanded', String(!panel.hidden));
}

function clearScoreFilters(kind) {
  const st = instState(kind); st.ens = ''; st.inst = [];
  scoreGenres[kind] = '';
  if (kind === 'vault') { vaultSearch = ''; vaultDiff = ''; } else { catalogSearch = ''; catalogDiff = ''; }
  $(kind+'-search').value = '';
  renderDiffChips(kind);
  renderScores(kind);
}

function recordView(id) {
  if (!fbActive || !fbdb || !fbTools) return;
  let seen = {};
  try { seen = JSON.parse(sessionStorage.getItem('smp_viewed') || '{}'); } catch {}
  if (!isRecord(seen)) seen = {};
  if (seen[id]) return;
  seen[id] = 1;
  try { sessionStorage.setItem('smp_viewed', JSON.stringify(seen)); } catch {}
  fbTools.setDoc(fbTools.doc(fbdb, 'views', id), { count: fbTools.increment(1) }, { merge: true }).catch(() => {});
}

function copyScoreLink(id) {
  const url = location.origin + location.pathname + '#/s/' + id;
  const done = () => toast('Link copied.');
  const fail = () => toast('Could not copy - the link is: ' + url, false);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fail);
  else fail();
}

const ENSEMBLE_TAGS = ScoreModel.ensembles;

const INST_GROUPS = [
  ['Flutes', ['Piccolo','Flute']],
  ['Saxophones', ['Soprano Saxophone','Alto Saxophone','Tenor Saxophone','Baritone Saxophone','Saxophone']],
  ['Brass', ['Trumpet','French Horn','Trombone','Baritone Horn','Tuba','Sousaphone']],
  ['Other woodwinds', ['Clarinet','Bass Clarinet','Oboe','Bassoon']],
  ['Percussion', ['Snare Drum','Bass Drum','Tenor Drums','Cymbals','Timpani','Glockenspiel','Xylophone','Tambourine','Triangle','Drum Kit','Piano']],
  ['Strings', ['Violin','Viola','Cello','Contrabass','Guitar','Bass Guitar']]
];

function instState(kind) {
  return kind === 'vault'
    ? { get ens() { return vaultEns; }, set ens(v) { vaultEns = v; }, get inst() { return vaultInst; }, set inst(v) { vaultInst = v; } }
    : { get ens() { return catalogEns; }, set ens(v) { catalogEns = v; }, get inst() { return catalogInst; }, set inst(v) { catalogInst = v; } };
}

function renderTagFilter(kind) {
  const st = instState(kind);
  const seen = presentTags(kind);
  const ensPresent = ENSEMBLE_TAGS.filter(e => e==='Melody' || seen.has(e.toLowerCase()));
  const sel = $(kind + '-ens-select');
  sel.innerHTML = '<option value="">All ensembles</option>' + ensPresent.map(e => `<option value="${attr(e.toLowerCase())}">${esc(e)}</option>`).join('');
  if (st.ens && !ensPresent.some(e=>e.toLowerCase()===st.ens)) st.ens = '';
  sel.value = st.ens;
  const tabs=$(kind+'-ensemble-tabs');
  if (!tabs.children.length) tabs.innerHTML=['',...ENSEMBLE_TAGS].map(ensemble=>`<button type="button" class="ui-btn ensemble-tab" data-ensemble="${attr(ensemble.toLowerCase())}" aria-pressed="false" aria-controls="${kind}-grid" onclick="setEnsFilter('${kind}',this.dataset.ensemble)">${esc(ensemble||'All scores')}</button>`).join('');
  tabs.querySelectorAll('button').forEach(button=>{
    button.hidden=!!button.dataset.ensemble && !ensPresent.some(e=>e.toLowerCase()===button.dataset.ensemble);
    button.setAttribute('aria-pressed',String(button.dataset.ensemble===st.ens));
  });
  st.inst = st.inst.filter(t => seen.has(t));
  renderInstMenu(kind, seen);
  renderInstChips(kind, seen);
}

function renderInstMenu(kind, seen) {
  seen = seen || presentTags(kind);
  const st = instState(kind);
  const ensLower = ENSEMBLE_TAGS.map(e => e.toLowerCase());
  const grouped = new Set();
  const html = [];
  for (const [label, members] of INST_GROUPS) {
    const here = members.filter(m => seen.has(m.toLowerCase()));
    here.forEach(m => grouped.add(m.toLowerCase()));
    if (!here.length) continue;
    html.push(`<p class="text-xs font-bold tracking-wide uppercase text-faint mt-3 first:mt-0 mb-1.5">${label}</p>`);
    html.push('<div class="flex flex-wrap gap-1.5">' + here.map(m => instChipBtn(kind, m, st.inst.includes(m.toLowerCase()))).join('') + '</div>');
  }
  const leftovers = [...seen.values()].filter(t => !grouped.has(t.toLowerCase()) && !ensLower.includes(t.toLowerCase())).sort((a,b) => a.localeCompare(b));
  if (leftovers.length) {
    html.push('<p class="text-xs font-bold tracking-wide uppercase text-faint mt-3 mb-1.5">Other</p>');
    html.push('<div class="flex flex-wrap gap-1.5">' + leftovers.map(m => instChipBtn(kind, m, st.inst.includes(m.toLowerCase()))).join('') + '</div>');
  }
  html.push(`<div class="mt-3 pt-2 border-t border-line/70 flex items-center justify-between"><span class="text-xs text-faint">Pick up to 3 &middot; scores must include all picks</span><button onclick="clearInst('${kind}')" class="ui-btn text-xs font-semibold text-mute hover:text-danger">Clear</button></div>`);
  $(kind + '-inst-menu').innerHTML = html.join('');
  $(kind + '-inst-btn').innerHTML = 'Instruments' + (st.inst.length ? ' (' + st.inst.length + ')' : '') + ' &#9662;';
}

function instChipBtn(kind, name, on) {
  return `<button onclick="toggleInst('${kind}','${attr(name.toLowerCase())}')" class="ui-btn text-xs font-medium rounded-full border px-2.5 py-1 ${on ? 'border-accent text-accent bg-accent/10' : 'border-line text-mute hover:border-accent hover:text-accent'}">${esc(name)}</button>`;
}

function renderInstChips(kind, seen) {
  seen = seen || presentTags(kind);
  const st = instState(kind);
  $(kind + '-inst-chips').innerHTML = st.inst.map(t =>
    `<span class="inline-flex items-center gap-1.5 text-xs font-medium rounded-full border border-accent text-accent bg-accent/10 px-2.5 py-1">${esc(seen.get(t) || t)} <button onclick="toggleInst('${kind}','${attr(t)}')" aria-label="Remove ${attr(seen.get(t) || t)} filter" class="ui-btn font-bold">&times;</button></span>`).join('');
}

function toggleInstMenu(kind) {
  const m = $(kind + '-inst-menu');
  const open = m.classList.toggle('hidden');
  $(kind + '-inst-btn').setAttribute('aria-expanded', String(!open));
}

function closeInstMenus() {
  ['catalog','vault'].forEach(k => {
    const m = $(k + '-inst-menu');
    if (m) m.classList.add('hidden');
    const b = $(k + '-inst-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

document.addEventListener('click', e => {
  if (!e.target.closest('.inst-wrap')) closeInstMenus();
});

function toggleInst(kind, tag) {
  const st = instState(kind);
  if (st.inst.includes(tag)) st.inst = st.inst.filter(t => t !== tag);
  else if (st.inst.length >= 3) { toast('Pick up to 3 instruments.', false); return; }
  else st.inst = [...st.inst, tag];
  renderScores(kind);
}

function clearInst(kind) {
  instState(kind).inst = [];
  renderScores(kind);
}

function setEnsFilter(kind, val) {
  instState(kind).ens = val;
  renderScores(kind);
}

function toggleDesc(btn) {
  const p = btn.previousElementSibling;
  const open = p.classList.toggle('desc-open');
  btn.textContent = open ? 'Show less' : 'Show more';
  btn.setAttribute('aria-expanded', String(open));
}

function clampDescs() {
  document.querySelectorAll('.desc-clamp').forEach(p => {
    const btn = p.nextElementSibling;
    if (!btn || !btn.classList.contains('desc-toggle')) return;
    if (p.classList.contains('desc-open')) { btn.classList.remove('hidden'); return; }
    btn.classList.toggle('hidden', p.scrollHeight <= p.clientHeight + 2);
  });
}

function renderDiffChips(kind) {
  const isVault = kind === 'vault';
  const current = isVault ? vaultDiff : catalogDiff;
  const el = $(isVault ? 'vault-diff-chips' : 'catalog-diff-chips');
  const allChip = `<button type="button" class="ui-btn chip text-xs sm:text-sm rounded-full border border-line px-3.5 py-1.5 text-mute hover:border-accent" aria-pressed="${current === ''}" onclick="setDiff('${kind}',-1)">All levels</button>`;
  el.innerHTML = allChip + DIFFS.map((d,i) =>
    `<button type="button" class="ui-btn chip text-xs sm:text-sm rounded-full border border-line px-3.5 py-1.5 text-mute hover:border-accent" aria-pressed="${current === d}" onclick="setDiff('${kind}',${i})">${esc(d)}</button>`).join('');
}

function setDiff(kind, i) {
  const val = i < 0 ? '' : DIFFS[i];
  if (kind === 'vault') vaultDiff = val; else catalogDiff = val;
  renderDiffChips(kind);
  if (kind === 'vault') renderVault(); else renderCatalog();
}

function setSearch(kind, val) {
  const q = String(val || '').trim().toLowerCase();
  if (kind === 'vault') vaultSearch = q; else catalogSearch = q;
  if (kind === 'vault') renderVault(); else renderCatalog();
}

function setLayout(kind, mode) {
  state.layout[kind] = mode;
  saveKey(LS.layout, state.layout);
  applyLayoutButtons();
  if (kind === 'vault') renderVault(); else renderCatalog();
}

function applyLayoutButtons() {
  document.querySelectorAll('[data-layout-btn]').forEach(b => {
    const [kind, mode] = b.dataset.layoutBtn.split('-');
    b.setAttribute('aria-pressed', String(state.layout[kind] === mode));
  });
}

function renderVault() { renderScores('vault'); }

function renderCatalog() { renderScores('catalog'); }

function renderTagPicker(kind) {
  const el = $(prefixOf(kind) + '-tag-picker');
  if (!el) return;
  el.innerHTML = TAGS.map((t,i) =>
    `<button type="button" class="ui-btn chip text-xs rounded-full border border-line px-3 py-1 text-mute hover:border-admin" aria-pressed="${pickerSel[kind].has(t)}" onclick="togglePicker('${kind}',${i})">${esc(t)}</button>`).join('')
    ;
}

function togglePicker(kind, i) {
  const t = TAGS[i];
  if (pickerSel[kind].has(t)) pickerSel[kind].delete(t);
  else pickerSel[kind].add(t);
  renderTagPicker(kind);
}

function readScoreForm(kind) {
  const p = prefixOf(kind);
  const title = $(p + '-title').value.trim();
  const video = kind === 'vault' ? '' : $('c-video').value.trim();
  if (video && !ytId(video)) { toast('That YouTube link could not be read. Paste a full video URL or its 11-character ID.', false); return null; }
  const previewImg = validPreviewPath($(p + '-preview').value);
  if (previewImg === null) { toast('Preview must be an image file inside your repository (e.g. previews/score.png). External links are blocked.', false); return null; }
  let driveLink = '';
  let musescoreLink = '';
  let audioFile = '';
  let pdfFile = '';
  const links = [];
  if (kind === 'vault') {
    const driveRaw = $('v-drive').value.trim();
    driveLink = safeUrl(driveRaw);
    if (driveRaw && !driveLink) { toast('The Google Drive link must be a normal web address (https://\u2026).', false); return null; }
    const msRaw = $('v-musescore').value.trim();
    musescoreLink = safeUrl(msRaw);
    if (msRaw && !musescoreLink) { toast('The MuseScore link must be a normal web address (https://\u2026).', false); return null; }
    audioFile = validAudioPath($('v-audio').value);
    if (audioFile === null) { toast('The audio must be a sound file inside your repository (e.g. audio/etude.mp3).', false); return null; }
    pdfFile = validPdfPath($('v-pdf').value);
    if (pdfFile === null) { toast('The PDF must be a .pdf file inside your repository (e.g. scores-pdfs/piece.pdf).', false); return null; }
  } else {
    for (let i = 1; i <= 3; i++) {
      const raw = $('c-link' + i + '-url').value.trim();
      if (!raw) continue;
      const url = safeUrl(raw);
      if (!url) { toast('Store link ' + i + ' must be a normal web URL (https://\u2026).', false); return null; }
      links.push({ label: $('c-link' + i + '-label').value.trim(), url });
    }
  }
  return {
    title,
    artist: $(p + '-artist').value.trim(),
    arrangement: $(p + '-arrangement').value.trim(),
    difficulty: $(p + '-difficulty').value,
    desc: $(p + '-desc').value.trim(),
    video,
    previewImg,
    tags: [...pickerSel[kind]],
    genres: [...pickerGen[kind]],
    driveLink,
    musescoreLink,
    audioFile,
    pdfFile,
    links
  };
}

function clearScoreForm(kind) {
  editorItems[kind] = null; editingVariant[kind] = null;
  $(kind + '-variant-editor').hidden = true;
  const p = prefixOf(kind);
  ['title','artist','arrangement','desc','preview'].forEach(f => { $(p + '-' + f).value = ''; });
  if (kind === 'catalog') $('c-video').value = '';
  $(p + '-difficulty').value = '';
  if (kind === 'vault') {
    $('v-drive').value = '';
    $('v-musescore').value = '';
    $('v-audio').value = '';
    $('v-pdf').value = '';
    $('v-preview-file').value = '';
  } else {
    for (let i = 1; i <= 3; i++) {
      $('c-link' + i + '-label').value = '';
      $('c-link' + i + '-url').value = '';
    }
  }
  pickerSel[kind] = new Set();
  pickerGen[kind] = new Set();
  renderTagPicker(kind);
  renderGenrePicker(kind);
}

function setFormMode(kind, mode) {
  const isEdit = mode === 'edit';
  $(kind + '-form-title').textContent = isEdit
    ? (kind === 'vault' ? 'Edit Vault Score' : 'Edit Published Arrangement')
    : (kind === 'vault' ? 'Add vault score' : 'Add published arrangement');
  $(kind + '-save-btn').textContent = isEdit ? 'Save changes' : (kind === 'vault' ? '+ Add score' : '+ Add arrangement');
  $(kind + '-cancel-btn').classList.toggle('hidden', !isEdit);
}

function cancelEdit(kind) {
  editing[kind] = null;
  clearScoreForm(kind);
  setFormMode(kind, 'add');
}

function deleteScore(kind, id) {
  confirmAction('Delete this score? This cannot be undone.', () => {
    if (currentAudio === 'score:' + kind + ':' + id) { stopAudio(); currentAudio = null; audioState = 'paused'; }
    if (kind === 'catalog' && state.featured === id) { state.featured = ''; saveKey(LS.featured, state.featured); }
    if (kind === 'vault') {
      state.vault = state.vault.filter(x => x.id !== id);
      saveKey(LS.vault, state.vault);
    } else {
      state.catalog = state.catalog.filter(x => x.id !== id);
      saveKey(LS.catalog, state.catalog);
    }
    if (editing[kind] === id) cancelEdit(kind);
    afterContentChange();
    renderVault();
    renderCatalog();
    renderFeatured();

    renderAdminScoreLists();

    renderDashboard();
    toast('Changes saved.');
  });
}

function moveScore(kind, id, dir) {
  const list = listOf(kind);
  const i = list.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  saveKey(lsOf(kind), list);
  afterContentChange();
  renderVault();
  renderCatalog();
  renderAdminScoreLists();
  toast('Changes saved.');
}

function renderAdminScoreLists() {
  if (state.access !== 'admin') return;
  const row = (item, kind) =>
    `<li class="flex items-center justify-between gap-3 bg-sunken border border-line rounded-xl px-3 py-2">
      <div class="min-w-0">
        <p class="truncate text-ink">${esc(item.title)}</p>
        <p class="truncate text-xs text-faint">${[item.artist, item.arrangement].filter(Boolean).map(esc).join(' &middot; ') || 'No creator info'} &middot; ${kind === 'vault' ? (item.audioFile ? 'Audio linked' : 'No audio') : (ytId(item.video) ? 'Video linked' : 'No video')}${(item.links||[]).length ? ' &middot; ' + (item.links||[]).length + ' store link' + ((item.links||[]).length === 1 ? '' : 's') : ''}${item.driveLink ? ' &middot; Drive' : ''}${item.musescoreLink ? ' &middot; MuseScore' : ''}${item.audioFile ? ' &middot; Audio' : ''}${item.pdfFile ? ' &middot; PDF' : ''}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${kind === 'vault' ? `<button onclick="transferToCatalog('${item.id}')" class="ui-btn text-xs font-bold rounded-lg bg-admin px-2.5 py-1 text-oninv hover:bg-admin-hi" title="Copy to Published">&rarr; Publish</button>` : ''}
        ${kind === 'catalog' ? `<button onclick="toggleFeatured('${item.id}')" class="ui-btn text-sm leading-none ${state.featured === item.id ? 'text-admin' : 'text-faint hover:text-admin'}" aria-label="${state.featured === item.id ? 'Unset featured' : 'Set as featured'}" title="Feature on home page">&#9733;</button>` : ''}
        <button onclick="moveScore('${kind}','${item.id}',-1)" class="ui-btn text-mute hover:text-ink text-sm leading-none" aria-label="Move up">&#9650;</button>
        <button onclick="moveScore('${kind}','${item.id}',1)" class="ui-btn text-mute hover:text-ink text-sm leading-none" aria-label="Move down">&#9660;</button>
        <button onclick="startEdit('${kind}','${item.id}')" class="ui-btn text-admin hover:text-admin-hi text-xs font-semibold">Edit</button>
        <button onclick="deleteScore('${kind}','${item.id}')" class="ui-btn text-danger hover:text-danger-hi text-xs font-semibold">Delete</button>
      </div>
    </li>`;
  $('admin-vault-list').innerHTML = state.vault.length ? state.vault.map(x => row(x,'vault')).join('') : '<li class="text-faint">No vault scores yet. Add a private score using the form.</li>';
  $('admin-catalog-list').innerHTML = state.catalog.length ? state.catalog.map(x => row(x,'catalog')).join('') : '<li class="text-faint">No published arrangements yet. Add an arrangement using the form.</li>';
}

function transferToCatalog(id) {
  const item = state.vault.find(x => x.id === id);
  if (!item) return;
  confirmAction('Publish a copy of this vault score? Drive and MuseScore links are removed; it opens in the Published form so you can add store links. The vault copy stays until you delete it.', () => {
    const copy = clone(item);
    copy.id = uid();
    copy.dateAdded = new Date().toISOString();
    copy.driveLink = '';
    copy.musescoreLink = '';
    copy.audioFile = '';
    copy.pdfFile = '';
    copy.links = [];
    state.catalog.push(copy);
    saveKey(LS.catalog, state.catalog);
    afterContentChange();
    renderVault();
    renderCatalog();
    renderFeatured();

    renderAdminScoreLists();

    renderDashboard();
    startEdit('catalog', copy.id);
    toast('Copied to Published - add the store links and save.');
  });
}

function toggleFeatured(id) {
  const on = state.featured !== id;
  confirmAction(on ? 'Feature this arrangement on the home page?' : 'Remove this arrangement from the featured spot?', () => {
    state.featured = on ? id : '';
    saveKey(LS.featured, state.featured);
    afterContentChange();
    renderFeatured();
    renderAdminScoreLists();
    renderDashboard();
    toast('Changes saved.');
  });
}

function renderFaq() {
  $('faq-section').classList.toggle('hidden', !state.faq.length);
  $('faq-list').innerHTML = state.faq.map(f =>
    `<details class="bg-surface border border-line rounded-xl px-5 py-4">
      <summary class="cursor-pointer font-semibold text-ink list-none flex items-center justify-between gap-3">${esc(f.q)}<span class="faq-arrow text-faint" aria-hidden="true">&#9662;</span></summary>
      <div class="faq-body"><div class="faq-inner"><p class="text-sm text-mute pt-3">${esc(f.a)}</p></div></div>
    </details>`).join('');
}

function saveFaq() {
  const q = $('faq-q').value.trim();
  const a = $('faq-a').value.trim();

  const isEdit = Boolean(faqEditing);
  confirmAction(isEdit ? 'Save changes to this FAQ?' : 'Add this FAQ?', () => {
    if (faqEditing) {
      const f = state.faq.find(x => x.id === faqEditing);
      if (f) { f.q = q; f.a = a; }
    } else {
      state.faq.push({ id: uid(), q, a });
    }
    cancelFaqEdit();
    saveKey(LS.faq, state.faq);
    afterContentChange();
    renderFaq();
    renderAdminFaqList();
    renderDashboard();
    toast('Changes saved.');
  });
}

function startFaqEdit(id) {
  const f = state.faq.find(x => x.id === id);
  if (!f) return;
  faqEditing = id;
  $('faq-q').value = f.q;
  $('faq-a').value = f.a;
  $('faq-save-btn').textContent = 'Save changes';
  $('faq-cancel-btn').classList.remove('hidden');
}

function cancelFaqEdit() {
  faqEditing = null;
  $('faq-q').value = '';
  $('faq-a').value = '';
  $('faq-save-btn').textContent = '+ Add FAQ';
  $('faq-cancel-btn').classList.add('hidden');
}

function deleteFaq(id) {
  confirmAction('Delete this FAQ?', () => {
    if (faqEditing === id) cancelFaqEdit();
    state.faq = state.faq.filter(x => x.id !== id);
    saveKey(LS.faq, state.faq);
    afterContentChange();
    renderFaq();
    renderAdminFaqList();
    renderDashboard();
    toast('Changes saved.');
  });
}

function renderAdminFaqList() {
  if (state.access !== 'admin') return;
  $('admin-faq-list').innerHTML = state.faq.length ? state.faq.map(f =>
    `<li class="flex items-center justify-between gap-3 bg-sunken border border-line rounded-xl px-3 py-2">
      <span class="truncate text-mute">${esc(f.q)}</span>
      <div class="flex gap-2 shrink-0">
        <button onclick="startFaqEdit('${f.id}')" class="ui-btn text-admin hover:text-admin-hi text-xs font-semibold">Edit</button>
        <button onclick="deleteFaq('${f.id}')" class="ui-btn text-danger hover:text-danger-hi text-xs font-semibold">Delete</button>
      </div>
    </li>`).join('') : '<li class="text-faint">No FAQ entries yet.</li>';
}

function adminAddGenre() {
  const val = $('genre-input').value.trim();
  if (!val) return;
  if (state.genres.some(g => g.toLowerCase() === val.toLowerCase())) { toast('That genre already exists.', false); return; }
  state.genres.push(val);
  $('genre-input').value = '';
  saveKey(LS.genres, state.genres);
  afterContentChange();
  refreshGenreDependents();
  toast('Changes saved.');
}

function adminRemoveGenre(i) {
  const g = state.genres[i];
  confirmAction(`Remove the "${g}" genre? Scores keep it, but it disappears from the pickers and suggestion form.`, () => {
    state.genres.splice(i, 1);
    saveKey(LS.genres, state.genres);
    afterContentChange();
    pickerGen.vault.delete(g);
    pickerGen.catalog.delete(g);
    refreshGenreDependents();
    toast('Changes saved.');
  });
}

function renderAdminGenreList() {
  if (state.access !== 'admin') return;
  $('admin-genre-list').innerHTML = state.genres.length ? state.genres.map((g,i) =>
    `<span class="inline-flex items-center gap-1.5 text-xs rounded-full bg-sunken border border-line px-3 py-1.5 text-mute">${esc(genreLabel(g))} <button onclick="adminRemoveGenre(${i})" class="ui-btn text-danger hover:text-danger-hi font-bold" aria-label="Remove genre ${attr(g)}">&times;</button></span>`).join('')
    : '<span class="text-faint text-sm">No genres yet. Add one above.</span>';
}

function refreshGenreDependents() {

  renderAdminGenreList();
  renderAdminCounts();
  renderGenrePicker('vault');
  renderGenrePicker('catalog');
}

function renderGenrePicker(kind) {
  const el = $(prefixOf(kind) + '-genre-picker');
  if (!el) return;
  el.innerHTML = state.genres.length ? state.genres.map((g,i) =>
    `<button type="button" class="ui-btn chip text-xs rounded-full border border-line px-3 py-1 text-mute hover:border-admin" aria-pressed="${pickerGen[kind].has(g)}" onclick="toggleGenrePick('${kind}',${i})">${esc(genreLabel(g))}</button>`).join('')
    : '<span class="text-faint text-xs">Add genres in the Genres tab first.</span>';
}

function toggleGenrePick(kind, i) {
  const g = state.genres[i];
  if (pickerGen[kind].has(g)) pickerGen[kind].delete(g);
  else pickerGen[kind].add(g);
  renderGenrePicker(kind);
}

function renderDraftStatus() {
  const el = $('draft-status');
  if (!el) return;
  if (fbUser) {
    el.textContent = 'Live publishing is on. Saved changes are sent to the live site.';
    el.className = 'text-xs mb-5 text-accent';
    return;
  }
  if (isDraft()) {
    el.textContent = PUBLISHED
      ? 'Local draft active - you are previewing unpublished changes. Visitors see the published data.json.'
      : 'Local draft active - visitors currently see the built-in defaults until you publish a data.json.';
    el.className = 'text-xs mb-5 text-admin';
  } else {
    el.textContent = PUBLISHED
      ? 'No local draft - you are viewing the published data.json, same as every visitor.'
      : 'No local draft - you are viewing the built-in defaults, same as every visitor.';
    el.className = 'text-xs mb-5 text-faint';
  }
}

function discardDraft() {
  if (!isDraft()) { toast('There is no local draft to discard.', false); return; }
  confirmAction('Discard your local draft? Unexported changes are lost and this browser goes back to the published content.', () => {
    [LS.catalog, LS.vault, LS.social, LS.genres, LS.texts, LS.featured, LS.faq, LS.siteStatus].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    location.reload();
  }, true);
}

function dataFeedback(msg, ok = true) {
  const el = $('data-feedback');
  el.textContent = msg;
  el.className = 'text-sm min-h-[1.25rem] ' + (ok ? 'text-accent' : 'text-danger');
}

function exportData() {
  const payload = {
    ...contentPayload(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sheet-music-portfolio-backup.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  markSeen('exported');
  renderDashboard();
  dataFeedback('Backup exported.');
}

function importData(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  const reader = new FileReader();
  reader.onerror = () => dataFeedback('The file could not be read. Select it again.', false);
  reader.onload = () => {
    let d;
    try { d = JSON.parse(reader.result); }
    catch { dataFeedback('The file is not valid JSON. Select a valid backup file.', false); return; }
    if (!validPublished(d)) {
      dataFeedback('The file is not a portfolio backup. Select an exported backup file.', false);
      return;
    }
    confirmAction('Import this backup? It replaces all current scores and links, and text edits.', async () => {
      if (fbUser) {
        dataFeedback('Publishing backup…');
        if (!await publishContent(d)) { dataFeedback('The backup could not be published. Check your connection and import it again.', false); return; }
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        dataFeedback('Backup imported and published live.');
        setTimeout(() => location.reload(), 800);
        return;
      }
      saveKey(LS.catalog, d.catalog);
      saveKey(LS.vault, d.vault);
      saveKey(LS.social, (d.social && typeof d.social === 'object') ? d.social : {});
      saveKey(LS.genres, Array.isArray(d.genres) ? d.genres : DEFAULT_GENRES);
      saveKey(LS.siteStatus, d.siteStatus && typeof d.siteStatus === 'object' ? d.siteStatus : DEFAULTS.siteStatus);
      saveKey(LS.texts, (d.texts && typeof d.texts === 'object') ? d.texts : {});
      saveKey(LS.featured, typeof d.featured === 'string' ? d.featured : '');
      saveKey(LS.faq, Array.isArray(d.faq) ? d.faq : []);
      try { localStorage.setItem(DRAFT_KEY, '1'); } catch {}
      location.reload();
    }, true);
  };
  reader.readAsText(f);
}

function resetAllData() {
  confirmAction('Reset the whole site to its default content? All scores and tags, links, and text edits will be erased.', () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    [LS.catalog, LS.vault, LS.social, LS.genres, LS.texts, LS.layout, LS.featured, LS.faq, LS.seen, LS.settings, LS.siteStatus].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
    location.reload();
  }, true);
}

function setAdminTab(tab) {
  $('admin-section-select').value = tab;
  document.querySelectorAll('#admin-tabs .tab-btn').forEach(b => b.tabIndex = b.dataset.tab === tab ? 0 : -1);
  document.querySelectorAll('#admin-tabs .tab-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelectorAll('[data-tabpanel]').forEach(p => p.classList.toggle('hidden', p.dataset.tabpanel !== tab));
}

function jsSha256(str) {
  const utf8 = unescape(encodeURIComponent(str));
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const len = utf8.length;
  const words = [];
  for (let i = 0; i < len; i++) words[i >> 2] = (words[i >> 2] || 0) | (utf8.charCodeAt(i) << (24 - (i % 4) * 8));
  words[len >> 2] = (words[len >> 2] || 0) | (0x80 << (24 - (len % 4) * 8));
  const bits = len * 8;
  const total = (((len + 8) >> 6) + 1) * 16;
  words[total - 1] = bits >>> 0;
  words[total - 2] = Math.floor(bits / 0x100000000);
  const rotr = (x, k) => (x >>> k) | (x << (32 - k));
  const w = new Array(64);
  for (let j = 0; j < total; j += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[j + t] | 0;
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t-15],7) ^ rotr(w[t-15],18) ^ (w[t-15] >>> 3);
      const s1 = rotr(w[t-2],17) ^ rotr(w[t-2],19) ^ (w[t-2] >>> 10);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh=g; g=f; f=e; e=(d + t1)|0; d=c; c=b; b=a; a=(t1 + t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+hh)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

async function sha256Hex(text) {
  if (window.crypto && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
    } catch {}
  }
  return jsSha256(text);
}

function pcThrottle() {
  try { return JSON.parse(sessionStorage.getItem('smp_pcTries') || '{"n":0,"until":0}'); } catch { return { n:0, until:0 }; }
}

function pcSave(t) {
  try { sessionStorage.setItem('smp_pcTries', JSON.stringify(t)); } catch {}
}

async function unlockAccess() {
  const input = $('passcode-input');
  const code = input.value.trim();
  const fb = $('passcode-feedback');
  const setFb = (msg, cls) => { fb.textContent = msg; fb.className = 'text-sm mt-3 min-h-[1.25rem] relative ' + cls; };
  const t = pcThrottle();
  if (Date.now() < t.until) { setFb('Too many attempts. Try again in ' + Math.ceil((t.until - Date.now()) / 1000) + 's.', 'text-danger'); return; }
  if (!code) { setFb('Enter a passcode first.', 'text-danger'); return; }
  const hash = await sha256Hex(code);
  if (hash === HASH_ADMIN) {
    if (FB_READY) {
      input.value = '';
      setFb('Enter your admin email and password to continue.', 'text-mute');
      showView('admin');
      $('al-email').focus();
      return;
    }
    state.access = 'admin';
    persistAdmin(true);
    setFb('Unlocked.', 'text-accent');
  } else if (hash === HASH_FRIENDS) {
    state.access = 'friends';
    persistAdmin(false);
    persistFriend(true);
    setFb('Friends access is active and will stay saved in this browser.', 'text-accent');
  } else {
    t.n += 1;
    if (t.n >= 5) { t.until = Date.now() + 30000; t.n = 0; }
    pcSave(t);
    setFb(t.until > Date.now() ? 'Too many attempts. Locked for 30s.' : 'Incorrect passcode. Try again.', 'text-danger');
    return;
  }
  pcSave({ n:0, until:0 });
  input.value = '';
  applyAccess();
  showView(state.access === 'admin' ? 'admin' : 'access');
}

async function signOutAdmin() {
  if (!fbUser || !fbAuth || !fbAuthTools) return true;
  try { await fbAuthTools.signOut(fbAuth); fbUser = null; return true; }
  catch { toast('Sign-out failed. Check your connection and try again.', false); return false; }
}

async function logoutAll() {
  if (!await signOutAdmin()) return;
  persistAdmin(false);
  persistFriend(false);
  state.access = 'none';
  cancelEdit('vault');
  cancelEdit('catalog');

  cancelFaqEdit();
  $('admin-login').classList.add('hidden');
  const fb = $('passcode-feedback');
  fb.textContent = 'Logged out.';
  fb.className = 'text-sm mt-3 min-h-[1.25rem] relative text-mute';
  applyAccess();
  showView('access');
  toast('Logged out.');
}

async function logoutAdmin() {
  if (!await signOutAdmin()) return;
  persistAdmin(false);
  state.access = friendPersisted() ? 'friends' : 'none';
  cancelEdit('vault');
  cancelEdit('catalog');

  cancelFaqEdit();
  applyAccess();
  showView('access');
  toast(state.access === 'friends' ? 'Logged out of admin - friend access kept.' : 'Logged out.');
}

function applyAccess() {
  const isFriends = state.access === 'friends' || state.access === 'admin';
  const isAdmin = state.access === 'admin';
  $('friends-vault').classList.toggle('hidden', !isFriends);
  $('admin-center').classList.toggle('hidden', !isAdmin);
  $('admin-login').classList.toggle('hidden', isAdmin);
  $('friends-entry').classList.toggle('hidden', isFriends);
  document.querySelectorAll('[data-admin-nav]').forEach(a => a.classList.toggle('hidden', !isAdmin));
  if (!isFriends && $('score-modal').open) $('score-modal').close();
  $('logout-btn').classList.toggle('hidden', !isFriends);
  $('nav-friends-dot').classList.toggle('hidden', !isFriends);
  $('nav-friends-dot-m').classList.toggle('hidden', !isFriends);
  const badge = $('portal-status-badge');
  if (isFriends) {
    badge.classList.remove('hidden');
    badge.textContent = 'FRIENDS ACCESS';
    badge.className = 'text-xs font-bold tracking-wider px-3 py-1.5 rounded-full border border-accent/60 bg-accent/10 text-accent';
  } else {
    badge.classList.add('hidden');
  }
  renderVault();
  renderCatalog();
  renderFeatured();
  renderEditButtons();
  if (isAdmin) {
    renderAdminScoreLists();

    renderAdminGenreList();

    renderAdminTextList();
    renderAdminFaqList();
    renderDashboard();
    renderTagPicker('vault');
    renderTagPicker('catalog');
    renderGenrePicker('vault');
    renderGenrePicker('catalog');
  }
}

$('admin-tabs').addEventListener('keydown', e => {
  const keys = ['ArrowDown','ArrowUp','Home','End'];
  if (!keys.includes(e.key)) return;
  const buttons = [...$('admin-tabs').querySelectorAll('[role="tab"]')];
  const i = buttons.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length-1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
  setAdminTab(buttons[next].dataset.tab); buttons[next].focus();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['catalog','vault'].forEach(kind => { if (!$(kind+'-inst-menu').classList.contains('hidden')) { toggleInstMenu(kind); $(kind+'-inst-btn').focus(); } });
  }
  if (e.key === 'Escape' && !$('mobile-menu').hidden) { toggleMobileMenu(); $('mobile-menu-btn').focus(); }
});

$('score-modal').addEventListener('close', () => { pauseAudioEls(null); stopAudio(); $('score-modal-body').innerHTML = ''; });

$('faq-list').addEventListener('click', e => {
  const sum = e.target.closest('summary');
  if (!sum || !$('faq-list').contains(sum)) return;
  e.preventDefault();
  const d = sum.parentElement;
  if (d.classList.contains('expanded')) {
    d.classList.remove('expanded');
    if (motionReduced()) { d.open = false; return; }
    const body = d.querySelector('.faq-body');
    const onEnd = ev => {
      if (ev.propertyName !== 'grid-template-rows') return;
      body.removeEventListener('transitionend', onEnd);
      if (!d.classList.contains('expanded')) d.open = false;
    };
    body.addEventListener('transitionend', onEnd);
  } else {
    d.open = true;
    if (motionReduced()) { d.classList.add('expanded'); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('expanded')));
  }
});

$('passcode-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); unlockAccess(); } });

$('genre-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adminAddGenre(); } });

$('edit-modal').addEventListener('close', () => { editModalKey = null; });

$('confirm-modal').addEventListener('close', () => { confirmCb = null; });

window.addEventListener('scroll', () => { $('back-to-top').classList.toggle('show', window.scrollY > 400); }, { passive: true });

['edit-modal','confirm-modal','score-modal','settings-modal'].forEach(id => {
  $(id).addEventListener('click', e => { if (e.target === $(id)) $(id).close(); });
});

document.addEventListener('play', e => {
  if (e.target && e.target.tagName === 'AUDIO') {
    stopAudio();
    pauseAudioEls(e.target);
  }
}, true);

$('score-modal').addEventListener('close', () => {
  if (location.hash.startsWith('#/s/')) setHash(ROUTES[currentView]);
});

async function fetchPublished() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch('data.json', { cache: 'no-store', signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const d = await res.json();
    return validPublished(d);
  } catch { return null; }
}

const editorItems = {catalog:null,vault:null};
const editingVariant = {catalog:null,vault:null};
const chosenVariants = new Map();
let publishChain = Promise.resolve(true);

function validScoreRecord(item) {
  if (!validContentRecord(item)) return false;
  const valid = value => isRecord(value) && ['tags','genres'].every(k => value[k] === undefined || (Array.isArray(value[k]) && value[k].every(v => typeof v === 'string'))) && ['artist','arrangement','difficulty','dateAdded','previewImg','driveLink','musescoreLink','audioFile','pdfFile','desc','video','sourceKey','sourceFolder','label'].every(k => value[k] === undefined || typeof value[k] === 'string') && (value.links === undefined || (Array.isArray(value.links) && value.links.every(l => isRecord(l) && typeof l.url === 'string' && (l.label === undefined || typeof l.label === 'string'))));
  return valid(item) && (item.variants === undefined || (Array.isArray(item.variants) && item.variants.every(v => isRecord(v) && typeof v.id === 'string' && /^[\w-]+$/.test(v.id) && valid(v))));
}
function validPublished(data) {
  return data && data.format === 'sheet-music-portfolio-backup' && Array.isArray(data.catalog) && Array.isArray(data.vault) && data.catalog.every(validScoreRecord) && data.vault.every(validScoreRecord) && [data.catalog,data.vault].every(list => new Set(list.map(x=>x.id)).size===list.length) ? data : null;
}
function contentPayload() {
  return {format:'sheet-music-portfolio-backup',version:4,catalog:state.catalog,vault:state.vault,social:state.social,texts:state.texts,featured:state.featured,faq:state.faq,genres:state.genres,siteStatus:state.siteStatus};
}
function afterContentChange() {
  if (fbUser) {
    const payload = clone(contentPayload());
    publishChain = publishChain.then(()=>publishContent(payload),()=>publishContent(payload)).then(ok=>{if(!ok)markDraft();return ok;});
    return publishChain;
  }
  markDraft(); return Promise.resolve(true);
}
async function publishContent(payload) {
  if(!fbUser||!fbdb||!fbTools)return false;
  const snapshot=clone(payload||contentPayload());
  try{
    await fbTools.setDoc(fbTools.doc(fbdb,'site','content'),snapshot);
    PUBLISHED=snapshot;fbContent=snapshot;
    if(JSON.stringify(snapshot)===JSON.stringify(contentPayload()))try{localStorage.removeItem(DRAFT_KEY);}catch{}
    renderDraftStatus();return true;
  }catch{toast('Publishing failed. Your changes are saved on this device for retry.',false);return false;}
}
function playScoreAudio(kind,id) {
  const original=listOf(kind).find(item=>item.id===id),item=original?displayScore(original,kind):null;
  toggleAudioKey('score:'+kind+':'+id,item?ytId(item.video):null,item?item.title:'');
}
async function initFirebase() {
  if (!FB_READY) return;
  try {
    const [app,fs,auth] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js')
    ]);
    const firebase = app.initializeApp(FIREBASE_CONFIG);
    fbdb=fs.getFirestore(firebase); fbTools=fs; fbAuth=auth.getAuth(firebase); fbAuthTools=auth;
    auth.onAuthStateChanged(fbAuth,user=>{
      fbUser=user;
      if (!stateLoaded) return;
      state.access=user?'admin':friendPersisted()?'friends':'none';
      applyAccess(); applySiteStatus(); renderDraftStatus();
    });
    try { const snapshot=await fs.getDoc(fs.doc(fbdb,'site','content')); if (snapshot.exists()) fbContent=validPublished(snapshot.data()); } catch(error) { console.warn('Site content could not be loaded:',error); }
    fs.onSnapshot(fs.collection(fbdb,'views'),snapshot=>{ viewCounts={}; snapshot.forEach(doc=>{viewCounts[doc.id]=Number(doc.data()?.count)||0;}); fbActive=true; },()=>{});
  } catch(error) { console.warn('Firebase unavailable:',error); }
}
function applySiteStatus() {
  const down=sitedownActive(), status=state.siteStatus || DEFAULTS.siteStatus;
  const was=document.documentElement.classList.contains('sitedown');
  document.documentElement.classList.toggle('sitedown',down);
  $('downtime-home').classList.toggle('hidden',!down);
  if (down) {
    if (!was && currentAudio) audioBarClose();
    $('dt-eta').textContent=status.etaMin?`${Math.floor(status.etaMin/60)}h ${status.etaMin%60}m`:'unknown';
    const tick=()=>{$('dt-timer').textContent=fmtDur(Date.now()-(status.downSince||Date.now()));};
    tick(); if (!dtTimer) dtTimer=setInterval(tick,1000);
    if (!['home','admin'].includes(currentView)) showView('home');
  } else if (dtTimer) { clearInterval(dtTimer);dtTimer=null; }
}
function refreshLibraries() {
  renderVault(); renderCatalog(); renderFeatured(); renderAdminScoreLists(); renderDashboard();
}
function variantLabel(variant) { return variant.label || variant.arrangement || 'Arrangement'; }
function displayScore(item,kind) {
  const variants=ScoreModel.variants(item);
  const wanted=chosenVariants.get(kind+':'+item.id);
  return ScoreModel.merged(item,variants.find(v=>v.id===wanted)||variants[0]);
}
function variantSelect(item,kind,selected) {
  const variants=ScoreModel.variants(item);
  if (variants.length<2) return '';
  return `<label class="score-variant-picker"><span class="field-label">Arrangement</span><select class="ui-field" data-score-variant="${attr(item.id)}" data-kind="${kind}" aria-label="Arrangement for ${attr(item.title || 'Untitled score')}" onchange="selectScoreVariant('${kind}','${item.id}',this.value)">${variants.map(v=>`<option value="${attr(v.id)}" ${v.id===selected?'selected':''}>${esc(variantLabel(v))}</option>`).join('')}</select></label>`;
}
function selectScoreVariant(kind,id,variantId) {
  const item=listOf(kind).find(x=>x.id===id);
  if (!item || !ScoreModel.variants(item).some(v=>v.id===variantId)) return;
  chosenVariants.set(kind+':'+id,variantId); pauseAudioEls(null);stopAudio();
  const inModal=$('score-modal').open;
  if (inModal) openScore(kind,id,false);
  else {renderScores(kind); if (kind==='catalog') renderFeatured();}
  const host=inModal?$('score-modal-body'):$(kind==='vault'?'vault-grid':'catalog-grid');
  host.querySelector(`[data-score-variant="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
}
function scoreCover(item,eager=false) {
  const title=item.title || 'Untitled score';
  return `<div class="score-cover ${item.previewImg?'has-sheet':''}">${item.previewImg?`<img src="${attr(item.previewImg)}" alt="First page of ${attr(title)}" width="${Number(item.coverWidth)||850}" height="${Number(item.coverHeight)||1100}" loading="${eager?'eager':'lazy'}" ${eager?'fetchpriority="high"':''} />`:`<div class="cover-paper"><strong>${esc(title)}</strong><span class="cover-artist">${esc(item.artist||'')}</span><span class="cover-ensemble">${esc(item.arrangement||'')}</span></div>`}</div>`;
}
function scoreCard(original,kind) {
  const item=displayScore(original,kind),title=item.title||'Untitled score';
  const tags=(item.tags||[]).slice(0,5).map(t=>`<span>${esc(t)}</span>`).join('');
  return `<article class="score-card card-hover"><button class="ui-btn score-cover-button" onclick="openScore('${kind}','${item.id}')" aria-label="View score: ${attr(title)}">${scoreCover(item)}</button><div class="score-body"><div><h2><button class="ui-btn score-title-button" onclick="openScore('${kind}','${item.id}')">${esc(title)}</button></h2>${metaLine(item)?`<p class="score-meta">${metaLine(item)}</p>`:''}</div>${variantSelect(original,kind,item.variantId)}<div class="score-badges">${badgeRow(item)}</div>${item.desc?`<p class="score-desc desc-clamp">${esc(item.desc)}</p>`:''}<div class="score-tags">${tags}</div>${scorePreview(item,kind)}<div class="score-actions">${scoreLinkButtons(item)}${adminItemButtons(kind,item.id)}</div></div></article>`;
}
function scoreRow(original,kind) {
  const item=displayScore(original,kind),title=item.title||'Untitled score';
  return `<article class="score-row"><button class="ui-btn score-cover-button" onclick="openScore('${kind}','${item.id}')" aria-label="View score: ${attr(title)}">${scoreCover(item)}</button><div><h2><button class="ui-btn score-title-button" onclick="openScore('${kind}','${item.id}')">${esc(title)}</button></h2><p class="score-meta">${metaLine(item)}</p>${variantSelect(original,kind,item.variantId)}<div class="score-badges">${badgeRow(item)}</div></div><div class="score-actions">${scorePreview(item,kind)}${scoreLinkButtons(item)}${adminItemButtons(kind,item.id)}</div></article>`;
}
function openScore(kind,id,updateHash=true) {
  if (sitedownActive()) {showView('home');return;}
  if (kind==='vault'&&state.access==='none') {showView('access');return;}
  const original=listOf(kind).find(x=>x.id===id);if (!original) return;
  const item=displayScore(original,kind),title=item.title||'Untitled score';
  if (updateHash) setHash('#/s/'+id);
  const chips=[...(item.tags||[]),...(item.genres||[])].map(t=>`<span>${esc(t)}</span>`).join('');
  $('score-modal-body').innerHTML=`<div class="score-detail-header"><span>Score details</span><button class="ui-btn icon-button" onclick="$('score-modal').close()" aria-label="Close score details">${uiIcon('close')}</button></div><div class="score-detail-layout">${scoreCover(item)}<div class="score-detail-content"><h2 id="score-detail-title">${esc(title)}</h2><p class="score-meta">${metaLine(item)}</p>${variantSelect(original,kind,item.variantId)}<div class="score-badges">${badgeRow(item)}</div>${item.desc?`<p>${esc(item.desc)}</p>`:''}<div class="score-tags">${chips}</div>${scorePreview(item,kind)}<div class="score-actions">${scoreLinkButtons(item,'lg')}${adminItemButtons(kind,id)}</div><button class="ui-btn border border-line px-3" onclick="copyScoreLink('${id}')">Copy score link</button>${fbActive?`<p class="text-sm text-faint">${viewCounts[id]??0} views</p>`:''}${ytId(item.video)&&kind!=='vault'?`<details class="video-details"><summary>Watch score video</summary>${embedBlock(item,kind)}</details>`:''}</div></div>`;
  $('score-modal').setAttribute('aria-labelledby','score-detail-title');
  if (!$('score-modal').open) $('score-modal').showModal();
  recordView(id);
}
function openScoreById(id) {
  if (sitedownActive()) {showView('home');return;}
  for (const kind of ['catalog','vault']) {
    const item=listOf(kind).find(x=>x.id===id || (x.legacyIds||[]).includes(id) || x.variants?.some(v=>v.legacyId===id));
    if (!item) continue;
    if (kind==='vault'&&state.access==='none') {renderView('access');toast('Unlock Friends to view this score.',false);return;}
    const variant=item.variants?.find(v=>v.legacyId===id);
    if (variant) chosenVariants.set(kind+':'+item.id,variant.id);
    renderView(kind==='catalog'?'scores':'access');openScore(kind,item.id,false);return;
  }
  renderView('home');
}
function renderFeatured() {
  const original=state.catalog.find(x=>x.id===state.featured)||state.catalog[0];
  $('featured-section').classList.toggle('hidden',!original);
  if (!original) {$('featured-card').innerHTML='';return;}
  const item=displayScore(original,'catalog');
  $('featured-card').innerHTML=`<div><button class="ui-btn score-cover-button" onclick="openScore('catalog','${item.id}')" aria-label="View featured score">${scoreCover(item,true)}</button><div><h1>${esc(item.title||'Untitled score')}</h1><p class="score-meta">${metaLine(item)}</p>${variantSelect(original,'catalog',item.variantId)}${scorePreview(item,'catalog')}<div class="score-actions">${scoreLinkButtons(item,'lg')}<button class="ui-btn border border-line px-4" onclick="openScore('catalog','${item.id}')">View score</button></div></div></div>`;
}
function presentTags(kind) {
  const seen=new Map();
  listOf(kind).forEach(item=>ScoreModel.variants(item).forEach(variant=>(variant.tags||[]).forEach(tag=>{if (tag) seen.set(tag.toLowerCase(),tag);})));return seen;
}
function matchesQuery(item,query) {
  if (!query) return true;
  const text=ScoreModel.key([item.title,...ScoreModel.variants(item).flatMap(v=>[v.artist,v.label,v.arrangement,...(v.tags||[]),...(v.genres||[])])].join(' '));
  return ScoreModel.key(query).split(' ').every(word=>text.includes(word));
}
function renderScores(kind) {
  const vault=kind==='vault',element=$(vault?'vault-grid':'catalog-grid');
  if (vault&&state.access==='none') {element.innerHTML='';return;}
  renderTagFilter(kind);
  const source=listOf(kind),filter=instState(kind),query=vault?vaultSearch:catalogSearch,difficulty=vault?vaultDiff:catalogDiff;
  const genres=[...new Set(source.flatMap(item=>ScoreModel.variants(item).flatMap(v=>v.genres||[])))].sort();
  $(kind+'-genre-select').innerHTML='<option value="">All genres</option>'+genres.map(g=>`<option value="${attr(g)}">${esc(g)}</option>`).join('');$(kind+'-genre-select').value=scoreGenres[kind];
  const items=source.filter(item=>{
    const variants=ScoreModel.variants(item).filter(v=>(!filter.ens||(v.tags||[]).some(t=>t.toLowerCase()===filter.ens))&&filter.inst.every(t=>(v.tags||[]).some(tag=>tag.toLowerCase()===t))&&(!difficulty||v.difficulty===difficulty)&&(!scoreGenres[kind]||(v.genres||[]).includes(scoreGenres[kind])));
    if (!variants.length||!matchesQuery(item,query)) return false;
    const active=displayScore(item,kind).variantId;
    if (!variants.some(v=>v.id===active)) chosenVariants.set(kind+':'+item.id,variants[0].id);
    return true;
  });
  $(kind+'-results').textContent=`${items.length} of ${source.length} score${source.length===1?'':'s'}`;
  const mode=state.layout[kind];element.className=mode==='list'?'score-list':'score-grid';
  element.innerHTML=items.length?items.map(item=>mode==='list'?scoreRow(item,kind):scoreCard(item,kind)).join(''):`<p class="empty-state">${source.length?'No scores match your filters.':'No scores are available yet.'}</p>`;
  clampDescs();if (vault) $('vault-count-line').textContent=`${source.length} score${source.length===1?'':'s'} available.`;
}
function loadEditorFields(kind) {
  const editor=editorItems[kind],p=prefixOf(kind);if (!editor) return;
  const variant=editor.variants.find(v=>v.id===editingVariant[kind])||editor.variants[0];editingVariant[kind]=variant.id;
  const item=ScoreModel.merged(editor,variant);
  $(p+'-title').value=editor.title||'';
  for (const name of ['artist','arrangement','difficulty','desc']) $(p+'-'+name).value=item[name]||'';
  $(p+'-preview').value=item.previewImg||'';
  if (kind==='vault') { for (const [input,key] of [['drive','driveLink'],['musescore','musescoreLink'],['audio','audioFile'],['pdf','pdfFile']]) $('v-'+input).value=item[key]||''; }
  else { $('c-video').value=item.video||''; for(let i=1;i<=3;i++){const link=item.links?.[i-1];$('c-link'+i+'-label').value=link?.label||'';$('c-link'+i+'-url').value=link?.url||'';} }
  pickerSel[kind]=new Set(item.tags||[]);pickerGen[kind]=new Set(item.genres||[]);renderTagPicker(kind);renderGenrePicker(kind);
  $(kind+'-variant-editor').hidden=false;
  $(p+'-variant-select').innerHTML=ScoreModel.variants(editor).map(v=>`<option value="${attr(v.id)}" ${v.id===variant.id?'selected':''}>${esc(variantLabel(v))}${v.id===editor.defaultVariantId?' (shown first)':''}</option>`).join('');
  $(p+'-variant-default').textContent='Shown first: '+variantLabel(editor.variants.find(v=>v.id===editor.defaultVariantId)||editor.variants[0]);
}
function captureEditor(kind) {
  const data=readScoreForm(kind);if (!data) return false;
  const editor=editorItems[kind];if (!editor) return data;
  editor.title=data.title;const variant=editor.variants.find(v=>v.id===editingVariant[kind]);
  if(kind==='catalog')for(const field of ['driveLink','musescoreLink','audioFile','pdfFile'])delete data[field];
  else {delete data.video;delete data.links;}
  Object.assign(variant,data,{label:data.arrangement});delete variant.title;return data;
}
function startEdit(kind,id) {
  const item=listOf(kind).find(x=>x.id===id);if (!item) return;
  if ($('score-modal').open) $('score-modal').close();
  editing[kind]=id;editorItems[kind]=clone(item);editingVariant[kind]=displayScore(item,kind).variantId;
  setFormMode(kind,'edit');loadEditorFields(kind);setAdminTab(kind);showView('admin');
}
function selectEditorVariant(kind,id) {
  if (!captureEditor(kind)) {$(prefixOf(kind)+'-variant-select').value=editingVariant[kind];return;}
  editingVariant[kind]=id;loadEditorFields(kind);
}
function makeDefaultVariant(kind) {if (!captureEditor(kind)) return;editorItems[kind].defaultVariantId=editingVariant[kind];loadEditorFields(kind);}
function addEditorVariant(kind) {
  if (!captureEditor(kind)) return;
  const variant={id:uid(),label:'New arrangement',arrangement:'',tags:[],genres:[],links:[],previewImg:'',driveLink:''};
  editorItems[kind].variants.push(variant);editingVariant[kind]=variant.id;loadEditorFields(kind);
}
function removeEditorVariant(kind) {
  const editor=editorItems[kind];if (!editor||editor.variants.length<2){toast('Keep at least one arrangement.',false);return;}
  confirmAction('Remove this arrangement from the editor? Save changes to apply it.',()=>{editor.variants=editor.variants.filter(v=>v.id!==editingVariant[kind]);if (!editor.variants.some(v=>v.id===editor.defaultVariantId))editor.defaultVariantId=editor.variants[0].id;editingVariant[kind]=editor.defaultVariantId;loadEditorFields(kind);},true);
}
function saveScore(kind) {
  if (state.access!=='admin') return;
  const data=captureEditor(kind);if (!data) return;
  const item=editorItems[kind]?clone(editorItems[kind]):{id:uid(),dateAdded:new Date().toISOString(),...data};
  if (!item.variants?.length) item.variants=[ScoreModel.variantFrom(item)];
  item.defaultVariantId=item.defaultVariantId||item.variants[0].id;
  const first=item.variants.find(v=>v.id===item.defaultVariantId)||item.variants[0];
  for(const field of ['artist','arrangement','difficulty','desc','video','previewImg','driveLink','musescoreLink','audioFile','pdfFile','tags','genres','links']) item[field]=first[field]??(['tags','genres','links'].includes(field)?[]:'');
  confirmAction(editing[kind]?'Save changes to this score?':'Add this score?',()=>{
    const list=listOf(kind),index=list.findIndex(x=>x.id===editing[kind]);if(index>=0)list[index]=item;else list.push(item);
    saveKey(lsOf(kind),list);afterContentChange();cancelEdit(kind);refreshLibraries();toast('Changes saved.');
  });
}
function renderAdminCounts() {
  const counts={catalog:state.catalog.length,vault:state.vault.length,genres:state.genres.length,faq:state.faq.length};
  document.querySelectorAll('[data-count]').forEach(element=>{const count=counts[element.dataset.count];element.textContent=typeof count==='number'?`(${count})`:'';});
}
function renderDashboard() {
  ghTokenStatus();const status=state.siteStatus||DEFAULTS.siteStatus;
  $('st-down').checked=status.down;$('st-eta-h').value=status.etaMin?Math.floor(status.etaMin/60)||'':'';$('st-eta-m').value=status.etaMin?status.etaMin%60||'':'';$('st-desc').value=Object.hasOwn(state.texts,'dtSub')?state.texts.dtSub:defaultText('dtSub');
  if(state.access!=='admin')return;renderAdminCounts();
  $('dash-tiles').innerHTML=[{n:state.catalog.length,l:'Published songs'},{n:state.vault.length,l:'Vault songs'},{n:[...state.catalog,...state.vault].reduce((n,s)=>n+ScoreModel.variants(s).length,0),l:'Arrangements'},{n:state.genres.length,l:'Genres'}].map(tile=>`<div class="rounded-xl bg-sunken border border-line px-4 py-3"><p class="font-display text-2xl font-bold text-ink">${tile.n}</p><p class="text-xs text-faint">${tile.l}</p></div>`).join('');
  $('dash-checklist').innerHTML='<button class="ui-btn border border-line px-4" onclick="setAdminTab(\'import\')">Import arrangements from ZIP or folder</button>';
}
function ghRepo() { return {owner:'Unbranded1',repo:'Unbranded1.github.io'}; }
function ghTokenStatus() {
  const element=$('gh-token-status');if(!element)return;
  let token='';try{token=localStorage.getItem(LS.ghToken)||'';}catch{}
  element.textContent=token?'Token saved on this device. Cover JPGs can be published to Unbranded1/Unbranded1.github.io.':'Save a GitHub token here to publish generated cover JPGs.';
}
async function ghUploadField(inputId,folder,targetId) {
  if(state.access!=='admin'||ghBusy)return;
  if(folder!=='previews'){toast('Only cover images are uploaded.',false);return;}
  const file=$(inputId).files?.[0];if(!file)return;
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024){toast('Choose a JPG, PNG, or WebP smaller than 5 MB.',false);return;}
  let token='';try{token=localStorage.getItem(LS.ghToken)||'';}catch{}
  if(!token){toast('Save a GitHub token in Backup & Data first.',false);return;}
  ghBusy=true;
  try {
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
    const path='previews/'+uid()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);
    const response=await fetch('https://api.github.com/repos/Unbranded1/Unbranded1.github.io/contents/'+path,{method:'PUT',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},body:JSON.stringify({message:'Add score cover image',content:btoa(binary),branch:'main'})});
    if(!response.ok)throw Error('Cover upload failed ('+response.status+'). Check repository write permission.');
    $(targetId).value=path;$(inputId).value='';toast('Cover saved. Save the score to use it.');
  }catch(error){toast(error.message,false);}finally{ghBusy=false;}
}
window.scoreAdminBridge={
  get isAdmin(){return state.access==='admin';},
  get token(){try{return localStorage.getItem(LS.ghToken)||'';}catch{return'';}},
  library:kind=>clone(listOf(kind)),
  escape:esc,
  async commitImports(kind,rows){
    if(state.access!=='admin')throw Error('Sign in as admin before publishing.');
    const library=clone(listOf(kind)),groups=new Map();
    for(const row of rows){const group=groups.get(row.songKey)||[];group.push(row);groups.set(row.songKey,group);}
    for(const [songKey,arrangements] of groups){
      const selectedIds=[...new Set(arrangements.map(row=>row.existingId).filter(Boolean))];
      if(selectedIds.length>1)throw Error('Choose the same destination song for arrangements in '+songKey+'.');
      let item=library.find(score=>score.id===selectedIds[0])||library.find(score=>score.sourceKey===songKey);
      if(!item){item={id:'song-'+ScoreModel.id(songKey),title:'',sourceKey:songKey,dateAdded:new Date().toISOString(),variants:[],tags:[],genres:[],links:[]};if(library.some(score=>score.id===item.id))item.id=uid();library.push(item);}
      const japanese=arrangements.find(row=>row.japaneseTitle)?.japaneseTitle||'';
      const english=arrangements.find(row=>row.englishTitle)?.englishTitle||'';
      item.title=[japanese,english].filter(Boolean).join(' - ');item.japaneseTitle=japanese;item.englishTitle=english;
      for(const row of arrangements){
        const folderId=value=>String(value||'').match(/\/folders\/([\w-]+)/)?.[1];
        const index=item.variants.findIndex(v=>v.sourceFolder===row.variant.sourceFolder||(folderId(v.driveLink)&&folderId(v.driveLink)===folderId(row.variant.driveLink)));
        if(index>=0)item.variants[index]={...item.variants[index],...row.variant,id:item.variants[index].id};else item.variants.push(row.variant);
        if(row.isDefault)item.defaultVariantId=(index>=0?item.variants[index]:row.variant).id;
      }
      item.defaultVariantId=item.defaultVariantId||item.variants[0].id;
      const first=item.variants.find(v=>v.id===item.defaultVariantId)||item.variants[0];
      for(const field of ['artist','arrangement','difficulty','desc','video','previewImg','driveLink','musescoreLink','audioFile','pdfFile','tags','genres','links'])item[field]=first[field]??(['tags','genres','links'].includes(field)?[]:'');
    }
    await publishChain;
    const payload=clone(contentPayload());payload[kind]=library;
    if(fbUser&&!(await publishContent(payload)))throw Error('Covers were saved, but score publishing failed. Retry publishing to finish.');
    state[kind]=library;saveKey(lsOf(kind),library);if(!fbUser)markDraft();else {try{localStorage.removeItem(DRAFT_KEY);}catch{}renderDraftStatus();}refreshLibraries();
    return {songs:groups.size,arrangements:rows.length,live:!!fbUser};
  }
};


(async function init() {
  try { localStorage.removeItem(LS.theme); } catch {}
  if (FB_READY) { try { await initFirebase(); } catch (e) { console.warn('Firebase init failed:', e); } }
  PUBLISHED = fbContent || await fetchPublished();
  captureDefaultTexts();
  loadState();
  applySettings();
  applyTexts();
  applySocial();

  applySiteStatus();
  requestAnimationFrame(() => document.documentElement.classList.remove('boot'));

  renderFeatured();
  renderFaq();
  renderDiffChips('vault');
  renderDiffChips('catalog');
  applyLayoutButtons();
  setAdminTab('dash');

  renderDraftStatus();
  applyAccess();
  stateLoaded = true;
  if (fbUser) {
    state.access = 'admin';
    applyAccess();
    renderDraftStatus();
  }
  applyRoute();
  if (ANALYTICS_CODE) {
    const ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://gc.zgo.at/count.js';
    ga.dataset.goatcounter = 'https://' + ANALYTICS_CODE + '.goatcounter.com/count';
    document.head.appendChild(ga);
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
