import { v4 as uuidv4 } from 'uuid';
import {
  SubsidyRecord,
  SwipeRecord,
  RefundRecord,
  ReconciliationBatch,
  ReconciliationDetail,
  Discrepancy,
  DiscrepancyType,
  ReviewRecord,
  ReconciliationSummary,
  ReviewAction
} from '../models/types';
import dataStore from '../store/dataStore';

export class ReconciliationService {
  createBatch(month: string, createdBy: string, name?: string): ReconciliationBatch {
    const batch = dataStore.createBatch({
      name: name || `${month}月对账`,
      month,
      status: 'importing',
      createdAt: new Date(),
      createdBy,
      totalRecords: 0,
      matchedRecords: 0,
      discrepancyRecords: 0,
      reviewedRecords: 0,
      totalSubsidyAmount: 0,
      totalSwipeAmount: 0,
      totalRefundAmount: 0,
      totalEligibleAmount: 0,
      totalIneligibleAmount: 0
    });
    return batch;
  }

  async processBatch(batchId: string): Promise<ReconciliationBatch | null> {
    const batch = dataStore.getBatch(batchId);
    if (!batch) return null;

    dataStore.updateBatch(batchId, { status: 'processing' });

    const month = batch.month;
    const subsidyRecords = dataStore.getSubsidyByMonth(month);
    const swipeRecords = dataStore.getSwipesByMonth(month);
    const refundRecords = dataStore.getRefundsByMonth(month);

    const studentMap = this.groupRecordsByStudent(subsidyRecords, swipeRecords, refundRecords);

    let matchedRecords = 0;
    let discrepancyRecords = 0;
    let totalSubsidyAmount = 0;
    let totalSwipeAmount = 0;
    let totalRefundAmount = 0;
    let totalEligibleAmount = 0;
    let totalIneligibleAmount = 0;

    for (const [studentId, studentData] of studentMap.entries()) {
      const detail = this.createReconciliationDetail(
        batchId,
        studentId,
        studentData
      );

      if (detail.discrepancies.length > 0) {
        discrepancyRecords++;
      } else {
        matchedRecords++;
      }

      totalSubsidyAmount += detail.totalSubsidyLimit;
      totalSwipeAmount += detail.totalSwipeAmount;
      totalRefundAmount += detail.totalRefundAmount;
      totalEligibleAmount += detail.eligibleAmount;
      totalIneligibleAmount += detail.ineligibleAmount;

      dataStore.addDetail(detail);
    }

    const updatedBatch = dataStore.updateBatch(batchId, {
      status: 'reviewing',
      processedAt: new Date(),
      totalRecords: studentMap.size,
      matchedRecords,
      discrepancyRecords,
      totalSubsidyAmount,
      totalSwipeAmount,
      totalRefundAmount,
      totalEligibleAmount,
      totalIneligibleAmount
    });

    return updatedBatch;
  }

  private groupRecordsByStudent(
    subsidyRecords: SubsidyRecord[],
    swipeRecords: SwipeRecord[],
    refundRecords: RefundRecord[]
  ): Map<string, {
    subsidy?: SubsidyRecord;
    swipes: SwipeRecord[];
    refunds: RefundRecord[];
    name: string;
  }> {
    const studentMap = new Map<string, {
      subsidy?: SubsidyRecord;
      swipes: SwipeRecord[];
      refunds: RefundRecord[];
      name: string;
    }>();

    for (const subsidy of subsidyRecords) {
      const data = studentMap.get(subsidy.studentId) || { swipes: [], refunds: [], name: subsidy.name };
      data.subsidy = subsidy;
      data.name = subsidy.name;
      studentMap.set(subsidy.studentId, data);
    }

    for (const swipe of swipeRecords) {
      const data = studentMap.get(swipe.studentId) || { swipes: [], refunds: [], name: swipe.name };
      data.swipes.push(swipe);
      data.name = swipe.name || data.name;
      studentMap.set(swipe.studentId, data);
    }

    for (const refund of refundRecords) {
      const data = studentMap.get(refund.studentId) || { swipes: [], refunds: [], name: refund.name };
      data.refunds.push(refund);
      data.name = refund.name || data.name;
      studentMap.set(refund.studentId, data);
    }

    return studentMap;
  }

  private createReconciliationDetail(
    batchId: string,
    studentId: string,
    studentData: {
      subsidy?: SubsidyRecord;
      swipes: SwipeRecord[];
      refunds: RefundRecord[];
      name: string;
    }
  ): ReconciliationDetail {
    const { subsidy, swipes, refunds, name } = studentData;
    
    const totalSwipeAmount = swipes.reduce((sum, s) => sum + s.amount, 0);
    const totalRefundAmount = refunds.reduce((sum, r) => sum + r.refundAmount, 0);
    const netAmount = totalSwipeAmount - totalRefundAmount;
    const totalSubsidyLimit = subsidy?.monthlyLimit || 0;

    const discrepancies: Discrepancy[] = [];

    this.checkSubsidyLimit(discrepancies, totalSubsidyLimit, totalSwipeAmount, swipes);
    this.checkDuplicateSwipes(discrepancies, swipes);
    this.checkRefundReturns(discrepancies, swipes, refunds);
    this.checkMissingRecords(discrepancies, subsidy, swipes);

    const eligibleAmount = discrepancies.length > 0
      ? Math.min(totalSubsidyLimit, netAmount)
      : Math.min(totalSubsidyLimit, netAmount);
    const ineligibleAmount = Math.max(0, netAmount - eligibleAmount);

    const finalAmount = this.calculateFinalAmount(eligibleAmount, discrepancies);
    const finalExplanation = this.generateFinalExplanation(discrepancies, totalSubsidyLimit, totalSwipeAmount, totalRefundAmount, finalAmount);

    return {
      id: uuidv4(),
      batchId,
      studentId,
      studentName: name,
      subsidyRecord: subsidy,
      swipeRecords: swipes,
      refundRecords: refunds,
      totalSubsidyLimit,
      totalSwipeAmount,
      totalRefundAmount,
      netAmount,
      eligibleAmount,
      ineligibleAmount,
      status: discrepancies.length > 0 ? 'discrepancy' : 'matched',
      discrepancies,
      reviewRecords: [],
      finalAmount,
      finalExplanation
    };
  }

  private checkSubsidyLimit(
    discrepancies: Discrepancy[],
    monthlyLimit: number,
    totalSwipe: number,
    swipes: SwipeRecord[]
  ): void {
    if (monthlyLimit === 0) return;
    
    if (totalSwipe > monthlyLimit) {
      const overAmount = totalSwipe - monthlyLimit;
      const overLimitSwipes = this.findOverLimitSwipes(swipes, monthlyLimit);
      
      discrepancies.push({
        type: 'subsidy_limit_exceeded',
        severity: overAmount > monthlyLimit * 0.5 ? 'high' : 'medium',
        description: '补贴上限超出',
        detailedExplanation: `该生月度补贴上限为¥${monthlyLimit.toFixed(2)}，本月实际消费¥${totalSwipe.toFixed(2)}，超出部分¥${overAmount.toFixed(2)}。超出部分将不予补贴，需由学生自费。超出上限的消费记录包括：${overLimitSwipes}`,
        expectedValue: monthlyLimit,
        actualValue: totalSwipe,
        difference: overAmount
      });
    }
  }

  private findOverLimitSwipes(swipes: SwipeRecord[], limit: number): string {
    let runningTotal = 0;
    const overList: string[] = [];
    
    const sortedSwipes = [...swipes].sort((a, b) => a.swipeTime.getTime() - b.swipeTime.getTime());
    
    for (const swipe of sortedSwipes) {
      runningTotal += swipe.amount;
      if (runningTotal > limit) {
        const dateStr = swipe.swipeTime.toLocaleDateString('zh-CN');
        overList.push(`${dateStr} ¥${swipe.amount.toFixed(2)}`);
      }
    }
    
    return overList.slice(0, 5).join('、') + (overList.length > 5 ? '等' : '');
  }

  private checkDuplicateSwipes(discrepancies: Discrepancy[], swipes: SwipeRecord[]): void {
    const timeWindow = 5 * 60 * 1000;
    const duplicates: string[] = [];
    let duplicateAmount = 0;

    for (let i = 0; i < swipes.length; i++) {
      for (let j = i + 1; j < swipes.length; j++) {
        const timeDiff = Math.abs(swipes[i].swipeTime.getTime() - swipes[j].swipeTime.getTime());
        const amountSame = Math.abs(swipes[i].amount - swipes[j].amount) < 0.01;
        
        if (timeDiff < timeWindow && amountSame) {
          duplicates.push(`${swipes[i].swipeTime.toLocaleString('zh-CN')} ¥${swipes[i].amount.toFixed(2)}`);
          duplicateAmount += swipes[i].amount;
          break;
        }
      }
    }

    if (duplicates.length > 0) {
      discrepancies.push({
        type: 'duplicate_claim',
        severity: 'high',
        description: '疑似重复刷卡',
        detailedExplanation: `检测到${duplicates.length}笔疑似重复刷卡记录（5分钟内相同金额），涉及金额¥${duplicateAmount.toFixed(2)}。请核实是否为误刷或重复扣款。疑似重复记录：${duplicates.join('、')}`,
        expectedValue: 0,
        actualValue: duplicates.length,
        difference: duplicateAmount
      });
    }
  }

  private checkRefundReturns(
    discrepancies: Discrepancy[],
    swipes: SwipeRecord[],
    refunds: RefundRecord[]
  ): void {
    if (refunds.length === 0) return;

    const unmatchedRefunds: string[] = [];
    let unmatchedAmount = 0;

    for (const refund of refunds) {
      const matchedSwipe = swipes.find(s => {
        if (refund.relatedSwipeId) {
          return s.id === refund.relatedSwipeId;
        }
        const timeDiff = Math.abs(s.swipeTime.getTime() - refund.refundDate.getTime());
        return timeDiff < 24 * 60 * 60 * 1000 && Math.abs(s.amount - refund.refundAmount) < 0.01;
      });

      if (!matchedSwipe) {
        unmatchedRefunds.push(`${refund.refundDate.toLocaleDateString('zh-CN')} ¥${refund.refundAmount.toFixed(2)}`);
        unmatchedAmount += refund.refundAmount;
      }
    }

    if (unmatchedRefunds.length > 0) {
      discrepancies.push({
        type: 'refund_return',
        severity: 'medium',
        description: '退餐无对应消费记录',
        detailedExplanation: `发现${unmatchedRefunds.length}笔退餐记录找不到对应的刷卡消费记录，涉及金额¥${unmatchedAmount.toFixed(2)}。请核实退餐原因和对应消费记录。未匹配记录：${unmatchedRefunds.join('、')}`,
        expectedValue: 0,
        actualValue: unmatchedRefunds.length,
        difference: unmatchedAmount
      });
    }
  }

  private checkMissingRecords(
    discrepancies: Discrepancy[],
    subsidy?: SubsidyRecord,
    swipes?: SwipeRecord[]
  ): void {
    if (subsidy && (!swipes || swipes.length === 0)) {
      discrepancies.push({
        type: 'no_swipe_record',
        severity: 'low',
        description: '有补贴但无消费记录',
        detailedExplanation: `该生享有¥${subsidy.monthlyLimit.toFixed(2)}的月度补贴（${subsidy.subsidyType}），但本月无任何刷卡消费记录。请确认是否未使用补贴或数据缺失。`,
        expectedValue: 1,
        actualValue: 0,
        difference: subsidy.monthlyLimit
      });
    }

    if (!subsidy && swipes && swipes.length > 0) {
      const totalAmount = swipes.reduce((sum, s) => sum + s.amount, 0);
      discrepancies.push({
        type: 'no_subsidy_record',
        severity: 'medium',
        description: '有消费但无补贴记录',
        detailedExplanation: `该生本月有${swipes.length}笔刷卡消费，总计¥${totalAmount.toFixed(2)}，但不在本月补贴名单中。请确认是否遗漏补贴资格或学生信息有误。`,
        expectedValue: 1,
        actualValue: 0,
        difference: totalAmount
      });
    }
  }

  private calculateFinalAmount(eligibleAmount: number, discrepancies: Discrepancy[]): number {
    let finalAmount = eligibleAmount;
    
    for (const d of discrepancies) {
      if (d.type === 'duplicate_claim' && d.difference) {
        finalAmount = Math.max(0, finalAmount - d.difference);
      }
      if (d.type === 'refund_return' && d.difference) {
        finalAmount = Math.max(0, finalAmount - d.difference);
      }
    }
    
    return Math.max(0, Math.round(finalAmount * 100) / 100);
  }

  private generateFinalExplanation(
    discrepancies: Discrepancy[],
    subsidyLimit: number,
    swipeTotal: number,
    refundTotal: number,
    finalAmount: number
  ): string {
    if (discrepancies.length === 0) {
      return `对账无误：补贴上限¥${subsidyLimit.toFixed(2)}，本月消费¥${swipeTotal.toFixed(2)}，退餐¥${refundTotal.toFixed(2)}，净消费¥${(swipeTotal - refundTotal).toFixed(2)}，可补贴金额¥${finalAmount.toFixed(2)}。`;
    }

    const explanations = discrepancies.map(d => {
      switch (d.type) {
        case 'subsidy_limit_exceeded':
          return `[超出上限] 消费超出补贴上限部分不予补贴，扣减¥${d.difference?.toFixed(2) || '0'}`;
        case 'duplicate_claim':
          return `[重复刷卡] 疑似重复刷卡需扣除，涉及¥${d.difference?.toFixed(2) || '0'}`;
        case 'refund_return':
          return `[退餐异常] 未匹配的退餐记录需核实，涉及¥${d.difference?.toFixed(2) || '0'}`;
        case 'no_subsidy_record':
          return `[无补贴] 该生不在本月补贴名单中`;
        case 'no_swipe_record':
          return `[无消费] 该生本月无消费记录`;
        default:
          return `[${d.description}] ${d.detailedExplanation}`;
      }
    });

    return `最终补贴金额¥${finalAmount.toFixed(2)}。${explanations.join('；')}`;
  }

  reviewDetail(
    detailId: string,
    reviewer: string,
    action: ReviewAction,
    comments: string,
    adjustedAmount?: number
  ): ReconciliationDetail | null {
    const detail = dataStore.getDetail(detailId);
    if (!detail) return null;

    const reviewRecord: ReviewRecord = {
      id: uuidv4(),
      reviewer,
      reviewTime: new Date(),
      action,
      comments,
      adjustedAmount,
      requiresFollowUp: action === 'require_materials',
      followUpDeadline: action === 'require_materials' 
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : undefined
    };

    const updatedReviews = [...detail.reviewRecords, reviewRecord];
    
    let newStatus = detail.status;
    let manualAdjustment = detail.manualAdjustment;
    let finalAmount = detail.finalAmount;
    let finalExplanation = detail.finalExplanation;

    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        finalAmount = 0;
        finalExplanation = `[已驳回] ${comments}。原由：${finalExplanation}`;
        break;
      case 'adjust':
        newStatus = 'reviewed';
        if (adjustedAmount !== undefined) {
          finalAmount = adjustedAmount;
          manualAdjustment = {
            adjustedBy: reviewer,
            adjustedAmount,
            reason: comments,
            adjustedAt: new Date()
          };
          finalExplanation = `[人工调整] 调整后可补贴金额¥${adjustedAmount.toFixed(2)}。调整原因：${comments}。原计算：${finalExplanation}`;
        }
        break;
      case 'require_materials':
        newStatus = 'pending';
        finalExplanation = `[待补充材料] ${comments}。请在${reviewRecord.followUpDeadline?.toLocaleDateString('zh-CN') || '7日内'}补充相关证明材料。`;
        break;
    }

    const updatedDetail = dataStore.updateDetail(detailId, {
      status: newStatus,
      reviewRecords: updatedReviews,
      manualAdjustment,
      finalAmount,
      finalExplanation
    });

    this.updateBatchStats(detail.batchId);

    return updatedDetail;
  }

  recalculateDetail(detailId: string, reviewer: string): ReconciliationDetail | null {
    const detail = dataStore.getDetail(detailId);
    if (!detail) return null;

    const batch = dataStore.getBatch(detail.batchId);
    if (!batch) return null;

    const swipes = detail.swipeRecords;
    const refunds = detail.refundRecords;
    const subsidy = detail.subsidyRecord;

    const totalSwipeAmount = swipes.reduce((sum, s) => sum + s.amount, 0);
    const totalRefundAmount = refunds.reduce((sum, r) => sum + r.refundAmount, 0);
    const netAmount = totalSwipeAmount - totalRefundAmount;
    const totalSubsidyLimit = subsidy?.monthlyLimit || 0;

    const discrepancies: Discrepancy[] = [];
    this.checkSubsidyLimit(discrepancies, totalSubsidyLimit, totalSwipeAmount, swipes);
    this.checkDuplicateSwipes(discrepancies, swipes);
    this.checkRefundReturns(discrepancies, swipes, refunds);
    this.checkMissingRecords(discrepancies, subsidy, swipes);

    const eligibleAmount = Math.min(totalSubsidyLimit, netAmount);
    const ineligibleAmount = Math.max(0, netAmount - eligibleAmount);
    const finalAmount = this.calculateFinalAmount(eligibleAmount, discrepancies);
    const finalExplanation = this.generateFinalExplanation(
      discrepancies, totalSubsidyLimit, totalSwipeAmount, totalRefundAmount, finalAmount
    );

    const reviewRecord: ReviewRecord = {
      id: uuidv4(),
      reviewer,
      reviewTime: new Date(),
      action: 'approve',
      comments: '重新计算后自动确认',
      requiresFollowUp: false
    };

    const updatedDetail = dataStore.updateDetail(detailId, {
      totalSwipeAmount,
      totalRefundAmount,
      netAmount,
      eligibleAmount,
      ineligibleAmount,
      discrepancies,
      reviewRecords: [...detail.reviewRecords, reviewRecord],
      status: discrepancies.length > 0 ? 'discrepancy' : 'matched',
      manualAdjustment: undefined,
      finalAmount,
      finalExplanation: `[重新计算] ${finalExplanation}`
    });

    this.updateBatchStats(detail.batchId);

    return updatedDetail;
  }

  private updateBatchStats(batchId: string): void {
    const details = dataStore.getDetailsByBatch(batchId);
    
    const matchedRecords = details.filter(d => d.status === 'matched').length;
    const discrepancyRecords = details.filter(d => d.status === 'discrepancy').length;
    const reviewedRecords = details.filter(d => 
      ['reviewed', 'approved', 'rejected'].includes(d.status)
    ).length;

    const totalEligibleAmount = details.reduce((sum, d) => sum + d.finalAmount, 0);
    const totalIneligibleAmount = details.reduce((sum, d) => sum + d.ineligibleAmount, 0);

    dataStore.updateBatch(batchId, {
      matchedRecords,
      discrepancyRecords,
      reviewedRecords,
      totalEligibleAmount,
      totalIneligibleAmount
    });
  }

  completeBatch(batchId: string): ReconciliationBatch | null {
    const details = dataStore.getDetailsByBatch(batchId);
    const pendingCount = details.filter(d => 
      ['pending', 'discrepancy'].includes(d.status)
    ).length;

    if (pendingCount > 0) {
      throw new Error(`还有${pendingCount}条记录未完成复核，请先完成所有复核后再结束对账`);
    }

    return dataStore.updateBatch(batchId, {
      status: 'completed',
      completedAt: new Date()
    });
  }

  getSummary(batchId: string): ReconciliationSummary | null {
    const batch = dataStore.getBatch(batchId);
    if (!batch) return null;

    const details = dataStore.getDetailsByBatch(batchId);

    const withSubsidy = details.filter(d => d.subsidyRecord).length;
    const withoutSubsidy = details.filter(d => !d.subsidyRecord).length;
    const matched = details.filter(d => d.status === 'matched' || d.status === 'approved').length;
    const withDiscrepancy = details.filter(d => d.discrepancies.length > 0).length;
    const reviewed = details.filter(d => ['reviewed', 'approved', 'rejected'].includes(d.status)).length;

    const totalSwipe = details.reduce((sum, d) => sum + d.totalSwipeAmount, 0);
    const totalRefund = details.reduce((sum, d) => sum + d.totalRefundAmount, 0);
    const totalEligible = details.reduce((sum, d) => sum + d.finalAmount, 0);
    const totalIneligible = details.reduce((sum, d) => sum + d.ineligibleAmount, 0);
    const netAmount = totalSwipe - totalRefund;
    const toBePaid = Math.max(0, totalEligible);
    const toBeReturned = Math.max(0, totalRefund - totalSwipe);

    const discrepancyBreakdown: { type: DiscrepancyType; count: number; totalAmount: number }[] = [];
    const discrepancyMap = new Map<DiscrepancyType, { count: number; amount: number }>();

    for (const detail of details) {
      for (const d of detail.discrepancies) {
        const existing = discrepancyMap.get(d.type) || { count: 0, amount: 0 };
        existing.count++;
        existing.amount += d.difference || 0;
        discrepancyMap.set(d.type, existing);
      }
    }

    for (const [type, data] of discrepancyMap.entries()) {
      discrepancyBreakdown.push({
        type,
        count: data.count,
        totalAmount: data.amount
      });
    }

    return {
      batchId,
      month: batch.month,
      statistics: {
        totalStudents: details.length,
        withSubsidy,
        withoutSubsidy,
        matched,
        withDiscrepancy,
        reviewed
      },
      amounts: {
        totalSubsidyLimit: batch.totalSubsidyAmount,
        totalSwipe,
        totalRefund,
        totalEligible,
        totalIneligible,
        toBePaid,
        toBeReturned
      },
      discrepancyBreakdown
    };
  }
}

export default new ReconciliationService();
