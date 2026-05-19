const express = require('express');
const router = express.Router();
const BlacklistService = require('../services/blacklistService');

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    const result = await BlacklistService.addToBlacklist(req.body, operator);
    
    if (result.success) {
      res.json({ success: true, id: result.id, message: '添加成功' });
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
      type: req.query.type,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    
    const records = await BlacklistService.getBlacklist(options);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    const result = await BlacklistService.removeFromBlacklist(req.params.id, operator);
    
    if (result.success) {
      res.json({ success: true, message: '移除成功' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/check', async (req, res) => {
  try {
    const { type, value } = req.body;
    
    if (!type || !value) {
      return res.status(400).json({ success: false, error: '类型和值不能为空' });
    }
    
    const result = await BlacklistService.checkBlacklist(type, value);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

module.exports = router;
