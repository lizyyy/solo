const { getAll, getOne, runQuery, recordHistory } = require('../database/db');
const Joi = require('joi');

const deliverySchema = Joi.object({
  elderly_id: Joi.number().integer().allow(null),
  delivery_date: Joi.string().required(),
  meal_type: Joi.string().valid('breakfast', 'lunch', 'dinner').required(),
  menu_items: Joi.string().allow(''),
  route_id: Joi.number().integer().allow(null),
  status: Joi.string().valid('pending', 'delivering', 'completed', 'cancelled').default('pending'),
  delivered_by: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  operator: Joi.string().default('system')
});

const routeSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  sequence: Joi.string().allow(''),
  operator: Joi.string().default('system')
});

async function getAllDeliveries(req, res) {
  try {
    const { start_date, end_date, status, delivered_by, meal_type } = req.query;
    let sql = `
      SELECT d.*, e.name as elderly_name, e.address, dr.name as route_name
      FROM deliveries d
      LEFT JOIN elderly e ON d.elderly_id = e.id
      LEFT JOIN delivery_routes dr ON d.route_id = dr.id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ' AND d.delivery_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND d.delivery_date <= ?';
      params.push(end_date);
    }
    if (status) {
      sql += ' AND d.status = ?';
      params.push(status);
    }
    if (delivered_by) {
      sql += ' AND d.delivered_by LIKE ?';
      params.push(`%${delivered_by}%`);
    }
    if (meal_type) {
      sql += ' AND d.meal_type = ?';
      params.push(meal_type);
    }

    sql += ' ORDER BY d.delivery_date DESC, d.created_at DESC';
    const deliveries = await getAll(sql, params);
    
    res.json({ success: true, data: deliveries, total: deliveries.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getDeliveryById(req, res) {
  try {
    const delivery = await getOne(`
      SELECT d.*, e.name as elderly_name, e.address, dr.name as route_name
      FROM deliveries d
      LEFT JOIN elderly e ON d.elderly_id = e.id
      LEFT JOIN delivery_routes dr ON d.route_id = dr.id
      WHERE d.id = ?
    `, [req.params.id]);
    
    if (!delivery) {
      return res.status(404).json({ success: false, error: '未找到该配送记录' });
    }
    res.json({ success: true, data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createDelivery(req, res) {
  try {
    const { error, value } = deliverySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { operator, ...data } = value;
    const sql = `
      INSERT INTO deliveries (elderly_id, delivery_date, meal_type, menu_items, route_id, status, delivered_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await runQuery(sql, [
      data.elderly_id, data.delivery_date, data.meal_type, data.menu_items,
      data.route_id, data.status, data.delivered_by, data.notes
    ]);

    await recordHistory('create', 'delivery', result.lastID, operator, data);

    const delivery = await getOne('SELECT * FROM deliveries WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function updateDelivery(req, res) {
  try {
    const { error, value } = deliverySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { operator, ...data } = value;
    const oldData = await getOne('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
    if (!oldData) {
      return res.status(404).json({ success: false, error: '未找到该配送记录' });
    }

    const sql = `
      UPDATE deliveries 
      SET elderly_id = ?, delivery_date = ?, meal_type = ?, menu_items = ?, 
          route_id = ?, status = ?, delivered_by = ?, notes = ?,
          delivered_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await runQuery(sql, [
      data.elderly_id, data.delivery_date, data.meal_type, data.menu_items,
      data.route_id, data.status, data.delivered_by, data.notes,
      data.status, req.params.id
    ]);

    await recordHistory('update', 'delivery', req.params.id, operator, { old: oldData, new: data });

    const delivery = await getOne('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: delivery });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function deleteDelivery(req, res) {
  try {
    const delivery = await getOne('SELECT * FROM deliveries WHERE id = ?', [req.params.id]);
    if (!delivery) {
      return res.status(404).json({ success: false, error: '未找到该配送记录' });
    }

    await runQuery('DELETE FROM deliveries WHERE id = ?', [req.params.id]);
    await recordHistory('delete', 'delivery', req.params.id, req.query.operator || 'system', delivery);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getAllRoutes(req, res) {
  try {
    const routes = await getAll('SELECT * FROM delivery_routes ORDER BY created_at DESC');
    res.json({ success: true, data: routes, total: routes.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createRoute(req, res) {
  try {
    const { error, value } = routeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { operator, ...data } = value;
    const sql = 'INSERT INTO delivery_routes (name, description, sequence) VALUES (?, ?, ?)';
    const result = await runQuery(sql, [data.name, data.description, data.sequence]);

    await recordHistory('create', 'delivery_route', result.lastID, operator, data);

    const route = await getOne('SELECT * FROM delivery_routes WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery,
  deleteDelivery,
  getAllRoutes,
  createRoute
};
