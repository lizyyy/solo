const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const Database = require('./database');
const DataAnalyzer = require('./analyzer');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

const db = new Database();
const analyzer = new DataAnalyzer();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/dates', async (req, res) => {
  try {
    const dates = await db.getAvailableDates();
    res.json(dates);
  } catch (error) {
    console.error('Error getting dates:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import', async (req, res) => {
  try {
    const { date, scadaData, blowerData, pumpData, labData } = req.body;
    
    await db.saveData('scada', date, scadaData);
    await db.saveData('blower', date, blowerData);
    await db.saveData('pump', date, pumpData);
    await db.saveData('lab', date, labData);
    
    const analysis = analyzer.analyzeAll(date, scadaData, blowerData, pumpData, labData);
    await db.saveAnalysis(date, analysis);
    
    res.json({ success: true, date, analysis });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const scada = await db.getData('scada', date);
    const blower = await db.getData('blower', date);
    const pump = await db.getData('pump', date);
    const lab = await db.getData('lab', date);
    const analysis = await db.getAnalysis(date);
    const remarks = await db.getRemarks(date);
    
    res.json({
      date,
      scadaData: scada,
      blowerData: blower,
      pumpData: pump,
      labData: lab,
      analysis: analysis,
      remarks: remarks
    });
  } catch (error) {
    console.error('Error getting data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/remarks/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { type, time, originalReason, newReason, operator } = req.body;
    
    await db.saveRemark(date, {
      type,
      time,
      originalReason,
      newReason,
      operator,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving remark:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/markdown/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const data = await db.getData('scada', date);
    const analysis = await db.getAnalysis(date);
    const remarks = await db.getRemarks(date);
    
    const markdown = generateMarkdownReport(date, analysis, remarks);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=交班单_${date}.md`);
    res.send(markdown);
  } catch (error) {
    console.error('Error exporting markdown:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/json/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const scada = await db.getData('scada', date);
    const blower = await db.getData('blower', date);
    const pump = await db.getData('pump', date);
    const lab = await db.getData('lab', date);
    const analysis = await db.getAnalysis(date);
    const remarks = await db.getRemarks(date);
    
    const exportData = {
      exportTime: new Date().toISOString(),
      date,
      scadaData: scada,
      blowerData: blower,
      pumpData: pump,
      labData: lab,
      analysis: analysis,
      remarks: remarks
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=数据明细_${date}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Error exporting json:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sample-data', async (req, res) => {
  try {
    const sampleData = {
      date: '2026-05-05',
      scadaData: generateSampleScadaData(),
      blowerData: generateSampleBlowerData(),
      pumpData: generateSamplePumpData(),
      labData: generateSampleLabData()
    };
    res.json(sampleData);
  } catch (error) {
    console.error('Error getting sample data:', error);
    res.status(500).json({ error: error.message });
  }
});

function generateMarkdownReport(date, analysis, remarks) {
  let md = `# 污水处理厂值班交班单\n\n`;
  md += `**日期**: ${date}\n\n`;
  md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `---\n\n`;
  
  if (analysis && analysis.risks && analysis.risks.length > 0) {
    md += `## 风险事件汇总\n\n`;
    
    const riskTypes = {
      over_aeration: '曝气过量',
      hypoxia: '缺氧',
      pump_anomaly: '回流异常',
      lab_mismatch: '化验结果异常'
    };
    
    analysis.risks.forEach((risk, idx) => {
      const typeName = riskTypes[risk.type] || risk.type;
      const remark = remarks?.find(r => r.time === risk.time && r.type === risk.type);
      
      md += `### ${idx + 1}. ${typeName}\n\n`;
      md += `- **时间**: ${risk.time}\n`;
      md += `- **池组**: ${risk.tank || '未指定'}\n`;
      md += `- **原因分析**: ${risk.reason}\n`;
      if (remark) {
        md += `- **人工改判**: ${remark.newReason}\n`;
        md += `- **操作人员**: ${remark.operator}\n`;
      }
      md += `\n`;
    });
  } else {
    md += `## 运行状态\n\n`;
    md += `本日无异常风险事件，运行正常。\n\n`;
  }
  
  md += `---\n\n`;
  md += `**值班员签字**: _______________\n\n`;
  md += `**接班员签字**: _______________\n\n`;
  
  return md;
}

function generateSampleScadaData() {
  const data = [];
  const startTime = new Date('2026-05-05T00:00:00');
  
  for (let i = 0; i < 48; i++) {
    const time = new Date(startTime.getTime() + i * 30 * 60 * 1000);
    const hour = i / 2;
    
    let do1, do2, nh31, nh32;
    
    if (hour >= 2 && hour < 4) {
      do1 = 3.5 + Math.random() * 0.5;
      do2 = 3.8 + Math.random() * 0.5;
      nh31 = 1.0 + Math.random() * 0.3;
      nh32 = 0.8 + Math.random() * 0.3;
    } else if (hour >= 8 && hour < 10) {
      do1 = 0.3 + Math.random() * 0.3;
      do2 = 0.4 + Math.random() * 0.3;
      nh31 = 3.5 + Math.random() * 0.5;
      nh32 = 3.2 + Math.random() * 0.5;
    } else {
      do1 = 1.8 + Math.random() * 0.4;
      do2 = 1.9 + Math.random() * 0.4;
      nh31 = 1.2 + Math.random() * 0.5;
      nh32 = 1.0 + Math.random() * 0.5;
    }
    
    data.push({
      time: time.toISOString(),
      tank: '1#池',
      dissolvedOxygen: parseFloat(do1.toFixed(2)),
      ammoniaNitrogen: parseFloat(nh31.toFixed(2))
    });
    
    data.push({
      time: time.toISOString(),
      tank: '2#池',
      dissolvedOxygen: parseFloat(do2.toFixed(2)),
      ammoniaNitrogen: parseFloat(nh32.toFixed(2))
    });
  }
  
  return data;
}

function generateSampleBlowerData() {
  const data = [];
  const startTime = new Date('2026-05-05T00:00:00');
  
  for (let i = 0; i < 24; i++) {
    const time = new Date(startTime.getTime() + i * 60 * 60 * 1000);
    const hour = i;
    
    let power, frequency;
    
    if (hour >= 2 && hour < 4) {
      power = 150 + Math.random() * 20;
      frequency = 50 + Math.random() * 5;
    } else if (hour >= 8 && hour < 10) {
      power = 30 + Math.random() * 10;
      frequency = 20 + Math.random() * 5;
    } else {
      power = 80 + Math.random() * 20;
      frequency = 40 + Math.random() * 5;
    }
    
    data.push({
      time: time.toISOString(),
      blower: '1#鼓风机',
      power: parseFloat(power.toFixed(1)),
      frequency: parseFloat(frequency.toFixed(1)),
      status: '运行'
    });
  }
  
  return data;
}

function generateSamplePumpData() {
  const data = [];
  const startTime = new Date('2026-05-05T00:00:00');
  
  for (let i = 0; i < 24; i++) {
    const time = new Date(startTime.getTime() + i * 60 * 60 * 1000);
    const hour = i;
    
    let flowRate1, status1, flowRate2, status2;
    
    if (hour >= 14 && hour < 16) {
      flowRate1 = 0;
      status1 = '停机';
      flowRate2 = 120 + Math.random() * 10;
      status2 = '运行';
    } else {
      flowRate1 = 100 + Math.random() * 20;
      status1 = '运行';
      flowRate2 = 100 + Math.random() * 20;
      status2 = '运行';
    }
    
    data.push({
      time: time.toISOString(),
      pump: '1#回流泵',
      flowRate: parseFloat(flowRate1.toFixed(1)),
      status: status1
    });
    
    data.push({
      time: time.toISOString(),
      pump: '2#回流泵',
      flowRate: parseFloat(flowRate2.toFixed(1)),
      status: status2
    });
  }
  
  return data;
}

function generateSampleLabData() {
  return [
    {
      time: '2026-05-05T08:00:00',
      item: 'COD',
      instrumentValue: 45,
      labValue: 48,
      unit: 'mg/L',
      remark: ''
    },
    {
      time: '2026-05-05T08:00:00',
      item: '氨氮',
      instrumentValue: 1.2,
      labValue: 3.5,
      unit: 'mg/L',
      remark: '偏差较大，需复核'
    },
    {
      time: '2026-05-05T08:00:00',
      item: '总磷',
      instrumentValue: 0.3,
      labValue: 0.32,
      unit: 'mg/L',
      remark: ''
    },
    {
      time: '2026-05-05T16:00:00',
      item: 'COD',
      instrumentValue: 42,
      labValue: 45,
      unit: 'mg/L',
      remark: ''
    }
  ];
}

app.listen(PORT, () => {
  console.log(`污水厂数据分析看板服务已启动: http://localhost:${PORT}`);
  console.log(`请在浏览器中访问上述地址使用系统`);
});
