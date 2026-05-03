import { RuleBase } from './rule-base.js';
import { CONFLICT_SEVERITY, CONFLICT_TYPES } from '../types.js';
import { groupBy } from '../utils.js';

export class CompanionsSeparatedRule extends RuleBase {
  constructor() {
    super(
      'companions_separated',
      '检查同行人是否被拆分',
      CONFLICT_SEVERITY.HIGH
    );
  }

  async validate({ guests }) {
    const conflicts = [];
    const guestMap = new Map(guests.map(g => [g.name, g]));

    for (const guest of guests) {
      if (guest.companions.length === 0) continue;
      if (!guest.tableNumber) continue;

      const separatedCompanions = [];

      for (const companionName of guest.companions) {
        const companion = guestMap.get(companionName);
        if (!companion) {
          separatedCompanions.push({
            name: companionName,
            exists: false,
            reason: '宾客不存在'
          });
          continue;
        }
        if (!companion.tableNumber) {
          separatedCompanions.push({
            name: companionName,
            exists: true,
            reason: '未分配座位'
          });
          continue;
        }
        if (companion.tableNumber !== guest.tableNumber) {
          separatedCompanions.push({
            name: companionName,
            exists: true,
            currentTable: companion.tableNumber,
            reason: `被分配到不同桌位: ${companion.tableNumber}`
          });
        }
      }

      if (separatedCompanions.length > 0) {
        conflicts.push(this.createConflict(
          CONFLICT_TYPES.COMPANIONS_SEPARATED,
          `宾客 "${guest.name}" 的同行人被拆分`,
          {
            guest: guest.name,
            lineNumber: guest._lineNumber,
            currentTable: guest.tableNumber,
            companions: guest.companions,
            separated: separatedCompanions,
            suggestions: [
              `将被拆分的同行人调整到桌号 ${guest.tableNumber}`,
              `或者将 "${guest.name}" 调整到同行人所在的桌位`,
              '如果确需分开，请移除同行人标记'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class AvoidConflictRule extends RuleBase {
  constructor() {
    super(
      'avoid_conflict',
      '检查需要避免同桌的宾客',
      CONFLICT_SEVERITY.CRITICAL
    );
  }

  async validate({ guests }) {
    const conflicts = [];
    const guestMap = new Map(guests.map(g => [g.name, g]));

    for (const guest of guests) {
      if (guest.avoidWith.length === 0) continue;
      if (!guest.tableNumber) continue;

      const conflictedGuests = [];

      for (const avoidName of guest.avoidWith) {
        const avoidGuest = guestMap.get(avoidName);
        if (!avoidGuest) continue;
        if (!avoidGuest.tableNumber) continue;

        if (avoidGuest.tableNumber === guest.tableNumber) {
          conflictedGuests.push({
            name: avoidName,
            lineNumber: avoidGuest._lineNumber,
            tableNumber: avoidGuest.tableNumber
          });
        }
      }

      if (conflictedGuests.length > 0) {
        conflicts.push(this.createConflict(
          CONFLICT_TYPES.AVOID_CONFLICT,
          `宾客 "${guest.name}" 与需要避免同桌的人被安排在同一桌`,
          {
            guest: guest.name,
            lineNumber: guest._lineNumber,
            tableNumber: guest.tableNumber,
            avoidWith: guest.avoidWith,
            conflicted: conflictedGuests,
            suggestions: [
              `将 "${guest.name}" 调整到其他桌位`,
              `或将冲突宾客 ${conflictedGuests.map(c => c.name).join('、')} 调整到其他桌位`,
              '优先考虑将关系较疏远的一方调整'
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}

export class PreferWithRule extends RuleBase {
  constructor() {
    super(
      'prefer_with',
      '检查优先同桌的宾客是否在一起',
      CONFLICT_SEVERITY.LOW
    );
  }

  async validate({ guests }) {
    const conflicts = [];
    const guestMap = new Map(guests.map(g => [g.name, g]));

    for (const guest of guests) {
      if (guest.preferWith.length === 0) continue;
      if (!guest.tableNumber) continue;

      const separatedPrefer = [];

      for (const preferName of guest.preferWith) {
        const preferGuest = guestMap.get(preferName);
        if (!preferGuest) continue;
        if (!preferGuest.tableNumber) continue;

        if (preferGuest.tableNumber !== guest.tableNumber) {
          separatedPrefer.push({
            name: preferName,
            currentTable: preferGuest.tableNumber
          });
        }
      }

      if (separatedPrefer.length > 0) {
        conflicts.push(this.createConflict(
          'prefer_with_separated',
          `宾客 "${guest.name}" 与优先同桌的人被分开`,
          {
            guest: guest.name,
            currentTable: guest.tableNumber,
            preferWith: guest.preferWith,
            separated: separatedPrefer,
            suggestions: [
              `考虑将优先同桌的人安排在一起`,
              `或者将 "${guest.name}" 调整到他们的桌位`
            ]
          }
        ));
      }
    }

    return conflicts;
  }
}
