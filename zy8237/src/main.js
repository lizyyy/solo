import dayjs from 'dayjs';
import { SceneManager } from './sceneManager.js';
import { AnimationController } from './animationController.js';
import { PlaybackEngine } from './playbackEngine.js';
import { dataParser } from './dataParser.js';
import { riskDetector } from './riskDetector.js';
import { sampleData } from './sampleData.js';

class App {
  constructor() {
    this.sceneManager = null;
    this.animationController = null;
    this.playbackEngine = null;
    
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.lastFPSUpdate = 0;
    
    this.risks = [];
    
    this.init();
  }

  async init() {
    const container = document.getElementById('scene-container');
    
    this.sceneManager = new SceneManager(container);
    this.animationController = new AnimationController(this.sceneManager);
    this.playbackEngine = new PlaybackEngine(this.sceneManager, this.animationController);

    this.playbackEngine.onRiskDetected = (risk) => {
      this.risks.push(risk);
      this.addRiskToUI(risk);
      this.highlightRiskInScene(risk);
    };

    this.playbackEngine.onTimeUpdate = (time) => {
      this.updateTimeDisplay(time);
    };

    this.setupEventListeners();
    this.setupUI();
    
    setTimeout(() => {
      this.hideLoading();
      this.animate();
    }, 500);
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  setupEventListeners() {
    const btnPlay = document.getElementById('btn-play');
    const btnPause = document.getElementById('btn-pause');
    const btnReset = document.getElementById('btn-reset');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    const btnLoadSample = document.getElementById('btn-load-sample');
    const btnExportJson = document.getElementById('btn-export-json');
    const btnExportReport = document.getElementById('btn-export-report');
    const viewTop = document.getElementById('view-top');
    const viewFront = document.getElementById('view-front');
    const viewSide = document.getElementById('view-side');
    const viewFree = document.getElementById('view-free');
    const btnToggleFloors = document.getElementById('btn-toggle-floors');
    const btnToggleLabels = document.getElementById('btn-toggle-labels');

    if (btnPlay) {
      btnPlay.addEventListener('click', () => this.play());
    }
    if (btnPause) {
      btnPause.addEventListener('click', () => this.pause());
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => this.reset());
    }
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        this.playbackSpeed = parseFloat(e.target.value);
        if (speedValue) speedValue.textContent = `${this.playbackSpeed.toFixed(1)}x`;
        this.playbackEngine.setPlaybackSpeed(this.playbackSpeed);
      });
    }
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => this.loadSampleData());
    }
    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => this.exportAnomalyJson());
    }
    if (btnExportReport) {
      btnExportReport.addEventListener('click', () => this.exportReviewReport());
    }

    const viewButtons = [viewTop, viewFront, viewSide, viewFree];
    const viewTypes = ['top', 'front', 'side', 'free'];
    
    viewButtons.forEach((btn, index) => {
      if (btn) {
        btn.addEventListener('click', () => {
          viewButtons.forEach(b => b?.classList.remove('active'));
          btn.classList.add('active');
          this.sceneManager.setView(viewTypes[index]);
        });
      }
    });

    if (btnToggleFloors) {
      btnToggleFloors.addEventListener('click', () => {
        this.sceneManager.toggleFloors();
      });
    }
    if (btnToggleLabels) {
      btnToggleLabels.addEventListener('click', () => {
        this.sceneManager.toggleLabels();
      });
    }
  }

  setupUI() {
    const riskList = document.getElementById('risk-list');
    if (riskList) {
      riskList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <p>点击"加载示例数据"开始</p>
          <p style="font-size: 11px; margin-top: 4px; color: #555;">或导入您自己的数据文件</p>
        </div>
      `;
    }
  }

  async loadSampleData() {
    try {
      this.reset();
      
      await dataParser.parseGarageStructure(sampleData.garageStructure);
      await dataParser.parseReservations(sampleData.reservationsCsv);
      await dataParser.parseScheduleCommands(sampleData.scheduleCommandsJsonl);
      await dataParser.parseDeviceRules(sampleData.deviceRulesYaml);

      const allData = dataParser.getAllData();
      await this.playbackEngine.loadData(allData);

      this.updateTimeRangeDisplay(allData.timeRange);
      this.createTimelineTicks(allData.timeRange);
      
      this.risks = [];
      this.clearRiskList();

      console.log('示例数据加载成功');
    } catch (error) {
      console.error('加载示例数据失败:', error);
      alert(`加载数据失败: ${error.message}`);
    }
  }

  updateTimeRangeDisplay(timeRange) {
    const totalTimeEl = document.getElementById('total-time');
    const currentTimeEl = document.getElementById('current-time');
    
    if (totalTimeEl) {
      totalTimeEl.textContent = this.formatTime(timeRange.end);
    }
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(timeRange.start);
    }
  }

  createTimelineTicks(timeRange) {
    const ticksContainer = document.getElementById('timeline-ticks');
    if (!ticksContainer) return;

    ticksContainer.innerHTML = '';

    const start = dayjs(timeRange.start);
    const end = dayjs(timeRange.end);
    const duration = end.diff(start, 'second');
    
    const tickCount = Math.min(10, Math.floor(duration / 60) + 1);
    
    for (let i = 0; i <= tickCount; i++) {
      const percent = i / tickCount;
      const time = start.add(percent * duration, 'second');
      
      const tick = document.createElement('div');
      tick.className = 'timeline-tick';
      tick.style.left = `${percent * 100}%`;
      ticksContainer.appendChild(tick);

      if (i % 2 === 0 || tickCount <= 5) {
        const label = document.createElement('div');
        label.className = 'timeline-tick-label';
        label.style.left = `${percent * 100}%`;
        label.textContent = time.format('HH:mm:ss');
        ticksContainer.appendChild(label);
      }
    }
  }

  updateTimeDisplay(timestamp) {
    const currentTimeEl = document.getElementById('current-time');
    const progressEl = document.getElementById('timeline-progress');
    const markerEl = document.getElementById('timeline-marker');
    
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(timestamp);
    }

    const timeRange = dataParser.getTimeRange();
    if (timeRange.start && timeRange.end) {
      const start = dayjs(timeRange.start).valueOf();
      const end = dayjs(timeRange.end).valueOf();
      const progress = (timestamp - start) / (end - start);
      
      if (progressEl) {
        progressEl.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
      }
      if (markerEl) {
        markerEl.style.left = `${Math.max(0, Math.min(100, progress * 100))}%`;
      }
    }
  }

  formatTime(timestamp) {
    return dayjs(timestamp).format('HH:mm:ss');
  }

  play() {
    if (!this.playbackEngine.data) {
      alert('请先加载数据');
      return;
    }
    this.isPlaying = true;
    this.playbackEngine.play();
  }

  pause() {
    this.isPlaying = false;
    this.playbackEngine.pause();
  }

  reset() {
    this.isPlaying = false;
    this.playbackEngine.reset();
    this.risks = [];
    this.clearRiskList();
    this.sceneManager.clearHighlights();
    this.sceneManager.clearTrajectories();
    
    const currentTimeEl = document.getElementById('current-time');
    const progressEl = document.getElementById('timeline-progress');
    const markerEl = document.getElementById('timeline-marker');
    
    if (currentTimeEl) currentTimeEl.textContent = '00:00:00';
    if (progressEl) progressEl.style.width = '0%';
    if (markerEl) markerEl.style.left = '0%';
  }

  clearRiskList() {
    const riskList = document.getElementById('risk-list');
    if (!riskList) return;

    riskList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <p>暂无检测到风险</p>
        <p style="font-size: 11px; margin-top: 4px; color: #555;">播放后将自动开始检测</p>
      </div>
    `;
  }

  addRiskToUI(risk) {
    const riskList = document.getElementById('risk-list');
    if (!riskList) return;

    const emptyState = riskList.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const severityClass = risk.type.severity;
    const timeStr = dayjs(risk.time).format('HH:mm:ss');

    const riskItem = document.createElement('div');
    riskItem.className = `risk-item ${severityClass}`;
    riskItem.innerHTML = `
      <div class="risk-header">
        <span class="risk-type">${risk.type.name}</span>
        <span class="risk-time">${timeStr}</span>
      </div>
      <div class="risk-description">${risk.description}</div>
      ${risk.details ? `
        <div class="risk-details">
          ${this.formatRiskDetails(risk.details)}
        </div>
      ` : ''}
    `;

    riskItem.addEventListener('click', () => {
      this.highlightRiskInScene(risk);
    });

    riskList.appendChild(riskItem);
    riskList.scrollTop = riskList.scrollHeight;
  }

  formatRiskDetails(details) {
    if (!details) return '';
    
    const lines = [];
    for (const [key, value] of Object.entries(details)) {
      if (Array.isArray(value)) continue;
      if (typeof value === 'object') continue;
      
      const keyName = this.translateKey(key);
      lines.push(`<div><strong>${keyName}:</strong> ${value}</div>`);
    }
    return lines.join('');
  }

  translateKey(key) {
    const translations = {
      slotId: '车位ID',
      currentVehicle: '当前车辆',
      newVehicle: '新车辆',
      commandId: '指令ID',
      lineNumber: '行号',
      elevatorId: '升降机ID',
      currentTask: '当前任务',
      newTask: '新任务',
      targetFloor: '目标楼层',
      currentFloor: '当前楼层',
      vehicleId: '车辆ID',
      blockingVehicles: '阻挡车辆',
      taskId: '任务ID',
      startTime: '开始时间',
      currentTime: '当前时间',
      elapsedSeconds: '已用秒数',
      timeLimit: '时间限制',
      vehicleWeight: '车辆重量',
      maxCapacity: '最大载重',
      overWeight: '超重'
    };
    return translations[key] || key;
  }

  highlightRiskInScene(risk) {
    this.sceneManager.clearHighlights();
    
    if (risk.position) {
      const highlightType = risk.type.severity === 'critical' ? 'critical' :
                           risk.type.severity === 'error' ? 'error' : 'warning';
      this.sceneManager.addHighlight(risk.position, highlightType);
    }

    if (risk.details?.slotId) {
      this.sceneManager.updateSlotStatus(risk.details.slotId, 'conflict');
    }

    if (risk.details?.elevatorId) {
      const elevatorData = this.sceneManager.elevatorMeshes.get(risk.details.elevatorId);
      if (elevatorData) {
        this.sceneManager.updateElevatorStatus(
          risk.details.elevatorId,
          elevatorData.currentFloor,
          'conflict'
        );
      }
    }
  }

  exportAnomalyJson() {
    const exportData = riskDetector.exportToJSON();
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `anomaly_frames_${dayjs().format('YYYYMMDD_HHmmss')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('异常帧数据已导出:', exportData);
  }

  exportReviewReport() {
    const stats = riskDetector.getRiskStatistics();
    const risks = riskDetector.getAllRisks();
    const dataInfo = dataParser.getAllData();

    let report = `# 立体停车库调度复核报告\n\n`;
    report += `**生成时间**: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    
    report += `## 1. 数据概览\n\n`;
    report += `- **车库结构**: ${dataInfo.garageStructure?.name || '未加载'}\n`;
    report += `- **总层数**: ${dataInfo.garageStructure?.floors?.length || 0}\n`;
    report += `- **总车位数**: ${dataInfo.garageStructure?.totalSlots || 0}\n`;
    report += `- **升降机数量**: ${dataInfo.garageStructure?.elevators?.length || 0}\n`;
    report += `- **预约记录**: ${dataInfo.reservations?.length || 0}\n`;
    report += `- **调度指令**: ${dataInfo.scheduleCommands?.length || 0}\n\n`;

    report += `## 2. 风险统计\n\n`;
    report += `- **总风险数**: ${stats.total}\n`;
    report += `- **严重风险**: ${stats.bySeverity.critical}\n`;
    report += `- **错误风险**: ${stats.bySeverity.error}\n`;
    report += `- **警告风险**: ${stats.bySeverity.warning}\n\n`;

    report += `### 2.1 风险类型分布\n\n`;
    for (const [typeId, typeInfo] of Object.entries(stats.byType)) {
      report += `- **${typeInfo.name}**: ${typeInfo.count} (${typeInfo.severity})\n`;
    }
    report += `\n`;

    if (risks.length > 0) {
      report += `## 3. 风险详情\n\n`;
      
      risks.forEach((risk, index) => {
        report += `### ${index + 1}. ${risk.type.name}\n\n`;
        report += `- **时间**: ${dayjs(risk.time).format('YYYY-MM-DD HH:mm:ss')}\n`;
        report += `- **严重程度**: ${risk.type.severity}\n`;
        report += `- **描述**: ${risk.description}\n`;
        
        if (risk.details) {
          report += `- **详细信息**:\n`;
          for (const [key, value] of Object.entries(risk.details)) {
            if (Array.isArray(value)) continue;
            if (typeof value === 'object') continue;
            report += `  - ${this.translateKey(key)}: ${value}\n`;
          }
        }
        
        if (risk.position) {
          report += `- **位置**: (${risk.position.x.toFixed(2)}, ${risk.position.y?.toFixed(2) || 0}, ${risk.position.z.toFixed(2)})\n`;
        }
        
        report += `\n---\n\n`;
      });
    }

    report += `## 4. 建议\n\n`;
    
    if (stats.bySeverity.critical > 0) {
      report += `### 紧急处理\n\n`;
      report += `检测到 ${stats.bySeverity.critical} 个严重风险，建议立即处理：\n`;
      report += `- 检查车位重复占用问题\n`;
      report += `- 检查设备超载情况\n`;
      report += `- 审查调度算法的冲突检测逻辑\n\n`;
    }

    if (stats.bySeverity.error > 0) {
      report += `### 需要修复\n\n`;
      report += `检测到 ${stats.bySeverity.error} 个错误风险：\n`;
      report += `- 检查升降机抢占问题\n`;
      report += `- 优化路径规划避免通道阻塞\n\n`;
    }

    if (stats.bySeverity.warning > 0) {
      report += `### 建议优化\n\n`;
      report += `检测到 ${stats.bySeverity.warning} 个警告风险：\n`;
      report += `- 优化入库/取车流程效率\n`;
      report += `- 检查任务超时阈值设置是否合理\n\n`;
    }

    report += `---\n\n`;
    report += `*此报告由立体停车库调度三维复核工具自动生成*\n`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `review_report_${dayjs().format('YYYYMMDD_HHmmss')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('复核报告已导出');
  }

  animate(currentTime = 0) {
    requestAnimationFrame((t) => this.animate(t));

    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    this.frameCount++;
    if (currentTime - this.lastFPSUpdate >= 1000) {
      const fpsEl = document.getElementById('stat-fps');
      const frameEl = document.getElementById('stat-frame');
      
      if (fpsEl) fpsEl.textContent = this.frameCount;
      if (frameEl) frameEl.textContent = Math.floor(this.playbackEngine.currentCommandIndex || 0);
      
      this.frameCount = 0;
      this.lastFPSUpdate = currentTime;
    }

    this.animationController.update(deltaTime);
    this.sceneManager.render();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
