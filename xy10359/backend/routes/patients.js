const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Drug = require('../models/Drug');

router.get('/', async (req, res) => {
  try {
    const { name, idCard } = req.query;
    const query = {};

    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }
    if (idCard) {
      query.idCard = idCard;
    }

    const patients = await Patient.find(query).sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: '获取患者列表失败', message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: '患者不存在' });
    }
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: '获取患者详情失败', message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.status(201).json(patient);
  } catch (error) {
    res.status(400).json({ error: '创建患者失败', message: error.message });
  }
});

router.get('/drugs/list', async (req, res) => {
  try {
    const { name } = req.query;
    const query = {};
    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }
    const drugs = await Drug.find(query).limit(50);
    res.json(drugs);
  } catch (error) {
    res.status(500).json({ error: '获取药品列表失败', message: error.message });
  }
});

module.exports = router;
