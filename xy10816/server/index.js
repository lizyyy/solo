const express = require('express');
const cors = require('cors');
const path = require('path');
const { Parser } = require('json2csv');
const ErrorCodeService = require('./services/errorCodeService');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const originalJson = res.json;
  const originalEnd = res.end;
  let responseBody = '';
  const chunks = [];
  
  res.json = function(data) {
    responseBody = JSON.stringify(data);
    return originalJson.call(this, data);
  };
  
  res.end = function(chunk) {
    if (chunk) chunks.push(chunk);
    return originalEnd.apply(this, arguments);
  };
  
  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      try {
        const responsibleNode = req.headers['x-responsible-node'] || 'api-gateway';
        const requestBody = Object.keys(req.body || {}).length > 0 
          ? JSON.stringify(req.body) 
          : null;
        
        let finalResponse = responseBody;
        if (!finalResponse && chunks.length > 0) {
          finalResponse = Buffer.concat(chunks).toString('utf8');
        }
        
        ErrorCodeService.logApiRequest(
          req.path,
          req.method,
          requestBody,
          finalResponse || null,
          responsibleNode,
          res.statusCode
        ).catch(err => console.error('审计日志记录失败:', err.message));
      } catch (e) {
        console.error('审计日志处理异常:', e.message);
      }
    }
  });
  
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/error-codes', async (req, res) => {
  try {
    const filters = {
      error_code: req.query.error_code,
      api_path: req.query.api_path,
      status: req.query.status,
      team_id: req.query.team_id
    };
    const data = await ErrorCodeService.findAll(filters);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/error-codes/:id', async (req, res) => {
  try {
    const data = await ErrorCodeService.findById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: '未找到' });
    }
    const history = await ErrorCodeService.getHistory(req.params.id);
    const mappings = await ErrorCodeService.getMappings(req.params.id);
    res.json({ success: true, data: { ...data, history, mappings } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/error-codes', async (req, res) => {
  try {
    const result = await ErrorCodeService.create(req.body, req.body.operator || 'admin');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/error-codes/:id/status', async (req, res) => {
  try {
    const result = await ErrorCodeService.updateStatus(
      req.params.id,
      req.body.status,
      req.body.operator || 'admin',
      req.body.reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/error-codes/merge', async (req, res) => {
  try {
    const result = await ErrorCodeService.mergeCodes(
      req.body.source_ids,
      req.body.target_data,
      req.body.operator || 'admin'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/error-codes/:id/mappings', async (req, res) => {
  try {
    const result = await ErrorCodeService.addMapping(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const data = await ErrorCodeService.getTeams();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const filters = {
      error_code: req.query.error_code,
      api_path: req.query.api_path,
      status: req.query.status,
      team_id: req.query.team_id
    };
    const data = await ErrorCodeService.exportAll(filters);
    
    const format = req.query.format || 'json';
    
    if (format === 'csv') {
      const flatData = data.map(item => ({
        id: item.id,
        error_code: item.error_code,
        api_path: item.api_path,
        user_message: item.user_message,
        debug_message: item.debug_message,
        troubleshooting: item.troubleshooting,
        team_name: item.team_name,
        status: item.status,
        version: item.version,
        status_explanation: item.status_explanation,
        created_at: item.created_at,
        history_count: item.history.length,
        mappings_count: item.mappings.length
      }));
      
      const parser = new Parser();
      const csv = parser.parse(flatData);
      res.header('Content-Type', 'text/csv');
      res.attachment('error-dictionary.csv');
      res.send(csv);
    } else {
      res.header('Content-Type', 'application/json');
      res.attachment('error-dictionary.json');
      res.send(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/requests', async (req, res) => {
  try {
    const data = await ErrorCodeService.getApiRequests();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`接口错误字典工作台运行在 http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务`);
});
