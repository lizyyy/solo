import * as ExcelJS from 'exceljs';
import { CanteenService } from './canteen-service';
import { AssignmentStatus } from '../entities/MealAssignment';
import { DeliveryStatus } from '../entities/Delivery';
import { SatisfactionLevel } from '../entities/FollowUp';
import { AuditService, AuditContext } from './audit-service';
import { AuditAction, AuditEntity } from '../entities/AuditLog';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  assignedBy?: string;
  hasConflicts?: boolean;
  assignmentStatus?: AssignmentStatus;
  deliveryStatus?: DeliveryStatus;
  satisfaction?: SatisfactionLevel;
  elderId?: string;
}

export interface ReportSummary {
  totalAssignments: number;
  conflictCount: number;
  deliveredCount: number;
  pendingDeliveryCount: number;
  failedDeliveryCount: number;
  avgSatisfaction: number;
  satisfactionBreakdown: Record<SatisfactionLevel, number>;
}

export class ReportService {
  static async generateReportSummary(filters: ReportFilters): Promise<ReportSummary> {
    const assignments = await CanteenService.getAssignments({
      startDate: filters.startDate,
      endDate: filters.endDate,
      assignedBy: filters.assignedBy,
      hasConflicts: filters.hasConflicts,
      status: filters.assignmentStatus
    });

    const deliveries = await CanteenService.getDeliveries({
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    const followUps = await CanteenService.getFollowUps({
      startDate: filters.startDate,
      endDate: filters.endDate,
      satisfaction: filters.satisfaction
    });

    const satisfactionBreakdown = {} as Record<SatisfactionLevel, number>;
    Object.values(SatisfactionLevel).forEach(level => {
      satisfactionBreakdown[level] = followUps.filter(f => f.satisfaction === level).length;
    });

    const totalSatisfaction = followUps.reduce((sum, f) => {
      const values: Record<SatisfactionLevel, number> = {
        [SatisfactionLevel.VERY_DISSATISFIED]: 1,
        [SatisfactionLevel.DISSATISFIED]: 2,
        [SatisfactionLevel.NEUTRAL]: 3,
        [SatisfactionLevel.SATISFIED]: 4,
        [SatisfactionLevel.VERY_SATISFIED]: 5
      };
      return sum + values[f.satisfaction];
    }, 0);

    return {
      totalAssignments: assignments.length,
      conflictCount: assignments.filter(a => a.hasConflicts).length,
      deliveredCount: deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
      pendingDeliveryCount: deliveries.filter(d => d.status === DeliveryStatus.PENDING).length,
      failedDeliveryCount: deliveries.filter(d => d.status === DeliveryStatus.FAILED).length,
      avgSatisfaction: followUps.length > 0 ? totalSatisfaction / followUps.length : 0,
      satisfactionBreakdown
    };
  }

  static async exportToExcel(filters: ReportFilters, context: AuditContext): Promise<Buffer> {
    const summary = await this.generateReportSummary(filters);
    const assignments = await CanteenService.getAssignments({
      startDate: filters.startDate,
      endDate: filters.endDate,
      assignedBy: filters.assignedBy,
      hasConflicts: filters.hasConflicts,
      status: filters.assignmentStatus
    });

    const deliveries = await CanteenService.getDeliveries({
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    const followUps = await CanteenService.getFollowUps({
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    const auditLogs = await AuditService.queryLogs({
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('汇总');
    summarySheet.columns = [
      { header: '指标', key: 'metric', width: 30 },
      { header: '数值', key: 'value', width: 20 }
    ];
    summarySheet.addRow({ metric: '总配餐数', value: summary.totalAssignments });
    summarySheet.addRow({ metric: '存在冲突数', value: summary.conflictCount });
    summarySheet.addRow({ metric: '已配送数', value: summary.deliveredCount });
    summarySheet.addRow({ metric: '待配送数', value: summary.pendingDeliveryCount });
    summarySheet.addRow({ metric: '配送失败数', value: summary.failedDeliveryCount });
    summarySheet.addRow({ metric: '平均满意度', value: summary.avgSatisfaction.toFixed(2) });

    const satisfactionSheet = workbook.addWorksheet('满意度分布');
    satisfactionSheet.columns = [
      { header: '满意度等级', key: 'level', width: 20 },
      { header: '数量', key: 'count', width: 15 }
    ];
    const levelLabels: Record<SatisfactionLevel, string> = {
      [SatisfactionLevel.VERY_DISSATISFIED]: '非常不满意',
      [SatisfactionLevel.DISSATISFIED]: '不满意',
      [SatisfactionLevel.NEUTRAL]: '一般',
      [SatisfactionLevel.SATISFIED]: '满意',
      [SatisfactionLevel.VERY_SATISFIED]: '非常满意'
    };
    Object.entries(summary.satisfactionBreakdown).forEach(([level, count]) => {
      satisfactionSheet.addRow({ level: levelLabels[level as SatisfactionLevel], count });
    });

    const assignmentSheet = workbook.addWorksheet('配餐记录');
    assignmentSheet.columns = [
      { header: '配餐ID', key: 'id', width: 36 },
      { header: '老人姓名', key: 'elderName', width: 15 },
      { header: '餐食名称', key: 'mealName', width: 20 },
      { header: '配餐日期', key: 'assignedAt', width: 20 },
      { header: '状态', key: 'status', width: 15 },
      { header: '是否有冲突', key: 'hasConflicts', width: 12 },
      { header: '操作人', key: 'assignedBy', width: 15 },
      { header: '备注', key: 'notes', width: 30 }
    ];
    assignments.forEach(a => {
      assignmentSheet.addRow({
        id: a.id,
        elderName: a.elder?.name || '',
        mealName: a.meal?.name || '',
        assignedAt: a.assignedAt?.toLocaleString() || '',
        status: this.getStatusLabel(a.status),
        hasConflicts: a.hasConflicts ? '是' : '否',
        assignedBy: a.assignedBy,
        notes: a.notes || ''
      });
    });

    const deliverySheet = workbook.addWorksheet('配送记录');
    deliverySheet.columns = [
      { header: '配送ID', key: 'id', width: 36 },
      { header: '老人姓名', key: 'elderName', width: 15 },
      { header: '餐食名称', key: 'mealName', width: 20 },
      { header: '配送员', key: 'deliveryPerson', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '实际配送时间', key: 'actualDeliveryTime', width: 20 },
      { header: '签收人', key: 'recipientName', width: 15 },
      { header: '失败原因', key: 'failureReason', width: 30 }
    ];
    deliveries.forEach(d => {
      deliverySheet.addRow({
        id: d.id,
        elderName: d.assignment?.elder?.name || '',
        mealName: d.assignment?.meal?.name || '',
        deliveryPerson: d.deliveryPerson || '',
        status: this.getDeliveryStatusLabel(d.status),
        actualDeliveryTime: d.actualDeliveryTime?.toLocaleString() || '',
        recipientName: d.recipientName || '',
        failureReason: d.failureReason || ''
      });
    });

    const followUpSheet = workbook.addWorksheet('回访记录');
    followUpSheet.columns = [
      { header: '回访ID', key: 'id', width: 36 },
      { header: '老人姓名', key: 'elderName', width: 15 },
      { header: '餐食名称', key: 'mealName', width: 20 },
      { header: '满意度', key: 'satisfaction', width: 15 },
      { header: '餐食质量合格', key: 'mealQualityOk', width: 15 },
      { header: '温度合格', key: 'temperatureOk', width: 12 },
      { header: '配送时间合格', key: 'deliveryTimeOk', width: 15 },
      { header: '回访人', key: 'conductedBy', width: 15 },
      { header: '回访时间', key: 'conductedAt', width: 20 }
    ];
    followUps.forEach(f => {
      followUpSheet.addRow({
        id: f.id,
        elderName: f.assignment?.elder?.name || '',
        mealName: f.assignment?.meal?.name || '',
        satisfaction: levelLabels[f.satisfaction],
        mealQualityOk: f.mealQualityOk ? '是' : '否',
        temperatureOk: f.temperatureOk ? '是' : '否',
        deliveryTimeOk: f.deliveryTimeOk ? '是' : '否',
        conductedBy: f.conductedBy,
        conductedAt: f.conductedAt?.toLocaleString() || ''
      });
    });

    const auditSheet = workbook.addWorksheet('审计日志');
    auditSheet.columns = [
      { header: '操作时间', key: 'operatedAt', width: 20 },
      { header: '操作类型', key: 'action', width: 20 },
      { header: '实体类型', key: 'entity', width: 15 },
      { header: '实体ID', key: 'entityId', width: 36 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '操作人角色', key: 'operatorRole', width: 15 },
      { header: '是否成功', key: 'success', width: 10 },
      { header: '原因', key: 'reason', width: 30 }
    ];
    auditLogs.forEach(log => {
      auditSheet.addRow({
        operatedAt: log.operatedAt?.toLocaleString() || '',
        action: this.getAuditActionLabel(log.action),
        entity: this.getAuditEntityLabel(log.entity),
        entityId: log.entityId || '',
        operator: log.operator,
        operatorRole: log.operatorRole,
        success: log.success ? '是' : '否',
        reason: log.reason || ''
      });
    });

    await AuditService.log(AuditAction.EXPORT, AuditEntity.REPORT, context, {
      reason: `导出报告，时间段：${filters.startDate?.toLocaleDateString() || '不限'} - ${filters.endDate?.toLocaleDateString() || '不限'}`
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private static getStatusLabel(status: AssignmentStatus): string {
    const labels: Record<AssignmentStatus, string> = {
      [AssignmentStatus.PENDING]: '待处理',
      [AssignmentStatus.CONFIRMED]: '已确认',
      [AssignmentStatus.DELIVERED]: '已配送',
      [AssignmentStatus.CANCELLED]: '已取消',
      [AssignmentStatus.CHANGED]: '已变更'
    };
    return labels[status] || status;
  }

  private static getDeliveryStatusLabel(status: DeliveryStatus): string {
    const labels: Record<DeliveryStatus, string> = {
      [DeliveryStatus.PENDING]: '待配送',
      [DeliveryStatus.IN_TRANSIT]: '配送中',
      [DeliveryStatus.DELIVERED]: '已送达',
      [DeliveryStatus.FAILED]: '配送失败',
      [DeliveryStatus.RETURNED]: '已退回'
    };
    return labels[status] || status;
  }

  private static getAuditActionLabel(action: AuditAction): string {
    const labels: Record<AuditAction, string> = {
      [AuditAction.CREATE]: '创建',
      [AuditAction.READ]: '读取',
      [AuditAction.UPDATE]: '更新',
      [AuditAction.DELETE]: '删除',
      [AuditAction.BATCH_CREATE]: '批量创建',
      [AuditAction.BATCH_UPDATE]: '批量更新',
      [AuditAction.RULE_CHECK_PASS]: '规则检查通过',
      [AuditAction.RULE_CHECK_BLOCK]: '规则检查拦截',
      [AuditAction.MEAL_ASSIGN]: '配餐',
      [AuditAction.MEAL_CHANGE]: '改餐',
      [AuditAction.DELIVERY_UPDATE]: '配送更新',
      [AuditAction.FOLLOW_UP]: '回访',
      [AuditAction.EXPORT]: '导出'
    };
    return labels[action] || action;
  }

  private static getAuditEntityLabel(entity: AuditEntity): string {
    const labels: Record<AuditEntity, string> = {
      [AuditEntity.ELDER]: '老人',
      [AuditEntity.MEAL]: '餐食',
      [AuditEntity.MEAL_ASSIGNMENT]: '配餐',
      [AuditEntity.MEAL_CHANGE]: '改餐',
      [AuditEntity.DELIVERY]: '配送',
      [AuditEntity.FOLLOW_UP]: '回访',
      [AuditEntity.BATCH_OPERATION]: '批量操作',
      [AuditEntity.REPORT]: '报告'
    };
    return labels[entity] || entity;
  }
}