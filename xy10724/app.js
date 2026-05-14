const API_BASE = 'http://localhost:5000';
let currentPage = 1;
let currentEventId = null;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadEvents();
    loadPartners();
});

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();
        
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-success').textContent = stats.success;
        document.getElementById('stat-failed').textContent = stats.failed;
        document.getElementById('stat-pending').textContent = stats.pending;
        document.getElementById('stat-manual').textContent = stats.manual_confirmation_required;
        document.getElementById('stat-rolled').textContent = stats.rolled_back;
    } catch (error) {
        console.error('加载统计失败:', error);
    }
}

async function loadPartners() {
    try {
        const response = await fetch(`${API_BASE}/api/partners`);
        const partners = await response.json();
        
        const select = document.getElementById('filter-partner');
        select.innerHTML = '<option value="">全部</option>';
        partners.forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('加载合作方失败:', error);
    }
}

async function loadEvents(page = 1) {
    currentPage = page;
    const status = document.getElementById('filter-status').value;
    const partner = document.getElementById('filter-partner').value;
    const manualOnly = document.getElementById('filter-manual').value;
    
    try {
        let url = `${API_BASE}/api/events?page=${page}&per_page=10`;
        if (status) url += `&status=${status}`;
        if (partner) url += `&partner_code=${partner}`;
        if (manualOnly === 'true') url += `&manual_only=true`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        totalPages = data.pages;
        renderEvents(data.events);
        renderPagination();
    } catch (error) {
        console.error('加载事件失败:', error);
    }
}

function renderEvents(events) {
    const tbody = document.getElementById('events-table');
    tbody.innerHTML = '';
    
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">暂无数据</td></tr>';
        return;
    }
    
    events.forEach(event => {
        const tr = document.createElement('tr');
        const statusClass = `status-${event.status}`;
        const statusText = getStatusText(event.status);
        const manualBadge = event.manual_confirmation ? '<span class="manual-badge">人工确认</span>' : '';
        
        tr.innerHTML = `
            <td style="font-family: monospace; font-size: 11px;">${event.event_id}</td>
            <td>${event.partner_code}</td>
            <td>${event.event_type}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span>${manualBadge}</td>
            <td>${event.retry_count} / ${event.max_retries}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${event.reconcile_summary || '-'}</td>
            <td>${formatDate(event.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-small" onclick="openDetail('${event.event_id}')">查看</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusText(status) {
    const map = {
        'pending': '待处理',
        'success': '成功',
        'failed': '失败',
        'needs_manual': '需人工确认',
        'rolled_back': '已回滚',
        'signature_invalid': '签名无效'
    };
    return map[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderPagination() {
    const container = document.getElementById('pagination');
    container.innerHTML = '';
    
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => loadEvents(currentPage - 1);
    container.appendChild(prevBtn);
    
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.onclick = () => loadEvents(i);
        container.appendChild(btn);
    }
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => loadEvents(currentPage + 1);
    container.appendChild(nextBtn);
}

async function openDetail(eventId) {
    currentEventId = eventId;
    try {
        const response = await fetch(`${API_BASE}/api/events/${eventId}`);
        const data = await response.json();
        
        renderEventDetail(data.event);
        renderLogs(data.logs);
        
        document.getElementById('detail-modal').classList.add('active');
    } catch (error) {
        console.error('加载详情失败:', error);
        showToast('加载详情失败', 'error');
    }
}

function renderEventDetail(event) {
    const basicHtml = `
        <div class="detail-item"><span class="detail-label">事件ID:</span><span class="detail-value">${event.event_id}</span></div>
        <div class="detail-item"><span class="detail-label">合作方:</span><span class="detail-value">${event.partner_code}</span></div>
        <div class="detail-item"><span class="detail-label">类型:</span><span class="detail-value">${event.event_type}</span></div>
        <div class="detail-item"><span class="detail-label">状态:</span><span class="detail-value"><span class="status-badge status-${event.status}">${getStatusText(event.status)}</span></span></div>
        <div class="detail-item"><span class="detail-label">重试次数:</span><span class="detail-value">${event.retry_count} / ${event.max_retries}</span></div>
        <div class="detail-item"><span class="detail-label">对账摘要:</span><span class="detail-value">${event.reconcile_summary || '-'}</span></div>
        <div class="detail-item"><span class="detail-label">人工确认:</span><span class="detail-value">${event.manual_confirmation ? '是' : '否'}</span></div>
        <div class="detail-item"><span class="detail-label">创建时间:</span><span class="detail-value">${formatDate(event.created_at)}</span></div>
    `;
    document.getElementById('detail-basic').innerHTML = basicHtml;
    document.getElementById('detail-signature').value = event.signature;
    document.getElementById('detail-request-data').textContent = event.request_data;
    
    const canCompensate = event.status !== 'success' && event.status !== 'rolled_back';
    document.getElementById('btn-compensate').style.display = canCompensate ? 'block' : 'none';
    document.getElementById('btn-confirm').style.display = event.manual_confirmation ? 'none' : 'block';
    document.getElementById('btn-fix').style.display = event.status !== 'rolled_back' ? 'block' : 'none';
    document.getElementById('btn-rollback').style.display = event.status !== 'rolled_back' ? 'block' : 'none';
}

function renderLogs(logs) {
    const container = document.getElementById('detail-logs');
    
    if (logs.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无补偿日志</p>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-item ${log.success ? 'success' : 'failed'}">
            <div class="log-header">
                <span class="log-attempt">尝试 #${log.attempt_number} ${log.success ? '✓ 成功' : '✗ 失败'}</span>
                <span class="log-time">${formatDate(log.created_at)}</span>
            </div>
            ${log.error_message ? `<div style="color: #ff4d4f; font-size: 12px; margin-bottom: 8px;">错误: ${log.error_message}</div>` : ''}
            ${log.response_status ? `<div style="font-size: 12px; margin-bottom: 8px;">响应状态: ${log.response_status}</div>` : ''}
            <div class="log-data">${log.request_data.substring(0, 500)}${log.request_data.length > 500 ? '...' : ''}</div>
        </div>
    `).join('');
}

async function compensateEvent() {
    if (!currentEventId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/events/${currentEventId}/compensate`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            showToast('补偿执行成功');
            openDetail(currentEventId);
            loadEvents(currentPage);
            loadStats();
        } else {
            showToast(data.error || '补偿失败', 'error');
        }
    } catch (error) {
        console.error('补偿失败:', error);
        showToast('补偿失败: ' + error.message, 'error');
    }
}

async function confirmEvent() {
    if (!currentEventId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/events/${currentEventId}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmed_by: 'admin' })
        });
        
        if (response.ok) {
            showToast('人工确认成功，已重置重试次数');
            openDetail(currentEventId);
            loadEvents(currentPage);
            loadStats();
        } else {
            const data = await response.json();
            showToast(data.error || '确认失败', 'error');
        }
    } catch (error) {
        console.error('确认失败:', error);
        showToast('确认失败', 'error');
    }
}

function openRollbackModal() {
    document.getElementById('detail-modal').classList.remove('active');
    document.getElementById('rollback-modal').classList.add('active');
}

async function executeRollback() {
    if (!currentEventId) return;
    
    const reason = document.getElementById('rollback-reason').value;
    const operator = document.getElementById('rollback-operator').value;
    
    if (!reason) {
        showToast('请输入回滚原因', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/events/${currentEventId}/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason, rolled_back_by: operator })
        });
        
        if (response.ok) {
            showToast('回滚成功');
            closeModal('rollback-modal');
            loadEvents(currentPage);
            loadStats();
        } else {
            const data = await response.json();
            showToast(data.error || '回滚失败', 'error');
        }
    } catch (error) {
        console.error('回滚失败:', error);
        showToast('回滚失败', 'error');
    }
}

async function openFixModal() {
    try {
        const response = await fetch(`${API_BASE}/api/events/${currentEventId}`);
        const data = await response.json();
        
        document.getElementById('fix-callback-url').value = data.event.callback_url;
        document.getElementById('fix-request-data').value = data.event.request_data;
        document.getElementById('fix-reconcile-summary').value = data.event.reconcile_summary || '';
        
        document.getElementById('detail-modal').classList.remove('active');
        document.getElementById('fix-modal').classList.add('active');
    } catch (error) {
        showToast('加载数据失败', 'error');
    }
}

async function executeFix() {
    if (!currentEventId) return;
    
    const callbackUrl = document.getElementById('fix-callback-url').value;
    let requestData = document.getElementById('fix-request-data').value;
    const reconcileSummary = document.getElementById('fix-reconcile-summary').value;
    
    try {
        JSON.parse(requestData);
    } catch (e) {
        showToast('请求数据格式错误，请输入有效的JSON', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/events/${currentEventId}/fix`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_url: callbackUrl,
                request_data: JSON.parse(requestData),
                reconcile_summary: reconcileSummary
            })
        });
        
        if (response.ok) {
            showToast('修正成功');
            closeModal('fix-modal');
            loadEvents(currentPage);
            loadStats();
        } else {
            const data = await response.json();
            showToast(data.error || '修正失败', 'error');
        }
    } catch (error) {
        console.error('修正失败:', error);
        showToast('修正失败', 'error');
    }
}

function openImportModal() {
    document.getElementById('import-modal').classList.add('active');
}

function fillSampleImport() {
    const sampleData = [
        {
            partner_code: "ALIPAY",
            event_id: "SAMPLE_" + Date.now() + "_001",
            event_type: "PAYMENT",
            callback_url: "https://example.com/webhook/alipay",
            request_data: {
                order_id: "ORD20240101001",
                amount: "99.00",
                status: "SUCCESS",
                timestamp: Date.now()
            },
            signature: "invalid_signature_here",
            reconcile_summary: "支付宝订单支付回调"
        },
        {
            partner_code: "WECHAT",
            event_id: "SAMPLE_" + Date.now() + "_002",
            event_type: "REFUND",
            callback_url: "https://example.com/webhook/wechat",
            request_data: {
                order_id: "ORD20240101002",
                refund_amount: "50.00",
                status: "PENDING"
            },
            signature: "another_invalid_signature",
            reconcile_summary: "微信退款回调测试"
        }
    ];
    document.getElementById('import-data').value = JSON.stringify(sampleData, null, 2);
}

async function batchImport() {
    const dataStr = document.getElementById('import-data').value;
    
    try {
        const events = JSON.parse(dataStr);
        
        const response = await fetch(`${API_BASE}/api/batch/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events })
        });
        
        const result = await response.json();
        
        let msg = `成功导入 ${result.success.length} 条`;
        if (result.duplicates.length > 0) msg += `, ${result.duplicates.length} 条重复被跳过`;
        if (result.failed.length > 0) msg += `, ${result.failed.length} 条失败`;
        
        showToast(msg);
        closeModal('import-modal');
        loadEvents(currentPage);
        loadStats();
        loadPartners();
    } catch (error) {
        console.error('导入失败:', error);
        showToast('导入失败: ' + error.message, 'error');
    }
}

async function loadSampleData() {
    if (!confirm('确定要加载样例数据吗？这将创建包含脏数据的测试事件。')) {
        return;
    }
    
    const SECRET_KEY = 'your-secret-key-for-signature';
    
    function generateSignature(data) {
        const dataStr = JSON.stringify(data);
        const crypto = window.crypto || window.msCrypto;
        const encoder = new TextEncoder();
        const keyData = encoder.encode(SECRET_KEY);
        const messageData = encoder.encode(dataStr);
        
        return Array.from(messageData)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('') + '_signed';
    }
    
    const sampleEvents = [
        {
            partner_code: "ALIPAY",
            event_id: "DEMO_ALIPAY_" + Date.now(),
            event_type: "PAYMENT",
            callback_url: "https://httpbin.org/post",
            request_data: {
                order_id: "ALI" + Date.now(),
                amount: "299.50",
                pay_method: "ALIPAY",
                status: "SUCCESS"
            },
            signature: "correct_signature_will_be_verified_on_server",
            reconcile_summary: "支付宝支付回调 - 正常数据",
            max_retries: 3
        },
        {
            partner_code: "WECHAT",
            event_id: "DEMO_WECHAT_" + Date.now() + "_DIRTY",
            event_type: "REFUND",
            callback_url: "https://httpbin.org/status/500",
            request_data: {
                order_id: "WX" + Date.now(),
                refund_amount: "150.00",
                status: "PROCESSING"
            },
            signature: "invalid_signature_12345",
            reconcile_summary: "微信退款回调 - 签名错误（脏数据）",
            max_retries: 3
        },
        {
            partner_code: "UNIONPAY",
            event_id: "DEMO_UNION_" + Date.now(),
            event_type: "SETTLEMENT",
            callback_url: "https://httpbin.org/delay/10",
            request_data: {
                batch_no: "BATCH" + Date.now(),
                total_amount: "10000.00",
                count: 50
            },
            signature: "another_wrong_signature",
            reconcile_summary: "银联结算回调 - 超时模拟",
            max_retries: 2
        }
    ];
    
    try {
        const response = await fetch(`${API_BASE}/api/batch/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: sampleEvents })
        });
        
        const result = await response.json();
        showToast(`样例数据加载完成！成功 ${result.success.length} 条`);
        loadEvents(currentPage);
        loadStats();
        loadPartners();
    } catch (error) {
        console.error('加载样例数据失败:', error);
        showToast('加载样例数据失败', 'error');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

document.getElementById('filter-status').addEventListener('change', () => loadEvents(1));
document.getElementById('filter-partner').addEventListener('change', () => loadEvents(1));
document.getElementById('filter-manual').addEventListener('change', () => loadEvents(1));
