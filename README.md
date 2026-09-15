# Navodaya Open 2026 - Badminton Tournament Portal (Neon DB Backend)

A mobile-first tournament registration portal featuring a glassmorphic dark-theme UI designed for the **Navodaya Open 2026 Badminton Tournament**, powered by a high-performance **Neon DB (PostgreSQL)** backend.

---

## 🏸 Features

- **Exact Tournament UI & Theme**: Preserved dark glassmorphic aesthetic, animated shuttlecock badge, Outfit typography, custom combobox dropdowns, and multi-step registration flow.
- **Neon DB PostgreSQL Backend**: Fast, scalable serverless PostgreSQL database with full ACID compliance.
- **Relational Tables Structure**:
  - `categories` - Tournament event categories (Mens Doubles, Womens Doubles, Mixed Doubles, etc.)
  - `levels` - Tournament flights / divisions (International, Premiere, Championship, F1–F6, Masters 35+, Veterans 45+, Under 9–17) with rank orders.
  - `registrations` - Player registration records with timestamps, player contact details, Iqama/ID, and doubles partner information.
- **Comprehensive Tournament Business Logic**:
  - **Category-to-Level Mapping**:
    - **Mens Doubles (MD)**: International, Premiere, Championship, F1, F2, F3, F4, F5, F6, Masters 35Plus, Veterance 45Plus
    - **Womens Doubles (WD)**: Championship, F1, F2, F3, F4, F5, F6
    - **Mixed Doubles (XD)**: International, Premiere, Championship, F1, F2, F3, F4, F5, F6
    - **Boys Doubles (BD)**: Under 9, Under 11, Under 13, Under 15, Under 17
    - **Girls Doubles (GD)**: Under 9, Under 11, Under 13, Under 15, Under 17
  - **Duplicate Prevention**: Prevents the same player (by Iqama/ID) from registering twice for the same category and flight level.
  - **3 Categories Maximum**: Enforces max 3 category entries per individual player (as Main Player or Co-Player).
  - **Nearest Level Rule**: Multi-category participants are constrained to adjacent flight levels (within 1 flight rank step).
  - **Partner Validation**: Enforces distinct Iqama/IDs between main player and co-player for doubles events.

---

## 🗄️ Database Architecture (`schema.sql`)

### 1. `categories` Table
```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  cat_code VARCHAR(20) NOT NULL, -- e.g. 'MD', 'WD', 'XD', 'GD', 'BD'
  is_doubles BOOLEAN DEFAULT TRUE,
  gender_allowed VARCHAR(20) DEFAULT 'Any',
  min_age INTEGER,
  max_age INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. `levels` Table
```sql
CREATE TABLE levels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  level_type VARCHAR(50) NOT NULL DEFAULT 'open',
  rank_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. `category_levels` Foreign Key Relation (Junction Table)
```sql
CREATE TABLE category_levels (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_category_level UNIQUE (category_id, level_id)
);
```

### 4. `registrations` Table
```sql
CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
  partner_name VARCHAR(255),
  partner_phone VARCHAR(50),
  partner_iqama VARCHAR(100),
  partner_gender VARCHAR(20),
  partner_dob VARCHAR(50),
  partner_nationality VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🚀 Quick Setup Guide

### Step 1: Create a Neon DB Database
1. Go to [Neon Console](https://console.neon.tech/) and sign up / log in.
2. Click **Create Project** (e.g. `navodaya-open-2026`).
3. Copy your PostgreSQL Connection String (starts with `postgresql://...`).

### Step 2: Configure Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
PORT=3000
NODE_ENV=development
ADMIN_KEY=your_secret_admin_key

# Optional: Automatic Registration Confirmation Emails (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@domain.com
SMTP_PASS=your_app_password
EMAIL_FROM="Navodaya Open 2026" <noreply@navodayaopen.com>
ADMIN_EMAIL=organizers@navodayaopen.com
```

### Step 3: Install & Start

**Option A (Windows 1-Click):**
Double-click [start.bat](file:///e:/Navo%20Open/start.bat) to auto-install dependencies, start the server, and launch the browser at `http://localhost:3000`.

**Option B (Command Line):**
```bash
# Install dependencies
npm install

# Start the application server (auto-creates tables and seeds categories/levels)
npm start
```
Open your browser at `http://localhost:3000`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Check database connection and total registrations count |
| `GET` | `/api/categories` | Retrieve tournament event categories |
| `GET` | `/api/levels` | Retrieve tournament levels & flight ranks |
| `GET` | `/api/tournament-config` | Retrieve categories + levels + mapping relation |
| `POST` | `/api/register` | Submit tournament registration, assign Player UID & Team ID, dispatch confirmation email |
| `GET` | `/api/test-email` | Test SMTP server connection and send test confirmation email (`?to=user@example.com`) |
| `GET` | `/api/registrations` | View registrations list (requires header `x-admin-key: <ADMIN_KEY>`) |

---

## 📁 File Structure

- [index.html](file:///e:/Navo%20Open/index.html) - Exact glassmorphic UI, badminton branding, multi-step registration form.
- [style.css](file:///e:/Navo%20Open/style.css) - Responsive dark-theme styling, animations, floating labels, partner drawer.
- [app.js](file:///e:/Navo%20Open/app.js) - Client-side state handling, input masking, comboboxes, and submission to `/api/register`.
- [server.js](file:///e:/Navo%20Open/server.js) - Express backend with Neon DB connection, validation rules, and email dispatch.
- [mailer.js](file:///e:/Navo%20Open/mailer.js) - Nodemailer email service with tournament-branded responsive HTML template and text fallback.
- [db.js](file:///e:/Navo%20Open/db.js) - PostgreSQL pool manager and auto-migration runner.
- [schema.sql](file:///e:/Navo%20Open/schema.sql) - Database DDL with `categories`, `levels`, and `registrations` tables + seed data.
- [api/register.js](file:///e:/Navo%20Open/api/register.js) - Serverless endpoint handler (for Vercel/Netlify).
