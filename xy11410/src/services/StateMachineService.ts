import { ReceiptStatus, StatusTransitionRules, ActionType } from '../constants/ReceiptStatus';
import { AppDataSource } from '../data-source';
import { MaterialReceipt } from '../entities/MaterialReceipt';
import { StatusTransition } from '../entities/StatusTransition';
import { calculateDiff, DiffResult } from '../utils/diffUtils';

export interface StateTransitionContext {
  receiptId: string;
  targetStatus: ReceiptStatus;
  actionType: ActionType;
  reason?: string;
  operator?: string;
  additionalData?: Record<string, any>;
}

export class StateMachineService {
  private receiptRepository = AppDataSource.getRepository(MaterialReceipt);
  private transitionRepository = AppDataSource.getRepository(StatusTransition);

  canTransition(currentStatus: ReceiptStatus, targetStatus: ReceiptStatus): boolean {
    const allowedTransitions = StatusTransitionRules[currentStatus] || [];
    return allowedTransitions.includes(targetStatus);
  }

  async transition(context: StateTransitionContext): Promise<{
    success: boolean;
    receipt?: MaterialReceipt;
    transition?: StatusTransition;
    error?: string;
  }> {
    const { receiptId, targetStatus, actionType, reason, operator, additionalData } = context;

    const receipt = await this.receiptRepository.findOne({ where: { id: receiptId } });
    if (!receipt) {
      return { success: false, error: '回执记录不存在' };
    }

    if (!this.canTransition(receipt.status, targetStatus)) {
      return {
        success: false,
        error: `无法从 ${receipt.status} 转换到 ${targetStatus}`
      };
    }

    const beforeData = this.extractSnapshotData(receipt);
    const diffs = this.calculateTransitionDiffs(receipt, targetStatus, additionalData);

    this.applyChanges(receipt, targetStatus, additionalData);

    const savedReceipt = await this.receiptRepository.save(receipt);
    const afterData = this.extractSnapshotData(savedReceipt);

    const transition = this.transitionRepository.create({
      receiptId: receipt.id,
      fromStatus: receipt.status,
      toStatus: targetStatus,
      actionType,
      beforeData,
      afterData,
      diffData: diffs,
      reason,
      operator,
      operatedAt: new Date()
    });

    const savedTransition = await this.transitionRepository.save(transition);

    return {
      success: true,
      receipt: savedReceipt,
      transition: savedTransition
    };
  }

  private extractSnapshotData(receipt: MaterialReceipt): any {
    return {
      status: receipt.status,
      recordStatus: receipt.recordStatus,
      quantity: receipt.quantity,
      reportedQuantity: receipt.reportedQuantity,
      amount: receipt.amount,
      reportedAmount: receipt.reportedAmount,
      unitPrice: receipt.unitPrice,
      reviewReason: receipt.reviewReason,
      manualReason: receipt.manualReason,
      abnormalReason: receipt.abnormalReason
    };
  }

  private calculateTransitionDiffs(
    receipt: MaterialReceipt,
    targetStatus: ReceiptStatus,
    additionalData?: Record<string, any>
  ): DiffResult[] {
    const before = this.extractSnapshotData(receipt);
    const after = { ...before, status: targetStatus, ...additionalData };
    return calculateDiff(before, after);
  }

  private applyChanges(
    receipt: MaterialReceipt,
    targetStatus: ReceiptStatus,
    additionalData?: Record<string, any>
  ): void {
    receipt.status = targetStatus;

    if (additionalData) {
      Object.assign(receipt, additionalData);
    }
  }

  async getTransitionHistory(receiptId: string): Promise<StatusTransition[]> {
    return this.transitionRepository.find({
      where: { receiptId },
      order: { createdAt: 'ASC' }
    });
  }

  async getTransitionDiff(transitionId: string): Promise<{
    transition: StatusTransition;
    formattedDiff: string;
  } | null> {
    const transition = await this.transitionRepository.findOne({
      where: { id: transitionId }
    });

    if (!transition) return null;

    return {
      transition,
      formattedDiff: this.formatDiff(transition.diffData)
    };
  }

  private formatDiff(diffData: any): string {
    if (!diffData || !Array.isArray(diffData)) return '';
    return diffData.map((d: any) => `${d.field}: ${d.before} → ${d.after}`).join('\n');
  }
}

export const stateMachineService = new StateMachineService();
