const express = require('express');
const router = express.Router();
const BagTubeMatch = require('../models/bagTubeMatch');
const BloodBag = require('../models/bloodBag');
const SampleTube = require('../models/sampleTube');
const RulesEngine = require('../services/rulesEngine');
const { logAudit } = require('../middleware/auditMiddleware');

router.get('/', async (req, res) => {
  try {
    const matches = await BagTubeMatch.getAll();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const matches = await BagTubeMatch.getByStatus('pending');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/donor/:donorCode', async (req, res) => {
  try {
    const matches = await BagTubeMatch.findByDonorCode(req.params.donorCode);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const { blood_bag_code, sample_tube_code } = req.body;
    
    if (!blood_bag_code || !sample_tube_code) {
      return res.status(400).json({ error: '血袋编号和样本管编号为必填项' });
    }

    const bloodBag = await BloodBag.findByCode(blood_bag_code);
    const sampleTube = await SampleTube.findByCode(sample_tube_code);

    if (!bloodBag) {
      return res.status(404).json({ error: '血袋不存在' });
    }
    if (!sampleTube) {
      return res.status(404).json({ error: '样本管不存在' });
    }

    const validation = await RulesEngine.validateSampleTubeMatch(bloodBag.id, sampleTube.id);
    
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { blood_bag_code, sample_tube_code, matched_by, operator } = req.body;
    
    if (!blood_bag_code || !sample_tube_code) {
      return res.status(400).json({ error: '血袋编号和样本管编号为必填项' });
    }

    const bloodBag = await BloodBag.findByCode(blood_bag_code);
    const sampleTube = await SampleTube.findByCode(sample_tube_code);

    if (!bloodBag) {
      return res.status(404).json({ error: '血袋不存在' });
    }
    if (!sampleTube) {
      return res.status(404).json({ error: '样本管不存在' });
    }

    const validation = await RulesEngine.validateSampleTubeMatch(bloodBag.id, sampleTube.id);
    if (!validation.valid) {
      return res.status(400).json(validation);
    }

    const match = await BagTubeMatch.create({
      blood_bag_id: bloodBag.id,
      sample_tube_id: sampleTube.id,
      matched_by: matched_by || operator,
      status: 'matched'
    });
    
    await logAudit('CREATE', 'bag_tube_matches', match.id, operator, null, match);
    
    res.status(201).json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { items, operator } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items 必须是数组' });
    }

    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        const { blood_bag_code, sample_tube_code } = item;
        
        if (!blood_bag_code || !sample_tube_code) {
          errors.push({ item, error: '缺少血袋编号或样本管编号' });
          continue;
        }

        const bloodBag = await BloodBag.findByCode(blood_bag_code);
        const sampleTube = await SampleTube.findByCode(sample_tube_code);

        if (!bloodBag) {
          errors.push({ item, error: `血袋 ${blood_bag_code} 不存在` });
          continue;
        }
        if (!sampleTube) {
          errors.push({ item, error: `样本管 ${sample_tube_code} 不存在` });
          continue;
        }

        const validation = await RulesEngine.validateSampleTubeMatch(bloodBag.id, sampleTube.id);
        if (!validation.valid) {
          errors.push({ item, error: validation.error, rule: validation.rule });
          continue;
        }

        const match = await BagTubeMatch.create({
          blood_bag_id: bloodBag.id,
          sample_tube_id: sampleTube.id,
          matched_by: operator,
          status: 'matched'
        });

        await logAudit('CREATE', 'bag_tube_matches', match.id, operator, null, match);
        
        results.push({ ...item, matchId: match.id, success: true });
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

router.put('/:id/status', async (req, res) => {
  try {
    const { status, operator } = req.body;
    const id = parseInt(req.params.id);

    if (!['matched', 'pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const existingMatch = await BagTubeMatch.findById(id);
    if (!existingMatch) {
      return res.status(404).json({ error: '配对记录不存在' });
    }

    await BagTubeMatch.updateStatus(id, status);
    
    const updatedMatch = await BagTubeMatch.findById(id);
    
    await logAudit('UPDATE', 'bag_tube_matches', id, operator, existingMatch, updatedMatch);
    
    res.json(updatedMatch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator } = req.body;

    const existingMatch = await BagTubeMatch.findById(id);
    if (!existingMatch) {
      return res.status(404).json({ error: '配对记录不存在' });
    }

    await BagTubeMatch.delete(id);
    
    await logAudit('DELETE', 'bag_tube_matches', id, operator, existingMatch, null);
    
    res.json({ message: '删除成功', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
