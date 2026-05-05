const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const OriginServer = require('./simulators/origin');
const CacheProxy = require('./simulators/cache');
const Client = require('./simulators/client');
const seedScenarios = require('./scenarios/seeds');
const { generateMarkdownReport, generateJSONReport } = require('./utils/reporter');
const { validateRequest, validateResource } = require('./utils/validator');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 模拟实例存储（每个会话一个实例）
const sessions = new Map();

// 创建新会话
function createSession() {
  const originServer = new OriginServer();
  const cacheProxy = new CacheProxy(originServer);
  const client = new Client(cacheProxy);
  
  return {
    id: uuidv4(),
    originServer,
    cacheProxy,
    client,
    history: [],
    createdAt: Date.now()
  };
}

// 获取或创建会话
function getSession(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    const session = createSession();
    sessions.set(session.id, session);
    return session;
  }
  return sessions.get(sessionId);
}

// API 路由

// 创建新会话
app.post('/api/sessions', (req, res) => {
  const session = createSession();
  res.json({
    success: true,
    sessionId: session.id,
    createdAt: session.createdAt
  });
});

// 获取会话信息
app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  res.json({
    success: true,
    sessionId: session.id,
    createdAt: session.createdAt,
    history: session.history.length
  });
});

// 配置资源
app.post('/api/sessions/:sessionId/resources', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const resources = req.body.resources || [];
  const errors = [];
  const addedResources = [];

  for (const resource of resources) {
    const validation = validateResource(resource);
    if (!validation.valid) {
      errors.push({
        resource: resource.path,
        errors: validation.errors
      });
      continue;
    }

    // 设置默认值
    const defaultResource = {
      path: resource.path,
      body: resource.body || 'Default content',
      contentType: resource.contentType || 'text/plain',
      etag: resource.etag || `"${uuidv4().substring(0, 12)}"`,
      lastModified: resource.lastModified || new Date().toUTCString(),
      cacheControl: resource.cacheControl || 'public, max-age=3600',
      vary: resource.vary || '',
      redirect: resource.redirect || null
    };

    session.originServer.addResource(defaultResource);
    addedResources.push(defaultResource);
  }

  res.json({
    success: true,
    added: addedResources.length,
    errors,
    resources: addedResources
  });
});

// 获取所有资源
app.get('/api/sessions/:sessionId/resources', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const resources = [];
  for (const [path, resource] of session.originServer.resources) {
    resources.push({
      path: resource.path,
      body: resource.body,
      contentType: resource.contentType,
      etag: resource.etag,
      lastModified: resource.lastModified,
      cacheControl: resource.cacheControl,
      vary: resource.vary,
      redirect: resource.redirect
    });
  }

  res.json({
    success: true,
    resources
  });
});

// 执行请求演练
app.post('/api/sessions/:sessionId/execute', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const request = req.body.request;
  const validation = validateRequest(request);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      validationErrors: validation.errors
    });
  }

  // 清除之前的请求追踪
  session.client.clearRequests();
  session.cacheProxy.clearRequests();
  session.originServer.clearRequests();

  // 准备请求
  const executeRequest = {
    method: request.method || 'GET',
    url: request.url || '/',
    headers: request.headers || {},
    body: request.body || '',
    corsConfig: request.corsConfig || { enabled: true }
  };

  // 执行请求
  const startTime = Date.now();
  const response = session.client.handleRequest(executeRequest);
  const endTime = Date.now();

  // 获取完整追踪
  const fullTrace = session.client.getFullTrace();
  const cacheStatus = session.cacheProxy.getCacheStatus();

  // 保存到历史
  const historyEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    request: executeRequest,
    response: {
      statusCode: response.statusCode,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body
    },
    trace: fullTrace,
    cacheStatus,
    duration: endTime - startTime
  };

  session.history.push(historyEntry);

  res.json({
    success: true,
    result: {
      response: {
        statusCode: response.statusCode,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body
      },
      trace: fullTrace,
      cacheStatus,
      duration: endTime - startTime
    },
    historyId: historyEntry.id
  });
});

// 获取历史记录
app.get('/api/sessions/:sessionId/history', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  res.json({
    success: true,
    history: session.history.map(h => ({
      id: h.id,
      timestamp: h.timestamp,
      request: {
        method: h.request.method,
        url: h.request.url
      },
      response: {
        statusCode: h.response.statusCode,
        statusText: h.response.statusText
      },
      duration: h.duration
    }))
  });
});

// 获取单个历史记录详情
app.get('/api/sessions/:sessionId/history/:historyId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const historyEntry = session.history.find(h => h.id === req.params.historyId);
  if (!historyEntry) {
    return res.status(404).json({
      success: false,
      error: 'History entry not found'
    });
  }

  res.json({
    success: true,
    entry: historyEntry
  });
});

// 清除缓存
app.post('/api/sessions/:sessionId/cache/clear', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  session.cacheProxy.clearCache();
  
  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
});

// 获取缓存状态
app.get('/api/sessions/:sessionId/cache', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const cacheStatus = session.cacheProxy.getCacheStatus();
  
  res.json({
    success: true,
    cacheStatus
  });
});

// 获取 seed 场景
app.get('/api/scenarios', (req, res) => {
  res.json({
    success: true,
    scenarios: seedScenarios
  });
});

// 加载 seed 场景
app.post('/api/sessions/:sessionId/scenarios/:scenarioId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const scenarioId = req.params.scenarioId;
  const scenario = seedScenarios.find(s => s.id === scenarioId);
  
  if (!scenario) {
    return res.status(404).json({
      success: false,
      error: 'Scenario not found'
    });
  }

  // 清除现有资源和缓存
  session.cacheProxy.clearCache();
  
  // 添加场景资源
  for (const resource of scenario.resources) {
    session.originServer.addResource(resource);
  }

  res.json({
    success: true,
    scenario: {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      resources: scenario.resources,
      testRequests: scenario.testRequests
    }
  });
});

// 导出 Markdown 报告
app.get('/api/sessions/:sessionId/history/:historyId/export/markdown', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const historyEntry = session.history.find(h => h.id === req.params.historyId);
  if (!historyEntry) {
    return res.status(404).json({
      success: false,
      error: 'History entry not found'
    });
  }

  const markdown = generateMarkdownReport(historyEntry);
  
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="http-debug-report-${historyEntry.id}.md"`);
  res.send(markdown);
});

// 导出 JSON 报告
app.get('/api/sessions/:sessionId/history/:historyId/export/json', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  const historyEntry = session.history.find(h => h.id === req.params.historyId);
  if (!historyEntry) {
    return res.status(404).json({
      success: false,
      error: 'History entry not found'
    });
  }

  const jsonReport = generateJSONReport(historyEntry);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="http-debug-report-${historyEntry.id}.json"`);
  res.json(jsonReport);
});

// 获取参数验证提示
app.get('/api/validation/hints', (req, res) => {
  res.json({
    success: true,
    hints: {
      request: [
        { field: 'method', hint: '支持 GET, HEAD, POST, PUT, DELETE, OPTIONS', required: true },
        { field: 'url', hint: '请求 URL，如 /api/resource', required: true },
        { field: 'headers', hint: '请求头对象，如 { "Cache-Control": "no-cache" }', required: false },
        { field: 'body', hint: '请求体内容', required: false },
        { field: 'corsConfig', hint: 'CORS 配置，如 { enabled: true, allowOrigin: "*" }', required: false }
      ],
      resource: [
        { field: 'path', hint: '资源路径，如 /images/logo.png', required: true },
        { field: 'body', hint: '资源内容', required: false, default: 'Default content' },
        { field: 'contentType', hint: '内容类型，如 text/html, application/json', required: false, default: 'text/plain' },
        { field: 'etag', hint: 'ETag 值，如 "abc123"', required: false, default: '自动生成' },
        { field: 'lastModified', hint: '最后修改时间，如 Wed, 21 Oct 2015 07:28:00 GMT', required: false, default: '当前时间' },
        { field: 'cacheControl', hint: 'Cache-Control 头，如 public, max-age=3600', required: false, default: 'public, max-age=3600' },
        { field: 'vary', hint: 'Vary 头，如 Accept-Encoding', required: false, default: '空' },
        { field: 'redirect', hint: '重定向配置，如 { statusCode: 301, location: "/new-path" }', required: false }
      ],
      commonErrors: [
        { error: 'ETag 格式错误', hint: 'ETag 应该用双引号包裹，如 "abc123" 或 W/"abc123"' },
        { error: 'Cache-Control 语法错误', hint: '常见指令: public, private, no-cache, no-store, max-age=N, s-maxage=N, must-revalidate, proxy-revalidate' },
        { error: 'Range 请求格式错误', hint: '正确格式: bytes=0-99, bytes=-500, bytes=9500-' },
        { error: '重定向状态码错误', hint: '支持的重定向状态码: 301, 302, 303, 307, 308' }
      ]
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`HTTP Sandbox Server running on http://localhost:${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/`);
});

module.exports = app;
