const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const subscriptionsRouter = require('./routes/subscriptions');
const pauseRequestsRouter = require('./routes/pauseRequests');
const deliveriesRouter = require('./routes/deliveries');
const exceptionsRouter = require('./routes/exceptions');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../client/build')));

app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/pause-requests', pauseRequestsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/exceptions', exceptionsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '报刊订阅暂停补投系统运行正常' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
