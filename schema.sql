-- =========================================================
-- Navodaya Open 2026 - Neon DB PostgreSQL Schema
-- Tables: categories, levels, category_levels, registrations
-- =========================================================

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

-- Ensure cat_code column exists if table was created previously
ALTER TABLE categories ADD COLUMN IF NOT EXISTS cat_code VARCHAR(20);

-- 2. Levels Table
CREATE TABLE IF NOT EXISTS levels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  level_type VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'junior', 'veteran'
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
  player_uid VARCHAR(10) NOT NULL UNIQUE, -- e.g. '1001', '1002' (4 digits)
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

-- 6. Admin Users Table (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'manager', -- 'admin', 'manager', 'viewer'
  permissions JSONB DEFAULT '["can_view"]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users (username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (email);

-- 5. Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  team_id VARCHAR(20), -- Auto-generated 4-digit Team ID e.g. 'T1001', 'T1002'
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

-- Performance & Validation Indexes
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

-- =========================================================
-- Initial Seed Data
-- =========================================================

-- Seed Categories
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

-- Seed Levels
INSERT INTO levels (name, level_type, rank_order)
VALUES
  -- Open Flights
  ('International', 'open', 0),
  ('Premiere', 'open', 1),
  ('Championship', 'open', 2),
  ('F1', 'open', 3),
  ('F2', 'open', 4),
  ('F3', 'open', 5),
  ('F4', 'open', 6),
  ('F5', 'open', 7),
  ('F6', 'open', 8),
  -- Veterans
  ('Masters 35Plus', 'veteran', 10),
  ('Veterance 45Plus', 'veteran', 11),
  -- Junior Flights
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
    -- Mens Doubles (MD)
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
    -- Womens Doubles (WD)
    ('Womens Doubles', 'Championship'),
    ('Womens Doubles', 'F1'),
    ('Womens Doubles', 'F2'),
    ('Womens Doubles', 'F3'),
    ('Womens Doubles', 'F4'),
    ('Womens Doubles', 'F5'),
    ('Womens Doubles', 'F6'),
    -- Mixed Doubles (XD)
    ('Mixed Doubles', 'International'),
    ('Mixed Doubles', 'Premiere'),
    ('Mixed Doubles', 'Championship'),
    ('Mixed Doubles', 'F1'),
    ('Mixed Doubles', 'F2'),
    ('Mixed Doubles', 'F3'),
    ('Mixed Doubles', 'F4'),
    ('Mixed Doubles', 'F5'),
    ('Mixed Doubles', 'F6'),
    -- Boys Doubles (BD)
    ('Boys Doubles', 'Under 9'),
    ('Boys Doubles', 'Under 11'),
    ('Boys Doubles', 'Under 13'),
    ('Boys Doubles', 'Under 15'),
    ('Boys Doubles', 'Under 17'),
    -- Girls Doubles (GD)
    ('Girls Doubles', 'Under 9'),
    ('Girls Doubles', 'Under 11'),
    ('Girls Doubles', 'Under 13'),
    ('Girls Doubles', 'Under 15'),
    ('Girls Doubles', 'Under 17')
) AS mapping(cat_name, lvl_name)
JOIN categories c ON c.name = mapping.cat_name
JOIN levels l ON l.name = mapping.lvl_name
ON CONFLICT (category_id, level_id) DO NOTHING;
