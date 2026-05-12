const { readData, writeData } = require('../utils/storage');
const { generateId, getHazardById, getFinesByHazard, calculateFine } = require('../utils/helpers');
const { HAZARD_STATUS } = require('../utils/constants');
const { logAudit } = require('../utils/audit');

function createFine(hazardId, fineData = {}) {
  const hazard = getHazardById(hazardId);
  
  if (!hazard) {
    return { success: false, message: '隐患不存在' };
  }

  if (hazard.reviewFailCount === 0 && hazard.status !== HAZARD_STATUS.CLOSED) {
    return {
      success: false,
      message: '隐患没有复查失败记录，无需罚款'
    };
  }

  const fines = readData('fines');
  const existingFines = getFinesByHazard(hazardId);
  
  const existingFine = existingFines.find(f => 
    f.amount === fineData.amount &&
    f.reason === fineData.reason
  );

  if (existingFine) {
    return {
      success: true,
      isIdempotent: true,
      fine: existingFine,
      message: '罚款记录已存在（幂等操作）'
    };
  }

  const id = generateId();
  const now = new Date();
  const amount = fineData.amount || calculateFine(hazard);

  const fine = {
    id,
    hazardId,
    teamId: hazard.responsibleTeamId,
    amount,
    reason: fineData.reason || `隐患整改复查不通过，累计复查失败${hazard.reviewFailCount}次`,
    operator: fineData.operator || 'system',
    paid: false,
    createdAt: now.toISOString()
  };

  fines.push(fine);
  writeData('fines', fines);

  logAudit('fine', 'hazard', hazardId, {
    fineId: id,
    amount: fine.amount,
    reason: fine.reason
  });

  return {
    success: true,
    fine
  };
}

function getFinesByTeam(teamId) {
  const fines = readData('fines');
  return fines.filter(f => f.teamId === teamId);
}

function markFinePaid(fineId) {
  const fines = readData('fines');
  const fine = fines.find(f => f.id === fineId);
  
  if (!fine) {
    return { success: false, message: '罚款记录不存在' };
  }

  if (fine.paid) {
    return {
      success: true,
      isIdempotent: true,
      fine,
      message: '罚款已缴纳（幂等操作）'
    };
  }

  fine.paid = true;
  fine.paidAt = new Date().toISOString();
  
  writeData('fines', fines);

  logAudit('fine_paid', 'fine', fineId, {
    paidAt: fine.paidAt
  });

  return {
    success: true,
    fine
  };
}

module.exports = {
  createFine,
  getFinesByTeam,
  markFinePaid
};
