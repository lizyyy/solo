import { 
  Order, 
  Refund, 
  Party, 
  RuleVersion, 
  SettlementResult, 
  SettlementDetail, 
  Anomaly,
  SettlementSummary,
  OrderDifference,
  SimulationResult,
  ExplainDetail,
  CannotSettleOrder
} from './types';
import { DataLoader } from './data-loader';

export class SettlementEngine {
  private dataLoader: DataLoader;

  constructor(dataLoader: DataLoader) {
    this.dataLoader = dataLoader;
  }

  calculateSettlement(
    order: Order, 
    rules: RuleVersion[], 
    refunds: Refund[]
  ): SettlementResult {
    const anomalies: Anomaly[] = [];
    const config = this.dataLoader.getConfig();

    const rule = this.getRuleForDate(order.settlementDate, rules);
    
    if (!rule) {
      anomalies.push({
        type: 'missing_rule',
        severity: 'error',
        message: '订单 ' + order.id + ' 在结算日期 ' + order.settlementDate + ' 没有匹配的规则版本',
        affectedParties: ['platform', 'merchant', 'talent', 'serviceProvider']
      });

      return {
        orderId: order.id,
        ruleVersion: 'unknown',
        settlementDate: order.settlementDate,
        totalAmount: order.amount,
        refundAmount: 0,
        netAmount: order.amount,
        details: [],
        anomalies,
        isSettlementPossible: false
      };
    }

    const totalRefundAmount = this.calculateTotalRefundAmount(order, refunds, rule);
    const netAmount = order.amount - totalRefundAmount;

    const details: SettlementDetail[] = [];

    const platformParty = this.dataLoader.getParty(config.defaultPartyIds.platform);
    if (platformParty) {
      details.push(this.calculatePartySettlement(
        order, 'platform', platformParty, rule, totalRefundAmount
      ));
    }

    const merchantParty = this.dataLoader.getParty(order.merchantId);
    if (merchantParty) {
      details.push(this.calculatePartySettlement(
        order, 'merchant', merchantParty, rule, totalRefundAmount
      ));
    }

    if (order.talentId) {
      const talentParty = this.dataLoader.getParty(order.talentId);
      if (talentParty) {
        details.push(this.calculatePartySettlement(
          order, 'talent', talentParty, rule, totalRefundAmount
        ));
      } else {
        anomalies.push({
          type: 'missing_talent',
          severity: 'warning',
          message: '订单 ' + order.id + ' 缺少达人信息，达人分润金额将归属平台或商家',
          affectedParties: [order.talentId || '']
        });
      }
    }

    if (order.serviceProviderId) {
      const spParty = this.dataLoader.getParty(order.serviceProviderId);
      if (spParty) {
        details.push(this.calculatePartySettlement(
          order, 'serviceProvider', spParty, rule, totalRefundAmount
        ));
      } else {
        anomalies.push({
          type: 'missing_service_provider',
          severity: 'warning',
          message: '订单 ' + order.id + ' 缺少服务商信息，服务商分润金额将归属平台或商家',
          affectedParties: [order.serviceProviderId]
        });
      }
    } else if (config.defaultPartyIds.defaultServiceProvider) {
      const spParty = this.dataLoader.getParty(config.defaultPartyIds.defaultServiceProvider);
      if (spParty) {
        details.push(this.calculatePartySettlement(
          order, 'serviceProvider', spParty, rule, totalRefundAmount
        ));
      }
    }

    return {
      orderId: order.id,
      ruleVersion: rule.version,
      settlementDate: order.settlementDate,
      totalAmount: order.amount,
      refundAmount: totalRefundAmount,
      netAmount,
      details,
      anomalies,
      isSettlementPossible: true
    };
  }

  private getRuleForDate(date: string, rules: RuleVersion[]): RuleVersion | undefined {
    const targetDate = new Date(date).getTime();
    
    return rules.find(rule => {
      const startDate = new Date(rule.effectiveStartDate).getTime();
      const endDate = rule.effectiveEndDate 
        ? new Date(rule.effectiveEndDate).getTime() 
        : Infinity;
      
      return targetDate >= startDate && targetDate <= endDate;
    });
  }

  private calculateTotalRefundAmount(
    order: Order, 
    refunds: Refund[], 
    rule: RuleVersion
  ): number {
    if (refunds.length === 0) return 0;

    const sortedRefunds = [...refunds].sort((a, b) => 
      new Date(a.refundDate).getTime() - new Date(b.refundDate).getTime()
    );

    let totalRefund = 0;

    switch (rule.refundDeductionPolicy) {
      case 'proportionate':
        return sortedRefunds.reduce((sum, r) => sum + r.refundAmount, 0);
      case 'last_in_first_out':
        for (const refund of sortedRefunds.reverse()) {
          if (totalRefund + refund.refundAmount <= order.amount) {
            totalRefund += refund.refundAmount;
          } else {
            totalRefund = order.amount;
            break;
          }
        }
        break;
      case 'first_in_first_out':
        for (const refund of sortedRefunds) {
          if (totalRefund + refund.refundAmount <= order.amount) {
            totalRefund += refund.refundAmount;
          } else {
            totalRefund = order.amount;
            break;
          }
        }
        break;
    }

    return Math.min(totalRefund, order.amount);
  }

  private calculatePartySettlement(
    order: Order,
    partyType: 'platform' | 'merchant' | 'talent' | 'serviceProvider',
    party: Party,
    rule: RuleVersion,
    totalRefundAmount: number
  ): SettlementDetail {
    let rate: number;
    let minGuarantee: number | undefined;

    switch (partyType) {
      case 'platform':
        rate = rule.platformFeeRate;
        break;
      case 'merchant':
        rate = rule.merchantSplitRate;
        break;
      case 'talent':
        rate = rule.talentCommissionRate;
        minGuarantee = rule.talentMinimumGuarantee;
        break;
      case 'serviceProvider':
        rate = rule.serviceProviderSplitRate;
        minGuarantee = rule.serviceProviderMinimumGuarantee;
        break;
    }

    const baseAmount = order.amount - totalRefundAmount;
    const calculatedAmount = baseAmount * rate;
    const refundDeduction = totalRefundAmount * rate;
    
    let finalAmount = calculatedAmount;
    let guaranteeApplied = false;

    if (minGuarantee !== undefined && calculatedAmount < minGuarantee) {
      finalAmount = minGuarantee;
      guaranteeApplied = true;
    }

    return {
      partyId: party.id,
      partyType,
      partyName: party.name,
      baseAmount,
      rate,
      calculatedAmount,
      guaranteeApplied,
      guaranteeAmount: guaranteeApplied ? minGuarantee : undefined,
      finalAmount,
      refundDeduction,
      ruleVersion: rule.version
    };
  }

  simulateAll(rulesType: 'old' | 'new'): SettlementResult[] {
    const config = this.dataLoader.getConfig();
    const rules = rulesType === 'old' ? config.oldRules : config.newRules;
    const orders = this.dataLoader.getAllOrders();
    
    return orders.map(order => {
      const refunds = this.dataLoader.getRefundsForOrder(order.id);
      return this.calculateSettlement(order, rules, refunds);
    });
  }

  calculateDifferences(): SimulationResult {
    const oldResults = this.simulateAll('old');
    const newResults = this.simulateAll('new');
    const config = this.dataLoader.getConfig();

    const orderDifferences: OrderDifference[] = [];
    const cannotSettleOrders: CannotSettleOrder[] = [];

    oldResults.forEach((oldResult, index) => {
      const newResult = newResults[index];
      
      if (!oldResult.isSettlementPossible || !newResult.isSettlementPossible) {
        cannotSettleOrders.push({
          orderId: oldResult.orderId,
          reason: '无法自动结算',
          anomalies: [...oldResult.anomalies, ...newResult.anomalies]
        });
        return;
      }

      const order = this.dataLoader.getOrder(oldResult.orderId);
      if (!order) return;

      const getAmount = (details: SettlementDetail[]) => {
        const platform = details.find(d => d.partyType === 'platform');
        const merchant = details.find(d => d.partyType === 'merchant');
        const talent = details.find(d => d.partyType === 'talent');
        const serviceProvider = details.find(d => d.partyType === 'serviceProvider');

        return {
          platform: platform?.finalAmount || 0,
          merchant: merchant?.finalAmount || 0,
          talent: talent?.finalAmount || 0,
          serviceProvider: serviceProvider?.finalAmount || 0
        };
      };

      const oldAmounts = getAmount(oldResult.details);
      const newAmounts = getAmount(newResult.details);

      const platformDiff = newAmounts.platform - oldAmounts.platform;
      const merchantDiff = newAmounts.merchant - oldAmounts.merchant;
      const talentDiff = newAmounts.talent - oldAmounts.talent;
      const serviceProviderDiff = newAmounts.serviceProvider - oldAmounts.serviceProvider;
      const totalDiff = platformDiff + merchantDiff + talentDiff + serviceProviderDiff;

      const diffPercentage = oldResult.netAmount > 0 
        ? (totalDiff / oldResult.netAmount) * 100 
        : 0;

      const hasGuaranteeChange = 
        oldResult.details.some(d => d.guaranteeApplied) !== 
        newResult.details.some(d => d.guaranteeApplied);

      const hasRuleVersionChange = oldResult.ruleVersion !== newResult.ruleVersion;

      const allAnomalies = [...oldResult.anomalies, ...newResult.anomalies];

      orderDifferences.push({
        orderId: oldResult.orderId,
        orderAmount: order.amount,
        refundAmount: oldResult.refundAmount,
        oldRuleVersion: oldResult.ruleVersion,
        newRuleVersion: newResult.ruleVersion,
        platformDiff,
        merchantDiff,
        talentDiff,
        serviceProviderDiff,
        totalDiff,
        diffPercentage,
        hasGuaranteeChange,
        hasRuleVersionChange,
        anomalies: allAnomalies
      });
    });

    const oldSummary = this.calculateSummary(oldResults);
    const newSummary = this.calculateSummary(newResults);

    const totalOrders = this.dataLoader.getAllOrders().length;
    const totalAmount = this.dataLoader.getAllOrders().reduce((sum, o) => sum + o.amount, 0);
    const totalRefundAmount = oldResults.reduce((sum, r) => sum + r.refundAmount, 0);

    const allAnomaliesList = [
      ...this.dataLoader.getAnomalies(),
      ...oldResults.flatMap(r => r.anomalies),
      ...newResults.flatMap(r => r.anomalies)
    ];

    return {
      timestamp: new Date().toISOString(),
      configVersion: '1.0.0',
      totalOrders,
      totalAmount,
      totalRefundAmount,
      oldSettlementSummary: oldSummary,
      newSettlementSummary: newSummary,
      differences: orderDifferences,
      anomalies: allAnomaliesList,
      cannotSettleOrders
    };
  }

  private calculateSummary(results: SettlementResult[]): SettlementSummary {
    const summary: SettlementSummary = {
      ruleVersions: [],
      platformTotal: 0,
      merchantTotal: 0,
      talentTotal: 0,
      serviceProviderTotal: 0,
      grandTotal: 0,
      ordersCount: results.length,
      anomalyCount: 0
    };

    const ruleVersionSet = new Set<string>();

    results.forEach(result => {
      ruleVersionSet.add(result.ruleVersion);
      summary.anomalyCount += result.anomalies.length;

      result.details.forEach(detail => {
        switch (detail.partyType) {
          case 'platform':
            summary.platformTotal += detail.finalAmount;
            break;
          case 'merchant':
            summary.merchantTotal += detail.finalAmount;
            break;
          case 'talent':
            summary.talentTotal += detail.finalAmount;
            break;
          case 'serviceProvider':
            summary.serviceProviderTotal += detail.finalAmount;
            break;
        }
        summary.grandTotal += detail.finalAmount;
      });
    });

    summary.ruleVersions = Array.from(ruleVersionSet);
    return summary;
  }

  explainOrder(orderId: string): ExplainDetail | null {
    const order = this.dataLoader.getOrder(orderId);
    if (!order) return null;

    const config = this.dataLoader.getConfig();
    const refunds = this.dataLoader.getRefundsForOrder(orderId);

    const oldResult = this.calculateSettlement(order, config.oldRules, refunds);
    const newResult = this.calculateSettlement(order, config.newRules, refunds);

    const comparison: ExplainDetail['comparison'] = [];
    const partyTypes = ['platform', 'merchant', 'talent', 'serviceProvider'] as const;

    partyTypes.forEach(partyType => {
      const oldDetail = oldResult.details.find(d => d.partyType === partyType);
      const newDetail = newResult.details.find(d => d.partyType === partyType);

      const oldAmount = oldDetail?.finalAmount || 0;
      const newAmount = newDetail?.finalAmount || 0;
      const diff = newAmount - oldAmount;
      const diffPercentage = oldAmount > 0 ? (diff / oldAmount) * 100 : 0;

      let reason = '';
      if (oldDetail?.guaranteeApplied || newDetail?.guaranteeApplied) {
        if (oldDetail?.guaranteeApplied && !newDetail?.guaranteeApplied) {
          reason = '保底金额应用';
        } else if (oldDetail?.guaranteeApplied) {
          reason = '旧规则应用保底，新规则未应用';
        } else {
          reason = '新规则应用保底';
        }
      } else if (oldDetail?.rate !== newDetail?.rate) {
        reason = '费率变化: ' + ((oldDetail?.rate || 0) * 100) + '% -> ' + ((newDetail?.rate || 0) * 100) + '%';
      } else if (oldResult.ruleVersion !== newResult.ruleVersion) {
        reason = '规则版本变化: ' + oldResult.ruleVersion + ' -> ' + newResult.ruleVersion;
      } else {
        reason = '无变化';
      }

      comparison.push({
        partyType,
        oldAmount,
        newAmount,
        diff,
        diffPercentage,
        reason
      });
    });

    return {
      orderId,
      orderDate: order.orderDate,
      settlementDate: order.settlementDate,
      orderAmount: order.amount,
      refundAmount: oldResult.refundAmount,
      netAmount: oldResult.netAmount,
      oldSettlement: oldResult,
      newSettlement: newResult,
      comparison,
      anomalies: [...oldResult.anomalies, ...newResult.anomalies]
    };
  }
}
