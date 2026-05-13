const db = require('../database');

async function recordHistory(tableName, recordId, fieldName, oldValue, newValue, changedBy) {
  const historyTable = `${tableName}_history`;
  const idField = tableName === 'content_items' ? 'content_id' :
                   tableName === 'rights_holders' ? 'holder_id' :
                   tableName === 'complaint_evidences' ? 'evidence_id' :
                   tableName === 'complaints' ? 'complaint_id' : null;

  if (!idField) {
    throw new Error(`不支持的表名: ${tableName}`);
  }

  await db.run(
    `INSERT INTO ${historyTable} (${idField}, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)`,
    [recordId, fieldName, oldValue, newValue, changedBy]
  );
}

async function getHistory(tableName, recordId) {
  const historyTable = `${tableName}_history`;
  const idField = tableName === 'content_items' ? 'content_id' :
                   tableName === 'rights_holders' ? 'holder_id' :
                   tableName === 'complaint_evidences' ? 'evidence_id' :
                   tableName === 'complaints' ? 'complaint_id' : null;

  if (!idField) {
    throw new Error(`不支持的表名: ${tableName}`);
  }

  return await db.all(
    `SELECT * FROM ${historyTable} WHERE ${idField} = ? ORDER BY changed_at DESC`,
    [recordId]
  );
}

module.exports = { recordHistory, getHistory };
