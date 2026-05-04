const express = require('express');
const router = express.Router();
const Person = require('../models/Person');
const Floor = require('../models/Floor');
const Papa = require('papaparse');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', (req, res) => {
  try {
    const persons = Person.findAll();
    res.json({
      success: true,
      data: persons.map(p => p.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/summary', (req, res) => {
  try {
    const summary = Person.getStatusSummary();
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    res.json({
      success: true,
      data: {
        summary,
        total,
        evacuationRate: total > 0 ? (summary.evacuated / total * 100).toFixed(1) : 0
      }
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
    const persons = Person.findByFloorId(req.params.floorId);
    res.json({
      success: true,
      data: persons.map(p => p.toJSON())
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
    const person = Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    }
    res.json({
      success: true,
      data: person.toJSON()
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
    const { floor_id, name, x, y, status, speed, mobility } = req.body;
    
    if (!floor_id || x === undefined || y === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: floor_id, x, y'
      });
    }
    
    const floor = Floor.findById(floor_id);
    if (!floor) {
      return res.status(404).json({
        success: false,
        error: 'Floor not found'
      });
    }
    
    const person = Person.create({
      floor_id,
      name,
      x: parseFloat(x),
      y: parseFloat(y),
      status: status || 'idle',
      speed: speed !== undefined ? parseFloat(speed) : 1.0,
      mobility: mobility || 'normal'
    });
    
    res.status(201).json({
      success: true,
      data: person.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/bulk', (req, res) => {
  try {
    const { persons } = req.body;
    
    if (!persons || !Array.isArray(persons)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid persons array'
      });
    }
    
    const createdPersons = Person.bulkCreate(persons);
    
    res.status(201).json({
      success: true,
      count: createdPersons.length,
      data: createdPersons.map(p => p.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/import-csv', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    const csvData = req.file.buffer.toString('utf8');
    const result = Papa.parse(csvData, { 
      header: true,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'CSV parse errors',
        details: result.errors
      });
    }
    
    const floors = Floor.findAll();
    const floorMap = new Map();
    for (const floor of floors) {
      floorMap.set(floor.floor_number, floor.id);
      floorMap.set(floor.name, floor.id);
    }
    
    const personsData = [];
    for (const row of result.data) {
      const floorLevel = parseInt(row.floor_level || row.level || row.floor);
      let floorId = null;
      
      if (row.floor_id) {
        floorId = row.floor_id;
      } else if (!isNaN(floorLevel) && floorMap.has(floorLevel)) {
        floorId = floorMap.get(floorLevel);
      } else if (row.floor_name && floorMap.has(row.floor_name)) {
        floorId = floorMap.get(row.floor_name);
      }
      
      if (!floorId) {
        continue;
      }
      
      const x = parseFloat(row.x) || Math.random() * 50;
      const y = parseFloat(row.y) || Math.random() * 30;
      
      personsData.push({
        floor_id: floorId,
        x,
        y,
        status: row.status || 'idle',
        speed: row.speed ? parseFloat(row.speed) : 1.0
      });
    }
    
    const createdPersons = Person.bulkCreate(personsData);
    
    res.json({
      success: true,
      imported: createdPersons.length,
      totalRows: result.data.length,
      data: createdPersons.map(p => p.toJSON())
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
    const person = Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    }
    
    const { x, y, status, speed, nearest_exit_id, evacuation_time } = req.body;
    const updateData = {};
    
    if (x !== undefined) updateData.x = parseFloat(x);
    if (y !== undefined) updateData.y = parseFloat(y);
    if (status !== undefined) updateData.status = status;
    if (speed !== undefined) updateData.speed = parseFloat(speed);
    if (nearest_exit_id !== undefined) updateData.nearest_exit_id = nearest_exit_id;
    if (evacuation_time !== undefined) updateData.evacuation_time = evacuation_time;
    
    const updatedPerson = Person.update(req.params.id, updateData);
    
    res.json({
      success: true,
      data: updatedPerson.toJSON()
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
    const person = Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    }
    
    Person.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Person deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/floor/:floorId', (req, res) => {
  try {
    Person.deleteByFloorId(req.params.floorId);
    
    res.json({
      success: true,
      message: 'All persons on floor deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/', (req, res) => {
  try {
    Person.deleteAll();
    
    res.json({
      success: true,
      message: 'All persons deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
