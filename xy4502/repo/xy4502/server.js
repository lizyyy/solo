const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const SAVES_DIR = path.join(DATA_DIR, 'saves');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

// 确保目录存在
[DATA_DIR, SAVES_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 游戏状态存储
const gameStates = new Map();

// 事件类型定义
const EVENT_TYPES = {
  CAMERA_BLIND_SPOT: {
    id: 'camera_blind_spot',
    name: '摄像头盲区警报',
    severity: 'medium',
    baseScore: 50,
    description: '检测到摄像头盲区有异常活动'
  },
  GLASS_VIBRATION: {
    id: 'glass_vibration',
    name: '玻璃柜震动警报',
    severity: 'high',
    baseScore: 100,
    description: '临展玻璃柜检测到异常震动'
  },
  ACCESS_CARD_ANOMALY: {
    id: 'access_card_anomaly',
    name: '门禁刷卡异常',
    severity: 'high',
    baseScore: 80,
    description: '检测到门禁刷卡记录异常'
  },
  UNIDENTIFIED_OBJECT: {
    id: 'unidentified_object',
    name: '不明物体警报',
    severity: 'medium',
    baseScore: 60,
    description: '监测区域发现不明物体'
  },
  SECURITY_BREACH: {
    id: 'security_breach',
    name: '安全入侵警报',
    severity: 'critical',
    baseScore: 150,
    description: '检测到安全边界被突破'
  }
};

// 动作类型
const ACTION_TYPES = {
  PATROL: 'patrol',
  DISPATCH_GUARD: 'dispatch_guard',
  LOCK_ZONE: 'lock_zone',
  IGNORE: 'ignore'
};

// 加载博物馆数据
function loadMuseumData(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    }
    return null;
  } catch (error) {
    console.error('加载博物馆数据失败:', error);
    return null;
  }
}

// 生成随机事件
function generateEvent(museum, gameTime) {
  const eventTypes = Object.values(EVENT_TYPES);
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  
  // 根据事件类型选择位置
  let location = null;
  let targetId = null;
  
  if (eventType.id === 'camera_blind_spot') {
    // 从盲区中选择
    const blindSpots = [];
    museum.zones.forEach(zone => {
      zone.blindSpots.forEach(bs => {
        blindSpots.push({ ...bs, zoneId: zone.id, zoneName: zone.name });
      });
    });
    if (blindSpots.length > 0) {
      const spot = blindSpots[Math.floor(Math.random() * blindSpots.length)];
      location = spot.position;
      targetId = spot.id;
    }
  } else if (eventType.id === 'glass_vibration') {
    // 从玻璃柜中选择
    const glassCases = [];
    museum.zones.forEach(zone => {
      zone.exhibits.forEach(ex => {
        if (ex.isGlassCase) {
          glassCases.push({ ...ex, zoneId: zone.id, zoneName: zone.name });
        }
      });
    });
    if (glassCases.length > 0) {
      const exhibit = glassCases[Math.floor(Math.random() * glassCases.length)];
      // 简化：使用展区中心位置
      const zone = museum.zones.find(z => z.id === exhibit.zoneId);
      if (zone) {
        location = {
          x: zone.position.x + zone.position.width / 2,
          y: zone.position.y + zone.position.height / 2
        };
      }
      targetId = exhibit.id;
    }
  } else if (eventType.id === 'access_card_anomaly') {
    // 从门禁中选择
    const accessDoors = museum.doors.filter(d => d.isAccessControl);
    if (accessDoors.length > 0) {
      const door = accessDoors[Math.floor(Math.random() * accessDoors.length)];
      location = door.position;
      targetId = door.id;
    }
  } else {
    // 其他事件：随机选择一个展区
    const zone = museum.zones[Math.floor(Math.random() * museum.zones.length)];
    if (zone) {
      location = {
        x: zone.position.x + Math.random() * zone.position.width,
        y: zone.position.y + Math.random() * zone.position.height
      };
      targetId = zone.id;
    }
  }

  if (!location) {
    // 保底位置
    location = { x: 180, y: 120 };
  }

  return {
    id: uuidv4(),
    type: eventType,
    location,
    targetId,
    timestamp: gameTime,
    status: 'active',
    timeToLive: 60,
    assignedGuard: null,
    locked: false
  };
}

// 计算两点距离
function calculateDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// 初始化游戏
app.post('/api/game/init', (req, res) => {
  try {
    const { museumFile } = req.body;
    const museumData = loadMuseumData(museumFile || 'sample-museum.json');
    
    if (!museumData) {
      return res.status(400).json({ error: '无法加载博物馆数据' });
    }

    const gameId = uuidv4();
    const { museum, gameSettings } = museumData;

    const gameState = {
      id: gameId,
      museum,
      settings: gameSettings,
      startTime: Date.now(),
      elapsedTime: 0,
      player: {
        position: museum.patrolPoints.find(p => p.isBase)?.position || { x: 350, y: 50 },
        stamina: gameSettings.initialStamina,
        currentPatrolPoint: museum.patrolPoints.find(p => p.isBase)?.id
      },
      resources: {
        availableGuards: gameSettings.securityGuards,
        availableLocks: gameSettings.lockdownZones
      },
      events: [],
      eventHistory: [],
      resolvedEvents: [],
      score: 0,
      penalties: 0,
      status: 'active',
      actions: [],
      lastEventTime: 0
    };

    gameStates.set(gameId, gameState);

    res.json({
      gameId,
      state: getPublicGameState(gameState)
    });
  } catch (error) {
    console.error('初始化游戏失败:', error);
    res.status(500).json({ error: '初始化游戏失败' });
  }
});

// 获取游戏状态
app.get('/api/game/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const gameState = gameStates.get(gameId);

    if (!gameState) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    res.json({
      state: getPublicGameState(gameState)
    });
  } catch (error) {
    console.error('获取游戏状态失败:', error);
    res.status(500).json({ error: '获取游戏状态失败' });
  }
});

// 移动玩家
app.post('/api/game/:gameId/move', (req, res) => {
  try {
    const { gameId } = req.params;
    const { patrolPointId } = req.body;
    const gameState = gameStates.get(gameId);

    if (!gameState) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    if (gameState.status !== 'active') {
      return res.status(400).json({ error: '游戏已结束' });
    }

    const targetPoint = gameState.museum.patrolPoints.find(p => p.id === patrolPointId);
    if (!targetPoint) {
      return res.status(400).json({ error: '无效的巡逻点' });
    }

    // 检查体力
    const staminaCost = gameState.settings.staminaPerMove;
    if (gameState.player.stamina < staminaCost) {
      return res.status(400).json({ error: '体力不足' });
    }

    // 更新状态
    gameState.player.position = targetPoint.position;
    gameState.player.stamina -= staminaCost;
    gameState.player.currentPatrolPoint = patrolPointId;

    // 记录动作
    gameState.actions.push({
      type: ACTION_TYPES.PATROL,
      patrolPointId,
      patrolPointName: targetPoint.name,
      staminaCost,
      timestamp: gameState.elapsedTime
    });

    // 检查是否在当前位置有事件可以处理
    const nearbyEvents = gameState.events.filter(event => {
      const distance = calculateDistance(gameState.player.position, event.location);
      return distance < 100 && event.status === 'active';
    });

    res.json({
      success: true,
      state: getPublicGameState(gameState),
      nearbyEvents: nearbyEvents.map(e => ({
        id: e.id,
        type: e.type,
        location: e.location
      }))
    });
  } catch (error) {
    console.error('移动失败:', error);
    res.status(500).json({ error: '移动失败' });
  }
});

// 派遣保安
app.post('/api/game/:gameId/dispatch', (req, res) => {
  try {
    const { gameId } = req.params;
    const { eventId } = req.body;
    const gameState = gameStates.get(gameId);

    if (!gameState) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    if (gameState.status !== 'active') {
      return res.status(400).json({ error: '游戏已结束' });
    }

    const event = gameState.events.find(e => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: '事件不存在' });
    }

    if (event.status !== 'active') {
      return res.status(400).json({ error: '事件已处理' });
    }

    if (gameState.resources.availableGuards <= 0) {
      return res.status(400).json({ error: '没有可用保安' });
    }

    // 检查体力
    const staminaCost = gameState.settings.staminaPerAction;
    if (gameState.player.stamina < staminaCost) {
      return res.status(400).json({ error: '体力不足' });
    }

    // 更新状态
    gameState.resources.availableGuards--;
    gameState.player.stamina -= staminaCost;
    event.status = 'resolved';
    event.assignedGuard = true;
    gameState.resolvedEvents.push(event);

    // 加分
    const scoreGain = calculateEventScore(event, gameState.elapsedTime - event.timestamp);
    gameState.score += scoreGain;

    // 记录动作
    gameState.actions.push({
      type: ACTION_TYPES.DISPATCH_GUARD,
      eventId,
      eventType: event.type.id,
      eventName: event.type.name,
      scoreGain,
      staminaCost,
      responseTime: gameState.elapsedTime - event.timestamp,
      timestamp: gameState.elapsedTime
    });

    res.json({
      success: true,
      state: getPublicGameState(gameState),
      scoreGain
    });
  } catch (error) {
    console.error('派遣保安失败:', error);
    res.status(500).json({ error: '派遣保安失败' });
  }
});

// 锁区
app.post('/api/game/:gameId/lock', (req, res) => {
  try {
    const { gameId } = req.params;
    const { eventId } = req.body;
    const gameState = gameStates.get(gameId);

    if (!gameState) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    if (gameState.status !== 'active') {
      return res.status(400).json({ error: '游戏已结束' });
    }

    const event = gameState.events.find(e => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: '事件不存在' });
    }

    if (event.status !== 'active') {
      return res.status(400).json({ error: '事件已处理' });
    }

    if (gameState.resources.availableLocks <= 0) {
      return res.status(400).json({ error: '没有可用锁区次数' });
    }

    // 检查体力
    const staminaCost = gameState.settings.staminaPerAction;
    if (gameState.player.stamina < staminaCost) {
      return res.status(400).json({ error: '体力不足' });
    }

    // 更新状态
    gameState.resources.availableLocks--;
    gameState.player.stamina -= staminaCost;
    event.status = 'resolved';
    event.locked = true;
    gameState.resolvedEvents.push(event);

    // 加分（锁区加分略低）
    const scoreGain = Math.floor(calculateEventScore(event, gameState.elapsedTime - event.timestamp) * 0.8);
    gameState.score += scoreGain;

    // 记录动作
    gameState.actions.push({
      type: ACTION_TYPES.LOCK_ZONE,
      eventId,
      eventType: event.type.id,
      eventName: event.type.name,
      scoreGain,
      staminaCost,
      responseTime: gameState.elapsedTime - event.timestamp,
      timestamp: gameState.elapsedTime
    });

    res.json({
      success: true,
      state: getPublicGameState(gameState),
      scoreGain
    });
  } catch (error) {
    console.error('锁区失败:', error);
    res.status(500).json({ error: '锁区失败' });
  }
});

// 更新游戏状态（游戏循环）
app.post('/api/game/:gameId/tick', (req, res) => {
  try {
    const { gameId } = req.params;
    const { deltaTime } = req.body;
    const gameState = gameStates.get(gameId);

    if (!gameState) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    if (gameState.status !== 'active') {
      return res.json({ state: getPublicGameState(gameState), gameEnded: true });
    }

    // 更新时间
    const actualDelta = deltaTime || 1;
    gameState.elapsedTime += actualDelta;

    // 检查游戏是否结束
    if (gameState.elapsedTime >= gameState.settings.gameDuration) {
      gameState.status = 'ended';
      return res.json({ 
        state: getPublicGameState(gameState), 
        gameEnded: true 
      });
    }

    // 体力恢复（在基地区域）
    const basePoint = gameState.museum.patrolPoints.find(p => p.isBase);
    if (basePoint && gameState.player.currentPatrolPoint === basePoint.id) {
      gameState.player.stamina = Math.min(
        gameState.player.stamina + 2,
        gameState.settings.initialStamina
      );
    }

    // 生成新事件
    if (gameState.elapsedTime - gameState.lastEventTime >= gameState.settings.eventInterval &&
        gameState.events.filter(e => e.status === 'active').length < gameState.settings.maxActiveEvents) {
      const newEvent = generateEvent(gameState.museum, gameState.elapsedTime);
      gameState.events.push(newEvent);
      gameState.eventHistory.push({...newEvent});
      gameState.lastEventTime = gameState.elapsedTime;
    }

    // 更新事件TTL并处理超时
    const expiredEvents = [];
    gameState.events = gameState.events.filter(event => {
      if (event.status === 'active') {
        event.timeToLive -= actualDelta;
        if (event.timeToLive <= 0) {
          expiredEvents.push(event);
          return false;
        }
      }
      return true;
    });

    // 处理超时事件
    expiredEvents.forEach(event => {
      event.status = 'expired';
      gameState.resolvedEvents.push(event);
      // 扣分
      const penalty = calculateEventPenalty(event);
      gameState.penalties += penalty;
      gameState.score = Math.max(0, gameState.score - penalty);
      
      // 记录忽略动作
      gameState.actions.push({
        type: ACTION_TYPES.IGNORE,
        eventId: event.id,
        eventType: event.type.id,
        eventName: event.type.name,
        penalty,
        timestamp: gameState.elapsedTime
      });
    });

    // 保安回归（简化：10秒后回归）
    // 实际上更复杂的逻辑可能需要追踪每个保安的状态

    res.json({
      state: getPublicGameState(gameState),
      gameEnded: false
    });
  } catch (error) {
    console.error('更新游戏状态失败:', error);
    res.status(500).json({ error: '更新游戏状态失败' });
  }
});

// 保存游戏
app.post('/api/game/:gameId/save', (req, res) => {
  try {
    const { gameId } = req.params;
    const { saveName } = req.body;
    const gameState = gameStates.get(gameId);

    if (!gameState) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    const saveId = saveName || `save-${Date.now()}`;
    const savePath = path.join(SAVES_DIR, `${saveId}.json`);
    
    const saveData = {
      ...gameState,
      savedAt: Date.now(),
      saveName: saveId
    };

    fs.writeFileSync(savePath, JSON.stringify(saveData, null, 2));
    
    res.json({
      success: true,
      saveId,
      savedAt: saveData.savedAt
    });
  } catch (error) {
    console.error('保存游戏失败:', error);
    res.status(500).json({ error: '保存游戏失败' });
  }
});

// 加载游戏
app.post('/api/game/load', (req, res) => {
  try {
    const { saveId } = req.body;
    const savePath = path.join(SAVES_DIR, `${saveId}.json`);

    if (!fs.existsSync(savePath)) {
      return res.status(404).json({ error: '存档不存在' });
    }

    const saveData = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    gameStates.set(saveData.id, saveData);

    res.json({
      gameId: saveData.id,
      state: getPublicGameState(saveData),
      loadedAt: Date.now()
    });
  } catch (error) {
    console.error('加载游戏失败:', error);
    res.status(500).json({ error: '加载游戏失败' });
  }
});

// 获取存档列表
app.get('/api/saves', (req, res) => {
  try {
    const saves = [];
    if (fs.existsSync(SAVES_DIR)) {
      const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
      files.forEach(file => {
        try {
          const savePath = path.join(SAVES_DIR, file);
          const data = JSON.parse(fs.readFileSync(savePath, 'utf8'));
          saves.push({
            id: file.replace('.json', ''),
            name: data.saveName || file,
            savedAt: data.savedAt,
            elapsedTime: data.elapsedTime,
            score: data.score
          });
        } catch (e) {
          console.error('读取存档失败:', file);
        }
      });
    }
    saves.sort((a, b) => b.savedAt - a.savedAt);
    res.json(saves);
  } catch (error) {
    console.error('获取存档列表失败:', error);
    res.status(500).json({ error: '获取存档列表失败' });
  }
});

// 导出报告
app.post('/api/game/:gameId/export', (req, res) => {
  try {
    const { gameId } = req.params;
    const gameState = gameStates.get(gameId);

    if (!gameState) {
      return res.status(404).json({ error: '游戏不存在' });
    }

    // 生成 Markdown 复盘
    const markdown = generateMarkdownReport(gameState);
    
    // 生成 JSON 事件记录
    const jsonReport = generateJSONReport(gameState);
    
    // 保存到文件
    const reportId = `report-${Date.now()}`;
    const mdPath = path.join(REPORTS_DIR, `${reportId}.md`);
    const jsonPath = path.join(REPORTS_DIR, `${reportId}.json`);
    
    fs.writeFileSync(mdPath, markdown);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

    res.json({
      success: true,
      reportId,
      markdown: {
        path: mdPath,
        content: markdown
      },
      json: {
        path: jsonPath,
        content: jsonReport
      }
    });
  } catch (error) {
    console.error('导出报告失败:', error);
    res.status(500).json({ error: '导出报告失败' });
  }
});

// 上传自定义博物馆数据
app.post('/api/museum/upload', (req, res) => {
  try {
    const { museumData, name } = req.body;
    
    if (!museumData || !museumData.museum) {
      return res.status(400).json({ error: '无效的博物馆数据格式' });
    }

    const filename = name || `custom-${Date.now()}`;
    const filePath = path.join(DATA_DIR, `${filename}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(museumData, null, 2));

    res.json({
      success: true,
      filename: `${filename}.json`,
      museumName: museumData.museum.name
    });
  } catch (error) {
    console.error('上传博物馆数据失败:', error);
    res.status(500).json({ error: '上传博物馆数据失败' });
  }
});

// 获取可用博物馆列表
app.get('/api/museums', (req, res) => {
  try {
    const museums = [];
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !f.startsWith('save-') && !f.startsWith('report-'));
      files.forEach(file => {
        try {
          const filePath = path.join(DATA_DIR, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          museums.push({
            filename: file,
            name: data.museum?.name || file
          });
        } catch (e) {
          console.error('读取博物馆文件失败:', file);
        }
      });
    }
    res.json(museums);
  } catch (error) {
    console.error('获取博物馆列表失败:', error);
    res.status(500).json({ error: '获取博物馆列表失败' });
  }
});

// 辅助函数
function getPublicGameState(state) {
  return {
    id: state.id,
    museum: state.museum,
    settings: state.settings,
    elapsedTime: state.elapsedTime,
    player: state.player,
    resources: state.resources,
    events: state.events.map(e => ({
      id: e.id,
      type: e.type,
      location: e.location,
      targetId: e.targetId,
      timestamp: e.timestamp,
      status: e.status,
      timeToLive: e.timeToLive
    })),
    score: state.score,
    penalties: state.penalties,
    status: state.status
  };
}

function calculateEventScore(event, responseTime) {
  const baseScore = event.type.baseScore;
  // 响应时间越短，分数越高
  const timeBonus = Math.max(0, 50 - responseTime);
  return Math.floor(baseScore + timeBonus);
}

function calculateEventPenalty(event) {
  // 超时惩罚是基础分的1.5倍
  return Math.floor(event.type.baseScore * 1.5);
}

function generateMarkdownReport(gameState) {
  const { museum, settings, elapsedTime, score, penalties, actions, resolvedEvents } = gameState;
  
  // 统计信息
  const totalEvents = resolvedEvents.length;
  const resolvedOnTime = resolvedEvents.filter(e => e.status === 'resolved').length;
  const expiredEvents = resolvedEvents.filter(e => e.status === 'expired').length;
  const dispatches = actions.filter(a => a.type === ACTION_TYPES.DISPATCH_GUARD).length;
  const locks = actions.filter(a => a.type === ACTION_TYPES.LOCK_ZONE).length;
  const patrols = actions.filter(a => a.type === ACTION_TYPES.PATROL).length;
  
  // 计算评级
  let rating = 'D';
  if (totalEvents > 0) {
    const successRate = resolvedOnTime / totalEvents;
    if (successRate >= 0.9) rating = 'S';
    else if (successRate >= 0.75) rating = 'A';
    else if (successRate >= 0.5) rating = 'B';
    else if (successRate >= 0.3) rating = 'C';
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  let md = `# 博物馆安保训练复盘报告\n\n`;
  md += `## 基本信息\n\n`;
  md += `- **博物馆**: ${museum.name}\n`;
  md += `- **训练时长**: ${formatTime(elapsedTime)}\n`;
  md += `- **最终得分**: ${score} 分\n`;
  md += `- **扣分总计**: ${penalties} 分\n`;
  md += `- **评级**: ${rating}\n\n`;

  md += `## 事件统计\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总事件数 | ${totalEvents} |\n`;
  md += `| 及时处理 | ${resolvedOnTime} |\n`;
  md += `| 超时遗漏 | ${expiredEvents} |\n`;
  md += `| 派遣保安 | ${dispatches} |\n`;
  md += `| 区域封锁 | ${locks} |\n`;
  md += `| 巡逻次数 | ${patrols} |\n\n`;

  if (totalEvents > 0) {
    md += `## 事件详情\n\n`;
    md += `### 已处理事件\n\n`;
    const resolved = resolvedEvents.filter(e => e.status === 'resolved');
    if (resolved.length > 0) {
      resolved.forEach((event, index) => {
        const action = actions.find(a => a.eventId === event.id);
        md += `**事件 ${index + 1}: ${event.type.name}**\n\n`;
        md += `- 类型: ${event.type.id}\n`;
        md += `- 严重程度: ${event.type.severity}\n`;
        md += `- 基础分值: ${event.type.baseScore}\n`;
        md += `- 发生时间: ${formatTime(event.timestamp)}\n`;
        if (action) {
          md += `- 处理方式: ${action.type === ACTION_TYPES.DISPATCH_GUARD ? '派遣保安' : '区域封锁'}\n`;
          md += `- 响应时间: ${action.responseTime} 秒\n`;
          md += `- 得分: +${action.scoreGain}\n`;
        }
        md += `\n`;
      });
    } else {
      md += `无\n\n`;
    }

    md += `### 超时遗漏事件\n\n`;
    const expired = resolvedEvents.filter(e => e.status === 'expired');
    if (expired.length > 0) {
      expired.forEach((event, index) => {
        const action = actions.find(a => a.eventId === event.id);
        md += `**事件 ${index + 1}: ${event.type.name}**\n\n`;
        md += `- 类型: ${event.type.id}\n`;
        md += `- 严重程度: ${event.type.severity}\n`;
        md += `- 基础分值: ${event.type.baseScore}\n`;
        md += `- 发生时间: ${formatTime(event.timestamp)}\n`;
        if (action) {
          md += `- 扣分: -${action.penalty}\n`;
        }
        md += `\n`;
      });
    } else {
      md += `无\n\n`;
    }
  }

  md += `## 训练总结\n\n`;
  if (rating === 'S') {
    md += `表现优秀！您成功处理了绝大多数事件，响应及时，决策合理。\n\n`;
  } else if (rating === 'A') {
    md += `表现良好！您的处理能力较强，但仍有提升空间。\n\n`;
  } else if (rating === 'B') {
    md += `表现一般。建议加强对事件优先级的判断和路线规划。\n\n`;
  } else if (rating === 'C') {
    md += `表现有待提高。建议多练习熟悉馆区布局和事件处理流程。\n\n`;
  } else {
    md += `需要更多练习。请仔细阅读安保手册，熟悉各种事件的处理方法。\n\n`;
  }

  if (expiredEvents > 0) {
    md += `⚠️ **注意**: 您有 ${expiredEvents} 个事件超时未处理，这可能导致严重的安全后果。\n\n`;
  }

  md += `---\n`;
  md += `报告生成时间: ${new Date().toLocaleString()}\n`;

  return md;
}

function generateJSONReport(gameState) {
  return {
    reportId: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    game: {
      id: gameState.id,
      museumName: gameState.museum.name,
      elapsedTime: gameState.elapsedTime,
      finalScore: gameState.score,
      totalPenalties: gameState.penalties,
      gameStatus: gameState.status
    },
    statistics: {
      totalEvents: gameState.resolvedEvents.length,
      resolvedOnTime: gameState.resolvedEvents.filter(e => e.status === 'resolved').length,
      expiredEvents: gameState.resolvedEvents.filter(e => e.status === 'expired').length,
      dispatches: gameState.actions.filter(a => a.type === ACTION_TYPES.DISPATCH_GUARD).length,
      locks: gameState.actions.filter(a => a.type === ACTION_TYPES.LOCK_ZONE).length,
      patrols: gameState.actions.filter(a => a.type === ACTION_TYPES.PATROL).length
    },
    events: {
      resolved: gameState.resolvedEvents
        .filter(e => e.status === 'resolved')
        .map(e => ({
          id: e.id,
          type: e.type.id,
          typeName: e.type.name,
          severity: e.type.severity,
          baseScore: e.type.baseScore,
          location: e.location,
          timestamp: e.timestamp,
          action: gameState.actions.find(a => a.eventId === e.id)
        })),
      expired: gameState.resolvedEvents
        .filter(e => e.status === 'expired')
        .map(e => ({
          id: e.id,
          type: e.type.id,
          typeName: e.type.name,
          severity: e.type.severity,
          baseScore: e.type.baseScore,
          location: e.location,
          timestamp: e.timestamp
        }))
    },
    actions: gameState.actions.map(a => ({
      type: a.type,
      timestamp: a.timestamp,
      ...a
    })),
    playerStats: {
      finalStamina: gameState.player.stamina,
      finalPosition: gameState.player.position
    },
    resourcesUsed: {
      guardsUsed: gameState.settings.securityGuards - gameState.resources.availableGuards,
      locksUsed: gameState.settings.lockdownZones - gameState.resources.availableLocks
    }
  };
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`博物馆安保游戏服务器已启动: http://localhost:${PORT}`);
  console.log(`API 文档:`);
  console.log(`  - GET /api/museums - 获取可用博物馆列表`);
  console.log(`  - POST /api/game/init - 初始化游戏`);
  console.log(`  - GET /api/game/:id - 获取游戏状态`);
  console.log(`  - POST /api/game/:id/move - 移动玩家`);
  console.log(`  - POST /api/game/:id/dispatch - 派遣保安`);
  console.log(`  - POST /api/game/:id/lock - 锁区`);
  console.log(`  - POST /api/game/:id/tick - 更新游戏状态`);
  console.log(`  - POST /api/game/:id/save - 保存游戏`);
  console.log(`  - POST /api/game/load - 加载游戏`);
  console.log(`  - GET /api/saves - 获取存档列表`);
  console.log(`  - POST /api/game/:id/export - 导出报告`);
  console.log(`  - POST /api/museum/upload - 上传自定义博物馆数据`);
});
