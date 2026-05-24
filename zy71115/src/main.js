import { TrailScene } from './scene/TrailScene.js';
import { sampleTrails, weatherConfig } from './data/sampleData.js';
import { drawElevationProfile } from './utils/elevationProfile.js';
import { saveState, loadState, clearState, getDefaultState } from './utils/stateManager.js';
import { generateReport, downloadReportImage, copyReportText } from './utils/reportExport.js';

class TrailGuideApp {
  constructor() {
    this.scene = null;
    this.state = getDefaultState();
    this.trailData = null;
    
    this.init();
  }
  
  init() {
    const canvas = document.getElementById('mainCanvas');
    this.scene = new TrailScene(canvas);
    
    this.loadSavedState();
    this.bindEvents();
    this.startHoverCheck();
  }
  
  loadSavedState() {
    const saved = loadState();
    this.state = { ...this.state, ...saved };
    
    if (this.state.currentTrail && sampleTrails[this.state.currentTrail]) {
      this.loadTrail(this.state.currentTrail, false);
    }
    
    this.updateUI();
  }
  
  bindEvents() {
    document.getElementById('sampleSelect').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadTrail(e.target.value);
      }
    });
    
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetState();
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.showExportModal();
    });
    
    document.querySelectorAll('.weather-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setWeather(btn.dataset.weather);
      });
    });
    
    document.getElementById('filterSupply').addEventListener('change', (e) => {
      this.setFilter('supply', e.target.checked);
    });
    
    document.getElementById('filterRisk').addEventListener('change', (e) => {
      this.setFilter('risk', e.target.checked);
    });
    
    document.getElementById('filterElevation').addEventListener('change', (e) => {
      this.setFilter('elevation', e.target.checked);
    });
    
    document.getElementById('riskLevelFilter').addEventListener('change', (e) => {
      this.setFilter('riskLevel', e.target.value);
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setView(btn.dataset.view);
      });
    });
    
    document.getElementById('timelineSlider').addEventListener('input', (e) => {
      this.setProgress(e.target.value / 100);
    });
    
    document.getElementById('closeModal').addEventListener('click', () => {
      this.hideExportModal();
    });
    
    document.getElementById('downloadReport').addEventListener('click', async () => {
      try {
        const card = document.getElementById('reportCard');
        await downloadReportImage(card, `${this.trailData?.name || 'trail'}-report.png`);
      } catch (e) {
        alert('下载失败，请重试');
        console.error(e);
      }
    });
    
    document.getElementById('copyReport').addEventListener('click', async () => {
      try {
        const report = generateReport(this.trailData, this.state.weather, this.state.progress, this.state.filters);
        if (report) {
          await copyReportText(report);
          alert('报告已复制到剪贴板');
        }
      } catch (e) {
        alert('复制失败，请重试');
        console.error(e);
      }
    });
    
    document.getElementById('exportModal').addEventListener('click', (e) => {
      if (e.target.id === 'exportModal') {
        this.hideExportModal();
      }
    });
    
    window.addEventListener('resize', () => {
      this.updateElevationProfile();
    });
  }
  
  loadTrail(trailId, save = true) {
    const trailData = sampleTrails[trailId];
    if (!trailData) return;
    
    this.trailData = trailData;
    this.state.currentTrail = trailId;
    this.state.progress = 0;
    
    this.scene.loadTrailData(trailData);
    this.scene.setWeather(this.state.weather);
    this.scene.setView(this.state.view);
    this.scene.setFilters(this.state.filters);
    
    this.updateTrailInfo();
    this.updateElevationProfile();
    
    document.getElementById('timelineSlider').value = 0;
    document.getElementById('currentPosition').textContent = '0%';
    
    if (save) {
      this.saveCurrentState();
    }
  }
  
  setWeather(weather) {
    this.state.weather = weather;
    this.scene.setWeather(weather);
    
    const config = weatherConfig[weather];
    document.querySelector('.weather-icon').textContent = config.icon;
    document.querySelector('.weather-title').textContent = config.title;
    document.querySelector('.weather-desc').textContent = config.desc;
    
    document.querySelectorAll('.weather-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.weather === weather);
    });
    
    const isRainy = weather === 'rainy' || weather === 'stormy';
    document.getElementById('weatherAlert').classList.toggle('hidden', !isRainy);
    
    this.saveCurrentState();
  }
  
  setView(view) {
    this.state.view = view;
    this.scene.setView(view);
    
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    this.saveCurrentState();
  }
  
  setFilter(key, value) {
    this.state.filters[key] = value;
    this.scene.setFilters(this.state.filters);
    this.updateElevationProfile();
    this.saveCurrentState();
  }
  
  setProgress(progress) {
    this.state.progress = progress;
    this.scene.setProgress(progress);
    
    document.getElementById('currentPosition').textContent = Math.round(progress * 100) + '%';
    
    if (this.trailData) {
      const maxDist = this.trailData.trailPoints[this.trailData.trailPoints.length - 1].distance;
      const dist = progress * maxDist;
      const point = this.scene.getPointAtDistance(dist);
      
      if (point) {
        document.getElementById('currentPoint').textContent = dist.toFixed(1) + ' km';
        document.getElementById('currentElevation').textContent = Math.round(point.elevation);
      }
    }
    
    this.updateElevationProfile();
    this.saveCurrentState();
  }
  
  updateTrailInfo() {
    if (!this.trailData) return;
    
    const points = this.trailData.trailPoints;
    const elevations = points.map(p => p.elevation);
    
    let totalClimb = 0;
    for (let i = 1; i < points.length; i++) {
      const diff = points[i].elevation - points[i - 1].elevation;
      if (diff > 0) totalClimb += diff;
    }
    
    document.getElementById('totalLength').textContent = points[points.length - 1].distance.toFixed(1);
    document.getElementById('maxElevation').textContent = Math.max(...elevations).toFixed(0);
    document.getElementById('minElevation').textContent = Math.min(...elevations).toFixed(0);
    document.getElementById('totalClimb').textContent = totalClimb.toFixed(0);
    document.getElementById('supplyCount').textContent = this.trailData.supplyStations?.length || 0;
    document.getElementById('riskCount').textContent = this.trailData.riskSegments?.length || 0;
  }
  
  updateElevationProfile() {
    const canvas = document.getElementById('elevationCanvas');
    drawElevationProfile(canvas, this.trailData, this.state.progress, this.state.filters);
  }
  
  updateUI() {
    this.setWeather(this.state.weather);
    this.setView(this.state.view);
    
    document.getElementById('filterSupply').checked = this.state.filters.supply;
    document.getElementById('filterRisk').checked = this.state.filters.risk;
    document.getElementById('filterElevation').checked = this.state.filters.elevation;
    document.getElementById('riskLevelFilter').value = this.state.filters.riskLevel;
    
    document.getElementById('timelineSlider').value = this.state.progress * 100;
    document.getElementById('currentPosition').textContent = Math.round(this.state.progress * 100) + '%';
  }
  
  resetState() {
    clearState();
    this.state = getDefaultState();
    
    this.trailData = null;
    this.scene.clearTrailObjects();
    
    document.getElementById('sampleSelect').value = '';
    document.getElementById('totalLength').textContent = '-';
    document.getElementById('maxElevation').textContent = '-';
    document.getElementById('minElevation').textContent = '-';
    document.getElementById('totalClimb').textContent = '-';
    document.getElementById('supplyCount').textContent = '-';
    document.getElementById('riskCount').textContent = '-';
    document.getElementById('currentPoint').textContent = '-';
    document.getElementById('currentElevation').textContent = '-';
    document.getElementById('timelineSlider').value = 0;
    document.getElementById('currentPosition').textContent = '0%';
    
    this.updateUI();
    
    const canvas = document.getElementById('elevationCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  saveCurrentState() {
    saveState(this.state);
  }
  
  startHoverCheck() {
    const tooltip = document.getElementById('tooltip');
    const canvas = document.getElementById('mainCanvas');
    
    setInterval(() => {
      const hovered = this.scene.checkHover();
      
      if (hovered && hovered.data) {
        tooltip.classList.remove('hidden');
        
        let content = '';
        if (hovered.type === 'supply') {
          content = `
            <h4>🏪 ${hovered.data.name}</h4>
            <p>类型: ${this.getSupplyTypeName(hovered.data.type)}</p>
            <p>距离起点: ${hovered.data.distance} km</p>
            <p>服务: ${hovered.data.services.join('、')}</p>
          `;
        } else if (hovered.type === 'risk') {
          content = `
            <h4>⚠️ ${hovered.data.name}</h4>
            <p>风险等级: ${this.getRiskLevelName(hovered.data.level)}</p>
            <p>${hovered.data.description}</p>
            ${hovered.data.closedInRain ? '<p style="color:#fca5a5">雨天关闭</p>' : ''}
          `;
        } else if (hovered.type === 'elevation') {
          content = `
            <h4>📍 ${hovered.data.label}</h4>
            <p>海拔: ${hovered.data.elevation} m</p>
            <p>距离: ${hovered.data.distance} km</p>
          `;
        }
        
        tooltip.innerHTML = content;
        
        const rect = canvas.getBoundingClientRect();
        tooltip.style.left = (this.scene.mouse.x * 0.5 + 0.5) * rect.width + 15 + 'px';
        tooltip.style.top = (this.scene.mouse.y * -0.5 + 0.5) * rect.height - 15 + 'px';
      } else {
        tooltip.classList.add('hidden');
      }
    }, 100);
  }
  
  getSupplyTypeName(type) {
    const names = { water: '饮水站', full: '综合服务', snack: '补给点', view: '观景点' };
    return names[type] || type;
  }
  
  getRiskLevelName(level) {
    const names = { low: '低风险', medium: '中风险', high: '高风险' };
    return names[level] || level;
  }
  
  showExportModal() {
    if (!this.trailData) {
      alert('请先导入步道数据');
      return;
    }
    
    const report = generateReport(this.trailData, this.state.weather, this.state.progress, this.state.filters);
    if (!report) return;
    
    document.getElementById('reportTrailName').textContent = report.trailName;
    document.getElementById('reportLength').textContent = report.totalLength;
    document.getElementById('reportMaxElev').textContent = report.maxElevation;
    document.getElementById('reportClimb').textContent = report.totalClimb;
    document.getElementById('reportWeather').textContent = report.weather;
    document.getElementById('reportAdvice').textContent = report.advice;
    document.getElementById('reportRisk').textContent = report.riskCount;
    document.getElementById('reportSupply').textContent = report.supplyCount;
    document.getElementById('reportDate').textContent = report.date;
    document.getElementById('reportProgressBar').style.width = report.progress + '%';
    document.getElementById('reportProgressText').textContent = '进度: ' + report.progress + '%';
    
    document.getElementById('exportModal').classList.remove('hidden');
  }
  
  hideExportModal() {
    document.getElementById('exportModal').classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TrailGuideApp();
});
