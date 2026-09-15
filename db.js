/**
 * Database Connection & Migration Module for Neon DB (PostgreSQL)
 * Navodaya Open 2026 Badminton Tournament
 */

require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[DB WARNING] DATABASE_URL environment variable is not set. Please configure it in your .env file.');
}

// Initialize PostgreSQL connection pool with SSL configured for Neon DB
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('[DB Pool Error]', err);
});

/**
 * Execute a SQL query with parameters
 * @param {string} text - SQL Query String
 * @param {Array} params - Query Parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DB Query]', { text: text.trim().substring(0, 100), duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } finally {
    client.release();
  }
}

/**
 * Automatically create tables and seed initial tournament categories & levels
 */
async function initDatabase() {
  console.log('[DB Init] Checking and initializing database schema...');

  const schemaSql = `
    -- 1. Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      cat_code VARCHAR(20) NOT NULL,
      is_doubles BOOLEAN DEFAULT TRUE,
      gender_allowed VARCHAR(20) DEFAULT 'Any',
      min_age INTEGER,
      max_age INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Ensure cat_code exists if table was previously created
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS cat_code VARCHAR(20);

    -- 2. Levels Table
    CREATE TABLE IF NOT EXISTS levels (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      level_type VARCHAR(50) NOT NULL DEFAULT 'open',
      rank_order INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 3. Category-Levels Foreign Key Junction Table (Category <-> Level Relational Mapping)
    CREATE TABLE IF NOT EXISTS category_levels (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      level_id INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_category_level UNIQUE (category_id, level_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cat_lvl_cat_id ON category_levels (category_id);
    CREATE INDEX IF NOT EXISTS idx_cat_lvl_lvl_id ON category_levels (level_id);

    -- 4. Players Table (Persistent 4-digit Unique Player ID Registry)
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      player_uid VARCHAR(10) NOT NULL UNIQUE,
      iqama VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(255),
      gender VARCHAR(20),
      dob VARCHAR(50),
      nationality VARCHAR(100),
      club VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_players_iqama ON players (iqama);
    CREATE INDEX IF NOT EXISTS idx_players_norm_iqama ON players (UPPER(REPLACE(REPLACE(REPLACE(iqama, ' ', ''), '-', ''), '_', '')));
    CREATE INDEX IF NOT EXISTS idx_players_uid ON players (player_uid);

    -- 5. Registrations Table
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      team_id VARCHAR(20),
      player_id VARCHAR(10),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL,
      iqama VARCHAR(100) NOT NULL,
      gender VARCHAR(20) NOT NULL,
      dob VARCHAR(50) NOT NULL,
      nationality VARCHAR(100) NOT NULL,
      club VARCHAR(255),
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      category VARCHAR(100) NOT NULL,
      level_id INTEGER REFERENCES levels(id) ON DELETE SET NULL,
      flight VARCHAR(100) NOT NULL,
      partner_player_id VARCHAR(10),
      partner_name VARCHAR(255),
      partner_phone VARCHAR(50),
      partner_iqama VARCHAR(100),
      partner_gender VARCHAR(20),
      partner_dob VARCHAR(50),
      partner_nationality VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Ensure columns exist if table was created previously
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS team_id VARCHAR(20);
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player_id VARCHAR(10);
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS partner_player_id VARCHAR(10);

    -- Performance & Validation Query Indexes
    CREATE INDEX IF NOT EXISTS idx_reg_team_id ON registrations (team_id);
    CREATE INDEX IF NOT EXISTS idx_reg_iqama ON registrations (iqama);
    CREATE INDEX IF NOT EXISTS idx_reg_partner_iqama ON registrations (partner_iqama);
    CREATE INDEX IF NOT EXISTS idx_reg_norm_iqama ON registrations (UPPER(REPLACE(REPLACE(REPLACE(iqama, ' ', ''), '-', ''), '_', '')));
    CREATE INDEX IF NOT EXISTS idx_reg_norm_partner_iqama ON registrations (UPPER(REPLACE(REPLACE(REPLACE(partner_iqama, ' ', ''), '-', ''), '_', '')));
    CREATE INDEX IF NOT EXISTS idx_reg_player_id ON registrations (player_id);
    CREATE INDEX IF NOT EXISTS idx_reg_partner_player_id ON registrations (partner_player_id);
    CREATE INDEX IF NOT EXISTS idx_reg_cat_flight ON registrations (category, flight);
    CREATE INDEX IF NOT EXISTS idx_reg_created_at ON registrations (created_at);
    CREATE INDEX IF NOT EXISTS idx_reg_category_id ON registrations (category_id);
    CREATE INDEX IF NOT EXISTS idx_reg_level_id ON registrations (level_id);

    -- Initial Categories Seed Data (with Category Codes: MD, WD, XD, GD, BD)
    INSERT INTO categories (name, cat_code, is_doubles, gender_allowed)
    VALUES
      ('Mens Doubles', 'MD', TRUE, 'Male'),
      ('Womens Doubles', 'WD', TRUE, 'Female'),
      ('Mixed Doubles', 'XD', TRUE, 'Mixed'),
      ('Girls Doubles', 'GD', TRUE, 'Female'),
      ('Boys Doubles', 'BD', TRUE, 'Male')
    ON CONFLICT (name) DO UPDATE SET
      cat_code = EXCLUDED.cat_code,
      is_doubles = EXCLUDED.is_doubles,
      gender_allowed = EXCLUDED.gender_allowed;

    -- Initial Levels Seed Data
    INSERT INTO levels (name, level_type, rank_order)
    VALUES
      ('International', 'open', 0),
      ('Premiere', 'open', 1),
      ('Championship', 'open', 2),
      ('F1', 'open', 3),
      ('F2', 'open', 4),
      ('F3', 'open', 5),
      ('F4', 'open', 6),
      ('F5', 'open', 7),
      ('F6', 'open', 8),
      ('Masters 35Plus', 'veteran', 10),
      ('Veterance 45Plus', 'veteran', 11),
      ('Under 9', 'junior', 0),
      ('Under 11', 'junior', 1),
      ('Under 13', 'junior', 2),
      ('Under 15', 'junior', 3),
      ('Under 17', 'junior', 4)
    ON CONFLICT (name) DO UPDATE SET
      level_type = EXCLUDED.level_type,
      rank_order = EXCLUDED.rank_order;

    -- Seed Foreign Key Relations: Category <-> Levels Mapping
    INSERT INTO category_levels (category_id, level_id)
    SELECT c.id, l.id
    FROM (
      VALUES
        ('Mens Doubles', 'International'),
        ('Mens Doubles', 'Premiere'),
        ('Mens Doubles', 'Championship'),
        ('Mens Doubles', 'F1'),
        ('Mens Doubles', 'F2'),
        ('Mens Doubles', 'F3'),
        ('Mens Doubles', 'F4'),
        ('Mens Doubles', 'F5'),
        ('Mens Doubles', 'F6'),
        ('Mens Doubles', 'Masters 35Plus'),
        ('Mens Doubles', 'Veterance 45Plus'),
        ('Womens Doubles', 'Championship'),
        ('Womens Doubles', 'F1'),
        ('Womens Doubles', 'F2'),
        ('Womens Doubles', 'F3'),
        ('Womens Doubles', 'F4'),
        ('Womens Doubles', 'F5'),
        ('Womens Doubles', 'F6'),
        ('Mixed Doubles', 'International'),
        ('Mixed Doubles', 'Premiere'),
        ('Mixed Doubles', 'Championship'),
        ('Mixed Doubles', 'F1'),
        ('Mixed Doubles', 'F2'),
        ('Mixed Doubles', 'F3'),
        ('Mixed Doubles', 'F4'),
        ('Mixed Doubles', 'F5'),
        ('Mixed Doubles', 'F6'),
        ('Boys Doubles', 'Under 9'),
        ('Boys Doubles', 'Under 11'),
        ('Boys Doubles', 'Under 13'),
        ('Boys Doubles', 'Under 15'),
        ('Boys Doubles', 'Under 17'),
        ('Girls Doubles', 'Under 9'),
        ('Girls Doubles', 'Under 11'),
        ('Girls Doubles', 'Under 13'),
        ('Girls Doubles', 'Under 15'),
        ('Girls Doubles', 'Under 17')
    ) AS mapping(cat_name, lvl_name)
    JOIN categories c ON c.name = mapping.cat_name
    JOIN levels l ON l.name = mapping.lvl_name
    ON CONFLICT (category_id, level_id) DO NOTHING;
  `;

  try {
    await query(schemaSql);
    console.log('[DB Init] Database schema initialized successfully (Categories, Levels, Registrations).');
  } catch (err) {
    console.error('[DB Init Error] Failed to initialize schema:', err.message);
    throw err;
  }
}

// Allow direct CLI invocation: node db.js --init
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database initialization completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = {
  pool,
  query,
  initDatabase
};
