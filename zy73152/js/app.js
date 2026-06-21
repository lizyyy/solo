// ============================================================
// 海洋牧场时序回放 - 前端主逻辑（调用 FastAPI 后端）
// ============================================================

const API = '/api';

let currentRunId = 'run-2026-06-18-v3';
let currentStepId = null;
let currentRunData = null;
let correctionQueue = [];  // 待提交的修正列表
let pendingFixCoordLabId = null;
let backendOk = false;

// ============================================================
// 工具方法
// ============================================================

async function apiGet(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
  const json = await r.json();
  if (json.code !== 0) throw new Error(json.detail || json.message || 'API 错误');
  return json.data;
}

async function apiPost(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await r.json();
  if (json.code !== 0) throw new Error(json.detail || json.message || 'API 错误');
  return json.data;
}

async function apiPostForm(path, formData) {
  const r = await fetch(API + path, { method: 'POST', body: formData });
  const json = await r.json();
  if (json.code !== 0) throw new Error(json.detail || json.message || 'API 错误');
  return json.data;
}

function showLoading(text = '后端计算中...') {
  let ovl = document.getElementById('loading-overlay');
  if (!ovl) {
    ovl = document.createElement('div');
    ovl.id = 'loading-overlay';
    ovl.className = 'loading-overlay';
    ovl.innerHTML = `<div class="loading-box"><div class="loading-spinner"></div><div class="loading-text">${text}</div></div>`;
    document.body.appendChild(ovl);
  }
  ovl.classList.add('show');
}

function hideLoading() {
  const ovl = document.getElementById('loading-overlay');
  if (ovl) ovl.classList.remove('show');
}

function formatParamLabel(key) {
  const map = {
    sourceCount: '数据条数', dateRange: '日期范围', cloudThreshold: '云量阈值',
    keepPartial: '保留部分云', targetFormat: '目标格式', targetDatum: '目标基准面',
    coordIssues: '坐标问题数', model: '反演模型', resolution: '空间分辨率',
    sampleCount: '样品数量', outputVersion: '输出版本', format: '导出格式',
    includeAnomaly: '包含异常', remark: '备注', outputFile: '输出文件',
    filteredOut: '剔除数量', note: '说明', inputScenes: '输入影像',
    manualCoordFix: '人工坐标修正', lateSampleAdded: '晚到样品新增',
    lateSample: '晚到样品', sourceCount_added: '数据条数变化'
  };
  return map[key] || key;
}

function formatNameForCoord(fmt) {
  return { dms: '度分秒', decimal: '十进制度', dm: '度分' }[fmt] || fmt;
}

function deltaClass(n) {
  if (n > 0) return 'up';
  if (n < 0) return 'down';
  return '';
}

function fmtDelta(n, suffix = '') {
  if (!n && n !== 0) return '—';
  const sign = n > 0 ? '+' : '';
  return sign + n + suffix;
}

// ============================================================
// 初始化
// ============================================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindStaticEvents();
  await checkBackend();
  if (backendOk) {
    try {
      showLoading('加载跑次数据...');
      await renderRunList();
      await loadRun(currentRunId);
    } catch (e) {
      console.error(e);
      alert('加载数据失败：' + e.message);
    } finally {
      hideLoading();
    }
  } else {
    alert('⚠️ 后端服务未连接。请先启动 FastAPI 服务（详见启动说明）');
  }
}

async function checkBackend() {
  const dot = document.querySelector('.status-dot');
  const txt = document.querySelector('.status-text');
  try {
    const r = await fetch(API + '/health');
    if (r.ok) {
      backendOk = true;
      dot.className = 'status-dot ok';
      txt.textContent = '后端已连接';
      return;
    }
  } catch (e) {}
  backendOk = false;
  dot.className = 'status-dot err';
  txt.textContent = '后端未连接';
}

// ============================================================
// 事件绑定
// ============================================================

function bindStaticEvents() {
  // 顶部按钮
  document.getElementById('btn-rerun').addEventListener('click', openRerunModal);
  document.getElementById('btn-sample').addEventListener('click', openSampleModal);

  // 通用 modal 关闭
  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-close');
      document.getElementById(id).classList.remove('active');
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', () => ov.parentElement.classList.remove('active'));
  });

  // 导航卡片
  document.querySelectorAll('.nav-card').forEach(card => {
    card.addEventListener('click', () => {
      const map = {
        summary: 'summary-section',
        materials: 'material-section',
        anomaly: 'cloud-panel',
        export: 'export-section'
      };
      const nav = card.dataset.nav;
      const el = document.getElementById(map[nav]);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 清空修正
  document.getElementById('btn-clear-corrections').addEventListener('click', () => {
    correctionQueue = [];
    renderCorrectionList();
  });

  // 提交重跑
  document.getElementById('btn-submit-rerun').addEventListener('click', submitRerun);

  // 坐标修正
  document.getElementById('btn-fix-coord-ok').addEventListener('click', confirmFixCoord);

  // 阈值调整
  document.getElementById('btn-threshold').addEventListener('click', openThresholdModal);
  document.getElementById('btn-threshold-ok').addEventListener('click', confirmThreshold);

  // 上传材料
  document.getElementById('upload-form').addEventListener('submit', handleUpload);

  // 录入晚到样品
  document.getElementById('late-form').addEventListener('submit', handleAddLateLab);
}

// ============================================================
// 跑次列表 / 详情加载
// ============================================================

async function renderRunList() {
  const list = await apiGet('/runs');
  const container = document.getElementById('run-list');
  container.innerHTML = list.map(r => {
    const isActive = r.id === currentRunId;
    return `
      <div class="run-item ${isActive ? 'active' : ''}" data-run-id="${r.id}">
        <div class="run-item-name">${r.name}</div>
        <div class="run-item-meta">
          <span>⏱ ${r.date.split(' ')[0]}</span>
          <span>👤 ${r.operator}</span>
        </div>
        <div class="run-item-sum">
          <span class="run-sum-chip">📍${r.summary?.labCount || 0}</span>
          <span class="run-sum-chip">☁️${r.summary?.cloudCount || 0}</span>
          <span class="run-sum-chip">🌾${r.summary?.avgBiomass || 0}</span>
        </div>
        ${r.baseRunId ? `<div class="run-item-base">基于上一版</div>` : ''}
      </div>
    `;
  }).join('');
  container.querySelectorAll('.run-item').forEach(item => {
    item.addEventListener('click', async () => {
      currentRunId = item.dataset.runId;
      currentStepId = null;
      correctionQueue = [];
      showLoading('加载跑次详情...');
      try {
        await renderRunList();
        await loadRun(currentRunId);
      } catch (e) {
        alert(e.message);
      } finally {
        hideLoading();
      }
    });
  });
}

async function loadRun(runId) {
  currentRunData = await apiGet('/runs/' + runId);
  const summary = await apiGet('/runs/' + runId + '/summary');
  currentRunData._summary = summary;

  renderRunHeader(currentRunData, summary);
  renderSummary(summary);
  renderDiffBanner(summary);
  renderTimeline(currentRunData);
  renderStepDetail(currentRunData, null);
  renderCoordTable(currentRunData);
  renderLateAttachments(currentRunData);
  renderCloudTable(currentRunData, summary);
  updateAnomalyCount(summary);
}

// ============================================================
// 渲染：头部 + 摘要 + 差异横幅
// ============================================================

function renderRunHeader(run, sum) {
  const header = document.getElementById('run-header');
  const params = run.params || {};
  const meta = [
    ['📅', `运行时间: ${run.date}`],
    ['👤', `操作人: ${run.operator}`],
    ['📊', `状态: <span style="color:#059669">已完成</span>`],
    ['📍', `数据点: ${sum?.counts?.labs || 0}`],
    ['☁️', `云遮挡: ${sum?.counts?.clouds || 0} 景`],
    ['🎯', `云阈值: ${params.cloudThreshold || '?'}%`]
  ];
  if (run.baseRunId) meta.push(['🔗', '基于: 上一版']);
  header.innerHTML = `
    <h2>${run.name}</h2>
    <div class="run-header-meta">
      ${meta.map(([i, t]) => `<span>${i} ${t}</span>`).join('')}
    </div>
    ${run.remark ? `<div class="run-header-remark">${run.remark}</div>` : ''}
  `;
}

function renderSummary(sum) {
  const c = sum.computed;
  const b = c.biomass_result;
  const cf = c.cloud_filter;

  document.getElementById('sum-avg-bio').textContent = b.adjusted_average_biomass;
  document.getElementById('sum-total-bio').textContent = b.total_biomass;
  document.getElementById('sum-labs').textContent = b.sample_count;
  document.getElementById('sum-cloud-exc').textContent = cf.excluded_count;
  document.getElementById('sum-threshold').textContent = cf.threshold;
  document.getElementById('sum-manual').textContent = sum.counts.manual;

  document.getElementById('sum-labs-sub').textContent = `晚到 ${b.late_count} 个，人工修正 ${b.manual_fix_count} 个`;
  document.getElementById('sum-cloud-sub').textContent = `纳入 ${cf.included_count} 景`;
  document.getElementById('summary-gen-time').textContent = `生成于 ${c.generated_at}`;
}

function renderDiffBanner(sum) {
  const bn = document.getElementById('diff-banner');
  const d = sum.diffVsBase;
  if (!d) { bn.style.display = 'none'; return; }
  bn.style.display = 'flex';

  const fill = (id, delta, suffix = '') => {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof delta === 'number') {
      el.innerHTML = `<span class="${deltaClass(delta)}">${fmtDelta(delta, suffix)}</span>`;
    } else {
      el.innerHTML = delta;
    }
  };
  fill('diff-avg-bio', d.deltaAvgBiomass, '');
  fill('diff-total-bio', d.deltaTotalBiomass, '');
  fill('diff-samples', d.deltaSamples, '个');
  fill('diff-clouds', d.deltaExcludedCloud, '景');
  fill('diff-manual', `${d.manualFixCount}处`);
}

// ============================================================
// 渲染：时序 + 步骤详情
// ============================================================

function renderTimeline(run) {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = (run.steps || []).map((step, idx) => {
    const hasDiff = step.diffFromBase && Object.keys(step.diffFromBase).length > 0;
    const isActive = step.id === currentStepId;
    const hasManual = step.manualFixes && step.manualFixes.length > 0;
    const ic = step.inputs?.length || 0;
    const oc = step.outputs?.length || 0;
    let sum = '';
    if (step.paramSnapshot) {
      const k0 = Object.keys(step.paramSnapshot)[0];
      if (k0) sum = `<span>${formatParamLabel(k0)}: ${step.paramSnapshot[k0]}</span>`;
    }
    return `
      <div class="timeline-step ${hasDiff ? 'has-diff' : ''} ${isActive ? 'active' : ''}" data-step-id="${step.id}">
        <div class="timeline-dot"></div>
        <div class="timeline-step-title">
          ${idx + 1}. ${step.name}
          ${hasManual ? '<span class="manual-tag">⚠️ 人工介入</span>' : ''}
        </div>
        <div class="timeline-step-time">${step.startTime || ''} - ${step.endTime || ''}</div>
        <div class="timeline-step-summary">
          <span>📥 输入 ${ic}</span>
          <span>📤 输出 ${oc}</span>
          ${sum}
        </div>
      </div>
    `;
  }).join('');
  timeline.querySelectorAll('.timeline-step').forEach(el => {
    el.addEventListener('click', () => {
      currentStepId = el.dataset.stepId;
      renderTimeline(currentRunData);
      renderStepDetail(currentRunData, currentStepId);
    });
  });
}

function renderStepDetail(run, stepId) {
  const detail = document.getElementById('step-detail');
  if (!stepId) {
    detail.innerHTML = `
      <div class="detail-placeholder">
        <div class="placeholder-icon">👆</div>
        <p>选择上方步骤卡片查看详细信息</p>
        <p style="font-size:12px;margin-top:8px;color:#9ca3af;">
          橙色变化步骤、参数差异、人工修正都会显示在这里
        </p>
      </div>`;
    return;
  }
  const step = run.steps.find(s => s.id === stepId);
  if (!step) return;
  const hasDiff = step.diffFromBase && Object.keys(step.diffFromBase).length > 0;
  const hasManual = step.manualFixes && step.manualFixes.length > 0;

  let html = `
    <div class="detail-header"><h3>📋 ${step.name} - 详细信息</h3></div>
    <div class="detail-body">
  `;
  // 参数快照
  html += `<div class="detail-section-title">参数快照</div>`;
  if (step.paramSnapshot) {
    html += `<div class="param-grid">`;
    for (const [k, v] of Object.entries(step.paramSnapshot)) {
      const isDiff = step.diffFromBase && step.diffFromBase[k] !== undefined;
      const old = isDiff ? step.diffFromBase[k] : null;
      html += `
        <div class="param-item ${isDiff ? 'diff' : ''}">
          <div class="param-label">${formatParamLabel(k)}</div>
          <div class="param-value">${v}</div>
          ${old ? `<div class="param-diff-old">旧: ${old}</div>` : ''}
        </div>`;
    }
    html += `</div>`;
  }
  // 变化对比
  if (hasDiff) {
    html += `
      <div class="compare-section">
        <div class="compare-title">与上一版对比变化</div>
        <div class="diff-list">
          ${Object.entries(step.diffFromBase).map(([k, v]) => `
            <div class="diff-list-item">
              <span class="diff-key">${formatParamLabel(k)}</span>
              <span class="diff-val">${v}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }
  // 人工修正
  if (hasManual) {
    html += `<div class="detail-section-title">⚠️ 人工介入修正</div>`;
    step.manualFixes.forEach(mf => {
      html += `<div class="info-box" style="background:#fffbeb;border-color:#fcd34d;color:#92400e;">
        ${JSON.stringify(mf)}
      </div>`;
    });
  }
  // 异常
  if (step.anomalies && step.anomalies.length) {
    html += `<div class="detail-section-title">异常记录</div>`;
    step.anomalies.forEach(a => {
      html += `<div style="padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;margin-bottom:8px;">
        <span class="anomaly-tag">${a.type === 'cloud_cover' ? '云遮挡' : a.type}</span>
        <span style="margin-left:8px;font-size:13px;color:#7f1d1d;">${a.desc}（${a.count}条）</span>
      </div>`;
    });
  }
  // 坐标问题
  if (step.coordIssues && step.coordIssues.length) {
    html += `<div class="detail-section-title">坐标格式问题</div>
      <table class="coord-table" style="margin-top:8px;">
      <thead><tr><th>原始纬度</th><th>原始经度</th><th>说明</th></tr></thead><tbody>
      ${step.coordIssues.map(i => `<tr><td><span class="coord-original">${i.originalLat}</span></td><td><span class="coord-original">${i.originalLon}</span></td><td>${i.note}</td></tr>`).join('')}
      </tbody></table>`;
  }
  // 晚到附件
  if (step.lateArrival) {
    html += `<div class="detail-section-title">晚到附件处理</div>
      <div style="padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
        <div style="font-weight:600;color:#92400e;margin-bottom:6px;">📎 ${step.lateArrival.attachment}</div>
        <div style="font-size:12px;color:#a16207;line-height:1.8;">
          <div>📥 收到时间: ${step.lateArrival.receivedAt}</div>
          <div>⚙️ 处理环节: ${step.lateArrival.processedIn}</div>
          <div>📝 原因: ${step.lateArrival.reason}</div>
          <div>🎯 影响样品: ${(step.lateArrival.affected || []).join(', ')}</div>
        </div>
      </div>`;
  }
  // 输入输出
  html += `<div class="detail-section-title">输入输出</div><div class="io-list">`;
  (step.inputs || []).forEach(i => {
    html += `<div class="io-item input"><span class="io-tag input">输入</span><span>${i}</span></div>`;
  });
  (step.outputs || []).forEach(o => {
    html += `<div class="io-item"><span class="io-tag output">输出</span><span>${o}</span></div>`;
  });
  html += `</div></div>`;
  detail.innerHTML = html;
}

// ============================================================
// 渲染：坐标表 + 晚到附件 + 云遮挡表
// ============================================================

function renderCoordTable(run) {
  const container = document.getElementById('coord-table');
  const c = run._summary?.computed?.coord_cleaned || [];
  const byId = {};
  (run.labResults || []).forEach(l => byId[l.sampleId] = l);

  if (!c.length) {
    container.innerHTML = '<p style="color:#9ca3af;">无数据</p>';
    return;
  }

  container.innerHTML = `
    <table class="coord-table">
      <thead>
        <tr>
          <th>采样点</th>
          <th>原始写法</th>
          <th>标准化后（WGS84 十进制度）</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${c.map(row => {
          const lab = byId[row.sample_id] || {};
          const fmtCls = row.source_format;
          const fmtName = row.source_format_name;
          const isManual = row.has_manual_fix;
          const isLate = lab.isLateArrival;
          return `
            <tr class="lab-row ${isLate ? 'late-arrival' : ''} ${isManual ? 'manual-row' : ''}">
              <td>
                <strong>${row.site_name}</strong>
                <div style="font-size:11px;color:#9ca3af;margin-top:2px;">
                  ${row.sample_id}
                  ${isLate ? '<span class="late-badge-inline">晚到</span>' : ''}
                  ${isManual ? '<span class="manual-tag">人工修正</span>' : ''}
                </div>
              </td>
              <td>
                <div><span class="coord-original">${row.original_lat}</span></div>
                <div style="margin-top:2px;"><span class="coord-original">${row.original_lon}</span></div>
                <span class="format-tag ${fmtCls}">${fmtName}</span>
                ${isManual && row.before_manual_fix ? `
                  <div style="font-size:10px;color:#9ca3af;margin-top:4px;">
                    修正前: ${row.before_manual_fix.lat}, ${row.before_manual_fix.lon}
                  </div>` : ''}
              </td>
              <td>
                <div class="coord-normalized ${isManual ? 'manual' : ''}">${row.lat}° N</div>
                <div class="coord-normalized ${isManual ? 'manual' : ''}" style="margin-top:2px;">${row.lon}° E</div>
              </td>
              <td>
                <button class="fix-btn" onclick="openFixCoordModal('${lab.id || ''}','${row.sample_id}','${row.site_name}','${row.lat}','${row.lon}')">📍修正</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderLateAttachments(run) {
  const container = document.getElementById('late-list');
  const badge = document.getElementById('late-badge');
  const list = run.lateAttachments || [];
  if (!list.length) {
    badge.textContent = '无';
    badge.className = 'panel-badge late-badge';
    container.innerHTML = `<div class="late-empty">本次运行无晚到附件<br><small>可在上方"材料区"录入晚到样品</small></div>`;
    return;
  }
  badge.textContent = `${list.length} 个`;
  badge.className = 'panel-badge late-badge';
  container.innerHTML = list.map(la => `
    <div class="late-item">
      <div class="late-file">${la.fileName}</div>
      <div class="late-meta">
        <span>📥 收到: ${la.receivedAt}</span>
        <span>⚙️ 处理于: 第 ${(la.processedStep || '').replace('step-','')} 步</span>
        <span>📝 原因: ${la.reason}</span>
        <span>📊 含 ${la.sampleCount} 条：${la.content}</span>
      </div>
    </div>`).join('');
}

function renderCloudTable(run, sum) {
  const container = document.getElementById('cloud-table');
  const cf = sum?.computed?.cloud_filter || { excluded: [], included: [] };
  const excIds = new Set((cf.excluded || []).map(x => x.id));
  const all = (run.cloudRecords || []).slice().sort((a, b) => a.date.localeCompare(b.date));

  container.innerHTML = `
    <table class="cloud-table">
      <thead>
        <tr>
          <th>影像编号</th>
          <th>日期</th>
          <th>云量</th>
          <th>处理</th>
          <th>原因</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${all.map(r => {
          const excluded = excIds.has(r.id);
          const mo = r.manualOverride;
          const pct = r.cloudPercent;
          const barW = Math.min(100, pct * 1.5);
          const opp = excluded ? 'include' : 'exclude';
          const oppText = excluded ? '人工纳入' : '人工剔除';
          return `
            <tr class="cloud-row ${excluded ? '' : 'included'}">
              <td style="font-family:monospace;font-size:12px;">${r.sceneId}</td>
              <td>${r.date}</td>
              <td>
                <div class="cloud-percent">
                  <span style="font-weight:600;color:${excluded ? '#dc2626' : '#16a34a'};">${pct}%</span>
                  <div class="cloud-bar"><div class="cloud-bar-fill" style="width:${barW}%;"></div></div>
                </div>
              </td>
              <td>
                <span class="cloud-status ${excluded ? 'excluded' : 'included'}">
                  ${excluded ? '❌ 已剔除' : '✅ 已纳入'}
                </span>
                ${mo ? `<span class="manual-override">${mo === 'include' ? '✋人工纳入' : '✋人工剔除'}</span>` : ''}
              </td>
              <td class="cloud-reason">${r.reason}</td>
              <td>
                <button class="fix-btn ${opp}" onclick="overrideCloud('${r.id}','${opp}','${r.sceneId}')">${oppText}</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:12px;padding:10px;background:#fef2f2;border-radius:6px;font-size:12px;color:#7f1d1d;">
      <strong>⚠️ 说明：</strong>云量阈值 <b>${cf.threshold}%</b>，
      共 <b>${(cf.excluded_count || 0) + (cf.included_count || 0)}</b> 景。
      其中 <b style="color:#dc2626;">${cf.excluded_count || 0} 景已剔除</b>（不计入反演），
      <b style="color:#16a34a;">${cf.included_count || 0} 景已纳入</b>。
      可点击右侧按钮人工覆盖规则，再点右上角"🔄 补备注重跑"重算。
    </div>`;
}

function updateAnomalyCount(sum) {
  document.getElementById('anomaly-count').textContent = sum?.counts?.clouds || 0;
}

// ============================================================
// 修正：坐标
// ============================================================

function openFixCoordModal(labId, sampleId, siteName, lat, lon) {
  if (!labId) { alert('该样品无法修正（缺少 lab_id）'); return; }
  pendingFixCoordLabId = labId;
  document.getElementById('fix-coord-info').innerHTML = `
    样品 <b>${sampleId}</b>（${siteName}）<br>
    当前值：纬度 <code>${lat}</code>，经度 <code>${lon}</code>
  `;
  document.getElementById('fix-lat').value = '';
  document.getElementById('fix-lon').value = '';
  document.getElementById('fix-note').value = '';
  document.getElementById('fix-coord-modal').classList.add('active');
}

function confirmFixCoord() {
  const lat = parseFloat(document.getElementById('fix-lat').value);
  const lon = parseFloat(document.getElementById('fix-lon').value);
  const note = document.getElementById('fix-note').value.trim();
  if (isNaN(lat) && isNaN(lon)) {
    alert('请至少填写纬度或经度');
    return;
  }
  const item = { type: 'coord', lab_id: pendingFixCoordLabId, note };
  if (!isNaN(lat)) item.lat = lat;
  if (!isNaN(lon)) item.lon = lon;
  correctionQueue.push(item);
  renderCorrectionList();
  document.getElementById('fix-coord-modal').classList.remove('active');
  // 打开重跑窗口
  openRerunModal();
}

// ============================================================
// 修正：云遮挡 人工覆盖
// ============================================================

function overrideCloud(cloudId, action, sceneId) {
  correctionQueue.push({
    type: 'cloud_override',
    cloud_id: cloudId,
    action,
    note: `手动${action === 'include' ? '纳入' : '剔除'} ${sceneId}`
  });
  renderCorrectionList();
  openRerunModal();
}

// ============================================================
// 修正：阈值
// ============================================================

function openThresholdModal() {
  if (!currentRunData) return;
  document.getElementById('cur-threshold-badge').textContent = (currentRunData.params?.cloudThreshold || '?') + '%';
  document.getElementById('new-threshold').value = '';
  document.getElementById('threshold-note').value = '';
  document.getElementById('threshold-modal').classList.add('active');
}

function confirmThreshold() {
  const v = parseFloat(document.getElementById('new-threshold').value);
  if (isNaN(v) || v < 0 || v > 100) {
    alert('请输入 0-100 之间的数值');
    return;
  }
  correctionQueue.push({
    type: 'cloud_threshold',
    value: v,
    note: document.getElementById('threshold-note').value.trim()
  });
  document.getElementById('threshold-modal').classList.remove('active');
  renderCorrectionList();
  openRerunModal();
}

// ============================================================
// 材料区：上传
// ============================================================

async function handleUpload(e) {
  e.preventDefault();
  if (!currentRunId) return;
  const form = e.target;
  const fileEl = document.getElementById('upload-file');
  if (!fileEl.files.length) return;
  const fd = new FormData(form);
  fd.append('run_id', currentRunId);
  const resultBox = document.getElementById('upload-result');
  showLoading('上传材料中...');
  try {
    const data = await apiPostForm('/upload-material', fd);
    resultBox.className = 'mat-result ok';
    resultBox.textContent = `✅ ${data.fileName} 已上传（${data.size} 字节）。${data.message || ''}`;
    form.reset();
  } catch (e) {
    resultBox.className = 'mat-result err';
    resultBox.textContent = '❌ ' + e.message;
  } finally {
    hideLoading();
  }
}

// ============================================================
// 材料区：录入晚到样品（触发重算）
// ============================================================

async function handleAddLateLab(e) {
  e.preventDefault();
  if (!currentRunId) return;
  const form = e.target;
  const fd = new FormData();
  fd.append('sample_id', document.getElementById('late-sid').value);
  fd.append('site_name', document.getElementById('late-site').value);
  fd.append('original_lat', document.getElementById('late-lat').value);
  fd.append('original_lon', document.getElementById('late-lon').value);
  fd.append('biomass', document.getElementById('late-bio').value);
  fd.append('sample_date', document.getElementById('late-date').value);
  fd.append('note', document.getElementById('late-note').value);

  showLoading('录入晚到样品并触发重算...');
  try {
    const data = await apiPostForm(`/runs/${currentRunId}/add-late-lab`, fd);
    const newRun = data.newRun;
    currentRunId = newRun.id;
    correctionQueue = [];
    await renderRunList();
    await loadRun(currentRunId);
    alert(`✅ 晚到样品已录入并重算完成！\n新增跑次：${newRun.name}\n请到顶部差异横幅查看数值变化`);
    document.getElementById('summary-section').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    alert('❌ ' + e.message);
  } finally {
    hideLoading();
  }
}

// ============================================================
// 重跑：弹窗 + 修正列表 + 提交
// ============================================================

function openRerunModal() {
  renderCorrectionList();
  document.getElementById('rerun-remark').value = '';
  document.getElementById('rerun-threshold').value = '';
  document.getElementById('rerun-include-anomaly').value = '';
  document.getElementById('rerun-modal').classList.add('active');
}

function renderCorrectionList() {
  const box = document.getElementById('correction-list');
  if (!correctionQueue.length) {
    box.innerHTML = '<div class="empty-corrections">还没有任何修正，先去点坐标或云记录旁的"修正"按钮吧 👉</div>';
    return;
  }
  const typeMap = {
    coord: '坐标修正',
    cloud_override: '云覆盖',
    cloud_threshold: '云阈值'
  };
  box.innerHTML = correctionQueue.map((c, i) => {
    let desc = '';
    if (c.type === 'coord')
      desc = `${c.lab_id}: 纬度${c.lat ?? '—'} / 经度${c.lon ?? '—'} ${c.note ? '(' + c.note + ')' : ''}`;
    else if (c.type === 'cloud_override')
      desc = `${c.cloud_id} → ${c.action === 'include' ? '纳入' : '剔除'} ${c.note ? '(' + c.note + ')' : ''}`;
    else if (c.type === 'cloud_threshold')
      desc = `阈值调整为 ${c.value}% ${c.note ? '(' + c.note + ')' : ''}`;
    return `
      <div class="correction-item">
        <div class="correction-main">
          <span class="correction-type">${typeMap[c.type] || c.type}</span>
          ${desc}
        </div>
        <button class="correction-remove" onclick="removeCorrection(${i})" title="移除">×</button>
      </div>`;
  }).join('');
}

function removeCorrection(idx) {
  correctionQueue.splice(idx, 1);
  renderCorrectionList();
}

async function submitRerun() {
  // 合并手动阈值
  const thrInput = document.getElementById('rerun-threshold').value.trim();
  const incInput = document.getElementById('rerun-include-anomaly').value;
  const remark = document.getElementById('rerun-remark').value.trim();
  const paramOverrides = {};
  if (thrInput) paramOverrides.cloud_threshold = parseFloat(thrInput);
  if (incInput) paramOverrides.include_anomaly = incInput === 'true';

  if (!correctionQueue.length && !Object.keys(paramOverrides).length && !remark) {
    alert('请至少填写备注、或添加修正项、或调整参数');
    return;
  }

  showLoading('后端正在根据修正记录重新计算...');
  document.getElementById('rerun-modal').classList.remove('active');
  try {
    const data = await apiPost('/rerun', {
      base_run_id: currentRunId,
      remark,
      corrections: correctionQueue,
      param_overrides: paramOverrides
    });
    const newRun = data.newRun;
    currentRunId = newRun.id;
    correctionQueue = [];
    await renderRunList();
    await loadRun(currentRunId);

    // 展示差异
    const qn = data.quickNumbers || {};
    const diffStr = [
      qn.avgBiomass !== undefined && `平均生物量 → ${qn.avgBiomass}`,
      qn.totalBiomass !== undefined && `总生物量 → ${qn.totalBiomass}`,
      qn.excludedCloud !== undefined && `剔除云景 → ${qn.excludedCloud}`,
      qn.labCount !== undefined && `样品数 → ${qn.labCount}`
    ].filter(Boolean).join('\n');
    alert(`✅ 重算完成！\n\n新跑次：${newRun.name}\n${newRun.remark ? '备注：' + newRun.remark + '\n' : ''}\n关键数值：\n${diffStr}\n\n顶部差异横幅已显示变化，请核对。`);
    document.getElementById('summary-section').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    alert('❌ 重算失败：' + e.message);
  } finally {
    hideLoading();
  }
}

// ============================================================
// 试跑样例
// ============================================================

async function openSampleModal() {
  showLoading('加载样例清单...');
  try {
    const list = await apiGet('/samples');
    const container = document.getElementById('sample-list');
    container.innerHTML = list.map(s => `
      <div class="sample-item" data-run="${s.id}">
        <div class="sample-title">${s.name}</div>
        <div class="sample-desc">${s.desc}</div>
        <div class="sample-meta">
          <span>📍 ${s.feature_count} 数据点</span>
          <span>☁️ ${s.cloud_count} 景云</span>
          ${s.late_count ? `<span>📮 ${s.late_count} 晚到</span>` : ''}
          ${s.has_manual ? '<span>⚠️ 含人工修正</span>' : ''}
        </div>
      </div>`).join('');
    container.querySelectorAll('.sample-item').forEach(el => {
      el.addEventListener('click', async () => {
        currentRunId = el.dataset.run;
        currentStepId = null;
        correctionQueue = [];
        document.getElementById('sample-modal').classList.remove('active');
        showLoading('切换到样例跑次...');
        try {
          await renderRunList();
          await loadRun(currentRunId);
        } catch (e) {
          alert(e.message);
        } finally {
          hideLoading();
        }
      });
    });
    document.getElementById('sample-modal').classList.add('active');
  } catch (e) {
    alert(e.message);
  } finally {
    hideLoading();
  }
}

// ============================================================
// 导出报告
// ============================================================

function doExport(fmt) {
  if (!currentRunId) return;
  const url = `${API}/runs/${currentRunId}/export?format=${fmt}&download=true`;
  // 打开新窗口触发下载
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
