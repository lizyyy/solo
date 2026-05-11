const pool = require('../config/database');

const getCustomers = async (req, res) => {
  try {
    const { keyword } = req.query;
    let query = `SELECT * FROM customers ORDER BY created_at DESC`;
    let params = [];
    
    if (keyword) {
      query = `SELECT * FROM customers WHERE name ILIKE $1 OR contact_person ILIKE $1 ORDER BY created_at DESC`;
      params = [`%${keyword}%`];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('获取客户列表失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取客户详情失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, contact_person, contact_phone, contact_email, address, industry } = req.body;
    
    const result = await pool.query(
      `INSERT INTO customers (name, contact_person, contact_phone, contact_email, address, industry, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, contact_person, contact_phone, contact_email, address, industry, req.user.id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('创建客户失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, contact_phone, contact_email, address, industry } = req.body;
    
    const result = await pool.query(
      `UPDATE customers SET name = $1, contact_person = $2, contact_phone = $3, 
       contact_email = $4, address = $5, industry = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name, contact_person, contact_phone, contact_email, address, industry, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('更新客户失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const projects = await pool.query('SELECT id FROM projects WHERE customer_id = $1', [id]);
    if (projects.rows.length > 0) {
      return res.status(400).json({ error: '该客户下存在项目，无法删除' });
    }
    
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    
    res.json({ message: '客户删除成功' });
  } catch (error) {
    console.error('删除客户失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
};