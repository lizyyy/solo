const express = require('express');
const router = express.Router();
const Exit = require('../models/Exit');
const Floor = require('../models/Floor');

router.get('/', (req, res) => {
  try {
    const exits = Exit.findAll();
    res.json({
      success: true,
      data: exits.map(e => e.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/floor/:floorId', (req, res) => {
  try {
    const exits = Exit.findByFloorId(req.params.floorId);
    res.json({
      success: true,
      data: exits.map(e => e.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const exit = Exit.findById(req.params.id);
    if (!exit) {
      return res.status(404).json({
        success: false,
        error: 'Exit not found'
      });
    }
    res.json({
      success: true,
      data: exit.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { floor_id, name, type, x, y, width, status, capacity, capacity_per_minute } = req.body;
    
    if (!floor_id || !name || x === undefined || y === undefined || width === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: floor_id, name, x, y, width'
      });
    }
    
    const floor = Floor.findById(floor_id);
    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found'
      });
    }
    
    const exit = Exit.create({
      floor_id,
      name,
      type: type || 'normal',
      x: parseFloat(x),
      y: parseFloat(y),
      width: parseFloat(width),
      status: status || 'available',
      capacity: capacity !== undefined ? parseInt(capacity) : 1,
      capacity_per_minute: capacity_per_minute !== undefined ? parseInt(capacity_per_minute) : 10
    });
    
    res.status(201).json({
      success: true,
      data: exit.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const exit = Exit.findById(req.params.id);
    if (!exit) {
      return res.status(404).json({
        success: false,
        error: 'Exit not found'
      });
    }
    
    const { name, type, x, y, width, status, capacity, capacity_per_minute } = req.body;
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (x !== undefined) updateData.x = parseFloat(x);
    if (y !== undefined) updateData.y = parseFloat(y);
    if (width !== undefined) updateData.width = parseFloat(width);
    if (status !== undefined) updateData.status = status;
    if (capacity !== undefined) updateData.capacity = parseInt(capacity);
    if (capacity_per_minute !== undefined) updateData.capacity_per_minute = parseInt(capacity_per_minute);
    
    const updatedExit = Exit.update(req.params.id, updateData);
    
    res.json({
      success: true,
      data: updatedExit.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const exit = Exit.findById(req.params.id);
    if (!exit) {
      return res.status(404).json({
        success: false,
        error: 'Exit not found'
      });
    }
    
    Exit.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Exit deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
