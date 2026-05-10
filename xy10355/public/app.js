const API_BASE = '/api';
let currentRecallId = null;
let currentHandleAffectedId = null;

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });
  
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/dashboard`);
    const result = await response.json();
    
    if (result.success) {
      const data = result.data;
      document.getElementById('stat-members').textContent = data.members;
      document.getElementById('stat-inventory').textContent = data.inventory;
      document.getElementById('stat-sales').textContent = data.sales;
      document.getElementById('stat-active-recalls').textContent = data.active_recalls;
      document.getElementById('stat-locked').textContent = data.locked_inventory;
      document.getElementById('dashboard-summary').textContent = `进行中召回: ${data.active_recalls} 批`;
    }
    
    const recallsResp = await fetch(`${API_BASE}/recalls`);
    const recallsResult = await recallsResp.json();
    
    if (recallsResult.success) {
      renderLatestRecalls(recallsResult.data.slice(0, 5));
    }
  } catch (error) {
    console.error('加载仪表盘失败:', error);
  }
}

function renderLatestRecalls(recalls) {
  const container = document.getElementById('latest-recalls-list');
  
  if (recalls.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">暂无召回事务</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = recalls.map(recall => `
    <div class="recall-card" onclick="viewRecallDetail(${recall.id})">
      <div class="recall-header">
        <div>
          <div class="recall-title">${recall.product_name} - ${recall.batch_no}</div>
          <div class="recall-no">召回编号: ${recall.recall_no}</div>
        </div>
        <span class="recall-badge badge-${recall.status === 'active' ? 'active' : 'completed'}">
          ${recall.status === 'active' ? '进行中' : '已完成'}
        </span>
      </div>
      <div class="recall-meta">
        <div class="recall-meta-item">受影响会员: <strong>${recall.total_affected || 0} 人</strong></div>
        <div class="recall-meta-item">已通知: <strong>${recall.notified_count || 0} 人</strong></div>
        <div class="recall-meta-item">已处理: <strong>${recall.completed_count || 0} 人</strong></div>
        <div class="recall-meta-item">创建时间: <strong>${formatDate(recall.created_at)}</strong></div>
      </div>
    </div>
  `).join('');
}

async function loadRecallsList() {
  try {
    const response = await fetch(`${API_BASE}/recalls`);
    const result = await response.json();
    
    if (result.success) {
      renderRecallsList(result.data);
    }
  } catch (error) {
    console.error('加载召回列表失败:', error);
  }
}

function renderRecallsList(recalls) {
  const container = document.getElementById('recalls-list');
  
  if (recalls.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">暂无召回事务，点击右上角"新建召回"创建</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = recalls.map(recall => `
    <div class="recall-card" onclick="viewRecallDetail(${recall.id})">
      <div class="recall-header">
        <div>
          <div class="recall-title">${recall.product_name} - ${recall.batch_no}</div>
          <div class="recall-no">召回编号: ${recall.recall_no}</div>
          ${recall.reason ? `<div class="recall-no" style="margin-top: 4px;">召回原因: ${recall.reason}</div>` : ''}
        </div>
        <span class="recall-badge badge-${recall.status === 'active' ? 'active' : 'completed'}">
          ${recall.status === 'active' ? '进行中' : '已完成'}
        </span>
      </div>
      <div class="recall-meta">
        <div class="recall-meta-item">品牌: <strong>${recall.brand || '-'}</strong></div>
        <div class="recall-meta-item">受影响会员: <strong>${recall.total_affected || 0} 人</strong></div>
        <div class="recall-meta-item">已通知: <strong>${recall.notified_count || 0} 人</strong></div>
        <div class="recall-meta-item">已处理: <strong>${recall.completed_count || 0} 人</strong></div>
        <div class="recall-meta-item">创建时间: <strong>${formatDate(recall.created_at)}</strong></div>
      </div>
    </div>
  `).join('');
}

async function viewRecallDetail(id) {
  currentRecallId = id;
  navigateTo('recall-detail');
  
  try {
    const [detailResp, statsResp] = await Promise.all([
      fetch(`${API_BASE}/recalls/${id}`),
      fetch(`${API_BASE}/recalls/${id}/stats`)
    ]);
    
    const detailResult = await detailResp.json();
    const statsResult = await statsResp.json();
    
    if (detailResult.success) {
      renderRecallDetail(detailResult.data);
    }
    
    if (statsResult.success) {
      renderRecallStats(statsResult.data);
    }
  } catch (error) {
    console.error('加载召回详情失败:', error);
    showToast('加载召回详情失败', 'error');
  }
}

function renderRecallDetail(data) {
  const { recall, affected } = data;
  
  document.getElementById('detail-recall-title').textContent = `${recall.product_name} - 召回详情`;
  
  const summaryHtml = `
    <div class="recall-summary-item">
      <div class="recall-summary-label">召回编号</div>
      <div class="recall-summary-value">${recall.recall_no}</div>
    </div>
    <div class="recall-summary-item">
      <div class="recall-summary-label">产品批号</div>
      <div class="recall-summary-value">${recall.batch_no}</div>
    </div>
    <div class="recall-summary-item">
      <div class="recall-summary-label">产品名称</div>
      <div class="recall-summary-value">${recall.product_name}</div>
    </div>
    <div class="recall-summary-item">
      <div class="recall-summary-label">品牌</div>
      <div class="recall-summary-value">${recall.brand || '-'}</div>
    </div>
    <div class="recall-summary-item">
      <div class="recall-summary-label">召回原因</div>
      <div class="recall-summary-value">${recall.reason || '-'}</div>
    </div>
    <div class="recall-summary-item">
      <div class="recall-summary-label">库存状态</div>
      <div class="recall-summary-value">
        库存 ${recall.inventory_quantity || 0} 件
        ${recall.is_locked ? '<span class="lock-badge">🔒 已锁定</span>' : ''}
      </div>
    </div>
    <div class="recall-summary-item">
      <div class="recall-summary-label">创建时间</div>
      <div class="recall-summary-value">${formatDate(recall.created_at)}</div>
    </div>
  `;
  
  document.getElementById('recall-summary-card').innerHTML = summaryHtml;
  renderAffectedList(affected);
}

function renderRecallStats(stats) {
  const notifyPercent = stats.total > 0 ? (stats.notified / stats.total * 100).toFixed(1) : 0;
  document.getElementById('notify-progress').style.width = `${notifyPercent}%`;
  document.getElementById('notify-info').textContent = `已通知 ${stats.notified} / ${stats.total}`;
  
  document.getElementById('stat-pending').textContent = stats.pending_handle;
  document.getElementById('stat-returned').textContent = stats.returned;
  document.getElementById('stat-exchanged').textContent = stats.exchanged;
  document.getElementById('stat-unreachable').textContent = stats.unreachable;
  document.getElementById('stat-exceptions').textContent = stats.exceptions;
}

function renderAffectedList(affected) {
  const tbody = document.getElementById('affected-table-body');
  
  if (affected.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: #718096;">
          该批号暂无销售记录
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = affected.map(item => {
    const notifyStatusClass = item.notify_status === 'notified' ? 'status-notified' : 'status-pending';
    const notifyStatusText = item.notify_status === 'notified' ? '已通知' : '待通知';
    
    let handleStatusClass = 'status-pending';
    let handleStatusText = '待处理';
    if (item.handle_status === 'completed') {
      handleStatusClass = 'status-completed';
      const handleMap = {
        'return': '已退货',
        'exchange': '已换货',
        'unreachable': '无法联系'
      };
      handleStatusText = handleMap[item.handle_type] || '已处理';
    }
    
    let actionButtons = '';
    if (item.handle_status !== 'completed') {
      actionButtons += item.notify_status !== 'notified' 
        ? `<button class="btn btn-sm btn-secondary btn-action" onclick="markNotified(${item.id})">标记已通知</button>` 
        : '';
      actionButtons += !item.is_exception
        ? `<button class="btn btn-sm btn-success btn-action" onclick="openHandleModal(${item.id})">处理</button>`
        : `<button class="btn btn-sm btn-warning btn-action" onclick="openHandleModal(${item.id})">标记无法联系</button>`;
    } else {
      actionButtons = '<span style="color: #a0aec0; font-size: 12px;">已完成</span>';
    }
    
    return `
      <tr>
        <td>${item.member_name || '未知会员'}</td>
        <td>${item.phone || '<span style="color: #f56565;">无联系方式</span>'}</td>
        <td>${item.product_name || '-'}</td>
        <td>${item.quantity || 0} 件</td>
        <td>${formatDate(item.sale_date)}</td>
        <td><span class="status-badge ${notifyStatusClass}">${notifyStatusText}</span></td>
        <td><span class="status-badge ${handleStatusClass}">${handleStatusText}</span></td>
        <td>${item.is_exception ? `<span class="status-badge status-exception">异常</span><br><small style="color: #f56565;">${item.exception_reason}</small>` : '-'}</td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join('');
}

async function markNotified(affectedId) {
  if (!confirm('确认标记该会员为已通知？')) return;
  
  try {
    const response = await fetch(`${API_BASE}/recalls/${currentRecallId}/affected/${affectedId}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    
    if (result.success) {
      showToast(result.message, 'success');
      viewRecallDetail(currentRecallId);
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('标记通知失败:', error);
    showToast('操作失败', 'error');
  }
}

function openHandleModal(affectedId) {
  currentHandleAffectedId = affectedId;
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('create-recall-modal').style.display = 'none';
  document.getElementById('handle-modal').style.display = 'block';
  
  const detailResp = fetch(`${API_BASE}/recalls/${currentRecallId}`);
  detailResp.then(async (response) => {
    const result = await response.json();
    if (result.success) {
      const item = result.data.affected.find(a => a.id === affectedId);
      if (item) {
        document.getElementById('handle-member-info').innerHTML = `
          <div class="member-info-row">
            <div class="member-info-label">会员</div>
            <div class="member-info-value">${item.member_name || '未知会员'}</div>
          </div>
          <div class="member-info-row">
            <div class="member-info-label">电话</div>
            <div class="member-info-value">${item.phone || '<span style="color: #f56565;">无联系方式</span>'}</div>
          </div>
          <div class="member-info-row">
            <div class="member-info-label">产品</div>
            <div class="member-info-value">${item.product_name || '-'} (${item.batch_no})</div>
          </div>
          <div class="member-info-row">
            <div class="member-info-label">数量</div>
            <div class="member-info-value">${item.quantity || 0} 件</div>
          </div>
          ${item.is_exception ? `
            <div class="member-info-row">
              <div class="member-info-label">异常</div>
              <div class="member-info-value" style="color: #f56565;">${item.exception_reason}</div>
            </div>
          ` : ''}
        `;
        
        const radios = document.querySelectorAll('input[name="handle_type"]');
        radios.forEach(radio => {
          if (item.is_exception && radio.value !== 'unreachable') {
            radio.checked = false;
            radio.disabled = true;
            radio.parentElement.style.opacity = '0.5';
          } else if (item.is_exception && radio.value === 'unreachable') {
            radio.checked = true;
            radio.disabled = false;
            radio.parentElement.style.opacity = '1';
          } else {
            radio.disabled = false;
            radio.parentElement.style.opacity = '1';
          }
        });
      }
    }
  });
  
  document.getElementById('input-operator').value = '';
  document.getElementById('input-remark').value = '';
}

async function confirmHandle() {
  const handleType = document.querySelector('input[name="handle_type"]:checked')?.value;
  const operator = document.getElementById('input-operator').value;
  const remark = document.getElementById('input-remark').value;
  
  if (!handleType) {
    showToast('请选择处理方式', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/recalls/${currentRecallId}/affected/${currentHandleAffectedId}/handle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle_type: handleType,
        operator: operator || '系统管理员',
        remark
      })
    });
    const result = await response.json();
    
    if (result.success) {
      showToast(result.message, 'success');
      closeModal();
      viewRecallDetail(currentRecallId);
    } else {
      if (result.code === 'DUPLICATE_HANDLE') {
        showToast(result.message, 'warning');
      } else if (result.code === 'CONTACT_MISSING') {
        showToast(result.message, 'warning');
      } else {
        showToast(result.message, 'error');
      }
    }
  } catch (error) {
    console.error('处理失败:', error);
    showToast('操作失败', 'error');
  }
}

function exportReport() {
  window.location.href = `${API_BASE}/recalls/${currentRecallId}/export`;
}

async function loadMembers() {
  try {
    const response = await fetch(`${API_BASE}/members`);
    const result = await response.json();
    
    if (result.success) {
      const tbody = document.getElementById('members-table-body');
      tbody.innerHTML = result.data.map(m => `
        <tr>
          <td>${m.member_no}</td>
          <td>${m.name}</td>
          <td>${m.phone || '<span style="color: #f56565;">未填写</span>'}</td>
          <td>${m.address || '-'}</td>
          <td>${formatDate(m.created_at)}</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('加载会员列表失败:', error);
  }
}

async function loadInventory() {
  try {
    const response = await fetch(`${API_BASE}/inventory`);
    const result = await response.json();
    
    if (result.success) {
      const tbody = document.getElementById('inventory-table-body');
      tbody.innerHTML = result.data.map(i => `
        <tr>
          <td>${i.batch_no}</td>
          <td>${i.product_name}</td>
          <td>${i.brand}</td>
          <td>${i.specification || '-'}</td>
          <td>${i.quantity} 件</td>
          <td>${i.is_locked ? '<span class="status-badge status-exception">🔒 已锁定</span>' : '<span class="status-badge status-completed">正常</span>'}</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('加载库存列表失败:', error);
  }
}

async function loadSales() {
  try {
    const response = await fetch(`${API_BASE}/sales`);
    const result = await response.json();
    
    if (result.success) {
      const tbody = document.getElementById('sales-table-body');
      tbody.innerHTML = result.data.map(s => `
        <tr>
          <td>${s.sale_no}</td>
          <td>${s.member_name || '-'}</td>
          <td>${s.batch_no}</td>
          <td>${s.product_name || '-'}</td>
          <td>${s.quantity} 件</td>
          <td>${formatDate(s.sale_date)}</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('加载销售记录失败:', error);
  }
}

function openCreateRecallModal() {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('handle-modal').style.display = 'none';
  document.getElementById('create-recall-modal').style.display = 'block';
  document.getElementById('input-batch-no').value = '';
  document.getElementById('input-reason').value = '';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

async function createRecall() {
  const batchNo = document.getElementById('input-batch-no').value.trim();
  const reason = document.getElementById('input-reason').value.trim();
  
  if (!batchNo) {
    showToast('请输入召回批号', 'error');
    return;
  }
  
  if (!confirm(`确认创建批号 [${batchNo}] 的召回？创建后库存将自动锁定。`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/recalls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_no: batchNo,
        reason: reason || null
      })
    });
    const result = await response.json();
    
    if (result.success) {
      showToast(result.message, 'success');
      closeModal();
      navigateTo('recalls');
      loadRecallsList();
      loadDashboard();
      
      if (result.data.recall_id) {
        setTimeout(() => viewRecallDetail(result.data.recall_id), 500);
      }
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('创建召回失败:', error);
    showToast('创建召回失败', 'error');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
      
      if (page === 'dashboard') loadDashboard();
      if (page === 'recalls') loadRecallsList();
      if (page === 'members') loadMembers();
      if (page === 'inventory') loadInventory();
      if (page === 'sales') loadSales();
    });
  });
  
  document.getElementById('btn-create-recall').addEventListener('click', openCreateRecallModal);
  document.getElementById('btn-cancel-recall').addEventListener('click', closeModal);
  document.getElementById('btn-confirm-recall').addEventListener('click', createRecall);
  
  document.getElementById('btn-back-recalls').addEventListener('click', () => {
    navigateTo('recalls');
    loadRecallsList();
  });
  
  document.getElementById('btn-cancel-handle').addEventListener('click', closeModal);
  document.getElementById('btn-confirm-handle').addEventListener('click', confirmHandle);
  
  document.getElementById('btn-export-report').addEventListener('click', exportReport);
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
  
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  });
  
  loadDashboard();
});
