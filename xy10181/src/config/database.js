const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'quota_approval',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL 池错误', err);
});

module.exports = {
  query: async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return res;
  },
  getClient: async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;
    
    const timeout = setTimeout(() => {
      console.error('数据库连接未在 5 秒内释放');
    }, 5000);
    
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };
    
    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client);
    };
    
    return client;
  },
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
  pool,
};
