import express from 'express';
import cors from 'cors';
import dataSource from './services/dataSource';
import workflowEngine from './services/workflowEngine';
import selfCheckEngine from './services/selfCheckEngine';
import importEngine from './services/importEngine';
import exportService from './services/exportService';
import { ProcessingStatus } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    dataSourceId: dataSource.getInstanceId(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/authorization-terms', (req, res) => {
  const terms = dataSource.getAuthorizationTerms('list');
  const withDetails = terms.map(term => ({
    ...term,
    changeCount: dataSource.getChangeRecords(term.id).length,
    tunerMessageCount: dataSource.getTunerMessages(term.id).length,
    hasWriteOff: dataSource.getWriteOffRecords(term.id).length > 0
  }));
  res.json({
    data: withDetails,
    dataSourceId: dataSource.getInstanceId(),
    total: withDetails.length
  });
});

app.get('/api/authorization-terms/:id', (req, res) => {
  const term = dataSource.getAuthorizationTermById(req.params.id);
  if (!term) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const changes = dataSource.getChangeRecords(req.params.id);
  const messages = dataSource.getTunerMessages(req.params.id);
  const writeOffs = dataSource.getWriteOffRecords(req.params.id);
  
  res.json({
    data: term,
    evidence: {
      changeRecords: changes,
      tunerMessages: messages,
      writeOffRecords: writeOffs
    },
    dataSourceId: dataSource.getInstanceId()
  });
});

app.get('/api/authorization-terms/:id/changes', (req, res) => {
  const changes = dataSource.getChangeRecords(req.params.id);
  res.json({ data: changes });
});

app.post('/api/workflow/step1-import', async (req, res) => {
  const { operator, importData } = req.body;
  const result = await workflowEngine.executeStep1_Import(
    operator || '小鹿',
    importData || importEngine.generateSampleImportData()
  );
  res.json(result);
});

app.post('/api/workflow/step2-tuner-review', async (req, res) => {
  const { authorizationTermId, reviewer, tunerMessageContent, tunerName } = req.body;
  const result = await workflowEngine.executeStep2_TunerReview(
    authorizationTermId,
    reviewer || '小鹿',
    tunerMessageContent,
    tunerName
  );
  res.json(result);
});

app.post('/api/workflow/step3-write-off', async (req, res) => {
  const { authorizationTermId, operator, courseHours, unitPrice, writeOffNumber } = req.body;
  const result = await workflowEngine.executeStep3_WriteOffUpdate(
    authorizationTermId,
    operator || '小鹿',
    courseHours,
    unitPrice,
    writeOffNumber
  );
  res.json(result);
});

app.post('/api/workflow/manager-review', async (req, res) => {
  const { authorizationTermId, manager, approved, reviewComment } = req.body;
  const result = await workflowEngine.managerReview(
    authorizationTermId,
    manager || '店长',
    approved,
    reviewComment
  );
  res.json(result);
});

app.get('/api/workflow/progress', (req, res) => {
  const progress = workflowEngine.getWorkflowProgress();
  const pendingReview = workflowEngine.getTermsAwaitingReview();
  res.json({
    progress,
    pendingReview,
    dataSourceId: dataSource.getInstanceId()
  });
});

app.get('/api/self-check/run', (req, res) => {
  const operator = (req.query.operator as string) || 'system';
  const results = selfCheckEngine.runAllChecks(operator);
  const summary = selfCheckEngine.getCheckSummary();
  res.json({ results, summary, dataSourceId: dataSource.getInstanceId() });
});

app.get('/api/self-check/summary', (req, res) => {
  const summary = selfCheckEngine.getCheckSummary();
  const records = dataSource.getSelfCheckRecords();
  res.json({ summary, records });
});

app.get('/api/export/authorization-terms', (req, res) => {
  const includeEvidence = req.query.evidence === 'true';
  const { data, headers } = includeEvidence 
    ? exportService.exportAuthorizationTermsWithEvidence()
    : exportService.exportAuthorizationTerms();
  
  res.json({
    data,
    headers,
    dataSourceId: dataSource.getInstanceId(),
    consistency: dataSource.verifyDataConsistency()
  });
});

app.get('/api/consistency/check', (req, res) => {
  const listData = dataSource.getAuthorizationTerms('list');
  const detailData = dataSource.getAuthorizationTerms('detail');
  const exportData = dataSource.getAuthorizationTerms('export');
  
  res.json({
    listCount: listData.length,
    detailCount: detailData.length,
    exportCount: exportData.length,
    isConsistent: listData.length === detailData.length && detailData.length === exportData.length,
    dataSourceId: dataSource.getInstanceId(),
    consistencyIssues: dataSource.verifyDataConsistency()
  });
});

app.get('/api/consistency/verify', (req, res) => {
  const result = dataSource.verifyDataConsistency();
  res.json(result);
});

app.get('/api/import/sample-data', (req, res) => {
  res.json({
    data: importEngine.generateSampleImportData(),
    description: '这是用于测试的示例导入数据，包含一条故意缺省城市的记录（第3行：江苏）'
  });
});

export const startServer = () => {
  app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  校园乐队器材维修 - 版权运营管理系统');
    console.log('========================================');
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  数据源ID: ${dataSource.getInstanceId()}`);
    console.log('');
    console.log('  API 文档:');
    console.log('  GET  /api/health                 - 健康检查');
    console.log('  GET  /api/authorization-terms    - 授权期限列表');
    console.log('  GET  /api/authorization-terms/:id - 授权期限详情（含证据）');
    console.log('  POST /api/workflow/step1-import  - 第一步：导入授权期限');
    console.log('  POST /api/workflow/step2-tuner-review - 第二步：查看调音师留言');
    console.log('  POST /api/workflow/step3-write-off   - 第三步：更新核销单');
    console.log('  POST /api/workflow/manager-review    - 店长复核');
    console.log('  GET  /api/self-check/run         - 执行全部自检');
    console.log('  GET  /api/export/authorization-terms - 导出数据');
    console.log('  GET  /api/consistency/check      - 数据一致性检查');
    console.log('');
  });
};

startServer();

export default app;
