const { v4: uuidv4 } = require('uuid');
const { getDbSync } = require('../db/connection');
const {
  getBatchById,
  updateBatchStatus,
  CONTAINER_VOLUME
} = require('./batchService');
const {
  getDonationById,
  updateDonationStatus
} = require('./donationService');

const VERIFICATION_STATUSES = ['pending', 'verified', 'failed'];
const RECALL_STATUSES = ['in_progress', 'completed', 'partial', 'cancelled'];

function distributeBatch(batchId, recipientId, containersUsed, verifiedBy = null, notes = null) {
  const db = getDbSync();
  const batch = getBatchById(batchId);

  if (!batch) {
    throw new Error('批次不存在');
  }

  if (!['frozen', 'partial_distributed'].includes(batch.status)) {
    throw new Error(`只有 frozen 或 partial_distributed 状态的批次才能发放。当前状态: ${batch.status}`);
  }

  if (containersUsed <= 0) {
    throw new Error('发放容器数量必须大于0');
  }

  const distributions = db.prepare(
    'SELECT * FROM distribution_records WHERE batch_id = ?'
  ).all(batchId);

  const totalContainersUsed = distributions.reduce((sum, d) => sum + d.containers_used, 0);
  const available = batch.container_count - totalContainersUsed;

  if (containersUsed > available) {
    throw new Error(`发放数量超出可用库存。可用: ${available}, 申请: ${containersUsed}`);
  }

  const containerVolume = CONTAINER_VOLUME[batch.container_type] || 0;
  const distributedQuantity = containerVolume * containersUsed;

  const now = new Date().toISOString();
  const distributionDate = now.slice(0, 10);
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO distribution_records (
      id, batch_id, recipient_id, distributed_quantity_ml, containers_used,
      distribution_date, verified_by, verification_status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id, batchId, recipientId, distributedQuantity, containersUsed,
    distributionDate, verifiedBy, verifiedBy ? 'verified' : 'pending',
    notes, now, now
  );

  const newTotalUsed = totalContainersUsed + containersUsed;
  if (newTotalUsed >= batch.container_count) {
    updateBatchStatus(batchId, 'fully_distributed', `所有 ${batch.container_count} 个容器已全部发放`);
    
    const allBatches = db.prepare(
      'SELECT * FROM frozen_batches WHERE donation_id = ?'
    ).all(batch.donation_id);
    
    const allDistributed = allBatches.every(b =>
      ['fully_distributed', 'recalled'].includes(b.status)
    );
    
    if (allDistributed) {
      updateDonationStatus(batch.donation_id, 'distributed', '所有批次已发放或召回');
    }
  } else {
    updateBatchStatus(batchId, 'partial_distributed', `已发放 ${newTotalUsed}/${batch.container_count} 个容器`);
  }

  return getDistributionById(id);
}

function getDistributionById(id) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM distribution_records WHERE id = ?').get(id);
}

function getDistributionsByBatch(batchId) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM distribution_records WHERE batch_id = ?').all(batchId);
}

function getDistributionsByRecipient(recipientId) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM distribution_records WHERE recipient_id = ?').all(recipientId);
}

function verifyDistribution(id, verifiedBy, notes = null) {
  if (!verifiedBy) {
    throw new Error('核验人不能为空');
  }

  const db = getDbSync();
  const distribution = getDistributionById(id);

  if (!distribution) {
    return null;
  }

  if (distribution.verification_status === 'verified') {
    return {
      ...distribution,
      _message: '该发放记录已核验'
    };
  }

  const now = new Date().toISOString();
  const newNotes = notes
    ? (distribution.notes ? distribution.notes + ' | ' : '') + notes
    : distribution.notes;

  db.prepare(`
    UPDATE distribution_records
    SET verified_by = ?, verification_status = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(verifiedBy, 'verified', newNotes, now, id);

  return getDistributionById(id);
}

function failDistributionVerification(id, reason, notes = null) {
  if (!reason) {
    throw new Error('核验失败必须提供原因');
  }

  const db = getDbSync();
  const distribution = getDistributionById(id);

  if (!distribution) {
    return null;
  }

  const now = new Date().toISOString();
  const newNotes = `核验失败原因: ${reason}` + (notes ? ` | ${notes}` : '');

  db.prepare(`
    UPDATE distribution_records
    SET verification_status = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run('failed', newNotes, now, id);

  return getDistributionById(id);
}

function recallBatch(batchId, reason, recalledQuantity = null, recalledContainers = null, notes = null) {
  if (!reason) {
    throw new Error('召回必须提供原因');
  }

  const db = getDbSync();
  const batch = getBatchById(batchId);

  if (!batch) {
    throw new Error('批次不存在');
  }

  if (['frozen', 'partial_distributed', 'fully_distributed'].includes(batch.status) === false) {
    throw new Error(`只有在库或已发放的批次才能召回。当前状态: ${batch.status}`);
  }

  const distributions = getDistributionsByBatch(batchId);

  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO recall_records (
      id, batch_id, reason, recall_date, recalled_quantity_ml,
      recalled_containers, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id, batchId, reason, now.slice(0, 10),
    recalledQuantity, recalledContainers,
    distributions.length > 0 ? 'in_progress' : 'completed',
    notes, now, now
  );

  updateBatchStatus(batchId, 'recalled', `召回原因: ${reason}`);
  
  const donation = getDonationById(batch.donation_id);
  if (donation && donation.status !== 'recalled') {
    updateDonationStatus(batch.donation_id, 'recalled', `包含召回批次: ${batch.batch_code}`);
  }

  return getRecallById(id);
}

function getRecallById(id) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM recall_records WHERE id = ?').get(id);
}

function getRecallsByBatch(batchId) {
  const db = getDbSync();
  return db.prepare('SELECT * FROM recall_records WHERE batch_id = ?').all(batchId);
}

function updateRecallStatus(id, newStatus, recalledQuantity = null, recalledContainers = null, notes = null) {
  if (!RECALL_STATUSES.includes(newStatus)) {
    throw new Error(`无效的召回状态: ${newStatus}`);
  }

  const db = getDbSync();
  const recall = getRecallById(id);

  if (!recall) {
    return null;
  }

  const now = new Date().toISOString();
  const newNotes = notes
    ? (recall.notes ? recall.notes + ' | ' : '') + notes
    : recall.notes;

  db.prepare(`
    UPDATE recall_records
    SET status = ?, recalled_quantity_ml = COALESCE(?, recalled_quantity_ml),
        recalled_containers = COALESCE(?, recalled_containers),
        notes = ?, updated_at = ?
    WHERE id = ?
  `).run(newStatus, recalledQuantity, recalledContainers, newNotes, now, id);

  return getRecallById(id);
}

function getDonationDistributionSummary(donationId) {
  const db = getDbSync();
  const donation = getDonationById(donationId);

  if (!donation) {
    return null;
  }

  const batches = db.prepare(
    'SELECT * FROM frozen_batches WHERE donation_id = ?'
  ).all(donationId);

  const batchIds = batches.map(b => b.id);
  
  let distributions = [];
  if (batchIds.length > 0) {
    const placeholders = batchIds.map(() => '?').join(',');
    distributions = db.prepare(
      `SELECT * FROM distribution_records WHERE batch_id IN (${placeholders})`
    ).all(...batchIds);
  }

  const totalDistributed = distributions.reduce((sum, d) => sum + d.distributed_quantity_ml, 0);
  const totalContainers = distributions.reduce((sum, d) => sum + d.containers_used, 0);
  const uniqueRecipients = [...new Set(distributions.map(d => d.recipient_id))];

  const recalls = db.prepare(`
    SELECT r.* FROM recall_records r
    JOIN frozen_batches b ON r.batch_id = b.id
    WHERE b.donation_id = ?
  `).all(donationId);

  return {
    donation_id: donationId,
    total_donated: donation.quantity_ml,
    total_frozen: batches.reduce((sum, b) => sum + b.volume_ml, 0),
    total_distributed: totalDistributed,
    total_containers_distributed: totalContainers,
    batch_count: batches.length,
    recipient_count: uniqueRecipients.length,
    recipients: uniqueRecipients,
    recall_count: recalls.length,
    batches_summary: batches.map(b => ({
      batch_code: b.batch_code,
      status: b.status,
      volume: b.volume_ml,
      containers: b.container_count
    }))
  };
}

module.exports = {
  VERIFICATION_STATUSES,
  RECALL_STATUSES,
  distributeBatch,
  getDistributionById,
  getDistributionsByBatch,
  getDistributionsByRecipient,
  verifyDistribution,
  failDistributionVerification,
  recallBatch,
  getRecallById,
  getRecallsByBatch,
  updateRecallStatus,
  getDonationDistributionSummary
};
