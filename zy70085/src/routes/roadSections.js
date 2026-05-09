const express = require('express');
const { RoadSection } = require('../models');
const { RoadSectionStatus } = require('../constants/status');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      roadName, sectionName, startMileage, endMileage,
      lanes, roadClass, description
    } = req.body;

    const totalLength = endMileage - startMileage;

    const section = await RoadSection.create({
      roadName,
      sectionName,
      startMileage,
      endMileage,
      totalLength,
      availableLength: totalLength,
      lanes,
      roadClass,
      status: RoadSectionStatus.AVAILABLE,
      description
    });

    res.status(201).json({ success: true, data: section });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const sections = await RoadSection.findAll({
      order: [['roadName', 'ASC'], ['startMileage', 'ASC']]
    });
    res.json({ success: true, data: sections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const section = await RoadSection.findByPk(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, error: '路段不存在' });
    }
    res.json({ success: true, data: section });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const section = await RoadSection.findByPk(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, error: '路段不存在' });
    }

    const { roadName, sectionName, lanes, roadClass, description } = req.body;

    await section.update({
      roadName,
      sectionName,
      lanes,
      roadClass,
      description
    });

    res.json({ success: true, data: section });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
