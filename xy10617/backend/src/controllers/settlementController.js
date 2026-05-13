const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { addTimelineEntry } = require('../utils/timeline');
const { Parser } = require('json2csv');

const generateSettlement = async (req, res) => {
  try {
    const { consignor_id, period_start, period_end, generated_by } = req.body;
    
    const existingSettlement = await db.get(
      `SELECT id FROM settlements 
       WHERE consignor_id = ? AND period_start = ? AND period_end = ? AND status = 'pending'`,
      [consignor_id, period_start, period_end]
    );
    
    if (existingSettlement) {
      return res.status(400).json({ error: '该期间已有待结算账单' });
    }
    
    const sales = await db.all(
      `SELECT s.*, b.title 
       FROM sales s
       LEFT JOIN books b ON s.book_id = b.id
       WHERE b.consignor_id = ? AND s.sold_at >= ? AND s.sold_at <= ? AND s.status = 'completed'
       ORDER BY s.sold_at`,
      [consignor_id, period_start, period_end]
    );
    
    const totalSales = sales.reduce((sum, s) => sum + s.sold_price, 0);
    const totalCommission = sales.reduce((sum, s) => sum + (s.platform_fee || 0), 0);
    const totalSettlement = sales.reduce((sum, s) => sum + (s.seller_share || 0), 0);
    
    const settlementId = uuidv4();
    await db.run(
      `INSERT INTO settlements (id, consignor_id, period_start, period_end, total_sales, total_commission, total_settlement, generated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [settlementId, consignor_id, period_start, period_end, totalSales, totalCommission, totalSettlement, generated_by]
    );
    
    for (const sale of sales) {
      const itemId = uuidv4();
      await db.run(
        `INSERT INTO settlement_items (id, settlement_id, book_id, sale_id, sold_price, commission, seller_share)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, settlementId, sale.book_id, sale.id, sale.sold_price, sale.platform_fee, sale.seller_share]
      );
    }
    
    const settlement = await db.get(
      `SELECT s.*, c.name as consignor_name 
       FROM settlements s
       LEFT JOIN consignors c ON s.consignor_id = c.id
       WHERE s.id = ?`,
      [settlementId]
    );
    
    const items = await db.all(
      `SELECT si.*, b.title 
       FROM settlement_items si
       LEFT JOIN books b ON si.book_id = b.id
       WHERE si.settlement_id = ?`,
      [settlementId]
    );
    
    res.status(201).json({ ...settlement, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSettlements = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, consignor_id, status, start_date, end_date, handler } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (consignor_id) {
      whereClause += ' AND s.consignor_id = ?';
      params.push(consignor_id);
    }
    
    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }
    
    if (start_date) {
      whereClause += ' AND s.period_start >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND s.period_end <= ?';
      params.push(end_date);
    }
    
    if (handler) {
      whereClause += ' AND (s.generated_by = ? OR s.paid_by = ?)';
      params.push(handler, handler);
    }
    
    const settlements = await db.all(
      `SELECT s.*, c.name as consignor_name, c.bank_account, c.bank_name
       FROM settlements s
       LEFT JOIN consignors c ON s.consignor_id = c.id
       ${whereClause}
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM settlements s ${whereClause}`,
      params
    );
    
    res.json({
      data: settlements,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult.total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSettlementById = async (req, res) => {
  try {
    const settlement = await db.get(
      `SELECT s.*, c.name as consignor_name, c.phone, c.bank_account, c.bank_name
       FROM settlements s
       LEFT JOIN consignors c ON s.consignor_id = c.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    
    if (!settlement) {
      return res.status(404).json({ error: '结算单不存在' });
    }
    
    const items = await db.all(
      `SELECT si.*, b.title, b.author 
       FROM settlement_items si
       LEFT JOIN books b ON si.book_id = b.id
       WHERE si.settlement_id = ?`,
      [req.params.id]
    );
    
    res.json({ ...settlement, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markSettlementPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paid_by } = req.body;
    
    const settlement = await db.get('SELECT * FROM settlements WHERE id = ?', [id]);
    if (!settlement) {
      return res.status(404).json({ error: '结算单不存在' });
    }
    
    if (settlement.status !== 'pending') {
      return res.status(400).json({ error: '结算单已处理' });
    }
    
    await db.run(
      `UPDATE settlements SET status = 'paid', paid_at = CURRENT_TIMESTAMP, paid_by = ? WHERE id = ?`,
      [paid_by, id]
    );
    
    const updatedSettlement = await db.get('SELECT * FROM settlements WHERE id = ?', [id]);
    res.json(updatedSettlement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const exportSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const settlement = await db.get(
      `SELECT s.*, c.name as consignor_name, c.phone, c.bank_account, c.bank_name
       FROM settlements s
       LEFT JOIN consignors c ON s.consignor_id = c.id
       WHERE s.id = ?`,
      [id]
    );
    
    if (!settlement) {
      return res.status(404).json({ error: '结算单不存在' });
    }
    
    const items = await db.all(
      `SELECT si.*, b.title, b.author 
       FROM settlement_items si
       LEFT JOIN books b ON si.book_id = b.id
       WHERE si.settlement_id = ?`,
      [id]
    );
    
    const csvData = items.map(item => ({
      书籍名称: item.title,
      作者: item.author,
      售价: item.sold_price,
      平台佣金: item.commission,
      寄售人分成: item.seller_share
    }));
    
    csvData.push({
      书籍名称: '合计',
      作者: '',
      售价: settlement.total_sales,
      平台佣金: settlement.total_commission,
      寄售人分成: settlement.total_settlement
    });
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(csvData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=settlement_${id}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  generateSettlement,
  getSettlements,
  getSettlementById,
  markSettlementPaid,
  exportSettlement
};
