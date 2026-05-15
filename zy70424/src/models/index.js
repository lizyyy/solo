const { v4: uuidv4 } = require('uuid');
const storage = require('../utils/storage');

const MEETING_RECORDS_FILE = 'meeting-records.json';
const FAILED_ITEMS_FILE = 'failed-items.json';
const CACHE_FILE = 'cache.json';
const ROLLBACK_CANDIDATES_FILE = 'rollback-candidates.json';
const SEARCH_REPORTS_FILE = 'search-reports.json';

class MeetingRecord {
  static create(data) {
    return {
      id: uuidv4(),
      title: data.title,
      department: data.department,
      meetingDate: data.meetingDate,
      attendees: data.attendees || [],
      summary: data.summary,
      attachments: data.attachments || [],
      authPaths: data.authPaths || [],
      status: data.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processedAt: null
    };
  }

  static async getAll() {
    return await storage.readJSON(MEETING_RECORDS_FILE, []);
  }

  static async getById(id) {
    const records = await this.getAll();
    return records.find(r => r.id === id);
  }

  static async createRecord(data) {
    const record = this.create(data);
    await storage.appendToArray(MEETING_RECORDS_FILE, record);
    return record;
  }

  static async update(id, updates) {
    await storage.updateArray(
      MEETING_RECORDS_FILE,
      r => r.id === id,
      r => ({ ...r, ...updates, updatedAt: new Date().toISOString() })
    );
    return await this.getById(id);
  }
}

class FailedItem {
  static create(data) {
    return {
      id: uuidv4(),
      recordId: data.recordId,
      operation: data.operation,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      inputData: data.inputData,
      timestamp: new Date().toISOString(),
      handled: false,
      handlerNote: null
    };
  }

  static async getAll() {
    return await storage.readJSON(FAILED_ITEMS_FILE, []);
  }

  static async createItem(data) {
    const item = this.create(data);
    await storage.appendToArray(FAILED_ITEMS_FILE, item);
    return item;
  }
}

class CacheManager {
  static async get(key) {
    const cache = await storage.readJSON(CACHE_FILE, {});
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      delete cache[key];
      await storage.writeJSON(CACHE_FILE, cache);
      return null;
    }
    return entry.value;
  }

  static async set(key, value, ttl = 300000) {
    const cache = await storage.readJSON(CACHE_FILE, {});
    cache[key] = {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: new Date().toISOString()
    };
    await storage.writeJSON(CACHE_FILE, cache);
  }

  static async isStale(key) {
    const cache = await storage.readJSON(CACHE_FILE, {});
    const entry = cache[key];
    if (!entry) return true;
    return Date.now() > entry.expiresAt;
  }

  static async refresh(key, value, ttl = 300000) {
    await this.set(key, value, ttl);
  }
}

class RollbackManager {
  static async generateCandidates(operationType, criteria) {
    const candidates = {
      id: uuidv4(),
      operationType,
      criteria,
      items: [],
      generatedAt: new Date().toISOString(),
      approved: false,
      executed: false
    };
    
    const records = await MeetingRecord.getAll();
    const matched = records.filter(r => {
      if (criteria.status && r.status !== criteria.status) return false;
      if (criteria.department && r.department !== criteria.department) return false;
      if (criteria.dateRange) {
        const date = new Date(r.createdAt);
        if (date < new Date(criteria.dateRange.start) ||
            date > new Date(criteria.dateRange.end)) return false;
      }
      return true;
    });

    candidates.items = matched.map(r => ({
      id: r.id,
      title: r.title,
      department: r.department,
      createdAt: r.createdAt,
      impact: `删除${r.attachments.length}个附件`,
      risk: r.status === 'completed' ? 'high' : 'low'
    }));

    const allCandidates = await storage.readJSON(ROLLBACK_CANDIDATES_FILE, []);
    allCandidates.push(candidates);
    await storage.writeJSON(ROLLBACK_CANDIDATES_FILE, allCandidates);
    return candidates;
  }

  static async getCandidates() {
    return await storage.readJSON(ROLLBACK_CANDIDATES_FILE, []);
  }

  static async approveCandidate(candidateId, approver, approvalNote) {
    const allCandidates = await storage.readJSON(ROLLBACK_CANDIDATES_FILE, []);
    const candidate = allCandidates.find(c => c.id === candidateId);
    if (!candidate) throw new Error('候选清单不存在');
    if (candidate.executed) throw new Error('候选清单已执行，无法重复审批');
    
    candidate.approved = true;
    candidate.approvedAt = new Date().toISOString();
    candidate.approver = approver || 'system';
    candidate.approvalNote = approvalNote || '';
    await storage.writeJSON(ROLLBACK_CANDIDATES_FILE, allCandidates);
    return candidate;
  }

  static async executeRollback(candidateId) {
    const allCandidates = await storage.readJSON(ROLLBACK_CANDIDATES_FILE, []);
    const candidate = allCandidates.find(c => c.id === candidateId);
    if (!candidate) throw new Error('候选清单不存在');
    if (!candidate.approved) throw new Error('候选清单未审批，请先调用审批接口');
    if (candidate.executed) throw new Error('候选清单已执行，无法重复执行');
    
    for (const item of candidate.items) {
      await MeetingRecord.update(item.id, { status: 'rolled_back' });
    }
    
    candidate.executed = true;
    candidate.executedAt = new Date().toISOString();
    await storage.writeJSON(ROLLBACK_CANDIDATES_FILE, allCandidates);
    return candidate;
  }
}

class SearchReport {
  static create(data) {
    return {
      id: uuidv4(),
      searchTerm: data.searchTerm,
      recordId: data.recordId,
      recordTitle: data.recordTitle,
      matchedContent: data.matchedContent,
      confidence: data.confidence,
      reviewer: null,
      reviewStatus: 'pending',
      reviewComment: null,
      createdAt: new Date().toISOString()
    };
  }

  static async getAll() {
    return await storage.readJSON(SEARCH_REPORTS_FILE, []);
  }

  static async createReport(data) {
    const report = this.create(data);
    await storage.appendToArray(SEARCH_REPORTS_FILE, report);
    return report;
  }

  static generateExportSummary(report) {
    return `[搜索词:${report.searchTerm}] → [匹配记录:${report.recordTitle}] → [结论:${report.reviewStatus || '待复核'}]`;
  }
}

module.exports = {
  MeetingRecord,
  FailedItem,
  CacheManager,
  RollbackManager,
  SearchReport
};
