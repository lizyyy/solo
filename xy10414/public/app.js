const API = '/api';
let currentPage = 'dashboard';

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.remove('hidden');
}

function hideModal() {
    document.getElementById('modal').classList.add('hidden');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    return date.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

async function fetchData(url) {
    const response = await fetch(API + url);
    return response.json();
}

async function postData(url, data) {
    const response = await fetch(API + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || '操作失败');
    }
    return result;
}

async function loadDashboard() {
    document.getElementById('page-title').textContent = '活动看板';
    const content = document.getElementById('content');
    
    const activities = await fetchData('/activities');
    const families = await fetchData('/families');
    const makeupRequests = await fetchData('/makeup-requests?status=pending');
    const exceptions = await fetchData('/exceptions');
    
    const openExceptions = exceptions.filter(e => e.status === 'open');
    
    content.innerHTML = `
        <div class="demo-scenarios">
            <h3>🎬 演示场景</h3>
            <ul>
                <li>✅ 正常签到：绘本课-李明家庭（李小宝）</li>
                <li>💰 缺席退款：绘本课-王芳家庭（王小花）</li>
                <li>⏳ 补录待审：手工课-李明家庭（李小宝）</li>
                <li>❌ 可演示驳回：点击补录审核页面操作</li>
            </ul>
        </div>
        
        <div class="stats-cards">
            <div class="stat-card purple">
                <h3>活动总数</h3>
                <div class="number">${activities.length}</div>
            </div>
            <div class="stat-card green">
                <h3>家庭数</h3>
                <div class="number">${families.length}</div>
            </div>
            <div class="stat-card orange">
                <h3>待审核补录</h3>
                <div class="number">${makeupRequests.length}</div>
            </div>
            <div class="stat-card red">
                <h3>待处理异常</h3>
                <div class="number">${openExceptions.length}</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h2>活动列表</h2>
                <button class="btn btn-primary" onclick="showCreateActivityModal()">
                    ➕ 新建活动
                </button>
            </div>
            <div class="card-body">
                ${activities.map(activity => renderActivityCard(activity)).join('')}
            </div>
        </div>
    `;
}

function renderActivityCard(activity) {
    const capacityPercent = ((activity.registered_count / activity.capacity) * 100).toFixed(0);
    const today = new Date().toISOString().split('T')[0];
    const isPast = activity.date < today;
    
    return `
        <div class="activity-card ${activity.type}">
            <div class="activity-header">
                <div class="activity-info">
                    <h3>${activity.name} <span class="badge badge-purple">${activity.type}</span></h3>
                    <div class="activity-meta">
                        <span>📅 ${formatDate(activity.date)}</span>
                        <span>🕐 ${activity.time}</span>
                        <span>📍 ${activity.location}</span>
                        <span>⭐ ${activity.points}积分</span>
                        <span>⏰ 补录窗口${activity.makeup_window_hours}小时</span>
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="showActivityDetail(${activity.id})">
                    查看详情
                </button>
            </div>
            <div class="activity-stats">
                <div class="stat-item">
                    <div class="value">${activity.registered_count}/${activity.capacity}</div>
                    <div class="label">已报名</div>
                </div>
                <div class="stat-item">
                    <div class="value">${activity.checkedin_count || 0}</div>
                    <div class="label">已签到</div>
                </div>
                <div class="stat-item">
                    <div class="value">${activity.active_count || 0}</div>
                    <div class="label">有效报名</div>
                </div>
            </div>
            <div class="progress-bar">
                <div class="fill" style="width: ${Math.min(capacityPercent, 100)}%"></div>
            </div>
        </div>
    `;
}

async function showActivityDetail(activityId) {
    const data = await fetchData(`/activities/${activityId}`);
    const { activity, registrations } = data;
    
    const registrationsHtml = registrations.length ? registrations.map(r => {
        const statusBadge = r.is_refunded ? 
            '<span class="badge badge-danger">已退款</span>' :
            r.is_checkedin ? 
                '<span class="badge badge-success">已签到</span>' :
                r.makeup_status === 'pending' ?
                    '<span class="badge badge-warning">补录待审</span>' :
                    r.makeup_status === 'approved' ?
                        '<span class="badge badge-success">补录通过</span>' :
                        r.makeup_status === 'rejected' ?
                            '<span class="badge badge-danger">补录驳回</span>' :
                            '<span class="badge badge-info">待签到</span>';
        
        return `
            <tr>
                <td>${r.family_name}</td>
                <td>${r.child_name || '-'}</td>
                <td>${r.phone || '-'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        ${!r.is_checkedin && !r.is_refunded && r.makeup_status !== 'pending' ? `
                            <button class="btn btn-success btn-sm" onclick="handleCheckin(${r.id})">签到</button>
                        ` : ''}
                        ${!r.is_checkedin && !r.is_refunded && !r.makeup_status ? `
                            <button class="btn btn-warning btn-sm" onclick="showMakeupModal(${r.id})">申请补录</button>
                        ` : ''}
                        ${!r.is_checkedin && !r.is_refunded ? `
                            <button class="btn btn-danger btn-sm" onclick="showRefundModal(${r.id})">退款</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="5" class="empty-state">暂无报名</td></tr>';
    
    showModal('活动详情', `
        <div class="detail-section">
            <h3>${activity.name}</h3>
            <div class="activity-meta">
                <span>📅 ${formatDate(activity.date)}</span>
                <span>🕐 ${activity.time}</span>
                <span>📍 ${activity.location}</span>
                <span>👥 ${activity.registered_count}/${activity.capacity}人</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>报名列表 (${registrations.length})</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>家庭</th>
                        <th>孩子姓名</th>
                        <th>联系电话</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${registrationsHtml}
                </tbody>
            </table>
        </div>
        
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="hideModal()">关闭</button>
        </div>
    `);
}

async function handleCheckin(registrationId) {
    try {
        await postData('/checkins', { registration_id: registrationId, operator: '运营' });
        showToast('签到成功，积分已发放！', 'success');
        hideModal();
        loadCurrentPage();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function showMakeupModal(registrationId) {
    showModal('申请补录', `
        <div class="form-group">
            <label>补录原因</label>
            <textarea id="makeup-reason" placeholder="请说明未签到但实际参加的原因..."></textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="hideModal()">取消</button>
            <button class="btn btn-primary" onclick="submitMakeup(${registrationId})">提交申请</button>
        </div>
    `);
}

async function submitMakeup(registrationId) {
    const reason = document.getElementById('makeup-reason').value;
    if (!reason.trim()) {
        showToast('请填写补录原因', 'error');
        return;
    }
    
    try {
        await postData('/makeup-requests', { registration_id: registrationId, reason });
        showToast('补录申请已提交', 'success');
        hideModal();
        loadCurrentPage();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function showRefundModal(registrationId) {
    showModal('缺席退款', `
        <div class="form-group">
            <label>退款原因</label>
            <textarea id="refund-reason" placeholder="请说明缺席退款的原因..."></textarea>
        </div>
        <p style="color: #666; font-size: 13px; margin-bottom: 16px;">
            ⚠️ 退款后将扣除已发放的积分，且无法再签到或补录
        </p>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="hideModal()">取消</button>
            <button class="btn btn-danger" onclick="submitRefund(${registrationId})">确认退款</button>
        </div>
    `);
}

async function submitRefund(registrationId) {
    const reason = document.getElementById('refund-reason').value;
    if (!reason.trim()) {
        showToast('请填写退款原因', 'error');
        return;
    }
    
    try {
        await postData('/refunds', { registration_id: registrationId, reason, operator: '运营' });
        showToast('退款成功，积分已扣除', 'success');
        hideModal();
        loadCurrentPage();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function showCreateActivityModal() {
    const today = new Date().toISOString().split('T')[0];
    showModal('新建活动', `
        <div class="form-group">
            <label>活动名称</label>
            <input type="text" id="activity-name" placeholder="例如：奇妙绘本之旅">
        </div>
        <div class="form-group">
            <label>活动类型</label>
            <select id="activity-type">
                <option value="绘本课">绘本课</option>
                <option value="手工课">手工课</option>
                <option value="户外活动">户外活动</option>
            </select>
        </div>
        <div class="form-group">
            <label>活动日期</label>
            <input type="date" id="activity-date" value="${today}">
        </div>
        <div class="form-group">
            <label>活动时间</label>
            <input type="time" id="activity-time" value="10:00">
        </div>
        <div class="form-group">
            <label>活动地点</label>
            <input type="text" id="activity-location" placeholder="例如：绘本室A">
        </div>
        <div class="form-group">
            <label>名额</label>
            <input type="number" id="activity-capacity" value="10" min="1">
        </div>
        <div class="form-group">
            <label>签到积分</label>
            <input type="number" id="activity-points" value="10" min="0">
        </div>
        <div class="form-group">
            <label>补录时间窗口（小时）</label>
            <input type="number" id="activity-window" value="24" min="1">
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="hideModal()">取消</button>
            <button class="btn btn-primary" onclick="createActivity()">创建活动</button>
        </div>
    `);
}

async function createActivity() {
    const name = document.getElementById('activity-name').value;
    const type = document.getElementById('activity-type').value;
    const date = document.getElementById('activity-date').value;
    const time = document.getElementById('activity-time').value;
    const location = document.getElementById('activity-location').value;
    const capacity = parseInt(document.getElementById('activity-capacity').value);
    const points = parseInt(document.getElementById('activity-points').value);
    const makeup_window_hours = parseInt(document.getElementById('activity-window').value);
    
    if (!name || !date || !time || !location) {
        showToast('请填写完整信息', 'error');
        return;
    }
    
    try {
        await postData('/activities', { name, type, date, time, location, capacity, points, makeup_window_hours });
        showToast('活动创建成功', 'success');
        hideModal();
        loadCurrentPage();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function loadFamilies() {
    document.getElementById('page-title').textContent = '家庭管理';
    const content = document.getElementById('content');
    
    const families = await fetchData('/families');
    
    content.innerHTML = `
        <div class="stats-cards">
            <div class="stat-card purple">
                <h3>总家庭数</h3>
                <div class="number">${families.length}</div>
            </div>
            <div class="stat-card green">
                <h3>总积分</h3>
                <div class="number">${families.reduce((sum, f) => sum + (f.total_points || 0), 0)}</div>
            </div>
        </div>
        
        <div class="families-grid">
            ${families.map(family => `
                <div class="family-card" onclick="showFamilyDetail(${family.id})">
                    <h3>👨‍👩‍👧 ${family.name}</h3>
                    <p style="color: #666; font-size: 14px;">📞 ${family.phone || '未填写'}</p>
                    <div class="family-stats">
                        <div class="stat-item">
                            <div class="value" style="font-size: 18px;">${family.registration_count || 0}</div>
                            <div class="label">报名次数</div>
                        </div>
                        <div class="stat-item">
                            <div class="value" style="font-size: 18px;">${family.checkin_count || 0}</div>
                            <div class="label">签到次数</div>
                        </div>
                        <div class="stat-item">
                            <div class="value" style="font-size: 18px; color: #667eea;">${family.total_points || 0}</div>
                            <div class="label">当前积分</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function showFamilyDetail(familyId) {
    const data = await fetchData(`/families/${familyId}`);
    const { family, registrations, pointsHistory, makeupRequests } = data;
    
    const registrationsHtml = registrations.length ? registrations.map(r => {
        const statusBadge = r.is_refunded ? 
            '<span class="badge badge-danger">已退款</span>' :
            r.is_checkedin ? 
                `<span class="badge badge-success">${r.checkin_type === 'makeup' ? '补录签到' : '已签到'}</span>` :
                r.makeup_status === 'pending' ?
                    '<span class="badge badge-warning">补录待审</span>' :
                    r.makeup_status === 'approved' ?
                        '<span class="badge badge-success">补录通过</span>' :
                        r.makeup_status === 'rejected' ?
                            '<span class="badge badge-danger">补录驳回</span>' :
                            '<span class="badge badge-info">待签到</span>';
        
        return `
            <tr>
                <td>${r.activity_name}</td>
                <td><span class="badge badge-purple">${r.activity_type}</span></td>
                <td>${formatDate(r.activity_date)} ${r.activity_time}</td>
                <td>${statusBadge}</td>
                <td>${r.checkin_time ? formatDateTime(r.checkin_time) : '-'}</td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="5" class="empty-state">暂无报名记录</td></tr>';
    
    const pointsHtml = pointsHistory.length ? pointsHistory.map(p => `
        <tr>
            <td>${formatDateTime(p.created_at)}</td>
            <td>${p.activity_name || '-'}</td>
            <td>
                <span class="${p.type === 'earn' ? 'points-positive' : 'points-negative'}">
                    ${p.type === 'earn' ? '+' : ''}${p.points}
                </span>
            </td>
            <td>${p.description || (p.type === 'earn' ? '签到积分' : '积分扣除')}</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="empty-state">暂无积分记录</td></tr>';
    
    const makeupHtml = makeupRequests.length ? makeupRequests.map(m => {
        const statusBadge = m.status === 'pending' ? '<span class="badge badge-warning">待审核</span>' :
            m.status === 'approved' ? '<span class="badge badge-success">已通过</span>' :
            '<span class="badge badge-danger">已驳回</span>';
        return `
            <tr>
                <td>${m.activity_name}</td>
                <td>${formatDate(m.activity_date)}</td>
                <td>${m.reason}</td>
                <td>${statusBadge}</td>
                <td>${m.review_comment || '-'}</td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="5" class="empty-state">暂无补录申请</td></tr>';
    
    showModal('家庭详情', `
        <div class="family-detail-header">
            <div>
                <h3>👨‍👩‍👧 ${family.name}</h3>
                <p style="color: #666; margin-top: 8px;">📞 ${family.phone || '未填写电话'}</p>
            </div>
            <div class="family-points-display">
                <div class="points-label">当前积分</div>
                <div class="points-value">${family.total_points || 0}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>报名记录</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>活动</th>
                        <th>类型</th>
                        <th>时间</th>
                        <th>状态</th>
                        <th>签到时间</th>
                    </tr>
                </thead>
                <tbody>
                    ${registrationsHtml}
                </tbody>
            </table>
        </div>
        
        <div class="detail-section">
            <h3>积分流水</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>时间</th>
                        <th>活动</th>
                        <th>积分</th>
                        <th>说明</th>
                    </tr>
                </thead>
                <tbody>
                    ${pointsHtml}
                </tbody>
            </table>
        </div>
        
        <div class="detail-section">
            <h3>补录申请</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>活动</th>
                        <th>日期</th>
                        <th>原因</th>
                        <th>状态</th>
                        <th>审核意见</th>
                    </tr>
                </thead>
                <tbody>
                    ${makeupHtml}
                </tbody>
            </table>
        </div>
        
        <div class="compare-section">
            <h4>📊 运营视角：补录前后积分变化</h4>
            <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
                可在"参与统计"页面查看该家庭详细的积分变化对比
            </p>
            <button class="btn btn-primary btn-sm" onclick="hideModal(); navigateTo('stats'); setTimeout(() => showFamilyPointsCompare(${family.id}), 500);">
                查看积分对比 →
            </button>
        </div>
        
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="hideModal()">关闭</button>
        </div>
    `);
}

async function loadPoints() {
    document.getElementById('page-title').textContent = '积分流水';
    const content = document.getElementById('content');
    
    const records = await fetchData('/points-records');
    
    content.innerHTML = `
        <div class="stats-cards">
            <div class="stat-card purple">
                <h3>记录总数</h3>
                <div class="number">${records.length}</div>
            </div>
            <div class="stat-card green">
                <h3>总发放积分</h3>
                <div class="number">${records.filter(r => r.points > 0).reduce((sum, r) => sum + r.points, 0)}</div>
            </div>
            <div class="stat-card red">
                <h3>总扣除积分</h3>
                <div class="number">${Math.abs(records.filter(r => r.points < 0).reduce((sum, r) => sum + r.points, 0))}</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h2>积分流水</h2>
            </div>
            <div class="card-body">
                ${records.length ? `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>家庭</th>
                                <th>活动</th>
                                <th>积分</th>
                                <th>说明</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.map(p => `
                                <tr>
                                    <td>${formatDateTime(p.created_at)}</td>
                                    <td>${p.family_name}</td>
                                    <td>${p.activity_name || '-'}</td>
                                    <td>
                                        <span class="${p.points > 0 ? 'points-positive' : 'points-negative'}">
                                            ${p.points > 0 ? '+' : ''}${p.points}
                                        </span>
                                    </td>
                                    <td>${p.description || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <div class="empty-state">
                        <div class="icon">⭐</div>
                        <p>暂无积分记录</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

async function loadMakeup() {
    document.getElementById('page-title').textContent = '补录审核';
    const content = document.getElementById('content');
    
    const pending = await fetchData('/makeup-requests?status=pending');
    const approved = await fetchData('/makeup-requests?status=approved');
    const rejected = await fetchData('/makeup-requests?status=rejected');
    
    content.innerHTML = `
        <div class="stats-cards">
            <div class="stat-card orange">
                <h3>待审核</h3>
                <div class="number">${pending.length}</div>
            </div>
            <div class="stat-card green">
                <h3>已通过</h3>
                <div class="number">${approved.length}</div>
            </div>
            <div class="stat-card red">
                <h3>已驳回</h3>
                <div class="number">${rejected.length}</div>
            </div>
        </div>
        
        <div class="tabs">
            <div class="tab active" data-tab="pending">待审核 (${pending.length})</div>
            <div class="tab" data-tab="approved">已通过 (${approved.length})</div>
            <div class="tab" data-tab="rejected">已驳回 (${rejected.length})</div>
        </div>
        
        <div id="makeup-tab-content">
            ${renderMakeupList(pending, 'pending')}
        </div>
    `;
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            const data = tabName === 'pending' ? pending : tabName === 'approved' ? approved : rejected;
            document.getElementById('makeup-tab-content').innerHTML = renderMakeupList(data, tabName);
        });
    });
}

function renderMakeupList(requests, status) {
    if (!requests.length) {
        return `
            <div class="empty-state">
                <div class="icon">📝</div>
                <p>${status === 'pending' ? '暂无待审核的补录申请' : '暂无记录'}</p>
            </div>
        `;
    }
    
    return `
        <div class="card">
            <div class="card-body">
                <table class="table">
                    <thead>
                        <tr>
                            <th>申请时间</th>
                            <th>活动</th>
                            <th>家庭</th>
                            <th>孩子</th>
                            <th>原因</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td>${formatDateTime(r.requested_at)}</td>
                                <td>${r.activity_name}<br><small>${formatDate(r.activity_date)} ${r.activity_time}</small></td>
                                <td>${r.family_name}</td>
                                <td>${r.child_name || '-'}</td>
                                <td style="max-width: 250px;">${r.reason}</td>
                                <td>
                                    ${status === 'pending' ? `
                                        <div class="action-buttons">
                                            <button class="btn btn-success btn-sm" onclick="approveMakeup(${r.id})">通过</button>
                                            <button class="btn btn-danger btn-sm" onclick="showRejectModal(${r.id})">驳回</button>
                                        </div>
                                    ` : status === 'approved' ? 
                                        '<span class="badge badge-success">已通过</span>' :
                                        '<span class="badge badge-danger">已驳回</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function approveMakeup(requestId) {
    try {
        await postData(`/makeup-requests/${requestId}/approve`, { reviewer: '运营', review_comment: '确认实际参加' });
        showToast('补录通过，积分已补发！', 'success');
        loadCurrentPage();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function showRejectModal(requestId) {
    showModal('驳回补录申请', `
        <div class="form-group">
            <label>驳回原因</label>
            <textarea id="reject-reason" placeholder="请说明驳回原因...">资料不足，无法确认实际参加</textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="hideModal()">取消</button>
            <button class="btn btn-danger" onclick="rejectMakeup(${requestId})">确认驳回</button>
        </div>
    `);
}

async function rejectMakeup(requestId) {
    const reason = document.getElementById('reject-reason').value;
    try {
        await postData(`/makeup-requests/${requestId}/reject`, { reviewer: '运营', review_comment: reason });
        showToast('已驳回补录申请', 'info');
        hideModal();
        loadCurrentPage();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function loadExceptions() {
    document.getElementById('page-title').textContent = '异常列表';
    const content = document.getElementById('content');
    
    const exceptions = await fetchData('/exceptions');
    
    const typeLabels = {
        'late_makeup': '签到超时',
        'makeup_request': '补录申请',
        'makeup_rejected': '补录驳回',
        'refund': '缺席退款'
    };
    
    content.innerHTML = `
        <div class="stats-cards">
            <div class="stat-card red">
                <h3>待处理</h3>
                <div class="number">${exceptions.filter(e => e.status === 'open').length}</div>
            </div>
            <div class="stat-card green">
                <h3>已处理</h3>
                <div class="number">${exceptions.filter(e => e.status === 'resolved').length}</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h2>异常记录</h2>
            </div>
            <div class="card-body">
                ${exceptions.length ? `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>类型</th>
                                <th>活动</th>
                                <th>家庭</th>
                                <th>描述</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${exceptions.map(e => `
                                <tr>
                                    <td>${formatDateTime(e.created_at)}</td>
                                    <td><span class="badge badge-warning">${typeLabels[e.type] || e.type}</span></td>
                                    <td>${e.activity_name || '-'}</td>
                                    <td>${e.family_name || '-'}</td>
                                    <td>${e.description}</td>
                                    <td>
                                        ${e.status === 'open' ? 
                                            '<span class="badge badge-danger">待处理</span>' : 
                                            '<span class="badge badge-success">已处理</span>'
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <div class="empty-state">
                        <div class="icon">⚠️</div>
                        <p>暂无异常记录</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

async function loadStats() {
    document.getElementById('page-title').textContent = '参与统计';
    const content = document.getElementById('content');
    
    const stats = await fetchData('/stats/participation');
    const families = await fetchData('/families');
    
    content.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>按家庭查看积分变化</h2>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label>选择家庭查看补录前后积分变化</label>
                    <select id="family-select" style="max-width: 300px;">
                        <option value="">-- 请选择家庭 --</option>
                        ${families.map(f => `<option value="${f.id}">${f.name} (当前${f.total_points || 0}积分)</option>`).join('')}
                    </select>
                </div>
                <div id="family-compare-result"></div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h2>活动参与统计</h2>
                <button class="btn btn-primary" onclick="exportStats()">
                    📥 导出CSV
                </button>
            </div>
            <div class="card-body">
                ${stats.length ? `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>活动</th>
                                <th>类型</th>
                                <th>日期</th>
                                <th>名额</th>
                                <th>已报名</th>
                                <th>已签到</th>
                                <th>退款</th>
                                <th>补录</th>
                                <th>出勤率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.map(s => {
                                const attendanceRate = s.registered_count > 0 
                                    ? ((s.checkedin_count / s.registered_count) * 100).toFixed(0) + '%'
                                    : '-';
                                return `
                                    <tr>
                                        <td>${s.activity_name}</td>
                                        <td><span class="badge badge-purple">${s.activity_type}</span></td>
                                        <td>${formatDate(s.activity_date)}</td>
                                        <td>${s.capacity}</td>
                                        <td>${s.registered_count}</td>
                                        <td>${s.checkedin_count}</td>
                                        <td>${s.refunded_count}</td>
                                        <td>${s.makeup_count}</td>
                                        <td><span class="badge badge-success">${attendanceRate}</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                ` : `
                    <div class="empty-state">
                        <div class="icon">📈</div>
                        <p>暂无统计数据</p>
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.getElementById('family-select').addEventListener('change', (e) => {
        if (e.target.value) {
            showFamilyPointsCompare(e.target.value);
        } else {
            document.getElementById('family-compare-result').innerHTML = '';
        }
    });
}

async function showFamilyPointsCompare(familyId) {
    if (!familyId) return;
    
    try {
        const data = await fetchData(`/stats/family-points?family_id=${familyId}`);
        const { family, points_history } = data;
        
        const normalPoints = points_history.filter(p => p.earn_type === 'normal' && p.points > 0)
            .reduce((sum, p) => sum + p.points, 0);
        const makeupPoints = points_history.filter(p => p.earn_type === 'makeup' && p.points > 0)
            .reduce((sum, p) => sum + p.points, 0);
        const deductedPoints = Math.abs(points_history.filter(p => p.points < 0)
            .reduce((sum, p) => sum + p.points, 0));
        
        const historyHtml = points_history.length ? points_history.map(p => `
            <div class="registration-item">
                <strong>${p.activity_name || '系统调整'}</strong><br>
                <span style="color: #666;">${formatDateTime(p.created_at)}</span>
                <span class="${p.points > 0 ? 'points-positive' : 'points-negative'}" style="float: right; font-weight: 600;">
                    ${p.points > 0 ? '+' : ''}${p.points}
                    ${p.earn_type === 'makeup' ? ' (补录)' : ''}
                </span>
                <div style="color: #999; font-size: 12px; margin-top: 4px;">${p.description || '-'}</div>
            </div>
        `).join('') : '<p style="color: #999;">暂无积分记录</p>';
        
        const resultHtml = `
            <div class="compare-section">
                <h4>📊 ${family.name} 的积分变化分析</h4>
                <div class="compare-row">
                    <span class="label">正常签到获得</span>
                    <span class="value points-positive">+${normalPoints}</span>
                </div>
                <div class="compare-row">
                    <span class="label">补录补发获得</span>
                    <span class="value points-positive">+${makeupPoints}</span>
                </div>
                <div class="compare-row">
                    <span class="label">退款/扣除</span>
                    <span class="value points-negative">-${deductedPoints}</span>
                </div>
                <div class="compare-row" style="border-top: 2px solid #e8d8ff; padding-top: 12px; margin-top: 8px;">
                    <span class="label" style="font-weight: 600;">当前总积分</span>
                    <span class="value" style="font-size: 20px; color: #667eea;">${family.current_points}</span>
                </div>
            </div>
            
            <div class="detail-section" style="margin-top: 24px;">
                <h3>📋 积分明细</h3>
                ${historyHtml}
            </div>
        `;
        
        const resultDiv = document.getElementById('family-compare-result');
        if (resultDiv) {
            resultDiv.innerHTML = resultHtml;
        } else {
            showModal(`${family.name} 积分变化`, resultHtml + `
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="hideModal()">关闭</button>
                </div>
            `);
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function exportStats() {
    fetch('/api/stats/participation')
        .then(res => res.json())
        .then(stats => {
            const headers = ['活动名称', '类型', '日期', '名额', '已报名', '已签到', '退款数', '补录数', '出勤率'];
            const rows = stats.map(s => {
                const rate = s.registered_count > 0 ? ((s.checkedin_count / s.registered_count) * 100).toFixed(0) + '%' : '-';
                return [s.activity_name, s.activity_type, s.activity_date, s.capacity, s.registered_count, s.checkedin_count, s.refunded_count, s.makeup_count, rate];
            });
            
            const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `活动参与统计_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('导出成功', 'success');
        });
}

function loadCurrentPage() {
    switch (currentPage) {
        case 'dashboard': loadDashboard(); break;
        case 'families': loadFamilies(); break;
        case 'points': loadPoints(); break;
        case 'makeup': loadMakeup(); break;
        case 'exceptions': loadExceptions(); break;
        case 'stats': loadStats(); break;
    }
}

function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.menu li').forEach(li => {
        li.classList.toggle('active', li.dataset.page === page);
    });
    loadCurrentPage();
}

function init() {
    document.querySelectorAll('.menu li').forEach(li => {
        li.addEventListener('click', () => navigateTo(li.dataset.page));
    });
    
    document.querySelector('.close-btn').addEventListener('click', hideModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') hideModal();
    });
    
    document.getElementById('refresh-btn').addEventListener('click', loadCurrentPage);
    
    loadCurrentPage();
}

document.addEventListener('DOMContentLoaded', init);
