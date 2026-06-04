import express from 'express';
import * as storage from '../services/storageService';
import { detectConflicts, resolveConflict } from '../services/conflictService';
import { generateForecast, parseNumericValue } from '../services/exponentialSmoothing';
import { runSelfCheck } from '../services/selfCheckService';
import type { ParameterTable, ParameterRecord, ImportResult, ExampleRecord, CounterExample } from '../../shared/types';

const router = express.Router();

router.get('/parameters', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const tables = await storage.getParameterTables();
    const records = await storage.getParameterRecords();
    res.json({ success: true, data: { tables, records } });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.post('/parameters', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { table, records }: { table: ParameterTable; records: ParameterRecord[] } = req.body;
    const productIds = records.map(r => r.productId);
    const duplicateCount = await storage.checkDuplicateImport(table.id, productIds);
    const mixedFormatCount = records.filter(r => r.hasMixedFormat).length;
    await storage.saveParameterTable(table, records);
    const workflowState = await storage.getWorkflowState();
    if (workflowState) {
      workflowState.step1Completed = true;
      workflowState.updatedAt = new Date().toISOString();
      await storage.saveWorkflowState(workflowState);
    }
    const result: ImportResult = {
      success: true,
      message: '导入成功',
      duplicateCount,
      mixedFormatCount,
      importedCount: records.length,
    };
    res.json({ success: true, data: result });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

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

router.post('/counter-examples', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { example, records }: { example: CounterExample; records: ExampleRecord[] } = req.body;
    await storage.saveCounterExample(example, records);
    const paramRecords = await storage.getParameterRecords();
    const exampleRecords = await storage.getExampleRecords();
    const conflicts = detectConflicts(paramRecords, exampleRecords);
    await storage.saveConflicts(conflicts);
    const workflowState = await storage.getWorkflowState();
    if (workflowState) {
      workflowState.currentStep = 2;
      workflowState.updatedAt = new Date().toISOString();
      await storage.saveWorkflowState(workflowState);
    }
    res.json({ success: true, data: { conflicts, message: '反例保存成功，已检测到 ' + conflicts.length + ' 个冲突' } });
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
    const paramRecords = await storage.getParameterRecords();
    const exampleRecords = await storage.getExampleRecords();
    const conflicts = await storage.getConflicts();
    const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');
    const results = paramRecords.map(paramRecord => {
      const exampleRecord = exampleRecords.find(e => e.productId === paramRecord.productId);
      const conflict = resolvedConflicts.find(c => c.productId === paramRecord.productId);
      return generateForecast(paramRecord, exampleRecord, conflict?.resolution || undefined);
    });
    await storage.saveForecastResults(results);
    const workflowState = await storage.getWorkflowState();
    if (workflowState) {
      workflowState.step2Completed = true;
      workflowState.step3Completed = true;
      workflowState.currentStep = 3;
      workflowState.updatedAt = new Date().toISOString();
      await storage.saveWorkflowState(workflowState);
    }
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
    const selfCheckResult = runSelfCheck(paramRecords, results);
    res.json({ success: true, data: selfCheckResult });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.get('/workflow/status', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const workflowState = await storage.getWorkflowState();
    res.json({ success: true, data: workflowState });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

router.post('/workflow/step', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { step, completed }: { step: number; completed: boolean } = req.body;
    const workflowState = await storage.getWorkflowState();
    if (!workflowState) {
      res.json({ success: false, error: '工作流状态不存在' });
      return;
    }
    if (step === 1) {
      workflowState.step1Completed = completed;
    } else if (step === 2) {
      workflowState.step2Completed = completed;
    } else if (step === 3) {
      workflowState.step3Completed = completed;
    }
    workflowState.currentStep = step;
    workflowState.updatedAt = new Date().toISOString();
    await storage.saveWorkflowState(workflowState);
    res.json({ success: true, data: workflowState });
  } catch (err) {
    const error = err as Error;
    res.json({ success: false, error: error.message });
  }
});

export default router;
