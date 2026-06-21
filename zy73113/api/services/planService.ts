import { planRepository, historyRepository, materialRepository } from '../db/repositories';
import type { 
  Plan, PlanDetail, Judgment, PlanStatus, OperationType 
} from '../../shared/types';

function createHistoryVersion(
  planId: string,
  operationType: OperationType,
  oldValue: string | null,
  newValue: string | null,
  changeReason: string,
  operator: string
) {
  const version = historyRepository.getNextVersion(planId, operationType);
  
  return historyRepository.create({
    planId,
    version,
    operationType,
    oldValue,
    newValue,
    changeReason,
    operator,
  });
}

export const planService = {
  getPlanList(params: { status?: PlanStatus; keyword?: string } = {}): Plan[] {
    return planRepository.findAll(params);
  },

  getPlanDetail(id: string): PlanDetail | null {
    const plan = planRepository.findById(id);
    if (!plan) return null;

    const history = historyRepository.findByPlanId(id);
    const materials = materialRepository.findByPlanId(id);

    return {
      ...plan,
      history,
      materials,
    };
  },

  createPlan(data: {
    planNo: string;
    projectName: string;
    originalOpinion: string;
    originalSource: string;
    currentRemark: string;
    judgment: Judgment;
    status: PlanStatus;
    materialBatch: string | null;
    createdBy: string;
  }): Plan {
    const existing = planRepository.findByPlanNo(data.planNo);
    if (existing) {
      throw new Error(`方案编号 ${data.planNo} 已存在`);
    }

    const plan = planRepository.create({
      ...data,
      currentRemark: data.currentRemark || '',
    });

    createHistoryVersion(
      plan.id,
      'create',
      null,
      JSON.stringify({
        planNo: plan.planNo,
        projectName: plan.projectName,
        originalOpinion: plan.originalOpinion,
      }),
      '原始数据录入，保留原始来源',
      data.createdBy
    );

    return plan;
  },

  updateRemark(
    id: string,
    remark: string,
    changeReason: string,
    operator: string
  ): Plan {
    const plan = planRepository.findById(id);
    if (!plan) {
      throw new Error('方案不存在');
    }

    const oldRemark = plan.currentRemark;
    
    planRepository.updateRemark(id, remark);
    
    createHistoryVersion(
      id,
      'remark_update',
      oldRemark,
      remark,
      changeReason,
      operator
    );

    return planRepository.findById(id)!;
  },

  updateJudgment(
    id: string,
    newJudgment: Judgment,
    changeReason: string,
    operator: string
  ): Plan {
    const plan = planRepository.findById(id);
    if (!plan) {
      throw new Error('方案不存在');
    }

    const oldJudgment = plan.judgment;
    
    planRepository.updateJudgment(id, newJudgment);
    
    createHistoryVersion(
      id,
      'judgment_change',
      oldJudgment,
      newJudgment,
      changeReason,
      operator
    );

    return planRepository.findById(id)!;
  },

  updateStatus(
    id: string,
    status: PlanStatus,
    operator: string
  ): Plan {
    const plan = planRepository.findById(id);
    if (!plan) {
      throw new Error('方案不存在');
    }

    const oldStatus = plan.status;
    
    planRepository.updateStatus(id, status);
    
    const reason = status === 'abnormal' 
      ? '材料批次缺失，标记为异常'
      : '材料已补录，恢复正常';
    
    createHistoryVersion(
      id,
      'status_change',
      oldStatus,
      status,
      reason,
      operator
    );

    return planRepository.findById(id)!;
  },

  addMaterial(
    id: string,
    batchNo: string,
    materialName: string,
    quantity: number,
    supplementReason: string,
    operator: string
  ): Plan {
    const plan = planRepository.findById(id);
    if (!plan) {
      throw new Error('方案不存在');
    }

    materialRepository.create({
      planId: id,
      batchNo,
      materialName,
      quantity,
      isSupplement: true,
      supplementReason,
    });

    const currentBatch = plan.materialBatch 
      ? `${plan.materialBatch}, ${batchNo}`
      : batchNo;
    
    planRepository.updateMaterialBatch(id, currentBatch);

    if (plan.status === 'abnormal') {
      planRepository.updateStatus(id, 'normal');
      createHistoryVersion(
        id,
        'status_change',
        'abnormal',
        'normal',
        `补录材料后自动恢复正常：${supplementReason}`,
        '系统自动'
      );
    }

    createHistoryVersion(
      id,
      'material_add',
      plan.materialBatch,
      batchNo,
      supplementReason,
      operator
    );

    return planRepository.findById(id)!;
  },

  exportPlan(id: string,
    format: 'json' | 'csv'
  ): { content: string; filename: string; mimeType: string } {
    const detail = this.getPlanDetail(id);
    if (!detail) {
      throw new Error('方案不存在');
    }

    if (format === 'json') {
      const exportData = {
        plan: {
          planNo: detail.planNo,
          projectName: detail.projectName,
          originalOpinion: detail.originalOpinion,
          originalSource: detail.originalSource,
          currentRemark: detail.currentRemark,
          judgment: detail.judgment,
          status: detail.status,
          materialBatch: detail.materialBatch,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        },
        history: detail.history.map(h => ({
          version: h.version,
          operation: h.operationType,
          oldValue: h.oldValue,
          newValue: h.newValue,
          changeReason: h.changeReason,
          operator: h.operator,
          timestamp: h.timestamp,
        })),
        materials: detail.materials,
        exportedAt: new Date().toISOString(),
      };

      return {
        content: JSON.stringify(exportData, null, 2),
        filename: `${detail.planNo}-${Date.now()}.json`,
        mimeType: 'application/json',
      };
    } else {
      const headers = [
        '方案编号',
        '项目名称',
        '原始意见',
        '原始来源',
        '当前备注',
        '判断结论',
        '状态',
        '材料批次',
        '创建时间',
        '更新时间',
      ].join(',');

      const row = [
        detail.planNo,
        `"${detail.projectName}"`,
        `"${detail.originalOpinion}"`,
        `"${detail.originalSource}"`,
        `"${detail.currentRemark}"`,
        detail.judgment,
        detail.status,
        detail.materialBatch || '',
        detail.createdAt,
        detail.updatedAt,
      ].join(',');

      return {
        content: `${headers}\n${row}`,
        filename: `${detail.planNo}-${Date.now()}.csv`,
        mimeType: 'text/csv; charset=utf-8',
      };
    }
  },
};
