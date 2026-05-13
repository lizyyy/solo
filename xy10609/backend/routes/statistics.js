const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    const totalMatters = db.prepare('SELECT COUNT(*) as count FROM business_matters').get();
    const totalGaps = db.prepare('SELECT COUNT(*) as count FROM material_gaps').get();
    const unresolvedGaps = db.prepare('SELECT COUNT(*) as count FROM material_gaps WHERE is_resolved = 0').get();
    const totalExceptions = db.prepare('SELECT COUNT(*) as count FROM exceptions').get();
    const unresolvedExceptions = db.prepare('SELECT COUNT(*) as count FROM exceptions WHERE is_fixed = 0').get();
    const expiredAttachments = db.prepare('SELECT COUNT(*) as count FROM attachments WHERE status = "expired"').get();

    const gapsByType = db.prepare(`
      SELECT gap_type as type, COUNT(*) as count 
      FROM material_gaps 
      GROUP BY gap_type
    `).all();

    const gapsBySeverity = db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM material_gaps 
      GROUP BY severity
    `).all();

    res.json({
      success: true,
      data: {
        totalMatters: totalMatters.count,
        totalGaps: totalGaps.count,
        unresolvedGaps: unresolvedGaps.count,
        totalExceptions: totalExceptions.count,
        unresolvedExceptions: unresolvedExceptions.count,
        expiredAttachments: expiredAttachments.count,
        gapsByType,
        gapsBySeverity
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
