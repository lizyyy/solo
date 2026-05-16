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
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = exports.ExportService = void 0;
const csv_writer_1 = require("csv-writer");
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ExportService {
    exportDir;
    constructor() {
        this.exportDir = path.join(process.cwd(), 'exports');
        this.ensureExportDir();
    }
    ensureExportDir() {
        if (!fs.existsSync(this.exportDir)) {
            fs.mkdirSync(this.exportDir, { recursive: true });
        }
    }
    exportToCSV(explanations) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `cache-explanations-${timestamp}.csv`;
        const filePath = path.join(this.exportDir, filename);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filePath,
            header: [
                { id: 'id', title: 'ID' },
                { id: 'apiPath', title: 'API路径' },
                { id: 'cacheKey', title: '缓存键' },
                { id: 'ruleId', title: '规则ID' },
                { id: 'ruleName', title: '规则名称' },
                { id: 'status', title: '状态' },
                { id: 'generatedAt', title: '生成时间' },
                { id: 'expiresAt', title: '失效时间' },
                { id: 'ttlSeconds', title: 'TTL(秒)' },
                { id: 'hitCount', title: '命中次数' },
                { id: 'reportSummary', title: '报告摘要' },
                { id: 'hasFailure', title: '是否失败' },
                { id: 'createdBy', title: '创建人' }
            ]
        });
        const records = explanations.map(exp => ({
            id: exp.id,
            apiPath: exp.apiPath,
            cacheKey: exp.cacheKey,
            ruleId: exp.matchedRule.id,
            ruleName: exp.matchedRule.name,
            status: this.getStatusDisplayName(exp.status),
            generatedAt: exp.generatedAt.toISOString(),
            expiresAt: exp.expiration.expiresAt.toISOString(),
            ttlSeconds: exp.expiration.ttlSeconds,
            hitCount: exp.hitHistory.length,
            reportSummary: exp.explanationReport.summary,
            hasFailure: exp.failureDetails ? '是' : '否',
            createdBy: exp.metadata.createdBy || '-'
        }));
        csvWriter.writeRecords(records);
        return filePath;
    }
    exportToJSON(explanations) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `cache-explanations-${timestamp}.json`;
        const filePath = path.join(this.exportDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(explanations, null, 2), 'utf8');
        return filePath;
    }
    getStatusDisplayName(status) {
        const statusMap = {
            [types_1.CacheExplanationStatus.PENDING]: '待处理',
            [types_1.CacheExplanationStatus.CONFIRMED]: '已确认',
            [types_1.CacheExplanationStatus.BLOCKED]: '被拦截',
            [types_1.CacheExplanationStatus.REVOKED]: '已撤销',
            [types_1.CacheExplanationStatus.COMPENSATED]: '已补偿'
        };
        return statusMap[status] || status;
    }
    generateDetailedReport(explanation) {
        return {
            id: explanation.id,
            basicInfo: {
                apiPath: explanation.apiPath,
                cacheKey: explanation.cacheKey,
                status: this.getStatusDisplayName(explanation.status),
                generatedAt: explanation.generatedAt,
                ageInSeconds: Math.floor((Date.now() - explanation.generatedAt.getTime()) / 1000)
            },
            cacheKeyAnalysis: {
                algorithm: explanation.cacheKeyCalculation.algorithm,
                factors: explanation.cacheKeyCalculation.factors,
                rawValue: explanation.cacheKeyCalculation.rawValue
            },
            matchedRule: {
                id: explanation.matchedRule.id,
                name: explanation.matchedRule.name,
                description: explanation.matchedRule.description,
                ttl: explanation.matchedRule.ttl,
                priority: explanation.matchedRule.priority,
                conditions: explanation.matchedRule.conditions
            },
            expirationInfo: {
                expiresAt: explanation.expiration.expiresAt,
                ttlSeconds: explanation.expiration.ttlSeconds,
                remainingSeconds: Math.max(0, Math.floor((explanation.expiration.expiresAt.getTime() - Date.now()) / 1000)),
                conditions: explanation.expiration.conditions
            },
            hitStatistics: {
                totalHits: explanation.hitHistory.length,
                firstHitAt: explanation.hitHistory[0]?.hitAt || null,
                lastHitAt: explanation.hitHistory[explanation.hitHistory.length - 1]?.hitAt || null
            },
            explanationReport: explanation.explanationReport,
            failureDetails: explanation.failureDetails || null,
            metadata: explanation.metadata
        };
    }
}
exports.ExportService = ExportService;
exports.exportService = new ExportService();
//# sourceMappingURL=exportService.js.map