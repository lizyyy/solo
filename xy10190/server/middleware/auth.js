const db = require('../database');

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: '未登录或会话已过期' });
  }
  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: '未登录或会话已过期' });
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ success: false, message: '无权限执行此操作' });
    }
    next();
  };
};

const logAudit = (action, entityType) => {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode < 400) {
        try {
          const { v4: uuidv4 } = require('uuid');
          await db.run(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              req.session?.userId || 'unknown',
              action,
              entityType,
              req.params?.id || null,
              req.ip || req.connection?.remoteAddress,
              req.headers['user-agent']
            ]
          );
        } catch (err) {
          console.error('审计日志记录失败:', err);
        }
      }
    });
    next();
  };
};

module.exports = {
  requireAuth,
  requireRole,
  logAudit
};
