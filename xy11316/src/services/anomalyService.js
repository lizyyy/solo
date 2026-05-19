const db = require('../config/database');
const moment = require('moment');

class AnomalyService {
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  static async analyzeRouteAnomalies(routeId, date) {
    const stops = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM stops WHERE route_id = ? ORDER BY sequence', [routeId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const gpsRecords = await new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM gps_records 
        WHERE driver_id IN (
          SELECT DISTINCT driver_id FROM gps_records 
          WHERE DATE(timestamp) = ?
        ) AND DATE(timestamp) = ?
        ORDER BY timestamp
      `;
      db.all(query, [date, date], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const anomalies = [];

    for (const stop of stops) {
      const stopTime = moment(stop.scheduled_time, 'HH:mm');
      const scheduledDateTime = moment(date + ' ' + stop.scheduled_time, 'YYYY-MM-DD HH:mm');
      
      let nearbyGPS = null;
      let minDistance = Infinity;
      let nearestTimeDiff = Infinity;

      for (const gps of gpsRecords) {
        const gpsTime = moment(gps.timestamp);
        const timeDiff = Math.abs(gpsTime.diff(scheduledDateTime, 'minutes'));
        
        if (timeDiff <= 60) {
          const distance = AnomalyService.calculateDistance(
            stop.latitude || 39.9,
            stop.longitude || 116.3,
            gps.latitude,
            gps.longitude
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearbyGPS = gps;
            nearestTimeDiff = timeDiff;
          }
        }
      }

      if (nearbyGPS) {
        const actualTime = moment(nearbyGPS.timestamp);
        const delayMinutes = actualTime.diff(scheduledDateTime, 'minutes');
        
        if (delayMinutes > 5 || minDistance > 100) {
          const anomaly = {
            anomaly_type: delayMinutes > 5 ? 'late_arrival' : 'stop_deviation',
            severity: delayMinutes > 15 ? 'high' : (delayMinutes > 10 ? 'medium' : 'low'),
            route_id: routeId,
            stop_id: stop.stop_id,
            stop_name: stop.stop_name,
            gps_record_id: nearbyGPS.id,
            driver_id: nearbyGPS.driver_id,
            driver_name: nearbyGPS.driver_name,
            scheduled_time: stop.scheduled_time,
            actual_time: nearbyGPS.timestamp,
            delay_minutes: Math.max(0, delayMinutes),
            distance_from_stop: Math.round(minDistance),
            description: delayMinutes > 5 
              ? `迟到 ${delayMinutes} 分钟到达 ${stop.stop_name}`
              : `距离站点 ${Math.round(minDistance)} 米，可能未按规定停靠`,
            status: 'pending',
            responsibility: delayMinutes > 10 ? 'driver' : (delayMinutes > 5 ? 'investigate' : 'traffic')
          };
          
          const saved = await AnomalyService.saveAnomaly(anomaly);
          anomalies.push(saved);
        }
      }
    }

    return anomalies;
  }

  static async saveAnomaly(anomaly) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO anomaly_records (
          anomaly_type, severity, route_id, stop_id, stop_name, complaint_id, 
          gps_record_id, driver_id, driver_name, scheduled_time, actual_time,
          delay_minutes, distance_from_stop, description, status, responsibility
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          anomaly.anomaly_type, anomaly.severity, anomaly.route_id,
          anomaly.stop_id, anomaly.stop_name, anomaly.complaint_id,
          anomaly.gps_record_id, anomaly.driver_id, anomaly.driver_name,
          anomaly.scheduled_time, anomaly.actual_time, anomaly.delay_minutes,
          anomaly.distance_from_stop, anomaly.description, anomaly.status,
          anomaly.responsibility
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...anomaly });
          }
        }
      );
    });
  }

  static async getAnomalies(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM anomaly_records WHERE 1=1';
      const params = [];

      if (filters.driver_id) {
        query += ' AND driver_id = ?';
        params.push(filters.driver_id);
      }
      if (filters.driver_name) {
        query += ' AND driver_name LIKE ?';
        params.push(`%${filters.driver_name}%`);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.anomaly_type) {
        query += ' AND anomaly_type = ?';
        params.push(filters.anomaly_type);
      }
      if (filters.severity) {
        query += ' AND severity = ?';
        params.push(filters.severity);
      }
      if (filters.start_date) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.end_date);
      }
      if (filters.responsibility) {
        query += ' AND responsibility = ?';
        params.push(filters.responsibility);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async handleAnomaly(id, handler, status, responsibility, notes) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE anomaly_records 
         SET status = ?, handler = ?, responsibility = ?, handled_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, handler, responsibility, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ updated: this.changes, id, status, handler, responsibility });
          }
        }
      );
    });
  }

  static async getDashboardSummary() {
    const results = {};
    
    results.total_anomalies = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM anomaly_records', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    results.pending_anomalies = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM anomaly_records WHERE status = "pending"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    results.by_severity = await new Promise((resolve, reject) => {
      db.all('SELECT severity, COUNT(*) as count FROM anomaly_records GROUP BY severity', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    results.by_type = await new Promise((resolve, reject) => {
      db.all('SELECT anomaly_type, COUNT(*) as count FROM anomaly_records GROUP BY anomaly_type', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    results.by_responsibility = await new Promise((resolve, reject) => {
      db.all('SELECT responsibility, COUNT(*) as count FROM anomaly_records GROUP BY responsibility', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    results.recent_anomalies = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM anomaly_records ORDER BY created_at DESC LIMIT 10', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    return results;
  }
}

module.exports = AnomalyService;
