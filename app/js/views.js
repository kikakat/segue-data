/* Segue: the four tabs, item details, and the finish → rate → what's next loop.
   Interface text goes through t() (js/i18n.js); titles and synopses through
   tt() and dd(), which pick the Spanish version when there is one. */
'use strict';

const TITLES = { discover: 'Discover', next: 'Up next', library: 'Library', you: 'You' };
const SORTS = [['match', 'Best match'], ['rating', 'Highest rated'], ['new', 'Newest'], ['popular', 'Most popular']];
const ANDROID = window.SegueAndroid || window.LedgerAndroid || null;
const sep = parts => parts.filter(Boolean).join(' · ');

function setTab(tab) {
  if (!TITLES[tab]) tab = 'discover';
  R.scroll[R.tab] = window.scrollY;
  R.tab = tab;
  history.replaceState(history.state, '', '#' + tab);
  render();
  window.scrollTo(0, R.scroll[tab] || 0);
}
function render() {
  if (!S) return;
  $('#splash').hidden = true;
  // Discover's title is its row of categories (when you have more than one); the gear lives in You.
  const cats = enabledCats(), tabs = R.tab === 'discover' && cats.length > 1;
  $('#title').textContent = t(TITLES[R.tab]);
  $('#title').hidden = tabs;
  $('#bar-cats').hidden = !tabs;
  $('#btn-settings').hidden = R.tab !== 'you';
  $$('.tab').forEach(x => { if (x.dataset.tab === R.tab) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
  Object.keys(TITLES).forEach(v => { $('#v-' + v).hidden = v !== R.tab; });
  $('#fab').hidden = !cats.length;
  const n = entries('doing').length;
  $('#next-badge').hidden = !n; $('#next-badge').textContent = n;
  if (R.tab === 'discover') renderDiscover();
  else if (R.tab === 'next') renderNext();
  else if (R.tab === 'library') renderLibrary();
  else renderYou();
}
function emptyHTML(title, text, btn) { return `<div class="empty"><b>${esc(title)}</b><p>${text}</p>${btn || ''}</div>`; }
function catChips(cur, cats, counts, all = true) {
  return (all ? [['all', t('All'), counts ? counts.all : null]] : []).concat(cats.map(c => [c, CATS[c].label, counts ? counts[c] : null]))
    .map(([k, l, n]) => `<button class="chip" data-cat="${k}" aria-pressed="${k === cur}">${k === 'all' ? '' : icon(CATS[k].icon, 'sm')}${esc(l)}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('');
}
/* The categories as the top row of Discover: plain words, the current one bright. */
function catTabs(cur, cats) {
  return [['all', t('All')]].concat(cats.map(c => [c, CATS[c].label]))
    .map(([k, l]) => `<button class="ctab" data-cat="${k}" aria-pressed="${k === cur}">${esc(l)}</button>`).join('');
}
function sortSelect(id, opts, cur) {
  return `<select class="select sort" id="${id}" aria-label="${esc(t('Sort'))}">${opts.map(([k, l]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${esc(t(l))}</option>`).join('')}</select>`;
}

/* ---------------------------------------------------------------- discover */
function buildDiscover() {
  const el = $('#v-discover');
  el.innerHTML = `<div id="d-body"></div>`;
  $('#bar-cats').addEventListener('click', e => {
    const c = e.target.closest('[data-cat]');
    if (c) {
      R.disc.cat = c.dataset.cat; R.disc.mode = null; R.disc.genre = ''; renderDiscover(); window.scrollTo(0, 0);
      if (!hinted('swipe')) toast(t('Tip: swipe sideways on the page to move between categories.'), { label: t('Got it'), fn: () => {} });
    }
  });
  // Swipe sideways on the page to move to the next or previous category. Not on the
  // rows that scroll sideways themselves, nor from the screen's edges (the phone's back gesture).
  let sx = null, sy = 0, st = 0;
  el.addEventListener('touchstart', e => {
    const p = e.touches[0];
    sx = e.touches.length === 1 && p.clientX > 24 && p.clientX < innerWidth - 24 && !e.target.closest('.rail, .heroes, .chips, .shortcuts') ? p.clientX : null;
    sy = p.clientY; st = e.timeStamp;
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (sx == null) return;
    const p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
    sx = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy) || e.timeStamp - st > 700 || enabledCats().length < 2) return;
    const list = ['all'].concat(enabledCats()), j = list.indexOf(R.disc.cat) + (dx < 0 ? 1 : -1);
    if (j < 0 || j >= list.length) return;
    R.disc.cat = list[j]; R.disc.mode = null; R.disc.genre = '';
    renderDiscover(); window.scrollTo(0, 0);
    const b = $('#d-body');
    b.classList.remove('slide-l', 'slide-r'); void b.offsetWidth; b.classList.add(dx < 0 ? 'slide-l' : 'slide-r');
    const on = $('#bar-cats [aria-pressed="true"]');
    if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
  el.addEventListener('click', e => {
    const g = e.target.closest('[data-genre]');
    if (g) { R.disc.genre = R.disc.genre === g.dataset.genre ? '' : g.dataset.genre; R.disc.mode = null; renderDiscover(); return; }
    const md = e.target.closest('[data-mood]');
    if (md) { R.disc.mood = R.disc.mood === md.dataset.mood ? '' : md.dataset.mood; R.disc.mode = null; renderDiscover(); window.scrollTo(0, 0); return; }
    const o = e.target.closest('[data-open]'); if (o) return openItem(o.dataset.open);
    const m = e.target.closest('[data-rail]'); if (m) { R.disc.mode = m.dataset.rail; renderDiscover(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-back]')) { R.disc.mode = null; renderDiscover(); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'lucky') openLucky(R.disc.cat);
    if (a.dataset.act === 'gems') { R.disc.mode = 'gems'; renderDiscover(); window.scrollTo(0, 0); }
    if (a.dataset.act === 'finish') finishSheet();
    if (a.dataset.act === 'quick') quickRate(a.dataset.qcat);
    if (a.dataset.act === 'you') setTab('you');
    if (a.dataset.act === 'save-gem') { const it = R.byKey.get(a.dataset.key); if (it) saveTo(it, 'next'); }
  });
  el.addEventListener('change', e => { if (e.target.id === 'd-sort') { S.settings.sort = e.target.value; save(); renderDiscover(); } });
  longPress(el, '.card[data-open], .slide[data-open]', b => quickActions(b.dataset.open));
  R.built.discover = true;
}
function cardHTML(it, mixed) {
  const p = it.sc ? it.sc.pred : null;
  return `<button class="card" data-open="${esc(it.key)}" aria-label="${esc(sep([tt(it), firstBy(it), CATS[it.cat].one, p != null ? t('predicted {score}', { score: fmt(p) }) : '']))}">
    <div class="cover-wrap">${coverHTML(it)}${p != null ? `<span class="score b${band(p)}">${fmt(p)}</span>` : ''}${mixed ? `<span class="flag">${icon(CATS[it.cat].icon)}</span>` : ''}</div>
    <div class="t">${esc(tt(it))}</div>${it._sub ? `<div class="a ser">${esc(it._sub)}</div>` : ''}</button>`;
}
/* Next parts of your series as cards: a copy of each, captioned "Book 2 of Dune". */
const seriesCards = picks => picks.map(nx => Object.assign({}, nx.item, { _sub: partLabel(nx.item.cat, nx.s, nx.part.n) }));
const hotRank = i => i.sc.pred + 1.5 * (1 - (Math.min(i.hot, 40) - 1) / 40);
function railsFor(cat, items) {
  const mixed = cat === 'all';
  const by = items.slice().sort(byMatch);
  const good = by.filter(i => i.sc.pred >= TOP_MIN);
  // Until you've scored a few in a category, its best guesses are a starting point, not top matches.
  const cold = !mixed && rated(cat).length < 3;
  const sp = seriesPicks(cat);
  const rails = [{ key: 'top', title: t(cold ? 'Good places to start' : 'Top matches for you'), items: (mixed ? mixCats(good) : good).slice(0, 60), all: mixed ? mixCats(good) : good }];
  if (sp.length > 1) rails.unshift({ key: 'series', title: t('Continue your series'), items: seriesCards(sp.slice(1)), all: seriesCards(sp), own: true });
  // Trending this week (it.hot: its place on the category's chart, 1 to 40), best for
  // you first with the week's biggest a little ahead; far from your taste, even a hit stays out.
  const hot = items.filter(i => i.hot && i.sc.pred >= 5).sort((a, b) => hotRank(b) - hotRank(a));
  if (hot.length >= 3) rails.push({ key: 'hot', title: t('Trending'), items: mixed ? mixCats(hot) : hot, own: true });
  // One row per thing you scored 9 or more: what's closest to it.
  rated().filter(e => e.score >= 9).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || b.score - a.score).slice(0, 3).forEach(e => {
    const near = closeTo(e, items);
    const list = mixed ? mixCats(near) : near;
    if (list.length >= 3) rails.push({ key: 'like:' + e.id, title: t('Because you loved {title}', { title: tt(e).replace(/\s+(trilogy|duology|series)$/i, '') }), items: list, own: true });
  });
  if (mixed) {
    enabledCats().forEach(c => {
      const list = by.filter(i => i.cat === c && i.sc.pred >= 6.5);
      if (list.length >= 3) rails.push({ key: 'cat:' + c, title: t('{cat} for you', { cat: catName(c) }), items: list, go: c });
    });
  }
  rails.push({ key: 'new', title: t(mixed ? 'New this year' : 'New releases'), items: (mixed ? mixCats : x => x)(by.filter(i => (i.year || 0) >= THIS_YEAR - 1 && i.sc.pred >= 6.5)) });
  if (!mixed) {
    const favs = favCreators();
    rails.push({ key: 'creators', title: t('From {people} you rate highly', { people: CATS[cat].people }), items: by.filter(i => (i.by || []).some(a => favs.has(cat + '|' + normName(a)))) });
    if (cat === 'games') rails.push({ key: 'short', title: t('Short games: under 10 hours'), items: by.filter(i => i.beat && i.beat <= 10) });
    if (cat === 'books') {
      if ((S.prefs.romance.pairs || []).includes('mm')) rails.push({ key: 'queer', title: t('M/M and queer'), own: true, items: by.filter(i => QUEERISH.includes(i.romance) && i.romance !== 'ff').sort((a, b) => QUEERISH.indexOf(a.romance) - QUEERISH.indexOf(b.romance) || b.sc.pred - a.sc.pred) });
      rails.push({ key: 'award', title: t('Award winners'), items: by.filter(i => (i.awards || []).some(a => a.w)) });
    }
    rails.push({ key: 'popular', title: t(rated(cat).length < 5 ? 'Popular picks to start with' : 'Most popular'), own: true, items: items.slice().sort(sorter('popular')).slice(0, 60) });
    const likes = (S.prefs.likes || {})[cat] || [];
    const facets = ((R.cats[cat] || {}).facets || []).map(f => f[0]);
    facets.slice().sort((a, b) => (likes.includes(b) ? 1 : 0) - (likes.includes(a) ? 1 : 0)).forEach(g => {
      const list = by.filter(i => (i.genres || [])[0] === g || (i.genres || []).includes(g) && likes.includes(g));
      if (list.length >= 4) rails.push({ key: 'g:' + g, title: gl(g), items: list });
    });
  }
  // Variety: two per creator or series up front, except where the creator is the point.
  return rails.filter(r => r.items.length).map(r => r.key === 'creators' || r.key === 'series' ? r : Object.assign(r, { items: spread(r.items) }));
}
/* The lead of Discover: up to five big cover cards to swipe through. The next
   part of a series you liked comes first, then your best matches (only ones
   with a cover: a card with no art has nothing to show). */
function heroPicks(cat, items, sp) {
  const out = sp.length ? [{ it: sp[0].item, kick: t('Continue your series'), why: nextWhy(sp[0]) }] : [];
  const best = items.slice().sort(byMatch), good = best.filter(i => i.sc.pred >= TOP_MIN), pool = good.length ? good : best.slice(0, 40);
  for (const it of spread(cat === 'all' ? mixCats(pool) : pool, 1)) {
    if (out.length >= 5) break;
    if (!(it.img || it.coverId) || out.some(o => o.it.key === it.key)) continue;
    out.push({ it, kick: sep([CATS[it.cat].label, it.year]), why: whyLine(it) });
  }
  return out;
}
function heroesHTML(picks) {
  if (!picks.length) return '';
  return `<div class="heroes-wrap"><div class="heroes">${picks.map(({ it, kick, why }) => `<button class="slide" data-open="${esc(it.key)}">${coverHTML(it, true)}
      <span class="s-body"><span class="kick">${icon(CATS[it.cat].icon, 'sm')} ${esc(kick)}</span><span class="s-title">${esc(tt(it))}</span>
      ${why ? `<span class="s-why">${esc(why)}</span>` : ''}
      <span class="s-meta">${it.sc ? `<span class="score b${band(it.sc.pred)}">${fmt(it.sc.pred)}</span>` : ''}<span>${esc(firstBy(it))}</span></span></span></button>`).join('')}</div>
    ${picks.length > 1 ? `<span class="s-count" id="h-count" aria-hidden="true">1 / ${picks.length}</span>` : ''}</div>`;
}
/* Round shortcuts under the top picks. A dot on Quick rate: a category has few scores yet. */
function shortcutsHTML(cat, rails) {
  const cold = coldCats().filter(c => cat === 'all' || c === cat)[0], has = k => rails.some(r => r.key === k);
  const sc = (attrs, ic, cls, label, dot) => `<button class="sc" ${attrs}><span class="ic ${cls}">${icon(ic)}${dot ? '<i class="dot"></i>' : ''}</span><span>${esc(label)}</span></button>`;
  return `<div class="shortcuts">${has('hot') ? sc('data-rail="hot"', 'trend', 'teal', t('Trending')) : ''}${sc('data-act="lucky"', 'dice', 'lav', t('Feeling lucky'))}${sc('data-act="gems"', 'gem', 'teal', t('Hidden gems'))}
    ${sc(`data-act="quick" data-qcat="${cold || (cat === 'all' ? '' : cat)}"`, 'check', 'lav', t('Quick rate'), !!cold)}
    ${has('new') ? sc('data-rail="new"', 'spark', 'teal', t('New releases')) : ''}${has('popular') ? sc('data-rail="popular"', 'star', 'lav', t('Most popular')) : ''}
    ${has('award') ? sc('data-rail="award"', 'award', 'teal', t('Award winners')) : ''}</div>`;
}
function railHTML(r, cat) {
  return `<div class="sec-h"><h2>${esc(r.title)}</h2>${r.items.length > 6 ? `<button class="more" data-rail="${esc(r.key)}">${esc(t(r.go ? 'Open' : 'See all'))} ${icon('chev', 'sm')}</button>` : ''}</div>
    <div class="rail">${r.items.slice(0, 15).map(i => cardHTML(i, cat === 'all')).join('')}</div>`;
}
function renderDiscover() {
  if (!R.built.discover) buildDiscover();
  const body = $('#d-body'), cats = enabledCats();
  if (!cats.length) {
    $('#bar-cats').innerHTML = '';
    body.innerHTML = R.err ? emptyHTML(t('No catalog yet'), esc(t('Run update.bat on your computer, then install the new app. Your data still works.')))
      : ORDER.some(c => catOn(c)) && Object.keys(R.loading).length ? `<div class="splash">${esc(t('Loading…'))}</div>`
      : emptyHTML(t('Pick what you are into'), esc(t('Choose at least one category in You.')), `<button class="btn primary" data-act="you">${esc(t('Open You'))}</button>`);
    return;
  }
  if (R.disc.cat !== 'all' && !cats.includes(R.disc.cat)) R.disc.cat = 'all';
  const cat = R.disc.cat;
  const bar = $('#bar-cats'), at = bar.scrollLeft;
  bar.innerHTML = cats.length > 1 ? catTabs(cat, cats) : '';
  bar.scrollLeft = at;
  const items = visible(cat);
  if (!items.length) { body.innerHTML = emptyHTML(t('Nothing to show'), esc(t('Your settings in You hide everything here. Loosen them a little.')), `<button class="btn primary" data-act="you">${esc(t('Open You'))}</button>`); return; }
  const sortSel = sortSelect('d-sort', SORTS, S.settings.sort);
  // One row of chips at the top: the moods (not for music), then the category's genres.
  const mood = moodsFor(cat).some(([k]) => k === R.disc.mood) ? R.disc.mood : '';
  const genreChips = (() => {
    const likes = (S.prefs.likes || {})[cat] || [];
    const fs = cat === 'all' ? [] : ((R.cats[cat] || {}).facets || []).map(f => f[0]).filter(g => items.some(i => (i.genres || []).includes(g)));
    fs.sort((a, b) => (likes.includes(b) ? 1 : 0) - (likes.includes(a) ? 1 : 0));
    const moods = moodsFor(cat).map(([k, l]) => `<button class="chip sm mood" data-mood="${k}" aria-pressed="${k === mood}">${esc(t(l))}</button>`);
    const genres = fs.map(g => `<button class="chip sm" data-genre="${esc(g)}" aria-pressed="${g === R.disc.genre}">${esc(gl(g))}</button>`);
    return moods.length || genres.length ? `<div class="chips genres">${moods.join('')}${moods.length && genres.length ? '<span class="chip-sep" aria-hidden="true"></span>' : ''}${genres.join('')}</div>` : '';
  })();
  if (R.disc.mode === 'gems') {
    const list = gems(items);
    body.innerHTML = `<button class="back" data-back>${icon('back', 'sm')} ${esc(t('Hidden gems'))}</button>
      <p class="muted lead">${esc(t('Rated highly by the people who found them, little known, and close enough to your taste to try.'))}</p>` +
      (list.length ? list.slice(0, 80).map(it => `<article class="scard">${coverHTML(it)}<div class="body"><button class="open" data-open="${esc(it.key)}"><span class="t">${esc(tt(it))}</span>
        <span class="a">${esc(sep([CATS[it.cat].label, firstBy(it), it.year]))}</span><span class="why">${esc(gemNote(it))}</span>
        ${whyLine(it) ? `<span class="why muted">${esc(whyLine(it))}</span>` : ''}</button>
        <div class="acts"><span class="score b${band(it.sc.pred)}">${fmt(it.sc.pred)}</span><button class="btn sm" data-act="save-gem" data-key="${esc(it.key)}">${esc(t('Save'))}</button></div></div></article>`).join('')
      : emptyHTML(t('No hidden gems yet'), esc(t('They show once the catalog has enough ratings from other people.'))));
    return;
  }
  if (R.disc.genre || mood) {
    let list = items.filter(i => (!R.disc.genre || (i.genres || []).includes(R.disc.genre)) && (!mood || moodOf(i, mood))).sort(sorter(S.settings.sort));
    if (cat === 'all' && S.settings.sort === 'match') list = mixCats(list);
    const count = cat === 'all' ? t('{n} picks', { n: list.length }) : `${list.length} ${list.length === 1 ? CATS[cat].one : CATS[cat].many}`;
    body.innerHTML = genreChips + (list.length ? `<div class="toolbar"><span class="count grow">${esc(count)}</span>${sortSel}</div>
      <div class="grid">${list.slice(0, 240).map(i => cardHTML(i, cat === 'all')).join('')}</div>`
      : emptyHTML(t('Nothing like that here'), esc(t('Try another mood, or another category.'))));
    upgradeCovers(body);
    return;
  }
  if (R.disc.mode) {
    const r = railsFor(cat, items).find(x => x.key === R.disc.mode);
    if (!r) { R.disc.mode = null; return renderDiscover(); }
    if (r.go) { R.disc.cat = r.go; R.disc.mode = null; return renderDiscover(); }
    const list = (r.all || r.items).slice();
    if (!r.own || S.settings.sort !== 'match') list.sort(sorter(S.settings.sort));
    body.innerHTML = `<button class="back" data-back>${icon('back', 'sm')} ${esc(r.title)}</button>
      <div class="toolbar"><span class="count grow">${esc(t('{n} picks', { n: list.length }))}</span>${sortSel}</div>
      <div class="grid">${list.slice(0, 240).map(i => cardHTML(i, cat === 'all')).join('')}</div>`;
    return;
  }
  const all = railsFor(cat, items), sp = seriesPicks(cat), picks = heroPicks(cat, items, sp);
  // "Continue your series" sits right under the top picks, which the "Top matches" row then leaves out.
  const serRail = all.find(r => r.key === 'series'), rails = all.filter(r => r !== serRail);
  const lead = new Set(picks.map(p => p.it.key)), top = rails.find(r => r.key === 'top');
  if (top) top.items = top.items.filter(i => !lead.has(i.key));
  const update = R.newApp ? `<a class="starter" href="${esc(R.newApp.url)}" target="_blank" rel="noopener">${icon('spark')}<span><b>${esc(t('A new version of Segue is ready'))}</b><small>${esc(t('Tap to download it, then open it to install over this one.'))}</small></span>${icon('chev', 'sm')}</a>` : '';
  body.innerHTML = update + genreChips + heroesHTML(picks) + shortcutsHTML(cat, all) + (serRail ? railHTML(serRail, cat) : '') +
    rails.filter(r => r.items.length).map(r => railHTML(r, cat)).join('') + catalogFoot(cat);
  upgradeCovers(body);
  // Once you've a few things in, a one-time tip about pressing and holding a cover.
  if (S.items.length >= 3 && !R.holdTip && !(S.meta.hints || {}).hold) {
    R.holdTip = setTimeout(() => { if (!stack.length && R.tab === 'discover' && !hinted('hold')) toast(t('Tip: press and hold a cover to save, score or hide it.'), { label: t('Got it'), fn: () => {} }); }, 2500);
  }
  // The counter on the top picks follows the swipe.
  const hs = $('.heroes', body), count = $('#h-count', body);
  if (hs && count) hs.addEventListener('scroll', () => { count.textContent = `${Math.round(hs.scrollLeft / hs.firstElementChild.offsetWidth) + 1} / ${hs.children.length}`; }, { passive: true });
}
function catalogFoot(cat) {
  const list = cat === 'all' ? enabledCats() : [cat];
  const parts = list.map(c => R.cats[c]).filter(Boolean).map(d => `${d.count.toLocaleString(LOCALE())} ${CATS[d.cat].many}`);
  return parts.length ? `<p class="foot">${esc(parts.join(' · '))}. ${esc(t('Predicted scores are estimates from your own ratings.'))}</p>` : '';
}

/* ---------------------------------------------------------------- feeling lucky */
function openLucky(cat) {
  const seen = new Set();
  const draw = () => {
    const it = pickLucky(cat, seen);
    if (it) seen.add(it.key);
    return it;
  };
  let it = draw();
  if (!it) return toast(t('Nothing to pick from yet. Rate a few things first.'));
  openSheet({
    title: t('Feeling lucky'), cls: 'lucky-sheet',
    html: '<div id="lk"></div>',
    foot: `<button class="btn" data-a="again">${icon('dice', 'sm')} ${esc(t('Another'))}</button><button class="btn" data-a="open">${esc(t('Details'))}</button><button class="btn primary" data-a="save">${esc(t('Save'))}</button>`,
    onMount(sh) {
      const draw1 = () => {
        const why = whyLine(it), note = it.replay ? gemNote(it) : ratingNote(it), desc = dd(it);
        $('#lk', sh).innerHTML = `<div class="lucky">${coverHTML(it, true)}<div class="lk-body"><span class="kick">${icon(CATS[it.cat].icon, 'sm')} ${esc(CATS[it.cat].label)}${it.year ? ' · ' + it.year : ''}</span>
          <h2>${esc(tt(it))}</h2><span class="by">${esc((it.by || []).join(', '))}</span>
          <span class="score b${band(it.sc.pred)}">${esc(t('{score} for you', { score: fmt(it.sc.pred) }))}</span></div></div>
          ${why ? `<div class="box why"><b class="k">${esc(t('Where it fits'))}</b>${esc(why)}</div>` : ''}${note ? `<div class="box risk"><b class="k">${esc(t('Other people'))}</b>${esc(note)}</div>` : ''}
          ${desc ? `<p class="desc clamp" style="margin-top:14px">${esc(desc)}</p>` : ''}`;
        upgradeCovers(sh);
      };
      draw1();
      $('.sh-foot', sh).addEventListener('click', e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'again') { const n = draw(); if (n) { it = n; draw1(); } else toast(t('That was the last surprise for now')); }
        if (a.dataset.a === 'open') openItem(it.key, true);
        if (a.dataset.a === 'save') { closeSheet(); saveTo(it, 'next'); }
      });
    },
  });
}

/* ---------------------------------------------------------------- details */
function linksFor(it) {
  const q = encodeURIComponent((it.title + ' ' + (it.cat === 'books' || it.cat === 'music' ? firstBy(it) : '')).trim());
  const tq = encodeURIComponent(it.title);
  const es = LANG.ui === 'es';
  const src = it.url ? [[R.cats[it.cat] ? R.cats[it.cat].source : t('Source'), it.url]] : [];
  const more = {
    books: [['Goodreads', `https://www.goodreads.com/search?q=${q}`], ['StoryGraph', `https://app.thestorygraph.com/browse?search_term=${q}`]]
      .concat(es ? [['Casa del Libro', `https://www.casadellibro.com/?query=${encodeURIComponent(tt(it))}`]] : []),
    manga: [['MyAnimeList', `https://myanimelist.net/manga.php?q=${tq}`], ['MangaUpdates', `https://www.mangaupdates.com/series?search=${tq}`]],
    tv: [['IMDb', `https://www.imdb.com/find/?q=${tq}`], [t('Where to watch'), `https://www.justwatch.com/search?q=${tq}`]],
    movies: [['IMDb', `https://www.imdb.com/find/?q=${tq}`], [t('Where to watch'), `https://www.justwatch.com/search?q=${tq}`]],
    // RAWG asks for a link back wherever its data shows (an age rating it filled in).
    games: [['Steam', it.steam ? `https://store.steampowered.com/app/${it.steam}` : `https://store.steampowered.com/search/?term=${tq}`], [t('How long to beat'), `https://howlongtobeat.com/?q=${tq}`]]
      .concat(it.rawg ? [['RAWG', `https://rawg.io/games/${encodeURIComponent(it.rawg)}`]] : []),
    boardgames: [[t('How to play'), `https://www.youtube.com/results?search_query=${tq}+${es ? 'como+se+juega' : 'how+to+play'}`]],
    music: [['Spotify', `https://open.spotify.com/search/${q}`], ['YouTube Music', `https://music.youtube.com/search?q=${q}`]]
      .concat(it.dz ? [['Deezer', `https://www.deezer.com/album/${it.dz}`]] : []),
  }[it.cat] || [];
  return src.concat(more).map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ${icon('ext', 'sm')}</a>`).join('');
}
function detailHTML(it, entry) {
  const sc = it.sc, c = it.claude || {}, C = CATS[it.cat];
  const ex = sc ? explain(sc) : { like: [], cross: [], shared: [], neg: null };
  const rate = it.rsrc === 'Steam' ? t('{pct}% positive on Steam ({n})', { pct: Math.round(it.rating * 10), n: kfmt(it.votes) })
    : it.rating && it.votes >= Math.min(C.min, 3) ? `★ ${fmt(it.rating)}/10 (${Number(it.votes).toLocaleString(LOCALE())})`
    : it.cat === 'music' && it.votes ? t('{n} listeners', { n: Number(it.votes).toLocaleString(LOCALE()) }) : '';
  const kick = sep([C.label, it.year, ln(it.len)]);
  const rom = STORY.has(it.cat) && it.romance && it.romance !== 'none' ? ROMANCE[it.romance] : null;
  const chips = [];
  if (rom) chips.push(`<span class="tag ${rom.c}">${esc(c.romanceNote || t(rom.t))}</span>`);
  if (it.romanceLed) chips.push(`<span class="tag amber">${esc(t('Romance-led'))}</span>`);
  // Games: how long they take, from IGDB players (open-ended ones say 100+).
  const hrs = h => h > 100 ? '100+' : h;
  if (it.beat) chips.push(`<span class="tag">${esc(t('{h} h to beat', { h: hrs(it.beat) }) + (it.beat100 > it.beat ? ' · ' + t('{h} h for everything', { h: hrs(it.beat100) }) : ''))}</span>`);
  if (it.tracks) chips.push(`<span class="tag">${esc(t('{n} tracks', { n: it.tracks }))}</span>`);
  if (it.hot) chips.push(`<span class="tag teal">${icon('trend', 'sm')} ${esc(t('Trending this week'))}</span>`);
  if (it.nyt) chips.push(`<span class="tag lav">${esc(t('New York Times bestseller'))}${it.nyt > 1 ? ' · ' + esc(t('{n} weeks', { n: it.nyt })) : ''}</span>`);
  // Books say who they're for; for the rest the demographic is a genre (Shounen) or the rating says it, so only For children.
  if (it.audience && it.audience !== 'adult' && (it.cat === 'books' || it.audience === 'children')) chips.push(`<span class="tag ${it.audience === 'ya' || it.audience === 'children' ? 'amber' : ''}">${esc(t(AUD[it.audience] || it.audience))}${c.audienceNote ? ' · ' + esc(c.audienceNote) : ''}</span>`);
  (it.awards || []).slice(0, 4).forEach(a => chips.push(`<span class="tag lav">${icon('award', 'sm')} ${esc(a.a)} ${esc(t(a.w ? 'winner' : 'nominee'))}${a.y ? ' ' + a.y : ''}</span>`));
  (it.genres || []).slice(0, 4).forEach(g => chips.push(`<span class="tag">${esc(gl(g))}</span>`));
  const serTag = seriesLabel(it);
  if (serTag) chips.unshift(`<span class="tag lav">${esc(serTag)}</span>`);
  else if (it.series || c.series) chips.push(`<span class="tag">${esc(c.series || it.series)}</span>`);
  if (it.weight) chips.push(`<span class="tag">${esc(t('Complexity {n}/5', { n: fmt(it.weight) }))}</span>`);
  (it.plat || []).forEach(p => { const l = (PLATFORMS.find(x => x[0] === p) || [])[1]; if (l) chips.push(`<span class="tag${(S.prefs.platforms || []).includes(p) ? ' teal' : ''}">${esc(t(l))}</span>`); });
  if (c.warn) chips.push(`<span class="tag amber">${esc(c.warn)}</span>`);
  const list = ex.like.concat(ex.cross);
  const and = ` ${t('and')} `;
  let why = '';
  if (list.length && sc.n >= 5) why = `${esc(t('Like'))} ${list.map(b => `<b>${esc(tt(b))}</b> (${b.cat !== it.cat ? esc(CATS[b.cat].one) + ', ' : ''}${fmt(b.score)})`).join(and)}` + (ex.shared.length ? `. ${esc(t('Shared'))}: ${esc(ex.shared.join(', '))}.` : '.');
  else if (sc) { const w = whyLine(it); if (w) why = esc(w) + '.'; }
  let risk = '';
  if (ex.neg) risk = esc(t('Also close to {title}, which you gave {score}.', { title: tt(ex.neg), score: fmt(ex.neg.score) }));
  if (STORY.has(it.cat)) {
    const add = s => { risk += (risk ? ' ' : '') + esc(t(s)); };
    if (it.romance === 'romance') add('It is tagged as romance, but the pairing is not listed. Check the blurb first.');
    if (it.romance === 'qromance') add('It is tagged as queer romance, but the pairing is not listed.');
    if (it.romanceLed && S.prefs.romance.lead !== 'love') add('Its tags are mostly romance, so the love story likely drives it.');
  }
  const desc = c.synopsis || dd(it);
  const englishOnly = LANG.ui === 'es' && desc && !it.d_es && !c.synopsis;
  const status = entry ? `<span class="tag teal">${esc({ next: t('Up next'), doing: C.doing, skip: t('Not for me'), done: t('status|Finished') }[entry.status])}</span>` : '';
  const pred = sc ? `<span class="score b${band(sc.pred)}">${fmt(sc.pred)}</span><span class="pl">${esc(t('predicted for you'))}<br>${esc(confLabel(sc))}${c.predicted ? ' · ' + esc(t('Claude said {score}', { score: fmt(c.predicted) })) : ''}</span>` : '';
  // Kept out of the way under "More details": the languages it's in and its raw tags (English words from the sources).
  const more = (it.langs && it.langs.length ? `<p class="muted small">${esc(it.langs.map(l => t(l === 'es' ? 'In Spanish' : 'In English')).join(' · '))}</p>` : '') +
    ((it.tags || []).length && LANG.ui !== 'es' ? `<div class="tagrow" style="margin-top:8px">${it.tags.slice(0, 14).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : '');
  // The cover across the top, then what it is, what it's called, and what you'd make of it.
  return `<div class="dt-hero">${coverHTML(it, true)}<button class="dt-x" data-close aria-label="${esc(t('Close'))}">${icon('back')}</button></div>
    <div class="dt-main">
    <div class="dt-kick">${status}${it.cert ? `<span class="cert">${esc(it.cert)}</span>` : ''}<span>${esc(kick)}</span></div>
    <h2>${esc(tt(it))}</h2>${tt(it) !== it.title ? `<div class="orig">${esc(it.title)}</div>` : ''}
    ${(it.by || []).length ? `<div class="by">${it.by.map(n => `<button class="who" data-who="${esc(n)}">${esc(n)}</button>`).join(', ')}</div>` : ''}
    ${pred || rate ? `<div class="dt-stats">${pred}${rate ? `<span class="rate">${esc(rate)}</span>` : ''}</div>` : ''}
    ${desc ? `<p class="desc clamp" id="desc">${esc(desc)}</p>${desc.length > 200 ? `<button class="btn ghost sm" data-act="more" style="padding:0;margin-top:2px">${esc(t('Read more'))}</button>` : ''}${englishOnly ? `<p class="muted small">${esc(t('in English'))}</p>` : ''}`
      : `<p class="desc muted">${esc(t('No description yet. The links below have one.'))}</p>`}
    ${c.why ? `<div class="box why"><b class="k">${esc(t('Why Claude picked it'))}</b>${esc(c.why)}</div>` : ''}
    ${why ? `<div class="box why"><b class="k">${esc(t(c.why ? 'Matches in your library' : 'Why it fits'))}</b>${why}</div>` : ''}
    ${c.risk || risk ? `<div class="box risk"><b class="k">${esc(t('Might miss'))}</b>${c.risk ? esc(c.risk) + ' ' : ''}${risk}</div>` : ''}
    ${chips.length ? `<div class="tagrow" style="margin-top:16px">${chips.join('')}</div>` : ''}
    ${entry && entry.why && entry.source === 'you' ? `<div class="dt-sec"><h3>${esc(t('Your note'))}</h3><p>${esc(entry.why)}</p></div>` : ''}
    ${seriesListHTML(it) || ((it.more || []).length ? `<div class="dt-sec"><h3>${esc(t('Also in this series'))}</h3><p>${esc(it.more.join(' · '))}</p></div>` : '')}
    ${(it.cast || []).length ? `<div class="dt-sec"><h3>${esc(t('Starring'))}</h3><p class="cast">${it.cast.map(n => `<button class="who" data-who="${esc(n)}" data-cast>${esc(n)}</button>`).join(', ')}</p></div>` : ''}
    ${streamHTML(it)}
    <div class="dt-sec"><h3>${esc(t('Look it up'))}</h3><div class="linkrow">${linksFor(it)}</div></div>
    ${more ? `<details class="more-tags dt-sec"><summary>${esc(t('More details'))}</summary>${more}</details>` : ''}
    </div>`;
}
/* Where a movie or show streams in your country; your services first, in teal. */
function streamHTML(it) {
  if (!STREAM.has(it.cat) || !it.watch) return '';
  const cc = myCountry(), mine = new Set(S.prefs.services || []);
  const here = (it.watch[cc] || []).slice().sort((a, b) => (mine.has(b) ? 1 : 0) - (mine.has(a) ? 1 : 0));
  const chips = here.map(k => { const s = serviceOf(it.cat, k) || { n: k };
    return `<span class="tag${mine.has(k) ? ' teal' : ''}">${s.logo ? `<img class="svc" src="https://image.tmdb.org/t/p/w45${esc(s.logo)}" alt="" loading="lazy">` : ''}${esc(s.n)}</span>`; }).join('');
  return `<div class="dt-sec"><h3>${esc(t('Streaming in {country}', { country: countryName(cc) }))}</h3>
    ${here.length ? `<div class="tagrow">${chips}</div>` : `<p class="muted">${esc(t('Not on a subscription or free service there right now.'))}</p>`}
    <p class="muted small" style="margin-top:6px">${esc(t('Streaming data from JustWatch.'))}</p></div>`;
}
function wireDetail(sh, cat) {
  sh.dataset.cat = cat;
  upgradeCovers(sh);
  const more = $('[data-act="more"]', sh);
  if (more) more.onclick = () => { $('#desc', sh).classList.remove('clamp'); more.remove(); };
  $('.sh-body', sh).addEventListener('click', e => {
    const p = e.target.closest('[data-part]'); if (p && !p.disabled) return openPart(p.dataset.part);
    const w = e.target.closest('[data-who]'); if (w) whoSheet(sh.dataset.cat, w.dataset.who, w.hasAttribute('data-cast'));
  });
}
/* Everything the catalog has by one author, director, studio or artist (or with
   one actor in it): yours first, then the rest, best for you first. */
function whoSheet(cat, name, cast) {
  const k = normName(name), has = x => (cast ? x.cast : x.by || []).some(a => normName(a) === k);
  scored();
  const mine = cast ? [] : S.items.filter(e => e.cat === cat && has(e));
  const M = R.models && R.models[cat] ? R.models : null;
  const rest = catItems(cat).filter(i => has(i) && !S.items.some(e => sameWork(e, i))).map(i => {
    // Later parts of a series aren't picks, so they're scored here.
    if (!R.byKey.has(i.key)) { if (M) i.sc = predict(i, M); R.byKey.set(i.key, i); }
    return i;
  }).sort((a, b) => (b.sc ? b.sc.pred : 0) - (a.sc ? a.sc.pred : 0) || (b.pop || 0) - (a.pop || 0));
  const mark = e => e.status === 'done' ? `<span class="score b${band(e.score)}">${fmt(e.score)}</span>` : `<span class="flag">${icon(e.status === 'skip' ? 'x' : 'bookmark')}</span>`;
  openSheet({
    title: name, tall: true,
    html: `<p class="muted lead">${esc(sep([CATS[cat].label, t(cast ? 'Starring' : CATS[cat].by)]))}</p>` +
      (mine.length ? `<div class="sec-h"><h2>${esc(t('Yours'))}</h2></div><div class="grid">${mine.map(e => `<button class="card" data-entry="${esc(e.id)}"><div class="cover-wrap">${coverHTML(e)}${mark(e)}</div><div class="t">${esc(tt(e))}</div></button>`).join('')}</div>` : '') +
      (rest.length ? `<div class="sec-h"><h2>${esc(t(mine.length ? 'More from them' : 'In the catalog'))}</h2></div><div class="grid">${rest.slice(0, 120).map(i => cardHTML(i)).join('')}</div>`
        : `<p class="hint">${esc(t('Nothing else by them in the catalog yet.'))}</p>`),
    onMount(sh) {
      sh.addEventListener('click', e => {
        const o = e.target.closest('[data-open]'); if (o) return openItem(o.dataset.open);
        const en = e.target.closest('[data-entry]'); if (!en) return;
        const x = S.items.find(y => y.id === en.dataset.entry); if (!x) return;
        if (x.status === 'done') rateSheet(x); else openEntry(x);
      });
      upgradeCovers(sh);
    },
  });
}
function openItem(key, replace) {
  const it = R.byKey.get(key);
  if (!it) return;
  const C = CATS[it.cat];
  openSheet({
    html: detailHTML(it), replace, cls: 'detail',
    foot: `<button class="btn" data-a="skip">${esc(t('Not for me'))}</button><button class="btn" data-a="done">${esc(C.did)}</button><button class="btn primary" data-a="next">${esc(t('Save'))}</button>`,
    onMount(sh) {
      wireDetail(sh, it.cat);
      $('.sh-foot', sh).addEventListener('click', e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'done') return rateSheet(null, entryFrom(it, 'done'), { replace: true });
        if (a.dataset.a === 'skip') return nopeSheet(it.cat, why => why === 'seen' ? rateSheet(null, entryFrom(it, 'done'), { replace: true }) : (closeSheet(), saveTo(it, 'skip', why)));
        closeSheet();
        saveTo(it, a.dataset.a);
      });
    },
  });
}
/* Press and hold a cover: save it, score it or hide it without opening its page. */
function quickActions(key) {
  const it = R.byKey.get(key);
  if (!it) return;
  const C = CATS[it.cat], p = it.sc ? it.sc.pred : null;
  openSheet({
    html: `<div class="qa-head">${coverHTML(it)}<div class="body"><b>${esc(tt(it))}</b><span>${esc(sep([C.label, firstBy(it), it.year]))}</span>
        ${p != null ? `<span class="score b${band(p)}">${fmt(p)}</span>` : ''}</div></div>
      <p class="lbl">${esc(t('{did}? Score it', { did: C.did }))}</p>
      <div class="quick">${QUICK.map(([v, l]) => `<button class="chip" data-qs="${v}">${esc(t(l))}</button>`).join('')}</div>
      <div class="qa-acts"><button class="btn" data-a="skip">${icon('x', 'sm')} ${esc(t('Not for me'))}</button><button class="btn" data-a="open">${esc(t('Details'))}</button>
        <button class="btn primary" data-a="next">${icon('bookmark', 'sm')} ${esc(t('Save'))}</button></div>`,
    onMount(sh) {
      sh.addEventListener('click', e => {
        const q = e.target.closest('[data-qs]');
        if (q) {
          const en = Object.assign(entryFrom(it, 'done'), { score: Number(q.dataset.qs), source: 'quick', finished: nowIso() });
          S.items.push(en); closeSheet(); changed();
          return toast(t('Scored {score}', { score: fmt(en.score) }), { label: t('Undo'), fn: () => { S.items = S.items.filter(x => x.id !== en.id); changed(); } });
        }
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'open') return openItem(it.key, true);
        if (a.dataset.a === 'skip') return nopeSheet(it.cat, why => why === 'seen' ? rateSheet(null, entryFrom(it, 'done'), { replace: true }) : (closeSheet(), saveTo(it, 'skip', why)));
        closeSheet(); saveTo(it, 'next');
      });
      upgradeCovers(sh);
    },
  });
}
/* The same for something in your library: a new score with a tap, or a star. */
function entryActions(entry) {
  openSheet({
    html: `<div class="qa-head">${coverHTML(entry)}<div class="body"><b>${esc(tt(entry))}</b><span>${esc(sep([CATS[entry.cat].label, firstBy(entry)]))}</span>
        <span class="score b${band(entry.score)}">${fmt(entry.score)}</span></div></div>
      <p class="lbl">${esc(t('Change your score'))}</p>
      <div class="quick">${QUICK.map(([v, l]) => `<button class="chip" data-qs="${v}" aria-pressed="${entry.score === v}">${esc(t(l))}</button>`).join('')}</div>
      <div class="qa-acts"><button class="btn" data-a="fav">${icon('star', 'sm')} ${esc(t(entry.fav ? 'Not a favourite' : 'Favourite'))}</button>
        <button class="btn primary" data-a="edit">${esc(t('Edit'))}</button></div>`,
    onMount(sh) {
      sh.addEventListener('click', e => {
        const was = { score: entry.score, fav: entry.fav };
        const undo = { label: t('Undo'), fn: () => { Object.assign(entry, was); changed(); } };
        const q = e.target.closest('[data-qs]');
        if (q) { entry.score = Number(q.dataset.qs); closeSheet(); changed(); return toast(t('Scored {score}', { score: fmt(entry.score) }), undo); }
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'edit') return rateSheet(entry, null, { replace: true });
        entry.fav = !entry.fav; closeSheet(); changed();
        toast(t(entry.fav ? 'Marked as a favourite' : 'No longer a favourite'), undo);
      });
      upgradeCovers(sh);
    },
  });
}
function entryFrom(it, status) {
  const e = {
    id: uid(), cat: it.cat, ref: it.kind === 'catalog' || it.kind === 'part' ? it.id : null, title: it.title, t_es: it.t_es, by: (it.by || []).slice(0, 2), year: it.year,
    img: it.img || null, coverId: it.coverId, tags: (it.tags || []).slice(0, 32), mt: it.mt || [], themes: themesFor(it), genres: it.genres || [],
    romance: it.romance, status, source: it.claude ? 'claude' : 'catalog', desc: it.desc || '', added: nowIso(),
  };
  if (it.ser) e.ser = it.ser.slice();  // its place in a series, so the next part can be offered
  if (it.sc) { e.predicted = it.sc.pred; const w = it.claude && it.claude.why ? it.claude.why : whyLine(it); if (w) e.why = w; }
  const w = it.kind === 'part' && seriesOf(it);
  if (w) e.why = t('Next in {series}', { series: serName(w.s) });
  return e;
}
function saveTo(it, status, why) {
  const e = entryFrom(it, status);
  if (why) setNope(e, why);
  S.items.push(e);
  changed();
  toast(t(why === 'later' ? 'Hidden for three months' : status === 'skip' ? 'Hidden from your picks' : 'Saved to Up next'), { label: t('Undo'), fn: () => { S.items = S.items.filter(x => x.id !== e.id); changed(); } });
}
/* Not for me asks why, since that decides what it teaches your picks. */
const NOPES = [['taste', 'Not my thing', 'Fewer picks like it.'], ['dropped', 'Gave up on it', 'You tried it. Counts more than Not my thing.'],
  ['seen', '', 'Score it, and it counts in full.'], ['later', 'Not now', 'Hidden for three months. Your picks stay as they are.']];
function nopeSheet(cat, onPick) {
  openSheet({
    title: t('Not for you?'), replace: true,
    html: `<div class="results">${NOPES.map(([k, l, d]) => `<button class="row" data-nope="${k}"><div class="body"><div class="t">${esc(k === 'seen' ? CATS[cat].did : t(l))}</div><div class="a">${esc(t(d))}</div></div></button>`).join('')}</div>`,
    onMount(sh) { sh.addEventListener('click', e => { const b = e.target.closest('[data-nope]'); if (b) onPick(b.dataset.nope); }); },
  });
}
function setNope(e, why) {
  e.nope = why;
  if (why === 'later') e.until = new Date(Date.now() + SNOOZE_DAYS * 864e5).toISOString(); else delete e.until;
}
/* An entry shown with whatever the catalog knows about it. */
function itemFromEntry(e) {
  const d = R.cats[e.cat];
  const m = d && ((e.ref && d.byId.get(String(e.ref))) || d.items.find(i => sameWork(e, i)));
  const it = Object.assign({}, m || {}, {
    key: 'e:' + e.id, kind: 'entry', cat: e.cat, title: e.title, t_es: e.t_es || (m && m.t_es), by: e.by && e.by.length ? e.by : (m && m.by) || [],
    year: e.year || (m && m.year), img: e.img || (m && m.img), coverId: e.coverId || (m && m.coverId),
    tags: e.tags && e.tags.length ? e.tags : (m && m.tags) || [], mt: e.mt && e.mt.length ? e.mt : (m && m.mt) || [],
    genres: e.genres && e.genres.length ? e.genres : (m && m.genres) || [], desc: e.desc || (m && m.desc) || '', id: e.ref || (m && m.id),
    romance: e.romance || (m && m.romance), themes: e.themes && e.themes.length ? e.themes : (m && m.themes) || [],
  });
  delete it._f; delete it._tf; delete it.sc;
  if (e.source === 'claude' && !it.claude && e.why) it.claude = { predicted: Number(e.predicted) || null, why: e.why };
  if (R.models && R.models[e.cat]) it.sc = predict(it, R.models);
  return it;
}

/* ---------------------------------------------------------------- finished something */
function finishSheet(cat) {
  const cats = enabledCats();
  let cur = cat && cats.includes(cat) ? cat : (R.disc.cat !== 'all' && cats.includes(R.disc.cat) ? R.disc.cat : 'all');
  openSheet({
    title: t('What did you finish?'), tall: true,
    html: `${cats.length > 1 ? `<div class="chips" id="f-cats">${catChips(cur, cats)}</div>` : ''}
      <div class="searchbox">${icon('search')}<input class="input" type="search" id="f-q" placeholder="${esc(t('Title or creator'))}" autocomplete="off" enterkeyhint="search"></div>
      <div id="f-res" class="results"></div>
      <div class="f-more"><button class="btn block" data-a="online" hidden>${icon('search', 'sm')} ${esc(t('Search Open Library'))}</button>
      <button class="btn block ghost" data-a="manual">${esc(t('Add it by hand'))}</button></div>`,
    onMount(sh) {
      const inp = $('#f-q', sh), res = $('#f-res', sh);
      const pool = () => (cur === 'all' ? cats : [cur]).flatMap(c => catItems(c));
      const draw = () => {
        const q = fold(inp.value.trim());
        $('[data-a="online"]', sh).hidden = !(cur === 'books' || (cur === 'all' && cats.includes('books'))) || q.length < 2;
        if (q.length < 2) {
          const doing = entries('doing').concat(entries('next')).filter(e => cur === 'all' || e.cat === cur).slice(0, 8);
          res.innerHTML = doing.length ? `<p class="hint">${esc(t('From your Up next'))}</p>` + doing.map(e => `<button class="row" data-entry="${esc(e.id)}">${coverHTML(e)}<div class="body"><div class="t">${esc(tt(e))}</div><div class="a">${esc(sep([CATS[e.cat].label, firstBy(e)]))}</div></div></button>`).join('')
            : `<p class="hint">${esc(t('Type a title, a creator, or both.'))}</p>`;
          return;
        }
        const words = q.split(/\s+/);
        const hits = pool().filter(i => { const h = fold([i.title, i.t_es, i.alt, (i.by || []).join(' ')].join(' ')); return words.every(w => h.includes(w)); })
          .sort((a, b) => (fold(tt(b)).startsWith(q) ? 1 : 0) - (fold(tt(a)).startsWith(q) ? 1 : 0) || (b.pop || 0) - (a.pop || 0)).slice(0, 30);
        res.innerHTML = hits.length ? hits.map(i => `<button class="row" data-key="${esc(i.key)}">${coverHTML(i)}<div class="body"><div class="t">${esc(tt(i))}</div>
          <div class="a">${esc(sep([CATS[i.cat].label, firstBy(i), i.year]))}</div></div></button>`).join('')
          : `<p class="hint">${esc(t('Not in the catalog. Try fewer words, search online, or add it by hand.'))}</p>`;
      };
      inp.addEventListener('input', debounce(draw, 120));
      const fc = $('#f-cats', sh);
      if (fc) fc.addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; cur = b.dataset.cat; fc.innerHTML = catChips(cur, cats); draw(); });
      res.addEventListener('click', e => {
        const k = e.target.closest('[data-key]');
        if (k) {
          const c = k.dataset.key.split(':')[0];
          const it = (R.byKey.get(k.dataset.key)) || catItems(c).find(i => i.key === k.dataset.key);
          const have = S.items.find(x => x.status === 'done' && sameWork(x, it));
          if (have) return rateSheet(have, null, { replace: true });
          const queued = S.items.find(x => x.status !== 'done' && sameWork(x, it));
          return rateSheet(null, entryFrom(it, 'done'), { replace: true, fromEntry: queued && queued.id });
        }
        const en = e.target.closest('[data-entry]');
        if (en) { const x = S.items.find(y => y.id === en.dataset.entry); if (x) rateSheet(null, Object.assign({}, x, { status: 'done' }), { replace: true, fromEntry: x.id }); }
      });
      sh.addEventListener('click', e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'manual') rateSheet(null, { cat: cur === 'all' ? cats[0] : cur, title: inp.value.trim(), status: 'done', source: 'you' }, { replace: true, manual: true });
        if (a.dataset.a === 'online') olSheet(inp.value.trim());
      });
      draw();
      setTimeout(() => inp.focus(), 250);
    },
  });
}
/* ---------------------------------------------------------------- quick rate */
/* "Finished any of these?": well-known titles as a deck of cards, each with one
   question: read it (seen it, played it, heard it)? Yes is a score: tap one under
   the card, or swipe right and pick it on the card. No is "Haven't read it" (or
   swipe left): nothing to do with liking it, it just isn't asked again. "Want to
   read" (or swipe up) saves it to Up next. Tap the card for the title's page. Picks
   stay near a neutral 6.8 until you've scored about 5 in a category, so this is the
   quickest way to good picks there. It's also the last step of the first run. */
const QR_MIN = 5;
const coldCats = () => enabledCats().filter(c => rated(c).length < QR_MIN);
// The question, the no and the later, in the words of what you do with it.
const QR_WORDS = {
  read: ['Read it?', "Haven't read it", 'Want to read'], watch: ['Seen it?', "Haven't seen it", 'Want to watch'],
  play: ['Played it?', "Haven't played it", 'Want to play'], listen: ['Heard it?', "Haven't heard it", 'Want to listen'],
};
const qrWords = c => QR_WORDS[{ tv: 'watch', movies: 'watch', games: 'play', boardgames: 'play', music: 'listen' }[c] || 'read'].map(x => t(x));
function quickRate(cat, opts = {}) {
  const cats = enabledCats();
  if (!cats.length) return;
  let cur = cat && cats.includes(cat) ? cat : (coldCats()[0] || cats[0]);
  const passed = new Set(S.meta.qrPass || []), answered = new Set();
  let deck = [], n = 0, last = null, sh = null, busy = false;
  // The best known first: they're the likeliest to be ones you've finished. The
  // second card peeks out from under the first.
  const next = () => {
    const list = visible(cur).filter(i => i.kind === 'catalog' && !passed.has(i.key) && !answered.has(i.key))
      .sort((a, b) => (b.pct || 0) - (a.pct || 0) || (b.pop || 0) - (a.pop || 0));
    deck = [];
    for (const i of list) { if (deck.length >= 2) break; if (!S.items.some(x => sameWork(x, i))) deck.push(i); }
  };
  // Best first on the card's "How was it?", as you'd say it.
  const scores = QUICK.slice().reverse();
  const card = (it, under) => {
    const [, no, later] = qrWords(it.cat);
    return `<div class="qcard${under ? ' under' : ''}"${under ? ' aria-hidden="true"' : ` id="qr-top" tabindex="0" aria-label="${esc(sep([tt(it), firstBy(it), it.year]))}"`}>${coverHTML(it, true)}
    <div class="q-body"><span class="q-t">${esc(tt(it))}</span><span class="q-a">${esc(sep([firstBy(it), it.year]))}</span>
    ${(it.genres || []).length ? `<span class="q-g">${esc(it.genres.slice(0, 3).map(gl).join(' · '))}</span>` : ''}</div>
    ${under ? '' : `<span class="stamp like">${esc(CATS[it.cat].did)}</span><span class="stamp nope">${esc(no)}</span><span class="stamp save">${esc(later)}</span>
      <div class="q-rate" aria-hidden="true"><b>${esc(t('How was it?'))}</b>${scores.map(([v, l]) => `<button data-qs="${v}" tabindex="-1">${esc(t(l))}<span class="score b${band(v)}">${fmt(v)}</span></button>`).join('')}
        <button class="q-back" data-qr-back tabindex="-1">${esc(t('Back'))}</button></div>`}</div>`;
  };
  const draw = () => {
    const top = deck[0], el = $('#qr-deck', sh), [q, no, later] = qrWords(cur);
    el.innerHTML = top ? (deck[1] ? card(deck[1], true) : '') + card(top) : `<p class="hint">${esc(t("That's all for now. Try another category."))}</p>`;
    $('#qr-ctl', sh).hidden = !top;
    $('#qr-q', sh).textContent = q;
    $('[data-qa="pass"] span', sh).textContent = no;
    $('[data-qa="save"] span', sh).textContent = later;
    $('#qr-n', sh).textContent = n ? t('{n} scored', { n }) + (n < QR_MIN && rated(cur).length < QR_MIN ? ' · ' + t('picks sharpen after 5') : '') : t("Swipe left if you haven't, right if you have.");
    $('#qr-undo', sh).hidden = !last;
    upgradeCovers(el);
    wire();
  };
  const answer = (kind, score) => {
    const it = deck[0]; if (!it) return;
    answered.add(it.key);
    if (kind === 'pass') { passed.add(it.key); S.meta.qrPass = [...passed].slice(-3000); last = { it, pass: true }; }
    else {
      const e = entryFrom(it, kind === 'save' ? 'next' : 'done');
      if (kind !== 'save') Object.assign(e, { score, source: 'quick', finished: nowIso() });
      S.items.push(e); last = { it, id: e.id, scored: kind !== 'save' };
      if (last.scored) n++;
    }
    save(); next(); draw();
  };
  const undo = () => {
    if (!last) return;
    if (last.pass) { passed.delete(last.it.key); S.meta.qrPass = [...passed]; }
    else { S.items = S.items.filter(x => x.id !== last.id); if (last.scored) n--; }
    answered.delete(last.it.key);
    deck = [last.it, deck[0]].filter(Boolean); last = null;
    save(); draw();
  };
  // "Yes": the card turns to its "How was it?" side; Back turns it round again.
  const askScore = on => {
    const top = $('#qr-top', sh); if (!top) return;
    top.classList.toggle('rating', on);
    $('.q-rate', top).setAttribute('aria-hidden', !on);
    $$('.q-rate button', top).forEach(b => { b.tabIndex = on ? 0 : -1; });
    top.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; top.style.transform = '';
    ['--like', '--nope', '--save'].forEach(v => top.style.setProperty(v, 0));
    if (on) $('.q-rate button', top).focus({ preventScroll: true });
  };
  // The card flies off the way it was swiped (or the button points), then the next one comes up.
  const fly = (kind, score) => {
    const top = $('#qr-top', sh); if (!top || busy) return;
    if (kind === 'read') return askScore(true);
    busy = true;
    const dir = kind === 'pass' ? 'nope' : kind === 'save' ? 'save' : 'like';
    if (kind !== 'score') top.style.setProperty('--' + dir, 1);
    const [x, y, r] = dir === 'nope' ? [-1.3, 0.1, -16] : dir === 'save' ? [0, -1.2, 0] : [1.3, 0.1, 16];
    top.style.transition = 'transform .26s ease-in, opacity .26s ease-in';
    top.style.transform = `translate(${x * innerWidth}px, ${y * innerHeight}px) rotate(${r}deg)`;
    top.style.opacity = '0';
    const under = $('.qcard.under', sh);
    if (under) { under.style.transition = 'transform .26s, opacity .26s'; under.style.setProperty('--p', 1); }
    setTimeout(() => { busy = false; answer(kind, score); }, 220);
  };
  const dirOf = (dx, dy, fast) => {
    const far = d => d > 90 || (fast && d > 35);
    if (Math.abs(dx) > Math.abs(dy)) return far(dx) ? 'read' : far(-dx) ? 'pass' : null;
    return far(-dy) ? 'save' : null;
  };
  function wire() {
    const top = $('#qr-top', sh), under = $('.qcard.under', sh); if (!top) return;
    let x0 = null, y0 = 0, dx = 0, dy = 0, moved = false, vx = 0, vy = 0, lt = 0, lx = 0, ly = 0;
    const set = () => {
      const h = Math.abs(dx) > Math.abs(dy);
      top.style.transform = `translate(${dx}px, ${Math.min(dy, 40)}px) rotate(${dx / 18}deg)`;
      top.style.setProperty('--like', h ? Math.max(0, Math.min(1, dx / 100)) : 0);
      top.style.setProperty('--nope', h ? Math.max(0, Math.min(1, -dx / 100)) : 0);
      top.style.setProperty('--save', h ? 0 : Math.max(0, Math.min(1, -dy / 100)));
      if (under) under.style.setProperty('--p', Math.min(1, Math.hypot(dx, dy) / 140));
    };
    top.addEventListener('pointerdown', e => {
      // On the "How was it?" side the card holds still: it's buttons now.
      if (busy || e.button > 0 || top.classList.contains('rating')) return;
      x0 = lx = e.clientX; y0 = ly = e.clientY; lt = e.timeStamp; dx = dy = vx = vy = 0; moved = false;
      top.classList.remove('demo'); top.style.transition = 'none'; if (under) under.style.transition = 'none';
      top.setPointerCapture(e.pointerId);
    });
    top.addEventListener('pointermove', e => {
      if (x0 == null) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      const dt = Math.max(1, e.timeStamp - lt);
      vx = (e.clientX - lx) / dt; vy = (e.clientY - ly) / dt; lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      if (moved) set();
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null;
      if (!moved) return openItem(deck[0].key);
      const d = dirOf(dx, dy, Math.hypot(vx, vy) > 0.5);
      if (d) return fly(d);
      top.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)';
      dx = dy = 0; set(); top.style.transform = '';
      if (under) under.style.transition = 'transform .25s, opacity .25s';
    };
    top.addEventListener('pointerup', end);
    top.addEventListener('pointercancel', () => { moved = true; dx = dy = 0; end(); });
    // Once: the card leans right and left, to show it moves.
    if (!hinted('qr')) top.classList.add('demo');
  }
  // Back from the title's page: if it was saved or scored there, it's done here too.
  const onPop = () => { if (deck[0] && stack.length && stack[stack.length - 1].sh === sh && S.items.some(x => sameWork(x, deck[0]))) { answered.add(deck[0].key); next(); draw(); } };
  window.addEventListener('popstate', onPop);
  openSheet({
    title: t(opts.title || 'Finished any of these?'), tall: true, cls: 'qr',
    html: `${cats.length > 1 ? `<div class="chips" id="qr-cats">${catChips(cur, cats, null, false)}</div>` : ''}<div class="deck" id="qr-deck"></div>
      <p class="qr-n"><span id="qr-n"></span> <button class="link" id="qr-undo" hidden>${esc(t('Undo'))}</button></p>
      <div id="qr-ctl"><p class="qr-q"><b id="qr-q"></b> ${esc(t('How was it?'))}</p>
      <div class="quick qr-scores">${QUICK.map(([v, l]) => `<button class="chip" data-qs="${v}">${esc(t(l))}</button>`).join('')}</div>
      <div class="qr-acts"><button class="btn" data-qa="pass">${icon('next', 'sm')}<span></span></button>
        <button class="btn" data-qa="save">${icon('bookmark', 'sm')}<span></span></button></div></div>`,
    // In the first run it's the last step, so it says where it leads.
    foot: opts.first ? `<button class="btn primary block" data-close>${esc(t('Show my picks'))}</button>` : undefined,
    onClose: () => { window.removeEventListener('popstate', onPop); if (n || last) changed(); if (opts.onClose) opts.onClose(n); },
    onMount(s) {
      sh = s;
      sh.addEventListener('click', e => {
        const c = e.target.closest('#qr-cats [data-cat]');
        if (c) { cur = c.dataset.cat; $('#qr-cats', sh).innerHTML = catChips(cur, cats, null, false); next(); draw(); return; }
        if (e.target.closest('[data-qr-back]')) return askScore(false);
        const q = e.target.closest('[data-qs]'); if (q && deck[0]) return fly('score', Number(q.dataset.qs));
        const a = e.target.closest('[data-qa]'); if (a && deck[0]) return fly(a.dataset.qa);
        if (e.target.closest('#qr-undo')) undo();
      });
      sh.addEventListener('keydown', e => {
        if (e.target.closest('input,textarea,select')) return;
        const k = { ArrowRight: 'read', ArrowLeft: 'pass', ArrowUp: 'save' }[e.key];
        if (k && deck[0]) { e.preventDefault(); fly(k); }
      });
      next(); draw();
    },
  });
}
/* One-time hints for gestures you can't see (a swipe, a press and hold). Returns
   whether this one was shown before, and marks it as shown. */
function hinted(key) {
  const h = S.meta.hints = S.meta.hints || {};
  if (h[key]) return true;
  h[key] = nowIso(); save();
  return false;
}
/* Open Library search, for books the catalog doesn't have. */
async function olSearch(q, signal) {
  const u = 'https://openlibrary.org/search.json?' + new URLSearchParams({ q, limit: '14', lang: LANG.ui, fields: 'key,title,author_name,first_publish_year,cover_i,subject,language' });
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return ((await r.json()).docs || []).filter(d => !d.language || d.language.includes('eng') || d.language.includes('spa'));
}
function entryFromDoc(d) {
  const subj = d.subject || [];
  return { id: uid(), cat: 'books', ref: String(d.key || '').split('/').pop(), title: cleanTitle(d.title), by: [(d.author_name || [])[0]].filter(Boolean),
    year: d.first_publish_year, coverId: d.cover_i, img: null, tags: normSubjects(subj), mt: mapTags(subj), genres: [guessGenre(subj)].filter(Boolean),
    romance: romanceClass(subj), status: 'done', source: 'you', added: nowIso() };
}
function olSheet(q0, onPick) {
  let ctl = null, docs = [];
  openSheet({
    title: t('Search Open Library'), tall: true,
    html: `<div class="searchbox">${icon('search')}<input class="input" type="search" id="s-q" value="${esc(q0 || '')}" placeholder="${esc(t('Title and author'))}" autocomplete="off" enterkeyhint="search"></div><div id="s-res" class="results"></div>`,
    onMount(sh) {
      const res = $('#s-res', sh), inp = $('#s-q', sh);
      const run = debounce(async () => {
        const q = inp.value.trim();
        if (ctl) ctl.abort();
        if (q.length < 2) { res.innerHTML = `<p class="hint">${esc(t('Type a title, an author, or both.'))}</p>`; return; }
        ctl = new AbortController();
        res.innerHTML = `<p class="hint">${esc(t('Searching Open Library…'))}</p>`;
        try {
          docs = await olSearch(q, ctl.signal);
          res.innerHTML = docs.length ? docs.map((d, i) => `<button class="row" data-i="${i}">${coverHTML({ title: d.title, coverId: d.cover_i })}<div class="body">
            <div class="t">${esc(cleanTitle(d.title))}</div><div class="a">${esc((d.author_name || []).slice(0, 2).join(', '))}</div><div class="m">${esc(d.first_publish_year || '')}</div></div></button>`).join('')
            : `<p class="hint">${esc(t('Nothing found. Try fewer words.'))}</p>`;
        } catch (e) { if (e.name !== 'AbortError') res.innerHTML = `<p class="hint">${esc(t('Could not reach Open Library. Check your connection, or add it by hand.'))}</p>`; }
      }, 350);
      inp.addEventListener('input', run);
      res.addEventListener('click', e => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        const en = entryFromDoc(docs[Number(b.dataset.i)]);
        if (onPick) return onPick(en);
        rateSheet(null, en, { replace: true });
      });
      run();
    },
  });
}

/* Score sheet: rate something you finished, or edit a library entry. */
const QUICK = [[4, 'Meh'], [6, 'OK'], [7.5, 'Good'], [8.5, 'Great'], [10, 'Loved it']];
function rateSheet(entry, prefill, opts = {}) {
  const isNew = !entry;
  const cur = Object.assign({ title: '', by: [], score: 8, note: '', fav: false, utags: [], genres: [] }, entry || prefill || {});
  const C = CATS[cur.cat] || CATS.books;
  const tags = new Set(cur.utags || []);
  const manual = opts.manual || (entry && entry.source === 'you' && !entry.ref);
  const usedTags = () => { const s = new Set(); S.items.forEach(e => e.cat === cur.cat && (e.utags || []).forEach(x => s.add(x))); return [...s]; };
  openSheet({
    title: t(isNew ? 'How was it?' : 'Edit'), tall: true, replace: opts.replace,
    html: `<div class="rate-head">${coverHTML(cur)}<div class="body">
        ${manual ? `<div class="field"><label for="r-title">${esc(t('Title'))}</label><input class="input" id="r-title" value="${esc(cur.title)}" autocomplete="off"></div>
          <div class="two"><div class="field"><label for="r-by">${esc(C.by)}</label><input class="input" id="r-by" value="${esc(firstBy(cur))}" autocomplete="off"></div>
          <div class="field"><label for="r-cat">${esc(t('Category'))}</label><select class="select" id="r-cat">${enabledCats().concat(cur.cat && !enabledCats().includes(cur.cat) ? [cur.cat] : []).map(c => `<option value="${c}"${c === cur.cat ? ' selected' : ''}>${esc(catName(c))}</option>`).join('')}</select></div></div>`
          : `<h3>${esc(tt(cur))}</h3><div class="a">${esc(sep([C.label, firstBy(cur), cur.year]))}</div>`}
        ${cur.cat === 'books' && manual ? `<button class="btn sm" id="r-find" type="button" style="margin-top:4px">${icon('search', 'sm')} ${esc(t('Find cover and details'))}</button>` : ''}</div></div>
      <div class="field"><span class="lbl">${esc(t('Your score'))}</span><div class="scorepick"><button class="stepper" type="button" data-step="-0.5" aria-label="${esc(t('Lower score'))}">−</button>
        <input type="range" id="r-score" min="1" max="10" step="0.5" value="${cur.score}" aria-label="${esc(t('Score out of 10'))}"><button class="stepper" type="button" data-step="0.5" aria-label="${esc(t('Raise score'))}">+</button>
        <span class="score b${band(cur.score)}" id="r-score-v">${fmt(cur.score)}</span></div>
        <div class="quick">${QUICK.map(([v, l]) => `<button type="button" class="chip sm" data-q="${v}">${esc(t(l))}</button>`).join('')}</div></div>
      <div class="switch"><div><div class="sw-t">${esc(t('Favourite'))}</div><div class="sw-d">${esc(t('Something you measure others against. Counts more in your picks.'))}</div></div><label class="toggle"><input type="checkbox" id="r-fav"${cur.fav ? ' checked' : ''} aria-label="${esc(t('Favourite'))}"><span></span></label></div>
      <details class="more-tags"${tags.size ? ' open' : ''}><summary>${esc(t('Tags'))}</summary><div class="tagrow" id="r-tags"></div>
        <input class="input" id="r-newtag" placeholder="${esc(t('New tag, then press Enter'))}" style="margin-top:8px" autocomplete="off" enterkeyhint="done"></details>
      <div class="field" style="margin-top:14px"><label for="r-note">${esc(t('Why this score'))} <span class="muted">(${esc(t('optional'))})</span></label><textarea class="input" id="r-note" rows="3">${esc(cur.note || '')}</textarea></div>
      <p class="err" id="r-err" hidden></p>`,
    foot: (isNew ? '' : `<button class="btn danger" data-a="del" style="flex:0 0 auto">${esc(t('Delete'))}</button>`) + `<button class="btn" data-close>${esc(t('Cancel'))}</button><button class="btn primary" data-a="save">${esc(t('Save'))}</button>`,
    onMount(sh) {
      const sv = $('#r-score', sh), out = $('#r-score-v', sh);
      const setScore = v => { v = Math.max(1, Math.min(10, round2(v))); sv.value = v; out.textContent = fmt(v); out.className = 'score b' + band(v); };
      sv.addEventListener('input', () => setScore(Number(sv.value)));
      $$('[data-step]', sh).forEach(b => b.addEventListener('click', () => setScore(Number(sv.value) + Number(b.dataset.step))));
      $$('[data-q]', sh).forEach(b => b.addEventListener('click', () => setScore(Number(b.dataset.q))));
      const drawTags = () => {
        const el = $('#r-tags', sh); if (!el) return;
        const all = [...new Set(TAGS_FOR(cur.cat).concat(usedTags(), [...tags]))].sort();
        el.innerHTML = all.map(x => `<button type="button" class="tag" data-t="${esc(x)}" aria-pressed="${tags.has(x)}">${esc(t(x))}</button>`).join('');
      };
      drawTags();
      const tg = $('#r-tags', sh);
      if (tg) tg.addEventListener('click', e => { const x = e.target.closest('[data-t]'); if (!x) return; tags.has(x.dataset.t) ? tags.delete(x.dataset.t) : tags.add(x.dataset.t); drawTags(); });
      const nt = $('#r-newtag', sh);
      if (nt) nt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim().toLowerCase(); if (v) { tags.add(v); e.target.value = ''; drawTags(); } } });
      const find = $('#r-find', sh);
      if (find) find.onclick = () => olSheet(($('#r-title', sh).value + ' ' + $('#r-by', sh).value).trim(), en => {
        Object.assign(cur, { ref: en.ref, coverId: en.coverId, img: null, tags: en.tags, mt: en.mt, year: en.year, romance: en.romance, genres: cur.genres.length ? cur.genres : en.genres });
        if (!$('#r-title', sh).value.trim()) $('#r-title', sh).value = en.title;
        if (!$('#r-by', sh).value.trim()) $('#r-by', sh).value = firstBy(en);
        $('.rate-head .cover', sh).outerHTML = coverHTML(cur);
        closeSheet(); toast(t('Cover and details added'));
      });
      let sure = false;
      $('.sh-foot', sh).addEventListener('click', e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'del') {
          if (!sure) { sure = true; a.textContent = t('Tap again'); return; }
          const keep = S.items.slice();
          S.items = S.items.filter(x => x.id !== entry.id);
          closeSheet(); changed();
          toast(t('Deleted'), { label: t('Undo'), fn: () => { S.items = keep; changed(); } });
          return;
        }
        const title = manual ? $('#r-title', sh).value.trim() : cur.title, err = $('#r-err', sh);
        if (!title) { err.hidden = false; err.textContent = t('Add a title first.'); return; }
        const cat = manual ? $('#r-cat', sh).value : cur.cat, by = manual ? [$('#r-by', sh).value.trim()].filter(Boolean) : cur.by;
        const what = Object.assign({}, cur, { cat, title, by, status: 'done' });
        if (isNew && S.items.some(x => x.status === 'done' && x.id !== opts.fromEntry && sameWork(x, what))) { err.hidden = false; err.textContent = t('That is already in your library.'); return; }
        if (nt && nt.value.trim()) tags.add(nt.value.trim().toLowerCase());
        const data = Object.assign(what, {
          score: Number(sv.value),
          note: $('#r-note', sh).value.trim(), fav: $('#r-fav', sh).checked, utags: [...tags], finished: cur.finished || nowIso(),
        });
        if (cat === 'books') data.mt = [...new Set([...(data.mt || []).filter(x => !(cur.utags || []).includes(x)), ...tags])];
        delete data._f; delete data._tf;
        if (isNew) {
          data.id = opts.fromEntry || data.id || uid();
          S.items = S.items.filter(x => x.id !== opts.fromEntry && !(x.status !== 'done' && sameWork(x, data)));
          S.items.push(data);
        } else S.items = S.items.map(x => x.id === entry.id ? data : x);
        save(); R.scored = null; R.favs = null; R.models = null;
        if (isNew) afterRate(data); else { closeAllSheets(); toast(t('Saved')); }
        render();
      });
    },
  });
}

/* What's next, right after you score something. */
function afterRate(entry) {
  scored();
  const same = closeTo(entry, visible(entry.cat), { min: 7 });
  const sameTop = (same.length ? same : visible(entry.cat).sort(byMatch)).slice(0, 2);
  const others = enabledCats().filter(c => c !== entry.cat);
  const diffPool = others.length ? closeTo(entry, others.flatMap(c => visible(c)), { min: 7 }) : [];
  const diff = (diffPool.length ? diffPool : others.flatMap(c => visible(c)).sort(byMatch)).filter(i => !sameTop.includes(i)).slice(0, 1);
  const lucky = pickLucky('all', new Set(sameTop.concat(diff).map(i => i.key)));
  const card = (it, label) => it ? `<article class="scard">${coverHTML(it)}<div class="body"><span class="kick">${esc(label)}</span><button class="open" data-open="${esc(it.key)}"><span class="t">${esc(tt(it))}</span>
    <span class="a">${esc(sep([CATS[it.cat].label, firstBy(it)]))}</span>${whyLine(it) ? `<span class="why">${esc(whyLine(it))}</span>` : ''}</button>
    <div class="acts"><span class="score b${band(it.sc.pred)}">${fmt(it.sc.pred)}</span><button class="btn sm primary" data-save="${esc(it.key)}">${esc(t('Save'))}</button></div></div></article>` : '';
  const low = entry.score < 6, vars = { title: tt(entry), score: fmt(entry.score) };
  openSheet({
    title: t("What's next"), tall: true, replace: true,
    html: `<p class="lead">${esc(low ? t("Noted: {title} got a {score}. You'll see fewer picks like it.", vars) : t("You gave {title} a {score}. Here's where to go from there.", vars))}</p>
      ${sameTop.map((it, i) => card(it, i === 0 ? (low ? t('Better {many} for you', { many: CATS[entry.cat].many }) : t('More like it')) : t('Also close'))).join('')}
      ${diff.map(it => card(it, t('Try a {one}', { one: CATS[it.cat].one }))).join('')}
      ${card(lucky, t('Wildcard'))}`,
    foot: `<button class="btn" data-a="another">${esc(t('Finished another'))}</button><button class="btn primary" data-a="done">${esc(t('Done'))}</button>`,
    onMount(sh) {
      sh.addEventListener('click', e => {
        const s = e.target.closest('[data-save]');
        if (s) { const it = R.byKey.get(s.dataset.save); if (it) { S.items.push(entryFrom(it, 'next')); save(); R.scored = null; s.textContent = t('Saved'); s.disabled = true; s.classList.remove('primary'); render(); } return; }
        const o = e.target.closest('[data-open]'); if (o) return openItem(o.dataset.open);
        if (e.target.closest('[data-a="another"]')) finishSheet(entry.cat);
        // Scoring the next part from the series pop-up stacks a sheet per part: Done closes them all.
        if (e.target.closest('[data-a="done"]')) closeAllSheets();
      });
      upgradeCovers(sh);
    },
  });
  // Liked a part of a series? The next one, on top (close it to see the picks above).
  const nx = entry.score >= NEXT_MIN && nextAfter(entry);
  if (nx) nextPopup(nx);
}

/* ---------------------------------------------------------------- up next */
const NEXT_TABS = [['next', 'Up next'], ['doing', 'In progress'], ['skip', 'Not for me']];
function buildNext() {
  const el = $('#v-next');
  el.innerHTML = `<div class="seg tabs" id="n-seg" role="toolbar"></div><div class="chips" id="n-cats"></div><div id="n-body"></div>`;
  el.addEventListener('click', e => {
    const s = e.target.closest('[data-s]'); if (s) { R.next.status = s.dataset.s; renderNext(); return; }
    const c = e.target.closest('[data-cat]'); if (c) { R.next.cat = c.dataset.cat; renderNext(); return; }
    if (e.target.closest('[data-act="discover"]')) return setTab('discover');
    const card = e.target.closest('[data-entry]'); if (!card) return;
    const entry = S.items.find(x => x.id === card.dataset.entry); if (!entry) return;
    const a = e.target.closest('[data-na]');
    if (a) return nextAction(entry, a.dataset.na);
    openEntry(entry);
  });
  R.built.next = true;
}
function nextButtons(e) {
  const C = CATS[e.cat];
  // One button a row; the rest (Start, Not for me, Remove) are on the title's page.
  if (e.status === 'doing') return [['done', t('action|Finished'), 'primary']];
  if (e.status === 'next') return [['done', C.did, 'primary']];
  return [['restore', t('Restore'), '']];
}
function renderNext() {
  if (!R.built.next) buildNext();
  const st = R.next.status;
  $('#n-seg').innerHTML = NEXT_TABS.map(([k, l]) => `<button data-s="${k}" aria-pressed="${k === st}">${esc(t(l))}<span class="n">${entries(k).length}</span></button>`).join('');
  const all = entries(st), cats = ORDER.filter(c => all.some(e => e.cat === c));
  if (R.next.cat !== 'all' && !cats.includes(R.next.cat)) R.next.cat = 'all';
  const counts = { all: all.length }; cats.forEach(c => counts[c] = all.filter(e => e.cat === c).length);
  $('#n-cats').innerHTML = cats.length > 1 ? catChips(R.next.cat, cats, counts) : '';
  const list = all.filter(e => R.next.cat === 'all' || e.cat === R.next.cat);
  const body = $('#n-body');
  if (!list.length) {
    const msg = { next: ['Nothing saved yet', 'Tap Save on anything in Discover and it waits here.'], doing: ['Nothing in progress', 'Start something from Up next.'], skip: ['Nothing hidden', 'What you mark Not for me stays here and out of your picks.'] }[st];
    body.innerHTML = emptyHTML(t(msg[0]), esc(t(msg[1])), st === 'next' ? `<button class="btn primary" data-act="discover">${esc(t('Find something'))}</button>` : '');
    return;
  }
  scored();
  const pred = e => { const it = itemFromEntry(e); return it.sc ? it.sc.pred : e.predicted; };
  const rows = list.map(e => ({ e, p: pred(e) })).sort((a, b) => st === 'next' ? (b.p || 0) - (a.p || 0) : String(b.e.added).localeCompare(String(a.e.added)));
  const why = e => st === 'skip' && e.nope === 'later' && e.until ? t('Not now: back {date}', { date: dateLabel(e.until) }) : st === 'skip' && e.nope === 'dropped' ? t('Gave up on it') : e.why;
  body.innerHTML = (st === 'skip' ? `<p class="muted lead">${esc(t('These stay out of Discover. Not now ones come back after three months.'))}</p>` : '') + rows.map(({ e, p }) => `<article class="scard${st === 'skip' ? ' passed' : ''}" data-entry="${esc(e.id)}">${coverHTML(e)}<div class="body">
    <button class="open"><span class="t">${esc(tt(e))}</span><span class="a">${esc(sep([CATS[e.cat].label, firstBy(e)]))}</span>${why(e) ? `<span class="why">${esc(why(e))}</span>` : ''}</button>
    <div class="acts">${p ? `<span class="score b${band(p)}" title="${esc(t('Predicted'))}">${fmt(p)}</span>` : ''}${nextButtons(e).map(([a, l, c]) => `<button class="btn sm ${c}" data-na="${a}">${esc(l)}</button>`).join('')}</div></div></article>`).join('');
}
function nextAction(entry, act, why) {
  const prev = entry.status, was = { nope: entry.nope, until: entry.until };
  if (act === 'done') return rateSheet(null, Object.assign({}, entry, { status: 'done' }), { fromEntry: entry.id, replace: stack.length > 0 });
  if (act === 'remove') { const keep = S.items.slice(); S.items = S.items.filter(x => x.id !== entry.id); changed(); return toast(t('Removed'), { label: t('Undo'), fn: () => { S.items = keep; changed(); } }); }
  entry.status = { start: 'doing', restore: 'next', skip: 'skip', next: 'next' }[act] || entry.status;
  if (entry.status === 'skip') setNope(entry, why || 'taste'); else { delete entry.nope; delete entry.until; }
  changed();
  toast(t(entry.status === 'doing' ? 'Moved to In progress' : why === 'later' ? 'Hidden for three months' : entry.status === 'skip' ? 'Hidden from your picks' : 'Moved to Up next'),
    { label: t('Undo'), fn: () => { entry.status = prev; Object.assign(entry, was); if (!was.nope) delete entry.nope; if (!was.until) delete entry.until; changed(); } });
}
function openEntry(entry) {
  const it = itemFromEntry(entry), C = CATS[entry.cat];
  const acts = { doing: [['skip', t('Not for me'), ''], ['next', t('Back to Up next'), ''], ['done', t('action|Finished'), 'teal']],
    next: [['skip', t('Not for me'), ''], ['done', C.did, ''], ['start', t('Start'), 'primary']],
    skip: [['remove', t('Remove'), 'danger'], ['restore', t('Restore'), 'primary']] }[entry.status] || [];
  openSheet({
    html: detailHTML(it, entry), cls: 'detail',
    foot: acts.map(([a, l, c]) => `<button class="btn ${c}" data-a="${a}">${esc(l)}</button>`).join(''),
    onMount(sh) {
      wireDetail(sh, entry.cat);
      $('.sh-foot', sh).addEventListener('click', e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'done') return nextAction(entry, 'done');
        if (a.dataset.a === 'skip') return nopeSheet(entry.cat, why => why === 'seen' ? nextAction(entry, 'done') : (closeSheet(), nextAction(entry, 'skip', why)));
        closeSheet(); nextAction(entry, a.dataset.a);
      });
    },
  });
}

/* ---------------------------------------------------------------- library */
const LIB_SORTS = [['score', 'Top scored'], ['added', 'Recently finished'], ['title', 'Title A–Z'], ['low', 'Lowest scored']];
function buildLibrary() {
  const el = $('#v-library');
  el.innerHTML = `<div class="chips" id="l-cats"></div><div class="searchbox">${icon('search')}<input class="input" type="search" id="l-q" autocomplete="off"></div>
    <div id="l-body"></div>`;
  $('#l-q', el).addEventListener('input', debounce(e => { R.lib.q = e.target.value; renderLibrary(); }, 120));
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (c) { R.lib.cat = c.dataset.cat; renderLibrary(); return; }
    const b = e.target.closest('[data-entry]'); if (b) { const en = S.items.find(x => x.id === b.dataset.entry); if (en) rateSheet(en); return; }
    if (e.target.closest('[data-act="add"]')) finishSheet();
    if (e.target.closest('[data-act="quick"]')) quickRate(R.lib.cat === 'all' ? null : R.lib.cat);
  });
  el.addEventListener('change', e => { if (e.target.id === 'l-sort') { R.lib.sort = e.target.value; renderLibrary(); } });
  longPress(el, '.card[data-entry]', b => { const en = S.items.find(x => x.id === b.dataset.entry); if (en) entryActions(en); });
  R.built.library = true;
}
function renderLibrary() {
  if (!R.built.library) buildLibrary();
  $('#l-q').placeholder = t('Search your library');
  const done = rated(), cats = ORDER.filter(c => done.some(e => e.cat === c));
  if (R.lib.cat !== 'all' && !cats.includes(R.lib.cat)) R.lib.cat = 'all';
  const counts = { all: done.length }; cats.forEach(c => counts[c] = done.filter(e => e.cat === c).length);
  $('#l-cats').innerHTML = cats.length > 1 ? catChips(R.lib.cat, cats, counts) : '';
  const body = $('#l-body');
  if (!done.length) { body.innerHTML = emptyHTML(t('Nothing here yet'), esc(t('Score what you finish. Every score sharpens your picks.')), `<button class="btn" data-act="quick">${esc(t('Quick rate'))}</button> <button class="btn primary" data-act="add">${esc(t('Add something'))}</button>`); return; }
  const q = fold(R.lib.q.trim());
  const list = done.filter(e => (R.lib.cat === 'all' || e.cat === R.lib.cat) && (!q || fold([e.title, e.t_es, (e.by || []).join(' '), e.note, (e.genres || []).join(' '), (e.utags || []).join(' ')].join(' ')).includes(q)));
  const by = { score: (a, b) => b.score - a.score, low: (a, b) => a.score - b.score, title: (a, b) => normTitle(tt(a)).localeCompare(normTitle(tt(b))), added: (a, b) => String(b.finished || b.added).localeCompare(String(a.finished || a.added)) };
  list.sort((a, b) => by[R.lib.sort](a, b) || normTitle(tt(a)).localeCompare(normTitle(tt(b))));
  const mark = e => e.fav ? `<span class="flag fav" title="${esc(t('Favourite'))}">${icon('star')}</span>` : R.lib.cat === 'all' && cats.length > 1 ? `<span class="flag">${icon(CATS[e.cat].icon)}</span>` : '';
  body.innerHTML = `<div class="toolbar"><span class="count grow">${esc(t('{n} finished', { n: list.length }))}</span><button class="btn sm" data-act="quick">${esc(t('Quick rate'))}</button>${sortSelect('l-sort', LIB_SORTS, R.lib.sort)}</div>` +
    (list.length ? `<div class="grid">` + list.map(e => `<button class="card" data-entry="${esc(e.id)}" aria-label="${esc(sep([tt(e), firstBy(e), fmt(e.score)]))}">
      <div class="cover-wrap">${coverHTML(e)}<span class="score b${band(e.score)}">${fmt(e.score)}</span>${mark(e)}</div>
      <div class="t">${esc(tt(e))}</div></button>`).join('') + '</div>' : emptyHTML(t('No matches'), esc(t('Clear the search to see more.'))));
}

/* ---------------------------------------------------------------- you */
function groupAvg(list, keyFn) {
  const m = new Map();
  list.forEach(b => keyFn(b).forEach(k => { const o = m.get(k) || { sum: 0, n: 0, t: [] }; o.sum += b.score; o.n++; o.t.push(tt(b)); m.set(k, o); }));
  return [...m].map(([k, o]) => ({ k, avg: o.sum / o.n, n: o.n, t: o.t })).sort((a, b) => b.avg - a.avg || b.n - a.n);
}
function hrows(rows) {
  if (!rows.length) return `<p class="muted">${esc(t('Not enough yet.'))}</p>`;
  return rows.map(r => `<div class="hrow" title="${esc(r.t.join(', '))}"><span class="nm">${esc(r.k)}</span><span class="track"><span class="fill" style="width:${(r.avg * 10).toFixed(1)}%;background:var(--c${band(r.avg)})"></span></span><span class="vl">${r.avg.toFixed(1)} · ${r.n}</span></div>`).join('');
}
function drivers() {
  const lib = rated();
  if (lib.length < 4) return null;
  const mu = avg(lib.map(b => b.score)), m = new Map();
  lib.forEach(b => {
    const ks = new Set([...feats(b, true).keys()].filter(k => !k.startsWith('a:') && !k.startsWith('s:')).concat(themesFor(b).map(x => 't:' + x)));
    ks.forEach(k => { const o = m.get(k) || { d: 0, n: 0, t: [] }; o.d += b.score - mu; o.n++; o.t.push(tt(b)); m.set(k, o); });
  });
  const rows = [...m].filter(([, o]) => o.n >= 2).map(([k, o]) => ({ k: featLabel(k), e: o.d / (o.n + 1), n: o.n, t: o.t }));
  const uniq = arr => { const s = new Set(); return arr.filter(r => !s.has(r.k) && s.add(r.k)); };
  return { up: uniq(rows.filter(r => r.e > 0.15).sort((a, b) => b.e - a.e)).slice(0, 7), down: uniq(rows.filter(r => r.e < -0.15).sort((a, b) => a.e - b.e)).slice(0, 7) };
}
const LEADS = [['love', 'Love it'], ['ok', "It's fine"], ['background', 'Background only'], ['avoid', 'Rather not']];
const PAIRS = [['mf', 'M/F'], ['mm', 'M/M'], ['ff', 'F/F']];
const CONTENT_LANGS = [['en', 'English'], ['es', 'Spanish']];
function renderYou() {
  const el = $('#v-you'), P = S.prefs;
  const done = rated(), sc = done.map(b => b.score);
  const tile = (k, v) => `<div class="tile"><div class="k">${esc(t(k))}</div><div class="v">${v}</div></div>`;
  let html = `<div class="tiles">${tile('tile|Finished', done.length)}${tile('Average score', done.length ? avg(sc).toFixed(1) : '–')}${tile('Loved (9+)', sc.filter(x => x >= 9).length)}${tile('Up next', entries('next').length + entries('doing').length)}</div>`;
  html += `<section class="panel"><h2>${esc(t('Language'))}</h2>
    <span class="lbl">${esc(t('App language'))}</span><div class="seg" id="y-ui">${[['en', 'English'], ['es', 'Español']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${LANG.ui === k}">${l}</button>`).join('')}</div>
    <span class="lbl">${esc(t('Show me things available in'))}</span><div class="tagrow big" id="y-langs">${CONTENT_LANGS.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${(P.langs || []).includes(k)}">${esc(t(l))}</button>`).join('')}</div></section>`;
  html += `<section class="panel"><h2>${esc(t("What you're into"))}</h2><p class="cap">${esc(t('Yes and Maybe show up in Discover. Maybe gets fewer surprise picks.'))}</p>
    ${ORDER.filter(available).map(c => `<div class="catrow"><span class="nm">${icon(CATS[c].icon)} ${esc(catName(c))}</span>
      <div class="seg mini" data-catpref="${c}">${[['no', 'No'], ['maybe', 'Maybe'], ['yes', 'Yes']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${(P.cats[c] || 'no') === k}">${esc(t(l))}</button>`).join('')}</div>
      ${catOn(c) && available(c) ? `<button class="more" data-prefs="${c}">${esc(((P.likes || {})[c] || []).slice(0, 3).map(gl).join(', ') || t('Pick genres'))} ${icon('chev', 'sm')}</button>` : ''}</div>`).join('')}</section>`;
  if ([...STREAM].some(c => catOn(c)) && watchCountries().length) {
    const cc = myCountry(), mine = new Set(P.services || []);
    const svcs = servicesIn(cc).filter(([k], i) => i < 16 || mine.has(k));  // the 16 with most titles, plus yours
    html += `<section class="panel"><h2>${esc(t('Streaming'))}</h2>
      <span class="lbl">${esc(t('Country'))}</span><select class="select" id="y-country">${watchCountries().map(k => `<option value="${k}"${k === cc ? ' selected' : ''}>${esc(countryName(k))}</option>`).join('')}</select>
      <span class="lbl" style="margin-top:12px">${esc(t('Your services'))}</span><div class="tagrow big" id="y-svc">${svcs.map(([k, s]) => `<button class="tag" data-v="${esc(k)}" aria-pressed="${mine.has(k)}">${esc(s.n)}</button>`).join('')}</div>
      <p class="cap" style="margin-top:6px">${esc(t('Pick yours, and movies and shows on none of them are left out of your picks. Pick none to see everything.'))}</p></section>`;
  }
  if (ORDER.some(c => STORY.has(c) && catOn(c))) {
    html += `<section class="panel"><h2>${esc(t('Stories'))}</h2><p class="cap">${esc(t('For books, manga, shows, movies and games.'))}</p>
      <span class="lbl">${esc(t('Romance'))}</span><div class="seg" id="y-lead">${LEADS.map(([k, l]) => `<button data-v="${k}" aria-pressed="${P.romance.lead === k}">${esc(t(l))}</button>`).join('')}</div>
      <span class="lbl">${esc(t('Pairings you enjoy as the main romance'))}</span><div class="tagrow" id="y-pairs" style="margin-bottom:6px">${PAIRS.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${(P.romance.pairs || []).includes(k)}">${l}</button>`).join('')}</div>
      <div class="switch"><div><div class="sw-t">${esc(t('Hide romance with no pairing listed'))}</div><div class="sw-d">${esc(t('Many tags just say "romance". Off shows them, marked in amber.'))}</div></div><label class="toggle"><input type="checkbox" id="y-strict"${P.romance.strict ? ' checked' : ''}><span></span></label></div>
      ${AGED.some(catOn) ? `<span class="lbl" style="margin-top:12px">${esc(t('Made for'))}</span><div class="tagrow big" id="y-ages">${BOOK_AGES.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${bookAges(P).includes(k)}">${esc(t(l))}</button>`).join('')}</div>
        <p class="cap" style="margin:6px 0 10px">${esc(t('Things made for others are left out of your picks, unless by a creator you rate 8+. Games and music have no labels.'))}</p>` : ''}
      <div class="switch"><div><div class="sw-t">${esc(t('Hide low-rated picks'))}</div><div class="sw-d">${esc(t('Rated under 6/10 (3/5) by enough people.'))}</div></div><label class="toggle"><input type="checkbox" id="y-rating"${P.minRating ? ' checked' : ''}><span></span></label></div>
      <span class="lbl" style="margin-top:12px">${esc(t('Never show me'))}</span><div class="tagrow" id="y-avoid">${AVOIDABLE.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${(P.avoid || []).includes(k)}">${esc(t(l))}</button>`).join('')}</div></section>`;
  }
  const p = S.profile;
  html += `<section class="panel"><div class="sec-h" style="margin:0"><h2>${esc(t('Your taste in words'))}</h2><button class="more" data-act="edit-profile">${esc(t('Edit'))}</button></div>` +
    (p && p.summary ? `<p class="cap">${p.updatedAt ? esc(t('Written {date}', { date: dateLabel(p.updatedAt) })) : ''}</p>${String(p.summary).split(/\n\s*\n/).map(x => `<p>${esc(x)}</p>`).join('')}
      <div class="cols"><div><h3>${esc(t('Reach for'))}</h3><ul>${(p.likes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h3>${esc(t('Steer away from'))}</h3><ul>${(p.avoid || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`
      : `<p class="cap">${esc(t('A few lines about what you like. Just for you.'))}</p>`) + '</section>';
  if (done.length) {
    const dv = drivers();
    if (dv && (dv.up.length || dv.down.length)) {
      const li = r => `<div class="hrow" title="${esc(r.t.join(', '))}"><span class="nm">${esc(r.k)}</span><span class="track"><span class="fill" style="width:${Math.min(100, Math.abs(r.e) * 45).toFixed(0)}%;background:${r.e > 0 ? 'var(--c5)' : 'var(--c1)'}"></span></span><span class="vl">${r.e > 0 ? '+' : '−'}${Math.abs(r.e).toFixed(1)}</span></div>`;
      const none = `<p class="muted">${esc(t('Nothing clear yet.'))}</p>`;
      html += `<section class="panel"><h2>${esc(t('What moves your scores'))}</h2><p class="cap">${esc(t('Traits shared by two or more things you finished, and how far they pull a score from your average of {avg}.', { avg: avg(sc).toFixed(1) }))}</p>
        <div class="drv"><div class="up"><h3>${esc(t('Lifts it'))}</h3>${dv.up.map(li).join('') || none}</div><div class="down"><h3>${esc(t('Holds it back'))}</h3>${dv.down.map(li).join('') || none}</div></div></section>`;
    }
    const lo = Math.min(4, Math.floor(Math.min(...sc))), counts = []; let mx = 1;
    for (let v = lo; v <= 10; v += 0.5) { const c = sc.filter(x => x === v).length; counts.push({ v, c }); mx = Math.max(mx, c); }
    html += `<section class="panel"><h2>${esc(t('How you score'))}</h2><p class="cap">${esc(t('Finished things per score, in half points.'))}</p><div class="hist">` + counts.map(o => {
      const names = done.filter(b => b.score === o.v).map(b => tt(b));
      return `<div class="hcol" title="${esc(fmt(o.v) + (names.length ? ': ' + names.join(', ') : ''))}">${o.c ? `<span class="hn">${o.c}</span>` : ''}<div class="hbar" style="height:${o.c ? Math.max(8, o.c / mx * 112) : 3}px;background:${o.c ? `var(--c${band(o.v)})` : 'var(--line)'}"></div><span class="hl">${Number.isInteger(o.v) ? o.v : ''}</span></div>`;
    }).join('') + '</div></section>';
    if (new Set(done.map(e => e.cat)).size > 1) html += `<section class="panel"><h2>${esc(t('By category'))}</h2><p class="cap">${esc(t('Average score and how many.'))}</p>${hrows(groupAvg(done, b => [CATS[b.cat].label]))}</section>`;
    html += `<section class="panel"><h2>${esc(t('By genre'))}</h2><p class="cap">${esc(t('Average score and how many.'))}</p>${hrows(groupAvg(done, b => (b.genres || []).slice(0, 1).map(gl)))}</section>`;
  }
  el.innerHTML = html;
  wireYou(el);
}
function wireYou(el) {
  const P = S.prefs;
  el.onclick = async e => {
    const ui = e.target.closest('#y-ui [data-v]');
    if (ui) { setLang(ui.dataset.v); S.settings.ui = ui.dataset.v; save(); R.scored = null; render(); return; }
    const lg = e.target.closest('#y-langs [data-v]');
    if (lg) { const s = new Set(P.langs || []); s.has(lg.dataset.v) ? s.delete(lg.dataset.v) : s.add(lg.dataset.v); if (!s.size) s.add(LANG.ui); P.langs = [...s]; changed(); return; }
    const cp = e.target.closest('[data-catpref] [data-v]');
    if (cp) {
      const c = cp.parentElement.dataset.catpref, v = cp.dataset.v;
      P.cats[c] = v; save();
      if (v !== 'no') { await loadCat(c); if (v === 'yes' && !((P.likes || {})[c] || []).length) prefsSheet(c); }
      changed(); return;
    }
    const pr = e.target.closest('[data-prefs]'); if (pr) return prefsSheet(pr.dataset.prefs);
    const ld = e.target.closest('#y-lead [data-v]'); if (ld) { P.romance.lead = ld.dataset.v; changed(); return; }
    const pa = e.target.closest('#y-pairs [data-v]');
    if (pa) { const s = new Set(P.romance.pairs || []); s.has(pa.dataset.v) ? s.delete(pa.dataset.v) : s.add(pa.dataset.v); P.romance.pairs = [...s]; P.romance.mmOnly = false; changed(); return; }
    const sv = e.target.closest('#y-svc [data-v]');
    if (sv) { const s = new Set(P.services || []); s.has(sv.dataset.v) ? s.delete(sv.dataset.v) : s.add(sv.dataset.v); P.services = [...s]; changed(); return; }
    const ag = e.target.closest('#y-ages [data-v]');
    if (ag) { const s = new Set(bookAges(P)); s.has(ag.dataset.v) ? s.delete(ag.dataset.v) : s.add(ag.dataset.v); if (!s.size) s.add(ag.dataset.v); P.ages = BOOK_AGES.map(a => a[0]).filter(a => s.has(a)); changed(); return; }
    const av = e.target.closest('#y-avoid [data-v]');
    if (av) { const s = new Set(P.avoid || []); s.has(av.dataset.v) ? s.delete(av.dataset.v) : s.add(av.dataset.v); P.avoid = [...s]; changed(); return; }
    if (e.target.closest('[data-act="edit-profile"]')) profileSheet();
  };
  el.onchange = e => {
    if (e.target.id === 'y-strict') { P.romance.strict = e.target.checked; changed(); }
    if (e.target.id === 'y-rating') { P.minRating = e.target.checked; changed(); }
    if (e.target.id === 'y-country') {
      // Services that country doesn't have would hide everything: they go.
      const offered = new Set(servicesIn(e.target.value).map(s => s[0]));
      P.country = e.target.value; P.services = (P.services || []).filter(k => offered.has(k)); changed();
    }
  };
}
/* Genres for one category: tap once to like, again to hide, again to clear. */
function decadeLabel(c, k) {
  if (k === 'pre') return t('Before {year}', { year: YEAR_FLOOR[c] });
  const d = Number(k);
  return LANG.ui === 'es' ? `Años ${d < 2000 ? String(d).slice(2) : d}` : `${d}s`;
}
function prefsSheet(c) {
  const P = S.prefs, likes = new Set((P.likes || {})[c] || []), dis = new Set((P.dislikes || {})[c] || []);
  const yrs = new Set((P.years || {})[c] || []);
  const creators = ((P.creators || {})[c] || []).slice();
  const plats = new Set(P.platforms || []);
  openSheet({
    title: catName(c), tall: true,
    html: `${c === 'games' ? `<span class="lbl">${esc(t('What you play on'))}</span><div class="tagrow big" id="p-plats" style="margin-bottom:18px">${PLATFORMS.map(([k, l]) => `<button class="tag" data-p="${k}" aria-pressed="${plats.has(k)}">${esc(t(l))}</button>`).join('')}</div>` : ''}
      <p class="muted lead">${esc(t('Tap a genre once for more of it, twice to never see it, again to clear.'))}</p><div class="tagrow big" id="p-genres"></div>
      <div class="field" id="p-yfield" style="margin-top:20px"><span class="lbl">${esc(t('Years'))}</span>
        <p class="muted small" style="margin:0 0 8px">${esc(t('Tap a decade to hide it from your picks.'))}</p>
        <div class="tagrow big" id="p-years"></div><p class="small" id="p-ysum" style="margin:8px 0 0;color:var(--teal-ink)"></p></div>
      <div class="field" style="margin-top:20px"><span class="lbl">${esc(t('{people} you love', { people: cap(CATS[c].people) }))}</span>
        <div class="tagrow" id="p-creators"></div><div class="searchbox" style="margin-top:8px">${icon('search')}<input class="input" id="p-cq" placeholder="${esc(t('Add a name'))}" autocomplete="off"></div><div id="p-csug" class="results"></div></div>`,
    foot: `<button class="btn primary block" data-close>${esc(t('Done'))}</button>`,
    onClose() {
      P.likes[c] = [...likes]; P.dislikes[c] = [...dis]; P.creators[c] = creators; if (c === 'games') P.platforms = [...plats];
      P.years = P.years || {}; P.years[c] = [...yrs];
      changed();
    },
    onMount(sh) {
      const pp = $('#p-plats', sh);
      if (pp) pp.onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; plats.has(b.dataset.p) ? plats.delete(b.dataset.p) : plats.add(b.dataset.p); b.setAttribute('aria-pressed', plats.has(b.dataset.p)); };
      const d = R.cats[c];
      const facets = d ? d.facets.map(f => f[0]) : [];
      const drawG = () => { $('#p-genres', sh).innerHTML = facets.map(g => `<button class="tag${dis.has(g) ? ' no' : ''}" data-g="${esc(g)}" aria-pressed="${likes.has(g)}">${dis.has(g) ? icon('x', 'sm') : ''}${esc(gl(g))}</button>`).join('') || `<p class="muted">${esc(t('Genres appear once this catalog is loaded.'))}</p>`; };
      const drawC = () => { $('#p-creators', sh).innerHTML = creators.map((n, i) => `<button class="tag lav" data-ci="${i}">${esc(n)} ${icon('x', 'sm')}</button>`).join(''); };
      // Decade chips: what each decade holds among the things you could be shown (your languages,
      // platforms and genre rules apply; the year rule doesn't, so a hidden decade still shows its count).
      const pool = (() => { try { const s = scored().filter(i => i.cat === c && passesRules(i, true)); if (s.length) return s; } catch (e) { /* catalog not scored yet */ } return d ? d.items : []; })();
      const counts = {};
      pool.forEach(i => { const k = decadeKey(c, i.year); if (k) counts[k] = (counts[k] || 0) + 1; });
      const decs = Object.keys(counts).sort((a, b) => (a === 'pre' ? -1 : b === 'pre' ? 1 : a - b));
      const nf = n => n.toLocaleString(LOCALE());
      const drawY = () => {
        $('#p-yfield', sh).hidden = !decs.length;
        $('#p-years', sh).innerHTML = decs.map(k => {
          const off = yrs.has(k), l = decadeLabel(c, k);
          return `<button class="tag${off ? ' no' : ''}" data-y="${k}" aria-label="${esc(l + ': ' + t(off ? 'hidden' : 'shown'))}">${off ? icon('x', 'sm') : ''}${esc(l)}<span class="cnt">${nf(counts[k])}</span></button>`;
        }).join('');
        const shown = pool.filter(i => !yrs.has(decadeKey(c, i.year))).length;
        $('#p-ysum', sh).textContent = yrs.size ? t('Showing {n} of {total} {many}', { n: nf(shown), total: nf(pool.length), many: CATS[c].many }) : '';
      };
      drawG(); drawC(); drawY();
      $('#p-years', sh).onclick = e => {
        const b = e.target.closest('[data-y]'); if (!b) return;
        yrs.has(b.dataset.y) ? yrs.delete(b.dataset.y) : yrs.add(b.dataset.y);
        drawY();
      };
      $('#p-genres', sh).onclick = e => {
        const b = e.target.closest('[data-g]'); if (!b) return;
        const g = b.dataset.g;
        if (likes.has(g)) { likes.delete(g); dis.add(g); } else if (dis.has(g)) dis.delete(g); else likes.add(g);
        drawG();
      };
      $('#p-creators', sh).onclick = e => { const b = e.target.closest('[data-ci]'); if (b) { creators.splice(Number(b.dataset.ci), 1); drawC(); } };
      const names = d ? [...new Set(d.items.flatMap(i => i.by || []))] : [];
      $('#p-cq', sh).oninput = debounce(e => {
        const q = fold(e.target.value.trim());
        $('#p-csug', sh).innerHTML = q.length < 2 ? '' : names.filter(n => fold(n).includes(q)).slice(0, 6).map(n => `<button class="row slim" data-n="${esc(n)}">${esc(n)}</button>`).join('');
      }, 120);
      $('#p-csug', sh).onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; if (!creators.includes(b.dataset.n)) creators.push(b.dataset.n); $('#p-cq', sh).value = ''; $('#p-csug', sh).innerHTML = ''; drawC(); };
    },
  });
}
function profileSheet() {
  const p = S.profile || { summary: '', likes: [], avoid: [] };
  openSheet({
    title: t('Your taste in words'), tall: true,
    html: `<div class="field"><label for="p-sum">${esc(t('Summary'))}</label><textarea class="input" id="p-sum" rows="8">${esc(p.summary || '')}</textarea></div>
      <div class="field"><label for="p-likes">${esc(t('Reach for, one per line'))}</label><textarea class="input" id="p-likes" rows="5">${esc((p.likes || []).join('\n'))}</textarea></div>
      <div class="field"><label for="p-avoid">${esc(t('Steer away from, one per line'))}</label><textarea class="input" id="p-avoid" rows="5">${esc((p.avoid || []).join('\n'))}</textarea></div>`,
    foot: `<button class="btn" data-close>${esc(t('Cancel'))}</button><button class="btn primary" data-a="save">${esc(t('Save'))}</button>`,
    onMount(sh) {
      $('[data-a="save"]', sh).onclick = () => {
        const lines = id => $(id, sh).value.split('\n').map(x => x.trim()).filter(Boolean);
        S.profile = { summary: $('#p-sum', sh).value.trim(), likes: lines('#p-likes'), avoid: lines('#p-avoid'), updatedAt: nowIso() };
        closeSheet(); changed(); toast(t('Saved'));
      };
    },
  });
}

/* ---------------------------------------------------------------- search */
function searchSheet() {
  openSheet({
    title: t('Search'), tall: true,
    html: `<div class="searchbox">${icon('search')}<input class="input" type="search" id="q-q" placeholder="${esc(t('Titles, creators, tags'))}" autocomplete="off" enterkeyhint="search"></div><div id="q-res" class="results"></div>`,
    onMount(sh) {
      const inp = $('#q-q', sh), res = $('#q-res', sh);
      inp.addEventListener('input', debounce(() => {
        const q = fold(inp.value.trim());
        if (q.length < 2) { res.innerHTML = ''; return; }
        const words = q.split(/\s+/);
        const hits = visible('all').filter(i => { const h = fold([i.title, i.t_es, i.alt, (i.by || []).join(' '), (i.genres || []).map(gl).join(' '), (i.tags || []).slice(0, 12).join(' ')].join(' ')); return words.every(w => h.includes(w)); })
          .sort((a, b) => (fold(tt(b)).includes(q) ? 1 : 0) - (fold(tt(a)).includes(q) ? 1 : 0) || byMatch(a, b)).slice(0, 60);
        res.innerHTML = hits.length ? hits.map(i => `<button class="row" data-open="${esc(i.key)}">${coverHTML(i)}<div class="body"><div class="t">${esc(tt(i))}</div>
          <div class="a">${esc(sep([CATS[i.cat].label, firstBy(i), i.year]))}</div></div><span class="score b${band(i.sc.pred)}">${fmt(i.sc.pred)}</span></button>`).join('')
          : `<p class="hint">${esc(t('No matches among your picks.'))}</p>`;
      }, 150));
      res.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) openItem(o.dataset.open); });
      setTimeout(() => inp.focus(), 250);
    },
  });
}
