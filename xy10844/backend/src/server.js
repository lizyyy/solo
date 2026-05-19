const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const taskRoutes = require('./routes/tasks');
const { STAGES, STATUSES, STAGE_NAMES, STATUS_NAMES } = require('./constants/stages');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/tasks', taskRoutes);

app.get('/api/constants', (req, res) => {
  res.json({
    stages: STAGES,
    statuses: STATUSES,
    stageNames: STAGE_NAMES,
    statusNames: STATUS_NAMES
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`向量索引重建控制台后端服务运行在 http://localhost:${PORT}`);
});