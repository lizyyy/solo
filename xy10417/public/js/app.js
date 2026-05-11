let interviews = [];
let positions = [];
let candidates = [];
let hrs = [];
let currentTab = 'kanban';

document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
});

async function loadAllData() {
  await Promise.all([
    loadPositions(),
    loadCandidates(),
    loadHRs(),
    loadInterviews(),
    loadHighRisk()
  ]);
}

async function loadPositions() {
  try {
    const res = await fetch('/api/positions');
    positions = await res.json();
    
    const filterSelect = document.getElementById('filterPosition');
    const intSelect = document.getElementById('intPosition');
    
    filterSelect.innerHTML = '<option value="">全部岗位</option>';
    intSelect.innerHTML = '';
    
    positions.forEach(pos => {
      filterSelect.innerHTML += `<option value="${pos.id}">${pos.name}</option>`;
      intSelect.innerHTML += `<option value="${pos.id}">${pos.name} (${pos.department || '无部门'})</option>`;
    });
  } catch (e) {
    console.error('加载岗位失败', e);
  }
}

async function loadCandidates() {
  try {
    const res = await fetch('/api/candidates');
    candidates = await res.json();
    
    const intSelect = document.getElementById('intCandidate');
    intSelect.innerHTML = '';
    
    candidates.forEach(cand => {
      let disabled = cand.is_blacklisted ? 'disabled' : '';
      let badge = cand.is_blacklisted ? ' [黑名单]' : (cand.risk_level !== 'normal' ? ` [${getRiskLabel(cand.risk_level)}]` : '');
      intSelect.innerHTML += `<option value="${cand.id}" ${disabled}>${cand.name}${badge}</option>`;
    });
  } catch (e) {
    console.error('加载候选人失败', e);
  }
}

async function loadHRs() {
  try {
    const res = await fetch('/api/hrs');
    hrs = await res.json();
    
    const filterSelect = document.getElementById('filterHR');
    filterSelect.innerHTML = '<option value="">全部HR</option>';
    
    hrs.forEach(hr => {
      if (hr) {
        filterSelect.innerHTML += `<option value="${hr}">${hr}</option>`;
      }
    });
  } catch (e) {
    console.error('加载HR失败', e);
  }
}

async function loadInterviews() {
  try {
    const posId = document.getElementById('filterPosition').value;
    const hrName = document.getElementById('filterHR').value;
    
    let url = '/api/interviews';
    if (posId || hrName) {
      url += '?';
      if (posId) url += `position_id=${posId}&`;
      if (hrName) url += `hr_name=${encodeURIComponent(hrName)}`;
    }
    
    const res = await fetch(url);
    interviews = await res.json();
    
    renderKanban();
    renderList();
    updateCounts();
  } catch (e) {
    console.error('加载面试失败', e);
  }
}

async function loadHighRisk() {
  try {
    const res = await fetch('/api/stats/weekly');
    const data = await res.json();
    
    const list = document.getElementById('highRiskList');
    list.innerHTML = '';
    
    if (data.high_risk_candidates.length === 0) {
      list.innerHTML = '<div style="color:#888;font-size:0.85rem;">暂无高风险候选人</div>';
      return;
    }
    
    data.high_risk_candidates.forEach(cand => {
      const isBlacklisted = cand.is_blacklisted;
      list.innerHTML += `
        <div class="high-risk-item ${isBlacklisted ? 'blacklisted' : ''}">
          <div class="name">${cand.name} ${isBlacklisted ? '🚫' : '⚠️'}</div>
          <div class="info">爽约次数: ${cand.no_show_count} | 面试次数: ${cand.interview_count}</div>
          <div class="info">${cand.phone || '无电话'}</div>
        </div>
      `;
    });
  } catch (e) {
    console.error('加载高风险候选人失败', e);
  }
}

function updateCounts() {
  const scheduled = interviews.filter(i => i.status === 'scheduled').length;
  const rescheduled = interviews.filter(i => i.status === 'rescheduled').length;
  const completed = interviews.filter(i => i.status === 'completed').length;
  
  document.getElementById('scheduledCount').textContent = scheduled;
  document.getElementById('rescheduledCount').textContent = rescheduled;
  document.getElementById('completedCount').textContent = completed;
}

function renderKanban() {
  const scheduledCol = document.getElementById('scheduledColumn');
  const rescheduledCol = document.getElementById('rescheduledColumn');
  const completedCol = document.getElementById('completedColumn');
  
  scheduledCol.innerHTML = '';
  rescheduledCol.innerHTML = '';
  completedCol.innerHTML = '';
  
  interviews.forEach(interview => {
    const card = createCard(interview);
    if (interview.status === 'scheduled') {
      scheduledCol.innerHTML += card;
    } else if (interview.status === 'rescheduled') {
      rescheduledCol.innerHTML += card;
    } else if (interview.status === 'completed') {
      completedCol.innerHTML += card;
    }
  });
}

function renderList() {
  const tbody = document.getElementById('interviewTableBody');
  tbody.innerHTML = '';
  
  interviews.forEach(interview => {
    tbody.innerHTML += `
      <tr>
        <td>
          <strong>${interview.candidate_name}</strong>
          ${interview.risk_level !== 'normal' ? `<span class="risk-badge ${interview.risk_level}">${getRiskLabel(interview.risk_level)}</span>` : ''}
        </td>
        <td>${interview.position_name}</td>
        <td>${interview.hr_name}</td>
        <td>${formatTime(interview.scheduled_time)}</td>
        <td><span class="status-badge ${interview.status}">${getStatusLabel(interview.status, interview.checkin_status)}</span></td>
        <td><span class="risk-badge ${interview.risk_level}">${getRiskLabel(interview.risk_level)}</span></td>
        <td>
          <button class="action-btn view" onclick="showDetail(${interview.id})">查看</button>
          ${interview.status !== 'completed' ? `
            <button class="action-btn checkin" onclick="showCheckin(${interview.id})">签到</button>
            <button class="action-btn reschedule" onclick="showReschedule(${interview.id})">改期</button>
          ` : ''}
          ${interview.checkin_status === 'no_show' ? `
            <button class="action-btn decision" onclick="showDecision(${interview.id})">处理</button>
          ` : ''}
        </td>
      </tr>
    `;
  });
}

function createCard(interview) {
  const riskClass = `risk-${interview.risk_level}`;
  return `
    <div class="card ${riskClass}" onclick="showDetail(${interview.id})">
      <div class="candidate">
        ${interview.candidate_name}
        ${interview.risk_level !== 'normal' ? `<span class="risk-badge ${interview.risk_level}">${getRiskLabel(interview.risk_level)}</span>` : ''}
      </div>
      <div class="position">${interview.position_name}</div>
      <div class="time">⏰ ${formatTime(interview.scheduled_time)}</div>
      <div class="hr">👤 ${interview.hr_name}</div>
      <div style="margin-top:0.5rem;">
        <span class="status-badge ${interview.status}">${getStatusLabel(interview.status, interview.checkin_status)}</span>
        ${interview.reschedule_count > 0 ? `<span style="font-size:0.75rem;color:#888;">改期${interview.reschedule_count}次</span>` : ''}
      </div>
    </div>
  `;
}

function getRiskLabel(level) {
  const labels = {
    normal: '正常',
    medium: '中风险',
    high: '高风险',
    blacklisted: '黑名单'
  };
  return labels[level] || '正常';
}

function getStatusLabel(status, checkin) {
  if (status === 'completed') {
    if (checkin === 'attended') return '已参加';
    if (checkin === 'no_show') return '爽约';
    return '已完成';
  }
  if (status === 'rescheduled') return '已改期';
  if (status === 'scheduled') return '待面试';
  return status;
}

function formatTime(isoStr) {
  if (!isoStr) return '-';
  const date = new Date(isoStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  if (tab === 'kanban') {
    document.getElementById('kanbanView').classList.remove('hidden');
    document.getElementById('listView').classList.add('hidden');
  } else {
    document.getElementById('kanbanView').classList.add('hidden');
    document.getElementById('listView').classList.remove('hidden');
  }
}

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function clearFilters() {
  document.getElementById('filterPosition').value = '';
  document.getElementById('filterHR').value = '';
  loadInterviews();
}

function showAddPositionModal() {
  document.getElementById('positionForm').reset();
  showModal('addPositionModal');
}

function showAddCandidateModal() {
  document.getElementById('candidateForm').reset();
  showModal('addCandidateModal');
}

function showAddInterviewModal() {
  document.getElementById('interviewForm').reset();
  showModal('addInterviewModal');
}

async function addPosition(e) {
  e.preventDefault();
  const name = document.getElementById('posName').value;
  const department = document.getElementById('posDepartment').value;
  const hr_name = document.getElementById('posHR').value;
  
  try {
    const res = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, department, hr_name })
    });
    
    if (res.ok) {
      hideModal('addPositionModal');
      await loadPositions();
      await loadHRs();
    } else {
      const err = await res.json();
      alert(err.error || '添加失败');
    }
  } catch (e) {
    alert('添加失败: ' + e.message);
  }
}

async function addCandidate(e) {
  e.preventDefault();
  const name = document.getElementById('candName').value;
  const phone = document.getElementById('candPhone').value;
  const email = document.getElementById('candEmail').value;
  
  try {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email })
    });
    
    if (res.ok) {
      hideModal('addCandidateModal');
      await loadCandidates();
      await loadHighRisk();
    } else {
      const err = await res.json();
      alert(err.error || '添加失败');
    }
  } catch (e) {
    alert('添加失败: ' + e.message);
  }
}

async function addInterview(e) {
  e.preventDefault();
  const position_id = parseInt(document.getElementById('intPosition').value);
  const candidate_id = parseInt(document.getElementById('intCandidate').value);
  const hr_name = document.getElementById('intHR').value;
  const scheduled_time = new Date(document.getElementById('intTime').value).toISOString();
  const notes = document.getElementById('intNotes').value;
  
  try {
    const res = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position_id, candidate_id, hr_name, scheduled_time, notes })
    });
    
    if (res.ok) {
      hideModal('addInterviewModal');
      await loadInterviews();
      await loadHighRisk();
    } else {
      const err = await res.json();
      alert(err.error || '添加失败');
    }
  } catch (e) {
    alert('添加失败: ' + e.message);
  }
}

async function showDetail(id) {
  try {
    const interview = interviews.find(i => i.id === id);
    if (!interview) return;
    
    const timelineRes = await fetch(`/api/interviews/${id}/timeline`);
    const timeline = await timelineRes.json();
    
    const rescheduleRes = await fetch(`/api/interviews/${id}/reschedule-requests`);
    const rescheduleRequests = await rescheduleRes.json();
    
    const content = `
      <div class="detail-section">
        <h3>📋 基本信息</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <div class="label">候选人</div>
            <div class="value">${interview.candidate_name} 
              <span class="risk-badge ${interview.risk_level}">${getRiskLabel(interview.risk_level)}</span>
            </div>
          </div>
          <div class="detail-item">
            <div class="label">岗位</div>
            <div class="value">${interview.position_name}</div>
          </div>
          <div class="detail-item">
            <div class="label">HR</div>
            <div class="value">${interview.hr_name}</div>
          </div>
          <div class="detail-item">
            <div class="label">状态</div>
            <div class="value"><span class="status-badge ${interview.status}">${getStatusLabel(interview.status, interview.checkin_status)}</span></div>
          </div>
          <div class="detail-item">
            <div class="label">安排时间</div>
            <div class="value">${formatTime(interview.scheduled_time)}</div>
          </div>
          <div class="detail-item">
            <div class="label">改期次数</div>
            <div class="value">${interview.reschedule_count} 次</div>
          </div>
          ${interview.actual_signin_time ? `
          <div class="detail-item">
            <div class="label">签到时间</div>
            <div class="value">${formatTime(interview.actual_signin_time)}</div>
          </div>` : ''}
        </div>
      </div>

      ${rescheduleRequests.length > 0 ? `
      <div class="detail-section">
        <h3>🔄 改期申请记录</h3>
        ${rescheduleRequests.map(req => `
          <div class="detail-item" style="margin-bottom:0.5rem;">
            <div><strong>申请时间:</strong> ${formatTime(req.requested_time)}</div>
            <div><strong>原因:</strong> ${req.reason || '无'}</div>
            <div><strong>状态:</strong> ${req.status} ${req.reviewer ? `| 审核人: ${req.reviewer}` : ''}</div>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="detail-section">
        <h3>⏱️ 操作时间线</h3>
        <div class="timeline">
          ${timeline.map(t => `
            <div class="timeline-item">
              <div class="time">${formatTime(t.created_at)}</div>
              <div class="action">${t.action}</div>
              ${t.details ? `<div class="details">${t.details}</div>` : ''}
              <div class="actor">- ${t.actor}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="detail-section">
        <h3>⚡ 快捷操作</h3>
        <div style="display:flex;gap:0.5rem;">
          ${interview.status !== 'completed' ? `
            <button class="action-btn checkin" onclick="hideModal('detailModal');showCheckin(${id})">✅ 签到</button>
            <button class="action-btn reschedule" onclick="hideModal('detailModal');showReschedule(${id})">🔄 改期</button>
          ` : ''}
          ${interview.checkin_status === 'no_show' ? `
            <button class="action-btn decision" onclick="hideModal('detailModal');showDecision(${id})">📝 处理</button>
          ` : ''}
        </div>
      </div>
    `;
    
    document.getElementById('detailContent').innerHTML = content;
    showModal('detailModal');
  } catch (e) {
    alert('加载详情失败: ' + e.message);
  }
}

async function showCheckin(id) {
  const interview = interviews.find(i => i.id === id);
  if (!interview) return;
  
  const now = new Date().toISOString().slice(0, 16);
  
  const content = `
    <h3>面试签到</h3>
    <p style="margin-bottom:1rem;"><strong>${interview.candidate_name}</strong> - ${interview.position_name}</p>
    <p style="margin-bottom:1rem;">安排时间: ${formatTime(interview.scheduled_time)}</p>
    
    <div class="form-group">
      <label>签到状态</label>
      <select id="checkinStatus">
        <option value="attended">✅ 正常参加</option>
        <option value="no_show">❌ 爽约未到</option>
      </select>
    </div>
    <div class="form-group">
      <label>实际时间</label>
      <input type="datetime-local" id="checkinTime" value="${now}">
    </div>
    
    <div class="form-actions">
      <button onclick="hideModal('detailModal')">取消</button>
      <button onclick="submitCheckin(${id})">确认</button>
    </div>
  `;
  
  document.getElementById('detailContent').innerHTML = content;
  showModal('detailModal');
}

async function submitCheckin(id) {
  const status = document.getElementById('checkinStatus').value;
  const time = new Date(document.getElementById('checkinTime').value).toISOString();
  
  try {
    const res = await fetch(`/api/interviews/${id}/checkin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkin_status: status, actual_signin_time: time })
    });
    
    if (res.ok) {
      hideModal('detailModal');
      await loadInterviews();
      await loadHighRisk();
    } else {
      const err = await res.json();
      alert(err.error || '操作失败');
    }
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

async function showReschedule(id) {
  const interview = interviews.find(i => i.id === id);
  if (!interview) return;
  
  const content = `
    <h3>申请改期</h3>
    <p style="margin-bottom:1rem;"><strong>${interview.candidate_name}</strong> - ${interview.position_name}</p>
    <p style="margin-bottom:1rem;">原时间: ${formatTime(interview.scheduled_time)}</p>
    
    <div class="form-group">
      <label>申请时间 *</label>
      <input type="datetime-local" id="rescheduleTime" required>
    </div>
    <div class="form-group">
      <label>改期原因</label>
      <textarea id="rescheduleReason" rows="3" placeholder="请输入改期原因..."></textarea>
    </div>
    <div class="form-group">
      <label>审核人</label>
      <input type="text" id="rescheduleReviewer" placeholder="请输入审核人姓名">
    </div>
    
    <div class="form-actions">
      <button onclick="hideModal('detailModal')">取消</button>
      <button onclick="submitReschedule(${id})">提交申请并审批通过</button>
    </div>
  `;
  
  document.getElementById('detailContent').innerHTML = content;
  showModal('detailModal');
}

async function submitReschedule(id) {
  const requestedTime = document.getElementById('rescheduleTime').value;
  const reason = document.getElementById('rescheduleReason').value;
  const reviewer = document.getElementById('rescheduleReviewer').value || 'HR';
  
  if (!requestedTime) {
    alert('请选择新的面试时间');
    return;
  }
  
  try {
    const reqRes = await fetch(`/api/interviews/${id}/reschedule-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        requested_time: new Date(requestedTime).toISOString(), 
        reason 
      })
    });
    
    if (!reqRes.ok) {
      const err = await reqRes.json();
      alert(err.error || '申请失败');
      return;
    }
    
    const reqData = await reqRes.json();
    
    const approveRes = await fetch(`/api/reschedule-requests/${reqData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', reviewer })
    });
    
    if (approveRes.ok) {
      hideModal('detailModal');
      await loadInterviews();
    } else {
      const err = await approveRes.json();
      alert(err.error || '审批失败');
    }
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

async function showDecision(id) {
  const interview = interviews.find(i => i.id === id);
  if (!interview) return;
  
  const content = `
    <h3>爽约处理决定</h3>
    <p style="margin-bottom:1rem;"><strong>${interview.candidate_name}</strong> - ${interview.position_name}</p>
    <p style="margin-bottom:1rem;color:#e74c3c;">⚠️ 该候选人爽约，爽约次数: ${interview.no_show_count}</p>
    
    <div class="form-group">
      <label>处理方式</label>
      <select id="decisionType" onchange="toggleDecisionOptions()">
        <option value="followup">📞 标记待跟进</option>
        <option value="reschedule">🔄 同意复约</option>
        <option value="blacklist">🚫 加入黑名单</option>
      </select>
    </div>
    <div class="form-group">
      <label>备注说明</label>
      <textarea id="decisionNotes" rows="3" placeholder="请输入备注..."></textarea>
    </div>
    <div class="form-group">
      <label>操作人</label>
      <input type="text" id="decisionActor" placeholder="请输入操作人姓名">
    </div>
    
    <div class="form-actions">
      <button onclick="hideModal('detailModal')">取消</button>
      <button onclick="submitDecision(${id})">确认处理</button>
    </div>
  `;
  
  document.getElementById('detailContent').innerHTML = content;
  showModal('detailModal');
}

async function submitDecision(id) {
  const type = document.getElementById('decisionType').value;
  const notes = document.getElementById('decisionNotes').value;
  const actor = document.getElementById('decisionActor').value || 'HR';
  
  let decision = 'mark';
  if (type === 'reschedule') decision = 'rebook';
  if (type === 'blacklist') decision = 'add';
  
  try {
    const res = await fetch(`/api/interviews/${id}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, decision, notes, actor })
    });
    
    if (res.ok) {
      hideModal('detailModal');
      await loadInterviews();
      await loadHighRisk();
    } else {
      const err = await res.json();
      alert(err.error || '操作失败');
    }
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

async function showStatsModal() {
  try {
    const res = await fetch('/api/stats/weekly');
    const data = await res.json();
    
    const content = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="number">${data.total_interviews}</div>
          <div class="label">本周总面试</div>
        </div>
        <div class="stat-card green">
          <div class="number">${data.completion_rate}%</div>
          <div class="label">完成率</div>
        </div>
        <div class="stat-card red">
          <div class="number">${data.no_show_rate}%</div>
          <div class="label">爽约率</div>
        </div>
        <div class="stat-card orange">
          <div class="number">${data.followup_list.length}</div>
          <div class="label">待跟进</div>
        </div>
      </div>

      <div class="detail-section">
        <h3>📊 详细数据</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <div class="label">总面试数</div>
            <div class="value">${data.total_interviews}</div>
          </div>
          <div class="detail-item">
            <div class="label">已完成</div>
            <div class="value">${data.completed_interviews}</div>
          </div>
          <div class="detail-item">
            <div class="label">正常参加</div>
            <div class="value">${data.attended_count}</div>
          </div>
          <div class="detail-item">
            <div class="label">爽约数</div>
            <div class="value">${data.no_show_count}</div>
          </div>
        </div>
      </div>

      ${data.followup_list.length > 0 ? `
      <div class="followup-list">
        <h4>📞 待跟进名单 (${data.followup_list.length}人)</h4>
        ${data.followup_list.map(item => `
          <div class="followup-item">
            <strong>${item.candidate_name}</strong> - ${item.position_name}
            <br><small>${item.phone || '无电话'} | ${formatTime(item.scheduled_time)}</small>
          </div>
        `).join('')}
      </div>` : ''}

      ${data.high_risk_candidates.length > 0 ? `
      <div class="detail-section">
        <h3>⚠️ 高风险候选人</h3>
        ${data.high_risk_candidates.map(c => `
          <div class="detail-item" style="margin-bottom:0.5rem;">
            <strong>${c.name}</strong> ${c.is_blacklisted ? '🚫 黑名单' : '⚠️ 高风险'}
            <br><small>爽约${c.no_show_count}次 | ${c.phone || '无电话'}</small>
          </div>
        `).join('')}
      </div>` : ''}
    `;
    
    document.getElementById('statsContent').innerHTML = content;
    showModal('statsModal');
  } catch (e) {
    alert('加载统计失败: ' + e.message);
  }
}

async function exportWeeklyReport() {
  try {
    const res = await fetch('/api/stats/weekly');
    const data = await res.json();
    
    let csv = '\ufeff';
    csv += '招聘面试周报\n';
    csv += `统计周期,${new Date(data.week_start).toLocaleDateString('zh-CN')} - ${new Date(data.week_end).toLocaleDateString('zh-CN')}\n\n`;
    
    csv += '关键指标\n';
    csv += '总面试数,已完成,正常参加,爽约数,完成率,爽约率\n';
    csv += `${data.total_interviews},${data.completed_interviews},${data.attended_count},${data.no_show_count},${data.completion_rate}%,${data.no_show_rate}%\n\n`;
    
    if (data.followup_list.length > 0) {
      csv += '待跟进名单\n';
      csv += '候选人,岗位,电话,邮箱,爽约时间\n';
      data.followup_list.forEach(item => {
        csv += `${item.candidate_name},${item.position_name},${item.phone || ''},${item.email || ''},${formatTime(item.scheduled_time)}\n`;
      });
      csv += '\n';
    }
    
    if (data.high_risk_candidates.length > 0) {
      csv += '高风险候选人\n';
      csv += '姓名,电话,爽约次数,是否黑名单\n';
      data.high_risk_candidates.forEach(c => {
        csv += `${c.name},${c.phone || ''},${c.no_show_count},${c.is_blacklisted ? '是' : '否'}\n`;
      });
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `面试周报_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
    link.click();
  } catch (e) {
    alert('导出失败: ' + e.message);
  }
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.add('hidden');
  }
});
