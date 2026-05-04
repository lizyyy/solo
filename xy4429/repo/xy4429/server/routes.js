const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Papa = require('papaparse');
const gpxParser = require('gpx-parser-builder');
const { calculateRideMetrics, calculateRiskLevel, calculateBatteryMargin } = require('./calculator');

const DATA_DIR = path.join(__dirname, '../data');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.get('/data', (req, res) => {
  const dataFile = path.join(DATA_DIR, 'ride-data.json');
  if (fs.existsSync(dataFile)) {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    res.json(data);
  } else {
    res.json({
      gpxData: null,
      riderData: [],
      checkpointData: [],
      segments: [],
      riskData: [],
      manualAdjustments: [],
      lastUpdated: null
    });
  }
});

router.post('/data', (req, res) => {
  const dataFile = path.join(DATA_DIR, 'ride-data.json');
  const data = {
    ...req.body,
    lastUpdated: new Date().toISOString()
  };
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
  res.json({ success: true });
});

router.post('/upload-gpx', upload.single('gpxFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  try {
    const gpxContent = fs.readFileSync(req.file.path, 'utf8');
    const parsed = gpxParser.parse(gpxContent);
    
    const result = calculateRideMetrics(parsed);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '解析GPX文件失败: ' + error.message });
  }
});

router.post('/upload-riders', upload.single('riderFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  try {
    const csvContent = fs.readFileSync(req.file.path, 'utf8');
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      return res.status(400).json({ error: 'CSV解析错误', details: result.errors });
    }
    
    const riders = result.data.map((row, index) => ({
      id: index + 1,
      name: row.name || row.姓名 || row.rider || row.队员 || `队员${index + 1}`,
      lightOutput: parseFloat(row.lightOutput || row.灯具输出 || row.brightness || 0),
      batteryCapacity: parseFloat(row.batteryCapacity || row.电池容量 || row.battery || 0),
      batteryRemaining: parseFloat(row.batteryRemaining || row.剩余电量 || row.remaining || 100),
      averageSpeed: parseFloat(row.averageSpeed || row.平均速度 || row.speed || 20),
      fitnessLevel: row.fitnessLevel || row.体能等级 || row.fitness || 'normal'
    }));
    
    res.json(riders);
  } catch (error) {
    res.status(500).json({ error: '解析CSV文件失败: ' + error.message });
  }
});

router.post('/upload-checkpoints', upload.single('checkpointFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  try {
    const csvContent = fs.readFileSync(req.file.path, 'utf8');
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      return res.status(400).json({ error: 'CSV解析错误', details: result.errors });
    }
    
    const checkpoints = result.data.map((row, index) => ({
      id: index + 1,
      name: row.name || row.名称 || row.checkpoint || `集合点${index + 1}`,
      distance: parseFloat(row.distance || row.距离 || 0),
      elevation: parseFloat(row.elevation || row.海拔 || 0),
      estimatedArrival: row.estimatedArrival || row.预计到达 || null,
      notes: row.notes || row.备注 || ''
    }));
    
    res.json(checkpoints);
  } catch (error) {
    res.status(500).json({ error: '解析CSV文件失败: ' + error.message });
  }
});

router.post('/calculate-risk', (req, res) => {
  try {
    const { segments, riders } = req.body;
    
    if (!segments || !riders || segments.length === 0 || riders.length === 0) {
      return res.status(400).json({ error: '缺少必要数据' });
    }
    
    const riskData = riders.map(rider => {
      const riderRisks = segments.map((segment, segIndex) => {
        const risk = calculateRiskLevel(rider, segment);
        const batteryMargin = calculateBatteryMargin(rider, segment, segments.slice(0, segIndex).reduce((a, s) => a + s.duration, 0));
        
        return {
          segmentIndex: segIndex,
          segmentName: segment.name || `路段${segIndex + 1}`,
          riskLevel: risk.level,
          riskScore: risk.score,
          batteryMargin: batteryMargin.margin,
          estimatedBatteryRemaining: batteryMargin.remaining,
          duration: segment.duration,
          distance: segment.distance,
          elevationGain: segment.elevationGain,
          notes: risk.notes
        };
      });
      
      const totalRiskScore = riderRisks.reduce((a, r) => a + r.riskScore, 0);
      const overallRiskLevel = totalRiskScore > 15 ? 'red' : totalRiskScore > 8 ? 'yellow' : 'green';
      
      return {
        riderId: rider.id,
        riderName: rider.name,
        rider: rider,
        segmentRisks: riderRisks,
        overallRiskLevel,
        totalRiskScore,
        minimumBatteryMargin: Math.min(...riderRisks.map(r => r.batteryMargin))
      };
    });
    
    res.json(riskData);
  } catch (error) {
    res.status(500).json({ error: '计算风险失败: ' + error.message });
  }
});

router.post('/export/markdown', (req, res) => {
  const { data } = req.body;
  
  let markdown = '# 夜骑出发检查单\n\n';
  markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  markdown += '## 一、路线信息\n\n';
  if (data.gpxData) {
    markdown += `- 总距离: ${(data.gpxData.totalDistance || 0).toFixed(2)} km\n`;
    markdown += `- 总爬升: ${(data.gpxData.totalElevationGain || 0).toFixed(0)} m\n`;
    markdown += `- 预计时长: ${(data.gpxData.totalDuration || 0).toFixed(1)} 小时\n\n`;
  }
  
  markdown += '## 二、路段详情\n\n';
  if (data.segments && data.segments.length > 0) {
    markdown += '| 路段 | 距离(km) | 爬升(m) | 预计时长 |\n';
    markdown += '|------|----------|---------|----------|\n';
    data.segments.forEach((seg, i) => {
      markdown += `| ${i + 1}. ${seg.name || '路段'} | ${seg.distance.toFixed(2)} | ${seg.elevationGain.toFixed(0)} | ${seg.duration.toFixed(1)}小时 |\n`;
    });
    markdown += '\n';
  }
  
  markdown += '## 三、队员状态\n\n';
  if (data.riskData && data.riskData.length > 0) {
    data.riskData.forEach(riderRisk => {
      const riskEmoji = riderRisk.overallRiskLevel === 'red' ? '🔴' : 
                        riderRisk.overallRiskLevel === 'yellow' ? '🟡' : '🟢';
      markdown += `### ${riskEmoji} ${riderRisk.riderName}\n\n`;
      markdown += `- 整体风险: ${riderRisk.overallRiskLevel === 'red' ? '高' : riderRisk.overallRiskLevel === 'yellow' ? '中' : '低'}\n`;
      markdown += `- 风险评分: ${riderRisk.totalRiskScore}\n`;
      markdown += `- 最小电池余量: ${(riderRisk.minimumBatteryMargin * 100).toFixed(1)}%\n\n`;
      
      if (riderRisk.segmentRisks && riderRisk.segmentRisks.length > 0) {
        markdown += '| 路段 | 风险 | 电池余量 | 预计剩余电量 |\n';
        markdown += '|------|------|----------|--------------|\n';
        riderRisk.segmentRisks.forEach(seg => {
          const segRiskEmoji = seg.riskLevel === 'red' ? '🔴' : seg.riskLevel === 'yellow' ? '🟡' : '🟢';
          markdown += `| ${seg.segmentName} | ${segRiskEmoji} ${seg.riskLevel === 'red' ? '高' : seg.riskLevel === 'yellow' ? '中' : '低'} | ${(seg.batteryMargin * 100).toFixed(1)}% | ${(seg.estimatedBatteryRemaining * 100).toFixed(1)}% |\n`;
        });
        markdown += '\n';
      }
    });
  }
  
  markdown += '## 四、集合点\n\n';
  if (data.checkpointData && data.checkpointData.length > 0) {
    data.checkpointData.forEach(cp => {
      markdown += `### ${cp.name}\n\n`;
      markdown += `- 距离起点: ${cp.distance.toFixed(2)} km\n`;
      markdown += `- 海拔: ${cp.elevation.toFixed(0)} m\n`;
      if (cp.estimatedArrival) {
        markdown += `- 预计到达: ${cp.estimatedArrival}\n`;
      }
      if (cp.notes) {
        markdown += `- 备注: ${cp.notes}\n`;
      }
      markdown += '\n';
    });
  }
  
  if (data.manualAdjustments && data.manualAdjustments.length > 0) {
    markdown += '## 五、人工调整记录\n\n';
    data.manualAdjustments.forEach(adj => {
      markdown += `- [${adj.type}] ${adj.description} (${new Date(adj.timestamp).toLocaleString('zh-CN')})\n`;
    });
    markdown += '\n';
  }
  
  markdown += '---\n\n';
  markdown += '*本检查单由夜骑队长工具自动生成*\n';
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="night-ride-checklist.md"');
  res.send(markdown);
});

router.post('/export/json', (req, res) => {
  const { data } = req.body;
  
  const exportData = {
    exportTime: new Date().toISOString(),
    version: '1.0',
    data: data
  };
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="night-ride-audit.json"');
  res.send(JSON.stringify(exportData, null, 2));
});

module.exports = router;
