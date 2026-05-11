const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const store = require('../data/store');

router.get('/cost/staff', (req, res) => {
  try {
    const { staffId, startDate, endDate } = req.query;
    const result = reportService.getCostByStaff(staffId, startDate, endDate);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/cost/equipment-type', (req, res) => {
  try {
    const { equipmentType, startDate, endDate } = req.query;
    const result = reportService.getCostByEquipmentType(equipmentType, startDate, endDate);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/inventory', (req, res) => {
  try {
    const inventory = reportService.getInventoryStatus();
    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/parts', (req, res) => {
  try {
    const parts = Array.from(store.spareParts.values());
    res.json({
      success: true,
      data: parts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/staff', (req, res) => {
  try {
    const staff = Array.from(store.maintenanceStaff.values());
    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/equipment', (req, res) => {
  try {
    const equipment = Array.from(store.equipment.values());
    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
