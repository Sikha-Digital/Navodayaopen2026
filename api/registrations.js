/**
 * Serverless Handler for Vercel / Cloud Functions
 * GET /api/registrations
 */

const { query, initDatabase } = require('../db');

let isInitialized = false;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const configuredKey = process.env.ADMIN_KEY;

  if (configuredKey && adminKey !== configuredKey) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized access.' });
  }

  try {
    if (!isInitialized) {
      await initDatabase();
      isInitialized = true;
    }

    // Handle clearing registrations & players tables
    if (req.method === 'DELETE' || req.query.action === 'clear' || (req.body && req.body.action === 'clear')) {
      await query('TRUNCATE TABLE registrations, players RESTART IDENTITY CASCADE;');
      return res.status(200).json({
        status: 'success',
        message: 'Table registrations and players have been cleared and auto-increment sequences reset.'
      });
    }

    const result = await query('SELECT * FROM registrations ORDER BY id DESC');
    res.status(200).json({
      status: 'success',
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
