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
exports.BounceParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mailparser_1 = require("mailparser");
const types_1 = require("../types");
const default_1 = require("../config/default");
class BounceParser {
    constructor(config) {
        this.config = {
            ...default_1.defaultConfig,
            ...config,
            providers: config?.providers || default_1.defaultConfig.providers
        };
    }
    async parseEmailFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.parseEmailContent(content, filePath);
    }
    async parseEmailContent(content, sourceId) {
        const parsed = await (0, mailparser_1.simpleParser)(content);
        const recipient = this.extractRecipient(parsed.text || '', parsed.to);
        const smtpCode = this.extractSmtpCode(parsed.text || '');
        const enhancedCode = this.extractEnhancedCode(parsed.text || '');
        const provider = this.detectProvider(recipient, parsed.text || '');
        const subject = parsed.subject || '';
        const { category, confidence, reason } = this.classifyBounce(parsed.text || '', smtpCode, enhancedCode, provider);
        const retrySuggestion = this.generateRetrySuggestion(category, smtpCode);
        return {
            id: sourceId || `bounce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            recipient,
            smtpCode,
            enhancedCode,
            provider,
            batchId: this.extractBatchId(subject, parsed.text || ''),
            rawMessage: parsed.text || content,
            subject,
            timestamp: parsed.date?.getTime() || Date.now(),
            category,
            confidence,
            reason,
            retrySuggestion
        };
    }
    parseBounceData(data) {
        const rawText = data.rawMessage || '';
        const smtpCode = data.smtpCode || this.extractSmtpCode(rawText);
        const enhancedCode = data.enhancedCode || this.extractEnhancedCode(rawText);
        const provider = data.provider || this.detectProvider(data.recipient, rawText);
        const { category, confidence, reason } = this.classifyBounce(rawText, smtpCode, enhancedCode, provider);
        const retrySuggestion = this.generateRetrySuggestion(category, smtpCode);
        return {
            id: `bounce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            recipient: data.recipient,
            smtpCode,
            enhancedCode,
            provider,
            batchId: data.batchId,
            rawMessage: rawText,
            subject: data.subject,
            timestamp: data.timestamp || Date.now(),
            category,
            confidence,
            reason,
            retrySuggestion
        };
    }
    extractRecipient(text, to) {
        const patterns = [
            /Original-Recipient:\s*rfc822;([^\s]+)/i,
            /Final-Recipient:\s*rfc822;([^\s]+)/i,
            /Recipient:\s*([^\s<>"']+@[^\s>]+)/i,
            /The following address\(es\) failed:\s*[\r\n]+\s*([^\s<>"']+@[^\s>]+)/i,
            /收件人[：:]\s*([^\s<>"']+@[^\s>]+)/i,
            /RCPT TO:<([^>]+)>/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1])
                return match[1];
        }
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch)
            return emailMatch[0];
        if (to && to.text) {
            const match = to.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (match)
                return match[0];
        }
        return 'unknown@unknown.com';
    }
    extractSmtpCode(text) {
        const patterns = [
            /\b(550|551|552|553|554|450|451|452|421)\b/,
            /SMTP\s*[Cc]ode\s*[=:]\s*(\d+)/,
            /Diagnostic-Code:\s*smtp;\s*(\d+)/
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match)
                return match[1];
        }
        return undefined;
    }
    extractEnhancedCode(text) {
        const pattern = /\b(4|5)\.\d\.\d\b/;
        const match = text.match(pattern);
        return match?.[0];
    }
    detectProvider(recipient, text) {
        const domain = recipient.split('@')[1]?.toLowerCase() || '';
        for (const provider of this.config.providers) {
            if (provider.patterns.some(p => domain.includes(p))) {
                return provider.name;
            }
            if (provider.smtpPatterns.some(p => text.toLowerCase().includes(p))) {
                return provider.name;
            }
        }
        return undefined;
    }
    extractBatchId(subject, text) {
        const patterns = [
            /\[batch:([^\]]+)\]/i,
            /batch[_\-]?id[=:]\s*([^\s,]+)/i,
            /批次[：:]\s*([^\s,]+)/i,
            /campaign[_\-]?id[=:]\s*([^\s,]+)/i
        ];
        const combined = subject + ' ' + text;
        for (const pattern of patterns) {
            const match = combined.match(pattern);
            if (match)
                return match[1];
        }
        return undefined;
    }
    classifyBounce(text, smtpCode, enhancedCode, provider) {
        const lowerText = text.toLowerCase();
        let category = types_1.BounceCategory.UNKNOWN;
        let confidence = 0;
        let reason = '无法确定退信原因';
        if (enhancedCode && default_1.smtpCodeMappings[enhancedCode]) {
            const mapping = default_1.smtpCodeMappings[enhancedCode];
            category = mapping.category;
            confidence = 0.85;
            reason = mapping.reason;
        }
        if (smtpCode && default_1.smtpCodeMappings[smtpCode] && category === types_1.BounceCategory.UNKNOWN) {
            const mapping = default_1.smtpCodeMappings[smtpCode];
            category = mapping.category;
            confidence = 0.8;
            reason = mapping.reason;
        }
        if (smtpCode && default_1.smtpCodeMappings[smtpCode] && confidence < 0.8) {
            const mapping = default_1.smtpCodeMappings[smtpCode];
            const smtpCategory = mapping.category;
            if (smtpCategory === category) {
                confidence = 0.8;
                reason = mapping.reason;
            }
        }
        const providerConfig = this.config.providers.find(p => p.name === provider);
        if (providerConfig) {
            const { category: providerCategory, confidence: providerConfidence } = this.matchProviderPatterns(lowerText, providerConfig);
            if (providerConfidence > confidence) {
                category = providerCategory;
                confidence = providerConfidence;
                reason = this.getReasonForCategory(category, provider || 'unknown');
            }
        }
        const { category: generalCategory, confidence: generalConfidence, matchedPattern } = this.matchGeneralPatterns(lowerText);
        if (generalConfidence > 0) {
            const isHardEvidence = generalCategory === types_1.BounceCategory.MAILBOX_NOT_EXIST ||
                generalCategory === types_1.BounceCategory.CONTENT_BLOCKED;
            const shouldOverridePolicy = isHardEvidence && category === types_1.BounceCategory.POLICY_REJECTION;
            const shouldApplyGeneral = shouldOverridePolicy ||
                category === types_1.BounceCategory.UNKNOWN ||
                generalConfidence > confidence;
            if (shouldApplyGeneral) {
                if (shouldOverridePolicy) {
                    category = generalCategory;
                    confidence = Math.max(generalConfidence, confidence);
                }
                else if (category === types_1.BounceCategory.UNKNOWN || generalConfidence > confidence) {
                    category = generalCategory;
                    confidence = Math.max(generalConfidence, confidence);
                }
                reason = matchedPattern
                    ? `匹配关键词: "${matchedPattern}"`
                    : this.getReasonForCategory(category, '通用规则');
            }
            else if (generalCategory === category && matchedPattern) {
                reason = `匹配关键词: "${matchedPattern}"`;
            }
        }
        return { category, confidence, reason };
    }
    matchProviderPatterns(text, provider) {
        const patterns = [
            { category: types_1.BounceCategory.MAILBOX_NOT_EXIST, patterns: provider.mailboxNotExist },
            { category: types_1.BounceCategory.CONTENT_BLOCKED, patterns: provider.contentBlocked },
            { category: types_1.BounceCategory.TEMPORARY_FAILURE, patterns: provider.temporaryFailure },
            { category: types_1.BounceCategory.POLICY_REJECTION, patterns: provider.policyRejection }
        ];
        for (const { category, patterns: categoryPatterns } of patterns) {
            const matches = categoryPatterns.filter(p => new RegExp(p.toLowerCase()).test(text)).length;
            if (matches > 0) {
                return {
                    category,
                    confidence: Math.min(0.7 + matches * 0.1, 0.95)
                };
            }
        }
        return { category: types_1.BounceCategory.UNKNOWN, confidence: 0 };
    }
    matchGeneralPatterns(text) {
        const patternMap = [
            {
                category: types_1.BounceCategory.MAILBOX_NOT_EXIST,
                patterns: [
                    'user unknown', 'mailbox not found', 'no such user',
                    'recipient.*invalid', 'address.*rejected', 'not exist',
                    '不存在', '用户不存在', '收件人不存在', '邮箱不存在',
                    'mailbox.*unavailable', 'recipient.*unknown'
                ]
            },
            {
                category: types_1.BounceCategory.CONTENT_BLOCKED,
                patterns: [
                    'spam', '垃圾邮件', 'virus', '恶意', '违禁',
                    'phish', 'malware', 'content.*reject',
                    '内容被拦', '内容违规', '敏感词', '垃圾内容',
                    '违规关键词', '内容被拦截'
                ]
            },
            {
                category: types_1.BounceCategory.TEMPORARY_FAILURE,
                patterns: [
                    'temporary', 'deferred', 'try again', 'later',
                    'timeout', 'busy', '临时', '稍后', '4\\d{2}',
                    'service.*unavailable', 'system busy', 'try again later'
                ]
            },
            {
                category: types_1.BounceCategory.POLICY_REJECTION,
                patterns: [
                    'spf.*fail', 'dmarc', 'dkim.*fail', 'ip.*block',
                    'reputation', '黑名单', 'blocklist', 'policy',
                    'frequency', 'limit', '速率', '频率',
                    '策略拒收', '被拒收', '拒绝接收', 'policy.*reject',
                    'unsolicited', 'blocked'
                ]
            }
        ];
        for (const { category, patterns } of patternMap) {
            for (const pattern of patterns) {
                if (new RegExp(pattern.toLowerCase()).test(text)) {
                    return {
                        category,
                        confidence: 0.6,
                        matchedPattern: pattern
                    };
                }
            }
        }
        return { category: types_1.BounceCategory.UNKNOWN, confidence: 0 };
    }
    getReasonForCategory(category, source) {
        const reasons = {
            [types_1.BounceCategory.MAILBOX_NOT_EXIST]: '邮箱地址不存在或已被注销',
            [types_1.BounceCategory.POLICY_REJECTION]: '被对方邮件策略拒收（IP/域名/发送频率）',
            [types_1.BounceCategory.CONTENT_BLOCKED]: '邮件内容被判定为垃圾邮件或包含违规内容',
            [types_1.BounceCategory.TEMPORARY_FAILURE]: '临时性失败，可稍后重试',
            [types_1.BounceCategory.UNKNOWN]: '无法确定具体退信原因'
        };
        return `${reasons[category]} (${source})`;
    }
    generateRetrySuggestion(category, smtpCode) {
        const { retry } = this.config;
        switch (category) {
            case types_1.BounceCategory.MAILBOX_NOT_EXIST:
                return {
                    shouldRetry: false,
                    maxRetries: 0,
                    reason: '邮箱不存在，重试无效'
                };
            case types_1.BounceCategory.TEMPORARY_FAILURE:
                return {
                    shouldRetry: true,
                    retryAfterHours: retry.temporaryFailureHours,
                    maxRetries: retry.maxRetries,
                    reason: '临时性故障，建议等待后重试'
                };
            case types_1.BounceCategory.POLICY_REJECTION:
                if (smtpCode && ['450', '451', '452'].includes(smtpCode)) {
                    return {
                        shouldRetry: true,
                        retryAfterHours: retry.policyRetryHours,
                        maxRetries: 2,
                        reason: '策略临时限制，可间隔较长时间后重试'
                    };
                }
                return {
                    shouldRetry: false,
                    maxRetries: 0,
                    reason: '硬策略拒绝，需先解决发件信誉问题'
                };
            case types_1.BounceCategory.CONTENT_BLOCKED:
                return {
                    shouldRetry: false,
                    maxRetries: 0,
                    reason: '内容问题，需修改邮件内容后重发'
                };
            default:
                return {
                    shouldRetry: false,
                    maxRetries: 1,
                    reason: '原因未知，可尝试一次重试'
                };
        }
    }
    async parseDirectory(dirPath) {
        const files = fs.readdirSync(dirPath)
            .filter(f => f.endsWith('.eml') || f.endsWith('.txt'))
            .map(f => path.join(dirPath, f));
        const records = [];
        for (const file of files) {
            try {
                const record = await this.parseEmailFile(file);
                records.push(record);
            }
            catch (e) {
                console.error(`解析文件失败 ${file}:`, e.message);
            }
        }
        return records;
    }
}
exports.BounceParser = BounceParser;
//# sourceMappingURL=bounce-parser.js.map