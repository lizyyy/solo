const { processBatch, getDetailWithTrace, addTrace } = require('../services/processingService');
const db = require('../models/database');

const triggerProcessing = async (req, res) => {
  const { batch_id, processor } = req.body;

  if (!batch_id) {
    return res.status(400).json({ error: '批次ID不能为空' });
  }

  try {
    const result = await processBatch(batch_id, processor || 'system');
    res.json({
      success: true,
      message: '处理完成',
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await getDetailWithTrace(id);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

const getDetails = (req, res) => {
  const { batch_id, category } = req.query;
  let sql = 'SELECT * FROM details';
  let params = [];
  let conditions = [];

  if (batch_id) {
    conditions.push('batch_id = ?');
    params.push(batch_id);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
};

const updateDetailCategory = async (req, res) => {
  const { id } = req.params;
  const { category, reason, operator } = req.body;

  if (!category) {
    return res.status(400).json({ error: '分类不能为空' });
  }

  const validCategories = ['normal', 'pending_supplement', 'blocked'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: '无效的分类' });
  }

  try {
    const oldDetail = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM details WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!oldDetail) {
      return res.status(404).json({ error: '明细不存在' });
    }

    await new Promise((resolve, reject) => {
      db.run('UPDATE details SET category = ?, category_reason = ?, processor = ?, processed_at = ? WHERE id = ?',
        [category, reason, operator || 'system', new Date().toISOString(), id], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    await addTrace(id, 'manual_update', oldDetail.category, category, reason || '人工调整', operator || 'system');

    res.json({
      success: true,
      message: '分类更新成功'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  triggerProcessing,
  getDetail,
  getDetails,
  updateDetailCategory
};
