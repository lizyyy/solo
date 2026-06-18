const API_BASE = '/api';

const state = {
  records: [],
  boundarySamples: [],
  verbalNotes: [],
  versions: [],
  summary: null,
  filters: {
    stationId: '',
    status: '',
    hasOutlier: ''
  },
  currentTab: 'records'
};

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initButtons();
  loadAllData();
});

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
  state.currentTab = tabName;
  
  if (tabName === 'map') {
    renderMap();
  }
}

function initButtons() {
  document.getElementById('btnImportLab').addEventListener('click', () => showImportModal('lab'));
  document.getElementById('btnImportBoundary').addEventListener('click', () => showImportModal('boundary'));
  document.getElementById('btnImportVerbal').addEventListener('click', () => showImportModal('verbal'));
  document.getElementById('btnRerun').addEventListener('click', handleRerun);
  document.getElementById('btnExport').addEventListener('click', handleExport);
  
  document.getElementById('btnApplyFilter').addEventListener('click', applyFilters);
  document.getElementById('btnResetFilter').addEventListener('click', resetFilters);
  
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}

async function loadAllData() {
  try {
    await Promise.all([
      loadSummary(),
      loadVersions()
    ]);
    await loadRecords();
  } catch (err) {
    console.error('加载数据失败:', err);
  }
}

async function loadSummary() {
  const res = await fetch(`${API_BASE}/summary`);
  const data = await res.json();
  state.summary = data;
  renderStats();
  updateHeaderInfo();
}

async function loadRecords() {
  const params = new URLSearchParams();
  if (state.filters.stationId) params.set('stationId', state.filters.stationId);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.hasOutlier !== '') params.set('hasOutlier', state.filters.hasOutlier);
  
  const res = await fetch(`${API_BASE}/records?${params.toString()}`);
  const data = await res.json();
  state.records = data.records;
  renderRecords();
  loadPendingConfirmations();
  loadOutliers();
  loadBoundarySamples();
  loadVerbalNotes();
}

async function loadVersions() {
  const res = await fetch(`${API_BASE}/versions`);
  const data = await res.json();
  state.versions = data.versions;
  renderVersions();
  updateHeaderInfo();
}

async function loadPendingConfirmations() {
  const res = await fetch(`${API_BASE}/pending-confirmations`);
  const data = await res.json();
  renderPendingList(data.records);
  document.getElementById('pendingCount').textContent = `共 ${data.total} 条`;
}

async function loadOutliers() {
  const res = await fetch(`${API_BASE}/outliers`);
  const data = await res.json();
  renderOutlierList(data.records);
  document.getElementById('outlierCount').textContent = `共 ${data.total} 条`;
}

async function loadBoundarySamples() {
  const res = await fetch(`${API_BASE}/boundary-samples`);
  const data = await res.json();
  state.boundarySamples = data.samples;
  renderBoundaryList(data.samples);
  document.getElementById('boundaryCount').textContent = `共 ${data.total} 条`;
}

async function loadVerbalNotes() {
  const res = await fetch(`${API_BASE}/verbal-notes`);
  const data = await res.json();
  state.verbalNotes = data.notes;
  renderNoteList(data.notes);
  document.getElementById('noteCount').textContent = `共 ${data.total} 条`;
}

function renderStats() {
  if (!state.summary) return;
  document.getElementById('statTotal').textContent = state.summary.totalRecords;
  document.getElementById('statStations').textContent = state.summary.totalStations;
  document.getElementById('statOutliers').textContent = state.summary.totalOutliers;
  document.getElementById('statPending').textContent = state.summary.totalPending;
}

function updateHeaderInfo() {
  document.getElementById('versionCount').textContent = `版本: ${state.versions.length}`;
  if (state.summary?.latestVersion) {
    const ts = new Date(state.summary.latestVersion.timestamp);
    document.getElementById('latestVersion').textContent = 
      `最新: ${ts.toLocaleString('zh-CN')}`;
  } else {
    document.getElementById('latestVersion').textContent = '最新版本: 无';
  }
}

function renderRecords() {
  const tbody = document.getElementById('recordsBody');
  document.getElementById('recordCount').textContent = `共 ${state.records.length} 条记录`;
  
  if (state.records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-cell">暂无数据，请导入实验室结果表</td></tr>';
    return;
  }
  
  tbody.innerHTML = state.records.map(r => {
    let rowClass = '';
    if (r.status === 'pending') rowClass = 'pending-row';
    else if (r.isOutlier) rowClass = 'outlier-row';
    
    const statusBadge = r.status === 'pending' 
      ? '<span class="status-badge status-pending">待确认</span>'
      : '<span class="status-badge status-normal">正常</span>';
    
    const outlierBadge = r.isOutlier ? '<span class="outlier-badge">离群</span>' : '';
    
    const tideDisplay = r.tideLevel != null 
      ? `${r.tideLevel} ${r.tideUnit || ''}`.trim()
      : '-';
    
    return `
      <tr class="${rowClass}" data-id="${r.id}">
        <td><strong>${r.stationId || '-'}</strong>${outlierBadge}</td>
        <td>${r.sampleTime || '-'}</td>
        <td>${r.temperature != null ? r.temperature : '-'}</td>
        <td>${r.salinity != null ? r.salinity : '-'}</td>
        <td>${r.dissolvedOxygen != null ? r.dissolvedOxygen : '-'}</td>
        <td>${r.pH != null ? r.pH : '-'}</td>
        <td>${r.chlorophyll != null ? r.chlorophyll : '-'}</td>
        <td>${r.turbidity != null ? r.turbidity : '-'}</td>
        <td>${tideDisplay}</td>
        <td>${statusBadge}</td>
        <td>${r.source || '-'}</td>
      </tr>
    `;
  }).join('');
}

function renderVersions() {
  const list = document.getElementById('versionList');
  
  if (state.versions.length === 0) {
    list.innerHTML = '<p class="empty-text">暂无版本</p>';
    return;
  }
  
  const latestId = state.summary?.latestVersion?.id;
  
  list.innerHTML = state.versions.slice().reverse().map((v, idx) => {
    const isLatest = v.id === latestId;
    const ts = new Date(v.timestamp);
    const changeText = getChangeText(v.changes);
    
    return `
      <div class="version-item ${isLatest ? 'latest' : ''}" data-id="${v.id}">
        <div class="version-title">
          ${isLatest ? '✅ ' : ''}${v.source || '未知来源'}
        </div>
        <div class="version-meta">${ts.toLocaleString('zh-CN')}</div>
        <div class="version-change">${changeText}</div>
        ${v.note ? `<div class="version-meta" style="margin-top:4px;color:#1565c0;">📝 ${v.note}</div>` : ''}
      </div>
    `;
  }).join('');
  
  list.querySelectorAll('.version-item').forEach(item => {
    item.addEventListener('click', () => {
      const versionId = item.dataset.id;
      showVersionDetail(versionId);
    });
  });
}

function getChangeText(changes) {
  if (!changes) return '';
  if (changes.type === 'initial') return '🎉 初始导入';
  let text = '';
  if (changes.addedCount > 0) text += `+${changes.addedCount}新增 `;
  if (changes.removedCount > 0) text += `-${changes.removedCount}删除 `;
  if (changes.modifiedCount > 0) text += `${changes.modifiedCount}修改`;
  return text.trim() || '无变化';
}

function renderPendingList(records) {
  const list = document.getElementById('pendingList');
  
  if (records.length === 0) {
    list.innerHTML = '<p class="empty-text">暂无待确认记录</p>';
    return;
  }
  
  list.innerHTML = records.map(r => `
    <div class="pending-item">
      <div class="item-header">
        <div class="item-title">${r.stationId || '未知站点'}</div>
        <div class="item-meta">${r.sampleTime || '-'}</div>
      </div>
      <div class="item-reasons">
        ${r.pendingReasons.map(reason => `
          <div class="item-reason">
            ⚠️ ${reason.reason}
            ${reason.detail ? `<br><small>潮位: ${reason.detail.tideLevel} ${reason.detail.tideUnit || ''}</small>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderOutlierList(records) {
  const list = document.getElementById('outlierList');
  
  if (records.length === 0) {
    list.innerHTML = '<p class="empty-text">暂无离群值</p>';
    return;
  }
  
  list.innerHTML = records.map(r => {
    const fields = r.outlierInfo.map(o => 
      `<span class="outlier-field-tag" title="Z值: ${o.zScore}">${getFieldName(o.field)}: ${o.value}</span>`
    ).join('');
    
    return `
      <div class="outlier-item">
        <div class="item-header">
          <div class="item-title">${r.stationId || '未知站点'}</div>
          <div class="item-meta">${r.sampleTime || '-'}</div>
        </div>
        <div class="item-meta" style="margin-top:6px;color:#e65100;">
          🔔 疑似离群值（类噪声），保留但标记，不直接删除
        </div>
        <div class="outlier-fields">${fields}</div>
      </div>
    `;
  }).join('');
}

function renderBoundaryList(samples) {
  const list = document.getElementById('boundaryList');
  
  if (samples.length === 0) {
    list.innerHTML = '<p class="empty-text">暂无边界样本</p>';
    return;
  }
  
  list.innerHTML = samples.map(s => `
    <div class="boundary-item">
      <div class="item-header">
        <div class="item-title">${s.sampleId || s.stationId || '边界样本'}</div>
        <div class="item-meta">${s.sampleTime || '-'}</div>
      </div>
      <div class="item-meta">
        位置: ${s.longitude != null ? s.longitude : '?'}, ${s.latitude != null ? s.latitude : '?'}
      </div>
      ${s.description ? `<div style="margin-top:8px;">${s.description}</div>` : ''}
      ${s.note ? `<div style="margin-top:6px;color:#9c27b0;">📝 ${s.note}</div>` : ''}
    </div>
  `).join('');
}

function renderNoteList(notes) {
  const list = document.getElementById('noteList');
  
  if (notes.length === 0) {
    list.innerHTML = '<p class="empty-text">暂无口头说明</p>';
    return;
  }
  
  list.innerHTML = notes.map(n => `
    <div class="note-item">
      <div class="item-header">
        <div class="item-title">${n.reporter || '未知报告人'}</div>
        <div class="item-meta">${new Date(n.timestamp).toLocaleString('zh-CN')}</div>
      </div>
      <div style="margin-top:8px;line-height:1.6;">${n.content}</div>
    </div>
  `).join('');
}

function renderMap() {
  const container = document.getElementById('mapContainer');
  
  if (!state.summary || state.summary.totalStations === 0) {
    container.innerHTML = '<div class="map-placeholder"><p>暂无站点数据</p></div>';
    return;
  }
  
  const stations = state.summary.stationStats;
  
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  for (const s of stations) {
    if (s.longitude != null) {
      minLng = Math.min(minLng, s.longitude);
      maxLng = Math.max(maxLng, s.longitude);
    }
    if (s.latitude != null) {
      minLat = Math.min(minLat, s.latitude);
      maxLat = Math.max(maxLat, s.latitude);
    }
  }
  
  const boundarySamples = state.boundarySamples || [];
  for (const b of boundarySamples) {
    if (b.longitude != null) {
      minLng = Math.min(minLng, b.longitude);
      maxLng = Math.max(maxLng, b.longitude);
    }
    if (b.latitude != null) {
      minLat = Math.min(minLat, b.latitude);
      maxLat = Math.max(maxLat, b.latitude);
    }
  }
  
  if (!isFinite(minLng)) {
    minLng = 120; maxLng = 125;
    minLat = 30; maxLat = 40;
  }
  
  const padding = 0.1;
  const lngRange = maxLng - minLng || 1;
  const latRange = maxLat - minLat || 1;
  minLng -= lngRange * padding;
  maxLng += lngRange * padding;
  minLat -= latRange * padding;
  maxLat += latRange * padding;
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;
  
  function lngToX(lng) {
    return ((lng - minLng) / (maxLng - minLng)) * width;
  }
  
  function latToY(lat) {
    return height - ((lat - minLat) / (maxLat - minLat)) * height;
  }
  
  let html = '<div class="map-canvas">';
  
  html += `<svg width="${width}" height="${height}" style="position:absolute;top:0;left:0;pointer-events:none;">
    ${generateGridLines(minLng, maxLng, minLat, maxLat, width, height)}
  </svg>`;
  
  for (const s of stations) {
    if (s.longitude == null || s.latitude == null) continue;
    const x = lngToX(s.longitude);
    const y = latToY(s.latitude);
    
    let stationClass = 'map-station';
    if (s.pending > 0) stationClass += ' has-pending';
    else if (s.outliers > 0) stationClass += ' has-outlier';
    
    html += `
      <div class="${stationClass}" 
           style="left:${x}px;top:${y}px;"
           data-station="${s.stationId}"
           title="${s.stationId} (${s.stationName || ''})">
      </div>
    `;
  }
  
  for (const b of boundarySamples) {
    if (b.longitude == null || b.latitude == null) continue;
    const x = lngToX(b.longitude);
    const y = latToY(b.latitude);
    
    html += `
      <div class="map-station boundary" 
           style="left:${x}px;top:${y}px;"
           data-sample="${b.sampleId}"
           title="边界样本: ${b.sampleId || b.stationId}">
      </div>
    `;
  }
  
  html += `
    <div class="map-legend">
      <div class="legend-item">
        <div class="legend-dot" style="background:#4caf50;"></div>
        <span>正常站点</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#ff9800;"></div>
        <span>有离群值</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#f44336;"></div>
        <span>待确认</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#9c27b0;"></div>
        <span>边界样本</span>
      </div>
    </div>
  `;
  
  html += '</div>';
  container.innerHTML = html;
}

function generateGridLines(minLng, maxLng, minLat, maxLat, width, height) {
  let lines = '';
  const numLines = 5;
  
  for (let i = 0; i <= numLines; i++) {
    const x = (i / numLines) * width;
    const lng = minLng + (i / numLines) * (maxLng - minLng);
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#b3e5fc" stroke-width="1"/>`;
    lines += `<text x="${x + 4}" y="16" fill="#0277bd" font-size="10">${lng.toFixed(2)}°E</text>`;
  }
  
  for (let i = 0; i <= numLines; i++) {
    const y = (i / numLines) * height;
    const lat = maxLat - (i / numLines) * (maxLat - minLat);
    lines += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#b3e5fc" stroke-width="1"/>`;
    lines += `<text x="4" y="${y - 4}" fill="#0277bd" font-size="10">${lat.toFixed(2)}°N</text>`;
  }
  
  return lines;
}

function getFieldName(field) {
  const names = {
    temperature: '水温',
    salinity: '盐度',
    dissolvedOxygen: '溶解氧',
    pH: 'pH',
    chlorophyll: '叶绿素',
    turbidity: '浊度'
  };
  return names[field] || field;
}

function applyFilters() {
  state.filters.stationId = document.getElementById('filterStation').value;
  state.filters.status = document.getElementById('filterStatus').value;
  
  const outlierVal = document.getElementById('filterOutlier').value;
  state.filters.hasOutlier = outlierVal;
  
  loadRecords();
}

function resetFilters() {
  document.getElementById('filterStation').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterOutlier').value = '';
  state.filters = {
    stationId: '',
    status: '',
    hasOutlier: ''
  };
  loadRecords();
}

function showImportModal(type) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const confirmBtn = document.getElementById('modalConfirm');
  
  if (type === 'lab') {
    title.textContent = '导入实验室结果表';
    body.innerHTML = `
      <div class="form-group">
        <label>数据来源名称</label>
        <input type="text" id="importSourceName" value="实验室结果表 v1" placeholder="例如：2024年6月监测报告">
      </div>
      <div class="form-group">
        <label>备注说明</label>
        <input type="text" id="importNote" placeholder="选填，例如：第一批次">
      </div>
      <div class="form-group">
        <label>JSON 数据（粘贴或输入）</label>
        <textarea id="importData" placeholder='[{"stationId":"S01","sampleTime":"2024-06-01","temperature":25.3,...}]'></textarea>
      </div>
      <button class="btn btn-secondary btn-sm" id="btnLoadSample" style="margin-bottom:12px;">加载示例数据</button>
      <div id="importResult" class="result-box" style="display:none;"></div>
    `;
    
    document.getElementById('btnLoadSample').addEventListener('click', loadSampleLabData);
    
    confirmBtn.onclick = () => handleImportLab();
    
  } else if (type === 'boundary') {
    title.textContent = '导入边界样本';
    body.innerHTML = `
      <div class="form-group">
        <label>样本编号</label>
        <input type="text" id="boundarySampleId" value="B001" placeholder="边界样本编号">
      </div>
      <div class="form-group">
        <label>站点编号</label>
        <input type="text" id="boundaryStationId" value="S05" placeholder="站点编号">
      </div>
      <div class="form-group">
        <label>采样时间</label>
        <input type="text" id="boundarySampleTime" value="2024-06-15 14:30:00">
      </div>
      <div class="form-group">
        <label>经度</label>
        <input type="number" id="boundaryLng" value="122.5" step="0.01">
      </div>
      <div class="form-group">
        <label>纬度</label>
        <input type="number" id="boundaryLat" value="31.2" step="0.01">
      </div>
      <div class="form-group">
        <label>边界类型</label>
        <input type="text" id="boundaryType" value="edge" placeholder="edge/outer/inner">
      </div>
      <div class="form-group">
        <label>描述</label>
        <textarea id="boundaryDesc" placeholder="边界样本描述..."></textarea>
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="boundaryNote" placeholder="选填">
      </div>
      <div id="importResult" class="result-box" style="display:none;"></div>
    `;
    
    confirmBtn.onclick = () => handleImportBoundary();
    
  } else if (type === 'verbal') {
    title.textContent = '添加口头说明';
    body.innerHTML = `
      <div class="form-group">
        <label>报告人</label>
        <input type="text" id="verbalReporter" value="老何" placeholder="报告人姓名">
      </div>
      <div class="form-group">
        <label>说明内容</label>
        <textarea id="verbalContent" placeholder="口头说明内容..."></textarea>
      </div>
      <div id="importResult" class="result-box" style="display:none;"></div>
    `;
    
    confirmBtn.onclick = () => handleImportVerbal();
  }
  
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function loadSampleLabData() {
  const sampleData = generateSampleLabData();
  document.getElementById('importData').value = JSON.stringify(sampleData, null, 2);
}

function generateSampleLabData() {
  const stations = [
    { id: 'S01', name: '一号监测站', lng: 122.1, lat: 30.8 },
    { id: 'S02', name: '二号监测站', lng: 122.3, lat: 31.0 },
    { id: 'S03', name: '三号监测站', lng: 122.5, lat: 31.2 },
    { id: 'S04', name: '四号监测站', lng: 122.7, lat: 31.4 },
    { id: 'S05', name: '五号监测站', lng: 122.9, lat: 31.6 }
  ];
  
  const data = [];
  const baseDate = new Date('2024-06-01');
  
  for (let day = 0; day < 7; day++) {
    for (const station of stations) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + day);
      
      const temp = 24 + Math.random() * 3;
      const salinity = 30 + Math.random() * 2;
      const doVal = 6 + Math.random() * 2;
      const ph = 7.8 + Math.random() * 0.3;
      const chl = 2 + Math.random() * 3;
      const turb = 5 + Math.random() * 10;
      
      const tideLevel = 2 + Math.random() * 1.5;
      const tideUnit = (day === 5 && station.id === 'S03') ? '厘米' : 'm';
      
      const record = {
        stationId: station.id,
        stationName: station.name,
        sampleTime: date.toISOString().split('T')[0] + ' 08:00:00',
        longitude: station.lng + (Math.random() - 0.5) * 0.02,
        latitude: station.lat + (Math.random() - 0.5) * 0.02,
        temperature: parseFloat(temp.toFixed(2)),
        salinity: parseFloat(salinity.toFixed(2)),
        dissolvedOxygen: parseFloat(doVal.toFixed(2)),
        pH: parseFloat(ph.toFixed(2)),
        chlorophyll: parseFloat(chl.toFixed(2)),
        turbidity: parseFloat(turb.toFixed(2)),
        tideLevel: parseFloat(tideLevel.toFixed(2)),
        tideUnit: tideUnit
      };
      
      if (day === 3 && station.id === 'S02') {
        record.temperature = 35.5;
        record.salinity = 45.0;
      }
      
      data.push(record);
    }
  }
  
  return data;
}

async function handleImportLab() {
  const sourceName = document.getElementById('importSourceName').value;
  const note = document.getElementById('importNote').value;
  const dataStr = document.getElementById('importData').value;
  
  let data;
  try {
    data = JSON.parse(dataStr);
  } catch (err) {
    showImportResult('❌ JSON 解析失败: ' + err.message, 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/import/lab-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, sourceName, note })
    });
    
    const result = await res.json();
    
    if (result.success) {
      let msg = `✅ 导入成功！\n\n版本ID: ${result.versionId}\n`;
      msg += `记录数: ${result.stats.totalRecords}\n`;
      msg += `站点数: ${result.stats.stationCount}\n`;
      msg += `离群值: ${result.stats.outliers}\n`;
      msg += `待确认: ${result.stats.pendingConfirm}\n\n`;
      
      if (result.qualityCheck?.tideUnitMismatch?.hasMismatch) {
        msg += `⚠️ 潮位单位混写检测: 发现 ${result.qualityCheck.tideUnitMismatch.unitsFound.length} 种单位\n`;
        msg += `   受影响记录: ${result.qualityCheck.tideUnitMismatch.affectedRecords.length} 条\n`;
        msg += `   单位列表: ${result.qualityCheck.tideUnitMismatch.unitsFound.join(', ')}\n\n`;
      }
      
      msg += `变更类型: ${result.changes?.type || 'unknown'}\n`;
      msg += `记录变化: ${result.changes?.recordDiff || 0 > 0 ? '+' : ''}${result.changes?.recordDiff || 0}\n`;
      
      showImportResult(msg, 'success');
      
      setTimeout(() => {
        closeModal();
        loadAllData();
      }, 1500);
    } else {
      showImportResult('❌ 导入失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (err) {
    showImportResult('❌ 请求失败: ' + err.message, 'error');
  }
}

async function handleImportBoundary() {
  const data = {
    sampleId: document.getElementById('boundarySampleId').value,
    stationId: document.getElementById('boundaryStationId').value,
    sampleTime: document.getElementById('boundarySampleTime').value,
    longitude: parseFloat(document.getElementById('boundaryLng').value),
    latitude: parseFloat(document.getElementById('boundaryLat').value),
    boundaryType: document.getElementById('boundaryType').value,
    description: document.getElementById('boundaryDesc').value,
    note: document.getElementById('boundaryNote').value
  };
  
  try {
    const res = await fetch(`${API_BASE}/import/boundary-sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    
    const result = await res.json();
    
    if (result.success) {
      let msg = `✅ 边界样本导入成功！\n\n`;
      msg += `样本编号: ${result.sample.sampleId}\n`;
      msg += `站点: ${result.sample.stationId}\n`;
      msg += `位置: ${result.sample.longitude}, ${result.sample.latitude}\n\n`;
      msg += `总记录数: ${result.stats.totalRecords}\n`;
      msg += `变更: ${getChangeText(result.changes)}\n`;
      
      showImportResult(msg, 'success');
      
      setTimeout(() => {
        closeModal();
        loadAllData();
      }, 1500);
    } else {
      showImportResult('❌ 导入失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (err) {
    showImportResult('❌ 请求失败: ' + err.message, 'error');
  }
}

async function handleImportVerbal() {
  const data = {
    reporter: document.getElementById('verbalReporter').value,
    content: document.getElementById('verbalContent').value
  };
  
  if (!data.content) {
    showImportResult('❌ 请输入说明内容', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/import/verbal-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    
    const result = await res.json();
    
    if (result.success) {
      let msg = `✅ 口头说明已添加！\n\n`;
      msg += `报告人: ${result.note.reporter}\n`;
      msg += `时间: ${new Date(result.note.timestamp).toLocaleString('zh-CN')}\n\n`;
      msg += `内容: ${result.note.content}\n`;
      
      showImportResult(msg, 'success');
      
      setTimeout(() => {
        closeModal();
        loadAllData();
      }, 1500);
    } else {
      showImportResult('❌ 添加失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (err) {
    showImportResult('❌ 请求失败: ' + err.message, 'error');
  }
}

function showImportResult(message, type) {
  const resultDiv = document.getElementById('importResult');
  resultDiv.style.display = 'block';
  resultDiv.textContent = message;
  resultDiv.style.background = type === 'success' ? '#e8f5e9' : '#ffebee';
  resultDiv.style.color = type === 'success' ? '#2e7d32' : '#c62828';
}

async function handleRerun() {
  if (!state.summary || state.summary.totalRecords === 0) {
    alert('没有数据可重跑，请先导入数据');
    return;
  }
  
  const note = prompt('重跑备注（可选）：', '补录后重跑');
  if (note === null) return;
  
  try {
    const res = await fetch(`${API_BASE}/rerun`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    
    const result = await res.json();
    
    if (result.success) {
      let msg = `🔄 重跑完成！\n\n`;
      msg += `版本ID: ${result.versionId}\n`;
      msg += `总记录数: ${result.stats.totalRecords}\n`;
      msg += `离群值: ${result.stats.outliers}\n`;
      msg += `待确认: ${result.stats.pendingConfirm}\n\n`;
      
      if (result.history) {
        msg += `📜 历史连续性: ${result.history.broken ? '⚠️ 可能断开' : '✅ 正常'}\n`;
        msg += `总版本数: ${result.history.totalVersions}\n`;
      }
      
      if (result.changes?.modifiedCount > 0) {
        msg += `\n📝 修改记录数: ${result.changes.modifiedCount}\n`;
        if (result.changes.modifiedRecords) {
          for (const m of result.changes.modifiedRecords.slice(0, 3)) {
            msg += `   - ${m.stationId}: ${m.changes.length} 个字段变更\n`;
          }
        }
      }
      
      alert(msg);
      loadAllData();
    } else {
      alert('重跑失败: ' + (result.error || '未知错误'));
    }
  } catch (err) {
    alert('请求失败: ' + err.message);
  }
}

async function handleExport() {
  const format = confirm('导出为 JSON 格式？\n\n(确认=JSON，取消=CSV)') ? 'json' : 'csv';
  
  const params = new URLSearchParams();
  if (state.filters.stationId) params.set('stationId', state.filters.stationId);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.hasOutlier !== '') params.set('hasOutlier', state.filters.hasOutlier);
  params.set('format', format);
  
  try {
    const res = await fetch(`${API_BASE}/export?${params.toString()}`);
    const result = await res.json();
    
    let content = result.data;
    const blob = new Blob([content], { 
      type: format === 'csv' ? 'text/csv' : 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.filename}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`✅ 导出成功！\n\n格式: ${format.toUpperCase()}\n记录数: ${result.recordCount}\n文件名: ${result.filename}.${format}\n\n注意：导出口径与当前屏幕筛选一致`);
  } catch (err) {
    alert('导出失败: ' + err.message);
  }
}

function showVersionDetail(versionId) {
  const version = state.versions.find(v => v.id === versionId);
  if (!version) return;
  
  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const confirmBtn = document.getElementById('modalConfirm');
  
  title.textContent = '版本详情';
  
  const ts = new Date(version.timestamp);
  let html = `
    <div style="margin-bottom:12px;">
      <strong>来源:</strong> ${version.source || '未知'}
    </div>
    <div style="margin-bottom:12px;">
      <strong>时间:</strong> ${ts.toLocaleString('zh-CN')}
    </div>
    ${version.note ? `<div style="margin-bottom:12px;"><strong>备注:</strong> ${version.note}</div>` : ''}
    <div style="margin-bottom:12px;">
      <strong>统计:</strong>
      <ul style="margin:8px 0 0 20px;">
        <li>总记录: ${version.stats?.totalRecords || 0}</li>
        <li>站点数: ${version.stats?.stationCount || 0}</li>
        <li>离群值: ${version.stats?.outliers || 0}</li>
        <li>待确认: ${version.stats?.pendingConfirm || 0}</li>
      </ul>
    </div>
  `;
  
  if (version.changes) {
    html += `<div class="change-info ${version.changes.type === 'initial' ? '' : 'warning'}">
      <strong>变更情况:</strong><br>
      ${getChangeText(version.changes)}<br>
      类型: ${version.changes.type}
    </div>`;
    
    if (version.changes.modifiedRecords && version.changes.modifiedRecords.length > 0) {
      html += `<div style="margin-top:12px;">
        <strong>修改的记录:</strong>
        <div style="margin-top:8px;font-size:12px;max-height:200px;overflow-y:auto;">
      `;
      for (const m of version.changes.modifiedRecords) {
        html += `<div style="padding:6px;background:#f5f7fa;border-radius:4px;margin-bottom:4px;">
          <strong>${m.stationId || m.id}</strong>:
          ${m.changes.map(c => `${c.field} (${c.oldValue} → ${c.newValue})`).join(', ')}
        </div>`;
      }
      html += '</div></div>';
    }
  }
  
  body.innerHTML = html;
  confirmBtn.style.display = 'none';
  
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalConfirm').style.display = '';
}
