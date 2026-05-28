import { PromotionRepository } from '../repositories/promotion.repository';
import { PromotionPeriod } from '../../shared/types';

export class PromotionService {
  private promotionRepository: PromotionRepository;

  constructor() {
    this.promotionRepository = new PromotionRepository();
  }

  getAllPromotions(): PromotionPeriod[] {
    return this.promotionRepository.findAll();
  }

  getPromotionsByProduct(productId: string): PromotionPeriod[] {
    return this.promotionRepository.findByProductId(productId);
  }

  getPromotionById(id: string): PromotionPeriod | null {
    return this.promotionRepository.findById(id);
  }

  checkPromotionEligibility(
    productId: string,
    customerId: string,
    chargeDate: string
  ): { promotion: PromotionPeriod | null; reasons: string[] } {
    const reasons: string[] = [];

    const applicablePromotion = this.promotionRepository.findApplicablePromotion(
      productId,
      customerId,
      chargeDate
    );

    if (!applicablePromotion) {
      reasons.push(`扣费日期${chargeDate}无可用优惠期`);
      return { promotion: null, reasons };
    }

    const isInRange = this.promotionRepository.isDateInPromotion(applicablePromotion, chargeDate);
    if (!isInRange) {
      reasons.push(`扣费日期${chargeDate}不在优惠期${applicablePromotion.startDate}至${applicablePromotion.endDate}范围内`);
      return { promotion: null, reasons };
    }

    const isCrossMonth = this.isCrossMonthPromotion(applicablePromotion);
    if (isCrossMonth) {
      reasons.push(`优惠期${applicablePromotion.name}跨月（${applicablePromotion.startDate}至${applicablePromotion.endDate}），需特别注意跨月计算逻辑`);

      const chargeMonth = chargeDate.substring(0, 7);
      const startMonth = applicablePromotion.startDate.substring(0, 7);
      const endMonth = applicablePromotion.endDate.substring(0, 7);

      if (chargeMonth !== startMonth && chargeMonth !== endMonth) {
        reasons.push(`警告：扣费月份${chargeMonth}既不在优惠开始月${startMonth}也不在结束月${endMonth}，可能存在跨月计算错误`);
      }
    }

    reasons.push(`适用优惠期：${applicablePromotion.name}（${applicablePromotion.startDate}至${applicablePromotion.endDate}），折扣率${(applicablePromotion.discountRate * 10).toFixed(1)}折`);
    return { promotion: applicablePromotion, reasons };
  }

  isCrossMonthPromotion(promotion: PromotionPeriod): boolean {
    const startMonth = promotion.startDate.substring(0, 7);
    const endMonth = promotion.endDate.substring(0, 7);
    return startMonth !== endMonth;
  }

  calculateDiscountedRate(baseRate: number, promotion: PromotionPeriod): number {
    return baseRate * promotion.discountRate;
  }
}
