const API_BASE = '/api';
let currentBatchId = null;
let currentBatchData = null;
let selectedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
  loadBatches();
  setupFileUpload();
});

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  msg.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

async function loadBatches() {
  try {
    const res = await fetch(`${API_BASE}/upload/batches`);
    const batches = await res.json();
    document.getElementById('batch-count').textContent = `共 ${batches.length} 个批次`;
    renderBatches(batches);
  } catch (e) {
    console.error(e);
    document.getElementById('batch-count').textContent = '加载失败';
  }
}

function renderBatches(batches) {
  const container = document.getElementById('batches-container');
  
  if (batches.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl p-12 text-center">
        <div class="text-6xl mb-4">📭</div>
        <p class="text-gray-500 mb-4">还没有校验批次</p>
        <button onclick="showImportModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          开始第一次导入
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = batches.map(batch => `
    <div class="bg-white rounded-xl p-5 card-hover cursor-pointer transition" onclick="openBatch(${batch.id})">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="font-medium text-gray-800">${batch.name}</h3>
          <p class="text-sm text-gray-500 mt-1">${new Date(batch.created_at).toLocaleString('zh-CN')}</p>
        </div>
        <span class="status-badge ${batch.status === 'completed' ? 'status-normal' : 'status-warning'}">
          ${batch.status === 'completed' ? '已完成' : '处理中'}
        </span>
      </div>
      <div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
        <div class="text-center">
          <div class="text-2xl font-semibold text-gray-800">${batch.file_count || 0}</div>
          <div class="text-xs text-gray-500">文件数</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-semibold text-gray-800">${batch.track_count || 0}</div>
          <div class="text-xs text-gray-500">曲目数</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-semibold ${batch.issue_count > 0 ? 'text-amber-600' : 'text-green-600'}">${batch.issue_count || 0}</div>
          <div class="text-xs text-gray-500">待处理</div>
        </div>
      </div>
    </div>
  `).join('');
}

async function openBatch(batchId) {
  currentBatchId = batchId;
  
  try {
    const [dataRes, summaryRes] = await Promise.all([
      fetch(`${API_BASE}/validation/batch/${batchId}`),
      fetch(`${API_BASE}/validation/batch/${batchId}/summary`)
    ]);
    
    currentBatchData = await dataRes.json();
    const summary = await summaryRes.json();
    
    renderBatchDetail(currentBatchData, summary);
    
    document.getElementById('batch-list').classList.add('hidden');
    document.getElementById('batch-detail').classList.remove('hidden');
  } catch (e) {
    console.error(e);
    showToast('加载批次详情失败');
  }
}

function backToList() {
  document.getElementById('batch-list').classList.remove('hidden');
  document.getElementById('batch-detail').classList.add('hidden');
  loadBatches();
}

function renderBatchDetail(data, summary) {
  document.getElementById('detail-title').textContent = '批次详情';
  document.getElementById('detail-time').textContent = `曲目数: ${data.tracks.length} | 异常数: ${data.anomalies.length}`;
  
  const stats = summary.trackStats;
  document.getElementById('stats-panel').innerHTML = `
    <div class="bg-gray-50 rounded-lg p-4">
      <div class="text-3xl font-bold text-gray-800">${stats.total_tracks || 0}</div>
      <div class="text-sm text-gray-500 mt-1">总曲目</div>
    </div>
    <div class="bg-green-50 rounded-lg p-4">
      <div class="text-3xl font-bold text-green-600">${stats.valid_tracks || 0}</div>
      <div class="text-sm text-gray-500 mt-1">校验通过</div>
    </div>
    <div class="bg-amber-50 rounded-lg p-4">
      <div class="text-3xl font-bold text-amber-600">${stats.invalid_tracks || 0}</div>
      <div class="text-sm text-gray-500 mt-1">存在异常</div>
    </div>
    <div class="bg-blue-50 rounded-lg p-4">
      <div class="text-3xl font-bold text-blue-600">${stats.reviewed_tracks || 0}</div>
      <div class="text-sm text-gray-500 mt-1">已复核</div>
    </div>
  `;
  
  renderTracks(data.tracks);
  renderAnomalies(data.anomalies);
  renderNotes(data.notes);
  loadConflicts();
}

function renderTracks(tracks) {
  const tbody = document.getElementById('tracks-tbody');
  tbody.innerHTML = tracks.map(track => {
    const calculated = track.start_page && track.end_page ? track.end_page - track.start_page + 1 : '-';
    const statusClass = track.is_valid ? 'status-normal' : 'status-warning';
    const statusText = track.is_valid ? '正常' : '异常';
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm text-gray-600">${track.track_number}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-gray-800">${track.track_name}</div>
          ${track.anomaly_descriptions ? `<div class="text-xs text-amber-600 mt-1">⚠️ ${track.anomaly_descriptions}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-sm text-gray-600">${track.instrument || '-'}</td>
        <td class="px-4 py-3">
          <div class="text-sm text-gray-800">${track.page_count || '-'} 页</div>
          ${track.start_page ? `<div class="text-xs text-gray-400">${track.start_page} - ${track.end_page}</div>` : ''}
          ${calculated !== track.page_count && calculated !== '-' ? `<div class="text-xs text-amber-600">计算: ${calculated}页</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <span class="status-badge ${statusClass}">${statusText}</span>
          ${track.validation_status === 'reviewed' ? `<span class="status-badge status-info ml-1">已复核</span>` : ''}
        </td>
        <td class="px-4 py-3 text-sm text-gray-500">${track.file_name || '-'}</td>
        <td class="px-4 py-3">
          <button onclick="openTrackDetail(${track.id})" class="text-blue-600 hover:text-blue-800 text-sm">
            查看详情
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAnomalies(anomalies) {
  const container = document.getElementById('anomalies-container');
  
  if (anomalies.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl p-8 text-center">
        <div class="text-4xl mb-2">✅</div>
        <p class="text-gray-500">暂无异常记录</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = anomalies.map(a => {
    const sevClass = a.severity === 'warning' ? 'status-warning' : a.severity === 'error' ? 'status-error' : 'status-info';
    return `
      <div class="bg-white rounded-xl p-5 ${a.resolved ? 'opacity-60' : ''}">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <div class="text-xl">${a.resolved ? '✅' : '⚠️'}</div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-800">${a.anomaly_type}</span>
                <span class="status-badge ${sevClass}">${a.severity}</span>
              </div>
              <p class="text-sm text-gray-600 mt-1">${a.description}</p>
              <div class="text-xs text-gray-400 mt-2">
                曲目: ${a.track_name} | 文件: ${a.file_name}
              </div>
              ${a.suggestion ? `<div class="mt-2 text-sm text-blue-600">💡 建议: ${a.suggestion}</div>` : ''}
              ${a.evidence ? `<div class="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">证据: ${a.evidence}</div>` : ''}
            </div>
          </div>
          ${!a.resolved ? `
            <button onclick="resolveAnomaly(${a.id})" class="text-sm text-green-600 hover:text-green-800">
              标记已解决
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderNotes(notes) {
  const container = document.getElementById('notes-container');
  
  if (notes.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl p-8 text-center">
        <div class="text-4xl mb-2">📝</div>
        <p class="text-gray-500">暂无备注记录</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = notes.map(n => `
    <div class="bg-white rounded-xl p-5">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="text-gray-800">${n.content}</p>
          <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>👤 ${n.author}</span>
            <span>📅 ${new Date(n.created_at).toLocaleString('zh-CN')}</span>
            ${n.track_name ? `<span>🎵 ${n.track_name}</span>` : ''}
          </div>
        </div>
        <button onclick="deleteNote(${n.id})" class="text-gray-400 hover:text-red-500 ml-4">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

async function loadConflicts() {
  try {
    const res = await fetch(`${API_BASE}/validation/batch/${currentBatchId}/conflicts`);
    const conflicts = await res.json();
    renderConflicts(conflicts);
  } catch (e) {
    console.error(e);
  }
}

function renderConflicts(conflicts) {
  const container = document.getElementById('conflicts-container');
  
  if (!conflicts || conflicts.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl p-8 text-center">
        <div class="text-4xl mb-2">🤝</div>
        <p class="text-gray-500">暂无数据冲突</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = conflicts.map(c => `
    <div class="bg-white rounded-xl p-5 ${c.resolved ? 'opacity-60' : ''}">
      <div class="flex items-start gap-3">
        <div class="text-xl">⚔️</div>
        <div class="flex-1">
          <div class="font-medium text-gray-800">${c.field_name} 数据冲突</div>
          <div class="text-sm text-gray-500 mt-1">曲目: ${c.track_name}</div>
          
          <div class="grid grid-cols-2 gap-4 mt-3">
            <div class="bg-blue-50 p-3 rounded-lg">
              <div class="text-xs text-blue-600 font-medium">${c.source_a}</div>
              <div class="text-sm text-gray-800 mt-1">${c.value_a}</div>
            </div>
            <div class="bg-orange-50 p-3 rounded-lg">
              <div class="text-xs text-orange-600 font-medium">${c.source_b}</div>
              <div class="text-sm text-gray-800 mt-1">${c.value_b}</div>
            </div>
          </div>
          
          ${c.suggestion ? `<div class="mt-3 text-sm text-green-600">💡 建议: ${c.suggestion}</div>` : ''}
          
          ${!c.resolved ? `
            <div class="mt-3 flex gap-2">
              <button onclick="resolveConflict(${c.id}, '${c.source_a}')" class="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                采纳A
              </button>
              <button onclick="resolveConflict(${c.id}, '${c.source_b}')" class="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
                采纳B
              </button>
              <button onclick="resolveConflict(${c.id}, '手动处理')" class="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                手动处理
              </button>
            </div>
          ` : `<div class="mt-3 text-sm text-gray-500">✓ 已解决: ${c.resolution}</div>`}
        </div>
      </div>
    </div>
  `).join('');
}

function switchTab(tab) {
  ['tracks', 'anomalies', 'conflicts', 'notes'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.remove('border-b-2', 'border-blue-600', 'text-blue-600', 'font-medium');
    document.getElementById(`tab-${t}`).classList.add('text-gray-500');
    document.getElementById(`${t}-panel`).classList.add('hidden');
  });
  
  document.getElementById(`tab-${tab}`).classList.add('border-b-2', 'border-blue-600', 'text-blue-600', 'font-medium');
  document.getElementById(`tab-${tab}`).classList.remove('text-gray-500');
  document.getElementById(`${tab}-panel`).classList.remove('hidden');
}

function setupFileUpload() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500', 'bg-blue-50');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    handleFiles(e.dataTransfer.files);
  });
  
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
}

function handleFiles(files) {
  selectedFiles = Array.from(files);
  renderSelectedFiles();
}

function renderSelectedFiles() {
  const container = document.getElementById('selected-files');
  
  if (selectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = selectedFiles.map((f, i) => `
    <div class="flex items-center justify-between bg-gray-50 p-2 rounded">
      <div class="flex items-center gap-2">
        <span>📄</span>
        <span class="text-sm text-gray-700">${f.name}</span>
        <span class="text-xs text-gray-400">(${(f.size / 1024).toFixed(1)} KB)</span>
      </div>
      <button onclick="removeFile(${i})" class="text-gray-400 hover:text-red-500">&times;</button>
    </div>
  `).join('');
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
}

function showImportModal() {
  document.getElementById('import-modal').classList.remove('hidden');
  selectedFiles = [];
  renderSelectedFiles();
  document.getElementById('batch-name').value = '';
}

function hideImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
}

async function startImport() {
  if (selectedFiles.length === 0) {
    showToast('请先选择文件');
    return;
  }
  
  const btn = document.getElementById('import-btn');
  btn.innerHTML = '<span class="loading"></span> 导入中...';
  btn.disabled = true;
  
  const formData = new FormData();
  formData.append('batchName', document.getElementById('batch-name').value || '未命名批次');
  selectedFiles.forEach(f => formData.append('files', f));
  
  try {
    const res = await fetch(`${API_BASE}/upload/batch`, {
      method: 'POST',
      body: formData
    });
    
    const result = await res.json();
    
    if (result.success) {
      showToast(`导入成功！处理了 ${result.processedFiles} 个文件，共 ${result.results.reduce((a, b) => a + b.trackCount, 0)} 条曲目`);
      hideImportModal();
      loadBatches();
      
      if (result.batchId) {
        setTimeout(() => openBatch(result.batchId), 500);
      }
    } else {
      showToast('导入失败: ' + (result.error || '未知错误'));
    }
  } catch (e) {
    console.error(e);
    showToast('导入失败');
  } finally {
    btn.innerHTML = '开始导入';
    btn.disabled = false;
  }
}

async function openTrackDetail(trackId) {
  try {
    const res = await fetch(`${API_BASE}/validation/track/${trackId}`);
    const data = await res.json();
    
    document.getElementById('track-modal-title').textContent = data.track.track_name;
    document.getElementById('track-detail-content').innerHTML = renderTrackDetailContent(data, trackId);
    document.getElementById('track-modal').classList.remove('hidden');
  } catch (e) {
    console.error(e);
    showToast('加载详情失败');
  }
}

function renderTrackDetailContent(data, trackId) {
  const track = data.track;
  const calculated = track.start_page && track.end_page ? track.end_page - track.start_page + 1 : '-';
  
  return `
    <div class="space-y-6">
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-xs text-gray-500">序号</div>
          <div class="text-lg font-medium">${track.track_number}</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-xs text-gray-500">乐器</div>
          <div class="text-lg font-medium">${track.instrument || '-'}</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-xs text-gray-500">标注页数</div>
          <div class="text-lg font-medium">${track.page_count || '-'} 页</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg ${calculated !== track.page_count && calculated !== '-' ? 'bg-amber-50' : ''}">
          <div class="text-xs text-gray-500">计算页数</div>
          <div class="text-lg font-medium ${calculated !== track.page_count && calculated !== '-' ? 'text-amber-600' : ''}">${calculated} 页</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-xs text-gray-500">起始页</div>
          <div class="text-lg font-medium">${track.start_page || '-'}</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-xs text-gray-500">结束页</div>
          <div class="text-lg font-medium">${track.end_page || '-'}</div>
        </div>
      </div>
      
      <div class="bg-gray-50 p-4 rounded-lg">
        <div class="text-xs text-gray-500 mb-2">来源文件</div>
        <div class="font-medium">${track.file_name || '-'}</div>
      </div>
      
      ${data.anomalies.length > 0 ? `
        <div>
          <h4 class="font-medium text-gray-800 mb-3">异常记录</h4>
          <div class="space-y-3">
            ${data.anomalies.map(a => `
              <div class="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div class="flex items-center gap-2">
                  <span>⚠️</span>
                  <span class="font-medium">${a.anomaly_type}</span>
                  <span class="status-badge status-warning">${a.severity}</span>
                </div>
                <p class="text-sm text-gray-600 mt-2">${a.description}</p>
                ${a.suggestion ? `<p class="text-sm text-blue-600 mt-2">💡 建议: ${a.suggestion}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div>
        <h4 class="font-medium text-gray-800 mb-3">备注</h4>
        ${data.notes.length > 0 ? `
          <div class="space-y-2 mb-4">
            ${data.notes.map(n => `
              <div class="bg-blue-50 p-3 rounded-lg">
                <p class="text-sm">${n.content}</p>
                <p class="text-xs text-gray-500 mt-1">${n.author} · ${new Date(n.created_at).toLocaleString('zh-CN')}</p>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-sm text-gray-500 mb-4">暂无备注</p>'}
        
        <div class="flex gap-2">
          <input type="text" id="new-note-input" class="flex-1 px-3 py-2 border rounded-lg" placeholder="添加备注...">
          <button onclick="addNoteToTrack(${trackId})" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            添加
          </button>
        </div>
      </div>
      
      <div class="flex gap-3 pt-4 border-t">
        <button onclick="validateTrack(${trackId}, 'reviewed')" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          ✓ 标记已复核
        </button>
        <button onclick="validateTrack(${trackId}, 'passed')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">
          标记通过
        </button>
        <button onclick="addConflict(${trackId})" class="px-4 py-2 border rounded-lg hover:bg-gray-50">
          ⚔️ 记录数据冲突
        </button>
      </div>
    </div>
  `;
}

async function addNoteToTrack(trackId) {
  const input = document.getElementById('new-note-input');
  const content = input.value.trim();
  
  if (!content) {
    showToast('请输入备注内容');
    return;
  }
  
  try {
    await fetch(`${API_BASE}/notes/track/${trackId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author: '小温' })
    });
    
    showToast('备注已添加');
    openTrackDetail(trackId);
    openBatch(currentBatchId);
  } catch (e) {
    showToast('添加失败');
  }
}

async function validateTrack(trackId, status) {
  try {
    await fetch(`${API_BASE}/validation/track/${trackId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    
    showToast('状态已更新');
    hideTrackModal();
    openBatch(currentBatchId);
  } catch (e) {
    showToast('更新失败');
  }
}

async function resolveAnomaly(anomalyId) {
  try {
    await fetch(`${API_BASE}/validation/anomaly/${anomalyId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true })
    });
    
    showToast('已标记解决');
    openBatch(currentBatchId);
  } catch (e) {
    showToast('操作失败');
  }
}

async function resolveConflict(conflictId, resolution) {
  try {
    await fetch(`${API_BASE}/validation/conflict/${conflictId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution })
    });
    
    showToast('冲突已解决');
    loadConflicts();
  } catch (e) {
    showToast('操作失败');
  }
}

async function deleteNote(noteId) {
  if (!confirm('确定删除这条备注吗？')) return;
  
  try {
    await fetch(`${API_BASE}/notes/${noteId}`, { method: 'DELETE' });
    showToast('已删除');
    openBatch(currentBatchId);
  } catch (e) {
    showToast('删除失败');
  }
}

function addConflict(trackId) {
  const fieldName = prompt('冲突字段名称（例如：页码数）:');
  if (!fieldName) return;
  
  const sourceA = prompt('来源A（例如：文件夹命名）:');
  if (!sourceA) return;
  
  const valueA = prompt('来源A的值:');
  if (!valueA) return;
  
  const sourceB = prompt('来源B（例如：导入数据）:');
  if (!sourceB) return;
  
  const valueB = prompt('来源B的值:');
  if (!valueB) return;
  
  const suggestion = prompt('建议动作（可选）:');
  
  fetch(`${API_BASE}/validation/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackId, fieldName, sourceA, valueA, sourceB, valueB, suggestion })
  }).then(() => {
    showToast('冲突已记录');
    hideTrackModal();
    openBatch(currentBatchId);
    switchTab('conflicts');
  });
}

function exportExcel() {
  window.open(`${API_BASE}/export/batch/${currentBatchId}/excel`);
}

function exportCSV() {
  window.open(`${API_BASE}/export/batch/${currentBatchId}/csv`);
}

async function showReport() {
  try {
    const res = await fetch(`${API_BASE}/export/batch/${currentBatchId}/report`);
    const report = await res.json();
    
    const content = generateReportContent(report);
    document.getElementById('report-content').innerHTML = content;
    document.getElementById('report-modal').classList.remove('hidden');
  } catch (e) {
    showToast('生成报告失败');
  }
}

function generateReportContent(report) {
  const { batch, stats, anomalies, notes, generatedAt } = report;
  
  return `
    <div class="border-b pb-4">
      <h2 class="text-xl font-bold">${batch.name}</h2>
      <p class="text-gray-500 text-sm">报告生成时间: ${generatedAt}</p>
    </div>
    
    <div>
      <h3 class="font-medium text-gray-800 mb-3">一、总体情况</h3>
      <div class="bg-gray-50 p-4 rounded-lg">
        <p class="mb-2">本次共校验 <strong>${stats.total_tracks}</strong> 条曲目，其中：</p>
        <ul class="list-disc list-inside text-sm space-y-1">
          <li class="text-green-600">${stats.valid_tracks} 条曲目页码校验正常</li>
          <li class="text-amber-600">${stats.invalid_tracks} 条曲目存在异常，需要人工复核</li>
        </ul>
      </div>
    </div>
    
    ${anomalies.length > 0 ? `
      <div>
        <h3 class="font-medium text-gray-800 mb-3">二、待处理异常清单</h3>
        <div class="space-y-3">
          ${anomalies.map((a, i) => `
            <div class="border-l-4 border-amber-400 pl-4 py-2">
              <div class="font-medium">${i + 1}. ${a.track_name}（第${a.track_number}条）</div>
              <div class="text-sm text-gray-600 mt-1">问题类型：${a.anomaly_type}</div>
              <div class="text-sm text-gray-600">问题描述：${a.description}</div>
              <div class="text-sm text-gray-500 mt-1">证据：${a.evidence || '无'}</div>
              ${a.suggestion ? `<div class="text-sm text-blue-600 mt-1">💡 ${a.suggestion}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${notes.length > 0 ? `
      <div>
        <h3 class="font-medium text-gray-800 mb-3">三、备注记录</h3>
        <div class="space-y-2">
          ${notes.map(n => `
            <div class="bg-blue-50 p-3 rounded-lg">
              <p class="text-sm">"${n.content}"</p>
              <p class="text-xs text-gray-500 mt-1">— ${n.author}，${new Date(n.created_at).toLocaleString('zh-CN')}</p>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div class="bg-green-50 p-4 rounded-lg">
      <h3 class="font-medium text-green-800 mb-2">四、给同事的话</h3>
      <p class="text-sm text-green-700">
        ${stats.invalid_tracks === 0 
          ? '🎉 这批乐谱页码全部校验通过，可以放心给演出或发行同事使用啦！' 
          : `还有 ${stats.invalid_tracks} 条需要确认一下。我已经把问题都列出来了，麻烦帮忙核对下原始乐谱，确认后记得标记"已复核"哦～`
        }
      </p>
      <p class="text-sm text-green-600 mt-2">
        —— 琴房前台 小温
      </p>
    </div>
  `;
}

function hideTrackModal() {
  document.getElementById('track-modal').classList.add('hidden');
}

function hideReportModal() {
  document.getElementById('report-modal').classList.add('hidden');
}

function copyReport() {
  const content = document.getElementById('report-content').innerText;
  navigator.clipboard.writeText(content).then(() => {
    showToast('报告已复制到剪贴板');
  });
}
