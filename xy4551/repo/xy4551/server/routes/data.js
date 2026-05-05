const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const dataDir = path.join(__dirname, '../../data');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 CSV 和 JSON 格式文件'), false);
    }
  }
});

function getDataFilePath() {
  return path.join(dataDir, 'stored-data.json');
}

function loadStoredData() {
  const filePath = getDataFilePath();
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }
  return {
    surgerySchedule: [],
    postOpCages: [],
    oxygenLogs: [],
    anesthesiaRecovery: [],
    ownerNotes: [],
    overrides: {},
    additionalNotes: {}
  };
}

function saveStoredData(data) {
  const filePath = getDataFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    bufferStream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

router.get('/', (req, res) => {
  try {
    const data = loadStoredData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const { dataType } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '请选择要导入的文件' });
    }

    if (!dataType) {
      return res.status(400).json({ error: '请指定数据类型' });
    }

    let parsedData;
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.json') {
      parsedData = JSON.parse(file.buffer.toString('utf-8'));
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
    } else if (ext === '.csv') {
      parsedData = await parseCSV(file.buffer);
    }

    parsedData = parsedData.map(item => ({
      id: uuidv4(),
      ...item,
      importedAt: new Date().toISOString()
    }));

    const storedData = loadStoredData();
    const typeKey = getTypeKey(dataType);
    
    if (typeKey) {
      storedData[typeKey] = [...storedData[typeKey], ...parsedData];
      saveStoredData(storedData);
    }

    res.json({
      success: true,
      importedCount: parsedData.length,
      dataType,
      records: parsedData
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/record/:dataType/:id', (req, res) => {
  try {
    const { dataType, id } = req.params;
    const updates = req.body;
    
    const storedData = loadStoredData();
    const typeKey = getTypeKey(dataType);
    
    if (!typeKey || !storedData[typeKey]) {
      return res.status(400).json({ error: '无效的数据类型' });
    }

    const index = storedData[typeKey].findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '记录不存在' });
    }

    storedData[typeKey][index] = {
      ...storedData[typeKey][index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    saveStoredData(storedData);
    res.json({ success: true, record: storedData[typeKey][index] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/record/:dataType/:id', (req, res) => {
  try {
    const { dataType, id } = req.params;
    
    const storedData = loadStoredData();
    const typeKey = getTypeKey(dataType);
    
    if (!typeKey || !storedData[typeKey]) {
      return res.status(400).json({ error: '无效的数据类型' });
    }

    storedData[typeKey] = storedData[typeKey].filter(item => item.id !== id);
    saveStoredData(storedData);
    
    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/override/:riskId', (req, res) => {
  try {
    const { riskId } = req.params;
    const { status, overrideNote } = req.body;
    
    const storedData = loadStoredData();
    
    if (!storedData.overrides) {
      storedData.overrides = {};
    }
    
    storedData.overrides[riskId] = {
      status,
      overrideNote,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    saveStoredData(storedData);
    res.json({ success: true, override: storedData.overrides[riskId] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/note/:recordType/:recordId', (req, res) => {
  try {
    const { recordType, recordId } = req.params;
    const { note } = req.body;
    
    const storedData = loadStoredData();
    
    if (!storedData.additionalNotes) {
      storedData.additionalNotes = {};
    }
    
    const key = `${recordType}:${recordId}`;
    storedData.additionalNotes[key] = {
      note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    saveStoredData(storedData);
    res.json({ success: true, note: storedData.additionalNotes[key] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/clear-all', (req, res) => {
  try {
    const storedData = {
      surgerySchedule: [],
      postOpCages: [],
      oxygenLogs: [],
      anesthesiaRecovery: [],
      ownerNotes: [],
      overrides: {},
      additionalNotes: {}
    };
    
    saveStoredData(storedData);
    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getTypeKey(dataType) {
  const typeMap = {
    'surgery': 'surgerySchedule',
    'surgerySchedule': 'surgerySchedule',
    'cage': 'postOpCages',
    'postOpCages': 'postOpCages',
    'oxygen': 'oxygenLogs',
    'oxygenLogs': 'oxygenLogs',
    'recovery': 'anesthesiaRecovery',
    'anesthesiaRecovery': 'anesthesiaRecovery',
    'owner': 'ownerNotes',
    'ownerNotes': 'ownerNotes'
  };
  return typeMap[dataType];
}

module.exports = router;
