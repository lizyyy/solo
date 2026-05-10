const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { initDatabase, insertSampleData } = require('./init-db');
const { getRepairItemsRouter } = require('./routes/repairItems');
const { getBuildingsRouter } = require('./routes/buildings');
const { getOwnersRouter } = require('./routes/owners');
const { getVotingRouter } = require('./routes/voting');
const { getDelegatesRouter } = require('./routes/delegates');
const { getStatisticsRouter } = require('./routes/statistics');
const { getExportRouter } = require('./routes/export');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'voting.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
    db.serialize(() => {
      initDatabase(db);
      insertSampleData(db);
    });
  }
});

app.use('/api/repair-items', getRepairItemsRouter(db));
app.use('/api/buildings', getBuildingsRouter(db));
app.use('/api/owners', getOwnersRouter(db));
app.use('/api/voting', getVotingRouter(db));
app.use('/api/delegates', getDelegatesRouter(db));
app.use('/api/statistics', getStatisticsRouter(db));
app.use('/api/export', getExportRouter(db));

app.get('/', (req, res) => {
  res.json({ message: '社区维修基金投票台 API 服务运行中' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
