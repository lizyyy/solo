// ========== 全局变量 ==========
let currentPage = 'dashboard';
let products = [];
let ingredients = [];
let pendingCsvData = null;
let confirmCallback = null;

const statusMap = {
  '待确认': { class: 'status-pending', label: '待确认' },
  '已确认': { class: 'status-confirmed', label: '已确认' },
  '制作中': { class: 'status-progress', label: '制作中' },
  '已完成': { class: 'status-done', label: '已完成' },
  '已取消': { class: 'status-cancelled', label: '已取消' }
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
  initNavigation();
  initDateInputs();
  initDragDrop();
  initFilters();
  loadAllData();
});

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
    });
  });
}

function initDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('schedule-date').value = today;
  document.getElementById('demand-date').value = today;
  document.getElementById('export-date').value = today;
  document.getElementById('order-pickup-date').value = today;
}

function initFilters() {
  document.getElementById('order-status-filter').addEventListener('change', loadOrders);
}

function initDragDrop() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('csvFile');
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });
}

// ========== 模态框操作 ==========
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ========== 页面导航 ==========
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');
  
  currentPage = page;
  
  switch(page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'orders':
      loadOrders();
      break;
    case 'schedule':
      loadSchedule();
      break;
    case 'ingredients':
      loadIngredientDemand();
      break;
    case 'products':
      loadProducts();
      break;
  }
}

// ========== API 调用 ==========
async function apiGet(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || '请求失败');
  }
  return response.json();
}

async function apiPost(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || '请求失败');
  }
  return response.json();
}

async function apiPut(url, data) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || '请求失败');
  }
  return response.json();
}

// ========== 加载数据 ==========
async function loadAllData() {
  try {
    [products, ingredients] = await Promise.all([
      apiGet('/api/products'),
      apiGet('/api/ingredients')
    ]);
    loadDashboard();
  } catch (err) {
    console.error('加载数据失败:', err);
    alert('加载数据失败: ' + err.message);
  }
}

async function loadDashboard() {
  try {
    const stats = await apiGet('/api/stats');
    
    document.getElementById('stat-today-orders').textContent = stats.today_orders;
    document.getElementById('stat-pending').textContent = stats.pending_orders;
    document.getElementById('stat-progress').textContent = stats.in_progress;
    document.getElementById('stat-stock').textContent = stats.low_stock_alerts;
    
    const stockCard = document.getElementById('stat-stock-card');
    if (stats.low_stock_alerts > 0) {
      stockCard.className = 'stat-card warning';
    } else {
      stockCard.className = 'stat-card success';
    }
    
    const schedule = await apiGet('/api/schedule');
    renderDashboardSchedule(schedule);
    
    const demand = await apiGet('/api/ingredient-demand');
    renderDashboardDemand(demand);
    
  } catch (err) {
    console.error('加载工作台失败:', err);
  }
}

function renderDashboardSchedule(schedule) {
  const container = document.getElementById('dashboard-schedule');
  
  if (schedule.schedule.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 20px;"><p>今日暂无订单</p></div>';
    return;
  }
  
  let html = '';
  for (const slot of schedule.schedule) {
    html += `<div style="margin-bottom: 10px;">
      <strong style="color: #667eea;">${slot.time}</strong> - ${slot.orders.length} 个订单，共 ${slot.total_quantity} 件商品
    </div>`;
  }
  
  container.innerHTML = html;
}

function renderDashboardDemand(demand) {
  const container = document.getElementById('dashboard-demand');
  
  if (demand.gaps.length > 0) {
    let gapHtml = '<div class="stock-warning">⚠️ 原料缺口预警：';
    gapHtml += demand.gaps.map(g => `<strong>${g.name}</strong> 缺 ${g.gap}${g.unit}`).join('、');
    gapHtml += '</div>';
    container.innerHTML = gapHtml;
  } else if (Object.keys(demand.total_demand).length > 0) {
    let okHtml = '<div class="stock-ok">✅ 库存充足，今日预计消耗：';
    const items = Object.entries(demand.total_demand).map(([name, d]) => 
      `${name} ${d.required}${d.unit}`
    );
    okHtml += items.join('、') + '</div>';
    container.innerHTML = okHtml;
  } else {
    container.innerHTML = '<div class="empty-state" style="padding: 20px;"><p>今日暂无原料需求</p></div>';
  }
}

// ========== 订单管理 ==========
async function loadOrders() {
  try {
    const status = document.getElementById('order-status-filter').value;
    let url = '/api/orders';
    if (status) {
      url += '?status=' + encodeURIComponent(status);
    }
    
    const orders = await apiGet(url);
    renderOrdersTable(orders);
  } catch (err) {
    console.error('加载订单失败:', err);
    alert('加载订单失败: ' + err.message);
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-tbody');
  
  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>暂无订单</p></div></td></tr>';
    return;
  }
  
  let html = '';
  for (const order of orders) {
    const statusInfo = statusMap[order.status] || statusMap['待确认'];
    const itemsHtml = order.items.map(item => 
      `${item.product_name} ×${item.quantity}`
    ).join('<br>');
    
    html += `
      <tr>
        <td><strong>${order.order_no}</strong></td>
        <td>
          ${order.customer_name}<br>
          <small style="color: #868e96;">${order.customer_phone || '-'}</small>
        </td>
        <td>${order.pickup_date}<br><small style="color: #868e96;">${order.pickup_time}</small></td>
        <td>${itemsHtml}</td>
        <td>¥${order.total_amount}</td>
        <td><span class="status-badge ${statusInfo.class}">${statusInfo.label}</span></td>
        <td>${order.remark || '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-outline" onclick="editOrder(${order.id})">编辑</button>
            ${order.status !== '已取消' && order.status !== '已完成' ? 
              `<button class="btn btn-sm btn-warning" onclick="updateOrderStatus(${order.id}, '${getNextStatus(order.status)}')">${getNextStatusLabel(order.status)}</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }
  
  tbody.innerHTML = html;
}

function getNextStatus(current) {
  const flow = ['待确认', '已确认', '制作中', '已完成'];
  const idx = flow.indexOf(current);
  if (idx >= 0 && idx < flow.length - 1) {
    return flow[idx + 1];
  }
  return current;
}

function getNextStatusLabel(current) {
  const next = getNextStatus(current);
  if (next === current) return '';
  const labelMap = { '已确认': '确认', '制作中': '开始', '已完成': '完成' };
  return labelMap[next] || next;
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    await apiPut('/api/orders/' + orderId, { status: newStatus });
    loadOrders();
    if (currentPage === 'dashboard') loadDashboard();
    if (currentPage === 'schedule') loadSchedule();
  } catch (err) {
    console.error('更新状态失败:', err);
    alert('更新失败: ' + err.message);
  }
}

function showAddOrderModal() {
  document.getElementById('order-modal-title').textContent = '新增订单';
  document.getElementById('edit-order-id').value = '';
  document.getElementById('order-form').reset();
  document.getElementById('order-pickup-date').value = new Date().toISOString().split('T')[0];
  
  const container = document.getElementById('order-items-container');
  container.innerHTML = `
    <div class="recipe-item recipe-item-header">
      <span>商品</span>
      <span>数量</span>
      <span>单价</span>
      <span></span>
    </div>
  `;
  addOrderItem();
  
  openModal('order-modal');
}

async function editOrder(orderId) {
  try {
    const order = await apiGet('/api/orders/' + orderId);
    
    document.getElementById('order-modal-title').textContent = '编辑订单';
    document.getElementById('edit-order-id').value = orderId;
    document.getElementById('order-customer-name').value = order.customer_name;
    document.getElementById('order-customer-phone').value = order.customer_phone || '';
    document.getElementById('order-pickup-date').value = order.pickup_date;
    document.getElementById('order-pickup-time').value = order.pickup_time;
    document.getElementById('order-status').value = order.status;
    document.getElementById('order-remark').value = order.remark || '';
    
    const container = document.getElementById('order-items-container');
    container.innerHTML = `
      <div class="recipe-item recipe-item-header">
        <span>商品</span>
        <span>数量</span>
        <span>单价</span>
        <span></span>
      </div>
    `;
    
    for (const item of order.items) {
      addOrderItem(item);
    }
    
    openModal('order-modal');
  } catch (err) {
    console.error('加载订单失败:', err);
    alert('加载订单失败: ' + err.message);
  }
}

function addOrderItem(item = null) {
  const container = document.getElementById('order-items-container');
  const div = document.createElement('div');
  div.className = 'recipe-item';
  
  const options = products.map(p => 
    `<option value="${p.id}" ${item && item.product_id === p.id ? 'selected' : ''}>${p.name}</option>`
  ).join('');
  
  div.innerHTML = `
    <select class="form-control order-item-product">
      <option value="">-- 选择商品 --</option>
      ${options}
    </select>
    <input type="number" class="form-control order-item-qty" min="1" value="${item ? item.quantity : 1}" required>
    <input type="number" step="0.01" class="form-control order-item-price" min="0" value="${item ? item.unit_price : 0}">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(div);
}

async function saveOrder() {
  const orderId = document.getElementById('edit-order-id').value;
  const isEdit = !!orderId;
  
  const itemDivs = document.querySelectorAll('#order-items-container .recipe-item:not(.recipe-item-header)');
  const items = [];
  
  for (const div of itemDivs) {
    const productId = div.querySelector('.order-item-product').value;
    const qty = parseInt(div.querySelector('.order-item-qty').value);
    const price = parseFloat(div.querySelector('.order-item-price').value) || 0;
    
    if (!productId || isNaN(qty) || qty < 1) continue;
    
    items.push({
      product_id: parseInt(productId),
      quantity: qty,
      unit_price: price
    });
  }
  
  if (items.length === 0) {
    alert('至少需要添加一个商品');
    return;
  }
  
  const data = {
    customer_name: document.getElementById('order-customer-name').value.trim(),
    customer_phone: document.getElementById('order-customer-phone').value.trim(),
    pickup_date: document.getElementById('order-pickup-date').value,
    pickup_time: document.getElementById('order-pickup-time').value,
    status: document.getElementById('order-status').value,
    remark: document.getElementById('order-remark').value.trim(),
    items: items
  };
  
  try {
    if (isEdit) {
      await apiPut('/api/orders/' + orderId, data);
    } else {
      await apiPost('/api/orders', data);
    }
    
    closeModal('order-modal');
    loadOrders();
    if (currentPage === 'dashboard') loadDashboard();
    if (currentPage === 'schedule') loadSchedule();
    if (currentPage === 'ingredients') loadIngredientDemand();
    
  } catch (err) {
    console.error('保存订单失败:', err);
    alert('保存失败: ' + err.message);
  }
}

// ========== 排产清单 ==========
function changeScheduleDate(delta) {
  const dateInput = document.getElementById('schedule-date');
  const current = new Date(dateInput.value);
  current.setDate(current.getDate() + delta);
  dateInput.value = current.toISOString().split('T')[0];
  loadSchedule();
}

async function loadSchedule() {
  try {
    const date = document.getElementById('schedule-date').value;
    
    const [schedule, demand] = await Promise.all([
      apiGet('/api/schedule?date=' + date),
      apiGet('/api/ingredient-demand?date=' + date)
    ]);
    
    renderScheduleTimeline(schedule, demand);
  } catch (err) {
    console.error('加载排产失败:', err);
    alert('加载失败: ' + err.message);
  }
}

function renderScheduleTimeline(schedule, demand) {
  const container = document.getElementById('schedule-timeline');
  const warningDiv = document.getElementById('schedule-gap-warning');
  
  if (demand.gaps.length > 0) {
    warningDiv.classList.remove('hidden');
    warningDiv.className = 'stock-warning';
    warningDiv.innerHTML = `
      ⚠️ <strong>原料缺口警告！</strong>
      当前库存不足以完成 ${schedule.date} 的所有订单。缺口原料：
      ${demand.gaps.map(g => `<strong>${g.name}</strong> (缺 ${g.gap}${g.unit})`).join('、')}
    `;
  } else {
    warningDiv.classList.add('hidden');
  }
  
  if (schedule.schedule.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>${schedule.date} 没有订单</p>
      </div>
    `;
    return;
  }
  
  const hasGap = demand.gaps.length > 0;
  
  let html = '';
  for (const slot of schedule.schedule) {
    html += `<div class="timeline-item">
      <div class="timeline-header">
        <span class="timeline-time">${slot.time}</span>
        <span class="timeline-count">${slot.orders.length} 个订单，共 ${slot.total_quantity} 件</span>
      </div>
      <div class="timeline-orders">`;
    
    for (const order of slot.orders) {
      const statusInfo = statusMap[order.status] || statusMap['待确认'];
      const itemsHtml = order.items.map(item => 
        `<div class="order-item">• ${item.product_name} ×${item.quantity}${item.unit ? item.unit : ''}</div>`
      ).join('');
      
      html += `
        <div class="order-card ${hasGap ? 'danger' : ''}">
          <div class="order-card-header">
            <span class="order-no">${order.order_no}</span>
            <span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>
          </div>
          <div class="order-customer">
            <strong>${order.customer_name}</strong>
            ${order.customer_phone ? '(' + order.customer_phone + ')' : ''}
          </div>
          <div class="order-items">${itemsHtml}</div>
          ${order.remark ? `<div style="margin-top: 8px; font-size: 12px; color: #868e96;">📝 ${order.remark}</div>` : ''}
          <div style="margin-top: 10px; display: flex; gap: 5px;">
            <button class="btn btn-sm btn-outline" onclick="editOrder(${order.id})">编辑</button>
            ${order.status !== '已取消' && order.status !== '已完成' ? 
              `<button class="btn btn-sm btn-primary" onclick="updateOrderStatus(${order.id}, '${getNextStatus(order.status)}'); loadSchedule();">${getNextStatusLabel(order.status)}</button>` : ''}
            ${order.status !== '已取消' ? 
              `<button class="btn btn-sm btn-danger" onclick="showConfirm('确定要取消该订单吗？取消后不再占用原料。', () => { updateOrderStatus(${order.id}, '已取消'); loadSchedule(); })">取消订单</button>` : ''}
          </div>
        </div>
      `;
    }
    
    html += `</div></div>`;
  }
  
  container.innerHTML = html;
}

function showConfirm(message, callback) {
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = callback;
  document.getElementById('confirm-btn').onclick = () => {
    closeModal('confirm-modal');
    if (confirmCallback) confirmCallback();
  };
  openModal('confirm-modal');
}

// ========== 原料库存 ==========
async function loadIngredientDemand() {
  try {
    const date = document.getElementById('demand-date').value;
    const [demand, allIngredients] = await Promise.all([
      apiGet('/api/ingredient-demand?date=' + date),
      apiGet('/api/ingredients')
    ]);
    
    ingredients = allIngredients;
    renderIngredientsTable(demand);
  } catch (err) {
    console.error('加载原料失败:', err);
    alert('加载失败: ' + err.message);
  }
}

function renderIngredientsTable(demand) {
  const tbody = document.getElementById('ingredients-tbody');
  const summaryDiv = document.getElementById('demand-summary');
  
  if (Object.keys(demand.total_demand).length > 0) {
    summaryDiv.classList.remove('hidden');
    const items = Object.entries(demand.total_demand).map(([name, d]) => 
      `<strong>${name}</strong>: ${d.required}${d.unit}`
    );
    summaryDiv.innerHTML = `📅 ${demand.date} 预计消耗：${items.join('、')}`;
  } else {
    summaryDiv.classList.add('hidden');
  }
  
  if (demand.ingredients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>暂无原料</p></div></td></tr>';
    return;
  }
  
  let html = '';
  for (const ing of demand.ingredients) {
    let rowClass = '';
    let statusHtml = '';
    
    if (ing.is_insufficient) {
      rowClass = 'gap-highlight';
      statusHtml = `<span class="status-badge status-cancelled">缺口 ${ing.gap}${ing.unit}</span>`;
    } else if (ing.is_below_min) {
      rowClass = 'low-highlight';
      statusHtml = `<span class="status-badge status-pending">低于安全线</span>`;
    } else {
      statusHtml = `<span class="status-badge status-done">正常</span>`;
    }
    
    const remainingClass = ing.remaining_stock < 0 ? 'color: #ff6b6b; font-weight: bold;' : '';
    
    html += `
      <tr class="${rowClass}">
        <td><strong>${ing.name}</strong></td>
        <td>${ing.unit}</td>
        <td>${ing.current_stock}</td>
        <td>${ing.required || 0}</td>
        <td style="${remainingClass}">${ing.remaining_stock}</td>
        <td>${ing.min_stock || 0}</td>
        <td>${statusHtml}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-outline" onclick="editIngredient(${ing.id})">调整</button>
          </div>
        </td>
      </tr>
    `;
  }
  
  tbody.innerHTML = html;
}

function showAddIngredientModal() {
  document.getElementById('ingredient-modal-title').textContent = '新增原料';
  document.getElementById('edit-ingredient-id').value = '';
  document.getElementById('ingredient-form').reset();
  document.getElementById('ingredient-stock').value = '0';
  document.getElementById('ingredient-min-stock').value = '0';
  openModal('ingredient-modal');
}

async function editIngredient(ingredientId) {
  try {
    const ing = await apiGet('/api/ingredients/' + ingredientId);
    
    document.getElementById('ingredient-modal-title').textContent = '编辑原料';
    document.getElementById('edit-ingredient-id').value = ingredientId;
    document.getElementById('ingredient-name').value = ing.name;
    document.getElementById('ingredient-unit').value = ing.unit;
    document.getElementById('ingredient-stock').value = ing.current_stock;
    document.getElementById('ingredient-min-stock').value = ing.min_stock || 0;
    
    openModal('ingredient-modal');
  } catch (err) {
    console.error('加载原料失败:', err);
    alert('加载失败: ' + err.message);
  }
}

async function saveIngredient() {
  const ingredientId = document.getElementById('edit-ingredient-id').value;
  const isEdit = !!ingredientId;
  
  const data = {
    name: document.getElementById('ingredient-name').value.trim(),
    unit: document.getElementById('ingredient-unit').value,
    current_stock: parseFloat(document.getElementById('ingredient-stock').value) || 0,
    min_stock: parseFloat(document.getElementById('ingredient-min-stock').value) || 0
  };
  
  if (!data.name) {
    alert('原料名称不能为空');
    return;
  }
  
  try {
    if (isEdit) {
      await apiPut('/api/ingredients/' + ingredientId, data);
    } else {
      await apiPost('/api/ingredients', data);
    }
    
    closeModal('ingredient-modal');
    loadAllData();
    loadIngredientDemand();
    
  } catch (err) {
    console.error('保存原料失败:', err);
    alert('保存失败: ' + err.message);
  }
}

// ========== 商品配方 ==========
async function loadProducts() {
  try {
    products = await apiGet('/api/products');
    renderProductsList();
  } catch (err) {
    console.error('加载商品失败:', err);
    alert('加载失败: ' + err.message);
  }
}

function renderProductsList() {
  const container = document.getElementById('products-list');
  
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>暂无商品，请添加</p></div>';
    return;
  }
  
  let html = '';
  for (const product of products) {
    let recipeHtml = '';
    if (product.recipes && product.recipes.length > 0) {
      recipeHtml = '<table class="recipe-table" style="margin-top: 10px;">';
      recipeHtml += '<thead><tr><th>原料</th><th>用量</th><th>单位</th></tr></thead><tbody>';
      for (const r of product.recipes) {
        recipeHtml += `<tr><td>${r.ingredient_name}</td><td>${r.quantity}</td><td>${r.unit}</td></tr>`;
      }
      recipeHtml += '</tbody></table>';
    } else {
      recipeHtml = '<p style="color: #868e96; margin-top: 10px; font-size: 13px;">⚠️ 未配置配方，无法计算原料需求</p>';
    }
    
    html += `
      <div class="card" style="margin-bottom: 15px;">
        <div class="card-header">
          <div>
            <span class="card-title">${product.name}</span>
            <small style="color: #868e96; margin-left: 10px;">${product.description || ''}</small>
          </div>
          <button class="btn btn-sm btn-outline" onclick="editProduct(${product.id})">编辑配方</button>
        </div>
        <div class="card-body" style="padding-top: 0; padding-bottom: 0;">
          ${recipeHtml}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function showAddProductModal() {
  document.getElementById('product-modal-title').textContent = '新增商品';
  document.getElementById('edit-product-id').value = '';
  document.getElementById('product-form').reset();
  document.getElementById('product-price').value = '0';
  
  const container = document.getElementById('recipe-container');
  container.innerHTML = `
    <div class="recipe-item recipe-item-header">
      <span>原料</span>
      <span>用量</span>
      <span></span>
    </div>
  `;
  addRecipeItem();
  
  openModal('product-modal');
}

async function editProduct(productId) {
  try {
    const product = await apiGet('/api/products/' + productId);
    
    document.getElementById('product-modal-title').textContent = '编辑商品';
    document.getElementById('edit-product-id').value = productId;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-unit').value = product.unit;
    document.getElementById('product-description').value = product.description || '';
    
    const container = document.getElementById('recipe-container');
    container.innerHTML = `
      <div class="recipe-item recipe-item-header">
        <span>原料</span>
        <span>用量</span>
        <span></span>
      </div>
    `;
    
    if (product.recipes && product.recipes.length > 0) {
      for (const recipe of product.recipes) {
        addRecipeItem(recipe);
      }
    } else {
      addRecipeItem();
    }
    
    openModal('product-modal');
  } catch (err) {
    console.error('加载商品失败:', err);
    alert('加载失败: ' + err.message);
  }
}

function addRecipeItem(recipe = null) {
  const container = document.getElementById('recipe-container');
  const div = document.createElement('div');
  div.className = 'recipe-item';
  
  const options = ingredients.map(ing => 
    `<option value="${ing.id}" ${recipe && recipe.ingredient_id === ing.id ? 'selected' : ''}>${ing.name} (${ing.unit})</option>`
  ).join('');
  
  div.innerHTML = `
    <select class="form-control recipe-ingredient">
      <option value="">-- 选择原料 --</option>
      ${options}
    </select>
    <input type="number" step="any" class="form-control recipe-qty" min="0" value="${recipe ? recipe.quantity : 1}">
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(div);
}

async function saveProduct() {
  const productId = document.getElementById('edit-product-id').value;
  const isEdit = !!productId;
  
  const recipeDivs = document.querySelectorAll('#recipe-container .recipe-item:not(.recipe-item-header)');
  const recipes = [];
  
  for (const div of recipeDivs) {
    const ingredientId = div.querySelector('.recipe-ingredient').value;
    const qty = parseFloat(div.querySelector('.recipe-qty').value);
    
    if (!ingredientId || isNaN(qty) || qty <= 0) continue;
    
    recipes.push({
      ingredient_id: parseInt(ingredientId),
      quantity: qty
    });
  }
  
  const data = {
    name: document.getElementById('product-name').value.trim(),
    description: document.getElementById('product-description').value.trim(),
    unit: document.getElementById('product-unit').value,
    recipes: recipes
  };
  
  if (!data.name) {
    alert('商品名称不能为空');
    return;
  }
  
  try {
    if (isEdit) {
      await apiPut('/api/products/' + productId, data);
    } else {
      await apiPost('/api/products', data);
    }
    
    closeModal('product-modal');
    loadAllData();
    if (currentPage === 'ingredients') loadIngredientDemand();
    
  } catch (err) {
    console.error('保存商品失败:', err);
    alert('保存失败: ' + err.message);
  }
}

// ========== CSV 导入导出 ==========
function handleFileSelect(file) {
  if (!file.name.endsWith('.csv')) {
    alert('请选择CSV文件');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const csvData = e.target.result;
    pendingCsvData = csvData;
    
    try {
      const result = await apiPost('/api/import-orders', {
        csvData: csvData,
        dryRun: true
      });
      
      showValidationResults(result);
    } catch (err) {
      console.error('校验失败:', err);
      alert('校验失败: ' + err.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function showValidationResults(result) {
  document.getElementById('valid-count').textContent = result.valid_count + ' 条有效';
  document.getElementById('invalid-count').textContent = result.invalid_count + ' 条无效';
  
  const listDiv = document.getElementById('validation-list');
  let html = '';
  
  for (const item of result.validation_results) {
    let rowClass = 'success';
    if (item.errors.length > 0) {
      rowClass = 'error';
    } else if (item.warnings.length > 0) {
      rowClass = 'warning';
    }
    
    html += `<div class="validation-row ${rowClass}">
      <strong>第 ${item.row} 行</strong>: ${item.data['客户姓名'] || '未知客户'}<br>
      ${item.errors.length > 0 ? '<ul class="error-list">' + item.errors.map(e => '<li>❌ ' + e + '</li>').join('') + '</ul>' : ''}
      ${item.warnings.length > 0 ? '<ul class="warning-list">' + item.warnings.map(w => '<li>⚠️ ' + w + '</li>').join('') + '</ul>' : ''}
      ${item.is_valid ? '<span style="color: #52c41a;">✅ 校验通过</span>' : ''}
    </div>`;
  }
  
  listDiv.innerHTML = html;
  document.getElementById('validation-results').classList.remove('hidden');
  
  const confirmBtn = document.getElementById('confirm-import-btn');
  if (result.valid_count > 0) {
    confirmBtn.disabled = false;
  } else {
    confirmBtn.disabled = true;
  }
}

function resetImport() {
  pendingCsvData = null;
  document.getElementById('validation-results').classList.add('hidden');
  document.getElementById('csvFile').value = '';
}

async function confirmImport() {
  if (!pendingCsvData) return;
  
  try {
    const result = await apiPost('/api/import-orders', {
      csvData: pendingCsvData,
      dryRun: false
    });
    
    if (result.success) {
      alert(`导入成功！共导入 ${result.imported_count} 个订单`);
      resetImport();
      loadAllData();
      if (currentPage === 'orders') loadOrders();
      if (currentPage === 'schedule') loadSchedule();
    }
  } catch (err) {
    console.error('导入失败:', err);
    alert('导入失败: ' + err.message);
  }
}

function exportSchedule() {
  let date = document.getElementById('schedule-date').value;
  if (!date) {
    date = document.getElementById('export-date').value;
  }
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }
  
  window.open('/api/export-schedule?date=' + date, '_blank');
}
