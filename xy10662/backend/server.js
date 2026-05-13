import express from 'express';
import cors from 'cors';
import { Parser } from 'json2csv';
import db from './database.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const getMerchantDetails = (merchantId) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM merchants WHERE id = ?`, [merchantId], (err, merchant) => {
      if (err) reject(err);
      if (!merchant) resolve(null);

      db.get(`SELECT * FROM business_licenses WHERE merchant_id = ?`, [merchantId], (err, license) => {
        if (err) reject(err);

        db.all(`SELECT * FROM category_qualifications WHERE merchant_id = ?`, [merchantId], (err, qualifications) => {
          if (err) reject(err);

          db.all(`SELECT * FROM deposit_orders WHERE merchant_id = ?`, [merchantId], (err, deposits) => {
            if (err) reject(err);

            db.all(`SELECT * FROM rejection_supplements WHERE merchant_id = ?`, [merchantId], (err, supplements) => {
              if (err) reject(err);

              db.all(`SELECT * FROM review_comments WHERE merchant_id = ? ORDER BY created_at DESC`, [merchantId], (err, comments) => {
                if (err) reject(err);

                db.all(`SELECT * FROM modification_history WHERE merchant_id = ? ORDER BY modified_at DESC`, [merchantId], (err, history) => {
                  if (err) reject(err);

                  resolve({
                    ...merchant,
                    businessLicense: license,
                    categoryQualifications: qualifications,
                    depositOrders: deposits,
                    rejectionSupplements: supplements,
                    reviewComments: comments,
                    modificationHistory: history
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

app.get('/api/merchants', (req, res) => {
  const { status, keyword } = req.query;
  
  let query = `
    SELECT m.*,
      bl.license_number,
      cq.status as qualification_status,
      do.payment_status as deposit_status
    FROM merchants m
    LEFT JOIN business_licenses bl ON m.id = bl.merchant_id
    LEFT JOIN category_qualifications cq ON m.id = cq.merchant_id
    LEFT JOIN deposit_orders do ON m.id = do.merchant_id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    query += ` AND m.status = ?`;
    params.push(status);
  }

  if (keyword) {
    query += ` AND (m.merchant_name LIKE ? OR m.merchant_code LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  query += ` GROUP BY m.id ORDER BY m.updated_at DESC`;

  db.all(query, params, (err, merchants) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(merchants);
  });
});

app.get('/api/merchants/:id', async (req, res) => {
  try {
    const merchant = await getMerchantDetails(req.params.id);
    if (!merchant) {
      res.status(404).json({ error: '商户不存在' });
      return;
    }
    res.json(merchant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/statistics', (req, res) => {
  db.get(`SELECT COUNT(*) as total FROM merchants`, (err, totalRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.get(`SELECT COUNT(*) as pending FROM merchants WHERE status = 'pending'`, (err, pendingRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.get(`SELECT COUNT(*) as approved FROM merchants WHERE status = 'approved'`, (err, approvedRow) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        db.get(`SELECT COUNT(*) as rejected FROM merchants WHERE status = 'rejected'`, (err, rejectedRow) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          db.get(`SELECT SUM(amount) as totalDeposit FROM deposit_orders WHERE payment_status = 'paid'`, (err, depositRow) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            res.json({
              total: totalRow.total,
              pending: pendingRow.pending,
              approved: approvedRow.approved,
              rejected: rejectedRow.rejected,
              totalDeposit: depositRow.totalDeposit || 0
            });
          });
        });
      });
    });
  });
});

app.post('/api/merchants/:id/validate-qualification', (req, res) => {
  const { id } = req.params;
  const { qualificationId, status, reviewerId, reviewerName, reviewComment } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }

  db.get(`SELECT * FROM category_qualifications WHERE id = ? AND merchant_id = ?`, [qualificationId, id], (err, qualification) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!qualification) {
      return res.status(404).json({ error: '类目资质不存在' });
    }

    const oldStatus = qualification.status;

    db.run(`UPDATE category_qualifications SET status = ?, review_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, reviewComment || '', qualificationId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        db.run(`INSERT INTO modification_history (merchant_id, field_type, field_name, old_value, new_value, modifier_id, modifier_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, 'category_qualification', 'status', oldStatus, status, reviewerId, reviewerName], async (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }

            const merchant = await getMerchantDetails(id);
            res.json({ success: true, merchant });
          });
      });
  });
});

app.post('/api/merchants/:id/reject-supplement', (req, res) => {
  const { id } = req.params;
  const { reviewerId, reviewerName, rejectionReason, supplementItems } = req.body;

  if (!rejectionReason || !supplementItems) {
    return res.status(400).json({ error: '驳回原因和补充项不能为空' });
  }

  db.get(`SELECT * FROM merchants WHERE id = ?`, [id], (err, merchant) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!merchant) {
      return res.status(404).json({ error: '商户不存在' });
    }

    const oldStatus = merchant.status;

    db.run(`INSERT INTO rejection_supplements (merchant_id, reviewer_id, reviewer_name, rejection_reason, supplement_items, status)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, reviewerId, reviewerName, rejectionReason, supplementItems, 'pending'], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        db.run(`UPDATE merchants SET status = 'supplement', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.run(`INSERT INTO modification_history (merchant_id, field_type, field_name, old_value, new_value, modifier_id, modifier_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, 'merchant', 'status', oldStatus, 'supplement', reviewerId, reviewerName], async (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              const updatedMerchant = await getMerchantDetails(id);
              res.json({ success: true, merchant: updatedMerchant });
            });
        });
      });
  });
});

app.post('/api/merchants/:id/review-comment', (req, res) => {
  const { id } = req.params;
  const { reviewerId, reviewerName, comment, reviewResult } = req.body;

  if (!comment || !reviewResult) {
    return res.status(400).json({ error: '审核意见和结果不能为空' });
  }

  if (!['approved', 'rejected'].includes(reviewResult)) {
    return res.status(400).json({ error: '无效的审核结果' });
  }

  db.get(`SELECT * FROM merchants WHERE id = ?`, [id], (err, merchant) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!merchant) {
      return res.status(404).json({ error: '商户不存在' });
    }

    const oldStatus = merchant.status;

    db.run(`INSERT INTO review_comments (merchant_id, reviewer_id, reviewer_name, comment, review_result)
      VALUES (?, ?, ?, ?, ?)`,
      [id, reviewerId, reviewerName, comment, reviewResult], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const newStatus = reviewResult === 'approved' ? 'approved' : 'rejected';
        
        db.run(`UPDATE merchants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, id], (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.run(`INSERT INTO modification_history (merchant_id, field_type, field_name, old_value, new_value, modifier_id, modifier_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, 'merchant', 'status', oldStatus, newStatus, reviewerId, reviewerName], async (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              const updatedMerchant = await getMerchantDetails(id);
              res.json({ success: true, merchant: updatedMerchant });
            });
        });
      });
  });
});

app.put('/api/merchants/:id/business-license', (req, res) => {
  const { id } = req.params;
  const { licenseNumber, legalRepresentative, businessScope, validFrom, validTo, modifierId, modifierName } = req.body;

  db.get(`SELECT * FROM business_licenses WHERE merchant_id = ?`, [id], (err, license) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const changes = [
      { field: 'license_number', old: license.license_number, new: licenseNumber },
      { field: 'legal_representative', old: license.legal_representative, new: legalRepresentative },
      { field: 'business_scope', old: license.business_scope, new: businessScope },
      { field: 'valid_from', old: license.valid_from, new: validFrom },
      { field: 'valid_to', old: license.valid_to, new: validTo }
    ];

    db.run(`UPDATE business_licenses 
      SET license_number = ?, legal_representative = ?, business_scope = ?, valid_from = ?, valid_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE merchant_id = ?`,
      [licenseNumber, legalRepresentative, businessScope, validFrom, validTo, id], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const stmt = db.prepare(`INSERT INTO modification_history 
          (merchant_id, field_type, field_name, old_value, new_value, modifier_id, modifier_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)`);

        changes.forEach(change => {
          if (change.old !== change.new) {
            stmt.run([id, 'business_license', change.field, change.old, change.new, modifierId, modifierName]);
          }
        });

        stmt.finalize(async (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const merchant = await getMerchantDetails(id);
          res.json({ success: true, merchant });
        });
      });
  });
});

app.put('/api/merchants/:id/deposit-order', (req, res) => {
  const { id } = req.params;
  const { orderId, amount, category, paymentStatus, modifierId, modifierName } = req.body;

  db.get(`SELECT * FROM deposit_orders WHERE id = ? AND merchant_id = ?`, [orderId, id], (err, order) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!order) {
      return res.status(404).json({ error: '保证金订单不存在' });
    }

    const oldPaymentStatus = order.payment_status;
    const oldAmount = order.amount;

    db.run(`UPDATE deposit_orders 
      SET amount = ?, category = ?, payment_status = ?, payment_time = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE payment_time END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [amount, category, paymentStatus, paymentStatus, orderId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (oldPaymentStatus !== paymentStatus) {
          db.run(`INSERT INTO modification_history (merchant_id, field_type, field_name, old_value, new_value, modifier_id, modifier_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, 'deposit_order', 'payment_status', oldPaymentStatus, paymentStatus, modifierId, modifierName]);
        }

        if (oldAmount !== amount) {
          db.run(`INSERT INTO modification_history (merchant_id, field_type, field_name, old_value, new_value, modifier_id, modifier_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, 'deposit_order', 'amount', oldAmount, amount, modifierId, modifierName]);
        }

        getMerchantDetails(id).then(merchant => {
          res.json({ success: true, merchant });
        });
      });
  });
});

app.get('/api/export-report', (req, res) => {
  const { reviewerName, startDate, endDate } = req.query;

  let query = `
    SELECT 
      mh.modified_at as处理时间,
      mh.modifier_name as责任人,
      mh.field_type as修改类型,
      mh.field_name as修改字段,
      mh.old_value as修改前值,
      mh.new_value as修改后值,
      m.merchant_name as商户名称,
      m.merchant_code as商户编号,
      m.status as入驻状态
    FROM modification_history mh
    JOIN merchants m ON mh.merchant_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (reviewerName) {
    query += ` AND mh.modifier_name LIKE ?`;
    params.push(`%${reviewerName}%`);
  }

  if (startDate) {
    query += ` AND mh.modified_at >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND mh.modified_at <= ?`;
    params.push(endDate + ' 23:59:59');
  }

  query += ` ORDER BY mh.modified_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const parser = new Parser();
      const csv = parser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=merchant_review_report.csv');
      res.send('\uFEFF' + csv);
    } catch (err) {
      res.status(500).json({ error: '导出失败' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
