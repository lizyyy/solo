const API_BASE = '';

let orders = [];
let inventory = [];
let reviews = [];
let currentTab = 'orders';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

async function initApp() {
  try {
    await Promise.all([
      fetchOrders(),
      fetchInventory(),
      fetchReviews()
    ]);
    renderOrders();
    renderInventory();
    renderReviews();
    populateSelects();
  } catch (error) {
    console.error('初始化失败:', error);
    showToast('初始化失败，请刷新页面重试', 'error');
  }
}

function setupEventListeners() {
  document.getElementById('add-order-form').addEventListener('submit', handleAddOrder);
  document.getElementById('add-inventory-form').addEventListener('submit', handleAddInventory);
  document.getElementById('manual-status-form').addEventListener('submit', handleManualStatus);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

// API 调用函数
async function fetchOrders() {
  const response = await fetch(`${API_BASE}/api/orders`);
  orders = await response.json();
}

async function fetchInventory() {
  const response = await fetch(`${API_BASE}/api/inventory`);
  inventory = await response.json();
}

async function fetchReviews() {
  const response = await fetch(`${API_BASE}/api/reviews`);
  reviews = await response.json();
}

// 渲染函数
function renderOrders() {
  const grid = document.getElementById('orders-grid');
  const statusFilter = document.getElementById('status-filter').value;
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  
  let filteredOrders = orders;
  
  if (statusFilter) {
    filteredOrders = filteredOrders.filter(order => order.finalStatus === statusFilter);
  }
  
  if (searchQuery) {
    filteredOrders = filteredOrders.filter(order => {
      return (
        order.customerName?.toLowerCase().includes(searchQuery) ||
        order.id.toLowerCase().includes(searchQuery) ||
        order.customerPhone?.includes(searchQuery)
      );
    });
  }
  
  if (filteredOrders.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">暂无订单数据</div>
        <p style="margin-top: 0.5rem; font-size: 0.875rem;">点击"新建订单"或"初始化示例数据"开始</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filteredOrders.map(order => createOrderCard(order)).join('');
}

function createOrderCard(order) {
  const statusConfig = {
    ready: { label: '可开工', class: 'status-ready', icon: '✅' },
    needs_material: { label: '需补料', class: 'status-needs_material', icon: '⚠️' },
    needs_communication: { label: '需返沟通', class: 'status-needs_communication', icon: '❌' }
  };
  
  const status = statusConfig[order.finalStatus] || { label: '未知', class: '', icon: '?' };
  
  const issuesCount = order.analysis?.issues?.length || 0;
  const warningsCount = order.analysis?.warnings?.length || 0;
  
  const deadline = new Date(order.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  
  let deadlineClass = '';
  let deadlineText = order.deadline;
  
  if (daysToDeadline < 0) {
    deadlineClass = 'deadline-urgent';
    deadlineText = `已过期 ${Math.abs(daysToDeadline)} 天`;
  } else if (daysToDeadline <= 3) {
    deadlineClass = 'deadline-warning';
    deadlineText = `剩余 ${daysToDeadline} 天`;
  }
  
  return `
    <div class="order-card" onclick="showOrderDetail('${order.id}')">
      <div class="order-card-header">
        <div>
          <div class="order-customer">${order.customerName || '未命名'}</div>
          <div class="order-id">${order.id.substring(0, 12)}...</div>
        </div>
        <span class="order-status ${status.class}">
          ${status.icon} ${status.label}
        </span>
      </div>
      <div class="order-card-body">
        <div class="order-info-row">
          <span class="order-info-label">发丝批次</span>
          <span class="order-info-value">${order.hairBatch || '-'}</span>
        </div>
        <div class="order-info-row">
          <span class="order-info-label">蕾丝网底</span>
          <span class="order-info-value">${order.laceNetSku || '-'}</span>
        </div>
        <div class="order-info-row">
          <span class="order-info-label">头围范围</span>
          <span class="order-info-value">
            ${order.headCircumference ? `${order.headCircumference.min}-${order.headCircumference.max}cm` : '-'}
          </span>
        </div>
        <div class="order-deadline">
          <span class="order-info-label">发货期限</span>
          <span class="order-info-value ${deadlineClass}">${deadlineText}</span>
        </div>
      </div>
      <div class="order-card-footer">
        ${issuesCount > 0 ? `<span class="issues-badge issues-count">${issuesCount} 个问题</span>` : ''}
        ${warningsCount > 0 ? `<span class="issues-badge warnings-count">${warningsCount} 个警告</span>` : ''}
        ${order.manualOverride ? '<span style="font-size: 0.7rem; color: var(--warning-color);">🔧 已人工改判</span>' : ''}
      </div>
    </div>
  `;
}

function renderInventory() {
  const hairBatches = inventory.filter(item => item.type === 'hair_batch');
  const laceNets = inventory.filter(item => item.type === 'lace_net');
  
  const hairList = document.getElementById('hair-batches-list');
  const laceList = document.getElementById('lace-nets-list');
  
  if (hairBatches.length === 0) {
    hairList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">暂无发丝批次</div>
      </div>
    `;
  } else {
    hairList.innerHTML = hairBatches.map(item => `
      <div class="inventory-item">
        <div class="inventory-item-header">
          <span class="inventory-item-name">${item.name || item.batchNumber}</span>
          <span class="inventory-item-sku">${item.batchNumber}</span>
        </div>
        <div class="inventory-item-details">
          <span>颜色: ${item.color || '-'}</span>
          <span>支持染色: ${item.colorCurves?.join(', ') || '无'}</span>
          <span class="inventory-quantity">数量: ${item.quantity} ${item.unit || 'g'}</span>
        </div>
      </div>
    `).join('');
  }
  
  if (laceNets.length === 0) {
    laceList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">暂无蕾丝网底</div>
      </div>
    `;
  } else {
    laceList.innerHTML = laceNets.map(item => `
      <div class="inventory-item">
        <div class="inventory-item-header">
          <span class="inventory-item-name">${item.name || item.sku}</span>
          <span class="inventory-item-sku">${item.sku}</span>
        </div>
        <div class="inventory-item-details">
          <span>材质: ${item.material || '-'}</span>
          <span>尺寸: ${item.size || '-'}</span>
          <span>颜色: ${item.color || '-'}</span>
          <span class="inventory-quantity">数量: ${item.quantity} ${item.unit || '片'}</span>
        </div>
      </div>
    `).join('');
  }
}

function renderReviews() {
  const list = document.getElementById('reviews-list');
  
  if (reviews.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">暂无复核记录</div>
      </div>
    `;
    return;
  }
  
  const statusLabels = {
    ready: '✅ 可开工',
    needs_material: '⚠️ 需补料',
    needs_communication: '❌ 需返沟通'
  };
  
  list.innerHTML = reviews.slice().reverse().map(review => `
    <div class="review-item">
      <div class="review-header">
        <div class="review-status-change">
          <span>${statusLabels[review.previousStatus] || review.previousStatus}</span>
          <span class="review-arrow">→</span>
          <span>${statusLabels[review.newStatus] || review.newStatus}</span>
        </div>
        <span class="review-time">${new Date(review.createdAt).toLocaleString('zh-CN')}</span>
      </div>
      <div class="inventory-item-details">
        <span>订单ID: ${review.orderId.substring(0, 12)}...</span>
      </div>
      ${review.note ? `<div class="review-note">${review.note}</div>` : ''}
    </div>
  `).join('');
}

function populateSelects() {
  const hairSelect = document.getElementById('hairBatch');
  const laceSelect = document.getElementById('laceNetSku');
  
  const hairBatches = inventory.filter(item => item.type === 'hair_batch');
  const laceNets = inventory.filter(item => item.type === 'lace_net');
  
  hairSelect.innerHTML = '<option value="">请选择发丝批次</option>' +
    hairBatches.map(item => `<option value="${item.batchNumber}">${item.name || item.batchNumber} (${item.quantity}g)</option>`).join('');
  
  laceSelect.innerHTML = '<option value="">请选择蕾丝网底</option>' +
    laceNets.map(item => `<option value="${item.sku}">${item.name || item.sku} (${item.quantity}片)</option>`).join('');
}

// 事件处理函数
async function handleAddOrder(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  
  const headMoldMeasurements = {};
  const frontBack = formData.get('headMoldFrontBack');
  const leftRight = formData.get('headMoldLeftRight');
  const earDistance = formData.get('headMoldEarDistance');
  
  if (frontBack) headMoldMeasurements['前后径'] = parseFloat(frontBack);
  if (leftRight) headMoldMeasurements['左右径'] = parseFloat(leftRight);
  if (earDistance) headMoldMeasurements['耳上距'] = parseFloat(earDistance);
  
  const fittingPhotos = [];
  const photoUrls = formData.get('fittingPhotos');
  const photoNotes = formData.get('fittingNotes');
  
  if (photoUrls) {
    const urls = photoUrls.split(',').map(url => url.trim()).filter(Boolean);
    urls.forEach(url => {
      fittingPhotos.push({
        url,
        note: photoNotes || ''
      });
    });
  }
  
  const orderData = {
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone') || null,
    headCircumference: {
      min: parseFloat(formData.get('headCircumferenceMin')),
      max: parseFloat(formData.get('headCircumferenceMax'))
    },
    headMoldMeasurements: Object.keys(headMoldMeasurements).length > 0 ? headMoldMeasurements : null,
    hairBatch: formData.get('hairBatch'),
    hairQuantity: parseFloat(formData.get('hairQuantity')),
    colorCurve: formData.get('colorCurve') || null,
    laceNetSku: formData.get('laceNetSku'),
    laceNetQuantity: parseInt(formData.get('laceNetQuantity')),
    deadline: formData.get('deadline'),
    fittingPhotos: fittingPhotos.length > 0 ? fittingPhotos : [],
    notes: formData.get('notes') || null
  };
  
  try {
    const response = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) {
      throw new Error('创建订单失败');
    }
    
    await fetchOrders();
    renderOrders();
    closeModal('add-order-modal');
    e.target.reset();
    showToast('订单创建成功', 'success');
  } catch (error) {
    console.error('创建订单失败:', error);
    showToast('创建订单失败: ' + error.message, 'error');
  }
}

async function handleAddInventory(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const type = formData.get('inventoryType');
  
  let inventoryData = {};
  
  if (type === 'hair_batch') {
    const colorCurves = [];
    document.querySelectorAll('input[name="colorCurves"]:checked').forEach(cb => {
      colorCurves.push(cb.value);
    });
    
    inventoryData = {
      type: 'hair_batch',
      batchNumber: formData.get('hairBatchNumber'),
      name: formData.get('hairName'),
      color: formData.get('hairColor') || null,
      colorCurves: colorCurves.length > 0 ? colorCurves : [],
      quantity: parseFloat(formData.get('hairQuantityInventory')),
      unit: 'g',
      supplier: formData.get('hairSupplier') || null
    };
  } else if (type === 'lace_net') {
    inventoryData = {
      type: 'lace_net',
      sku: formData.get('laceSku'),
      name: formData.get('laceName'),
      material: formData.get('laceMaterial') || null,
      size: formData.get('laceSize') || null,
      color: formData.get('laceColor') || null,
      quantity: parseFloat(formData.get('laceQuantity')),
      unit: '片',
      supplier: formData.get('laceSupplier') || null
    };
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inventoryData)
    });
    
    if (!response.ok) {
      throw new Error('添加库存失败');
    }
    
    await fetchInventory();
    renderInventory();
    populateSelects();
    closeModal('add-inventory-modal');
    e.target.reset();
    toggleInventoryFields();
    showToast('库存添加成功', 'success');
  } catch (error) {
    console.error('添加库存失败:', error);
    showToast('添加库存失败: ' + error.message, 'error');
  }
}

async function handleManualStatus(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const orderId = formData.get('orderId');
  const status = formData.get('manualStatus');
  const note = formData.get('manualNote');
  
  try {
    const response = await fetch(`${API_BASE}/api/orders/${orderId}/manual-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note })
    });
    
    if (!response.ok) {
      throw new Error('改判状态失败');
    }
    
    await Promise.all([
      fetchOrders(),
      fetchReviews()
    ]);
    
    renderOrders();
    renderReviews();
    closeModal('manual-status-modal');
    closeModal('order-detail-modal');
    e.target.reset();
    showToast('状态改判成功', 'success');
  } catch (error) {
    console.error('改判状态失败:', error);
    showToast('改判失败: ' + error.message, 'error');
  }
}

// 模态框函数
function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal.active').forEach(modal => {
    modal.classList.remove('active');
  });
}

function showAddOrderModal() {
  populateSelects();
  showModal('add-order-modal');
}

function showAddInventoryModal() {
  showModal('add-inventory-modal');
}

function showManualStatusModal(orderId) {
  document.getElementById('manualOrderId').value = orderId;
  document.getElementById('manualStatus').value = '';
  document.getElementById('manualNote').value = '';
  showModal('manual-status-modal');
}

function showOrderDetail(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  
  const orderReviews = reviews.filter(r => r.orderId === orderId);
  
  const statusConfig = {
    ready: { label: '可开工', class: 'status-ready', icon: '✅' },
    needs_material: { label: '需补料', class: 'status-needs_material', icon: '⚠️' },
    needs_communication: { label: '需返沟通', class: 'status-needs_communication', icon: '❌' }
  };
  
  const status = statusConfig[order.finalStatus] || { label: '未知', class: '', icon: '?' };
  const sysStatus = statusConfig[order.analysis?.status] || { label: '未知', class: '', icon: '?' };
  
  let detailHtml = `
    <div style="padding: 0 1.5rem 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
        <div>
          <h3 style="font-size: 1.25rem; font-weight: 600;">${order.customerName || '未命名订单'}</h3>
          <p style="font-size: 0.875rem; color: var(--text-secondary); font-family: 'SF Mono', Monaco, monospace;">${order.id}</p>
        </div>
        <span class="order-status ${status.class}" style="font-size: 0.875rem;">
          ${status.icon} ${status.label}
        </span>
      </div>
      
      <div class="order-detail-section">
        <h3>📋 基本信息</h3>
        <div class="order-detail-grid">
          <div class="order-detail-item">
            <div class="order-detail-label">客户姓名</div>
            <div class="order-detail-value">${order.customerName || '-'}</div>
          </div>
          <div class="order-detail-item">
            <div class="order-detail-label">联系电话</div>
            <div class="order-detail-value">${order.customerPhone || '-'}</div>
          </div>
          <div class="order-detail-item">
            <div class="order-detail-label">创建时间</div>
            <div class="order-detail-value">${order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '-'}</div>
          </div>
          <div class="order-detail-item">
            <div class="order-detail-label">发货期限</div>
            <div class="order-detail-value">${order.deadline || '-'}</div>
          </div>
        </div>
      </div>
      
      <div class="order-detail-section">
        <h3>📏 尺寸信息</h3>
        <div class="order-detail-grid">
          <div class="order-detail-item">
            <div class="order-detail-label">头围范围</div>
            <div class="order-detail-value">
              ${order.headCircumference ? `${order.headCircumference.min} - ${order.headCircumference.max} cm` : '-'}
            </div>
          </div>
          ${order.headMoldMeasurements ? Object.entries(order.headMoldMeasurements).map(([key, value]) => `
            <div class="order-detail-item">
              <div class="order-detail-label">头模 ${key}</div>
              <div class="order-detail-value">${value} cm</div>
            </div>
          `).join('') : ''}
        </div>
      </div>
      
      <div class="order-detail-section">
        <h3>🧵 产品规格</h3>
        <div class="order-detail-grid">
          <div class="order-detail-item">
            <div class="order-detail-label">发丝批次</div>
            <div class="order-detail-value">${order.hairBatch || '-'}</div>
          </div>
          <div class="order-detail-item">
            <div class="order-detail-label">发丝数量</div>
            <div class="order-detail-value">${order.hairQuantity || '-'} g</div>
          </div>
          <div class="order-detail-item">
            <div class="order-detail-label">染色曲线</div>
            <div class="order-detail-value">${order.colorCurve || '-'}</div>
          </div>
          <div class="order-detail-item">
            <div class="order-detail-label">蕾丝网底</div>
            <div class="order-detail-value">${order.laceNetSku || '-'}</div>
          </div>
          <div class="order-detail-item">
            <div class="order-detail-label">网底数量</div>
            <div class="order-detail-value">${order.laceNetQuantity || '-'} 片</div>
          </div>
        </div>
      </div>
      
      ${order.notes || order.fittingPhotos?.length > 0 ? `
      <div class="order-detail-section">
        <h3>📝 备注信息</h3>
        ${order.notes ? `
          <div style="padding: 0.75rem; background-color: #f8fafc; border-radius: var(--radius); font-size: 0.875rem;">
            ${order.notes}
          </div>
        ` : ''}
        ${order.fittingPhotos?.length > 0 ? `
          <div style="margin-top: 0.75rem;">
            <div style="font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">试戴照片:</div>
            ${order.fittingPhotos.map((photo, index) => `
              <div style="padding: 0.5rem; background-color: #f8fafc; border-radius: var(--radius); font-size: 0.8125rem; margin-bottom: 0.25rem;">
                ${index + 1}. ${photo.url}
                ${photo.note ? `<span style="color: var(--text-secondary);"> (${photo.note})</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      ` : ''}
      
      <div class="order-detail-section">
        <h3>🔍 状态分析</h3>
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
          <div style="font-size: 0.875rem;">
            <span style="color: var(--text-secondary);">系统判定: </span>
            <span class="order-status ${sysStatus.class}" style="font-size: 0.75rem;">
              ${sysStatus.icon} ${sysStatus.label}
            </span>
          </div>
          <div style="font-size: 0.875rem;">
            <span style="color: var(--text-secondary);">能否开工: </span>
            <span style="font-weight: 600; color: ${order.analysis?.canStart ? 'var(--success-color)' : 'var(--danger-color)'};">
              ${order.analysis?.canStart ? '✅ 是' : '❌ 否'}
            </span>
          </div>
        </div>
        
        ${order.analysis?.issues?.length > 0 ? `
          <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.8125rem; font-weight: 600; color: var(--danger-color); margin-bottom: 0.5rem;">
              ❌ 问题列表 (${order.analysis.issues.length}个):
            </div>
            <div class="issues-list">
              ${order.analysis.issues.map(issue => `
                <div class="issue-item">
                  <span class="issue-icon">✗</span>
                  <div>
                    <div style="font-weight: 600;">[${issue.category}]</div>
                    <div>${issue.message}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${order.analysis?.warnings?.length > 0 ? `
          <div>
            <div style="font-size: 0.8125rem; font-weight: 600; color: var(--warning-color); margin-bottom: 0.5rem;">
              ⚠️ 警告列表 (${order.analysis.warnings.length}个):
            </div>
            <div class="warnings-list">
              ${order.analysis.warnings.map(warning => `
                <div class="warning-item">
                  <span class="warning-icon">!</span>
                  <div>
                    <div style="font-weight: 600;">[${warning.category}]</div>
                    <div>${warning.message}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      
      ${order.manualOverride ? `
        <div class="order-detail-section">
          <h3>🔧 人工改判记录</h3>
          <div class="override-info">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <div>
                <span class="override-label">改判为:</span>
                <span class="order-status ${statusConfig[order.manualOverride.status]?.class || ''}" style="font-size: 0.75rem;">
                  ${statusConfig[order.manualOverride.status]?.icon || ''} ${statusConfig[order.manualOverride.status]?.label || order.manualOverride.status}
                </span>
              </div>
              <span class="override-label">${new Date(order.manualOverride.at).toLocaleString('zh-CN')}</span>
            </div>
            ${order.manualOverride.note ? `
              <div class="override-label" style="margin-top: 0.5rem;">改判备注:</div>
              <div class="override-value">${order.manualOverride.note}</div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${orderReviews.length > 0 ? `
        <div class="order-detail-section">
          <h3>📜 复核历史 (${orderReviews.length}条)</h3>
          ${orderReviews.slice().reverse().map((review, index) => `
            <div style="padding: 0.75rem; background-color: #f8fafc; border-radius: var(--radius); margin-bottom: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <div style="font-size: 0.8125rem;">
                  ${statusConfig[review.previousStatus]?.label || review.previousStatus}
                  <span style="color: var(--text-secondary); margin: 0 0.5rem;">→</span>
                  ${statusConfig[review.newStatus]?.label || review.newStatus}
                </div>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">
                  ${new Date(review.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              ${review.note ? `<div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.25rem;">备注: ${review.note}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="detail-actions">
        <button class="btn btn-primary" onclick="showManualStatusModal('${order.id}')">
          🔧 人工改判
        </button>
        <button class="btn btn-success" onclick="exportMarkdown('${order.id}')">
          📄 导出 Markdown
        </button>
        <button class="btn btn-warning" onclick="exportJSON('${order.id}')">
          📊 导出 JSON
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('order-detail-content').innerHTML = detailHtml;
  showModal('order-detail-modal');
}

// 切换函数
function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

function filterOrders() {
  renderOrders();
}

function toggleInventoryFields() {
  const type = document.getElementById('inventoryType').value;
  document.getElementById('hair-fields').style.display = type === 'hair_batch' ? 'block' : 'none';
  document.getElementById('lace-fields').style.display = type === 'lace_net' ? 'block' : 'none';
}

// 导出函数
function exportMarkdown(orderId) {
  window.open(`${API_BASE}/api/export/markdown/${orderId}`, '_blank');
}

function exportJSON(orderId) {
  window.open(`${API_BASE}/api/export/json/${orderId}`, '_blank');
}

// 初始化示例数据
async function initSampleData() {
  try {
    const response = await fetch(`${API_BASE}/api/init-sample-data`);
    const result = await response.json();
    
    await Promise.all([
      fetchOrders(),
      fetchInventory()
    ]);
    
    renderOrders();
    renderInventory();
    populateSelects();
    
    showToast(`示例数据初始化成功: ${result.ordersCount} 个订单, ${result.inventoryCount} 个库存项`, 'success');
  } catch (error) {
    console.error('初始化示例数据失败:', error);
    showToast('初始化失败: ' + error.message, 'error');
  }
}

// Toast 提示
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
