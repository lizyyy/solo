import { DataParser } from './modules/parser.js';
import { GeoCalculator } from './modules/geo.js';
import { ReplayStateMachine } from './modules/replay.js';
import { Visualization } from './modules/visualization.js';
import { RiskEngine, RiskLevel, RiskTypeNames } from './modules/riskEngine.js';
import { ImportExport } from './modules/importExport.js';
import { LocalStorage } from './modules/storage.js';
import './style.css';

class WindFieldBlackbox {
  constructor() {
    this.parser = new DataParser();
    this.geoCalculator = new GeoCalculator();
    this.replay = new ReplayStateMachine();
    this.visualization = new Visualization();
    this.riskEngine = new RiskEngine();
    this.importExport = new ImportExport();
    this.storage = new LocalStorage();
    
    this.data = {
      track: null,
      weather: null,
      noFlyZones: null,
      alerts: null,
      riskEvents: []
    };
    
    this.selectedEventId = null;
    this.pendingFiles = {
      track: null,
      weather: null,
      noFlyZones: null,
      alerts: null
    };
    
    this.init();
  }

  async init() {
    this.visualization.initializeMap('map');
    this.visualization.initializeTimeline('timelineCanvas');
    this.bindEvents();
    this.setupReplayListeners();
  }

  bindEvents() {
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importModal').style.display = 'flex';
    });

    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('importModal').style.display = 'none';
    });

    document.getElementById('importCancelBtn').addEventListener('click', () => {
      document.getElementById('importModal').style.display = 'none';
      this.resetPendingFiles();
    });

    document.getElementById('trackFileInput').addEventListener('change', (e) => {
      this.handleFileSelection(e, 'track', 'trackFilePreview');
    });

    document.getElementById('weatherFileInput').addEventListener('change', (e) => {
      this.handleFileSelection(e, 'weather', 'weatherFilePreview');
    });

    document.getElementById('alertFileInput').addEventListener('change', (e) => {
      this.handleFileSelection(e, 'alerts', 'alertFilePreview');
    });

    document.getElementById('noFlyZoneFileInput').addEventListener('change', (e) => {
      this.handleFileSelection(e, 'noFlyZones', 'noFlyZoneFilePreview');
    });

    document.getElementById('importConfirmBtn').addEventListener('click', async () => {
      await this.processImport();
    });

    document.getElementById('loadSampleBtn').addEventListener('click', async () => {
      await this.loadSampleData();
    });

    document.getElementById('saveSessionBtn').addEventListener('click', () => {
      this.saveCurrentSession();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      document.getElementById('exportModal').style.display = 'flex';
    });

    document.getElementById('exportModalClose').addEventListener('click', () => {
      document.getElementById('exportModal').style.display = 'none';
    });

    document.getElementById('exportCancelBtn').addEventListener('click', () => {
      document.getElementById('exportModal').style.display = 'none';
    });

    document.getElementById('exportConfirmBtn').addEventListener('click', () => {
      this.handleExport();
    });

    document.getElementById('playPauseBtn').addEventListener('click', () => {
      this.togglePlayPause();
    });

    document.getElementById('rewindBtn').addEventListener('click', () => {
      this.replay.stepBackward(10);
    });

    document.getElementById('forwardBtn').addEventListener('click', () => {
      this.replay.stepForward(10);
    });

    document.getElementById('prevEventBtn').addEventListener('click', () => {
      this.goToPreviousEvent();
    });

    document.getElementById('nextEventBtn').addEventListener('click', () => {
      this.goToNextEvent();
    });

    document.getElementById('speedSelect').addEventListener('change', (e) => {
      const speed = parseFloat(e.target.value);
      this.replay.setSpeed(speed);
    });

    document.getElementById('timelineSlider').addEventListener('input', (e) => {
      const progress = parseFloat(e.target.value) / 100;
      this.replay.seekToProgress(progress);
    });

    document.getElementById('addAnnotationBtn').addEventListener('click', () => {
      this.addManualAnnotation();
    });

    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });
  }

  setupReplayListeners() {
    this.replay.on('update', (state) => {
      this.onReplayUpdate(state);
    });

    this.replay.on('play', () => {
      this.updatePlayPauseButton(true);
    });

    this.replay.on('pause', () => {
      this.updatePlayPauseButton(false);
    });

    this.replay.on('finished', () => {
      this.updatePlayPauseButton(false);
    });

    this.replay.on('seek', (state) => {
      this.onReplayUpdate(state);
    });
  }

  onReplayUpdate(state) {
    const currentPoint = state.currentPoint;
    
    if (currentPoint) {
      this.visualization.updateAircraftPosition(currentPoint);
      this.updateStatusDisplay(currentPoint);
      this.updateWeatherDisplay(currentPoint);
    }

    document.getElementById('timelineSlider').value = state.progress * 100;
    document.getElementById('currentTime').textContent = 
      `时间: ${this.geoCalculator.formatTime(state.currentTime)}`;

    this.visualization.renderTimeline(
      this.data.track,
      this.data.riskEvents,
      state.progress
    );
  }

  handleFileSelection(event, type, previewId) {
    const file = event.target.files[0];
    if (file) {
      this.pendingFiles[type] = file;
      const preview = document.getElementById(previewId);
      preview.textContent = `已选择: ${file.name} (${this.formatFileSize(file.size)})`;
      preview.classList.add('has-file');
    }
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  resetPendingFiles() {
    this.pendingFiles = {
      track: null,
      weather: null,
      noFlyZones: null,
      alerts: null
    };
    
    ['trackFilePreview', 'weatherFilePreview', 'alertFilePreview', 'noFlyZoneFilePreview'].forEach(id => {
      const preview = document.getElementById(id);
      preview.textContent = '未选择文件';
      preview.classList.remove('has-file');
    });
    
    ['trackFileInput', 'weatherFileInput', 'alertFileInput', 'noFlyZoneFileInput'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }

  async processImport() {
    const files = [];
    
    if (this.pendingFiles.track) files.push(this.pendingFiles.track);
    if (this.pendingFiles.weather) files.push(this.pendingFiles.weather);
    if (this.pendingFiles.alerts) files.push(this.pendingFiles.alerts);
    if (this.pendingFiles.noFlyZones) files.push(this.pendingFiles.noFlyZones);
    
    if (files.length === 0) {
      alert('请至少选择一个文件导入');
      return;
    }
    
    try {
      const result = await this.importExport.importFromFiles(files);
      
      if (result.errors && result.errors.length > 0) {
        console.warn('Import warnings:', result.errors);
      }
      
      this.parser.clear();
      
      if (result.track) {
        if (result.track.raw) {
          this.data.track = this.parser.parseTrackData(result.track.raw);
        } else {
          this.data.track = result.track;
        }
      }
      
      if (result.weather) {
        if (result.weather.raw) {
          this.data.weather = this.parser.parseWeatherData(result.weather.raw);
        } else {
          this.data.weather = result.weather;
        }
      }
      
      if (result.alerts) {
        if (result.alerts.raw) {
          this.data.alerts = this.parser.parseAlertData(result.alerts.raw);
        } else {
          this.data.alerts = result.alerts;
        }
      }
      
      if (result.noFlyZones) {
        if (result.noFlyZones.raw) {
          this.data.noFlyZones = this.parser.parseNoFlyZoneData(result.noFlyZones.raw);
        } else {
          this.data.noFlyZones = result.noFlyZones;
        }
      }
      
      if (result.sessionData && result.sessionData.riskEngineData) {
        this.riskEngine.import(result.sessionData.riskEngineData);
      }
      
      this.analyzeAndRender();
      
      document.getElementById('importModal').style.display = 'none';
      this.resetPendingFiles();
      
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败: ' + error.message);
    }
  }

  analyzeAndRender() {
    if (!this.data.track || !this.data.track.points) {
      return;
    }
    
    this.replay.initialize(this.data.track.points);
    
    this.data.riskEvents = this.riskEngine.analyze({
      track: this.data.track,
      weather: this.data.weather,
      noFlyZones: this.data.noFlyZones,
      alerts: this.data.alerts
    });
    
    this.visualization.clearAll();
    
    if (this.data.noFlyZones) {
      this.visualization.renderNoFlyZones(this.data.noFlyZones);
    }
    
    if (this.data.alerts) {
      this.visualization.renderAlertPoints(this.data.alerts);
    }
    
    this.visualization.renderTrack(this.data.track);
    
    if (this.data.riskEvents.length > 0) {
      this.visualization.renderRiskEvents(this.data.riskEvents);
    }
    
    this.updateEventList();
    this.updateDataOverview();
    this.enableControls();
    
    document.getElementById('timelineContainer').style.display = 'block';
    
    this.visualization.renderTimeline(
      this.data.track,
      this.data.riskEvents,
      0
    );
  }

  updateEventList() {
    const events = this.data.riskEvents;
    const eventList = document.getElementById('eventList');
    const eventStats = document.getElementById('eventStats');
    
    const stats = this.riskEngine.getEventStats();
    eventStats.innerHTML = `
      <span class="stat-critical">🔴 严重: ${stats.critical}</span>
      <span class="stat-warning">🟡 警告: ${stats.warning}</span>
      <span class="stat-info">🔵 信息: ${stats.info}</span>
    `;
    
    if (events.length === 0) {
      eventList.innerHTML = `
        <div class="empty-state">
          <p>暂无风险事件</p>
          <p class="hint">本次巡检未检测到风险</p>
        </div>
      `;
      return;
    }
    
    eventList.innerHTML = events.map(event => `
      <div class="event-item ${event.level} ${event.isManual ? 'manual' : ''}" data-event-id="${event.id}">
        <div class="event-header">
          <span class="event-type">${RiskTypeNames[event.type] || '未知事件'}</span>
          <span class="event-time">${this.geoCalculator.formatTime(event.timestamp)}</span>
        </div>
        <div class="event-description">${event.description}</div>
        <div class="event-meta">
          <span>级别: ${this.getLevelLabel(event.level)}</span>
          ${event.isManual ? '<span>人工标注</span>' : ''}
        </div>
      </div>
    `).join('');
    
    eventList.querySelectorAll('.event-item').forEach(item => {
      item.addEventListener('click', () => {
        const eventId = item.dataset.eventId;
        this.selectEvent(eventId, item);
      });
    });
  }

  getLevelLabel(level) {
    switch (level) {
      case RiskLevel.CRITICAL: return '🔴 严重';
      case RiskLevel.WARNING: return '🟡 警告';
      case RiskLevel.INFO: return '🔵 信息';
      default: return level;
    }
  }

  selectEvent(eventId, element) {
    document.querySelectorAll('.event-item').forEach(e => e.classList.remove('selected'));
    
    if (element) {
      element.classList.add('selected');
    }
    
    this.selectedEventId = eventId;
    
    const event = this.data.riskEvents.find(e => e.id === eventId);
    if (event) {
      this.visualization.highlightRiskEvent(eventId);
      
      if (event.timestamp) {
        this.replay.seek(event.timestamp);
      }
    }
  }

  goToPreviousEvent() {
    const currentState = this.replay.getState();
    const prevEvent = this.riskEngine.getPreviousEvent(currentState.currentTime);
    
    if (prevEvent) {
      this.replay.seek(prevEvent.timestamp);
      this.selectEventById(prevEvent.id);
    }
  }

  goToNextEvent() {
    const currentState = this.replay.getState();
    const nextEvent = this.riskEngine.getNextEvent(currentState.currentTime);
    
    if (nextEvent) {
      this.replay.seek(nextEvent.timestamp);
      this.selectEventById(nextEvent.id);
    }
  }

  selectEventById(eventId) {
    const element = document.querySelector(`.event-item[data-event-id="${eventId}"]`);
    if (element) {
      this.selectEvent(eventId, element);
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  updateDataOverview() {
    const overview = document.getElementById('dataOverview');
    
    document.getElementById('overviewTrackPoints').textContent = 
      this.data.track?.pointCount || 0;
    document.getElementById('overviewWeatherRecords').textContent = 
      this.data.weather?.recordCount || 0;
    document.getElementById('overviewAlertPoints').textContent = 
      this.data.alerts?.featureCount || 0;
    document.getElementById('overviewNoFlyZones').textContent = 
      this.data.noFlyZones?.featureCount || 0;
    document.getElementById('overviewFlightTime').textContent = 
      this.data.track ? this.geoCalculator.formatDuration(this.data.track.duration) : '--:--:--';
  }

  updateStatusDisplay(point) {
    document.getElementById('statusLng').textContent = point.longitude.toFixed(6);
    document.getElementById('statusLat').textContent = point.latitude.toFixed(6);
    document.getElementById('statusAlt').textContent = point.altitude.toFixed(1);
    document.getElementById('statusSpeed').textContent = point.speed.toFixed(2);
    document.getElementById('statusHeading').textContent = point.heading.toFixed(1);
    document.getElementById('statusGimbal').textContent = point.gimbalPitch?.toFixed(1) || '0';
  }

  updateWeatherDisplay(point) {
    if (!this.data.weather) {
      document.getElementById('weatherWindSpeed').textContent = '--';
      document.getElementById('weatherWindDir').textContent = '--';
      document.getElementById('weatherWindAngle').textContent = '--';
      return;
    }
    
    const weatherAtTime = this.parser.interpolateWeatherAtTime(
      this.data.weather,
      point.timestamp
    );
    
    if (weatherAtTime) {
      document.getElementById('weatherWindSpeed').textContent = 
        weatherAtTime.windSpeed?.toFixed(1) || '--';
      document.getElementById('weatherWindDir').textContent = 
        weatherAtTime.windDirection?.toFixed(0) || '--';
      
      const windAngle = this.geoCalculator.calculateWindAngle(
        point.heading,
        weatherAtTime.windDirection || 0
      );
      document.getElementById('weatherWindAngle').textContent = windAngle.toFixed(1);
    }
  }

  togglePlayPause() {
    if (!this.replay.isInitialized()) return;
    this.replay.toggle();
  }

  updatePlayPauseButton(isPlaying) {
    const btn = document.getElementById('playPauseBtn');
    btn.textContent = isPlaying ? '⏸️' : '▶️';
  }

  enableControls() {
    document.getElementById('saveSessionBtn').disabled = false;
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('annotationSection').style.display = 'block';
  }

  addManualAnnotation() {
    const currentState = this.replay.getState();
    if (!currentState.currentPoint) {
      alert('请先开始回放或选择时间点');
      return;
    }
    
    const level = document.getElementById('annotationLevel').value;
    const description = document.getElementById('annotationDescription').value.trim();
    
    if (!description) {
      alert('请输入标注描述');
      return;
    }
    
    const event = this.riskEngine.addManualAnnotation({
      timestamp: currentState.currentTime,
      progress: currentState.progress,
      pointIndex: currentState.currentIndex,
      position: {
        latitude: currentState.currentPoint.latitude,
        longitude: currentState.currentPoint.longitude,
        altitude: currentState.currentPoint.altitude
      },
      level: level,
      description: description,
      notes: description
    });
    
    this.data.riskEvents = this.riskEngine.getAllEvents();
    
    this.visualization.renderRiskEvents(this.data.riskEvents);
    
    this.updateEventList();
    
    document.getElementById('annotationDescription').value = '';
  }

  saveCurrentSession() {
    const sessionData = {
      track: this.data.track,
      weather: this.data.weather,
      noFlyZones: this.data.noFlyZones,
      alerts: this.data.alerts,
      riskEngine: this.riskEngine
    };
    
    const saved = this.storage.saveSession(sessionData, {
      name: `巡检_${new Date().toLocaleDateString('zh-CN')}`
    });
    
    if (saved) {
      alert('会话已保存到本地存储');
    } else {
      alert('保存失败，请检查存储空间');
    }
  }

  handleExport() {
    const exportMarkdown = document.getElementById('exportMarkdown').checked;
    const exportCsv = document.getElementById('exportCsv').checked;
    const includeAnnotations = document.getElementById('exportAnnotations').checked;
    
    const sessionData = {
      track: this.data.track,
      weather: this.data.weather,
      noFlyZones: this.data.noFlyZones,
      alerts: this.data.alerts
    };
    
    try {
      if (exportMarkdown) {
        this.importExport.downloadAsMarkdown({
          sessionData,
          riskEvents: this.data.riskEvents,
          includeAnnotations
        });
      }
      
      if (exportCsv) {
        this.importExport.downloadAsCSV({
          riskEvents: this.data.riskEvents,
          includeAnnotations
        });
      }
      
      document.getElementById('exportModal').style.display = 'none';
      
    } catch (error) {
      alert('导出失败: ' + error.message);
    }
  }

  async loadSampleData() {
    try {
      const sampleTrack = this.generateSampleTrack();
      const sampleWeather = this.generateSampleWeather();
      const sampleAlerts = this.generateSampleAlerts();
      const sampleNoFlyZones = this.generateSampleNoFlyZones();
      
      this.parser.clear();
      
      this.data.track = this.parser.parseTrackData(sampleTrack);
      this.data.weather = this.parser.parseWeatherData(sampleWeather);
      this.data.alerts = this.parser.parseAlertData(sampleAlerts);
      this.data.noFlyZones = this.parser.parseNoFlyZoneData(sampleNoFlyZones);
      
      this.analyzeAndRender();
      
    } catch (error) {
      console.error('Failed to load sample data:', error);
      alert('加载示例数据失败: ' + error.message);
    }
  }

  generateSampleTrack() {
    const baseTime = Date.now() - 3600000;
    const points = [];
    
    const baseLat = 30.5;
    const baseLng = 121.2;
    
    const waypoints = [
      { lat: 0, lng: 0, alt: 50 },
      { lat: 0.002, lng: 0.001, alt: 80 },
      { lat: 0.004, lng: 0.003, alt: 100 },
      { lat: 0.006, lng: 0.002, alt: 120 },
      { lat: 0.005, lng: 0.000, alt: 100 },
      { lat: 0.003, lng: -0.001, alt: 80 },
      { lat: 0.001, lng: -0.002, alt: 60 },
      { lat: 0.000, lng: 0.000, alt: 40 }
    ];
    
    for (let i = 0; i < 120; i++) {
      const progress = i / 120;
      const waypointIndex = Math.floor(progress * (waypoints.length - 1));
      const nextWaypointIndex = Math.min(waypointIndex + 1, waypoints.length - 1);
      const waypointProgress = (progress * (waypoints.length - 1)) % 1;
      
      const wp1 = waypoints[waypointIndex];
      const wp2 = waypoints[nextWaypointIndex];
      
      const lat = baseLat + wp1.lat + (wp2.lat - wp1.lat) * waypointProgress;
      const lng = baseLng + wp1.lng + (wp2.lng - wp1.lng) * waypointProgress;
      const alt = wp1.alt + (wp2.alt - wp1.alt) * waypointProgress;
      
      let speed = 8 + Math.sin(progress * Math.PI * 4) * 3;
      if (i === 45) speed = 16;
      if (i === 80) speed = 14;
      
      let gimbalPitch = -45;
      if (i >= 50 && i <= 60) gimbalPitch = -88;
      
      points.push({
        timestamp: baseTime + i * 5000,
        latitude: lat,
        longitude: lng,
        altitude: alt,
        speed: speed,
        heading: (progress * 360 + 90) % 360,
        gimbalPitch: gimbalPitch,
        gimbalYaw: 0,
        roll: 0,
        pitch: 0,
        satellites: 12,
        battery: 100 - progress * 60,
        mode: 'AUTO'
      });
    }
    
    return { points };
  }

  generateSampleWeather() {
    const baseTime = Date.now() - 3600000;
    let csv = 'timestamp,windSpeed,windDirection,temperature,humidity\n';
    
    for (let i = 0; i < 24; i++) {
      const time = new Date(baseTime + i * 30000);
      const windSpeed = 8 + Math.sin(i * 0.5) * 3 + (i === 12 ? 5 : 0);
      const windDirection = 180 + Math.sin(i * 0.3) * 40;
      const temp = 22 + Math.sin(i * 0.2) * 3;
      const humidity = 65 + Math.cos(i * 0.25) * 10;
      
      csv += `${time.toISOString()},${windSpeed.toFixed(1)},${windDirection.toFixed(0)},${temp.toFixed(1)},${humidity.toFixed(0)}\n`;
    }
    
    return csv;
  }

  generateSampleAlerts() {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [121.202, 30.504]
          },
          properties: {
            name: '叶片异常告警点',
            description: '上次巡检发现叶片有损伤迹象',
            level: 'warning'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [121.198, 30.502]
          },
          properties: {
            name: '塔基关注区',
            description: '需要重点检查塔基螺栓',
            level: 'info'
          }
        }
      ]
    };
  }

  generateSampleNoFlyZones() {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [121.199, 30.501],
              [121.201, 30.501],
              [121.201, 30.503],
              [121.199, 30.503],
              [121.199, 30.501]
            ]]
          },
          properties: {
            name: '军事管制区',
            description: '绝对禁止进入区域'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Circle',
            coordinates: [121.204, 30.505],
            radius: 150
          },
          properties: {
            name: '机场净空区',
            description: '保持安全距离'
          }
        }
      ]
    };
  }

  handleKeyboard(e) {
    if (!this.replay.isInitialized()) return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey) {
          this.goToPreviousEvent();
        } else {
          this.replay.stepBackward(5);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey) {
          this.goToNextEvent();
        } else {
          this.replay.stepForward(5);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        const currentSpeed = this.replay.getState().speed;
        this.replay.setSpeed(Math.min(10, currentSpeed * 2));
        document.getElementById('speedSelect').value = this.replay.getState().speed;
        break;
      case 'ArrowDown':
        e.preventDefault();
        const currentSpeedDown = this.replay.getState().speed;
        this.replay.setSpeed(Math.max(0.5, currentSpeedDown / 2));
        document.getElementById('speedSelect').value = this.replay.getState().speed;
        break;
      case 'KeyR':
        e.preventDefault();
        this.replay.goToStart();
        break;
      case 'KeyE':
        e.preventDefault();
        this.replay.goToEnd();
        break;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new WindFieldBlackbox();
});
