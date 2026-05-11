"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEndpointKey = getEndpointKey;
exports.idempotencyMiddleware = idempotencyMiddleware;
exports.cacheIdempotentResponse = cacheIdempotentResponse;
exports.cleanupExpiredIdempotentRequests = cleanupExpiredIdempotentRequests;
const uuid_1 = require("uuid");
const database_1 = require("../database");
function getEndpointKey(method, originalUrl) {
    return `${method}:${originalUrl.split('?')[0]}`;
}
async function idempotencyMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    req.idempotency = {
        requestId,
        isRetry: false
    };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        try {
            const endpoint = getEndpointKey(req.method, req.originalUrl);
            const cached = await database_1.db.get('SELECT response FROM idempotent_requests WHERE request_id = ? AND endpoint = ? AND expires_at > ?', [requestId, endpoint, new Date().toISOString()]);
            if (cached && cached.response) {
                req.idempotency.isRetry = true;
                req.idempotency.cachedResponse = JSON.parse(cached.response);
                next();
                return;
            }
        }
        catch (error) {
            console.error('Error checking idempotency:', error);
        }
    }
    next();
}
async function cacheIdempotentResponse(requestId, endpoint, response, ttlHours = 24) {
    try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
        await database_1.db.run('INSERT INTO idempotent_requests (id, request_id, endpoint, response, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [(0, uuid_1.v4)(), requestId, endpoint, JSON.stringify(response), now.toISOString(), expiresAt.toISOString()]);
    }
    catch (error) {
        console.error('Error caching idempotent response:', error);
    }
}
async function cleanupExpiredIdempotentRequests() {
    try {
        await database_1.db.run('DELETE FROM idempotent_requests WHERE expires_at < ?', [new Date().toISOString()]);
    }
    catch (error) {
        console.error('Error cleaning up idempotent requests:', error);
    }
}
//# sourceMappingURL=idempotency.js.map