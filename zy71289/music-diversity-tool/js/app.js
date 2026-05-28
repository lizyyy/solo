import { generateSampleData, importFromJSON, getSongById, enrichRecItems } from './data-model.js';
import { computeDiversityMetrics, buildDiversityTrace } from './diversity.js';
import { computePreferenceMetrics, buildPreferenceTrace } from './preference.js';
import { computeExposureConstraints, buildExposureTrace } from './exposure.js';
import { explainAllRecommendations, computeExplanationSummary, buildExplainTrace } from './explain.js';
import { buildFullReport, exportReportJSON, exportReportCSV, downloadFile, buildReportTrace } from './report.js';
import { saveReport, listReports, loadReport, deleteReport, buildReviewTrace } from './review.js';

const STEPS = ['import', 'diversity', 'preference', 'exposure', 'explain', 'report'];
const STEP_LABELS = ['数据导入', '多样性指标', '偏好匹配', '曝光约束', '列表解释', '报告导出'];

const state = {
  currentStep: 0,
  data: null,
  enrichedItems: null,
  diversityMetrics: null,
  preferenceMetrics: null,
  exposureResult: null,
  explanations: null,
  explanationSummary: null,
  pipelineTrace: [],
  report: null,
  reviewMode: false
};

let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function scoreColor(score) {
  if (score >= 0.7) return 'var(--success)';
  if (score >= 0.4) return 'var(--warning)';
  return 'var(--critical)';
}

function renderSteps() {
  const topbar = document.getElementById('topbar');
  topbar.innerHTML = '';
  STEPS.forEach((step, i) => {
    if (i > 0) {
      const conn = document.createElement('div');
      conn.className = 'step-connector';
      topbar.appendChild(conn);
    }
    const btn = document.createElement('button');
    btn.className = 'step-btn';
    if (i === state.currentStep) btn.classList.add('active');
    if (i < state.currentStep) btn.classList.add('done');
    const num = document.createElement('span');
    num.className = 'step-num';
    num.textContent = i + 1;
    btn.appendChild(num);
    btn.appendChild(document.createTextNode(STEP_LABELS[i]));
    btn.addEventListener('click', () => goToStep(i));
    topbar.appendChild(btn);
  });
}

function goToStep(i) {
  state.currentStep = i;
  renderSteps();
  document.querySelectorAll('.panel').forEach((p, idx) => {
    p.classList.toggle('active', idx === i);
  });
  renderCurrentPanel();
  updateTraceBar();
}

function showPanel(name) {
  const i = STEPS.indexOf(name);
  if (i >= 0) goToStep(i);
}

function updateTraceBar() {
  const bar = document.getElementById('traceBar');
  if (state.pipelineTrace.length === 0) {
    bar.innerHTML = '<span class="trace-label">流水线追溯</span><span>尚无计算步骤</span>';
    return;
  }
  let html = '<span class="trace-label">追溯链</span>';
  state.pipelineTrace.forEach((step, i) => {
    if (i > 0) html += '<span class="trace-arrow">→</span>';
    html += `<span class="trace-step"><span class="ts-dot"></span>${STEP_LABELS[STEPS.indexOf(step.step)] || step.step}</span>`;
  });
  bar.innerHTML = html;
}

function renderCurrentPanel() {
  switch (STEPS[state.currentStep]) {
    case 'import': renderImportPanel(); break;
    case 'diversity': renderDiversityPanel(); break;
    case 'preference': renderPreferencePanel(); break;
    case 'exposure': renderExposurePanel(); break;
    case 'explain': renderExplainPanel(); break;
    case 'report': renderReportPanel(); break;
  }
}

function renderImportPanel() {
  const panel = document.getElementById('panel-import');
  if (state.data) {
    panel.innerHTML = `
      <div class="card">
        <div class="card-title">数据概览 <span class="badge badge-success">已导入</span></div>
        <div class="data-summary">
          <div class="ds-item">
            <div class="ds-label">歌曲库</div>
            <div class="ds-value">${state.data.songs.length}</div>
            <div class="ds-ref">ref: ${state.data._meta.ref_ids.songs}</div>
          </div>
          <div class="ds-item">
            <div class="ds-label">听歌记录</div>
            <div class="ds-value">${state.data.userListening.listens.length}</div>
            <div class="ds-ref">ref: ${state.data._meta.ref_ids.user_listening}</div>
          </div>
          <div class="ds-item">
            <div class="ds-label">推荐列表</div>
            <div class="ds-value">${state.data.recList.items.length}首</div>
            <div class="ds-ref">ref: ${state.data._meta.ref_ids.rec_list}</div>
          </div>
          <div class="ds-item">
            <div class="ds-label">跳过记录</div>
            <div class="ds-value">${state.data.skipRecords.skips.length}</div>
            <div class="ds-ref">ref: ${state.data._meta.ref_ids.skip_records}</div>
          </div>
          <div class="ds-item">
            <div class="ds-label">时间窗口</div>
            <div class="ds-value">${state.data.timeWindow.label}</div>
            <div class="ds-ref">${state.data.timeWindow.start_date} ~ ${state.data.timeWindow.end_date}</div>
          </div>
        </div>
        <div style="margin-top:16px; display:flex; gap:12px;">
          <button class="btn btn-primary" onclick="window._nextStep()">下一步：多样性指标 →</button>
          <button class="btn btn-secondary" onclick="window._resetData()">重新导入</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">数据来源追溯</div>
        <table class="data-table">
          <thead><tr><th>数据类型</th><th>记录数</th><th>引用ID</th><th>导入时间</th></tr></thead>
          <tbody>
            <tr><td>歌曲标签</td><td>${state.data.songs.length}</td><td>${state.data._meta.ref_ids.songs}</td><td>${state.data._meta.imported_at}</td></tr>
            <tr><td>用户听歌</td><td>${state.data.userListening.listens.length}</td><td>${state.data._meta.ref_ids.user_listening}</td><td>${state.data._meta.imported_at}</td></tr>
            <tr><td>推荐列表</td><td>${state.data.recList.items.length}</td><td>${state.data._meta.ref_ids.rec_list}</td><td>${state.data._meta.imported_at}</td></tr>
            <tr><td>跳过记录</td><td>${state.data.skipRecords.skips.length}</td><td>${state.data._meta.ref_ids.skip_records}</td><td>${state.data._meta.imported_at}</td></tr>
            <tr><td>时间窗口</td><td>1</td><td>${state.data._meta.ref_ids.time_window}</td><td>${state.data._meta.imported_at}</td></tr>
          </tbody>
        </table>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <div class="card">
      <div class="card-title">导入数据</div>
      <p style="color:var(--text2); font-size:14px; margin-bottom:16px;">上传JSON数据文件或使用示例数据快速体验。每类数据的引用ID会自动记录，方便后续追溯。</p>
      <div style="display:flex; gap:16px; flex-wrap:wrap;">
        <div class="import-zone" style="flex:1; min-width:240px;" id="dropZone">
          <div class="iz-icon">📂</div>
          <div class="iz-text">拖放或点击上传JSON数据文件</div>
          <input type="file" accept=".json" id="fileInput" style="display:none;">
        </div>
        <div style="flex:1; min-width:240px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <button class="btn btn-primary" style="font-size:15px; padding:14px 32px;" onclick="window._loadSample()">🎵 使用示例数据</button>
          <p style="color:var(--text2); font-size:12px; margin-top:8px;">自动生成50首歌 / 120条听歌 / 20首推荐 / 30条跳过</p>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">数据格式说明</div>
      <table class="data-table">
        <thead><tr><th>数据类型</th><th>必需字段</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td>songs</td><td>song_id, title, tags, genre_primary, release_date, popularity</td><td>歌曲标签库</td></tr>
          <tr><td>userListening</td><td>user_id, listens[].song_id, timestamp, play_ratio</td><td>用户听歌历史</td></tr>
          <tr><td>recList</td><td>list_id, items[].song_id, rank, relevance_score, reason_code</td><td>推荐列表</td></tr>
          <tr><td>skipRecords</td><td>user_id, skips[].song_id, timestamp, played_ms</td><td>跳过记录</td></tr>
          <tr><td>timeWindow</td><td>start_date, end_date, label</td><td>分析时间窗口</td></tr>
        </tbody>
      </table>
    </div>`;
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) readFile(file);
  });
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const result = importFromJSON(e.target.result);
    if (result.ok) {
      loadData(result.data);
    } else {
      alert('JSON解析失败: ' + result.error);
    }
  };
  reader.readAsText(file);
}

function loadData(data) {
  if (!data._meta) {
    data._meta = {
      imported_at: new Date().toISOString(),
      source: 'file_upload',
      ref_ids: {
        songs: 'uploaded_songs',
        user_listening: data.userListening?.user_id || 'unknown',
        rec_list: data.recList?.list_id || 'unknown',
        skip_records: 'uploaded_skips',
        time_window: data.timeWindow?.window_id || 'unknown'
      }
    };
  }
  state.data = data;
  state.enrichedItems = enrichRecItems(data.recList, data.songs);
  state.pipelineTrace = [];
  state.diversityMetrics = null;
  state.preferenceMetrics = null;
  state.exposureResult = null;
  state.explanations = null;
  state.explanationSummary = null;
  state.report = null;
  state.reviewMode = false;
  renderImportPanel();
}

function renderDiversityPanel() {
  const panel = document.getElementById('panel-diversity');
  if (!state.data) {
    panel.innerHTML = '<div class="empty-state"><div class="es-icon">📊</div><div class="es-text">请先导入数据</div></div>';
    return;
  }
  if (!state.diversityMetrics) {
    state.diversityMetrics = computeDiversityMetrics(state.enrichedItems, state.data.songs, state.data.timeWindow.start_date);
    const trace = buildDiversityTrace(state.diversityMetrics, state.enrichedItems);
    state.pipelineTrace.push(trace);
  }
  const m = state.diversityMetrics;
  panel.innerHTML = `
    ${reviewBanner()}
    <div class="card">
      <div class="card-title">多样性指标总览</div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(m.normalized_entropy)}">${m.normalized_entropy}</div>
          <div class="mc-label">归一化熵 (0~1)</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(m.coverage)}">${m.coverage}</div>
          <div class="mc-label">风格覆盖率</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(m.freshness.score)}">${m.freshness.score}</div>
          <div class="mc-label">新歌比例</div>
        </div>
        <div class="metric-card">
          <div class="mc-value">${m.entropy} / ${m.max_entropy}</div>
          <div class="mc-label">Shannon熵 / 最大熵</div>
        </div>
      </div>
    </div>
    <div class="chart-row">
      <div class="card">
        <div class="card-title">风格分布 <span class="badge badge-accent">可点击下钻</span></div>
        <div class="chart-box"><canvas id="genreDistChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">热度分布</div>
        <div class="chart-box"><canvas id="popDistChart"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">推荐列表明细 <span class="badge badge-info">输入来源: ${state.data._meta.ref_ids.rec_list}</span></div>
      <div class="table-scroll">
        <table class="data-table" id="diversityDetailTable">
          <thead><tr><th>排名</th><th>歌曲</th><th>艺人</th><th>风格标签</th><th>主风格</th><th>热度</th><th>新歌</th><th>相关度</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    <div style="margin-top:16px;">
      <button class="btn btn-primary" onclick="window._nextStep()">下一步：偏好匹配 →</button>
    </div>`;
  renderGenreDistChart(m.genre_distribution);
  renderPopDistChart(state.enrichedItems);
  renderDiversityDetailTable(state.enrichedItems);
}

function renderGenreDistChart(dist) {
  destroyChart('genreDistChart');
  const ctx = document.getElementById('genreDistChart');
  if (!ctx) return;
  const labels = Object.keys(dist);
  const values = Object.values(dist);
  const colors = ['#6c5ce7','#a29bfe','#00b894','#fdcb6e','#e17055','#74b9ff','#fab1a0','#55efc4','#ffeaa7','#dfe6e9','#b2bec3','#636e72','#2d3436','#fd79a8','#e84393'];
  chartInstances['genreDistChart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#9499b3', font: { size: 11 } } }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const genre = labels[idx];
          showGenreDrilldown(genre);
        }
      }
    }
  });
}

function showGenreDrilldown(genre) {
  const items = state.enrichedItems.filter(item => item.song && item.song.tags.includes(genre));
  const modal = document.getElementById('drilldownModal');
  const title = document.getElementById('drilldownTitle');
  const body = document.getElementById('drilldownBody');
  title.textContent = `风格「${genre}」下钻 — ${items.length}首`;
  body.innerHTML = `<table class="data-table"><thead><tr><th>排名</th><th>歌曲</th><th>艺人</th><th>热度</th><th>推荐原因</th></tr></thead><tbody>${items.map(item => `<tr><td>${item.rank}</td><td>${item.song?.title || '-'}</td><td>${item.song?.artist || '-'}</td><td>${item.song?.popularity || '-'}</td><td>${item.reason_text || '-'}</td></tr>`).join('')}</tbody></table>`;
  modal.style.display = 'flex';
}

function renderPopDistChart(items) {
  destroyChart('popDistChart');
  const ctx = document.getElementById('popDistChart');
  if (!ctx) return;
  const bins = ['0-20', '21-40', '41-60', '61-80', '81-100'];
  const counts = [0, 0, 0, 0, 0];
  items.forEach(item => {
    if (!item.song) return;
    const p = item.song.popularity;
    if (p <= 20) counts[0]++;
    else if (p <= 40) counts[1]++;
    else if (p <= 60) counts[2]++;
    else if (p <= 80) counts[3]++;
    else counts[4]++;
  });
  chartInstances['popDistChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bins,
      datasets: [{ label: '歌曲数', data: counts, backgroundColor: ['#55efc4','#00b894','#fdcb6e','#e17055','#d63031'], borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#9499b3' }, grid: { color: 'rgba(46,51,71,.5)' } },
        y: { ticks: { color: '#9499b3' }, grid: { color: 'rgba(46,51,71,.5)' }, beginAtZero: true }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderDiversityDetailTable(items) {
  const tbody = document.querySelector('#diversityDetailTable tbody');
  if (!tbody) return;
  tbody.innerHTML = items.map(item => `<tr>
    <td>${item.rank}</td>
    <td>${item.song?.title || '-'}</td>
    <td>${item.song?.artist || '-'}</td>
    <td>${(item.song?.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</td>
    <td>${item.song?.genre_primary || '-'}</td>
    <td>${item.song?.popularity ?? '-'}</td>
    <td>${item.song?.is_new ? '<span class="badge badge-success">新</span>' : '-'}</td>
    <td>${item.relevance_score}</td>
  </tr>`).join('');
}

function renderPreferencePanel() {
  const panel = document.getElementById('panel-preference');
  if (!state.data) {
    panel.innerHTML = '<div class="empty-state"><div class="es-icon">🎯</div><div class="es-text">请先导入数据</div></div>';
    return;
  }
  if (!state.preferenceMetrics) {
    state.preferenceMetrics = computePreferenceMetrics(state.data.userListening, state.enrichedItems, state.data.songs);
    const trace = buildPreferenceTrace(state.preferenceMetrics);
    state.pipelineTrace.push(trace);
  }
  const pm = state.preferenceMetrics;
  const m = pm.match;
  panel.innerHTML = `
    ${reviewBanner()}
    <div class="card">
      <div class="card-title">偏好匹配总览</div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(m.cosine_similarity)}">${m.cosine_similarity}</div>
          <div class="mc-label">余弦相似度</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:var(--critical)">${m.overrepresented_genres.length}</div>
          <div class="mc-label">过度代表风格</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:var(--info)">${m.underrepresented_genres.length}</div>
          <div class="mc-label">代表不足风格</div>
        </div>
        <div class="metric-card">
          <div class="mc-value">${pm.user_profile.total_listen_hours}h</div>
          <div class="mc-label">总听歌时长</div>
        </div>
      </div>
    </div>
    <div class="chart-row">
      <div class="card">
        <div class="card-title">用户偏好分布 <span class="badge badge-info">来源: ${state.data._meta.ref_ids.user_listening}</span></div>
        <div class="chart-box"><canvas id="userGenreChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">推荐列表分布 <span class="badge badge-info">来源: ${state.data._meta.ref_ids.rec_list}</span></div>
        <div class="chart-box"><canvas id="recGenreChart"></canvas></div>
      </div>
    </div>
    ${m.overrepresented_genres.length > 0 ? `
    <div class="card">
      <div class="card-title">过度代表风格 <span class="badge badge-warning">推荐占比 > 用户偏好</span></div>
      <table class="data-table">
        <thead><tr><th>风格</th><th>用户偏好占比</th><th>推荐占比</th><th>偏差</th><th>状态</th></tr></thead>
        <tbody>${m.overrepresented_genres.map(g => `<tr>
          <td>${g.genre}</td>
          <td>${(g.user_ratio * 100).toFixed(1)}%</td>
          <td>${(g.rec_ratio * 100).toFixed(1)}%</td>
          <td style="color:var(--critical);">+${(g.diff * 100).toFixed(1)}%</td>
          <td><span class="badge badge-warning">过度推送</span></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
    ${m.underrepresented_genres.length > 0 ? `
    <div class="card">
      <div class="card-title">代表不足风格 <span class="badge badge-info">推荐占比 < 用户偏好</span></div>
      <table class="data-table">
        <thead><tr><th>风格</th><th>用户偏好占比</th><th>推荐占比</th><th>偏差</th><th>状态</th></tr></thead>
        <tbody>${m.underrepresented_genres.map(g => `<tr>
          <td>${g.genre}</td>
          <td>${(g.user_ratio * 100).toFixed(1)}%</td>
          <td>${(g.rec_ratio * 100).toFixed(1)}%</td>
          <td style="color:var(--info);">${(g.diff * 100).toFixed(1)}%</td>
          <td><span class="badge badge-info">推送不足</span></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
    <div style="margin-top:16px;">
      <button class="btn btn-primary" onclick="window._nextStep()">下一步：曝光约束 →</button>
    </div>`;
  renderUserGenreChart(pm.user_profile.genre_profile);
  renderRecGenreChart(pm.rec_profile.genre_profile);
}

function renderUserGenreChart(profile) {
  destroyChart('userGenreChart');
  const ctx = document.getElementById('userGenreChart');
  if (!ctx) return;
  const labels = Object.keys(profile);
  const values = Object.values(profile).map(v => Math.round(v * 1000) / 10);
  chartInstances['userGenreChart'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{ label: '用户偏好 %', data: values, borderColor: '#6c5ce7', backgroundColor: 'rgba(108,92,231,.2)', pointBackgroundColor: '#6c5ce7' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { ticks: { color: '#9499b3', backdropColor: 'transparent' }, grid: { color: 'rgba(46,51,71,.5)' }, pointLabels: { color: '#e4e6f0', font: { size: 11 } } } },
      plugins: { legend: { labels: { color: '#9499b3' } } }
    }
  });
}

function renderRecGenreChart(profile) {
  destroyChart('recGenreChart');
  const ctx = document.getElementById('recGenreChart');
  if (!ctx) return;
  const labels = Object.keys(profile);
  const values = Object.values(profile).map(v => Math.round(v * 1000) / 10);
  chartInstances['recGenreChart'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{ label: '推荐占比 %', data: values, borderColor: '#00b894', backgroundColor: 'rgba(0,184,148,.2)', pointBackgroundColor: '#00b894' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { ticks: { color: '#9499b3', backdropColor: 'transparent' }, grid: { color: 'rgba(46,51,71,.5)' }, pointLabels: { color: '#e4e6f0', font: { size: 11 } } } },
      plugins: { legend: { labels: { color: '#9499b3' } } }
    }
  });
}

function renderExposurePanel() {
  const panel = document.getElementById('panel-exposure');
  if (!state.data) {
    panel.innerHTML = '<div class="empty-state"><div class="es-icon">⚠️</div><div class="es-text">请先导入数据</div></div>';
    return;
  }
  if (!state.exposureResult) {
    state.exposureResult = computeExposureConstraints(state.diversityMetrics, state.enrichedItems);
    const trace = buildExposureTrace(state.exposureResult);
    state.pipelineTrace.push(trace);
  }
  const er = state.exposureResult;
  panel.innerHTML = `
    ${reviewBanner()}
    <div class="card">
      <div class="card-title">曝光约束检查</div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(er.summary.overall_score)}">${er.summary.overall_score}</div>
          <div class="mc-label">综合评分</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:var(--critical)">${er.summary.critical}</div>
          <div class="mc-label">严重告警</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:var(--warning)">${er.summary.warning}</div>
          <div class="mc-label">一般告警</div>
        </div>
        <div class="metric-card">
          <div class="mc-value">${er.summary.total}</div>
          <div class="mc-label">告警总数</div>
        </div>
      </div>
    </div>
    ${er.warnings.length === 0 ? '<div class="card"><div class="empty-state"><div class="es-icon">✅</div><div class="es-text">所有曝光约束检查通过</div></div></div>' : ''}
    ${er.warnings.map(w => `
    <div class="warning-card ${w.severity} collapsible">
      <div class="wc-title"><span class="badge badge-${w.severity === 'critical' ? 'critical' : w.severity === 'warning' ? 'warning' : 'info'}">${w.severity.toUpperCase()}</span> ${w.title} (${w.code})</div>
      <div class="wc-desc">${w.description}</div>
      <div class="wc-affected">受影响歌曲: <span>${w.affected_items.length}</span>首</div>
      <div class="wc-remediation">💡 处置建议: ${w.remediation}</div>
      <span class="wc-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">展开受影响歌曲 ▼</span>
      <div class="wc-detail">
        <table class="data-table" style="margin-top:8px;">
          <thead><tr><th>排名</th><th>歌曲ID</th><th>标题</th>${w.code === 'POPULAR_CROWDING' ? '<th>热度</th>' : ''}</tr></thead>
          <tbody>${w.affected_items.map(item => `<tr><td>${item.rank}</td><td>${item.song_id}</td><td>${item.title || '-'}</td>${w.code === 'POPULAR_CROWDING' ? `<td>${item.popularity ?? '-'}</td>` : ''}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`).join('')}
    <div style="margin-top:16px;">
      <button class="btn btn-primary" onclick="window._nextStep()">下一步：列表解释 →</button>
    </div>`;
}

function renderExplainPanel() {
  const panel = document.getElementById('panel-explain');
  if (!state.data) {
    panel.innerHTML = '<div class="empty-state"><div class="es-icon">🔍</div><div class="es-text">请先导入数据</div></div>';
    return;
  }
  if (!state.explanations) {
    state.explanations = explainAllRecommendations(state.enrichedItems, state.data.skipRecords, state.data.userListening);
    state.explanationSummary = computeExplanationSummary(state.explanations);
    const trace = buildExplainTrace(state.explanations, state.explanationSummary);
    state.pipelineTrace.push(trace);
  }
  const es = state.explanationSummary;
  panel.innerHTML = `
    ${reviewBanner()}
    <div class="card">
      <div class="card-title">推荐列表解释总览</div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="mc-value">${es.total}</div>
          <div class="mc-label">推荐歌曲数</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:var(--success)">${(es.listen_rate * 100).toFixed(1)}%</div>
          <div class="mc-label">收听率</div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:var(--critical)">${(es.skip_rate * 100).toFixed(1)}%</div>
          <div class="mc-label">跳过率</div>
        </div>
        <div class="metric-card">
          <div class="mc-value">${Object.entries(es.reason_distribution).map(([k, v]) => `${k}:${v}`).join(' ')}</div>
          <div class="mc-label">推荐原因分布</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">推荐行为分布 <span class="badge badge-info">来源: ${state.data._meta.ref_ids.skip_records} + ${state.data._meta.ref_ids.user_listening}</span></div>
      <div class="chart-box" style="height:200px;"><canvas id="actionDistChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">逐条解释与追溯</div>
      ${state.explanations.map(e => `
      <div class="explain-item">
        <div class="ei-rank">${e.rank}</div>
        <div class="ei-info">
          <div class="ei-title">${e.title || e.song_id}</div>
          <div class="ei-artist">${e.artist || '-'} · ${(e.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
        </div>
        <div class="ei-reason">${e.reason_text}<br><span style="font-size:10px;color:var(--text2);">相关度: ${e.relevance_score}</span></div>
        <div class="ei-action"><span class="action-tag action-${e.user_action === '收听' ? 'listen' : e.user_action === '跳过' ? 'skip' : e.user_action === '部分收听' ? 'partial' : 'none'}">${e.user_action}</span></div>
        <div class="ei-trace">来源: ${e.trace.rec_source}<br>歌曲ref: ${e.trace.song_ref}</div>
      </div>`).join('')}
    </div>
    <div style="margin-top:16px;">
      <button class="btn btn-primary" onclick="window._nextStep()">下一步：报告导出 →</button>
    </div>`;
  renderActionDistChart(es.action_distribution);
}

function renderActionDistChart(dist) {
  destroyChart('actionDistChart');
  const ctx = document.getElementById('actionDistChart');
  if (!ctx) return;
  const labels = Object.keys(dist);
  const values = Object.values(dist);
  const colors = { '收听': '#00b894', '跳过': '#e17055', '部分收听': '#fdcb6e', '未交互': '#636e72' };
  chartInstances['actionDistChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: labels.map(l => colors[l] || '#74b9ff'), borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#9499b3' }, grid: { color: 'rgba(46,51,71,.5)' }, beginAtZero: true },
        y: { ticks: { color: '#e4e6f0' }, grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderReportPanel() {
  const panel = document.getElementById('panel-report');
  if (!state.data) {
    panel.innerHTML = '<div class="empty-state"><div class="es-icon">📋</div><div class="es-text">请先导入数据</div></div>';
    return;
  }
  if (!state.report) {
    state.report = buildFullReport(state.data, state.enrichedItems, state.diversityMetrics, state.preferenceMetrics, state.exposureResult, state.explanations, state.explanationSummary, state.pipelineTrace);
    const trace = buildReportTrace(state.report);
    state.pipelineTrace.push(trace);
    saveReport(state.report);
    renderReviewList();
  }
  const r = state.report;
  panel.innerHTML = `
    ${reviewBanner()}
    <div class="card">
      <div class="card-title">评分报告 <span class="badge badge-accent">${r.report_id}</span></div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(r.overall_score)}">${r.overall_score}</div>
          <div class="mc-label">综合评分</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${r.overall_score * 100}%; background:${scoreColor(r.overall_score)};"></div></div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(r.scores.diversity)}">${r.scores.diversity}</div>
          <div class="mc-label">多样性评分</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${r.scores.diversity * 100}%; background:${scoreColor(r.scores.diversity)};"></div></div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(r.scores.preference)}">${r.scores.preference}</div>
          <div class="mc-label">偏好匹配评分</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${r.scores.preference * 100}%; background:${scoreColor(r.scores.preference)};"></div></div>
        </div>
        <div class="metric-card">
          <div class="mc-value" style="color:${scoreColor(r.scores.exposure)}">${r.scores.exposure}</div>
          <div class="mc-label">曝光约束评分</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${r.scores.exposure * 100}%; background:${scoreColor(r.scores.exposure)};"></div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">流水线追溯链</div>
      <table class="data-table">
        <thead><tr><th>步骤</th><th>计算时间</th><th>输入引用</th><th>关键输出</th></tr></thead>
        <tbody>${r.pipeline_trace.map(step => `<tr>
          <td>${step.step}</td>
          <td>${step.computed_at}</td>
          <td style="font-size:11px; word-break:break-all;">${JSON.stringify(step.input_refs).slice(0, 120)}</td>
          <td style="font-size:11px;">${JSON.stringify(step.output)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">告警汇总</div>
      ${r.exposure_result.warnings.length === 0 ? '<p style="color:var(--text2);">无告警</p>' : `
      <table class="data-table">
        <thead><tr><th>严重度</th><th>代码</th><th>标题</th><th>受影响数</th><th>处置建议</th></tr></thead>
        <tbody>${r.exposure_result.warnings.map(w => `<tr>
          <td><span class="badge badge-${w.severity === 'critical' ? 'critical' : 'warning'}">${w.severity}</span></td>
          <td>${w.code}</td>
          <td>${w.title}</td>
          <td>${w.affected_items.length}</td>
          <td style="font-size:12px; max-width:300px;">${w.remediation}</td>
        </tr>`).join('')}</tbody>
      </table>`}
    </div>
    <div class="card">
      <div class="card-title">导出报告</div>
      <p style="color:var(--text2); font-size:13px; margin-bottom:12px;">导出包含完整流水线追溯的评分报告，每一步的输入输出均可追溯。</p>
      <div class="export-btns">
        <button class="btn btn-primary" onclick="window._exportJSON()">📥 导出 JSON</button>
        <button class="btn btn-secondary" onclick="window._exportCSV()">📊 导出 CSV</button>
      </div>
    </div>
    <div style="margin-top:16px;">
      <button class="btn btn-secondary" onclick="window._goToStep(0)">← 返回数据导入</button>
    </div>`;
}

function reviewBanner() {
  if (!state.reviewMode) return '';
  return `<div class="review-loaded-banner">
    <span><span class="rlb-label">📋 复盘模式</span> — 正在查看历史报告</span>
    <button onclick="window._exitReview()">退出复盘</button>
  </div>`;
}

function renderReviewList() {
  const list = document.getElementById('reviewList');
  const reports = listReports();
  if (reports.length === 0) {
    list.innerHTML = '<div class="review-empty">暂无历史报告<br>完成分析后自动保存</div>';
    return;
  }
  list.innerHTML = reports.map(r => `
    <div class="review-item" onclick="window._loadReview('${r.report_id}')">
      <div class="ri-score" style="color:${scoreColor(r.overall_score)}">${r.overall_score}</div>
      <div class="ri-window">${r.window_label}</div>
      <div class="ri-date">${new Date(r.generated_at).toLocaleString('zh-CN')}</div>
      <div class="ri-warnings">
        ${r.critical_count > 0 ? `<span class="badge badge-critical">${r.critical_count} 严重</span>` : ''}
        ${r.warning_count - r.critical_count > 0 ? `<span class="badge badge-warning">${r.warning_count - r.critical_count} 告警</span>` : ''}
        ${r.warning_count === 0 ? '<span class="badge badge-success">无告警</span>' : ''}
      </div>
      <div class="ri-actions">
        <button onclick="event.stopPropagation(); window._loadReview('${r.report_id}')">复盘</button>
        <button onclick="event.stopPropagation(); window._deleteReview('${r.report_id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function loadReview(reportId) {
  const report = loadReport(reportId);
  if (!report) {
    alert('报告加载失败');
    return;
  }
  state.report = report;
  state.reviewMode = true;
  state.pipelineTrace = report.pipeline_trace || [];
  state.diversityMetrics = report.diversity_metrics || null;
  state.preferenceMetrics = report.preference_metrics || null;
  state.exposureResult = report.exposure_result || null;
  state.explanationSummary = report.explanation_summary || null;
  if (report._raw_data) {
    state.enrichedItems = report._raw_data.enriched_items || null;
    state.explanations = report._raw_data.explanations || null;
    state.data = {
      songs: report._raw_data.songs || [],
      userListening: report._raw_data.user_listening || { user_id: 'review', listens: [] },
      recList: report._raw_data.rec_list || { list_id: 'review', items: [] },
      skipRecords: report._raw_data.skip_records || { user_id: 'review', skips: [] },
      timeWindow: report.window || {},
      _meta: report._meta || {}
    };
  } else if (report._meta) {
    state.data = {
      songs: [],
      userListening: { user_id: 'review', listens: [] },
      recList: { list_id: report._meta?.ref_ids?.rec_list || 'review', items: [] },
      skipRecords: { user_id: 'review', skips: [] },
      timeWindow: report.window || {},
      _meta: report._meta || {}
    };
  }
  goToStep(5);
}

function deleteReviewItem(reportId) {
  if (confirm('确定删除该历史报告？')) {
    deleteReport(reportId);
    renderReviewList();
  }
}

function exitReview() {
  state.reviewMode = false;
  state.data = null;
  state.diversityMetrics = null;
  state.preferenceMetrics = null;
  state.exposureResult = null;
  state.explanations = null;
  state.explanationSummary = null;
  state.report = null;
  state.pipelineTrace = [];
  goToStep(0);
}

function init() {
  renderSteps();
  renderReviewList();
  goToStep(0);

  const modal = document.getElementById('drilldownModal');
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
  document.getElementById('drilldownClose').addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

window._loadSample = () => { loadData(generateSampleData()); };
window._resetData = () => { state.data = null; state.diversityMetrics = null; state.preferenceMetrics = null; state.exposureResult = null; state.explanations = null; state.explanationSummary = null; state.report = null; state.pipelineTrace = []; state.reviewMode = false; goToStep(0); };
window._nextStep = () => { if (state.currentStep < STEPS.length - 1) goToStep(state.currentStep + 1); };
window._goToStep = i => goToStep(i);
window._loadReview = id => loadReview(id);
window._deleteReview = id => deleteReviewItem(id);
window._exitReview = () => exitReview();
window._exportJSON = () => { if (state.report) downloadFile(exportReportJSON(state.report), `diversity_report_${state.report.report_id}.json`, 'application/json'); };
window._exportCSV = () => { if (state.report) downloadFile(exportReportCSV(state.report), `diversity_report_${state.report.report_id}.csv`, 'text/csv'); };

document.addEventListener('DOMContentLoaded', init);
