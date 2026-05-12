const express = require('express');
const experimentManager = require('./services/ExperimentManager');
const experimentsRouter = require('./routes/experiments');

const oldPriceProcessor = require('./processors/oldPriceProcessor');
const newPriceProcessor = require('./processors/newPriceProcessor');

experimentManager.registerProcessor('old-price', oldPriceProcessor);
experimentManager.registerProcessor('new-price', newPriceProcessor);

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: '影子流量对比 API',
    version: '1.0.0',
    endpoints: {
      experiments: '/api/experiments',
      shadow: '/api/experiments/:id/shadow',
      report: '/api/experiments/:id/report'
    }
  });
});

app.use('/api/experiments', experimentsRouter);

app.listen(PORT, () => {
  console.log(`影子流量对比 API 服务已启动: http://localhost:${PORT}`);
});

module.exports = app;
