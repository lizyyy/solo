import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { PickupAuthorization, AuthorizationStatus } from '../models/types';
import { dataStore } from '../data/store';

export interface ExportFilter {
  status?: AuthorizationStatus;
  childId?: string;
  guardianId?: string;
  startDate?: string;
  endDate?: string;
}

export class ExportService {
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  private ensureExportDir(): void {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  private filterAuthorizations(filter: ExportFilter): PickupAuthorization[] {
    let authorizations = dataStore.getAuthorizations();

    if (filter.status) {
      authorizations = authorizations.filter(a => a.status === filter.status);
    }
    if (filter.childId) {
      authorizations = authorizations.filter(a => a.childId === filter.childId);
    }
    if (filter.guardianId) {
      authorizations = authorizations.filter(a => a.guardianId === filter.guardianId);
    }
    if (filter.startDate) {
      authorizations = authorizations.filter(a => a.effectiveStartDate >= filter.startDate);
    }
    if (filter.endDate) {
      authorizations = authorizations.filter(a => a.effectiveEndDate <= filter.endDate);
    }

    return authorizations;
  }

  async exportToJson(filter: ExportFilter = {}): Promise<{ filePath: string; count: number }> {
    const authorizations = this.filterAuthorizations(filter);
    const fileName = `authorizations_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    const filePath = path.join(this.exportDir, fileName);

    const exportData = {
      exportDate: new Date().toISOString(),
      filter,
      total: authorizations.length,
      data: authorizations
    };

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

    return { filePath, count: authorizations.length };
  }

  async exportToCsv(filter: ExportFilter = {}): Promise<{ filePath: string; count: number }> {
    const authorizations = this.filterAuthorizations(filter);
    const fileName = `authorizations_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '授权编号' },
        { id: 'childName', title: '儿童姓名' },
        { id: 'guardianName', title: '接送人姓名' },
        { id: 'pickupType', title: '接送类型' },
        { id: 'relationType', title: '亲属关系' },
        { id: 'effectiveStartDate', title: '生效开始日期' },
        { id: 'effectiveEndDate', title: '生效结束日期' },
        { id: 'status', title: '状态' },
        { id: 'idVerificationRequired', title: '是否需要身份验证' },
        { id: 'submissionSource', title: '提交来源' },
        { id: 'submittedBy', title: '提交人' },
        { id: 'submittedAt', title: '提交时间' },
        { id: 'notes', title: '备注' }
      ]
    });

    const records = authorizations.map(a => ({
      id: a.id,
      childName: a.childName,
      guardianName: a.guardianName,
      pickupType: a.pickupType,
      relationType: a.relationType,
      effectiveStartDate: a.effectiveStartDate,
      effectiveEndDate: a.effectiveEndDate,
      status: a.status,
      idVerificationRequired: a.idVerificationRequired ? '是' : '否',
      submissionSource: a.submissionSource,
      submittedBy: a.submittedBy,
      submittedAt: a.submittedAt,
      notes: a.notes || ''
    }));

    await csvWriter.writeRecords(records);

    return { filePath, count: authorizations.length };
  }

  getExportFiles(): string[] {
    return fs.readdirSync(this.exportDir);
  }

  getFilePath(fileName: string): string {
    return path.join(this.exportDir, fileName);
  }
}

export const exportService = new ExportService();
