const http = require('http');
const url = require('url');
const {
  importWaybill,
  createExceptionShipment,
  getShipmentDetail,
  getAllShipments,
  uploadEvidence,
  judgeLiability,
  calculateShipmentCompensation,
  submitForReview,
  reviewShipment,
  submitAppeal,
  processAppeal,
  completeShipment,
  manualEditShipment,
  processCallback,
  getStatistics
} = require('./services/shipmentService');
const { formatHistoryForDisplay } = require('./services/history');
const { getAllShipments: getAllShipmentsFromStore } = require('./data/store');
const { COMPENSATION_RULES, STATUS_FLOW } = require('./services/rules');

const PORT = 3000;

function parseJSON(body) {
  try {
    return body ? JSON.parse(body) : {};
  } catch (e) {
    return {};
  }
}

function getQueryParams(reqUrl) {
  const parsed = url.parse(reqUrl, true);
  return parsed.query || {};
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendHTML(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(html);
}

function sendCSV(res, csv, filename) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename=${filename}`,
    'Access-Control-Allow-Origin': '*'
  });
  res.end('\ufeff' + csv);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

function getHomePage() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>物流异常赔付 API - 文档</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; border-radius: 12px; margin-bottom: 30px; }
    h1 { font-size: 2.5em; margin-bottom: 10px; }
    .subtitle { font-size: 1.2em; opacity: 0.9; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    h2 { color: #4a5568; margin-bottom: 16px; font-size: 1.5em; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    h3 { color: #2d3748; margin: 20px 0 12px; font-size: 1.2em; }
    code { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-family: 'Consolas', monospace; color: #e11d48; }
    pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; }
    pre code { background: none; color: #a5f3fc; padding: 0; }
    .endpoint { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 12px 0; border-radius: 0 8px 8px 0; }
    .method { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 0.9em; margin-right: 12px; }
    .get { background: #dbeafe; color: #1d4ed8; }
    .post { background: #d1fae5; color: #047857; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; }
    tr:hover { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin: 2px; }
    .normal { background: #e0e7ff; color: #4338ca; }
    .vip { background: #fef3c7; color: #92400e; }
    .vip_plus { background: #fee2e2; color: #991b1b; }
    .status-flow { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    .status-node { background: #e0f2fe; color: #0369a1; padding: 8px 16px; border-radius: 20px; font-size: 0.9em; }
    .arrow { color: #94a3b8; }
    .quick-start { background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 16px 0; }
    .warning { background: #fffbeb; border: 1px solid #fcd34d; padding: 20px; border-radius: 8px; margin: 16px 0; }
    ul { margin: 12px 0 12px 24px; }
    li { margin: 6px 0; }
    .links { display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap; }
    .link-btn { background: white; border: 1px solid #e2e8f0; padding: 12px 24px; border-radius: 8px; text-decoration: none; color: #4a5568; transition: all 0.2s; }
    .link-btn:hover { border-color: #3b82f6; color: #3b82f6; transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚚 物流异常赔付 API</h1>
      <p class="subtitle">Logistics Compensation API - 完整的物流异常件赔付处理系统</p>
    </header>

    <div class="card">
      <h2>📋 快速开始</h2>
      <div class="quick-start">
        <h3>1. 查看演示数据</h3>
        <p>先运行演示脚本生成样例数据：</p>
        <pre><code>npm test</code></pre>
        
        <h3>2. 启动服务器</h3>
        <pre><code>npm start
# 或开发模式
npm run dev</code></pre>

        <h3>3. 查看统计数据</h3>
        <pre><code>curl http://localhost:3000/api/shipments/statistics</code></pre>
      </div>

      <div class="links">
        <a href="/api/shipments/statistics" class="link-btn">📊 查看统计</a>
        <a href="/api/shipments" class="link-btn">📦 异常件列表</a>
        <a href="/api/reports/summary" class="link-btn">📈 汇总报告</a>
        <a href="/api/reports/rules" class="link-btn">📋 规则配置</a>
      </div>
    </div>

    <div class="card">
      <h2>🎯 核心功能</h2>
      <table>
        <tr><th>功能模块</th><th>描述</th></tr>
        <tr><td>运单导入</td><td>批量导入运单信息，包含轨迹数据</td></tr>
        <tr><td>异常登记</td><td>登记延误、破损、丢件三种异常类型</td></tr>
        <tr><td>证据上传</td><td>上传照片、视频等证据材料</td></tr>
        <tr><td>责任判定</td><td>判定承运商责任，支持待确认状态</td></tr>
        <tr><td>赔付计算</td><td>按客户等级和异常类型自动计算</td></tr>
        <tr><td>审核流程</td><td>提交审核、审核通过/驳回</td></tr>
        <tr><td>申诉流程</td><td>客户申诉、申诉处理、改判</td></tr>
        <tr><td>报告导出</td><td>JSON/CSV 格式导出</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>📊 赔付规则</h2>
      <h3>客户等级</h3>
      <div>
        <span class="badge normal">normal 普通客户</span>
        <span class="badge vip">vip VIP 客户</span>
        <span class="badge vip_plus">vip_plus VIP+ 客户</span>
      </div>
      
      <h3>异常类型</h3>
      <table>
        <tr><th>类型</th><th>普通客户</th><th>VIP 客户</th><th>VIP+ 客户</th></tr>
        <tr><td>延误</td><td>20元/天，上限500元</td><td>30元/天，上限1000元</td><td>50元/天，上限2000元</td></tr>
        <tr><td>破损</td><td>保价30%，上限1000元</td><td>保价50%，上限2000元</td><td>保价70%，上限3000元</td></tr>
        <tr><td>丢件</td><td>全额赔付，上限2000元</td><td>全额赔付，上限5000元</td><td>全额赔付，上限10000元</td></tr>
      </table>

      <h3>特殊规则</h3>
      <ul>
        <li><strong>不可抗力</strong>：台风、暴雨、疫情等原因延误，不予赔付</li>
        <li><strong>证据不足</strong>：破损需要至少 2 张有效证据</li>
        <li><strong>责任前置</strong>：丢件必须先确认承运商责任</li>
        <li><strong>重复申诉</strong>：7 天内最多申诉 2 次，且不能有待处理申诉</li>
      </ul>
    </div>

    <div class="card">
      <h2>🔄 状态流转</h2>
      <div class="status-flow">
        <span class="status-node">created</span><span class="arrow">→</span>
        <span class="status-node">awaiting_evidence</span><span class="arrow">→</span>
        <span class="status-node">pending_liability</span><span class="arrow">→</span>
        <span class="status-node">liability_confirmed</span><span class="arrow">→</span>
        <span class="status-node">compensation_calculated</span><span class="arrow">→</span>
        <span class="status-node">pending_review</span><span class="arrow">→</span>
        <span class="status-node">review_approved</span><span class="arrow">→</span>
        <span class="status-node">completed</span>
      </div>
    </div>

    <div class="card">
      <h2>🔌 API 端点</h2>

      <h3>运单管理</h3>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/waybills/import</code> - 批量导入运单
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/waybills</code> - 获取所有运单
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/waybills/:waybillId</code> - 获取单个运单
      </div>

      <h3>异常件管理</h3>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments</code> - 创建异常件
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/shipments</code> - 获取异常件列表（支持筛选）
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/shipments/statistics</code> - 获取统计数据
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/shipments/:shipmentId</code> - 获取异常件详情
      </div>

      <h3>流程推进</h3>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/evidence</code> - 上传证据
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/liability</code> - 责任判定
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/calculate</code> - 赔付计算
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/review/submit</code> - 提交审核
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/review</code> - 审核处理
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/appeal</code> - 提交申诉
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/appeal/process</code> - 处理申诉
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/complete</code> - 结案
      </div>

      <h3>特殊功能</h3>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/edit</code> - 人工修正
      </div>
      <div class="endpoint">
        <span class="method post">POST</span><code>/api/shipments/:shipmentId/callback</code> - 承运商回调（幂等）
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/shipments/:shipmentId/history</code> - 操作历史
      </div>

      <h3>报告导出</h3>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/reports/summary</code> - 汇总报告
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/reports/rules</code> - 规则配置
      </div>
      <div class="endpoint">
        <span class="method get">GET</span><code>/api/reports/export?format=json|csv</code> - 导出数据
      </div>
    </div>

    <div class="card">
      <h2>💡 使用示例</h2>
      <h3>创建异常件</h3>
      <pre><code>curl -X POST http://localhost:3000/api/shipments \\
  -H "Content-Type: application/json" \\
  -d '{
    "waybillId": "SF1001234567890",
    "type": "delay",
    "description": "快件延误3天未送达",
    "customerLevel": "normal",
    "operator": "客服小王"
  }'</code></pre>

      <h3>赔付计算</h3>
      <pre><code>curl -X POST "http://localhost:3000/api/shipments/SH000001/calculate?operator=理赔专员"</code></pre>

      <h3>导出 CSV</h3>
      <pre><code>curl "http://localhost:3000/api/reports/export?format=csv" -o report.csv</code></pre>
    </div>

    <div class="card">
      <h2>⚠️ 注意事项</h2>
      <div class="warning">
        <ul>
          <li><strong>幂等性</strong>：回调接口支持 <code>idempotencyKey</code> 参数，重复调用返回相同结果</li>
          <li><strong>人工修正</strong>：所有人工修改都会记录前后差异和操作者</li>
          <li><strong>历史追踪</strong>：每一步操作都会记录到历史日志</li>
          <li><strong>内存存储</strong>：当前为内存存储，重启服务数据会清空（演示用）</li>
        </ul>
      </div>
    </div>

    <footer style="text-align: center; padding: 20px; color: #6b7280;">
      <p>物流异常赔付 API v1.0.0 | 端口: ${PORT}</p>
    </footer>
  </div>
</body>
</html>
  `;
}

async function handleRequest(req, res) {
  const method = req.method;
  const reqUrl = req.url;
  const parsedUrl = url.parse(reqUrl, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  if (pathname === '/' || pathname === '') {
    sendHTML(res, getHomePage());
    return;
  }
  
  if (pathname === '/health') {
    sendJSON(res, 200, {
      status: 'ok',
      service: '物流异常赔付 API',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  let body = '';
  if (method === 'POST' || method === 'PUT') {
    body = await readBody(req);
  }
  const data = parseJSON(body);
  
  if (pathname.startsWith('/api/waybills')) {
    if (pathname === '/api/waybills/import' && method === 'POST') {
      const { waybills } = data;
      if (!waybills || !Array.isArray(waybills)) {
        sendJSON(res, 400, { success: false, error: '缺少 waybills 数组' });
        return;
      }
      const results = waybills.map(wb => importWaybill(wb));
      sendJSON(res, 200, {
        success: true,
        total: waybills.length,
        successCount: results.filter(r => r.success).length,
        failedCount: results.length - results.filter(r => r.success).length,
        results
      });
      return;
    }
    if (pathname === '/api/waybills' && method === 'GET') {
      const waybills = getAllShipmentsFromStore ? getAllShipmentsFromStore() : [];
      const { getAllWaybills } = require('./data/store');
      sendJSON(res, 200, { success: true, data: getAllWaybills() });
      return;
    }
    const waybillMatch = pathname.match(/^\/api\/waybills\/([^/]+)$/);
    if (waybillMatch && method === 'GET') {
      const { getWaybill } = require('./data/store');
      const waybill = getWaybill(waybillMatch[1]);
      if (!waybill) {
        sendJSON(res, 404, { success: false, error: '运单不存在' });
        return;
      }
      sendJSON(res, 200, { success: true, data: waybill });
      return;
    }
  }
  
  if (pathname.startsWith('/api/shipments')) {
    if (pathname === '/api/shipments' && method === 'POST') {
      const result = createExceptionShipment(data);
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    if (pathname === '/api/shipments' && method === 'GET') {
      const filters = {
        status: query.status,
        type: query.type,
        customerLevel: query.customerLevel,
        waybillId: query.waybillId
      };
      const shipments = getAllShipments(filters);
      sendJSON(res, 200, { success: true, data: shipments, filters });
      return;
    }
    if (pathname === '/api/shipments/statistics' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: getStatistics() });
      return;
    }
    
    const shipmentMatch = pathname.match(/^\/api\/shipments\/([^/]+)$/);
    if (shipmentMatch && method === 'GET') {
      const detail = getShipmentDetail(shipmentMatch[1]);
      if (!detail) {
        sendJSON(res, 404, { success: false, error: '异常件不存在' });
        return;
      }
      sendJSON(res, 200, {
        success: true,
        data: {
          shipment: detail.shipment,
          waybill: detail.waybill,
          trackingSummary: detail.trackingSummary,
          evidences: detail.evidences,
          liability: detail.liability,
          compensation: detail.compensation,
          latestReview: detail.latestReview,
          latestAppeal: detail.latestAppeal,
          history: formatHistoryForDisplay(detail.history),
          nextPossibleStatuses: detail.nextPossibleStatuses
        }
      });
      return;
    }
    
    const evidenceMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/evidence$/);
    if (evidenceMatch && method === 'POST') {
      const result = uploadEvidence(evidenceMatch[1], data, query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const liabilityMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/liability$/);
    if (liabilityMatch && method === 'POST') {
      const result = judgeLiability(liabilityMatch[1], data, query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const calcMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/calculate$/);
    if (calcMatch && method === 'POST') {
      const result = calculateShipmentCompensation(calcMatch[1], query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const reviewSubmitMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/review\/submit$/);
    if (reviewSubmitMatch && method === 'POST') {
      const result = submitForReview(reviewSubmitMatch[1], query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const reviewMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/review$/);
    if (reviewMatch && method === 'POST') {
      const result = reviewShipment(reviewMatch[1], data, query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const appealMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/appeal$/);
    if (appealMatch && method === 'POST') {
      const result = submitAppeal(appealMatch[1], data, query.operator || 'customer');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const appealProcessMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/appeal\/process$/);
    if (appealProcessMatch && method === 'POST') {
      const result = processAppeal(appealProcessMatch[1], data, query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const completeMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/complete$/);
    if (completeMatch && method === 'POST') {
      const result = completeShipment(completeMatch[1], query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const editMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/edit$/);
    if (editMatch && method === 'POST') {
      const { changes, reason } = data;
      if (!changes) {
        sendJSON(res, 400, { success: false, error: '缺少 changes 字段' });
        return;
      }
      const result = manualEditShipment(editMatch[1], changes, reason || '', query.operator || 'system');
      sendJSON(res, result.success ? 200 : 400, result);
      return;
    }
    
    const callbackMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/callback$/);
    if (callbackMatch && method === 'POST') {
      const result = processCallback(callbackMatch[1], data);
      sendJSON(res, (!result.success && !result.idempotent) ? 400 : 200, result);
      return;
    }
    
    const historyMatch = pathname.match(/^\/api\/shipments\/([^/]+)\/history$/);
    if (historyMatch && method === 'GET') {
      const detail = getShipmentDetail(historyMatch[1]);
      if (!detail) {
        sendJSON(res, 404, { success: false, error: '异常件不存在' });
        return;
      }
      sendJSON(res, 200, { success: true, data: formatHistoryForDisplay(detail.history) });
      return;
    }
  }
  
  if (pathname.startsWith('/api/reports')) {
    if (pathname === '/api/reports/summary' && method === 'GET') {
      const stats = getStatistics();
      const shipments = getAllShipments();
      const summary = {
        generatedAt: new Date().toISOString(),
        statistics: stats,
        byCustomerLevel: {},
        byType: {},
        byStatus: stats.statusCounts
      };
      shipments.forEach(s => {
        if (!summary.byCustomerLevel[s.customerLevel]) {
          summary.byCustomerLevel[s.customerLevel] = { count: 0, statuses: {} };
        }
        summary.byCustomerLevel[s.customerLevel].count++;
        summary.byCustomerLevel[s.customerLevel].statuses[s.status] = 
          (summary.byCustomerLevel[s.customerLevel].statuses[s.status] || 0) + 1;
        if (!summary.byType[s.type]) {
          summary.byType[s.type] = { count: 0, statuses: {} };
        }
        summary.byType[s.type].count++;
        summary.byType[s.type].statuses[s.status] = 
          (summary.byType[s.type].statuses[s.status] || 0) + 1;
      });
      sendJSON(res, 200, { success: true, data: summary });
      return;
    }
    if (pathname === '/api/reports/rules' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: { compensationRules: COMPENSATION_RULES, statusFlow: STATUS_FLOW } });
      return;
    }
    if (pathname === '/api/reports/export' && method === 'GET') {
      const { format = 'json', status, type, customerLevel } = query;
      const filters = { status, type, customerLevel };
      const shipments = getAllShipments(filters);
      const detailedShipments = shipments.map(s => {
        const detail = getShipmentDetail(s.shipmentId);
        return {
          shipmentId: s.shipmentId,
          waybillId: s.waybillId,
          customerName: s.customerName,
          customerLevel: s.customerLevel,
          type: s.type,
          status: s.status,
          statusReason: s.statusReason,
          carrier: s.carrier,
          insuredAmount: s.insuredAmount,
          trackingSummary: detail?.trackingSummary,
          compensation: detail?.compensation ? {
            amount: detail.compensation.calculatedAmount,
            status: detail.compensation.status,
            calculation: detail.compensation.calculation
          } : null,
          liability: detail?.liability ? {
            status: detail.liability.status,
            responsibleParty: detail.liability.responsibleParty
          } : null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        };
      });
      
      if (format === 'csv') {
        const headers = [
          '异常件ID', '运单号', '客户名称', '客户等级', '异常类型',
          '当前状态', '状态原因', '承运商', '保价金额',
          '赔付金额', '赔付状态', '责任方', '创建时间', '更新时间'
        ];
        const rows = detailedShipments.map(s => [
          s.shipmentId, s.waybillId, s.customerName, s.customerLevel, s.type,
          s.status, s.statusReason || '', s.carrier, s.insuredAmount,
          s.compensation?.amount || 0, s.compensation?.status || '',
          s.liability?.responsibleParty || '', s.createdAt, s.updatedAt
        ]);
        const csv = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        sendCSV(res, csv, `logistics-report-${Date.now()}.csv`);
      } else {
        sendJSON(res, 200, {
          success: true,
          data: {
            generatedAt: new Date().toISOString(),
            count: detailedShipments.length,
            filters,
            shipments: detailedShipments
          }
        });
      }
      return;
    }
  }
  
  sendJSON(res, 404, { success: false, error: '接口不存在', path: pathname });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('Server error:', err);
    sendJSON(res, 500, { success: false, error: '服务器内部错误', message: err.message });
  });
});

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  🚚 物流异常赔付 API 已启动');
  console.log('  Logistics Compensation API');
  console.log('='.repeat(60));
  console.log(`\n  📡 服务地址: http://localhost:${PORT}`);
  console.log(`  📖 文档地址: http://localhost:${PORT}/`);
  console.log(`  ❤️  健康检查: http://localhost:${PORT}/health`);
  console.log('\n' + '='.repeat(60));
  console.log('\n  💡 快捷链接:');
  console.log('     - 统计数据: GET /api/shipments/statistics');
  console.log('     - 异常件列表: GET /api/shipments');
  console.log('     - 汇总报告: GET /api/reports/summary');
  console.log('     - 导出数据: GET /api/reports/export?format=csv');
  console.log('\n  🔧 运行演示: npm test');
  console.log('\n' + '='.repeat(60) + '\n');
});
