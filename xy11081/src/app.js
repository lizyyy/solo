const express = require('express');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const sparePartsRoutes = require('./routes/spareParts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '维修备件小库备件安全库存 API',
    version: '1.0.0',
    endpoints: {
      list: 'GET /api/spare-parts',
      get_by_id: 'GET /api/spare-parts/:id',
      get_by_code: 'GET /api/spare-parts/code/:part_code',
      create: 'POST /api/spare-parts',
      update: 'PUT /api/spare-parts/:id',
      delete: 'DELETE /api/spare-parts/:id',
      batch_import: 'POST /api/spare-parts/batch-import',
      purchase_suggestions: 'GET /api/spare-parts/purchase-suggestions',
      export: 'GET /api/spare-parts/export'
    }
  });
});

app.use('/api/spare-parts', sparePartsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('请先运行 npm run init-db 初始化数据库和样例数据');
});

module.exports = app;
