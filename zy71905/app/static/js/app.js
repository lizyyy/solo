const API = '';

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function fmtStatus(s) {
  const m = { pending: ['待确认', 'badge-pending'], confirmed: ['已确认', 'badge-confirmed'] };
  const [text, cls] = m[s] || [s, 'badge-info'];
  return `<span class="badge ${cls}">${text}</span>`;
}

function fmtRecording(r) {
  if (!r) return `<span class="no-recording">无</span>`;
  return `<a href="/api/recordings/${r}" target="_blank" class="evidence-link">播放</a>`;
}

document.addEventListener('DOMContentLoaded', () => {
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      $$('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  initForms();
  loadDashboard();
  loadScores();
});

function initForms() {
  $('#score-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`${API}/api/scores`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) { toast('曲谱上传成功', 'success'); e.target.reset(); loadScores(); loadDashboard(); }
      else { toast(data.error || '上传失败', 'error'); }
    } catch (err) { toast('网络错误', 'error'); }
  });

  $('#checkin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    try {
      const res = await fetch(`${API}/api/checkins`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj)
      });
      const data = await res.json();
      if (res.ok) { toast('打卡记录创建成功', 'success'); e.target.reset(); loadDashboard(); }
      else { toast(data.error || '创建失败', 'error'); }
    } catch (err) { toast('网络错误', 'error'); }
  });

  $('#recording-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`${API}/api/recordings`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) { toast('录音上传成功', 'success'); e.target.reset(); loadDashboard(); }
      else { toast(data.error || '上传失败', 'error'); }
    } catch (err) { toast('网络错误', 'error'); }
  });

  $('#summary-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    try {
      const res = await fetch(`${API}/api/rehearsal-summaries`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj)
      });
      const data = await res.json();
      if (res.ok) { toast('排练小结已保存', 'success'); e.target.reset(); loadDashboard(); }
      else { toast(data.error || '保存失败', 'error'); }
    } catch (err) { toast('网络错误', 'error'); }
  });
}

async function loadScores() {
  const res = await fetch(`${API}/api/scores`);
  const scores = await res.json();
  populateScoreSelects(scores);
  renderScoresTable(scores);
}

function populateScoreSelects(scores) {
  const opts = scores.map(s => `<option value="${s.id}">${s.title} (${s.voice_part})</option>`).join('');
  $('#score-select').innerHTML = `<option value="">请选择曲谱</option>` + opts;
  $('#summary-score-select').innerHTML = `<option value="">请选择曲谱</option>` + opts;
  $('#filter-score').innerHTML = `<option value="">全部曲谱</option>` + opts;
  $('#report-score').innerHTML = `<option value="">全部曲谱</option>` + opts;
}

function renderScoresTable(scores) {
  const tbody = $('#scores-table tbody');
  tbody.innerHTML = scores.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.title}</td>
      <td>${s.voice_part}</td>
      <td><a href="/api/scores/${s.id}/pdf" target="_blank" class="evidence-link">查看PDF</a></td>
      <td>${s.uploaded_at}</td>
      <td>${s.uploaded_by || '-'}</td>
    </tr>
  `).join('');
}

async function loadDashboard() {
  const res = await fetch(`${API}/api/report`);
  const report = await res.json();
  renderStats(report.overview);
  renderAnomalies(report.anomalies || []);
  renderScoresOverview(report.by_score || []);
}

function renderStats(o) {
  if (!o || !o.total_records) {
    $('#stats-row').innerHTML = '<p style="color:var(--text2)">暂无数据，请先导入曲谱和打卡记录</p>';
    return;
  }
  $('#stats-row').innerHTML = `
    <div class="stat-card"><div class="label">总打卡数</div><div class="value accent">${o.total_records}</div></div>
    <div class="stat-card"><div class="label">已确认</div><div class="value success">${o.confirmed}</div></div>
    <div class="stat-card"><div class="label">待确认</div><div class="value warning">${o.pending}</div></div>
    <div class="stat-card"><div class="label">确认率</div><div class="value accent">${o.confirmation_rate}%</div></div>
    <div class="stat-card"><div class="label">缺录音</div><div class="value error">${o.missing_recording_count}</div></div>
    <div class="stat-card"><div class="label">录音缺失率</div><div class="value error">${o.recording_missing_rate}%</div></div>
    <div class="stat-card"><div class="label">曲谱数</div><div class="value accent">${o.unique_scores}</div></div>
    <div class="stat-card"><div class="label">PDF版本数</div><div class="value">${o.unique_pdf_versions}</div></div>
  `;
}

function renderAnomalies(anomalies) {
  const sec = $('#anomalies-section');
  if (!anomalies.length) { sec.innerHTML = ''; return; }
  sec.innerHTML = `<h3 style="color:var(--warning);margin-bottom:0.75rem">异常检测 (${anomalies.length})</h3>` +
    anomalies.map(a => `
      <div class="anomaly-item ${a.severity}">
        <div class="type">${a.type}</div>
        <div class="msg">${a.message}</div>
        ${a.evidence_url ? `<a href="#" onclick="loadEvidence(${a.checkin_id || a.checkin_ids?.[0]});return false" class="evidence-link">查看证据链</a>` : ''}
      </div>
    `).join('');
}

function renderScoresOverview(scores) {
  const sec = $('#scores-overview');
  if (!scores.length) { sec.innerHTML = ''; return; }
  sec.innerHTML = scores.map(s => `
    <div class="score-section">
      <h3>${s.score_title} <span style="color:var(--text2);font-size:0.8rem">(${s.voice_part})</span>
        <a href="${s.pdf_url}" target="_blank" class="evidence-link" style="font-size:0.8rem;margin-left:0.5rem">打开曲谱PDF</a>
      </h3>
      <div class="part-bar">
        ${Object.entries(s.part_stats).map(([k, v]) => `
          <div class="part-stat">
            <span class="part-name">${k}</span>
            <span class="part-detail">${v.total}次 | 确认${v.confirmed} | 缺录音${v.missing_recording}</span>
          </div>
        `).join('')}
      </div>
      ${(s.rehearsal_summaries || []).length ? `
        <div style="margin-bottom:0.75rem">
          <div style="color:var(--text2);font-size:0.8rem;margin-bottom:0.25rem">排练小结</div>
          ${s.rehearsal_summaries.map(rs => `
            <div class="summary-item">
              <div class="meta">${rs.summary_date} ${rs.author ? '| ' + rs.author : ''}</div>
              <div class="content">${rs.content}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <table class="data-table">
        <thead><tr><th>学生</th><th>声部</th><th>日期</th><th>录音</th><th>状态</th><th>确认人</th><th>备注</th><th>证据</th></tr></thead>
        <tbody>
          ${s.records.map(r => `
            <tr>
              <td>${r.student_name}</td>
              <td>${r.voice_part}</td>
              <td>${r.checkin_date}</td>
              <td>${r.recording_url ? `<a href="${r.recording_url}" target="_blank" class="evidence-link">播放</a>` : '<span class="no-recording">无</span>'}</td>
              <td>${fmtStatus(r.status)}</td>
              <td>${r.confirmed_by || '-'}</td>
              <td class="remark-cell ${r.remark && r.remark.length > 200 ? 'remark-long' : ''}" title="${(r.remark || '').replace(/"/g, '&quot;')}">${r.remark || '-'}</td>
              <td><a href="#" onclick="loadEvidence(${r.id});return false" class="evidence-link">证据链</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

async function loadCheckins() {
  const scoreId = $('#filter-score').value;
  const status = $('#filter-status').value;
  const date = $('#filter-date').value;
  let url = `${API}/api/checkins?`;
  if (scoreId) url += `score_id=${scoreId}&`;
  if (status) url += `status=${status}&`;
  if (date) url += `date=${date}&`;

  const res = await fetch(url);
  const checkins = await res.json();
  const tbody = $('#checkins-table tbody');
  tbody.innerHTML = checkins.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.score_title || '-'}</td>
      <td>${c.student_name}</td>
      <td>${c.voice_part}</td>
      <td>${c.checkin_date}</td>
      <td>${fmtRecording(c.recording_exists ? c.recording_path : null)}</td>
      <td>${fmtStatus(c.status)}</td>
      <td>${c.confirmed_by || '-'}</td>
      <td class="remark-cell">${c.remark || '-'}</td>
      <td><a href="#" onclick="loadEvidence(${c.id});return false" class="evidence-link">证据链</a></td>
      <td>
        <div style="display:flex;gap:0.25rem;flex-wrap:wrap">
          ${c.status !== 'confirmed' ? `
            <div class="confirm-inline">
              <input type="text" placeholder="确认人" id="cf-${c.id}" style="width:80px">
              <button class="btn btn-success" onclick="confirmCheckin(${c.id})">确认</button>
            </div>
          ` : ''}
          <button class="btn btn-warning" onclick="openEditModal(${c.id})">修正</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function confirmCheckin(id) {
  const by = $(`#cf-${id}`).value.trim();
  if (!by) { toast('请输入确认人', 'error'); return; }
  const res = await fetch(`${API}/api/checkins/${id}/confirm`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed_by: by })
  });
  const data = await res.json();
  if (res.ok) { toast(data.message, 'success'); loadCheckins(); loadDashboard(); }
  else { toast(data.error, 'error'); }
}

async function openEditModal(id) {
  const res = await fetch(`${API}/api/checkins?score_id=`);
  const allRes = await fetch(`${API}/api/checkins/${id}/evidence`);
  const evidence = await allRes.json();
  const c = evidence.checkin;

  $('#edit-body').innerHTML = `
    <form id="edit-form">
      <div class="form-group">
        <label>学生姓名</label>
        <input type="text" name="student_name" value="${c.student_name || ''}">
      </div>
      <div class="form-group">
        <label>声部</label>
        <input type="text" name="voice_part" value="${c.voice_part || ''}">
      </div>
      <div class="form-group">
        <label>打卡日期</label>
        <input type="date" name="checkin_date" value="${c.checkin_date || ''}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea name="remark" rows="3">${c.remark || ''}</textarea>
      </div>
      <div class="form-group">
        <label>修正原因（必填）</label>
        <input type="text" name="reason" required placeholder="说明修正原因">
      </div>
      <div class="form-group">
        <label>操作人</label>
        <input type="text" name="operator" required placeholder="你的名字">
      </div>
      <button type="submit" class="btn btn-warning">提交修正</button>
    </form>
  `;

  $('#edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    const res = await fetch(`${API}/api/checkins/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj)
    });
    const data = await res.json();
    if (res.ok) { toast(data.message, 'success'); closeEditModal(); loadCheckins(); loadDashboard(); }
    else { toast(data.error, 'error'); }
  });

  $('#edit-modal').style.display = 'flex';
}

function closeEditModal() { $('#edit-modal').style.display = 'none'; }

async function loadEvidence(id) {
  const res = await fetch(`${API}/api/checkins/${id}/evidence`);
  const ev = await res.json();
  const c = ev.checkin;

  let html = '';

  html += `<div class="evidence-section"><h4>打卡记录 #${c.id}</h4>`;
  html += `
    <div class="evidence-field"><span class="key">学生</span><span class="val">${c.student_name}</span></div>
    <div class="evidence-field"><span class="key">声部</span><span class="val">${c.voice_part}</span></div>
    <div class="evidence-field"><span class="key">日期</span><span class="val">${c.checkin_date}</span></div>
    <div class="evidence-field"><span class="key">状态</span><span class="val">${fmtStatus(c.status)}</span></div>
    <div class="evidence-field"><span class="key">人工确认</span><span class="val">${c.manual_confirmed ? '是（' + c.confirmed_by + ' 于 ' + c.confirmed_at + '）' : '否'}</span></div>
    <div class="evidence-field"><span class="key">备注</span><span class="val">${c.remark || '无'}</span></div>
  `;
  html += `</div>`;

  html += `<div class="evidence-section"><h4>曲谱PDF（核心证据）</h4>`;
  html += `
    <div class="evidence-field"><span class="key">曲名</span><span class="val">${c.score_title}</span></div>
    <div class="evidence-field"><span class="key">声部</span><span class="val">${c.score_voice_part}</span></div>
    <div class="evidence-field"><span class="key">PDF</span><span class="val"><a href="${ev.score_pdf_url}" target="_blank" class="evidence-link">打开曲谱PDF</a></span></div>
    <div class="evidence-field"><span class="key">PDF哈希</span><span class="val" style="font-size:0.7rem;color:var(--text2)">${c.pdf_hash}</span></div>
  `;
  html += `</div>`;

  html += `<div class="evidence-section"><h4>排练录音</h4>`;
  if (ev.recording_declared_but_missing) {
    html += `<p class="recording-missing">⚠ 录音文件已登记但文件丢失！路径: ${c.recording_path}</p>`;
  } else if (ev.recording_actual_exists) {
    html += `<p><a href="${ev.recording_url}" target="_blank" class="evidence-link">播放排练录音</a></p>`;
  } else {
    html += `<p class="no-recording">无排练录音</p>`;
  }
  html += `</div>`;

  if (ev.rehearsal_summaries.length) {
    html += `<div class="evidence-section"><h4>排练小结</h4>`;
    ev.rehearsal_summaries.forEach(s => {
      html += `
        <div class="summary-item">
          <div class="meta">${s.summary_date} ${s.author ? '| ' + s.author : ''}</div>
          <div class="content">${s.content}</div>
        </div>
      `;
    });
    html += `</div>`;
  }

  if (ev.modifications.length) {
    html += `<div class="evidence-section"><h4>变更记录</h4>`;
    ev.modifications.forEach(m => {
      html += `
        <div class="mod-item">
          <span class="field">${m.field_name}</span>:
          <span class="old">${m.old_value || '(空)'}</span> →
          <span class="new">${m.new_value || '(空)'}</span>
          <span style="color:var(--text2);margin-left:0.5rem">${m.reason || ''} ${m.operator ? '| ' + m.operator : ''} | ${m.created_at}</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  $('#evidence-body').innerHTML = html;
  $('#evidence-modal').style.display = 'flex';
}

function closeModal() { $('#evidence-modal').style.display = 'none'; }

async function loadHistory() {
  const type = $('#hist-type').value;
  const operator = $('#hist-operator').value;
  let url = `${API}/api/history?`;
  if (type) url += `target_type=${type}&`;
  if (operator) url += `operator=${encodeURIComponent(operator)}&`;

  const res = await fetch(url);
  const items = await res.json();
  const tbody = $('#history-table tbody');
  tbody.innerHTML = items.map(i => `
    <tr>
      <td>${i.created_at}</td>
      <td>${i.target_type}</td>
      <td>${i.target_id}</td>
      <td>${i.field_name}</td>
      <td>${i.old_value || '-'}</td>
      <td>${i.new_value || '-'}</td>
      <td>${i.reason || '-'}</td>
      <td>${i.operator || '-'}</td>
    </tr>
  `).join('');
}

async function loadReport() {
  const scoreId = $('#report-score').value;
  const start = $('#report-start').value;
  const end = $('#report-end').value;
  let url = `${API}/api/report?`;
  if (scoreId) url += `score_id=${scoreId}&`;
  if (start) url += `start_date=${start}&`;
  if (end) url += `end_date=${end}&`;

  const res = await fetch(url);
  const report = await res.json();
  renderStats(report.overview);
  renderAnomalies(report.anomalies || []);
  const sec = $('#report-content');
  sec.innerHTML = '';

  if (report.evidence_links && report.evidence_links.length) {
    sec.innerHTML += `<h3 style="margin-bottom:0.75rem">证据链汇总表</h3>
      <table class="data-table">
        <thead><tr><th>打卡ID</th><th>学生</th><th>声部</th><th>日期</th><th>曲谱PDF</th><th>录音</th><th>确认</th><th>排练小结</th><th>证据链</th></tr></thead>
        <tbody>
          ${report.evidence_links.map(l => `
            <tr>
              <td>${l.checkin_id}</td>
              <td>${l.student_name}</td>
              <td>${l.voice_part}</td>
              <td>${l.checkin_date}</td>
              <td><a href="${l.score_pdf_url}" target="_blank" class="evidence-link">PDF</a></td>
              <td>${l.recording_url ? `<a href="${l.recording_url}" target="_blank" class="evidence-link">播放</a>` : l.recording_missing ? '<span class="recording-missing">丢失</span>' : '<span class="no-recording">无</span>'}</td>
              <td>${l.has_confirmation ? '✓ ' + (l.confirmed_by || '') : '✗'}</td>
              <td>${l.rehearsal_summaries_count || 0}篇</td>
              <td><a href="#" onclick="loadEvidence(${l.checkin_id});return false" class="evidence-link">查看</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }
}

function exportReport() {
  const scoreId = $('#report-score').value;
  const start = $('#report-start').value;
  const end = $('#report-end').value;
  let url = `${API}/api/export?`;
  if (scoreId) url += `score_id=${scoreId}&`;
  if (start) url += `start_date=${start}&`;
  if (end) url += `end_date=${end}&`;
  window.open(url, '_blank');
}
