const API_BASE = 'http://localhost:8000/api';
let currentView = 'dashboard';
let currentDocumentId = null;
let previousView = 'dashboard';
let currentDocument = null;

const statusLabels = {
    'created': '已创建',
    'scanning': '扫描中',
    'scan_completed': '扫描完成',
    'pending_review': '待复核',
    'reviewing': '复核中',
    'review_completed': '复核完成',
    'generating_version': '生成版本中',
    'version_generated': '版本已生成',
    'pending_authorization': '待授权',
    'authorized': '已授权',
    'exporting': '导出中',
    'exported': '已导出',
    'error': '异常'
};

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '请求失败');
        }
        return await response.json();
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

async function apiCallFormData(endpoint, formData) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '请求失败');
        }
        return await response.json();
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function switchView(viewName) {
    previousView = currentView;
    currentView = viewName;
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });
    
    loadViewData(viewName);
}

function goBack() {
    switchView(previousView);
}

async function loadViewData(viewName) {
    switch (viewName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'pending':
            await loadPendingQueue();
            break;
        case 'exception':
            await loadExceptionQueue();
            break;
        case 'all':
            await loadAllDocuments();
            break;
        case 'rules':
            await loadRules();
            break;
    }
}

async function loadDashboard() {
    const documents = await apiCall('/documents/');
    
    document.getElementById('totalDocs').textContent = documents.length;
    document.getElementById('pendingReview').textContent = 
        documents.filter(d => d.status === 'pending_review').length;
    document.getElementById('errorDocs').textContent = 
        documents.filter(d => d.status === 'error').length;
    document.getElementById('exportedDocs').textContent = 
        documents.filter(d => d.status === 'exported').length;
    
    document.getElementById('pendingCount').textContent = 
        documents.filter(d => d.status === 'pending_review').length;
    document.getElementById('exceptionCount').textContent = 
        documents.filter(d => d.status === 'error').length;
    
    const activityList = document.getElementById('recentActivity');
    activityList.innerHTML = '';
    
    const recentDocs = documents.slice(0, 5);
    if (recentDocs.length === 0) {
        activityList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">暂无活动记录</div>
            </div>
        `;
        return;
    }
    
    for (const doc of recentDocs) {
        try {
            const history = await apiCall(`/documents/${doc.id}/history`);
            if (history.length > 0) {
                const lastHistory = history[history.length - 1];
                const item = document.createElement('div');
                item.className = 'activity-item';
                item.innerHTML = `
                    <div class="activity-info">
                        <div class="activity-message">${lastHistory.message || statusLabels[lastHistory.to_status]}</div>
                        <div class="activity-time">${formatTime(lastHistory.created_at)}</div>
                    </div>
                    <div class="activity-doc" onclick="viewDocument(${doc.id})">${doc.filename}</div>
                `;
                activityList.appendChild(item);
            }
        } catch (e) {
        }
    }
}

function renderDocumentList(documents, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (documents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">暂无文档</div>
            </div>
        `;
        return;
    }
    
    documents.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'document-card';
        card.onclick = () => viewDocument(doc.id);
        const hasContent = doc.content ? '✓ 有内容' : '⚠ 无内容';
        card.innerHTML = `
            <div class="doc-header">
                <div class="doc-name">${doc.filename}</div>
                <span class="status-badge status-${doc.status}">${statusLabels[doc.status]}</span>
            </div>
            <div class="doc-meta">
                <span>📝 ${hasContent}</span>
                <span>🎯 ${doc.hit_count || 0} 个敏感命中</span>
                <span>📝 ${doc.review_count || 0} 次复核</span>
                <span>📦 ${doc.version_count || 0} 个版本</span>
                <span>🕐 ${formatTime(doc.created_at)}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

async function loadPendingQueue() {
    const documents = await apiCall('/queue/pending-review');
    renderDocumentList(documents, 'pendingList');
}

async function loadExceptionQueue() {
    const documents = await apiCall('/queue/exception');
    renderDocumentList(documents, 'exceptionList');
}

async function loadAllDocuments() {
    const documents = await apiCall('/documents/');
    renderDocumentList(documents, 'allDocsList');
}

async function loadRules() {
    const rules = await apiCall('/rules/');
    const container = document.getElementById('rulesList');
    container.innerHTML = '';
    
    rules.forEach(rule => {
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.innerHTML = `
            <div class="rule-name">${rule.name}</div>
            <span class="rule-type">${rule.rule_type}</span>
            <div class="rule-pattern">${rule.pattern}</div>
            <div class="rule-replacement">替换为: ${rule.replacement}</div>
        `;
        container.appendChild(card);
    });
}

async function viewDocument(docId) {
    currentDocumentId = docId;
    previousView = currentView;
    currentView = 'detail';
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-detail').classList.add('active');
    
    const document = await apiCall(`/documents/${docId}`);
    currentDocument = document;
    
    const hits = await apiCall(`/documents/${docId}/hits`);
    const history = await apiCall(`/documents/${docId}/history`);
    const versions = await apiCall(`/documents/${docId}/versions`);
    
    document.getElementById('detailTitle').textContent = document.filename;
    document.getElementById('currentStatus').className = `status-badge status-${document.status}`;
    document.getElementById('currentStatus').textContent = statusLabels[document.status];
    
    renderDocumentContent(document);
    renderActionButtons(document.status, document);
    renderHits(hits);
    renderHistory(history);
    renderReviews(document.reviews || []);
    renderVersions(versions);
    
    switchTab('content');
}

function renderDocumentContent(document) {
    const container = document.getElementById('tab-content');
    
    if (!document.content) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-text">文档暂无内容</div>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="showContentInputModal()">录入文档内容</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="content-section">
            <div class="content-header">
                <h3>原始内容</h3>
                <button class="btn btn-secondary" onclick="showContentInputModal()">编辑内容</button>
            </div>
            <pre class="content-display">${escapeHtml(document.content)}</pre>
        </div>
        ${document.masked_content ? `
        <div class="content-section" style="margin-top: 1.5rem;">
            <div class="content-header">
                <h3>脱敏后内容</h3>
            </div>
            <pre class="content-display masked">${escapeHtml(document.masked_content)}</pre>
        </div>
        ` : ''}
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderActionButtons(status, document) {
    const container = document.getElementById('actionButtons');
    container.innerHTML = '';
    
    const buttons = [];
    
    switch (status) {
        case 'created':
            if (document.content) {
                buttons.push({ text: '开始扫描', class: 'btn-primary', action: startScan });
            } else {
                buttons.push({ text: '录入内容', class: 'btn-warning', action: showContentInputModal });
            }
            break;
        case 'pending_review':
            buttons.push({ text: '通过复核', class: 'btn-success', action: () => showReviewModal('approve') });
            buttons.push({ text: '驳回', class: 'btn-danger', action: () => showReviewModal('reject') });
            break;
        case 'error':
            if (document.content) {
                buttons.push({ text: '重试扫描', class: 'btn-warning', action: retryScan });
            } else {
                buttons.push({ text: '录入内容', class: 'btn-warning', action: showContentInputModal });
            }
            break;
    }
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `btn ${btn.class}`;
        button.textContent = btn.text;
        button.onclick = btn.action;
        container.appendChild(button);
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

function renderHits(hits) {
    const container = document.getElementById('tab-hits');
    container.innerHTML = '';
    
    if (hits.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <div class="empty-state-text">未发现敏感信息</div>
            </div>
        `;
        return;
    }
    
    hits.forEach((hit, index) => {
        const item = document.createElement('div');
        item.className = 'hit-item';
        item.innerHTML = `
            <div class="hit-header">
                <span class="hit-text">${escapeHtml(hit.matched_text)}</span>
                <span class="hit-location">第 ${hit.line_number} 行, 第 ${hit.column_number} 列</span>
            </div>
            <div class="hit-context">${escapeHtml(hit.context || '无上下文')}</div>
        `;
        container.appendChild(item);
    });
}

function renderHistory(history) {
    const container = document.getElementById('tab-history');
    container.innerHTML = '';
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📜</div>
                <div class="empty-state-text">暂无状态记录</div>
            </div>
        `;
        return;
    }
    
    history.slice().reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-time">${formatTime(item.created_at)}</div>
            <div class="history-content">
                <div class="history-status">
                    ${item.from_status ? `<span class="status-badge status-${item.from_status}">${statusLabels[item.from_status]}</span> →` : ''}
                    <span class="status-badge status-${item.to_status}">${statusLabels[item.to_status]}</span>
                </div>
                <div class="history-message">${escapeHtml(item.message || '状态变更')}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderReviews(reviews) {
    const container = document.getElementById('tab-reviews');
    container.innerHTML = '';
    
    if (reviews.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-text">暂无复核记录</div>
            </div>
        `;
        return;
    }
    
    reviews.forEach(review => {
        const item = document.createElement('div');
        item.className = 'review-item';
        item.innerHTML = `
            <div class="review-decision ${review.decision}">
                ${review.decision === 'approve' ? '✅ 通过' : '❌ 驳回'}
            </div>
            <div class="review-comment">${escapeHtml(review.comment || '无备注')}</div>
            <div class="review-meta">复核人: ${escapeHtml(review.reviewer)} | ${formatTime(review.created_at)}</div>
        `;
        container.appendChild(item);
    });
}

function renderVersions(versions) {
    const container = document.getElementById('tab-versions');
    container.innerHTML = '';
    
    if (versions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">暂无版本</div>
            </div>
        `;
        return;
    }
    
    versions.forEach(version => {
        const item = document.createElement('div');
        item.className = 'version-item';
        item.innerHTML = `
            <div class="version-info">
                <div class="version-number">${version.version_number}</div>
                <div class="version-status">
                    ${version.is_authorized ? '✅ 已授权' : '⏳ 待授权'}
                    ${version.authorized_at ? ` | 授权于 ${formatTime(version.authorized_at)}` : ''}
                </div>
            </div>
            <div class="version-actions">
                ${!version.is_authorized ? 
                    `<button class="btn btn-primary" onclick="authorizeVersion(${version.id})">授权下载</button>` :
                    `
                    <button class="btn btn-success" onclick="downloadMaskedFile(${version.id})">📥 下载脱敏文件</button>
                    <button class="btn btn-secondary" onclick="downloadReport(${version.id})">📊 下载报告</button>
                    `
                }
            </div>
        `;
        container.appendChild(item);
    });
}

function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function showUploadModal() {
    showModal('上传文档', `
        <div class="form-group">
            <label>选择文件</label>
            <input type="file" id="fileInput" accept=".txt,.doc,.docx,.md,.csv">
        </div>
        <div class="form-group">
            <label>或直接输入内容</label>
            <textarea id="fileContentInput" rows="6" placeholder="粘贴或输入文档内容..."></textarea>
        </div>
        <div class="form-group">
            <label>文档名称</label>
            <input type="text" id="uploadFileName" placeholder="留空则使用文件名">
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitUpload()">上传</button>
        </div>
    `);
}

async function submitUpload() {
    const fileInput = document.getElementById('fileInput');
    const contentInput = document.getElementById('fileContentInput');
    const fileNameInput = document.getElementById('uploadFileName');
    
    if (fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        
        try {
            const doc = await apiCallFormData('/documents/upload', formData);
            closeModal();
            showToast('文档上传成功', 'success');
            viewDocument(doc.id);
        } catch (e) {
        }
    } else if (contentInput.value.trim()) {
        const filename = fileNameInput.value || `文档_${Date.now()}.txt`;
        try {
            const doc = await apiCall('/documents/', {
                method: 'POST',
                body: JSON.stringify({ filename, content: contentInput.value })
            });
            closeModal();
            showToast('文档创建成功', 'success');
            viewDocument(doc.id);
        } catch (e) {
        }
    } else {
        showToast('请选择文件或输入内容', 'error');
    }
}

function showContentInputModal() {
    const existingContent = currentDocument?.content || '';
    showModal('编辑文档内容', `
        <div class="form-group">
            <label>文档内容</label>
            <textarea id="contentTextarea" rows="10" placeholder="请输入文档内容...">${escapeHtml(existingContent)}</textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitContentUpdate()">保存</button>
        </div>
    `);
}

async function submitContentUpdate() {
    const content = document.getElementById('contentTextarea').value;
    if (!content.trim()) {
        showToast('内容不能为空', 'error');
        return;
    }
    
    try {
        await apiCall(`/documents/${currentDocumentId}/content`, {
            method: 'PUT',
            body: JSON.stringify({ content })
        });
        closeModal();
        showToast('内容已更新', 'success');
        viewDocument(currentDocumentId);
    } catch (e) {
    }
}

async function createDocument() {
    showModal('新建文档', `
        <div class="form-group">
            <label>文档名称</label>
            <input type="text" id="docNameInput" placeholder="请输入文档名称" value="测试文档_${Date.now()}.txt">
        </div>
        <div class="form-group">
            <label>文档内容（可选）</label>
            <textarea id="docContentInput" rows="6" placeholder="请输入文档内容..."></textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitCreateDocument()">创建</button>
        </div>
    `);
}

async function submitCreateDocument() {
    const filename = document.getElementById('docNameInput').value;
    const content = document.getElementById('docContentInput').value;
    
    if (!filename) {
        showToast('请输入文档名称', 'error');
        return;
    }
    
    try {
        const doc = await apiCall('/documents/', {
            method: 'POST',
            body: JSON.stringify({ filename, content: content || undefined })
        });
        closeModal();
        showToast('文档创建成功', 'success');
        viewDocument(doc.id);
    } catch (e) {
    }
}

async function startScan() {
    try {
        await apiCall(`/documents/${currentDocumentId}/scan`, { method: 'POST' });
        showToast('扫描已启动', 'success');
        setTimeout(() => viewDocument(currentDocumentId), 1000);
    } catch (e) {
    }
}

async function retryScan() {
    try {
        await apiCall(`/documents/${currentDocumentId}/retry`, { method: 'POST' });
        showToast('重试扫描已启动', 'success');
        setTimeout(() => viewDocument(currentDocumentId), 1000);
    } catch (e) {
    }
}

function showReviewModal(decision) {
    const title = decision === 'approve' ? '通过复核' : '驳回复核';
    showModal(title, `
        <div class="form-group">
            <label>复核人</label>
            <input type="text" id="reviewerInput" placeholder="请输入您的姓名" value="管理员">
        </div>
        <div class="form-group">
            <label>复核意见</label>
            <textarea id="reviewCommentInput" rows="3" placeholder="请输入复核意见（可选）"></textarea>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn ${decision === 'approve' ? 'btn-success' : 'btn-danger'}" onclick="submitReview('${decision}')">
                ${decision === 'approve' ? '通过' : '驳回'}
            </button>
        </div>
    `);
}

async function submitReview(decision) {
    const reviewer = document.getElementById('reviewerInput').value;
    const comment = document.getElementById('reviewCommentInput').value;
    
    if (!reviewer) {
        showToast('请输入复核人姓名', 'error');
        return;
    }
    
    try {
        await apiCall(`/documents/${currentDocumentId}/reviews`, {
            method: 'POST',
            body: JSON.stringify({ reviewer, comment, decision })
        });
        closeModal();
        showToast(decision === 'approve' ? '复核已通过' : '已驳回', 'success');
        setTimeout(() => viewDocument(currentDocumentId), 1000);
    } catch (e) {
    }
}

async function authorizeVersion(versionId) {
    try {
        await apiCall(`/versions/${versionId}/authorize?authorized_by=管理员`, { method: 'POST' });
        showToast('授权成功', 'success');
        setTimeout(() => viewDocument(currentDocumentId), 500);
    } catch (e) {
    }
}

function downloadMaskedFile(versionId) {
    const url = `${API_BASE}/versions/${versionId}/download?downloaded_by=用户`;
    window.open(url, '_blank');
    setTimeout(() => viewDocument(currentDocumentId), 1000);
}

function downloadReport(versionId) {
    const url = `${API_BASE}/versions/${versionId}/report?downloaded_by=用户`;
    window.open(url, '_blank');
}

function refreshData() {
    loadViewData(currentView);
}

document.addEventListener('DOMContentLoaded', () => {
    refreshData();
    setInterval(refreshData, 30000);
});
