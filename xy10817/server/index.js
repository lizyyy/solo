const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

const { initDatabase, runQuery, runExecute } = require('./database');
const rulesEngine = require('./rulesEngine');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.post('/api/old-endpoints', async (req, res) => {
  try {
    const { name, url, method, description } = req.body;
    const id = uuidv4();
    await runExecute(
      'INSERT INTO old_endpoints (id, name, url, method, description) VALUES (?, ?, ?, ?, ?)',
      [id, name, url, method, description]
    );
    res.json({ id, name, url, method, description });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/old-endpoints', async (req, res) => {
  try {
    const endpoints = await runQuery('SELECT * FROM old_endpoints ORDER BY created_at DESC');
    res.json(endpoints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/new-endpoints', async (req, res) => {
  try {
    const { name, url, method, description, old_endpoint_id, status } = req.body;
    const id = uuidv4();
    await runExecute(
      'INSERT INTO new_endpoints (id, name, url, method, description, old_endpoint_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, url, method, description, old_endpoint_id, status || 'pending']
    );
    res.json({ id, name, url, method, description, old_endpoint_id, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/new-endpoints', async (req, res) => {
  try {
    const endpoints = await runQuery(`
      SELECT ne.*, oe.name as old_name
      FROM new_endpoints ne
      LEFT JOIN old_endpoints oe ON ne.old_endpoint_id = oe.id
      ORDER BY ne.created_at DESC
    `);
    res.json(endpoints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/new-endpoints/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await runExecute('UPDATE new_endpoints SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, id, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calling-systems', async (req, res) => {
  try {
    const { name, owner, contact_info } = req.body;
    const id = uuidv4();
    await runExecute(
      'INSERT INTO calling_systems (id, name, owner, contact_info) VALUES (?, ?, ?, ?)',
      [id, name, owner, contact_info]
    );
    res.json({ id, name, owner, contact_info });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calling-systems', async (req, res) => {
  try {
    const systems = await runQuery('SELECT * FROM calling_systems ORDER BY created_at DESC');
    res.json(systems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compatibility-layers', async (req, res) => {
  try {
    const { name, old_endpoint_id, new_endpoint_id, transformation_rules } = req.body;
    const id = uuidv4();
    await runExecute(
      'INSERT INTO compatibility_layers (id, name, old_endpoint_id, new_endpoint_id, transformation_rules) VALUES (?, ?, ?, ?, ?)',
      [id, name, old_endpoint_id, new_endpoint_id, transformation_rules]
    );
    res.json({ id, name, old_endpoint_id, new_endpoint_id, transformation_rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compatibility-layers', async (req, res) => {
  try {
    const layers = await runQuery(`
      SELECT cl.*, oe.name as old_name, ne.name as new_name
      FROM compatibility_layers cl
      LEFT JOIN old_endpoints oe ON cl.old_endpoint_id = oe.id
      LEFT JOIN new_endpoints ne ON cl.new_endpoint_id = ne.id
      ORDER BY cl.created_at DESC
    `);
    res.json(layers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/compatibility-layers/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await runExecute('UPDATE compatibility_layers SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, id, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/traffic-batches', async (req, res) => {
  try {
    const { name, calling_system_id, new_endpoint_id, traffic_percentage } = req.body;
    const id = uuidv4();
    await runExecute(
      'INSERT INTO traffic_batches (id, name, calling_system_id, new_endpoint_id, traffic_percentage) VALUES (?, ?, ?, ?, ?)',
      [id, name, calling_system_id, new_endpoint_id, traffic_percentage || 0]
    );
    res.json({ id, name, calling_system_id, new_endpoint_id, traffic_percentage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/traffic-batches', async (req, res) => {
  try {
    const batches = await runQuery(`
      SELECT tb.*, cs.name as system_name, ne.name as endpoint_name
      FROM traffic_batches tb
      LEFT JOIN calling_systems cs ON tb.calling_system_id = cs.id
      LEFT JOIN new_endpoints ne ON tb.new_endpoint_id = ne.id
      ORDER BY tb.created_at DESC
    `);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/traffic-batches/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await runExecute('UPDATE traffic_batches SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, id, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/traffic-batches/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await rulesEngine.validateMigrationBatch(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/traffic-batches/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator } = req.body;
    const result = await rulesEngine.confirmTrafficSwitch(id, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/traffic-batches/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, operator } = req.body;
    const result = await rulesEngine.executeRollback(id, reason, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reconciliation', async (req, res) => {
  try {
    const { batch_id, old_response, new_response } = req.body;
    const result = await rulesEngine.performReconciliation(batch_id, old_response, new_response);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reconciliation/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const records = await runQuery(
      'SELECT * FROM reconciliation_records WHERE batch_id = ? ORDER BY checked_at DESC',
      [batchId]
    );
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/request-logs', async (req, res) => {
  try {
    const { batch_id, old_endpoint_id, new_endpoint_id, request_input, response_output, status, error_message, responsible_node } = req.body;
    const logId = await rulesEngine.logRequest(
      batch_id, old_endpoint_id, new_endpoint_id, status, error_message, responsible_node
    );
    res.json({ id: logId, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/request-logs', async (req, res) => {
  try {
    const logs = await runQuery(`
      SELECT rl.*, tb.name as batch_name, cs.name as system_name
      FROM request_logs rl
      LEFT JOIN traffic_batches tb ON rl.batch_id = tb.id
      LEFT JOIN calling_systems cs ON rl.calling_system_id = cs.id
      ORDER BY rl.timestamp DESC
      LIMIT 200
    `);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/exceptions', async (req, res) => {
  try {
    const exceptions = await rulesEngine.getExceptionQueue();
    res.json(exceptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await rulesEngine.getMigrationStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rollback-records', async (req, res) => {
  try {
    const records = await runQuery(`
      SELECT rr.*, tb.name as batch_name
      FROM rollback_records rr
      LEFT JOIN traffic_batches tb ON rr.batch_id = tb.id
      ORDER BY rr.rolled_back_at DESC
    `);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/migration-report', async (req, res) => {
  try {
    const batches = await runQuery(`
      SELECT tb.*, cs.name as system_name, ne.name as endpoint_name, ne.url as endpoint_url
      FROM traffic_batches tb
      LEFT JOIN calling_systems cs ON tb.calling_system_id = cs.id
      LEFT JOIN new_endpoints ne ON tb.new_endpoint_id = ne.id
      ORDER BY tb.created_at DESC
    `);

    const csvWriter = createCsvWriter({
      path: path.join(dataDir, 'migration-report.csv'),
      header: [
        { id: 'name', title: '批次名称' },
        { id: 'system_name', title: '调用系统' },
        { id: 'endpoint_name', title: '新端点' },
        { id: 'traffic_percentage', title: '切流比例' },
        { id: 'status', title: '状态' },
        { id: 'created_at', title: '创建时间' },
        { id: 'executed_at', title: '执行时间' }
      ]
    });

    await csvWriter.writeRecords(batches);

    res.download(path.join(dataDir, 'migration-report.csv'), 'migration-report.csv');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/exception-report', async (req, res) => {
  try {
    const exceptions = await rulesEngine.getExceptionQueue();

    const csvWriter = createCsvWriter({
      path: path.join(dataDir, 'exception-report.csv'),
      header: [
        { id: 'batch_name', title: '批次名称' },
        { id: 'system_name', title: '调用系统' },
        { id: 'status', title: '状态' },
        { id: 'error_message', title: '错误信息' },
        { id: 'responsible_node', title: '责任节点' },
        { id: 'timestamp', title: '时间' }
      ]
    });

    await csvWriter.writeRecords(exceptions);

    res.download(path.join(dataDir, 'exception-report.csv'), 'exception-report.csv');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`端点迁移助手 API 服务运行在 http://localhost:${PORT}`);
  });
}

startServer();
