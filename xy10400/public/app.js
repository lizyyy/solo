let appData = {
  returnOrders: [],
  skuInfo: {}
};

const API_BASE = '';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  const date = new Date(isoStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusText(status) {
  const map = {
    'pending': '待质检',
    'inspected': '质检通过',
    'relabeled': '已换标',
    'rejected': '已报废'
  };
  return map[status] || status;
}

function getStatusBadgeClass(status) {
  return `status-${status}`;
}

function getInspectionStatusText(status) {
  const map = {
    'qualified': '全部合格',
    'partial': '部分合格',
    'rejected': '不合格'
  };
  return map[status] || '-';
}

function getSkuName(sku) {
  return appData.skuInfo[sku]?.name || sku;
}

async function fetchData() {
  try {
    const res = await fetch(`${API_BASE}/api/data`);
    const data = await res.json();
    appData = data;
    return data;
  } catch (err) {
    console.error('获取数据失败:', err);
    throw err;
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const stats = await res.json();
    return stats;
  } catch (err) {
    console.error('获取统计数据失败:', err);
    throw err;
  }
}

function renderStats(stats) {
  document.getElementById('stat-pending').textContent = stats.pending;
  document.getElementById('stat-inspected').textContent = stats.inspected;
  document.getElementById('stat-relabeled').textContent = stats.relabeled;
  document.getElementById('stat-rejected').textContent = stats.rejected;

  document.getElementById('summary-return').textContent = stats.totalReturnQty;
  document.getElementById('summary-relabel').textContent = stats.totalRelabelQty;
  document.getElementById('summary-scrap').textContent = stats.totalScrapped;

  const rate = stats.totalReturnQty > 0 
    ? ((stats.totalRelabelQty / stats.totalReturnQty) * 100).toFixed(1) 
    : 0;
  document.getElementById('summary-rate').textContent = rate + '%';

  const alertDiv = document.getElementById('pendingAlert');
  const alertMessage = document.getElementById('alertMessage');
  
  if (stats.pending > 0 || stats.inspected > 0) {
    alertDiv.style.display = 'flex';
    const parts = [];
    if (stats.pending > 0) parts.push(`${stats.pending} 单待质检`);
    if (stats.inspected > 0) parts.push(`${stats.inspected} 单待换标入库`);
    alertMessage.textContent = parts.join('，');
  } else {
    alertDiv.style.display = 'none';
  }
}

function renderTimeline() {
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  const allEvents = [];
  appData.returnOrders.forEach(order => {
    order.history.forEach(h => {
      allEvents.push({
        timestamp: h.timestamp,
        action: h.action,
        description: h.description,
        orderStatus: order.status,
        orderId: order.id
      });
    });
  });

  allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  allEvents.slice(0, 20).forEach(event => {
    const div = document.createElement('div');
    div.className = `timeline-item ${event.orderStatus}`;
    div.innerHTML = `
      <div class="timeline-time">${formatDateTime(event.timestamp)}</div>
      <div class="timeline-title">${event.action}</div>
      <div class="timeline-desc">${event.description}</div>
    `;
    container.appendChild(div);
  });

  if (allEvents.length === 0) {
    container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 20px;">暂无历史记录</div>';
  }
}

function renderOrders() {
  const container = document.getElementById('ordersList');
  const statusFilter = document.getElementById('statusFilter').value;
  const searchText = document.getElementById('searchInput').value.toLowerCase();

  let filtered = [...appData.returnOrders];
  
  if (statusFilter) {
    filtered = filtered.filter(o => o.status === statusFilter);
  }
  
  if (searchText) {
    filtered = filtered.filter(o => 
      o.returnBoxId.toLowerCase().includes(searchText) ||
      o.originalSku.toLowerCase().includes(searchText)
    );
  }

  filtered.sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate));

  container.innerHTML = '';

  filtered.forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card';
    
    const scrappedQty = order.returnQty - (order.relabelQty || 0);
    
    let actionsHtml = '';
    if (order.status === 'pending') {
      actionsHtml = `
        <button class="btn btn-success" onclick="openInspectModal('${order.id}')">质检处理</button>
      `;
    } else if (order.status === 'inspected') {
      actionsHtml = `
        <button class="btn btn-primary" onclick="confirmRelabel('${order.id}')">换标入库</button>
      `;
    }
    actionsHtml += `<button class="btn btn-secondary" onclick="viewHistory('${order.id}')">查看历史</button>`;

    card.innerHTML = `
      <div class="order-header">
        <span class="order-id">${order.id} (${order.returnBoxId})</span>
        <span class="status-badge ${getStatusBadgeClass(order.status)}">${getStatusText(order.status)}</span>
      </div>
      <div class="order-info">
        <div class="order-info-row"><span class="label">SKU:</span><span>${getSkuName(order.originalSku)}</span></div>
        <div class="order-info-row"><span class="label">原批次:</span><span>${order.originalBatch}</span></div>
        <div class="order-info-row"><span class="label">退货日期:</span><span>${formatDate(order.returnDate)}</span></div>
        <div class="order-info-row"><span class="label">退货数量:</span><span>${order.returnQty}</span></div>
        ${order.status !== 'pending' ? `
          <div class="order-info-row"><span class="label">质检结果:</span><span>${getInspectionStatusText(order.inspectionStatus)}</span></div>
          <div class="order-info-row"><span class="label">换标数量:</span><span>${order.relabelQty || 0}</span></div>
        ` : ''}
        ${order.newLabel ? `<div class="order-info-row"><span class="label">新标签:</span><span>${order.newLabel}</span></div>` : ''}
        ${order.status !== 'pending' && scrappedQty > 0 ? `<div class="order-info-row"><span class="label">报废数量:</span><span style="color: #ef4444;">${scrappedQty}</span></div>` : ''}
      </div>
      <div class="order-actions">
        ${actionsHtml}
      </div>
    `;
    container.appendChild(card);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 40px;">暂无退货单</div>';
  }
}

function openInspectModal(orderId) {
  const order = appData.returnOrders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = '质检处理';
  body.innerHTML = `
    <div class="modal-info">
      <div class="modal-info-row"><span class="label">退货单号:</span><span class="value">${order.id}</span></div>
      <div class="modal-info-row"><span class="label">退货箱号:</span><span class="value">${order.returnBoxId}</span></div>
      <div class="modal-info-row"><span class="label">原SKU:</span><span class="value">${getSkuName(order.originalSku)}</span></div>
      <div class="modal-info-row"><span class="label">原批次:</span><span class="value">${order.originalBatch}</span></div>
      <div class="modal-info-row"><span class="label">退货数量:</span><span class="value">${order.returnQty}</span></div>
    </div>
    
    <div class="form-group">
      <label>质检结果 *</label>
      <select id="inspectStatus" required onchange="toggleRelabelFields()">
        <option value="qualified">全部合格 - 全部可换标</option>
        <option value="partial">部分合格 - 部分可换标</option>
        <option value="rejected">不合格 - 全部报废</option>
      </select>
    </div>
    
    <div id="relabelFields">
      <div class="form-group">
        <label>换标数量 *</label>
        <input type="number" id="relabelQty" required min="1" max="${order.returnQty}" value="${order.returnQty}">
        <small style="color: #6b7280;">最大: ${order.returnQty}，不能超过退货数量</small>
      </div>
      <div class="form-group">
        <label>新标签 *</label>
        <input type="text" id="newLabel" required placeholder="如: ${order.originalSku}-R1">
        <small style="color: #6b7280;">标签不能与已使用的标签重复</small>
      </div>
    </div>
    
    <div class="form-group">
      <label>质检备注 *</label>
      <textarea id="inspectNote" required rows="3" placeholder="请详细描述质检情况..."></textarea>
    </div>
    
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-success" onclick="submitInspection('${orderId}')">确认质检</button>
    </div>
  `;

  modal.style.display = 'flex';
}

function toggleRelabelFields() {
  const status = document.getElementById('inspectStatus').value;
  const fields = document.getElementById('relabelFields');
  const relabelQty = document.getElementById('relabelQty');
  
  if (status === 'rejected') {
    fields.style.display = 'none';
    relabelQty.required = false;
  } else {
    fields.style.display = 'block';
    relabelQty.required = true;
  }
}

async function submitInspection(orderId) {
  const inspectionStatus = document.getElementById('inspectStatus').value;
  const inspectionNote = document.getElementById('inspectNote').value.trim();
  
  if (!inspectionNote) {
    showToast('请填写质检备注', 'error');
    return;
  }

  let body = {
    inspectionStatus,
    inspectionNote
  };

  if (inspectionStatus !== 'rejected') {
    const relabelQty = document.getElementById('relabelQty').value;
    const newLabel = document.getElementById('newLabel').value.trim();
    
    if (!relabelQty || parseInt(relabelQty) <= 0) {
      showToast('换标数量必须大于0', 'error');
      return;
    }
    
    if (!newLabel) {
      showToast('请填写新标签', 'error');
      return;
    }

    body.relabelQty = parseInt(relabelQty);
    body.newLabel = newLabel;
  }

  try {
    const res = await fetch(`${API_BASE}/api/return-orders/${orderId}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    
    if (!res.ok) {
      showToast(data.error || '质检处理失败', 'error');
      return;
    }

    showToast('质检处理成功', 'success');
    closeModal();
    await refreshData();
  } catch (err) {
    console.error(err);
    showToast('质检处理失败', 'error');
  }
}

async function confirmRelabel(orderId) {
  const order = appData.returnOrders.find(o => o.id === orderId);
  if (!order) return;

  if (confirm(`确认对退货单 ${order.id} 进行换标入库？\n\n换标数量: ${order.relabelQty}\n新标签: ${order.newLabel}`)) {
    try {
      const res = await fetch(`${API_BASE}/api/return-orders/${orderId}/relabel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.error || '换标入库失败', 'error');
        return;
      }

      showToast('换标入库成功', 'success');
      await refreshData();
    } catch (err) {
      console.error(err);
      showToast('换标入库失败', 'error');
    }
  }
}

function viewHistory(orderId) {
  const order = appData.returnOrders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = '历史记录';
  
  let historyHtml = order.history.slice().reverse().map(h => `
    <div class="history-item">
      <div class="history-time">${formatDateTime(h.timestamp)}</div>
      <div class="history-action">${h.action}</div>
      <div class="history-desc">${h.description}</div>
    </div>
  `).join('');

  body.innerHTML = `
    <div class="modal-info">
      <div class="modal-info-row"><span class="label">退货单号:</span><span class="value">${order.id}</span></div>
      <div class="modal-info-row"><span class="label">退货箱号:</span><span class="value">${order.returnBoxId}</span></div>
      <div class="modal-info-row"><span class="label">当前状态:</span><span class="value">${getStatusText(order.status)}</span></div>
    </div>
    <div class="history-section">
      <h4>操作历史</h4>
      <div class="history-list">
        ${historyHtml}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary btn-full" onclick="closeModal()">关闭</button>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

async function refreshData() {
  try {
    const [data, stats] = await Promise.all([fetchData(), fetchStats()]);
    renderStats(stats);
    renderTimeline();
    renderOrders();
  } catch (err) {
    showToast('刷新数据失败', 'error');
  }
}

function exportCsv() {
  window.location.href = `${API_BASE}/api/export`;
  showToast('正在导出换标明细...', 'success');
}

async function resetData() {
  if (confirm('确定要重置所有数据为初始样例吗？当前数据将丢失！')) {
    try {
      const res = await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      const data = await res.json();
      showToast(data.message, 'success');
      await refreshData();
    } catch (err) {
      showToast('重置数据失败', 'error');
    }
  }
}

async function submitReturnForm(e) {
  e.preventDefault();
  
  let sku = document.getElementById('originalSku').value;
  const customSku = document.getElementById('customSku').value.trim();
  
  if (!sku && !customSku) {
    showToast('请选择或输入原SKU', 'error');
    return;
  }
  
  if (customSku) {
    sku = customSku;
  }

  const body = {
    returnBoxId: document.getElementById('returnBoxId').value.trim(),
    originalSku: sku,
    originalBatch: document.getElementById('originalBatch').value.trim(),
    returnDate: document.getElementById('returnDate').value,
    returnQty: parseInt(document.getElementById('returnQty').value)
  };

  try {
    const res = await fetch(`${API_BASE}/api/return-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    
    if (!res.ok) {
      showToast(data.error || '录入失败', 'error');
      return;
    }

    showToast('退货单录入成功', 'success');
    document.getElementById('returnForm').reset();
    document.getElementById('customSku').style.display = 'none';
    await refreshData();
  } catch (err) {
    console.error(err);
    showToast('录入失败', 'error');
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

function setupEventListeners() {
  document.getElementById('returnForm').addEventListener('submit', submitReturnForm);
  document.getElementById('statusFilter').addEventListener('change', renderOrders);
  document.getElementById('searchInput').addEventListener('input', renderOrders);
  
  document.getElementById('originalSku').addEventListener('change', function() {
    const customInput = document.getElementById('customSku');
    if (this.value === '') {
      customInput.style.display = 'block';
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('returnDate').value = today;

  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

async function init() {
  setupEventListeners();
  await refreshData();
}

init();
