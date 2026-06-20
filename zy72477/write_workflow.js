const fs = require('fs');

const content = `import { workflowDao } from '../dao/workflowDao';
import { redLineDao } from '../dao/redLineDao';
import { inspectorDao } from '../dao/inspectorDao';
import { shelterDao } from '../dao/shelterDao';
import { changeHistoryDao } from '../dao/changeHistoryDao';
import { capacityCheckDao } from '../dao/capacityCheckDao';
import { capacityCheckService } from './capacityCheckService';
import { WorkflowRecord, WorkflowStep, RedLineMap, GridInspectorReport, CapacityCheckResult } from '../types';
import { generateBatchNo, generateReportNo, getCurrentTime } from '../utils/common';

const STEP_FLOW: Record<WorkflowStep, WorkflowStep | null> = {
  redline_import: 'inspector_review',
  inspector_review: 'point_update',
  point_update: null
};

const STEP_NAMES: Record<WorkflowStep, string> = {
  redline_import: '红线图备注第一次导入',
  inspector_review: '交通协管老马补看网格员巡查表',
  point_update: '点位清单更新'
};

const recordChange = (params: {
  entityType: 'redline' | 'inspector_report' | 'capacity_check' | 'shelter' | 'conflict';
  entityId: string;
  shelterId: string;
  shelterName: string;
  changeType: 'create' | 'update' | 'reimport' | 'review' | 'recalc';
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  remark: string;
  affectedResultIds?: string[];
}): void => {
  changeHistoryDao.create({
    entityType: params.entityType,
    entityId: params.entityId,
    shelterId: params.shelterId,
    shelterName: params.shelterName,
    changeType: params.changeType,
    fieldName: params.fieldName,
    oldValue: params.oldValue,
    newValue: params.newValue,
    operator: params.operator,
    remark: params.remark,
    affectedResultIds: params.affectedResultIds || []
  });
};

export const workflowService = {
  startWorkflow: (shelterId: string, operator: string): WorkflowRecord | null => {
    const shelter = shelterDao.findById(shelterId);
    if (!shelter) return null;
    const existing = workflowDao.findLatestByShelterId(shelterId);
    if (existing && existing.stepStatus !== 'completed') return existing;
    return workflowDao.create({
      shelterId,
      currentStep: 'redline_import',
      stepStatus: 'pending',
      redLineMapId: null,
      inspectorReportId: null,
      previousStep: null,
      nextStep: 'inspector_review',
      operator,
      remark: \`工作流已启动，当前步骤：\${STEP_NAMES.redline_import}\`
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
    options?: { isReimport?: boolean; reimportNote?: string; prevVersionId?: string }
  ): { workflow: WorkflowRecord | null; redLine: RedLineMap | null } => {
    const workflow = workflowDao.findById(workflowId);
    const shelter = shelterDao.findById(shelterId);
    if (!workflow || workflow.currentStep !== 'redline_import' || !shelter) {
      return { workflow: null, redLine: null };
    }
    const batchNo = generateBatchNo();
    const prevRedLine = redLineDao.findLatestByShelterId(shelterId);
    redLineDao.setOldToNotLatest(shelterId);
    const redLine = redLineDao.create({
      version,
      importBatchNo: batchNo,
      shelterId,
      remarks,
      areaRange,
      effectiveDate,
      importOperator,
      isLatest: true,
      isReimport: options?.isReimport || false,
      reimportNote: options?.reimportNote || null,
      reviewStatus: 'pending',
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      prevVersionId: options?.prevVersionId || prevRedLine?.id || null
    });
    recordChange({
      entityType: 'redline',
      entityId: redLine.id,
      shelterId,
      shelterName: shelter.name,
      changeType: options?.isReimport ? 'reimport' : 'create',
      fieldName: '红线图备注',
      oldValue: prevRedLine?.remarks || '(无)',
      newValue: remarks,
      operator: importOperator,
      remark: options?.isReimport
        ? \`重导入，批次号：\${batchNo}，说明：\${options.reimportNote || ''}\`
        : \`首次导入，批次号：\${batchNo}\`
    });
    workflowDao.updateStep(workflowId, {
      stepStatus: 'completed',
      redLineMapId: redLine.id,
      operator: importOperator,
      remark: \`红线图导入完成，批次号：\${batchNo}\${options?.isReimport ? '（重导入）' : ''}\`
    });
    const nextStep = STEP_FLOW.redline_import!;
    workflowDao.create({
      shelterId,
      currentStep: nextStep,
      stepStatus: 'pending',
      redLineMapId: redLine.id,
      inspectorReportId: null,
      previousStep: 'redline_import',
      nextStep: STEP_FLOW[nextStep],
      operator: importOperator,
      remark: \`等待\${STEP_NAMES[nextStep]}\`
    });
    return { workflow: workflowDao.findById(workflowId), redLine };
  },

  reviewRedLine: (
    redLineId: string,
    reviewStatus: RedLineMap['reviewStatus'],
    reviewNote: string,
    reviewedBy: string
  ): RedLineMap | null => {
    const redLine = redLineDao.findById(redLineId);
    if (!redLine) return null;
    const oldStatus = redLine.reviewStatus;
    const oldNote = redLine.reviewNote || '(无)';
    redLineDao.updateReview(redLineId, reviewStatus, reviewNote, reviewedBy);
    const shelter = shelterDao.findById(redLine.shelterId);
    if (shelter) {
      recordChange({
        entityType: 'redline',
        entityId: redLineId,
        shelterId: redLine.shelterId,
        shelterName: shelter.name,
        changeType: 'review',
        fieldName: '复核状态',
        oldValue: oldStatus,
        newValue: reviewStatus,
        operator: reviewedBy,
        remark: \`复核备注：\${reviewNote}\`
      });
      if (oldNote !== reviewNote) {
        recordChange({
          entityType: 'redline',
          entityId: redLineId,
          shelterId: redLine.shelterId,
          shelterName: shelter.name,
          changeType: 'update',
          fieldName: '复核备注',
          oldValue: oldNote,
          newValue: reviewNote,
          operator: reviewedBy,
          remark: '补录复核说明'
        });
      }
    }
    return redLineDao.findById(redLineId);
  },

  updateRedLineRemarks: (
    redLineId: string,
    remarks: string,
    operator: string
  ): RedLineMap | null => {
    const redLine = redLineDao.findById(redLineId);
    if (!redLine) return null;
    const oldRemarks = redLine.remarks;
    redLineDao.updateRemarks(redLineId, remarks, operator);
    const shelter = shelterDao.findById(redLine.shelterId);
    if (shelter) {
      recordChange({
        entityType: 'redline',
        entityId: redLineId,
        shelterId: redLine.shelterId,
        shelterName: shelter.name,
        changeType: 'update',
        fieldName: '备注内容',
        oldValue: oldRemarks,
        newValue: remarks,
        operator,
        remark: '补录/修改红线图备注'
      });
    }
    return redLineDao.findById(redLineId);
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
    roadCondition: GridInspectorReport['roadCondition'],
    operator: string
  ): { workflow: WorkflowRecord | null; report: GridInspectorReport | null } => {
    const workflow = workflowDao.findById(workflowId);
    const shelter = shelterDao.findById(shelterId);
    if (!workflow || workflow.currentStep !== 'inspector_review' || !shelter) {
      return { workflow: null, report: null };
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
    recordChange({
      entityType: 'inspector_report',
      entityId: report.id,
      shelterId,
      shelterName: shelter.name,
      changeType: 'create',
      fieldName: '巡查表',
      oldValue: '(无)',
      newValue: \`报告号：\${reportNo}，实际容量：\${actualCapacity}人，改道：\${isTemporaryDetour ? '是' : '否'}\`,
      operator,
      remark: isTemporaryDetour ? \`发现临时改道：\${detourDescription}\` : '网格员巡查表录入'
    });
    let stepStatus: WorkflowRecord['stepStatus'] = 'completed';
    let remark = \`巡查表审核完成，报告号：\${reportNo}\`;
    if (isTemporaryDetour) {
      stepStatus = 'suspended';
      remark = \`发现临时改道：\${detourDescription}，已挂起等待居民代表复核，报告号：\${reportNo}\`;
      shelterDao.updateStatus(shelterId, 'pending_review');
      recordChange({
        entityType: 'shelter',
        entityId: shelterId,
        shelterId,
        shelterName: shelter.name,
        changeType: 'update',
        fieldName: '点位状态',
        oldValue: shelter.status,
        newValue: 'pending_review',
        operator,
        remark: '因发现临时改道，点位状态置为待复核'
      });
    }
    workflowDao.updateStep(workflowId, {
      stepStatus,
      inspectorReportId: report.id,
      operator,
      remark
    });
    if (stepStatus === 'completed') {
      const nextStep = STEP_FLOW.inspector_review!;
      workflowDao.create({
        shelterId,
        currentStep: nextStep,
        stepStatus: 'pending',
        redLineMapId: workflow.redLineMapId,
        inspectorReportId: report.id,
        previousStep: 'inspector_review',
        nextStep: STEP_FLOW[nextStep],
        operator,
        remark: \`等待\${STEP_NAMES[nextStep]}\`
      });
    }
    return { workflow: workflowDao.findById(workflowId), report };
  },

  resumeAfterResidentReview: (
    workflowId: string,
    shelterId: string,
    operator: string
  ): WorkflowRecord | null => {
    const workflow = workflowDao.findById(workflowId);
    const shelter = shelterDao.findById(shelterId);
    if (!workflow || workflow.stepStatus !== 'suspended' || !shelter) return null;
    const oldStatus = shelter.status;
    shelterDao.updateStatus(shelterId, 'normal');
    recordChange({
      entityType: 'shelter',
      entityId: shelterId,
      shelterId,
      shelterName: shelter.name,
      changeType: 'update',
      fieldName: '点位状态',
      oldValue: oldStatus,
      newValue: 'normal',
      operator,
      remark: '居民代表复核通过，恢复正常状态'
    });
    const report = workflow.inspectorReportId
      ? inspectorDao.findById(workflow.inspectorReportId)
      : null;
    if (report) {
      recordChange({
        entityType: 'inspector_report',
        entityId: report.id,
        shelterId,
        shelterName: shelter.name,
        changeType: 'review',
        fieldName: '居民复核',
        oldValue: '待复核',
        newValue: '已通过',
        operator,
        remark: '居民代表完成临时改道复核'
      });
    }
    workflowDao.updateStep(workflowId, {
      stepStatus: 'completed',
      operator,
      remark: '居民代表复核通过，工作流继续'
    });
    const nextStep = STEP_FLOW.inspector_review!;
    workflowDao.create({
      shelterId,
      currentStep: nextStep,
      stepStatus: 'pending',
      redLineMapId: workflow.redLineMapId,
      inspectorReportId: workflow.inspectorReportId,
      previousStep: 'inspector_review',
      nextStep: STEP_FLOW[nextStep],
      operator,
      remark: \`等待\${STEP_NAMES[nextStep]}\`
    });
    return workflowDao.findById(workflowId);
  },

  step3_updatePointList: (
    workflowId: string,
    shelterId: string,
    operator: string
  ): { workflow: WorkflowRecord | null; checkResult: CapacityCheckResult | null } => {
    const workflow = workflowDao.findById(workflowId);
    const shelter = shelterDao.findById(shelterId);
    if (!workflow || workflow.currentStep !== 'point_update' || !shelter) {
      return { workflow: null, checkResult: null };
    }
    const latestReport = inspectorDao.findLatestByShelterId(shelterId);
    const oldCapacity = shelter.actualCapacity;
    if (latestReport) {
      shelterDao.update(shelterId, { actualCapacity: latestReport.actualCapacity });
      recordChange({
        entityType: 'shelter',
        entityId: shelterId,
        shelterId,
        shelterName: shelter.name,
        changeType: 'update',
        fieldName: '实际容量',
        oldValue: String(oldCapacity),
        newValue: String(latestReport.actualCapacity),
        operator,
        remark: '点位清单更新，同步巡查表容量'
      });
    }
    const checkResult = capacityCheckService.recalculateAfterSupplement(shelterId, operator);
    if (checkResult) {
      recordChange({
        entityType: 'capacity_check',
        entityId: checkResult.id,
        shelterId,
        shelterName: shelter.name,
        changeType: 'recalc',
        fieldName: '校核容量',
        oldValue: String(oldCapacity),
        newValue: String(checkResult.checkedCapacity),
        operator,
        remark: '点位清单更新后重新计算容量校核结果',
        affectedResultIds: [checkResult.id]
      });
    }
    workflowDao.updateStep(workflowId, {
      stepStatus: 'completed',
      operator,
      remark: '点位清单更新完成，三步流程结束'
    });
    return { workflow: workflowDao.findById(workflowId), checkResult: checkResult || null };
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
    return STEP_NAMES;
  }
};
`;

fs.writeFileSync('src/services/workflowService.ts', content, 'utf8');
console.log('File written successfully');
console.log('File size:', fs.statSync('src/services/workflowService.ts').size, 'bytes');
console.log('Line count:', content.split('\n').length);
