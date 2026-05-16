"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashService = void 0;
const crypto_1 = require("crypto");
class HashService {
    static generateHash(data) {
        return (0, crypto_1.createHash)("sha256").update(data).digest("hex");
    }
    static generateEventHash(eventId, timestamp, eventContent, previousHash) {
        const content = JSON.stringify(eventContent);
        const contentHash = this.generateHash(content);
        const dataToHash = `${eventId}|${timestamp}|${contentHash}|${previousHash}`;
        return this.generateHash(dataToHash);
    }
    static verifyHash(eventId, timestamp, eventContent, previousHash, expectedHash) {
        const computedHash = this.generateEventHash(eventId, timestamp, eventContent, previousHash);
        return computedHash === expectedHash;
    }
    static generateIdempotencyKey(requester, topicId, rangeIdentifier) {
        const data = `${requester}|${topicId}|${rangeIdentifier}|${Date.now()}`;
        return this.generateHash(data);
    }
    static generateContentHash(content) {
        return this.generateHash(JSON.stringify(content));
    }
}
exports.HashService = HashService;
