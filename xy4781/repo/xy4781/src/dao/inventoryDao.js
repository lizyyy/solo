const { runSql, getOne, getAll } = require('../database/connection');

const getInventoryByDrugCode = (drugCode) => {
  return getOne('SELECT * FROM inventory WHERE drug_code = ?', [drugCode]);
};

const getInventoryById = (id) => {
  return getOne('SELECT * FROM inventory WHERE id = ?', [id]);
};

const updateInventoryQuantity = (id, quantity) => {
  return runSql(`
    UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [quantity, id]);
};

const deductInventory = (drugCode, quantity) => {
  return runSql(`
    UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP 
    WHERE drug_code = ? AND quantity >= ?
  `, [quantity, drugCode, quantity]);
};

const addInventory = (drugCode, quantity) => {
  return runSql(`
    UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP 
    WHERE drug_code = ?
  `, [quantity, drugCode]);
};

const createInventoryTransaction = (data) => {
  const { inventoryId, drugCode, drugName, transactionType, quantity, balanceAfter, referenceType, referenceId } = data;
  return runSql(`
    INSERT INTO inventory_transactions (inventory_id, drug_code, drug_name, transaction_type, quantity, balance_after, reference_type, reference_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [inventoryId, drugCode, drugName, transactionType, quantity, balanceAfter, referenceType, referenceId]);
};

const getAllInventory = () => {
  return getAll('SELECT * FROM inventory ORDER BY created_at DESC');
};

const getInventoryTransactionsByReference = (referenceType, referenceId) => {
  return getAll(`
    SELECT * FROM inventory_transactions WHERE reference_type = ? AND reference_id = ?
    ORDER BY created_at
  `, [referenceType, referenceId]);
};

module.exports = {
  getInventoryByDrugCode,
  getInventoryById,
  updateInventoryQuantity,
  deductInventory,
  addInventory,
  createInventoryTransaction,
  getAllInventory,
  getInventoryTransactionsByReference
};
