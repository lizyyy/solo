import { DataManager } from './data/dataManager.js';
import { RiskDetector } from './data/riskDetector.js';
import { Scene3D } from './visualization/scene3D.js';
import { Exporter } from './utils/exporter.js';
import { TimeUtils } from './utils/timeUtils.js';
import { Parsers } from './data/parsers.js';

class App {
  constructor() {
    this.dataManager = new DataManager();
    this.riskDetector = null;
    this.scene3D = null;
    
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.currentTime = 0;
    this.lastFrameTime = 0;
    
    this.filteredFlight = 'all';
    this.filteredVehicleType = 'all';
    this.filteredRiskLevel = 'all';
    this.riskEvents = [];
    
    this.init();
  }

  init() {
    const canvas = document.getElementById('three-canvas');
    this.scene3D = new Scene3D(canvas);
    
    this.bindEvents();
    this.hideLoading();
  }

  bindEvents() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    const selectFilesBtn = document.getElementById('selectFilesBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');
    const exportBtn = document.getElementById('exportBtn');
    const playBtn = document.getElementById('playBtn');
    const speedSelect = document.getElementById('speedSelect');
    const flightFilter = document.getElementById('flightFilter');
    const vehicleTypeFilter = document.getElementById('vehicleTypeFilter');
    const riskLevelFilter = document.getElementById('riskLevelFilter');
    
    fileUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileUploadArea.classList.add('dragover');
    });
    
    fileUploadArea.addEventListener('dragleave', () => {
      fileUploadArea.classList.remove('dragover');
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileUploadArea.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });
    
    selectFilesBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });
    
    loadSampleBtn.addEventListener('click', () => {
      this.loadSampleData();
    });
    
    exportBtn.addEventListener('click', () => {
      this.exportData();
    });
    
    playBtn.addEventListener('click', () => {
      this.togglePlayback();
    });
    
    speedSelect.addEventListener('change', (e) => {
      this.playbackSpeed = parseFloat(e.target.value);
      document.getElementById('playbackSpeed').textContent = `${this.playbackSpeed}x`;
    });
    
    flightFilter.addEventListener('change', (e) => {
      this.filteredFlight = e.target.value;
      this.applyFilters();
    });
    
    vehicleTypeFilter.addEventListener('change', (e) => {
      this.filteredVehicleType = e.target.value;
      this.applyFilters();
    });
    
    riskLevelFilter.addEventListener('change', (e) => {
      this.filteredRiskLevel = e.target.value;
      this.updateRiskList();
    });
    
    const timelineVisual = document.getElementById('timelineVisual');
    timelineVisual.addEventListener('click', (e) => {
      this.handleTimelineClick(e);
    });
  }

  async handleFiles(files) {
    if (!files || files.length === 0) return;
    
    this.showLoading('正在解析数据...');
    
    try {
      const results = await this.dataManager.loadFiles(files);
      
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';
      
      results.forEach(result => {
        const item = document.createElement('div');
        item.className = `file-item ${result.success ? 'success' : 'error'}`;
        item.innerHTML = `
          <span>${result.filename}</span>
          <span style="margin-left: auto; color: ${result.success ? '#4caf50' : '#f44336'}">
            ${result.success ? '✓ 成功' : '✗ 失败'}
          </span>
        `;
        fileList.appendChild(item);
      });
      
      if (this.dataManager.hasAllRequiredData()) {
        await this.initializeVisualization();
      }
      
    } catch (error) {
      console.error('文件处理错误:', error);
    } finally {
      this.hideLoading();
    }
  }

  async loadSampleData() {
    this.showLoading('正在加载示例数据...');
    
    try {
      const [stands, tracks, turnarounds, safetyRules] = await Promise.all([
        fetch('/samples/stands.json').then(r => r.json()),
        fetch('/samples/vehicle_tracks.csv').then(r => r.text()),
        fetch('/samples/turnarounds.yaml').then(r => r.text()),
        fetch('/samples/safety_rules.json').then(r => r.json())
      ]);
      
      this.dataManager.stands = Parsers.processStands(stands);
      this.dataManager.vehicles = Parsers.processVehicleTracks(
        await Parsers.parseCsv(tracks)
      );
      this.dataManager.vehicles = this.dataManager.vehicles.map(v => {
        const v1 = Parsers.fillGpsGaps(v);
        return Parsers.calculateVehicleSpeeds(v1);
      });
      
      this.dataManager.turnarounds = Parsers.processTurnarounds(
        Parsers.parseYaml(turnarounds)
      );
      this.dataManager.safetyRules = Parsers.processSafetyRules(safetyRules);
      
      this.dataManager.calculateCenterCoords();
      this.dataManager.calculateTimeRange();
      
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = `
        <div class="file-item success">
          <span>stands.json (示例)</span>
          <span style="margin-left: auto; color: #4caf50">✓ 成功</span>
        </div>
        <div class="file-item success">
          <span>vehicle_tracks.csv (示例)</span>
          <span style="margin-left: auto; color: #4caf50">✓ 成功</span>
        </div>
        <div class="file-item success">
          <span>turnarounds.yaml (示例)</span>
          <span style="margin-left: auto; color: #4caf50">✓ 成功</span>
        </div>
        <div class="file-item success">
          <span>safety_rules.json (示例)</span>
          <span style="margin-left: auto; color: #4caf50">✓ 成功</span>
        </div>
      `;
      
      await this.initializeVisualization();
      
    } catch (error) {
      console.error('加载示例数据错误:', error);
      this.showLoading('正在生成示例数据...');
      await this.generateAndLoadSampleData();
    } finally {
      this.hideLoading();
    }
  }

  async generateAndLoadSampleData() {
    const sampleStands = [
      { id: '101', name: '101', latitude: 31.1434, longitude: 121.8060, type: 'passenger', gate: 'A1' },
      { id: '102', name: '102', latitude: 31.1436, longitude: 121.8065, type: 'passenger', gate: 'A2' },
      { id: '103', name: '103', latitude: 31.1438, longitude: 121.8070, type: 'passenger', gate: 'A3' },
      { id: '201', name: '201', latitude: 31.1424, longitude: 121.8080, type: 'cargo', restricted: false },
      { id: '202', name: '202', latitude: 31.1426, longitude: 121.8085, type: 'cargo', restricted: true }
    ];
    
    const sampleTracks = this.generateSampleTracks();
    const sampleTurnarounds = [
      {
        flight_id: 'CA1234',
        flight_number: 'CA1234',
        aircraft_type: 'B737',
        stand_id: '101',
        arrival_time: '08:30:00',
        departure_time: '10:15:00',
        operations: [
          { type: 'fueling', start: '08:45:00', end: '09:15:00' },
          { type: 'boarding', start: '09:30:00', end: '10:00:00' }
        ]
      },
      {
        flight_id: 'MU5678',
        flight_number: 'MU5678',
        aircraft_type: 'A320',
        stand_id: '102',
        arrival_time: '23:45:00',
        departure_time: '01:30:00',
        operations: [
          { type: 'unloading', start: '23:55:00', end: '00:30:00' },
          { type: 'loading', start: '00:45:00', end: '01:15:00' }
        ]
      }
    ];
    
    const sampleSafetyRules = {
      speed_limits: [
        { limit: 30, area: 'general' },
        { limit: 15, area: 'stand_area' }
      ],
      no_entry_zones: [
        { name: '跑道禁区', polygon: [
          { lat: 31.1450, lon: 121.8040 },
          { lat: 31.1450, lon: 121.8100 },
          { lat: 31.1440, lon: 121.8100 },
          { lat: 31.1440, lon: 121.8040 }
        ]}
      ],
      proximity_rules: { min_distance: 10 },
      fueling_rules: { no_bridge_during_fueling: true }
    };
    
    this.dataManager.stands = Parsers.processStands(sampleStands);
    this.dataManager.vehicles = sampleTracks;
    this.dataManager.turnarounds = Parsers.processTurnarounds(sampleTurnarounds);
    this.dataManager.safetyRules = Parsers.processSafetyRules(sampleSafetyRules);
    this.dataManager.calculateCenterCoords();
    this.dataManager.calculateTimeRange();
    
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = `
      <div class="file-item success">
        <span>示例数据 (自动生成)</span>
        <span style="margin-left: auto; color: #4caf50">✓ 成功</span>
      </div>
    `;
    
    await this.initializeVisualization();
  }

  generateSampleTracks() {
    const vehicles = [];
    
    const baseTime = TimeUtils.parseTime('08:00:00');
    
    vehicles.push({
      id: 'FUEL-001',
      type: 'fuel_truck',
      tracks: []
    });
    
    for (let i = 0; i < 100; i++) {
      const t = i / 99;
      vehicles[0].tracks.push({
        latitude: 31.1434 + t * 0.0004,
        longitude: 121.8060 + t * 0.0010,
        timestamp: baseTime + i * 30000,
        speed: 25
      });
    }
    
    vehicles.push({
      id: 'BUS-001',
      type: 'bus',
      tracks: []
    });
    
    for (let i = 0; i < 80; i++) {
      const t = i / 79;
      vehicles[1].tracks.push({
        latitude: 31.1436 - t * 0.0006,
        longitude: 121.8065 + t * 0.0008,
        timestamp: baseTime + 60000 + i * 25000,
        speed: i > 30 && i < 40 ? 35 : 20
      });
    }
    
    vehicles.push({
      id: 'BRIDGE-001',
      type: 'passenger_bridge',
      tracks: []
    });
    
    for (let i = 0; i < 50; i++) {
      const t = i / 49;
      vehicles[2].tracks.push({
        latitude: 31.1438,
        longitude: 121.8070,
        timestamp: baseTime + 120000 + i * 60000,
        speed: 0
      });
    }
    
    return vehicles.map(v => {
      const v1 = { ...v };
      v1.tracks = TimeUtils.handleMidnightCrossing(v1.tracks, baseTime);
      return v1;
    });
  }

  async initializeVisualization() {
    this.showLoading('正在初始化 3D 场景...');
    
    const { stands, vehicles, centerCoords, timeRange } = this.dataManager;
    
    this.scene3D.setCenterCoords(centerCoords.lat, centerCoords.lon);
    this.scene3D.clear();
    
    stands.forEach(stand => {
      this.scene3D.createStand(stand);
    });
    
    vehicles.forEach(vehicle => {
      this.scene3D.createVehicle(vehicle);
      this.scene3D.createTrackLine(vehicle);
    });
    
    this.riskDetector = new RiskDetector(this.dataManager);
    this.riskEvents = this.riskDetector.detectAllRisks();
    
    this.updateFilters();
    this.updateRiskList();
    this.updateTimeline();
    this.updateTimeDisplay();
    
    this.currentTime = timeRange.start;
    this.updateCurrentTimeDisplay();
    
    this.scene3D.setCameraTopView();
    
    this.hideLoading();
  }

  updateFilters() {
    const flightFilter = document.getElementById('flightFilter');
    const vehicleTypeFilter = document.getElementById('vehicleTypeFilter');
    
    const currentFlightValue = flightFilter.value;
    const currentVehicleValue = vehicleTypeFilter.value;
    
    flightFilter.innerHTML = '<option value="all">全部航班</option>';
    this.dataManager.turnarounds.forEach(ta => {
      const option = document.createElement('option');
      option.value = ta.id;
      option.textContent = ta.flightNumber || ta.id;
      if (ta.id === currentFlightValue) option.selected = true;
      flightFilter.appendChild(option);
    });
    
    vehicleTypeFilter.innerHTML = '<option value="all">全部类型</option>';
    const types = new Set();
    this.dataManager.vehicles.forEach(v => types.add(v.type));
    types.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      if (type === currentVehicleValue) option.selected = true;
      vehicleTypeFilter.appendChild(option);
    });
  }

  updateRiskList() {
    const riskList = document.getElementById('riskList');
    const riskCount = document.getElementById('riskCount');
    
    const filteredRisks = this.filteredRiskLevel === 'all' 
      ? this.riskEvents 
      : this.riskEvents.filter(r => r.level === this.filteredRiskLevel);
    
    riskCount.textContent = filteredRisks.length;
    
    if (filteredRisks.length === 0) {
      riskList.innerHTML = '<p style="color: #888; font-size: 12px;">暂无风险事件</p>';
      return;
    }
    
    const typeLabels = {
      'speed_violation': '🚗 超速',
      'no_entry_violation': '🚫 禁入区',
      'vehicle_conflict': '💥 冲突',
      'fuel_bridge_overlap': '⛽ 重叠'
    };
    
    riskList.innerHTML = filteredRisks.map(risk => `
      <div class="risk-item ${risk.level}" data-risk-id="${risk.id}">
        <div class="risk-type">${typeLabels[risk.type] || risk.type}</div>
        <div class="risk-time">${TimeUtils.formatTime(risk.startTime)} - ${TimeUtils.formatTime(risk.endTime)}</div>
        <div class="risk-desc">${risk.description}</div>
      </div>
    `).join('');
    
    riskList.querySelectorAll('.risk-item').forEach(item => {
      item.addEventListener('click', () => {
        const riskId = item.dataset.riskId;
        this.focusOnRisk(riskId);
      });
    });
  }

  updateTimeline() {
    const timelineTracks = document.getElementById('timelineTracks');
    const { vehicles, turnarounds, timeRange } = this.dataManager;
    
    const totalDuration = timeRange.end - timeRange.start;
    if (totalDuration <= 0) return;
    
    let html = '';
    
    turnarounds.forEach(ta => {
      const startX = ((ta.arrivalTime - timeRange.start) / totalDuration) * 100;
      const width = ((ta.departureTime - ta.arrivalTime) / totalDuration) * 100;
      
      html += `
        <div class="timeline-track">
          <div class="timeline-track-label">${ta.flightNumber || ta.id}</div>
          <div class="timeline-track-content">
            <div class="timeline-event flight" 
                 style="left: ${startX}%; width: ${Math.max(width, 1)}%;"
                 data-flight-id="${ta.id}"
                 title="${ta.flightNumber || ta.id}: ${TimeUtils.formatTime(ta.arrivalTime)} - ${TimeUtils.formatTime(ta.departureTime)}">
              ${ta.flightNumber || ta.id}
            </div>
          </div>
        </div>
      `;
    });
    
    vehicles.forEach(vehicle => {
      if (!vehicle.tracks || vehicle.tracks.length < 2) return;
      
      const vehicleStart = vehicle.tracks[0].timestamp;
      const vehicleEnd = vehicle.tracks[vehicle.tracks.length - 1].timestamp;
      
      const startX = ((vehicleStart - timeRange.start) / totalDuration) * 100;
      const width = ((vehicleEnd - vehicleStart) / totalDuration) * 100;
      
      html += `
        <div class="timeline-track">
          <div class="timeline-track-label">${vehicle.type}:${vehicle.id}</div>
          <div class="timeline-track-content">
            <div class="timeline-event vehicle" 
                 style="left: ${startX}%; width: ${Math.max(width, 1)}%;"
                 data-vehicle-id="${vehicle.id}"
                 title="${vehicle.type} ${vehicle.id}: ${TimeUtils.formatTime(vehicleStart)} - ${TimeUtils.formatTime(vehicleEnd)}">
              ${vehicle.id}
            </div>
          </div>
        </div>
      `;
    });
    
    this.riskEvents.forEach(risk => {
      const startX = ((risk.startTime - timeRange.start) / totalDuration) * 100;
      const width = ((risk.endTime - risk.startTime) / totalDuration) * 100;
      
      html += `
        <div class="timeline-track">
          <div class="timeline-track-label">风险</div>
          <div class="timeline-track-content">
            <div class="timeline-event risk" 
                 style="left: ${startX}%; width: ${Math.max(width, 1)}%;"
                 data-risk-id="${risk.id}"
                 title="风险: ${TimeUtils.formatTime(risk.startTime)} - ${TimeUtils.formatTime(risk.endTime)}">
            </div>
          </div>
        </div>
      `;
    });
    
    timelineTracks.innerHTML = html;
  }

  updateTimeDisplay() {
    const { timeRange } = this.dataManager;
    const timeDisplay = document.getElementById('timeDisplay');
    timeDisplay.textContent = `${TimeUtils.formatTime(timeRange.start)} - ${TimeUtils.formatTime(timeRange.end)}`;
  }

  updateCurrentTimeDisplay() {
    document.getElementById('currentTime').textContent = TimeUtils.formatTime(this.currentTime);
    
    const { timeRange, vehicles, turnarounds } = this.dataManager;
    const totalDuration = timeRange.end - timeRange.start;
    
    if (totalDuration > 0) {
      const cursorLeft = ((this.currentTime - timeRange.start) / totalDuration) * 100;
      const cursor = document.getElementById('timelineCursor');
      cursor.style.left = `${cursorLeft}%`;
    }
    
    const activeVehicles = vehicles.filter(v => {
      if (!v.tracks || v.tracks.length < 2) return false;
      const start = v.tracks[0].timestamp;
      const end = v.tracks[v.tracks.length - 1].timestamp;
      return this.currentTime >= start && this.currentTime <= end;
    });
    document.getElementById('activeVehicles').textContent = activeVehicles.length;
    
    const activeFlights = turnarounds.filter(ta => {
      return TimeUtils.isTimeInRange(this.currentTime, ta.arrivalTime, ta.departureTime);
    });
    document.getElementById('currentFlights').textContent = activeFlights.length;
  }

  applyFilters() {
    const { vehicles } = this.dataManager;
    
    vehicles.forEach(vehicle => {
      const visible = this.filteredVehicleType === 'all' || vehicle.type === this.filteredVehicleType;
      this.scene3D.updateVehicleVisibility(vehicle.id, visible);
      this.scene3D.updateTrackVisibility(vehicle.id, visible);
    });
  }

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    const playBtn = document.getElementById('playBtn');
    
    if (this.isPlaying) {
      playBtn.classList.add('playing');
      this.lastFrameTime = performance.now();
      this.playbackLoop();
    } else {
      playBtn.classList.remove('playing');
    }
  }

  playbackLoop() {
    if (!this.isPlaying) return;
    
    const now = performance.now();
    const deltaMs = (now - this.lastFrameTime) * this.playbackSpeed;
    this.lastFrameTime = now;
    
    this.currentTime += deltaMs;
    
    const { timeRange } = this.dataManager;
    if (this.currentTime > timeRange.end) {
      this.currentTime = timeRange.end;
      this.isPlaying = false;
      document.getElementById('playBtn').classList.remove('playing');
    }
    if (this.currentTime < timeRange.start) {
      this.currentTime = timeRange.start;
    }
    
    this.updateCurrentTimeDisplay();
    this.updateVehiclePositions();
    
    requestAnimationFrame(() => this.playbackLoop());
  }

  updateVehiclePositions() {
    const { vehicles } = this.dataManager;
    
    vehicles.forEach(vehicle => {
      const pos = this.dataManager.getVehiclePositionAtTime(vehicle, this.currentTime);
      if (pos) {
        this.scene3D.updateVehiclePosition(vehicle.id, pos, pos.heading);
      }
    });
  }

  handleTimelineClick(e) {
    const { timeRange } = this.dataManager;
    const totalDuration = timeRange.end - timeRange.start;
    
    if (totalDuration <= 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    this.currentTime = timeRange.start + percentage * totalDuration;
    this.updateCurrentTimeDisplay();
    this.updateVehiclePositions();
  }

  focusOnRisk(riskId) {
    const risk = this.riskEvents.find(r => r.id === riskId);
    if (!risk) return;
    
    this.currentTime = risk.startTime;
    this.updateCurrentTimeDisplay();
    this.updateVehiclePositions();
    
    if (risk.metadata && risk.metadata.vehicleId) {
      this.scene3D.focusOnVehicle(risk.metadata.vehicleId);
    } else if (risk.metadata && risk.metadata.vehicleId1) {
      this.scene3D.focusOnVehicle(risk.metadata.vehicleId1);
    }
  }

  exportData() {
    if (!this.dataManager.hasAllRequiredData()) {
      alert('请先加载完整的数据');
      return;
    }
    
    Exporter.downloadAll(this.dataManager, this.riskEvents);
  }

  showLoading(message = '加载中...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    if (text) text.textContent = message;
    overlay.classList.remove('hidden');
  }

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});

export default App;
