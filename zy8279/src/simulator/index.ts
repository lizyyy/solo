import { Order, SkuTag, ZoneCapacity, Rule, ConflictType, Conflict, OrderMatchTrace, ZoneUsage, SimulationResult, ValidationResult, ConflictCase } from '../types';
import { RuleEngine } from '../engine';

interface ZoneCapacityTracker {
  zoneId: string;
  zoneName: string;
  maxOrders: number;
  maxWeight: number;
  maxVolume: number;
  currentOrders: number;
  currentWeight: number;
  currentVolume: number;
  assignedOrders: string[];
  overflowOrders: string[];
}

export class Simulator {
  private engine: RuleEngine;
  private zones: Map<string, ZoneCapacityTracker> = new Map();
  private orderTraces: OrderMatchTrace[] = [];

  constructor() {
    this.engine = new RuleEngine();
  }

  loadData(orders: Order[], skuTags: SkuTag[], zones: ZoneCapacity[], rules: Rule[]): void {
    this.engine.loadData(orders, skuTags, zones, rules);

    this.zones.clear();
    for (const zone of zones) {
      this.zones.set(zone.zoneId, {
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        maxOrders: zone.maxOrders,
        maxWeight: zone.maxWeight,
        maxVolume: zone.maxVolume,
        currentOrders: 0,
        currentWeight: 0,
        currentVolume: 0,
        assignedOrders: [],
        overflowOrders: []
      });
    }
  }

  validateConfiguration(): ValidationResult {
    return this.engine.validateConfiguration();
  }

  runSimulation(): SimulationResult {
    this.orderTraces = this.engine.processAllOrders();

    const zones = this.engine.getZones();
    const orders = this.engine.getOrders();

    const zoneToOrderMap = new Map<string, string[]>();
    for (const trace of this.orderTraces) {
      if (trace.assignedZone) {
        if (!zoneToOrderMap.has(trace.assignedZone)) {
          zoneToOrderMap.set(trace.assignedZone, []);
        }
        zoneToOrderMap.get(trace.assignedZone)!.push(trace.orderId);
      }
    }

    for (const [zoneId, orderIds] of zoneToOrderMap) {
      const tracker = this.zones.get(zoneId);
      if (!tracker) continue;

      for (const orderId of orderIds) {
        const order = orders.find(o => o.orderId === orderId);
        if (!order) continue;

        const willOverflowOrder = tracker.currentOrders >= tracker.maxOrders;
        const willOverflowWeight = tracker.currentWeight + order.weight > tracker.maxWeight;
        const willOverflowVolume = tracker.currentVolume + order.volume > tracker.maxVolume;

        if (willOverflowOrder || willOverflowWeight || willOverflowVolume) {
          tracker.overflowOrders.push(orderId);

          const trace = this.orderTraces.find(t => t.orderId === orderId);
          if (trace) {
            const overflowReasons: string[] = [];
            if (willOverflowOrder) overflowReasons.push(`订单数达到上限 (${tracker.maxOrders})`);
            if (willOverflowWeight) overflowReasons.push(`重量超出上限 (当前: ${tracker.currentWeight.toFixed(1)}kg, +${order.weight}kg > ${tracker.maxWeight}kg)`);
            if (willOverflowVolume) overflowReasons.push(`体积超出上限 (当前: ${tracker.currentVolume.toFixed(2)}m³, +${order.volume}m³ > ${tracker.maxVolume}m³)`);

            trace.conflicts.push({
              type: ConflictType.CAPACITY_BOUNDARY,
              orderId: orderId,
              ruleIds: trace.matchedRules.map(r => r.ruleId),
              zoneIds: [zoneId],
              description: `区域 ${tracker.zoneName} 容量不足: ${overflowReasons.join('; ')}`,
              severity: 'high',
              resolvedBy: 'capacity_overflow',
              resolutionReason: '需人工分配到其他区域或等待下一波次'
            });
          }
        } else {
          tracker.currentOrders++;
          tracker.currentWeight += order.weight;
          tracker.currentVolume += order.volume;
          tracker.assignedOrders.push(orderId);
        }
      }
    }

    for (const trace of this.orderTraces) {
      if (trace.matchedRules.length === 0 && trace.finalDecision) {
        trace.conflicts.push({
          type: ConflictType.DEFAULT_FALLBACK,
          orderId: trace.orderId,
          ruleIds: [],
          zoneIds: trace.assignedZone ? [trace.assignedZone] : [],
          description: '订单未匹配任何规则，使用默认兜底分配',
          severity: 'low',
          resolvedBy: 'default_rule',
          resolutionReason: trace.finalDecision.reason
        });
      }
    }

    const zoneUsage: ZoneUsage[] = [];
    for (const tracker of this.zones.values()) {
      const orderPercentage = tracker.maxOrders > 0 ? (tracker.currentOrders / tracker.maxOrders) * 100 : 0;
      const weightPercentage = tracker.maxWeight > 0 ? (tracker.currentWeight / tracker.maxWeight) * 100 : 0;
      const volumePercentage = tracker.maxVolume > 0 ? (tracker.currentVolume / tracker.maxVolume) * 100 : 0;
      const maxPercentage = Math.max(orderPercentage, weightPercentage, volumePercentage);

      zoneUsage.push({
        zoneId: tracker.zoneId,
        ordersAssigned: tracker.currentOrders,
        weightUsed: tracker.currentWeight,
        volumeUsed: tracker.currentVolume,
        capacityPercentage: Math.round(maxPercentage * 100) / 100,
        isOverflow: tracker.overflowOrders.length > 0,
        overflowOrders: [...tracker.overflowOrders]
      });
    }

    const conflictCountByType: Record<ConflictType, number> = {
      [ConflictType.SAME_PRIORITY_MULTIPLE_RULES]: 0,
      [ConflictType.CAPACITY_BOUNDARY]: 0,
      [ConflictType.MUTUALLY_EXCLUSIVE_TAGS]: 0,
      [ConflictType.COLD_CHAIN_CONFLICT]: 0,
      [ConflictType.LARGE_ITEM_CONFLICT]: 0,
      [ConflictType.ZONE_EXCLUSION]: 0,
      [ConflictType.DEFAULT_FALLBACK]: 0
    };

    let ordersWithConflicts = 0;
    const ordersWithConflictsSet = new Set<string>();

    for (const trace of this.orderTraces) {
      for (const conflict of trace.conflicts) {
        conflictCountByType[conflict.type]++;
        ordersWithConflictsSet.add(trace.orderId);
      }
    }
    ordersWithConflicts = ordersWithConflictsSet.size;

    const validationResult = this.engine.validateConfiguration();

    return {
      totalOrders: this.orderTraces.length,
      ordersWithConflicts,
      conflictCountByType,
      orderTraces: this.orderTraces,
      zoneUsage,
      validationResult
    };
  }

  getConflictCases(simulationResult: SimulationResult): ConflictCase[] {
    const cases: ConflictCase[] = [];

    for (const trace of simulationResult.orderTraces) {
      if (trace.conflicts.length === 0) continue;

      for (const conflict of trace.conflicts) {
        cases.push({
          orderId: trace.orderId,
          conflictType: this.getConflictTypeName(conflict.type),
          rules: conflict.ruleIds.join(', ') || 'none',
          zones: conflict.zoneIds.join(', ') || 'none',
          description: conflict.description,
          severity: conflict.severity,
          resolvedBy: this.getResolvedByName(conflict.resolvedBy),
          resolutionReason: conflict.resolutionReason,
          finalZone: trace.finalDecision?.zoneId || 'none',
          finalRule: trace.finalDecision?.ruleId || 'none'
        });
      }
    }

    return cases;
  }

  private getConflictTypeName(type: ConflictType): string {
    const names: Record<ConflictType, string> = {
      [ConflictType.SAME_PRIORITY_MULTIPLE_RULES]: '同优先级多规则冲突',
      [ConflictType.CAPACITY_BOUNDARY]: '容量边界冲突',
      [ConflictType.MUTUALLY_EXCLUSIVE_TAGS]: '互斥标签冲突',
      [ConflictType.COLD_CHAIN_CONFLICT]: '冷链标签冲突',
      [ConflictType.LARGE_ITEM_CONFLICT]: '大件标签冲突',
      [ConflictType.ZONE_EXCLUSION]: '区域排除冲突',
      [ConflictType.DEFAULT_FALLBACK]: '默认兜底分配'
    };
    return names[type] || type;
  }

  private getResolvedByName(resolvedBy: string): string {
    const names: Record<string, string> = {
      'rule_selection': '规则选择',
      'capacity_overflow': '容量溢出',
      'exclusion_fallback': '排除回退',
      'default_rule': '默认规则'
    };
    return names[resolvedBy] || resolvedBy;
  }

  generateReport(simulationResult: SimulationResult): string {
    const lines: string[] = [];

    lines.push('# 波次规则优先级冲突分析报告');
    lines.push('');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 执行概览');
    lines.push('');
    lines.push(`- **总订单数**: ${simulationResult.totalOrders}`);
    lines.push(`- **存在冲突的订单数**: ${simulationResult.ordersWithConflicts}`);
    lines.push(`- **冲突率**: ${simulationResult.totalOrders > 0 ? ((simulationResult.ordersWithConflicts / simulationResult.totalOrders) * 100).toFixed(1) : 0}%`);
    lines.push('');

    lines.push('## 冲突类型统计');
    lines.push('');
    lines.push('| 冲突类型 | 数量 | 说明 |');
    lines.push('|----------|------|------|');

    for (const [type, count] of Object.entries(simulationResult.conflictCountByType)) {
      if (count > 0) {
        lines.push(`| ${this.getConflictTypeName(type as ConflictType)} | ${count} | ${this.getConflictTypeDescription(type as ConflictType)} |`);
      }
    }
    lines.push('');

    lines.push('## 区域容量使用情况');
    lines.push('');
    lines.push('| 区域ID | 已分配订单 | 订单上限 | 已用重量 | 重量上限 | 已用体积 | 体积上限 | 容量使用率 | 溢出订单 |');
    lines.push('|--------|-----------|---------|---------|---------|---------|---------|-----------|---------|');

    for (const usage of simulationResult.zoneUsage) {
      const overflow = usage.isOverflow ? usage.overflowOrders.join(', ') : '-';
      const percentage = usage.capacityPercentage > 100 ? `**${usage.capacityPercentage}%**` : `${usage.capacityPercentage}%`;
      lines.push(`| ${usage.zoneId} | ${usage.ordersAssigned} | ${this.zones.get(usage.zoneId)?.maxOrders || '-'} | ${usage.weightUsed.toFixed(1)}kg | ${this.zones.get(usage.zoneId)?.maxWeight || '-'}kg | ${usage.volumeUsed.toFixed(2)}m³ | ${this.zones.get(usage.zoneId)?.maxVolume || '-'}m³ | ${percentage} | ${overflow} |`);
    }
    lines.push('');

    lines.push('## 配置验证结果');
    lines.push('');
    const vr = simulationResult.validationResult;
    lines.push(`- **验证状态**: ${vr.valid ? '✅ 通过' : '❌ 失败'}`);
    lines.push(`- **错误数**: ${vr.errors.length}`);
    lines.push(`- **警告数**: ${vr.warnings.length}`);
    lines.push(`- **提示数**: ${vr.info.length}`);
    lines.push('');

    if (vr.errors.length > 0) {
      lines.push('### 错误');
      lines.push('');
      for (const e of vr.errors) {
        const ruleInfo = e.ruleId ? ` (规则: ${e.ruleId})` : '';
        const zoneInfo = e.zoneId ? ` (区域: ${e.zoneId})` : '';
        lines.push(`- ❌ [${e.field}]${ruleInfo}${zoneInfo}: ${e.message}`);
      }
      lines.push('');
    }

    if (vr.warnings.length > 0) {
      lines.push('### 警告');
      lines.push('');
      for (const w of vr.warnings) {
        const ruleInfo = w.ruleId ? ` (规则: ${w.ruleId})` : '';
        const zoneInfo = w.zoneId ? ` (区域: ${w.zoneId})` : '';
        lines.push(`- ⚠️ [${w.field}]${ruleInfo}${zoneInfo}: ${w.message}`);
      }
      lines.push('');
    }

    if (vr.info.length > 0) {
      lines.push('### 提示');
      lines.push('');
      for (const i of vr.info) {
        lines.push(`- ℹ️ [${i.field}]: ${i.message}`);
      }
      lines.push('');
    }

    lines.push('## 冲突订单详情');
    lines.push('');

    const ordersWithConflicts = simulationResult.orderTraces.filter(t => t.conflicts.length > 0);

    if (ordersWithConflicts.length === 0) {
      lines.push('*无冲突订单*');
      lines.push('');
    } else {
      for (const trace of ordersWithConflicts) {
        lines.push(`### 订单 ${trace.orderId}`);
        lines.push('');

        if (trace.matchedRules.length > 0) {
          lines.push('**匹配的规则**:');
          for (const rule of trace.matchedRules) {
            const matchInfo = rule.totalConditions > 0
              ? ` (${rule.matchedConditions}/${rule.totalConditions} 条件匹配)`
              : '';
            lines.push(`- \`${rule.ruleId}\` (优先级: ${rule.priority}) - ${rule.ruleName}${matchInfo}`);
          }
          lines.push('');
        }

        lines.push('**冲突详情**:');
        lines.push('');
        for (const conflict of trace.conflicts) {
          const severityIcon = conflict.severity === 'high' ? '🔴' : conflict.severity === 'medium' ? '🟡' : '🟢';
          lines.push(`${severityIcon} **${this.getConflictTypeName(conflict.type)}**`);
          lines.push(`  - 描述: ${conflict.description}`);
          lines.push(`  - 涉及规则: ${conflict.ruleIds.length > 0 ? conflict.ruleIds.join(', ') : '无'}`);
          lines.push(`  - 涉及区域: ${conflict.zoneIds.length > 0 ? conflict.zoneIds.join(', ') : '无'}`);
          lines.push(`  - 严重程度: ${conflict.severity === 'high' ? '高' : conflict.severity === 'medium' ? '中' : '低'}`);
          lines.push(`  - 裁决方式: ${this.getResolvedByName(conflict.resolvedBy)}`);
          lines.push(`  - 裁决原因: ${conflict.resolutionReason}`);
          lines.push('');
        }

        if (trace.finalDecision) {
          lines.push('**最终分配**:');
          lines.push(`- 规则: ${trace.finalDecision.ruleId}`);
          lines.push(`- 区域: ${trace.finalDecision.zoneId}`);
          lines.push(`- 原因: ${trace.finalDecision.reason}`);
          if (trace.waveLabel) {
            lines.push(`- 波次标签: ${trace.waveLabel}`);
          }
          lines.push('');
        }

        lines.push('---');
        lines.push('');
      }
    }

    lines.push('## 建议');
    lines.push('');

    const suggestions = this.generateSuggestions(simulationResult);
    if (suggestions.length === 0) {
      lines.push('*当前配置运行良好，无特别建议*');
    } else {
      for (const suggestion of suggestions) {
        lines.push(`- ${suggestion}`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }

  private getConflictTypeDescription(type: ConflictType): string {
    const descriptions: Record<ConflictType, string> = {
      [ConflictType.SAME_PRIORITY_MULTIPLE_RULES]: '同一优先级匹配了多条规则，可能导致分配不稳定',
      [ConflictType.CAPACITY_BOUNDARY]: '区域容量达到上限，订单无法正常分配',
      [ConflictType.MUTUALLY_EXCLUSIVE_TAGS]: '订单包含互斥标签，匹配了多条带互斥约束的规则',
      [ConflictType.COLD_CHAIN_CONFLICT]: '冷链商品缺少对应处理区域',
      [ConflictType.LARGE_ITEM_CONFLICT]: '大件商品缺少对应处理区域',
      [ConflictType.ZONE_EXCLUSION]: '所有可用区域均被排除',
      [ConflictType.DEFAULT_FALLBACK]: '订单未匹配任何规则，使用默认分配'
    };
    return descriptions[type] || '';
  }

  private generateSuggestions(simulationResult: SimulationResult): string[] {
    const suggestions: string[] = [];

    if (simulationResult.conflictCountByType[ConflictType.SAME_PRIORITY_MULTIPLE_RULES] > 0) {
      suggestions.push('**调整规则优先级**: 存在同优先级多规则冲突，建议为冲突规则设置不同的优先级，或合并逻辑相似的规则');
    }

    if (simulationResult.conflictCountByType[ConflictType.CAPACITY_BOUNDARY] > 0) {
      suggestions.push('**扩容或分流**: 存在容量边界冲突，建议：1) 增加高负载区域的容量上限；2) 增加更多分拣区域；3) 调整规则将部分订单分流到其他区域');
    }

    if (simulationResult.conflictCountByType[ConflictType.MUTUALLY_EXCLUSIVE_TAGS] > 0) {
      suggestions.push('**审查互斥标签规则**: 存在互斥标签冲突，建议检查带互斥标签的规则逻辑，确保同一订单不会同时触发多条互斥规则');
    }

    if (simulationResult.conflictCountByType[ConflictType.COLD_CHAIN_CONFLICT] > 0) {
      suggestions.push('**配置冷链区域**: 存在冷链标签冲突，建议配置支持冷链标签的分拣区域，或调整规则逻辑');
    }

    if (simulationResult.conflictCountByType[ConflictType.LARGE_ITEM_CONFLICT] > 0) {
      suggestions.push('**配置大件区域**: 存在大件标签冲突，建议配置支持大件标签的分拣区域，或调整大件商品的处理流程');
    }

    if (simulationResult.conflictCountByType[ConflictType.DEFAULT_FALLBACK] > 0) {
      suggestions.push('**完善规则覆盖**: 存在默认兜底分配，建议检查规则是否覆盖了所有业务场景，或调整规则条件以匹配更多订单');
    }

    const overflowZones = simulationResult.zoneUsage.filter(z => z.isOverflow);
    if (overflowZones.length > 0) {
      const zoneNames = overflowZones.map(z => z.zoneId).join(', ');
      suggestions.push(`**重点关注区域**: 区域 ${zoneNames} 存在订单溢出，建议优先扩容或分流这些区域`);
    }

    return suggestions;
  }

  getOrderTraces(): OrderMatchTrace[] {
    return [...this.orderTraces];
  }

  getZoneTrackers(): ZoneCapacityTracker[] {
    return Array.from(this.zones.values());
  }
}
