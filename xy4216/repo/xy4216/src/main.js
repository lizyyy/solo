import { DataParser } from './modules/dataParser.js';
import { RuleChecker } from './modules/ruleChecker.js';
import { ThreeDRenderer } from './modules/threeDRenderer.js';
import { StateController } from './modules/stateController.js';
import { ImportExport } from './modules/importExport.js';
import { SampleData } from './modules/sampleData.js';

class ForkliftReviewerApp {
  constructor() {
    this.dataParser = new DataParser();
    this.ruleChecker = new RuleChecker();
    this.importExport = new ImportExport();
    this.stateController = new StateController({
      ruleChecker: this.ruleChecker
    });
    this.threeDRenderer = null;
    
    this.validationResults = null;
    this.selectedRiskPoint = null;
    
    this.init();
  }

  init() {
    this._initThreeJS();
    this._setupEventListeners();
    this._setupCallbacks();
  }

  _initThreeJS() {
    const container = document.getElementById('threeCanvas');
    if (container) {
      this.threeDRenderer = new ThreeDRenderer(container);
      this.threeDRenderer.init();
    }
  }

  _setupEventListeners() {
    const forkliftInput = document.getElementById('forkliftCsvInput');
    if (forkliftInput) {
      forkliftInput.addEventListener('change', (e) => this._handleForkliftFile(e));
    }

    const pedestrianInput = document.getElementById('pedestrianJsonInput');
    if (pedestrianInput) {
      pedestrianInput.addEventListener('change', (e) => this._handlePedestrianFile(e));
    }

    const warehouseInput = document.getElementById('warehouseJsonInput');
    if (warehouseInput) {
      warehouseInput.addEventListener('change', (e) => this._handleWarehouseFile(e));
    }

    const validateBtn = document.getElementById('validateBtn');
    if (validateBtn) {
      validateBtn.addEventListener('click', () => this._validateData());
    }

    const loadSampleBtn = document.getElementById('loadSampleBtn');
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', () => this._loadSampleData());
    }

    const exportMarkdownBtn = document.getElementById('exportMarkdownBtn');
    if (exportMarkdownBtn) {
      exportMarkdownBtn.addEventListener('click', () => this._exportMarkdown());
    }

    const exportJsonBtn = document.getElementById('exportJsonBtn');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this._exportJson());
    }

    this._setupPlaybackControls();
    this._setupViewControls();
  }

  _setupPlaybackControls() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        this.stateController.togglePlay();
        this._updatePlayButton();
      });
    }

    const rewindBtn = document.getElementById('rewindBtn');
    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => {
        this.stateController.rewindToStart();
      });
    }

    const forwardBtn = document.getElementById('forwardBtn');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        this.stateController.forwardToEnd();
      });
    }

    const prevFrameBtn = document.getElementById('prevFrameBtn');
    if (prevFrameBtn) {
      prevFrameBtn.addEventListener('click', () => {
        this.stateController.previousFrame();
      });
    }

    const nextFrameBtn = document.getElementById('nextFrameBtn');
    if (nextFrameBtn) {
      nextFrameBtn.addEventListener('click', () => {
        this.stateController.nextFrame();
      });
    }

    const timeline = document.getElementById('timeline');
    if (timeline) {
      timeline.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        const state = this.stateController.getPlaybackState();
        const time = state.startTime + (value / 100) * state.duration;
        this.stateController.setTime(time);
      });
    }

    const speedSelect = document.getElementById('speedSelect');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        const speed = parseFloat(e.target.value);
        this.stateController.setSpeed(speed);
      });
    }
  }

  _setupViewControls() {
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (this.threeDRenderer) {
          this.threeDRenderer.setView(view);
        }
      });
    });
  }

  _setupCallbacks() {
    this.stateController.on('onTimeUpdate', (currentTime) => {
      this._handleTimeUpdate(currentTime);
    });

    this.stateController.on('onPlayStateChange', (isPlaying) => {
      this._updatePlayButton();
    });
  }

  async _handleForkliftFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await this.importExport.importForkliftCSV(file);
      await this.dataParser.parseForkliftCSV(text);
      this._showNotification('叉车数据导入成功', 'success');
    } catch (error) {
      this._showNotification(`导入失败: ${error.message}`, 'error');
    }
  }

  async _handlePedestrianFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await this.importExport.importPedestrianJSON(file);
      this.dataParser.parsePedestrianJSON(text);
      this._showNotification('行人数据导入成功', 'success');
    } catch (error) {
      this._showNotification(`导入失败: ${error.message}`, 'error');
    }
  }

  async _handleWarehouseFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await this.importExport.importWarehouseJSON(file);
      this.dataParser.parseWarehouseJSON(text);
      this._showNotification('仓库数据导入成功', 'success');
    } catch (error) {
      this._showNotification(`导入失败: ${error.message}`, 'error');
    }
  }

  async _loadSampleData() {
    try {
      const sampleData = SampleData.generateNearMissData();
      
      const forkliftData = await this.dataParser.parseForkliftCSV(sampleData.forkliftCSV);
      const pedestrianData = await this.dataParser.parsePedestrianJSON(sampleData.pedestrianJSON);
      const warehouseData = await this.dataParser.parseWarehouseJSON(sampleData.warehouseJSON);
      
      this._showNotification('示例数据加载成功，正在校验...', 'info');
      
      await this._validateData();
      
    } catch (error) {
      this._showNotification(`加载示例数据失败: ${error.message}`, 'error');
    }
  }

  async _validateData() {
    if (!this.dataParser.hasAllData()) {
      this._showNotification('请先导入所有数据文件', 'warning');
      this._updateValidationStatus(false, '缺少必要数据');
      return;
    }

    const allData = this.dataParser.getAllData();
    this.validationResults = this.ruleChecker.validateAll(allData);

    this._updateValidationUI();
    this._updateRiskPointsList();

    if (this.validationResults.isValid) {
      const dataWithRisks = {
        ...allData,
        riskPoints: this.validationResults.riskPoints
      };
      
      this.stateController.setData(dataWithRisks);
      
      if (this.threeDRenderer) {
        this.threeDRenderer.setData(dataWithRisks);
      }
      
      this._updateTimelineRange();
      
      this._showNotification(`数据校验通过！检测到 ${this.validationResults.riskPoints.length} 个风险点`, 'success');
    } else {
      this._showNotification('数据校验存在错误，请检查数据', 'error');
    }
  }

  _updateValidationUI() {
    const statusEl = document.getElementById('validationStatus');
    const detailsEl = document.getElementById('validationDetails');
    
    if (!this.validationResults) return;

    if (this.validationResults.isValid) {
      statusEl.className = 'status-indicator success';
      statusEl.innerHTML = '<span class="status-icon">✅</span><span class="status-text">校验通过</span>';
    } else {
      statusEl.className = 'status-indicator error';
      statusEl.innerHTML = '<span class="status-icon">❌</span><span class="status-text">存在错误</span>';
    }

    let detailsHtml = '';
    
    if (this.validationResults.errors.length > 0) {
      detailsHtml += '<div style="margin-bottom: 8px;"><strong style="color: #e94560;">错误:</strong></div>';
      this.validationResults.errors.forEach(error => {
        detailsHtml += `<div class="validation-item">
          <span>${error.message}</span>
          <span class="validation-fail">✗</span>
        </div>`;
      });
    }

    if (this.validationResults.warnings.length > 0) {
      detailsHtml += '<div style="margin: 8px 0;"><strong style="color: #ffc107;">警告:</strong></div>';
      this.validationResults.warnings.forEach(warning => {
        detailsHtml += `<div class="validation-item">
          <span>${warning.message}</span>
          <span class="validation-fail">⚠</span>
        </div>`;
      });
    }

    if (this.validationResults.info.length > 0) {
      detailsHtml += '<div style="margin: 8px 0;"><strong style="color: #4caf50;">信息:</strong></div>';
      this.validationResults.info.forEach(info => {
        detailsHtml += `<div class="validation-item">
          <span>${info.message}</span>
          <span class="validation-pass">✓</span>
        </div>`;
      });
    }

    if (detailsEl) {
      detailsEl.innerHTML = detailsHtml;
    }
  }

  _updateRiskPointsList() {
    const listEl = document.getElementById('riskPointsList');
    if (!listEl || !this.validationResults) return;

    const riskPoints = this.validationResults.riskPoints || [];
    
    if (riskPoints.length === 0) {
      listEl.innerHTML = '<p style="color: #9e9e9e; text-align: center; padding: 20px;">未检测到风险点</p>';
      return;
    }

    let listHtml = '';
    riskPoints.forEach((risk, index) => {
      const levelClass = risk.level === 'high' ? 'high' : 
                        risk.level === 'medium' ? 'medium' : 'low';
      const typeLabel = risk.type === 'danger' ? '危险接近' : '风险预警';
      
      listHtml += `
        <div class="risk-item ${levelClass}" data-risk-index="${index}">
          <div class="risk-time">时间: ${risk.startTime.toFixed(1)}s - ${risk.endTime.toFixed(1)}s</div>
          <div class="risk-type">${typeLabel}</div>
          <div class="risk-distance">最小距离: ${risk.minDistance.toFixed(2)}m</div>
        </div>
      `;
    });

    listEl.innerHTML = listHtml;

    const riskItems = listEl.querySelectorAll('.risk-item');
    riskItems.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.riskIndex);
        this._selectRiskPoint(index);
      });
    });
  }

  _selectRiskPoint(index) {
    if (!this.validationResults || !this.validationResults.riskPoints) return;
    
    const riskPoint = this.validationResults.riskPoints[index];
    this.selectedRiskPoint = riskPoint;

    const riskItems = document.querySelectorAll('.risk-item');
    riskItems.forEach(item => item.classList.remove('selected'));
    riskItems[index].classList.add('selected');

    this.stateController.setTime(riskPoint.startTime);

    if (this.threeDRenderer) {
      this.threeDRenderer.highlightRiskPoint(riskPoint);
    }

    this._updateRiskDetail(riskPoint);
  }

  _updateRiskDetail(riskPoint) {
    const detailEl = document.getElementById('riskDetail');
    if (!detailEl) return;

    const levelLabel = riskPoint.level === 'high' ? '高危' : 
                      riskPoint.level === 'medium' ? '中危' : '低危';
    const typeLabel = riskPoint.type === 'danger' ? '危险接近' : '风险预警';

    detailEl.innerHTML = `
      <div class="risk-detail-content">
        <p><strong>类型:</strong> ${typeLabel}</p>
        <p><strong>等级:</strong> ${levelLabel}</p>
        <p><strong>起始时间:</strong> ${riskPoint.startTime.toFixed(2)}s</p>
        <p><strong>结束时间:</strong> ${riskPoint.endTime.toFixed(2)}s</p>
        <p><strong>持续时长:</strong> ${riskPoint.duration.toFixed(2)}s</p>
        <p><strong>最小距离:</strong> ${riskPoint.minDistance.toFixed(2)}m</p>
        ${riskPoint.forkliftPositions ? 
          `<p><strong>叉车位置:</strong> (${riskPoint.forkliftPositions.start.x.toFixed(2)}, ${riskPoint.forkliftPositions.start.z.toFixed(2)})</p>` : ''}
        ${riskPoint.pedestrianPositions ? 
          `<p><strong>行人位置:</strong> (${riskPoint.pedestrianPositions.start.x.toFixed(2)}, ${riskPoint.pedestrianPositions.start.z.toFixed(2)})</p>` : ''}
      </div>
    `;
  }

  _handleTimeUpdate(currentTime) {
    const state = this.stateController.getPlaybackState();
    
    const timeline = document.getElementById('timeline');
    if (timeline && state.duration > 0) {
      const progress = ((currentTime - state.startTime) / state.duration) * 100;
      timeline.value = progress;
    }

    const currentTimeEl = document.getElementById('currentTime');
    if (currentTimeEl) {
      const seconds = Math.floor(currentTime);
      const ms = Math.floor((currentTime % 1) * 100);
      currentTimeEl.textContent = `${String(seconds).padStart(2, '0')}:${String(ms).padStart(2, '0')}`;
    }

    this._updateFrameInfo();
    this._update3DPositions();
  }

  _updateFrameInfo() {
    const positions = this.stateController.getCurrentPositions();
    const distance = this.stateController.getDistance();

    const frameTime = document.getElementById('frameTime');
    const forkliftPos = document.getElementById('forkliftPos');
    const pedestrianPos = document.getElementById('pedestrianPos');
    const distanceEl = document.getElementById('distance');

    const state = this.stateController.getPlaybackState();

    if (frameTime) {
      frameTime.textContent = `${state.currentTime.toFixed(2)}s`;
    }

    if (forkliftPos) {
      if (positions.forklift) {
        forkliftPos.textContent = `(${positions.forklift.x.toFixed(2)}, ${positions.forklift.z.toFixed(2)})`;
      } else {
        forkliftPos.textContent = '--';
      }
    }

    if (pedestrianPos) {
      if (positions.pedestrian) {
        pedestrianPos.textContent = `(${positions.pedestrian.x.toFixed(2)}, ${positions.pedestrian.z.toFixed(2)})`;
      } else {
        pedestrianPos.textContent = '--';
      }
    }

    if (distanceEl) {
      if (distance !== null) {
        distanceEl.textContent = `${distance.toFixed(2)}m`;
        distanceEl.style.color = distance <= 1.5 ? '#e94560' : 
                                 distance <= 3.0 ? '#ffc107' : '#4caf50';
      } else {
        distanceEl.textContent = '--';
        distanceEl.style.color = '';
      }
    }
  }

  _update3DPositions() {
    if (!this.threeDRenderer) return;

    const positions = this.stateController.getCurrentPositions();
    this.threeDRenderer.updatePositions(positions.forklift, positions.pedestrian);
  }

  _updateTimelineRange() {
    const state = this.stateController.getPlaybackState();
    
    const totalTimeEl = document.getElementById('totalTime');
    if (totalTimeEl) {
      const seconds = Math.floor(state.duration);
      const ms = Math.floor((state.duration % 1) * 100);
      totalTimeEl.textContent = `${String(seconds).padStart(2, '0')}:${String(ms).padStart(2, '0')}`;
    }
  }

  _updatePlayButton() {
    const btn = document.getElementById('playPauseBtn');
    if (!btn) return;

    const isPlaying = this.stateController.isPlaying;
    btn.textContent = isPlaying ? '⏸' : '▶';
  }

  _updateValidationStatus(isValid, message) {
    const statusEl = document.getElementById('validationStatus');
    if (!statusEl) return;

    if (isValid) {
      statusEl.className = 'status-indicator success';
      statusEl.innerHTML = `<span class="status-icon">✅</span><span class="status-text">${message}</span>`;
    } else {
      statusEl.className = 'status-indicator error';
      statusEl.innerHTML = `<span class="status-icon">❌</span><span class="status-text">${message}</span>`;
    }
  }

  _exportMarkdown() {
    if (!this.validationResults) {
      this._showNotification('请先校验数据', 'warning');
      return;
    }

    const allData = this.dataParser.getAllData();
    
    const markdown = this.importExport.exportMarkdownReview({
      reviewDate: new Date().toISOString().split('T')[0],
      incidentTitle: '叉车盲区差点碰撞事故复盘报告',
      validationResults: this.validationResults,
      riskPoints: this.validationResults.riskPoints,
      forkliftData: allData.forklift,
      pedestrianData: allData.pedestrian,
      warehouseData: allData.warehouse
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.importExport.downloadMarkdown(markdown, `review-report-${timestamp}.md`);
    
    this._showNotification('Markdown复盘报告导出成功', 'success');
  }

  _exportJson() {
    if (!this.validationResults || !this.validationResults.riskPoints) {
      this._showNotification('请先校验数据', 'warning');
      return;
    }

    const json = this.importExport.exportRiskJson(this.validationResults.riskPoints, {
      exportDate: new Date().toISOString(),
      includeDetails: true
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.importExport.downloadJson(json, `risk-points-${timestamp}.json`);
    
    this._showNotification('JSON风险清单导出成功', 'success');
  }

  _showNotification(message, type = 'info') {
    let existingNotification = document.querySelector('.app-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `app-notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      ${type === 'success' ? 'background-color: #4caf50;' : ''}
      ${type === 'error' ? 'background-color: #e94560;' : ''}
      ${type === 'warning' ? 'background-color: #ffc107; color: #333;' : ''}
      ${type === 'info' ? 'background-color: #2196f3;' : ''}
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.forkliftReviewerApp = new ForkliftReviewerApp();
});
