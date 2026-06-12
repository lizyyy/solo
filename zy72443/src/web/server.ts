import express from 'express';
import path from 'path';
import { runFullDemoWorkflow, getReviewContext, managerReview, engineerUpdateAudioRemark, resolveAnomalyByManager } from '../core/workflow';
import { generateReport, traceCity } from '../core/reportGenerator';
import { dataStore } from '../core/dataStore';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '音乐人直播打赏分账系统运行中', dataFile: dataStore.getDataFilePath() });
});

app.get('/api/init-demo', (req, res) => {
  const forceReset = req.query.force === 'true';
  const result = runFullDemoWorkflow(forceReset);
  res.json({
    success: true,
    data: {
      tickets: result.tickets.length,
      audioRemarks: result.audioRemarks.length,
      verifications: result.verifications.length,
      anomalies: result.anomalies.filter(a => !a.resolved).length
    }
  });
});

app.get('/api/dashboard', (req, res) => {
  const report = generateReport();
  const verifications = dataStore.getAllVerifications();
  const anomalies = dataStore.getAllAnomalies();
  
  const cityCount: Record<string, number> = {};
  for (const v of verifications) {
    for (const city of v.authorizedCities) {
      cityCount[city] = (cityCount[city] || 0) + 1;
    }
  }
  
  const revenueByMusician: Record<string, number> = {};
  for (const v of verifications) {
    revenueByMusician[v.musicianName] = (revenueByMusician[v.musicianName] || 0) + v.finalRevenue;
  }
  
  res.json({
    success: true,
    data: {
      summary: report.summary,
      verifications: verifications.map(v => ({
        verificationNo: v.verificationNo,
        ticketId: v.ticketId,
        musicianName: v.musicianName,
        liveDate: v.liveDate,
        totalTips: v.totalTips,
        finalRevenue: v.finalRevenue,
        authorizedCities: v.authorizedCities,
        status: v.status,
        reservedReason: v.reservedReason,
        missingMaterials: v.missingMaterials,
        nextAction: v.nextAction,
        actionNotes: v.actionNotes,
        reviewedBy: v.reviewedBy
      })),
      anomalies: anomalies.map(a => ({
        id: a.id,
        ticketId: a.ticketId,
        type: a.type,
        description: a.description,
        severity: a.severity,
        resolved: a.resolved,
        resolvedBy: a.resolvedBy,
        resolutionNotes: a.resolutionNotes,
        sourceData: a.sourceData
      })),
      changeHistories: report.changeHistoryList.map(h => ({
        id: h.id,
        ticketId: h.ticketId,
        entityType: h.entityType,
        entityId: h.entityId,
        fieldName: h.fieldName,
        oldValue: h.oldValue,
        newValue: h.newValue,
        changedBy: h.changedBy,
        changeReason: h.changeReason,
        changedAt: h.changedAt
      })),
      cityTraceability: report.cityTraceability,
      charts: {
        cityDistribution: Object.entries(cityCount).map(([name, count]) => ({ name, count })),
        revenueByMusician: Object.entries(revenueByMusician).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })),
        statusDistribution: [
          { name: '待处理', value: verifications.filter(v => v.status === 'pending').length },
          { name: '已预留(异常)', value: verifications.filter(v => v.status === 'reserved').length },
          { name: '已核销', value: verifications.filter(v => v.status === 'verified').length }
        ]
      }
    }
  });
});

app.get('/api/ticket/:ticketId', (req, res) => {
  const context = getReviewContext(req.params.ticketId);
  if (!context) {
    res.status(404).json({ success: false, message: '未找到票单' });
    return;
  }
  res.json({ success: true, data: context });
});

app.get('/api/trace-city/:city', (req, res) => {
  const city = req.params.city;
  const histories = dataStore.getChangeHistoriesByCity(city);
  const verifications = dataStore.getAllVerifications().filter(v => v.authorizedCities.includes(city));
  const anomalies = dataStore.getAllAnomalies().filter(a => a.description.includes(city));
  
  res.json({
    success: true,
    data: {
      city,
      verifications: verifications.map(v => ({
        verificationNo: v.verificationNo,
        ticketId: v.ticketId,
        musicianName: v.musicianName,
        status: v.status,
        authorizedCities: v.authorizedCities
      })),
      anomalies: anomalies.map(a => ({
        id: a.id,
        ticketId: a.ticketId,
        resolved: a.resolved,
        description: a.description,
        sourceData: a.sourceData
      })),
      changeHistories: histories.map(h => ({
        id: h.id,
        entityType: h.entityType,
        entityId: h.entityId,
        fieldName: h.fieldName,
        oldValue: h.oldValue,
        newValue: h.newValue,
        changedBy: h.changedBy,
        changeReason: h.changeReason,
        changedAt: h.changedAt
      }))
    }
  });
});

app.get('/api/change-histories/:ticketId', (req, res) => {
  const histories = dataStore.getChangeHistoriesByTicket(req.params.ticketId);
  res.json({
    success: true,
    data: histories.map(h => ({
      id: h.id,
      entityType: h.entityType,
      entityId: h.entityId,
      fieldName: h.fieldName,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      changeReason: h.changeReason,
      changedAt: h.changedAt
    }))
  });
});

app.post('/api/manager-review/:ticketId', (req, res) => {
  const { action, notes } = req.body;
  const result = managerReview(req.params.ticketId, action, notes || '');
  res.json(result);
});

app.post('/api/engineer-fix/:ticketId', (req, res) => {
  const { cities, remark } = req.body;
  const result = engineerUpdateAudioRemark(req.params.ticketId, cities || [], remark || '');
  res.json({
    success: result.success,
    message: result.message,
    resolvedAnomalies: result.resolvedAnomalies?.map(a => ({
      id: a.id,
      ticketId: a.ticketId,
      resolvedBy: a.resolvedBy,
      resolutionNotes: a.resolutionNotes
    }))
  });
});

app.post('/api/resolve-anomaly/:anomalyId', (req, res) => {
  const { notes } = req.body;
  const result = resolveAnomalyByManager(req.params.anomalyId, notes || '');
  res.json(result);
});

app.post('/api/reset', (req, res) => {
  dataStore.clear();
  res.json({ success: true, message: '数据已重置' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 小看板服务已启动: http://localhost:${PORT}`);
  console.log(`   数据文件: ${dataStore.getDataFilePath()}`);
  console.log(`   首次访问请点击页面上的"初始化演示数据"按钮`);
});
