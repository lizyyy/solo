let currentStats = null;
let detailModal = null;
let reviewModal = null;
let rollbackModal = null;

document.addEventListener('DOMContentLoaded', function() {
    detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
    reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
    rollbackModal = new bootstrap.Modal(document.getElementById('rollbackModal'));
    
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab(this.dataset.tab);
        });
    });
    
    loadStats();
    loadDetections();
});

function switchTab(tabName) {
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.toggle('active', tab.id === tabName + '-tab');
    });
    
    if (tabName === 'dashboard') loadStats();
    if (tabName === 'resumes') loadResumes();
    if (tabName === 'detections') loadDetections();
}

function formatRiskLevel(level) {
    const map = {
        'high': '<span class="badge risk-badge-high">高风险</span>',
        'medium': '<span class="badge risk-badge-medium">中风险</span>',
        'low': '<span class="badge risk-badge-low">低风险</span>',
        'none': '<span class="badge bg-secondary">无风险</span>'
    };
    return map[level] || level;
}

function formatLabel(label) {
    const map = {
        'duplicate': '<span class="badge status-confirmed">重复投递</span>',
        'potential': '<span class="badge bg-warning text-dark">疑似重复</span>',
        'confirmed_duplicate': '<span class="badge status-confirmed">确认重复</span>',
        'not_duplicate': '<span class="badge status-not-duplicate">非重复</span>'
    };
    return map[label] || '<span class="badge status-pending">待复核</span>';
}

function formatAction(action) {
    const map = {
        'review': '人工复核',
        'rollback': '误判回滚',
        'unrollback': '取消回滚'
    };
    return map[action] || action;
}

async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        currentStats = data;
        
        const cards = [
            { title: '简历总数', value: data.total_resumes, icon: 'bi-file-earmark-person', color: 'primary' },
            { title: '风险检测记录', value: data.total_detections, icon: 'bi-exclamation-triangle', color: 'warning' },
            { title: '待复核', value: data.pending_count, icon: 'bi-clock', color: 'info' },
            { title: '高风险', value: data.high_risk, icon: 'bi-danger', color: 'danger' },
            { title: '中风险', value: data.medium_risk, icon: 'bi-exclamation-circle', color: 'warning' },
            { title: '已回滚', value: data.rollback_count, icon: 'bi-arrow-counterclockwise', color: 'secondary' }
        ];
        
        document.getElementById('stats-cards').innerHTML = cards.map(card => `
            <div class="col-md-4 mb-3">
                <div class="card bg-${card.color} text-white">
                    <div class="card-body">
                        <h3>${card.value}</h3>
                        <p class="mb-0">${card.title}</p>
                    </div>
                </div>
            </div>
        `).join('');
        
        const batchesTable = document.querySelector('#recent-batches-table tbody');
        batchesTable.innerHTML = data.batches.map(b => `
            <tr>
                <td><small>${b.id}</small></td>
                <td>${b.file_name}</td>
                <td>
                    <span class="text-success">${b.success_records}</span> / 
                    <span class="text-danger">${b.failed_records}</span>
                </td>
                <td>${b.created_at}</td>
            </tr>
        `).join('');
        
        const batchFilter = document.getElementById('resume-batch-filter');
        if (batchFilter) {
            const currentVal = batchFilter.value;
            batchFilter.innerHTML = '<option value="">所有批次</option>' + 
                data.batches.map(b => `<option value="${b.id}">${b.file_name}</option>`).join('');
            batchFilter.value = currentVal;
        }
        
    } catch (e) {
        console.error('加载统计失败', e);
    }
}

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('请选择文件');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    const resultDiv = document.getElementById('upload-result');
    resultDiv.innerHTML = '<div class="alert alert-info">正在导入...</div>';
    
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (res.ok) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <strong>导入成功！</strong><br>
                    批次ID: ${data.batch_id}<br>
                    总记录: ${data.total_records}, 成功: ${data.success_records}, 失败: ${data.failed_records}
                </div>
                <button class="btn btn-primary" onclick="runDetection('${data.batch_id}')">
                    对该批次运行重复检测
                </button>
            `;
            loadStats();
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        }
    } catch (e) {
        resultDiv.innerHTML = `<div class="alert alert-danger">上传失败: ${e.message}</div>`;
    }
}

async function runDetection(batchId = null) {
    if (!confirm('确定要运行重复检测吗？这可能需要一些时间。')) return;
    
    try {
        const res = await fetch('/api/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_id: batchId, min_score: 30 })
        });
        const data = await res.json();
        
        if (res.ok) {
            alert(`检测完成！\n检测到 ${data.total_detected} 对候选重复\n新增 ${data.new_detections} 条记录\n高风险: ${data.high_risk}, 中风险: ${data.medium_risk}, 低风险: ${data.low_risk}`);
            loadStats();
            if (batchId) switchTab('detections');
        } else {
            alert('检测失败: ' + data.error);
        }
    } catch (e) {
        alert('检测失败: ' + e.message);
    }
}

async function loadDetections(page = 1) {
    const params = new URLSearchParams({
        page,
        per_page: 10,
        risk_level: document.getElementById('det-risk-filter').value,
        is_reviewed: document.getElementById('det-reviewed-filter').value,
        is_rollback: document.getElementById('det-rollback-filter').value
    });
    
    try {
        const res = await fetch('/api/detections?' + params);
        const data = await res.json();
        
        const tbody = document.querySelector('#detections-table tbody');
        tbody.innerHTML = data.items.map(item => {
            const rollbackClass = item.is_rollback ? 'rollback-status' : '';
            return `
                <tr class="${rollbackClass}">
                    <td>${item.id} <span class="version-tag">v${item.version}</span></td>
                    <td>${formatRiskLevel(item.risk_level)}</td>
                    <td>${item.risk_score.toFixed(1)}</td>
                    <td>
                        <strong>${item.resume_a?.name || '-'}</strong><br>
                        <small>${item.resume_a?.phone || ''} ${item.resume_a?.email || ''}</small>
                    </td>
                    <td>
                        <strong>${item.resume_b?.name || '-'}</strong><br>
                        <small>${item.resume_b?.phone || ''} ${item.resume_b?.email || ''}</small>
                    </td>
                    <td><small>${item.risk_reason}</small></td>
                    <td>${formatLabel(item.manual_label)}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-info" onclick="viewDetection(${item.id})">详情</button>
                            ${!item.manual_label ? `<button class="btn btn-warning" onclick="openReviewModal(${item.id})">复核</button>` : ''}
                            ${!item.is_rollback ? `<button class="btn btn-danger" onclick="openRollbackModal(${item.id})">回滚</button>` : ''}
                            ${item.is_rollback ? `<button class="btn btn-success" onclick="unrollbackDetection(${item.id})">取消回滚</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        renderPagination('detections-pagination', data, loadDetections);
        
    } catch (e) {
        console.error('加载检测记录失败', e);
    }
}

async function loadResumes(page = 1) {
    const params = new URLSearchParams({
        page,
        per_page: 20,
        search: document.getElementById('resume-search').value,
        batch_id: document.getElementById('resume-batch-filter').value
    });
    
    try {
        const res = await fetch('/api/resumes?' + params);
        const data = await res.json();
        
        const tbody = document.querySelector('#resumes-table tbody');
        tbody.innerHTML = data.items.map(r => `
            <tr>
                <td>${r.id}</td>
                <td><strong>${r.name}</strong></td>
                <td>${r.phone || '-'}</td>
                <td>${r.email || '-'}</td>
                <td>${r.education || '-'}</td>
                <td>${r.school || '-'}</td>
                <td><small>${r.batch_id.substring(0, 15)}...</small></td>
                <td><button class="btn btn-sm btn-info" onclick="viewResume(${r.id})">详情</button></td>
            </tr>
        `).join('');
        
        renderPagination('resumes-pagination', data, loadResumes);
        
    } catch (e) {
        console.error('加载简历列表失败', e);
    }
}

async function viewDetection(id) {
    try {
        const res = await fetch(`/api/detections/${id}`);
        const data = await res.json();
        
        document.getElementById('detailModalBody').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">候选人 A</div>
                        <div class="card-body">
                            <p><strong>姓名:</strong> ${data.resume_a?.name || '-'}</p>
                            <p><strong>手机:</strong> ${data.resume_a?.phone || '-'}</p>
                            <p><strong>邮箱:</strong> ${data.resume_a?.email || '-'}</p>
                            <p><strong>身份证:</strong> ${data.resume_a?.id_number || '-'}</p>
                            <p><strong>学校:</strong> ${data.resume_a?.school || '-'}</p>
                            <p><strong>公司:</strong> ${data.resume_a?.current_company || '-'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">候选人 B</div>
                        <div class="card-body">
                            <p><strong>姓名:</strong> ${data.resume_b?.name || '-'}</p>
                            <p><strong>手机:</strong> ${data.resume_b?.phone || '-'}</p>
                            <p><strong>邮箱:</strong> ${data.resume_b?.email || '-'}</p>
                            <p><strong>身份证:</strong> ${data.resume_b?.id_number || '-'}</p>
                            <p><strong>学校:</strong> ${data.resume_b?.school || '-'}</p>
                            <p><strong>公司:</strong> ${data.resume_b?.current_company || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card mt-3">
                <div class="card-header">检测信息</div>
                <div class="card-body">
                    <p><strong>风险等级:</strong> ${formatRiskLevel(data.risk_level)}</p>
                    <p><strong>风险分数:</strong> ${data.risk_score.toFixed(1)}</p>
                    <p><strong>匹配字段:</strong> ${(data.matched_fields || []).join(', ')}</p>
                    <p><strong>风险原因:</strong> ${data.risk_reason}</p>
                    <p><strong>自动标注:</strong> ${formatLabel(data.auto_label)}</p>
                    <p><strong>人工标注:</strong> ${formatLabel(data.manual_label)}</p>
                    <p><strong>复核人:</strong> ${data.reviewed_by || '-'}</p>
                    <p><strong>复核备注:</strong> ${data.reviewer_comment || '-'}</p>
                    <p><strong>回滚状态:</strong> ${data.is_rollback ? '<span class="text-danger">已回滚</span>' : '正常'}
                    ${data.rollback_reason ? ` (原因: ${data.rollback_reason})` : ''}</p>
                    <p><strong>当前版本:</strong> v${data.version}</p>
                </div>
            </div>
            
            <div class="card mt-3">
                <div class="card-header">版本历史</div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead>
                            <tr><th>版本</th><th>操作</th><th>操作人</th><th>变更原因</th><th>时间</th></tr>
                        </thead>
                        <tbody>
                            ${(data.history || []).map(h => `
                                <tr>
                                    <td>v${h.version}</td>
                                    <td>${formatAction(h.action)}</td>
                                    <td>${h.action_by || '-'}</td>
                                    <td>${h.change_reason || '-'}</td>
                                    <td><small>${h.created_at}</small></td>
                                </tr>
                            `).join('') || '<tr><td colspan="5" class="text-center">暂无历史记录</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        detailModal.show();
    } catch (e) {
        alert('加载详情失败');
    }
}

async function viewResume(id) {
    try {
        const res = await fetch(`/api/resumes/${id}`);
        const data = await res.json();
        
        const r = data.resume;
        document.getElementById('detailModalBody').innerHTML = `
            <div class="card">
                <div class="card-header">简历详情 - ${r.name}</div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>ID:</strong> ${r.id}</p>
                            <p><strong>手机:</strong> ${r.phone || '-'}</p>
                            <p><strong>邮箱:</strong> ${r.email || '-'}</p>
                            <p><strong>身份证:</strong> ${r.id_number || '-'}</p>
                            <p><strong>出生日期:</strong> ${r.birth_date || '-'}</p>
                            <p><strong>性别:</strong> ${r.gender || '-'}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>学历:</strong> ${r.education || '-'}</p>
                            <p><strong>学校:</strong> ${r.school || '-'}</p>
                            <p><strong>专业:</strong> ${r.major || '-'}</p>
                            <p><strong>工作年限:</strong> ${r.work_years || '-'}</p>
                            <p><strong>现公司:</strong> ${r.current_company || '-'}</p>
                            <p><strong>现职位:</strong> ${r.current_position || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card mt-3">
                <div class="card-header">关联的风险检测 (${data.related_detections.length})</div>
                <div class="card-body">
                    ${data.related_detections.length > 0 ? `
                        <table class="table table-sm">
                            <thead><tr><th>检测ID</th><th>对方</th><th>风险等级</th><th>分数</th><th>状态</th></tr></thead>
                            <tbody>
                                ${data.related_detections.map(d => `
                                    <tr>
                                        <td>${d.id}</td>
                                        <td>${d.other_resume?.name || '-'}</td>
                                        <td>${formatRiskLevel(d.risk_level)}</td>
                                        <td>${d.risk_score.toFixed(1)}</td>
                                        <td>${formatLabel(d.manual_label)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-center text-muted">暂无关联的风险检测记录</p>'}
                </div>
            </div>
        `;
        
        detailModal.show();
    } catch (e) {
        alert('加载简历详情失败');
    }
}

function openReviewModal(detectionId) {
    document.getElementById('review-detection-id').value = detectionId;
    document.getElementById('review-comment').value = '';
    document.getElementById('review-label').value = 'confirmed_duplicate';
    reviewModal.show();
}

async function submitReview() {
    const detectionId = parseInt(document.getElementById('review-detection-id').value);
    const manualLabel = document.getElementById('review-label').value;
    const comment = document.getElementById('review-comment').value;
    
    try {
        const res = await fetch(`/api/detections/${detectionId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                manual_label: manualLabel,
                reviewer_comment: comment,
                reviewer: 'admin'
            })
        });
        
        if (res.ok) {
            alert('复核成功！');
            reviewModal.hide();
            loadDetections();
            loadStats();
        } else {
            const data = await res.json();
            alert('复核失败: ' + data.error);
        }
    } catch (e) {
        alert('复核失败: ' + e.message);
    }
}

function openRollbackModal(detectionId) {
    document.getElementById('rollback-detection-id').value = detectionId;
    document.getElementById('rollback-reason').value = '';
    rollbackModal.show();
}

async function submitRollback() {
    const detectionId = parseInt(document.getElementById('rollback-detection-id').value);
    const reason = document.getElementById('rollback-reason').value;
    
    try {
        const res = await fetch(`/api/detections/${detectionId}/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rollback_reason: reason,
                rollback_by: 'admin'
            })
        });
        
        if (res.ok) {
            alert('回滚成功！');
            rollbackModal.hide();
            loadDetections();
            loadStats();
        } else {
            const data = await res.json();
            alert('回滚失败: ' + data.error);
        }
    } catch (e) {
        alert('回滚失败: ' + e.message);
    }
}

async function unrollbackDetection(detectionId) {
    if (!confirm('确定要取消该记录的回滚状态吗？')) return;
    
    try {
        const res = await fetch(`/api/detections/${detectionId}/unrollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reason: '取消回滚',
                action_by: 'admin'
            })
        });
        
        if (res.ok) {
            alert('已取消回滚！');
            loadDetections();
            loadStats();
        } else {
            const data = await res.json();
            alert('操作失败: ' + data.error);
        }
    } catch (e) {
        alert('操作失败: ' + e.message);
    }
}

async function loadHistory() {
    const detectionId = document.getElementById('history-detection-id').value;
    if (!detectionId) {
        alert('请输入检测记录ID');
        return;
    }
    
    try {
        const res = await fetch(`/api/detections/${detectionId}`);
        const data = await res.json();
        
        const tbody = document.querySelector('#history-table tbody');
        if (data.history && data.history.length > 0) {
            tbody.innerHTML = data.history.map(h => `
                <tr>
                    <td>${h.id}</td>
                    <td>${h.detection_id}</td>
                    <td>v${h.version}</td>
                    <td>${formatAction(h.action)}</td>
                    <td>${h.action_by || '-'}</td>
                    <td>
                        标注: ${formatLabel(h.old_manual_label)} → ${formatLabel(h.new_manual_label)}
                    </td>
                    <td>${h.change_reason || '-'}</td>
                    <td><small>${h.created_at}</small></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">该检测记录暂无历史变更</td></tr>';
        }
    } catch (e) {
        alert('查询历史失败');
    }
}

function exportRiskReport() {
    const riskLevel = document.getElementById('export-risk-level').value;
    const url = '/api/export/risk' + (riskLevel ? `?risk_level=${riskLevel}` : '');
    window.location.href = url;
}

function exportHistoryReport() {
    const detectionId = document.getElementById('export-history-id').value;
    const url = '/api/export/history' + (detectionId ? `?detection_id=${detectionId}` : '');
    window.location.href = url;
}

function renderPagination(containerId, data, loadFunc) {
    const container = document.getElementById(containerId);
    if (!container || data.pages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<ul class="pagination pagination-sm justify-content-center">';
    
    html += `<li class="page-item ${data.current_page <= 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="return ${loadFunc.name}(${data.current_page - 1})">上一页</a>
    </li>`;
    
    for (let i = 1; i <= data.pages; i++) {
        if (i === 1 || i === data.pages || 
            (i >= data.current_page - 2 && i <= data.current_page + 2)) {
            html += `<li class="page-item ${i === data.current_page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="return ${loadFunc.name}(${i})">${i}</a>
            </li>`;
        } else if (i === data.current_page - 3 || i === data.current_page + 3) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }
    
    html += `<li class="page-item ${data.current_page >= data.pages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="return ${loadFunc.name}(${data.current_page + 1})">下一页</a>
    </li>`;
    
    html += '</ul>';
    container.innerHTML = html;
}
