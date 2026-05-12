import { Renderer } from './renderer.js';
import { ParkingSpot, FireLane, TurningRadius, Obstacle, createFromJSON, resetIdCounter } from './models.js';
import { detectAllAnomalies, pointInRectangle, circleRectangleCollide } from './collision.js';
import { generateReport, downloadReport, savePlan } from './report.js';

class ParkingPlanner {
  constructor() {
    this.canvas = document.getElementById('parking-canvas');
    this.renderer = new Renderer(this.canvas);
    this.objects = [];
    this.selectedId = null;
    this.currentTool = 'select';
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.originalPos = { x: 0, y: 0 };
    this.history = [];
    this.historyIndex = -1;
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.playbackIndex = 0;
    this.snapshots = [];
    this.boundary = null;
    this.defaultBoundary = { minX: -30, maxX: 30, minY: -30, maxY: 30 };

    this.init();
  }

  init() {
    this.renderer.resize();
    this.bindEvents();
    this.animate();
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.render();
    });

    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTool = e.target.dataset.tool;
        this.selectedId = null;
      });
    });

    document.getElementById('spot-width').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && this.selectedId) {
        const obj = this.objects.find(o => o.id === this.selectedId);
        if (obj && obj.type === 'parking') {
          obj.width = val;
          this.saveSnapshot();
          this.render();
        }
      }
    });

    document.getElementById('spot-length').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && this.selectedId) {
        const obj = this.objects.find(o => o.id === this.selectedId);
        if (obj && obj.type === 'parking') {
          obj.length = val;
          this.saveSnapshot();
          this.render();
        }
      }
    });

    document.getElementById('spot-angle').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && this.selectedId) {
        const obj = this.objects.find(o => o.id === this.selectedId);
        if (obj && obj.type === 'parking') {
          obj.angle = val;
          this.saveSnapshot();
          this.render();
        }
      }
    });

    document.getElementById('btn-save').addEventListener('click', () => {
      savePlan(this.objects, this.boundary);
    });

    document.getElementById('btn-load').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            this.loadPlan(data);
          } catch (err) {
            alert('文件解析失败');
          }
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const anomalies = this.detectAnomalies();
      const html = generateReport(this.objects, anomalies, this.boundary);
      downloadReport(html);
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('确定要清空所有内容吗？')) {
        this.objects = [];
        resetIdCounter();
        this.selectedId = null;
        this.history = [];
        this.historyIndex = -1;
        this.boundary = null;
        document.getElementById('boundary-enabled').checked = false;
        this.saveSnapshot();
        this.render();
      }
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      this.startPlayback();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.isPlaying = false;
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      this.isPlaying = false;
      this.playbackIndex = 0;
      if (this.snapshots.length > 0) {
        this.restoreSnapshot(this.snapshots[0]);
      }
    });

    document.getElementById('playback-speed').addEventListener('input', (e) => {
      this.playbackSpeed = parseFloat(e.target.value);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedId) {
          this.objects = this.objects.filter(o => o.id !== this.selectedId);
          this.selectedId = null;
          this.saveSnapshot();
          this.render();
        }
      }
    });

    document.getElementById('boundary-enabled').addEventListener('change', (e) => {
      if (e.target.checked) {
        this.boundary = this.getBoundaryFromInputs();
      } else {
        this.boundary = null;
      }
      this.saveSnapshot();
      this.render();
    });

    const boundaryInputs = ['boundary-min-x', 'boundary-max-x', 'boundary-min-y', 'boundary-max-y'];
    boundaryInputs.forEach(id => {
      document.getElementById(id).addEventListener('input', (e) => {
        const checked = document.getElementById('boundary-enabled').checked;
        if (checked) {
          const newBoundary = this.getBoundaryFromInputs();
          if (newBoundary.minX < newBoundary.maxX && newBoundary.minY < newBoundary.maxY) {
            this.boundary = newBoundary;
            this.saveSnapshot();
            this.render();
          }
        }
      });
    });

    document.getElementById('btn-reset-boundary').addEventListener('click', () => {
      document.getElementById('boundary-min-x').value = this.defaultBoundary.minX;
      document.getElementById('boundary-max-x').value = this.defaultBoundary.maxX;
      document.getElementById('boundary-min-y').value = this.defaultBoundary.minY;
      document.getElementById('boundary-max-y').value = this.defaultBoundary.maxY;
      const checked = document.getElementById('boundary-enabled').checked;
      if (checked) {
        this.boundary = { ...this.defaultBoundary };
        this.saveSnapshot();
        this.render();
      }
    });
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldPos = this.renderer.screenToWorld(sx, sy);

    if (this.currentTool === 'select') {
      const clicked = this.getObjectAt(sx, sy);
      if (clicked) {
        this.selectedId = clicked.id;
        this.isDragging = true;
        this.dragStart = worldPos;
        this.originalPos = { x: clicked.x, y: clicked.y };

        if (clicked.type === 'parking') {
          document.getElementById('spot-width').value = clicked.width;
          document.getElementById('spot-length').value = clicked.length;
          document.getElementById('spot-angle').value = clicked.angle;
        }
      } else {
        this.selectedId = null;
      }
      this.render();
    } else {
      this.addObject(worldPos);
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldPos = this.renderer.screenToWorld(sx, sy);

    document.getElementById('coord-info').textContent = 
      `坐标: (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}) 米`;

    if (this.isDragging && this.selectedId) {
      const obj = this.objects.find(o => o.id === this.selectedId);
      if (obj) {
        const dx = worldPos.x - this.dragStart.x;
        const dy = worldPos.y - this.dragStart.y;
        obj.x = this.originalPos.x + dx;
        obj.y = this.originalPos.y + dy;
        this.render();
      }
    }

    if (this.currentTool !== 'select') {
      this.renderer.render(this.objects, this.selectedId, this.getAnomalousIds(), this.boundary);
      this.renderer.drawPreview(this.currentTool, worldPos, this.getSettings());
    }
  }

  handleMouseUp(e) {
    if (this.isDragging && this.selectedId) {
      this.isDragging = false;
      this.saveSnapshot();
    }
  }

  handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.renderer.scale = Math.max(10, Math.min(200, this.renderer.scale * (1 + delta)));
    document.getElementById('scale-info').textContent = `比例: 1:${Math.round(50 / this.renderer.scale * 50)}`;
    this.render();
  }

  addObject(worldPos) {
    const settings = this.getSettings();
    let obj;

    switch (this.currentTool) {
      case 'parking':
        obj = new ParkingSpot(
          worldPos.x,
          worldPos.y,
          settings.width,
          settings.length,
          settings.angle
        );
        break;
      case 'fireLane':
        obj = new FireLane(worldPos.x, worldPos.y, 4, 10);
        break;
      case 'turningRadius':
        obj = new TurningRadius(worldPos.x, worldPos.y, 6);
        break;
      case 'obstacle':
        obj = new Obstacle(worldPos.x, worldPos.y, 2, 2);
        break;
    }

    if (obj) {
      this.objects.push(obj);
      this.selectedId = obj.id;
      this.saveSnapshot();
      this.render();
    }
  }

  getSettings() {
    return {
      width: parseFloat(document.getElementById('spot-width').value) || 2.5,
      length: parseFloat(document.getElementById('spot-length').value) || 5.0,
      angle: parseFloat(document.getElementById('spot-angle').value) || 0
    };
  }

  getObjectAt(sx, sy) {
    const worldPos = this.renderer.screenToWorld(sx, sy);

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (obj.type === 'turningRadius') {
        const dx = worldPos.x - obj.x;
        const dy = worldPos.y - obj.y;
        if (Math.sqrt(dx * dx + dy * dy) <= obj.radius) {
          return obj;
        }
      } else {
        if (pointInRectangle(worldPos.x, worldPos.y, obj.getBounds())) {
          return obj;
        }
      }
    }
    return null;
  }

  detectAnomalies() {
    return detectAllAnomalies(this.objects, this.boundary);
  }

  getBoundaryFromInputs() {
    return {
      minX: parseFloat(document.getElementById('boundary-min-x').value) || this.defaultBoundary.minX,
      maxX: parseFloat(document.getElementById('boundary-max-x').value) || this.defaultBoundary.maxX,
      minY: parseFloat(document.getElementById('boundary-min-y').value) || this.defaultBoundary.minY,
      maxY: parseFloat(document.getElementById('boundary-max-y').value) || this.defaultBoundary.maxY
    };
  }

  getAnomalousIds() {
    const anomalies = this.detectAnomalies();
    const ids = new Set();
    for (const a of anomalies) {
      if (a.objectA) ids.add(a.objectA.id);
      if (a.objectB) ids.add(a.objectB.id);
      if (a.object) ids.add(a.object.id);
    }
    return ids;
  }

  updateStats() {
    const spots = this.objects.filter(o => o.type === 'parking').length;
    const fireLanes = this.objects.filter(o => o.type === 'fireLane').length;
    const turning = this.objects.filter(o => o.type === 'turningRadius').length;
    const anomalies = this.detectAnomalies().length;

    document.getElementById('stat-spots').textContent = spots;
    document.getElementById('stat-fire-lanes').textContent = fireLanes;
    document.getElementById('stat-turning').textContent = turning;
    document.getElementById('stat-anomalies').textContent = anomalies;

    this.updateAnomalyList();
  }

  updateAnomalyList() {
    const anomalies = this.detectAnomalies();
    const list = document.getElementById('anomaly-list');

    if (anomalies.length === 0) {
      list.innerHTML = '<p class="no-anomalies">暂无异常</p>';
      return;
    }

    let html = '';
    for (const a of anomalies) {
      let type = 'error';
      let typeLabel = '';
      switch (a.type) {
        case 'collision':
          typeLabel = '对象重叠';
          break;
        case 'fireLane':
          typeLabel = '消防通道占用';
          break;
        case 'turningRadius':
          typeLabel = '转弯区域侵入';
          type = 'warning';
          break;
        case 'boundary':
          typeLabel = '超出边界';
          break;
      }

      html += `
        <div class="anomaly-item ${type}">
          <h4>${typeLabel}</h4>
          <p>${a.message}</p>
        </div>
      `;
    }
    list.innerHTML = html;
  }

  saveSnapshot() {
    this.snapshots.push({
      objects: this.objects.map(o => o.toJSON()),
      boundary: this.boundary ? { ...this.boundary } : null
    });
    this.playbackIndex = this.snapshots.length - 1;
  }

  restoreSnapshot(data) {
    resetIdCounter();
    this.objects = data.objects.map(d => createFromJSON(d));
    this.selectedId = null;

    this.boundary = data.boundary ? { ...data.boundary } : null;
    if (this.boundary) {
      document.getElementById('boundary-enabled').checked = true;
      document.getElementById('boundary-min-x').value = this.boundary.minX;
      document.getElementById('boundary-max-x').value = this.boundary.maxX;
      document.getElementById('boundary-min-y').value = this.boundary.minY;
      document.getElementById('boundary-max-y').value = this.boundary.maxY;
    } else {
      document.getElementById('boundary-enabled').checked = false;
    }

    this.render();
  }

  startPlayback() {
    if (this.snapshots.length < 2) {
      alert('需要至少两个状态才能回放');
      return;
    }
    this.isPlaying = true;
    this.playbackIndex = 0;
    this.playbackLoop();
  }

  playbackLoop() {
    if (!this.isPlaying) return;
    if (this.playbackIndex >= this.snapshots.length) {
      this.isPlaying = false;
      return;
    }
    this.restoreSnapshot(this.snapshots[this.playbackIndex]);
    this.playbackIndex++;
    setTimeout(() => this.playbackLoop(), 1000 / this.playbackSpeed);
  }

  loadPlan(data) {
    resetIdCounter();
    this.objects = data.objects.map(d => createFromJSON(d)).filter(Boolean);
    this.selectedId = null;
    this.boundary = data.boundary || null;

    if (this.boundary) {
      document.getElementById('boundary-enabled').checked = true;
      document.getElementById('boundary-min-x').value = this.boundary.minX;
      document.getElementById('boundary-max-x').value = this.boundary.maxX;
      document.getElementById('boundary-min-y').value = this.boundary.minY;
      document.getElementById('boundary-max-y').value = this.boundary.maxY;
    } else {
      document.getElementById('boundary-enabled').checked = false;
    }

    this.snapshots = [];
    this.saveSnapshot();
    this.render();
  }

  render() {
    this.renderer.render(this.objects, this.selectedId, this.getAnomalousIds(), this.boundary);
    this.updateStats();
  }

  animate() {
    this.render();
    requestAnimationFrame(() => this.animate());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ParkingPlanner();
});
