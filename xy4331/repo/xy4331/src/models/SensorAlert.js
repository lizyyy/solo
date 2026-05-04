const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');

class SensorAlert {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.alert_id = data.alert_id;
    this.cage_id = data.cage_id;
    this.sensor_type = data.sensor_type;
    this.threshold_value = data.threshold_value;
    this.measured_value = data.measured_value;
    this.alert_time = data.alert_time;
    this.severity = data.severity || 'warning';
    this.status = data.status || 'open';
    this.acknowledged_by = data.acknowledged_by;
    this.acknowledged_at = data.acknowledged_at;
    this.resolution_notes = data.resolution_notes;
    this.resolved_at = data.resolved_at;
    this.created_at = data.created_at;
  }

  static async create(data) {
    const alert = new SensorAlert(data);
    
    if (!alert.alert_id) {
      alert.alert_id = `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const existing = await getAsync(
      'SELECT * FROM sensor_alerts WHERE alert_id = ?',
      [alert.alert_id]
    );
    
    if (existing) {
      await SensorAlert.update(alert.alert_id, data);
      return await SensorAlert.findByAlertId(alert.alert_id);
    }

    await runAsync(
      `INSERT INTO sensor_alerts 
       (id, alert_id, cage_id, sensor_type, threshold_value, measured_value, 
        alert_time, severity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [alert.id, alert.alert_id, alert.cage_id, alert.sensor_type, 
       alert.threshold_value, alert.measured_value, alert.alert_time, 
       alert.severity, alert.status]
    );

    return alert;
  }

  static async update(alertId, data) {
    const updates = [];
    const values = [];
    
    const allowedFields = [
      'cage_id', 'sensor_type', 'threshold_value', 'measured_value',
      'alert_time', 'severity', 'status', 'acknowledged_by', 
      'acknowledged_at', 'resolution_notes', 'resolved_at'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    values.push(alertId);

    await runAsync(
      `UPDATE sensor_alerts SET ${updates.join(', ')} WHERE alert_id = ?`,
      values
    );
  }

  static async findByAlertId(alertId) {
    const row = await getAsync(
      'SELECT * FROM sensor_alerts WHERE alert_id = ?',
      [alertId]
    );
    return row ? new SensorAlert(row) : null;
  }

  static async findAll(options = {}) {
    const { status, cage_id, severity, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM sensor_alerts WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (cage_id) {
      sql += ' AND cage_id = ?';
      params.push(cage_id);
    }
    
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }

    sql += ' ORDER BY alert_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new SensorAlert(row));
  }

  static async getOpenAlerts(options = {}) {
    const { cage_id, limit = 100, offset = 0 } = options;
    let sql = `SELECT sa.*, c.rack_id, c.position 
               FROM sensor_alerts sa
               JOIN cages c ON sa.cage_id = c.cage_id
               WHERE sa.status IN ('open', 'acknowledged')`;
    const params = [];

    if (cage_id) {
      sql += ' AND sa.cage_id = ?';
      params.push(cage_id);
    }

    sql += ' ORDER BY sa.alert_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new SensorAlert(row));
  }

  static async acknowledge(alertId, acknowledgedBy) {
    const now = new Date().toISOString();
    await runAsync(
      `UPDATE sensor_alerts 
       SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ?
       WHERE alert_id = ?`,
      [acknowledgedBy, now, alertId]
    );
  }

  static async resolve(alertId, resolutionNotes, resolvedBy) {
    const now = new Date().toISOString();
    await runAsync(
      `UPDATE sensor_alerts 
       SET status = 'resolved', resolution_notes = ?, resolved_at = ?, acknowledged_by = ?
       WHERE alert_id = ?`,
      [resolutionNotes, now, resolvedBy, alertId]
    );
  }

  static async getUnclosedCount() {
    const row = await getAsync(
      `SELECT COUNT(*) as count FROM sensor_alerts 
       WHERE status IN ('open', 'acknowledged')`
    );
    return row ? row.count : 0;
  }
}

module.exports = SensorAlert;
