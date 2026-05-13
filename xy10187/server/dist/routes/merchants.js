"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const router = express_1.default.Router();
router.get('/', (req, res) => {
    const { name } = req.query;
    let sql = 'SELECT * FROM merchants WHERE 1=1';
    const params = [];
    if (name) {
        sql += ' AND name LIKE ?';
        params.push(`%${name}%`);
    }
    sql += ' ORDER BY name';
    const merchants = db_1.db.prepare(sql).all(...params);
    res.json({
        success: true,
        data: merchants
    });
});
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const merchant = db_1.db.prepare('SELECT * FROM merchants WHERE id = ?').get(id);
    if (!merchant) {
        return res.status(404).json({ success: false, message: '商户不存在' });
    }
    const stats = db_1.db.prepare(`
    SELECT 
      COUNT(*) as total_receipts,
      SUM(CASE WHEN status = 'approved' OR status = 'settled' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'approved' OR status = 'settled' THEN amount ELSE 0 END) as approved_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled_count,
      SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END) as settled_amount
    FROM receipts
    WHERE merchant_id = ?
  `).get(id);
    const settlements = db_1.db.prepare(`
    SELECT * FROM settlements 
    WHERE merchant_id = ? 
    ORDER BY settlement_month DESC
    LIMIT 12
  `).all(id);
    res.json({
        success: true,
        data: {
            ...merchant,
            stats,
            recent_settlements: settlements
        }
    });
});
exports.default = router;
