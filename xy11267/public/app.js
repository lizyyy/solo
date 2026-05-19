let currentRecordId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    loadRules();
    loadAuditLogs();
    
    document.getElementById('inspectionForm').addEventListener('submit', submitInspection);
    document.getElementById('records-tab').addEventListener('click', loadRecords);
});

async function loadStatistics() {
    try {
        const response = await fetch('/api/records/statistics');
        const data = await response.json();
        if (data.success) {
            document.getElementById('totalRecords').textContent = data.data.total;
            document.getElementById('passedRecords').textContent = data.data.passed;
            document.getElementById('failedRecords').textContent = data.data.failed;
            document.getElementById('passRate').textContent = data.data.passRate + '%';
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

async function submitInspection(e) {
    e.preventDefault();
    
    const submitLoading = document.getElementById('submitLoading');
    submitLoading.classList.remove('d-none');
    
    try {
        const operator = document.getElementById('operator').value;
        const role = document.getElementById('role').value;
        const sessionId = document.getElementById('sessionId').value;
        const transcriptText = document.getElementById('transcriptText').value;
        const speakersStr = document.getElementById('speakers').value;
        
        let speakers = [];
        try {
            speakers = JSON.parse(speakersStr);
        } catch (e) {
            console.warn('解析说话人数据失败，使用空数组');
        }
        
        const response = await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: {
                    session_id: sessionId,
                    transcript_text: transcriptText,
                    speakers: speakers
                },
                operator,
                role
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayResult(data.data);
            loadStatistics();
        } else {
            alert('质检失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('提交质检失败:', error);
        alert('提交质检失败，请检查服务是否运行');
    } finally {
        submitLoading.classList.add('d-none');
    }
}

function displayResult(result) {
    const resultContainer = document.getElementById('resultContainer');
    const resultContent = document.getElementById('resultContent');
    
    let html = `
        <div class="alert ${result.passed ? 'alert-success' : 'alert-warning'}">
            <h6>${result.passed ? '质检通过 ✓' : '发现违规问题 ⚠'}</h6>
            <p>风险等级: <span class="risk-${result.riskLevel}">${result.riskLevel === 'high' ? '高' : result.riskLevel === 'medium' ? '中' : '正常'}</span></p>
            <p>${result.summary}</p>
        </div>
        <div class="row">
            <div class="col-md-6">
                <h6>违规项:</h6>
    `;
    
    if (result.violations && result.violations.length > 0) {
        result.violations.forEach(v => {
            html += `<div class="violation-item">
                <strong>${v.ruleName}</strong> (${v.severity === 'high' ? '高' : v.severity === 'medium' ? '中' : '低'})<br>
                ${v.reason}
            </div>`;
        });
    } else {
        html += '<p>无违规项</p>';
    }
    
    html += `</div><div class="col-md-6"><h6>通过项:</h6>`;
    
    if (result.passedRules && result.passedRules.length > 0) {
        result.passedRules.forEach(p => {
            html += `<div class="passed-item">
                <strong>${p.ruleName}</strong><br>
                ${p.reason}
            </div>`;
        });
    } else {
        html += '<p>无通过项</p>';
    }
    
    html += `</div></div>`;
    
    resultContent.innerHTML = html;
    resultContainer.style.display = 'block';
}

async function loadRecords() {
    const loading = document.getElementById('recordsLoading');
    loading.classList.add('show');
    
    try {
        const status = document.getElementById('filterStatus').value;
        const risk = document.getElementById('filterRisk').value;
        
        let url = '/api/records?limit=10';
        if (status) url += '&status=' + status;
        if (risk) url += '&risk_level=' + risk;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            displayRecords(data.data.records);
        }
    } catch (error) {
        console.error('加载记录失败:', error);
    } finally {
        loading.classList.remove('show');
    }
}

function displayRecords(records) {
    const container = document.getElementById('recordsList');
    
    if (records.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">暂无记录</p>';
        return;
    }
    
    let html = '<div class="list-group">';
    
    records.forEach(record => {
        const statusLabel = {
            'approved': '已通过',
            'pending_review': '待审核',
            'rejected': '已拒绝'
        };
        
        const statusClass = {
            'approved': 'success',
            'pending_review': 'warning',
            'rejected': 'danger'
        };
        
        html += `
            <div class="list-group-item list-group-item-action" onclick="showRecordDetail('${record.record_id}')">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${record.record_id}</strong>
                        <span class="ms-2 badge bg-${statusClass[record.status] || 'secondary'}">
                            ${statusLabel[record.status] || record.status}
                        </span>
                        <span class="ms-2 risk-${record.risk_level}">
                            风险: ${record.risk_level === 'high' ? '高' : record.risk_level === 'medium' ? '中' : '正常'}
                        </span>
                    </div>
                    <small class="text-muted">${record.created_at}</small>
                </div>
                <p class="mb-0 mt-2 text-truncate" style="max-width: 100%;">
                    ${record.transcript_text.substring(0, 100)}...
                </p>
                <small class="text-muted">操作人: ${record.operator} | 角色: ${record.role}</small>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function showRecordDetail(recordId) {
    currentRecordId = recordId;
    
    try {
        const response = await fetch(`/api/records/${recordId}`);
        const data = await response.json();
        
        if (data.success) {
            const record = data.data;
            const content = document.getElementById('recordDetailContent');
            
            let violationsHtml = '';
            const violations = record.violation_details || [];
            violations.forEach(v => {
                violationsHtml += `<div class="violation-item">
                    <strong>${v.ruleName}</strong> (${v.severity})<br>
                    ${v.reason}
                </div>`;
            });
            
            content.innerHTML = `
                <h6>基本信息</h6>
                <table class="table table-sm">
                    <tr><td>记录ID:</td><td>${record.record_id}</td></tr>
                    <tr><td>会话ID:</td><td>${record.session_id}</td></tr>
                    <tr><td>操作人:</td><td>${record.operator}</td></tr>
                    <tr><td>角色:</td><td>${record.role}</td></tr>
                    <tr><td>质检结果:</td><td>${record.inspection_result === 'passed' ? '通过' : '未通过'}</td></tr>
                    <tr><td>风险等级:</td><td class="risk-${record.risk_level}">${record.risk_level === 'high' ? '高' : record.risk_level === 'medium' ? '中' : '正常'}</td></tr>
                    <tr><td>状态:</td><td>${record.status}</td></tr>
                    <tr><td>创建时间:</td><td>${record.created_at}</td></tr>
                </table>
                <h6>违规详情:</h6>
                ${violationsHtml || '<p>无违规</p>'}
                <h6>转写文本:</h6>
                <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-radius: 4px;">${record.transcript_text}</pre>
            `;
            
            document.getElementById('updateStatus').value = record.status;
            
            const modal = new bootstrap.Modal(document.getElementById('recordDetailModal'));
            modal.show();
        }
    } catch (error) {
        console.error('加载记录详情失败:', error);
        alert('加载记录详情失败');
    }
}

async function updateRecordStatus() {
    if (!currentRecordId) return;
    
    try {
        const operator = document.getElementById('operator').value || 'admin';
        const role = document.getElementById('role').value || 'admin';
        const status = document.getElementById('updateStatus').value;
        const reason = document.getElementById('updateReason').value || '手动更新';
        
        const response = await fetch(`/api/records/${currentRecordId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, inspector: operator, role, reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('状态更新成功');
            bootstrap.Modal.getInstance(document.getElementById('recordDetailModal')).hide();
            loadRecords();
            loadStatistics();
        } else {
            alert('更新失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('更新状态失败:', error);
        alert('更新失败');
    }
}

async function rerunCurrentRecord() {
    if (!currentRecordId) return;
    
    try {
        const operator = document.getElementById('operator').value || 'admin';
        const role = document.getElementById('role').value || 'admin';
        
        const response = await fetch(`/api/records/${currentRecordId}/rerun`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator, role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('重新质检成功');
            showRecordDetail(currentRecordId);
            loadRecords();
            loadStatistics();
        } else {
            alert('重新质检失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('重新质检失败:', error);
        alert('重新质检失败');
    }
}

async function rerunAllRecords() {
    if (!confirm('确定要重新质检所有记录吗？')) return;
    
    try {
        const operator = document.getElementById('operator').value || 'admin';
        const role = document.getElementById('role').value || 'admin';
        
        const response = await fetch('/api/records/rerun-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator, role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`批量重新质检完成，共处理 ${data.data.processed} 条记录`);
            loadRecords();
            loadStatistics();
        } else {
            alert('批量重新质检失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('批量重新质检失败:', error);
        alert('批量重新质检失败');
    }
}

async function loadRules() {
    try {
        const response = await fetch('/api/rules');
        const data = await response.json();
        
        if (data.success) {
            displayRules(data.data);
        }
    } catch (error) {
        console.error('加载规则失败:', error);
    }
}

function displayRules(rules) {
    const container = document.getElementById('rulesList');
    
    let html = '<div class="list-group">';
    
    rules.forEach(rule => {
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${rule.rule_name}</strong>
                        <span class="ms-2 badge bg-${rule.severity === 'high' ? 'danger' : rule.severity === 'medium' ? 'warning' : 'info'}">
                            ${rule.severity === 'high' ? '高' : rule.severity === 'medium' ? '中' : '低'}
                        </span>
                        <span class="ms-2 badge bg-${rule.is_enabled ? 'success' : 'secondary'}">
                            ${rule.is_enabled ? '启用' : '禁用'}
                        </span>
                    </div>
                </div>
                <p class="mb-1 mt-2"><small>关键词: ${rule.keywords}</small></p>
                <small class="text-muted">类型: ${rule.rule_type} | 版本: ${rule.version}</small>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function createRule() {
    try {
        const ruleType = document.getElementById('newRuleType').value;
        const ruleName = document.getElementById('newRuleName').value;
        const keywords = document.getElementById('newKeywords').value;
        const severity = document.getElementById('newSeverity').value;
        const operator = document.getElementById('operator').value || 'admin';
        const role = document.getElementById('role').value || 'admin';
        
        if (!ruleType || !ruleName || !keywords) {
            alert('请填写完整信息');
            return;
        }
        
        const response = await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rule_type: ruleType,
                rule_name: ruleName,
                keywords,
                severity,
                is_enabled: 1,
                operator,
                role
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('规则创建成功');
            loadRules();
            document.getElementById('newRuleType').value = '';
            document.getElementById('newRuleName').value = '';
            document.getElementById('newKeywords').value = '';
        } else {
            alert('创建失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('创建规则失败:', error);
        alert('创建规则失败');
    }
}

async function loadAuditLogs() {
    const loading = document.getElementById('auditLoading');
    loading.classList.add('show');
    
    try {
        const response = await fetch('/api/audit?limit=50');
        const data = await response.json();
        
        if (data.success) {
            displayAuditLogs(data.data.logs);
        }
    } catch (error) {
        console.error('加载审计日志失败:', error);
    } finally {
        loading.classList.remove('show');
    }
}

function displayAuditLogs(logs) {
    const container = document.getElementById('auditList');
    
    if (logs.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">暂无日志</p>';
        return;
    }
    
    let html = '<div class="list-group">';
    
    logs.forEach(log => {
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${log.action_type}</strong>
                        <span class="ms-2">操作人: ${log.operator}</span>
                        <span class="ms-2">角色: ${log.role}</span>
                    </div>
                    <small class="text-muted">${log.created_at}</small>
                </div>
                <p class="mb-0 mt-2"><small>${log.action_details}</small></p>
                ${log.record_id ? `<small class="text-muted">记录ID: ${log.record_id}</small>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function exportRecords() {
    try {
        const operator = document.getElementById('operator').value || 'admin';
        const role = document.getElementById('role').value || 'admin';
        
        const response = await fetch('/api/exports/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: {}, operator, role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = `/api/exports/download/${data.data.filename}`;
        } else {
            alert('导出失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败');
    }
}

async function exportAuditLogs() {
    try {
        const operator = document.getElementById('operator').value || 'admin';
        const role = document.getElementById('role').value || 'admin';
        
        const response = await fetch('/api/exports/audit-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: {}, operator, role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = `/api/exports/download/${data.data.filename}`;
        } else {
            alert('导出失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败');
    }
}
