"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateQueryDetector = void 0;
exports.detectDuplicateQueries = detectDuplicateQueries;
const models_1 = require("../models");
const id_generator_1 = require("../utils/id-generator");
class DuplicateQueryDetector {
    constructor(options = {}) {
        this.options = { ...models_1.DEFAULT_ANALYSIS_OPTIONS, ...options };
    }
    detect(requestGroup) {
        const issues = [];
        const duplicateGroups = this.findDuplicateQueries(requestGroup.sqlQueries);
        for (const group of duplicateGroups) {
            if (group.queries.length >= 2) {
                const issue = this.createDuplicateQueryIssue(group, requestGroup);
                issues.push(issue);
            }
        }
        return issues;
    }
    findDuplicateQueries(queries) {
        const groups = [];
        const normalizedMap = new Map();
        const timeWindow = this.options.duplicateQueryTimeWindowMs || 1000;
        const sortedQueries = [...queries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        for (const query of sortedQueries) {
            const key = query.normalizedSql;
            if (!normalizedMap.has(key)) {
                normalizedMap.set(key, {
                    normalizedSql: key,
                    tableName: query.tableName,
                    queries: [],
                    timeWindowStart: query.timestamp,
                });
            }
            const group = normalizedMap.get(key);
            const timeDiff = query.timestamp.getTime() - group.timeWindowStart.getTime();
            if (timeDiff <= timeWindow) {
                group.queries.push(query);
            }
            else {
                if (group.queries.length >= 2) {
                    groups.push({ ...group });
                }
                group.queries = [query];
                group.timeWindowStart = query.timestamp;
            }
        }
        for (const group of normalizedMap.values()) {
            if (group.queries.length >= 2) {
                const existingGroup = groups.find(g => g.normalizedSql === group.normalizedSql);
                if (!existingGroup) {
                    groups.push(group);
                }
            }
        }
        return groups;
    }
    createDuplicateQueryIssue(group, requestGroup) {
        const queryCount = group.queries.length;
        const totalDuration = group.queries.reduce((sum, q) => sum + q.duration, 0);
        const severity = queryCount >= 10 ? 'CRITICAL' :
            queryCount >= 5 ? 'HIGH' :
                queryCount >= 3 ? 'MEDIUM' : 'LOW';
        const estimatedDataTransfer = group.queries.length * 100;
        return {
            id: (0, id_generator_1.generateId)(),
            type: 'DUPLICATE_QUERY',
            severity,
            title: `重复查询在表 ${group.tableName || 'unknown'}`,
            description: `在 ${this.options.duplicateQueryTimeWindowMs || 1000}ms 时间窗口内检测到 ${queryCount} 个完全相同的查询。这可能是由于缓存缺失、重复调用或代码逻辑问题导致的。`,
            requestId: requestGroup.requestId,
            queries: group.queries,
            suggestion: {
                title: '添加缓存或移除重复调用',
                description: `分析为什么会有 ${queryCount} 个相同的查询。考虑：1) 添加适当的缓存层；2) 检查代码逻辑，移除不必要的重复调用；3) 使用请求级别的缓存。`,
                codeExample: this.generateCodeExample(group),
                expectedImprovement: {
                    queryCountReduction: queryCount - 1,
                    durationReductionPercent: Math.round((totalDuration * 0.9) / totalDuration * 100),
                    dataTransferReductionPercent: Math.round((estimatedDataTransfer * 0.9) / estimatedDataTransfer * 100),
                },
            },
            impact: {
                queryCountIncrease: queryCount - 1,
                durationIncreaseMs: totalDuration * 0.9,
                dataTransferIncreaseBytes: estimatedDataTransfer,
            },
            evidence: {
                queries: group.queries.map(q => q.sql),
                executionOrder: group.queries.map((q, i) => i + 1),
            },
        };
    }
    generateCodeExample(group) {
        return `// 优化前（重复查询）
const user1 = await User.findById(userId);
// ... 其他代码 ...
const user2 = await User.findById(userId);  // 重复查询
// ... 更多代码 ...
const user3 = await User.findById(userId);  // 又一次重复

// 优化后（使用变量缓存）
const user = await User.findById(userId);
// 复用 user 变量

// 或使用请求级别的缓存
class RequestCache {
  private cache = new Map();
  
  async getOrSet(key: string, fetcher: () => Promise<any>) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const value = await fetcher();
    this.cache.set(key, value);
    return value;
  }
}

// 使用示例
const cache = new RequestCache();
const user = await cache.getOrSet(\`user:\${userId}\`, () => User.findById(userId));`;
    }
}
exports.DuplicateQueryDetector = DuplicateQueryDetector;
function detectDuplicateQueries(requestGroup, options) {
    const detector = new DuplicateQueryDetector(options);
    return detector.detect(requestGroup);
}
//# sourceMappingURL=duplicate-query-detector.js.map