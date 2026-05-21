const { allAsync, getAsync, runAsync } = require('../config/database');

const getOwners = async (req, res) => {
  try {
    const owners = await allAsync(`
      SELECT o.*, COUNT(a.id) as api_count
      FROM owners o
      LEFT JOIN api_entries a ON o.id = a.owner_id
      GROUP BY o.id
      ORDER BY o.name
    `);

    res.json({
      success: true,
      data: owners
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch owners',
      details: error.message
    });
  }
};

const createOwner = async (req, res) => {
  try {
    const { name, email, department } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    const existingOwner = await getAsync('SELECT id FROM owners WHERE email = ?', [email]);
    if (existingOwner) {
      return res.status(409).json({
        success: false,
        error: 'Owner with this email already exists'
      });
    }

    const result = await runAsync(
      'INSERT INTO owners (name, email, department) VALUES (?, ?, ?)',
      [name, email, department]
    );

    const newOwner = await getAsync('SELECT * FROM owners WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      data: newOwner
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create owner',
      details: error.message
    });
  }
};

module.exports = {
  getOwners,
  createOwner
};
