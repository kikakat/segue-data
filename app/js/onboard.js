/* Segue: first-run questions, settings, backups and startup. */
'use strict';

/* ---------------------------------------------------------------- onboarding
   One question per screen, answered with a tap: are you into X? A yes asks
   which kinds and a few favourites; a maybe asks only which kinds; a no moves on. */
function onboarding(opts = {}) {
  const ov = $('#onb'), P = S.prefs;
  const clone = o => JSON.parse(JSON.stringify(o || {}));
  const migrated = rated('books').length > 0 && (S.meta.fromLedger || opts.again);
  const D = { cats: clone(P.cats), likes: clone(P.likes), creators: clone(P.creators), romance: clone(P.romance), ages: bookAges(P).slice(),
    avoid: (P.avoid || []).slice(), platforms: (P.platforms || []).slice(), dislikes: clone(P.dislikes), favs: {},
    langs: (P.langs || [LANG.ui]).slice() };
  const on = c => ['yes', 'maybe'].includes(D.cats[c]);
  const seq = () => {
    const s = ['lang', 'welcome', 'langs'];
    ORDER.filter(available).forEach(c => {  // a category with no catalog yet isn't asked about
      if (migrated && c === 'books' && !opts.again) return;
      s.push('ask:' + c);
      if (on(c) && available(c)) s.push('detail:' + c);
    });
    if (ORDER.some(c => STORY.has(c) && on(c))) s.push('stories');
    s.push('done');
    return s;
  };
  let step = 'lang';
  ov.hidden = false;
  document.body.style.overflow = 'hidden';
  history.pushState({ onb: 1 }, '');
  window.__onbBack = () => { back(); history.pushState({ onb: 1 }, ''); };
  const go = s => { step = s; draw(); };
  const next = () => { const s = seq(); go(s[Math.min(s.length - 1, s.indexOf(step) + 1)]); };
  const back = () => { const s = seq(), i = s.indexOf(step); if (i > 0) go(s[i - 1]); };
  const bar = () => {
    const s = seq().filter(x => x.startsWith('ask:') || x === 'stories'), i = s.indexOf(step.replace('detail:', 'ask:'));
    const early = ['lang', 'welcome', 'langs'].includes(step);
    return `<div class="onb-top"><button class="iconbtn" data-o="back" aria-label="${esc(t('Back'))}"${step === 'lang' ? ' hidden' : ''}>${icon('back')}</button>
      <div class="dots">${early ? '' : s.map((x, k) => `<span class="${k < i ? 'on' : k === i ? 'cur' : ''}"></span>`).join('')}</div>
      <button class="skip" data-o="finish"${early || step === 'done' ? ' hidden' : ''}>${esc(t('Skip'))}</button></div>`;
  };
  function draw() {
    let h = '';
    if (step === 'lang') {
      // Asked in both languages, before anything else.
      h = `<div class="onb-step ask"><div class="logo">${icon('segue')}</div><h2>Language · Idioma</h2>
        <div class="choice stacked" id="o-ui">${[['en', 'English'], ['es', 'Español']].map(([k, l]) => `<button data-v="${k}" class="${LANG.ui === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    } else if (step === 'langs') {
      h = `<div class="onb-step detail"><h2>${esc(t('Which languages do you read, watch and play in?'))}</h2>
        <p class="sub">${esc(t("You'll only get picks available in these."))}</p>
        <div class="tagrow big" id="o-langs">${CONTENT_LANGS.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${D.langs.includes(k)}">${esc(t(l))}</button>`).join('')}</div>
        <div class="onb-acts"><button class="btn primary big" data-o="next">${esc(t('Next'))}</button></div></div>`;
    } else if (step === 'welcome') {
      const n = rated('books').length, q = entries(null, 'books').length - n;
      h = `<div class="onb-step welcome"><div class="logo">${icon('segue')}</div><h1>Segue</h1>
        <p class="tagline">${esc(t('Finished something?'))}<br>${esc(t("Here's what's next."))}</p>
        <p class="sub">${esc(t('Books, manga, shows, movies, games, board games and music, picked from how you score what you finish.'))}</p>
        ${migrated && !opts.again ? `<div class="box why"><b class="k">${esc(t('Your Reading Ledger is here'))}</b>${esc(t('{n} rated books and {q} saved. A few quick questions about everything else.', { n, q }))}</div>` : ''}
        <div class="onb-acts"><button class="btn primary big" data-o="next">${esc(t(opts.again ? 'Start' : 'Get started'))}</button>
        ${!S.items.length ? `<button class="btn ghost" data-o="seed" hidden>${esc(t('Bring in my old Reading Ledger'))}</button><label class="btn ghost">${esc(t('Restore a backup'))}<input type="file" accept="application/json,.json" id="o-file" hidden></label>` : ''}</div>
        <p class="err" id="o-err" hidden></p></div>`;
    } else if (step.startsWith('ask:')) {
      const c = step.slice(4);
      h = `<div class="onb-step ask"><div class="big-icon">${icon(CATS[c].icon)}</div><h2>${esc(CATS[c].q)}</h2>
        <div class="ynm">${[['no', 'No'], ['maybe', 'Maybe'], ['yes', 'Yes']].map(([k, l]) => `<button data-v="${k}" class="${D.cats[c] === k ? 'on' : ''}">${esc(t(l))}</button>`).join('')}</div>
        </div>`;
    } else if (step.startsWith('detail:')) {
      const c = step.slice(7), d = R.cats[c], yes = D.cats[c] === 'yes', likes = new Set(D.likes[c] || []), nos = new Set(D.dislikes[c] || []);
      const facets = d ? d.facets.slice().sort((a, b) => b[1] - a[1]).map(f => f[0]) : [];
      const favs = D.favs[c] || [], creators = D.creators[c] || [];
      const plats = c === 'games' ? `<h2>${esc(t('What do you play on?'))}</h2><p class="sub">${esc(t("Games you can't play on any of these won't show up."))}</p>
        <div class="tagrow big" id="o-plats">${PLATFORMS.map(([k, l]) => `<button class="tag" data-p="${k}" aria-pressed="${D.platforms.includes(k)}">${esc(t(l))}</button>`).join('')}</div>` : '';
      h = `<div class="onb-step detail">${plats}${plats ? `<h3>${esc(t('Which kinds of games?'))}</h3>` : `<h2>${esc(yes ? t('What kind of {many}?', { many: CATS[c].many }) : t('Which {many} might you try?', { many: CATS[c].many }))}</h2>`}
        <p class="sub">${esc(t('Tap once for more of it. Tap twice if you never want to see it.'))}</p>
        <div class="tagrow big" id="o-genres">${d ? facets.slice(0, 20).map(g => `<button class="tag${nos.has(g) ? ' no' : ''}" data-g="${esc(g)}" aria-pressed="${likes.has(g)}">${nos.has(g) ? icon('x', 'sm') + ' ' : ''}${esc(gl(g))}</button>`).join('') : `<p class="muted">${esc(t('Loading…'))}</p>`}</div>
        ${yes ? `<h3>${esc(t('A few favourites'))} <span class="muted">(${esc(t('optional'))})</span></h3>
          <div class="tagrow" id="o-favs">${favs.map((it, i) => `<button class="tag teal" data-fi="${i}">${esc(tt(it))} ${icon('x', 'sm')}</button>`).join('')}${creators.map((n, i) => `<button class="tag lav" data-ci="${i}">${esc(n)} ${icon('x', 'sm')}</button>`).join('')}</div>
          <div class="searchbox">${icon('search')}<input class="input" id="o-q" placeholder="${esc(t('A title or a name'))}" autocomplete="off"></div><div id="o-sug" class="results"></div>` : ''}
        <div class="onb-acts"><button class="btn primary big" data-o="next">${esc(t('Next'))}</button></div></div>`;
    } else if (step === 'stories') {
      h = `<div class="onb-step stories"><h2>${esc(t('Romance in stories?'))}</h2>
        <div class="choice" id="o-lead">${LEADS.map(([k, l]) => `<button data-v="${k}" class="${D.romance.lead === k ? 'on' : ''}">${esc(t(l))}</button>`).join('')}</div>
        <h3>${esc(t('Pairings you enjoy'))}</h3><div class="tagrow big" id="o-pairs">${PAIRS.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${(D.romance.pairs || []).includes(k)}">${l}</button>`).join('')}</div>
        <h3>${esc(t('Never show me'))}</h3><div class="tagrow big" id="o-avoid">${AVOIDABLE.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${D.avoid.includes(k)}">${esc(t(l))}</button>`).join('')}</div>
        ${AGED.some(on) ? `<h3>${esc(t('Made for'))}</h3><div class="tagrow big" id="o-ages">${BOOK_AGES.map(([k, l]) => `<button class="tag" data-v="${k}" aria-pressed="${D.ages.includes(k)}">${esc(t(l))}</button>`).join('')}</div>` : ''}
        <div class="onb-acts"><button class="btn primary big" data-o="next">${esc(t('Next'))}</button></div></div>`;
    } else {
      const cats = ORDER.filter(on), nf = Object.values(D.favs).reduce((t, l) => t + l.length, 0);
      h = `<div class="onb-step done"><div class="logo">${icon('check')}</div><h2>${esc(t("You're set"))}</h2>
        <p class="sub">${cats.length ? esc(cats.map(c => CATS[c].label).join(', ')) + '.' : esc(t('Nothing picked yet. You can change this in You.'))}${nf ? ' ' + esc(t('{n} favourites added.', { n: nf })) : ''}</p>
        <p class="sub">${esc(t("Every time you finish something, tap Finished and score it. That's how your picks get better."))}</p>
        <div class="onb-acts"><button class="btn primary big" data-o="finish">${esc(t('Show my picks'))}</button></div></div>`;
    }
    ov.innerHTML = bar() + `<div class="onb-body">${h}</div>`;
    ov.scrollTop = 0;
    if (step.startsWith('detail:') && !R.cats[step.slice(7)]) loadCat(step.slice(7)).then(() => { if (step.startsWith('detail:')) draw(); });
    const nextCat = seq()[seq().indexOf(step) + 1];
    if (nextCat && nextCat.startsWith('ask:') && available(nextCat.slice(4))) loadCat(nextCat.slice(4));
    if (step === 'welcome') fetchSeed().then(seed => { const b = $('[data-o="seed"]', ov); if (seed && b) b.hidden = false; });
    wire();
  }
  function wire() {
    const f = $('#o-file', ov);
    if (f) f.onchange = async () => {
      try { const d = JSON.parse(await f.files[0].text()); if (!validBackup(d)) throw new Error('bad'); importData(d); finish(true); toast(t('Backup restored')); }
      catch (err) { const x = $('#o-err', ov); x.hidden = false; x.textContent = t('That file is not a Segue or Reading Ledger backup.'); }
    };
    const q = $('#o-q', ov);
    if (q) {
      const c = step.slice(7), d = R.cats[c];
      const names = d ? [...new Set(d.items.flatMap(i => (i.by || []).slice(0, 1)))] : [];
      q.oninput = debounce(() => {
        const s = fold(q.value.trim());
        if (s.length < 2 || !d) { $('#o-sug', ov).innerHTML = ''; return; }
        const words = s.split(/\s+/);
        const titles = d.items.filter(i => { const h = fold([i.title, i.t_es, i.alt].join(' ')); return words.every(w => h.includes(w)); }).sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, 5);
        const people = names.filter(n => fold(n).includes(s)).slice(0, 3);
        $('#o-sug', ov).innerHTML = titles.map(i => `<button class="row" data-add="${esc(i.key)}">${coverHTML(i)}<div class="body"><div class="t">${esc(tt(i))}</div><div class="a">${esc([firstBy(i), i.year].filter(Boolean).join(' · '))}</div></div></button>`).join('') +
          people.map(n => `<button class="row slim" data-person="${esc(n)}">${icon('user', 'sm')} ${esc(n)}</button>`).join('');
      }, 120);
    }
  }
  ov.onclick = e => {
    const o = e.target.closest('[data-o]');
    if (o) {
      if (o.dataset.o === 'next') return next();
      if (o.dataset.o === 'back') return back();
      if (o.dataset.o === 'finish') return finish();
      if (o.dataset.o === 'seed') return fetchSeed().then(seed => { if (seed) { importData(seed, true); D.cats.books = 'yes'; D.romance = clone(S.prefs.romance); D.ages = bookAges(S.prefs).slice(); toast(t('Your ledger is here')); next(); } });
    }
    if (step === 'lang') {
      const b = e.target.closest('#o-ui [data-v]'); if (!b) return;
      setLang(b.dataset.v); S.settings.ui = b.dataset.v;
      if (D.langs.length <= 1) D.langs = [b.dataset.v];
      $$('#o-ui button', ov).forEach(x => x.classList.toggle('on', x === b));
      setTimeout(next, 160);
      return;
    }
    if (step === 'langs') {
      const b = e.target.closest('#o-langs [data-v]'); if (!b) return;
      const s = new Set(D.langs); s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v);
      if (!s.size) s.add(LANG.ui);
      D.langs = [...s];
      $$('#o-langs button', ov).forEach(x => x.setAttribute('aria-pressed', s.has(x.dataset.v)));
      return;
    }
    if (step.startsWith('ask:')) {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const c = step.slice(4);
      D.cats[c] = b.dataset.v;
      if (b.dataset.v !== 'no' && available(c)) loadCat(c);
      $$('.ynm button', ov).forEach(x => x.classList.toggle('on', x === b));
      setTimeout(next, 160);
      return;
    }
    if (step.startsWith('detail:')) {
      const c = step.slice(7);
      const pf = e.target.closest('[data-p]');
      if (pf) { const s = new Set(D.platforms); s.has(pf.dataset.p) ? s.delete(pf.dataset.p) : s.add(pf.dataset.p); D.platforms = [...s]; pf.setAttribute('aria-pressed', s.has(pf.dataset.p)); return; }
      const g = e.target.closest('[data-g]');
      if (g) {
        // Once: more of it. Twice: never show it. Three times: back to neutral.
        const k = g.dataset.g, s = new Set(D.likes[c] || []), n = new Set(D.dislikes[c] || []);
        if (s.has(k)) { s.delete(k); n.add(k); } else if (n.has(k)) n.delete(k); else s.add(k);
        D.likes[c] = [...s]; D.dislikes[c] = [...n];
        g.setAttribute('aria-pressed', s.has(k)); g.classList.toggle('no', n.has(k));
        g.innerHTML = (n.has(k) ? icon('x', 'sm') + ' ' : '') + esc(gl(k));
        return;
      }
      const add = e.target.closest('[data-add]');
      if (add) { const it = R.cats[c].items.find(i => i.key === add.dataset.add); const l = D.favs[c] = D.favs[c] || []; if (it && !l.includes(it)) l.push(it); return draw(); }
      const p = e.target.closest('[data-person]');
      if (p) { const l = D.creators[c] = D.creators[c] || []; if (!l.includes(p.dataset.person)) l.push(p.dataset.person); return draw(); }
      const fi = e.target.closest('[data-fi]'); if (fi) { D.favs[c].splice(Number(fi.dataset.fi), 1); return draw(); }
      const ci = e.target.closest('[data-ci]'); if (ci) { D.creators[c].splice(Number(ci.dataset.ci), 1); return draw(); }
    }
    if (step === 'stories') {
      const l = e.target.closest('#o-lead [data-v]');
      if (l) { D.romance.lead = l.dataset.v; $$('#o-lead button', ov).forEach(x => x.classList.toggle('on', x === l)); return; }
      const p = e.target.closest('#o-pairs [data-v]');
      if (p) { const s = new Set(D.romance.pairs || []); s.has(p.dataset.v) ? s.delete(p.dataset.v) : s.add(p.dataset.v); D.romance.pairs = [...s]; D.romance.mmOnly = false; p.setAttribute('aria-pressed', s.has(p.dataset.v)); return; }
      const a = e.target.closest('#o-avoid [data-v]');
      if (a) { const s = new Set(D.avoid); s.has(a.dataset.v) ? s.delete(a.dataset.v) : s.add(a.dataset.v); D.avoid = [...s]; a.setAttribute('aria-pressed', s.has(a.dataset.v)); return; }
      const g = e.target.closest('#o-ages [data-v]');
      if (g) {
        const s = new Set(D.ages); s.has(g.dataset.v) ? s.delete(g.dataset.v) : s.add(g.dataset.v);
        if (!s.size) s.add(g.dataset.v);  // books for someone, at least
        D.ages = BOOK_AGES.map(a => a[0]).filter(a => s.has(a));
        $$('#o-ages button', ov).forEach(x => x.setAttribute('aria-pressed', s.has(x.dataset.v)));
      }
    }
  };
  async function finish(restored) {
    if (!restored) {
      Object.assign(P, { cats: D.cats, likes: D.likes, dislikes: D.dislikes, creators: D.creators, romance: D.romance, ages: D.ages, avoid: D.avoid, platforms: D.platforms, langs: D.langs });
      for (const [c, list] of Object.entries(D.favs)) {
        for (const it of list) {
          if (S.items.some(x => sameWork(x, it))) continue;
          S.items.push(Object.assign(entryFrom(it, 'done'), { score: 9, fav: true, source: 'onboarding', finished: nowIso() }));
        }
      }
    }
    S.meta.onboarded = true;
    S.settings.ui = LANG.ui;
    save();
    window.__onbBack = null;
    ov.hidden = true; ov.innerHTML = '';
    document.body.style.overflow = '';
    history.back();
    R.scored = null; R.models = null; R.favs = null;
    R.tab = 'discover'; R.disc = { cat: 'all', mode: null, genre: '' };
    render();
    await loadEnabled();
    render();
  }
  draw();
}

/* ---------------------------------------------------------------- settings & data */
function applyTheme() {
  const th = S.settings.theme;
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme;
  const dark = th === 'dark' || (th === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#110F1C' : '#F6F4FB'));
  if (ANDROID && ANDROID.setBars) ANDROID.setBars(dark ? '#110F1C' : '#F6F4FB', dark);
}
function openSettings() {
  const st = S.settings;
  const cats = (R.index && R.index.cats) || [];
  openSheet({
    title: t('Settings'), tall: true,
    html: `<div class="settings-group"><h3>${esc(t('Appearance'))}</h3><div class="seg" id="st-theme">${[['system', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${st.theme === k}">${esc(t(l))}</button>`).join('')}</div></div>
      <div class="settings-group"><h3>${esc(t('Language'))}</h3><div class="seg" id="st-ui">${[['en', 'English'], ['es', 'Español']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${LANG.ui === k}">${l}</button>`).join('')}</div></div>
      <div class="settings-group"><h3>${esc(t('Catalogs'))}</h3>${cats.length ? `<ul class="catlist">${cats.map(c => `<li><span>${icon(CATS[c.cat].icon, 'sm')} ${esc(catName(c.cat))}</span><span class="muted">${Number(c.count).toLocaleString(LOCALE())} · ${esc(dateLabel(c.generated))}</span></li>`).join('')}</ul>` : `<p class="muted">${esc(t('No catalog yet.'))}</p>`}
        <p class="muted small">${esc(t(R.remote ? 'New picks arrive by themselves once a week, on Wi-Fi. Your data stays.' : 'New picks arrive when you run the scraper on your computer.'))}</p>
        <button class="btn block" data-a="refresh">${esc(t('Check for new catalogs'))}</button></div>
      <div class="settings-group"><h3>${esc(t('Your data'))}</h3><p class="muted small">${esc(t('Saved on this device only. Make a backup now and then, and keep it somewhere safe.'))}</p>
        <div class="stack"><button class="btn block primary" data-a="backup">${esc(t('Back up to a file'))}</button>
        <label class="btn block" style="cursor:pointer">${esc(t('Restore from a backup'))}<input type="file" accept="application/json,.json" id="st-file" hidden></label>
        <button class="btn block" data-a="csv">${esc(t('Export your scores as CSV'))}</button>
        <button class="btn block" data-a="again">${esc(t('Ask the welcome questions again'))}</button>
        <button class="btn block ghost" data-a="seed" hidden>${esc(t('Import the old Reading Ledger again'))}</button></div><p class="err" id="st-err" hidden style="margin-top:10px"></p></div>
      <div class="settings-group"><h3>${esc(t('Credits'))}</h3><p class="muted small">${cats.map(c => esc(c.credit)).join(' ')} ${esc(t('Wikidata for award lists and board game links. Spanish summaries from Wikipedia and MangaDex.'))}</p></div>`,
    onMount(sh) {
      $('#st-theme', sh).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; st.theme = b.dataset.v; save(); applyTheme(); $$('#st-theme button', sh).forEach(x => x.setAttribute('aria-pressed', x === b)); };
      $('#st-ui', sh).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; setLang(b.dataset.v); st.ui = b.dataset.v; save(); closeAllSheets(); render(); };
      fetchSeed().then(seed => { if (seed) $('[data-a="seed"]', sh).hidden = false; });
      sh.addEventListener('click', async e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'refresh') refreshCatalogs();
        if (a.dataset.a === 'backup') backup();
        if (a.dataset.a === 'csv') exportCsv();
        if (a.dataset.a === 'again') { closeAllSheets(); setTimeout(() => onboarding({ again: true }), 320); }
        if (a.dataset.a === 'seed') { const seed = await fetchSeed(); if (seed) confirmReplace(seed, 'the old ledger'); }
      });
      $('#st-file', sh).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try { const d = JSON.parse(await f.text()); if (!validBackup(d)) throw new Error('bad'); confirmReplace(d, f.name); }
        catch (err) { const x = $('#st-err', sh); x.hidden = false; x.textContent = t('That file is not a Segue or Reading Ledger backup.'); }
        e.target.value = '';
      };
    },
  });
}
async function refreshCatalogs() {
  toast(t('Checking…'));
  const r = await checkUpdates(true);
  if (!R.remote) {
    await loadIndex(true);
    await Promise.all(ORDER.filter(c => catOn(c) && available(c)).map(c => loadCat(c, true)));
    render();
    return toast(t('Catalogs checked'));
  }
  toast(t(!r.ok ? 'Could not check for updates. Check your connection.' : r.got && r.got.length ? 'New picks arrived' : 'Catalogs are up to date'));
}
function validBackup(d) { return d && (d.kind === 'segue-backup' ? Array.isArray(d.items) : Array.isArray(d.books)); }
function confirmReplace(d, name) {
  const n = d.kind === 'segue-backup' ? d.items.length : d.books.length + (d.backlog || []).length;
  openSheet({
    title: t('Replace what is on this device?'),
    html: `<p>${esc(t('This loads {n} entries from {name} and replaces your current library and Up next.', { n, name }))}</p>
      <p class="muted" style="margin-top:10px">${esc(t('Make a backup first if you want to keep what is here now.'))}</p>`,
    foot: `<button class="btn" data-close>${esc(t('Cancel'))}</button><button class="btn primary" data-a="go">${esc(t('Replace'))}</button>`,
    onMount(sh) { $('[data-a="go"]', sh).onclick = () => { importData(d); closeAllSheets(); toast(t('Loaded {n} entries', { n })); }; },
  });
}
function importData(d, keepPrefs) {
  const src = d.kind === 'segue-backup' ? merge(defaults(), d) : fromLedger(d);
  S.items = src.items; S.picks = src.picks || []; if (src.profile) S.profile = src.profile;
  if (!keepPrefs) { S.prefs = src.prefs; S.settings = src.settings; setLang(S.settings.ui || LANG.ui); }
  else if (d.kind !== 'segue-backup') { S.prefs.romance = src.prefs.romance; S.prefs.ages = bookAges(src.prefs); S.prefs.cats.books = 'yes'; }
  S.meta.imported = nowIso();
  if (d.kind === 'segue-backup') S.meta.onboarded = true;
  if (d.kind === 'reading-ledger-backup' && d.exported) S.meta.seedMerged = d.exported;
  applyTheme();
  changed();
}
window.__ledgerSaved = window.__segueSaved = ok => toast(t(ok ? 'Saved' : 'Could not save the file'));
async function download(name, text, type) {
  if (ANDROID) { ANDROID.saveFile(name, type, text); return; }  // opens Android's "Save to" picker
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function backup() {
  const d = { kind: 'segue-backup', version: 1, exported: nowIso(), items: S.items, picks: S.picks, profile: S.profile, prefs: S.prefs, settings: S.settings, meta: { created: S.meta.created } };
  S.meta.lastBackup = nowIso(); save();
  download(`segue-${today()}.json`, JSON.stringify(d, (k, v) => k.startsWith('_') ? undefined : v, 2), 'application/json');
}
function exportCsv() {
  const cell = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = rated().sort((a, b) => b.score - a.score).map(e => [CATS[e.cat].label, e.title, (e.by || []).join('; '), e.score, (e.genres || [])[0], (e.utags || []).join('; '), e.fav ? 'yes' : '', e.note].map(cell).join(','));
  download(`segue-scores-${today()}.csv`, ['Category,Title,Creator,Score,Genre,Tags,Favourite,Note'].concat(rows).join('\n'), 'text/csv');
}
/* Fills in book details (subjects, romance type, year, cover) that a newer
   seed.json has and your saved books lack. Scores, notes and tags are never touched. */
async function refreshFromSeed() {
  const seed = await fetchSeed();
  if (!seed || S.meta.seedMerged === seed.exported) return;
  const theirs = (seed.books || []).concat(seed.backlog || []);
  const byId = new Map(theirs.map(x => [x.id, x])), byTitle = new Map(theirs.map(x => [titleKey(x.title), x]));
  S.items.filter(e => e.cat === 'books').forEach(e => {
    const s = byId.get(e.id) || byTitle.get(titleKey(e.title));
    if (!s) return;
    if (s.subjects && s.subjects.length) e.tags = s.subjects;
    if (s.autoTags) e.mt = [...new Set([...(e.utags || []), ...s.autoTags])];
    if (s.romance) e.romance = s.romance;
    if (s.year && !e.year) e.year = s.year;
    if (s.olid && !e.ref) e.ref = s.olid;
    if (s.cover && !e.img) e.img = s.cover;
    if (s.coverId && !e.coverId) e.coverId = s.coverId;
    delete e._f; delete e._tf;
  });
  S.meta.seedMerged = seed.exported;
  changed();
}

/* ---------------------------------------------------------------- boot */
async function boot() {
  const stored = load();
  S = stored || defaults();
  if (stored && S.meta.fromLedger && !localStorage.getItem(KEY)) save();
  // A new install starts in the phone's language when it's Spanish.
  setLang(S.settings.ui || (/^es\b/i.test(navigator.language || '') ? 'es' : 'en'));
  if (!S.prefs.langs || !S.prefs.langs.length) S.prefs.langs = [LANG.ui];
  // "Not now" has run its three months: the title can come back.
  const now = nowIso(), n0 = S.items.length;
  S.items = S.items.filter(e => !(e.status === 'skip' && e.nope === 'later' && e.until && e.until < now));
  if (S.items.length !== n0) save();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  const h = location.hash.slice(1);
  R.tab = TITLES[h] ? h : 'discover';
  history.replaceState({ sheet: 0 }, '', '#' + R.tab);
  $$('.tab').forEach(x => x.addEventListener('click', () => setTab(x.dataset.tab)));
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-search').addEventListener('click', searchSheet);
  $('#fab').addEventListener('click', () => finishSheet());
  window.addEventListener('scroll', () => $('#appbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });
  await Promise.all([remoteConfig(), loadThemes()]);
  await loadIndex();
  if (!S.meta.onboarded) {
    if (available('books') && rated('books').length) loadCat('books');
    $('#splash').hidden = true;
    onboarding();
  } else {
    render();
    await loadEnabled();
    render();
    refreshFromSeed();
  }
  // New catalogs and new versions of the app, looked up in the background.
  checkUpdates().then(r => { if (r && r.got && r.got.length) toast(t('New picks arrived')); });
  checkAppVersion().then(v => { if (v && R.tab === 'discover') render(); });
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw\b/.test(location.search);
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !local && !ANDROID) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast(t('The app was updated'), { label: t('Reload'), fn: () => location.reload() }); });
  }
}
boot();
window.__segue = { R, get S() { return S; }, predict, explain, scored, visible, gems, pickLucky, W, setLang, t };
