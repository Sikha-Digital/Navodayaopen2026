/**
 * Serverless Handler for Vercel / Cloud Functions
 * GET /api/health
 */

const { query } = require('../db');

module.exports = async function handler(req, res) {
  try {
    const result = await query('SELECT NOW() as current_time, count(*) as count FROM registrations');
    res.status(200).json({
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
};
