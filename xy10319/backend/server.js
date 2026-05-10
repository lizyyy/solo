const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, seedData } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

initDatabase();
seedData();

app.use('/api', routes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`早教试听课转化台后端服务已启动: http://localhost:${PORT}`);
});
