const express = require('express');
const router = express.Router();
const ArrivalService = require('../services/ArrivalService');

router.post('/', async (req, res) => {
  try {
    const createdBy = req.headers['x-user-id'] || 'system';
    const result = await ArrivalService.create(req.body, createdBy);
    
    if (result.isDuplicate) {
      return res.status(200).json({
        success: true,
        data: result.arrivalNote,
        message: '到货单已存在，返回已有的记录（幂等性）'
      });
    }
    
    res.status(201).json({ success: true, data: result.arrivalNote });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.supplierId) filters.supplierId = req.query.supplierId;
    if (req.query.poId) filters.poId = req.query.poId;

    const arrivals = await ArrivalService.list(filters);
    res.json({ success: true, data: arrivals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    let arrival;
    if (req.params.id.length === 36) {
      arrival = await ArrivalService.findById(req.params.id);
    } else {
      arrival = await ArrivalService.findByArrivalNo(req.params.id);
    }
    
    if (!arrival) {
      return res.status(404).json({ success: false, message: '到货单不存在' });
    }
    res.json({ success: true, data: arrival });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
