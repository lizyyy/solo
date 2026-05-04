const riskTypeMap = {
    'continuous_overtemperature': '连续超温',
    'transfer_breakpoint': '交接断点',
    'duplicate_sample_id': '重复样本ID',
    'duplicate_in_batch': '批次内重复'
};

const riskLevelMap = {
    'critical': { label: '严重', class: 'critical' },
    'high': { label: '高风险', class: 'high' },
    'medium': { label: '中风险', class: 'medium' },
    'low': { label: '低风险', class: 'low' }
};

const statusMap = {
    'pending': '待处理',
    'reviewing': '复核中',
    'resolved': '已解决',
    'closed': '已关闭'
};

let selectedFiles = {
    temperature: null,
    transfer: null,
    alarm: null,
    review: null
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFileUploads();
    initImportButtons();
    loadSampleFiles();
    loadBatches();
    loadHistory();
    initAnalysis();
    initExport();
    initRiskFilters();
});

function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`${tabName}-section`).classList.add('active');
        });
    });
}

function initFileUploads() {
    const uploadAreas = document.querySelectorAll('.file-upload');
    
    uploadAreas.forEach(area => {
        const type = area.dataset.type;
        const input = area.querySelector('input[type="file"]');
        const fileNameSpan = area.querySelector('.file-name');
        
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                selectedFiles[type] = e.target.files[0];
                fileNameSpan.textContent = e.target.files[0].name;
            } else {
                selectedFiles[type] = null;
                fileNameSpan.textContent = '未选择文件';
            }
        });
    });
}

function initImportButtons() {
    const buttons = document.querySelectorAll('.import-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.dataset.type;
            const file = selectedFiles[type];
            const batchNumber = document.getElementById('import-batch')?.value || '';
            
            if (!file) {
                showToast('请先选择文件', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            if (batchNumber) {
                formData.append('batch_number', batchNumber);
            }
            
            try {
                btn.disabled = true;
                btn.textContent = '导入中...';
                
                const response = await fetch(`/api/upload/${type}`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showToast(`成功导入 ${result.count} 条记录`, 'success');
                    const uploadArea = btn.closest('.import-card').querySelector('.file-upload');
                    const fileNameSpan = uploadArea.querySelector('.file-name');
                    const input = uploadArea.querySelector('input[type="file"]');
                    
                    selectedFiles[type] = null;
                    fileNameSpan.textContent = '未选择文件';
                    input.value = '';
                    
                    loadBatches();
                    loadHistory();
                } else {
                    const errorMsg = result.errors?.length > 0 ? result.errors.join('; ') : '导入失败';
                    showToast(errorMsg, 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '导入';
            }
        });
    });
}

async function loadSampleFiles() {
    try {
        const response = await fetch('/api/preview/import/samples');
        const data = await response.json();
        
        const container = document.getElementById('sample-files');
        
        if (data.success && data.samples.length > 0) {
            container.innerHTML = data.samples.map(sample => 
                `<a href="${sample.url}" download="${sample.name}">
                    ${sample.type === 'csv' ? '📄' : '📋'} ${sample.name}
                </a>`
            ).join('');
        } else {
            container.innerHTML = '<p>暂无示例数据</p>';
        }
    } catch (error) {
        console.error('加载示例文件失败:', error);
    }
}

async function loadBatches() {
    try {
        const response = await fetch('/api/batches');
        const data = await response.json();
        
        const selects = ['analysis-batch', 'report-batch'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">所有批次</option>';
                
                if (data.success && data.batches.length > 0) {
                    data.batches.forEach(batch => {
                        const option = document.createElement('option');
                        option.value = batch;
                        option.textContent = batch;
                        if (batch === currentValue) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            }
        });
    } catch (error) {
        console.error('加载批次列表失败:', error);
    }
}

async function loadHistory() {
    try {
        const response = await fetch('/api/import/history');
        const data = await response.json();
        
        const container = document.getElementById('history-list');
        
        if (data.success && data.history.length > 0) {
            const typeIcons = {
                'temperature': '📊',
                'transfer': '📦',
                'alarm': '🚨',
                'review': '📝'
            };
            
            const typeNames = {
                'temperature': '温控记录',
                'transfer': '样本交接',
                'alarm': '告警记录',
                'review': '复核备注'
            };
            
            container.innerHTML = data.history.map(item => `
                <div class="history-item">
                    <div class="history-main">
                        <span class="history-icon">${typeIcons[item.file_type] || '📄'}</span>
                        <div class="history-info">
                            <h4>${item.file_name}</h4>
                            <p>${typeNames[item.file_type] || item.file_type}</p>
                        </div>
                    </div>
                    <div class="history-meta">
                        <span class="history-count">${item.record_count} 条</span>
                        <span>${new Date(item.import_time).toLocaleString('zh-CN')}</span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">暂无导入记录</p>';
        }
    } catch (error) {
        console.error('加载导入历史失败:', error);
    }
}

function initAnalysis() {
    const runBtn = document.getElementById('run-analysis-btn');
    
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            const batchNumber = document.getElementById('analysis-batch')?.value || '';
            
            try {
                runBtn.disabled = true;
                runBtn.textContent = '分析中...';
                
                const response = await fetch('/api/analysis/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ batch_number: batchNumber || null })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showToast(`分析完成，共检测到 ${result.risk_counts.total} 个风险`, 'success');
                    loadRisks();
                } else {
                    showToast('分析失败', 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
            } finally {
                runBtn.disabled = false;
                runBtn.textContent = '运行分析';
            }
        });
    }
    
    loadRisks();
}

async function loadRisks() {
    try {
        const batchNumber = document.getElementById('analysis-batch')?.value || '';
        const url = batchNumber ? `/api/risks?batch_number=${encodeURIComponent(batchNumber)}` : '/api/risks';
        
        const response = await fetch(url);
        const data = await response.json();
        
        const container = document.getElementById('risk-list');
        const statTotal = document.getElementById('stat-total');
        const statCritical = document.getElementById('stat-critical');
        const statHigh = document.getElementById('stat-high');
        const statMedium = document.getElementById('stat-medium');
        
        if (data.success) {
            const risks = data.risks;
            
            statTotal.textContent = risks.length;
            statCritical.textContent = risks.filter(r => r.risk_level === 'critical').length;
            statHigh.textContent = risks.filter(r => r.risk_level === 'high').length;
            statMedium.textContent = risks.filter(r => r.risk_level === 'medium').length;
            
            const filteredRisks = filterRisks(risks);
            
            if (filteredRisks.length > 0) {
                container.innerHTML = filteredRisks.map(risk => {
                    const levelInfo = riskLevelMap[risk.risk_level] || { label: risk.risk_level, class: '' };
                    
                    return `
                        <div class="risk-item" data-risk-id="${risk.id}">
                            <div class="risk-header">
                                <div class="risk-title">${riskTypeMap[risk.risk_type] || risk.risk_type}</div>
                                <div class="risk-badges">
                                    <span class="risk-level-badge ${levelInfo.class}">${levelInfo.label}</span>
                                    <span class="risk-status-badge ${risk.status}">${statusMap[risk.status] || risk.status}</span>
                                </div>
                            </div>
                            <div class="risk-meta">
                                <span>批次: ${risk.batch_number}</span>
                                ${risk.location ? `<span>位置: ${risk.location}</span>` : ''}
                                ${risk.start_time ? `<span>时间: ${new Date(risk.start_time).toLocaleString('zh-CN')}</span>` : ''}
                            </div>
                            <div class="risk-desc">${risk.description}</div>
                        </div>
                    `;
                }).join('');
                
                container.querySelectorAll('.risk-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const riskId = item.dataset.riskId;
                        window.location.href = `/detail/${riskId}`;
                    });
                });
            } else {
                container.innerHTML = '<p class="empty-state">暂无风险记录，请先运行分析</p>';
            }
        }
    } catch (error) {
        console.error('加载风险列表失败:', error);
    }
}

function filterRisks(risks) {
    const typeFilter = document.getElementById('risk-filter-type')?.value || '';
    const levelFilter = document.getElementById('risk-filter-level')?.value || '';
    const statusFilter = document.getElementById('risk-filter-status')?.value || '';
    
    return risks.filter(risk => {
        if (typeFilter && risk.risk_type !== typeFilter) return false;
        if (levelFilter && risk.risk_level !== levelFilter) return false;
        if (statusFilter && risk.status !== statusFilter) return false;
        return true;
    });
}

function initRiskFilters() {
    const filters = ['risk-filter-type', 'risk-filter-level', 'risk-filter-status'];
    
    filters.forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter) {
            filter.addEventListener('change', loadRisks);
        }
    });
}

function initExport() {
    const previewBtn = document.getElementById('preview-markdown-btn');
    const exportMdBtn = document.getElementById('export-markdown-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const closePreviewBtn = document.getElementById('close-preview-btn');
    const previewContainer = document.getElementById('markdown-preview');
    
    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            const batchNumber = document.getElementById('report-batch')?.value || '';
            const url = batchNumber ? `/api/export/preview/markdown?batch_number=${encodeURIComponent(batchNumber)}` : '/api/export/preview/markdown';
            
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('preview-content').textContent = data.content;
                    previewContainer.classList.remove('hidden');
                } else {
                    showToast('生成预览失败', 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
            }
        });
    }
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewContainer.classList.add('hidden');
        });
    }
    
    if (exportMdBtn) {
        exportMdBtn.addEventListener('click', () => {
            const batchNumber = document.getElementById('report-batch')?.value || '';
            const url = batchNumber ? `/api/export/markdown?batch_number=${encodeURIComponent(batchNumber)}` : '/api/export/markdown';
            window.location.href = url;
        });
    }
    
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            const batchNumber = document.getElementById('report-batch')?.value || '';
            const url = batchNumber ? `/api/export/csv?batch_number=${encodeURIComponent(batchNumber)}` : '/api/export/csv';
            window.location.href = url;
        });
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
