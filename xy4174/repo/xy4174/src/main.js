import { sceneManager } from './models/SceneModel.js';
import { loadCalculator } from './engine/LoadCalculator.js';
import { collisionDetector } from './engine/CollisionDetector.js';
import { threeRenderer } from './renderer/ThreeRenderer.js';
import { interactionManager } from './ui/InteractionManager.js';
import { sceneStorage } from './storage/SceneStorage.js';
import { exporter } from './export/Exporter.js';
import { sampleScenes } from './data/SampleScenes.js';

class App {
  constructor() {
    this.isInitialized = false;
    this.selectedObjectData = null;
  }

  async init() {
    if (this.isInitialized) return;

    console.log('吊点荷载沙盘启动中...');

    this.setupUIEvents();
    this.loadInitialScene();

    setTimeout(() => {
      if (threeRenderer.init('canvas-container')) {
        console.log('3D渲染器初始化完成');
        
        interactionManager.init('canvas-container');
        console.log('交互管理器初始化完成');

        this.refreshScene();
        this.isInitialized = true;

        sceneStorage.startAutoSave();
        console.log('自动保存已启动');

        this.updateUI();
      } else {
        console.error('3D渲染器初始化失败');
      }
    }, 100);
  }

  setupUIEvents() {
    document.getElementById('btn-add-hanging-point')?.addEventListener('click', () => {
      this.setAddMode('hangingPoint');
    });

    document.getElementById('btn-add-truss')?.addEventListener('click', () => {
      this.setAddMode('truss');
    });

    document.getElementById('btn-add-device')?.addEventListener('click', () => {
      this.setAddMode('device');
    });

    document.getElementById('btn-add-obstacle')?.addEventListener('click', () => {
      this.setAddMode('obstacle');
    });

    document.getElementById('btn-select-mode')?.addEventListener('click', () => {
      this.setSelectMode();
    });

    document.getElementById('btn-save-scene')?.addEventListener('click', () => {
      this.saveCurrentScene();
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      this.exportJSON();
    });

    document.getElementById('btn-export-markdown')?.addEventListener('click', () => {
      this.exportMarkdown();
    });

    document.getElementById('btn-new-scene')?.addEventListener('click', () => {
      this.newScene();
    });

    document.getElementById('btn-view-top')?.addEventListener('click', () => {
      threeRenderer.setView('top');
    });

    document.getElementById('btn-view-front')?.addEventListener('click', () => {
      threeRenderer.setView('front');
    });

    document.getElementById('btn-view-side')?.addEventListener('click', () => {
      threeRenderer.setView('side');
    });

    document.getElementById('btn-view-perspective')?.addEventListener('click', () => {
      threeRenderer.setView('perspective');
    });

    this.loadSampleSceneButtons();

    interactionManager.setCallback('onSelect', (data) => {
      this.onObjectSelected(data);
    });

    interactionManager.setCallback('onDeselect', () => {
      this.onObjectDeselected();
    });

    interactionManager.setCallback('onSceneUpdate', () => {
      this.updateUI();
    });

    document.getElementById('file-import')?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.importScene(e.target.files[0]);
      }
    });

    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      document.getElementById('file-import')?.click();
    });
  }

  loadSampleSceneButtons() {
    const samples = sampleScenes.getSampleSceneList();
    const container = document.getElementById('sample-scenes-list');
    
    if (!container) return;

    container.innerHTML = '';
    
    for (const sample of samples) {
      const btn = document.createElement('button');
      btn.className = 'sample-scene-btn';
      btn.innerHTML = `
        <div class="sample-name">${sample.name}</div>
        <div class="sample-desc">${sample.description}</div>
      `;
      btn.addEventListener('click', () => {
        this.loadSampleScene(sample.id);
      });
      container.appendChild(btn);
    }
  }

  loadInitialScene() {
    if (sceneStorage.hasAutoSave()) {
      const savedScene = sceneStorage.loadFromLocalStorage();
      if (savedScene) {
        sceneManager.setCurrentScene(savedScene);
        console.log('已加载自动保存的场景');
        return;
      }
    }

    const defaultScene = sampleScenes.getSampleSceneById('basic');
    if (defaultScene) {
      sceneManager.setCurrentScene(defaultScene);
      console.log('已加载默认示例场景');
    }
  }

  refreshScene() {
    const scene = sceneManager.currentScene;
    
    loadCalculator.calculate(scene);
    collisionDetector.detect(scene);
    threeRenderer.renderScene(scene);
    
    this.updateUI();
  }

  updateUI() {
    const scene = sceneManager.currentScene;
    const loadSummary = loadCalculator.getLoadDistributionSummary(scene);
    const collisionSummary = collisionDetector.getCollisionSummary(scene);

    document.getElementById('scene-name').textContent = scene.name;
    document.getElementById('total-weight').textContent = `${loadSummary.totalWeight.toFixed(1)} kg`;
    document.getElementById('hanging-points-count').textContent = scene.hangingPoints.length;
    document.getElementById('trusses-count').textContent = scene.trusses.length;
    document.getElementById('devices-count').textContent = scene.devices.length;

    const cog = loadSummary.centerOfGravity;
    document.getElementById('cog-position').textContent = 
      `X: ${cog.x.toFixed(2)}m, Z: ${cog.z.toFixed(2)}m`;

    const balanceStatus = document.getElementById('balance-status');
    if (loadSummary.isBalanced) {
      balanceStatus.textContent = '✅ 平衡';
      balanceStatus.className = 'status-ok';
    } else {
      balanceStatus.textContent = '⚠️ 不平衡';
      balanceStatus.className = 'status-warning';
    }

    const collisionStatus = document.getElementById('collision-status');
    if (collisionSummary.hasCollisions()) {
      collisionStatus.textContent = `❌ ${collisionSummary.totalCollisions} 个冲突`;
      collisionStatus.className = 'status-error';
    } else if (collisionSummary.hasWarnings()) {
      collisionStatus.textContent = `⚠️ ${collisionSummary.totalClearanceWarnings} 个警告`;
      collisionStatus.className = 'status-warning';
    } else {
      collisionStatus.textContent = '✅ 正常';
      collisionStatus.className = 'status-ok';
    }

    this.updateHangingPointsList(loadSummary);
    this.updateWarningsList(loadSummary, collisionSummary);
  }

  updateHangingPointsList(loadSummary) {
    const container = document.getElementById('hanging-points-list');
    if (!container) return;

    container.innerHTML = '';

    for (const point of loadSummary.hangingPoints) {
      const item = document.createElement('div');
      item.className = `hanging-point-item ${point.isOverloaded ? 'overloaded' : point.percentage > 80 ? 'warning' : ''}`;
      
      const percentageColor = point.isOverloaded ? '#ff4444' : 
                             point.percentage > 80 ? '#ffaa00' : '#44aa44';
      
      item.innerHTML = `
        <div class="point-header">
          <span class="point-name">${point.name}</span>
          <span class="point-type">${point.motorType}</span>
        </div>
        <div class="point-load-bar">
          <div class="point-load-fill" style="width: ${Math.min(100, point.percentage)}%; background-color: ${percentageColor}"></div>
        </div>
        <div class="point-load-info">
          <span>${point.currentLoad.toFixed(1)}kg / ${point.maxSafeLoad.toFixed(1)}kg</span>
          <span>${point.percentage.toFixed(1)}%</span>
        </div>
      `;
      
      container.appendChild(item);
    }
  }

  updateWarningsList(loadSummary, collisionSummary) {
    const container = document.getElementById('warnings-list');
    if (!container) return;

    container.innerHTML = '';

    const allWarnings = [];

    for (const error of loadSummary.errors) {
      allWarnings.push({
        type: 'error',
        message: error.message,
        icon: '❌'
      });
    }

    for (const warning of loadSummary.warnings) {
      allWarnings.push({
        type: 'warning',
        message: warning.message,
        icon: '⚠️'
      });
    }

    for (const collision of collisionSummary.collisions) {
      allWarnings.push({
        type: 'error',
        message: collision.details,
        icon: '💥'
      });
    }

    for (const warning of collisionSummary.clearanceWarnings) {
      allWarnings.push({
        type: 'warning',
        message: warning.details,
        icon: '⚠️'
      });
    }

    if (loadSummary.suggestions && loadSummary.suggestions.length > 0) {
      for (const suggestion of loadSummary.suggestions) {
        if (suggestion.type === 'counterweight') {
          allWarnings.push({
            type: 'info',
            message: `建议添加 ${suggestion.weight}kg 配重在 (${suggestion.position.x.toFixed(2)}, ${suggestion.position.z.toFixed(2)})`,
            icon: '💡'
          });
        } else if (suggestion.type === 'redistribute') {
          allWarnings.push({
            type: 'warning',
            message: suggestion.reason + ' - ' + suggestion.action,
            icon: '⚖️'
          });
        } else if (suggestion.type === 'additional_hanging_point') {
          allWarnings.push({
            type: 'warning',
            message: suggestion.reason + ' - ' + suggestion.action,
            icon: '🔗'
          });
        }
      }
    }

    if (allWarnings.length === 0) {
      container.innerHTML = '<div class="no-warnings">✅ 无警告，系统状态正常</div>';
      return;
    }

    for (const warning of allWarnings) {
      const item = document.createElement('div');
      item.className = `warning-item ${warning.type}`;
      item.innerHTML = `
        <span class="warning-icon">${warning.icon}</span>
        <span class="warning-text">${warning.message}</span>
      `;
      container.appendChild(item);
    }
  }

  onObjectSelected(data) {
    this.selectedObjectData = data;
    this.showObjectProperties(data);
  }

  onObjectDeselected() {
    this.selectedObjectData = null;
    this.hideObjectProperties();
  }

  showObjectProperties(data) {
    const panel = document.getElementById('properties-panel');
    const content = document.getElementById('properties-content');
    
    if (!panel || !content) return;

    const scene = sceneManager.currentScene;
    let object = null;

    switch (data.type) {
      case 'hangingPoint':
        object = scene.getHangingPointById(data.id);
        break;
      case 'truss':
        object = scene.getTrussById(data.id);
        break;
      case 'device':
        object = scene.getDeviceById(data.id);
        break;
      case 'obstacle':
        object = scene.getObstacleById(data.id);
        break;
      case 'counterweight':
        object = scene.getCounterweightById(data.id);
        break;
    }

    if (!object) {
      content.innerHTML = '<p>对象不存在</p>';
      panel.style.display = 'block';
      return;
    }

    let html = `
      <div class="prop-group">
        <label>名称</label>
        <input type="text" id="prop-name" value="${object.name}" />
      </div>
      <div class="prop-group">
        <label>类型</label>
        <span class="prop-value">${data.type}</span>
      </div>
      <div class="prop-group">
        <label>位置 X</label>
        <input type="number" id="prop-pos-x" value="${object.position.x.toFixed(2)}" step="0.1" />
      </div>
      <div class="prop-group">
        <label>位置 Y</label>
        <input type="number" id="prop-pos-y" value="${object.position.y.toFixed(2)}" step="0.1" />
      </div>
      <div class="prop-group">
        <label>位置 Z</label>
        <input type="number" id="prop-pos-z" value="${object.position.z.toFixed(2)}" step="0.1" />
      </div>
    `;

    if (object.weight !== undefined) {
      html += `
        <div class="prop-group">
          <label>重量 (kg)</label>
          <input type="number" id="prop-weight" value="${object.weight}" step="1" />
        </div>
      `;
    }

    if (object.maxLoad !== undefined) {
      html += `
        <div class="prop-group">
          <label>最大载荷 (kg)</label>
          <input type="number" id="prop-max-load" value="${object.maxLoad}" step="10" />
        </div>
        <div class="prop-group">
          <label>安全系数</label>
          <input type="number" id="prop-safety-factor" value="${object.safetyFactor}" step="1" min="1" />
        </div>
        <div class="prop-group">
          <label>电机类型</label>
          <input type="text" id="prop-motor-type" value="${object.motorType}" />
        </div>
      `;
    }

    if (object.length !== undefined) {
      html += `
        <div class="prop-group">
          <label>长度 (m)</label>
          <input type="number" id="prop-length" value="${object.length}" step="0.5" />
        </div>
      `;
    }

    html += `
      <div class="prop-actions">
        <button id="btn-apply-props" class="btn-primary">应用更改</button>
        <button id="btn-delete-object" class="btn-danger">删除对象</button>
      </div>
    `;

    content.innerHTML = html;
    panel.style.display = 'block';

    document.getElementById('btn-apply-props')?.addEventListener('click', () => {
      this.applyProperties(data.type, data.id);
    });

    document.getElementById('btn-delete-object')?.addEventListener('click', () => {
      this.deleteSelectedObject();
    });
  }

  hideObjectProperties() {
    const panel = document.getElementById('properties-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  applyProperties(type, id) {
    const scene = sceneManager.currentScene;
    let object = null;

    switch (type) {
      case 'hangingPoint':
        object = scene.getHangingPointById(id);
        break;
      case 'truss':
        object = scene.getTrussById(id);
        break;
      case 'device':
        object = scene.getDeviceById(id);
        break;
      case 'obstacle':
        object = scene.getObstacleById(id);
        break;
      case 'counterweight':
        object = scene.getCounterweightById(id);
        break;
    }

    if (!object) return;

    const nameInput = document.getElementById('prop-name');
    const posX = document.getElementById('prop-pos-x');
    const posY = document.getElementById('prop-pos-y');
    const posZ = document.getElementById('prop-pos-z');
    const weight = document.getElementById('prop-weight');
    const maxLoad = document.getElementById('prop-max-load');
    const safetyFactor = document.getElementById('prop-safety-factor');
    const motorType = document.getElementById('prop-motor-type');
    const length = document.getElementById('prop-length');

    if (nameInput) object.name = nameInput.value;
    if (posX) object.position.x = parseFloat(posX.value) || 0;
    if (posY) object.position.y = parseFloat(posY.value) || 0;
    if (posZ) object.position.z = parseFloat(posZ.value) || 0;
    if (weight) object.weight = parseFloat(weight.value) || 0;
    if (maxLoad) object.maxLoad = parseFloat(maxLoad.value) || 0;
    if (safetyFactor) object.safetyFactor = parseFloat(safetyFactor.value) || 5;
    if (motorType) object.motorType = motorType.value;
    if (length) object.length = parseFloat(length.value) || 3;

    scene.markModified();
    this.refreshScene();
    this.showObjectProperties({ type, id });
  }

  deleteSelectedObject() {
    if (!this.selectedObjectData) return;

    const confirmed = confirm('确定要删除选中的对象吗？');
    if (!confirmed) return;

    interactionManager.deleteSelectedObject();
    this.refreshScene();
  }

  setAddMode(type) {
    interactionManager.setMode('add');
    interactionManager.setAddModeType(type);
    
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`btn-add-${type === 'hangingPoint' ? 'hanging-point' : type}`)?.classList.add('active');
  }

  setSelectMode() {
    interactionManager.setMode('select');
    
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById('btn-select-mode')?.classList.add('active');
  }

  newScene() {
    const confirmed = confirm('确定要创建新场景吗？当前未保存的更改将丢失。');
    if (!confirmed) return;

    const newScene = sceneManager.createNewScene('新场景');
    sceneManager.setCurrentScene(newScene);
    this.refreshScene();
  }

  saveCurrentScene() {
    const name = prompt('场景名称:', sceneManager.currentScene.name);
    if (name === null) return;

    sceneManager.currentScene.name = name || sceneManager.currentScene.name;
    sceneStorage.saveSceneToList();
    
    alert('场景已保存！');
  }

  loadSampleScene(sampleId) {
    const confirmed = confirm('加载示例场景将覆盖当前场景，确定继续吗？');
    if (!confirmed) return;

    const sampleScene = sampleScenes.getSampleSceneById(sampleId);
    if (sampleScene) {
      sceneManager.setCurrentScene(sampleScene);
      this.refreshScene();
      this.setSelectMode();
    }
  }

  exportJSON() {
    exporter.downloadJSONScheme();
  }

  exportMarkdown() {
    exporter.downloadMarkdown();
  }

  importScene(file) {
    sceneStorage.importFromJSONFile(file, (scene, error) => {
      if (error) {
        alert('导入失败: ' + error);
        return;
      }

      const confirmed = confirm('导入的场景将替换当前场景，确定继续吗？');
      if (!confirmed) return;

      sceneManager.setCurrentScene(scene);
      this.refreshScene();
      alert('场景导入成功！');
    });
  }
}

const app = new App();

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

window.App = app;

export { App, app };
