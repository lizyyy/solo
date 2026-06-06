const API_BASE = '';

let currentView = 'dashboard';
let currentChartType = 'bar';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadDashboard();
  bindToggleButtons();
});

function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');

  switch (view) {
    case 'dashboard': loadDashboard(); break;
    case 'songs': loadSongs(); break;
    case 'attendance': loadPhotos(); break;
    case 'practices': loadPractices(); break;
    case 'settlement': loadSettlement(); break;
    case 'logs': loadLogs(); break;
  }
}

function bindToggleButtons() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChartType = btn.dataset.chart;
      renderChart();
    });
  });
}

async function api(url, options = {}) {
  try {
    const res = await fetch(API_BASE + url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.message, 'error');
      return null;
    }
    return data.data;
  } catch (err) {
    showToast('网络请求失败，请检查服务是否启动', 'error');
    return null;
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showModal(title, bodyHtml, footerHtml = '') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml;
  document.getElementById('modalOverlay').classList.add('show');
}

function hideModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function closeModal(e) {
  if (e.target === document.getElementById('modalOverlay')) {
    hideModal();
  }
}

async function loadDashboard() {
  const stats = await api('/api/stats/summary');
  if (stats) {
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statVerified').textContent = stats.verified;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statSubstitute').textContent = stats.hasSubstitute;
    window.statsData = stats;
    renderChart();
  }

  const pending = await api('/api/practice-records?is_verified=0');
  const tbody = document.getElementById('pendingTable');
  if (!pending || pending.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-icon">✅</div>暂无待复核记录</td></tr>';
    return;
  }

  tbody.innerHTML = pending.map(p => `
    <tr>
      <td>${p.practice_date}</td>
      <td>${p.song_name}</td>
      <td>${p.part_type}</td>
      <td>${p.student_name}</td>
      <td>${p.substitute_info || '-'}</td>
      <td><span class="badge warning">${p.substitute_source || '未知'}</span></td>
      <td>
        <button class="btn success small" onclick="verifyPractice(${p.id})">复核通过</button>
        <button class="btn small" onclick="tracePractice(${p.id})">溯源</button>
      </td>
    </tr>
  `).join('');
}

function renderChart() {
  const canvas = document.getElementById('mainChart');
  const chart3d = document.getElementById('chart3d');
  const stats = window.statsData;

  if (!stats) return;

  if (currentChartType === '3d') {
    canvas.style.display = 'none';
    chart3d.style.display = 'block';
    render3DBars(stats);
  } else {
    canvas.style.display = 'block';
    chart3d.style.display = 'none';
    render2DChart(canvas, stats, currentChartType);
  }
}

function render2DChart(canvas, stats, type) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 48;
  const h = canvas.height = 280;
  ctx.clearRect(0, 0, w, h);

  const data = [
    { label: '总记录', value: stats.total, color: '#667eea' },
    { label: '已复核', value: stats.verified, color: '#52c41a' },
    { label: '待复核', value: stats.pending, color: '#faad14' },
    { label: '含替补', value: stats.hasSubstitute, color: '#ff4d4f' }
  ];

  if (type === 'pie') {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 40;
    let start = -Math.PI / 2;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;

    data.forEach(d => {
      const angle = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      start += angle;
    });

    let legendY = 20;
    data.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.fillRect(20, legendY, 12, 12);
      ctx.fillStyle = '#333';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${d.label}: ${d.value}`, 40, legendY + 10);
      legendY += 24;
    });
  } else {
    const barW = 60, gap = 40;
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const chartH = h - 60;
    const startX = (w - (barW + gap) * data.length + gap) / 2;

    data.forEach((d, i) => {
      const x = startX + i * (barW + gap);
      const barH = (d.value / maxVal) * chartH;
      const y = h - 40 - barH;

      ctx.fillStyle = d.color;
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.value, x + barW / 2, y - 8);

      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.fillText(d.label, x + barW / 2, h - 15);
    });
  }
}

function render3DBars(stats) {
  const wrap = document.getElementById('bar3dWrap');
  const data = [
    { label: '总记录', value: stats.total },
    { label: '已复核', value: stats.verified },
    { label: '待复核', value: stats.pending },
    { label: '含替补', value: stats.hasSubstitute }
  ];
  const maxVal = Math.max(...data.map(d => d.value), 1);

  wrap.innerHTML = data.map(d => {
    const h = (d.value / maxVal) * 200 + 20;
    return `
      <div class="bar-3d" style="height: ${h}px;" onclick="showToast('${d.label}: ${d.value}')">
        <div class="bar-face bar-front"></div>
        <div class="bar-face bar-back"></div>
        <div class="bar-face bar-top"></div>
        <div class="bar-face bar-right"></div>
        <div class="bar-value">${d.value}</div>
        <div class="bar-label">${d.label}</div>
      </div>
    `;
  }).join('');
}

async function loadSongs() {
  const keyword = document.getElementById('songKeyword').value;
  const partType = document.getElementById('songPartFilter').value;

  let url = '/api/song-aliases?';
  if (keyword) url += `keyword=${encodeURIComponent(keyword)}&`;
  if (partType) url += `part_type=${encodeURIComponent(partType)}`;

  const songs = await api(url);
  const tbody = document.getElementById('songsTable');

  if (!songs || songs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-icon">🎼</div>暂无曲目，请先导入</td></tr>';
    return;
  }

  tbody.innerHTML = songs.map(s => `
    <tr>
      <td><code>${s.song_code}</code></td>
      <td>${s.song_name}</td>
      <td>${s.alias || '-'}</td>
      <td><span class="badge info">${s.part_type}</span></td>
      <td>${s.remark || '-'}</td>
      <td>v${s.version}</td>
      <td>${s.updated_at}</td>
      <td>
        <button class="btn small" onclick="showSongHistory(${s.id}, '${s.song_name}')">历史</button>
      </td>
    </tr>
  `).join('');
}

function showSongImport() {
  const body = `
    <p style="margin-bottom: 16px; color: #666;">粘贴 CSV 格式数据（逗号分隔），或直接输入 JSON：</p>
    <div class="form-group">
      <label>示例格式：</label>
      <div style="background: #f5f5f5; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px;">
        song_code,song_name,alias,part_type,remark<br>
        S001,黄河大合唱,黄河,高声部,经典曲目<br>
        S002,茉莉花,,中声部,
      </div>
    </div>
    <div class="form-group">
      <label>数据内容</label>
      <textarea id="importData" rows="8" placeholder="粘贴曲目数据..."></textarea>
    </div>
  `;
  const footer = `
    <button class="btn" onclick="hideModal()">取消</button>
    <button class="btn primary" onclick="doImportSongs()">确认导入</button>
  `;
  showModal('导入曲目别名表', body, footer);
}

async function doImportSongs() {
  const text = document.getElementById('importData').value.trim();
  if (!text) {
    showToast('请输入数据内容', 'warning');
    return;
  }

  let songs;
  try {
    const lines = text.split('\n').filter(l => l.trim());
    const first = lines[0].toLowerCase();
    let startIdx = 0;
    if (first.includes('song_code') || first.includes('曲目编号')) {
      startIdx = 1;
    }
    songs = lines.slice(startIdx).map(line => {
      const cols = line.split(',').map(c => c.trim());
      return {
        song_code: cols[0],
        song_name: cols[1],
        alias: cols[2] || '',
        part_type: cols[3] || '',
        remark: cols[4] || ''
      };
    }).filter(s => s.song_code);
  } catch (e) {
    showToast('数据格式解析失败', 'error');
    return;
  }

  const result = await api('/api/song-aliases/import', {
    method: 'POST',
    body: JSON.stringify({ songs })
  });

  if (result) {
    showToast(`导入完成：新增${result.imported}条，更新${result.updated}条，跳过${result.skipped}条`);
    hideModal();
    loadSongs();
  }
}

async function showSongHistory(id, name) {
  const history = await api(`/api/song-aliases/${id}/history`);
  if (!history) return;

  const body = history.length === 0
    ? '<div class="empty-state">暂无历史记录</div>'
    : history.map(h => `
        <div class="history-item">
          <div><span class="history-field">版本 ${h.version}</span> - ${h.change_type} - ${h.changed_by}</div>
          <div class="history-values">
            名称: ${h.song_name} | 声部: ${h.part_type}<br>
            ${h.alias ? `别名: ${h.alias} | ` : ''}${h.remark ? `备注: ${h.remark}` : ''}
          </div>
          <div class="history-time">${h.changed_at}</div>
        </div>
      `).join('');

  showModal(`《${name}》版本历史`, body);
}

async function loadPhotos() {
  const date = document.getElementById('photoDateFilter').value;
  let url = '/api/attendance-photos';
  if (date) url += `?class_date=${date}`;

  const photos = await api(url);
  const grid = document.getElementById('photoGrid');

  if (!photos || photos.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-icon">📸</div>暂无签到照片</div>';
    return;
  }

  grid.innerHTML = photos.map(p => `
    <div class="photo-card" onclick="showPhotoDetail(${p.id})">
      <img src="${p.photo_path}" alt="${p.photo_name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect fill=%22%23ddd%22 width=%22200%22 height=%22150%22/><text x=%22100%22 y=%2280%22 text-anchor=%22middle%22 fill=%22%23999%22>签到照片</text></svg>'">
      <div class="photo-info">
        <div class="photo-date">${p.class_date}</div>
        <div class="photo-name">${p.photo_name}</div>
      </div>
    </div>
  `).join('');
}

function showPhotoUpload() {
  const body = `
    <div class="form-group">
      <label>上课日期 *</label>
      <input type="date" id="photoDate">
    </div>
    <div class="form-group">
      <label>签到照片 *</label>
      <input type="file" id="photoFile" accept="image/*">
    </div>
    <div class="form-group">
      <label>备注</label>
      <textarea id="photoRemark" rows="3" placeholder="选填..."></textarea>
    </div>
  `;
  const footer = `
    <button class="btn" onclick="hideModal()">取消</button>
    <button class="btn primary" onclick="doUploadPhoto()">上传</button>
  `;
  showModal('上传签到照片', body, footer);
}

async function doUploadPhoto() {
  const date = document.getElementById('photoDate').value;
  const file = document.getElementById('photoFile').files[0];
  const remark = document.getElementById('photoRemark').value;

  if (!date) { showToast('请选择上课日期', 'warning'); return; }
  if (!file) { showToast('请选择照片文件', 'warning'); return; }

  const formData = new FormData();
  formData.append('photo', file);
  formData.append('class_date', date);
  formData.append('remark', remark);

  try {
    const res = await fetch(API_BASE + '/api/attendance-photos', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.message, 'error');
      return;
    }
    showToast('照片上传成功');
    hideModal();
    loadPhotos();
  } catch (e) {
    showToast('上传失败', 'error');
  }
}

async function showPhotoDetail(id) {
  const photos = await api('/api/attendance-photos');
  const photo = photos?.find(p => p.id === id);
  if (!photo) return;

  const practices = await api(`/api/practice-records`);
  const linked = practices?.filter(p => p.attendance_photo_id === id) || [];

  const body = `
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="${photo.photo_path}" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
    </div>
    <p><strong>日期：</strong>${photo.class_date}</p>
    <p><strong>文件名：</strong>${photo.photo_name}</p>
    <p><strong>上传时间：</strong>${photo.uploaded_at}</p>
    ${photo.remark ? `<p><strong>备注：</strong>${photo.remark}</p>` : ''}
    ${linked.length > 0 ? `
      <h4 style="margin-top: 16px;">关联的练习记录</h4>
      ${linked.map(p => `
        <div class="history-item">
          <span class="trace-link" onclick="tracePractice(${p.id})">${p.student_name} - ${p.song_name} (${p.part_type})</span>
        </div>
      `).join('')}
    ` : ''}
  `;
  showModal('签到照片详情', body);
}

async function loadPractices() {
  const date = document.getElementById('practiceDateFilter').value;
  const verified = document.getElementById('practiceVerifyFilter').value;
  const hasSub = document.getElementById('practiceSubFilter').value;

  let url = '/api/practice-records?';
  if (date) url += `practice_date=${date}&`;
  if (verified !== '') url += `is_verified=${verified}&`;
  if (hasSub !== '') url += `has_substitute=${hasSub}`;

  const records = await api(url);
  const tbody = document.getElementById('practicesTable');

  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-icon">📝</div>暂无练习记录</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(p => `
    <tr class="clickable" onclick="tracePractice(${p.id})">
      <td>${p.practice_date}</td>
      <td>${p.song_name}</td>
      <td><span class="badge info">${p.part_type}</span></td>
      <td>${p.student_name}</td>
      <td>${p.attendance_status}</td>
      <td>${p.has_substitute ? `<span class="badge warning">有替补</span>` : '无'}</td>
      <td>${p.is_verified ? '<span class="badge success">已复核</span>' : '<span class="badge error">待复核</span>'}</td>
      <td>${p.photo_path ? `<span class="trace-link" onclick="event.stopPropagation(); showPhotoDetail(${p.attendance_photo_id})">查看照片</span>` : '-'}</td>
      <td onclick="event.stopPropagation();">
        ${!p.is_verified ? `<button class="btn success small" onclick="verifyPractice(${p.id})">复核</button>` : ''}
        <button class="btn small" onclick="editPractice(${p.id})">编辑</button>
      </td>
    </tr>
  `).join('');
}

async function showPracticeAdd() {
  const songs = await api('/api/song-aliases');
  const photos = await api('/api/attendance-photos');

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label>练习日期 *</label>
        <input type="date" id="pracDate">
      </div>
      <div class="form-group">
        <label>学生姓名 *</label>
        <input type="text" id="pracStudent" placeholder="请输入学生姓名">
      </div>
    </div>
    <div class="form-group">
      <label>曲目 *</label>
      <select id="pracSong">
        <option value="">请选择曲目</option>
        ${(songs || []).map(s => `<option value="${s.song_code}">${s.song_code} - ${s.song_name} (${s.part_type})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>签到照片</label>
      <select id="pracPhoto">
        <option value="">无</option>
        ${(photos || []).map(p => `<option value="${p.id}">${p.class_date} - ${p.photo_name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <div class="checkbox-wrap">
        <input type="checkbox" id="pracHasSub" onchange="toggleSubInputs()">
        <label for="pracHasSub" style="margin:0;">存在临时替补</label>
      </div>
    </div>
    <div id="subInputs" style="display: none;">
      <div class="form-row">
        <div class="form-group">
          <label>替补来源</label>
          <select id="pracSubSource">
            <option value="群消息">群消息（需复核）</option>
            <option value="书面通知">书面通知</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group">
          <label>替补人员</label>
          <input type="text" id="pracSubInfo" placeholder="请输入替补人员姓名">
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>备注</label>
      <textarea id="pracRemark" rows="2"></textarea>
    </div>
  `;
  const footer = `
    <button class="btn" onclick="hideModal()">取消</button>
    <button class="btn primary" onclick="doAddPractice()">保存</button>
  `;
  showModal('新增练习记录', body, footer);
}

function toggleSubInputs() {
  const checked = document.getElementById('pracHasSub').checked;
  document.getElementById('subInputs').style.display = checked ? 'block' : 'none';
}

async function doAddPractice() {
  const song_code = document.getElementById('pracSong').value;
  const practice_date = document.getElementById('pracDate').value;
  const student_name = document.getElementById('pracStudent').value;
  const has_substitute = document.getElementById('pracHasSub').checked ? 1 : 0;
  const substitute_source = has_substitute ? document.getElementById('pracSubSource').value : '';
  const substitute_info = has_substitute ? document.getElementById('pracSubInfo').value : '';
  const attendance_photo_id = document.getElementById('pracPhoto').value || null;
  const remark = document.getElementById('pracRemark').value;

  if (!practice_date) { showToast('请选择练习日期', 'warning'); return; }
  if (!song_code) { showToast('请选择曲目', 'warning'); return; }
  if (!student_name) { showToast('请输入学生姓名', 'warning'); return; }

  const result = await api('/api/practice-records', {
    method: 'POST',
    body: JSON.stringify({
      practice_date, song_code, student_name,
      has_substitute, substitute_info, substitute_source,
      attendance_photo_id, remark
    })
  });

  if (result) {
    const msg = has_substitute && substitute_source === '群消息'
      ? '记录已保存，临时替补已标记为待复核'
      : '记录已保存';
    showToast(msg, has_substitute ? 'warning' : 'success');
    hideModal();
    loadPractices();
    loadDashboard();
  }
}

async function verifyPractice(id) {
  if (!confirm('确认复核通过该记录？')) return;

  const result = await api(`/api/practice-records/${id}/verify`, {
    method: 'PUT',
    body: JSON.stringify({ verified_by: '票务同事' })
  });

  if (result !== null) {
    showToast('复核通过');
    loadPractices();
    loadDashboard();
  }
}

async function editPractice(id) {
  const detail = await api(`/api/practice-records/${id}`);
  if (!detail) return;

  const body = `
    <div class="form-group">
      <label>备注</label>
      <textarea id="editRemark" rows="3">${detail.remark || ''}</textarea>
    </div>
    <div class="form-group">
      <label>签到状态</label>
      <select id="editStatus">
        <option value="正常" ${detail.attendance_status === '正常' ? 'selected' : ''}>正常</option>
        <option value="请假" ${detail.attendance_status === '请假' ? 'selected' : ''}>请假</option>
        <option value="缺席" ${detail.attendance_status === '缺席' ? 'selected' : ''}>缺席</option>
      </select>
    </div>
    <div class="form-group">
      <label>替补信息</label>
      <input type="text" id="editSubInfo" value="${detail.substitute_info || ''}">
    </div>
    ${detail.history && detail.history.length > 0 ? `
      <h4 style="margin-top: 16px;">修改历史</h4>
      ${detail.history.map(h => `
        <div class="history-item">
          <div class="history-field">${h.field_name}</div>
          <div class="history-values">
            改前: ${h.old_value || '-'} → 改后: ${h.new_value || '-'}
          </div>
          <div class="history-time">${h.changed_by} - ${h.changed_at}</div>
        </div>
      `).join('')}
    ` : ''}
  `;
  const footer = `
    <button class="btn" onclick="hideModal()">取消</button>
    <button class="btn primary" onclick="doEditPractice(${id})">保存修改</button>
  `;
  showModal('编辑练习记录', body, footer);
}

async function doEditPractice(id) {
  const remark = document.getElementById('editRemark').value;
  const attendance_status = document.getElementById('editStatus').value;
  const substitute_info = document.getElementById('editSubInfo').value;

  const result = await api(`/api/practice-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ remark, attendance_status, substitute_info })
  });

  if (result) {
    showToast('修改已保存');
    hideModal();
    loadPractices();
  }
}

async function tracePractice(id) {
  const detail = await api(`/api/practice-records/${id}`);
  if (!detail) return;

  const body = `
    <h4>练习记录详情</h4>
    <p><strong>日期：</strong>${detail.practice_date}</p>
    <p><strong>学生：</strong>${detail.student_name}</p>
    <p><strong>曲目：</strong>
      <span class="trace-link" onclick="switchView('songs'); hideModal();">${detail.song_name} (${detail.part_type})</span>
      ${detail.song_alias ? `【别名：${detail.song_alias}】` : ''}
    </p>
    <p><strong>状态：</strong>${detail.attendance_status}</p>
    <p><strong>复核：</strong>${detail.is_verified ? `<span class="badge success">已通过 ${detail.verified_by || ''}</span>` : '<span class="badge error">待复核</span>'}</p>
    ${detail.has_substitute ? `
      <p><strong>临时替补：</strong>${detail.substitute_info || '已标记'}</p>
      <p><strong>替补来源：</strong><span class="badge warning">${detail.substitute_source || '未知'}</span></p>
    ` : ''}
    ${detail.photo_path ? `
      <p><strong>签到照片：</strong>
        <span class="trace-link" onclick="showPhotoDetail(${detail.attendance_photo_id})">点击查看</span>
      </p>
    ` : ''}
    ${detail.remark ? `<p><strong>备注：</strong>${detail.remark}</p>` : ''}

    ${detail.history && detail.history.length > 0 ? `
      <h4 style="margin-top: 16px;">变更历史</h4>
      ${detail.history.map(h => `
        <div class="history-item">
          <div class="history-field">${h.field_name}</div>
          <div class="history-values">
            改前: "${h.old_value || '-'}" → 改后: "${h.new_value || '-'}"
          </div>
          <div class="history-time">${h.changed_by} @ ${h.changed_at}</div>
        </div>
      `).join('')}
    ` : ''}
  `;
  showModal('记录溯源', body);
}

async function loadSettlement() {
  const date = document.getElementById('settlementDateFilter').value;
  let url = '/api/settlement';
  if (date) url += `?practice_date=${date}`;

  const details = await api(url);
  const tbody = document.getElementById('settlementTable');

  if (!details || details.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-icon">💰</div>暂无分账明细</td></tr>';
    return;
  }

  const total = details.reduce((s, d) => s + (d.total_amount || 0), 0);

  tbody.innerHTML = details.map(d => `
    <tr>
      <td>${d.practice_date}</td>
      <td>${d.student_name}</td>
      <td>${d.song_name}</td>
      <td><span class="badge info">${d.part_type}</span></td>
      <td>${d.class_count}</td>
      <td>¥${d.unit_price?.toFixed(2) || '0.00'}</td>
      <td><strong>¥${d.total_amount?.toFixed(2) || '0.00'}</strong></td>
      <td><span class="badge ${d.status === '待结算' ? 'warning' : 'success'}">${d.status}</span></td>
    </tr>
  `).join('') + `
    <tr style="background: #f9f9ff; font-weight: 600;">
      <td colspan="6" style="text-align: right;">合计：</td>
      <td>¥${total.toFixed(2)}</td>
      <td></td>
    </tr>
  `;
}

async function generateSettlement() {
  const date = prompt('请输入要生成分账的日期（YYYY-MM-DD）：', new Date().toISOString().split('T')[0]);
  if (!date) return;

  const result = await api('/api/settlement/generate', {
    method: 'POST',
    body: JSON.stringify({ practice_date: date })
  });

  if (result) {
    showToast(result.length > 0 ? `已生成 ${result.length} 条分账明细` : '该日期没有可生成的记录');
    loadSettlement();
  }
}

async function loadLogs() {
  const logs = await api('/api/operation-logs');
  const tbody = document.getElementById('logsTable');

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-icon">📋</div>暂无操作日志</div></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td>${l.operation_time}</td>
      <td>${l.operation_type}</td>
      <td>${l.operator}</td>
      <td>${l.table_name || '-'}</td>
      <td>${l.record_id || '-'}</td>
    </tr>
  `).join('');
}
