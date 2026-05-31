import { db } from '@/db';
import { generateId } from '@/db/seed';
import {
  InspectionItem,
  InspectionCategory,
  SightRecord,
  HANDLING_METHODS,
  SIGHT_STATUS_LABELS,
  INSPECTION_CATEGORY_LABELS,
} from '@/types';

export function categorizeRecord(record: SightRecord): InspectionCategory {
  if (record.isManualModified) {
    return 'manual-modified';
  }

  if (record.status === 'pending' || record.status === 'flip-detected') {
    return 'pending-supplement';
  }

  return 'confirmed';
}

export function generateHandlingMethod(category: InspectionCategory): string {
  return HANDLING_METHODS[category];
}

export function generateDescription(record: SightRecord): string {
  const statusLabel = SIGHT_STATUS_LABELS[record.status];

  if (record.status === 'flip-detected') {
    return `${record.deviceName}检测到坐标轴翻转，${record.conclusion}`;
  }

  if (record.status === 'pending') {
    return `${record.deviceName}${record.conclusion}`;
  }

  if (record.isManualModified) {
    const modifier = record.manualModifier || '未知人员';
    const reason = record.manualReason || '未说明原因';
    return `${record.deviceName}视线分析结果经过人工调整。调整人：${modifier}，调整原因：${reason}`;
  }

  return `${record.deviceName}视线分析结果：视线值${record.sightValue.toFixed(1)}%，${statusLabel}，符合标准要求。`;
}

export function generateNextStep(record: SightRecord): string {
  if (record.status === 'confirmed' && !record.isManualModified) {
    return '无，可进入下一阶段';
  }

  if (record.status === 'flip-detected') {
    return '请对应责任人核对坐标数据，修正后重新分析';
  }

  if (record.status === 'pending') {
    return '请补充完整数据后重新运行视线分析';
  }

  if (record.isManualModified) {
    return '已确认，保留调整记录备查，如需复核请联系调整人';
  }

  return '请项目经理确认处理方式';
}

export function generateContactInfo(record: SightRecord): { person: string; role: string } {
  if (record.traceSource === 'device-remark') {
    return { person: '张工', role: '设备工程师' };
  }

  if (record.traceSource === 'cad-point') {
    return { person: '李工', role: 'CAD设计师' };
  }

  if (record.traceSource === 'manual-input') {
    return { person: record.manualModifier || '王经理', role: '项目经理' };
  }

  return { person: '王经理', role: '项目经理' };
}

export async function generateInspectionItems(
  projectId: string,
  records: SightRecord[]
): Promise<InspectionItem[]> {
  const existingItems = await db.inspectionItems
    .where('projectId')
    .equals(projectId)
    .toArray();

  const existingRecordIds = new Set(existingItems.map((item) => item.recordId));

  const newItems: InspectionItem[] = [];
  const now = new Date();

  for (const record of records) {
    if (existingRecordIds.has(record.id)) {
      continue;
    }

    const category = categorizeRecord(record);
    const contactInfo = generateContactInfo(record);

    const item: InspectionItem = {
      id: `inspect-${generateId()}`,
      recordId: record.id,
      projectId,
      category,
      handlingMethod: generateHandlingMethod(category),
      description: generateDescription(record),
      isConfirmed: category === 'confirmed',
      confirmedBy: category === 'confirmed' ? '系统自动确认' : undefined,
      confirmedAt: category === 'confirmed' ? now : undefined,
      nextStep: generateNextStep(record),
      contactPerson: contactInfo.person,
      contactRole: contactInfo.role,
    };

    newItems.push(item);
  }

  if (newItems.length > 0) {
    await db.inspectionItems.bulkAdd(newItems);
  }

  return db.inspectionItems.where('projectId').equals(projectId).toArray();
}

export async function getInspectionItemsByCategory(
  projectId: string,
  category: InspectionCategory
): Promise<InspectionItem[]> {
  return db.inspectionItems
    .where('[projectId+category]')
    .equals([projectId, category])
    .toArray();
}

export async function confirmInspectionItem(
  itemId: string,
  confirmer: string
): Promise<void> {
  await db.inspectionItems.update(itemId, {
    isConfirmed: true,
    confirmedBy: confirmer,
    confirmedAt: new Date(),
  });
}

export async function getInspectionStats(projectId: string): Promise<{
  total: number;
  confirmed: number;
  pending: number;
  manual: number;
  confirmedCount: number;
  pendingCount: number;
  manualCount: number;
}> {
  const items = await db.inspectionItems.where('projectId').equals(projectId).toArray();

  const confirmed = items.filter((i) => i.category === 'confirmed');
  const pending = items.filter((i) => i.category === 'pending-supplement');
  const manual = items.filter((i) => i.category === 'manual-modified');

  return {
    total: items.length,
    confirmed: confirmed.length,
    pending: pending.length,
    manual: manual.length,
    confirmedCount: confirmed.filter((i) => i.isConfirmed).length,
    pendingCount: pending.filter((i) => i.isConfirmed).length,
    manualCount: manual.filter((i) => i.isConfirmed).length,
  };
}

export function getCategoryColor(category: InspectionCategory): string {
  const colors: Record<InspectionCategory, string> = {
    confirmed: 'bg-status-confirmed',
    'pending-supplement': 'bg-status-pending',
    'manual-modified': 'bg-status-manual',
  };
  return colors[category];
}

export function getCategoryLabel(category: InspectionCategory): string {
  return INSPECTION_CATEGORY_LABELS[category];
}

export async function generateExportData(projectId: string): Promise<{
  projectName: string;
  exportDate: Date;
  categories: Array<{
    category: InspectionCategory;
    label: string;
    items: Array<{
      deviceName: string;
      description: string;
      handlingMethod: string;
      nextStep: string;
      contactPerson: string;
      contactRole: string;
      isConfirmed: boolean;
      confirmedBy?: string;
      confirmedAt?: Date;
    }>;
  }>;
  summary: {
    total: number;
    confirmed: number;
    pending: number;
    manual: number;
  };
}> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const stats = await getInspectionStats(projectId);
  const categories: InspectionCategory[] = ['confirmed', 'pending-supplement', 'manual-modified'];

  const result = {
    projectName: project.name,
    exportDate: new Date(),
    categories: [] as Array<{
      category: InspectionCategory;
      label: string;
      items: Array<{
        deviceName: string;
        description: string;
        handlingMethod: string;
        nextStep: string;
        contactPerson: string;
        contactRole: string;
        isConfirmed: boolean;
        confirmedBy?: string;
        confirmedAt?: Date;
      }>;
    }>,
    summary: {
      total: stats.total,
      confirmed: stats.confirmed,
      pending: stats.pending,
      manual: stats.manual,
    },
  };

  for (const category of categories) {
    const items = await getInspectionItemsByCategory(projectId, category);
    const records = await Promise.all(
      items.map(async (item) => {
        const record = await db.sightRecords.get(item.recordId);
        return {
          item,
          deviceName: record?.deviceName || '未知设备',
        };
      })
    );

    result.categories.push({
      category,
      label: getCategoryLabel(category),
      items: records.map((r) => ({
        deviceName: r.deviceName,
        description: r.item.description,
        handlingMethod: r.item.handlingMethod,
        nextStep: r.item.nextStep,
        contactPerson: r.item.contactPerson,
        contactRole: r.item.contactRole,
        isConfirmed: r.item.isConfirmed,
        confirmedBy: r.item.confirmedBy,
        confirmedAt: r.item.confirmedAt,
      })),
    });
  }

  return result;
}
