import { RuleBase } from './rule-base.js';
import { CONFLICT_SEVERITY, CONFLICT_TYPES } from '../types.js';
import { groupBy, deduplicateArray } from '../utils.js';

export class VIPSeatingRule extends RuleBase {
  constructor() {
    super(
      'vip_bad_seat',
      '检查VIP是否被安排在视线差的区域',
      CONFLICT_SEVERITY.HIGH
    );
    this.maxStageDistanceForVIP = 30;
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const vipGuests = guests.filter(g => g.isVIP);

    for (const guest of vipGuests) {
      if (!guest.tableNumber) continue;

      const table = tableMap.get(guest.tableNumber);
      if (!table) continue;

      if (table.distanceToStage > this.maxStageDistanceForVIP) {
        const betterTables = tables
          .filter(t => t.distanceToStage <= this.maxStageDistanceForVIP)
          .slice(0, 5);

        conflicts.push(this.createConflict(
          CONFLICT_TYPES.VIP_BAD_SEAT,
          `VIP 宾客 "${guest.name}" 被安排在离舞台较远的位置`,
          {
            guest: guest.name,
            lineNumber: guest._lineNumber,
            tableNumber: guest.tableNumber,
            stageDistance: table.distanceToStage,
            maxAllowed: this.maxStageDistanceForVIP,
            suggestions: [
              `建议调整到离舞台更近的桌位（距离 <= ${this.maxStageDistanceForVIP}）`,
              betterTables.length > 0
                ? `推荐桌位: ${betterTables.map(t => `${t.tableNumber}号(离舞台${t.distanceToStage})`).join('、')}`
                : '请在 tables.json 中配置靠近舞台的VIP桌位'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class DietarySummaryRule extends RuleBase {
  constructor() {
    super(
      'diet_not_summarized',
      '检查饮食限制是否汇总到餐桌（信息性检查）',
      CONFLICT_SEVERITY.LOW
    );
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const seatedGuests = guests.filter(g => g.tableNumber);
    const guestsByTable = groupBy(seatedGuests, 'tableNumber');

    const dietarySummaries = [];

    for (const [tableNumber, tableGuests] of Object.entries(guestsByTable)) {
      const table = tableMap.get(tableNumber);
      
      const dietaryGuests = tableGuests.filter(g => g.dietaryRestrictions.length > 0);
      
      if (dietaryGuests.length > 0) {
        const allRestrictions = deduplicateArray(
          dietaryGuests.flatMap(g => g.dietaryRestrictions)
        );

        dietarySummaries.push({
          tableNumber,
          guests: dietaryGuests.map(g => ({
            name: g.name,
            restrictions: g.dietaryRestrictions
          })),
          allRestrictions
        });
      }
    }

    if (dietarySummaries.length > 0) {
      conflicts.push(this.createConflict(
        CONFLICT_TYPES.DIET_NOT_SUMMARIZED,
        `发现 ${dietarySummaries.length} 桌有饮食/过敏限制的宾客`,
        {
          tables: dietarySummaries,
          summary: dietarySummaries.map(t => 
            `桌${t.tableNumber}: ${t.guests.length}人(${t.allRestrictions.join('、')})`
          ).join('；'),
          suggestions: [
            '请使用 export 命令生成 kitchen-notes.md 汇总给厨房',
            '建议在餐桌座位卡上标注饮食限制',
            '确认所有过敏信息已准确录入'
          ]
        }
      ));
    }

    return conflicts;
  }
}

export class GroupSeatingRule extends RuleBase {
  constructor() {
    super(
      'group_seating',
      '检查同一分组宾客是否被分散（信息性）',
      CONFLICT_SEVERITY.LOW
    );
  }

  async validate({ guests }) {
    const conflicts = [];
    const seatedGuests = guests.filter(g => g.tableNumber && g.group);
    const guestsByGroup = groupBy(seatedGuests, 'group');

    for (const [groupName, groupGuests] of Object.entries(guestsByGroup)) {
      const tables = [...new Set(groupGuests.map(g => g.tableNumber))];
      
      if (tables.length > 1) {
        const guestsByTable = groupBy(groupGuests, 'tableNumber');

        conflicts.push(this.createConflict(
          'group_separated',
          `分组 "${groupName}" 的宾客被分散在 ${tables.length} 桌`,
          {
            group: groupName,
            guestCount: groupGuests.length,
            tables: tables.map(t => ({
              tableNumber: t,
              guests: guestsByTable[t].map(g => g.name)
            })),
            suggestions: [
              `如果希望同一分组坐在一起，考虑合并到 ${tables[0]} 号桌`,
              '如果是故意分散安排，此提示可忽略'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}
