const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');

router.get('/', async (req, res) => {
  try {
    const totalMatters = await db.get('SELECT COUNT(*) as count FROM business_matters');
    const totalGaps = await db.get('SELECT COUNT(*) as count FROM material_gaps');
    const unresolvedGaps = await db.get('SELECT COUNT(*) as count FROM material_gaps WHERE is_resolved = 0');
    const totalExceptions = await db.get('SELECT COUNT(*) as count FROM exceptions');
    const unresolvedExceptions = await db.get('SELECT COUNT(*) as count FROM exceptions WHERE is_fixed = 0');
    const expiredAttachments = await db.get('SELECT COUNT(*) as count FROM attachments WHERE status = "expired"');

    const gapsByType = await db.all(`
      SELECT gap_type as type, COUNT(*) as count 
      FROM material_gaps 
      GROUP BY gap_type
    `);

    const gapsBySeverity = await db.all(`
      SELECT severity, COUNT(*) as count 
      FROM material_gaps 
      GROUP BY severity
    `);

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
