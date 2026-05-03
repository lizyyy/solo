import { RuleBase } from './rule-base.js';
import { CONFLICT_SEVERITY, CONFLICT_TYPES } from '../types.js';
import { groupBy } from '../utils.js';

export class DuplicateNameRule extends RuleBase {
  constructor() {
    super(
      'duplicate_name',
      '检查重复宾客姓名',
      CONFLICT_SEVERITY.CRITICAL
    );
  }

  async validate({ guests }) {
    const conflicts = [];
    const nameGroups = groupBy(guests, 'name');

    for (const [name, guestList] of Object.entries(nameGroups)) {
      if (guestList.length > 1 && name) {
        conflicts.push(this.createConflict(
          CONFLICT_TYPES.DUPLICATE_NAME,
          `存在重复姓名: "${name}"`,
          {
            guests: guestList.map(g => ({
              name: g.name,
              lineNumber: g._lineNumber,
              tableNumber: g.tableNumber
            })),
            suggestions: [
              '建议使用全名或添加标识（如"张三（父）"、"张三（子）"）',
              '检查是否为同一人重复录入'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class MissingTableRule extends RuleBase {
  constructor() {
    super(
      'table_not_exist',
      '检查宾客分配的桌号是否存在',
      CONFLICT_SEVERITY.HIGH
    );
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const tableNumbers = new Set(tables.map(t => t.tableNumber));

    for (const guest of guests) {
      if (guest.tableNumber && !tableNumbers.has(guest.tableNumber)) {
        conflicts.push(this.createConflict(
          CONFLICT_TYPES.TABLE_NOT_EXIST,
          `宾客 "${guest.name}" 被分配到不存在的桌号: ${guest.tableNumber}`,
          {
            guest: guest.name,
            lineNumber: guest._lineNumber,
            assignedTable: guest.tableNumber,
            availableTables: [...tableNumbers],
            suggestions: [
              `修改桌号为现有桌号: ${[...tableNumbers].join('、')}`,
              '在 tables.json 中添加该桌位'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class UnseatedGuestRule extends RuleBase {
  constructor() {
    super(
      'guest_not_seated',
      '检查未分配座位的宾客',
      CONFLICT_SEVERITY.HIGH
    );
  }

  async validate({ guests }) {
    const conflicts = [];
    const unseated = guests.filter(g => !g.tableNumber);

    if (unseated.length > 0) {
      conflicts.push(this.createConflict(
        CONFLICT_TYPES.GUEST_NOT_SEATED,
        `发现 ${unseated.length} 位宾客未分配座位`,
        {
          guests: unseated.map(g => ({
            name: g.name,
            lineNumber: g._lineNumber,
            group: g.group
          })),
          suggestions: [
            '为这些宾客分配桌号',
            '检查是否为待确认宾客，可暂时标记为待定'
          ]
        }
      ));
    }

    return conflicts;
  }
}
