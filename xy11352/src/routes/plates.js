const express = require('express');
const router = express.Router();
const TemporaryPlateService = require('../services/temporaryPlateService');

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    const result = await TemporaryPlateService.createPlate(req.body, operator);
    
    if (result.success) {
      res.json({ success: true, id: result.id, message: '创建成功' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/', async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      plate_number: req.query.plate_number,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    
    const plates = await TemporaryPlateService.getPlates(options);
    res.json({ success: true, data: plates });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const plate = await TemporaryPlateService.getPlate(req.params.id);
    
    if (plate) {
      res.json({ success: true, data: plate });
    } else {
      res.status(404).json({ success: false, error: '记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.put('/:id/revoke', async (req, res) => {
  try {
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    const result = await TemporaryPlateService.revokePlate(req.params.id, operator);
    
    if (result.success) {
      res.json({ success: true, message: '吊销成功' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

module.exports = router;
