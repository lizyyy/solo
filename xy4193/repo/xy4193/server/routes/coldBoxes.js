const express = require('express');
const router = express.Router();
const ColdBox = require('../models/coldBox');
const ColdBoxTimeline = require('../models/coldBoxTimeline');
const RulesEngine = require('../services/rulesEngine');
const { logAudit } = require('../middleware/auditMiddleware');

router.get('/', async (req, res) => {
  try {
    const boxes = await ColdBox.getAll();
    res.json(boxes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const boxes = await ColdBox.getActive();
    res.json(boxes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const box = await ColdBox.findByCode(req.params.code);
    if (!box) {
      return res.status(404).json({ error: '冷箱不存在' });
    }
    res.json(box);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code/timeline', async (req, res) => {
  try {
    const timeline = await ColdBoxTimeline.getByBoxCode(req.params.code);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { box_code, description, max_temp, status, operator } = req.body;
    
    if (!box_code) {
      return res.status(400).json({ error: '冷箱编号为必填项' });
    }

    const existingBox = await ColdBox.findByCode(box_code);
    if (existingBox) {
      return res.status(400).json({ error: '冷箱编号已存在' });
    }

    const box = await ColdBox.create({
      box_code,
      description,
      max_temp: max_temp || 10,
      status: status || 'active'
    });
    
    await logAudit('CREATE', 'cold_boxes', box.id, operator, null, box);
    
    res.status(201).json(box);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:code/timeline', async (req, res) => {
  try {
    const { event_type, temperature, blood_bag_code, operator, notes } = req.body;
    const boxCode = req.params.code;
    
    if (!event_type) {
      return res.status(400).json({ error: '事件类型为必填项' });
    }

    const box = await ColdBox.findByCode(boxCode);
    if (!box) {
      return res.status(404).json({ error: '冷箱不存在' });
    }

    const timeline = await ColdBoxTimeline.create({
      box_id: box.id,
      event_type,
      temperature,
      blood_bag_code,
      operator,
      notes
    });

    if (temperature !== undefined && temperature !== null) {
      await ColdBox.updateTemperature(box.id, temperature);
    }
    
    await logAudit('CREATE', 'cold_box_timeline', timeline.id, operator, null, timeline);
    
    res.status(201).json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/check-temperature', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await RulesEngine.checkTemperatureTimeout(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code/check-cross-contamination', async (req, res) => {
  try {
    const { blood_bag_code } = req.query;
    const boxCode = req.params.code;
    
    if (!blood_bag_code) {
      return res.status(400).json({ error: '请提供 blood_bag_code' });
    }

    const box = await ColdBox.findByCode(boxCode);
    if (!box) {
      return res.status(404).json({ error: '冷箱不存在' });
    }

    const result = await RulesEngine.checkColdBoxCrossContamination(blood_bag_code, box.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { description, max_temp, current_temp, status, operator } = req.body;
    const id = parseInt(req.params.id);

    const existingBox = await ColdBox.findById(id);
    if (!existingBox) {
      return res.status(404).json({ error: '冷箱不存在' });
    }

    await ColdBox.update(id, {
      description: description || existingBox.description,
      max_temp: max_temp || existingBox.max_temp,
      current_temp: current_temp !== undefined ? current_temp : existingBox.current_temp,
      status: status || existingBox.status
    });
    
    const updatedBox = await ColdBox.findById(id);
    
    await logAudit('UPDATE', 'cold_boxes', id, operator, existingBox, updatedBox);
    
    res.json(updatedBox);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator } = req.body;

    const existingBox = await ColdBox.findById(id);
    if (!existingBox) {
      return res.status(404).json({ error: '冷箱不存在' });
    }

    await ColdBox.delete(id);
    
    await logAudit('DELETE', 'cold_boxes', id, operator, existingBox, null);
    
    res.json({ message: '删除成功', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
