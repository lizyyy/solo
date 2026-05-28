import { VersionHistoryDAO } from '../dao/index.js';
import { auditService } from './auditService.js';
import type { VersionHistory, VersionDiff, VersionCompareResult, User, BusinessDataType } from '../../shared/types.js';

function generateId(): string {
  return `vh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const versionService = {
  async saveVersion(
    recordId: string,
    recordType: BusinessDataType,
    beforeData: Record<string, any>,
    afterData: Record<string, any>,
    operator: User,
    reason: string
  ): Promise<string> {
    if (!recordId || !recordType) {
      throw new Error('记录ID和类型不能为空');
    }
    if (!operator?.id || !operator?.name) {
      throw new Error('操作员信息不完整');
    }

    const maxVersion = await VersionHistoryDAO.getMaxVersion(recordId, recordType);
    const newVersion = maxVersion + 1;

    const changedFields = versionService.compareData(beforeData, afterData);
    
    if (changedFields.length === 0) {
      throw new Error('数据没有变更，无需保存版本');
    }

    const id = generateId();
    
    await VersionHistoryDAO.create({
      id,
      recordId,
      recordType,
      version: newVersion,
      beforeData: JSON.stringify(beforeData),
      afterData: JSON.stringify(afterData),
      changedFields: JSON.stringify(changedFields.map(f => f.field)),
      operatorId: operator.id,
      operatorName: operator.name,
      changeReason: reason,
    });

    await auditService.logAction(
      operator.id,
      operator.name,
      'create_version',
      recordType,
      recordId,
      `保存版本 ${newVersion}，原因：${reason}`,
    );

    return id;
  },

  async getVersionHistory(
    recordId: string,
    recordType: BusinessDataType
  ): Promise<VersionHistory[]> {
    if (!recordId || !recordType) {
      throw new Error('记录ID和类型不能为空');
    }

    return await VersionHistoryDAO.findByRecord(recordId, recordType);
  },

  compareData(
    before: Record<string, any>,
    after: Record<string, any>
  ): VersionDiff[] {
    const diffs: VersionDiff[] = [];
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      if (['id', 'createdAt', 'updatedAt', 'version'].includes(key)) {
        continue;
      }

      const beforeValue = before?.[key];
      const afterValue = after?.[key];

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        let changeType: 'added' | 'removed' | 'modified' = 'modified';
        if (beforeValue === undefined || beforeValue === null) {
          changeType = 'added';
        } else if (afterValue === undefined || afterValue === null) {
          changeType = 'removed';
        }
        diffs.push({
          field: key,
          before: beforeValue,
          after: afterValue,
          changeType,
        });
      }
    }

    return diffs;
  },

  async compareVersions(
    recordId: string,
    recordType: BusinessDataType,
    version1: number,
    version2: number
  ): Promise<VersionCompareResult> {
    if (!recordId || !recordType) {
      throw new Error('记录ID和类型不能为空');
    }
    if (version1 < 1 || version2 < 1) {
      throw new Error('版本号必须大于0');
    }

    const v1 = await VersionHistoryDAO.findByVersion(recordId, recordType, version1);
    const v2 = await VersionHistoryDAO.findByVersion(recordId, recordType, version2);

    if (!v1 || !v2) {
      throw new Error('指定的版本不存在');
    }

    const before = v1.afterData ? JSON.parse(v1.afterData) : {};
    const after = v2.afterData ? JSON.parse(v2.afterData) : {};
    const diffs = versionService.compareData(before, after);

    return {
      diffs,
      before,
      after,
    };
  },
};

export default versionService;
