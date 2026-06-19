import express from 'express';
import multer from 'multer';
import * as storage from '../services/storageService';
import { detectConflicts, resolveConflict } from '../services/conflictService';
import { generateForecast } from '../services/exponentialSmoothing';
import { runSelfCheck } from '../services/selfCheckService';
import { parseParameterFile, parseCounterExampleFile, buildSampleParameterCsv, buildSampleCounterCsv } from '../services/fileParseService';
import type { ParameterTable, ParameterRecord, ImportResult, ExampleRecord, CounterExample, WorkflowState, ParameterUpdateRequest, ParsedParameterRow } from '../../shared/types';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const DEFAULT_WORKFLOW: WorkflowState = {
  id: 'wf-default',
  currentStep: 1,
  stepName: '参数调试表第一次导入',
  step1Completed: false,
  step2Completed: false,
  step3Completed: false,
  updatedAt: new Date().toISOString(),
  importBatchCount: 0,
  correctionCount: 0,
  recalculationCount: 0,
};

const getOrCreateWorkflow = async (): Promise<WorkflowState> => {
  const wf = await storage.getWorkflowState();
  if (wf) return wf;
  await storage.saveWorkflowState(DEFAULT_WORKFLOW);
  return DEFAULT_WORKFLOW;
};

router.get('/parameters', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const tables = await storage.getParameterTables();
    const records = await storage.getLatestParameterRecords();
    res.json({ success: true, data: { tables, records } });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/parameters/all', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const tables = await storage.getParameterTables();
    const records = await storage.getParameterRecords();
    res.json({ success: true, data: { tables, records } });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/parameters/sample.csv', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const format = (req.query.format as string) || 'csv';
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sample-parameters.csv"');
      res.send('\ufeff' + buildSampleParameterCsv());
      return;
    }
    const XLSX = await import('xlsx');
    const csvText = buildSampleParameterCsv();
    const rows = csvText.split('\n').map(line => line.split(','));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '参数调试表');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sample-parameters.xlsx"');
    res.send(buf);
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

// 保留旧的 JSON 接口（方便 E2E 脚本和测试，不再默认演示数据）
router.post('/parameters', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { table, records }: { table: ParameterTable; records: ParameterRecord[] } = req.body;
    const parsedRows: ParsedParameterRow[] = records.map(r => ({
      productId: r.productId,
      productName: r.productName,
      rawAlpha: r.rawAlpha || String(r.alpha),
      rawBeta: r.rawBeta || String(r.beta),
      rawGamma: r.rawGamma || String(r.gamma),
      forecastConclusion: r.forecastConclusion,
    }));

    const { table: savedTable, result } = await storage.upsertParsedRows(parsedRows, {
      importedBy: table.importedBy || '系统导入',
      fileName: table.fileName || table.id,
      strategy: table.strategy ?? 'overwrite',
      source: table.source ?? 'manual',
    });

    const wf = await getOrCreateWorkflow();
    wf.step1Completed = true;
    wf.currentStep = 1;
    wf.stepName = '参数调试表第一次导入';
    wf.importBatchCount = (wf.importBatchCount || 0) + 1;
    wf.updatedAt = new Date().toISOString();
    await storage.saveWorkflowState(wf);

    const importResult: ImportResult = storage.buildImportResult(true, '导入成功', savedTable, result);
    res.json({ success: true, data: importResult });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

// 真正的文件上传
router.post(
  '/parameters/upload',
  upload.single('file'),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      if (!req.file) {
        res.json({ success: false, error: '未上传文件' });
        return;
      }
      const strategy = (req.body.strategy as 'overwrite' | 'skip' | 'append') || 'overwrite';
      const importedBy = (req.body.importedBy as string) || '数据分析师小祁';

      const { rows, parseErrors } = await parseParameterFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (rows.length === 0) {
        res.json({
          success: false,
          error: '文件解析失败：未识别到有效行',
          details: { parseErrors },
        });
        return;
      }

      const { table, result } = await storage.upsertParsedRows(rows, {
        importedBy,
        fileName: req.file.originalname,
        strategy,
        source: 'upload',
      });

      const wf = await getOrCreateWorkflow();
      wf.step1Completed = true;
      wf.currentStep = 1;
      wf.stepName = '参数调试表第一次导入';
      wf.importBatchCount = (wf.importBatchCount || 0) + 1;
      wf.updatedAt = new Date().toISOString();
      await storage.saveWorkflowState(wf);

      const importResult: ImportResult = storage.buildImportResult(
        true,
        parseErrors.length > 0 ? `成功导入，但有 ${parseErrors.length} 条解析警告` : '导入成功',
        table,
        result
      );
      res.json({
        success: true,
        data: importResult,
        details: {
          parseErrors: parseErrors.slice(0, 20),
          totalRows: rows.length + parseErrors.length,
          validRows: rows.length,
        },
      });
    } catch (err) {
      const error = err as Error;
      res.json({ success: false, error: error.message });
    }
  }
);

// 参数补录/修正
router.post('/parameters/update', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const update = req.body as ParameterUpdateRequest;
    if (!update.productId) {
      res.json({ success: false, error: '缺少 productId' });
      return;
    }
    if (!update.reason) {
      res.json({ success: false, error: '必须填写补录/修正理由' });
      return;
    }
    if (!update.operator) update.operator = '数据分析师小祁';

    const updated = await storage.updateParameterRecord(update);
    if (!updated) {
      res.json({ success: false, error: `产品 ${update.productId} 不存在，无法补录` });
      return;
    }
    const wf = await getOrCreateWorkflow();
    wf.correctionCount = (wf.correctionCount || 0) + 1;
    wf.updatedAt = new Date().toISOString();
    await storage.saveWorkflowState(wf);
    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

// 反例 CSV/XLSX 上传
router.post(
  '/counter-examples/upload',
  upload.single('file'),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      if (!req.file) {
        res.json({ success: false, error: '未上传文件' });
        return;
      }
      const submittedBy = (req.body.submittedBy as string) || '数据分析师小祁';
      const { rows, parseErrors } = await parseCounterExampleFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      if (rows.length === 0) {
        res.json({ success: false, error: '反例文件没有有效数据', details: { parseErrors } });
        return;
      }
      const now = new Date().toISOString();
      const meta = await storage.getMetadata();
      const batch = `MANUAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(meta.totalImportCount + 1).padStart(3, '0')}`;

      const example: CounterExample = {
        id: `example-${Date.now().toString(36)}`,
        batch,
        submittedTime: now,
        submittedBy,
        source: 'upload',
        fileName: req.file.originalname,
      };
      const records: ExampleRecord[] = rows.map(r => ({
        id: `exrec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        exampleId: example.id,
        productId: r.productId,
        productName: r.productName,
        manualCalculation: r.manualCalculation,
        reasoning: r.reasoning,
        createdAt: now,
      }));
      await storage.saveCounterExample(example, records);
      const paramRecords = await storage.getLatestParameterRecords();
      const exampleRecords = await storage.getExampleRecords();
      const conflicts = detectConflicts(paramRecords, exampleRecords);
      await storage.saveConflicts(conflicts);

      const wf = await getOrCreateWorkflow();
      wf.currentStep = 2;
      wf.stepName = '数据分析师小祁补看手算反例';
      wf.updatedAt = new Date().toISOString();
      await storage.saveWorkflowState(wf);

      res.json({
        success: true,
        data: {
          example,
          conflicts,
          message: '反例保存成功，已检测到 ' + conflicts.length + ' 个冲突',
          importedCount: records.length,
          duplicateCount: 0,
          mixedFormatCount: 0,
          overwrittenCount: 0,
          skippedCount: 0,
          batchId: batch,
          tableId: example.id,
          duplicateProductIds: [],
          overwrittenProductIds: [],
          skippedProductIds: [],
          mixedProductIds: [],
          allProductIds: records.map(r => r.productId),
          parseErrors: parseErrors.slice(0, 20),
        },
      });
    } catch (err) {
      const error = err as Error;
      res.json({ success: false, error: error.message });
    }
  }
);

router.get('/counter-examples', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const examples = await storage.getCounterExamples();
    const records = await storage.getExampleRecords();
    res.json({ success: true, data: { examples, records } });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

// 保留旧的 JSON 反例接口
router.post('/counter-examples', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { example, records }: { example: CounterExample; records: ExampleRecord[] } = req.body;
    await storage.saveCounterExample(example, records);
    const paramRecords = await storage.getLatestParameterRecords();
    const exampleRecords = await storage.getExampleRecords();
    const conflicts = detectConflicts(paramRecords, exampleRecords);
    await storage.saveConflicts(conflicts);
    const wf = await getOrCreateWorkflow();
    wf.currentStep = 2;
    wf.stepName = '数据分析师小祁补看手算反例';
    wf.updatedAt = new Date().toISOString();
    await storage.saveWorkflowState(wf);
    res.json({
      success: true,
      data: {
        example,
        conflicts,
        message: '反例保存成功，已检测到 ' + conflicts.length + ' 个冲突',
        importedCount: records.length,
        duplicateCount: 0,
        mixedFormatCount: 0,
        overwrittenCount: 0,
        skippedCount: 0,
        batchId: example.batch,
        tableId: example.id,
        duplicateProductIds: [],
        overwrittenProductIds: [],
        skippedProductIds: [],
        mixedProductIds: [],
        allProductIds: records.map(r => r.productId),
      },
    });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/conflicts', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const conflicts = await storage.getConflicts();
    res.json({ success: true, data: conflicts });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.post('/conflicts/:id/resolve', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolution, reason, resolvedBy }: { resolution: 'accept_example' | 'reject_example'; reason: string; resolvedBy: string } = req.body;
    const conflicts = await storage.getConflicts();
    const conflict = conflicts.find(c => c.id === id);
    if (!conflict) {
      res.json({ success: false, error: '冲突不存在' });
      return;
    }
    const resolvedConflict = resolveConflict(conflict, resolution, reason, resolvedBy);
    const updatedConflict = await storage.updateConflict(id, resolvedConflict);
    res.json({ success: true, data: updatedConflict });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.post('/calculate', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const paramRecords = await storage.getLatestParameterRecords();
    const exampleRecords = await storage.getExampleRecords();
    const conflicts = await storage.getConflicts();
    const metadata = await storage.getMetadata();
    const tables = await storage.getParameterTables();
    const latestBatch = tables.length > 0 ? tables[tables.length - 1].importBatch : 'BATCH-UNKNOWN';

    const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');
    const recalcCount = (metadata.recalculationCount || 0) + 1;
    const results = paramRecords.map(paramRecord => {
      const exampleRecord = exampleRecords.find(e => e.productId === paramRecord.productId);
      const conflict = resolvedConflicts.find(c => c.productId === paramRecord.productId);
      return generateForecast(
        paramRecord,
        exampleRecord,
        conflict || undefined,
        tables.length > 0 ? tables[tables.length - 1].version : 'v1.0',
        { importBatch: latestBatch, recalculationCount: recalcCount }
      );
    });
    await storage.saveForecastResults(results);
    const wf = await getOrCreateWorkflow();
    wf.step2Completed = true;
    wf.step3Completed = true;
    wf.currentStep = 3;
    wf.stepName = '计算明细更新';
    wf.recalculationCount = recalcCount;
    wf.updatedAt = new Date().toISOString();
    await storage.saveWorkflowState(wf);
    res.json({ success: true, data: results, message: '计算完成' });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/results', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const results = await storage.getForecastResults();
    res.json({ success: true, data: results });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/self-check', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const paramRecords = await storage.getParameterRecords();
    const results = await storage.getForecastResults();
    const metadata = await storage.getMetadata();
    const logs = await storage.getAuditLogs();
    const selfCheckResult = runSelfCheck(paramRecords, results, metadata, logs);
    res.json({ success: true, data: selfCheckResult });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/workflow/status', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const state = await getOrCreateWorkflow();
    res.json({ success: true, data: state });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.post('/workflow/step', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { step, completed }: { step: number; completed: boolean } = req.body;
    const state = await getOrCreateWorkflow();
    if (step === 1) state.step1Completed = completed;
    else if (step === 2) state.step2Completed = completed;
    else if (step === 3) state.step3Completed = completed;
    state.currentStep = step;
    state.updatedAt = new Date().toISOString();
    await storage.saveWorkflowState(state);
    res.json({ success: true, data: state });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/audit-logs', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const logs = await storage.getAuditLogs();
    const limit = parseInt(req.query.limit as string, 10) || 200;
    const since = req.query.since as string | undefined;
    let filtered = logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (since) filtered = filtered.filter(l => l.timestamp >= since);
    res.json({ success: true, data: filtered.slice(0, limit), total: filtered.length });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/metadata', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const data = await storage.getMetadata();
    res.json({ success: true, data });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

export default router;
