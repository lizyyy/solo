const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', async (req, res) => {
  try {
    const rules = await db.all('SELECT * FROM rules ORDER BY rule_type');
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      min_photos,
      timeout_minutes,
      deduction_per_timeout,
      deduction_per_rework,
      is_enabled
    } = req.body;

    await db.run(`
      UPDATE rules
      SET min_photos = ?, timeout_minutes = ?,
          deduction_per_timeout = ?, deduction_per_rework = ?,
          is_enabled = ?, updated_at = datetime("now", "localtime")
      WHERE id = ?
    `, [min_photos, timeout_minutes, deduction_per_timeout, deduction_per_rework, is_enabled, id]);

    const rule = await db.get('SELECT * FROM rules WHERE id = ?', [id]);
    res.json({
      success: true,
      data: rule,
      message: '规则更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
