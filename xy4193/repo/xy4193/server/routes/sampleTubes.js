const express = require('express');
const router = express.Router();
const SampleTube = require('../models/sampleTube');
const Donor = require('../models/donor');
const { logAudit } = require('../middleware/auditMiddleware');

router.get('/', async (req, res) => {
  try {
    const tubes = await SampleTube.getAll();
    res.json(tubes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const tube = await SampleTube.findByCode(req.params.code);
    if (!tube) {
      return res.status(404).json({ error: '样本管不存在' });
    }
    res.json(tube);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { tube_code, donor_code, tube_type, operator } = req.body;
    
    if (!tube_code) {
      return res.status(400).json({ error: '样本管编号为必填项' });
    }

    const existingTube = await SampleTube.findByCode(tube_code);
    if (existingTube) {
      return res.status(400).json({ error: '样本管编号已存在' });
    }

    let donorId = null;
    if (donor_code) {
      const donor = await Donor.findByCode(donor_code);
      if (!donor) {
        return res.status(400).json({ error: '献血者条码不存在' });
      }
      donorId = donor.id;
    }

    const tube = await SampleTube.create({
      tube_code,
      donor_id: donorId,
      tube_type: tube_type || 'standard'
    });
    
    await logAudit('CREATE', 'sample_tubes', tube.id, operator, null, tube);
    
    res.status(201).json(tube);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { donor_code, tube_type, operator } = req.body;
    const id = parseInt(req.params.id);

    const existingTube = await SampleTube.findById(id);
    if (!existingTube) {
      return res.status(404).json({ error: '样本管不存在' });
    }

    let donorId = null;
    if (donor_code) {
      const donor = await Donor.findByCode(donor_code);
      if (!donor) {
        return res.status(400).json({ error: '献血者条码不存在' });
      }
      donorId = donor.id;
    }

    await SampleTube.update(id, {
      donor_id: donorId || existingTube.donor_id,
      tube_type: tube_type || existingTube.tube_type
    });
    
    const updatedTube = await SampleTube.findById(id);
    
    await logAudit('UPDATE', 'sample_tubes', id, operator, existingTube, updatedTube);
    
    res.json(updatedTube);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator } = req.body;

    const existingTube = await SampleTube.findById(id);
    if (!existingTube) {
      return res.status(404).json({ error: '样本管不存在' });
    }

    await SampleTube.delete(id);
    
    await logAudit('DELETE', 'sample_tubes', id, operator, existingTube, null);
    
    res.json({ message: '删除成功', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
