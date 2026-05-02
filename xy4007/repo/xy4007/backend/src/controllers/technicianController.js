const db = require('../database/db');

const getTechnicians = (req, res) => {
  db.all(`SELECT * FROM technicians ORDER BY id`, (err, rows) => {
    if (err) {
      console.error('获取维修师傅失败:', err);
      res.status(500).json({ error: '获取维修师傅失败' });
      return;
    }
    res.json(rows);
  });
};

const createTechnician = (req, res) => {
  const { name, phone } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: '维修师傅姓名不能为空' });
    return;
  }

  db.run(`
    INSERT INTO technicians (name, phone) VALUES (?, ?)
  `, [name.trim(), phone || null], function(err) {
    if (err) {
      console.error('创建维修师傅失败:', err);
      res.status(500).json({ error: '创建维修师傅失败' });
      return;
    }

    res.status(201).json({ id: this.lastID, message: '维修师傅创建成功' });
  });
};

const updateTechnician = (req, res) => {
  const { id } = req.params;
  const { name, phone } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: '维修师傅姓名不能为空' });
    return;
  }

  db.run(`
    UPDATE technicians SET name = ?, phone = ? WHERE id = ?
  `, [name.trim(), phone || null, id], function(err) {
    if (err) {
      console.error('更新维修师傅失败:', err);
      res.status(500).json({ error: '更新维修师傅失败' });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: '维修师傅不存在' });
      return;
    }

    res.json({ message: '维修师傅更新成功' });
  });
};

const deleteTechnician = (req, res) => {
  const { id } = req.params;

  db.get(`SELECT COUNT(*) as count FROM orders WHERE technician_id = ?`, [id], (err, row) => {
    if (err) {
      console.error('检查维修师傅关联工单失败:', err);
      res.status(500).json({ error: '检查维修师傅关联工单失败' });
      return;
    }

    if (row.count > 0) {
      res.status(400).json({ error: '该维修师傅有关联工单，无法删除' });
      return;
    }

    db.run(`DELETE FROM technicians WHERE id = ?`, [id], function(err) {
      if (err) {
        console.error('删除维修师傅失败:', err);
        res.status(500).json({ error: '删除维修师傅失败' });
        return;
      }

      if (this.changes === 0) {
        res.status(404).json({ error: '维修师傅不存在' });
        return;
      }

      res.json({ message: '维修师傅删除成功' });
    });
  });
};

module.exports = {
  getTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician
};
