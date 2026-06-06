import express from 'express';
import path from 'path';
import { importTicketsFromCsv, getAllBatches, getTicketsByBatch, getTicketById } from '../services/ticketImporter';
import { 
  generateInitialRemindersForBatch, 
  getRemindersByAssignee, 
  getAllReminders,
  recordingEngineerReview,
  getReminderByTicketId
} from '../services/authReminder';
import { updateAudioRemark } from '../services/audioManager';
import { getBatchVisualization, getOverviewChartData, getTicketTrace, getAuthStatusSummary } from '../services/visualizer';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'sampling-auth-chain' });
});

app.get('/api/batches', (req, res) => {
  const batches = getAllBatches();
  res.json({ success: true, data: batches });
});

app.get('/api/batches/:batchId', (req, res) => {
  const viz = getBatchVisualization(req.params.batchId);
  if (!viz) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  res.json({ success: true, data: viz });
});

app.get('/api/tickets/batch/:batchId', (req, res) => {
  const tickets = getTicketsByBatch(req.params.batchId);
  res.json({ success: true, data: tickets });
});

app.get('/api/tickets/:ticketId', (req, res) => {
  const ticket = getTicketById(parseInt(req.params.ticketId));
  if (!ticket) {
    return res.status(404).json({ success: false, error: '票据不存在' });
  }
  res.json({ success: true, data: ticket });
});

app.get('/api/reminders', (req, res) => {
  const role = req.query.role;
  const reminders = role 
    ? getRemindersByAssignee(role as any)
    : getAllReminders();
  res.json({ success: true, data: reminders });
});

app.get('/api/reminders/ticket/:ticketId', (req, res) => {
  const reminder = getReminderByTicketId(parseInt(req.params.ticketId));
  if (!reminder) {
    return res.status(404).json({ success: false, error: '提醒不存在' });
  }
  res.json({ success: true, data: reminder });
});

app.post('/api/tickets/:ticketId/remark', (req, res) => {
  const { remark, operator } = req.body;
  if (!remark) {
    return res.status(400).json({ success: false, error: '缺少备注内容' });
  }
  const success = updateAudioRemark(parseInt(req.params.ticketId), remark, operator);
  if (success) {
    const reminder = getReminderByTicketId(parseInt(req.params.ticketId));
    res.json({ success: true, data: reminder });
  } else {
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

app.post('/api/tickets/:ticketId/review', (req, res) => {
  const { approve, remark, operator } = req.body;
  const result = recordingEngineerReview(
    parseInt(req.params.ticketId), 
    approve === true,
    remark || ''
  );
  if (result) {
    res.json({ success: true, data: result });
  } else {
    res.status(500).json({ success: false, error: '复核失败' });
  }
});

app.get('/api/trace/:ticketId', (req, res) => {
  const trace = getTicketTrace(parseInt(req.params.ticketId));
  if (!trace) {
    return res.status(404).json({ success: false, error: '找不到溯源信息' });
  }
  res.json({ success: true, data: trace });
});

app.get('/api/overview', (req, res) => {
  const chartData = getOverviewChartData();
  const statusSummary = getAuthStatusSummary();
  res.json({ success: true, data: { chartData, statusSummary } });
});

app.post('/api/import', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ success: false, error: '缺少文件路径' });
  }
  const result = importTicketsFromCsv(filePath);
  
  if (result.success) {
    result.batchesCreated.forEach(batchId => {
      generateInitialRemindersForBatch(batchId);
    });
  }
  
  res.json({ success: result.success, data: result });
});

app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.listen(PORT, () => {
  console.log('采样包授权链路 API 服务已启动: http://localhost:' + PORT);
  console.log('小看板页面: http://localhost:' + PORT + '/dashboard.html');
});

export default app;
