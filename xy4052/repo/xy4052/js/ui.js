/**
 * UI渲染与交互模块
 * 负责游戏界面渲染、拖拽交互和用户输入处理
 */

import { TriageLevel } from './patient.js';
import { ActionDefinitions } from './actions.js';

class GameUI {
  constructor(game) {
    this.game = game;
    this.draggedPatient = null;
    this.selectedPatient = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    
    this.initEventListeners();
  }

  initEventListeners() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupAllEventListeners());
    } else {
      this.setupAllEventListeners();
    }
  }

  setupAllEventListeners() {
    this.setupStaticElementEvents();
    this.setupEventDelegation();
  }

  setupStaticElementEvents() {
    const triageZones = document.querySelectorAll('.triage-zone');
    triageZones.forEach(zone => {
      zone.addEventListener('dragover', (e) => this.handleDragOver(e));
      zone.addEventListener('dragenter', (e) => this.handleDragEnter(e));
      zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      zone.addEventListener('drop', (e) => this.handleDrop(e));
    });
  }

  setupEventDelegation() {
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.patient-card');
      if (card) {
        this.handleDragStart(e);
      }
    });

    document.addEventListener('dragend', (e) => {
      const card = e.target.closest('.patient-card');
      if (card) {
        this.handleDragEnd(e);
      }
    });

    document.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.patient-card');
      if (card) {
        this.handleTouchStart(e);
      }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (this.draggedPatient) {
        this.handleTouchMove(e);
      }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      const card = e.target.closest('.patient-card');
      if (card || this.draggedPatient) {
        this.handleTouchEnd(e);
      }
    });

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.patient-card');
      if (card) {
        const patientId = card.dataset.patientId;
        if (patientId) {
          this.selectPatient(patientId);
        }
      }

      const actionBtn = e.target.closest('.action-btn');
      if (actionBtn && !actionBtn.disabled) {
        const actionType = actionBtn.dataset.actionType;
        if (actionType && this.selectedPatient) {
          this.game.performAction(this.selectedPatient.id, actionType);
        }
      }
    });
  }

  setupButtonEvents() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.game.startGame());
    }

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.game.togglePause());
    }

    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.game.togglePause());
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.game.restartGame());
    }

    const exportReportBtn = document.getElementById('export-report-btn');
    if (exportReportBtn) {
      exportReportBtn.addEventListener('click', () => this.game.exportReport());
    }

    const importLevelBtn = document.getElementById('import-level-btn');
    if (importLevelBtn) {
      importLevelBtn.addEventListener('click', () => this.showImportDialog());
    }

    const levelSelect = document.getElementById('level-select');
    if (levelSelect) {
      levelSelect.addEventListener('change', (e) => {
        this.game.selectLevel(e.target.value);
      });
    }

    const closeModalBtns = document.querySelectorAll('.close-modal');
    closeModalBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeAllModals();
        }
      });
    });
  }

  handleDragStart(e) {
    const card = e.target.closest('.patient-card');
    if (!card) return;
    
    const patientId = card.dataset.patientId;
    this.draggedPatient = this.game.getPatient(patientId);
    
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', patientId);

    this.highlightTriageZones(true);
  }

  handleDragEnd(e) {
    const card = e.target.closest('.patient-card');
    if (card) {
      card.classList.remove('dragging');
    }
    this.highlightTriageZones(false);
    this.draggedPatient = null;
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  handleDragEnter(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const patientId = e.dataTransfer.getData('text/plain');
    const triageLevel = e.currentTarget.dataset.triageLevel;

    if (patientId && triageLevel) {
      this.game.performTriage(patientId, triageLevel);
    }

    this.highlightTriageZones(false);
  }

  handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    
    const patientId = e.target.closest('.patient-card')?.dataset.patientId;
    if (patientId) {
      this.draggedPatient = this.game.getPatient(patientId);
      e.target.closest('.patient-card').classList.add('dragging');
    }
  }

  handleTouchMove(e) {
    if (!this.draggedPatient) return;
    e.preventDefault();

    const touch = e.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    const triageZones = document.querySelectorAll('.triage-zone');
    triageZones.forEach(zone => {
      const rect = zone.getBoundingClientRect();
      if (touchX >= rect.left && touchX <= rect.right &&
          touchY >= rect.top && touchY <= rect.bottom) {
        zone.classList.add('drag-over');
      } else {
        zone.classList.remove('drag-over');
      }
    });
  }

  handleTouchEnd(e) {
    if (!this.draggedPatient) return;

    const touch = e.changedTouches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    const triageZones = document.querySelectorAll('.triage-zone');
    for (const zone of triageZones) {
      const rect = zone.getBoundingClientRect();
      if (touchX >= rect.left && touchX <= rect.right &&
          touchY >= rect.top && touchY <= rect.bottom) {
        const triageLevel = zone.dataset.triageLevel;
        if (triageLevel) {
          this.game.performTriage(this.draggedPatient.id, triageLevel);
        }
        zone.classList.remove('drag-over');
        break;
      }
    }

    const cards = document.querySelectorAll('.patient-card.dragging');
    cards.forEach(card => card.classList.remove('dragging'));
    this.draggedPatient = null;
    this.highlightTriageZones(false);
  }

  highlightTriageZones(highlight) {
    const triageZones = document.querySelectorAll('.triage-zone');
    triageZones.forEach(zone => {
      if (highlight) {
        zone.classList.add('highlight');
      } else {
        zone.classList.remove('highlight');
        zone.classList.remove('drag-over');
      }
    });
  }

  selectPatient(patientId) {
    const patient = this.game.getPatient(patientId);
    if (!patient) return;

    this.selectedPatient = patient;
    this.updateActionPanel(patient);
    this.highlightSelectedPatient(patientId);
  }

  highlightSelectedPatient(patientId) {
    const cards = document.querySelectorAll('.patient-card');
    cards.forEach(card => {
      if (card.dataset.patientId === patientId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  updateActionPanel(patient) {
    const actionPanel = document.getElementById('action-panel');
    if (!actionPanel) return;

    const actionButtons = actionPanel.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
      const actionType = btn.dataset.actionType;
      const canPerform = this.game.canPerformAction(patient, actionType);
      
      btn.disabled = !canPerform.success;
      btn.classList.toggle('disabled', !canPerform.success);

      if (!canPerform.success) {
        btn.title = canPerform.message;
      } else {
        btn.title = '';
      }
    });

    const patientInfo = document.getElementById('selected-patient-info');
    if (patientInfo && patient) {
      patientInfo.innerHTML = this.renderPatientDetail(patient);
    }
  }

  renderPatientDetail(patient) {
    const triageLevelNames = {
      [TriageLevel.RED]: '红色（急危重症）',
      [TriageLevel.YELLOW]: '黄色（急症）',
      [TriageLevel.GREEN]: '绿色（轻症）',
      [TriageLevel.OBSERVATION]: '留观'
    };

    const stateNames = {
      'pending': '待分诊',
      'triaged': '已分诊',
      'being_treated': '处理中',
      'waiting': '等待中',
      'discharged': '已出院',
      'deteriorated': '病情恶化',
      'deceased': '死亡'
    };

    const vitalSigns = patient.vitalSigns || {};
    
    return `
      <div class="patient-detail">
        <h4>${patient.id} - ${patient.chiefComplaint}</h4>
        <p class="patient-description">${patient.description || ''}</p>
        
        <div class="detail-section">
          <h5>生命体征</h5>
          <ul class="vital-signs-list">
            ${vitalSigns.heartRate ? `<li>心率: ${vitalSigns.heartRate} 次/分</li>` : ''}
            ${vitalSigns.bloodPressure ? `<li>血压: ${vitalSigns.bloodPressure}</li>` : ''}
            ${vitalSigns.temperature ? `<li>体温: ${vitalSigns.temperature}°C</li>` : ''}
            ${vitalSigns.spo2 ? `<li>血氧: ${vitalSigns.spo2}%</li>` : ''}
            ${vitalSigns.respiratoryRate ? `<li>呼吸: ${vitalSigns.respiratoryRate} 次/分</li>` : ''}
          </ul>
        </div>

        ${patient.riskFactors && patient.riskFactors.length > 0 ? `
        <div class="detail-section">
          <h5>风险因素</h5>
          <ul class="risk-factors-list">
            ${patient.riskFactors.map(f => `<li class="risk-factor">${f}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="detail-section">
          <h5>当前状态</h5>
          <p>分诊: ${patient.currentTriage ? triageLevelNames[patient.currentTriage] : '未分诊'}</p>
          <p>状态: ${stateNames[patient.state] || patient.state}</p>
          <p>等待时间: ${Math.round(patient.waitTime)} 秒</p>
          <p>家属压力: ${Math.round(patient.familyStress)}%</p>
          ${patient.hasDeteriorated ? '<p class="warning">⚠️ 病情已恶化</p>' : ''}
        </div>

        ${patient.requiredActions && patient.requiredActions.length > 0 ? `
        <div class="detail-section">
          <h5>必要动作</h5>
          <ul class="required-actions">
            ${patient.requiredActions.map(action => {
              const completed = patient.completedActions?.some(c => c.actionId === action);
              const actionDef = ActionDefinitions[action];
              return `<li class="${completed ? 'completed' : 'pending'}">
                ${completed ? '✓' : '○'} ${actionDef?.name || action}
              </li>`;
            }).join('')}
          </ul>
        </div>
        ` : ''}

        ${patient.isolationStatus ? `
        <div class="detail-section isolation-warning">
          <h5>🦠 隔离要求</h5>
          <p class="warning">此患者需要隔离措施</p>
          ${patient.isolationPerformed ? '<p class="success">✓ 已执行隔离</p>' : ''}
        </div>
        ` : ''}
      </div>
    `;
  }

  renderPatientCard(patient) {
    const triageColors = {
      [TriageLevel.RED]: 'red-zone',
      [TriageLevel.YELLOW]: 'yellow-zone',
      [TriageLevel.GREEN]: 'green-zone',
      [TriageLevel.OBSERVATION]: 'observation-zone'
    };

    const triageLabels = {
      [TriageLevel.RED]: '红',
      [TriageLevel.YELLOW]: '黄',
      [TriageLevel.GREEN]: '绿',
      [TriageLevel.OBSERVATION]: '留'
    };

    const stateClasses = {
      'pending': 'state-pending',
      'triaged': 'state-triaged',
      'being_treated': 'state-treating',
      'waiting': 'state-waiting',
      'discharged': 'state-discharged',
      'deteriorated': 'state-deteriorated',
      'deceased': 'state-deceased'
    };

    const triageClass = patient.currentTriage ? triageColors[patient.currentTriage] : '';
    const stateClass = stateClasses[patient.state] || '';
    const selectedClass = this.selectedPatient?.id === patient.id ? 'selected' : '';

    return `
      <div class="patient-card ${triageClass} ${stateClass} ${selectedClass}" 
           draggable="true" 
           data-patient-id="${patient.id}">
        <div class="card-header">
          <span class="patient-id">${patient.id}</span>
          ${patient.currentTriage ? `<span class="triage-badge ${triageClass}">${triageLabels[patient.currentTriage]}</span>` : ''}
          <span class="state-indicator ${stateClass}"></span>
        </div>
        
        <div class="card-body">
          <h4 class="chief-complaint">${patient.chiefComplaint}</h4>
          <p class="card-description">${patient.description?.substring(0, 50)}${patient.description?.length > 50 ? '...' : ''}</p>
          
          <div class="card-vitals">
            ${patient.vitalSigns?.heartRate ? `<span class="vital">HR: ${patient.vitalSigns.heartRate}</span>` : ''}
            ${patient.vitalSigns?.bloodPressure ? `<span class="vital">BP: ${patient.vitalSigns.bloodPressure}</span>` : ''}
            ${patient.vitalSigns?.temperature ? `<span class="vital">T: ${patient.vitalSigns.temperature}°C</span>` : ''}
            ${patient.vitalSigns?.spo2 ? `<span class="vital">SpO2: ${patient.vitalSigns.spo2}%</span>` : ''}
          </div>
        </div>
        
        <div class="card-footer">
          <div class="wait-time">
            <span class="label">等待</span>
            <span class="value">${Math.round(patient.waitTime)}s</span>
          </div>
          <div class="family-stress">
            <span class="label">家属</span>
            <span class="stress-bar">
              <span class="stress-fill" style="width: ${patient.familyStress}%"></span>
            </span>
          </div>
          ${patient.isolationStatus ? '<span class="isolation-badge">🦠</span>' : ''}
          ${patient.hasDeteriorated ? '<span class="deterioration-badge">⚠️</span>' : ''}
        </div>
      </div>
    `;
  }

  render() {
    this.updateGameInfo();
    this.renderPatientQueues();
    this.renderResourceStatus();
    this.renderScoreDisplay();
  }

  updateGameInfo() {
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
      timeDisplay.textContent = this.game.getFormattedTime();
    }

    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) {
      scoreDisplay.textContent = this.game.getScore();
    }

    const patientCount = document.getElementById('patient-count');
    if (patientCount) {
      const counts = this.game.getPatientCounts();
      patientCount.textContent = `待分诊: ${counts.pending} | 处理中: ${counts.active} | 已完成: ${counts.completed}`;
    }
  }

  renderPatientQueues() {
    const queues = this.game.getPatientQueues();

    ['pending', 'red', 'yellow', 'green', 'observation'].forEach(queueType => {
      const queueContainer = document.getElementById(`${queueType}-queue`);
      if (!queueContainer) return;

      const patients = queues[queueType] || [];
      queueContainer.innerHTML = patients.map(patient => 
        this.renderPatientCard(patient)
      ).join('');
    });
  }

  renderResourceStatus() {
    const resources = this.game.getResourceStatus();
    const resourceContainer = document.getElementById('resource-status');
    if (!resourceContainer) return;

    resourceContainer.innerHTML = Object.entries(resources).map(([type, resource]) => {
      const resourceNames = {
        'nurse': '护士',
        'ecg_machine': '心电图机',
        'lab': '检验室',
        'doctor': '医生',
        'isolation_room': '隔离室'
      };

      const available = resource.available;
      const total = resource.count;
      const percent = (available / total) * 100;
      const isLow = available === 0;

      return `
        <div class="resource-item ${isLow ? 'resource-low' : ''}">
          <span class="resource-name">${resourceNames[type] || type}</span>
          <span class="resource-count">${available}/${total}</span>
          <div class="resource-bar">
            <div class="resource-fill" style="width: ${percent}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderScoreDisplay() {
    const scoreDetails = this.game.getScoreDetails();
    const scoreHistory = document.getElementById('score-history');
    if (!scoreHistory) return;

    const recentScores = scoreDetails.slice(-5);
    scoreHistory.innerHTML = recentScores.map(item => `
      <div class="score-item ${item.points >= 0 ? 'positive' : 'negative'}">
        <span class="score-reason">${item.reason}</span>
        <span class="score-value">${item.points >= 0 ? '+' : ''}${item.points}</span>
      </div>
    `).join('');
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay.active');
    modals.forEach(modal => modal.classList.remove('active'));
  }

  showImportDialog() {
    this.showModal('import-modal');
  }

  showGameOverModal(results) {
    const modal = document.getElementById('game-over-modal');
    if (!modal) return;

    const scoreEl = modal.querySelector('.final-score');
    const ratingEl = modal.querySelector('.final-rating');
    const detailsEl = modal.querySelector('.result-details');

    if (scoreEl) scoreEl.textContent = results.score;
    if (ratingEl) {
      ratingEl.textContent = `${results.rating.grade} (${results.rating.label})`;
      ratingEl.style.color = results.rating.color;
    }

    if (detailsEl && results.errorAnalysis) {
      detailsEl.innerHTML = results.errorAnalysis.map(error => `
        <div class="error-item">
          <span class="error-time">${this.formatTime(error.time)}</span>
          <span class="error-type">${error.type}</span>
          <span class="error-desc">${error.description}</span>
        </div>
      `).join('');
    }

    this.showModal('game-over-modal');
  }

  showSavedGameDialog() {
    this.showModal('continue-game-modal');
  }

  showValidationErrors(errors) {
    const errorContainer = document.getElementById('validation-errors');
    if (!errorContainer) return;

    errorContainer.innerHTML = errors.map((error, index) => `
      <div class="validation-error">
        <span class="error-index">${index + 1}</span>
        <span class="error-field">[${error.field}]</span>
        <span class="error-message">${error.message}</span>
      </div>
    `).join('');

    this.showModal('validation-error-modal');
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

export { GameUI };
