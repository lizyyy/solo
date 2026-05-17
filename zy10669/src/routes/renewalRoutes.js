const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const renewalService = require('../services/renewalService');
const importExportService = require('../services/importExportService');

router.post('/', (req, res) => {
  renewalService.createRenewalRecord(req.body, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json(result);
  });
});

router.get('/', (req, res) => {
  const params = {
    page: parseInt(req.query.page) || 1,
    pageSize: parseInt(req.query.pageSize) || 20,
    memberId: req.query.memberId,
    status: req.query.status
  };
  
  renewalService.getRenewalList(params, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: result });
  });
});

router.get('/:id', (req, res) => {
  renewalService.getRenewalDetail(req.params.id, (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!data) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({ success: true, data });
  });
});

router.get('/:id/history', (req, res) => {
  renewalService.getRenewalHistory(req.params.id, (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data });
  });
});

router.put('/:id/approve', (req, res) => {
  const { sourceSystem, operator } = req.body;
  renewalService.approveRenewal(req.params.id, sourceSystem, operator, (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: '审核通过' });
  });
});

router.put('/:id/suspend', (req, res) => {
  const { sourceSystem, operator, reason } = req.body;
  renewalService.suspendRenewal(req.params.id, sourceSystem, operator, reason, (err) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: '已暂停' });
  });
});

router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请上传文件' });
  }
  
  const { sourceSystem = 'import', operator = 'system' } = req.body;
  
  importExportService.importFromCsv(req.file.path, sourceSystem, operator, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: result });
  });
});

router.get('/export/csv', (req, res) => {
  const params = {
    status: req.query.status,
    memberId: req.query.memberId
  };
  
  importExportService.exportToCsv(params, (err, csv) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="renewal_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  });
});

router.get('/bad-records', (req, res) => {
  importExportService.getBadRecords(req.query.batchNo, (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data });
  });
});

module.exports = router;