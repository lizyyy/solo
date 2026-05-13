const { runQuery, getQuery, allQuery } = require('../database/db');
const { createLog } = require('./operationLogService');

const getAllTables = async () => {
  return await allQuery(`
    SELECT t.*, tt.name as type_name, tt.capacity 
    FROM tables t 
    LEFT JOIN table_types tt ON t.type_id = tt.id 
    ORDER BY t.table_number
  `);
};

const getAvailableTables = async (typeId = null) => {
  let sql = `
    SELECT t.*, tt.name as type_name, tt.capacity 
    FROM tables t 
    LEFT JOIN table_types tt ON t.type_id = tt.id 
    WHERE t.status = 'available'
  `;
  const params = [];
  if (typeId) {
    sql += ' AND t.type_id = ?';
    params.push(typeId);
  }
  sql += ' ORDER BY t.table_number';
  return await allQuery(sql, params);
};

const getTableById = async (id) => {
  return await getQuery(`
    SELECT t.*, tt.name as type_name, tt.capacity 
    FROM tables t 
    LEFT JOIN table_types tt ON t.type_id = tt.id 
    WHERE t.id = ?
  `, [id]);
};

const createTable = async (data, operator) => {
  const result = await runQuery(
    'INSERT INTO tables (table_number, type_id, status) VALUES (?, ?, ?)',
    [data.table_number, data.type_id, 'available']
  );
  await createLog('CREATE', 'tables', result.id, null, data, operator, '创建桌台');
  return result;
};

const updateTable = async (id, data, operator) => {
  const oldData = await getTableById(id);
  const result = await runQuery(
    'UPDATE tables SET table_number = ?, type_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [data.table_number, data.type_id, data.status || 'available', id]
  );
  await createLog('UPDATE', 'tables', id, oldData, data, operator, '更新桌台');
  return result;
};

const updateTableStatus = async (id, status, operator) => {
  const oldData = await getTableById(id);
  const result = await runQuery(
    'UPDATE tables SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
  await createLog('UPDATE', 'tables', id, { status: oldData.status }, { status }, operator, '更新桌台状态');
  return result;
};

const deleteTable = async (id, operator) => {
  const oldData = await getTableById(id);
  const result = await runQuery('DELETE FROM tables WHERE id = ?', [id]);
  await createLog('DELETE', 'tables', id, oldData, null, operator, '删除桌台');
  return result;
};

module.exports = {
  getAllTables,
  getAvailableTables,
  getTableById,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable
};
