import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  Contract,
  AttachmentItem,
  SupplementRecord,
  HistoryRecord,
  AttachmentStatus,
  ValidationResult,
} from '../types';

class LocalStorage {
  private contracts: Map<string, Contract> = new Map();
  private attachmentItems: Map<string, AttachmentItem> = new Map();
  private supplementRecords: Map<string, SupplementRecord> = new Map();
  private historyRecords: Map<string, HistoryRecord> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const contract1: Contract = {
      id: uuidv4(),
      contractNo: 'HT20240001',
      contractName: '采购合同-办公设备',
      businessObject: '采购部',
      contractVersion: 'V2.0',
      createdAt: dayjs().subtract(5, 'day').toISOString(),
      updatedAt: dayjs().subtract(2, 'day').toISOString(),
    };

    const contract2: Contract = {
      id: uuidv4(),
      contractNo: 'HT20240002',
      contractName: '服务合同-IT运维',
      businessObject: 'IT部',
      contractVersion: 'V1.5',
      createdAt: dayjs().subtract(3, 'day').toISOString(),
      updatedAt: dayjs().subtract(1, 'day').toISOString(),
    };

    const contract3: Contract = {
      id: uuidv4(),
      contractNo: 'HT20240003',
      contractName: '劳动合同-张三',
      businessObject: '人事部',
      contractVersion: 'V1.0',
      createdAt: dayjs().subtract(1, 'day').toISOString(),
      updatedAt: dayjs().subtract(1, 'day').toISOString(),
    };

    this.contracts.set(contract1.id, contract1);
    this.contracts.set(contract2.id, contract2);
    this.contracts.set(contract3.id, contract3);

    const item1: AttachmentItem = {
      id: uuidv4(),
      contractId: contract1.id,
      attachmentName: '报价单.pdf',
      attachmentType: '报价单',
      required: true,
      status: AttachmentStatus.PENDING_UPLOAD,
      expectedVersion: 'V2.0',
      versionMismatch: false,
    };

    const item2: AttachmentItem = {
      id: uuidv4(),
      contractId: contract1.id,
      attachmentName: '验收报告.pdf',
      attachmentType: '验收报告',
      required: true,
      status: AttachmentStatus.UPLOADED,
      currentVersion: 'V1.0',
      expectedVersion: 'V2.0',
      uploadedBy: '李四',
      uploadedAt: dayjs().subtract(1, 'day').toISOString(),
      validationResult: ValidationResult.VERSION_MISMATCH,
      validationMessage: '附件版本V1.0与合同正文版本V2.0不匹配',
      versionMismatch: true,
    };

    const item3: AttachmentItem = {
      id: uuidv4(),
      contractId: contract2.id,
      attachmentName: 'SLA协议.pdf',
      attachmentType: '服务协议',
      required: true,
      status: AttachmentStatus.VALIDATION_FAILED,
      currentVersion: 'V1.5',
      expectedVersion: 'V1.5',
      uploadedBy: '王五',
      uploadedAt: dayjs().subtract(12, 'hour').toISOString(),
      validationResult: ValidationResult.FAIL,
      validationMessage: '文件格式损坏，无法读取',
      versionMismatch: false,
    };

    const item4: AttachmentItem = {
      id: uuidv4(),
      contractId: contract3.id,
      attachmentName: '身份证复印件.pdf',
      attachmentType: '身份证明',
      required: true,
      status: AttachmentStatus.ARCHIVED,
      currentVersion: 'V1.0',
      expectedVersion: 'V1.0',
      uploadedBy: '赵六',
      uploadedAt: dayjs().subtract(20, 'hour').toISOString(),
      validationResult: ValidationResult.PASS,
      versionMismatch: false,
    };

    this.attachmentItems.set(item1.id, item1);
    this.attachmentItems.set(item2.id, item2);
    this.attachmentItems.set(item3.id, item3);
    this.attachmentItems.set(item4.id, item4);
  }

  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values());
  }

  async getContractById(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async getAttachmentItems(): Promise<AttachmentItem[]> {
    return Array.from(this.attachmentItems.values());
  }

  async getAttachmentItemById(id: string): Promise<AttachmentItem | undefined> {
    return this.attachmentItems.get(id);
  }

  async getAttachmentItemsByContractId(contractId: string): Promise<AttachmentItem[]> {
    return Array.from(this.attachmentItems.values()).filter(
      (item) => item.contractId === contractId
    );
  }

  async updateAttachmentItem(id: string, data: Partial<AttachmentItem>): Promise<AttachmentItem | undefined> {
    const item = this.attachmentItems.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...data };
    this.attachmentItems.set(id, updated);
    return updated;
  }

  async addSupplementRecord(record: Omit<SupplementRecord, 'id'>): Promise<SupplementRecord> {
    const newRecord: SupplementRecord = {
      ...record,
      id: uuidv4(),
    };
    this.supplementRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  async getSupplementRecordsByAttachmentItemId(attachmentItemId: string): Promise<SupplementRecord[]> {
    return Array.from(this.supplementRecords.values()).filter(
      (r) => r.attachmentItemId === attachmentItemId
    );
  }

  async addHistoryRecord(record: Omit<HistoryRecord, 'id'>): Promise<HistoryRecord> {
    const newRecord: HistoryRecord = {
      ...record,
      id: uuidv4(),
    };
    this.historyRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  async getHistoryRecordsByAttachmentItemId(attachmentItemId: string): Promise<HistoryRecord[]> {
    return Array.from(this.historyRecords.values())
      .filter((r) => r.attachmentItemId === attachmentItemId)
      .sort((a, b) => new Date(b.operateAt).getTime() - new Date(a.operateAt).getTime());
  }

  async getHistoryRecordsByContractId(contractId: string): Promise<HistoryRecord[]> {
    return Array.from(this.historyRecords.values())
      .filter((r) => r.contractId === contractId)
      .sort((a, b) => new Date(b.operateAt).getTime() - new Date(a.operateAt).getTime());
  }
}

export const localStorage = new LocalStorage();
