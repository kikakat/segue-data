/* Segue: series. Book and movie catalogs list the series their titles belong to
   ("series": {id: {n: name, es: Spanish name, p: [parts]}}, each part
   {n, id, t, te, y, c or img}), and each title in one carries "ser": [id, number].
   From that: the "Book 3 of …" tag, the list of parts on a title's page, and
   the next part to offer once you've finished one and liked it. */

const NEXT_MIN = 5;  // the score a part needs before the next one is offered

/* The whole title, subtitle included: "The Hunger Games: Catching Fire" isn't "The Hunger Games". */
const fullTitle = t => fold(t).replace(/&/g, ' and ').replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '');

/* The catalog's series, with every part findable by id and by title. Titles
   are matched whole first; the short form (normTitle, which drops subtitles)
   only where no other part shares it. */
function seriesData(c) {
  const d = R.cats[c];
  if (!d || !d.series) return null;
  if (!d.partBy) {
    d.partBy = new Map();
    const short = new Map();
    for (const [sid, s] of Object.entries(d.series)) {
      s.id = sid;
      for (const p of s.p || []) {
        if (p.id != null) d.partBy.set('id:' + p.id, [sid, p.n]);
        for (const ti of [p.t, p.te].filter(Boolean)) {
          d.partBy.set('f:' + fullTitle(ti), [sid, p.n]);
          const k = normTitle(ti), was = short.get(k);
          short.set(k, was === undefined || (was && was[0] === sid && was[1] === p.n) ? [sid, p.n] : null);
        }
      }
    }
    for (const [k, v] of short) if (v) d.partBy.set('t:' + k, v);
  }
  return d;
}
function partAt(d, x) {
  const id = x.kind === 'entry' || x.status ? x.ref : x.id;
  if (id != null && d.partBy.has('id:' + id)) return d.partBy.get('id:' + id);
  for (const ti of [x.title, x.t_es].filter(Boolean)) {
    const hit = d.partBy.get('f:' + fullTitle(ti)) || d.partBy.get('t:' + normTitle(ti));
    if (hit) return hit;
  }
  return null;
}

/* Where a catalog title, a part or one of your entries sits: {cat, s, part} or null. */
function seriesOf(x) {
  if (!x || !x.cat) return null;
  const d = seriesData(x.cat);
  if (!d) return null;
  const at = x.ser || partAt(d, x);
  const s = at && d.series[at[0]];
  if (!s) return null;
  const part = s.p.find(p => p.n === at[1]);
  return part ? { cat: x.cat, s, part } : null;
}

const serName = s => (LANG.ui === 'es' && s.es) || s.n;
const partTitle = p => (LANG.ui === 'es' && p.te) || p.t || '';
const wholeParts = s => s.p.filter(p => Number.isInteger(p.n));
/* "Book 3 of The Stormlight Archive", or with total, "Book 3 of 5". */
function partLabel(cat, s, n, total) {
  const what = cat === 'movies' ? 'Part' : 'Book';
  return total ? t(what + ' {n} of {total}', { n: fmt(n), total: wholeParts(s).length }) : t(what + ' {n} of {series}', { n: fmt(n), series: serName(s) });
}
function seriesLabel(x) { const w = seriesOf(x); return w ? partLabel(w.cat, w.s, w.part.n) : ''; }

/* Your entries for a series' parts, by part number. Indexed once per change
   to your lists (changed() drops R.scored, and with it this). */
function seriesEntries(cat, s) {
  if (!R.scored || !R.serIdx || R.serIdx.of !== R.scored || R.serIdx.n !== S.items.length) {
    const by = {};
    for (const e of S.items) {
      const w = seriesOf(e);
      if (!w) continue;
      const m = (by[e.cat + '|' + w.s.id] = by[e.cat + '|' + w.s.id] || new Map());
      if (!m.has(w.part.n) || e.status === 'done') m.set(w.part.n, e);
    }
    R.serIdx = { of: R.scored, n: S.items.length, by };
  }
  return R.serIdx.by[cat + '|' + s.id] || new Map();
}

/* A part as something the app can show and save: the catalog's own title when
   it has it, otherwise built from the part and the series' title in the catalog. */
function partItem(cat, s, p) {
  const d = R.cats[cat];
  const known = p.id != null && d && d.byId.get(String(p.id));
  if (known) {
    if (!R.byKey.has(known.key)) {  // left out of your picks (a later part, or something you know), but openable here
      if (R.models && R.models[cat]) known.sc = predict(known, R.models);
      R.byKey.set(known.key, known);
    }
    return R.byKey.get(known.key);
  }
  const key = `part:${cat}:${s.id}:${p.n}`;
  if (R.byKey.has(key)) return R.byKey.get(key);
  const base = d && (d.items.find(i => i.ser && i.ser[0] === s.id) || null);
  const it = {
    key, kind: 'part', cat, id: p.id != null ? p.id : null, title: p.t || '', t_es: p.te, year: p.y,
    by: cat === 'books' && base ? (base.by || []).slice(0, 2) : [], coverId: p.c, img: p.img || (p.c ? `https://covers.openlibrary.org/b/id/${p.c}-M.jpg` : null),
    genres: base ? base.genres || [] : [], tags: base ? base.tags || [] : [], mt: base ? base.mt || [] : [], themes: base ? base.themes || [] : [],
    romance: base ? base.romance : 'none', audience: base ? base.audience : 'adult', langs: base ? base.langs : undefined, desc: '', ser: [s.id, p.n],
  };
  if (R.models && R.models[cat]) it.sc = predict(it, R.models);
  R.byKey.set(key, it);
  return it;
}

/* The part to offer after the latest one you finished, if you liked it and the
   next isn't in any of your lists (finished, up next, in progress, not for me). */
function nextInSeries(cat, s, entries) {
  entries = entries || seriesEntries(cat, s);
  let last = null;
  for (const [n, e] of entries) if (e.status === 'done' && (!last || n > last.n)) last = { n, e };
  if (!last || !(last.e.score >= NEXT_MIN)) return null;
  const next = wholeParts(s).find(p => p.n > last.n);
  if (!next || entries.has(next.n)) return null;
  return { s, part: next, prev: last.e, prevN: last.n, item: partItem(cat, s, next) };
}
function nextAfter(entry) {
  const w = seriesOf(entry);
  return w ? nextInSeries(w.cat, w.s) : null;
}
function nextWhy(nx) {
  return t(nx.item.cat === 'movies' ? 'Next in {series}. You gave part {n} a {score}.' : 'Next in {series}. You gave book {n} a {score}.',
    { series: serName(nx.s), n: fmt(nx.prevN), score: fmt(nx.prev.score) });
}

/* Every series you're in with a next part waiting, best-liked first. */
function seriesPicks(cat) {
  scored();
  const out = [];
  for (const c of ['books', 'movies']) {
    if ((cat !== 'all' && cat !== c) || !enabledCats().includes(c)) continue;
    const d = seriesData(c);
    if (!d) continue;
    for (const s of Object.values(d.series)) {
      const nx = nextInSeries(c, s);
      if (nx) out.push(nx);
    }
  }
  return out.sort((a, b) => b.prev.score - a.prev.score || String(b.prev.finished || b.prev.added).localeCompare(String(a.prev.finished || a.prev.added)));
}

/* The parts of a title's series, for its page. */
function seriesListHTML(it) {
  const w = seriesOf(it);
  if (!w) return '';
  const mine = seriesEntries(w.cat, w.s), C = CATS[w.cat];
  const rows = w.s.p.map(p => {
    const e = mine.get(p.n), here = p.n === w.part.n;
    const mark = e && e.status === 'done' ? `<span class="n done">${icon('check', 'sm')}</span>` : `<span class="n${here ? ' here' : ''}">${esc(fmt(p.n))}</span>`;
    const right = here ? `<span class="st here">${esc(t('this one'))}</span>`
      : e ? `<span class="st">${esc(e.status === 'done' ? fmt(e.score) : { next: t('Up next'), doing: C.doing, skip: t('Not for me') }[e.status] || '')}</span>` : '';
    return `<button class="srow${here ? ' here' : ''}" data-part="${esc(w.cat + '|' + w.s.id + '|' + p.n)}"${here ? ' disabled' : ''}>${mark}<span class="st-t">${esc(partTitle(p))}</span>${p.y ? `<span class="st-y">${p.y}</span>` : ''}${right}</button>`;
  }).join('');
  return `<div class="dt-sec"><h3>${esc(t('In this series'))} <span class="muted">· ${esc(serName(w.s))}</span></h3><div class="serlist">${rows}</div></div>`;
}

/* Opens a part from a series list: your entry for it, the catalog's title, or the part itself. */
function openPart(ref) {
  const [cat, sid, n] = ref.split('|');
  const d = seriesData(cat), s = d && d.series[sid];
  const p = s && s.p.find(x => String(x.n) === n);
  if (!p) return;
  scored();
  const e = seriesEntries(cat, s).get(p.n);
  if (e) return openEntry(e);
  openItem(partItem(cat, s, p).key);
}

/* The pop-up after you score a part you liked: the next one, to save or score. */
function nextPopup(nx) {
  const it = nx.item, C = CATS[it.cat];
  openSheet({
    title: t('Next in {series}', { series: serName(nx.s) }),
    html: `<p class="muted small" style="margin:0 0 12px">${icon('check', 'sm')} ${esc(t('You gave {title} a {score}.', { title: tt(nx.prev), score: fmt(nx.prev.score) }))}</p>
      <div class="serpop">${coverHTML(it)}<div class="body"><span class="t">${esc(tt(it))}</span>${firstBy(it) ? `<span class="a">${esc(firstBy(it))}</span>` : ''}
        <span><span class="tag lav">${esc(partLabel(it.cat, nx.s, nx.part.n, true))}</span>${it.year ? ` <span class="muted small">${it.year}</span>` : ''}</span>
        ${it.sc ? `<span class="score b${band(it.sc.pred)}">${esc(t('{score} predicted', { score: fmt(it.sc.pred) }))}</span>` : ''}</div></div>`,
    foot: `<button class="btn" data-close>${esc(t('Not now'))}</button><button class="btn" data-a="read">${esc(C.did)}</button><button class="btn primary" data-a="add">${esc(t('Add to Up next'))}</button>`,
    onMount(sh) {
      upgradeCovers(sh);
      $('.sh-foot', sh).addEventListener('click', e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'read') return rateSheet(null, entryFrom(it, 'done'), { replace: true });
        const en = entryFrom(it, 'next');
        S.items.push(en);
        closeSheet(); changed();
        toast(t('Saved to Up next'), { label: t('Undo'), fn: () => { S.items = S.items.filter(x => x.id !== en.id); changed(); } });
      });
      $('.serpop .t', sh).addEventListener('click', () => openItem(it.key));
    },
  });
}
