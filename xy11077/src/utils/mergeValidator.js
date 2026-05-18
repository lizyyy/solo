const { AppError } = require('../middleware/errorHandler');
const RepairRecord = require('../models/RepairRecord');

class MergeValidator {
  static validateMerge(recordIds) {
    if (!recordIds || !Array.isArray(recordIds) || recordIds.length < 2) {
      throw new AppError(
        '合并操作需要至少2条维修记录',
        400,
        'INVALID_MERGE_REQUEST',
        { providedCount: recordIds?.length || 0, required: '>= 2' }
      );
    }
  }

  static checkDuplicateTeamAssignment(records) {
    const dormGroups = {};
    
    records.forEach(record => {
      const dormKey = `${record.building}-${record.roomNumber}`;
      if (!dormGroups[dormKey]) {
        dormGroups[dormKey] = [];
      }
      dormGroups[dormKey].push({
        id: record.id,
        assignedTeam: record.assignedTeam,
        repairType: record.repairType,
        reporter: record.reporter
      });
    });

    const conflicts = [];
    Object.entries(dormGroups).forEach(([dorm, items]) => {
      const teams = [...new Set(items.map(i => i.assignedTeam).filter(Boolean))];
      if (teams.length > 1) {
        conflicts.push({
          dormitory: dorm,
          assignedTeams: teams,
          records: items,
          conflictType: 'SAME_DORM_DIFFERENT_TEAMS'
        });
      }
    });

    if (conflicts.length > 0) {
      throw new AppError(
        '同寝室重复报修被分给不同维修队伍，无法直接合并',
        409,
        'DORM_TEAM_CONFLICT',
        {
          conflicts,
          resolution: '请先统一分配队伍后再进行合并操作'
        }
      );
    }
  }

  static checkWeeklyReportConsistency(records, targetRecord) {
    const inconsistentRecords = [];
    const targetWeek = this.getWeekNumber(targetRecord.createdAt);

    records.forEach(record => {
      const recordWeek = this.getWeekNumber(record.createdAt);
      if (recordWeek !== targetWeek) {
        inconsistentRecords.push({
          id: record.id,
          createdAt: record.createdAt,
          weekNumber: recordWeek,
          targetWeek: targetWeek,
          issue: '创建时间不在同一统计周，可能影响周报一致性'
        });
      }
    });

    if (inconsistentRecords.length > 0) {
      return {
        warning: '存在跨周记录合并，请注意周报统计一致性',
        inconsistentRecords,
        canProceed: true
      };
    }

    return { canProceed: true };
  }

  static checkVersionConflict(recordId, expectedVersion) {
    const record = RepairRecord.findById(recordId);
    if (!record) {
      throw new AppError(
        `维修记录 ${recordId} 不存在`,
        404,
        'RECORD_NOT_FOUND',
        { recordId }
      );
    }

    if (record.version !== expectedVersion) {
      throw new AppError(
        '版本冲突：记录已被他人修改，请勿静默覆盖',
        409,
        'VERSION_CONFLICT',
        {
          recordId,
          expectedVersion,
          currentVersion: record.version,
          resolution: '请刷新获取最新数据后重新操作'
        }
      );
    }

    return record;
  }

  static validateForMerge(recordIds) {
    this.validateMerge(recordIds);

    const records = recordIds.map(id => {
      const record = RepairRecord.findById(id);
      if (!record) {
        throw new AppError(
          `维修记录 ${id} 不存在`,
          404,
          'RECORD_NOT_FOUND',
          { recordId: id }
        );
      }
      return record;
    });

    this.checkDuplicateTeamAssignment(records);

    const [primaryRecord, ...otherRecords] = records;
    const weekCheck = this.checkWeeklyReportConsistency(otherRecords, primaryRecord);

    return {
      records,
      primaryRecord,
      otherRecords,
      warnings: weekCheck.warning ? [weekCheck] : []
    };
  }

  static getWeekNumber(dateStr) {
    const date = new Date(dateStr);
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
    return Math.ceil((date.getDay() + 1 + days) / 7);
  }
}

module.exports = MergeValidator;
