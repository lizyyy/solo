"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheExplanationStore = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class CacheExplanationStore {
    explanations = new Map();
    create(request) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + request.ttlSeconds * 1000);
        const explanation = {
            id: (0, uuid_1.v4)(),
            apiPath: request.apiPath,
            cacheKey: request.cacheKey,
            cacheKeyCalculation: request.cacheKeyCalculation,
            matchedRule: {
                ...request.matchedRule,
                createdAt: now
            },
            generatedAt: now,
            expiration: {
                expiresAt,
                ttlSeconds: request.ttlSeconds,
                conditions: request.expirationConditions
            },
            status: types_1.CacheExplanationStatus.PENDING,
            explanationReport: request.explanationReport,
            hitHistory: [],
            metadata: {
                createdBy: request.createdBy,
                createdAt: now,
                updatedAt: now
            }
        };
        this.explanations.set(explanation.id, explanation);
        return explanation;
    }
    findById(id) {
        return this.explanations.get(id);
    }
    findByCacheKey(cacheKey) {
        for (const exp of this.explanations.values()) {
            if (exp.cacheKey === cacheKey) {
                return exp;
            }
        }
        return undefined;
    }
    query(params) {
        let results = Array.from(this.explanations.values());
        if (params.apiPath) {
            results = results.filter(e => e.apiPath.includes(params.apiPath));
        }
        if (params.cacheKey) {
            results = results.filter(e => e.cacheKey === params.cacheKey);
        }
        if (params.status) {
            results = results.filter(e => e.status === params.status);
        }
        if (params.ruleId) {
            results = results.filter(e => e.matchedRule.id === params.ruleId);
        }
        const page = params.page || 1;
        const pageSize = params.pageSize || 20;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return {
            data: results.slice(start, end),
            total: results.length
        };
    }
    updateStatus(id, status, updatedBy) {
        const explanation = this.explanations.get(id);
        if (!explanation)
            return undefined;
        explanation.status = status;
        explanation.metadata.updatedAt = new Date();
        if (status === types_1.CacheExplanationStatus.CONFIRMED && updatedBy) {
            explanation.metadata.confirmedBy = updatedBy;
            explanation.metadata.confirmedAt = new Date();
        }
        return explanation;
    }
    manualCorrection(request) {
        const explanation = this.explanations.get(request.explanationId);
        if (!explanation)
            return undefined;
        explanation.status = request.newStatus;
        explanation.metadata.updatedAt = new Date();
        if (request.overrideTtl !== undefined) {
            explanation.expiration.ttlSeconds = request.overrideTtl;
            explanation.expiration.expiresAt = new Date(Date.now() + request.overrideTtl * 1000);
        }
        explanation.explanationReport.details.push(`人工修正: ${request.reason} (操作人: ${request.correctedBy})`);
        return explanation;
    }
    recordHit(cacheKey, requestId, clientIp) {
        const explanation = this.findByCacheKey(cacheKey);
        if (!explanation)
            return undefined;
        explanation.hitHistory.push({
            hitAt: new Date(),
            requestId,
            clientIp
        });
        return explanation;
    }
    forceRefresh(request) {
        const explanation = this.findByCacheKey(request.cacheKey);
        if (!explanation)
            return undefined;
        explanation.expiration.expiresAt = new Date();
        explanation.status = types_1.CacheExplanationStatus.REVOKED;
        explanation.metadata.updatedAt = new Date();
        explanation.explanationReport.details.push(`强制刷新: ${request.reason} (操作人: ${request.refreshedBy})`);
        return explanation;
    }
    recordFailure(id, rawInput, processingBasis, finalConclusion, errorStack) {
        const explanation = this.explanations.get(id);
        if (!explanation)
            return undefined;
        explanation.status = types_1.CacheExplanationStatus.BLOCKED;
        explanation.failureDetails = {
            rawInput,
            processingBasis,
            finalConclusion,
            errorStack
        };
        explanation.metadata.updatedAt = new Date();
        return explanation;
    }
    getAllForExport() {
        return Array.from(this.explanations.values());
    }
}
exports.cacheExplanationStore = new CacheExplanationStore();
//# sourceMappingURL=cacheExplanationStore.js.map