"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
router.get('/', (req, res) => {
    const { merchant_id, status, settlement_month, page = 1, page_size = 20 } = req.query;
    let sql = `
    SELECT s.*, m.name as merchant_name, m.contact_person, m.phone
    FROM settlements s
    LEFT JOIN merchants m ON s.merchant_id = m.id
    WHERE 1=1
  `;
    const params = [];
    if (merchant_id) {
        sql += ' AND s.merchant_id = ?';
        params.push(merchant_id);
    }
    if (status) {
        sql += ' AND s.status = ?';
        params.push(status);
    }
    if (settlement_month) {
        sql += ' AND s.settlement_month = ?';
        params.push(settlement_month);
    }
    const countSql = sql.replace('SELECT s.*, m.name as merchant_name, m.contact_person, m.phone', 'SELECT COUNT(*) as total');
    const total = db_1.db.prepare(countSql).get(...params);
    sql += ' ORDER BY s.settlement_month DESC, s.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(page_size), (Number(page) - 1) * Number(page_size));
    const settlements = db_1.db.prepare(sql).all(...params);
    res.json({
        success: true,
        data: settlements,
        pagination: {
            page: Number(page),
            page_size: Number(page_size),
            total: total.total,
            total_pages: Math.ceil(total.total / Number(page_size))
        }
    });
});
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const settlement = db_1.db.prepare(`
    SELECT s.*, m.name as merchant_name, m.contact_person, m.phone, m.address
    FROM settlements s
    LEFT JOIN merchants m ON s.merchant_id = m.id
    WHERE s.id = ?
  `).get(id);
    if (!settlement) {
        return res.status(404).json({ success: false, message: '结算单不存在' });
    }
    const items = db_1.db.prepare(`
    SELECT si.*, r.receipt_no, r.consumption_date, r.amount as receipt_amount,
           e.name as employee_name, e.department
    FROM settlement_items si
    LEFT JOIN receipts r ON si.receipt_id = r.id
    LEFT JOIN employees e ON r.employee_id = e.id
    WHERE si.settlement_id = ?
    ORDER BY r.consumption_date DESC
  `).all(id);
    res.json({
        success: true,
        data: {
            ...settlement,
            items
        }
    });
});
router.post('/generate', (req, res) => {
    const { merchant_id, settlement_month } = req.body;
    if (!merchant_id || !settlement_month) {
        return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    const existing = db_1.db.prepare(`
    SELECT * FROM settlements 
    WHERE merchant_id = ? AND settlement_month = ?
  `).get(merchant_id, settlement_month);
    if (existing) {
        return res.status(400).json({
            success: false,
            message: `该月份(${settlement_month})已存在结算单`,
            data: { settlement_id: existing.id }
        });
    }
    const pendingReceipts = db_1.db.prepare(`
    SELECT * FROM receipts 
    WHERE merchant_id = ? 
      AND status = 'approved' 
      AND strftime('%Y-%m', consumption_date) = ?
  `).all(merchant_id, settlement_month);
    if (pendingReceipts.length === 0) {
        return res.status(400).json({ success: false, message: '该月份没有待结算的小票' });
    }
    const now = new Date().toISOString();
    const totalAmount = pendingReceipts.reduce((sum, r) => sum + r.amount, 0);
    const settlementId = (0, uuid_1.v4)();
    const insertSettlement = db_1.db.prepare(`
    INSERT INTO settlements (id, merchant_id, settlement_month, total_amount, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `);
    insertSettlement.run(settlementId, merchant_id, settlement_month, totalAmount, now, now);
    const insertItem = db_1.db.prepare(`
    INSERT INTO settlement_items (id, settlement_id, receipt_id, amount)
    VALUES (?, ?, ?, ?)
  `);
    const updateReceipt = db_1.db.prepare(`
    UPDATE receipts SET status = 'settled', updated_at = ? WHERE id = ?
  `);
    const insertLog = db_1.db.prepare(`
    INSERT INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    pendingReceipts.forEach(r => {
        insertItem.run((0, uuid_1.v4)(), settlementId, r.id, r.amount);
        updateReceipt.run(now, r.id);
        insertLog.run((0, uuid_1.v4)(), r.id, 'approved', 'settled', '系统', '参与结算', now);
    });
    res.json({
        success: true,
        data: {
            id: settlementId,
            total_amount: totalAmount,
            receipt_count: pendingReceipts.length
        },
        message: '结算单生成成功'
    });
});
router.put('/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, operator = '管理员' } = req.body;
    if (!['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, message: '无效的状态值' });
    }
    const settlement = db_1.db.prepare('SELECT * FROM settlements WHERE id = ?').get(id);
    if (!settlement) {
        return res.status(404).json({ success: false, message: '结算单不存在' });
    }
    if (settlement.status === 'completed') {
        return res.status(400).json({ success: false, message: '已完成的结算单无法修改' });
    }
    if (status === 'cancelled' && settlement.status === 'completed') {
        return res.status(400).json({ success: false, message: '已完成的结算单无法取消' });
    }
    const now = new Date().toISOString();
    if (status === 'cancelled') {
        const items = db_1.db.prepare('SELECT * FROM settlement_items WHERE settlement_id = ?').all(id);
        const updateReceipt = db_1.db.prepare(`
      UPDATE receipts SET status = 'approved', updated_at = ? WHERE id = ?
    `);
        items.forEach(item => {
            updateReceipt.run(now, item.receipt_id);
        });
    }
    db_1.db.prepare('UPDATE settlements SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    res.json({ success: true, message: '结算单状态更新成功' });
});
exports.default = router;
