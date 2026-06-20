content = r"""import { workflowDao } from '../dao/workflowDao';
import { redLineDao } from '../dao/redLineDao';
import { inspectorDao } from '../dao/inspectorDao';
import { shelterDao } from '../dao/shelterDao';
import { changeHistoryDao } from '../dao/changeHistoryDao';
import { capacityCheckDao } from '../dao/capacityCheckDao';
import { capacityCheckService } from './capacityCheckService';
import { WorkflowRecord, WorkflowStep, RedLineMap, GridInspectorReport, CapacityCheckResult } from '../types';
import { generateBatchNo, generateReportNo } from '../utils/common';

const STEP_FLOW: Record<WorkflowStep, { previous: WorkflowStep | null; next: WorkflowStep | null }> = {
  redline_import: { previous: null, next: 'inspector_review' },
  inspector_review: { previous: 'redline_import', next: 'point_update' },
  point_update: { previous: 'inspector_review', next: null }
};

const STEP_NAMES: Record<WorkflowStep, string> = {
  redline_import: '红线图导入',
  inspector_review: '网格员巡查表复核',
  point_update: '点位清单更新'
};

const recordChange = (
  entityType: 'redline' | 'inspector_report' | 'capacity_check' | 'shelter' | 'conflict',
  entityId: string,
  shelterId: string,
  shelterName: string,
  changeType: 'create' | 'update' | 'reimport' | 'review' | 'recalc',
  fieldName: string,
  oldValue: string,
  newValue: string,
  operator: string,
  remark: string,
  affectedResultIds: string[] = []
): void => {
  changeHistoryDao.create({
    entityType,
    entityId,
    shelterId,
    shelterName,
    changeType,
    fieldName,
    oldValue,
    newValue,
    operator,
    remark,
    affectedResultIds
  });
};

export const workflowService = {
  startWorkflow: (shelterId: string, operator: string): WorkflowRecord => {
    const existing = workflowDao.findLatestByShelterId(shelterId);
    if (existing && existing.stepStatus !== 'completed') {
      return existing;
    }

    return workflowDao.create({
      shelterId,
      currentStep: 'redline_import',
      stepStatus: 'pending',
      redLineMapId: null,
      inspectorReportId: null,
      previousStep: null,
      nextStep: 'inspector_review',
      operator,
      remark: ''
    });
  },

  step1_importRedLine: (
    workflowId: string,
    shelterId: string,
    version: string,
    remarks: string,
    areaRange: string,
    effectiveDate: string,
    importOperator: string,
    options?: { isReimport?: boolean; reimportNote?: string; importBatchNo?: string }
  ): { workflow: WorkflowRecord; redLine: RedLineMap } => {
    const shelter = shelterDao.findById(shelterId);
    if (!shelter) {
      throw new Error('Shelter not found');
    }

    const existingLatest = redLineDao.findLatestByShelterId(shelterId);
    const isReimport = options?.isReimport || (existingLatest !== null);
    const importBatchNo = options?.importBatchNo || generateBatchNo();

    redLineDao.setOldToNotLatest(shelterId);

    const redLine = redLineDao.create({
      version,
      importBatchNo,
      shelterId,
      remarks,
      areaRange,
      effectiveDate,
      importOperator,
      isLatest: true,
      isReimport,
      reimportNote: options?.reimportNote || null,
      prevVersionId: existingLatest?.id || null
    });

    recordChange(
      'redline',
      redLine.id,
      shelterId,
      shelter.name,
      isReimport ? 'reimport' : 'create',
      '红线图',
      existingLatest ? `v${existingLatest.version}` : '',
      `v${version}`,
      importOperator,
      isReimport ? '重新导入红线图' : '首次导入红线图'
    );

    const workflow = workflowDao.findById(workflowId);
    if (workflow) {
      workflowDao.updateStep(workflowId, {
        currentStep: 'redline_import',
        stepStatus: 'completed',
        previousStep: null,
        nextStep: 'inspector_review',
        redLineMapId: redLine.id,
        operator: importOperator,
        remark: '红线图导入完成'
      });
    }

    const updatedWorkflow = workflowDao.findById(workflowId) || workflow;
    return { workflow: updatedWorkflow!, redLine };
  },

  reviewRedLine: (redLineId: string, reviewStatus: RedLineMap['reviewStatus'], reviewNote: string, reviewedBy: string): void => {
    const redLine = redLineDao.findById(redLineId);
    if (!redLine) {
      throw new Error('RedLine not found');
    }

    const shelter = shelterDao.findById(redLine.shelterId);
    const oldStatus = redLine.reviewStatus;

    redLineDao.updateReview(redLineId, reviewStatus, reviewNote, reviewedBy);

    if (shelter) {
      recordChange(
        'redline',
        redLineId,
        redLine.shelterId,
        shelter.name,
        'review',
        '审核状态',
        oldStatus,
        reviewStatus,
        reviewedBy,
        reviewNote
      );
    }
  },

  updateRedLineRemarks: (redLineId: string, remarks: string, operator: string): void => {
    const redLine = redLineDao.findById(redLineId);
    if (!redLine) {
      throw new Error('RedLine not found');
    }

    const shelter = shelterDao.findById(redLine.shelterId);
    const oldRemarks = redLine.remarks;

    redLineDao.updateRemarks(redLineId, remarks, operator);

    if (shelter) {
      recordChange(
        'redline',
        redLineId,
        redLine.shelterId,
        shelter.name,
        'update',
        '红线图备注',
        oldRemarks,
        remarks,
        operator,
        '更新红线图备注'
      );
    }
  },

  step2_reviewInspectorReport: (
    workflowId: string,
    shelterId: string,
    inspectorName: string,
    inspectionDate: string,
    actualCapacity: number,
    foundIssues: string,
    isTemporaryDetour: boolean,
    detourDescription: string,
    roadCondition: 'normal' | 'blocked' | 'detour',
    operator: string
  ): { workflow: WorkflowRecord; report: GridInspectorReport } => {
    const shelter = shelterDao.findById(shelterId);
    if (!shelter) {
      throw new Error('Shelter not found');
    }

    const reportNo = generateReportNo();
    const report = inspectorDao.create({
      reportNo,
      shelterId,
      inspectorName,
      inspectionDate,
      actualCapacity,
      foundIssues,
      isTemporaryDetour,
      detourDescription,
      roadCondition
    });

    recordChange(
      'inspector_report',
      report.id,
      shelterId,
      shelter.name,
      'create',
      '巡查表',
      '',
      reportNo,
      operator,
      '提交网格员巡查表'
    );

    const workflow = workflowDao.findById(workflowId);
    if (workflow) {
      if (isTemporaryDetour && shelter.status === 'pending_review') {
        workflowDao.updateStep(workflowId, {
          currentStep: 'inspector_review',
          stepStatus: 'suspended',
          previousStep: 'redline_import',
          nextStep: 'point_update',
          inspectorReportId: report.id,
          operator,
          remark: '存在临时改道，需居民审核确认'
        });
      } else {
        workflowDao.updateStep(workflowId, {
          currentStep: 'inspector_review',
          stepStatus: 'completed',
          previousStep: 'redline_import',
          nextStep: 'point_update',
          inspectorReportId: report.id,
          operator,
          remark: '巡查表复核完成'
        });
      }
    }

    const updatedWorkflow = workflowDao.findById(workflowId) || workflow;
    return { workflow: updatedWorkflow!, report };
  },

  resumeAfterResidentReview: (workflowId: string, shelterId: string, operator: string): WorkflowRecord => {
    const workflow = workflowDao.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    workflowDao.updateStep(workflowId, {
      currentStep: 'inspector_review',
      stepStatus: 'completed',
      previousStep: 'redline_import',
      nextStep: 'point_update',
      operator,
      remark: '居民审核通过，继续流程'
    });

    const shelter = shelterDao.findById(shelterId);
    if (shelter) {
      recordChange(
        'shelter',
        shelterId,
        shelterId,
        shelter.name,
        'update',
        '流程状态',
        'suspended',
        'completed',
        operator,
        '居民审核通过，恢复流程'
      );
    }

    const updated = workflowDao.findById(workflowId);
    return updated!;
  },

  step3_updatePointList: (workflowId: string, shelterId: string, operator: string): { workflow: WorkflowRecord; checkResult: CapacityCheckResult | null } => {
    const checkResult = capacityCheckService.recalculateAfterSupplement(shelterId, operator);

    const workflow = workflowDao.findById(workflowId);
    if (workflow) {
      workflowDao.updateStep(workflowId, {
        currentStep: 'point_update',
        stepStatus: 'completed',
        previousStep: 'inspector_review',
        nextStep: null,
        operator,
        remark: '点位清单更新完成，容量已重新核算'
      });
    }

    const shelter = shelterDao.findById(shelterId);
    if (shelter && checkResult) {
      recordChange(
        'capacity_check',
        checkResult.id,
        shelterId,
        shelter.name,
        'recalc',
        '核算容量',
        shelter.designedCapacity.toString(),
        checkResult.checkedCapacity.toString(),
        operator,
        '补充资料后重新核算容量',
        [checkResult.id]
      );
    }

    const updatedWorkflow = workflowDao.findById(workflowId) || workflow;
    return { workflow: updatedWorkflow!, checkResult };
  },

  getWorkflowForShelter: (shelterId: string): WorkflowRecord | null => {
    return workflowDao.findLatestByShelterId(shelterId);
  },

  getAllWorkflowsForShelter: (shelterId: string): WorkflowRecord[] => {
    return workflowDao.findByShelterId(shelterId);
  },

  getAllWorkflows: (): WorkflowRecord[] => {
    return workflowDao.findAll();
  },

  getWorkflowsByStep: (step: WorkflowStep): WorkflowRecord[] => {
    return workflowDao.findByStep(step);
  },

  getStepName: (step: WorkflowStep): string => {
    return STEP_NAMES[step];
  },

  getStepNames: (): Record<WorkflowStep, string> => {
    return { ...STEP_NAMES };
  }
};
"""

with open('/Users/lzy/pro/solo/workspaces/zy72477/src/services/workflowService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
