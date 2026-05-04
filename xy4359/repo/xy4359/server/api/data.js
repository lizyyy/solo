const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();
const Level = require('../models/Level');

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.json') {
      cb(null, true);
    } else {
      cb(new Error('只支持 JSON 文件'), false);
    }
  }
});

router.post('/import-scene', upload.single('sceneFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }
    
    const sceneData = JSON.parse(req.file.buffer.toString('utf-8'));
    
    res.json({
      success: true,
      message: '场景数据导入成功',
      data: sceneData
    });
  } catch (error) {
    console.error('导入场景数据失败:', error);
    res.status(400).json({ 
      error: '导入失败', 
      message: error.message 
    });
  }
});

router.post('/import-props', upload.single('propsFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }
    
    const propsList = JSON.parse(req.file.buffer.toString('utf-8'));
    
    res.json({
      success: true,
      message: '道具清单导入成功',
      data: propsList
    });
  } catch (error) {
    console.error('导入道具清单失败:', error);
    res.status(400).json({ 
      error: '导入失败', 
      message: error.message 
    });
  }
});

router.post('/parse-json', (req, res) => {
  try {
    const { jsonString, type } = req.body;
    
    if (!jsonString) {
      return res.status(400).json({ error: '请提供 JSON 数据' });
    }
    
    const parsedData = JSON.parse(jsonString);
    
    res.json({
      success: true,
      message: 'JSON 解析成功',
      data: parsedData,
      type: type || 'unknown'
    });
  } catch (error) {
    console.error('解析 JSON 失败:', error);
    res.status(400).json({ 
      error: 'JSON 解析失败', 
      message: error.message 
    });
  }
});

module.exports = router;
