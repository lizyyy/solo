const express = require('express');
const router = express.Router();
const BloodBag = require('../models/bloodBag');
const Donor = require('../models/donor');
const { logAudit } = require('../middleware/auditMiddleware');

router.get('/', async (req, res) => {
  try {
    const bags = await BloodBag.getAll();
    res.json(bags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const bag = await BloodBag.findByCode(req.params.code);
    if (!bag) {
      return res.status(404).json({ error: '血袋不存在' });
    }
    res.json(bag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { bag_code, donor_code, volume, blood_type, collection_time, operator } = req.body;
    
    if (!bag_code) {
      return res.status(400).json({ error: '血袋编号为必填项' });
    }

    const existingBag = await BloodBag.findByCode(bag_code);
    if (existingBag) {
      return res.status(400).json({ error: '血袋编号已存在' });
    }

    let donorId = null;
    if (donor_code) {
      const donor = await Donor.findByCode(donor_code);
      if (!donor) {
        return res.status(400).json({ error: '献血者条码不存在' });
      }
      donorId = donor.id;
    }

    const bag = await BloodBag.create({
      bag_code,
      donor_id: donorId,
      volume: volume || 400,
      blood_type,
      collection_time: collection_time || new Date().toISOString()
    });
    
    await logAudit('CREATE', 'blood_bags', bag.id, operator, null, bag);
    
    res.status(201).json(bag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { donor_code, volume, blood_type, collection_time, operator } = req.body;
    const id = parseInt(req.params.id);

    const existingBag = await BloodBag.findById(id);
    if (!existingBag) {
      return res.status(404).json({ error: '血袋不存在' });
    }

    let donorId = null;
    if (donor_code) {
      const donor = await Donor.findByCode(donor_code);
      if (!donor) {
        return res.status(400).json({ error: '献血者条码不存在' });
      }
      donorId = donor.id;
    }

    await BloodBag.update(id, {
      donor_id: donorId,
      volume: volume || existingBag.volume,
      blood_type,
      collection_time: collection_time || existingBag.collection_time
    });
    
    const updatedBag = await BloodBag.findById(id);
    
    await logAudit('UPDATE', 'blood_bags', id, operator, existingBag, updatedBag);
    
    res.json(updatedBag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator } = req.body;

    const existingBag = await BloodBag.findById(id);
    if (!existingBag) {
      return res.status(404).json({ error: '血袋不存在' });
    }

    await BloodBag.delete(id);
    
    await logAudit('DELETE', 'blood_bags', id, operator, existingBag, null);
    
    res.json({ message: '删除成功', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
