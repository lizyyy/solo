const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

const db = getDatabase();

router.get('/', (req, res) => {
  try {
    const departments = db.prepare(`SELECT * FROM departments ORDER BY name`).all();
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const dept = db.prepare(`SELECT * FROM departments WHERE id = ?`).get(req.params.id);
    if (!dept) {
      return res.status(404).json({ success: false, error: '科室不存在' });
    }
    res.json({ success: true, data: dept });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
