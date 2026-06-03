import { envelopeRepository } from '../repositories/envelopeRepository';
import { detectCoordinateType, normalizeCoordinate } from '../../shared/rules/coordinateRules';
import { validateSafetyRadius, lookupSafetyRadius } from '../../shared/rules/safetyRadiusRules';
import { getRollbackTarget, serializePointState } from '../../shared/rules/rollbackRules';
import { parseCsv } from '../../shared/utils/formatters';
import type {
  EnvelopeRecord,
  CoordinatePoint,
  AuditLog,
  BoundaryRule,
  SafetyRadiusTable,
  ProcessingStatus,
  ImportLogRequest,
  ReviewPointRequest,
  WorkflowStep,
  WorkflowStepInfo,
} from '../../shared/types';

function getNextStepStatus(step: WorkflowStep): ProcessingStatus {
  const statusMap: Record<WorkflowStep, ProcessingStatus> = {
    1: 'ENGINEER_REVIEW',
    2: 'INSPECTION_REVIEW',
    3: 'PUBLISHED',
  };
  return statusMap[step];
}

export const envelopeService = {
  getWorkflowSteps(currentStep: WorkflowStep): WorkflowStepInfo[] {
    return [
      {
        step: 1,
        name: '导入点云抽稀日志',
        description: '设备工程师许工导入原始日志',
        status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'current' : 'pending',
      },
      {
        step: 2,
        name: '许工补看安全半径表',
        description: '对照安全半径表复核正常记录',
        status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'current' : 'pending',
      },
      {
        step: 3,
        name: '更新现场说明',
        description: '巡检组复核后发布给现场班组',
        status: currentStep >= 3 ? 'completed' : 'pending',
      },
    ];
  },

  async getAllEnvelopes(status?: ProcessingStatus, robotArmId?: string): Promise<EnvelopeRecord[]> {
    return envelopeRepository.findAllEnvelopes(status, robotArmId);
  },

  async getEnvelopeById(id: string): Promise<EnvelopeRecord | undefined> {
    return envelopeRepository.findEnvelopeById(id);
  },

  async getEnvelopePoints(envelopeId: string): Promise<CoordinatePoint[]> {
    return envelopeRepository.findPointsByEnvelopeId(envelopeId);
  },

  async getEnvelopeAuditLogs(envelopeId: string): Promise<AuditLog[]> {
    return envelopeRepository.findAuditLogsByEnvelopeId(envelopeId);
  },

  async importPointCloudLog(request: ImportLogRequest): Promise<{
    envelope: EnvelopeRecord;
    points: CoordinatePoint[];
    mixedCount: number;
  }> {
    const csvData = parseCsv(request.fileContent);
    const dataRows = csvData.slice(1);
    
    const envelope = envelopeRepository.createEnvelope({
      robotArmId: request.robotArmId,
      calculationDate: new Date().toISOString().split('T')[0],
      safetyRadiusVersion: request.safetyRadiusVersion,
      status: 'IMPORTED',
      totalPoints: dataRows.length,
      mixedPoints: 0,
      currentStep: 1,
      createdBy: request.createdBy,
    });
    
    const safetyRadiusTable = envelopeRepository.findSafetyRadiusTable(
      request.safetyRadiusVersion,
      request.robotArmId
    );
    
    const points: CoordinatePoint[] = [];
    let mixedCount = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rawValue = row.join(', ');
      const originalLineNumber = i + 2;
      
      const detection = detectCoordinateType(rawValue);
      const distance = Math.sqrt(detection.xValue ** 2 + detection.yValue ** 2);
      const tableRadius = lookupSafetyRadius(safetyRadiusTable, distance, request.safetyRadiusVersion, request.robotArmId);
      
      const logRadius = row.length > 2 ? parseFloat(row[2]) : null;
      const radiusValidation = validateSafetyRadius(logRadius, tableRadius);
      
      const status: ProcessingStatus = detection.isMixed ? 'INSPECTION_REVIEW' : 'IMPORTED';
      
      if (detection.isMixed) {
        mixedCount++;
      }
      
      const point = envelopeRepository.createPoint({
        envelopeId: envelope.id,
        originalLineNumber,
        rawValue,
        xValue: detection.xValue,
        yValue: detection.yValue,
        coordinateType: detection.coordinateType,
        isMixed: detection.isMixed,
        status,
        safetyRadius: radiusValidation.recommendedValue,
        radiusSource: radiusValidation.radiusSource,
      });
      
      points.push(point);
      
      envelopeRepository.createAuditLog({
        envelopeId: envelope.id,
        pointId: point.id,
        actionType: 'IMPORT',
        originalValue: null,
        newValue: serializePointState(point),
        operator: request.createdBy,
        remark: detection.isMixed ? '检测到坐标混合，留待巡检组复核' : '导入成功',
        originalLineNumber,
      });
    }
    
    const updatedEnvelope = envelopeRepository.updateEnvelopeStep(envelope.id, 1, 'IMPORTED')!;
    envelopeRepository.updateEnvelopeStatus(envelope.id, mixedCount > 0 ? 'INSPECTION_REVIEW' : 'ENGINEER_REVIEW');
    
    envelopeRepository.createAuditLog({
      envelopeId: envelope.id,
      pointId: null,
      actionType: 'IMPORT',
      originalValue: null,
      newValue: `导入${dataRows.length}条记录，其中${mixedCount}条为坐标混合`,
      operator: request.createdBy,
      remark: `点云抽稀日志导入完成，共${dataRows.length}条，混合${mixedCount}条`,
      originalLineNumber: null,
    });
    
    return {
      envelope: updatedEnvelope,
      points,
      mixedCount,
    };
  },

  async advanceWorkflow(envelopeId: string, operator: string): Promise<EnvelopeRecord | undefined> {
    const envelope = envelopeRepository.findEnvelopeById(envelopeId);
    if (!envelope) return undefined;
    
    const points = envelopeRepository.findPointsByEnvelopeId(envelopeId);
    const mixedPoints = points.filter(p => p.isMixed);
    const unreviewedMixed = mixedPoints.filter(p => p.status === 'INSPECTION_REVIEW');
    
    const currentStep = envelope.currentStep;
    
    if (currentStep === 1) {
      const unconfirmedNormal = points.filter(p => !p.isMixed && p.status === 'IMPORTED');
      if (unconfirmedNormal.length > 0) {
        throw new Error(`还有${unconfirmedNormal.length}条正常记录待许工确认`);
      }
      
      envelopeRepository.createAuditLog({
        envelopeId,
        pointId: null,
        actionType: 'STATUS_CHANGE',
        originalValue: envelope.status,
        newValue: 'ENGINEER_REVIEW',
        operator,
        remark: '许工完成正常记录复核，进入巡检组复核阶段',
        originalLineNumber: null,
      });
      
      return envelopeRepository.updateEnvelopeStep(envelopeId, 2, 'INSPECTION_REVIEW');
    }
    
    if (currentStep === 2) {
      if (unreviewedMixed.length > 0) {
        throw new Error(`还有${unreviewedMixed.length}条坐标混合记录待巡检组复核`);
      }
      
      envelopeRepository.createAuditLog({
        envelopeId,
        pointId: null,
        actionType: 'STATUS_CHANGE',
        originalValue: envelope.status,
        newValue: 'PUBLISHED',
        operator,
        remark: '巡检组完成全部复核，安全包络已发布给现场班组',
        originalLineNumber: null,
      });
      
      return envelopeRepository.updateEnvelopeStep(envelopeId, 3, 'PUBLISHED');
    }
    
    if (currentStep >= 3) {
      throw new Error('已完成全部流程，无法继续推进');
    }
    
    return envelope;
  },

  async reviewPoint(request: ReviewPointRequest): Promise<CoordinatePoint | undefined> {
    const point = envelopeRepository.findPointById(request.pointId);
    if (!point) return undefined;
    
    const auditLogs = envelopeRepository.findAuditLogsByEnvelopeId(point.envelopeId);
    const originalState = serializePointState(point);
    
    let updates: any = {};
    
    switch (request.action) {
      case 'CONFIRM_LAT_LNG': {
        const normalized = normalizeCoordinate(point.rawValue, 'LAT_LNG');
        updates = {
          xValue: normalized.xValue,
          yValue: normalized.yValue,
          coordinateType: 'LAT_LNG',
          isMixed: false,
          status: 'ENGINEER_REVIEW',
        };
        break;
      }
      case 'CONFIRM_METRIC': {
        const normalized = normalizeCoordinate(point.rawValue, 'METRIC');
        updates = {
          xValue: normalized.xValue,
          yValue: normalized.yValue,
          coordinateType: 'METRIC',
          isMixed: false,
          status: 'ENGINEER_REVIEW',
        };
        break;
      }
      case 'CORRECT': {
        updates = {
          xValue: request.xValue ?? point.xValue,
          yValue: request.yValue ?? point.yValue,
          safetyRadius: request.safetyRadius ?? point.safetyRadius,
          isMixed: false,
          status: 'ENGINEER_REVIEW',
          radiusSource: 'MANUAL',
        };
        break;
      }
      case 'ROLLBACK': {
        const target = getRollbackTarget(auditLogs, request.pointId);
        if (!target) {
          throw new Error('找不到可回滚的历史状态');
        }
        updates = {
          xValue: target.xValue,
          yValue: target.yValue,
          safetyRadius: target.safetyRadius,
          status: target.status,
        };
        break;
      }
    }
    
    const updatedPoint = envelopeRepository.updatePoint(request.pointId, updates);
    
    if (updatedPoint) {
      envelopeRepository.createAuditLog({
        envelopeId: point.envelopeId,
        pointId: point.id,
        actionType: request.action === 'ROLLBACK' ? 'ROLLBACK' : request.action === 'CORRECT' ? 'CORRECT' : 'REVIEW',
        originalValue: originalState,
        newValue: serializePointState(updatedPoint),
        operator: request.operator,
        remark: request.remark,
        originalLineNumber: point.originalLineNumber,
      });
      
      const envelope = envelopeRepository.findEnvelopeById(point.envelopeId);
      if (envelope) {
        const mixedCount = envelopeRepository.countMixedPoints(point.envelopeId);
        envelopeRepository.updateEnvelopeStep(envelope.id, envelope.currentStep, mixedCount > 0 ? 'INSPECTION_REVIEW' : envelope.status);
      }
    }
    
    return updatedPoint;
  },

  async confirmNormalPoint(pointId: string, operator: string): Promise<CoordinatePoint | undefined> {
    const point = envelopeRepository.findPointById(pointId);
    if (!point) return undefined;
    
    if (point.isMixed) {
      throw new Error('坐标混合记录需巡检组复核');
    }
    
    const originalState = serializePointState(point);
    const updatedPoint = envelopeRepository.updatePoint(pointId, {
      status: 'ENGINEER_REVIEW',
    });
    
    if (updatedPoint) {
      envelopeRepository.createAuditLog({
        envelopeId: point.envelopeId,
        pointId: point.id,
        actionType: 'REVIEW',
        originalValue: originalState,
        newValue: serializePointState(updatedPoint),
        operator,
        remark: '许工确认坐标正常，安全半径参考安全半径表',
        originalLineNumber: point.originalLineNumber,
      });
    }
    
    return updatedPoint;
  },

  async exportEnvelope(envelopeId: string): Promise<string> {
    const envelope = envelopeRepository.findEnvelopeById(envelopeId);
    if (!envelope) throw new Error('记录不存在');
    
    const points = envelopeRepository.findPointsByEnvelopeId(envelopeId);
    
    const headers = [
      '原始行号',
      '原始值',
      'X坐标',
      'Y坐标',
      '坐标类型',
      '是否混合',
      '安全半径',
      '半径来源',
      '处理状态',
      '创建时间',
      '更新时间',
    ];
    
    const rows = points.map(p => [
      p.originalLineNumber,
      `"${p.rawValue}"`,
      p.xValue,
      p.yValue,
      p.coordinateType === 'LAT_LNG' ? '经纬度' : p.coordinateType === 'METRIC' ? '米制' : '混合',
      p.isMixed ? '是' : '否',
      p.safetyRadius ?? '',
      p.radiusSource === 'LOG' ? '点云日志' : p.radiusSource === 'TABLE' ? '安全半径表' : p.radiusSource === 'MANUAL' ? '人工指定' : '',
      this.getStatusLabel(p.status),
      p.createdAt,
      p.updatedAt,
    ]);
    
    const csvContent = [
      `# 工厂机械臂安全包络明细`,
      `# 机械臂编号: ${envelope.robotArmId}`,
      `# 计算日期: ${envelope.calculationDate}`,
      `# 安全半径版本: ${envelope.safetyRadiusVersion}`,
      `# 导出时间: ${new Date().toISOString()}`,
      `# 总记录数: ${points.length}`,
      `# 坐标混合数: ${points.filter(p => p.isMixed).length}`,
      `# 处理状态: ${this.getStatusLabel(envelope.status)}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');
    
    return csvContent;
  },

  getStatusLabel(status: ProcessingStatus): string {
    const labels: Record<ProcessingStatus, string> = {
      IMPORTED: '已导入',
      ENGINEER_REVIEW: '工程师复核中',
      INSPECTION_REVIEW: '巡检组复核中',
      PUBLISHED: '已发布',
      REJECTED: '已驳回',
      ROLLBACK: '已回滚',
    };
    return labels[status];
  },

  async getAllBoundaryRules(): Promise<BoundaryRule[]> {
    return envelopeRepository.findAllBoundaryRules();
  },

  async updateBoundaryRule(id: string, updates: Partial<BoundaryRule>): Promise<BoundaryRule | undefined> {
    return envelopeRepository.updateBoundaryRule(id, updates);
  },

  async getSafetyRadiusTable(version?: string, armModel?: string): Promise<SafetyRadiusTable[]> {
    return envelopeRepository.findSafetyRadiusTable(version, armModel);
  },
};
