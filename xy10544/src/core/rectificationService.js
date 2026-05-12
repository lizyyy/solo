const { readData, writeData } = require('../utils/storage');
const { generateId, getHazardById, getRectificationsByHazard } = require('../utils/helpers');
const { HAZARD_STATUS } = require('../utils/constants');
const { logAudit } = require('../utils/audit');
const { updateHazardStatus } = require('./hazardService');

function submitRectification(hazardId, rectificationData) {
  const hazard = getHazardById(hazardId);
  
  if (!hazard) {
    return { success: false, message: '隐患不存在' };
  }

  if (hazard.status === HAZARD_STATUS.CLOSED) {
    return { success: false, message: '隐患已闭环，不能提交整改' };
  }

  if (!rectificationData.images || rectificationData.images.length === 0) {
    return { 
      success: false, 
      message: '整改照片缺失，必须提供整改前后对比照片' 
    };
  }

  const rectifications = readData('rectifications');
  
  const existingRectification = rectifications.find(r => 
    r.hazardId === hazardId && 
    r.description === rectificationData.description &&
    r.rectifier === rectificationData.rectifier
  );

  if (existingRectification) {
    return {
      success: true,
      isIdempotent: true,
      rectification: existingRectification,
      message: '整改记录已存在（幂等操作）'
    };
  }

  const id = generateId();
  const now = new Date();

  const rectification = {
    id,
    hazardId,
    description: rectificationData.description,
    images: rectificationData.images,
    rectifier: rectificationData.rectifier || 'system',
    rectificationDate: rectificationData.rectificationDate || now.toISOString(),
    createdAt: now.toISOString()
  };

  rectifications.push(rectification);
  writeData('rectifications', rectifications);

  const rectificationCount = getRectificationsByHazard(hazardId).length;
  const statusResult = updateHazardStatus(hazardId, HAZARD_STATUS.PENDING_REVIEW, {
    rectificationCount
  });

  if (!statusResult.success) {
    return statusResult;
  }

  logAudit('rectify', 'hazard', hazardId, {
    rectificationId: id,
    rectifier: rectification.rectifier,
    imageCount: rectification.images.length
  });

  return {
    success: true,
    rectification,
    hazard: statusResult.hazard
  };
}

module.exports = {
  submitRectification
};
