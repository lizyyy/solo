import { RuleBase } from './rule-base.js';
import { CONFLICT_SEVERITY, CONFLICT_TYPES } from '../types.js';
import { groupBy } from '../utils.js';

export class AccessibilityRule extends RuleBase {
  constructor() {
    super(
      'accessibility_issue',
      '检查行动不便者是否离出口太远',
      CONFLICT_SEVERITY.HIGH
    );
    this.maxExitDistance = 60;
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const mobilityImpairedGuests = guests.filter(g => g.isMobilityImpaired);

    for (const guest of mobilityImpairedGuests) {
      if (!guest.tableNumber) continue;

      const table = tableMap.get(guest.tableNumber);
      if (!table) continue;

      if (table.distanceToExit > this.maxExitDistance) {
        const betterTables = tables
          .filter(t => t.distanceToExit <= this.maxExitDistance)
          .slice(0, 5);

        conflicts.push(this.createConflict(
          CONFLICT_TYPES.ACCESSIBILITY_ISSUE,
          `行动不便宾客 "${guest.name}" 被安排在离出口较远的位置`,
          {
            guest: guest.name,
            lineNumber: guest._lineNumber,
            tableNumber: guest.tableNumber,
            exitDistance: table.distanceToExit,
            maxAllowed: this.maxExitDistance,
            suggestions: [
              `建议调整到离出口更近的桌位（距离 <= ${this.maxExitDistance}）`,
              betterTables.length > 0 
                ? `推荐桌位: ${betterTables.map(t => `${t.tableNumber}号(离出口${t.distanceToExit})`).join('、')}`
                : '请检查 tables.json 中是否有靠近出口的桌位配置'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class ChildrenTableRule extends RuleBase {
  constructor() {
    super(
      'children_without_adult',
      '检查儿童桌是否缺少成年人',
      CONFLICT_SEVERITY.HIGH
    );
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const seatedGuests = guests.filter(g => g.tableNumber);
    const guestsByTable = groupBy(seatedGuests, 'tableNumber');

    for (const [tableNumber, tableGuests] of Object.entries(guestsByTable)) {
      const table = tableMap.get(tableNumber);
      const children = tableGuests.filter(g => g.isChild);
      const adults = tableGuests.filter(g => !g.isChild);

      if (children.length > 0 && adults.length === 0) {
        conflicts.push(this.createConflict(
          CONFLICT_TYPES.CHILDREN_WITHOUT_ADULT,
          `桌号 ${tableNumber} 有儿童但没有成年人陪同`,
          {
            tableNumber,
            children: children.map(c => ({
              name: c.name,
              lineNumber: c._lineNumber
            })),
            isChildFriendlyTable: table?.isChildFriendly || false,
            suggestions: [
              `为这桌儿童安排至少 1 名成年人陪同`,
              '考虑将儿童调整到有家长陪同的桌位',
              table?.isChildFriendly ? '该桌已标记为儿童友好桌，但仍需成人照看' : '建议将儿童安排在儿童友好桌'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class QuietZoneRule extends RuleBase {
  constructor() {
    super(
      'quiet_zone_issue',
      '检查需要安静区的宾客是否被安排正确',
      CONFLICT_SEVERITY.MEDIUM
    );
    this.maxSpeakerDistanceForQuiet = 40;
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const quietNeedGuests = guests.filter(g => g.needsQuietZone);

    for (const guest of quietNeedGuests) {
      if (!guest.tableNumber) continue;

      const table = tableMap.get(guest.tableNumber);
      if (!table) continue;

      const issues = [];

      if (table.isQuietZone === false && table.distanceToSpeaker < this.maxSpeakerDistanceForQuiet) {
        issues.push(`离音箱较近 (距离: ${table.distanceToSpeaker})`);
      }

      if (!table.isQuietZone && this.maxSpeakerDistanceForQuiet > table.distanceToSpeaker) {
        issues.push('该桌未标记为安静区');
      }

      if (issues.length > 0) {
        const betterTables = tables
          .filter(t => t.isQuietZone || t.distanceToSpeaker >= this.maxSpeakerDistanceForQuiet)
          .slice(0, 5);

        conflicts.push(this.createConflict(
          'quiet_zone_issue',
          `需要安静区的宾客 "${guest.name}" 可能被安排在嘈杂区域`,
          {
            guest: guest.name,
            lineNumber: guest._lineNumber,
            tableNumber: guest.tableNumber,
            speakerDistance: table.distanceToSpeaker,
            isQuietZone: table.isQuietZone,
            issues,
            suggestions: [
              `建议调整到安静区或离音箱较远的桌位（距离 >= ${this.maxSpeakerDistanceForQuiet}）`,
              betterTables.length > 0
                ? `推荐桌位: ${betterTables.map(t => `${t.tableNumber}号`).join('、')}`
                : '请在 tables.json 中配置安静区桌位'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}
