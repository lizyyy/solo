import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import {
  LostItem,
  ItemStatus,
  ItemCategory,
  ImportData,
  ClaimAppointment,
  LockerRecord,
} from '../../shared/types';
import { DataStore } from './dataStore';

const CATEGORY_MAP: Record<string, ItemCategory> = {
  电子设备: ItemCategory.ELECTRONICS,
  电子产品: ItemCategory.ELECTRONICS,
  electronics: ItemCategory.ELECTRONICS,
  证件: ItemCategory.DOCUMENTS,
  证件类: ItemCategory.DOCUMENTS,
  documents: ItemCategory.DOCUMENTS,
  衣物: ItemCategory.CLOTHING,
  服装: ItemCategory.CLOTHING,
  clothing: ItemCategory.CLOTHING,
  箱包: ItemCategory.BAGS,
  包包: ItemCategory.BAGS,
  bags: ItemCategory.BAGS,
  贵重物品: ItemCategory.VALUABLES,
  valuables: ItemCategory.VALUABLES,
  钥匙: ItemCategory.KEYS,
  keys: ItemCategory.KEYS,
  其他: ItemCategory.OTHER,
  other: ItemCategory.OTHER,
};

const STATUS_MAP: Record<string, ItemStatus> = {
  待处理: ItemStatus.PENDING,
  pending: ItemStatus.PENDING,
  处理中: ItemStatus.PROCESSING,
  processing: ItemStatus.PROCESSING,
  已批准: ItemStatus.APPROVED,
  approved: ItemStatus.APPROVED,
  需要证明: ItemStatus.NEED_PROOF,
  need_proof: ItemStatus.NEED_PROOF,
  需要值班长: ItemStatus.NEED_SUPERVISOR,
  need_supervisor: ItemStatus.NEED_SUPERVISOR,
  已归还: ItemStatus.RETURNED,
  returned: ItemStatus.RETURNED,
  已关闭: ItemStatus.CLOSED,
  closed: ItemStatus.CLOSED,
};

export class ImportService {
  importFromFile(filePath: string): ImportData | null {
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === '.json') {
        return this.importFromJson(filePath);
      } else if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
          return this.importFromExcel(filePath);
        }
    } catch (error) {
      console.error('Import failed:', error);
      return null;
    }

    return null;
  }

  previewFile(filePath: string): ImportData | null {
    return this.importFromFile(filePath);
  }

  applyImportData(
    importData: ImportData, dataStore: DataStore): { success: number; errors: string[] } {
    const errors: string[] = [];
    let successCount = 0;

    importData.lostItems.forEach((itemData, index) => {
      try {
        const item = this.convertToLostItem(itemData);
        dataStore.saveItem(item);
        successCount++;
      } catch (error) {
        errors.push(`第${index + 1}条失物记录导入失败: ${error}`);
      }
    });

    return {
      success: successCount,
      errors,
    };
  }

  private importFromJson(filePath: string): ImportData {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    return {
      lostItems: Array.isArray(data) ? data : data.lostItems || [],
      claimAppointments: data.claimAppointments || [],
      lockerRecords: data.lockerRecords || [],
    };
  }

  private importFromExcel(filePath: string): ImportData {
    const workbook = XLSX.readFile(filePath);
    const lostItems: Partial<LostItem>[] = [];
    const claimAppointments: Partial<ClaimAppointment>[] = [];
    const lockerRecords: Partial<LockerRecord>[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) return;

      const firstRow = jsonData[0] as Record<string, unknown>;
      const keys = Object.keys(firstRow);

      const hasLostItemFields = keys.some((k) =>
        ['物品编号', '站点', '类型', '描述', '发现时间'].includes(k)
      );
      const hasClaimFields = keys.some((k) =>
        ['认领人', '联系电话', '预约时间'].includes(k)
      );
      const hasLockerFields = keys.some((k) =>
        ['保管柜编号', '扫描时间', '操作'].includes(k)
      );

      jsonData.forEach((row) => {
        const r = row as Record<string, unknown>;

        if (hasLostItemFields) {
          lostItems.push(this.parseLostItemRow(r));
        }

        if (hasClaimFields) {
          claimAppointments.push(this.parseClaimRow(r));
        }

        if (hasLockerFields) {
          lockerRecords.push(this.parseLockerRow(r));
        }
      });
    });

    return {
      lostItems,
      claimAppointments,
      lockerRecords,
    };
  }

  private parseLostItemRow(row: Record<string, unknown>): Partial<LostItem> {
    const item: Partial<LostItem> = {
      photos: [],
      lockerRecords: [],
      claimAppointments: [],
      autoJudgeResult: null,
      manualReview: null,
    };

    if (row['物品编号'] || row['itemCode'] || row['编号']) {
      item.itemCode = String(row['物品编号'] || row['itemCode'] || row['编号'] || '');
    }

    if (row['站点'] || row['station']) {
      item.station = String(row['站点'] || row['station'] || '');
    }

    if (row['类型'] || row['category'] || row['物品类型']) {
      const categoryStr = String(row['类型'] || row['category'] || row['物品类型'] || '');
      item.category = this.parseCategory(categoryStr);
    }

    if (row['描述'] || row['description'] || row['物品描述']) {
      item.description = String(row['描述'] || row['description'] || row['物品描述'] || '');
    }

    if (row['发现人'] || row['finderName'] || row['交件人']) {
      item.finderName = String(row['发现人'] || row['finderName'] || row['交件人'] || '');
    }

    if (row['联系电话'] || row['finderContact'] || row['发现人电话']) {
      item.finderContact = String(row['联系电话'] || row['finderContact'] || row['发现人电话'] || '');
    }

    if (row['发现时间'] || row['foundTime'] || row['交件时间']) {
      item.foundTime = this.parseDate(row['发现时间'] || row['foundTime'] || row['交件时间']);
    }

    if (row['发现地点'] || row['foundLocation'] || row['位置']) {
      item.foundLocation = String(row['发现地点'] || row['foundLocation'] || row['位置'] || '');
    }

    if (row['价值'] || row['estimatedValue'] || row['预估价值']) {
      const value = row['价值'] || row['estimatedValue'] || row['预估价值'];
      item.estimatedValue = typeof value === 'number' ? value : Number(value) || 0;
    }

    if (row['特殊标识'] || row['specialMarks'] || row['备注']) {
      item.specialMarks = String(row['特殊标识'] || row['specialMarks'] || row['备注'] || '');
    }

    if (row['状态'] || row['status']) {
      const statusStr = String(row['状态'] || row['status'] || '');
      item.status = this.parseStatus(statusStr);
    }

    return item;
  }

  private parseClaimRow(row: Record<string, unknown>): Partial<ClaimAppointment> {
    const appointment: Partial<ClaimAppointment> = {
      proofDocuments: [],
      status: 'pending',
    };

    if (row['认领人'] || row['claimantName']) {
      appointment.claimantName = String(row['认领人'] || row['claimantName'] || '');
    }

    if (row['联系电话'] || row['claimantContact']) {
      appointment.claimantContact = String(row['联系电话'] || row['claimantContact'] || '');
    }

    if (row['证件类型'] || row['claimantIdType']) {
      appointment.claimantIdType = String(row['证件类型'] || row['claimantIdType'] || '');
    }

    if (row['证件号码'] || row['claimantIdNumber']) {
      appointment.claimantIdNumber = String(row['证件号码'] || row['claimantIdNumber'] || '');
    }

    if (row['预约时间'] || row['appointmentTime']) {
      appointment.appointmentTime = this.parseDate(row['预约时间'] || row['appointmentTime']);
    }

    if (row['描述'] || row['description'] || row['物品描述']) {
      appointment.description = String(row['描述'] || row['description'] || row['物品描述'] || '');
    }

    if (row['证明文件'] || row['proofDocuments']) {
      const docs = row['证明文件'] || row['proofDocuments'];
      if (typeof docs === 'string') {
        appointment.proofDocuments = docs.split(',').map((s) => s.trim());
      } else if (Array.isArray(docs)) {
        appointment.proofDocuments = docs;
      }
    }

    if (row['状态'] || row['status']) {
      const statusStr = String(row['状态'] || row['status'] || '').toLowerCase();
      if (['pending', '待确认', '确认中'].includes(statusStr)) {
        appointment.status = 'pending';
      } else if (['confirmed', '已确认', '确认'].includes(statusStr)) {
        appointment.status = 'confirmed';
      } else if (['completed', '已完成', '完成'].includes(statusStr)) {
        appointment.status = 'completed';
      } else if (['cancelled', '已取消', '取消'].includes(statusStr)) {
        appointment.status = 'cancelled';
      }
    }

    if (row['备注'] || row['notes']) {
      appointment.notes = String(row['备注'] || row['notes'] || '');
    }

    return appointment;
  }

  private parseLockerRow(row: Record<string, unknown>): Partial<LockerRecord> {
    const record: Partial<LockerRecord> = {};

    if (row['保管柜编号'] || row['lockerCode']) {
      record.lockerCode = String(row['保管柜编号'] || row['lockerCode'] || '');
    }

    if (row['扫描人'] || row['scannedBy']) {
      record.scannedBy = String(row['扫描人'] || row['scannedBy'] || '');
    }

    if (row['扫描时间'] || row['scannedAt']) {
      record.scannedAt = this.parseDate(row['扫描时间'] || row['scannedAt']);
    }

    if (row['操作'] || row['action']) {
      const actionStr = String(row['操作'] || row['action'] || '').toLowerCase();
      record.action = actionStr.includes('取出') || actionStr === 'retrieve' ? 'retrieve' : 'store';
    }

    if (row['备注'] || row['notes']) {
      record.notes = String(row['备注'] || row['notes'] || '');
    }

    return record;
  }

  private parseCategory(categoryStr: string): ItemCategory {
    const key = categoryStr.toLowerCase().trim();
    return CATEGORY_MAP[key] || ItemCategory.OTHER;
  }

  private parseStatus(statusStr: string): ItemStatus {
    const key = statusStr.toLowerCase().trim();
    return STATUS_MAP[key] || ItemStatus.PENDING;
  }

  private parseDate(value: unknown): string {
    if (!value) return new Date().toISOString();

    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    if (typeof value === 'number') {
      return new Date(value * 1000).toISOString();
    }

    return new Date().toISOString();
  }

  private convertToLostItem(itemData: Partial<LostItem>): LostItem {
    const now = new Date().toISOString();

    return {
      id: itemData.id || uuidv4(),
      itemCode: itemData.itemCode || '',
      station: itemData.station || '',
      category: itemData.category || ItemCategory.OTHER,
      description: itemData.description || '',
      finderName: itemData.finderName || '',
      finderContact: itemData.finderContact || '',
      foundTime: itemData.foundTime || now,
      foundLocation: itemData.foundLocation || '',
      estimatedValue: itemData.estimatedValue || 0,
      specialMarks: itemData.specialMarks || '',
      photos: itemData.photos || [],
      lockerRecords: itemData.lockerRecords || [],
      claimAppointments: itemData.claimAppointments || [],
      status: itemData.status || ItemStatus.PENDING,
      autoJudgeResult: itemData.autoJudgeResult || null,
      manualReview: itemData.manualReview || null,
      createdAt: itemData.createdAt || now,
      updatedAt: itemData.updatedAt || now,
    };
  }
}
