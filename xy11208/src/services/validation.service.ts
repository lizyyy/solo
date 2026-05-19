import { RepairModel } from '../models/repair.model';
import { ValidationResult } from '../types';

export class ValidationService {
  static validateRepairCreation(
    pumpRoomId: number,
    problemDescription: string
  ): ValidationResult {
    if (RepairModel.hasOpenRepair(pumpRoomId, problemDescription)) {
      return {
        valid: false,
        shouldBlock: true,
        reason: '该泵房已有相同问题的报修正在处理中，请不要重复报修'
      };
    }

    return { valid: true, shouldBlock: false };
  }

  static validateStatusTransition(
    currentStatus: string,
    targetStatus: string
  ): ValidationResult {
    const validTransitions: Record<string, string[]> = {
      '待派单': ['处理中', '已关闭'],
      '处理中': ['待复测', '已关闭'],
      '待复测': ['已完成', '处理中'],
      '已完成': [],
      '已关闭': []
    };

    if (!validTransitions[currentStatus]) {
      return {
        valid: false,
        shouldBlock: true,
        reason: `未知的当前状态: ${currentStatus}`
      };
    }

    if (!validTransitions[currentStatus].includes(targetStatus)) {
      return {
        valid: false,
        shouldBlock: true,
        reason: `状态变更不允许: ${currentStatus} -> ${targetStatus}`
      };
    }

    return { valid: true, shouldBlock: false };
  }

  static validateRetest(repairId: number, passed: boolean): ValidationResult {
    const repair = RepairModel.getById(repairId);
    if (!repair) {
      return {
        valid: false,
        shouldBlock: true,
        reason: '报修记录不存在'
      };
    }

    if (repair.status !== '待复测') {
      return {
        valid: false,
        shouldBlock: true,
        reason: '当前状态不允许复测操作'
      };
    }

    return { valid: true, shouldBlock: false };
  }
}
