const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');
const { setupRoutes } = require('./routes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const db = initDB();
setupRoutes(app, db);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`音乐治疗情绪日志系统运行在 http://localhost:${PORT}`);
});
