const express = require('express');
const router = express.Router();
const ExtensionService = require('../services/extension.service');
const TenantDAO = require('../dao/tenant.dao');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

router.post('/', async (req, res) => {
  try {
    const result = await ExtensionService.createExtension(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.code === 'DUPLICATE_PENDING_REQUEST') {
      res.status(409).json({
        success: false,
        error: error.message,
        code: error.code,
        next_steps: error.nextSteps
      });
    } else {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      tenant_id: req.query.tenant_id,
      salesperson_id: req.query.salesperson_id
    };
    const list = await ExtensionService.getExtensionList(filters);
    res.json({ success: true, data: list, total: list.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await ExtensionService.getExtensionDetail(req.params.id);
    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { approver_id, approver_name, comment } = req.body;
    const result = await ExtensionService.approveExtension(
      req.params.id,
      approver_id,
      approver_name,
      comment
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { approver_id, approver_name, comment } = req.body;
    const result = await ExtensionService.rejectExtension(
      req.params.id,
      approver_id,
      approver_name,
      comment
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/convert', async (req, res) => {
  try {
    const { operator_id, operator_name, comment } = req.body;
    const result = await ExtensionService.convertToPaid(
      req.params.id,
      operator_id,
      operator_name,
      comment
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const detail = await ExtensionService.getExtensionDetail(req.params.id);
    res.json({ success: true, data: detail.history });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      tenant_id: req.query.tenant_id
    };
    const data = await ExtensionService.exportToCSV(filters);
    
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filename = `extensions_${Date.now()}.csv`;
    const filepath = path.join(exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: '申请编号', title: '申请编号' },
        { id: '租户ID', title: '租户ID' },
        { id: '租户名称', title: '租户名称' },
        { id: '原试用截止', title: '原试用截止' },
        { id: '申请延期天数', title: '申请延期天数' },
        { id: '新试用截止', title: '新试用截止' },
        { id: '延期理由', title: '延期理由' },
        { id: '销售备注', title: '销售备注' },
        { id: '申请人', title: '申请人' },
        { id: '状态', title: '状态' },
        { id: '审批人', title: '审批人' },
        { id: '审批意见', title: '审批意见' },
        { id: '创建时间', title: '创建时间' }
      ]
    });

    await csvWriter.writeRecords(data);
    
    res.download(filepath, filename, (err) => {
      if (err) {
        res.status(500).json({ success: false, error: '导出失败' });
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { batch_no, rows } = req.body;
    const batchNo = batch_no || `BATCH${Date.now()}`;
    const results = await ExtensionService.importBatch(batchNo, rows);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      data: {
        batch_no: batchNo,
        total: rows.length,
        success: successCount,
        failed: failCount,
        results: results
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/import/:batch_no', async (req, res) => {
  try {
    const ExtensionDAO = require('../dao/extension.dao');
    const records = await ExtensionDAO.getImportRecords(req.params.batch_no);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tenants', async (req, res) => {
  try {
    const result = await TenantDAO.create(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tenants', async (req, res) => {
  try {
    const list = await TenantDAO.findAll();
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
