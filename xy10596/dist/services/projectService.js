"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const types_1 = require("../types");
const storage_1 = require("../utils/storage");
const history_1 = require("../utils/history");
const qualityEngine_1 = require("../engine/qualityEngine");
const quotaEngine_1 = require("../engine/quotaEngine");
const samples_1 = require("../data/samples");
class ProjectService {
    static initializeWithSamples() {
        const config = (0, samples_1.createSampleProjectConfig)();
        const state = {
            config,
            surveys: [],
            quotaUsage: quotaEngine_1.QuotaEngine.initializeQuotaUsage(config.quotaRules),
            lastUpdatedAt: new Date().toISOString(),
            processVersion: 1
        };
        storage_1.Storage.initialize(state);
        return state;
    }
    static initializeCustom(config) {
        const state = {
            config,
            surveys: [],
            quotaUsage: quotaEngine_1.QuotaEngine.initializeQuotaUsage(config.quotaRules),
            lastUpdatedAt: new Date().toISOString(),
            processVersion: 1
        };
        storage_1.Storage.initialize(state);
        return state;
    }
    static importSurveys(surveys) {
        const state = storage_1.Storage.load();
        const result = {
            total: surveys.length,
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };
        for (const survey of surveys) {
            try {
                const existing = state.surveys.find(s => s.id === survey.id);
                if (existing) {
                    const updatedAt = new Date(survey.submittedAt);
                    const existingAt = new Date(existing.submittedAt);
                    if (updatedAt > existingAt) {
                        const index = state.surveys.findIndex(s => s.id === survey.id);
                        const updatedRecord = {
                            ...survey,
                            status: existing.status,
                            rejectReasons: existing.rejectReasons,
                            history: [
                                ...existing.history,
                                history_1.HistoryManager.createEntry('数据更新', existing.status, 'system', { reason: '数据源有更新' })
                            ],
                            processedAt: existing.processedAt,
                            isDuplicateOf: existing.isDuplicateOf
                        };
                        state.surveys[index] = updatedRecord;
                        result.updated++;
                    }
                    else {
                        result.skipped++;
                    }
                }
                else {
                    const newRecord = {
                        ...survey,
                        status: types_1.SurveyStatus.PENDING,
                        rejectReasons: [],
                        history: [
                            history_1.HistoryManager.createEntry('导入', types_1.SurveyStatus.PENDING, 'system', { reason: '新问卷导入' })
                        ]
                    };
                    state.surveys.push(newRecord);
                    result.imported++;
                }
            }
            catch (e) {
                result.errors.push({
                    sourceId: survey.sourceId || survey.id,
                    error: e.message
                });
            }
        }
        storage_1.Storage.save(state);
        return result;
    }
    static checkAll() {
        const state = storage_1.Storage.load();
        const qualityEngine = new qualityEngine_1.QualityEngine(state.config.qualityRules);
        const quotaEngine = new quotaEngine_1.QuotaEngine(state.config.quotaRules);
        const details = [];
        let processed = 0;
        let skipped = 0;
        state.quotaUsage = quotaEngine_1.QuotaEngine.calculateQuotaUsage(state.config.quotaRules, state.surveys);
        for (let i = 0; i < state.surveys.length; i++) {
            const survey = state.surveys[i];
            const isNew = survey.status === types_1.SurveyStatus.PENDING;
            if (survey.status === types_1.SurveyStatus.MANUALLY_RESERVED ||
                survey.status === types_1.SurveyStatus.MANUALLY_REJECTED) {
                skipped++;
                details.push({
                    surveyId: survey.id,
                    phone: survey.phone,
                    channel: survey.channel,
                    city: survey.city,
                    ageGroup: survey.ageGroup,
                    status: survey.status,
                    reasons: survey.rejectReasons,
                    isNew: false
                });
                continue;
            }
            let updated = qualityEngine_1.QualityEngine.processWithQualityCheck(survey, state.surveys, qualityEngine);
            if (updated.status === types_1.SurveyStatus.PENDING) {
                state.quotaUsage = quotaEngine_1.QuotaEngine.calculateQuotaUsage(state.config.quotaRules, state.surveys);
                updated = quotaEngine_1.QuotaEngine.processWithQuotaCheck(updated, state.quotaUsage, quotaEngine);
            }
            if (updated.status !== survey.status) {
                updated.processedAt = new Date().toISOString();
                processed++;
            }
            else if (isNew) {
                processed++;
            }
            else {
                skipped++;
            }
            state.surveys[i] = updated;
            details.push({
                surveyId: updated.id,
                phone: updated.phone,
                channel: updated.channel,
                city: updated.city,
                ageGroup: updated.ageGroup,
                status: updated.status,
                reasons: updated.rejectReasons,
                isNew
            });
        }
        state.processVersion++;
        state.quotaUsage = quotaEngine_1.QuotaEngine.calculateQuotaUsage(state.config.quotaRules, state.surveys);
        storage_1.Storage.save(state);
        const stats = this.calculateStats(state.surveys);
        return {
            total: state.surveys.length,
            ...stats,
            processed,
            skipped,
            details
        };
    }
    static calculateStats(surveys) {
        return surveys.reduce((acc, s) => {
            if (s.status === types_1.SurveyStatus.VALID || s.status === types_1.SurveyStatus.MANUALLY_RESERVED) {
                acc.valid++;
            }
            else if (s.status === types_1.SurveyStatus.REJECTED || s.status === types_1.SurveyStatus.MANUALLY_REJECTED) {
                acc.rejected++;
            }
            else if (s.status === types_1.SurveyStatus.OVER_QUOTA) {
                acc.overQuota++;
            }
            else if (s.status === types_1.SurveyStatus.NEEDS_REVIEW) {
                acc.needsReview++;
            }
            return acc;
        }, { valid: 0, rejected: 0, overQuota: 0, needsReview: 0 });
    }
    static getSurveyDetail(id) {
        const state = storage_1.Storage.load();
        return state.surveys.find(s => s.id === id);
    }
    static getQuotaUsage() {
        const state = storage_1.Storage.load();
        return state.quotaUsage;
    }
    static manuallyReserve(surveyId, operator, reason) {
        const state = storage_1.Storage.load();
        const index = state.surveys.findIndex(s => s.id === surveyId);
        if (index === -1) {
            throw new Error(`问卷不存在: ${surveyId}`);
        }
        const survey = state.surveys[index];
        const beforeStatus = survey.status;
        const updated = history_1.HistoryManager.addToRecord(survey, '人工保留', types_1.SurveyStatus.MANUALLY_RESERVED, operator, {
            reason,
            details: {
                beforeStatus,
                afterStatus: types_1.SurveyStatus.MANUALLY_RESERVED
            }
        });
        state.surveys[index] = updated;
        state.quotaUsage = quotaEngine_1.QuotaEngine.calculateQuotaUsage(state.config.quotaRules, state.surveys);
        storage_1.Storage.save(state);
        return updated;
    }
    static manuallyReject(surveyId, operator, reason) {
        const state = storage_1.Storage.load();
        const index = state.surveys.findIndex(s => s.id === surveyId);
        if (index === -1) {
            throw new Error(`问卷不存在: ${surveyId}`);
        }
        const survey = state.surveys[index];
        const beforeStatus = survey.status;
        const updated = history_1.HistoryManager.addToRecord(survey, '人工驳回', types_1.SurveyStatus.MANUALLY_REJECTED, operator, {
            reason,
            details: {
                beforeStatus,
                afterStatus: types_1.SurveyStatus.MANUALLY_REJECTED
            }
        });
        state.surveys[index] = updated;
        state.quotaUsage = quotaEngine_1.QuotaEngine.calculateQuotaUsage(state.config.quotaRules, state.surveys);
        storage_1.Storage.save(state);
        return updated;
    }
    static generateReport() {
        const state = storage_1.Storage.load();
        const stats = this.calculateStats(state.surveys);
        const channelStats = {};
        const cityStats = {};
        const ageStats = {};
        for (const survey of state.surveys) {
            const isValid = survey.status === types_1.SurveyStatus.VALID ||
                survey.status === types_1.SurveyStatus.MANUALLY_RESERVED;
            if (!channelStats[survey.channel]) {
                channelStats[survey.channel] = { total: 0, valid: 0 };
            }
            channelStats[survey.channel].total++;
            if (isValid)
                channelStats[survey.channel].valid++;
            if (!cityStats[survey.city]) {
                cityStats[survey.city] = { total: 0, valid: 0 };
            }
            cityStats[survey.city].total++;
            if (isValid)
                cityStats[survey.city].valid++;
            if (!ageStats[survey.ageGroup]) {
                ageStats[survey.ageGroup] = { total: 0, valid: 0 };
            }
            ageStats[survey.ageGroup].total++;
            if (isValid)
                ageStats[survey.ageGroup].valid++;
        }
        const needToFill = state.quotaUsage
            .filter(q => q.remaining > 0)
            .map(q => ({
            rule: q.ruleName,
            criteria: q.criteria,
            need: q.remaining
        }));
        return {
            summary: {
                total: state.surveys.length,
                valid: stats.valid,
                rejected: stats.rejected,
                overQuota: stats.overQuota,
                needsReview: stats.needsReview,
                pending: state.surveys.length - stats.valid - stats.rejected - stats.overQuota - stats.needsReview
            },
            quotaUsage: state.quotaUsage,
            channelStats,
            cityStats,
            ageStats,
            needToFill,
            projectInfo: {
                name: state.config.name,
                lastUpdatedAt: state.lastUpdatedAt,
                processVersion: state.processVersion
            }
        };
    }
    static loadSampleData() {
        const samples = (0, samples_1.generateSampleSurveys)();
        return this.importSurveys(samples);
    }
    static getState() {
        return storage_1.Storage.load();
    }
    static clearData() {
        storage_1.Storage.clear();
    }
}
exports.ProjectService = ProjectService;
