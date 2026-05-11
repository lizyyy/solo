const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pre_sales_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err.stack);
  } else {
    console.log('数据库连接成功');
  }
});

module.exports = pool;
