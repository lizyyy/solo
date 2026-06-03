import express from 'express';
import * as path from 'path';
import { BoundarySampleManager } from '../core/boundarySampleManager';
import { WindowConfig, BoundarySample } from '../types';

export function startWebServer(
  port: number,
  boundaryManager: BoundarySampleManager,
  windowConfigs: WindowConfig[]
) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/samples', (req, res) => {
    const samples = boundaryManager.getAllBoundarySamples();
    res.json({
      success: true,
      data: samples,
      statistics: boundaryManager.generateReport().statistics,
    });
  });

  app.get('/api/samples/:sampleId', (req, res) => {
    const sample = boundaryManager.findBySampleId(req.params.sampleId);
    if (sample) {
      res.json({ success: true, data: sample });
    } else {
      res.status(404).json({ success: false, error: '样本不存在' });
    }
  });

  app.post('/api/samples/:sampleId/ta-review', (req, res) => {
    const { verified, notes, questionnaire } = req.body;
    const result = boundaryManager.taReview(
      req.params.sampleId,
      verified,
      notes || '',
      questionnaire
    );
    if (result) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: '复核失败' });
    }
  });

  app.post('/api/samples/:sampleId/coach-review', (req, res) => {
    const { verified, notes } = req.body;
    const result = boundaryManager.coachReview(
      req.params.sampleId,
      verified,
      notes || ''
    );
    if (result) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: '复核失败' });
    }
  });

  app.get('/api/windows', (req, res) => {
    res.json({ success: true, data: windowConfigs });
  });

  app.get('/api/report', (req, res) => {
    const report = boundaryManager.generateReport();
    res.json({ success: true, data: report });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(port, () => {
    console.log(`\n🚀 Web小看板已启动: http://localhost:${port}`);
    console.log(`📊 功能说明:`);
    console.log(`   - 点击图表中的负数样本点可以回溯查看原始数据`);
    console.log(`   - 3D视图展示窗口排班现场情况`);
    console.log(`   - 边界样本卡片支持快速复核操作\n`);
  });

  return app;
}
