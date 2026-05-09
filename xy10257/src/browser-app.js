class PathNode {
  constructor(id, name, x, y, elevation, type = 'normal') {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.elevation = elevation;
    this.type = type;
    this.riskLevel = 0;
    this.visited = false;
  }

  static fromJSON(json) {
    const node = new PathNode(json.id, json.name, json.x, json.y, json.elevation, json.type);
    if (json.riskLevel !== undefined) node.riskLevel = json.riskLevel;
    if (json.visited !== undefined) node.visited = json.visited;
    return node;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      elevation: this.elevation,
      type: this.type,
      riskLevel: this.riskLevel,
      visited: this.visited
    };
  }

  distanceTo(other) {
    return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
  }

  elevationDiff(other) {
    return other.elevation - this.elevation;
  }
}

class PathManager {
  constructor() {
    this.nodes = new Map();
    this.connections = [];
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return this;
  }

  addNodes(nodes) {
    nodes.forEach(node => this.addNode(PathNode.fromJSON(node)));
    return this;
  }

  addConnection(fromId, toId) {
    if (this.nodes.has(fromId) && this.nodes.has(toId)) {
      const existing = this.connections.find(
        c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
      );
      if (!existing) {
        this.connections.push({ from: fromId, to: toId });
      }
    }
    return this;
  }

  addConnections(connections) {
    connections.forEach(c => this.addConnection(c.from, c.to));
    return this;
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getNeighbors(nodeId) {
    const neighbors = [];
    this.connections.forEach(c => {
      if (c.from === nodeId) neighbors.push(this.nodes.get(c.to));
      else if (c.to === nodeId) neighbors.push(this.nodes.get(c.from));
    });
    return neighbors.filter(n => n !== undefined);
  }

  calculateTotalDistance(nodeIds) {
    let distance = 0;
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const node1 = this.getNode(nodeIds[i]);
      const node2 = this.getNode(nodeIds[i + 1]);
      if (node1 && node2) {
        distance += node1.distanceTo(node2);
      }
    }
    return distance;
  }

  calculateTotalElevationGain(nodeIds) {
    let gain = 0;
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const node1 = this.getNode(nodeIds[i]);
      const node2 = this.getNode(nodeIds[i + 1]);
      if (node1 && node2) {
        const diff = node2.elevation - node1.elevation;
        if (diff > 0) gain += diff;
      }
    }
    return gain;
  }

  calculateTotalElevationLoss(nodeIds) {
    let loss = 0;
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const node1 = this.getNode(nodeIds[i]);
      const node2 = this.getNode(nodeIds[i + 1]);
      if (node1 && node2) {
        const diff = node1.elevation - node2.elevation;
        if (diff > 0) loss += diff;
      }
    }
    return loss;
  }

  getElevationProfile(nodeIds) {
    return nodeIds.map(id => {
      const node = this.getNode(id);
      return node ? { id: node.id, name: node.name, elevation: node.elevation } : null;
    }).filter(p => p !== null);
  }

  findShortestPath(startId, endId, useElevation = false) {
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set(this.nodes.keys());

    this.nodes.forEach((_, id) => {
      distances.set(id, id === startId ? 0 : Infinity);
      previous.set(id, null);
    });

    while (unvisited.size > 0) {
      let currentId = null;
      let minDist = Infinity;
      unvisited.forEach(id => {
        if (distances.get(id) < minDist) {
          minDist = distances.get(id);
          currentId = id;
        }
      });

      if (currentId === null || currentId === endId) break;
      unvisited.delete(currentId);

      const currentNode = this.getNode(currentId);
      if (!currentNode) continue;

      this.getNeighbors(currentId).forEach(neighbor => {
        if (!unvisited.has(neighbor.id)) return;
        
        let distance = currentNode.distanceTo(neighbor);
        if (useElevation) {
          const elevationDiff = Math.abs(currentNode.elevationDiff(neighbor));
          distance += elevationDiff * 0.1;
        }

        const alt = distances.get(currentId) + distance;
        if (alt < distances.get(neighbor.id)) {
          distances.set(neighbor.id, alt);
          previous.set(neighbor.id, currentId);
        }
      });
    }

    const path = [];
    let current = endId;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current);
    }

    return path.length > 1 && path[0] === startId ? path : null;
  }
}

class RescueTeam {
  constructor(id, name, currentNodeId, speed = 5.0, status = 'standby') {
    this.id = id;
    this.name = name;
    this.currentNodeId = currentNodeId;
    this.speed = speed;
    this.status = status;
    this.assignedTask = null;
    this.missionStartTime = null;
    this.route = [];
    this.displayX = 0;
    this.displayY = 0;
  }

  static fromJSON(json) {
    const team = new RescueTeam(
      json.id, json.name, json.currentNodeId, 
      json.speed || 5.0, json.status || 'standby'
    );
    if (json.assignedTask) team.assignedTask = json.assignedTask;
    if (json.missionStartTime) team.missionStartTime = json.missionStartTime;
    if (json.route) team.route = json.route;
    return team;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      currentNodeId: this.currentNodeId,
      speed: this.speed,
      status: this.status,
      assignedTask: this.assignedTask,
      missionStartTime: this.missionStartTime,
      route: this.route
    };
  }

  assignTask(alarmId, route) {
    this.assignedTask = { alarmId };
    this.route = route;
    this.status = 'moving';
    this.missionStartTime = Date.now();
  }

  completeMission() {
    this.assignedTask = null;
    this.route = [];
    this.status = 'standby';
    this.missionStartTime = null;
  }
}

class RescueSystem {
  constructor() {
    this.pathManager = new PathManager();
    this.teams = new Map();
    this.alarms = new Map();
    this.riskFactors = {
      elevationGainWeight: 0.002,
      elevationLossWeight: 0.001,
      distanceWeight: 0.0001,
      riskMultiplier: 1.5,
      speedVariation: 0.3
    };
  }

  initialize(sampleData) {
    this.pathManager.addNodes(sampleData.nodes);
    this.pathManager.addConnections(sampleData.connections);
    if (sampleData.teams) {
      sampleData.teams.forEach(team => 
        this.addTeam(RescueTeam.fromJSON(team))
      );
    }
    if (sampleData.alarms) {
      sampleData.alarms.forEach(alarm => 
        this.addAlarm(alarm)
      );
    }
    return this;
  }

  addTeam(team) {
    this.teams.set(team.id, team);
    return this;
  }

  addAlarm(alarm) {
    this.alarms.set(alarm.id, {
      id: alarm.id,
      nodeId: alarm.nodeId,
      severity: alarm.severity || 'medium',
      description: alarm.description || '',
      timestamp: alarm.timestamp || Date.now(),
      status: alarm.status || 'pending',
      assignedTeamId: null
    });
    return this;
  }

  calculateETA(teamId, targetNodeId, route = null) {
    const team = this.teams.get(teamId);
    if (!team) return null;

    const startNodeId = team.currentNodeId;
    let path = route;

    if (!path) {
      path = this.pathManager.findShortestPath(startNodeId, targetNodeId, true);
    }

    if (!path || path.length < 2) return null;

    const distance = this.pathManager.calculateTotalDistance(path);
    const elevationGain = this.pathManager.calculateTotalElevationGain(path);
    const elevationLoss = this.pathManager.calculateTotalElevationLoss(path);

    const distanceTime = distance / team.speed;
    const elevationPenalty = (elevationGain * this.riskFactors.elevationGainWeight) + 
                             (elevationLoss * this.riskFactors.elevationLossWeight);

    const riskPenalty = this.calculateRiskPenalty(path);
    const totalTime = distanceTime + elevationPenalty + riskPenalty;

    return {
      path: path,
      distance: distance,
      elevationGain: elevationGain,
      elevationLoss: elevationLoss,
      baseTime: distanceTime,
      elevationPenalty: elevationPenalty,
      riskPenalty: riskPenalty,
      totalTime: totalTime,
      formattedETA: this.formatTime(totalTime)
    };
  }

  calculateRiskPenalty(path) {
    let penalty = 0;
    path.forEach(nodeId => {
      const node = this.pathManager.getNode(nodeId);
      if (node && node.riskLevel > 0) {
        penalty += node.riskLevel * this.riskFactors.riskMultiplier;
      }
    });
    return penalty;
  }

  calculateRouteRisk(path) {
    if (!path || path.length < 2) return 0;

    let totalRisk = 0;
    let maxRisk = 0;
    let count = 0;

    path.forEach(nodeId => {
      const node = this.pathManager.getNode(nodeId);
      if (node) {
        totalRisk += node.riskLevel;
        maxRisk = Math.max(maxRisk, node.riskLevel);
        count++;
      }
    });

    const elevationGain = this.pathManager.calculateTotalElevationGain(path);
    const distance = this.pathManager.calculateTotalDistance(path);
    const avgRisk = count > 0 ? totalRisk / count : 0;

    return {
      averageRisk: avgRisk,
      maxRisk: maxRisk,
      elevationRisk: elevationGain * this.riskFactors.elevationGainWeight * 10,
      distanceRisk: distance * this.riskFactors.distanceWeight,
      overallRisk: Math.max(maxRisk, avgRisk + elevationGain * 0.001)
    };
  }

  assignBestTeam(alarmId) {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || alarm.status !== 'pending') return null;

    let bestTeam = null;
    let bestETA = null;

    this.teams.forEach(team => {
      if (team.status === 'standby') {
        const eta = this.calculateETA(team.id, alarm.nodeId);
        if (eta && (!bestETA || eta.totalTime < bestETA.totalTime)) {
          bestTeam = team;
          bestETA = eta;
        }
      }
    });

    if (bestTeam) {
      alarm.status = 'assigned';
      alarm.assignedTeamId = bestTeam.id;
      bestTeam.assignTask(alarmId, bestETA.path);
      return { team: bestTeam, eta: bestETA, alarm: alarm };
    }

    return null;
  }

  generateRouteReport(alarmId) {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || !alarm.assignedTeamId) return null;

    const team = this.teams.get(alarm.assignedTeamId);
    if (!team || !team.route) return null;

    const eta = this.calculateETA(team.id, alarm.nodeId, team.route);
    const risk = this.calculateRouteRisk(team.route);
    const profile = this.pathManager.getElevationProfile(team.route);

    return {
      alarmId: alarm.id,
      alarmNodeId: alarm.nodeId,
      teamId: team.id,
      teamName: team.name,
      route: team.route,
      elevationProfile: profile,
      eta: eta,
      risk: risk,
      timestamp: Date.now(),
      recommendations: this.generateRecommendations(eta, risk)
    };
  }

  generateRecommendations(eta, risk) {
    const recommendations = [];
    if (eta.elevationGain > 300) {
      recommendations.push({
        level: 'warning',
        message: '爬升高度超过300米，建议携带额外供氧设备'
      });
    }
    if (eta.elevationLoss > 200) {
      recommendations.push({
        level: 'info',
        message: '下降高度较大，注意防滑和膝关节保护'
      });
    }
    if (risk.maxRisk >= 3) {
      recommendations.push({
        level: 'danger',
        message: '路径存在高风险区域，建议谨慎前进'
      });
    }
    if (risk.averageRisk >= 2) {
      recommendations.push({
        level: 'warning',
        message: '整体风险等级较高，考虑是否需要增援'
      });
    }
    return recommendations;
  }

  markNodeRisk(nodeId, riskLevel) {
    const node = this.pathManager.getNode(nodeId);
    if (node) {
      node.riskLevel = Math.max(0, Math.min(5, riskLevel));
    }
    return this;
  }

  moveTeamTo(teamId, nodeId) {
    const team = this.teams.get(teamId);
    if (team) {
      team.currentNodeId = nodeId;
      if (team.route && team.route[team.route.length - 1] === nodeId) {
        team.completeMission();
      }
    }
    return this;
  }

  updateTeamSpeed(teamId, newSpeed) {
    const team = this.teams.get(teamId);
    if (team && newSpeed > 0) {
      team.speed = newSpeed;
    }
    return this;
  }

  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  }

  getSystemStatus() {
    const standbyTeams = Array.from(this.teams.values()).filter(t => t.status === 'standby');
    const movingTeams = Array.from(this.teams.values()).filter(t => t.status === 'moving');
    const pendingAlarms = Array.from(this.alarms.values()).filter(a => a.status === 'pending');
    const assignedAlarms = Array.from(this.alarms.values()).filter(a => a.status === 'assigned');

    return {
      totalNodes: this.pathManager.getAllNodes().length,
      totalTeams: this.teams.size,
      standbyTeams: standbyTeams.length,
      movingTeams: movingTeams.length,
      pendingAlarms: pendingAlarms.length,
      assignedAlarms: assignedAlarms.length,
      teams: Array.from(this.teams.values()).map(t => t.toJSON()),
      alarms: Array.from(this.alarms.values())
    };
  }
}

let rescueSystem;
let selectedAlarmId = null;
let selectedTeamId = null;
let draggingTeam = null;
let lastSampleData = null;

async function initApp() {
  try {
    const response = await fetch('data/sample-data.json');
    lastSampleData = await response.json();
    
    rescueSystem = new RescueSystem();
    rescueSystem.initialize(lastSampleData);
    
    initializeTeamsDisplayPositions();
    setupEventListeners();
    renderAll();
    
    console.log('✅ 山地步道救援定位板已启动');
    console.log('📊 系统状态:', rescueSystem.getSystemStatus());
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    showToast('初始化失败，请刷新页面重试', 'error');
  }
}

function initializeTeamsDisplayPositions() {
  rescueSystem.teams.forEach(team => {
    const node = rescueSystem.pathManager.getNode(team.currentNodeId);
    if (node) {
      team.displayX = node.x;
      team.displayY = node.y;
    }
  });
}

function setupEventListeners() {
  const canvas = document.getElementById('map-canvas');
  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('mouseleave', handleCanvasMouseUp);

  document.getElementById('assign-best-team-btn').addEventListener('click', handleAutoAssign);
  document.getElementById('generate-report-btn').addEventListener('click', handleGenerateReport);
  document.getElementById('mark-risk-btn').addEventListener('click', handleMarkRisk);
  
  document.getElementById('range-team-a').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('speed-team-a').textContent = val.toFixed(1);
    rescueSystem.updateTeamSpeed('TEAM_A', val);
    renderAll();
  });
  
  document.getElementById('range-team-b').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('speed-team-b').textContent = val.toFixed(1);
    rescueSystem.updateTeamSpeed('TEAM_B', val);
    renderAll();
  });
  
  document.getElementById('range-team-c').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('speed-team-c').textContent = val.toFixed(1);
    rescueSystem.updateTeamSpeed('TEAM_C', val);
    renderAll();
  });

  document.getElementById('risk-level-range').addEventListener('input', (e) => {
    document.getElementById('risk-level-display').textContent = e.target.value;
  });

  document.getElementById('test-no-path').addEventListener('click', testNoPathScenario);
  document.getElementById('test-no-teams').addEventListener('click', testNoTeamsScenario);
  document.getElementById('test-invalid-node').addEventListener('click', testInvalidNodeScenario);
  document.getElementById('reset-data-btn').addEventListener('click', resetAllData);
}

function renderAll() {
  updateStatusBar();
  renderAlarmsList();
  renderTeamsList();
  renderNodeSelect();
  renderMapCanvas();
  updateStats();
}

function updateStatusBar() {
  const status = rescueSystem.getSystemStatus();
  document.getElementById('total-nodes').textContent = `节点: ${status.totalNodes}`;
  document.getElementById('standby-teams').textContent = `待命队伍: ${status.standbyTeams}`;
  document.getElementById('moving-teams').textContent = `移动中: ${status.movingTeams}`;
  document.getElementById('pending-alarms').textContent = `待处理报警: ${status.pendingAlarms}`;
  document.getElementById('assigned-alarms').textContent = `已分配: ${status.assignedAlarms}`;
}

function renderAlarmsList() {
  const container = document.getElementById('alarms-list');
  container.innerHTML = '';
  
  const alarms = Array.from(rescueSystem.alarms.values());
  if (alarms.length === 0) {
    container.innerHTML = '<p style="color:#666;">暂无报警</p>';
    return;
  }

  alarms.forEach(alarm => {
    const node = rescueSystem.pathManager.getNode(alarm.nodeId);
    const div = document.createElement('div');
    div.className = `list-item ${selectedAlarmId === alarm.id ? 'selected' : ''}`;
    div.innerHTML = `
      <div class="item-title">${alarm.severity === 'high' ? '🔴' : '🟡'} ${node ? node.name : alarm.nodeId}</div>
      <div class="item-detail">状态: ${alarm.status === 'pending' ? '待处理' : '已分配'}</div>
      <div class="item-detail">${alarm.description}</div>
    `;
    div.addEventListener('click', () => {
      selectedAlarmId = alarm.id;
      renderAll();
      showNodeDetails(node);
    });
    container.appendChild(div);
  });
}

function renderTeamsList() {
  const container = document.getElementById('teams-list');
  container.innerHTML = '';
  
  const teams = Array.from(rescueSystem.teams.values());
  if (teams.length === 0) {
    container.innerHTML = '<p style="color:#666;">暂无队伍</p>';
    return;
  }

  teams.forEach(team => {
    const currentNode = rescueSystem.pathManager.getNode(team.currentNodeId);
    const div = document.createElement('div');
    div.className = `list-item ${selectedTeamId === team.id ? 'selected' : ''}`;
    
    const statusColor = team.status === 'standby' ? '🟢' : '🟡';
    div.innerHTML = `
      <div class="item-title">${statusColor} ${team.name}</div>
      <div class="item-detail">位置: ${currentNode ? currentNode.name : team.currentNodeId}</div>
      <div class="item-detail">速度: ${team.speed} km/h</div>
      <div class="item-detail">状态: ${team.status === 'standby' ? '待命' : '执行任务'}</div>
    `;
    div.addEventListener('click', () => {
      selectedTeamId = team.id;
      renderAll();
    });
    container.appendChild(div);
  });
}

function renderNodeSelect() {
  const select = document.getElementById('risk-node-select');
  const currentValue = select.value;
  select.innerHTML = '<option value="">-- 选择节点 --</option>';
  
  rescueSystem.pathManager.getAllNodes().forEach(node => {
    const option = document.createElement('option');
    option.value = node.id;
    option.textContent = `${node.name} (风险: ${node.riskLevel})`;
    select.appendChild(option);
  });
  
  if (currentValue) {
    select.value = currentValue;
  }
}

function renderMapCanvas() {
  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawConnections(ctx);
  drawActiveRoutes(ctx);
  drawNodes(ctx);
  drawAlarms(ctx);
  drawTeams(ctx, scaleX, scaleY);
  drawElevationLabels(ctx);
}

function drawConnections(ctx) {
  ctx.strokeStyle = '#5a6a7a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  rescueSystem.pathManager.connections.forEach(conn => {
    const node1 = rescueSystem.pathManager.getNode(conn.from);
    const node2 = rescueSystem.pathManager.getNode(conn.to);
    if (node1 && node2) {
      ctx.beginPath();
      ctx.moveTo(node1.x, node1.y);
      ctx.lineTo(node2.x, node2.y);
      ctx.stroke();
    }
  });
}

function drawActiveRoutes(ctx) {
  rescueSystem.teams.forEach(team => {
    if (team.route && team.route.length > 1) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.setLineDash([10, 5]);
      
      ctx.beginPath();
      for (let i = 0; i < team.route.length; i++) {
        const node = rescueSystem.pathManager.getNode(team.route[i]);
        if (node) {
          if (i === 0) {
            ctx.moveTo(node.x, node.y);
          } else {
            ctx.lineTo(node.x, node.y);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

function drawNodes(ctx) {
  rescueSystem.pathManager.getAllNodes().forEach(node => {
    const isSupply = node.type === 'supply';
    const radius = isSupply ? 14 : 10;
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
    if (isSupply) {
      gradient.addColorStop(0, '#6ee7b7');
      gradient.addColorStop(1, '#4ecdc4');
    } else {
      gradient.addColorStop(0, '#fde047');
      gradient.addColorStop(1, '#ffd93d');
    }
    
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (node.riskLevel > 0) {
      const riskColors = ['#2ecc71', '#27ae60', '#f39c12', '#e67e22', '#e74c3c', '#c0392b'];
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = riskColors[node.riskLevel] || '#e74c3c';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, node.x, node.y + 28);
  });
}

function drawAlarms(ctx) {
  rescueSystem.alarms.forEach(alarm => {
    const node = rescueSystem.pathManager.getNode(alarm.nodeId);
    if (node) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 25, 0, Math.PI * 2);
      ctx.strokeStyle = alarm.status === 'pending' ? '#e94560' : '#a29bfe';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      const time = Date.now();
      const pulse = 1 + Math.sin(time / 200) * 0.2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 20 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = alarm.status === 'pending' 
        ? 'rgba(233, 69, 96, 0.3)' 
        : 'rgba(162, 155, 254, 0.3)';
      ctx.fill();

      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚨', node.x, node.y - 28);
    }
  });
}

function drawTeams(ctx, scaleX, scaleY) {
  let index = 0;
  rescueSystem.teams.forEach(team => {
    const offsetX = Math.cos(index * 0.5) * 20;
    const offsetY = Math.sin(index * 0.5) * 20;
    
    let x, y;
    if (draggingTeam && draggingTeam.id === team.id) {
      x = draggingTeam.displayX;
      y = draggingTeam.displayY;
    } else {
      x = team.displayX + offsetX;
      y = team.displayY + offsetY;
    }

    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 16);
    gradient.addColorStop(0, '#c4b5fd');
    gradient.addColorStop(1, '#a29bfe');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = team.status === 'moving' ? '#ffd93d' : '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚁', x, y + 5);

    ctx.fillStyle = team.status === 'moving' ? '#ffd93d' : '#4ecdc4';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(team.name, x, y + 35);

    index++;
  });
}

function drawElevationLabels(ctx) {
  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  
  const nodes = rescueSystem.pathManager.getAllNodes()
    .sort((a, b) => a.y - b.y)
    .slice(0, 3);
    
  nodes.forEach((node, i) => {
    ctx.fillText(`${node.elevation}m`, 720, 30 + i * 20);
  });
}

function handleCanvasMouseDown(e) {
  const canvas = document.getElementById('map-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  let foundTeam = null;
  let minDist = 30;

  rescueSystem.teams.forEach(team => {
    const dx = x - team.displayX;
    const dy = y - team.displayY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      foundTeam = team;
    }
  });

  if (foundTeam) {
    draggingTeam = foundTeam;
    draggingTeam.displayX = x;
    draggingTeam.displayY = y;
    canvas.style.cursor = 'grabbing';
  } else {
    let foundNode = null;
    minDist = 20;
    
    rescueSystem.pathManager.getAllNodes().forEach(node => {
      const dx = x - node.x;
      const dy = y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        foundNode = node;
      }
    });

    if (foundNode) {
      showNodeDetails(foundNode);
    }
  }
}

function handleCanvasMouseMove(e) {
  if (draggingTeam) {
    const canvas = document.getElementById('map-canvas');
    const rect = canvas.getBoundingClientRect();
    draggingTeam.displayX = (e.clientX - rect.left) * (canvas.width / rect.width);
    draggingTeam.displayY = (e.clientY - rect.top) * (canvas.height / rect.height);
    renderMapCanvas();
  }
}

function handleCanvasMouseUp() {
  if (draggingTeam) {
    let nearestNode = null;
    let minDist = 50;
    
    rescueSystem.pathManager.getAllNodes().forEach(node => {
      const dx = draggingTeam.displayX - node.x;
      const dy = draggingTeam.displayY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearestNode = node;
      }
    });

    if (nearestNode) {
      rescueSystem.moveTeamTo(draggingTeam.id, nearestNode.id);
      draggingTeam.displayX = nearestNode.x;
      draggingTeam.displayY = nearestNode.y;
      showToast(`${draggingTeam.name} 已移动到 ${nearestNode.name}`, 'success');
    } else {
      const originalNode = rescueSystem.pathManager.getNode(draggingTeam.currentNodeId);
      if (originalNode) {
        draggingTeam.displayX = originalNode.x;
        draggingTeam.displayY = originalNode.y;
      }
      showToast('无法放置，请移动到节点附近', 'warning');
    }
    
    draggingTeam = null;
    renderAll();
  }
}

function showNodeDetails(node) {
  if (!node) return;
  
  const container = document.getElementById('node-details');
  const riskColors = ['#2ecc71', '#27ae60', '#f39c12', '#e67e22', '#e74c3c', '#c0392b'];
  const riskLabels = ['极低', '低', '中低', '中', '中高', '高'];
  
  const hasAlarm = Array.from(rescueSystem.alarms.values()).some(a => a.nodeId === node.id);
  const isSupply = node.type === 'supply';
  
  container.innerHTML = `
    <div class="detail-item">
      <span class="detail-label">名称:</span>
      <span class="detail-value">${node.name}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">类型:</span>
      <span class="detail-value">${isSupply ? '🏪 补给点' : '📍 普通节点'}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">海拔:</span>
      <span class="detail-value">${node.elevation} m</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">风险等级:</span>
      <span class="risk-badge risk-${node.riskLevel}" style="background:${riskColors[node.riskLevel]}">${riskLabels[node.riskLevel]} (${node.riskLevel})</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">坐标:</span>
      <span class="detail-value">(${node.x}, ${node.y})</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">报警状态:</span>
      <span class="detail-value" style="color:${hasAlarm ? '#e94560' : '#4ecdc4'}">${hasAlarm ? '🚨 有报警' : '✅ 正常'}</span>
    </div>
  `;
}

function updateStats() {
  let elevationGain = 0;
  let elevationLoss = 0;
  let eta = '--';
  let risk = '--';

  const movingTeams = Array.from(rescueSystem.teams.values()).filter(t => t.status === 'moving' && t.route.length > 1);
  
  if (movingTeams.length > 0) {
    const team = movingTeams[0];
    const etaResult = rescueSystem.calculateETA(team.id, team.route[team.route.length - 1], team.route);
    
    if (etaResult) {
      elevationGain = etaResult.elevationGain;
      elevationLoss = etaResult.elevationLoss;
      eta = etaResult.formattedETA;
      
      const riskResult = rescueSystem.calculateRouteRisk(team.route);
      risk = riskResult.overallRisk.toFixed(1);
    }
  }

  document.getElementById('stat-elevation-gain').textContent = `${elevationGain} m`;
  document.getElementById('stat-elevation-loss').textContent = `${elevationLoss} m`;
  document.getElementById('stat-eta').textContent = eta;
  document.getElementById('stat-risk').textContent = risk;
}

function handleAutoAssign() {
  const pendingAlarms = Array.from(rescueSystem.alarms.values()).filter(a => a.status === 'pending');
  
  if (pendingAlarms.length === 0) {
    showToast('没有待处理的报警', 'info');
    return;
  }

  const standbyTeams = Array.from(rescueSystem.teams.values()).filter(t => t.status === 'standby');
  if (standbyTeams.length === 0) {
    showToast('没有待命的救援队', 'warning');
    return;
  }

  let assigned = false;
  for (const alarm of pendingAlarms) {
    const result = rescueSystem.assignBestTeam(alarm.id);
    if (result) {
      showToast(`${result.team.name} 已分配到报警 ${alarm.id}，预计 ${result.eta.formattedETA} 到达`, 'success');
      assigned = true;
      break;
    }
  }

  if (!assigned) {
    showToast('无法分配队伍，请检查路径是否可用', 'warning');
  }

  renderAll();
  console.log('📋 自动分配结果:', rescueSystem.getSystemStatus());
}

function handleGenerateReport() {
  const assignedAlarms = Array.from(rescueSystem.alarms.values()).filter(a => a.status === 'assigned');
  
  if (assignedAlarms.length === 0) {
    showToast('没有已分配的报警，请先分配队伍', 'warning');
    return;
  }

  const alarm = assignedAlarms[0];
  const report = rescueSystem.generateRouteReport(alarm.id);
  
  if (!report) {
    showToast('无法生成报告', 'error');
    return;
  }

  renderReport(report);
  renderElevationProfile(report.elevationProfile);
  showToast('路线报告已生成', 'success');
  console.log('📄 路线报告:', report);
}

function renderReport(report) {
  const container = document.getElementById('report-container');
  
  let recommendationsHtml = '';
  if (report.recommendations.length > 0) {
    report.recommendations.forEach(rec => {
      recommendationsHtml += `<div class="recommendation ${rec.level}">${rec.level === 'danger' ? '⚠️' : rec.level === 'warning' ? '⚡' : 'ℹ️'} ${rec.message}</div>`;
    });
  } else {
    recommendationsHtml = '<p style="color:#4ecdc4;">✅ 路线状况良好，无特殊建议</p>';
  }

  container.innerHTML = `
    <div class="report-section">
      <h3>📊 基本信息</h3>
      <p><strong>报警ID:</strong> ${report.alarmId}</p>
      <p><strong>执行队伍:</strong> ${report.teamName}</p>
      <p><strong>途经节点:</strong> ${report.route.join(' → ')}</p>
    </div>
    
    <div class="report-section">
      <h3>⏱️ 预计时间</h3>
      <p><strong>总时间:</strong> ${report.eta.formattedETA}</p>
      <p>基础时间: ${report.eta.baseTime.toFixed(1)} 分钟</p>
      <p>高差惩罚: +${report.eta.elevationPenalty.toFixed(1)} 分钟</p>
      <p>风险惩罚: +${report.eta.riskPenalty.toFixed(1)} 分钟</p>
    </div>
    
    <div class="report-section">
      <h3>⛰️ 高差信息</h3>
      <p><strong>总爬升:</strong> ${report.eta.elevationGain} m</p>
      <p><strong>总下降:</strong> ${report.eta.elevationLoss} m</p>
      <p><strong>总距离:</strong> ${report.eta.distance.toFixed(0)} 单位</p>
    </div>
    
    <div class="report-section">
      <h3>⚠️ 风险评估</h3>
      <p><strong>平均风险:</strong> ${report.risk.averageRisk.toFixed(1)}</p>
      <p><strong>最高风险:</strong> ${report.risk.maxRisk}</p>
      <p><strong>综合风险:</strong> ${report.risk.overallRisk.toFixed(1)}</p>
    </div>
    
    <div class="report-section">
      <h3>💡 行动建议</h3>
      ${recommendationsHtml}
    </div>
  `;
}

function renderElevationProfile(profile) {
  const canvas = document.getElementById('elevation-canvas');
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!profile || profile.length < 2) return;

  const padding = 40;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;

  const elevations = profile.map(p => p.elevation);
  const minElev = Math.min(...elevations) - 50;
  const maxElev = Math.max(...elevations) + 50;
  const range = maxElev - minElev;

  ctx.fillStyle = '#16213e';
  ctx.fillRect(padding, padding, chartWidth, chartHeight);

  ctx.strokeStyle = '#2a2a4e';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
    
    const elev = maxElev - (range / 5) * i;
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.fillText(`${Math.round(elev)}m`, 5, y + 3);
  }

  const pointSpacing = chartWidth / (profile.length - 1);
  
  ctx.beginPath();
  ctx.moveTo(padding, padding + chartHeight - ((profile[0].elevation - minElev) / range) * chartHeight);
  
  for (let i = 1; i < profile.length; i++) {
    const x = padding + pointSpacing * i;
    const y = padding + chartHeight - ((profile[i].elevation - minElev) / range) * chartHeight;
    ctx.lineTo(x, y);
  }
  
  ctx.strokeStyle = '#4ecdc4';
  ctx.lineWidth = 3;
  ctx.stroke();

  profile.forEach((point, i) => {
    const x = padding + pointSpacing * i;
    const y = padding + chartHeight - ((point.elevation - minElev) / range) * chartHeight;
    
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e94560';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#aaa';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(point.name, x, padding + chartHeight + 15);
  });

  ctx.fillStyle = '#4ecdc4';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('海拔剖面图', canvas.width / 2, 15);
}

function handleMarkRisk() {
  const nodeId = document.getElementById('risk-node-select').value;
  const riskLevel = parseInt(document.getElementById('risk-level-range').value);
  
  if (!nodeId) {
    showToast('请先选择节点', 'warning');
    return;
  }

  rescueSystem.markNodeRisk(nodeId, riskLevel);
  showToast(`节点 ${nodeId} 风险等级已更新为 ${riskLevel}`, 'success');
  renderAll();
  
  const node = rescueSystem.pathManager.getNode(nodeId);
  if (node) showNodeDetails(node);
}

function testNoPathScenario() {
  rescueSystem.teams.forEach(team => {
    team.currentNodeId = 'N1';
    team.displayX = 50;
    team.displayY = 450;
  });

  const result = rescueSystem.pathManager.findShortestPath('N1', 'INVALID_NODE');
  showToast(result === null ? '✅ 正确: 无效节点返回 null' : '❌ 错误: 应返回 null', 
            result === null ? 'success' : 'error');
  console.log('🧪 测试无路径情况 - 结果:', result);
}

function testNoTeamsScenario() {
  const originalTeams = new Map(rescueSystem.teams);
  rescueSystem.teams.forEach(team => team.status = 'moving');
  
  const result = rescueSystem.assignBestTeam('ALARM_001');
  const success = result === null;
  
  showToast(success ? '✅ 正确: 无待命队伍返回 null' : '❌ 错误: 应返回 null', 
            success ? 'success' : 'error');
  console.log('🧪 测试无待命队伍情况 - 结果:', result);
  
  rescueSystem.teams = originalTeams;
}

function testInvalidNodeScenario() {
  const result = rescueSystem.calculateETA('TEAM_A', 'INVALID_NODE');
  const success = result === null;
  
  showToast(success ? '✅ 正确: 无效目标节点返回 null' : '❌ 错误: 应返回 null', 
            success ? 'success' : 'error');
  console.log('🧪 测试无效节点情况 - 结果:', result);
}

function resetAllData() {
  rescueSystem = new RescueSystem();
  rescueSystem.initialize(lastSampleData);
  initializeTeamsDisplayPositions();
  selectedAlarmId = null;
  selectedTeamId = null;
  renderAll();
  showToast('所有数据已重置', 'info');
  console.log('🔄 数据已重置，当前状态:', rescueSystem.getSystemStatus());
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

document.addEventListener('DOMContentLoaded', initApp);
