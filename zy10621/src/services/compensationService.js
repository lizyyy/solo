const { CompensationRecord, StatusHistory, Room, User, sequelize } = require('../models');
const { validateRecord, validateCompensationRules } = require('./validationService');
const { Op } = require('sequelize');

async function createRecord(data) {
  const validation = await validateRecord(data);
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  const room = await Room.findByPk(data.roomId);
  const durationHours = (new Date(data.endTime) - new Date(data.startTime)) / (1000 * 60 * 60);
  data.chargedAmount = data.chargedAmount || (room.hourlyRate * durationHours).toFixed(2);

  const record = await CompensationRecord.create({
    ...validation.validatedData,
    chargedAmount: data.chargedAmount,
    validationErrors: []
  });

  await StatusHistory.create({
    recordId: record.id,
    previousStatus: null,
    newStatus: record.status,
    changeReason: '创建预约记录'
  });

  return {
    success: true,
    data: await getRecordDetail(record.id)
  };
}

async function requestRelease(recordId, releaseData, changedBy = null) {
  const record = await CompensationRecord.findByPk(recordId);
  if (!record) {
    return { success: false, error: '记录不存在' };
  }

  if (record.status !== CompensationRecord.STATUS.BOOKED) {
    return { success: false, error: `当前状态"${record.status}"不允许申请释放` };
  }

  record.releaseReason = releaseData.releaseReason;
  record.releaseReasonDetail = releaseData.releaseReasonDetail;
  record.affectedEquipment = releaseData.affectedEquipment || [];
  record.status = CompensationRecord.STATUS.RELEASE_REQUEST;

  const ruleValidation = validateCompensationRules(record);
  if (!ruleValidation.isValid) {
    record.validationErrors = ruleValidation.errors;
  }

  if (ruleValidation.needsManual) {
    record.status = CompensationRecord.STATUS.PENDING_MANUAL;
    record.explanation = ruleValidation.explanation;
  }

  await record.save();

  await StatusHistory.create({
    recordId: record.id,
    previousStatus: CompensationRecord.STATUS.BOOKED,
    newStatus: record.status,
    changedBy,
    changeReason: `申请释放: ${releaseData.releaseReason}`,
    metadata: { releaseData }
  });

  return {
    success: true,
    data: await getRecordDetail(record.id),
    needsManual: ruleValidation.needsManual
  };
}

async function approveRelease(recordId, approvedBy = null) {
  const record = await CompensationRecord.findByPk(recordId);
  if (!record) {
    return { success: false, error: '记录不存在' };
  }

  const validStatuses = [CompensationRecord.STATUS.RELEASE_REQUEST, CompensationRecord.STATUS.PENDING_MANUAL];
  if (!validStatuses.includes(record.status)) {
    return { success: false, error: `当前状态"${record.status}"不允许审批释放` };
  }

  const previousStatus = record.status;
  record.status = CompensationRecord.STATUS.RELEASED;
  record.approvedBy = approvedBy;
  record.approvedAt = new Date();
  await record.save();

  await StatusHistory.create({
    recordId: record.id,
    previousStatus,
    newStatus: CompensationRecord.STATUS.RELEASED,
    changedBy,
    changeReason: '审批通过，已释放会议室'
  });

  return {
    success: true,
    data: await getRecordDetail(record.id)
  };
}

async function startCompensation(recordId, compensationAmount, approvedBy = null) {
  const record = await CompensationRecord.findByPk(recordId);
  if (!record) {
    return { success: false, error: '记录不存在' };
  }

  if (record.status !== CompensationRecord.STATUS.RELEASED && record.status !== CompensationRecord.STATUS.PENDING_MANUAL) {
    return { success: false, error: `当前状态"${record.status}"不允许启动补偿` };
  }

  const previousStatus = record.status;
  record.status = CompensationRecord.STATUS.COMPENSATING;
  record.compensationAmount = compensationAmount;
  await record.save();

  await StatusHistory.create({
    recordId: record.id,
    previousStatus,
    newStatus: CompensationRecord.STATUS.COMPENSATING,
    changedBy: approvedBy,
    changeReason: `启动补偿，补偿金额: ¥${compensationAmount}`,
    metadata: { compensationAmount }
  });

  return {
    success: true,
    data: await getRecordDetail(record.id)
  };
}

async function completeCompensation(recordId, approvedBy = null) {
  const record = await CompensationRecord.findByPk(recordId);
  if (!record) {
    return { success: false, error: '记录不存在' };
  }

  if (record.status !== CompensationRecord.STATUS.COMPENSATING) {
    return { success: false, error: `当前状态"${record.status}"不允许完成补偿` };
  }

  record.status = CompensationRecord.STATUS.COMPLETED;
  record.completedAt = new Date();
  await record.save();

  await StatusHistory.create({
    recordId: record.id,
    previousStatus: CompensationRecord.STATUS.COMPENSATING,
    newStatus: CompensationRecord.STATUS.COMPLETED,
    changedBy: approvedBy,
    changeReason: '补偿完成'
  });

  return {
    success: true,
    data: await getRecordDetail(record.id)
  };
}

async function rejectRecord(recordId, rejectReason, rejectedBy = null) {
  const record = await CompensationRecord.findByPk(recordId);
  if (!record) {
    return { success: false, error: '记录不存在' };
  }

  const previousStatus = record.status;
  record.status = CompensationRecord.STATUS.REJECTED;
  await record.save();

  await StatusHistory.create({
    recordId: record.id,
    previousStatus,
    newStatus: CompensationRecord.STATUS.REJECTED,
    changedBy: rejectedBy,
    changeReason: `拒绝: ${rejectReason}`
  });

  return {
    success: true,
    data: await getRecordDetail(record.id)
  };
}

async function getRecordDetail(recordId) {
  const record = await CompensationRecord.findByPk(recordId, {
    include: [
      { model: Room, attributes: ['id', 'name', 'location', 'capacity'] },
      { model: User, attributes: ['id', 'name', 'email', 'department'] }
    ]
  });

  if (!record) return null;

  const history = await StatusHistory.findAll({
    where: { recordId },
    include: [{ model: User, as: 'changer', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']]
  });

  return {
    ...record.toJSON(),
    history
  };
}

async function getRecords(query = {}) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.roomId) where.roomId = query.roomId;
  if (query.userId) where.userId = query.userId;
  if (query.releaseReason) where.releaseReason = query.releaseReason;

  const { page = 1, pageSize = 20 } = query;
  const offset = (page - 1) * pageSize;

  const { count, rows } = await CompensationRecord.findAndCountAll({
    where,
    include: [
      { model: Room, attributes: ['id', 'name', 'location'] },
      { model: User, attributes: ['id', 'name', 'department'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(pageSize),
    offset: parseInt(offset)
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(count / pageSize)
    }
  };
}

async function getRecordHistory(recordId) {
  return await StatusHistory.findAll({
    where: { recordId },
    include: [{ model: User, as: 'changer', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']]
  });
}

async function checkConflicts(roomId, startTime, endTime, excludeRecordId = null) {
  const where = {
    roomId,
    status: {
      [Op.in]: [CompensationRecord.STATUS.BOOKED, CompensationRecord.STATUS.RELEASE_REQUEST]
    },
    [Op.and]: [
      { startTime: { [Op.lt]: endTime } },
      { endTime: { [Op.gt]: startTime } }
    ]
  };

  if (excludeRecordId) {
    where.id = { [Op.ne]: excludeRecordId };
  }

  const conflicts = await CompensationRecord.findAll({
    where,
    include: [
      { model: User, attributes: ['id', 'name'] },
      { model: Room, attributes: ['id', 'name'] }
    ]
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

module.exports = {
  createRecord,
  requestRelease,
  approveRelease,
  startCompensation,
  completeCompensation,
  rejectRecord,
  getRecordDetail,
  getRecords,
  getRecordHistory,
  checkConflicts
};
