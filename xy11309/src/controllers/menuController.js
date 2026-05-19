const { getAll, getOne, runQuery, recordHistory } = require('../database/db');
const Joi = require('joi');

const menuItemSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().allow(''),
  ingredients: Joi.string().allow(''),
  allergens: Joi.string().allow(''),
  nutrition_info: Joi.string().allow(''),
  price: Joi.number().allow(null),
  operator: Joi.string().default('system')
});

const dailyMenuSchema = Joi.object({
  date: Joi.string().required(),
  breakfast_items: Joi.string().allow(''),
  lunch_items: Joi.string().allow(''),
  dinner_items: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  created_by: Joi.string().default('system')
});

async function getAllMenuItems(req, res) {
  try {
    const { type, allergen } = req.query;
    let sql = 'SELECT * FROM menu_items WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type LIKE ?';
      params.push(`%${type}%`);
    }
    if (allergen) {
      sql += ' AND allergens LIKE ?';
      params.push(`%${allergen}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const items = await getAll(sql, params);
    
    res.json({ success: true, data: items, total: items.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getMenuItemById(req, res) {
  try {
    const item = await getOne('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ success: false, error: '未找到该菜品' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createMenuItem(req, res) {
  try {
    const { error, value } = menuItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { operator, ...data } = value;
    const sql = `
      INSERT INTO menu_items (name, type, ingredients, allergens, nutrition_info, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await runQuery(sql, [
      data.name, data.type, data.ingredients, data.allergens, data.nutrition_info, data.price
    ]);

    await recordHistory('create', 'menu_item', result.lastID, operator, data);

    const item = await getOne('SELECT * FROM menu_items WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function updateMenuItem(req, res) {
  try {
    const { error, value } = menuItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { operator, ...data } = value;
    const oldData = await getOne('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!oldData) {
      return res.status(404).json({ success: false, error: '未找到该菜品' });
    }

    const sql = `
      UPDATE menu_items 
      SET name = ?, type = ?, ingredients = ?, allergens = ?, nutrition_info = ?, 
          price = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await runQuery(sql, [
      data.name, data.type, data.ingredients, data.allergens, data.nutrition_info, 
      data.price, req.params.id
    ]);

    await recordHistory('update', 'menu_item', req.params.id, operator, { old: oldData, new: data });

    const item = await getOne('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function deleteMenuItem(req, res) {
  try {
    const item = await getOne('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ success: false, error: '未找到该菜品' });
    }

    await runQuery('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    await recordHistory('delete', 'menu_item', req.params.id, req.query.operator || 'system', item);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getAllDailyMenus(req, res) {
  try {
    const { start_date, end_date } = req.query;
    let sql = 'SELECT * FROM daily_menus WHERE 1=1';
    const params = [];

    if (start_date) {
      sql += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY date DESC';
    const menus = await getAll(sql, params);
    
    res.json({ success: true, data: menus, total: menus.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createDailyMenu(req, res) {
  try {
    const { error, value } = dailyMenuSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const exists = await getOne('SELECT id FROM daily_menus WHERE date = ?', [value.date]);
    if (exists) {
      return res.status(400).json({ success: false, error: '该日期的菜单已存在' });
    }

    const sql = `
      INSERT INTO daily_menus (date, breakfast_items, lunch_items, dinner_items, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await runQuery(sql, [
      value.date, value.breakfast_items, value.lunch_items, value.dinner_items, 
      value.notes, value.created_by
    ]);

    await recordHistory('create', 'daily_menu', result.lastID, value.created_by, value);

    const menu = await getOne('SELECT * FROM daily_menus WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getAllDailyMenus,
  createDailyMenu
};
