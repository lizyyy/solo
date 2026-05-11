const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');

router.get('/', async (req, res) => {
  try {
    const { settlementType, month } = req.query;
    const query = {};
    
    if (settlementType && settlementType !== '全部') {
      query.settlementType = settlementType;
    }
    
    if (month) {
      const [year, m] = month.split('-');
      const startDate = new Date(year, parseInt(m) - 1, 1);
      const endDate = new Date(year, parseInt(m), 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }
    
    const settlements = await Settlement.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: settlements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: '结算记录不存在' });
    }
    res.json({ success: true, data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
