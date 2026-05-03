import { DataParser } from './modules/dataParser/index.js';
import { RuleEngine } from './modules/ruleEngine/index.js';
import { Renderer3D } from './modules/renderer3d/index.js';
import { ReportExporter } from './modules/reportExporter/index.js';

class ForkliftAnalyzerApp {
  constructor() {
    this.dataParser = new DataParser();
    this.reportExporter = new ReportExporter();
    
    this.warehouseLayout = null;
    this.trajectoryData = null;
    this.pedestrianEvents = [];
    this.safetyRules = null;
    
    this.ruleEngine = null;
    this.renderer3D = null;
    this.analysisResult = null;
    
    this.areAllFilesLoaded = false;
    
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.initRenderer();
  }

  bindElements() {
    this.elements = {
      warehouseLayoutInput: document.getElementById('warehouseLayoutInput'),
      trajectoryInput: document.getElementById('trajectoryInput'),
      pedestrianInput: document.getElementById('pedestrianInput'),
      rulesInput: document.getElementById('rulesInput'),
      
      warehouseStatus: document.getElementById('warehouseStatus'),
      trajectoryStatus: document.getElementById('trajectoryStatus'),
      pedestrianStatus: document.getElementById('pedestrianStatus'),
      rulesStatus: document.getElementById('rulesStatus'),
      
      analyzeBtn: document.getElementById('analyzeBtn'),
      loadSampleBtn: document.getElementById('loadSampleBtn'),
      exportReportBtn: document.getElementById('exportReportBtn'),
      
      playPauseBtn: document.getElementById('playPauseBtn'),
      playIcon: document.getElementById('playIcon'),
      stepBackBtn: document.getElementById('stepBackBtn'),
      stepForwardBtn: document.getElementById('stepForwardBtn'),
      speedSelect: document.getElementById('speedSelect'),
      timeDisplay: document.getElementById('timeDisplay'),
      timelineSlider: document.getElementById('timelineSlider'),
      riskMarkers: document.getElementById('riskMarkers'),
      
      totalRisks: document.getElementById('totalRisks'),
      criticalRisks: document.getElementById('criticalRisks'),
      warningRisks: document.getElementById('warningRisks'),
      blindSpotCount: document.getElementById('blindSpotCount'),
      nearMissCount: document.getElementById('nearMissCount'),
      wrongWayCount: document.getElementById('wrongWayCount'),
      turningCount: document.getElementById('turningCount'),
      
      currentRiskPanel: document.getElementById('currentRiskPanel'),
      warningsPanel: document.getElementById('warningsPanel'),
      warningsList: document.getElementById('warningsList'),
      
      exportModal: document.getElementById('exportModal'),
      exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
      exportJsonBtn: document.getElementById('exportJsonBtn'),
      closeModalBtn: document.getElementById('closeModalBtn')
    };
  }

  bindEvents() {
    this.elements.warehouseLayoutInput.addEventListener('change', (e) => this.handleFileUpload(e, 'warehouse'));
    this.elements.trajectoryInput.addEventListener('change', (e) => this.handleFileUpload(e, 'trajectory'));
    this.elements.pedestrianInput.addEventListener('change', (e) => this.handleFileUpload(e, 'pedestrian'));
    this.elements.rulesInput.addEventListener('change', (e) => this.handleFileUpload(e, 'rules'));
    
    this.elements.analyzeBtn.addEventListener('click', () => this.runAnalysis());
    this.elements.loadSampleBtn.addEventListener('click', () => this.loadSampleData());
    this.elements.exportReportBtn.addEventListener('click', () => this.showExportModal());
    
    this.elements.playPauseBtn.addEventListener('click', () => this.togglePlay());
    this.elements.stepBackBtn.addEventListener('click', () => this.stepBack());
    this.elements.stepForwardBtn.addEventListener('click', () => this.stepForward());
    this.elements.speedSelect.addEventListener('change', (e) => this.setPlaybackSpeed(parseFloat(e.target.value)));
    this.elements.timelineSlider.addEventListener('input', (e) => this.handleTimelineChange(parseFloat(e.target.value)));
    
    this.elements.exportMarkdownBtn.addEventListener('click', () => this.exportReport('markdown'));
    this.elements.exportJsonBtn.addEventListener('click', () => this.exportReport('json'));
    this.elements.closeModalBtn.addEventListener('click', () => this.hideExportModal());
    this.elements.exportModal.addEventListener('click', (e) => {
      if (e.target === this.elements.exportModal) {
        this.hideExportModal();
      }
    });
  }

  initRenderer() {
    try {
      this.renderer3D = new Renderer3D('threeContainer');
      this.renderer3D.onTimeUpdate = (timestamp) => this.updateTimelineFromRenderer(timestamp);
      this.renderer3D.onRiskHighlight = (risk) => this.showCurrentRisk(risk);
    } catch (error) {
      console.error('Failed to initialize 3D renderer:', error);
      alert('无法初始化3D渲染器，请确保浏览器支持WebGL');
    }
  }

  async handleFileUpload(event, fileType) {
    const file = event.target.files[0];
    if (!file) return;

    const statusElement = this.getStatusElement(fileType);
    
    try {
      const content = await this.readFile(file);
      
      switch (fileType) {
        case 'warehouse':
          this.parseWarehouseLayout(content);
          break;
        case 'trajectory':
          this.parseTrajectory(content);
          break;
        case 'pedestrian':
          this.parsePedestrianEvents(content);
          break;
        case 'rules':
          this.parseSafetyRules(content);
          break;
      }

      statusElement.textContent = file.name;
      statusElement.classList.add('has-file');
      
      this.checkAllFilesLoaded();
    } catch (error) {
      statusElement.textContent = `错误: ${error.message}`;
      statusElement.classList.remove('has-file');
      this.showWarning(`${this.getFileTypeLabel(fileType)}解析失败: ${error.message}`);
    }
  }

  async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  parseWarehouseLayout(content) {
    const result = this.dataParser.parseWarehouseLayout(content);
    if (!result.success) {
      throw new Error(result.error);
    }
    this.warehouseLayout = result.data;
    
    if (this.renderer3D) {
      this.renderer3D.loadWarehouseLayout(this.warehouseLayout);
    }
    
    this.showParserWarnings(result.warnings);
  }

  parseTrajectory(content) {
    const result = this.dataParser.parseForkliftTrajectory(content);
    if (!result.success) {
      throw new Error(result.error);
    }
    this.trajectoryData = result.data;
    
    this.showParserWarnings(result.warnings);
  }

  parsePedestrianEvents(content) {
    const result = this.dataParser.parsePedestrianEvents(content);
    if (!result.success) {
      throw new Error(result.error);
    }
    this.pedestrianEvents = result.data;
    
    this.showParserWarnings(result.warnings);
  }

  parseSafetyRules(content) {
    const result = this.dataParser.parseSafetyRules(content);
    if (!result.success) {
      throw new Error(result.error);
    }
    this.safetyRules = result.data;
    
    this.showParserWarnings(result.warnings);
  }

  showParserWarnings(warnings) {
    if (warnings && warnings.length > 0) {
      warnings.forEach(warning => this.showWarning(warning));
    }
  }

  getStatusElement(fileType) {
    const statusMap = {
      warehouse: this.elements.warehouseStatus,
      trajectory: this.elements.trajectoryStatus,
      pedestrian: this.elements.pedestrianStatus,
      rules: this.elements.rulesStatus
    };
    return statusMap[fileType];
  }

  getFileTypeLabel(fileType) {
    const labelMap = {
      warehouse: '仓库布局',
      trajectory: '叉车轨迹',
      pedestrian: '行人事件',
      rules: '安全规则'
    };
    return labelMap[fileType];
  }

  checkAllFilesLoaded() {
    this.areAllFilesLoaded = !!(
      this.warehouseLayout && 
      this.trajectoryData && 
      this.trajectoryData.length > 0 && 
      this.safetyRules
    );
    
    this.elements.analyzeBtn.disabled = !this.areAllFilesLoaded;
  }

  async loadSampleData() {
    try {
      const samplePath = 'samples/';
      
      const [warehouseResponse, trajectoryResponse, pedestrianResponse, rulesResponse] = await Promise.all([
        fetch(samplePath + 'warehouse-layout.json'),
        fetch(samplePath + 'forklift-trajectory.csv'),
        fetch(samplePath + 'pedestrian-events.jsonl'),
        fetch(samplePath + 'safety-rules.yaml')
      ]);

      const warehouseContent = await warehouseResponse.text();
      const trajectoryContent = await trajectoryResponse.text();
      const pedestrianContent = await pedestrianResponse.text();
      const rulesContent = await rulesResponse.text();

      this.parseWarehouseLayout(warehouseContent);
      this.parseTrajectory(trajectoryContent);
      this.parsePedestrianEvents(pedestrianContent);
      this.parseSafetyRules(rulesContent);

      this.elements.warehouseStatus.textContent = 'warehouse-layout.json';
      this.elements.warehouseStatus.classList.add('has-file');
      
      this.elements.trajectoryStatus.textContent = 'forklift-trajectory.csv';
      this.elements.trajectoryStatus.classList.add('has-file');
      
      this.elements.pedestrianStatus.textContent = 'pedestrian-events.jsonl';
      this.elements.pedestrianStatus.classList.add('has-file');
      
      this.elements.rulesStatus.textContent = 'safety-rules.yaml';
      this.elements.rulesStatus.classList.add('has-file');

      this.checkAllFilesLoaded();
      
      if (this.areAllFilesLoaded) {
        await this.runAnalysis();
      }
      
    } catch (error) {
      console.error('Failed to load sample data:', error);
      this.showWarning(`加载示例数据失败: ${error.message}`);
    }
  }

  async runAnalysis() {
    if (!this.areAllFilesLoaded) {
      this.showWarning('请先导入所有必要的数据文件');
      return;
    }

    try {
      this.ruleEngine = new RuleEngine(this.safetyRules, this.warehouseLayout);
      
      this.analysisResult = this.ruleEngine.calculateAllRisks(
        this.trajectoryData,
        this.pedestrianEvents
      );

      this.updateStatistics(this.analysisResult.statistics);
      
      if (this.renderer3D) {
        this.renderer3D.loadTrajectoryData(this.trajectoryData);
        this.renderer3D.loadPedestrianEvents(this.pedestrianEvents);
        this.renderer3D.loadRisks(this.analysisResult.risks, this.safetyRules);
      }

      this.setupTimeline();
      this.createRiskMarkers();

      this.reportExporter.generateReport(this.analysisResult, {
        warehouseName: this.warehouseLayout.name || '未知仓库',
        analysisPeriod: this.getTimeRangeString()
      });

      this.elements.exportReportBtn.disabled = false;
      
      this.showWarning('分析完成！共发现 ' + this.analysisResult.risks.length + ' 个风险事件');
      
    } catch (error) {
      console.error('Analysis failed:', error);
      this.showWarning(`分析失败: ${error.message}`);
    }
  }

  updateStatistics(stats) {
    this.elements.totalRisks.textContent = stats.totalBlindSpotRisks + stats.totalNearMissRisks + 
                                         stats.totalWrongWayRisks + stats.totalTurningBlindSpotRisks;
    this.elements.criticalRisks.textContent = stats.criticalRisks;
    this.elements.warningRisks.textContent = stats.warningRisks;
    
    this.elements.blindSpotCount.textContent = stats.totalBlindSpotRisks;
    this.elements.nearMissCount.textContent = stats.totalNearMissRisks;
    this.elements.wrongWayCount.textContent = stats.totalWrongWayRisks;
    this.elements.turningCount.textContent = stats.totalTurningBlindSpotRisks;
  }

  setupTimeline() {
    if (!this.renderer3D) return;
    
    const timeRange = this.renderer3D.getTimeRange();
    const duration = timeRange.end - timeRange.start;
    
    this.elements.timelineSlider.min = 0;
    this.elements.timelineSlider.max = duration || 100;
    this.elements.timelineSlider.value = 0;
    
    this.updateTimeDisplay(timeRange.start, timeRange.end);
  }

  createRiskMarkers() {
    if (!this.renderer3D || !this.analysisResult) return;
    
    const timeRange = this.renderer3D.getTimeRange();
    const duration = timeRange.end - timeRange.start;
    
    if (duration <= 0) return;

    this.elements.riskMarkers.innerHTML = '';
    
    this.analysisResult.risks.forEach(risk => {
      const position = ((risk.timestamp - timeRange.start) / duration) * 100;
      
      const marker = document.createElement('div');
      marker.className = `risk-marker ${risk.severity}`;
      marker.style.left = `${position}%`;
      marker.title = `${risk.description} (${this.formatTimestamp(risk.timestamp)})`;
      
      this.elements.riskMarkers.appendChild(marker);
    });
  }

  handleTimelineChange(value) {
    if (!this.renderer3D) return;
    
    const timeRange = this.renderer3D.getTimeRange();
    const duration = timeRange.end - timeRange.start;
    const timestamp = timeRange.start + (value / 100) * duration;
    
    this.renderer3D.jumpToTimestamp(timestamp);
  }

  updateTimelineFromRenderer(timestamp) {
    if (!this.renderer3D) return;
    
    const timeRange = this.renderer3D.getTimeRange();
    const duration = timeRange.end - timeRange.start;
    
    if (duration > 0) {
      const value = ((timestamp - timeRange.start) / duration) * 100;
      this.elements.timelineSlider.value = value;
    }
    
    this.updateTimeDisplay(timestamp, timeRange.end);
  }

  updateTimeDisplay(current, end) {
    const currentStr = this.formatTimestamp(current);
    const endStr = this.formatTimestamp(end);
    this.elements.timeDisplay.textContent = `${currentStr} / ${endStr}`;
  }

  togglePlay() {
    if (!this.renderer3D) return;
    
    const isPlaying = this.renderer3D.togglePlay();
    this.elements.playIcon.textContent = isPlaying ? '⏸' : '▶';
  }

  stepBack() {
    if (!this.renderer3D) return;
    
    const timeRange = this.renderer3D.getTimeRange();
    const step = (timeRange.end - timeRange.start) * 0.05;
    const currentTime = this.renderer3D.getCurrentTime();
    
    this.renderer3D.jumpToTimestamp(Math.max(timeRange.start, currentTime - step));
  }

  stepForward() {
    if (!this.renderer3D) return;
    
    const timeRange = this.renderer3D.getTimeRange();
    const step = (timeRange.end - timeRange.start) * 0.05;
    const currentTime = this.renderer3D.getCurrentTime();
    
    this.renderer3D.jumpToTimestamp(Math.min(timeRange.end, currentTime + step));
  }

  setPlaybackSpeed(speed) {
    if (this.renderer3D) {
      this.renderer3D.setPlaybackSpeed(speed);
    }
  }

  showCurrentRisk(risk) {
    if (!risk) {
      this.elements.currentRiskPanel.innerHTML = '<p class="no-risk-text">播放时间轴以查看当前风险</p>';
      return;
    }

    const typeLabels = {
      blind_spot: '货架盲区',
      near_miss: '近失事件',
      wrong_way: '逆行违规',
      turning_blind_spot: '转弯盲区'
    };

    this.elements.currentRiskPanel.innerHTML = `
      <div class="current-risk-item ${risk.severity}">
        <div class="current-risk-title">${typeLabels[risk.type] || risk.type}</div>
        <div class="current-risk-time">时间: ${this.formatTimestamp(risk.timestamp)}</div>
        <div class="current-risk-location">位置: (${risk.location.x.toFixed(1)}, ${risk.location.z.toFixed(1)})</div>
        <div class="current-risk-location">${risk.description}</div>
      </div>
    `;
  }

  showWarning(message) {
    const warningItem = document.createElement('div');
    warningItem.className = 'warning-item';
    warningItem.textContent = message;
    
    this.elements.warningsList.appendChild(warningItem);
    this.elements.warningsPanel.classList.add('visible');
  }

  showExportModal() {
    this.elements.exportModal.classList.add('visible');
  }

  hideExportModal() {
    this.elements.exportModal.classList.remove('visible');
  }

  exportReport(format) {
    try {
      if (format === 'markdown') {
        this.reportExporter.downloadMarkdown('risk-report.md');
      } else {
        this.reportExporter.downloadJSON('risk-report.json');
      }
      this.hideExportModal();
    } catch (error) {
      this.showWarning(`导出失败: ${error.message}`);
    }
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return '00:00:00';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      const hours = Math.floor(timestamp / 3600000) % 24;
      const minutes = Math.floor((timestamp % 3600000) / 60000);
      const seconds = Math.floor((timestamp % 60000) / 1000);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  }

  getTimeRangeString() {
    if (!this.trajectoryData || this.trajectoryData.length === 0) {
      return '未知';
    }
    
    const start = this.trajectoryData[0].timestamp;
    const end = this.trajectoryData[this.trajectoryData.length - 1].timestamp;
    
    return `${this.formatTimestamp(start)} - ${this.formatTimestamp(end)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ForkliftAnalyzerApp();
});
