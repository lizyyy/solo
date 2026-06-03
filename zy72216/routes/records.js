const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const csv = require('csv-parser');

const reconciliationService = require('../services/reconciliation-service');
const unifiedDataService = require('../services/unified-data-service');
const { STATUS } = require('../utils/constants');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${file.fieldname}${ext}`);
  }
});

const upload = multer({ storage: storage });

router.post('/import', upload.single('custodian_file'), (req, res) => {
  try {
    const operator = req.body.operator || 'system';
    let records = [];

    if (req.body.records && Array.isArray(req.body.records)) {
      records = req.body.records;
    } else if (req.file) {
      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();

      if (ext === '.csv') {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            processImport(results, operator, res);
          })
          .on('error', (err) => {
            res.status(400).json({ error: 'CSV解析失败: ' + err.message });
          });
        return;
      } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        records = xlsx.utils.sheet_to_json(sheet);
      } else {
        return res.status(400).json({ error: '不支持的文件格式，请上传CSV或Excel文件' });
      }
    } else {
      return res.status(400).json({ error: '请提供记录数据或上传文件' });
    }

    processImport(records, operator, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function processImport(records, operator, res) {
  if (records.length === 0) {
    return res.status(400).json({ error: '没有可导入的记录' });
  }

  const normalizedRecords = records.map((r, idx) => ({
    original_line_number: r.original_line_number || r['原始行号'] || r.line_number || (idx + 1),
    fund_code: r.fund_code || r['基金代码'] || '',
    fund_name: r.fund_name || r['基金名称'] || '',
    security_code: r.security_code || r['证券代码'] || '',
    security_name: r.security_name || r['证券名称'] || '',
    settlement_date: r.settlement_date || r['到账日'] || r['结算日'] || '',
    quantity: r.quantity || r['数量'] || r.shares || 0,
    amount: r.amount || r['金额'] || 0
  }));

  reconciliationService.importCustodianRecords(normalizedRecords, operator, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      success: true,
      message: `成功导入 ${result.count} 条记录`,
      data: result
    });
  });
}

router.post('/:id/manual-change', (req, res) => {
  const { id } = req.params;
  const { field_name, old_value, new_value, change_reason, operator, evidence_screenshot } = req.body;

  reconciliationService.recordManualChange(
    parseInt(id), field_name, old_value, new_value, change_reason, operator, evidence_screenshot,
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        success: true,
        message: '人工改动已记录',
        data: result
      });
    }
  );
});

router.post('/:id/screenshot', upload.single('screenshot'), (req, res) => {
  const { id } = req.params;
  const { operator, remark } = req.body;
  let screenshotPath = req.body.screenshot_path;

  if (req.file) {
    screenshotPath = `/uploads/${req.file.filename}`;
  }

  if (!screenshotPath) {
    return res.status(400).json({ error: '请上传截图或提供截图路径' });
  }

  reconciliationService.uploadExRightScreenshot(
    parseInt(id), screenshotPath, operator || 'system', remark,
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        success: true,
        message: '除权日截图已上传',
        data: result
      });
    }
  );
});

router.post('/:id/note', (req, res) => {
  const { id } = req.params;
  const { note_content, operator } = req.body;

  if (!note_content) {
    return res.status(400).json({ error: '对账说明内容不能为空' });
  }

  reconciliationService.updateReconciliationNote(
    parseInt(id), note_content, operator || 'system',
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        success: true,
        message: '对账说明已更新',
        data: result
      });
    }
  );
});

router.post('/:id/manager-review', (req, res) => {
  const { id } = req.params;
  const { approved, review_comment, operator } = req.body;

  if (approved === undefined) {
    return res.status(400).json({ error: '请指定复核结果(approved)' });
  }

  reconciliationService.managerReview(
    parseInt(id), !!approved, review_comment, operator || 'fund_manager',
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        success: true,
        message: approved ? '复核通过' : '复核驳回',
        data: result
      });
    }
  );
});

router.post('/:id/finalize', (req, res) => {
  const { id } = req.params;
  const { operator } = req.body;

  reconciliationService.finalizeRecord(
    parseInt(id), operator || 'system',
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        success: true,
        message: '记录已标记为正常',
        data: result
      });
    }
  );
});

router.post('/:id/revert', (req, res) => {
  const { id } = req.params;
  const { operator, reason } = req.body;

  reconciliationService.revertRecord(
    parseInt(id), operator || 'system', reason,
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        success: true,
        message: '记录已回滚',
        data: result
      });
    }
  );
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  unifiedDataService.getFullRecordById(parseInt(id), (err, record) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json({ success: true, data: record });
  });
});

router.get('/', (req, res) => {
  const { batch_id, status } = req.query;

  if (batch_id) {
    unifiedDataService.getRecordsByBatchWithDetails(batch_id, (err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, data: records });
    });
  } else {
    unifiedDataService.getAllRecordsWithDetails((err, records) => {
      if (err) return res.status(500).json({ error: err.message });
      if (status) {
        records = records.filter(r => r.status === status);
      }
      res.json({ success: true, data: records });
    });
  }
});

module.exports = router;
