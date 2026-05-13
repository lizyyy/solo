const db = require('../database/db');

exports.getAllUsers = (req, res) => {
  db.all('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(users);
  });
};

exports.createUser = (req, res) => {
  const { username, name, role = 'user' } = req.body;

  if (!username || !name) {
    return res.status(400).json({ error: '用户名和姓名必填' });
  }

  const sql = 'INSERT INTO users (username, name, role) VALUES (?, ?, ?)';
  
  db.run(sql, [username, name, role], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: '用户名已存在' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, username, name, role });
  });
};
