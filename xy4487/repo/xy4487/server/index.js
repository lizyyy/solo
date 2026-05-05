const express = require('express');
const cors = require('cors');
const path = require('path');
const initDatabase = require('./database');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = initDatabase();
app.locals.db = db;

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`农机合作社管理工具运行在 http://localhost:${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
});
