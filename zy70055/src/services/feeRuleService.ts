import { prisma } from '../config';
import { FeeType } from '../constants';
import { ValidationError, ResourceNotFoundError } from '../utils/error';
import { logger } from '../utils/logger';

export interface CalculateFeeResult {
  feeAmount: number;
  ruleId: string;
  ruleName: string;
  feeType: string;
  breakdown: any;
}

interface TierConfig {
  tiers: Array<{ min: number; max: number | null; rate: number }>;
}

class FeeRuleService {
  async createRule(data: {
    name: string;
    feeType: string;
    value: number;
    minFee: number;
    maxFee?: number;
    tierConfig?: TierConfig;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    this.validateFeeData(data);

    if (data.feeType === FeeType.TIERED && !data.tierConfig) {
      throw new ValidationError('阶梯费率需要提供 tierConfig 配置');
    }

    const rule = await prisma.feeRule.create({
      data: {
        name: data.name,
        feeType: data.feeType,
        value: data.value,
        minFee: data.minFee,
        maxFee: data.maxFee,
        tierConfig: data.tierConfig ? JSON.stringify(data.tierConfig) : null,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
      },
    });

    logger.info(`创建手续费规则: ${rule.id} - ${rule.name}`);
    return rule;
  }

  async getActiveRules() {
    const now = new Date();
    return prisma.feeRule.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRuleById(id: string) {
    const rule = await prisma.feeRule.findUnique({ where: { id } });
    if (!rule) {
      throw new ResourceNotFoundError(`手续费规则不存在: ${id}`);
    }
    return rule;
  }

  async assignRuleToMerchant(merchantId: string, ruleId: string, operator: string) {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      throw new ResourceNotFoundError(`商户不存在: ${merchantId}`);
    }

    const rule = await this.getRuleById(ruleId);
    if (!rule.isActive) {
      throw new ValidationError('手续费规则未激活');
    }

    const updated = await prisma.merchant.update({
      where: { id: merchantId },
      data: { feeRuleId: ruleId },
    });

    logger.info(`[${operator}] 商户 ${merchant.merchantNo} 绑定手续费规则 ${rule.name}`);
    return updated;
  }

  async calculateFee(amount: number, merchantId: string): Promise<CalculateFeeResult> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { feeRule: true },
    });

    if (!merchant) {
      throw new ResourceNotFoundError(`商户不存在: ${merchantId}`);
    }

    if (!merchant.feeRule) {
      throw new ValidationError(`商户 ${merchant.merchantNo} 未绑定手续费规则`);
    }

    const rule = merchant.feeRule;
    let feeAmount = 0;
    const breakdown: any = {};

    switch (rule.feeType) {
      case 'PERCENTAGE':
        feeAmount = amount * Number(rule.value) / 100;
        breakdown.percentageRate = rule.value;
        break;

      case 'FIXED':
        feeAmount = Number(rule.value);
        breakdown.fixedAmount = rule.value;
        break;

      case 'TIERED':
        if (!rule.tierConfig) {
          throw new ValidationError('阶梯费率配置缺失');
        }
        const config: TierConfig = JSON.parse(rule.tierConfig);
        feeAmount = this.calculateTieredFee(amount, config);
        breakdown.tierConfig = config;
        break;
    }

    if (feeAmount < Number(rule.minFee)) {
      feeAmount = Number(rule.minFee);
      breakdown.appliedMinFee = true;
    }

    if (rule.maxFee && feeAmount > Number(rule.maxFee)) {
      feeAmount = Number(rule.maxFee);
      breakdown.appliedMaxFee = true;
    }

    breakdown.originalFee = feeAmount;
    breakdown.finalFee = feeAmount;

    return {
      feeAmount: Math.round(feeAmount * 10000) / 10000,
      ruleId: rule.id,
      ruleName: rule.name,
      feeType: rule.feeType,
      breakdown,
    };
  }

  private calculateTieredFee(amount: number, config: TierConfig): number {
    let remaining = amount;
    let fee = 0;

    for (const tier of config.tiers.sort((a, b) => a.min - b.min)) {
      if (remaining <= 0) break;

      const tierMax = tier.max ?? Infinity;
      const tierAmount = Math.min(remaining, tierMax - tier.min);
      
      if (tierAmount > 0) {
        fee += tierAmount * (tier.rate / 100);
        remaining -= tierAmount;
      }
    }

    return fee;
  }

  async validateBatchFees(batchId: string) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: {
        merchant: { include: { feeRule: true } },
        transactions: true,
      },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    const expectedFeeResult = await this.calculateFee(
      Number(batch.totalAmount),
      batch.merchantId
    );

    const actualFee = Number(batch.feeAmount);
    const tolerance = Math.abs(expectedFeeResult.feeAmount) * 0.001;

    const diff = Math.abs(actualFee - expectedFeeResult.feeAmount);
    const isMismatch = diff > tolerance;

    return {
      expectedFee: expectedFeeResult.feeAmount,
      actualFee,
      difference: diff,
      tolerance,
      isMismatch,
      breakdown: expectedFeeResult.breakdown,
      ruleName: expectedFeeResult.ruleName,
    };
  }

  private validateFeeData(data: any) {
    if (!data.name || data.name.trim() === '') {
      throw new ValidationError('规则名称不能为空');
    }
    if (!['PERCENTAGE', 'FIXED', 'TIERED'].includes(data.feeType)) {
      throw new ValidationError(`无效的费率类型: ${data.feeType}`);
    }
    if (data.minFee < 0) {
      throw new ValidationError('最低手续费不能为负数');
    }
    if (data.maxFee !== undefined && data.maxFee < data.minFee) {
      throw new ValidationError('最高手续费不能低于最低手续费');
    }
  }
}

export const feeRuleService = new FeeRuleService();
