const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const SCHEMA = require('./database/schema');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

db.serialize(() => {
  db.db.exec(SCHEMA, (err) => {
    if (err) {
      console.error('数据库初始化失败:', err.message);
    } else {
      console.log('数据库表初始化完成');
    }
  });
});

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '市政运维后端服务',
    version: '1.0.0',
    description: '可追踪记录管理系统',
    endpoints: {
      health: 'GET /api/health',
      batches: 'GET/POST /api/batches',
      import: {
        alarm_csv: 'POST /api/import/alarm-csv',
        inspection_json: 'POST /api/import/inspection-json',
        work_order: 'POST /api/import/work-order'
      },
      records: {
        list: 'GET /api/records',
        detail: 'GET /api/records/:record_no',
        trace: 'GET /api/records/:record_no/trace',
        history: 'GET /api/records/:record_no/history',
        process: 'POST /api/records/process',
        return: 'POST /api/records/return'
      },
      special: {
        multi_light: 'POST /api/special/multi-light',
        false_alarm: 'POST /api/special/false-alarm',
        recheck: 'POST /api/special/recheck'
      },
      export: {
        records: 'GET /api/export/records',
        detail: 'GET /api/export/records/:record_no/detail',
        recheck_trace: 'GET /api/export/recheck-trace'
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`市政运维服务已启动，端口: ${PORT}`);
  console.log(`服务地址: http://localhost:${PORT}`);
});
