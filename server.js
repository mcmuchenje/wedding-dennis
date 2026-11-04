const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3003;

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DATA_DIR = path.join(__dirname, 'data');
const RSVP_PATH = path.join(DATA_DIR, 'rsvps.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(RSVP_PATH)) fs.writeFileSync(RSVP_PATH, '[]');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function loadRsvps() {
  return JSON.parse(fs.readFileSync(RSVP_PATH, 'utf8'));
}

function saveRsvps(rsvps) {
  fs.writeFileSync(RSVP_PATH, JSON.stringify(rsvps, null, 2));
}

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  res.status(401).json({ error: 'Sign in required' });
}

// --- Public API ---

app.get('/api/config', (req, res) => {
  const { adminPassword, ...publicConfig } = loadConfig();
  res.json(publicConfig);
});

app.get('/api/photos', (req, res) => {
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => /\.(jpe?g|png|gif|webp|avif)$/i.test(f))
    .sort();
  res.json(files.map(f => `/uploads/${f}`));
});

app.post('/api/rsvp', (req, res) => {
  const { name, email, phone, attending, guests, message } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Please tell us your name' });
  }
  if (attending !== 'yes' && attending !== 'no') {
    return res.status(400).json({ error: 'Please let us know if you can attend' });
  }
  const guestCount = Math.min(Math.max(parseInt(guests, 10) || 1, 1), 4);
  const rsvps = loadRsvps();
  rsvps.push({
    id: crypto.randomUUID(),
    name: String(name).trim().slice(0, 120),
    email: String(email || '').trim().slice(0, 200),
    phone: String(phone || '').trim().slice(0, 40),
    attending,
    guests: attending === 'yes' ? guestCount : 0,
    message: String(message || '').trim().slice(0, 1000),
    submittedAt: new Date().toISOString()
  });
  saveRsvps(rsvps);
  res.json({ ok: true });
});

// --- Auth ---

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  const config = loadConfig();
  const expected = Buffer.from(String(config.adminPassword));
  const given = Buffer.from(String(password || ''));
  const match = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!match) return res.status(401).json({ error: 'Incorrect password' });
  req.session.authed = true;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ authed: !!(req.session && req.session.authed) });
});

// --- Admin API (auth required) ---

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpe?g|png|gif|webp|avif)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});

app.post('/api/photos', requireAuth, (req, res) => {
  upload.array('photos', 20)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ ok: true, uploaded: (req.files || []).length });
  });
});

app.delete('/api/photos/:name', requireAuth, (req, res) => {
  const name = path.basename(req.params.name);
  const target = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'Photo not found' });
  fs.unlinkSync(target);
  res.json({ ok: true });
});

app.get('/api/rsvps', requireAuth, (req, res) => {
  res.json(loadRsvps());
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Wedding site running at http://localhost:${PORT}`);
  console.log(`Admin page at http://localhost:${PORT}/admin`);
});
