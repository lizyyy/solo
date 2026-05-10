let allElders = [];
let allPackages = [];
let allRoutes = [];
let currentDate = new Date().toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', () => {
    initDateInputs();
    loadAllData();
    setupModalListeners();
});

function initDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dashboardDate').value = today;
    document.getElementById('routesDate').value = today;
    document.getElementById('exceptionsDate').value = today;
    document.getElementById('ordersDate').value = today;
    document.getElementById('newOrderDate').value = today;
    document.getElementById('exportDate').value = today;
}

function setupModalListeners() {
    const createOrderModal = document.getElementById('createOrderModal');
    createOrderModal.addEventListener('show.bs.modal', () => {
        loadEldersForSelect();
        loadPackagesForSelect();
        resetCreateOrderForm();
    });
}

function resetCreateOrderForm() {
    document.getElementById('conflictWarning').classList.add('d-none');
    document.getElementById('forceCreateBtn').classList.add('d-none');
    document.getElementById('createOrderBtn').classList.remove('d-none');
}

async function loadAllData() {
    await Promise.all([
        loadElders(),
        loadPackages(),
        loadRoutes(),
        loadDashboard(),
        loadHistory()
    ]);
}

async function loadElders() {
    const response = await fetch('/api/elders');
    allElders = await response.json();
    renderEldersTable();
    return allElders;
}

async function loadPackages() {
    const response = await fetch('/api/packages');
    allPackages = await response.json();
    return allPackages;
}

async function loadRoutes() {
    const response = await fetch('/api/routes');
    allRoutes = await response.json();
    renderRouteSelects();
    return allRoutes;
}

function renderRouteSelects() {
    const ordersRouteSelect = document.getElementById('ordersRoute');
    ordersRouteSelect.innerHTML = '<option value="">全部路线</option>';
    allRoutes.forEach(route => {
        ordersRouteSelect.innerHTML += `<option value="${route.id}">${route.name}</option>`;
    });
}

function loadEldersForSelect() {
    const select = document.getElementById('newOrderElder');
    select.innerHTML = '<option value="">请选择老人</option>';
    allElders.forEach(elder => {
        const forbidden = elder.forbidden_ingredients ? ` (禁忌: ${elder.forbidden_ingredients})` : '';
        select.innerHTML += `<option value="${elder.id}">${elder.name}${forbidden}</option>`;
    });
}

function loadPackagesForSelect() {
    const select = document.getElementById('newOrderPackage');
    select.innerHTML = '<option value="">请选择套餐</option>';
    allPackages.forEach(pkg => {
        select.innerHTML += `<option value="${pkg.id}" data-ingredients="${pkg.ingredients || ''}">${pkg.name} - ￥${pkg.price} (${pkg.ingredients || '无'})</option>`;
    });
}

async function loadDashboard() {
    const date = document.getElementById('dashboardDate').value || currentDate;
    
    const statsResponse = await fetch('/api/dashboard/stats');
    const stats = await statsResponse.json();
    
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statSigned').textContent = stats.signed;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statException').textContent = stats.exception;
    document.getElementById('statRefunded').textContent = stats.refunded;
    
    const ordersResponse = await fetch(`/api/orders?date=${date}`);
    const orders = await ordersResponse.json();
    renderDashboardOrdersTable(orders);
}

function renderDashboardOrdersTable(orders) {
    const tbody = document.querySelector('#dashboardOrdersTable tbody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无订单数据，请点击"生成样例数据"</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.elder_name}</td>
            <td>${order.package_name}</td>
            <td>${order.route_name || '未分配'}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewOrder(${order.id})">详情</button>
                ${getQuickActions(order)}
            </td>
        </tr>
    `).join('');
}

function getQuickActions(order) {
    let actions = '';
    
    if (order.status === 'pending') {
        actions += `<button class="btn btn-sm btn-outline-success ms-1" onclick="openAssignRouteModal(${order.id})">分配路线</button>`;
    }
    
    if (order.status === 'assigned') {
        actions += `<button class="btn btn-sm btn-success ms-1" onclick="signOrder(${order.id})">签收</button>`;
        actions += `<button class="btn btn-sm btn-warning ms-1" onclick="markException(${order.id})">异常</button>`;
    }
    
    if (order.status === 'exception') {
        actions += `<button class="btn btn-sm btn-info ms-1" onclick="redeliverOrder(${order.id})">补送</button>`;
        actions += `<button class="btn btn-sm btn-danger ms-1" onclick="refundOrder(${order.id})">退款</button>`;
    }
    
    return actions;
}

async function loadRoutesView() {
    const date = document.getElementById('routesDate').value || currentDate;
    
    const routesResponse = await fetch('/api/routes');
    const routes = await routesResponse.json();
    
    const ordersResponse = await fetch(`/api/orders?date=${date}`);
    const orders = await ordersResponse.json();
    
    const container = document.getElementById('routesContainer');
    container.innerHTML = '';
    
    const unassignedOrders = orders.filter(o => !o.route_id);
    if (unassignedOrders.length > 0) {
        container.innerHTML += `
            <div class="col-12 col-md-4">
                <div class="card">
                    <div class="card-header bg-secondary text-white">
                        <h5>待分配 (${unassignedOrders.length})</h5>
                    </div>
                    <div class="card-body">
                        ${renderRouteOrders(unassignedOrders)}
                    </div>
                </div>
            </div>
        `;
    }
    
    routes.forEach(route => {
        const routeOrders = orders.filter(o => o.route_id === route.id);
        container.innerHTML += `
            <div class="col-12 col-md-4">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5>${route.name} (${routeOrders.length})</h5>
                        <small>司机: ${route.driver_name} - ${route.driver_phone}</small>
                    </div>
                    <div class="card-body">
                        ${renderRouteOrders(routeOrders)}
                    </div>
                </div>
            </div>
        `;
    });
}

function renderRouteOrders(orders) {
    if (orders.length === 0) {
        return '<p class="text-muted text-center">暂无订单</p>';
    }
    
    return orders.map(order => `
        <div class="card order-card mb-2" onclick="viewOrder(${order.id})">
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${order.elder_name}</h6>
                        <small class="text-muted">${order.elder_address}</small>
                    </div>
                    ${getStatusBadge(order.status)}
                </div>
                <div class="mt-2">
                    <small>${order.package_name}</small>
                </div>
            </div>
        </div>
    `).join('');
}

function renderEldersTable() {
    const tbody = document.querySelector('#eldersTable tbody');
    tbody.innerHTML = allElders.map(elder => `
        <tr>
            <td>${elder.id}</td>
            <td>${elder.name}</td>
            <td>${elder.gender || '-'}</td>
            <td>${elder.age || '-'}</td>
            <td>${elder.phone || '-'}</td>
            <td>${elder.community || '-'}</td>
            <td>${elder.address}</td>
            <td>${elder.forbidden_ingredients ? `<span class="badge bg-danger">${elder.forbidden_ingredients}</span>` : '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewElder(${elder.id})">详情</button>
            </td>
        </tr>
    `).join('');
}

async function loadExceptions() {
    const date = document.getElementById('exceptionsDate').value || currentDate;
    const response = await fetch(`/api/orders?date=${date}&status=exception`);
    const orders = await response.json();
    
    const tbody = document.querySelector('#exceptionsTable tbody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无异常订单</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.elder_name}</td>
            <td>${order.elder_phone || '-'}</td>
            <td>${order.package_name}</td>
            <td><span class="badge bg-warning text-dark">${order.exception_reason}</span></td>
            <td>${order.follow_up || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewOrder(${order.id})">详情</button>
                <button class="btn btn-sm btn-info" onclick="redeliverOrder(${order.id})">补送</button>
                <button class="btn btn-sm btn-danger" onclick="refundOrder(${order.id})">退款</button>
            </td>
        </tr>
    `).join('');
}

async function loadOrders() {
    const date = document.getElementById('ordersDate').value;
    const status = document.getElementById('ordersStatus').value;
    const routeId = document.getElementById('ordersRoute').value;
    
    let url = '/api/orders?';
    if (date) url += `date=${date}&`;
    if (status) url += `status=${status}&`;
    if (routeId) url += `routeId=${routeId}&`;
    
    const response = await fetch(url);
    const orders = await response.json();
    
    const tbody = document.querySelector('#ordersTable tbody');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无订单</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.elder_name}</td>
            <td>${order.package_name}</td>
            <td>${order.order_date}</td>
            <td>${order.route_name || '未分配'}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewOrder(${order.id})">详情</button>
            </td>
        </tr>
    `).join('');
}

async function loadHistory() {
    const response = await fetch('/api/operations');
    const operations = await response.json();
    
    const tbody = document.querySelector('#historyTable tbody');
    if (operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无操作记录</td></tr>';
        return;
    }
    
    tbody.innerHTML = operations.map(op => `
        <tr>
            <td>${formatDateTime(op.created_at)}</td>
            <td>#${op.order_id}</td>
            <td>${op.elder_name}</td>
            <td><span class="badge bg-primary">${op.operation_type}</span></td>
            <td>${op.operation_detail}</td>
            <td>${op.operator}</td>
        </tr>
    `).join('');
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge bg-secondary status-badge">待分配</span>',
        'assigned': '<span class="badge bg-info status-badge">已分配</span>',
        'signed': '<span class="badge bg-success status-badge">已签收</span>',
        'exception': '<span class="badge bg-warning text-dark status-badge">异常</span>',
        'refunded': '<span class="badge bg-danger status-badge">已退款</span>'
    };
    return badges[status] || status;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}

async function viewOrder(orderId) {
    const response = await fetch(`/api/orders/${orderId}`);
    const order = await response.json();
    
    const body = document.getElementById('orderDetailBody');
    body.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>订单信息</h6>
                <table class="table table-sm">
                    <tr><td>订单ID:</td><td>#${order.id}</td></tr>
                    <tr><td>订单日期:</td><td>${order.order_date}</td></tr>
                    <tr><td>状态:</td><td>${getStatusBadge(order.status)}</td></tr>
                    <tr><td>套餐:</td><td>${order.package_name}</td></tr>
                    <tr><td>套餐食材:</td><td>${order.package_ingredients || '-'}</td></tr>
                    <tr><td>路线:</td><td>${order.route_name || '未分配'}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>老人信息</h6>
                <table class="table table-sm">
                    <tr><td>姓名:</td><td>${order.elder_name}</td></tr>
                    <tr><td>电话:</td><td>${order.elder_phone || '-'}</td></tr>
                    <tr><td>地址:</td><td>${order.elder_address}</td></tr>
                    <tr><td>饮食偏好:</td><td>${order.dietary_preferences || '-'}</td></tr>
                    <tr><td>备注:</td><td>${order.notes || '-'}</td></tr>
                    <tr><td>禁忌食材:</td><td>${order.elder_forbidden_ingredients ? `<span class="badge bg-danger">${order.elder_forbidden_ingredients}</span>` : '-'}</td></tr>
                </table>
            </div>
        </div>
        
        ${order.exception_reason ? `
        <div class="alert alert-warning mt-3">
            <strong>异常原因:</strong> ${order.exception_reason}
        </div>
        ` : ''}
        
        ${order.sign_time ? `
        <div class="alert alert-success mt-3">
            <strong>签收时间:</strong> ${formatDateTime(order.sign_time)} | 
            <strong>签收人:</strong> ${order.sign_by || '-'}
        </div>
        ` : ''}
        
        <h6 class="mt-4">操作记录</h6>
        <div class="timeline">
            ${order.operations.map(op => `
                <div class="timeline-item">
                    <div class="d-flex justify-content-between">
                        <span class="badge bg-primary">${op.operation_type}</span>
                        <small class="text-muted">${formatDateTime(op.created_at)}</small>
                    </div>
                    <div>${op.operation_detail}</div>
                    <small class="text-muted">操作人: ${op.operator}</small>
                </div>
            `).join('')}
        </div>
        
        <div class="mt-4">
            <h6>快捷操作</h6>
            <div class="btn-group">
                ${order.status === 'pending' ? `<button class="btn btn-success" onclick="openAssignRouteModal(${order.id}); closeModal('orderDetailModal');">分配路线</button>` : ''}
                ${order.status === 'assigned' ? `
                    <button class="btn btn-success" onclick="signOrder(${order.id}); closeModal('orderDetailModal');">签收</button>
                    <button class="btn btn-warning" onclick="markException(${order.id}); closeModal('orderDetailModal');">标记异常</button>
                ` : ''}
                ${order.status === 'exception' ? `
                    <button class="btn btn-info" onclick="redeliverOrder(${order.id}); closeModal('orderDetailModal');">补送</button>
                    <button class="btn btn-danger" onclick="refundOrder(${order.id}); closeModal('orderDetailModal');">退款</button>
                ` : ''}
            </div>
        </div>
    `;
    
    new bootstrap.Modal(document.getElementById('orderDetailModal')).show();
}

async function viewElder(elderId) {
    const response = await fetch(`/api/elders/${elderId}`);
    const elder = await response.json();
    
    const body = document.getElementById('elderDetailBody');
    body.innerHTML = `
        <h6>基本信息</h6>
        <table class="table table-sm mb-4">
            <tr><td>姓名:</td><td>${elder.name}</td></tr>
            <tr><td>性别:</td><td>${elder.gender || '-'}</td></tr>
            <tr><td>年龄:</td><td>${elder.age || '-'}</td></tr>
            <tr><td>电话:</td><td>${elder.phone || '-'}</td></tr>
            <tr><td>社区:</td><td>${elder.community || '-'}</td></tr>
            <tr><td>地址:</td><td>${elder.address}</td></tr>
            <tr><td>紧急联系人:</td><td>${elder.contact_person || '-'} (${elder.contact_phone || '-'})</td></tr>
            <tr><td>饮食偏好:</td><td>${elder.dietary_preferences || '-'}</td></tr>
            <tr><td>禁忌食材:</td><td>${elder.forbidden_ingredients ? `<span class="badge bg-danger">${elder.forbidden_ingredients}</span>` : '-'}</td></tr>
            <tr><td>备注:</td><td>${elder.notes || '-'}</td></tr>
        </table>
        
        <h6>历史订单</h6>
        <div class="table-responsive">
            <table class="table table-sm table-striped">
                <thead>
                    <tr>
                        <th>订单ID</th>
                        <th>日期</th>
                        <th>套餐</th>
                        <th>路线</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${elder.orders.length === 0 ? '<tr><td colspan="5" class="text-center">暂无历史订单</td></tr>' : 
                      elder.orders.map(order => `
                        <tr>
                            <td>#${order.id}</td>
                            <td>${order.order_date}</td>
                            <td>${order.package_name}</td>
                            <td>${order.route_name || '-'}</td>
                            <td>${getStatusBadge(order.status)}</td>
                        </tr>
                      `).join('')
                    }
                </tbody>
            </table>
        </div>
    `;
    
    new bootstrap.Modal(document.getElementById('elderDetailModal')).show();
}

function closeModal(modalId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
    if (modal) modal.hide();
}

async function submitOrder() {
    const elderId = document.getElementById('newOrderElder').value;
    const packageId = document.getElementById('newOrderPackage').value;
    const orderDate = document.getElementById('newOrderDate').value;
    
    if (!elderId || !packageId || !orderDate) {
        showToast('请填写所有必填项', 'error');
        return;
    }
    
    const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elder_id: elderId, package_id: packageId, order_date: orderDate })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        showToast('订单创建成功', 'success');
        closeModal('createOrderModal');
        loadAllData();
    } else {
        if (result.code === 'FORBIDDEN_INGREDIENT') {
            document.getElementById('conflictWarning').innerHTML = `
                <strong>禁忌食材冲突!</strong> ${result.error}<br>
                <small>请更换套餐或点击"强制创建"继续（需说明原因）</small>
            `;
            document.getElementById('conflictWarning').classList.remove('d-none');
            document.getElementById('createOrderBtn').classList.add('d-none');
            document.getElementById('forceCreateBtn').classList.remove('d-none');
        } else {
            showToast(result.error, 'error');
        }
    }
}

async function forceCreateOrder() {
    const elderId = document.getElementById('newOrderElder').value;
    const packageId = document.getElementById('newOrderPackage').value;
    const orderDate = document.getElementById('newOrderDate').value;
    
    const reason = prompt('请说明强制创建的原因：');
    if (!reason) {
        showToast('必须说明原因', 'error');
        return;
    }
    
    const response = await fetch('/api/orders/force-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            elder_id: elderId, 
            package_id: packageId, 
            order_date: orderDate,
            force_reason: reason
        })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        showToast('订单创建成功（强制）', 'success');
        closeModal('createOrderModal');
        loadAllData();
    } else {
        showToast(result.error, 'error');
    }
}

let currentAssigningOrderId = null;

function openAssignRouteModal(orderId) {
    currentAssigningOrderId = orderId;
    
    let routeHtml = '<div class="mb-3"><label class="form-label">选择路线：</label><select id="assignRouteSelect" class="form-select">';
    allRoutes.forEach(route => {
        routeHtml += `<option value="${route.id}">${route.name} (司机: ${route.driver_name})</option>`;
    });
    routeHtml += '</select></div>';
    routeHtml += '<button class="btn btn-primary" onclick="assignRoute()">确认分配</button>';
    
    document.getElementById('orderDetailBody').innerHTML = `
        <h5>为订单 #${orderId} 分配路线</h5>
        ${routeHtml}
    `;
    
    new bootstrap.Modal(document.getElementById('orderDetailModal')).show();
}

async function assignRoute() {
    const routeId = document.getElementById('assignRouteSelect').value;
    
    const response = await fetch(`/api/orders/${currentAssigningOrderId}/assign-route`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: parseInt(routeId) })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        showToast('路线分配成功', 'success');
        closeModal('orderDetailModal');
        loadAllData();
    } else {
        showToast(result.error, 'error');
    }
}

async function signOrder(orderId) {
    const signBy = prompt('请输入签收人姓名（默认：配送员）：', '配送员');
    if (signBy === null) return;
    
    const response = await fetch(`/api/orders/${orderId}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_by: signBy })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        showToast('签收成功', 'success');
        loadAllData();
    } else {
        showToast(result.error, 'error');
    }
}

async function markException(orderId) {
    const reasons = ['老人不在家', '电话无法联系', '地址错误', '老人拒绝签收', '其他'];
    let reasonHtml = reasons.map(r => `<option value="${r}">${r}</option>`).join('');
    
    document.getElementById('orderDetailBody').innerHTML = `
        <h5>标记异常 - 订单 #${orderId}</h5>
        <div class="mb-3">
            <label class="form-label">异常原因：</label>
            <select id="exceptionReasonSelect" class="form-select">
                ${reasonHtml}
            </select>
        </div>
        <div class="mb-3">
            <label class="form-label">详细说明：</label>
            <textarea id="exceptionDetail" class="form-control" rows="3"></textarea>
        </div>
        <button class="btn btn-warning" onclick="submitException(${orderId})">确认标记异常</button>
    `;
    
    new bootstrap.Modal(document.getElementById('orderDetailModal')).show();
}

async function submitException(orderId) {
    const reason = document.getElementById('exceptionReasonSelect').value;
    const detail = document.getElementById('exceptionDetail').value;
    const fullReason = detail ? `${reason} - ${detail}` : reason;
    
    const response = await fetch(`/api/orders/${orderId}/exception`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exception_reason: fullReason })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        showToast('已标记异常', 'success');
        closeModal('orderDetailModal');
        loadAllData();
    } else {
        showToast(result.error, 'error');
    }
}

async function redeliverOrder(orderId) {
    if (!confirm('确认安排补送该订单吗？')) return;
    
    const response = await fetch(`/api/orders/${orderId}/redeliver`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (response.ok) {
        showToast('已安排补送', 'success');
        loadAllData();
    } else {
        showToast(result.error, 'error');
    }
}

async function refundOrder(orderId) {
    const reason = prompt('请输入退款原因：');
    if (reason === null) return;
    
    const response = await fetch(`/api/orders/${orderId}/refund`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
    });
    
    const result = await response.json();
    
    if (response.ok) {
        showToast('退款成功', 'success');
        loadAllData();
    } else {
        showToast(result.error, 'error');
    }
}

function exportDailyReport() {
    const date = document.getElementById('exportDate').value || currentDate;
    window.location.href = `/api/export/daily-report?date=${date}`;
}

async function createSampleData() {
    if (!confirm('生成样例数据将创建多种场景的订单，确定继续吗？')) return;
    
    const date = document.getElementById('dashboardDate').value || currentDate;
    
    const sampleScenarios = [
        { elderIndex: 0, packageIndex: 0, routeIndex: 0, scenario: 'normal_signed', desc: '正常签收' },
        { elderIndex: 1, packageIndex: 1, routeIndex: 0, scenario: 'assigned', desc: '已分配待签收' },
        { elderIndex: 2, packageIndex: 2, routeIndex: 1, scenario: 'exception_away', desc: '老人不在家' },
        { elderIndex: 3, packageIndex: 4, routeIndex: 1, scenario: 'redeliver_success', desc: '补送成功' },
        { elderIndex: 4, packageIndex: 3, routeIndex: 2, scenario: 'refunded', desc: '已退款' },
        { elderIndex: 1, packageIndex: 2, routeIndex: 0, scenario: 'force_create', desc: '禁忌冲突强制创建' }
    ];
    
    let createdCount = 0;
    let errorCount = 0;
    
    for (const scenario of sampleScenarios) {
        try {
            const elder = allElders[scenario.elderIndex];
            const pkg = allPackages[scenario.packageIndex];
            const route = allRoutes[scenario.routeIndex];
            
            if (!elder || !pkg || !route) continue;
            
            let orderId;
            
            if (scenario.scenario === 'force_create') {
                const response = await fetch('/api/orders/force-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        elder_id: elder.id,
                        package_id: pkg.id,
                        order_date: date,
                        force_reason: '测试禁忌食材拦截后修正流转 - 医生确认可食用'
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    errorCount++;
                    continue;
                }
                orderId = result.id;
            } else {
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        elder_id: elder.id,
                        package_id: pkg.id,
                        order_date: date
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    errorCount++;
                    continue;
                }
                orderId = result.id;
            }
            
            await fetch(`/api/orders/${orderId}/assign-route`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ route_id: route.id })
            });
            
            if (scenario.scenario === 'normal_signed') {
                await fetch(`/api/orders/${orderId}/sign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sign_by: '王师傅' })
                });
            } else if (scenario.scenario === 'exception_away') {
                await fetch(`/api/orders/${orderId}/exception`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exception_reason: '老人不在家，电话无人接听' })
                });
            } else if (scenario.scenario === 'redeliver_success') {
                await fetch(`/api/orders/${orderId}/exception`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exception_reason: '老人不在家，电话联系后确认下午在家' })
                });
                await fetch(`/api/orders/${orderId}/redeliver`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                });
                await fetch(`/api/orders/${orderId}/sign`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sign_by: '李师傅（补送）' })
                });
            } else if (scenario.scenario === 'refunded') {
                await fetch(`/api/orders/${orderId}/exception`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exception_reason: '老人外出旅游，无法配送' })
                });
                await fetch(`/api/orders/${orderId}/refund`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: '老人外出旅游' })
                });
            }
            
            createdCount++;
        } catch (e) {
            errorCount++;
        }
    }
    
    showToast(`样例数据生成完成：成功 ${createdCount} 个，忽略 ${errorCount} 个（可能是重复订单）`, createdCount > 0 ? 'success' : 'warning');
    loadAllData();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toastId = 'toast_' + Date.now();
    
    const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : type === 'warning' ? 'bg-warning text-dark' : 'bg-info';
    
    container.innerHTML += `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 3000 });
    toast.show();
    
    setTimeout(() => {
        const el = document.getElementById(toastId);
        if (el) el.remove();
    }, 3500);
}
