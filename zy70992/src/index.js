const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const exportsDir = path.join(__dirname, '..', 'exports');

[dataDir, uploadsDir, exportsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const { initSchema } = require('./db');
initSchema();

const routes = require('./routes');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '学校餐饮补贴追踪服务',
    version: '1.0.0',
    endpoints: {
      batch_create: 'POST /api/batches',
      batch_list: 'GET /api/batches',
      batch_detail: 'GET /api/batches/:id',
      import_cards: 'POST /api/batches/:id/import-cards',
      import_subsidy: 'POST /api/batches/:id/import-subsidy',
      import_refunds: 'POST /api/batches/:id/import-refunds',
      process_card: 'POST /api/card-records/:id/process',
      batch_process: 'POST /api/card-records/:id/batch-process',
      process_refund: 'POST /api/refund-records/:id/process',
      finalize: 'POST /api/batches/:id/finalize',
      history_query: 'GET /api/history',
      history_export: 'GET /api/history/export',
      card_records: 'GET /api/card-records',
      operation_logs: 'GET /api/operation-logs',
      student_detail: 'GET /api/students/:student_id',
      validate_card: 'POST /api/validate-card'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`餐饮补贴追踪服务已启动: http://localhost:${PORT}`);
});
