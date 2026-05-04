const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const initDatabase = require('./config/initDb');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

initDatabase();

app.use('/api', apiRoutes);

const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API端点不存在' });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`售后语音纪要归因系统已启动`);
  console.log(`API服务运行在 http://localhost:${PORT}`);
  console.log(`请确保前端已构建完成，或访问前端开发服务器`);
});
