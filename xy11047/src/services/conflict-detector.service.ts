import { DepositDeduction, Order, DepositDeductionStatus, ConflictCheckResult, DeductionType } from '../types';
import { db } from '../store/database';

export class ConflictDetectorService {
  checkAllConflicts(deduction: DepositDeduction, order: Order): ConflictCheckResult {
    const overlapCheck = this.checkDateOverlap(deduction, order);
    if (overlapCheck.hasConflict) {
      return overlapCheck;
    }

    const depositConsistencyCheck = this.checkDepositConsistency(deduction, order);
    if (depositConsistencyCheck.hasConflict) {
      return depositConsistencyCheck;
    }

    const multipleDeductionCheck = this.checkMultipleDeductions(deduction, order);
    if (multipleDeductionCheck.hasConflict) {
      return multipleDeductionCheck;
    }

    return { hasConflict: false };
  }

  checkDateOverlap(deduction: DepositDeduction, order: Order): ConflictCheckResult {
    if (deduction.deductionType !== DeductionType.EXTEND_STAY) {
      return { hasConflict: false };
    }

    const existingDeductions = db.getDeductionsByOrderId(order.id);
    const checkoutDeductions = existingDeductions.filter(
      d => d.deductionType === DeductionType.CHECK_OUT &&
           d.id !== deduction.id &&
           d.status !== DepositDeductionStatus.CANCELLED &&
           d.status !== DepositDeductionStatus.REJECTED
    );

    if (checkoutDeductions.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'OVERLAP',
        conflictDetails: `检测到冲突：订单 ${order.orderNo} 已存在退房扣项申请（编号：${checkoutDeductions.map(d => d.deductionNo).join(', ')}），不能同时提交续住押金扣项。请先取消或处理退房扣项后再操作。`,
        conflictingDeductions: checkoutDeductions.map(d => d.id)
      };
    }

    return { hasConflict: false };
  }

  checkDepositConsistency(deduction: DepositDeduction, order: Order): ConflictCheckResult {
    const availableDeposit = order.depositAmount - order.usedDepositAmount;

    if (deduction.totalDeductionAmount > availableDeposit) {
      return {
        hasConflict: true,
        conflictType: 'DEPOSIT_INCONSISTENCY',
        conflictDetails: `押金金额不一致：订单押金总额 ${order.depositAmount} 元，已使用 ${order.usedDepositAmount} 元，剩余可用 ${availableDeposit} 元，当前申请扣款 ${deduction.totalDeductionAmount} 元超出可用额度。`,
        conflictingDeductions: []
      };
    }

    const itemsTotal = deduction.items.reduce((sum, item) => sum + item.totalAmount, 0);
    if (Math.abs(itemsTotal - deduction.totalDeductionAmount) > 0.01) {
      return {
        hasConflict: true,
        conflictType: 'DEPOSIT_INCONSISTENCY',
        conflictDetails: `扣项明细不一致：扣项明细总金额 ${itemsTotal} 元与申请扣款总金额 ${deduction.totalDeductionAmount} 元不匹配。`,
        conflictingDeductions: []
      };
    }

    for (const item of deduction.items) {
      const calculatedTotal = item.quantity * item.unitPrice;
      if (Math.abs(calculatedTotal - item.totalAmount) > 0.01) {
        return {
          hasConflict: true,
          conflictType: 'DEPOSIT_INCONSISTENCY',
          conflictDetails: `扣项明细计算错误："${item.itemName}" 数量 ${item.quantity} × 单价 ${item.unitPrice} = ${calculatedTotal} 元，与明细金额 ${item.totalAmount} 元不匹配。`,
          conflictingDeductions: []
        };
      }
    }

    return { hasConflict: false };
  }

  checkMultipleDeductions(deduction: DepositDeduction, order: Order): ConflictCheckResult {
    const existingDeductions = db.getDeductionsByOrderId(order.id);
    const activeDeductions = existingDeductions.filter(
      d => d.id !== deduction.id &&
           d.status !== DepositDeductionStatus.CANCELLED &&
           d.status !== DepositDeductionStatus.REJECTED &&
           d.status !== DepositDeductionStatus.EXECUTED
    );

    const sameTypeDeductions = activeDeductions.filter(d => d.deductionType === deduction.deductionType);

    if (sameTypeDeductions.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'MULTIPLE_DEDUCTION',
        conflictDetails: `重复提交检测：订单 ${order.orderNo} 已存在同类型的押金扣项申请（编号：${sameTypeDeductions.map(d => d.deductionNo).join(', ')}），状态为 ${sameTypeDeductions.map(d => d.status).join(', ')}。请先处理现有申请或取消后再提交。`,
        conflictingDeductions: sameTypeDeductions.map(d => d.id)
      };
    }

    return { hasConflict: false };
  }

  simulateConflictScenario(orderId: string, deductionType: DeductionType): ConflictCheckResult {
    const order = db.getOrderById(orderId);
    if (!order) {
      return { hasConflict: false };
    }

    const simulatedDeduction: DepositDeduction = {
      id: 'simulated',
      deductionNo: 'SIMULATED',
      orderId: order.id,
      orderNo: order.orderNo,
      guestName: order.guestName,
      guestPhone: order.guestPhone,
      roomNo: order.roomNo,
      deductionType: deductionType,
      status: DepositDeductionStatus.DRAFT,
      totalDeductionAmount: 100,
      items: [],
      applicantId: 'test',
      applicantName: '测试',
      submitSource: 'TEST',
      applyTime: new Date(),
      createTime: new Date(),
      updateTime: new Date()
    };

    return this.checkAllConflicts(simulatedDeduction, order);
  }
}

export const conflictDetector = new ConflictDetectorService();