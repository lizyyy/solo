"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anomalyDetector = exports.AnomalyDetector = void 0;
const database_1 = require("../database");
const APOLOGY_PATTERNS = [
    /对不起/,
    /抱歉/,
    /不好意思/,
    /给您带来不便/,
    /深表歉意/,
    /道歉/,
];
const REFUND_PROMISE_PATTERNS = [
    /退款/,
    /退费/,
    /退钱/,
    /返还.*费用/,
    /全额退还/,
    /部分退款/,
    /给您退/,
    /帮您退/,
    /返还.*金额/,
];
class AnomalyDetector {
    constructor() {
        this.sensitiveWords = [];
    }
    async init() {
        this.sensitiveWords = await database_1.db.getAllSensitiveWords();
    }
    async detect(record) {
        const anomalies = [];
        const transcript = record.transcript;
        const customerServiceLines = this.getCustomerServiceLines(transcript);
        const hasApology = this.detectApology(customerServiceLines);
        const hasRefundPromise = this.detectRefundPromise(customerServiceLines);
        const sensitiveWordMatches = this.detectSensitiveWords(transcript);
        if (!hasApology && this.requiresApology(record)) {
            anomalies.push({
                recordId: record.id,
                anomalyType: 'apology_missing',
                description: '通话中客户表达了不满，但客服未进行道歉',
                severity: 'medium',
                position: '通话全文'
            });
        }
        if (!hasRefundPromise && this.requiresRefundPromise(record)) {
            anomalies.push({
                recordId: record.id,
                anomalyType: 'refund_promise_missing',
                description: '通话涉及退款诉求，但客服未明确承诺退款处理',
                severity: 'high',
                position: '通话全文'
            });
        }
        sensitiveWordMatches.forEach(match => {
            anomalies.push({
                recordId: record.id,
                anomalyType: 'sensitive_word',
                description: `检测到敏感词: ${match.word} (${match.category})`,
                severity: match.severity,
                position: match.position
            });
        });
        const summary = this.generateSummary(record, anomalies);
        return {
            hasAnomaly: anomalies.length > 0,
            anomalies,
            summary
        };
    }
    getCustomerServiceLines(transcript) {
        const lines = transcript.split('\n');
        return lines.filter(line => line.trim().startsWith('客服:') ||
            line.trim().match(/^\[\d{2}:\d{2}:\d{2}\]\s*客服/));
    }
    detectApology(lines) {
        const text = lines.join(' ');
        return APOLOGY_PATTERNS.some(pattern => pattern.test(text));
    }
    detectRefundPromise(lines) {
        const text = lines.join(' ');
        return REFUND_PROMISE_PATTERNS.some(pattern => pattern.test(text));
    }
    detectSensitiveWords(transcript) {
        const matches = [];
        const lines = transcript.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const sw of this.sensitiveWords) {
                if (line.includes(sw.word)) {
                    matches.push({
                        word: sw.word,
                        category: sw.category,
                        severity: sw.severity,
                        position: `第${i + 1}行`
                    });
                }
            }
        }
        return matches;
    }
    requiresApology(record) {
        const complaintKeywords = ['不满意', '投诉', '生气', '愤怒', '糟糕', '太差', '不合理'];
        const transcript = record.transcript.toLowerCase();
        return complaintKeywords.some(keyword => transcript.includes(keyword));
    }
    requiresRefundPromise(record) {
        const refundKeywords = ['退款', '退费', '退钱', '不买了', '取消订单', '退货'];
        const transcript = record.transcript.toLowerCase();
        return refundKeywords.some(keyword => transcript.includes(keyword));
    }
    generateSummary(record, anomalies) {
        const summaryParts = [];
        summaryParts.push(`通话ID: ${record.callId}`);
        summaryParts.push(`坐席: ${record.agentName} (${record.agentId})`);
        summaryParts.push(`通话日期: ${record.callDate}`);
        summaryParts.push(`通话时长: ${Math.floor(record.callDuration / 60)}分${record.callDuration % 60}秒`);
        if (anomalies.length > 0) {
            summaryParts.push('');
            summaryParts.push('异常检测结果:');
            const groupedAnomalies = anomalies.reduce((acc, a) => {
                if (!acc[a.anomalyType])
                    acc[a.anomalyType] = [];
                acc[a.anomalyType].push(a);
                return acc;
            }, {});
            if (groupedAnomalies['apology_missing']) {
                summaryParts.push('  - 缺少道歉: 建议客服在客户表达不满时主动道歉');
            }
            if (groupedAnomalies['refund_promise_missing']) {
                summaryParts.push('  - 缺少退款承诺: 建议明确告知客户退款处理流程');
            }
            if (groupedAnomalies['sensitive_word']) {
                const words = groupedAnomalies['sensitive_word'].map(a => a.description.match(/敏感词: ([^ ]+)/)?.[1]).filter(Boolean);
                summaryParts.push(`  - 敏感词: ${[...new Set(words)].join(', ')}`);
            }
        }
        else {
            summaryParts.push('');
            summaryParts.push('检测结果: 正常');
        }
        return summaryParts.join('\n');
    }
    async processRecord(record) {
        const result = await this.detect(record);
        for (const anomaly of result.anomalies) {
            await database_1.db.insertAnomalyRecord(anomaly);
        }
        const status = result.hasAnomaly ? 'abnormal' : 'normal';
        await database_1.db.updateCallRecordStatus(record.id, status, result.summary);
        return { status, summary: result.summary };
    }
}
exports.AnomalyDetector = AnomalyDetector;
exports.anomalyDetector = new AnomalyDetector();
