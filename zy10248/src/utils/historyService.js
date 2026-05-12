const { ActionHistory } = require('../models');
const { v4: uuidv4 } = require('uuid');

const entityTypeMap = {
  MeetingRoom: 'meeting_room',
  Equipment: 'equipment',
  Booking: 'booking',
  Inspection: 'inspection',
  DamageReport: 'damage_report',
  LiabilityConfirmation: 'liability_confirmation',
  Compensation: 'compensation'
};

const recordHistory = async (entity, action, operatorId, operatorName, remark = '', oldValues = null, newValues = null) => {
  const entityName = entity.constructor.name;
  const entityType = entityTypeMap[entityName];
  
  if (!entityType) {
    console.warn(`Unknown entity type: ${entityName}, skipping history record`);
    return;
  }

  await ActionHistory.create({
    id: uuidv4(),
    entityType,
    entityId: entity.id,
    action,
    actionTime: new Date(),
    operatorId,
    operatorName,
    oldValues,
    newValues,
    remark
  });
};

const recordCreate = async (entity, operatorId, operatorName, remark = '') => {
  await recordHistory(entity, 'create', operatorId, operatorName, remark, null, entity.toJSON());
};

const recordUpdate = async (entity, operatorId, operatorName, oldValues, remark = '') => {
  await recordHistory(entity, 'update', operatorId, operatorName, remark, oldValues, entity.toJSON());
};

const recordDelete = async (entity, operatorId, operatorName, remark = '') => {
  await recordHistory(entity, 'delete', operatorId, operatorName, remark, entity.toJSON(), null);
};

const recordStatusChange = async (entity, oldStatus, newStatus, operatorId, operatorName, remark = '') => {
  await recordHistory(
    entity,
    'status_change',
    operatorId,
    operatorName,
    remark,
    { status: oldStatus },
    { status: newStatus }
  );
};

module.exports = {
  recordHistory,
  recordCreate,
  recordUpdate,
  recordDelete,
  recordStatusChange
};
