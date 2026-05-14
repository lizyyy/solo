import { v4 as uuidv4 } from 'uuid';
import {
  WorkOrder,
  AuditResult,
  ExceptionRecord,
  AuditSummary,
  ExecutionInfo,
  NextStep,
  CandidateItem,
  IndexSuggestion,
  AuditLog
} from '../types';
import { mockWorkOrders, mockIndexSuggestions, mockAuditLogs } from '../data/mockData';

export class AuditService {
  private workOrders: WorkOrder[];
  private indexSuggestions: IndexSuggestion[];
  private auditLogs: AuditLog[];
  private exceptionRecords: ExceptionRecord[] = [];

  constructor() {
    this.workOrders = [...mockWorkOrders];
    this.indexSuggestions = [...mockIndexSuggestions];
    this.auditLogs = [...mockAuditLogs];
  }

  public performAudit(executor: string): AuditResult {
    const startTime = new Date();
    this.exceptionRecords = [];

    const normalRecords: WorkOrder[] = [];

    for (const workOrder of this.workOrders) {
      const exceptions = this.detectExceptions(workOrder);

      if (exceptions.length === 0) {
        normalRecords.push(workOrder);
      } else {
        this.exceptionRecords.push(...exceptions);
      }
    }

    const summary = this.buildSummary();
    const endTime = new Date();
    const execution: ExecutionInfo = {
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      executor
    };
    const nextSteps = this.generateNextSteps();

    return {
      summary,
      normalRecords,
      exceptionRecords: this.exceptionRecords,
      indexSuggestions: this.indexSuggestions,
      execution,
      nextSteps
    };
  }

  private detectExceptions(workOrder: WorkOrder): ExceptionRecord[] {
    const exceptions: ExceptionRecord[] = [];
    const now = new Date();

    for (const attachment of workOrder.attachments) {
      if (attachment.expireAt && attachment.expireAt < now && attachment.status === 'valid') {
        exceptions.push({
          id: uuidv4(),
          workOrderId: workOrder.id,
          type: 'attachment_expired',
          severity: 'major',
          message: `附件 ${attachment.fileName} 已过期`,
          details: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            expireAt: attachment.expireAt,
            uploadedAt: attachment.uploadedAt
          },
          discoveredAt: now
        });
      } else if (attachment.status === 'expired') {
        exceptions.push({
          id: uuidv4(),
          workOrderId: workOrder.id,
          type: 'attachment_expired',
          severity: attachment.expireAt && (now.getTime() - attachment.expireAt.getTime()) > 30 * 24 * 60 * 60 * 1000 ? 'critical' : 'major',
          message: `附件 ${attachment.fileName} 状态已标记为过期`,
          details: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            expireAt: attachment.expireAt,
            uploadedAt: attachment.uploadedAt,
            daysExpired: attachment.expireAt ? Math.floor((now.getTime() - attachment.expireAt.getTime()) / (24 * 60 * 60 * 1000)) : 0
          },
          discoveredAt: now
        });
      }
    }

    return exceptions;
  }

  private buildSummary(): AuditSummary {
    const totalRecords = this.workOrders.length;
    const exceptionCount = this.exceptionRecords.length;
    const normalCount = totalRecords - this.workOrders.filter(wo =>
      this.exceptionRecords.some(ex => ex.workOrderId === wo.id)
    ).length;

    const criticalCount = this.exceptionRecords.filter(ex => ex.severity === 'critical').length;
    const majorCount = this.exceptionRecords.filter(ex => ex.severity === 'major').length;
    const minorCount = this.exceptionRecords.filter(ex => ex.severity === 'minor').length;

    return {
      totalRecords,
      normalCount,
      exceptionCount,
      criticalCount,
      majorCount,
      minorCount
    };
  }

  private generateNextSteps(): NextStep[] {
    const steps: NextStep[] = [];

    if (this.exceptionRecords.some(ex => ex.type === 'attachment_expired')) {
      const expiredCount = this.exceptionRecords.filter(ex => ex.type === 'attachment_expired').length;
      steps.push({
        id: uuidv4(),
        priority: 'high',
        action: '清理过期附件',
        description: `发现 ${expiredCount} 个过期附件，需要进行清理或重新上传`,
        estimatedTime: '1-2小时',
        responsible: '运维团队'
      });
    }

    if (this.indexSuggestions.length > 0) {
      steps.push({
        id: uuidv4(),
        priority: 'high',
        action: '优化数据库索引',
        description: `共 ${this.indexSuggestions.length} 条索引优化建议，建议优先执行高置信度建议`,
        estimatedTime: '4-8小时',
        responsible: 'DBA团队'
      });
    }

    steps.push({
      id: uuidv4(),
      priority: 'medium',
      action: '建立附件过期告警机制',
      description: '设置附件过期前7天自动告警，避免附件过期影响业务',
      estimatedTime: '2-3小时',
      responsible: '开发团队'
    });

    steps.push({
      id: uuidv4(),
      priority: 'low',
      action: '审计历史数据',
      description: '对历史工单进行批量审计，排查潜在的数据一致性问题',
      estimatedTime: '1-2天',
      responsible: '数据团队'
    });

    return steps;
  }

  public generateCandidateList(type: 'cleanup' | 'rollback'): CandidateItem[] {
    const candidates: CandidateItem[] = [];
    const now = new Date();

    if (type === 'cleanup') {
      for (const workOrder of this.workOrders) {
        for (const attachment of workOrder.attachments) {
          if (attachment.status === 'expired' || (attachment.expireAt && attachment.expireAt < now)) {
            candidates.push({
              id: uuidv4(),
              type: 'cleanup',
              targetId: attachment.id,
              targetType: 'attachment',
              description: `清理过期附件: ${attachment.fileName} (工单: ${workOrder.orderNo})`,
              impact: '释放存储空间，减少数据库查询压力',
              riskLevel: 'low',
              approved: false
            });
          }
        }
      }
    } else {
      for (const log of this.auditLogs) {
        if (log.action === 'update') {
          candidates.push({
            id: uuidv4(),
            type: 'rollback',
            targetId: log.workOrderId,
            targetType: 'work_order',
            description: `回滚工单变更: ${log.workOrderId} (操作: ${log.action}, 原因: ${log.reason})`,
            impact: '恢复工单到变更前状态',
            riskLevel: 'medium',
            approved: false
          });
        }
      }
    }

    return candidates;
  }

  public getAuditLogsBySourceSystem(sourceSystem: string): AuditLog[] {
    return this.auditLogs.filter(log => log.sourceSystem === sourceSystem);
  }

  public getWorkOrders(): WorkOrder[] {
    return this.workOrders;
  }

  public getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }
}
