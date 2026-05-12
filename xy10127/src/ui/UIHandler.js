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
    
    this.isRecording = false;
    this.recordedFrames = [];
    this.recordStartTime = null;
    this.recordInterval = null;
    
    this.isPlaying = false;
    this.isPaused = false;
    this.playbackFrames = [];
    this.currentPlaybackFrame = 0;
    this.playbackInterval = null;
    
    this.compareData1 = null;
    this.compareData2 = null;
  }

  init(options) {
    this.sceneManager = options.sceneManager;
    this.collisionDetector = options.collisionDetector;
    this.reportGenerator = options.reportGenerator;
    this.stageSize = options.stageSize;
    
    this.setupCallbacks();
    this.bindUIEvents();
    this.renderElementList();
    this.updateObserverSelects();
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
      this.updateObserverSelects();
    };
  }

  bindUIEvents() {
    document.getElementById('saveBtn').addEventListener('click', () => this.saveScene());
    document.getElementById('loadBtn').addEventListener('click', () => this.showLoadDialog());
    document.getElementById('compareBtn').addEventListener('click', () => this.showCompareDialog());
    document.getElementById('screenshotBtn').addEventListener('click', () => this.takeScreenshot());
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
    
    document.getElementById('checkBlockingBtn').addEventListener('click', () => this.checkViewBlocking());
    
    document.getElementById('recordBtn').addEventListener('click', () => this.startRecording());
    document.getElementById('stopRecordBtn').addEventListener('click', () => this.stopRecording());
    document.getElementById('playBtn').addEventListener('click', () => this.playRecording());
    document.getElementById('pauseBtn').addEventListener('click', () => this.pausePlayback());
  }

  updateStatus() {
    const now = Date.now();
    if (now - this.lastUpdateTime < 100) return;
    this.lastUpdateTime = now;
    
    let status = '就绪';
    
    if (this.isRecording) {
      const elapsed = Math.floor((Date.now() - this.recordStartTime) / 1000);
      status = `录制中... ${elapsed}s`;
    } else if (this.isPlaying) {
      status = `回放中... 帧 ${this.currentPlaybackFrame}/${this.playbackFrames.length}`;
    } else if (this.collisionResults) {
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

  updateObserverSelects() {
    const elements = this.sceneManager.elements;
    const cameraSelect = document.getElementById('observerCamera');
    const targetSelect = document.getElementById('observerTarget');
    
    const cameras = elements.filter(el => el.type === 'camera');
    const nonCameras = elements.filter(el => el.type !== 'camera');
    
    cameraSelect.innerHTML = '<option value="">请选择</option>' + 
      cameras.map(el => `<option value="${el.id}">${el.name}</option>`).join('');
    
    targetSelect.innerHTML = '<option value="">请选择</option>' + 
      nonCameras.map(el => `<option value="${el.id}">${el.name}</option>`).join('');
  }

  checkViewBlocking() {
    const cameraId = document.getElementById('observerCamera').value;
    const targetId = document.getElementById('observerTarget').value;
    const resultEl = document.getElementById('blockingResult');
    
    if (!cameraId || !targetId) {
      resultEl.innerHTML = '<p class="hint error">请先选择摄像机和观察目标</p>';
      return;
    }
    
    const elements = this.sceneManager.elements;
    const camera = elements.find(el => el.id === cameraId);
    const target = elements.find(el => el.id === targetId);
    
    if (!camera || !target) {
      resultEl.innerHTML = '<p class="hint error">找不到选择的元素</p>';
      return;
    }
    
    const result = this.collisionDetector.checkViewBlocking(camera, target, elements);
    
    if (result) {
      resultEl.innerHTML = `<p class="error"><strong>检测到遮挡：</strong>${result.message}</p>`;
    } else {
      resultEl.innerHTML = `<p class="success"><strong>视角通畅：</strong>${camera.name} 可以清晰看到 ${target.name}</p>`;
    }
  }

  startRecording() {
    if (this.isRecording) return;
    
    this.isRecording = true;
    this.recordedFrames = [];
    this.recordStartTime = Date.now();
    
    document.getElementById('recordBtn').disabled = true;
    document.getElementById('stopRecordBtn').disabled = false;
    document.getElementById('playBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = true;
    
    this.recordInterval = setInterval(() => {
      const frame = this.captureFrame();
      this.recordedFrames.push(frame);
      
      const elapsed = Math.floor((Date.now() - this.recordStartTime) / 1000);
      document.getElementById('recordDuration').textContent = `${elapsed}s (${this.recordedFrames.length}帧)`;
    }, 100);
    
    this.showToast('开始录制');
  }

  stopRecording() {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    clearInterval(this.recordInterval);
    
    document.getElementById('recordBtn').disabled = false;
    document.getElementById('stopRecordBtn').disabled = true;
    
    if (this.recordedFrames.length > 0) {
      document.getElementById('playBtn').disabled = false;
      this.showToast(`录制完成，共 ${this.recordedFrames.length} 帧`);
    }
  }

  captureFrame() {
    const elements = this.sceneManager.elements.map(el => ({
      id: el.id,
      position: {
        x: el.mesh.position.x,
        y: el.mesh.position.y,
        z: el.mesh.position.z
      }
    }));
    
    return {
      timestamp: Date.now(),
      elements: elements
    };
  }

  playRecording() {
    if (this.recordedFrames.length === 0) return;
    
    if (this.isPaused) {
      this.isPaused = false;
      document.getElementById('pauseBtn').textContent = '暂停';
    } else {
      this.playbackFrames = [...this.recordedFrames];
      this.currentPlaybackFrame = 0;
    }
    
    this.isPlaying = true;
    
    document.getElementById('playBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    
    const playFrame = () => {
      if (!this.isPlaying || this.isPaused) return;
      
      if (this.currentPlaybackFrame >= this.playbackFrames.length) {
        this.stopPlayback();
        return;
      }
      
      const frame = this.playbackFrames[this.currentPlaybackFrame];
      this.applyFrame(frame);
      this.currentPlaybackFrame++;
      
      this.playbackInterval = setTimeout(playFrame, 100);
    };
    
    playFrame();
    this.showToast('开始回放');
  }

  pausePlayback() {
    if (!this.isPlaying) return;
    
    this.isPaused = !this.isPaused;
    
    if (this.isPaused) {
      clearTimeout(this.playbackInterval);
      document.getElementById('pauseBtn').textContent = '继续';
      this.showToast('已暂停');
    } else {
      document.getElementById('pauseBtn').textContent = '暂停';
      this.playRecording();
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    this.isPaused = false;
    clearTimeout(this.playbackInterval);
    
    document.getElementById('playBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = '暂停';
    
    this.showToast('回放完成');
  }

  applyFrame(frame) {
    frame.elements.forEach(frameEl => {
      const sceneEl = this.sceneManager.elements.find(el => el.id === frameEl.id);
      if (sceneEl) {
        sceneEl.mesh.position.set(
          frameEl.position.x,
          frameEl.position.y,
          frameEl.position.z
        );
      }
    });
    
    this.checkCollisions();
  }

  showCompareDialog() {
    this.compareData1 = null;
    this.compareData2 = null;
    this.showCompareModal();
  }

  showCompareModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'compareModal';
    
    const slot1Info = this.compareData1 ? 
      `<span style="color: #00a86b;">已加载 (${this.compareData1.elements.length}个元素)</span>` : 
      '<span style="color: #888;">未加载</span>';
    const slot2Info = this.compareData2 ? 
      `<span style="color: #00a86b;">已加载 (${this.compareData2.elements.length}个元素)</span>` : 
      '<span style="color: #888;">未加载</span>';
    
    const canCompare = this.compareData1 && this.compareData2;
    const diffHtml = canCompare ? this.generateDiffHtml() : '';
    
    modal.innerHTML = `
      <div class="modal">
        <h2>方案对比</h2>
        <div class="compare-container">
          <div class="compare-slot ${this.compareData1 ? 'loaded' : ''}">
            <h4>方案 1</h4>
            <div class="compare-info">${slot1Info}</div>
            <div style="margin-top: 10px;">
              <button id="loadCompare1Btn" class="btn btn-small btn-secondary">从文件加载</button>
              <button id="useCurrent1Btn" class="btn btn-small btn-secondary" style="margin-left: 5px;">使用当前</button>
            </div>
          </div>
          <div class="compare-slot ${this.compareData2 ? 'loaded' : ''}">
            <h4>方案 2</h4>
            <div class="compare-info">${slot2Info}</div>
            <div style="margin-top: 10px;">
              <button id="loadCompare2Btn" class="btn btn-small btn-secondary">从文件加载</button>
              <button id="useCurrent2Btn" class="btn btn-small btn-secondary" style="margin-left: 5px;">使用当前</button>
            </div>
          </div>
        </div>
        ${diffHtml}
        <div class="modal-footer">
          <button id="closeCompareBtn" class="btn btn-secondary">关闭</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('loadCompare1Btn').addEventListener('click', () => 
      this.loadCompareFile(1));
    document.getElementById('loadCompare2Btn').addEventListener('click', () => 
      this.loadCompareFile(2));
    document.getElementById('useCurrent1Btn').addEventListener('click', () => 
      this.useCurrentAsCompare(1));
    document.getElementById('useCurrent2Btn').addEventListener('click', () => 
      this.useCurrentAsCompare(2));
    document.getElementById('closeCompareBtn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

  loadCompareFile(slot) {
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
            if (slot === 1) {
              this.compareData1 = data;
            } else {
              this.compareData2 = data;
            }
            this.showToast(`方案${slot}已加载`);
            document.body.removeChild(document.getElementById('compareModal'));
            this.showCompareModal();
          } catch (err) {
            this.showToast('加载失败：无效的文件格式', 'error');
          }
        };
        reader.readAsText(file);
      }
    });
    
    input.click();
  }

  useCurrentAsCompare(slot) {
    const sceneData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      stageSize: this.stageSize,
      elements: this.sceneManager.getElementData()
    };
    
    if (slot === 1) {
      this.compareData1 = sceneData;
    } else {
      this.compareData2 = sceneData;
    }
    
    this.showToast(`方案${slot}已使用当前场景`);
    document.body.removeChild(document.getElementById('compareModal'));
    this.showCompareModal();
  }

  generateDiffHtml() {
    const elements1 = {};
    const elements2 = {};
    
    this.compareData1.elements.forEach(el => {
      elements1[el.id] = el;
    });
    this.compareData2.elements.forEach(el => {
      elements2[el.id] = el;
    });
    
    const allIds = new Set([
      ...Object.keys(elements1),
      ...Object.keys(elements2)
    ]);
    
    let diffs = [];
    
    allIds.forEach(id => {
      const el1 = elements1[id];
      const el2 = elements2[id];
      
      if (!el1) {
        diffs.push({
          type: 'added',
          name: el2.name,
          message: `新增元素: ${el2.name}`
        });
      } else if (!el2) {
        diffs.push({
          type: 'removed',
          name: el1.name,
          message: `移除元素: ${el1.name}`
        });
      } else {
        const pos1 = el1.position;
        const pos2 = el2.position;
        
        const dx = Math.abs(pos1.x - pos2.x);
        const dy = Math.abs(pos1.y - pos2.y);
        const dz = Math.abs(pos1.z - pos2.z);
        
        if (dx > 0.01 || dy > 0.01 || dz > 0.01) {
          diffs.push({
            type: 'moved',
            name: el1.name,
            pos1,
            pos2
          });
        }
      }
    });
    
    if (diffs.length === 0) {
      return `
        <div class="compare-diff">
          <h4>对比结果</h4>
          <p style="color: #00a86b;">两个方案完全一致</p>
        </div>
      `;
    }
    
    const diffItems = diffs.map(d => {
      if (d.type === 'added') {
        return `<div class="diff-item"><span class="new">+ ${d.message}</span></div>`;
      } else if (d.type === 'removed') {
        return `<div class="diff-item"><span class="old">- ${d.message}</span></div>`;
      } else {
        return `<div class="diff-item">
          <strong>${d.name}:</strong>
          <span class="old">(${d.pos1.x.toFixed(1)}, ${d.pos1.y.toFixed(1)}, ${d.pos1.z.toFixed(1)})</span>
          <span class="arrow">→</span>
          <span class="new">(${d.pos2.x.toFixed(1)}, ${d.pos2.y.toFixed(1)}, ${d.pos2.z.toFixed(1)})</span>
        </div>`;
      }
    }).join('');
    
    return `
      <div class="compare-diff">
        <h4>差异对比 (${diffs.length} 处差异)</h4>
        ${diffItems}
      </div>
    `;
  }

  takeScreenshot() {
    const renderer = this.sceneManager.renderer;
    const scene = this.sceneManager.scene;
    const camera = this.sceneManager.camera;
    
    renderer.render(scene, camera);
    
    const dataURL = renderer.domElement.toDataURL('image/png');
    
    const link = document.createElement('a');
    const timestamp = this.formatFilenameTimestamp(new Date());
    link.download = `screenshot-${timestamp}.png`;
    link.href = dataURL;
    link.click();
    
    this.showToast('截图已保存');
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
    this.updateObserverSelects();
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
        if (document.body.contains(toast)) document.body.removeChild(toast);
        if (document.head.contains(style)) document.head.removeChild(style);
      }, 300);
    }, 3000);
  }
}

export default UIHandler;
