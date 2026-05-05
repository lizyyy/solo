const express = require('express');
const router = express.Router();
const riskDetector = require('../utils/riskDetector');

router.post('/detect', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: '请提供检测数据' });
    }

    const risks = riskDetector.detectAllRisks(data);
    
    res.json({
      success: true,
      risks,
      summary: {
        total: risks.length,
        critical: risks.filter(r => r.severity === 'critical').length,
        warning: risks.filter(r => r.severity === 'warning').length,
        info: risks.filter(r => r.severity === 'info').length
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
