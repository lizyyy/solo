const API_BASE = '/api';

const PRICE_CONFIG = {
    A4: { single: 0.2, double: 0.3 },
    A3: { single: 0.5, double: 0.8 },
    B5: { single: 0.15, double: 0.25 }
};

const STATUS_LABELS = {
    paid: '已付款',
    needs_topup: '需补差',
    called: '已叫号',
    completed: '已完成',
    refunded: '已退款'
};

let currentOrders = [];

async function fetchOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders`);
        const result = await response.json();
        if (result.success) {
            currentOrders = result.data;
            renderOrders();
        }
    } catch (error) {
        console.error('获取订单失败:', error);
    }
}

function calculatePrice() {
    const paperType = document.getElementById('paperType').value;
    const printSide = document.getElementById('printSide').value;
    const pageCount = parseInt(document.getElementById('pageCount').value) || 0;
    const copies = parseInt(document.getElementById('copies').value) || 0;
    
    const pricePerPage = PRICE_CONFIG[paperType][printSide];
    const totalPages = pageCount * copies;
    const totalAmount = totalPages * pricePerPage;
    
    document.getElementById('previewAmount').textContent = `¥${totalAmount.toFixed(2)}`;
    return totalAmount;
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN') + ' ' + formatTime(dateStr);
}

function createOrderCard(order) {
    const balanceClass = order.balance >= 0 ? 'positive' : 'negative';
    const balanceText = order.balance >= 0 
        ? `找零 ¥${order.balance.toFixed(2)}` 
        : `欠 ¥${Math.abs(order.balance).toFixed(2)}`;
    
    const printSideText = order.printSide === 'single' ? '单面' : '双面';
    
    let actionsHtml = '';
    
    if (order.status === 'paid' || order.status === 'needs_topup') {
        actionsHtml += `<button class="btn btn-small btn-call" onclick="callOrder('${order.id}')">叫号</button>`;
        actionsHtml += `<button class="btn btn-small btn-edit" onclick="editOrder('${order.id}')">修改</button>`;
        
        if (order.status === 'needs_topup') {
            actionsHtml += `<button class="btn btn-small btn-topup" onclick="topupOrder('${order.id}')">补差</button>`;
        }
        
        actionsHtml += `<button class="btn btn-small btn-refund" onclick="refundOrder('${order.id}')">退款</button>`;
    } else if (order.status === 'called') {
        actionsHtml += `<button class="btn btn-small btn-complete" onclick="completeOrder('${order.id}')">完成</button>`;
        
        if (order.balance < 0) {
            actionsHtml += `<button class="btn btn-small btn-topup" onclick="topupOrder('${order.id}')">补差</button>`;
        }
    }
    
    return `
        <div class="order-card status-${order.status}">
            <div class="order-header">
                <span class="order-number">#${order.orderNumber}</span>
                <span class="order-status">${STATUS_LABELS[order.status]}</span>
            </div>
            <div class="order-customer">${order.customerName}</div>
            <div class="order-details">
                <div class="order-info">
                    <div>${order.paperType} · ${printSideText}</div>
                    <div>${order.pageCount}页 × ${order.copies}份 = ${order.totalPages}页</div>
                    <div class="order-time">${formatDate(order.createdAt)}</div>
                </div>
                <div class="order-prices">
                    <div class="order-total">¥${order.totalAmount.toFixed(2)}</div>
                    <div class="order-prepaid">预付 ¥${order.prepaidAmount.toFixed(2)}</div>
                    <div class="order-balance ${balanceClass}">${balanceText}</div>
                </div>
            </div>
            ${actionsHtml ? `<div class="order-actions">${actionsHtml}</div>` : ''}
        </div>
    `;
}

function renderOrders() {
    const queueOrders = currentOrders.filter(o => o.status === 'paid' || o.status === 'needs_topup');
    const calledOrders = currentOrders.filter(o => o.status === 'called');
    const historyOrders = currentOrders.filter(o => o.status === 'completed' || o.status === 'refunded');
    
    const paidCount = queueOrders.filter(o => o.status === 'paid').length;
    const needsTopupCount = queueOrders.filter(o => o.status === 'needs_topup').length;
    
    document.getElementById('paidCount').textContent = paidCount;
    document.getElementById('needsTopupCount').textContent = needsTopupCount;
    
    document.getElementById('queueList').innerHTML = queueOrders.length 
        ? queueOrders.map(createOrderCard).join('') 
        : '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无排队订单</p></div>';
    
    document.getElementById('calledList').innerHTML = calledOrders.length 
        ? calledOrders.map(createOrderCard).join('') 
        : '<div class="empty-state"><div class="empty-state-icon">📢</div><p>暂无已叫号订单</p></div>';
    
    document.getElementById('historyList').innerHTML = historyOrders.length 
        ? historyOrders.map(createOrderCard).join('') 
        : '<div class="empty-state"><div class="empty-state-icon">📜</div><p>暂无历史订单</p></div>';
}

async function createOrder(event) {
    event.preventDefault();
    
    const data = {
        customerName: document.getElementById('customerName').value.trim(),
        paperType: document.getElementById('paperType').value,
        printSide: document.getElementById('printSide').value,
        pageCount: parseInt(document.getElementById('pageCount').value),
        copies: parseInt(document.getElementById('copies').value),
        prepaidAmount: parseFloat(document.getElementById('prepaidAmount').value) || 0
    };
    
    if (!data.customerName) {
        alert('请输入客户姓名');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('orderForm').reset();
            document.getElementById('previewAmount').textContent = '¥0.00';
            fetchOrders();
        } else {
            alert(result.error || '创建订单失败');
        }
    } catch (error) {
        alert('创建订单失败: ' + error.message);
    }
}

async function callOrder(id) {
    try {
        const response = await fetch(`${API_BASE}/orders/${id}/call`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            fetchOrders();
        } else {
            alert(result.error || '叫号失败');
        }
    } catch (error) {
        alert('叫号失败: ' + error.message);
    }
}

async function callNextOrder() {
    try {
        const response = await fetch(`${API_BASE}/orders/call-next`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (result.data) {
                alert(`已叫号: #${result.data.orderNumber} - ${result.data.customerName}`);
            } else {
                alert(result.message || '当前没有待叫号的订单');
            }
            fetchOrders();
        } else {
            alert(result.error || '叫号失败');
        }
    } catch (error) {
        alert('叫号失败: ' + error.message);
    }
}

function editOrder(id) {
    const order = currentOrders.find(o => o.id === id);
    if (!order) return;
    
    showModal(`
        <h3>修改订单 #${order.orderNumber}</h3>
        <div class="form-group">
            <label>纸张类型</label>
            <select id="editPaperType">
                <option value="A4" ${order.paperType === 'A4' ? 'selected' : ''}>A4</option>
                <option value="A3" ${order.paperType === 'A3' ? 'selected' : ''}>A3</option>
                <option value="B5" ${order.paperType === 'B5' ? 'selected' : ''}>B5</option>
            </select>
        </div>
        <div class="form-group">
            <label>打印方式</label>
            <select id="editPrintSide">
                <option value="single" ${order.printSide === 'single' ? 'selected' : ''}>单面</option>
                <option value="double" ${order.printSide === 'double' ? 'selected' : ''}>双面</option>
            </select>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>原始页数</label>
                <input type="number" id="editPageCount" min="1" value="${order.pageCount}">
            </div>
            <div class="form-group">
                <label>打印份数</label>
                <input type="number" id="editCopies" min="1" value="${order.copies}">
            </div>
        </div>
        <div class="form-group">
            <label>预付金额</label>
            <input type="number" id="editPrepaidAmount" min="0" step="0.01" value="${order.prepaidAmount}">
        </div>
        <div class="modal-actions">
            <button class="btn btn-cancel" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="saveOrderEdit('${id}')">保存</button>
        </div>
    `);
}

async function saveOrderEdit(id) {
    const data = {
        paperType: document.getElementById('editPaperType').value,
        printSide: document.getElementById('editPrintSide').value,
        pageCount: parseInt(document.getElementById('editPageCount').value),
        copies: parseInt(document.getElementById('editCopies').value),
        prepaidAmount: parseFloat(document.getElementById('editPrepaidAmount').value) || 0
    };
    
    try {
        const response = await fetch(`${API_BASE}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal();
            fetchOrders();
        } else {
            alert(result.error || '修改订单失败');
        }
    } catch (error) {
        alert('修改订单失败: ' + error.message);
    }
}

function topupOrder(id) {
    const order = currentOrders.find(o => o.id === id);
    if (!order) return;
    
    const needAmount = Math.abs(order.balance);
    
    showModal(`
        <h3>订单补差 #${order.orderNumber}</h3>
        <p style="margin-bottom: 20px; color: #E65100;">
            当前欠款: ¥${needAmount.toFixed(2)}
        </p>
        <div class="form-group">
            <label>补差金额 (元)</label>
            <input type="number" id="topupAmount" min="0.01" step="0.01" value="${needAmount.toFixed(2)}">
        </div>
        <div class="modal-actions">
            <button class="btn btn-cancel" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="confirmTopup('${id}')">确认支付</button>
        </div>
    `);
}

async function confirmTopup(id) {
    const amount = parseFloat(document.getElementById('topupAmount').value) || 0;
    
    if (amount <= 0) {
        alert('请输入有效的补差金额');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/orders/${id}/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal();
            fetchOrders();
        } else {
            alert(result.error || '补差失败');
        }
    } catch (error) {
        alert('补差失败: ' + error.message);
    }
}

function refundOrder(id) {
    const order = currentOrders.find(o => o.id === id);
    if (!order) return;
    
    showModal(`
        <h3>确认退款 #${order.orderNumber}</h3>
        <p style="margin-bottom: 20px;">
            客户: ${order.customerName}<br>
            预付金额: ¥${order.prepaidAmount.toFixed(2)}
        </p>
        <p style="color: #F44336; margin-bottom: 20px;">
            ⚠️ 退款后订单将从队列中移除，此操作不可撤销
        </p>
        <div class="modal-actions">
            <button class="btn btn-cancel" onclick="closeModal()">取消</button>
            <button class="btn btn-refund" onclick="confirmRefund('${id}')">确认退款</button>
        </div>
    `);
}

async function confirmRefund(id) {
    try {
        const response = await fetch(`${API_BASE}/orders/${id}/refund`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal();
            fetchOrders();
        } else {
            alert(result.error || '退款失败');
        }
    } catch (error) {
        alert('退款失败: ' + error.message);
    }
}

async function completeOrder(id) {
    const order = currentOrders.find(o => o.id === id);
    if (!order) return;
    
    if (order.balance < 0) {
        alert('请先完成补差后再确认完成');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/orders/${id}/complete`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            fetchOrders();
        } else {
            alert(result.error || '完成订单失败');
        }
    } catch (error) {
        alert('完成订单失败: ' + error.message);
    }
}

function showModal(content) {
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tab}Tab`).classList.add('active');
        });
    });
}

function init() {
    initTabs();
    
    document.getElementById('orderForm').addEventListener('submit', createOrder);
    document.getElementById('callNextBtn').addEventListener('click', callNextOrder);
    
    ['paperType', 'printSide', 'pageCount', 'copies'].forEach(id => {
        document.getElementById(id).addEventListener('change', calculatePrice);
        document.getElementById(id).addEventListener('input', calculatePrice);
    });
    
    document.querySelector('.close').addEventListener('click', closeModal);
    
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal')) {
            closeModal();
        }
    });
    
    fetchOrders();
    
    setInterval(fetchOrders, 5000);
}

document.addEventListener('DOMContentLoaded', init);
