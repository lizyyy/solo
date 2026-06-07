import { workflowDao } from '../dao/workflowDao';
import { redLineDao } from '../dao/redLineDao';
import { inspectorDao } from '../dao/inspectorDao';
import { shelterDao } from '../dao/shelterDao';
import { WorkflowRecord, WorkflowStep } from '../types';
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

export const workflowService = {
  startWorkflow: (shelterId: string, operator: string): WorkflowRecord | null => {
    const shelter = shelterDao.findById(shelterId);
    if (!shelter) return null;

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
      remark: `工作流已启动，当前步骤：${STEP_NAMES.redline_import}`
    });
  },

  step1_importRedLine: (
    workflowId: string,
    shelterId: string,
    version: string,
    remarks: string,
    areaRange: string,
    effectiveDate: string,
    importOperator: string
  ): WorkflowRecord | null => {
    const workflow = workflowDao.findById(workflowId);
    if (!workflow || workflow.currentStep !== 'redline_import') return null;

    const batchNo = generateBatchNo();

    redLineDao.setOldToNotLatest(shelterId);
    const redLine = redLineDao.create({
      version,
      importBatchNo: batchNo,
      shelterId,
      remarks,
      areaRange,
      effectiveDate,
      importOperator,
      isLatest: true
    });

    workflowDao.updateStep(workflowId, {
      stepStatus: 'completed',
      redLineMapId: redLine.id,
      operator: importOperator,
      remark: `红线图导入完成，批次号：${batchNo}`
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
      remark: `等待${STEP_NAMES[nextStep]}`
    });

    return workflowDao.findById(workflowId);
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
  ): WorkflowRecord | null => {
    const workflow = workflowDao.findById(workflowId);
    if (!workflow || workflow.currentStep !== 'inspector_review') return null;

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

    let stepStatus: WorkflowRecord['stepStatus'] = 'completed';
    let remark = `巡查表审核完成，报告号：${reportNo}`;

    if (isTemporaryDetour) {
      stepStatus = 'suspended';
      remark = `发现临时改道：${detourDescription}，已挂起等待居民代表复核，报告号：${reportNo}`;
      shelterDao.updateStatus(shelterId, 'pending_review');
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
        remark: `等待${STEP_NAMES[nextStep]}`
      });
    }

    return workflowDao.findById(workflowId);
  },

  resumeAfterResidentReview: (workflowId: string, shelterId: string, operator: string): WorkflowRecord | null => {
    const workflow = workflowDao.findById(workflowId);
    if (!workflow || workflow.stepStatus !== 'suspended') return null;

    shelterDao.updateStatus(shelterId, 'normal');

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
      remark: `等待${STEP_NAMES[nextStep]}`
    });

    return workflowDao.findById(workflowId);
  },

  step3_updatePointList: (workflowId: string, shelterId: string, operator: string): WorkflowRecord | null => {
    const workflow = workflowDao.findById(workflowId);
    if (!workflow || workflow.currentStep !== 'point_update') return null;

    const latestReport = inspectorDao.findLatestByShelterId(shelterId);
    if (latestReport) {
      shelterDao.update(shelterId, {
        actualCapacity: latestReport.actualCapacity
      });
    }

    workflowDao.updateStep(workflowId, {
      stepStatus: 'completed',
      operator,
      remark: '点位清单更新完成，三步流程结束'
    });

    return workflowDao.findById(workflowId);
  },

  getWorkflowForShelter: (shelterId: string): WorkflowRecord | null => {
    return workflowDao.findLatestByShelterId(shelterId);
  },

  getAllWorkflows: (): WorkflowRecord[] => {
    return workflowDao.findAll();
  },

  getWorkflowsByStep: (step: WorkflowStep): WorkflowRecord[] => {
    return workflowDao.findByStep(step);
  },

  getStepName: (step: WorkflowStep): string => {
    return STEP_NAMES[step];
  }
};
