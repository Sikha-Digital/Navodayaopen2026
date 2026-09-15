/**
 * Serverless Handler for Vercel / Cloud Functions
 * GET /api/tournament-config
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

    const categoryLevelMap = {};
    for (const row of mappingRes.rows) {
      if (!categoryLevelMap[row.category_name]) {
        categoryLevelMap[row.category_name] = [];
      }
      categoryLevelMap[row.category_name].push(row.level_name);
    }

    res.status(200).json({
      status: 'success',
      categories: categoriesRes.rows,
      levels: levelsRes.rows,
      categoryLevelMap: categoryLevelMap
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
