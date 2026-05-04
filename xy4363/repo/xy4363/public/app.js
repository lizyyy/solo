const API_BASE = '';

let currentClaimId = null;
let claims = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModals();
    initForms();
    loadClaims();
});

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = btn.id.replace('btn-', '');
            
            navBtns.forEach(b => b.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetPage).classList.add('active');
            
            if (targetPage === 'risk-review' || targetPage === 'missing-items') {
                populateClaimSelects();
            }
        });
    });
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

function initModals() {
    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.close-modal');
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            modal.classList.remove('active');
        });
    });
    
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    document.getElementById('btn-new-claim').addEventListener('click', () => {
        document.getElementById('modal-new-claim').classList.add('active');
    });
}

function initForms() {
    document.getElementById('form-new-claim').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const caseNumber = document.getElementById('new-case-number').value;
        const customerName = document.getElementById('new-customer-name').value;
        const policyNumber = document.getElementById('new-policy-number').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/claims`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    case_number: caseNumber,
                    customer_name: customerName,
                    policy_number: policyNumber
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('案件创建成功！', 'success');
                document.getElementById('modal-new-claim').classList.remove('active');
                e.target.reset();
                loadClaims();
            } else {
                showNotification(data.error || '创建失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('form-edit-claim').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentClaimId) return;
        
        const caseNumber = document.getElementById('edit-case-number').value;
        const customerName = document.getElementById('edit-customer-name').value;
        const policyNumber = document.getElementById('edit-policy-number').value;
        const status = document.getElementById('edit-status').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${currentClaimId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    case_number: caseNumber,
                    customer_name: customerName,
                    policy_number: policyNumber,
                    status: status
                })
            });
            
            if (response.ok) {
                showNotification('案件更新成功！', 'success');
                loadClaims();
                loadClaimDetail(currentClaimId);
            } else {
                const data = await response.json();
                showNotification(data.error || '更新失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('btn-delete-claim').addEventListener('click', async () => {
        if (!currentClaimId) return;
        
        if (!confirm('确定要删除此案件吗？此操作不可撤销。')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${currentClaimId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showNotification('案件删除成功！', 'success');
                document.getElementById('modal-claim-detail').classList.remove('active');
                currentClaimId = null;
                loadClaims();
            } else {
                const data = await response.json();
                showNotification(data.error || '删除失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('form-import-csv').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentClaimId) return;
        
        const fileInput = document.getElementById('import-csv-file');
        const file = fileInput.files[0];
        
        if (!file) {
            showNotification('请选择 CSV 文件', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('csvFile', file);
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${currentClaimId}/import-csv`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(`成功导入 ${data.count} 条票据记录！`, 'success');
                fileInput.value = '';
                loadClaimDetail(currentClaimId);
            } else {
                showNotification(data.error || '导入失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('form-import-policy').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentClaimId) return;
        
        const fileInput = document.getElementById('import-policy-file');
        const file = fileInput.files[0];
        
        if (!file) {
            showNotification('请选择 JSON 文件', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('policyFile', file);
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${currentClaimId}/import-policy`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('保单导入成功！', 'success');
                fileInput.value = '';
                loadClaimDetail(currentClaimId);
            } else {
                showNotification(data.error || '导入失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('form-import-photos').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentClaimId) return;
        
        const fileInput = document.getElementById('import-photo-files');
        const files = fileInput.files;
        
        if (files.length === 0) {
            showNotification('请选择照片文件', 'warning');
            return;
        }
        
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('photoFiles', files[i]);
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${currentClaimId}/import-photos`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification(`成功上传 ${data.count} 张照片！`, 'success');
                fileInput.value = '';
                loadClaimDetail(currentClaimId);
            } else {
                showNotification(data.error || '上传失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('form-add-note').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentClaimId) return;
        
        const content = document.getElementById('new-note-content').value.trim();
        
        if (!content) {
            showNotification('请输入备注内容', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${currentClaimId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('备注添加成功！', 'success');
                document.getElementById('new-note-content').value = '';
                loadClaimDetail(currentClaimId);
            } else {
                showNotification(data.error || '添加失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('form-add-missing-item').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedClaimId = document.getElementById('missing-claim-select').value;
        
        if (!selectedClaimId) {
            showNotification('请先选择案件', 'warning');
            return;
        }
        
        const itemType = document.getElementById('new-item-type').value;
        const description = document.getElementById('new-item-description').value;
        const priority = document.getElementById('new-item-priority').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${selectedClaimId}/missing-items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    item_type: itemType,
                    description: description,
                    priority: priority
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('缺件添加成功！', 'success');
                document.getElementById('modal-add-missing-item').classList.remove('active');
                e.target.reset();
                loadMissingItems(selectedClaimId);
            } else {
                showNotification(data.error || '添加失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('form-edit-missing-item').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const itemId = document.getElementById('edit-item-id').value;
        
        if (!itemId) return;
        
        const itemType = document.getElementById('edit-item-type').value;
        const description = document.getElementById('edit-item-description').value;
        const status = document.getElementById('edit-item-status').value;
        const priority = document.getElementById('edit-item-priority').value;
        const notes = document.getElementById('edit-item-notes').value;
        
        try {
            const response = await fetch(`${API_BASE}/api/missing-items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    item_type: itemType,
                    description: description,
                    status: status,
                    priority: priority,
                    notes: notes
                })
            });
            
            if (response.ok) {
                showNotification('缺件更新成功！', 'success');
                document.getElementById('modal-edit-missing-item').classList.remove('active');
                
                const selectedClaimId = document.getElementById('missing-claim-select').value;
                if (selectedClaimId) {
                    loadMissingItems(selectedClaimId);
                }
            } else {
                const data = await response.json();
                showNotification(data.error || '更新失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('btn-add-missing-item').addEventListener('click', () => {
        document.getElementById('modal-add-missing-item').classList.add('active');
    });
    
    document.getElementById('btn-run-risk-check').addEventListener('click', async () => {
        const selectedClaimId = document.getElementById('risk-claim-select').value;
        
        if (!selectedClaimId) {
            showNotification('请先选择案件', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/claims/${selectedClaimId}/check-risks`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showNotification('风险检查完成！', 'success');
                loadRiskChecks(selectedClaimId);
            } else {
                showNotification(data.error || '检查失败', 'error');
            }
        } catch (error) {
            showNotification('网络错误，请稍后重试', 'error');
            console.error('Error:', error);
        }
    });
    
    document.getElementById('btn-export-markdown').addEventListener('click', () => {
        const selectedClaimId = document.getElementById('missing-claim-select').value;
        
        if (!selectedClaimId) {
            showNotification('请先选择案件', 'warning');
            return;
        }
        
        window.open(`${API_BASE}/api/claims/${selectedClaimId}/export/markdown`, '_blank');
        showNotification('补件清单导出中...', 'info');
    });
    
    document.getElementById('btn-export-json').addEventListener('click', () => {
        const selectedClaimId = document.getElementById('missing-claim-select').value;
        
        if (!selectedClaimId) {
            showNotification('请先选择案件', 'warning');
            return;
        }
        
        window.open(`${API_BASE}/api/claims/${selectedClaimId}/export/json`, '_blank');
        showNotification('审计包导出中...', 'info');
    });
    
    document.getElementById('risk-claim-select').addEventListener('change', (e) => {
        const claimId = e.target.value;
        
        document.getElementById('btn-run-risk-check').disabled = !claimId;
        
        if (claimId) {
            loadRiskChecks(claimId);
        } else {
            document.getElementById('risk-checks-container').innerHTML = 
                '<p class="empty-message">请先选择一个案件查看风险检查结果</p>';
        }
    });
    
    document.getElementById('missing-claim-select').addEventListener('change', (e) => {
        const claimId = e.target.value;
        
        document.getElementById('btn-add-missing-item').disabled = !claimId;
        document.getElementById('btn-export-markdown').disabled = !claimId;
        document.getElementById('btn-export-json').disabled = !claimId;
        
        if (claimId) {
            loadMissingItems(claimId);
        } else {
            document.getElementById('missing-items-container').innerHTML = 
                '<p class="empty-message">请先选择一个案件查看缺件清单</p>';
        }
    });
}

async function loadClaims() {
    try {
        const response = await fetch(`${API_BASE}/api/claims`);
        claims = await response.json();
        renderClaims(claims);
    } catch (error) {
        showNotification('加载案件列表失败', 'error');
        console.error('Error:', error);
    }
}

function renderClaims(claims) {
    const container = document.getElementById('claims-container');
    
    if (claims.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无案件，点击"新建案件"开始</p>';
        return;
    }
    
    container.innerHTML = claims.map(claim => `
        <div class="claim-card" data-id="${claim.id}">
            <div class="claim-card-header">
                <h3 class="claim-card-title">${escapeHtml(claim.case_number)}</h3>
                <span class="claim-card-status status-${claim.status}">${getStatusText(claim.status)}</span>
            </div>
            <div class="claim-card-info">
                <p><strong>客户姓名：</strong>${escapeHtml(claim.customer_name)}</p>
                ${claim.policy_number ? `<p><strong>保单号：</strong>${escapeHtml(claim.policy_number)}</p>` : ''}
            </div>
            <div class="claim-card-footer">
                <span>创建时间：${formatDate(claim.created_at)}</span>
                <button class="btn-primary btn-small view-detail-btn" data-id="${claim.id}">查看详情</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.claim-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('view-detail-btn')) {
                const claimId = card.dataset.id;
                openClaimDetail(claimId);
            }
        });
    });
    
    document.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const claimId = btn.dataset.id;
            openClaimDetail(claimId);
        });
    });
}

async function openClaimDetail(claimId) {
    currentClaimId = claimId;
    document.getElementById('modal-claim-detail').classList.add('active');
    await loadClaimDetail(claimId);
}

async function loadClaimDetail(claimId) {
    try {
        const response = await fetch(`${API_BASE}/api/claims/${claimId}`);
        const data = await response.json();
        
        if (data.claim) {
            document.getElementById('edit-case-number').value = data.claim.case_number || '';
            document.getElementById('edit-customer-name').value = data.claim.customer_name || '';
            document.getElementById('edit-policy-number').value = data.claim.policy_number || '';
            document.getElementById('edit-status').value = data.claim.status || 'processing';
        }
        
        renderBills(data.bills || []);
        renderNotes(data.notes || []);
        
    } catch (error) {
        showNotification('加载案件详情失败', 'error');
        console.error('Error:', error);
    }
}

function renderBills(bills) {
    const container = document.getElementById('bills-container');
    
    if (bills.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无票据数据</p>';
        return;
    }
    
    container.innerHTML = bills.map(bill => `
        <div class="bill-item">
            <div class="bill-item-header">
                <span class="bill-item-title">${escapeHtml(bill.hospital || bill.bill_type || '未知票据')}</span>
                <span class="bill-item-amount">¥${(bill.amount || 0).toFixed(2)}</span>
            </div>
            <div class="bill-item-info">
                ${bill.bill_date ? `<p><strong>日期：</strong>${escapeHtml(bill.bill_date)}</p>` : ''}
                ${bill.department ? `<p><strong>科室：</strong>${escapeHtml(bill.department)}</p>` : ''}
                ${bill.bill_type ? `<p><strong>类型：</strong>${escapeHtml(bill.bill_type)}</p>` : ''}
                ${bill.invoice_number ? `<p><strong>发票号：</strong>${escapeHtml(bill.invoice_number)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

function renderNotes(notes) {
    const container = document.getElementById('notes-container');
    
    if (notes.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无备注</p>';
        return;
    }
    
    container.innerHTML = notes.map(note => `
        <div class="note-item">
            <div class="note-item-header">
                <span>${formatDate(note.created_at)}</span>
            </div>
            <div class="note-item-content">
                ${escapeHtml(note.content)}
            </div>
        </div>
    `).join('');
}

function populateClaimSelects() {
    const riskSelect = document.getElementById('risk-claim-select');
    const missingSelect = document.getElementById('missing-claim-select');
    
    const options = claims.map(claim => 
        `<option value="${claim.id}">${escapeHtml(claim.case_number)} - ${escapeHtml(claim.customer_name)}</option>`
    ).join('');
    
    riskSelect.innerHTML = '<option value="">选择案件</option>' + options;
    missingSelect.innerHTML = '<option value="">选择案件</option>' + options;
}

async function loadRiskChecks(claimId) {
    try {
        const response = await fetch(`${API_BASE}/api/claims/${claimId}`);
        const data = await response.json();
        
        renderRiskChecks(data.riskChecks || []);
    } catch (error) {
        showNotification('加载风险检查结果失败', 'error');
        console.error('Error:', error);
    }
}

function renderRiskChecks(checks) {
    const container = document.getElementById('risk-checks-container');
    
    if (checks.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无风险检查结果，请点击"执行风险检查"</p>';
        return;
    }
    
    container.innerHTML = checks.map(check => `
        <div class="risk-check-item">
            <div class="risk-check-icon ${check.status}">
                ${check.status === 'passed' ? '✓' : '!'}
            </div>
            <div class="risk-check-content">
                <h4 class="risk-check-title">${getRiskCheckTitle(check.check_type)}</h4>
                <p class="risk-check-message ${check.status}">${escapeHtml(check.message)}</p>
                <p class="risk-check-details">${escapeHtml(check.details || '')}</p>
            </div>
        </div>
    `).join('');
}

async function loadMissingItems(claimId) {
    try {
        const response = await fetch(`${API_BASE}/api/claims/${claimId}`);
        const data = await response.json();
        
        renderMissingItems(data.missingItems || []);
    } catch (error) {
        showNotification('加载缺件清单失败', 'error');
        console.error('Error:', error);
    }
}

function renderMissingItems(items) {
    const container = document.getElementById('missing-items-container');
    
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无缺件记录</p>';
        return;
    }
    
    container.innerHTML = items.map(item => `
        <div class="missing-item" data-id="${item.id}">
            <div class="missing-item-header">
                <span class="missing-item-type type-${escapeHtml(item.item_type)}">${escapeHtml(item.item_type)}</span>
                <span class="missing-item-status status-${item.status}">${item.status === 'pending' ? '待补充' : '已补充'}</span>
            </div>
            <div class="missing-item-description">
                ${escapeHtml(item.description)}
            </div>
            <div class="missing-item-footer">
                <span class="missing-item-priority priority-${item.priority}">
                    优先级：${getPriorityText(item.priority)}
                </span>
                <div class="missing-item-actions">
                    <button class="btn-secondary btn-small edit-missing-item" data-id="${item.id}">编辑</button>
                </div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.edit-missing-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = btn.dataset.id;
            const item = items.find(i => i.id == itemId);
            if (item) {
                openEditMissingItemModal(item);
            }
        });
    });
}

function openEditMissingItemModal(item) {
    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-item-type').value = item.item_type;
    document.getElementById('edit-item-description').value = item.description;
    document.getElementById('edit-item-status').value = item.status;
    document.getElementById('edit-item-priority').value = item.priority;
    document.getElementById('edit-item-notes').value = item.notes || '';
    
    document.getElementById('modal-edit-missing-item').classList.add('active');
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusText(status) {
    const statusMap = {
        'processing': '处理中',
        'pending': '待补件',
        'reviewing': '审核中',
        'completed': '已完成',
        'rejected': '已拒赔'
    };
    return statusMap[status] || status;
}

function getPriorityText(priority) {
    const priorityMap = {
        'high': '高',
        'medium': '中',
        'low': '低'
    };
    return priorityMap[priority] || priority;
}

function getRiskCheckTitle(checkType) {
    const titleMap = {
        'deductible': '免赔额检查',
        'waiting_period': '等待期检查',
        'duplicate_bills': '票据重复检查',
        'diagnosis_proof': '诊断证明检查',
        'invoice_stamp': '发票章检查'
    };
    return titleMap[checkType] || checkType;
}
