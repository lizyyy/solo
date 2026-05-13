const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const path = require('path');
const db = require('./database');
const correctionService = require('./services/correctionService');
const router = require('./routes');

const app = express();
const PORT = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use('/api', router);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
});

app.post('/api/import/bills', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const content = require('fs').readFileSync(req.file.path, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });

    const result = await correctionService.importBills(records);

    require('fs').unlinkSync(req.file.path);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills', async (req, res) => {
  try {
    const bills = await correctionService.getAllBillsWithDetails();
    res.json({ success: true, data: bills });
  } catch (error) {
    console.error('获取账单列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills/:billId', async (req, res) => {
  try {
    const bill = await correctionService.getBillWithAllDetails(req.params.billId);
    if (!bill) {
      return res.status(404).json({ error: '账单不存在' });
    }
    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('获取账单详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bills/:billId/versions', async (req, res) => {
  try {
    const versions = await correctionService.getBillVersions(req.params.billId);
    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('获取账单版本失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bills/:billId/anomalies', async (req, res) => {
  try {
    const { anomalyType, anomalyReason, detectedBy } = req.body;
    const result = await correctionService.markAnomaly(req.params.billId, anomalyType, anomalyReason, detectedBy);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('标记异常失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rules', async (req, res) => {
  try {
    const rules = await correctionService.getAllRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('获取规则失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/corrections/trial', async (req, res) => {
  try {
    const { billId, targetRuleId } = req.body;
    const result = await correctionService.trialCorrection(billId, targetRuleId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('订正试算失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/corrections', async (req, res) => {
  try {
    const { billId, targetRuleId, requestedBy, notes } = req.body;
    const result = await correctionService.createCorrectionRequest(billId, targetRuleId, requestedBy, notes);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('创建订正申请失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/corrections', async (req, res) => {
  try {
    const corrections = await correctionService.getAllCorrectionRequests();
    res.json({ success: true, data: corrections });
  } catch (error) {
    console.error('获取订正申请列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/corrections/:correctionId', async (req, res) => {
  try {
    const correction = await correctionService.getCorrectionRequestWithDetails(req.params.correctionId);
    if (!correction) {
      return res.status(404).json({ error: '订正申请不存在' });
    }
    res.json({ success: true, data: correction });
  } catch (error) {
    console.error('获取订正申请详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/corrections/:correctionId/approve', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    const result = await correctionService.approveCorrection(req.params.correctionId, approver, comment);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('审批失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/corrections/:correctionId/reject', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    const result = await correctionService.rejectCorrection(req.params.correctionId, approver, comment);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('驳回失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/corrections/:correctionId/publish', async (req, res) => {
  try {
    const { approver } = req.body;
    const result = await correctionService.publishCorrection(req.params.correctionId, approver);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('发布失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bills/:billId/rollback', async (req, res) => {
  try {
    const { targetVersionId, rolledBackBy, reason } = req.body;
    const result = await correctionService.rollbackVersion(req.params.billId, targetVersionId, rolledBackBy, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('回滚失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/:notificationId/send', async (req, res) => {
  try {
    const result = await correctionService.sendNotification(req.params.notificationId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('发送通知失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/overview', async (req, res) => {
  try {
    const overview = await correctionService.getOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    console.error('获取概览失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seed/samples', async (req, res) => {
  try {
    const result = await correctionService.createSampleData();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('创建样例数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`账单异常订正台服务运行在 http://localhost:${PORT}`);
});
