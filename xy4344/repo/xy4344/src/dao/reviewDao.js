const db = require('../database');

const REVIEW_TYPES = {
  SUBTITLE: 'subtitle',
  VOCABULARY: 'vocabulary',
  SEGMENT: 'segment',
  FEEDBACK: 'feedback',
  ISSUE: 'issue'
};

const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  NEEDS_FIX: 'needs_fix',
  DEFERRED: 'deferred'
};

async function saveReview(review) {
  const existing = await db.get(
    `SELECT id FROM reviews WHERE item_type = ? AND item_id = ?`,
    [review.itemType, review.itemId]
  );
  
  if (existing) {
    await db.run(`
      UPDATE reviews 
      SET reviewer = ?, comment = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [review.reviewer || '', review.comment || '', review.status || REVIEW_STATUS.PENDING, existing.id]);
    return existing.id;
  } else {
    const result = await db.run(`
      INSERT INTO reviews (item_type, item_id, reviewer, comment, status)
      VALUES (?, ?, ?, ?, ?)
    `, [
      review.itemType,
      review.itemId,
      review.reviewer || '',
      review.comment || '',
      review.status || REVIEW_STATUS.PENDING
    ]);
    return result.lastID;
  }
}

async function getAllReviews() {
  return db.all(`SELECT * FROM reviews ORDER BY updated_at DESC`);
}

async function getReviewsByType(itemType) {
  return db.all(
    `SELECT * FROM reviews WHERE item_type = ? ORDER BY updated_at DESC`,
    [itemType]
  );
}

async function getReviewById(id) {
  return db.get(`SELECT * FROM reviews WHERE id = ?`, [id]);
}

async function getReviewByItem(itemType, itemId) {
  return db.get(
    `SELECT * FROM reviews WHERE item_type = ? AND item_id = ?`,
    [itemType, itemId]
  );
}

async function updateReviewStatus(id, status, comment) {
  return db.run(`
    UPDATE reviews 
    SET status = ?, comment = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [status, comment || '', id]);
}

async function getReviewStats() {
  const total = await db.get(`SELECT COUNT(*) as count FROM reviews`);
  
  const byType = await db.all(`
    SELECT item_type, COUNT(*) as count 
    FROM reviews 
    GROUP BY item_type 
    ORDER BY count DESC
  `);
  
  const byStatus = await db.all(`
    SELECT status, COUNT(*) as count 
    FROM reviews 
    GROUP BY status 
    ORDER BY count DESC
  `);
  
  return {
    total: total ? total.count : 0,
    byType,
    byStatus
  };
}

async function getPendingReviews() {
  return db.all(
    `SELECT * FROM reviews WHERE status = 'pending' ORDER BY created_at ASC`
  );
}

module.exports = {
  REVIEW_TYPES,
  REVIEW_STATUS,
  saveReview,
  getAllReviews,
  getReviewsByType,
  getReviewById,
  getReviewByItem,
  updateReviewStatus,
  getReviewStats,
  getPendingReviews
};
