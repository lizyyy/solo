import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery } from '../database/db.js';
import { RulesEngine } from '../services/rulesEngine.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    
    let query = 'SELECT * FROM supplies WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    query += ' ORDER BY type, name';

    const supplies = getAll(query, params);
    
    const status = RulesEngine.validateAllSupplies();
    
    res.json({ 
      success: true, 
      data: supplies,
      status: status.allSufficient ? 'sufficient' : 'critical',
      warnings: status.allWarnings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status', (req, res) => {
  try {
    const status = RulesEngine.validateAllSupplies();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const supply = getOne('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    
    if (!supply) {
      return res.status(404).json({ success: false, error: '物资不存在' });
    }

    const isLow = supply.quantity <= supply.min_threshold;
    const percentage = supply.min_threshold > 0 
      ? Math.round((supply.quantity / supply.min_threshold) * 100) 
      : 100;

    res.json({ 
      success: true, 
      data: {
        ...supply,
        percentage,
        status: isLow ? 'critical' : 'sufficient'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { type, name, quantity, unit, min_threshold } = req.body;
    
    if (!type || !name) {
      return res.status(400).json({ success: false, error: '物资类型和名称不能为空' });
    }

    const existing = getOne('SELECT * FROM supplies WHERE type = ? AND name = ?', [type, name]);
    if (existing) {
      return res.status(400).json({ success: false, error: '该物资已存在，如需修改请使用更新接口' });
    }

    const id = uuidv4();
    const qty = quantity !== undefined ? quantity : 0;
    const minTh = min_threshold !== undefined ? min_threshold : 0;
    const status = qty >= minTh ? 'sufficient' : 'low';

    runQuery(`
      INSERT INTO supplies (id, type, name, quantity, unit, min_threshold, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, type, name, qty, unit || '', minTh, status]);

    const newSupply = getOne('SELECT * FROM supplies WHERE id = ?', [id]);
    res.json({ success: true, data: newSupply });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { type, name, quantity, unit, min_threshold } = req.body;
    
    const existing = getOne('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '物资不存在' });
    }

    const newQty = quantity !== undefined ? quantity : existing.quantity;
    const newMinTh = min_threshold !== undefined ? min_threshold : existing.min_threshold;
    const status = newQty >= newMinTh ? 'sufficient' : 'low';

    runQuery(`
      UPDATE supplies SET
        type = COALESCE(?, type),
        name = COALESCE(?, name),
        quantity = ?,
        unit = COALESCE(?, unit),
        min_threshold = ?,
        status = ?,
        last_updated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [type, name, newQty, unit, newMinTh, status, req.params.id]);

    const updatedSupply = getOne('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updatedSupply });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/update-quantity', (req, res) => {
  try {
    const { delta, reason } = req.body;
    
    if (delta === undefined) {
      return res.status(400).json({ success: false, error: '增量值不能为空' });
    }

    const existing = getOne('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '物资不存在' });
    }

    const newQty = Math.max(0, existing.quantity + delta);
    const status = newQty >= existing.min_threshold ? 'sufficient' : 'low';

    runQuery(`
      UPDATE supplies SET
        quantity = ?,
        status = ?,
        last_updated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newQty, status, req.params.id]);

    const updatedSupply = getOne('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    
    res.json({ 
      success: true, 
      data: updatedSupply,
      message: `物资数量已更新: ${existing.quantity} -> ${newQty} (${delta > 0 ? '+' : ''}${delta})`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const supply = getOne('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    if (!supply) {
      return res.status(404).json({ success: false, error: '物资不存在' });
    }

    runQuery('DELETE FROM supplies WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '物资已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sandbags', (req, res) => {
  try {
    const sandbags = getAll('SELECT * FROM sandbags ORDER BY location');
    res.json({ success: true, data: sandbags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sandbags', (req, res) => {
  try {
    const { location, quantity, needed } = req.body;
    
    if (!location) {
      return res.status(400).json({ success: false, error: '位置不能为空' });
    }

    const existing = getOne('SELECT * FROM sandbags WHERE location = ?', [location]);
    if (existing) {
      return res.status(400).json({ success: false, error: '该位置沙袋记录已存在' });
    }

    const id = uuidv4();
    const qty = quantity || 0;
    const need = needed || 0;
    const status = qty >= need ? 'completed' : 'pending';

    runQuery(`
      INSERT INTO sandbags (id, location, quantity, needed, status)
      VALUES (?, ?, ?, ?, ?)
    `, [id, location, qty, need, status]);

    const newSandbag = getOne('SELECT * FROM sandbags WHERE id = ?', [id]);
    res.json({ success: true, data: newSandbag });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/sandbags/:id', (req, res) => {
  try {
    const { location, quantity, needed } = req.body;
    
    const existing = getOne('SELECT * FROM sandbags WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: '沙袋记录不存在' });
    }

    const newQty = quantity !== undefined ? quantity : existing.quantity;
    const newNeed = needed !== undefined ? needed : existing.needed;
    const status = newQty >= newNeed ? 'completed' : 'pending';

    runQuery(`
      UPDATE sandbags SET
        location = COALESCE(?, location),
        quantity = ?,
        needed = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [location, newQty, newNeed, status, req.params.id]);

    const updatedSandbag = getOne('SELECT * FROM sandbags WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updatedSandbag });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { supplies } = req.body;
    
    if (!supplies || !Array.isArray(supplies)) {
      return res.status(400).json({ success: false, error: '参数错误' });
    }

    const results = { success: [], failed: [] };

    for (const supplyData of supplies) {
      try {
        const { type, name, quantity, unit, min_threshold } = supplyData;
        
        if (!type || !name) {
          results.failed.push({ name: supplyData.name || '未知', error: '物资类型和名称不能为空' });
          continue;
        }

        const existing = getOne('SELECT * FROM supplies WHERE type = ? AND name = ?', [type, name]);
        if (existing) {
          results.failed.push({ name, error: '该物资已存在' });
          continue;
        }

        const id = uuidv4();
        const qty = quantity !== undefined ? quantity : 0;
        const minTh = min_threshold !== undefined ? min_threshold : 0;
        const status = qty >= minTh ? 'sufficient' : 'low';

        runQuery(`
          INSERT INTO supplies (id, type, name, quantity, unit, min_threshold, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, type, name, qty, unit || '', minTh, status]);

        results.success.push({ id, type, name, quantity: qty });
      } catch (error) {
        results.failed.push({ name: supplyData.name, error: error.message });
      }
    }

    res.json({ 
      success: true, 
      data: results,
      summary: `成功导入 ${results.success.length} 项物资，失败 ${results.failed.length} 项`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
