import express from 'express';
import multer from 'multer';
import { importStopPoints, getImportHistory, getStopPoints } from '../services/dataImport.js';
import store from '../store.js';

const router = express.Router();
const upload = multer({ dest: '/tmp/' });

router.post('/points', (req, res) => {
  try {
    const result = importStopPoints(req.body, 'api_upload');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message,
      error: error.stack
    });
  }
});

router.post('/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }
    
    const fs = require('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');
    let data;
    
    if (req.file.originalname.endsWith('.json')) {
      data = JSON.parse(content);
    } else if (req.file.originalname.endsWith('.csv')) {
      data = parseCSV(content);
    } else {
      return res.status(400).json({
        success: false,
        message: '不支持的文件格式，请上传JSON或CSV文件'
      });
    }
    
    const result = importStopPoints(data, req.file.originalname);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '文件导入失败: ' + error.message,
      error: error.stack
    });
  }
});

router.get('/history', (req, res) => {
  res.json({
    success: true,
    data: getImportHistory()
  });
});

router.get('/points', (req, res) => {
  const { status, source } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (source) filters.source = source;
  
  res.json({
    success: true,
    data: getStopPoints(filters)
  });
});

router.get('/stats', (req, res) => {
  const validPoints = store.stopPoints.filter(p => p.status === 'valid');
  const invalidPoints = store.stopPoints.filter(p => p.status === 'invalid');
  
  res.json({
    success: true,
    data: {
      total: store.stopPoints.length,
      valid: validPoints.length,
      invalid: invalidPoints.length,
      bySource: {},
      lastImport: store.uploadHistory.length > 0 
        ? store.uploadHistory[store.uploadHistory.length - 1] 
        : null
    }
  });
});

function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const obj = {};
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      let value = values[j];
      
      if (header === 'x' || header === 'y' || header === 'duration') {
        value = Number(value);
      }
      
      obj[header] = value;
    }
    
    data.push(obj);
  }
  
  return data;
}

export default router;
