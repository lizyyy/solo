const WebSocket = require('ws');
const { runAllRulesCheck } = require('./rulesEngine');

let wss = null;
let clients = [];
let ruleCheckInterval = null;

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws) => {
    console.log('新的 WebSocket 连接已建立');
    clients.push(ws);
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleClientMessage(ws, data);
      } catch (error) {
        console.error('解析 WebSocket 消息失败:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket 连接已关闭');
      clients = clients.filter(client => client !== ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket 错误:', error);
      clients = clients.filter(client => client !== ws);
    });
  });
  
  // 启动规则检查定时器
  startRuleCheckTimer();
  
  console.log('WebSocket 服务已初始化');
}

function handleClientMessage(ws, data) {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;
    case 'subscribe':
      // 客户端订阅特定数据更新
      sendInitialData(ws);
      break;
    case 'manual_check':
      // 手动触发规则检查
      runCheckAndBroadcast();
      break;
    default:
      console.log('收到未知消息类型:', data.type);
  }
}

async function sendInitialData(ws) {
  try {
    const ruleResults = await runAllRulesCheck();
    ws.send(JSON.stringify({
      type: 'rule_results',
      data: ruleResults
    }));
  } catch (error) {
    console.error('发送初始数据失败:', error);
  }
}

function broadcast(message) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcastPatientUpdate(patient, action) {
  broadcast({
    type: 'patient_update',
    action: action, // created, updated, deleted
    data: patient,
    timestamp: new Date().toISOString()
  });
}

function broadcastDepartmentUpdate(department, action) {
  broadcast({
    type: 'department_update',
    action: action,
    data: department,
    timestamp: new Date().toISOString()
  });
}

function broadcastBedUpdate(bed, action) {
  broadcast({
    type: 'bed_update',
    action: action,
    data: bed,
    timestamp: new Date().toISOString()
  });
}

function broadcastTransferUpdate(transfer, action) {
  broadcast({
    type: 'transfer_update',
    action: action,
    data: transfer,
    timestamp: new Date().toISOString()
  });
}

function broadcastAmbulanceUpdate(ambulance, action) {
  broadcast({
    type: 'ambulance_update',
    action: action,
    data: ambulance,
    timestamp: new Date().toISOString()
  });
}

function broadcastLogEntry(log) {
  broadcast({
    type: 'log_entry',
    data: log,
    timestamp: new Date().toISOString()
  });
}

function broadcastIncident(incident) {
  broadcast({
    type: 'incident',
    data: incident,
    timestamp: new Date().toISOString()
  });
}

async function runCheckAndBroadcast() {
  try {
    const results = await runAllRulesCheck();
    broadcast({
      type: 'rule_results',
      data: results,
      timestamp: new Date().toISOString()
    });
    return results;
  } catch (error) {
    console.error('规则检查失败:', error);
    return null;
  }
}

function startRuleCheckTimer(intervalMs = 30000) {
  if (ruleCheckInterval) {
    clearInterval(ruleCheckInterval);
  }
  
  ruleCheckInterval = setInterval(() => {
    runCheckAndBroadcast();
  }, intervalMs);
  
  console.log(`规则检查定时器已启动，间隔 ${intervalMs / 1000} 秒`);
}

function stopRuleCheckTimer() {
  if (ruleCheckInterval) {
    clearInterval(ruleCheckInterval);
    ruleCheckInterval = null;
    console.log('规则检查定时器已停止');
  }
}

function getConnectedClientsCount() {
  return clients.length;
}

function getWebSocketServer() {
  return wss;
}

module.exports = {
  initWebSocket,
  broadcast,
  broadcastPatientUpdate,
  broadcastDepartmentUpdate,
  broadcastBedUpdate,
  broadcastTransferUpdate,
  broadcastAmbulanceUpdate,
  broadcastLogEntry,
  broadcastIncident,
  runCheckAndBroadcast,
  startRuleCheckTimer,
  stopRuleCheckTimer,
  getConnectedClientsCount,
  getWebSocketServer
};
