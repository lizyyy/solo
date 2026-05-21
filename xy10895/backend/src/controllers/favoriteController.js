const { allAsync, getAsync, runAsync } = require('../config/database');

const toggleFavorite = async (req, res) => {
  try {
    const { apiId } = req.params;
    const { user_email } = req.body;

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: 'User email is required'
      });
    }

    const apiExists = await getAsync('SELECT id FROM api_entries WHERE id = ?', [apiId]);
    if (!apiExists) {
      return res.status(404).json({
        success: false,
        error: 'API entry not found'
      });
    }

    const existingFavorite = await getAsync(
      'SELECT id FROM favorites WHERE api_id = ? AND user_email = ?',
      [apiId, user_email]
    );

    if (existingFavorite) {
      await runAsync('DELETE FROM favorites WHERE id = ?', [existingFavorite.id]);
      res.json({
        success: true,
        data: { isFavorited: false }
      });
    } else {
      await runAsync(
        'INSERT INTO favorites (api_id, user_email) VALUES (?, ?)',
        [apiId, user_email]
      );
      res.json({
        success: true,
        data: { isFavorited: true }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to toggle favorite',
      details: error.message
    });
  }
};

const getFavorites = async (req, res) => {
  try {
    const { user_email } = req.query;

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: 'User email is required'
      });
    }

    const favorites = await allAsync(`
      SELECT a.*, o.name as owner_name, f.created_at as favorited_at
      FROM favorites f
      JOIN api_entries a ON f.api_id = a.id
      LEFT JOIN owners o ON a.owner_id = o.id
      WHERE f.user_email = ?
      ORDER BY f.created_at DESC
    `, [user_email]);

    res.json({
      success: true,
      data: favorites
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch favorites',
      details: error.message
    });
  }
};

module.exports = {
  toggleFavorite,
  getFavorites
};
