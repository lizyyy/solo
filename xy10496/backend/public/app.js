const API_BASE = '';
let selectedWindowId = null;

const BUSINESS_TYPE_MAP = {
    card: '办卡业务',
    after_sale: '售后服务',
    consultation: '咨询服务'
};

const STATUS_MAP = {
    waiting: '等待中',
    calling: '叫号中',
    missed: '已过号',
    completed: '已完成'
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initCustomerForm();
    initStaffActions();
    initHistoryActions();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    loadDashboard();
    setInterval(loadDashboard, 5000);
});

function updateCurrentTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            
            navItems.forEach(i => i.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'staff') {
                loadWindows();
                loadIncompleteNumbers();
            } else if (tabId === 'history') {
                loadHistory();
            } else if (tabId === 'dashboard') {
                loadDashboard();
            }
        });
    });
}

function initCustomerForm() {
    const form = document.getElementById('takeNumberForm');
    const isReservation = document.getElementById('isReservation');
    const reservationIdGroup = document.getElementById('reservationIdGroup');
    
    isReservation.addEventListener('change', () => {
        reservationIdGroup.style.display = isReservation.checked ? 'block' : 'none';
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            businessType: document.getElementById('businessType').value,
            isSenior: document.getElementById('isSenior').checked,
            isReservation: document.getElementById('isReservation').checked,
            reservationId: document.getElementById('reservationId').value.trim()
        };
        
        try {
            const response = await fetch(`${API_BASE}/api/take-number`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            displayTicketResult(result);
        } catch (error) {
            displayError('网络错误，请稍后重试');
        }
    });
}

function displayTicketResult(result) {
    const container = document.getElementById('ticketResult');
    
    if (!result.success) {
        container.innerHTML = `<div class="error-message">${result.message}</div>`;
        return;
    }
    
    const ticket = result.ticket;
    const businessType = BUSINESS_TYPE_MAP[ticket.businessType];
    
    container.innerHTML = `
        <div class="ticket-result">
            <h3>取号成功！</h3>
            <div class="ticket-number-large">${ticket.id}</div>
            <div class="ticket-info">
                <p><strong>姓名：</strong>${ticket.name}</p>
                <p><strong>业务类型：</strong>${businessType}</p>
                <p><strong>取号时间：</strong>${new Date(ticket.createdAt).toLocaleString('zh-CN')}</p>
                ${ticket.isSenior ? '<p><strong>身份：</strong>老年人（优先办理）</p>' : ''}
                ${ticket.isReservation ? `<p><strong>身份：</strong>预约客户（优先办理）</p>` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('takeNumberForm').reset();
    loadDashboard();
}

function displayError(message) {
    const container = document.getElementById('ticketResult');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

function initStaffActions() {
    document.getElementById('btnCallNext').addEventListener('click', callNextNumber);
    document.getElementById('btnMarkMissed').addEventListener('click', markMissed);
    document.getElementById('btnComplete').addEventListener('click', completeNumber);
}

async function loadWindows() {
    try {
        const response = await fetch(`${API_BASE}/api/windows`);
        const windows = await response.json();
        
        const container = document.getElementById('staffWindowSelector');
        container.innerHTML = windows.map(w => `
            <button class="window-select-btn ${selectedWindowId === w.id ? 'selected' : ''}" data-id="${w.id}">
                ${w.name} (${w.status === 'open' ? '营业中' : '已关闭'})
            </button>
        `).join('');
        
        container.querySelectorAll('.window-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedWindowId = parseInt(btn.dataset.id);
                loadWindows();
                loadCurrentWindowNumber();
                document.getElementById('staffActions').style.display = 'block';
            });
        });
    } catch (error) {
        console.error('加载窗口失败:', error);
    }
}

async function loadCurrentWindowNumber() {
    if (!selectedWindowId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/windows`);
        const windows = await response.json();
        const window = windows.find(w => w.id === selectedWindowId);
        
        const display = document.getElementById('staffCurrentNumber');
        
        if (window && window.currentNumber) {
            display.innerHTML = `
                <div class="calling-number">${window.currentNumber.id}</div>
                <div class="calling-name">${window.currentNumber.name}</div>
            `;
        } else {
            display.innerHTML = `<div class="no-number">暂无正在处理的号码</div>`;
        }
    } catch (error) {
        console.error('加载当前号码失败:', error);
    }
}

async function callNextNumber() {
    if (!selectedWindowId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/call-next`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ windowId: selectedWindowId })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            alert(result.message);
            return;
        }
        
        loadCurrentWindowNumber();
        loadDashboard();
        loadIncompleteNumbers();
    } catch (error) {
        alert('操作失败');
    }
}

async function markMissed() {
    if (!selectedWindowId) return;
    
    if (!confirm('确定标记当前号码为过号吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/mark-missed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ windowId: selectedWindowId })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            alert(result.message);
            return;
        }
        
        loadCurrentWindowNumber();
        loadDashboard();
        loadIncompleteNumbers();
    } catch (error) {
        alert('操作失败');
    }
}

async function completeNumber() {
    if (!selectedWindowId) return;
    
    if (!confirm('确定当前号码已完成办理吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ windowId: selectedWindowId })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            alert(result.message);
            return;
        }
        
        loadCurrentWindowNumber();
        loadDashboard();
        loadIncompleteNumbers();
    } catch (error) {
        alert('操作失败');
    }
}

async function loadIncompleteNumbers() {
    try {
        const response = await fetch(`${API_BASE}/api/incomplete`);
        const numbers = await response.json();
        
        const container = document.getElementById('incompleteNumbers');
        
        if (numbers.length === 0) {
            container.innerHTML = '<p style="color: #888;">暂无未完成号码</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="incomplete-list">
                ${numbers.map(t => `
                    <div class="ticket-item">
                        <div>
                            <div class="ticket-number">${t.id}</div>
                            <div class="ticket-meta">
                                ${t.name} | ${BUSINESS_TYPE_MAP[t.businessType]} | 
                                <span class="status-badge ${t.status}">${STATUS_MAP[t.status]}</span>
                            </div>
                        </div>
                        <div class="ticket-meta">
                            取号: ${new Date(t.createdAt).toLocaleTimeString('zh-CN')}
                            ${t.isSenior ? '<span class="ticket-priority">老人</span>' : ''}
                            ${t.isReservation ? '<span class="ticket-priority">预约</span>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('加载未完成号码失败:', error);
    }
}

async function loadDashboard() {
    try {
        const [queuesRes, windowsRes, missedRes, statsRes] = await Promise.all([
            fetch(`${API_BASE}/api/queues`),
            fetch(`${API_BASE}/api/windows`),
            fetch(`${API_BASE}/api/missed`),
            fetch(`${API_BASE}/api/statistics`)
        ]);
        
        const queues = await queuesRes.json();
        const windows = await windowsRes.json();
        const missed = await missedRes.json();
        const stats = await statsRes.json();
        
        updateStats(stats);
        renderQueues(queues);
        renderWindows(windows);
        renderMissed(missed);
    } catch (error) {
        console.error('加载仪表板失败:', error);
    }
}

function updateStats(stats) {
    document.getElementById('statWaiting').textContent = stats.totalWaiting;
    document.getElementById('statCompleted').textContent = stats.totalCompleted;
    document.getElementById('statMissed').textContent = stats.totalMissed;
    document.getElementById('statAvgWait').textContent = stats.avgWaitTime;
}

function renderQueues(queues) {
    const container = document.getElementById('queuesContainer');
    
    container.innerHTML = Object.entries(queues).map(([type, items]) => `
        <div class="queue-card">
            <h3>${BUSINESS_TYPE_MAP[type]} (${items.length}人)</h3>
            ${items.length === 0 
                ? '<p style="color: #888;">暂无等待</p>'
                : items.map((t, i) => `
                    <div class="ticket-item">
                        <div>
                            <div class="ticket-number">${t.id}</div>
                            <div class="ticket-meta">${t.name}</div>
                        </div>
                        <div class="ticket-meta">
                            ${i === 0 ? '<strong>下一位</strong>' : `等${i}位`}
                            ${t.isSenior ? '<span class="ticket-priority">老人</span>' : ''}
                            ${t.isReservation ? '<span class="ticket-priority">预约</span>' : ''}
                        </div>
                    </div>
                `).join('')
            }
        </div>
    `).join('');
}

function renderWindows(windows) {
    const container = document.getElementById('windowsContainer');
    
    container.innerHTML = windows.map(w => `
        <div class="window-card">
            <h3>
                ${w.name}
                <span class="window-status ${w.status}">${w.status === 'open' ? '营业中' : '已关闭'}</span>
            </h3>
            <div class="window-current">
                ${w.currentNumber 
                    ? `<div class="calling-number">${w.currentNumber.id}</div>
                       <div class="ticket-meta">${w.currentNumber.name}</div>`
                    : `<div class="no-number">空闲</div>`
                }
            </div>
            <div class="window-stats">
                <span>今日已处理: ${w.processedToday}人</span>
            </div>
        </div>
    `).join('');
}

function renderMissed(missed) {
    const container = document.getElementById('missedContainer');
    
    if (missed.length === 0) {
        container.innerHTML = '<p style="color: #888; grid-column: 1/-1;">暂无过号</p>';
        return;
    }
    
    container.innerHTML = missed.map(t => `
        <div class="missed-card">
            <div class="ticket-item">
                <div>
                    <div class="ticket-number">${t.id}</div>
                    <div class="ticket-meta">
                        ${t.name} | ${BUSINESS_TYPE_MAP[t.businessType]}
                    </div>
                </div>
                <div class="ticket-meta">
                    重排: ${t.requeueCount}/3 次
                </div>
            </div>
            <button class="requeue-btn" onclick="requeueTicket('${t.id}')">重新入队</button>
        </div>
    `).join('');
}

async function requeueTicket(ticketId) {
    try {
        const response = await fetch(`${API_BASE}/api/requeue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            alert(result.message);
            return;
        }
        
        alert('重新入队成功！');
        loadDashboard();
    } catch (error) {
        alert('操作失败');
    }
}

function initHistoryActions() {
    document.getElementById('btnRefreshHistory').addEventListener('click', loadHistory);
    document.getElementById('btnSearchTicket').addEventListener('click', searchTicket);
    document.getElementById('searchTicketId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchTicket();
    });
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/history/today`);
        const history = await response.json();
        
        const tbody = document.getElementById('historyTableBody');
        
        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #888;">暂无今日历史记录</td></tr>';
            return;
        }
        
        tbody.innerHTML = history.slice().reverse().map(t => `
            <tr>
                <td><strong>${t.id}</strong></td>
                <td>${t.name}</td>
                <td>${BUSINESS_TYPE_MAP[t.businessType]}</td>
                <td><span class="status-badge ${t.status}">${STATUS_MAP[t.status]}</span></td>
                <td>${new Date(t.createdAt).toLocaleString('zh-CN')}</td>
                <td>${t.calledAt ? new Date(t.calledAt).toLocaleString('zh-CN') : '-'}</td>
                <td>${t.completedAt ? new Date(t.completedAt).toLocaleString('zh-CN') : '-'}</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" 
                            onclick="viewTicketDetail('${t.id}')">查看详情</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载历史记录失败:', error);
    }
}

async function searchTicket() {
    const ticketId = document.getElementById('searchTicketId').value.trim().toUpperCase();
    
    if (!ticketId) {
        alert('请输入要查询的号码');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/ticket/${ticketId}`);
        
        if (response.status === 404) {
            alert('未找到该号码');
            return;
        }
        
        const ticket = await response.json();
        renderTicketDetail(ticket);
    } catch (error) {
        alert('查询失败');
    }
}

async function viewTicketDetail(ticketId) {
    try {
        const response = await fetch(`${API_BASE}/api/ticket/${ticketId}`);
        const ticket = await response.json();
        renderTicketDetail(ticket);
    } catch (error) {
        alert('加载详情失败');
    }
}

function renderTicketDetail(ticket) {
    const container = document.getElementById('ticketDetail');
    container.style.display = 'block';
    
    const actionMap = {
        created: '取号',
        called: '叫号',
        missed: '标记过号',
        requeued: '重新入队',
        completed: '完成办理'
    };
    
    container.innerHTML = `
        <h4>号码详情 - ${ticket.id}</h4>
        <div class="detail-item">
            <span class="detail-label">姓名:</span>
            <span class="detail-value">${ticket.name}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">手机号:</span>
            <span class="detail-value">${ticket.phone}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">业务类型:</span>
            <span class="detail-value">${BUSINESS_TYPE_MAP[ticket.businessType]}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">当前状态:</span>
            <span class="detail-value"><span class="status-badge ${ticket.status}">${STATUS_MAP[ticket.status]}</span></span>
        </div>
        <div class="detail-item">
            <span class="detail-label">特殊身份:</span>
            <span class="detail-value">
                ${ticket.isSenior ? '老人 ' : ''}
                ${ticket.isReservation ? '预约客户' : '普通客户'}
            </span>
        </div>
        <div class="detail-item">
            <span class="detail-label">处理窗口:</span>
            <span class="detail-value">${ticket.processedByWindow ? `窗口${ticket.processedByWindow}` : '-'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">重排次数:</span>
            <span class="detail-value">${ticket.requeueCount}/3</span>
        </div>
        <h4 style="margin-top: 20px;">操作历史（争议复查）</h4>
        <ul class="history-list">
            ${ticket.history.map(h => `
                <li>
                    [${new Date(h.timestamp).toLocaleString('zh-CN')}] 
                    ${actionMap[h.action] || h.action}
                    ${h.window ? ` - 窗口${h.window}` : ''}
                </li>
            `).join('')}
        </ul>
    `;
    
    container.scrollIntoView({ behavior: 'smooth' });
}
