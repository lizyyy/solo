const API_BASE = '';

let devices = [];
let deviceTypes = [];
let currentFilters = {
  status: '',
  type: ''
};

const elements = {
  deviceTableBody: document.getElementById('deviceTableBody'),
  statusFilter: document.getElementById('statusFilter'),
  typeFilter: document.getElementById('typeFilter'),
  resetFilters: document.getElementById('resetFilters'),
  refreshBtn: document.getElementById('refreshBtn'),
  addDeviceBtn: document.getElementById('addDeviceBtn'),
  csvFileInput: document.getElementById('csvFileInput'),
  exportDevicesBtn: document.getElementById('exportDevicesBtn'),
  exportRecordsBtn: document.getElementById('exportRecordsBtn'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose'),
  reminders: document.getElementById('reminders'),
  remindersList: document.getElementById('remindersList'),
  toast: document.getElementById('toast')
};

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

function showModal(title, content, actions = null) {
  elements.modalTitle.textContent = title;
  elements.modalBody.innerHTML = content;
  elements.modalOverlay.classList.remove('hidden');

  if (actions && typeof actions === 'function') {
    actions();
  }
}

function hideModal() {
  elements.modalOverlay.classList.add('hidden');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
}

function isOverdue(expectedReturnDate) {
  if (!expectedReturnDate) return false;
  const expected = new Date(expectedReturnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expected < today;
}

function isSoon(expectedReturnDate) {
  if (!expectedReturnDate) return false;
  const expected = new Date(expectedReturnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  return expected >= today && expected <= threeDaysLater;
}

function getStatusBadge(device) {
  if (device.status === 'borrowed') {
    if (isOverdue(device.expected_return_date)) {
      return '<span class="status-badge overdue">已逾期</span>';
    }
    return '<span class="status-badge borrowed">借用中</span>';
  }
  return '<span class="status-badge available">可用</span>';
}

function getActionButtons(device) {
  const buttons = [];
  
  if (device.status === 'available') {
    buttons.push(`<button class="btn btn-success btn-small" onclick="borrowDevice(${device.id})">借出</button>`);
  }
  
  if (device.status === 'borrowed') {
    buttons.push(`<button class="btn btn-warning btn-small" onclick="returnDevice(${device.id}, ${device.record_id})">归还</button>`);
  }
  
  buttons.push(`<button class="btn btn-secondary btn-small" onclick="viewHistory(${device.id})">历史</button>`);
  buttons.push(`<button class="btn btn-secondary btn-small" onclick="editDevice(${device.id})">编辑</button>`);
  
  if (device.status === 'available') {
    buttons.push(`<button class="btn btn-danger btn-small" onclick="deleteDevice(${device.id})">删除</button>`);
  }
  
  return `<div class="action-buttons">${buttons.join('')}</div>`;
}

async function fetchDevices() {
  try {
    const params = new URLSearchParams();
    if (currentFilters.status) params.append('status', currentFilters.status);
    if (currentFilters.type) params.append('type', currentFilters.type);
    
    const url = `${API_BASE}/api/devices${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    devices = await response.json();
    renderDevices();
    updateStats();
  } catch (error) {
    console.error('获取设备列表失败:', error);
    showToast('获取设备列表失败', 'error');
  }
}

async function fetchDeviceTypes() {
  try {
    const response = await fetch(`${API_BASE}/api/devices/types`);
    deviceTypes = await response.json();
    renderTypeFilter();
  } catch (error) {
    console.error('获取设备类型失败:', error);
  }
}

async function fetchReminders() {
  try {
    const response = await fetch(`${API_BASE}/api/reminders`);
    const records = await response.json();
    renderReminders(records);
  } catch (error) {
    console.error('获取提醒失败:', error);
  }
}

function renderDevices() {
  if (devices.length === 0) {
    elements.deviceTableBody.innerHTML = '<tr><td colspan="7" class="empty">暂无设备数据</td></tr>';
    return;
  }

  const html = devices.map(device => `
    <tr>
      <td><strong>${device.name}</strong>${device.description ? '<br><small>' + device.description + '</small>' : ''}</td>
      <td>${device.type}</td>
      <td>${getStatusBadge(device)}</td>
      <td>${device.borrower || '-'}</td>
      <td>${formatDate(device.borrow_date)}</td>
      <td>
        ${device.expected_return_date ? 
          `<span class="${isOverdue(device.expected_return_date) ? 'overdue' : isSoon(device.expected_return_date) ? 'soon' : ''}">${formatDate(device.expected_return_date)}</span>` : 
          '-'}
      </td>
      <td>${getActionButtons(device)}</td>
    </tr>
  `).join('');

  elements.deviceTableBody.innerHTML = html;
}

function renderTypeFilter() {
  const currentValue = elements.typeFilter.value;
  
  elements.typeFilter.innerHTML = '<option value="">全部类型</option>' +
    deviceTypes.map(type => `<option value="${type}">${type}</option>`).join('');
  
  elements.typeFilter.value = currentValue;
}

function renderReminders(records) {
  const overdueRecords = records.filter(r => {
    const expected = new Date(r.expected_return_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expected < today;
  });

  const soonRecords = records.filter(r => {
    const expected = new Date(r.expected_return_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    return expected >= today && expected <= threeDaysLater;
  });

  if (overdueRecords.length === 0 && soonRecords.length === 0) {
    elements.reminders.classList.add('hidden');
    return;
  }

  let html = '';
  
  overdueRecords.forEach(record => {
    html += `
      <div class="reminder-item overdue">
        <span class="reminder-icon">⚠️</span>
        <span><strong>${record.device_name}</strong> (${record.borrower}) 已逾期，预计归还日期：${formatDate(record.expected_return_date)}</span>
      </div>
    `;
  });

  soonRecords.forEach(record => {
    html += `
      <div class="reminder-item soon">
        <span class="reminder-icon">⏰</span>
        <span><strong>${record.device_name}</strong> (${record.borrower}) 即将到期，预计归还日期：${formatDate(record.expected_return_date)}</span>
      </div>
    `;
  });

  elements.remindersList.innerHTML = html;
  elements.reminders.classList.remove('hidden');
}

function updateStats() {
  const total = devices.length;
  const available = devices.filter(d => d.status === 'available').length;
  const borrowed = devices.filter(d => d.status === 'borrowed').length;
  const overdue = devices.filter(d => d.status === 'borrowed' && isOverdue(d.expected_return_date)).length;

  document.getElementById('totalDevices').textContent = total;
  document.getElementById('availableDevices').textContent = available;
  document.getElementById('borrowedDevices').textContent = borrowed;
  document.getElementById('overdueDevices').textContent = overdue;
}

function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

function getThreeDaysLaterDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().split('T')[0];
}

async function borrowDevice(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  const content = `
    <form id="borrowForm">
      <div class="form-group">
        <label>设备名称</label>
        <input type="text" value="${device.name}" disabled>
      </div>
      <div class="form-group">
        <label for="borrower">借用人 <span class="required">*</span></label>
        <input type="text" id="borrower" placeholder="请输入借用人姓名" required>
      </div>
      <div class="form-group">
        <label for="expectedReturnDate">预计归还日期 <span class="required">*</span></label>
        <input type="date" id="expectedReturnDate" value="${getThreeDaysLaterDate()}" min="${getTomorrowDate()}" required>
        <p class="form-hint">请选择今天之后的日期</p>
      </div>
      <div class="form-group">
        <label for="notes">备注</label>
        <textarea id="notes" placeholder="可选：备注信息"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
        <button type="submit" class="btn btn-success">确认借出</button>
      </div>
    </form>
  `;

  showModal('登记借出', content, () => {
    document.getElementById('borrowForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const borrower = document.getElementById('borrower').value.trim();
      const expectedReturnDate = document.getElementById('expectedReturnDate').value;
      const notes = document.getElementById('notes').value.trim();

      if (!borrower || !expectedReturnDate) {
        showToast('请填写必填项', 'error');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/borrow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: deviceId,
            borrower,
            expected_return_date: expectedReturnDate,
            notes
          })
        });

        if (response.ok) {
          hideModal();
          showToast('借出登记成功', 'success');
          await fetchDevices();
          await fetchReminders();
        } else {
          const data = await response.json();
          showToast(data.error || '借出登记失败', 'error');
        }
      } catch (error) {
        console.error('借出失败:', error);
        showToast('借出登记失败', 'error');
      }
    });
  });
}

async function returnDevice(deviceId, recordId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  const content = `
    <div style="text-align: center; padding: 20px 0;">
      <p><strong>${device.name}</strong></p>
      <p>当前借用人：${device.borrower}</p>
      <p>借出日期：${formatDate(device.borrow_date)}</p>
      <p>预计归还日期：${formatDate(device.expected_return_date)}</p>
      <br>
      <p>确认要登记归还吗？</p>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
      <button type="button" class="btn btn-success" id="confirmReturn">确认归还</button>
    </div>
  `;

  showModal('登记归还', content, () => {
    document.getElementById('confirmReturn').addEventListener('click', async () => {
      try {
        const response = await fetch(`${API_BASE}/api/return/${recordId}`, {
          method: 'POST'
        });

        if (response.ok) {
          hideModal();
          showToast('归还登记成功', 'success');
          await fetchDevices();
          await fetchReminders();
        } else {
          const data = await response.json();
          showToast(data.error || '归还登记失败', 'error');
        }
      } catch (error) {
        console.error('归还失败:', error);
        showToast('归还登记失败', 'error');
      }
    });
  });
}

async function viewHistory(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  try {
    const response = await fetch(`${API_BASE}/api/devices/${deviceId}/history`);
    const records = await response.json();

    let content = `<p><strong>设备：</strong>${device.name} (${device.type})</p><br>`;

    if (records.length === 0) {
      content += '<p class="empty">暂无借用历史记录</p>';
    } else {
      content += records.map(record => `
        <div class="history-item">
          <div class="history-header">
            <span class="history-borrower">${record.borrower}</span>
            <span class="history-status status-badge ${record.status === 'returned' ? 'available' : 'borrowed'}">
              ${record.status === 'returned' ? '已归还' : '借用中'}
            </span>
          </div>
          <div class="history-details">
            <span>借出：${formatDate(record.borrow_date)}</span>
            <span>预计归还：${formatDate(record.expected_return_date)}</span>
            ${record.actual_return_date ? `<span>实际归还：${formatDate(record.actual_return_date)}</span>` : ''}
          </div>
          ${record.notes ? `<div class="history-details">备注：${record.notes}</div>` : ''}
        </div>
      `).join('');
    }

    content += `
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="hideModal()">关闭</button>
      </div>
    `;

    showModal('借用历史记录', content);
  } catch (error) {
    console.error('获取历史记录失败:', error);
    showToast('获取历史记录失败', 'error');
  }
}

function addDevice() {
  const content = `
    <form id="addDeviceForm">
      <div class="form-group">
        <label for="deviceName">设备名称 <span class="required">*</span></label>
        <input type="text" id="deviceName" placeholder="请输入设备名称" required>
      </div>
      <div class="form-group">
        <label for="deviceType">设备类型 <span class="required">*</span></label>
        <select id="deviceType" required>
          <option value="">请选择或输入类型</option>
          ${deviceTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <p class="form-hint">或在下方输入新类型</p>
        <input type="text" id="newDeviceType" placeholder="输入新类型（可选）">
      </div>
      <div class="form-group">
        <label for="deviceDescription">描述</label>
        <textarea id="deviceDescription" placeholder="设备描述（可选）"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  `;

  showModal('新增设备', content, () => {
    document.getElementById('addDeviceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('deviceName').value.trim();
      let type = document.getElementById('newDeviceType').value.trim() || document.getElementById('deviceType').value;
      const description = document.getElementById('deviceDescription').value.trim();

      if (!name || !type) {
        showToast('请填写设备名称和类型', 'error');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, description })
        });

        if (response.ok) {
          hideModal();
          showToast('设备添加成功', 'success');
          await fetchDevices();
          await fetchDeviceTypes();
        } else {
          const data = await response.json();
          showToast(data.error || '添加设备失败', 'error');
        }
      } catch (error) {
        console.error('添加设备失败:', error);
        showToast('添加设备失败', 'error');
      }
    });
  });
}

async function editDevice(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  const content = `
    <form id="editDeviceForm">
      <div class="form-group">
        <label for="editDeviceName">设备名称 <span class="required">*</span></label>
        <input type="text" id="editDeviceName" value="${device.name}" required>
      </div>
      <div class="form-group">
        <label for="editDeviceType">设备类型 <span class="required">*</span></label>
        <select id="editDeviceType" required>
          <option value="">请选择或输入类型</option>
          ${deviceTypes.map(t => `<option value="${t}" ${t === device.type ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <p class="form-hint">或在下方输入新类型</p>
        <input type="text" id="editNewDeviceType" placeholder="输入新类型（可选）">
      </div>
      <div class="form-group">
        <label for="editDeviceDescription">描述</label>
        <textarea id="editDeviceDescription">${device.description || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  `;

  showModal('编辑设备', content, () => {
    document.getElementById('editDeviceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('editDeviceName').value.trim();
      let type = document.getElementById('editNewDeviceType').value.trim() || document.getElementById('editDeviceType').value;
      const description = document.getElementById('editDeviceDescription').value.trim();

      if (!name || !type) {
        showToast('请填写设备名称和类型', 'error');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/devices/${deviceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, description })
        });

        if (response.ok) {
          hideModal();
          showToast('设备更新成功', 'success');
          await fetchDevices();
          await fetchDeviceTypes();
        } else {
          const data = await response.json();
          showToast(data.error || '更新设备失败', 'error');
        }
      } catch (error) {
        console.error('更新设备失败:', error);
        showToast('更新设备失败', 'error');
      }
    });
  });
}

async function deleteDevice(deviceId) {
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;

  const content = `
    <div style="text-align: center; padding: 20px 0;">
      <p>确定要删除设备 <strong>${device.name}</strong> 吗？</p>
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 10px;">删除后无法恢复</p>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
      <button type="button" class="btn btn-danger" id="confirmDelete">确认删除</button>
    </div>
  `;

  showModal('确认删除', content, () => {
    document.getElementById('confirmDelete').addEventListener('click', async () => {
      try {
        const response = await fetch(`${API_BASE}/api/devices/${deviceId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          hideModal();
          showToast('设备删除成功', 'success');
          await fetchDevices();
        } else {
          const data = await response.json();
          showToast(data.error || '删除设备失败', 'error');
        }
      } catch (error) {
        console.error('删除设备失败:', error);
        showToast('删除设备失败', 'error');
      }
    });
  });
}

async function importCSV(file) {
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/api/import/csv`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message, 'success');
      await fetchDevices();
      await fetchDeviceTypes();
    } else {
      showToast(data.error || '导入失败', 'error');
    }
  } catch (error) {
    console.error('导入失败:', error);
    showToast('导入失败', 'error');
  }
}

function exportDevices() {
  window.open(`${API_BASE}/api/export/csv`, '_blank');
}

function exportRecords() {
  window.open(`${API_BASE}/api/export/csv?type=records`, '_blank');
}

function initEventListeners() {
  elements.refreshBtn.addEventListener('click', async () => {
    await fetchDevices();
    await fetchReminders();
    showToast('已刷新', 'success');
  });

  elements.addDeviceBtn.addEventListener('click', addDevice);

  elements.statusFilter.addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    fetchDevices();
  });

  elements.typeFilter.addEventListener('change', (e) => {
    currentFilters.type = e.target.value;
    fetchDevices();
  });

  elements.resetFilters.addEventListener('click', () => {
    currentFilters = { status: '', type: '' };
    elements.statusFilter.value = '';
    elements.typeFilter.value = '';
    fetchDevices();
  });

  elements.csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importCSV(file);
      e.target.value = '';
    }
  });

  elements.exportDevicesBtn.addEventListener('click', exportDevices);
  elements.exportRecordsBtn.addEventListener('click', exportRecords);

  elements.modalClose.addEventListener('click', hideModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) {
      hideModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideModal();
    }
  });
}

async function init() {
  initEventListeners();
  await Promise.all([
    fetchDeviceTypes(),
    fetchDevices(),
    fetchReminders()
  ]);
}

init();
