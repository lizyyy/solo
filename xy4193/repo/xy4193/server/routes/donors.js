const express = require('express');
const router = express.Router();
const Donor = require('../models/donor');
const { logAudit } = require('../middleware/auditMiddleware');

router.get('/', async (req, res) => {
  try {
    const donors = await Donor.getAll();
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const donor = await Donor.findByCode(req.params.code);
    if (!donor) {
      return res.status(404).json({ error: '献血者不存在' });
    }
    res.json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { donor_code, name, id_card, blood_type, operator } = req.body;
    
    if (!donor_code) {
      return res.status(400).json({ error: '献血者条码为必填项' });
    }

    const existingDonor = await Donor.findByCode(donor_code);
    if (existingDonor) {
      return res.status(400).json({ error: '献血者条码已存在' });
    }

    const donor = await Donor.create({ donor_code, name, id_card, blood_type });
    
    await logAudit('CREATE', 'donors', donor.id, operator, null, donor);
    
    res.status(201).json(donor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, id_card, blood_type, operator } = req.body;
    const id = parseInt(req.params.id);

    const existingDonor = await Donor.findById(id);
    if (!existingDonor) {
      return res.status(404).json({ error: '献血者不存在' });
    }

    await Donor.update(id, { name, id_card, blood_type });
    
    const updatedDonor = await Donor.findById(id);
    
    await logAudit('UPDATE', 'donors', id, operator, existingDonor, updatedDonor);
    
    res.json(updatedDonor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator } = req.body;

    const existingDonor = await Donor.findById(id);
    if (!existingDonor) {
      return res.status(404).json({ error: '献血者不存在' });
    }

    await Donor.delete(id);
    
    await logAudit('DELETE', 'donors', id, operator, existingDonor, null);
    
    res.json({ message: '删除成功', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
