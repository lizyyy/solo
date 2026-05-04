const { ipcRenderer } = require('electron');
const fs = require('fs');

let currentRiskData = null;
let selectedRiskForReview = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTabNavigation();
  initModals();
  initImportHandlers();
  initRouteHandlers();
  initReviewHandlers();
  initRiskHandlers();
  initExportHandlers();
  initWallCanvas();
  
  await loadAllData();
});

function initTabNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabId}-tab`).classList.add('active');

      if (tabId === 'wall') {
        drawWallCanvas();
      }
    });
  });
}

function initModals() {
  const closeButtons = document.querySelectorAll('.modal-close');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').hidden = true;
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.hidden = true;
      }
    });
  });
}

function initImportHandlers() {
  document.getElementById('wallJsonInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const result = await ipcRenderer.invoke('import-json-wall', file.path);
      showImportResult('wallJsonResult', result);
      await loadAllData();
    }
  });

  document.getElementById('routesCsvInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const result = await ipcRenderer.invoke('import-csv-routes', file.path);
      showImportResult('routesCsvResult', result);
      await loadAllData();
    }
  });

  document.getElementById('wearCsvInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const result = await ipcRenderer.invoke('import-wear-records', file.path);
      showImportResult('wearCsvResult', result);
      await loadAllData();
    }
  });

  document.getElementById('feedbackCsvInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const result = await ipcRenderer.invoke('import-feedback', file.path);
      showImportResult('feedbackCsvResult', result);
      await loadAllData();
    }
  });
}

function showImportResult(elementId, result) {
  const el = document.getElementById(elementId);
  el.textContent = result.message;
  el.className = 'import-result ' + (result.success ? 'success' : 'error');
  if (result.errors.length > 0) {
    el.textContent += ' (' + result.errors.length + ' 个错误)';
  }
}

function initRouteHandlers() {
  document.getElementById('addRouteBtn').addEventListener('click', () => {
    openRouteModal();
  });

  document.getElementById('saveRouteBtn').addEventListener('click', async () => {
    await saveRoute();
  });

  document.getElementById('zoneFilter').addEventListener('change', renderRoutesList);
  document.getElementById('difficultyFilter').addEventListener('change', renderRoutesList);
  document.getElementById('childrenOnly').addEventListener('change', renderRoutesList);
}

function initReviewHandlers() {
  document.getElementById('addReviewBtn').addEventListener('click', () => {
    openReviewModal();
  });

  document.getElementById('saveReviewBtn').addEventListener('click', async () => {
    await saveReview();
  });

  document.querySelectorAll('.review-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.review-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderReviewsList(btn.dataset.status);
    });
  });
}

function initRiskHandlers() {
  document.getElementById('detectRisksBtn').addEventListener('click', async () => {
    await loadRisks();
    showNotification('风险检测完成！', 'info');
  });

  document.getElementById('riskTypeFilter').addEventListener('change', renderRisksList);
  document.getElementById('riskSeverityFilter').addEventListener('change', renderRisksList);

  document.getElementById('createReviewFromRiskBtn').addEventListener('click', () => {
    if (selectedRiskForReview) {
      openReviewModal(selectedRiskForReview);
      document.getElementById('riskDetailModal').hidden = true;
    }
  });
}

function initExportHandlers() {
  document.getElementById('exportMarkdownBtn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('export-markdown');
    await saveFileToDisk(result.content, result.filename, 'markdown');
  });

  document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('export-csv-maintenance');
    await saveFileToDisk(result.content, result.filename, 'csv');
  });

  document.getElementById('exportJsonBtn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('export-json-audit');
    await saveFileToDisk(result.content, result.filename, 'json');
  });
}

async function saveFileToDisk(content, filename, type) {
  const filters = [];
  if (type === 'markdown') {
    filters.push({ name: 'Markdown Files', extensions: ['md'] });
  } else if (type === 'csv') {
    filters.push({ name: 'CSV Files', extensions: ['csv'] });
  } else {
    filters.push({ name: 'JSON Files', extensions: ['json'] });
  }

  const result = await ipcRenderer.invoke('show-save-dialog', {
    defaultPath: filename,
    filters
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content);
    showNotification(`文件已保存: ${result.filePath}`, 'success');
  }
}

function initWallCanvas() {
  const canvas = document.getElementById('wallCanvas');
  canvas.width = 800;
  canvas.height = 600;

  document.getElementById('showRoutes').addEventListener('change', drawWallCanvas);
  document.getElementById('showRisks').addEventListener('change', drawWallCanvas);
  document.getElementById('showHolds').addEventListener('change', drawWallCanvas);
}

async function loadAllData() {
  const [zones, routes, holds, feedback, reviews, risks] = await Promise.all([
    ipcRenderer.invoke('get-wall-zones'),
    ipcRenderer.invoke('get-all-routes'),
    ipcRenderer.invoke('get-all-holds'),
    ipcRenderer.invoke('get-feedback'),
    ipcRenderer.invoke('get-reviews'),
    ipcRenderer.invoke('detect-risks')
  ]);

  window.zones = zones;
  window.routes = routes;
  window.holds = holds;
  window.feedback = feedback;
  window.reviews = reviews;
  window.risks = risks;
  currentRiskData = risks;

  updateDashboardStats();
  updateZoneFilters();
  updateDifficultyFilter();
  renderRoutesList();
  renderReviewsList('unresolved');
  renderRisksList();
  renderRecentRisks();
  renderDifficultyChart();
}

async function loadRisks() {
  const risks = await ipcRenderer.invoke('detect-risks');
  window.risks = risks;
  currentRiskData = risks;
  renderRisksList();
  renderRecentRisks();
  updateDashboardStats();
}

function updateDashboardStats() {
  document.getElementById('zoneCount').textContent = window.zones?.length || 0;
  document.getElementById('routeCount').textContent = window.routes?.length || 0;
  document.getElementById('holdCount').textContent = window.holds?.length || 0;
  document.getElementById('feedbackCount').textContent = window.feedback?.length || 0;
  document.getElementById('riskCount').textContent = window.risks?.totalRisks || 0;
  
  const unresolvedReviews = window.reviews?.filter(r => !r.resolved)?.length || 0;
  document.getElementById('reviewCount').textContent = unresolvedReviews;
}

function updateZoneFilters() {
  const zoneFilter = document.getElementById('zoneFilter');
  const routeZone = document.getElementById('routeZone');
  
  zoneFilter.innerHTML = '<option value="">所有区域</option>';
  routeZone.innerHTML = '<option value="">选择区域</option>';

  (window.zones || []).forEach(zone => {
    zoneFilter.innerHTML += `<option value="${zone.code}">${zone.name}</option>`;
    routeZone.innerHTML += `<option value="${zone.code}">${zone.name}</option>`;
  });
}

function updateDifficultyFilter() {
  const filter = document.getElementById('difficultyFilter');
  const difficulties = new Set((window.routes || []).map(r => r.difficulty));
  
  filter.innerHTML = '<option value="">所有难度</option>';
  Array.from(difficulties).sort((a, b) => a - b).forEach(d => {
    filter.innerHTML += `<option value="${d}">难度 ${d}</option>`;
  });
}

function renderRoutesList() {
  const container = document.getElementById('routesList');
  const zoneFilter = document.getElementById('zoneFilter').value;
  const difficultyFilter = document.getElementById('difficultyFilter').value;
  const childrenOnly = document.getElementById('childrenOnly').checked;

  let filteredRoutes = window.routes || [];

  if (zoneFilter) {
    filteredRoutes = filteredRoutes.filter(r => r.zoneCode === zoneFilter);
  }
  if (difficultyFilter) {
    filteredRoutes = filteredRoutes.filter(r => r.difficulty === parseInt(difficultyFilter));
  }
  if (childrenOnly) {
    filteredRoutes = filteredRoutes.filter(r => r.isChildrenRoute);
  }

  if (filteredRoutes.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">暂无线路数据，请先导入或添加线路</div>';
    return;
  }

  container.innerHTML = filteredRoutes.map(route => `
    <div class="route-card ${route.isChildrenRoute ? 'children-route' : ''}">
      <div class="route-header">
        <div>
          <div class="route-name">${route.name}</div>
          <div class="route-code">${route.code}</div>
        </div>
        <div class="route-color" style="background: ${route.color || '#ccc'}"></div>
      </div>
      <div class="route-meta">
        <div class="route-meta-item">
          <span class="route-meta-label">难度</span>
          <span class="route-meta-value">
            <span class="difficulty-badge">${route.difficulty}</span>
            ${route.difficultyLabel ? ` (${route.difficultyLabel})` : ''}
          </span>
        </div>
        <div class="route-meta-item">
          <span class="route-meta-label">区域</span>
          <span class="route-meta-value">${route.zoneCode || '未指定'}</span>
        </div>
        <div class="route-meta-item">
          <span class="route-meta-label">定线日期</span>
          <span class="route-meta-value">${route.setDate || '未知'}</span>
        </div>
        ${route.isChildrenRoute ? `
        <div class="route-meta-item">
          <span class="route-meta-label">类型</span>
          <span class="route-meta-value">👶 儿童线路</span>
        </div>
        ` : ''}
      </div>
      ${route.notes ? `<div style="font-size: 13px; color: var(--text-light);">${route.notes}</div>` : ''}
      <div class="route-actions">
        <button class="btn btn-sm btn-primary" onclick="editRoute(${route.id})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteRoute(${route.id})">删除</button>
      </div>
    </div>
  `).join('');
}

function renderReviewsList(status) {
  const container = document.getElementById('reviewsList');
  let reviews = window.reviews || [];

  if (status === 'unresolved') {
    reviews = reviews.filter(r => !r.resolved);
  } else if (status === 'resolved') {
    reviews = reviews.filter(r => r.resolved);
  }

  if (reviews.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">暂无复核意见</div>';
    return;
  }

  const priorityLabels = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低'
  };

  container.innerHTML = reviews.map(review => `
    <div class="review-item ${review.resolved ? 'resolved' : ''}">
      <div class="review-item-header">
        <span class="review-item-type">${review.reviewType || '复核'}</span>
        <span class="review-item-priority ${review.priority}">${priorityLabels[review.priority] || review.priority}</span>
      </div>
      <div class="review-item-content">
        <div class="review-item-label">发现的问题</div>
        <div class="review-item-text">${review.findings || '无'}</div>
      </div>
      ${review.recommendations ? `
      <div class="review-item-content">
        <div class="review-item-label">建议措施</div>
        <div class="review-item-text">${review.recommendations}</div>
      </div>
      ` : ''}
      <div class="review-item-meta">
        <span>复核人: ${review.reviewer || '未指定'}</span>
        <span>日期: ${review.reviewDate || '未知'}</span>
        ${review.routeCode ? `<span>线路: ${review.routeCode}</span>` : ''}
        ${review.holdCode ? `<span>抓点: ${review.holdCode}</span>` : ''}
      </div>
      <div class="review-item-actions">
        ${!review.resolved ? `
        <button class="btn btn-sm btn-success" onclick="resolveReview(${review.id})">标记已处理</button>
        ` : `<span style="color: var(--success-color);">✓ 已处理</span>`}
      </div>
    </div>
  `).join('');
}

function renderRisksList() {
  const container = document.getElementById('risksList');
  const typeFilter = document.getElementById('riskTypeFilter').value;
  const severityFilter = document.getElementById('riskSeverityFilter').value;
  const risks = currentRiskData?.risks || [];

  if (risks.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--success-color);">🎉 太棒了！未检测到风险</div>';
    document.getElementById('risksSummary').innerHTML = '';
    return;
  }

  let filteredRisks = risks;
  if (typeFilter) {
    filteredRisks = filteredRisks.filter(r => r.type === typeFilter);
  }
  if (severityFilter) {
    filteredRisks = filteredRisks.filter(r => r.severity === severityFilter);
  }

  const severityLabels = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低'
  };

  const typeLabels = {
    difficulty_gap: '难度断层',
    hold_expired: '抓点过期',
    children_conflict: '儿童冲突'
  };

  document.getElementById('risksSummary').innerHTML = `
    <div class="risk-summary-item critical">🔴 ${currentRiskData.bySeverity.critical}</div>
    <div class="risk-summary-item high">🟠 ${currentRiskData.bySeverity.high}</div>
    <div class="risk-summary-item medium">🟡 ${currentRiskData.bySeverity.medium}</div>
    <div class="risk-summary-item low">🟢 ${currentRiskData.bySeverity.low}</div>
  `;

  if (filteredRisks.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">没有匹配的风险项</div>';
    return;
  }

  container.innerHTML = filteredRisks.map((risk, idx) => `
    <div class="risk-item ${risk.severity}" onclick="showRiskDetail(${idx})">
      <div class="risk-item-header">
        <div class="risk-item-title">
          <span class="risk-item-severity ${risk.severity}">${severityLabels[risk.severity]}</span>
          ${risk.title}
        </div>
        <span class="risk-item-type">${typeLabels[risk.type]}</span>
      </div>
      <div class="risk-item-desc">${risk.description}</div>
      <div class="risk-item-location">📍 ${risk.location}</div>
    </div>
  `).join('');
}

function renderRecentRisks() {
  const container = document.getElementById('recentRisks');
  const risks = currentRiskData?.risks || [];

  if (risks.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--success-color);">✅ 暂无风险</div>';
    return;
  }

  const topRisks = risks.slice(0, 5);
  const severityEmojis = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };

  container.innerHTML = topRisks.map(risk => `
    <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px; cursor: pointer;" onclick="document.querySelector('[data-tab=risks]').click()">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${severityEmojis[risk.severity]} ${risk.title}</span>
      </div>
      <div style="font-size: 12px; color: var(--text-light); margin-top: 4px;">${risk.location}</div>
    </div>
  `).join('');
}

function renderDifficultyChart() {
  const container = document.getElementById('difficultyChart');
  const routes = window.routes || [];

  if (routes.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-light);">暂无数据</div>';
    return;
  }

  const difficultyCounts = {};
  routes.forEach(r => {
    difficultyCounts[r.difficulty] = (difficultyCounts[r.difficulty] || 0) + 1;
  });

  const sortedDifficulties = Object.keys(difficultyCounts)
    .map(Number)
    .sort((a, b) => a - b);

  const maxCount = Math.max(...Object.values(difficultyCounts));

  container.innerHTML = `
    <div class="chart-container">
      ${sortedDifficulties.map(d => {
        const count = difficultyCounts[d];
        const width = (count / maxCount) * 100;
        return `
          <div class="chart-bar">
            <span class="chart-label">V${d}</span>
            <div class="chart-bar-fill" style="width: ${width}%"></div>
            <span class="chart-count">${count}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function drawWallCanvas() {
  const canvas = document.getElementById('wallCanvas');
  const ctx = canvas.getContext('2d');
  const zones = window.zones || [];
  const routes = window.routes || [];
  const holds = window.holds || [];
  const risks = currentRiskData?.risks || [];

  const showRoutes = document.getElementById('showRoutes').checked;
  const showRisks = document.getElementById('showRisks').checked;
  const showHolds = document.getElementById('showHolds').checked;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const scaleX = canvas.width / 800;
  const scaleY = canvas.height / 600;

  zones.forEach(zone => {
    const x = zone.x * scaleX;
    const y = zone.y * scaleY;
    const w = zone.width * scaleX;
    const h = zone.height * scaleY;

    const zoneRisks = risks.filter(r => 
      r.type === 'difficulty_gap' && r.location.includes(zone.code)
    );

    let zoneColor = '#E8F5E9';
    let borderColor = '#4CAF50';

    if (showRisks && zoneRisks.length > 0) {
      const hasCritical = zoneRisks.some(r => r.severity === 'critical');
      const hasHigh = zoneRisks.some(r => r.severity === 'high');
      
      if (hasCritical) {
        zoneColor = '#FFEBEE';
        borderColor = '#F44336';
      } else if (hasHigh) {
        zoneColor = '#FFF3E0';
        borderColor = '#FF9800';
      }
    }

    ctx.fillStyle = zoneColor;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(zone.name, x + 10, y + 25);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`难度: ${zone.difficultyRangeMin}-${zone.difficultyRangeMax}`, x + 10, y + 45);
  });

  if (showRoutes) {
    routes.forEach(route => {
      try {
        const positions = route.holdPositions ? JSON.parse(route.holdPositions) : [];
        
        if (positions.length === 0) return;

        ctx.strokeStyle = route.color || '#999';
        ctx.lineWidth = 3;
        ctx.setLineDash(route.isChildrenRoute ? [5, 5] : []);

        ctx.beginPath();
        positions.forEach((pos, idx) => {
          const px = pos.x * scaleX;
          const py = pos.y * scaleY;
          
          if (idx === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        positions.forEach(pos => {
          const px = pos.x * scaleX;
          const py = pos.y * scaleY;

          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fillStyle = route.color || '#999';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        if (positions.length > 0) {
          const firstPos = positions[0];
          const lastPos = positions[positions.length - 1];
          
          ctx.fillStyle = '#4CAF50';
          ctx.beginPath();
          ctx.arc(firstPos.x * scaleX, firstPos.y * scaleY, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', firstPos.x * scaleX, firstPos.y * scaleY);

          ctx.fillStyle = '#F44336';
          ctx.beginPath();
          ctx.arc(lastPos.x * scaleX, lastPos.y * scaleY, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText('E', lastPos.x * scaleX, lastPos.y * scaleY);
          
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
        }
      } catch (e) {
      }
    });
  }

  if (showHolds) {
    holds.forEach(hold => {
      const x = hold.x * scaleX;
      const y = hold.y * scaleY;

      const useRatio = hold.currentUseCount / hold.maxUseCount;
      let holdColor = '#999';
      let radius = 6;

      if (useRatio >= 0.95) {
        holdColor = '#F44336';
        radius = 10;
      } else if (useRatio >= 0.9) {
        holdColor = '#FF9800';
        radius = 9;
      } else if (useRatio >= 0.8) {
        holdColor = '#FFC107';
        radius = 8;
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = holdColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  if (showRisks) {
    const holdRisks = risks.filter(r => r.type === 'hold_expired');
    holdRisks.forEach(risk => {
      const match = risk.location.match(/\(([^)]+)\)/);
      if (match) {
        const holdCode = match[1];
        const hold = holds.find(h => h.code === holdCode);
        if (hold) {
          const x = hold.x * scaleX;
          const y = hold.y * scaleY;

          ctx.strokeStyle = risk.severity === 'critical' ? '#E91E63' : 
                           risk.severity === 'high' ? '#F44336' : '#FF9800';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#F44336';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠', x, y - 25);
          ctx.textAlign = 'start';
        }
      }
    });
  }
}

function openRouteModal(route = null) {
  const modal = document.getElementById('routeModal');
  const title = document.getElementById('routeModalTitle');

  if (route) {
    title.textContent = '编辑线路';
    document.getElementById('routeId').value = route.id;
    document.getElementById('routeName').value = route.name || '';
    document.getElementById('routeCode').value = route.code || '';
    document.getElementById('routeColor').value = route.color || '#FF0000';
    document.getElementById('routeDifficulty').value = route.difficulty || 0;
    document.getElementById('routeDifficultyLabel').value = route.difficultyLabel || '';
    document.getElementById('routeZone').value = route.zoneCode || '';
    document.getElementById('routeSetDate').value = route.setDate || '';
    document.getElementById('routeHoldPositions').value = route.holdPositions || '[]';
    document.getElementById('routeStartPosition').value = route.startPosition || '';
    document.getElementById('routeEndPosition').value = route.endPosition || '';
    document.getElementById('routeIsChildren').checked = route.isChildrenRoute;
    document.getElementById('routeNotes').value = route.notes || '';
  } else {
    title.textContent = '新增线路';
    document.getElementById('routeForm').reset();
    document.getElementById('routeId').value = '';
  }

  modal.hidden = false;
}

async function saveRoute() {
  const id = document.getElementById('routeId').value;
  const route = {
    name: document.getElementById('routeName').value,
    code: document.getElementById('routeCode').value,
    color: document.getElementById('routeColor').value,
    difficulty: parseInt(document.getElementById('routeDifficulty').value) || 0,
    difficultyLabel: document.getElementById('routeDifficultyLabel').value,
    zoneCode: document.getElementById('routeZone').value,
    setDate: document.getElementById('routeSetDate').value,
    holdPositions: document.getElementById('routeHoldPositions').value,
    startPosition: document.getElementById('routeStartPosition').value,
    endPosition: document.getElementById('routeEndPosition').value,
    isChildrenRoute: document.getElementById('routeIsChildren').checked,
    notes: document.getElementById('routeNotes').value
  };

  if (id) {
    route.id = parseInt(id);
  }

  try {
    await ipcRenderer.invoke('save-route', route);
    document.getElementById('routeModal').hidden = true;
    await loadAllData();
    showNotification('线路保存成功！', 'success');
  } catch (err) {
    showNotification('保存失败: ' + err.message, 'error');
  }
}

async function editRoute(id) {
  const route = window.routes.find(r => r.id === id);
  if (route) {
    openRouteModal(route);
  }
}

async function deleteRoute(id) {
  if (confirm('确定要删除这条线路吗？')) {
    try {
      await ipcRenderer.invoke('delete-route', id);
      await loadAllData();
      showNotification('线路已删除', 'success');
    } catch (err) {
      showNotification('删除失败: ' + err.message, 'error');
    }
  }
}

function openReviewModal(risk = null) {
  const modal = document.getElementById('reviewModal');
  const title = document.getElementById('reviewModalTitle');

  document.getElementById('reviewForm').reset();
  document.getElementById('reviewId').value = '';
  title.textContent = '新增复核意见';

  const routeSelect = document.getElementById('reviewRoute');
  routeSelect.innerHTML = '<option value="">选择线路</option>';
  (window.routes || []).forEach(route => {
    routeSelect.innerHTML += `<option value="${route.code}">${route.name} (${route.code})</option>`;
  });

  if (risk) {
    selectedRiskForReview = risk;
    document.getElementById('reviewFindings').value = risk.description + '\n\n受影响项目:\n' + risk.affectedItems.join('\n');
    document.getElementById('reviewRecommendations').value = risk.recommendations.join('\n');
    
    const priorityMap = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low'
    };
    document.getElementById('reviewPriority').value = priorityMap[risk.severity] || 'medium';
  }

  modal.hidden = false;
}

async function saveReview() {
  const id = document.getElementById('reviewId').value;
  const review = {
    reviewer: document.getElementById('reviewReviewer').value,
    reviewType: document.getElementById('reviewType').value,
    routeCode: document.getElementById('reviewRoute').value,
    holdCode: document.getElementById('reviewHold').value,
    priority: document.getElementById('reviewPriority').value,
    findings: document.getElementById('reviewFindings').value,
    recommendations: document.getElementById('reviewRecommendations').value,
    reviewDate: new Date().toISOString().split('T')[0],
    resolved: false
  };

  if (id) {
    review.id = parseInt(id);
  }

  try {
    await ipcRenderer.invoke('save-review', review);
    document.getElementById('reviewModal').hidden = true;
    await loadAllData();
    showNotification('复核意见保存成功！', 'success');
  } catch (err) {
    showNotification('保存失败: ' + err.message, 'error');
  }
}

async function resolveReview(id) {
  const review = window.reviews.find(r => r.id === id);
  if (review) {
    review.resolved = true;
    review.resolvedDate = new Date().toISOString().split('T')[0];
    try {
      await ipcRenderer.invoke('save-review', review);
      await loadAllData();
      showNotification('已标记为已处理', 'success');
    } catch (err) {
      showNotification('操作失败: ' + err.message, 'error');
    }
  }
}

function showRiskDetail(index) {
  const risks = currentRiskData?.risks || [];
  const risk = risks[index];
  if (!risk) return;

  selectedRiskForReview = risk;

  const severityLabels = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低'
  };

  const typeLabels = {
    difficulty_gap: '难度断层',
    hold_expired: '抓点过期',
    children_conflict: '儿童冲突'
  };

  const severityEmojis = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };

  const content = `
    <div style="margin-bottom: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 18px; font-weight: 600;">${severityEmojis[risk.severity]} ${risk.title}</span>
        <span class="risk-item-severity ${risk.severity}">${severityLabels[risk.severity]}</span>
      </div>
      <div style="color: var(--text-light);">
        <span style="margin-right: 16px;">类型: ${typeLabels[risk.type]}</span>
        <span>检测时间: ${new Date(risk.detectedAt).toLocaleString('zh-CN')}</span>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 8px;">描述</div>
      <div style="line-height: 1.6;">${risk.description}</div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 8px;">位置</div>
      <div>📍 ${risk.location}</div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 8px;">受影响项目</div>
      <ul style="margin-left: 20px; line-height: 1.8;">
        ${risk.affectedItems.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>

    <div>
      <div style="font-weight: 600; margin-bottom: 8px;">建议措施</div>
      <ol style="margin-left: 20px; line-height: 1.8;">
        ${risk.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ol>
    </div>
  `;

  document.getElementById('riskDetailTitle').textContent = '风险详情';
  document.getElementById('riskDetailContent').innerHTML = content;
  document.getElementById('riskDetailModal').hidden = false;
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 2000;
    animation: slideIn 0.3s ease;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

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
