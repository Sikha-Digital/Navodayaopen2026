/**
 * Serverless Handler for Vercel / Cloud Functions
 * GET /api/levels
 */

const { query, initDatabase } = require('../db');

let isInitialized = false;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (!isInitialized) {
      await initDatabase();
      isInitialized = true;
    }
    const result = await query('SELECT * FROM levels ORDER BY rank_order ASC');
    res.status(200).json({ status: 'success', data: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
