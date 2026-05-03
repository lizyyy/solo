import { CONFLICT_SEVERITY, CONFLICT_TYPES } from '../types.js';
import { groupBy } from '../utils.js';

const SEVERITY_PRIORITY = {
  [CONFLICT_SEVERITY.CRITICAL]: 0,
  [CONFLICT_SEVERITY.HIGH]: 1,
  [CONFLICT_SEVERITY.MEDIUM]: 2,
  [CONFLICT_SEVERITY.LOW]: 3
};

export class SeatingSuggester {
  constructor() {
    this.suggestions = [];
  }

  async generateSuggestions(context) {
    const { guests, tables, validationResult } = context;
    const { conflicts } = validationResult;

    this.suggestions = [];

    const criticalConflicts = conflicts.filter(c => c.severity === CONFLICT_SEVERITY.CRITICAL);
    const highConflicts = conflicts.filter(c => c.severity === CONFLICT_SEVERITY.HIGH);
    const mediumConflicts = conflicts.filter(c => c.severity === CONFLICT_SEVERITY.MEDIUM);
    const lowConflicts = conflicts.filter(c => c.severity === CONFLICT_SEVERITY.LOW);

    for (const conflict of criticalConflicts) {
      await this._handleCriticalConflict(conflict, guests, tables);
    }

    for (const conflict of highConflicts) {
      await this._handleHighConflict(conflict, guests, tables);
    }

    for (const conflict of mediumConflicts) {
      await this._handleMediumConflict(conflict, guests, tables);
    }

    const seatPlan = this._generateSeatPlan(guests, tables);
    const optimizedPlan = this._optimizeSeatPlan(seatPlan, guests, tables);

    return {
      suggestions: this.suggestions,
      seatPlan: optimizedPlan,
      criticalCount: criticalConflicts.length,
      highCount: highConflicts.length,
      mediumCount: mediumConflicts.length,
      infoCount: lowConflicts.length
    };
  }

  async _handleCriticalConflict(conflict, guests, tables) {
    const type = conflict.type;

    switch (type) {
      case CONFLICT_TYPES.DUPLICATE_NAME:
        this._addSuggestion({
          category: '数据修正',
          priority: 1,
          title: '修正重复姓名',
          conflict: conflict,
          description: `发现 ${conflict.guests.length} 位宾客姓名重复: ${conflict.guests.map(g => g.name).join('、')}`,
          actions: [
            '检查是否为同一人重复录入',
            '如果是不同人，使用全名或添加标识区分（如"张三（父）"、"张三（子）"）',
            `涉及行号: ${conflict.guests.map(g => g.lineNumber).join('、')}`
          ]
        });
        break;

      case CONFLICT_TYPES.TABLE_OVER_CAPACITY:
        this._addSuggestion({
          category: '桌位调整',
          priority: 2,
          title: `桌号 ${conflict.tableNumber} 超员调整`,
          conflict: conflict,
          description: `桌号 ${conflict.tableNumber} 容量 ${conflict.capacity} 人，实际 ${conflict.actual} 人，超出 ${conflict.overflow} 人`,
          actions: [
            `方案1: 将 ${conflict.overflow} 位宾客调整到有空位的桌位`,
            `方案2: 考虑将桌号 ${conflict.tableNumber} 的容量从 ${conflict.capacity} 调整为 ${conflict.actual}`,
            `涉及宾客: ${conflict.guests.map(g => g.name).join('、')}`
          ]
        });
        break;

      case CONFLICT_TYPES.AVOID_CONFLICT:
        this._addSuggestion({
          category: '关系冲突',
          priority: 3,
          title: `解决 "${conflict.guest}" 的同桌冲突`,
          conflict: conflict,
          description: `宾客 "${conflict.guest}" 与 ${conflict.conflicted.map(c => c.name).join('、')} 被安排在同一桌（桌号 ${conflict.tableNumber}），但他们需要避免同桌`,
          actions: [
            `方案1: 将 "${conflict.guest}" 调整到其他桌位`,
            `方案2: 将冲突宾客 ${conflict.conflicted.map(c => c.name).join('、')} 调整到其他桌位`,
            '建议: 优先考虑将关系较疏远的一方调整'
          ]
        });
        break;

      default:
        this._addGenericConflictSuggestion(conflict);
    }
  }

  async _handleHighConflict(conflict, guests, tables) {
    const type = conflict.type;

    switch (type) {
      case CONFLICT_TYPES.TABLE_NOT_EXIST:
        this._addSuggestion({
          category: '数据修正',
          priority: 10,
          title: `修正 "${conflict.guest}" 的桌号`,
          conflict: conflict,
          description: `宾客 "${conflict.guest}" 被分配到不存在的桌号: ${conflict.assignedTable}`,
          actions: [
            `方案1: 修改桌号为现有桌号: ${conflict.availableTables.join('、')}`,
            `方案2: 在 tables.json 中添加桌号 ${conflict.assignedTable}`,
            `宾客行号: ${conflict.lineNumber}`
          ]
        });
        break;

      case CONFLICT_TYPES.GUEST_NOT_SEATED:
        this._addSuggestion({
          category: '桌位分配',
          priority: 11,
          title: '为未分配座位的宾客安排座位',
          conflict: conflict,
          description: `发现 ${conflict.guests.length} 位宾客未分配座位`,
          actions: [
            `为以下宾客分配桌号: ${conflict.guests.map(g => g.name).join('、')}`,
            `涉及分组: ${[...new Set(conflict.guests.map(g => g.group))].join('、')}`,
            '检查这些宾客是否为待确认宾客，可暂时标记为待定'
          ]
        });
        break;

      case CONFLICT_TYPES.COMPANIONS_SEPARATED:
        this._addSuggestion({
          category: '关系调整',
          priority: 12,
          title: `合并 "${conflict.guest}" 的同行人`,
          conflict: conflict,
          description: `宾客 "${conflict.guest}"（桌号 ${conflict.currentTable}）的同行人被拆分`,
          actions: [
            `方案1: 将被拆分的同行人调整到桌号 ${conflict.currentTable}`,
            `方案2: 将 "${conflict.guest}" 调整到同行人所在的桌位`,
            `拆分详情: ${conflict.separated.map(s => `${s.name}(${s.reason})`).join('、')}`
          ]
        });
        break;

      case CONFLICT_TYPES.ACCESSIBILITY_ISSUE:
        this._addSuggestion({
          category: '位置调整',
          priority: 13,
          title: `为 "${conflict.guest}" 调整到靠近出口的桌位`,
          conflict: conflict,
          description: `行动不便宾客 "${conflict.guest}" 被安排在离出口较远的桌位 ${conflict.tableNumber}（距离: ${conflict.exitDistance}）`,
          actions: [
            `建议调整到离出口更近的桌位（距离 <= ${conflict.maxAllowed}）`,
            conflict.suggestions ? conflict.suggestions[1] : '请检查 tables.json 中是否有靠近出口的桌位配置'
          ]
        });
        break;

      case CONFLICT_TYPES.CHILDREN_WITHOUT_ADULT:
        this._addSuggestion({
          category: '安全检查',
          priority: 14,
          title: `桌号 ${conflict.tableNumber} 需要成年人陪同`,
          conflict: conflict,
          description: `桌号 ${conflict.tableNumber} 有 ${conflict.children.length} 位儿童但没有成年人陪同`,
          actions: [
            `方案1: 为这桌安排至少 1 名成年人陪同`,
            `方案2: 将儿童 ${conflict.children.map(c => c.name).join('、')} 调整到有家长陪同的桌位`,
            conflict.isChildFriendlyTable 
              ? '该桌已标记为儿童友好桌，但仍需成人照看' 
              : '建议将儿童安排在儿童友好桌'
          ]
        });
        break;

      case CONFLICT_TYPES.VIP_BAD_SEAT:
        this._addSuggestion({
          category: 'VIP安排',
          priority: 15,
          title: `为 VIP "${conflict.guest}" 调整到前排`,
          conflict: conflict,
          description: `VIP 宾客 "${conflict.guest}" 被安排在离舞台较远的桌位 ${conflict.tableNumber}（距离: ${conflict.stageDistance}）`,
          actions: [
            `建议调整到离舞台更近的桌位（距离 <= ${conflict.maxAllowed}）`,
            conflict.suggestions ? conflict.suggestions[1] : '请在 tables.json 中配置靠近舞台的VIP桌位'
          ]
        });
        break;

      default:
        this._addGenericConflictSuggestion(conflict);
    }
  }

  async _handleMediumConflict(conflict, guests, tables) {
    this._addGenericConflictSuggestion(conflict, false);
  }

  _addGenericConflictSuggestion(conflict, isHighPriority = false) {
    this._addSuggestion({
      category: '其他问题',
      priority: isHighPriority ? 50 : 100,
      title: conflict.message,
      conflict: conflict,
      description: conflict.message,
      actions: conflict.suggestions || ['请根据具体情况调整']
    });
  }

  _addSuggestion(suggestion) {
    this.suggestions.push({
      ...suggestion,
      id: this.suggestions.length + 1,
      timestamp: new Date().toISOString()
    });
  }

  _generateSeatPlan(guests, tables) {
    const seatedGuests = guests.filter(g => g.tableNumber);
    const guestsByTable = groupBy(seatedGuests, 'tableNumber');

    const plan = tables.map(table => {
      const tableGuests = guestsByTable[table.tableNumber] || [];
      return {
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        area: table.area,
        currentCount: tableGuests.length,
        availableSeats: table.capacity - tableGuests.length,
        guests: tableGuests.map(g => ({
          name: g.name,
          group: g.group,
          isVIP: g.isVIP,
          isChild: g.isChild,
          isMobilityImpaired: g.isMobilityImpaired,
          dietaryRestrictions: g.dietaryRestrictions
        })),
        tableDetails: {
          distanceToStage: table.distanceToStage,
          distanceToExit: table.distanceToExit,
          distanceToSpeaker: table.distanceToSpeaker,
          isChildFriendly: table.isChildFriendly,
          isQuietZone: table.isQuietZone
        }
      };
    });

    const unseated = guests.filter(g => !g.tableNumber);

    return {
      tables: plan,
      unseatedGuests: unseated.map(g => ({
        name: g.name,
        group: g.group,
        lineNumber: g._lineNumber
      })),
      totalSeats: tables.reduce((sum, t) => sum + t.capacity, 0),
      totalGuests: guests.length,
      seatedCount: seatedGuests.length,
      unseatedCount: unseated.length
    };
  }

  _optimizeSeatPlan(seatPlan, guests, tables) {
    const issues = [];

    for (const table of seatPlan.tables) {
      if (table.availableSeats < 0) {
        issues.push({
          tableNumber: table.tableNumber,
          issue: '超员',
          detail: `超出 ${Math.abs(table.availableSeats)} 个座位`
        });
      }

      const hasChildren = table.guests.some(g => g.isChild);
      const hasAdults = table.guests.some(g => !g.isChild);
      if (hasChildren && !hasAdults) {
        issues.push({
          tableNumber: table.tableNumber,
          issue: '儿童桌无成人',
          detail: `有 ${table.guests.filter(g => g.isChild).length} 位儿童需要成人陪同`
        });
      }
    }

    return {
      ...seatPlan,
      issues,
      optimizationNotes: [
        '请查看 validate 结果中的详细冲突信息',
        '使用 suggest 命令获取具体的调整建议',
        '修复后可使用 export 命令导出最终方案'
      ]
    };
  }

  getSuggestionsByCategory() {
    return groupBy(this.suggestions, 'category');
  }

  getSuggestionsByPriority() {
    return [...this.suggestions].sort((a, b) => a.priority - b.priority);
  }
}

export default SeatingSuggester;
