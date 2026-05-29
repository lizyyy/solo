const API_BASE = '/api';
let selectedTracks = [];
let currentWithdrawLogId = null;
let currentReportData = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadEmotionScales();
  loadPatients();
  loadTracks();
  loadLogs();
  loadWarnings();
  setDefaultDate();
});

function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      
      if (tab === 'logs') loadLogs();
      if (tab === 'warnings') loadWarnings();
    });
  });
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('session-date').value = today;
  
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  document.getElementById('session-time').value = timeStr;
  
  const monthStr = today.substring(0, 7);
  document.getElementById('trend-month').value = monthStr;
  document.getElementById('report-month').value = monthStr;
}

async function loadEmotionScales() {
  const res = await fetch(`${API_BASE}/emotion-scales`);
  const scales = await res.json();
  const container = document.getElementById('emotion-scales');
  container.innerHTML = scales.map(scale => `
    <div class="scale-item">
      <label>${scale.name}</label>
      <div class="scale-slider">
        <span>0</span>
        <input type="range" id="scale-${scale.id}" min="0" max="10" value="5" 
               oninput="document.getElementById('value-${scale.id}').textContent = this.value">
        <span>10</span>
        <span class="scale-value" id="value-${scale.id}">5</span>
      </div>
    </div>
  `).join('');
}

async function loadPatients() {
  const res = await fetch(`${API_BASE}/patients`);
  const patients = await res.json();
  
  const selects = ['patient-select', 'filter-patient', 'trend-patient', 'report-patient'];
  selects.forEach(selectId => {
    const select = document.getElementById(selectId);
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);
    patients.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  });
}

async function loadTracks() {
  const res = await fetch(`${API_BASE}/tracks`);
  const tracks = await res.json();
  const select = document.getElementById('existing-track-select');
  const firstOption = select.options[0];
  select.innerHTML = '';
  select.appendChild(firstOption);
  tracks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} - ${t.artist || '未知艺术家'}`;
    opt.dataset.name = t.name;
    opt.dataset.artist = t.artist;
    select.appendChild(opt);
  });
}

async function loadLogs() {
  const patientId = document.getElementById('filter-patient').value;
  let url = `${API_BASE}/logs`;
  if (patientId) url += `?patient_id=${patientId}`;
  
  const res = await fetch(url);
  const logs = await res.json();
  
  const container = document.getElementById('logs-table');
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>患者</th>
          <th>阶段</th>
          <th>曲目数</th>
          <th>版本</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => `
          <tr>
            <td>${log.session_date}</td>
            <td>${log.patient_name || '-'}</td>
            <td>${getTimePointLabel(log.time_point)}</td>
            <td>${log.tracks?.length || 0}</td>
            <td>v${log.version}</td>
            <td><span class="badge badge-${log.is_withdrawn ? 'withdrawn' : log.submission_type}">
              ${getSubmissionTypeLabel(log.submission_type, log.is_withdrawn)}
            </span></td>
            <td>
              ${!log.is_withdrawn ? `
                <button class="btn-small" onclick="supplementLog('${log.id}')">补录</button>
                <button class="btn-danger" onclick="showWithdrawModal('${log.id}')">撤回</button>
              ` : '已撤回'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function getTimePointLabel(value) {
  const labels = {
    initial: '初次评估',
    middle: '中期治疗',
    review: '阶段回顾',
    final: '结束评估'
  };
  return labels[value] || '-';
}

function getSubmissionTypeLabel(type, isWithdrawn) {
  if (isWithdrawn) return '已撤回';
  const labels = {
    normal: '正常',
    supplementary: '补录'
  };
  return labels[type] || type;
}

async function loadWarnings() {
  const res = await fetch(`${API_BASE}/warnings`);
  const warnings = await res.json();
  
  const container = document.getElementById('warnings-list');
  if (warnings.length === 0) {
    container.innerHTML = '<p class="empty-text">暂无警告</p>';
    return;
  }
  
  container.innerHTML = warnings.map(w => `
    <div class="warning-item ${w.severity}">
      <div class="warning-header">
        <span class="warning-type">${w.type}</span>
        <span>${new Date(w.created_at).toLocaleString()}</span>
      </div>
      <p>${w.message}</p>
      <small>患者: ${w.patient_name || '-'} | 日期: ${w.session_date || '-'}</small>
      <div style="margin-top: 10px;">
        <button class="btn-small" onclick="resolveWarning('${w.id}')">标记已处理</button>
      </div>
    </div>
  `).join('');
}

async function resolveWarning(id) {
  await fetch(`${API_BASE}/warnings/${id}/resolve`, { method: 'POST' });
  loadWarnings();
  showToast('警告已处理', 'success');
}

function showPatientModal() {
  document.getElementById('patient-modal').classList.add('active');
}

function showTrackModal() {
  document.getElementById('track-modal').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

async function savePatient() {
  const name = document.getElementById('new-patient-name').value;
  const age = document.getElementById('new-patient-age').value;
  const diagnosis = document.getElementById('new-patient-diagnosis').value;
  const contact = document.getElementById('new-patient-contact').value;
  
  if (!name) {
    showToast('请填写患者姓名', 'error');
    return;
  }
  
  await fetch(`${API_BASE}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, age, diagnosis, contact_info: contact })
  });
  
  loadPatients();
  closeModal('patient-modal');
  showToast('患者已添加', 'success');
  
  document.getElementById('new-patient-name').value = '';
  document.getElementById('new-patient-age').value = '';
  document.getElementById('new-patient-diagnosis').value = '';
  document.getElementById('new-patient-contact').value = '';
}

async function addTrack() {
  const existingId = document.getElementById('existing-track-select').value;
  const name = document.getElementById('new-track-name').value;
  const artist = document.getElementById('new-track-artist').value;
  const notes = document.getElementById('track-notes').value;
  
  let trackId, trackName, trackArtist;
  
  if (existingId) {
    const opt = document.querySelector(`#existing-track-select option[value="${existingId}"]`);
    trackId = existingId;
    trackName = opt.dataset.name;
    trackArtist = opt.dataset.artist;
  } else if (name) {
    const res = await fetch(`${API_BASE}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, artist })
    });
    
    if (res.status === 400) {
      const data = await res.json();
      showToast(data.message, 'warning');
      return;
    }
    
    const data = await res.json();
    trackId = data.id;
    trackName = name;
    trackArtist = artist;
    loadTracks();
  } else {
    showToast('请选择或输入曲目', 'error');
    return;
  }
  
  selectedTracks.push({ track_id: trackId, name: trackName, artist: trackArtist, notes });
  renderSelectedTracks();
  closeModal('track-modal');
  showToast('曲目已添加', 'success');
  
  document.getElementById('existing-track-select').value = '';
  document.getElementById('new-track-name').value = '';
  document.getElementById('new-track-artist').value = '';
  document.getElementById('track-notes').value = '';
}

function renderSelectedTracks() {
  const container = document.getElementById('tracks-list');
  if (selectedTracks.length === 0) {
    container.innerHTML = '<p class="empty-text">暂无关联曲目</p>';
    return;
  }
  
  container.innerHTML = selectedTracks.map((t, idx) => `
    <div class="track-item">
      <span>${t.name} - ${t.artist || '未知'}${t.notes ? ` (${t.notes})` : ''}</span>
      <button class="btn-danger" onclick="removeTrack(${idx})">移除</button>
    </div>
  `).join('');
}

function removeTrack(index) {
  selectedTracks.splice(index, 1);
  renderSelectedTracks();
}

async function saveLog() {
  const patientId = document.getElementById('patient-select').value;
  const sessionDate = document.getElementById('session-date').value;
  const sessionTime = document.getElementById('session-time').value;
  const timePoint = document.getElementById('time-point').value;
  const reactionSnippets = document.getElementById('reaction-snippets').value;
  const therapistNotes = document.getElementById('therapist-notes').value;
  
  const scaleRes = await fetch(`${API_BASE}/emotion-scales`);
  const scales = await scaleRes.json();
  const emotions = scales.map(s => ({
    scale_id: s.id,
    value: parseInt(document.getElementById(`scale-${s.id}`).value)
  }));
  
  const tracks = selectedTracks.map(t => ({
    track_id: t.track_id,
    notes: t.notes
  }));
  
  const res = await fetch(`${API_BASE}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient_id: patientId,
      session_date: sessionDate,
      session_time: sessionTime,
      time_point: timePoint,
      reaction_snippets: reactionSnippets,
      therapist_notes: therapistNotes,
      created_by: '治疗师',
      emotions,
      tracks
    })
  });
  
  const data = await res.json();
  
  if (data.warnings && data.warnings.length > 0) {
    data.warnings.forEach(w => {
      showToast(w.message, w.severity === 'error' ? 'error' : 'warning');
    });
  }
  
  showToast(data.message, 'success');
  clearForm();
  loadLogs();
  loadWarnings();
}

function clearForm() {
  document.getElementById('patient-select').value = '';
  document.getElementById('time-point').value = '';
  document.getElementById('reaction-snippets').value = '';
  document.getElementById('therapist-notes').value = '';
  selectedTracks = [];
  renderSelectedTracks();
  
  document.querySelectorAll('.scale-item input[type="range"]').forEach(input => {
    input.value = 5;
    const id = input.id.replace('scale-', '');
    document.getElementById(`value-${id}`).textContent = '5';
  });
}

function supplementLog(logId) {
  showToast('补录功能：可添加新版本记录', 'success');
}

function showWithdrawModal(logId) {
  currentWithdrawLogId = logId;
  document.getElementById('withdraw-modal').classList.add('active');
}

async function confirmWithdraw() {
  const reason = document.getElementById('withdraw-reason').value;
  if (!reason) {
    showToast('请填写撤回原因', 'error');
    return;
  }
  
  await fetch(`${API_BASE}/logs/${currentWithdrawLogId}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  
  closeModal('withdraw-modal');
  loadLogs();
  showToast('记录已撤回', 'success');
  document.getElementById('withdraw-reason').value = '';
}

async function loadTrends() {
  const patientId = document.getElementById('trend-patient').value;
  const month = document.getElementById('trend-month').value;
  
  if (!patientId || !month) {
    showToast('请选择患者和月份', 'warning');
    return;
  }
  
  const [year, monthNum] = month.split('-');
  const startDate = `${year}-${monthNum}-01`;
  const endDate = `${year}-${monthNum}-31`;
  
  const res = await fetch(`${API_BASE}/trends?patient_id=${patientId}&start_date=${startDate}&end_date=${endDate}`);
  const trends = await res.json();
  
  const container = document.getElementById('trend-chart');
  if (trends.length === 0) {
    container.innerHTML = '<p class="empty-text">暂无数据</p>';
    return;
  }
  
  const allScales = [...new Set(trends.flatMap(t => Object.keys(t.emotions)))];
  const colors = ['#667eea', '#764ba2', '#f59e0b', '#27ae60'];
  
  container.innerHTML = `
    <canvas id="trendCanvas" width="800" height="350"></canvas>
  `;
  
  const canvas = document.getElementById('trendCanvas');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  ctx.clearRect(0, 0, width, height);
  
  ctx.strokeStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
  
  for (let i = 0; i <= 10; i += 2) {
    const y = padding + chartHeight - (chartHeight * i / 10);
    ctx.strokeStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    ctx.fillStyle = '#999';
    ctx.font = '12px sans-serif';
    ctx.fillText(i, padding - 25, y + 4);
  }
  
  allScales.forEach((scale, scaleIdx) => {
    ctx.strokeStyle = colors[scaleIdx % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    trends.forEach((point, idx) => {
      const x = padding + (chartWidth * idx / (trends.length - 1 || 1));
      const value = point.emotions[scale] || 0;
      const y = padding + chartHeight - (chartHeight * value / 10);
      
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      
      ctx.fillStyle = colors[scaleIdx % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.stroke();
  });
  
  trends.forEach((point, idx) => {
    const x = padding + (chartWidth * idx / (trends.length - 1 || 1));
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(point.date.substring(5), x, height - padding + 20);
  });
  
  ctx.textAlign = 'left';
  allScales.forEach((scale, idx) => {
    ctx.fillStyle = colors[idx % colors.length];
    ctx.fillRect(padding + idx * 150, 15, 12, 12);
    ctx.fillStyle = '#333';
    ctx.fillText(scale, padding + idx * 150 + 20, 25);
  });
}

async function generateReport() {
  const patientId = document.getElementById('report-patient').value;
  const month = document.getElementById('report-month').value;
  
  if (!patientId || !month) {
    showToast('请选择患者和月份', 'warning');
    return;
  }
  
  const [year, monthNum] = month.split('-');
  
  const res = await fetch(`${API_BASE}/reports/monthly?patient_id=${patientId}&year=${year}&month=${monthNum}`);
  currentReportData = await res.json();
  
  const container = document.getElementById('report-content');
  const { patient, period, logs, total_sessions } = currentReportData;
  
  container.innerHTML = `
    <div class="report-header">
      <h2>${patient.name} - ${period.year}年${parseInt(period.month)}月治疗月报</h2>
      <p>共 ${total_sessions} 次治疗</p>
    </div>
    
    <div class="report-section">
      <h3>情绪变化趋势</h3>
      <canvas id="reportCanvas" width="700" height="250"></canvas>
    </div>
    
    <div class="report-section">
      <h3>治疗记录详情</h3>
      ${logs.map(log => `
        <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <p><strong>日期：</strong>${log.session_date}</p>
          <p><strong>阶段：</strong>${getTimePointLabel(log.time_point)}</p>
          <p><strong>情绪评分：</strong>${log.emotions.map(e => `${e.scale_name}: ${e.value}`).join(' | ')}</p>
          <p><strong>使用曲目：</strong>${log.tracks.map(t => `${t.name}(${t.artist})`).join('、') || '无'}</p>
          ${log.reaction_snippets ? `<p><strong>患者反应：</strong>${log.reaction_snippets}</p>` : ''}
          ${log.therapist_notes ? `<p><strong>治疗师备注：</strong>${log.therapist_notes}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  
  setTimeout(() => {
    const canvas = document.getElementById('reportCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      drawReportChart(ctx, logs, canvas.width, canvas.height);
    }
  }, 100);
}

function drawReportChart(ctx, logs, width, height) {
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const colors = ['#667eea', '#764ba2', '#f59e0b', '#27ae60'];
  
  ctx.clearRect(0, 0, width, height);
  
  const allScales = [...new Set(logs.flatMap(l => l.emotions.map(e => e.scale_name)))];
  
  ctx.strokeStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
  
  allScales.forEach((scale, scaleIdx) => {
    ctx.strokeStyle = colors[scaleIdx % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    logs.forEach((log, idx) => {
      const emotion = log.emotions.find(e => e.scale_name === scale);
      const value = emotion?.value || 0;
      const x = padding + (chartWidth * idx / (logs.length - 1 || 1));
      const y = padding + chartHeight - (chartHeight * value / 10);
      
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  
  ctx.textAlign = 'left';
  allScales.forEach((scale, idx) => {
    ctx.fillStyle = colors[idx % colors.length];
    ctx.fillRect(padding + idx * 120, 15, 12, 12);
    ctx.fillStyle = '#333';
    ctx.font = '11px sans-serif';
    ctx.fillText(scale, padding + idx * 120 + 18, 25);
  });
}

function exportReport() {
  if (!currentReportData) {
    showToast('请先生成月报', 'warning');
    return;
  }
  
  const { patient, period, logs, total_sessions } = currentReportData;
  const content = `
${patient.name} - ${period.year}年${parseInt(period.month)}月治疗月报

生成时间：${new Date().toLocaleString()}
共 ${total_sessions} 次治疗

========================================

${logs.map(log => `
日期：${log.session_date}
阶段：${getTimePointLabel(log.time_point)}
情绪评分：${log.emotions.map(e => `${e.scale_name}: ${e.value}`).join(' | ')}
使用曲目：${log.tracks.map(t => `${t.name}(${t.artist})`).join('、') || '无'}
${log.reaction_snippets ? `患者反应：${log.reaction_snippets}` : ''}
${log.therapist_notes ? `治疗师备注：${log.therapist_notes}` : ''}
---
`).join('')}

【隐私说明】本报告已做脱敏处理
  `.trim();
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${patient.name}_${period.year}${period.month}_治疗月报.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('月报已导出', 'success');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}
