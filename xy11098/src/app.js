const express = require('express');
const bodyParser = require('body-parser');
const { errorHandler } = require('./middleware/errorHandler');

const warningsRouter = require('./routes/warnings');
const greenhousesRouter = require('./routes/greenhouses');
const importExportRouter = require('./routes/importExport');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '花卉温室病害预警系统 API',
    version: '1.0.0',
    endpoints: {
      greenhouses: '/api/greenhouses',
      warnings: '/api/warnings',
      importExport: '/api/import-export',
      docs: '请参考README.md'
    }
  });
});

app.use('/api/warnings', warningsRouter);
app.use('/api/greenhouses', greenhousesRouter);
app.use('/api/import-export', importExportRouter);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: '接口不存在',
      code: 'NOT_FOUND',
      details: { path: req.path, method: req.method }
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    花卉温室病害预警系统 API                                  ║
║                                                              ║
║    服务已启动: http://localhost:${PORT}                        ║
║                                                              ║
║    初始化数据: npm run init                                  ║
║    运行测试:   npm test                                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;