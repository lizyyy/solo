import { equipmentRepository } from '../repositories/equipmentRepository';
import { inspectionRepository } from '../repositories/inspectionRepository';
import { exceptionRepository } from '../repositories/exceptionRepository';
import { historyRepository } from '../repositories/historyRepository';
import { templateRepository } from '../repositories/templateRepository';
import { 
  Equipment, ShiftInspection, ExceptionRecord, DowntimeRecord, 
  MaintenanceAssignment, RecheckRecord, HistoryRecord,
  EquipmentStatus, ExceptionStatus, RecheckStatus
} from '../models';
import moment from 'moment';

export interface EquipmentStatusReport {
  equipment: Equipment;
  currentStatus: EquipmentStatus;
  lastInspection?: ShiftInspection;
  activeExceptions: ExceptionRecord[];
  totalDowntimeMinutes: number;
  recentDowntimes: DowntimeRecord[];
}

export interface ExceptionTimelineItem {
  type: 'DETECTED' | 'DOWNTIME' | 'MAINTENANCE' | 'RECHECK' | 'RESOLVED';
  timestamp: string;
  description: string;
  operator: string;
  details?: any;
}

export interface ShiftInspectionReport {
  inspection: ShiftInspection;
  equipment: Equipment;
  templateName: string;
  itemResults: any[];
  exceptions: ExceptionRecord[];
  totalItems: number;
  normalItems: number;
  abnormalItems: number;
  keyItems: number;
  keyItemsNormal: number;
}

export interface DashboardStats {
  totalEquipment: number;
  runningEquipment: number;
  stoppedEquipment: number;
  maintenanceEquipment: number;
  abnormalEquipment: number;
  todayInspections: number;
  todayExceptions: number;
  totalDowntimeTodayMinutes: number;
  pendingMaintenance: number;
}

export class ReportService {
  async getEquipmentStatus(equipmentId: string): Promise<EquipmentStatusReport> {
    const equipment = await equipmentRepository.findById(equipmentId);
    if (!equipment) {
      throw new Error('设备不存在');
    }

    const inspections = await inspectionRepository.findAll({ equipmentId });
    const lastInspection = inspections[0];

    const activeExceptions = (await exceptionRepository.findAllExceptions({ equipmentId }))
      .filter(e => e.status !== ExceptionStatus.RESOLVED);

    const downtimes = await exceptionRepository.findAllDowntime({ equipmentId });
    const totalDowntimeMinutes = downtimes.reduce((sum, d) => sum + (d.durationMinutes || 0), 0);
    const recentDowntimes = downtimes.slice(0, 5);

    return {
      equipment,
      currentStatus: equipment.status,
      lastInspection,
      activeExceptions,
      totalDowntimeMinutes,
      recentDowntimes
    };
  }

  async getExceptionTimeline(exceptionId: string): Promise<ExceptionTimelineItem[]> {
    const exception = await exceptionRepository.findExceptionById(exceptionId);
    if (!exception) {
      throw new Error('异常记录不存在');
    }

    const timeline: ExceptionTimelineItem[] = [];

    timeline.push({
      type: 'DETECTED',
      timestamp: exception.detectedAt,
      description: `异常发现: ${exception.description}`,
      operator: exception.reporterName,
      details: { level: exception.level }
    });

    const downtimes = await exceptionRepository.findAllDowntime({ exceptionId });
    for (const dt of downtimes) {
      timeline.push({
        type: 'DOWNTIME',
        timestamp: dt.startTime,
        description: `设备停机: ${dt.reason}`,
        operator: dt.operatorName,
        details: { duration: dt.durationMinutes ? `${dt.durationMinutes}分钟` : '进行中' }
      });
    }

    const maintenances = await exceptionRepository.findMaintenanceByException(exceptionId);
    for (const m of maintenances) {
      timeline.push({
        type: 'MAINTENANCE',
        timestamp: m.assignedAt,
        description: `维修派工给 ${m.assigneeName}`,
        operator: m.assigneeName,
        details: { priority: m.priority, status: m.status }
      });
    }

    const rechecks = await exceptionRepository.findRechecksByException(exceptionId);
    for (const r of rechecks) {
      timeline.push({
        type: 'RECHECK',
        timestamp: r.recheckedAt,
        description: `复检结果: ${r.result === RecheckStatus.PASSED ? '通过' : '失败'}`,
        operator: r.recheckerName,
        details: { remark: r.remark }
      });
    }

    if (exception.resolvedAt) {
      timeline.push({
        type: 'RESOLVED',
        timestamp: exception.resolvedAt,
        description: '异常已解决',
        operator: '系统'
      });
    }

    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getShiftInspectionReport(inspectionId: string): Promise<ShiftInspectionReport> {
    const inspection = await inspectionRepository.findById(inspectionId);
    if (!inspection) {
      throw new Error('点检记录不存在');
    }

    const equipment = (await equipmentRepository.findById(inspection.equipmentId))!;
    const template = (await templateRepository.findTemplateById(inspection.templateId))!;
    const itemResults = await inspectionRepository.findItemResultsByInspection(inspectionId);
    const exceptions = await exceptionRepository.findAllExceptions({ inspectionId });

    const templateItems = await templateRepository.findItemsByTemplate(inspection.templateId);
    const totalItems = templateItems.length;
    const keyItems = templateItems.filter(i => i.itemType === 'KEY').length;

    const normalItems = itemResults.filter(r => r.isNormal).length;
    const abnormalItems = itemResults.filter(r => !r.isNormal).length;
    const keyItemsNormal = itemResults.filter(r => r.itemType === 'KEY' && r.isNormal).length;

    return {
      inspection,
      equipment,
      templateName: template.name,
      itemResults,
      exceptions,
      totalItems,
      normalItems,
      abnormalItems,
      keyItems,
      keyItemsNormal
    };
  }

  async getDashboardStats(date?: string): Promise<DashboardStats> {
    const targetDate = date || moment().format('YYYY-MM-DD');

    const allEquipment = await equipmentRepository.findAll();
    const inspections = await inspectionRepository.findAll({ shiftDate: targetDate });
    const exceptions = await exceptionRepository.findAllExceptions();
    const todayExceptions = exceptions.filter(e => 
      moment(e.detectedAt).format('YYYY-MM-DD') === targetDate
    );
    
    const allDowntimes = await exceptionRepository.findAllDowntime();
    const todayDowntimes = allDowntimes.filter(d => 
      moment(d.startTime).format('YYYY-MM-DD') === targetDate
    );
    const totalDowntimeTodayMinutes = todayDowntimes.reduce(
      (sum, d) => sum + (d.durationMinutes || 0), 0
    );

    const allMaintenance = (await Promise.all(
      allEquipment.map(e => exceptionRepository.findMaintenanceByException(
        (exceptions.find(ex => ex.equipmentId === e.id && ex.status !== ExceptionStatus.RESOLVED) || { id: '' }).id
      ))
    )).flat();

    return {
      totalEquipment: allEquipment.length,
      runningEquipment: allEquipment.filter(e => e.status === EquipmentStatus.RUNNING).length,
      stoppedEquipment: allEquipment.filter(e => e.status === EquipmentStatus.STOPPED).length,
      maintenanceEquipment: allEquipment.filter(e => e.status === EquipmentStatus.MAINTENANCE).length,
      abnormalEquipment: allEquipment.filter(e => e.status === EquipmentStatus.ABNORMAL).length,
      todayInspections: inspections.length,
      todayExceptions: todayExceptions.length,
      totalDowntimeTodayMinutes,
      pendingMaintenance: allMaintenance.filter(m => 
        m.status !== 'COMPLETED' && m.status !== 'REJECTED'
      ).length
    };
  }

  async getHistory(entityType: string, entityId: string): Promise<HistoryRecord[]> {
    return historyRepository.findByEntity(entityType, entityId);
  }

  async exportShiftReportCSV(shiftDate: string, shift?: string): Promise<string> {
    const inspections = await inspectionRepository.findAll({ shiftDate });
    const filtered = shift ? inspections.filter(i => i.shift === shift) : inspections;

    const rows = [];
    for (const inspection of filtered) {
      const report = await this.getShiftInspectionReport(inspection.id);
      rows.push({
        日期: inspection.shiftDate,
        班次: inspection.shift,
        设备: report.equipment.name,
        设备编码: report.equipment.code,
        点检人: inspection.inspectorName,
        状态: inspection.status,
        点检项目数: report.totalItems,
        正常项目数: report.normalItems,
        异常项目数: report.abnormalItems,
        关键项目数: report.keyItems,
        关键项目正常数: report.keyItemsNormal,
        异常数: report.exceptions.length,
        开始时间: inspection.startTime || '',
        结束时间: inspection.endTime || ''
      });
    }

    if (rows.length === 0) {
      return '日期,班次,设备,设备编码,点检人,状态,点检项目数,正常项目数,异常项目数,关键项目数,关键项目正常数,异常数,开始时间,结束时间';
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(row => 
        headers.map(h => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');

    return csv;
  }
}

export const reportService = new ReportService();
