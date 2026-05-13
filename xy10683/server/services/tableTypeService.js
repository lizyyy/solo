const { runQuery, getQuery, allQuery } = require('../database/db');
const { createLog } = require('./operationLogService');

const getAllTableTypes = async () => {
  return await allQuery('SELECT * FROM table_types ORDER BY id');
};

const getTableTypeById = async (id) => {
  return await getQuery('SELECT * FROM table_types WHERE id = ?', [id]);
};

const createTableType = async (data, operator) => {
  const result = await runQuery(
    'INSERT INTO table_types (name, capacity, description) VALUES (?, ?, ?)',
    [data.name, data.capacity, data.description || '']
  );
  await createLog('CREATE', 'table_types', result.id, null, data, operator, '创建桌台类型');
  return result;
};

const updateTableType = async (id, data, operator) => {
  const oldData = await getTableTypeById(id);
  const result = await runQuery(
    'UPDATE table_types SET name = ?, capacity = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [data.name, data.capacity, data.description || '', id]
  );
  await createLog('UPDATE', 'table_types', id, oldData, data, operator, '更新桌台类型');
  return result;
};

const deleteTableType = async (id, operator) => {
  const oldData = await getTableTypeById(id);
  const result = await runQuery('DELETE FROM table_types WHERE id = ?', [id]);
  await createLog('DELETE', 'table_types', id, oldData, null, operator, '删除桌台类型');
  return result;
};

module.exports = {
  getAllTableTypes,
  getTableTypeById,
  createTableType,
  updateTableType,
  deleteTableType
};
