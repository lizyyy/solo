import { isWithinInterval, parseISO } from 'date-fns';
import {
  ViolationRecord,
  Shift,
  ViolationFilterParams,
  ImportBatch,
  Penalty,
  Appeal,
  Vehicle,
} from '../types';
import {
  getViolations,
  saveViolations,
  getShifts,
  saveShifts,
  getVehicles,
  saveVehicles,
  getDrivers,
  saveDrivers,
  generateId,
  addHistory,
  getBatches,
  saveBatches,
  getPenalties,
  savePenalties,
  getAppeals,
  saveAppeals,
} from '../store/storage';

export const checkDuplicateViolation = (
  violationNumber: string,
  plateNumber: string,
  violationTime: string
): boolean => {
  const violations = getViolations();
  return violations.some(
    (v) =>
      v.violationNumber === violationNumber ||
      (v.plateNumber === plateNumber && v.violationTime === violationTime)
  );
};

export const findMatchingShifts = (
  plateNumber: string,
  violationTime: string
): Shift[] => {
  const vehicles = getVehicles();
  const vehicle = vehicles.find((v) => v.plateNumber === plateNumber);
  if (!vehicle) return [];

  const shifts = getShifts();
  const violationDate = parseISO(violationTime);

  const vehicleShifts = shifts.filter((s) => s.vehicleId === vehicle.id);
  const matchingShifts = vehicleShifts.filter((shift) => {
    try {
      return isWithinInterval(violationDate, {
        start: parseISO(shift.startTime),
        end: parseISO(shift.endTime),
      });
    } catch {
      return false;
    }
  });

  return matchingShifts;
};

export interface ImportResult {
  batch: ImportBatch;
  imported: ViolationRecord[];
  duplicates: any[];
}

export const importViolations = (
  data: any[],
  fileName: string,
  importedBy: string
): ImportResult => {
  const batchId = generateId();
  const now = new Date().toISOString();
  const violations = getViolations();
  const imported: ViolationRecord[] = [];
  const duplicates: any[] = [];

  for (const item of data) {
    const violationNumber = item.violationNumber || item.违章编号 || generateId();
    const plateNumber = item.plateNumber || item.车牌号 || '';
    const violationTime = item.violationTime || item.违章时间 || now;

    if (checkDuplicateViolation(violationNumber, plateNumber, violationTime)) {
      duplicates.push(item);
      continue;
    }

    const matchingShifts = findMatchingShifts(plateNumber, violationTime);
    const vehicles = getVehicles();
    const vehicle = vehicles.find((v) => v.plateNumber === plateNumber);

    const violation: ViolationRecord = {
      id: generateId(),
      violationNumber,
      plateNumber,
      vehicleId: vehicle?.id,
      violationTime,
      violationType: item.violationType || item.违章类型 || 'other',
      location: item.location || item.违章地点 || '',
      description: item.description || item.违章描述 || '',
      points: parseInt(item.points || item.扣分 || 0),
      fineAmount: parseFloat(item.fineAmount || item.罚款金额 || 0),
      status: matchingShifts.length === 1 ? 'matched' : 'imported',
      matchedShiftId: matchingShifts.length === 1 ? matchingShifts[0].id : undefined,
      matchedDriverId: matchingShifts.length === 1 ? matchingShifts[0].driverId : undefined,
      importBatchId: batchId,
      importedAt: now,
      importedBy,
    };

    imported.push(violation);
    violations.push(violation);

    if (matchingShifts.length === 1) {
      violation.status = 'pending_confirmation';
      addHistory(
        violation.id,
        '自动匹配班次',
        importedBy,
        'system',
        `匹配到班次：${matchingShifts[0].id}`,
        'imported',
        'pending_confirmation'
      );
    } else if (matchingShifts.length > 1) {
      addHistory(
        violation.id,
        '班次重叠警告',
        importedBy,
        'system',
        `找到 ${matchingShifts.length} 个重叠班次，需人工确认`
      );
    }
  }

  saveViolations(violations);

  const batch: ImportBatch = {
    id: batchId,
    fileName,
    importedAt: now,
    importedBy,
    totalRecords: data.length,
    successfulRecords: imported.length,
    duplicateRecords: duplicates.length,
  };
  const batches = getBatches();
  batches.unshift(batch);
  saveBatches(batches);

  return { batch, imported, duplicates };
};

export const matchShift = (
  violationId: string,
  shiftId: string,
  operator: string,
  operatorId: string
): ViolationRecord | null => {
  const violations = getViolations();
  const violation = violations.find((v) => v.id === violationId);
  const shifts = getShifts();
  const shift = shifts.find((s) => s.id === shiftId);

  if (!violation || !shift) return null;

  const oldStatus = violation.status;
  violation.matchedShiftId = shiftId;
  violation.matchedDriverId = shift.driverId;
  violation.status = 'pending_confirmation';

  saveViolations(violations);
  addHistory(
    violationId,
    '人工匹配班次',
    operator,
    operatorId,
    `匹配班次：${shiftId}`,
    oldStatus,
    'pending_confirmation'
  );

  return violation;
};

export const confirmViolation = (
  violationId: string,
  driverId: string,
  operator: string,
  operatorId: string
): ViolationRecord | null => {
  const violations = getViolations();
  const violation = violations.find((v) => v.id === violationId);

  if (!violation) return null;

  const oldStatus = violation.status;
  violation.matchedDriverId = driverId;
  violation.status = 'confirmed';

  saveViolations(violations);
  addHistory(
    violationId,
    '司机确认违章',
    operator,
    operatorId,
    '司机已确认违章信息',
    oldStatus,
    'confirmed'
  );

  return violation;
};

export const submitAppeal = (
  violationId: string,
  driverId: string,
  reason: string,
  materials: any[] = []
): Appeal | null => {
  const violations = getViolations();
  const violation = violations.find((v) => v.id === violationId);

  if (!violation) return null;

  const oldStatus = violation.status;
  violation.status = 'appealing';
  saveViolations(violations);

  const appeal: Appeal = {
    id: generateId(),
    violationId,
    driverId,
    reason,
    materials: materials.map((m) => ({
      id: generateId(),
      name: m.name,
      type: m.type,
      uploadTime: new Date().toISOString(),
      fileKey: m.fileKey || generateId(),
    })),
    submittedAt: new Date().toISOString(),
    status: 'pending',
  };

  const appeals = getAppeals();
  appeals.unshift(appeal);
  saveAppeals(appeals);

  addHistory(
    violationId,
    '提交申诉',
    getDriverName(driverId),
    driverId,
    `申诉原因：${reason}`,
    oldStatus,
    'appealing'
  );

  return appeal;
};

export const reviewAppeal = (
  appealId: string,
  approved: boolean,
  reviewNotes: string,
  reviewer: string,
  reviewerId: string
): Appeal | null => {
  const appeals = getAppeals();
  const appeal = appeals.find((a) => a.id === appealId);

  if (!appeal) return null;

  appeal.status = approved ? 'approved' : 'rejected';
  appeal.reviewedBy = reviewer;
  appeal.reviewedAt = new Date().toISOString();
  appeal.reviewNotes = reviewNotes;
  saveAppeals(appeals);

  const violations = getViolations();
  const violation = violations.find((v) => v.id === appeal.violationId);
  if (violation) {
    const oldStatus = violation.status;
    if (approved) {
      violation.status = 'appeal_approved';
      addHistory(
        appeal.violationId,
        '申诉通过',
        reviewer,
        reviewerId,
        reviewNotes,
        oldStatus,
        'appeal_approved'
      );

      const existingPenalty = getPenaltiesByViolationId(appeal.violationId);
      if (existingPenalty) {
        rollbackPenalty(existingPenalty.id, '申诉通过自动回滚', reviewer, reviewerId);
      }
    } else {
      violation.status = 'appeal_rejected';
      addHistory(
        appeal.violationId,
        '申诉驳回',
        reviewer,
        reviewerId,
        reviewNotes,
        oldStatus,
        'appeal_rejected'
      );
    }
    saveViolations(violations);
  }

  return appeal;
};

export const applyPenalty = (
  violationId: string,
  operator: string,
  operatorId: string
): Penalty | null => {
  const violations = getViolations();
  const violation = violations.find((v) => v.id === violationId);

  if (!violation || !violation.matchedDriverId) return null;
  if (violation.status === 'appeal_approved') {
    throw new Error('申诉通过的违章不能处罚');
  }
  if (violation.status === 'penalized') {
    throw new Error('该违章已处罚');
  }

  const oldStatus = violation.status;
  violation.status = 'penalized';
  saveViolations(violations);

  const penalty: Penalty = {
    id: generateId(),
    violationId,
    driverId: violation.matchedDriverId,
    pointsDeducted: violation.points,
    fineAmount: violation.fineAmount,
    appliedAt: new Date().toISOString(),
    isRolledBack: false,
  };

  const penalties = getPenalties();
  penalties.unshift(penalty);
  savePenalties(penalties);

  const drivers = getDrivers();
  const driver = drivers.find((d) => d.id === violation.matchedDriverId);
  if (driver) {
    driver.remainingPoints = Math.max(0, driver.remainingPoints - violation.points);
    saveDrivers(drivers);
  }

  addHistory(
    violationId,
    '执行处罚',
    operator,
    operatorId,
    `扣除 ${violation.points} 分，罚款 ${violation.fineAmount} 元`,
    oldStatus,
    'penalized'
  );

  return penalty;
};

export const rollbackPenalty = (
  penaltyId: string,
  reason: string,
  operator: string,
  operatorId: string
): Penalty | null => {
  const penalties = getPenalties();
  const penalty = penalties.find((p) => p.id === penaltyId);

  if (!penalty || penalty.isRolledBack) return null;

  penalty.isRolledBack = true;
  penalty.rolledBackAt = new Date().toISOString();
  penalty.rollbackReason = reason;
  savePenalties(penalties);

  const drivers = getDrivers();
  const driver = drivers.find((d) => d.id === penalty.driverId);
  if (driver) {
    driver.remainingPoints = Math.min(
      driver.totalPoints,
      driver.remainingPoints + penalty.pointsDeducted
    );
    saveDrivers(drivers);
  }

  const violations = getViolations();
  const violation = violations.find((v) => v.id === penalty.violationId);
  if (violation) {
    const oldStatus = violation.status;
    violation.status = 'rolled_back';
    saveViolations(violations);
    addHistory(
      penalty.violationId,
      '回滚处罚',
      operator,
      operatorId,
      reason,
      oldStatus,
      'rolled_back'
    );
  }

  return penalty;
};

export const filterViolations = (params: ViolationFilterParams): ViolationRecord[] => {
  let violations = getViolations();

  if (params.plateNumber) {
    violations = violations.filter((v) =>
      v.plateNumber.includes(params.plateNumber!)
    );
  }

  if (params.driverName) {
    const drivers = getDrivers();
    const matchedDriverIds = drivers
      .filter((d) => d.name.includes(params.driverName!))
      .map((d) => d.id);
    violations = violations.filter((v) =>
      v.matchedDriverId && matchedDriverIds.includes(v.matchedDriverId)
    );
  }

  if (params.status) {
    violations = violations.filter((v) => v.status === params.status);
  }

  if (params.violationType) {
    violations = violations.filter((v) => v.violationType === params.violationType);
  }

  if (params.startDate) {
    violations = violations.filter(
      (v) => v.violationTime >= params.startDate!
    );
  }

  if (params.endDate) {
    violations = violations.filter(
      (v) => v.violationTime <= params.endDate! + 'T23:59:59'
    );
  }

  return violations.sort((a, b) => 
    new Date(b.violationTime).getTime() - new Date(a.violationTime).getTime()
  );
};

export const getDriverName = (driverId: string): string => {
  const drivers = getDrivers();
  return drivers.find((d) => d.id === driverId)?.name || '未知司机';
};

export const getVehicleByPlate = (plateNumber: string): Vehicle | undefined => {
  const vehicles = getVehicles();
  return vehicles.find((v) => v.plateNumber === plateNumber);
};

export const getAppealByViolationId = (violationId: string): Appeal | undefined => {
  const appeals = getAppeals();
  return appeals.find((appeal) => appeal.violationId === violationId);
};

export const getPenaltiesByViolationId = (violationId: string): Penalty | undefined => {
  const penalties = getPenalties();
  return penalties.find((p) => p.violationId === violationId && !p.isRolledBack);
};

export {
  getViolations,
  getShifts,
  getVehicles,
  getDrivers,
  getBatches,
  getPenalties,
  getAppeals,
  saveViolations,
  saveShifts,
  saveVehicles,
  saveDrivers,
  saveBatches,
  savePenalties,
  saveAppeals,
};
