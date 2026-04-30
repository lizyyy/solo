const API_BASE = '/api';

let currentProducts = [];
let currentOrders = [];
let currentPickupSlots = [];
let currentOrderItems = [];

document.addEventListener('DOMContentLoaded', () => {
  loadPickupSlots();
  loadProducts();
  updatePendingBadge();
  
  const hash = window.location.hash;
  if (hash) {
    const route = hash.replace('#/', '');
    navigateTo(route || 'dashboard');
  } else {
    navigateTo('dashboard');
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    const route = hash.replace('#/', '');
    navigateTo(route || 'dashboard');
  });
});

function navigateTo(page) {
  window.location.hash = `/${page}`;
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#/${page}`) {
      link.classList.add('active');
    }
  });

  switch(page) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'products':
      renderProducts();
      break;
    case 'orders':
      renderOrders();
      break;
    case 'replacements':
      renderReplacements();
      break;
    case 'shipping':
      renderShipping();
      break;
    case 'users':
      renderUsers();
      break;
    default:
      renderDashboard();
  }
}

async function loadPickupSlots() {
  try {
    const response = await fetch(`${API_BASE}/pickup-slots?is_active=true`);
    currentPickupSlots = await response.json();
    
    const pickupSelect = document.getElementById('order-pickup');
    if (pickupSelect) {
      pickupSelect.innerHTML = '<option value="">请选择取货时间</option>';
      currentPickupSlots.forEach(slot => {
        pickupSelect.innerHTML += `<option value="${slot.slot_time}">${slot.slot_time}</option>`;
      });
    }
  } catch (error) {
    console.error('加载取货时间失败:', error);
  }
}

async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/products`);
    currentProducts = await response.json();
    
    const repSelect = document.getElementById('rep-suggested-product');
    if (repSelect) {
      repSelect.innerHTML = '<option value="">请选择替换商品（可选）</option>';
      currentProducts.forEach(product => {
        repSelect.innerHTML += `<option value="${product.id}" data-price="${product.price}">${product.name} - ¥${product.price}/${product.unit}</option>`;
      });
    }
  } catch (error) {
    console.error('加载商品失败:', error);
  }
}

async function updatePendingBadge() {
  try {
    const response = await fetch(`${API_BASE}/replacements/pending`);
    const pending = await response.json();
    
    const badge = document.getElementById('pending-badge');
    if (badge) {
      if (pending.length > 0) {
        badge.textContent = pending.length;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('获取待处理替换数量失败:', error);
  }
}

function formatCurrency(amount) {
  return '¥' + parseFloat(amount || 0).toFixed(2);
}

function getStatusBadge(status) {
  const statusMap = {
    'pending': { label: '待付款', class: 'status-pending' },
    'confirmed': { label: '已确认', class: 'status-confirmed' },
    'needs_replacement': { label: '需替换', class: 'status-needs-replacement' }
  };
  const s = statusMap[status] || { label: status, class: '' };
  return `<span class="status-badge ${s.class}">${s.label}</span>`;
}

function getReplacementBadge(status) {
  const statusMap = {
    'none': { label: '无替换', class: 'replacement-none' },
    'pending': { label: '待确认', class: 'replacement-pending' },
    'confirmed': { label: '已确认', class: 'replacement-confirmed' }
  };
  const s = statusMap[status] || { label: status, class: '' };
  return `<span class="status-badge ${s.class}">${s.label}</span>`;
}

async function renderDashboard() {
  const container = document.getElementById('app-content');
  
  try {
    const [statsResponse, productsResponse, ordersResponse] = await Promise.all([
      fetch(`${API_BASE}/stats`),
      fetch(`${API_BASE}/products`),
      fetch(`${API_BASE}/orders`)
    ]);
    
    const stats = await statsResponse.json();
    const products = await productsResponse.json();
    const orders = await ordersResponse.json();
    
    const ordersByStatus = {};
    stats.order_statuses.forEach(s => {
      ordersByStatus[s.status] = s.count;
    });

    container.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-12">
          <h2><i class="bi bi-speedometer2"></i> 仪表盘</h2>
          <p class="text-muted">每周三晚上截单，及时处理缺货替换</p>
        </div>
      </div>
      
      <div class="row mb-4">
        <div class="col-md-3 mb-3">
          <div class="card stat-card">
            <div class="stat-value text-primary">${stats.products}</div>
            <div class="stat-label">在售商品</div>
          </div>
        </div>
        <div class="col-md-3 mb-3">
          <div class="card stat-card">
            <div class="stat-value text-success">${stats.orders}</div>
            <div class="stat-label">总订单数</div>
          </div>
        </div>
        <div class="col-md-3 mb-3">
          <div class="card stat-card">
            <div class="stat-value text-warning">${ordersByStatus['pending'] || 0}</div>
            <div class="stat-label">待付款订单</div>
          </div>
        </div>
        <div class="col-md-3 mb-3">
          <div class="card stat-card">
            <div class="stat-value text-danger">${stats.pending_replacements}</div>
            <div class="stat-label">待处理替换</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-6 mb-4">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-calendar-check"></i> 取货时间分布</span>
            </div>
            <div class="card-body">
              ${stats.pickup_stats.length > 0 ? `
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>取货时间</th>
                      <th>订单数</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${stats.pickup_stats.map(s => `
                      <tr>
                        <td><strong>${s.pickup_time}</strong></td>
                        <td><span class="badge bg-primary">${s.count}</span></td>
                        <td>
                          <button class="btn btn-sm btn-outline-primary" onclick="navigateTo('shipping')">
                            查看清单
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="empty-state">
                  <i class="bi bi-calendar-x"></i>
                  <p>暂无取货时间数据</p>
                </div>
              `}
            </div>
          </div>
        </div>
        
        <div class="col-md-6 mb-4">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-lightning"></i> 快速操作</span>
            </div>
            <div class="card-body">
              <div class="d-grid gap-2">
                <button class="btn btn-primary" onclick="navigateTo('products'); setTimeout(() => openProductModal(), 100)">
                  <i class="bi bi-plus-circle"></i> 添加新商品
                </button>
                <button class="btn btn-success" onclick="navigateTo('orders'); setTimeout(() => openOrderModal(), 100)">
                  <i class="bi bi-receipt-cutoff"></i> 新建订单
                </button>
                <button class="btn btn-warning" onclick="navigateTo('replacements')">
                  <i class="bi bi-arrow-left-right"></i> 处理缺货替换
                  ${stats.pending_replacements > 0 ? `<span class="badge bg-danger ms-1">${stats.pending_replacements}</span>` : ''}
                </button>
                <button class="btn btn-info" onclick="navigateTo('shipping')">
                  <i class="bi bi-file-earmark-spreadsheet"></i> 导出发货清单
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-12">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <span><i class="bi bi-clock-history"></i> 最近订单</span>
              <button class="btn btn-sm btn-outline-primary" onclick="navigateTo('orders')">
                查看全部 <i class="bi bi-arrow-right"></i>
              </button>
            </div>
            <div class="card-body">
              ${orders.length > 0 ? `
                <table class="table table-hover">
                  <thead>
                    <tr>
                      <th>用户名</th>
                      <th>联系电话</th>
                      <th>取货时间</th>
                      <th>金额</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${orders.slice(0, 5).map(order => `
                      <tr>
                        <td><strong>${order.user_name}</strong></td>
                        <td>${order.user_phone || '-'}</td>
                        <td>${order.pickup_time}</td>
                        <td class="fw-bold text-primary">${formatCurrency(order.total_amount)}</td>
                        <td>${getStatusBadge(order.status)}</td>
                        <td>
                          <button class="btn btn-sm btn-outline-info" onclick="viewOrder('${order.id}')">
                            <i class="bi bi-eye"></i>
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="empty-state">
                  <i class="bi bi-inbox"></i>
                  <p>暂无订单数据</p>
                  <button class="btn btn-primary mt-2" onclick="openOrderModal()">
                    创建第一个订单
                  </button>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> 加载数据失败: ${error.message}
      </div>
    `;
  }
}

async function renderProducts() {
  const container = document.getElementById('app-content');
  
  try {
    const response = await fetch(`${API_BASE}/products/all`);
    const products = await response.json();
    currentProducts = products;

    container.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="bi bi-box-seam"></i> 商品维护</h2>
          <p class="text-muted">管理本周团购商品，设置价格、单位和库存</p>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="openProductModal()">
            <i class="bi bi-plus-circle"></i> 添加商品
          </button>
          <button class="btn btn-outline-secondary ms-2" onclick="exportProductsCSV()">
            <i class="bi bi-download"></i> 导出CSV
          </button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body">
          ${products.length > 0 ? `
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>商品名称</th>
                  <th>分类</th>
                  <th>单价</th>
                  <th>单位</th>
                  <th>库存</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(product => `
                  <tr>
                    <td><strong>${product.name}</strong></td>
                    <td><span class="badge bg-secondary">${product.category || '未分类'}</span></td>
                    <td class="fw-bold text-primary">${formatCurrency(product.price)}</td>
                    <td>${product.unit}</td>
                    <td>${product.stock_quantity}</td>
                    <td>
                      ${product.is_available ? 
                        '<span class="badge bg-success">在售</span>' : 
                        '<span class="badge bg-danger">下架</span>'}
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline-primary" onclick="editProduct('${product.id}')">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${product.id}', '${product.name}')">
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="empty-state">
              <i class="bi bi-box"></i>
              <p>暂无商品数据</p>
              <button class="btn btn-primary mt-2" onclick="openProductModal()">
                添加第一个商品
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> 加载商品失败: ${error.message}
      </div>
    `;
  }
}

function openProductModal(product = null) {
  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  const title = document.getElementById('productModalTitle');
  
  if (product) {
    title.textContent = '编辑商品';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category || '';
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-unit').value = product.unit;
    document.getElementById('product-stock').value = product.stock_quantity;
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-available').checked = product.is_available === 1;
  } else {
    title.textContent = '添加商品';
    document.getElementById('product-id').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-category').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-unit').value = '';
    document.getElementById('product-stock').value = 0;
    document.getElementById('product-description').value = '';
    document.getElementById('product-available').checked = true;
  }
  
  modal.show();
}

async function editProduct(id) {
  try {
    const response = await fetch(`${API_BASE}/products/${id}`);
    const product = await response.json();
    openProductModal(product);
  } catch (error) {
    alert('加载商品信息失败: ' + error.message);
  }
}

async function saveProduct() {
  const id = document.getElementById('product-id').value;
  const productData = {
    name: document.getElementById('product-name').value.trim(),
    category: document.getElementById('product-category').value,
    price: parseFloat(document.getElementById('product-price').value) || 0,
    unit: document.getElementById('product-unit').value.trim(),
    stock_quantity: parseInt(document.getElementById('product-stock').value) || 0,
    is_available: document.getElementById('product-available').checked ? 1 : 0,
    description: document.getElementById('product-description').value.trim()
  };

  if (!productData.name) {
    alert('请输入商品名称');
    return;
  }
  if (!productData.unit) {
    alert('请输入商品单位');
    return;
  }
  if (productData.price <= 0) {
    alert('请输入有效的商品价格');
    return;
  }

  try {
    let response;
    if (id) {
      response = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
    } else {
      response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
    }

    if (response.ok) {
      bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
      loadProducts();
      renderProducts();
    } else {
      const error = await response.json();
      alert('保存失败: ' + (error.error || '未知错误'));
    }
  } catch (error) {
    alert('保存失败: ' + error.message);
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`确定要删除商品 "${name}" 吗？`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      loadProducts();
      renderProducts();
    } else {
      const error = await response.json();
      alert('删除失败: ' + (error.error || '未知错误'));
    }
  } catch (error) {
    alert('删除失败: ' + error.message);
  }
}

async function exportProductsCSV() {
  window.open(`${API_BASE}/csv/products`, '_blank');
}

async function renderOrders() {
  const container = document.getElementById('app-content');
  
  try {
    const [ordersResponse, slotsResponse] = await Promise.all([
      fetch(`${API_BASE}/orders`),
      fetch(`${API_BASE}/pickup-slots?is_active=true`)
    ]);
    
    const orders = await ordersResponse.json();
    const slots = await slotsResponse.json();
    currentOrders = orders;

    container.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="bi bi-receipt"></i> 订单管理</h2>
          <p class="text-muted">录入用户订单，编辑订单信息，处理状态变更</p>
        </div>
        <div class="col-md-4 text-end">
          <button class="btn btn-primary" onclick="openOrderModal()">
            <i class="bi bi-plus-circle"></i> 新建订单
          </button>
          <button class="btn btn-outline-secondary ms-2" onclick="exportOrdersCSV()">
            <i class="bi bi-download"></i> 导出订单
          </button>
        </div>
      </div>
      
      <div class="filter-card">
        <div class="row">
          <div class="col-md-3">
            <label class="form-label">按状态筛选</label>
            <select class="form-select" id="filter-status" onchange="filterOrders()">
              <option value="">全部状态</option>
              <option value="pending">待付款</option>
              <option value="confirmed">已确认</option>
              <option value="needs_replacement">需替换</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">按取货时间筛选</label>
            <select class="form-select" id="filter-pickup" onchange="filterOrders()">
              <option value="">全部时间</option>
              ${slots.map(s => `<option value="${s.slot_time}">${s.slot_time}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-6 text-end">
            <label class="form-label">&nbsp;</label>
            <div>
              <button class="btn btn-outline-info" onclick="showImportModal()">
                <i class="bi bi-upload"></i> 导入CSV
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body" id="orders-table-container">
          ${renderOrdersTable(orders)}
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> 加载订单失败: ${error.message}
      </div>
    `;
  }
}

function renderOrdersTable(orders) {
  if (orders.length === 0) {
    return `
      <div class="empty-state">
        <i class="bi bi-inbox"></i>
        <p>暂无订单数据</p>
        <button class="btn btn-primary mt-2" onclick="openOrderModal()">
          创建第一个订单
        </button>
      </div>
    `;
  }

  return `
    <table class="table table-hover">
      <thead>
        <tr>
          <th>用户名</th>
          <th>联系电话</th>
          <th>取货时间</th>
          <th>商品数</th>
          <th>金额</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(order => `
          <tr>
            <td><strong>${order.user_name}</strong></td>
            <td>${order.user_phone || '-'}</td>
            <td>${order.pickup_time}</td>
            <td><span class="badge bg-secondary">${order.items ? order.items.length : '查看'}</span></td>
            <td class="fw-bold text-primary">${formatCurrency(order.total_amount)}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td>
              <button class="btn btn-sm btn-outline-info" onclick="viewOrder('${order.id}')" title="查看">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-sm btn-outline-primary" onclick="editOrder('${order.id}')" title="编辑">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder('${order.id}', '${order.user_name}')" title="删除">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterOrders() {
  const status = document.getElementById('filter-status').value;
  const pickup = document.getElementById('filter-pickup').value;
  
  let filtered = [...currentOrders];
  
  if (status) {
    filtered = filtered.filter(o => o.status === status);
  }
  if (pickup) {
    filtered = filtered.filter(o => o.pickup_time === pickup);
  }
  
  document.getElementById('orders-table-container').innerHTML = renderOrdersTable(filtered);
}

function openOrderModal(order = null) {
  const modal = new bootstrap.Modal(document.getElementById('orderModal'));
  const title = document.getElementById('orderModalTitle');
  currentOrderItems = [];
  
  if (order) {
    title.textContent = '编辑订单';
    document.getElementById('order-id').value = order.id;
    document.getElementById('order-username').value = order.user_name;
    document.getElementById('order-phone').value = order.user_phone || '';
    document.getElementById('order-pickup').value = order.pickup_time;
    document.getElementById('order-notes').value = order.notes || '';
    
    if (order.items) {
      currentOrderItems = order.items.map(item => ({
        ...item,
        tempId: item.id
      }));
    }
  } else {
    title.textContent = '新建订单';
    document.getElementById('order-id').value = '';
    document.getElementById('order-username').value = '';
    document.getElementById('order-phone').value = '';
    document.getElementById('order-pickup').value = '';
    document.getElementById('order-notes').value = '';
    currentOrderItems = [];
  }
  
  updateOrderItemsTable();
  loadPickupSlots();
  modal.show();
}

function addOrderItem() {
  if (currentProducts.length === 0) {
    alert('请先添加商品');
    return;
  }
  
  const product = currentProducts[0];
  currentOrderItems.push({
    tempId: 'temp_' + Date.now(),
    product_id: product.id,
    product_name: product.name,
    price: product.price,
    quantity: 1,
    subtotal: product.price * 1
  });
  
  updateOrderItemsTable();
}

function updateOrderItemsTable() {
  const tbody = document.getElementById('order-items-body');
  let total = 0;
  
  if (currentOrderItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">
          点击"添加商品"按钮添加订单项
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = currentOrderItems.map((item, index) => {
      const subtotal = item.price * item.quantity;
      total += subtotal;
      
      return `
        <tr>
          <td style="min-width: 200px;">
            <select class="form-select form-select-sm" onchange="changeProduct(${index}, this.value)">
              ${currentProducts.map(p => `
                <option value="${p.id}" ${p.id === item.product_id ? 'selected' : ''}>
                  ${p.name} - ¥${p.price}/${p.unit}
                </option>
              `).join('')}
            </select>
          </td>
          <td>
            <input type="number" step="0.01" min="0" class="form-control form-control-sm" 
                   value="${item.price}" onchange="changePrice(${index}, this.value)" style="width: 100px;">
          </td>
          <td>
            <input type="number" min="1" class="form-control form-control-sm" 
                   value="${item.quantity}" onchange="changeQuantity(${index}, this.value)" style="width: 80px;">
          </td>
          <td class="fw-bold">${formatCurrency(subtotal)}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="removeOrderItem(${index})">
              <i class="bi bi-x"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  document.getElementById('order-total').textContent = formatCurrency(total);
}

function changeProduct(index, productId) {
  const product = currentProducts.find(p => p.id === productId);
  if (product) {
    currentOrderItems[index].product_id = product.id;
    currentOrderItems[index].product_name = product.name;
    currentOrderItems[index].price = product.price;
    currentOrderItems[index].subtotal = product.price * currentOrderItems[index].quantity;
    updateOrderItemsTable();
  }
}

function changePrice(index, price) {
  currentOrderItems[index].price = parseFloat(price) || 0;
  currentOrderItems[index].subtotal = currentOrderItems[index].price * currentOrderItems[index].quantity;
  updateOrderItemsTable();
}

function changeQuantity(index, quantity) {
  currentOrderItems[index].quantity = parseInt(quantity) || 1;
  currentOrderItems[index].subtotal = currentOrderItems[index].price * currentOrderItems[index].quantity;
  updateOrderItemsTable();
}

function removeOrderItem(index) {
  currentOrderItems.splice(index, 1);
  updateOrderItemsTable();
}

async function viewOrder(id) {
  try {
    const response = await fetch(`${API_BASE}/orders/${id}`);
    const order = await response.json();
    
    const modalContent = `
      <div class="modal fade" id="viewOrderModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">订单详情 - ${order.user_name}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row mb-3">
                <div class="col-md-4">
                  <strong>用户名：</strong>${order.user_name}
                </div>
                <div class="col-md-4">
                  <strong>联系电话：</strong>${order.user_phone || '-'}
                </div>
                <div class="col-md-4">
                  <strong>取货时间：</strong>${order.pickup_time}
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>订单状态：</strong>${getStatusBadge(order.status)}
                </div>
                <div class="col-md-6">
                  <strong>订单金额：</strong><span class="fw-bold text-primary">${formatCurrency(order.total_amount)}</span>
                </div>
              </div>
              ${order.notes ? `<div class="mb-3"><strong>备注：</strong>${order.notes}</div>` : ''}
              
              <h6 class="border-bottom pb-2">订单项</h6>
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>商品名称</th>
                    <th>单价</th>
                    <th>数量</th>
                    <th>小计</th>
                    <th>替换状态</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.items.map(item => `
                    <tr>
                      <td>
                        ${item.replacement_status === 'confirmed' ? 
                          `<del class="text-muted">${item.product_name}</del><br><strong class="text-success">${item.replacement_product_name}</strong>` : 
                          item.product_name}
                      </td>
                      <td>
                        ${item.replacement_status === 'confirmed' ? 
                          `<del class="text-muted">${formatCurrency(item.price)}</del> ${formatCurrency(item.replacement_price)}` : 
                          formatCurrency(item.price)}
                      </td>
                      <td>${item.quantity}</td>
                      <td class="fw-bold">
                        ${item.replacement_status === 'confirmed' ? 
                          formatCurrency(item.replacement_price * item.quantity) : 
                          formatCurrency(item.subtotal)}
                      </td>
                      <td>
                        ${getReplacementBadge(item.replacement_status)}
                        ${item.replacement_status === 'pending' ? `
                          <button class="btn btn-sm btn-outline-warning ms-1" onclick="markOutOfStock('${order.id}', '${item.id}', '${item.product_name}', ${item.price})">
                            处理
                          </button>
                        ` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
              <button type="button" class="btn btn-primary" onclick="bootstrap.Modal.getInstance(document.getElementById('viewOrderModal')).hide(); editOrder('${order.id}')">
                编辑订单
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalContent;
    document.body.appendChild(tempDiv);
    
    const modal = new bootstrap.Modal(document.getElementById('viewOrderModal'));
    modal.show();
    
  } catch (error) {
    alert('加载订单详情失败: ' + error.message);
  }
}

async function editOrder(id) {
  try {
    const response = await fetch(`${API_BASE}/orders/${id}`);
    const order = await response.json();
    openOrderModal(order);
  } catch (error) {
    alert('加载订单信息失败: ' + error.message);
  }
}

async function saveOrder() {
  const id = document.getElementById('order-id').value;
  const orderData = {
    user_name: document.getElementById('order-username').value.trim(),
    user_phone: document.getElementById('order-phone').value.trim(),
    pickup_time: document.getElementById('order-pickup').value,
    notes: document.getElementById('order-notes').value.trim(),
    items: currentOrderItems.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      price: item.price,
      quantity: item.quantity,
      id: item.tempId && !item.tempId.startsWith('temp_') ? item.tempId : undefined
    }))
  };

  if (!orderData.user_name) {
    alert('请输入用户名');
    return;
  }
  if (!orderData.pickup_time) {
    alert('请选择取货时间');
    return;
  }
  if (orderData.items.length === 0) {
    alert('请至少添加一个商品');
    return;
  }

  try {
    let response;
    if (id) {
      response = await fetch(`${API_BASE}/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
    } else {
      response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
    }

    if (response.ok) {
      bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
      renderOrders();
    } else {
      const error = await response.json();
      alert('保存失败: ' + (error.error || '未知错误'));
    }
  } catch (error) {
    alert('保存失败: ' + error.message);
  }
}

async function deleteOrder(id, name) {
  if (!confirm(`确定要删除 "${name}" 的订单吗？`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      renderOrders();
    } else {
      const error = await response.json();
      alert('删除失败: ' + (error.error || '未知错误'));
    }
  } catch (error) {
    alert('删除失败: ' + error.message);
  }
}

async function exportOrdersCSV() {
  window.open(`${API_BASE}/csv/orders`, '_blank');
}

function showImportModal() {
  const modalContent = `
    <div class="modal fade" id="importModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">导入订单CSV</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <i class="bi bi-info-circle"></i> CSV文件需包含以下列：
              <br><small>用户名、联系电话、取货时间、商品名称、单价、数量、备注（可选）</small>
            </div>
            <div class="mb-3">
              <label class="form-label">选择CSV文件</label>
              <input type="file" class="form-control" id="import-csv-file" accept=".csv">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
            <button type="button" class="btn btn-primary" onclick="importOrdersCSV()">导入</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalContent;
  document.body.appendChild(tempDiv);
  
  const modal = new bootstrap.Modal(document.getElementById('importModal'));
  modal.show();
}

async function importOrdersCSV() {
  const fileInput = document.getElementById('import-csv-file');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('请选择CSV文件');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/csv/import/orders`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (response.ok) {
      bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
      alert(result.message);
      renderOrders();
    } else {
      alert('导入失败: ' + (result.error || result.message || '未知错误'));
    }
  } catch (error) {
    alert('导入失败: ' + error.message);
  }
}

async function renderReplacements() {
  const container = document.getElementById('app-content');
  
  try {
    const response = await fetch(`${API_BASE}/replacements/pending`);
    const pending = await response.json();
    
    updatePendingBadge();

    container.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-12">
          <h2><i class="bi bi-arrow-left-right"></i> 缺货替换处理</h2>
          <p class="text-muted">处理商品缺货情况，标记待确认替换，查看替换状态</p>
        </div>
      </div>
      
      ${pending.length > 0 ? `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i> 当前有 <strong>${pending.length}</strong> 个待确认的缺货替换
        </div>
        
        <div class="row">
          ${pending.map(rep => `
            <div class="col-md-6 mb-3">
              <div class="card">
                <div class="card-header bg-warning text-dark">
                  <div class="d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-bell"></i> 缺货通知</span>
                    <span class="badge bg-danger">待确认</span>
                  </div>
                </div>
                <div class="card-body">
                  <div class="row mb-2">
                    <div class="col-md-6">
                      <strong>用户：</strong>${rep.user_name}
                    </div>
                    <div class="col-md-6">
                      <strong>取货时间：</strong>${rep.pickup_time}
                    </div>
                  </div>
                  <div class="row mb-2">
                    <div class="col-md-6">
                      <strong>原商品：</strong><span class="text-danger">${rep.original_product_name}</span>
                    </div>
                    <div class="col-md-6">
                      <strong>数量：</strong>${rep.quantity}
                    </div>
                  </div>
                  ${rep.suggested_product_name ? `
                    <div class="alert alert-info">
                      <strong>推荐替换：</strong>${rep.suggested_product_name}
                      ${rep.price_difference !== null ? `
                        <br><small>差价：${rep.price_difference > 0 ? `用户需补 ¥${rep.price_difference}` : `退还用户 ¥${Math.abs(rep.price_difference)}`}</small>
                      ` : ''}
                    </div>
                  ` : ''}
                  ${rep.notes ? `<div class="mb-2"><small class="text-muted">${rep.notes}</small></div>` : ''}
                  
                  <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                    <button class="btn btn-success me-md-2" onclick="acceptReplacement('${rep.id}')">
                      <i class="bi bi-check-circle"></i> 接受替换
                    </button>
                    <button class="btn btn-danger" onclick="rejectReplacement('${rep.id}')">
                      <i class="bi bi-x-circle"></i> 拒绝/取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="card">
          <div class="card-body">
            <div class="empty-state">
              <i class="bi bi-check-circle-fill text-success"></i>
              <p>暂无待处理的缺货替换</p>
              <p class="text-muted">在订单详情中可以标记商品缺货</p>
            </div>
          </div>
        </div>
      `}
      
      <div class="card mt-4">
        <div class="card-header">
          <i class="bi bi-info-circle"></i> 如何标记缺货
        </div>
        <div class="card-body">
          <ol class="mb-0">
            <li>进入 <a href="#/orders" onclick="navigateTo('orders')">订单管理</a> 页面</li>
            <li>点击订单的"查看"按钮</li>
            <li>在订单详情中，点击订单项的"处理"按钮</li>
            <li>填写替换商品信息并确认</li>
          </ol>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> 加载替换数据失败: ${error.message}
      </div>
    `;
  }
}

function markOutOfStock(orderId, itemId, productName, originalPrice) {
  const modal = new bootstrap.Modal(document.getElementById('replacementModal'));
  
  document.getElementById('rep-order-item-id').value = itemId;
  document.getElementById('rep-original-product-id').value = '';
  document.getElementById('rep-original-product-name').value = productName;
  document.getElementById('rep-original-price').value = originalPrice;
  document.getElementById('rep-original-info').textContent = `${productName} - ¥${originalPrice}`;
  document.getElementById('rep-suggested-product').value = '';
  document.getElementById('rep-price-difference').value = '';
  document.getElementById('rep-notes').value = '';
  
  loadProducts();
  modal.show();
}

function updatePriceDifference() {
  const originalPrice = parseFloat(document.getElementById('rep-original-price').value) || 0;
  const select = document.getElementById('rep-suggested-product');
  const selectedOption = select.options[select.selectedIndex];
  
  if (selectedOption && selectedOption.value) {
    const suggestedPrice = parseFloat(selectedOption.dataset.price) || 0;
    const difference = suggestedPrice - originalPrice;
    document.getElementById('rep-price-difference').value = difference.toFixed(2);
  } else {
    document.getElementById('rep-price-difference').value = '';
  }
}

async function createReplacement() {
  const orderItemId = document.getElementById('rep-order-item-id').value;
  const originalProductName = document.getElementById('rep-original-product-name').value;
  const select = document.getElementById('rep-suggested-product');
  const selectedOption = select.options[select.selectedIndex];
  
  const data = {
    order_item_id: orderItemId,
    original_product_id: document.getElementById('rep-original-product-id').value || 'temp_' + Date.now(),
    original_product_name: originalProductName,
    suggested_product_id: selectedOption && selectedOption.value ? selectedOption.value : null,
    suggested_product_name: selectedOption && selectedOption.value ? selectedOption.text.split(' - ')[0] : null,
    price_difference: document.getElementById('rep-price-difference').value ? parseFloat(document.getElementById('rep-price-difference').value) : null,
    notes: document.getElementById('rep-notes').value
  };

  try {
    const response = await fetch(`${API_BASE}/replacements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      bootstrap.Modal.getInstance(document.getElementById('replacementModal')).hide();
      alert('已标记缺货，等待用户确认');
      updatePendingBadge();
      renderReplacements();
    } else {
      const error = await response.json();
      alert('创建替换失败: ' + (error.error || '未知错误'));
    }
  } catch (error) {
    alert('创建替换失败: ' + error.message);
  }
}

async function acceptReplacement(id) {
  if (!confirm('确定接受这个替换吗？订单金额将自动更新。')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/replacements/${id}/accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (response.ok) {
      alert('已确认替换，订单金额已更新');
      updatePendingBadge();
      renderReplacements();
    } else {
      const error = await response.json();
      alert('操作失败: ' + (error.error || '未知错误'));
    }
  } catch (error) {
    alert('操作失败: ' + error.message);
  }
}

async function rejectReplacement(id) {
  if (!confirm('确定拒绝/取消这个替换吗？该商品将保持原样或从订单中移除。')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/replacements/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (response.ok) {
      alert('已取消替换');
      updatePendingBadge();
      renderReplacements();
    } else {
      const error = await response.json();
      alert('操作失败: ' + (error.error || '未知错误'));
    }
  } catch (error) {
    alert('操作失败: ' + error.message);
  }
}

async function renderShipping() {
  const container = document.getElementById('app-content');
  
  try {
    const [ordersResponse, slotsResponse] = await Promise.all([
      fetch(`${API_BASE}/orders`),
      fetch(`${API_BASE}/pickup-slots?is_active=true`)
    ]);
    
    const orders = await ordersResponse.json();
    const slots = await slotsResponse.json();
    
    const ordersWithItems = [];
    for (const order of orders) {
      const detailResponse = await fetch(`${API_BASE}/orders/${order.id}`);
      const detail = await detailResponse.json();
      ordersWithItems.push(detail);
    }

    const grouped = {};
    ordersWithItems.forEach(order => {
      if (!grouped[order.pickup_time]) {
        grouped[order.pickup_time] = [];
      }
      grouped[order.pickup_time].push(order);
    });

    container.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="bi bi-truck"></i> 发货清单</h2>
          <p class="text-muted">按取货时间分组查看订单，可导出最终发货清单</p>
        </div>
        <div class="col-md-4 text-end">
          <select class="form-select d-inline-block" style="width: auto;" id="shipping-filter" onchange="filterShipping()">
            <option value="">全部取货时间</option>
            ${slots.map(s => `<option value="${s.slot_time}">${s.slot_time}</option>`).join('')}
          </select>
          <button class="btn btn-primary ms-2" onclick="exportShippingCSV()">
            <i class="bi bi-download"></i> 导出发货清单
          </button>
        </div>
      </div>
      
      <div id="shipping-content">
        ${Object.keys(grouped).length > 0 ? 
          Object.keys(grouped).sort().map(pickupTime => `
            <div class="pickup-group" data-pickup="${pickupTime}">
              <div class="pickup-group-header">
                <span><i class="bi bi-calendar-event"></i> ${pickupTime}</span>
                <span class="badge bg-light text-dark">${grouped[pickupTime].length} 个订单</span>
              </div>
              <div class="card mt-2">
                <div class="card-body p-0">
                  <div class="table-responsive">
                    <table class="table table-hover mb-0">
                      <thead class="table-light">
                        <tr>
                          <th>用户名</th>
                          <th>联系电话</th>
                          <th>商品</th>
                          <th>金额</th>
                          <th>状态</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${grouped[pickupTime].map(order => `
                          <tr>
                            <td><strong>${order.user_name}</strong></td>
                            <td>${order.user_phone || '-'}</td>
                            <td>
                              <ul class="list-unstyled mb-0">
                                ${order.items.map(item => `
                                  <li>
                                    ${item.replacement_status === 'confirmed' ? 
                                      `<del class="text-muted small">${item.product_name} x${item.quantity}</del><br><strong class="text-success">${item.replacement_product_name} x${item.quantity}</strong>` : 
                                      `${item.product_name} x${item.quantity}`}
                                    ${item.replacement_status === 'pending' ? 
                                      `<span class="badge bg-warning ms-1">待确认</span>` : ''}
                                  </li>
                                `).join('')}
                              </ul>
                            </td>
                            <td class="fw-bold text-primary">${formatCurrency(order.total_amount)}</td>
                            <td>${getStatusBadge(order.status)}</td>
                            <td class="text-muted small">${order.notes || '-'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          `).join('')
        : `
          <div class="card">
            <div class="card-body">
              <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <p>暂无订单数据</p>
              </div>
            </div>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> 加载发货清单失败: ${error.message}
      </div>
    `;
  }
}

function filterShipping() {
  const filter = document.getElementById('shipping-filter').value;
  const groups = document.querySelectorAll('.pickup-group');
  
  groups.forEach(group => {
    if (!filter || group.dataset.pickup === filter) {
      group.style.display = 'block';
    } else {
      group.style.display = 'none';
    }
  });
}

async function exportShippingCSV() {
  const filter = document.getElementById('shipping-filter')?.value || '';
  const url = filter ? 
    `${API_BASE}/csv/shipping-list?pickup_time=${encodeURIComponent(filter)}` : 
    `${API_BASE}/csv/shipping-list`;
  window.open(url, '_blank');
}

async function renderUsers() {
  const container = document.getElementById('app-content');
  
  try {
    const ordersResponse = await fetch(`${API_BASE}/orders`);
    const orders = await ordersResponse.json();
    
    const ordersWithItems = [];
    for (const order of orders) {
      const detailResponse = await fetch(`${API_BASE}/orders/${order.id}`);
      const detail = await detailResponse.json();
      ordersWithItems.push(detail);
    }

    const userOrders = {};
    ordersWithItems.forEach(order => {
      if (!userOrders[order.user_name]) {
        userOrders[order.user_name] = {
          name: order.user_name,
          phone: order.user_phone,
          orders: [],
          total_amount: 0,
          has_pending: false,
          has_replacement: false
        };
      }
      userOrders[order.user_name].orders.push(order);
      userOrders[order.user_name].total_amount += order.total_amount;
      
      if (order.status === 'pending') {
        userOrders[order.user_name].has_pending = true;
      }
      if (order.status === 'needs_replacement') {
        userOrders[order.user_name].has_replacement = true;
      }
    });

    const userList = Object.values(userOrders).sort((a, b) => {
      if (a.has_replacement !== b.has_replacement) return a.has_replacement ? -1 : 1;
      if (a.has_pending !== b.has_pending) return a.has_pending ? -1 : 1;
      return 0;
    });

    container.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-8">
          <h2><i class="bi bi-people"></i> 用户状态</h2>
          <p class="text-muted">查看每个用户的待付款、已确认、需替换状态</p>
        </div>
        <div class="col-md-4 text-end">
          <div class="btn-group" role="group">
            <span class="btn btn-outline-secondary disabled">状态说明：</span>
            <span class="btn btn-outline-danger">需替换</span>
            <span class="btn btn-outline-warning">待付款</span>
            <span class="btn btn-outline-success">已确认</span>
          </div>
        </div>
      </div>
      
      ${userList.length > 0 ? `
        <div class="row">
          ${userList.map(user => `
            <div class="col-md-6 mb-4">
              <div class="card user-card ${user.has_replacement ? 'status-needs-replacement' : user.has_pending ? '' : 'status-confirmed'}">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="mb-0">${user.name}</h5>
                    <small class="text-muted">${user.phone || '暂无电话'}</small>
                  </div>
                  <div>
                    ${user.has_replacement ? '<span class="status-badge status-needs-replacement">需替换</span>' : ''}
                    ${user.has_pending && !user.has_replacement ? '<span class="status-badge status-pending">待付款</span>' : ''}
                    ${!user.has_pending && !user.has_replacement ? '<span class="status-badge status-confirmed">已确认</span>' : ''}
                  </div>
                </div>
                <div class="card-body">
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <div class="text-muted small">订单数</div>
                      <div class="fw-bold">${user.orders.length} 单</div>
                    </div>
                    <div class="col-md-6">
                      <div class="text-muted small">总金额</div>
                      <div class="fw-bold text-primary">${formatCurrency(user.total_amount)}</div>
                    </div>
                  </div>
                  
                  <h6 class="border-bottom pb-2 mb-2">订单详情</h6>
                  ${user.orders.map(order => `
                    <div class="mb-2 p-2 rounded" style="background-color: #f8f9fa;">
                      <div class="d-flex justify-content-between align-items-start">
                        <div>
                          <small class="text-muted">${order.pickup_time}</small>
                          <ul class="list-unstyled mb-0 mt-1">
                            ${order.items.slice(0, 3).map(item => `
                              <li class="small">
                                ${item.replacement_status === 'confirmed' ? 
                                  `<del class="text-muted">${item.product_name}</del> → <span class="text-success">${item.replacement_product_name}</span>` : 
                                  item.product_name}
                                x${item.quantity}
                                ${item.replacement_status === 'pending' ? 
                                  '<span class="badge bg-warning text-dark">待确认</span>' : ''}
                              </li>
                            `).join('')}
                            ${order.items.length > 3 ? `<li class="small text-muted">... 还有 ${order.items.length - 3} 项</li>` : ''}
                          </ul>
                        </div>
                        <div class="text-end">
                          ${getStatusBadge(order.status)}
                          <div class="fw-bold text-primary mt-1">${formatCurrency(order.total_amount)}</div>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="card">
          <div class="card-body">
            <div class="empty-state">
              <i class="bi bi-people"></i>
              <p>暂无用户数据</p>
            </div>
          </div>
        </div>
      `}
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> 加载用户状态失败: ${error.message}
      </div>
    `;
  }
}
