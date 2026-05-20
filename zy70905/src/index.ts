import express from 'express';
import multer from 'multer';
import PointsDatabase from './database';
import { DataParser } from './services/dataParser';
import { RulesEngine } from './services/rulesEngine';

const app = express();
const port = process.env.PORT || 3001;
const storage = multer.memoryStorage();
const upload = multer({ storage });

const db = new PointsDatabase();
const parser = new DataParser();
const rulesEngine = new RulesEngine(db);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/upload/receipts', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const receipts = await parser.parseReceiptsCSV(req.file.buffer);
    const { valid, invalid } = parser.validateReceipts(receipts);

    if (valid.length === 0) {
      return res.status(400).json({ error: '没有有效的小票数据', invalid });
    }

    const result = await rulesEngine.processBatch(valid);

    if (result.isDuplicate) {
      return res.status(200).json({
        success: false,
        message: '该批次数据已处理过，请勿重复提交',
        isDuplicate: true
      });
    }

    res.json({
      success: true,
      batchId: result.batchId,
      totalProcessed: valid.length,
      invalidCount: invalid.length,
      invalidItems: invalid,
      report: result.report
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/members', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }

    const members = parser.parseMembersJSON(req.file.buffer);
    members.forEach(m => db.saveMember(m));

    res.json({
      success: true,
      count: members.length,
      message: `成功导入 ${members.length} 个会员`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/rules', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }

    const rules = parser.parseActivityRulesJSON(req.file.buffer);
    rules.forEach(r => db.saveActivityRule(r));

    res.json({
      success: true,
      count: rules.length,
      message: `成功导入 ${rules.length} 条活动规则`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process', express.json(), async (req, res) => {
  try {
    const { receipts, members, rules } = req.body;

    if (members && Array.isArray(members)) {
      members.forEach((m: any) => db.saveMember(m));
    }

    if (rules && Array.isArray(rules)) {
      rules.forEach((r: any) => db.saveActivityRule(r));
    }

    if (!receipts || !Array.isArray(receipts)) {
      return res.status(400).json({ error: '请提供小票数据' });
    }

    const { valid, invalid } = parser.validateReceipts(receipts);

    if (valid.length === 0) {
      return res.status(400).json({ error: '没有有效的小票数据', invalid });
    }

    const result = await rulesEngine.processBatch(valid);

    if (result.isDuplicate) {
      return res.status(200).json({
        success: false,
        message: '该批次数据已处理过，请勿重复提交',
        isDuplicate: true
      });
    }

    res.json({
      success: true,
      batchId: result.batchId,
      totalProcessed: valid.length,
      invalidCount: invalid.length,
      invalidItems: invalid,
      report: result.report
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batch/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = db.getBatch(batchId);
    
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const records = db.getRecordsByBatch(batchId);
    const success = records.filter((r: any) => r.status === 'success');
    const pending = records.filter((r: any) => r.status === 'pending');
    const failed = records.filter((r: any) => r.status === 'failed');

    res.json({
      success: true,
      batch: {
        id: batch.id,
        totalCount: batch.totalCount,
        successCount: batch.successCount,
        pendingCount: batch.pendingCount,
        failedCount: batch.failedCount,
        totalPoints: batch.totalPoints,
        createdAt: batch.createdAt
      },
      items: { success, pending, failed }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trace/:traceId', (req, res) => {
  try {
    const { traceId } = req.params;
    const record = db.getRecordByTraceId(traceId);
    
    if (!record) {
      return res.status(404).json({ error: '追溯记录不存在' });
    }

    res.json({
      success: true,
      data: {
        traceId: record.traceId,
        receiptNo: record.receiptNo,
        memberPhone: record.memberPhone,
        originalData: record.rawData,
        calculatedPoints: record.calculatedPoints,
        status: record.status,
        appliedRules: record.appliedRules,
        errorCode: record.errorCode,
        errorMessage: record.errorMessage,
        suggestion: record.suggestion,
        batchId: record.batchId,
        createdAt: record.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/member/:phone', (req, res) => {
  try {
    const { phone } = req.params;
    const member = db.getMember(phone);
    
    if (!member) {
      return res.status(404).json({ error: '会员不存在' });
    }

    const records = db.getRecordsByMember(phone);

    res.json({
      success: true,
      member: {
        phone: member.phone,
        name: member.name,
        level: member.level,
        totalPoints: member.totalPoints,
        availablePoints: member.availablePoints,
        joinDate: member.joinDate
      },
      transactions: records
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/receipt/:receiptNo', (req, res) => {
  try {
    const { receiptNo } = req.params;
    const history = db.getReceiptHistory(receiptNo);

    if (history.length === 0) {
      return res.status(404).json({ error: '小票不存在' });
    }

    res.json({
      success: true,
      receiptNo,
      history
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rules', (req, res) => {
  try {
    const rules = db.getActivityRules();
    res.json({ success: true, rules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/members', (req, res) => {
  try {
    const members = db.getAllMembers();
    res.json({ success: true, members });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`积分计算API服务已启动: http://localhost:${port}`);
  console.log('');
  console.log('API 接口说明:');
  console.log('  POST /api/upload/receipts  - 上传小票CSV');
  console.log('  POST /api/upload/members   - 上传会员JSON');
  console.log('  POST /api/upload/rules     - 上传活动规则JSON');
  console.log('  POST /api/process          - 直接处理JSON数据');
  console.log('  GET  /api/batch/:id        - 查询批次报告');
  console.log('  GET  /api/trace/:traceId   - 单条明细追溯');
  console.log('  GET  /api/member/:phone    - 会员积分记录');
  console.log('  GET  /api/receipt/:no      - 小票处理历史');
  console.log('  GET  /health               - 健康检查');
});

export default app;
