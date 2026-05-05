const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const dataRoutes = require('./routes/data');
const riskRoutes = require('./routes/risk');
const exportRoutes = require('./routes/export');

app.use('/api/data', dataRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/export', exportRoutes);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`宠物医院夜班护士工具已启动: http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务`);
});
