const API_BASE = '';

let bookings = [];
let currentBookingId = null;
let isEditMode = false;

const STATUS_NAMES = {
  'pending': '待收押金',
  'deposited': '已收押金',
  'verified': '已核销',
  'refunded': '已退款'
};

const ACTION_NAMES = {
  'create': '创建预约',
  'deposit': '收取押金',
  'verify': '核销预约',
  'refund': '退回押金',
  'update': '更新信息'
};

function getStatusName(status) {
  return STATUS_NAMES[status] || status;
}

function getActionName(action) {
  return ACTION_NAMES[action] || action;
}

function getStatusClass(status) {
  return `status-${status}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCurrency(amount) {
  return `¥${parseFloat(amount || 0).toFixed(2)}`;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('hidden');
}

async function fetchBookings() {
  try {
    const dateFilter = document.getElementById('filterDate').value;
    const searchTerm = document.getElementById('searchInput').value;

    let url = `${API_BASE}/api/bookings?`;
    const params = [];

    if (dateFilter) params.push(`booking_date=${encodeURIComponent(dateFilter)}`);
    if (searchTerm) params.push(`search=${encodeURIComponent(searchTerm)}`);

    if (params.length > 0) url += params.join('&');

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      bookings = data.data;
      renderBookings();
      updateStats();
    } else {
      showToast('加载预约列表失败', 'error');
    }
  } catch (error) {
    console.error('获取预约列表失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }
}

function renderBookings() {
  const container = document.getElementById('bookingList');

  if (bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>暂无预约记录</p>
      </div>
    `;
    return;
  }

  const sortedBookings = [...bookings].sort((a, b) => {
    if (a.is_overdue && !b.is_overdue) return -1;
    if (!a.is_overdue && b.is_overdue) return 1;
    if (a.booking_date !== b.booking_date) {
      return a.booking_date.localeCompare(b.booking_date);
    }
    return a.start_time.localeCompare(b.start_time);
  });

  container.innerHTML = sortedBookings.map(booking => `
    <div class="booking-card ${booking.is_overdue ? 'overdue' : ''}" 
         onclick="viewBookingDetail(${booking.id})"
         data-id="${booking.id}">
      <div class="booking-info">
        <div class="booking-header">
          <span class="booking-studio">棚位 ${booking.studio}</span>
          <span class="booking-customer">${booking.customer_name}</span>
          <span class="booking-phone">${booking.phone}</span>
        </div>
        <div class="booking-meta">
          <span>📅 ${formatDate(booking.booking_date)}</span>
          <span>⏰ ${booking.start_time} - ${booking.end_time}</span>
          ${booking.is_overdue ? '<span style="color: #ef4444; font-weight: 600;">⚠️ 已逾期</span>' : ''}
        </div>
      </div>
      <div class="booking-right">
        <span class="booking-status ${getStatusClass(booking.status)}">
          ${getStatusName(booking.status)}
        </span>
        <span class="booking-deposit">
          押金: <strong>${formatCurrency(booking.deposit_amount)}</strong>
        </span>
      </div>
    </div>
  `).join('');
}

function updateStats() {
  const today = new Date().toISOString().split('T')[0];
  
  const todayCount = bookings.filter(b => b.booking_date === today).length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const depositedCount = bookings.filter(b => b.status === 'deposited').length;
  const verifiedCount = bookings.filter(b => b.status === 'verified').length;
  const refundedCount = bookings.filter(b => b.status === 'refunded').length;
  const overdueCount = bookings.filter(b => b.is_overdue).length;

  document.getElementById('todayCount').textContent = todayCount;
  document.getElementById('pendingCount').textContent = pendingCount;
  document.getElementById('depositedCount').textContent = depositedCount;
  document.getElementById('verifiedCount').textContent = verifiedCount;
  document.getElementById('refundedCount').textContent = refundedCount;
  document.getElementById('overdueCount').textContent = overdueCount;
}

async function viewBookingDetail(id) {
  try {
    const response = await fetch(`${API_BASE}/api/bookings/${id}`);
    const data = await response.json();

    if (data.success) {
      currentBookingId = id;
      renderBookingDetail(data.data);
      openModal('detailModal');
    } else {
      showToast('获取预约详情失败', 'error');
    }
  } catch (error) {
    console.error('获取预约详情失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }
}

function renderBookingDetail(booking) {
  const basicContainer = document.getElementById('detailBasic');
  
  basicContainer.innerHTML = `
    <div class="detail-item">
      <span class="detail-label">客户姓名</span>
      <span class="detail-value">${booking.customer_name}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">联系电话</span>
      <span class="detail-value">${booking.phone}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">棚位</span>
      <span class="detail-value">棚位 ${booking.studio}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">预约日期</span>
      <span class="detail-value">${formatDate(booking.booking_date)} ${booking.is_overdue ? '<span style="color: #ef4444;">(逾期)</span>' : ''}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">时间段</span>
      <span class="detail-value">${booking.start_time} - ${booking.end_time}</span>
    </div>
    <div class="detail-item">
      <span class="detail-label">当前状态</span>
      <span class="detail-value">
        <span class="booking-status ${getStatusClass(booking.status)}" style="display: inline-block;">
          ${getStatusName(booking.status)}
        </span>
      </span>
    </div>
    <div class="detail-item">
      <span class="detail-label">押金金额</span>
      <span class="detail-value">${formatCurrency(booking.deposit_amount)}</span>
    </div>
    ${booking.note ? `
    <div class="detail-item" style="grid-column: 1 / -1;">
      <span class="detail-label">备注</span>
      <span class="detail-value">${booking.note}</span>
    </div>
    ` : ''}
  `;

  renderStatusActions(booking);
  renderAuditLogs(booking.audit_logs);
}

function renderStatusActions(booking) {
  const container = document.getElementById('statusActions');
  const status = booking.status;

  const actions = [];

  if (status === 'pending') {
    actions.push({
      id: 'deposit',
      label: '💰 收取押金',
      class: 'btn-success',
      targetStatus: 'deposited',
      disabled: false,
      reason: ''
    });
    actions.push({
      id: 'refund',
      label: '❌ 取消预约',
      class: 'btn-danger',
      targetStatus: 'refunded',
      disabled: false,
      reason: ''
    });
  } else if (status === 'deposited') {
    actions.push({
      id: 'verify',
      label: '✅ 核销预约',
      class: 'btn-success',
      targetStatus: 'verified',
      disabled: false,
      reason: ''
    });
    actions.push({
      id: 'refund',
      label: '↩️ 退回押金',
      class: 'btn-danger',
      targetStatus: 'refunded',
      disabled: false,
      reason: ''
    });
  } else if (status === 'verified') {
    actions.push({
      id: 'noaction1',
      label: '已完成',
      class: 'btn-secondary',
      targetStatus: null,
      disabled: true,
      reason: '已核销的预约无法进行状态变更'
    });
  } else if (status === 'refunded') {
    actions.push({
      id: 'noaction2',
      label: '已退款',
      class: 'btn-secondary',
      targetStatus: null,
      disabled: true,
      reason: '已退款的预约无法进行状态变更'
    });
  }

  container.innerHTML = actions.map(action => `
    <button class="btn ${action.class}" 
            ${action.disabled ? 'disabled' : ''}
            title="${action.reason}"
            onclick="${action.targetStatus ? `updateStatus('${action.targetStatus}')` : ''}">
      ${action.label}
    </button>
  `).join('');
}

function renderAuditLogs(logs) {
  const container = document.getElementById('auditList');

  if (!logs || logs.length === 0) {
    container.innerHTML = '<p style="color: #6b7280; font-size: 0.875rem;">暂无操作记录</p>';
    return;
  }

  container.innerHTML = logs.map(log => `
    <div class="audit-item ${log.action}">
      <div class="audit-header">
        <span class="audit-action">${getActionName(log.action)}</span>
        <span class="audit-time">${formatDateTime(log.created_at)}</span>
      </div>
      ${log.note ? `<div class="audit-note">${log.note}</div>` : ''}
      ${log.from_status || log.to_status ? `
        <div class="audit-status">
          ${log.from_status ? `状态: ${getStatusName(log.from_status)}` : ''}
          ${log.from_status && log.to_status ? ' → ' : ''}
          ${log.to_status ? getStatusName(log.to_status) : ''}
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function updateStatus(newStatus) {
  try {
    let note = '';
    if (newStatus === 'deposited') {
      note = '前台收取押金';
    } else if (newStatus === 'verified') {
      note = '拍摄完成，核销预约';
    } else if (newStatus === 'refunded') {
      note = '客户取消预约，退回押金';
    }

    const response = await fetch(`${API_BASE}/api/bookings/${currentBookingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus, note })
    });

    const data = await response.json();

    if (data.success) {
      showToast('状态更新成功', 'success');
      closeModal('detailModal');
      fetchBookings();
    } else {
      showToast(data.error || '状态更新失败', 'error');
    }
  } catch (error) {
    console.error('更新状态失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }
}

function openNewBookingModal() {
  isEditMode = false;
  currentBookingId = null;
  document.getElementById('modalTitle').textContent = '新建预约';
  
  document.getElementById('bookingId').value = '';
  document.getElementById('customerName').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('studio').value = '';
  document.getElementById('bookingDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('startTime').value = '09:00';
  document.getElementById('endTime').value = '12:00';
  document.getElementById('depositAmount').value = '0';
  document.getElementById('note').value = '';

  openModal('bookingModal');
}

async function editBooking() {
  if (!currentBookingId) return;

  try {
    const response = await fetch(`${API_BASE}/api/bookings/${currentBookingId}`);
    const data = await response.json();

    if (data.success) {
      const booking = data.data;
      
      if (booking.status === 'verified' || booking.status === 'refunded') {
        showToast('已核销或已退款的预约无法修改', 'error');
        return;
      }

      isEditMode = true;
      document.getElementById('modalTitle').textContent = '编辑预约';
      
      document.getElementById('bookingId').value = booking.id;
      document.getElementById('customerName').value = booking.customer_name;
      document.getElementById('phone').value = booking.phone;
      document.getElementById('studio').value = booking.studio;
      document.getElementById('bookingDate').value = booking.booking_date;
      document.getElementById('startTime').value = booking.start_time;
      document.getElementById('endTime').value = booking.end_time;
      document.getElementById('depositAmount').value = booking.deposit_amount;
      document.getElementById('note').value = booking.note || '';

      closeModal('detailModal');
      openModal('bookingModal');
    } else {
      showToast('获取预约详情失败', 'error');
    }
  } catch (error) {
    console.error('获取预约详情失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }
}

async function saveBooking(e) {
  e.preventDefault();

  const bookingData = {
    customer_name: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    studio: document.getElementById('studio').value,
    booking_date: document.getElementById('bookingDate').value,
    start_time: document.getElementById('startTime').value,
    end_time: document.getElementById('endTime').value,
    deposit_amount: parseFloat(document.getElementById('depositAmount').value) || 0,
    note: document.getElementById('note').value.trim()
  };

  if (!bookingData.customer_name || !bookingData.phone || !bookingData.studio ||
      !bookingData.booking_date || !bookingData.start_time || !bookingData.end_time) {
    showToast('请填写所有必填项', 'error');
    return;
  }

  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(bookingData.phone)) {
    showToast('请输入有效的手机号码', 'error');
    return;
  }

  if (bookingData.start_time >= bookingData.end_time) {
    showToast('结束时间必须晚于开始时间', 'error');
    return;
  }

  try {
    let url = `${API_BASE}/api/bookings`;
    let method = 'POST';

    if (isEditMode && currentBookingId) {
      url += `/${currentBookingId}`;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });

    const data = await response.json();

    if (data.success) {
      showToast(isEditMode ? '预约更新成功' : '预约创建成功', 'success');
      closeModal('bookingModal');
      fetchBookings();
    } else {
      showToast(data.error || '操作失败', 'error');
    }
  } catch (error) {
    console.error('保存预约失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }
}

async function exportTodayCsv() {
  const date = document.getElementById('filterDate').value || new Date().toISOString().split('T')[0];
  window.location.href = `${API_BASE}/api/csv/export?date=${encodeURIComponent(date)}`;
}

async function exportAllCsv() {
  window.location.href = `${API_BASE}/api/csv/all`;
}

async function importCsv(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/api/csv/import`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      showToast(`导入成功: ${data.data.imported} 条记录${data.data.errors > 0 ? `，${data.data.errors} 条失败` : ''}`, 
        data.data.errors > 0 ? 'info' : 'success');
      fetchBookings();
    } else {
      showToast(data.error || '导入失败', 'error');
    }
  } catch (error) {
    console.error('导入 CSV 失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }

  e.target.value = '';
}

function initEventListeners() {
  document.getElementById('newBookingBtn').addEventListener('click', openNewBookingModal);
  document.getElementById('exportTodayCsv').addEventListener('click', exportTodayCsv);
  document.getElementById('exportAllCsv').addEventListener('click', exportAllCsv);
  document.getElementById('importCsv').addEventListener('change', importCsv);

  document.getElementById('filterDate').addEventListener('change', fetchBookings);
  document.getElementById('clearDate').addEventListener('click', () => {
    document.getElementById('filterDate').value = '';
    fetchBookings();
  });

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      fetchBookings();
    }, 300);
  });

  document.getElementById('bookingForm').addEventListener('submit', saveBooking);
  document.getElementById('cancelModal').addEventListener('click', () => closeModal('bookingModal'));
  document.getElementById('closeModal').addEventListener('click', () => closeModal('bookingModal'));

  document.getElementById('editBookingBtn').addEventListener('click', editBooking);
  document.getElementById('closeDetailBtn').addEventListener('click', () => closeModal('detailModal'));
  document.getElementById('closeDetailModal').addEventListener('click', () => closeModal('detailModal'));

  document.getElementById('bookingModal').addEventListener('click', (e) => {
    if (e.target.id === 'bookingModal') closeModal('bookingModal');
  });
  document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeModal('detailModal');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('bookingModal');
      closeModal('detailModal');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  fetchBookings();
});
