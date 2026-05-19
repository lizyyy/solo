import { PhotoValidationRule, PhotoValidationContext } from './PhotoValidationRule';
import { OvertimeValidationRule, OvertimeValidationContext } from './OvertimeValidationRule';
import { ReworkValidationRule, ReworkValidationContext } from './ReworkValidationRule';
import { ValidationResult, CleaningTask, TaskStatus } from '../types';
import { CleaningTaskModel } from '../models/CleaningTaskModel';

export interface TaskValidationContext {
  task: CleaningTask;
  skipRules?: string[];
}

export interface ValidationReport {
  taskId: string;
  taskNo: string;
  canApprove: boolean;
  canSettle: boolean;
  totalDeduction: number;
  results: ValidationResult[];
  blockingRules: string[];
}

export class ValidationEngine {
  static async validateTask(context: TaskValidationContext): Promise<ValidationReport> {
    const { task, skipRules = [] } = context;
    const results: ValidationResult[] = [];

    if (!skipRules.includes('MISSING_PHOTOS')) {
      const photoResult = await PhotoValidationRule.validate({
        taskId: task.id,
        requiredPhotos: task.requiredPhotos,
        submittedPhotos: task.submittedPhotos
      });
      results.push(photoResult);
    }

    if (!skipRules.includes('OVERTIME_SUBMIT')) {
      const overtimeResult = await OvertimeValidationRule.validate({
        taskId: task.id,
        deadline: task.deadline,
        submittedAt: task.submittedAt,
        completedAt: task.completedAt,
        status: task.status
      });
      results.push(overtimeResult);
    }

    if (!skipRules.includes('REWORK_IMPACT')) {
      const reworkResult = await ReworkValidationRule.validate({
        taskId: task.id
      });
      results.push(reworkResult);
    }

    const blockingRules = results
      .filter(r => !r.passed && r.severity === 'error')
      .map(r => r.rule);

    const totalDeduction = results
      .filter(r => r.deductionAmount)
      .reduce((sum, r) => sum + (r.deductionAmount || 0), 0);

    const canApprove = blockingRules.length === 0 || 
                       blockingRules.every(r => r === 'OVERTIME_SUBMIT');

    const canSettle = task.status === TaskStatus.COMPLETED;

    return {
      taskId: task.id,
      taskNo: task.taskNo,
      canApprove,
      canSettle,
      totalDeduction,
      results,
      blockingRules
    };
  }

  static async validateTaskById(taskId: string, skipRules: string[] = []cast: string[] = []): Promise<ValidationReport> {
    const task = CleaningTaskModel.getById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    return this.validateTask({ task, skipRules });
  }

  static getRuleDescriptions(): Array<{
    rule: string;
    description: string;
    isBlocking: boolean;
  }> {
    return [
      {
        rule: 'MISSING_PHOTOS',
        description: '检查照片数量是否满足要求，缺图每张扣款20元，最多100元。缺图时无法通过验收。',
        isBlocking: true
      },
      {
        rule: 'OVERTIME_SUBMIT',
        description: '检查任务是否按时提交。超时每小时扣款10元，最多50元。超时不阻塞验收，但影响结算。',
        isBlocking: false
      },
      {
        rule: 'REWORK_IMPACT',
        description: '检查返工记录。每次返工扣款30元，返工超时每小时额外扣款5元，最多25元。返工影响结算金额。',
        isBlocking: false
      }
    ];
  }

  static explainResults(results: ValidationResult[]): string {
    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);
    const errors = failed.filter(r => r.severity === 'error');
    const warnings = failed.filter(r => r.severity === 'warning');

    let explanation = '';

    if (errors.length > 0) {
      explanation += `严重问题 (${errors.length}):\n`;
      errors.forEach(r => {
        explanation += `  - ${r.reason}\n`;
      });
    }

    if (warnings.length > 0) {
      explanation += `警告 (${warnings.length}):\n`;
      warnings.forEach(r => {
        explanation += `  - ${r.reason}\n`;
      });
    }

    if (passed.length > 0) {
      explanation += `通过 (${passed.length}):\n`;
      passed.forEach(r => {
        explanation += `  - ${r.reason}\n`;
      });
    }

    const totalDeduction = results.reduce((sum, r) => sum + (r.deductionAmount || 0), 0);
    if (totalDeduction > 0) {
      explanation += `\n预计总扣款: ${totalDeduction}元`;
    }

    return explanation;
  }
}
