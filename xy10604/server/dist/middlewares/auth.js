"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuditor = exports.requireReviewer = exports.requireAdmin = exports.requireRoles = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await database_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                username: true,
                role: true,
                name: true,
                isActive: true,
            },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: '用户不存在或已被禁用' });
        }
        req.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: '无效的令牌' });
    }
};
exports.authenticateToken = authenticateToken;
const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: '未认证' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: '权限不足' });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
exports.requireAdmin = (0, exports.requireRoles)('ADMIN');
exports.requireReviewer = (0, exports.requireRoles)('ADMIN', 'REVIEWER');
exports.requireAuditor = (0, exports.requireRoles)('ADMIN', 'AUDITOR');
//# sourceMappingURL=auth.js.map