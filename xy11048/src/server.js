const http = require('http');
const { ApprovalError } = require('./utils/errors');
const approvalService = require('./services/ApprovalService');
const store = require('./data/store');
const { seedAll } = require('./data/seed');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

function handleError(res, error) {
  if (error instanceof ApprovalError) {
    sendResponse(res, 400, error.toJSON());
  } else {
    console.error('Server Error:', error);
    sendResponse(res, 500, {
      error: {
        message: '服务器内部错误',
        code: 'INTERNAL_ERROR',
        details: error.message,
        timestamp: new Date().toISOString(),
        resolution: '请稍后重试或联系系统管理员'
      }
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendResponse(res, 200, {});
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    if (path === '/health' && method === 'GET') {
      sendResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    if (path === '/api/reagents' && method === 'GET') {
      sendResponse(res, 200, { data: store.getAllReagents() });
      return;
    }

    if (path === '/api/reagents' && method === 'POST') {
      const body = await parseBody(req);
      const Reagent = require('./models/Reagent');
      const reagent = new Reagent({ ...body, id: `reag_${Date.now()}` });
      store.addReagent(reagent);
      sendResponse(res, 201, { data: reagent });
      return;
    }

    if (path.startsWith('/api/requests') && method === 'GET') {
      const id = path.split('/')[3];
      if (id) {
        const request = approvalService.getRequest(id);
        if (!request) {
          throw new ApprovalError('申请不存在', 'NOT_FOUND', { requestId: id });
        }
        sendResponse(res, 200, { data: request });
      } else {
        const filters = {
          state: url.searchParams.get('state'),
          applicantId: url.searchParams.get('applicantId'),
          labId: url.searchParams.get('labId')
        };
        sendResponse(res, 200, { data: approvalService.getAllRequests(filters) });
      }
      return;
    }

    if (path === '/api/requests' && method === 'POST') {
      const body = await parseBody(req);
      const request = approvalService.createRequest(body);
      sendResponse(res, 201, { 
        data: request,
        message: '申请创建成功，请检查必填信息后提交'
      });
      return;
    }

    if (path.match(/^\/api\/requests\/[^/]+\/submit$/) && method === 'POST') {
      const requestId = path.split('/')[3];
      const body = await parseBody(req);
      const request = approvalService.submitRequest(requestId, body.etag);
      sendResponse(res, 200, {
        data: request,
        message: request.secondReviewRequired 
          ? '申请已提交，危化试剂需要二审，请等待高级安全管理员审批'
          : '申请已提交，请等待实验室管理员审批'
      });
      return;
    }

    if (path.match(/^\/api\/requests\/[^/]+\/lab-manager-approve$/) && method === 'POST') {
      const requestId = path.split('/')[3];
      const body = await parseBody(req);
      const request = approvalService.labManagerApprove(
        requestId, 
        body.approverId, 
        body.approverName, 
        body.comments
      );
      sendResponse(res, 200, {
        data: request,
        message: '实验室管理员审批通过，请等待安全员审核'
      });
      return;
    }

    if (path.match(/^\/api\/requests\/[^/]+\/safety-review$/) && method === 'POST') {
      const requestId = path.split('/')[3];
      const body = await parseBody(req);
      const request = approvalService.safetyOfficerReview(
        requestId, 
        body.approverId, 
        body.approverName, 
        body.comments
      );
      sendResponse(res, 200, {
        data: request,
        message: request.currentState === 'pending_second_review'
          ? '需要二次审批，请联系高级安全管理员'
          : '安全审核通过，请等待审计检查'
      });
      return;
    }

    if (path.match(/^\/api\/requests\/[^/]+\/second-review$/) && method === 'POST') {
      const requestId = path.split('/')[3];
      const body = await parseBody(req);
      const request = approvalService.secondReviewApprove(
        requestId, 
        body.approverId, 
        body.approverName, 
        body.comments
      );
      sendResponse(res, 200, {
        data: request,
        message: '二次审批通过，申请已完成'
      });
      return;
    }

    if (path.match(/^\/api\/requests\/[^/]+\/audit-check$/) && method === 'POST') {
      const requestId = path.split('/')[3];
      const body = await parseBody(req);
      const request = approvalService.auditCheck(
        requestId, 
        body.auditorId, 
        body.auditorName, 
        body.actualInventory || {}
      );
      sendResponse(res, 200, {
        data: request,
        message: '审计一致性检查通过，申请已批准'
      });
      return;
    }

    if (path.match(/^\/api\/requests\/[^/]+\/reject$/) && method === 'POST') {
      const requestId = path.split('/')[3];
      const body = await parseBody(req);
      const request = approvalService.reject(
        requestId, 
        body.approverId, 
        body.approverName, 
        body.role, 
        body.reason
      );
      sendResponse(res, 200, {
        data: request,
        message: '申请已驳回'
      });
      return;
    }

    if (path === '/api/users' && method === 'GET') {
      sendResponse(res, 200, { data: store.getAllUsers() });
      return;
    }

    if (path === '/api/laboratories' && method === 'GET') {
      sendResponse(res, 200, { data: store.getAllLaboratories() });
      return;
    }

    if (path === '/api/stats' && method === 'GET') {
      const requests = store.getAllApprovalRequests();
      const stats = {
        total: requests.length,
        byState: {},
        byLab: {}
      };
      requests.forEach(r => {
        stats.byState[r.currentState] = (stats.byState[r.currentState] || 0) + 1;
        stats.byLab[r.labName] = (stats.byLab[r.labName] || 0) + 1;
      });
      sendResponse(res, 200, { data: stats });
      return;
    }

    sendResponse(res, 404, { error: { message: '接口不存在', code: 'NOT_FOUND' } });

  } catch (error) {
    handleError(res, error);
  }
});

const PORT = process.env.PORT || 3000;

seedAll();

server.listen(PORT, () => {
  console.log(`\n高校实验室试剂领用审批 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`\n可用接口:`);
  console.log(`  GET  /health                  - 健康检查`);
  console.log(`  GET  /api/reagents            - 获取试剂列表`);
  console.log(`  GET  /api/requests            - 获取申请列表`);
  console.log(`  POST /api/requests            - 创建申请`);
  console.log(`  POST /api/requests/:id/submit - 提交申请`);
  console.log(`  POST /api/requests/:id/lab-manager-approve - 实验室主任审批`);
  console.log(`  POST /api/requests/:id/safety-review - 安全员审核`);
  console.log(`  POST /api/requests/:id/second-review - 二次审批`);
  console.log(`  POST /api/requests/:id/audit-check - 审计检查`);
  console.log(`  POST /api/requests/:id/reject - 驳回申请`);
  console.log(`  GET  /api/stats               - 统计数据`);
  console.log(`\n试试执行: curl http://localhost:${PORT}/api/requests`);
});

module.exports = server;
