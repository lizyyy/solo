const express = require('express');
const router = express.Router();
const transferService = require('../services/transferService');
const patientService = require('../services/patientService');
const bedService = require('../services/bedService');
const reportService = require('../services/reportService');
const exceptionService = require('../services/exceptionService');
const historyService = require('../services/historyService');

router.post('/patients', (req, res) => {
  try {
    const result = patientService.createPatient({
      name: req.body.name,
      idCard: req.body.idCard,
      gender: req.body.gender,
      age: req.body.age,
      phone: req.body.phone
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/patients', (req, res) => {
  try {
    const patients = patientService.getAllPatients();
    res.json({ success: true, data: patients });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/patients/:id', (req, res) => {
  try {
    const patient = patientService.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, error: '患者不存在' });
    }
    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/requests', (req, res) => {
  try {
    const result = transferService.createTransferRequest({
      idempotencyKey: req.headers['x-idempotency-key'],
      patientId: req.body.patientId,
      fromHospitalId: req.body.fromHospitalId,
      toHospitalId: req.body.toHospitalId,
      toDepartmentId: req.body.toDepartmentId,
      severityLevel: req.body.severityLevel,
      diagnosis: req.body.diagnosis,
      notes: req.body.notes,
      createdBy: req.headers['x-operator'] || 'api'
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/requests', (req, res) => {
  try {
    const requests = transferService.getAllRequests({
      status: req.query.status,
      patientId: req.query.patientId,
      departmentId: req.query.departmentId
    });
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/requests/:id', (req, res) => {
  try {
    const request = transferService.getRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: '转诊申请不存在' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/requests/:id/schedule', (req, res) => {
  try {
    const result = transferService.scheduleRequest(
      req.params.id,
      req.body.scheduledDate
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/requests/:id/confirm', (req, res) => {
  try {
    const result = transferService.confirmRequest(
      req.params.id,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/requests/:id/cancel', (req, res) => {
  try {
    const result = transferService.cancelRequest(
      req.params.id,
      req.body.reason,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/requests/:id/manual', (req, res) => {
  try {
    const result = transferService.manualUpdateRequest(
      req.params.id,
      req.body,
      req.headers['x-operator'] || 'admin'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/beds/status', (req, res) => {
  try {
    const status = bedService.getAllBedStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/departments/:departmentId/queue', (req, res) => {
  try {
    const queue = transferService.getWaitingQueue(
      req.params.departmentId,
      req.query.date
    );
    res.json({ success: true, data: queue });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/system/check-timeouts', (req, res) => {
  try {
    const result = transferService.checkTimeouts();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exceptions', (req, res) => {
  try {
    const exceptions = exceptionService.getExceptions({
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      resolved: req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined
    });
    res.json({ success: true, data: exceptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exceptions/:id/resolve', (req, res) => {
  try {
    const result = exceptionService.resolveException(
      req.params.id,
      req.headers['x-operator'] || 'admin'
    );
    if (!result) {
      return res.status(404).json({ success: false, error: '异常不存在' });
    }
    res.json({ success: true, message: '异常已解决' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/history', (req, res) => {
  try {
    const history = historyService.getAllHistory();
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/dashboard', (req, res) => {
  try {
    const report = reportService.getDashboardSummary();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/bed-occupancy', (req, res) => {
  try {
    const report = reportService.getBedOccupancyReport(
      req.query.hospitalId,
      req.query.departmentId,
      req.query.date
    );
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/waiting-queue', (req, res) => {
  try {
    const report = reportService.getWaitingQueueReport(
      req.query.hospitalId,
      req.query.departmentId,
      req.query.date
    );
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/full', (req, res) => {
  try {
    const report = reportService.getFullReport(
      req.query.hospitalId,
      req.query.departmentId,
      req.query.date
    );
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
