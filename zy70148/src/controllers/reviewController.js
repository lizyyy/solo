const db = require('../db/connection');
const config = require('../config');
const { generateUUID, getTimestamp } = require('../utils/ticketGenerator');
const { updateStatus } = require('../utils/statusManager');
const { getRequestDetail } = require('./requestController');

async function createReview(req, res) {
  try {
    const { request_id } = req.params;
    const {
      reviewer_id,
      reviewer_name,
      review_result,
      review_comments,
      sql_suggestions
    } = req.body;

    if (!reviewer_id || !reviewer_name || !review_result) {
      return res.status(400).json({ error: 'Missing required fields: reviewer_id, reviewer_name, review_result' });
    }

    if (!['approved', 'rejected'].includes(review_result)) {
      return res.status(400).json({ error: 'Invalid review_result. Must be "approved" or "rejected"' });
    }

    const request = await db.get(
      'SELECT current_status FROM repair_requests WHERE id = ? AND is_deleted = 0',
      [request_id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.current_status !== config.status.PENDING_REVIEW) {
      return res.status(400).json({ 
        error: `Request is not pending review. Current status: ${request.current_status}` 
      });
    }

    const reviewId = generateUUID();
    const timestamp = getTimestamp();

    const queries = [
      {
        sql: `INSERT INTO sql_reviews 
              (id, request_id, reviewer_id, reviewer_name, review_result, 
               review_comments, sql_suggestions, approved_at, rejected_at, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          reviewId, request_id, reviewer_id, reviewer_name, review_result,
          review_comments || null, sql_suggestions || null,
          review_result === 'approved' ? timestamp : null,
          review_result === 'rejected' ? timestamp : null,
          timestamp
        ]
      }
    ];

    await db.runTransaction(queries);

    const newStatus = review_result === 'approved' 
      ? config.status.REVIEW_APPROVED 
      : config.status.REVIEW_REJECTED;

    await updateStatus(
      request_id, 
      newStatus, 
      { id: reviewer_id, name: reviewer_name },
      review_comments || `Review ${review_result}`
    );

    const result = await getRequestDetail(request_id);
    const review = await db.get('SELECT * FROM sql_reviews WHERE id = ?', [reviewId]);
    
    res.json({
      message: `Review ${review_result} successfully`,
      review,
      request: result
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getReviewsByRequest(req, res) {
  try {
    const { request_id } = req.params;
    
    const reviews = await db.all(
      `SELECT id, reviewer_id, reviewer_name, review_result, review_comments, 
              sql_suggestions, approved_at, rejected_at, created_at 
       FROM sql_reviews 
       WHERE request_id = ? 
       ORDER BY created_at DESC`,
      [request_id]
    );

    res.json(reviews);
  } catch (error) {
    console.error('Error getting reviews:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getPendingReviews(req, res) {
  try {
    const { reviewer_id, page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);

    let sql = `SELECT r.*, 
                      (SELECT COUNT(*) FROM sql_reviews WHERE request_id = r.id AND reviewer_id = ?) as reviewer_has_reviewed
               FROM repair_requests r 
               WHERE r.current_status = ? AND r.is_deleted = 0`;
    let params = [reviewer_id || '', config.status.PENDING_REVIEW];

    if (reviewer_id) {
      sql += ' AND (SELECT COUNT(*) FROM sql_reviews WHERE request_id = r.id AND reviewer_id = ?) = 0';
      params = [reviewer_id, config.status.PENDING_REVIEW, reviewer_id];
    }

    const countSql = sql.replace('SELECT r.*', 'SELECT COUNT(*) as total');
    const [countResult, requests] = await Promise.all([
      db.get(countSql, params),
      db.all(
        `${sql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      )
    ]);

    res.json({
      total: countResult.total,
      page: parseInt(page),
      page_size: parseInt(page_size),
      data: requests
    });
  } catch (error) {
    console.error('Error getting pending reviews:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createReview,
  getReviewsByRequest,
  getPendingReviews
};