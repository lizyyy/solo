import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, pageSize = 50, keyword } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM api_interfaces WHERE 1=1';
  const params = [];
  
  if (keyword) {
    query += ' AND (name LIKE ? OR path LIKE ? OR tags LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), parseInt(offset));
  
  const items = db.prepare(query).all(...params);
  
  let countQuery = 'SELECT COUNT(*) as total FROM api_interfaces WHERE 1=1';
  const countParams = [];
  
  if (keyword) {
    countQuery += ' AND (name LIKE ? OR path LIKE ? OR tags LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    countParams.push(likeKeyword, likeKeyword, likeKeyword);
  }
  
  const { total } = db.prepare(countQuery).get(...countParams);
  
  res.json({
    data: items,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM api_interfaces WHERE id = ?').get(id);
  
  if (!item) {
    return res.status(404).json({ error: '接口不存在' });
  }
  
  res.json({ data: item });
});

router.post('/', (req, res) => {
  const { name, method, path, description, tags } = req.body;
  
  if (!name || !method || !path) {
    return res.status(400).json({ error: '名称、方法和路径为必填项' });
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO api_interfaces (id, name, method, path, description, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, method.toUpperCase(), path, description, tags, now, now);
  
  res.json({ data: { id, name, method, path, description, tags } });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, method, path, description, tags } = req.body;
  
  const existing = db.prepare('SELECT * FROM api_interfaces WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '接口不存在' });
  }
  
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE api_interfaces 
    SET name = ?, method = ?, path = ?, description = ?, tags = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    (method || existing.method).toUpperCase(),
    path || existing.path,
    description ?? existing.description,
    tags ?? existing.tags,
    now,
    id
  );
  
  const updated = db.prepare('SELECT * FROM api_interfaces WHERE id = ?').get(id);
  res.json({ data: updated });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const existing = db.prepare('SELECT * FROM api_interfaces WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: '接口不存在' });
  }
  
  db.prepare('DELETE FROM api_interfaces WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

router.post('/batch-import', (req, res) => {
  const items = req.body;
  
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: '导入数据必须是数组格式' });
  }
  
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO api_interfaces (id, name, method, path, description, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((items) => {
    let successCount = 0;
    const errors = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.name || !item.method || !item.path) {
          throw new Error('缺少必填字段');
        }
        
        insert.run(
          uuidv4(),
          item.name,
          item.method.toUpperCase(),
          item.path,
          item.description || null,
          item.tags || null,
          now,
          now
        );
        successCount++;
      } catch (err) {
        errors.push({ index: i, name: item.name, error: err.message });
      }
    }
    
    return { successCount, errors };
  });
  
  const result = transaction(items);
  res.json({ 
    message: `成功导入 ${result.successCount} 条记录`,
    ...result
  });
});

export default router;
