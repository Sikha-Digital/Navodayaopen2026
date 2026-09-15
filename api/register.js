/**
 * Serverless Handler for Vercel / Cloud Functions
 * POST /api/register
 */

const { query, initDatabase } = require('../db');
const { sendRegistrationConfirmationEmail } = require('../mailer');

let isInitialized = false;

function normalizeId(val) {
  if (!val) return '';
  return String(val).replace(/[\s\-_]/g, '').toUpperCase();
}

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

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed. Use POST.' });
  }

  try {
    if (!isInitialized) {
      await initDatabase();
      isInitialized = true;
    }

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
          message: 'Validation failed. Partner details are required for doubles entries.'
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

    const openFlightRanks = {
      "International": 0, "Premiere": 1, "Championship": 2,
      "F1": 3, "F2": 4, "F3": 5, "F4": 6, "F5": 7, "F6": 8
    };

    const juniorFlightRanks = {
      "Under 9": 0, "Under 11": 1, "Under 13": 2, "Under 15": 3, "Under 17": 4
    };

    async function validatePlayerConstraints(playerId, playerLabel) {
      if (!playerId) return null;
      const normId = normalizeId(playerId);

      const existingRes = await query(
        `SELECT category, flight, iqama, partner_iqama
         FROM registrations
         WHERE UPPER(REPLACE(REPLACE(REPLACE(iqama, ' ', ''), '-', ''), '_', '')) = $1
            OR UPPER(REPLACE(REPLACE(REPLACE(partner_iqama, ' ', ''), '-', ''), '_', '')) = $1`,
        [normId]
      );
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

        if (existingRows.length >= 3) {
          return `Registration blocked: ${playerLabel} (Iqama/ID: ${normId}) has already reached the maximum limit of 3 event category entries in this tournament (registered as Main Participant or Co-Participant).`;
        }

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
          return `Level selection mismatch for ${playerLabel}. Chosen level (${flight}) must be at the same or adjacent level of existing entry (${existingFlights.join(', ')}).`;
        }

        if (hasJuniorCompare && minJuniorDiff > 1) {
          return `Level selection mismatch for ${playerLabel}. Chosen junior level (${flight}) must be at the same or adjacent level (${existingFlights.join(', ')}).`;
        }
      }

      return null;
    }

    const mainError = await validatePlayerConstraints(iqama, 'Main Player');
    if (mainError) return res.status(400).json({ status: 'error', message: mainError });

    if (isDoubles && partnerIqama) {
      const partnerError = await validatePlayerConstraints(partnerIqama, 'Partner');
      if (partnerError) return res.status(400).json({ status: 'error', message: partnerError });
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
      name, phone, email, iqama, gender, dob, nationality, club,
      categoryId, canonicalCategory, levelId, canonicalFlight,
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

    // Send confirmation email (awaited so serverless execution completes email sending)
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
    console.error('[Registration Handler Error]', err);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + err.message
    });
  }
};
