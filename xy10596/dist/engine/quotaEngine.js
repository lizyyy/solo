"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaEngine = void 0;
const types_1 = require("../types");
const history_1 = require("../utils/history");
class QuotaEngine {
    constructor(rules) {
        this.rules = rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    static initializeQuotaUsage(rules) {
        return rules.map(rule => ({
            ruleId: rule.id,
            ruleName: rule.name,
            type: rule.type,
            criteria: rule.criteria,
            limit: rule.limit,
            used: 0,
            remaining: rule.limit,
            overQuota: 0
        }));
    }
    static calculateQuotaUsage(rules, surveys) {
        const validSurveys = surveys.filter(s => s.status === types_1.SurveyStatus.VALID || s.status === types_1.SurveyStatus.MANUALLY_RESERVED);
        return rules.map(rule => {
            const used = validSurveys.filter(s => this.matchesRule(s, rule)).length;
            return {
                ruleId: rule.id,
                ruleName: rule.name,
                type: rule.type,
                criteria: rule.criteria,
                limit: rule.limit,
                used,
                remaining: Math.max(0, rule.limit - used),
                overQuota: Math.max(0, used - rule.limit)
            };
        });
    }
    check(survey, quotaUsage) {
        const applicableRules = this.rules.filter(r => QuotaEngine.matchesRule(survey, r));
        if (applicableRules.length === 0) {
            return {
                passed: true,
                overQuota: false,
                overQuotaRules: [],
                details: { message: '无匹配的配额规则' }
            };
        }
        const overQuotaRules = [];
        const details = {};
        for (const rule of applicableRules) {
            const usage = quotaUsage.find(u => u.ruleId === rule.id);
            if (usage && usage.remaining <= 0) {
                overQuotaRules.push(rule.name);
                details[rule.id] = {
                    ruleName: rule.name,
                    limit: usage.limit,
                    used: usage.used,
                    remaining: usage.remaining
                };
            }
        }
        return {
            passed: overQuotaRules.length === 0,
            overQuota: overQuotaRules.length > 0,
            overQuotaRules,
            details
        };
    }
    static matchesRule(survey, rule) {
        const criteria = rule.criteria;
        for (const [key, value] of Object.entries(criteria)) {
            const surveyValue = survey[key];
            if (String(surveyValue) !== value) {
                return false;
            }
        }
        return true;
    }
    static processWithQuotaCheck(survey, quotaUsage, engine) {
        const result = engine.check(survey, quotaUsage);
        if (result.overQuota) {
            return history_1.HistoryManager.addToRecord(survey, '配额检查', types_1.SurveyStatus.OVER_QUOTA, 'system', {
                reason: `配额超限: ${result.overQuotaRules.join(', ')}`,
                details: result.details
            });
        }
        return history_1.HistoryManager.addToRecord(survey, '配额检查', types_1.SurveyStatus.VALID, 'system', {
            reason: '配额检查通过',
            details: result.details
        });
    }
    static getRulesForSurvey(survey, rules) {
        return rules.filter(r => this.matchesRule(survey, r));
    }
}
exports.QuotaEngine = QuotaEngine;
