// ═══════════════════════════════════════════════════════════════════
// Q-AURA 2026 — PostgreSQL Database Module
// School of Quantum Sciences, Computing & AI, Rathinam Global University
// ═══════════════════════════════════════════════════════════════════

const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    }
  : {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT, 10) || 5432,
      database: process.env.PG_DATABASE || 'qaura2026_db',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Initialize database schema
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        reg_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        mobile VARCHAR(25) NOT NULL,
        email VARCHAR(150) NOT NULL,
        college TEXT NOT NULL,
        tech_event VARCHAR(100) NOT NULL,
        non_tech_event VARCHAR(100) NOT NULL,
        fee VARCHAR(50) NOT NULL,
        team_name VARCHAR(100),
        leader_name VARCHAR(100),
        leader_phone VARCHAR(25),
        leader_email VARCHAR(150),
        tm2 VARCHAR(100),
        tm3 VARCHAR(100),
        tm4 VARCHAR(100),
        payment_screenshot TEXT,
        status VARCHAR(50) DEFAULT 'Pending Verification',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE
      );

      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      UPDATE registrations SET is_active = TRUE WHERE is_active IS NULL;

      CREATE INDEX IF NOT EXISTS idx_registrations_reg_id ON registrations (reg_id);
      CREATE INDEX IF NOT EXISTS idx_registrations_mobile ON registrations (mobile);
      CREATE INDEX IF NOT EXISTS idx_registrations_is_active ON registrations (is_active);

      CREATE TABLE IF NOT EXISTS portal_auth (
        username VARCHAR(50) PRIMARY KEY,
        password TEXT NOT NULL,
        role VARCHAR(20) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO portal_auth (username, password, role)
      VALUES 
        ('admin', 'admin@qaura2026', 'admin'),
        ('desk', 'verify@qaura2026', 'desk')
      ON CONFLICT (username) DO NOTHING;
    `);

    // Purge test/dummy registrations and sync authentic 23 student registrations into database
    try {
      const fs = require('fs');
      const path = require('path');
      const backupPath = path.join(__dirname, 'all_registrations_backup.json');
      if (fs.existsSync(backupPath)) {
        const seedData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

        // 1. Purge test registrations
        const testIds = [
          'QAURA-2026-4048', 'QAURA-2026-7589', 'QAURA-2026-4128', 'QAURA-2026-5351',
          'QAURA-2026-1206', 'QAURA-2026-4075', 'QAURA-2026-6857', 'QAURA-2026-7195',
          'QAURA-2026-2377', 'QAURA-2026-1158', 'QAURA-2026-1193', 'QAURA-2026-3803',
          'QAURA-2026-5415', 'QAURA-2026-8758', 'QAURA-2026-1865', 'QAURA-2026-4081',
          'QAURA-2026-5498', 'QAURA-2026-5958', 'QAURA-2026-8161', 'QAURA-2026-1701',
          'QAURA-2026-5482'
        ];
        await client.query(`
          DELETE FROM registrations 
          WHERE email LIKE '%example.com' 
             OR email = 'test@gmail.com' 
             OR email = 'test@gamil.com'
             OR LOWER(first_name) LIKE 'test%'
             OR LOWER(first_name) LIKE '%test'
             OR LOWER(first_name) IN ('sri', 'ar', 'sridev', 'etst', 'tezt3', 'jey', 'abd', 'masskhduib')
             OR reg_id = ANY($1::varchar[]);
        `, [testIds]);

        // 2. Upsert the authentic 23 student registrations
        for (const r of seedData) {
          const regId = r.regId || r.reg_id;
          if (!regId) continue;
          await client.query(`
            INSERT INTO registrations (
              reg_id, first_name, last_name, mobile, email, college,
              tech_event, non_tech_event, fee,
              team_name, leader_name, leader_phone, leader_email,
              tm2, tm3, tm4, payment_screenshot, status, is_active, created_at, verified_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
            ON CONFLICT (reg_id) DO UPDATE SET
              is_active = TRUE,
              status = CASE WHEN registrations.status = 'Verified' THEN 'Verified' ELSE EXCLUDED.status END;
          `, [
            regId, r.firstName || r.first_name || '', r.lastName || r.last_name || '',
            r.mobile || '', r.email || '', r.college || '',
            r.techEvent || r.tech_event || '', r.nonTechEvent || r.non_tech_event || '',
            r.fee || '₹250',
            r.teamName || r.team_name || '', r.leaderName || r.leader_name || '',
            r.leaderPhone || r.leader_phone || '', r.leaderEmail || r.leader_email || '',
            r.tm2 || '', r.tm3 || '', r.tm4 || '',
            r.paymentScreenshot || r.payment_screenshot || '',
            r.status || 'Pending Verification', true,
            r.createdAt || r.created_at || new Date().toISOString(),
            r.verifiedAt || r.verified_at || null
          ]);
        }
        console.log(`✓ Synchronized ${seedData.length} authentic student registrations into database.`);
      }
    } catch (seedErr) {
      console.warn('Auto-seed / sync notice:', seedErr.message);
    }

    console.log('✓ PostgreSQL: Database schema & portal credentials verified in qaura2026_db');
  } finally {
    client.release();
  }
}

// Create a new registration
async function createRegistration(data) {
  const query = `
    INSERT INTO registrations (
      reg_id, first_name, last_name, mobile, email, college,
      tech_event, non_tech_event, fee,
      team_name, leader_name, leader_phone, leader_email,
      tm2, tm3, tm4, payment_screenshot, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    ON CONFLICT (reg_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      mobile = EXCLUDED.mobile,
      email = EXCLUDED.email,
      college = EXCLUDED.college,
      tech_event = EXCLUDED.tech_event,
      non_tech_event = EXCLUDED.non_tech_event,
      fee = EXCLUDED.fee,
      team_name = EXCLUDED.team_name,
      leader_name = EXCLUDED.leader_name,
      leader_phone = EXCLUDED.leader_phone,
      leader_email = EXCLUDED.leader_email,
      tm2 = EXCLUDED.tm2,
      tm3 = EXCLUDED.tm3,
      tm4 = EXCLUDED.tm4,
      payment_screenshot = COALESCE(EXCLUDED.payment_screenshot, registrations.payment_screenshot)
    RETURNING *;
  `;

  const isHack = data.techEvent && data.techEvent.includes('Hackathon');
  const values = [
    data.regId,
    data.firstName || '',
    data.lastName || '',
    data.mobile || '',
    data.email || '',
    data.college || '',
    data.techEvent || '',
    data.nonTechEvent || '',
    data.fee || (isHack ? '₹300 (Team)' : '₹250'),
    data.teamName || '',
    data.leaderName || '',
    data.leaderPhone || '',
    data.leaderEmail || '',
    data.tm2 || '',
    data.tm3 || '',
    data.tm4 || '',
    data.paymentScreenshot || '',
    data.status || 'Pending Verification'
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
}

// Fetch single registration by Reg ID or Mobile
async function getRegistrationById(term) {
  if (!term) return null;
  const cleanTerm = term.trim();
  const cleanId = cleanTerm.toUpperCase().replace(/\s+/g, '');

  const query = `
    SELECT * FROM registrations 
    WHERE UPPER(REPLACE(reg_id, ' ', '')) = $1 
       OR mobile = $2
    LIMIT 1;
  `;
  const res = await pool.query(query, [cleanId, cleanTerm]);
  return res.rows[0] || null;
}

// Fetch all registrations
async function getAllRegistrations() {
  const query = `
    SELECT 
      id, reg_id AS "regId", first_name AS "firstName", last_name AS "lastName",
      mobile, email, college, tech_event AS "techEvent", non_tech_event AS "nonTechEvent",
      fee, team_name AS "teamName", leader_name AS "leaderName",
      leader_phone AS "leaderPhone", leader_email AS "leaderEmail",
      tm2, tm3, tm4, payment_screenshot AS "paymentScreenshot",
      status, is_active AS "isActive", created_at AS "createdAt", verified_at AS "verifiedAt"
    FROM registrations
    ORDER BY created_at DESC;
  `;
  const res = await pool.query(query);
  return res.rows;
}

// Update registration verification status
async function updateStatus(regId, newStatus) {
  const isVerified = newStatus && newStatus.toLowerCase().includes('verif');
  const isInactive = newStatus && newStatus.toLowerCase().includes('inact');
  const query = `
    UPDATE registrations 
    SET status = $1,
        is_active = $2,
        verified_at = ${isVerified ? 'CURRENT_TIMESTAMP' : 'NULL'}
    WHERE UPPER(REPLACE(reg_id, ' ', '')) = UPPER(REPLACE($3, ' ', ''))
    RETURNING 
      id, reg_id AS "regId", first_name AS "firstName", last_name AS "lastName",
      mobile, email, college, tech_event AS "techEvent", non_tech_event AS "nonTechEvent",
      fee, team_name AS "teamName", leader_name AS "leaderName",
      leader_phone AS "leaderPhone", leader_email AS "leaderEmail",
      tm2, tm3, tm4, payment_screenshot AS "paymentScreenshot",
      status, is_active AS "isActive", created_at AS "createdAt", verified_at AS "verifiedAt";
  `;
  const res = await pool.query(query, [newStatus, !isInactive, regId]);
  return res.rows[0] || null;
}

// Deactivate / Soft Delete registration
async function deactivateRegistration(regId) {
  const query = `
    UPDATE registrations 
    SET is_active = FALSE,
        status = 'Inactive'
    WHERE UPPER(REPLACE(reg_id, ' ', '')) = UPPER(REPLACE($1, ' ', ''))
    RETURNING 
      id, reg_id AS "regId", first_name AS "firstName", last_name AS "lastName",
      mobile, email, college, tech_event AS "techEvent", non_tech_event AS "nonTechEvent",
      fee, team_name AS "teamName", leader_name AS "leaderName",
      leader_phone AS "leaderPhone", leader_email AS "leaderEmail",
      tm2, tm3, tm4, payment_screenshot AS "paymentScreenshot",
      status, is_active AS "isActive", created_at AS "createdAt", verified_at AS "verifiedAt";
  `;
  const res = await pool.query(query, [regId]);
  return res.rows[0] || null;
}

// Permanently delete registration
async function deleteRegistration(regId) {
  if (!regId) return null;
  const query = `
    DELETE FROM registrations 
    WHERE UPPER(REPLACE(reg_id, ' ', '')) = UPPER(REPLACE($1, ' ', ''))
    RETURNING id, reg_id AS "regId", first_name AS "firstName", last_name AS "lastName";
  `;
  const res = await pool.query(query, [regId]);
  return res.rows[0] || null;
}

// Reactivate registration
async function activateRegistration(regId) {
  const query = `
    UPDATE registrations 
    SET is_active = TRUE,
        status = 'Pending Verification'
    WHERE UPPER(REPLACE(reg_id, ' ', '')) = UPPER(REPLACE($1, ' ', ''))
    RETURNING 
      id, reg_id AS "regId", first_name AS "firstName", last_name AS "lastName",
      mobile, email, college, tech_event AS "techEvent", non_tech_event AS "nonTechEvent",
      fee, team_name AS "teamName", leader_name AS "leaderName",
      leader_phone AS "leaderPhone", leader_email AS "leaderEmail",
      tm2, tm3, tm4, payment_screenshot AS "paymentScreenshot",
      status, is_active AS "isActive", created_at AS "createdAt", verified_at AS "verifiedAt";
  `;
  const res = await pool.query(query, [regId]);
  return res.rows[0] || null;
}

// Get metrics / stats
async function getMetrics() {
  const totalRes = await pool.query('SELECT COUNT(*) AS total FROM registrations WHERE is_active = TRUE;');
  const inactiveRes = await pool.query('SELECT COUNT(*) AS inactive FROM registrations WHERE is_active = FALSE;');
  const verifiedRes = await pool.query("SELECT COUNT(*) AS verified FROM registrations WHERE is_active = TRUE AND status ILIKE '%verif%';");
  const pendingRes = await pool.query("SELECT COUNT(*) AS pending FROM registrations WHERE is_active = TRUE AND status ILIKE '%pending%';");
  const hackathonRes = await pool.query("SELECT COUNT(*) AS hackathon FROM registrations WHERE is_active = TRUE AND tech_event ILIKE '%hackathon%';");
  const techRes = await pool.query('SELECT tech_event, COUNT(*) AS count FROM registrations WHERE is_active = TRUE GROUP BY tech_event;');
  
  return {
    total: parseInt(totalRes.rows[0].total, 10),
    inactive: parseInt(inactiveRes.rows[0].inactive, 10),
    verified: parseInt(verifiedRes.rows[0].verified, 10),
    pending: parseInt(pendingRes.rows[0].pending, 10),
    hackathonTeams: parseInt(hackathonRes.rows[0].hackathon, 10),
    techDistribution: techRes.rows
  };
}

// ── AUTHENTICATION CREDENTIAL MANAGEMENT ───────────────────────────
async function getAuthUser(username) {
  try {
    const res = await pool.query('SELECT username, password, role, updated_at AS "updatedAt" FROM portal_auth WHERE LOWER(username) = LOWER($1);', [username]);
    return res.rows[0] || null;
  } catch (err) {
    console.warn('DB getAuthUser notice:', err.message);
    return null;
  }
}

async function updateAuthPassword(username, newPassword) {
  try {
    const normUser = (username || '').toLowerCase();
    const role = normUser === 'admin' ? 'admin' : 'desk';
    const res = await pool.query(`
      INSERT INTO portal_auth (username, password, role, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE
      SET password = EXCLUDED.password, updated_at = CURRENT_TIMESTAMP
      RETURNING username, role, updated_at AS "updatedAt";
    `, [normUser, newPassword, role]);
    return res.rows[0] || null;
  } catch (err) {
    console.warn('DB updateAuthPassword notice:', err.message);
    return null;
  }
}

module.exports = {
  pool,
  initDb,
  createRegistration,
  getRegistrationById,
  getAllRegistrations,
  updateStatus,
  deactivateRegistration,
  activateRegistration,
  deleteRegistration,
  getMetrics,
  getAuthUser,
  updateAuthPassword
};
