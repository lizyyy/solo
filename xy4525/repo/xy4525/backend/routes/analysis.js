const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const STORAGE_FILE = path.join(__dirname, '../data/storage.json');

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

router.post('/image', (req, res) => {
  const { imagePath, batchId } = req.body;
  
  if (!imagePath) {
    return res.status(400).json({ error: '缺少图像路径' });
  }

  const analysis = simulateImageAnalysis(imagePath);
  
  if (batchId) {
    const storage = readStorage();
    const batchIndex = storage.batches.findIndex(b => b.id === batchId);
    if (batchIndex !== -1) {
      if (!storage.batches[batchIndex].analysis) {
        storage.batches[batchIndex].analysis = {};
      }
      storage.batches[batchIndex].analysis.image = analysis;
      storage.batches[batchIndex].updatedAt = new Date().toISOString();
      storage.batches[batchIndex].riskLevel = calculateRiskLevel(storage.batches[batchIndex].analysis);
      writeStorage(storage);
    }
  }
  
  res.json(analysis);
});

router.post('/moisture', (req, res) => {
  const { csvPath, batchId } = req.body;
  
  if (!csvPath) {
    return res.status(400).json({ error: '缺少CSV路径' });
  }

  const analysis = simulateMoistureAnalysis(csvPath);
  
  if (batchId) {
    const storage = readStorage();
    const batchIndex = storage.batches.findIndex(b => b.id === batchId);
    if (batchIndex !== -1) {
      if (!storage.batches[batchIndex].analysis) {
        storage.batches[batchIndex].analysis = {};
      }
      storage.batches[batchIndex].analysis.moisture = analysis;
      storage.batches[batchIndex].updatedAt = new Date().toISOString();
      storage.batches[batchIndex].riskLevel = calculateRiskLevel(storage.batches[batchIndex].analysis);
      writeStorage(storage);
    }
  }
  
  res.json(analysis);
});

router.post('/temperature', (req, res) => {
  const { tempData, batchId } = req.body;
  
  const analysis = simulateTemperatureAnalysis(tempData);
  
  if (batchId) {
    const storage = readStorage();
    const batchIndex = storage.batches.findIndex(b => b.id === batchId);
    if (batchIndex !== -1) {
      if (!storage.batches[batchIndex].analysis) {
        storage.batches[batchIndex].analysis = {};
      }
      storage.batches[batchIndex].analysis.temperature = analysis;
      storage.batches[batchIndex].updatedAt = new Date().toISOString();
      storage.batches[batchIndex].riskLevel = calculateRiskLevel(storage.batches[batchIndex].analysis);
      writeStorage(storage);
    }
  }
  
  res.json(analysis);
});

router.post('/review', (req, res) => {
  const { batchId, reviewer, decision, comments, correctedAnalysis } = req.body;
  
  if (!batchId) {
    return res.status(400).json({ error: '缺少批次ID' });
  }

  const storage = readStorage();
  const reviewIndex = storage.reviews.findIndex(r => r.batchId === batchId);
  
  const review = {
    id: reviewIndex === -1 ? Date.now().toString() : storage.reviews[reviewIndex].id,
    batchId,
    reviewer: reviewer || '未指定',
    decision: decision || 'pending',
    comments: comments || '',
    correctedAnalysis: correctedAnalysis || null,
    createdAt: reviewIndex === -1 ? new Date().toISOString() : storage.reviews[reviewIndex].createdAt,
    updatedAt: new Date().toISOString()
  };

  if (reviewIndex === -1) {
    storage.reviews.push(review);
  } else {
    storage.reviews[reviewIndex] = review;
  }

  const batchIndex = storage.batches.findIndex(b => b.id === batchId);
  if (batchIndex !== -1) {
    storage.batches[batchIndex].status = decision || 'reviewed';
    storage.batches[batchIndex].updatedAt = new Date().toISOString();
  }

  writeStorage(storage);
  res.json(review);
});

router.get('/review/:batchId', (req, res) => {
  const storage = readStorage();
  const review = storage.reviews.find(r => r.batchId === req.params.batchId);
  if (review) {
    res.json(review);
  } else {
    res.status(404).json({ error: '复核记录不存在' });
  }
});

function simulateImageAnalysis(imagePath) {
  const random = Math.random();
  return {
    insectDamage: {
      confidence: Math.min(0.95, Math.max(0.1, random + 0.2)),
      evidence: random > 0.6 
        ? `检测到${Math.floor(random * 10)}处疑似虫蛀孔洞`
        : '未检测到明显虫蛀痕迹'
    },
    mold: {
      confidence: Math.min(0.95, Math.max(0.05, random - 0.1)),
      evidence: random > 0.7 
        ? '局部区域颜色偏暗，疑似霉变'
        : '颜色正常，无霉变迹象'
    },
    impurities: {
      confidence: Math.min(0.8, Math.max(0.1, random - 0.05)),
      evidence: random > 0.5 
        ? '发现少量石子和杂质'
        : '杂质含量极低'
    }
  };
}

function simulateMoistureAnalysis(csvPath) {
  const random = Math.random();
  const baseMoisture = 12.0 + random * 6.0;
  
  return {
    confidence: 0.85 + random * 0.1,
    evidence: baseMoisture > 14.0 
      ? `水分含量平均值${baseMoisture.toFixed(1)}%，略高于标准值`
      : `水分含量平均值${baseMoisture.toFixed(1)}%，符合标准`,
    average: baseMoisture,
    max: baseMoisture + 1.5,
    min: baseMoisture - 1.2,
    samples: 8 + Math.floor(random * 5)
  };
}

function simulateTemperatureAnalysis(tempData) {
  const random = Math.random();
  const baseTemp = 18.0 + random * 12.0;
  
  return {
    confidence: 0.75 + random * 0.15,
    evidence: baseTemp > 25.0 
      ? `仓温平均${baseTemp.toFixed(1)}℃，局部区域偏高明显`
      : `仓温平均${baseTemp.toFixed(1)}℃，温度适宜`,
    average: baseTemp,
    max: baseTemp + 3.0,
    min: baseTemp - 2.5,
    zones: 8
  };
}

function calculateRiskLevel(analysis) {
  let riskScore = 0;
  
  if (analysis.image) {
    if (analysis.image.insectDamage?.confidence > 0.7) riskScore += 2;
    else if (analysis.image.insectDamage?.confidence > 0.4) riskScore += 1;
    
    if (analysis.image.mold?.confidence > 0.7) riskScore += 2;
    else if (analysis.image.mold?.confidence > 0.4) riskScore += 1;
    
    if (analysis.image.impurities?.confidence > 0.7) riskScore += 1;
  }
  
  if (analysis.moisture) {
    if (analysis.moisture.average > 15.0) riskScore += 3;
    else if (analysis.moisture.average > 14.0) riskScore += 2;
    else if (analysis.moisture.average > 13.0) riskScore += 1;
  }
  
  if (analysis.temperature) {
    if (analysis.temperature.average > 28.0) riskScore += 2;
    else if (analysis.temperature.average > 25.0) riskScore += 1;
  }
  
  if (riskScore >= 6) return 'high';
  if (riskScore >= 3) return 'medium';
  return 'low';
}

module.exports = router;
