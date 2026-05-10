import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  ReplayResult,
  ReplayState,
  GiftRecommendation,
  ConflictDetail,
  DiffReport,
} from '../types';
import { RuleMatcher } from './RuleMatcher';
import { InventoryManager } from './InventoryManager';

export class ReplayEngine {
  private ruleMatcher: RuleMatcher;
  private inventoryManager: InventoryManager;
  private replayId: string;
  private results: Map<string, ReplayResult> = new Map();
  private originalOrderAmounts: Map<string, number> = new Map();

  constructor(ruleMatcher: RuleMatcher, inventoryManager: InventoryManager) {
    this.ruleMatcher = ruleMatcher;
    this.inventoryManager = inventoryManager;
    this.replayId = uuidv4();
  }

  public getReplayId(): string {
    return this.replayId;
  }

  public replayOrder(order: Order, originalAmount?: number): ReplayResult {
    this.originalOrderAmounts.set(order.orderId, order.totalAmount);

    const matchedRules = this.ruleMatcher.findRulesForOrder(order);
    const recommendations: GiftRecommendation[] = [];
    const conflicts: ConflictDetail[] = [];

    if (originalAmount !== undefined && originalAmount !== order.totalAmount) {
      conflicts.push({
        type: 'amount_changed',
        severity: 'warning',
        message: '订单金额已修改',
        details: {
          originalAmount,
          currentAmount: order.totalAmount,
          diff: order.totalAmount - originalAmount,
        },
      });
    }

    if (matchedRules.length > 1) {
      const ruleNames = matchedRules.map((r) => `${r.ruleName}(${r.ruleId})`).join(', ');
      conflicts.push({
        type: 'rule_overlap',
        severity: 'info',
        message: `存在 ${matchedRules.length} 条重叠规则: ${ruleNames}`,
        details: {
          matchedRules: matchedRules.map((r) => ({
            ruleId: r.ruleId,
            ruleName: r.ruleName,
            priority: r.priority,
            matchReason: r.matchReason,
          })),
        },
      });
    }

    if (this.inventoryManager.isOrderAlreadyGranted(order.orderId)) {
      const existingGrants = this.inventoryManager.getGrantsByOrder(order.orderId);
      for (const grant of existingGrants) {
        recommendations.push({
          giftSku: grant.giftSku,
          giftName: grant.giftName,
          quantity: grant.quantity,
          sourceRuleId: grant.ruleId,
          status: 'denied',
          reason: `订单 ${order.orderId} 已在回放 ${grant.replayId} 中领取过该赠品`,
        });
      }
      conflicts.push({
        type: 'already_granted',
        severity: 'warning',
        message: `订单 ${order.orderId} 已在之前的回放中领取赠品`,
        details: {
          existingGrants: existingGrants.map((g) => ({
            giftSku: g.giftSku,
            giftName: g.giftName,
            quantity: g.quantity,
            replayId: g.replayId,
            grantedAt: g.grantedAt,
          })),
        },
      });
    }

    const processedGifts = new Set<string>();
    for (const matchedRule of matchedRules) {
      const rule = this.ruleMatcher.getRuleById(matchedRule.ruleId);
      if (!rule) continue;

      for (const gift of rule.gifts) {
        const giftKey = `${gift.giftSku}-${matchedRule.ruleId}`;
        if (processedGifts.has(giftKey)) continue;
        processedGifts.add(giftKey);

        if (this.inventoryManager.isOrderAlreadyGranted(order.orderId, gift.giftSku)) {
          continue;
        }

        const reservation = this.inventoryManager.canReserve(gift.giftSku, gift.quantity);
        if (reservation.can) {
          recommendations.push({
            giftSku: gift.giftSku,
            giftName: gift.giftName,
            quantity: gift.quantity,
            sourceRuleId: matchedRule.ruleId,
            status: 'pending',
            reason: `匹配规则 ${matchedRule.ruleName} (优先级 ${matchedRule.priority}): ${matchedRule.matchReason}`,
          });
        } else {
          recommendations.push({
            giftSku: gift.giftSku,
            giftName: gift.giftName,
            quantity: gift.quantity,
            sourceRuleId: matchedRule.ruleId,
            status: 'denied',
            reason: reservation.reason,
          });
          conflicts.push({
            type: 'insufficient_inventory',
            severity: 'error',
            message: `赠品库存不足: ${gift.giftName} (${gift.giftSku})`,
            details: {
              giftSku: gift.giftSku,
              giftName: gift.giftName,
              requestedQuantity: gift.quantity,
              availableQuantity: this.inventoryManager.getAvailableQuantity(gift.giftSku),
              totalQuantity: this.inventoryManager.getTotalQuantity(gift.giftSku),
            },
          });
        }
      }
    }

    const explanation = this.buildExplanation(order, matchedRules, recommendations, conflicts);

    const result: ReplayResult = {
      orderId: order.orderId,
      orderCreateTime: order.createTime,
      matchedRules,
      recommendedGifts: recommendations,
      conflicts,
      explanation,
    };

    this.results.set(order.orderId, result);
    return result;
  }

  public replayOrders(orders: Order[]): ReplayResult[] {
    const sortedOrders = [...orders].sort((a, b) => {
      return a.createTime.localeCompare(b.createTime);
    });

    return sortedOrders.map((order) => this.replayOrder(order));
  }

  public confirmReservation(orderId: string, giftSku: string, quantity: number, ruleId: string): boolean {
    return this.inventoryManager.reserveGift(
      giftSku,
      quantity,
      orderId,
      ruleId,
      this.replayId
    ).success;
  }

  public confirmAllReservations(): { confirmed: number; failed: number } {
    let confirmed = 0;
    let failed = 0;

    for (const [orderId, result] of this.results.entries()) {
      for (const recommendation of result.recommendedGifts) {
        if (recommendation.status === 'pending') {
          const success = this.confirmReservation(
            orderId,
            recommendation.giftSku,
            recommendation.quantity,
            recommendation.sourceRuleId
          );
          if (success) {
            recommendation.status = 'granted';
            confirmed++;
          } else {
            recommendation.status = 'denied';
            failed++;
          }
        }
      }
    }

    return { confirmed, failed };
  }

  public getDiff(order: Order): DiffReport {
    const result = this.results.get(order.orderId);
    if (!result) {
      return {
        orderId: order.orderId,
        orderCreateTime: order.createTime,
        expectedGifts: [],
        actualGifts: order.actualGifts || [],
        diffType: 'match',
        diffDetails: '该订单未进行回放',
      };
    }

    const actualGifts = order.actualGifts || [];
    const expectedGifts = result.recommendedGifts.filter((g) => g.status === 'granted' || g.status === 'pending');

    const actualMap = new Map<string, number>();
    for (const gift of actualGifts) {
      actualMap.set(gift.giftSku, (actualMap.get(gift.giftSku) || 0) + gift.quantity);
    }

    const expectedMap = new Map<string, number>();
    for (const gift of expectedGifts) {
      expectedMap.set(gift.giftSku, (expectedMap.get(gift.giftSku) || 0) + gift.quantity);
    }

    const diffs: string[] = [];
    let diffType: DiffReport['diffType'] = 'match';

    for (const [sku, expectedQty] of expectedMap.entries()) {
      const actualQty = actualMap.get(sku) || 0;
      if (actualQty === 0) {
        diffs.push(`缺少赠品: ${sku} (期望 ${expectedQty} 个, 实际 0 个)`);
        diffType = 'missing';
      } else if (actualQty !== expectedQty) {
        diffs.push(`赠品数量不符: ${sku} (期望 ${expectedQty} 个, 实际 ${actualQty} 个)`);
        diffType = 'quantity_mismatch';
      }
    }

    for (const [sku, actualQty] of actualMap.entries()) {
      const expectedQty = expectedMap.get(sku) || 0;
      if (expectedQty === 0) {
        diffs.push(`多余赠品: ${sku} (期望 0 个, 实际 ${actualQty} 个)`);
        diffType = 'extra';
      }
    }

    return {
      orderId: order.orderId,
      orderCreateTime: order.createTime,
      expectedGifts,
      actualGifts,
      diffType,
      diffDetails: diffs.length > 0 ? diffs.join('; ') : '赠品完全匹配',
    };
  }

  public getReplayState(): ReplayState {
    return {
      lastReplayTime: new Date().toISOString(),
      processedOrders: Array.from(this.results.keys()),
      inventorySnapshot: this.inventoryManager.getInventorySnapshot(),
      grants: this.inventoryManager.getAllGrants(),
    };
  }

  public getResults(): ReplayResult[] {
    return Array.from(this.results.values());
  }

  public getInventoryManager(): InventoryManager {
    return this.inventoryManager;
  }

  private buildExplanation(
    order: Order,
    matchedRules: any[],
    recommendations: GiftRecommendation[],
    conflicts: ConflictDetail[]
  ): string {
    const lines: string[] = [];
    lines.push(`=== 订单 ${order.orderId} 赠品判定说明 ===`);
    lines.push(`订单时间: ${order.createTime}`);
    lines.push(`订单金额: ¥${order.totalAmount}`);
    lines.push(`商品品类: ${[...new Set(order.items.map((i) => i.category))].join(', ')}`);
    lines.push('');

    if (matchedRules.length === 0) {
      lines.push('✗ 未匹配到任何赠品规则');
      lines.push('  原因: 订单金额或商品品类不满足任何规则条件');
    } else {
      lines.push(`✓ 匹配到 ${matchedRules.length} 条规则:`);
      for (const rule of matchedRules) {
        lines.push(`  - ${rule.ruleName} (优先级 ${rule.priority}): ${rule.matchReason}`);
      }
    }

    lines.push('');
    if (recommendations.length > 0) {
      lines.push('赠品建议:');
      for (const rec of recommendations) {
        const statusEmoji = rec.status === 'granted' ? '✓' : rec.status === 'pending' ? '⏳' : '✗';
        lines.push(`  ${statusEmoji} ${rec.giftName} x${rec.quantity}`);
        lines.push(`    原因: ${rec.reason}`);
      }
    }

    if (conflicts.length > 0) {
      lines.push('');
      lines.push('冲突/警告:');
      for (const conflict of conflicts) {
        const severityEmoji =
          conflict.severity === 'error' ? '❌' : conflict.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`  ${severityEmoji} [${conflict.type}] ${conflict.message}`);
      }
    }

    return lines.join('\n');
  }
}
