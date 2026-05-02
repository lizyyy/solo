import { SceneRenderer } from './scene/index.js';
import { InteractionController } from './interaction/index.js';
import { RiskAnalyzer } from './rules/index.js';
import { StorageManager } from './storage/index.js';
import { IOManager } from './io/index.js';
import { GeometryCalculator } from './geometry/index.js';
import { loadSampleData } from './data/sample.js';

class CCTVInspectorApp {
  constructor() {
    this.canvas = document.getElementById('three-canvas');
    this.sceneRenderer = null;
    this.interactionController = null;
    this.riskAnalyzer = null;
    this.storageManager = null;
    this.ioManager = null;
    this.geometryCalculator = null;
    
    this.currentRiskResults = null;
    this.idCounter = 1;
    
    this.init();
  }

  init() {
    this.sceneRenderer = new SceneRenderer(this.canvas);
    this.interactionController = new InteractionController(this.sceneRenderer, this.canvas);
    this.riskAnalyzer = new RiskAnalyzer();
    this.storageManager = new StorageManager();
    this.ioManager = new IOManager(this.storageManager, this.riskAnalyzer);
    this.geometryCalculator = new GeometryCalculator();

    this.setupEventListeners();
    
    if (this.storageManager.hasSavedData()) {
      this.storageManager.load(this.sceneRenderer);
      this.updateUI();
      this.calculateRisk();
    }

    this.storageManager.startAutoSave(this.sceneRenderer);

    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    
    this.updateUI();
  }

  setupEventListeners() {
    this.interactionController.onSelect = (mesh) => {
      this.showPropertyPanel(mesh);
      this.updateSidebarSelection(mesh);
    };

    this.interactionController.onDeselect = () => {
      this.hidePropertyPanel();
      this.clearSidebarSelection();
    };

    this.interactionController.onMove = () => {
      this.updatePropertyPanel();
    };

    document.getElementById('btn-new').addEventListener('click', () => this.handleNew());
    document.getElementById('btn-save').addEventListener('click', () => this.handleSave());
    document.getElementById('btn-export-json').addEventListener('click', () => this.handleExportJSON());
    document.getElementById('btn-export-report').addEventListener('click', () => this.handleExportReport());
    document.getElementById('btn-import').addEventListener('click', () => this.handleImportClick());
    document.getElementById('file-import').addEventListener('change', (e) => this.handleImportFile(e));
    
    document.getElementById('btn-add-wall').addEventListener('click', () => this.addWall());
    document.getElementById('btn-add-pillar').addEventListener('click', () => this.addPillar());
    document.getElementById('btn-add-camera').addEventListener('click', () => this.addCamera());
    document.getElementById('btn-add-parking').addEventListener('click', () => this.addParking());
    document.getElementById('btn-add-passage').addEventListener('click', () => this.addPassage());
    
    document.getElementById('btn-sample').addEventListener('click', () => this.loadSample());
    document.getElementById('btn-calc-risk').addEventListener('click', () => this.calculateRisk());
  }

  handleKeydown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selected = this.interactionController.getSelectedObject();
      if (selected && e.target.tagName !== 'INPUT') {
        this.deleteSelected();
      }
    }
    
    if (e.key === 'r' || e.key === 'R') {
      const selected = this.interactionController.getSelectedObject();
      if (selected && this.rotateMode) {
        this.interactionController.rotateSelected(10);
        this.updatePropertyPanel();
      }
    }
    
    if (e.shiftKey) {
      this.rotateMode = true;
    }
  }

  handleNew() {
    if (confirm('确定要新建场景吗？当前未保存的更改将丢失。')) {
      this.sceneRenderer.clearScene();
      this.currentRiskResults = null;
      this.updateUI();
      this.hidePropertyPanel();
      this.clearSidebarSelection();
    }
  }

  handleSave() {
    this.storageManager.save(this.sceneRenderer);
    this.showNotification('场景已保存到本地存储');
  }

  handleExportJSON() {
    this.ioManager.downloadJSON(this.sceneRenderer);
    this.showNotification('JSON 布局文件已下载');
  }

  handleExportReport() {
    if (!this.currentRiskResults) {
      this.calculateRisk();
    }
    this.ioManager.downloadMarkdownReport(this.sceneRenderer, this.currentRiskResults);
    this.showNotification('巡检报告已下载');
  }

  handleImportClick() {
    document.getElementById('file-import').click();
  }

  async handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await this.ioManager.importFromFile(this.sceneRenderer, file);
      this.updateUI();
      this.calculateRisk();
      this.showNotification('导入成功');
    } catch (error) {
      this.showNotification('导入失败: ' + error.message, 'error');
    }

    e.target.value = '';
  }

  addWall() {
    const id = `wall-${this.idCounter++}`;
    const mesh = this.sceneRenderer.createWall({
      id,
      position: { x: 0, z: 0 },
      width: 10,
      height: 3,
      depth: 0.5,
      rotation: 0
    });
    this.updateUI();
    this.showNotification('已添加墙体');
  }

  addPillar() {
    const id = `pillar-${this.idCounter++}`;
    const mesh = this.sceneRenderer.createPillar({
      id,
      position: { x: 0, z: 0 },
      radius: 0.5,
      height: 3
    });
    this.updateUI();
    this.showNotification('已添加立柱');
  }

  addCamera() {
    const id = `cam-${this.idCounter++}`;
    const mesh = this.sceneRenderer.createCamera({
      id,
      position: { x: 0, z: 0 },
      rotation: { x: -0.5, y: 0, z: 0 },
      fov: 90,
      aspect: 16/9,
      near: 0.1,
      far: 50,
      height: 3.5,
      name: ''
    });
    this.updateUI();
    this.showNotification('已添加摄像头');
  }

  addParking() {
    const id = `parking-${this.idCounter++}`;
    const mesh = this.sceneRenderer.createParking({
      id,
      position: { x: 0, z: 0 },
      width: 5,
      depth: 2.5,
      rotation: 0,
      label: ''
    });
    this.updateUI();
    this.showNotification('已添加车位');
  }

  addPassage() {
    const id = `passage-${this.idCounter++}`;
    const mesh = this.sceneRenderer.createPassage({
      id,
      position: { x: 0, z: 0 },
      width: 10,
      depth: 8,
      rotation: 0,
      isCritical: false,
      name: ''
    });
    this.updateUI();
    this.showNotification('已添加通道');
  }

  loadSample() {
    loadSampleData(this.sceneRenderer);
    this.updateUI();
    this.calculateRisk();
    this.showNotification('示例数据已加载');
  }

  calculateRisk() {
    this.currentRiskResults = this.riskAnalyzer.analyze(this.sceneRenderer);
    this.updateRiskPanel();
    this.updateStats();
    this.showHeatMap();
  }

  showHeatMap() {
    if (this.currentRiskResults && this.sceneRenderer.objects.cameras.length > 0) {
      const obstacles = [...this.sceneRenderer.objects.walls, ...this.sceneRenderer.objects.pillars];
      const bounds = this.riskAnalyzer.calculateBounds(this.sceneRenderer);
      
      const heatMap = this.geometryCalculator.calculateHeatMap(
        this.sceneRenderer.objects.cameras.map(c => ({
          id: c.id,
          position: c.mesh.position.clone(),
          rotation: c.mesh.rotation.clone(),
          fov: c.data.fov || 60,
          aspect: c.data.aspect || 16/9,
          near: c.data.near || 0.1,
          far: c.data.far || 50
        })),
        obstacles,
        bounds
      );

      this.sceneRenderer.createHeatMap(heatMap);
    }
  }

  deleteSelected() {
    const selected = this.interactionController.getSelectedObject();
    if (selected) {
      this.sceneRenderer.deleteObject(selected);
      this.updateUI();
      this.hidePropertyPanel();
      this.clearSidebarSelection();
      this.showNotification('已删除选中对象');
    }
  }

  showPropertyPanel(mesh) {
    const panel = document.getElementById('property-panel');
    const content = document.getElementById('property-content');
    const title = document.getElementById('property-title');
    const noSelection = document.getElementById('no-selection');

    const type = mesh.userData.type;
    const data = mesh.userData.data;

    let titleText = '';
    switch (type) {
      case 'wall': titleText = '🧱 墙体属性'; break;
      case 'pillar': titleText = '🏛️ 立柱属性'; break;
      case 'camera': titleText = '📹 摄像头属性'; break;
      case 'parking': titleText = '🅿️ 车位属性'; break;
      case 'passage': titleText = '🚗 通道属性'; break;
      default: titleText = '属性编辑';
    }
    title.textContent = titleText;

    let html = `<div class="property">
      <label>ID</label>
      <input type="text" value="${mesh.userData.id}" disabled>
    </div>`;

    html += `<div class="property">
      <label>位置 X</label>
      <input type="number" step="0.1" value="${mesh.position.x.toFixed(1)}" 
             data-prop="positionX">
    </div>
    <div class="property">
      <label>位置 Z</label>
      <input type="number" step="0.1" value="${mesh.position.z.toFixed(1)}"
             data-prop="positionZ">
    </div>`;

    if (type === 'wall') {
      html += `<div class="property">
        <label>宽度</label>
        <input type="number" step="0.1" value="${data.width}" data-prop="width">
      </div>
      <div class="property">
        <label>高度</label>
        <input type="number" step="0.1" value="${data.height}" data-prop="height">
      </div>
      <div class="property">
        <label>厚度</label>
        <input type="number" step="0.1" value="${data.depth}" data-prop="depth">
      </div>
      <div class="property">
        <label>旋转角度 (°)</label>
        <input type="number" step="1" value="${((data.rotation || 0) * 180 / Math.PI).toFixed(0)}" data-prop="rotation">
      </div>`;
    }

    if (type === 'pillar') {
      html += `<div class="property">
        <label>半径</label>
        <input type="number" step="0.1" value="${data.radius}" data-prop="radius">
      </div>
      <div class="property">
        <label>高度</label>
        <input type="number" step="0.1" value="${data.height}" data-prop="height">
      </div>`;
    }

    if (type === 'camera') {
      html += `<div class="property">
        <label>名称</label>
        <input type="text" value="${data.name || ''}" data-prop="name" placeholder="摄像头名称">
      </div>
      <div class="property">
        <label>安装高度 (米)</label>
        <input type="number" step="0.1" value="${data.height || 3.5}" data-prop="cameraHeight">
      </div>
      <div class="property">
        <label>视角 (FOV) °</label>
        <input type="range" min="30" max="120" value="${data.fov || 90}" data-prop="fov">
        <span>${data.fov || 90}°</span>
      </div>
      <div class="property">
        <label>朝向角度 (°)</label>
        <input type="number" step="1" value="${((data.rotation?.y || 0) * 180 / Math.PI).toFixed(0)}" data-prop="cameraRotation">
      </div>
      <div class="property">
        <label>最远距离 (米)</label>
        <input type="number" step="1" value="${data.far || 50}" data-prop="far">
      </div>`;
    }

    if (type === 'parking') {
      html += `<div class="property">
        <label>车位标签</label>
        <input type="text" value="${data.label || ''}" data-prop="label" placeholder="如: A01">
      </div>
      <div class="property">
        <label>宽度</label>
        <input type="number" step="0.1" value="${data.width}" data-prop="width">
      </div>
      <div class="property">
        <label>深度</label>
        <input type="number" step="0.1" value="${data.depth}" data-prop="depth">
      </div>
      <div class="property">
        <label>旋转角度 (°)</label>
        <input type="number" step="1" value="${((data.rotation || 0) * 180 / Math.PI).toFixed(0)}" data-prop="rotation">
      </div>`;
    }

    if (type === 'passage') {
      html += `<div class="property">
        <label>通道名称</label>
        <input type="text" value="${data.name || ''}" data-prop="passageName" placeholder="通道名称">
      </div>
      <div class="property">
        <label>宽度</label>
        <input type="number" step="0.1" value="${data.width}" data-prop="width">
      </div>
      <div class="property">
        <label>深度</label>
        <input type="number" step="0.1" value="${data.depth}" data-prop="depth">
      </div>
      <div class="property">
        <label>旋转角度 (°)</label>
        <input type="number" step="1" value="${((data.rotation || 0) * 180 / Math.PI).toFixed(0)}" data-prop="rotation">
      </div>
      <div class="property">
        <label>关键通道</label>
        <select data-prop="isCritical">
          <option value="true" ${data.isCritical ? 'selected' : ''}>是</option>
          <option value="false" ${!data.isCritical ? 'selected' : ''}>否</option>
        </select>
      </div>`;
    }

    html += `<button class="btn" style="width:100%;margin-top:15px;" id="btn-delete-selected">🗑️ 删除选中对象</button>`;

    content.innerHTML = html;

    const inputs = content.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        this.handlePropertyChange(mesh, e.target.dataset.prop, e.target.value);
      });
      if (input.type === 'range') {
        input.addEventListener('input', (e) => {
          e.target.nextElementSibling.textContent = e.target.value + '°';
        });
      }
    });

    const deleteBtn = document.getElementById('btn-delete-selected');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteSelected());
    }

    panel.classList.remove('hidden');
    noSelection.classList.add('hidden');
  }

  handlePropertyChange(mesh, prop, value) {
    const data = mesh.userData.data;

    switch (prop) {
      case 'positionX':
        mesh.position.x = parseFloat(value);
        data.position.x = parseFloat(value);
        if (mesh.userData.type === 'camera') {
          this.sceneRenderer.updateCameraFrustum(mesh);
        }
        break;
      case 'positionZ':
        mesh.position.z = parseFloat(value);
        data.position.z = parseFloat(value);
        if (mesh.userData.type === 'camera') {
          this.sceneRenderer.updateCameraFrustum(mesh);
        }
        break;
      case 'width':
      case 'height':
      case 'depth':
      case 'radius':
        data[prop] = parseFloat(value);
        break;
      case 'rotation':
        const angle = parseFloat(value) * Math.PI / 180;
        mesh.rotation.y = angle;
        data.rotation = angle;
        break;
      case 'name':
        data.name = value;
        break;
      case 'cameraHeight':
        const camHeight = parseFloat(value);
        mesh.position.y = camHeight;
        data.height = camHeight;
        this.sceneRenderer.updateCameraFrustum(mesh);
        break;
      case 'fov':
        data.fov = parseFloat(value);
        this.sceneRenderer.updateCameraFrustum(mesh);
        break;
      case 'cameraRotation':
        const camAngle = parseFloat(value) * Math.PI / 180;
        mesh.rotation.y = camAngle;
        data.rotation.y = camAngle;
        this.sceneRenderer.updateCameraFrustum(mesh);
        break;
      case 'far':
        data.far = parseFloat(value);
        this.sceneRenderer.updateCameraFrustum(mesh);
        break;
      case 'label':
        data.label = value;
        break;
      case 'passageName':
        data.name = value;
        break;
      case 'isCritical':
        data.isCritical = value === 'true';
        break;
    }

    this.updateSidebarLists();
  }

  hidePropertyPanel() {
    const panel = document.getElementById('property-panel');
    const noSelection = document.getElementById('no-selection');
    panel.classList.add('hidden');
    noSelection.classList.remove('hidden');
  }

  updatePropertyPanel() {
    const selected = this.interactionController.getSelectedObject();
    if (selected) {
      this.showPropertyPanel(selected);
    }
  }

  updateUI() {
    this.updateStats();
    this.updateSidebarLists();
  }

  updateStats() {
    const { walls, pillars, cameras, parkings, passages } = this.sceneRenderer.objects;
    
    document.getElementById('stat-cameras').textContent = cameras.length;
    document.getElementById('stat-walls').textContent = walls.length;
    document.getElementById('stat-pillars').textContent = pillars.length;
    document.getElementById('stat-parkings').textContent = parkings.length;
    document.getElementById('stat-passages').textContent = passages.length;

    if (this.currentRiskResults) {
      document.getElementById('stat-blind-spots').textContent = this.currentRiskResults.summary.totalBlindSpots;
      document.getElementById('stat-overlaps').textContent = this.currentRiskResults.summary.totalOverlaps;
    } else {
      document.getElementById('stat-blind-spots').textContent = '-';
      document.getElementById('stat-overlaps').textContent = '-';
    }
  }

  updateSidebarLists() {
    this.updateCameraList();
    this.updateParkingList();
    this.updatePassageList();
  }

  updateCameraList() {
    const container = document.getElementById('camera-list');
    const cameras = this.sceneRenderer.objects.cameras;

    if (cameras.length === 0) {
      container.innerHTML = '<p style="color:#666;font-size:12px;">暂无摄像头</p>';
      return;
    }

    const selected = this.interactionController.getSelectedObject();
    const selectedId = selected?.userData?.id;

    container.innerHTML = cameras.map(cam => `
      <div class="item ${cam.id === selectedId ? 'active' : ''}" data-id="${cam.id}" data-type="camera">
        <div class="icon">📹</div>
        <div>${cam.data.name || '未命名'} (${cam.id})</div>
      </div>
    `).join('');

    container.querySelectorAll('.item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const obj = this.sceneRenderer.objects.cameras.find(c => c.id === id);
        if (obj) {
          this.interactionController.selectedObject = obj.mesh;
          this.sceneRenderer.selectObject(obj.mesh);
          this.showPropertyPanel(obj.mesh);
          this.updateSidebarSelection(obj.mesh);
        }
      });
    });
  }

  updateParkingList() {
    const container = document.getElementById('parking-list');
    const parkings = this.sceneRenderer.objects.parkings;

    if (parkings.length === 0) {
      container.innerHTML = '<p style="color:#666;font-size:12px;">暂无车位</p>';
      return;
    }

    const selected = this.interactionController.getSelectedObject();
    const selectedId = selected?.userData?.id;

    container.innerHTML = parkings.map(parking => `
      <div class="item ${parking.id === selectedId ? 'active' : ''}" data-id="${parking.id}" data-type="parking">
        <div class="icon">🅿️</div>
        <div>${parking.data.label || '未命名'} (${parking.id})</div>
      </div>
    `).join('');

    container.querySelectorAll('.item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const obj = this.sceneRenderer.objects.parkings.find(p => p.id === id);
        if (obj) {
          this.interactionController.selectedObject = obj.mesh;
          this.sceneRenderer.selectObject(obj.mesh);
          this.showPropertyPanel(obj.mesh);
          this.updateSidebarSelection(obj.mesh);
        }
      });
    });
  }

  updatePassageList() {
    const container = document.getElementById('passage-list');
    const passages = this.sceneRenderer.objects.passages;

    if (passages.length === 0) {
      container.innerHTML = '<p style="color:#666;font-size:12px;">暂无通道</p>';
      return;
    }

    const selected = this.interactionController.getSelectedObject();
    const selectedId = selected?.userData?.id;

    container.innerHTML = passages.map(passage => `
      <div class="item ${passage.id === selectedId ? 'active' : ''}" data-id="${passage.id}" data-type="passage">
        <div class="icon">${passage.data.isCritical ? '⚠️' : '🚗'}</div>
        <div>${passage.data.name || '未命名'} (${passage.id})</div>
      </div>
    `).join('');

    container.querySelectorAll('.item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const obj = this.sceneRenderer.objects.passages.find(p => p.id === id);
        if (obj) {
          this.interactionController.selectedObject = obj.mesh;
          this.sceneRenderer.selectObject(obj.mesh);
          this.showPropertyPanel(obj.mesh);
          this.updateSidebarSelection(obj.mesh);
        }
      });
    });
  }

  updateSidebarSelection(mesh) {
    this.updateSidebarLists();
  }

  clearSidebarSelection() {
    this.updateSidebarLists();
  }

  updateRiskPanel() {
    const container = document.getElementById('risk-content');
    
    if (!this.currentRiskResults) {
      container.innerHTML = '<p style="color:#666;font-size:12px;">点击"计算风险"按钮进行分析</p>';
      return;
    }

    const { summary, blindSpots, overlaps, passageRisks, parkingRisks } = this.currentRiskResults;

    if (summary.criticalCount === 0 && summary.warningCount === 0) {
      container.innerHTML = `
        <div class="risk-info">
          <strong>✅ 风险分析完成</strong><br>
          无显著风险发现，摄像头布局良好
        </div>
      `;
      return;
    }

    let html = '';

    blindSpots.forEach(spot => {
      const className = spot.level === 'critical' ? 'risk-alert' : 'risk-warning';
      html += `<div class="${className}">
        <strong>${spot.title}</strong><br>
        ${spot.description}
      </div>`;
    });

    overlaps.forEach(overlap => {
      const className = overlap.level === 'critical' ? 'risk-alert' : 'risk-warning';
      html += `<div class="${className}">
        <strong>${overlap.title}</strong><br>
        ${overlap.description}
      </div>`;
    });

    passageRisks.forEach(risk => {
      const className = risk.level === 'critical' ? 'risk-alert' : 'risk-warning';
      html += `<div class="${className}">
        <strong>${risk.title}</strong><br>
        ${risk.description}
      </div>`;
    });

    parkingRisks.forEach(risk => {
      html += `<div class="risk-warning">
        <strong>${risk.title}</strong><br>
        ${risk.description}
      </div>`;
    });

    container.innerHTML = html;
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      padding: 12px 24px;
      background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
      color: white;
      border-radius: 4px;
      z-index: 1000;
      animation: fadeInOut 3s ease-in-out;
      font-size: 14px;
    `;
    notification.textContent = message;
    
    if (!document.getElementById('notification-style')) {
      const style = document.createElement('style');
      style.id = 'notification-style';
      style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-20px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CCTVInspectorApp();
});

export default CCTVInspectorApp;
