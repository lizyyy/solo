"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requirePermission = exports.authenticate = void 0;
const ROLE_PERMISSIONS = {
    admin: ['import', 'reconcile', 'export', 'manage_tasks', 'resolve_anomalies', 'view_all'],
    operator: ['import', 'reconcile', 'export', 'view_all'],
    viewer: ['view_all']
};
const API_TOKEN = 'Bearer tea-chain-verification-2024';
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== API_TOKEN) {
        res.status(401).json({ error: '未授权访问', code: 'UNAUTHORIZED' });
        return;
    }
    const roleHeader = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'] || 'unknown';
    const username = req.headers['x-username'] || 'unknown';
    const franchiseeId = req.headers['x-franchisee-id'];
    const role = (['admin', 'operator', 'viewer'].includes(roleHeader) ? roleHeader : 'viewer');
    req.user = {
        userId,
        username,
        role,
        franchiseeId
    };
    next();
};
exports.authenticate = authenticate;
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: '未授权访问', code: 'UNAUTHORIZED' });
            return;
        }
        const permissions = ROLE_PERMISSIONS[req.user.role] || [];
        if (!permissions.includes(permission) && !permissions.includes('view_all')) {
            res.status(403).json({
                error: '权限不足',
                code: 'FORBIDDEN',
                requiredPermission: permission,
                userRole: req.user.role
            });
            return;
        }
        next();
    };
};
exports.requirePermission = requirePermission;
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: '需要管理员权限', code: 'ADMIN_REQUIRED' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
