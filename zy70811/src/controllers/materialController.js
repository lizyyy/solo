const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const csv = require('csv-parser');

const uploadMaterial = (req, res) => {
  const { batch_id } = req.body;
  const file = req.file;

  if (!batch_id) {
    if (file) fs.unlinkSync(file.path);
    return res.status(400).json({ error: '批次ID不能为空' });
  }

  if (!file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  const id = uuidv4();
  const sql = 'INSERT INTO raw_materials (id, batch_id, source_type, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?)';
  
  db.run(sql, [id, batch_id, 'file', file.originalname, req.body.uploaded_by || 'system'], function(err) {
    if (err) {
      fs.unlinkSync(file.path);
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      id,
      batch_id,
      source_type: 'file',
      file_name: file.originalname,
      status: 'pending'
    });
  });
};

const registerMaterial = (req, res) => {
  const { batch_id, content, uploaded_by } = req.body;

  if (!batch_id) {
    return res.status(400).json({ error: '批次ID不能为空' });
  }

  if (!content) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  const id = uuidv4();
  const sql = 'INSERT INTO raw_materials (id, batch_id, source_type, content, uploaded_by) VALUES (?, ?, ?, ?, ?)';
  
  db.run(sql, [id, batch_id, 'manual', JSON.stringify(content), uploaded_by || 'system'], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      id,
      batch_id,
      source_type: 'manual',
      status: 'pending'
    });
  });
};

const getMaterials = (req, res) => {
  const { batch_id } = req.query;
  let sql = 'SELECT * FROM raw_materials';
  let params = [];
  
  if (batch_id) {
    sql += ' WHERE batch_id = ?';
    params.push(batch_id);
  }
  sql += ' ORDER BY created_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
};

const parseCsvContent = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

module.exports = {
  uploadMaterial,
  registerMaterial,
  getMaterials,
  parseCsvContent
};
