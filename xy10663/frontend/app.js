const API_BASE = 'http://localhost:3000/api';
let currentPage = 1;
let currentFilters = {};

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="tab-"]').forEach(el => {
    el.classList.remove('tab-active');
    el.classList.add('text-gray-600');
  });
  
  document.getElementById(`content-${tabName}`).classList.remove('hidden');
  const activeTab = document.getElementById(`tab-${tabName}`);
  activeTab.classList.add('tab-active');
  activeTab.classList.remove('text-gray-600');

  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'list') loadAppointments();
  if (tabName === 'reminders') loadReminders();
}

function getStatusColor(status) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
    no_show: 'bg-red-100 text-red-800',
    abnormal: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function getStatusText(status) {
  const texts = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
    no_show: '未到诊',
    abnormal: '异常',
    processing: '检验中'
  };
  return texts[status] || status;
}

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/appointments/dashboard`);
    const data = await response.json();

    const statsContainer = document.getElementById('dashboard-stats');
    statsContainer.innerHTML = '';

    const statusMap = {
      pending: { label: '待确认', icon: 'clock-o', color: 'yellow' },
      confirmed: { label: '已确认', icon: 'check-circle', color: 'blue' },
      completed: { label: '已完成', icon: 'check', color: 'green' },
      cancelled: { label: '已取消', icon: 'times', color: 'gray' }
    };

    data.status_counts.forEach(item => {
      const config = statusMap[item.status] || { label: item.status, icon: 'circle', color: 'gray' };
      statsContainer.innerHTML += `
        <div class="bg-white rounded-lg shadow-sm p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-3xl font-bold text-gray-800">${item.count}</p>
              <p class="text-sm text-gray-500 mt-1">${config.label}</p>
            </div>
            <div class="w-12 h-12 bg-${config.color}-100 rounded-full flex items-center justify-center">
              <i class="fa fa-${config.icon} text-${config.color}-600 text-xl"></i>
            </div>
          </div>
        </div>
      `;
    });

    const abnormalList = document.getElementById('abnormal-list');
    abnormalList.innerHTML = '';
    
    const abnormalResponse = await fetch(`${API_BASE}/appointments/abnormal`);
    const abnormalData = await abnormalResponse.json();
    
    if (abnormalData.length === 0) {
      abnormalList.innerHTML = '<p class="text-gray-500 text-center py-4">暂无异常改约记录</p>';
    } else {
      abnormalData.forEach(item => {
        abnormalList.innerHTML += `
          <div class="p-4 bg-red-50 rounded-lg border border-red-100">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h4 class="font-medium text-gray-800">${item.patient_name}</h4>
                <p class="text-sm text-gray-500">${item.lab_item}</p>
              </div>
              <span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">异常</span>
            </div>
            <p class="text-sm text-red-600"><i class="fa fa-exclamation-circle mr-1"></i>${item.abnormal_note || '频繁改约'}</p>
            <p class="text-xs text-gray-500 mt-2">操作人：${item.operator} | ${new Date(item.created_at).toLocaleString()}</p>
          </div>
        `;
      });
    }

    const trendChart = document.getElementById('trend-chart');
    trendChart.innerHTML = '';
    const maxCount = Math.max(...data.weekly_trend.map(d => d.count), 1);
    
    data.weekly_trend.forEach(item => {
      const height = (item.count / maxCount) * 100;
      const date = new Date(item.date);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      trendChart.innerHTML += `
        <div class="flex flex-col items-center" style="width: 12%;">
          <div class="w-full bg-primary/80 rounded-t" style="height: ${height}%; min-height: 8px;"></div>
          <p class="text-xs text-gray-500 mt-2">${dateStr}</p>
          <p class="text-xs font-medium text-gray-700">${item.count}</p>
        </div>
      `;
    });
  } catch (error) {
    console.error('加载看板数据失败:', error);
  }
}

async function loadAppointments(page = 1) {
  currentPage = page;
  const params = new URLSearchParams({
    page: currentPage,
    limit: 10,
    ...currentFilters
  });

  try {
    const response = await fetch(`${API_BASE}/appointments?${params}`);
    const result = await response.json();
    const listContainer = document.getElementById('appointment-list');
    listContainer.innerHTML = '';

    result.data.forEach(item => {
      listContainer.innerHTML += `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3">
            <div class="font-medium text-gray-800">${item.patient_name}</div>
            <div class="text-xs text-gray-500">${item.patient_id} | ${item.phone || '无电话'}</div>
          </td>
          <td class="px-4 py-3">
            <div class="text-gray-800">${item.lab_item}</div>
            <div class="text-xs text-gray-500">${item.lab_item_code || ''}</div>
          </td>
          <td class="px-4 py-3 text-gray-600">${item.sampling_window}</td>
          <td class="px-4 py-3">
            ${item.fasting_required === 1 ? 
              '<span class="text-orange-600"><i class="fa fa-warning mr-1"></i>空腹' + (item.fasting_hours ? ` ${item.fasting_hours}小时` : '') + '</span>' : 
              '<span class="text-gray-500">无需空腹</span>'}
          </td>
          <td class="px-4 py-3 text-gray-600">${item.appointment_date} ${item.appointment_time}</td>
          <td class="px-4 py-3">
            <span class="status-badge ${getStatusColor(item.status)}">${getStatusText(item.status)}</span>
            <span class="status-badge ${getStatusColor(item.report_status)} ml-1">${getStatusText(item.report_status)}</span>
          </td>
          <td class="px-4 py-3">
            <span class="${item.reschedule_count > 2 ? 'text-red-600 font-medium' : 'text-gray-600'}">${item.reschedule_count}次</span>
          </td>
          <td class="px-4 py-3">
            <div class="flex space-x-2">
              <button onclick="viewDetail(${item.id})" class="text-primary hover:text-primary/80" title="查看详情">
                <i class="fa fa-eye"></i>
              </button>
              <button onclick="openReschedule(${item.id})" class="text-blue-600 hover:text-blue-800" title="改约">
                <i class="fa fa-calendar"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    const totalPages = Math.ceil(result.total / 10);
    document.getElementById('pagination-info').textContent = `共 ${result.total} 条记录，第 ${currentPage}/${totalPages} 页`;
    
    const paginationButtons = document.getElementById('pagination-buttons');
    paginationButtons.innerHTML = '';
    
    if (currentPage > 1) {
      paginationButtons.innerHTML += `<button onclick="loadAppointments(${currentPage - 1})" class="px-3 py-1 border rounded hover:bg-gray-50">上一页</button>`;
    }
    if (currentPage < totalPages) {
      paginationButtons.innerHTML += `<button onclick="loadAppointments(${currentPage + 1})" class="px-3 py-1 border rounded hover:bg-gray-50">下一页</button>`;
    }
  } catch (error) {
    console.error('加载预约列表失败:', error);
  }
}

function applyFilters() {
  currentFilters = {
    patient_name: document.getElementById('filter-patient').value,
    lab_item: document.getElementById('filter-lab-item').value,
    status: document.getElementById('filter-status').value,
    report_status: document.getElementById('filter-report-status').value,
    start_date: document.getElementById('filter-start-date').value,
    end_date: document.getElementById('filter-end-date').value,
    handler: document.getElementById('filter-handler').value,
    start_handler_time: document.getElementById('filter-handler-date').value
  };
  
  Object.keys(currentFilters).forEach(key => {
    if (!currentFilters[key]) delete currentFilters[key];
  });
  
  loadAppointments(1);
}

function resetFilters() {
  document.getElementById('filter-patient').value = '';
  document.getElementById('filter-lab-item').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-report-status').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.getElementById('filter-handler').value = '';
  document.getElementById('filter-handler-date').value = '';
  currentFilters = {};
  loadAppointments(1);
}

function exportCSV() {
  const params = new URLSearchParams(currentFilters);
  window.open(`${API_BASE}/appointments/export/csv?${params}`, '_blank');
}

async function viewDetail(id) {
  try {
    const response = await fetch(`${API_BASE}/appointments/${id}`);
    const data = await response.json();
    
    const logsResponse = await fetch(`${API_BASE}/appointments/${id}/logs`);
    const logs = await logsResponse.json();
    
    const fastingResponse = await fetch(`${API_BASE}/appointments/fasting/validate/${id}`);
    const fastingInfo = await fastingResponse.json();

    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label class="text-sm text-gray-500">患者姓名</label>
          <p class="font-medium">${data.patient_name}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">患者ID</label>
          <p class="font-medium">${data.patient_id}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">联系电话</label>
          <p class="font-medium">${data.phone || '无'}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">检验项目</label>
          <p class="font-medium">${data.lab_item}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">采样窗口</label>
          <p class="font-medium">${data.sampling_window}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">空腹要求</label>
          <p class="font-medium">${data.fasting_required === 1 ? `是 (${data.fasting_hours}小时)` : '否'}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">预约时间</label>
          <p class="font-medium">${data.appointment_date} ${data.appointment_time}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">状态</label>
          <p>
            <span class="status-badge ${getStatusColor(data.status)}">${getStatusText(data.status)}</span>
            <span class="status-badge ${getStatusColor(data.report_status)} ml-1">${getStatusText(data.report_status)}</span>
          </p>
        </div>
      </div>
      
      ${fastingInfo.recommendation ? `
        <div class="mb-6 p-3 bg-orange-50 rounded-lg border border-orange-100">
          <p class="text-orange-700"><i class="fa fa-exclamation-triangle mr-2"></i>${fastingInfo.recommendation}</p>
        </div>
      ` : ''}

      <div>
        <h4 class="font-medium mb-3"><i class="fa fa-history mr-2"></i>操作日志</h4>
        <div class="space-y-3 max-h-60 overflow-y-auto">
          ${logs.length === 0 ? '<p class="text-gray-500">暂无操作记录</p>' : logs.map(log => `
            <div class="p-3 bg-gray-50 rounded-lg">
              <div class="flex justify-between items-start">
                <div>
                  <span class="text-xs px-2 py-1 rounded ${log.type === 'reschedule' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}">
                    ${log.type === 'reschedule' ? '改约' : '调整'}
                  </span>
                  <span class="text-sm text-gray-600 ml-2">${log.operator}</span>
                </div>
                <span class="text-xs text-gray-500">${new Date(log.created_at).toLocaleString()}</span>
              </div>
              <p class="text-sm text-gray-600 mt-1">${log.reason || ''}</p>
              ${log.old_value ? `<p class="text-xs text-gray-500 mt-1">${log.old_value} → ${log.new_value}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('detail-modal').classList.remove('hidden');
  } catch (error) {
    console.error('加载详情失败:', error);
  }
}

function closeModal() {
  document.getElementById('detail-modal').classList.add('hidden');
}

function openReschedule(id) {
  document.getElementById('reschedule-id').value = id;
  document.getElementById('reschedule-modal').classList.remove('hidden');
}

function closeRescheduleModal() {
  document.getElementById('reschedule-modal').classList.add('hidden');
  document.getElementById('reschedule-id').value = '';
  document.getElementById('new-date').value = '';
  document.getElementById('new-time').value = '';
  document.getElementById('reschedule-reason').value = '';
}

async function submitReschedule() {
  const id = document.getElementById('reschedule-id').value;
  const newDate = document.getElementById('new-date').value;
  const newTime = document.getElementById('new-time').value;
  const reason = document.getElementById('reschedule-reason').value;
  const operator = document.getElementById('reschedule-operator').value;

  if (!newDate || !newTime) {
    alert('请选择新的预约日期和时间');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/appointments/${id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_appointment_date: newDate,
        new_appointment_time: newTime,
        reason: reason,
        operator: operator
      })
    });

    const result = await response.json();
    if (result.is_abnormal) {
      alert(`改约成功！注意：该患者改约次数较多，已标记为异常`);
    } else {
      alert('改约成功');
    }
    
    closeRescheduleModal();
    loadAppointments(currentPage);
    loadDashboard();
  } catch (error) {
    alert('改约失败');
    console.error(error);
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploadFile(file);
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    const resultBox = document.getElementById('result-box');
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const errorList = document.getElementById('error-list');
    const errorItems = document.getElementById('error-items');

    document.getElementById('import-result').classList.remove('hidden');

    if (result.failed === 0) {
      resultBox.className = 'p-4 rounded-lg bg-green-50 border border-green-200';
      resultIcon.className = 'fa fa-check-circle text-2xl mr-3 text-green-600';
      resultTitle.textContent = '导入成功';
      resultTitle.className = 'font-semibold text-green-800';
      resultMessage.textContent = `成功导入 ${result.success} 条记录`;
      errorList.classList.add('hidden');
    } else {
      resultBox.className = 'p-4 rounded-lg bg-yellow-50 border border-yellow-200';
      resultIcon.className = 'fa fa-exclamation-triangle text-2xl mr-3 text-yellow-600';
      resultTitle.textContent = '导入完成（部分失败）';
      resultTitle.className = 'font-semibold text-yellow-800';
      resultMessage.textContent = `成功 ${result.success} 条，失败 ${result.failed} 条`;
      
      errorItems.innerHTML = '';
      result.errors.forEach(err => {
        errorItems.innerHTML += `<li>${err}</li>`;
      });
      errorList.classList.remove('hidden');
    }

    loadAppointments(currentPage);
    loadDashboard();
  } catch (error) {
    alert('上传失败');
    console.error(error);
  }
}

const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-primary', 'bg-primary/5');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-primary', 'bg-primary/5');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-primary', 'bg-primary/5');
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

async function loadReminders() {
  try {
    const response = await fetch(`${API_BASE}/appointments/reminders/pending`);
    const data = await response.json();
    const container = document.getElementById('reminder-list');
    
    if (data.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-8">明日暂无需要提醒的患者</p>';
      document.getElementById('send-all-btn').disabled = true;
      document.getElementById('send-all-btn').classList.add('opacity-50');
      return;
    }

    document.getElementById('send-all-btn').disabled = false;
    document.getElementById('send-all-btn').classList.remove('opacity-50');

    container.innerHTML = '';
    data.forEach(item => {
      container.innerHTML += `
        <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-100 flex items-center justify-between">
          <div class="flex items-center">
            <input type="checkbox" class="reminder-checkbox mr-4" value="${item.id}" checked>
            <div>
              <h4 class="font-medium text-gray-800">${item.patient_name}</h4>
              <p class="text-sm text-gray-500">${item.lab_item} | ${item.appointment_time}</p>
              <p class="text-sm ${item.fasting_required === 1 ? 'text-orange-600' : 'text-gray-500'}">
                ${item.fasting_required === 1 ? '<i class="fa fa-warning mr-1"></i>需空腹' : '无需空腹'}
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-500">${item.phone || '无电话'}</p>
            <p class="text-xs text-gray-400">已提醒 ${item.reminder_count} 次</p>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error('加载提醒列表失败:', error);
  }
}

async function sendAllReminders() {
  const checkboxes = document.querySelectorAll('.reminder-checkbox:checked');
  const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
  
  if (ids.length === 0) {
    alert('请选择需要发送提醒的患者');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/appointments/reminders/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_ids: ids,
        operator: '张三'
      })
    });

    const result = await response.json();
    alert(result.message);
    loadReminders();
  } catch (error) {
    alert('发送提醒失败');
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
