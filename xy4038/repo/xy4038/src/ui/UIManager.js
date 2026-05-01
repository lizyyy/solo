import * as THREE from 'three';
import { ReportGenerator } from '../report/ReportGenerator.js';
import { ProblemTypes } from '../logic/CollisionDetector.js';

export class UIManager {
  constructor(app) {
    this.app = app;
    this.sceneManager = app.sceneManager;
    this.stage = app.stage;
    this.deviceLibrary = app.deviceLibrary;
    this.historyManager = app.historyManager;
    this.stateManager = app.stateManager;
    this.importExportManager = app.importExportManager;
    
    this.selectedObject = null;
    
    this.initElements();
    this.setupEventListeners();
    this.renderDeviceList();
  }
  
  initElements() {
    this.elements = {
      btnNew: document.getElementById('btn-new'),
      btnSave: document.getElementById('btn-save'),
      btnLoad: document.getElementById('btn-load'),
      btnImport: document.getElementById('btn-import'),
      btnExport: document.getElementById('btn-export'),
      btnExportReport: document.getElementById('btn-export-report'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      btnUndo: document.getElementById('btn-undo'),
      btnRedo: document.getElementById('btn-redo'),
      btnClearSelection: document.getElementById('btn-clear-selection'),
      btnDelete: document.getElementById('btn-delete'),
      
      devicesList: document.getElementById('devices-list'),
      propertiesPanel: document.getElementById('properties-panel'),
      problemsList: document.getElementById('problems-list'),
      loadsList: document.getElementById('loads-list'),
      
      deviceCount: document.getElementById('device-count'),
      problemCount: document.getElementById('problem-count'),
      lastSave: document.getElementById('last-save'),
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      
      stageWidth: document.getElementById('stage-width'),
      stageDepth: document.getElementById('stage-depth'),
      stageHeight: document.getElementById('stage-height'),
      gridXSpacing: document.getElementById('grid-x-spacing'),
      gridZSpacing: document.getElementById('grid-z-spacing'),
      hoistMaxLoad: document.getElementById('hoist-max-load')
    };
  }
  
  setupEventListeners() {
    this.elements.btnNew.addEventListener('click', () => this.handleNew());
    this.elements.btnSave.addEventListener('click', () => this.handleSave());
    this.elements.btnLoad.addEventListener('click', () => this.handleLoad());
    this.elements.btnImport.addEventListener('click', () => this.handleImport());
    this.elements.btnExport.addEventListener('click', () => this.handleExport());
    this.elements.btnExportReport.addEventListener('click', () => this.handleExportReport());
    this.elements.btnExportCSV.addEventListener('click', () => this.handleExportCSV());
    this.elements.btnUndo.addEventListener('click', () => this.handleUndo());
    this.elements.btnRedo.addEventListener('click', () => this.handleRedo());
    this.elements.btnClearSelection.addEventListener('click', () => this.handleClearSelection());
    this.elements.btnDelete.addEventListener('click', () => this.handleDelete());
    
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.handleTabClick(tab));
    });
    
    const settingsInputs = [
      this.elements.stageWidth,
      this.elements.stageDepth,
      this.elements.stageHeight,
      this.elements.gridXSpacing,
      this.elements.gridZSpacing,
      this.elements.hoistMaxLoad
    ];
    
    settingsInputs.forEach(input => {
      input.addEventListener('change', () => this.handleSettingsChange());
    });
    
    this.historyManager.on('change', () => this.updateUndoRedoButtons());
  }
  
  handleTabClick(tab) {
    const tabName = tab.dataset.tab;
    const container = tab.closest('.tab-container');
    
    container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    if (container.closest('#sidebar')) {
      document.querySelectorAll('#sidebar .tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');
    } else {
      document.querySelectorAll('#right-panel .tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');
    }
  }
  
  handleNew() {
    if (confirm('确定要新建方案吗？当前未保存的更改将丢失。')) {
      this.app.reset();
      this.updateStatus('已新建方案', 'safe');
    }
  }
  
  handleSave() {
    const result = this.stateManager.save();
    if (result.success) {
      this.updateLastSave(result.timestamp);
      this.updateStatus('保存成功', 'safe');
    } else {
      this.updateStatus(`保存失败: ${result.error}`, 'error');
    }
  }
  
  handleLoad() {
    const result = this.stateManager.load();
    if (result.success) {
      this.app.loadState(result.state);
      this.updateStatus('加载成功', 'safe');
    } else {
      this.updateStatus(`加载失败: ${result.error}`, 'error');
    }
  }
  
  handleImport() {
    this.importExportManager.createFileInput((result) => {
      if (result.success) {
        if (confirm(`导入成功${result.warnings?.length > 0 ? `，有${result.warnings.length}个警告` : ''}。确定要替换当前方案吗？`)) {
          this.app.loadState(result.data);
          this.updateStatus('导入成功', 'safe');
        }
      } else {
        alert(`导入失败:\n${result.errors.join('\n')}`);
        this.updateStatus('导入失败', 'error');
      }
    });
  }
  
  handleExport() {
    const timestamp = new Date().toISOString().slice(0, 10);
    this.importExportManager.downloadJSON(`stage-layout-${timestamp}.json`);
    this.updateStatus('导出成功', 'safe');
  }
  
  handleExportReport() {
    const loadData = this.app.loadCalculator.calculateAll();
    const problems = this.app.collisionDetector.checkAll(loadData);
    const reportGenerator = new ReportGenerator(
      this.stage,
      loadData,
      problems
    );
    reportGenerator.downloadMarkdown();
    this.updateStatus('报告生成成功', 'safe');
  }
  
  handleExportCSV() {
    const loadData = this.app.loadCalculator.calculateAll();
    const problems = this.app.collisionDetector.checkAll(loadData);
    const reportGenerator = new ReportGenerator(
      this.stage,
      loadData,
      problems
    );
    reportGenerator.downloadCSV();
    this.updateStatus('设备清单导出成功', 'safe');
  }
  
  handleUndo() {
    if (this.historyManager.canUndo()) {
      const action = this.historyManager.undo();
      this.app.executeUndoAction(action);
      this.updateStatus('已撤销', 'safe');
    }
  }
  
  handleRedo() {
    if (this.historyManager.canRedo()) {
      const action = this.historyManager.redo();
      this.app.executeRedoAction(action);
      this.updateStatus('已重做', 'safe');
    }
  }
  
  handleClearSelection() {
    this.sceneManager.setSelectedObject(null);
    this.selectedObject = null;
    this.renderPropertiesPanel();
  }
  
  handleDelete() {
    const selected = this.sceneManager.selectedObject;
    if (selected && selected.userData.type === 'device') {
      if (confirm(`确定要删除 ${selected.userData.name} 吗？`)) {
        this.historyManager.push(
          this.historyManager.createRemoveDeviceAction(selected)
        );
        this.stage.removeDevice(selected);
        this.sceneManager.setSelectedObject(null);
        this.selectedObject = null;
        this.renderPropertiesPanel();
        this.updateDeviceCount();
        this.app.updateProblems();
        this.updateStatus('已删除设备', 'safe');
      }
    }
  }
  
  handleSettingsChange() {
    const oldSettings = { ...this.stage.userData.settings };
    const newSettings = {
      width: parseFloat(this.elements.stageWidth.value) || 16,
      depth: parseFloat(this.elements.stageDepth.value) || 10,
      height: parseFloat(this.elements.stageHeight.value) || 8,
      gridXSpacing: parseFloat(this.elements.gridXSpacing.value) || 2,
      gridZSpacing: parseFloat(this.elements.gridZSpacing.value) || 2,
      hoistMaxLoad: parseFloat(this.elements.hoistMaxLoad.value) || 500
    };
    
    this.stage.updateSettings(newSettings);
    this.historyManager.push(
      this.historyManager.createUpdateSettingsAction(oldSettings, newSettings)
    );
    this.updateStatus('设置已更新', 'safe');
  }
  
  renderDeviceList() {
    const devices = this.deviceLibrary.getDevices();
    const html = devices.map(device => `
      <div class="device-item" draggable="true" data-device-id="${device.id}">
        <div class="device-name">${device.name}</div>
        <div class="device-info">
          重量: ${device.weight}kg | 
          尺寸: ${device.width}×${device.height}×${device.depth}m
        </div>
      </div>
    `).join('');
    
    this.elements.devicesList.innerHTML = html || `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div>设备库为空</div>
      </div>
    `;
    
    const deviceItems = this.elements.devicesList.querySelectorAll('.device-item');
    deviceItems.forEach(item => {
      item.addEventListener('dragstart', (e) => this.handleDeviceDragStart(e));
      item.addEventListener('dragend', (e) => this.handleDeviceDragEnd(e));
    });
  }
  
  handleDeviceDragStart(e) {
    const deviceId = e.target.dataset.deviceId;
    e.dataTransfer.setData('text/plain', deviceId);
    e.target.classList.add('dragging');
    
    const canvas = this.sceneManager.canvas;
    this.sceneManager.controls.enabled = false;
    
    const canvasDragOver = (event) => {
      event.preventDefault();
    };
    
    const canvasDrop = (event) => {
      event.preventDefault();
      const droppedDeviceId = event.dataTransfer.getData('text/plain');
      this.handleDeviceDrop(droppedDeviceId, event.clientX, event.clientY);
      
      canvas.removeEventListener('dragover', canvasDragOver);
      canvas.removeEventListener('drop', canvasDrop);
      this.sceneManager.controls.enabled = true;
    };
    
    canvas.addEventListener('dragover', canvasDragOver);
    canvas.addEventListener('drop', canvasDrop);
  }
  
  handleDeviceDragEnd(e) {
    e.target.classList.remove('dragging');
  }
  
  handleDeviceDrop(deviceId, clientX, clientY) {
    const template = this.deviceLibrary.getDeviceById(deviceId);
    if (!template) return;
    
    const device = this.deviceLibrary.createDeviceInstance(deviceId);
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rect = this.sceneManager.canvas.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, this.sceneManager.camera);
    
    const planeY = 5;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    
    if (intersectPoint) {
      device.updatePosition(intersectPoint.x, intersectPoint.y, intersectPoint.z);
    }
    
    for (const hoistPoint of this.stage.hoistPoints) {
      const distance = new THREE.Vector3(
        device.userData.position.x,
        device.userData.position.y,
        device.userData.position.z
      ).distanceTo(hoistPoint.position);
      
      if (distance < 0.5) {
        device.attachTo(hoistPoint.userData.id, 'hoistPoint');
        hoistPoint.attachDevice(device);
        break;
      }
    }
    
    this.stage.addDevice(device);
    this.historyManager.push(
      this.historyManager.createAddDeviceAction(device)
    );
    this.sceneManager.add(device);
    
    this.updateDeviceCount();
    this.app.updateProblems();
    this.updateStatus(`已添加 ${template.name}`, 'safe');
  }
  
  renderPropertiesPanel() {
    const selected = this.sceneManager.selectedObject;
    
    if (!selected) {
      this.elements.propertiesPanel.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎯</div>
          <div>选择对象查看属性</div>
        </div>
      `;
      return;
    }
    
    const userData = selected.userData;
    let html = `<h3 style="margin-bottom: 15px; color: #2c3e50;">${userData.name || '对象'}</h3>`;
    
    if (userData.type === 'device') {
      html += `
        <div class="property-row">
          <div class="property-label">ID</div>
          <div class="property-value">${userData.id}</div>
        </div>
        <div class="property-row">
          <div class="property-label">类型</div>
          <div class="property-value">${this.getDeviceTypeName(userData.deviceType)}</div>
        </div>
        <div class="property-row">
          <div class="property-label">重量</div>
          <div class="property-value">${userData.weight} kg</div>
        </div>
        <div class="property-row">
          <div class="property-label">尺寸</div>
          <div class="property-value">
            ${userData.dimensions.width}×${userData.dimensions.height}×${userData.dimensions.depth} m
          </div>
        </div>
        <div class="property-row">
          <div class="property-label">位置</div>
          <div class="property-value">
            (${userData.position.x.toFixed(2)}, ${userData.position.y.toFixed(2)}, ${userData.position.z.toFixed(2)})
          </div>
        </div>
        <div class="property-row">
          <div class="property-label">旋转</div>
          <div class="property-value">
            (${THREE.MathUtils.radToDeg(userData.rotation.x).toFixed(1)}°, 
            ${THREE.MathUtils.radToDeg(userData.rotation.y).toFixed(1)}°, 
            ${THREE.MathUtils.radToDeg(userData.rotation.z).toFixed(1)}°)
          </div>
        </div>
        <div class="property-row">
          <div class="property-label">挂载方式</div>
          <div class="property-value">${this.getMountModeName(userData.mountingMode)}</div>
        </div>
        ${userData.attachedTo ? `
        <div class="property-row">
          <div class="property-label">挂载到</div>
          <div class="property-value">${userData.attachedTo}</div>
        </div>
        ` : ''}
        <div class="property-row">
          <div class="property-label">安全间距</div>
          <div class="property-value">${userData.safetyClearance} m</div>
        </div>
      `;
      
      html += `
        <div class="button-group">
          <button class="primary" onclick="document.getElementById('btn-delete').click()">删除</button>
        </div>
        <div style="margin-top: 10px; padding: 10px; background: #f5f6fa; border-radius: 4px; font-size: 12px; color: #7f8c8d;">
          <strong>操作提示:</strong><br>
          • 方向键: 移动设备<br>
          • Shift + 方向键: 旋转/调整高度<br>
          • Delete: 删除设备
        </div>
      `;
    } else if (userData.type === 'hoistPoint') {
      const loadData = this.app.loadCalculator.getHoistPointLoad(userData.id);
      html += `
        <div class="property-row">
          <div class="property-label">ID</div>
          <div class="property-value">${userData.id}</div>
        </div>
        <div class="property-row">
          <div class="property-label">位置</div>
          <div class="property-value">(${userData.x.toFixed(2)}, ${userData.z.toFixed(2)})</div>
        </div>
        <div class="property-row">
          <div class="property-label">网格坐标</div>
          <div class="property-value">(${userData.gridX}, ${userData.gridZ})</div>
        </div>
        <div class="property-row">
          <div class="property-label">安全载荷</div>
          <div class="property-value">${userData.maxLoad} kg</div>
        </div>
        ${loadData ? `
        <div class="property-row">
          <div class="property-label">当前载荷</div>
          <div class="property-value" style="color: ${loadData.status === 'danger' ? '#e74c3c' : loadData.status === 'warning' ? '#f39c12' : '#2ecc71'}">
            ${loadData.load.toFixed(1)} kg (${(loadData.load / loadData.maxLoad * 100).toFixed(1)}%)
          </div>
        </div>
        <div class="property-row">
          <div class="property-label">挂载设备数</div>
          <div class="property-value">${loadData.devices?.length || 0}</div>
        </div>
        ` : ''}
      `;
    } else if (userData.type === 'bar') {
      html += `
        <div class="property-row">
          <div class="property-label">ID</div>
          <div class="property-value">${userData.id}</div>
        </div>
        <div class="property-row">
          <div class="property-label">长度</div>
          <div class="property-value">${userData.length} m</div>
        </div>
        <div class="property-row">
          <div class="property-label">高度</div>
          <div class="property-value">${userData.height} m</div>
        </div>
        <div class="property-row">
          <div class="property-label">单位重量</div>
          <div class="property-value">${userData.weightPerMeter} kg/m</div>
        </div>
        <div class="property-row">
          <div class="property-label">支撑吊点</div>
          <div class="property-value">${userData.supportHoistPoints?.length || 0} 个</div>
        </div>
      `;
    }
    
    this.elements.propertiesPanel.innerHTML = html;
  }
  
  renderProblemsList(problems) {
    if (!problems || problems.length === 0) {
      this.elements.problemsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div>未检测到问题</div>
        </div>
      `;
      return;
    }
    
    const html = problems.map(problem => `
      <div class="problem-item ${problem.severity === 'warning' ? 'warning' : ''}" 
           data-object-id="${problem.objectId}"
           data-related-object-id="${problem.relatedObjectId || ''}">
        <div class="problem-title">${this.getProblemTypeName(problem.type)}</div>
        <div class="problem-details">
          ${problem.message}<br>
          <span style="color: #95a5a6;">坐标: (${problem.position.x.toFixed(1)}, ${problem.position.y.toFixed(1)}, ${problem.position.z.toFixed(1)})</span>
        </div>
      </div>
    `).join('');
    
    this.elements.problemsList.innerHTML = html;
    
    const problemItems = this.elements.problemsList.querySelectorAll('.problem-item');
    problemItems.forEach(item => {
      item.addEventListener('click', () => {
        const objectId = item.dataset.objectId;
        const relatedObjectId = item.dataset.relatedObjectId;
        
        const object = this.stage.getObjectById(objectId) || 
                       this.stage.getDeviceById(objectId) ||
                       this.stage.getBarById(objectId) ||
                       this.stage.getHoistPointById(objectId);
        
        if (object) {
          this.sceneManager.setSelectedObject(object);
          this.renderPropertiesPanel();
          
          if (object.position) {
            this.sceneManager.controls.target.set(
              object.position.x,
              object.position.y,
              object.position.z
            );
          }
        }
      });
    });
  }
  
  renderLoadsList(loadData) {
    if (!loadData || !loadData.hoistPoints) {
      this.elements.loadsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div>暂无载荷数据</div>
        </div>
      `;
      return;
    }
    
    const loadedHoists = Object.entries(loadData.hoistPoints)
      .filter(([_, data]) => data.load > 0)
      .sort((a, b) => b[1].load - a[1].load);
    
    if (loadedHoists.length === 0) {
      this.elements.loadsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div>当前无加载吊点</div>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    for (const [hoistId, data] of loadedHoists) {
      const ratio = data.load / data.maxLoad;
      const percentage = Math.min(ratio * 100, 100);
      const statusClass = ratio > 1 ? 'danger' : ratio > 0.85 ? 'warning' : 'safe';
      
      html += `
        <div class="load-indicator" data-hoist-id="${hoistId}">
          <div style="font-size: 12px; font-weight: 600; min-width: 80px;">
            ${hoistId}
          </div>
          <div class="load-bar">
            <div class="load-bar-fill ${statusClass}" style="width: ${percentage}%;"></div>
          </div>
          <div class="load-text">
            ${data.load.toFixed(1)}/${data.maxLoad}kg
          </div>
        </div>
      `;
    }
    
    html += `
      <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 4px;">
        <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">总载荷</div>
        <div style="font-size: 18px; font-weight: 600; color: #2c3e50;">
          ${loadData.totalLoad?.toFixed(1) || 0} kg
        </div>
      </div>
    `;
    
    this.elements.loadsList.innerHTML = html;
  }
  
  updateDeviceCount() {
    this.elements.deviceCount.textContent = this.stage.devices.length;
  }
  
  updateProblemCount(problems) {
    const count = problems ? problems.length : 0;
    this.elements.problemCount.textContent = count;
    
    if (count > 0) {
      const hasDanger = problems.some(p => p.severity === 'danger');
      this.updateStatus(hasDanger ? '存在严重问题' : '存在警告问题', hasDanger ? 'error' : 'warning');
    } else {
      this.updateStatus('就绪', 'safe');
    }
  }
  
  updateLastSave(timestamp) {
    if (timestamp) {
      this.elements.lastSave.textContent = timestamp.toLocaleTimeString('zh-CN');
    }
  }
  
  updateStatus(text, status = 'safe') {
    this.elements.statusText.textContent = text;
    this.elements.statusIndicator.className = 'status-indicator';
    if (status === 'warning') {
      this.elements.statusIndicator.classList.add('warning');
    } else if (status === 'error') {
      this.elements.statusIndicator.classList.add('error');
    }
  }
  
  updateUndoRedoButtons() {
    this.elements.btnUndo.disabled = !this.historyManager.canUndo();
    this.elements.btnRedo.disabled = !this.historyManager.canRedo();
  }
  
  getDeviceTypeName(type) {
    const names = {
      light: '灯光设备',
      speaker: '音响设备',
      screen: '幕布/屏幕',
      prop: '道具/桁架',
      custom: '自定义设备'
    };
    return names[type] || type;
  }
  
  getMountModeName(mode) {
    const names = {
      hoist_direct: '直接挂吊点',
      bar_attached: '挂横杆',
      floor_standing: '地面放置'
    };
    return names[mode] || mode;
  }
  
  getProblemTypeName(type) {
    const names = {
      [ProblemTypes.OVERLOAD]: '吊点超载',
      [ProblemTypes.LOAD_IMBALANCE]: '载荷分布不均',
      [ProblemTypes.COLLISION]: '设备碰撞',
      [ProblemTypes.LIGHT_OCCLUSION]: '灯光遮挡',
      [ProblemTypes.CLEARANCE_VIOLATION]: '边界违规',
      [ProblemTypes.WALKING_HEIGHT]: '通道净高不足',
      [ProblemTypes.UNSUPPORTED_DEVICE]: '未挂载设备'
    };
    return names[type] || type;
  }
}
