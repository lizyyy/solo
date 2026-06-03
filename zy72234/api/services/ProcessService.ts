import { ProcessRepo } from '../db/repositories/ProcessRepo.js';
import type { ProcessStep, UserRole, ProcessNode } from '../../shared/types.js';

export const ProcessService = {
  recordNode(
    adjustmentId: string,
    step: ProcessStep,
    operator: string,
    operatorRole: UserRole,
    action: string,
    comment?: string
  ): ProcessNode {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    return ProcessRepo.create({
      adjustmentId,
      step,
      operator,
      operatorRole,
      action,
      comment,
      timestamp: now,
    });
  },

  getProcessHistory(adjustmentId: string): ProcessNode[] {
    return ProcessRepo.findByAdjustmentId(adjustmentId);
  },

  recordImport(adjustmentId: string, operator: string, hasFlagged: boolean): ProcessNode {
    const action = hasFlagged
      ? '导入尾差调整条，系统检测金额为0且备注已冲正，标记待风控复核'
      : '导入正常调整记录';
    
    return this.recordNode(adjustmentId, 'import', operator, 'assistant', action);
  },

  recordCustody(adjustmentId: string, operator: string, voucherNo: string): ProcessNode {
    const action = `补录托管确认页，凭证号 ${voucherNo}`;
    return this.recordNode(adjustmentId, 'custody', operator, 'assistant', action);
  },

  recordReview(
    adjustmentId: string,
    operator: string,
    result: 'normal' | 'verify',
    comment: string
  ): ProcessNode {
    const action = result === 'normal'
      ? '风控复核通过，冲正记录核实无误'
      : '风控标记需进一步核实';
    
    return this.recordNode(adjustmentId, 'review', operator, 'risk', action, comment);
  },

  recordComplete(adjustmentId: string): ProcessNode {
    return this.recordNode(adjustmentId, 'complete', '系统', 'all', '流程完成，记录归档');
  },
};
