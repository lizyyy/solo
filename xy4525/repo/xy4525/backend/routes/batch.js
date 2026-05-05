const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const STORAGE_FILE = path.join(__dirname, '../data/storage.json');
const SAMPLES_DIR = path.join(__dirname, '../data/samples');

function ensureStorageFile() {
  const dir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ batches: [], reviews: [] }, null, 2));
  }
}

function readStorage() {
  ensureStorageFile();
  const content = fs.readFileSync(STORAGE_FILE, 'utf8');
  return JSON.parse(content);
}

function writeStorage(data) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  const storage = readStorage();
  res.json(storage.batches);
});

router.get('/:id', (req, res) => {
  const storage = readStorage();
  const batch = storage.batches.find(b => b.id === req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  
  const review = storage.reviews.find(r => r.batchId === req.params.id);
  res.json({ ...batch, review: review || null });
});

router.post('/', (req, res) => {
  const storage = readStorage();
  const newBatch = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  storage.batches.push(newBatch);
  writeStorage(storage);
  res.json(newBatch);
});

router.put('/:id', (req, res) => {
  const storage = readStorage();
  const batchIndex = storage.batches.findIndex(b => b.id === req.params.id);
  if (batchIndex === -1) {
    return res.status(404).json({ error: '批次不存在' });
  }
  storage.batches[batchIndex] = {
    ...storage.batches[batchIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  writeStorage(storage);
  res.json(storage.batches[batchIndex]);
});

router.post('/import-samples', (req, res) => {
  const sampleBatches = [
    {
      id: 'sample-1',
      batchNumber: '2026-05-01-001',
      warehouse: '1号仓',
      grainType: '小麦',
      inspectionDate: '2026-05-01',
      trayImage: '/samples/wheat-tray-1.jpg',
      moistureCsv: '/samples/moisture-1.csv',
      temperatureData: '/samples/temperature-1.json',
      status: 'pending',
      riskLevel: 'medium',
      analysis: {
        image: {
          insectDamage: { confidence: 0.75, evidence: '检测到3处疑似虫蛀孔洞' },
          mold: { confidence: 0.60, evidence: '局部区域颜色偏暗，疑似霉变' },
          impurities: { confidence: 0.45, evidence: '发现少量石子和杂质' }
        },
        moisture: {
          confidence: 0.85,
          evidence: '水分含量平均值13.8%，最高值15.2%，略高于标准值13.0%',
          average: 13.8,
          max: 15.2,
          min: 12.5,
          samples: 10
        },
        temperature: {
          confidence: 0.70,
          evidence: '仓温平均22.5℃，局部区域25.8℃，略偏高',
          average: 22.5,
          max: 25.8,
          min: 19.8,
          zones: 8
        }
      }
    },
    {
      id: 'sample-2',
      batchNumber: '2026-05-01-002',
      warehouse: '2号仓',
      grainType: '水稻',
      inspectionDate: '2026-05-01',
      trayImage: '/samples/rice-tray-1.jpg',
      moistureCsv: '/samples/moisture-2.csv',
      temperatureData: '/samples/temperature-2.json',
      status: 'pending',
      riskLevel: 'high',
      analysis: {
        image: {
          insectDamage: { confidence: 0.90, evidence: '检测到8处虫蛀孔洞和幼虫迹象' },
          mold: { confidence: 0.85, evidence: '大面积颜色发暗发黑，疑似严重霉变' },
          impurities: { confidence: 0.70, evidence: '发现较多草籽和稻壳杂质' }
        },
        moisture: {
          confidence: 0.95,
          evidence: '水分含量平均值16.5%，最高值18.2%，远超标准值14.5%',
          average: 16.5,
          max: 18.2,
          min: 14.8,
          samples: 12
        },
        temperature: {
          confidence: 0.88,
          evidence: '仓温平均28.5℃，局部区域32.3℃，偏高明显',
          average: 28.5,
          max: 32.3,
          min: 24.2,
          zones: 8
        }
      }
    },
    {
      id: 'sample-3',
      batchNumber: '2026-05-02-001',
      warehouse: '3号仓',
      grainType: '玉米',
      inspectionDate: '2026-05-02',
      trayImage: '/samples/corn-tray-1.jpg',
      moistureCsv: '/samples/moisture-3.csv',
      temperatureData: '/samples/temperature-3.json',
      status: 'pending',
      riskLevel: 'low',
      analysis: {
        image: {
          insectDamage: { confidence: 0.15, evidence: '未检测到明显虫蛀痕迹' },
          mold: { confidence: 0.10, evidence: '颜色正常，无霉变迹象' },
          impurities: { confidence: 0.20, evidence: '杂质含量极低' }
        },
        moisture: {
          confidence: 0.90,
          evidence: '水分含量平均值12.5%，最高值13.0%，符合标准值14.0%',
          average: 12.5,
          max: 13.0,
          min: 11.8,
          samples: 8
        },
        temperature: {
          confidence: 0.85,
          evidence: '仓温平均18.5℃，局部区域20.2℃，温度适宜',
          average: 18.5,
          max: 20.2,
          min: 16.8,
          zones: 8
        }
      }
    }
  ];

  const storage = readStorage();
  const existingIds = storage.batches.map(b => b.id);
  const newBatches = sampleBatches.filter(b => !existingIds.includes(b.id));
  
  if (newBatches.length > 0) {
    storage.batches = [...storage.batches, ...newBatches];
    writeStorage(storage);
    res.json({ success: true, imported: newBatches.length, batches: newBatches });
  } else {
    res.json({ success: true, imported: 0, message: '示例数据已存在' });
  }
});

module.exports = router;
