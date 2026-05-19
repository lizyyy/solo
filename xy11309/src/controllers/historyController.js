const { getAll, getOne } = require('../database/db');

async function getOperationHistory(req, res) {
  try {
    const { operation_type, entity_type, operator, start_date, end_date } = req.query;
    let sql = 'SELECT * FROM operation_history WHERE 1=1';
    const params = [];

    if (operation_type) {
      sql += ' AND operation_type = ?';
      params.push(operation_type);
    }
    if (entity_type) {
      sql += ' AND entity_type = ?';
      params.push(entity_type);
    }
    if (operator) {
      sql += ' AND operator LIKE ?';
      params.push(`%${operator}%`);
    }
    if (start_date) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY created_at DESC LIMIT 500';
    const history = await getAll(sql, params);

    const parsedHistory = history.map(item => {
      try {
        return { ...item, details: JSON.parse(item.details) };
      } catch {
        return item;
      }
    });
    
    res.json({ success: true, data: parsedHistory, total: parsedHistory.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getHistoryById(req, res) {
  try {
    const history = await getOne('SELECT * FROM operation_history WHERE id = ?', [req.params.id]);
    if (!history) {
      return res.status(404).json({ success: false, error: '未找到该操作记录' });
    }

    try {
      history.details = JSON.parse(history.details);
    } catch {}

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getOperationHistory,
  getHistoryById
};
