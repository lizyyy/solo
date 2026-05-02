const API_BASE = '/api';

let allTickets = [];
let statusFlow = null;
let statusColors = null;
let searchTimeout = null;

const STATUS_ORDER = [
  '待检测',
  '报价中',
  '维修中',
  '待取机',
  '已完成',
  '已取消'
];

const STATUS_FLOW_DISPLAY = {
  '待检测': {
    allowed: ['报价中', '已取消'],
    buttonLabels: {
      '报价中': '开始报价',
      '已取消': '取消工单'
    },
    disabledReason: {
      '维修中': '需要先报价',
      '待取机': '需要先完成维修',
      '已完成': '需要先完成所有流程'
    }
  },
  '报价中': {
    allowed: ['待检测', '维修中', '已取消'],
    buttonLabels: {
      '待检测': '重新检测',
      '维修中': '确认报价，开始维修',
      '已取消': '取消工单'
    },
    disabledReason: {
      '待取机': '需要先开始维修',
      '已完成': '需要先完成所有流程'
    }
  },
  '维修中': {
    allowed: ['报价中', '待取机', '已取消'],
    buttonLabels: {
      '报价中': '返回报价',
      '待取机': '维修完成，待取机',
      '已取消': '取消工单'
    },
    disabledReason: {
      '待检测': '不能返回到检测阶段',
      '已完成': '需要先标记为待取机'
    }
  },
  '待取机': {
    allowed: ['维修中', '已完成', '已取消'],
    buttonLabels: {
      '维修中': '返回维修',
      '已完成': '客户已取机，完成',
      '已取消': '取消工单'
    },
    disabledReason: {
      '待检测': '不能返回到检测阶段',
      '报价中': '不能返回到报价阶段'
    }
  },
  '已完成': {
    allowed: [],
    buttonLabels: {},
    disabledReason: {
      '待检测': '已完成的工单不能修改状态',
      '报价中': '已完成的工单不能修改状态',
      '维修中': '已完成的工单不能修改状态',
      '待取机': '已完成的工单不能修改状态',
      '已取消': '已完成的工单不能取消'
    }
  },
  '已取消': {
    allowed: [],
    buttonLabels: {},
    disabledReason: {
      '待检测': '已取消的工单不能重新打开',
      '报价中': '已取消的工单不能重新打开',
      '维修中': '已取消的工单不能重新打开',
      '待取机': '已取消的工单不能重新打开',
      '已完成': '已取消的工单不能完成'
    }
  }
};

async function init() {
  try {
    await loadStatusFlow();
    await loadTickets();
  } catch (err) {
    console.error('初始化失败:', err);
    showToast('error', '初始化失败', err.message);
  }
}

async function loadStatusFlow() {
  const response = await fetch(`${API_BASE}/status-flow`);
  const data = await response.json();
  if (data.success) {
    statusFlow = data.data.flow;
    statusColors = data.data.colors;
  }
}

async function loadTickets() {
  const kanban = document.getElementById('kanban');
  kanban.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const params = new URLSearchParams();
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchInput').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (statusFilter) params.set('status', statusFilter);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const url = `${API_BASE}/tickets${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      allTickets = data.data;
      renderKanban();
      updateStats();
    } else {
      throw new Error(data.message || '加载失败');
    }
  } catch (err) {
    kanban.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">❌</div>
      <p>加载失败: ${err.message}</p>
      <button class="btn btn-small btn-primary" onclick="loadTickets()">重试</button>
    </div>`;
  }
}

function renderKanban() {
  const kanban = document.getElementById('kanban');
  
  let html = '';
  
  STATUS_ORDER.forEach(status => {
    const tickets = allTickets.filter(t => t.status === status);
    const color = statusColors ? statusColors[status] : '#6b7280';
    
    html += `
      <div class="kanban-column">
        <div class="column-header">
          <div class="column-title">
            <span class="status-dot" style="background: ${color}"></span>
            ${status}
          </div>
          <span class="column-count">${tickets.length}</span>
        </div>
        <div class="column-cards">
          ${tickets.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">📭</div>
              <p>暂无工单</p>
            </div>
          ` : tickets.map(ticket => renderTicketCard(ticket)).join('')}
        </div>
      </div>
    `;
  });
  
  kanban.innerHTML = html;
}

function renderTicketCard(ticket) {
  const color = ticket.statusColor || '#6b7280';
  const createdDate = formatDateTime(ticket.created_at, true);
  const quoteAmount = ticket.quote_amount > 0 ? `¥${ticket.quote_amount}` : '待报价';
  
  return `
    <div class="ticket-card" onclick="openTicketDetail(${ticket.id})">
      <div class="ticket-header">
        <span class="ticket-customer">${escapeHtml(ticket.customer_name)}</span>
        <span class="ticket-number">#${ticket.ticket_number}</span>
      </div>
      <div class="ticket-device">${escapeHtml(ticket.device_model)}</div>
      <div class="ticket-fault">${escapeHtml(ticket.fault_description)}</div>
      <div class="ticket-footer">
        <span class="ticket-quote">${quoteAmount}</span>
        <span class="ticket-date">${createdDate}</span>
      </div>
    </div>
  `;
}

function updateStats() {
  const statsBar = document.getElementById('statsBar');
  
  const summary = {
    total: allTickets.length,
    byStatus: {}
  };
  
  allTickets.forEach(t => {
    summary.byStatus[t.status] = (summary.byStatus[t.status] || 0) + 1;
  });
  
  let html = `
    <div class="stat-item">
      <span class="stat-label">总工单:</span>
      <span class="stat-value">${summary.total}</span>
    </div>
  `;
  
  STATUS_ORDER.forEach(status => {
    const count = summary.byStatus[status] || 0;
    const color = statusColors ? statusColors[status] : '#6b7280';
    if (count > 0) {
      html += `
        <div class="stat-item">
          <span class="status-dot" style="background: ${color}"></span>
          <span class="stat-label">${status}:</span>
          <span class="stat-value">${count}</span>
        </div>
      `;
    }
  });
  
  statsBar.innerHTML = html;
}

async function openTicketDetail(ticketId) {
  try {
    const response = await fetch(`${API_BASE}/tickets/${ticketId}`);
    const data = await response.json();
    
    if (data.success) {
      renderTicketModal(data.data);
      document.getElementById('ticketModal').classList.add('active');
    } else {
      throw new Error(data.message || '加载失败');
    }
  } catch (err) {
    showToast('error', '加载失败', err.message);
  }
}

function renderTicketModal(ticket) {
  document.getElementById('modalTitle').textContent = `工单 #${ticket.ticket_number}`;
  
  const color = ticket.statusColor || '#6b7280';
  const currentStatus = ticket.status;
  const flowInfo = STATUS_FLOW_DISPLAY[currentStatus] || { allowed: [], disabledReason: {} };
  
  let statusButtons = '';
  
  STATUS_ORDER.forEach(targetStatus => {
    if (targetStatus === currentStatus) return;
    
    const isAllowed = flowInfo.allowed.includes(targetStatus);
    const buttonLabel = flowInfo.buttonLabels[targetStatus] || `转为${targetStatus}`;
    const disabledReason = flowInfo.disabledReason[targetStatus];
    
    let btnClass = 'btn btn-small';
    if (targetStatus === '已取消') {
      btnClass += isAllowed ? ' btn-danger' : ' btn-outline';
    } else if (targetStatus === '已完成') {
      btnClass += isAllowed ? ' btn-primary' : ' btn-outline';
    } else {
      btnClass += isAllowed ? ' btn-secondary' : ' btn-outline';
    }
    
    const tooltipHtml = disabledReason ? `<span class="tooltip">${disabledReason}</span>` : '';
    
    statusButtons += `
      <button class="action-btn ${btnClass}" 
              onclick="${isAllowed ? `changeStatus(${ticket.id}, '${targetStatus}')` : ''}"
              ${isAllowed ? '' : 'disabled'}>
        ${buttonLabel}
        ${tooltipHtml}
      </button>
    `;
  });
  
  const historyHtml = ticket.history.map(item => {
    const fromStatus = item.from_status ? `从"${item.from_status}"` : '';
    const toStatus = item.to_status;
    const time = formatDateTime(item.created_at);
    
    return `
      <div class="history-item">
        <span class="history-time">${time}</span>
        <div class="history-content">
          <div class="history-status">
            ${fromStatus}<span style="color: ${statusColors ? statusColors[toStatus] : '#6b7280'}; font-weight: 600;">"${toStatus}"</span>
          </div>
          <div class="history-reason">${escapeHtml(item.reason || '状态变更')}</div>
        </div>
      </div>
    `;
  }).join('');
  
  const html = `
    <div class="detail-container">
      <div class="detail-section">
        <h3>基本信息</h3>
        <div class="detail-item">
          <span class="detail-label">工单编号</span>
          <span class="detail-value">#${ticket.ticket_number}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">当前状态</span>
          <span class="detail-value">
            <span class="status-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
              <span class="dot" style="background: ${color}"></span>
              ${ticket.status}
            </span>
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">客户姓名</span>
          <span class="detail-value">${escapeHtml(ticket.customer_name)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">手机号</span>
          <span class="detail-value">${escapeHtml(ticket.customer_phone)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">设备型号</span>
          <span class="detail-value">${escapeHtml(ticket.device_model)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">创建时间</span>
          <span class="detail-value">${formatDateTime(ticket.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">更新时间</span>
          <span class="detail-value">${formatDateTime(ticket.updated_at)}</span>
        </div>
      </div>
      
      <div class="detail-section">
        <h3>维修信息</h3>
        <div class="detail-item">
          <span class="detail-label">故障描述</span>
          <span class="detail-value">${escapeHtml(ticket.fault_description)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">报价金额</span>
          <span class="detail-value" style="color: #22c55e; font-weight: 600;">
            ¥${ticket.quote_amount || 0}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">维修配件</span>
          <span class="detail-value">${escapeHtml(ticket.repair_parts) || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">预计取机</span>
          <span class="detail-value">${ticket.expected_pickup_time ? formatDateTime(ticket.expected_pickup_time) : '-'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">备注</span>
          <span class="detail-value">${escapeHtml(ticket.notes) || '-'}</span>
        </div>
      </div>
      
      <div class="status-actions">
        <h4>状态操作</h4>
        <div class="action-buttons">
          ${statusButtons}
          <button class="btn btn-small btn-outline" onclick="openEditModal(${ticket.id})">✏️ 编辑工单</button>
        </div>
      </div>
      
      <div class="detail-section history-section">
        <h3>操作记录</h3>
        <div class="history-list">
          ${historyHtml || '<div class="empty-state"><p>暂无操作记录</p></div>'}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('ticketModalBody').innerHTML = html;
}

async function changeStatus(ticketId, newStatus) {
  let reason = '';
  
  if (newStatus === '已取消') {
    reason = prompt('请输入取消原因:');
    if (reason === null) return;
    if (!reason.trim()) {
      reason = '用户取消';
    }
  } else if (newStatus === '已完成') {
    reason = '客户已取机，工单完成';
  } else if (newStatus === '维修中') {
    reason = '客户确认报价，开始维修';
  } else if (newStatus === '报价中') {
    reason = '检测完成，等待报价确认';
  } else if (newStatus === '待取机') {
    reason = '维修完成，等待取机';
  } else {
    reason = '状态变更';
  }
  
  try {
    const response = await fetch(`${API_BASE}/tickets/${ticketId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        new_status: newStatus,
        reason: reason
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('success', '操作成功', data.message);
      closeModal('ticketModal');
      await loadTickets();
    } else {
      if (data.allowedNextStatuses) {
        showToast('warning', '状态流转不允许', `${data.message}。允许的下一个状态: ${data.allowedNextStatuses.join(', ')}`);
      } else {
        throw new Error(data.message || '操作失败');
      }
    }
  } catch (err) {
    showToast('error', '操作失败', err.message);
  }
}

async function openEditModal(ticketId) {
  try {
    const response = await fetch(`${API_BASE}/tickets/${ticketId}`);
    const data = await response.json();
    
    if (data.success) {
      const ticket = data.data;
      
      document.getElementById('editTicketId').value = ticket.id;
      document.getElementById('editCustomerName').value = ticket.customer_name;
      document.getElementById('editCustomerPhone').value = ticket.customer_phone;
      document.getElementById('editDeviceModel').value = ticket.device_model;
      document.getElementById('editFaultDescription').value = ticket.fault_description;
      document.getElementById('editQuoteAmount').value = ticket.quote_amount;
      document.getElementById('editRepairParts').value = ticket.repair_parts || '';
      document.getElementById('editNotes').value = ticket.notes || '';
      
      if (ticket.expected_pickup_time) {
        const dt = new Date(ticket.expected_pickup_time);
        const formatted = dt.toISOString().slice(0, 16);
        document.getElementById('editExpectedPickup').value = formatted;
      } else {
        document.getElementById('editExpectedPickup').value = '';
      }
      
      closeModal('ticketModal');
      document.getElementById('editModal').classList.add('active');
    } else {
      throw new Error(data.message || '加载失败');
    }
  } catch (err) {
    showToast('error', '加载失败', err.message);
  }
}

async function createTicket(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const data = {
    customer_name: formData.get('customer_name'),
    customer_phone: formData.get('customer_phone'),
    device_model: formData.get('device_model'),
    fault_description: formData.get('fault_description'),
    quote_amount: parseFloat(formData.get('quote_amount')) || 0,
    repair_parts: formData.get('repair_parts') || '',
    notes: formData.get('notes') || ''
  };
  
  const expectedPickup = formData.get('expected_pickup_time');
  if (expectedPickup) {
    data.expected_pickup_time = new Date(expectedPickup).toISOString();
  }
  
  try {
    const response = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('success', '创建成功', `工单 #${result.data.ticket_number} 已创建`);
      closeModal('createModal');
      form.reset();
      await loadTickets();
    } else {
      if (result.messages) {
        showToast('error', '验证失败', result.messages.join('; '));
      } else {
        throw new Error(result.message || '创建失败');
      }
    }
  } catch (err) {
    showToast('error', '创建失败', err.message);
  }
}

async function updateTicket(event) {
  event.preventDefault();
  
  const form = event.target;
  const ticketId = document.getElementById('editTicketId').value;
  
  const formData = new FormData(form);
  
  const data = {
    customer_name: formData.get('customer_name'),
    customer_phone: formData.get('customer_phone'),
    device_model: formData.get('device_model'),
    fault_description: formData.get('fault_description'),
    quote_amount: parseFloat(formData.get('quote_amount')) || 0,
    repair_parts: formData.get('repair_parts') || '',
    notes: formData.get('notes') || ''
  };
  
  const expectedPickup = formData.get('expected_pickup_time');
  if (expectedPickup) {
    data.expected_pickup_time = new Date(expectedPickup).toISOString();
  } else {
    data.expected_pickup_time = '';
  }
  
  try {
    const response = await fetch(`${API_BASE}/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('success', '更新成功', '工单信息已更新');
      closeModal('editModal');
      await loadTickets();
    } else {
      if (result.messages) {
        showToast('error', '验证失败', result.messages.join('; '));
      } else {
        throw new Error(result.message || '更新失败');
      }
    }
  } catch (err) {
    showToast('error', '更新失败', err.message);
  }
}

function searchTickets() {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    loadTickets();
  }, 300);
}

function applyFilters() {
  loadTickets();
}

function clearFilters() {
  document.getElementById('statusFilter').value = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  loadTickets();
}

function exportCsv() {
  const statusFilter = document.getElementById('statusFilter').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  
  const url = `${API_BASE}/csv/export${params.toString() ? '?' + params.toString() : ''}`;
  window.open(url, '_blank');
}

async function importCsv() {
  const fileInput = document.getElementById('csvFile');
  const file = fileInput.files[0];
  
  if (!file) {
    showToast('warning', '请选择文件', '请先选择要导入的 CSV 文件');
    return;
  }
  
  document.getElementById('csvFileName').textContent = file.name;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    showToast('warning', '正在导入', '请稍候...');
    
    const response = await fetch(`${API_BASE}/csv/import`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (result.data.errorCount > 0) {
        showToast('warning', '导入完成', `成功 ${result.data.successCount} 条，失败 ${result.data.errorCount} 条`);
      } else {
        showToast('success', '导入成功', `成功导入 ${result.data.successCount} 条工单`);
      }
      fileInput.value = '';
      document.getElementById('csvFileName').textContent = '';
      await loadTickets();
    } else {
      throw new Error(result.message || '导入失败');
    }
  } catch (err) {
    showToast('error', '导入失败', err.message);
  }
}

function showCreateModal() {
  document.getElementById('createForm').reset();
  document.getElementById('createModal').classList.add('active');
}

function showCsvModal() {
  document.getElementById('csvModal').classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

function showToast(type, title, message) {
  const container = document.getElementById('toastContainer');
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

function formatDateTime(isoString, short = false) {
  if (!isoString) return '-';
  
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  
  if (short) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ticketDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today - ticketDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    }
  }
  
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();
