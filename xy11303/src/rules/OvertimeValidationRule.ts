import { ValidationResult, TaskStatus } from '../types';
import dayjs from 'dayjs';

export interface OvertimeValidationContext {
  taskId: string;
  deadline: string;
  submittedAt?: string;
  completedAt?: string;
  status: TaskStatus;
}

export class OvertimeValidationRule {
  static async validate(context: OvertimeValidationContext): Promise<ValidationResult> {
    const deadline = dayjs(context.deadline);
    const actualTime = context.submittedAt || context.completedAt;
    
    if (!actualTime) {
      if (dayjs().isAfter(deadline)) {
        const hoursOverdue = dayjs().diff(deadline, 'hour');
        return {
          valid: false,
          passed: false,
          reason: `任务已超期${hoursOverdue}小时未提交`,
          rule: 'OVERTIME_SUBMIT',
          severity: 'warning',
          deductionAmount: 0
        };
      }
      
      return {
        valid: true,
        passed: true,
        reason: '任务在截止时间前',
        rule: 'OVERTIME_SUBMIT',
        severity: 'info'
      };
    }

    const submissionTime = dayjs(actualTime);
    
    if (submissionTime.isAfter(deadline)) {
      const hoursOverdue = submissionTime.diff(deadline, 'hour');
      const deductionAmount = Math.min(hoursOverdue * 10, 50);
      
      return {
        valid: false,
        passed: false,
        reason: `提交超时${hoursOverdue}小时，扣款${deductionAmount}元`,
        rule: 'OVERTIME_SUBMIT',
        severity: 'error',
        deductionAmount
      };
    }

    return {
      valid: true,
      passed: true,
      reason: '按时提交',
      rule: 'OVERTIME_SUBMIT',
      severity: 'info'
    };
  }
}
