import { SceneManager } from './scene/SceneManager.js';
import { examples, getExampleConfig } from './examples.js';

class AquariumFlowApp {
  constructor() {
    this.sceneManager = null;
    this.currentConfig = null;
    this.snapshots = [];
    this.isPlaying = false;
    this.currentTime = 0;
    this.playInterval = null;
    this.currentView = 'free';
    
    this.init();
  }

  init() {
    const container = document.getElementById('canvasContainer');
    this.sceneManager = new SceneManager(container);
    
    this.setupEventListeners();
    this.loadExample('normal');
  }

  setupEventListeners() {
    document.getElementById('loadExample').addEventListener('click', () => {
      const exampleId = document.getElementById('exampleSelect').value;
      if (exampleId) {
        this.loadExample(exampleId);
      }
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importConfig(file);
      }
    });

    document.getElementById('snapshotBtn').addEventListener('click', () => {
      this.takeSnapshot();
    });

    document.getElementById('exportReport').addEventListener('click', () => {
      this.exportReport();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetState();
    });

    document.getElementById('playBtn').addEventListener('click', () => {
      this.startPlayback();
    });

    document.getElementById('pauseBtn').addEventListener('click', () => {
      this.pausePlayback();
    });

    document.getElementById('timelineSlider').addEventListener('input', (e) => {
      this.setTimeline(parseFloat(e.target.value));
    });

    document.getElementById('maintenanceMode').addEventListener('change', (e) => {
      this.setMaintenanceMode(e.target.checked);
    });

    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.setView(view);
      });
    });
  }

  loadExample(exampleId) {
    const config = getExampleConfig(exampleId);
    if (config) {
      this.currentConfig = JSON.parse(JSON.stringify(config));
      this.applyConfig(this.currentConfig);
      this.updateStatusPanel();
    }
  }

  applyConfig(config) {
    this.sceneManager.clearAll();

    config.valves.forEach(valve => {
      this.sceneManager.createValve(valve);
    });

    config.displayZones.forEach(zone => {
      this.sceneManager.createDisplayZone(zone);
    });

    if (config.maintenanceZones) {
      config.maintenanceZones.forEach(zone => {
        this.sceneManager.createDisplayZone(zone);
      });
    }

    this.renderValveControls(config.valves);
    
    document.getElementById('maintenanceMode').checked = config.isMaintenance || false;
  }

  renderValveControls(valves) {
    const container = document.getElementById('valveControls');
    container.innerHTML = '';

    valves.forEach(valve => {
      const item = document.createElement('div');
      item.className = 'valve-item';
      item.innerHTML = `
        <div class="valve-header">
          <span class="valve-name">${valve.name}</span>
          <div class="valve-toggle ${valve.active ? 'active' : ''}" data-id="${valve.id}"></div>
        </div>
        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">
          开度: <span class="open-degree">${valve.openDegree}%</span> | 
          流速: <span class="flow-rate">${valve.flowRate.toFixed(2)} m/s</span>
        </div>
        <input type="range" class="slider valve-slider" data-id="${valve.id}" 
               min="0" max="100" value="${valve.openDegree}">
      `;
      container.appendChild(item);
    });

    container.querySelectorAll('.valve-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const valveId = e.target.dataset.id;
        this.toggleValve(valveId);
      });
    });

    container.querySelectorAll('.valve-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const valveId = e.target.dataset.id;
        const openDegree = parseInt(e.target.value);
        this.setValveOpenDegree(valveId, openDegree);
      });
    });
  }

  toggleValve(valveId) {
    const valve = this.currentConfig.valves.find(v => v.id === valveId);
    if (valve) {
      valve.active = !valve.active;
      this.sceneManager.updateValve(valveId, { active: valve.active });
      
      if (valve.active && valve.flowRate === 0) {
        valve.flowRate = 1.0;
        valve.openDegree = 50;
        this.sceneManager.clearParticleSystems();
        this.currentConfig.valves.forEach(v => {
          if (v.active && v.flowRate > 0) {
            this.sceneManager.createParticleSystem(v);
          }
        });
      } else if (!valve.active) {
        this.sceneManager.clearParticleSystems();
        this.currentConfig.valves.forEach(v => {
          if (v.active && v.flowRate > 0) {
            this.sceneManager.createParticleSystem(v);
          }
        });
      }
      
      this.updateValveUI(valveId);
      this.updateStatusPanel();
    }
  }

  setValveOpenDegree(valveId, openDegree) {
    const valve = this.currentConfig.valves.find(v => v.id === valveId);
    if (valve) {
      valve.openDegree = openDegree;
      valve.flowRate = (openDegree / 100) * 3.5;
      
      this.sceneManager.updateValve(valveId, { 
        openDegree: openDegree,
        flowRate: valve.flowRate
      });

      this.sceneManager.clearParticleSystems();
      this.currentConfig.valves.forEach(v => {
        if (v.active && v.flowRate > 0) {
          this.sceneManager.createParticleSystem(v);
        }
      });

      this.updateValveUI(valveId);
      this.updateStatusPanel();
    }
  }

  updateValveUI(valveId) {
    const valve = this.currentConfig.valves.find(v => v.id === valveId);
    if (!valve) return;

    const toggle = document.querySelector(`.valve-toggle[data-id="${valveId}"]`);
    if (toggle) {
      toggle.classList.toggle('active', valve.active);
    }

    const valveItem = toggle?.closest('.valve-item');
    if (valveItem) {
      valveItem.querySelector('.open-degree').textContent = `${valve.openDegree}%`;
      valveItem.querySelector('.flow-rate').textContent = `${valve.flowRate.toFixed(2)} m/s`;
      valveItem.querySelector('.valve-slider').value = valve.openDegree;
    }
  }

  updateStatusPanel() {
    if (!this.currentConfig) return;

    const activeValves = this.currentConfig.valves.filter(v => v.active).length;
    const totalValves = this.currentConfig.valves.length;
    const avgFlowRate = totalValves > 0 
      ? this.currentConfig.valves.reduce((sum, v) => sum + v.flowRate, 0) / totalValves 
      : 0;

    document.getElementById('activeValves').textContent = `${activeValves}/${totalValves}`;
    document.getElementById('avgFlowRate').textContent = `${avgFlowRate.toFixed(2)} m/s`;

    const flowStatusEl = document.getElementById('flowStatus');
    const status = this.detectFlowStatus();
    
    flowStatusEl.textContent = status.text;
    flowStatusEl.className = `value ${status.class}`;
  }

  detectFlowStatus() {
    if (!this.currentConfig) return { text: '未知', class: '' };

    const activeValves = this.currentConfig.valves.filter(v => v.active);
    
    if (activeValves.length === 0) {
      return { text: '系统停止', class: 'danger' };
    }

    const inlets = activeValves.filter(v => v.type === 'inlet');
    const outlets = activeValves.filter(v => v.type === 'outlet');
    
    if (inlets.length > 0 && outlets.length > 0) {
      const totalInFlow = inlets.reduce((sum, v) => sum + v.flowRate, 0);
      const totalOutFlow = outlets.reduce((sum, v) => sum + v.flowRate, 0);
      const flowDiff = Math.abs(totalInFlow - totalOutFlow);
      
      if (flowDiff > 2.0) {
        return { text: '水流冲突', class: 'warning' };
      }
      return { text: '正常运行', class: 'normal' };
    }

    if (inlets.length > 0 && outlets.length === 0) {
      return { text: '只进不出', class: 'warning' };
    }

    if (inlets.length === 0 && outlets.length > 0) {
      return { text: '只出不进', class: 'warning' };
    }

    return { text: '运行中', class: 'normal' };
  }

  setMaintenanceMode(enabled) {
    if (!this.currentConfig) return;
    this.currentConfig.isMaintenance = enabled;

    this.sceneManager.clearZones();
    
    this.currentConfig.displayZones.forEach(zone => {
      this.sceneManager.createDisplayZone(zone);
    });

    if (enabled) {
      this.currentConfig.maintenanceZones = [{
        id: 'maint-auto',
        name: '自动维护区',
        x: 0, y: 0, z: 0,
        width: 10, height: 4, depth: 8,
        type: 'maintenance'
      }];
      
      this.currentConfig.maintenanceZones.forEach(zone => {
        this.sceneManager.createDisplayZone(zone);
      });
    } else {
      this.currentConfig.maintenanceZones = [];
    }

    this.updateStatusPanel();
  }

  setView(view) {
    this.currentView = view;
    this.sceneManager.setView(view);
    
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
  }

  startPlayback() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    this.playInterval = setInterval(() => {
      this.currentTime += 1;
      if (this.currentTime > 100) {
        this.currentTime = 0;
      }
      document.getElementById('timelineSlider').value = this.currentTime;
      this.updateTimeDisplay();
    }, 100);
  }

  pausePlayback() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  setTimeline(value) {
    this.currentTime = value;
    this.updateTimeDisplay();
  }

  updateTimeDisplay() {
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = Math.floor(this.currentTime % 60);
    document.getElementById('currentTime').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  takeSnapshot() {
    const snapshot = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      config: JSON.parse(JSON.stringify(this.currentConfig)),
      sceneSnapshot: this.sceneManager.getSnapshot(),
      currentTime: this.currentTime
    };
    
    this.snapshots.push(snapshot);
    this.renderSnapshotList();
  }

  renderSnapshotList() {
    const container = document.getElementById('snapshotList');
    container.innerHTML = '';

    this.snapshots.forEach((snapshot, index) => {
      const item = document.createElement('div');
      item.className = 'snapshot-item';
      item.innerHTML = `
        <div>
          <div>快照 ${index + 1}</div>
          <div class="snapshot-time">${snapshot.timestamp}</div>
        </div>
        <span class="snapshot-delete" data-id="${snapshot.id}">✕</span>
      `;
      
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('snapshot-delete')) {
          this.restoreSnapshot(snapshot);
        }
      });

      item.querySelector('.snapshot-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSnapshot(snapshot.id);
      });

      container.appendChild(item);
    });
  }

  restoreSnapshot(snapshot) {
    this.currentConfig = JSON.parse(JSON.stringify(snapshot.config));
    this.applyConfig(this.currentConfig);
    this.sceneManager.restoreSnapshot(snapshot.sceneSnapshot);
    this.currentTime = snapshot.currentTime;
    document.getElementById('timelineSlider').value = this.currentTime;
    this.updateTimeDisplay();
    this.updateStatusPanel();
  }

  deleteSnapshot(id) {
    this.snapshots = this.snapshots.filter(s => s.id !== id);
    this.renderSnapshotList();
  }

  resetState() {
    this.pausePlayback();
    this.currentTime = 0;
    document.getElementById('timelineSlider').value = 0;
    this.updateTimeDisplay();
    
    const exampleId = document.getElementById('exampleSelect').value;
    if (exampleId) {
      this.loadExample(exampleId);
    } else {
      this.loadExample('normal');
    }
  }

  importConfig(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        this.currentConfig = config;
        this.applyConfig(config);
        this.updateStatusPanel();
      } catch (err) {
        alert('配置文件格式错误');
      }
    };
    reader.readAsText(file);
  }

  exportReport() {
    if (!this.currentConfig) return;

    const status = this.detectFlowStatus();
    const activeValves = this.currentConfig.valves.filter(v => v.active);

    const report = {
      title: '水族馆水流系统报告',
      generatedAt: new Date().toLocaleString(),
      systemStatus: status.text,
      maintenanceMode: this.currentConfig.isMaintenance || false,
      summary: {
        totalValves: this.currentConfig.valves.length,
        activeValves: activeValves.length,
        averageFlowRate: activeValves.length > 0 
          ? (activeValves.reduce((sum, v) => sum + v.flowRate, 0) / activeValves.length).toFixed(2)
          : '0.00',
        displayZones: this.currentConfig.displayZones.length
      },
      valves: this.currentConfig.valves.map(v => ({
        name: v.name,
        type: v.type,
        active: v.active,
        openDegree: v.openDegree,
        flowRate: v.flowRate.toFixed(2),
        position: `(${v.x}, ${v.y}, ${v.z})`
      })),
      displayZones: this.currentConfig.displayZones.map(z => ({
        name: z.name,
        type: z.type,
        dimensions: `${z.width}x${z.height}x${z.depth}`
      })),
      recommendations: this.generateRecommendations()
    };

    const reportContent = this.formatReport(report);
    this.downloadFile(reportContent, `flow-report-${Date.now()}.html`, 'text/html');
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (!this.currentConfig) return recommendations;

    const activeValves = this.currentConfig.valves.filter(v => v.active);
    const inlets = activeValves.filter(v => v.type === 'inlet');
    const outlets = activeValves.filter(v => v.type === 'outlet');

    if (activeValves.length === 0) {
      recommendations.push('所有阀门处于关闭状态，请检查系统是否正常运行。');
    }

    if (inlets.length === 0 && outlets.length > 0) {
      recommendations.push('缺少活跃的进水阀门，建议开启至少一个进水阀。');
    }

    if (outlets.length === 0 && inlets.length > 0) {
      recommendations.push('缺少活跃的出水阀门，建议开启至少一个出水阀。');
    }

    if (this.currentConfig.isMaintenance) {
      recommendations.push('系统处于维护模式，游客无法正常参观。');
    }

    const totalInFlow = inlets.reduce((sum, v) => sum + v.flowRate, 0);
    const totalOutFlow = outlets.reduce((sum, v) => sum + v.flowRate, 0);
    
    if (Math.abs(totalInFlow - totalOutFlow) > 2.0) {
      recommendations.push('进出水流不平衡，建议调整阀门开度以达到水流平衡。');
    }

    if (recommendations.length === 0) {
      recommendations.push('系统运行正常，各项指标符合要求。');
    }

    return recommendations;
  }

  formatReport(report) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; padding: 40px; color: #333; }
    .report { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { color: #1a3a5c; border-bottom: 3px solid #6bcfff; padding-bottom: 15px; }
    .meta { color: #666; margin-bottom: 30px; font-size: 14px; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; color: white; margin: 10px 0; }
    .status-normal { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .status-warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .status-danger { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    h2 { color: #2a5a8a; margin-top: 30px; border-left: 4px solid #6bcfff; padding-left: 12px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .summary-item { background: #f0f7ff; padding: 15px; border-radius: 8px; }
    .summary-label { color: #666; font-size: 12px; margin-bottom: 5px; }
    .summary-value { font-size: 24px; font-weight: 700; color: #1a3a5c; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #1a3a5c; color: white; }
    tr:hover { background: #f5f7fa; }
    .valve-active { color: #38ef7d; font-weight: 600; }
    .valve-inactive { color: #eb3349; font-weight: 600; }
    .recommendations { background: #fff8e6; border-left: 4px solid #ffd93d; padding: 20px; border-radius: 0 8px 8px 0; }
    .recommendations ul { margin: 10px 0 0 20px; }
    .recommendations li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="report">
    <h1>🌊 ${report.title}</h1>
    <div class="meta">
      生成时间: ${report.generatedAt}<br>
      维护模式: ${report.maintenanceMode ? '开启' : '关闭'}
    </div>
    
    <div>
      <strong>系统状态:</strong>
      <span class="status-badge ${report.systemStatus.includes('正常') ? 'status-normal' : report.systemStatus.includes('冲突') ? 'status-warning' : 'status-danger'}">
        ${report.systemStatus}
      </span>
    </div>

    <h2>📊 系统概览</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">总阀门数</div>
        <div class="summary-value">${report.summary.totalValves}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">活跃阀门</div>
        <div class="summary-value">${report.summary.activeValves}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">平均流速</div>
        <div class="summary-value">${report.summary.averageFlowRate} m/s</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">展示区域</div>
        <div class="summary-value">${report.summary.displayZones}</div>
      </div>
    </div>

    <h2>🔧 阀门详情</h2>
    <table>
      <thead>
        <tr>
          <th>阀门名称</th>
          <th>类型</th>
          <th>状态</th>
          <th>开度</th>
          <th>流速 (m/s)</th>
          <th>位置</th>
        </tr>
      </thead>
      <tbody>
        ${report.valves.map(v => `
          <tr>
            <td>${v.name}</td>
            <td>${v.type === 'inlet' ? '进水' : v.type === 'outlet' ? '出水' : '循环'}</td>
            <td class="${v.active ? 'valve-active' : 'valve-inactive'}">${v.active ? '开启' : '关闭'}</td>
            <td>${v.openDegree}%</td>
            <td>${v.flowRate}</td>
            <td>${v.position}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>🗺️ 展示区域</h2>
    <table>
      <thead>
        <tr>
          <th>区域名称</th>
          <th>类型</th>
          <th>尺寸 (宽×高×深)</th>
        </tr>
      </thead>
      <tbody>
        ${report.displayZones.map(z => `
          <tr>
            <td>${z.name}</td>
            <td>${z.type === 'display' ? '展示区' : z.type}</td>
            <td>${z.dimensions}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>💡 运行建议</h2>
    <div class="recommendations">
      <ul>
        ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  </div>
</body>
</html>`;
  }

  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AquariumFlowApp();
});
