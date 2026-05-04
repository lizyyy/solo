const API_BASE = '/api';

let currentOrderId = null;
let orderItems = [];

const statusMap = {
    'draft': '草稿',
    'quoted': '已报价',
    'confirmed': '已确认',
    'in_production': '生产中',
    'completed': '已完成',
    'cancelled': '已取消'
};

const paperTypeMap = {
    'coated': '铜版纸',
    'uncoated': '胶版纸',
    'art': '特种纸',
    'cardboard': '卡纸',
    'other': '其他'
};

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(title, body, footer = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${viewName}-view`).classList.add('active');
    document.querySelector(`.nav-btn[data-view="${viewName}"]`).classList.add('active');
}

function formatCurrency(amount) {
    if (amount == null) return '¥0.00';
    return `¥${parseFloat(amount).toFixed(2)}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
}

function getStatusBadgeClass(status) {
    const classMap = {
        'draft': 'status-draft',
        'quoted': 'status-quoted',
        'confirmed': 'status-confirmed',
        'in_production': 'status-in_production',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classMap[status] || '';
}

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function loadOrders() {
    const tbody = document.getElementById('orders-table-body');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">加载中...</td></tr>';
    
    try {
        const orders = await apiRequest('/orders');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无订单</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td><strong>${order.order_number}</strong></td>
                <td>${order.customer_name || '-'}</td>
                <td><span class="status-badge ${getStatusBadgeClass(order.status)}">${statusMap[order.status] || order.status}</span></td>
                <td>${order.is_urgent ? '<span style="color: #ef4444; font-weight: bold;">是</span>' : '否'}</td>
                <td class="price-highlight">${formatCurrency(order.final_amount || order.total_amount)}</td>
                <td>${formatDateTime(order.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary" onclick="viewOrder(${order.id})">查看</button>
                        ${order.status === 'draft' ? `<button class="btn btn-danger" onclick="deleteOrder(${order.id})">删除</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">加载失败: ${error.message}</td></tr>`;
    }
}

async function loadStock() {
    const tbody = document.getElementById('stock-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">加载中...</td></tr>';
    
    try {
        const stocks = await apiRequest('/stocks');
        
        if (stocks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无库存数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = stocks.map(stock => `
            <tr>
                <td><strong>${stock.spec_name || '-'}</strong></td>
                <td>${stock.spec_width}x${stock.spec_height}</td>
                <td>${paperTypeMap[stock.paper_type] || stock.paper_type}</td>
                <td>${stock.weight}g</td>
                <td>${stock.color}</td>
                <td>${formatCurrency(stock.unit_price)}</td>
                <td class="${stock.is_low_stock ? 'stock-low' : ''}">${stock.quantity}</td>
                <td>
                    ${stock.is_low_stock ? '<span class="status-badge status-cancelled">库存不足</span>' : 
                      '<span class="status-badge status-confirmed">正常</span>'}
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">加载失败: ${error.message}</td></tr>`;
    }
}

async function viewOrder(orderId) {
    currentOrderId = orderId;
    
    try {
        const order = await apiRequest(`/orders/${orderId}`);
        
        document.getElementById('detail-order-number').textContent = order.order_number;
        const badge = document.getElementById('detail-status-badge');
        badge.className = `order-status-badge status-badge ${getStatusBadgeClass(order.status)}`;
        badge.textContent = statusMap[order.status] || order.status;
        
        const content = document.getElementById('order-detail-content');
        
        let itemsHtml = '';
        if (order.items && order.items.length > 0) {
            itemsHtml = order.items.map(item => `
                <div class="plan-card">
                    <div class="plan-header">
                        <div class="plan-name">${item.product_name}</div>
                    </div>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="label">成品尺寸</span>
                            <span class="value">${item.finished_width}x${item.finished_height}${item.unit}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">数量</span>
                            <span class="value">${item.quantity}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">纸张要求</span>
                            <span class="value">${paperTypeMap[item.paper_type] || item.paper_type} ${item.paper_weight || '-'}g ${item.paper_color}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">纹理方向</span>
                            <span class="value">${item.grain_direction_display}</span>
                        </div>
                    </div>
                    ${order.status === 'draft' ? `
                        <div class="form-actions" style="margin-top: 12px;">
                            <button class="btn btn-primary" onclick="calculateItemPlan(${order.id}, ${item.id})">计算裁切方案</button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
        
        let plansHtml = '';
        if (order.cutting_plans && order.cutting_plans.length > 0) {
            plansHtml = order.cutting_plans.map(plan => `
                <div class="plan-card ${plan.has_shortage ? 'shortage' : 'best'}">
                    <div class="plan-header">
                        <div class="plan-name">裁切方案: ${plan.sheet_name}</div>
                        <div class="plan-metrics">
                            <span class="efficiency-badge ${plan.best_efficiency < 0.7 ? 'low' : ''}">利用率: ${(plan.best_efficiency * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    ${plan.has_shortage ? `
                        <div class="risk-warning shortage-warning">
                            <strong>⚠️ 库存不足</strong>：需要 ${plan.sheets_needed} 张，库存 ${plan.sheets_available} 张，缺纸 ${plan.sheets_shortage} 张
                        </div>
                    ` : ''}
                    ${plan.risk_warnings && plan.risk_warnings.length > 0 ? plan.risk_warnings.map(w => `
                        <div class="risk-warning">
                            <strong>⚠️ 风险提示</strong>：${w.message || w}
                        </div>
                    `).join('') : ''}
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="label">纸张规格</span>
                            <span class="value">${plan.sheet_name} (${plan.sheet_width}x${plan.sheet_height}mm)</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">需要纸张</span>
                            <span class="value">${plan.sheets_needed} 张</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">库存可用</span>
                            <span class="value">${plan.sheets_available} 张</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">浪费率</span>
                            <span class="value">${(plan.total_waste_percent * 100).toFixed(1)}%</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">材料成本</span>
                            <span class="value">${formatCurrency(plan.material_cost)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">人工成本</span>
                            <span class="value">${formatCurrency(plan.labor_cost)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">加急费</span>
                            <span class="value">${formatCurrency(plan.urgent_surcharge)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">报价</span>
                            <span class="value price-highlight">${formatCurrency(plan.quoted_price)}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        content.innerHTML = `
            <div class="detail-section">
                <h4>基本信息</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">客户名称</span>
                        <span class="value">${order.customer_name || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">联系电话</span>
                        <span class="value">${order.customer_phone || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">公司名称</span>
                        <span class="value">${order.customer_company || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">加急订单</span>
                        <span class="value">${order.is_urgent ? '是' : '否'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">要求交货日期</span>
                        <span class="value">${formatDate(order.required_date)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">创建时间</span>
                        <span class="value">${formatDateTime(order.created_at)}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>订单项</h4>
                ${itemsHtml || '<div class="empty-state">暂无订单项</div>'}
            </div>
            
            ${plansHtml ? `
                <div class="detail-section">
                    <h4>裁切方案</h4>
                    ${plansHtml}
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4>费用汇总</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">订单总额</span>
                        <span class="value">${formatCurrency(order.total_amount)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">折扣</span>
                        <span class="value">${order.discount_percent || 0}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">折扣金额</span>
                        <span class="value">${formatCurrency(order.discount_amount)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">最终金额</span>
                        <span class="value price-highlight">${formatCurrency(order.final_amount || order.total_amount)}</span>
                    </div>
                </div>
            </div>
            
            ${order.notes ? `
                <div class="detail-section">
                    <h4>备注</h4>
                    <p>${order.notes}</p>
                </div>
            ` : ''}
            
            <div class="form-actions">
                ${order.status === 'draft' && order.cutting_plans && order.cutting_plans.length > 0 ? `
                    <button class="btn btn-success" onclick="confirmOrder(${order.id})">确认订单</button>
                ` : ''}
                <button class="btn btn-secondary" onclick="exportQuotation(${order.id})">导出报价单</button>
                ${order.cutting_plans && order.cutting_plans.length > 0 ? `
                    <button class="btn btn-secondary" onclick="exportMaterials(${order.id})">导出备料单</button>
                ` : ''}
            </div>
        `;
        
        switchView('order-detail');
        
    } catch (error) {
        showToast('加载订单详情失败: ' + error.message, 'error');
    }
}

async function calculateItemPlan(orderId, itemId) {
    try {
        showModal('选择纸张规格', `
            <p style="margin-bottom: 16px;">请选择要使用的纸张规格，系统将自动计算最优裁切方案。</p>
            <div id="paper-options" style="max-height: 400px; overflow-y: auto;">
                <p class="loading">加载中...</p>
            </div>
        `);
        
        const stocks = await apiRequest('/stocks');
        
        const optionsHtml = stocks.map(stock => `
            <div class="plan-card" style="cursor: pointer;" onclick="selectStock(${orderId}, ${itemId}, ${stock.id})">
                <div class="plan-header">
                    <div class="plan-name">${stock.spec_name} - ${paperTypeMap[stock.paper_type] || stock.paper_type} ${stock.weight}g ${stock.color}</div>
                    <div class="plan-metrics">
                        库存: ${stock.quantity} 张
                    </div>
                </div>
                <div class="detail-grid" style="grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="detail-item">
                        <span class="label">规格</span>
                        <span class="value">${stock.spec_width}x${stock.spec_height}mm</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">单价</span>
                        <span class="value">${formatCurrency(stock.unit_price)}/张</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        document.getElementById('paper-options').innerHTML = optionsHtml || '<p class="empty-state">暂无可用库存</p>';
        
    } catch (error) {
        showToast('加载纸张列表失败: ' + error.message, 'error');
    }
}

async function selectStock(orderId, itemId, stockId) {
    hideModal();
    
    try {
        const result = await apiRequest(`/orders/${orderId}/calculate-plan`, {
            method: 'POST',
            body: JSON.stringify({
                item_id: itemId,
                stock_id: stockId
            })
        });
        
        if (result.success) {
            showToast('裁切方案计算完成');
            await viewOrder(orderId);
        } else {
            showToast(result.error || '计算失败', 'error');
        }
        
    } catch (error) {
        showToast('计算失败: ' + error.message, 'error');
    }
}

async function confirmOrder(orderId) {
    try {
        await apiRequest(`/orders/${orderId}/confirm`, {
            method: 'POST'
        });
        
        showToast('订单确认成功，库存已扣减');
        await viewOrder(orderId);
        
    } catch (error) {
        showToast('确认失败: ' + error.message, 'error');
    }
}

function exportQuotation(orderId) {
    window.open(`${API_BASE}/orders/${orderId}/export/quotation`, '_blank');
    showToast('报价单导出中...');
}

function exportMaterials(orderId) {
    window.open(`${API_BASE}/orders/${orderId}/export/materials`, '_blank');
    showToast('备料单导出中...');
}

async function deleteOrder(orderId) {
    if (!confirm('确定要删除这个订单吗？')) return;
    
    try {
        await apiRequest(`/orders/${orderId}`, {
            method: 'DELETE'
        });
        
        showToast('订单已删除');
        loadOrders();
        
    } catch (error) {
        showToast('删除失败: ' + error.message, 'error');
    }
}

function addOrderItem() {
    const template = document.getElementById('order-item-template');
    const container = document.getElementById('order-items-container');
    
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const clone = template.content.cloneNode(true);
    const index = orderItems.length;
    const card = clone.querySelector('.order-item-card');
    card.dataset.itemIndex = index;
    
    const numberSpan = card.querySelector('.item-number');
    numberSpan.textContent = `#${index + 1}`;
    
    const removeBtn = card.querySelector('.btn-remove-item');
    removeBtn.onclick = () => {
        card.remove();
        orderItems.splice(index, 1);
        
        if (container.children.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无订单项，点击"添加订单项"开始录入</p></div>';
        }
    };
    
    container.appendChild(card);
    orderItems.push({});
}

function getOrderItemData(card) {
    return {
        product_name: card.querySelector('.item-product-name').value || '未命名产品',
        finished_width: parseFloat(card.querySelector('.item-width').value) || 0,
        finished_height: parseFloat(card.querySelector('.item-height').value) || 0,
        quantity: parseInt(card.querySelector('.item-quantity').value) || 0,
        paper_type: card.querySelector('.item-paper-type').value || null,
        paper_weight: parseFloat(card.querySelector('.item-weight').value) || null,
        paper_color: card.querySelector('.item-color').value || '白色',
        grain_direction: card.querySelector('.item-grain').value || 'any',
        double_sided: card.querySelector('.item-double-sided').checked,
        bleed: parseFloat(card.querySelector('.item-bleed').value) || 0,
        notes: card.querySelector('.item-notes').value || null
    };
}

async function saveOrder() {
    const itemCards = document.querySelectorAll('.order-item-card');
    
    if (itemCards.length === 0) {
        showToast('请至少添加一个订单项', 'warning');
        return;
    }
    
    const items = [];
    let hasError = false;
    
    itemCards.forEach(card => {
        const data = getOrderItemData(card);
        
        if (!data.product_name || data.product_name.trim() === '') {
            showToast('请填写产品名称', 'warning');
            hasError = true;
            return;
        }
        
        if (data.finished_width <= 0 || data.finished_height <= 0) {
            showToast('请填写正确的成品尺寸', 'warning');
            hasError = true;
            return;
        }
        
        if (data.quantity <= 0) {
            showToast('请填写数量', 'warning');
            hasError = true;
            return;
        }
        
        items.push(data);
    });
    
    if (hasError) return;
    
    const orderData = {
        customer_name: document.getElementById('customer-name').value || null,
        customer_phone: document.getElementById('customer-phone').value || null,
        customer_company: document.getElementById('customer-company').value || null,
        is_urgent: document.getElementById('is-urgent').checked,
        urgent_reason: null,
        required_date: document.getElementById('required-date').value || null,
        notes: document.getElementById('order-notes').value || null,
        items: items
    };
    
    try {
        const order = await apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        showToast('订单保存成功');
        
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-phone').value = '';
        document.getElementById('customer-company').value = '';
        document.getElementById('is-urgent').checked = false;
        document.getElementById('required-date').value = '';
        document.getElementById('order-notes').value = '';
        document.getElementById('order-items-container').innerHTML = '<div class="empty-state"><p>暂无订单项，点击"添加订单项"开始录入</p></div>';
        orderItems = [];
        
        switchView('orders');
        loadOrders();
        
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

function triggerCsvImport() {
    document.getElementById('csv-import-input').click();
}

async function handleCsvImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(API_BASE + '/orders/import', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '导入失败');
        }
        
        const result = await response.json();
        showToast(`导入成功，已创建订单 ${result.order.order_number}`);
        switchView('orders');
        loadOrders();
        
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
    
    event.target.value = '';
}

async function quickCalculate() {
    const pieceWidth = parseFloat(document.getElementById('calc-piece-width').value);
    const pieceHeight = parseFloat(document.getElementById('calc-piece-height').value);
    const quantity = parseInt(document.getElementById('calc-quantity').value);
    const grain = document.getElementById('calc-grain').value;
    const weight = parseFloat(document.getElementById('calc-weight').value) || null;
    const paperType = document.getElementById('calc-paper-type').value || null;
    
    if (!pieceWidth || !pieceHeight || !quantity) {
        showToast('请填写完整的成品尺寸和数量', 'warning');
        return;
    }
    
    const resultsDiv = document.getElementById('calc-results');
    resultsDiv.innerHTML = '<div class="loading">计算中...</div>';
    
    try {
        const result = await apiRequest('/calculate/find-best-stock', {
            method: 'POST',
            body: JSON.stringify({
                piece_width: pieceWidth,
                piece_height: pieceHeight,
                total_pieces: quantity,
                paper_type: paperType,
                paper_weight: weight,
                paper_color: '白色',
                grain_direction: grain
            })
        });
        
        if (!result.success) {
            resultsDiv.innerHTML = `<div class="empty-state">${result.error || '未找到合适的纸张'}</div>`;
            return;
        }
        
        if (result.results.length === 0) {
            resultsDiv.innerHTML = '<div class="empty-state">未找到匹配的库存纸张</div>';
            return;
        }
        
        resultsDiv.innerHTML = result.results.map((r, i) => `
            <div class="plan-card ${i === 0 ? 'best' : ''} ${r.has_shortage ? 'shortage' : ''}">
                <div class="plan-header">
                    <div class="plan-name">
                        ${r.spec.name} - ${paperTypeMap[r.stock.paper_type] || r.stock.paper_type} ${r.stock.weight}g ${r.stock.color}
                        ${i === 0 ? '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">推荐</span>' : ''}
                    </div>
                    <div class="plan-metrics">
                        <span class="efficiency-badge ${r.efficiency < 0.7 ? 'low' : ''}">${(r.efficiency * 100).toFixed(1)}%</span>
                    </div>
                </div>
                ${r.has_shortage ? `
                    <div class="risk-warning shortage-warning">
                        <strong>⚠️ 库存不足</strong>：需要 ${r.sheets_needed} 张，库存 ${r.sheets_available} 张，缺纸 ${r.shortage} 张
                    </div>
                ` : ''}
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">纸张尺寸</span>
                        <span class="value">${r.spec.width}x${r.spec.height}mm</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">开数</span>
                        <span class="value">${r.open_format}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">排版方式</span>
                        <span class="value">${r.layout.cols}列 × ${r.layout.rows}行 = ${r.layout.total_per_sheet}张</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">需要纸张</span>
                        <span class="value">${r.sheets_needed} 张</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">库存</span>
                        <span class="value ${r.has_shortage ? 'stock-low' : ''}">${r.sheets_available} 张</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">报价</span>
                        <span class="value price-highlight">${formatCurrency(r.cost.quoted_price)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">材料成本</span>
                        <span class="value">${formatCurrency(r.cost.material_cost)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">人工成本</span>
                        <span class="value">${formatCurrency(r.cost.labor_cost)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        resultsDiv.innerHTML = `<div class="empty-state">计算失败: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.view;
            switchView(view);
            
            if (view === 'orders') loadOrders();
            if (view === 'stock') loadStock();
        });
    });
    
    document.getElementById('btn-refresh-orders').addEventListener('click', loadOrders);
    document.getElementById('btn-refresh-stock').addEventListener('click', loadStock);
    document.getElementById('btn-add-item').addEventListener('click', addOrderItem);
    document.getElementById('btn-save-order').addEventListener('click', saveOrder);
    document.getElementById('btn-import-csv').addEventListener('click', triggerCsvImport);
    document.getElementById('csv-import-input').addEventListener('change', handleCsvImport);
    document.getElementById('btn-back-to-orders').addEventListener('click', () => {
        switchView('orders');
        loadOrders();
    });
    document.getElementById('btn-calculate-quick').addEventListener('click', quickCalculate);
    
    document.getElementById('modal-close').addEventListener('click', hideModal);
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) hideModal();
    });
    
    loadOrders();
});
