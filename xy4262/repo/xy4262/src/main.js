import { DataParser } from './modules/DataParser.js';
import { Simulation } from './modules/Simulation.js';
import { Renderer } from './modules/Renderer.js';
import { Controller } from './modules/Controller.js';
import { Storage } from './modules/Storage.js';
import { Exporter } from './modules/Exporter.js';
import { SampleData } from './data/SampleData.js';

class DroneSimulatorApp {
  constructor() {
    this.dataParser = new DataParser();
    this.simulation = null;
    this.renderer = null;
    this.controller = null;
    this.storage = new Storage();
    this.exporter = null;
    
    this.dronesData = null;
    this.noFlyZones = null;
    this.beatsData = null;
    this.batteriesData = null;
    this.markers = [];
    
    this.init();
  }
  
  async init() {
    try {
      this.renderer = new Renderer();
      await this.renderer.init();
      
      this.controller = new Controller(this);
      this.exporter = new Exporter(this);
      
      this.setupEventListeners();
      this.hideLoading();
      
      console.log('无人机灯光秀航线排练台初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('初始化失败: ' + error.message);
    }
  }
  
  setupEventListeners() {
    document.getElementById('load-sample').addEventListener('click', () => this.loadSampleData());
    
    document.getElementById('drones-file').addEventListener('change', (e) => this.handleFileSelect(e, 'drones'));
    document.getElementById('no-fly-file').addEventListener('change', (e) => this.handleFileSelect(e, 'noFly'));
    document.getElementById('beats-file').addEventListener('change', (e) => this.handleFileSelect(e, 'beats'));
    document.getElementById('batteries-file').addEventListener('change', (e) => this.handleFileSelect(e, 'batteries'));
    
    document.getElementById('play-btn').addEventListener('click', () => this.play());
    document.getElementById('pause-btn').addEventListener('click', () => this.pause());
    document.getElementById('reset-btn').addEventListener('click', () => this.reset());
    document.getElementById('add-marker-btn').addEventListener('click', () => this.addManualMarker());
    
    document.getElementById('save-session-btn').addEventListener('click', () => this.saveSession());
    document.getElementById('load-session-btn').addEventListener('click', () => this.loadSession());
    
    document.getElementById('export-markdown-btn').addEventListener('click', () => this.exportMarkdown());
    document.getElementById('export-csv-btn').addEventListener('click', () => this.exportCSV());
    document.getElementById('export-json-btn').addEventListener('click', () => this.exportJSON());
  }
  
  async loadSampleData() {
    try {
      this.showLoading('加载示例数据...');
      
      this.dronesData = SampleData.getDronesData();
      this.noFlyZones = SampleData.getNoFlyZones();
      this.beatsData = SampleData.getBeatsData();
      this.batteriesData = SampleData.getBatteriesData();
      
      await this.initializeSimulation();
      
      document.getElementById('drones-file-name').textContent = '示例数据已加载';
      document.getElementById('no-fly-file-name').textContent = '示例数据已加载';
      document.getElementById('beats-file-name').textContent = '示例数据已加载';
      document.getElementById('batteries-file-name').textContent = '示例数据已加载';
      
      this.hideLoading();
      console.log('示例数据加载完成');
    } catch (error) {
      console.error('加载示例数据失败:', error);
      this.showError('加载示例数据失败: ' + error.message);
      this.hideLoading();
    }
  }
  
  async handleFileSelect(event, dataType) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      this.showLoading(`解析 ${file.name}...`);
      
      const content = await this.readFileAsText(file);
      
      switch (dataType) {
        case 'drones':
          this.dronesData = this.dataParser.parseDronesJSON(content);
          document.getElementById('drones-file-name').textContent = file.name;
          break;
        case 'noFly':
          this.noFlyZones = this.dataParser.parseNoFlyGeoJSON(content);
          document.getElementById('no-fly-file-name').textContent = file.name;
          break;
        case 'beats':
          this.beatsData = this.dataParser.parseBeatsCSV(content);
          document.getElementById('beats-file-name').textContent = file.name;
          break;
        case 'batteries':
          this.batteriesData = this.dataParser.parseBatteriesCSV(content);
          document.getElementById('batteries-file-name').textContent = file.name;
          break;
      }
      
      if (this.dronesData && this.noFlyZones) {
        await this.initializeSimulation();
      }
      
      this.hideLoading();
    } catch (error) {
      console.error('文件解析失败:', error);
      this.showError('文件解析失败: ' + error.message);
      this.hideLoading();
    }
  }
  
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }
  
  async initializeSimulation() {
    if (!this.dronesData) {
      throw new Error('缺少无人机编队数据');
    }
    if (!this.noFlyZones) {
      throw new Error('缺少禁飞区数据');
    }
    
    this.simulation = new Simulation(
      this.dronesData,
      this.noFlyZones,
      this.batteriesData
    );
    
    this.renderer.setSimulation(this.simulation);
    this.renderer.updateScene();
    
    this.controller.setSimulation(this.simulation);
    this.controller.updateTimeline();
    
    this.updateStats();
    this.markers = [];
    this.updateMarkersUI();
    
    this.simulation.on('collision', (event) => this.addAutoMarker('collision', event));
    this.simulation.on('noFlyViolation', (event) => this.addAutoMarker('no-fly', event));
    this.simulation.on('batteryWarning', (event) => this.addAutoMarker('battery', event));
    this.simulation.on('update', () => this.onSimulationUpdate());
  }
  
  onSimulationUpdate() {
    this.renderer.updateScene();
    this.controller.updateTimeDisplay();
    this.updateStats();
  }
  
  play() {
    if (this.simulation) {
      this.simulation.play();
    }
  }
  
  pause() {
    if (this.simulation) {
      this.simulation.pause();
    }
  }
  
  reset() {
    if (this.simulation) {
      this.simulation.reset();
      this.markers = [];
      this.updateMarkersUI();
    }
  }
  
  addManualMarker() {
    if (!this.simulation) return;
    
    const time = this.simulation.currentTime;
    const droneStates = this.simulation.getDroneStates();
    
    this.markers.push({
      id: Date.now(),
      type: 'manual',
      time: time,
      description: '人工标记 - ' + this.formatTime(time),
      droneStates: droneStates,
      createdAt: new Date().toISOString()
    });
    
    this.updateMarkersUI();
  }
  
  addAutoMarker(type, event) {
    const existingMarker = this.markers.find(m => 
      m.type === type && 
      Math.abs(m.time - event.time) < 0.1
    );
    
    if (existingMarker) return;
    
    this.markers.push({
      id: Date.now(),
      type: type,
      time: event.time,
      description: event.description,
      details: event.details,
      createdAt: new Date().toISOString()
    });
    
    this.updateMarkersUI();
  }
  
  updateMarkersUI() {
    const listEl = document.getElementById('markers-list');
    
    if (this.markers.length === 0) {
      listEl.innerHTML = '<p style="color: #a0aec0; font-size: 12px;">暂无标记</p>';
      return;
    }
    
    const sortedMarkers = [...this.markers].sort((a, b) => a.time - b.time);
    
    listEl.innerHTML = sortedMarkers.map(marker => `
      <div class="marker-item">
        <span class="marker-time">${this.formatTime(marker.time)}</span>
        <span class="marker-type ${marker.type.replace('-', '')}">${this.getMarkerTypeName(marker.type)}</span>
        <div style="margin-top: 4px;">${marker.description}</div>
      </div>
    `).join('');
  }
  
  getMarkerTypeName(type) {
    const names = {
      'collision': '碰撞风险',
      'no-fly': '禁飞区',
      'battery': '低电量',
      'manual': '人工标记'
    };
    return names[type] || type;
  }
  
  updateStats() {
    if (!this.simulation) return;
    
    const stats = this.simulation.getStats();
    
    document.getElementById('stat-current-time').textContent = this.formatTime(stats.currentTime);
    document.getElementById('stat-total-time').textContent = this.formatTime(stats.totalTime);
    document.getElementById('stat-drone-count').textContent = stats.droneCount;
    document.getElementById('stat-active-drones').textContent = stats.activeDrones;
    document.getElementById('stat-no-fly-count').textContent = stats.noFlyCount;
    
    const collisionEl = document.getElementById('stat-collision-risk');
    if (stats.hasCollisionRisk) {
      collisionEl.textContent = '有风险';
      collisionEl.className = 'stat-value danger';
    } else {
      collisionEl.textContent = '无';
      collisionEl.className = 'stat-value success';
    }
    
    const noFlyEl = document.getElementById('stat-no-fly-violation');
    if (stats.hasNoFlyViolation) {
      noFlyEl.textContent = '违规';
      noFlyEl.className = 'stat-value danger';
    } else {
      noFlyEl.textContent = '无';
      noFlyEl.className = 'stat-value success';
    }
    
    const batteryEl = document.getElementById('stat-battery-warning');
    if (stats.hasBatteryWarning) {
      batteryEl.textContent = '警告';
      batteryEl.className = 'stat-value warning';
    } else {
      batteryEl.textContent = '无';
      batteryEl.className = 'stat-value success';
    }
    
    const minDistEl = document.getElementById('stat-min-distance');
    if (stats.minDistance !== null) {
      minDistEl.textContent = stats.minDistance.toFixed(2) + 'm';
      if (stats.minDistance < 5) {
        minDistEl.className = 'stat-value danger';
      } else if (stats.minDistance < 10) {
        minDistEl.className = 'stat-value warning';
      } else {
        minDistEl.className = 'stat-value success';
      }
    } else {
      minDistEl.textContent = '-';
      minDistEl.className = 'stat-value';
    }
  }
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  
  saveSession() {
    try {
      const sessionData = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        dronesData: this.dronesData,
        noFlyZones: this.noFlyZones,
        beatsData: this.beatsData,
        batteriesData: this.batteriesData,
        markers: this.markers,
        currentTime: this.simulation ? this.simulation.currentTime : 0
      };
      
      const json = JSON.stringify(sessionData, null, 2);
      this.downloadFile(json, 'session.json', 'application/json');
      console.log('会话保存成功');
    } catch (error) {
      console.error('保存会话失败:', error);
      this.showError('保存会话失败: ' + error.message);
    }
  }
  
  async loadSession() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          this.showLoading('加载会话...');
          
          const content = await this.readFileAsText(file);
          const sessionData = JSON.parse(content);
          
          this.dronesData = sessionData.dronesData;
          this.noFlyZones = sessionData.noFlyZones;
          this.beatsData = sessionData.beatsData;
          this.batteriesData = sessionData.batteriesData;
          this.markers = sessionData.markers || [];
          
          await this.initializeSimulation();
          
          if (this.simulation && sessionData.currentTime) {
            this.simulation.seekTo(sessionData.currentTime);
          }
          
          this.updateMarkersUI();
          this.hideLoading();
          console.log('会话加载成功');
        } catch (error) {
          console.error('加载会话失败:', error);
          this.showError('加载会话失败: ' + error.message);
          this.hideLoading();
        }
      };
      
      input.click();
    } catch (error) {
      console.error('加载会话失败:', error);
      this.showError('加载会话失败: ' + error.message);
    }
  }
  
  exportMarkdown() {
    try {
      const content = this.exporter.exportMarkdown();
      this.downloadFile(content, 'report.md', 'text/markdown');
      console.log('Markdown报告导出成功');
    } catch (error) {
      console.error('导出Markdown失败:', error);
      this.showError('导出Markdown失败: ' + error.message);
    }
  }
  
  exportCSV() {
    try {
      const content = this.exporter.exportCSV();
      this.downloadFile(content, 'report.csv', 'text/csv');
      console.log('CSV报告导出成功');
    } catch (error) {
      console.error('导出CSV失败:', error);
      this.showError('导出CSV失败: ' + error.message);
    }
  }
  
  exportJSON() {
    try {
      const content = this.exporter.exportJSON();
      this.downloadFile(content, 'report.json', 'application/json');
      console.log('JSON报告导出成功');
    } catch (error) {
      console.error('导出JSON失败:', error);
      this.showError('导出JSON失败: ' + error.message);
    }
  }
  
  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  showLoading(text = '加载中...') {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('.loading-text').textContent = text;
    overlay.style.display = 'flex';
  }
  
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
  }
  
  showError(message) {
    alert('错误: ' + message);
  }
  
  getSimulation() {
    return this.simulation;
  }
  
  getMarkers() {
    return this.markers;
  }
  
  getDronesData() {
    return this.dronesData;
  }
  
  getNoFlyZones() {
    return this.noFlyZones;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new DroneSimulatorApp();
});
