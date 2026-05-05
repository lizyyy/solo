import { Order, SkuTag, ZoneCapacity, Rule, Condition, Action, ConflictType, Conflict, OrderMatchTrace, ValidationError, ValidationResult } from '../types';

interface OrderWithTags extends Order {
  skuTags: string[];
}

export class RuleEngine {
  private orders: OrderWithTags[] = [];
  private skuTags: Map<string, string[]> = new Map();
  private zones: ZoneCapacity[] = [];
  private rules: Rule[] = [];

  constructor() {}

  loadData(orders: Order[], skuTags: SkuTag[], zones: ZoneCapacity[], rules: Rule[]): void {
    this.skuTags.clear();
    for (const tag of skuTags) {
      this.skuTags.set(tag.sku, tag.tags);
    }

    this.orders = orders.map(order => ({
      ...order,
      skuTags: this.skuTags.get(order.sku) || []
    }));

    this.zones = [...zones];
    this.rules = rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
  }

  validateConfiguration(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const info: ValidationError[] = [];

    if (this.zones.length === 0) {
      errors.push({
        type: 'error',
        field: 'zones',
        message: '没有配置任何分拣区域'
      });
    }

    if (this.rules.length === 0) {
      errors.push({
        type: 'error',
        field: 'rules',
        message: '没有配置任何规则'
      });
    }

    const defaultRules = this.rules.filter(r => r.isDefault);
    if (defaultRules.length === 0) {
      warnings.push({
        type: 'warning',
        field: 'rules',
        message: '没有配置默认兜底规则，未匹配任何规则的订单可能无法分配'
      });
    }

    const ruleIds = new Set<string>();
    for (const rule of this.rules) {
      if (ruleIds.has(rule.id)) {
        errors.push({
          type: 'error',
          field: 'rules',
          message: `重复的规则ID: ${rule.id}`,
          ruleId: rule.id
        });
      }
      ruleIds.add(rule.id);
    }

    const zoneIds = new Set<string>();
    for (const zone of this.zones) {
      if (zoneIds.has(zone.zoneId)) {
        errors.push({
          type: 'error',
          field: 'zones',
          message: `重复的区域ID: ${zone.zoneId}`,
          zoneId: zone.zoneId
        });
      }
      zoneIds.add(zone.zoneId);
    }

    for (const rule of this.rules) {
      for (const action of rule.actions) {
        if (action.type === 'assignZone' || action.type === 'excludeZone') {
          const targetZones = Array.isArray(action.value) ? action.value : [action.value];
          for (const zoneId of targetZones) {
            if (!zoneIds.has(String(zoneId))) {
              warnings.push({
                type: 'warning',
                field: 'rules',
                message: `规则 ${rule.id} 引用了不存在的区域: ${zoneId}`,
                ruleId: rule.id,
                zoneId: String(zoneId)
              });
            }
          }
        }
      }
    }

    const priorityGroups = new Map<number, Rule[]>();
    for (const rule of this.rules) {
      if (!priorityGroups.has(rule.priority)) {
        priorityGroups.set(rule.priority, []);
      }
      priorityGroups.get(rule.priority)!.push(rule);
    }

    for (const [priority, rulesAtPriority] of priorityGroups) {
      if (rulesAtPriority.length > 1) {
        info.push({
          type: 'info',
          field: 'rules',
          message: `优先级 ${priority} 存在 ${rulesAtPriority.length} 条规则: ${rulesAtPriority.map(r => r.id).join(', ')}`
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info
    };
  }

  evaluateCondition(condition: Condition, order: OrderWithTags): boolean {
    const { field, operator, value } = condition;

    let fieldValue: any;
    if (field === 'skuTags') {
      fieldValue = order.skuTags;
    } else if (field in order) {
      fieldValue = (order as any)[field];
    } else {
      return false;
    }

    switch (operator) {
      case 'equals':
        return this.safeEqual(fieldValue, value);
      case 'notEquals':
        return !this.safeEqual(fieldValue, value);
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(String(value));
        }
        return String(fieldValue).includes(String(value));
      case 'notContains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(String(value));
        }
        return !String(fieldValue).includes(String(value));
      case 'greaterThan':
        return Number(fieldValue) > Number(value);
      case 'lessThan':
        return Number(fieldValue) < Number(value);
      case 'greaterThanOrEqual':
        return Number(fieldValue) >= Number(value);
      case 'lessThanOrEqual':
        return Number(fieldValue) <= Number(value);
      case 'in':
        const inValues = Array.isArray(value) ? value : [value];
        return inValues.includes(fieldValue);
      case 'notIn':
        const notInValues = Array.isArray(value) ? value : [value];
        return !notInValues.includes(fieldValue);
      default:
        return false;
    }
  }

  private safeEqual(a: any, b: any): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => this.safeEqual(v, b[i]));
    }
    return a === b;
  }

  matchRule(rule: Rule, order: OrderWithTags): { matched: boolean; matchedConditions: number } {
    if (rule.conditions.length === 0) {
      return { matched: true, matchedConditions: 0 };
    }

    let matchedCount = 0;
    const results: boolean[] = [];

    for (const condition of rule.conditions) {
      const result = this.evaluateCondition(condition, order);
      results.push(result);
      if (result) matchedCount++;
    }

    if (rule.conditionLogic === 'AND') {
      return { matched: results.every(r => r), matchedConditions: matchedCount };
    } else {
      return { matched: results.some(r => r), matchedConditions: matchedCount };
    }
  }

  getMatchingRules(order: OrderWithTags): Rule[] {
    const matchingRules: Rule[] = [];

    for (const rule of this.rules) {
      const { matched } = this.matchRule(rule, order);
      if (matched) {
        matchingRules.push(rule);
      }
    }

    return matchingRules.sort((a, b) => a.priority - b.priority);
  }

  checkMutuallyExclusiveConflict(rules: Rule[], order: OrderWithTags): Conflict | null {
    const allExclusiveTags = new Set<string>();
    const ruleExclusiveTags: Map<string, string[]> = new Map();

    for (const rule of rules) {
      ruleExclusiveTags.set(rule.id, rule.mutuallyExclusiveTags);
      for (const tag of rule.mutuallyExclusiveTags) {
        allExclusiveTags.add(tag);
      }
    }

    const orderExclusiveTags = order.skuTags.filter(tag => allExclusiveTags.has(tag));

    if (orderExclusiveTags.length > 0) {
      const conflictingRules = rules.filter(rule =>
        rule.mutuallyExclusiveTags.some(tag => orderExclusiveTags.includes(tag))
      );

      if (conflictingRules.length > 1) {
        return {
          type: ConflictType.MUTUALLY_EXCLUSIVE_TAGS,
          orderId: order.orderId,
          ruleIds: conflictingRules.map(r => r.id),
          zoneIds: [],
          description: `订单包含互斥标签 [${orderExclusiveTags.join(', ')}]，匹配了 ${conflictingRules.length} 条带互斥约束的规则`,
          severity: 'high',
          resolvedBy: 'rule_selection',
          resolutionReason: '选择优先级最高的规则'
        };
      }
    }

    return null;
  }

  checkColdChainConflict(order: OrderWithTags, zones: ZoneCapacity[]): Conflict | null {
    const hasColdChainTag = order.skuTags.includes('冷链') || order.skuTags.includes('冷藏') || order.skuTags.includes('冷冻');

    if (hasColdChainTag) {
      const coldChainZones = zones.filter(z => z.supportedTags.includes('冷链') || z.supportedTags.includes('冷藏') || z.supportedTags.includes('冷冻'));

      if (coldChainZones.length === 0) {
        return {
          type: ConflictType.COLD_CHAIN_CONFLICT,
          orderId: order.orderId,
          ruleIds: [],
          zoneIds: zones.map(z => z.zoneId),
          description: '订单包含冷链标签，但没有配置支持冷链的分拣区域',
          severity: 'high',
          resolvedBy: 'exclusion_fallback',
          resolutionReason: '无可用冷链区域，需人工处理'
        };
      }
    }

    return null;
  }

  checkLargeItemConflict(order: OrderWithTags): Conflict | null {
    const isLargeItem = order.weight > 50 || order.volume > 0.5;
    const hasLargeItemTag = order.skuTags.includes('大件') || order.skuTags.includes('超重') || order.skuTags.includes('超体积');

    if (isLargeItem || hasLargeItemTag) {
      const largeItemZones = this.zones.filter(z => z.supportedTags.includes('大件') || z.supportedTags.includes('超重'));

      if (largeItemZones.length === 0) {
        return {
          type: ConflictType.LARGE_ITEM_CONFLICT,
          orderId: order.orderId,
          ruleIds: [],
          zoneIds: this.zones.map(z => z.zoneId),
          description: `订单为大件商品（重量: ${order.weight}kg, 体积: ${order.volume}m³），但没有配置支持大件的分拣区域`,
          severity: 'high',
          resolvedBy: 'exclusion_fallback',
          resolutionReason: '无可用大件区域，需人工处理'
        };
      }
    }

    return null;
  }

  determineFinalZone(
    order: OrderWithTags,
    matchingRules: Rule[],
    zones: ZoneCapacity[],
    conflicts: Conflict[]
  ): { zoneId: string | null; ruleId: string | null; reason: string } {
    const assignZoneActions = matchingRules
      .filter(r => r.actions.some(a => a.type === 'assignZone'))
      .sort((a, b) => a.priority - b.priority);

    if (assignZoneActions.length > 0) {
      const topRule = assignZoneActions[0];
      const assignAction = topRule.actions.find(a => a.type === 'assignZone')!;
      const targetZones = Array.isArray(assignAction.value) ? assignAction.value : [assignAction.value];

      const excludeZones = new Set<string>();
      for (const rule of matchingRules) {
        for (const action of rule.actions) {
          if (action.type === 'excludeZone') {
            const excluded = Array.isArray(action.value) ? action.value : [action.value];
            excluded.forEach(z => excludeZones.add(String(z)));
          }
        }
      }

      for (const zoneId of targetZones) {
        const zoneStr = String(zoneId);
        if (!excludeZones.has(zoneStr)) {
          const zone = zones.find(z => z.zoneId === zoneStr);
          if (zone) {
            return {
              zoneId: zone.zoneId,
              ruleId: topRule.id,
              reason: `匹配规则 ${topRule.name} (${topRule.id})，分配区域 ${zone.zoneName}`
            };
          }
        }
      }
    }

    const defaultRule = matchingRules.find(r => r.isDefault);
    if (defaultRule) {
      const defaultAssignAction = defaultRule.actions.find(a => a.type === 'assignZone');
      if (defaultAssignAction) {
        const defaultZones = Array.isArray(defaultAssignAction.value) ? defaultAssignAction.value : [defaultAssignAction.value];
        const firstZone = zones.find(z => defaultZones.includes(z.zoneId)) || zones[0];

        if (firstZone) {
          return {
            zoneId: firstZone.zoneId,
            ruleId: defaultRule.id,
            reason: `使用默认规则 ${defaultRule.name} (${defaultRule.id}) 兜底分配`
          };
        }
      }
    }

    if (zones.length > 0) {
      const sortedZones = [...zones].sort((a, b) => a.priority - b.priority);
      return {
        zoneId: sortedZones[0].zoneId,
        ruleId: null,
        reason: `未匹配任何规则，按区域优先级分配到 ${sortedZones[0].zoneName}`
      };
    }

    return {
      zoneId: null,
      ruleId: null,
      reason: '无可用分拣区域'
    };
  }

  getWaveLabel(order: OrderWithTags, matchingRules: Rule[]): string | null {
    const labelActions = matchingRules
      .filter(r => r.actions.some(a => a.type === 'setWaveLabel'))
      .sort((a, b) => a.priority - b.priority);

    if (labelActions.length > 0) {
      const topRule = labelActions[0];
      const labelAction = topRule.actions.find(a => a.type === 'setWaveLabel')!;
      return String(labelAction.value);
    }

    return null;
  }

  processOrder(order: OrderWithTags): OrderMatchTrace {
    const matchingRules = this.getMatchingRules(order);
    const conflicts: Conflict[] = [];

    const matchedRulesDetail = matchingRules.map(rule => {
      const { matchedConditions } = this.matchRule(rule, order);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        matchedConditions,
        totalConditions: rule.conditions.length,
        actions: [...rule.actions]
      };
    });

    if (matchingRules.length > 1) {
      const priorities = new Set(matchingRules.map(r => r.priority));
      for (const priority of priorities) {
        const rulesAtPriority = matchingRules.filter(r => r.priority === priority);
        if (rulesAtPriority.length > 1) {
          conflicts.push({
            type: ConflictType.SAME_PRIORITY_MULTIPLE_RULES,
            orderId: order.orderId,
            ruleIds: rulesAtPriority.map(r => r.id),
            zoneIds: [],
            description: `优先级 ${priority} 同时匹配了 ${rulesAtPriority.length} 条规则: ${rulesAtPriority.map(r => r.name).join(', ')}`,
            severity: 'medium',
            resolvedBy: 'rule_selection',
            resolutionReason: '按规则ID排序选择第一条'
          });
        }
      }
    }

    const exclusiveConflict = this.checkMutuallyExclusiveConflict(matchingRules, order);
    if (exclusiveConflict) {
      conflicts.push(exclusiveConflict);
    }

    const coldChainConflict = this.checkColdChainConflict(order, this.zones);
    if (coldChainConflict) {
      conflicts.push(coldChainConflict);
    }

    const largeItemConflict = this.checkLargeItemConflict(order);
    if (largeItemConflict) {
      conflicts.push(largeItemConflict);
    }

    const finalDecision = this.determineFinalZone(order, matchingRules, this.zones, conflicts);
    const waveLabel = this.getWaveLabel(order, matchingRules);

    return {
      orderId: order.orderId,
      matchedRules: matchedRulesDetail,
      assignedZone: finalDecision.zoneId,
      waveLabel,
      conflicts,
      finalDecision: finalDecision.zoneId ? {
        ruleId: finalDecision.ruleId || 'none',
        zoneId: finalDecision.zoneId,
        reason: finalDecision.reason
      } : null
    };
  }

  processAllOrders(): OrderMatchTrace[] {
    return this.orders.map(order => this.processOrder(order));
  }

  getZones(): ZoneCapacity[] {
    return [...this.zones];
  }

  getRules(): Rule[] {
    return [...this.rules];
  }

  getOrders(): OrderWithTags[] {
    return [...this.orders];
  }
}
