const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const auditRoutes = require('./routes/auditRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/audit', auditRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`
🚀 服务器启动成功！
📍 本地地址: http://localhost:${PORT}
📊 前端页面: http://localhost:${PORT}
🔌 API接口: http://localhost:${PORT}/api/audit

📝 提示: 
  - 首次运行请先执行: npm run init-db
  - 然后执行: npm start
  `);
});
