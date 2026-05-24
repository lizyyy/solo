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
exports.SelfCheck = void 0;
const fs = __importStar(require("fs"));
const bounce_parser_1 = require("./bounce-parser");
const report_generator_1 = require("./report-generator");
const output_handler_1 = require("./output-handler");
const types_1 = require("../types");
class SelfCheck {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.parser = new bounce_parser_1.BounceParser();
        this.reportGenerator = new report_generator_1.ReportGenerator();
        this.outputHandler = new output_handler_1.OutputHandler(outputDir);
        this.ensureOutputDir();
    }
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    async runAllTests() {
        const results = [];
        results.push(this.testSmtpCodeClassification());
        results.push(this.testEnhancedCodeClassification());
        results.push(this.testProviderPatterns());
        results.push(this.testMailboxNotExist());
        results.push(this.testPolicyRejection());
        results.push(this.testContentBlocked());
        results.push(this.testTemporaryFailure());
        results.push(this.testUnknownCategory());
        results.push(this.testRetrySuggestions());
        results.push(this.testBatchAggregation());
        results.push(this.testReportGeneration());
        results.push(this.testMultipleBouncesSameRecipient());
        results.push(this.testOutputFormats());
        results.push(this.testEdgeCases());
        results.push(this.testChineseContent());
        results.push(this.testConfidenceLevels());
        return results;
    }
    testSmtpCodeClassification() {
        const testCases = [
            { name: '550 邮箱不存在', data: { recipient: 'test@qq.com', smtpCode: '550', rawMessage: '' }, expected: { category: types_1.BounceCategory.MAILBOX_NOT_EXIST } },
            { name: '554 策略拒绝', data: { recipient: 'test@qq.com', smtpCode: '554', rawMessage: '' }, expected: { category: types_1.BounceCategory.POLICY_REJECTION } },
            { name: '552 内容拦截', data: { recipient: 'test@qq.com', smtpCode: '552', rawMessage: '' }, expected: { category: types_1.BounceCategory.CONTENT_BLOCKED } },
            { name: '450 临时失败', data: { recipient: 'test@qq.com', smtpCode: '450', rawMessage: '' }, expected: { category: types_1.BounceCategory.TEMPORARY_FAILURE, shouldRetry: true } },
        ];
        for (const tc of testCases) {
            const record = this.parser.parseBounceData(tc.data);
            if (record.category !== tc.expected.category) {
                return {
                    name: 'SMTP 状态码分类',
                    passed: false,
                    error: `${tc.name}: 期望 ${tc.expected.category}, 实际 ${record.category}`
                };
            }
        }
        return { name: 'SMTP 状态码分类', passed: true };
    }
    testEnhancedCodeClassification() {
        const testCases = [
            { name: '5.1.1 邮箱不存在', data: { recipient: 'test@qq.com', enhancedCode: '5.1.1', rawMessage: '' }, expected: { category: types_1.BounceCategory.MAILBOX_NOT_EXIST } },
            { name: '5.7.1 策略拒绝', data: { recipient: 'test@qq.com', enhancedCode: '5.7.1', rawMessage: '' }, expected: { category: types_1.BounceCategory.POLICY_REJECTION } },
            { name: '5.2.0 内容拦截', data: { recipient: 'test@qq.com', enhancedCode: '5.2.0', rawMessage: '' }, expected: { category: types_1.BounceCategory.CONTENT_BLOCKED } },
        ];
        for (const tc of testCases) {
            const record = this.parser.parseBounceData(tc.data);
            if (record.category !== tc.expected.category) {
                return {
                    name: '增强状态码分类',
                    passed: false,
                    error: `${tc.name}: 期望 ${tc.expected.category}, 实际 ${record.category}`
                };
            }
        }
        return { name: '增强状态码分类', passed: true };
    }
    testProviderPatterns() {
        const testCases = [
            { name: 'QQ邮箱检测', data: { recipient: 'user@qq.com', rawMessage: '' }, expected: { provider: 'tencent' } },
            { name: '阿里云邮箱检测', data: { recipient: 'user@aliyun.com', rawMessage: '' }, expected: { provider: 'alibaba' } },
            { name: '网易邮箱检测', data: { recipient: 'user@163.com', rawMessage: '' }, expected: { provider: 'netease' } },
            { name: 'Gmail检测', data: { recipient: 'user@gmail.com', rawMessage: '' }, expected: { provider: 'gmail' } },
        ];
        for (const tc of testCases) {
            const record = this.parser.parseBounceData(tc.data);
            if (tc.expected.provider && record.provider !== tc.expected.provider) {
                return {
                    name: '供应商模式匹配',
                    passed: false,
                    error: `${tc.name}: 期望 ${tc.expected.provider}, 实际 ${record.provider}`
                };
            }
        }
        return { name: '供应商模式匹配', passed: true };
    }
    testMailboxNotExist() {
        const messages = [
            'Mailbox not found for user@example.com',
            'Recipient address rejected: User unknown',
            'The email account that you tried to reach does not exist',
            '邮箱不存在，请检查后重试',
            '550 5.1.1 <user@domain.com>: Recipient address rejected',
            'no such user - gsmtp',
        ];
        for (const msg of messages) {
            const record = this.parser.parseBounceData({
                recipient: 'test@example.com',
                rawMessage: msg
            });
            if (record.category !== types_1.BounceCategory.MAILBOX_NOT_EXIST) {
                return {
                    name: '邮箱不存在识别',
                    passed: false,
                    error: `消息: "${msg.substring(0, 40)}..." 被分类为 ${record.category}, 期望 mailbox_not_exist`
                };
            }
            if (record.confidence < 0.5) {
                return {
                    name: '邮箱不存在识别',
                    passed: false,
                    error: `置信度过低: ${record.confidence} for "${msg.substring(0, 30)}..."`
                };
            }
        }
        return { name: '邮箱不存在识别', passed: true };
    }
    testPolicyRejection() {
        const messages = [
            'SPF check failed - please contact your administrator',
            'DMARC policy rejected this message',
            'IP 192.168.1.1 is blocked due to poor reputation',
            '因发送频率过高，邮件被拒收',
            '550 5.7.1 Service unavailable; client host blocked',
            '该IP已被列入黑名单',
        ];
        for (const msg of messages) {
            const record = this.parser.parseBounceData({
                recipient: 'test@example.com',
                rawMessage: msg
            });
            if (record.category !== types_1.BounceCategory.POLICY_REJECTION) {
                return {
                    name: '策略拒收识别',
                    passed: false,
                    error: `消息: "${msg.substring(0, 40)}..." 被分类为 ${record.category}, 期望 policy_rejection`
                };
            }
        }
        return { name: '策略拒收识别', passed: true };
    }
    testContentBlocked() {
        const messages = [
            'This message has been identified as spam',
            '邮件内容包含违规关键词，被拦截',
            'virus detected in attachment',
            'spam content detected, message rejected',
            '内容包含敏感词，请修改后重新发送',
            'Message contained a virus and was rejected',
        ];
        for (const msg of messages) {
            const record = this.parser.parseBounceData({
                recipient: 'test@example.com',
                rawMessage: msg
            });
            if (record.category !== types_1.BounceCategory.CONTENT_BLOCKED) {
                return {
                    name: '内容拦截识别',
                    passed: false,
                    error: `消息: "${msg.substring(0, 40)}..." 被分类为 ${record.category}, 期望 content_blocked`
                };
            }
        }
        return { name: '内容拦截识别', passed: true };
    }
    testTemporaryFailure() {
        const messages = [
            'Temporary system failure, try again later',
            '450 4.7.1 Service temporarily unavailable',
            '连接超时，请稍后重试',
            'Deferred due to system load',
            '服务器繁忙，请稍后再试',
            '421 Service not available, closing transmission channel',
        ];
        for (const msg of messages) {
            const record = this.parser.parseBounceData({
                recipient: 'test@example.com',
                rawMessage: msg
            });
            if (record.category !== types_1.BounceCategory.TEMPORARY_FAILURE) {
                return {
                    name: '临时失败识别',
                    passed: false,
                    error: `消息: "${msg.substring(0, 40)}..." 被分类为 ${record.category}, 期望 temporary_failure`
                };
            }
            if (!record.retrySuggestion.shouldRetry) {
                return {
                    name: '临时失败识别',
                    passed: false,
                    error: `临时失败应该建议重试: "${msg.substring(0, 30)}..."`
                };
            }
        }
        return { name: '临时失败识别', passed: true };
    }
    testUnknownCategory() {
        const record = this.parser.parseBounceData({
            recipient: 'test@example.com',
            rawMessage: 'Some random error message without patterns'
        });
        if (record.category !== types_1.BounceCategory.UNKNOWN) {
            return {
                name: '未知分类处理',
                passed: false,
                error: `期望 unknown, 实际 ${record.category}`
            };
        }
        return { name: '未知分类处理', passed: true };
    }
    testRetrySuggestions() {
        const testCases = [
            { category: types_1.BounceCategory.MAILBOX_NOT_EXIST, shouldRetry: false, smtpCode: '550' },
            { category: types_1.BounceCategory.CONTENT_BLOCKED, shouldRetry: false, smtpCode: '552' },
            { category: types_1.BounceCategory.TEMPORARY_FAILURE, shouldRetry: true, rawMessage: 'temporary failure try again later' },
            { category: types_1.BounceCategory.POLICY_REJECTION, shouldRetry: false, smtpCode: '554' },
            { category: types_1.BounceCategory.POLICY_REJECTION, shouldRetry: true, smtpCode: '451' },
        ];
        for (const tc of testCases) {
            const record = this.parser.parseBounceData({
                recipient: 'test@example.com',
                smtpCode: tc.smtpCode,
                rawMessage: tc.rawMessage || (tc.smtpCode ? `${tc.smtpCode} error` : '')
            });
            if (tc.shouldRetry !== record.retrySuggestion.shouldRetry) {
                return {
                    name: '重试建议逻辑',
                    passed: false,
                    error: `分类 ${record.category} (SMTP: ${tc.smtpCode || 'none'}): 期望重试=${tc.shouldRetry}, 实际=${record.retrySuggestion.shouldRetry}`
                };
            }
        }
        return { name: '重试建议逻辑', passed: true };
    }
    testBatchAggregation() {
        const records = [];
        const now = Date.now();
        for (let i = 0; i < 5; i++) {
            records.push(this.parser.parseBounceData({
                recipient: `user${i}@qq.com`,
                smtpCode: '550',
                batchId: 'batch-001',
                timestamp: now - i * 1000
            }));
        }
        for (let i = 0; i < 3; i++) {
            records.push(this.parser.parseBounceData({
                recipient: `user${i}@gmail.com`,
                smtpCode: '554',
                batchId: 'batch-002',
                timestamp: now - i * 1000
            }));
        }
        const report = this.reportGenerator.generateReport(records);
        if (report.totalRecords !== 8) {
            return { name: '批次聚合', passed: false, error: `期望 8 条记录, 实际 ${report.totalRecords}` };
        }
        if (Object.keys(report.batches).length !== 2) {
            return { name: '批次聚合', passed: false, error: `期望 2 个批次, 实际 ${Object.keys(report.batches).length}` };
        }
        if (report.batches['batch-001']?.totalBounces !== 5) {
            return { name: '批次聚合', passed: false, error: 'batch-001 统计错误' };
        }
        return { name: '批次聚合', passed: true };
    }
    testReportGeneration() {
        const records = [];
        for (let i = 0; i < 10; i++) {
            records.push(this.parser.parseBounceData({
                recipient: `user${i}@qq.com`,
                smtpCode: '550',
                batchId: 'batch-test',
                rawMessage: 'Mailbox not found'
            }));
        }
        const report = this.reportGenerator.generateReport(records);
        if (!report.generatedAt)
            return { name: '报告生成', passed: false, error: '缺少 generatedAt' };
        if (!report.summary)
            return { name: '报告生成', passed: false, error: '缺少 summary' };
        if (!report.overallBreakdown)
            return { name: '报告生成', passed: false, error: '缺少 overallBreakdown' };
        if (!report.recommendations || report.recommendations.length === 0) {
            return { name: '报告生成', passed: false, error: '缺少 recommendations' };
        }
        return { name: '报告生成', passed: true };
    }
    testMultipleBouncesSameRecipient() {
        const records = [];
        const now = Date.now();
        for (let i = 0; i < 3; i++) {
            records.push(this.parser.parseBounceData({
                recipient: 'repeat-user@example.com',
                smtpCode: '550',
                batchId: 'batch-repeat',
                timestamp: now - i * 3600000
            }));
        }
        for (let i = 0; i < 2; i++) {
            records.push(this.parser.parseBounceData({
                recipient: `normal${i}@example.com`,
                smtpCode: '550',
                batchId: 'batch-repeat',
                timestamp: now
            }));
        }
        const report = this.reportGenerator.generateReport(records);
        const batch = report.batches['batch-repeat'];
        if (!batch)
            return { name: '同人多次退信检测', passed: false, error: '未找到批次' };
        if (batch.totalBounces !== 5)
            return { name: '同人多次退信检测', passed: false, error: '总退信数错误' };
        if (batch.uniqueRecipients !== 3)
            return { name: '同人多次退信检测', passed: false, error: `唯一收件人错误: ${batch.uniqueRecipients}` };
        const repeated = batch.repeatedBounces.find(b => b.recipient === 'repeat-user@example.com');
        if (!repeated || repeated.count !== 3) {
            return { name: '同人多次退信检测', passed: false, error: '重复退信统计错误' };
        }
        return { name: '同人多次退信检测', passed: true };
    }
    testOutputFormats() {
        const records = [
            this.parser.parseBounceData({
                recipient: 'test1@example.com',
                smtpCode: '550',
                batchId: 'batch-output'
            }),
            this.parser.parseBounceData({
                recipient: 'test2@example.com',
                smtpCode: '554',
                batchId: 'batch-output'
            })
        ];
        const report = this.reportGenerator.generateReport(records);
        try {
            const jsonPath = this.outputHandler.writeJsonReport(report, 'selfcheck-report.json');
            if (!fs.existsSync(jsonPath)) {
                return { name: '输出格式生成', passed: false, error: 'JSON 文件未生成' };
            }
            const mdPath = this.outputHandler.writeMarkdownReport(report, records, 'selfcheck-report.md');
            if (!fs.existsSync(mdPath)) {
                return { name: '输出格式生成', passed: false, error: 'Markdown 文件未生成' };
            }
            const retryPath = this.outputHandler.writeRetryList(records, 'selfcheck-retry.txt');
            if (!fs.existsSync(retryPath)) {
                return { name: '输出格式生成', passed: false, error: '重试列表未生成' };
            }
            const suppressPath = this.outputHandler.writeSuppressionList(records, 'selfcheck-suppress.txt');
            if (!fs.existsSync(suppressPath)) {
                return { name: '输出格式生成', passed: false, error: '抑制列表未生成' };
            }
        }
        catch (e) {
            return { name: '输出格式生成', passed: false, error: e.message };
        }
        return { name: '输出格式生成', passed: true };
    }
    testEdgeCases() {
        try {
            const emptyReport = this.reportGenerator.generateReport([]);
            if (emptyReport.totalRecords !== 0) {
                return { name: '边界情况处理', passed: false, error: '空记录处理错误' };
            }
            const weirdEmail = this.parser.parseBounceData({
                recipient: 'weird-email+tag@sub.domain.co.uk',
                rawMessage: ''
            });
            if (!weirdEmail.recipient) {
                return { name: '边界情况处理', passed: false, error: '复杂邮箱格式处理错误' };
            }
            const longMessage = this.parser.parseBounceData({
                recipient: 'test@example.com',
                rawMessage: 'A'.repeat(10000) + ' Mailbox not found ' + 'B'.repeat(10000)
            });
            if (longMessage.category !== types_1.BounceCategory.MAILBOX_NOT_EXIST) {
                return { name: '边界情况处理', passed: false, error: '长文本处理错误' };
            }
        }
        catch (e) {
            return { name: '边界情况处理', passed: false, error: e.message };
        }
        return { name: '边界情况处理', passed: true };
    }
    testChineseContent() {
        const testCases = [
            { msg: '收件人邮箱不存在，请核对', category: types_1.BounceCategory.MAILBOX_NOT_EXIST },
            { msg: '该邮件被服务器策略拒收', category: types_1.BounceCategory.POLICY_REJECTION },
            { msg: '邮件内容包含违禁词，已被拦截', category: types_1.BounceCategory.CONTENT_BLOCKED },
            { msg: '系统繁忙，请稍后重试', category: types_1.BounceCategory.TEMPORARY_FAILURE },
        ];
        for (const tc of testCases) {
            const record = this.parser.parseBounceData({
                recipient: 'test@qq.com',
                rawMessage: tc.msg
            });
            if (record.category !== tc.category) {
                return {
                    name: '中文内容识别',
                    passed: false,
                    error: `"${tc.msg}" 被分类为 ${record.category}, 期望 ${tc.category}`
                };
            }
        }
        return { name: '中文内容识别', passed: true };
    }
    testConfidenceLevels() {
        const smtpRecord = this.parser.parseBounceData({
            recipient: 'test@qq.com',
            smtpCode: '550',
            enhancedCode: '5.1.1',
            rawMessage: 'Mailbox not found'
        });
        if (smtpRecord.confidence < 0.8) {
            return { name: '置信度计算', passed: false, error: `多证据置信度不足: ${smtpRecord.confidence}` };
        }
        const weakRecord = this.parser.parseBounceData({
            recipient: 'test@example.com',
            rawMessage: 'some error happened'
        });
        if (weakRecord.category === types_1.BounceCategory.UNKNOWN && weakRecord.confidence > 0.5) {
            return { name: '置信度计算', passed: false, error: '无匹配时置信度应较低' };
        }
        return { name: '置信度计算', passed: true };
    }
}
exports.SelfCheck = SelfCheck;
//# sourceMappingURL=self-check.js.map