const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

const getAllSubscriptions = (req, res) => {
  const { app_id, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT sr.*, ca.app_name, ca.app_code, et.event_name, et.event_code, et.category
    FROM subscription_rules sr
    JOIN customer_apps ca ON sr.app_id = ca.id
    JOIN event_types et ON sr.event_type_id = et.id
  `;
  const params = [];
  const conditions = [];

  if (app_id) {
    conditions.push('sr.app_id = ?');
    params.push(app_id);
  }
  if (status) {
    conditions.push('sr.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '查询失败', message: err.message });
    }

    const countQuery = 'SELECT COUNT(*) as total FROM subscription_rules';
    db.get(countQuery, (countErr, countResult) => {
      if (countErr) {
        return res.status(500).json({ error: '统计失败' });
      }

      res.json({
        data: rows.map(row => ({
          ...row,
          filter_config: row.filter_config ? JSON.parse(row.filter_config) : null,
          snapshot_before: row.snapshot_before ? JSON.parse(row.snapshot_before) : null,
          snapshot_after: row.snapshot_after ? JSON.parse(row.snapshot_after) : null
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total
        }
      });
    });
  });
};

const getSubscriptionById = (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT sr.*, ca.app_name, ca.app_code, et.event_name, et.event_code, et.category
     FROM subscription_rules sr
     JOIN customer_apps ca ON sr.app_id = ca.id
     JOIN event_types et ON sr.event_type_id = et.id
     WHERE sr.id = ?`,
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: '查询失败' });
      }
      if (!row) {
        return res.status(404).json({ error: '订阅规则不存在' });
      }

      db.all(
        'SELECT * FROM filter_conditions WHERE subscription_id = ? ORDER BY priority',
        [id],
        (filterErr, filters) => {
          res.json({
            ...row,
            filter_config: row.filter_config ? JSON.parse(row.filter_config) : null,
            snapshot_before: row.snapshot_before ? JSON.parse(row.snapshot_before) : null,
            snapshot_after: row.snapshot_after ? JSON.parse(row.snapshot_after) : null,
            filter_conditions: filters || []
          });
        }
      );
    }
  );
};

const createSubscription = (req, res) => {
  const { app_id, event_type_id, delivery_endpoint, filter_config, filter_conditions } = req.body;

  if (!app_id || !event_type_id) {
    return res.status(400).json({ error: '缺少必填参数: app_id, event_type_id' });
  }

  db.get('SELECT id FROM customer_apps WHERE id = ?', [app_id], (appErr, app) => {
    if (appErr || !app) {
      return res.status(400).json({ error: '应用不存在' });
    }

    db.get('SELECT id FROM event_types WHERE id = ?', [event_type_id], (evtErr, evt) => {
      if (evtErr || !evt) {
        return res.status(400).json({ error: '事件类型不存在' });
      }

      const subscriptionId = uuidv4();
      const idempotencyKey = req.headers['x-idempotency-key'] || uuidv4();

      db.run(
        `INSERT INTO subscription_rules 
         (id, app_id, event_type_id, version, status, is_active, filter_config, delivery_endpoint, idempotency_key)
         VALUES (?, ?, ?, 1, 'pending', 0, ?, ?, ?)`,
        [
          subscriptionId,
          app_id,
          event_type_id,
          filter_config ? JSON.stringify(filter_config) : null,
          delivery_endpoint,
          idempotencyKey
        ],
        function(err) {
          if (err) {
            return res.status(500).json({ error: '创建失败', message: err.message });
          }

          if (filter_conditions && filter_conditions.length > 0) {
            const stmt = db.prepare(
              'INSERT INTO filter_conditions (id, subscription_id, field_name, operator, field_value, logical_operator, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            filter_conditions.forEach((fc, index) => {
              stmt.run(
                uuidv4(),
                subscriptionId,
                fc.field_name,
                fc.operator,
                fc.field_value,
                fc.logical_operator || 'AND',
                index
              );
            });
            stmt.finalize();
          }

          res.status(201).json({
            id: subscriptionId,
            message: '订阅规则创建成功，等待复核',
            status: 'pending'
          });
        }
      );
    });
  });
};

const reviewSubscription = (req, res) => {
  const { id } = req.params;
  const { action, reviewed_by, comment } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '无效的操作，必须是 approve 或 reject' });
  }

  db.get('SELECT * FROM subscription_rules WHERE id = ?', [id], (err, subscription) => {
    if (err) {
      return res.status(500).json({ error: '查询失败' });
    }
    if (!subscription) {
      return res.status(404).json({ error: '订阅规则不存在' });
    }
    if (subscription.status !== 'pending') {
      return res.status(400).json({ error: '只有待复核状态的规则可以执行复核操作' });
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected';
    const isActive = action === 'approve' ? 1 : 0;
    const now = new Date().toISOString();

    const snapshotBefore = {
      status: subscription.status,
      is_active: subscription.is_active,
      filter_config: subscription.filter_config ? JSON.parse(subscription.filter_config) : null
    };

    const snapshotAfter = {
      status: newStatus,
      is_active: isActive,
      filter_config: subscription.filter_config ? JSON.parse(subscription.filter_config) : null,
      reviewed_by,
      comment
    };

    db.run(
      `UPDATE subscription_rules 
       SET status = ?, is_active = ?, reviewed_by = ?, reviewed_at = ?, snapshot_before = ?, snapshot_after = ?, updated_at = ?
       WHERE id = ?`,
      [
        newStatus,
        isActive,
        reviewed_by || 'system',
        now,
        JSON.stringify(snapshotBefore),
        JSON.stringify(snapshotAfter),
        now,
        id
      ],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: '更新失败' });
        }

        res.json({
          id,
          message: `复核${action === 'approve' ? '通过' : '拒绝'}`,
          status: newStatus,
          reviewed_at: now,
          snapshot: { before: snapshotBefore, after: snapshotAfter }
        });
      }
    );
  });
};

const unsubscribe = (req, res) => {
  const { id } = req.params;
  const { reason, operated_by } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'] || uuidv4();

  db.get('SELECT * FROM subscription_rules WHERE id = ?', [id], (err, subscription) => {
    if (err) {
      return res.status(500).json({ error: '查询失败' });
    }
    if (!subscription) {
      return res.status(404).json({ error: '订阅规则不存在' });
    }

    db.get(
      'SELECT id FROM unsubscription_history WHERE subscription_id = ? AND idempotency_key = ?',
      [id, idempotencyKey],
      (dupErr, dup) => {
        if (dup) {
          return res.status(200).json({
            id,
            message: '退订已处理（幂等保护）',
            status: 'unsubscribed',
            _idempotent: true
          });
        }

        const snapshotConfig = {
          app_id: subscription.app_id,
          event_type_id: subscription.event_type_id,
          version: subscription.version,
          filter_config: subscription.filter_config ? JSON.parse(subscription.filter_config) : null
        };

        db.run(
          'BEGIN TRANSACTION',
          (transErr) => {
            if (transErr) return res.status(500).json({ error: '事务启动失败' });

            db.run(
              `UPDATE subscription_rules 
               SET status = 'unsubscribed', is_active = 0, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [id],
              (updateErr) => {
                if (updateErr) {
                  return db.run('ROLLBACK', () => res.status(500).json({ error: '更新订阅状态失败' }));
                }

                db.run(
                  `INSERT INTO unsubscription_history 
                   (id, subscription_id, app_id, event_type_id, reason, operated_by, idempotency_key, snapshot_config)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    uuidv4(),
                    id,
                    subscription.app_id,
                    subscription.event_type_id,
                    reason,
                    operated_by || 'system',
                    idempotencyKey,
                    JSON.stringify(snapshotConfig)
                  ],
                  (insertErr) => {
                    if (insertErr) {
                      return db.run('ROLLBACK', () => res.status(500).json({ error: '记录退订历史失败' }));
                    }

                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        return db.run('ROLLBACK', () => res.status(500).json({ error: '事务提交失败' }));
                      }

                      res.json({
                        id,
                        message: '退订成功',
                        status: 'unsubscribed',
                        unsubscribed_at: new Date().toISOString()
                      });
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

const exportSubscriptions = (req, res) => {
  const { format = 'json', app_id, status } = req.query;

  let query = `
    SELECT sr.id, sr.version, sr.status, ca.app_name, ca.app_code, et.event_name, et.event_code,
           sr.delivery_endpoint, sr.created_at, sr.reviewed_at
    FROM subscription_rules sr
    JOIN customer_apps ca ON sr.app_id = ca.id
    JOIN event_types et ON sr.event_type_id = et.id
  `;
  const params = [];
  const conditions = [];

  if (app_id) {
    conditions.push('sr.app_id = ?');
    params.push(app_id);
  }
  if (status) {
    conditions.push('sr.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY sr.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '导出失败' });
    }

    if (format === 'csv') {
      try {
        const parser = new Parser();
        const csv = parser.parse(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="subscriptions.csv"');
        res.send('\uFEFF' + csv);
      } catch (csvErr) {
        res.status(500).json({ error: 'CSV生成失败' });
      }
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="subscriptions.json"');
      res.json(rows);
    }
  });
};

const getDeliveryRecords = (req, res) => {
  const { subscription_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM delivery_records';
  const params = [];

  if (subscription_id) {
    query += ' WHERE subscription_id = ?';
    params.push(subscription_id);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '查询失败' });
    }

    res.json({
      data: rows.map(row => ({
        ...row,
        event_payload: row.event_payload ? JSON.parse(row.event_payload) : null
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });
  });
};

module.exports = {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  reviewSubscription,
  unsubscribe,
  exportSubscriptions,
  getDeliveryRecords
};
