import express from 'express';
import { dataStore } from './store';
import { batchCancellationService } from './service';
import { exportService, ExportFormat } from './export';
import { SampleStatus } from './types';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/batches', (req, res) => {
  const batches = dataStore.getAllBatches();
  res.json(batches);
});

app.get('/api/batches/:batchId/samples', (req, res) => {
  const { batchId } = req.params;
  const samples = dataStore.getSamplesByBatch(batchId);
  res.json(samples);
});

app.get('/api/batches/:batchId/preview', (req, res) => {
  const { batchId } = req.params;
  const preview = batchCancellationService.previewCancellation(batchId);
  
  if (!preview) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  res.json({
    message: '预览完成，请确认后执行取消操作',
    ...preview
  });
});

app.post('/api/batches/:batchId/cancel', (req, res) => {
  const { batchId } = req.params;
  const { operator, force = false } = req.body;

  if (!operator) {
    return res.status(400).json({ error: '操作人不能为空' });
  }

  const result = batchCancellationService.executeCancellation(batchId, operator, force);
  
  if (!result) {
    return res.status(404).json({ error: '批次不存在' });
  }

  res.json({
    message: result.success ? '批量取消成功' : '批量取消部分失败，请查看失败详情',
    ...result,
    nextSteps: result.failedCount > 0 ? [
      '导出失败清单供同事复核',
      '核实后可使用强制模式重试',
      '或对单个样品进行人工修正'
    ] : []
  });
});

app.post('/api/samples/:sampleId/adjust', (req, res) => {
  const { sampleId } = req.params;
  const { newStatus, adjustedBy, reason, remarks } = req.body;

  if (!newStatus || !adjustedBy || !reason || !remarks) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const result = batchCancellationService.manuallyAdjustSample(
    sampleId,
    newStatus as SampleStatus,
    adjustedBy,
    reason,
    remarks
  );

  res.json(result);
});

app.get('/api/batches/:batchId/export', (req, res) => {
  const { batchId } = req.params;
  const format = (req.query.format as ExportFormat) || 'json';

  const preview = batchCancellationService.previewCancellation(batchId);
  if (!preview) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const result = batchCancellationService.executeCancellation(batchId, 'system', false);
  if (!result) {
    return res.status(500).json({ error: '生成导出数据失败' });
  }

  const exported = exportService.exportCancellationResult(result, format);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cancellation-${batchId}.json"`);
  } else if (format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cancellation-${batchId}.md"`);
  } else if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cancellation-${batchId}.csv"`);
  }

  res.send(exported);
});

app.get('/api/batches/:batchId/review', (req, res) => {
  const { batchId } = req.params;
  const format = (req.query.format as ExportFormat) || 'json';

  const reviewData = exportService.exportReviewList(batchId, format);
  
  if (!reviewData) {
    return res.json({ message: '该批次无需要复核的内容' });
  }

  if (format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  }

  res.send(reviewData);
});

app.get('/api/adjustments', (req, res) => {
  const adjustments = dataStore.getAllAdjustments();
  res.json(adjustments);
});

app.listen(PORT, () => {
  console.log(`
🚀 批量任务取消服务已启动

📌 服务地址: http://localhost:${PORT}

📋 可用接口:

1. 查看所有批次
   GET /api/batches

2. 查看批次样品
   GET /api/batches/:batchId/samples

3. 预览批量取消影响范围 ⭐
   GET /api/batches/:batchId/preview

4. 执行批量取消
   POST /api/batches/:batchId/cancel
   Body: { "operator": "用户名", "force": false }

5. 人工修正样品
   POST /api/samples/:sampleId/adjust
   Body: { "newStatus": "状态", "adjustedBy": "操作人", "reason": "原因", "remarks": "备注" }

6. 导出取消结果 (支持 json/markdown/csv)
   GET /api/batches/:batchId/export?format=markdown

7. 导出复核清单
   GET /api/batches/:batchId/review?format=markdown

💡 测试批次号: BATCH-2026-0515-001 (美妆专场，含来源混杂样本)
  `);
});