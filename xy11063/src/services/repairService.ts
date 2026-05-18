import { v4 as uuidv4 } from 'uuid';
import {
  RepairRecord,
  CreateRepairRequest,
  UpdateRepairRequest,
  MergeRepairsRequest,
  RepairStatus,
  RepairPriority
} from '../types/repair';
import { repairRepository, VersionConflictError, RepairNotFoundError } from '../storage/repository';

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly repairId: string,
    public readonly fromStatus: RepairStatus,
    public readonly toStatus: RepairStatus
  ) {
    super(`状态流转无效: 无法从 ${fromStatus} 直接转为 ${toStatus}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class MergeConflictError extends Error {
  constructor(
    public readonly sourceRepairId: string,
    public readonly reason: string
  ) {
    super(`合并冲突: ${sourceRepairId} - ${reason}`);
    this.name = 'MergeConflictError';
  }
}

export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly message: string
  ) {
    super(`字段验证失败 [${field}]: ${message}`);
    this.name = 'ValidationError';
  }
}

const STATUS_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  [RepairStatus.SUBMITTED]: [RepairStatus.ASSIGNED, RepairStatus.CANCELLED],
  [RepairStatus.ASSIGNED]: [RepairStatus.IN_PROGRESS, RepairStatus.CANCELLED, RepairStatus.PENDING_PARTS],
  [RepairStatus.IN_PROGRESS]: [RepairStatus.COMPLETED, RepairStatus.PENDING_PARTS, RepairStatus.CANCELLED],
  [RepairStatus.PENDING_PARTS]: [RepairStatus.IN_PROGRESS, RepairStatus.CANCELLED],
  [RepairStatus.COMPLETED]: [RepairStatus.VERIFIED],
  [RepairStatus.VERIFIED]: [],
  [RepairStatus.CANCELLED]: []
};

const PRIORITY_ORDER: RepairPriority[] = [
  RepairPriority.LOW,
  RepairPriority.MEDIUM,
  RepairPriority.HIGH,
  RepairPriority.URGENT,
  RepairPriority.EMERGENCY
];

export class RepairService {
  private validateCreateRequest(request: CreateRepairRequest): void {
    if (!request.title || request.title.trim().length === 0) {
      throw new ValidationError('title', '报修标题不能为空');
    }
    if (request.title.length > 200) {
      throw new ValidationError('title', '报修标题不能超过200字符');
    }
    if (!request.description || request.description.trim().length === 0) {
      throw new ValidationError('description', '报修描述不能为空');
    }
    if (!request.location.building) {
      throw new ValidationError('location.building', '楼宇信息不能为空');
    }
    if (!request.location.floor) {
      throw new ValidationError('location.floor', '楼层信息不能为空');
    }
    if (!request.location.room) {
      throw new ValidationError('location.room', '房间信息不能为空');
    }
    if (!request.reporter.name) {
      throw new ValidationError('reporter.name', '报修人姓名不能为空');
    }
    if (!request.reporter.phone || !/^1[3-9]\d{9}$/.test(request.reporter.phone)) {
      throw new ValidationError('reporter.phone', '请输入有效的手机号码');
    }
    if (!request.createdBy) {
      throw new ValidationError('createdBy', '创建人不能为空');
    }
  }

  async createRepair(request: CreateRepairRequest): Promise<RepairRecord> {
    this.validateCreateRequest(request);

    const now = new Date();
    const keywords = this.extractKeywords(request.title);
    const duplicates = await repairRepository.findDuplicates(
      request.location.building,
      request.location.floor,
      request.category,
      keywords
    );

    const record: RepairRecord = {
      id: uuidv4(),
      repairNumber: repairRepository.generateRepairNumber(),
      title: request.title,
      description: request.description,
      category: request.category,
      priority: request.priority || RepairPriority.MEDIUM,
      status: RepairStatus.SUBMITTED,
      location: request.location,
      reporter: request.reporter,
      images: request.images || [],
      mergeHistory: [],
      isDuplicate: duplicates.length > 0,
      duplicateCount: duplicates.length,
      relatedRepairIds: duplicates.map(d => d.id),
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      createdBy: request.createdBy,
      notes: duplicates.length > 0 ? [`检测到 ${duplicates.length} 条相似报修记录`] : [],
      version: 1
    };

    const created = await repairRepository.create(record);

    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        await repairRepository.update(dup.id, dup.version, (existing) => {
          existing.relatedRepairIds = [...new Set([...existing.relatedRepairIds, created.id])];
          existing.duplicateCount = existing.duplicateCount + 1;
          return existing;
        });
      }
    }

    return created;
  }

  private extractKeywords(title: string): string[] {
    const stopWords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
    const words = title.split(/[\s，。！？、；：""''（）【】]+/).filter(w => w.length >= 2 && !stopWords.includes(w));
    return words.slice(0, 5);
  }

  async getRepair(id: string): Promise<RepairRecord> {
    const record = await repairRepository.findById(id);
    if (!record) {
      throw new RepairNotFoundError(id);
    }
    return record;
  }

  async getAllRepairs(): Promise<RepairRecord[]> {
    return repairRepository.findAll();
  }

  async updateRepair(id: string, request: UpdateRepairRequest): Promise<RepairRecord> {
    const existing = await this.getRepair(id);

    if (request.status && request.status !== existing.status) {
      this.validateStatusTransition(existing.status, request.status, id);
    }

    return repairRepository.update(id, request.expectedVersion, (record) => {
      if (request.title !== undefined) record.title = request.title;
      if (request.description !== undefined) record.description = request.description;
      if (request.category !== undefined) record.category = request.category;
      if (request.priority !== undefined) record.priority = request.priority;
      if (request.status !== undefined) record.status = request.status;
      if (request.location !== undefined) record.location = { ...record.location, ...request.location };
      if (request.assignment !== undefined) record.assignment = request.assignment;
      if (request.estimatedCost !== undefined) record.estimatedCost = request.estimatedCost;
      if (request.actualCost !== undefined) record.actualCost = request.actualCost;
      if (request.status === RepairStatus.COMPLETED && !record.completedAt) {
        record.completedAt = new Date();
      }
      if (request.notes) {
        record.notes = [...record.notes, `[${new Date().toISOString()}] ${request.updatedBy}: ${request.notes}`];
      }
      return record;
    });
  }

  private validateStatusTransition(from: RepairStatus, to: RepairStatus, repairId: string): void {
    const allowedTransitions = STATUS_TRANSITIONS[from];
    if (!allowedTransitions.includes(to)) {
      throw new InvalidStatusTransitionError(repairId, from, to);
    }
  }

  async mergeRepairs(request: MergeRepairsRequest): Promise<{ target: RepairRecord; merged: RepairRecord[] }> {
    const targetRecord = await this.getRepair(request.targetRepairId);
    
    if (targetRecord.mergedInto) {
      throw new MergeConflictError(request.targetRepairId, '目标记录本身已被合并到其他记录');
    }
    if (targetRecord.status === RepairStatus.COMPLETED || targetRecord.status === RepairStatus.VERIFIED) {
      throw new MergeConflictError(request.targetRepairId, '目标记录已完成，无法作为合并目标');
    }

    const sourceRecords: RepairRecord[] = [];
    for (const sourceId of request.sourceRepairIds) {
      if (sourceId === request.targetRepairId) {
        throw new MergeConflictError(sourceId, '不能将记录合并到自身');
      }
      const source = await this.getRepair(sourceId);
      if (source.mergedInto) {
        throw new MergeConflictError(sourceId, '该记录已被合并');
      }
      if (source.status === RepairStatus.COMPLETED || source.status === RepairStatus.VERIFIED) {
        throw new MergeConflictError(sourceId, '已完成的记录不能被合并');
      }
      sourceRecords.push(source);
    }

    if (sourceRecords.length === 0) {
      throw new MergeConflictError(request.targetRepairId, '没有有效的源记录可以合并');
    }

    const mergedPriority = this.calculateMergedPriority(targetRecord, sourceRecords, request.keepOriginalPriority);

    const mergedRecords: RepairRecord[] = [];
    const batchUpdates: { id: string; expectedVersion: number; updateFn: (record: RepairRecord) => RepairRecord }[] = [];

    for (const source of sourceRecords) {
      batchUpdates.push({
        id: source.id,
        expectedVersion: source.version,
        updateFn: (record) => {
          record.mergedInto = targetRecord.id;
          record.isDuplicate = true;
          record.status = RepairStatus.CANCELLED;
          record.notes = [...record.notes, `[${new Date().toISOString()}] 系统: 已合并到报修 ${targetRecord.repairNumber}`];
          return record;
        }
      });
    }

    batchUpdates.push({
      id: targetRecord.id,
      expectedVersion: targetRecord.version,
      updateFn: (record) => {
        record.mergeHistory = [
          ...record.mergeHistory,
          ...sourceRecords.map(s => ({
            mergedRepairId: s.id,
            mergedAt: new Date(),
            mergedBy: request.mergedBy,
            reason: request.reason
          }))
        ];
        record.relatedRepairIds = [...new Set([
          ...record.relatedRepairIds,
          ...sourceRecords.map(s => s.id)
        ])];
        record.duplicateCount = record.duplicateCount + sourceRecords.length;
        record.priority = mergedPriority;
        record.description = `${record.description}\n\n--- 合并内容 ---\n${sourceRecords.map(s => `[${s.repairNumber}] ${s.description}`).join('\n')}`;
        record.notes = [...record.notes, `[${new Date().toISOString()}] ${request.mergedBy}: 合并了 ${sourceRecords.length} 条报修记录 - ${request.reason}`];
        record.notes = [...record.notes, `[${new Date().toISOString()}] 系统: 合并后优先级调整为 ${mergedPriority}`];
        return record;
      }
    });

    const results = await repairRepository.batchUpdate(batchUpdates);
    const updatedTarget = results.find(r => r.id === targetRecord.id)!;
    const updatedSources = results.filter(r => r.id !== targetRecord.id);

    return {
      target: updatedTarget,
      merged: updatedSources
    };
  }

  private calculateMergedPriority(target: RepairRecord, sources: RepairRecord[], keepOriginal?: boolean): RepairPriority {
    if (keepOriginal) {
      return target.priority;
    }

    const allPriorities = [target.priority, ...sources.map(s => s.priority)];
    const priorityCounts: Record<string, number> = {};
    
    for (const p of allPriorities) {
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    }

    const totalRecords = allPriorities.length;
    const emergencyCount = priorityCounts[RepairPriority.EMERGENCY] || 0;
    const urgentCount = priorityCounts[RepairPriority.URGENT] || 0;

    if (emergencyCount >= 1) {
      return totalRecords >= 3 ? RepairPriority.URGENT : RepairPriority.HIGH;
    }

    if (urgentCount >= 2) {
      return RepairPriority.HIGH;
    }

    let highestIndex = 0;
    for (const p of allPriorities) {
      const index = PRIORITY_ORDER.indexOf(p);
      if (index > highestIndex) {
        highestIndex = index;
      }
    }

    const adjustedIndex = Math.max(0, highestIndex - 1);
    return PRIORITY_ORDER[adjustedIndex];
  }

  async deleteRepair(id: string): Promise<void> {
    await this.getRepair(id);
    await repairRepository.delete(id);
  }
}

export const repairService = new RepairService();
