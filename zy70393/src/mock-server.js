import http from 'http';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const db = {
  tenants: {
    [TENANT_A]: {
      id: TENANT_A,
      name: '租户A',
      users: {
        'user-a-1': { id: 'user-a-1', name: 'Alice', role: 'admin', tenantId: TENANT_A },
        'user-a-2': { id: 'user-a-2', name: 'Bob', role: 'member', tenantId: TENANT_A },
      },
      resources: {
        'doc-a-1': { id: 'doc-a-1', title: '租户A文档1', content: '机密内容A', tenantId: TENANT_A },
        'doc-a-2': { id: 'doc-a-2', title: '租户A文档2', content: '租户A私有', tenantId: TENANT_A },
      },
      orders: {
        'order-a-1': { id: 'order-a-1', amount: 1000, status: 'paid', tenantId: TENANT_A },
      },
    },
    [TENANT_B]: {
      id: TENANT_B,
      name: '租户B',
      users: {
        'user-b-1': { id: 'user-b-1', name: 'Carol', role: 'admin', tenantId: TENANT_B },
        'user-b-2': { id: 'user-b-2', name: 'Dave', role: 'member', tenantId: TENANT_B },
      },
      resources: {
        'doc-b-1': { id: 'doc-b-1', title: '租户B文档1', content: '机密内容B', tenantId: TENANT_B },
        'doc-b-2': { id: 'doc-b-2', title: '租户B文档2', content: '租户B私有', tenantId: TENANT_B },
      },
      orders: {
        'order-b-1': { id: 'order-b-1', amount: 2000, status: 'pending', tenantId: TENANT_B },
      },
    },
  },
  tokens: {},
};

function generateToken(userId, tenantId) {
  const token = `token_${userId}_${Date.now()}`;
  db.tokens[token] = { userId, tenantId };
  return token;
}

db.tokens['admin-token-a'] = { userId: 'user-a-1', tenantId: TENANT_A };
db.tokens['user-token-a'] = { userId: 'user-a-2', tenantId: TENANT_A };
db.tokens['admin-token-b'] = { userId: 'user-b-1', tenantId: TENANT_B };
db.tokens['user-token-b'] = { userId: 'user-b-2', tenantId: TENANT_B };

function parseJson(body) {
  try {
    return JSON.parse(body || '{}');
  } catch {
    return {};
  }
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  return db.tokens[token] || null;
}

function getTenantFromHeader(req) {
  return req.headers['x-tenant-id'];
}

function getUserIdFromPath(path) {
  const match = path.match(/\/users\/([^/]+)/);
  return match ? match[1] : null;
}

function getResourceIdFromPath(path) {
  const match = path.match(/\/resources\/([^/]+)/);
  return match ? match[1] : null;
}

function getOrderIdFromPath(path) {
  const match = path.match(/\/orders\/([^/]+)/);
  return match ? match[1] : null;
}

function getResource(tenantId, resourceId) {
  const tenant = db.tenants[tenantId];
  if (!tenant) return null;
  return tenant.resources[resourceId] || null;
}

function getOrder(tenantId, orderId) {
  const tenant = db.tenants[tenantId];
  if (!tenant) return null;
  return tenant.orders[orderId] || null;
}

function findResourceById(resourceId) {
  for (const tenant of Object.values(db.tenants)) {
    if (tenant.resources[resourceId]) {
      return tenant.resources[resourceId];
    }
  }
  return null;
}

function findOrderById(orderId) {
  for (const tenant of Object.values(db.tenants)) {
    if (tenant.orders[orderId]) {
      return tenant.orders[orderId];
    }
  }
  return null;
}

function isAdmin(auth) {
  if (!auth) return false;
  const tenant = db.tenants[auth.tenantId];
  if (!tenant) return false;
  const user = tenant.users[auth.userId];
  return user?.role === 'admin';
}

function checkTenantAccess(auth, targetTenantId) {
  return auth && auth.tenantId === targetTenantId;
}

function safeGetResources(auth, resourceId) {
  if (!resourceId) {
    const tenant = db.tenants[auth.tenantId];
    return Object.values(tenant?.resources || {});
  }
  const resource = getResource(auth.tenantId, resourceId);
  return resource ? [resource] : null;
}

function vulnerableGetResource(resourceId) {
  return findResourceById(resourceId);
}

function vulnerableGetOrder(orderId) {
  return findOrderById(orderId);
}

export function createMockServer() {
  return http.createServer((req, res) => {
    const auth = getAuth(req);
    const headerTenant = getTenantFromHeader(req);
    let body = '';

    req.on('data', chunk => { body += chunk; });

    req.on('end', () => {
      const parsedBody = parseJson(body);

      if (!auth) {
        return sendJson(res, 401, { error: '未授权' });
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const path = url.pathname;
      const method = req.method;

      if (path === '/health') {
        return sendJson(res, 200, { status: 'ok' });
      }

      if (path === '/auth/token' && method === 'POST') {
        const { userId, tenantId } = parsedBody;
        const tenant = db.tenants[tenantId];
        if (tenant && tenant.users[userId]) {
          const token = generateToken(userId, tenantId);
          return sendJson(res, 200, { token });
        }
        return sendJson(res, 401, { error: '凭据无效' });
      }

      if (path.startsWith('/api/users') && method === 'GET') {
        const targetUserId = getUserIdFromPath(path);
        if (targetUserId) {
          const tenant = db.tenants[auth.tenantId];
          const user = tenant?.users[targetUserId];
          if (user) {
            return sendJson(res, 200, user);
          }
          return sendJson(res, 404, { error: '用户不存在' });
        } else {
          const tenant = db.tenants[auth.tenantId];
          return sendJson(res, 200, Object.values(tenant?.users || {}));
        }
      }

      if (path.startsWith('/api/resources')) {
        const resourceId = getResourceIdFromPath(path);

        if (method === 'GET') {
          if (path.includes('/export')) {
            const exportId = url.searchParams.get('id');
            const resource = safeGetResources(auth, exportId)?.[0];
            if (resource) {
              return sendJson(res, 200, { exported: true, data: resource });
            }
            return sendJson(res, 403, { error: '禁止访问' });
          }

          if (resourceId) {
            const safe = safeGetResources(auth, resourceId);
            if (safe && safe.length > 0) {
              return sendJson(res, 200, safe[0]);
            }
            const vulnerable = vulnerableGetResource(resourceId);
            if (vulnerable) {
              return sendJson(res, 200, vulnerable);
            }
            return sendJson(res, 404, { error: '资源不存在' });
          } else {
            const safe = safeGetResources(auth, null);
            return sendJson(res, 200, safe || []);
          }
        }

        if (method === 'POST') {
          const tenant = db.tenants[auth.tenantId];
          const newId = `doc-${auth.tenantId}-${Date.now()}`;
          const newResource = {
            id: newId,
            title: parsedBody.title || '新建文档',
            content: parsedBody.content || '',
            tenantId: auth.tenantId,
          };
          tenant.resources[newId] = newResource;
          return sendJson(res, 201, newResource);
        }

        if (method === 'PUT' && resourceId) {
          const safe = safeGetResources(auth, resourceId);
          if (safe && safe.length > 0) {
            const resource = safe[0];
            resource.title = parsedBody.title || resource.title;
            resource.content = parsedBody.content || resource.content;
            return sendJson(res, 200, resource);
          }
          const vulnerable = vulnerableGetResource(resourceId);
          if (vulnerable) {
            vulnerable.title = parsedBody.title || vulnerable.title;
            vulnerable.content = parsedBody.content || vulnerable.content;
            return sendJson(res, 200, vulnerable);
          }
          return sendJson(res, 404, { error: '资源不存在' });
        }

        if (method === 'DELETE' && resourceId) {
          const tenant = db.tenants[auth.tenantId];
          if (tenant.resources[resourceId]) {
            delete tenant.resources[resourceId];
            return sendJson(res, 204, null);
          }
          for (const t of Object.values(db.tenants)) {
            if (t.resources[resourceId]) {
              if (isAdmin(auth)) {
                delete t.resources[resourceId];
                return sendJson(res, 204, null);
              }
              return sendJson(res, 403, { error: '禁止访问' });
            }
          }
          return sendJson(res, 404, { error: '资源不存在' });
        }
      }

      if (path.startsWith('/api/orders')) {
        const orderId = getOrderIdFromPath(path);

        if (method === 'GET') {
          if (orderId) {
            const order = getOrder(auth.tenantId, orderId);
            if (order) {
              return sendJson(res, 200, order);
            }
            const vulnerable = vulnerableGetOrder(orderId);
            if (vulnerable) {
              return sendJson(res, 200, vulnerable);
            }
            return sendJson(res, 404, { error: '订单不存在' });
          } else {
            const tenant = db.tenants[auth.tenantId];
            return sendJson(res, 200, Object.values(tenant?.orders || {}));
          }
        }

        if (method === 'PUT' && orderId) {
          const order = getOrder(auth.tenantId, orderId);
          if (order) {
            order.status = parsedBody.status || order.status;
            return sendJson(res, 200, order);
          }
          const vulnerable = vulnerableGetOrder(orderId);
          if (vulnerable) {
            vulnerable.status = parsedBody.status || vulnerable.status;
            return sendJson(res, 200, vulnerable);
          }
          return sendJson(res, 404, { error: '订单不存在' });
        }
      }

      if (path.startsWith('/api/admin') && method === 'GET') {
        if (!isAdmin(auth)) {
          return sendJson(res, 403, { error: '需要管理员权限' });
        }
        return sendJson(res, 200, {
          tenant: db.tenants[auth.tenantId].name,
          stats: {
            users: Object.keys(db.tenants[auth.tenantId].users).length,
            resources: Object.keys(db.tenants[auth.tenantId].resources).length,
          },
        });
      }

      return sendJson(res, 404, { error: '接口不存在' });
    });
  });
}

export function startMockServer(port = 3000) {
  return new Promise((resolve) => {
    const server = createMockServer();
    server.listen(port, () => {
      console.log(`模拟服务运行在 http://localhost:${port}`);
      resolve(server);
    });
  });
}

export { TENANT_A, TENANT_B };
