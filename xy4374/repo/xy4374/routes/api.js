const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const COOLING_TIME_LIMIT_MINUTES = 120;
const ALLERGEN_LIST = ['含麸质的谷物', '甲壳类动物', '蛋类', '鱼类', '花生', '大豆', '乳制品', '坚果', '芹菜', '芥末', '芝麻', '二氧化硫及亚硫酸盐', '羽扇豆', '软体动物'];

const checkAllergenConflicts = async (date) => {
  const risks = [];
  const menus = await db.all(`
    SELECT m.*, d.name as dish_name, d.allergens, s.name as stall_name
    FROM menus m
    JOIN dishes d ON m.dish_id = d.id
    JOIN stalls s ON m.stall_id = s.id
    WHERE m.date = ?
  `, [date]);

  for (const menu of menus) {
    if (!menu.allergens) {
      risks.push({
        date,
        stall_id: menu.stall_id,
        dish_id: menu.dish_id,
        menu_id: menu.id,
        risk_type: 'allergen_missing',
        risk_level: 'high',
        description: `菜品「${menu.dish_name}」未标注过敏源信息`,
        suggestion: '请补充菜品的过敏源标注信息'
      });
    } else {
      const allergens = menu.allergens.split(',').map(a => a.trim());
      const invalidAllergens = allergens.filter(a => !ALLERGEN_LIST.includes(a));
      if (invalidAllergens.length > 0) {
        risks.push({
          date,
          stall_id: menu.stall_id,
          dish_id: menu.dish_id,
          menu_id: menu.id,
          risk_type: 'allergen_invalid',
          risk_level: 'medium',
          description: `菜品「${menu.dish_name}」过敏源标注不规范: ${invalidAllergens.join(', ')}`,
          suggestion: '请使用标准过敏源术语'
        });
      }
    }
  }

  return risks;
};

const checkSampleShortage = async (date) => {
  const risks = [];
  const menus = await db.all(`
    SELECT m.*, d.name as dish_name, s.name as stall_name
    FROM menus m
    JOIN dishes d ON m.dish_id = d.id
    JOIN stalls s ON m.stall_id = s.id
    WHERE m.date = ?
  `, [date]);

  for (const menu of menus) {
    const samples = await db.all(`
      SELECT * FROM samples WHERE menu_id = ?
    `, [menu.id]);

    if (samples.length === 0) {
      risks.push({
        date,
        stall_id: menu.stall_id,
        dish_id: menu.dish_id,
        menu_id: menu.id,
        risk_type: 'sample_missing',
        risk_level: 'high',
        description: `菜品「${menu.dish_name}」未进行留样`,
        suggestion: '请及时补做留样并拍摄照片'
      });
    } else {
      const photoSamples = samples.filter(s => s.photo_data || s.photo_path);
      if (photoSamples.length === 0) {
        risks.push({
          date,
          stall_id: menu.stall_id,
          dish_id: menu.dish_id,
          menu_id: menu.id,
          risk_type: 'sample_photo_missing',
          risk_level: 'medium',
          description: `菜品「${menu.dish_name}」留样但未拍摄照片`,
          suggestion: '请补充留样照片'
        });
      }
    }
  }

  return risks;
};

const checkCoolingTimeout = async (date) => {
  const risks = [];
  const menus = await db.all(`
    SELECT m.*, d.name as dish_name, s.name as stall_name
    FROM menus m
    JOIN dishes d ON m.dish_id = d.id
    JOIN stalls s ON m.stall_id = s.id
    WHERE m.date = ?
  `, [date]);

  for (const menu of menus) {
    const tempRecords = await db.all(`
      SELECT * FROM temperature_records 
      WHERE menu_id = ? AND record_type IN ('hot_out', 'cooling', 'cold_ready')
      ORDER BY record_time ASC
    `, [menu.id]);

    if (tempRecords.length === 0) {
      risks.push({
        date,
        stall_id: menu.stall_id,
        dish_id: menu.dish_id,
        menu_id: menu.id,
        risk_type: 'temperature_missing',
        risk_level: 'medium',
        description: `菜品「${menu.dish_name}」缺少温度记录`,
        suggestion: '请补充热菜出锅和冷却过程的温度记录'
      });
    } else {
      const hotRecords = tempRecords.filter(r => r.record_type === 'hot_out');
      const coldRecords = tempRecords.filter(r => r.record_type === 'cold_ready');

      if (hotRecords.length > 0 && coldRecords.length > 0) {
        const hotTime = dayjs(hotRecords[hotRecords.length - 1].record_time);
        const coldTime = dayjs(coldRecords[0].record_time);
        const coolingMinutes = coldTime.diff(hotTime, 'minute');

        if (coolingMinutes > COOLING_TIME_LIMIT_MINUTES) {
          risks.push({
            date,
            stall_id: menu.stall_id,
            dish_id: menu.dish_id,
            menu_id: menu.id,
            risk_type: 'cooling_timeout',
            risk_level: 'high',
            description: `菜品「${menu.dish_name}」冷却超时: 用时 ${coolingMinutes} 分钟（限 ${COOLING_TIME_LIMIT_MINUTES} 分钟）`,
            suggestion: '检查冷却流程，增加冷却设备或减少单次冷却量'
          });
        }
      }

      const lastCoolingRecord = tempRecords.filter(r => r.record_type === 'cooling').pop();
      if (lastCoolingRecord && lastCoolingRecord.temperature > 8) {
        risks.push({
          date,
          stall_id: menu.stall_id,
          dish_id: menu.dish_id,
          menu_id: menu.id,
          risk_type: 'cooling_incomplete',
          risk_level: 'medium',
          description: `菜品「${menu.dish_name}」冷却未达标: 当前温度 ${lastCoolingRecord.temperature}°C（目标 ≤8°C）`,
          suggestion: '继续冷却直至温度达标'
        });
      }
    }
  }

  return risks;
};

const checkBatchBreakpoints = async (date) => {
  const risks = [];
  const menus = await db.all(`
    SELECT m.*, d.name as dish_name, s.name as stall_name
    FROM menus m
    JOIN dishes d ON m.dish_id = d.id
    JOIN stalls s ON m.stall_id = s.id
    WHERE m.date = ?
  `, [date]);

  for (const menu of menus) {
    const batches = await db.all(`
      SELECT * FROM ingredient_batches WHERE menu_id = ? OR dish_id = ?
    `, [menu.id, menu.dish_id]);

    if (batches.length === 0) {
      risks.push({
        date,
        stall_id: menu.stall_id,
        dish_id: menu.dish_id,
        menu_id: menu.id,
        risk_type: 'batch_missing',
        risk_level: 'high',
        description: `菜品「${menu.dish_name}」缺少原料批次记录`,
        suggestion: '请补充所有原料的批次号、供应商和有效期信息'
      });
    } else {
      for (const batch of batches) {
        if (!batch.batch_number) {
          risks.push({
            date,
            stall_id: menu.stall_id,
            dish_id: menu.dish_id,
            menu_id: menu.id,
            risk_type: 'batch_number_missing',
            risk_level: 'high',
            description: `原料「${batch.name}」缺少批次号`,
            suggestion: '请补充原料批次号'
          });
        }
        if (!batch.supplier) {
          risks.push({
            date,
            stall_id: menu.stall_id,
            dish_id: menu.dish_id,
            menu_id: menu.id,
            risk_type: 'supplier_missing',
            risk_level: 'medium',
            description: `原料「${batch.name}」缺少供应商信息`,
            suggestion: '请补充供应商信息'
          });
        }
        if (!batch.expiration_date) {
          risks.push({
            date,
            stall_id: menu.stall_id,
            dish_id: menu.dish_id,
            menu_id: menu.id,
            risk_type: 'expiration_missing',
            risk_level: 'medium',
            description: `原料「${batch.name}」缺少有效期`,
            suggestion: '请补充有效期信息'
          });
        } else {
          const expDate = dayjs(batch.expiration_date);
          const today = dayjs();
          if (expDate.isBefore(today)) {
            risks.push({
              date,
              stall_id: menu.stall_id,
              dish_id: menu.dish_id,
              menu_id: menu.id,
              risk_type: 'expired_ingredient',
              risk_level: 'critical',
              description: `原料「${batch.name}」已过期（有效期: ${batch.expiration_date}）`,
              suggestion: '立即停止使用，检查库存并销毁过期原料'
            });
          }
        }
      }
    }
  }

  return risks;
};

const runAllChecks = async (date) => {
  const [allergenRisks, sampleRisks, coolingRisks, batchRisks] = await Promise.all([
    checkAllergenConflicts(date),
    checkSampleShortage(date),
    checkCoolingTimeout(date),
    checkBatchBreakpoints(date)
  ]);

  return [...allergenRisks, ...sampleRisks, ...coolingRisks, ...batchRisks];
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/stalls', async (req, res) => {
  try {
    const stalls = await db.all('SELECT * FROM stalls ORDER BY name');
    res.json({ success: true, data: stalls });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stalls', async (req, res) => {
  try {
    const { name, contact_person, phone } = req.body;
    const result = await db.run(
      'INSERT INTO stalls (name, contact_person, phone) VALUES (?, ?, ?)',
      [name, contact_person, phone]
    );
    res.json({ success: true, data: { id: result.lastID, name, contact_person, phone } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/stalls/:id', async (req, res) => {
  try {
    const { name, contact_person, phone } = req.body;
    await db.run(
      'UPDATE stalls SET name = ?, contact_person = ?, phone = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
      [name, contact_person, phone, req.params.id]
    );
    res.json({ success: true, data: { id: req.params.id, name, contact_person, phone } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/stalls/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM stalls WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/dishes', async (req, res) => {
  try {
    const { stall_id } = req.query;
    let sql = `
      SELECT d.*, s.name as stall_name 
      FROM dishes d 
      LEFT JOIN stalls s ON d.stall_id = s.id
    `;
    const params = [];
    if (stall_id) {
      sql += ' WHERE d.stall_id = ?';
      params.push(stall_id);
    }
    sql += ' ORDER BY d.name';
    const dishes = await db.all(sql, params);
    res.json({ success: true, data: dishes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/dishes', async (req, res) => {
  try {
    const { stall_id, name, allergens } = req.body;
    const result = await db.run(
      'INSERT INTO dishes (stall_id, name, allergens) VALUES (?, ?, ?)',
      [stall_id, name, allergens]
    );
    res.json({ success: true, data: { id: result.lastID, stall_id, name, allergens } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/dishes/:id', async (req, res) => {
  try {
    const { stall_id, name, allergens } = req.body;
    await db.run(
      'UPDATE dishes SET stall_id = ?, name = ?, allergens = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
      [stall_id, name, allergens, req.params.id]
    );
    res.json({ success: true, data: { id: req.params.id, stall_id, name, allergens } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/dishes/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM dishes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/menus', async (req, res) => {
  try {
    const { date, stall_id } = req.query;
    let sql = `
      SELECT m.*, d.name as dish_name, d.allergens, s.name as stall_name
      FROM menus m
      JOIN dishes d ON m.dish_id = d.id
      JOIN stalls s ON m.stall_id = s.id
    `;
    const params = [];
    const conditions = [];

    if (date) {
      conditions.push('m.date = ?');
      params.push(date);
    }
    if (stall_id) {
      conditions.push('m.stall_id = ?');
      params.push(stall_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY s.name, d.name';

    const menus = await db.all(sql, params);
    res.json({ success: true, data: menus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/menus', async (req, res) => {
  try {
    const { date, stall_id, dish_id, quantity, notes } = req.body;
    const result = await db.run(
      'INSERT INTO menus (date, stall_id, dish_id, quantity, notes) VALUES (?, ?, ?, ?, ?)',
      [date, stall_id, dish_id, quantity || 1, notes]
    );

    await db.run(
      `INSERT INTO reviews (menu_id, stall_id, dish_id) VALUES (?, ?, ?)
       ON CONFLICT(menu_id) DO NOTHING`,
      [result.lastID, stall_id, dish_id]
    );

    res.json({ success: true, data: { id: result.lastID, date, stall_id, dish_id, quantity, notes } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/menus/batch', async (req, res) => {
  try {
    const { items } = req.body;
    const results = [];

    for (const item of items) {
      const { date, stall_id, dish_name, quantity, notes, allergens } = item;

      let dish = await db.get('SELECT * FROM dishes WHERE name = ? AND stall_id = ?', [dish_name, stall_id]);
      
      if (!dish) {
        const dishResult = await db.run(
          'INSERT INTO dishes (stall_id, name, allergens) VALUES (?, ?, ?)',
          [stall_id, dish_name, allergens || '']
        );
        dish = { id: dishResult.lastID, stall_id, name: dish_name, allergens };
      }

      const existingMenu = await db.get(
        'SELECT * FROM menus WHERE date = ? AND stall_id = ? AND dish_id = ?',
        [date, stall_id, dish.id]
      );

      let menuResult;
      if (existingMenu) {
        await db.run(
          'UPDATE menus SET quantity = ?, notes = ? WHERE id = ?',
          [quantity || 1, notes, existingMenu.id]
        );
        menuResult = { lastID: existingMenu.id };
      } else {
        menuResult = await db.run(
          'INSERT INTO menus (date, stall_id, dish_id, quantity, notes) VALUES (?, ?, ?, ?, ?)',
          [date, stall_id, dish.id, quantity || 1, notes]
        );
      }

      await db.run(
        `INSERT INTO reviews (menu_id, stall_id, dish_id) VALUES (?, ?, ?)
         ON CONFLICT(menu_id) DO NOTHING`,
        [menuResult.lastID, stall_id, dish.id]
      );

      results.push({ id: menuResult.lastID, date, stall_id, dish_id: dish.id, dish_name, quantity, notes });
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ingredient-batches', async (req, res) => {
  try {
    const { menu_id, dish_id, stall_id } = req.query;
    let sql = 'SELECT * FROM ingredient_batches WHERE 1=1';
    const params = [];

    if (menu_id) {
      sql += ' AND menu_id = ?';
      params.push(menu_id);
    }
    if (dish_id) {
      sql += ' AND dish_id = ?';
      params.push(dish_id);
    }
    if (stall_id) {
      sql += ' AND stall_id = ?';
      params.push(stall_id);
    }

    const batches = await db.all(sql, params);
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ingredient-batches', async (req, res) => {
  try {
    const { name, batch_number, supplier, expiration_date, quantity, unit, received_date, dish_id, menu_id, stall_id } = req.body;
    const result = await db.run(
      `INSERT INTO ingredient_batches (name, batch_number, supplier, expiration_date, quantity, unit, received_date, dish_id, menu_id, stall_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, batch_number, supplier, expiration_date, quantity, unit, received_date, dish_id, menu_id, stall_id]
    );
    res.json({ success: true, data: { id: result.lastID, ...req.body } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ingredient-batches/batch', async (req, res) => {
  try {
    const { items } = req.body;
    const results = [];

    for (const item of items) {
      const { name, batch_number, supplier, expiration_date, quantity, unit, received_date, dish_name, menu_date, stall_name } = item;

      let stall_id = item.stall_id;
      if (!stall_id && stall_name) {
        const stall = await db.get('SELECT * FROM stalls WHERE name = ?', [stall_name]);
        if (stall) stall_id = stall.id;
      }

      let dish_id = item.dish_id;
      if (!dish_id && dish_name && stall_id) {
        const dish = await db.get('SELECT * FROM dishes WHERE name = ? AND stall_id = ?', [dish_name, stall_id]);
        if (dish) dish_id = dish.id;
      }

      let menu_id = item.menu_id;
      if (!menu_id && menu_date && stall_id && dish_id) {
        const menu = await db.get('SELECT * FROM menus WHERE date = ? AND stall_id = ? AND dish_id = ?', [menu_date, stall_id, dish_id]);
        if (menu) menu_id = menu.id;
      }

      const result = await db.run(
        `INSERT INTO ingredient_batches (name, batch_number, supplier, expiration_date, quantity, unit, received_date, dish_id, menu_id, stall_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, batch_number, supplier, expiration_date, quantity, unit, received_date, dish_id, menu_id, stall_id]
      );
      results.push({ id: result.lastID, ...item });
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/temperature-records', async (req, res) => {
  try {
    const { menu_id, dish_id, stall_id } = req.query;
    let sql = 'SELECT * FROM temperature_records WHERE 1=1';
    const params = [];

    if (menu_id) {
      sql += ' AND menu_id = ?';
      params.push(menu_id);
    }
    if (dish_id) {
      sql += ' AND dish_id = ?';
      params.push(dish_id);
    }
    if (stall_id) {
      sql += ' AND stall_id = ?';
      params.push(stall_id);
    }
    sql += ' ORDER BY record_time';

    const records = await db.all(sql, params);
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/temperature-records', async (req, res) => {
  try {
    const { menu_id, dish_id, stall_id, temperature, record_time, record_type, notes } = req.body;
    const result = await db.run(
      `INSERT INTO temperature_records (menu_id, dish_id, stall_id, temperature, record_time, record_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [menu_id, dish_id, stall_id, temperature, record_time, record_type, notes]
    );
    res.json({ success: true, data: { id: result.lastID, ...req.body } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/temperature-records/batch', async (req, res) => {
  try {
    const { items } = req.body;
    const results = [];

    for (const item of items) {
      const result = await db.run(
        `INSERT INTO temperature_records (menu_id, dish_id, stall_id, temperature, record_time, record_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.menu_id, item.dish_id, item.stall_id, item.temperature, item.record_time, item.record_type, item.notes]
      );
      results.push({ id: result.lastID, ...item });
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/samples', async (req, res) => {
  try {
    const { menu_id, dish_id, stall_id } = req.query;
    let sql = 'SELECT * FROM samples WHERE 1=1';
    const params = [];

    if (menu_id) {
      sql += ' AND menu_id = ?';
      params.push(menu_id);
    }
    if (dish_id) {
      sql += ' AND dish_id = ?';
      params.push(dish_id);
    }
    if (stall_id) {
      sql += ' AND stall_id = ?';
      params.push(stall_id);
    }
    sql += ' ORDER BY sample_time DESC';

    const samples = await db.all(sql, params);
    res.json({ success: true, data: samples });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/samples', async (req, res) => {
  try {
    const { menu_id, dish_id, stall_id, sample_time, sample_weight, photo_path, photo_data, keeper, location, notes } = req.body;
    const result = await db.run(
      `INSERT INTO samples (menu_id, dish_id, stall_id, sample_time, sample_weight, photo_path, photo_data, keeper, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [menu_id, dish_id, stall_id, sample_time, sample_weight, photo_path, photo_data, keeper, location, notes]
    );
    res.json({ success: true, data: { id: result.lastID, ...req.body } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/samples/batch', async (req, res) => {
  try {
    const { items } = req.body;
    const results = [];

    for (const item of items) {
      const result = await db.run(
        `INSERT INTO samples (menu_id, dish_id, stall_id, sample_time, sample_weight, photo_path, photo_data, keeper, location, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.menu_id, item.dish_id, item.stall_id, item.sample_time, item.sample_weight, item.photo_path, item.photo_data, item.keeper, item.location, item.notes]
      );
      results.push({ id: result.lastID, ...item });
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const { date, stall_id, menu_id } = req.query;
    let sql = `
      SELECT r.*, m.date, m.quantity, d.name as dish_name, d.allergens, s.name as stall_name
      FROM reviews r
      JOIN menus m ON r.menu_id = m.id
      JOIN dishes d ON r.dish_id = d.id
      JOIN stalls s ON r.stall_id = s.id
    `;
    const params = [];
    const conditions = [];

    if (date) {
      conditions.push('m.date = ?');
      params.push(date);
    }
    if (stall_id) {
      conditions.push('r.stall_id = ?');
      params.push(stall_id);
    }
    if (menu_id) {
      conditions.push('r.menu_id = ?');
      params.push(menu_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY s.name, d.name';

    const reviews = await db.all(sql, params);
    res.json({ success: true, data: reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/reviews/:id', async (req, res) => {
  try {
    const { allergen_status, sample_status, cooling_status, batch_status, overall_status, reviewer, notes } = req.body;
    
    const fields = [];
    const values = [];

    if (allergen_status !== undefined) {
      fields.push('allergen_status = ?');
      values.push(allergen_status);
    }
    if (sample_status !== undefined) {
      fields.push('sample_status = ?');
      values.push(sample_status);
    }
    if (cooling_status !== undefined) {
      fields.push('cooling_status = ?');
      values.push(cooling_status);
    }
    if (batch_status !== undefined) {
      fields.push('batch_status = ?');
      values.push(batch_status);
    }
    if (overall_status !== undefined) {
      fields.push('overall_status = ?');
      values.push(overall_status);
    }
    if (reviewer !== undefined) {
      fields.push('reviewer = ?');
      values.push(reviewer);
    }
    if (notes !== undefined) {
      fields.push('notes = ?');
      values.push(notes);
    }

    fields.push('updated_at = datetime("now", "localtime")');
    fields.push('review_time = datetime("now", "localtime")');
    values.push(req.params.id);

    await db.run(
      `UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.get('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/risks', async (req, res) => {
  try {
    const { date, stall_id, status } = req.query;
    let sql = `
      SELECT rr.*, s.name as stall_name, d.name as dish_name
      FROM risk_records rr
      LEFT JOIN stalls s ON rr.stall_id = s.id
      LEFT JOIN dishes d ON rr.dish_id = d.id
    `;
    const params = [];
    const conditions = [];

    if (date) {
      conditions.push('rr.date = ?');
      params.push(date);
    }
    if (stall_id) {
      conditions.push('rr.stall_id = ?');
      params.push(stall_id);
    }
    if (status) {
      conditions.push('rr.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY rr.risk_level DESC, rr.created_at DESC';

    const risks = await db.all(sql, params);
    res.json({ success: true, data: risks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/risks/run-checks', async (req, res) => {
  try {
    const { date } = req.body;
    const checkDate = date || dayjs().format('YYYY-MM-DD');

    const existingRisks = await db.all('SELECT * FROM risk_records WHERE date = ?', [checkDate]);
    for (const risk of existingRisks) {
      await db.run('DELETE FROM risk_records WHERE id = ?', [risk.id]);
    }

    const risks = await runAllChecks(checkDate);

    for (const risk of risks) {
      await db.run(
        `INSERT INTO risk_records (date, stall_id, dish_id, menu_id, risk_type, risk_level, description, suggestion, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [risk.date, risk.stall_id, risk.dish_id, risk.menu_id, risk.risk_type, risk.risk_level, risk.description, risk.suggestion, 'open']
      );
    }

    const stats = {
      total: risks.length,
      critical: risks.filter(r => r.risk_level === 'critical').length,
      high: risks.filter(r => r.risk_level === 'high').length,
      medium: risks.filter(r => r.risk_level === 'medium').length,
      low: risks.filter(r => r.risk_level === 'low').length
    };

    res.json({ success: true, data: { date: checkDate, risks, stats } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/risks/:id', async (req, res) => {
  try {
    const { status, handler, handle_notes } = req.body;
    await db.run(
      `UPDATE risk_records SET status = ?, handler = ?, handle_notes = ?, handle_time = datetime("now", "localtime")
       WHERE id = ?`,
      [status, handler, handle_notes, req.params.id]
    );
    const updated = await db.get('SELECT * FROM risk_records WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = date || dayjs().format('YYYY-MM-DD');

    const menus = await db.all(`
      SELECT m.*, d.name as dish_name, s.name as stall_name
      FROM menus m
      JOIN dishes d ON m.dish_id = d.id
      JOIN stalls s ON m.stall_id = s.id
      WHERE m.date = ?
    `, [checkDate]);

    const reviews = await db.all(`
      SELECT r.* FROM reviews r
      JOIN menus m ON r.menu_id = m.id
      WHERE m.date = ?
    `, [checkDate]);

    const risks = await db.all(`
      SELECT * FROM risk_records WHERE date = ?
    `, [checkDate]);

    const stalls = await db.all(`
      SELECT DISTINCT s.* FROM stalls s
      JOIN menus m ON s.id = m.stall_id
      WHERE m.date = ?
      ORDER BY s.name
    `, [checkDate]);

    const stats = {
      date: checkDate,
      total_menus: menus.length,
      total_stalls: stalls.length,
      total_risks: risks.length,
      critical_risks: risks.filter(r => r.risk_level === 'critical').length,
      high_risks: risks.filter(r => r.risk_level === 'high').length,
      medium_risks: risks.filter(r => r.risk_level === 'medium').length,
      reviewed: reviews.filter(r => r.overall_status !== 'pending').length,
      pending: reviews.filter(r => r.overall_status === 'pending').length,
      passed: reviews.filter(r => r.overall_status === 'passed').length,
      failed: reviews.filter(r => r.overall_status === 'failed').length
    };

    res.json({
      success: true,
      data: {
        stats,
        stalls,
        menus,
        reviews,
        risks
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/allergens', (req, res) => {
  res.json({ success: true, data: ALLERGEN_LIST });
});

module.exports = router;
