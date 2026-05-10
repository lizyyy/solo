import { v4 as uuidv4 } from 'uuid';
import { DamageRecord, DamageSeverity, RepairRecord, RepairStatus, ServiceResult } from '../types';
import { getDB, updateDB } from '../storage';
import { getCaseByIdentifier, getCaseStatusLabel } from './caseService';
import { getCityByIdentifier } from './cityService';
import { createCompensationAction } from './compensationService';

export interface ReportDamageInput {
  caseIdentifier: string;
  itemName?: string;
  cityIdentifier: string;
  reportedBy: string;
  severity: DamageSeverity;
  description: string;
  damageTime?: string;
  estimatedCost?: number;
}

export function reportDamage(input: ReportDamageInput): ServiceResult<DamageRecord> {
  const caseResult = getCaseByIdentifier(input.caseIdentifier);
  if (!caseResult.success) {
    return { success: false, message: caseResult.message };
  }
  
  const caseObj = caseResult.data!;
  
  const cityResult = getCityByIdentifier(input.cityIdentifier);
  if (!cityResult.success) {
    return { success: false, message: cityResult.message };
  }
  
  let itemId: string | undefined;
  if (input.itemName) {
    const item = caseObj.items.find(i => i.name === input.itemName);
    if (!item) {
      return {
        success: false,
        message: `设备箱「${caseObj.caseNumber}」中未找到设备「${input.itemName}」`,
      };
    }
    itemId = item.id;
  }
  
  const now = new Date().toISOString();
  const record: DamageRecord = {
    id: uuidv4(),
    caseId: caseObj.id,
    itemId,
    cityId: cityResult.data!.id,
    reportedBy: input.reportedBy,
    severity: input.severity,
    description: input.description,
    damageTime: input.damageTime || now,
    estimatedCost: input.estimatedCost,
    isResolved: false,
    createdAt: now,
  };
  
  updateDB(d => ({
    ...d,
    damageRecords: [...d.damageRecords, record],
  }));
  
  const severityLabels: Record<DamageSeverity, string> = {
    minor: '轻微',
    medium: '中等',
    major: '严重',
    critical: '极其严重',
  };
  
  const message = `已在「${cityResult.data!.name}」报告设备箱「${caseObj.caseNumber}」${input.itemName ? `的设备「${input.itemName}」` : ''}损坏，严重程度：${severityLabels[input.severity]}。`;
  
  const compensationResult = createCompensationAction({
    relatedRecordId: record.id,
    relatedRecordType: 'damage',
    actionType: 'review_responsibility',
    description: `审查设备箱「${caseObj.caseNumber}」损坏责任，严重程度：${severityLabels[input.severity]}`,
    parameters: { damageId: record.id },
  });
  
  return {
    success: true,
    message: message + (compensationResult.success ? ' 已自动创建责任审查任务。' : ''),
    data: record,
    suggestions: ['请尽快启动维修流程，或与相关责任人确认责任归属'],
  };
}

export interface ResolveDamageInput {
  damageId: string;
  resolvedBy: string;
  resolution: string;
  responsibility?: string;
}

export function resolveDamage(input: ResolveDamageInput): ServiceResult<DamageRecord> {
  const db = getDB();
  const record = db.damageRecords.find(d => d.id === input.damageId);
  
  if (!record) {
    return {
      success: false,
      message: `未找到ID为「${input.damageId}」的损坏记录`,
    };
  }
  
  if (record.isResolved) {
    return {
      success: false,
      message: `该损坏记录已于「${record.resolvedAt}」由「${record.resolvedBy}」解决，无需重复操作`,
    };
  }
  
  const now = new Date().toISOString();
  
  updateDB(d => ({
    ...d,
    damageRecords: d.damageRecords.map(r =>
      r.id === input.damageId
        ? {
            ...r,
            isResolved: true,
            resolvedAt: now,
            resolvedBy: input.resolvedBy,
            resolution: input.resolution,
            responsibility: input.responsibility || r.responsibility,
          }
        : r
    ),
  }));
  
  const updatedRecord: DamageRecord = {
    ...record,
    isResolved: true,
    resolvedAt: now,
    resolvedBy: input.resolvedBy,
    resolution: input.resolution,
    responsibility: input.responsibility || record.responsibility,
  };
  
  return {
    success: true,
    message: `损坏记录已解决。处理人：${input.resolvedBy}，处理方案：${input.resolution}${input.responsibility ? `，责任归属：${input.responsibility}` : ''}`,
    data: updatedRecord,
  };
}

export interface StartRepairInput {
  damageId?: string;
  caseIdentifier: string;
  itemName?: string;
  startedBy: string;
  description: string;
}

export function startRepair(input: StartRepairInput): ServiceResult<RepairRecord> {
  const caseResult = getCaseByIdentifier(input.caseIdentifier);
  if (!caseResult.success) {
    return { success: false, message: caseResult.message };
  }
  
  const caseObj = caseResult.data!;
  
  if (caseObj.status === 'under_repair') {
    return {
      success: false,
      message: `设备箱「${caseObj.caseNumber}」当前已在维修中，无法重复启动维修`,
    };
  }
  
  if (caseObj.status !== 'in_stock' && caseObj.status !== 'damaged') {
    return {
      success: false,
      message: `设备箱「${caseObj.caseNumber}」当前状态为「${getCaseStatusLabel(caseObj.status)}」，只有「在库」或「已损坏」状态才能启动维修`,
    };
  }
  
  let damageRecordId: string | undefined;
  if (input.damageId) {
    const db = getDB();
    const damageRecord = db.damageRecords.find(d => d.id === input.damageId);
    if (!damageRecord) {
      return {
        success: false,
        message: `未找到ID为「${input.damageId}」的损坏记录`,
      };
    }
    damageRecordId = damageRecord.id;
  }
  
  let itemId: string | undefined;
  if (input.itemName) {
    const item = caseObj.items.find(i => i.name === input.itemName);
    if (!item) {
      return {
        success: false,
        message: `设备箱「${caseObj.caseNumber}」中未找到设备「${input.itemName}」`,
      };
    }
    itemId = item.id;
  }
  
  const now = new Date().toISOString();
  const record: RepairRecord = {
    id: uuidv4(),
    damageRecordId: damageRecordId || '',
    caseId: caseObj.id,
    itemId,
    startedBy: input.startedBy,
    startTime: now,
    status: 'in_progress',
    description: input.description,
    createdAt: now,
    updatedAt: now,
  };
  
  updateDB(d => ({
    ...d,
    repairRecords: [...d.repairRecords, record],
    equipmentCases: d.equipmentCases.map(c =>
      c.id === caseObj.id
        ? {
            ...c,
            status: 'under_repair' as const,
            updatedAt: now,
          }
        : c
    ),
  }));
  
  return {
    success: true,
    message: `设备箱「${caseObj.caseNumber}」维修已启动，由「${input.startedBy}」负责。维修期间该设备箱无法借出或调拨。`,
    data: record,
  };
}

export interface CompleteRepairInput {
  repairId: string;
  cost?: number;
  completionNote?: string;
}

export function completeRepair(input: CompleteRepairInput): ServiceResult<RepairRecord> {
  const db = getDB();
  const record = db.repairRecords.find(r => r.id === input.repairId);
  
  if (!record) {
    return {
      success: false,
      message: `未找到ID为「${input.repairId}」的维修记录`,
    };
  }
  
  if (record.status === 'completed') {
    return {
      success: false,
      message: `该维修记录已于「${record.endTime}」完成`,
    };
  }
  
  const now = new Date().toISOString();
  
  updateDB(d => ({
    ...d,
    repairRecords: d.repairRecords.map(r =>
      r.id === input.repairId
        ? {
            ...r,
            status: 'completed' as RepairStatus,
            endTime: now,
            cost: input.cost,
            description: input.completionNote
              ? `${r.description} | 完成备注：${input.completionNote}`
              : r.description,
            updatedAt: now,
          }
        : r
    ),
    equipmentCases: d.equipmentCases.map(c =>
      c.id === record.caseId
        ? {
            ...c,
            status: 'in_stock' as const,
            updatedAt: now,
          }
        : c
    ),
  }));
  
  const caseObj = db.equipmentCases.find(c => c.id === record.caseId);
  
  return {
    success: true,
    message: `设备箱「${caseObj?.caseNumber || record.caseId}」维修已完成${input.cost ? `，维修费用 ¥${input.cost.toFixed(2)}` : ''}。设备箱已恢复「在库」状态，可正常使用。`,
    data: {
      ...record,
      status: 'completed',
      endTime: now,
      cost: input.cost,
      updatedAt: now,
    },
  };
}

export function listDamageRecords(
  caseIdentifier?: string,
  unresolvedOnly?: boolean
): ServiceResult<DamageRecord[]> {
  const db = getDB();
  let filtered = [...db.damageRecords];
  
  if (caseIdentifier) {
    const caseResult = getCaseByIdentifier(caseIdentifier);
    if (!caseResult.success) {
      return {
        success: false,
        message: caseResult.message,
        data: [],
      };
    }
    filtered = filtered.filter(d => d.caseId === caseResult.data!.id);
  }
  
  if (unresolvedOnly) {
    filtered = filtered.filter(d => !d.isResolved);
  }
  
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const unresolvedCount = filtered.filter(d => !d.isResolved).length;
  
  return {
    success: true,
    message: `共查询到 ${filtered.length} 条损坏记录，其中 ${unresolvedCount} 条未解决`,
    data: filtered,
  };
}

export function listRepairRecords(
  caseIdentifier?: string,
  statusFilter?: RepairStatus
): ServiceResult<RepairRecord[]> {
  const db = getDB();
  let filtered = [...db.repairRecords];
  
  if (caseIdentifier) {
    const caseResult = getCaseByIdentifier(caseIdentifier);
    if (!caseResult.success) {
      return {
        success: false,
        message: caseResult.message,
        data: [],
      };
    }
    filtered = filtered.filter(r => r.caseId === caseResult.data!.id);
  }
  
  if (statusFilter) {
    filtered = filtered.filter(r => r.status === statusFilter);
  }
  
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const inProgressCount = filtered.filter(r => r.status === 'in_progress').length;
  
  return {
    success: true,
    message: `共查询到 ${filtered.length} 条维修记录，其中 ${inProgressCount} 条进行中`,
    data: filtered,
  };
}

export function getDamageSeverityLabel(severity: DamageSeverity): string {
  const labels: Record<DamageSeverity, string> = {
    minor: '轻微',
    medium: '中等',
    major: '严重',
    critical: '极其严重',
  };
  return labels[severity] || severity;
}
