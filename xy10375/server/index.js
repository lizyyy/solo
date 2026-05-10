const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const routes = require('./routes');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function startServer() {
  await db.initDatabase();
  await db.seedSampleData();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`民办幼儿园缴费减免台系统已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
  });
}

startServer();
