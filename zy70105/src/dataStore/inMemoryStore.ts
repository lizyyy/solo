import {
  Pesticide,
  Crop,
  Plot,
  IntervalRule,
  PesticideInventory,
  Requisition,
  RequisitionItem,
  ApprovalRecord,
  ViolationRecord,
  SupervisorLedger,
  ScheduledTask,
  TaskExecutionLog,
  BaseEntity
} from '../types';

class InMemoryStore {
  private pesticides: Map<string, Pesticide> = new Map();
  private crops: Map<string, Crop> = new Map();
  private plots: Map<string, Plot> = new Map();
  private intervalRules: Map<string, IntervalRule> = new Map();
  private inventories: Map<string, PesticideInventory> = new Map();
  private requisitions: Map<string, Requisition> = new Map();
  private requisitionItems: Map<string, RequisitionItem> = new Map();
  private approvalRecords: Map<string, ApprovalRecord> = new Map();
  private violationRecords: Map<string, ViolationRecord> = new Map();
  private ledgers: Map<string, SupervisorLedger> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private taskExecutionLogs: Map<string, TaskExecutionLog> = new Map();
  private counters: Map<string, number> = new Map();

  private nextId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `${timestamp}-${random}`;
  }

  private getNextSequence(name: string): number {
    const current = this.counters.get(name) || 0;
    const next = current + 1;
    this.counters.set(name, next);
    return next;
  }

  generateRequisitionNumber(): string {
    const seq = this.getNextSequence('requisition').toString().padStart(6, '0');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `REQ-${date}-${seq}`;
  }

  generateLedgerNumber(): string {
    const seq = this.getNextSequence('ledger').toString().padStart(6, '0');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LEDGER-${date}-${seq}`;
  }

  private createEntity<T extends BaseEntity>(data: Omit<T, keyof BaseEntity>): T {
    const now = new Date();
    return {
      id: this.nextId(),
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      ...data
    } as T;
  }

  private updateEntity<T extends BaseEntity>(
    existing: T,
    updates: Partial<T>
  ): T {
    return {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
  }

  pesticidesStore() {
    return {
      create: (data: Omit<Pesticide, keyof BaseEntity>) => {
        const entity = this.createEntity<Pesticide>(data);
        this.pesticides.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.pesticides.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findAll: () => Array.from(this.pesticides.values()).filter(p => !p.isDeleted),
      update: (id: string, updates: Partial<Pesticide>) => {
        const existing = this.pesticides.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.pesticides.set(id, updated);
        return updated;
      },
      delete: (id: string) => {
        const existing = this.pesticides.get(id);
        if (!existing) return false;
        this.pesticides.set(id, { ...existing, isDeleted: true, updatedAt: new Date() });
        return true;
      }
    };
  }

  cropsStore() {
    return {
      create: (data: Omit<Crop, keyof BaseEntity>) => {
        const entity = this.createEntity<Crop>(data);
        this.crops.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.crops.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findAll: () => Array.from(this.crops.values()).filter(c => !c.isDeleted),
      update: (id: string, updates: Partial<Crop>) => {
        const existing = this.crops.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.crops.set(id, updated);
        return updated;
      }
    };
  }

  plotsStore() {
    return {
      create: (data: Omit<Plot, keyof BaseEntity>) => {
        const entity = this.createEntity<Plot>(data);
        this.plots.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.plots.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findAll: () => Array.from(this.plots.values()).filter(p => !p.isDeleted),
      findByCropId: (cropId: string) => 
        Array.from(this.plots.values()).filter(p => !p.isDeleted && p.currentCropId === cropId),
      update: (id: string, updates: Partial<Plot>) => {
        const existing = this.plots.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.plots.set(id, updated);
        return updated;
      }
    };
  }

  intervalRulesStore() {
    return {
      create: (data: Omit<IntervalRule, keyof BaseEntity>) => {
        const entity = this.createEntity<IntervalRule>(data);
        this.intervalRules.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.intervalRules.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findAll: () => Array.from(this.intervalRules.values()).filter(r => !r.isDeleted),
      findByPesticideAndCrop: (pesticideId: string, cropId: string) =>
        Array.from(this.intervalRules.values()).filter(
          r => !r.isDeleted && r.isActive && r.pesticideId === pesticideId && r.cropId === cropId
        ),
      update: (id: string, updates: Partial<IntervalRule>) => {
        const existing = this.intervalRules.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.intervalRules.set(id, updated);
        return updated;
      }
    };
  }

  inventoriesStore() {
    return {
      create: (data: Omit<PesticideInventory, keyof BaseEntity>) => {
        const entity = this.createEntity<PesticideInventory>(data);
        this.inventories.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.inventories.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findAll: () => Array.from(this.inventories.values()).filter(i => !i.isDeleted),
      findByPesticideId: (pesticideId: string) =>
        Array.from(this.inventories.values()).filter(
          i => !i.isDeleted && i.pesticideId === pesticideId && i.quantity > 0
        ),
      getTotalByPesticideId: (pesticideId: string) => {
        return this.inventoriesStore()
          .findByPesticideId(pesticideId)
          .reduce((sum, inv) => sum + inv.quantity, 0);
      },
      update: (id: string, updates: Partial<PesticideInventory>) => {
        const existing = this.inventories.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.inventories.set(id, updated);
        return updated;
      }
    };
  }

  requisitionsStore() {
    return {
      create: (data: Omit<Requisition, keyof BaseEntity | 'requisitionNumber'>) => {
        const entity = this.createEntity<Requisition>({
          ...data,
          requisitionNumber: this.generateRequisitionNumber()
        });
        this.requisitions.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.requisitions.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findByNumber: (number: string) => {
        return Array.from(this.requisitions.values())
          .find(r => !r.isDeleted && r.requisitionNumber === number);
      },
      findAll: () => Array.from(this.requisitions.values()).filter(r => !r.isDeleted),
      findByStatus: (status: Requisition['status']) =>
        Array.from(this.requisitions.values()).filter(
          r => !r.isDeleted && r.status === status
        ),
      findByApplicant: (applicantId: string) =>
        Array.from(this.requisitions.values()).filter(
          r => !r.isDeleted && r.applicantId === applicantId
        ),
      update: (id: string, updates: Partial<Requisition>) => {
        const existing = this.requisitions.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.requisitions.set(id, updated);
        return updated;
      }
    };
  }

  requisitionItemsStore() {
    return {
      create: (data: Omit<RequisitionItem, keyof BaseEntity>) => {
        const entity = this.createEntity<RequisitionItem>(data);
        this.requisitionItems.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.requisitionItems.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findByRequisitionId: (requisitionId: string) =>
        Array.from(this.requisitionItems.values()).filter(
          i => !i.isDeleted && i.requisitionId === requisitionId
        ),
      findByPlotId: (plotId: string) =>
        Array.from(this.requisitionItems.values()).filter(
          i => !i.isDeleted && i.plotId === plotId
        ),
      findByPlotIdAndDate: (plotId: string, startDate: Date, endDate: Date) =>
        Array.from(this.requisitionItems.values()).filter(
          i => !i.isDeleted && 
               i.plotId === plotId && 
               i.expectedApplicationDate >= startDate && 
               i.expectedApplicationDate <= endDate
        ),
      update: (id: string, updates: Partial<RequisitionItem>) => {
        const existing = this.requisitionItems.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.requisitionItems.set(id, updated);
        return updated;
      }
    };
  }

  approvalRecordsStore() {
    return {
      create: (data: Omit<ApprovalRecord, keyof BaseEntity>) => {
        const entity = this.createEntity<ApprovalRecord>(data);
        this.approvalRecords.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => this.approvalRecords.get(id),
      findByRequisitionId: (requisitionId: string) =>
        Array.from(this.approvalRecords.values())
          .filter(r => r.requisitionId === requisitionId)
          .sort((a, b) => a.processedAt.getTime() - b.processedAt.getTime()),
      findLastByRequisitionId: (requisitionId: string) => {
        const records = this.approvalRecordsStore().findByRequisitionId(requisitionId);
        return records.length > 0 ? records[records.length - 1] : undefined;
      }
    };
  }

  violationRecordsStore() {
    return {
      create: (data: Omit<ViolationRecord, keyof BaseEntity>) => {
        const entity = this.createEntity<ViolationRecord>(data);
        this.violationRecords.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.violationRecords.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findByRequisitionId: (requisitionId: string) =>
        Array.from(this.violationRecords.values()).filter(
          v => !v.isDeleted && v.requisitionId === requisitionId
        ),
      findUnresolved: () =>
        Array.from(this.violationRecords.values()).filter(
          v => !v.isDeleted && !v.isResolved
        ),
      update: (id: string, updates: Partial<ViolationRecord>) => {
        const existing = this.violationRecords.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.violationRecords.set(id, updated);
        return updated;
      }
    };
  }

  ledgersStore() {
    return {
      create: (data: Omit<SupervisorLedger, keyof BaseEntity | 'ledgerNumber'>) => {
        const entity = this.createEntity<SupervisorLedger>({
          ...data,
          ledgerNumber: this.generateLedgerNumber()
        });
        this.ledgers.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.ledgers.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findAll: () => Array.from(this.ledgers.values()).filter(l => !l.isDeleted),
      findByRequisitionId: (requisitionId: string) =>
        Array.from(this.ledgers.values()).filter(
          l => !l.isDeleted && l.requisitionId === requisitionId
        ),
      findByDateRange: (startDate: Date, endDate: Date) =>
        Array.from(this.ledgers.values()).filter(
          l => !l.isDeleted && 
               l.applicationDate >= startDate && 
               l.applicationDate <= endDate
        )
    };
  }

  scheduledTasksStore() {
    return {
      create: (data: Omit<ScheduledTask, keyof BaseEntity>) => {
        const entity = this.createEntity<ScheduledTask>(data);
        this.scheduledTasks.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => {
        const item = this.scheduledTasks.get(id);
        return item && !item.isDeleted ? item : undefined;
      },
      findByName: (name: string) =>
        Array.from(this.scheduledTasks.values()).find(
          t => !t.isDeleted && t.name === name
        ),
      findAll: () => Array.from(this.scheduledTasks.values()).filter(t => !t.isDeleted),
      findEnabled: () =>
        Array.from(this.scheduledTasks.values()).filter(
          t => !t.isDeleted && t.isEnabled
        ),
      update: (id: string, updates: Partial<ScheduledTask>) => {
        const existing = this.scheduledTasks.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.scheduledTasks.set(id, updated);
        return updated;
      }
    };
  }

  taskExecutionLogsStore() {
    return {
      create: (data: Omit<TaskExecutionLog, keyof BaseEntity>) => {
        const entity = this.createEntity<TaskExecutionLog>(data);
        this.taskExecutionLogs.set(entity.id, entity);
        return entity;
      },
      findById: (id: string) => this.taskExecutionLogs.get(id),
      findByTaskId: (taskId: string) =>
        Array.from(this.taskExecutionLogs.values())
          .filter(l => l.taskId === taskId)
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()),
      findByStatus: (status: TaskExecutionLog['status']) =>
        Array.from(this.taskExecutionLogs.values()).filter(l => l.status === status),
      update: (id: string, updates: Partial<TaskExecutionLog>) => {
        const existing = this.taskExecutionLogs.get(id);
        if (!existing) return undefined;
        const updated = this.updateEntity(existing, updates);
        this.taskExecutionLogs.set(id, updated);
        return updated;
      }
    };
  }

  clearAll(): void {
    this.pesticides.clear();
    this.crops.clear();
    this.plots.clear();
    this.intervalRules.clear();
    this.inventories.clear();
    this.requisitions.clear();
    this.requisitionItems.clear();
    this.approvalRecords.clear();
    this.violationRecords.clear();
    this.ledgers.clear();
    this.scheduledTasks.clear();
    this.taskExecutionLogs.clear();
    this.counters.clear();
  }
}

export const store = new InMemoryStore();
