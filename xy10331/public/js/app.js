const API_BASE = '/api';
let currentEquipment = [];
let currentOrders = [];
let currentReturnOrder = null;
let additionalFees = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadEquipment();
  loadOrders();
  initEventListeners();
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(tabId)?.classList.add('active');
    });
  });
}

function initEventListeners() {
  document.getElementById('addEquipmentBtn').addEventListener('click', openAddEquipmentModal);
  
  document.getElementById('equipmentSelect').addEventListener('change', updateOrderPreview);
  document.getElementById('rentalDays').addEventListener('input', updateOrderPreview);
  document.getElementById('actualDeposit').addEventListener('input', updateOrderPreview);
  document.getElementById('rentalStart').addEventListener('change', updateFromDates);
  document.getElementById('rentalEnd').addEventListener('change', updateFromDates);
  
  document.getElementById('orderForm').addEventListener('submit', createOrder);
  
  document.getElementById('searchOrder').addEventListener('input', filterOrders);
  document.getElementById('filterStatus').addEventListener('change', filterOrders);
  
  document.getElementById('exportBtn').addEventListener('click', exportStatement);
  
  const modal = document.getElementById('modal');
  document.querySelector('.close').addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

async function loadEquipment() {
  try {
    const response = await fetch(`${API_BASE}/equipment`);
    const result = await response.json();
    if (result.success) {
      currentEquipment = result.data;
      renderEquipmentList();
      populateEquipmentSelect();
    }
  } catch (error) {
    showToast('加载装备套装失败', 'error');
  }
}

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/orders`);
    const result = await response.json();
    if (result.success) {
      currentOrders = result.data;
      renderOrdersList();
      renderHistoryOrders();
    }
  } catch (error) {
    showToast('加载订单列表失败', 'error');
  }
}

function renderEquipmentList() {
  const container = document.getElementById('equipmentList');
  
  if (currentEquipment.length === 0) {
    container.innerHTML = '<p class="empty">暂无装备套装，请先添加</p>';
    return;
  }
  
  container.innerHTML = currentEquipment.map(equip => `
    <div class="equipment-card">
      <h3>${equip.name}</h3>
      ${equip.description ? `<p>${equip.description}</p>` : ''}
      <div class="equipment-items">
        <h4>装备明细：</h4>
        <ul>
          ${equip.items.map(item => `
            <li>
              ${item.name} ×${item.quantity} - 押金${item.deposit}元，租赁费${item.rentalFee}元/天
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="equipment-summary">
        <div class="summary-item">
          <span class="label">总押金</span>
          <span class="value">¥${equip.totalDeposit}</span>
        </div>
        <div class="summary-item">
          <span class="label">日租赁费</span>
          <span class="value">¥${equip.totalRentalFee}</span>
        </div>
        <div class="summary-item">
          <span class="label">库存</span>
          <span class="value stock-badge ${getStockClass(equip.stock)}">${equip.stock} 套</span>
        </div>
      </div>
      <div class="equipment-actions">
        <button class="btn btn-secondary" onclick="editEquipment('${equip.id}')">编辑</button>
        <button class="btn btn-danger" onclick="deleteEquipment('${equip.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function getStockClass(stock) {
  if (stock === 0) return 'out-of-stock';
  if (stock <= 3) return 'low-stock';
  return 'in-stock';
}

function populateEquipmentSelect() {
  const select = document.getElementById('equipmentSelect');
  const currentValue = select.value;
  
  select.innerHTML = '<option value="">请选择装备套装</option>' + 
    currentEquipment.map(equip => `
      <option value="${equip.id}" data-deposit="${equip.totalDeposit}" data-rental="${equip.totalRentalFee}" ${equip.stock === 0 ? 'disabled' : ''}>
        ${equip.name} (库存: ${equip.stock})
      </option>
    `).join('');
  
  if (currentValue) {
    select.value = currentValue;
  }
}

function openAddEquipmentModal() {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <h2>添加装备套装</h2>
    <div class="form-group">
      <label>套装名称 *</label>
      <input type="text" id="equipName" placeholder="如：基础露营套装">
    </div>
    <div class="form-group">
      <label>描述</label>
      <textarea id="equipDescription" rows="2" placeholder="可选"></textarea>
    </div>
    <div class="form-group">
      <label>库存数量</label>
      <input type="number" id="equipStock" min="0" value="1">
    </div>
    <h3>装备明细</h3>
    <div id="equipItems">
      <div class="equipment-item-row">
        <input type="text" class="item-name" placeholder="装备名称">
        <input type="number" class="item-qty" placeholder="数量" min="1" value="1">
        <input type="number" class="item-deposit" placeholder="押金" min="0" step="0.01">
        <input type="number" class="item-rental" placeholder="租赁费/天" min="0" step="0.01">
        <button class="btn btn-danger" onclick="removeEquipItem(this)">×</button>
      </div>
    </div>
    <button class="btn btn-secondary" onclick="addEquipItem()" style="margin-bottom: 20px;">+ 添加装备</button>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="document.getElementById('modal').classList.remove('active')">取消</button>
      <button class="btn btn-primary" onclick="saveEquipment()">保存</button>
    </div>
  `;
  
  modal.classList.add('active');
}

function addEquipItem() {
  const container = document.getElementById('equipItems');
  const div = document.createElement('div');
  div.className = 'equipment-item-row';
  div.innerHTML = `
    <input type="text" class="item-name" placeholder="装备名称">
    <input type="number" class="item-qty" placeholder="数量" min="1" value="1">
    <input type="number" class="item-deposit" placeholder="押金" min="0" step="0.01">
    <input type="number" class="item-rental" placeholder="租赁费/天" min="0" step="0.01">
    <button class="btn btn-danger" onclick="removeEquipItem(this)">×</button>
  `;
  container.appendChild(div);
}

function removeEquipItem(btn) {
  const rows = document.querySelectorAll('.equipment-item-row');
  if (rows.length > 1) {
    btn.parentElement.remove();
  }
}

async function saveEquipment() {
  const name = document.getElementById('equipName').value.trim();
  const description = document.getElementById('equipDescription').value.trim();
  const stock = parseInt(document.getElementById('equipStock').value) || 0;
  
  if (!name) {
    showToast('请输入套装名称', 'error');
    return;
  }
  
  const items = [];
  document.querySelectorAll('.equipment-item-row').forEach(row => {
    const itemName = row.querySelector('.item-name').value.trim();
    const qty = parseInt(row.querySelector('.item-qty').value) || 1;
    const deposit = parseFloat(row.querySelector('.item-deposit').value) || 0;
    const rental = parseFloat(row.querySelector('.item-rental').value) || 0;
    
    if (itemName) {
      items.push({ name: itemName, quantity: qty, deposit, rentalFee: rental });
    }
  });
  
  if (items.length === 0) {
    showToast('请至少添加一件装备', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, items, stock })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast('装备套装创建成功', 'success');
      document.getElementById('modal').classList.remove('active');
      loadEquipment();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('保存失败', 'error');
  }
}

async function deleteEquipment(id) {
  if (!confirm('确定要删除这个装备套装吗？')) return;
  
  try {
    const response = await fetch(`${API_BASE}/equipment/${id}`, { method: 'DELETE' });
    const result = await response.json();
    
    if (result.success) {
      showToast('删除成功', 'success');
      loadEquipment();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('删除失败', 'error');
  }
}

async function editEquipment(id) {
  const equip = currentEquipment.find(e => e.id === id);
  if (!equip) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <h2>编辑装备套装</h2>
    <div class="form-group">
      <label>套装名称 *</label>
      <input type="text" id="equipName" value="${equip.name}">
    </div>
    <div class="form-group">
      <label>描述</label>
      <textarea id="equipDescription" rows="2">${equip.description || ''}</textarea>
    </div>
    <div class="form-group">
      <label>库存数量</label>
      <input type="number" id="equipStock" min="0" value="${equip.stock}">
    </div>
    <h3>装备明细</h3>
    <div id="equipItems">
      ${equip.items.map(item => `
        <div class="equipment-item-row">
          <input type="text" class="item-name" value="${item.name}" placeholder="装备名称">
          <input type="number" class="item-qty" value="${item.quantity}" placeholder="数量" min="1">
          <input type="number" class="item-deposit" value="${item.deposit}" placeholder="押金" min="0" step="0.01">
          <input type="number" class="item-rental" value="${item.rentalFee}" placeholder="租赁费/天" min="0" step="0.01">
          <button class="btn btn-danger" onclick="removeEquipItem(this)">×</button>
        </div>
      `).join('')}
    </div>
    <button class="btn btn-secondary" onclick="addEquipItem()" style="margin-bottom: 20px;">+ 添加装备</button>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="document.getElementById('modal').classList.remove('active')">取消</button>
      <button class="btn btn-primary" onclick="updateEquipment('${id}')">更新</button>
    </div>
  `;
  
  modal.classList.add('active');
}

async function updateEquipment(id) {
  const name = document.getElementById('equipName').value.trim();
  const description = document.getElementById('equipDescription').value.trim();
  const stock = parseInt(document.getElementById('equipStock').value) || 0;
  
  if (!name) {
    showToast('请输入套装名称', 'error');
    return;
  }
  
  const items = [];
  document.querySelectorAll('.equipment-item-row').forEach(row => {
    const itemName = row.querySelector('.item-name').value.trim();
    const qty = parseInt(row.querySelector('.item-qty').value) || 1;
    const deposit = parseFloat(row.querySelector('.item-deposit').value) || 0;
    const rental = parseFloat(row.querySelector('.item-rental').value) || 0;
    
    if (itemName) {
      items.push({ name: itemName, quantity: qty, deposit, rentalFee: rental });
    }
  });
  
  try {
    const response = await fetch(`${API_BASE}/equipment/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, items, stock })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast('装备套装更新成功', 'success');
      document.getElementById('modal').classList.remove('active');
      loadEquipment();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('更新失败', 'error');
  }
}

function updateOrderPreview() {
  const select = document.getElementById('equipmentSelect');
  const option = select.options[select.selectedIndex];
  
  if (!option || !option.value) {
    document.getElementById('equipmentPreview').innerHTML = '';
    clearPreview();
    return;
  }
  
  const equip = currentEquipment.find(e => e.id === option.value);
  if (!equip) return;
  
  document.getElementById('equipmentPreview').innerHTML = `
    <h3>${equip.name}</h3>
    <div class="equipment-items">
      <ul>
        ${equip.items.map(item => `
          <li>${item.name} ×${item.quantity} - 押金${item.deposit}元</li>
        `).join('')}
      </ul>
    </div>
  `;
  
  const days = parseInt(document.getElementById('rentalDays').value) || 1;
  const rentalFee = equip.totalRentalFee * days;
  const requiredDeposit = equip.totalDeposit;
  const actualDeposit = parseFloat(document.getElementById('actualDeposit').value) || 0;
  
  document.getElementById('requiredDeposit').textContent = requiredDeposit;
  document.getElementById('requiredDepositPreview').textContent = requiredDeposit;
  document.getElementById('rentalFeePreviewAmount').textContent = rentalFee;
  document.getElementById('totalPreview').textContent = rentalFee + requiredDeposit;
  
  const statusEl = document.getElementById('depositStatus');
  if (actualDeposit >= requiredDeposit) {
    statusEl.textContent = '足额';
    statusEl.className = 'status-tag 足额';
  } else {
    statusEl.textContent = `不足 (还差 ¥${requiredDeposit - actualDeposit})`;
    statusEl.className = 'status-tag 不足';
  }
}

function updateFromDates() {
  const start = document.getElementById('rentalStart').value;
  const end = document.getElementById('rentalEnd').value;
  
  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 0) {
      document.getElementById('rentalDays').value = days;
      updateOrderPreview();
    }
  }
}

function clearPreview() {
  document.getElementById('requiredDeposit').textContent = '0';
  document.getElementById('requiredDepositPreview').textContent = '0';
  document.getElementById('rentalFeePreviewAmount').textContent = '0';
  document.getElementById('totalPreview').textContent = '0';
  
  const statusEl = document.getElementById('depositStatus');
  statusEl.textContent = '未计算';
  statusEl.className = 'status-tag 未计算';
}

async function createOrder(e) {
  e.preventDefault();
  
  const customerName = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const equipmentId = document.getElementById('equipmentSelect').value;
  const rentalDays = parseInt(document.getElementById('rentalDays').value) || 1;
  const actualDeposit = parseFloat(document.getElementById('actualDeposit').value) || 0;
  const startDate = document.getElementById('rentalStart').value;
  const endDate = document.getElementById('rentalEnd').value;
  
  if (!customerName || !phone || !equipmentId) {
    showToast('请填写完整信息', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        phone,
        equipmentId,
        rentalDays,
        actualDeposit,
        startDate,
        endDate
      })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('orderForm').reset();
      clearPreview();
      loadOrders();
      loadEquipment();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('创建订单失败', 'error');
  }
}

function renderOrdersList() {
  const container = document.getElementById('ordersList');
  
  let orders = [...currentOrders];
  const searchText = document.getElementById('searchOrder')?.value?.toLowerCase() || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';
  
  if (searchText) {
    orders = orders.filter(o => 
      o.orderNumber?.toLowerCase().includes(searchText) ||
      o.customerName?.toLowerCase().includes(searchText)
    );
  }
  
  if (statusFilter) {
    orders = orders.filter(o => o.status === statusFilter);
  }
  
  if (orders.length === 0) {
    container.innerHTML = '<p class="empty">暂无订单</p>';
    return;
  }
  
  container.innerHTML = orders.map(order => `
    <div class="order-card">
      <h3>
        <span class="order-number">${order.orderNumber}</span>
        <span class="status-tag" style="margin-left: 10px;">${order.status}</span>
      </h3>
      <div class="order-summary">
        <div class="summary-item">
          <span class="label">客户</span>
          <span class="value">${order.customerName}</span>
        </div>
        <div class="summary-item">
          <span class="label">装备</span>
          <span class="value">${order.equipmentName}</span>
        </div>
        <div class="summary-item">
          <span class="label">租赁费</span>
          <span class="value">¥${order.totalRentalFee}</span>
        </div>
        <div class="summary-item">
          <span class="label">押金</span>
          <span class="value">¥${order.actualDeposit} <span class="status-tag ${order.depositStatus}">${order.depositStatus}</span></span>
        </div>
        <div class="summary-item">
          <span class="label">租赁期</span>
          <span class="value">${order.rentalDays}天</span>
        </div>
      </div>
      <div class="order-actions">
        <button class="btn btn-secondary" onclick="viewOrderDetail('${order.id}')">详情</button>
        ${(order.status === '已借出' || order.status === '已逾期' || order.status === '部分归还') ? 
          `<button class="btn btn-success" onclick="openReturnModal('${order.id}')">归还验收</button>` : ''}
        ${(order.status === '待支付押金') ? 
          `<button class="btn btn-warning" onclick="openDepositModal('${order.id}')">补交押金</button>` : ''}
        ${(order.status === '待支付押金' || order.status === '已完成') ? 
          `<button class="btn btn-danger" onclick="deleteOrder('${order.id}')">删除</button>` : ''}
      </div>
    </div>
  `).join('');
}

function filterOrders() {
  renderOrdersList();
}

async function viewOrderDetail(id) {
  const order = currentOrders.find(o => o.id === id);
  if (!order) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <h2>订单详情</h2>
    <div class="order-info-section">
      <h3>基本信息</h3>
      <div class="order-info-grid">
        <div class="order-info-item">
          <span class="label">订单号</span>
          <span class="value">${order.orderNumber}</span>
        </div>
        <div class="order-info-item">
          <span class="label">订单状态</span>
          <span class="value status-tag">${order.status}</span>
        </div>
        <div class="order-info-item">
          <span class="label">客户姓名</span>
          <span class="value">${order.customerName}</span>
        </div>
        <div class="order-info-item">
          <span class="label">联系电话</span>
          <span class="value">${order.phone}</span>
        </div>
        <div class="order-info-item">
          <span class="label">装备套装</span>
          <span class="value">${order.equipmentName}</span>
        </div>
        <div class="order-info-item">
          <span class="label">租赁天数</span>
          <span class="value">${order.rentalDays}天</span>
        </div>
        <div class="order-info-item">
          <span class="label">开始日期</span>
          <span class="value">${order.rentalStart}</span>
        </div>
        <div class="order-info-item">
          <span class="label">结束日期</span>
          <span class="value">${order.rentalEnd}</span>
        </div>
      </div>
    </div>
    
    <div class="order-info-section">
      <h3>费用明细</h3>
      <div class="order-info-grid">
        <div class="order-info-item">
          <span class="label">租赁费</span>
          <span class="value">¥${order.totalRentalFee}</span>
        </div>
        <div class="order-info-item">
          <span class="label">应交押金</span>
          <span class="value">¥${order.requiredDeposit}</span>
        </div>
        <div class="order-info-item">
          <span class="label">实交押金</span>
          <span class="value">¥${order.actualDeposit}</span>
        </div>
        <div class="order-info-item">
          <span class="label">押金状态</span>
          <span class="value status-tag ${order.depositStatus}">${order.depositStatus}</span>
        </div>
        <div class="order-info-item">
          <span class="label">总扣费</span>
          <span class="value">¥${order.totalFees}</span>
        </div>
        <div class="order-info-item">
          <span class="label">退还押金</span>
          <span class="value refund-amount ${order.refundAmount < 0 ? 'negative' : ''}">¥${order.refundAmount}</span>
        </div>
      </div>
    </div>
    
    <div class="order-info-section">
      <h3>装备明细</h3>
      <div class="equipment-items">
        <ul>
          ${order.items.map(item => `
            <li>${item.name} ×${item.quantity} - ${item.status}${item.returnedQuantity > 0 ? ` (已还${item.returnedQuantity})` : ''}</li>
          `).join('')}
        </ul>
      </div>
    </div>
    
    ${order.fees && order.fees.length > 0 ? `
    <div class="order-info-section">
      <h3>扣费历史</h3>
      <div class="fees-history">
        ${order.fees.map(fee => `
          <div class="fee-history-item">
            <div class="fee-info">
              <div class="fee-type">${fee.type}</div>
              <div class="fee-reason">${fee.reason}</div>
              <div class="fee-time">${new Date(fee.createdAt).toLocaleString()}</div>
            </div>
            <div class="fee-amount ${fee.amount < 0 ? 'positive' : ''}">
              ${fee.amount > 0 ? '+' : ''}¥${fee.amount}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="document.getElementById('modal').classList.remove('active')">关闭</button>
    </div>
  `;
  
  modal.classList.add('active');
}

async function openReturnModal(orderId) {
  const response = await fetch(`${API_BASE}/orders/${orderId}`);
  const result = await response.json();
  
  if (!result.success) {
    showToast(result.message, 'error');
    return;
  }
  
  currentReturnOrder = result.data;
  additionalFees = [];
  
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="return-order"]').classList.add('active');
  document.getElementById('return-order').classList.add('active');
  
  renderReturnForm();
}

function renderReturnForm() {
  const container = document.getElementById('returnOrderDetail');
  const order = currentReturnOrder;
  
  if (!order) return;
  
  container.innerHTML = `
    <div class="return-order-detail">
      <div class="order-info-section">
        <h3>订单信息</h3>
        <div class="order-info-grid">
          <div class="order-info-item">
            <span class="label">订单号</span>
            <span class="value order-number">${order.orderNumber}</span>
          </div>
          <div class="order-info-item">
            <span class="label">客户</span>
            <span class="value">${order.customerName}</span>
          </div>
          <div class="order-info-item">
            <span class="label">装备</span>
            <span class="value">${order.equipmentName}</span>
          </div>
          <div class="order-info-item">
            <span class="label">押金</span>
            <span class="value">¥${order.actualDeposit} ${order.depositStatus === '不足' ? '<span class="status-tag 不足">不足</span>' : ''}</span>
          </div>
        </div>
      </div>
      
      <div class="return-items-section">
        <h3>装备验收</h3>
        ${order.items.map((item, index) => `
          <div class="return-item">
            <div class="return-item-header">
              <h4>${item.name} ×${item.quantity}</h4>
              <span class="status-tag">${item.status}</span>
            </div>
            <div class="return-item-options">
              <div class="option-group">
                <label>
                  <input type="checkbox" id="returned-${index}" ${item.returnedQuantity >= item.quantity ? 'checked' : ''} onchange="toggleItemReturn(${index})">
                  已归还
                </label>
                <input type="number" id="returnedQty-${index}" min="0" max="${item.quantity}" value="${item.returnedQuantity}" placeholder="归还数量" style="display: ${item.returnedQuantity > 0 ? 'block' : 'none'}">
              </div>
              <div class="option-group">
                <label>
                  <input type="checkbox" id="cleaning-${index}" onchange="toggleCleaning(${index})">
                  需要清洗
                </label>
                <input type="number" id="cleaningFee-${index}" min="0" value="20" placeholder="清洗费" style="display: none">
              </div>
              <div class="option-group">
                <label>
                  <input type="checkbox" id="damaged-${index}" onchange="toggleDamaged(${index})">
                  已损坏
                </label>
                <input type="number" id="damageFee-${index}" min="0" value="${Math.round(item.deposit * 0.3)}" placeholder="损坏赔偿" style="display: none">
                <input type="text" id="damageDesc-${index}" placeholder="损坏描述" style="display: none; width: 150px;">
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="additional-fees-section">
        <h3>其他费用 <button class="btn btn-secondary btn-sm" onclick="addAdditionalFee()">+ 添加</button></h3>
        <div id="additionalFeesList"></div>
      </div>
      
      <div class="fee-preview-section" id="feePreview">
        <h3>扣费预览</h3>
        <div class="fee-breakdown">
          <div class="fee-breakdown-item">
            <span>租赁费</span>
            <span>¥${order.totalRentalFee}</span>
          </div>
        </div>
        <div class="fee-breakdown-total">
          <span>应退还押金</span>
          <span class="refund-amount">¥${order.actualDeposit - order.totalRentalFee}</span>
        </div>
      </div>
      
      <div class="return-actions">
        <button class="btn btn-secondary" onclick="backToOrders()">返回</button>
        <button class="btn btn-primary" onclick="submitReturn()">确认归还</button>
      </div>
    </div>
  `;
  
  updateFeePreview();
}

function toggleItemReturn(index) {
  const checkbox = document.getElementById(`returned-${index}`);
  const qtyInput = document.getElementById(`returnedQty-${index}`);
  const order = currentReturnOrder;
  
  if (checkbox.checked) {
    qtyInput.style.display = 'block';
    if (!qtyInput.value) {
      qtyInput.value = order.items[index].quantity;
    }
  } else {
    qtyInput.style.display = 'none';
    qtyInput.value = 0;
  }
  
  updateFeePreview();
}

function toggleCleaning(index) {
  const checkbox = document.getElementById(`cleaning-${index}`);
  const feeInput = document.getElementById(`cleaningFee-${index}`);
  
  feeInput.style.display = checkbox.checked ? 'block' : 'none';
  updateFeePreview();
}

function toggleDamaged(index) {
  const checkbox = document.getElementById(`damaged-${index}`);
  const feeInput = document.getElementById(`damageFee-${index}`);
  const descInput = document.getElementById(`damageDesc-${index}`);
  
  feeInput.style.display = checkbox.checked ? 'block' : 'none';
  descInput.style.display = checkbox.checked ? 'block' : 'none';
  updateFeePreview();
}

function addAdditionalFee() {
  const container = document.getElementById('additionalFeesList');
  const index = additionalFees.length;
  additionalFees.push({ type: '其他费用', amount: 0, reason: '' });
  
  const div = document.createElement('div');
  div.className = 'additional-fee-item';
  div.innerHTML = `
    <select class="fee-type" onchange="updateAdditionalFeeType(${index}, this.value)">
      <option value="其他费用">其他费用</option>
      <option value="清洗费">清洗费</option>
      <option value="损坏赔偿">损坏赔偿</option>
      <option value="逾期费">逾期费</option>
    </select>
    <input type="number" class="fee-amount" placeholder="金额" min="0" onchange="updateAdditionalFeeAmount(${index}, parseFloat(this.value) || 0)">
    <input type="text" class="fee-reason" placeholder="费用说明" onchange="updateAdditionalFeeReason(${index}, this.value)">
    <button class="btn btn-danger" onclick="removeAdditionalFee(${index})">×</button>
  `;
  container.appendChild(div);
  
  updateFeePreview();
}

function updateAdditionalFeeType(index, value) {
  additionalFees[index].type = value;
}

function updateAdditionalFeeAmount(index, value) {
  additionalFees[index].amount = value;
  updateFeePreview();
}

function updateAdditionalFeeReason(index, value) {
  additionalFees[index].reason = value;
}

function removeAdditionalFee(index) {
  additionalFees.splice(index, 1);
  renderReturnForm();
}

function updateFeePreview() {
  const order = currentReturnOrder;
  if (!order) return;
  
  let totalFees = 0;
  const breakdown = [];
  
  breakdown.push({ label: '租赁费', amount: order.totalRentalFee });
  
  order.items.forEach((item, index) => {
    const returned = document.getElementById(`returned-${index}`)?.checked;
    const returnedQty = parseInt(document.getElementById(`returnedQty-${index}`)?.value) || 0;
    
    const cleaning = document.getElementById(`cleaning-${index}`)?.checked;
    const cleaningFee = parseFloat(document.getElementById(`cleaningFee-${index}`)?.value) || 0;
    
    const damaged = document.getElementById(`damaged-${index}`)?.checked;
    const damageFee = parseFloat(document.getElementById(`damageFee-${index}`)?.value) || 0;
    
    if (returned && returnedQty > 0) {
      if (cleaning && cleaningFee > 0) {
        breakdown.push({ label: `${item.name} 清洗费`, amount: cleaningFee });
        totalFees += cleaningFee;
      }
      
      if (damaged && damageFee > 0) {
        breakdown.push({ label: `${item.name} 损坏赔偿`, amount: damageFee });
        totalFees += damageFee;
      }
    }
    
    const notReturned = item.quantity - returnedQty;
    if (notReturned > 0) {
      const lostFee = item.deposit * notReturned;
      breakdown.push({ label: `${item.name} 未归还 (${notReturned}件)`, amount: lostFee });
      totalFees += lostFee;
    }
  });
  
  additionalFees.forEach(fee => {
    if (fee.amount > 0) {
      breakdown.push({ label: `${fee.type}${fee.reason ? ` - ${fee.reason}` : ''}`, amount: fee.amount });
      totalFees += fee.amount;
    }
  });
  
  const totalDeductions = order.totalRentalFee + totalFees;
  const refund = order.actualDeposit - totalDeductions;
  
  const previewSection = document.getElementById('feePreview');
  previewSection.innerHTML = `
    <h3>扣费预览</h3>
    <div class="fee-breakdown">
      ${breakdown.map(item => `
        <div class="fee-breakdown-item">
          <span>${item.label}</span>
          <span>¥${item.amount.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
    <div class="fee-breakdown-total">
      <span>应退还押金</span>
      <span class="refund-amount ${refund < 0 ? 'negative' : ''}">¥${refund.toFixed(2)}</span>
    </div>
  `;
}

async function submitReturn() {
  const order = currentReturnOrder;
  if (!order) return;
  
  const returnedItems = order.items.map((item, index) => {
    const returned = document.getElementById(`returned-${index}`)?.checked;
    const returnedQty = parseInt(document.getElementById(`returnedQty-${index}`)?.value) || 0;
    
    return {
      returned: returned || returnedQty > 0,
      quantity: returnedQty,
      cleaningNeeded: document.getElementById(`cleaning-${index}`)?.checked,
      cleaningFee: parseFloat(document.getElementById(`cleaningFee-${index}`)?.value) || 0,
      damaged: document.getElementById(`damaged-${index}`)?.checked,
      damageFee: parseFloat(document.getElementById(`damageFee-${index}`)?.value) || 0,
      damageDescription: document.getElementById(`damageDesc-${index}`)?.value || ''
    };
  });
  
  try {
    const response = await fetch(`${API_BASE}/orders/${order.id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnedItems,
        fees: additionalFees
      })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast(result.message, 'success');
      currentReturnOrder = null;
      additionalFees = [];
      backToOrders();
      loadOrders();
      loadEquipment();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('归还验收失败', 'error');
  }
}

function backToOrders() {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="orders"]').classList.add('active');
  document.getElementById('orders').classList.add('active');
}

async function openDepositModal(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) return;
  
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = `
    <h2>补交押金</h2>
    <div class="order-info-section">
      <div class="order-info-grid">
        <div class="order-info-item">
          <span class="label">订单号</span>
          <span class="value">${order.orderNumber}</span>
        </div>
        <div class="order-info-item">
          <span class="label">应交押金</span>
          <span class="value">¥${order.requiredDeposit}</span>
        </div>
        <div class="order-info-item">
          <span class="label">已交押金</span>
          <span class="value">¥${order.actualDeposit}</span>
        </div>
        <div class="order-info-item">
          <span class="label">需补交</span>
          <span class="value status-tag 不足">¥${order.depositShortage}</span>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>补交金额 *</label>
      <input type="number" id="additionalDeposit" min="0" step="0.01" value="${order.depositShortage}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="document.getElementById('modal').classList.remove('active')">取消</button>
      <button class="btn btn-primary" onclick="submitDeposit('${orderId}')">确认补交</button>
    </div>
  `;
  
  modal.classList.add('active');
}

async function submitDeposit(orderId) {
  const amount = parseFloat(document.getElementById('additionalDeposit').value);
  
  if (!amount || amount <= 0) {
    showToast('请输入有效的补交金额', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/orders/${orderId}/deposit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalDeposit: amount })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('modal').classList.remove('active');
      loadOrders();
      loadEquipment();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('补交押金失败', 'error');
  }
}

async function deleteOrder(id) {
  if (!confirm('确定要删除这个订单吗？')) return;
  
  try {
    const response = await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE' });
    const result = await response.json();
    
    if (result.success) {
      showToast('删除成功', 'success');
      loadOrders();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast('删除失败', 'error');
  }
}

function renderHistoryOrders() {
  const container = document.getElementById('historyOrdersList');
  
  if (currentOrders.length === 0) {
    container.innerHTML = '<p class="empty">暂无历史订单</p>';
    return;
  }
  
  const completedOrders = currentOrders.filter(o => o.status === '已完成' || o.fees?.length > 0);
  
  container.innerHTML = completedOrders.map(order => `
    <div class="order-card">
      <h3>
        <span class="order-number">${order.orderNumber}</span>
        <span class="status-tag" style="margin-left: 10px;">${order.status}</span>
      </h3>
      <div class="order-summary">
        <div class="summary-item">
          <span class="label">客户</span>
          <span class="value">${order.customerName}</span>
        </div>
        <div class="summary-item">
          <span class="label">装备</span>
          <span class="value">${order.equipmentName}</span>
        </div>
        <div class="summary-item">
          <span class="label">租赁费</span>
          <span class="value">¥${order.totalRentalFee}</span>
        </div>
        <div class="summary-item">
          <span class="label">押金</span>
          <span class="value">¥${order.actualDeposit}</span>
        </div>
        <div class="summary-item">
          <span class="label">扣费</span>
          <span class="value">¥${order.totalFees}</span>
        </div>
        <div class="summary-item">
          <span class="label">退还</span>
          <span class="value refund-amount ${order.refundAmount < 0 ? 'negative' : ''}">¥${order.refundAmount}</span>
        </div>
      </div>
      ${order.fees && order.fees.length > 0 ? `
      <div class="fees-history">
        <h4>扣费记录：</h4>
        ${order.fees.map(fee => `
          <div class="fee-history-item">
            <div class="fee-info">
              <div class="fee-type">${fee.type}</div>
              <div class="fee-reason">${fee.reason}</div>
              <div class="fee-time">${new Date(fee.createdAt).toLocaleString()}</div>
            </div>
            <div class="fee-amount ${fee.amount < 0 ? 'positive' : ''}">
              ${fee.amount > 0 ? '+' : ''}¥${fee.amount}
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  `).join('');
}

function exportStatement() {
  const startDate = document.getElementById('exportStartDate').value;
  const endDate = document.getElementById('exportEndDate').value;
  
  let url = `${API_BASE}/orders/export/statement`;
  const params = [];
  
  if (startDate) params.push(`startDate=${startDate}`);
  if (endDate) params.push(`endDate=${endDate}`);
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  window.open(url, '_blank');
  showToast('导出已开始，请等待下载', 'info');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
