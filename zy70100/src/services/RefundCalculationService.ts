import { InterruptionReason, BillingSegment, RefundCalculation, RefundSegmentDetail } from '../types';

export interface RefundPolicy {
  getRefundPercentage: (reason: InterruptionReason, segmentType: 'ENERGY' | 'SERVICE') => number;
  isRefundable: (reason: InterruptionReason, segmentType: 'ENERGY' | 'SERVICE') => boolean;
}

export class DefaultRefundPolicy implements RefundPolicy {
  getRefundPercentage(reason: InterruptionReason, segmentType: 'ENERGY' | 'SERVICE'): number {
    if (!this.isRefundable(reason, segmentType)) {
      return 0;
    }

    const policies: Record<InterruptionReason, { energy: number; service: number }> = {
      [InterruptionReason.USER_STOP]: { energy: 50, service: 50 },
      [InterruptionReason.EQUIPMENT_FAULT]: { energy: 100, service: 100 },
      [InterruptionReason.NETWORK_DISCONNECT]: { energy: 100, service: 100 },
      [InterruptionReason.POWER_QUALITY]: { energy: 100, service: 100 },
      [InterruptionReason.VEHICLE_ISSUE]: { energy: 0, service: 0 },
    };

    const policy = policies[reason];
    return segmentType === 'ENERGY' ? policy.energy : policy.service;
  }

  isRefundable(reason: InterruptionReason, segmentType: 'ENERGY' | 'SERVICE'): boolean {
    const nonRefundableReasons = [InterruptionReason.VEHICLE_ISSUE];
    if (nonRefundableReasons.includes(reason)) {
      return false;
    }
    return true;
  }
}

export class RefundCalculationService {
  constructor(private policy: RefundPolicy = new DefaultRefundPolicy()) {}

  calculateRefund(
    interruptionReason: InterruptionReason,
    segments: BillingSegment[]
  ): RefundCalculation {
    const energySegments = segments.filter(s => s.segmentType === 'ENERGY');
    const serviceSegments = segments.filter(s => s.segmentType === 'SERVICE');

    const energyDetails = this.calculateSegmentDetails(energySegments, interruptionReason, 'ENERGY');
    const serviceDetails = this.calculateSegmentDetails(serviceSegments, interruptionReason, 'SERVICE');

    const energyAmount = energyDetails.reduce((sum, d) => sum + d.refundAmount, 0);
    const serviceAmount = serviceDetails.reduce((sum, d) => sum + d.refundAmount, 0);

    return {
      energyAmount: this.roundTo2Decimals(energyAmount),
      serviceAmount: this.roundTo2Decimals(serviceAmount),
      totalAmount: this.roundTo2Decimals(energyAmount + serviceAmount),
      energySegments: energyDetails,
      serviceSegments: serviceDetails,
    };
  }

  private calculateSegmentDetails(
    segments: BillingSegment[],
    interruptionReason: InterruptionReason,
    segmentType: 'ENERGY' | 'SERVICE'
  ): RefundSegmentDetail[] {
    return segments.map(segment => {
      const policyPercentage = this.policy.getRefundPercentage(interruptionReason, segmentType);
      const effectivePercentage = segment.isRefundable ? policyPercentage : 0;
      const finalPercentage = Math.min(effectivePercentage, segment.refundPercentage);

      const refundAmount = (segment.amount * finalPercentage) / 100;

      let reason = '';
      if (!segment.isRefundable) {
        reason = '计费片段标记为不可退款';
      } else if (finalPercentage === 0) {
        reason = '中断原因不支持退款';
      } else if (finalPercentage < policyPercentage) {
        reason = `计费片段限制退款比例至 ${finalPercentage}%`;
      } else {
        reason = `按中断原因政策退款 ${finalPercentage}%`;
      }

      return {
        segmentId: segment.id,
        originalAmount: segment.amount,
        refundPercentage: finalPercentage,
        refundAmount: this.roundTo2Decimals(refundAmount),
        reason,
      };
    });
  }

  private roundTo2Decimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  isTotalAmountValid(calculation: RefundCalculation): boolean {
    if (calculation.totalAmount < 0) return false;
    if (calculation.energyAmount < 0 || calculation.serviceAmount < 0) return false;
    
    const segmentTotal = 
      calculation.energySegments.reduce((sum, s) => sum + s.refundAmount, 0) +
      calculation.serviceSegments.reduce((sum, s) => sum + s.refundAmount, 0);
    
    return Math.abs(calculation.totalAmount - segmentTotal) < 0.01;
  }

  hasRefundAmount(calculation: RefundCalculation): boolean {
    return calculation.totalAmount > 0;
  }
}
