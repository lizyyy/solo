import { Injectable } from '@nestjs/common';
import { RefundStatus, RefundStatusTransitions } from '../../../common/enums/refund-status.enum';
import { InvalidStatusTransitionException } from '../../../common/exceptions/business.exception';

@Injectable()
export class StateMachineService {
  canTransition(currentStatus: RefundStatus, targetStatus: RefundStatus): boolean {
    const allowedTransitions = RefundStatusTransitions[currentStatus];
    if (!allowedTransitions) {
      return false;
    }
    return allowedTransitions.includes(targetStatus);
  }

  validateTransition(currentStatus: RefundStatus, targetStatus: RefundStatus): void {
    if (!this.canTransition(currentStatus, targetStatus)) {
      throw new InvalidStatusTransitionException(currentStatus, targetStatus);
    }
  }

  getAllowedTransitions(currentStatus: RefundStatus): RefundStatus[] {
    return RefundStatusTransitions[currentStatus] || [];
  }

  isTerminalStatus(status: RefundStatus): boolean {
    const allowedTransitions = RefundStatusTransitions[status];
    return !allowedTransitions || allowedTransitions.length === 0;
  }

  getStatusDescription(status: RefundStatus): string {
    const descriptions: Record<RefundStatus, string> = {
      [RefundStatus.DRAFT]: '草稿',
      [RefundStatus.PENDING]: '待审批',
      [RefundStatus.PROCESSING]: '处理中',
      [RefundStatus.SUCCESS]: '退款成功',
      [RefundStatus.FAILED]: '退款失败',
      [RefundStatus.CANCELLED]: '已取消',
      [RefundStatus.REJECTED]: '已拒绝',
      [RefundStatus.RETRYING]: '重试中',
    };
    return descriptions[status] || status;
  }
}
