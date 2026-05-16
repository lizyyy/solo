"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockRules = void 0;
exports.checkBlockRules = checkBlockRules;
const types_1 = require("./types");
exports.blockRules = [
    {
        id: 'rule-001',
        name: '高风险直接拦截',
        description: '高风险消息必须经过人工复核',
        condition: (record) => record.riskType === 'HIGH',
        blockReason: '高风险类型消息，需人工复核确认'
    },
    {
        id: 'rule-002',
        name: '风险分超标拦截',
        description: '风险评分超过80分需拦截',
        condition: (record) => record.riskScore >= 80,
        blockReason: `风险评分超标，需人工复核`
    },
    {
        id: 'rule-003',
        name: '状态提前结束拦截',
        description: '临时票权限即将到期时禁止提前结束处理',
        condition: (record, ticket) => {
            const now = new Date();
            const hoursToEnd = (ticket.endTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            return hoursToEnd < 24 && record.status === types_1.ProcessingStatus.PENDING;
        },
        blockReason: '临时票权限不足24小时到期，禁止提前结束，需续期后处理'
    },
    {
        id: 'rule-004',
        name: '敏感内容拦截',
        description: '包含敏感关键词的消息需拦截',
        condition: (record) => {
            const sensitiveKeywords = ['投诉', '举报', '违规', '欺诈', '报警', '维权', '赔偿', '起诉'];
            return sensitiveKeywords.some(keyword => record.content.includes(keyword));
        },
        blockReason: '消息内容包含敏感关键词，需人工复核'
    },
    {
        id: 'rule-005',
        name: '身份证格式异常拦截',
        description: '身份证号格式不正确需拦截',
        condition: (record) => {
            const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
            return !idCardRegex.test(record.idCard);
        },
        blockReason: '身份证号码格式异常，需核验身份信息'
    },
    {
        id: 'rule-006',
        name: '手机号黑名单拦截',
        description: '手机号在风险黑名单中需拦截',
        condition: (record) => {
            const blacklistPhones = ['13800138000', '13900139000', '13700137000'];
            return blacklistPhones.includes(record.phone);
        },
        blockReason: '手机号在风险黑名单中，需特殊处理'
    }
];
function ensureDate(value) {
    return typeof value === 'string' ? new Date(value) : value;
}
function checkBlockRules(record, ticket) {
    const ticketWithDates = {
        ...ticket,
        startTime: ensureDate(ticket.startTime),
        endTime: ensureDate(ticket.endTime)
    };
    for (const rule of exports.blockRules) {
        if (rule.condition(record, ticketWithDates)) {
            return `[${rule.name}] ${rule.blockReason}`;
        }
    }
    return null;
}
