const { ModificationHistory } = require('../models');

const recordModification = async (tableName, recordId, fieldName, oldValue, newValue, modifiedBy, operationType, reason = null) => {
  try {
    await ModificationHistory.create({
      table_name: tableName,
      record_id: recordId,
      field_name: fieldName,
      old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
      new_value: newValue !== null && newValue !== undefined ? String(newValue) : null,
      modified_by: modifiedBy,
      operation_type: operationType,
      reason: reason
    });
  } catch (error) {
    console.error('记录修改历史失败:', error);
  }
};

const recordCreate = async (tableName, recordId, modifiedBy, data) => {
  for (const [field, value] of Object.entries(data)) {
    await recordModification(tableName, recordId, field, null, value, modifiedBy, 'create');
  }
};

const recordUpdate = async (tableName, recordId, modifiedBy, oldData, newData, reason = null) => {
  for (const [field, newValue] of Object.entries(newData)) {
    const oldValue = oldData[field];
    if (oldValue !== newValue) {
      await recordModification(tableName, recordId, field, oldValue, newValue, modifiedBy, 'update', reason);
    }
  }
};

const recordDelete = async (tableName, recordId, modifiedBy, oldData) => {
  for (const [field, value] of Object.entries(oldData)) {
    await recordModification(tableName, recordId, field, value, null, modifiedBy, 'delete');
  }
};

module.exports = {
  recordModification,
  recordCreate,
  recordUpdate,
  recordDelete
};
