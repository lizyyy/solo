const API_BASE = '';
let currentPage = 1;
let selectedRecords = new Set();
let currentRecordId = null;
let currentTab = 'dashboard';

document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadStats();
    loadRecords();
    
    document.getElementById('batch-action').addEventListener('change', function() {
        const riskGroup = document.getElementById('batch-risk-group');
        riskGroup.style.display = this.value === 'modify' ? 'block' : 'none';
    });
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tab);
    });
    
    if (tab === 'dashboard') {
        loadStats();
    } else if (tab === 'records') {
        loadRecords();
    } else if (tab === 'misjudgments') {
        loadMisjudgments();
    } else if (tab === 'batches') {
        loadBatches();
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        document.getElementById('stat-total').textContent = data.total_records;
        document.getElementById('stat-high').textContent = data.risk_distribution.high;
        document.getElementById('stat-medium').textContent = data.risk_distribution.medium;
        document.getElementById('stat-low').textContent = data.risk_distribution.low;
        document.getElementById('stat-pending').textContent = data.review_status.pending;
        document.getElementById('stat-misjudgments').textContent = data.misjudgments.total;
    } catch (error) {
        console.error('加载统计失败:', error);
    }
}

async function loadRecords() {
    const riskLevel = document.getElementById('filter-risk').value;
    const status = document.getElementById('filter-status').value;
    const search = document.getElementById('search-input').value;
    
    const params = new URLSearchParams({
        page: currentPage,
        per_page: 20
    });
    if (riskLevel) params.append('risk_level', riskLevel);
    if (status) params.append('review_status', status);
    if (search) params.append('search', search);
    
    try {
        const response = await fetch(`${API_BASE}/api/records?${params}`);
        const data = await response.json();
        
        renderRecords(data.records);
        renderPagination(data.pages, data.current_page);
    } catch (error) {
        console.error('加载记录失败:', error);
    }
}

function renderRecords(records) {
    const container = document.getElementById('records-list');
    
    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">暂无记录</div>
                <div class="empty-state-hint">请先导入数据或调整筛选条件</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = records.map(record => `
        <div class="record-card risk-${record.final_risk_level}">
            <div class="record-header">
                <div class="record-info">
                    <div class="record-patient">
                        <input type="checkbox" class="record-checkbox" 
                               onchange="toggleSelect(${record.id})"
                               ${selectedRecords.has(record.id) ? 'checked' : ''}>
                        ${record.patient_name || '未知姓名'} (${record.patient_id})
                    </div>
                    <div class="record-date">随访日期: ${record.visit_date || '未知'}</div>
                </div>
                <div class="record-badge">
                    <span class="badge badge-${record.final_risk_level}">${record.final_risk_name}</span>
                    <span class="badge badge-${record.review_status}">${record.review_status_name}</span>
                </div>
            </div>
            
            <div class="record-content">
                <div class="record-text">${escapeHtml(record.follow_up_text)}</div>
                
                <div class="record-analysis">
                    <div class="analysis-row">
                        <span class="analysis-label">自动分层:</span>
                        <span class="analysis-value">
                            <span class="badge badge-${record.auto_risk_level}">
                                ${getRiskName(record.auto_risk_level)}
                            </span>
                            (置信度: ${(record.auto_confidence * 100).toFixed(0)}%)
                        </span>
                    </div>
                    <div class="analysis-row">
                        <span class="analysis-label">匹配关键词:</span>
                        <span class="analysis-value">
                            ${record.auto_risk_keywords ? 
                                record.auto_risk_keywords.split(',').map(k => 
                                    `<span class="keyword-tag">${escapeHtml(k)}</span>`
                                ).join('') : 
                                '无'}
                        </span>
                    </div>
                    <div class="analysis-row">
                        <span class="analysis-label">自动理由:</span>
                        <span class="analysis-value">${escapeHtml(record.auto_risk_reason || '')}</span>
                    </div>
                    ${record.manual_risk_level ? `
                        <div class="analysis-row">
                            <span class="analysis-label">人工修正:</span>
                            <span class="analysis-value">
                                <span class="badge badge-${record.manual_risk_level}">
                                    ${getRiskName(record.manual_risk_level)}
                                </span>
                                ${escapeHtml(record.manual_risk_reason || '')}
                            </span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="record-actions">
                <button class="btn btn-primary btn-small" onclick="showReviewModal(${record.id})">复核</button>
                <button class="btn btn-secondary btn-small" onclick="showHistoryModal(${record.id})">历史</button>
            </div>
        </div>
    `).join('');
}

function renderPagination(pages, current) {
    const container = document.getElementById('pagination');
    
    if (pages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = `<button onclick="goToPage(1)" ${current === 1 ? 'disabled' : ''}>首页</button>`;
    
    for (let i = Math.max(1, current - 2); i <= Math.min(pages, current + 2); i++) {
        html += `<button onclick="goToPage(${i})" class="${i === current ? 'active' : ''}">${i}</button>`;
    }
    
    html += `<button onclick="goToPage(${pages})" ${current === pages ? 'disabled' : ''}>末页</button>`;
    
    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadRecords();
}

function handleSearch(event) {
    if (event.key === 'Enter') {
        currentPage = 1;
        loadRecords();
    }
}

function filterByRisk(level) {
    document.getElementById('filter-risk').value = level;
    document.getElementById('filter-status').value = '';
    currentPage = 1;
    switchTab('records');
}

function filterByStatus(status) {
    document.getElementById('filter-risk').value = '';
    document.getElementById('filter-status').value = status;
    currentPage = 1;
    switchTab('records');
}

function toggleSelect(id) {
    if (selectedRecords.has(id)) {
        selectedRecords.delete(id);
    } else {
        selectedRecords.add(id);
    }
}

async function showReviewModal(id) {
    currentRecordId = id;
    
    try {
        const response = await fetch(`${API_BASE}/api/records/${id}`);
        const record = await response.json();
        
        const content = document.getElementById('review-content');
        content.innerHTML = `
            <div class="review-section">
                <h4>随访文本</h4>
                <div class="review-text">${escapeHtml(record.follow_up_text)}</div>
            </div>
            
            <div class="review-section">
                <h4>分层结果对比</h4>
                <div class="review-compare">
                    <div class="review-box">
                        <h5>自动分层</h5>
                        <div class="review-risk">
                            <span class="badge badge-${record.auto_risk_level}">
                                ${getRiskName(record.auto_risk_level)}
                            </span>
                            (置信度: ${(record.auto_confidence * 100).toFixed(0)}%)
                        </div>
                        <div><strong>理由:</strong> ${escapeHtml(record.auto_risk_reason || '')}</div>
                        <div><strong>关键词:</strong> ${record.auto_risk_keywords || '无'}</div>
                    </div>
                    <div class="review-box">
                        <h5>当前状态</h5>
                        <div class="review-risk">
                            <span class="badge badge-${record.final_risk_level}">
                                ${record.final_risk_name}
                            </span>
                            <span class="badge badge-${record.review_status}">
                                ${record.review_status_name}
                            </span>
                        </div>
                        ${record.manual_risk_level ? `
                            <div><strong>人工修正:</strong> ${getRiskName(record.manual_risk_level)}</div>
                            <div><strong>理由:</strong> ${escapeHtml(record.manual_risk_reason || '')}</div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="review-modify" id="modify-section" style="display:none;">
                <h4>人工修正</h4>
                <label>修正为:</label>
                <select id="modify-risk-level">
                    <option value="high">高风险</option>
                    <option value="medium">中风险</option>
                    <option value="low">低风险</option>
                </select>
                <label style="margin-top: 1rem;">修正理由:</label>
                <textarea id="modify-reason" placeholder="请输入修正理由..."></textarea>
            </div>
        `;
        
        showModal('review-modal');
    } catch (error) {
        console.error('加载记录失败:', error);
    }
}

function modifyRecord() {
    const section = document.getElementById('modify-section');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    
    if (section.style.display === 'none') {
        submitReview('modify');
    }
}

async function submitReview(action) {
    if (!currentRecordId) return;
    
    let data = { action };
    
    if (action === 'modify') {
        const riskLevel = document.getElementById('modify-risk-level').value;
        const reason = document.getElementById('modify-reason').value;
        
        if (!reason.trim()) {
            alert('请输入修正理由');
            return;
        }
        
        data.risk_level = riskLevel;
        data.reason = reason;
    } else if (action === 'rollback') {
        const reason = prompt('请输入回滚理由（可选）:');
        if (reason !== null) {
            data.reason = reason;
        }
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/records/${currentRecordId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('review-modal');
            loadRecords();
            loadStats();
            alert('操作成功');
        } else {
            alert('操作失败');
        }
    } catch (error) {
        console.error('操作失败:', error);
        alert('操作失败');
    }
}

function approveRecord() {
    submitReview('approve');
}

function rollbackRecord() {
    if (confirm('确定要回滚到待复核状态吗？')) {
        submitReview('rollback');
    }
}

async function showHistoryModal(id) {
    try {
        const response = await fetch(`${API_BASE}/api/records/${id}/history`);
        const histories = await response.json();
        
        const content = document.getElementById('history-content');
        
        if (!histories || histories.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <div class="empty-state-text">暂无历史记录</div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="history-timeline">
                    ${histories.map(h => `
                        <div class="history-item ${getHistoryClass(h.change_type)}">
                            <div class="history-type">${escapeHtml(h.change_type)}</div>
                            <div class="history-time">${formatDateTime(h.created_at)} · ${escapeHtml(h.operator || '系统')}</div>
                            <div class="history-detail">
                                ${h.previous_risk_level !== h.new_risk_level ? `
                                    <div>风险等级: 
                                        <span class="badge badge-${h.previous_risk_level}">${h.previous_risk_name}</span>
                                        → 
                                        <span class="badge badge-${h.new_risk_level}">${h.new_risk_name}</span>
                                    </div>
                                ` : ''}
                                ${h.previous_status !== h.new_status ? `
                                    <div>状态: ${h.previous_status_name} → ${h.new_status_name}</div>
                                ` : ''}
                                ${h.change_reason ? `<div>理由: ${escapeHtml(h.change_reason)}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        showModal('history-modal');
    } catch (error) {
        console.error('加载历史失败:', error);
    }
}

function getHistoryClass(changeType) {
    if (changeType && changeType.includes('确认')) return 'approve';
    if (changeType && changeType.includes('修正')) return 'modify';
    if (changeType && changeType.includes('回滚')) return 'rollback';
    return '';
}

async function loadMisjudgments() {
    const type = document.getElementById('filter-misjudgment-type').value;
    
    const params = new URLSearchParams({ page: 1, per_page: 50 });
    if (type) params.append('type', type);
    
    try {
        const response = await fetch(`${API_BASE}/api/misjudgments?${params}`);
        const data = await response.json();
        
        renderMisjudgments(data.misjudgments);
    } catch (error) {
        console.error('加载误判记录失败:', error);
    }
}

function renderMisjudgments(misjudgments) {
    const container = document.getElementById('misjudgments-list');
    
    if (!misjudgments || misjudgments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <div class="empty-state-text">暂无误判记录</div>
                <div class="empty-state-hint">人工修正时会自动记录误判</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = misjudgments.map(m => `
        <div class="misjudgment-card">
            <div class="misjudgment-header">
                <div class="misjudgment-type ${m.misjudgment_type === '误判' ? 'false-positive' : 'false-negative'}">
                    ${m.misjudgment_type}
                    ${m.misjudgment_type === '误判' ? '(假阳性: 自动过高)' : '(假阴性: 自动过低)'}
                </div>
                <div class="record-date">${formatDateTime(m.created_at)} · ${escapeHtml(m.reported_by || '')}</div>
            </div>
            
            <div class="misjudgment-compare">
                <div>
                    <strong>自动分层:</strong>
                    <span class="badge badge-${m.auto_risk_level}">${m.auto_risk_name}</span>
                </div>
                <span class="arrow">→</span>
                <div>
                    <strong>正确等级:</strong>
                    <span class="badge badge-${m.correct_risk_level}">${m.correct_risk_name}</span>
                </div>
            </div>
            
            <div class="record-text"><strong>随访文本:</strong> ${escapeHtml(m.follow_up_text)}</div>
            ${m.auto_keywords ? `<div class="record-text"><strong>匹配关键词:</strong> ${escapeHtml(m.auto_keywords)}</div>` : ''}
            ${m.correction_reason ? `<div class="record-text"><strong>修正理由:</strong> ${escapeHtml(m.correction_reason)}</div>` : ''}
        </div>
    `).join('');
}

async function loadBatches() {
    try {
        const response = await fetch(`${API_BASE}/api/batches`);
        const batches = await response.json();
        
        renderBatches(batches);
    } catch (error) {
        console.error('加载批次失败:', error);
    }
}

function renderBatches(batches) {
    const container = document.getElementById('batches-list');
    
    if (!batches || batches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">暂无导入批次</div>
                <div class="empty-state-hint">请先导入数据</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = batches.map(b => `
        <div class="batch-card">
            <div class="misjudgment-header">
                <div>
                    <strong>${escapeHtml(b.filename)}</strong>
                    <span class="record-date">批次ID: ${b.id}</span>
                </div>
                <div class="record-date">${formatDateTime(b.created_at)} · ${escapeHtml(b.imported_by || '')}</div>
            </div>
            
            <div class="batch-stats">
                <div class="batch-stat">
                    <div class="batch-stat-value">${b.total_records}</div>
                    <div class="batch-stat-label">总记录数</div>
                </div>
                <div class="batch-stat">
                    <div class="batch-stat-value" style="color: #dc3545;">${b.high_risk_count}</div>
                    <div class="batch-stat-label">高风险</div>
                </div>
                <div class="batch-stat">
                    <div class="batch-stat-value" style="color: #ffc107;">${b.medium_risk_count}</div>
                    <div class="batch-stat-label">中风险</div>
                </div>
                <div class="batch-stat">
                    <div class="batch-stat-value" style="color: #28a745;">${b.low_risk_count}</div>
                    <div class="batch-stat-label">低风险</div>
                </div>
            </div>
            
            <div class="record-actions" style="justify-content: flex-end;">
                <button class="btn btn-secondary btn-small" onclick="filterByBatch('${b.id}')">查看该批次记录</button>
            </div>
        </div>
    `).join('');
}

function filterByBatch(batchId) {
    document.getElementById('filter-risk').value = '';
    document.getElementById('filter-status').value = '';
    currentPage = 1;
    switchTab('records');
    
    setTimeout(() => {
        const params = new URLSearchParams({
            page: 1,
            per_page: 20,
            batch_id: batchId
        });
        fetch(`${API_BASE}/api/records?${params}`)
            .then(r => r.json())
            .then(data => {
                renderRecords(data.records);
                renderPagination(data.pages, data.current_page);
            });
    }, 100);
}

function showBatchModal() {
    if (selectedRecords.size === 0) {
        alert('请先选择要操作的记录');
        return;
    }
    
    document.getElementById('batch-count').textContent = selectedRecords.size;
    showModal('batch-modal');
}

async function executeBatchAction() {
    const action = document.getElementById('batch-action').value;
    const riskLevel = document.getElementById('batch-risk-level').value;
    const reason = document.getElementById('batch-reason').value;
    
    if (action === 'modify' && !reason.trim()) {
        alert('请输入修正理由');
        return;
    }
    
    const data = {
        record_ids: Array.from(selectedRecords),
        action,
        reason
    };
    
    if (action === 'modify') {
        data.risk_level = riskLevel;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/records/batch-review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeModal('batch-modal');
            selectedRecords.clear();
            loadRecords();
            loadStats();
            alert(`成功处理 ${result.processed}/${result.total} 条记录`);
        } else {
            alert('批量操作失败');
        }
    } catch (error) {
        console.error('批量操作失败:', error);
        alert('批量操作失败');
    }
}

function showImportModal() {
    document.getElementById('import-file').value = '';
    showModal('import-modal');
}

async function importData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择文件');
        return;
    }
    
    document.getElementById('import-progress').style.display = 'block';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE}/api/import`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        document.getElementById('import-progress').style.display = 'none';
        
        if (result.success) {
            closeModal('import-modal');
            loadRecords();
            loadStats();
            alert(`导入成功!\n总记录: ${result.total_records}\n高风险: ${result.high_risk_count}\n中风险: ${result.medium_risk_count}\n低风险: ${result.low_risk_count}`);
        } else {
            alert('导入失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        document.getElementById('import-progress').style.display = 'none';
        console.error('导入失败:', error);
        alert('导入失败');
    }
}

async function showRulesModal() {
    try {
        const response = await fetch(`${API_BASE}/api/rules`);
        const rules = await response.json();
        
        const content = document.getElementById('rules-content');
        content.innerHTML = `
            <div class="rules-section">
                <h4>高风险规则</h4>
                ${Object.entries(rules.high_risk.categories).map(([cat, keywords]) => `
                    <div class="rules-category high">
                        <h5>${cat}</h5>
                        <div class="rules-keywords">
                            ${keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="rules-section">
                <h4>中风险规则</h4>
                ${Object.entries(rules.medium_risk.categories).map(([cat, keywords]) => `
                    <div class="rules-category medium">
                        <h5>${cat}</h5>
                        <div class="rules-keywords">
                            ${keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="rules-section">
                <h4>低风险规则</h4>
                ${Object.entries(rules.low_risk.categories).map(([cat, keywords]) => `
                    <div class="rules-category low">
                        <h5>${cat}</h5>
                        <div class="rules-keywords">
                            ${keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="alert alert-info" style="margin-top: 1rem;">
                <strong>提示:</strong> 规则引擎支持否定词检测（如"无胸痛"不会匹配"胸痛"）。如需修改规则，请编辑 risk_engine.py 文件。
            </div>
        `;
        
        showModal('rules-modal');
    } catch (error) {
        console.error('加载规则失败:', error);
    }
}

function showTestModal() {
    document.getElementById('test-text').value = '';
    document.getElementById('test-result').style.display = 'none';
    showModal('test-modal');
}

async function testStratify() {
    const text = document.getElementById('test-text').value.trim();
    
    if (!text) {
        alert('请输入随访文本');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/test-stratify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const result = await response.json();
        
        const container = document.getElementById('test-result');
        container.style.display = 'block';
        container.innerHTML = `
            <h4>分层结果</h4>
            <div class="test-risk">
                <span class="badge badge-${result.risk_level}">${result.risk_name}</span>
                (置信度: ${(result.confidence * 100).toFixed(0)}%)
            </div>
            <div><strong>理由:</strong> ${escapeHtml(result.reason)}</div>
            ${result.keywords && result.keywords.length > 0 ? `
                <div style="margin-top: 0.5rem;">
                    <strong>匹配关键词:</strong>
                    ${result.keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('')}
                </div>
            ` : ''}
            ${result.categories && result.categories.length > 0 ? `
                <div style="margin-top: 0.5rem;">
                    <strong>分类:</strong> ${result.categories.join(', ')}
                </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('测试失败:', error);
        alert('测试失败');
    }
}

function exportRecords() {
    const riskLevel = document.getElementById('filter-risk').value;
    const status = document.getElementById('filter-status').value;
    
    const params = new URLSearchParams({ format: 'xlsx' });
    if (riskLevel) params.append('risk_level', riskLevel);
    if (status) params.append('review_status', status);
    
    window.location.href = `${API_BASE}/api/export?${params}`;
}

function exportMisjudgments() {
    window.location.href = `${API_BASE}/api/export/misjudgments`;
}

function getRiskName(level) {
    const names = { high: '高风险', medium: '中风险', low: '低风险' };
    return names[level] || level;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};
