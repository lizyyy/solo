const { Parser } = require('@json2csv/plainjs');
const { getAll } = require('../database/db');

async function exportDeliveryReport(req, res) {
  try {
    const { start_date, end_date, status, delivered_by, format = 'csv' } = req.query;
    
    let sql = `
      SELECT 
        d.id,
        e.name as elderly_name,
        e.id_card,
        e.phone,
        e.address,
        d.delivery_date,
        d.meal_type,
        d.menu_items,
        dr.name as route_name,
        d.status,
        d.delivered_by,
        d.delivered_at,
        d.notes,
        d.created_at
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

    sql += ' ORDER BY d.delivery_date DESC, d.created_at DESC';
    const data = await getAll(sql, params);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=delivery-report-${new Date().toISOString().split('T')[0]}.json`);
      return res.json(data);
    }

    const fields = [
      'id', 'elderly_name', 'id_card', 'phone', 'address',
      'delivery_date', 'meal_type', 'menu_items', 'route_name',
      'status', 'delivered_by', 'delivered_at', 'notes', 'created_at'
    ];
    
    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=delivery-report-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function exportElderlyReport(req, res) {
  try {
    const { name, chronic_disease, dietary_restriction, format = 'csv' } = req.query;
    
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
    const data = await getAll(sql, params);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=elderly-report-${new Date().toISOString().split('T')[0]}.json`);
      return res.json(data);
    }

    const fields = [
      'id', 'name', 'id_card', 'phone', 'address',
      'dietary_restrictions', 'chronic_diseases', 'notes',
      'created_at', 'updated_at'
    ];
    
    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=elderly-report-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getDeliveryStatistics(req, res) {
  try {
    const { start_date, end_date } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      whereClause += ' AND delivery_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND delivery_date <= ?';
      params.push(end_date);
    }

    const statusStats = await getAll(`
      SELECT status, COUNT(*) as count
      FROM deliveries
      ${whereClause}
      GROUP BY status
    `, params);

    const mealTypeStats = await getAll(`
      SELECT meal_type, COUNT(*) as count
      FROM deliveries
      ${whereClause}
      GROUP BY meal_type
    `, params);

    const dailyStats = await getAll(`
      SELECT delivery_date as date, COUNT(*) as count, 
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM deliveries
      ${whereClause}
      GROUP BY delivery_date
      ORDER BY delivery_date DESC
      LIMIT 30
    `, params);

    const totalResult = await getAll(`SELECT COUNT(*) as total FROM deliveries ${whereClause}`, params);
    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        total,
        by_status: statusStats,
        by_meal_type: mealTypeStats,
        daily_stats: dailyStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  exportDeliveryReport,
  exportElderlyReport,
  getDeliveryStatistics
};
