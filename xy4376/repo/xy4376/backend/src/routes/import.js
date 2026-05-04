import { Router } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database.js';
import { analyzeIssues } from '../services/issueAnalyzer.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/geojson', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传 GeoJSON 文件' });
  }
  
  try {
    const geojson = JSON.parse(req.file.buffer.toString('utf-8'));
    
    if (!geojson.type || !geojson.features) {
      return res.status(400).json({ error: '无效的 GeoJSON 格式' });
    }
    
    res.json({
      success: true,
      data: geojson,
      filename: req.file.originalname
    });
  } catch (error) {
    res.status(400).json({ error: 'GeoJSON 解析失败: ' + error.message });
  }
});

router.post('/csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }
  
  const results = [];
  const bufferStream = new Readable();
  bufferStream._read = () => {};
  bufferStream.push(req.file.buffer);
  bufferStream.push(null);
  
  bufferStream
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      res.json({
        success: true,
        data: results,
        filename: req.file.originalname
      });
    })
    .on('error', (error) => {
      res.status(400).json({ error: 'CSV 解析失败: ' + error.message });
    });
});

router.post('/sensor-json', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传 JSON 文件' });
  }
  
  try {
    const data = JSON.parse(req.file.buffer.toString('utf-8'));
    res.json({
      success: true,
      data: data,
      filename: req.file.originalname
    });
  } catch (error) {
    res.status(400).json({ error: 'JSON 解析失败: ' + error.message });
  }
});

router.post('/create-session', async (req, res) => {
  const db = getDB();
  const { name, description, geojson, fanWindowData, sensorData } = req.body;
  
  const sessionId = uuidv4();
  const now = new Date().toISOString();
  
  try {
    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO training_sessions (id, name, description, created_at, updated_at, venue_geojson, fan_window_data, sensor_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        name || '未命名训练',
        description || '',
        now,
        now,
        geojson ? JSON.stringify(geojson) : null,
        fanWindowData ? JSON.stringify(fanWindowData) : null,
        sensorData ? JSON.stringify(sensorData) : null
      );
      
      if (sensorData && sensorData.sensors) {
        const sensorStmt = db.prepare(`
          INSERT INTO sensor_points (id, session_id, name, x, y, z, type)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const sensor of sensorData.sensors) {
          sensorStmt.run(
            uuidv4(),
            sessionId,
            sensor.name || sensor.id,
            sensor.x || 0,
            sensor.y || 0,
            sensor.z || 0,
            sensor.type || 'smoke'
          );
        }
      }
      
      const issues = analyzeIssues({ geojson, fanWindowData, sensorData });
      const issueStmt = db.prepare(`
        INSERT INTO identified_issues (id, session_id, issue_type, severity, description, timestamp, location, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const issue of issues) {
        issueStmt.run(
          uuidv4(),
          sessionId,
          issue.type,
          issue.severity,
          issue.description,
          issue.timestamp || null,
          issue.location || null,
          issue.details ? JSON.stringify(issue.details) : null
        );
      }
    });
    
    transaction();
    
    res.status(201).json({
      success: true,
      sessionId: sessionId,
      message: '训练场次创建成功'
    });
  } catch (error) {
    console.error('创建训练场次失败:', error);
    res.status(500).json({ error: '创建训练场次失败: ' + error.message });
  }
});

export default router;
