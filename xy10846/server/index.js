const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const initDatabase = require('./database/init');
const requestLogger = require('./middleware/requestLogger');

const documentsRoute = require('./routes/documents');
const rulesRoute = require('./routes/rules');
const previewsRoute = require('./routes/previews');
const versionsRoute = require('./routes/versions');
const exportRoute = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestLogger);

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/documents', documentsRoute);
app.use('/api/rules', rulesRoute);
app.use('/api/previews', previewsRoute);
app.use('/api/versions', versionsRoute);
app.use('/api/export', exportRoute);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'document-slicing-strategy-console'
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function startServer() {
  try {
    await initDatabase();
    console.log('\n✅ 数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log('========================================');
      console.log('   文档切片策略台 启动成功!');
      console.log(`   服务地址: http://localhost:${PORT}`);
      console.log(`   健康检查: http://localhost:${PORT}/api/health`);
      console.log('========================================');
    });
  } catch (err) {
    console.error('❌ 启动失败:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
