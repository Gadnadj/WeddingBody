import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const {
  MONGODB_URI,
  APP_PASSWORD,
  JWT_SECRET,
  FRONTEND_URL = '',
  PORT = 3000,
} = process.env;

if (!MONGODB_URI || !APP_PASSWORD || !JWT_SECRET) {
  console.error('Variables manquantes : MONGODB_URI, APP_PASSWORD et JWT_SECRET sont obligatoires.');
  process.exit(1);
}

/* Le serveur ne doit jamais s'arrêter sur une erreur imprévue : on la note dans les logs et on continue */
process.on('unhandledRejection', (e) => console.error('Promesse non gérée :', e));
process.on('uncaughtException', (e) => console.error('Exception non gérée :', e));
mongoose.connection.on('error', (e) => console.error('MongoDB :', e.message));
mongoose.connection.on('disconnected', () => console.warn('MongoDB déconnecté, reconnexion automatique…'));

/* ---------- Modèles ---------- */
const clean = { versionKey: false };

const Settings = mongoose.model('Settings', new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  name: { type: String, default: '', maxlength: 40 },
  weddingDate: String,
  startDate: String,
  startWeight: Number,
  goalWeight: Number,
  creatineDose: { type: Number, default: 5 },
}, clean));

const Day = mongoose.model('Day', new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  status: { type: String, enum: ['', 'planned', 'done'], default: '' },
  type: { type: String, default: '', maxlength: 40 },
  note: { type: String, default: '', maxlength: 1000 },
  creatine: { type: Boolean, default: false },
}, clean));

const Weight = mongoose.model('Weight', new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  kg: { type: Number, required: true },
}, clean));

const Photo = mongoose.model('Photo', new mongoose.Schema({
  date: { type: String, required: true, index: true },
  pose: { type: String, default: 'Face', maxlength: 20 },
  kg: { type: Number, default: null },
  thumb: { type: String, required: true },
  data: { type: String, required: true },
}, clean));

/* ---------- Utilitaires ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => typeof s === 'string' && DATE_RE.test(s);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const out = (doc) => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
};

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const samePassword = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

/* ---------- App ---------- */
const app = express();
app.set('trust proxy', 1);

// Adresses autorisées : on ne garde que « https://domaine » (sans chemin, sans slash final, sans majuscules)
const normalize = (u) => {
  const t = String(u).trim();
  if (!t) return '';
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`; // on tolère l'oubli du « https:// »
  try { return new URL(withScheme).origin.toLowerCase(); } catch { return t.replace(/\/+$/, '').toLowerCase(); }
};
const allowed = FRONTEND_URL.split(',').map(normalize).filter(Boolean);
console.log('Origines autorisées :', allowed.length ? allowed.join(', ') : '(toutes)');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || !allowed.length || allowed.includes(origin.toLowerCase())) return cb(null, true);
    // On ne plante plus : on refuse poliment et on écrit l'adresse exacte dans les logs
    console.warn(`CORS : origine refusée « ${origin} ». Autorisées : ${allowed.join(', ')}`);
    cb(null, false);
  },
}));
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* Connexion (mot de passe unique) avec petite protection anti-force-brute */
const attempts = new Map();
app.post('/api/login', (req, res) => {
  const ip = req.headers['x-nf-client-connection-ip'] || req.ip;
  const rec = attempts.get(ip) || { n: 0, until: 0 };
  if (rec.until > Date.now()) {
    return res.status(429).json({ error: 'Trop d’essais. Réessaie dans quelques minutes.' });
  }
  const { password } = req.body || {};
  if (typeof password === 'string' && samePassword(password, APP_PASSWORD)) {
    attempts.delete(ip);
    const token = jwt.sign({ ok: true }, JWT_SECRET, { expiresIn: '180d' });
    return res.json({ token });
  }
  rec.n += 1;
  if (rec.n >= 5) { rec.until = Date.now() + 5 * 60 * 1000; rec.n = 0; }
  attempts.set(ip, rec);
  res.status(401).json({ error: 'Mot de passe incorrect.' });
});

/* Tout ce qui suit demande d'être connecté */
app.use('/api', (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée.' });
  }
});

const isDup = (e) => !!e && (e.code === 11000 || (Array.isArray(e.writeErrors) && e.writeErrors.length > 0 && e.writeErrors.every((w) => (w.code ?? w.err?.code) === 11000)));
const retryDup = async (fn) => { try { return await fn(); } catch (e) { if (isDup(e)) return fn(); throw e; } };

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Erreur serveur.' });
});

/* État complet (hors photos) */
app.get('/api/state', wrap(async (_req, res) => {
  const [settings, days, weights] = await Promise.all([
    Settings.findOne({ key: 'main' }).lean(),
    Day.find().lean(),
    Weight.find().sort({ date: 1 }).lean(),
  ]);
  res.json({
    settings: settings && settings.weddingDate ? out(settings) : null,
    days: days.map(out),
    weights: weights.map(out),
  });
}));

/* Réglages */
app.put('/api/settings', wrap(async (req, res) => {
  const b = req.body || {};
  if (!isDate(b.weddingDate) || !isDate(b.startDate)) return res.status(400).json({ error: 'Dates invalides.' });
  if (!isNum(b.startWeight) || !isNum(b.goalWeight)) return res.status(400).json({ error: 'Poids invalides.' });
  const doc = await retryDup(() => Settings.findOneAndUpdate(
    { key: 'main' },
    {
      key: 'main',
      name: String(b.name || '').slice(0, 40),
      weddingDate: b.weddingDate,
      startDate: b.startDate,
      startWeight: b.startWeight,
      goalWeight: b.goalWeight,
      creatineDose: isNum(b.creatineDose) ? b.creatineDose : 5,
    },
    { upsert: true, new: true, lean: true },
  ));
  res.json(out(doc));
}));

/* Jours (séance, créatine, note) */
app.put('/api/days/:date', wrap(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'Date invalide.' });
  const b = req.body || {};
  const status = ['', 'planned', 'done'].includes(b.status) ? b.status : '';
  const doc = {
    status,
    type: String(b.type || '').slice(0, 40),
    note: String(b.note || '').slice(0, 1000),
    creatine: !!b.creatine,
  };
  if (!doc.status && !doc.type && !doc.note && !doc.creatine) {
    await Day.deleteOne({ date });
    return res.json({ date, deleted: true });
  }
  const saved = await retryDup(() => Day.findOneAndUpdate({ date }, { date, ...doc }, { upsert: true, new: true, lean: true }));
  res.json(out(saved));
}));

/* Planification en lot (programme récurrent) */
app.post('/api/days/bulk', wrap(async (req, res) => {
  const dates = Array.isArray(req.body?.dates) ? req.body.dates.filter(isDate).slice(0, 400) : [];
  if (!dates.length) return res.json({ planned: 0 });
  const existing = await Day.find({ date: { $in: dates } }).lean();
  const byDate = new Map(existing.map((d) => [d.date, d]));
  const ops = [];
  for (const date of dates) {
    const cur = byDate.get(date);
    if (cur && cur.status === 'done') continue;
    ops.push({ updateOne: { filter: { date }, update: { $set: { status: 'planned' } }, upsert: true } });
  }
  if (ops.length) await retryDup(() => Day.bulkWrite(ops, { ordered: false }));
  res.json({ planned: ops.length });
}));

/* Retirer les séances prévues à venir (les séances faites ne bougent pas) */
app.post('/api/days/clear-planned', wrap(async (req, res) => {
  const from = req.body?.from;
  if (!isDate(from)) return res.status(400).json({ error: 'Date invalide.' });
  const q = { status: 'planned', date: { $gte: from } };
  const del = await Day.deleteMany({ ...q, type: '', note: '', creatine: false });
  const upd = await Day.updateMany(q, { $set: { status: '' } });
  res.json({ cleared: del.deletedCount + upd.modifiedCount });
}));

/* Pesées (une par date) */
app.post('/api/weights', wrap(async (req, res) => {
  const { date, kg } = req.body || {};
  if (!isDate(date) || !isNum(kg) || kg < 20 || kg > 400) return res.status(400).json({ error: 'Pesée invalide.' });
  const doc = await retryDup(() => Weight.findOneAndUpdate({ date }, { date, kg }, { upsert: true, new: true, lean: true }));
  res.json(out(doc));
}));

app.delete('/api/weights/:id', wrap(async (req, res) => {
  await Weight.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
}));

/* Photos */
app.get('/api/photos', wrap(async (_req, res) => {
  const list = await Photo.find().select('-data').sort({ date: 1, _id: 1 }).lean();
  res.json(list.map(out));
}));

app.get('/api/photos/:id', wrap(async (req, res) => {
  const p = await Photo.findById(req.params.id).lean();
  if (!p) return res.status(404).json({ error: 'Photo introuvable.' });
  res.json({ id: String(p._id), data: p.data });
}));

app.post('/api/photos', wrap(async (req, res) => {
  const { date, pose, kg, thumb, data } = req.body || {};
  const okImg = (s) => typeof s === 'string' && s.startsWith('data:image/jpeg;base64,') && s.length < 5_000_000;
  if (!isDate(date) || !okImg(thumb) || !okImg(data)) return res.status(400).json({ error: 'Photo invalide.' });
  const doc = await Photo.create({
    date,
    pose: String(pose || 'Face').slice(0, 20),
    kg: isNum(kg) ? kg : null,
    thumb,
    data,
  });
  const { data: _omit, ...meta } = doc.toObject();
  res.json(out(meta));
}));

app.put('/api/photos/:id', wrap(async (req, res) => {
  const { date, pose } = req.body || {};
  if (!isDate(date)) return res.status(400).json({ error: 'Date invalide.' });
  const upd = { date };
  if (typeof pose === 'string') upd.pose = pose.slice(0, 20);
  const doc = await Photo.findByIdAndUpdate(req.params.id, upd, { new: true }).select('-data').lean();
  if (!doc) return res.status(404).json({ error: 'Photo introuvable.' });
  res.json(out(doc));
}));

app.delete('/api/photos/:id', wrap(async (req, res) => {
  await Photo.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
}));

/* Erreurs imprévues (corps illisible, fichier trop lourd…) : réponse claire au lieu d'un plantage */
app.use((err, _req, res, _next) => {
  console.error('Erreur :', err && err.message);
  if (res.headersSent) return;
  const tooBig = err && err.type === 'entity.too.large';
  res.status(tooBig ? 413 : err && err.status ? err.status : 500).json({ error: tooBig ? 'Fichier trop lourd.' : 'Erreur serveur.' });
});

/* ---------- Démarrage ---------- */
try {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connecté');
  app.listen(PORT, () => console.log(`API prête sur le port ${PORT}`));
} catch (e) {
  console.error('Connexion MongoDB impossible :', e.message);
  process.exit(1);
}
