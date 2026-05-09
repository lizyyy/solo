let allStudents = [];
let currentStudentId = null;
let currentEvaluationId = null;
let selectedTags = [];
let LEVELS = [];
let POSITIVE_TAGS = [];
let NEGATIVE_TAGS = [];

const API_BASE = '/api';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function init() {
  [LEVELS, tagsData] = await Promise.all([
    fetchJSON('/levels'),
    fetchJSON('/teacher-tags')
  ]);
  POSITIVE_TAGS = tagsData.positive;
  NEGATIVE_TAGS = tagsData.negative;
  
  populateLevelSelects();
  await loadStudents();
  
  document.getElementById('addStudentForm').addEventListener('submit', addStudent);
}

function populateLevelSelects() {
  const selects = ['newStudentLevel'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = LEVELS.map(l => `<option value="${l}">${l}</option>`).join('');
    }
  });
}

async function loadStudents() {
  allStudents = await fetchJSON(`${API_BASE}/students`);
  renderStudentsTable();
  populateStudentSelects();
}

function renderStudentsTable() {
  const tbody = document.querySelector('#studentsTable tbody');
  tbody.innerHTML = allStudents.map(s => `
    <tr>
      <td>${s.id}</td>
      <td><strong>${s.name}</strong></td>
      <td><span class="badge badge-blue">${s.current_level}</span></td>
      <td>${s.join_date}</td>
      <td>${getStatusBadge(s.evaluation_status)}</td>
      <td>${s.status}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editStudent(${s.id})">编辑</button>
        <button class="btn btn-sm btn-secondary" onclick="viewStudent(${s.id})">详情</button>
        <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

function getStatusBadge(status) {
  const map = {
    'pending': '<span class="badge badge-yellow">待评估</span>',
    'recommended': '<span class="badge badge-green">建议升班</span>',
    'not_recommended': '<span class="badge badge-blue">暂不建议</span>',
    'confirmed': '<span class="badge badge-purple">已升班</span>',
    'rejected': '<span class="badge badge-red">已拒绝</span>'
  };
  return map[status] || status;
}

function populateStudentSelects() {
  const options = allStudents.map(s => `<option value="${s.id}">${s.name} - ${s.current_level}</option>`).join('');
  document.getElementById('evalStudentSelect').innerHTML = '<option value="">请选择学生</option>' + options;
  document.getElementById('importStudentSelect').innerHTML = '<option value="">请选择学生</option>' + options;
  document.getElementById('importAttendanceStudentSelect').innerHTML = '<option value="">请选择学生</option>' + options;
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

async function addStudent(e) {
  e.preventDefault();
  const student = {
    name: document.getElementById('newStudentName').value,
    current_level: document.getElementById('newStudentLevel').value,
    join_date: document.getElementById('newStudentJoinDate').value
  };
  await fetchJSON(`${API_BASE}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student)
  });
  alert('学生添加成功！');
  e.target.reset();
  await loadStudents();
}

async function editStudent(id) {
  const student = allStudents.find(s => s.id === id);
  const newName = prompt('请输入新姓名:', student.name);
  if (newName === null) return;
  await fetchJSON(`${API_BASE}/students/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  });
  await loadStudents();
}

async function deleteStudent(id) {
  if (!confirm('确定删除该学生吗？')) return;
  await fetchJSON(`${API_BASE}/students/${id}`, { method: 'DELETE' });
  await loadStudents();
}

function viewStudent(id) {
  document.getElementById('evalStudentSelect').value = id;
  switchTab('evaluation');
  loadStudentDetails();
}

async function loadStudentDetails() {
  const select = document.getElementById('evalStudentSelect');
  if (!select.value) {
    document.getElementById('studentDetails').style.display = 'none';
    return;
  }
  currentStudentId = select.value;
  document.getElementById('studentDetails').style.display = 'block';
  
  const [student, winRate, attendance] = await Promise.all([
    fetchJSON(`${API_BASE}/students/${currentStudentId}`),
    fetchJSON(`${API_BASE}/students/${currentStudentId}/winrate`),
    fetchJSON(`${API_BASE}/students/${currentStudentId}/attendance-score`)
  ]);
  
  document.getElementById('studentInfo').innerHTML = `
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-value">${student.name}</div><div class="metric-label">姓名</div></div>
      <div class="metric-card"><div class="metric-value">${student.current_level}</div><div class="metric-label">当前班次</div></div>
      <div class="metric-card"><div class="metric-value">${student.join_date}</div><div class="metric-label">入班日期</div></div>
      <div class="metric-card"><div class="metric-value">${getStatusBadge(student.evaluation_status)}</div><div class="metric-label">评估状态</div></div>
    </div>
  `;
  
  document.getElementById('winRateStats').innerHTML = `
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-value">${(winRate.current_win_rate * 100).toFixed(1)}%</div><div class="metric-label">当前胜率</div></div>
      <div class="metric-card"><div class="metric-value">${winRate.total_games}</div><div class="metric-label">总局数</div></div>
      <div class="metric-card"><div class="metric-value">${winRate.wins}/${winRate.losses}/${winRate.draws}</div><div class="metric-label">胜/负/平</div></div>
      <div class="metric-card"><div class="metric-value">${winRate.trend_analysis}</div><div class="metric-label">趋势</div></div>
    </div>
  `;
  
  renderWinRateChart(winRate.trend);
  
  document.getElementById('attendanceStats').innerHTML = `
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-value">${(attendance.score * 100).toFixed(1)}%</div><div class="metric-label">出勤率</div></div>
      <div class="metric-card"><div class="metric-value">${attendance.total}</div><div class="metric-label">总记录</div></div>
      <div class="metric-card"><div class="metric-value">${attendance.present}/${attendance.late}/${attendance.absent}</div><div class="metric-label">全勤/迟到/缺勤</div></div>
      <div class="metric-card"><div class="metric-value">${attendance.weight_reason}</div><div class="metric-label">权重说明</div></div>
    </div>
  `;
  
  renderTeacherTags();
  
  document.getElementById('evaluationResult').innerHTML = '';
  document.getElementById('parentReport').innerHTML = '';
  document.getElementById('decisionArea').style.display = 'none';
}

function renderWinRateChart(trendData) {
  const canvas = document.getElementById('winRateChart');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 280;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!trendData || trendData.length === 0) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('暂无对局数据', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  const padding = 50;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + chartWidth, y);
    ctx.stroke();
    
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'right';
    ctx.fillText(`${(100 - i * 25)}%`, padding - 10, y + 4);
  }
  
  ctx.beginPath();
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  
  trendData.forEach((point, index) => {
    const x = padding + (chartWidth / Math.max(trendData.length - 1, 1)) * index;
    const y = padding + chartHeight - (point.cumulative_win_rate * chartHeight);
    
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  trendData.forEach((point, index) => {
    const x = padding + (chartWidth / Math.max(trendData.length - 1, 1)) * index;
    const y = padding + chartHeight - (point.cumulative_win_rate * chartHeight);
    
    ctx.beginPath();
    ctx.fillStyle = point.result === 'win' ? '#27ae60' : point.result === 'lose' ? '#e74c3c' : '#f39c12';
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#27ae60';
  ctx.fillText('● 胜', padding + 40, padding - 20);
  ctx.fillStyle = '#e74c3c';
  ctx.fillText('● 负', padding + 80, padding - 20);
  ctx.fillStyle = '#f39c12';
  ctx.fillText('● 平', padding + 120, padding - 20);
}

function renderTeacherTags() {
  selectedTags = [];
  const container = document.getElementById('teacherTags');
  
  const positiveHTML = POSITIVE_TAGS.map(t => 
    `<span class="tag positive" data-tag="${t}" onclick="toggleTag(this)">${t}</span>`
  ).join('');
  const negativeHTML = NEGATIVE_TAGS.map(t => 
    `<span class="tag negative" data-tag="${t}" onclick="toggleTag(this)">${t}</span>`
  ).join('');
  
  container.innerHTML = `
    <div style="margin-bottom: 12px;">
      <strong style="color: #155724;">正面评价：</strong>
      <div class="tags-container" style="margin-top: 8px;">${positiveHTML}</div>
    </div>
    <div>
      <strong style="color: #721c24;">负面评价：</strong>
      <div class="tags-container" style="margin-top: 8px;">${negativeHTML}</div>
    </div>
  `;
}

function toggleTag(el) {
  const tag = el.dataset.tag;
  const idx = selectedTags.indexOf(tag);
  if (idx > -1) {
    selectedTags.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    selectedTags.push(tag);
    el.classList.add('selected');
  }
}

async function runEvaluation() {
  try {
    const result = await fetchJSON(`${API_BASE}/students/${currentStudentId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_tags: selectedTags })
    });
    
    currentEvaluationId = result.evaluation.id;
    const isRecommend = result.evaluation.recommendation === 'recommend_promotion';
    
    document.getElementById('evaluationResult').innerHTML = `
      <div class="alert ${isRecommend ? 'alert-success' : 'alert-warning'}">
        <strong>${isRecommend ? '✅ 建议升班' : '⚠️ 暂不建议升班'}</strong><br><br>
        ${result.evaluation.reason}
      </div>
      <div class="card" style="margin-top: 16px; background: #f8f9fa;">
        <h3>评分细项</h3>
        <table>
          <tr><th>维度</th><th>得分</th><th>权重</th><th>贡献</th></tr>
          <tr><td>胜率</td><td>${(result.breakdown.win_rate.score * 100).toFixed(1)}%</td><td>${(result.breakdown.win_rate.weight * 100).toFixed(0)}%</td><td>${(result.breakdown.win_rate.contribution * 100).toFixed(1)}%</td></tr>
          <tr><td>出勤</td><td>${(result.breakdown.attendance.score * 100).toFixed(1)}%</td><td>${(result.breakdown.attendance.weight * 100).toFixed(0)}%</td><td>${(result.breakdown.attendance.contribution * 100).toFixed(1)}%</td></tr>
          <tr><td>老师评价</td><td>${(result.breakdown.teacher_tags.score * 100).toFixed(1)}%</td><td>${(result.breakdown.teacher_tags.weight * 100).toFixed(0)}%</td><td>${(result.breakdown.teacher_tags.contribution * 100).toFixed(1)}%</td></tr>
          <tr style="background: #e3f2fd; font-weight: bold;"><td>综合</td><td colspan="2">${(result.breakdown.overall_score * 100).toFixed(1)}%</td><td>${(result.breakdown.overall_score * 100).toFixed(1)}%</td></tr>
        </table>
        ${result.breakdown.game_bonus > 0 ? `<p style="margin-top: 12px; color: #155724;"><strong>额外加分：</strong> +${(result.breakdown.game_bonus * 100).toFixed(0)}%（战胜强手/趋势向上）</p>` : ''}
      </div>
    `;
    
    if (isRecommend) {
      document.getElementById('decisionArea').style.display = 'block';
    } else {
      document.getElementById('decisionArea').style.display = 'none';
    }
    
    await loadStudents();
  } catch (err) {
    alert('评估失败: ' + err.message);
  }
}

async function confirmPromotion() {
  try {
    const comment = document.getElementById('decisionComment').value;
    const result = await fetchJSON(`${API_BASE}/students/${currentStudentId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluation_id: currentEvaluationId, comment })
    });
    alert(`升班成功！新级别：${result.new_level}`);
    await loadStudents();
    await loadStudentDetails();
  } catch (err) {
    alert('确认失败: ' + err.message);
  }
}

async function rejectPromotion() {
  try {
    const comment = document.getElementById('decisionComment').value;
    await fetchJSON(`${API_BASE}/students/${currentStudentId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluation_id: currentEvaluationId, comment })
    });
    alert('已拒绝升班');
    await loadStudents();
    await loadStudentDetails();
  } catch (err) {
    alert('拒绝失败: ' + err.message);
  }
}

async function generateReport() {
  try {
    const report = await fetchJSON(`${API_BASE}/students/${currentStudentId}/report`);
    
    const html = `
      <div class="report-section">
        <h3>📋 学生基本信息</h3>
        <table>
          <tr><td>姓名</td><td>${report.student.name}</td></tr>
          <tr><td>当前班次</td><td>${report.student.current_level}</td></tr>
          <tr><td>入班日期</td><td>${report.student.join_date}</td></tr>
          <tr><td>评估状态</td><td>${getStatusBadge(report.student.evaluation_status)}</td></tr>
        </table>
      </div>
      
      <div class="report-section">
        <h3>🎯 对局表现</h3>
        <table>
          <tr><td>当前胜率</td><td>${(report.win_rate.rate * 100).toFixed(1)}%</td></tr>
          <tr><td>总局数</td><td>${report.win_rate.total}</td></tr>
          <tr><td>胜/负/平</td><td>${report.win_rate.wins} / ${report.win_rate.losses} / ${report.win_rate.draws}</td></tr>
          <tr><td>趋势</td><td>${report.win_rate.trend}</td></tr>
        </table>
      </div>
      
      <div class="report-section">
        <h3>📅 出勤情况</h3>
        <table>
          <tr><td>出勤率</td><td>${(report.attendance.score * 100).toFixed(1)}%</td></tr>
          <tr><td>总记录</td><td>${report.attendance.total}</td></tr>
          <tr><td>全勤/迟到/缺勤</td><td>${report.attendance.present} / ${report.attendance.late} / ${report.attendance.absent}</td></tr>
        </table>
      </div>
      
      ${report.evaluation ? `
      <div class="report-section">
        <h3>📊 评估结果</h3>
        <div class="alert ${report.evaluation.recommendation === 'recommend_promotion' ? 'alert-success' : 'alert-warning'}">
          <strong>综合评分：${(report.evaluation.overall_score * 100).toFixed(1)}分</strong><br><br>
          ${report.evaluation.reason}
        </div>
        <p><strong>老师评价标签：</strong>${report.evaluation.tags.length > 0 ? report.evaluation.tags.join('、') : '无'}</p>
        <p><strong>评估时间：</strong>${report.evaluation.created_at}</p>
      </div>
      ` : '<div class="alert alert-info">暂无评估记录</div>'}
      
      ${report.decision ? `
      <div class="report-section">
        <h3>✅ 最终决策</h3>
        <table>
          <tr><td>决策</td><td>${report.decision.decision === 'promoted' ? '已升班' : '已拒绝'}</td></tr>
          <tr><td>备注</td><td>${report.decision.comment || '无'}</td></tr>
          <tr><td>决策时间</td><td>${report.decision.decided_at}</td></tr>
        </table>
      </div>
      ` : ''}
      
      <p style="margin-top: 20px; font-size: 12px; color: #999;">报告生成时间：${report.generated_at}</p>
    `;
    
    document.getElementById('parentReport').innerHTML = html;
  } catch (err) {
    alert('生成报告失败: ' + err.message);
  }
}

async function importGames() {
  try {
    const studentId = document.getElementById('importStudentSelect').value;
    if (!studentId) return alert('请选择学生');
    
    const games = JSON.parse(document.getElementById('gameImportData').value);
    const result = await fetchJSON(`${API_BASE}/students/${studentId}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games })
    });
    alert(`成功导入 ${result.count} 条对局记录`);
  } catch (err) {
    alert('导入失败: ' + err.message);
  }
}

async function importAttendances() {
  try {
    const studentId = document.getElementById('importAttendanceStudentSelect').value;
    if (!studentId) return alert('请选择学生');
    
    const attendances = JSON.parse(document.getElementById('attendanceImportData').value);
    const result = await fetchJSON(`${API_BASE}/students/${studentId}/attendances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendances })
    });
    alert(`成功导入 ${result.count} 条出勤记录`);
  } catch (err) {
    alert('导入失败: ' + err.message);
  }
}

const DEMO_DATA = {
  promote: {
    student: { name: '李明（优秀生）', current_level: '初级班', join_date: '2023-06-01' },
    games: [
      { opponent: '王强', opponent_level: '初级班', result: 'win', game_date: '2024-01-01', notes: '' },
      { opponent: '张伟', opponent_level: '初级班', result: 'win', game_date: '2024-01-08', notes: '' },
      { opponent: '刘洋', opponent_level: '中级班', result: 'win', game_date: '2024-01-15', notes: '' },
      { opponent: '陈军', opponent_level: '初级班', result: 'win', game_date: '2024-01-22', notes: '' },
      { opponent: '赵虎', opponent_level: '中级班', result: 'win', game_date: '2024-01-29', notes: '' },
      { opponent: '孙磊', opponent_level: '初级班', result: 'draw', game_date: '2024-02-05', notes: '' },
      { opponent: '周杰', opponent_level: '中级班', result: 'win', game_date: '2024-02-12', notes: '' }
    ],
    attendances: [
      { attendance_date: '2024-01-01', status: 'present' },
      { attendance_date: '2024-01-08', status: 'present' },
      { attendance_date: '2024-01-15', status: 'present' },
      { attendance_date: '2024-01-22', status: 'present' },
      { attendance_date: '2024-01-29', status: 'present' },
      { attendance_date: '2024-02-05', status: 'late' },
      { attendance_date: '2024-02-12', status: 'present' },
      { attendance_date: '2024-02-19', status: 'present' },
      { attendance_date: '2024-02-26', status: 'present' },
      { attendance_date: '2024-03-04', status: 'present' }
    ],
    tags: ['战术出色', '进攻主动', '思维敏捷', '进步明显']
  },
  marginal: {
    student: { name: '张华（边缘生）', current_level: '初级班', join_date: '2023-09-01' },
    games: [
      { opponent: '王强', opponent_level: '初级班', result: 'win', game_date: '2024-01-01', notes: '' },
      { opponent: '张伟', opponent_level: '初级班', result: 'lose', game_date: '2024-01-08', notes: '' },
      { opponent: '刘洋', opponent_level: '初级班', result: 'win', game_date: '2024-01-15', notes: '' },
      { opponent: '陈军', opponent_level: '初级班', result: 'lose', game_date: '2024-01-22', notes: '' },
      { opponent: '赵虎', opponent_level: '初级班', result: 'draw', game_date: '2024-01-29', notes: '' }
    ],
    attendances: [
      { attendance_date: '2024-01-01', status: 'present' },
      { attendance_date: '2024-01-08', status: 'absent' },
      { attendance_date: '2024-01-15', status: 'present' },
      { attendance_date: '2024-01-22', status: 'late' },
      { attendance_date: '2024-01-29', status: 'present' }
    ],
    tags: ['防守稳健', '心理波动大']
  },
  reject: {
    student: { name: '王磊（后进生）', current_level: '入门班', join_date: '2024-01-01' },
    games: [
      { opponent: '王强', opponent_level: '入门班', result: 'lose', game_date: '2024-02-01', notes: '' },
      { opponent: '张伟', opponent_level: '入门班', result: 'lose', game_date: '2024-02-08', notes: '' }
    ],
    attendances: [
      { attendance_date: '2024-02-01', status: 'absent' },
      { attendance_date: '2024-02-08', status: 'absent' },
      { attendance_date: '2024-02-15', status: 'present' }
    ],
    tags: ['失误较多', '基本功不扎实']
  }
};

async function runDemo(type) {
  const data = DEMO_DATA[type];
  const output = document.getElementById('demoOutput');
  output.innerHTML = `🚀 开始执行样例：${data.student.name}\n`;
  
  try {
    output.innerHTML += `\n📝 1/6 新增学生...`;
    const student = await fetchJSON(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.student)
    });
    output.innerHTML += ` ✓ 成功 (ID: ${student.id})`;
    
    output.innerHTML += `\n🎮 2/6 导入对局记录 (${data.games.length}条)...`;
    const gamesResult = await fetchJSON(`${API_BASE}/students/${student.id}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: data.games })
    });
    output.innerHTML += ` ✓ 成功`;
    
    output.innerHTML += `\n📅 3/6 导入出勤记录 (${data.attendances.length}条)...`;
    const attendResult = await fetchJSON(`${API_BASE}/students/${student.id}/attendances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendances: data.attendances })
    });
    output.innerHTML += ` ✓ 成功`;
    
    output.innerHTML += `\n📊 4/6 执行升班评估...\n`;
    const evalResult = await fetchJSON(`${API_BASE}/students/${student.id}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_tags: data.tags })
    });
    output.innerHTML += `   综合评分: ${(evalResult.evaluation.overall_score * 100).toFixed(1)}分\n`;
    output.innerHTML += `   胜率趋势: ${evalResult.breakdown.win_rate.trend}\n`;
    output.innerHTML += `   评估结果: ${evalResult.evaluation.reason}\n`;
    
    if (evalResult.evaluation.recommendation === 'recommend_promotion') {
      output.innerHTML += `\n✅ 5/6 确认升班...`;
      const confirmResult = await fetchJSON(`${API_BASE}/students/${student.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation_id: evalResult.evaluation.id, comment: '样例自动确认' })
      });
      output.innerHTML += ` ✓ 已升班至 ${confirmResult.new_level}`;
    } else {
      output.innerHTML += `\n❌ 5/6 不满足升班条件，跳过确认步骤`;
    }
    
    output.innerHTML += `\n📄 6/6 生成家长报告...`;
    const report = await fetchJSON(`${API_BASE}/students/${student.id}/report`);
    output.innerHTML += ` ✓ 成功`;
    
    output.innerHTML += `\n\n═══════════════════════════════════════\n`;
    output.innerHTML += `🎯 最终状态: ${report.student.current_level} (${report.student.evaluation_status})\n`;
    output.innerHTML += `═══════════════════════════════════════\n`;
    
    await loadStudents();
  } catch (err) {
    output.innerHTML += `\n❌ 错误: ${err.message}`;
  }
}

document.addEventListener('DOMContentLoaded', init);
