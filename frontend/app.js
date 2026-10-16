(() => {
'use strict';

/* =====================================================
   Config & constantes
   ===================================================== */
const API = ((window.APP_CONFIG || {}).API_URL || '').replace(/\/$/, '');
// Pas de backend configuré : l'appli tourne en mode démo, données stockées sur l'appareil
const DEMO = !API || API.includes('TON-API');
const TYPES = ['Pecs', 'Dos', 'Épaules', 'Bras', 'Jambes', 'Full body', 'Cardio', 'Mobilité'];
const POSES = ['Face', 'Profil', 'Dos'];
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DOW_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const $ = (s, el = document) => el.querySelector(s);
const token = {
  get v() { try { return localStorage.getItem('alo_token'); } catch { return null; } },
  set v(x) { try { x ? localStorage.setItem('alo_token', x) : localStorage.removeItem('alo_token'); } catch {} },
};

/* =====================================================
   Dates & formats
   ===================================================== */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const todayStr = () => ymd(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const fmt = (s, o = { day: 'numeric', month: 'long' }) => parse(s).toLocaleDateString('fr-FR', o);
const mondayIdx = (d) => (d.getDay() + 6) % 7; // lundi = 0
const nextSunday = () => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return ymd(d); };
const plusMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return ymd(d); };
const kgf = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b) => (n > 1 ? b : a);

/* =====================================================
   État
   ===================================================== */
const S = {
  settings: null,
  days: {},
  weights: [],
  photos: [],
  photosLoaded: false,
  full: {},
  tab: 'home',
  cal: new Date(),
};

/* =====================================================
   Réseau
   ===================================================== */
async function api(path, opts = {}) {
  if (DEMO) return demoApi(path, opts);
  let res;
  try {
    res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token.v ? { Authorization: 'Bearer ' + token.v } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('Impossible de joindre le serveur.');
  }
  if (res.status === 401 && path !== '/api/login') {
    token.v = null;
    showLogin();
    throw new Error('unauth');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Une erreur est survenue.');
  return json;
}


/* =====================================================
   Mode démo (sans serveur) : mêmes routes, stockage local
   ===================================================== */
let demoDB = null;
const demoLoad = () => {
  if (demoDB) return demoDB;
  try { demoDB = JSON.parse(localStorage.getItem('alo_demo')); } catch {}
  return demoDB || (demoDB = { settings: null, days: {}, weights: [], photos: [] });
};
const demoSave = () => { try { localStorage.setItem('alo_demo', JSON.stringify(demoDB)); } catch {} };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

async function demoApi(path, opts) {
  const m = opts.method || 'GET', b = opts.body || {}, db = demoLoad();
  let r;
  if (path === '/api/login') return { token: 'demo' };
  if (path === '/api/state') {
    return JSON.parse(JSON.stringify({ settings: db.settings, days: Object.values(db.days), weights: db.weights }));
  }
  if (path === '/api/settings') { db.settings = { id: 'main', ...b }; demoSave(); return db.settings; }
  if (path === '/api/days/bulk') {
    b.dates.forEach((d) => { if (!db.days[d] || db.days[d].status !== 'done') db.days[d] = { ...(db.days[d] || { date: d, type: '', note: '', creatine: false }), status: 'planned' }; });
    demoSave(); return { planned: b.dates.length };
  }
  if ((r = path.match(/^\/api\/days\/(\d{4}-\d{2}-\d{2})$/))) {
    const d = r[1];
    if (!b.status && !b.type && !b.note && !b.creatine) delete db.days[d]; else db.days[d] = { date: d, ...b };
    demoSave(); return {};
  }
  if (path === '/api/weights' && m === 'POST') {
    db.weights = db.weights.filter((w) => w.date !== b.date);
    const w = { id: uid(), date: b.date, kg: b.kg };
    db.weights.push(w); demoSave(); return w;
  }
  if ((r = path.match(/^\/api\/weights\/(.+)$/)) && m === 'DELETE') { db.weights = db.weights.filter((w) => w.id !== r[1]); demoSave(); return {}; }
  if (path === '/api/photos' && m === 'GET') return db.photos.map(({ data, ...meta }) => meta);
  if (path === '/api/photos' && m === 'POST') { const p = { id: uid(), ...b }; db.photos.push(p); demoSave(); const { data, ...meta } = p; return meta; }
  if ((r = path.match(/^\/api\/photos\/(.+)$/))) {
    if (m === 'DELETE') { db.photos = db.photos.filter((p) => p.id !== r[1]); demoSave(); return {}; }
    const p = db.photos.find((x) => x.id === r[1]);
    return { id: r[1], data: p ? p.data : '' };
  }
  throw new Error('Route inconnue.');
}

// Données d'exemple pour voir l'appli "remplie"
function demoSeed() {
  const db = demoLoad(), t = todayStr(), start = addDays(t, -56), wed = addDays(t, 126);
  db.settings = { id: 'main', name: (db.settings && db.settings.name) || '', weddingDate: wed, startDate: start, startWeight: 84, goalWeight: 78, creatineDose: 5 };
  db.weights = [];
  for (let i = 0, d = start; d <= t; i++, d = addDays(d, 7)) db.weights.push({ id: uid(), date: d, kg: Math.round((84 - i * 0.62 + (i % 3 === 1 ? 0.3 : 0)) * 10) / 10 });
  db.days = {};
  const types = ['Pecs', 'Dos', 'Jambes', 'Épaules', 'Cardio', 'Full body'];
  let n = 0;
  for (let d = start; d <= addDays(t, 21); d = addDays(d, 1)) {
    const wd = mondayIdx(parse(d)), past = d <= t, train = [0, 2, 4, 5].includes(wd);
    const rnd = ((parse(d).getDate() * 7 + wd * 3) % 10) / 10;
    const day = { date: d, status: '', type: '', note: '', creatine: past && rnd < 0.85 };
    if (train) {
      day.type = types[n++ % types.length];
      day.status = past ? (rnd < 0.82 ? 'done' : '') : 'planned';
      if (!day.status && !past) day.type = '';
      if (!day.status) day.type = '';
    }
    if (day.status || day.creatine) db.days[d] = day;
  }
  demoSave();
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
const fail = (e) => { if (e.message !== 'unauth') toast(e.message, true); };

/* =====================================================
   Calculs
   ===================================================== */
const sortedWeights = () => [...S.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
const curWeight = () => { const w = sortedWeights(); return w.length ? w[w.length - 1].kg : S.settings.startWeight; };
const lastWeighDate = () => { const w = sortedWeights(); return w.length ? w[w.length - 1].date : null; };

function progress() {
  const { startWeight: a, goalWeight: b } = S.settings;
  const tot = a - b;
  if (!tot) return 0;
  return Math.max(0, Math.min(1, (a - curWeight()) / tot));
}

function creatineStreak() {
  let d = todayStr();
  if (!(S.days[d] && S.days[d].creatine)) d = addDays(d, -1);
  let n = 0;
  while (S.days[d] && S.days[d].creatine) { n++; d = addDays(d, -1); }
  return n;
}

const countDays = (fn) => Object.values(S.days).filter(fn).length;

/* =====================================================
   Icônes
   ===================================================== */
const IC = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  weight: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M7.8 10a5.3 5.3 0 0 1 8.4 0M12 13l2.3-2.6"/>',
  photos: '<path d="M3.5 8.5h3.2l1.6-2.5h7.4l1.6 2.5h3.2v11h-17z"/><circle cx="12" cy="13.5" r="3.6"/>',
  more: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  left: '<path d="M14.5 5l-7 7 7 7"/>',
  right: '<path d="M9.5 5l7 7-7 7"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const RINGS = '<svg class="rings" viewBox="0 0 78 48" aria-hidden="true"><circle cx="26" cy="24" r="19"/><circle cx="52" cy="24" r="19"/></svg>';

/* =====================================================
   Le mètre (compte à rebours et progression du poids)
   ===================================================== */
function tape({ count, every, pct, label, small }) {
  let t = '';
  for (let i = 0; i <= count; i++) {
    const l = ((i / count) * 100).toFixed(3);
    const big = i % every === 0;
    const mid = !big && every % 2 === 0 && i % (every / 2) === 0;
    t += `<i class="t ${big ? 'l' : mid ? 'm' : ''}" style="left:${l}%"></i>`;
    if (big) t += `<b class="n ${i === count ? 'end' : ''}" style="left:${l}%">${label(i)}</b>`;
  }
  return `<div class="tape ${small ? 'small' : ''}"><div class="past" style="width:${pct}%"></div>${t}<span class="pin" style="left:${pct}%"></span></div>`;
}

/* =====================================================
   Mutations
   ===================================================== */
const blankDay = (date) => ({ date, status: '', type: '', note: '', creatine: false });

async function saveDay(date, patch, { silent = false } = {}) {
  const next = { ...(S.days[date] || blankDay(date)), ...patch };
  const empty = !next.status && !next.creatine && !next.type && !next.note;
  if (empty) delete S.days[date]; else S.days[date] = next;
  if (!silent) { render(); if (curSheet) refreshSheet(); }
  try {
    await api('/api/days/' + date, { method: 'PUT', body: { status: next.status, type: next.type, note: next.note, creatine: next.creatine } });
  } catch (e) { fail(e); await reloadState(); }
}

async function reloadState() {
  try {
    const st = await api('/api/state');
    applyState(st);
    render();
  } catch (e) { fail(e); }
}

function applyState(st) {
  S.settings = st.settings;
  S.days = {};
  st.days.forEach((d) => { S.days[d.date] = d; });
  S.weights = st.weights;
}

async function loadPhotos(force) {
  if (S.photosLoaded && !force) return;
  try {
    S.photos = await api('/api/photos');
    S.photosLoaded = true;
    if (S.tab === 'photos') render();
  } catch (e) { fail(e); }
}

/* =====================================================
   Vues
   ===================================================== */
function viewHome() {
  const s = S.settings, t = todayStr();
  const toWed = diff(t, s.weddingDate);
  const toStart = diff(t, s.startDate);
  const total = Math.max(1, diff(s.startDate, s.weddingDate));
  const elapsed = Math.min(total, Math.max(0, diff(s.startDate, t)));
  const weeks = Math.max(1, Math.ceil(total / 7));
  const day = S.days[t] || blankDay(t);

  const h = new Date().getHours();
  const hello = (h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir') + (s.name ? ' ' + esc(s.name) : '');

  const cap = toStart > 0
    ? `Le programme démarre ${esc(fmt(s.startDate, { weekday: 'long', day: 'numeric', month: 'long' }))}, dans ${toStart} ${plural(toStart, 'jour', 'jours')}.`
    : toWed <= 0 ? 'Le jour est arrivé.' : `Semaine ${Math.min(weeks, Math.floor(elapsed / 7) + 1)} sur ${weeks}.`;

  const dose = s.creatineDose || 5;
  const streak = creatineStreak();
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));

  // poids
  const cur = curWeight(), goal = s.goalWeight, rest = Math.abs(cur - goal);
  const reached = progress() >= 1;
  const verb = goal < s.startWeight ? 'à perdre' : 'à prendre';
  const range = Math.abs(s.startWeight - s.goalWeight);
  const wCount = Math.max(1, Math.round(range));
  const wEvery = Math.max(1, Math.ceil(wCount / 6));
  const dir = s.goalWeight < s.startWeight ? 1 : -1;
  const lw = lastWeighDate();
  const since = lw ? diff(lw, t) : 99;

  // semaine
  const monday = addDays(t, -mondayIdx(new Date()));
  const weekHtml = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i), st = (S.days[d] || {}).status || '';
    return `<button class="wd ${st} ${d === t ? 'today' : ''}" data-act="open-day" data-date="${d}" aria-label="${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}"><span>${DOW[i]}</span><b>${parse(d).getDate()}</b></button>`;
  }).join('');

  const doneTotal = countDays((d) => d.status === 'done');
  const monthPrefix = t.slice(0, 7);
  const doneMonth = countDays((d) => d.status === 'done' && d.date.startsWith(monthPrefix));
  const creTotal = countDays((d) => d.creatine);

  return `
  <header class="sec hero">
    <p class="hello">${hello}</p>
    <span class="count-n" aria-label="${Math.max(0, toWed)} jours">${Math.max(0, toWed)}</span>
    <p class="count-l">${toWed === 1 ? 'jour' : 'jours'} avant le oui</p>
    <p class="count-d">${esc(fmt(s.weddingDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    ${tape({ count: weeks, every: weeks > 16 ? 4 : 2, pct: (elapsed / total) * 100, label: (i) => i })}
    <p class="tape-cap">${cap}</p>
  </header>

  <section class="sec">
    <h2>Créatine</h2>
    <div class="creatine">
      <button class="cr-btn ${day.creatine ? 'on' : ''}" data-act="creatine" aria-pressed="${day.creatine}" aria-label="Créatine prise aujourd'hui">
        <svg viewBox="0 0 40 40"><path d="M9 21l8 8L31 12"/></svg>
      </button>
      <div>
        <h3>${day.creatine ? 'C’est pris' : `${dose} g à prendre`}</h3>
        <p class="sub">${streak > 0 ? `${streak} ${plural(streak, 'jour', 'jours')} de suite` : 'Pas encore de série'}</p>
      </div>
    </div>
    <div class="dots" aria-hidden="true">${last7.map((d) => `<i class="${(S.days[d] || {}).creatine ? 'on' : ''}"></i>`).join('')}</div>
  </section>

  <section class="sec">
    <h2>Séance du jour</h2>
    <div class="seg" role="group" aria-label="Séance du jour">
      <button class="${!day.status ? 'on' : ''}" data-act="today-status" data-v="">Repos</button>
      <button class="${day.status === 'planned' ? 'on' : ''}" data-act="today-status" data-v="planned">Prévue</button>
      <button class="${day.status === 'done' ? 'on done' : ''}" data-act="today-status" data-v="done">Faite</button>
    </div>
    <div class="today-meta">
      <span>${day.type ? esc(day.type) : 'Aucun type choisi'}</span>
      <button class="link" data-act="open-day" data-date="${t}">Type et notes</button>
    </div>
  </section>

  <section class="sec">
    <div class="sec-head"><h2>Poids</h2><button class="link" data-act="open-weight">Me peser</button></div>
    <div class="w-line">
      <span class="w-now">${kgf(cur)}</span><span class="w-unit">kg</span>
      <span class="w-goal">objectif<br>${kgf(goal)} kg</span>
    </div>
    ${tape({ count: wCount, every: wEvery, pct: progress() * 100, small: true, label: (i) => Math.round(s.startWeight - dir * i * (range / wCount)) })}
    <p class="w-note">${reached ? 'Objectif atteint. Bravo !' : `Il reste ${kgf(rest)} kg ${verb}.`}</p>
    ${since >= 7 ? `<div class="callout"><span>${lw ? `Dernière pesée il y a ${since} jours.` : 'Aucune pesée enregistrée.'}</span><button class="btn sm" data-act="open-weight">Me peser</button></div>` : ''}
  </section>

  <section class="sec">
    <div class="sec-head"><h2>Cette semaine</h2><button class="link" data-act="tab" data-tab="cal">Calendrier</button></div>
    <div class="week">${weekHtml}</div>
  </section>

  <section class="stats">
    <div class="stat"><b>${doneTotal}</b><span>${plural(doneTotal, 'séance faite', 'séances faites')}</span></div>
    <div class="stat"><b>${doneMonth}</b><span>ce mois-ci</span></div>
    <div class="stat"><b>${streak}</b><span>${plural(streak, 'jour', 'jours')} de créatine d’affilée</span></div>
    <div class="stat"><b>${creTotal}</b><span>${plural(creTotal, 'dose prise', 'doses prises')} au total</span></div>
  </section>`;
}

function viewCal() {
  const s = S.settings, t = todayStr();
  const y = S.cal.getFullYear(), m = S.cal.getMonth();
  const first = new Date(y, m, 1, 12);
  const lead = mondayIdx(first);
  const dim = new Date(y, m + 1, 0).getDate();
  const title = first.toLocaleDateString('fr-FR', { month: 'long' });
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="cell out"></span>';
  let planned = 0, done = 0;
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const day = S.days[ds] || {};
    if (day.status === 'planned') planned++;
    if (day.status === 'done') done++;
    const cls = [
      'cell', day.status || '', ds === t ? 'today' : '', ds < s.startDate ? 'before' : '', ds === s.weddingDate ? 'wed' : '',
    ].join(' ');
    cells += `<button class="${cls}" data-act="open-day" data-date="${ds}" aria-label="${esc(fmt(ds, { weekday: 'long', day: 'numeric', month: 'long' }))}">${ds === s.weddingDate ? '♥' : d}${day.creatine ? '<i class="cr"></i>' : ''}</button>`;
  }
  return `
  <div class="cal-top">
    <h1>${title}<small>${y}</small></h1>
    <div class="nav">
      <button class="icon-btn" data-act="cal-prev" aria-label="Mois précédent">${svg('left')}</button>
      <button class="icon-btn" data-act="cal-next" aria-label="Mois suivant">${svg('right')}</button>
    </div>
  </div>
  <div class="dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
  <div class="cal-grid">${cells}</div>
  <div class="legend">
    <span><i></i>Séance prévue</span><span><i class="d"></i>Séance faite</span><span><i class="c"></i>Créatine prise</span>
  </div>
  <div class="month-sum">
    <p>${done} ${plural(done, 'faite', 'faites')}, ${planned} ${plural(planned, 'restante', 'restantes')} ce mois-ci.</p>
    <button class="link" data-act="cal-today">Aujourd’hui</button>
  </div>
  <div class="actions"><button class="btn ghost block" data-act="open-rec">Programme récurrent</button></div>`;
}

function chartSVG() {
  const s = S.settings, W = 340, H = 220, L = 34, R = 12, T = 16, B = 26;
  const t0 = +parse(s.startDate), t1 = +parse(s.weddingDate);
  const ws = sortedWeights();
  const vals = [s.startWeight, s.goalWeight, ...ws.map((w) => w.kg)];
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const X = (d) => L + Math.min(1, Math.max(0, (+parse(d) - t0) / (t1 - t0))) * (W - L - R);
  const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${Math.round(v * 2) / 2}</text>`;
  }
  const pts = ws.map((w) => [X(w.date), Y(w.kg)]);
  const line = pts.length > 1 ? `<path class="line" d="M${pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L')}"/>` : '';
  const dots = pts.map((p) => `<circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${pts.length > 20 ? 2.5 : 4}"/>`).join('');
  const tx = X(todayStr());
  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de poids">
    <g class="grid">${grid}</g>
    <line class="todayline" x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="${T}" y2="${H - B}"/>
    <path class="ideal" d="M${L} ${Y(s.startWeight).toFixed(1)}L${W - R} ${Y(s.goalWeight).toFixed(1)}"/>
    ${line}${dots}
    <circle class="goalpt" cx="${W - R}" cy="${Y(s.goalWeight).toFixed(1)}" r="5"/>
    <text x="${L}" y="${H - 6}">${esc(fmt(s.startDate, { day: 'numeric', month: 'short' }))}</text>
    <text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(fmt(s.weddingDate, { day: 'numeric', month: 'short' }))}</text>
  </svg>`;
}

function viewWeight() {
  const s = S.settings, ws = sortedWeights(), cur = curWeight();
  const first = ws.length ? ws[0].kg : s.startWeight;
  const hist = [...ws].reverse().map((w, i, arr) => {
    const prev = arr[i + 1];
    let cls = 'mute', txt = '';
    if (prev) {
      const dv = Math.round((w.kg - prev.kg) * 10) / 10;
      const good = s.goalWeight < s.startWeight ? dv < 0 : dv > 0;
      cls = dv === 0 ? 'mute' : good ? 'good' : 'up';
      txt = dv === 0 ? '=' : `${dv > 0 ? '+' : '−'}${kgf(Math.abs(dv))}`;
    }
    return `<li><div class="d">${esc(fmt(w.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div><span class="k">${kgf(w.kg)}</span><span class="delta ${cls}">${txt}</span><button class="x-btn" data-act="del-weight" data-id="${w.id}" aria-label="Supprimer cette pesée">×</button></li>`;
  }).join('');
  const lost = Math.round((first - cur) * 10) / 10;
  return `
  <div class="page-title"><h1>Poids</h1><button class="btn sm" data-act="open-weight">Me peser</button></div>
  <div class="chart-wrap">${chartSVG()}</div>
  <div class="chart-legend"><span>Tes pesées</span><span class="i">Trajectoire vers le grand jour</span></div>
  <section class="sec facts" style="margin-top:22px;padding:0">
    <div class="fact"><b>${kgf(first)}</b><span>départ</span></div>
    <div class="fact"><b>${kgf(cur)}</b><span>actuel</span></div>
    <div class="fact"><b>${kgf(s.goalWeight)}</b><span>objectif</span></div>
  </section>
  <section class="sec">
    <h2>Historique</h2>
    ${ws.length ? `<p class="small mute" style="margin:-4px 0 8px">${lost === 0 ? 'Aucun écart depuis le départ.' : `${lost > 0 ? '−' : '+'}${kgf(Math.abs(lost))} kg depuis le départ.`}</p><ul class="hist">${hist}</ul>` : '<p class="mute">Aucune pesée pour l’instant. Pèse-toi chaque dimanche, à jeun, pour comparer ce qui est comparable.</p>'}
  </section>`;
}

function viewPhotos() {
  if (!S.photosLoaded) return `<div class="page-title"><h1>Photos</h1></div><div class="empty"><div class="spin"></div></div>`;
  const list = S.photos;
  const head = `<div class="page-title"><h1>Photos</h1><button class="btn sm" data-act="open-photo-add">Ajouter</button></div>`;
  if (!list.length) {
    return `${head}<div class="empty"><p>Ta première photo, c’est le point de départ.</p><p class="small">Même lumière, même endroit, même heure : c’est ce qui rend la comparaison parlante.</p></div>`;
  }
  const groups = {};
  [...list].reverse().forEach((p) => { (groups[p.date.slice(0, 7)] ||= []).push(p); });
  const canCompare = POSES.some((po) => list.filter((p) => p.pose === po).length >= 2);
  return `${head}
  ${canCompare ? '<div class="actions"><button class="btn ghost block" data-act="compare">Comparer avant et maintenant</button></div>' : ''}
  ${Object.keys(groups).map((k) => `
    <h2 class="month-h">${esc(parse(k + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}</h2>
    <div class="pgrid">${groups[k].map((p) => `<button class="ph" data-act="open-photo" data-id="${p.id}"><img src="${p.thumb}" alt="Photo du ${esc(fmt(p.date))}" loading="lazy"><span class="cap">${esc(fmt(p.date))}<small>${esc(p.pose)}${p.kg ? ' · ' + kgf(p.kg) + ' kg' : ''}</small></span></button>`).join('')}</div>`).join('')}`;
}

function settingsForm(v, onboarding) {
  return `
  <label class="field"><span>Ton prénom</span><input id="f-name" value="${esc(v.name)}" autocomplete="given-name" maxlength="40"></label>
  <div class="field-row">
    <label class="field"><span>Date du mariage</span><input id="f-wedding" type="date" value="${v.weddingDate}"></label>
    <label class="field"><span>Début du programme</span><input id="f-start" type="date" value="${v.startDate}"></label>
  </div>
  <div class="field-row">
    <label class="field"><span>Poids de départ (kg)</span><input id="f-w0" type="number" inputmode="decimal" step="0.1" value="${v.startWeight ?? ''}" placeholder="80,0"></label>
    <label class="field"><span>Poids objectif (kg)</span><input id="f-w1" type="number" inputmode="decimal" step="0.1" value="${v.goalWeight ?? ''}" placeholder="75,0"></label>
  </div>
  <label class="field"><span>Créatine par jour (g)</span><input id="f-dose" type="number" inputmode="decimal" step="0.5" value="${v.creatineDose ?? 5}"></label>
  <p class="err" id="f-err"></p>
  <button class="btn block" data-act="${onboarding ? 'save-onboarding' : 'save-settings'}">${onboarding ? 'Lancer le compte à rebours' : 'Enregistrer'}</button>`;
}

function readSettingsForm() {
  const num = (id) => parseFloat(String($('#' + id).value).replace(',', '.'));
  const v = {
    name: $('#f-name').value.trim(),
    weddingDate: $('#f-wedding').value,
    startDate: $('#f-start').value,
    startWeight: num('f-w0'),
    goalWeight: num('f-w1'),
    creatineDose: num('f-dose') || 5,
  };
  let err = '';
  if (!v.weddingDate || !v.startDate) err = 'Renseigne les deux dates.';
  else if (v.weddingDate <= v.startDate) err = 'Le mariage doit être après le début du programme.';
  else if (!(v.startWeight > 20) || !(v.goalWeight > 20)) err = 'Renseigne ton poids de départ et ton objectif.';
  else if (v.startWeight === v.goalWeight) err = 'Ton objectif doit être différent de ton poids de départ.';
  $('#f-err').textContent = err;
  return err ? null : v;
}

function viewMore() {
  return `
  <div class="page-title"><h1>Réglages</h1></div>
  <section class="sec" style="border:0">${settingsForm(S.settings, false)}</section>
  ${DEMO ? `<section class="sec"><h2>Mode démo</h2><p class="small mute" style="margin-bottom:16px">Pas encore de serveur : tes données restent sur cet appareil. Elles seront remplacées par la vraie base une fois connectée.</p><button class="btn ghost block" data-act="demo-sample">Charger des données d’exemple</button><button class="btn danger block" style="margin-top:10px" data-act="demo-reset">Tout effacer</button></section>` : ''}
  <section class="sec">
    <button class="btn ghost block" data-act="logout">Se déconnecter</button>
    <p class="small mute" style="margin-top:16px">Tes données restent enregistrées. Tu les retrouveras en te reconnectant.</p>
  </section>`;
}

const VIEWS = { home: viewHome, cal: viewCal, weight: viewWeight, photos: viewPhotos, more: viewMore };
const TABS = [['home', 'Aujourd’hui', 'today'], ['cal', 'Calendrier', 'cal'], ['weight', 'Poids', 'weight'], ['photos', 'Photos', 'photos'], ['more', 'Réglages', 'more']];

function render() {
  if (!S.settings) return;
  document.body.classList.remove('bare');
  $('#view').innerHTML = VIEWS[S.tab]();
  const tabs = $('#tabs');
  tabs.hidden = false;
  tabs.innerHTML = TABS.map(([k, label, ic]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" aria-label="${label}" ${S.tab === k ? 'aria-current="page"' : ''}>${svg(ic)}<span>${label}</span></button>`).join('');
}

/* =====================================================
   Connexion, onboarding, chargement
   ===================================================== */
function showLogin() {
  S.settings = null;
  closeSheet(true);
  $('#splash').hidden = true;
  $('#tabs').hidden = true;
  document.body.classList.add('bare');
  $('#view').innerHTML = `
  <div class="gate">
    ${RINGS}
    <h1>Avant<br>le oui</h1>
    <p class="lead">Ton carnet d’entraînement jusqu’au mariage.</p>
    <label class="field"><span>Mot de passe</span><input id="pw" type="password" autocomplete="current-password"></label>
    <p class="err" id="login-err"></p>
    <button class="btn block" data-act="login">Entrer</button>
  </div>`;
  setTimeout(() => { const i = $('#pw'); if (i) i.focus(); }, 50);
}

async function doLogin() {
  const pw = $('#pw').value;
  if (!pw) return;
  const btn = $('[data-act="login"]');
  btn.disabled = true;
  $('#login-err').textContent = '';
  const slow = setTimeout(() => { $('#login-err').textContent = 'Le serveur se réveille, ça peut prendre une minute…'; }, 3000);
  try {
    const r = await api('/api/login', { method: 'POST', body: { password: pw } });
    token.v = r.token;
    clearTimeout(slow);
    boot();
  } catch (e) {
    clearTimeout(slow);
    btn.disabled = false;
    $('#login-err').textContent = e.message;
  }
}

function showOnboarding() {
  $('#splash').hidden = true;
  $('#tabs').hidden = true;
  document.body.classList.add('bare');
  $('#view').innerHTML = `
  <div class="gate">
    ${RINGS}
    <h1>Fixe la date.</h1>
    <p class="lead">Quelques chiffres pour dérouler ton mètre jusqu’au grand jour.</p>
    ${settingsForm({ name: '', weddingDate: plusMonths(6), startDate: addDays(todayStr(), -1), startWeight: '', goalWeight: '', creatineDose: 5 }, true)}
  </div>`;
}

async function saveSettings(onboarding) {
  const v = readSettingsForm();
  if (!v) return;
  const btn = $('[data-act^="save-"]');
  btn.disabled = true;
  try {
    S.settings = await api('/api/settings', { method: 'PUT', body: v });
    if (onboarding && !S.weights.length) {
      const w = await api('/api/weights', { method: 'POST', body: { date: todayStr(), kg: v.startWeight } });
      S.weights = [w];
    }
    toast(onboarding ? 'C’est parti.' : 'Réglages enregistrés');
    S.tab = 'home';
    render();
    window.scrollTo(0, 0);
  } catch (e) { fail(e); btn.disabled = false; }
}

function splash(html) { const s = $('#splash'); s.innerHTML = html; s.hidden = false; }

async function boot() {
  if (DEMO && !token.v) token.v = 'demo';
  if (!token.v) return showLogin();
  splash(`<div class="spin"></div><p id="splash-msg"></p>`);
  const slow = setTimeout(() => { const m = $('#splash-msg'); if (m) m.textContent = 'Le serveur se réveille, ça peut prendre une minute…'; }, 2500);
  try {
    applyState(await api('/api/state'));
    clearTimeout(slow);
    $('#splash').hidden = true;
    if (!S.settings) showOnboarding(); else { S.tab = 'home'; render(); }
  } catch (e) {
    clearTimeout(slow);
    if (e.message === 'unauth') return;
    splash(`<p>${esc(e.message)}</p><button class="btn" data-act="retry">Réessayer</button>`);
  }
}

/* =====================================================
   Feuille du bas
   ===================================================== */
let curSheet = null;
function openSheet(fn) {
  curSheet = fn;
  $('#sheet-body').innerHTML = fn();
  const w = $('#sheet');
  w.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('open')));
}
function refreshSheet() { if (curSheet) $('#sheet-body').innerHTML = curSheet(); }
function closeSheet(instant) {
  const w = $('#sheet');
  curSheet = null;
  w.classList.remove('open');
  if (instant) { w.hidden = true; return; }
  setTimeout(() => { if (!curSheet) w.hidden = true; }, 280);
}

/* --- Jour --- */
let daySheetDate = null;
function daySheet() {
  const d = daySheetDate, day = S.days[d] || blankDay(d);
  return `
  <h3>${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
  <p class="sub">${d === S.settings.weddingDate ? 'Le grand jour.' : d > todayStr() ? 'À venir' : d === todayStr() ? 'Aujourd’hui' : 'Passé'}</p>
  <div class="seg">
    <button class="${!day.status ? 'on' : ''}" data-act="day-status" data-v="">Repos</button>
    <button class="${day.status === 'planned' ? 'on' : ''}" data-act="day-status" data-v="planned">Prévue</button>
    <button class="${day.status === 'done' ? 'on done' : ''}" data-act="day-status" data-v="done">Faite</button>
  </div>
  <span class="lbl">Type de séance</span>
  <div class="chips">${TYPES.map((t) => `<button class="chip ${day.type === t ? 'on' : ''}" data-act="day-type" data-v="${t}">${t}</button>`).join('')}</div>
  <div class="toggle-row"><span>Créatine prise</span><button class="switch ${day.creatine ? 'on' : ''}" data-act="day-creatine" role="switch" aria-checked="${day.creatine}" aria-label="Créatine prise"></button></div>
  <label class="field"><span>Note</span><textarea id="day-note" maxlength="1000" placeholder="Charges, sensations, énergie…">${esc(day.note)}</textarea></label>
  <button class="btn block" data-act="close-sheet">Fermer</button>`;
}
function openDay(date) { daySheetDate = date; openSheet(daySheet); }

/* --- Pesée --- */
let wSheet = { kg: 0, date: '' };
function weightSheet() {
  return `
  <h3>Pesée</h3>
  <p class="sub">À jeun, le matin, c’est le plus fiable.</p>
  <div class="kg-input">
    <button class="icon-btn" data-act="wstep" data-v="-0.1" aria-label="Moins 100 grammes">−</button>
    <input id="w-kg" type="number" inputmode="decimal" step="0.1" value="${wSheet.kg}" aria-label="Poids en kilos">
    <button class="icon-btn" data-act="wstep" data-v="0.1" aria-label="Plus 100 grammes">+</button>
  </div>
  <p class="kg-unit">kg</p>
  <label class="field"><span>Date</span><input id="w-date" type="date" value="${wSheet.date}" max="${todayStr()}"></label>
  <button class="btn block" data-act="save-weight">Enregistrer la pesée</button>`;
}
function openWeight() {
  wSheet = { kg: kgf(curWeight()).replace(',', '.'), date: todayStr() };
  openSheet(weightSheet);
}

/* --- Programme récurrent --- */
let recDays = new Set([0, 2, 4]);
function recDates() {
  const s = S.settings;
  const from = todayStr() > s.startDate ? todayStr() : s.startDate;
  const out = [];
  for (let d = from; d <= s.weddingDate && out.length < 400; d = addDays(d, 1)) {
    if (recDays.has(mondayIdx(parse(d)))) out.push(d);
  }
  return out;
}
function recSheet() {
  const n = recDates().length;
  return `
  <h3>Programme récurrent</h3>
  <p class="sub">Choisis tes jours d’entraînement : ils seront prévus jusqu’au mariage. Les séances déjà faites ne bougent pas.</p>
  <div class="chips">${DOW_LONG.map((l, i) => `<button class="chip ${recDays.has(i) ? 'on' : ''}" data-act="rec-day" data-v="${i}">${l}</button>`).join('')}</div>
  <p class="small mute" style="margin:20px 0">${n ? `${n} ${plural(n, 'séance sera prévue', 'séances seront prévues')}.` : 'Choisis au moins un jour.'}</p>
  <button class="btn block" data-act="save-rec" ${n ? '' : 'disabled'}>Planifier</button>`;
}

/* --- Ajout de photo --- */
let pSheet = { pose: 'Face', date: '', data: '', thumb: '', busy: false };
function photoSheet() {
  return `
  <h3>Nouvelle photo</h3>
  <p class="sub">Même lumière, même endroit : c’est ce qui rend la comparaison parlante.</p>
  ${pSheet.data ? `<img class="preview" src="${pSheet.data}" alt="Aperçu">` : ''}
  <div class="file-btn btn ghost block" style="margin-bottom:6px">${pSheet.data ? 'Changer de photo' : 'Choisir ou prendre une photo'}<input id="p-file" type="file" accept="image/*"></div>
  <span class="lbl">Pose</span>
  <div class="chips">${POSES.map((p) => `<button class="chip ${pSheet.pose === p ? 'on' : ''}" data-act="pose" data-v="${p}">${p}</button>`).join('')}</div>
  <label class="field" style="margin-top:22px"><span>Date</span><input id="p-date" type="date" value="${pSheet.date}" max="${todayStr()}"></label>
  <button class="btn block" data-act="save-photo" ${pSheet.data && !pSheet.busy ? '' : 'disabled'}>${pSheet.busy ? 'Envoi…' : 'Enregistrer la photo'}</button>`;
}

function resizeImage(file, max, q) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}

/* =====================================================
   Plein écran : visionneuse et comparaison
   ===================================================== */
let viewer = { ids: [], i: 0 };
function overlay(html) { const o = $('#overlay'); o.innerHTML = html; o.className = 'overlay'; o.hidden = false; }
function closeOverlay() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; }

async function fullImage(id) {
  if (!S.full[id]) S.full[id] = (await api('/api/photos/' + id)).data;
  return S.full[id];
}

async function showViewer() {
  const id = viewer.ids[viewer.i];
  const p = S.photos.find((x) => x.id === id);
  if (!p) return closeOverlay();
  overlay(`
    <div class="ov-top"><div class="cap">${esc(fmt(p.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}<small>${esc(p.pose)}${p.kg ? ' · ' + kgf(p.kg) + ' kg' : ''}</small></div><button class="icon-btn" data-act="close-overlay" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="ov-stage" id="stage"><img src="${p.thumb}" alt="" style="filter:blur(2px)"></div>
    <div class="ov-bottom">
      <button class="icon-btn" data-act="photo-step" data-v="-1" aria-label="Photo plus ancienne" ${viewer.i === 0 ? 'disabled' : ''}>${svg('left')}</button>
      <button class="btn danger sm" data-act="del-photo" data-id="${p.id}">Supprimer</button>
      <button class="icon-btn" data-act="photo-step" data-v="1" aria-label="Photo plus récente" ${viewer.i === viewer.ids.length - 1 ? 'disabled' : ''}>${svg('right')}</button>
    </div>`);
  try {
    const data = await fullImage(id);
    const st = $('#stage');
    if (st && viewer.ids[viewer.i] === id) st.innerHTML = `<img src="${data}" alt="Photo du ${esc(fmt(p.date))}">`;
  } catch (e) { fail(e); }
}

async function showCompare() {
  const pose = POSES.map((po) => [po, S.photos.filter((p) => p.pose === po)]).sort((a, b) => b[1].length - a[1].length)[0];
  const list = pose[1];
  if (list.length < 2) return toast('Il faut deux photos de la même pose.', true);
  const a = list[0], b = list[list.length - 1];
  overlay(`<div class="ov-top"><div class="cap">Pose : ${esc(pose[0])}</div><button class="icon-btn" data-act="close-overlay" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="ov-stage"><div class="spin"></div></div>`);
  try {
    const [da, db] = await Promise.all([fullImage(a.id), fullImage(b.id)]);
    overlay(`
      <div class="ov-top"><div class="cap">Pose : ${esc(pose[0])}<small>${esc(fmt(a.date))} contre ${esc(fmt(b.date))}</small></div><button class="icon-btn" data-act="close-overlay" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="ov-stage">
        <div class="cmp" id="cmp">
          <img src="${db}" alt="Photo récente">
          <img class="top" src="${da}" alt="Première photo">
          <span class="bar"></span>
          <span class="tag l">${esc(fmt(a.date, { day: 'numeric', month: 'short' }))}${a.kg ? ' · ' + kgf(a.kg) : ''}</span>
          <span class="tag r">${esc(fmt(b.date, { day: 'numeric', month: 'short' }))}${b.kg ? ' · ' + kgf(b.kg) : ''}</span>
          <input type="range" id="cmp-range" min="0" max="100" value="50" aria-label="Comparer les deux photos">
        </div>
      </div>
      <div class="ov-bottom"></div>`);
  } catch (e) { closeOverlay(); fail(e); }
}

/* =====================================================
   Actions (délégation d'événements)
   ===================================================== */
let noteTimer;
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, v = el.dataset.v, t = todayStr();

  switch (act) {
    case 'tab':
      S.tab = el.dataset.tab; render(); window.scrollTo(0, 0);
      if (S.tab === 'photos') loadPhotos();
      break;
    case 'login': doLogin(); break;
    case 'retry': boot(); break;
    case 'logout': token.v = null; showLogin(); break;
    case 'demo-sample': demoSeed(); applyState(await api('/api/state')); S.tab = 'home'; render(); window.scrollTo(0, 0); toast('Données d’exemple chargées'); break;
    case 'demo-reset':
      if (!confirm('Tout effacer et recommencer ?')) break;
      demoDB = { settings: null, days: {}, weights: [], photos: [] }; demoSave();
      S.settings = null; S.days = {}; S.weights = []; S.photos = []; S.photosLoaded = false; S.full = {};
      showOnboarding(); break;
    case 'save-onboarding': saveSettings(true); break;
    case 'save-settings': saveSettings(false); break;

    case 'creatine': saveDay(t, { creatine: !(S.days[t] || {}).creatine }); break;
    case 'today-status': saveDay(t, { status: v }); break;

    case 'open-day': openDay(el.dataset.date); break;
    case 'day-status': saveDay(daySheetDate, { status: v }); break;
    case 'day-type': saveDay(daySheetDate, { type: (S.days[daySheetDate] || {}).type === v ? '' : v }); break;
    case 'day-creatine': saveDay(daySheetDate, { creatine: !(S.days[daySheetDate] || {}).creatine }); break;

    case 'cal-prev': S.cal = new Date(S.cal.getFullYear(), S.cal.getMonth() - 1, 1, 12); render(); break;
    case 'cal-next': S.cal = new Date(S.cal.getFullYear(), S.cal.getMonth() + 1, 1, 12); render(); break;
    case 'cal-today': S.cal = new Date(); render(); break;

    case 'open-rec': openSheet(recSheet); break;
    case 'rec-day': { const n = Number(v); recDays.has(n) ? recDays.delete(n) : recDays.add(n); refreshSheet(); break; }
    case 'save-rec': {
      const dates = recDates();
      el.disabled = true;
      try {
        await api('/api/days/bulk', { method: 'POST', body: { dates } });
        dates.forEach((d) => { if (!S.days[d] || S.days[d].status !== 'done') S.days[d] = { ...(S.days[d] || blankDay(d)), status: 'planned' }; });
        closeSheet(); render(); toast(`${dates.length} ${plural(dates.length, 'séance prévue', 'séances prévues')}`);
      } catch (err) { fail(err); el.disabled = false; }
      break;
    }

    case 'open-weight': openWeight(); break;
    case 'wstep': {
      const inp = $('#w-kg');
      const n = Math.max(20, Math.round((parseFloat(String(inp.value).replace(',', '.')) + Number(v)) * 10) / 10);
      inp.value = n.toFixed(1);
      break;
    }
    case 'save-weight': {
      const kg = parseFloat(String($('#w-kg').value).replace(',', '.'));
      const date = $('#w-date').value;
      if (!(kg >= 20 && kg <= 400) || !date) return toast('Vérifie le poids et la date.', true);
      el.disabled = true;
      try {
        const w = await api('/api/weights', { method: 'POST', body: { date, kg } });
        S.weights = S.weights.filter((x) => x.date !== date).concat(w);
        closeSheet(); render(); toast('Pesée enregistrée');
      } catch (err) { fail(err); el.disabled = false; }
      break;
    }
    case 'del-weight':
      if (!confirm('Supprimer cette pesée ?')) break;
      try { await api('/api/weights/' + el.dataset.id, { method: 'DELETE' }); S.weights = S.weights.filter((w) => w.id !== el.dataset.id); render(); } catch (err) { fail(err); }
      break;

    case 'open-photo-add': pSheet = { pose: 'Face', date: t, data: '', thumb: '', busy: false }; openSheet(photoSheet); break;
    case 'pose': pSheet.date = ($('#p-date') || {}).value || pSheet.date; pSheet.pose = v; refreshSheet(); break;
    case 'save-photo': {
      pSheet.date = $('#p-date').value || t;
      pSheet.busy = true; refreshSheet();
      const sameDay = S.weights.find((w) => w.date === pSheet.date);
      try {
        const p = await api('/api/photos', { method: 'POST', body: { date: pSheet.date, pose: pSheet.pose, kg: sameDay ? sameDay.kg : null, thumb: pSheet.thumb, data: pSheet.data } });
        S.full[p.id] = pSheet.data;
        S.photos.push(p);
        S.photos.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
        closeSheet(); render(); toast('Photo enregistrée');
      } catch (err) { pSheet.busy = false; refreshSheet(); fail(err); }
      break;
    }
    case 'open-photo':
      viewer = { ids: S.photos.map((p) => p.id), i: S.photos.findIndex((p) => p.id === el.dataset.id) };
      showViewer(); break;
    case 'photo-step': viewer.i = Math.max(0, Math.min(viewer.ids.length - 1, viewer.i + Number(v))); showViewer(); break;
    case 'del-photo':
      if (!confirm('Supprimer cette photo ?')) break;
      try {
        await api('/api/photos/' + el.dataset.id, { method: 'DELETE' });
        S.photos = S.photos.filter((p) => p.id !== el.dataset.id);
        delete S.full[el.dataset.id];
        closeOverlay(); render();
      } catch (err) { fail(err); }
      break;
    case 'compare': showCompare(); break;
    case 'close-overlay': closeOverlay(); break;
    case 'close-sheet': closeSheet(); break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'cmp-range') $('#cmp').style.setProperty('--p', e.target.value + '%');
  if (e.target.id === 'day-note') {
    const d = daySheetDate, val = e.target.value;
    S.days[d] = { ...(S.days[d] || blankDay(d)), note: val };
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => saveDay(d, { note: val.trim() ? val : '' }, { silent: true }), 600);
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'p-file' && e.target.files[0]) {
    const f = e.target.files[0];
    try {
      const [data, thumb] = await Promise.all([resizeImage(f, 1280, 0.82), resizeImage(f, 360, 0.72)]);
      pSheet.date = ($('#p-date') || {}).value || pSheet.date;
      pSheet.data = data; pSheet.thumb = thumb;
      refreshSheet();
    } catch (err) { fail(err); }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#overlay').hidden) closeOverlay(); else if (curSheet) closeSheet(); }
  if (e.key === 'Enter' && e.target.id === 'pw') doLogin();
});

/* Évite que le serveur gratuit s'endorme pendant que l'appli est ouverte */
setInterval(() => { if (!DEMO && !document.hidden && token.v) fetch(API + '/api/health').catch(() => {}); }, 9 * 60 * 1000);

/* Au retour dans l'appli, on rafraîchit pour passer au bon jour */
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.settings && S.tab !== 'more') render(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

boot();
})();
