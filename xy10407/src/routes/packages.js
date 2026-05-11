const express = require('express');
const { getAsync } = require('../database');
const {
  validatePackage,
  isTemperatureOutOfRange,
  isPressureOutOfRange,
  isTaskExpired,
  checkDuplicateReadings
} = require('../utils/validators');

const router = express.Router();

async function getExistingPackage(db, packageCode) {
  return await db.get(`
    SELECT 
      p.*,
      t.team_name,
      t.due_date
    FROM packages p
    JOIN tasks t ON p.task_code = t.task_code
    WHERE p.package_code = ?
  `, packageCode);
}

function buildPackageResponse(pkg, details = null) {
  const response = {
    package_code: pkg.package_code,
    task_code: pkg.task_code,
    status: pkg.status,
    uploaded_at: pkg.uploaded_at,
    statistics: {
      processed: pkg.processed_readings,
      valid: pkg.valid_readings,
      invalid: pkg.invalid_readings
    }
  };

  if (pkg.error_message) {
    response.error = pkg.error_message;
  }

  if (details) {
    response.details = details;
  }

  return response;
}

router.post('/packages/upload', async (req, res) => {
  const db = getAsync();
  const pkg = req.body;

  try {
    const existing = await getExistingPackage(db, pkg.package_code);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: '该包已上传，返回已有处理结果',
        data: buildPackageResponse(existing)
      });
    }

    const { error } = validatePackage(pkg);
    if (error) {
      return res.status(400).json({
        success: false,
        error: '数据格式校验失败',
        details: error.details.map(e => e.message)
      });
    }

    const task = await db.get('SELECT * FROM tasks WHERE task_code = ?', pkg.task_code);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `任务 ${pkg.task_code} 不存在`
      });
    }

    if (isTaskExpired(task.due_date)) {
      return res.status(400).json({
        success: false,
        error: `任务 ${pkg.task_code} 已过期，截止时间: ${task.due_date}`
      });
    }

    const internalDuplicates = checkDuplicateReadings(pkg.readings);
    const dbDuplicateChecks = [];

    for (const reading of pkg.readings) {
      const exists = await db.get(
        'SELECT 1 FROM readings WHERE device_code = ? AND reading_time = ?',
        reading.device_code,
        reading.reading_time
      );
      if (exists) {
        dbDuplicateChecks.push({
          device_code: reading.device_code,
          reading_time: reading.reading_time
        });
      }
    }

    if (internalDuplicates.length > 0 || dbDuplicateChecks.length > 0) {
      const allDuplicates = {
        internal_duplicates: internalDuplicates,
        database_duplicates: dbDuplicateChecks
      };

      await db.run(
        `INSERT INTO packages (package_code, task_code, inspector_name, status, error_message, processed_readings, valid_readings, invalid_readings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        pkg.package_code,
        pkg.task_code,
        pkg.inspector_name,
        'rejected',
        '存在重复读数',
        pkg.readings.length,
        0,
        pkg.readings.length
      );

      return res.status(400).json({
        success: false,
        error: '存在重复读数（同一设备同一时间多次读数）',
        details: allDuplicates
      });
    }

    const details = {
      valid_readings: [],
      anomalies: []
    };

    let validCount = 0;
    let invalidCount = 0;

    const pkgResult = await db.run(
      `INSERT INTO packages (package_code, task_code, inspector_name, status, processed_readings, valid_readings, invalid_readings)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      pkg.package_code,
      pkg.task_code,
      pkg.inspector_name,
      'processed',
      pkg.readings.length,
      0,
      0
    );

    const packageId = pkgResult.lastID;

    for (const reading of pkg.readings) {
      const readingAnomalies = [];
      let readingStatus = 'valid';

      if (reading.temperature !== undefined && isTemperatureOutOfRange(reading.temperature)) {
        readingAnomalies.push({
          type: 'temperature_out_of_range',
          detail: `温度 ${reading.temperature}°C 超出范围 [-10, 80]°C`
        });
        readingStatus = 'anomaly';
      }

      if (reading.pressure !== undefined && isPressureOutOfRange(reading.pressure)) {
        readingAnomalies.push({
          type: 'pressure_out_of_range',
          detail: `压力 ${reading.pressure}MPa 超出范围 [0, 10]MPa`
        });
        readingStatus = 'anomaly';
      }

      const readingResult = await db.run(
        `INSERT INTO readings (package_id, device_code, reading_time, temperature, pressure, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        packageId,
        reading.device_code,
        reading.reading_time,
        reading.temperature,
        reading.pressure,
        readingStatus
      );

      const readingId = readingResult.lastID;

      if (readingStatus === 'valid') {
        validCount++;
        details.valid_readings.push({
          device_code: reading.device_code,
          reading_time: reading.reading_time,
          temperature: reading.temperature,
          pressure: reading.pressure
        });
      } else {
        invalidCount++;
        for (const anomaly of readingAnomalies) {
          await db.run(
            'INSERT INTO anomalies (reading_id, anomaly_type, detail) VALUES (?, ?, ?)',
            readingId,
            anomaly.type,
            anomaly.detail
          );
          details.anomalies.push({
            device_code: reading.device_code,
            reading_time: reading.reading_time,
            type: anomaly.type,
            detail: anomaly.detail
          });
        }
      }
    }

    await db.run(
      'UPDATE packages SET valid_readings = ?, invalid_readings = ? WHERE id = ?',
      validCount,
      invalidCount,
      packageId
    );

    const finalPkg = await getExistingPackage(db, pkg.package_code);

    res.status(201).json({
      success: true,
      message: '离线包处理完成',
      data: buildPackageResponse(finalPkg, details)
    });

  } catch (err) {
    console.error(err);

    if (err.message && err.message.includes('UNIQUE') && err.message.includes('packages.package_code')) {
      const existing = await getExistingPackage(db, pkg.package_code);
      if (existing) {
        return res.status(200).json({
          success: true,
          message: '该包已上传，返回已有处理结果',
          data: buildPackageResponse(existing)
        });
      }
    }

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/packages/:package_code', async (req, res) => {
  const db = getAsync();
  const { package_code } = req.params;

  try {
    const pkg = await getExistingPackage(db, package_code);
    if (!pkg) {
      return res.status(404).json({
        success: false,
        error: '离线包不存在'
      });
    }

    const readings = await db.all('SELECT * FROM readings WHERE package_id = ?', pkg.id);
    const anomalies = await db.all(`
      SELECT a.*, r.device_code, r.reading_time 
      FROM anomalies a
      JOIN readings r ON a.reading_id = r.id
      WHERE r.package_id = ?
    `, pkg.id);

    res.json({
      success: true,
      data: {
        ...buildPackageResponse(pkg),
        readings,
        anomalies
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
