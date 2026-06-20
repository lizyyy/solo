import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const STORAGE_KEY = 'after-sales-robot-storage';
const DATA_DIR = path.resolve(process.cwd(), 'local-data');
const DATA_FILE = path.join(DATA_DIR, `${STORAGE_KEY}.json`);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStoreData(): { records: any[]; currentOperator: string; initialized: boolean } {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return { records: [], currentOperator: '阿宁', initialized: false };
}

function writeStoreData(data: any) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/records', (req, res) => {
  const store = readStoreData();
  res.json({
    success: true,
    data: store.records,
    total: store.records.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/records/:id', (req, res) => {
  const store = readStoreData();
  const record = store.records.find((r: any) => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({
    success: true,
    data: record,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/records/:id/snapshot', (req, res) => {
  const store = readStoreData();
  const record = store.records.find((r: any) => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({
    success: true,
    data: {
      current: {
        annotatorMessage: record.annotatorMessage,
        referenceUrl: record.referenceUrl,
        urlStatus: record.urlStatus,
        robotJudgment: record.robotJudgment,
        modelOutputSnippet: record.modelOutput?.outputSnippet || null,
        modelOutputName: record.modelOutput?.modelName || null,
        modelOutputConfidence: record.modelOutput?.confidence ?? null,
        currentStatus: record.currentStatus,
        abnormalType: record.abnormalType,
        modelOutputMissing: record.modelOutputMissing,
        lastOperator: record.lastOperator || null,
        updatedAt: record.updatedAt
      },
      original: record.originalSnapshot,
      history: (record.judgmentLogs || []).map((log: any) => ({
        action: log.action,
        operator: log.operator,
        operatedAt: log.operatedAt,
        remark: log.remark,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        diffSummary: log.diffSummary || [],
        fromSnapshot: log.fromSnapshot || null,
        toSnapshot: log.toSnapshot || null
      }))
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/sync', (req, res) => {
  const { records, currentOperator, initialized } = req.body;
  if (!Array.isArray(records)) {
    return res.status(400).json({ success: false, error: 'records 必须是数组' });
  }
  writeStoreData({ records, currentOperator: currentOperator || '阿宁', initialized: initialized !== false });
  res.json({
    success: true,
    synced: records.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/report', (req, res) => {
  const store = readStoreData();
  const records = store.records;
  const byStatus: Record<string, number> = {};
  const byAbnormalType: Record<string, number> = {};

  records.forEach((r: any) => {
    byStatus[r.currentStatus] = (byStatus[r.currentStatus] || 0) + 1;
    byAbnormalType[r.abnormalType] = (byAbnormalType[r.abnormalType] || 0) + 1;
  });

  const modelOutputMissingRecords = records.filter((r: any) => r.modelOutputMissing);

  res.json({
    success: true,
    data: {
      totalRecords: records.length,
      byStatus,
      byAbnormalType,
      modelOutputMissingCount: modelOutputMissingRecords.length,
      url404Count: records.filter((r: any) => r.abnormalType === 'url_404_passed').length,
      avgOperations: records.length > 0
        ? (records.reduce((sum: number, r: any) => sum + (r.judgmentLogs?.length || 0), 0) / records.length).toFixed(2)
        : '0',
      modelOutputMissingRecords: modelOutputMissingRecords.map((r: any) => ({
        id: r.id,
        lineNumber: r.originalLineNumber,
        annotatorMessage: r.annotatorMessage,
        referenceUrl: r.referenceUrl,
        urlStatus: r.urlStatus,
        robotJudgment: r.robotJudgment,
        currentStatus: r.currentStatus,
        hasBeenBackfilled: !r.modelOutputMissing,
        backfilledBy: r.modelOutput?.filledBy || null,
        backfilledAt: r.modelOutput?.filledAt || null
      }))
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[API Server] 售后机器人转人工判断 API 服务运行在 http://localhost:${PORT}`);
  console.log(`[API Server] GET /api/records - 获取全部记录`);
  console.log(`[API Server] GET /api/records/:id - 获取单条记录`);
  console.log(`[API Server] GET /api/records/:id/snapshot - 获取记录快照与改前改后历史`);
  console.log(`[API Server] POST /api/sync - 同步前端数据到服务端`);
  console.log(`[API Server] GET /api/report - 获取复盘报告数据`);
});
