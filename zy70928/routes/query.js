const express = require('express');
const router = express.Router();
const { auditMiddleware } = require('../middleware/audit');
const queryService = require('../services/queryService');

router.use(auditMiddleware('query'));

router.get('/packages', async (req, res) => {
  try {
    const result = await queryService.queryPackages(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/packages/:code', async (req, res) => {
  try {
    const pkg = await queryService.getPackageDetail(req.params.code);
    if (!pkg) {
      return res.status(404).json({ success: false, error: '套餐不存在' });
    }
    res.json({ success: true, data: pkg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/workorders', async (req, res) => {
  try {
    const result = await queryService.queryWorkOrders(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/workorders/:no', async (req, res) => {
  try {
    const order = await queryService.getWorkOrderDetail(req.params.no);
    if (!order) {
      return res.status(404).json({ success: false, error: '工单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/parts', async (req, res) => {
  try {
    const result = await queryService.queryParts(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/parts/:code', async (req, res) => {
  try {
    const part = await queryService.getPartDetail(req.params.code);
    if (!part) {
      return res.status(404).json({ success: false, error: '配件不存在' });
    }
    res.json({ success: true, data: part });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const result = await queryService.queryOperationLogs(req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/export/packages', async (req, res) => {
  try {
    const result = await queryService.exportPackages(req.query);
    
    await req.audit.log('EXPORT_PACKAGES', {
      operation_reason: `导出套餐数据 ${result.count} 条`,
      new_value: result
    });
    
    res.download(result.filepath, result.filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/export/workorders', async (req, res) => {
  try {
    const result = await queryService.exportWorkOrders(req.query);
    
    await req.audit.log('EXPORT_WORKORDERS', {
      operation_reason: `导出工单数据 ${result.count} 条`,
      new_value: result
    });
    
    res.download(result.filepath, result.filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/export/parts', async (req, res) => {
  try {
    const result = await queryService.exportParts(req.query);
    
    await req.audit.log('EXPORT_PARTS', {
      operation_reason: `导出配件数据 ${result.count} 条`,
      new_value: result
    });
    
    res.download(result.filepath, result.filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/export/logs', async (req, res) => {
  try {
    const result = await queryService.exportOperationLogs(req.query);
    
    await req.audit.log('EXPORT_LOGS', {
      operation_reason: `导出操作日志 ${result.count} 条`,
      new_value: result
    });
    
    res.download(result.filepath, result.filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
