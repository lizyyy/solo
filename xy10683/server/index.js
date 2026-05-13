const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const tableTypeRoutes = require('./routes/tableTypes');
const tableRoutes = require('./routes/tables');
const queueRoutes = require('./routes/queues');
const mergeRoutes = require('./routes/merges');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../client/build')));

app.use('/api/table-types', tableTypeRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/merges', mergeRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '餐厅排号系统运行正常' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
