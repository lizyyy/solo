import { randomUUID } from 'crypto';
import { OperationRecord } from '../../shared/types.js';
import { dataSource } from '../data/dataSource.js';

export const operationRecordService = {
  async record(params: {
    command: string;
    operator: string;
    parameters: Record<string, unknown>;
    result: 'success' | 'failed';
    errorMessage?: string;
  }): Promise<OperationRecord> {
    const records = await dataSource.getOperationRecords();
    const record: OperationRecord = {
      id: randomUUID(),
      command: params.command,
      operator: params.operator,
      timestamp: new Date().toISOString(),
      parameters: params.parameters,
      result: params.result,
      errorMessage: params.errorMessage,
    };
    records.push(record);
    await dataSource.saveOperationRecords(records);
    return record;
  },

  async getAll(): Promise<OperationRecord[]> {
    const records = await dataSource.getOperationRecords();
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
};
