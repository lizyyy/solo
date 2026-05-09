const API_BASE = '';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest(url, options = {}, retryCount = 0) {
    const requestId = options.requestId || generateRequestId();
    const headers = {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw {
                status: response.status,
                message: errorData.error || `HTTP error: ${response.status}`,
                data: errorData
            };
        }

        const data = await response.json();
        return { success: true, data, requestId };
    } catch (error) {
        if (error.status >= 500 && retryCount < MAX_RETRIES) {
            console.warn(`Request failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`, error);
            await delay(RETRY_DELAY * Math.pow(2, retryCount));
            return apiRequest(url, { ...options, requestId }, retryCount + 1);
        }
        throw error;
    }
}

function showMessage(message, type = 'error') {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = type === 'error' ? 'error-message' : 'success-message';
    div.textContent = message;
    container.appendChild(div);
    
    setTimeout(() => {
        div.remove();
    }, 5000);
}

function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.innerHTML = '<span class="loading"></span>处理中...';
    } else {
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        
        if (tab.dataset.tab === 'users') loadUsers();
        if (tab.dataset.tab === 'bills') loadBills();
        if (tab.dataset.tab === 'balance') loadBalance();
        if (tab.dataset.tab === 'audit') loadAuditLogs();
        if (tab.dataset.tab === 'reports') loadReportUsers();
    });
});

async function loadUsers() {
    try {
        const result = await apiRequest(`${API_BASE}/api/users`);
        const users = result.data.data;
        
        const table = document.getElementById('usersTable');
        table.innerHTML = users.map(user => {
            const summary = user.stats || { billsPaid: 0, totalPaid: 0, totalOwed: 0, netBalance: 0 };
            const balanceClass = summary.netBalance >= 0 ? 'amount-positive' : 'amount-negative';
            return `
                <tr>
                    <td>${escapeHtml(user.name)}</td>
                    <td>${new Date(user.created_at).toLocaleString('zh-CN')}</td>
                    <td>${summary.billsPaid}</td>
                    <td>¥${summary.totalPaid.toFixed(2)}</td>
                    <td>¥${summary.totalOwed.toFixed(2)}</td>
                    <td class="${balanceClass}">¥${summary.netBalance.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-danger" onclick="deleteUser('${user.id}')">删除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        showMessage('加载用户失败: ' + error.message);
    }
}

async function addUser() {
    const nameInput = document.getElementById('newUserName');
    const name = nameInput.value.trim();
    const btn = document.getElementById('addUserBtn');
    
    if (!name) {
        showMessage('请输入用户名');
        return;
    }
    
    btn.dataset.originalText = btn.innerHTML;
    setButtonLoading(btn, true);
    
    try {
        await apiRequest(`${API_BASE}/api/users`, {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        
        showMessage('用户添加成功', 'success');
        nameInput.value = '';
        loadUsers();
        refreshDashboard();
    } catch (error) {
        showMessage('添加用户失败: ' + error.message);
    } finally {
        setButtonLoading(btn, false);
    }
}

async function deleteUser(userId) {
    if (!confirm('确定要删除这个用户吗？')) return;
    
    try {
        await apiRequest(`${API_BASE}/api/users/${userId}`, {
            method: 'DELETE'
        });
        
        showMessage('用户删除成功', 'success');
        loadUsers();
        refreshDashboard();
    } catch (error) {
        showMessage('删除用户失败: ' + error.message);
    }
}

async function loadBills() {
    try {
        await loadUserSelects();
        
        const result = await apiRequest(`${API_BASE}/api/bills`);
        const bills = result.data.data;
        const usersResult = await apiRequest(`${API_BASE}/api/users`);
        const users = usersResult.data.data;
        const userMap = new Map(users.map(u => [u.id, u.name]));
        
        const table = document.getElementById('billsTable');
        table.innerHTML = bills.map(bill => `
            <tr>
                <td>${escapeHtml(bill.description)}</td>
                <td>${userMap.get(bill.payer_id) || bill.payer_id}</td>
                <td>¥${bill.total_amount.toFixed(2)}</td>
                <td>${new Date(bill.created_at).toLocaleString('zh-CN')}</td>
                <td>v${bill.version}</td>
                <td>
                    <button class="btn btn-secondary" onclick="openEditModal('${bill.id}')">编辑</button>
                    <button class="btn btn-danger" onclick="deleteBill('${bill.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showMessage('加载账单失败: ' + error.message);
    }
}

async function loadUserSelects() {
    try {
        const result = await apiRequest(`${API_BASE}/api/users`);
        const users = result.data.data;
        
        const options = users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
        
        document.getElementById('billPayer').innerHTML = options;
        document.getElementById('editBillPayer').innerHTML = options;
        document.getElementById('reportUserSelect').innerHTML = options;
        
        if (document.getElementById('splitsContainer').children.length === 0) {
            addSplitRow();
        }
    } catch (error) {
        console.error('Failed to load user selects:', error);
    }
}

function addSplitRow(containerId = 'splitsContainer', preselected = null, amount = null) {
    const container = document.getElementById(containerId);
    const selectId = containerId === 'splitsContainer' ? 'billPayer' : 'editBillPayer';
    const payerSelect = document.getElementById(selectId);
    const options = Array.from(payerSelect.options).map(o => o.outerHTML).join('');
    
    const div = document.createElement('div');
    div.className = 'split-item';
    div.innerHTML = `
        <select style="flex: 1;">
            ${options}
        </select>
        <input type="number" step="0.01" placeholder="金额" style="width: 120px;" value="${amount || ''}">
        <button type="button" class="btn btn-danger" onclick="this.parentElement.remove(); updateSplitTotal();">×</button>
    `;
    
    const select = div.querySelector('select');
    if (preselected) select.value = preselected;
    select.addEventListener('change', updateSplitTotal.bind(null, containerId));
    
    const input = div.querySelector('input');
    input.addEventListener('input', updateSplitTotal.bind(null, containerId));
    
    container.appendChild(div);
    updateSplitTotal(containerId);
}

function addEditSplitRow() {
    addSplitRow('editSplitsContainer');
}

function updateSplitTotal(containerId = 'splitsContainer') {
    const container = document.getElementById(containerId);
    const totalId = containerId === 'splitsContainer' ? 'billTotal' : 'editBillTotal';
    const infoId = containerId === 'splitsContainer' ? 'splitTotalInfo' : 'editSplitTotalInfo';
    
    const totalInput = document.getElementById(totalId);
    const info = document.getElementById(infoId);
    
    const total = parseFloat(totalInput.value) || 0;
    const splits = Array.from(container.querySelectorAll('input')).map(i => parseFloat(i.value) || 0);
    const splitTotal = splits.reduce((a, b) => a + b, 0);
    
    const diff = total - splitTotal;
    const isEqual = Math.abs(diff) < 0.01;
    
    info.innerHTML = `
        <strong>总金额:</strong> ¥${total.toFixed(2)} | 
        <strong>分摊合计:</strong> ¥${splitTotal.toFixed(2)} | 
        <strong>差额:</strong> 
        <span style="color: ${isEqual ? '#059669' : '#dc2626'};">¥${diff.toFixed(2)}</span>
        ${isEqual ? ' ✓' : ' ✗'}
    `;
}

async function createBill() {
    const description = document.getElementById('billDescription').value.trim();
    const payerId = document.getElementById('billPayer').value;
    const totalAmount = parseFloat(document.getElementById('billTotal').value);
    const splits = Array.from(document.getElementById('splitsContainer').querySelectorAll('.split-item'))
        .map(item => ({
            user_id: item.querySelector('select').value,
            amount: parseFloat(item.querySelector('input').value) || 0
        }));
    
    const btn = document.getElementById('createBillBtn');
    btn.dataset.originalText = btn.innerHTML;
    setButtonLoading(btn, true);
    
    try {
        await apiRequest(`${API_BASE}/api/bills`, {
            method: 'POST',
            body: JSON.stringify({
                description,
                payer_id: payerId,
                total_amount: totalAmount,
                splits
            })
        });
        
        showMessage('账单创建成功', 'success');
        document.getElementById('billDescription').value = '';
        document.getElementById('billTotal').value = '';
        document.getElementById('splitsContainer').innerHTML = '';
        addSplitRow();
        
        loadBills();
        refreshDashboard();
    } catch (error) {
        showMessage('创建账单失败: ' + error.message);
    } finally {
        setButtonLoading(btn, false);
    }
}

async function openEditModal(billId) {
    try {
        const result = await apiRequest(`${API_BASE}/api/bills/${billId}`);
        const bill = result.data.data;
        
        await loadUserSelects();
        
        document.getElementById('editBillDescription').value = bill.description;
        document.getElementById('editBillPayer').value = bill.payer_id;
        document.getElementById('editBillTotal').value = bill.total_amount;
        document.getElementById('editBillId').value = bill.id;
        document.getElementById('editBillVersion').value = bill.version;
        
        const container = document.getElementById('editSplitsContainer');
        container.innerHTML = '';
        
        bill.splits.forEach(split => {
            addSplitRow('editSplitsContainer', split.user_id, split.amount);
        });
        
        document.getElementById('editBillModal').classList.add('active');
    } catch (error) {
        showMessage('加载账单失败: ' + error.message);
    }
}

function closeEditModal() {
    document.getElementById('editBillModal').classList.remove('active');
}

async function updateBill() {
    const billId = document.getElementById('editBillId').value;
    const version = parseInt(document.getElementById('editBillVersion').value);
    const description = document.getElementById('editBillDescription').value.trim();
    const payerId = document.getElementById('editBillPayer').value;
    const totalAmount = parseFloat(document.getElementById('editBillTotal').value);
    const splits = Array.from(document.getElementById('editSplitsContainer').querySelectorAll('.split-item'))
        .map(item => ({
            user_id: item.querySelector('select').value,
            amount: parseFloat(item.querySelector('input').value) || 0
        }));
    
    try {
        await apiRequest(`${API_BASE}/api/bills/${billId}`, {
            method: 'PUT',
            body: JSON.stringify({
                description,
                payer_id: payerId,
                total_amount: totalAmount,
                splits,
                version
            })
        });
        
        showMessage('账单更新成功', 'success');
        closeEditModal();
        loadBills();
        refreshDashboard();
    } catch (error) {
        if (error.data && error.data.code === 'CONCURRENCY_CONFLICT') {
            showMessage('并发冲突: 账单已被其他用户修改，请刷新后重试', 'error');
        } else {
            showMessage('更新账单失败: ' + error.message);
        }
    }
}

async function deleteBill(billId) {
    if (!confirm('确定要删除这个账单吗？')) return;
    
    try {
        await apiRequest(`${API_BASE}/api/bills/${billId}`, {
            method: 'DELETE'
        });
        
        showMessage('账单删除成功', 'success');
        loadBills();
        refreshDashboard();
    } catch (error) {
        showMessage('删除账单失败: ' + error.message);
    }
}

async function loadBalance() {
    try {
        const result = await apiRequest(`${API_BASE}/api/bills/settlement`);
        const { balances, settlements } = result.data.data;
        
        const balanceBody = document.querySelector('#balanceTable tbody');
        balanceBody.innerHTML = balances.map(b => {
            const balanceClass = b.balance >= 0 ? 'amount-positive' : 'amount-negative';
            return `
                <tr>
                    <td>${escapeHtml(b.userName)}</td>
                    <td>¥${b.paid.toFixed(2)}</td>
                    <td>¥${b.owed.toFixed(2)}</td>
                    <td class="${balanceClass}">¥${b.balance.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
        
        const settlementBody = document.querySelector('#settlementTable tbody');
        if (settlements.length === 0) {
            settlementBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #6b7280;">无需结算，所有用户净额为0</td></tr>';
        } else {
            settlementBody.innerHTML = settlements.map(s => `
                <tr>
                    <td>${escapeHtml(s.from.userName)}</td>
                    <td>${escapeHtml(s.to.userName)}</td>
                    <td class="amount-negative">¥${s.amount.toFixed(2)}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        showMessage('加载余额失败: ' + error.message);
    }
}

async function refreshDashboard() {
    try {
        const [usersResult, billsResult] = await Promise.all([
            apiRequest(`${API_BASE}/api/users`),
            apiRequest(`${API_BASE}/api/bills`)
        ]);
        
        const users = usersResult.data.data;
        const bills = billsResult.data.data;
        
        document.getElementById('stat-users').textContent = users.length;
        document.getElementById('stat-bills').textContent = bills.length;
        document.getElementById('stat-amount').textContent = '¥' + bills.reduce((sum, b) => sum + b.total_amount, 0).toFixed(2);
    } catch (error) {
        console.error('Failed to refresh dashboard:', error);
    }
}

async function loadReportUsers() {
    try {
        const result = await apiRequest(`${API_BASE}/api/users`);
        const users = result.data.data;
        const select = document.getElementById('reportUserSelect');
        select.innerHTML = users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    } catch (error) {
        console.error('Failed to load report users:', error);
    }
}

function exportFullReport() {
    window.location.href = `${API_BASE}/api/reports/full/download`;
    showMessage('报告下载已开始', 'success');
}

async function exportFullReportAsync() {
    try {
        const result = await apiRequest(`${API_BASE}/api/reports/async/full`, {
            method: 'POST'
        });
        const { taskId } = result.data.data;
        showMessage(`异步报告已排队，任务ID: ${taskId.substr(0, 8)}...`, 'success');
    } catch (error) {
        showMessage('创建异步报告失败: ' + error.message);
    }
}

function exportDateRangeReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    let url = `${API_BASE}/api/reports/date-range/download`;
    const params = [];
    if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
    if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
    if (params.length) url += '?' + params.join('&');
    
    window.location.href = url;
    showMessage('报告下载已开始', 'success');
}

function exportUserReport() {
    const userId = document.getElementById('reportUserSelect').value;
    if (!userId) {
        showMessage('请选择用户');
        return;
    }
    window.location.href = `${API_BASE}/api/reports/user/${userId}/download`;
    showMessage('报告下载已开始', 'success');
}

async function checkFailedTasks() {
    try {
        const result = await apiRequest(`${API_BASE}/api/audit/tasks/failed`);
        const tasks = result.data.data;
        
        const container = document.getElementById('failedTasksContainer');
        if (tasks.length === 0) {
            container.innerHTML = '<p style="color: #059669;">没有失败的任务</p>';
        } else {
            container.innerHTML = tasks.map(task => `
                <div class="card">
                    <strong>任务类型:</strong> ${task.task_type}<br>
                    <strong>尝试次数:</strong> ${task.attempts}/${task.max_attempts}<br>
                    <strong>错误:</strong> ${escapeHtml(task.error_message || '未知')}<br>
                    <button class="btn btn-secondary" onclick="retryTask('${task.id}')">重试</button>
                </div>
            `).join('');
        }
    } catch (error) {
        showMessage('获取失败任务失败: ' + error.message);
    }
}

async function retryTask(taskId) {
    try {
        await apiRequest(`${API_BASE}/api/audit/tasks/${taskId}/retry`, {
            method: 'POST'
        });
        showMessage('任务已重新排队', 'success');
        checkFailedTasks();
    } catch (error) {
        showMessage('重试任务失败: ' + error.message);
    }
}

async function loadAuditLogs() {
    const entityType = document.getElementById('auditTypeFilter').value;
    
    try {
        let url = `${API_BASE}/api/audit`;
        if (entityType) url += `?entityType=${encodeURIComponent(entityType)}`;
        
        const result = await apiRequest(url);
        const logs = result.data.data;
        
        const container = document.getElementById('auditLogs');
        if (logs.length === 0) {
            container.innerHTML = '<p style="color: #6b7280;">暂无操作记录</p>';
        } else {
            container.innerHTML = logs.map(log => `
                <div class="audit-item ${log.operation}">
                    <strong>[${log.operation}]</strong> ${log.entity_type}: ${log.entity_id.substr(0, 8)}...<br>
                    <small>操作人: ${log.performed_by} | ${new Date(log.timestamp).toLocaleString('zh-CN')}</small>
                    ${log.old_value || log.new_value ? '<br><small>' + escapeHtml(JSON.stringify({ old: log.old_value, new: log.new_value })) + '</small>' : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        showMessage('加载审计日志失败: ' + error.message);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    loadUserSelects();
});

window.addEventListener('online', () => {
    showMessage('网络已恢复', 'success');
});

window.addEventListener('offline', () => {
    showMessage('网络已断开，请检查连接', 'error');
});
