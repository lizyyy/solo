import './styles.css';
import { DataParser } from './modules/dataParser.js';
import { RulesEngine } from './modules/rulesEngine.js';
import { StateManager } from './modules/stateManager.js';
import { Scene3D } from './modules/scene3D.js';
import { Exporter } from './modules/exporter.js';

const parser = new DataParser();
const stateManager = new StateManager();
const rulesEngine = new RulesEngine();
const exporter = new Exporter();

let scene3D = null;
let isValidating = false;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const container = document.getElementById('scene-container');
  scene3D = new Scene3D(container, stateManager, rulesEngine);
  
  setupEventListeners();
  
  loadDefaultDataSync();
  
  setupStateListener();
}

function setupStateListener() {
  stateManager.subscribe((state) => {
    updateUI(state);
    validateAndUpdate();
  });
}

function setupEventListeners() {
  document.getElementById('load-teeth').addEventListener('change', handleTeethFile);
  document.getElementById('load-attachments').addEventListener('change', handleAttachmentsFile);
  document.getElementById('load-rules').addEventListener('change', handleRulesFile);
  
  document.getElementById('step-prev').addEventListener('click', () => stateManager.previousStep());
  document.getElementById('step-next').addEventListener('click', () => stateManager.nextStep());
  document.getElementById('step-input').addEventListener('change', (e) => {
    const step = parseInt(e.target.value) || 1;
    stateManager.setCurrentStep(step);
  });
  
  document.getElementById('btn-undo').addEventListener('click', () => stateManager.undo());
  document.getElementById('btn-redo').addEventListener('click', () => stateManager.redo());
  
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      scene3D.setCameraView(view);
    });
  });
  
  document.getElementById('export-report').addEventListener('click', () => {
    exporter.exportPlacementReport(stateManager, rulesEngine);
  });
  
  document.getElementById('export-issues').addEventListener('click', () => {
    exporter.exportIssuesCSV(stateManager, rulesEngine);
  });
  
  document.getElementById('apply-position').addEventListener('click', applyManualPosition);
  document.getElementById('reset-position').addEventListener('click', resetAttachmentPosition);
  
  scene3D.onAttachmentSelect = (attachmentId) => {
    stateManager.selectAttachment(attachmentId);
    updateAttachmentPanel(attachmentId);
  };
  
  scene3D.onAttachmentMove = (attachmentId, newPosition) => {
    stateManager.updateAttachment(attachmentId, { position: newPosition });
    scene3D.updateAttachmentPosition(attachmentId);
    updateAttachmentPanel(attachmentId);
  };
}

function validateAndUpdate() {
  if (isValidating) return;
  isValidating = true;
  
  try {
    const state = stateManager.getState();
    
    if (state.teethData && state.attachments.length > 0) {
      const issues = rulesEngine.validateAll(
        state.teethData,
        state.attachments,
        state.currentStep
      );
      stateManager.setIssues(issues);
      if (scene3D) {
        scene3D.highlightIssues(issues);
      }
      updateIssuesPanel(issues);
    }
  } finally {
    isValidating = false;
  }
}

function loadDefaultDataSync() {
  try {
    const defaultTeeth = {
      upper: parser.generateDefaultTeeth(true),
      lower: parser.generateDefaultTeeth(false)
    };
    
    const tooth11 = defaultTeeth.upper.find(t => t.id === 11);
    if (tooth11) {
      tooth11.isMissing = true;
    }
    
    const sampleAttachments = [];
    const basicPositions = [12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26];
    
    basicPositions.forEach((toothNumber, index) => {
      const step = (index < 6) ? 1 : 2;
      
      sampleAttachments.push({
        id: `att_${toothNumber}_${step}`,
        toothNumber: toothNumber,
        step: step,
        type: 'bracket',
        position: { x: 0, y: 0.18, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { width: 0.3, height: 0.25, depth: 0.08 },
        isMirrored: toothNumber >= 21 && toothNumber <= 27,
        side: 'buccal'
      });
    });
    
    sampleAttachments.push({
      id: 'att_17_1',
      toothNumber: 17,
      step: 1,
      type: 'hook',
      position: { x: 0, y: 0.18, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { width: 0.15, height: 0.15, depth: 0.15 },
      isMirrored: false,
      side: 'buccal'
    });
    
    sampleAttachments.push({
      id: 'att_27_1',
      toothNumber: 27,
      step: 1,
      type: 'hook',
      position: { x: 0, y: 0.18, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { width: 0.15, height: 0.15, depth: 0.15 },
      isMirrored: true,
      side: 'buccal'
    });
    
    sampleAttachments.push({
      id: 'att_11_1',
      toothNumber: 11,
      step: 1,
      type: 'bracket',
      position: { x: 0, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { width: 0.3, height: 0.25, depth: 0.08 },
      isMirrored: false,
      side: 'buccal'
    });
    
    const defaultRules = {
      collision: { minDistance: 0.1, checkAdjacentOnly: true },
      range: { buccal: { min: 0.05, max: 0.35 }, lingual: { min: -0.35, max: -0.05 } },
      mirror: { enableCheck: true, symmetryThreshold: 0.1 },
      missing: { enableCheck: true }
    };
    
    rulesEngine.rules = defaultRules;
    
    stateManager.state.teethData = defaultTeeth;
    stateManager.state.attachments = sampleAttachments;
    stateManager.state.maxStep = 2;
    stateManager.state.currentStep = 1;
    stateManager.state.rules = defaultRules;
    stateManager.state.issues = [];
    
    scene3D.renderTeeth(defaultTeeth);
    scene3D.renderAttachments(sampleAttachments, 1);
    
    const issues = rulesEngine.validateAll(defaultTeeth, sampleAttachments, 1);
    stateManager.state.issues = issues;
    scene3D.highlightIssues(issues);
    updateIssuesPanel(issues);
    
    updateUI(stateManager.getState());
  } catch (error) {
    console.error('加载默认数据失败:', error);
  }
}

async function handleTeethFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const teethData = await parser.parseTeeth(data);
    stateManager.setTeethData(teethData);
    scene3D.renderTeeth(teethData);
    showNotification('牙齿数据加载成功', 'success');
  } catch (error) {
    showNotification('加载牙齿数据失败: ' + error.message, 'error');
    console.error(error);
  }
}

async function handleAttachmentsFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const attachments = await parser.parseAttachments(text);
    stateManager.setAttachments(attachments);
    showNotification(`附件数据加载成功，共 ${attachments.length} 个附件`, 'success');
  } catch (error) {
    showNotification('加载附件数据失败: ' + error.message, 'error');
    console.error(error);
  }
}

async function handleRulesFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const rules = parser.parsePlacementRules(text);
    rulesEngine.rules = rules;
    stateManager.setRules(rules);
    validateAndUpdate();
    showNotification('规则配置加载成功', 'success');
  } catch (error) {
    showNotification('加载规则配置失败: ' + error.message, 'error');
    console.error(error);
  }
}

function updateUI(state) {
  const stepInput = document.getElementById('step-input');
  const stepTotal = document.getElementById('step-total');
  const stepPrev = document.getElementById('step-prev');
  const stepNext = document.getElementById('step-next');
  
  stepInput.value = state.currentStep;
  stepInput.max = state.maxStep;
  stepTotal.textContent = state.maxStep;
  
  stepPrev.disabled = state.currentStep <= 1;
  stepNext.disabled = state.currentStep >= state.maxStep;
  
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  btnUndo.disabled = !stateManager.canUndo();
  btnRedo.disabled = !stateManager.canRedo();
  
  const currentAttachments = state.attachments.filter(a => a.step === state.currentStep);
  const attachmentCount = document.getElementById('attachment-count');
  attachmentCount.textContent = `当前步骤: ${currentAttachments.length} 个附件`;
  
  if (scene3D) {
    scene3D.renderAttachments(state.attachments, state.currentStep);
  }
  
  if (state.selectedAttachment) {
    updateAttachmentPanel(state.selectedAttachment);
  }
}

function updateAttachmentPanel(attachmentId) {
  const attachment = stateManager.getAttachmentById(attachmentId);
  if (!attachment) return;
  
  const panel = document.getElementById('attachment-panel');
  const placeholder = document.getElementById('no-selection');
  const details = document.getElementById('attachment-details');
  
  placeholder.classList.add('hidden');
  details.classList.remove('hidden');
  
  document.getElementById('att-id').textContent = attachment.id;
  document.getElementById('att-tooth').textContent = attachment.toothNumber;
  document.getElementById('att-type').textContent = attachment.type;
  document.getElementById('att-step').textContent = attachment.step;
  document.getElementById('att-mirrored').textContent = attachment.isMirrored ? '是' : '否';
  document.getElementById('att-side').textContent = attachment.side;
  
  document.getElementById('pos-x').value = attachment.position.x.toFixed(3);
  document.getElementById('pos-y').value = attachment.position.y.toFixed(3);
  document.getElementById('pos-z').value = attachment.position.z.toFixed(3);
  
  document.getElementById('rot-x').value = attachment.rotation.x.toFixed(2);
  document.getElementById('rot-y').value = attachment.rotation.y.toFixed(2);
  document.getElementById('rot-z').value = attachment.rotation.z.toFixed(2);
  
  panel.classList.add('active');
}

function applyManualPosition() {
  const state = stateManager.getState();
  if (!state.selectedAttachment) return;
  
  const attachment = stateManager.getAttachmentById(state.selectedAttachment);
  if (!attachment) return;
  
  const updates = {
    position: {
      x: parseFloat(document.getElementById('pos-x').value) || 0,
      y: parseFloat(document.getElementById('pos-y').value) || 0,
      z: parseFloat(document.getElementById('pos-z').value) || 0
    },
    rotation: {
      x: parseFloat(document.getElementById('rot-x').value) || 0,
      y: parseFloat(document.getElementById('rot-y').value) || 0,
      z: parseFloat(document.getElementById('rot-z').value) || 0
    }
  };
  
  stateManager.updateAttachment(state.selectedAttachment, updates);
  
  if (scene3D) {
    scene3D.renderAttachments(state.attachments, state.currentStep);
    scene3D.selectAttachment(state.selectedAttachment);
  }
  
  showNotification('位置已更新', 'success');
}

function resetAttachmentPosition() {
  const state = stateManager.getState();
  if (!state.selectedAttachment) return;
  
  document.getElementById('pos-x').value = '0.000';
  document.getElementById('pos-y').value = '0.180';
  document.getElementById('pos-z').value = '0.000';
  document.getElementById('rot-x').value = '0.00';
  document.getElementById('rot-y').value = '0.00';
  document.getElementById('rot-z').value = '0.00';
  
  showNotification('已重置输入值，点击应用确认', 'info');
}

function updateIssuesPanel(issues) {
  const container = document.getElementById('issues-list');
  const summary = document.getElementById('issues-summary');
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  summary.innerHTML = `
    <span class="issue-error">错误: ${errorCount}</span>
    <span class="issue-warning">警告: ${warningCount}</span>
  `;
  
  if (issues.length === 0) {
    container.innerHTML = '<div class="no-issues">当前步骤无问题 ✅</div>';
    return;
  }
  
  container.innerHTML = issues.map(issue => `
    <div class="issue-item ${issue.severity}" data-attachments="${(issue.affectedAttachments || []).join(',')}">
      <div class="issue-header">
        <span class="issue-severity">${issue.severity === 'error' ? '🔴' : '🟡'}</span>
        <span class="issue-type">${getIssueTypeName(issue.type)}</span>
      </div>
      <div class="issue-message">${issue.message}</div>
      ${issue.distance ? `<div class="issue-detail">距离: ${issue.distance} (允许: ${issue.minAllowed})</div>` : ''}
      ${issue.currentValue ? `<div class="issue-detail">当前值: ${issue.currentValue} (范围: ${issue.allowedRange})</div>` : ''}
    </div>
  `).join('');
  
  container.querySelectorAll('.issue-item').forEach(item => {
    item.addEventListener('click', () => {
      const attachments = item.dataset.attachments.split(',').filter(Boolean);
      if (attachments.length > 0 && scene3D) {
        scene3D.selectAttachment(attachments[0]);
      }
    });
  });
}

function getIssueTypeName(type) {
  const names = {
    'collision': '碰撞',
    'range_violation': '范围违规',
    'mirror_mismatch': '镜像问题',
    'missing_tooth': '缺牙问题'
  };
  return names[type] || type;
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
