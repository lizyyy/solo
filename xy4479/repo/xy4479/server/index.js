const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const items = [
  {
    id: 'lion-head-1',
    name: '南狮狮头(主)',
    type: 'lion-head',
    description: '主要表演用南狮狮头，佛装狮',
    weight: 8,
    usageOrder: 1,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '🦁'
  },
  {
    id: 'lion-head-2',
    name: '南狮狮头(备)',
    type: 'lion-head',
    description: '备用南狮狮头，刘关张狮',
    weight: 7,
    usageOrder: 1,
    isBackup: true,
    isRainGear: false,
    correctZone: 'backup-truck',
    priority: 2,
    icon: '🦁'
  },
  {
    id: 'lion-body-1',
    name: '狮被(主)',
    type: 'lion-body',
    description: '主要表演用南狮狮被，红色',
    weight: 5,
    usageOrder: 1,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '🧣'
  },
  {
    id: 'lion-body-2',
    name: '狮被(备)',
    type: 'lion-body',
    description: '备用南狮狮被，黄色',
    weight: 5,
    usageOrder: 1,
    isBackup: true,
    isRainGear: false,
    correctZone: 'backup-truck',
    priority: 2,
    icon: '🧣'
  },
  {
    id: 'drum-main',
    name: '南狮大鼓',
    type: 'drum',
    description: '主要表演用牛皮大鼓，24寸',
    weight: 25,
    usageOrder: 2,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '🥁'
  },
  {
    id: 'drum-backup',
    name: '备用小鼓',
    type: 'drum',
    description: '备用小鼓，练习用',
    weight: 12,
    usageOrder: 2,
    isBackup: true,
    isRainGear: false,
    correctZone: 'backup-truck',
    priority: 2,
    icon: '🥁'
  },
  {
    id: 'cymbal-1',
    name: '大镲(左)',
    type: 'cymbal',
    description: '南狮表演用大镲，铜制',
    weight: 3,
    usageOrder: 2,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '🎵'
  },
  {
    id: 'cymbal-2',
    name: '大镲(右)',
    type: 'cymbal',
    description: '南狮表演用大镲，铜制',
    weight: 3,
    usageOrder: 2,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '🎵'
  },
  {
    id: 'gong-main',
    name: '南狮大锣',
    type: 'gong',
    description: '主要表演用铜锣，高边锣',
    weight: 8,
    usageOrder: 2,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '🔔'
  },
  {
    id: 'costume-1',
    name: '队员服(红)',
    type: 'costume',
    description: '红色表演服，队员统一着装',
    weight: 1,
    usageOrder: 3,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '👕'
  },
  {
    id: 'costume-2',
    name: '队员服(黑)',
    type: 'costume',
    description: '黑色表演服，备用',
    weight: 1,
    usageOrder: 3,
    isBackup: true,
    isRainGear: false,
    correctZone: 'backup-truck',
    priority: 2,
    icon: '👕'
  },
  {
    id: 'shoes-1',
    name: '醒狮鞋',
    type: 'footwear',
    description: '专业醒狮表演鞋，防滑',
    weight: 1,
    usageOrder: 3,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '👟'
  },
  {
    id: 'speaker-main',
    name: '有源音箱',
    type: 'speaker',
    description: '15寸有源音箱，用于庙会扩音',
    weight: 20,
    usageOrder: 0,
    isBackup: false,
    isRainGear: false,
    correctZone: 'main-truck',
    priority: 1,
    icon: '🔊'
  },
  {
    id: 'battery-1',
    name: '锂电池组',
    type: 'battery',
    description: '12V锂电池组，音箱备用电源',
    weight: 15,
    usageOrder: 0,
    isBackup: true,
    isRainGear: false,
    correctZone: 'backup-truck',
    priority: 2,
    icon: '🔋'
  },
  {
    id: 'battery-2',
    name: '充电宝(多)',
    type: 'battery',
    description: '多个充电宝，队员手机充电',
    weight: 2,
    usageOrder: 0,
    isBackup: false,
    isRainGear: false,
    correctZone: 'waiting-area',
    priority: 2,
    icon: '🔋'
  },
  {
    id: 'rain-cover',
    name: '防雨罩(大)',
    type: 'rain-gear',
    description: '大型防雨罩，覆盖狮头和鼓',
    weight: 3,
    usageOrder: 0,
    isBackup: false,
    isRainGear: true,
    correctZone: 'rain-backup',
    priority: 3,
    icon: '☔'
  },
  {
    id: 'rain-coats',
    name: '雨衣套装',
    type: 'rain-gear',
    description: '队员雨衣，多件',
    weight: 2,
    usageOrder: 0,
    isBackup: false,
    isRainGear: true,
    correctZone: 'rain-backup',
    priority: 3,
    icon: '🧥'
  },
  {
    id: 'water-bottle',
    name: '矿泉水(箱)',
    type: 'supplies',
    description: '一箱矿泉水，队员补给',
    weight: 12,
    usageOrder: 0,
    isBackup: false,
    isRainGear: false,
    correctZone: 'waiting-area',
    priority: 2,
    icon: '💧'
  },
  {
    id: 'snacks',
    name: '点心零食',
    type: 'supplies',
    description: '饼干、巧克力等补充能量',
    weight: 2,
    usageOrder: 0,
    isBackup: false,
    isRainGear: false,
    correctZone: 'waiting-area',
    priority: 2,
    icon: '🍪'
  },
  {
    id: 'med-kit',
    name: '急救包',
    type: 'medical',
    description: '常用急救药品和用品',
    weight: 2,
    usageOrder: 0,
    isBackup: false,
    isRainGear: false,
    correctZone: 'waiting-area',
    priority: 2,
    icon: '🩹'
  }
];

const teamMembers = [
  {
    id: 'member-1',
    name: '陈师傅',
    role: '狮头',
    description: '主狮头表演者，经验丰富',
    skillLevel: 'expert',
    isAbsent: false,
    correctZone: 'waiting-area',
    icon: '🧑'
  },
  {
    id: 'member-2',
    name: '林师傅',
    role: '狮尾',
    description: '主狮尾表演者，配合默契',
    skillLevel: 'expert',
    isAbsent: false,
    correctZone: 'waiting-area',
    icon: '🧑'
  },
  {
    id: 'member-3',
    name: '黄师傅',
    role: '鼓手',
    description: '主鼓手，掌握节奏',
    skillLevel: 'expert',
    isAbsent: false,
    correctZone: 'waiting-area',
    icon: '🧑'
  },
  {
    id: 'member-4',
    name: '周师傅',
    role: '锣手',
    description: '锣手，配合鼓点',
    skillLevel: 'intermediate',
    isAbsent: false,
    correctZone: 'waiting-area',
    icon: '🧑'
  },
  {
    id: 'member-5',
    name: '吴师傅',
    role: '镲手',
    description: '镲手，配合鼓点',
    skillLevel: 'intermediate',
    isAbsent: true,
    correctZone: 'waiting-area',
    icon: '🧑'
  },
  {
    id: 'member-6',
    name: '郑师傅',
    role: '替补狮头',
    description: '替补狮头表演者',
    skillLevel: 'intermediate',
    isAbsent: false,
    correctZone: 'waiting-area',
    icon: '🧑'
  },
  {
    id: 'member-7',
    name: '学徒小王',
    role: '学徒',
    description: '学徒，帮忙搬运道具',
    skillLevel: 'beginner',
    isAbsent: false,
    correctZone: 'waiting-area',
    icon: '👦'
  },
  {
    id: 'member-8',
    name: '学徒小李',
    role: '学徒',
    description: '学徒，帮忙搬运道具',
    skillLevel: 'beginner',
    isAbsent: true,
    correctZone: 'waiting-area',
    icon: '👦'
  }
];

const loadZones = {
  'main-truck': { 
    name: '主运输车', 
    description: '装载主要表演道具 - 狮头、狮被、主鼓、锣镲、主音箱',
    maxWeight: 100,
    icon: '🚚',
    color: 'primary'
  },
  'backup-truck': { 
    name: '备用运输车', 
    description: '装载备用道具 - 备用狮头、备用鼓、锂电池、备用服装',
    maxWeight: 80,
    icon: '🚐',
    color: 'secondary'
  },
  'waiting-area': { 
    name: '候场区', 
    description: '队员集合、休息区域 - 队员、补给品、充电宝、急救包',
    maxWeight: 30,
    icon: '🏠',
    color: 'success'
  },
  'rain-backup': { 
    name: '雨天备用区', 
    description: '雨天应急物品 - 防雨罩、雨衣等',
    maxWeight: 20,
    icon: '🌧️',
    color: 'info'
  }
};

function getSessionsPath() {
  return path.join(dataDir, 'sessions.json');
}

function loadSessions() {
  try {
    const sessionsPath = getSessionsPath();
    if (fs.existsSync(sessionsPath)) {
      const data = fs.readFileSync(sessionsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('加载会话数据失败:', e);
  }
  return {};
}

function saveSessions(sessions) {
  try {
    const sessionsPath = getSessionsPath();
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error('保存会话数据失败:', e);
  }
}

function calculatePlacementPenalty(item, zone, placementOrder, allPlacements) {
  let penalty = 0;
  let reasons = [];

  const isCorrectZone = item.correctZone === zone;

  if (!isCorrectZone) {
    penalty += 15;
    reasons.push(`道具放错区域`);
  }

  if (item.weight > 10 && zone === 'waiting-area') {
    penalty += 10;
    reasons.push(`重物不应放在候场区`);
  }

  if (item.isRainGear && zone !== 'rain-backup') {
    penalty += 10;
    reasons.push(`雨具应放在雨天备用区`);
  }

  if (item.type === 'lion-head' && zone === 'backup-truck' && !item.isBackup) {
    penalty += 20;
    reasons.push(`主狮头应放在主运输车`);
  }

  const zoneItems = allPlacements.filter(p => p.zone === zone);
  const zoneWeight = zoneItems.reduce((sum, p) => {
    const placedItem = [...items, ...teamMembers].find(i => i.id === p.itemId);
    return sum + (placedItem ? (placedItem.weight || 0) : 0);
  }, 0);

  if (zoneWeight > loadZones[zone].maxWeight) {
    penalty += 10;
    reasons.push(`区域超重`);
  }

  if (item.usageOrder > 0) {
    const sameOrderItems = allPlacements.filter(p => {
      const placedItem = [...items].find(i => i.id === p.itemId);
      return placedItem && placedItem.usageOrder === item.usageOrder;
    });
    
    if (sameOrderItems.length > 0) {
      const earlierPlacements = sameOrderItems.filter(p => p.placementOrder < placementOrder);
      if (earlierPlacements.length > 0 && zone !== sameOrderItems[0].zone) {
        penalty += 5;
        reasons.push(`同使用顺序道具应集中存放`);
      }
    }
  }

  return { penalty, reasons };
}

function calculateMemberPenalty(member, zone) {
  let penalty = 0;
  let reasons = [];

  if (zone !== 'waiting-area') {
    penalty += 20;
    reasons.push(`队员应在候场区`);
  }

  if (member.isAbsent) {
    penalty += 10;
    reasons.push(`队员缺席提醒`);
  }

  return { penalty, reasons };
}

app.get('/api/items', (req, res) => {
  res.json(items);
});

app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === req.params.id);
  if (item) {
    res.json(item);
  } else {
    res.status(404).json({ error: '道具不存在' });
  }
});

app.get('/api/members', (req, res) => {
  res.json(teamMembers);
});

app.get('/api/members/:id', (req, res) => {
  const member = teamMembers.find(m => m.id === req.params.id);
  if (member) {
    res.json(member);
  } else {
    res.status(404).json({ error: '队员不存在' });
  }
});

app.get('/api/zones', (req, res) => {
  res.json(loadZones);
});

app.post('/api/sessions', (req, res) => {
  const sessions = loadSessions();
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [...items],
    members: [...teamMembers],
    placementDecisions: [],
    score: 100,
    timeRemaining: 600,
    congestion: 0,
    notes: '',
    isCompleted: false,
    congestionEvents: []
  };
  sessions[sessionId] = session;
  saveSessions(sessions);
  res.json(session);
});

app.get('/api/sessions/:id', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (session) {
    res.json(session);
  } else {
    res.status(404).json({ error: '会话不存在' });
  }
});

app.put('/api/sessions/:id', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (session) {
    const updated = {
      ...session,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    sessions[req.params.id] = updated;
    saveSessions(sessions);
    res.json(updated);
  } else {
    res.status(404).json({ error: '会话不存在' });
  }
});

app.post('/api/sessions/:id/place', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }

  const { itemId, zone, timestamp } = req.body;
  
  const item = items.find(i => i.id === itemId);
  const member = teamMembers.find(m => m.id === itemId);
  const placedItem = item || member;

  if (!placedItem) {
    return res.status(404).json({ error: '道具或队员不存在' });
  }

  const placementOrder = session.placementDecisions.length + 1;

  let penaltyResult;
  if (member) {
    penaltyResult = calculateMemberPenalty(member, zone);
  } else {
    penaltyResult = calculatePlacementPenalty(item, zone, placementOrder, session.placementDecisions);
  }

  const { penalty, reasons } = penaltyResult;
  const isCorrect = penalty === 0;

  let newCongestion = session.congestion;
  let congestionEvents = [...session.congestionEvents];

  const zoneItems = session.placementDecisions.filter(d => d.zone === zone);
  const zoneWeight = zoneItems.reduce((sum, p) => {
    const pi = [...items, ...teamMembers].find(i => i.id === p.itemId);
    return sum + (pi ? (pi.weight || 0) : 0);
  }, 0) + (placedItem.weight || 0);

  if (zoneWeight > loadZones[zone].maxWeight * 0.8) {
    newCongestion += 5;
    congestionEvents.push({
      type: 'zone-congestion',
      timestamp: timestamp || Date.now(),
      message: `${loadZones[zone].name}区域已接近满载！`
    });
  }

  if (zone === 'waiting-area') {
    const memberCount = session.placementDecisions.filter(d => {
      const isMember = teamMembers.find(m => m.id === d.itemId);
      return isMember && d.zone === 'waiting-area';
    }).length + (member ? 1 : 0);
    
    if (memberCount >= 5) {
      newCongestion += 3;
      congestionEvents.push({
        type: 'waiting-congestion',
        timestamp: timestamp || Date.now(),
        message: '候场区队员较多，请合理安排'
      });
    }
  }

  const newScore = Math.max(0, session.score - penalty);

  const decision = {
    itemId,
    itemName: placedItem.name,
    itemType: member ? 'member' : placedItem.type,
    zone,
    correctZone: placedItem.correctZone,
    isCorrect,
    penalty,
    reason: reasons.join('; ') || '放置正确',
    placementOrder,
    weight: placedItem.weight || 0,
    isBackup: placedItem.isBackup || false,
    isRainGear: placedItem.isRainGear || false,
    isAbsent: member ? member.isAbsent : false,
    timestamp: timestamp || Date.now()
  };

  const updatedSession = {
    ...session,
    placementDecisions: [...session.placementDecisions, decision],
    score: newScore,
    congestion: Math.min(100, newCongestion),
    congestionEvents
  };

  sessions[req.params.id] = updatedSession;
  saveSessions(sessions);

  res.json({
    success: true,
    decision,
    newScore,
    congestion: Math.min(100, newCongestion),
    events: congestionEvents.slice(-3)
  });
});

app.get('/api/sessions/:id/export/markdown', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }

  const correctCount = session.placementDecisions.filter(d => d.isCorrect).length;
  const totalCount = session.placementDecisions.length;
  const accuracy = totalCount > 0 ? ((correctCount / totalCount) * 100).toFixed(1) : 0;

  let markdown = `# 民俗舞狮队装车复盘记录\n\n`;
  markdown += `## 基本信息\n\n`;
  markdown += `- **会话ID**: ${session.id}\n`;
  markdown += `- **开始时间**: ${new Date(session.createdAt).toLocaleString('zh-CN')}\n`;
  markdown += `- **完成时间**: ${new Date(session.updatedAt).toLocaleString('zh-CN')}\n`;
  markdown += `- **最终得分**: ${session.score}/100\n`;
  markdown += `- **正确率**: ${accuracy}% (${correctCount}/${totalCount})\n`;
  markdown += `- **拥堵指数**: ${session.congestion}\n\n`;

  if (session.notes) {
    markdown += `## 备注\n\n${session.notes}\n\n`;
  }

  if (session.congestionEvents && session.congestionEvents.length > 0) {
    markdown += `## 拥堵/警告事件\n\n`;
    session.congestionEvents.forEach((event, idx) => {
      markdown += `${idx + 1}. ${event.message}\n`;
    });
    markdown += `\n`;
  }

  const zoneStats = {};
  Object.keys(loadZones).forEach(zone => {
    const zoneDecisions = session.placementDecisions.filter(d => d.zone === zone);
    zoneStats[zone] = {
      count: zoneDecisions.length,
      weight: zoneDecisions.reduce((sum, d) => sum + d.weight, 0),
      correct: zoneDecisions.filter(d => d.isCorrect).length
    };
  });

  markdown += `## 各区域装载统计\n\n`;
  markdown += `| 区域 | 物品数量 | 总重量(kg) | 正确放置 |\n`;
  markdown += `|------|----------|------------|----------|\n`;
  Object.entries(loadZones).forEach(([key, zone]) => {
    const stat = zoneStats[key];
    markdown += `| ${zone.name} | ${stat.count} | ${stat.weight} | ${stat.correct}/${stat.count} |\n`;
  });
  markdown += `\n`;

  markdown += `## 放置决策详情\n\n`;
  markdown += `| 序号 | 物品/队员 | 类型 | 放置区域 | 正确区域 | 是否正确 | 扣分 | 原因 |\n`;
  markdown += `|------|-----------|------|----------|----------|----------|------|------|\n`;

  session.placementDecisions.forEach(decision => {
    const typeNames = {
      'lion-head': '狮头',
      'lion-body': '狮被',
      'drum': '鼓',
      'gong': '锣',
      'cymbal': '镲',
      'costume': '服装',
      'footwear': '鞋履',
      'speaker': '音箱',
      'battery': '电池',
      'rain-gear': '雨具',
      'supplies': '补给',
      'medical': '医疗',
      'member': '队员'
    };
    
    markdown += `| ${decision.placementOrder} | ${decision.itemName} | ${typeNames[decision.itemType] || decision.itemType} | ${loadZones[decision.zone].name} | ${loadZones[decision.correctZone].name} | ${decision.isCorrect ? '✓' : '✗'} | ${decision.penalty} | ${decision.reason} |\n`;
  });

  markdown += `\n## 装车规则回顾\n\n`;
  Object.entries(loadZones).forEach(([key, zone]) => {
    markdown += `- **${zone.icon} ${zone.name}**: ${zone.description} (最大承重: ${zone.maxWeight}kg)\n`;
  });

  markdown += `\n### 扣分规则\n`;
  markdown += `- 道具放错区域: 扣15分\n`;
  markdown += `- 重物放在候场区: 扣10分\n`;
  markdown += `- 雨具未放在雨天备用区: 扣10分\n`;
  markdown += `- 队员不在候场区: 扣20分\n`;
  markdown += `- 队员缺席提醒: 扣10分\n`;
  markdown += `- 区域超重: 扣10分\n`;
  markdown += `- 同使用顺序道具分散存放: 扣5分\n`;

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="loading-${session.id}.md"`);
  res.send(markdown);
});

app.get('/api/sessions/:id/export/json', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="loading-${session.id}.json"`);
  res.json(session);
});

app.get('/api/last-session', (req, res) => {
  const sessions = loadSessions();
  const sessionList = Object.values(sessions).sort((a, b) => 
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  
  if (sessionList.length > 0) {
    res.json(sessionList[0]);
  } else {
    res.status(404).json({ error: '没有找到历史会话' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`民俗舞狮队装车游戏服务器运行在 http://localhost:${PORT}`);
});
