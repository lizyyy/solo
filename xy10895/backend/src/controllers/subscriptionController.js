const { allAsync, getAsync, runAsync } = require('../config/database');

const toggleSubscription = async (req, res) => {
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

    const existingSubscription = await getAsync(
      'SELECT id FROM subscriptions WHERE api_id = ? AND user_email = ?',
      [apiId, user_email]
    );

    if (existingSubscription) {
      await runAsync('DELETE FROM subscriptions WHERE id = ?', [existingSubscription.id]);
      res.json({
        success: true,
        data: { isSubscribed: false }
      });
    } else {
      await runAsync(
        'INSERT INTO subscriptions (api_id, user_email) VALUES (?, ?)',
        [apiId, user_email]
      );
      res.json({
        success: true,
        data: { isSubscribed: true }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to toggle subscription',
      details: error.message
    });
  }
};

const getSubscriptions = async (req, res) => {
  try {
    const { user_email } = req.query;

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: 'User email is required'
      });
    }

    const subscriptions = await allAsync(`
      SELECT a.*, o.name as owner_name, s.created_at as subscribed_at
      FROM subscriptions s
      JOIN api_entries a ON s.api_id = a.id
      LEFT JOIN owners o ON a.owner_id = o.id
      WHERE s.user_email = ?
      ORDER BY s.created_at DESC
    `, [user_email]);

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions',
      details: error.message
    });
  }
};

const checkSubscriptionStatus = async (req, res) => {
  try {
    const { apiId } = req.params;
    const { user_email } = req.query;

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: 'User email is required'
      });
    }

    const subscription = await getAsync(
      'SELECT id FROM subscriptions WHERE api_id = ? AND user_email = ?',
      [apiId, user_email]
    );

    res.json({
      success: true,
      data: { isSubscribed: !!subscription }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status',
      details: error.message
    });
  }
};

module.exports = {
  toggleSubscription,
  getSubscriptions,
  checkSubscriptionStatus
};
