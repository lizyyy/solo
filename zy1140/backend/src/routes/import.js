const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const { parseAppleHealthXML } = require('../parsers/xmlParser');
const { parseGPX } = require('../parsers/gpxParser');
const { parseDailyNotesCSV } = require('../parsers/csvParser');
const { parseThresholdsJSON } = require('../parsers/jsonParser');
const { readFileWithEncoding, detectFileType } = require('../utils/file');
const { aggregateDailySummary, saveDailySummary } = require('../services/dataProcessor');
const db = require('../database');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.ensureDirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xml', '.gpx', '.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }

  const importLogId = `import_${Date.now()}`;
  const now = new Date().toISOString();

  try {
    db.run(`
      INSERT INTO import_logs (id, filename, file_type, started_at, status)
      VALUES (?, ?, ?, ?, ?)
    `, [importLogId, req.file.originalname, 'pending', now, 'processing']);

    const filePath = req.file.path;
    const fileContent = await readFileWithEncoding(filePath);
    const fileType = detectFileType(req.file.originalname, fileContent);

    db.run(`
      UPDATE import_logs SET file_type = ? WHERE id = ?
    `, [fileType, importLogId]);

    let result;
    switch (fileType) {
      case 'apple-health-xml':
        result = await importAppleHealthXML(fileContent, importLogId);
        break;
      case 'gpx':
        result = await importGPX(fileContent, req.file.originalname, importLogId);
        break;
      case 'daily-notes':
        result = await importDailyNotes(fileContent, importLogId);
        break;
      case 'thresholds':
        result = await importThresholds(fileContent, importLogId);
        break;
      default:
        throw new Error(`无法识别的文件格式: ${fileType}`);
    }

    db.run(`
      UPDATE import_logs 
      SET records_imported = ?, records_skipped = ?, completed_at = ?, status = ?
      WHERE id = ?
    `, [result.imported || 0, result.skipped || 0, new Date().toISOString(), 'completed', importLogId]);

    res.json({
      success: true,
      fileType,
      filename: req.file.originalname,
      ...result,
      importLogId,
    });

  } catch (error) {
    console.error('Import error:', error);
    
    db.run(`
      UPDATE import_logs 
      SET errors = ?, completed_at = ?, status = ?
      WHERE id = ?
    `, [error.message, new Date().toISOString(), 'failed', importLogId]);

    res.status(500).json({
      success: false,
      error: error.message,
      importLogId,
    });
  }
});

router.post('/multiple', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }

  const results = [];
  const errors = [];

  for (const file of req.files) {
    try {
      const filePath = file.path;
      const fileContent = await readFileWithEncoding(filePath);
      const fileType = detectFileType(file.originalname, fileContent);

      let result;
      switch (fileType) {
        case 'apple-health-xml':
          result = await importAppleHealthXML(fileContent, `multi_${Date.now()}`);
          break;
        case 'gpx':
          result = await importGPX(fileContent, file.originalname, `multi_${Date.now()}`);
          break;
        case 'daily-notes':
          result = await importDailyNotes(fileContent, `multi_${Date.now()}`);
          break;
        case 'thresholds':
          result = await importThresholds(fileContent, `multi_${Date.now()}`);
          break;
        default:
          throw new Error(`无法识别的文件格式`);
      }

      results.push({
        filename: file.originalname,
        fileType,
        success: true,
        ...result,
      });

    } catch (error) {
      errors.push({
        filename: file.originalname,
        error: error.message,
      });
    }
  }

  res.json({
    success: errors.length === 0,
    results,
    errors,
    totalFiles: req.files.length,
    successful: results.length,
    failed: errors.length,
  });
});

router.get('/history', async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  
  const logs = db.all(`
    SELECT * FROM import_logs 
    ORDER BY started_at DESC 
    LIMIT ? OFFSET ?
  `, [parseInt(limit), parseInt(offset)]);

  const total = db.get(`SELECT COUNT(*) as count FROM import_logs`);

  res.json({
    logs,
    pagination: {
      total: total?.count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
});

async function importAppleHealthXML(xmlContent, importLogId) {
  const parsed = await parseAppleHealthXML(xmlContent);
  
  let importedRecords = 0;
  let skippedRecords = 0;
  const affectedDates = new Set();

  for (const record of parsed.records) {
    try {
      const existing = db.get(`
        SELECT id FROM health_records WHERE id = ?
      `, [record.id]);

      if (!existing) {
        db.run(`
          INSERT INTO health_records (
            id, type, source_name, source_version, device,
            unit, value, start_date, end_date, creation_date,
            metadata, date, hour
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          record.id, record.type, record.sourceName, record.sourceVersion, record.device,
          record.unit, record.value, record.startDate, record.endDate, record.creationDate,
          record.metadata, record.date, record.hour
        ]);
        importedRecords++;
        affectedDates.add(record.date);
      } else {
        skippedRecords++;
      }
    } catch (e) {
      console.warn('Error inserting record:', e.message);
      skippedRecords++;
    }
  }

  let importedWorkouts = 0;
  let skippedWorkouts = 0;

  for (const workout of parsed.workouts) {
    try {
      const existing = db.get(`
        SELECT id FROM workouts WHERE id = ?
      `, [workout.id]);

      if (!existing) {
        db.run(`
          INSERT INTO workouts (
            id, workout_activity_type, duration, duration_unit,
            total_distance, total_distance_unit, total_energy_burned, total_energy_burned_unit,
            start_date, end_date, creation_date, source_name, device,
            metadata, date, gpx_file, has_gpx
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          workout.id, workout.workoutActivityType, workout.duration, workout.durationUnit,
          workout.totalDistance, workout.totalDistanceUnit, workout.totalEnergyBurned, workout.totalEnergyBurnedUnit,
          workout.startDate, workout.endDate, workout.creationDate, workout.sourceName, workout.device,
          workout.metadata, workout.date, workout.gpxFile, workout.hasGpx
        ]);
        importedWorkouts++;
        affectedDates.add(workout.date);
      } else {
        skippedWorkouts++;
      }
    } catch (e) {
      console.warn('Error inserting workout:', e.message);
      skippedWorkouts++;
    }
  }

  for (const date of affectedDates) {
    const summary = await aggregateDailySummary(date);
    if (summary) {
      await saveDailySummary(summary);
    }
  }

  return {
    imported: importedRecords + importedWorkouts,
    skipped: skippedRecords + skippedWorkouts,
    records: { imported: importedRecords, skipped: skippedRecords },
    workouts: { imported: importedWorkouts, skipped: skippedWorkouts },
    recordTypes: parsed.recordTypes,
    affectedDates: Array.from(affectedDates).sort(),
    affectedDateCount: affectedDates.size,
  };
}

async function importGPX(gpxContent, filename, importLogId) {
  const parsed = await parseGPX(gpxContent);

  if (parsed.totalPoints === 0) {
    return { imported: 0, skipped: 0, message: 'GPX 文件中没有轨迹点' };
  }

  let importedPoints = 0;
  const affectedDates = new Set();

  if (parsed.metadata?.time) {
    affectedDates.add(parsed.metadata.time.split('T')[0]);
  }

  for (const point of parsed.points) {
    try {
      const id = `gpx_${Date.now()}_${point.index}_${Math.random().toString(36).substr(2, 6)}`;
      
      if (point.time) {
        affectedDates.add(point.time.split('T')[0]);
      }

      db.run(`
        INSERT INTO workout_routes (
          id, workout_id, point_index, latitude, longitude,
          elevation, timestamp, heart_rate, speed, cadence, distance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, 'pending', point.index, point.latitude, point.longitude,
        point.elevation, point.time, point.heartRate, point.speed, point.cadence, point.distance
      ]);
      importedPoints++;
    } catch (e) {
      console.warn('Error inserting GPX point:', e.message);
    }
  }

  return {
    imported: importedPoints,
    skipped: parsed.totalPoints - importedPoints,
    stats: parsed.stats,
    totalPoints: parsed.totalPoints,
    totalTracks: parsed.totalTracks,
    affectedDates: Array.from(affectedDates),
  };
}

async function importDailyNotesCSV(csvContent, importLogId) {
  const parsed = parseDailyNotesCSV(csvContent);

  if (parsed.errors.length > 0) {
    console.warn('CSV parsing errors:', parsed.errors);
  }

  let importedNotes = 0;
  let skippedNotes = 0;
  const affectedDates = new Set();

  for (const note of parsed.notes) {
    try {
      const existing = db.get(`
        SELECT id FROM daily_notes WHERE date = ?
      `, [note.date]);

      const now = new Date().toISOString();

      if (existing) {
        const existingTags = existing.tags ? existing.tags.split(',').filter(Boolean) : [];
        const newTags = note.tagsArray || [];
        const mergedTags = [...new Set([...existingTags, ...newTags])];
        
        db.run(`
          UPDATE daily_notes 
          SET tags = ?, note = ?, source = ?, updated_at = ?
          WHERE date = ?
        `, [mergedTags.join(','), note.note || existing.note, note.source, now, note.date]);
      } else {
        db.run(`
          INSERT INTO daily_notes (
            id, date, tags, note, source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [note.id, note.date, note.tags, note.note, note.source, now, now]);
      }
      
      importedNotes++;
      affectedDates.add(note.date);
    } catch (e) {
      console.warn('Error inserting note:', e.message);
      skippedNotes++;
    }
  }

  return {
    imported: importedNotes,
    skipped: skippedNotes + (parsed.errors?.length || 0),
    totalRows: parsed.totalRows,
    errors: parsed.errors,
    affectedDates: Array.from(affectedDates),
  };
}

async function importThresholdsJSON(jsonContent, importLogId) {
  const parsed = parseThresholdsJSON(jsonContent);

  if (parsed.errors.length > 0) {
    console.warn('Thresholds parsing errors:', parsed.errors);
  }

  let importedThresholds = 0;
  let skippedThresholds = 0;

  for (const threshold of parsed.thresholds) {
    try {
      const existing = db.get(`
        SELECT id FROM thresholds WHERE category = ? AND key = ?
      `, [threshold.category, threshold.key]);

      const now = new Date().toISOString();

      if (existing) {
        db.run(`
          UPDATE thresholds 
          SET value = ?, label = ?, description = ?, unit = ?, updated_at = ?
          WHERE category = ? AND key = ?
        `, [threshold.value, threshold.label, threshold.description, threshold.unit, now, threshold.category, threshold.key]);
      } else {
        db.run(`
          INSERT INTO thresholds (
            id, category, key, value, label, description, unit, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [threshold.id, threshold.category, threshold.key, threshold.value, threshold.label, threshold.description, threshold.unit, now, now]);
      }
      
      importedThresholds++;
    } catch (e) {
      console.warn('Error inserting threshold:', e.message);
      skippedThresholds++;
    }
  }

  return {
    imported: importedThresholds,
    skipped: skippedThresholds + (parsed.errors?.length || 0),
    totalCount: parsed.totalCount,
    validCount: parsed.validCount,
    errors: parsed.errors,
  };
}

module.exports = router;
