const API = '/api';

let stores = [];
let devices = [];
let consumables = [];
let faults = [];
let orders = [];

const statusMap = {
  pending: { label: '待处理', class: 'bg-warning' },
  in_progress: { label: '处理中', class: 'bg-primary' },
  completed: { label: '已完成', class: 'bg-success' },
  resolved: { label: '已解决', class: 'bg-success' },
  normal: { label: '正常', class: 'bg-success' },
  fault: { label: '故障', class: 'bg-danger' },
  maintenance: { label: '维护中', class: 'bg-warning' }
};

function getStatusBadge(status) {
  const s = statusMap[status] || { label: status, class: 'bg-secondary' };
  return `<span class="badge ${s.class} status-badge">${s.label}</span>`;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function loadAll() {
  [stores, devices, consumables, faults, orders] = await Promise.all([
    api(`${API}/stores`),
    api(`${API}/devices`),
    api(`${API}/consumables`),
    api(`${API}/faults`),
    api(`${API}/supply-orders`)
  ]);
  renderDashboard();
  renderStores();
  renderDevices();
  renderConsumables();
  renderFaults();
  renderOrders();
  populateSelects();
}

function populateSelects() {
  const storeOpts = stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('device-store').innerHTML = storeOpts;
  document.getElementById('order-store').innerHTML = storeOpts;
  const deviceOpts = devices.map(d => `<option value="${d.id}">${d.device_code} (${d.store_name})</option>`).join('');
  document.getElementById('consumable-device').innerHTML = deviceOpts;
  document.getElementById('fault-device').innerHTML = deviceOpts;
  document.getElementById('order-device').innerHTML = '<option value="">-- 不指定设备 --</option>' + deviceOpts;
}

function renderDashboard() {
  document.getElementById('stat-stores').textContent = stores.length;
  document.getElementById('stat-devices').textContent = devices.length;
  
  const lowItems = consumables.filter(c => c.current_level <= c.min_threshold);
  document.getElementById('stat-low').textContent = lowItems.length;
  
  const pendingFaults = faults.filter(f => f.status === 'pending' || f.status === 'in_progress');
  document.getElementById('stat-pending').textContent = pendingFaults.length;

  const lowList = document.getElementById('low-consumables-list');
  if (lowItems.length === 0) {
    lowList.innerHTML = '<p class="text-success">✅ 所有耗材余量充足</p>';
  } else {
    lowList.innerHTML = lowItems.map(c => `
      <div class="alert alert-danger py-2 mb-2 small">
        <strong>${c.store_name} - ${c.device_code}</strong><br>
        ${c.type}: ${c.current_level}% (阈值: ${c.min_threshold}%)
      </div>
    `).join('');
  }

  const faultList = document.getElementById('pending-faults-list');
  const activeFaults = faults.filter(f => f.status !== 'resolved');
  if (activeFaults.length === 0) {
    faultList.innerHTML = '<p class="text-success">✅ 无待处理故障</p>';
  } else {
    faultList.innerHTML = activeFaults.map(f => `
      <div class="alert alert-warning py-2 mb-2 small">
        <strong>${f.store_name} - ${f.device_code}</strong><br>
        ${f.fault_type}: ${f.description || '无详细描述'}<br>
        ${getStatusBadge(f.status)}
      </div>
    `).join('');
  }
}

function renderStores() {
  const tbody = document.getElementById('stores-table');
  tbody.innerHTML = stores.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.address}</td>
      <td>${s.phone || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick='editStore(${JSON.stringify(s).replace(/'/g, "&apos;")})'>编辑</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteStore(${s.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

function renderDevices() {
  const grid = document.getElementById('devices-grid');
  grid.innerHTML = devices.map(d => {
    const hasFault = faults.some(f => f.device_id === d.id && f.status !== 'resolved');
    const hasLow = consumables.some(c => c.device_id === d.id && c.current_level <= c.min_threshold);
    let borderClass = 'device-card';
    if (d.status === 'fault' || hasFault) borderClass += ' fault';
    else if (hasLow) borderClass += ' warning';
    
    const deviceConsumables = consumables.filter(c => c.device_id === d.id);
    const deviceFaults = faults.filter(f => f.device_id === d.id);
    
    return `
      <div class="col-md-4 mb-3">
        <div class="card ${borderClass}">
          <div class="card-header d-flex justify-content-between">
            <strong>${d.device_code}</strong>
            ${getStatusBadge(d.status)}
          </div>
          <div class="card-body small">
            <p class="mb-1"><strong>门店:</strong> ${d.store_name}</p>
            <p class="mb-1"><strong>型号:</strong> ${d.model || '-'}</p>
            <p class="mb-1"><strong>位置:</strong> ${d.location || '-'}</p>
            <hr>
            <p class="mb-1"><strong>耗材:</strong></p>
            <ul class="mb-2 pl-3">
              ${deviceConsumables.length ? deviceConsumables.map(c => `
                <li class="${c.current_level <= c.min_threshold ? 'low-level' : ''}">${c.type}: ${c.current_level}%</li>
              `).join('') : '<li class="text-muted">暂无记录</li>'}
            </ul>
            <p class="mb-1"><strong>故障:</strong></p>
            <ul class="mb-2 pl-3">
              ${deviceFaults.length ? deviceFaults.slice(0, 2).map(f => `
                <li>${getStatusBadge(f.status)} ${f.fault_type}</li>
              `).join('') : '<li class="text-muted">暂无</li>'}
            </ul>
            <div class="btn-group btn-group-sm w-100">
              <button class="btn btn-primary" onclick='editDevice(${JSON.stringify(d).replace(/'/g, "&apos;")})'>编辑</button>
              <button class="btn btn-warning" onclick="reportFaultForDevice(${d.id})">报障</button>
              <button class="btn btn-success" onclick="createOrderForDevice(${d.id}, ${d.store_id})">补给</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderConsumables() {
  const tbody = document.getElementById('consumables-table');
  tbody.innerHTML = consumables.map(c => `
    <tr>
      <td>${c.store_name || '-'}</td>
      <td>${c.device_code || '-'}</td>
      <td>${c.type}</td>
      <td class="${c.is_low ? 'low-level' : ''}">${c.current_level}%</td>
      <td>${c.min_threshold}%</td>
      <td>${c.is_low ? '<span class="badge bg-danger">预警</span>' : '<span class="badge bg-success">正常</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick='editConsumable(${JSON.stringify(c).replace(/'/g, "&apos;")})'>编辑</button>
      </td>
    </tr>
  `).join('');
}

function renderFaults() {
  const tbody = document.getElementById('faults-table');
  tbody.innerHTML = faults.map(f => `
    <tr>
      <td>${f.store_name || '-'}</td>
      <td>${f.device_code || '-'}</td>
      <td>${f.fault_type}</td>
      <td>${f.description || '-'}</td>
      <td>${getStatusBadge(f.status)}</td>
      <td>${f.reported_at}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick='editFault(${JSON.stringify(f).replace(/'/g, "&apos;")})'>处理</button>
      </td>
    </tr>
  `).join('');
}

function renderOrders() {
  const tbody = document.getElementById('orders-table');
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>${o.store_name || '-'}</td>
      <td>${o.device_code || '-'}</td>
      <td>${o.type}</td>
      <td>${o.item}</td>
      <td>${o.quantity}</td>
      <td>${getStatusBadge(o.status)}</td>
      <td>${o.notes || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick='editOrder(${JSON.stringify(o).replace(/'/g, "&apos;")})'>处理</button>
      </td>
    </tr>
  `).join('');
}

// Modal helpers
function resetModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type !== 'hidden') el.value = '';
  });
  modal.querySelectorAll('input[type="hidden"]').forEach(el => el.value = '');
}

function showStoreModal() {
  resetModal('storeModal');
  new bootstrap.Modal(document.getElementById('storeModal')).show();
}

function editStore(s) {
  resetModal('storeModal');
  document.getElementById('store-id').value = s.id;
  document.getElementById('store-name').value = s.name;
  document.getElementById('store-address').value = s.address;
  document.getElementById('store-phone').value = s.phone || '';
  new bootstrap.Modal(document.getElementById('storeModal')).show();
}

async function saveStore() {
  const id = document.getElementById('store-id').value;
  const data = {
    name: document.getElementById('store-name').value,
    address: document.getElementById('store-address').value,
    phone: document.getElementById('store-phone').value || null
  };
  try {
    if (id) await api(`${API}/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api(`${API}/stores`, { method: 'POST', body: JSON.stringify(data) });
    bootstrap.Modal.getInstance(document.getElementById('storeModal')).hide();
    await loadAll();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

async function deleteStore(id) {
  if (!confirm('确定删除此门店？')) return;
  await api(`${API}/stores/${id}`, { method: 'DELETE' });
  await loadAll();
}

function showDeviceModal() {
  resetModal('deviceModal');
  populateSelects();
  new bootstrap.Modal(document.getElementById('deviceModal')).show();
}

function editDevice(d) {
  resetModal('deviceModal');
  populateSelects();
  document.getElementById('device-id').value = d.id;
  document.getElementById('device-store').value = d.store_id;
  document.getElementById('device-code').value = d.device_code;
  document.getElementById('device-model').value = d.model || '';
  document.getElementById('device-location').value = d.location || '';
  document.getElementById('device-status').value = d.status;
  new bootstrap.Modal(document.getElementById('deviceModal')).show();
}

async function saveDevice() {
  const id = document.getElementById('device-id').value;
  const data = {
    store_id: parseInt(document.getElementById('device-store').value),
    device_code: document.getElementById('device-code').value,
    model: document.getElementById('device-model').value || null,
    location: document.getElementById('device-location').value || null,
    status: document.getElementById('device-status').value
  };
  try {
    if (id) await api(`${API}/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api(`${API}/devices`, { method: 'POST', body: JSON.stringify(data) });
    bootstrap.Modal.getInstance(document.getElementById('deviceModal')).hide();
    await loadAll();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

function showConsumableModal() {
  resetModal('consumableModal');
  populateSelects();
  new bootstrap.Modal(document.getElementById('consumableModal')).show();
}

function editConsumable(c) {
  resetModal('consumableModal');
  populateSelects();
  document.getElementById('consumable-id').value = c.id;
  document.getElementById('consumable-device').value = c.device_id;
  document.getElementById('consumable-type').value = c.type;
  document.getElementById('consumable-level').value = c.current_level;
  document.getElementById('consumable-threshold').value = c.min_threshold;
  new bootstrap.Modal(document.getElementById('consumableModal')).show();
}

async function saveConsumable() {
  const id = document.getElementById('consumable-id').value;
  const data = {
    device_id: parseInt(document.getElementById('consumable-device').value),
    type: document.getElementById('consumable-type').value,
    current_level: parseFloat(document.getElementById('consumable-level').value),
    min_threshold: parseFloat(document.getElementById('consumable-threshold').value)
  };
  try {
    if (id) await api(`${API}/consumables/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api(`${API}/consumables`, { method: 'POST', body: JSON.stringify(data) });
    bootstrap.Modal.getInstance(document.getElementById('consumableModal')).hide();
    await loadAll();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

function showFaultModal() {
  resetModal('faultModal');
  populateSelects();
  new bootstrap.Modal(document.getElementById('faultModal')).show();
}

function reportFaultForDevice(deviceId) {
  resetModal('faultModal');
  populateSelects();
  document.getElementById('fault-device').value = deviceId;
  new bootstrap.Modal(document.getElementById('faultModal')).show();
}

function editFault(f) {
  resetModal('faultModal');
  populateSelects();
  document.getElementById('fault-id').value = f.id;
  document.getElementById('fault-device').value = f.device_id;
  document.getElementById('fault-type').value = f.fault_type;
  document.getElementById('fault-desc').value = f.description || '';
  document.getElementById('fault-status').value = f.status;
  new bootstrap.Modal(document.getElementById('faultModal')).show();
}

async function saveFault() {
  const id = document.getElementById('fault-id').value;
  const data = {
    device_id: parseInt(document.getElementById('fault-device').value),
    fault_type: document.getElementById('fault-type').value,
    description: document.getElementById('fault-desc').value || null,
    status: document.getElementById('fault-status').value
  };
  try {
    if (id) await api(`${API}/faults/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api(`${API}/faults`, { method: 'POST', body: JSON.stringify(data) });
    bootstrap.Modal.getInstance(document.getElementById('faultModal')).hide();
    await loadAll();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

function showOrderModal() {
  resetModal('orderModal');
  populateSelects();
  new bootstrap.Modal(document.getElementById('orderModal')).show();
}

function createOrderForDevice(deviceId, storeId) {
  resetModal('orderModal');
  populateSelects();
  document.getElementById('order-store').value = storeId;
  document.getElementById('order-device').value = deviceId;
  new bootstrap.Modal(document.getElementById('orderModal')).show();
}

function editOrder(o) {
  resetModal('orderModal');
  populateSelects();
  document.getElementById('order-id').value = o.id;
  document.getElementById('order-store').value = o.store_id;
  document.getElementById('order-device').value = o.device_id || '';
  document.getElementById('order-type').value = o.type;
  document.getElementById('order-item').value = o.item;
  document.getElementById('order-qty').value = o.quantity;
  document.getElementById('order-status').value = o.status;
  document.getElementById('order-notes').value = o.notes || '';
  new bootstrap.Modal(document.getElementById('orderModal')).show();
}

async function saveOrder() {
  const id = document.getElementById('order-id').value;
  const deviceId = document.getElementById('order-device').value;
  const data = {
    store_id: parseInt(document.getElementById('order-store').value),
    device_id: deviceId ? parseInt(deviceId) : null,
    type: document.getElementById('order-type').value,
    item: document.getElementById('order-item').value,
    quantity: parseInt(document.getElementById('order-qty').value),
    status: document.getElementById('order-status').value,
    notes: document.getElementById('order-notes').value || null
  };
  try {
    if (id) await api(`${API}/supply-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api(`${API}/supply-orders`, { method: 'POST', body: JSON.stringify(data) });
    bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
    await loadAll();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

async function autoGenerateOrders() {
  if (!confirm('将为所有余量低于阈值且尚未生成订单的耗材自动创建补给单，继续？')) return;
  try {
    const result = await api(`${API}/supply-orders/generate`, { method: 'POST' });
    if (result.count === 0) {
      alert('没有需要生成的补给单（所有预警耗材都已存在待处理订单）');
    } else {
      alert(`已成功生成 ${result.count} 个补给单`);
    }
    await loadAll();
  } catch (e) {
    alert('生成失败: ' + e.message);
  }
}

function exportReport() {
  window.location.href = `${API}/export`;
}

function showAnomalyPanel() {
  document.getElementById('anomaly-panel').classList.toggle('d-none');
}

async function testDuplicate() {
  try {
    await api(`${API}/test/duplicate`, { method: 'POST' });
  } catch (e) {
    document.getElementById('anomaly-result').innerHTML = `
      <div class="alert alert-danger">
        <strong>✅ 重复数据检测正常</strong><br>
        错误类型: ${e.message.includes('重复') ? '重复数据错误' : '未知'}<br>
        系统返回: ${e.message}
      </div>
    `;
  }
}

async function testMissingField() {
  try {
    await api(`${API}/test/missing-field`, { method: 'POST' });
  } catch (e) {
    document.getElementById('anomaly-result').innerHTML = `
      <div class="alert alert-danger">
        <strong>✅ 必填字段校验正常</strong><br>
        错误类型: ${e.message.includes('缺少') ? '缺少必填字段' : '未知'}<br>
        系统返回: ${e.message}
      </div>
    `;
  }
}

function testManualFix() {
  document.getElementById('anomaly-result').innerHTML = `
    <div class="alert alert-info">
      <strong>📝 人工改错演示流程：</strong><br>
      1. 假设某设备耗材余量登记错误（如把50%写成了5%）<br>
      2. 操作员在"耗材"页面找到该记录<br>
      3. 点击"编辑"按钮修改余量<br>
      4. 保存后系统自动更新时间戳<br>
      <br>
      <em>故障登记作为证据：所有故障记录都有上报时间，可与补给单时间对比验证。</em>
    </div>
  `;
  const cons = consumables.find(c => c.current_level > 20);
  if (cons) {
    setTimeout(() => {
      document.getElementById('anomaly-result').innerHTML += `
        <div class="mt-2">
          <button class="btn btn-sm btn-outline-info" onclick="demoEditConsumable(${cons.id})">
            演示：将 ${cons.type}(${cons.current_level}%) 改为 5%（模拟错误输入）
          </button>
        </div>
      `;
    }, 100);
  }
}

async function demoEditConsumable(id) {
  const cons = consumables.find(c => c.id === id);
  if (!cons) return;
  const newLevel = 5;
  if (!confirm(`模拟错误操作：将"${cons.device_code}"的"${cons.type}"从 ${cons.current_level}% 改为 ${newLevel}%？`)) return;
  try {
    await api(`${API}/consumables/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify({ ...cons, current_level: newLevel })
    });
    document.getElementById('anomaly-result').innerHTML = `
      <div class="alert alert-warning">
        <strong>⚠️ 错误已模拟</strong><br>
        已将耗材余量从 ${cons.current_level}% 改为 5%，这将触发耗材预警！<br>
        现在可以在"总览"或"耗材"页面看到这个错误的预警。<br>
        <br>
        <em>请手动去"耗材"页面找到这条记录，把5%改回正确的值（如${cons.current_level}%），这就是人工改错流程。</em>
      </div>
    `;
    await loadAll();
  } catch (e) {
    alert('操作失败: ' + e.message);
  }
}

loadAll();
