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
    this.baseConfig = null;
    this.timelineKeyframes = [];
    
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
      this.baseConfig = JSON.parse(JSON.stringify(config));
      this.currentConfig = JSON.parse(JSON.stringify(config));
      this.generateTimelineKeyframes();
      this.applyConfig(this.currentConfig);
      this.updateStatusPanel();
    }
  }

  generateTimelineKeyframes() {
    if (!this.baseConfig) return;
    
    this.timelineKeyframes = [];
    
    this.baseConfig.valves.forEach((valve, index) => {
      const offset = index * 15;
      
      this.timelineKeyframes.push({
        time: offset,
        valveId: valve.id,
        property: 'active',
        value: true,
        easing: 'step'
      });
      
      this.timelineKeyframes.push({
        time: offset,
        valveId: valve.id,
        property: 'openDegree',
        startValue: 0,
        endValue: valve.openDegree,
        easing: 'linear'
      });
      
      this.timelineKeyframes.push({
        time: 50 + offset,
        valveId: valve.id,
        property: 'openDegree',
        startValue: valve.openDegree,
        endValue: Math.max(20, valve.openDegree - 30),
        easing: 'linear'
      });
      
      this.timelineKeyframes.push({
        time: 80 + offset,
        valveId: valve.id,
        property: 'openDegree',
        startValue: Math.max(20, valve.openDegree - 30),
        endValue: valve.openDegree,
        easing: 'linear'
      });
    });
    
    this.timelineKeyframes.push({
      time: 60,
      property: 'maintenance',
      value: true,
      easing: 'step'
    });
    
    this.timelineKeyframes.push({
      time: 70,
      property: 'maintenance',
      value: false,
      easing: 'step'
    });
    
    this.timelineKeyframes.sort((a, b) => a.time - b.time);
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
    this.pausePlayback();
    
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
    this.pausePlayback();
    
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
    this.pausePlayback();
    this.updateMaintenanceZone(enabled);
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
      this.currentTime += 0.5;
      if (this.currentTime > 100) {
        this.currentTime = 0;
      }
      document.getElementById('timelineSlider').value = this.currentTime;
      this.setTimeline(this.currentTime);
    }, 50);
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
    this.applyTimelineState(value);
  }

  applyTimelineState(time) {
    if (!this.baseConfig) return;

    const state = {
      valves: this.baseConfig.valves.map(v => ({
        ...v,
        active: false,
        openDegree: 0,
        flowRate: 0
      })),
      isMaintenance: false
    };

    this.timelineKeyframes.forEach(keyframe => {
      if (time >= keyframe.time) {
        if (keyframe.valveId) {
          const valve = state.valves.find(v => v.id === keyframe.valveId);
          if (valve) {
            if (keyframe.property === 'active') {
              valve.active = keyframe.value;
            } else if (keyframe.property === 'openDegree') {
              const prevKeyframe = this.findPreviousKeyframe(keyframe.valveId, 'openDegree', keyframe.time);
              const nextKeyframe = this.findNextKeyframe(keyframe.valveId, 'openDegree', keyframe.time);
              
              if (prevKeyframe && nextKeyframe) {
                const segmentDuration = nextKeyframe.time - prevKeyframe.time;
                const progress = segmentDuration > 0 ? (time - prevKeyframe.time) / segmentDuration : 1;
                const clampedProgress = Math.min(Math.max(progress, 0), 1);
                
                valve.openDegree = Math.round(
                  prevKeyframe.endValue + (nextKeyframe.endValue - prevKeyframe.endValue) * clampedProgress
                );
                valve.flowRate = (valve.openDegree / 100) * 3.5;
              } else {
                valve.openDegree = keyframe.endValue || keyframe.startValue || 0;
                valve.flowRate = (valve.openDegree / 100) * 3.5;
              }
            }
          }
        } else if (keyframe.property === 'maintenance') {
          state.isMaintenance = keyframe.value;
        }
      }
    });

    this.currentConfig.valves = state.valves;
    this.currentConfig.isMaintenance = state.isMaintenance;
    
    state.valves.forEach(valve => {
      this.sceneManager.updateValve(valve.id, {
        active: valve.active,
        openDegree: valve.openDegree,
        flowRate: valve.flowRate
      });
      this.updateValveUI(valve.id);
    });

    this.sceneManager.clearParticleSystems();
    state.valves.forEach(valve => {
      if (valve.active && valve.flowRate > 0) {
        this.sceneManager.createParticleSystem(valve);
      }
    });

    this.updateMaintenanceZone(state.isMaintenance);

    this.updateStatusPanel();
  }

  updateMaintenanceZone(enabled) {
    if (!this.currentConfig) return;
    this.currentConfig.isMaintenance = enabled;

    this.sceneManager.clearZones();
    
    this.currentConfig.displayZones.forEach(zone => {
      this.sceneManager.createDisplayZone(zone);
    });

    if (enabled) {
      if (!this.currentConfig.maintenanceZones || this.currentConfig.maintenanceZones.length === 0) {
        this.currentConfig.maintenanceZones = [{
          id: 'maint-auto',
          name: '自动维护区',
          x: 0, y: 0, z: 0,
          width: 10, height: 4, depth: 8,
          type: 'maintenance'
        }];
      }
      
      this.currentConfig.maintenanceZones.forEach(zone => {
        this.sceneManager.createDisplayZone(zone);
      });
    } else {
      this.currentConfig.maintenanceZones = [];
    }

    document.getElementById('maintenanceMode').checked = enabled;
  }

  findPreviousKeyframe(valveId, property, time) {
    return this.timelineKeyframes
      .filter(k => k.valveId === valveId && k.property === property && k.time <= time)
      .sort((a, b) => b.time - a.time)[0];
  }

  findNextKeyframe(valveId, property, time) {
    return this.timelineKeyframes
      .filter(k => k.valveId === valveId && k.property === property && k.time > time)
      .sort((a, b) => a.time - b.time)[0];
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
      currentTime: this.currentTime,
      baseConfig: JSON.parse(JSON.stringify(this.baseConfig)),
      timelineKeyframes: JSON.parse(JSON.stringify(this.timelineKeyframes)),
      name: `快照 ${this.snapshots.length + 1} - 时间点 ${this.currentTime.toFixed(0)}`
    };
    
    this.snapshots.push(snapshot);
    this.snapshots.sort((a, b) => a.currentTime - b.currentTime);
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
          <div style="font-weight: 600; font-size: 13px;">⏱️ ${snapshot.currentTime.toFixed(0)}s</div>
          <div class="snapshot-time">${snapshot.timestamp}</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <span class="snapshot-play" data-id="${snapshot.id}" style="cursor: pointer; color: #38ef7d; padding: 4px 8px;">▶</span>
          <span class="snapshot-delete" data-id="${snapshot.id}">✕</span>
        </div>
      `;
      
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('snapshot-delete') && !e.target.classList.contains('snapshot-play')) {
          this.jumpToSnapshot(snapshot);
        }
      });

      item.querySelector('.snapshot-play').addEventListener('click', (e) => {
        e.stopPropagation();
        this.playFromSnapshot(snapshot);
      });

      item.querySelector('.snapshot-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSnapshot(snapshot.id);
      });

      container.appendChild(item);
    });
  }

  jumpToSnapshot(snapshot) {
    this.pausePlayback();
    
    if (snapshot.baseConfig) {
      this.baseConfig = JSON.parse(JSON.stringify(snapshot.baseConfig));
      this.timelineKeyframes = JSON.parse(JSON.stringify(snapshot.timelineKeyframes));
    }
    
    this.currentConfig = JSON.parse(JSON.stringify(snapshot.config));
    this.applyConfig(this.currentConfig);
    this.sceneManager.restoreSnapshot(snapshot.sceneSnapshot);
    this.currentTime = snapshot.currentTime;
    document.getElementById('timelineSlider').value = this.currentTime;
    this.updateTimeDisplay();
    this.updateStatusPanel();
  }

  playFromSnapshot(snapshot) {
    this.jumpToSnapshot(snapshot);
    this.startPlayback();
  }

  playSnapshotsSequence() {
    if (this.snapshots.length < 2) {
      alert('请至少保存2个快照以进行序列回放');
      return;
    }
    
    this.pausePlayback();
    let currentIndex = 0;
    
    const playNext = () => {
      if (currentIndex >= this.snapshots.length) {
        return;
      }
      
      this.jumpToSnapshot(this.snapshots[currentIndex]);
      currentIndex++;
      
      setTimeout(playNext, 2000);
    };
    
    playNext();
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
    const maintenanceZones = this.currentConfig.maintenanceZones || [];

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
        displayZones: this.currentConfig.displayZones.length,
        maintenanceZones: maintenanceZones.length
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
        dimensions: `${z.width}x${z.height}x${z.depth}`,
        position: `(${z.x}, ${z.y}, ${z.z})`
      })),
      maintenanceZones: maintenanceZones.map(z => ({
        name: z.name,
        type: z.type,
        dimensions: `${z.width}x${z.height}x${z.depth}`,
        position: `(${z.x}, ${z.y}, ${z.z})`
      })),
      timelineInfo: {
        currentTime: this.currentTime,
        isPlaying: this.isPlaying,
        snapshotCount: this.snapshots.length
      },
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
    const maintenanceZonesTable = report.maintenanceZones && report.maintenanceZones.length > 0 ? `
    <h2>🔒 维护隔离区</h2>
    <table>
      <thead>
        <tr>
          <th>区域名称</th>
          <th>类型</th>
          <th>尺寸 (宽×高×深)</th>
          <th>位置</th>
        </tr>
      </thead>
      <tbody>
        ${report.maintenanceZones.map(z => `
          <tr>
            <td>${z.name}</td>
            <td style="color: #6bcfff; font-weight: 600;">维护隔离</td>
            <td>${z.dimensions}</td>
            <td>${z.position}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<p style="color: #666; font-style: italic;">暂无维护隔离区域</p>';

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
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .summary-item { background: #f0f7ff; padding: 15px; border-radius: 8px; }
    .summary-label { color: #666; font-size: 12px; margin-bottom: 5px; }
    .summary-value { font-size: 24px; font-weight: 700; color: #1a3a5c; }
    .summary-item.maintenance { background: #e6f7ff; border: 1px solid #6bcfff; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #1a3a5c; color: white; }
    tr:hover { background: #f5f7fa; }
    .valve-active { color: #38ef7d; font-weight: 600; }
    .valve-inactive { color: #eb3349; font-weight: 600; }
    .timeline-info { background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .timeline-info h3 { margin: 0 0 10px 0; color: #2a5a8a; font-size: 16px; }
    .timeline-info ul { margin: 0; padding-left: 20px; }
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
      <div class="summary-item ${report.maintenanceMode ? 'maintenance' : ''}">
        <div class="summary-label">维护隔离区</div>
        <div class="summary-value">${report.summary.maintenanceZones}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">状态快照</div>
        <div class="summary-value">${report.timelineInfo.snapshotCount}</div>
      </div>
    </div>

    <h2>⏱️ 时间轴信息</h2>
    <div class="timeline-info">
      <h3>复盘状态</h3>
      <ul>
        <li>当前时间点: ${report.timelineInfo.currentTime.toFixed(0)}</li>
        <li>播放状态: ${report.timelineInfo.isPlaying ? '播放中' : '已暂停'}</li>
        <li>已保存快照: ${report.timelineInfo.snapshotCount} 个</li>
      </ul>
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
          <th>位置</th>
        </tr>
      </thead>
      <tbody>
        ${report.displayZones.map(z => `
          <tr>
            <td>${z.name}</td>
            <td>${z.type === 'display' ? '展示区' : z.type}</td>
            <td>${z.dimensions}</td>
            <td>${z.position}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${maintenanceZonesTable}

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
