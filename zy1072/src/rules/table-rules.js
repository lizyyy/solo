import { RuleBase } from './rule-base.js';
import { CONFLICT_SEVERITY, CONFLICT_TYPES } from '../types.js';
import { groupBy } from '../utils.js';

export class TableCapacityRule extends RuleBase {
  constructor() {
    super(
      'table_over_capacity',
      '检查桌位是否超员',
      CONFLICT_SEVERITY.CRITICAL
    );
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const seatedGuests = guests.filter(g => g.tableNumber);
    const guestsByTable = groupBy(seatedGuests, 'tableNumber');

    for (const [tableNumber, tableGuests] of Object.entries(guestsByTable)) {
      const table = tableMap.get(tableNumber);
      if (!table) continue;

      const guestCount = tableGuests.length;
      if (guestCount > table.capacity) {
        conflicts.push(this.createConflict(
          CONFLICT_TYPES.TABLE_OVER_CAPACITY,
          `桌号 ${tableNumber} 超员: 容量 ${table.capacity} 人，实际 ${guestCount} 人`,
          {
            tableNumber,
            capacity: table.capacity,
            actual: guestCount,
            overflow: guestCount - table.capacity,
            guests: tableGuests.map(g => ({
              name: g.name,
              lineNumber: g._lineNumber
            })),
            suggestions: [
              `将 ${guestCount - table.capacity} 位宾客调整到其他桌`,
              `考虑将桌号 ${tableNumber} 的容量从 ${table.capacity} 调整为 ${guestCount}`,
              '寻找有空位的相邻桌位进行拆分'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class EmptyTableRule extends RuleBase {
  constructor() {
    super(
      'empty_table',
      '检查空桌位',
      CONFLICT_SEVERITY.LOW
    );
  }

  async validate({ guests, tables }) {
    const conflicts = [];
    const seatedGuests = guests.filter(g => g.tableNumber);
    const usedTables = new Set(seatedGuests.map(g => g.tableNumber));

    const emptyTables = tables.filter(t => !usedTables.has(t.tableNumber));

    if (emptyTables.length > 0) {
      conflicts.push(this.createConflict(
        'empty_table',
        `发现 ${emptyTables.length} 个空桌位`,
        {
          tables: emptyTables.map(t => ({
            tableNumber: t.tableNumber,
            capacity: t.capacity,
            area: t.area
          })),
          suggestions: [
            '确认这些桌位是否需要保留',
            '如果不需要，可以从 tables.json 中移除',
            '检查是否有宾客应该安排在这些桌位'
          ]
        }
      ));
    }

    return conflicts;
  }
}
