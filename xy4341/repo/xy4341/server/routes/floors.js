const express = require('express');
const router = express.Router();
const Floor = require('../models/Floor');
const Exit = require('../models/Exit');
const Person = require('../models/Person');

router.get('/', (req, res) => {
  try {
    const floors = Floor.findAll();
    res.json({
      success: true,
      data: floors.map(f => f.toJSON())
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
    const floor = Floor.findById(req.params.id);
    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found'
      });
    }
    
    const exits = Exit.findByFloorId(floor.id);
    const persons = Person.findByFloorId(floor.id);
    
    res.json({
      success: true,
      data: {
        floor: floor.toJSON(),
        exits: exits.map(e => e.toJSON()),
        persons: persons.map(p => p.toJSON())
      }
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
    const { name, level, floor_number, width, height, layout, description } = req.body;
    
    const floorNum = floor_number !== undefined ? floor_number : level;
    
    if (!name || floorNum === undefined || !width || !height) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, floor_number (or level), width, height'
      });
    }
    
    const floor = Floor.create({
      name,
      floor_number: parseInt(floorNum),
      width: parseFloat(width),
      height: parseFloat(height),
      layout,
      description
    });
    
    res.status(201).json({
      success: true,
      data: floor.toJSON()
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
    const floor = Floor.findById(req.params.id);
    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found'
      });
    }
    
    const { name, level, floor_number, width, height, layout, description } = req.body;
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (floor_number !== undefined) updateData.floor_number = parseInt(floor_number);
    else if (level !== undefined) updateData.floor_number = parseInt(level);
    if (width !== undefined) updateData.width = parseFloat(width);
    if (height !== undefined) updateData.height = parseFloat(height);
    if (layout !== undefined) updateData.layout = layout;
    if (description !== undefined) updateData.description = description;
    
    const updatedFloor = Floor.update(req.params.id, updateData);
    
    res.json({
      success: true,
      data: updatedFloor.toJSON()
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
    const floor = Floor.findById(req.params.id);
    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found'
      });
    }
    
    const exits = Exit.findByFloorId(req.params.id);
    for (const exit of exits) {
      Exit.delete(exit.id);
    }
    
    Person.deleteByFloorId(req.params.id);
    
    Floor.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Floor deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
