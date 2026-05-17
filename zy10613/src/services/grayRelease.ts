import { dataStore } from '../store';
import {
  GrayReleaseRecord,
  GrayReleaseStatus,
  BatchImportResult,
  ImportError,
  ConflictInfo
} from '../types';

const VALID_STATUSES = Object.values(GrayReleaseStatus);

export class GrayReleaseService {
  async getAllRecords(): Promise<GrayReleaseRecord[]> {
    return dataStore.getAllRecords();
  }

  async getRecordById(id: string): Promise<GrayReleaseRecord | null> {
    return dataStore.getRecordById(id);
  }

  async createRecord(record: Omit<GrayReleaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>): Promise<GrayReleaseRecord> {
    this.validateRecord(record);
    return dataStore.createRecord(record);
  }

  async updateRecord(
    id: string,
    updates: Partial<GrayReleaseRecord>,
    operator: string,
    actionRemark: string
  ): Promise<GrayReleaseRecord | null> {
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      throw new Error(`无效的状态值: ${updates.status}`);
    }
    return dataStore.updateRecord(id, updates, operator, actionRemark);
  }

  async checkConflicts(record: { grayGroups: string[]; templateVersion: string; robotId: string }): Promise<ConflictInfo> {
    const groupHistory = await dataStore.getAllGroupTemplateHistory();
    const conflictDetails: ConflictInfo['details'] = [];

    for (const groupId of record.grayGroups) {
      const history = groupHistory[groupId];
      if (history && history.templateVersion !== record.templateVersion) {
        if (history.robotId === record.robotId) {
          conflictDetails.push({
            groupId,
            groupName: groupId,
            oldTemplateVersion: history.templateVersion,
            newTemplateVersion: record.templateVersion,
            lastSendTime: history.lastSendTime
          });
        }
      }
    }

    if (conflictDetails.length > 0) {
      return {
        hasConflict: true,
        reason: `检测到 ${conflictDetails.length} 个灰度群存在新旧模板交替发送情况，这些群组同时使用了不同版本的模板`,
        details: conflictDetails
      };
    }

    return { hasConflict: false, reason: '', details: [] };
  }

  async startGrayRelease(id: string, operator: string): Promise<GrayReleaseRecord | null> {
    const record = await dataStore.getRecordById(id);
    if (!record) return null;

    if (record.status !== GrayReleaseStatus.DRAFT && record.status !== GrayReleaseStatus.PENDING_MANUAL) {
      throw new Error('只有草稿或待人工处理状态的记录才能开始灰度');
    }

    const conflictInfo = await this.checkConflicts(record);
    if (conflictInfo.hasConflict) {
      return dataStore.updateRecord(
        id,
        {
          status: GrayReleaseStatus.PENDING_MANUAL,
          conflictReason: conflictInfo.reason
        },
        operator,
        '检测到冲突，转为待人工处理'
      );
    }

    for (const groupId of record.grayGroups) {
      await dataStore.updateGroupTemplateHistory(
        groupId,
        groupId,
        record.templateVersion,
        record.robotId
      );
    }

    return dataStore.updateRecord(
      id,
      { status: GrayReleaseStatus.IN_GRAY },
      operator,
      '开始灰度发布'
    );
  }

  async fullRelease(id: string, operator: string): Promise<GrayReleaseRecord | null> {
    const record = await dataStore.getRecordById(id);
    if (!record) return null;

    if (record.status !== GrayReleaseStatus.IN_GRAY) {
      throw new Error('只有灰度中状态的记录才能全量发布');
    }

    return dataStore.updateRecord(
      id,
      { status: GrayReleaseStatus.FULL_RELEASE },
      operator,
      '完成全量发布'
    );
  }

  async rollback(id: string, operator: string, reason: string): Promise<GrayReleaseRecord | null> {
    const record = await dataStore.getRecordById(id);
    if (!record) return null;

    if (![GrayReleaseStatus.IN_GRAY, GrayReleaseStatus.FULL_RELEASE].includes(record.status)) {
      throw new Error('只有灰度中或全量状态的记录才能回退');
    }

    return dataStore.updateRecord(
      id,
      { status: GrayReleaseStatus.ROLLED_BACK, remark: reason },
      operator,
      `回退发布: ${reason}`
    );
  }

  async batchImport(
    records: Array<Record<string, any>>,
    operator: string
  ): Promise<BatchImportResult> {
    const errors: ImportError[] = [];
    const validRecords: Array<Omit<GrayReleaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>> = [];

    for (let i = 0; i < records.length; i++) {
      const rawData = records[i];
      const rowNum = i + 1;

      try {
        const validated = this.validateImportRow(rawData, rowNum);
        validRecords.push({ ...validated, createdBy: operator });
      } catch (error) {
        errors.push({
          row: rowNum,
          field: (error as any).field || 'unknown',
          message: (error as any).message || '验证失败',
          rawData
        });
      }
    }

    const importedRecords = validRecords.length > 0
      ? await dataStore.batchCreateRecords(validRecords)
      : [];

    return {
      success: importedRecords.length,
      failed: errors.length,
      errors,
      importedIds: importedRecords.map(r => r.id)
    };
  }

  private validateImportRow(rawData: Record<string, any>, rowNum: number): Omit<GrayReleaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'createdBy'> {
    const requiredFields = ['robotId', 'robotName', 'templateVersion', 'templateName', 'grayGroups', 'status'];

    for (const field of requiredFields) {
      if (!rawData[field]) {
        const error: any = new Error(`第 ${rowNum} 行缺少必填字段: ${field}`);
        error.field = field;
        throw error;
      }
    }

    if (!VALID_STATUSES.includes(rawData.status)) {
      const error: any = new Error(`第 ${rowNum} 行状态值无效: ${rawData.status}`);
      error.field = 'status';
      throw error;
    }

    let grayGroups: string[] = [];
    if (typeof rawData.grayGroups === 'string') {
      grayGroups = rawData.grayGroups.split(/[,，;；]/).map((g: string) => g.trim()).filter(Boolean);
    } else if (Array.isArray(rawData.grayGroups)) {
      grayGroups = rawData.grayGroups;
    }

    let failedSamples = [];
    if (rawData.failedSamples) {
      try {
        failedSamples = typeof rawData.failedSamples === 'string'
          ? JSON.parse(rawData.failedSamples)
          : rawData.failedSamples;
      } catch {
        const error: any = new Error(`第 ${rowNum} 行失败样本格式错误`);
        error.field = 'failedSamples';
        throw error;
      }
    }

    return {
      robotId: String(rawData.robotId),
      robotName: String(rawData.robotName),
      templateVersion: String(rawData.templateVersion),
      templateName: String(rawData.templateName),
      grayGroups,
      failedSamples,
      status: rawData.status,
      remark: rawData.remark || '',
      conflictReason: rawData.conflictReason || undefined
    };
  }

  private validateRecord(record: Omit<GrayReleaseRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'>): void {
    if (!record.robotId || !record.robotName) {
      throw new Error('机器人信息不能为空');
    }
    if (!record.templateVersion || !record.templateName) {
      throw new Error('模板信息不能为空');
    }
    if (!record.grayGroups || record.grayGroups.length === 0) {
      throw new Error('灰度群不能为空');
    }
    if (!VALID_STATUSES.includes(record.status)) {
      throw new Error(`无效的状态值: ${record.status}`);
    }
  }

  async exportRecords(): Promise<GrayReleaseRecord[]> {
    return this.getAllRecords();
  }
}

export const grayReleaseService = new GrayReleaseService();
