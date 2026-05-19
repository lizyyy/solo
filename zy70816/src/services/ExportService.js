const { Parser } = require('json2csv');
const db = require('../config/database');

class ExportService {
  static exportBatches(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT b.batch_no, p.product_code, p.product_name, p.category, p.specification,
                         s.supplier_name, b.production_date, b.expiry_date, b.quantity,
                         b.status, b.is_frozen, b.frozen_reason, b.frozen_by, b.frozen_at,
                         b.created_by, b.created_at
                  FROM batches b
                  LEFT JOIN products p ON b.product_id = p.id
                  LEFT JOIN suppliers s ON b.supplier_id = s.id
                  WHERE 1=1`;
      const params = [];

      if (filters.status) {
        sql += ` AND b.status = ?`;
        params.push(filters.status);
      }
      if (filters.is_frozen !== undefined) {
        sql += ` AND b.is_frozen = ?`;
        params.push(filters.is_frozen ? 1 : 0);
      }

      sql += ` ORDER BY b.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const fields = [
          { label: '批号', value: 'batch_no' },
          { label: '产品编码', value: 'product_code' },
          { label: '产品名称', value: 'product_name' },
          { label: '分类', value: 'category' },
          { label: '规格', value: 'specification' },
          { label: '供应商', value: 'supplier_name' },
          { label: '生产日期', value: 'production_date' },
          { label: '有效期', value: 'expiry_date' },
          { label: '数量', value: 'quantity' },
          { label: '状态', value: 'status' },
          { label: '是否冻结', value: row => row.is_frozen ? '是' : '否' },
          { label: '冻结原因', value: 'frozen_reason' },
          { label: '冻结人', value: 'frozen_by' },
          { label: '冻结时间', value: 'frozen_at' },
          { label: '创建人', value: 'created_by' },
          { label: '创建时间', value: 'created_at' }
        ];

        try {
          const json2csvParser = new Parser({ fields });
          const csv = json2csvParser.parse(rows);
          resolve({ csv, count: rows.length });
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  }

  static exportApprovalHistory(batch_id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT a.action, a.status, a.reason, a.handler, a.notes,
                           a.previous_status, a.created_at, b.batch_no, p.product_name
                    FROM approvals a
                    LEFT JOIN batches b ON a.batch_id = b.id
                    LEFT JOIN products p ON b.product_id = p.id
                    WHERE a.batch_id = ?
                    ORDER BY a.created_at ASC`;

      db.all(sql, [batch_id], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const fields = [
          { label: '批号', value: 'batch_no' },
          { label: '产品名称', value: 'product_name' },
          { label: '操作', value: 'action' },
          { label: '状态', value: 'status' },
          { label: '原因', value: 'reason' },
          { label: '处理人', value: 'handler' },
          { label: '备注', value: 'notes' },
          { label: '之前状态', value: 'previous_status' },
          { label: '处理时间', value: 'created_at' }
        ];

        try {
          const json2csvParser = new Parser({ fields });
          const csv = json2csvParser.parse(rows);
          resolve({ csv, count: rows.length });
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  }

  static exportInventory(store_id = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT i.id, b.batch_no, p.product_code, p.product_name,
                         s.store_name, i.quantity, i.warehouse_location,
                         b.expiry_date, b.status, b.is_frozen
                  FROM inventory i
                  LEFT JOIN batches b ON i.batch_id = b.id
                  LEFT JOIN products p ON b.product_id = p.id
                  LEFT JOIN stores s ON i.store_id = s.id
                  WHERE 1=1`;
      const params = [];

      if (store_id) {
        sql += ` AND i.store_id = ?`;
        params.push(store_id);
      }

      sql += ` ORDER BY s.store_name, b.expiry_date ASC`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const fields = [
          { label: '批号', value: 'batch_no' },
          { label: '产品编码', value: 'product_code' },
          { label: '产品名称', value: 'product_name' },
          { label: '门店', value: 'store_name' },
          { label: '库存数量', value: 'quantity' },
          { label: '库位', value: 'warehouse_location' },
          { label: '有效期', value: 'expiry_date' },
          { label: '批次状态', value: 'status' },
          { label: '是否冻结', value: row => row.is_frozen ? '是' : '否' }
        ];

        try {
          const json2csvParser = new Parser({ fields });
          const csv = json2csvParser.parse(rows);
          resolve({ csv, count: rows.length });
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  }

  static exportTransfers() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT t.transfer_no, b.batch_no, p.product_name,
                          s1.store_name as from_store, s2.store_name as to_store,
                          t.quantity, t.reason, t.status, t.confirmed_by,
                          t.confirmed_at, t.created_by, t.created_at
                   FROM transfers t
                   LEFT JOIN batches b ON t.batch_id = b.id
                   LEFT JOIN products p ON b.product_id = p.id
                   LEFT JOIN stores s1 ON t.from_store_id = s1.id
                   LEFT JOIN stores s2 ON t.to_store_id = s2.id
                   ORDER BY t.created_at DESC`;

      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const fields = [
          { label: '调拨单号', value: 'transfer_no' },
          { label: '批号', value: 'batch_no' },
          { label: '产品名称', value: 'product_name' },
          { label: '调出门店', value: 'from_store' },
          { label: '调入门店', value: 'to_store' },
          { label: '数量', value: 'quantity' },
          { label: '原因', value: 'reason' },
          { label: '状态', value: 'status' },
          { label: '确认人', value: 'confirmed_by' },
          { label: '确认时间', value: 'confirmed_at' },
          { label: '创建人', value: 'created_by' },
          { label: '创建时间', value: 'created_at' }
        ];

        try {
          const json2csvParser = new Parser({ fields });
          const csv = json2csvParser.parse(rows);
          resolve({ csv, count: rows.length });
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  }
}

module.exports = ExportService;
