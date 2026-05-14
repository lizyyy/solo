const API_BASE = 'http://localhost:8000/api';

let currentView = 'batches';
let currentBatchId = null;
let data = null;

async function init() {
    await loadData();
    renderBatches();
    setupEventListeners();
}

async function loadData() {
    try {
        const response = await fetch('./data/sample_data.json');
        data = await response.json();
    } catch (error) {
        console.error('加载数据失败:', error);
        data = { batches: [], raw_records: [], fingerprint_rules: [], merge_reports: [] };
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchView(view);
        });
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
        });
    });

    document.getElementById('createBatchBtn').addEventListener('click', () => {
        openModal('createBatchModal');
    });

    document.getElementById('submitBatchBtn').addEventListener('click', createBatch);
    document.getElementById('importRecordsBtn').addEventListener('click', () => {
        document.getElementById('recordCount').value = 3;
        openModal('importRecordsModal');
    });
    document.getElementById('submitImportBtn').addEventListener('click', importRecords);
    document.getElementById('processBatchBtn').addEventListener('click', processBatch);
    document.getElementById('resolveConflictsBtn').addEventListener('click', resolveConflicts);
    document.getElementById('rollbackBtn').addEventListener('click', rollbackBatch);
}

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
    });

    switch (view) {
        case 'batches':
            renderBatches();
            break;
        case 'rules':
            renderFingerprintRules();
            break;
    }
}

function renderBatches() {
    const container = document.getElementById('batchesList');
    const batches = data.batches;

    if (batches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📦</div>
                <p>还没有采集批次</p>
                <button class="btn btn-primary" onclick="openModal('createBatchModal')">
                    创建第一个批次
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>批次名称</th>
                    <th>来源</th>
                    <th>记录数</th>
                    <th>冲突</th>
                    <th>重复</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${batches.map(batch => `
                    <tr>
                        <td><strong>${batch.name}</strong></td>
                        <td><span class="tag">${batch.source}</span></td>
                        <td>${batch.total_records}</td>
                        <td>${batch.conflicts > 0 ? `<span class="badge badge-danger">${batch.conflicts}</span>` : '-'}</td>
                        <td>${batch.duplicates > 0 ? `<span class="badge badge-warning">${batch.duplicates}</span>` : '-'}</td>
                        <td><span class="status-badge status-${batch.status}">${getStatusText(batch.status)}</span></td>
                        <td>${batch.created_at}</td>
                        <td>
                            <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" 
                                    onclick="viewBatchDetail('${batch.id}')">
                                查看详情
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'processing': '处理中',
        'merged': '已合并',
        'conflict': '有冲突',
        'duplicate': '重复',
        'error': '错误'
    };
    return statusMap[status] || status;
}

function viewBatchDetail(batchId) {
    currentBatchId = batchId;
    const batch = data.batches.find(b => b.id === batchId);
    const records = data.raw_records.filter(r => r.batch_id === batchId);

    document.getElementById('batchDetailView').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';

    renderBatchDetail(batch, records);
}

function goBack() {
    document.getElementById('batchDetailView').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    currentBatchId = null;
}

function renderBatchDetail(batch, records) {
    document.getElementById('detailBatchName').textContent = batch.name;
    document.getElementById('detailBatchSource').textContent = batch.source;
    document.getElementById('detailBatchStatus').textContent = getStatusText(batch.status);
    document.getElementById('detailBatchStatus').className = `status-badge status-${batch.status}`;

    document.getElementById('statTotal').textContent = batch.total_records;
    document.getElementById('statConflicts').textContent = batch.conflicts;
    document.getElementById('statDuplicates').textContent = batch.duplicates;
    document.getElementById('statMerged').textContent = records.filter(r => r.status === 'merged').length;

    const recordsHtml = records.map(record => `
        <tr>
            <td>${record.product_name}</td>
            <td>${record.price || '-'}</td>
            <td>${record.brand || '-'}</td>
            <td>${record.category || '-'}</td>
            <td><span class="tag">${record.source}</span></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${(record.confidence * 100).toFixed(0)}%
                    <div class="confidence-bar">
                        <div class="confidence-fill ${getConfidenceClass(record.confidence)}" 
                             style="width: ${record.confidence * 100}%"></div>
                    </div>
                </div>
            </td>
            <td><span class="status-badge status-${record.status}">${getStatusText(record.status)}</span></td>
        </tr>
    `).join('');

    document.getElementById('recordsTableBody').innerHTML = recordsHtml;

    if (batch.status === 'pending') {
        document.getElementById('processBatchBtn').style.display = 'inline-flex';
        document.getElementById('importRecordsBtn').style.display = 'inline-flex';
        document.getElementById('resolveConflictsBtn').style.display = 'none';
        document.getElementById('rollbackBtn').style.display = 'none';
        document.getElementById('viewReportBtn').style.display = 'none';
    } else if (batch.status === 'processing' && batch.conflicts > 0) {
        document.getElementById('processBatchBtn').style.display = 'none';
        document.getElementById('importRecordsBtn').style.display = 'none';
        document.getElementById('resolveConflictsBtn').style.display = 'inline-flex';
        document.getElementById('rollbackBtn').style.display = 'inline-flex';
        document.getElementById('viewReportBtn').style.display = 'none';
        renderConflicts();
    } else if (batch.status === 'merged') {
        document.getElementById('processBatchBtn').style.display = 'none';
        document.getElementById('importRecordsBtn').style.display = 'none';
        document.getElementById('resolveConflictsBtn').style.display = 'none';
        document.getElementById('rollbackBtn').style.display = 'inline-flex';
        document.getElementById('viewReportBtn').style.display = 'inline-flex';
        renderMergeReport();
    }

    const errors = records.filter(r => r.status === 'error');
    if (errors.length > 0) {
        renderErrors(errors);
    }
}

function getConfidenceClass(confidence) {
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.7) return 'confidence-medium';
    return 'confidence-low';
}

function renderConflicts() {
    const records = data.raw_records.filter(r => r.batch_id === currentBatchId && r.status === 'conflict');
    
    const fingerprintGroups = {};
    records.forEach(rec => {
        if (!fingerprintGroups[rec.fingerprint]) {
            fingerprintGroups[rec.fingerprint] = [];
        }
        fingerprintGroups[rec.fingerprint].push(rec);
    });

    let html = '';
    for (const [fingerprint, group] of Object.entries(fingerprintGroups)) {
        const conflictFields = findConflictFields(group);
        
        html += `
            <div class="conflict-group" data-fingerprint="${fingerprint}">
                <h4>🔍 冲突组: ${fingerprint}</h4>
                <div class="conflict-records">
                    ${group.map((rec, idx) => `
                        <div class="conflict-record ${idx === 0 ? 'primary' : ''}">
                            <h5>${rec.product_name}</h5>
                            <div class="source">来源: ${rec.source}</div>
                            <div class="confidence">可信度: ${(rec.confidence * 100).toFixed(0)}%</div>
                            <div style="margin-top: 8px; font-size: 13px;">
                                <div>价格: ¥${rec.price}</div>
                                <div>品牌: ${rec.brand || '-'}</div>
                                <div>分类: ${rec.category || '-'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="conflict-fields">
                    ${conflictFields.map(field => `
                        <div class="field-conflict">
                            <label>${getFieldLabel(field.field)} 冲突</label>
                            <div class="field-options">
                                ${field.values.map((value, idx) => `
                                    <label class="field-option">
                                        <input type="radio" name="${fingerprint}_${field.field}" value="${idx}" 
                                               ${idx === 0 ? 'checked' : ''}>
                                        <span class="option-value">${value || '(空)'}</span>
                                        <span class="option-source">${field.sources[idx]}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    document.getElementById('conflictsContainer').innerHTML = html;
    document.getElementById('conflictsSection').style.display = 'block';
}

function findConflictFields(records) {
    const fields = ['product_name', 'price', 'brand', 'category'];
    const conflicts = [];
    
    for (const field of fields) {
        const values = [];
        const sources = [];
        for (const rec of records) {
            const val = rec[field];
            if (!values.includes(val)) {
                values.push(val);
                sources.push(rec.source);
            }
        }
        if (values.length > 1) {
            conflicts.push({ field, values, sources });
        }
    }
    
    return conflicts;
}

function getFieldLabel(field) {
    const labels = {
        'product_name': '商品名称',
        'price': '价格',
        'brand': '品牌',
        'category': '分类'
    };
    return labels[field] || field;
}

function renderErrors(errors) {
    const html = errors.map(err => `
        <div class="error-detail">
            <div class="error-title">❌ 记录错误: ${err.product_name}</div>
            <div class="error-message">
                <p>来源: ${err.source}</p>
                <p>问题: 数据不完整或格式错误</p>
                <ul style="margin-top: 8px; margin-left: 20px;">
                    ${!err.price ? '<li>价格缺失</li>' : ''}
                    ${!err.brand ? '<li>品牌信息缺失</li>' : ''}
                    ${err.confidence < 0.6 ? '<li>数据可信度较低</li>' : ''}
                </ul>
            </div>
        </div>
    `).join('');

    document.getElementById('errorsContainer').innerHTML = html;
    document.getElementById('errorsSection').style.display = 'block';
}

function renderMergeReport() {
    const report = data.merge_reports.find(r => r.batch_id === currentBatchId);
    if (!report) return;

    const summary = report.summary;
    
    let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="value">${summary.total_input}</div>
                <div class="label">原始记录</div>
            </div>
            <div class="stat-card">
                <div class="value">${summary.merged_records}</div>
                <div class="label">合并后记录</div>
            </div>
            <div class="stat-card">
                <div class="value">${summary.duplicates_removed}</div>
                <div class="label">重复移除</div>
            </div>
            <div class="stat-card">
                <div class="value">${summary.conflicts_resolved}</div>
                <div class="label">冲突解决</div>
            </div>
        </div>

        <div class="card">
            <h3>📊 来源可信度权重</h3>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                ${Object.entries(report.confidence_weights).map(([source, weight]) => `
                    <span class="source-tag">
                        ${source}
                        <span class="weight">${(weight * 100).toFixed(0)}%</span>
                    </span>
                `).join('')}
            </div>
        </div>

        <div class="card">
            <h3>📋 合并结果详情</h3>
    `;

    report.merged_data.forEach(item => {
        html += `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h4 style="color: #2d3748;">${item.final_product_name}</h4>
                    <span class="badge badge-success">${item.source_count} 个来源合并</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 16px;">
                    <div>
                        <div style="font-size: 12px; color: #718096;">最终价格</div>
                        <div style="font-size: 18px; font-weight: 600; color: #48bb78;">¥${item.final_price}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #718096;">最终品牌</div>
                        <div style="font-size: 16px; font-weight: 500;">${item.final_brand}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #718096;">最终分类</div>
                        <div style="font-size: 16px; font-weight: 500;">${item.final_category}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #718096;">主来源</div>
                        <div style="font-size: 14px; font-weight: 500;">${item.primary_source}</div>
                    </div>
                </div>
                ${item.field_conflicts.length > 0 ? `
                    <div style="background: #f7fafc; padding: 16px; border-radius: 6px;">
                        <div style="font-weight: 600; margin-bottom: 12px; color: #4a5568;">🔀 字段冲突与解决</div>
                        ${item.field_conflicts.map(cf => `
                            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                                <div style="font-weight: 500; color: #c53030; margin-bottom: 4px;">${getFieldLabel(cf.field)}</div>
                                <div style="font-size: 13px; color: #718096;">
                                    冲突值: ${cf.values.map(v => `<span class="diff-highlight">${v || '(空)'}</span>`).join(' vs ')}
                                </div>
                                <div style="font-size: 13px; color: #48bb78; margin-top: 4px;">
                                    解决: 采用高可信度来源值
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += '</div>';
    document.getElementById('reportContainer').innerHTML = html;
}

function renderFingerprintRules() {
    const rules = data.fingerprint_rules;
    const html = rules.map(rule => `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div>
                    <h3>${rule.name}</h3>
                    <p style="color: #718096; margin-top: 4px;">${rule.description}</p>
                </div>
                <span class="badge ${rule.enabled ? 'badge-success' : 'badge-warning'}">
                    ${rule.enabled ? '已启用' : '已禁用'}
                </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                <div>
                    <div style="font-size: 12px; color: #718096;">匹配字段</div>
                    <div style="margin-top: 4px;">
                        ${rule.fields.map(f => `<span class="tag">${getFieldLabel(f)}</span>`).join('')}
                    </div>
                </div>
                <div>
                    <div style="font-size: 12px; color: #718096;">算法</div>
                    <div style="font-weight: 500; margin-top: 4px;">${rule.algorithm}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: #718096;">阈值</div>
                    <div style="font-weight: 500; margin-top: 4px;">${(rule.threshold * 100).toFixed(0)}%</div>
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('rulesList').innerHTML = html;
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

async function createBatch() {
    const name = document.getElementById('batchName').value;
    const source = document.getElementById('batchSource').value;

    if (!name || !source) {
        alert('请填写完整信息');
        return;
    }

    const newBatch = {
        id: `batch_${String(data.batches.length + 1).padStart(3, '0')}`,
        name,
        source,
        created_at: new Date().toLocaleString('zh-CN'),
        status: 'pending',
        total_records: 0,
        conflicts: 0,
        duplicates: 0
    };

    data.batches.push(newBatch);
    saveData();
    closeModal();
    renderBatches();
}

async function importRecords() {
    const count = parseInt(document.getElementById('recordCount').value);
    
    const sampleProducts = [
        { product_name: 'iPhone 15 Pro Max 256GB', price: 9999, brand: 'Apple', category: '手机', source: 'jd.com', confidence: 0.95 },
        { product_name: 'iPhone15 ProMax 256G 钛金色', price: 9899, brand: '苹果', category: '智能手机', source: 'taobao.com', confidence: 0.88 },
        { product_name: '华为 Mate 60 Pro 12GB+512GB', price: 6999, brand: '华为', category: '手机', source: 'jd.com', confidence: 0.92 },
        { product_name: 'MacBook Pro 14寸 M3 Pro', price: 14999, brand: 'Apple', category: '笔记本', source: 'jd.com', confidence: 0.94 },
        { product_name: 'iPad Pro 12.9 M2 256GB', price: 8999, brand: 'Apple', category: '平板', source: 'jd.com', confidence: 0.91 },
    ];

    for (let i = 0; i < count; i++) {
        const product = sampleProducts[i % sampleProducts.length];
        const newRecord = {
            id: `rec_${String(data.raw_records.length + 1).padStart(3, '0')}`,
            batch_id: currentBatchId,
            ...product,
            fingerprint: generateFingerprint(product.product_name),
            status: 'pending',
            created_at: new Date().toLocaleString('zh-CN')
        };
        data.raw_records.push(newRecord);
    }

    const batch = data.batches.find(b => b.id === currentBatchId);
    batch.total_records += count;
    
    saveData();
    closeModal();
    viewBatchDetail(currentBatchId);
}

function generateFingerprint(text) {
    const normalized = text.toLowerCase().replace(/\s+/g, '');
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(16).substring(0, 8)}`;
}

async function processBatch() {
    const records = data.raw_records.filter(r => r.batch_id === currentBatchId);
    
    const fingerprintGroups = {};
    records.forEach(rec => {
        if (!fingerprintGroups[rec.fingerprint]) {
            fingerprintGroups[rec.fingerprint] = [];
        }
        fingerprintGroups[rec.fingerprint].push(rec);
    });

    let duplicates = 0;
    let conflicts = 0;

    for (const [fp, group] of Object.entries(fingerprintGroups)) {
        if (group.length > 1) {
            duplicates += group.length - 1;
            
            const hasConflict = checkHasConflicts(group);
            if (hasConflict) {
                conflicts++;
                group.forEach(rec => rec.status = 'conflict');
            } else {
                group.sort((a, b) => b.confidence - a.confidence);
                group[0].status = 'merged';
                group.slice(1).forEach(rec => rec.status = 'duplicate');
            }
        } else {
            group[0].status = 'merged';
        }
    }

    const batch = data.batches.find(b => b.id === currentBatchId);
    batch.status = conflicts > 0 ? 'processing' : 'merged';
    batch.duplicates = duplicates;
    batch.conflicts = conflicts;

    if (conflicts === 0) {
        generateReportData(batch, records);
    }

    saveData();
    viewBatchDetail(currentBatchId);
}

function checkHasConflicts(records) {
    const fields = ['price', 'brand', 'category'];
    for (const field of fields) {
        const values = new Set(records.map(r => String(r[field] || '')));
        if (values.size > 1) return true;
    }
    return false;
}

async function resolveConflicts() {
    const conflictGroups = document.querySelectorAll('.conflict-group');
    
    conflictGroups.forEach(group => {
        const fingerprint = group.dataset.fingerprint;
        const records = data.raw_records.filter(r => r.batch_id === currentBatchId && r.fingerprint === fingerprint);
        
        records.sort((a, b) => b.confidence - a.confidence);
        const primary = records[0];
        
        const fieldConflicts = findConflictFields(records);
        fieldConflicts.forEach(cf => {
            const selected = group.querySelector(`input[name="${fingerprint}_${cf.field}"]:checked`);
            if (selected) {
                const idx = parseInt(selected.value);
                primary[cf.field] = records[idx][cf.field];
            }
        });

        primary.status = 'merged';
        records.slice(1).forEach(rec => rec.status = 'duplicate');
    });

    const batch = data.batches.find(b => b.id === currentBatchId);
    batch.status = 'merged';
    batch.conflicts = 0;

    const records = data.raw_records.filter(r => r.batch_id === currentBatchId);
    generateReportData(batch, records);

    saveData();
    viewBatchDetail(currentBatchId);
}

function generateReportData(batch, records) {
    const mergedRecords = records.filter(r => r.status === 'merged');
    
    const sourceWeights = {};
    records.forEach(r => {
        if (!sourceWeights[r.source]) {
            sourceWeights[r.source] = [];
        }
        sourceWeights[r.source].push(r.confidence);
    });

    const confidenceWeights = {};
    Object.entries(sourceWeights).forEach(([source, weights]) => {
        confidenceWeights[source] = weights.reduce((a, b) => a + b, 0) / weights.length;
    });

    const mergedData = mergedRecords.map(rec => {
        const group = records.filter(r => r.fingerprint === rec.fingerprint);
        return {
            fingerprint: rec.fingerprint,
            final_product_name: rec.product_name,
            final_price: rec.price,
            final_brand: rec.brand,
            final_category: rec.category,
            source_count: group.length,
            primary_source: rec.source,
            confidence: rec.confidence,
            field_conflicts: findConflictFields(group)
        };
    });

    const report = {
        id: `report_${String(data.merge_reports.length + 1).padStart(3, '0')}`,
        batch_id: batch.id,
        created_at: new Date().toLocaleString('zh-CN'),
        summary: {
            total_input: records.length,
            merged_records: mergedRecords.length,
            duplicates_removed: records.filter(r => r.status === 'duplicate').length,
            conflicts_resolved: mergedData.filter(m => m.field_conflicts.length > 0).length,
            errors_found: records.filter(r => r.status === 'error').length
        },
        confidence_weights: confidenceWeights,
        merged_data: mergedData
    };

    data.merge_reports.push(report);
}

async function rollbackBatch() {
    if (!confirm('确定要回滚到待处理状态吗？')) return;

    const records = data.raw_records.filter(r => r.batch_id === currentBatchId);
    records.forEach(rec => rec.status = 'pending');

    const batch = data.batches.find(b => b.id === currentBatchId);
    batch.status = 'pending';
    batch.conflicts = 0;
    batch.duplicates = 0;

    const reportIndex = data.merge_reports.findIndex(r => r.batch_id === currentBatchId);
    if (reportIndex > -1) {
        data.merge_reports.splice(reportIndex, 1);
    }

    saveData();
    viewBatchDetail(currentBatchId);
}

function saveData() {
    const jsonStr = JSON.stringify(data, null, 2);
    localStorage.setItem('mergeSystemData', jsonStr);
    console.log('数据已保存到本地存储');
}

function viewReport() {
    document.getElementById('reportSection').style.display = 'block';
    document.getElementById('reportSection').scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', init);
