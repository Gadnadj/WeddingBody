(() => {
'use strict';

/* =====================================================
   Config & constantes
   ===================================================== */
const RAW_API = String((window.APP_CONFIG || {}).API_URL ?? '');
const API = RAW_API.replace(/\/$/, '');   // '/' devient '' : les requêtes partent vers /api/... du site (relayées par Netlify)
// Pas de backend configuré : l'appli tourne en mode démo, données stockées sur l'appareil
const DEMO = RAW_API === '' || RAW_API.includes('TON-API');
const TYPES = ['Pecs', 'Dos', 'Épaules', 'Bras', 'Jambes', 'Cardio', 'Handstand', 'Abdos'];
const POSES = ['Face', 'Profil', 'Dos'];
// Abréviations pour les petites cases du calendrier
const SHORT = { Pecs: 'Pecs', Dos: 'Dos', 'Épaules': 'Épa.', Bras: 'Bras', Jambes: 'Jamb.', Cardio: 'Card.', Handstand: 'Hand.', Abdos: 'Abdos' };
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DOW_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const $ = (s, el = document) => el.querySelector(s);
const token = {
  get v() { try { return localStorage.getItem('alo_token'); } catch { return null; } },
  set v(x) { try { if (x) localStorage.setItem('alo_token', x); else { localStorage.removeItem('alo_token'); localStorage.removeItem('alo_cache'); } } catch {} },
};


/* Messages du jour : un différent chaque jour ({j} = jours restants avant le mariage) */
const MESSAGES = [
  'Une séance faite vaut mieux qu’une séance parfaite.',
  'Le jour J, tu remercieras celui d’aujourd’hui.',
  'Plus que {j} jours. Chaque séance compte.',
  'Pas besoin d’être motivé. Il suffit de commencer.',
  'La créatine, c’est tous les jours. Comme la régularité.',
  'Petit à petit, ça devient une habitude, puis une évidence.',
  'Ton futur toi te regarde. Fais-lui plaisir.',
  'Ce n’est pas un sprint, c’est une préparation de {j} jours.',
  'Dors bien : le muscle se construit au repos.',
  'Bois de l’eau. Beaucoup. Ta créatine te dit merci.',
  'Même une séance courte fait avancer le compteur.',
  'Les photos ne mentent pas, et elles te feront sourire.',
  'Aujourd’hui, un peu mieux qu’hier. C’est tout.',
  'Tiens ton handstand une seconde de plus.',
  'Le plus dur, c’est la porte de la salle. Ensuite, tout va bien.',
  'Les abdos se font en cuisine autant qu’à la salle.',
  'Pèse-toi le dimanche, à jeun : toujours les mêmes conditions.',
  'Une mauvaise séance reste une séance faite.',
  'Tu te prépares pour un des plus beaux jours de ta vie. Ça mérite un effort.',
  'La régularité bat l’intensité.',
  'Échauffe-toi bien. Un blessé ne progresse pas.',
  'Ne compare pas ta semaine 2 à la semaine 20 d’un autre.',
  'Chaque croix dans le calendrier est une victoire.',
  'Cinq minutes de plus que d’habitude. Pas plus.',
  'Mange des protéines, dors tes huit heures, et laisse le temps faire.',
  'La fatigue passe, la fierté reste.',
  'Aujourd’hui, ton seul adversaire, c’est le canapé.',
  'Un pas après l’autre : il reste {j} jours pour y arriver.',
  'Respire, serre, pousse. Recommence.',
  'Avance à ton rythme, mais avance.',
  'Les progrès sont lents à voir et rapides à perdre : continue.',
  'Fais-toi plaisir à la salle, pas seulement du mal.',
  'Étire-toi après : tes muscles te le rendront.',
  'Un jour de repos fait partie du programme.',
  'Souris au miroir : tu as commencé, c’est déjà beaucoup.',
  'Ce que tu fais aujourd’hui se verra sur les photos du mariage.',
  'Fixe l’objectif, puis oublie-le et fais juste la séance du jour.',
  'Tu n’as pas besoin de tout changer. Juste de recommencer demain.',
  'Une bonne posture vaut mieux qu’une charge lourde.',
  'La discipline, c’est se faire une promesse et la tenir.',
  'Garde le contrôle du mouvement : la qualité avant la charge.',
  '{j} jours, c’est assez pour changer beaucoup de choses.',
  'Chaque goutte de sueur est un petit acompte sur le grand jour.',
  'Un verre d’eau, ta créatine, et c’est parti.',
  'Tu as le droit d’être fatigué. Pas celui d’abandonner.',
  'Celui qui s’entraîne les jours de flemme gagne la semaine.',
  'Respecte ton sommeil : c’est là que tu progresses.',
  'Fais une photo aujourd’hui : dans trois mois, tu seras content de l’avoir.',
  'L’équilibre en handstand se travaille un peu chaque jour, comme tout le reste.',
  'Ne saute ni l’échauffement, ni le repos.',
  'Toi, de la régularité et {j} jours : le résultat suivra.',
  'Moins de pression, plus de constance.',
  'Une habitude, ça se construit une journée à la fois.',
  'Pendant la séance, le téléphone de côté. Juste toi et la fonte.',
  'Le mariage, c’est dans {j} jours. Le corps, c’est maintenant.',
  'Fais-le pour toi d’abord.',
  'Tu fais ce que beaucoup remettent à plus tard.',
  'Prends ta créatine, bois de l’eau, avance.',
];
function messageDuJour(t, toWed) {
  const pool = MESSAGES.filter((m) => toWed > 0 || !m.includes('{j}'));
  const dayNo = Math.floor(parse(t).getTime() / 864e5);
  return pool[((dayNo % pool.length) + pool.length) % pool.length].replace('{j}', String(Math.max(0, toWed)));
}

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
// Chaque chiffre dans une case de même largeur : les colonnes de nombres s'alignent parfaitement
const fixedNum = (str) => String(str).replace(/[0-9]/g, (c) => `<i class="dg">${c}</i>`).replace(/,/g, '<i class="cm">,</i>');
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
/* Le serveur gratuit s'endort : on patiente et on réessaie tout seul pendant ~100 s, avec un compteur */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAKE_MAX = Number((window.APP_CONFIG || {}).WAKE_MAX) || 100000;
const VERSION = 19;
let lastNet = '';
const serverLabel = () => (API ? API.replace(/^https?:\/\//, '') : `via ${location.host}/api`);
const netDetail = () => `${lastNet || 'aucune réponse'} — serveur : ${serverLabel()} — version ${VERSION}`;

function wakeUi(sec) {
  const txt = `Le serveur se réveille… ${sec} s. Ça peut prendre jusqu’à une minute et demie.`;
  const m = document.querySelector('#splash-msg'); if (m) m.textContent = txt;
  const e = document.querySelector('#login-err'); if (e) e.textContent = txt;
}

async function netFetch(path, init, retryable) {
  const t0 = Date.now();
  const tick = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); if (s >= 3) wakeUi(s); }, 1000);
  try {
    for (;;) {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = ctrl && retryable ? setTimeout(() => ctrl.abort(), 30000) : null;
      try {
        const res = await fetch(API + path, ctrl ? { ...init, signal: ctrl.signal } : init);
        if (to) clearTimeout(to);
        // 502/503/504 : le serveur n'est pas encore prêt, la requête n'a pas été traitée : on peut réessayer sans risque
        if ([502, 503, 504].includes(res.status)) lastNet = `réponse HTTP ${res.status}`;
        if ([502, 503, 504].includes(res.status) && Date.now() - t0 < WAKE_MAX) { await sleep(3000); continue; }
        return res;
      } catch (e) {
        if (to) clearTimeout(to);
        lastNet = e && e.name === 'AbortError' ? 'pas de réponse après 30 s' : `échec réseau (${(e && e.message) || 'inconnu'})`;
        // on ne rejoue automatiquement que les lectures et la connexion (pas d'envoi en double d'une photo)
        if (!retryable || Date.now() - t0 >= WAKE_MAX) throw e;
        await sleep(2500);
      }
    }
  } finally { clearInterval(tick); }
}

async function api(path, opts = {}) {
  if (DEMO) return demoApi(path, opts);
  const method = opts.method || 'GET';
  const init = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token.v ? { Authorization: 'Bearer ' + token.v } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  };
  let res;
  try {
    // Réessai automatique pour tout, sauf l'envoi d'une photo (pour ne pas l'enregistrer en double)
    res = await netFetch(path, init, !(method === 'POST' && path === '/api/photos'));
  } catch {
    throw new Error('Le serveur ne répond pas. Vérifie ta connexion puis réessaie.');
  }
  if (res.status === 401 && path !== '/api/login') {
    token.v = null;
    showLogin();
    throw new Error('unauth');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || (res.status >= 500 ? 'Le serveur est indisponible pour le moment. Réessaie dans un instant.' : 'Une erreur est survenue.'));
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
  if (path === '/api/days/clear-planned') {
    Object.keys(db.days).forEach((k) => { const d = db.days[k]; if (d.status === 'planned' && k >= b.from) { if (!d.type && !d.note && !d.creatine) delete db.days[k]; else d.status = ''; } });
    demoSave(); return {};
  }
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
    if (m === 'PUT') {
      const p = db.photos.find((x) => x.id === r[1]);
      if (p) { p.date = b.date; if (b.pose) p.pose = b.pose; demoSave(); const { data, ...meta } = p; return meta; }
      throw new Error('Photo introuvable.');
    }
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
  const types = ['Pecs', 'Dos', 'Jambes', 'Épaules', 'Cardio', 'Handstand', 'Abdos'];
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

/* =====================================================
   Repères : cercle = prévue, croix = faite
   ===================================================== */
const circleMark = () => '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/></svg>';
const crossMark = () => '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
const dashMark = () => '<svg class="mk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
const rings = (cls = '') => `<svg class="${cls}" viewBox="0 0 120 70" aria-hidden="true"><circle cx="44" cy="35" r="27"/><circle cx="76" cy="35" r="27"/></svg>`;
const brand = () => `${rings('gate-rings')}<h1>Avant le oui</h1>`;
// Sur le calendrier : un jour entouré (prévu) ou barré d'une croix (fait), comme sur un calendrier papier
const ringOverlay = () => '<svg class="ov ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40"/></svg>';
const strikeOverlay = () => '<svg class="ov strike" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0L100 100M100 0L0 100"/></svg>';

function picks(act, cur) {
  const b = (v, label, mk, cls) => `<button class="pick ${cur === v ? 'on' : ''} ${cls}" data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${mk}<span>${label}</span></button>`;
  return `<div class="picks" role="group">${b('', 'Repos', dashMark(), 'is-rest')}${b('planned', 'Prévue', circleMark(), 'is-planned')}${b('done', 'Faite', crossMark(), 'is-done')}</div>`;
}

/* Le nombre de jours se déroule de 0 à sa valeur, une seule fois à l'ouverture */
function animateCount() {
  if (S.intro) return;
  S.intro = true;
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.querySelector('.hero-n');
  if (!el) return;
  const to = Number(el.dataset.n) || 0;
  if (to < 2) return;
  const t0 = Date.now(), dur = 1100;
  const step = () => {
    const p = Math.min(1, (Date.now() - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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

/* Copie locale des dernières données : l'appli s'ouvre tout de suite, même si le serveur dort */
function saveCache() {
  if (DEMO || !S.settings) return;
  try { localStorage.setItem('alo_cache', JSON.stringify({ settings: S.settings, days: Object.values(S.days), weights: S.weights })); } catch {}
}
function loadCache() {
  try { const c = JSON.parse(localStorage.getItem('alo_cache')); return c && c.settings ? c : null; } catch { return null; }
}
async function refreshInBackground() {
  try {
    applyState(await api('/api/state'));
    saveCache();
    // on ne redessine pas si l'utilisateur est en train de saisir quelque chose
    if (S.settings && !curSheet && $('#overlay').hidden && S.tab !== 'more') render();
  } catch (e) { /* hors ligne ou serveur endormi : on garde les données affichées */ }
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
  const toWed = diff(t, s.weddingDate), toStart = diff(t, s.startDate);
  const total = Math.max(1, diff(s.startDate, s.weddingDate));
  const elapsed = Math.min(total, Math.max(0, diff(s.startDate, t)));
  const weeks = Math.max(1, Math.ceil(total / 7));
  const nowWeek = toStart > 0 ? -1 : Math.min(weeks - 1, Math.floor(elapsed / 7));
  const pct = ((elapsed / total) * 100).toFixed(1);
  const day = S.days[t] || blankDay(t);

  const h = new Date().getHours();
  const hello = (h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir') + (s.name ? ' ' + esc(s.name) : '');
  const cap = toStart > 0
    ? `Le programme démarre ${esc(fmt(s.startDate, { weekday: 'long', day: 'numeric', month: 'long' }))}, dans ${toStart} ${plural(toStart, 'jour', 'jours')}.`
    : toWed <= 0 ? 'Le jour est arrivé.' : `Semaine ${nowWeek + 1} sur ${weeks}`;

  const dose = s.creatineDose || 5;
  const streak = creatineStreak();
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));

  const cur = curWeight(), goal = s.goalWeight, rest = Math.abs(cur - goal);
  const reached = progress() >= 1;
  const verb = goal < s.startWeight ? 'à perdre' : 'à prendre';
  const lw = lastWeighDate();
  const since = lw ? diff(lw, t) : 99;

  const monday = addDays(t, -mondayIdx(new Date()));
  const weekHtml = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i), st = (S.days[d] || {}).status || '';
    return `<button class="wd ${d === t ? 'today' : ''} ${d < s.startDate ? 'before' : ''}" data-act="open-day" data-date="${d}" aria-label="${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}"><span>${DOW[i]}</span><b>${parse(d).getDate()}</b><i class="m ${st === 'planned' ? 'p' : st === 'done' ? 'f' : ''}">${st === 'planned' ? circleMark() : st === 'done' ? crossMark() : ''}</i></button>`;
  }).join('');

  const doneMonth = countDays((d) => d.status === 'done' && d.date.startsWith(t.slice(0, 7)));
  const upcoming = Object.values(S.days).filter((d) => d.status === 'planned' && d.date >= t).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const wFirst = sortedWeights().length ? sortedWeights()[0].kg : s.startWeight;
  const wDelta = Math.round((cur - wFirst) * 10) / 10;
  const wDeltaTxt = wDelta === 0 ? '0' : (wDelta < 0 ? '−' : '+') + kgf(Math.abs(wDelta));
  const nextTxt = upcoming ? fmt(upcoming.date, { weekday: 'short', day: 'numeric' }).replace('.', '') : '—';
  const n = Math.max(0, toWed);

  return `
  <p class="hello">${hello}</p>

  <section class="hero"><div class="hero-in">
    ${rings('hero-rings')}
    <p class="hero-k">${toStart > 0 ? 'Dans' : 'Plus que'}</p>
    <div class="hero-n" data-n="${n}" aria-label="${n} jours">${n}</div>
    <p class="hero-l">${n === 1 ? 'jour' : 'jours'} avant le oui</p>
    <p class="hero-d">${esc(fmt(s.weddingDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    <div class="prog" aria-hidden="true"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>
    <p class="hero-c">${cap}</p>
  </div></section>

  <section class="msg" aria-label="Message du jour">
    <span class="qm" aria-hidden="true">“</span>
    <p>${esc(messageDuJour(t, toWed))}</p>
    <small>Message du jour</small>
  </section>

  <section class="sec">
    <h2 class="sec-t"><span>Créatine</span></h2>
    <div class="cre">
      <button class="cre-btn ${day.creatine ? 'on' : ''}" data-act="creatine" aria-pressed="${day.creatine}" aria-label="Créatine prise aujourd'hui"><svg viewBox="0 0 40 40"><path d="M9 21l8 8L31 12"/></svg></button>
      <p class="big">${day.creatine ? 'C’est pris' : `${dose} g à prendre`}</p>
      <p class="sub">${streak > 0 ? `${streak} ${plural(streak, 'jour', 'jours')} de suite` : 'Pas encore de série'}</p>
    </div>
    <p class="cap7">Les 7 derniers jours</p>
    <div class="week7">${last7.map((d) => `<div class="dt ${d === t ? 'today' : ''}"><i class="${(S.days[d] || {}).creatine ? 'on' : ''}"></i><span>${DOW[mondayIdx(parse(d))]}</span></div>`).join('')}</div>
  </section>

  <section class="sec">
    <h2 class="sec-t"><span>Séance du jour</span></h2>
    ${picks('today-status', day.status)}
    <div class="today-meta">
      <span>${day.type ? esc(day.type) : 'Aucun type choisi'}</span>
      <button class="link" data-act="open-day" data-date="${t}">Type et notes</button>
    </div>
  </section>

  <section class="sec">
    <h2 class="sec-t"><span>Poids</span></h2>
    <div class="poids">
      <div><span class="kg">${kgf(cur)}</span><span class="u">kg</span></div>
      <div class="obj">objectif<b>${kgf(goal)} kg</b></div>
    </div>
    <div class="pl" aria-hidden="true"><i style="width:${(progress() * 100).toFixed(1)}%"></i><b style="left:${(progress() * 100).toFixed(1)}%"></b></div>
    <p class="w-note">${reached ? 'Objectif atteint. Bravo !' : `Il reste ${kgf(rest)} kg ${verb}.`}</p>
    <button class="btn ghost block" data-act="open-weight">Me peser</button>
    ${since >= 7 ? `<div class="callout">${lw ? `Dernière pesée il y a ${since} jours.` : 'Aucune pesée enregistrée.'}</div>` : ''}
  </section>

  <section class="sec">
    <h2 class="sec-t"><span>Cette semaine</span></h2>
    <div class="week">${weekHtml}</div>
    <p class="center" style="margin-top:6px"><button class="link" data-act="tab" data-tab="cal">Voir le calendrier</button></p>
  </section>

  <section class="stats3">
    <div class="st"><b>${doneMonth}</b><span>${plural(doneMonth, 'séance faite', 'séances faites')} ce mois-ci</span></div>
    <div class="st"><b>${wDeltaTxt}</b><span>kg depuis le départ</span></div>
    <div class="st"><b>${esc(nextTxt)}</b><span>${upcoming ? 'prochaine séance prévue' : 'aucune séance prévue'}</span></div>
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
    const hasType = !!(day.type && day.status);
    const cls = ['cell', day.status || '', ds === t ? 'today' : '', ds < s.startDate ? 'before' : '', ds === s.weddingDate ? 'wed' : ''].join(' ');
    cells += `<button class="${cls}" data-act="open-day" data-date="${ds}" aria-label="${esc(fmt(ds, { weekday: 'long', day: 'numeric', month: 'long' }))}"><span class="d">${ds === s.weddingDate ? '♥' : d}</span>${hasType ? `<span class="t">${esc(SHORT[day.type] || day.type.slice(0, 5))}</span>` : ''}${day.status === 'planned' ? ringOverlay() : ''}${day.status === 'done' ? strikeOverlay() : ''}${day.creatine ? '<i class="cr"></i>' : ''}</button>`;
  }
  const trail = (7 - ((lead + dim) % 7)) % 7;
  for (let i = 0; i < trail; i++) cells += '<span class="cell out"></span>';
  return `
  <div class="cal-top">
    <button class="icon-btn" data-act="cal-prev" aria-label="Mois précédent">${svg('left')}</button>
    <div><h1>${title}</h1><p class="yr">${y}</p></div>
    <button class="icon-btn" data-act="cal-next" aria-label="Mois suivant">${svg('right')}</button>
  </div>
  <div class="cal">
    <div class="dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
  </div>
  <div class="legend">
    <span class="g">${circleMark()}<span style="color:var(--encre)">Séance prévue</span></span>
    <span>${crossMark()}Séance faite</span>
    <span><i class="lgdot"></i>Créatine prise</span>
  </div>
  <div class="month-sum">
    <p>${done} ${plural(done, 'faite', 'faites')}, ${planned} ${plural(planned, 'restante', 'restantes')} ce mois-ci</p>
    <button class="link" data-act="cal-today">Aujourd’hui</button>
  </div>
  <div class="actions"><button class="btn ghost block" data-act="open-rec">Programme récurrent</button></div>`;
}

function chartSVG() {
  const s = S.settings, W = 340, H = 230, L = 36, R = 14, T = 16, B = 28;
  const t0 = +parse(s.startDate), t1 = +parse(s.weddingDate);
  const ws = sortedWeights();
  const vals = [s.startWeight, s.goalWeight, ...ws.map((w) => w.kg)];
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const X = (d) => L + Math.min(1, Math.max(0, (+parse(d) - t0) / (t1 - t0))) * (W - L - R);
  const Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const f = (n) => n.toFixed(1);
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    grid += `<line x1="${L}" x2="${W - R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text x="${L - 8}" y="${f(Y(v) + 4)}" text-anchor="end">${Math.round(v * 2) / 2}</text>`;
  }
  const pts = ws.map((w) => [X(w.date), Y(w.kg)]);
  // courbe lissée (spline de Catmull-Rom convertie en Bézier)
  let d = '';
  if (pts.length > 1) {
    d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
  }
  const area = pts.length > 1 ? `<path d="${d}L${f(pts[pts.length - 1][0])} ${H - B}L${f(pts[0][0])} ${H - B}Z" fill="url(#cg)"/>` : '';
  const line = pts.length > 1 ? `<path class="line" d="${d}"/>` : '';
  const dots = pts.map((p) => `<circle class="pt" cx="${f(p[0])}" cy="${f(p[1])}" r="${pts.length > 20 ? 2.6 : 4.6}"/>`).join('');
  const tx = X(todayStr());
  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de poids">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--or);stop-opacity:.2"/><stop offset="1" style="stop-color:var(--or);stop-opacity:0"/></linearGradient></defs>
    <g class="grid">${grid}</g>
    <line class="todayline" x1="${f(tx)}" x2="${f(tx)}" y1="${T}" y2="${H - B}"/>
    <path class="ideal" d="M${L} ${f(Y(s.startWeight))}L${W - R} ${f(Y(s.goalWeight))}"/>
    ${area}${line}${dots}
    <circle class="goalpt" cx="${W - R}" cy="${f(Y(s.goalWeight))}" r="6"/>
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
    return `<li><div class="d"><b>${esc(fmt(w.date, { day: 'numeric', month: 'long', year: 'numeric' }))}</b><small>${esc(fmt(w.date, { weekday: 'long' }))}</small></div><span class="k">${fixedNum(kgf(w.kg))}</span><span class="delta ${cls}">${fixedNum(txt)}</span><button class="x-btn" data-act="del-weight" data-id="${w.id}" aria-label="Supprimer la pesée du ${esc(fmt(w.date, { day: 'numeric', month: 'long', year: 'numeric' }))}">×</button></li>`;
  }).join('');
  const lost = Math.round((first - cur) * 10) / 10;
  return `
  <div class="page-title"><h1>Poids</h1><button class="btn sm" data-act="open-weight">Me peser</button></div>
  <div class="chart-wrap">${chartSVG()}</div>
  <div class="chart-legend"><span>Tes pesées</span><span class="i">Trajectoire vers le grand jour</span></div>
  <div class="facts">
    <div class="fact"><b>${kgf(first)}</b><span>départ</span></div>
    <div class="fact"><b>${kgf(cur)}</b><span>actuel</span></div>
    <div class="fact"><b>${kgf(s.goalWeight)}</b><span>objectif</span></div>
  </div>
  <section class="sec">
    <h2 class="sec-t"><span>Historique</span></h2>
    ${ws.length ? `<p class="small mute center" style="margin:-8px 0 10px">${lost === 0 ? 'Aucun écart depuis le départ.' : `${lost > 0 ? '−' : '+'}${kgf(Math.abs(lost))} kg depuis le départ.`}</p><ul class="hist">${hist}</ul>` : '<p class="mute center">Aucune pesée pour l’instant. Pèse-toi chaque dimanche, à jeun, pour comparer ce qui est comparable.</p>'}
  </section>`;
}

function viewPhotos() {
  if (!S.photosLoaded) return `<div class="page-title"><h1>Photos</h1></div><div class="empty"><div class="spin"></div></div>`;
  const list = S.photos;
  const head = `<div class="page-title"><h1>Photos</h1><button class="btn sm" data-act="open-photo-add">Ajouter</button></div>`;
  if (!list.length) {
    return `${head}<div class="empty"><p>Ta première photo, c’est le point de départ.</p><p class="small">Même lumière, même endroit, même heure : c’est ce qui rend la comparaison parlante.</p></div>`;
  }
  const canCompare = POSES.some((po) => list.filter((p) => p.pose === po).length >= 2);
  const num = new Map(list.map((p, i) => [p.id, i + 1]));
  return `${head}
  ${canCompare ? '<div class="actions"><button class="btn ghost block" data-act="compare">Comparer avant et maintenant</button></div>' : ''}
  <div class="pgrid">${list.map((p) => `<button class="ph" data-act="open-photo" data-id="${p.id}" aria-label="Photo ${num.get(p.id)}, ${esc(fmt(p.date))}"><span class="fr"><img src="${p.thumb}" alt="" loading="lazy"></span><span class="cap">N° ${pad(num.get(p.id))}<small>${esc(fmt(p.date, { day: 'numeric', month: 'long', year: 'numeric' }))}</small></span></button>`).join('')}</div>`;
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
  <section class="sec">${settingsForm(S.settings, false)}</section>
  ${DEMO ? `<section class="sec"><h2 class="sec-t"><span>Mode démo</span></h2><p class="small mute center" style="margin:-6px 0 18px">Pas encore de serveur : tes données restent sur cet appareil. Elles seront remplacées par la vraie base une fois connectée.</p><button class="btn ghost block" data-act="demo-sample">Charger des données d’exemple</button><button class="btn danger block" style="margin-top:10px" data-act="demo-reset">Tout effacer</button></section>` : ''}
  <section class="sec" style="padding-bottom:20px">
    <button class="btn ghost block" data-act="logout">Se déconnecter</button>
    <p class="small mute center" style="margin-top:18px">Tes données restent enregistrées. Tu les retrouveras en te reconnectant.</p>
    <p class="small mute center" style="margin-top:6px">Version 19</p>
  </section>`;
}

const VIEWS = { home: viewHome, cal: viewCal, weight: viewWeight, photos: viewPhotos, more: viewMore };
const TABS = [['home', 'Accueil', 'today'], ['cal', 'Calendrier', 'cal'], ['weight', 'Poids', 'weight'], ['photos', 'Photos', 'photos'], ['more', 'Réglages', 'more']];

function render() {
  if (!S.settings) return;
  document.body.classList.remove('bare');
  $('#view').innerHTML = VIEWS[S.tab]();
  saveCache();
  if (S.tab === 'home') animateCount();
  const tabs = $('#tabs');
  tabs.hidden = false;
  tabs.innerHTML = TABS.map(([k, label, ic]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" aria-label="${label}" ${S.tab === k ? 'aria-current="page"' : ''}>${label}</button>`).join('');
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
    <div class="gate-top">${brand()}<p class="lead">Ton carnet d’entraînement jusqu’au mariage.</p></div>
    <div class="gate-card">
      <label class="field"><span>Mot de passe</span><input id="pw" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password"></label>
      <p class="err" id="login-err"></p>
      <button class="btn block" data-act="login">Entrer</button>
      <p class="small mute center" style="margin-top:22px">${DEMO ? 'Mode démo' : `Serveur : ${esc(serverLabel())}`} · version ${VERSION}</p>
    </div>
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
    $('#login-err').textContent = /ne répond pas/.test(e.message) ? `${e.message} (${netDetail()})` : e.message;
  }
}

function showOnboarding() {
  $('#splash').hidden = true;
  $('#tabs').hidden = true;
  document.body.classList.add('bare');
  $('#view').innerHTML = `
  <div class="gate">
    <div class="gate-top">${rings('gate-rings')}<h1>Fixe<br>la date</h1><p class="lead">Quelques chiffres pour lancer ton compte à rebours jusqu’au grand jour.</p></div>
    <div class="gate-card">
      ${DEMO
        ? '<div class="callout" style="margin:0 0 24px">Mode démo : ce site n’est pas relié au serveur, donc aucun mot de passe n’est demandé et tes données restent sur cet appareil.</div>'
        : ''}
      ${settingsForm({ name: '', weddingDate: plusMonths(6), startDate: addDays(todayStr(), -1), startWeight: '', goalWeight: '', creatineDose: 5 }, true)}
      ${DEMO ? '' : '<p class="center" style="margin-top:22px"><button class="link" data-act="logout">Déjà inscrit ? Revenir à la connexion</button></p>'}
    </div>
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
  } catch (e) {
    fail(e);
    const er = $('#f-err');
    if (er && e.message !== 'unauth') er.textContent = e.message;   // l'erreur reste affichée dans le formulaire
    btn.disabled = false;
  }
}

function splash(html) { const s = $('#splash'); s.innerHTML = html; s.hidden = false; }

async function boot() {
  if (DEMO && !token.v) token.v = 'demo';
  if (!token.v) return showLogin();
  // Ouverture instantanée : on affiche les dernières données connues, puis on se met à jour en arrière-plan
  const cached = DEMO ? null : loadCache();
  if (cached) {
    applyState(cached);
    $('#splash').hidden = true;
    S.tab = 'home';
    render();
    refreshInBackground();
    return;
  }
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
    splash(`<p>${esc(e.message)}</p><p class="small mute" style="max-width:22em">${esc(netDetail())}</p><button class="btn" data-act="retry">Réessayer</button><a class="btn ghost" href="${esc(API)}/api/health" target="_blank" rel="noopener">Tester le serveur</a>`);
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

/* --- Confirmation (le confirm() du navigateur est bloqué dans certains contextes) --- */
let confirmCb = null;
function askConfirm(title, text, label, cb) {
  confirmCb = cb;
  openSheet(() => `
  <h3>${esc(title)}</h3>
  <p class="sub">${esc(text)}</p>
  <button class="btn danger block" data-act="confirm-yes">${esc(label)}</button>
  <button class="btn ghost block" style="margin-top:10px" data-act="close-sheet">Annuler</button>`);
}

/* --- Jour --- */
let daySheetDate = null;
function daySheet() {
  const d = daySheetDate, day = S.days[d] || blankDay(d);
  return `
  <h3>${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
  <p class="sub">${d === S.settings.weddingDate ? 'Le grand jour.' : d > todayStr() ? 'À venir' : d === todayStr() ? 'Aujourd’hui' : 'Passé'}</p>
  ${picks('day-status', day.status)}
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
  const t = todayStr();
  const pending = Object.values(S.days).filter((d) => d.status === 'planned' && d.date >= t).length;
  const none = recDays.size === 0;
  const msg = none
    ? (pending ? `Aucun jour choisi : les ${pending} ${plural(pending, 'séance prévue', 'séances prévues')} à venir seront retirées. Les séances faites ne bougent pas.` : 'Aucun jour choisi, et aucune séance prévue à venir.')
    : `${n} ${plural(n, 'séance sera prévue', 'séances seront prévues')}.`;
  return `
  <h3>Programme récurrent</h3>
  <p class="sub">Choisis tes jours d’entraînement : ils seront prévus jusqu’au mariage. Décoche tout pour retirer les séances prévues.</p>
  <div class="chips">${DOW_LONG.map((l, i) => `<button class="chip ${recDays.has(i) ? 'on' : ''}" data-act="rec-day" data-v="${i}">${l}</button>`).join('')}</div>
  <p class="small mute" style="margin:20px 0 10px">${msg}</p>
  <p class="err" id="rec-err" style="margin:0 0 12px"></p>
  <button class="btn ${none ? 'danger' : ''} block" data-act="save-rec" ${none && !pending ? 'disabled' : ''}>${none ? 'Retirer les séances prévues' : 'Planifier'}</button>`;
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

/* --- Modifier une photo --- */
let eSheet = { id: '', date: '', pose: 'Face' };
function editPhotoSheet() {
  const idx = S.photos.findIndex((x) => x.id === eSheet.id);
  return `
  <h3>Modifier la photo</h3>
  <p class="sub">Vue ${pad(idx + 1)}</p>
  <label class="field"><span>Date</span><input id="e-date" type="date" value="${eSheet.date}" max="${todayStr()}"></label>
  <span class="lbl">Pose</span>
  <div class="chips">${POSES.map((po) => `<button class="chip ${eSheet.pose === po ? 'on' : ''}" data-act="epose" data-v="${po}">${po}</button>`).join('')}</div>
  <button class="btn block" style="margin-top:26px" data-act="save-photo-edit">Enregistrer</button>
  <button class="btn danger block" style="margin-top:10px" data-act="del-photo" data-id="${eSheet.id}">Supprimer cette photo</button>`;
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

function viewerBar(p) {
  return `
      <button class="icon-btn" data-act="photo-step" data-v="-1" aria-label="Photo plus ancienne" ${viewer.i === 0 ? 'disabled' : ''}>${svg('left')}</button>
      <div class="ov-mid"><button class="btn ghost sm" data-act="edit-photo" data-id="${p.id}">Modifier</button><button class="btn danger sm" data-act="ask-del-photo" data-id="${p.id}">Supprimer</button></div>
      <button class="icon-btn" data-act="photo-step" data-v="1" aria-label="Photo plus récente" ${viewer.i === viewer.ids.length - 1 ? 'disabled' : ''}>${svg('right')}</button>`;
}
function viewerConfirmBar(p) {
  return `
      <p class="ov-q">Supprimer cette photo ?</p>
      <div class="ov-mid"><button class="btn ghost sm" data-act="cancel-del-photo" data-id="${p.id}">Annuler</button><button class="btn sm ov-yes" data-act="del-photo-yes" data-id="${p.id}">Oui, supprimer</button></div>`;
}
async function deletePhoto(id) {
  try {
    await api('/api/photos/' + id, { method: 'DELETE' });
    S.photos = S.photos.filter((p) => p.id !== id);
    delete S.full[id];
    closeSheet(true); closeOverlay(); render(); toast('Photo supprimée');
  } catch (err) { fail(err); }
}

async function showViewer() {
  const id = viewer.ids[viewer.i];
  const p = S.photos.find((x) => x.id === id);
  if (!p) return closeOverlay();
  overlay(`
    <div class="ov-top"><div class="cap">${esc(fmt(p.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}<small>${esc(p.pose)}${p.kg ? ' · ' + kgf(p.kg) + ' kg' : ''}</small></div><button class="icon-btn" data-act="close-overlay" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="ov-stage" id="stage"><img src="${p.thumb}" alt="" style="filter:blur(2px)"></div>
    <div class="ov-bottom">${viewerBar(p)}</div>`);
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
      askConfirm('Tout effacer ?', 'Toutes les données de la démo seront supprimées.', 'Tout effacer', async () => {
        demoDB = { settings: null, days: {}, weights: [], photos: [] }; demoSave();
        S.settings = null; S.days = {}; S.weights = []; S.photos = []; S.photosLoaded = false; S.full = {};
        showOnboarding();
      });
      break;
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
      const label = el.textContent;
      el.disabled = true;
      const showErr = (err) => { const er = $('#rec-err'); if (er && err.message !== 'unauth') er.textContent = err.message; };
      const er0 = $('#rec-err'); if (er0) er0.textContent = '';
      try {
        if (!recDays.size) {
          el.textContent = 'Un instant…';
          await api('/api/days/clear-planned', { method: 'POST', body: { from: t } });
          Object.keys(S.days).forEach((k) => {
            const d = S.days[k];
            if (d.status === 'planned' && k >= t) { if (!d.type && !d.note && !d.creatine) delete S.days[k]; else S.days[k] = { ...d, status: '' }; }
          });
          closeSheet(); render(); toast('Séances prévues retirées');
        } else {
          const dates = recDates();
          // petits lots : chaque requête reste courte, même avec un serveur ou une connexion lents
          for (let k = 0; k < dates.length; k += 30) {
            const chunk = dates.slice(k, k + 30);
            el.textContent = `Planification… ${Math.min(k + 30, dates.length)}/${dates.length}`;
            await api('/api/days/bulk', { method: 'POST', body: { dates: chunk } });
            chunk.forEach((d) => { if (!S.days[d] || S.days[d].status !== 'done') S.days[d] = { ...(S.days[d] || blankDay(d)), status: 'planned' }; });
          }
          closeSheet(); render(); toast(`${dates.length} ${plural(dates.length, 'séance prévue', 'séances prévues')}`);
        }
      } catch (err) { fail(err); showErr(err); el.disabled = false; el.textContent = label; render(); }
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
    case 'del-weight': {
      const id = el.dataset.id;
      askConfirm('Supprimer cette pesée ?', 'Elle sera effacée de l’historique et de la courbe.', 'Supprimer', async () => {
        try { await api('/api/weights/' + id, { method: 'DELETE' }); S.weights = S.weights.filter((w) => w.id !== id); render(); toast('Pesée supprimée'); } catch (err) { fail(err); }
      });
      break;
    }

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
    case 'edit-photo': {
      const ph = S.photos.find((x) => x.id === el.dataset.id);
      if (!ph) break;
      eSheet = { id: ph.id, date: ph.date, pose: ph.pose };
      openSheet(editPhotoSheet); break;
    }
    case 'epose': eSheet.date = ($('#e-date') || {}).value || eSheet.date; eSheet.pose = v; refreshSheet(); break;
    case 'save-photo-edit': {
      const date = $('#e-date').value;
      if (!date) return toast('Choisis une date.', true);
      el.disabled = true;
      try {
        const upd = await api('/api/photos/' + eSheet.id, { method: 'PUT', body: { date, pose: eSheet.pose } });
        S.photos = S.photos.map((x) => (x.id === upd.id ? { ...x, date: upd.date, pose: upd.pose } : x));
        S.photos.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
        closeSheet(); render();
        viewer = { ids: S.photos.map((x) => x.id), i: S.photos.findIndex((x) => x.id === upd.id) };
        showViewer(); toast('Photo modifiée');
      } catch (err) { fail(err); el.disabled = false; }
      break;
    }
    case 'photo-step': viewer.i = Math.max(0, Math.min(viewer.ids.length - 1, viewer.i + Number(v))); showViewer(); break;
    case 'del-photo': { // depuis la fenêtre « Modifier » : confirmation dans une fenêtre
      const id = el.dataset.id;
      askConfirm('Supprimer cette photo ?', 'Elle sera définitivement effacée.', 'Supprimer', () => deletePhoto(id));
      break;
    }
    case 'ask-del-photo': case 'cancel-del-photo': { // depuis la visionneuse : confirmation dans la barre du bas
      const p = S.photos.find((x) => x.id === el.dataset.id);
      const bar = document.querySelector('#overlay .ov-bottom');
      if (p && bar) bar.innerHTML = act === 'ask-del-photo' ? viewerConfirmBar(p) : viewerBar(p);
      break;
    }
    case 'del-photo-yes': await deletePhoto(el.dataset.id); break;
    case 'compare': showCompare(); break;
    case 'close-overlay': closeOverlay(); break;
    case 'close-sheet': closeSheet(); break;
    case 'confirm-yes': { const cb = confirmCb; confirmCb = null; closeSheet(); if (cb) await cb(); break; }
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
