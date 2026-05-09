const db = require('../config/database');

class TraceService {
  static async queryByOrder(orderNumber, options = {}) {
    const { startTime, endTime, onlyAlerts, limit = 100, offset = 0 } = options;
    
    let sql = `
      SELECT 
        te.*,
        o.product_name,
        o.customer_name,
        o.delivery_address,
        o.required_temp_min,
        o.required_temp_max,
        b.status as box_status,
        s.responsible_person
      FROM temperature_events te
      LEFT JOIN orders o ON te.order_number = o.order_number
      LEFT JOIN boxes b ON te.box_number = b.box_number
      LEFT JOIN shifts s ON te.shift_id = s.id
      WHERE te.order_number = ?
    `;
    
    const params = [orderNumber];
    
    if (startTime) {
      sql += ' AND te.event_time >= ?';
      params.push(startTime);
    }
    
    if (endTime) {
      sql += ' AND te.event_time <= ?';
      params.push(endTime);
    }
    
    if (onlyAlerts) {
      sql += ' AND te.is_alert = 1';
    }
    
    sql += ' ORDER BY te.event_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async queryByBox(boxNumber, options = {}) {
    const { startTime, endTime, onlyAlerts, limit = 100, offset = 0 } = options;
    
    let sql = `
      SELECT 
        te.*,
        o.product_name,
        o.customer_name,
        o.delivery_address,
        o.required_temp_min,
        o.required_temp_max,
        b.status as box_status,
        s.responsible_person
      FROM temperature_events te
      LEFT JOIN orders o ON te.order_number = o.order_number
      LEFT JOIN boxes b ON te.box_number = b.box_number
      LEFT JOIN shifts s ON te.shift_id = s.id
      WHERE te.box_number = ?
    `;
    
    const params = [boxNumber];
    
    if (startTime) {
      sql += ' AND te.event_time >= ?';
      params.push(startTime);
    }
    
    if (endTime) {
      sql += ' AND te.event_time <= ?';
      params.push(endTime);
    }
    
    if (onlyAlerts) {
      sql += ' AND te.is_alert = 1';
    }
    
    sql += ' ORDER BY te.event_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async queryByShift(shiftName, options = {}) {
    const { startTime, endTime, onlyAlerts, limit = 100, offset = 0 } = options;
    
    let sql = `
      SELECT 
        te.*,
        o.product_name,
        o.customer_name,
        o.delivery_address,
        o.required_temp_min,
        o.required_temp_max,
        b.status as box_status,
        s.responsible_person
      FROM temperature_events te
      LEFT JOIN orders o ON te.order_number = o.order_number
      LEFT JOIN boxes b ON te.box_number = b.box_number
      LEFT JOIN shifts s ON te.shift_id = s.id
      WHERE te.shift_name = ?
    `;
    
    const params = [shiftName];
    
    if (startTime) {
      sql += ' AND te.event_time >= ?';
      params.push(startTime);
    }
    
    if (endTime) {
      sql += ' AND te.event_time <= ?';
      params.push(endTime);
    }
    
    if (onlyAlerts) {
      sql += ' AND te.is_alert = 1';
    }
    
    sql += ' ORDER BY te.event_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async queryByTimeRange(startTime, endTime, options = {}) {
    const { onlyAlerts, limit = 1000, offset = 0 } = options;
    
    let sql = `
      SELECT 
        te.*,
        o.product_name,
        o.customer_name,
        o.delivery_address,
        o.required_temp_min,
        o.required_temp_max,
        b.status as box_status,
        s.responsible_person
      FROM temperature_events te
      LEFT JOIN orders o ON te.order_number = o.order_number
      LEFT JOIN boxes b ON te.box_number = b.box_number
      LEFT JOIN shifts s ON te.shift_id = s.id
      WHERE te.event_time >= ? AND te.event_time <= ?
    `;
    
    const params = [startTime, endTime];
    
    if (onlyAlerts) {
      sql += ' AND te.is_alert = 1';
    }
    
    sql += ' ORDER BY te.event_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getEventById(eventId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          te.*,
          o.product_name,
          o.customer_name,
          o.delivery_address,
          o.required_temp_min,
          o.required_temp_max,
          b.status as box_status,
          s.responsible_person
        FROM temperature_events te
        LEFT JOIN orders o ON te.order_number = o.order_number
        LEFT JOIN boxes b ON te.box_number = b.box_number
        LEFT JOIN shifts s ON te.shift_id = s.id
        WHERE te.id = ?
      `;
      
      db.get(sql, [eventId], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  static async getStatistics(options = {}) {
    const { startTime, endTime } = options;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (startTime) {
      whereClause += ' AND event_time >= ?';
      params.push(startTime);
    }
    
    if (endTime) {
      whereClause += ' AND event_time <= ?';
      params.push(endTime);
    }

    const statsSql = `
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN is_alert = 1 THEN 1 ELSE 0 END) as alert_count,
        COUNT(DISTINCT box_number) as unique_boxes,
        COUNT(DISTINCT order_number) as unique_orders
      FROM temperature_events
      ${whereClause}
    `;

    const shiftStatsSql = `
      SELECT 
        shift_name,
        COUNT(*) as event_count,
        SUM(CASE WHEN is_alert = 1 THEN 1 ELSE 0 END) as alert_count
      FROM temperature_events
      ${whereClause}
      GROUP BY shift_name
      ORDER BY alert_count DESC
    `;

    const boxStatsSql = `
      SELECT 
        box_number,
        order_number,
        COUNT(*) as event_count,
        SUM(CASE WHEN is_alert = 1 THEN 1 ELSE 0 END) as alert_count
      FROM temperature_events
      ${whereClause}
      GROUP BY box_number
      ORDER BY alert_count DESC
      LIMIT 10
    `;

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(statsSql, params, (err, overall) => {
          if (err) {
            reject(err);
            return;
          }
          
          db.all(shiftStatsSql, params, (err, shiftStats) => {
            if (err) {
              reject(err);
              return;
            }
            
            db.all(boxStatsSql, params, (err, boxStats) => {
              if (err) {
                reject(err);
                return;
              }
              
              resolve({
                overall,
                byShift: shiftStats,
                topAlertBoxes: boxStats
              });
            });
          });
        });
      });
    });
  }
}

module.exports = TraceService;
