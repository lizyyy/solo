"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
class AuditService {
    constructor() {
        this.models = [
            { name: 'SafetyModel-A', provider: 'Vendor-A', version: 'v2.1' },
            { name: 'ContentShield-B', provider: 'Vendor-B', version: 'v1.5' },
            { name: 'HarmDetector-C', provider: 'Vendor-C', version: 'v3.0' }
        ];
        this.rules = [
            { id: 'R001', name: '敏感词检测', severity: 'high' },
            { id: 'R002', name: '暴力内容规则', severity: 'high' },
            { id: 'R003', name: '广告内容检测', severity: 'medium' },
            { id: 'R004', name: '联系方式提取', severity: 'low' },
            { id: 'R005', name: '政治敏感词', severity: 'high' }
        ];
        this.sensitiveWords = ['敏感词1', '敏感词2', '违禁词', '违法', '暴力', '赌博', '诈骗', '反动', '邪教'];
        this.adWords = ['微信', 'qq', '加群', '联系我', '电话', 'vx', 'V信', '扣扣'];
        this.politicalWords = ['敏感政治词', '反动言论'];
    }
    async auditItem(item) {
        const modelResults = await this.runModelAnalysis(item);
        const ruleResults = this.runRuleDetection(item);
        const overallDecision = this.calculateDecision(modelResults, ruleResults);
        const overallConfidence = this.calculateConfidence(modelResults, ruleResults);
        return {
            itemId: item.id,
            item,
            modelResults,
            ruleResults,
            overallDecision,
            overallConfidence,
            timestamp: Date.now()
        };
    }
    async previewAudit(items) {
        const previewItems = await Promise.all(items.map(async (item) => {
            const result = await this.auditItem(item);
            return {
                item,
                prediction: result.overallDecision
            };
        }));
        return {
            totalItems: items.length,
            estimatedReject: previewItems.filter(i => i.prediction === 'reject').length,
            estimatedReview: previewItems.filter(i => i.prediction === 'review').length,
            estimatedPass: previewItems.filter(i => i.prediction === 'pass').length,
            items: previewItems
        };
    }
    async runModelAnalysis(item) {
        return Promise.all(this.models.map(async (model) => {
            const baseScore = this.calculateModelScore(item.content);
            const variance = Math.random() * 0.2 - 0.1;
            const score = Math.min(1, Math.max(0, baseScore + variance));
            let label = 'normal';
            if (score > 0.7)
                label = 'high_risk';
            else if (score > 0.4)
                label = 'medium_risk';
            else if (score > 0.15)
                label = 'low_risk';
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
                modelName: model.name,
                score: Math.round(score * 1000) / 1000,
                label,
                confidence: Math.round((0.7 + Math.random() * 0.3) * 1000) / 1000,
                details: {
                    provider: model.provider,
                    version: model.version,
                    categories: {
                        violence: score * 0.3,
                        adult: score * 0.25,
                        political: score * 0.2,
                        fraud: score * 0.15,
                        other: score * 0.1
                    }
                }
            };
        }));
    }
    calculateModelScore(content) {
        let score = 0;
        const lowerContent = content.toLowerCase();
        for (const word of this.sensitiveWords) {
            if (lowerContent.includes(word)) {
                score += 0.3;
            }
        }
        for (const word of this.adWords) {
            if (lowerContent.includes(word)) {
                score += 0.1;
            }
        }
        for (const word of this.politicalWords) {
            if (lowerContent.includes(word)) {
                score += 0.4;
            }
        }
        if (content.length > 500) {
            score += 0.05;
        }
        if (content.includes('http') || content.includes('www')) {
            score += 0.1;
        }
        return Math.min(1, score);
    }
    runRuleDetection(item) {
        const results = [];
        const content = item.content.toLowerCase();
        for (const word of this.sensitiveWords) {
            if (content.includes(word)) {
                results.push({
                    ruleId: 'R001',
                    ruleName: '敏感词检测',
                    matched: true,
                    matchContent: word,
                    severity: 'high'
                });
                break;
            }
        }
        if (content.includes('暴力') || content.includes('打') || content.includes('杀')) {
            results.push({
                ruleId: 'R002',
                ruleName: '暴力内容规则',
                matched: true,
                matchContent: content.match(/(.{0,10}[打杀暴力].{0,10})/gi)?.[0] || '暴力相关内容',
                severity: 'high'
            });
        }
        let adMatched = false;
        for (const word of this.adWords) {
            if (content.includes(word)) {
                adMatched = true;
                results.push({
                    ruleId: 'R003',
                    ruleName: '广告内容检测',
                    matched: true,
                    matchContent: word,
                    severity: 'medium'
                });
                break;
            }
        }
        const phoneMatch = content.match(/1[3-9]\d{9}/);
        if (phoneMatch) {
            results.push({
                ruleId: 'R004',
                ruleName: '联系方式提取',
                matched: true,
                matchContent: phoneMatch[0],
                severity: 'low'
            });
        }
        for (const word of this.politicalWords) {
            if (content.includes(word)) {
                results.push({
                    ruleId: 'R005',
                    ruleName: '政治敏感词',
                    matched: true,
                    matchContent: word,
                    severity: 'high'
                });
                break;
            }
        }
        for (const rule of this.rules) {
            if (!results.find(r => r.ruleId === rule.id)) {
                results.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    matched: false,
                    severity: rule.severity
                });
            }
        }
        return results;
    }
    calculateDecision(modelResults, ruleResults) {
        const highRiskRules = ruleResults.filter(r => r.matched && r.severity === 'high');
        if (highRiskRules.length > 0) {
            return 'reject';
        }
        const avgModelScore = modelResults.reduce((sum, m) => sum + m.score, 0) / modelResults.length;
        const mediumRiskRules = ruleResults.filter(r => r.matched && r.severity === 'medium');
        if (avgModelScore > 0.6 || mediumRiskRules.length > 0) {
            return 'review';
        }
        if (avgModelScore > 0.3) {
            return 'review';
        }
        return 'pass';
    }
    calculateConfidence(modelResults, ruleResults) {
        const modelConfidence = modelResults.reduce((sum, m) => sum + m.confidence, 0) / modelResults.length;
        const ruleCount = ruleResults.filter(r => r.matched).length;
        const ruleFactor = Math.max(0, 1 - ruleCount * 0.1);
        return Math.round(modelConfidence * ruleFactor * 1000) / 1000;
    }
    detectRuleOverreach(ruleResults) {
        const matchedRules = ruleResults.filter(r => r.matched);
        if (matchedRules.length > 3) {
            return {
                overreached: true,
                reason: '匹配规则过多（>3），可能存在规则过宽问题'
            };
        }
        const lowSeverityMatches = matchedRules.filter(r => r.severity === 'low');
        if (lowSeverityMatches.length > 0 && matchedRules.length === lowSeverityMatches.length) {
            return {
                overreached: true,
                reason: '仅匹配低严重度规则，建议检查是否误判'
            };
        }
        return { overreached: false };
    }
}
exports.AuditService = AuditService;
