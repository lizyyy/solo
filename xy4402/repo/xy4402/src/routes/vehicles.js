const express = require('express');
const router = express.Router();
const { Vehicle } = require('../models');
const { Op } = require('sequelize');

router.post('/', async (req, res) => {
  try {
    const { 
      plateNumber, 
      type, 
      capacity, 
      driverName, 
      driverPhone,
      status
    } = req.body;
    
    if (!plateNumber) {
      return res.status(400).json({
        success: false,
        error: '车牌号是必填项'
      });
    }
    
    const existingVehicle = await Vehicle.findOne({
      where: { plateNumber }
    });
    
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        error: '车牌号已存在'
      });
    }
    
    const vehicle = await Vehicle.create({
      plateNumber,
      type,
      capacity,
      driverName,
      driverPhone,
      status: status || 'active'
    });
    
    res.status(201).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, search, limit = 100, offset = 0 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    
    if (search) {
      where[Op.or] = [
        { plateNumber: { [Op.like]: `%${search}%` } },
        { type: { [Op.like]: `%${search}%` } },
        { driverName: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const { count, rows } = await Vehicle.findAndCountAll({
      where,
      order: [['plateNumber', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        items: rows
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const vehicle = await Vehicle.findByPk(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: '车辆不存在'
      });
    }
    
    res.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const vehicle = await Vehicle.findByPk(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: '车辆不存在'
      });
    }
    
    if (updateData.plateNumber) {
      const existingVehicle = await Vehicle.findOne({
        where: {
          id: { [Op.ne]: id },
          plateNumber: updateData.plateNumber
        }
      });
      
      if (existingVehicle) {
        return res.status(400).json({
          success: false,
          error: '车牌号已存在'
        });
      }
    }
    
    await vehicle.update(updateData);
    
    res.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const vehicle = await Vehicle.findByPk(id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: '车辆不存在'
      });
    }
    
    await vehicle.destroy();
    
    res.json({
      success: true,
      message: '车辆已删除'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
