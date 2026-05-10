const express = require('express');
const router = express.Router();
const ApplicationService = require('../services/applicationService');
const ExportService = require('../services/exportService');
const XLSX = require('xlsx');

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      keyword: req.query.keyword
    };
    const applications = ApplicationService.getAllApplications(filters);
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const details = ApplicationService.getApplicationDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: '申请不存在' });
    }
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const id = ApplicationService.createApplication(req.body);
    res.status(201).json({ id, message: '创建成功' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    ApplicationService.updateApplication(req.params.id, req.body);
    res.json({ message: '更新成功' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/inspections', (req, res) => {
  try {
    const id = ApplicationService.addInspection({
      ...req.body,
      application_id: parseInt(req.params.id)
    });
    res.status(201).json({ id, message: '巡检记录添加成功' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/inspections/:inspectionId/problems', (req, res) => {
  try {
    const id = ApplicationService.addInspectionProblem({
      ...req.body,
      inspection_id: parseInt(req.params.inspectionId)
    });
    res.status(201).json({ id, message: '问题记录添加成功' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/problems/:problemId/rectify', (req, res) => {
  try {
    ApplicationService.rectifyProblem(req.params.problemId, req.body);
    res.json({ message: '整改完成' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/fees', (req, res) => {
  try {
    const id = ApplicationService.addPropertyFee({
      ...req.body,
      application_id: parseInt(req.params.id)
    });
    res.status(201).json({ id, message: '欠费记录添加成功' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/fees/:feeId/pay', (req, res) => {
  try {
    ApplicationService.payPropertyFee(req.params.feeId, req.body);
    res.json({ message: '欠费已结清' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/refund-check', (req, res) => {
  try {
    const result = ApplicationService.canRefund(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/calculate-refund', (req, res) => {
  try {
    const result = ApplicationService.calculateRefund(
      req.params.id,
      req.body.deduction_items || [],
      req.body.offset_fees || false
    );
    if (!result) {
      return res.status(404).json({ error: '申请不存在' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/refunds', (req, res) => {
  try {
    const result = ApplicationService.createRefund({
      ...req.body,
      application_id: parseInt(req.params.id)
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/refunds/:id', (req, res) => {
  try {
    const details = ApplicationService.getRefundDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: '退款记录不存在' });
    }
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/excel', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      keyword: req.query.keyword,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const wb = ExportService.exportToExcel(filters);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    const filename = `装修押金退款明细_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/data', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      keyword: req.query.keyword
    };
    const data = ExportService.getExportData(filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
