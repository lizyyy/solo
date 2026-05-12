import { v4 as uuidv4 } from 'uuid';
import { 
  Inspection, 
  RectificationTask, 
  RectificationStatus, 
  StatusChange,
  ProblemType,
  Merchant
} from '../types';
import { store } from '../store';

export const RECTIFICATION_DAYS: Record<ProblemType, number> = {
  hose: 3,
  alarm: 5,
  valve: 7,
};

export const GAS_CUTOFF_AFTER_FAILED_REVIEWS = 2;

export const SEVERITY_MAP: Record<ProblemType, 'critical' | 'major' | 'minor'> = {
  hose: 'critical',
  alarm: 'major',
  valve: 'minor',
};

export const PROBLEM_DESCRIPTIONS: Record<ProblemType, string[]> = {
  hose: ['软管老化龟裂', '软管超过2米', '软管私接三通', '软管穿墙无套管'],
  alarm: ['报警器未安装', '报警器过期失效', '报警器安装位置错误', '报警器未通电'],
  valve: ['阀门锈蚀无法关闭', '阀门泄漏', '紧急切断阀失效', '阀门缺少标识'],
};

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function now(): string {
  return new Date().toISOString();
}

function recordStatusChange(
  taskId: string,
  fromStatus: string,
  toStatus: string,
  operator: string,
  reason: string
): StatusChange {
  const change: StatusChange = {
    id: uuidv4(),
    taskId,
    fromStatus,
    toStatus,
    operator,
    reason,
    timestamp: now(),
  };
  store.statusChanges.push(change);
  return change;
}

export function createTasksFromInspection(inspection: Inspection): RectificationTask[] {
  const tasks: RectificationTask[] = [];
  
  for (const problem of inspection.problems) {
    const deadline = addDays(inspection.inspectionDate, problem.rectificationDays);
    
    const task: RectificationTask = {
      id: uuidv4(),
      merchantId: inspection.merchantId,
      inspectionId: inspection.id,
      problemId: problem.id,
      problemType: problem.problemType,
      problemDescription: problem.description,
      severity: problem.severity,
      status: 'created',
      deadline,
      createdAt: now(),
      updatedAt: now(),
    };
    
    store.rectificationTasks.push(task);
    recordStatusChange(task.id, '', 'created', 'system', '安检发现问题，自动创建整改任务');
    tasks.push(task);
  }
  
  return tasks;
}

export function scheduleReview(
  taskId: string,
  reviewDate: string,
  handler: string
): RectificationTask | null {
  const task = store.rectificationTasks.find(t => t.id === taskId);
  if (!task) return null;
  
  const fromStatus = task.status;
  task.status = 'scheduled_review';
  task.reviewScheduledDate = reviewDate;
  task.handler = handler;
  task.updatedAt = now();
  
  recordStatusChange(taskId, fromStatus, 'scheduled_review', handler, 
    `预约复查日期: ${reviewDate}`);
  
  return task;
}

export function completeReview(
  taskId: string,
  result: 'passed' | 'failed',
  handler: string
): RectificationTask | null {
  const task = store.rectificationTasks.find(t => t.id === taskId);
  if (!task) return null;
  if (task.status !== 'scheduled_review') return null;
  
  const fromStatus = task.status;
  task.reviewDate = new Date().toISOString().split('T')[0];
  task.reviewResult = result;
  task.updatedAt = now();
  task.handler = handler;
  
  if (result === 'passed') {
    task.status = 'completed';
    task.completedDate = new Date().toISOString().split('T')[0];
    recordStatusChange(taskId, fromStatus, 'completed', handler, '复查通过，整改完成');
  } else {
    const failedReviews = getFailedReviewCount(taskId);
    if (failedReviews >= GAS_CUTOFF_AFTER_FAILED_REVIEWS - 1) {
      task.status = 'gas_cut_off';
      task.gasCutOffDate = new Date().toISOString().split('T')[0];
      recordStatusChange(taskId, fromStatus, 'gas_cut_off', handler, 
        `复查连续${GAS_CUTOFF_AFTER_FAILED_REVIEWS}次不通过，执行停气`);
    } else {
      task.status = 'review_failed';
      recordStatusChange(taskId, fromStatus, 'review_failed', handler, '复查不通过，需重新整改');
    }
  }
  
  return task;
}

export function manuallyCutOffGas(
  taskId: string,
  handler: string,
  reason: string
): RectificationTask | null {
  const task = store.rectificationTasks.find(t => t.id === taskId);
  if (!task) return null;
  
  const fromStatus = task.status;
  task.status = 'gas_cut_off';
  task.gasCutOffDate = new Date().toISOString().split('T')[0];
  task.updatedAt = now();
  task.handler = handler;
  
  recordStatusChange(taskId, fromStatus, 'gas_cut_off', handler, `手动停气: ${reason}`);
  
  return task;
}

export function restoreGas(
  taskId: string,
  handler: string
): RectificationTask | null {
  const task = store.rectificationTasks.find(t => t.id === taskId);
  if (!task) return null;
  if (task.status !== 'gas_cut_off') return null;
  
  const fromStatus = task.status;
  task.status = 'scheduled_review';
  task.reviewScheduledDate = new Date().toISOString().split('T')[0];
  task.updatedAt = now();
  task.handler = handler;
  
  recordStatusChange(taskId, fromStatus, 'scheduled_review', handler, '恢复供气，安排重新复查');
  
  return task;
}

export function getFailedReviewCount(taskId: string): number {
  return store.statusChanges.filter(
    sc => sc.taskId === taskId && sc.toStatus === 'review_failed'
  ).length;
}

export function getMerchantCurrentStatus(merchantId: string): Merchant['currentStatus'] {
  const tasks = store.rectificationTasks.filter(t => t.merchantId === merchantId);
  
  if (tasks.some(t => t.status === 'gas_cut_off')) {
    return 'gas_cut_off';
  }
  if (tasks.some(t => ['created', 'scheduled_review', 'review_failed'].includes(t.status))) {
    return 'warning';
  }
  return 'normal';
}

export function getTaskSuggestion(task: RectificationTask): {
  currentBlock: string;
  suggestion: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
} {
  const nowDate = new Date();
  const deadlineDate = new Date(task.deadline);
  const diffDays = Math.ceil((deadlineDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
  
  switch (task.status) {
    case 'created':
      return {
        currentBlock: diffDays < 0 ? '整改已逾期' : '整改中，等待商户完成整改',
        suggestion: diffDays < 0 
          ? `逾期${Math.abs(diffDays)}天，建议立即联系商户，必要时执行停气`
          : `剩余${diffDays}天整改期限，提醒商户按时完成`,
        priority: diffDays <= 0 ? 'urgent' : diffDays <= 2 ? 'high' : 'medium'
      };
    case 'scheduled_review':
      return {
        currentBlock: `复查已预约：${task.reviewScheduledDate}`,
        suggestion: '按预约时间到场复查，核实整改情况',
        priority: 'medium'
      };
    case 'review_failed':
      return {
        currentBlock: '复查不通过',
        suggestion: '通知商户重新整改，再次预约复查。若连续2次不通过将执行停气',
        priority: 'high'
      };
    case 'gas_cut_off':
      return {
        currentBlock: '已停气',
        suggestion: '等待商户完成整改并申请复查后，可恢复供气',
        priority: 'urgent'
      };
    case 'completed':
      return {
        currentBlock: '整改完成',
        suggestion: '档案归档，定期回访',
        priority: 'low'
      };
    default:
      return {
        currentBlock: '未知状态',
        suggestion: '请检查任务状态',
        priority: 'medium'
      };
  }
}
