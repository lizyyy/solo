const API_BASE = '/api/issues';

const state = {
  filters: {},
  selectedIssues: new Set(),
  groupedIssues: {},
  summary: {},
  currentEditIssue: null,
};

function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = d - now;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  const dateStr = d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  return {
    display: dateStr,
    isOverdue: diffMs < 0,
    isWarning: diffMs >= 0 && diffHours <= 2,
    diffHours,
    diffMins,
  };
}

function formatDateTimeForInput(date) {
  if (!date) {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    return now.toISOString().slice(0, 16);
  }
  return new Date(date).toISOString().slice(0, 16);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };
  
  toast.innerHTML = `
    <span>${icons[type]}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    if (options.expectBlob) {
      return response.blob();
    }
    
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

async function fetchSummary() {
  try {
    const summary = await apiRequest('/summary');
    state.summary = summary;
    renderSummary();
  } catch (error) {
    console.error('Failed to fetch summary:', error);
  }
}

async function fetchGroupedIssues() {
  try {
    const params = new URLSearchParams();
    if (state.filters.shift) params.append('shift', state.filters.shift);
    if (state.filters.assignee) params.append('assignee', state.filters.assignee);
    if (state.filters.riskLevel) params.append('riskLevel', state.filters.riskLevel);
    
    const queryString = params.toString();
    const endpoint = queryString ? `/grouped?${queryString}` : '/grouped';
    const groups = await apiRequest(endpoint);
    state.groupedIssues = groups;
    renderBoard();
  } catch (error) {
    console.error('Failed to fetch grouped issues:', error);
    showToast('获取数据失败', 'error');
  }
}

function renderSummary() {
  const container = document.getElementById('riskSummary');
  const { total, overdueSoon, highRiskUnresolved, pendingReview, closed, open } = state.summary;
  
  container.innerHTML = `
    <div class="summary-item">
      <span class="summary-icon">📊</span>
      <div class="summary-info">
        <span class="summary-label">总事项</span>
        <span class="summary-value">${total}</span>
      </div>
    </div>
    <div class="summary-item">
      <span class="summary-icon">⏰</span>
      <div class="summary-info">
        <span class="summary-label">即将超时</span>
        <span class="summary-value ${overdueSoon > 0 ? 'danger' : ''}">${overdueSoon}</span>
      </div>
    </div>
    <div class="summary-item">
      <span class="summary-icon">🔥</span>
      <div class="summary-info">
        <span class="summary-label">高风险未处理</span>
        <span class="summary-value ${highRiskUnresolved > 0 ? 'warning' : ''}">${highRiskUnresolved}</span>
      </div>
    </div>
    <div class="summary-item">
      <span class="summary-icon">📋</span>
      <div class="summary-info">
        <span class="summary-label">待复盘</span>
        <span class="summary-value info">${pendingReview}</span>
      </div>
    </div>
    <div class="summary-item">
      <span class="summary-icon">✅</span>
      <div class="summary-info">
        <span class="summary-label">已关闭</span>
        <span class="summary-value success">${closed}</span>
      </div>
    </div>
  `;
}

function renderIssueCard(issue, group) {
  const deadlineInfo = formatDateTime(issue.deadline);
  const riskClass = {
    '低': 'risk-low',
    '中': 'risk-medium',
    '高': 'risk-high',
    '紧急': 'risk-urgent',
  }[issue.riskLevel] || 'risk-medium';
  
  const isSelected = state.selectedIssues.has(issue.id);
  const overdueClass = deadlineInfo.isOverdue ? 'is-overdue' : '';
  
  let deadlineClass = '';
  if (deadlineInfo.isOverdue) {
    deadlineClass = 'deadline-overdue';
  } else if (deadlineInfo.isWarning) {
    deadlineClass = 'deadline-warning';
  }

  const tagsHtml = (issue.tags || []).map(tag => 
    `<span class="issue-tag">${tag}</span>`
  ).join('');

  return `
    <div class="issue-card ${riskClass} ${overdueClass} ${isSelected ? 'selected' : ''}" 
         data-id="${issue.id}">
      <label class="issue-checkbox">
        <input type="checkbox" ${isSelected ? 'checked' : ''} 
               onclick="toggleIssueSelection(${issue.id}, event)">
      </label>
      <div class="issue-card-header">
        <span class="issue-shift ${issue.shift}">${issue.shift}</span>
        <span class="issue-risk ${issue.riskLevel}">${issue.riskLevel}</span>
      </div>
      <div class="issue-title" title="${issue.description}">${issue.description}</div>
      <div class="issue-meta">
        <span class="issue-meta-item">👤 ${issue.assignee}</span>
        ${issue.customer ? `<span class="issue-meta-item">🏢 ${issue.customer}</span>` : ''}
        ${issue.ticketNo ? `<span class="issue-meta-item">🎫 ${issue.ticketNo}</span>` : ''}
      </div>
      ${tagsHtml ? `<div class="issue-tags">${tagsHtml}</div>` : ''}
      <div class="issue-status">
        <span class="status-badge ${issue.status}">${issue.status}</span>
        <span class="${deadlineClass}">⏰ ${deadlineInfo.display}</span>
      </div>
    </div>
  `;
}

function renderBoard() {
  const groups = [
    { key: 'overdueSoon', title: '即将超时' },
    { key: 'highRiskUnresolved', title: '高风险未处理' },
    { key: 'pendingReview', title: '待复盘' },
    { key: 'closed', title: '已关闭' },
  ];

  groups.forEach(({ key, title }) => {
    const container = document.getElementById(`column-${key}`);
    const countEl = document.getElementById(`count-${key}`);
    const issues = state.groupedIssues[key] || [];
    
    countEl.textContent = issues.length;
    
    if (issues.length === 0) {
      container.innerHTML = '';
    } else {
      container.innerHTML = issues.map(issue => renderIssueCard(issue, key)).join('');
    }
    
    container.querySelectorAll('.issue-card').forEach(card => {
      const checkbox = card.querySelector('input[type="checkbox"]');
      card.addEventListener('click', (e) => {
        if (e.target !== checkbox && !checkbox.contains(e.target)) {
          const id = parseInt(card.dataset.id);
          showIssueDetail(id);
        }
      });
    });
  });
}

function toggleIssueSelection(id, event) {
  event.stopPropagation();
  if (state.selectedIssues.has(id)) {
    state.selectedIssues.delete(id);
  } else {
    state.selectedIssues.add(id);
  }
  updateBatchActionsUI();
  renderBoard();
}

function updateBatchActionsUI() {
  const batchActions = document.getElementById('batchActions');
  const selectedCount = document.getElementById('selectedCount');
  
  if (state.selectedIssues.size > 0) {
    batchActions.style.display = 'block';
    selectedCount.textContent = state.selectedIssues.size;
  } else {
    batchActions.style.display = 'none';
  }
}

async function showIssueDetail(id) {
  try {
    const issues = [
      ...(state.groupedIssues.overdueSoon || []),
      ...(state.groupedIssues.highRiskUnresolved || []),
      ...(state.groupedIssues.pendingReview || []),
      ...(state.groupedIssues.closed || []),
    ];
    
    let issue = issues.find(i => i.id === id);
    if (!issue) {
      issue = await apiRequest(`/${id}`);
    }
    
    state.currentEditIssue = issue;
    renderIssueModal(issue);
  } catch (error) {
    showToast('获取详情失败', 'error');
  }
}

function renderIssueModal(issue) {
  const deadlineInfo = formatDateTime(issue.deadline);
  const createdInfo = formatDateTime(issue.createdAt);
  const updatedInfo = formatDateTime(issue.updatedAt);
  
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">班次</span>
      <span class="detail-value">
        <span class="issue-shift ${issue.shift}">${issue.shift}</span>
      </span>
    </div>
    <div class="detail-row">
      <span class="detail-label">负责人</span>
      <span class="detail-value">${issue.assignee}</span>
    </div>
    ${issue.customer ? `
    <div class="detail-row">
      <span class="detail-label">客户</span>
      <span class="detail-value">${issue.customer}</span>
    </div>` : ''}
    ${issue.ticketNo ? `
    <div class="detail-row">
      <span class="detail-label">工单号</span>
      <span class="detail-value">${issue.ticketNo}</span>
    </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">风险等级</span>
      <span class="detail-value">
        <span class="issue-risk ${issue.riskLevel}">${issue.riskLevel}</span>
      </span>
    </div>
    <div class="detail-row">
      <span class="detail-label">截止时间</span>
      <span class="detail-value ${deadlineInfo.isOverdue ? 'deadline-overdue' : deadlineInfo.isWarning ? 'deadline-warning' : ''}">
        ${deadlineInfo.display}
        ${deadlineInfo.isOverdue ? ' (已超时)' : deadlineInfo.isWarning ? ' (即将超时)' : ''}
      </span>
    </div>
    <div class="detail-row">
      <span class="detail-label">标签</span>
      <span class="detail-value">${(issue.tags || []).join(', ') || '无'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">状态</span>
      <span class="detail-value">
        <span class="status-badge ${issue.status}">${issue.status}</span>
      </span>
    </div>
    <div class="detail-row">
      <span class="detail-label">问题描述</span>
      <span class="detail-value">${issue.description}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">创建时间</span>
      <span class="detail-value">${createdInfo.display}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">更新时间</span>
      <span class="detail-value">${updatedInfo.display}</span>
    </div>
    
    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
      <div class="form-group" style="margin-bottom: 0;">
        <label for="modalStatus">快速更新状态</label>
        <select id="modalStatus" style="width: auto; margin-right: 0.5rem;">
          <option value="待处理" ${issue.status === '待处理' ? 'selected' : ''}>待处理</option>
          <option value="处理中" ${issue.status === '处理中' ? 'selected' : ''}>处理中</option>
          <option value="待复盘" ${issue.status === '待复盘' ? 'selected' : ''}>待复盘</option>
          <option value="已关闭" ${issue.status === '已关闭' ? 'selected' : ''}>已关闭</option>
        </select>
        <button class="btn btn-primary" onclick="updateIssueStatus(${issue.id})">更新状态</button>
      </div>
    </div>
  `;
  
  document.getElementById('issueModal').classList.add('active');
}

async function updateIssueStatus(id) {
  const newStatus = document.getElementById('modalStatus').value;
  try {
    await apiRequest(`/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    showToast('状态更新成功', 'success');
    closeModal();
    refreshData();
  } catch (error) {
    showToast('状态更新失败', 'error');
  }
}

function closeModal() {
  document.getElementById('issueModal').classList.remove('active');
  state.currentEditIssue = null;
}

async function handleFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const tagsInput = form.tags.value.trim();
  const tags = tagsInput 
    ? tagsInput.split(/[,，]/).map(t => t.trim()).filter(t => t)
    : [];
  
  const data = {
    shift: form.shift.value,
    assignee: form.assignee.value.trim(),
    customer: form.customer.value.trim(),
    ticketNo: form.ticketNo.value.trim(),
    riskLevel: form.riskLevel.value,
    deadline: form.deadline.value,
    tags,
    status: form.status.value,
    description: form.description.value.trim(),
  };
  
  try {
    await apiRequest('/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    showToast('交接事项添加成功', 'success');
    form.reset();
    form.deadline.value = formatDateTimeForInput();
    refreshData();
  } catch (error) {
    showToast(`添加失败: ${error.message}`, 'error');
  }
}

function applyFilters() {
  state.filters = {
    shift: document.getElementById('filterShift').value || null,
    assignee: document.getElementById('filterAssignee').value.trim() || null,
    riskLevel: document.getElementById('filterRiskLevel').value || null,
  };
  refreshData();
  showToast('筛选条件已应用', 'info');
}

function clearFilters() {
  state.filters = {};
  document.getElementById('filterShift').value = '';
  document.getElementById('filterAssignee').value = '';
  document.getElementById('filterRiskLevel').value = '';
  refreshData();
  showToast('筛选条件已清除', 'info');
}

async function handleBatchUpdate() {
  const newStatus = document.getElementById('batchStatus').value;
  if (!newStatus) {
    showToast('请选择目标状态', 'warning');
    return;
  }
  
  if (state.selectedIssues.size === 0) {
    showToast('没有选择任何事项', 'warning');
    return;
  }
  
  try {
    await apiRequest('/batch/status', {
      method: 'PATCH',
      body: JSON.stringify({
        ids: Array.from(state.selectedIssues),
        status: newStatus,
      }),
    });
    
    showToast(`已更新 ${state.selectedIssues.size} 个事项的状态`, 'success');
    state.selectedIssues.clear();
    document.getElementById('batchStatus').value = '';
    updateBatchActionsUI();
    refreshData();
  } catch (error) {
    showToast('批量更新失败', 'error');
  }
}

function cancelBatchSelection() {
  state.selectedIssues.clear();
  updateBatchActionsUI();
  renderBoard();
}

async function exportCSV() {
  try {
    const blob = await apiRequest('/export/csv', {
      method: 'GET',
      expectBlob: true,
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10) + '-' + 
                     String(now.getHours()).padStart(2, '0') +
                     String(now.getMinutes()).padStart(2, '0');
    a.download = `shift-handover-${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('导出成功', 'success');
  } catch (error) {
    showToast('导出失败', 'error');
  }
}

async function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${API_BASE}/import/csv`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '导入失败');
    }
    
    const result = await response.json();
    showToast(result.message || `成功导入 ${result.issues?.length || 0} 条记录`, 'success');
    refreshData();
  } catch (error) {
    showToast(`导入失败: ${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
}

async function refreshData() {
  await Promise.all([
    fetchSummary(),
    fetchGroupedIssues(),
  ]);
}

function init() {
  document.getElementById('deadline').value = formatDateTimeForInput();
  
  document.getElementById('issueForm').addEventListener('submit', handleFormSubmit);
  
  document.getElementById('refreshBtn').addEventListener('click', refreshData);
  document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
  document.getElementById('clearFilterBtn').addEventListener('click', clearFilters);
  document.getElementById('applyBatchBtn').addEventListener('click', handleBatchUpdate);
  document.getElementById('cancelBatchBtn').addEventListener('click', cancelBatchSelection);
  
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('importFile').addEventListener('change', handleCSVImport);
  
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  
  document.getElementById('issueModal').addEventListener('click', (e) => {
    if (e.target.id === 'issueModal') closeModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  
  refreshData();
  
  setInterval(refreshData, 60000);
}

window.toggleIssueSelection = toggleIssueSelection;
window.updateIssueStatus = updateIssueStatus;
window.closeModal = closeModal;

document.addEventListener('DOMContentLoaded', init);
