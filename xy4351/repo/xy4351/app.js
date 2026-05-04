const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const volunteersRouter = require('./routes/volunteers');
const collectionSitesRouter = require('./routes/collection-sites');
const coldStoragesRouter = require('./routes/cold-storages');
const seedBatchesRouter = require('./routes/seed-batches');
const germinationTestsRouter = require('./routes/germination-tests');
const seedExchangesRouter = require('./routes/seed-exchanges');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/volunteers', volunteersRouter);
app.use('/api/collection-sites', collectionSitesRouter);
app.use('/api/cold-storages', coldStoragesRouter);
app.use('/api/seed-batches', seedBatchesRouter);
app.use('/api/germination-tests', germinationTestsRouter);
app.use('/api/seed-exchanges', seedExchangesRouter);
app.use('/api/export', exportRouter);

app.get('/', (req, res) => {
  res.json({
    message: '社区乡土植物种子库后端服务',
    version: '1.0.0',
    endpoints: {
      volunteers: '/api/volunteers',
      collection_sites: '/api/collection-sites',
      cold_storages: '/api/cold-storages',
      seed_batches: '/api/seed-batches',
      germination_tests: '/api/germination-tests',
      seed_exchanges: '/api/seed-exchanges',
      export: '/api/export'
    }
  });
});

app.listen(PORT, () => {
  console.log(`乡土植物种子库服务运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}`);
});

module.exports = app;
