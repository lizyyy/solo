const fs = require('fs');

const importRoute = `const express = require('express');
const router = express.Router();
const fs = require('fs');
const upload = require('../middleware/upload');
const importService = require('../services/importService');

router.post('/samples', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { handler, batchId } = req.body;
    if (!handler) {
      return res.status(400).json({ success: false, error: 'Handler is required' });
    }
    if (!batchId) {
      return res.status(400).json({ success: false, error: 'batchId is required' });
    }

    const result = await importService.importSampleCSV(req.file.path, { 
      handler, 
      batchId: parseInt(batchId) 
    });

    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      message: 'Samples imported successfully',
      data: result
    });
  } catch (e) {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/test-items', async (req, res) => {
  try {
    const { handler } = req.query;
    const items = Array.isArray(req.body) ? req.body : req.body.data || [];
    
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'No test items provided' });
    }

    const result = await importService.importTestItems(items, { handler: handler || 'system' });

    res.json({
      success: true,
      message: 'Test items imported successfully',
      data: result
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/recheck-rules', async (req, res) => {
  try {
    const { handler } = req.query;
    const rules = Array.isArray(req.body) ? req.body : req.body.data || [];
    
    if (rules.length === 0) {
      return res.status(400).json({ success: false, error: 'No recheck rules provided' });
    }

    const result = await importService.importRecheckRules(rules, { handler: handler || 'system' });

    res.json({
      success: true,
      message: 'Recheck rules imported successfully',
      data: result
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
`;

const exportRoute = `const express = require('express');
const router = express.Router();
const exportService = require('../services/exportService');

router.get('/samples', async (req, res) => {
  try {
    const { sampleNo, status, recheckResult, batchId, format } = req.query;
    
    const result = await exportService.exportSamplesByQuery({
      sampleNo,
      status,
      recheckResult,
      batchId: batchId ? parseInt(batchId) : null
    });

    if (format === 'json' || !format) {
      res.json({
        success: true,
        count: result.count,
        data: result.data
      });
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=samples.csv');
      res.send(result.csv);
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/batch/:batchId', async (req, res) => {
  try {
    const { format } = req.query;
    const batchId = parseInt(req.params.batchId);
    
    const result = await exportService.exportBatchDetails(batchId);

    if (!result.batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    if (format === 'csv') {
      const { Parser } = require('json2csv');
      const fields = [
        { label: '批次编号', value: 'batch_no' },
        { label: '样品编号', value: 'sample_no' },
        { label: '样品名称', value: 'sample_name' },
        { label: '样品类型', value: 'sample_type' },
        { label: '数量', value: 'quantity' },
        { label: '单位', value: 'unit' },
        { label: '状态', value: 'status_desc' },
        { label: '复检次数', value: 'recheck_count' },
        { label: '创建时间', value: 'created_at' }
      ];
      const json2csvParser = new Parser({ fields });
      const csv = '\\uFEFF' + json2csvParser.parse(result.samples);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=batch-' + result.batch.batch_no + '.csv');
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: result
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { format } = req.query;
    const result = await exportService.exportLogs();

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=operation-logs.csv');
      res.send(result.csv);
    } else {
      res.json({
        success: true,
        count: result.count,
        data: result.data
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
`;

fs.writeFileSync('src/routes/import.js', importRoute);
fs.writeFileSync('src/routes/export.js', exportRoute);
console.log('Routes created successfully');
