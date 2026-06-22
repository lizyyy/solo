import type { AuditLog, AuditActionType } from '../types';
import { generateId } from '../utils/hash';

const DEFAULT_OPERATOR = '现场老师';

export const auditLogger = {
  createLog(
    sessionId: string,
    actionType: AuditActionType,
    operator: string = DEFAULT_OPERATOR,
    options: {
      computationStepId?: string;
      beforeValue?: unknown;
      afterValue?: unknown;
      reason?: string;
    } = {}
  ): AuditLog {
    return {
      id: generateId(),
      sessionId,
      computationStepId: options.computationStepId,
      actionType,
      operator,
      timestamp: Date.now(),
      beforeValue: options.beforeValue,
      afterValue: options.afterValue,
      reason: options.reason,
    };
  },

  logCompute(
    sessionId: string,
    stepId: string,
    formula: string,
    result: number,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'compute', operator, {
      computationStepId: stepId,
      afterValue: { formula, result },
    });
  },

  logManualEdit(
    sessionId: string,
    stepId: string,
    beforeValue: unknown,
    afterValue: unknown,
    reason: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'manual_edit', operator, {
      computationStepId: stepId,
      beforeValue,
      afterValue,
      reason,
    });
  },

  logSuspend(
    sessionId: string,
    reason: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'suspend', operator, {
      reason,
    });
  },

  logConfirm(
    sessionId: string,
    taskId: string,
    resolutionNote?: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'confirm', operator, {
      afterValue: { taskId, confirmed: true },
      reason: resolutionNote,
    });
  },

  logReject(
    sessionId: string,
    taskId: string,
    resolutionNote: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'reject', operator, {
      afterValue: { taskId, rejected: true },
      reason: resolutionNote,
    });
  },

  logGenerateReport(
    sessionId: string,
    reportId: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'generate_report', operator, {
      afterValue: { reportId },
    });
  },

  logUploadMaterial(
    sessionId: string,
    materialType: string,
    materialName: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'upload_material', operator, {
      afterValue: { materialType, materialName },
    });
  },

  logUpdateMaterial(
    sessionId: string,
    materialId: string,
    materialType: string,
    materialName: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'material_update', operator, {
      afterValue: { materialId, materialType, materialName },
    });
  },

  logResumeSession(
    sessionId: string,
    operator?: string
  ): AuditLog {
    return this.createLog(sessionId, 'resume_session', operator);
  },

  formatLogForDisplay(log: AuditLog): {
    title: string;
    description: string;
    icon: string;
    color: string;
  } {
    const time = new Date(log.timestamp).toLocaleString('zh-CN');

    switch (log.actionType) {
      case 'compute':
        return {
          title: '自动计算',
          description: `${time} - ${log.operator} 执行了公式计算`,
          icon: 'calculator',
          color: '#3182ce',
        };
      case 'manual_edit':
        return {
          title: '人工修改',
          description: `${time} - ${log.operator} 修改了计算结果${log.reason ? `（原因：${log.reason}）` : ''}`,
          icon: 'edit-3',
          color: '#c53030',
        };
      case 'suspend':
        return {
          title: '任务挂起',
          description: `${time} - ${log.operator} 挂起了任务${log.reason ? `（原因：${log.reason}）` : ''}`,
          icon: 'pause-circle',
          color: '#dd6b20',
        };
      case 'confirm':
        return {
          title: '确认挂起',
          description: `${time} - ${log.operator} 确认了挂起任务`,
          icon: 'check-circle',
          color: '#38a169',
        };
      case 'reject':
        return {
          title: '驳回挂起',
          description: `${time} - ${log.operator} 驳回了挂起任务${log.reason ? `（原因：${log.reason}）` : ''}`,
          icon: 'x-circle',
          color: '#c53030',
        };
      case 'generate_report':
        return {
          title: '生成报告',
          description: `${time} - ${log.operator} 生成了复核报告`,
          icon: 'file-text',
          color: '#805ad5',
        };
      case 'upload_material':
        return {
          title: '上传材料',
          description: `${time} - ${log.operator} 上传了材料`,
          icon: 'upload',
          color: '#3182ce',
        };
      case 'material_update':
        return {
          title: '更新材料',
          description: `${time} - ${log.operator} 更新了材料${log.diff ? '（检测到口径变更）' : ''}`,
          icon: 'edit-3',
          color: '#dd6b20',
        };
      case 'material_delete':
        return {
          title: '删除材料',
          description: `${time} - ${log.operator} 删除了材料`,
          icon: 'trash-2',
          color: '#c53030',
        };
      case 'resume_session':
        return {
          title: '恢复会话',
          description: `${time} - ${log.operator} 恢复了之前的处理进度`,
          icon: 'rotate-ccw',
          color: '#38a169',
        };
      default:
        return {
          title: '操作记录',
          description: `${time} - ${log.operator} 执行了操作`,
          icon: 'activity',
          color: '#718096',
        };
    }
  },

  getDiffSummary(before: unknown, after: unknown): string {
    if (before === undefined || before === null) {
      return `设置为: ${JSON.stringify(after)}`;
    }
    if (after === undefined || after === null) {
      return `删除了: ${JSON.stringify(before)}`;
    }

    const beforeStr = typeof before === 'object' ? JSON.stringify(before) : String(before);
    const afterStr = typeof after === 'object' ? JSON.stringify(after) : String(after);

    if (beforeStr === afterStr) {
      return '无变化';
    }

    return `${beforeStr} → ${afterStr}`;
  },

  filterLogsByType(logs: AuditLog[], type: AuditActionType): AuditLog[] {
    return logs.filter((log) => log.actionType === type);
  },

  filterLogsByTimeRange(
    logs: AuditLog[],
    startTime: number,
    endTime: number
  ): AuditLog[] {
    return logs.filter((log) => log.timestamp >= startTime && log.timestamp <= endTime);
  },

  hasManualEdits(logs: AuditLog[]): boolean {
    return logs.some((log) => log.actionType === 'manual_edit');
  },

  getManualEditCount(logs: AuditLog[]): number {
    return this.filterLogsByType(logs, 'manual_edit').length;
  },
};
