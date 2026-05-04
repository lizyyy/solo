const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
const FileManager = require('../utils/fileManager');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../temp_uploads') });

fs.ensureDirSync(path.join(__dirname, '../../temp_uploads'));

router.post('/tide', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件上传' });
    }

    const results = [];
    const filePath = req.file.path;

    const readStream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const tideData = parseTideData(results);
        FileManager.saveTideData(tideData);
        
        try {
          await fs.remove(filePath);
        } catch (e) {
          console.error('删除临时文件失败:', e);
        }
        
        res.json({
          success: true,
          message: `成功导入 ${tideData.records.length} 条潮汐数据`,
          data: tideData
        });
      })
      .on('error', (error) => {
        res.status(500).json({ error: '解析CSV文件失败: ' + error.message });
      });

  } catch (error) {
    res.status(500).json({ error: '上传失败: ' + error.message });
  }
});

router.post('/berth', express.json(), (req, res) => {
  try {
    const berthData = req.body;
    
    if (!berthData || !Array.isArray(berthData.berths)) {
      return res.status(400).json({ error: '泊位数据格式不正确' });
    }

    FileManager.saveBerthData(berthData);
    
    res.json({
      success: true,
      message: `成功导入 ${berthData.berths.length} 个泊位数据`,
      data: berthData
    });
  } catch (error) {
    res.status(500).json({ error: '导入泊位数据失败: ' + error.message });
  }
});

router.post('/barge', express.json(), (req, res) => {
  try {
    const bargeData = req.body;
    
    if (!bargeData || !Array.isArray(bargeData.barges)) {
      return res.status(400).json({ error: '驳船数据格式不正确' });
    }

    FileManager.saveBargeData(bargeData);
    
    res.json({
      success: true,
      message: `成功导入 ${bargeData.barges.length} 艘驳船数据`,
      data: bargeData
    });
  } catch (error) {
    res.status(500).json({ error: '导入驳船数据失败: ' + error.message });
  }
});

router.get('/status', (req, res) => {
  try {
    const tideData = FileManager.loadTideData();
    const berthData = FileManager.loadBerthData();
    const bargeData = FileManager.loadBargeData();

    res.json({
      success: true,
      data: {
        tide: tideData ? { loaded: true, count: tideData.records.length } : { loaded: false },
        berth: berthData ? { loaded: true, count: berthData.berths.length } : { loaded: false },
        barge: bargeData ? { loaded: true, count: bargeData.barges.length } : { loaded: false }
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取数据状态失败: ' + error.message });
  }
});

function parseTideData(rawData) {
  const records = rawData.map(row => {
    let time = null;
    let height = null;
    let current = null;

    for (const [key, value] of Object.entries(row)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('时间') || lowerKey.includes('time') || lowerKey.includes('日期')) {
        time = parseDateTime(value);
      } else if (lowerKey.includes('潮位') || lowerKey.includes('height') || lowerKey.includes('level')) {
        height = parseFloat(value);
      } else if (lowerKey.includes('流速') || lowerKey.includes('current') || lowerKey.includes('speed')) {
        current = parseFloat(value);
      }
    }

    return {
      time,
      height: isNaN(height) ? null : height,
      current: isNaN(current) ? null : current,
      raw: row
    };
  }).filter(r => r.time !== null);

  records.sort((a, b) => new Date(a.time) - new Date(b.time));

  return {
    importedAt: new Date().toISOString(),
    startTime: records[0]?.time,
    endTime: records[records.length - 1]?.time,
    records
  };
}

function parseDateTime(value) {
  if (!value) return null;
  
  const formats = [
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY/MM/DD HH:mm',
    'DD/MM/YYYY HH:mm',
    'MM/DD/YYYY HH:mm'
  ];

  for (const format of formats) {
    const parsed = moment(value, format, true);
    if (parsed.isValid()) {
      return parsed.toISOString();
    }
  }

  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }

  return null;
}

module.exports = router;
