import ElementFactory from '../core/ElementFactory';

class UIHandler {
  constructor() {
    this.sceneManager = null;
    this.collisionDetector = null;
    this.reportGenerator = null;
    this.stageSize = null;
    this.selectedElement = null;
    this.collisionResults = null;
    this.lastUpdateTime = 0;
  }

  init(options) {
    this.sceneManager = options.sceneManager;
    this.collisionDetector = options.collisionDetector;
    this.reportGenerator = options.reportGenerator;
    this.stageSize = options.stageSize;
    
    this.setupCallbacks();
    this.bindUIEvents();
    this.renderElementList();
    this.checkCollisions();
  }

  setupCallbacks() {
    this.sceneManager.onElementSelect = (element) => {
      this.selectedElement = element;
      this.renderSelectedInfo();
      this.renderElementList();
    };
    
    this.sceneManager.onElementsChange = () => {
      this.checkCollisions();
    };
  }

  bindUIEvents() {
    document.getElementById('saveBtn').addEventListener('click', () => this.saveScene());
    document.getElementById('loadBtn').addEventListener('click', () => this.showLoadDialog());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportReport());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetScene());
    
    document.getElementById('topView').addEventListener('click', () => this.sceneManager.setView('top'));
    document.getElementById('frontView').addEventListener('click', () => this.sceneManager.setView('front'));
    document.getElementById('sideView').addEventListener('click', () => this.sceneManager.setView('side'));
    document.getElementById('perspectiveView').addEventListener('click', () => this.sceneManager.setView('perspective'));
    
    document.getElementById('showBoundary').addEventListener('change', (e) => {
      this.sceneManager.showBoundary = e.target.checked;
      this.updateHighlights();
    });
    
    document.getElementById('showCollision').addEventListener('change', (e) => {
      this.sceneManager.showCollision = e.target.checked;
      this.updateHighlights();
    });
  }

  updateStatus() {
    const now = Date.now();
    if (now - this.lastUpdateTime < 100) return;
    this.lastUpdateTime = now;
    
    let status = '就绪';
    
    if (this.collisionResults) {
      const collisions = this.collisionResults.collisions.filter(c => c.type === 'collision').length;
      const warnings = this.collisionResults.collisions.filter(c => c.type === 'warning').length;
      const boundaries = this.collisionResults.boundaryViolations.length;
      
      if (collisions > 0) {
        status = `检测到 ${collisions} 个碰撞问题`;
      } else if (warnings > 0 || boundaries > 0) {
        status = `检测到 ${warnings} 个距离警告, ${boundaries} 个边界违规`;
      } else {
        status = '场景正常，无碰撞问题';
      }
    }
    
    if (this.sceneManager.isDragging) {
      status = '正在拖拽元素...';
    }
    
    document.getElementById('statusText').textContent = status;
  }

  renderElementList() {
    const listEl = document.getElementById('elementList');
    const elements = this.sceneManager.elements;
    
    const collidingElements = new Set();
    const boundaryElements = new Set();
    
    if (this.collisionResults) {
      this.collisionResults.collisions.forEach(c => {
        collidingElements.add(c.element1);
        collidingElements.add(c.element2);
      });
      this.collisionResults.boundaryViolations.forEach(b => {
        boundaryElements.add(b.element);
      });
    }
    
    listEl.innerHTML = elements.map(el => {
      let classes = ['element-item'];
      if (this.selectedElement && this.selectedElement.id === el.id) {
        classes.push('selected');
      }
      if (collidingElements.has(el.name)) {
        classes.push('colliding');
      }
      if (boundaryElements.has(el.name)) {
        classes.push('boundary');
      }
      
      return `
        <div class="${classes.join(' ')}" data-id="${el.id}">
          <div class="element-name">${el.name}</div>
          <div class="element-type">${this.formatType(el.type)}</div>
        </div>
      `;
    }).join('');
    
    listEl.querySelectorAll('.element-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const element = elements.find(el => el.id === id);
        if (element) {
          this.sceneManager.selectElement(element);
        }
      });
    });
  }

  renderSelectedInfo() {
    const infoEl = document.getElementById('selectedInfo');
    
    if (!this.selectedElement) {
      infoEl.innerHTML = '<p class="hint">点击场景中的元素进行选择</p>';
      return;
    }
    
    const el = this.selectedElement;
    const pos = el.mesh.position;
    
    infoEl.innerHTML = `
      <div class="property-row">
        <span class="property-label">名称</span>
        <span class="property-value">${el.name}</span>
      </div>
      <div class="property-row">
        <span class="property-label">类型</span>
        <span class="property-value">${this.formatType(el.type)}</span>
      </div>
      <div class="property-row">
        <span class="property-label">X 坐标</span>
        <span class="property-value">${pos.x.toFixed(2)} m</span>
      </div>
      <div class="property-row">
        <span class="property-label">Y 坐标</span>
        <span class="property-value">${pos.y.toFixed(2)} m</span>
      </div>
      <div class="property-row">
        <span class="property-label">Z 坐标</span>
        <span class="property-value">${pos.z.toFixed(2)} m</span>
      </div>
      <div class="property-row">
        <span class="property-label">宽度</span>
        <span class="property-value">${el.size.width} m</span>
      </div>
      <div class="property-row">
        <span class="property-label">高度</span>
        <span class="property-value">${el.size.height} m</span>
      </div>
      <div class="property-row">
        <span class="property-label">深度</span>
        <span class="property-value">${el.size.depth} m</span>
      </div>
    `;
  }

  renderCollisionList() {
    const listEl = document.getElementById('collisionList');
    
    if (!this.collisionResults || 
        (this.collisionResults.collisions.length === 0 && 
         this.collisionResults.boundaryViolations.length === 0)) {
      listEl.innerHTML = '<p class="hint">暂无碰撞信息</p>';
      return;
    }
    
    let html = '';
    
    this.collisionResults.collisions.forEach(c => {
      const classes = ['collision-item'];
      if (c.type === 'warning') classes.push('warning');
      
      html += `
        <div class="${classes.join(' ')}">
          <div class="collision-text">${c.message}</div>
        </div>
      `;
    });
    
    this.collisionResults.boundaryViolations.forEach(b => {
      html += `
        <div class="collision-item warning">
          <div class="collision-text"><strong>边界:</strong> ${b.element} - ${b.message}</div>
        </div>
      `;
    });
    
    listEl.innerHTML = html;
  }

  checkCollisions() {
    const elements = this.sceneManager.elements;
    this.collisionResults = this.collisionDetector.checkAllCollisions(elements);
    
    this.renderCollisionList();
    this.renderElementList();
    this.updateHighlights();
  }

  updateHighlights() {
    this.sceneManager.resetHighlights();
    
    if (!this.collisionResults) return;
    
    const showCollision = this.sceneManager.showCollision;
    const showBoundary = this.sceneManager.showBoundary;
    
    if (showCollision) {
      this.collisionResults.collisions.forEach(c => {
        const el1 = this.sceneManager.elements.find(el => el.name === c.element1);
        const el2 = this.sceneManager.elements.find(el => el.name === c.element2);
        
        if (el1) this.sceneManager.setElementHighlight(el1.id, 'collision');
        if (el2) this.sceneManager.setElementHighlight(el2.id, 'collision');
      });
    }
    
    if (showBoundary) {
      this.collisionResults.boundaryViolations.forEach(b => {
        const el = this.sceneManager.elements.find(el => el.name === b.element);
        if (el) {
          const isColliding = this.collisionResults.collisions.some(
            c => c.element1 === b.element || c.element2 === b.element
          );
          if (!isColliding || !showCollision) {
            this.sceneManager.setElementHighlight(el.id, 'boundary');
          }
        }
      });
    }
  }

  saveScene() {
    const sceneData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      stageSize: this.stageSize,
      elements: this.sceneManager.getElementData()
    };
    
    const jsonStr = JSON.stringify(sceneData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `stage-layout-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('方案已保存');
  }

  showLoadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            this.loadScene(data);
            this.showToast('方案已加载');
          } catch (err) {
            this.showToast('加载失败：无效的文件格式', 'error');
          }
        };
        reader.readAsText(file);
      }
    });
    
    input.click();
  }

  loadScene(sceneData) {
    const factory = new ElementFactory();
    
    this.sceneManager.clearElements();
    
    const elements = sceneData.elements.map(elData => 
      factory.createFromData(elData)
    );
    
    this.sceneManager.addElements(elements);
    this.selectedElement = null;
    
    this.renderElementList();
    this.renderSelectedInfo();
    this.checkCollisions();
  }

  resetScene() {
    if (confirm('确定要重置场景吗？所有未保存的更改将丢失。')) {
      location.reload();
    }
  }

  exportReport() {
    const elements = this.sceneManager.getElementData();
    const collisionResults = this.collisionResults;
    const timestamp = new Date();
    
    const reports = this.reportGenerator.generateReport({
      elements,
      collisionResults,
      stageSize: this.stageSize,
      timestamp
    });
    
    const htmlBlob = new Blob([reports.html], { type: 'text/html;charset=utf-8' });
    const csvBlob = new Blob([reports.csv], { type: 'text/csv;charset=utf-8' });
    
    const timestampStr = this.formatFilenameTimestamp(timestamp);
    
    this.downloadBlob(htmlBlob, `collision-report-${timestampStr}.html`);
    
    setTimeout(() => {
      this.downloadBlob(csvBlob, `collision-report-${timestampStr}.csv`);
    }, 500);
    
    this.showToast('报告已导出');
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  formatType(type) {
    const typeMap = {
      'light-rig': '灯架',
      'curtain': '幕布',
      'camera': '摄像机'
    };
    return typeMap[type] || type;
  }

  formatFilenameTimestamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 25px;
      background: ${type === 'error' ? '#dc3545' : '#00a86b'};
      color: white;
      border-radius: 4px;
      z-index: 9999;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(toast);
        document.head.removeChild(style);
      }, 300);
    }, 3000);
  }
}

export default UIHandler;
