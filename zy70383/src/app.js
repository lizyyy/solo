const http = require('http');
const url = require('url');
const subService = require('./services/subscriptionService');
const deliveryService = require('./services/deliveryService');

const PORT = 3000;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  try {
    if (pathname === '/api/events' && method === 'GET') {
      const customerId = parsedUrl.query.customerId;
      if (!customerId) {
        return sendJSON(res, 400, { success: false, error: '缺少 customerId 参数' });
      }
      const result = subService.getEventDirectory(customerId);
      sendJSON(res, 200, { success: true, data: result });
    }
    
    else if (pathname === '/api/subscriptions' && method === 'POST') {
      const body = await parseBody(req);
      const { customerId, eventId, callbackUrl, tenants } = body;
      
      if (!customerId || !eventId || !callbackUrl || !tenants) {
        return sendJSON(res, 400, {
          success: false,
          error: '缺少必要参数: customerId, eventId, callbackUrl, tenants'
        });
      }
      
      const result = subService.createSubscription(customerId, eventId, callbackUrl, tenants);
      const statusCode = result.success ? 201 : 403;
      sendJSON(res, statusCode, result);
    }
    
    else if (pathname === '/api/subscriptions/verify' && method === 'POST') {
      const body = await parseBody(req);
      const { customerId, eventId, token } = body;
      
      if (!customerId || !eventId || !token) {
        return sendJSON(res, 400, {
          success: false,
          error: '缺少必要参数: customerId, eventId, token'
        });
      }
      
      const result = subService.verifySubscription(customerId, eventId, token);
      const statusCode = result.success ? 200 : 400;
      sendJSON(res, statusCode, result);
    }
    
    else if (pathname === '/api/subscriptions/pause' && method === 'POST') {
      const body = await parseBody(req);
      const { customerId, eventId, reason } = body;
      
      if (!customerId || !eventId) {
        return sendJSON(res, 400, {
          success: false,
          error: '缺少必要参数: customerId, eventId'
        });
      }
      
      const result = subService.pauseSubscription(customerId, eventId, reason);
      const statusCode = result.success ? 200 : 400;
      sendJSON(res, statusCode, result);
    }
    
    else if (pathname === '/api/subscriptions/resume' && method === 'POST') {
      const body = await parseBody(req);
      const { customerId, eventId, reason } = body;
      
      if (!customerId || !eventId) {
        return sendJSON(res, 400, {
          success: false,
          error: '缺少必要参数: customerId, eventId'
        });
      }
      
      const result = subService.resumeSubscription(customerId, eventId, reason);
      const statusCode = result.success ? 200 : 400;
      sendJSON(res, statusCode, result);
    }
    
    else if (pathname === '/api/subscriptions' && method === 'GET') {
      const customerId = parsedUrl.query.customerId;
      if (!customerId) {
        return sendJSON(res, 400, { success: false, error: '缺少 customerId 参数' });
      }
      const subs = subService.getCustomerSubscriptions(customerId);
      sendJSON(res, 200, { success: true, data: subs });
    }
    
    else if (pathname === '/api/subscriptions/failure-explain' && method === 'GET') {
      const customerId = parsedUrl.query.customerId;
      const eventId = parsedUrl.query.eventId;
      if (!customerId || !eventId) {
        return sendJSON(res, 400, { success: false, error: '缺少 customerId 或 eventId 参数' });
      }
      const result = subService.explainSubscriptionFailure(customerId, eventId);
      sendJSON(res, 200, { success: true, data: result });
    }
    
    else if (pathname === '/api/stats' && method === 'GET') {
      const customerId = parsedUrl.query.customerId;
      const subscriptionId = parsedUrl.query.subscriptionId;
      
      if (subscriptionId) {
        const stats = subService.getDeliveryStats(subscriptionId);
        if (!stats) {
          return sendJSON(res, 404, { success: false, error: '未找到该订阅的投递统计' });
        }
        sendJSON(res, 200, { success: true, data: stats });
      } else if (customerId) {
        const stats = subService.getCustomerDeliveryStats(customerId);
        sendJSON(res, 200, { success: true, data: stats });
      } else {
        sendJSON(res, 400, { success: false, error: '缺少 customerId 或 subscriptionId 参数' });
      }
    }
    
    else if (pathname === '/api/test-trigger' && method === 'POST') {
      const body = await parseBody(req);
      const { eventId, tenantId, eventData } = body;
      
      if (!eventId || !tenantId) {
        return sendJSON(res, 400, {
          success: false,
          error: '缺少必要参数: eventId, tenantId'
        });
      }
      
      const results = deliveryService.simulateEventTriggerWithPaused(eventId, tenantId, eventData || {});
      sendJSON(res, 200, { success: true, data: results });
    }
    
    else {
      sendJSON(res, 404, { success: false, error: '路由不存在', pathname, method });
    }
  } catch (err) {
    sendJSON(res, 500, { success: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`事件订阅权限 API 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('=== 可用 API 端点 ===');
  console.log('GET  /api/events?customerId=xxx          - 获取事件目录（含权限和订阅状态）');
  console.log('POST /api/subscriptions                   - 创建订阅申请');
  console.log('POST /api/subscriptions/verify            - 验证回调');
  console.log('POST /api/subscriptions/pause             - 暂停订阅');
  console.log('POST /api/subscriptions/resume            - 恢复订阅');
  console.log('GET  /api/subscriptions?customerId=xxx    - 查看客户所有订阅');
  console.log('GET  /api/subscriptions/failure-explain   - 解释订阅失败原因');
  console.log('GET  /api/stats?customerId=xxx            - 查看投递统计');
  console.log('POST /api/test-trigger                    - 模拟事件触发（用于测试）');
  console.log('');
  console.log('=== 测试客户数据 ===');
  console.log('cust_001 - basic套餐     - 允许租户: tenant_a');
  console.log('cust_002 - pro套餐       - 允许租户: tenant_a, tenant_b');
  console.log('cust_003 - enterprise套餐 - 允许租户: tenant_a, tenant_b, tenant_c');
  console.log('cust_004 - enterprise套餐 - 允许租户: tenant_a, tenant_c');
  console.log('');
  console.log('=== 事件权限 ===');
  console.log('order.created, order.paid          - 所有套餐');
  console.log('order.cancelled, refund.*          - pro, enterprise');
  console.log('member.*                           - 仅 enterprise');
});
