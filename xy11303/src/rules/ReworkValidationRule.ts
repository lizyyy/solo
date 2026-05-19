import { ReworkModel } from '../models/ReworkModel';
import { ValidationResult, TaskStatus } from '../types';
import dayjs from 'dayjs';

export interface ReworkValidationContext {
  taskId: string;
}

export class ReworkValidationRule {
  static async validate(context: ReworkValidationContext): Promise<ValidationResult> {
    const reworks = ReworkModel.getByTaskId(context.taskId);
    const completedReworks = reworks.filter(r => r.status === TaskStatus.COMPLETED);
    
    if (completedReworks.length === 0) {
      return {
        valid: true,
        passed: true,
        reason: '无返工记录',
        rule: 'REWORK_IMPACT',
        severity: 'info'
      };
    }

    const reworkCount = completedReworks.length;
    const totalReworkDeduction = reworkCount * 30;

    let latestRework = completedReworks[0];
    for (const rework of completedReworks) {
      if (dayjs(rework.completedAt!).isAfter(dayjs(latestRework.completedAt!))) {
        latestRework = rework;
      }
    }

    const firstReworkDeadline = dayjs(reworks[0].deadline);
    const firstReworkCompleted = dayjs(latestRework.completedAt!);
    
    let overtimeDeduction = 0;
    if (firstReworkCompleted.isAfter(firstReworkDeadline)) {
      const overtimeHours = firstReworkCompleted.diff(firstReworkDeadline, 'hour');
      overtimeDeduction = Math.min(overtimeHours * 5, 25);
    }

    const totalDeduction = totalReworkDeduction + overtimeDeduction;

    return {
      valid: false,
      passed: false,
      reason: `存在${reworkCount}次返工记录，返工扣款${totalReworkDeduction}元${overtimeDeduction > 0 ? `，返工超时额外扣款${overtimeDeduction}元` : ''}，总计${totalDeduction}元`,
      rule: 'REWORK_IMPACT',
      severity: 'warning',
      deductionAmount: totalDeduction
    };
  }

  static calculateReworkImpact(taskId: string): {
    reworkCount: number;
    baseDeduction: number;
    overtimeDeduction: number;
    totalDeduction: number;
    reworkDetails: Array<{
      reworkId: string;
      reason: string;
      createdAt: string;
      completedAt?: string;
      isOvertime: boolean;
      overtimeHours?: number;
    }>;
  } {
    const reworks = ReworkModel.getByTaskId(taskId);
    const completedReworks = reworks.filter(r => r.status === TaskStatus.COMPLETED);

    const reworkDetails = completedReworks.map(rework => {
      const deadline = dayjs(rework.deadline);
      const completed = dayjs(rework.completedAt!);
      const isOvertime = completed.isAfter(deadline);
      const overtimeHours = isOvertime ? completed.diff(deadline, 'hour') : 0;

      return {
        reworkId: rework.id,
        reason: rework.reason,
        createdAt: rework.createdAt,
        completedAt: rework.completedAt,
        isOvertime,
        overtimeHours: overtimeHours > 0 ? overtimeHours : undefined
      };
    });

    const baseDeduction = completedReworks.length * 30;
    const overtimeDeduction = reworkDetails.reduce((sum, d) => {
      if (d.isOvertime && d.overtimeHours) {
        return sum + Math.min(d.overtimeHours * 5, 25);
      }
      return sum;
    }, 0);

    return {
      reworkCount: completedReworks.length,
      baseDeduction,
      overtimeDeduction,
      totalDeduction: baseDeduction + overtimeDeduction,
      reworkDetails
    };
  }
}
