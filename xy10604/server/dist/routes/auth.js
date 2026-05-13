"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const database_1 = require("../config/database");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const router = (0, express_1.Router)();
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    const user = await database_1.prisma.user.findUnique({
        where: { username },
    });
    if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    if (!user.isActive) {
        return res.status(403).json({ error: '用户已被禁用' });
    }
    const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
    if (!isValidPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    const secret = process.env.JWT_SECRET || 'default-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const token = jwt.sign({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
    }, secret, { expiresIn });
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email: user.email,
        },
    });
}));
router.get('/me', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    res.json(req.user);
}));
router.post('/change-password', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: '旧密码和新密码不能为空' });
    }
    const user = await database_1.prisma.user.findUnique({
        where: { id: req.user.id },
    });
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    const isValidPassword = await bcryptjs_1.default.compare(oldPassword, user.password);
    if (!isValidPassword) {
        return res.status(401).json({ error: '旧密码不正确' });
    }
    const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
    await database_1.prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
    });
    res.json({ message: '密码修改成功' });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map