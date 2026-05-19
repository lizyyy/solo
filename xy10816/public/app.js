const API_BASE = '';
let allErrorCodes = [];
let teams = [];
let selectedIds = new Set();

async function init() {
    await loadTeams();
    await loadErrorCodes();
    updateStats();
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

async function loadTeams() {
    const result = await fetchAPI('/api/teams');
    if (result.success) {
        teams = result.data;
        populateTeamSelects();
    }
}

function populateTeamSelects() {
    const filterSelect = document.getElementById('filterTeam');
    const createSelect = document.getElementById('createTeamSelect');
    
    teams.forEach(team => {
        filterSelect.add(new Option(team.name, team.id));
        createSelect.add(new Option(team.name, team.id));
    });
}

async function loadErrorCodes(filters = {}) {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
    });
    
    const result = await fetchAPI(`/api/error-codes?${params}`);
    if (result.success) {
        allErrorCodes = result.data;
        renderErrorCodes();
        updateStats();
    }
}

function renderErrorCodes() {
    const tbody = document.getElementById('errorCodeList');
    tbody.innerHTML = '';
    
    allErrorCodes.forEach(code => {
        const tr = document.createElement('tr');
        const statusLabel = getStatusLabel(code.status);
        const teamName = code.team_name || '-';
        
        tr.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" value="${code.id}" onchange="updateSelection()"></td>
            <td><strong>${code.error_code}</strong></td>
            <td><code style="font-size:12px;background:#f5f5f5;padding:2px 6px;border-radius:3px;">${code.api_path}</code></td>
            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${code.user_message}</td>
            <td>${teamName}</td>
            <td><span class="status-badge status-${code.status}">${statusLabel}</span></td>
            <td>v${code.version}</td>
            <td>
                <button onclick="showDetail(${code.id})" class="btn btn-secondary btn-small">详情</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusLabel(status) {
    const labels = {
        'draft': '草稿',
        'pending_approval': '待审批',
        'approved': '已通过',
        'rejected': '已驳回',
        'deprecated': '已废弃',
        'merged': '已归并'
    };
    return labels[status] || status;
}

function updateStats() {
    document.getElementById('totalCount').textContent = allErrorCodes.length;
    document.getElementById('approvedCount').textContent = allErrorCodes.filter(c => c.status === 'approved').length;
    document.getElementById('pendingCount').textContent = allErrorCodes.filter(c => c.status === 'pending_approval').length;
}

function applyFilters() {
    const filters = {
        error_code: document.getElementById('filterErrorCode').value,
        api_path: document.getElementById('filterApiPath').value,
        status: document.getElementById('filterStatus').value,
        team_id: document.getElementById('filterTeam').value
    };
    loadErrorCodes(filters);
}

function resetFilters() {
    document.getElementById('filterErrorCode').value = '';
    document.getElementById('filterApiPath').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterTeam').value = '';
    loadErrorCodes();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        if (cb.checked) {
            selectedIds.add(parseInt(cb.value));
        } else {
            selectedIds.delete(parseInt(cb.value));
        }
    });
    updateSelectionUI();
}

function updateSelection() {
    selectedIds.clear();
    document.querySelectorAll('.row-checkbox:checked').forEach(cb => {
        selectedIds.add(parseInt(cb.value));
    });
    updateSelectionUI();
}

function updateSelectionUI() {
    document.getElementById('selectedCount').textContent = selectedIds.size;
    document.getElementById('batchActions').style.display = selectedIds.size > 0 ? 'flex' : 'none';
}

function showCreateModal() {
    document.getElementById('createModal').classList.add('show');
    document.getElementById('createForm').reset();
}

async function submitCreate() {
    const form = document.getElementById('createForm');
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => data[key] = value);
    
    if (!data.error_code || !data.api_path || !data.user_message) {
        alert('请填写必填字段');
        return;
    }
    
    const result = await fetchAPI('/api/error-codes', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    
    if (result.success) {
        closeModal('createModal');
        loadErrorCodes();
        alert('创建成功！');
    } else {
        alert('创建失败：' + result.error);
    }
}

async function showDetail(id) {
    const result = await fetchAPI(`/api/error-codes/${id}`);
    if (result.success) {
        renderDetail(result.data);
        document.getElementById('detailModal').classList.add('show');
    }
}

function renderDetail(data) {
    const statusExplanation = getStatusExplanation(data);
    const teamInfo = data.team_name ? `${data.team_name} (${data.team_leader || '-'})` : '-';
    
    let historyHtml = data.history && data.history.length > 0 
        ? data.history.map(h => `
            <div class="history-item">
                <div class="time">${h.created_at} - ${h.operator || 'system'}</div>
                <div class="action">${h.action}: ${h.old_value || '-'} → ${h.new_value || '-'}</div>
                ${h.reason ? `<div class="reason">原因: ${h.reason}</div>` : ''}
            </div>
        `).join('')
        : '<p style="color:#999;">暂无变更历史</p>';
    
    let mappingsHtml = data.mappings && data.mappings.length > 0
        ? data.mappings.map(m => `
            <div class="mapping-item">
                <strong>${m.source_system}</strong> → ${m.target_code || '-'}
                <br><small>规则: ${m.mapping_rule || '-'}</small>
            </div>
        `).join('')
        : '<p style="color:#999;">暂无调用映射</p>';
    
    const actionButtons = getActionButtons(data);
    
    document.getElementById('detailContent').innerHTML = `
        <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>错误码</label>
                    <div class="value">${data.error_code}</div>
                </div>
                <div class="detail-item">
                    <label>状态</label>
                    <div class="value"><span class="status-badge status-${data.status}">${getStatusLabel(data.status)}</span></div>
                </div>
                <div class="detail-item">
                    <label>接口路径</label>
                    <div class="value"><code>${data.api_path}</code></div>
                </div>
                <div class="detail-item">
                    <label>版本</label>
                    <div class="value">v${data.version}</div>
                </div>
                <div class="detail-item" style="grid-column: span 2;">
                    <label>归属团队</label>
                    <div class="value">${teamInfo}</div>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>文案信息</h4>
            <div class="detail-grid">
                <div class="detail-item" style="grid-column: span 2;">
                    <label>用户文案</label>
                    <div class="value">${data.user_message}</div>
                </div>
                <div class="detail-item" style="grid-column: span 2;">
                    <label>调试信息</label>
                    <div class="value">${data.debug_message || '-'}</div>
                </div>
                <div class="detail-item" style="grid-column: span 2;">
                    <label>排查建议</label>
                    <div class="value">${data.troubleshooting || '-'}</div>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>状态说明</h4>
            <div style="background:#fff7e6;padding:15px;border-radius:6px;border-left:4px solid #fa8c16;">
                ${statusExplanation}
            </div>
        </div>
        
        <div class="detail-section">
            <h4>变更历史</h4>
            <div class="history-list">${historyHtml}</div>
        </div>
        
        <div class="detail-section">
            <h4>调用映射</h4>
            <div class="mapping-list">${mappingsHtml}</div>
        </div>
        
        <div class="action-buttons">
            ${actionButtons}
        </div>
    `;
    
    window.currentDetailId = data.id;
    window.currentDetailStatus = data.status;
}

function getStatusExplanation(data) {
    const explanations = {
        'draft': '当前为草稿状态，可以编辑修改后提交审批。',
        'pending_approval': `待审批状态，已提交给 ${data.team_name || '相关'} 团队负责人审批。`,
        'approved': `已审批通过，审批人：${data.approved_by || '未知'}，时间：${data.approved_at || '未知'}。`,
        'rejected': '已被驳回，请根据审批意见修改后重新提交。',
        'deprecated': '已废弃，不再推荐新业务使用。',
        'merged': `已归并，从 ${data.merged_from || '其他错误码'} 合并而来，统一使用新的错误码。`
    };
    return explanations[data.status] || '未知状态';
}

function getActionButtons(data) {
    let buttons = '';
    const id = data.id;
    
    if (data.status === 'draft') {
        buttons += `<button onclick="changeStatus(${id}, 'pending_approval')" class="btn btn-primary">提交审批</button>`;
    }
    if (data.status === 'pending_approval') {
        buttons += `<button onclick="changeStatus(${id}, 'approved')" class="btn btn-primary">通过审批</button>`;
        buttons += `<button onclick="changeStatus(${id}, 'rejected')" class="btn btn-secondary">驳回</button>`;
        buttons += `<button onclick="changeStatus(${id}, 'draft')" class="btn btn-secondary">撤回草稿</button>`;
    }
    if (data.status === 'approved') {
        buttons += `<button onclick="changeStatus(${id}, 'deprecated')" class="btn btn-warning">标记废弃</button>`;
    }
    
    return buttons;
}

async function changeStatus(id, newStatus) {
    const reason = prompt('请输入变更原因（可选）：', '');
    const result = await fetchAPI(`/api/error-codes/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, reason: reason || '状态变更', operator: 'admin' })
    });
    
    if (result.success) {
        loadErrorCodes();
        showDetail(id);
        alert('状态更新成功！');
    } else {
        alert('更新失败：' + result.error);
    }
}

function showMergeModal() {
    if (selectedIds.size < 2) {
        alert('请至少选择2个错误码进行归并');
        return;
    }
    document.getElementById('mergeCount').textContent = selectedIds.size;
    document.getElementById('mergeErrorCode').value = '';
    document.getElementById('mergeUserMessage').value = '';
    document.getElementById('mergeModal').classList.add('show');
}

async function submitMerge() {
    const errorCode = document.getElementById('mergeErrorCode').value.trim();
    const userMessage = document.getElementById('mergeUserMessage').value.trim();
    
    if (!errorCode || !userMessage) {
        alert('请填写必填字段');
        return;
    }
    
    const result = await fetchAPI('/api/error-codes/merge', {
        method: 'POST',
        body: JSON.stringify({
            source_ids: Array.from(selectedIds),
            target_data: {
                error_code: errorCode,
                api_path: '/api/common',
                user_message: userMessage
            },
            operator: 'admin'
        })
    });
    
    if (result.success) {
        closeModal('mergeModal');
        selectedIds.clear();
        updateSelectionUI();
        loadErrorCodes();
        alert('归并成功！已创建新错误码并自动审批通过。');
    } else {
        alert('归并失败：' + result.error);
    }
}

async function exportData(format) {
    const filters = {
        error_code: document.getElementById('filterErrorCode').value,
        api_path: document.getElementById('filterApiPath').value,
        status: document.getElementById('filterStatus').value,
        team_id: document.getElementById('filterTeam').value
    };
    
    const params = new URLSearchParams();
    params.append('format', format);
    Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
    });
    
    window.open(`${API_BASE}/api/export?${params}`, '_blank');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

init();
