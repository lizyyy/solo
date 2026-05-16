"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFailureSchema = exports.recordHitSchema = exports.querySchema = exports.forceRefreshSchema = exports.manualCorrectionSchema = exports.createExplanationSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const types_1 = require("../types");
exports.createExplanationSchema = joi_1.default.object({
    apiPath: joi_1.default.string().required().uri({ allowRelative: true }),
    cacheKey: joi_1.default.string().required(),
    cacheKeyCalculation: joi_1.default.object({
        algorithm: joi_1.default.string().required(),
        factors: joi_1.default.array().items(joi_1.default.string()).required(),
        rawValue: joi_1.default.string().required()
    }).required(),
    matchedRule: joi_1.default.object({
        id: joi_1.default.string().required(),
        name: joi_1.default.string().required(),
        description: joi_1.default.string().required(),
        ttl: joi_1.default.number().integer().min(0).required(),
        priority: joi_1.default.number().integer().min(0).required(),
        conditions: joi_1.default.array().items(joi_1.default.object({
            field: joi_1.default.string().required(),
            operator: joi_1.default.string().required(),
            value: joi_1.default.string().required()
        })).required()
    }).required(),
    ttlSeconds: joi_1.default.number().integer().min(0).required(),
    expirationConditions: joi_1.default.array().items(joi_1.default.string()).required(),
    explanationReport: joi_1.default.object({
        summary: joi_1.default.string().required(),
        details: joi_1.default.array().items(joi_1.default.string()).required(),
        recommendations: joi_1.default.string().optional()
    }).required(),
    createdBy: joi_1.default.string().optional()
});
exports.manualCorrectionSchema = joi_1.default.object({
    explanationId: joi_1.default.string().required(),
    newStatus: joi_1.default.string().valid(...Object.values(types_1.CacheExplanationStatus)).required(),
    reason: joi_1.default.string().required(),
    correctedBy: joi_1.default.string().required(),
    overrideTtl: joi_1.default.number().integer().min(0).optional()
});
exports.forceRefreshSchema = joi_1.default.object({
    cacheKey: joi_1.default.string().required(),
    reason: joi_1.default.string().required(),
    refreshedBy: joi_1.default.string().required()
});
exports.querySchema = joi_1.default.object({
    apiPath: joi_1.default.string().optional(),
    cacheKey: joi_1.default.string().optional(),
    status: joi_1.default.string().valid(...Object.values(types_1.CacheExplanationStatus)).optional(),
    ruleId: joi_1.default.string().optional(),
    page: joi_1.default.number().integer().min(1).optional(),
    pageSize: joi_1.default.number().integer().min(1).max(100).optional()
});
exports.recordHitSchema = joi_1.default.object({
    cacheKey: joi_1.default.string().required(),
    requestId: joi_1.default.string().required(),
    clientIp: joi_1.default.string().ip().optional()
});
exports.recordFailureSchema = joi_1.default.object({
    id: joi_1.default.string().required(),
    rawInput: joi_1.default.object().required(),
    processingBasis: joi_1.default.array().items(joi_1.default.string()).required(),
    finalConclusion: joi_1.default.string().required(),
    errorStack: joi_1.default.string().optional()
});
//# sourceMappingURL=validation.js.map