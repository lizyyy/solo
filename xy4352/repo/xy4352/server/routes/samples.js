const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Op } = require('sequelize');
const { WaterSample, Risk } = require('../models');
const CsvImportService = require('../services/csvImportService');
const { getParameterStatus, WATER_QUALITY_STANDARDS } = require('../config/waterQualityStandards');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, samplePoint, startDate, endDate, parameter } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const whereClause = {};
    
    if (samplePoint) {
      whereClause.samplePoint = samplePoint;
    }
    
    if (startDate && endDate) {
      whereClause.sampleTime = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereClause.sampleTime = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.sampleTime = {
        [Op.lte]: new Date(endDate)
      };
    }
    
    const { count, rows } = await WaterSample.findAndCountAll({
      where: whereClause,
      order: [['sampleTime', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    const samplesWithStatus = rows.map(sample => {
      const sampleData = sample.toJSON();
      sampleData.parameterStatus = {
        chlorine: getParameterStatus('chlorine', sample.chlorine),
        ph: getParameterStatus('ph', sample.ph),
        turbidity: getParameterStatus('turbidity', sample.turbidity),
        temperature: getParameterStatus('temperature', sample.temperature)
      };
      return sampleData;
    });
    
    res.json({
      success: true,
      data: {
        samples: samplesWithStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching samples:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/sample-points', async (req, res) => {
  try {
    const samplePoints = await WaterSample.findAll({
      attributes: ['samplePoint'],
      group: ['samplePoint'],
      order: [['samplePoint', 'ASC']],
      raw: true
    });
    
    res.json({
      success: true,
      data: samplePoints.map(sp => sp.samplePoint)
    });
  } catch (error) {
    console.error('Error fetching sample points:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/chart-data', async (req, res) => {
  try {
    const { samplePoint, startDate, endDate, parameter } = req.query;
    
    const whereClause = {};
    
    if (samplePoint) {
      whereClause.samplePoint = samplePoint;
    }
    
    if (startDate && endDate) {
      whereClause.sampleTime = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    const samples = await WaterSample.findAll({
      where: whereClause,
      order: [['sampleTime', 'ASC'], ['samplePoint', 'ASC']]
    });
    
    const parameters = parameter ? [parameter] : ['chlorine', 'ph', 'turbidity', 'temperature'];
    
    const chartData = {};
    
    const samplePoints = [...new Set(samples.map(s => s.samplePoint))];
    
    for (const point of samplePoints) {
      chartData[point] = {};
      
      for (const param of parameters) {
        const standard = WATER_QUALITY_STANDARDS[param];
        const pointSamples = samples.filter(s => s.samplePoint === point);
        
        chartData[point][param] = {
          labels: pointSamples.map(s => new Date(s.sampleTime).toLocaleString()),
          values: pointSamples.map(s => s[param]),
          statuses: pointSamples.map(s => getParameterStatus(param, s[param])),
          standard: {
            min: standard.min,
            max: standard.max,
            warningMin: standard.warningMin,
            warningMax: standard.warningMax,
            unit: standard.unit
          }
        };
      }
    }
    
    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.sampleTime = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    const totalSamples = await WaterSample.count({ where: whereClause });
    
    const samplePoints = await WaterSample.findAll({
      attributes: ['samplePoint'],
      group: ['samplePoint'],
      where: whereClause,
      raw: true
    });
    
    const samples = await WaterSample.findAll({ where: whereClause });
    
    let normalCount = 0;
    let warningCount = 0;
    let overlimitCount = 0;
    
    for (const sample of samples) {
      const hasOverlimit = [
        getParameterStatus('chlorine', sample.chlorine),
        getParameterStatus('ph', sample.ph),
        getParameterStatus('turbidity', sample.turbidity),
        getParameterStatus('temperature', sample.temperature)
      ].some(s => s === 'OVERLIMIT');
      
      const hasWarning = [
        getParameterStatus('chlorine', sample.chlorine),
        getParameterStatus('ph', sample.ph),
        getParameterStatus('turbidity', sample.turbidity),
        getParameterStatus('temperature', sample.temperature)
      ].some(s => s === 'WARNING');
      
      if (hasOverlimit) {
        overlimitCount++;
      } else if (hasWarning) {
        warningCount++;
      } else {
        normalCount++;
      }
    }
    
    const activeRisks = await Risk.count({
      where: {
        status: {
          [Op.in]: ['PENDING', 'REVIEWING']
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        totalSamples,
        samplePointCount: samplePoints.length,
        statusDistribution: {
          normal: normalCount,
          warning: warningCount,
          overlimit: overlimitCount
        },
        activeRisks
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要导入的CSV文件'
      });
    }
    
    const { operator } = req.body;
    const result = await CsvImportService.importFromBuffer(
      req.file.buffer,
      req.file.originalname,
      operator
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/template', (req, res) => {
  const template = CsvImportService.getSampleTemplate();
  res.json({
    success: true,
    data: template
  });
});

module.exports = router;
