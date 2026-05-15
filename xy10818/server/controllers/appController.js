const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const getAllApps = (req, res) => {
  db.all('SELECT * FROM customer_apps ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '查询失败' });
    }
    res.json({ data: rows });
  });
};

const createApp = (req, res) => {
  const { app_name, app_code, callback_url } = req.body;

  if (!app_name || !app_code) {
    return res.status(400).json({ error: '缺少必填参数' });
  }

  const id = uuidv4();
  db.run(
    'INSERT INTO customer_apps (id, app_name, app_code, callback_url) VALUES (?, ?, ?, ?)',
    [id, app_name, app_code, callback_url],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'app_code已存在' });
        }
        return res.status(500).json({ error: '创建失败' });
      }
      res.status(201).json({ id, app_name, app_code, message: '创建成功' });
    }
  );
};

const getAllEventTypes = (req, res) => {
  const { category } = req.query;
  let query = 'SELECT * FROM event_types';
  const params = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '查询失败' });
    }
    res.json({ data: rows });
  });
};

const createEventType = (req, res) => {
  const { event_code, event_name, description, category } = req.body;

  if (!event_code || !event_name) {
    return res.status(400).json({ error: '缺少必填参数' });
  }

  const id = uuidv4();
  db.run(
    'INSERT INTO event_types (id, event_code, event_name, description, category) VALUES (?, ?, ?, ?, ?)',
    [id, event_code, event_name, description, category],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'event_code已存在' });
        }
        return res.status(500).json({ error: '创建失败' });
      }
      res.status(201).json({ id, event_code, event_name, message: '创建成功' });
    }
  );
};

module.exports = {
  getAllApps,
  createApp,
  getAllEventTypes,
  createEventType
};
