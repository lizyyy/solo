const { readData, writeData } = require('../utils/storage');
const { generateId, getHazardById, checkDuplicateHazard } = require('../utils/helpers');
const { HAZARD_STATUS, HAZARD_LEVEL, RECTIFY_DEADLINE_DAYS, RECTIFY_DEADLINE_DAYS_REOPENED } = require('../utils/constants');
const { logAudit } = require('../utils/audit');

function createHazard(hazardData) {
  const existingHazard = checkDuplicateHazard(hazardData);
  if (existingHazard) {
    return {
      success: false,
      isDuplicate: true,
      existingHazard,
      message: `检测到重复隐患，已存在隐患ID: ${existingHazard.id}`
    };
  }

  const hazards = readData('hazards');
  
  const id = generateId();
  const now = new Date();
  const deadlineDays = RECTIFY_DEADLINE_DAYS[hazardData.level] || 3;
  const deadline = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

  const hazard = {
    id,
    type: hazardData.type,
    location: hazardData.location,
    description: hazardData.description,
    level: hazardData.level || HAZARD_LEVEL.GENERAL,
    discoverer: hazardData.discoverer || 'system',
    discoveryDate: hazardData.discoveryDate || now.toISOString(),
    discoveryImages: hazardData.discoveryImages || [],
    status: HAZARD_STATUS.DISCOVERED,
    responsibleTeamId: hazardData.responsibleTeamId,
    rectifyDeadline: deadline.toISOString(),
    rectificationCount: 0,
    reviewFailCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  hazards.push(hazard);
  writeData('hazards', hazards);
  
  logAudit('create', 'hazard', id, hazard);
  
  return {
    success: true,
    hazard
  };
}

function updateHazardStatus(hazardId, newStatus, additionalData = {}) {
  const hazards = readData('hazards');
  const hazard = hazards.find(h => h.id === hazardId);
  
  if (!hazard) {
    return { success: false, message: '隐患不存在' };
  }

  if (hazard.status === newStatus) {
    return {
      success: true,
      hazard,
      isIdempotent: true,
      message: '状态未变化（幂等操作）'
    };
  }

  if (hazard.status === HAZARD_STATUS.CLOSED && 
      newStatus !== HAZARD_STATUS.CLOSED) {
    return {
      success: false,
      message: '已闭环的隐患不能修改状态'
    };
  }

  const oldStatus = hazard.status;
  const now = new Date().toISOString();

  if (newStatus === HAZARD_STATUS.RECTIFYING) {
    const deadlineDays = (oldStatus === HAZARD_STATUS.REOPENED) 
      ? RECTIFY_DEADLINE_DAYS_REOPENED[hazard.level] || 1
      : RECTIFY_DEADLINE_DAYS[hazard.level] || 3;
    const newDeadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
    hazard.rectifyDeadline = newDeadline.toISOString();
  }

  if (additionalData.rectificationCount !== undefined) {
    hazard.rectificationCount = additionalData.rectificationCount;
  }

  if (additionalData.reviewFailCount !== undefined) {
    hazard.reviewFailCount = additionalData.reviewFailCount;
  }

  hazard.status = newStatus;
  hazard.updatedAt = now;

  writeData('hazards', hazards);
  
  logAudit('status_change', 'hazard', hazardId, {
    oldStatus,
    newStatus,
    ...additionalData
  });

  return {
    success: true,
    hazard
  };
}

function closeHazard(hazardId) {
  const hazard = getHazardById(hazardId);
  
  if (!hazard) {
    return { success: false, message: '隐患不存在' };
  }

  if (hazard.status === HAZARD_STATUS.CLOSED) {
    return {
      success: true,
      hazard,
      isIdempotent: true,
      message: '隐患已经闭环（幂等操作）'
    };
  }

  if (hazard.level === HAZARD_LEVEL.MAJOR || hazard.level === HAZARD_LEVEL.CRITICAL) {
    return {
      success: false,
      message: '重大/特大隐患不能直接关闭，必须通过复查流程闭环'
    };
  }

  if (hazard.status !== HAZARD_STATUS.PENDING_REVIEW) {
    return {
      success: false,
      message: `只有待复查状态的隐患才能关闭，当前状态: ${hazard.status}`
    };
  }

  return updateHazardStatus(hazardId, HAZARD_STATUS.CLOSED);
}

function getAllHazards() {
  return readData('hazards');
}

function getHazardsByStatus(status) {
  const hazards = readData('hazards');
  return hazards.filter(h => h.status === status);
}

function getHazardsByTeam(teamId) {
  const hazards = readData('hazards');
  return hazards.filter(h => h.responsibleTeamId === teamId);
}

function getOverdueHazards() {
  const hazards = readData('hazards');
  const now = new Date();
  return hazards.filter(h => {
    if (h.status === HAZARD_STATUS.CLOSED) return false;
    if (!h.rectifyDeadline) return false;
    return new Date(h.rectifyDeadline) < now;
  });
}

module.exports = {
  createHazard,
  updateHazardStatus,
  closeHazard,
  getAllHazards,
  getHazardsByStatus,
  getHazardsByTeam,
  getOverdueHazards
};
