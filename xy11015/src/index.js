const express = require('express');
const bodyParser = require('body-parser');
const evaluationRoutes = require('./routes/evaluations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '家政派单点保姆试工评价 API',
    version: '1.0.0',
    endpoints: {
      create: 'POST /api/evaluations',
      update: 'PUT /api/evaluations/:id',
      getById: 'GET /api/evaluations/:id',
      list: 'GET /api/evaluations',
      delete: 'DELETE /api/evaluations/:id',
      batchImport: 'POST /api/evaluations/batch-import',
      export: 'GET /api/evaluations/export',
      enums: 'GET /api/evaluations/enums'
    }
  });
});

app.use('/api/evaluations', evaluationRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`家政派单点保姆试工评价 API 已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
});

module.exports = app;
