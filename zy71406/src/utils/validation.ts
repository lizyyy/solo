import type { BondPosition, RedemptionAnnouncement, ExerciseApplication, ConflictType, ConflictRecord } from '@/types';
import { generateId, isDateEqual, formatDate } from './format';

export const validateExerciseDate = (
  announcement: RedemptionAnnouncement,
  application: ExerciseApplication
): boolean => {
  return isDateEqual(announcement.exerciseDate, application.applyExerciseDate);
};

export const validatePosition = (
  position: BondPosition,
  application: ExerciseApplication
): boolean => {
  return application.applyQuantity <= position.positionQuantity;
};

export const validateWithdrawnStatus = (application: ExerciseApplication): boolean => {
  return !application.isWithdrawn;
};

export const detectConflicts = (
  position: BondPosition,
  announcement: RedemptionAnnouncement,
  application: ExerciseApplication
): ConflictType[] => {
  const conflicts: ConflictType[] = [];

  if (!validateExerciseDate(announcement, application)) {
    conflicts.push('exercise_date_mismatch');
  }

  if (application.isWithdrawn) {
    conflicts.push('withdrawn_still_in_list');
  }

  if (!validatePosition(position, application)) {
    conflicts.push('insufficient_position');
  }

  return conflicts;
};

export const createConflictRecords = (
  applicationId: string,
  conflicts: ConflictType[],
  position: BondPosition,
  announcement: RedemptionAnnouncement,
  application: ExerciseApplication
): ConflictRecord[] => {
  return conflicts.map((type) => {
    let detail = '';
    let suggestion = '';

    switch (type) {
      case 'exercise_date_mismatch':
        detail = `公告行权日为 ${formatDate(announcement.exerciseDate)}，申请行权日为 ${formatDate(application.applyExerciseDate)}`;
        suggestion = '请核实正确的行权日期，必要时联系客户确认是否调整申请日期';
        break;
      case 'withdrawn_still_in_list':
        detail = `申请于 ${formatDate(application.withdrawDate || application.updateTime)} 已撤回，但仍在名单中`;
        suggestion = '请确认是否需要移除该申请，或客户已重新提交行权申请';
        break;
      case 'insufficient_position':
        detail = `客户持仓数量为 ${position.positionQuantity.toLocaleString()}，申请行权数量为 ${application.applyQuantity.toLocaleString()}，超出 ${(application.applyQuantity - position.positionQuantity).toLocaleString()}`;
        suggestion = '请核实客户实际持仓，或与客户确认是否调整行权数量';
        break;
    }

    return {
      conflictId: generateId('conf_'),
      applicationId,
      conflictType: type,
      conflictDetail: detail,
      systemSuggestion: suggestion,
      createTime: new Date().toISOString(),
    };
  });
};

export const canTransitionStatus = (
  currentStatus: string,
  targetStatus: string
): boolean => {
  const validTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'withdrawn'],
    confirmed: ['exercised', 'withdrawn'],
    exercised: [],
    withdrawn: [],
  };
  return validTransitions[currentStatus]?.includes(targetStatus) || false;
};

export const validateFilterConditions = (conditions: Record<string, unknown>): boolean => {
  if (conditions.exerciseDateStart && conditions.exerciseDateEnd) {
    const start = new Date(conditions.exerciseDateStart as string);
    const end = new Date(conditions.exerciseDateEnd as string);
    if (start > end) {
      return false;
    }
  }
  return true;
};
