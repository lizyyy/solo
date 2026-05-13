const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../db/database');

const CALLBACK_TYPES = {
  CLEARANCE_SUCCESS: 'clearance_success',
  CLEARANCE_FAILED: 'clearance_failed',
  DOCUMENT_REQUIRED: 'document_required',
  TAX_ADJUSTMENT: 'tax_adjustment',
  INSPECTION_REQUIRED: 'inspection_required',
  RETURNED: 'returned'
};

const FAILURE_REASONS = {
  INCOMPLETE_DOCUMENTS: '资料不完整',
  MISCLASSIFICATION: '商品归类错误',
  VALUE_DISCREPANCY: '申报价值不符',
  PROHIBITED_ITEM: '违禁品',
  WEIGHT_DISCREPANCY: '重量不符',
  ORIGIN_ISSUE: '原产地问题'
};

router.post('/callback/:packageId', async (req, res) => {
  try {
    const { callback_type, status, message, customs_reference, callback_data, operator } = req.body;
    const pkg = await getQuery('SELECT * FROM packages WHERE id = ?', [req.params.packageId]);
    
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }

    const callbackId = uuidv4();
    await runQuery(
      `INSERT INTO customs_callbacks (id, package_id, callback_type, status, message, customs_reference, callback_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [callbackId, req.params.packageId, callback_type, status, message, customs_reference, JSON.stringify(callback_data)]
    );

    let newPackageStatus = pkg.status;
    let ticketNeeded = false;
    let reSubmissionNeeded = false;

    switch (callback_type) {
      case CALLBACK_TYPES.CLEARANCE_SUCCESS:
        newPackageStatus = 'cleared';
        break;
      case CALLBACK_TYPES.CLEARANCE_FAILED:
        newPackageStatus = 'failed';
        break;
      case CALLBACK_TYPES.DOCUMENT_REQUIRED:
      case CALLBACK_TYPES.INSPECTION_REQUIRED:
        newPackageStatus = 'supplement_required';
        ticketNeeded = true;
        break;
      case CALLBACK_TYPES.TAX_ADJUSTMENT:
        newPackageStatus = 'tax_adjusted';
        break;
      case CALLBACK_TYPES.RETURNED:
        newPackageStatus = 'returned';
        reSubmissionNeeded = true;
        break;
    }

    if (newPackageStatus !== pkg.status) {
      await runQuery(
        'UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPackageStatus, req.params.packageId]
      );
    }

    if (ticketNeeded && callback_type === CALLBACK_TYPES.DOCUMENT_REQUIRED) {
      const ticketNumber = `TKT-${Date.now()}`;
      await runQuery(
        `INSERT INTO supplement_tickets (id, package_id, ticket_number, required_documents, current_owner, status, priority)
         VALUES (?, ?, ?, ?, ?, 'open', 'high')`,
        [uuidv4(), req.params.packageId, ticketNumber, JSON.stringify(callback_data?.required_docs || []), operator || 'system']
      );
    }

    if (reSubmissionNeeded) {
      await runQuery(
        `INSERT INTO re_submissions (id, package_id, original_tracking_number, reason, review_status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [uuidv4(), req.params.packageId, pkg.tracking_number, message || '海关退单']
      );
    }

    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details)
       VALUES (?, ?, 'customs_callback', ?, ?)`,
      [uuidv4(), req.params.packageId, operator || 'system', JSON.stringify({ callback_type, status, message })]
    );

    const callback = await getQuery('SELECT * FROM customs_callbacks WHERE id = ?', [callbackId]);
    res.status(201).json(callback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:packageId', async (req, res) => {
  try {
    const callbacks = await allQuery(
      'SELECT * FROM customs_callbacks WHERE package_id = ? ORDER BY created_at DESC',
      [req.params.packageId]
    );
    res.json(callbacks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/types/list', (req, res) => {
  res.json({ types: CALLBACK_TYPES, failure_reasons: FAILURE_REASONS });
});

module.exports = router;
