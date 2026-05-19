"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestKey = generateRequestKey;
exports.requestLockMiddleware = requestLockMiddleware;
const prisma_1 = __importDefault(require("../prisma"));
const crypto_1 = __importDefault(require("crypto"));
const LOCK_TIMEOUT = 30000;
function generateRequestKey(req) {
    const bodyHash = crypto_1.default
        .createHash('md5')
        .update(JSON.stringify(req.body || {}))
        .digest('hex');
    return `${req.method}:${req.path}:${bodyHash}:${req.ip}`;
}
async function requestLockMiddleware(req, res, next) {
    if (req.method === 'GET') {
        return next();
    }
    const requestKey = generateRequestKey(req);
    const now = new Date();
    try {
        await prisma_1.default.requestLock.deleteMany({
            where: { expiresAt: { lt: now } },
        });
        const existingLock = await prisma_1.default.requestLock.findUnique({
            where: { requestKey },
        });
        if (existingLock) {
            return res.status(409).json({
                success: false,
                error: 'DUPLICATE_REQUEST',
                message: '请求正在处理中，请稍后再试',
            });
        }
        await prisma_1.default.requestLock.create({
            data: {
                requestKey,
                expiresAt: new Date(now.getTime() + LOCK_TIMEOUT),
                lockedBy: req.ip,
            },
        });
        req.requestLockKey = requestKey;
        const originalSend = res.send.bind(res);
        res.send = function (body) {
            prisma_1.default.requestLock
                .delete({ where: { requestKey } })
                .catch(() => { })
                .finally(() => { });
            return originalSend(body);
        };
        next();
    }
    catch (error) {
        next(error);
    }
}
