const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { markIdempotencyComplete } = require('../middleware/idempotency');

const getConsignors = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (keyword) {
      whereClause += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchTerm = `%${keyword}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    const consignors = await db.all(
      `SELECT * FROM consignors ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM consignors ${whereClause}`,
      params
    );
    
    res.json({
      data: consignors,
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

const getConsignorById = async (req, res) => {
  try {
    const consignor = await db.get(
      'SELECT * FROM consignors WHERE id = ?',
      [req.params.id]
    );
    
    if (!consignor) {
      return res.status(404).json({ error: '寄售人不存在' });
    }
    
    res.json(consignor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createConsignor = async (req, res) => {
  try {
    const { name, phone, email, id_card, bank_account, bank_name } = req.body;
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO consignors (id, name, phone, email, id_card, bank_account, bank_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone, email, id_card, bank_account, bank_name]
    );
    
    await markIdempotencyComplete(req.idempotencyKey, id);
    
    const consignor = await db.get('SELECT * FROM consignors WHERE id = ?', [id]);
    res.status(201).json(consignor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateConsignor = async (req, res) => {
  try {
    const { name, phone, email, id_card, bank_account, bank_name, status } = req.body;
    const { id } = req.params;
    
    const existing = await db.get('SELECT * FROM consignors WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: '寄售人不存在' });
    }
    
    await db.run(
      `UPDATE consignors 
       SET name = ?, phone = ?, email = ?, id_card = ?, bank_account = ?, bank_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name || existing.name, phone || existing.phone, email || existing.email, 
       id_card || existing.id_card, bank_account || existing.bank_account, 
       bank_name || existing.bank_name, status || existing.status, id]
    );
    
    const consignor = await db.get('SELECT * FROM consignors WHERE id = ?', [id]);
    res.json(consignor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const batchImportConsignors = async (req, res) => {
  try {
    const consignors = req.body;
    const results = [];
    
    for (const consignor of consignors) {
      const id = uuidv4();
      try {
        await db.run(
          `INSERT INTO consignors (id, name, phone, email, id_card, bank_account, bank_name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, consignor.name, consignor.phone, consignor.email, 
           consignor.id_card, consignor.bank_account, consignor.bank_name]
        );
        results.push({ id, name: consignor.name, success: true });
      } catch (error) {
        results.push({ name: consignor.name, success: false, error: error.message });
      }
    }
    
    res.json({ results, imported: results.filter(r => r.success).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getConsignors,
  getConsignorById,
  createConsignor,
  updateConsignor,
  batchImportConsignors
};
