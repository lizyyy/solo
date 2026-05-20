import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { ReceiptItem, Member, ActivityRule, ProcessingResult, ERROR_CODES, SUGGESTIONS } from '../types';
import PointsDatabase from '../database';

const MAX_MULTIPLIER = 10;
const MAX_AMOUNT = 100000;
const BASE_POINTS_PER_YUAN = 1;

export class RulesEngine {
  private db: PointsDatabase;

  constructor(db: PointsDatabase) {
    this.db = db;
  }

  generateTraceId(): string {
    return `TRACE-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`;
  }

  async processReceipt(receipt: ReceiptItem, members: Member[], rules: ActivityRule[]): Promise<ProcessingResult> {
    const traceId = this.generateTraceId();
    const warnings: string[] = [];
    const appliedRules: string[] = [];

    try {
      if (!this.validateTimeFormat(receipt.transactionTime)) {
        return this.createFailedResult(receipt, traceId, ERROR_CODES.INVALID_TIME_FORMAT, '交易时间格式不正确，请使用 YYYY-MM-DD HH:mm:ss 格式');
      }

      if (receipt.amount < 0) {
        return this.createFailedResult(receipt, traceId, ERROR_CODES.NEGATIVE_AMOUNT, '交易金额不能为负数');
      }

      if (receipt.amount > MAX_AMOUNT) {
        return this.createFailedResult(receipt, traceId, ERROR_CODES.AMOUNT_TOO_LARGE, `交易金额超出最大限制 ${MAX_AMOUNT} 元`);
      }

      if (!['purchase', 'return'].includes(receipt.transactionType)) {
        return this.createFailedResult(receipt, traceId, ERROR_CODES.INVALID_TRANSACTION_TYPE, '交易类型必须是 purchase 或 return');
      }

      const member = members.find(m => m.phone === receipt.memberPhone);
      if (!member) {
        return this.createFailedResult(receipt, traceId, ERROR_CODES.MEMBER_NOT_FOUND, `会员 ${receipt.memberPhone} 不存在`, SUGGESTIONS.MEMBER_NOT_FOUND);
      }

      const duplicateCheck = this.checkDuplicateReceipt(receipt.receiptNo);
      if (duplicateCheck.isDuplicate) {
        return this.createFailedResult(receipt, traceId, ERROR_CODES.DUPLICATE_RECEIPT, duplicateCheck.message, SUGGESTIONS.DUPLICATE_RECEIPT);
      }

      if (receipt.transactionType === 'return') {
        return this.processReturn(receipt, member, rules, traceId, warnings);
      }

      return this.processPurchase(receipt, member, rules, traceId, warnings, appliedRules);

    } catch (error: any) {
      return this.createFailedResult(receipt, traceId, ERROR_CODES.POINTS_CALCULATION_ERROR, `计算异常: ${error.message}`);
    }
  }

  private validateTimeFormat(time: string): boolean {
    return moment(time, 'YYYY-MM-DD HH:mm:ss', true).isValid() || 
           moment(time, 'YYYY-MM-DD', true).isValid();
  }

  private checkDuplicateReceipt(receiptNo: string): { isDuplicate: boolean; message: string } {
    const history = this.db.getReceiptHistory(receiptNo);
    const successRecords = history.filter(r => r.status === 'success');
    
    if (successRecords.length > 0) {
      return {
        isDuplicate: true,
        message: `小票 ${receiptNo} 已在 ${successRecords[0].createdAt} 成功处理，批次号: ${successRecords[0].batchId}`
      };
    }

    return { isDuplicate: false, message: '' };
  }

  private processPurchase(
    receipt: ReceiptItem,
    member: Member,
    rules: ActivityRule[],
    traceId: string,
    warnings: string[],
    appliedRules: string[]
  ): ProcessingResult {
    let basePoints = Math.floor(receipt.amount * BASE_POINTS_PER_YUAN);
    let totalMultiplier = 1;

    const applicableRules = this.getApplicableRules(receipt, member, rules);

    for (const rule of applicableRules) {
      if (rule.type === 'multiplier' && rule.multiplier) {
        if (rule.multiplier > MAX_MULTIPLIER) {
          warnings.push(`规则"${rule.name}"的倍率${rule.multiplier}超出最大限制${MAX_MULTIPLIER}，已按最大值计算`);
          totalMultiplier = Math.max(totalMultiplier, MAX_MULTIPLIER);
        } else {
          totalMultiplier = Math.max(totalMultiplier, rule.multiplier);
        }
        appliedRules.push(rule.id);
      } else if (rule.type === 'bonus' && rule.bonusPoints) {
        basePoints += rule.bonusPoints;
        appliedRules.push(rule.id);
      }
    }

    let finalPoints = Math.floor(basePoints * totalMultiplier);

    const maxPointsRule = applicableRules.find(r => r.maxPointsPerTransaction);
    if (maxPointsRule?.maxPointsPerTransaction && finalPoints > maxPointsRule.maxPointsPerTransaction) {
      warnings.push(`积分超出单笔交易最大值 ${maxPointsRule.maxPointsPerTransaction}，已截断`);
      finalPoints = maxPointsRule.maxPointsPerTransaction;
    }

    const isPending = warnings.length > 0;

    return {
      receiptNo: receipt.receiptNo,
      status: isPending ? 'pending' : 'success',
      originalData: receipt,
      calculatedPoints: finalPoints,
      appliedRules,
      warnings: warnings.length > 0 ? warnings : undefined,
      traceId
    };
  }

  private processReturn(
    receipt: ReceiptItem,
    member: Member,
    rules: ActivityRule[],
    traceId: string,
    warnings: string[]
  ): ProcessingResult {
    const originalPurchase = this.findOriginalPurchase(receipt);
    
    if (!originalPurchase) {
      return this.createPendingResult(
        receipt,
        traceId,
        ERROR_CODES.RETURN_WITHOUT_PURCHASE,
        '未找到对应的原始消费记录',
        SUGGESTIONS.RETURN_WITHOUT_PURCHASE
      );
    }

    const originalPoints = originalPurchase.calculated_points || 0;
    const returnRatio = Math.min(receipt.amount / originalPurchase.amount, 1);
    const returnPoints = Math.floor(originalPoints * returnRatio);

    return {
      receiptNo: receipt.receiptNo,
      status: 'success',
      originalData: receipt,
      calculatedPoints: -returnPoints,
      appliedRules: ['return_reversal'],
      warnings: warnings.length > 0 ? warnings : undefined,
      traceId
    };
  }

  private findOriginalPurchase(receipt: ReceiptItem): any {
    const history = this.db.getReceiptHistory(receipt.receiptNo.replace('R', ''));
    return history.find(r => r.status === 'success' && r.rawData.transactionType === 'purchase');
  }

  private getApplicableRules(receipt: ReceiptItem, member: Member, rules: ActivityRule[]): ActivityRule[] {
    const transactionTime = moment(receipt.transactionTime);

    return rules.filter(rule => {
      if (!rule.enabled) return false;

      const startTime = moment(rule.startTime);
      const endTime = moment(rule.endTime);
      if (transactionTime.isBefore(startTime) || transactionTime.isAfter(endTime)) {
        return false;
      }

      const conditions = rule.conditions;
      
      if (conditions.minAmount && receipt.amount < conditions.minAmount) {
        return false;
      }
      if (conditions.maxAmount && receipt.amount > conditions.maxAmount) {
        return false;
      }

      if (conditions.memberLevels && conditions.memberLevels.length > 0) {
        if (!conditions.memberLevels.includes(member.level)) {
          return false;
        }
      }

      if (conditions.storeIds && conditions.storeIds.length > 0) {
        if (!conditions.storeIds.includes(receipt.storeId)) {
          return false;
        }
      }

      return true;
    });
  }

  private createFailedResult(
    receipt: ReceiptItem,
    traceId: string,
    errorCode: string,
    errorMessage: string,
    suggestion?: string
  ): ProcessingResult {
    return {
      receiptNo: receipt.receiptNo,
      status: 'failed',
      originalData: receipt,
      calculatedPoints: 0,
      appliedRules: [],
      errorCode,
      errorMessage,
      suggestion,
      traceId
    };
  }

  private createPendingResult(
    receipt: ReceiptItem,
    traceId: string,
    errorCode: string,
    errorMessage: string,
    suggestion?: string
  ): ProcessingResult {
    return {
      receiptNo: receipt.receiptNo,
      status: 'pending',
      originalData: receipt,
      calculatedPoints: 0,
      appliedRules: [],
      errorCode,
      errorMessage,
      suggestion,
      traceId
    };
  }

  async processBatch(receipts: ReceiptItem[]): Promise<{
    batchId: string;
    isDuplicate: boolean;
    report?: any;
  }> {
    const batchHash = this.db.generateBatchHash(receipts);
    
    if (this.db.isBatchProcessed(batchHash)) {
      return { batchId: '', isDuplicate: true };
    }

    const batchId = `BATCH-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 12)}`;
    const members = this.db.getAllMembers() as Member[];
    const rules = this.db.getActivityRules() as ActivityRule[];

    const results: ProcessingResult[] = [];
    for (const receipt of receipts) {
      const result = await this.processReceipt(receipt, members, rules);
      results.push(result);
      this.db.saveRecord(result, batchId);
    }

    const success = results.filter(r => r.status === 'success');
    const pending = results.filter(r => r.status === 'pending');
    const failed = results.filter(r => r.status === 'failed');

    const totalPoints = success.reduce((sum, r) => sum + r.calculatedPoints, 0);

    const report = {
      batchId,
      totalCount: results.length,
      successCount: success.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      totalPoints,
      createdAt: new Date().toISOString(),
      items: {
        success,
        pending,
        failed
      }
    };

    this.db.saveBatch(batchId, batchHash, {
      totalCount: results.length,
      successCount: success.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      totalPoints
    });

    return { batchId, isDuplicate: false, report };
  }
}
