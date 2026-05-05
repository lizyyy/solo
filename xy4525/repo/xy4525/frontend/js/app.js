const API_BASE = window.location.origin;

let currentBatches = [];
let selectedBatchId = null;
let uploadedImagePath = null;
let uploadedCsvPath = null;

document.addEventListener('DOMContentLoaded', () => {
    loadBatches();
    setupEventListeners();
    setDefaultDate();
});

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const inspectionDateInput = document.getElementById('inspectionDate');
    if (inspectionDateInput) {
        inspectionDateInput.value = today;
    }
}

function setupEventListeners() {
    document.getElementById('importSamplesBtn').addEventListener('click', importSamples);
    document.getElementById('newBatchBtn').addEventListener('click', showNewBatchForm);
    document.getElementById('closeNewBatchBtn').addEventListener('click', hideNewBatchForm);
    document.getElementById('cancelNewBatchBtn').addEventListener('click', hideNewBatchForm);
    document.getElementById('newBatchForm').addEventListener('submit', handleNewBatchSubmit);
    
    document.getElementById('closeDetailBtn').addEventListener('click', hideBatchDetail);
    document.getElementById('exportMarkdownBtn').addEventListener('click', exportMarkdown);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
    
    document.getElementById('riskFilter').addEventListener('change', filterBatches);
    document.getElementById('statusFilter').addEventListener('change', filterBatches);
    
    document.getElementById('trayImage').addEventListener('change', handleImageSelect);
    document.getElementById('moistureCsv').addEventListener('change', handleCsvSelect);
    document.getElementById('removeImageBtn').addEventListener('click', removeImage);
    document.getElementById('removeCsvBtn').addEventListener('click', removeCsv);
}

async function loadBatches() {
    try {
        const response = await fetch(`${API_BASE}/api/batch`);
        currentBatches = await response.json();
        renderBatchList();
    } catch (error) {
        console.error('Error loading batches:', error);
        showNotification('加载批次失败', 'error');
    }
}

function renderBatchList() {
    const batchListEl = document.getElementById('batchList');
    const filteredBatches = filterBatchesByConditions(currentBatches);
    
    if (filteredBatches.length === 0) {
        batchListEl.innerHTML = `
            <div class="empty-state">
                <p>${currentBatches.length === 0 ? '暂无批次数据，请点击"导入示例数据"开始使用' : '没有符合筛选条件的批次'}</p>
            </div>
        `;
        return;
    }
    
    batchListEl.innerHTML = filteredBatches.map(batch => `
        <div class="batch-card ${selectedBatchId === batch.id ? 'selected' : ''}" 
             data-id="${batch.id}" 
             onclick="selectBatch('${batch.id}')">
            <div class="batch-card-header">
                <span class="batch-number">${batch.batchNumber}</span>
                <span class="risk-badge risk-${batch.riskLevel}">
                    ${getRiskLabel(batch.riskLevel)}
                </span>
            </div>
            <div class="batch-card-info">
                <span>📦 ${batch.warehouse}</span>
                <span>🌾 ${batch.grainType}</span>
                <span>📅 ${batch.inspectionDate}</span>
                <span>${getStatusLabel(batch.status)}</span>
            </div>
        </div>
    `).join('');
}

function filterBatchesByConditions(batches) {
    const riskFilter = document.getElementById('riskFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    return batches.filter(batch => {
        const riskMatch = riskFilter === 'all' || batch.riskLevel === riskFilter;
        const statusMatch = statusFilter === 'all' || batch.status === statusFilter;
        return riskMatch && statusMatch;
    });
}

function filterBatches() {
    renderBatchList();
}

function getRiskLabel(level) {
    const labels = {
        high: '🔴 高风险',
        medium: '🟡 中风险',
        low: '🟢 低风险'
    };
    return labels[level] || level;
}

function getStatusLabel(status) {
    const labels = {
        pending: '⏳ 待复核',
        reviewed: '✍️ 已复核',
        pass: '✅ 合格',
        fail: '❌ 不合格'
    };
    return labels[status] || status;
}

async function selectBatch(batchId) {
    selectedBatchId = batchId;
    renderBatchList();
    
    try {
        const response = await fetch(`${API_BASE}/api/batch/${batchId}`);
        const batch = await response.json();
        showBatchDetail(batch);
    } catch (error) {
        console.error('Error loading batch detail:', error);
        showNotification('加载批次详情失败', 'error');
    }
}

function showBatchDetail(batch) {
    document.getElementById('batchDetailSection').style.display = 'flex';
    document.getElementById('newBatchSection').style.display = 'none';
    
    document.getElementById('detailBatchTitle').textContent = `批次详情 - ${batch.batchNumber}`;
    
    const detailContent = document.getElementById('batchDetail');
    
    let html = `
        <div class="detail-section">
            <h3>📋 基本信息</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">批次号</span>
                    <span class="info-value">${batch.batchNumber}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">粮仓</span>
                    <span class="info-value">${batch.warehouse}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">粮食品种</span>
                    <span class="info-value">${batch.grainType}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">检验日期</span>
                    <span class="info-value">${batch.inspectionDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">风险等级</span>
                    <span class="info-value">${getRiskLabel(batch.riskLevel)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">检验状态</span>
                    <span class="info-value">${getStatusLabel(batch.status)}</span>
                </div>
            </div>
        </div>
    `;
    
    if (batch.analysis) {
        html += `<div class="detail-section"><h3>🔍 AI初筛结果</h3>`;
        
        if (batch.analysis.image) {
            html += `
                <div class="analysis-card">
                    <h4>📷 图像分析</h4>
                    ${renderConfidenceItem('虫蛀', batch.analysis.image.insectDamage)}
                    ${renderConfidenceItem('霉变', batch.analysis.image.mold)}
                    ${renderConfidenceItem('杂质', batch.analysis.image.impurities)}
                </div>
            `;
        }
        
        if (batch.analysis.moisture) {
            html += `
                <div class="analysis-card">
                    <div class="analysis-header">
                        <h4>💧 水分含量分析</h4>
                        <div class="confidence-badge">
                            <div class="confidence-bar">
                                <div class="confidence-fill ${getConfidenceClass(batch.analysis.moisture.confidence)}" 
                                     style="width: ${batch.analysis.moisture.confidence * 100}%"></div>
                            </div>
                            <span>${(batch.analysis.moisture.confidence * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">平均水分</span>
                            <span class="info-value">${batch.analysis.moisture.average?.toFixed(1) || '-'}%</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">最高水分</span>
                            <span class="info-value">${batch.analysis.moisture.max?.toFixed(1) || '-'}%</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">最低水分</span>
                            <span class="info-value">${batch.analysis.moisture.min?.toFixed(1) || '-'}%</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">检测点数</span>
                            <span class="info-value">${batch.analysis.moisture.samples || '-'} 个</span>
                        </div>
                    </div>
                    <div class="analysis-evidence">${batch.analysis.moisture.evidence}</div>
                </div>
            `;
        }
        
        if (batch.analysis.temperature) {
            html += `
                <div class="analysis-card">
                    <div class="analysis-header">
                        <h4>🌡️ 仓温分析</h4>
                        <div class="confidence-badge">
                            <div class="confidence-bar">
                                <div class="confidence-fill ${getConfidenceClass(batch.analysis.temperature.confidence)}" 
                                     style="width: ${batch.analysis.temperature.confidence * 100}%"></div>
                            </div>
                            <span>${(batch.analysis.temperature.confidence * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">平均仓温</span>
                            <span class="info-value">${batch.analysis.temperature.average?.toFixed(1) || '-'}℃</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">最高仓温</span>
                            <span class="info-value">${batch.analysis.temperature.max?.toFixed(1) || '-'}℃</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">最低仓温</span>
                            <span class="info-value">${batch.analysis.temperature.min?.toFixed(1) || '-'}℃</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">检测区域</span>
                            <span class="info-value">${batch.analysis.temperature.zones || '-'} 个</span>
                        </div>
                    </div>
                    <div class="analysis-evidence">${batch.analysis.temperature.evidence}</div>
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    html += `
        <div class="detail-section">
            <h3>✍️ 人工复核</h3>
            <div class="review-section">
                <form class="review-form" onsubmit="handleReviewSubmit(event, '${batch.id}')">
                    <div class="form-group">
                        <label for="reviewerName">复核人员</label>
                        <input type="text" id="reviewerName" name="reviewerName" 
                               value="${batch.review?.reviewer || ''}" placeholder="请输入复核人员姓名">
                    </div>
                    <div class="form-group">
                        <label for="reviewDecision">复核结论</label>
                        <select id="reviewDecision" name="reviewDecision" required>
                            <option value="">请选择结论</option>
                            <option value="pass" ${batch.review?.decision === 'pass' ? 'selected' : ''}>✅ 合格</option>
                            <option value="fail" ${batch.review?.decision === 'fail' ? 'selected' : ''}>❌ 不合格</option>
                            <option value="reviewed" ${batch.review?.decision === 'reviewed' ? 'selected' : ''}>✍️ 已复核（无结论）</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reviewComments">复核意见</label>
                        <textarea id="reviewComments" name="reviewComments" 
                                  placeholder="请输入复核意见或说明...">${batch.review?.comments || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">保存复核结果</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    detailContent.innerHTML = html;
}

function renderConfidenceItem(label, data) {
    if (!data) return '';
    return `
        <div style="margin-bottom: 0.75rem;">
            <div class="analysis-header" style="margin-bottom: 0.25rem;">
                <span style="font-size: 0.875rem;">${label}</span>
                <div class="confidence-badge">
                    <div class="confidence-bar">
                        <div class="confidence-fill ${getConfidenceClass(data.confidence)}" 
                             style="width: ${data.confidence * 100}%"></div>
                    </div>
                    <span>${(data.confidence * 100).toFixed(1)}%</span>
                </div>
            </div>
            <div class="analysis-evidence" style="margin-top: 0.25rem;">${data.evidence}</div>
        </div>
    `;
}

function getConfidenceClass(confidence) {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
}

function hideBatchDetail() {
    document.getElementById('batchDetailSection').style.display = 'none';
    selectedBatchId = null;
    renderBatchList();
}

async function handleReviewSubmit(event, batchId) {
    event.preventDefault();
    
    const reviewer = document.getElementById('reviewerName').value || '未指定';
    const decision = document.getElementById('reviewDecision').value;
    const comments = document.getElementById('reviewComments').value;
    
    if (!decision) {
        showNotification('请选择复核结论', 'error');
        return;
    }
    
    try {
        showLoading('保存复核结果中...');
        
        const response = await fetch(`${API_BASE}/api/analysis/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batchId,
                reviewer,
                decision,
                comments
            })
        });
        
        if (response.ok) {
            showNotification('复核结果已保存', 'success');
            await loadBatches();
            if (selectedBatchId === batchId) {
                selectBatch(batchId);
            }
        } else {
            throw new Error('保存失败');
        }
    } catch (error) {
        console.error('Error saving review:', error);
        showNotification('保存复核结果失败', 'error');
    } finally {
        hideLoading();
    }
}

function showNewBatchForm() {
    document.getElementById('newBatchSection').style.display = 'flex';
    document.getElementById('batchDetailSection').style.display = 'none';
    resetNewBatchForm();
}

function hideNewBatchForm() {
    document.getElementById('newBatchSection').style.display = 'none';
    resetNewBatchForm();
}

function resetNewBatchForm() {
    document.getElementById('newBatchForm').reset();
    uploadedImagePath = null;
    uploadedCsvPath = null;
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('csvPreview').style.display = 'none';
    document.getElementById('imageUploadArea').querySelector('.upload-placeholder').style.display = 'flex';
    document.getElementById('csvUploadArea').querySelector('.upload-placeholder').style.display = 'flex';
    setDefaultDate();
}

async function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showLoading('上传图片中...');
        
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            uploadedImagePath = result.filePath;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('previewImg').src = e.target.result;
                document.getElementById('imagePreview').style.display = 'flex';
                document.getElementById('imageUploadArea').querySelector('.upload-placeholder').style.display = 'none';
            };
            reader.readAsDataURL(file);
            
            showNotification('图片上传成功', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        showNotification('图片上传失败', 'error');
    } finally {
        hideLoading();
    }
}

async function handleCsvSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showLoading('上传CSV中...');
        
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            uploadedCsvPath = result.filePath;
            document.getElementById('csvFileName').textContent = result.originalName;
            document.getElementById('csvPreview').style.display = 'flex';
            document.getElementById('csvUploadArea').querySelector('.upload-placeholder').style.display = 'none';
            showNotification('CSV上传成功', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error uploading CSV:', error);
        showNotification('CSV上传失败', 'error');
    } finally {
        hideLoading();
    }
}

function removeImage() {
    uploadedImagePath = null;
    document.getElementById('trayImage').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUploadArea').querySelector('.upload-placeholder').style.display = 'flex';
}

function removeCsv() {
    uploadedCsvPath = null;
    document.getElementById('moistureCsv').value = '';
    document.getElementById('csvPreview').style.display = 'none';
    document.getElementById('csvUploadArea').querySelector('.upload-placeholder').style.display = 'flex';
}

async function handleNewBatchSubmit(event) {
    event.preventDefault();
    
    const formData = {
        batchNumber: document.getElementById('batchNumber').value,
        warehouse: document.getElementById('warehouse').value,
        grainType: document.getElementById('grainType').value,
        inspectionDate: document.getElementById('inspectionDate').value,
        trayImage: uploadedImagePath,
        moistureCsv: uploadedCsvPath,
        status: 'pending',
        riskLevel: 'low'
    };
    
    const avgTemp = document.getElementById('avgTemperature').value;
    const maxTemp = document.getElementById('maxTemperature').value;
    const minTemp = document.getElementById('minTemperature').value;
    
    if (avgTemp || maxTemp || minTemp) {
        formData.temperatureData = {
            average: avgTemp ? parseFloat(avgTemp) : null,
            max: maxTemp ? parseFloat(maxTemp) : null,
            min: minTemp ? parseFloat(minTemp) : null
        };
    }
    
    try {
        showLoading('创建批次并分析中...');
        
        const createResponse = await fetch(`${API_BASE}/api/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const newBatch = await createResponse.json();
        
        if (newBatch.id) {
            if (uploadedImagePath) {
                await fetch(`${API_BASE}/api/analysis/image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imagePath: uploadedImagePath,
                        batchId: newBatch.id
                    })
                });
            }
            
            if (uploadedCsvPath) {
                await fetch(`${API_BASE}/api/analysis/moisture`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        csvPath: uploadedCsvPath,
                        batchId: newBatch.id
                    })
                });
            }
            
            if (formData.temperatureData) {
                await fetch(`${API_BASE}/api/analysis/temperature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tempData: formData.temperatureData,
                        batchId: newBatch.id
                    })
                });
            }
            
            showNotification('批次创建成功', 'success');
            hideNewBatchForm();
            await loadBatches();
        } else {
            throw new Error('创建失败');
        }
    } catch (error) {
        console.error('Error creating batch:', error);
        showNotification('创建批次失败', 'error');
    } finally {
        hideLoading();
    }
}

async function importSamples() {
    try {
        showLoading('导入示例数据中...');
        
        const response = await fetch(`${API_BASE}/api/batch/import-samples`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (result.imported > 0) {
                showNotification(`成功导入 ${result.imported} 条示例数据`, 'success');
            } else {
                showNotification('示例数据已存在', 'info');
            }
            await loadBatches();
        } else {
            throw new Error('导入失败');
        }
    } catch (error) {
        console.error('Error importing samples:', error);
        showNotification('导入示例数据失败', 'error');
    } finally {
        hideLoading();
    }
}

function exportMarkdown() {
    if (!selectedBatchId) {
        showNotification('请先选择一个批次', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = `${API_BASE}/api/export/markdown/${selectedBatchId}`;
    link.click();
    showNotification('正在导出Markdown质检单', 'info');
}

function exportJson() {
    if (!selectedBatchId) {
        showNotification('请先选择一个批次', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = `${API_BASE}/api/export/json/${selectedBatchId}`;
    link.click();
    showNotification('正在导出JSON明细', 'info');
}

function showLoading(text = '处理中...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}
