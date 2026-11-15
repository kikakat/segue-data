/* Segue: the recommender.
   Every item becomes a set of features: tags, themes, genres, creator and
   romance type. A candidate's predicted score starts at your average for its
   category and moves toward the scores of the things you rated that it most
   resembles (cosine similarity; rare features weigh more). Things you rated
   in other categories count too, through shared themes, so a book you loved
   can lift a show. Your genre picks, community ratings and your romance
   settings nudge the result. */
'use strict';

// Weights picked by leaving each rated book out in turn and predicting it.
const W = { s: 1, t: 1.4, g: 0.5, a: 0.8, r: 1.2 };
const TOP_MIN = 7.5;
const romKey = r => r === 'mm-bg' ? 'mm' : r;
let THEME_RX = null;
async function loadThemes() {
  try {
    const r = await fetch('data/themes.json');
    const map = r.ok ? await r.json() : {};
    THEME_RX = Object.entries(map).map(([t, ks]) => [t, new RegExp('(?<![a-z0-9])(?:' + ks.map(k => fold(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])')]);
  } catch (e) { THEME_RX = []; }
}
function themesFor(x) {
  if (x.themes && x.themes.length) return x.themes;
  if (!THEME_RX) return [];
  const text = [].concat(x.tags || [], x.mt || [], x.utags || [], x.genres || []).map(fold).join(' | ');
  const t = THEME_RX.filter(([, rx]) => rx.test(text)).map(([k]) => k);
  if (QUEERISH.includes(x.romance) && !t.includes('queer')) t.push('queer');
  return t;
}
function feats(x, lib) {
  if (x._f) return x._f;
  const f = new Map();
  (x.tags || []).forEach(s => f.set('s:' + s, W.s));
  (x.cat === 'books' ? (x.mt || []) : themesFor(x)).forEach(v => f.set('t:' + v, W.t));
  (x.genres || []).slice(0, lib && x.cat === 'books' ? 1 : 4).forEach((g, i) => f.set('g:' + g, i === 0 ? W.g : W.g * 0.5));
  (x.by || []).slice(0, lib ? 1 : 2).forEach(a => f.set('a:' + normName(a), W.a));
  if (x.romance && x.romance !== 'none') f.set('r:' + romKey(x.romance), W.r);
  x._f = f;
  return f;
}
function themeFeats(x) {
  if (x._tf) return x._tf;
  const f = new Map();
  themesFor(x).forEach(t => f.set(t, 1));
  if (x.romance && QUEERISH.includes(x.romance)) f.set('r:' + romKey(x.romance), 0.8);
  x._tf = f;
  return f;
}
function vectorizer(sets) {
  const df = new Map();
  sets.forEach(f => f.forEach((_, k) => df.set(k, (df.get(k) || 0) + 1)));
  const N = sets.length;
  const idf = k => Math.sqrt(Math.log((N + 1) / ((df.get(k) || 0) + 1)) + 1);
  return f => {
    const v = new Map(); let n = 0;
    f.forEach((w, k) => { const x = w * idf(k); v.set(k, x); n += x * x; });
    n = Math.sqrt(n) || 1; v.forEach((x, k) => v.set(k, x / n));
    return v;
  };
}
function cosine(a, b, keep) {
  let s = 0; const shared = keep ? [] : null;
  const [x, y] = a.size < b.size ? [a, b] : [b, a];
  x.forEach((w, k) => { const z = y.get(k); if (z) { s += w * z; if (shared) shared.push([k, w * z]); } });
  return keep ? { s, shared } : s;
}
function buildModels(candsByCat) {
  const all = rated();
  const globalMu = all.length ? avg(all.map(e => e.score)) : 7;
  const models = {};
  for (const c of Object.keys(candsByCat)) {
    const lib = all.filter(e => e.cat === c), soft = leaning(c);
    const libF = lib.map(e => feats(e, true)), softF = soft.map(e => feats(e, true));
    const vec = vectorizer(libF.concat(softF, candsByCat[c].map(i => feats(i))));
    // Your average in a category is trusted once you've rated a few there.
    // Before that, picks start from a neutral 6.8: what you choose to log
    // runs higher than a random catalog pick would.
    const k = Math.min(1, lib.length / 5);
    const mu = lib.length ? k * avg(lib.map(e => e.score)) + (1 - k) * Math.min(6.8, globalMu) : Math.min(6.8, globalMu);
    models[c] = { mu, vec, n: lib.length, L: lib.map((e, i) => ({ e, v: vec(libF[i]), d: e.score - mu }))
      .concat(soft.map((e, i) => ({ e, v: vec(softF[i]), d: LEANS[e.status].d, w: LEANS[e.status].w, soft: true }))) };
  }
  // One theme space across categories, for the links between them.
  const cands = [].concat(...Object.values(candsByCat));
  const tvec = vectorizer(all.map(themeFeats).concat(cands.map(themeFeats)));
  const catMu = c => (models[c] && models[c].n >= 3) ? models[c].mu : globalMu;
  models.X = { tvec, L: all.filter(e => themeFeats(e).size >= 2).map(e => ({ e, v: tvec(themeFeats(e)), d: e.score - catMu(e.cat) })) };
  models.globalMu = globalMu;
  return models;
}
function favCreators() {
  if (R.favs) return R.favs;
  const s = new Set(rated().filter(e => e.score >= 8).map(e => e.cat + '|' + normName(firstBy(e))));
  Object.entries(S.prefs.creators || {}).forEach(([c, list]) => (list || []).forEach(n => s.add(c + '|' + normName(n))));
  return (R.favs = s);
}
function predict(it, M) {
  const c = it.cat, m = M[c], P = S.prefs;
  const f = feats(it), v = m.vec(f);
  // Things you saved or passed on (soft) count for less than your scores.
  const sims = m.L.map(l => { const r = cosine(v, l.v, true); return { l, s: r.s, k: r.s * (l.w || 1), shared: r.shared }; })
    .filter(x => x.s > 0.02).sort((a, b) => b.k - a.k);
  let num = 0, den = 0;
  // Favourites (the star in your library) count for more.
  sims.slice(0, 3).forEach(x => { const w = x.k * (x.l.e.fav ? 1.4 : 1); num += w * x.l.d; den += w; });
  const size = f.size;
  // An item with only a handful of known traits stays closer to your average.
  let p = m.mu + (num / (den + 0.25)) * Math.min(1, (size + 1) / 8);
  // What you picked for this category leads. Until you've scored plenty here,
  // a pick outside the genres you chose stays below the top matches.
  const cold = Math.max(0.35, 1 - m.n / 15);
  const likes = (P.likes || {})[c] || [], g = it.genres || [];
  const likedMain = likes.includes(g[0]), likedAny = g.some(x => likes.includes(x));
  const fits = !likes.length || likedAny;
  if (likes.length) p += (likedMain ? 0.8 : likedAny ? 0.5 : -1) * cold;
  if ((it.by || []).some(a => favCreators().has(c + '|' + normName(a)))) p += 0.35 * cold;
  let xs = [];
  // Music shares no story themes with the rest, so it only learns from music.
  if (M.X.L.length && c !== 'music') {
    const tv = M.X.tvec(themeFeats(it));
    xs = M.X.L.filter(l => l.e.cat !== c && l.e.cat !== 'music').map(l => { const r = cosine(tv, l.v, true); return { l, s: r.s, shared: r.shared }; })
      .filter(x => x.s >= 0.3).sort((a, b) => b.s - a.s).slice(0, 3);
    // What you loved in other categories only breaks ties among the genres
    // you picked here: liking war books doesn't make a shooter a match.
    // It moves a score by under half a point, less once you've rated plenty here.
    let xn = 0, xd = 0;
    xs.slice(0, 2).forEach(x => { const w = x.s * x.s * (x.l.e.fav ? 1.4 : 1); xn += w * x.l.d; xd += w; });
    // No genre picks here yet: other categories count for half.
    const k = (m.n >= 12 ? 0.3 : m.n >= 5 ? 0.6 : 1) * (!likes.length ? 0.5 : fits ? 1 : 0.15);
    p += Math.max(-0.45, Math.min(0.45, 0.3 * xn / (xd + 0.3))) * k;
  }
  const d = R.cats[c];
  if (c === 'books') {
    p += Math.min(0.3, (it.awards || []).reduce((t, a) => t + (a.w ? 0.2 : 0.08), 0));
    if (it.votes >= 20 && it.rating) p += it.rating >= 8.2 ? 0.15 : it.rating < 7 ? -0.25 : 0;
  } else if (it.rating && (it.votes || 0) >= CATS[c].min && d && d.mean) {
    p += Math.max(-0.4, Math.min(0.4, (it.rating - d.mean) * 0.18)) * (m.n < 5 ? 1.2 : 1);
  } else if (c === 'music' && it.replay && d && d.rq(0.5)) {
    p += Math.max(-0.25, Math.min(0.25, Math.log(it.replay / d.rq(0.5)) * 0.25));
  }
  if (m.n < 5 && it.pct != null) p += (it.pct - 0.5) * 0.5 * cold;  // popular things are safer bets when we know little
  if (STORY.has(c)) {
    const Rm = P.romance, pairs = new Set(Rm.pairs || []), rc = it.romance;
    if (rc === 'romance' && pairs.size < 3) p -= 0.4;
    else if (rc === 'ff' && !pairs.has('ff')) p -= 0.7;
    else if (rc === 'mm' && !pairs.has('mm')) p -= 0.7;
    if (it.romanceLed) p += Rm.lead === 'love' ? 0.3 : Rm.lead === 'ok' ? 0 : -0.6;  // steer away when the love story drives it
  }
  // With few ratings in a category, no pick claims a near-certain score,
  // and nothing outside your genre picks reaches the top matches.
  if (m.n < 5) p = Math.min(p, 8.4 + m.n * 0.25);
  if (!fits && m.n < 8) p = Math.min(p, 7);
  const model = p;
  p = Math.max(1, Math.min(10, p));
  return { pred: round2(p), model, sims, xs, conf: den, n: m.n };
}
function featLabel(k) {
  const i = k.indexOf(':');
  if (i < 0) return k;
  const t = k.slice(0, i), v = k.slice(i + 1);
  if (t === 'a') return tr('same creator');
  if (t === 'g') return gl(v).toLowerCase();
  if (t === 'r') return tr({ mm: 'M/M', qromance: 'queer romance', queer: 'queer', ffbg: 'F/F', ff: 'F/F romance', romance: 'romance', minor: 'minor romance' }[v] || v);
  return tr(v);
}
function explain(sc) {
  // Reasons only name things you scored ("Like X" means you liked X).
  const real = sc.sims.filter(x => !x.l.soft);
  const pos = real.filter(x => x.l.d >= 0).slice(0, 2);
  const xpos = (sc.xs || []).filter(x => x.l.d >= 0.5).slice(0, 1);
  const neg = real.find(x => x.l.d <= -1 && x.s > 0.15);
  const feat = new Map();
  // In Spanish, raw subject tags (English words from the sources) are left out of the reasons.
  pos.concat(xpos).forEach(x => x.shared.forEach(([k, w]) => { if (LANG.ui === 'es' && k.startsWith('s:')) return; feat.set(k, (feat.get(k) || 0) + w); }));
  const labels = [];
  [...feat].sort((a, b) => b[1] - a[1]).forEach(([k]) => { const l = featLabel(k); if (!labels.includes(l) && l !== 'same creator' || (l === 'same creator' && !labels.includes(l))) labels.push(l); });
  return { like: pos.map(x => x.l.e), cross: xpos.map(x => x.l.e), shared: labels.slice(0, 4), neg: neg ? neg.l.e : null };
}
/* The reason shown under a pick. Your genre picks for the category come
   first until your own scores there take over; other categories come last. */
function whyLine(it) {
  const ex = explain(it.sc), and = ` ${tr('and')} `;
  const shared = ex.shared.length ? ': ' + ex.shared.slice(0, 3).join(', ') : '';
  const same = ex.like.length ? `${tr('Like')} ${ex.like.map(e => tt(e)).join(and)}${shared}` : '';
  const cross = ex.cross.length ? tt(ex.cross[0]) : '';
  const picked = (((S.prefs.likes || {})[it.cat]) || []).filter(g => (it.genres || []).includes(g));
  if (same && it.sc.n >= 5) return same;
  if (picked.length) return tr('{genres}, which you picked', { genres: picked.slice(0, 2).map(g => LANG.ui === 'es' ? gl(g).toLowerCase() : gl(g)).join(and) }) + (same ? '. ' + same : cross ? '. ' + tr('Also like {title}', { title: cross }) : '');
  if (same) return same;
  if (cross) return `${tr('Like')} ${cross}${shared}`;
  if (it.rating && it.votes >= CATS[it.cat].min) return tr(it.cat === 'books' ? 'Rated {score} by readers' : 'Rated {score} by others', { score: fmt(it.rating) });
  return '';
}
function confLabel(sc) { return tr(sc.conf > 0.9 ? 'Strong match' : sc.conf > 0.4 ? 'Partial match' : sc.n ? 'Few signals' : 'From your picks and ratings by others'); }
function quality(c) { return Math.log10(1 + (c.pop || 0)) + (c.awards || []).length * 0.5 + (c.rating || 6) / 4; }

/* At most two per creator, and two per series, near the front of a row, so one
   author or franchise can't fill it. The rest keep their order at the end. */
function spread(list, n = 2) {
  const seen = new Map(), front = [], back = [];
  const bump = k => { const c = (seen.get(k) || 0) + 1; seen.set(k, c); return c; };
  for (const i of list) {
    const a = firstBy(i) ? bump(i.cat + '|a|' + normName(firstBy(i))) : 0, s = i.ser ? bump(i.cat + '|s|' + i.ser[0]) : 0;
    (a > n || s > n ? back : front).push(i);
  }
  return front.concat(back);
}

/* ---------------------------------------------------------------- what can be shown */
function catItems(c) {
  return R.cats[c] ? R.cats[c].items : [];
}
function knownIndex(c) {
  const titles = new Map(), ids = new Set(), sers = new Set(), words = [], series = [];
  for (const e of S.items) {
    if (e.cat !== c) continue;
    const k = titleKey(e.title);
    (titles.get(k) || titles.set(k, []).get(k)).push(e);
    if (e.ref) ids.add(String(e.ref));
    const w = seriesOf(e);
    if (w) sers.add(w.s.id);
    if (c === 'books' && e.by && e.by[0]) words.push({ a: normName(e.by[0]), w: distinct(e.title) });
    // "Captive Prince trilogy" in your library covers the author's other books from those years.
    if (c === 'books' && e.status === 'done' && e.by && e.by[0] && e.year && /\b(trilogy|duology|series|saga|quartet)\b/i.test(e.title)) series.push({ a: normName(e.by[0]), y: e.year });
  }
  return { titles, ids, sers, words, series };
}
function knownBy(it, K) {
  if (K.ids.has(String(it.id)) || (K.titles.get(titleKey(it.title)) || []).some(e => sameWork(e, it))) return true;
  // The other parts of a series you're in: "Continue your series" offers the next one.
  if (it.ser && K.sers.has(it.ser[0])) return true;
  if (it.cat !== 'books') return false;
  if ((it.more || []).some(t => (K.titles.get(titleKey(t)) || []).some(e => sameMaker(e, it)))) return true;
  const a = normName(firstBy(it)), w = distinct(it.title);
  // Translated danmei comes out in bursts across different series, so it's left out of this rule.
  if (it.year && (it.genres || [])[0] !== 'Danmei / web novel' && K.series.some(x => x.a === a && it.year >= x.y - 1 && it.year <= x.y + 3)) return true;
  return w.size > 0 && K.words.some(x => x.a === a && [...x.w].some(y => w.has(y)));
}
/* Picks start a series at the beginning; "Continue your series" offers the next
   part once you've liked one. Books: book 1 only. When it isn't in the catalog
   (older than min_year, say), no book of the series is a pick: Chapterhouse:
   Dune alone makes little sense. Movies: the earliest part the catalog has,
   since film collections are looser (In the Mood for Love is part 2 of one).
   Returns the keys of the later parts, worked out once per catalog. */
function laterParts(c) {
  const d = R.cats[c];
  if (!d || !d.series) return null;
  if (!d.later) {
    const start = new Map();
    for (const i of d.items) {
      if (!i.ser || !Number.isInteger(i.ser[1])) continue;
      const s = d.series[i.ser[0]], book1 = c === 'books' && s && wholeParts(s).reduce((m, p) => Math.min(m, p.n), Infinity);
      const n = book1 && book1 !== Infinity ? book1 : i.ser[1], was = start.get(i.ser[0]);
      if (was === undefined || n < was) start.set(i.ser[0], n);
    }
    d.later = new Set(d.items.filter(i => i.ser && start.has(i.ser[0]) && i.ser[1] !== start.get(i.ser[0])).map(i => i.key));
  }
  return d.later;
}
function scored() {
  if (R.scored) return R.scored;
  const byCat = {};
  for (const c of enabledCats()) {
    const K = knownIndex(c), later = laterParts(c);
    byCat[c] = catItems(c).filter(it => !(later && later.has(it.key)) && !knownBy(it, K));
  }
  const M = R.models = buildModels(byCat);
  R.byKey = new Map();
  const out = [];
  for (const c of Object.keys(byCat)) byCat[c].forEach(it => { it.sc = predict(it, M); R.byKey.set(it.key, it); out.push(it); });
  R.scored = out;
  return out;
}
// skipYears === true leaves out the decade rule (the genre screen counts what each decade chip holds).
function passesRules(it, skipYears) {
  const P = S.prefs, c = it.cat, rc = it.romance || 'none';
  // Decades you hid in this category's genre screen. Titles with no year stay.
  const hid = (P.years || {})[c] || [];
  if (skipYears !== true && hid.length && hid.includes(decadeKey(c, it.year))) return false;
  // Things made for readers or viewers you didn't pick (children, young adults) are left out, unless by a creator you rate 8+.
  if (it.audience && !forAges(it, bookAges(P)) && !favCreators().has(c + '|' + normName(firstBy(it)))) return false;
  if (P.minRating && it.rating && (it.votes || 0) >= CATS[c].min && it.rating < 6) return false;
  // Only things available in a language you read, watch or play in.
  const L = P.langs || [];
  if (L.length && it.langs && !it.langs.some(x => L.includes(x))) return false;
  // Only movies and shows on a service you have, once you've said which. Titles
  // the catalog has no streaming data for stay.
  if (STREAM.has(c) && (P.services || []).length && it.watch && !(it.watch[myCountry()] || []).some(s => P.services.includes(s))) return false;
  // Only games you can play on something you own.
  if (c === 'games' && (P.platforms || []).length && (it.plat || []).length && !it.plat.some(p => P.platforms.includes(p))) return false;
  // A genre you ruled out hides everything tagged with it, not just things where it comes first.
  const no = (P.dislikes || {})[c] || [];
  if (no.length && (it.genres || []).some(g => no.includes(g))) return false;
  if (c === 'books' && (P.hiddenBookGenres || []).includes((it.genres || [])[0])) return false;
  if ((P.avoid || []).length && themesFor(it).some(t => P.avoid.includes(t)) && !(((P.likes || {})[c] || []).some(g => (it.genres || []).includes(g)))) return false;
  if (STORY.has(c)) {
    const Rm = P.romance, pairs = new Set(Rm.pairs || []);
    if (Rm.mmOnly && rc !== 'mm' && rc !== 'mm-bg') return false;
    if (Rm.strict && rc === 'romance' && pairs.size < 3) return false;
    if (rc === 'ff' && !pairs.has('ff')) return false;
    if (rc === 'mm' && !pairs.has('mm')) return false;
    if (Rm.lead === 'avoid' && it.romanceLed) return false;
  }
  return true;
}
function visible(cat) {
  const items = scored().filter(passesRules);
  return cat && cat !== 'all' ? items.filter(i => i.cat === cat) : items;
}
const byMatch = (a, b) => b.sc.pred - a.sc.pred || b.sc.model - a.sc.model || quality(b) - quality(a);
function sorter(kind) {
  if (kind === 'rating') return (a, b) => ((b.votes >= CATS[b.cat].min ? b.rating : 0) || 0) - ((a.votes >= CATS[a.cat].min ? a.rating : 0) || 0) || b.sc.pred - a.sc.pred;
  if (kind === 'new') return (a, b) => (b.year || 0) - (a.year || 0) || b.sc.pred - a.sc.pred;
  if (kind === 'popular') return (a, b) => (b.pct || 0) - (a.pct || 0) || (b.pop || 0) - (a.pop || 0);
  return byMatch;
}
/* No more than two in a row from the same category, so a mixed row stays mixed. */
function mixCats(list) {
  const out = [], rest = list.slice();
  while (rest.length) {
    const n = out.length, last = n >= 2 && out[n - 1].cat === out[n - 2].cat ? out[n - 1].cat : null;
    const i = last ? rest.findIndex(x => x.cat !== last) : 0;
    out.push(rest.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out;
}

/* ---------------------------------------------------------------- gems and luck */
function ratingPct(it) {
  const d = R.cats[it.cat];
  if (!d) return 0;
  if (it.cat === 'music') {
    const lo = d.rq(0.5), hi = d.rq(0.95);
    return it.replay && lo && hi > lo ? Math.max(0, Math.min(1, (it.replay - lo) / (hi - lo))) : 0;
  }
  if (!it.rating || (it.votes || 0) < CATS[it.cat].min) return 0;
  const lo = d.q(0.5), hi = d.q(0.97);
  return hi > lo ? Math.max(0, Math.min(1, (it.rating - lo) / (hi - lo))) : 0;
}
/* Hidden gems: rated highly by the people who found them, known by few,
   and a reasonable fit for you without being an obvious match. */
function gems(items) {
  return items.filter(i => {
    const d = R.cats[i.cat];
    if (!d || i.pct == null || i.pct > 0.45 || i.sc.pred < 6.2 || i.sc.pred >= 8.8) return false;
    if (i.cat === 'music') return i.replay && i.replay >= d.rq(0.75);
    return i.rating && (i.votes || 0) >= CATS[i.cat].min && i.rating >= d.q(0.75);
  }).map(i => (i._gem = ratingPct(i) + (i.sc.pred - 6.2) * 0.35 + (0.45 - i.pct), i)).sort((a, b) => b._gem - a._gem);
}
const kfmt = n => n >= 1000 ? Math.round(n / 100) / 10 + 'k' : String(n);
function ratingNote(it) {
  if (it.cat === 'music') return it.votes ? tr('{n} listeners on ListenBrainz', { n: kfmt(it.votes) }) : '';
  if (!it.rating || (it.votes || 0) < CATS[it.cat].min) return '';
  const src = it.rsrc || R.cats[it.cat].source;
  if (src === 'Steam') return tr('{pct}% positive from {n} Steam reviews', { pct: Math.round(it.rating * 10), n: kfmt(it.votes) });
  return tr('{score} from {n} ratings on {src}', { score: fmt(it.rating), n: kfmt(it.votes), src });
}
function gemNote(it) {
  if (it.cat === 'music') return tr('Played over and over by the {n} people who found it', { n: kfmt(it.votes) });
  return ratingNote(it) + tr(', and few have found it');
}
/* Feeling lucky: a random pick that fits you in some way and that other
   people rate well. Your top matches are left out, so it surprises. */
function luckyPool(cat) {
  const items = visible(cat);
  const top = new Set();
  ORDER.forEach(c => items.filter(i => i.cat === c).sort(byMatch).slice(0, 20).forEach(i => top.add(i.key)));
  return items.filter(i => !top.has(i.key) && i.sc.pred >= 6.3 && (ratingPct(i) >= 0.15 || (!i.rating && (i.pct || 0) >= 0.6)));
}
function pickLucky(cat, avoid) {
  const pool = luckyPool(cat).filter(i => !(avoid && avoid.has(i.key)));
  if (!pool.length) return null;
  const wt = i => Math.max(0.05, i.sc.pred - 6) * (0.5 + ratingPct(i)) * (S.prefs.cats[i.cat] === 'maybe' ? 0.6 : 1);
  let total = pool.reduce((t, i) => t + wt(i), 0), r = Math.random() * total;
  for (const i of pool) { r -= wt(i); if (r <= 0) return i; }
  return pool[pool.length - 1];
}
/* Things close to one entry you rated, from any category. */
function closeTo(entry, items, opts = {}) {
  const tv = R.models && R.models.X.tvec(themeFeats(entry));
  const scoredList = items.map(i => {
    let s = 0;
    if (i.cat === entry.cat) s = ((i.sc.sims || []).find(x => x.l.e === entry) || {}).s || 0;
    else if (tv && i.cat !== 'music' && entry.cat !== 'music') s = cosine(tv, R.models.X.tvec(themeFeats(i))) * 0.8;
    return { i, s };
  }).filter(x => x.s >= (x.i.cat === entry.cat ? 0.1 : 0.3) && x.i.sc.pred >= (opts.min || TOP_MIN))
    .sort((x, y) => y.s * (y.i.sc.model - 6) - x.s * (x.i.sc.model - 6)).map(x => x.i);
  // Close matches in the same category and theme matches in others are
  // measured differently, so they take turns: two of the same kind, then one other.
  const same = scoredList.filter(i => i.cat === entry.cat), other = scoredList.filter(i => i.cat !== entry.cat);
  const out = [];
  while (same.length || other.length) {
    if (same.length) out.push(same.shift());
    if (same.length) out.push(same.shift());
    if (other.length) out.push(other.shift());
  }
  return out;
}
