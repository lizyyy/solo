const express = require('express');
const { initDatabase } = require('./database');
const {
  createFile,
  getFile,
  listFiles,
  createToken,
  getToken,
  listTokens,
  revokeToken,
  validateDownload,
  getFileStats,
  getAnomalies,
  getAuditLogs,
  getTokenByTokenValue
} = require('./services');

const app = express();
app.use(express.json());

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',');
    return ips[0].trim();
  }
  return req.ip || req.connection.remoteAddress || '127.0.0.1';
}

function getDeviceInfo(req) {
  const ua = req.headers['user-agent'] || '';
  return {
    userAgent: ua,
    isMobile: /mobile|android|iphone|ipad/i.test(ua),
    platform: req.headers['sec-ch-ua-platform'] || 'unknown',
    isBot: /bot|crawler|spider/i.test(ua)
  };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/files', (req, res) => {
  try {
    const { name, url, description } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Name and URL are required' });
    }
    const file = createFile(name, url, description);
    res.status(201).json(file);
  } catch (error) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.get('/api/files', (req, res) => {
  const files = listFiles();
  res.json(files);
});

app.get('/api/files/:fileId', (req, res) => {
  const file = getFile(req.params.fileId);
  if (!file) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'File not found' });
  }
  res.json(file);
});

app.post('/api/files/:fileId/stats', (req, res) => {
  const file = getFile(req.params.fileId);
  if (!file) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'File not found' });
  }
  const stats = getFileStats(req.params.fileId);
  res.json(stats);
});

app.post('/api/tokens', (req, res) => {
  try {
    const { fileId, userId, expiresInHours, maxUses } = req.body;
    if (!fileId || !userId) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'fileId and userId are required' });
    }
    const token = createToken(
      fileId, 
      userId, 
      expiresInHours || 24, 
      maxUses || 1
    );
    res.status(201).json(token);
  } catch (error) {
    if (error.message === 'FILE_NOT_FOUND') {
      return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.get('/api/tokens', (req, res) => {
  const { fileId, userId, status } = req.query;
  const filters = {};
  if (fileId) filters.fileId = fileId;
  if (userId) filters.userId = userId;
  if (status) filters.status = status;
  
  const tokens = listTokens(filters);
  res.json(tokens);
});

app.get('/api/tokens/:tokenId', (req, res) => {
  const token = getToken(req.params.tokenId);
  if (!token) {
    return res.status(404).json({ error: 'TOKEN_NOT_FOUND', message: 'Token not found' });
  }
  res.json(token);
});

app.post('/api/tokens/:tokenId/revoke', (req, res) => {
  try {
    const token = revokeToken(req.params.tokenId);
    res.json(token);
  } catch (error) {
    if (error.message === 'TOKEN_NOT_FOUND') {
      return res.status(404).json({ error: 'TOKEN_NOT_FOUND', message: 'Token not found' });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.post('/api/download/validate', (req, res) => {
  const { token, requestId } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'MISSING_TOKEN', message: 'Token is required' });
  }

  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const deviceInfo = getDeviceInfo(req);
  const finalRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const result = validateDownload(
    token,
    clientIp,
    userAgent,
    JSON.stringify(deviceInfo),
    finalRequestId
  );

  if (!result.allowed) {
    return res.status(403).json(result);
  }

  res.json(result);
});

app.get('/api/anomalies', (req, res) => {
  const { tokenId, userId, fileId } = req.query;
  const filters = {};
  if (tokenId) filters.tokenId = tokenId;
  if (userId) filters.userId = userId;
  if (fileId) filters.fileId = fileId;

  const anomalies = getAnomalies(filters);
  const grouped = {
    byToken: {},
    byUser: {},
    byFile: {}
  };

  anomalies.forEach(a => {
    if (!grouped.byToken[a.token_id]) grouped.byToken[a.token_id] = [];
    grouped.byToken[a.token_id].push(a);
    
    if (!grouped.byUser[a.user_id]) grouped.byUser[a.user_id] = [];
    grouped.byUser[a.user_id].push(a);
    
    if (!grouped.byFile[a.file_id]) grouped.byFile[a.file_id] = [];
    grouped.byFile[a.file_id].push(a);
  });

  res.json({
    total: anomalies.length,
    anomalies,
    byPerspective: grouped
  });
});

app.get('/api/audit/logs', (req, res) => {
  const { tokenId, userId, fileId } = req.query;
  const filters = {};
  if (tokenId) filters.tokenId = tokenId;
  if (userId) filters.userId = userId;
  if (fileId) filters.fileId = fileId;

  const logs = getAuditLogs(filters);
  res.json({ total: logs.length, logs });
});

async function startServer() {
  await initDatabase();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Anti-Leech API server running on port ${PORT}`);
  });
}

startServer();
