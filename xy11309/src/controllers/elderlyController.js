const { getAll, getOne, runQuery, recordHistory } = require('../database/db');
const Joi = require('joi');

const elderlySchema = Joi.object({
  name: Joi.string().required(),
  id_card: Joi.string().allow(''),
  phone: Joi.string().allow(''),
  address: Joi.string().allow(''),
  dietary_restrictions: Joi.string().allow(''),
  chronic_diseases: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  operator: Joi.string().default('system')
});

async function getAllElderly(req, res) {
  try {
    const { name, chronic_disease, dietary_restriction } = req.query;
    let sql = 'SELECT * FROM elderly WHERE 1=1';
    const params = [];

    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    if (chronic_disease) {
      sql += ' AND chronic_diseases LIKE ?';
      params.push(`%${chronic_disease}%`);
    }
    if (dietary_restriction) {
      sql += ' AND dietary_restrictions LIKE ?';
      params.push(`%${dietary_restriction}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const elderly = await getAll(sql, params);
    
    res.json({
      success: true,
      data: elderly,
      total: elderly.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getElderlyById(req, res) {
  try {
    const elderly = await getOne('SELECT * FROM elderly WHERE id = ?', [req.params.id]);
    if (!elderly) {
      return res.status(404).json({ success: false, error: '未找到该老人档案' });
    }
    res.json({ success: true, data: elderly });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createElderly(req, res) {
  try {
    const { error, value } = elderlySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { operator, ...data } = value;
    
    if (data.id_card) {
      const exists = await getOne('SELECT id FROM elderly WHERE id_card = ?', [data.id_card]);
      if (exists) {
        return res.status(400).json({ success: false, error: '该身份证号已存在' });
      }
    }

    const sql = `
      INSERT INTO elderly (name, id_card, phone, address, dietary_restrictions, chronic_diseases, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await runQuery(sql, [
      data.name,
      data.id_card,
      data.phone,
      data.address,
      data.dietary_restrictions,
      data.chronic_diseases,
      data.notes
    ]);

    await recordHistory('create', 'elderly', result.lastID, operator, data);

    const elderly = await getOne('SELECT * FROM elderly WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: elderly });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function updateElderly(req, res) {
  try {
    const { error, value } = elderlySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { operator, ...data } = value;
    const oldData = await getOne('SELECT * FROM elderly WHERE id = ?', [req.params.id]);
    if (!oldData) {
      return res.status(404).json({ success: false, error: '未找到该老人档案' });
    }

    if (data.id_card) {
      const exists = await getOne('SELECT id FROM elderly WHERE id_card = ? AND id != ?', [data.id_card, req.params.id]);
      if (exists) {
        return res.status(400).json({ success: false, error: '该身份证号已被其他老人使用' });
      }
    }

    const sql = `
      UPDATE elderly 
      SET name = ?, id_card = ?, phone = ?, address = ?, dietary_restrictions = ?, 
          chronic_diseases = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await runQuery(sql, [
      data.name,
      data.id_card,
      data.phone,
      data.address,
      data.dietary_restrictions,
      data.chronic_diseases,
      data.notes,
      req.params.id
    ]);

    await recordHistory('update', 'elderly', req.params.id, operator, { old: oldData, new: data });

    const elderly = await getOne('SELECT * FROM elderly WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: elderly });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function deleteElderly(req, res) {
  try {
    const elderly = await getOne('SELECT * FROM elderly WHERE id = ?', [req.params.id]);
    if (!elderly) {
      return res.status(404).json({ success: false, error: '未找到该老人档案' });
    }

    await runQuery('DELETE FROM elderly WHERE id = ?', [req.params.id]);
    await recordHistory('delete', 'elderly', req.params.id, req.query.operator || 'system', elderly);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllElderly,
  getElderlyById,
  createElderly,
  updateElderly,
  deleteElderly
};
