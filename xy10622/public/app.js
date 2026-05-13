const API_BASE = '/api/audit';

let currentAuditData = [];
let currentMissingData = [];

async function init() {
  await loadStatistics();
  await loadAudits();
  await loadMissingCheckouts();
}

async function loadStatistics() {
  try {
    const response = await fetch(`${API_BASE}/statistics`);
    const result = await response.json();
    if (result.success) {
      const data = result.data;
      document.getElementById('pending-count').textContent = data.pendingAudits;
      document.getElementById('approved-count').textContent = data.approvedAudits;
      document.getElementById('rejected-count').textContent = data.rejectedAudits;
      document.getElementById('missing-count').textContent = data.missingCheckouts;
      document.getElementById('hours-count').textContent = data.totalApprovedHours.toFixed(1);
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

async function loadAudits() {
  try {
    const filters = {
      volunteerName: document.getElementById('filter-volunteer').value,
      activityName: document.getElementById('filter-activity').value,
      status: document.getElementById('filter-status').value,
      startDate: document.getElementById('filter-start-date').value,
      endDate: document.getElementById('filter-end-date').value
    };

    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });

    const response = await fetch(`${API_BASE}/audits?${params.toString()}`);
    const result = await response.json();
    if (result.success) {
      currentAuditData = result.data;
      renderAuditTable(result.data);
    }
  } catch (error) {
    console.error('加载审核列表失败:', error);
  }
}

function renderAuditTable(data) {
  const tbody = document.getElementById('audit-table-body');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-4 text-muted">暂无数据</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(item => {
    const statusClass = `status-${item.status}`;
    const statusText = {
      'pending': '待审核',
      'approved': '已通过',
      'rejected': '已拒绝'
    }[item.status] || item.status;

    return `
      <tr>
        <td>${item.id}</td>
        <td>${item.volunteer_name}</td>
        <td>${item.activity_name}</td>
        <td>${item.activity_date}</td>
        <td>${item.checkin_time ? item.checkin_time.substring(0, 16) : '-'}</td>
        <td>${item.original_hours}h</td>
        <td>${item.approved_hours}h</td>
        <td>
          ${item.confirmed_hours ? item.confirmed_hours + 'h' : '-'}
          ${item.confirmation_status ? `<span class="badge bg-secondary">${item.confirmation_status}</span>` : ''}
        </td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn btn-sm btn-primary btn-action" onclick="viewAuditDetail(${item.id})">
            详情
          </button>
          ${item.status === 'pending' ? `
            <button class="btn btn-sm btn-success btn-action" onclick="approveAudit(${item.id}, ${item.approved_hours})">
              通过
            </button>
            <button class="btn btn-sm btn-danger btn-action" onclick="rejectAudit(${item.id})">
              拒绝
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

async function loadMissingCheckouts() {
  try {
    const response = await fetch(`${API_BASE}/missing-checkouts`);
    const result = await response.json();
    if (result.success) {
      currentMissingData = result.data;
      renderMissingTable(result.data);
    }
  } catch (error) {
    console.error('加载缺签退列表失败:', error);
  }
}

function renderMissingTable(data) {
  const tbody = document.getElementById('missing-table-body');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">暂无待处理的缺签退记录</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${item.volunteer_name}</td>
      <td>${item.activity_name}</td>
      <td>${item.activity_date}</td>
      <td>${item.checkin_time ? item.checkin_time.substring(0, 16) : '-'}</td>
      <td>${item.notes || '-'}</td>
      <td>
        <button class="btn btn-sm btn-primary btn-action" onclick="processMissing(${item.id}, ${item.checkin_id})">
          处理
        </button>
      </td>
    </tr>
  `).join('');
}

async function viewAuditDetail(auditId) {
  const audit = currentAuditData.find(a => a.id === auditId);
  if (!audit) return;

  const modalBody = document.getElementById('audit-modal-body');
  
  let validationInfo = '';
  try {
    const valResponse = await fetch(`${API_BASE}/validate-checkin/${audit.checkin_id}`);
    const valResult = await valResponse.json();
    if (valResult.success && valResult.data && !valResult.data.valid) {
      validationInfo = `
        <div class="alert alert-warning">
          <h6><i class="bi bi-exclamation-triangle"></i> 校验异常：</h6>
          <ul class="mb-0">
            ${valResult.data.issues.map(i => `<li>${i}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  } catch (e) {}

  modalBody.innerHTML = `
    <div class="row mb-4">
      <div class="col-md-6">
        <h6>基本信息</h6>
        <table class="table table-sm">
          <tr><td><strong>志愿者：</strong></td><td>${audit.volunteer_name}</td></tr>
          <tr><td><strong>联系电话：</strong></td><td>${audit.volunteer_phone || '-'}</td></tr>
          <tr><td><strong>活动名称：</strong></td><td>${audit.activity_name}</td></tr>
          <tr><td><strong>活动日期：</strong></td><td>${audit.activity_date}</td></tr>
          <tr><td><strong>签到时间：</strong></td><td>${audit.checkin_time || '-'}</td></tr>
          <tr><td><strong>签退时间：</strong></td><td>${audit.checkout_time || '-'}</td></tr>
        </table>
      </div>
      <div class="col-md-6">
        <h6>审核信息</h6>
        <table class="table table-sm">
          <tr><td><strong>原始时长：</strong></td><td>${audit.original_hours}小时</td></tr>
          <tr><td><strong>建议时长：</strong></td><td>${audit.approved_hours}小时</td></tr>
          <tr><td><strong>审核原因：</strong></td><td>${audit.reason || '-'}</td></tr>
          <tr><td><strong>队长确认时长：</strong></td><td>${audit.confirmed_hours ? audit.confirmed_hours + '小时' : '-'}</td></tr>
          <tr><td><strong>当前状态：</strong></td><td><span class="status-badge status-${audit.status}">${
            {'pending': '待审核', 'approved': '已通过', 'rejected': '已拒绝'}[audit.status]
          }</span></td></tr>
          <tr><td><strong>处理人：</strong></td><td>${audit.handled_by || '-'}</td></tr>
          <tr><td><strong>处理时间：</strong></td><td>${audit.handled_at || '-'}</td></tr>
        </table>
      </div>
    </div>
    
    ${validationInfo}
    
    ${audit.status === 'pending' ? `
      <div class="card">
        <div class="card-body">
          <h6 class="card-title">审核操作</h6>
          <div class="mb-3">
            <label class="form-label">核定时长（小时）</label>
            <input type="number" class="form-control" id="audit-hours-${auditId}" value="${audit.approved_hours}" step="0.5" min="0">
          </div>
          <button class="btn btn-success me-2" onclick="submitAudit(${auditId}, 'approved')">
            <i class="bi bi-check-lg"></i> 通过审核
          </button>
          <button class="btn btn-danger" onclick="submitAudit(${auditId}, 'rejected')">
            <i class="bi bi-x-lg"></i> 拒绝审核
          </button>
        </div>
      </div>
    ` : ''}
  `;

  const modal = new bootstrap.Modal(document.getElementById('auditModal'));
  modal.show();
}

async function approveAudit(auditId, approvedHours) {
  if (confirm('确定要通过该审核吗？')) {
    await submitAudit(auditId, 'approved', approvedHours);
  }
}

async function rejectAudit(auditId) {
  if (confirm('确定要拒绝该审核吗？')) {
    await submitAudit(auditId, 'rejected');
  }
}

async function submitAudit(auditId, status, approvedHours) {
  try {
    if (approvedHours === undefined && status === 'approved') {
      approvedHours = parseFloat(document.getElementById(`audit-hours-${auditId}`)?.value || 0);
    }

    const response = await fetch(`${API_BASE}/save-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auditId,
        status,
        approvedHours,
        handledBy: '管理员'
      })
    });

    const result = await response.json();
    if (result.success) {
      alert('操作成功！');
      bootstrap.Modal.getInstance(document.getElementById('auditModal'))?.hide();
      await refreshData();
    } else {
      alert('操作失败: ' + result.message);
    }
  } catch (error) {
    console.error('审核操作失败:', error);
    alert('操作失败，请重试');
  }
}

async function processMissing(id, checkinId) {
  const modalBody = document.getElementById('missing-modal-body');
  
  modalBody.innerHTML = `
    <div class="mb-3">
      <label class="form-label">核定时长（小时）</label>
      <input type="number" class="form-control" id="missing-hours-${id}" value="3" step="0.5" min="0">
    </div>
    <div class="mb-3">
      <label class="form-label">处理备注</label>
      <textarea class="form-control" id="missing-notes-${id}" rows="3" placeholder="请说明补录时长的原因..."></textarea>
    </div>
    <div class="d-grid">
      <button class="btn btn-primary" onclick="submitMissing(${id}, ${checkinId})">
        <i class="bi bi-check-lg"></i> 确认处理
      </button>
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById('missingModal'));
  modal.show();
}

async function submitMissing(id, checkinId) {
  try {
    const approvedHours = parseFloat(document.getElementById(`missing-hours-${id}`).value);
    const notes = document.getElementById(`missing-notes-${id}`).value;

    const response = await fetch(`${API_BASE}/process-missing-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkinId,
        approvedHours,
        notes,
        handledBy: '管理员'
      })
    });

    const result = await response.json();
    if (result.success) {
      alert('处理成功！');
      bootstrap.Modal.getInstance(document.getElementById('missingModal'))?.hide();
      await refreshData();
    } else {
      alert('处理失败: ' + result.message);
    }
  } catch (error) {
    console.error('缺签退处理失败:', error);
    alert('处理失败，请重试');
  }
}

function resetFilters() {
  document.getElementById('filter-volunteer').value = '';
  document.getElementById('filter-activity').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  loadAudits();
}

async function refreshData() {
  await Promise.all([
    loadStatistics(),
    loadAudits(),
    loadMissingCheckouts()
  ]);
}

function exportReport() {
  const modal = new bootstrap.Modal(document.getElementById('exportModal'));
  modal.show();
}

function doExport() {
  const filters = {
    handledBy: document.getElementById('export-handled-by').value,
    startTime: document.getElementById('export-start-time').value,
    endTime: document.getElementById('export-end-time').value
  };

  const params = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    if (filters[key]) params.append(key, filters[key]);
  });

  window.location.href = `${API_BASE}/export-report?${params.toString()}`;
  
  bootstrap.Modal.getInstance(document.getElementById('exportModal'))?.hide();
}

document.addEventListener('DOMContentLoaded', init);
