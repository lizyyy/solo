let requests = [];
let rules = [];
let environments = [];
let approvals = [];
let replays = [];
let comparisons = [];
let auditLogs = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModal();
    loadDashboard();
});

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            item.classList.add('active');
            const tabId = item.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            loadTabData(tabId);
        });
    });
}

function initModal() {
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') {
            closeModal();
        }
    });
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function showModal(type, data = null) {
    const modalContent = document.getElementById('modalContent');
    let html = '';
    
    switch(type) {
        case 'newRequest':
            html = getNewRequestModal();
            break;
        case 'newRule':
            html = getNewRuleModal();
            break;
        case 'newEnvironment':
            html = getNewEnvironmentModal();
            break;
        case 'newApproval':
            html = getNewApprovalModal();
            break;
        case 'newReplay':
            html = getNewReplayModal();
            break;
        case 'newComparison':
            html = getNewComparisonModal();
            break;
        case 'viewRequest':
            html = getViewRequestModal(data);
            break;
        case 'viewReplay':
            html = getViewReplayModal(data);
            break;
        case 'maskPreview':
            html = getMaskPreviewModal();
            break;
    }
    
    modalContent.innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

async function loadTabData(tabId) {
    switch(tabId) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'requests':
            await loadRequests();
            break;
        case 'rules':
            await loadRules();
            break;
        case 'environments':
            await loadEnvironments();
            break;
        case 'approvals':
            await loadApprovals();
            break;
        case 'replays':
            await loadReplays();
            break;
        case 'comparisons':
            await loadComparisons();
            break;
        case 'audit':
            await loadAuditLogs();
            break;
    }
}

async function loadDashboard() {
    const [reqs, ruleList, envList, replayList] = await Promise.all([
        API.getRequests(),
        API.getRules(),
        API.getEnvironments(),
        API.getReplays(),
    ]);
    
    requests = reqs.items || [];
    rules = ruleList;
    environments = envList;
    replays = replayList;
    
    document.getElementById('statRequests').textContent = requests.length;
    document.getElementById('statRules').textContent = rules.length;
    document.getElementById('statEnvs').textContent = environments.length;
    document.getElementById('statReplays').textContent = replays.length;
    
    const recent = replays.slice(0, 5);
    const recentHtml = recent.length ? 
        `<table class="data-table">
            <thead><tr><th>请求ID</th><th>状态</th><th>响应码</th><th>耗时</th></tr></thead>
            <tbody>${recent.map(r => `
                <tr>
                    <td>${r.request_id}</td>
                    <td><span class="status-badge status-${r.status}">${r.status}</span></td>
                    <td>${r.response_status || '-'}</td>
                    <td>${r.response_time_ms || '-'} ms</td>
                </tr>
            `).join('')}</tbody>
        </table>` : 
        '<div class="empty-state">暂无重放记录</div>';
    
    document.getElementById('recentReplays').innerHTML = recentHtml;
}

async function loadRequests() {
    const search = document.getElementById('searchRequest').value;
    const status = document.getElementById('filterStatus').value;
    
    const result = await API.getRequests(1, search, status);
    requests = result.items || [];
    
    const tbody = document.getElementById('requestsTable');
    tbody.innerHTML = requests.length ? requests.map(r => `
        <tr>
            <td>${r.request_id}</td>
            <td><span class="tag">${r.method}</span></td>
            <td>${r.url}</td>
            <td>${r.source || '-'}</td>
            <td><span class="status-badge status-${r.status}">${r.status}</span></td>
            <td>${new Date(r.captured_at).toLocaleString()}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="showModal('viewRequest', ${JSON.stringify(r).replace(/"/g, '&quot;')})">查看</button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="empty-state">暂无请求</td></tr>';
}

async function loadRules() {
    rules = await API.getRules();
    
    const grid = document.getElementById('rulesGrid');
    grid.innerHTML = rules.length ? rules.map(r => `
        <div class="rule-card">
            <h4>${r.name}</h4>
            <p>${r.description || ''}</p>
            <div class="rule-meta">
                <span class="tag tag-${r.mask_type}">${r.mask_type}</span>
                <span class="tag">字段: ${r.field_path}</span>
                ${r.is_active ? '<span class="tag tag-dev">启用</span>' : '<span class="tag tag-prod">禁用</span>'}
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-small btn-danger" onclick="deleteRule(${r.id})">删除</button>
            </div>
        </div>
    `).join('') : '<div class="empty-state">暂无脱敏规则</div>';
}

async function loadEnvironments() {
    environments = await API.getEnvironments();
    
    const grid = document.getElementById('envsGrid');
    grid.innerHTML = environments.length ? environments.map(e => `
        <div class="env-card">
            <h4>${e.name}</h4>
            <p>${e.base_url}</p>
            <p>${e.description || ''}</p>
            <div class="env-meta">
                ${e.is_production ? '<span class="tag tag-prod">生产环境</span>' : '<span class="tag tag-dev">测试环境</span>'}
                ${e.requires_approval ? '<span class="tag tag-approval">需审批</span>' : '<span class="tag tag-dev">无需审批</span>'}
            </div>
        </div>
    `).join('') : '<div class="empty-state">暂无环境配置</div>';
}

async function loadApprovals() {
    approvals = await API.getApprovals();
    
    const tbody = document.getElementById('approvalsTable');
    tbody.innerHTML = approvals.length ? approvals.map(a => `
        <tr>
            <td>${a.request_id}</td>
            <td>${a.environment_id}</td>
            <td>${a.requester}</td>
            <td>${a.reason || '-'}</td>
            <td><span class="status-badge status-${a.status}">${a.status}</span></td>
            <td>${new Date(a.requested_at).toLocaleString()}</td>
            <td>
                ${a.status === 'pending' ? `
                    <button class="btn btn-small btn-success" onclick="approve(${a.id})">批准</button>
                    <button class="btn btn-small btn-danger" onclick="reject(${a.id})">拒绝</button>
                ` : '-'}
            </td>
        </tr>
    `).join('') : '<tr><td colspan="8" class="empty-state">暂无审批记录</td></tr>';
}

async function loadReplays() {
    replays = await API.getReplays();
    
    const tbody = document.getElementById('replaysTable');
    tbody.innerHTML = replays.length ? replays.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.request_id}</td>
            <td>${r.environment_id}</td>
            <td><span class="status-badge status-${r.status}">${r.status}</span></td>
            <td>${r.response_status || '-'}</td>
            <td>${r.response_time_ms || '-'} ms</td>
            <td>${r.started_at ? new Date(r.started_at).toLocaleString() : '-'}</td>
            <td>
                <button class="btn btn-small btn-info" onclick="showModal('viewReplay', ${JSON.stringify(r).replace(/"/g, '&quot;')})">详情</button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="9" class="empty-state">暂无重放记录</td></tr>';
}

async function loadComparisons() {
    comparisons = await API.getComparisons();
    
    const list = document.getElementById('comparisonsList');
    list.innerHTML = comparisons.length ? comparisons.map(c => `
        <div class="comparison-item">
            <h4>对比 #${c.id}</h4>
            <p>基线: ${c.baseline_result_id} | 对比: ${c.comparison_result_id}</p>
            <div class="similarity-bar">
                <div class="similarity-fill" style="width: ${c.body_similarity * 100}%"></div>
            </div>
            <p>相似度: ${(c.body_similarity * 100).toFixed(1)}% | 状态码: ${c.status_code_match ? '一致' : '不一致'}</p>
            <p>${c.comparison_summary}</p>
        </div>
    `).join('') : '<div class="empty-state">暂无对比记录</div>';
}

async function loadAuditLogs() {
    const result = await API.getAuditLogs();
    auditLogs = result.items || [];
    
    const tbody = document.getElementById('auditTable');
    tbody.innerHTML = auditLogs.length ? auditLogs.map(a => `
        <tr>
            <td>${new Date(a.created_at).toLocaleString()}</td>
            <td>${a.action}</td>
            <td>${a.entity_type || '-'}</td>
            <td>${a.entity_id || '-'}</td>
            <td>${a.user || '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="5" class="empty-state">暂无审计日志</td></tr>';
}

async function initDemoData() {
    await API.initDemo();
    await loadDashboard();
    alert('演示数据已初始化！');
}

async function showMaskPreview() {
    showModal('maskPreview');
}

async function runMaskPreview() {
    try {
        const input = JSON.parse(document.getElementById('maskInput').value);
        const result = await API.previewMask(input);
        
        document.getElementById('maskOriginal').textContent = JSON.stringify(result.original, null, 2);
        document.getElementById('maskMasked').textContent = JSON.stringify(result.masked, null, 2);
    } catch(e) {
        alert('JSON格式错误');
    }
}

async function createRequest() {
    const data = {
        request_id: document.getElementById('reqId').value || undefined,
        method: document.getElementById('reqMethod').value,
        url: document.getElementById('reqUrl').value,
        headers: JSON.parse(document.getElementById('reqHeaders').value || '{}'),
        body: JSON.parse(document.getElementById('reqBody').value || '{}'),
        source: document.getElementById('reqSource').value,
    };
    
    await API.createRequest(data);
    closeModal();
    loadRequests();
}

async function createRule() {
    const data = {
        name: document.getElementById('ruleName').value,
        description: document.getElementById('ruleDesc').value,
        field_path: document.getElementById('ruleField').value,
        mask_type: document.getElementById('ruleType').value,
        mask_pattern: document.getElementById('rulePattern').value || null,
        is_active: true,
    };
    
    await API.createRule(data);
    closeModal();
    loadRules();
}

async function deleteRule(id) {
    if (confirm('确定删除此规则？')) {
        await API.deleteRule(id);
        loadRules();
    }
}

async function createEnvironment() {
    const data = {
        name: document.getElementById('envName').value,
        base_url: document.getElementById('envBaseUrl').value,
        description: document.getElementById('envDesc').value,
        is_production: document.getElementById('envIsProd').checked,
        requires_approval: document.getElementById('envNeedsApproval').checked,
        headers: JSON.parse(document.getElementById('envHeaders').value || '{}'),
    };
    
    await API.createEnvironment(data);
    closeModal();
    loadEnvironments();
}

async function createApproval() {
    const data = {
        request_id: document.getElementById('appReqId').value,
        environment_id: parseInt(document.getElementById('appEnvId').value),
        requester: document.getElementById('appRequester').value,
        reason: document.getElementById('appReason').value,
    };
    
    await API.createApproval(data);
    closeModal();
    loadApprovals();
}

async function approve(id) {
    const note = prompt('审批备注:');
    if (note !== null) {
        await API.approve(id, 'Admin', note);
        loadApprovals();
    }
}

async function reject(id) {
    const note = prompt('拒绝原因:');
    if (note !== null) {
        await API.reject(id, 'Admin', note);
        loadApprovals();
    }
}

async function executeReplay() {
    const data = {
        request_id: document.getElementById('replayReqId').value,
        environment_id: parseInt(document.getElementById('replayEnvId').value),
        executed_by: 'Admin',
    };
    
    const result = await API.executeReplay(data);
    if (result.error) {
        alert(result.error);
        return;
    }
    closeModal();
    loadReplays();
}

async function createComparison() {
    await API.createComparison(
        parseInt(document.getElementById('compBaseline').value),
        parseInt(document.getElementById('compComparison').value)
    );
    closeModal();
    loadComparisons();
}

function getNewRequestModal() {
    return `
        <div class="modal-header">
            <h3>新建请求</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>请求ID (可选)</label>
            <input type="text" id="reqId" class="form-input">
        </div>
        <div class="form-group">
            <label>方法</label>
            <select id="reqMethod" class="form-select">
                <option>POST</option>
                <option>GET</option>
                <option>PUT</option>
                <option>DELETE</option>
            </select>
        </div>
        <div class="form-group">
            <label>URL路径</label>
            <input type="text" id="reqUrl" class="form-input" value="/post">
        </div>
        <div class="form-group">
            <label>来源</label>
            <input type="text" id="reqSource" class="form-input" value="manual">
        </div>
        <div class="form-group">
            <label>Headers (JSON)</label>
            <textarea id="reqHeaders" class="form-textarea">{"Content-Type": "application/json"}</textarea>
        </div>
        <div class="form-group">
            <label>Body (JSON)</label>
            <textarea id="reqBody" class="form-textarea">{"phone": "13800138000", "email": "test@example.com", "secret_key": "sk-xxx"}</textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="createRequest()">创建</button>
        </div>
    `;
}

function getNewRuleModal() {
    return `
        <div class="modal-header">
            <h3>新建脱敏规则</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>规则名称</label>
            <input type="text" id="ruleName" class="form-input" value="手机号脱敏">
        </div>
        <div class="form-group">
            <label>描述</label>
            <input type="text" id="ruleDesc" class="form-input" value="对手机号中间4位打码">
        </div>
        <div class="form-group">
            <label>字段路径</label>
            <input type="text" id="ruleField" class="form-input" value="phone">
        </div>
        <div class="form-group">
            <label>脱敏类型</label>
            <select id="ruleType" class="form-select">
                <option value="phone">手机号</option>
                <option value="email">邮箱</option>
                <option value="full">完全脱敏</option>
                <option value="partial">部分脱敏</option>
                <option value="regex">正则替换</option>
            </select>
        </div>
        <div class="form-group">
            <label>正则模式 (regex类型时使用)</label>
            <input type="text" id="rulePattern" class="form-input">
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="createRule()">创建</button>
        </div>
    `;
}

function getNewEnvironmentModal() {
    return `
        <div class="modal-header">
            <h3>新建环境</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>环境名称</label>
            <input type="text" id="envName" class="form-input" value="测试环境">
        </div>
        <div class="form-group">
            <label>基础URL</label>
            <input type="text" id="envBaseUrl" class="form-input" value="https://httpbin.org">
        </div>
        <div class="form-group">
            <label>描述</label>
            <input type="text" id="envDesc" class="form-input">
        </div>
        <div class="form-group">
            <label>Headers (JSON)</label>
            <textarea id="envHeaders" class="form-textarea">{}</textarea>
        </div>
        <div class="form-group">
            <label><input type="checkbox" id="envIsProd"> 生产环境</label>
        </div>
        <div class="form-group">
            <label><input type="checkbox" id="envNeedsApproval"> 需要审批</label>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="createEnvironment()">创建</button>
        </div>
    `;
}

function getNewApprovalModal() {
    return `
        <div class="modal-header">
            <h3>申请授权</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>请求ID</label>
            <input type="text" id="appReqId" class="form-input" value="req_demo_001">
        </div>
        <div class="form-group">
            <label>环境ID</label>
            <select id="appEnvId" class="form-select">
                ${environments.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>申请人</label>
            <input type="text" id="appRequester" class="form-input" value="Admin">
        </div>
        <div class="form-group">
            <label>申请原因</label>
            <textarea id="appReason" class="form-textarea">生产环境重放验证</textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="createApproval()">提交</button>
        </div>
    `;
}

function getNewReplayModal() {
    return `
        <div class="modal-header">
            <h3>执行重放</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>请求ID</label>
            <select id="replayReqId" class="form-select">
                ${requests.map(r => `<option value="${r.request_id}">${r.request_id}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>目标环境</label>
            <select id="replayEnvId" class="form-select">
                ${environments.map(e => `<option value="${e.id}">${e.name} (${e.base_url})</option>`).join('')}
            </select>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="executeReplay()">执行</button>
        </div>
    `;
}

function getNewComparisonModal() {
    return `
        <div class="modal-header">
            <h3>新建对比</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>基线结果ID</label>
            <select id="compBaseline" class="form-select">
                ${replays.map(r => `<option value="${r.id}">#${r.id} - ${r.request_id}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>对比结果ID</label>
            <select id="compComparison" class="form-select">
                ${replays.map(r => `<option value="${r.id}">#${r.id} - ${r.request_id}</option>`).join('')}
            </select>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="createComparison()">对比</button>
        </div>
    `;
}

function getViewRequestModal(r) {
    return `
        <div class="modal-header">
            <h3>请求详情 - ${r.request_id}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>Method</label>
            <div>${r.method}</div>
        </div>
        <div class="form-group">
            <label>URL</label>
            <div>${r.url}</div>
        </div>
        <div class="form-group">
            <label>Headers</label>
            <pre class="code-block">${JSON.stringify(r.headers, null, 2)}</pre>
        </div>
        <div class="form-group">
            <label>Body</label>
            <pre class="code-block">${JSON.stringify(r.body, null, 2)}</pre>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
        </div>
    `;
}

function getViewReplayModal(r) {
    return `
        <div class="modal-header">
            <h3>重放结果 - #${r.id}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>状态</label>
            <span class="status-badge status-${r.status}">${r.status}</span>
        </div>
        <div class="form-group">
            <label>响应码</label>
            <div>${r.response_status || '-'}</div>
        </div>
        <div class="form-group">
            <label>耗时</label>
            <div>${r.response_time_ms || '-'} ms</div>
        </div>
        ${r.masked_body ? `
        <div class="form-group">
            <label>脱敏后请求体</label>
            <pre class="code-block">${JSON.stringify(r.masked_body, null, 2)}</pre>
        </div>` : ''}
        ${r.response_body ? `
        <div class="form-group">
            <label>响应</label>
            <pre class="code-block">${typeof r.response_body === 'string' ? r.response_body : JSON.stringify(r.response_body, null, 2)}</pre>
        </div>` : ''}
        ${r.error_message ? `
        <div class="form-group">
            <label>错误信息</label>
            <pre class="code-block">${r.error_message}</pre>
        </div>` : ''}
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
        </div>
    `;
}

function getMaskPreviewModal() {
    return `
        <div class="modal-header">
            <h3>脱敏预览</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group">
            <label>输入JSON</label>
            <textarea id="maskInput" class="form-textarea">{"phone": "13812345678", "email": "user@example.com", "secret_key": "sk-test-123"}</textarea>
        </div>
        <div style="margin-bottom: 16px;">
            <button class="btn btn-primary" onclick="runMaskPreview()">预览效果</button>
        </div>
        <div class="json-diff">
            <div>
                <h5>原始数据</h5>
                <pre id="maskOriginal" class="code-block">-</pre>
            </div>
            <div>
                <h5>脱敏后数据</h5>
                <pre id="maskMasked" class="code-block">-</pre>
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
        </div>
    `;
}
