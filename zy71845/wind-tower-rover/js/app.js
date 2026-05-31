import { initScene, updateScene, setSelectedPoint } from './scene.js';
import {
  importPoints, importModels, importInspections, putPhoto,
  getAllPoints, getAllModels, getAllInspections,
  getPoint, getInspectionsByPoint, putPoint,
  getFullEvidenceChain, clearAll
} from './store.js';
import { runAutoJudge, formatJudgeResult } from './judge.js';
import {
  recordImport, recordJudge, recordCorrection,
  recordConfirm, getFilteredHistory,
  exportJSON, exportCSV, exportReport
} from './workflow.js';

let currentTab = 'import';
let selectedPointId = null;

const sampleData = {
  points: [
    { id: 'P001', name: 'WTG-A01', x: 0, z: 0, elevation: 85.5, type: 'turbine', linkedModelId: 'M001', linkedInspectionIds: ['I001'], status: 'pending' },
    { id: 'P002', name: 'WTG-A02', x: 500, z: 100, elevation: 82.3, type: 'turbine', linkedModelId: 'M002', linkedInspectionIds: ['I002'], status: 'pending' },
    { id: 'P003', name: 'WTG-B01', x: 250, z: 430, elevation: 91.2, type: 'turbine', linkedModelId: 'M001', status: 'pending' },
    { id: 'P004', name: 'WTG-B02', x: 750, z: 430, elevation: 88.7, type: 'turbine', linkedModelId: 'M003', status: 'pending' },
    { id: 'P005', name: 'WTG-C01', x: 0, z: 860, elevation: 79.4, type: 'turbine', status: 'pending' },
    { id: 'P006', name: 'WTG-C02', x: 500, z: 860, elevation: 83.1, type: 'turbine', linkedModelId: 'M002', linkedInspectionIds: ['I003'], status: 'pending' },
    { id: 'P007', name: 'WTG-A01-dup', x: 0, z: 0, elevation: 85.5, type: 'turbine', linkedModelId: 'M001', status: 'pending' },
    { id: 'P008', name: 'WTG-D01', x: 1200, z: 1200, elevation: 76.2, type: 'turbine', status: 'pending' }
  ],
  models: [
    { id: 'M001', name: 'Vestas V90-2.0MW', hubHeight: 80, rotorDiameter: 90, ratedPower: 2000 },
    { id: 'M002', name: 'Goldwind GW121-2.5MW', hubHeight: 90, rotorDiameter: 121, ratedPower: 2500 },
    { id: 'M003', name: 'Envision EN-136/4.2', hubHeight: 100, rotorDiameter: 136, ratedPower: 4200 }
  ],
  inspections: [
    { id: 'I001', pointId: 'P001', date: '2024-03-15', result: 'pass', findings: '塔筒外观正常，无锈蚀', inspector: '张工', photoFiles: ['tower_base_01.jpg'] },
    { id: 'I002', pointId: 'P002', date: '2024-03-16', result: 'pass', findings: '正常', inspector: '李工', photoFiles: ['tower_base_01.jpg'] },
    { id: 'I003', pointId: 'P006', date: '2024-03-18', result: 'warning', findings: '塔筒底部轻微锈蚀', inspector: '张工', photoFiles: ['blade_tip_01.jpg', 'nacelle_02.jpg'] },
    { id: 'I004', pointId: 'P005', date: '2024-03-19', result: 'fail', findings: '叶片裂纹需更换', inspector: '王工', photoFiles: ['blade_crack_01.jpg'] }
  ]
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function logMessage(msg, type = '') {
  const log = $('#import-log');
  const cls = type === 'ok' ? 'log-ok' : type === 'warn' ? 'log-warn' : type === 'err' ? 'log-err' : '';
  log.innerHTML += `<span class="${cls}">${msg}</span>\n`;
  log.scrollTop = log.scrollHeight;
}

async function refreshHeaderCounts() {
  const points = await getAllPoints();
  const models = await getAllModels();
  const inspections = await getAllInspections();
  const flagged = points.filter(p => p.flags && !p.flags.includes('ok'));
  $('#point-count').textContent = `点位: ${points.length}`;
  $('#model-count').textContent = `模型: ${models.length}`;
  $('#inspection-count').textContent = `巡检: ${inspections.length}`;
  $('#flag-count').textContent = `待处理: ${flagged.length}`;
}

async function refreshScene() {
  const points = await getAllPoints();
  const models = await getAllModels();
  updateScene(points, models);
}

function switchTab(tab) {
  currentTab = tab;
  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  $$('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
  });
  if (tab === 'review') refreshReviewList();
  if (tab === 'history') refreshHistoryList();
  if (tab === 'correct' && selectedPointId) loadCorrectForm(selectedPointId);
}

async function handleImportCAD(file) {
  try {
    const text = await file.text();
    let data;
    if (file.name.endsWith('.json')) {
      data = JSON.parse(text);
    } else {
      data = parseCSV(text);
    }
    if (!Array.isArray(data)) data = [data];
    const count = await importPoints(data);
    logMessage(`✓ 导入CAD点位 ${count} 条 (${file.name})`, 'ok');
    await recordImport('CAD点位', count, file.name);
    toast(`成功导入 ${count} 个CAD点位`, 'success');
    await refreshScene();
    await refreshHeaderCounts();
  } catch (e) {
    logMessage(`✗ 导入CAD点位失败: ${e.message}`, 'err');
    toast(`导入失败: ${e.message}`, 'error');
  }
}

async function handleImportModel(file) {
  try {
    const text = await file.text();
    let data;
    if (file.name.endsWith('.json')) {
      data = JSON.parse(text);
    } else {
      data = parseCSV(text);
    }
    if (!Array.isArray(data)) data = [data];
    const count = await importModels(data);
    logMessage(`✓ 导入模型清单 ${count} 条 (${file.name})`, 'ok');
    await recordImport('模型清单', count, file.name);
    toast(`成功导入 ${count} 个模型`, 'success');
    await refreshScene();
    await refreshHeaderCounts();
  } catch (e) {
    logMessage(`✗ 导入模型清单失败: ${e.message}`, 'err');
    toast(`导入失败: ${e.message}`, 'error');
  }
}

async function handleImportInspection(file) {
  try {
    if (file.type.startsWith('image/')) {
      const photoId = `PHOTO_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const dataUrl = await readFileAsDataURL(file);
      await putPhoto({
        id: photoId,
        name: file.name,
        data: dataUrl,
        hash: await simpleHashForFile(file),
        inspectionId: null,
        uploadedAt: new Date().toISOString()
      });
      logMessage(`✓ 导入照片 ${file.name} (ID: ${photoId})，请在修正页关联到巡检记录`, 'ok');
      toast(`照片已导入，需在修正页关联`, 'success');
      await refreshHeaderCounts();
      return;
    }

    const text = await file.text();
    let data;
    if (file.name.endsWith('.json')) {
      data = JSON.parse(text);
    } else {
      data = parseCSV(text);
    }
    if (!Array.isArray(data)) data = [data];
    const count = await importInspections(data);
    logMessage(`✓ 导入巡检记录 ${count} 条 (${file.name})`, 'ok');
    await recordImport('巡检记录', count, file.name);
    toast(`成功导入 ${count} 条巡检记录`, 'success');
    await refreshScene();
    await refreshHeaderCounts();
  } catch (e) {
    logMessage(`✗ 导入巡检记录失败: ${e.message}`, 'err');
    toast(`导入失败: ${e.message}`, 'error');
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      const v = values[i] || '';
      obj[h] = isNaN(v) || v === '' ? v : Number(v);
    });
    return obj;
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function simpleHashForFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let hash = 0;
  const step = Math.max(1, Math.floor(bytes.length / 1000));
  for (let i = 0; i < bytes.length; i += step) {
    hash = ((hash << 5) - hash) + bytes[i];
    hash = hash & hash;
  }
  return hash.toString(16);
}

async function loadSampleData() {
  try {
    const pointCount = await importPoints(sampleData.points);
    logMessage(`✓ 加载示例CAD点位 ${pointCount} 条`, 'ok');

    const modelCount = await importModels(sampleData.models);
    logMessage(`✓ 加载示例模型 ${modelCount} 条`, 'ok');

    const inspCount = await importInspections(sampleData.inspections);
    logMessage(`✓ 加载示例巡检记录 ${inspCount} 条`, 'ok');

    await recordImport('示例数据', pointCount + modelCount + inspCount, '全部示例数据');

    logMessage('', '');
    logMessage('--- 数据说明 ---', 'warn');
    logMessage('P001: 正常点位，有模型和巡检（照片名与P002重复）', 'warn');
    logMessage('P002: 有模型和巡检，照片名与P001相同 → 触发重复照片判断', 'warn');
    logMessage('P003: 有模型，无巡检 → 触发未巡检判断', 'warn');
    logMessage('P004: 有模型，无巡检 → 触发未巡检判断', 'warn');
    logMessage('P005: 无模型，有巡检(fail) → 触发缺模型判断', 'warn');
    logMessage('P006: 正常点位，有模型和巡检(warning)', 'warn');
    logMessage('P007: 与P001坐标完全相同 → 触发点位重叠判断', 'warn');
    logMessage('P008: 位于边界，无模型无巡检 → 多重标记', 'warn');

    toast('示例数据加载完成，请到复核页执行自动判断', 'success');
    await refreshScene();
    await refreshHeaderCounts();
  } catch (e) {
    logMessage(`✗ 加载示例数据失败: ${e.message}`, 'err');
    toast(`加载失败: ${e.message}`, 'error');
  }
}

async function handleClearAll() {
  if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) return;
  await clearAll();
  logMessage('✓ 所有数据已清空', 'ok');
  toast('数据已清空', 'info');
  selectedPointId = null;
  await refreshScene();
  await refreshHeaderCounts();
  $('#review-list').innerHTML = '';
  $('#history-list').innerHTML = '';
}

async function handleRunJudge() {
  const points = await getAllPoints();
  if (points.length === 0) {
    toast('请先导入数据再执行自动判断', 'warning');
    return;
  }
  try {
    toast('正在执行自动判断...', 'info');
    const results = await runAutoJudge();
    await recordJudge(results);
    const formatted = formatJudgeResult(results);
    showJudgePanel(formatted);
    toast(`自动判断完成，${results.filter(r => !r.flags.includes('ok')).length} 个点位有标记`, 'success');
    await refreshScene();
    await refreshHeaderCounts();
    refreshReviewList();
  } catch (e) {
    toast(`自动判断失败: ${e.message}`, 'error');
  }
}

function showJudgePanel(content) {
  const panel = $('#judge-panel');
  const contentEl = $('#judge-content');
  contentEl.textContent = content;
  panel.style.display = 'block';
}

async function refreshReviewList() {
  const points = await getAllPoints();
  const models = await getAllModels();
  const modelMap = new Map(models.map(m => [m.id, m]));
  const filter = $('#review-filter').value;

  let filtered = points;
  if (filter !== 'all') {
    if (filter === 'ok') {
      filtered = points.filter(p => p.flags && p.flags.includes('ok') && p.flags.length === 1);
    } else if (filter === 'flagged') {
      filtered = points.filter(p => p.flags && !p.flags.includes('ok'));
    } else {
      filtered = points.filter(p => p.flags && p.flags.includes(filter));
    }
  }

  const list = $('#review-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-hint">无匹配点位</div>';
    return;
  }

  list.innerHTML = filtered.map(p => {
    const model = p.linkedModelId ? modelMap.get(p.linkedModelId) : null;
    const modelName = model ? model.name : '未关联';
    const flags = (p.flags || []).map(f => {
      const texts = {
        ok: '正常', 'no-model': '缺模型', 'no-inspection': '未巡检',
        'duplicate-photo': '重复照片', boundary: '边界', overlap: '点位重叠'
      };
      return `<span class="flag-tag ${f}">${texts[f] || f}</span>`;
    }).join('');

    const reasons = (p.judgeReasons || []).map((r, i) =>
      `<div class="review-card-reason">
        <span class="reason-label">判断理由:</span> ${r}<br>
        <span style="color:var(--accent)">下一步:</span> ${(p.judgeNextSteps || [])[i] || ''}
      </div>`
    ).join('');

    const confirmText = p.confirmStatus === 'confirmed' ? '✓ 已确认' : p.confirmStatus === 'rejected' ? '✗ 已驳回' : '待确认';
    const confirmColor = p.confirmStatus === 'confirmed' ? 'var(--success)' : p.confirmStatus === 'rejected' ? 'var(--danger)' : 'var(--fg-muted)';

    return `<div class="review-card ${selectedPointId === p.id ? 'selected' : ''}" data-point-id="${p.id}">
      <div class="review-card-header">
        <span class="review-card-title">${p.name}</span>
        <div class="review-card-flags">${flags}</div>
      </div>
      <div class="review-card-info">
        ID: ${p.id} | 坐标: (${p.x}, ${p.z}) | 高程: ${p.elevation}m | 模型: ${modelName}
        <br>确认状态: <span style="color:${confirmColor}">${confirmText}</span>
      </div>
      ${reasons}
    </div>`;
  }).join('');

  list.querySelectorAll('.review-card').forEach(card => {
    card.addEventListener('click', () => {
      const pointId = card.dataset.pointId;
      selectedPointId = pointId;
      setSelectedPoint(pointId);
      refreshReviewList();
    });
  });
}

async function loadCorrectForm(pointId) {
  const point = await getPoint(pointId);
  if (!point) {
    $('#correct-empty').style.display = 'block';
    $('#correct-form').style.display = 'none';
    return;
  }

  $('#correct-empty').style.display = 'none';
  $('#correct-form').style.display = 'block';
  $('#correct-point-title').textContent = `修正点位: ${point.name} (${point.id})`;
  $('#correct-id').value = point.id;
  $('#correct-name').value = point.name || '';
  $('#correct-x').value = point.x;
  $('#correct-z').value = point.z;
  $('#correct-elevation').value = point.elevation;
  $('#correct-confirm-status').value = point.confirmStatus || 'pending';
  $('#correct-reason').value = '';

  const models = await getAllModels();
  const modelSelect = $('#correct-model');
  modelSelect.innerHTML = '<option value="">-- 未关联 --</option>' +
    models.map(m => `<option value="${m.id}" ${point.linkedModelId === m.id ? 'selected' : ''}>${m.name}</option>`).join('');

  const inspections = await getInspectionsByPoint(pointId);
  const inspContainer = $('#correct-inspections');
  if (inspections.length === 0) {
    inspContainer.innerHTML = '<div style="color:var(--fg-muted);font-size:12px">暂无巡检记录</div>';
  } else {
    inspContainer.innerHTML = inspections.map(insp => {
      const resultText = insp.result === 'pass' ? '通过' : insp.result === 'fail' ? '不合格' : insp.result === 'warning' ? '警告' : '待检';
      return `<div class="inspection-card">
        <div class="inspection-card-header">
          <span>${insp.id} | ${insp.date} | ${insp.inspector || '未知'}</span>
          <span class="inspection-result ${insp.result}">${resultText}</span>
        </div>
        <div style="font-size:12px;color:var(--fg-muted)">${insp.findings || '无描述'}</div>
        ${renderPhotoList(insp.photoFiles || [])}
      </div>`;
    }).join('');
  }
}

function renderPhotoList(photoFiles) {
  if (!photoFiles || photoFiles.length === 0) return '';
  return `<div class="photo-gallery">${photoFiles.map(name =>
    `<span style="font-size:11px;padding:2px 6px;background:var(--bg-tertiary);border-radius:3px;border:1px solid var(--border)">${name}</span>`
  ).join('')}</div>`;
}

async function handleSaveCorrect() {
  const pointId = $('#correct-id').value;
  const reason = $('#correct-reason').value.trim();

  if (!reason) {
    toast('修正说明不能为空，请填写修正原因和下一步操作', 'warning');
    return;
  }

  const point = await getPoint(pointId);
  if (!point) {
    toast('点位不存在', 'error');
    return;
  }

  const changes = {};
  if (point.name !== $('#correct-name').value) changes.name = { from: point.name, to: $('#correct-name').value };
  if (point.x !== Number($('#correct-x').value)) changes.x = { from: point.x, to: Number($('#correct-x').value) };
  if (point.z !== Number($('#correct-z').value)) changes.z = { from: point.z, to: Number($('#correct-z').value) };
  if (point.elevation !== Number($('#correct-elevation').value)) changes.elevation = { from: point.elevation, to: Number($('#correct-elevation').value) };

  const newModelId = $('#correct-model').value || null;
  if (point.linkedModelId !== newModelId) changes.linkedModelId = { from: point.linkedModelId, to: newModelId };

  const newConfirmStatus = $('#correct-confirm-status').value;
  if (point.confirmStatus !== newConfirmStatus) changes.confirmStatus = { from: point.confirmStatus, to: newConfirmStatus };

  const updatedPoint = {
    ...point,
    name: $('#correct-name').value,
    x: Number($('#correct-x').value),
    z: Number($('#correct-z').value),
    elevation: Number($('#correct-elevation').value),
    linkedModelId: newModelId,
    confirmStatus: newConfirmStatus,
    correctedAt: new Date().toISOString()
  };

  await putPoint(updatedPoint);

  if (newConfirmStatus !== 'pending' && newConfirmStatus !== point.confirmStatus) {
    try {
      await recordConfirm(pointId, newConfirmStatus, reason);
    } catch (e) { /* already recorded via correction */ }
  }

  await recordCorrection(pointId, changes, reason, '修正已保存并写入历史记录');

  toast('修正已保存', 'success');
  await refreshScene();
  await refreshHeaderCounts();
  if (currentTab === 'review') refreshReviewList();
}

async function refreshHistoryList() {
  const filterAction = $('#history-filter').value;
  const search = $('#history-search').value;
  const records = await getFilteredHistory({ action: filterAction, search });

  const list = $('#history-list');
  if (records.length === 0) {
    list.innerHTML = '<div class="empty-hint">暂无操作记录</div>';
    return;
  }

  const actionTexts = {
    import: '导入', auto_judge: '自动判断', manual_confirm: '人工确认',
    correct: '修正', export: '导出'
  };

  list.innerHTML = records.map(r => {
    const time = new Date(r.timestamp).toLocaleString('zh-CN');
    const actionText = actionTexts[r.action] || r.action;
    return `<div class="history-item">
      <div class="history-item-header">
        <span class="history-action ${r.action}">${actionText}</span>
        <span style="color:var(--fg-muted)">${time}</span>
      </div>
      <div>点位: ${r.pointId} | 操作者: ${r.operator === 'system' ? '系统' : '用户'}</div>
      <div class="history-item-reason">${r.reason}</div>
      ${r.nextStep ? `<div class="history-item-next">→ ${r.nextStep}</div>` : ''}
    </div>`;
  }).join('');
}

async function handleExportJSON() {
  const includePhotos = $('#export-include-photos').checked;
  const includeHistory = $('#export-include-history').checked;
  try {
    const data = await exportJSON(includePhotos, includeHistory);
    const preview = $('#export-preview');
    preview.textContent = `✓ 已导出 JSON 文件\n点位: ${data.points.length}\n模型: ${data.models.length}\n巡检: ${data.inspections.length}\n操作记录: ${data.workflow.length}\n照片: ${data.photos.length}`;
    toast('JSON 导出成功', 'success');
  } catch (e) {
    toast(`导出失败: ${e.message}`, 'error');
  }
}

async function handleExportCSV() {
  try {
    await exportCSV();
    const preview = $('#export-preview');
    preview.textContent = '✓ CSV 文件已导出';
    toast('CSV 导出成功', 'success');
  } catch (e) {
    toast(`导出失败: ${e.message}`, 'error');
  }
}

async function handleExportReport() {
  try {
    await exportReport();
    const preview = $('#export-preview');
    preview.textContent = '✓ 判断报告已导出（含判断理由、下一步操作和建议顺序）';
    toast('判断报告导出成功', 'success');
  } catch (e) {
    toast(`导出失败: ${e.message}`, 'error');
  }
}

function bindEvents() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  $('#import-cad').addEventListener('change', (e) => {
    for (const file of e.target.files) handleImportCAD(file);
    e.target.value = '';
  });

  $('#import-model').addEventListener('change', (e) => {
    for (const file of e.target.files) handleImportModel(file);
    e.target.value = '';
  });

  $('#import-inspection').addEventListener('change', (e) => {
    for (const file of e.target.files) handleImportInspection(file);
    e.target.value = '';
  });

  $('#btn-load-sample-cad').addEventListener('click', async () => {
    const count = await importPoints(sampleData.points);
    logMessage(`✓ 加载示例CAD点位 ${count} 条`, 'ok');
    await recordImport('CAD点位', count, '示例数据');
    await refreshScene();
    await refreshHeaderCounts();
  });

  $('#btn-load-sample-model').addEventListener('click', async () => {
    const count = await importModels(sampleData.models);
    logMessage(`✓ 加载示例模型 ${count} 条`, 'ok');
    await recordImport('模型清单', count, '示例数据');
    await refreshScene();
    await refreshHeaderCounts();
  });

  $('#btn-load-sample-inspection').addEventListener('click', async () => {
    const count = await importInspections(sampleData.inspections);
    logMessage(`✓ 加载示例巡检记录 ${count} 条`, 'ok');
    await recordImport('巡检记录', count, '示例数据');
    await refreshScene();
    await refreshHeaderCounts();
  });

  $('#btn-load-all-sample').addEventListener('click', loadSampleData);
  $('#btn-clear-all').addEventListener('click', handleClearAll);

  $('#review-filter').addEventListener('change', refreshReviewList);
  $('#btn-run-judge').addEventListener('click', handleRunJudge);
  $('#btn-close-judge').addEventListener('click', () => {
    $('#judge-panel').style.display = 'none';
  });

  $('#btn-save-correct').addEventListener('click', handleSaveCorrect);

  $('#history-filter').addEventListener('change', refreshHistoryList);
  $('#history-search').addEventListener('input', refreshHistoryList);

  $('#btn-export-json').addEventListener('click', handleExportJSON);
  $('#btn-export-csv').addEventListener('click', handleExportCSV);
  $('#btn-export-report').addEventListener('click', handleExportReport);
}

function onPointClick(pointId) {
  selectedPointId = pointId;
  switchTab('correct');
  loadCorrectForm(pointId);
}

async function init() {
  await new Promise(r => requestAnimationFrame(r));
  const canvas = $('#three-canvas');
  initScene(canvas, onPointClick);
  bindEvents();
  await refreshHeaderCounts();
  await refreshScene();
  const points = await getAllPoints();
  if (points.length > 0) {
    logMessage('检测到已有本地数据，已自动加载', 'ok');
  }
}

document.addEventListener('DOMContentLoaded', init);
