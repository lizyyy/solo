const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const logger = require('../logger');
const { createAuditLog } = require('../services/auditService');
const { checkIdempotency, saveIdempotencyResult } = require('../middleware/idempotency');

const router = express.Router();

const claimSchema = Joi.object({
  request_id: Joi.string().required(),
  engineer_code: Joi.string().required(),
  part_code: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  notes: Joi.string().allow(''),
  operator: Joi.string()
});

router.post('/claim', checkIdempotency('claim'), saveIdempotencyResult, async (req, res) => {
  try {
    const { error, value } = claimSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { request_id, engineer_code, part_code, quantity, notes, operator } = value;

    db.get('SELECT id FROM engineers WHERE engineer_code = ?', [engineer_code], (err, engineer) => {
      if (err) {
        logger.error('Database error', { error: err.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      if (!engineer) {
        return res.status(400).json({ success: false, message: 'Engineer not found' });
      }

      db.get('SELECT id, stock_quantity FROM parts WHERE part_code = ?', [part_code], (err, part) => {
        if (err) {
          logger.error('Database error', { error: err.message });
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (!part) {
          return res.status(400).json({ success: false, message: 'Part not found' });
        }
        if (part.stock_quantity < quantity) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock',
            available: part.stock_quantity
          });
        }

        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            logger.error('Failed to start transaction', { error: err.message });
            return res.status(500).json({ success: false, message: 'Internal server error' });
          }

          const claimId = uuidv4();
          const newStock = part.stock_quantity - quantity;

          db.run(
            `INSERT INTO claims (id, request_id, engineer_id, part_id, quantity, status, notes)
             VALUES (?, ?, ?, ?, ?, 'approved', ?)`,
            [claimId, request_id, engineer.id, part.id, quantity, notes],
            (err) => {
              if (err) {
                return db.run('ROLLBACK', () => {
                  logger.error('Failed to create claim', { error: err.message });
                  res.status(500).json({ success: false, message: 'Failed to create claim' });
                });
              }

              db.run(
                'UPDATE parts SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newStock, part.id],
                (err) => {
                  if (err) {
                    return db.run('ROLLBACK', () => {
                      logger.error('Failed to update stock', { error: err.message });
                      res.status(500).json({ success: false, message: 'Failed to update stock' });
                    });
                  }

                  db.run('COMMIT', async (err) => {
                    if (err) {
                      return db.run('ROLLBACK', () => {
                        logger.error('Failed to commit transaction', { error: err.message });
                        res.status(500).json({ success: false, message: 'Internal server error' });
                      });
                    }

                    await createAuditLog('claim', 'claim', claimId, request_id, operator, {
                      engineer_code, part_code, quantity
                    });

                    logger.info('Claim created', { claimId, engineer_code, part_code, quantity });
                    res.json({
                      success: true,
                      message: 'Claim created successfully',
                      data: { id: claimId, engineer_code, part_code, quantity, status: 'approved' }
                    });
                  });
                }
              );
            }
          );
        });
      });
    });
  } catch (err) {
    logger.error('Unexpected error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const installationSchema = Joi.object({
  request_id: Joi.string().required(),
  claim_id: Joi.string().required(),
  customer_name: Joi.string().allow(''),
  customer_phone: Joi.string().allow(''),
  customer_address: Joi.string().allow(''),
  serial_number: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  operator: Joi.string()
});

router.post('/installation', checkIdempotency('installation'), saveIdempotencyResult, async (req, res) => {
  try {
    const { error, value } = installationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { request_id, claim_id, customer_name, customer_phone, customer_address, serial_number, notes, operator } = value;

    db.get('SELECT id, status FROM claims WHERE id = ?', [claim_id], (err, claim) => {
      if (err) {
        logger.error('Database error', { error: err.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      if (!claim) {
        return res.status(400).json({ success: false, message: 'Claim not found' });
      }

      db.get('SELECT id FROM installations WHERE claim_id = ?', [claim_id], async (err, existing) => {
        if (err) {
          logger.error('Database error', { error: err.message });
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (existing) {
          return res.status(400).json({ success: false, message: 'Installation already exists for this claim' });
        }

        const installationId = uuidv4();
        db.run(
          `INSERT INTO installations (id, request_id, claim_id, customer_name, customer_phone, customer_address, serial_number, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [installationId, request_id, claim_id, customer_name, customer_phone, customer_address, serial_number, notes],
          async (err) => {
            if (err) {
              logger.error('Failed to create installation', { error: err.message });
              return res.status(500).json({ success: false, message: 'Failed to create installation' });
            }

            await createAuditLog('installation', 'installation', installationId, request_id, operator, {
              claim_id, serial_number
            });

            logger.info('Installation created', { installationId, claim_id });
            res.json({
              success: true,
              message: 'Installation created successfully',
              data: { id: installationId, claim_id, serial_number }
            });
          }
        );
      });
    });
  } catch (err) {
    logger.error('Unexpected error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const returnSchema = Joi.object({
  request_id: Joi.string().required(),
  claim_id: Joi.string().required(),
  part_code: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  condition: Joi.string().valid('good', 'damaged', 'defective').required(),
  warehouse_keeper: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  operator: Joi.string()
});

router.post('/return', checkIdempotency('return'), saveIdempotencyResult, async (req, res) => {
  try {
    const { error, value } = returnSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { request_id, claim_id, part_code, quantity, condition, warehouse_keeper, notes, operator } = value;

    db.get('SELECT id, part_id, quantity as claim_quantity FROM claims WHERE id = ?', [claim_id], (err, claim) => {
      if (err) {
        logger.error('Database error', { error: err.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      if (!claim) {
        return res.status(400).json({ success: false, message: 'Claim not found' });
      }

      db.get('SELECT id, part_code FROM parts WHERE part_code = ?', [part_code], (err, part) => {
        if (err) {
          logger.error('Database error', { error: err.message });
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (!part || part.id !== claim.part_id) {
          return res.status(400).json({ success: false, message: 'Part does not match claim' });
        }

        db.all('SELECT SUM(quantity) as total_returned FROM returns WHERE claim_id = ?', [claim_id], (err, rows) => {
          if (err) {
            logger.error('Database error', { error: err.message });
            return res.status(500).json({ success: false, message: 'Internal server error' });
          }

          const totalReturned = rows[0]?.total_returned || 0;
          if (totalReturned + quantity > claim.claim_quantity) {
            return res.status(400).json({
              success: false,
              message: 'Return quantity exceeds claimed quantity',
              claimed: claim.claim_quantity,
              returned: totalReturned,
              requested: quantity
            });
          }

          db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              logger.error('Failed to start transaction', { error: err.message });
              return res.status(500).json({ success: false, message: 'Internal server error' });
            }

            const returnId = uuidv4();

            db.run(
              `INSERT INTO returns (id, request_id, claim_id, part_id, quantity, condition, warehouse_keeper, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [returnId, request_id, claim_id, part.id, quantity, condition, warehouse_keeper, notes],
              (err) => {
                if (err) {
                  return db.run('ROLLBACK', () => {
                    logger.error('Failed to create return', { error: err.message });
                    res.status(500).json({ success: false, message: 'Failed to create return' });
                  });
                }

                if (condition === 'good') {
                  db.run(
                    'UPDATE parts SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [quantity, part.id],
                    (err) => {
                      if (err) {
                        return db.run('ROLLBACK', () => {
                          logger.error('Failed to update stock', { error: err.message });
                          res.status(500).json({ success: false, message: 'Failed to update stock' });
                        });
                      }

                      db.run('COMMIT', async (err) => {
                        if (err) {
                          return db.run('ROLLBACK', () => {
                            logger.error('Failed to commit transaction', { error: err.message });
                            res.status(500).json({ success: false, message: 'Internal server error' });
                          });
                        }

                        await createAuditLog('return', 'return', returnId, request_id, operator, {
                          claim_id, part_code, quantity, condition
                        });

                        logger.info('Return created', { returnId, claim_id, quantity });
                        res.json({
                          success: true,
                          message: 'Return created successfully',
                          data: { id: returnId, claim_id, part_code, quantity, condition }
                        });
                      });
                    }
                  );
                } else {
                  db.run('COMMIT', async (err) => {
                    if (err) {
                      return db.run('ROLLBACK', () => {
                        logger.error('Failed to commit transaction', { error: err.message });
                        res.status(500).json({ success: false, message: 'Internal server error' });
                      });
                    }

                    await createAuditLog('return', 'return', returnId, request_id, operator, {
                      claim_id, part_code, quantity, condition
                    });

                    logger.info('Return created', { returnId, claim_id, quantity });
                    res.json({
                      success: true,
                      message: 'Return created successfully',
                      data: { id: returnId, claim_id, part_code, quantity, condition }
                    });
                  });
                }
              }
            );
          });
        });
      });
    });
  } catch (err) {
    logger.error('Unexpected error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const vendorClaimSchema = Joi.object({
  request_id: Joi.string().required(),
  return_id: Joi.string().required(),
  vendor_name: Joi.string().required(),
  claim_amount: Joi.number().min(0).required(),
  notes: Joi.string().allow(''),
  operator: Joi.string()
});

router.post('/vendor-claim', checkIdempotency('vendor-claim'), saveIdempotencyResult, async (req, res) => {
  try {
    const { error, value } = vendorClaimSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { request_id, return_id, vendor_name, claim_amount, notes, operator } = value;

    db.get('SELECT id FROM returns WHERE id = ?', [return_id], (err, returnRecord) => {
      if (err) {
        logger.error('Database error', { error: err.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      if (!returnRecord) {
        return res.status(400).json({ success: false, message: 'Return record not found' });
      }

      db.get('SELECT id FROM vendor_claims WHERE return_id = ?', [return_id], async (err, existing) => {
        if (err) {
          logger.error('Database error', { error: err.message });
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (existing) {
          return res.status(400).json({ success: false, message: 'Vendor claim already exists for this return' });
        }

        const vendorClaimId = uuidv4();
        db.run(
          `INSERT INTO vendor_claims (id, request_id, return_id, vendor_name, claim_amount, status, notes)
           VALUES (?, ?, ?, ?, ?, 'submitted', ?)`,
          [vendorClaimId, request_id, return_id, vendor_name, claim_amount, notes],
          async (err) => {
            if (err) {
              logger.error('Failed to create vendor claim', { error: err.message });
              return res.status(500).json({ success: false, message: 'Failed to create vendor claim' });
            }

            await createAuditLog('vendor_claim', 'vendor_claim', vendorClaimId, request_id, operator, {
              return_id, vendor_name, claim_amount
            });

            logger.info('Vendor claim created', { vendorClaimId, return_id, claim_amount });
            res.json({
              success: true,
              message: 'Vendor claim created successfully',
              data: { id: vendorClaimId, return_id, vendor_name, claim_amount, status: 'submitted' }
            });
          }
        );
      });
    });
  } catch (err) {
    logger.error('Unexpected error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const writeOffSchema = Joi.object({
  request_id: Joi.string().required(),
  claim_id: Joi.string().required(),
  reason: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  approved_by: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  operator: Joi.string()
});

router.post('/write-off', checkIdempotency('write-off'), saveIdempotencyResult, async (req, res) => {
  try {
    const { error, value } = writeOffSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { request_id, claim_id, reason, amount, approved_by, notes, operator } = value;

    db.get('SELECT id FROM claims WHERE id = ?', [claim_id], (err, claim) => {
      if (err) {
        logger.error('Database error', { error: err.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      if (!claim) {
        return res.status(400).json({ success: false, message: 'Claim not found' });
      }

      db.get('SELECT id FROM write_offs WHERE claim_id = ?', [claim_id], async (err, existing) => {
        if (err) {
          logger.error('Database error', { error: err.message });
          return res.status(500).json({ success: false, message: 'Internal server error' });
        }
        if (existing) {
          return res.status(400).json({ success: false, message: 'Write-off already exists for this claim' });
        }

        const writeOffId = uuidv4();
        db.run(
          `INSERT INTO write_offs (id, request_id, claim_id, reason, amount, approved_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [writeOffId, request_id, claim_id, reason, amount, approved_by, notes],
          async (err) => {
            if (err) {
              logger.error('Failed to create write-off', { error: err.message });
              return res.status(500).json({ success: false, message: 'Failed to create write-off' });
            }

            await createAuditLog('write_off', 'write_off', writeOffId, request_id, operator, {
              claim_id, reason, amount
            });

            logger.info('Write-off created', { writeOffId, claim_id, amount });
            res.json({
              success: true,
              message: 'Write-off created successfully',
              data: { id: writeOffId, claim_id, reason, amount }
            });
          }
        );
      });
    });
  } catch (err) {
    logger.error('Unexpected error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/claims', (req, res) => {
  const { engineer_code, status, limit = 100 } = req.query;
  
  let query = `
    SELECT c.*, e.engineer_code, p.part_code, p.part_name
    FROM claims c
    JOIN engineers e ON c.engineer_id = e.id
    JOIN parts p ON c.part_id = p.id
    WHERE 1=1
  `;
  const params = [];
  
  if (engineer_code) {
    query += ' AND e.engineer_code = ?';
    params.push(engineer_code);
  }
  if (status) {
    query += ' AND c.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY c.requested_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      logger.error('Failed to get claims', { error: err.message });
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/returns', (req, res) => {
  const { claim_id, condition, limit = 100 } = req.query;
  
  let query = `
    SELECT r.*, p.part_code, p.part_name
    FROM returns r
    JOIN parts p ON r.part_id = p.id
    WHERE 1=1
  `;
  const params = [];
  
  if (claim_id) {
    query += ' AND r.claim_id = ?';
    params.push(claim_id);
  }
  if (condition) {
    query += ' AND r.condition = ?';
    params.push(condition);
  }
  
  query += ' ORDER BY r.return_date DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      logger.error('Failed to get returns', { error: err.message });
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/vendor-claims', (req, res) => {
  const { status, vendor_name, limit = 100 } = req.query;
  
  let query = `
    SELECT vc.*, r.claim_id, p.part_code
    FROM vendor_claims vc
    JOIN returns r ON vc.return_id = r.id
    JOIN parts p ON r.part_id = p.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND vc.status = ?';
    params.push(status);
  }
  if (vendor_name) {
    query += ' AND vc.vendor_name LIKE ?';
    params.push(`%${vendor_name}%`);
  }
  
  query += ' ORDER BY vc.submitted_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      logger.error('Failed to get vendor claims', { error: err.message });
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.json({ success: true, data: rows });
  });
});

module.exports = router;
