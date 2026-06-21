// ========== 浮标海况空间标注系统 ==========

const state = {
  records: [],
  markers: [],
  map: null,
  chart: null,
  currentFilter: 'all',
  currentRecordId: null,
  calcMethod: '有效波高三分位法（2024版）'
};

// ========== 经纬度转换工具 ==========

function parseCoord(str) {
  if (!str) return null;
  str = str.trim().toUpperCase();
  
  if (str.includes('°') && (str.includes("'") || str.includes('′'))) {
    return parseDMS(str);
  }
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return num;
  }
  return null;
}

function parseDMS(str) {
  const dirMatch = str.match(/[NSEW]/);
  const dir = dirMatch ? dirMatch[0] : '';
  
  let numStr = str.replace(/[NSEW]/g, '').trim();
  
  const degMatch = numStr.match(/(\d+)\s*°/);
  const minMatch = numStr.match(/°\s*(\d+(?:\.\d+)?)\s*['′]/);
  const secMatch = numStr.match(/['′]\s*(\d+(?:\.\d+)?)\s*["″]/);
  
  if (!degMatch) return null;
  
  let deg = parseFloat(degMatch[1]);
  let min = minMatch ? parseFloat(minMatch[1]) : 0;
  let sec = secMatch ? parseFloat(secMatch[1]) : 0;
  
  let decimal = deg + min / 60 + sec / 3600;
  
  if (dir === 'S' || dir === 'W') {
    decimal = -decimal;
  }
  
  return Math.round(decimal * 10000) / 10000;
}

function formatCoord(decimal, isLat) {
  if (decimal === null || decimal === undefined) return '-';
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60 * 10) / 10;
  
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  
  if (sec > 0) {
    return `${deg}°${min}'${sec}"${dir}`;
  } else {
    return `${deg}°${min}'${dir}`;
  }
}

// ========== 样例数据 ==========

function getSampleData() {
  return [
    {
      id: 'FB-001',
      shipName: '向阳红03',
      obsTime: '2025-06-15 08:00',
      lat_raw: '30°15\'30"N',
      lon_raw: '122°30\'45"E',
      seaState: 3,
      waveHeight: 1.2,
      windSpeed: 6.5,
      isCloud: false,
      isBoundary: false,
      isAbnormal: false,
      originalRemark: '海况平稳，能见度良好',
      source: '船上记录本第12页'
    },
    {
      id: 'FB-002',
      shipName: '向阳红03',
      obsTime: '2025-06-15 09:00',
      lat_raw: '30°18\'00"N',
      lon_raw: '122°35\'00"E',
      seaState: 5,
      waveHeight: 3.5,
      windSpeed: 12.0,
      isCloud: false,
      isBoundary: false,
      isAbnormal: false,
      originalRemark: '风浪增大',
      source: '船上记录本第12页'
    },
    {
      id: 'FB-003',
      shipName: '向阳红03',
      obsTime: '2025-06-15 10:00',
      lat_raw: '30°22\'15"N',
      lon_raw: '122°40\'30"E',
      seaState: 2,
      waveHeight: 0.5,
      windSpeed: 3.0,
      isCloud: true,
      isBoundary: false,
      isAbnormal: false,
      originalRemark: '遥感云遮挡，数据仅供参考',
      source: '船上记录本第13页'
    },
    {
      id: 'FB-004',
      shipName: '实验1号',
      obsTime: '2025-06-15 08:30',
      lat_raw: '31°05\'00"N',
      lon_raw: '123°00\'00"E',
      seaState: 6,
      waveHeight: 5.2,
      windSpeed: 15.5,
      isCloud: false,
      isBoundary: true,
      isAbnormal: true,
      originalRemark: '边界样本，接近观测区边缘，海况突变',
      source: '船上记录本第5页'
    },
    {
      id: 'FB-005',
      shipName: '实验1号',
      obsTime: '2025-06-15 09:30',
      lat_raw: '31°10\'00"N',
      lon_raw: '123°10\'00"E',
      seaState: 4,
      waveHeight: 2.1,
      windSpeed: 8.5,
      isCloud: false,
      isBoundary: true,
      isAbnormal: false,
      originalRemark: '边界点，纬度超出常规观测带0.5度',
      source: '船上记录本第5页'
    },
    {
      id: 'FB-006',
      shipName: '向阳红03',
      obsTime: '2025-06-15 11:00',
      lat_raw: '30°25\'45"N',
      lon_raw: '122°45\'15"E',
      seaState: 2,
      waveHeight: 0.8,
      windSpeed: 4.0,
      isCloud: false,
      isBoundary: false,
      isAbnormal: true,
      originalRemark: '异常：波高与海况等级不匹配，需复核',
      source: '船上记录本第13页'
    },
    {
      id: 'FB-007',
      shipName: '实验2号',
      obsTime: '2025-06-15 07:00',
      lat_raw: '29°50\'00"N',
      lon_raw: '122°15\'00"E',
      seaState: 1,
      waveHeight: 0.2,
      windSpeed: 1.5,
      isCloud: true,
      isBoundary: false,
      isAbnormal: false,
      originalRemark: '早间云量90%，卫星数据受影响',
      source: '船上记录本第3页'
    },
    {
      id: 'FB-008',
      shipName: '向阳红03',
      obsTime: '2025-06-15 12:00',
      lat_raw: '30.5500',
      lon_raw: '122.9000',
      seaState: 4,
      waveHeight: 2.0,
      windSpeed: 9.0,
      isCloud: false,
      isBoundary: false,
      isAbnormal: false,
      originalRemark: '午间记录，用十进制度写法',
      source: '船上记录本第14页'
    }
  ];
}

// ========== 数据去重与导入 ==========

function getRecordKey(r) {
  const lat = parseCoord(r.lat_raw) || r.lat;
  const lon = parseCoord(r.lon_raw) || r.lon;
  return `${r.id}_${lat}_${lon}_${r.obsTime}`;
}

function importRecords(newRecords) {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  
  newRecords.forEach(newRec => {
    const newKey = getRecordKey(newRec);
    const existingIndex = state.records.findIndex(r => getRecordKey(r) === newKey);
    
    if (existingIndex >= 0) {
      const existing = state.records[existingIndex];
      const preserved = {
        manualRemark: existing.manualRemark || '',
        reviewed: existing.reviewed,
        reviewTime: existing.reviewTime,
        importCount: (existing.importCount || 1) + 1
      };
      state.records[existingIndex] = {
        ...existing,
        ...newRec,
        lat: parseCoord(newRec.lat_raw) || newRec.lat || existing.lat,
        lon: parseCoord(newRec.lon_raw) || newRec.lon || existing.lon,
        ...preserved
      };
      updated++;
    } else {
      state.records.push({
        ...newRec,
        lat: parseCoord(newRec.lat_raw) || newRec.lat,
        lon: parseCoord(newRec.lon_raw) || newRec.lon,
        reviewed: false,
        manualRemark: '',
        importCount: 1
      });
      added++;
    }
  });
  
  showToast(`导入完成：新增 ${added} 条，更新 ${updated} 条，跳过重复 ${skipped} 条`);
  refreshAll();
}

// ========== 地图相关 ==========

function initMap() {
  state.map = L.map('map').setView([30.5, 122.7], 9);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(state.map);
}

function getMarkerColor(record) {
  if (record.reviewed) return '#1890ff';
  if (record.isAbnormal) return '#ff4d4f';
  if (record.isCloud) return '#faad14';
  if (record.isBoundary) return '#722ed1';
  return '#52c41a';
}

function refreshMarkers() {
  state.markers.forEach(m => state.map.removeLayer(m));
  state.markers = [];
  
  const filtered = getFilteredRecords();
  
  filtered.forEach(r => {
    if (r.lat === null || r.lon === null) return;
    
    const color = getMarkerColor(r);
    const marker = L.circleMarker([r.lat, r.lon], {
      radius: 8,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85
    }).addTo(state.map);
    
    marker.bindPopup(`
      <div style="font-size:12px;">
        <strong>${r.id}</strong> · ${r.shipName}<br>
        时间：${r.obsTime}<br>
        海况：${r.seaState}级 · 波高${r.waveHeight}m<br>
        状态：${getStatusText(r)}
      </div>
    `);
    
    marker.on('click', () => openDetail(r.id));
    state.markers.push(marker);
  });
  
  if (filtered.length > 0) {
    const bounds = L.latLngBounds(filtered
      .filter(r => r.lat !== null && r.lon !== null)
      .map(r => [r.lat, r.lon]));
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}

// ========== 统计图表 ==========

function initChart() {
  const ctx = document.getElementById('seaStateChart').getContext('2d');
  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1级', '2级', '3级', '4级', '5级', '6级'],
      datasets: [{
        label: '记录数',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: ['#52c41a', '#52c41a', '#52c41a', '#faad14', '#faad14', '#ff4d4f'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const level = elements[0].index + 1;
          filterBySeaState(level);
        }
      }
    }
  });
}

function refreshChart() {
  const counts = [0, 0, 0, 0, 0, 0];
  state.records.forEach(r => {
    if (r.seaState >= 1 && r.seaState <= 6) {
      counts[r.seaState - 1]++;
    }
  });
  state.chart.data.datasets[0].data = counts;
  state.chart.update();
}

function filterBySeaState(level) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  state.currentFilter = 'seastate_' + level;
  refreshRecordTable();
  refreshMarkers();
  showToast(`筛选海况 ${level} 级记录`);
}

// ========== 记录列表 ==========

function getFilteredRecords() {
  switch (state.currentFilter) {
    case 'abnormal':
      return state.records.filter(r => r.isAbnormal);
    case 'cloud':
      return state.records.filter(r => r.isCloud);
    case 'boundary':
      return state.records.filter(r => r.isBoundary);
    case 'unreviewed':
      return state.records.filter(r => !r.reviewed);
    default:
      if (state.currentFilter.startsWith('seastate_')) {
        const level = parseInt(state.currentFilter.split('_')[1]);
        return state.records.filter(r => r.seaState === level);
      }
      return state.records;
  }
}

function getStatusText(r) {
  if (r.reviewed) return '已复核';
  if (r.isAbnormal) return '异常';
  if (r.isCloud) return '云遮挡';
  if (r.isBoundary) return '边界样本';
  return '正常';
}

function getStatusClass(r) {
  if (r.reviewed) return 'tag-reviewed';
  if (r.isAbnormal) return 'tag-abnormal';
  if (r.isCloud) return 'tag-cloud';
  if (r.isBoundary) return 'tag-boundary';
  return 'tag-normal';
}

function refreshRecordTable() {
  const container = document.getElementById('recordTable');
  const records = getFilteredRecords();
  
  if (records.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无符合条件的记录</p>';
    return;
  }
  
  let html = `
    <div class="record-row header">
      <span>编号</span>
      <span>船名 / 时间</span>
      <span>位置</span>
      <span>海况</span>
      <span>波高</span>
      <span>状态</span>
    </div>
  `;
  
  records.forEach(r => {
    html += `
      <div class="record-row" onclick="openDetail('${r.id}')">
        <span>${r.id}</span>
        <span>${r.shipName}<br><small style="color:#999">${r.obsTime}</small></span>
        <span style="font-family:monospace;font-size:11px;">${formatCoord(r.lat, true)}<br>${formatCoord(r.lon, false)}</span>
        <span>${r.seaState}级</span>
        <span>${r.waveHeight}m</span>
        <span><span class="status-tag ${getStatusClass(r)}">${getStatusText(r)}</span></span>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ========== 特殊记录列表（云遮挡/边界） ==========

function refreshSpecialList() {
  const container = document.getElementById('specialList');
  const specials = state.records.filter(r => r.isCloud || r.isBoundary);
  
  if (specials.length === 0) {
    container.innerHTML = '<p class="empty-tip">暂无特殊记录</p>';
    return;
  }
  
  let html = '';
  specials.forEach(r => {
    const cls = r.isCloud ? 'cloud' : 'boundary';
    const type = r.isCloud ? '云遮挡' : '边界样本';
    const suggest = r.isCloud 
      ? '建议：结合可见光影像人工判读，或使用微波数据交叉验证'
      : '建议：标注为边界样本，纳入统计时单独列出，不参与整体平均';
    
    html += `
      <div class="special-item ${cls}" onclick="openDetail('${r.id}')">
        <div class="sp-title">${r.id} · ${type}</div>
        <div class="sp-tip">${r.shipName} · ${r.obsTime}</div>
        <div class="sp-suggest">${suggest}</div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ========== 详情弹窗 & 复核 ==========

function openDetail(id) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;
  
  state.currentRecordId = id;
  document.getElementById('modalTitle').textContent = `${r.id} 记录详情`;
  
  const latDMS = r.lat_raw || formatCoord(r.lat, true);
  const lonDMS = r.lon_raw || formatCoord(r.lon, false);
  
  let abnormalSection = '';
  if (r.isAbnormal) {
    abnormalSection = `
      <div class="detail-section">
        <h4>⚠️ 异常说明</h4>
        <div class="note-box">${r.originalRemark || '数据异常，需人工复核'}</div>
      </div>
    `;
  }
  
  let cloudSection = '';
  if (r.isCloud) {
    cloudSection = `
      <div class="detail-section">
        <h4>☁️ 云遮挡处理建议</h4>
        <div class="suggest-box">
          1. 该时刻遥感数据受云遮挡影响<br>
          2. 建议结合船上人工观测记录作为主数据<br>
          3. 统计分析时可标记为"云遮挡"单独处理<br>
          4. 不建议直接参与海况空间插值
        </div>
      </div>
    `;
  }
  
  let boundarySection = '';
  if (r.isBoundary) {
    boundarySection = `
      <div class="detail-section">
        <h4>📐 边界样本说明</h4>
        <div class="suggest-box">
          1. 该记录位于观测区域边缘<br>
          2. 空间插值时边界效应较明显<br>
          3. 建议保留原始记录，统计时单独分组<br>
          4. 不作为待复核异常，但需标注
        </div>
      </div>
    `;
  }
  
  const bodyHtml = `
    <div class="detail-section">
      <h4>📋 船上原始记录</h4>
      <div class="detail-grid">
        <span class="label">记录编号</span><span class="value">${r.id}</span>
        <span class="label">船名</span><span class="value">${r.shipName}</span>
        <span class="label">观测时间</span><span class="value">${r.obsTime}</span>
        <span class="label">原始纬度</span><span class="value">${latDMS}</span>
        <span class="label">原始经度</span><span class="value">${lonDMS}</span>
        <span class="label">海况等级</span><span class="value">${r.seaState}级</span>
        <span class="label">有效波高</span><span class="value">${r.waveHeight} m</span>
        <span class="label">风速</span><span class="value">${r.windSpeed} m/s</span>
        <span class="label">数据来源</span><span class="value">${r.source || '船上记录本'}</span>
      </div>
    </div>
    
    <div class="detail-section">
      <h4>🧮 本次计算口径</h4>
      <div class="detail-grid">
        <span class="label">计算方法</span><span class="value">${state.calcMethod}</span>
        <span class="label">标准纬度</span><span class="value">${r.lat}°</span>
        <span class="label">标准经度</span><span class="value">${r.lon}°</span>
        <span class="label">状态标记</span><span class="value">${getStatusText(r)}</span>
      </div>
    </div>
    
    ${abnormalSection}
    ${cloudSection}
    ${boundarySection}
    
    <div class="detail-section">
      <h4>📝 人工备注</h4>
      <textarea id="manualRemarkInput" class="remark-input" placeholder="输入人工备注，重复导入不会覆盖...">${r.manualRemark || ''}</textarea>
      <p style="font-size:11px;color:#999;margin-top:4px;">备注内容会被保留，重复导入同一条记录时不会被覆盖</p>
    </div>
    
    <div class="detail-section">
      <h4>📊 复核状态</h4>
      <div class="detail-grid">
        <span class="label">当前状态</span><span class="value">${r.reviewed ? '✅ 已复核' : '⏳ 待复核'}</span>
        ${r.reviewTime ? `<span class="label">复核时间</span><span class="value">${r.reviewTime}</span>` : ''}
      </div>
    </div>
  `;
  
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('detailModal').classList.remove('hidden');
  
  if (r.lat !== null && r.lon !== null) {
    state.map.setView([r.lat, r.lon], 12);
  }
}

function closeModal() {
  document.getElementById('detailModal').classList.add('hidden');
  state.currentRecordId = null;
}

function markReviewed() {
  if (!state.currentRecordId) return;
  
  const r = state.records.find(x => x.id === state.currentRecordId);
  if (!r) return;
  
  const remarkInput = document.getElementById('manualRemarkInput');
  if (remarkInput) {
    r.manualRemark = remarkInput.value;
  }
  
  r.reviewed = true;
  r.reviewTime = new Date().toLocaleString('zh-CN');
  
  showToast(`已标记 ${r.id} 为已复核`);
  closeModal();
  refreshAll();
}

// ========== 统计数字更新 ==========

function refreshStats() {
  document.getElementById('statTotal').textContent = state.records.length;
  document.getElementById('statReviewed').textContent = state.records.filter(r => r.reviewed).length;
  document.getElementById('statAbnormal').textContent = state.records.filter(r => r.isAbnormal && !r.reviewed).length;
  document.getElementById('statCloud').textContent = state.records.filter(r => r.isCloud).length;
}

// ========== 导入 & 导出 ==========

function handleFileImport(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const records = parseCSV(text);
    
    if (records.length === 0) {
      showToast('未解析到有效数据');
      return;
    }
    
    importRecords(records);
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < headers.length) continue;
    
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx];
    });
    
    record.seaState = parseInt(record.seaState) || 0;
    record.waveHeight = parseFloat(record.waveHeight) || 0;
    record.windSpeed = parseFloat(record.windSpeed) || 0;
    record.isCloud = record.isCloud === 'true' || record.isCloud === '是';
    record.isBoundary = record.isBoundary === 'true' || record.isBoundary === '是';
    record.isAbnormal = record.isAbnormal === 'true' || record.isAbnormal === '是';
    
    records.push(record);
  }
  
  return records;
}

function exportResults() {
  if (state.records.length === 0) {
    showToast('暂无数据可导出');
    return;
  }
  
  const headers = ['编号', '船名', '观测时间', '原始纬度', '原始经度', '标准纬度', '标准经度', '海况等级', '有效波高(m)', '风速(m/s)', '是否云遮挡', '是否边界样本', '是否异常', '状态', '复核状态', '复核时间', '原始备注', '人工备注', '数据来源', '计算口径'];
  
  const rows = state.records.map(r => [
    r.id,
    r.shipName,
    r.obsTime,
    r.lat_raw || formatCoord(r.lat, true),
    r.lon_raw || formatCoord(r.lon, false),
    r.lat,
    r.lon,
    r.seaState,
    r.waveHeight,
    r.windSpeed,
    r.isCloud ? '是' : '否',
    r.isBoundary ? '是' : '否',
    r.isAbnormal ? '是' : '否',
    getStatusText(r),
    r.reviewed ? '已复核' : '待复核',
    r.reviewTime || '',
    r.originalRemark || '',
    r.manualRemark || '',
    r.source || '船上记录本',
    state.calcMethod
  ]);
  
  let csv = '\uFEFF' + headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(v => `"${v}"`).join(',') + '\n';
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `浮标海况标注结果_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast(`已导出 ${state.records.length} 条记录`);
}

// ========== 工具函数 ==========

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 2500);
}

function refreshAll() {
  refreshStats();
  refreshChart();
  refreshMarkers();
  refreshRecordTable();
  refreshSpecialList();
}

function closeHelp() {
  document.getElementById('helpModal').classList.add('hidden');
}

// ========== 事件绑定 & 初始化 ==========

document.addEventListener('DOMContentLoaded', function() {
  initMap();
  initChart();
  
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  
  document.getElementById('fileInput').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      handleFileImport(e.target.files[0]);
      e.target.value = '';
    }
  });
  
  document.getElementById('btnExport').addEventListener('click', exportResults);
  
  document.getElementById('btnHelp').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('hidden');
  });
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      state.currentFilter = this.dataset.filter;
      refreshRecordTable();
      refreshMarkers();
    });
  });
  
  document.getElementById('statAbnormal').addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-filter="abnormal"]').classList.add('active');
    state.currentFilter = 'abnormal';
    refreshRecordTable();
    refreshMarkers();
    showToast('已筛选异常记录');
  });
  
  document.getElementById('statCloud').addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-filter="cloud"]').classList.add('active');
    state.currentFilter = 'cloud';
    refreshRecordTable();
    refreshMarkers();
    showToast('已筛选云遮挡记录');
  });
  
  document.querySelector('.modal-content').addEventListener?.('click', e => e.stopPropagation());
  
  window.addEventListener('click', function(e) {
    const detailModal = document.getElementById('detailModal');
    const helpModal = document.getElementById('helpModal');
    
    if (e.target === detailModal) closeModal();
    if (e.target === helpModal) closeHelp();
  });
  
  importRecords(getSampleData());
  
  const sampleRec = state.records.find(r => r.lat_raw && r.lat_raw.includes('°'));
  if (sampleRec) {
    document.getElementById('coordShipExample').textContent = sampleRec.lat_raw;
    document.getElementById('coordStdExample').textContent = sampleRec.lat + '°';
  }
});
