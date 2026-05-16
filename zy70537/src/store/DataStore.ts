import * as fs from 'fs';
import * as path from 'path';
import { TenantGroup, GroupReport } from '../models/types';

export class DataStore {
  private dataDir: string;
  private groupsFile: string;
  private reportsFile: string;

  constructor(dataDir: string = './data') {
    this.dataDir = path.resolve(dataDir);
    this.groupsFile = path.join(this.dataDir, 'tenant-groups.json');
    this.reportsFile = path.join(this.dataDir, 'group-reports.json');
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.groupsFile)) {
      fs.writeFileSync(this.groupsFile, JSON.stringify([]));
    }
    if (!fs.existsSync(this.reportsFile)) {
      fs.writeFileSync(this.reportsFile, JSON.stringify([]));
    }
  }

  private readFromFile<T>(filePath: string): T[] {
    try {
      if (!fs.existsSync(filePath)) {
        this.ensureDataDir();
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T[];
    } catch (error) {
      this.ensureDataDir();
      return [];
    }
  }

  private writeToFile<T>(filePath: string, data: T[]): void {
    if (!fs.existsSync(path.dirname(filePath))) {
      this.ensureDataDir();
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  saveTenantGroup(group: TenantGroup): void {
    const groups = this.readFromFile<TenantGroup>(this.groupsFile);
    const existingIndex = groups.findIndex(g => g.groupId === group.groupId);
    if (existingIndex >= 0) {
      groups[existingIndex] = group;
    } else {
      groups.push(group);
    }
    this.writeToFile(this.groupsFile, groups);
  }

  getTenantGroup(groupId: string): TenantGroup | undefined {
    const groups = this.readFromFile<TenantGroup>(this.groupsFile);
    return groups.find(g => g.groupId === groupId);
  }

  getTenantGroupsByTenantId(tenantId: string): TenantGroup[] {
    const groups = this.readFromFile<TenantGroup>(this.groupsFile);
    return groups.filter(g => g.tenantId === tenantId);
  }

  getTenantGroupByRequestId(requestId: string): TenantGroup | undefined {
    const groups = this.readFromFile<TenantGroup>(this.groupsFile);
    return groups.find(g => g.requestId === requestId);
  }

  getAllTenantGroups(): TenantGroup[] {
    return this.readFromFile<TenantGroup>(this.groupsFile);
  }

  saveReport(report: GroupReport): void {
    const reports = this.readFromFile<GroupReport>(this.reportsFile);
    const existingIndex = reports.findIndex(r => r.reportId === report.reportId);
    if (existingIndex >= 0) {
      reports[existingIndex] = report;
    } else {
      reports.push(report);
    }
    this.writeToFile(this.reportsFile, reports);
  }

  getReport(reportId: string): GroupReport | undefined {
    const reports = this.readFromFile<GroupReport>(this.reportsFile);
    return reports.find(r => r.reportId === reportId);
  }

  getReportsByGroupId(groupId: string): GroupReport[] {
    const reports = this.readFromFile<GroupReport>(this.reportsFile);
    return reports.filter(r => r.groupId === groupId);
  }

  getAllReports(): GroupReport[] {
    return this.readFromFile<GroupReport>(this.reportsFile);
  }
}

export const dataStore = new DataStore();
