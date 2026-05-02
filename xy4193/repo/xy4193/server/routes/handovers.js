const express = require('express');
const router = express.Router();
const Handover = require('../models/handover');
const HandoverItem = require('../models/handoverItem');
const BloodBag = require('../models/bloodBag');
const SampleTube = require('../models/sampleTube');
const RulesEngine = require('../services/rulesEngine');
const { logAudit } = require('../middleware/auditMiddleware');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const handovers = await Handover.getAll();
    res.json(handovers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const handovers = await Handover.getByStatus('pending');
    res.json(handovers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const handover = await Handover.findByCode(req.params.code);
    if (!handover) {
      return res.status(404).json({ error: '交接记录不存在' });
    }
    res.json(handover);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code/items', async (req, res) => {
  try {
    const handover = await Handover.findByCode(req.params.code);
    if (!handover) {
      return res.status(404).json({ error: '交接记录不存在' });
    }
    const items = await HandoverItem.getByHandoverId(handover.id);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { from_operator, to_operator, notes, operator } = req.body;
    
    if (!from_operator || !to_operator) {
      return res.status(400).json({ error: '移交人和接收人为必填项' });
    }

    const handover_code = `HO-${Date.now()}-${uuidv4().slice(0, 6)}`;

    const handover = await Handover.create({
      handover_code,
      from_operator,
      to_operator,
      status: 'pending',
      notes
    });
    
    await logAudit('CREATE', 'handovers', handover.id, operator, null, handover);
    
    res.status(201).json(handover);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:code/items', async (req, res) => {
  try {
    const { items, operator } = req.body;
    const handoverCode = req.params.code;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items 必须是数组' });
    }

    const handover = await Handover.findByCode(handoverCode);
    if (!handover) {
      return res.status(404).json({ error: '交接记录不存在' });
    }

    if (handover.status !== 'pending') {
      return res.status(400).json({ error: '只能向待处理的交接记录添加项目' });
    }

    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        const { blood_bag_code, sample_tube_code, donor_code } = item;

        let bloodBagId = null;
        let sampleTubeId = null;

        if (blood_bag_code) {
          const bloodBag = await BloodBag.findByCode(blood_bag_code);
          if (!bloodBag) {
            errors.push({ item, error: `血袋 ${blood_bag_code} 不存在` });
            continue;
          }
          bloodBagId = bloodBag.id;
        }

        if (sample_tube_code) {
          const sampleTube = await SampleTube.findByCode(sample_tube_code);
          if (!sampleTube) {
            errors.push({ item, error: `样本管 ${sample_tube_code} 不存在` });
            continue;
          }
          sampleTubeId = sampleTube.id;
        }

        const handoverItem = await HandoverItem.create({
          handover_id: handover.id,
          blood_bag_id: bloodBagId,
          sample_tube_id: sampleTubeId,
          donor_code: donor_code,
          status: 'pending'
        });

        await logAudit('CREATE', 'handover_items', handoverItem.id, operator, null, handoverItem);
        
        results.push({ ...item, itemId: handoverItem.id, success: true });
      } catch (err) {
        errors.push({ item, error: err.message });
      }
    }

    res.json({
      total: items.length,
      success: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:code/validate', async (req, res) => {
  try {
    const handoverCode = req.params.code;

    const handover = await Handover.findByCode(handoverCode);
    if (!handover) {
      return res.status(404).json({ error: '交接记录不存在' });
    }

    const items = await HandoverItem.getByHandoverId(handover.id);
    
    const validationResult = await RulesEngine.validateCompleteHandover(items);
    
    res.json(validationResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:code/complete', async (req, res) => {
  try {
    const { operator } = req.body;
    const handoverCode = req.params.code;

    const handover = await Handover.findByCode(handoverCode);
    if (!handover) {
      return res.status(404).json({ error: '交接记录不存在' });
    }

    if (handover.status !== 'pending') {
      return res.status(400).json({ error: '该交接记录已完成或已退回' });
    }

    const items = await HandoverItem.getByHandoverId(handover.id);
    
    const validationResult = await RulesEngine.validateCompleteHandover(items);
    
    if (!validationResult.valid) {
      return res.status(400).json({
        error: '交接验证失败',
        validation: validationResult
      });
    }

    const completedAt = new Date().toISOString();
    await Handover.updateStatus(handover.id, 'completed', completedAt);
    
    for (const item of items) {
      await HandoverItem.updateStatus(item.id, 'passed', 'validation_passed', null);
    }

    const updatedHandover = await Handover.findByCode(handoverCode);
    
    await logAudit('UPDATE', 'handovers', handover.id, operator, handover, updatedHandover);
    
    res.json(updatedHandover);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:code/reject', async (req, res) => {
  try {
    const { reason, operator, itemIds } = req.body;
    const handoverCode = req.params.code;

    const handover = await Handover.findByCode(handoverCode);
    if (!handover) {
      return res.status(404).json({ error: '交接记录不存在' });
    }

    if (handover.status === 'completed') {
      return res.status(400).json({ error: '该交接记录已完成，无法退回' });
    }

    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      for (const itemId of itemIds) {
        await HandoverItem.updateStatus(itemId, 'failed', 'rejected', reason || '退回处理');
      }
    }

    await Handover.updateStatus(handover.id, 'rejected');

    const updatedHandover = await Handover.findByCode(handoverCode);
    
    await logAudit('UPDATE', 'handovers', handover.id, operator, handover, updatedHandover);
    
    res.json({
      message: '交接已退回',
      handover: updatedHandover,
      reason: reason
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:itemId', async (req, res) => {
  try {
    const { status, check_result, exception_reason, operator } = req.body;
    const itemId = parseInt(req.params.itemId);

    const existingItem = await HandoverItem.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ error: '交接项目不存在' });
    }

    await HandoverItem.updateStatus(itemId, status, check_result, exception_reason);

    const updatedItem = await HandoverItem.findById(itemId);
    
    await logAudit('UPDATE', 'handover_items', itemId, operator, existingItem, updatedItem);
    
    res.json(updatedItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator } = req.body;

    const existingHandover = await Handover.findById(id);
    if (!existingHandover) {
      return res.status(404).json({ error: '交接记录不存在' });
    }

    await HandoverItem.deleteByHandoverId(id);
    await Handover.delete(id);
    
    await logAudit('DELETE', 'handovers', id, operator, existingHandover, null);
    
    res.json({ message: '删除成功', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
