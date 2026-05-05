const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

if (fs.existsSync(path.join(__dirname, '..', 'client', 'build'))) {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('<h1>空气质量放行看板服务</h1><p>请运行 <code>npm run dev</code> 或先构建前端</p>');
  });
}

app.listen(PORT, () => {
  console.log(`空气质量放行看板服务运行在 http://localhost:${PORT}`);
  console.log(`API 端点: http://localhost:${PORT}/api`);
});