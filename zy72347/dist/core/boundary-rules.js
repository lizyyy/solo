"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOUNDARY_RULES = void 0;
exports.evaluateRules = evaluateRules;
exports.getRuleById = getRuleById;
exports.getRulesByAction = getRulesByAction;
exports.formatBoundaryRule = formatBoundaryRule;
exports.BOUNDARY_RULES = [
    {
        id: 'RULE_001',
        name: '百分数小数混合检测',
        description: '当同一条记录中同时出现百分数（%）和小数（0-1之间）格式时，标记为异常，留待活动负责人复核',
        condition: (record) => {
            return record.hasMixedFormat;
        },
        action: 'flag_for_review',
        severity: 'warning',
    },
    {
        id: 'RULE_002',
        name: '纯小数自动归一化',
        description: '当所有值都是 0-1 之间的小数格式时，自动归一化为小数标准格式',
        condition: (record) => {
            if (record.hasMixedFormat)
                return false;
            const formats = Array.from(record.rawValues.values()).map((v) => v.format);
            return formats.every((f) => f === 'decimal');
        },
        action: 'auto_normalize',
        severity: 'info',
    },
    {
        id: 'RULE_003',
        name: '纯百分数自动归一化',
        description: '当所有值都是百分数格式时，自动归一化为小数标准格式',
        condition: (record) => {
            if (record.hasMixedFormat)
                return false;
            const formats = Array.from(record.rawValues.values()).map((v) => v.format);
            return formats.every((f) => f === 'percentage');
        },
        action: 'auto_normalize',
        severity: 'info',
    },
    {
        id: 'RULE_004',
        name: '无法解析值标记',
        description: '当存在无法解析为数字的值时，标记为待复核',
        condition: (record) => {
            const values = Array.from(record.rawValues.values());
            return values.some((v) => v.format === 'unknown' && v.original !== '');
        },
        action: 'flag_for_review',
        severity: 'error',
    },
    {
        id: 'RULE_005',
        name: '回滚窗口期检测',
        description: '检测记录是否在可回滚窗口期内（默认24小时）',
        condition: (record) => {
            const now = Date.now();
            const windowMs = 24 * 60 * 60 * 1000;
            return !!record.importTimestamp && now - record.importTimestamp < windowMs;
        },
        action: 'rollback',
        severity: 'info',
    },
    {
        id: 'RULE_006',
        name: '数值范围异常检测',
        description: '检测归一化后的值是否超出合理范围（0-1）',
        condition: (record) => {
            const values = Array.from(record.normalizedValues.values());
            return values.some((v) => v < 0 || v > 1);
        },
        action: 'flag_for_review',
        severity: 'error',
    },
];
function evaluateRules(record) {
    return exports.BOUNDARY_RULES.filter((rule) => rule.condition(record));
}
function getRuleById(id) {
    return exports.BOUNDARY_RULES.find((r) => r.id === id);
}
function getRulesByAction(action) {
    return exports.BOUNDARY_RULES.filter((r) => r.action === action);
}
function formatBoundaryRule(rule) {
    return `[${rule.id}] ${rule.name} (${rule.severity})
  描述: ${rule.description}
  动作: ${rule.action}`;
}
//# sourceMappingURL=boundary-rules.js.map