const AppState = {
  mode: 'replay',
  isConnected: false,
  ws: null,
  wsReconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  
  playbackState: 'stopped',
  currentFrame: null,
  currentFrameIndex: 0,
  totalFrames: 0,
  playbackSpeed: 1,
  isLooping: false,
  
  timeRange: { start: 0, end: 0, duration: 0 },
  currentTimestamp: 0,
  startTime: 0,
  
  telemetryData: [],
  commandData: [],
  trackData: null,
  stateChanges: [],
  emergencyStops: [],
  latencyStats: null,
  tags: [],
  events: [],
  
  selectedTagColor: '#3498db'
};

const elements = {};

function init() {
  cacheElements();
  bindEvents();
  loadSampleData();
  updateUI();
}

function cacheElements() {
  elements.modeReplay = document.getElementById('mode-replay');
  elements.modeRealtime = document.getElementById('mode-realtime');
  elements.connectionStatus = document.getElementById('connection-status');
  elements.statusDot = elements.connectionStatus.querySelector('.status-dot');
  elements.statusText = elements.connectionStatus.querySelector('.status-text');
  
  elements.loadJsonl = document.getElementById('load-jsonl');
  elements.loadCsv = document.getElementById('load-csv');
  elements.loadYaml = document.getElementById('load-yaml');
  elements.loadSample = document.getElementById('load-sample');
  elements.clearData = document.getElementById('clear-data');
  
  elements.saveSession = document.getElementById('save-session');
  elements.loadSession = document.getElementById('load-session');
  elements.sessionList = document.getElementById('session-list');
  
  elements.exportMarkdown = document.getElementById('export-markdown');
  elements.exportCsv = document.getElementById('export-csv');
  elements.exportJson = document.getElementById('export-json');
  
  elements.currentState = document.getElementById('current-state');
  elements.runtime = document.getElementById('runtime');
  elements.frameCount = document.getElementById('frame-count');
  elements.playbackSpeedDisplay = document.getElementById('playback-speed');
  
  elements.stepBack = document.getElementById('step-back');
  elements.playPause = document.getElementById('play-pause');
  elements.stepForward = document.getElementById('step-forward');
  elements.speedButtons = document.querySelectorAll('.speed-btn');
  elements.loopPlayback = document.getElementById('loop-playback');
  
  elements.timelineStart = document.getElementById('timeline-start');
  elements.timelineEnd = document.getElementById('timeline-end');
  elements.timelineTrack = document.getElementById('timeline-track');
  elements.timelineProgress = document.getElementById('timeline-progress');
  elements.timelineCursor = document.getElementById('timeline-cursor');
  elements.timelineMarkers = document.getElementById('timeline-markers');
  elements.timelineRuler = document.getElementById('timeline-ruler');
  
  elements.stateMachine = document.getElementById('state-machine');
  elements.historyList = document.getElementById('history-list');
  elements.eventsList = document.getElementById('events-list');
  
  elements.latencyAvg = document.getElementById('latency-avg');
  elements.latencyMax = document.getElementById('latency-max');
  elements.latencyMin = document.getElementById('latency-min');
  elements.sensorAvg = document.getElementById('sensor-avg');
  elements.sensorMax = document.getElementById('sensor-max');
  elements.sensorMin = document.getElementById('sensor-min');
  elements.warningsList = document.getElementById('warnings-list');
  
  elements.telemetryPosition = document.getElementById('telemetry-position');
  elements.telemetryVelocity = document.getElementById('telemetry-velocity');
  elements.telemetryBattery = document.getElementById('telemetry-battery');
  elements.telemetryEstop = document.getElementById('telemetry-estop');
  elements.telemetryTimestamp = document.getElementById('telemetry-timestamp');
  
  elements.tagModal = document.getElementById('tag-modal');
  elements.tagName = document.getElementById('tag-name');
  elements.tagDescription = document.getElementById('tag-description');
  elements.tagTimestamp = document.getElementById('tag-timestamp');
  elements.colorPicker = document.getElementById('color-picker');
  elements.modalClose = document.getElementById('modal-close');
  elements.modalCancel = document.getElementById('modal-cancel');
  elements.modalSave = document.getElementById('modal-save');
  
  elements.addTag = document.getElementById('add-tag');
  elements.notification = document.getElementById('notification');
  elements.notificationIcon = document.getElementById('notification-icon');
  elements.notificationMessage = document.getElementById('notification-message');
}

function bindEvents() {
  elements.modeReplay.addEventListener('click', () => setMode('replay'));
  elements.modeRealtime.addEventListener('click', () => setMode('realtime'));
  
  elements.loadJsonl.addEventListener('change', handleFileLoad);
  elements.loadCsv.addEventListener('change', handleFileLoad);
  elements.loadYaml.addEventListener('change', handleFileLoad);
  elements.loadSample.addEventListener('click', loadSampleData);
  elements.clearData.addEventListener('click', clearData);
  
  elements.saveSession.addEventListener('click', saveSession);
  elements.loadSession.addEventListener('click', loadSession);
  
  elements.exportMarkdown.addEventListener('click', () => exportReport('markdown'));
  elements.exportCsv.addEventListener('click', () => exportReport('csv'));
  elements.exportJson.addEventListener('click', () => exportReport('json'));
  
  elements.stepBack.addEventListener('click', stepBackward);
  elements.playPause.addEventListener('click', togglePlayPause);
  elements.stepForward.addEventListener('click', stepForward);
  
  elements.speedButtons.forEach(btn => {
    btn.addEventListener('click', () => setPlaybackSpeed(parseFloat(btn.dataset.speed)));
  });
  
  elements.loopPlayback.addEventListener('change', toggleLoop);
  
  elements.timelineTrack.addEventListener('click', handleTimelineClick);
  
  elements.addTag.addEventListener('click', openTagModal);
  elements.modalClose.addEventListener('click', closeTagModal);
  elements.modalCancel.addEventListener('click', closeTagModal);
  elements.modalSave.addEventListener('click', saveTag);
  
  elements.colorPicker.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => selectColor(option.dataset.color));
  });
}

function setMode(mode) {
  AppState.mode = mode;
  
  elements.modeReplay.classList.toggle('active', mode === 'replay');
  elements.modeRealtime.classList.toggle('active', mode === 'realtime');
  
  if (mode === 'realtime') {
    connectWebSocket();
  } else {
    disconnectWebSocket();
  }
  
  updateConnectionStatus();
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/realtime`;
  
  if (AppState.ws) {
    AppState.ws.close();
  }
  
  try {
    AppState.ws = new WebSocket(wsUrl);
    
    AppState.ws.onopen = () => {
      AppState.isConnected = true;
      AppState.wsReconnectAttempts = 0;
      updateConnectionStatus();
      showNotification('已连接到实时遥测服务', 'success');
    };
    
    AppState.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };
    
    AppState.ws.onclose = () => {
      AppState.isConnected = false;
      updateConnectionStatus();
      
      if (AppState.mode === 'realtime' && AppState.wsReconnectAttempts < AppState.maxReconnectAttempts) {
        AppState.wsReconnectAttempts++;
        showNotification(`连接断开，正在重连... (${AppState.wsReconnectAttempts}/${AppState.maxReconnectAttempts})`, 'warning');
        setTimeout(connectWebSocket, AppState.reconnectDelay);
      }
    };
    
    AppState.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      showNotification('WebSocket 连接错误', 'error');
    };
  } catch (e) {
    console.error('Failed to create WebSocket:', e);
  }
}

function disconnectWebSocket() {
  if (AppState.ws) {
    AppState.ws.close();
    AppState.ws = null;
  }
  AppState.isConnected = false;
}

function handleWebSocketMessage(message) {
  if (message.type === 'telemetry') {
    handleTelemetryFrame(message);
  } else if (message.type === 'event') {
    handleEvent(message);
  } else if (message.type === 'info') {
    console.log('Info:', message.info);
  }
}

function handleTelemetryFrame(frame) {
  AppState.telemetryData.push(frame);
  AppState.currentFrame = frame;
  AppState.currentTimestamp = frame.timestamp;
  
  if (AppState.telemetryData.length === 1) {
    AppState.timeRange.start = frame.timestamp;
    AppState.startTime = frame.timestamp;
  }
  AppState.timeRange.end = frame.timestamp;
  AppState.timeRange.duration = AppState.timeRange.end - AppState.timeRange.start;
  AppState.totalFrames = AppState.telemetryData.length;
  AppState.currentFrameIndex = AppState.telemetryData.length - 1;
  
  if (AppState.currentFrameIndex > 0) {
    const prevFrame = AppState.telemetryData[AppState.currentFrameIndex - 1];
    if (prevFrame.data?.state !== frame.data?.state) {
      AppState.stateChanges.push({
        timestamp: frame.timestamp,
        from_state: prevFrame.data?.state,
        to_state: frame.data?.state
      });
      addEvent('state-change', {
        title: '状态变化',
        description: `${prevFrame.data?.state || '-'} → ${frame.data?.state || '-'}`,
        timestamp: frame.timestamp
      });
    }
  }
  
  if (frame.data?.emergency_stop) {
    AppState.emergencyStops.push({
      timestamp: frame.timestamp,
      state: frame.data?.state,
      position: frame.data?.position
    });
    addEvent('emergency', {
      title: '⚠️ 急停事件',
      description: '检测到紧急停止信号',
      timestamp: frame.timestamp
    });
  }
  
  updateUI();
}

function handleEvent(event) {
  const eventType = event.event_type;
  let eventClass = 'tag';
  
  switch (eventType) {
    case 'EMERGENCY_STOP':
      eventClass = 'emergency';
      break;
    case 'STATE_CHANGE':
      eventClass = 'state-change';
      break;
    case 'LATENCY_WARNING':
      eventClass = 'latency';
      break;
  }
  
  addEvent(eventClass, {
    title: eventType.replace(/_/g, ' '),
    description: JSON.stringify(event.details),
    timestamp: event.timestamp
  });
}

function handleFileLoad(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const type = event.target.id.replace('load-', '');
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const content = e.target.result;
    
    try {
      switch (type) {
        case 'jsonl':
          parseJsonlContent(content);
          break;
        case 'csv':
          parseCsvContent(content);
          break;
        case 'yaml':
          parseYamlContent(content);
          break;
      }
      showNotification(`成功加载 ${file.name}`, 'success');
    } catch (err) {
      showNotification(`解析文件失败: ${err.message}`, 'error');
    }
  };
  
  reader.readAsText(file);
}

function parseJsonlContent(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const frames = [];
  
  lines.forEach((line, index) => {
    try {
      const data = JSON.parse(line);
      frames.push({
        timestamp: data.timestamp || Date.now() + index * 100,
        sequence: data.sequence || index,
        data: data,
        latency: data.latency
      });
    } catch (e) {
      console.warn(`Line ${index + 1} parse error:`, e);
    }
  });
  
  if (frames.length > 0) {
    AppState.telemetryData = frames.sort((a, b) => a.timestamp - b.timestamp);
    AppState.totalFrames = frames.length;
    AppState.timeRange = {
      start: frames[0].timestamp,
      end: frames[frames.length - 1].timestamp,
      duration: frames[frames.length - 1].timestamp - frames[0].timestamp
    };
    AppState.startTime = frames[0].timestamp;
    AppState.currentFrameIndex = 0;
    AppState.currentFrame = frames[0];
    AppState.currentTimestamp = frames[0].timestamp;
    
    analyzeTelemetryData();
    updateUI();
  }
}

function parseCsvContent(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return;
  
  const headers = lines[0].split(',').map(h => h.trim());
  const commands = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const cmd = {};
    
    headers.forEach((header, idx) => {
      const value = values[idx];
      if (['timestamp', 'sequence', 'linear_vel', 'angular_vel'].includes(header)) {
        cmd[header] = Number(value);
      } else {
        cmd[header] = value;
      }
    });
    
    commands.push(cmd);
  }
  
  AppState.commandData = commands;
  showNotification(`加载了 ${commands.length} 条控制指令`, 'success');
}

function parseYamlContent(content) {
  try {
    const YAML = {
      parse: (str) => {
        const result = {};
        const lines = str.split(/\r?\n/);
        let currentKey = null;
        let indentLevel = 0;
        
        lines.forEach(line => {
          if (!line.trim() || line.trim().startsWith('#')) return;
          
          const indent = line.search(/\S/);
          const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
          
          if (match) {
            const key = match[2].trim();
            const value = match[3].trim();
            
            if (value) {
              if (value === 'true') result[key] = true;
              else if (value === 'false') result[key] = false;
              else if (!isNaN(Number(value))) result[key] = Number(value);
              else if (value.startsWith('"') && value.endsWith('"')) result[key] = value.slice(1, -1);
              else result[key] = value;
            } else {
              result[key] = [];
            }
          }
        });
        
        return result;
      }
    };
    
    AppState.trackData = YAML.parse(content);
    showNotification('赛道数据已加载', 'success');
  } catch (e) {
    console.error('YAML parse error:', e);
    showNotification('YAML 解析失败', 'error');
  }
}

function loadSampleData() {
  const baseTime = Date.now() - 60000;
  const frames = [];
  const states = ['IDLE', 'INITIALIZING', 'RUNNING', 'PAUSED', 'RUNNING', 'COMPLETED'];
  let stateIndex = 0;
  
  for (let i = 0; i < 100; i++) {
    const timestamp = baseTime + i * 500;
    
    if (i % 20 === 0 && stateIndex < states.length - 1) {
      stateIndex++;
    }
    
    const x = Math.sin(i * 0.1) * 10 + i * 0.5;
    const y = Math.cos(i * 0.1) * 5;
    const theta = i * 0.05;
    
    const isEmergency = i === 45 || i === 75;
    
    frames.push({
      timestamp,
      sequence: i,
      data: {
        state: states[stateIndex],
        position: { x, y, theta },
        velocity: { linear: stateIndex >= 2 ? 2.5 : 0, angular: Math.sin(i * 0.2) * 0.5 },
        battery: 12.5 - i * 0.01,
        emergency_stop: isEmergency,
        sensors: { lidar: Array(36).fill(5 + Math.random() * 2) }
      },
      latency: {
        command_ack: 10 + Math.random() * 20,
        sensor_update: 5 + Math.random() * 10
      }
    });
  }
  
  AppState.telemetryData = frames;
  AppState.totalFrames = frames.length;
  AppState.timeRange = {
    start: frames[0].timestamp,
    end: frames[frames.length - 1].timestamp,
    duration: frames[frames.length - 1].timestamp - frames[0].timestamp
  };
  AppState.startTime = frames[0].timestamp;
  AppState.currentFrameIndex = 0;
  AppState.currentFrame = frames[0];
  AppState.currentTimestamp = frames[0].timestamp;
  
  AppState.commandData = [
    { timestamp: baseTime + 1000, sequence: 1, command_type: 'START', status: 'ACKNOWLEDGED' },
    { timestamp: baseTime + 5000, sequence: 2, command_type: 'VELOCITY', linear_vel: 2.5, angular_vel: 0, status: 'COMPLETED' },
    { timestamp: baseTime + 15000, sequence: 3, command_type: 'PAUSE', status: 'ACKNOWLEDGED' },
    { timestamp: baseTime + 25000, sequence: 4, command_type: 'RESUME', status: 'COMPLETED' }
  ];
  
  AppState.tags = [
    { id: 'tag_1', timestamp: baseTime + 10000, name: '比赛开始', description: '机器人启动', color: '#3498db' },
    { id: 'tag_2', timestamp: baseTime + 30000, name: '第一个弯道', description: '左转弯', color: '#2ecc71' },
    { id: 'tag_3', timestamp: baseTime + 45000, name: '⚠️ 急停测试', description: '检测到障碍物', color: '#e74c3c' }
  ];
  
  analyzeTelemetryData();
  updateUI();
  showNotification('示例数据已加载', 'success');
}

function analyzeTelemetryData() {
  AppState.stateChanges = [];
  AppState.emergencyStops = [];
  AppState.events = [];
  
  for (let i = 1; i < AppState.telemetryData.length; i++) {
    const prev = AppState.telemetryData[i - 1].data;
    const curr = AppState.telemetryData[i].data;
    const frame = AppState.telemetryData[i];
    
    if (prev.state !== curr.state) {
      AppState.stateChanges.push({
        timestamp: frame.timestamp,
        from_state: prev.state,
        to_state: curr.state
      });
      addEvent('state-change', {
        title: '状态变化',
        description: `${prev.state} → ${curr.state}`,
        timestamp: frame.timestamp
      });
    }
    
    if (curr.emergency_stop && !prev.emergency_stop) {
      AppState.emergencyStops.push({
        timestamp: frame.timestamp,
        state: curr.state,
        position: curr.position
      });
      addEvent('emergency', {
        title: '⚠️ 急停事件',
        description: '检测到紧急停止信号',
        timestamp: frame.timestamp
      });
    }
  }
  
  AppState.tags.forEach(tag => {
    addEvent('tag', {
      title: tag.name,
      description: tag.description,
      timestamp: tag.timestamp,
      color: tag.color
    });
  });
  
  calculateLatencyStats();
}

function calculateLatencyStats() {
  const commandAckLatencies = [];
  const sensorUpdateLatencies = [];
  
  AppState.telemetryData.forEach((frame, i) => {
    if (frame.latency) {
      if (frame.latency.command_ack !== undefined) {
        commandAckLatencies.push(frame.latency.command_ack);
      }
      if (frame.latency.sensor_update !== undefined) {
        sensorUpdateLatencies.push(frame.latency.sensor_update);
      }
    }
    
    if (i > 0) {
      const gap = frame.timestamp - AppState.telemetryData[i - 1].timestamp;
      if (gap > 1000) {
        addEvent('latency', {
          title: '传感器数据间隔异常',
          description: `检测到 ${gap}ms 的数据间隔`,
          timestamp: frame.timestamp
        });
      }
    }
  });
  
  const stats = {
    command_ack: {
      avg: commandAckLatencies.length > 0 ? commandAckLatencies.reduce((a, b) => a + b, 0) / commandAckLatencies.length : 0,
      max: commandAckLatencies.length > 0 ? Math.max(...commandAckLatencies) : 0,
      min: commandAckLatencies.length > 0 ? Math.min(...commandAckLatencies) : 0
    },
    sensor_update: {
      avg: sensorUpdateLatencies.length > 0 ? sensorUpdateLatencies.reduce((a, b) => a + b, 0) / sensorUpdateLatencies.length : 0,
      max: sensorUpdateLatencies.length > 0 ? Math.max(...sensorUpdateLatencies) : 0,
      min: sensorUpdateLatencies.length > 0 ? Math.min(...sensorUpdateLatencies) : 0
    },
    warnings: []
  };
  
  AppState.latencyStats = stats;
}

function addEvent(type, eventData) {
  AppState.events.push({
    type,
    ...eventData
  });
}

function clearData() {
  AppState.telemetryData = [];
  AppState.commandData = [];
  AppState.trackData = null;
  AppState.stateChanges = [];
  AppState.emergencyStops = [];
  AppState.latencyStats = null;
  AppState.tags = [];
  AppState.events = [];
  AppState.totalFrames = 0;
  AppState.currentFrameIndex = 0;
  AppState.currentFrame = null;
  AppState.currentTimestamp = 0;
  AppState.timeRange = { start: 0, end: 0, duration: 0 };
  AppState.playbackState = 'stopped';
  
  updateUI();
  showNotification('数据已清空', 'info');
}

function togglePlayPause() {
  if (AppState.playbackState === 'playing') {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (AppState.telemetryData.length === 0) {
    showNotification('没有可播放的数据', 'warning');
    return;
  }
  
  AppState.playbackState = 'playing';
  elements.playPause.textContent = '⏸️';
  
  playbackLoop();
}

function pausePlayback() {
  AppState.playbackState = 'paused';
  elements.playPause.textContent = '▶️';
}

function stepForward() {
  if (AppState.currentFrameIndex < AppState.totalFrames - 1) {
    AppState.currentFrameIndex++;
    updateCurrentFrame();
  }
}

function stepBackward() {
  if (AppState.currentFrameIndex > 0) {
    AppState.currentFrameIndex--;
    updateCurrentFrame();
  }
}

function setPlaybackSpeed(speed) {
  AppState.playbackSpeed = speed;
  
  elements.speedButtons.forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
  });
  
  elements.playbackSpeedDisplay.textContent = `${speed}x`;
}

function toggleLoop() {
  AppState.isLooping = elements.loopPlayback.checked;
}

function playbackLoop() {
  if (AppState.playbackState !== 'playing') return;
  
  const frameInterval = 500 / AppState.playbackSpeed;
  
  setTimeout(() => {
    if (AppState.currentFrameIndex < AppState.totalFrames - 1) {
      AppState.currentFrameIndex++;
      updateCurrentFrame();
      playbackLoop();
    } else {
      if (AppState.isLooping) {
        AppState.currentFrameIndex = 0;
        updateCurrentFrame();
        playbackLoop();
      } else {
        pausePlayback();
      }
    }
  }, frameInterval);
}

function updateCurrentFrame() {
  AppState.currentFrame = AppState.telemetryData[AppState.currentFrameIndex];
  AppState.currentTimestamp = AppState.currentFrame.timestamp;
  updateUI();
}

function handleTimelineClick(event) {
  if (AppState.totalFrames === 0) return;
  
  const rect = elements.timelineTrack.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percentage = x / rect.width;
  const targetTimestamp = AppState.timeRange.start + percentage * AppState.timeRange.duration;
  
  let closestIndex = 0;
  let closestDiff = Infinity;
  
  AppState.telemetryData.forEach((frame, idx) => {
    const diff = Math.abs(frame.timestamp - targetTimestamp);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = idx;
    }
  });
  
  AppState.currentFrameIndex = closestIndex;
  updateCurrentFrame();
}

function openTagModal() {
  elements.tagTimestamp.value = formatTimestamp(AppState.currentTimestamp);
  elements.tagName.value = '';
  elements.tagDescription.value = '';
  selectColor('#3498db');
  elements.tagModal.classList.remove('hidden');
}

function closeTagModal() {
  elements.tagModal.classList.add('hidden');
}

function selectColor(color) {
  AppState.selectedTagColor = color;
  
  elements.colorPicker.querySelectorAll('.color-option').forEach(option => {
    option.classList.toggle('active', option.dataset.color === color);
  });
}

function saveTag() {
  const name = elements.tagName.value.trim();
  if (!name) {
    showNotification('请输入标签名称', 'warning');
    return;
  }
  
  const tag = {
    id: `tag_${Date.now()}`,
    timestamp: AppState.currentTimestamp,
    name,
    description: elements.tagDescription.value.trim(),
    color: AppState.selectedTagColor
  };
  
  AppState.tags.push(tag);
  addEvent('tag', {
    title: tag.name,
    description: tag.description,
    timestamp: tag.timestamp,
    color: tag.color
  });
  
  updateUI();
  closeTagModal();
  showNotification('标签已保存', 'success');
}

function updateUI() {
  updateConnectionStatus();
  updateStatusPanel();
  updateTimeline();
  updateStateMachine();
  updateEventsList();
  updateLatencyStats();
  updateTelemetryDetails();
}

function updateConnectionStatus() {
  if (AppState.mode === 'realtime') {
    elements.statusDot.className = 'status-dot';
    if (AppState.isConnected) {
      elements.statusDot.classList.add('connected');
      elements.statusText.textContent = '已连接';
    } else {
      elements.statusDot.classList.add('connecting');
      elements.statusText.textContent = '连接中...';
    }
  } else {
    elements.statusDot.className = 'status-dot disconnected';
    elements.statusText.textContent = '回放模式';
  }
}

function updateStatusPanel() {
  if (AppState.currentFrame?.data?.state) {
    const state = AppState.currentFrame.data.state;
    elements.currentState.textContent = state;
    elements.currentState.className = 'status-value';
    
    const stateClass = `state-${state.toLowerCase().replace(/_/g, '-')}`;
    elements.currentState.classList.add(stateClass);
  } else {
    elements.currentState.textContent = '--';
    elements.currentState.className = 'status-value state-idle';
  }
  
  const runtime = AppState.currentTimestamp - AppState.startTime;
  elements.runtime.textContent = formatDuration(Math.max(0, runtime));
  
  elements.frameCount.textContent = `${AppState.currentFrameIndex + 1} / ${AppState.totalFrames}`;
}

function updateTimeline() {
  if (AppState.totalFrames === 0) {
    elements.timelineStart.textContent = '--:--:--';
    elements.timelineEnd.textContent = '--:--:--';
    elements.timelineProgress.style.width = '0%';
    elements.timelineCursor.style.left = '0px';
    elements.timelineMarkers.innerHTML = '';
    elements.timelineRuler.innerHTML = '';
    return;
  }
  
  elements.timelineStart.textContent = formatTime(AppState.timeRange.start);
  elements.timelineEnd.textContent = formatTime(AppState.timeRange.end);
  
  const progress = (AppState.currentTimestamp - AppState.timeRange.start) / AppState.timeRange.duration * 100;
  elements.timelineProgress.style.width = `${progress}%`;
  elements.timelineCursor.style.left = `calc(${progress}% - 6px)`;
  
  elements.timelineMarkers.innerHTML = '';
  const trackWidth = elements.timelineTrack.offsetWidth || 1000;
  
  AppState.events.forEach(event => {
    const eventProgress = (event.timestamp - AppState.timeRange.start) / AppState.timeRange.duration * 100;
    const marker = document.createElement('div');
    marker.className = `event-marker ${event.type}`;
    marker.style.left = `calc(${eventProgress}% - 5px)`;
    marker.title = `${event.title} - ${formatTime(event.timestamp)}`;
    elements.timelineMarkers.appendChild(marker);
  });
  
  updateTimelineRuler();
}

function updateTimelineRuler() {
  elements.timelineRuler.innerHTML = '';
  
  const duration = AppState.timeRange.duration;
  const majorInterval = Math.ceil(duration / 5 / 1000) * 1000;
  const trackWidth = elements.timelineTrack.offsetWidth || 1000;
  
  for (let ts = 0; ts <= duration; ts += majorInterval) {
    const timestamp = AppState.timeRange.start + ts;
    const progress = ts / duration * 100;
    
    const tick = document.createElement('div');
    tick.className = 'ruler-tick major';
    tick.style.left = `${progress}%`;
    elements.timelineRuler.appendChild(tick);
    
    const label = document.createElement('div');
    label.className = 'ruler-label';
    label.style.left = `${progress}%`;
    label.textContent = formatTimeShort(ts);
    elements.timelineRuler.appendChild(label);
  }
}

function updateStateMachine() {
  const currentState = AppState.currentFrame?.data?.state;
  
  elements.stateMachine.querySelectorAll('.state-node').forEach(node => {
    const nodeState = node.dataset.state;
    node.classList.toggle('active', nodeState === currentState);
  });
  
  elements.historyList.innerHTML = '';
  const recentChanges = AppState.stateChanges.slice(-5);
  
  recentChanges.forEach(change => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <span class="history-time">${formatTime(change.timestamp)}</span>
      <span class="history-arrow">→</span>
      <span>${change.from_state} → ${change.to_state}</span>
    `;
    elements.historyList.appendChild(item);
  });
}

function updateEventsList() {
  if (AppState.events.length === 0) {
    elements.eventsList.innerHTML = '<div class="events-empty">暂无事件数据</div>';
    return;
  }
  
  elements.eventsList.innerHTML = '';
  const sortedEvents = [...AppState.events].sort((a, b) => b.timestamp - a.timestamp);
  
  sortedEvents.forEach(event => {
    const item = document.createElement('div');
    item.className = `event-item ${event.type}`;
    
    let icon = '📌';
    switch (event.type) {
      case 'emergency': icon = '🚨'; break;
      case 'state-change': icon = '🔄'; break;
      case 'latency': icon = '⏱️'; break;
    }
    
    item.innerHTML = `
      <span class="event-icon">${icon}</span>
      <div class="event-content">
        <div class="event-title">${event.title}</div>
        <div class="event-description">${event.description}</div>
      </div>
      <span class="event-time">${formatTime(event.timestamp)}</span>
    `;
    elements.eventsList.appendChild(item);
  });
}

function updateLatencyStats() {
  if (!AppState.latencyStats) {
    elements.latencyAvg.textContent = '-- ms';
    elements.latencyMax.textContent = '-- ms';
    elements.latencyMin.textContent = '-- ms';
    elements.sensorAvg.textContent = '-- ms';
    elements.sensorMax.textContent = '-- ms';
    elements.sensorMin.textContent = '-- ms';
    elements.warningsList.innerHTML = '';
    return;
  }
  
  const cmd = AppState.latencyStats.command_ack;
  const sensor = AppState.latencyStats.sensor_update;
  
  elements.latencyAvg.textContent = `${cmd.avg.toFixed(1)} ms`;
  elements.latencyMax.textContent = `${cmd.max} ms`;
  elements.latencyMin.textContent = `${cmd.min} ms`;
  elements.sensorAvg.textContent = `${sensor.avg.toFixed(1)} ms`;
  elements.sensorMax.textContent = `${sensor.max} ms`;
  elements.sensorMin.textContent = `${sensor.min} ms`;
  
  elements.warningsList.innerHTML = '';
}

function updateTelemetryDetails() {
  const frame = AppState.currentFrame;
  const data = frame?.data;
  
  if (!data) {
    elements.telemetryPosition.textContent = '--, --, --';
    elements.telemetryVelocity.textContent = '--, --';
    elements.telemetryBattery.textContent = '-- V';
    elements.telemetryEstop.textContent = '--';
    elements.telemetryTimestamp.textContent = '--';
    return;
  }
  
  const pos = data.position || {};
  const vel = data.velocity || {};
  
  elements.telemetryPosition.textContent = `${pos.x?.toFixed(2) || '--'}, ${pos.y?.toFixed(2) || '--'}, ${pos.theta?.toFixed(2) || '--'}`;
  elements.telemetryVelocity.textContent = `${vel.linear?.toFixed(2) || '--'}, ${vel.angular?.toFixed(2) || '--'}`;
  elements.telemetryBattery.textContent = `${data.battery?.toFixed(2) || '--'} V`;
  elements.telemetryEstop.textContent = data.emergency_stop ? '触发' : '正常';
  elements.telemetryEstop.style.color = data.emergency_stop ? 'var(--danger-color)' : 'var(--success-color)';
  elements.telemetryTimestamp.textContent = formatTimestamp(AppState.currentTimestamp);
}

function showNotification(message, type = 'info') {
  let icon = 'ℹ️';
  switch (type) {
    case 'success': icon = '✅'; break;
    case 'warning': icon = '⚠️'; break;
    case 'error': icon = '❌'; break;
  }
  
  elements.notificationIcon.textContent = icon;
  elements.notificationMessage.textContent = message;
  elements.notification.className = `notification ${type}`;
  
  setTimeout(() => {
    elements.notification.classList.add('hidden');
  }, 3000);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

function formatTimeShort(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toISOString();
}

async function saveSession() {
  const sessionName = prompt('请输入会话名称:', `会话 ${new Date().toLocaleString('zh-CN')}`);
  if (!sessionName) return;
  
  const session = {
    id: `session_${Date.now()}`,
    name: sessionName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: AppState.mode,
    tags: [...AppState.tags],
    telemetryData: AppState.telemetryData.slice(-1000),
    commandData: AppState.commandData,
    trackData: AppState.trackData,
    notes: ''
  };
  
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    
    if (response.ok) {
      showNotification('会话已保存', 'success');
    } else {
      const dataStr = JSON.stringify(session, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionName.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('会话已下载到本地', 'info');
    }
  } catch (e) {
    const dataStr = JSON.stringify(session, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('会话已下载到本地', 'info');
  }
}

async function loadSession() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const session = JSON.parse(ev.target.result);
        
        if (session.tags) AppState.tags = session.tags;
        if (session.telemetryData) {
          AppState.telemetryData = session.telemetryData;
          AppState.totalFrames = session.telemetryData.length;
          if (session.telemetryData.length > 0) {
            AppState.timeRange = {
              start: session.telemetryData[0].timestamp,
              end: session.telemetryData[session.telemetryData.length - 1].timestamp,
              duration: session.telemetryData[session.telemetryData.length - 1].timestamp - session.telemetryData[0].timestamp
            };
            AppState.startTime = session.telemetryData[0].timestamp;
            AppState.currentFrameIndex = 0;
            AppState.currentFrame = session.telemetryData[0];
            AppState.currentTimestamp = session.telemetryData[0].timestamp;
          }
        }
        if (session.commandData) AppState.commandData = session.commandData;
        if (session.trackData) AppState.trackData = session.trackData;
        if (session.mode) AppState.mode = session.mode;
        
        analyzeTelemetryData();
        updateUI();
        showNotification('会话已加载', 'success');
      } catch (err) {
        showNotification('会话解析失败', 'error');
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

async function exportReport(format) {
  if (AppState.telemetryData.length === 0 && AppState.tags.length === 0) {
    showNotification('没有可导出的数据', 'warning');
    return;
  }
  
  const exportData = {
    session: {
      name: '导出报告',
      exportedAt: new Date().toISOString()
    },
    telemetryData: AppState.telemetryData.slice(-1000),
    commandData: AppState.commandData,
    trackData: AppState.trackData,
    tags: AppState.tags,
    events: AppState.events,
    latencyStats: AppState.latencyStats,
    stateChanges: AppState.stateChanges,
    emergencyStops: AppState.emergencyStops
  };
  
  switch (format) {
    case 'markdown':
      exportMarkdown(exportData);
      break;
    case 'csv':
      exportCSV(exportData);
      break;
    case 'json':
      exportJSON(exportData);
      break;
  }
}

function exportMarkdown(data) {
  const lines = [];
  lines.push('# 赛道遥测复盘报告');
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## 概览');
  lines.push('');
  lines.push(`- **遥测帧数**: ${data.telemetryData?.length || 0}`);
  lines.push(`- **控制指令数**: ${data.commandData?.length || 0}`);
  lines.push(`- **标签数量**: ${data.tags?.length || 0}`);
  lines.push(`- **状态变化次数**: ${data.stateChanges?.length || 0}`);
  lines.push(`- **急停事件数**: ${data.emergencyStops?.length || 0}`);
  lines.push('');
  
  if (data.tags && data.tags.length > 0) {
    lines.push('## 复盘标签');
    lines.push('');
    lines.push('| 时间 | 名称 | 描述 |');
    lines.push('|------|------|------|');
    data.tags.forEach(tag => {
      lines.push(`| ${new Date(tag.timestamp).toLocaleTimeString()} | ${tag.name} | ${tag.description || '-'} |`);
    });
    lines.push('');
  }
  
  if (data.latencyStats) {
    lines.push('## 延迟统计');
    lines.push('');
    lines.push('### 指令确认延迟');
    lines.push(`- **平均**: ${data.latencyStats.command_ack?.avg?.toFixed(1) || '-'} ms`);
    lines.push(`- **最大**: ${data.latencyStats.command_ack?.max || '-'} ms`);
    lines.push(`- **最小**: ${data.latencyStats.command_ack?.min || '-'} ms`);
    lines.push('');
    lines.push('### 传感器更新间隔');
    lines.push(`- **平均**: ${data.latencyStats.sensor_update?.avg?.toFixed(1) || '-'} ms`);
    lines.push(`- **最大**: ${data.latencyStats.sensor_update?.max || '-'} ms`);
    lines.push(`- **最小**: ${data.latencyStats.sensor_update?.min || '-'} ms`);
    lines.push('');
  }
  
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report_${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('Markdown 报告已导出', 'success');
}

function exportCSV(data) {
  if (data.telemetryData && data.telemetryData.length > 0) {
    const headers = ['timestamp', 'sequence', 'state', 'position_x', 'position_y', 'position_theta', 'linear_vel', 'angular_vel', 'battery', 'emergency_stop'];
    const rows = [headers.join(',')];
    
    data.telemetryData.forEach(frame => {
      const d = frame.data || frame;
      const pos = d.position || {};
      const vel = d.velocity || {};
      const row = [
        frame.timestamp,
        frame.sequence || d.sequence || '',
        d.state || '',
        pos.x ?? '',
        pos.y ?? '',
        pos.theta ?? '',
        vel.linear ?? '',
        vel.angular ?? '',
        d.battery ?? '',
        d.emergency_stop ? 'true' : 'false'
      ];
      rows.push(row.map(v => {
        const str = String(v);
        if (str.includes(',') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','));
    });
    
    const content = rows.join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  if (data.tags && data.tags.length > 0) {
    const headers = ['id', 'timestamp', 'name', 'description', 'color'];
    const rows = [headers.join(',')];
    
    data.tags.forEach(tag => {
      rows.push([tag.id, tag.timestamp, tag.name, tag.description || '', tag.color].join(','));
    });
    
    const content = rows.join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tags_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  showNotification('CSV 数据已导出', 'success');
}

function exportJSON(data) {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('JSON 报告已导出', 'success');
}

document.addEventListener('DOMContentLoaded', init);
