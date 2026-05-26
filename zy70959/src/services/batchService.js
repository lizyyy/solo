const crypto = require('crypto');
const { run, get, all } = require('../database');

function calculateBatchHash(records) {
  const sorted = JSON.stringify(records.sort((a, b) => {
    const keyA = `${a.student_id}-${a.repair_date}-${a.repair_type}`;
    const keyB = `${b.student_id}-${b.repair_date}-${b.repair_type}`;
    return keyA.localeCompare(keyB);
  }));
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

async function findDuplicateBatch(hash) {
  return get('SELECT * FROM batches WHERE batch_hash = ?', [hash]);
}

async function createBatch(batchName, createdBy, records) {
  const hash = calculateBatchHash(records);
  const existing = await findDuplicateBatch(hash);
  
  if (existing) {
    const existingRecords = await all('SELECT * FROM maintenance_records WHERE batch_id = ?', [existing.id]);
    return {
      isDuplicate: true,
      batch: existing,
      records: existingRecords
    };
  }

  const batchResult = await run(
    'INSERT INTO batches (batch_hash, batch_name, created_by, raw_data, status) VALUES (?, ?, ?, ?, ?)',
    [hash, batchName, createdBy, JSON.stringify(records), 'processing']
  );
  const batchId = batchResult.lastID;

  for (const record of records) {
    const finalScore = record.initial_score;
    await run(
      `INSERT INTO maintenance_records 
       (batch_id, dormitory, room_number, student_id, student_name, repair_type, repair_date, 
        initial_score, initial_comment, final_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        record.dormitory,
        record.room_number,
        record.student_id,
        record.student_name,
        record.repair_type,
        record.repair_date,
        record.initial_score,
        record.initial_comment || '',
        finalScore
      ]
    );
  }

  const newBatch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  const newRecords = await all('SELECT * FROM maintenance_records WHERE batch_id = ?', [batchId]);

  return {
    isDuplicate: false,
    batch: newBatch,
    records: newRecords
  };
}

async function getBatchById(id) {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [id]);
  if (!batch) return null;
  
  const records = await all('SELECT * FROM maintenance_records WHERE batch_id = ?', [id]);
  return { batch, records };
}

async function getAllBatches() {
  return all('SELECT * FROM batches ORDER BY created_at DESC');
}

async function updateBatchStatus(batchId, status, errorMessage = null) {
  const validStatuses = ['processing', 'failed', 'manual_confirm', 'exported'];
  if (!validStatuses.includes(status)) {
    throw new Error('无效的状态值');
  }
  
  await run('UPDATE batches SET status = ?, error_message = ? WHERE id = ?', [status, errorMessage, batchId]);
  
  return getBatchById(batchId);
}

module.exports = {
  calculateBatchHash,
  findDuplicateBatch,
  createBatch,
  getBatchById,
  getAllBatches,
  updateBatchStatus
};
