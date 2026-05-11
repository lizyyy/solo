import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { Storage } from '../store/storage';
import { ScheduledTask, Conflict, MaintenanceWindow, WorkTask, WorkZone, BlockSection, Resource } from '../types/models';

interface DetailedSchedule {
  windowId: string;
  windowDate: string;
  windowType: string;
  windowTime: string;
  windowPriority: number;
  taskId: string;
  taskTitle: string;
  taskWorkZone: string;
  taskAssignedTime: string;
  taskResources: string;
  taskBlockSections: string;
  status: string;
}

interface ResourceUsage {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  workZone: string;
  totalQuantity: number;
  usedQuantity: number;
  availableQuantity: number;
}

export class ExportService {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  private getWorkZoneName(id: string): string {
    const wz = this.storage.db.workZones.get(id);
    return wz ? wz.name : id;
  }

  private getBlockSectionName(id: string): string {
    const bs = this.storage.db.blockSections.get(id);
    return bs ? `${bs.line} ${bs.startStation}-${bs.endStation}` : id;
  }

  private getResourceName(id: string): string {
    const r = this.storage.db.resources.get(id);
    return r ? r.name : id;
  }

  async exportToExcel(outputPath: string): Promise<string> {
    const fullPath = path.resolve(outputPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '铁路检修天窗排程系统';
    workbook.created = new Date();

    await this.addOverviewSheet(workbook);
    await this.addScheduleSheet(workbook);
    await this.addResourceUsageSheet(workbook);
    await this.addConflictsSheet(workbook);
    await this.addDataSummarySheet(workbook);

    await workbook.xlsx.writeFile(fullPath);
    return fullPath;
  }

  private async addOverviewSheet(workbook: ExcelJS.Workbook): Promise<void> {
    const sheet = workbook.addWorksheet('概览');

    const lastRun = this.storage.getLastRunState();
    const scheduledCount = this.storage.db.scheduledTasks.size;
    const totalTasks = this.storage.db.workTasks.size;
    const conflictCount = this.storage.db.conflicts.length;

    sheet.columns = [
      { header: '项目', key: 'item', width: 25 },
      { header: '数值', key: 'value', width: 40 },
    ];

    sheet.addRow({ item: '排程运行时间', value: lastRun ? new Date(lastRun.timestamp).toLocaleString('zh-CN') : '未运行' });
    sheet.addRow({ item: '运行状态', value: lastRun?.status || '-' });
    sheet.addRow({ item: '天窗总数', value: this.storage.db.maintenanceWindows.size });
    sheet.addRow({ item: '任务总数', value: totalTasks });
    sheet.addRow({ item: '已排程任务', value: scheduledCount });
    sheet.addRow({ item: '未排程任务', value: totalTasks - scheduledCount });
    sheet.addRow({ item: '冲突数量', value: conflictCount });
    sheet.addRow({ item: '工区数量', value: this.storage.db.workZones.size });
    sheet.addRow({ item: '资源数量', value: this.storage.db.resources.size });
    sheet.addRow({ item: '封锁区段数量', value: this.storage.db.blockSections.size });

    sheet.getRow(1).font = { bold: true, size: 12 };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private async addScheduleSheet(workbook: ExcelJS.Workbook): Promise<void> {
    const sheet = workbook.addWorksheet('排程结果');

    sheet.columns = [
      { header: '天窗日期', key: 'windowDate', width: 15 },
      { header: '天窗类型', key: 'windowType', width: 10 },
      { header: '天窗时间', key: 'windowTime', width: 20 },
      { header: '任务名称', key: 'taskTitle', width: 30 },
      { header: '负责工区', key: 'taskWorkZone', width: 20 },
      { header: '分配时间', key: 'taskAssignedTime', width: 20 },
      { header: '使用资源', key: 'taskResources', width: 40 },
      { header: '封锁区段', key: 'taskBlockSections', width: 40 },
      { header: '状态', key: 'status', width: 12 },
    ];

    const schedules = this.buildDetailedSchedule();
    schedules.sort((a, b) => {
      if (a.windowDate !== b.windowDate) return a.windowDate.localeCompare(b.windowDate);
      return a.taskAssignedTime.localeCompare(b.taskAssignedTime);
    });

    for (const s of schedules) {
      sheet.addRow({
        windowDate: s.windowDate,
        windowType: s.windowType === 'day' ? '昼间' : '夜间',
        windowTime: s.windowTime,
        taskTitle: s.taskTitle,
        taskWorkZone: s.taskWorkZone,
        taskAssignedTime: s.taskAssignedTime,
        taskResources: s.taskResources,
        taskBlockSections: s.taskBlockSections,
        status: s.status,
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private async addResourceUsageSheet(workbook: ExcelJS.Workbook): Promise<void> {
    const sheet = workbook.addWorksheet('资源使用');

    sheet.columns = [
      { header: '资源ID', key: 'resourceId', width: 15 },
      { header: '资源名称', key: 'resourceName', width: 20 },
      { header: '资源类型', key: 'resourceType', width: 12 },
      { header: '所属工区', key: 'workZone', width: 20 },
      { header: '总数量', key: 'totalQuantity', width: 10 },
      { header: '已使用', key: 'usedQuantity', width: 10 },
      { header: '可用', key: 'availableQuantity', width: 10 },
      { header: '使用率', key: 'usageRate', width: 12 },
    ];

    const usage = this.calculateResourceUsage();
    for (const u of usage) {
      sheet.addRow({
        resourceId: u.resourceId,
        resourceName: u.resourceName,
        resourceType: u.resourceType === 'people' ? '人员' : u.resourceType === 'machine' ? '机械' : '材料',
        workZone: u.workZone,
        totalQuantity: u.totalQuantity,
        usedQuantity: u.usedQuantity,
        availableQuantity: u.availableQuantity,
        usageRate: `${((u.usedQuantity / u.totalQuantity) * 100).toFixed(1)}%`,
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private async addConflictsSheet(workbook: ExcelJS.Workbook): Promise<void> {
    const sheet = workbook.addWorksheet('异常冲突');

    sheet.columns = [
      { header: '冲突类型', key: 'type', width: 15 },
      { header: '严重程度', key: 'severity', width: 12 },
      { header: '描述', key: 'description', width: 60 },
      { header: '影响任务', key: 'affectedTasks', width: 30 },
    ];

    const conflicts = this.storage.db.conflicts;
    for (const c of conflicts) {
      sheet.addRow({
        type: this.translateConflictType(c.type),
        severity: c.severity === 'error' ? '错误' : '警告',
        description: c.description,
        affectedTasks: c.affectedTasks.join(', '),
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private async addDataSummarySheet(workbook: ExcelJS.Workbook): Promise<void> {
    const sheet = workbook.addWorksheet('数据清单');

    sheet.addRow(['天窗计划清单']);
    sheet.getRow(1).font = { bold: true };
    const headerRow1 = sheet.addRow(['ID', '日期', '类型', '时间', '封锁区段', '优先级']);
    headerRow1.font = { bold: true };

    for (const [id, w] of this.storage.db.maintenanceWindows) {
      sheet.addRow([
        id,
        w.date,
        w.windowType === 'day' ? '昼间' : '夜间',
        `${w.time.start}-${w.time.end}`,
        w.blockSections.map(s => this.getBlockSectionName(s)).join('; '),
        w.priority,
      ]);
    }

    const currentRow = sheet.lastRow?.number || 0;
    sheet.addRow([]);
    sheet.addRow(['工区任务清单']);
    sheet.getRow(currentRow + 2).font = { bold: true };
    const headerRow2 = sheet.addRow(['ID', '任务名称', '工区', '预计时长(分钟)', '所需资源', '所需封锁区段']);
    headerRow2.font = { bold: true };

    for (const [id, t] of this.storage.db.workTasks) {
      sheet.addRow([
        id,
        t.title,
        this.getWorkZoneName(t.workZoneId),
        t.estimatedDuration,
        t.requiredResources.map(r => `${this.getResourceName(r.resourceId)}x${r.quantity}`).join('; '),
        t.requiredBlockSections.map(s => this.getBlockSectionName(s)).join('; '),
      ]);
    }
  }

  private buildDetailedSchedule(): DetailedSchedule[] {
    const result: DetailedSchedule[] = [];

    for (const [id, st] of this.storage.db.scheduledTasks) {
      const window = this.storage.db.maintenanceWindows.get(st.windowId);
      const task = this.storage.db.workTasks.get(st.taskId);

      if (!window || !task) continue;

      result.push({
        windowId: st.windowId,
        windowDate: window.date,
        windowType: window.windowType,
        windowTime: `${window.time.start}-${window.time.end}`,
        windowPriority: window.priority,
        taskId: st.taskId,
        taskTitle: task.title,
        taskWorkZone: this.getWorkZoneName(st.workZoneId),
        taskAssignedTime: `${window.date} ${st.assignedTime.start}-${st.assignedTime.end}`,
        taskResources: st.assignedResources.map(r => 
          `${this.getResourceName(r.resourceId)}x${r.quantity}`
        ).join('; '),
        taskBlockSections: st.assignedBlockSections.map(s => this.getBlockSectionName(s)).join('; '),
        status: st.status,
      });
    }

    return result;
  }

  private calculateResourceUsage(): ResourceUsage[] {
    const result: ResourceUsage[] = [];

    for (const [id, res] of this.storage.db.resources) {
      let usedQuantity = 0;
      const resourceOccupancies = new Map<string, number>();

      for (const [occId, occ] of this.storage.db.resourceOccupancies) {
        if (occ.resourceId === id) {
          resourceOccupancies.set(occ.scheduledTaskId, 
            (resourceOccupancies.get(occ.scheduledTaskId) || 0) + occ.assignedQuantity);
        }
      }

      for (const qty of resourceOccupancies.values()) {
        usedQuantity = Math.max(usedQuantity, qty);
      }

      result.push({
        resourceId: id,
        resourceName: res.name,
        resourceType: res.type,
        workZone: this.getWorkZoneName(res.workZoneId),
        totalQuantity: res.quantity,
        usedQuantity,
        availableQuantity: res.quantity - usedQuantity,
      });
    }

    return result;
  }

  private translateConflictType(type: string): string {
    const map: Record<string, string> = {
      time: '时间冲突',
      resource: '资源冲突',
      block: '区段冲突',
      workzone: '工区冲突',
    };
    return map[type] || type;
  }

  exportStats(): {
    windows: number;
    tasks: number;
    scheduled: number;
    conflicts: number;
    workZones: number;
    resources: number;
    blockSections: number;
  } {
    return {
      windows: this.storage.db.maintenanceWindows.size,
      tasks: this.storage.db.workTasks.size,
      scheduled: this.storage.db.scheduledTasks.size,
      conflicts: this.storage.db.conflicts.length,
      workZones: this.storage.db.workZones.size,
      resources: this.storage.db.resources.size,
      blockSections: this.storage.db.blockSections.size,
    };
  }
}
