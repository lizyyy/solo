"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingPreloadDetector = void 0;
exports.detectMissingPreload = detectMissingPreload;
const models_1 = require("../models");
const id_generator_1 = require("../utils/id-generator");
class MissingPreloadDetector {
    constructor(options = {}, repositoryMethods) {
        this.options = { ...models_1.DEFAULT_ANALYSIS_OPTIONS, ...options };
        this.repositoryMethods = repositoryMethods;
    }
    detect(requestGroup) {
        const issues = [];
        const potentialMissingPreloads = this.findPotentialMissingPreloads(requestGroup.sqlQueries);
        for (const pattern of potentialMissingPreloads) {
            const issue = this.createMissingPreloadIssue(pattern, requestGroup);
            issues.push(issue);
        }
        return issues;
    }
    findPotentialMissingPreloads(queries) {
        const patterns = [];
        const selectQueries = queries.filter(q => q.operationType === 'SELECT');
        if (selectQueries.length < 2)
            return patterns;
        const queriesByTable = new Map();
        for (const query of selectQueries) {
            if (query.tableName) {
                if (!queriesByTable.has(query.tableName)) {
                    queriesByTable.set(query.tableName, []);
                }
                queriesByTable.get(query.tableName).push(query);
            }
        }
        const tables = Array.from(queriesByTable.keys());
        for (const mainTable of tables) {
            const mainQueries = queriesByTable.get(mainTable);
            for (const relatedTable of tables) {
                if (mainTable === relatedTable)
                    continue;
                const relatedQueries = queriesByTable.get(relatedTable);
                if (this.isRelatedByForeignKey(mainTable, relatedTable, mainQueries, relatedQueries)) {
                    const pattern = this.analyzePreloadPattern(mainTable, relatedTable, mainQueries, relatedQueries);
                    if (pattern) {
                        patterns.push(pattern);
                    }
                }
            }
        }
        return patterns;
    }
    isRelatedByForeignKey(mainTable, relatedTable, mainQueries, relatedQueries) {
        const fkPatterns = [
            new RegExp(`${mainTable}_id`, 'i'),
            new RegExp(`${mainTable}Id`, 'i'),
            new RegExp(`${relatedTable}_id`, 'i'),
            new RegExp(`${relatedTable}Id`, 'i'),
        ];
        for (const query of [...mainQueries, ...relatedQueries]) {
            for (const clause of query.whereClauses) {
                for (const pattern of fkPatterns) {
                    if (pattern.test(clause.column)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    analyzePreloadPattern(mainTable, relatedTable, mainQueries, relatedQueries) {
        if (relatedQueries.length < 2)
            return null;
        const mainQueryCount = mainQueries.length;
        const relatedQueryCount = relatedQueries.length;
        const mainFirst = mainQueries[0];
        const relatedFirst = relatedQueries[0];
        const mainLast = mainQueries[mainQueries.length - 1];
        const relatedLast = relatedQueries[relatedQueries.length - 1];
        const mainBeforeRelated = mainFirst.timestamp.getTime() < relatedFirst.timestamp.getTime();
        const interleaved = this.areQueriesInterleaved(mainQueries, relatedQueries);
        if (mainBeforeRelated && (relatedQueryCount >= mainQueryCount || interleaved)) {
            const fkColumn = this.findForeignKeyColumn(relatedQueries, mainTable);
            return {
                mainTable,
                relatedTable,
                mainQueries,
                relatedQueries,
                foreignKeyColumn: fkColumn,
                estimatedPreloadBenefit: {
                    queryCountReduction: relatedQueryCount - 1,
                    estimatedDurationReduction: relatedQueries.reduce((sum, q) => sum + q.duration, 0) * 0.7,
                },
            };
        }
        return null;
    }
    areQueriesInterleaved(queries1, queries2) {
        const allQueries = [...queries1, ...queries2].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        let lastType = null;
        let transitionCount = 0;
        for (const query of allQueries) {
            const isQ1 = queries1.includes(query);
            const currentType = isQ1 ? 'q1' : 'q2';
            if (lastType && lastType !== currentType) {
                transitionCount++;
            }
            lastType = currentType;
        }
        return transitionCount >= 2;
    }
    findForeignKeyColumn(queries, targetTable) {
        const patterns = [
            new RegExp(`${targetTable}_id`, 'i'),
            new RegExp(`${targetTable}Id`, 'i'),
        ];
        for (const query of queries) {
            for (const clause of query.whereClauses) {
                for (const pattern of patterns) {
                    if (pattern.test(clause.column)) {
                        return clause.column;
                    }
                }
            }
        }
        return undefined;
    }
    createMissingPreloadIssue(pattern, requestGroup) {
        const relatedCount = pattern.relatedQueries.length;
        const severity = relatedCount >= 10 ? 'CRITICAL' :
            relatedCount >= 5 ? 'HIGH' :
                relatedCount >= 3 ? 'MEDIUM' : 'LOW';
        const estimatedDataTransfer = relatedCount * 150;
        return {
            id: (0, id_generator_1.generateId)(),
            type: 'MISSING_PRELOAD',
            severity,
            title: `缺失预加载：${pattern.mainTable} -> ${pattern.relatedTable}`,
            description: `检测到可能的预加载缺失场景。在查询 ${pattern.mainTable} 后，执行了 ${relatedCount} 个 ${pattern.relatedTable} 查询，这通常可以通过 ORM 的预加载功能优化为单个批量查询。`,
            requestId: requestGroup.requestId,
            queries: [...pattern.mainQueries, ...pattern.relatedQueries],
            suggestion: {
                title: '使用 ORM 预加载功能',
                description: `将 ${pattern.mainTable} 和 ${pattern.relatedTable} 的查询合并，使用 ORM 的预加载（eager loading）功能。这将把 ${relatedCount + 1} 个查询减少到 2 个（主表查询 + 关联表批量查询）。`,
                codeExample: this.generateCodeExample(pattern),
                expectedImprovement: {
                    queryCountReduction: pattern.estimatedPreloadBenefit.queryCountReduction,
                    durationReductionPercent: 70,
                    dataTransferReductionPercent: 20,
                },
            },
            impact: {
                queryCountIncrease: pattern.estimatedPreloadBenefit.queryCountReduction,
                durationIncreaseMs: pattern.estimatedPreloadBenefit.estimatedDurationReduction,
                dataTransferIncreaseBytes: estimatedDataTransfer,
            },
            evidence: {
                queries: [
                    `主表 ${pattern.mainTable} 查询：${pattern.mainQueries.length} 个`,
                    `关联表 ${pattern.relatedTable} 查询：${pattern.relatedQueries.length} 个`,
                    ...pattern.relatedQueries.slice(0, 5).map(q => q.sql),
                ],
            },
        };
    }
    generateCodeExample(pattern) {
        const mainTable = pattern.mainTable;
        const relatedTable = pattern.relatedTable;
        const fkColumn = pattern.foreignKeyColumn || `${mainTable}_id`;
        const mainModel = this.toPascalCase(mainTable);
        const relatedModel = this.toPascalCase(relatedTable);
        return `// 优化前（N+1 模式，没有预加载）
const ${mainTable.toLowerCase()}s = await ${mainModel}.findAll({
  where: { /* 条件 */ }
});

for (const ${mainTable.toLowerCase()} of ${mainTable.toLowerCase()}s) {
  const ${relatedTable.toLowerCase()}s = await ${relatedModel}.findAll({
    where: { ${fkColumn}: ${mainTable.toLowerCase()}.id }
  });
  ${mainTable.toLowerCase()}.${relatedTable.toLowerCase()}s = ${relatedTable.toLowerCase()}s;
}

// 优化后（使用预加载）
// Sequelize 示例：
const ${mainTable.toLowerCase()}s = await ${mainModel}.findAll({
  where: { /* 条件 */ },
  include: [{
    model: ${relatedModel},
    as: '${relatedTable.toLowerCase()}s'
  }]
});

// TypeORM 示例：
const ${mainTable.toLowerCase()}s = await ${mainModel}.find({
  where: { /* 条件 */ },
  relations: ['${relatedTable.toLowerCase()}s']
});

// Prisma 示例：
const ${mainTable.toLowerCase()}s = await prisma.${mainTable.toLowerCase()}.findMany({
  where: { /* 条件 */ },
  include: {
    ${relatedTable.toLowerCase()}s: true
  }
});

// 手动批量查询（如果 ORM 不支持预加载）
const ${mainTable.toLowerCase()}s = await ${mainModel}.findAll({ /* ... */ });
const ${mainTable.toLowerCase()}Ids = ${mainTable.toLowerCase()}s.map(m => m.id);

const ${relatedTable.toLowerCase()}s = await ${relatedModel}.findAll({
  where: {
    ${fkColumn}: { [Op.in]: ${mainTable.toLowerCase()}Ids }
  }
});

const ${relatedTable.toLowerCase()}Map = new Map();
for (const ${relatedTable.toLowerCase()} of ${relatedTable.toLowerCase()}s) {
  const key = ${relatedTable.toLowerCase()}.${fkColumn};
  if (!${relatedTable.toLowerCase()}Map.has(key)) {
    ${relatedTable.toLowerCase()}Map.set(key, []);
  }
  ${relatedTable.toLowerCase()}Map.get(key).push(${relatedTable.toLowerCase()});
}

for (const ${mainTable.toLowerCase()} of ${mainTable.toLowerCase()}s) {
  ${mainTable.toLowerCase()}.${relatedTable.toLowerCase()}s = ${relatedTable.toLowerCase()}Map.get(${mainTable.toLowerCase()}.id) || [];
}`;
    }
    toPascalCase(str) {
        return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
}
exports.MissingPreloadDetector = MissingPreloadDetector;
function detectMissingPreload(requestGroup, options, repositoryMethods) {
    const detector = new MissingPreloadDetector(options, repositoryMethods);
    return detector.detect(requestGroup);
}
//# sourceMappingURL=missing-preload-detector.js.map