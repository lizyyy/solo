const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const appointmentService = require('../services/appointmentService');
const exportService = require('../services/exportService');
const storage = require('../utils/storage');

const router = express.Router();
const upload = multer({ dest: 'tmp/' });

const FILE_VEHICLES = 'vehicles';
const FILE_SALESPERSONS = 'salespersons';

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/vehicles', (req, res) => {
  const vehicles = storage.readData(FILE_VEHICLES);
  res.json({ data: vehicles });
});

router.get('/salespersons', (req, res) => {
  const salespersons = storage.readData(FILE_SALESPERSONS);
  res.json({ data: salespersons });
});

router.post('/appointments', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = appointmentService.createAppointment(req.body, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/appointments', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.customerName) filters.customerName = req.query.customerName;
    if (req.query.vehicleId) filters.vehicleId = req.query.vehicleId;
    if (req.query.salespersonId) filters.salespersonId = req.query.salespersonId;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    
    const appointments = appointmentService.listAppointments(filters);
    res.json({ data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/appointments/:id', (req, res) => {
  try {
    const appointment = appointmentService.getAppointment(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, reason: '预约不存在' });
    }
    res.json({ data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/appointments/:id/advance', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const { action, operationId } = req.body;
    
    const result = appointmentService.advanceAppointment(
      req.params.id,
      action,
      operator,
      operationId
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/appointments/:id/correct', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const { updates, reason } = req.body;
    
    const result = appointmentService.correctAppointment(
      req.params.id,
      updates,
      operator,
      reason
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/appointments/:id/accident', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    
    const result = appointmentService.registerAccident(
      req.params.id,
      req.body,
      operator
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/accidents/:id/process', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const { decision, notes } = req.body;
    
    const result = appointmentService.processAccident(
      req.params.id,
      decision,
      notes,
      operator
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/accidents', (req, res) => {
  try {
    const accidents = storage.readData('accidents');
    res.json({ data: accidents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/appointments/batch-import', upload.single('file'), async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    
    let records = [];
    
    if (req.file) {
      const fs = require('fs');
      const content = fs.readFileSync(req.file.path, 'utf-8');
      
      if (req.file.originalname.endsWith('.json')) {
        records = JSON.parse(content);
      } else if (req.file.originalname.endsWith('.csv')) {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        records = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index]?.trim() || '';
          });
          return obj;
        });
      }
      
      fs.unlinkSync(req.file.path);
    } else if (req.body.records) {
      records = req.body.records;
    }
    
    if (!Array.isArray(records)) {
      return res.status(400).json({ 
        success: false, 
        reason: '数据格式错误，需要数组' 
      });
    }
    
    const results = {
      success: 0,
      failed: 0,
      items: []
    };
    
    for (const record of records) {
      const result = appointmentService.createAppointment(record, operator);
      results.items.push({
        record,
        result
      });
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
      }
    }
    
    res.json({ success: true, importResult: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/report', async (req, res) => {
  try {
    const filters = {};
    if (req.query.salespersonId) filters.salespersonId = req.query.salespersonId;
    if (req.query.processStartTime) filters.processStartTime = req.query.processStartTime;
    if (req.query.processEndTime) filters.processEndTime = req.query.processEndTime;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.hasAccident) filters.hasAccident = req.query.hasAccident === 'true';
    
    const fileName = `appointment_report_${Date.now()}.xlsx`;
    const outputPath = path.join(storage.DATA_DIR, fileName);
    
    const result = await exportService.exportAppointmentReport(filters, outputPath);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.download(outputPath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/appointment/:id', async (req, res) => {
  try {
    const fileName = `appointment_${req.params.id}_${Date.now()}.xlsx`;
    const outputPath = path.join(storage.DATA_DIR, fileName);
    
    const result = await exportService.exportSingleAppointmentReport(
      req.params.id, 
      outputPath
    );
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.download(outputPath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
