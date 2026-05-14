import express from 'express';
import { AuditService } from './services/AuditService';
import { ReportGenerator } from './services/ReportGenerator';

const app = express();
const PORT = 3000;

app.use(express.json());

const auditService = new AuditService();
const reportGenerator = new ReportGenerator();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '数据库索引建议审计服务运行正常' });
});

app.post('/api/audit', (req, res) => {
  const { executor = 'system' } = req.body;
  const auditResult = auditService.performAudit(executor);
  res.json(auditResult);
});

app.get('/api/report/:format', (req, res) => {
  const { format } = req.params;
  const validFormats = ['json', 'markdown', 'download'];

  if (!validFormats.includes(format)) {
    return res.status(400).json({
      error: '无效的报告格式',
      validFormats
    });
  }

  const auditResult = auditService.performAudit('api-user');
  const report = reportGenerator.generate(auditResult, format as any);

  if (format === 'download') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-report-${Date.now()}.json"`);
  } else if (format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  }

  res.send(report.content);
});

app.get('/api/fail-records', (req, res) => {
  const { format = 'json' } = req.query;
  const auditResult = auditService.performAudit('api-user');

  if (format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(reportGenerator.failRecordsToMarkdown(auditResult.exceptionRecords));
  } else {
    res.json(auditResult.exceptionRecords);
  }
});

app.get('/api/candidates/:type', (req, res) => {
  const { type } = req.params;

  if (type !== 'cleanup' && type !== 'rollback') {
    return res.status(400).json({
      error: '无效的候选类型',
      validTypes: ['cleanup', 'rollback']
    });
  }

  const candidates = auditService.generateCandidateList(type);
  res.json({
    total: candidates.length,
    candidates
  });
});

app.get('/api/audit-logs/:sourceSystem', (req, res) => {
  const { sourceSystem } = req.params;
  const logs = auditService.getAuditLogsBySourceSystem(sourceSystem);
  res.json({
    sourceSystem,
    total: logs.length,
    logs
  });
});

app.get('/api/work-orders', (req, res) => {
  const workOrders = auditService.getWorkOrders();
  res.json({
    total: workOrders.length,
    workOrders
  });
});

app.post('/api/approve-candidates', (req, res) => {
  const { candidateIds } = req.body;

  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return res.status(400).json({
      error: '请提供要批准的候选ID列表'
    });
  }

  res.json({
    message: '候选清单已批准',
    approvedCount: candidateIds.length,
    candidateIds,
    note: '此操作仅为模拟，实际生产环境需要执行具体的清理/回滚操作'
  });
});

app.listen(PORT, () => {
  console.log(`数据库索引建议审计服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('可用接口:');
  console.log('  GET  /health                      - 健康检查');
  console.log('  POST /api/audit                   - 执行审计');
  console.log('  GET  /api/report/:format          - 获取报告 (json/markdown/download)');
  console.log('  GET  /api/fail-records            - 获取失败项清单');
  console.log('  GET  /api/candidates/:type        - 获取候选清单 (cleanup/rollback)');
  console.log('  GET  /api/audit-logs/:sourceSystem - 获取指定来源系统的审计日志');
  console.log('  GET  /api/work-orders             - 获取所有工单');
  console.log('  POST /api/approve-candidates      - 批准候选清单');
});
