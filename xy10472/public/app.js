const API_BASE = '/api';
let dashboardData = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initEventListeners();
  loadDashboard();
});

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      
      item.classList.add('active');
      const tabId = item.dataset.tab;
      document.getElementById(tabId).classList.add('active');
      
      if (tabId === 'dashboard') loadDashboard();
      if (tabId === 'activities') loadActivities();
      if (tabId === 'spends') loadSpends();
      if (tabId === 'adjustments') loadAdjustments();
      if (tabId === 'refunds') loadRefunds();
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-content').forEach(s => s.classList.remove('active'));
      
      btn.classList.add('active');
      const subtabId = btn.dataset.subtab;
      document.getElementById(subtabId + '-adjustments').classList.add('active');
    });
  });
}

function initEventListeners() {
  document.getElementById('refresh-dashboard').addEventListener('click', loadDashboard);
  document.getElementById('add-activity-btn').addEventListener('click', showAddActivityModal);
  document.getElementById('import-spend-btn').addEventListener('click', showImportSpendModal);
  document.getElementById('add-refund-btn').addEventListener('click', showAddRefundModal);
  document.getElementById('demo-btn').addEventListener('click', loadDemoData);
  document.getElementById('reset-btn').addEventListener('click', resetData);
  document.getElementById('export-btn').addEventListener('click', exportReconciliation);

  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.querySelector('.modal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal();
  });
}

async function apiRequest(url, method = 'GET', data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (data) options.body = JSON.stringify(data);
  
  const response = await fetch(API_BASE + url, options);
  return await response.json();
}

async function loadDashboard() {
  const result = await apiRequest('/dashboard');
  if (result.success) {
    dashboardData = result.data;
    renderDashboard(result.data);
  }
}

function renderDashboard(data) {
  const { summary, riskyActivities, recentApproval, overSpendActivities } = data;
  
  document.getElementById('stat-budget').textContent = `¥${formatNumber(summary.totalBudget)}`;
  document.getElementById('stat-spend').textContent = `¥${formatNumber(summary.totalSpend)}`;
  document.getElementById('stat-refund').textContent = `¥${formatNumber(summary.totalRefund)}`;
  document.getElementById('stat-remaining').textContent = `¥${formatNumber(summary.remainingBudget)}`;
  document.getElementById('stat-utilization').textContent = `${summary.utilizationRate}%`;
  
  const bar = document.getElementById('utilization-bar');
  const rate = parseFloat(summary.utilizationRate);
  bar.style.width = `${Math.min(rate, 100)}%`;
  bar.classList.remove('warning', 'critical');
  if (rate > 90) bar.classList.add('critical');
  else if (rate > 80) bar.classList.add('warning');
  
  renderRiskActivities(riskyActivities);
  renderApprovalHistory(recentApproval);
  renderOverSpendActivities(overSpendActivities);
}

function renderRiskActivities(activities) {
  const container = document.getElementById('risk-list');
  const countBadge = document.getElementById('risk-count');
  
  countBadge.textContent = activities.length;
  if (activities.length > 0 && activities.every(a => a.riskLevel === 'warning')) {
    countBadge.classList.add('warning');
  } else {
    countBadge.classList.remove('warning');
  }
  
  if (activities.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无风险活动</div>';
    return;
  }
  
  container.innerHTML = activities.map(activity => {
    const percent = (activity.currentTotalSpend / (activity.totalBudget + activity.totalRefund)) * 100;
    return `
      <div class="risk-item">
        <div class="risk-header">
          <div class="risk-name">
            <span class="risk-channel">${activity.channel?.icon || ''} ${activity.name}</span>
          </div>
          <span class="risk-tag ${activity.riskLevel}">
            ${activity.riskLevel === 'critical' ? '🔴 已超花' : '🟡 预警'}
          </span>
        </div>
        <div class="risk-progress">
          <div class="risk-progress-bar ${activity.riskLevel}" style="width: ${Math.min(percent, 100)}%"></div>
        </div>
        <div class="risk-details">
          <span>已用: ¥${formatNumber(activity.currentTotalSpend)} / ¥${formatNumber(activity.totalBudget + activity.totalRefund)}</span>
          <span>${percent.toFixed(1)}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderApprovalHistory(history) {
  const container = document.getElementById('history-list');
  
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无审批记录</div>';
    return;
  }
  
  container.innerHTML = history.map(item => {
    let actionClass = '';
    let actionText = '';
    
    if (item.action === 'approve' || item.action === 'approve_warning') {
      actionClass = 'approve';
      actionText = '✓ 通过';
    } else if (item.action === 'reject') {
      actionClass = 'reject';
      actionText = '✗ 拒绝';
    } else {
      actionClass = 'create';
      actionText = '📝 创建';
    }
    
    return `
      <div class="history-item">
        <div class="history-top">
          <span class="history-action ${actionClass}">${actionText} - ${getTypeLabel(item.type)}</span>
          <span class="history-time">${item.createdAt}</span>
        </div>
        <div class="history-desc">${item.description}</div>
      </div>
    `;
  }).join('');
}

function renderOverSpendActivities(activities) {
  const section = document.getElementById('overspend-section');
  const container = document.getElementById('overspend-list');
  
  if (activities.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  container.innerHTML = activities.map(activity => {
    const cause = activity.importCausingOver;
    return `
      <div class="overspend-card">
        <div class="overspend-header">
          <div class="risk-name">
            <span>${activity.channel?.icon || ''} ${activity.name}</span>
          </div>
          <span class="risk-tag critical">超支 ¥${formatNumber(activity.currentTotalSpend - activity.totalBudget - activity.totalRefund)}</span>
        </div>
        <div class="overspend-cause">
          <div class="overspend-cause-title">📌 导致超花的导入记录</div>
          ${cause ? `
            <div class="overspend-cause-item">导入时间: ${cause.createdAt}</div>
            <div class="overspend-cause-item">消耗金额: ¥${formatNumber(cause.amount)}</div>
            <div class="overspend-cause-item">来源: ${cause.source === 'api' ? 'API自动导入' : '手动导入'}</div>
            <div class="overspend-cause-item" style="color: #dc2626;">原因: ${cause.rejectReason || '超出总预算'}</div>
          ` : '<div class="overspend-cause-item">暂无拒绝记录，实际消耗已超预算</div>'}
        </div>
      </div>
    `;
  }).join('');
}

function getTypeLabel(type) {
  const map = {
    'spend': '消耗导入',
    'adjustment': '预算调整',
    'refund': '退款回写'
  };
  return map[type] || type;
}

async function loadActivities() {
  const result = await apiRequest('/activities');
  if (result.success) {
    renderActivities(result.data);
  }
}

function renderActivities(activities) {
  const tbody = document.getElementById('activities-table');
  const channels = dashboardData?.channels || [];
  
  if (activities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="padding: 40px; text-align: center;">暂无活动，点击"新建活动"创建</td></tr>';
    return;
  }
  
  tbody.innerHTML = activities.map(activity => {
    const channel = channels.find(c => c.id === activity.channelId);
    const remaining = activity.totalBudget + activity.totalRefund - activity.currentTotalSpend;
    const percent = (activity.currentTotalSpend / (activity.totalBudget + activity.totalRefund)) * 100;
    
    return `
      <tr>
        <td><strong>${activity.name}</strong></td>
        <td>
          <span class="channels-badge">
            ${channel?.icon || ''} ${channel?.name || '未知'}
          </span>
        </td>
        <td>¥${formatNumber(activity.dailyBudget)}</td>
        <td>¥${formatNumber(activity.totalBudget)}</td>
        <td>¥${formatNumber(activity.currentTotalSpend)}</td>
        <td style="color: ${remaining < 0 ? '#ef4444' : '#22c55e'}">¥${formatNumber(remaining)}</td>
        <td><span class="status-badge ${activity.status}">${activity.status === 'active' ? '活跃' : '暂停'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-secondary btn-sm" onclick="showAdjustmentModal('${activity.id}')">调额申请</button>
            <button class="btn btn-danger btn-sm" onclick="deleteActivity('${activity.id}')">删除</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadSpends() {
  const result = await apiRequest('/spends');
  if (result.success) {
    renderSpends(result.data);
  }
}

function renderSpends(spends) {
  const tbody = document.getElementById('spends-table');
  const activities = dashboardData?.activities || [];
  const channels = dashboardData?.channels || [];
  
  if (spends.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="padding: 40px; text-align: center;">暂无消耗记录</td></tr>';
    return;
  }
  
  tbody.innerHTML = spends.map(spend => {
    const activity = activities.find(a => a.id === spend.activityId);
    const channel = channels.find(c => c.id === spend.channelId);
    
    return `
      <tr>
        <td>${activity?.name || '未知活动'}</td>
        <td><span class="channels-badge">${channel?.icon || ''} ${channel?.name || '未知'}</span></td>
        <td>${spend.date}</td>
        <td>¥${formatNumber(spend.amount)}</td>
        <td>${spend.source === 'api' ? 'API自动导入' : '手动导入'}</td>
        <td><span class="status-badge ${spend.status}">${getStatusText(spend.status)}</span></td>
        <td>${spend.createdAt}</td>
      </tr>
    `;
  }).join('');
}

async function loadAdjustments() {
  const result = await apiRequest('/adjustments');
  if (result.success) {
    renderAdjustments(result.data);
  }
}

function renderAdjustments(requests) {
  const activities = dashboardData?.activities || [];
  const pending = requests.filter(r => r.status === 'pending');
  const all = requests;
  
  const pendingTbody = document.getElementById('pending-adjustments-table');
  const allTbody = document.getElementById('all-adjustments-table');
  
  if (pending.length === 0) {
    pendingTbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="padding: 40px; text-align: center;">暂无待审批申请</td></tr>';
  } else {
    pendingTbody.innerHTML = pending.map(req => {
      const activity = activities.find(a => a.id === req.activityId);
      return `
        <tr>
          <td>${activity?.name || '未知活动'}</td>
          <td>${req.adjustmentType === 'daily' ? '日预算' : '总预算'}</td>
          <td>¥${formatNumber(req.currentAmount)}</td>
          <td style="color: ${req.requestedAmount > req.currentAmount ? '#22c55e' : '#ef4444'}">¥${formatNumber(req.requestedAmount)}</td>
          <td>${req.reason}</td>
          <td>${req.createdAt}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-success btn-sm" onclick="approveAdjustment('${req.id}')">通过</button>
              <button class="btn btn-danger btn-sm" onclick="rejectAdjustment('${req.id}')">拒绝</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  if (all.length === 0) {
    allTbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="padding: 40px; text-align: center;">暂无调额申请</td></tr>';
  } else {
    allTbody.innerHTML = all.map(req => {
      const activity = activities.find(a => a.id === req.activityId);
      return `
        <tr>
          <td>${activity?.name || '未知活动'}</td>
          <td>${req.adjustmentType === 'daily' ? '日预算' : '总预算'}</td>
          <td>¥${formatNumber(req.currentAmount)}</td>
          <td>¥${formatNumber(req.requestedAmount)}</td>
          <td>${req.reason}</td>
          <td><span class="status-badge ${req.status}">${getAdjustmentStatusText(req.status)}</span></td>
          <td>${req.approvedAt || req.createdAt}</td>
        </tr>
      `;
    }).join('');
  }
}

async function loadRefunds() {
  const result = await apiRequest('/refunds');
  if (result.success) {
    renderRefunds(result.data);
  }
}

function renderRefunds(refunds) {
  const tbody = document.getElementById('refunds-table');
  const activities = dashboardData?.activities || [];
  const channels = dashboardData?.channels || [];
  
  if (refunds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="padding: 40px; text-align: center;">暂无退款记录</td></tr>';
    return;
  }
  
  tbody.innerHTML = refunds.map(refund => {
    const activity = activities.find(a => a.id === refund.activityId);
    const channel = channels.find(c => c.id === refund.channelId);
    
    return `
      <tr>
        <td>${activity?.name || '未知活动'}</td>
        <td><span class="channels-badge">${channel?.icon || ''} ${channel?.name || '未知'}</span></td>
        <td style="color: #22c55e">+¥${formatNumber(refund.amount)}</td>
        <td>${refund.reason}</td>
        <td><span class="status-badge ${refund.status}">${refund.status === 'approved' ? '已回写' : '待处理'}</span></td>
        <td>${refund.createdAt}</td>
      </tr>
    `;
  }).join('');
}

async function showAddActivityModal() {
  const channels = dashboardData?.channels || [];
  
  const html = `
    <form id="activity-form">
      <div class="form-group">
        <label>活动名称</label>
        <input type="text" name="name" required placeholder="例如：618大促-搜索">
      </div>
      <div class="form-group">
        <label>投放渠道</label>
        <select name="channelId" required>
          ${channels.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>日预算 (元)</label>
        <input type="number" name="dailyBudget" required min="1" step="0.01" placeholder="10000">
      </div>
      <div class="form-group">
        <label>总预算 (元)</label>
        <input type="number" name="totalBudget" required min="1" step="0.01" placeholder="100000">
      </div>
      <div class="form-group">
        <label>预警阈值 (0-1，默认0.8)</label>
        <input type="number" name="warningThreshold" min="0.5" max="1" step="0.05" value="0.8">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">创建活动</button>
      </div>
    </form>
  `;
  
  showModal('新建活动', html);
  
  document.getElementById('activity-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const result = await apiRequest('/activities', 'POST', data);
    if (result.success) {
      showToast('活动创建成功', 'success');
      closeModal();
      loadActivities();
      loadDashboard();
    } else {
      showToast(result.message || '创建失败', 'error');
    }
  });
}

async function showImportSpendModal() {
  const activities = dashboardData?.activities || [];
  const channels = dashboardData?.channels || [];
  const today = new Date().toISOString().split('T')[0];
  
  const html = `
    <form id="spend-form">
      <div class="form-group">
        <label>消耗唯一ID (防重复)</label>
        <input type="text" name="externalId" required placeholder="例如：SPEND_20260511_001">
        <small style="color: #999;">同一ID重复导入不会重复扣减</small>
      </div>
      <div class="form-group">
        <label>关联活动</label>
        <select name="activityId" required>
          ${activities.length > 0 
            ? activities.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
            : '<option value="">请先创建活动</option>'}
        </select>
      </div>
      <div class="form-group">
        <label>渠道</label>
        <select name="channelId" required>
          ${channels.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>消耗金额 (元)</label>
        <input type="number" name="amount" required min="0.01" step="0.01" placeholder="5000">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" name="date" required value="${today}">
      </div>
      <div class="form-group">
        <label>说明 (可选)</label>
        <textarea name="description" rows="2" placeholder="消耗说明"></textarea>
      </div>
      <div class="form-group">
        <label>导入来源</label>
        <select name="source">
          <option value="manual">手动导入</option>
          <option value="api">API自动导入</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">导入消耗</button>
      </div>
    </form>
  `;
  
  showModal('导入消耗', html);
  
  document.getElementById('spend-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const result = await apiRequest('/spends/import', 'POST', data);
    
    if (result.code === 'DUPLICATE') {
      showToast(result.message, 'warning');
    } else if (result.code === 'OVER_BUDGET') {
      showToast(result.message + ' - ' + (result.record?.rejectReason || ''), 'error');
    } else if (result.code === 'APPROVED_WITH_WARNING') {
      showToast(result.message, 'warning');
    } else if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message || '导入失败', 'error');
    }
    
    closeModal();
    loadSpends();
    loadDashboard();
    loadActivities();
  });
}

async function showAdjustmentModal(activityId) {
  const activity = (await apiRequest('/activities')).data.find(a => a.id === activityId);
  
  const html = `
    <form id="adjustment-form">
      <input type="hidden" name="activityId" value="${activityId}">
      <div class="form-group">
        <label>活动: ${activity.name}</label>
      </div>
      <div class="form-group">
        <label>调整类型</label>
        <select name="adjustmentType" required>
          <option value="daily">日预算调整</option>
          <option value="total">总预算调整</option>
        </select>
      </div>
      <div class="form-group">
        <label>申请调整后金额 (元)</label>
        <input type="number" name="requestedAmount" required min="1" step="0.01" 
               placeholder="当前: ¥${activity.totalBudget}">
      </div>
      <div class="form-group">
        <label>调整原因</label>
        <textarea name="reason" rows="3" required placeholder="请说明调整原因..."></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">提交申请</button>
      </div>
    </form>
  `;
  
  showModal('调额申请', html);
  
  document.getElementById('adjustment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const result = await apiRequest('/adjustments', 'POST', data);
    if (result.success) {
      showToast('调额申请已提交，等待审批', 'success');
      closeModal();
      loadAdjustments();
      loadDashboard();
    } else {
      showToast(result.message || '申请失败', 'error');
    }
  });
}

async function showAddRefundModal() {
  const activities = dashboardData?.activities || [];
  const channels = dashboardData?.channels || [];
  const today = new Date().toISOString().split('T')[0];
  
  const html = `
    <form id="refund-form">
      <div class="form-group">
        <label>退款唯一ID</label>
        <input type="text" name="externalRefundId" required placeholder="例如：REFUND_20260511_001">
      </div>
      <div class="form-group">
        <label>关联活动</label>
        <select name="activityId" required>
          ${activities.length > 0 
            ? activities.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
            : '<option value="">请先创建活动</option>'}
        </select>
      </div>
      <div class="form-group">
        <label>渠道</label>
        <select name="channelId" required>
          ${channels.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>退款金额 (元)</label>
        <input type="number" name="amount" required min="0.01" step="0.01" placeholder="500">
      </div>
      <div class="form-group">
        <label>退款日期</label>
        <input type="date" name="date" required value="${today}">
      </div>
      <div class="form-group">
        <label>退款原因</label>
        <textarea name="reason" rows="2" placeholder="例如：无效点击退款"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">回写退款</button>
      </div>
    </form>
  `;
  
  showModal('新增退款', html);
  
  document.getElementById('refund-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const result = await apiRequest('/refunds', 'POST', data);
    if (result.success) {
      showToast(result.message, 'success');
      closeModal();
      loadRefunds();
      loadDashboard();
      loadActivities();
    } else {
      showToast(result.message || '退款失败', 'error');
    }
  });
}

async function approveAdjustment(id) {
  if (!confirm('确定要通过此调额申请吗？')) return;
  
  const result = await apiRequest(`/adjustments/${id}/approve`, 'POST');
  if (result.success) {
    showToast('审批通过', 'success');
    loadAdjustments();
    loadDashboard();
    loadActivities();
  } else {
    showToast(result.message || '操作失败', 'error');
  }
}

async function rejectAdjustment(id) {
  if (!confirm('确定要拒绝此调额申请吗？')) return;
  
  const result = await apiRequest(`/adjustments/${id}/reject`, 'POST');
  if (result.success) {
    showToast('已拒绝', 'success');
    loadAdjustments();
    loadDashboard();
  } else {
    showToast(result.message || '操作失败', 'error');
  }
}

async function deleteActivity(id) {
  if (!confirm('确定要删除此活动吗？')) return;
  
  const result = await apiRequest(`/activities/${id}`, 'DELETE');
  if (result.success) {
    showToast('活动已删除', 'success');
    loadActivities();
    loadDashboard();
  } else {
    showToast(result.message || '删除失败', 'error');
  }
}

async function exportReconciliation() {
  const result = await apiRequest('/export/reconciliation');
  if (result.success) {
    const { headers, rows, generatedAt } = result.data;
    
    let csv = '\uFEFF';
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `消耗对账_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('对账文件已导出', 'success');
  }
}

async function loadDemoData() {
  if (!confirm('将加载演示数据，会覆盖现有数据。确定继续吗？')) return;
  
  await apiRequest('/reset', 'POST');
  
  const activities = [
    { name: '618大促-搜索广告', channelId: 'search', dailyBudget: 20000, totalBudget: 200000, warningThreshold: 0.8 },
    { name: '新品推广-信息流', channelId: 'feed', dailyBudget: 15000, totalBudget: 100000, warningThreshold: 0.8 },
    { name: '品牌曝光-达人投放', channelId: 'influencer', dailyBudget: 30000, totalBudget: 300000, warningThreshold: 0.8 }
  ];
  
  const createdActivities = [];
  for (const act of activities) {
    const result = await apiRequest('/activities', 'POST', act);
    if (result.success) createdActivities.push(result.data);
  }
  
  await apiRequest('/spends/import', 'POST', {
    externalId: 'DEMO_SPEND_001',
    activityId: createdActivities[0].id,
    channelId: 'search',
    amount: 15000,
    date: new Date().toISOString().split('T')[0],
    description: '搜索关键词投放',
    source: 'api'
  });
  
  await apiRequest('/spends/import', 'POST', {
    externalId: 'DEMO_SPEND_002',
    activityId: createdActivities[1].id,
    channelId: 'feed',
    amount: 5000,
    date: new Date().toISOString().split('T')[0],
    description: '信息流精准投放',
    source: 'api'
  });
  
  await apiRequest('/spends/import', 'POST', {
    externalId: 'DEMO_SPEND_003',
    activityId: createdActivities[2].id,
    channelId: 'influencer',
    amount: 25000,
    date: new Date().toISOString().split('T')[0],
    description: '达人直播带货',
    source: 'manual'
  });
  
  await apiRequest('/spends/import', 'POST', {
    externalId: 'DEMO_SPEND_004',
    activityId: createdActivities[1].id,
    channelId: 'feed',
    amount: 85000,
    date: new Date().toISOString().split('T')[0],
    description: '信息流追加投放',
    source: 'manual'
  });
  
  await apiRequest('/spends/import', 'POST', {
    externalId: 'DEMO_SPEND_001',
    activityId: createdActivities[0].id,
    channelId: 'search',
    amount: 15000,
    date: new Date().toISOString().split('T')[0],
    description: '重复导入测试',
    source: 'api'
  });
  
  await apiRequest('/adjustments', 'POST', {
    activityId: createdActivities[1].id,
    adjustmentType: 'total',
    requestedAmount: 150000,
    reason: '信息流投放效果超预期，需追加预算'
  });
  
  await apiRequest('/refunds', 'POST', {
    externalRefundId: 'DEMO_REFUND_001',
    activityId: createdActivities[0].id,
    channelId: 'search',
    amount: 2000,
    date: new Date().toISOString().split('T')[0],
    reason: '无效点击退款'
  });
  
  showToast('演示数据已加载！包含3个活动、多笔消耗、调额申请和退款记录', 'success');
  loadDashboard();
  loadActivities();
  loadSpends();
  loadAdjustments();
  loadRefunds();
}

async function resetData() {
  if (!confirm('确定要重置所有数据吗？此操作不可恢复。')) return;
  
  await apiRequest('/reset', 'POST');
  showToast('数据已重置', 'success');
  loadDashboard();
  loadActivities();
  loadSpends();
  loadAdjustments();
  loadRefunds();
}

function showModal(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatNumber(num) {
  return Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatusText(status) {
  const map = {
    'approved': '已通过',
    'warning': '已通过(预警)',
    'rejected': '已拒绝',
    'pending': '待处理'
  };
  return map[status] || status;
}

function getAdjustmentStatusText(status) {
  const map = {
    'approved': '已通过',
    'rejected': '已拒绝',
    'pending': '待审批'
  };
  return map[status] || status;
}
