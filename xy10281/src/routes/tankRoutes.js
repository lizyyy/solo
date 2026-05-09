const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const TankDao = require('../daos/tankDao');
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

    const { name, type, capacity, waterPh, waterTemperature, waterSalinity, isQuarantineReady } = req.body;
    
    if (!name || !type || !capacity) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['name', 'type', 'capacity'] 
      });
    }

    if (!['main', 'quarantine', 'hospital'].includes(type)) {
      return res.status(400).json({ error: '缸体类型必须是 main、quarantine 或 hospital' });
    }

    if (capacity <= 0) {
      return res.status(400).json({ error: '缸体容量必须大于 0' });
    }

    const id = uuidv4();
    const result = await TankDao.create({
      id,
      name,
      type,
      capacity,
      waterPh: waterPh || 7.0,
      waterTemperature: waterTemperature || 25.0,
      waterSalinity: waterSalinity || 0.0,
      isQuarantineReady: isQuarantineReady || (type !== 'main')
    });
    
    const response = {
      success: true,
      data: result,
      message: '缸体创建成功'
    };

    if (requestId) {
      await IdempotencyDao.create(requestId, 'POST /api/tanks', response);
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let tanks;
    
    if (type) {
      if (!['main', 'quarantine', 'hospital'].includes(type)) {
        return res.status(400).json({ error: '无效的缸体类型' });
      }
      tanks = await TankDao.getByType(type);
    } else {
      tanks = await TankDao.all();
    }
    
    res.json({ success: true, data: tanks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tank = await TankDao.getById(req.params.id);
    if (!tank) {
      return res.status(404).json({ error: '缸体不存在' });
    }
    res.json({ success: true, data: tank });
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

    if (updates.capacity !== undefined && updates.capacity <= 0) {
      return res.status(400).json({ error: '缸体容量必须大于 0' });
    }

    if (updates.waterPh !== undefined && (updates.waterPh < 0 || updates.waterPh > 14)) {
      return res.status(400).json({ error: 'pH 值必须在 0-14 之间' });
    }

    const result = await TankDao.update(req.params.id, updates);
    
    if (!result || result.changes === 0) {
      return res.status(404).json({ error: '缸体不存在或无更新' });
    }

    const updatedTank = await TankDao.getById(req.params.id);
    const response = {
      success: true,
      data: updatedTank,
      message: '缸体更新成功'
    };

    if (requestId) {
      await IdempotencyDao.create(requestId, 'PUT /api/tanks/:id', response);
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/availability', async (req, res) => {
  try {
    const tank = await TankDao.getById(req.params.id);
    if (!tank) {
      return res.status(404).json({ error: '缸体不存在' });
    }
    
    const availability = {
      id: tank.id,
      name: tank.name,
      type: tank.type,
      capacity: tank.capacity,
      currentOccupancy: tank.current_occupancy,
      availableCapacity: tank.capacity - tank.current_occupancy,
      isQuarantineReady: tank.is_quarantine_ready === 1,
      waterParameters: {
        ph: tank.water_ph,
        temperature: tank.water_temperature,
        salinity: tank.water_salinity,
        qualityScore: tank.water_quality_score
      }
    };
    
    res.json({ success: true, data: availability });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
