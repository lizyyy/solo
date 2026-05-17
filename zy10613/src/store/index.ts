import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GrayReleaseRecord, HistoryRecord, GrayReleaseStatus } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gray-release.json');
const GROUP_TEMPLATE_HISTORY_FILE = path.join(DATA_DIR, 'group-template-history.json');

interface GroupTemplateHistory {
  [groupId: string]: {
    templateVersion: string;
    robotId: string;
    lastSendTime: string;
  };
}

interface DataStore {
  records: GrayReleaseRecord[];
  groupTemplateHistory: GroupTemplateHistory;
}

class LocalDataStore {
  private data: DataStore;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DataStore {
    const defaultData: DataStore = {
      records: [],
      groupTemplateHistory: {}
    };

    try {
      if (fs.existsSync(DATA_FILE)) {
        const recordsContent = fs.readFileSync(DATA_FILE, 'utf-8');
        defaultData.records = JSON.parse(recordsContent);
      }
      if (fs.existsSync(GROUP_TEMPLATE_HISTORY_FILE)) {
        const historyContent = fs.readFileSync(GROUP_TEMPLATE_HISTORY_FILE, 'utf-8');
        defaultData.groupTemplateHistory = JSON.parse(historyContent);
      }
    } catch (error) {
      console.warn('加载数据文件失败，使用默认空数据:', error);
    }

    return defaultData;
  }

  private saveData(): void {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data.records, null, 2));
      fs.writeFileSync(GROUP_TEMPLATE_HISTORY_FILE, JSON.stringify(this.data.groupTemplateHistory, null, 2));
    } catch (error) {
      console.error('保存数据失败:', error);
      throw new Error('数据保存失败');
    }
  }

  async getAllRecords(): Promise<GrayReleaseRecord[]> {
    return [...this.data.records];
  }

  async getRecordById(id: string): Promise<GrayReleaseRecord | null> {
    const record = this.data.records.find(r => r.id === id);
    return record ? { ...record } : null;
  }

  async createRecord(record: Omit<GrayReleaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>): Promise<GrayReleaseRecord> {
    const now = new Date().toISOString();
    const newRecord: GrayReleaseRecord = {
      ...record,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      history: [{
        id: uuidv4(),
        action: '创建记录',
        newStatus: record.status,
        operator: record.createdBy,
        remark: '初始化创建',
        timestamp: now
      }]
    };

    this.data.records.unshift(newRecord);
    this.saveData();
    return newRecord;
  }

  async updateRecord(id: string, updates: Partial<GrayReleaseRecord>, operator: string, actionRemark: string): Promise<GrayReleaseRecord | null> {
    const index = this.data.records.findIndex(r => r.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const oldRecord = this.data.records[index];
    const historyRecord: HistoryRecord = {
      id: uuidv4(),
      action: actionRemark,
      previousStatus: oldRecord.status,
      newStatus: updates.status,
      operator,
      remark: updates.remark || actionRemark,
      timestamp: now
    };

    const updatedRecord: GrayReleaseRecord = {
      ...oldRecord,
      ...updates,
      updatedAt: now,
      history: [...oldRecord.history, historyRecord]
    };

    this.data.records[index] = updatedRecord;
    this.saveData();
    return updatedRecord;
  }

  async addHistory(id: string, history: Omit<HistoryRecord, 'id' | 'timestamp'>): Promise<GrayReleaseRecord | null> {
    const index = this.data.records.findIndex(r => r.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const record = this.data.records[index];
    const newHistory: HistoryRecord = {
      ...history,
      id: uuidv4(),
      timestamp: now
    };

    record.history.push(newHistory);
    record.updatedAt = now;
    this.saveData();
    return record;
  }

  async getGroupTemplateHistory(groupId: string): Promise<GroupTemplateHistory[string] | null> {
    return this.data.groupTemplateHistory[groupId] || null;
  }

  async updateGroupTemplateHistory(groupId: string, groupName: string, templateVersion: string, robotId: string): Promise<void> {
    this.data.groupTemplateHistory[groupId] = {
      templateVersion,
      robotId,
      lastSendTime: new Date().toISOString()
    };
    this.saveData();
  }

  async getAllGroupTemplateHistory(): Promise<GroupTemplateHistory> {
    return { ...this.data.groupTemplateHistory };
  }

  async batchCreateRecords(records: Array<Omit<GrayReleaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>>): Promise<GrayReleaseRecord[]> {
    const now = new Date().toISOString();
    const createdRecords: GrayReleaseRecord[] = [];

    for (const record of records) {
      const newRecord: GrayReleaseRecord = {
        ...record,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        history: [{
          id: uuidv4(),
          action: '批量导入',
          newStatus: record.status,
          operator: record.createdBy,
          remark: '批量导入旧记录',
          timestamp: now
        }]
      };
      createdRecords.push(newRecord);
    }

    this.data.records = [...createdRecords, ...this.data.records];
    this.saveData();
    return createdRecords;
  }
}

export const dataStore = new LocalDataStore();
