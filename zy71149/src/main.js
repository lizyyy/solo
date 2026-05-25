import { SceneManager } from './core/SceneManager.js';
import { ValidationEngine } from './core/ValidationEngine.js';
import { TimelineController } from './core/TimelineController.js';
import { ReportGenerator } from './core/ReportGenerator.js';
import { sampleFactoryLayout, validationSettings } from './data/sampleData.js';

class HazardousRouteSandbox {
  constructor() {
    this.canvas = document.getElementById('scene-canvas');
    this.sceneManager = null;
    this.validationEngine = new ValidationEngine();
    this.timelineController = null;
    this.reportGenerator = new ReportGenerator();
    
    this.routePoints = [];
    this.zones = [];
    this.factoryLayout = null;
    this.selectedElementType = null;
    this.validationResult = null;
    this.currentReport = null;
    this.initialZones = null;
    this.initialRoute = null;
    
    this.init();
  }

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  init() {
    this.sceneManager = new SceneManager(this.canvas);
    this.timelineController = new TimelineController(this.sceneManager);
    
    this.setupEventListeners();
    this.loadSampleData();
  }

  setupEventListeners() {
    document.querySelectorAll('.element-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        this.selectElementType(type);
      });
    });

    this.sceneManager.onGroundClick = (point) => {
      if (this.selectedElementType === 'truck') {
        this.sceneManager.createVehicle({ x: point.x, z: point.z });
        this.updateHint('车辆已创建，点击场景添加路径点');
        this.selectElementType(null);
      } else if (this.selectedElementType === 'speedZone') {
        this.createZone('speedZone', point);
        this.updateHint('限速区已创建，可拖拽移动位置');
        this.selectElementType(null);
      } else if (this.selectedElementType === 'noStopZone') {
        this.createZone('noStopZone', point);
        this.updateHint('禁停区已创建，可拖拽移动位置');
        this.selectElementType(null);
      } else if (this.selectedElementType === 'washPoint') {
        this.createZone('washPoint', point);
        this.updateHint('洗消点已创建，可拖拽移动位置');
        this.selectElementType(null);
      } else if (!this.selectedElementType) {
        this.addRoutePoint(point);
      }
    };

    this.sceneManager.onObjectClick = (userData, point) => {
      if (this.selectedElementType) {
        return;
      }
      if (userData.type && userData.type !== 'truck' && userData.type !== 'ground') {
        const zone = this.zones.find(z => z.id === userData.id);
        if (zone) {
          this.updateHint(`已选中 ${zone.name || userData.type}，可拖拽移动`);
        }
      }
    };

    this.sceneManager.onObjectDrag = (userData, newPosition) => {
      const zoneIndex = this.zones.findIndex(z => z.id === userData.id);
      if (zoneIndex !== -1) {
        this.zones[zoneIndex].position = { ...newPosition };
        this.updateHint(`正在移动 ${this.zones[zoneIndex].name || userData.type}`);
      }
    };

    document.getElementById('btn-add-point').addEventListener('click', () => {
      const x = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 60;
      this.addRoutePoint({ x, z });
    });

    document.getElementById('btn-clear-route').addEventListener('click', () => {
      this.clearRoute();
    });

    document.getElementById('btn-validate').addEventListener('click', () => {
      this.validateRoute();
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      this.loadSampleData();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      this.exportReport();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      this.resetAll();
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.sceneManager.setView(view);
        
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      this.timelineController.play();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.timelineController.pause();
    });

    document.getElementById('btn-speed-up').addEventListener('click', () => {
      this.timelineController.speedUp();
    });

    document.getElementById('btn-speed-down').addEventListener('click', () => {
      this.timelineController.speedDown();
    });

    document.getElementById('timeline-slider').addEventListener('input', (e) => {
      const progress = parseFloat(e.target.value) / 100;
      const time = progress * this.timelineController.duration;
      this.timelineController.setTime(time);
    });

    this.timelineController.onTimeUpdate = (current, duration) => {
      const slider = document.getElementById('timeline-slider');
      const timeDisplay = document.getElementById('timeline-time');
      slider.value = (current / duration) * 100;
      timeDisplay.textContent = this.timelineController.formatTime(current);
    };

    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeModal());
    document.getElementById('btn-download-report').addEventListener('click', () => {
      if (this.currentReport) {
        this.reportGenerator.downloadReport(this.currentReport);
      }
    });

    document.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal();
      }
    });

    document.querySelectorAll('.element-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = e.currentTarget.dataset.toggle;
        this.toggleTypeVisibility(type);
      });
    });
  }

  selectElementType(type) {
    this.selectedElementType = type;
    
    document.querySelectorAll('.element-item').forEach(item => {
      item.classList.toggle('active', item.dataset.type === type);
    });

    const hints = {
      truck: '点击场景放置危化车辆',
      speedZone: '点击场景创建限速区',
      noStopZone: '点击场景创建禁停区',
      washPoint: '点击场景创建洗消点',
      null: '点击场景添加路径点'
    };
    this.updateHint(hints[type] || hints.null);
  }

  createZone(type, point) {
    const id = `${type}_${Date.now()}`;
    const names = {
      speedZone: '新建限速区',
      noStopZone: '新建禁停区',
      washPoint: '新建洗消点'
    };
    const sizes = {
      speedZone: { width: 10, height: 10 },
      noStopZone: { width: 12, height: 12 },
      washPoint: { radius: 4 }
    };

    const zone = {
      id,
      type,
      name: names[type],
      position: { x: Math.round(point.x * 10) / 10, z: Math.round(point.z * 10) / 10 },
      size: sizes[type],
      speedLimit: type === 'speedZone' ? 30 : undefined
    };

    this.zones.push(zone);
    this.sceneManager.createZone(type, zone.position, zone.size, id);
  }

  updateHint(text) {
    const hintEl = document.getElementById('action-hint');
    if (hintEl) {
      hintEl.textContent = text;
    }
  }

  toggleTypeVisibility(type) {
    const isVisible = this.sceneManager.toggleTypeVisibility(type);
    const toggleEl = document.querySelector(`[data-toggle="${type}"]`);
    const itemEl = document.querySelector(`[data-type="${type}"]`);
    
    if (toggleEl) {
      toggleEl.textContent = isVisible ? '👁️' : '👁️‍🗨️';
      toggleEl.classList.toggle('disabled', !isVisible);
    }
    
    if (itemEl) {
      itemEl.classList.toggle('hidden-type', !isVisible);
    }

    const status = isVisible ? '显示' : '隐藏';
    const names = {
      speedZone: '限速区',
      noStopZone: '禁停区',
      washPoint: '洗消点'
    };
    this.updateHint(`${status}${names[type]}`);
  }

  addRoutePoint(point) {
    const routePoint = { x: Math.round(point.x * 10) / 10, z: Math.round(point.z * 10) / 10 };
    this.routePoints.push(routePoint);
    this.updateRouteDisplay();
    this.updateRoutePointsList();
  }

  removeRoutePoint(index) {
    this.routePoints.splice(index, 1);
    this.updateRouteDisplay();
    this.updateRoutePointsList();
  }

  clearRoute() {
    this.routePoints = [];
    this.updateRouteDisplay();
    this.updateRoutePointsList();
    this.validationResult = null;
    this.updateValidationDisplay();
  }

  updateRouteDisplay() {
    this.sceneManager.createRouteLine(this.routePoints);
    this.timelineController.setRoute(this.routePoints);
  }

  updateRoutePointsList() {
    const container = document.getElementById('route-points');
    
    if (this.routePoints.length === 0) {
      container.innerHTML = '<p class="empty-text">点击场景添加路径点</p>';
      return;
    }

    container.innerHTML = this.routePoints.map((point, index) => `
      <div class="route-point-item">
        <span>点 ${index + 1}: (${point.x}, ${point.z})</span>
        <span class="point-delete" data-index="${index}">×</span>
      </div>
    `).join('');

    container.querySelectorAll('.point-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.removeRoutePoint(index);
      });
    });
  }

  validateRoute() {
    if (this.routePoints.length < 2) {
      this.showValidationResult([{
        type: 'warning',
        message: '请至少添加2个路径点',
        passed: false
      }]);
      return;
    }

    this.validationResult = this.validationEngine.validate(
      this.routePoints,
      this.zones,
      validationSettings
    );

    this.updateValidationDisplay();
    
    this.currentReport = this.reportGenerator.generateReport(
      this.validationResult,
      this.routePoints,
      this.zones,
      this.factoryLayout
    );

    this.showModal();
  }

  updateValidationDisplay() {
    const container = document.getElementById('validation-results');
    
    if (!this.validationResult) {
      container.innerHTML = '<p class="empty-text">点击"开始校验"检查路线</p>';
      return;
    }

    container.innerHTML = this.validationResult.details.map(item => `
      <div class="validation-item ${item.passed ? 'success' : item.type}">
        <div><strong>${item.ruleName}</strong></div>
        <div>${item.message}</div>
      </div>
    `).join('');
  }

  loadSampleData() {
    this.sceneManager.removeAllZones();
    
    this.factoryLayout = this.deepClone(sampleFactoryLayout);
    this.zones = this.deepClone(sampleFactoryLayout.zones);
    
    this.initialZones = this.deepClone(this.zones);
    this.initialRoute = this.deepClone(sampleFactoryLayout.recommendedRoute);
    
    this.sceneManager.createRoadNetwork(sampleFactoryLayout.roads);
    
    this.zones.forEach(zone => {
      this.sceneManager.createZone(zone.type, zone.position, zone.size, zone.id);
    });

    this.sceneManager.createVehicle({ x: -30, z: -20 });
    
    this.routePoints = this.deepClone(sampleFactoryLayout.recommendedRoute);
    this.updateRouteDisplay();
    this.updateRoutePointsList();
    
    this.validationResult = null;
    this.updateValidationDisplay();
  }

  exportReport() {
    if (!this.validationResult) {
      this.validateRoute();
      return;
    }

    if (this.currentReport) {
      this.reportGenerator.downloadReport(this.currentReport);
    }
  }

  resetAll() {
    this.sceneManager.removeAllZones();
    
    if (this.initialZones && this.initialRoute) {
      this.zones = this.deepClone(this.initialZones);
      this.routePoints = this.deepClone(this.initialRoute);
    } else {
      this.zones = this.deepClone(sampleFactoryLayout.zones);
      this.routePoints = this.deepClone(sampleFactoryLayout.recommendedRoute);
      this.initialZones = this.deepClone(this.zones);
      this.initialRoute = this.deepClone(this.routePoints);
    }
    
    this.zones.forEach(zone => {
      this.sceneManager.createZone(zone.type, zone.position, zone.size, zone.id);
    });
    
    this.validationResult = null;
    this.currentReport = null;
    this.timelineController.reset();
    
    this.updateRouteDisplay();
    this.updateRoutePointsList();
    this.updateValidationDisplay();
    
    this.sceneManager.createVehicle({ x: -30, z: -20 });
  }

  showModal() {
    const modal = document.getElementById('report-modal');
    const content = document.getElementById('report-content');
    
    if (!this.currentReport) return;

    const report = this.currentReport;
    content.innerHTML = `
      <div class="report-section">
        <h3>路线概览</h3>
        <div class="report-item">
          <span class="report-label">路径点数</span>
          <span class="report-value">${report.summary.totalPoints}</span>
        </div>
        <div class="report-item">
          <span class="report-label">总距离</span>
          <span class="report-value">${report.summary.totalDistance} 米</span>
        </div>
        <div class="report-item">
          <span class="report-label">预计时间</span>
          <span class="report-value">${report.summary.estimatedTime} 分钟</span>
        </div>
        <div class="report-item">
          <span class="report-label">校验结果</span>
          <span class="report-value ${report.summary.isValid ? 'success' : 'error'}">
            ${report.summary.isValid ? '通过' : '不通过'}
          </span>
        </div>
        <div class="report-item">
          <span class="report-label">错误/警告</span>
          <span class="report-value">
            <span class="error">${report.summary.errors} 错误</span> / 
            <span class="warning">${report.summary.warnings} 警告</span>
          </span>
        </div>
      </div>

      <div class="report-section">
        <h3>校验详情</h3>
        ${report.details.map(d => `
          <div class="report-item">
            <span class="report-label">${d.ruleName}</span>
            <span class="report-value ${d.passed ? 'success' : d.type}">${d.message}</span>
          </div>
        `).join('')}
      </div>

      <div class="report-section">
        <h3>优化建议</h3>
        ${report.recommendations.map(r => `
          <div class="report-item">
            <span class="report-label">[${r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低'}] ${r.category}</span>
            <span class="report-value">${r.text}</span>
          </div>
        `).join('')}
      </div>
    `;

    modal.style.display = 'flex';
  }

  closeModal() {
    document.getElementById('report-modal').style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new HazardousRouteSandbox();
});
