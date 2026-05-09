import { store } from '../storage/inMemoryStore';
import {
  RevisionRecord,
  ProductionRecord,
  WasteRecord,
  DowntimeRecord,
} from '../models/types';

export class RevisionService {
  reviseProduction(
    id: string,
    params: {
      revisedBy: string;
      reason: string;
      changes: {
        quantity?: number;
        shiftId?: string;
      };
    }
  ): ProductionRecord {
    const record = store.getProductionById(id);
    if (!record) {
      throw new Error(`产量记录不存在: ${id}`);
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (params.changes.quantity !== undefined) {
      if (params.changes.quantity <= 0) {
        throw new Error('产量必须大于0');
      }
      changes.quantity = { from: record.quantity, to: params.changes.quantity };
    }

    if (params.changes.shiftId !== undefined) {
      const newShift = store.getShiftById(params.changes.shiftId);
      if (!newShift) {
        throw new Error(`目标班次不存在: ${params.changes.shiftId}`);
      }
      changes.shiftId = { from: record.shiftId, to: params.changes.shiftId };
    }

    const updatedRecord: ProductionRecord = {
      ...record,
      quantity: params.changes.quantity ?? record.quantity,
      shiftId: params.changes.shiftId ?? record.shiftId,
      status: 'revised',
      updatedAt: new Date(),
      version: record.version + 1,
    };

    store.saveProduction(updatedRecord);

    store.saveRevision({
      id: store.generateId(),
      targetId: id,
      targetType: 'production',
      previousVersion: record.version,
      newVersion: updatedRecord.version,
      changes,
      revisedBy: params.revisedBy,
      revisedAt: new Date(),
      reason: params.reason,
    });

    return updatedRecord;
  }

  reviseWaste(
    id: string,
    params: {
      revisedBy: string;
      reason: string;
      changes: {
        quantity?: number;
        reason?: string;
        shiftId?: string;
      };
    }
  ): WasteRecord {
    const record = store.getWasteById(id);
    if (!record) {
      throw new Error(`废品记录不存在: ${id}`);
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (params.changes.quantity !== undefined) {
      if (params.changes.quantity <= 0) {
        throw new Error('废品数量必须大于0');
      }
      changes.quantity = { from: record.quantity, to: params.changes.quantity };
    }

    if (params.changes.reason !== undefined) {
      if (!params.changes.reason.trim()) {
        throw new Error('废品原因不能为空');
      }
      changes.reason = { from: record.reason, to: params.changes.reason };
    }

    if (params.changes.shiftId !== undefined) {
      const newShift = store.getShiftById(params.changes.shiftId);
      if (!newShift) {
        throw new Error(`目标班次不存在: ${params.changes.shiftId}`);
      }
      changes.shiftId = { from: record.shiftId, to: params.changes.shiftId };
    }

    const updatedRecord: WasteRecord = {
      ...record,
      quantity: params.changes.quantity ?? record.quantity,
      reason: params.changes.reason ?? record.reason,
      shiftId: params.changes.shiftId ?? record.shiftId,
      status: 'revised',
      updatedAt: new Date(),
      version: record.version + 1,
    };

    store.saveWaste(updatedRecord);

    store.saveRevision({
      id: store.generateId(),
      targetId: id,
      targetType: 'waste',
      previousVersion: record.version,
      newVersion: updatedRecord.version,
      changes,
      revisedBy: params.revisedBy,
      revisedAt: new Date(),
      reason: params.reason,
    });

    return updatedRecord;
  }

  reviseDowntime(
    id: string,
    params: {
      revisedBy: string;
      reason: string;
      changes: {
        startTime?: Date;
        endTime?: Date;
        reason?: string;
      };
    }
  ): DowntimeRecord {
    const record = store.getDowntimeById(id);
    if (!record) {
      throw new Error(`停机记录不存在: ${id}`);
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    let newDuration = record.durationMinutes;

    if (params.changes.startTime !== undefined) {
      changes.startTime = { from: record.startTime, to: params.changes.startTime };
    }
    if (params.changes.endTime !== undefined) {
      changes.endTime = { from: record.endTime, to: params.changes.endTime };
    }
    if (params.changes.reason !== undefined) {
      if (!params.changes.reason.trim()) {
        throw new Error('停机原因不能为空');
      }
      changes.reason = { from: record.reason, to: params.changes.reason };
    }

    const newStartTime = params.changes.startTime ?? record.startTime;
    const newEndTime = params.changes.endTime ?? record.endTime;

    if (newEndTime) {
      newDuration = Math.round(
        (newEndTime.getTime() - newStartTime.getTime()) / 60000
      );
      if (newDuration <= 0) {
        throw new Error('停机时长必须大于0分钟');
      }
    }

    const updatedRecord: DowntimeRecord = {
      ...record,
      startTime: newStartTime,
      endTime: newEndTime,
      durationMinutes: newDuration,
      reason: params.changes.reason ?? record.reason,
      status: 'revised',
      updatedAt: new Date(),
      version: record.version + 1,
    };

    store.saveDowntime(updatedRecord);

    store.saveRevision({
      id: store.generateId(),
      targetId: id,
      targetType: 'downtime',
      previousVersion: record.version,
      newVersion: updatedRecord.version,
      changes,
      revisedBy: params.revisedBy,
      revisedAt: new Date(),
      reason: params.reason,
    });

    return updatedRecord;
  }

  getRevisionHistory(
    targetId: string,
    targetType: RevisionRecord['targetType']
  ): RevisionRecord[] {
    return store.getRevisionsByTarget(targetId, targetType);
  }

  getCurrentVersion(
    targetId: string,
    targetType: RevisionRecord['targetType']
  ): number {
    switch (targetType) {
      case 'shift': {
        const record = store.getShiftById(targetId);
        return record?.version ?? 0;
      }
      case 'production': {
        const record = store.getProductionById(targetId);
        return record?.version ?? 0;
      }
      case 'waste': {
        const record = store.getWasteById(targetId);
        return record?.version ?? 0;
      }
      case 'downtime': {
        const record = store.getDowntimeById(targetId);
        return record?.version ?? 0;
      }
      default:
        return 0;
    }
  }

  hasRevisions(
    targetId: string,
    targetType: RevisionRecord['targetType']
  ): boolean {
    return this.getRevisionHistory(targetId, targetType).length > 0;
  }
}

export const revisionService = new RevisionService();
