const { run, get, all, generateId, getCurrentTime } = require('../utils/database');

async function createBatch(batchData) {
  const batchId = generateId();
  const now = getCurrentTime();
  
  await run(
    `INSERT INTO batches (id, batchName, operator, startDate, endDate, status, rawData, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchId,
      batchData.batchName,
      batchData.operator,
      batchData.period.startDate,
      batchData.period.endDate,
      'created',
      JSON.stringify(batchData.rawData),
      now,
      now
    ]
  );
  
  return getBatchById(batchId);
}

async function getBatchById(batchId) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  
  if (!batch) return null;
  
  return {
    ...batch,
    rawData: batch.rawData ? JSON.parse(batch.rawData) : null
  };
}

async function getBatches(limit = 100, offset = 0) {
  const batches = await all('SELECT * FROM batches ORDER BY createdAt DESC LIMIT ? OFFSET ?', [limit, offset]);
  
  return batches.map(batch => ({
    ...batch,
    rawData: batch.rawData ? JSON.parse(batch.rawData) : null
  }));
}

async function updateBatchStatus(batchId, status) {
  await run(
    `UPDATE batches SET status = ?, updatedAt = ? WHERE id = ?`,
    [status, getCurrentTime(), batchId]
  );
  return getBatchById(batchId);
}

module.exports = {
  createBatch,
  getBatchById,
  getBatches,
  updateBatchStatus
};
