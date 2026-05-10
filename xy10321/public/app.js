const API_BASE = '';
let currentMonth = new Date();
let selectedDate = new Date();
let editingAppointmentId = null;
let currentAddonAppointmentId = null;
let currentSupplyAppointmentId = null;
let currentServiceDuration = 0;

let petTypes = [];
let services = [];
let addOns = [];
let beauticians = [];
let pets = [];
let supplies = [];

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  updateCurrentDate();
  setupNavigation();
  
  await loadMasterData();
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filterDate').value = today;
  document.getElementById('reportDate').value = today;
  
  renderCalendar();
  await loadAppointments();
  await loadPets();
  await loadSupplies();
  await loadPendingAddOns();
  await loadDailyReport();
}

function updateCurrentDate() {
  const now = new Date();
  document.getElementById('currentDate').textContent = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(tab).classList.add('active');
      
      if (tab === 'appointments') loadAppointments();
      if (tab === 'pets') loadPets();
      if (tab === 'supplies') loadSupplies();
      if (tab === 'addons') loadPendingAddOns();
      if (tab === 'report') loadDailyReport();
    });
  });
}

async function loadMasterData() {
  const [
    typesRes,
    servicesRes,
    addonsRes,
    beauticiansRes,
    petsRes,
    suppliesRes
  ] = await Promise.all([
    fetch(`${API_BASE}/api/pet-types`),
    fetch(`${API_BASE}/api/services`),
    fetch(`${API_BASE}/api/addons`),
    fetch(`${API_BASE}/api/beauticians`),
    fetch(`${API_BASE}/api/pets`),
    fetch(`${API_BASE}/api/supplies`)
  ]);
  
  petTypes = await typesRes.json();
  services = await servicesRes.json();
  addOns = await addonsRes.json();
  beauticians = await beauticiansRes.json();
  pets = await petsRes.json();
  supplies = await suppliesRes.json();
  
  populateSelects();
}

function populateSelects() {
  const appointmentPet = document.getElementById('appointmentPet');
  appointmentPet.innerHTML = '<option value="">请选择宠物</option>';
  pets.forEach(p => {
    const type = petTypes.find(t => t.id === p.typeId);
    appointmentPet.innerHTML += `<option value="${p.id}" data-type="${p.typeId}">${p.petName} (${type ? type.name : ''} - ${p.ownerName})</option>`;
  });
  
  const appointmentBeautician = document.getElementById('appointmentBeautician');
  const filterBeautician = document.getElementById('filterBeautician');
  const beauticianOptions = '<option value="">请选择美容师</option>' + 
    beauticians.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  appointmentBeautician.innerHTML = beauticianOptions;
  filterBeautician.innerHTML = '<option value="">全部</option>' + 
    beauticians.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  
  const appointmentService = document.getElementById('appointmentService');
  appointmentService.innerHTML = '<option value="">请选择服务</option>';
  services.forEach(s => {
    appointmentService.innerHTML += `<option value="${s.id}" data-duration="${s.duration}" data-price="${s.basePrice}">${s.name} - ¥${s.basePrice} (${s.duration}分钟)</option>`;
  });
  
  const petType = document.getElementById('petType');
  petType.innerHTML = '<option value="">请选择类型</option>';
  petTypes.forEach(t => {
    petType.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });
  
  const addonSelect = document.getElementById('addonSelect');
  addonSelect.innerHTML = '<option value="">请选择加项</option>';
  addOns.forEach(a => {
    addonSelect.innerHTML += `<option value="${a.id}" data-price="${a.price}" data-duration="${a.duration}">${a.name} - ¥${a.price} (${a.duration}分钟)</option>`;
  });
}

function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  document.getElementById('calendarTitle').textContent = 
    `${year}年${month + 1}月`;
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let html = '';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  weekdays.forEach(day => {
    html += `<div class="calendar-header">${day}</div>`;
  });
  
  for (let i = 0; i < startWeekday; i++) {
    html += `<div class="calendar-day"></div>`;
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month, day);
    
    let classes = 'calendar-day';
    if (dateObj.getTime() === today.getTime()) {
      classes += ' today';
    }
    if (dateObj.getTime() === new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime()) {
      classes += ' selected';
    }
    
    html += `<div class="${classes}" onclick="selectCalendarDate('${dateStr}')">`;
    html += `<div class="calendar-day-number">${day}</div>`;
    html += renderCalendarAppointments(dateStr);
    html += '</div>';
  }
  
  document.getElementById('calendarGrid').innerHTML = html;
}

function renderCalendarAppointments(dateStr) {
  let html = '';
  const dateAppointments = getAllAppointments().filter(a => a.date === dateStr);
  
  dateAppointments.slice(0, 3).forEach(apt => {
    const pet = pets.find(p => p.id === apt.petId);
    const statusClass = apt.status;
    html += `<div class="calendar-appointment ${statusClass}" title="${pet ? pet.petName : ''} - ${apt.startTime}-${apt.endTime}">
      ${apt.startTime} ${pet ? pet.petName : ''}
    </div>`;
  });
  
  if (dateAppointments.length > 3) {
    html += `<div class="calendar-appointment">+${dateAppointments.length - 3}个</div>`;
  }
  
  return html;
}

function getAllAppointments() {
  return pets.length > 0 ? (window.cachedAppointments || []) : [];
}

async function loadAppointments() {
  const date = document.getElementById('filterDate').value;
  const status = document.getElementById('filterStatus').value;
  const beauticianId = document.getElementById('filterBeautician').value;
  
  let url = `${API_BASE}/api/appointments?`;
  if (date) url += `date=${date}&`;
  if (status) url += `status=${status}&`;
  if (beauticianId) url += `beauticianId=${beauticianId}&`;
  
  const res = await fetch(url);
  const appointments = await res.json();
  window.cachedAppointments = appointments;
  
  renderCalendar();
  renderAppointmentsTable(appointments);
}

function renderAppointmentsTable(appointments) {
  const tbody = document.getElementById('appointmentsTable');
  
  if (appointments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无预约</td></tr>';
    return;
  }
  
  tbody.innerHTML = appointments.map(apt => {
    const pet = pets.find(p => p.id === apt.petId);
    const beautician = beauticians.find(b => b.id === apt.beauticianId);
    const service = services.find(s => s.id === apt.serviceId);
    const type = pet ? petTypes.find(t => t.id === pet.typeId) : null;
    const petType = type ? type.name : '';
    
    return `<tr>
      <td>${apt.id}</td>
      <td>${pet ? pet.petName : ''} <span class="tag tag-warning">${petType}</span></td>
      <td>${service ? service.name : ''}</td>
      <td>${beautician ? beautician.name : ''}</td>
      <td>${apt.date} ${apt.startTime}-${apt.endTime}</td>
      <td>¥${apt.totalPrice.toFixed(2)}</td>
      <td><span class="badge badge-${apt.status}">${getStatusText(apt.status)}</span></td>
      <td>
        <button class="btn btn-default" onclick="viewAppointmentDetail('${apt.id}')">详情</button>
        ${apt.status !== 'closed' && apt.status !== 'rejected' ? `
          <button class="btn btn-primary" onclick="updateStatus('${apt.id}', 'confirmed')">确认</button>
        ` : ''}
        ${apt.status === 'pending' ? `
          <button class="btn btn-danger" onclick="updateStatus('${apt.id}', 'rejected')">驳回</button>
        ` : ''}
        ${apt.status === 'confirmed' ? `
          <button class="btn btn-warning" onclick="openAddOnModal('${apt.id}')">加项</button>
          <button class="btn btn-success" onclick="openSupplyModal('${apt.id}')">耗材</button>
          <button class="btn btn-success" onclick="updateStatus('${apt.id}', 'closed')">完成</button>
        ` : ''}
      </td>
    </tr>`;
  }).join('');
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待处理',
    'confirmed': '已确认',
    'rejected': '已驳回',
    'closed': '已关闭'
  };
  return statusMap[status] || status;
}

async function viewAppointmentDetail(id) {
  const [aptRes, histRes] = await Promise.all([
    fetch(`${API_BASE}/api/appointments/${id}`),
    fetch(`${API_BASE}/api/appointments/${id}/histories`)
  ]);
  
  const apt = await aptRes.json();
  const histories = await histRes.json();
  
  const pet = pets.find(p => p.id === apt.petId);
  const beautician = beauticians.find(b => b.id === apt.beauticianId);
  const service = services.find(s => s.id === apt.serviceId);
  const type = pet ? petTypes.find(t => t.id === pet.typeId) : null;
  
  let addOnsHtml = '';
  if (apt.addOns && apt.addOns.length > 0) {
    addOnsHtml = apt.addOns.map(a => {
      const addon = addOns.find(ao => ao.id === a.addOnId);
      return `<div class="tag tag-warning">${addon ? addon.name : '加项'} +¥${a.price} (${a.duration}分钟)</div>`;
    }).join(' ');
  }
  
  let pendingAddOnHtml = '';
  if (apt.pendingAddOn) {
    const addon = addOns.find(a => a.id === apt.pendingAddOn.addOnId);
    pendingAddOnHtml = `
      <div class="alert alert-warning">
        <strong>待审核加项：</strong>${addon ? addon.name : '加项'}<br>
        价格：¥${apt.pendingAddOn.price} | 增加时长：${apt.pendingAddOn.duration}分钟 | 新结束时间：${apt.pendingAddOn.newEndTime}<br>
        原因：${apt.pendingAddOn.reason}
      </div>
    `;
  }
  
  let supplyUsageHtml = '';
  if (apt.supplyUsage && apt.supplyUsage.length > 0) {
    supplyUsageHtml = apt.supplyUsage.map(u => {
      const s = supplies.find(sp => sp.id === u.supplyId);
      return `<div>${s ? s.name : '耗材'}: ${u.quantity}${s ? s.unit : ''}</div>`;
    }).join('');
  }
  
  let supplyWarningHtml = '';
  if (apt.supplyWarning) {
    supplyWarningHtml = `
      <div class="alert alert-warning">
        <strong>耗材预警：</strong>${apt.supplyWarning.message}
      </div>
    `;
  }
  
  const historiesHtml = histories.map(h => `
    <div class="history-item">
      <div class="history-timestamp">${h.timestamp} - ${h.operator}</div>
      <div class="history-content">${formatHistoryAction(h)}</div>
    </div>
  `).join('');
  
  document.getElementById('appointmentDetailContent').innerHTML = `
    <div class="grid grid-2 mb-4">
      <div>
        <strong>预约号：</strong>${apt.id}<br>
        <strong>状态：</strong><span class="badge badge-${apt.status}">${getStatusText(apt.status)}</span>
      </div>
      <div>
        <strong>创建时间：</strong>${apt.createdAt}<br>
        <strong>更新时间：</strong>${apt.updatedAt}
      </div>
    </div>
    
    <div class="card bg-light">
      <h4 style="margin-bottom: 12px;">宠物信息</h4>
      <div class="grid grid-2">
        <div><strong>名称：</strong>${pet ? pet.petName : ''}</div>
        <div><strong>类型：</strong>${type ? type.name : ''}</div>
        <div><strong>品种：</strong>${pet ? pet.breed : ''}</div>
        <div><strong>主人：</strong>${pet ? pet.ownerName : ''}</div>
      </div>
    </div>
    
    <div class="card bg-light">
      <h4 style="margin-bottom: 12px;">服务信息</h4>
      <div class="grid grid-2">
        <div><strong>服务项目：</strong>${service ? service.name : ''}</div>
        <div><strong>美容师：</strong>${beautician ? beautician.name : ''}</div>
        <div><strong>日期：</strong>${apt.date}</div>
        <div><strong>时间：</strong>${apt.startTime} - ${apt.endTime}</div>
        <div><strong>基础价格：</strong>¥${apt.basePrice.toFixed(2)}</div>
        <div><strong>总价：</strong><span style="color: #667eea; font-weight: 700;">¥${apt.totalPrice.toFixed(2)}</span></div>
      </div>
      ${addOnsHtml ? `<div class="mt-4"><strong>已加项：</strong>${addOnsHtml}</div>` : ''}
    </div>
    
    ${pendingAddOnHtml}
    ${supplyWarningHtml}
    
    ${supplyUsageHtml ? `
      <div class="card bg-light">
        <h4 style="margin-bottom: 12px;">耗材使用</h4>
        ${supplyUsageHtml}
      </div>
    ` : ''}
    
    ${apt.notes ? `<div class="alert alert-success"><strong>备注：</strong>${apt.notes}</div>` : ''}
    
    <div class="mt-4">
      <h4 style="margin-bottom: 12px;">操作历史</h4>
      ${historiesHtml}
    </div>
  `;
  
  openModal('appointmentDetailModal');
}

function formatHistoryAction(h) {
  const actionMap = {
    'create': '创建预约',
    'update': `修改字段：${h.field}`,
    'complete': '完成预约',
    'status_change': `状态变更：${safeParse(h.oldValue)} → ${safeParse(h.newValue)}`,
    'request_addon': `申请加项：${safeParse(h.newValue)}`,
    'approve_addon': `批准加项：${safeParse(h.newValue)}`,
    'reject_addon': `驳回加项：${safeParse(h.newValue)}`,
    'consume_supply': `消耗耗材：${safeParse(h.newValue)}`,
    'supply_warning': `耗材预警：${safeParse(h.newValue)}`
  };
  return actionMap[h.action] || h.action;
}

function safeParse(val) {
  if (val === null) return '-';
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

async function updateStatus(id, status) {
  if (!confirm(`确定要将预约状态改为「${getStatusText(status)}」吗？`)) return;
  
  await fetch(`${API_BASE}/api/appointments/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  
  await loadAppointments();
  await loadSupplies();
  await loadPendingAddOns();
  await loadDailyReport();
}

function changeMonth(delta) {
  currentMonth.setMonth(currentMonth.getMonth() + delta);
  renderCalendar();
}

function goToToday() {
  currentMonth = new Date();
  selectedDate = new Date();
  renderCalendar();
  document.getElementById('filterDate').value = new Date().toISOString().split('T')[0];
  loadAppointments();
}

function selectCalendarDate(dateStr) {
  selectedDate = new Date(dateStr);
  document.getElementById('filterDate').value = dateStr;
  renderCalendar();
  loadAppointments();
}

function openNewAppointmentModal() {
  editingAppointmentId = null;
  document.getElementById('appointmentModalTitle').textContent = '新建预约';
  document.getElementById('appointmentPet').value = '';
  document.getElementById('appointmentBeautician').value = '';
  document.getElementById('appointmentService').value = '';
  document.getElementById('appointmentDate').value = selectedDate.toISOString().split('T')[0];
  document.getElementById('appointmentStartTime').value = '09:00';
  document.getElementById('appointmentEndTime').value = '';
  document.getElementById('appointmentNotes').value = '';
  document.getElementById('estimatedPrice').textContent = '0';
  hideAlert('appointmentAlert');
  openModal('appointmentModal');
}

async function updatePrice() {
  const petSelect = document.getElementById('appointmentPet');
  const serviceSelect = document.getElementById('appointmentService');
  
  const petOption = petSelect.options[petSelect.selectedIndex];
  const serviceOption = serviceSelect.options[serviceSelect.selectedIndex];
  
  if (!petOption || !serviceOption || !petOption.value || !serviceOption.value) {
    document.getElementById('estimatedPrice').textContent = '0';
    currentServiceDuration = 0;
    return;
  }
  
  const petTypeId = petOption.dataset.type;
  const serviceId = serviceOption.value;
  
  try {
    const res = await fetch(`${API_BASE}/api/price/calculate?serviceId=${serviceId}&petTypeId=${petTypeId}`);
    const data = await res.json();
    document.getElementById('estimatedPrice').textContent = data.totalPrice.toFixed(2);
    currentServiceDuration = data.totalDuration;
    updateEndTime();
  } catch (e) {
    console.error(e);
  }
}

function updateEndTime() {
  const startTime = document.getElementById('appointmentStartTime').value;
  if (!startTime || currentServiceDuration === 0) return;
  
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + currentServiceDuration;
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  document.getElementById('appointmentEndTime').value = 
    `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

async function checkBeauticianAvailability() {
  const beauticianId = document.getElementById('appointmentBeautician').value;
  const date = document.getElementById('appointmentDate').value;
  const startTime = document.getElementById('appointmentStartTime').value;
  const endTime = document.getElementById('appointmentEndTime').value;
  
  if (!beauticianId || !date || !startTime || !endTime) {
    hideAlert('appointmentAlert');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/beauticians/check-conflict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beauticianId: parseInt(beauticianId),
        date,
        startTime,
        endTime,
        excludeAppointmentId: editingAppointmentId
      })
    });
    
    const data = await res.json();
    
    if (data.conflict) {
      showAlert('appointmentAlert', 'danger', 
        `时段冲突：该美容师在 ${data.conflictingAppointment.startTime}-${data.conflictingAppointment.endTime} 已有预约`);
    } else {
      hideAlert('appointmentAlert');
    }
  } catch (e) {
    console.error(e);
  }
}

async function saveAppointment() {
  const petId = document.getElementById('appointmentPet').value;
  const beauticianId = document.getElementById('appointmentBeautician').value;
  const serviceId = document.getElementById('appointmentService').value;
  const date = document.getElementById('appointmentDate').value;
  const startTime = document.getElementById('appointmentStartTime').value;
  const endTime = document.getElementById('appointmentEndTime').value;
  const notes = document.getElementById('appointmentNotes').value;
  
  if (!petId || !beauticianId || !serviceId || !date || !startTime) {
    showAlert('appointmentAlert', 'warning', '请填写必填项');
    return;
  }
  
  const petOption = document.getElementById('appointmentPet').options[document.getElementById('appointmentPet').selectedIndex];
  const petTypeId = petOption.dataset.type;
  
  const priceRes = await fetch(`${API_BASE}/api/price/calculate?serviceId=${serviceId}&petTypeId=${petTypeId}`);
  const priceData = await priceRes.json();
  
  const appointmentData = {
    petId,
    beauticianId: parseInt(beauticianId),
    serviceId: parseInt(serviceId),
    date,
    startTime,
    endTime,
    basePrice: priceData.basePrice,
    totalPrice: priceData.totalPrice,
    notes
  };
  
  try {
    const res = await fetch(`${API_BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointmentData)
    });
    
    if (!res.ok) {
      const err = await res.json();
      showAlert('appointmentAlert', 'danger', err.error || '保存失败');
      return;
    }
    
    closeModal('appointmentModal');
    await loadAppointments();
    await loadDailyReport();
  } catch (e) {
    console.error(e);
    showAlert('appointmentAlert', 'danger', '保存失败');
  }
}

async function loadPets() {
  const res = await fetch(`${API_BASE}/api/pets`);
  pets = await res.json();
  populateSelects();
  renderPetsTable();
}

function renderPetsTable() {
  const tbody = document.getElementById('petsTable');
  
  if (pets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无宠物档案</td></tr>';
    return;
  }
  
  tbody.innerHTML = pets.map(p => {
    const type = petTypes.find(t => t.id === p.typeId);
    return `<tr>
      <td><strong>${p.petName}</strong></td>
      <td>${p.ownerName}</td>
      <td>${p.ownerPhone}</td>
      <td>${type ? type.name : ''}</td>
      <td>${p.breed || '-'}</td>
      <td>${p.age || '-'}岁</td>
      <td>${p.weight || '-'}kg</td>
      <td>
        <button class="btn btn-default" onclick="viewAppointmentsForPet('${p.id}')">预约记录</button>
      </td>
    </tr>`;
  }).join('');
}

function openNewPetModal() {
  document.getElementById('petModalTitle').textContent = '新建宠物档案';
  document.getElementById('petName').value = '';
  document.getElementById('petType').value = '';
  document.getElementById('ownerName').value = '';
  document.getElementById('ownerPhone').value = '';
  document.getElementById('petBreed').value = '';
  document.getElementById('petAge').value = '';
  document.getElementById('petGender').value = '公';
  document.getElementById('petWeight').value = '';
  document.getElementById('petNotes').value = '';
  openModal('petModal');
}

async function savePet() {
  const petData = {
    petName: document.getElementById('petName').value,
    typeId: parseInt(document.getElementById('petType').value),
    ownerName: document.getElementById('ownerName').value,
    ownerPhone: document.getElementById('ownerPhone').value,
    breed: document.getElementById('petBreed').value,
    age: parseInt(document.getElementById('petAge').value) || 0,
    gender: document.getElementById('petGender').value,
    weight: parseFloat(document.getElementById('petWeight').value) || 0,
    notes: document.getElementById('petNotes').value
  };
  
  if (!petData.petName || !petData.typeId || !petData.ownerName || !petData.ownerPhone) {
    alert('请填写必填项');
    return;
  }
  
  const res = await fetch(`${API_BASE}/api/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(petData)
  });
  
  if (res.ok) {
    closeModal('petModal');
    await loadPets();
  }
}

async function loadSupplies() {
  const res = await fetch(`${API_BASE}/api/supplies/warnings`);
  const warnings = await res.json();
  
  const suppliesRes = await fetch(`${API_BASE}/api/supplies`);
  supplies = await suppliesRes.json();
  
  renderSupplyWarnings(warnings);
  renderSuppliesTable();
}

function renderSupplyWarnings(warnings) {
  const container = document.getElementById('supplyWarnings');
  
  if (warnings.length === 0) {
    container.innerHTML = '<div class="alert alert-success">所有耗材库存充足</div>';
    return;
  }
  
  container.innerHTML = warnings.map(w => `
    <div class="alert ${w.currentStock <= 0 ? 'alert-danger' : 'alert-warning'}">
      <strong>${w.name}：</strong>${w.warning}，当前库存 ${w.currentStock}${w.unit}，最低库存 ${w.minStock}${w.unit}
    </div>
  `).join('');
}

function renderSuppliesTable() {
  const tbody = document.getElementById('suppliesTable');
  
  tbody.innerHTML = supplies.map(s => {
    const isLow = s.currentStock < s.minStock;
    const isOut = s.currentStock <= 0;
    const statusClass = isOut ? 'danger' : (isLow ? 'warning' : 'success');
    const statusText = isOut ? '库存耗尽' : (isLow ? '库存不足' : '库存充足');
    
    return `<tr>
      <td>${s.name}</td>
      <td>${s.unit}</td>
      <td style="color: ${isOut ? '#ff4d4f' : (isLow ? '#faad14' : '#52c41a')}; font-weight: 600;">${s.currentStock}</td>
      <td>${s.minStock}</td>
      <td>¥${s.pricePerUnit.toFixed(2)}</td>
      <td><span class="tag tag-${statusClass}">${statusText}</span></td>
    </tr>`;
  }).join('');
}

async function loadPendingAddOns() {
  const res = await fetch(`${API_BASE}/api/appointments/addons/pending`);
  const pending = await res.json();
  
  const container = document.getElementById('pendingAddOns');
  
  if (pending.length === 0) {
    container.innerHTML = '<div class="empty">暂无待审核的加项申请</div>';
    return;
  }
  
  container.innerHTML = pending.map(item => {
    const pet = pets.find(p => p.id === item.petId);
    const beautician = beauticians.find(b => b.id === item.beauticianId);
    const addon = addOns.find(a => a.id === item.pendingAddOn.addOnId);
    
    return `
      <div class="card warning-card">
        <div class="flex flex-between items-center mb-4">
          <div>
            <strong>${pet ? pet.petName : ''}</strong> - ${addon ? addon.name : '加项'}
            <span class="badge badge-pending">待审核</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-danger" onclick="rejectAddOn('${item.appointmentId}')">驳回</button>
            <button class="btn btn-success" onclick="approveAddOn('${item.appointmentId}')">批准</button>
          </div>
        </div>
        <div class="grid grid-2">
          <div><strong>申请美容师：</strong>${beautician ? beautician.name : ''}</div>
          <div><strong>加项价格：</strong>¥${item.pendingAddOn.price}</div>
          <div><strong>增加时长：</strong>${item.pendingAddOn.duration}分钟</div>
          <div><strong>新结束时间：</strong>${item.pendingAddOn.newEndTime}</div>
        </div>
        <div class="mt-4">
          <strong>申请理由：</strong>${item.pendingAddOn.reason}
        </div>
      </div>
    `;
  }).join('');
}

async function approveAddOn(appointmentId) {
  if (!confirm('确定批准该加项申请？价格将自动增加。')) return;
  
  await fetch(`${API_BASE}/api/appointments/${appointmentId}/addons/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  await loadPendingAddOns();
  await loadAppointments();
  await loadDailyReport();
}

async function rejectAddOn(appointmentId) {
  const reason = prompt('请输入驳回原因：');
  if (!reason) return;
  
  await fetch(`${API_BASE}/api/appointments/${appointmentId}/addons/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  
  await loadPendingAddOns();
  await loadAppointments();
}

function openAddOnModal(appointmentId) {
  currentAddonAppointmentId = appointmentId;
  document.getElementById('addonSelect').value = '';
  document.getElementById('addonReason').value = '';
  document.getElementById('addonPreviewContent').innerHTML = '请选择加项查看详情';
  openModal('addonModal');
}

function updateAddonPreview() {
  const select = document.getElementById('addonSelect');
  const option = select.options[select.selectedIndex];
  
  if (!option || !option.value) {
    document.getElementById('addonPreviewContent').innerHTML = '请选择加项查看详情';
    return;
  }
  
  document.getElementById('addonPreviewContent').innerHTML = `
    <div class="grid grid-2">
      <div><strong>加项名称：</strong>${option.text.split(' - ')[0]}</div>
      <div><strong>价格：</strong>¥${option.dataset.price}</div>
      <div><strong>增加时长：</strong>${option.dataset.duration}分钟</div>
      <div><strong>需要重新确认：</strong>是</div>
    </div>
    <div class="alert alert-warning mt-4">
      <strong>提示：</strong>加项后价格将增加 ¥${option.dataset.price}，结束时间将延长 ${option.dataset.duration} 分钟，需要管理员批准后方可生效。
    </div>
  `;
}

async function submitAddOnRequest() {
  const addOnId = parseInt(document.getElementById('addonSelect').value);
  const reason = document.getElementById('addonReason').value;
  
  if (!addOnId) {
    alert('请选择加项');
    return;
  }
  
  await fetch(`${API_BASE}/api/appointments/${currentAddonAppointmentId}/addons/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addOnId, reason })
  });
  
  closeModal('addonModal');
  await loadAppointments();
  await loadPendingAddOns();
}

function openSupplyModal(appointmentId) {
  currentSupplyAppointmentId = appointmentId;
  
  const formHtml = supplies.map(s => `
    <div class="form-group">
      <label class="form-label">
        ${s.name} (${s.unit})
        <span style="color: ${s.currentStock < s.minStock ? '#ff4d4f' : '#666'};">
          (剩余: ${s.currentStock})
        </span>
      </label>
      <input type="number" class="form-input" 
             data-supply-id="${s.id}" 
             data-stock="${s.currentStock}"
             min="0" step="0.1" 
             value="0">
    </div>
  `).join('');
  
  document.getElementById('supplyForm').innerHTML = formHtml;
  openModal('supplyModal');
}

async function submitSupplyUsage() {
  const inputs = document.querySelectorAll('#supplyForm input');
  const supplyUsage = [];
  
  inputs.forEach(input => {
    const quantity = parseFloat(input.value) || 0;
    if (quantity > 0) {
      supplyUsage.push({
        supplyId: parseInt(input.dataset.supplyId),
        quantity
      });
    }
  });
  
  if (supplyUsage.length === 0) {
    alert('请输入耗材用量');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/appointments/${currentSupplyAppointmentId}/supplies/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplyUsage })
    });
    
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || '耗材消耗失败');
      return;
    }
    
    closeModal('supplyModal');
    await loadSupplies();
    await loadAppointments();
    await loadDailyReport();
  } catch (e) {
    console.error(e);
  }
}

async function loadDailyReport() {
  const date = document.getElementById('reportDate').value || new Date().toISOString().split('T')[0];
  
  const res = await fetch(`${API_BASE}/api/reports/daily?date=${date}`);
  const report = await res.json();
  
  document.getElementById('statRevenue').textContent = report.summary.projectRevenue.toFixed(2);
  document.getElementById('statCost').textContent = report.summary.supplyCost.toFixed(2);
  document.getElementById('statNetIncome').textContent = report.summary.netIncome.toFixed(2);
  document.getElementById('statClosed').textContent = report.summary.closedAppointments;
  document.getElementById('statPending').textContent = report.summary.pendingAppointments;
  
  const appointmentsTbody = document.getElementById('reportAppointments');
  if (report.appointments.length === 0) {
    appointmentsTbody.innerHTML = '<tr><td colspan="5" class="empty">暂无已完成预约</td></tr>';
  } else {
    appointmentsTbody.innerHTML = report.appointments.map(apt => {
      const pet = pets.find(p => p.id === apt.petId);
      const service = services.find(s => s.id === apt.serviceId);
      const addOnsText = apt.addOns && apt.addOns.length > 0 
        ? apt.addOns.map(a => {
            const addon = addOns.find(ao => ao.id === a.addOnId);
            return addon ? addon.name : '';
          }).filter(Boolean).join('、')
        : '-';
      
      return `<tr>
        <td>${apt.id}</td>
        <td>${pet ? pet.petName : ''}</td>
        <td>${service ? service.name : ''}</td>
        <td>${addOnsText}</td>
        <td>¥${apt.totalPrice.toFixed(2)}</td>
      </tr>`;
    }).join('');
  }
  
  const suppliesTbody = document.getElementById('reportSupplies');
  if (report.supplyConsumption.length === 0) {
    suppliesTbody.innerHTML = '<tr><td colspan="4" class="empty">暂无耗材消耗</td></tr>';
  } else {
    suppliesTbody.innerHTML = report.supplyConsumption.map(s => `
      <tr>
        <td>${s.name}</td>
        <td>${s.quantity}</td>
        <td>${s.unit}</td>
        <td>¥${s.totalCost.toFixed(2)}</td>
      </tr>
    `).join('');
  }
  
  const exceptionsDiv = document.getElementById('reportExceptions');
  if (report.pendingExceptions.length === 0) {
    exceptionsDiv.innerHTML = '<div class="empty">暂无待处理异常</div>';
  } else {
    exceptionsDiv.innerHTML = report.pendingExceptions.map(apt => {
      const pet = pets.find(p => p.id === apt.petId);
      let exceptionType = [];
      if (apt.status === 'pending') exceptionType.push('状态待确认');
      if (apt.pendingAddOn) exceptionType.push('加项待审核');
      if (apt.supplyWarning) exceptionType.push(apt.supplyWarning.message);
      
      return `
        <div class="card warning-card" style="margin-bottom: 12px;">
          <div class="flex flex-between items-center">
            <div>
              <strong>${pet ? pet.petName : ''}</strong> (${apt.id})
              <button class="btn btn-default" onclick="viewAppointmentDetail('${apt.id}')" style="margin-left: 12px;">查看详情</button>
            </div>
            <span class="badge badge-pending">${getStatusText(apt.status)}</span>
          </div>
          <div class="mt-4">
            <strong>异常项：</strong>${exceptionType.join('；')}
          </div>
        </div>
      `;
    }).join('');
  }
}

function exportDailyReport() {
  const date = document.getElementById('reportDate').value || new Date().toISOString().split('T')[0];
  
  const revenue = document.getElementById('statRevenue').textContent;
  const cost = document.getElementById('statCost').textContent;
  const netIncome = document.getElementById('statNetIncome').textContent;
  const closed = document.getElementById('statClosed').textContent;
  const pending = document.getElementById('statPending').textContent;
  
  const reportData = {
    date,
    summary: {
      projectRevenue: revenue,
      supplyCost: cost,
      netIncome,
      closedAppointments: closed,
      pendingExceptions: pending
    },
    exportedAt: new Date().toLocaleString('zh-CN')
  };
  
  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-report-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  alert('日结报告已导出！');
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function showAlert(containerId, type, message) {
  const alert = document.getElementById(containerId);
  alert.className = `alert alert-${type}`;
  alert.style.display = 'block';
  alert.textContent = message;
}

function hideAlert(containerId) {
  const alert = document.getElementById(containerId);
  alert.style.display = 'none';
}

function viewAppointmentsForPet(petId) {
  const pet = pets.find(p => p.id === petId);
  if (pet) {
    document.querySelector('.nav-item[data-tab="appointments"]').click();
    alert(`${pet.petName} 的所有预约请在预约列表中查看`);
  }
}
