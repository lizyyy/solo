import { ChargeRepository } from '../repositories/charge.repository';
import { ShareRepository } from '../repositories/share.repository';
import { RateService } from './rate.service';
import { PromotionService } from './promotion.service';
import { ChargeRecord, CustomerShare, RateVersion, PromotionPeriod } from '../../shared/types';

export class ChargeService {
  private chargeRepository: ChargeRepository;
  private shareRepository: ShareRepository;
  private rateService: RateService;
  private promotionService: PromotionService;

  constructor() {
    this.chargeRepository = new ChargeRepository();
    this.shareRepository = new ShareRepository();
    this.rateService = new RateService();
    this.promotionService = new PromotionService();
  }

  getAllCharges(): ChargeRecord[] {
    return this.chargeRepository.findAll();
  }

  getChargeById(id: string): ChargeRecord | null {
    return this.chargeRepository.findById(id);
  }

  getChargesByCustomerAndProduct(customerId: string, productId: string): ChargeRecord[] {
    return this.chargeRepository.findByCustomerAndProduct(customerId, productId);
  }

  recalculateCharge(
    charge: ChargeRecord,
    share: CustomerShare,
    rate: RateVersion,
    promotion: PromotionPeriod | null
  ): {
    expectedAmount: number;
    expectedRate: number;
    diffAmount: number;
    reasons: string[];
    details: {
      baseRate: number;
      managementFee: number;
      serviceFee: number;
      discountRate: number;
      finalRate: number;
      shareAmount: number;
    };
  } {
    const reasons: string[] = [];

    const baseRate = this.rateService.getTotalRate(rate);
    const managementFee = share.shareAmount * rate.managementFeeRate;
    const serviceFee = share.shareAmount * rate.serviceFeeRate;

    let finalRate = baseRate;
    let discountRate = 1.0;

    if (promotion) {
      discountRate = promotion.discountRate;
      finalRate = this.promotionService.calculateDiscountedRate(baseRate, promotion);
      reasons.push(`优惠期折扣：${(discountRate * 10).toFixed(1)}折，原费率${(baseRate * 100).toFixed(2)}% → 优惠后${(finalRate * 100).toFixed(2)}%`);
    } else {
      reasons.push('无适用优惠期，按基准费率计算');
    }

    const expectedAmount = share.shareAmount * finalRate;
    const diffAmount = charge.chargedAmount - expectedAmount;

    if (Math.abs(diffAmount) > 0.01) {
      if (diffAmount > 0) {
        reasons.push(`多扣费：实际扣费¥${charge.chargedAmount.toFixed(2)}，应扣¥${expectedAmount.toFixed(2)}，多扣¥${diffAmount.toFixed(2)}`);
      } else {
        reasons.push(`少扣费：实际扣费¥${charge.chargedAmount.toFixed(2)}，应扣¥${expectedAmount.toFixed(2)}，少扣¥${Math.abs(diffAmount).toFixed(2)}`);
      }
    } else {
      reasons.push(`扣费金额正确：实际扣费¥${charge.chargedAmount.toFixed(2)}，应扣¥${expectedAmount.toFixed(2)}`);
    }

    if (Math.abs(charge.appliedRate - finalRate) > 0.0001) {
      reasons.push(`费率应用错误：实际应用费率${(charge.appliedRate * 100).toFixed(2)}%，正确费率${(finalRate * 100).toFixed(2)}%`);
    }

    return {
      expectedAmount,
      expectedRate: finalRate,
      diffAmount,
      reasons,
      details: {
        baseRate,
        managementFee,
        serviceFee,
        discountRate,
        finalRate,
        shareAmount: share.shareAmount,
      },
    };
  }

  verifyChargeMatch(
    charge: ChargeRecord,
    expectedRateId: string,
    expectedPromotionId: string | null
  ): { matched: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (charge.rateVersionId !== expectedRateId) {
      reasons.push(`费率版本不匹配：实际使用${charge.rateVersionId}，应使用${expectedRateId}`);
    } else {
      reasons.push('费率版本匹配正确');
    }

    if (expectedPromotionId && charge.promotionId !== expectedPromotionId) {
      reasons.push(`优惠期未应用：应使用${expectedPromotionId}，但实际${charge.promotionId ? `使用了${charge.promotionId}` : '未使用'}`);
    } else if (!expectedPromotionId && charge.promotionId) {
      reasons.push(`优惠期误用：不应使用优惠期，但实际使用了${charge.promotionId}`);
    } else {
      reasons.push('优惠期应用正确');
    }

    const matched = reasons.every(r => r.includes('正确'));
    return { matched, reasons };
  }
}
