const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const _ = require('lodash');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const MAINTENANCE_FILE = path.join(DATA_DIR, 'maintenance.json');
const PUBLIC_FEEDBACK_FILE = path.join(DATA_DIR, 'public_feedback.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadReviews() {
  if (fs.existsSync(REVIEWS_FILE)) {
    return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  }
  return {};
}

function saveReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

function loadMaintenanceData() {
  if (fs.existsSync(MAINTENANCE_FILE)) {
    return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
  }
  return [];
}

function loadPublicFeedback() {
  if (fs.existsSync(PUBLIC_FEEDBACK_FILE)) {
    return JSON.parse(fs.readFileSync(PUBLIC_FEEDBACK_FILE, 'utf8'));
  }
  return [];
}

function calculateTimeDifference(time1, time2) {
  const t1 = moment(time1);
  const t2 = moment(time2);
  return Math.abs(t1.diff(t2, 'seconds'));
}

function clusterEvents(triggers, waveforms, timeThreshold = 120) {
  const allEvents = [];
  
  triggers.forEach(trigger => {
    const eventTime = moment(trigger.triggerTime || trigger.time);
    let matchedCluster = null;
    
    for (const cluster of allEvents) {
      const clusterTime = moment(cluster.time);
      if (calculateTimeDifference(eventTime, clusterTime) <= timeThreshold) {
        matchedCluster = cluster;
        break;
      }
    }
    
    if (matchedCluster) {
      matchedCluster.triggers.push(trigger);
      if (eventTime.isBefore(moment(matchedCluster.time))) {
        matchedCluster.time = eventTime.toISOString();
      }
    } else {
      allEvents.push({
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        time: eventTime.toISOString(),
        triggers: [trigger],
        waveforms: [],
        risks: {},
        review: null
      });
    }
  });
  
  waveforms.forEach(waveform => {
    const waveTime = moment(waveform.time || waveform.timestamp);
    let matchedCluster = null;
    
    for (const cluster of allEvents) {
      const clusterTime = moment(cluster.time);
      if (calculateTimeDifference(waveTime, clusterTime) <= timeThreshold) {
        matchedCluster = cluster;
        break;
      }
    }
    
    if (matchedCluster) {
      matchedCluster.waveforms.push(waveform);
    } else {
      allEvents.push({
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        time: waveTime.toISOString(),
        triggers: [],
        waveforms: [waveform],
        risks: {},
        review: null
      });
    }
  });
  
  const reviews = loadReviews();
  allEvents.forEach(event => {
    if (reviews[event.id]) {
      event.review = reviews[event.id];
    }
  });
  
  return allEvents.sort((a, b) => moment(a.time).valueOf() - moment(b.time).valueOf());
}

function calculateRisks(event, maintenanceData, publicFeedback) {
  const risks = {
    falseTrigger: { score: 0, factors: [] },
    missingChannel: { score: 0, factors: [], missingStations: [] },
    arrivalTimeDiff: { score: 0, factors: [], details: [] },
    maintenanceImpact: { score: 0, factors: [], affectedStations: [] }
  };
  
  const eventTime = moment(event.time);
  
  if (event.waveforms.length > 0) {
    event.waveforms.forEach(waveform => {
      const hasSpike = waveform.spikeRatio > 0.3 || (waveform.features && waveform.features.spikeCount > 5);
      const lowEnergy = waveform.energy < 1000;
      
      if (hasSpike) {
        risks.falseTrigger.score += 30;
        risks.falseTrigger.factors.push(`${waveform.stationId}: 存在波形毛刺特征`);
      }
      
      if (lowEnergy) {
        risks.falseTrigger.score += 20;
        risks.falseTrigger.factors.push(`${waveform.stationId}: 波形能量过低`);
      }
      
      if (waveform.components) {
        const components = Object.keys(waveform.components);
        if (components.length < 3) {
          risks.missingChannel.score += 25;
          risks.missingChannel.missingStations.push(waveform.stationId);
          risks.missingChannel.factors.push(`${waveform.stationId}: 缺道 (${components.length}/3)`);
        }
      }
    });
  }
  
  const uniqueStations = new Set();
  event.triggers.forEach(t => uniqueStations.add(t.stationId));
  event.waveforms.forEach(w => uniqueStations.add(w.stationId));
  
  if (uniqueStations.size < 3) {
    risks.missingChannel.score += 30;
    risks.missingChannel.factors.push(`触发台站过少 (${uniqueStations.size}个)`);
  }
  
  if (event.triggers.length > 1) {
    const triggerTimes = event.triggers.map(t => moment(t.triggerTime || t.time).valueOf());
    const maxDiff = Math.max(...triggerTimes) - Math.min(...triggerTimes);
    const maxDiffSeconds = maxDiff / 1000;
    
    if (maxDiffSeconds > 30) {
      risks.arrivalTimeDiff.score += 40;
      risks.arrivalTimeDiff.factors.push(`震相到时差过大 (${maxDiffSeconds.toFixed(1)}秒)`);
      risks.arrivalTimeDiff.details = event.triggers.map(t => ({
        stationId: t.stationId,
        time: t.triggerTime || t.time
      }));
    }
  }
  
  if (maintenanceData && maintenanceData.length > 0) {
    maintenanceData.forEach(maintenance => {
      const startTime = moment(maintenance.startTime);
      const endTime = moment(maintenance.endTime);
      
      if (eventTime.isBetween(startTime, endTime, null, '[]')) {
        event.triggers.forEach(trigger => {
          if (maintenance.stationIds && maintenance.stationIds.includes(trigger.stationId)) {
            risks.maintenanceImpact.score += 50;
            risks.maintenanceImpact.affectedStations.push(trigger.stationId);
            risks.maintenanceImpact.factors.push(`${trigger.stationId}: 处于维护期间 (${maintenance.reason || maintenance.description})`);
          }
        });
        
        event.waveforms.forEach(waveform => {
          if (maintenance.stationIds && maintenance.stationIds.includes(waveform.stationId)) {
            if (!risks.maintenanceImpact.affectedStations.includes(waveform.stationId)) {
              risks.maintenanceImpact.score += 50;
              risks.maintenanceImpact.affectedStations.push(waveform.stationId);
              risks.maintenanceImpact.factors.push(`${waveform.stationId}: 处于维护期间 (${maintenance.reason || maintenance.description})`);
            }
          }
        });
      }
    });
  }
  
  const relevantFeedback = publicFeedback.filter(feedback => {
    const feedbackTime = moment(feedback.time || feedback.timestamp);
    return calculateTimeDifference(eventTime, feedbackTime) <= 300;
  });
  
  if (relevantFeedback.length > 0) {
    risks.publicFeedback = {
      count: relevantFeedback.length,
      items: relevantFeedback
    };
  }
  
  risks.overallScore = Math.max(
    risks.falseTrigger.score,
    risks.missingChannel.score,
    risks.arrivalTimeDiff.score,
    risks.maintenanceImpact.score
  );
  
  risks.riskLevel = risks.overallScore >= 50 ? 'high' : 
                    risks.overallScore >= 20 ? 'medium' : 'low';
  
  return risks;
}

app.post('/api/import', (req, res) => {
  try {
    const { triggers, waveforms, maintenance, publicFeedback } = req.body;
    
    if (maintenance) {
      fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(maintenance, null, 2));
    }
    
    if (publicFeedback) {
      fs.writeFileSync(PUBLIC_FEEDBACK_FILE, JSON.stringify(publicFeedback, null, 2));
    }
    
    const maintenanceData = maintenance || loadMaintenanceData();
    const feedbackData = publicFeedback || loadPublicFeedback();
    
    const events = clusterEvents(
      triggers || [],
      waveforms || []
    );
    
    events.forEach(event => {
      event.risks = calculateRisks(event, maintenanceData, feedbackData);
    });
    
    res.json({
      success: true,
      events: events,
      count: events.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/events', (req, res) => {
  try {
    const triggers = [];
    const waveforms = [];
    const maintenanceData = loadMaintenanceData();
    const feedbackData = loadPublicFeedback();
    
    const events = clusterEvents(triggers, waveforms);
    events.forEach(event => {
      event.risks = calculateRisks(event, maintenanceData, feedbackData);
    });
    
    res.json({
      success: true,
      events: events
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/review', (req, res) => {
  try {
    const { eventId, review } = req.body;
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: '事件ID不能为空'
      });
    }
    
    const reviews = loadReviews();
    reviews[eventId] = {
      ...review,
      updatedAt: new Date().toISOString()
    };
    
    saveReviews(reviews);
    
    res.json({
      success: true,
      message: '备注已保存'
    });
  } catch (error) {
    console.error('Save review error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/export/markdown', (req, res) => {
  try {
    const events = JSON.parse(req.query.events || '[]');
    const date = moment().format('YYYY年MM月DD日');
    
    let markdown = `# 地震台网值班复核报告 - ${date}\n\n`;
    markdown += `## 值班概况\n\n`;
    markdown += `- 值班日期: ${date}\n`;
    markdown += `- 事件总数: ${events.length}\n\n`;
    
    const highRisk = events.filter(e => e.risks?.riskLevel === 'high').length;
    const mediumRisk = events.filter(e => e.risks?.riskLevel === 'medium').length;
    const lowRisk = events.filter(e => e.risks?.riskLevel === 'low').length;
    
    markdown += `## 风险统计\n\n`;
    markdown += `| 风险等级 | 数量 |\n`;
    markdown += `|----------|------|\n`;
    markdown += `| 高风险 | ${highRisk} |\n`;
    markdown += `| 中风险 | ${mediumRisk} |\n`;
    markdown += `| 低风险 | ${lowRisk} |\n\n`;
    
    markdown += `## 事件详情\n\n`;
    
    events.forEach((event, index) => {
      const eventTime = moment(event.time).format('YYYY-MM-DD HH:mm:ss');
      markdown += `### 事件 ${index + 1}: ${eventTime}\n\n`;
      
      markdown += `#### 基本信息\n\n`;
      markdown += `- 事件ID: ${event.id}\n`;
      markdown += `- 触发台站数: ${event.triggers.length}\n`;
      markdown += `- 波形记录数: ${event.waveforms.length}\n`;
      
      const stations = new Set();
      event.triggers.forEach(t => stations.add(t.stationId));
      event.waveforms.forEach(w => stations.add(w.stationId));
      markdown += `- 涉及台站: ${Array.from(stations).join(', ')}\n\n`;
      
      markdown += `#### 风险评估\n\n`;
      const riskColors = { high: '🔴 高风险', medium: '🟡 中风险', low: '🟢 低风险' };
      markdown += `- 综合风险等级: ${riskColors[event.risks?.riskLevel] || '未知'}\n`;
      markdown += `- 综合风险分数: ${event.risks?.overallScore || 0}\n\n`;
      
      if (event.risks?.falseTrigger?.factors?.length > 0) {
        markdown += `**误触发风险因素:**\n`;
        event.risks.falseTrigger.factors.forEach(factor => {
          markdown += `- ${factor}\n`;
        });
        markdown += `\n`;
      }
      
      if (event.risks?.missingChannel?.factors?.length > 0) {
        markdown += `**缺道风险因素:**\n`;
        event.risks.missingChannel.factors.forEach(factor => {
          markdown += `- ${factor}\n`;
        });
        markdown += `\n`;
      }
      
      if (event.risks?.maintenanceImpact?.factors?.length > 0) {
        markdown += `**维护影响因素:**\n`;
        event.risks.maintenanceImpact.factors.forEach(factor => {
          markdown += `- ${factor}\n`;
        });
        markdown += `\n`;
      }
      
      if (event.review) {
        markdown += `#### 人工复核\n\n`;
        const statusLabels = {
          earthquake: '确认地震',
          explosion: '确认爆破',
          glitch: '设备毛刺',
          uncertain: '待确认'
        };
        markdown += `- 复核状态: ${statusLabels[event.review.status] || event.review.status}\n`;
        if (event.review.notes) {
          markdown += `- 复核备注: ${event.review.notes}\n`;
        }
        if (event.review.updatedAt) {
          markdown += `- 复核时间: ${moment(event.review.updatedAt).format('YYYY-MM-DD HH:mm:ss')}\n`;
        }
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    });
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=值班复核报告_${moment().format('YYYYMMDD')}.md`);
    res.send(markdown);
  } catch (error) {
    console.error('Export markdown error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/export/json', (req, res) => {
  try {
    const events = JSON.parse(req.query.events || '[]');
    const exportData = {
      exportTime: new Date().toISOString(),
      version: '1.0',
      events: events
    };
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=审计明细_${moment().format('YYYYMMDDHHmmss')}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Export json error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/sample-data', (req, res) => {
  try {
    const sampleData = {
      triggers: [
        {
          id: 'trigger_1',
          stationId: 'BJ01',
          stationName: '北京台',
          latitude: 39.9042,
          longitude: 116.4074,
          triggerTime: '2026-05-05T08:30:00Z',
          magnitude: 2.3,
          depth: 10,
          phase: 'P'
        },
        {
          id: 'trigger_2',
          stationId: 'TJ01',
          stationName: '天津台',
          latitude: 39.0842,
          longitude: 117.2000,
          triggerTime: '2026-05-05T08:30:25Z',
          magnitude: 2.1,
          depth: 12,
          phase: 'P'
        },
        {
          id: 'trigger_3',
          stationId: 'BJ02',
          stationName: '海淀台',
          latitude: 39.9586,
          longitude: 116.3059,
          triggerTime: '2026-05-05T09:15:00Z',
          magnitude: 1.5,
          depth: 5,
          phase: 'P'
        },
        {
          id: 'trigger_4',
          stationId: 'SH01',
          stationName: '上海台',
          latitude: 31.2304,
          longitude: 121.4737,
          triggerTime: '2026-05-05T10:00:00Z',
          magnitude: 3.2,
          depth: 15,
          phase: 'P'
        },
        {
          id: 'trigger_5',
          stationId: 'NJ01',
          stationName: '南京台',
          latitude: 32.0603,
          longitude: 118.7969,
          triggerTime: '2026-05-05T10:00:45Z',
          magnitude: 3.0,
          depth: 18,
          phase: 'P'
        },
        {
          id: 'trigger_6',
          stationId: 'HZ01',
          stationName: '杭州台',
          latitude: 30.2741,
          longitude: 120.1551,
          triggerTime: '2026-05-05T10:01:10Z',
          magnitude: 2.8,
          depth: 16,
          phase: 'P'
        }
      ],
      waveforms: [
        {
          id: 'wave_1',
          stationId: 'BJ01',
          stationName: '北京台',
          latitude: 39.9042,
          longitude: 116.4074,
          time: '2026-05-05T08:30:00Z',
          energy: 15000,
          spikeRatio: 0.05,
          features: {
            spikeCount: 2,
            frequency: 5.2,
            duration: 25
          },
          components: {
            'Z': {
              maxAmplitude: 120,
              minAmplitude: -115,
              meanAmplitude: 0.5,
              rms: 35.2
            },
            'N': {
              maxAmplitude: 95,
              minAmplitude: -90,
              meanAmplitude: 0.3,
              rms: 28.6
            },
            'E': {
              maxAmplitude: 105,
              minAmplitude: -100,
              meanAmplitude: 0.4,
              rms: 31.8
            }
          }
        },
        {
          id: 'wave_2',
          stationId: 'TJ01',
          stationName: '天津台',
          latitude: 39.0842,
          longitude: 117.2000,
          time: '2026-05-05T08:30:25Z',
          energy: 12000,
          spikeRatio: 0.08,
          features: {
            spikeCount: 3,
            frequency: 4.8,
            duration: 22
          },
          components: {
            'Z': {
              maxAmplitude: 100,
              minAmplitude: -95,
              meanAmplitude: 0.4,
              rms: 30.5
            },
            'N': {
              maxAmplitude: 85,
              minAmplitude: -80,
              meanAmplitude: 0.2,
              rms: 25.3
            },
            'E': {
              maxAmplitude: 90,
              minAmplitude: -85,
              meanAmplitude: 0.3,
              rms: 27.4
            }
          }
        },
        {
          id: 'wave_3',
          stationId: 'BJ02',
          stationName: '海淀台',
          latitude: 39.9586,
          longitude: 116.3059,
          time: '2026-05-05T09:15:00Z',
          energy: 800,
          spikeRatio: 0.45,
          features: {
            spikeCount: 15,
            frequency: 2.1,
            duration: 8
          },
          components: {
            'Z': {
              maxAmplitude: 25,
              minAmplitude: -20,
              meanAmplitude: 0.1,
              rms: 8.5
            }
          }
        },
        {
          id: 'wave_4',
          stationId: 'SH01',
          stationName: '上海台',
          latitude: 31.2304,
          longitude: 121.4737,
          time: '2026-05-05T10:00:00Z',
          energy: 25000,
          spikeRatio: 0.03,
          features: {
            spikeCount: 1,
            frequency: 6.5,
            duration: 35
          },
          components: {
            'Z': {
              maxAmplitude: 180,
              minAmplitude: -175,
              meanAmplitude: 0.6,
              rms: 55.2
            },
            'N': {
              maxAmplitude: 150,
              minAmplitude: -145,
              meanAmplitude: 0.4,
              rms: 45.8
            },
            'E': {
              maxAmplitude: 160,
              minAmplitude: -155,
              meanAmplitude: 0.5,
              rms: 48.6
            }
          }
        },
        {
          id: 'wave_5',
          stationId: 'NJ01',
          stationName: '南京台',
          latitude: 32.0603,
          longitude: 118.7969,
          time: '2026-05-05T10:00:45Z',
          energy: 22000,
          spikeRatio: 0.04,
          features: {
            spikeCount: 2,
            frequency: 5.8,
            duration: 32
          },
          components: {
            'Z': {
              maxAmplitude: 165,
              minAmplitude: -160,
              meanAmplitude: 0.5,
              rms: 50.3
            },
            'N': {
              maxAmplitude: 140,
              minAmplitude: -135,
              meanAmplitude: 0.3,
              rms: 42.5
            },
            'E': {
              maxAmplitude: 150,
              minAmplitude: -145,
              meanAmplitude: 0.4,
              rms: 45.2
            }
          }
        },
        {
          id: 'wave_6',
          stationId: 'HZ01',
          stationName: '杭州台',
          latitude: 30.2741,
          longitude: 120.1551,
          time: '2026-05-05T10:01:10Z',
          energy: 20000,
          spikeRatio: 0.05,
          features: {
            spikeCount: 1,
            frequency: 5.5,
            duration: 30
          },
          components: {
            'Z': {
              maxAmplitude: 150,
              minAmplitude: -145,
              meanAmplitude: 0.4,
              rms: 46.8
            },
            'N': {
              maxAmplitude: 125,
              minAmplitude: -120,
              meanAmplitude: 0.3,
              rms: 39.5
            },
            'E': {
              maxAmplitude: 135,
              minAmplitude: -130,
              meanAmplitude: 0.4,
              rms: 42.1
            }
          }
        }
      ],
      maintenance: [
        {
          id: 'maint_1',
          stationIds: ['BJ02'],
          startTime: '2026-05-05T08:00:00Z',
          endTime: '2026-05-05T12:00:00Z',
          reason: '设备定期校准',
          description: '海淀台进行设备定期校准维护'
        }
      ],
      publicFeedback: [
        {
          id: 'feedback_1',
          time: '2026-05-05T10:01:30Z',
          location: '上海市浦东新区',
          intensity: 'III',
          description: '感觉到轻微震动，窗户有轻微响声',
          contact: '匿名'
        },
        {
          id: 'feedback_2',
          time: '2026-05-05T10:02:00Z',
          location: '江苏省南京市鼓楼区',
          intensity: 'II',
          description: '高层有轻微晃动感',
          contact: '匿名'
        }
      ]
    };
    
    res.json({
      success: true,
      data: sampleData
    });
  } catch (error) {
    console.error('Sample data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`地震台网值班复核台服务已启动: http://localhost:${PORT}`);
  console.log(`请在浏览器中打开上述地址使用系统`);
});
