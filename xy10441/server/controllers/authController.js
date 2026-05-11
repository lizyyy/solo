const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
require('dotenv').config();

const register = async (req, res) => {
  try {
    const { username, password, name, email, role } = req.body;
    
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'sales';
    
    const result = await pool.query(
      `INSERT INTO users (username, password, name, email, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, username, name, email, role`,
      [username, hashedPassword, name, email, userRole]
    );
    
    res.status(201).json({
      message: '用户创建成功',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

module.exports = { register, login, getCurrentUser };