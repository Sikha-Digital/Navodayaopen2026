/**
 * Navodaya Open 2026 - Express & Neon DB (PostgreSQL) Backend Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { query, initDatabase } = require('./db');
const { sendRegistrationConfirmationEmail, verifySmtpConnection, generateConfirmationEmailHtml } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (exact UI preservation)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

/**
 * Health Check Endpoint
 */
app.get('/api/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as current_time, count(*) as count FROM registrations');
    res.json({
      status: 'healthy',
      database: 'connected',
      currentTime: result.rows[0].current_time,
      totalRegistrations: parseInt(result.rows[0].count, 10)
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

/**
 * Get Tournament Categories
 */
app.get('/api/categories', async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY id ASC');
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Get Tournament Levels / Flights
 */
app.get('/api/levels', async (req, res) => {
  try {
    const result = await query('SELECT * FROM levels ORDER BY rank_order ASC');
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Get Complete Tournament Dropdown Configuration (Categories + Levels via Foreign Key Relations)
 * GET /api/tournament-config
 */
app.get('/api/tournament-config', async (req, res) => {
  try {
    const [categoriesRes, levelsRes, mappingRes] = await Promise.all([
      query('SELECT id, name, cat_code, is_doubles, gender_allowed, min_age, max_age FROM categories ORDER BY id ASC'),
      query('SELECT id, name, level_type, rank_order FROM levels ORDER BY rank_order ASC'),
      query(`
        SELECT c.name AS category_name, l.name AS level_name, l.rank_order
        FROM category_levels cl
        JOIN categories c ON c.id = cl.category_id
        JOIN levels l ON l.id = cl.level_id
        ORDER BY c.id ASC, l.rank_order ASC
      `)
    ]);

    // Build categoryLevelMap directly from the foreign key relational junction table
    const categoryLevelMap = {};
    for (const row of mappingRes.rows) {
      if (!categoryLevelMap[row.category_name]) {
        categoryLevelMap[row.category_name] = [];
      }
      categoryLevelMap[row.category_name].push(row.level_name);
    }

    res.json({
      status: 'success',
      categories: categoriesRes.rows,
      levels: levelsRes.rows,
      categoryLevelMap: categoryLevelMap
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Helper to normalize Iqama / ID numbers:
 * Strips whitespace, hyphens, underscores and converts to uppercase.
 */
function normalizeId(val) {
  if (!val) return '';
  return String(val).replace(/[\s\-_]/g, '').toUpperCase();
}

/**
 * Retrieves an existing 4-digit Player UID for the player (by normalized Iqama / ID)
 * or generates and registers the next unique 4-digit Player UID (1001, 1002, ...).
 */
async function getOrCreatePlayerUid(playerData) {
  const normIqama = normalizeId(playerData.iqama);
  if (!normIqama) return null;

  // 1. Check players table
  const checkRes = await query(
    "SELECT player_uid FROM players WHERE UPPER(REPLACE(REPLACE(REPLACE(iqama, ' ', ''), '-', ''), '_', '')) = $1 LIMIT 1",
    [normIqama]
  );
  if (checkRes.rows.length > 0 && checkRes.rows[0].player_uid) {
    return checkRes.rows[0].player_uid;
  }

  // 2. Check previous registrations (player_id or partner_player_id)
  const checkRegRes = await query(
    `SELECT player_id AS uid FROM registrations WHERE UPPER(REPLACE(REPLACE(REPLACE(iqama, ' ', ''), '-', ''), '_', '')) = $1 AND player_id IS NOT NULL
     UNION
     SELECT partner_player_id AS uid FROM registrations WHERE UPPER(REPLACE(REPLACE(REPLACE(partner_iqama, ' ', ''), '-', ''), '_', '')) = $1 AND partner_player_id IS NOT NULL
     LIMIT 1`,
    [normIqama]
  );

  if (checkRegRes.rows.length > 0 && checkRegRes.rows[0].uid) {
    const existingUid = checkRegRes.rows[0].uid;
    await query(
      `INSERT INTO players (player_uid, iqama, name, phone, email, gender, dob, nationality, club)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (iqama) DO UPDATE SET player_uid = EXCLUDED.player_uid`,
      [existingUid, normIqama, playerData.name || 'Player', playerData.phone || '', playerData.email || '', playerData.gender || '', playerData.dob || '', playerData.nationality || '', playerData.club || '']
    ).catch(() => {});
    return existingUid;
  }

  // 3. Generate next 4-digit Player UID starting from 1001
  const maxRes = await query(`
    SELECT MAX(CAST(player_uid AS INTEGER)) as max_uid 
    FROM (
      SELECT player_uid FROM players WHERE player_uid ~ '^[0-9]{4}$'
      UNION
      SELECT player_id AS player_uid FROM registrations WHERE player_id ~ '^[0-9]{4}$'
      UNION
      SELECT partner_player_id AS player_uid FROM registrations WHERE partner_player_id ~ '^[0-9]{4}$'
    ) combined
  `);

  let nextUidNum = 1001;
  if (maxRes.rows.length > 0 && maxRes.rows[0].max_uid) {
    const currentMax = parseInt(maxRes.rows[0].max_uid, 10);
    if (!isNaN(currentMax) && currentMax >= 1000) {
      nextUidNum = currentMax + 1;
    }
  }
  const newUid = String(nextUidNum);

  // Insert into players table
  await query(
    `INSERT INTO players (player_uid, iqama, name, phone, email, gender, dob, nationality, club)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (iqama) DO UPDATE SET player_uid = EXCLUDED.player_uid`,
    [newUid, normIqama, playerData.name || 'Player', playerData.phone || '', playerData.email || '', playerData.gender || '', playerData.dob || '', playerData.nationality || '', playerData.club || '']
  );

  return newUid;
}

/**
 * Generates the next sequential 4-digit Team ID starting with 'T' (e.g. 'T1001', 'T1002', ...)
 */
async function generateNextTeamId() {
  const maxRes = await query(`
    SELECT MAX(CAST(SUBSTRING(team_id FROM 2) AS INTEGER)) as max_team_num
    FROM registrations
    WHERE team_id ~ '^T[0-9]{4,}$'
  `);

  let nextTeamNum = 1001;
  if (maxRes.rows.length > 0 && maxRes.rows[0].max_team_num) {
    const currentMax = parseInt(maxRes.rows[0].max_team_num, 10);
    if (!isNaN(currentMax) && currentMax >= 1000) {
      nextTeamNum = currentMax + 1;
    }
  }

  return `T${nextTeamNum}`;
}

/**
 * Main Tournament Registration Endpoint
 * POST /api/register
 */
app.post('/api/register', async (req, res) => {
  try {
    const data = req.body || {};

    const name = data.name ? String(data.name).trim() : '';
    const phone = data.phone ? String(data.phone).trim() : '';
    const email = data.email ? String(data.email).trim() : '';
    const iqama = normalizeId(data.iqama);
    const gender = data.gender ? String(data.gender).trim() : '';
    const dob = data.dob ? String(data.dob).trim() : '';
    const nationality = data.nationality ? String(data.nationality).trim() : '';
    const club = data.club ? String(data.club).trim() : '';
    const category = data.category ? String(data.category).trim() : '';
    const flight = data.flight ? String(data.flight).trim() : '';
    const partnerName = data.partnerName ? String(data.partnerName).trim() : '';
    const partnerPhone = data.partnerPhone ? String(data.partnerPhone).trim() : '';
    const partnerIqama = normalizeId(data.partnerIqama);
    const partnerGender = data.partnerGender ? String(data.partnerGender).trim() : '';
    const partnerDob = data.partnerDob ? String(data.partnerDob).trim() : '';
    const partnerNationality = data.partnerNationality ? String(data.partnerNationality).trim() : '';

    // 1. Mandatory Field Validation
    if (!name || !phone || !email || !iqama || !gender || !dob || !nationality || !category || !flight) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed. Please ensure all required player fields are filled.'
      });
    }

    if (iqama.length < 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed. Main player Iqama / ID number must be at least 5 characters.'
      });
    }

    const isDoubles = category.toLowerCase().includes('doubles') || !!partnerName || !!partnerIqama;
    if (isDoubles) {
      if (!partnerName || !partnerPhone || !partnerIqama || !partnerGender || !partnerDob || !partnerNationality) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed. Partner details (Name, Contact, Iqama, Gender, DOB, Nationality) are required for doubles entries.'
        });
      }

      if (partnerIqama.length < 5) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed. Partner Iqama / ID number must be at least 5 characters.'
        });
      }

      if (iqama === partnerIqama) {
        return res.status(400).json({
          status: 'error',
          message: 'Main player and Partner cannot have the same Iqama / ID number.'
        });
      }
    }

    // 2. Relational Foreign Key Validation: Check if (category, flight) relation exists in category_levels
    const relCheck = await query(`
      SELECT cl.id, c.id AS category_id, c.name AS category_name, l.id AS level_id, l.name AS level_name
      FROM category_levels cl
      JOIN categories c ON c.id = cl.category_id
      JOIN levels l ON l.id = cl.level_id
      WHERE LOWER(TRIM(c.name)) = LOWER(TRIM($1)) AND LOWER(TRIM(l.name)) = LOWER(TRIM($2))
      LIMIT 1
    `, [category, flight]);

    if (relCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid level "${flight}" for category "${category}". Please choose an allowed level for this category.`
      });
    }

    const categoryId = relCheck.rows[0].category_id;
    const levelId = relCheck.rows[0].level_id;
    const canonicalCategory = relCheck.rows[0].category_name;
    const canonicalFlight = relCheck.rows[0].level_name;

    // Flight Rank Reference for Nearest Level Rule
    const openFlightRanks = {
      "International": 0,
      "Premiere": 1,
      "Championship": 2,
      "F1": 3,
      "F2": 4,
      "F3": 5,
      "F4": 6,
      "F5": 7,
      "F6": 8
    };

    const juniorFlightRanks = {
      "Under 9": 0,
      "Under 11": 1,
      "Under 13": 2,
      "Under 15": 3,
      "Under 17": 4
    };

    // 3. Validate Player Tournament Constraints (Duplicate Check, Max 3 Categories, Nearest Level)
    async function validatePlayerConstraints(playerId, playerLabel) {
      if (!playerId) return null;
      const normId = normalizeId(playerId);

      const existingQuery = `
        SELECT category, flight, iqama, partner_iqama
        FROM registrations
        WHERE UPPER(REPLACE(REPLACE(REPLACE(iqama, ' ', ''), '-', ''), '_', '')) = $1
           OR UPPER(REPLACE(REPLACE(REPLACE(partner_iqama, ' ', ''), '-', ''), '_', '')) = $1
      `;
      const existingRes = await query(existingQuery, [normId]);
      const existingRows = existingRes.rows;

      if (existingRows.length > 0) {
        // A) Duplicate entry check: An individual shall not participate more than once—either as a main participant or a co-participant—at the same level within a category.
        const targetCatLower = category.trim().toLowerCase();
        const targetFlightLower = flight.trim().toLowerCase();

        for (const row of existingRows) {
          const rowCatLower = String(row.category || '').trim().toLowerCase();
          const rowFlightLower = String(row.flight || '').trim().toLowerCase();

          if (rowCatLower === targetCatLower && rowFlightLower === targetFlightLower) {
            const rowMainNorm = normalizeId(row.iqama);
            const role = rowMainNorm === normId ? 'Main Participant' : 'Co-Participant / Partner';
            return `Registration blocked: An individual shall not participate more than once—either as a main participant or a co-participant—at the same level within a category. ${playerLabel} (Iqama/ID: ${normId}) is already registered for "${row.category}" in level "${row.flight}" (as ${role}).`;
          }
        }

        // B) Max 3 Category Entries Limit
        if (existingRows.length >= 3) {
          return `Registration blocked: ${playerLabel} (Iqama/ID: ${normId}) has already reached the maximum limit of 3 event category entries in this tournament (registered as Main Participant or Co-Participant).`;
        }

        // C) Nearest Level Rule Check (within 1 flight rank step)
        const currentOpenRank = openFlightRanks[flight];
        const currentJuniorRank = juniorFlightRanks[flight];
        const existingFlights = existingRows.map(r => r.flight);

        let minOpenDiff = Infinity;
        let minJuniorDiff = Infinity;
        let hasOpenCompare = false;
        let hasJuniorCompare = false;

        for (const prevFlight of existingFlights) {
          if (currentOpenRank !== undefined && openFlightRanks[prevFlight] !== undefined) {
            hasOpenCompare = true;
            const diff = Math.abs(currentOpenRank - openFlightRanks[prevFlight]);
            if (diff < minOpenDiff) minOpenDiff = diff;
          }

          if (currentJuniorRank !== undefined && juniorFlightRanks[prevFlight] !== undefined) {
            hasJuniorCompare = true;
            const diff = Math.abs(currentJuniorRank - juniorFlightRanks[prevFlight]);
            if (diff < minJuniorDiff) minJuniorDiff = diff;
          }
        }

        if (hasOpenCompare && minOpenDiff > 1) {
          return `Level selection mismatch for ${playerLabel}. Your chosen level (${flight}) is not at the nearest/adjacent level of your existing entry level (${existingFlights.join(', ')}). Level selection must be at the same or adjacent level (within 1 flight step).`;
        }

        if (hasJuniorCompare && minJuniorDiff > 1) {
          return `Level selection mismatch for ${playerLabel}. Your chosen level (${flight}) is not at the nearest/adjacent level of your existing junior entry (${existingFlights.join(', ')}).`;
        }
      }

      return null;
    }

    // Validate Main Player
    const mainPlayerError = await validatePlayerConstraints(iqama, 'Main Player');
    if (mainPlayerError) {
      return res.status(400).json({ status: 'error', message: mainPlayerError });
    }

    // Validate Partner
    if (isDoubles && partnerIqama) {
      const partnerError = await validatePlayerConstraints(partnerIqama, 'Partner');
      if (partnerError) {
        return res.status(400).json({ status: 'error', message: partnerError });
      }
    }

    // 4. Auto-generate or retrieve persistent 4-digit unique Player ID for both Main and Co-Player
    const mainPlayerUid = await getOrCreatePlayerUid({
      iqama, name, phone, email, gender, dob, nationality, club
    });

    let partnerPlayerUid = null;
    if (isDoubles && partnerIqama) {
      partnerPlayerUid = await getOrCreatePlayerUid({
        iqama: partnerIqama,
        name: partnerName,
        phone: partnerPhone,
        gender: partnerGender,
        dob: partnerDob,
        nationality: partnerNationality
      });
    }

    // 5. Auto-generate 4-digit Team ID starting with 'T' (e.g. 'T1001', 'T1002', ...)
    const teamId = await generateNextTeamId();

    // 6. Insert into Registrations Table (with team_id, player_id & partner_player_id)
    const insertSql = `
      INSERT INTO registrations (
        team_id, player_id, name, phone, email, iqama, gender, dob, nationality, club,
        category_id, category, level_id, flight,
        partner_player_id, partner_name, partner_phone, partner_iqama, partner_gender, partner_dob, partner_nationality
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id, timestamp, team_id, player_id, name, email, category, flight, partner_player_id, partner_name
    `;

    const insertValues = [
      teamId,
      mainPlayerUid,
      name,
      phone,
      email,
      iqama,
      gender,
      dob,
      nationality,
      club,
      categoryId,
      canonicalCategory,
      levelId,
      canonicalFlight,
      partnerPlayerUid,
      isDoubles ? partnerName : null,
      isDoubles ? partnerPhone : null,
      isDoubles ? partnerIqama : null,
      isDoubles ? partnerGender : null,
      isDoubles ? partnerDob : null,
      isDoubles ? partnerNationality : null
    ];

    const result = await query(insertSql, insertValues);
    const savedEntry = result.rows[0];

    // Trigger confirmation email asynchronously (non-blocking)
    const emailPayload = {
      id: savedEntry.id,
      timestamp: savedEntry.timestamp,
      teamId: savedEntry.team_id || teamId,
      playerId: mainPlayerUid,
      name,
      phone,
      email,
      iqama,
      gender,
      dob,
      nationality,
      club,
      category: canonicalCategory,
      flight: canonicalFlight,
      partnerName: isDoubles ? partnerName : null,
      partnerPhone: isDoubles ? partnerPhone : null,
      partnerIqama: isDoubles ? partnerIqama : null,
      partnerGender: isDoubles ? partnerGender : null,
      partnerDob: isDoubles ? partnerDob : null,
      partnerNationality: isDoubles ? partnerNationality : null,
      partnerPlayerId: partnerPlayerUid
    };

    // Send confirmation email
    let emailStatus = { success: false };
    try {
      emailStatus = await sendRegistrationConfirmationEmail(emailPayload);
      console.log('[Registration Confirmation Email Status]', emailStatus);
    } catch (emailErr) {
      console.error('[Registration Mailer Error]', emailErr.message);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Tournament entry saved successfully.',
      emailSent: emailStatus.success,
      timestamp: savedEntry.timestamp,
      insertedId: savedEntry.id,
      teamId: savedEntry.team_id || teamId,
      playerId: mainPlayerUid,
      partnerPlayerId: partnerPlayerUid,
      data: {
        id: savedEntry.id,
        teamId: savedEntry.team_id || teamId,
        name: savedEntry.name,
        playerId: mainPlayerUid,
        partnerName: savedEntry.partner_name,
        partnerPlayerId: partnerPlayerUid,
        category: savedEntry.category,
        flight: savedEntry.flight,
        timestamp: savedEntry.timestamp
      }
    });

  } catch (err) {
    console.error('[Registration Error]', err);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + err.message
    });
  }
});

/**
 * Test or Verify SMTP Configuration
 * GET /api/test-email?to=your-email@example.com
 * POST /api/test-email { "to": "your-email@example.com" }
 */
app.all('/api/test-email', async (req, res) => {
  try {
    const toEmail = req.query.to || (req.body && req.body.to);
    
    // Check connection first
    const smtpCheck = await verifySmtpConnection();
    if (!smtpCheck.configured) {
      return res.status(400).json({
        status: 'warning',
        message: 'SMTP is not configured in .env',
        smtpStatus: smtpCheck
      });
    }

    if (!toEmail) {
      return res.json({
        status: smtpCheck.verified ? 'success' : 'error',
        message: smtpCheck.message,
        smtpStatus: smtpCheck,
        hint: 'Pass ?to=your-email@example.com to send a test confirmation email.'
      });
    }

    // Send a sample test registration confirmation
    const samplePayload = {
      id: 9999,
      timestamp: new Date().toISOString(),
      teamId: 'T1001',
      playerId: '1001',
      name: 'Sample Participant',
      phone: '+966 50 000 0000',
      email: toEmail,
      iqama: '1234567890',
      gender: 'Male',
      dob: '1995-05-15',
      nationality: 'Indian',
      club: 'Navodaya Sports Club',
      category: 'Mens Doubles',
      flight: 'International',
      partnerName: 'Sample Partner',
      partnerPlayerId: '1002',
      partnerPhone: '+966 50 111 1111',
      partnerIqama: '2345678901',
      partnerGender: 'Male',
      partnerDob: '1996-08-20',
      partnerNationality: 'Indian'
    };

    const mailResult = await sendRegistrationConfirmationEmail(samplePayload);
    return res.json({
      status: mailResult.success ? 'success' : 'error',
      message: mailResult.success ? `Test registration email successfully sent to ${toEmail}` : 'Failed to send test email',
      details: mailResult,
      smtpStatus: smtpCheck
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

// Explicit route for Admin Dashboard UI
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

/**
 * Admin Authentication Helper Middleware
 */
function requireAdminAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const configuredKey = process.env.ADMIN_KEY;

  if (configuredKey && adminKey !== configuredKey) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized access. Invalid or missing Admin Key.' });
  }
  next();
}

/**
 * Admin Key Verification Login Endpoint
 * POST /api/admin/login
 */
app.post('/api/admin/login', (req, res) => {
  const key = (req.body && req.body.key) || req.headers['x-admin-key'] || req.query.key;
  const configuredKey = process.env.ADMIN_KEY;

  if (configuredKey && key !== configuredKey) {
    return res.status(401).json({ status: 'error', message: 'Invalid Admin Security Key.' });
  }
  res.json({ status: 'success', message: 'Authenticated successfully', authenticated: true });
});

/**
 * Admin Dashboard High-Level Statistics
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const [totalRegs, uniquePlayers, categories, flights, doublesRes] = await Promise.all([
      query('SELECT COUNT(*) as count FROM registrations'),
      query('SELECT COUNT(*) as count FROM players'),
      query('SELECT category, COUNT(*) as count FROM registrations GROUP BY category ORDER BY count DESC'),
      query('SELECT flight, COUNT(*) as count FROM registrations GROUP BY flight ORDER BY count DESC'),
      query("SELECT COUNT(*) as count FROM registrations WHERE LOWER(category) LIKE '%doubles%' OR partner_name IS NOT NULL")
    ]);

    const totalRegistrations = parseInt(totalRegs.rows[0].count, 10);
    const totalPlayers = parseInt(uniquePlayers.rows[0].count, 10);
    const doublesCount = parseInt(doublesRes.rows[0].count, 10);
    const singlesCount = totalRegistrations - doublesCount;

    res.json({
      status: 'success',
      data: {
        totalRegistrations,
        totalPlayers,
        doublesCount,
        singlesCount,
        byCategory: categories.rows,
        byFlight: flights.rows
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * List all registrations with Search and Filter support
 * GET /api/admin/registrations
 */
app.get('/api/admin/registrations', requireAdminAuth, async (req, res) => {
  try {
    const { search, category, flight } = req.query;
    let sql = 'SELECT * FROM registrations WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    if (flight && flight !== 'All') {
      params.push(flight);
      sql += ` AND flight = $${params.length}`;
    }
    if (search && search.trim() !== '') {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      sql += ` AND (
        LOWER(name) LIKE $${pIdx} OR 
        LOWER(team_id) LIKE $${pIdx} OR 
        LOWER(player_id) LIKE $${pIdx} OR 
        LOWER(iqama) LIKE $${pIdx} OR 
        LOWER(phone) LIKE $${pIdx} OR 
        LOWER(email) LIKE $${pIdx} OR 
        LOWER(club) LIKE $${pIdx} OR 
        LOWER(partner_name) LIKE $${pIdx} OR 
        LOWER(partner_player_id) LIKE $${pIdx} OR 
        LOWER(partner_iqama) LIKE $${pIdx}
      )`;
    }

    sql += ' ORDER BY id DESC';
    const result = await query(sql, params);
    res.json({
      status: 'success',
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Get single registration details
 * GET /api/admin/registrations/:id
 */
app.get('/api/admin/registrations/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM registrations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Registration entry not found' });
    }
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Update registration entry details
 * PUT /api/admin/registrations/:id
 */
app.put('/api/admin/registrations/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body || {};

    const check = await query('SELECT id FROM registrations WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Registration entry not found' });
    }

    const updateSql = `
      UPDATE registrations SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        iqama = COALESCE($4, iqama),
        gender = COALESCE($5, gender),
        dob = COALESCE($6, dob),
        nationality = COALESCE($7, nationality),
        club = COALESCE($8, club),
        category = COALESCE($9, category),
        flight = COALESCE($10, flight),
        partner_name = $11,
        partner_phone = $12,
        partner_iqama = $13,
        partner_gender = $14,
        partner_dob = $15,
        partner_nationality = $16
      WHERE id = $17
      RETURNING *
    `;

    const values = [
      d.name || null, d.phone || null, d.email || null, d.iqama || null, d.gender || null, d.dob || null, d.nationality || null, d.club || null,
      d.category || null, d.flight || null,
      d.partner_name || null, d.partner_phone || null, d.partner_iqama || null,
      d.partner_gender || null, d.partner_dob || null, d.partner_nationality || null,
      id
    ];

    const result = await query(updateSql, values);
    res.json({
      status: 'success',
      message: 'Registration entry updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Delete individual registration
 * DELETE /api/admin/registrations/:id
 */
app.delete('/api/admin/registrations/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM registrations WHERE id = $1 RETURNING id, team_id, name', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Registration entry not found.' });
    }
    res.json({
      status: 'success',
      message: `Registration #${id} (${result.rows[0].name}) successfully deleted.`,
      deletedId: result.rows[0].id
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Export all registrations as CSV file
 * GET /api/admin/export-csv
 */
app.get('/api/admin/export-csv', requireAdminAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM registrations ORDER BY id ASC');
    const rows = result.rows;

    const headers = [
      'ID', 'Team ID', 'Registered At',
      'Player UID', 'Player Name', 'Phone', 'Email', 'Iqama/ID', 'Gender', 'DOB', 'Nationality', 'Club',
      'Category', 'Flight/Level',
      'Partner UID', 'Partner Name', 'Partner Phone', 'Partner Iqama/ID', 'Partner Gender', 'Partner DOB', 'Partner Nationality'
    ];

    function escapeCsv(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }

    let csv = headers.join(',') + '\n';
    for (const r of rows) {
      const line = [
        r.id, r.team_id, r.timestamp,
        r.player_id, r.name, r.phone, r.email, r.iqama, r.gender, r.dob, r.nationality, r.club,
        r.category, r.flight,
        r.partner_player_id, r.partner_name, r.partner_phone, r.partner_iqama, r.partner_gender, r.partner_dob, r.partner_nationality
      ].map(escapeCsv).join(',');
      csv += line + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Navodaya_Open_Registrations_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Clear all registrations and players tables (Admin protected)
 * DELETE /api/registrations
 */
app.delete('/api/registrations', requireAdminAuth, async (req, res) => {
  try {
    await query('TRUNCATE TABLE registrations, players RESTART IDENTITY CASCADE;');
    res.json({
      status: 'success',
      message: 'Table registrations and players have been cleared and auto-increment sequences reset.'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Fallback all non-API GET routes to index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Auto initialize database tables and start server locally or export for Vercel
async function start() {
  try {
    if (process.env.DATABASE_URL) {
      await initDatabase();
    } else {
      console.warn('[Server Warning] Starting without DATABASE_URL configured. Database endpoints will return errors until DATABASE_URL is set.');
    }
  } catch (err) {
    console.error('[Startup Warning] Schema check failed on start:', err.message);
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` Navodaya Open 2026 Server running on port ${PORT}`);
      console.log(` UI: http://localhost:${PORT}/`);
      console.log(` Health: http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  }
}

start();

module.exports = app;
