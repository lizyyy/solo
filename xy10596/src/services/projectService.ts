import { v4 as uuidv4 } from 'uuid';
import {
  ProjectState,
  SurveyRecord,
  SurveyStatus,
  SurveyAnswer,
  ImportResult,
  CheckResult,
  CheckDetail
} from '../types';
import { Storage } from '../utils/storage';
import { HistoryManager } from '../utils/history';
import { QualityEngine } from '../engine/qualityEngine';
import { QuotaEngine } from '../engine/quotaEngine';
import { createSampleProjectConfig, generateSampleSurveys } from '../data/samples';

export class ProjectService {
  static initializeWithSamples(): ProjectState {
    const config = createSampleProjectConfig();
    const state: ProjectState = {
      config,
      surveys: [],
      quotaUsage: QuotaEngine.initializeQuotaUsage(config.quotaRules),
      lastUpdatedAt: new Date().toISOString(),
      processVersion: 1
    };

    Storage.initialize(state);
    return state;
  }

  static initializeCustom(config: ProjectState['config']): ProjectState {
    const state: ProjectState = {
      config,
      surveys: [],
      quotaUsage: QuotaEngine.initializeQuotaUsage(config.quotaRules),
      lastUpdatedAt: new Date().toISOString(),
      processVersion: 1
    };

    Storage.initialize(state);
    return state;
  }

  static importSurveys(surveys: SurveyAnswer[]): ImportResult {
    const state = Storage.load();
    const result: ImportResult = {
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
            const updatedRecord: SurveyRecord = {
              ...survey,
              status: existing.status,
              rejectReasons: existing.rejectReasons,
              history: [
                ...existing.history,
                HistoryManager.createEntry(
                  '数据更新',
                  existing.status,
                  'system',
                  { reason: '数据源有更新' }
                )
              ],
              processedAt: existing.processedAt,
              isDuplicateOf: existing.isDuplicateOf
            };
            state.surveys[index] = updatedRecord;
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          const newRecord: SurveyRecord = {
            ...survey,
            status: SurveyStatus.PENDING,
            rejectReasons: [],
            history: [
              HistoryManager.createEntry(
                '导入',
                SurveyStatus.PENDING,
                'system',
                { reason: '新问卷导入' }
              )
            ]
          };
          state.surveys.push(newRecord);
          result.imported++;
        }
      } catch (e: any) {
        result.errors.push({
          sourceId: survey.sourceId || survey.id,
          error: e.message
        });
      }
    }

    Storage.save(state);
    return result;
  }

  static checkAll(): CheckResult {
    const state = Storage.load();
    const qualityEngine = new QualityEngine(state.config.qualityRules);
    const quotaEngine = new QuotaEngine(state.config.quotaRules);

    const details: CheckDetail[] = [];
    let processed = 0;
    let skipped = 0;

    state.quotaUsage = QuotaEngine.calculateQuotaUsage(
      state.config.quotaRules,
      state.surveys
    );

    for (let i = 0; i < state.surveys.length; i++) {
      const survey = state.surveys[i];
      const isNew = survey.status === SurveyStatus.PENDING;

      if (
        survey.status === SurveyStatus.MANUALLY_RESERVED ||
        survey.status === SurveyStatus.MANUALLY_REJECTED
      ) {
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

      let updated = QualityEngine.processWithQualityCheck(
        survey,
        state.surveys,
        qualityEngine
      );

      if (updated.status === SurveyStatus.PENDING) {
        state.quotaUsage = QuotaEngine.calculateQuotaUsage(
          state.config.quotaRules,
          state.surveys
        );
        updated = QuotaEngine.processWithQuotaCheck(
          updated,
          state.quotaUsage,
          quotaEngine
        );
      }

      if (updated.status !== survey.status) {
        updated.processedAt = new Date().toISOString();
        processed++;
      } else if (isNew) {
        processed++;
      } else {
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
    state.quotaUsage = QuotaEngine.calculateQuotaUsage(
      state.config.quotaRules,
      state.surveys
    );
    Storage.save(state);

    const stats = this.calculateStats(state.surveys);

    return {
      total: state.surveys.length,
      ...stats,
      processed,
      skipped,
      details
    };
  }

  private static calculateStats(surveys: SurveyRecord[]): {
    valid: number;
    rejected: number;
    overQuota: number;
    needsReview: number;
  } {
    return surveys.reduce(
      (acc, s) => {
        if (s.status === SurveyStatus.VALID || s.status === SurveyStatus.MANUALLY_RESERVED) {
          acc.valid++;
        } else if (s.status === SurveyStatus.REJECTED || s.status === SurveyStatus.MANUALLY_REJECTED) {
          acc.rejected++;
        } else if (s.status === SurveyStatus.OVER_QUOTA) {
          acc.overQuota++;
        } else if (s.status === SurveyStatus.NEEDS_REVIEW) {
          acc.needsReview++;
        }
        return acc;
      },
      { valid: 0, rejected: 0, overQuota: 0, needsReview: 0 }
    );
  }

  static getSurveyDetail(id: string): SurveyRecord | undefined {
    const state = Storage.load();
    return state.surveys.find(s => s.id === id);
  }

  static getQuotaUsage() {
    const state = Storage.load();
    return state.quotaUsage;
  }

  static manuallyReserve(
    surveyId: string,
    operator: string,
    reason: string
  ): SurveyRecord {
    const state = Storage.load();
    const index = state.surveys.findIndex(s => s.id === surveyId);
    
    if (index === -1) {
      throw new Error(`问卷不存在: ${surveyId}`);
    }

    const survey = state.surveys[index];
    const beforeStatus = survey.status;

    const updated = HistoryManager.addToRecord(
      survey,
      '人工保留',
      SurveyStatus.MANUALLY_RESERVED,
      operator,
      {
        reason,
        details: {
          beforeStatus,
          afterStatus: SurveyStatus.MANUALLY_RESERVED
        }
      }
    );

    state.surveys[index] = updated;
    state.quotaUsage = QuotaEngine.calculateQuotaUsage(
      state.config.quotaRules,
      state.surveys
    );
    Storage.save(state);

    return updated;
  }

  static manuallyReject(
    surveyId: string,
    operator: string,
    reason: string
  ): SurveyRecord {
    const state = Storage.load();
    const index = state.surveys.findIndex(s => s.id === surveyId);
    
    if (index === -1) {
      throw new Error(`问卷不存在: ${surveyId}`);
    }

    const survey = state.surveys[index];
    const beforeStatus = survey.status;

    const updated = HistoryManager.addToRecord(
      survey,
      '人工驳回',
      SurveyStatus.MANUALLY_REJECTED,
      operator,
      {
        reason,
        details: {
          beforeStatus,
          afterStatus: SurveyStatus.MANUALLY_REJECTED
        }
      }
    );

    state.surveys[index] = updated;
    state.quotaUsage = QuotaEngine.calculateQuotaUsage(
      state.config.quotaRules,
      state.surveys
    );
    Storage.save(state);

    return updated;
  }

  static generateReport() {
    const state = Storage.load();
    const stats = this.calculateStats(state.surveys);

    const channelStats: Record<string, { total: number; valid: number }> = {};
    const cityStats: Record<string, { total: number; valid: number }> = {};
    const ageStats: Record<string, { total: number; valid: number }> = {};

    for (const survey of state.surveys) {
      const isValid = survey.status === SurveyStatus.VALID || 
                      survey.status === SurveyStatus.MANUALLY_RESERVED;
      
      if (!channelStats[survey.channel]) {
        channelStats[survey.channel] = { total: 0, valid: 0 };
      }
      channelStats[survey.channel].total++;
      if (isValid) channelStats[survey.channel].valid++;

      if (!cityStats[survey.city]) {
        cityStats[survey.city] = { total: 0, valid: 0 };
      }
      cityStats[survey.city].total++;
      if (isValid) cityStats[survey.city].valid++;

      if (!ageStats[survey.ageGroup]) {
        ageStats[survey.ageGroup] = { total: 0, valid: 0 };
      }
      ageStats[survey.ageGroup].total++;
      if (isValid) ageStats[survey.ageGroup].valid++;
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

  static loadSampleData(): ImportResult {
    const samples = generateSampleSurveys();
    return this.importSurveys(samples);
  }

  static getState(): ProjectState {
    return Storage.load();
  }

  static clearData(): void {
    Storage.clear();
  }
}
