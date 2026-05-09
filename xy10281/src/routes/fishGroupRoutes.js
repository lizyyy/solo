const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const FishGroupDao = require('../daos/fishGroupDao');
const IdempotencyDao = require('../daos/idempotencyDao');

router.post('/', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'];
    
    if (requestId) {
      const existing = await IdempotencyDao.get(requestId);
      if (existing) {
        return res.status(200).json({
          ...JSON.parse(existing.response_data),
          _from_cache: true
        });
      }
    }

    const { species, speciesName, count, tankId } = req.body;
    
    if (!species || !speciesName || count === undefined) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['species', 'speciesName', 'count'] 
      });
    }

    if (count < 0) {
      return res.status(400).json({ error: '鱼群数量不能为负数' });
    }

    const id = uuidv4();
    const result = await FishGroupDao.create(id, species, speciesName, count, tankId);
    
    const response = {
      success: true,
      data: result,
      message: '鱼群档案创建成功'
    };

    if (requestId) {
      await IdempotencyDao.create(requestId, 'POST /api/fish-groups', response);
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const fishGroups = await FishGroupDao.all();
    res.json({ success: true, data: fishGroups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const fishGroup = await FishGroupDao.getById(req.params.id);
    if (!fishGroup) {
      return res.status(404).json({ error: '鱼群不存在' });
    }
    res.json({ success: true, data: fishGroup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const requestId = req.headers['x-request-id'];
    
    if (requestId) {
      const existing = await IdempotencyDao.get(requestId);
      if (existing) {
        return res.status(200).json({
          ...JSON.parse(existing.response_data),
          _from_cache: true
        });
      }
    }

    const updates = req.body;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '没有提供更新内容' });
    }

    if (updates.count !== undefined && updates.count < 0) {
      return res.status(400).json({ error: '鱼群数量不能为负数' });
    }

    const result = await FishGroupDao.update(req.params.id, updates);
    
    if (!result || result.changes === 0) {
      return res.status(404).json({ error: '鱼群不存在或无更新' });
    }

    const updatedFishGroup = await FishGroupDao.getById(req.params.id);
    const response = {
      success: true,
      data: updatedFishGroup,
      message: '鱼群档案更新成功'
    };

    if (requestId) {
      await IdempotencyDao.create(requestId, 'PUT /api/fish-groups/:id', response);
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
