const express = require('express');
const { getAsync } = require('../database');

const router = express.Router();

router.get('/devices/status', async (req, res) => {
  const db = getAsync();

  try {
    const devices = await db.all(`
      SELECT DISTINCT device_code 
      FROM readings 
      ORDER BY device_code
    `);

    const deviceList = devices.map(r => r.device_code);
    const result = [];

    for (const deviceCode of deviceList) {
      const latest = await db.get(`
        SELECT * FROM readings 
        WHERE device_code = ? 
        ORDER BY reading_time DESC 
        LIMIT 1
      `, deviceCode);

      const pending = await db.get(`
        SELECT COUNT(*) as count
        FROM anomalies a
        JOIN readings r ON a.reading_id = r.id
        WHERE r.device_code = ? AND a.confirmed = 0
      `, deviceCode);

      result.push({
        device_code: deviceCode,
        latest_reading: latest ? {
          reading_time: latest.reading_time,
          temperature: latest.temperature,
          pressure: latest.pressure,
          status: latest.status
        } : null,
        pending_anomalies: pending.count
      });
    }

    res.json({
      success: true,
      data: {
        total_devices: result.length,
        devices: result
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/devices/:device_code/trend', async (req, res) => {
  const db = getAsync();
  const { device_code } = req.params;
  const { start_time, end_time, limit = 100 } = req.query;

  try {
    let sql = 'SELECT * FROM readings WHERE device_code = ?';
    const params = [device_code];

    if (start_time) {
      sql += ' AND reading_time >= ?';
      params.push(start_time);
    }

    if (end_time) {
      sql += ' AND reading_time <= ?';
      params.push(end_time);
    }

    sql += ' ORDER BY reading_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const readings = await db.all(sql, ...params);

    const stats = await db.get(`
      SELECT 
        MIN(temperature) as min_temp,
        MAX(temperature) as max_temp,
        AVG(temperature) as avg_temp,
        MIN(pressure) as min_pressure,
        MAX(pressure) as max_pressure,
        AVG(pressure) as avg_pressure
      FROM readings 
      WHERE device_code = ?
    `, device_code);

    res.json({
      success: true,
      data: {
        device_code,
        readings: readings.reverse(),
        statistics: {
          temperature: {
            min: stats.min_temp,
            max: stats.max_temp,
            avg: stats.avg_temp ? parseFloat(stats.avg_temp.toFixed(2)) : null
          },
          pressure: {
            min: stats.min_pressure,
            max: stats.max_pressure,
            avg: stats.avg_pressure ? parseFloat(stats.avg_pressure.toFixed(2)) : null
          }
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/reports/by-team', async (req, res) => {
  const db = getAsync();
  const { team_name, start_time, end_time, format = 'json' } = req.query;

  try {
    let taskSql = 'SELECT * FROM tasks WHERE 1=1';
    const taskParams = [];

    if (team_name) {
      taskSql += ' AND team_name = ?';
      taskParams.push(team_name);
    }

    const tasks = await db.all(taskSql, ...taskParams);
    const report = [];

    for (const task of tasks) {
      const taskDevices = JSON.parse(task.devices);

      let packageSql = 'SELECT p.* FROM packages p WHERE p.task_code = ?';
      const packageParams = [task.task_code];

      if (start_time) {
        packageSql += ' AND p.uploaded_at >= ?';
        packageParams.push(start_time);
      }

      if (end_time) {
        packageSql += ' AND p.uploaded_at <= ?';
        packageParams.push(end_time);
      }

      const packages = await db.all(packageSql, ...packageParams);
      const packageIds = packages.map(p => p.id);

      let readings = [];
      let anomalies = [];

      if (packageIds.length > 0) {
        const placeholders = packageIds.map(() => '?').join(',');
        readings = await db.all(
          `SELECT * FROM readings WHERE package_id IN (${placeholders})`,
          ...packageIds
        );

        anomalies = await db.all(
          `SELECT a.*, r.device_code, r.reading_time
           FROM anomalies a
           JOIN readings r ON a.reading_id = r.id
           WHERE r.package_id IN (${placeholders})`,
          ...packageIds
        );
      }

      const totalReadings = readings.length;
      const validReadings = readings.filter(r => r.status === 'valid').length;
      const anomalyReadings = readings.filter(r => r.status === 'anomaly').length;
      const pendingAnomalies = anomalies.filter(a => a.confirmed === 0).length;
      const confirmedAnomalies = anomalies.filter(a => a.confirmed === 1).length;

      const deviceStats = taskDevices.map(deviceCode => {
        const deviceReadings = readings.filter(r => r.device_code === deviceCode);
        return {
          device_code: deviceCode,
          readings_count: deviceReadings.length,
          last_reading: deviceReadings.length > 0
            ? deviceReadings.sort((a, b) =>
                new Date(b.reading_time) - new Date(a.reading_time)
              )[0]
            : null
        };
      });

      report.push({
        team_name: task.team_name,
        task_code: task.task_code,
        task_due_date: task.due_date,
        devices: taskDevices,
        statistics: {
          packages_submitted: packages.length,
          total_readings: totalReadings,
          valid_readings: validReadings,
          anomaly_readings: anomalyReadings,
          pending_anomalies: pendingAnomalies,
          confirmed_anomalies: confirmedAnomalies
        },
        device_details: deviceStats,
        packages: packages,
        anomalies: anomalies
      });
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inspection-report-${Date.now()}.csv"`);

      let csv = '\uFEFF';
      csv += '班组,任务编号,设备编码,读数时间,温度(°C),压力(MPa),状态\n';

      for (const item of report) {
        const allReadings = await db.all(`
          SELECT r.* FROM readings r
          JOIN packages p ON r.package_id = p.id
          WHERE p.task_code = ?
        `, item.task_code);

        for (const reading of allReadings) {
          csv += `${item.team_name},${item.task_code},${reading.device_code},${reading.reading_time},${reading.temperature || ''},${reading.pressure || ''},${reading.status}\n`;
        }
      }

      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        teams: report
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
