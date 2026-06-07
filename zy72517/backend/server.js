const express = require('express');
const cors = require('cors');
const path = require('path');

const batchesRouter = require('./routes/batches');
const { ensureDataDir } = require('./services/dataStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../frontend')));

ensureDataDir();

app.use('/api/batches', batchesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`产品问答相似问题归并系统已启动: http://localhost:${PORT}`);
});
