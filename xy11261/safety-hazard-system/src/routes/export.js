const express = require('express');
const router = express.Router();
const { exportHazardsToExcel } = require('../utils/exporter');
const { getAllRuleLogs } = require('../utils/ruleEngine');

router.get('/hazards', async (req, res) => {
  try {
    const { 
      rectifier, 
      status, 
      hazard_level, 
      start_time, 
      end_time, 
      location 
    } = req.query;

    const filters = {
      rectifier,
      status,
      hazard_level,
      start_time,
      end_time,
      location
    };

    const result = await exportHazardsToExcel(filters);

    res.download(result.filePath, result.filename, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/rule-logs', (req, res) => {
  try {
    const { hazard_id, action, rule_name } = req.query;
    
    const logs = getAllRuleLogs({ hazard_id, action, rule_name });
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
