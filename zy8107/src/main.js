import { SceneManager } from './scene/sceneManager.js';
import { ObjectFactory } from './scene/objectFactory.js';
import { DataLoader } from './core/dataLoader.js';
import { DataValidator } from './core/dataValidator.js';
import { TimelineController } from './animation/timelineController.js';
import { RiskEngine } from './risk/riskEngine.js';
import { ReportExporter } from './report/reportExporter.js';

class LiftPathSimulator {
  constructor() {
    this.sceneManager = null;
    this.dataLoader = null;
    this.dataValidator = null;
    this.timelineController = null;
    this.riskEngine = null;
    this.reportExporter = null;
    
    this.isDataLoaded = false;
    
    this.init();
  }

  async init() {
    try {
      this.sceneManager = new SceneManager('threeCanvas');
      this.setupEventListeners();
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('初始化失败: ' + error.message);
    }
  }

  setupEventListeners() {
    document.getElementById('loadSampleBtn').addEventListener('click', () => {
      this.loadSampleData();
    });
    
    document.getElementById('exportReportBtn').addEventListener('click', () => {
      this.showExportDialog();
    });
    
    document.getElementById('playBtn').addEventListener('click', () => {
      if (this.timelineController) {
        this.timelineController.play();
      }
    });
    
    document.getElementById('pauseBtn').addEventListener('click', () => {
      if (this.timelineController) {
        this.timelineController.pause();
      }
    });
    
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (this.timelineController) {
        this.timelineController.reset();
      }
    });
    
    const timelineSlider = document.getElementById('timelineSlider');
    timelineSlider.addEventListener('input', (e) => {
      if (this.timelineController) {
        const progress = parseFloat(e.target.value) / 100;
        this.timelineController.setProgress(progress);
      }
    });
  }

  async loadSampleData() {
    try {
      this.showLoading('正在加载数据...');
      
      this.dataLoader = new DataLoader();
      const dataResult = await this.dataLoader.loadAllData();
      
      if (dataResult.loadErrors.length > 0) {
        console.warn('数据加载警告:', dataResult.loadErrors);
      }
      
      this.dataValidator = new DataValidator(this.dataLoader);
      this.timelineController = new TimelineController(this.dataLoader);
      this.riskEngine = new RiskEngine(this.dataLoader, this.sceneManager);
      this.reportExporter = new ReportExporter(this.dataLoader, this.dataValidator, this.riskEngine);
      
      this.initializeScene();
      
      this.setupTimelineCallbacks();
      
      this.riskEngine.evaluateAllRisks();
      
      this.updateUI();
      
      this.isDataLoaded = true;
      this.hideLoading();
      
      this.showSuccess('数据加载完成！');
      
    } catch (error) {
      console.error('加载数据失败:', error);
      this.hideLoading();
      this.showError('加载数据失败: ' + error.message);
    }
  }

  initializeScene() {
    this.clearScene();
    
    if (this.dataLoader.craneSpecs?.cranes) {
      const cranePositions = {
        'crane_001': { x: 0, y: 0, z: 0 },
        'crane_002': { x: -25, y: 0, z: 0 }
      };
      
      this.dataLoader.craneSpecs.cranes.forEach(craneSpec => {
        const pos = cranePositions[craneSpec.crane_id] || { x: 0, y: 0, z: 0 };
        const craneModel = ObjectFactory.createCrane(craneSpec, pos);
        this.sceneManager.addObject(`crane_${craneSpec.crane_id}`, craneModel);
      });
    }
    
    if (this.dataLoader.siteLayout?.obstacles) {
      this.dataLoader.siteLayout.obstacles.forEach(obstacle => {
        const obstacleModel = ObjectFactory.createObstacle(obstacle);
        this.sceneManager.addObject(`obstacle_${obstacle.id}`, obstacleModel);
      });
    }
    
    if (this.dataLoader.siteLayout?.outrigger_zones) {
      this.dataLoader.siteLayout.outrigger_zones.forEach(zone => {
        const zoneModel = ObjectFactory.createOutriggerZone(zone);
        this.sceneManager.addObject(`outrigger_${zone.id}`, zoneModel);
      });
    }
    
    if (this.dataLoader.siteLayout?.no_fly_zones) {
      this.dataLoader.siteLayout.no_fly_zones.forEach(zone => {
        const zoneModel = ObjectFactory.createNoFlyZone(zone);
        this.sceneManager.addObject(`nofly_${zone.id}`, zoneModel);
      });
    }
    
    if (this.dataLoader.liftPlan) {
      this.dataLoader.liftPlan.forEach((lift, index) => {
        const waypoints = [
          lift.start_position,
          { ...lift.start_position, y: (lift.start_position.y || 0) + 15 },
          { ...lift.end_position, y: (lift.end_position.y || 0) + 15 },
          lift.end_position
        ];
        
        const pathModel = ObjectFactory.createLiftPath(
          waypoints,
          0xff6b6b + (index * 0x222200)
        );
        this.sceneManager.addObject(`lift_path_${lift.lift_id}`, pathModel);
        
        const loadModel = ObjectFactory.createLoadComponent(lift, lift.start_position);
        this.sceneManager.addObject(`load_${lift.lift_id}`, loadModel);
      });
    }
  }

  clearScene() {
    const objectIds = [];
    this.sceneManager.objects.forEach((_, id) => {
      if (id.startsWith('crane_') || 
          id.startsWith('obstacle_') || 
          id.startsWith('outrigger_') ||
          id.startsWith('nofly_') ||
          id.startsWith('lift_path_') ||
          id.startsWith('load_')) {
        objectIds.push(id);
      }
    });
    objectIds.forEach(id => this.sceneManager.removeObject(id));
  }

  setupTimelineCallbacks() {
    const timelineSlider = document.getElementById('timelineSlider');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    
    if (this.timelineController.totalDuration > 0) {
      totalTimeEl.textContent = `总时长: ${this.timelineController.formatTime(this.timelineController.totalDuration)}`;
    }
    
    this.timelineController.on('onTimeUpdate', (data) => {
      const { currentTime, totalDuration, progress, dateTime } = data;
      
      timelineSlider.value = progress * 100;
      currentTimeEl.textContent = `时间: ${this.formatDateTimeShort(dateTime)}`;
      
      this.updateSceneAnimation(data);
      
      this.updateRiskList(dateTime);
    });
    
    this.updateTimelineMarkers();
  }

  updateSceneAnimation(timeData) {
    const { dateTime } = timeData;
    const liftPlan = this.dataLoader.liftPlan;
    
    if (!liftPlan) return;
    
    const cranePositions = {
      'crane_001': { x: 0, y: 0, z: 0 },
      'crane_002': { x: -25, y: 0, z: 0 }
    };
    
    liftPlan.forEach(lift => {
      if (!lift.start_time || !lift.end_time) return;
      
      const isActive = dateTime >= lift.start_time && dateTime <= lift.end_time;
      const hasStarted = dateTime >= lift.start_time;
      const hasEnded = dateTime > lift.end_time;
      
      if (isActive) {
        const progress = this.calculateLiftProgress(lift, dateTime);
        this.animateLift(lift, progress, cranePositions);
      } else if (hasEnded) {
        this.showLoadAtPosition(lift, lift.end_position);
      } else {
        this.showLoadAtPosition(lift, lift.start_position);
      }
    });
  }

  animateLift(lift, progress, cranePositions) {
    const craneId = lift.crane_id;
    const cranePos = cranePositions[craneId] || { x: 0, y: 0, z: 0 };
    
    const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    const currentPos = {
      x: lift.start_position.x + (lift.end_position.x - lift.start_position.x) * easeProgress,
      y: lift.start_position.y + (lift.end_position.y - lift.start_position.y) * easeProgress,
      z: lift.start_position.z + (lift.end_position.z - lift.start_position.z) * easeProgress
    };
    
    const midHeight = Math.max(lift.start_position.y, lift.end_position.y) + 20;
    const heightProgress = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2;
    currentPos.y = currentPos.y + midHeight * heightProgress * 0.8;
    
    this.updateCraneAnimation(craneId, cranePos, currentPos, lift.boom_length || 48);
    this.showLoadAtPosition(lift, currentPos);
  }

  updateCraneAnimation(craneId, cranePos, targetPos, boomLength) {
    const crane = this.sceneManager.getObject(`crane_${craneId}`);
    if (!crane) return;
    
    const rotatingPlatform = crane.getObjectByName('rotatingPlatform');
    if (!rotatingPlatform) return;
    
    const dx = targetPos.x - cranePos.x;
    const dz = targetPos.z - cranePos.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalDistance = targetPos.y - cranePos.y;
    
    const swingAngle = Math.atan2(dx, dz);
    rotatingPlatform.rotation.y = swingAngle;
    
    const boom = rotatingPlatform.getObjectByName('boom');
    if (boom) {
      const boomAngle = Math.atan2(verticalDistance, horizontalDistance);
      boom.rotation.z = Math.max(0.3, Math.min(Math.PI * 0.7, boomAngle));
    }
    
    const hookSystem = rotatingPlatform.getObjectByName('hookSystem');
    if (hookSystem) {
      hookSystem.position.set(horizontalDistance, verticalDistance, 0);
    }
  }

  showLoadAtPosition(lift, position) {
    const loadId = `load_${lift.lift_id}`;
    const load = this.sceneManager.getObject(loadId);
    if (load) {
      load.position.set(position.x, position.y, position.z);
    }
  }

  calculateLiftProgress(lift, currentDateTime) {
    if (!lift.start_time || !lift.end_time) return 0;
    const totalDuration = lift.end_time.getTime() - lift.start_time.getTime();
    const elapsed = currentDateTime.getTime() - lift.start_time.getTime();
    return Math.max(0, Math.min(1, elapsed / totalDuration));
  }

  updateUI() {
    this.updateDataInfo();
    this.updateRiskList();
  }

  updateDataInfo() {
    const dataInfoEl = document.getElementById('dataInfo');
    
    if (!this.dataLoader) {
      dataInfoEl.innerHTML = '<p class="empty-message">未加载数据</p>';
      return;
    }
    
    const liftCount = this.dataLoader.liftPlan?.length || 0;
    const obstacleCount = this.dataLoader.siteLayout?.obstacles?.length || 0;
    const craneCount = this.dataLoader.craneSpecs?.cranes?.length || 0;
    
    const dangerCount = this.riskEngine.getRisksBySeverity('danger').length;
    const warningCount = this.riskEngine.getRisksBySeverity('warning').length;
    
    dataInfoEl.innerHTML = `
      <div class="data-row">
        <span class="data-label">场地名称</span>
        <span class="data-value">${this.dataLoader.siteLayout?.site_name || '未命名'}</span>
      </div>
      <div class="data-row">
        <span class="data-label">吊装任务</span>
        <span class="data-value">${liftCount} 个</span>
      </div>
      <div class="data-row">
        <span class="data-label">障碍物</span>
        <span class="data-value">${obstacleCount} 个</span>
      </div>
      <div class="data-row">
        <span class="data-label">吊机数量</span>
        <span class="data-value">${craneCount} 台</span>
      </div>
      <div class="data-row">
        <span class="data-label">严重风险</span>
        <span class="data-value" style="color: #dc3545;">${dangerCount} 项</span>
      </div>
      <div class="data-row">
        <span class="data-label">警告风险</span>
        <span class="data-value" style="color: #ffc107;">${warningCount} 项</span>
      </div>
    `;
  }

  updateRiskList(currentDateTime = null) {
    const riskListEl = document.getElementById('riskList');
    
    if (!this.riskEngine || this.riskEngine.risks.length === 0) {
      riskListEl.innerHTML = '<p class="empty-message">未检测到风险</p>';
      return;
    }
    
    const risks = currentDateTime 
      ? this.riskEngine.getRisksAtTime(currentDateTime)
      : this.riskEngine.risks;
    
    if (risks.length === 0) {
      riskListEl.innerHTML = '<p class="empty-message">当前时间无活跃风险</p>';
      return;
    }
    
    const sortedRisks = [...risks].sort((a, b) => {
      const severityOrder = { danger: 0, warning: 1 };
      return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
    });
    
    let html = '';
    
    sortedRisks.forEach((risk, index) => {
      const severityClass = risk.severity === 'danger' ? 'danger' : 'warning';
      const timeText = risk.time_range && risk.time_range.start 
        ? `${this.formatDateTimeShort(risk.time_range.start)} - ${this.formatDateTimeShort(risk.time_range.end)}`
        : '全场';
      
      html += `
        <div class="risk-item ${severityClass}" data-risk-id="${risk.id}">
          <div class="risk-title">${risk.title}</div>
          <div class="risk-time">时间: ${timeText}</div>
          <div class="risk-details">${risk.message}</div>
        </div>
      `;
    });
    
    riskListEl.innerHTML = html;
    
    const validationIssues = this.dataValidator?.validateAll() || [];
    if (validationIssues.length > 0) {
      const crossDayIssues = validationIssues.filter(i => i.type === 'cross_day' || i.type === 'night_work');
      const missingParamIssues = validationIssues.filter(i => i.type === 'missing_param');
      
      if (crossDayIssues.length > 0) {
        html += '<div class="cross-day-warning">';
        html += '<h4>⚠️ 跨天/夜间作业提示</h4>';
        crossDayIssues.forEach(issue => {
          html += `<p>${issue.message}</p>`;
        });
        html += '</div>';
      }
      
      if (missingParamIssues.length > 0) {
        html += '<div class="missing-param-warning">';
        html += '<h4>⚠️ 缺失参数提示</h4>';
        missingParamIssues.forEach(issue => {
          html += `<p>${issue.title}: ${issue.suggestion}</p>`;
        });
        html += '</div>';
      }
    }
  }

  updateTimelineMarkers() {
    const markersContainer = document.getElementById('timelineMarkers');
    if (!this.timelineController) return;
    
    const markers = this.timelineController.getTimelineMarkers();
    
    let html = '';
    markers.forEach(marker => {
      const leftPercent = marker.progress * 100;
      html += `
        <div class="marker" style="left: ${leftPercent}%;">
          <div class="marker-label">${marker.label}</div>
        </div>
      `;
    });
    
    markersContainer.innerHTML = html;
  }

  showExportDialog() {
    if (!this.reportExporter) {
      this.showError('请先加载数据');
      return;
    }
    
    const format = confirm('点击确定导出 Markdown 格式，取消导出 JSON 格式');
    
    if (format) {
      this.reportExporter.downloadMarkdown();
      this.showSuccess('Markdown 报告已导出');
    } else {
      this.reportExporter.downloadJSON();
      this.showSuccess('JSON 报告已导出');
    }
  }

  formatDateTimeShort(date) {
    if (!date) return '-';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }

  showLoading(message) {
    const overlay = document.getElementById('sceneOverlay');
    overlay.innerHTML = `<div style="padding: 10px;">${message}</div>`;
  }

  hideLoading() {
    const overlay = document.getElementById('sceneOverlay');
    overlay.innerHTML = '';
  }

  showError(message) {
    alert('错误: ' + message);
  }

  showSuccess(message) {
    console.log(message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.liftSimulator = new LiftPathSimulator();
});
