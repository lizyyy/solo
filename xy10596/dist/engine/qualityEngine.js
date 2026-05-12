"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityEngine = void 0;
const types_1 = require("../types");
const history_1 = require("../utils/history");
class QualityEngine {
    constructor(rules) {
        this.rules = rules.filter(r => r.enabled);
    }
    check(survey, allSurveys) {
        const reasons = [];
        const details = {};
        for (const rule of this.rules) {
            const result = this.applyRule(rule, survey, allSurveys);
            if (!result.passed) {
                reasons.push(...result.reasons);
                details[rule.id] = result.details;
            }
        }
        return {
            passed: reasons.length === 0,
            reasons,
            details
        };
    }
    applyRule(rule, survey, allSurveys) {
        switch (rule.type) {
            case 'duplicate_phone':
                return this.checkDuplicatePhone(survey, allSurveys, rule);
            case 'min_duration':
                return this.checkMinDuration(survey, rule);
            case 'all_same_options':
                return this.checkAllSameOptions(survey, rule);
            case 'custom':
                return { passed: true, reasons: [], details: {} };
            default:
                return { passed: true, reasons: [], details: {} };
        }
    }
    checkDuplicatePhone(survey, allSurveys, rule) {
        const duplicates = allSurveys.filter(s => s.id !== survey.id &&
            s.phone === survey.phone &&
            (s.status === types_1.SurveyStatus.VALID || s.status === types_1.SurveyStatus.MANUALLY_RESERVED));
        if (duplicates.length > 0) {
            return {
                passed: false,
                reasons: [types_1.RejectReason.DUPLICATE_PHONE],
                details: {
                    rule: rule.name,
                    duplicateCount: duplicates.length,
                    duplicateIds: duplicates.map(d => d.id)
                }
            };
        }
        return { passed: true, reasons: [], details: {} };
    }
    checkMinDuration(survey, rule) {
        const minDuration = rule.config.minSeconds || 60;
        if (survey.duration < minDuration) {
            return {
                passed: false,
                reasons: [types_1.RejectReason.TOO_FAST],
                details: {
                    rule: rule.name,
                    expected: minDuration,
                    actual: survey.duration
                }
            };
        }
        return { passed: true, reasons: [], details: {} };
    }
    checkAllSameOptions(survey, rule) {
        const answers = Object.values(survey.answers);
        if (answers.length < 3) {
            return { passed: true, reasons: [], details: {} };
        }
        const firstAnswer = JSON.stringify(answers[0]);
        const allSame = answers.every(a => JSON.stringify(a) === firstAnswer);
        if (allSame) {
            return {
                passed: false,
                reasons: [types_1.RejectReason.ALL_SAME_OPTIONS],
                details: {
                    rule: rule.name,
                    totalQuestions: answers.length,
                    sameValue: firstAnswer
                }
            };
        }
        return { passed: true, reasons: [], details: {} };
    }
    static processWithQualityCheck(survey, allSurveys, engine) {
        const result = engine.check(survey, allSurveys);
        if (!result.passed) {
            return history_1.HistoryManager.addToRecord(survey, '质量检查', types_1.SurveyStatus.REJECTED, 'system', {
                reason: `质量检查失败: ${result.reasons.join(', ')}`,
                details: result.details
            });
        }
        return history_1.HistoryManager.addToRecord(survey, '质量检查', types_1.SurveyStatus.PENDING, 'system', {
            reason: '质量检查通过，等待配额检查',
            details: result.details
        });
    }
}
exports.QualityEngine = QualityEngine;
