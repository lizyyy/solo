const API_BASE = '/api';
let currentRecordId = null;

document.addEventListener('DOMContentLoaded', function() {
  initDateInputs();
  loadRecords();
  bindEvents();
});

function initDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  document.getElementById('valid_from').value = today;
  document.getElementById('valid_to').value = tomorrow;
}

function bindEvents() {
  document.getElementById('recordForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('searchBtn').addEventListener('click', loadRecords);
  document.getElementById('refreshBtn').addEventListener('click', loadRecords);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('importFile').addEventListener('change', handleImport);
  document.getElementById('cancelReceive').addEventListener('click', closeReceiveModal);
  document.getElementById('confirmReceive').addEventListener('click', handleConfirmReceive);
  document.getElementById('closeImport').addEventListener('click', closeImportModal);
  
  document.querySelectorAll('.modal .close').forEach(el => {
    el.addEventListener('click', function() {
      closeReceiveModal();
      closeImportModal();
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeReceiveModal();
        closeImportModal();
      }
    });
  });
}

async function loadRecords() {
  const roomNumber = document.getElementById('search_room').value.trim();
  const phone = document.getElementById('search_phone').value.trim();
  const status = document.getElementById('search_status').value;

  let url = `${API_BASE}/records?`;
  const params = [];
  if (roomNumber) params.push(`room_number=${encodeURIComponent(roomNumber)}`);
  if (phone) params.push(`phone=${encodeURIComponent(phone)}`);
  if (status) params.push(`status=${encodeURIComponent(status)}`);
  
  if (params.length > 0) url += params.join('&');

  try {
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success) {
      renderRecords(result.data);
    } else {
      showToast('加载记录失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (err) {
    showToast('网络错误: ' + err.message, 'error');
  }
}

function renderRecords(records) {
  const tbody = document.getElementById('recordsTableBody');
  const noData = document.getElementById('noData');
  
  if (!records || records.length === 0) {
    tbody.innerHTML = '';
    noData.style.display = 'flex';
    return;
  }

  noData.style.display = 'none';
  
  tbody.innerHTML = records.map(record => {
    const statusClass = getStatusClass(record.status);
    const actions = record.status === '待领取' 
      ? `<button class="action-btn btn-success" onclick="openReceiveModal(${record.id})">领取</button>`
      : '<span style="color: #999;">-</span>';

    return `
      <tr>
        <td>${record.id}</td>
        <td>${escapeHtml(record.room_number)}</td>
        <td>${escapeHtml(record.resident_name)}</td>
        <td>${escapeHtml(record.phone)}</td>
        <td>${escapeHtml(record.storage_type)}</td>
        <td>${escapeHtml(record.receiver_name || '-')}</td>
        <td>${record.valid_from} 至 ${record.valid_to}</td>
        <td><span class="status-badge ${statusClass}">${record.status}</span></td>
        <td>${record.created_at}</td>
        <td><div class="action-buttons">${actions}</div></td>
      </tr>
    `;
  }).join('');
}

function getStatusClass(status) {
  switch (status) {
    case '待领取': return 'status-pending';
    case '已领取': return 'status-received';
    case '已过期': return 'status-expired';
    default: return 'status-pending';
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const formData = {
    room_number: document.getElementById('room_number').value.trim(),
    resident_name: document.getElementById('resident_name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    storage_type: document.getElementById('storage_type').value,
    receiver_name: document.getElementById('receiver_name').value.trim() || null,
    valid_from: document.getElementById('valid_from').value,
    valid_to: document.getElementById('valid_to').value,
    remarks: document.getElementById('remarks').value.trim() || null
  };

  if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
    showToast('请输入有效的11位手机号', 'warning');
    return;
  }

  if (new Date(formData.valid_to) < new Date(formData.valid_from)) {
    showToast('有效期结束不能早于开始日期', 'warning');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (result.success) {
      showToast('登记成功！', 'success');
      document.getElementById('recordForm').reset();
      initDateInputs();
      loadRecords();
    } else {
      if (response.status === 409) {
        showToast(result.message || '该房号手机号已有待领取记录', 'warning');
      } else {
        showToast('登记失败: ' + (result.error || '未知错误'), 'error');
      }
    }
  } catch (err) {
    showToast('网络错误: ' + err.message, 'error');
  }
}

async function openReceiveModal(id) {
  currentRecordId = id;
  
  try {
    const response = await fetch(`${API_BASE}/records/${id}`);
    const result = await response.json();
    
    if (result.success) {
      const record = result.data;
      document.getElementById('receiveRecordInfo').innerHTML = `
        <p><strong>ID:</strong> ${record.id}</p>
        <p><strong>房号:</strong> ${escapeHtml(record.room_number)}</p>
        <p><strong>住户:</strong> ${escapeHtml(record.resident_name)}</p>
        <p><strong>手机号:</strong> ${escapeHtml(record.phone)}</p>
        <p><strong>寄存类型:</strong> ${escapeHtml(record.storage_type)}</p>
        <p><strong>有效期:</strong> ${record.valid_from} 至 ${record.valid_to}</p>
      `;
      document.getElementById('received_by').value = '';
      document.getElementById('receiveModal').style.display = 'flex';
    } else {
      showToast('获取记录失败', 'error');
    }
  } catch (err) {
    showToast('网络错误: ' + err.message, 'error');
  }
}

function closeReceiveModal() {
  document.getElementById('receiveModal').style.display = 'none';
  currentRecordId = null;
}

async function handleConfirmReceive() {
  const receivedBy = document.getElementById('received_by').value.trim();
  
  if (!receivedBy) {
    showToast('请输入操作人姓名', 'warning');
    return;
  }

  if (!currentRecordId) return;

  try {
    const response = await fetch(`${API_BASE}/records/${currentRecordId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: '已领取',
        received_by: receivedBy
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('领取确认成功！', 'success');
      closeReceiveModal();
      loadRecords();
    } else {
      showToast('操作失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (err) {
    showToast('网络错误: ' + err.message, 'error');
  }
}

function handleExport() {
  window.open(`${API_BASE}/csv/export`, '_blank');
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/csv/import`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      renderImportResult(result);
      loadRecords();
    } else {
      showToast('导入失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (err) {
    showToast('网络错误: ' + err.message, 'error');
  }

  e.target.value = '';
}

function renderImportResult(result) {
  const summary = result.summary;
  const details = result.details;

  document.getElementById('importSummary').innerHTML = `
    <div class="summary-item summary-success">
      <div class="count">${summary.success}</div>
      <div class="label">成功</div>
    </div>
    <div class="summary-item summary-skipped">
      <div class="count">${summary.skipped}</div>
      <div class="label">跳过</div>
    </div>
    <div class="summary-item summary-failed">
      <div class="count">${summary.failed}</div>
      <div class="label">失败</div>
    </div>
  `;

  document.getElementById('importDetails').innerHTML = `
    <table class="details-table">
      <thead>
        <tr><th>行号</th><th>状态</th><th>说明</th></tr>
      </thead>
      <tbody>
        ${details.map(d => `
          <tr>
            <td>${d.row}</td>
            <td>
              <span class="status-badge ${d.status === '成功' ? 'status-received' : d.status === '跳过' ? 'status-pending' : 'status-expired'}">
                ${d.status}
              </span>
            </td>
            <td>${escapeHtml(d.reason || (d.id ? `ID: ${d.id}` : ''))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('importModal').style.display = 'flex';
}

function closeImportModal() {
  document.getElementById('importModal').style.display = 'none';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast';
  if (type !== 'default') {
    toast.classList.add(`toast-${type}`);
  }
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}
