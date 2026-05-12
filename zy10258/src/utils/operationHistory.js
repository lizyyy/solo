const { runAsync } = require('../database/connection');

const recordOperation = async (packageId, waybillNo, operationType, operator, operationDesc) => {
  try {
    await runAsync(
      'INSERT INTO operation_history (package_id, waybill_no, operation_type, operator, operation_desc) VALUES (?, ?, ?, ?, ?)',
      [packageId, waybillNo, operationType, operator, operationDesc]
    );
  } catch (error) {
    console.error('记录操作历史失败:', error);
  }
};

module.exports = {
  recordOperation
};
