const express = require('express');
const router = express.Router();
const personnelService = require('../services/personnelService');
const trainingService = require('../services/trainingService');
const blacklistService = require('../services/blacklistService');

router.post('/', async (req, res) => {
  try {
    const personnel = await personnelService.createPersonnel(req.body);
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      department: req.query.department,
      name: req.query.name,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const personnel = await personnelService.getPersonnel(filters);
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const personnel = await personnelService.getPersonnelById(req.params.id);
    if (!personnel) {
      return res.status(404).json({
        success: false,
        error: '人员不存在'
      });
    }
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/details', async (req, res) => {
  try {
    const personnel = await personnelService.getPersonnelWithDetails(req.params.id);
    if (!personnel) {
      return res.status(404).json({
        success: false,
        error: '人员不存在'
      });
    }
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const personnel = await personnelService.updatePersonnel(req.params.id, req.body);
    res.json({
      success: true,
      data: personnel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/training', async (req, res) => {
  try {
    const training = await trainingService.createTraining({
      ...req.body,
      personnel_id: req.params.id
    });
    res.json({
      success: true,
      data: training
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/training', async (req, res) => {
  try {
    const training = await trainingService.getTrainingByPersonnel(req.params.id);
    res.json({
      success: true,
      data: training
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/blacklist', async (req, res) => {
  try {
    const personnel = await personnelService.getPersonnelById(req.params.id);
    const blacklist = await blacklistService.addToBlacklist({
      ...req.body,
      personnel_id: req.params.id,
      id_card: personnel ? personnel.id_card : req.body.id_card,
      name: personnel ? personnel.name : req.body.name
    });
    res.json({
      success: true,
      data: blacklist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
