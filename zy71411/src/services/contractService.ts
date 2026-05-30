import { ForwardContract, RolloverApplication, PaymentRecord, HistoryRecord, FieldChange } from '../types';
import { getMockData } from '../mock/data';
import { generateId } from '../utils/formatters';

export class ContractService {
  private static data = getMockData();

  static async getContracts(): Promise<ForwardContract[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...this.data.contracts]), 300);
    });
  }

  static async getRolloverApplications(): Promise<RolloverApplication[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...this.data.rolloverApps]), 200);
    });
  }

  static async getPayments(): Promise<PaymentRecord[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...this.data.payments]), 200);
    });
  }

  static async updateContract(
    id: string,
    updates: Partial<ForwardContract>,
    _operator: string,
    _reason: string
  ): Promise<{ contract: ForwardContract; change: FieldChange[] }> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = this.data.contracts.findIndex(c => c.id === id);
        if (idx === -1) {
          reject(new Error('合约不存在'));
          return;
        }

        const oldContract = { ...this.data.contracts[idx] };
        const fieldChanges: FieldChange[] = [];

        for (const [key, value] of Object.entries(updates)) {
          const oldValue = oldContract[key as keyof ForwardContract];
          if (oldValue !== value) {
            fieldChanges.push({
              fieldName: key,
              oldValue,
              newValue: value,
              isManuallyModified: true,
            });
          }
        }

        const newContract: ForwardContract = {
          ...oldContract,
          ...updates,
          isManuallyModified: fieldChanges.some(c => c.isManuallyModified) || oldContract.isManuallyModified,
          updatedAt: new Date(),
        };

        this.data.contracts[idx] = newContract;
        resolve({ contract: newContract, change: fieldChanges });
      }, 200);
    });
  }

  static async supplementApplicationData(
    applicationId: string,
    updates: Partial<RolloverApplication>,
    _operator: string,
    _reason: string
  ): Promise<{ application: RolloverApplication; change: FieldChange[] }> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const idx = this.data.rolloverApps.findIndex(a => a.id === applicationId);
        if (idx === -1) {
          reject(new Error('展期申请不存在'));
          return;
        }

        const oldApp = { ...this.data.rolloverApps[idx] };
        const fieldChanges: FieldChange[] = [];

        for (const [key, value] of Object.entries(updates)) {
          const oldValue = oldApp[key as keyof RolloverApplication];
          if (oldValue !== value) {
            fieldChanges.push({
              fieldName: key,
              oldValue,
              newValue: value,
              isManuallyModified: false,
            });
          }
        }

        const newApp: RolloverApplication = {
          ...oldApp,
          ...updates,
          hasSupplementalData: true,
          updatedAt: new Date(),
        };

        this.data.rolloverApps[idx] = newApp;
        resolve({ application: newApp, change: fieldChanges });
      }, 200);
    });
  }

  static getContractChain(contractId: string): ForwardContract[] {
    const chain: ForwardContract[] = [];
    let currentId: string | undefined = contractId;

    while (currentId) {
      const current = this.data.contracts.find(c => c.id === currentId);
      if (!current) break;
      chain.unshift(current);
      currentId = current.rolloverFrom;
    }

    currentId = chain[chain.length - 1]?.rolloverTo;
    while (currentId) {
      const current = this.data.contracts.find(c => c.id === currentId);
      if (!current) break;
      chain.push(current);
      currentId = current.rolloverTo;
    }

    return chain;
  }
}

export class HistoryService {
  private static data = getMockData();

  static async getHistory(): Promise<HistoryRecord[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...this.data.history].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )), 200);
    });
  }

  static async addRecord(record: Omit<HistoryRecord, 'id' | 'timestamp'>): Promise<HistoryRecord> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newRecord: HistoryRecord = {
          ...record,
          id: generateId(),
          timestamp: new Date(),
        };
        this.data.history.unshift(newRecord);
        resolve(newRecord);
      }, 100);
    });
  }

  static getByContractId(contractId: string): HistoryRecord[] {
    return this.data.history
      .filter(h => h.contractId === contractId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  static getByOperator(operator: string): HistoryRecord[] {
    return this.data.history
      .filter(h => h.operator === operator)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
