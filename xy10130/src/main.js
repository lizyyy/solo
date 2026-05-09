import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { SensorManager } from './SensorManager.js';
import { InteractionController } from './InteractionController.js';
import { downloadFile, readFileAsText, formatNumber } from './utils.js';
import { DEFAULT_CONFIG } from './config.js';

class App {
  constructor() {
    this.canvas = document.getElementById('scene-canvas');
    this.infoOverlay = document.getElementById('info-overlay');
    this.sensorListEl = document.getElementById('sensor-list');
    
    this.sceneManager = new SceneManager(this.canvas);
    this.sensorManager = new SensorManager(this.sceneManager.scene);
    this.interactionController = new InteractionController(
      this.sceneManager,
      this.sensorManager
    );
    
    this.clock = new THREE.Clock();
    
    this.initUI();
    this.bindEvents();
    this.updateInfo();
    this.addDefaultSensors();
    this.animate();
  }
  
  initUI() {
    document.getElementById('room-width').value = DEFAULT_CONFIG.room.width;
    document.getElementById('room-depth').value = DEFAULT_CONFIG.room.depth;
    document.getElementById('room-height').value = DEFAULT_CONFIG.room.height;
    
    document.getElementById('sensor-radius').value = DEFAULT_CONFIG.sensor.radius;
    document.getElementById('min-distance').value = DEFAULT_CONFIG.sensor.minDistance;
    document.getElementById('max-distance').value = DEFAULT_CONFIG.sensor.maxDistance;
  }
  
  addDefaultSensors() {
    this.sensorManager.addSensor(5, 5);
    this.sensorManager.addSensor(15, 5);
    this.sensorManager.addSensor(10, 10);
    this.sensorManager.addSensor(5, 12);
    this.sensorManager.addSensor(15, 12);
    
    this.updateSensorList();
    this.updateStats();
  }
  
  bindEvents() {
    document.getElementById('btn-add-sensor').addEventListener('click', () => {
      const x = this.sceneManager.roomConfig.width / 2;
      const z = this.sceneManager.roomConfig.depth / 2;
      const sensor = this.interactionController.addSensorAtPosition(x, z);
      this.updateSensorList();
      this.updateStats();
    });
    
    document.getElementById('btn-clear').addEventListener('click', () => {
      if (confirm('确定要清空所有传感器吗？')) {
        this.sensorManager.clearAll();
        this.updateSensorList();
        this.updateStats();
      }
    });
    
    document.getElementById('btn-save').addEventListener('click', () => this.saveProject());
    
    document.getElementById('btn-load').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.loadProject(file);
      e.target.value = '';
    });
    
    document.getElementById('btn-export').addEventListener('click', () => this.exportReport());
    
    document.getElementById('btn-play').addEventListener('click', () => {
      this.sceneManager.playAnimation();
    });
    
    document.getElementById('btn-pause').addEventListener('click', () => {
      this.sceneManager.pauseAnimation();
    });
    
    document.getElementById('btn-reset').addEventListener('click', () => {
      this.sceneManager.resetCamera();
    });
    
    ['room-width', 'room-depth', 'room-height'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.updateRoomConfig());
    });
    
    ['sensor-radius', 'min-distance', 'max-distance'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.updateSensorConfig());
    });
    
    document.getElementById('show-grid').addEventListener('change', (e) => {
      this.sceneManager.setGridVisible(e.target.checked);
    });
    
    document.getElementById('show-heatmap').addEventListener('change', (e) => {
      this.sensorManager.setHeatmapVisible(e.target.checked);
    });
    
    document.getElementById('show-walls').addEventListener('change', (e) => {
      this.sceneManager.setWallsVisible(e.target.checked);
    });
    
    document.getElementById('show-anomalies').addEventListener('change', (e) => {
      this.sensorManager.setAnomaliesVisible(e.target.checked);
    });
    
    this.interactionController.on('sensorAdded', () => {
      this.updateSensorList();
      this.updateStats();
    });
    
    this.interactionController.on('sensorMoved', () => {
      this.updateSensorList();
      this.updateStats();
    });
  }
  
  updateRoomConfig() {
    const config = {
      width: parseFloat(document.getElementById('room-width').value) || DEFAULT_CONFIG.room.width,
      depth: parseFloat(document.getElementById('room-depth').value) || DEFAULT_CONFIG.room.depth,
      height: parseFloat(document.getElementById('room-height').value) || DEFAULT_CONFIG.room.height
    };
    
    this.sceneManager.setRoomConfig(config);
    this.sensorManager.setRoomConfig(config);
    this.updateSensorList();
    this.updateStats();
  }
  
  updateSensorConfig() {
    const config = {
      radius: parseFloat(document.getElementById('sensor-radius').value) || DEFAULT_CONFIG.sensor.radius,
      minDistance: parseFloat(document.getElementById('min-distance').value) || DEFAULT_CONFIG.sensor.minDistance,
      maxDistance: parseFloat(document.getElementById('max-distance').value) || DEFAULT_CONFIG.sensor.maxDistance
    };
    
    this.sensorManager.setSensorConfig(config);
    this.updateSensorList();
    this.updateStats();
  }
  
  updateInfo() {
    this.infoOverlay.innerHTML = `
      <p>操作提示：</p>
      <p class="hint">• 双击地板：添加传感器</p>
      <p class="hint">• 拖拽传感器：调整位置</p>
      <p class="hint">• 鼠标滚轮：缩放</p>
      <p class="hint">• 右键拖动：旋转视角</p>
    `;
  }
  
  updateSensorList() {
    this.sensorListEl.innerHTML = '';
    
    for (const sensor of this.sensorManager.sensors) {
      const hasError = sensor.anomalies.some(a => a.severity === 'error');
      const hasWarning = sensor.anomalies.some(a => a.severity === 'warning');
      
      const div = document.createElement('div');
      div.className = `sensor-item${hasError ? ' error' : hasWarning ? ' warning' : ''}`;
      
      div.innerHTML = `
        <div class="sensor-info">
          <div class="sensor-name">${sensor.name}</div>
          <div class="sensor-coords">
            X: ${formatNumber(sensor.x)} Y: ${formatNumber(sensor.y)} Z: ${formatNumber(sensor.z)}
          </div>
        </div>
        <div class="sensor-actions">
          <button data-action="select" data-id="${sensor.id}">选</button>
          <button class="delete" data-action="delete" data-id="${sensor.id}">删</button>
        </div>
      `;
      
      this.sensorListEl.appendChild(div);
    }
    
    this.sensorListEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const id = e.target.dataset.id;
        
        if (action === 'select') {
          this.sensorManager.setSelectedSensor(id);
          this.updateSensorList();
        } else if (action === 'delete') {
          this.sensorManager.removeSensor(id);
          this.updateSensorList();
          this.updateStats();
        }
      });
    });
  }
  
  updateStats() {
    const stats = this.sensorManager.getStatistics();
    
    document.getElementById('stat-count').textContent = stats.count;
    document.getElementById('stat-coverage').textContent = `${formatNumber(stats.coverage)}%`;
    document.getElementById('stat-dense').textContent = stats.denseCount;
    document.getElementById('stat-gaps').textContent = stats.gapCount;
  }
  
  saveProject() {
    const data = this.sensorManager.toJSON();
    const json = JSON.stringify(data, null, 2);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadFile(json, `sensor-layout-${timestamp}.json`, 'application/json');
  }
  
  async loadProject(file) {
    try {
      const text = await readFileAsText(file);
      const data = JSON.parse(text);
      
      this.sensorManager.fromJSON(data);
      
      if (data.room) {
        this.sceneManager.setRoomConfig(data.room);
        document.getElementById('room-width').value = data.room.width;
        document.getElementById('room-depth').value = data.room.depth;
        document.getElementById('room-height').value = data.room.height;
      }
      
      if (data.sensorConfig) {
        document.getElementById('sensor-radius').value = data.sensorConfig.radius;
        document.getElementById('min-distance').value = data.sensorConfig.minDistance;
        document.getElementById('max-distance').value = data.sensorConfig.maxDistance;
      }
      
      this.updateSensorList();
      this.updateStats();
    } catch (err) {
      alert('加载失败：' + err.message);
    }
  }
  
  exportReport() {
    const reportData = this.sensorManager.getReportData();
    this.showReportModal(reportData);
  }
  
  showReportModal(data) {
    const modalHtml = `
      <div class="modal-overlay" id="report-modal">
        <div class="modal">
          <h2>传感器覆盖分析报告</h2>
          <div class="modal-content">
            ${this.generateReportHtml(data)}
          </div>
          <div class="modal-footer">
            <button class="modal-btn secondary" id="btn-close-report">关闭</button>
            <button class="modal-btn primary" id="btn-download-report">下载报告</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('btn-close-report').addEventListener('click', () => {
      document.getElementById('report-modal').remove();
    });
    
    document.getElementById('btn-download-report').addEventListener('click', () => {
      const html = this.generateFullReportHtml(data);
      downloadFile(html, `sensor-report-${new Date().toISOString().slice(0, 10)}.html`, 'text/html');
    });
  }
  
  generateReportHtml(data) {
    return `
      <div class="report-section">
        <h3>基本信息</h3>
        <table class="report-table">
          <tr><th>生成时间</th><td>${new Date(data.timestamp).toLocaleString('zh-CN')}</td></tr>
          <tr><th>房间尺寸</th><td>${data.room.width}m × ${data.room.depth}m × ${data.room.height}m</td></tr>
          <tr><th>传感器覆盖半径</th><td>${data.sensorConfig.radius}m</td></tr>
          <tr><th>最小间距</th><td>${data.sensorConfig.minDistance}m</td></tr>
          <tr><th>最大间距</th><td>${data.sensorConfig.maxDistance}m</td></tr>
        </table>
      </div>
      
      <div class="report-section">
        <h3>统计信息</h3>
        <table class="report-table">
          <tr><th>传感器总数</th><td>${data.statistics.count}</td></tr>
          <tr><th>覆盖区域</th><td style="color: ${data.statistics.coverage >= 90 ? '#22c55e' : data.statistics.coverage >= 70 ? '#f59e0b' : '#ef4444'}">
            ${formatNumber(data.statistics.coverage)}%
          </td></tr>
          <tr><th>过密区域数</th><td style="color: ${data.statistics.denseCount > 0 ? '#f59e0b' : '#22c55e'}">
            ${data.statistics.denseCount}
          </td></tr>
          <tr><th>漏测区域数</th><td style="color: ${data.statistics.gapCount > 0 ? '#ef4444' : '#22c55e'}">
            ${data.statistics.gapCount}
          </td></tr>
        </table>
      </div>
      
      <div class="report-section">
        <h3>传感器列表</h3>
        <table class="report-table">
          <tr>
            <th>名称</th>
            <th>X坐标</th>
            <th>Y坐标</th>
            <th>Z坐标</th>
            <th>状态</th>
          </tr>
          ${data.sensors.map(s => {
            const hasError = s.anomalies.some(a => a.severity === 'error');
            const hasWarning = s.anomalies.some(a => a.severity === 'warning');
            let status = '正常';
            let color = '#22c55e';
            if (hasError) { status = '异常'; color = '#ef4444'; }
            else if (hasWarning) { status = '警告'; color = '#f59e0b'; }
            return `
              <tr>
                <td>${s.name}</td>
                <td>${formatNumber(s.x)}</td>
                <td>${formatNumber(s.y)}</td>
                <td>${formatNumber(s.z)}</td>
                <td style="color: ${color}">${status}</td>
              </tr>
            `;
          }).join('')}
        </table>
      </div>
      
      ${data.sensors.some(s => s.anomalies.length > 0) ? `
      <div class="report-section">
        <h3>异常详情</h3>
        ${data.sensors.filter(s => s.anomalies.length > 0).map(s => `
          <div style="margin-bottom: 8px; padding: 8px; background: #1a2a3a; border-radius: 4px;">
            <strong>${s.name}</strong>
            <ul style="margin: 4px 0 0 20px; padding: 0;">
              ${s.anomalies.map(a => `
                <li style="color: ${a.severity === 'error' ? '#ef4444' : '#f59e0b'}">
                  ${a.message}
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
      ` : ''}
    `;
  }
  
  generateFullReportHtml(data) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>传感器覆盖分析报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; background: #f8f9fa; color: #333; }
    h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    h3 { color: #555; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; background: white; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .meta { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>传感器覆盖分析报告</h1>
  <p class="meta">生成时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}</p>
  
  <div class="section">
    <h2>1. 配置信息</h2>
    <table>
      <tr><th>房间尺寸</th><td>${data.room.width}m × ${data.room.depth}m × ${data.room.height}m</td></tr>
      <tr><th>传感器覆盖半径</th><td>${data.sensorConfig.radius}m</td></tr>
      <tr><th>最小间距要求</th><td>${data.sensorConfig.minDistance}m</td></tr>
      <tr><th>最大间距要求</th><td>${data.sensorConfig.maxDistance}m</td></tr>
    </table>
  </div>
  
  <div class="section">
    <h2>2. 统计概览</h2>
    <table>
      <tr><th>指标</th><th>值</th><th>状态</th></tr>
      <tr><td>传感器总数</td><td>${data.statistics.count}</td><td>-</td></tr>
      <tr><td>区域覆盖率</td><td>${formatNumber(data.statistics.coverage)}%</td><td>${data.statistics.coverage >= 90 ? '优秀' : data.statistics.coverage >= 70 ? '良好' : '需改进'}</td></tr>
      <tr><td>过密区域数</td><td>${data.statistics.denseCount}</td><td>${data.statistics.denseCount > 0 ? '警告' : '正常'}</td></tr>
      <tr><td>漏测区域数</td><td>${data.statistics.gapCount}</td><td>${data.statistics.gapCount > 0 ? '异常' : '正常'}</td></tr>
    </table>
  </div>
  
  <div class="section">
    <h2>3. 传感器坐标</h2>
    <table>
      <tr><th>序号</th><th>名称</th><th>X (m)</th><th>Y (m)</th><th>Z (m)</th><th>状态</th></tr>
      ${data.sensors.map((s, i) => {
        const hasError = s.anomalies.some(a => a.severity === 'error');
        const hasWarning = s.anomalies.some(a => a.severity === 'warning');
        let status = '正常';
        if (hasError) status = '异常';
        else if (hasWarning) status = '警告';
        return `<tr><td>${i + 1}</td><td>${s.name}</td><td>${formatNumber(s.x)}</td><td>${formatNumber(s.y)}</td><td>${formatNumber(s.z)}</td><td>${status}</td></tr>`;
      }).join('')}
    </table>
  </div>
  
  ${data.sensors.some(s => s.anomalies.length > 0) ? `
  <div class="section">
    <h2>4. 问题详情</h2>
    ${data.sensors.filter(s => s.anomalies.length > 0).map(s => `
      <h3>${s.name}</h3>
      <ul>
        ${s.anomalies.map(a => `<li>${a.severity === 'error' ? '【错误】' : '【警告】'} ${a.message}</li>`).join('')}
      </ul>
    `).join('')}
  </div>
  ` : ''}
  
  <div class="section">
    <h2>5. 建议</h2>
    <ul>
      ${data.statistics.gapCount > 0 ? '<li>建议在漏测区域增加传感器</li>' : ''}
      ${data.statistics.denseCount > 0 ? '<li>建议移走过密区域的冗余传感器</li>' : ''}
      <li>定期检查传感器位置，确保覆盖完整</li>
    </ul>
  </div>
</body>
</html>
    `;
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    
    this.sceneManager.update(deltaTime);
    this.sceneManager.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new App();
});
