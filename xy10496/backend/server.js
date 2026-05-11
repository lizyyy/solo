const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const queueManager = require('./src/queueManager');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

queueManager.loadState();

app.get('/api/queues', (req, res) => {
  res.json(queueManager.getAllQueues());
});

app.get('/api/queues/:type', (req, res) => {
  const queue = queueManager.getQueue(req.params.type);
  res.json(queue);
});

app.get('/api/windows', (req, res) => {
  res.json(queueManager.getWindows());
});

app.get('/api/missed', (req, res) => {
  res.json(queueManager.getMissedNumbers());
});

app.get('/api/statistics', (req, res) => {
  res.json(queueManager.getStatistics());
});

app.get('/api/incomplete', (req, res) => {
  res.json(queueManager.getIncompleteNumbers());
});

app.get('/api/history/today', (req, res) => {
  res.json(queueManager.getTodayHistory());
});

app.get('/api/ticket/:id', (req, res) => {
  const ticket = queueManager.getTicketHistory(req.params.id);
  if (!ticket) {
    return res.status(404).json({ success: false, message: '未找到该号码' });
  }
  res.json(ticket);
});

app.post('/api/take-number', (req, res) => {
  const result = queueManager.takeNumber(req.body);
  res.json(result);
});

app.post('/api/call-next', (req, res) => {
  const { windowId, businessType } = req.body;
  const result = queueManager.callNextNumber(windowId, businessType);
  res.json(result);
});

app.post('/api/mark-missed', (req, res) => {
  const { windowId } = req.body;
  const result = queueManager.markMissed(windowId);
  res.json(result);
});

app.post('/api/requeue', (req, res) => {
  const { ticketId } = req.body;
  const result = queueManager.requeue(ticketId);
  res.json(result);
});

app.post('/api/complete', (req, res) => {
  const { windowId } = req.body;
  const result = queueManager.completeNumber(windowId);
  res.json(result);
});

app.post('/api/windows/:id/status', (req, res) => {
  const windowId = parseInt(req.params.id);
  const { status } = req.body;
  const result = queueManager.toggleWindow(windowId, status);
  res.json(result);
});

app.get('/api/export/today', (req, res) => {
  const history = queueManager.getTodayHistory();
  const csvHeader = '号码,姓名,手机号,业务类型,状态,取号时间,叫号时间,完成时间,处理窗口,是否老人,是否预约,重排次数\n';
  const businessTypeMap = { card: '办卡', after_sale: '售后', consultation: '咨询' };
  const statusMap = { waiting: '等待中', calling: '叫号中', missed: '已过号', completed: '已完成' };
  
  const csvLines = history.map(t => {
    return [
      t.id,
      t.name,
      t.phone,
      businessTypeMap[t.businessType],
      statusMap[t.status],
      new Date(t.createdAt).toLocaleString('zh-CN'),
      t.calledAt ? new Date(t.calledAt).toLocaleString('zh-CN') : '',
      t.completedAt ? new Date(t.completedAt).toLocaleString('zh-CN') : '',
      t.processedByWindow || '',
      t.isSenior ? '是' : '否',
      t.isReservation ? '是' : '否',
      t.requeueCount
    ].join(',');
  });
  
  const csvContent = csvHeader + csvLines.join('\n');
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=queue_history_${new Date().toISOString().split('T')[0]}.csv`);
  res.send('\uFEFF' + csvContent);
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
