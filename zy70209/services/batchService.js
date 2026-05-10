const { v4: uuidv4 } = require('uuid');
const { getDbSync } = require('../db/connection');
const {
  getDonationById,
  updateDonationStatus,
  canFreezeDonation,
  getFrozenVolumeUsed,
  isDonationFullyFrozen
} = require('./donationService');

const BATCH_STATUSES = ['frozen', 'partial_distributed', 'fully_distributed', 'recalled', 'expired', 'discarded'];
const CONTAINER_TYPES = ['bag_50ml', 'bag_100ml', 'bag_150ml', 'bag_200ml', 'bottle_30ml', 'syringe_10ml'];

const CONTAINER_VOLUME = {
  'bag_50ml': 50,
  'bag_100ml': 100,
  'bag_150ml': 150,
  'bag_200ml': 200,
  'bottle_30ml': 30,
  'syringe_10ml': 10
};

function generateBatchCode(donationId) {
  const donation = getDonationById(donationId);
  if (!donation) {
    throw new Error('捐赠记录不存在');
  }

  const dateStr = donation.donation_date.replace(/-/g, '').slice(0, 8);
  const db = getDbSync();
  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM frozen_batches WHERE donation_id = ?'
  ).get(donationId).cnt;

  const seq = String(count + 1).padStart(3, '0');
  return `BM-${dateStr}-${donation.donor_id.slice(-4)}-${seq}`;
}

function createFrozenBatch(donationId, containerType, containerCount, freezerLocation, freezerLevel = null) {
  if (!CONTAINER_TYPES.includes(containerType)) {
    throw new Error(`无效的容器类型: ${containerType}。有效类型: ${CONTAINER_TYPES.join(', ')}`);
  }

  if (!canFreezeDonation(donationId)) {
    throw new Error('该捐赠未通过所有必要检测，无法冻存');
  }

  const donation = getDonationById(donationId);
  const containerVolume = CONTAINER_VOLUME[containerType];
  const totalVolume = containerVolume * containerCount;

  const currentFrozen = getFrozenVolumeUsed(donationId);
  const remaining = donation.quantity_ml - currentFrozen;

  if (totalVolume > remaining) {
    throw new Error(`冻存容量超出捐赠剩余量。剩余: ${remaining}ml, 申请: ${totalVolume}ml`);
  }

  const now = new Date().toISOString();
  const freezeDate = now.slice(0, 10);
  
  const expiryDateObj = new Date(now);
  expiryDateObj.setMonth(expiryDateObj.getMonth() + 12);
  const expiryDate = expiryDateObj.toISOString().slice(0, 10);

  const db = getDbSync();
  const id = uuidv4();
  const batchCode = generateBatchCode(donationId);

  const insert = db.prepare(`
    INSERT INTO frozen_batches (
      id, batch_code, donation_id, volume_ml, container_type, container_count,
      freeze_date, freezer_location, freezer_level, status, expiry_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id, batchCode, donationId, totalVolume, containerType, containerCount,
    freezeDate, freezerLocation, freezerLevel, 'frozen', expiryDate, now, now
  );

  if (isDonationFullyFrozen(donationId)) {
    updateDonationStatus(donationId, 'frozen', `所有 ${donation.quantity_ml}ml 已完成冻存`);
  }

  return getBatchById(id);
}

function getBatchById(id) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM frozen_batches WHERE id = ?').get(id);
}

function getBatchByCode(batchCode) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM frozen_batches WHERE batch_code = ?').get(batchCode);
}

function getBatchesByDonation(donationId) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM frozen_batches WHERE donation_id = ?').all(donationId);
}

function getAllBatches(filters = {}) {
  const db = getDbSync();
  let sql = 'SELECT * FROM frozen_batches WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.freezerLocation) {
    sql += ' AND freezer_location = ?';
    params.push(filters.freezerLocation);
  }
  if (filters.batchCode) {
    sql += ' AND batch_code LIKE ?';
    params.push(`%${filters.batchCode}%`);
  }

  sql += ' ORDER BY freeze_date DESC, batch_code ASC';

  return db.prepare(sql).all(...params);
}

function updateBatchStatus(id, newStatus, reason = null) {
  if (!BATCH_STATUSES.includes(newStatus)) {
    throw new Error(`无效的批次状态: ${newStatus}。有效状态: ${BATCH_STATUSES.join(', ')}`);
  }

  const db = getDbSync();
  const batch = getBatchById(id);

  if (!batch) {
    return null;
  }

  if (batch.status === newStatus) {
    return {
      ...batch,
      _message: `批次状态已是 ${newStatus}，无需更新`
    };
  }

  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE frozen_batches
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, now, id);

  if (reason) {
    const donation = getDonationById(batch.donation_id);
    if (donation) {
      const newNotes = (donation.notes ? donation.notes + ' | ' : '') + `批次 ${batch.batch_code}: ${reason}`;
      db.prepare('UPDATE donations SET notes = ?, updated_at = ? WHERE id = ?').run(newNotes, now, batch.donation_id);
    }
  }

  return getBatchById(id);
}

function getBatchWithDetails(id) {
  const db = getDbSync();
  const batch = getBatchById(id);

  if (!batch) {
    return null;
  }

  const donation = getDonationById(batch.donation_id);
  const distributions = db.prepare(
    'SELECT * FROM distribution_records WHERE batch_id = ?'
  ).all(id);
  const recalls = db.prepare(
    'SELECT * FROM recall_records WHERE batch_id = ?'
  ).all(id);

  const totalDistributed = distributions.reduce((sum, d) => sum + d.distributed_quantity_ml, 0);
  const totalContainersUsed = distributions.reduce((sum, d) => sum + d.containers_used, 0);

  return {
    ...batch,
    donation: donation,
    distributions,
    recalls,
    available_volume: batch.volume_ml - totalDistributed,
    available_containers: batch.container_count - totalContainersUsed
  };
}

function getBatchInventory() {
  const db = getDbSync();
  
  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as batch_count,
      SUM(volume_ml) as total_volume,
      SUM(container_count) as total_containers
    FROM frozen_batches
    GROUP BY status
  `).all();

  const result = {};
  BATCH_STATUSES.forEach(s => {
    result[s] = {
      batch_count: 0,
      total_volume: 0,
      total_containers: 0
    };
  });

  stats.forEach(s => {
    result[s.status] = {
      batch_count: s.batch_count,
      total_volume: s.total_volume,
      total_containers: s.total_containers
    };
  });

  return result;
}

function getBatchTraceability(batchId) {
  const db = getDbSync();
  const batch = getBatchById(batchId);

  if (!batch) {
    return null;
  }

  const donation = getDonationById(batch.donation_id);
  const tests = db.prepare(
    'SELECT * FROM test_results WHERE donation_id = ?'
  ).all(batch.donation_id);
  const distributions = db.prepare(
    'SELECT * FROM distribution_records WHERE batch_id = ?'
  ).all(batchId);
  const recalls = db.prepare(
    'SELECT * FROM recall_records WHERE batch_id = ?'
  ).all(batchId);

  return {
    batch,
    donor_id: donation?.donor_id,
    donation,
    test_results: tests,
    distributions,
    recalls,
    affected_recipients: distributions.map(d => d.recipient_id),
    trace_path: [
      { type: 'donation', date: donation?.donation_date, status: donation?.status },
      { type: 'testing', tests: tests.map(t => ({ type: t.test_type, result: t.result })) },
      { type: 'freezing', date: batch.freeze_date, location: batch.freezer_location },
      ...distributions.map(d => ({ type: 'distribution', date: d.distribution_date, recipient: d.recipient_id })),
      ...recalls.map(r => ({ type: 'recall', date: r.recall_date, reason: r.reason }))
    ]
  };
}

module.exports = {
  BATCH_STATUSES,
  CONTAINER_TYPES,
  CONTAINER_VOLUME,
  generateBatchCode,
  createFrozenBatch,
  getBatchById,
  getBatchByCode,
  getBatchesByDonation,
  getAllBatches,
  updateBatchStatus,
  getBatchWithDetails,
  getBatchInventory,
  getBatchTraceability
};
