const express = require('express');
const multer = require('multer');
const path = require('path');
const importService = require('../services/importService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    const fs = require('fs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/warehouse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的 CSV 文件'
      });
    }

    const result = await importService.importWarehouseCsv(req.file.path);
    
    const fs = require('fs');
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/access-control', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的 JSON 文件'
      });
    }

    const fs = require('fs');
    const jsonData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const result = await importService.importAccessControlRepairs(jsonData);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/retrieval', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件 (CSV 或 JSON)'
      });
    }

    const isCsv = req.file.originalname.toLowerCase().endsWith('.csv');
    const result = await importService.importRetrievalTasks(req.file.path, isCsv);
    
    const fs = require('fs');
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/all', upload.fields([
  { name: 'warehouse', maxCount: 10 },
  { name: 'accessControl', maxCount: 1 },
  { name: 'retrieval', maxCount: 1 }
]), async (req, res) => {
  try {
    const warehouseFiles = req.files?.warehouse || [];
    const accessControlFile = req.files?.accessControl?.[0] || null;
    const retrievalFile = req.files?.retrieval?.[0] || null;

    if (warehouseFiles.length === 0 && !accessControlFile && !retrievalFile) {
      return res.status(400).json({
        success: false,
        error: '请至少选择一个文件上传'
      });
    }

    const result = await importService.importAll(warehouseFiles, accessControlFile, retrievalFile);
    
    const fs = require('fs');
    const allFiles = [...warehouseFiles];
    if (accessControlFile) allFiles.push(accessControlFile);
    if (retrievalFile) allFiles.push(retrievalFile);
    
    allFiles.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
