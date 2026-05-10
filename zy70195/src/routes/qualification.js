const express = require('express');
const router = express.Router();
const qualificationService = require('../services/qualification-service');

router.post('/suppliers', async (req, res) => {
  try {
    const supplier = await qualificationService.createSupplier(req.body.name);
    res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await qualificationService.getAllSuppliers();
    res.json({ success: true, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/suppliers/:id', async (req, res) => {
  try {
    const supplier = await qualificationService.getSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: '供应商不存在' });
    }
    res.json({ success: true, data: supplier });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/suppliers/:id/status', async (req, res) => {
  try {
    const status = await qualificationService.checkSupplierStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/suppliers/:id/logs', async (req, res) => {
  try {
    const logs = await qualificationService.getFreezeLogs(req.params.id);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const qual = await qualificationService.createQualification(req.body);
    res.status(201).json({ success: true, data: qual });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const quals = await qualificationService.getAllQualifications();
    res.json({ success: true, data: quals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const qual = await qualificationService.getQualificationById(req.params.id);
    if (!qual) {
      return res.status(404).json({ success: false, error: '资质不存在' });
    }
    res.json({ success: true, data: qual });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/supplier/:supplierId', async (req, res) => {
  try {
    const quals = await qualificationService.getQualificationsBySupplier(req.params.supplierId);
    res.json({ success: true, data: quals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/update-expiry', async (req, res) => {
  try {
    const qual = await qualificationService.updateQualificationStatus(
      req.params.id, 
      req.body.new_expiry_date
    );
    res.json({ success: true, data: qual });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/detect-expiry', async (req, res) => {
  try {
    const result = await qualificationService.detectExpiryQualifications();
    res.json({ 
      success: true, 
      data: result,
      message: `检测完成: ${result.expired.length} 个已过期, ${result.warning.length} 个即将到期, ${result.needs_supplement.length} 个需补证`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/supplier/:id/freeze', async (req, res) => {
  try {
    const supplier = await qualificationService.freezeSupplier(
      req.params.id, 
      req.body.reason || '手动冻结',
      req.body.qualification_id
    );
    if (!supplier) {
      return res.status(404).json({ success: false, error: '供应商不存在' });
    }
    res.json({ success: true, data: supplier });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/supplier/:id/unfreeze', async (req, res) => {
  try {
    const supplier = await qualificationService.unfreezeSupplier(
      req.params.id, 
      req.body.reason || '手动解冻'
    );
    res.json({ success: true, data: supplier });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
