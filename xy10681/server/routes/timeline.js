module.exports = (app, db) => {
  app.get('/api/timeline/:volunteer_id', (req, res) => {
    const { volunteer_id } = req.params;
    db.all(`SELECT * FROM timeline WHERE volunteer_id = ? ORDER BY operate_time DESC`, [volunteer_id], (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });

  app.post('/api/timeline', (req, res) => {
    const { volunteer_id, action, description, operator, status, related_id, related_type } = req.body;
    db.run(`INSERT INTO timeline (volunteer_id, action, description, operator, status, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [volunteer_id, action, description, operator, status, related_id, related_type],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ id: this.lastID, message: '添加成功' });
      });
  });
};
