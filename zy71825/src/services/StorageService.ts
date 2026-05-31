import { LevelData, PlayerRecord, RecordHistory } from '../types';

const STORAGE_KEYS = {
  LEVELS: 'gh_guardian_levels',
  RECORDS: 'gh_guardian_records',
  HISTORY: 'gh_guardian_history',
  LAST_SYNC: 'gh_guardian_last_sync',
  SESSION_ID: 'gh_guardian_session'
};

export class StorageService {
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static saveLevels(levels: LevelData[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(levels));
    } catch (error) {
      throw new Error('保存关卡数据失败，请检查浏览器存储空间是否充足');
    }
  }

  static getLevels(): LevelData[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEVELS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('读取关卡数据失败，返回空数据');
      return [];
    }
  }

  static saveRecords(records: PlayerRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    } catch (error) {
      throw new Error('保存玩家记录失败，请检查浏览器存储空间是否充足');
    }
  }

  static getRecords(): PlayerRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('读取玩家记录失败，返回空数据');
      return [];
    }
  }

  static addRecord(record: Omit<PlayerRecord, 'id'>): PlayerRecord {
    const records = this.getRecords();
    const newRecord: PlayerRecord = {
      ...record,
      id: this.generateId()
    };
    records.push(newRecord);
    this.saveRecords(records);
    this.addHistory({
      recordId: newRecord.id,
      action: 'created',
      oldValue: {},
      newValue: newRecord,
      operator: 'system',
      timestamp: Date.now()
    });
    return newRecord;
  }

  static updateRecord(id: string, updates: Partial<PlayerRecord>, operator: string): void {
    const records = this.getRecords();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error('找不到该记录，可能已被删除');
    }
    const oldValue = { ...records[index] };
    records[index] = { ...records[index], ...updates };
    this.saveRecords(records);

    const action = updates.rewardStatus === 'confirmed' ? 'confirmed' :
                   updates.rewardStatus === 'corrected' ? 'corrected' :
                   updates.rewardStatus === 'topped_up' ? 'topped_up' : 'updated';
    
    this.addHistory({
      recordId: id,
      action,
      oldValue,
      newValue: updates,
      operator,
      timestamp: Date.now()
    });
  }

  static saveHistory(history: RecordHistory[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (error) {
      throw new Error('保存历史记录失败');
    }
  }

  static getHistory(): RecordHistory[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('读取历史记录失败，返回空数据');
      return [];
    }
  }

  static addHistory(history: Omit<RecordHistory, 'id'>): RecordHistory {
    const histories = this.getHistory();
    const newHistory: RecordHistory = {
      ...history,
      id: this.generateId()
    };
    histories.push(newHistory);
    this.saveHistory(histories);
    return newHistory;
  }

  static getHistoryByRecordId(recordId: string): RecordHistory[] {
    return this.getHistory().filter(h => h.recordId === recordId);
  }

  static clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }

  static exportAllData(): string {
    return JSON.stringify({
      levels: this.getLevels(),
      records: this.getRecords(),
      history: this.getHistory(),
      exportedAt: Date.now()
    }, null, 2);
  }

  static importAllData(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (data.levels) this.saveLevels(data.levels);
      if (data.records) this.saveRecords(data.records);
      if (data.history) this.saveHistory(data.history);
      return { success: true, message: '数据导入成功' };
    } catch (error) {
      return { success: false, message: '数据格式不正确，请检查导入文件' };
    }
  }

  static getLastSyncTime(): number | null {
    const time = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return time ? parseInt(time, 10) : null;
  }

  static setLastSyncTime(time: number): void {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, time.toString());
  }
}
