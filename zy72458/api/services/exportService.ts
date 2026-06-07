import { ResidentComplaint } from '../../shared/types.js';
import { dataSource } from '../data/dataSource.js';
import { complaintService } from './complaintService.js';
import { operationRecordService } from './operationRecordService.js';

export const exportService = {
  async exportAll(operator: string): Promise<{
    data: ResidentComplaint[];
    exportTime: string;
    count: number;
  }> {
    const data = await complaintService.getForExport();
    const exportTime = new Date().toISOString();

    await dataSource.saveExportSnapshot(data);

    await operationRecordService.record({
      command: 'export_data',
      operator,
      parameters: { count: data.length },
      result: 'success',
    });

    return {
      data,
      exportTime,
      count: data.length,
    };
  },

  async getUnifiedDataSource(): Promise<ResidentComplaint[]> {
    return complaintService.getForExport();
  },

  async getExportHistory(): Promise<{ timestamp: string; count: number } | null> {
    const snapshot = await dataSource.getExportSnapshot();
    if (!snapshot) return null;
    return {
      timestamp: snapshot.timestamp,
      count: snapshot.data.length,
    };
  },
};
