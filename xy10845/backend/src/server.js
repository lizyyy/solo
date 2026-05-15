const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const appealsRouter = require('./routes/appeals');
const contentsRouter = require('./routes/contents');
const reviewersRouter = require('./routes/reviewers');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/appeals', appealsRouter);
app.use('/api/contents', contentsRouter);
app.use('/api/reviewers', reviewersRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`内容审核申诉API服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
