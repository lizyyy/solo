/**
 * 主入口文件
 * 初始化应用并绑定UI事件
 */

import InspectionApp from './app.js';

let app = null;
let currentFilter = 'all';
let selectedDefect = null;

async function initApp() {
  try {
    app = new InspectionApp();
    await app.init('canvas-container');
    
    hideLoading();
    updateUI();
    bindEvents();
    
    console.log('应用初始化成功');
  } catch (error) {
    console.error('应用初始化失败:', error);
    showError(error.message);
  }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }
}

function showError(message) {
  const summaryCard = document.getElementById('summary-card');
  if (summaryCard) {
    summaryCard.innerHTML = `
      <div style="color: #ff6b6b; text-align: center; padding: 20px;">
        <p>❌ 初始化失败</p>
        <p style="font-size: 0.8rem; margin-top: 8px;">${message}</p>
      </div>
    `;
  }
  hideLoading();
}

function updateUI() {
  if (!app) return;
  
  const turbine = app.getTurbineData();
  const analysis = app.getAnalysisResults();
  
  updateTurbineInfo(turbine);
  
  if (analysis) {
    updateSummary(analysis.summary);
    updateIssues(analysis.summary.issues);
    updateDefectsList(analysis.defects);
    updateWindStats(analysis.windSpeed);
  }
}

function updateTurbineInfo(turbine) {
  if (!turbine) return;
  
  const turbineId = document.querySelector('.turbine-id');
  const location = document.querySelector('.location');
  const date = document.querySelector('.date');
  
  if (turbineId) turbineId.textContent = `风机: ${turbine.turbineId}`;
  if (location) location.textContent = `位置: ${turbine.location}`;
  if (date) date.textContent = `日期: ${turbine.inspectionDate}`;
}

function updateSummary(summary) {
  const summaryCard = document.getElementById('summary-card');
  if (!summaryCard || !summary) return;
  
  const score = summary.overallScore;
  let scoreClass = 'score-good';
  if (score < 60) scoreClass = 'score-danger';
  else if (score < 80) scoreClass = 'score-warning';
  
  const metrics = summary.keyMetrics;
  
  summaryCard.innerHTML = `
    <div class="score-display">
      <div class="score-value ${scoreClass}">${score}</div>
      <div class="score-label">综合评分</div>
    </div>
    <div class="metrics-grid">
      <div class="metric-item">
        <div class="metric-value">${metrics.coveragePercentage}%</div>
        <div class="metric-label">覆盖率</div>
      </div>
      <div class="metric-item">
        <div class="metric-value" style="color: #ff6b6b;">${metrics.highDefects}</div>
        <div class="metric-label">高危缺陷</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${metrics.totalDefects}</div>
        <div class="metric-label">总缺陷数</div>
      </div>
      <div class="metric-item">
        <div class="metric-value">${metrics.maxWindSpeed}</div>
        <div class="metric-label">最大风速 m/s</div>
      </div>
    </div>
  `;
}

function updateIssues(issues) {
  const issuesList = document.getElementById('issues-list');
  if (!issuesList) return;
  
  if (!issues || issues.length === 0) {
    issuesList.innerHTML = `
      <div class="issue-item issue-low">
        <div class="issue-title">✅ 无重大问题</div>
        <div class="issue-desc">所有检查项均符合要求</div>
      </div>
    `;
    return;
  }
  
  issuesList.innerHTML = issues.slice(0, 5).map(issue => {
    const severityClass = `issue-${issue.severity}`;
    const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
    
    return `
      <div class="issue-item ${severityClass}">
        <div class="issue-title">${icon} ${issue.description}</div>
        ${issue.details && issue.details.length > 0 ? 
          `<div class="issue-desc">涉及 ${issue.details.length} 项</div>` : ''}
      </div>
    `;
  }).join('');
}

function updateDefectsList(defects) {
  const defectsList = document.getElementById('defects-list');
  if (!defectsList || !defects) return;
  
  let filteredDefects = defects.defects;
  if (currentFilter !== 'all') {
    filteredDefects = filteredDefects.filter(d => 
      d.analysis?.effectiveSeverity === currentFilter
    );
  }
  
  if (filteredDefects.length === 0) {
    defectsList.innerHTML = `
      <div class="loading">没有匹配的缺陷</div>
    `;
    return;
  }
  
  defectsList.innerHTML = filteredDefects.map(defect => {
    const severity = defect.analysis?.effectiveSeverity || defect.severity;
    const isReviewed = defect.reviewStatus === 'reviewed';
    const isActive = selectedDefect?.defectId === defect.defectId;
    const isBoundary = defect.analysis?.isNearBoundary;
    
    return `
      <div class="defect-item ${isActive ? 'active' : ''} ${isReviewed ? 'reviewed' : ''}" 
           data-defect-id="${defect.defectId}">
        <div class="defect-header">
          <span class="defect-id">${defect.defectId}</span>
          <span class="defect-severity severity-${severity}">${getSeverityText(severity)}</span>
        </div>
        <div class="defect-info">
          <div class="defect-location">
            ${defect.bladeId} · ${getPositionText(defect.position)} · ${defect.distanceFromRoot}m
          </div>
          ${isBoundary ? 
            `<div class="defect-boundary">⚠️ 位于段边界附近</div>` : ''}
          ${isReviewed ? 
            `<div style="color: #6bcb77; font-size: 0.7rem;">✓ 已复核</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateDefectDetail(defect) {
  const detailContainer = document.getElementById('defect-detail');
  if (!detailContainer) return;
  
  if (!defect) {
    detailContainer.innerHTML = `
      <div class="empty-state">
        <p>点击列表中的缺陷查看详情</p>
      </div>
    `;
    return;
  }
  
  const severity = defect.analysis?.effectiveSeverity || defect.severity;
  const isReviewed = defect.reviewStatus === 'reviewed';
  
  detailContainer.innerHTML = `
    <div class="detail-group">
      <div class="detail-label">缺陷编号</div>
      <div class="detail-value">${defect.defectId}</div>
    </div>
    <div class="detail-group">
      <div class="detail-label">所属叶片</div>
      <div class="detail-value">${defect.bladeId}</div>
    </div>
    <div class="detail-group">
      <div class="detail-label">位置</div>
      <div class="detail-value">${getPositionText(defect.position)}</div>
    </div>
    <div class="detail-group">
      <div class="detail-label">距离根端</div>
      <div class="detail-value">${defect.distanceFromRoot} m</div>
    </div>
    <div class="detail-group">
      <div class="detail-label">缺陷尺寸</div>
      <div class="detail-value">${defect.size} cm</div>
    </div>
    <div class="detail-group">
      <div class="detail-label">缺陷类型</div>
      <div class="detail-value">${getTypeText(defect.type)}</div>
    </div>
    <div class="detail-group">
      <div class="detail-label">严重等级</div>
      <div class="detail-value">
        <span class="defect-severity severity-${severity}">${getSeverityText(severity)}</span>
      </div>
    </div>
    <div class="detail-group">
      <div class="detail-label">描述</div>
      <div class="detail-value">${defect.description}</div>
    </div>
    ${defect.analysis?.recommendedAction ? `
    <div class="detail-group">
      <div class="detail-label">建议措施</div>
      <div class="detail-value" style="color: #ffd93d;">${defect.analysis.recommendedAction}</div>
    </div>
    ` : ''}
    <div class="detail-group">
      <div class="detail-label">复核状态</div>
      <div class="detail-value">${isReviewed ? '✅ 已复核' : '⏳ 待复核'}</div>
    </div>
    <div class="detail-actions">
      ${!isReviewed ? `
        <button class="btn btn-success btn-small" id="mark-reviewed-btn">
          ✓ 标记已复核
        </button>
      ` : ''}
      <button class="btn btn-secondary btn-small" id="locate-defect-btn">
        🎯 定位视图
      </button>
    </div>
  `;
  
  const markBtn = document.getElementById('mark-reviewed-btn');
  if (markBtn) {
    markBtn.addEventListener('click', () => {
      if (app && app.markDefectAsReviewed(defect.defectId)) {
        updateUI();
      }
    });
  }
  
  const locateBtn = document.getElementById('locate-defect-btn');
  if (locateBtn) {
    locateBtn.addEventListener('click', () => {
      if (app) {
        app.focusOnDefect(defect.defectId);
      }
    });
  }
}

function updateWindStats(windSpeed) {
  const windStats = document.getElementById('wind-stats');
  if (!windStats || !windSpeed) return;
  
  const stats = windSpeed.stats;
  const maxAllowable = 6.0;
  const warningThreshold = 5.0;
  
  windStats.innerHTML = `
    <div class="wind-metric">
      <span class="wind-metric-label">总飞行次数</span>
      <span class="wind-metric-value">${stats.total}</span>
    </div>
    <div class="wind-metric">
      <span class="wind-metric-label">最大风速</span>
      <span class="wind-metric-value ${stats.maxWindSpeed > maxAllowable ? 'exceeded' : 
        stats.maxWindSpeed > warningThreshold ? 'warning' : ''}">
        ${stats.maxWindSpeed.toFixed(1)} m/s
      </span>
    </div>
    <div class="wind-metric">
      <span class="wind-metric-label">平均风速</span>
      <span class="wind-metric-value">${stats.avgWindSpeed.toFixed(1)} m/s</span>
    </div>
    <div class="wind-metric">
      <span class="wind-metric-label">超限次数</span>
      <span class="wind-metric-value ${stats.exceededCount > 0 ? 'exceeded' : ''}">
        ${stats.exceededCount}
      </span>
    </div>
    <div class="wind-metric">
      <span class="wind-metric-label">预警次数</span>
      <span class="wind-metric-value ${stats.warningCount > 0 ? 'warning' : ''}">
        ${stats.warningCount}
      </span>
    </div>
  `;
}

function getSeverityText(severity) {
  const map = {
    high: '高危',
    medium: '中危',
    low: '低危'
  };
  return map[severity] || severity;
}

function getPositionText(position) {
  const map = {
    pressure_side: '压力面',
    suction_side: '吸力面',
    leading_edge: '前缘',
    trailing_edge: '后缘'
  };
  return map[position] || position;
}

function getTypeText(type) {
  const map = {
    crack: '裂纹',
    pitting: '点蚀',
    erosion: '侵蚀',
    scratch: '划痕',
    bonding_issue: '粘接问题',
    delamination: '分层'
  };
  return map[type] || type;
}

function bindEvents() {
  const toggleFlightPath = document.getElementById('toggle-flight-path');
  if (toggleFlightPath) {
    toggleFlightPath.addEventListener('change', (e) => {
      if (app) {
        app.toggleFlightPath(e.target.checked);
      }
    });
  }
  
  const toggleDefects = document.getElementById('toggle-defects');
  if (toggleDefects) {
    toggleDefects.addEventListener('change', (e) => {
      if (app) {
        app.toggleDefects(e.target.checked);
      }
    });
  }
  
  const exportMd = document.getElementById('export-md');
  if (exportMd) {
    exportMd.addEventListener('click', () => {
      if (app) {
        app.downloadReport('markdown');
      }
    });
  }
  
  const exportCsv = document.getElementById('export-csv');
  if (exportCsv) {
    exportCsv.addEventListener('click', () => {
      if (app) {
        app.downloadReport('csv');
      }
    });
  }
  
  const defectsList = document.getElementById('defects-list');
  if (defectsList) {
    defectsList.addEventListener('click', (e) => {
      const defectItem = e.target.closest('.defect-item');
      if (defectItem) {
        const defectId = defectItem.dataset.defectId;
        selectDefect(defectId);
      }
    });
  }
  
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      
      const analysis = app?.getAnalysisResults();
      if (analysis) {
        updateDefectsList(analysis.defects);
      }
    });
  });
}

function selectDefect(defectId) {
  const analysis = app?.getAnalysisResults();
  if (!analysis) return;
  
  selectedDefect = analysis.defects.defects.find(d => d.defectId === defectId);
  updateDefectsList(analysis.defects);
  updateDefectDetail(selectedDefect);
  
  if (app) {
    app.focusOnDefect(defectId);
  }
}

document.addEventListener('DOMContentLoaded', initApp);
