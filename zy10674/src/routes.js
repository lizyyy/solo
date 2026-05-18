const slaService = require('./service');
const { TICKET_STATUS, PAUSE_REASON } = require('./constants');

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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    if (pathname === '/api/constants' && method === 'GET') {
      sendJson(res, 200, { TICKET_STATUS, PAUSE_REASON });
      return;
    }

    if (pathname === '/api/tickets' && method === 'POST') {
      const body = await parseBody(req);
      const result = slaService.createTicket(body);
      sendJson(res, result.success ? 201 : 400, result);
      return;
    }

    if (pathname === '/api/tickets' && method === 'GET') {
      const filters = {
        status: url.searchParams.get('status'),
        customerId: url.searchParams.get('customerId')
      };
      const result = slaService.listTickets(filters);
      sendJson(res, 200, result);
      return;
    }

    if (pathname.match(/^\/api\/tickets\/[^\/]+$/) && method === 'GET') {
      const ticketId = pathname.split('/')[3];
      const result = slaService.getTicketDetail(ticketId);
      sendJson(res, result.success ? 200 : 404, result);
      return;
    }

    if (pathname.match(/^\/api\/tickets\/[^\/]+\/history$/) && method === 'GET') {
      const ticketId = pathname.split('/')[3];
      const result = slaService.getTicketHistory(ticketId);
      sendJson(res, result.success ? 200 : 404, result);
      return;
    }

    if (pathname === '/api/tickets/pause' && method === 'POST') {
      const body = await parseBody(req);
      const result = slaService.pauseTicket(body);
      const statusCode = result.success ? 200 :
        result.error === 'TICKET_NOT_FOUND' ? 404 :
        result.error === 'DUPLICATE_PAUSE' ? 409 : 400;
      sendJson(res, statusCode, result);
      return;
    }

    if (pathname === '/api/tickets/resume' && method === 'POST') {
      const body = await parseBody(req);
      const result = slaService.resumeTicket(body);
      const statusCode = result.success ? 200 :
        result.error === 'TICKET_NOT_FOUND' ? 404 : 400;
      sendJson(res, statusCode, result);
      return;
    }

    if (pathname === '/api/export' && method === 'GET') {
      const result = slaService.exportData();
      sendJson(res, 200, result);
      return;
    }

    if (pathname === '/api/import' && method === 'POST') {
      const body = await parseBody(req);
      const overwrite = url.searchParams.get('overwrite') === 'true';
      const result = slaService.importData(body, overwrite);
      sendJson(res, result.success ? 200 : 207, result);
      return;
    }

    if (pathname === '/api/check-timeout' && method === 'POST') {
      const result = slaService.checkTimeout();
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { success: false, error: 'NOT_FOUND', message: '接口不存在' });
  } catch (e) {
    console.error('请求处理错误:', e);
    sendJson(res, 500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: e.message
    });
  }
}

module.exports = { handleRequest };
