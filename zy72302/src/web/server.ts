import express from 'express';
import * as path from 'path';
import { BoundarySampleManager } from '../core/boundarySampleManager';
import { WindowConfig } from '../types';
import { StateStore } from '../core/stateStore';

export function startWebServer(
  port: number,
  boundaryManager: BoundarySampleManager,
  windowConfigs: WindowConfig[],
  stateStore?: StateStore
) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const ensureLoaded = () => {
    if (stateStore) stateStore.load(true);
  };

  const persist = () => {
    if (stateStore) {
      boundaryManager.getAllBoundarySamples().forEach((s) => stateStore.upsertBoundarySample(s));
      stateStore.save();
    }
  };

  app.get('/api/samples', (_req, res) => {
    ensureLoaded();
    const samples = boundaryManager.getAllBoundarySamples();
    const stats = boundaryManager.generateReport().statistics;
    const history = stateStore ? stateStore.getHistory() : [];
    res.json({ success: true, data: samples, statistics: stats, history });
  });

  app.get('/api/samples/:sampleId', (req, res) => {
    ensureLoaded();
    const sample = boundaryManager.findBySampleId(req.params.sampleId);
    const history = stateStore ? stateStore.getHistory(req.params.sampleId) : [];
    if (sample) {
      res.json({ success: true, data: sample, history });
    } else {
      res.status(404).json({ success: false, error: '样本不存在', statistics: boundaryManager.generateReport().statistics });
    }
  });

  app.post('/api/samples/:sampleId/ta-review', (req, res) => {
    ensureLoaded();
    const { verified, notes, questionnaire } = req.body;
    const result = boundaryManager.taReviewV2(req.params.sampleId, !!verified, notes || '', questionnaire);
    if (result.success) {
      if (stateStore && questionnaire) stateStore.addQuestionnaireRows([questionnaire]);
      persist();
      if (stateStore) stateStore.addHistoryEntry({
        sampleId: req.params.sampleId, action: 'ta_review', operator: '学生助教(Web)',
        statusBefore: result.sample!.reviewLog[result.sample!.reviewLog.length - 1]?.statusBefore,
        statusAfter: result.sample!.status, notes: notes || '',
        reason: verified ? '学生助教确认通过' : '学生助教驳回',
        rawStatementAdded: !!questionnaire,
      });
      persist();
      res.json({ success: true, data: result.sample });
    } else {
      res.status(400).json({
        success: false, error: result.errorMessage,
        errorKind: result.errorKind, hints: result.hints,
        statistics: boundaryManager.generateReport().statistics,
      });
    }
  });

  app.post('/api/samples/:sampleId/coach-review', (req, res) => {
    ensureLoaded();
    const { verified, notes } = req.body;
    const result = boundaryManager.coachReviewV2(req.params.sampleId, !!verified, notes || '');
    if (result.success) {
      persist();
      if (stateStore) stateStore.addHistoryEntry({
        sampleId: req.params.sampleId, action: 'coach_review', operator: '唐老师(Web)',
        statusBefore: result.sample!.reviewLog[result.sample!.reviewLog.length - 1]?.statusBefore,
        statusAfter: result.sample!.status, notes: notes || '',
        reason: verified ? '唐老师确认通过' : '唐老师退回，需补充数据',
      });
      persist();
      res.json({ success: true, data: result.sample });
    } else {
      res.status(400).json({
        success: false, error: result.errorMessage,
        errorKind: result.errorKind, hints: result.hints,
        statistics: boundaryManager.generateReport().statistics,
      });
    }
  });

  app.get('/api/windows', (_req, res) => {
    res.json({ success: true, data: windowConfigs });
  });

  app.get('/api/report', (_req, res) => {
    ensureLoaded();
    res.json({ success: true, data: boundaryManager.generateReport() });
  });

  app.get('/api/history/:sampleId?', (req, res) => {
    if (!stateStore) return res.json({ success: true, data: [] });
    ensureLoaded();
    res.json({ success: true, data: stateStore.getHistory(req.params.sampleId) });
  });

  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(port, () => {
    console.log(`\n🚀 Web小看板已启动: http://localhost:${port}`);
    console.log(`📊 功能说明:`);
    console.log(`   - 点击图表中的负数样本点可回溯查看原始数据（含原始负数 vs 修正后对比）`);
    console.log(`   - 3D视图展示窗口排班现场情况`);
    console.log(`   - 边界样本详情含完整复核历史时间线`);
    console.log(`   - 支持学生助教 & 唐老师复核，状态实时同步到持久化状态`);
    if (stateStore) console.log(`   - 状态文件: ${stateStore.getStatePath()}\n`);
  });

  return app;
}
