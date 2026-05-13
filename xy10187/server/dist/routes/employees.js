"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const router = express_1.default.Router();
router.get('/', (req, res) => {
    const { department, name } = req.query;
    let sql = `
    SELECT e.*, 
           (monthly_allowance - used_amount) as remaining_amount,
           (used_amount / monthly_allowance * 100) as usage_rate
    FROM employees e
    WHERE 1=1
  `;
    const params = [];
    if (department) {
        sql += ' AND e.department = ?';
        params.push(department);
    }
    if (name) {
        sql += ' AND e.name LIKE ?';
        params.push(`%${name}%`);
    }
    sql += ' ORDER BY e.department, e.name';
    const employees = db_1.db.prepare(sql).all(...params);
    res.json({
        success: true,
        data: employees
    });
});
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const employee = db_1.db.prepare(`
    SELECT e.*, 
           (monthly_allowance - used_amount) as remaining_amount,
           (used_amount / monthly_allowance * 100) as usage_rate
    FROM employees e
    WHERE e.id = ?
  `).get(id);
    if (!employee) {
        return res.status(404).json({ success: false, message: '员工不存在' });
    }
    const receipts = db_1.db.prepare(`
    SELECT r.*, m.name as merchant_name
    FROM receipts r
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE r.employee_id = ?
    ORDER BY r.created_at DESC
    LIMIT 20
  `).all(id);
    const stats = db_1.db.prepare(`
    SELECT 
      COUNT(*) as total_receipts,
      SUM(CASE WHEN status = 'approved' OR status = 'settled' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'approved' OR status = 'settled' THEN amount ELSE 0 END) as approved_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) as duplicate_count
    FROM receipts
    WHERE employee_id = ?
  `).get(id);
    res.json({
        success: true,
        data: {
            ...employee,
            recent_receipts: receipts,
            stats
        }
    });
});
router.get('/:id/receipts', (req, res) => {
    const { id } = req.params;
    const { status, page = 1, page_size = 20 } = req.query;
    let sql = `
    SELECT r.*, m.name as merchant_name
    FROM receipts r
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE r.employee_id = ?
  `;
    const params = [id];
    if (status) {
        sql += ' AND r.status = ?';
        params.push(status);
    }
    const countSql = sql.replace('SELECT r.*, m.name as merchant_name', 'SELECT COUNT(*) as total');
    const total = db_1.db.prepare(countSql).get(...params);
    sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(page_size), (Number(page) - 1) * Number(page_size));
    const receipts = db_1.db.prepare(sql).all(...params);
    res.json({
        success: true,
        data: receipts,
        pagination: {
            page: Number(page),
            page_size: Number(page_size),
            total: total.total,
            total_pages: Math.ceil(total.total / Number(page_size))
        }
    });
});
exports.default = router;
