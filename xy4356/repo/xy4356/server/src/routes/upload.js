import express from 'express';
import multer from 'multer';
import { parseKML, parseGeoJSON, parseCSV } from '../utils/parsers.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/kml', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 KML 文件' });
    }
    
    const kmlData = await parseKML(req.file.path);
    res.json({ 
      success: true, 
      data: kmlData,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('解析 KML 失败:', error);
    res.status(500).json({ error: '解析 KML 文件失败: ' + error.message });
  }
});

router.post('/geojson', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 GeoJSON 文件' });
    }
    
    const geoJsonData = await parseGeoJSON(req.file.path);
    res.json({ 
      success: true, 
      data: geoJsonData,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('解析 GeoJSON 失败:', error);
    res.status(500).json({ error: '解析 GeoJSON 文件失败: ' + error.message });
  }
});

router.post('/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }
    
    const csvData = await parseCSV(req.file.path);
    res.json({ 
      success: true, 
      data: csvData,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('解析 CSV 失败:', error);
    res.status(500).json({ error: '解析 CSV 文件失败: ' + error.message });
  }
});

export default router;
