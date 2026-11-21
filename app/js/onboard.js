/* Segue: first-run questions, settings, backups and startup. */
'use strict';

/* ---------------------------------------------------------------- onboarding
   Three steps: the app's language, what you're into (one screen of categories),
   then a deck of well-known titles to swipe through (Quick rate), so the first
   picks are already yours. Everything else (genres, romance, who things are made
   for, platforms, the languages you read and watch in) starts from defaults and
   is in You. */
function onboarding(opts = {}) {
  const ov = $('#onb'), P = S.prefs;
  const migrated = rated('books').length > 0 && (S.meta.fromLedger || opts.again);
  const D = { cats: JSON.parse(JSON.stringify(P.cats || {})), langs: (P.langs || [LANG.ui]).slice() };
  const on = c => ['yes', 'maybe'].includes(D.cats[c]);
  let step = 'lang';
  ov.hidden = false;
  document.body.style.overflow = 'hidden';
  history.pushState({ onb: 1 }, '');
  window.__onbBack = () => { if (step === 'cats') go('lang'); history.pushState({ onb: 1 }, ''); };
  const go = s => { step = s; draw(); };
  // Three dots: language, categories, then the deck (which opens once the catalogs are in).
  const bar = () => `<div class="onb-top"><button class="iconbtn" data-o="back" aria-label="${esc(t('Back'))}"${step === 'lang' ? ' hidden' : ''}>${icon('back')}</button>
    <div class="dots">${[0, 1, 2].map(k => `<span class="${k < (step === 'lang' ? 0 : 1) ? 'on' : k === (step === 'lang' ? 0 : 1) ? 'cur' : ''}"></span>`).join('')}</div><span class="iconbtn" aria-hidden="true"></span></div>`;
  function draw() {
    let h = '';
    if (step === 'lang') {
      // Asked in both languages, before anything else.
      h = `<div class="onb-step ask"><div class="logo">${icon('segue')}</div><h2>Language · Idioma</h2>
        <div class="choice stacked" id="o-ui">${[['en', 'English'], ['es', 'Español']].map(([k, l]) => `<button data-v="${k}" class="${LANG.ui === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    } else {
      const cats = ORDER.filter(available), any = cats.some(on), n = rated('books').length, q = entries(null, 'books').length - n;
      h = `<div class="onb-step cats"><p class="tagline">${esc(t('Finished something?'))} ${esc(t("Here's what's next."))}</p>
        <h2>${esc(t('What are you into?'))}</h2><p class="sub">${esc(t('Pick as many as you like. You can change it any time in You.'))}</p>
        ${migrated && !opts.again ? `<div class="box why"><b class="k">${esc(t('Your Reading Ledger is here'))}</b>${esc(t('{n} rated books and {q} saved.', { n, q }))}</div>` : ''}
        <div class="ctiles" id="o-cats">${cats.map(c => `<button class="ctile" data-c="${c}" aria-pressed="${on(c)}">${icon(CATS[c].icon)}<span>${esc(catName(c))}</span></button>`).join('')}</div>
        <div class="onb-acts"><button class="btn primary big" data-o="finish"${any ? '' : ' disabled'}>${esc(t(any ? 'Next' : 'Pick at least one'))}</button>
        ${!S.items.length ? `<button class="btn ghost" data-o="seed" hidden>${esc(t('Bring in my old Reading Ledger'))}</button><label class="btn ghost">${esc(t('Restore a backup'))}<input type="file" accept="application/json,.json" id="o-file" hidden></label>` : ''}</div>
        <p class="err" id="o-err" hidden></p></div>`;
    }
    ov.innerHTML = bar() + `<div class="onb-body">${h}</div>`;
    ov.scrollTop = 0;
    if (step === 'cats') fetchSeed().then(seed => { const b = $('[data-o="seed"]', ov); if (seed && b) b.hidden = false; });
    const f = $('#o-file', ov);
    if (f) f.onchange = async () => {
      try { const d = JSON.parse(await f.files[0].text()); if (!validBackup(d)) throw new Error('bad'); importData(d); finish(true); toast(t('Backup restored')); }
      catch (err) { const x = $('#o-err', ov); x.hidden = false; x.textContent = t('That file is not a Segue or Reading Ledger backup.'); }
    };
  }
  ov.onclick = e => {
    const o = e.target.closest('[data-o]');
    if (o) {
      if (o.dataset.o === 'back') return go('lang');
      if (o.dataset.o === 'finish') return finish();
      if (o.dataset.o === 'seed') return fetchSeed().then(seed => { if (seed) { importData(seed, true); D.cats.books = 'yes'; toast(t('Your ledger is here')); draw(); } });
    }
    if (step === 'lang') {
      const b = e.target.closest('#o-ui [data-v]'); if (!b) return;
      setLang(b.dataset.v); S.settings.ui = b.dataset.v;
      if (D.langs.length <= 1) D.langs = [b.dataset.v];  // what you read and watch in starts as the app's language
      $$('#o-ui button', ov).forEach(x => x.classList.toggle('on', x === b));
      setTimeout(() => go('cats'), 160);
      return;
    }
    const c = e.target.closest('#o-cats [data-c]');
    if (c) {
      const k = c.dataset.c;
      D.cats[k] = on(k) ? 'no' : 'yes';
      if (on(k)) loadCat(k);  // the catalog loads while you pick the rest
      c.setAttribute('aria-pressed', on(k));
      const any = ORDER.some(on), btn = $('[data-o="finish"]', ov);
      btn.disabled = !any; btn.textContent = t(any ? 'Next' : 'Pick at least one');
    }
  };
  async function finish(restored) {
    if (!restored) Object.assign(P, { cats: D.cats, langs: D.langs.length ? D.langs : [LANG.ui] });
    S.meta.onboarded = true;
    S.settings.ui = LANG.ui;
    save();
    window.__onbBack = null;
    ov.hidden = true; ov.innerHTML = '';
    document.body.style.overflow = '';
    history.back();
    R.scored = null; R.models = null; R.favs = null;
    R.tab = 'discover'; R.disc = { cat: 'all', mode: null, genre: '', mood: '' };
    render();
    await loadEnabled();
    render();
    // The last step: a few well-known titles to swipe through.
    if (!restored && enabledCats().length) setTimeout(() => quickRate(null, { first: true }), 400);
  }
  draw();
}

/* ---------------------------------------------------------------- settings & data */
function applyTheme() {
  const th = S.settings.theme;
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme;
  const dark = th === 'dark' || (th === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0B0A10' : '#F6F4FB'));
  if (ANDROID && ANDROID.setBars) ANDROID.setBars(dark ? '#0B0A10' : '#F6F4FB', dark);
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
