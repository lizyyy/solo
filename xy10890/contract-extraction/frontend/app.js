const API_BASE = 'http://localhost:8000/api';

let currentPage = 1;
let pageSize = 20;
let currentStatus = '';
let currentRisk = '';
let currentSearch = '';
let currentContractId = null;
let selectedFiles = [];
let selectedContracts = new Set();
let editingClauseId = null;

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-warning';
    
    const toastHtml = `
        <div class="toast text-white ${bgClass}" role="alert">
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toast = new bootstrap.Toast(toastContainer.lastElementChild);
    toast.show();
    
    setTimeout(() => {
        toastContainer.firstElementChild?.remove();
    }, 5000);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getRiskBadgeClass(risk) {
    const classes = {
        'low': 'risk-low',
        'medium': 'risk-medium',
        'high': 'risk-high',
        'critical': 'risk-critical'
    };
    return classes[risk] || 'risk-low';
}

function getRiskText(risk) {
    const texts = {
        'low': '低风险',
        'medium': '中风险',
        'high': '高风险',
        'critical': '极高风险'
    };
    return texts[risk] || '未知';
}

function getStatusBadgeClass(status) {
    const classes = {
        'uploaded': 'status-uploaded',
        'extracting': 'status-extracting',
        'extracted': 'status-extracted',
        'reviewing': 'status-reviewing',
        'approved': 'status-approved',
        'failed': 'status-failed'
    };
    return classes[status] || 'status-uploaded';
}

function getStatusText(status) {
    const texts = {
        'uploaded': '已上传',
        'extracting': '抽取中',
        'extracted': '已抽取',
        'reviewing': '审核中',
        'approved': '已通过',
        'rejected': '已拒绝',
        'failed': '失败'
    };
    return texts[status] || '未知';
}

async function fetchContracts() {
    try {
        let url = `${API_BASE}/contracts?page=${currentPage}&page_size=${pageSize}`;
        if (currentStatus) url += `&status=${currentStatus}`;
        if (currentRisk) url += `&overall_risk=${currentRisk}`;
        if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        renderContractTable(data.items);
        renderPagination(data.total, data.page, data.page_size);
        updateShowingRange(data);
    } catch (error) {
        console.error('获取合同列表失败:', error);
        showToast('获取合同列表失败', 'error');
    }
}

function renderContractTable(contracts) {
    const tbody = document.getElementById('contractTableBody');
    
    if (!contracts || contracts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-muted py-4">
                    暂无数据
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = contracts.map(contract => `
        <tr>
            <td>
                <input type="checkbox" class="form-check-input contract-checkbox" 
                       value="${contract.id}" 
                       ${selectedContracts.has(contract.id) ? 'checked' : ''}>
            </td>
            <td>${contract.id}</td>
            <td>${contract.filename || '-'}</td>
            <td>${contract.contract_name || '-'}</td>
            <td>${contract.party_a || '-'}</td>
            <td>${contract.party_b || '-'}</td>
            <td>
                <span class="status-badge ${getStatusBadgeClass(contract.status)}">
                    ${getStatusText(contract.status)}
                </span>
            </td>
            <td>
                <span class="risk-badge ${getRiskBadgeClass(contract.overall_risk)}">
                    ${getRiskText(contract.overall_risk)}
                </span>
            </td>
            <td>${contract.clause_count || 0}</td>
            <td>${formatDate(contract.created_at)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary view-btn" data-id="${contract.id}">
                    查看
                </button>
            </td>
        </tr>
    `).join('');
    
    document.querySelectorAll('.contract-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const id = parseInt(e.target.value);
            if (e.target.checked) {
                selectedContracts.add(id);
            } else {
                selectedContracts.delete(id);
            }
            updateSelectAllState();
        });
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const contractId = parseInt(btn.dataset.id);
            openContractDetail(contractId);
        });
    });
}

function renderPagination(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize);
    const pagination = document.getElementById('pagination');
    
    let html = '';
    
    html += `
        <li class="page-item ${page <= 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${page - 1}">上一页</a>
        </li>
    `;
    
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === page ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    html += `
        <li class="page-item ${page >= totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${page + 1}">下一页</a>
        </li>
    `;
    
    pagination.innerHTML = html;
    
    pagination.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const newPage = parseInt(link.dataset.page);
            if (newPage && newPage !== currentPage) {
                currentPage = newPage;
                fetchContracts();
            }
        });
    });
}

function updateShowingRange(data) {
    const start = (data.page - 1) * data.page_size + 1;
    const end = Math.min(data.page * data.page_size, data.total);
    document.getElementById('showingRange').textContent = 
        `显示 ${start}-${end} 条，共 ${data.total} 条`;
}

function updateSelectAllState() {
    const checkboxes = document.querySelectorAll('.contract-checkbox');
    const checkedCount = document.querySelectorAll('.contract-checkbox:checked').length;
    document.getElementById('selectAll').checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
}

async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const data = await response.json();
        
        document.getElementById('totalContracts').textContent = data.total_contracts;
        document.getElementById('extractedCount').textContent = data.status_distribution.extracted || 0;
        document.getElementById('highRiskCount').textContent = 
            (data.risk_distribution.high || 0) + (data.risk_distribution.critical || 0);
        document.getElementById('failedCount').textContent = data.status_distribution.failed || 0;
    } catch (error) {
        console.error('获取统计数据失败:', error);
    }
}

async function openContractDetail(contractId) {
    currentContractId = contractId;
    
    try {
        const response = await fetch(`${API_BASE}/contracts/${contractId}`);
        const contract = await response.json();
        
        document.getElementById('detailFilename').textContent = contract.filename;
        document.getElementById('detailStatus').innerHTML = 
            `<span class="status-badge ${getStatusBadgeClass(contract.status)}">${getStatusText(contract.status)}</span>`;
        document.getElementById('detailRisk').innerHTML = 
            `<span class="risk-badge ${getRiskBadgeClass(contract.overall_risk)}">${getRiskText(contract.overall_risk)}</span>`;
        document.getElementById('detailContractName').value = contract.contract_name || '';
        document.getElementById('detailPartyA').value = contract.party_a || '';
        document.getElementById('detailPartyB').value = contract.party_b || '';
        document.getElementById('detailStatusSelect').value = contract.status;
        document.getElementById('detailRetryCount').textContent = contract.retry_count || 0;
        
        renderClauses(contract.clauses || []);
        renderTimeline(contract.timeline || []);
        renderVersions(contract.versions || []);
        
        const modal = new bootstrap.Modal(document.getElementById('contractDetailModal'));
        modal.show();
    } catch (error) {
        console.error('获取合同详情失败:', error);
        showToast('获取合同详情失败', 'error');
    }
}

function renderClauses(clauses) {
    const container = document.getElementById('clausesList');
    
    if (!clauses || clauses.length === 0) {
        container.innerHTML = '<p class="text-muted">暂无条款数据</p>';
        return;
    }
    
    container.innerHTML = clauses.map(clause => `
        <div class="card clause-card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="card-title mb-0">${clause.clause_title || '未命名条款'}</h6>
                    <div class="d-flex gap-2">
                        <span class="risk-badge ${getRiskBadgeClass(clause.risk_level)}">
                            ${getRiskText(clause.risk_level)}
                        </span>
                        ${clause.confidence_score ? `<span class="badge bg-info">置信度: ${(clause.confidence_score * 100).toFixed(0)}%</span>` : ''}
                    </div>
                </div>
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label text-muted small">原文</label>
                        <p class="small mb-0" style="white-space: pre-wrap;">${clause.original_text || '-'}</p>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label text-muted small">抽取内容</label>
                        <p class="small mb-0" style="white-space: pre-wrap;">${clause.extracted_text || '-'}</p>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label text-muted small">修订内容</label>
                        <div id="clause-${clause.id}-revised">
                            ${editingClauseId === clause.id ? `
                                <textarea class="form-control form-control-sm mb-2" rows="3" id="revisedText-${clause.id}">${clause.revised_text || ''}</textarea>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-primary save-revise-btn" data-id="${clause.id}">保存</button>
                                    <button class="btn btn-sm btn-secondary cancel-revise-btn" data-id="${clause.id}">取消</button>
                                </div>
                            ` : `
                                <p class="small mb-0" style="white-space: pre-wrap;">${clause.revised_text || '-'}</p>
                            `}
                        </div>
                    </div>
                </div>
                <div class="mt-3 d-flex gap-2">
                    ${editingClauseId !== clause.id ? `
                        <button class="btn btn-sm btn-outline-primary revise-btn" data-id="${clause.id}">
                            修订内容
                        </button>
                    ` : ''}
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            标记风险
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item risk-action" data-id="${clause.id}" data-risk="low" href="#">低风险</a></li>
                            <li><a class="dropdown-item risk-action" data-id="${clause.id}" data-risk="medium" href="#">中风险</a></li>
                            <li><a class="dropdown-item risk-action" data-id="${clause.id}" data-risk="high" href="#">高风险</a></li>
                            <li><a class="dropdown-item risk-action" data-id="${clause.id}" data-risk="critical" href="#">极高风险</a></li>
                        </ul>
                    </div>
                </div>
                ${clause.revisions && clause.revisions.length > 0 ? `
                    <div class="revision-history mt-3">
                        <h6 class="small text-muted mb-2">修订历史 (${clause.revisions.length}条)</h6>
                        ${clause.revisions.slice(0, 3).map(rev => `
                            <div class="small mb-2">
                                <div class="d-flex justify-content-between">
                                    <span class="text-primary">版本 ${rev.version_number}</span>
                                    <span class="text-muted">${formatDate(rev.created_at)}</span>
                                </div>
                                ${rev.text_before ? `<div class="text-muted text-decoration-line-through">${rev.text_before}</div>` : ''}
                                ${rev.text_after ? `<div class="text-success">${rev.text_after}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    container.querySelectorAll('.revise-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            editingClauseId = parseInt(btn.dataset.id);
            openContractDetail(currentContractId);
        });
    });
    
    container.querySelectorAll('.save-revise-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const clauseId = parseInt(btn.dataset.id);
            const revisedText = document.getElementById(`revisedText-${clauseId}`).value;
            saveClauseRevision(clauseId, revisedText);
        });
    });
    
    container.querySelectorAll('.cancel-revise-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            editingClauseId = null;
            openContractDetail(currentContractId);
        });
    });
    
    container.querySelectorAll('.risk-action').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const clauseId = parseInt(item.dataset.id);
            const riskLevel = item.dataset.risk;
            markClauseRisk(clauseId, riskLevel);
        });
    });
}

async function saveClauseRevision(clauseId, revisedText) {
    try {
        const response = await fetch(`${API_BASE}/clauses/${clauseId}/revise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revised_text: revisedText })
        });
        
        if (response.ok) {
            showToast('修订保存成功');
            editingClauseId = null;
            openContractDetail(currentContractId);
        } else {
            showToast('修订保存失败', 'error');
        }
    } catch (error) {
        console.error('保存修订失败:', error);
        showToast('保存修订失败', 'error');
    }
}

async function markClauseRisk(clauseId, riskLevel) {
    try {
        const response = await fetch(`${API_BASE}/clauses/${clauseId}/risk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ risk_level: riskLevel })
        });
        
        if (response.ok) {
            showToast('风险标记成功');
            openContractDetail(currentContractId);
        } else {
            showToast('风险标记失败', 'error');
        }
    } catch (error) {
        console.error('标记风险失败:', error);
        showToast('标记风险失败', 'error');
    }
}

function renderTimeline(events) {
    const container = document.getElementById('timelineList');
    
    if (!events || events.length === 0) {
        container.innerHTML = '<p class="text-muted">暂无时间线数据</p>';
        return;
    }
    
    container.innerHTML = events.map(event => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="d-flex justify-content-between align-items-start">
                    <h6 class="mb-1">${getEventTypeText(event.event_type)}</h6>
                    <small class="text-muted">${formatDate(event.created_at)}</small>
                </div>
                ${event.event_data ? `<p class="small text-muted mb-0">${event.event_data}</p>` : ''}
                ${event.created_by ? `<small class="text-muted">操作人: ${event.created_by}</small>` : ''}
            </div>
        </div>
    `).join('');
}

function getEventTypeText(type) {
    const types = {
        'contract_created': '合同创建',
        'contract_updated': '合同更新',
        'clause_added': '条款添加',
        'clause_updated': '条款更新',
        'extraction_completed': '抽取完成',
        'extraction_failed': '抽取失败',
        'extraction_retried': '重试抽取',
        'risk_annotated': '风险标注',
        'status_changed': '状态变更'
    };
    return types[type] || type;
}

function renderVersions(versions) {
    const container = document.getElementById('versionsList');
    const selectA = document.getElementById('compareVersionA');
    const selectB = document.getElementById('compareVersionB');
    
    if (!versions || versions.length === 0) {
        container.innerHTML = '<p class="text-muted">暂无版本历史</p>';
        selectA.innerHTML = '<option value="">请选择</option>';
        selectB.innerHTML = '<option value="">请选择</option>';
        return;
    }
    
    const versionOptions = versions.map(v => 
        `<option value="${v.version_number}">v${v.version_number} - ${getStatusText(v.status)}</option>`
    ).join('');
    selectA.innerHTML = '<option value="">请选择</option>' + versionOptions;
    selectB.innerHTML = '<option value="">请选择</option>' + versionOptions;
    
    container.innerHTML = versions.map(version => `
        <div class="card mb-2">
            <div class="card-body py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-secondary me-2">v${version.version_number}</span>
                        <span class="status-badge ${getStatusBadgeClass(version.status)} me-2">
                            ${getStatusText(version.status)}
                        </span>
                        <span class="risk-badge ${getRiskBadgeClass(version.overall_risk)}">
                            ${getRiskText(version.overall_risk)}
                        </span>
                    </div>
                    <small class="text-muted">${formatDate(version.created_at)}</small>
                </div>
                ${version.change_log ? `<p class="small text-muted mb-0 mt-1">${version.change_log}</p>` : ''}
            </div>
        </div>
    `).join('');
}

async function compareVersions(contractId, versionA, versionB) {
    try {
        const response = await fetch(`${API_BASE}/contracts/${contractId}/compare?version_a=${versionA}&version_b=${versionB}`);
        
        if (!response.ok) {
            const error = await response.json();
            showToast(error.detail || '对比失败', 'error');
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error('版本对比失败:', error);
        showToast('版本对比失败', 'error');
        return null;
    }
}

function renderVersionCompareResult(result) {
    const container = document.getElementById('compareResultContent');
    const resultDiv = document.getElementById('versionCompareResult');
    
    resultDiv.style.display = 'block';
    
    let html = '';
    
    if (result.contract_changes && Object.keys(result.contract_changes).length > 0) {
        html += `
            <div class="card mb-3 border-info">
                <div class="card-header bg-info text-white py-2">
                    <h6 class="mb-0">合同属性变更</h6>
                </div>
                <div class="card-body py-2">
                    ${Object.entries(result.contract_changes).map(([key, value]) => {
                        if (typeof value === 'object' && value.old !== undefined) {
                            return `
                                <div class="mb-2">
                                    <strong>${key}:</strong>
                                    <span class="text-decoration-line-through text-danger me-2">${value.old}</span>
                                    <span class="text-success">→ ${value.new}</span>
                                </div>
                            `;
                        }
                        return `<div class="mb-2"><strong>${key}:</strong> ${value}</div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    if (result.added_clauses && result.added_clauses.length > 0) {
        html += `
            <div class="card mb-3 border-success">
                <div class="card-header bg-success text-white py-2">
                    <h6 class="mb-0">新增条款 (${result.added_clauses.length})</h6>
                </div>
                <div class="card-body py-2">
                    ${result.added_clauses.map(c => `
                        <div class="mb-3 pb-2 border-bottom">
                            <h6 class="text-success mb-1">${c.clause_title}</h6>
                            <p class="small mb-0">${c.new_text || '-'}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (result.removed_clauses && result.removed_clauses.length > 0) {
        html += `
            <div class="card mb-3 border-danger">
                <div class="card-header bg-danger text-white py-2">
                    <h6 class="mb-0">删除条款 (${result.removed_clauses.length})</h6>
                </div>
                <div class="card-body py-2">
                    ${result.removed_clauses.map(c => `
                        <div class="mb-3 pb-2 border-bottom">
                            <h6 class="text-danger mb-1 text-decoration-line-through">${c.clause_title}</h6>
                            <p class="small mb-0 text-decoration-line-through text-muted">${c.old_text || '-'}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (result.modified_clauses && result.modified_clauses.length > 0) {
        html += `
            <div class="card mb-3 border-warning">
                <div class="card-header bg-warning text-dark py-2">
                    <h6 class="mb-0">修改条款 (${result.modified_clauses.length})</h6>
                </div>
                <div class="card-body py-2">
                    ${result.modified_clauses.map(c => `
                        <div class="mb-3 pb-2 border-bottom">
                            <h6 class="text-warning mb-2">${c.clause_title}</h6>
                            <div class="row">
                                <div class="col-md-6">
                                    <small class="text-muted">修改前：</small>
                                    <p class="small text-danger text-decoration-line-through mb-0">${c.old_text || '-'}</p>
                                </div>
                                <div class="col-md-6">
                                    <small class="text-muted">修改后：</small>
                                    <p class="small text-success mb-0">${c.new_text || '-'}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (!html) {
        html = '<div class="alert alert-info">两个版本没有差异</div>';
    }
    
    container.innerHTML = html;
}

function initUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    document.getElementById('uploadBtn').addEventListener('click', uploadFiles);
    document.getElementById('clearFilesBtn').addEventListener('click', clearFiles);
}

function handleFiles(files) {
    for (const file of files) {
        if (!selectedFiles.find(f => f.name === file.name)) {
            selectedFiles.push(file);
        }
    }
    renderSelectedFiles();
}

function renderSelectedFiles() {
    const container = document.getElementById('uploadedFiles');
    
    if (selectedFiles.length === 0) {
        container.innerHTML = '';
        document.getElementById('uploadBtn').disabled = true;
        document.getElementById('clearFilesBtn').disabled = true;
        return;
    }
    
    container.innerHTML = `
        <div class="list-group">
            ${selectedFiles.map((file, index) => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0">${file.name}</h6>
                        <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger remove-file-btn" data-index="${index}">
                        删除
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('clearFilesBtn').disabled = false;
    
    container.querySelectorAll('.remove-file-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            selectedFiles.splice(index, 1);
            renderSelectedFiles();
        });
    });
}

function clearFiles() {
    selectedFiles = [];
    renderSelectedFiles();
}

async function uploadFiles() {
    if (selectedFiles.length === 0) return;
    
    const spinner = document.getElementById('uploadSpinner');
    const uploadBtn = document.getElementById('uploadBtn');
    
    spinner.classList.remove('d-none');
    uploadBtn.disabled = true;
    
    try {
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });
        
        const response = await fetch(`${API_BASE}/contracts/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        showToast(`上传完成: 成功${result.success_count}个，失败${result.failed_count}个`);
        clearFiles();
        fetchContracts();
        fetchStats();
    } catch (error) {
        console.error('上传失败:', error);
        showToast('上传失败', 'error');
    } finally {
        spinner.classList.add('d-none');
        uploadBtn.disabled = false;
    }
}

async function loadExportContracts() {
    try {
        const response = await fetch(`${API_BASE}/contracts?page_size=1000`);
        const data = await response.json();
        
        const container = document.getElementById('exportContractList');
        container.innerHTML = data.items.map(contract => `
            <div class="form-check mb-2">
                <input class="form-check-input export-checkbox" type="checkbox" 
                       value="${contract.id}" id="export-${contract.id}">
                <label class="form-check-label" for="export-${contract.id}">
                    ${contract.filename} (${getStatusText(contract.status)})
                </label>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载导出列表失败:', error);
    }
}

async function exportContracts() {
    const checkboxes = document.querySelectorAll('.export-checkbox:checked');
    const contractIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (contractIds.length === 0) {
        showToast('请选择要导出的合同', 'warning');
        return;
    }
    
    const format = document.getElementById('exportFormat').value;
    const includeClauses = document.getElementById('includeClauses').checked;
    const includeRevisions = document.getElementById('includeRevisions').checked;
    
    try {
        const response = await fetch(`${API_BASE}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contract_ids: contractIds,
                format: format,
                include_clauses: includeClauses,
                include_revisions: includeRevisions
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contracts_export.${format === 'excel' ? 'xlsx' : format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('导出成功');
        } else {
            showToast('导出失败', 'error');
        }
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败', 'error');
    }
}

async function batchExtract() {
    if (selectedContracts.size === 0) {
        showToast('请选择要抽取的合同', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/contracts/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contract_ids: Array.from(selectedContracts) })
        });
        
        if (response.ok) {
            showToast('抽取任务已启动，请稍后刷新查看结果');
            selectedContracts.clear();
            fetchContracts();
        } else {
            showToast('启动抽取失败', 'error');
        }
    } catch (error) {
        console.error('批量抽取失败:', error);
        showToast('启动抽取失败', 'error');
    }
}

async function retryFailed() {
    try {
        const response = await fetch(`${API_BASE}/contracts/bulk-retry`, {
            method: 'POST'
        });
        
        const result = await response.json();
        showToast(`已重试 ${result.retried_count} 个失败任务`);
        fetchContracts();
        fetchStats();
    } catch (error) {
        console.error('重试失败任务失败:', error);
        showToast('重试失败', 'error');
    }
}

async function saveContractChanges() {
    if (!currentContractId) return;
    
    const contractName = document.getElementById('detailContractName').value;
    const partyA = document.getElementById('detailPartyA').value;
    const partyB = document.getElementById('detailPartyB').value;
    const status = document.getElementById('detailStatusSelect').value;
    
    try {
        const response = await fetch(`${API_BASE}/contracts/${currentContractId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contract_name: contractName,
                party_a: partyA,
                party_b: partyB,
                status: status
            })
        });
        
        if (response.ok) {
            showToast('保存成功');
            openContractDetail(currentContractId);
            fetchContracts();
            fetchStats();
        } else {
            showToast('保存失败', 'error');
        }
    } catch (error) {
        console.error('保存合同失败:', error);
        showToast('保存失败', 'error');
    }
}

async function extractCurrentContract() {
    if (!currentContractId) return;
    
    try {
        const response = await fetch(`${API_BASE}/contracts/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contract_ids: [currentContractId] })
        });
        
        if (response.ok) {
            showToast('抽取任务已启动');
            openContractDetail(currentContractId);
            fetchContracts();
        } else {
            showToast('启动抽取失败', 'error');
        }
    } catch (error) {
        console.error('启动抽取失败:', error);
        showToast('启动抽取失败', 'error');
    }
}

async function retryCurrentContract() {
    if (!currentContractId) return;
    
    try {
        const response = await fetch(`${API_BASE}/contracts/${currentContractId}/retry`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showToast('重试已启动');
            openContractDetail(currentContractId);
            fetchContracts();
        } else {
            showToast('重试失败', 'error');
        }
    } catch (error) {
        console.error('重试失败:', error);
        showToast('重试失败', 'error');
    }
}

function init() {
    fetchContracts();
    fetchStats();
    initUpload();
    
    document.getElementById('searchBtn').addEventListener('click', () => {
        currentSearch = document.getElementById('searchInput').value;
        currentPage = 1;
        fetchContracts();
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentSearch = document.getElementById('searchInput').value;
            currentPage = 1;
            fetchContracts();
        }
    });
    
    document.getElementById('statusFilter').addEventListener('change', (e) => {
        currentStatus = e.target.value;
        currentPage = 1;
        fetchContracts();
    });
    
    document.getElementById('riskFilter').addEventListener('change', (e) => {
        currentRisk = e.target.value;
        currentPage = 1;
        fetchContracts();
    });
    
    document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        fetchContracts();
    });
    
    document.getElementById('selectAll').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.contract-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const id = parseInt(cb.value);
            if (e.target.checked) {
                selectedContracts.add(id);
            } else {
                selectedContracts.delete(id);
            }
        });
    });
    
    document.getElementById('batchExtractBtn').addEventListener('click', batchExtract);
    document.getElementById('retryFailedBtn').addEventListener('click', retryFailed);
    
    document.getElementById('saveContractBtn').addEventListener('click', saveContractChanges);
    document.getElementById('extractContractBtn').addEventListener('click', extractCurrentContract);
    document.getElementById('retryContractBtn').addEventListener('click', retryCurrentContract);
    
    document.getElementById('compareVersionsBtn').addEventListener('click', async () => {
        const versionA = document.getElementById('compareVersionA').value;
        const versionB = document.getElementById('compareVersionB').value;
        
        if (!versionA || !versionB) {
            showToast('请选择两个版本进行对比', 'warning');
            return;
        }
        
        if (versionA === versionB) {
            showToast('请选择不同的版本', 'warning');
            return;
        }
        
        const result = await compareVersions(currentContractId, versionA, versionB);
        if (result) {
            renderVersionCompareResult(result);
        }
    });
    
    document.getElementById('exportBtn').addEventListener('click', exportContracts);
    document.getElementById('selectAllExport').addEventListener('click', () => {
        document.querySelectorAll('.export-checkbox').forEach(cb => cb.checked = true);
    });
    document.getElementById('deselectAllExport').addEventListener('click', () => {
        document.querySelectorAll('.export-checkbox').forEach(cb => cb.checked = false);
    });
    
    document.getElementById('export-tab').addEventListener('shown.bs.tab', () => {
        loadExportContracts();
    });
    
    setInterval(() => {
        fetchContracts();
        fetchStats();
    }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
