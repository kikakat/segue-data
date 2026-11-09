/* Segue: core pieces. Plain JavaScript, no build step. Your data lives in
   this device's storage; the catalogs come from data/<category>.json, which
   the scraper on your computer writes. */
'use strict';

const KEY = 'segue.v1';
const OLD_KEY = 'ledger.v2';
const CATS = {
  books:      { label: 'Books', one: 'book', many: 'books', q: 'Do you read books?', did: 'Read it', doing: 'Reading', icon: 'book', by: 'Author', people: 'authors', min: 5 },
  manga:      { label: 'Manga', one: 'manga', many: 'manga', q: 'Into manga, manhwa or manhua?', did: 'Read it', doing: 'Reading', icon: 'manga', by: 'Author', people: 'authors', min: 1000 },
  tv:         { label: 'TV', full: 'TV shows', one: 'show', many: 'shows', q: 'Do you watch TV shows?', did: 'Watched it', doing: 'Watching', icon: 'tv', by: 'Created by', people: 'creators', min: 80 },
  movies:     { label: 'Movies', one: 'movie', many: 'movies', q: 'Do you watch movies?', did: 'Watched it', doing: 'Watching', icon: 'film', by: 'Directed by', people: 'directors', min: 150 },
  games:      { label: 'Games', full: 'Video games', one: 'game', many: 'games', q: 'Do you play video games?', did: 'Played it', doing: 'Playing', icon: 'pad', by: 'Developer', people: 'developers', min: 60 },
  boardgames: { label: 'Board games', one: 'board game', many: 'board games', q: 'Into board games?', did: 'Played it', doing: 'Playing', icon: 'dice', by: 'Designer', people: 'designers', min: 300 },
  music:      { label: 'Music', one: 'album', many: 'albums', q: 'Want album picks?', did: 'Listened', doing: 'Listening', icon: 'music', by: 'Artist', people: 'artists', min: 0 },
};
const ORDER = Object.keys(CATS);
const STORY = new Set(['books', 'manga', 'tv', 'movies', 'games']);  // romance settings apply to these
const catName = c => CATS[c].full || CATS[c].label;
// Decade chips in each category's genre screen. Anything older than the floor
// shares one "Before …" chip (few catalogs have much there).
const YEAR_FLOOR = { books: 1980, manga: 1990, tv: 1980, movies: 1960, games: 1990, boardgames: 1980, music: 1960 };
function decadeKey(c, year) {
  const y = parseInt(String(year || '').slice(0, 4), 10);
  if (!y) return null;
  return y < YEAR_FLOOR[c] ? 'pre' : String(Math.floor(y / 10) * 10);
}
const ROMANCE = {
  none: { t: 'No romance tagged', c: '' },
  mm: { t: 'M/M romance', c: 'teal' },
  'mm-bg': { t: 'M/M, in the background', c: 'teal' },
  minor: { t: 'Minor romance subplot', c: '' },
  queer: { t: 'Queer, no romance tagged', c: 'lav' },
  qromance: { t: 'Queer romance, pairing not listed', c: 'lav' },
  ffbg: { t: 'F/F, no romance tagged', c: 'lav' },
  romance: { t: 'Romance, pairing not listed', c: 'amber' },
  ff: { t: 'F/F romance', c: 'amber' },
};
const QUEERISH = ['mm', 'mm-bg', 'qromance', 'queer', 'ffbg', 'ff'];
const AUD = { adult: 'Adult', mature: 'Mature', crossover: 'Crossover, YA-leaning', ya: 'YA', children: 'For children' };
/* Who books, manga, movies and shows are made for, as chosen in You ("Made for").
   Catalogs label them: books from their subjects, manga from AniList's demographic,
   movies and shows from their US age rating. Games and music have no labels. Before
   the choice existed there was a Hide YA switch, which sets where you start. */
const BOOK_AGES = [['children', 'Children'], ['ya', 'Young adults'], ['adult', 'Adults']];
const AGED = ['books', 'manga', 'tv', 'movies'];  // the categories with labels
const bookAges = P => P.ages || (P.hideYA ? ['adult'] : ['ya', 'adult']);
const AGES_OF = { children: ['children'], ya: ['ya'], crossover: ['ya', 'adult'] };  // anything else is for adults
const forAges = (it, ages) => (AGES_OF[it.audience] || ['adult']).some(a => ages.includes(a));
const BOOK_TAGS = ['court intrigue', 'worldbuilding', 'romance', 'horror', 'eerie', 'medieval', 'historical', 'supernatural',
  'strong characters', 'slow start', 'weak ending', 'low conflict', 'thin plot', 'overcomplicated plot', 'explicit', 'mystery', 're-readable'];
// What you play games on. Games for none of these are left out.
const PLATFORMS = [['pc', 'PC'], ['ps', 'PlayStation'], ['xbox', 'Xbox'], ['switch', 'Nintendo Switch'], ['mobile', 'Phone or tablet'], ['retro', 'Older consoles']];
const AVOIDABLE = [['horror', 'Horror'], ['gore', 'Gore'], ['explicit', 'Explicit sex'], ['tragedy', 'Tragedy'], ['war', 'War']];
const COMMON_WORDS = new Set(('night nights shadow shadows blood house queen queens kings dragon dragons witch witches magic ' +
  'light death black white world worlds storm stars stone sword swords winter summer story tales stories ghost ghosts ' +
  'devil demon under after other first before among island empire crown throne prince princes heart hearts bones ' +
  'golden silver glass water river garden cities darkness beyond children daughter daughters mother father brother ' +
  'sister little great small seven three thousand hundred between without within season dreams dream lords wolves ' +
  'there their where these those which while about would could should every never always against trilogy series').split(' '));

/* ---------------------------------------------------------------- helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Scores for display: 8.5 in English, 8,5 in Spanish.
const fmt = n => (n == null || isNaN(n)) ? '–' : (Number.isInteger(n) ? String(n)
  : Number(n).toFixed(1).replace('.', typeof LANG !== 'undefined' && LANG.ui === 'es' ? ',' : '.'));
const band = s => s >= 9 ? 5 : s >= 8 ? 4 : s >= 7 ? 3 : s >= 5.5 ? 2 : 1;
const fold = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const normName = n => fold(n).replace(/[^a-z0-9]+/g, '');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const round2 = x => Math.round(x * 2) / 2;
const icon = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const nowIso = () => new Date().toISOString();
const THIS_YEAR = new Date().getFullYear();
function normTitle(t) {
  let s = fold(t).replace(/&/g, ' and ').split(/\s+--\s+|:\s/)[0];
  s = s.replace(/\([^)]*\)/g, ' ').trim().replace(/^(the|a|an)\s+/, '');
  s = s.replace(/\b(trilogy|duology|series|omnibus|novel|vol(ume)?\.?\s*\d+|book\s*\d+)\b|#\s*\d+/g, ' ');
  return s.replace(/[^a-z0-9]+/g, '');
}
function cleanTitle(t) {
  t = String(t || '').split(/\s+--\s+/)[0].trim();
  t = t.replace(/:\s*a novel\b.*$/i, '').replace(/\s+\([^)]*\)$/, '');
  return t.replace(/\s*\((?:novel|light novel)\)\s*/i, ' ').replace(/[\s,:(]*\b(vol(?:ume)?\.?\s*1|book\s*(?:1|one))\b\)?\.?$/i, '').trim();
}
/* The whole title, subtitle included, for telling titles apart: "Hollow Knight:
   Silksong" isn't "Hollow Knight", nor "The Two Towers" "The Fellowship of the Ring".
   Series notes ("(The Empyrean, #1)", "Book 1") are left out, other brackets kept:
   "(Part 2)" is another album. (normTitle drops subtitles: it only suits loose lookups.) */
const TITLE_KEYS = new Map();
function titleKey(t) {
  let k = TITLE_KEYS.get(t);
  if (k === undefined) {
    const s = fold(String(t || '').split(/\s+--\s+/)[0]).replace(/:\s*a novel\b.*$/, '').replace(/\([^)]*#[^)]*\)|\((?:light )?novel\)/g, ' ')
      .replace(/[\s,:(]*\b(vol(?:ume)?\.?\s*1|book\s*(?:1|one))\b\)?\.?\s*$/, '').replace(/&/g, ' and ').trim().replace(/^(the|a|an)\s+/, '');
    // Titles with no Latin letters or digits (狂言, 残夢) are kept as they are, less the spaces.
    k = s.replace(/[^a-z0-9]+/g, '') || s.replace(/\s+/g, '');
    TITLE_KEYS.set(t, k);
  }
  return k;
}
const surname = n => (fold(n).match(/[a-z0-9]+/g) || []).pop() || '';
/* Same first creator, when both name one ("Sanderson" counts as "Brandon Sanderson"). */
function sameMaker(a, b) {
  const x = firstBy(a), y = firstBy(b);
  return !x || !y || normName(x) === normName(y) || surname(x) === surname(y);
}
/* Whether two things (your entries or catalog titles) are the same work. The same
   catalog id settles it. Otherwise the whole title has to match and the creator
   too. When both have ids that differ, the year as well, except for books (Open
   Library lists some books twice): The Lion King of 2019 isn't the one of 1994. */
const refOf = x => x.status ? x.ref : x.id;
function sameWork(a, b) {
  if (a.cat !== b.cat) return false;
  const ia = refOf(a), ib = refOf(b), both = ia != null && ib != null;
  if (both && String(ia) === String(ib)) return true;
  if (titleKey(a.title) !== titleKey(b.title) || !sameMaker(a, b)) return false;
  return !both || a.cat === 'books' || !(a.year && b.year && Math.abs(a.year - b.year) > 2);
}
function distinct(title) {
  return new Set((fold(cleanTitle(title)).match(/[a-z]+/g) || []).filter(w => w.length >= 5 && !COMMON_WORDS.has(w)));
}
function hueOf(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 190 + h % 90; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function dateLabel(iso) {
  try { return new Date(iso).toLocaleDateString(LOCALE(), { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const firstBy = it => (it.by && it.by[0]) || '';

/* Book helpers used when you add a book from Open Library search */
function normSubjects(raw) {
  const out = [], seen = new Set();
  for (const s0 of raw || []) {
    const s = String(s0).trim();
    if (!s || s.startsWith('[') || /^(nyt|series|collectionid|award|place|person|time):/i.test(s)) continue;
    if (/reading level|bestseller|award winner|staff picks|large print|accessible|lending|overdrive/i.test(s)) continue;
    for (let p of fold(s).split(/\s*(?:\/|--|,|;)\s*/)) {
      p = p.replace(/\s+/g, ' ').replace(/^[\s.()'"]+|[\s.()'"]+$/g, '').replace(/\s+in fiction$/, '');
      if (!['science fiction', 'historical fiction', 'horror fiction'].includes(p)) p = p.replace(/\s+fiction$/, '');
      if (p === 'horror fiction') p = 'horror';
      if (p.length < 3 || ['fiction', 'general', 'fiction in english', 'english fiction', 'large type books', 'novel', 'novels', 'literature', 'accessible book', 'protected daisy', 'in library'].includes(p) || /\d{4}/.test(p)) continue;
      if (!seen.has(p)) { seen.add(p); out.push(p); }
      if (out.length >= 32) return out;
    }
  }
  return out;
}
const BOOK_TAG_MAP = {
  'court intrigue': ['courts and courtiers', 'intrigue', 'political', 'politics', 'kings and rulers', 'princes', 'emperors', 'succession', 'nobility', 'palace'],
  worldbuilding: ['epic', 'high fantasy', 'imaginary places', 'world building'],
  horror: ['horror', 'haunted', 'monsters', 'occult', 'possession'],
  eerie: ['haunted', 'ghost', 'gothic', 'folk horror', 'weird', 'uncanny'],
  medieval: ['middle ages', 'medieval', 'knights', 'crusades', 'plague'],
  historical: ['historical', 'history', 'nineteenth century', 'victorian', 'regency'],
  supernatural: ['supernatural', 'paranormal', 'ghosts', 'spirits', 'vampires', 'witches', 'demons', 'magic'],
  mystery: ['mystery', 'detective', 'murder', 'crime', 'investigation'],
  romance: ['romance', 'love stories', 'romantic'],
  'm/m': ['gay', 'm/m', "boys' love", 'danmei'],
  explicit: ['erotica', 'erotic'],
};
function mapTags(raw) {
  const j = (raw || []).map(fold).join(' | ');
  return Object.keys(BOOK_TAG_MAP).filter(t => BOOK_TAG_MAP[t].some(k => j.includes(k)));
}
function romanceClass(raw) {
  const lows = (raw || []).map(fold), j = lows.join(' | ');
  const count = ks => lows.filter(s => ks.some(k => s.includes(k))).length, has = ks => ks.some(k => j.includes(k));
  const mm = count(['gay men', 'm/m', 'm m romance', 'mm romance', "boys' love", 'boys love', 'danmei', 'male homosexuality', 'queer men']);
  const ff = count(['lesbian', 'f/f', 'sapphic', 'wlw']);
  const rom = has(['romance', 'love stories', 'romantic']), queer = has(['lgbt', 'queer', 'bisexual', 'transgender', 'homosexual']);
  if (mm && mm >= ff) return 'mm';
  if (ff) return rom ? 'ff' : 'ffbg';
  if (has(['gay'])) return 'mm';
  if (queer) return rom ? 'qromance' : 'queer';
  return rom ? 'romance' : 'none';
}
function guessGenre(raw) {
  const j = (raw || []).map(fold).join(' | ');
  const has = ks => ks.some(k => j.includes(k));
  if (has(['danmei', 'xianxia', 'wuxia', "boys' love"])) return 'Danmei / web novel';
  if (has(['dark fantasy', 'grimdark'])) return 'Dark fantasy';
  if (has(['horror', 'ghost stories', 'haunted'])) return 'Horror';
  if (has(['historical fantasy'])) return 'Historical fantasy';
  if (has(['fantasy', 'magic', 'dragons'])) return 'Fantasy';
  if (has(['science fiction'])) return 'Sci-fi';
  if (has(['mystery', 'detective'])) return 'Mystery';
  if (has(['thriller', 'suspense'])) return 'Thriller';
  if (has(['historical fiction'])) return 'Historical fiction';
  return '';
}

/* ---------------------------------------------------------------- state
   One list of entries across every category. status: done (finished and
   scored), next (saved for later), doing (in progress), skip (not for me). */
let S = null;
const R = {
  index: null, cats: {}, loading: {}, err: null, tab: 'discover', scored: null, byKey: new Map(),
  disc: { cat: 'all', mode: null, genre: '' }, lib: { cat: 'all', q: '', sort: 'score' }, next: { status: 'next', cat: 'all' },
  scroll: {}, built: {}, seed: undefined,
};
function defaults() {
  return {
    v: 1, items: [], picks: [], profile: null,
    prefs: {
      cats: {}, likes: {}, dislikes: {}, creators: {}, years: {},  // years: hidden decades per category
      romance: { lead: 'ok', pairs: ['mf', 'mm', 'ff'], strict: false },
      hideYA: false, minRating: true, avoid: [], platforms: [], langs: [],
    },
    settings: { theme: 'system', sort: 'match', ui: '' },
    meta: { created: nowIso(), onboarded: false, seen: {}, newSince: {}, dl: {} },
  };
}
function merge(base, d) {
  const out = Object.assign(base, d);
  out.prefs = Object.assign(defaults().prefs, d.prefs || {});
  out.prefs.romance = Object.assign(defaults().prefs.romance, (d.prefs || {}).romance || {});
  out.settings = Object.assign(defaults().settings, d.settings || {});
  out.meta = Object.assign(defaults().meta, d.meta || {});
  return out;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
    const old = localStorage.getItem(OLD_KEY);
    if (old) return fromLedger(JSON.parse(old));
  } catch (e) { /* fall through to a fresh start */ }
  return null;
}
/* Reading Ledger (the books-only app) kept books and a shelf. Its key is left
   in place, so nothing is lost if you ever go back. */
const SHELF_MAP = { Reading: 'doing', 'To read': 'next', Recommended: 'next', Passed: 'skip' };
function bookEntry(b, status) {
  return {
    id: b.id || uid(), cat: 'books', ref: b.catId || b.olid || null, title: b.title, by: [b.author].filter(Boolean),
    year: b.year, img: b.cover || null, coverId: b.coverId, tags: b.subjects || [], mt: [...new Set([...(b.tags || []), ...(b.autoTags || [])])],
    utags: b.tags || [], genres: b.genre ? [b.genre] : [], romance: b.romance, status,
    score: status === 'done' ? Number(b.score) : undefined, note: b.note || '', fav: !!b.anchor,
    source: (b.source || 'You').toLowerCase(), why: b.why || '', predicted: b.predicted, desc: b.desc || '',
    added: b.added || nowIso(),
  };
}
function fromLedger(d) {
  const s = defaults();
  s.items = (d.books || []).map(b => bookEntry(b, 'done')).concat((d.backlog || []).map(b => bookEntry(b, SHELF_MAP[b.status] || 'next')));
  s.picks = d.picks || [];
  s.profile = d.profile || null;
  const st = d.settings || {};
  s.settings.theme = st.theme || 'system';
  s.prefs.hideYA = st.hideYA !== false;
  s.prefs.minRating = st.minRating !== false;
  // Your old romance setting, carried over.
  s.prefs.romance = {
    strict: (st.romance || 'strict') === 'strict', lead: 'background',
    pairs: st.romance === 'all' ? ['mf', 'mm', 'ff'] : ['mm'], mmOnly: st.romance === 'mm',
  };
  s.prefs.hiddenBookGenres = st.hiddenGenres || [];
  if (s.items.length) s.prefs.cats.books = 'yes';
  s.meta.migrated = nowIso();
  s.meta.fromLedger = true;
  s.meta.seedMerged = (d.meta || {}).seedMerged;
  s.meta.onboarded = false;  // asks about the new categories once
  return s;
}
let persistAsked = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S, (k, v) => k.startsWith('_') ? undefined : v)); }
  catch (e) { toast(t('Could not save on this phone. Make a backup from Settings.')); }
  if (!persistAsked && navigator.storage && navigator.storage.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }
}
function changed() { save(); R.scored = null; R.favs = null; R.models = null; R.cc = null; render(); }
const entries = (status, cat) => S.items.filter(e => (!status || e.status === status) && (!cat || cat === 'all' || e.cat === cat));
const rated = cat => S.items.filter(e => e.status === 'done' && typeof e.score === 'number' && (!cat || e.cat === cat));
/* What you didn't score still says something. Not for me leans your picks away
   from similar things (not when it was "Not now"); saving something and having
   it in progress lean towards them. They count less than a score, and only the
   latest 150 per category, so a long list doesn't slow the picks. */
const LEANS = { skip: { d: -1.5, w: 0.6 }, next: { d: 0.4, w: 0.35 }, doing: { d: 0.6, w: 0.5 } };
const leaning = cat => S.items.filter(e => e.cat === cat && LEANS[e.status] && !(e.status === 'skip' && e.nope === 'later'))
  .sort((a, b) => String(b.added || '').localeCompare(String(a.added || ''))).slice(0, 150);
const SNOOZE_DAYS = 90;  // "Not now" hides a title this long
/* Streaming. The TV and movie catalogs list, per title, the services it streams
   on in a few countries ("watch": {ES: [keys]}), with the services' names in
   "providers". You see one country's: yours if you picked it in You, else the
   phone's region, else Spain or the US by app language. */
const STREAM = new Set(['tv', 'movies']);
function watchCountries() {
  const out = new Set();
  STREAM.forEach(c => { const i = R.cats[c] && R.cats[c].items.find(x => x.watch); if (i) Object.keys(i.watch).forEach(k => out.add(k)); });
  return [...out];
}
function myCountry() {
  if (R.cc) return R.cc;
  const all = watchCountries(), region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
  const pick = [S.prefs.country, region, LANG.ui === 'es' ? 'ES' : 'US'].find(k => k && all.includes(k)) || all[0] || '';
  return all.length ? (R.cc = pick) : pick;
}
const countryName = cc => { try { return new Intl.DisplayNames([LANG.ui], { type: 'region' }).of(cc); } catch (e) { return cc; } };
const serviceOf = (cat, key) => ((R.cats[cat] || {}).providers || {})[key] || ((R.cats[cat === 'tv' ? 'movies' : 'tv'] || {}).providers || {})[key];
/* The services offered in a country, most titles first: [[key, {n, logo}, count]]. */
function servicesIn(cc) {
  const n = new Map();
  STREAM.forEach(c => (R.cats[c] ? R.cats[c].items : []).forEach(i => ((i.watch || {})[cc] || []).forEach(k => n.set(k, (n.get(k) || 0) + 1))));
  return [...n].map(([k, count]) => [k, serviceOf('movies', k) || { n: k }, count]).sort((a, b) => b[2] - a[2]);
}
const catOn = c => ['yes', 'maybe'].includes(S.prefs.cats[c]);
const enabledCats = () => ORDER.filter(c => catOn(c) && R.cats[c]);

/* ---------------------------------------------------------------- catalogs
   The catalogs inside the app are a starting point. Newer ones, published
   online every week, are downloaded by checkUpdates() and kept in the
   browser's Cache Storage; whichever copy is newer is the one used. */
const UPDATES = 'segue-catalogs';
async function loadIndex(fresh) {
  try {
    const r = await fetch('data/index.json', { cache: fresh ? 'no-cache' : 'default' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    R.index = await r.json(); R.err = null;
  } catch (e) { R.err = e; R.index = R.index || { cats: [] }; }
  // Downloaded catalogs that are newer than the ones in the app take their place.
  R.src = {};
  const dl = S.meta.dl || {};
  Object.keys(dl).forEach(c => {
    const i = R.index.cats.findIndex(x => x.cat === c);
    if (i < 0 || dl[c].version > R.index.cats[i].version) {
      if (i < 0) R.index.cats.push(dl[c]); else R.index.cats[i] = dl[c];
      R.src[c] = 'online';
    }
  });
  return R.index;
}
async function remoteConfig() {
  if (R.remote !== undefined) return R.remote;
  try { const r = await fetch('data/remote.json', { cache: 'no-cache' }); R.remote = r.ok ? await r.json() : null; } catch (e) { R.remote = null; }
  return R.remote;
}
async function catalogFile(c, fresh) {
  if (R.src && R.src[c] === 'online' && R.remote) {
    try {
      const hit = await (await caches.open(UPDATES)).match(R.remote.catalogs + c + '.json');
      if (hit) return hit;
    } catch (e) { /* fall back to the copy inside the app */ }
    delete S.meta.dl[c]; delete R.src[c];
  }
  return fetch(`data/${c}.json`, { cache: fresh ? 'no-cache' : 'default' });
}
/* Once a day (or when asked), fetches the published index and downloads the
   categories you use that changed. Skipped on mobile data unless asked. */
async function checkUpdates(force) {
  const cfg = await remoteConfig();
  if (!cfg || !cfg.catalogs || !('caches' in window)) return { ok: false };
  const day = 20 * 3600 * 1000, conn = navigator.connection || {};
  if (!force && (Date.now() - (S.meta.lastCheck || 0) < day || conn.saveData || conn.type === 'cellular')) return { ok: true, skipped: true };
  try {
    const r = await fetch(cfg.catalogs + 'index.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const remote = await r.json(), cache = await caches.open(UPDATES), got = [];
    S.meta.dl = S.meta.dl || {};
    for (const entry of remote.cats || []) {
      const c = entry.cat, cur = (R.index.cats.find(x => x.cat === c) || {}).version || 0;
      if (!CATS[c] || !catOn(c) || entry.version <= cur) continue;
      const url = cfg.catalogs + c + '.json';
      const f = await fetch(url, { cache: 'no-store' });
      if (!f.ok) continue;
      const body = await f.clone().json();
      if (!body || !Array.isArray(body.items) || body.items.length < 50) continue;  // a broken file never replaces a good one
      await cache.put(url, f);
      S.meta.dl[c] = entry;
      got.push(c);
    }
    S.meta.lastCheck = Date.now();
    save();
    if (got.length) {
      await loadIndex();
      await Promise.all(got.map(c => loadCat(c, true)));
      R.scored = null; R.models = null;
      render();
    }
    return { ok: true, got };
  } catch (e) { return { ok: false }; }
}
/* A newer APK published online: shown as a banner with a download button. */
async function checkAppVersion() {
  const cfg = await remoteConfig();
  if (!cfg || !cfg.releases) return null;
  try {
    const mine = await (await fetch('version.json', { cache: 'no-cache' })).json();
    const r = await fetch(cfg.releases, { cache: 'no-store' });
    if (!r.ok) return null;
    const rel = await r.json(), code = Number(String(rel.tag_name || '').replace(/\D+/g, ''));
    const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name || ''));
    if (apk && code > Number(mine.code || 0)) return (R.newApp = { url: apk.browser_download_url, name: rel.name || rel.tag_name });
  } catch (e) { /* not in the APK, or offline */ }
  return null;
}
const available = c => !!(R.index && R.index.cats.some(x => x.cat === c));
async function loadCat(c, fresh) {
  if (R.cats[c] && !fresh) return R.cats[c];
  if (R.loading[c] && !fresh) return R.loading[c];
  const p = (async () => {
    try {
      const r = await catalogFile(c, fresh);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      d.byId = new Map();
      d.items.forEach(it => {
        it.cat = c; it.key = c + ':' + it.id; it.kind = 'catalog';
        // Catalogs built in the cloud leave book covers out: in the Android app the
        // copy bundled with it is tried first, then Open Library's (see coverHTML).
        // The web version has none bundled, so it goes straight to Open Library.
        const bundled = c === 'books' && (window.SegueAndroid || window.LedgerAndroid);
        if (!bundled && /^covers\//.test(it.img || '')) it.img = null;  // a copy bundled with the APK
        if (!it.img && it.coverId) it.img = bundled ? `covers/${it.id}.jpg` : `https://covers.openlibrary.org/b/id/${it.coverId}-M.jpg`;
        d.byId.set(String(it.id), it);
      });
      const ratings = d.items.filter(i => i.rating && (i.votes || 0) >= CATS[c].min).map(i => i.rating).sort((a, b) => a - b);
      d.q = q => ratings.length ? ratings[Math.min(ratings.length - 1, Math.floor(q * ratings.length))] : null;
      d.mean = ratings.length ? avg(ratings) : null;
      const replays = d.items.map(i => i.replay || 0).filter(Boolean).sort((a, b) => a - b);
      d.rq = q => replays.length ? replays[Math.min(replays.length - 1, Math.floor(q * replays.length))] : null;
      const prev = S.meta.seen[c];
      if (d.version !== prev) {
        S.meta.newSince[c] = prev ? new Date(prev * 1000).toISOString().slice(0, 10) : null;
        S.meta.seen[c] = d.version;
        save();
      }
      R.cats[c] = d; R.scored = null; R.models = null;
      return d;
    } catch (e) { return null; } finally { delete R.loading[c]; }
  })();
  R.loading[c] = p;
  return p;
}
async function loadEnabled() {
  await Promise.all(ORDER.filter(c => catOn(c) && available(c)).map(c => loadCat(c)));
}
async function fetchSeed() {
  if (R.seed !== undefined) return R.seed;
  try { const r = await fetch('data/seed.json', { cache: 'no-cache' }); R.seed = r.ok ? await r.json() : null; }
  catch (e) { R.seed = null; }
  return R.seed;
}

/* ---------------------------------------------------------------- covers */
function coverHTML(it, large) {
  const t = (typeof tt === 'function' ? tt(it) : it.title) || '', src = it.img || (it.coverId ? `https://covers.openlibrary.org/b/id/${it.coverId}-M.jpg` : '');
  const sq = it.cat === 'music' || it.cat === 'boardgames' ? ' sq' : '';
  if (!src) return `<div class="cover ph${sq}" style="--h:${hueOf(t)}"><span>${esc(t)}</span></div>`;
  const big = large && it.coverId ? ` data-big="https://covers.openlibrary.org/b/id/${it.coverId}-L.jpg"` : '';
  // A cover that used to ship with the app (covers/…) falls back to Open Library.
  const alt = /^covers\//.test(src) && it.coverId ? ` data-alt="https://covers.openlibrary.org/b/id/${it.coverId}-M.jpg"` : '';
  return `<div class="cover${sq}" style="--h:${hueOf(t)}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fb="${esc(t)}"${big}${alt}></div>`;
}
document.addEventListener('error', e => {
  const img = e.target;
  if (img && img.tagName === 'IMG' && img.dataset.alt) { const a = img.dataset.alt; delete img.dataset.alt; img.src = a; return; }
  if (img && img.tagName === 'IMG' && img.dataset.fb !== undefined && img.parentElement) {
    const p = img.parentElement;
    p.classList.add('ph');
    p.innerHTML = `<span>${esc(img.dataset.fb)}</span>`;
  }
}, true);
function upgradeCovers(root) {
  $$('img[data-big]', root).forEach(img => {
    const hi = new Image();
    hi.onload = () => { if (hi.naturalWidth > 60) img.src = hi.src; };
    hi.src = img.dataset.big;
  });
}

/* ---------------------------------------------------------------- toast */
let toastT;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('in'); action.fn(); };
  el.classList.add('in');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('in'), action ? 5500 : 2800);
}

/* ---------------------------------------------------------------- sheets
   Each open sheet adds a history entry, so the phone's back gesture closes it. */
const stack = [];
function openSheet(o) {
  const root = $('#sheets');
  let entry;
  if (o.replace && stack.length) {
    entry = stack[stack.length - 1];
    entry.sh.remove(); entry.scrim.remove();
  } else {
    entry = {};
    stack.push(entry);
    history.pushState({ sheet: stack.length }, '');
  }
  const scrim = document.createElement('div'); scrim.className = 'scrim in';
  const sh = document.createElement('section');
  sh.className = 'sheet' + (o.tall ? ' tall' : '') + (o.replace ? ' in' : '') + (o.cls ? ' ' + o.cls : '');
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.tabIndex = -1;
  if (o.title) sh.setAttribute('aria-label', o.title);
  sh.innerHTML = `<div class="grab" aria-hidden="true"></div>` +
    (o.title != null ? `<div class="sh-head"><h2>${esc(o.title)}</h2>${o.locked ? '' : `<button class="iconbtn" data-close aria-label="${esc(t('Close'))}">${icon('x')}</button>`}</div>` : '') +
    `<div class="sh-body">${o.html}</div>` + (o.foot ? `<div class="sh-foot">${o.foot}</div>` : '');
  if (!o.replace) scrim.classList.remove('in');
  root.append(scrim, sh);
  Object.assign(entry, { scrim, sh, locked: !!o.locked, onClose: o.onClose });
  requestAnimationFrame(() => { scrim.classList.add('in'); sh.classList.add('in'); });
  if (!o.locked) scrim.addEventListener('click', () => closeSheet());
  sh.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  dragToClose(sh, entry);
  document.body.style.overflow = 'hidden';
  if (o.onMount) o.onMount(sh, entry);
  setTimeout(() => { if (!sh.contains(document.activeElement)) sh.focus({ preventScroll: true }); }, 30);
  return entry;
}
function dragToClose(sh, entry) {
  const handles = [$('.grab', sh), $('.sh-head', sh)].filter(Boolean);
  let y0 = null, dy = 0;
  handles.forEach(h => {
    h.addEventListener('pointerdown', e => { if (entry.locked || e.target.closest('button')) return; y0 = e.clientY; dy = 0; sh.style.transition = 'none'; h.setPointerCapture(e.pointerId); });
    h.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) closeSheet(); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  });
}
function closeSheet(n = 1) {
  if (!stack.length) return;
  n = Math.min(n, stack.length);
  if (stack[stack.length - 1].locked && n === 1) return;
  history.go(-n);
}
function closeAllSheets() { closeSheet(stack.length); }
function removeTop() {
  const e = stack.pop();
  if (!e) return;
  e.scrim.classList.remove('in'); e.sh.classList.remove('in');
  e.scrim.style.pointerEvents = e.sh.style.pointerEvents = 'none';
  setTimeout(() => { e.scrim.remove(); e.sh.remove(); }, 300);
  if (!stack.length && !$('#onb:not([hidden])')) document.body.style.overflow = '';
  if (e.onClose) e.onClose();
}
window.addEventListener('popstate', e => {
  const depth = (e.state && e.state.sheet) || 0;
  while (stack.length > depth) {
    if (stack[stack.length - 1].locked) { history.pushState({ sheet: stack.length }, ''); return; }
    removeTop();
  }
  if (!stack.length && window.__onbBack) window.__onbBack(e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) closeSheet(); });
