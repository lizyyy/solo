const API_BASE = '/api';
const OPERATOR = 'web-user';

let constants = {};

async function loadConstants() {
    const response = await fetch(`${API_BASE}/constants`);
    const result = await response.json();
    constants = result;
    
    const orderStatusFilter = document.getElementById('order-status-filter');
    Object.entries(constants.order_status).forEach(([key, value]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        orderStatusFilter.appendChild(option);
    });
}

function getStatusBadge(status) {
    const statusClass = `status-${status}`;
    return `<span class="status-badge ${statusClass}">${status}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
}

function formatMoney(amount) {
    if (amount === null || amount === undefined) return '-';
    return `¥${parseFloat(amount).toFixed(2)}`;
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.content');
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => alertDiv.remove(), 5000);
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`section-${sectionId}`).classList.add('active');
    event.target.classList.add('active');
    
    if (sectionId === 'dashboard') refreshDashboard();
    if (sectionId === 'orders') loadOrders();
    if (sectionId === 'refunds') loadRefundQueue();
    
    const now = new Date();
    const startTime = now.toISOString().slice(0, 16);
    const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
    
    const startInput = document.querySelector('input[name="rental_start_time"]');
    const endInput = document.querySelector('input[name="rental_end_time"]');
    if (startInput && !startInput.value) startInput.value = startTime;
    if (endInput && !endInput.value) endInput.value = endTime;
}

function showTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

async function refreshDashboard() {
    document.getElementById('pending-refund-count').innerHTML = '<span class="loading">加载中...</span>';
    document.getElementById('checking-order-count').innerHTML = '<span class="loading">加载中...</span>';
    document.getElementById('today-deposits').innerHTML = '<span class="loading">加载中...</span>';
    
    try {
        const refundResponse = await fetch(`${API_BASE}/refunds`);
        const refundData = await refundResponse.json();
        if (refundData.success) {
            document.getElementById('pending-refund-count').textContent = `${refundData.data.pending_count} 笔`;
        }
        
        const orderResponse = await fetch(`${API_BASE}/orders?status=CHECKING`);
        const orderData = await orderResponse.json();
        if (orderData.success) {
            document.getElementById('checking-order-count').textContent = `${orderData.data.length} 笔`;
        }
        
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById('today-deposits').textContent = '查看报表获取';
        
    } catch (error) {
        console.error('加载仪表盘数据失败:', error);
        document.getElementById('pending-refund-count').textContent = '加载失败';
        document.getElementById('checking-order-count').textContent = '加载失败';
    }
}

async function createOrder() {
    const form = document.getElementById('create-order-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    data.deposit_amount = parseFloat(data.deposit_amount);
    data.rental_start_time = new Date(data.rental_start_time).toISOString();
    data.rental_end_time = new Date(data.rental_end_time).toISOString();
    
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('订单创建成功！订单号: ' + result.data.order_no, 'success');
            form.reset();
            loadOrders();
        } else {
            showAlert('创建失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('创建失败: ' + error.message, 'error');
    }
}

async function loadOrders() {
    const status = document.getElementById('order-status-filter').value;
    const customer = document.getElementById('order-customer-filter').value;
    
    let url = `${API_BASE}/orders?limit=50`;
    if (status) url += `&status=${status}`;
    if (customer) url += `&customer_name=${encodeURIComponent(customer)}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        const tbody = document.querySelector('#orders-table tbody');
        tbody.innerHTML = '';
        
        if (result.success && result.data.length > 0) {
            result.data.forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${order.order_no}<br><small style="color: #718096;">${order.id}</small></td>
                    <td>${order.venue_name}</td>
                    <td>${order.customer_name}</td>
                    <td>${formatMoney(order.deposit_amount)}</td>
                    <td>${getStatusBadge(order.status)}</td>
                    <td>${formatDate(order.created_at)}</td>
                    <td>
                        ${order.status === 'PENDING' ? `
                            <button class="btn btn-success btn-sm" onclick="startUsing('${order.id}')">开始使用</button>
                        ` : ''}
                        ${order.status === 'IN_USE' ? `
                            <button class="btn btn-primary btn-sm" onclick="startChecking('${order.id}')">开始验收</button>
                        ` : ''}
                        ${order.status === 'PENDING' ? `
                            <button class="btn btn-danger btn-sm" onclick="cancelOrder('${order.id}')">取消</button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #718096;">暂无订单</td></tr>';
        }
    } catch (error) {
        console.error('加载订单失败:', error);
    }
}

async function startUsing(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/start-using`, {
            method: 'POST',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        if (result.success) {
            showAlert('已开始使用', 'success');
            loadOrders();
        } else {
            showAlert('操作失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('操作失败: ' + error.message, 'error');
    }
}

async function startChecking(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/start-checking`, {
            method: 'POST',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        if (result.success) {
            showAlert('已开始验收', 'success');
            loadOrders();
        } else {
            showAlert('操作失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('操作失败: ' + error.message, 'error');
    }
}

async function cancelOrder(orderId) {
    const reason = prompt('请输入取消原因:');
    if (!reason) return;
    
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR 
            },
            body: JSON.stringify({ reason })
        });
        const result = await response.json();
        if (result.success) {
            showAlert('订单已取消', 'success');
            loadOrders();
        } else {
            showAlert('操作失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('操作失败: ' + error.message, 'error');
    }
}

async function loadOrderForChecking() {
    const orderId = document.getElementById('checking-order-id').value.trim();
    if (!orderId) {
        showAlert('请输入订单ID', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('checking-detail').style.display = 'block';
            document.getElementById('checklist-order-id').value = orderId;
            document.getElementById('utility-order-id').value = orderId;
            
            loadChecklistItems(orderId);
            loadDamageCharges(orderId);
            loadUtilityRecords(orderId);
        } else {
            showAlert('订单不存在: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('加载失败: ' + error.message, 'error');
    }
}

async function addChecklistItem() {
    const form = document.getElementById('checklist-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    data.expected_quantity = parseInt(data.expected_quantity);
    if (data.actual_quantity) data.actual_quantity = parseInt(data.actual_quantity);
    if (data.unit_price) data.unit_price = parseFloat(data.unit_price);
    data.is_damaged = data.is_damaged === 'true';
    
    try {
        const response = await fetch(`${API_BASE}/checklists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('验收项目添加成功', 'success');
            form.reset();
            form.querySelector('[name="expected_quantity"]').value = 1;
            loadChecklistItems(data.order_id);
        } else {
            showAlert('添加失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('添加失败: ' + error.message, 'error');
    }
}

async function loadChecklistItems(orderId) {
    try {
        const response = await fetch(`${API_BASE}/checklists/order/${orderId}`);
        const result = await response.json();
        
        const tbody = document.querySelector('#checklist-table tbody');
        tbody.innerHTML = '';
        
        if (result.success && result.data.items.length > 0) {
            result.data.items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.item_name}</td>
                    <td>${item.expected_quantity} / ${item.actual_quantity || '-'}</td>
                    <td>${item.is_damaged ? '是' : '否'}</td>
                    <td>${item.damage_degree || '-'}</td>
                    <td>${formatMoney(item.unit_price)}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteChecklistItem('${item.id}', '${orderId}')">删除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #718096;">暂无验收项目</td></tr>';
        }
    } catch (error) {
        console.error('加载验收清单失败:', error);
    }
}

async function deleteChecklistItem(itemId, orderId) {
    if (!confirm('确定删除此验收项目？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/checklists/${itemId}`, {
            method: 'DELETE',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('删除成功', 'success');
            loadChecklistItems(orderId);
        } else {
            showAlert('删除失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('删除失败: ' + error.message, 'error');
    }
}

async function autoGenerateDamageCharges() {
    const orderId = document.getElementById('checking-order-id').value.trim();
    
    try {
        const response = await fetch(`${API_BASE}/damage/auto-generate/${orderId}`, {
            method: 'POST',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert(`成功生成 ${result.data.length} 条损坏扣费`, 'success');
            loadDamageCharges(orderId);
        } else {
            showAlert('生成失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('生成失败: ' + error.message, 'error');
    }
}

async function loadDamageCharges(orderId) {
    try {
        const response = await fetch(`${API_BASE}/damage/order/${orderId}`);
        const result = await response.json();
        
        const tbody = document.querySelector('#damage-table tbody');
        tbody.innerHTML = '';
        
        if (result.success && result.data.charges.length > 0) {
            result.data.charges.forEach(charge => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${charge.item_name}</td>
                    <td>${charge.damage_degree || '-'}</td>
                    <td>${formatMoney(charge.charge_amount)}</td>
                    <td>${charge.charge_reason || '-'}</td>
                    <td>${charge.is_manual_adjustment ? '是' : '否'}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="adjustDamageCharge('${charge.id}')">调整</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #718096;">暂无损坏扣费</td></tr>';
        }
    } catch (error) {
        console.error('加载损坏扣费失败:', error);
    }
}

async function adjustDamageCharge(chargeId) {
    const newAmount = prompt('请输入新的扣费金额:');
    if (!newAmount) return;
    
    const reason = prompt('请输入调整原因:');
    if (!reason) {
        showAlert('必须填写调整原因', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/damage/${chargeId}/adjust`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR
            },
            body: JSON.stringify({
                new_amount: parseFloat(newAmount),
                reason
            })
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('调整成功', 'success');
            const orderId = document.getElementById('checking-order-id').value.trim();
            loadDamageCharges(orderId);
        } else {
            showAlert('调整失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('调整失败: ' + error.message, 'error');
    }
}

async function addUtilityRecord() {
    const form = document.getElementById('utility-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    data.initial_reading = parseFloat(data.initial_reading);
    if (data.final_reading) data.final_reading = parseFloat(data.final_reading);
    data.unit_price = parseFloat(data.unit_price);
    
    try {
        const response = await fetch(`${API_BASE}/utility`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('水电记录添加成功', 'success');
            form.reset();
            loadUtilityRecords(data.order_id);
        } else {
            showAlert('添加失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('添加失败: ' + error.message, 'error');
    }
}

async function loadUtilityRecords(orderId) {
    try {
        const response = await fetch(`${API_BASE}/utility/order/${orderId}`);
        const result = await response.json();
        
        const tbody = document.querySelector('#utility-table tbody');
        tbody.innerHTML = '';
        
        if (result.success && result.data.records.length > 0) {
            result.data.records.forEach(record => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${record.utility_type === 'WATER' ? '水费' : '电费'}</td>
                    <td>${record.initial_reading}</td>
                    <td>${record.final_reading || '-'}</td>
                    <td>${record.usage_amount || '-'}</td>
                    <td>${formatMoney(record.unit_price)}</td>
                    <td>${formatMoney(record.calculated_amount)}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteUtilityRecord('${record.id}', '${orderId}')">删除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #718096;">暂无水电记录</td></tr>';
        }
    } catch (error) {
        console.error('加载水电记录失败:', error);
    }
}

async function deleteUtilityRecord(recordId, orderId) {
    if (!confirm('确定删除此水电记录？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/utility/${recordId}`, {
            method: 'DELETE',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('删除成功', 'success');
            loadUtilityRecords(orderId);
        } else {
            showAlert('删除失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('删除失败: ' + error.message, 'error');
    }
}

async function loadFeeSummary() {
    const orderId = document.getElementById('fee-order-id').value.trim();
    if (!orderId) {
        showAlert('请输入订单ID', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/fees/order/${orderId}`);
        const result = await response.json();
        
        document.getElementById('fee-detail').style.display = 'block';
        const summaryDiv = document.getElementById('fee-summary');
        
        if (result.success) {
            const summary = result.data;
            summaryDiv.innerHTML = `
                <h3>费用汇总</h3>
                <div class="grid">
                    <div class="card">
                        <h3>押金金额</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #3182ce;">${formatMoney(summary.deposit_amount)}</p>
                    </div>
                    <div class="card">
                        <h3>损坏扣费</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #e53e3e;">${formatMoney(summary.damage_total)}</p>
                    </div>
                    <div class="card">
                        <h3>水电费用</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #dd6b20;">${formatMoney(summary.utility_total)}</p>
                    </div>
                    <div class="card">
                        <h3>扣款合计</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #742a2a;">${formatMoney(summary.total_deductions)}</p>
                    </div>
                </div>
                <div class="card" style="background: #d1fae5; border-left-color: #38a169;">
                    <h3>应退押金</h3>
                    <p style="font-size: 32px; font-weight: bold; color: #065f46;">${formatMoney(summary.refund_amount)}</p>
                    ${summary.is_manually_adjusted ? `<p style="color: #744210; margin-top: 10px;">⚠️ 已人工调整: ${summary.adjustment_reason}</p>` : ''}
                </div>
                <h3>费用明细</h3>
                <div class="detail-item">
                    <label>损坏扣费明细:</label>
                    <ul>
                        ${summary.breakdown.damageCharges.length > 0 
                            ? summary.breakdown.damageCharges.map(c => `<li>${c.item_name}: ${formatMoney(c.charge_amount)}${c.is_manual_adjustment ? ' (人工调整)' : ''}</li>`).join('')
                            : '<li>无</li>'}
                    </ul>
                </div>
                <div class="detail-item">
                    <label>水电费用明细:</label>
                    <ul>
                        ${summary.breakdown.utilityRecords.length > 0 
                            ? summary.breakdown.utilityRecords.map(r => `<li>${r.utility_type === 'WATER' ? '水费' : '电费'}: ${formatMoney(r.calculated_amount)}</li>`).join('')
                            : '<li>无</li>'}
                    </ul>
                </div>
                ${summary.breakdown.manualAdjustments.length > 0 ? `
                <div class="detail-item">
                    <label>人工调整记录:</label>
                    <ul>
                        ${summary.breakdown.manualAdjustments.map(a => `<li>${a.adjustment_type}: ${formatMoney(a.old_value)} → ${formatMoney(a.new_value)} (${a.reason} - ${a.adjusted_by})</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            `;
        } else {
            summaryDiv.innerHTML = `
                <div class="alert alert-info">
                    费用尚未计算，请先点击「计算费用」按钮
                </div>
            `;
        }
    } catch (error) {
        showAlert('加载失败: ' + error.message, 'error');
    }
}

async function calculateFees() {
    const orderId = document.getElementById('fee-order-id').value.trim();
    
    try {
        const response = await fetch(`${API_BASE}/fees/calculate/${orderId}`, {
            method: 'POST',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('费用计算成功', 'success');
            loadFeeSummary();
        } else {
            showAlert('计算失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('计算失败: ' + error.message, 'error');
    }
}

async function addToRefundQueue() {
    const orderId = document.getElementById('fee-order-id').value.trim();
    const refundMethod = prompt('请选择退款方式 (CASH/BANK_TRANSFER/ORIGINAL_PAYMENT):', 'CASH');
    
    if (!refundMethod) return;
    
    try {
        const response = await fetch(`${API_BASE}/refunds/enqueue/${orderId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR
            },
            body: JSON.stringify({ refund_method: refundMethod })
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('已加入退款队列', 'success');
        } else {
            showAlert('操作失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('操作失败: ' + error.message, 'error');
    }
}

async function adjustRefundAmount() {
    const orderId = document.getElementById('fee-order-id').value.trim();
    const newAmount = document.getElementById('adjust-refund-amount').value;
    const reason = document.getElementById('adjust-reason').value;
    
    if (!newAmount || !reason) {
        showAlert('请填写新金额和调整原因', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/fees/order/${orderId}/adjust-refund`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR
            },
            body: JSON.stringify({
                new_refund_amount: parseFloat(newAmount),
                reason
            })
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('调整成功', 'success');
            document.getElementById('adjust-refund-amount').value = '';
            document.getElementById('adjust-reason').value = '';
            loadFeeSummary();
        } else {
            showAlert('调整失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('调整失败: ' + error.message, 'error');
    }
}

async function loadRefundQueue() {
    const status = document.getElementById('refund-status-filter').value;
    
    let url = `${API_BASE}/refunds`;
    if (status) url += `?status=${status}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        const tbody = document.querySelector('#refund-table tbody');
        tbody.innerHTML = '';
        
        if (result.success && result.data.queue.length > 0) {
            result.data.queue.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.order_id}</td>
                    <td>${formatMoney(item.refund_amount)}</td>
                    <td>${item.refund_method}</td>
                    <td>${getStatusBadge(item.status)}</td>
                    <td>${item.retry_count}/${item.max_retries}</td>
                    <td>${item.last_error || '-'}</td>
                    <td>
                        ${item.status === 'PENDING' ? `
                            <button class="btn btn-success btn-sm" onclick="processRefund('${item.id}')">处理退款</button>
                        ` : ''}
                        ${item.status === 'FAILED' ? `
                            <button class="btn btn-warning btn-sm" onclick="retryRefund('${item.id}')">重试</button>
                        ` : ''}
                        ${item.status === 'MANUAL_REVIEW' ? `
                            <button class="btn btn-primary btn-sm" onclick="manualProcessRefund('${item.id}')">人工确认</button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #718096;">暂无退款记录</td></tr>';
        }
    } catch (error) {
        console.error('加载退款队列失败:', error);
    }
}

async function processRefund(queueId) {
    try {
        const response = await fetch(`${API_BASE}/refunds/process/${queueId}`, {
            method: 'POST',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        
        if (result.success) {
            if (result.data.success) {
                showAlert('退款成功', 'success');
            } else {
                showAlert('退款失败，已加入重试队列', 'error');
            }
            loadRefundQueue();
        } else {
            showAlert('操作失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('操作失败: ' + error.message, 'error');
    }
}

async function retryRefund(queueId) {
    try {
        const response = await fetch(`${API_BASE}/refunds/retry/${queueId}`, {
            method: 'POST',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('已触发重试', 'success');
            loadRefundQueue();
        } else {
            showAlert('操作失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('操作失败: ' + error.message, 'error');
    }
}

async function manualProcessRefund(queueId) {
    const transactionNo = prompt('请输入交易凭证号（可选）:');
    
    try {
        const response = await fetch(`${API_BASE}/refunds/manual-process/${queueId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Operator': OPERATOR
            },
            body: JSON.stringify({ transaction_no: transactionNo })
        });
        const result = await response.json();
        
        if (result.success) {
            showAlert('人工确认退款成功', 'success');
            loadRefundQueue();
        } else {
            showAlert('操作失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('操作失败: ' + error.message, 'error');
    }
}

async function generateDailyReport() {
    const date = document.getElementById('report-date').value;
    if (!date) {
        showAlert('请选择日期', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/reports/daily/${date}`, {
            method: 'POST',
            headers: { 'X-Operator': OPERATOR }
        });
        const result = await response.json();
        
        if (result.success) {
            displayReport(result.data);
        } else {
            showAlert('生成失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('生成失败: ' + error.message, 'error');
    }
}

function displayReport(report) {
    const detailDiv = document.getElementById('report-detail');
    detailDiv.innerHTML = `
        <div class="grid">
            <div class="card">
                <h3>押金收入</h3>
                <p style="font-size: 20px; font-weight: bold;">${formatMoney(report.total_deposits_received)}</p>
            </div>
            <div class="card">
                <h3>损坏扣费</h3>
                <p style="font-size: 20px; font-weight: bold;">${formatMoney(report.total_damage_charges)}</p>
            </div>
            <div class="card">
                <h3>水电费用</h3>
                <p style="font-size: 20px; font-weight: bold;">${formatMoney(report.total_utility_charges)}</p>
            </div>
            <div class="card">
                <h3>已退押金</h3>
                <p style="font-size: 20px; font-weight: bold;">${formatMoney(report.total_refunds)}</p>
            </div>
            <div class="card">
                <h3>待退押金</h3>
                <p style="font-size: 20px; font-weight: bold;">${formatMoney(report.pending_refunds)}</p>
            </div>
        </div>
        <h3>订单明细 (${report.details.orders.length} 笔)</h3>
        ${report.details.orders.length > 0 ? `
            <table style="font-size: 12px;">
                <thead>
                    <tr>
                        <th>订单号</th>
                        <th>场馆</th>
                        <th>客户</th>
                        <th>押金</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.details.orders.map(o => `
                        <tr>
                            <td>${o.order_no}</td>
                            <td>${o.venue_name}</td>
                            <td>${o.customer_name}</td>
                            <td>${formatMoney(o.deposit_amount)}</td>
                            <td>${getStatusBadge(o.status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p style="color: #718096;">暂无订单</p>'}
        ${report.details.damageCharges.length > 0 ? `
        <h3 style="margin-top: 20px;">损坏扣费明细 (${report.details.damageCharges.length} 笔)</h3>
            <table style="font-size: 12px;">
                <thead>
                    <tr>
                        <th>订单</th>
                        <th>客户</th>
                        <th>项目</th>
                        <th>金额</th>
                        <th>原因</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.details.damageCharges.map(c => `
                        <tr>
                            <td>${c.order_no}</td>
                            <td>${c.customer_name}</td>
                            <td>${c.item_name}</td>
                            <td>${formatMoney(c.charge_amount)}</td>
                            <td>${c.charge_reason || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : ''}
        ${report.details.refundRecords.length > 0 ? `
        <h3 style="margin-top: 20px;">退款记录 (${report.details.refundRecords.length} 笔)</h3>
            <table style="font-size: 12px;">
                <thead>
                    <tr>
                        <th>订单</th>
                        <th>客户</th>
                        <th>金额</th>
                        <th>方式</th>
                        <th>交易号</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.details.refundRecords.map(r => `
                        <tr>
                            <td>${r.order_no}</td>
                            <td>${r.customer_name}</td>
                            <td>${formatMoney(r.refund_amount)}</td>
                            <td>${r.refund_method}</td>
                            <td>${r.transaction_no || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : ''}
    `;
}

function exportDailyReport() {
    const date = document.getElementById('report-date').value;
    if (!date) {
        showAlert('请选择日期', 'error');
        return;
    }
    window.location.href = `${API_BASE}/reports/daily/${date}/export`;
}

async function loadOrderExport() {
    const orderId = document.getElementById('export-order-id').value.trim();
    if (!orderId) {
        showAlert('请输入订单ID', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/reports/order/${orderId}/data`);
        const result = await response.json();
        
        if (result.success) {
            const detailDiv = document.getElementById('order-export-detail');
            const data = result.data;
            detailDiv.innerHTML = `
                <h3>订单基本信息</h3>
                <div class="grid">
                    <div class="card">
                        <p><strong>订单号:</strong> ${data.order.order_no}</p>
                        <p><strong>场馆:</strong> ${data.order.venue_name}</p>
                        <p><strong>客户:</strong> ${data.order.customer_name}</p>
                    </div>
                    <div class="card">
                        <p><strong>押金:</strong> ${formatMoney(data.order.deposit_amount)}</p>
                        <p><strong>开始:</strong> ${formatDate(data.order.rental_start_time)}</p>
                        <p><strong>结束:</strong> ${formatDate(data.order.rental_end_time)}</p>
                    </div>
                </div>
                ${data.feeSummary ? `
                <h3>费用汇总</h3>
                <div class="card">
                    <p>损坏扣费: ${formatMoney(data.feeSummary.damage_total)}</p>
                    <p>水电费用: ${formatMoney(data.feeSummary.utility_total)}</p>
                    <p>应退押金: ${formatMoney(data.feeSummary.refund_amount)}</p>
                </div>
                ` : ''}
                <h3>状态变更历史 (${data.statusLogs.length} 条)</h3>
                ${data.statusLogs.map(log => `
                    <div class="detail-item">
                        ${log.from_status || '-'} → ${log.to_status} (${log.changed_by}) - ${formatDate(log.changed_at)}
                        ${log.reason ? `<br><small style="color: #718096;">${log.reason}</small>` : ''}
                    </div>
                `).join('')}
            `;
        } else {
            showAlert('加载失败: ' + result.message, 'error');
        }
    } catch (error) {
        showAlert('加载失败: ' + error.message, 'error');
    }
}

function exportOrder() {
    const orderId = document.getElementById('export-order-id').value.trim();
    if (!orderId) {
        showAlert('请输入订单ID', 'error');
        return;
    }
    window.location.href = `${API_BASE}/reports/order/${orderId}/export`;
}

document.addEventListener('DOMContentLoaded', () => {
    loadConstants();
    refreshDashboard();
    loadOrders();
    
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('report-date').value = today;
});
