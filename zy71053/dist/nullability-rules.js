"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NULLABILITY_RULES = void 0;
exports.getRuleByChangeType = getRuleByChangeType;
exports.explainChange = explainChange;
exports.generateFailurePaths = generateFailurePaths;
exports.analyzeRiskLevel = analyzeRiskLevel;
exports.shouldFailBuild = shouldFailBuild;
exports.formatTypeChange = formatTypeChange;
exports.NULLABILITY_RULES = {
    NON_NULL_TO_NULLABLE: {
        code: 'ND001',
        name: '非空字段变为可空',
        description: '字段从非空(!)类型变更为可空类型',
        severity: 'HIGH',
        clientImpact: '客户端代码可能假设该字段永远不会为null，缺少null检查会导致运行时崩溃',
        fixPriority: '高 - 发布前必须添加兜底逻辑',
    },
    LIST_WRAPPER_NON_NULL_TO_NULLABLE: {
        code: 'ND002',
        name: '列表外层非空变为可空',
        description: '列表字段的外层非空保证被移除',
        severity: 'HIGH',
        clientImpact: '客户端可能直接遍历列表，当列表为null时会导致"Cannot read property map of null"',
        fixPriority: '高 - 遍历前必须判空',
    },
    LIST_INNER_NON_NULL_TO_NULLABLE: {
        code: 'ND003',
        name: '列表元素非空变为可空',
        description: '列表内部元素从非空变为可空',
        severity: 'HIGH',
        clientImpact: '客户端遍历列表时可能假设元素非空，访问元素属性时会崩溃',
        fixPriority: '高 - 遍历时必须过滤或检查null',
    },
    NESTED_FIELD_NULL_DRIFT: {
        code: 'ND004',
        name: '嵌套字段空值漂移',
        description: '嵌套路径中的某个字段发生空值变更',
        severity: 'MEDIUM',
        clientImpact: '嵌套访问时可能中途遇到null导致链式调用失败',
        fixPriority: '中 - 建议使用可选链操作符',
    },
    TYPE_REPLACED_WITH_NULLABLE: {
        code: 'ND005',
        name: '类型替换为可空类型',
        description: '字段的类型被替换为另一种可空类型',
        severity: 'MEDIUM',
        clientImpact: '类型定义不匹配可能导致类型转换错误',
        fixPriority: '中 - 需要更新客户端类型定义',
    },
    FIELD_REMOVED: {
        code: 'ND006',
        name: '字段被移除',
        description: '字段从Schema中完全移除',
        severity: 'CRITICAL',
        clientImpact: '查询该字段会直接导致GraphQL执行错误',
        fixPriority: '紧急 - 必须移除查询或使用@skip指令',
    },
};
function getRuleByChangeType(changeType) {
    return exports.NULLABILITY_RULES[changeType] || null;
}
function explainChange(change) {
    const rule = getRuleByChangeType(change.changeType);
    if (!rule)
        return '未知规则';
    return `
规则代码: ${rule.code}
规则名称: ${rule.name}
严重程度: ${rule.severity}
变更描述: ${change.description}
客户端影响: ${rule.clientImpact}
修复优先级: ${rule.fixPriority}
规则说明: ${change.ruleExplanation}
  `.trim();
}
function generateFailurePaths(changes, affectedQueries) {
    const failurePaths = [];
    const changeMap = new Map();
    for (const change of changes) {
        changeMap.set(change.fieldPath, change);
    }
    for (const query of affectedQueries) {
        for (const field of query.affectedFields) {
            const change = changeMap.get(field.schemaPath);
            if (!change)
                continue;
            const existingPath = failurePaths.find((p) => p.path === field.schemaPath);
            const opReference = `${query.operationType} ${query.operationName} (${query.documentPath})`;
            if (existingPath) {
                if (!existingPath.queryOperations.includes(opReference)) {
                    existingPath.queryOperations.push(opReference);
                }
            }
            else {
                const rule = getRuleByChangeType(change.changeType);
                failurePaths.push({
                    path: field.schemaPath,
                    changeType: change.changeType,
                    queryOperations: [opReference],
                    rootCause: rule?.clientImpact || change.description,
                    recommendedAction: field.fallbackRecommendation,
                });
            }
        }
    }
    for (const change of changes) {
        const existingPath = failurePaths.find((p) => p.path === change.fieldPath);
        if (!existingPath) {
            const rule = getRuleByChangeType(change.changeType);
            failurePaths.push({
                path: change.fieldPath,
                changeType: change.changeType,
                queryOperations: [],
                rootCause: rule?.clientImpact || change.description,
                recommendedAction: '添加null安全检查或默认值兜底',
            });
        }
    }
    return failurePaths.sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const ruleA = getRuleByChangeType(a.changeType);
        const ruleB = getRuleByChangeType(b.changeType);
        const orderA = severityOrder[ruleA?.severity || 'LOW'];
        const orderB = severityOrder[ruleB?.severity || 'LOW'];
        return orderA - orderB;
    });
}
function analyzeRiskLevel(changes) {
    const weights = {
        CRITICAL: 100,
        HIGH: 50,
        MEDIUM: 20,
        LOW: 5,
    };
    let totalScore = 0;
    let maxSeverity = null;
    for (const change of changes) {
        const rule = getRuleByChangeType(change.changeType);
        if (rule) {
            totalScore += weights[rule.severity] || 0;
            if (!maxSeverity || weights[rule.severity] > (weights[maxSeverity] || 0)) {
                maxSeverity = rule.severity;
            }
        }
    }
    return {
        level: maxSeverity || 'NONE',
        score: totalScore,
    };
}
function shouldFailBuild(changes, failOn) {
    if (failOn === 'none')
        return false;
    if (changes.length === 0)
        return false;
    const thresholds = {
        critical: ['CRITICAL'],
        high: ['CRITICAL', 'HIGH'],
        medium: ['CRITICAL', 'HIGH', 'MEDIUM'],
        any: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    };
    const allowedSeverities = thresholds[failOn] || [];
    for (const change of changes) {
        const rule = getRuleByChangeType(change.changeType);
        if (rule && allowedSeverities.includes(rule.severity)) {
            return true;
        }
    }
    return false;
}
function formatTypeChange(oldType, newType) {
    const formatType = (t) => {
        let result = t.innerType;
        if (t.isList) {
            result = `[${result}${t.listInnerNonNull ? '!' : ''}]`;
        }
        if (t.isNonNull) {
            result += '!';
        }
        return result;
    };
    return `${formatType(oldType)} → ${formatType(newType)}`;
}
//# sourceMappingURL=nullability-rules.js.map