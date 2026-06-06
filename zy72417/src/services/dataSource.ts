import {
  UnifiedDataSource,
  AuthorizationTerm,
  ChangeRecord,
  TunerMessage,
  EquipmentRepairOrder,
  WriteOffRecord,
  SelfCheckRecord,
  ImportBatch,
  ProcessingStatus,
  ViewMode
} from '../types';
import { v4 as uuidv4 } from 'uuid';

class DataSourceService {
  private data: UnifiedDataSource;
  private instanceId: string;

  constructor() {
    this.instanceId = uuidv4();
    this.data = {
      authorizationTerms: [],
      changeRecords: [],
      tunerMessages: [],
      repairOrders: [],
      writeOffRecords: [],
      selfCheckRecords: [],
      importBatches: []
    };
    console.log(`[DataSourceService] 统一数据源实例已创建: ${this.instanceId}`);
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  getUnifiedData(viewMode?: ViewMode): UnifiedDataSource {
    console.log(`[DataSourceService] 读取统一数据 - 视图模式: ${viewMode || 'default'}, 数据源实例: ${this.instanceId}`);
    return JSON.parse(JSON.stringify(this.data));
  }

  getAuthorizationTerms(viewMode?: ViewMode): AuthorizationTerm[] {
    console.log(`[DataSourceService] 读取授权期限数据 - 视图模式: ${viewMode || 'default'}, 共 ${this.data.authorizationTerms.length} 条`);
    return JSON.parse(JSON.stringify(this.data.authorizationTerms));
  }

  getAuthorizationTermById(id: string): AuthorizationTerm | undefined {
    return this.data.authorizationTerms.find(t => t.id === id);
  }

  addAuthorizationTerm(term: AuthorizationTerm): void {
    const existing = this.data.authorizationTerms.find(t => t.id === term.id);
    if (existing) {
      throw new Error(`授权期限记录已存在: ${term.id}`);
    }
    this.data.authorizationTerms.push(term);
    console.log(`[DataSourceService] 新增授权期限记录: ${term.id}, 原始行号: ${term.originalRowNumber}`);
  }

  updateAuthorizationTerm(id: string, updates: Partial<AuthorizationTerm>, changedBy: string, changeReason: string): void {
    const index = this.data.authorizationTerms.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error(`授权期限记录不存在: ${id}`);
    }

    const oldTerm = this.data.authorizationTerms[index];
    const newVersion = oldTerm.version + 1;

    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = (oldTerm as any)[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        const changeRecord: ChangeRecord = {
          id: uuidv4(),
          authorizationTermId: id,
          fieldName: field,
          oldValue: JSON.stringify(oldValue),
          newValue: JSON.stringify(newValue),
          changedBy,
          changedAt: new Date().toISOString(),
          changeReason,
          version: newVersion
        };
        this.data.changeRecords.push(changeRecord);
        console.log(`[DataSourceService] 记录变更: ${field} 从 ${oldValue} 改为 ${newValue}, 版本: ${newVersion}`);
      }
    }

    this.data.authorizationTerms[index] = {
      ...oldTerm,
      ...updates,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: changedBy
    };
  }

  getChangeRecords(authorizationTermId?: string): ChangeRecord[] {
    if (authorizationTermId) {
      return this.data.changeRecords.filter(c => c.authorizationTermId === authorizationTermId);
    }
    return [...this.data.changeRecords];
  }

  addTunerMessage(message: TunerMessage): void {
    this.data.tunerMessages.push(message);
    console.log(`[DataSourceService] 新增调音师留言: ${message.id}`);
  }

  getTunerMessages(authorizationTermId?: string): TunerMessage[] {
    if (authorizationTermId) {
      return this.data.tunerMessages.filter(m => m.authorizationTermId === authorizationTermId);
    }
    return [...this.data.tunerMessages];
  }

  updateTunerMessage(id: string, updates: Partial<TunerMessage>): void {
    const index = this.data.tunerMessages.findIndex(m => m.id === id);
    if (index !== -1) {
      this.data.tunerMessages[index] = { ...this.data.tunerMessages[index], ...updates };
    }
  }

  addRepairOrder(order: EquipmentRepairOrder): void {
    this.data.repairOrders.push(order);
  }

  getRepairOrders(authorizationTermId?: string): EquipmentRepairOrder[] {
    if (authorizationTermId) {
      return this.data.repairOrders.filter(o => o.authorizationTermId === authorizationTermId);
    }
    return [...this.data.repairOrders];
  }

  addWriteOffRecord(record: WriteOffRecord): void {
    this.data.writeOffRecords.push(record);
  }

  getWriteOffRecords(authorizationTermId?: string): WriteOffRecord[] {
    if (authorizationTermId) {
      return this.data.writeOffRecords.filter(w => w.authorizationTermId === authorizationTermId);
    }
    return [...this.data.writeOffRecords];
  }

  addSelfCheckRecord(record: SelfCheckRecord): void {
    this.data.selfCheckRecords.push(record);
    console.log(`[DataSourceService] 新增自检记录: ${record.checkType} - ${record.result}`);
  }

  getSelfCheckRecords(): SelfCheckRecord[] {
    return [...this.data.selfCheckRecords];
  }

  addImportBatch(batch: ImportBatch): void {
    this.data.importBatches.push(batch);
  }

  getImportBatches(): ImportBatch[] {
    return [...this.data.importBatches];
  }

  verifyDataConsistency(): { isConsistent: boolean; details: string[] } {
    const issues: string[] = [];
    
    this.data.authorizationTerms.forEach(term => {
      if (term.tunerMessageId) {
        const message = this.data.tunerMessages.find(m => m.id === term.tunerMessageId);
        if (!message) {
          issues.push(`授权期限 ${term.id} 关联的调音师留言 ${term.tunerMessageId} 不存在`);
        }
      }
      if (term.writeOffId) {
        const writeOff = this.data.writeOffRecords.find(w => w.id === term.writeOffId);
        if (!writeOff) {
          issues.push(`授权期限 ${term.id} 关联的核销单 ${term.writeOffId} 不存在`);
        }
      }
    });

    return {
      isConsistent: issues.length === 0,
      details: issues
    };
  }
}

export const dataSource = new DataSourceService();
export default dataSource;
