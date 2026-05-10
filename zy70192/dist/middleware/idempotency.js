"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredKeys = exports.idempotencyMiddleware = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const EXPIRY_HOURS = 24;
const idempotencyMiddleware = (req, res, next) => {
    const idempotencyKey = req.header(IDEMPOTENCY_HEADER);
    if (!idempotencyKey) {
        return next();
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
    const requestBody = Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : null;
    const existing = database_1.default.prepare(`
    SELECT * FROM idempotency_keys WHERE key = ?
  `).get(idempotencyKey);
    if (existing) {
        if (existing.response) {
            const cachedResponse = JSON.parse(existing.response);
            return res.status(cachedResponse.status || 200).json(cachedResponse.body);
        }
        if (existing.requestPath !== req.path || existing.requestBody !== requestBody) {
            return res.status(409).json((0, response_1.errorResponse)('幂等键已被用于不同的请求', response_1.errorCodes.IDEMPOTENT_CONFLICT));
        }
        return next();
    }
    database_1.default.prepare(`
    INSERT INTO idempotency_keys (id, key, request_path, request_body, response, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run((0, uuid_1.v4)(), idempotencyKey, req.path, requestBody, null, now.toISOString(), expiresAt.toISOString());
    const originalSend = res.json.bind(res);
    res.json = (body) => {
        database_1.default.prepare(`
      UPDATE idempotency_keys
      SET response = ?
      WHERE key = ?
    `).run(JSON.stringify({ status: res.statusCode, body }), idempotencyKey);
        return originalSend(body);
    };
    next();
};
exports.idempotencyMiddleware = idempotencyMiddleware;
const cleanupExpiredKeys = () => {
    const now = new Date().toISOString();
    database_1.default.prepare(`DELETE FROM idempotency_keys WHERE expires_at < ?`).run(now);
    console.log('Cleaned up expired idempotency keys');
};
exports.cleanupExpiredKeys = cleanupExpiredKeys;
