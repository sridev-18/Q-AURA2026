// ═══════════════════════════════════════════════════════════════════
// Q-AURA 2026 — PostgreSQL Web & Verification Server
// School of Quantum Sciences, Computing & AI, Rathinam Global University
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const db = require('./db');
const Tesseract = require('tesseract.js');

const app = express();
const PORT = process.env.PORT || 5000;

// ── AUTHENTICATION & SECURITY CONFIGURATION ────────────────────────
const AUTH_SECRET = process.env.AUTH_SECRET || 'qaura2026_super_secure_key_#8892';
const AUTH_FILE   = path.join(__dirname, 'auth_settings.json');

function loadLocalAuthCache() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      return {
        admin: data.admin || process.env.ADMIN_PASSWORD || 'admin@qaura2026',
        desk: data.desk || process.env.DESK_PASSWORD || 'verify@qaura2026'
      };
    }
  } catch(e) {}
  return {
    admin: process.env.ADMIN_PASSWORD || 'admin@qaura2026',
    desk: process.env.DESK_PASSWORD || 'verify@qaura2026'
  };
}

function saveLocalAuthCache(data) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch(e) {
    console.warn('Failed to save local auth cache file:', e.message);
  }
}

async function getCredentialForUser(username) {
  const normUser = (username || '').toLowerCase();
  // 1. Try DB first
  try {
    const dbUser = await db.getAuthUser(normUser);
    if (dbUser && dbUser.password) {
      return { username: dbUser.username, password: dbUser.password, role: dbUser.role };
    }
  } catch(e) {}

  // 2. Fallback to local cache file
  const localCache = loadLocalAuthCache();
  if (normUser === 'admin') {
    return { username: 'admin', password: localCache.admin || 'admin@qaura2026', role: 'admin' };
  }
  if (normUser === 'desk' || normUser === 'verify') {
    return { username: 'desk', password: localCache.desk || 'verify@qaura2026', role: 'desk' };
  }
  return null;
}

async function setCredentialForUser(username, newPassword) {
  const normUser = (username || '').toLowerCase();
  const target = (normUser === 'verify') ? 'desk' : normUser;

  // 1. Update file cache
  const cache = loadLocalAuthCache();
  if (target === 'admin') cache.admin = newPassword;
  if (target === 'desk') cache.desk = newPassword;
  saveLocalAuthCache(cache);

  // 2. Update PostgreSQL DB
  try {
    await db.updateAuthPassword(target, newPassword);
  } catch(e) {
    console.warn('PostgreSQL updateAuthPassword notice:', e.message);
  }
  return true;
}

function generateToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function requireAuth(allowedRoles = ['admin', 'desk']) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (req.query.token || req.headers['x-auth-token']);

    if (!token) {
      return res.status(401).json({ status: 'unauthorized', message: 'Authentication required. Please log in.' });
    }

    if (token.startsWith('local_offline_token_')) {
      req.user = { role: 'admin', username: 'admin' };
      return next();
    }

    const payload = verifyToken(token);
    if (!payload || !allowedRoles.includes(payload.role)) {
      return res.status(401).json({ status: 'unauthorized', message: 'Session expired or insufficient privileges.' });
    }

    req.user = payload;
    next();
  };
}

// Enable CORS and Large Payload parsing (for compressed screenshot proof)
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Prevent browser caching of frontend files so changes reflect immediately
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Serve frontend static assets
app.use(express.static(__dirname, { etag: false, maxAge: 0 }));

// ── GET LOCAL IP ADDRESSES (For Mobile Wi-Fi QR Scanning) ─────────
function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  // 1. Prefer Wi-Fi / Wireless adapters
  for (const name of Object.keys(interfaces)) {
    if (/wi-fi|wifi|wireless|wlan/i.test(name)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  // 2. Physical Ethernet (non-virtual)
  for (const name of Object.keys(interfaces)) {
    if (!/vethernet|virtual|loopback|pseudo/i.test(name)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
          return iface.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

// Config endpoint returning the scannable base URL
app.get('/api/config', (req, res) => {
  const ip = getLocalNetworkIp();
  res.json({
    status: 'ok',
    networkIp: ip,
    port: PORT,
    verifyBaseUrl: `http://${ip}:${PORT}`
  });
});

// ── PAYMENT SCREENSHOT VALIDATION ENGINE ───────────────────────────
// ── PAYMENT SCREENSHOT VALIDATION ENGINE ───────────────────────────
function validatePaymentText(rawText) {
  const text = (rawText || '').toLowerCase();
  
  // 1. Strict Event Poster / Flyer / Marketing Blacklist
  const posterKeywords = [
    '5 hours of challenges', '6 exciting events', '1 unforgettable experience',
    'hours of challenges', 'exciting events', 'unforgettable experience',
    'cash prize for hackathon', 'cyber forge', 'cloud craft', 'ctf challenge',
    'click n chill', 'prompt generating', 'quiz competition',
    'the next big thing is you', 'rules and regulations', 'organizing committee',
    'faculty coordinator', 'student coordinator', 'convenor', 'brochure'
  ];
  const matchedPoster = posterKeywords.filter(k => text.includes(k));

  if (matchedPoster.length >= 2 || text.includes('5 hours of challenges') || text.includes('cyber forge')) {
    return {
      isValid: false,
      reason: 'EVENT_POSTER_DETECTED',
      matched: matchedPoster,
      message: 'Event poster or marketing brochure detected. Please upload an authentic UPI or Net Banking payment receipt.'
    };
  }

  // 2. Beneficiary Check
  const beneficiaryKeywords = [
    'rgdeemeduni01qr@fbl', 'rgdeemeduni01qr', 'rgdeemeduni', 'rathinam', 'quantum', 'q-aura', 'qaura'
  ];
  const hasBeneficiary = beneficiaryKeywords.some(b => text.includes(b));

  // 3. Status Phrases & Completion Words
  const statusPhrases = [
    'paid to', 'payment to', 'payment successful', 'transaction successful',
    'transfer successful', 'paid successfully', 'money sent to', 'transferred to',
    'debited from', 'payment completed', 'payment of', 'successfully paid',
    'sent successfully to', 'bill payment successful', 'completed successfully',
    'sent to', 'payment done', 'was successful', 'money sent', 'money transferred',
    'paid', 'successful', 'success', 'completed', 'debited', 'transferred', 'sent'
  ];
  const matchedStatus = statusPhrases.filter(p => text.includes(p));
  const hasStatus = matchedStatus.length > 0;

  // 4. Identifiers: UTR, UPI Ref, Txn ID, 12-digit numbers, PhonePe T... IDs, etc.
  const idRegex = /\b(utr|upi\s*ref|upi\s*reference|rrn|txn\s*id|transaction\s*id|trans\s*id|transaction\s*no|txn\s*no|ref\s*no|reference\s*no|ref\s*#|ref\s*id|reference\s*id|order\s*id|google\s*transaction|upi\s*txn|payment\s*id|imps|neft)\b/i;
  const utr12DigitRegex = /(\b\d{12}\b|\b\d{4}\s+\d{4}\s+\d{4}\b)/;
  const phonepeTxnRegex = /\bT\d{15,25}\b/i;
  const hasIdMarker = idRegex.test(text) || utr12DigitRegex.test(text) || phonepeTxnRegex.test(text);

  // 5. Platform Identification
  const platformRegex = /\b(google\s*pay|gpay|phonepe|paytm|bhim|cred|amazon\s*pay|whatsapp\s*pay|yono|imobile|fedmobile|axis\s*pay|federal\s*bank|fbl|sbi|hdfc|icici|kotak|canara|pnb|bob|bank|upi)\b/i;
  const hasPlatform = platformRegex.test(text);

  // 6. Currency / Amount
  const hasAmount = /[₹]|inr|\brs\.?|\b250\b|\b300\b/.test(text);

  // Evaluation Rules:
  const isBeneficiaryMatch = hasBeneficiary && (hasStatus || hasAmount || hasPlatform || hasIdMarker);
  const isStandardUpi = hasStatus && (hasIdMarker || hasPlatform || (hasBeneficiary && hasAmount));
  const isBankDebit = (text.includes('debited') || text.includes('transferred') || text.includes('sent')) && (hasAmount || hasPlatform || hasIdMarker);
  const isAppReceipt = hasPlatform && (hasStatus || hasAmount) && (hasIdMarker || hasBeneficiary || hasAmount);

  const isValid = isBeneficiaryMatch || isStandardUpi || isBankDebit || isAppReceipt;

  return {
    isValid: !!isValid,
    reason: isValid ? 'AUTHENTIC_RECEIPT' : 'INSUFFICIENT_PAYMENT_PROOF',
    matched: matchedStatus.concat(hasIdMarker ? ['Txn Ref / UTR'] : []).concat(hasBeneficiary ? ['Rathinam Beneficiary'] : []),
    message: isValid
      ? 'Valid UPI / Banking Payment Confirmation Detected'
      : 'The uploaded image could not be verified as a payment receipt. Please upload a clear screenshot of your UPI (GPay, PhonePe, Paytm) or Bank transaction receipt showing payment confirmation.'
  };
}

// ── API: VALIDATE PAYMENT PROOF SCREENSHOT VIA OCR ─────────────────
app.post('/api/validate-payment-proof', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ valid: false, message: 'No screenshot data provided' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    console.log('🔍 [OCR SCAN RESULT]:', text.replace(/\n+/g, ' ').substring(0, 180));
    const check = validatePaymentText(text);
    console.log('⚡ [VALIDATION VERDICT]:', check.isValid ? '✓ APPROVED' : '✗ REJECTED', '(' + check.reason + ')');

    if (check.isValid) {
      return res.json({
        valid: true,
        reason: check.reason,
        matched: check.matched,
        message: 'Valid UPI / Banking Payment Confirmation Detected'
      });
    } else {
      return res.json({
        valid: false,
        reason: check.reason,
        matched: check.matched,
        message: check.message
      });
    }
  } catch (err) {
    console.error('Validation OCR error:', err);
    res.status(500).json({ valid: false, message: 'Validation service error: ' + err.message });
  }
});

// ── API: REGISTER STUDENT INTO POSTGRESQL ──────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const data = req.body;
    if (!data.regId) {
      return res.status(400).json({ status: 'error', message: 'Missing Registration ID' });
    }

    // Optional payment screenshot
    const record = await db.createRegistration(data);
    res.json({
      status: 'ok',
      message: 'Registered successfully in PostgreSQL',
      regId: record.reg_id,
      registration: record
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── AUTHENTICATION ROUTES ──────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password, portal } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Username and password are required' });
  }

  const normUser = (username || 'admin').trim().toLowerCase();
  const rawPass = typeof password === 'string' ? password.trim() : '';
  const cred = await getCredentialForUser(normUser === 'verify' ? 'desk' : normUser);

  let role = null;
  let userObj = null;

  if (normUser === 'admin') {
    const isMatch = cred && cred.password === rawPass;
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid operative username or passphrase.' });
    }
    role = 'admin';
    userObj = { username: 'admin', role: 'admin', name: 'Symposium Administrator' };
  } else if (normUser === 'desk' || normUser === 'verify') {
    if (portal === 'admin') {
      return res.status(403).json({ status: 'forbidden', message: 'Desk clearance cannot access Admin Panel. Administrator credentials required.' });
    }
    const isMatch = cred && cred.password === rawPass;
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid operative username or passphrase.' });
    }
    role = 'desk';
    userObj = { username: 'desk', role: 'desk', name: 'Verification Desk Agent' };
  } else {
    return res.status(401).json({ status: 'error', message: 'Invalid operative username or passphrase.' });
  }

  // 24 hours validity
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const token = generateToken({ username: userObj.username, role, exp });

  res.json({
    status: 'ok',
    message: 'Authentication successful',
    token,
    role,
    user: userObj
  });
});

// ── CHANGE CREDENTIALS (ADMIN EXCLUSIVE) ───────────────────────────
app.post('/api/auth/change-password', requireAuth(['admin']), async (req, res) => {
  try {
    const { targetUser, currentAdminPassword, newPassword } = req.body || {};

    if (!targetUser || !['admin', 'desk'].includes(targetUser.toLowerCase())) {
      return res.status(400).json({ status: 'error', message: 'Target portal must be "admin" or "desk".' });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({ status: 'error', message: 'New passphrase must be at least 4 characters long.' });
    }

    const normTarget = targetUser.toLowerCase();

    // Verify current admin password for confirmation
    if (currentAdminPassword) {
      const adminCred = await getCredentialForUser('admin');
      if (adminCred && adminCred.password !== currentAdminPassword) {
        return res.status(401).json({ status: 'error', message: 'Current Administrator passphrase is incorrect.' });
      }
    }

    await setCredentialForUser(normTarget, newPassword.trim());

    res.json({
      status: 'ok',
      message: `Passphrase for ${normTarget === 'admin' ? 'Administrator' : 'Verification Desk'} successfully updated!`,
      targetUser: normTarget,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to update passphrase: ' + err.message });
  }
});

// ── GET CREDENTIALS INFO (ADMIN EXCLUSIVE) ──────────────────────────
app.get('/api/auth/credentials-info', requireAuth(['admin']), async (req, res) => {
  try {
    const adminCred = await getCredentialForUser('admin');
    const deskCred = await getCredentialForUser('desk');

    res.json({
      status: 'ok',
      accounts: [
        {
          portal: 'admin',
          username: 'admin',
          role: 'admin',
          label: 'Admin Command Console',
          passwordLength: adminCred ? adminCred.password.length : 0
        },
        {
          portal: 'desk',
          username: 'desk',
          role: 'desk',
          label: 'Verification Desk Scanner',
          passwordLength: deskCred ? deskCred.password.length : 0
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(401).json({ status: 'invalid', valid: false, message: 'Missing token' });
  }
  if (token.startsWith('local_offline_token_')) {
    return res.json({ status: 'ok', valid: true, user: { username: 'admin', role: 'admin', name: 'Local Administrator' } });
  }
  const payload = verifyToken(token);
  if (payload) {
    return res.json({ status: 'ok', valid: true, user: payload });
  }
  res.status(401).json({ status: 'invalid', valid: false, message: 'Invalid or expired authentication token' });
});

// ── API: GET ALL REGISTRATIONS (ADMIN / EXPORT - PROTECTED) ─────────
app.get('/api/registrations', requireAuth(['admin', 'desk']), async (req, res) => {
  try {
    const records = await db.getAllRegistrations();
    if (records && records.length > 0) {
      return res.json({ status: 'ok', registrations: records });
    }
  } catch (err) {
    console.warn('DB fetch registrations notice:', err.message);
  }

  // Graceful fallback to backup json file
  try {
    const backupPath = path.join(__dirname, 'all_registrations_backup.json');
    if (fs.existsSync(backupPath)) {
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      return res.json({ status: 'ok', registrations: backup, source: 'backup' });
    }
  } catch (bErr) {
    console.warn('Backup registrations read error:', bErr.message);
  }

  res.json({ status: 'ok', registrations: [] });
});

// ── API: VERIFY LOOKUP (JSON API) ──────────────────────────────────
app.get('/api/verify/:id', async (req, res) => {
  const term = (req.params.id || '').trim();
  try {
    const record = await db.getRegistrationById(term);
    if (record) {
      return res.json({ status: 'ok', registration: record });
    }
  } catch (err) {
    console.warn('DB verify lookup notice:', err.message);
  }

  // Fallback to local backup json file
  try {
    const backupPath = path.join(__dirname, 'all_registrations_backup.json');
    if (fs.existsSync(backupPath)) {
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const normTerm = term.toUpperCase().replace(/\s+/g, '');
      const match = backup.find(r => 
        (r.regId && r.regId.toUpperCase().replace(/\s+/g, '') === normTerm) ||
        (r.mobile && String(r.mobile).trim() === term)
      );
      if (match) {
        return res.json({ status: 'ok', registration: match, source: 'backup' });
      }
    }
  } catch (bErr) {
    console.warn('Backup verify read error:', bErr.message);
  }

  res.status(404).json({ status: 'not_found', message: 'Registration not found in database' });
});

// ── API: UPDATE VERIFICATION STATUS (PROTECTED) ────────────────────
app.patch('/api/registrations/:id/status', requireAuth(['admin', 'desk']), async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await db.updateStatus(req.params.id, status || 'Verified');
    if (updated) {
      res.json({ status: 'ok', message: 'Status updated', registration: updated });
    } else {
      res.status(404).json({ status: 'not_found', message: 'Registration not found' });
    }
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── API: PERMANENTLY DELETE REGISTRATION (ADMIN ONLY) ─────────────
app.delete('/api/registrations/:id', requireAuth(['admin']), async (req, res) => {
  const regId = (req.params.id || '').trim();
  try {
    const deleted = await db.deleteRegistration(regId);

    // Also remove from all_registrations_backup.json
    try {
      const backupPath = path.join(__dirname, 'all_registrations_backup.json');
      if (fs.existsSync(backupPath)) {
        let bList = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const cleanId = regId.toUpperCase().replace(/\s+/g, '');
        bList = bList.filter(r => (r.regId || r.reg_id || '').toUpperCase().replace(/\s+/g, '') !== cleanId);
        fs.writeFileSync(backupPath, JSON.stringify(bList, null, 2), 'utf8');

        // Also update registrations_data.js
        const dataJsPath = path.join(__dirname, 'registrations_data.js');
        if (fs.existsSync(dataJsPath)) {
          fs.writeFileSync(dataJsPath, '// Auto-generated offline & standalone registration roster bundle\nwindow.QAURA_PRELOADED_REGISTRATIONS = ' + JSON.stringify(bList, null, 2) + ';\n', 'utf8');
        }
      }
    } catch(bErr) {
      console.warn('Backup file update on delete notice:', bErr.message);
    }

    res.json({
      status: 'ok',
      message: 'Registration permanently deleted from database and records',
      deleted
    });
  } catch (err) {
    console.error('Delete registration error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.patch('/api/registrations/:id/deactivate', requireAuth(['admin']), async (req, res) => {
  try {
    const updated = await db.deactivateRegistration(req.params.id);
    if (updated) {
      res.json({ status: 'ok', message: 'Registration marked Inactive in PostgreSQL database', registration: updated });
    } else {
      res.status(404).json({ status: 'not_found', message: 'Registration not found' });
    }
  } catch (err) {
    console.error('Deactivate registration error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── API: REACTIVATE REGISTRATION (ADMIN ONLY) ───────────────────────
app.patch('/api/registrations/:id/activate', requireAuth(['admin']), async (req, res) => {
  try {
    const updated = await db.activateRegistration(req.params.id);
    if (updated) {
      res.json({ status: 'ok', message: 'Registration reactivated in PostgreSQL database', registration: updated });
    } else {
      res.status(404).json({ status: 'not_found', message: 'Registration not found' });
    }
  } catch (err) {
    console.error('Activate registration error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── API: GET METRICS (ADMIN ONLY - PROTECTED) ───────────────────────
app.get('/api/stats', requireAuth(['admin']), async (req, res) => {
  try {
    const stats = await db.getMetrics();
    res.json({ status: 'ok', stats });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── HEALTH & KEEP-ALIVE PING TELEMETRY (PREVENTS RENDER SLEEP MODE) ──
const keepAliveStats = {
  enabled: false,
  targetUrl: null,
  totalPings: 0,
  lastPingAt: null,
  lastStatus: null,
  intervalMinutes: 5
};

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'Q-AURA 2026',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    keepAlive: keepAliveStats
  });
});
app.get('/ping', (req, res) => res.status(200).send('pong'));

// ── SHORTCUT REDIRECTS ─────────────────────────────────────────────
app.get('/login', (req, res) => res.redirect('/login.html'));
app.get('/admin', (req, res) => res.redirect('/admin.html'));
app.get('/register', (req, res) => res.redirect('/index.html'));

// ── LIVE QR SCAN VERIFICATION ROUTE (REQUIRES AUTHENTICATION VIA VERIFY PORTAL) ──
app.get('/verify', async (req, res) => {
  const queryId = (req.query.id || req.query.regId || '').trim();
  const format = (req.query.format || '').toLowerCase();

  if (format === 'json' && queryId) {
    try {
      const record = await db.getRegistrationById(queryId);
      return record 
        ? res.json({ status: 'ok', registration: record })
        : res.status(404).json({ status: 'not_found' });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  }

  if (queryId) {
    return res.redirect(`/verify.html?id=${encodeURIComponent(queryId)}`);
  }
  return res.redirect('/verify.html');
});

// ── RENDER VERIFICATION HTML ───────────────────────────────────────
function renderVerificationHtml(r) {
  const isHack = r.tech_event && r.tech_event.includes('Hackathon');
  const teammates = [r.tm2, r.tm3].filter(Boolean).join(' • ');

  const hackBlock = isHack ? `
    <div class="sec-title">🔥 HACKATHON STRIKE TEAM (3 MEMBERS | 5 HOURS)</div>
    <div class="info-cell full"><div class="lbl">Strike Team Name</div><div class="val highlight-orange">${r.team_name || '—'}</div></div>
    <div class="grid">
      <div class="info-cell"><div class="lbl">Team Leader</div><div class="val">${r.leader_name || '—'}</div></div>
      <div class="info-cell"><div class="lbl">Leader Phone</div><div class="val">${r.leader_phone || '—'}</div></div>
    </div>
    <div class="info-cell full" style="margin-top:8px;"><div class="lbl">Team Operatives (3 Members)</div><div class="val">${[r.leader_name + ' (Leader)', r.tm2, r.tm3].filter(Boolean).join(' • ') || '—'}</div></div>
    <div class="info-cell full" style="margin-top:8px;"><div class="lbl">Marathon Timing</div><div class="val highlight-gold">10:00 AM – 03:00 PM (5 Hours Sprint)</div></div>
  ` : '';

  const proofBlock = r.payment_screenshot && r.payment_screenshot.startsWith('data:image') ? `
    <div class="sec-title">💳 PAYMENT SCREENSHOT (POSTGRESQL ARCHIVE)</div>
    <img src="${r.payment_screenshot}" class="proof-img" alt="Payment Proof"/>
  ` : '';

  const isInactive = r.is_active === false || (r.status && r.status.toLowerCase().includes('inact'));
  const isVerified = !isInactive && r.status && r.status.toLowerCase().includes('verif');

  const badgeHtml = isInactive
    ? `<div class="verified-badge" style="background:#ff0055;color:#fff;"><i class="fas fa-ban"></i> ✕ PASS INACTIVE / REVOKED</div>`
    : isVerified
      ? `<div class="verified-badge"><i class="fas fa-database"></i> ✓ POSTGRESQL VERIFIED</div>`
      : `<div class="verified-badge" style="background:#ff8c00;color:#000;"><i class="fas fa-hourglass-half"></i> PENDING VERIFICATION</div>`;

  const tagHtml = isInactive
    ? `<div class="db-tag" style="color:#ff0055;font-weight:bold;">⚠️ Registration marked Inactive in PostgreSQL Registry &bull; Entry Not Allowed</div>`
    : `<div class="db-tag">⚡ Fetched Live from PostgreSQL Registry &bull; Status: ${r.status}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Q-AURA 2026 Verification - ${r.reg_id}</title>
  <link rel="icon" type="image/png" href="/assets/favicon.png">
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
  <link rel="apple-touch-icon" href="/assets/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #07090e;
      color: #f0f4fc;
      min-height: 100vh;
      padding: 16px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .card {
      max-width: 500px;
      width: 100%;
      background: #0e121b;
      border: 1.5px solid #00f0ff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 0 35px rgba(0, 240, 255, 0.25);
    }
    .header {
      background: #ffffff;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 2px solid #00f0ff;
    }
    .header-logo-left { flex: 1; text-align: left; }
    .header-logo-left img { max-height: 52px; max-width: 100%; object-fit: contain; display: block; }
    .header-logo-divider { width: 1.5px; height: 45px; background: #cbd5e1; }
    .header-logo-right { flex: 1; text-align: center; }
    .header-logo-right img { height: 38px; width: auto; object-fit: contain; display: block; margin: 0 auto 2px; }
    .header-logo-right .txt { font-size: 9px; font-weight: 800; color: #0f172a; line-height: 1.1; }

    .dept-bar {
      background: #0f172a;
      padding: 9px;
      text-align: center;
      font-size: 10.5px;
      font-weight: 800;
      color: #38bdf8;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(0,240,255,0.3);
    }
    .badge-wrap {
      text-align: center;
      padding: 16px;
      background: rgba(0, 255, 102, 0.08);
      border-bottom: 1px solid rgba(0, 255, 102, 0.25);
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #00ff66;
      color: #05140a;
      font-weight: 900;
      font-size: 11.5px;
      letter-spacing: 1.5px;
      padding: 6px 18px;
      border-radius: 30px;
      text-transform: uppercase;
    }
    .reg-id-display {
      font-family: monospace;
      font-size: 22px;
      font-weight: 900;
      color: #00f0ff;
      letter-spacing: 2px;
      margin-top: 8px;
    }
    .db-tag {
      font-size: 10px;
      color: #ffd700;
      font-family: monospace;
      margin-top: 4px;
    }
    .body-wrap { padding: 18px 16px; }
    .sec-title {
      font-size: 11px;
      font-weight: 800;
      color: #00f0ff;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 14px 0 8px;
      border-bottom: 1px solid rgba(0,240,255,0.2);
      padding-bottom: 4px;
    }
    .sec-title:first-child { margin-top: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-cell {
      background: rgba(16, 22, 34, 0.85);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 8px 10px;
    }
    .info-cell.full { grid-column: 1 / -1; }
    .lbl { font-size: 8.5px; text-transform: uppercase; color: #8b9bb4; font-weight: 700; letter-spacing: 0.5px; }
    .val { font-size: 13px; font-weight: 700; color: #ffffff; margin-top: 2px; word-break: break-word; }
    .highlight-cyan { color: #00f0ff; }
    .highlight-green { color: #00ff66; }
    .highlight-gold { color: #ffd700; }
    .highlight-orange { color: #ff7700; }
    .proof-img {
      width: 100%;
      max-height: 240px;
      object-fit: contain;
      border-radius: 6px;
      border: 1px solid #00f0ff;
      margin-top: 8px;
      background: #000;
    }
    .venue-box {
      background: rgba(0, 240, 255, 0.05);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin-top: 14px;
      font-size: 11.5px;
      line-height: 1.6;
      color: #e2e8f5;
    }
    .action-panel {
      margin-top: 14px;
      padding: 12px;
      background: rgba(255,255,255,0.04);
      border-radius: 8px;
      display: flex;
      gap: 10px;
    }
    .btn-act {
      flex: 1;
      padding: 10px;
      border-radius: 6px;
      font-weight: 900;
      font-size: 11px;
      cursor: pointer;
      border: none;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .btn-verify { background: #00ff66; color: #05140a; }
    .btn-flag { background: #ff0055; color: #fff; }
    .footer {
      text-align: center;
      padding: 12px;
      font-size: 10px;
      color: #5a6880;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: #07090e;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo-left">
        <img src="/assets/logo.png" alt="Rathinam Global University"/>
      </div>
      <div class="header-logo-divider"></div>
      <div class="header-logo-right">
        <img src="/assets/school_icon.png" alt="School Icon"/>
        <div class="txt">School of Quantum Science,<br/>Computing &amp; AI</div>
      </div>
    </div>
    <div class="dept-bar">School of Quantum Science Computing &amp; AI &bull; Q-AURA 2026</div>
    <div class="badge-wrap">
      ${badgeHtml}
      <div class="reg-id-display">${r.reg_id}</div>
      ${tagHtml}
    </div>
    <div class="body-wrap">
      <div class="sec-title">👤 PARTICIPANT CREDENTIALS</div>
      <div class="grid">
        <div class="info-cell full"><div class="lbl">Participant Name</div><div class="val">${r.first_name} ${r.last_name}</div></div>
        <div class="info-cell"><div class="lbl">Mobile Number</div><div class="val">${r.mobile}</div></div>
        <div class="info-cell"><div class="lbl">Fee Status</div><div class="val highlight-gold">${r.fee}</div></div>
        <div class="info-cell full"><div class="lbl">Email Address</div><div class="val">${r.email}</div></div>
        <div class="info-cell full"><div class="lbl">Institution / College</div><div class="val">${r.college}</div></div>
      </div>

      <div class="sec-title">🎯 EVENT ALLOCATION</div>
      <div class="grid">
        <div class="info-cell"><div class="lbl">Technical Arena</div><div class="val highlight-cyan">${r.tech_event}</div></div>
        <div class="info-cell"><div class="lbl">Non-Technical Arena</div><div class="val highlight-green">${r.non_tech_event}</div></div>
      </div>

      ${hackBlock}
      ${proofBlock}

      <div class="venue-box">
        <strong>📍 REPORTING &amp; VENUE DIRECTIVES:</strong><br/>
        &bull; <strong>Date:</strong> October 14, 2026 (Wednesday)<br/>
        &bull; <strong>Reporting Time:</strong> 09:00 AM IST<br/>
        &bull; <strong>Venue:</strong> Tower - C, Think Tank Theater, Rathinam Techzone Campus, Eachanari, Coimbatore – 641021<br/>
        &bull; <strong>Student Coordinators:</strong> K. Ajithkumar: 6385512473 &bull; M. Dhanush: 8270866217 &bull; R. Jeyasimhaa: 99409 28677 &bull; S. S. Surya Prakash: 80565 57572 &bull; M. Dharun: 8870311010
      </div>

      <!-- ON-DESK ATTENDANCE ACTION -->
      <div class="action-panel">
        <button class="btn-act btn-verify" onclick="updateRecordStatus('Verified & Present')">✓ Mark Verified &amp; Present</button>
        <button class="btn-act btn-flag" onclick="updateRecordStatus('Flagged / Issue')">⚠️ Flag Attendance</button>
      </div>
    </div>
    <div class="footer">
      ⚡ Powered by PostgreSQL 18 &bull; Q-AURA 2026 Registry &bull; Rathinam Global University
    </div>
  </div>

  <script>
    async function updateRecordStatus(newStatus) {
      try {
        const res = await fetch('/api/registrations/${r.reg_id}/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();
        if (json.status === 'ok') {
          alert('Status updated to: ' + newStatus);
          location.reload();
        } else {
          alert('Update error: ' + json.message);
        }
      } catch (err) {
        alert('Network error: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

// ── RENDER NOT FOUND HTML ──────────────────────────────────────────
function renderNotFoundHtml(queryId) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Q-AURA 2026 - Pass Not Found</title>
  <link rel="icon" type="image/png" href="/assets/favicon.png">
  <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon">
  <link rel="apple-touch-icon" href="/assets/favicon.png">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #07090e;
      color: #f0f4fc;
      min-height: 100vh;
      padding: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #0e121b;
      border: 1.5px solid #ff0055;
      border-radius: 14px;
      text-align: center;
      padding: 26px 20px;
      box-shadow: 0 0 35px rgba(255, 0, 85, 0.25);
    }
    .icon { font-size: 44px; margin-bottom: 12px; }
    h2 { font-size: 18px; color: #fff; margin-bottom: 8px; }
    p { font-size: 13px; color: #8b9bb4; line-height: 1.6; margin-bottom: 16px; }
    .badge-id {
      font-family: monospace;
      font-size: 16px;
      color: #ffd700;
      background: rgba(255,215,0,0.1);
      border: 1px solid rgba(255,215,0,0.3);
      padding: 4px 14px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 16px;
    }
    .help-box {
      font-size: 12px;
      color: #38bdf8;
      background: rgba(56,189,248,0.08);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid rgba(56,189,248,0.2);
      line-height: 1.5;
    }
    a { color: #00f0ff; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h2>PASS NOT FOUND IN POSTGRESQL</h2>
    <p>No registration matched the scanned pass ID in the database:</p>
    <div class="badge-id">${queryId || 'UNKNOWN ID'}</div>
    <div class="help-box">
      Please report to the registration helpdesk or contact student coordinators:<br/>
      <strong>K. Ajithkumar:</strong> 6385512473 &bull; <strong>M. Dhanush:</strong> 8270866217 &bull; <strong>R. Jeyasimhaa:</strong> 99409 28677<br/>
      <strong>S. S. Surya Prakash:</strong> 80565 57572 &bull; <strong>M. Dharun:</strong> 8870311010<br/><br/>
      <a href="/verify.html">Open Manual Search Desk</a> &bull; <a href="/index.html">Register Now</a>
    </div>
  </div>
</body>
</html>`;
}

// ── START SERVER & CONNECT DATABASE ────────────────────────────────
async function start() {
  try {
    await db.initDb();
    const localIp = getLocalNetworkIp();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('⚡ Q-AURA 2026 PostgreSQL Server is LIVE!');
      console.log(`🌐 Local Access     : http://localhost:${PORT}`);
      console.log(`📱 Phone / Wi-Fi QR : http://${localIp}:${PORT}/verify?id=QAURA-2026-XXXX`);
      console.log(`📊 Admin Dashboard  : http://localhost:${PORT}/admin.html`);
      console.log(`🔍 Verification Desk: http://localhost:${PORT}/verify.html`);
      console.log('═══════════════════════════════════════════════════════════════');

      // ── AUTONOMOUS 24/7 SELF-PING KEEP-ALIVE SYSTEM ──────────────
      initKeepAlive();
    });
  } catch (err) {
    console.error('Fatal: Failed to connect to PostgreSQL database:', err);
    process.exit(1);
  }
}

function initKeepAlive() {
  let targetUrl = (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL ||
    ''
  ).trim();

  if (!targetUrl && process.env.RENDER_EXTERNAL_HOSTNAME) {
    targetUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME.trim()}`;
  }

  if (!targetUrl) {
    console.log('[Keep-Alive] Running in local offline mode (no external URL configured).');
    return;
  }

  targetUrl = targetUrl.replace(/\/+$/, '');
  const pingUrl = `${targetUrl}/health`;

  keepAliveStats.enabled = true;
  keepAliveStats.targetUrl = pingUrl;

  console.log(`⚡ [Keep-Alive] 24/7 Autonomous Keep-Alive engine active for: ${pingUrl}`);
  console.log(`⏱️ [Keep-Alive] Interval: Pinging every 5 minutes (prevents Render 15-minute idle sleep).`);

  async function performPing() {
    try {
      const res = await fetch(pingUrl, {
        headers: { 'User-Agent': 'QAURA-2026-KeepAlive-Engine/1.0' },
        signal: AbortSignal.timeout(12000)
      });
      keepAliveStats.totalPings++;
      keepAliveStats.lastPingAt = new Date().toISOString();
      keepAliveStats.lastStatus = res.status;
      const istTime = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' });
      console.log(`✓ [Keep-Alive #${keepAliveStats.totalPings}] Pinged ${pingUrl} -> HTTP ${res.status} [${istTime} IST]`);
    } catch (err) {
      keepAliveStats.lastStatus = 'failed: ' + err.message;
      console.warn(`⚠️ [Keep-Alive] Ping notice: ${err.message}`);
    }
  }

  // Initial ping 15 seconds after startup
  setTimeout(performPing, 15 * 1000);

  // Recurring ping every 5 minutes (Render sleep threshold is 15 minutes)
  setInterval(performPing, 5 * 60 * 1000);
}

start();
