const { runInsert } = require('../database');

async function recordModification(entityType, entityId, fieldName, oldValue, newValue, modifiedBy) {
  if (oldValue === newValue) return;
  
  await runInsert(
    `INSERT INTO modification_history (entity_type, entity_id, field_name, old_value, new_value, modified_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, fieldName, String(oldValue), String(newValue), modifiedBy]
  );
}

async function recordPackageModification(packageId, oldData, newData, modifiedBy) {
  const fields = ['name', 'description', 'price', 'status'];
  for (const field of fields) {
    if (oldData[field] !== newData[field]) {
      await recordModification('package', packageId, field, oldData[field], newData[field], modifiedBy);
    }
  }
}

async function recordItemModification(itemId, oldData, newData, modifiedBy) {
  const fields = ['name', 'description', 'price', 'category'];
  for (const field of fields) {
    if (oldData[field] !== newData[field]) {
      await recordModification('item', itemId, field, oldData[field], newData[field], modifiedBy);
    }
  }
}

async function recordAppointmentModification(appointmentId, oldData, newData, modifiedBy) {
  const fields = ['user_name', 'user_phone', 'package_id', 'appointment_date', 'appointment_time', 'status'];
  for (const field of fields) {
    if (oldData[field] !== newData[field]) {
      await recordModification('appointment', appointmentId, field, oldData[field], newData[field], modifiedBy);
    }
  }
}

module.exports = {
  recordModification,
  recordPackageModification,
  recordItemModification,
  recordAppointmentModification
};
