// API基础URL
const API_BASE = '/api';

// 当前状态
let currentBatchId = null;
let currentArtifacts = [];
let editingIndex = null;
let currentDetailBatchId = null;

// DOM元素
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const cancelUpload = document.getElementById('cancel-upload');
const previewTableBody = document.getElementById('preview-tbody');
const validationSummary = document.getElementById('validation-summary');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const saveEdit = document.getElementById('save-edit');
const toast = document.getElementById('toast');

// 页面切换
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // 移除所有活动状态
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    // 添加当前活动状态
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // 如果是批次列表页面，加载数据
    if (tabId === 'batches') {
      loadBatches();
    }
  });
});

// 文件上传相关
uploadArea.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

// 拖拽上传
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
  
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.name.endsWith('.csv') || file.name.endsWith('.json')) {
      handleFileSelect(file);
    } else {
      showToast('请上传CSV或JSON格式的文件', 'error');
    }
  }
});

function handleFileSelect(file) {
  fileName.textContent = file.name;
  fileInfo.style.display = 'flex';
  uploadFile(file);
}

cancelUpload.addEventListener('click', () => {
  fileInput.value = '';
  fileInfo.style.display = 'none';
});

// 上传文件到服务器
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    showToast('正在上传文件...', 'info');
    
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('文件上传成功', 'success');
      
      // 保存数据并切换到预览页面
      currentBatchId = result.batchId;
      currentArtifacts = result.data;
      
      // 切换到预览页面
      showTab('preview');
      
      // 渲染预览数据
      renderPreviewTable(result.data, result.validation);
      renderValidationSummary(result.validation);
      
      // 设置默认批次名称
      document.getElementById('batch-name').value = `临展入库_${new Date().toISOString().slice(0, 10)}`;
    } else {
      showToast(result.message || '上传失败', 'error');
    }
  } catch (error) {
    console.error('上传错误:', error);
    showToast('上传失败: ' + error.message, 'error');
  }
}

// 渲染预览表格
function renderPreviewTable(artifacts, validation) {
  previewTableBody.innerHTML = '';
  
  artifacts.forEach((artifact, index) => {
    const row = document.createElement('tr');
    
    // 检查是否有错误或警告
    const hasErrors = artifact.validationErrors && 
                      artifact.validationErrors.some(e => e.type === 'error');
    const hasWarnings = artifact.validationErrors && 
                        artifact.validationErrors.some(e => e.type === 'warning');
    const isReturned = artifact.status === 'returned';
    
    if (isReturned) {
      row.classList.add('returned-row');
    } else if (hasErrors) {
      row.classList.add('error-row');
    } else if (hasWarnings) {
      row.classList.add('warning-row');
    }
    
    // 验证状态
    let validationHtml = '<div class="validation-status">';
    if (artifact.validationErrors && artifact.validationErrors.length > 0) {
      artifact.validationErrors.forEach(error => {
        const icon = error.type === 'error' ? '❌' : '⚠️';
        const className = error.type === 'error' ? 'error-message' : 'warning-message';
        validationHtml += `<span class="${className}">${icon} ${error.message}</span>`;
      });
    } else {
      validationHtml += '<span style="color: #28a745;">✅ 正常</span>';
    }
    validationHtml += '</div>';
    
    // 状态标签
    let statusHtml = '';
    if (artifact.status === 'returned') {
      statusHtml = '<span class="status-badge status-returned">已退回</span>';
    } else {
      statusHtml = '<span class="status-badge status-pending">待确认</span>';
    }
    
    row.innerHTML = `
      <td>${artifact.originalRow || index + 1}</td>
      <td>${artifact.boxNumber || '-'}</td>
      <td>${artifact.artifactNumber || '-'}</td>
      <td>¥${formatCurrency(artifact.insuranceValue)}</td>
      <td>${artifact.location || '-'}</td>
      <td>${artifact.hasCertificate ? '是' : '否'}</td>
      <td>${statusHtml}</td>
      <td>${validationHtml}</td>
      <td>
        <button class="btn btn-small btn-info" onclick="editArtifact(${index})">编辑</button>
        ${!isReturned ? `<button class="btn btn-small btn-warning" onclick="returnArtifact(${index})">退回</button>` : ''}
      </td>
    `;
    
    previewTableBody.appendChild(row);
  });
}

// 渲染验证摘要
function renderValidationSummary(validation) {
  validationSummary.innerHTML = '';
  
  if (validation.total === 0) {
    return;
  }
  
  // 有效数量
  const validItem = document.createElement('div');
  validItem.className = 'validation-item success';
  validItem.textContent = `✅ 有效: ${validation.valid}/${validation.total}`;
  validationSummary.appendChild(validItem);
  
  // 错误数量
  if (validation.hasErrors) {
    const errorItem = document.createElement('div');
    errorItem.className = 'validation-item error';
    errorItem.textContent = `❌ 错误: ${validation.summary.duplicates.length} 个重复`;
    validationSummary.appendChild(errorItem);
  }
  
  // 警告数量
  if (validation.hasWarnings) {
    const warningItem = document.createElement('div');
    warningItem.className = 'validation-item warning';
    let warningText = '⚠️ 警告: ';
    const warnings = [];
    if (validation.summary.missingCertificates > 0) {
      warnings.push(`${validation.summary.missingCertificates} 缺证`);
    }
    if (validation.summary.locationConflicts > 0) {
      warnings.push(`${validation.summary.locationConflicts} 库位冲突`);
    }
    if (validation.summary.valueAnomalies > 0) {
      warnings.push(`${validation.summary.valueAnomalies} 金额异常`);
    }
    warningText += warnings.join(', ');
    warningItem.textContent = warningText;
    validationSummary.appendChild(warningItem);
  }
}

// 编辑藏品
function editArtifact(index) {
  editingIndex = index;
  const artifact = currentArtifacts[index];
  
  // 填充表单
  document.getElementById('edit-box-number').value = artifact.boxNumber || '';
  document.getElementById('edit-artifact-number').value = artifact.artifactNumber || '';
  document.getElementById('edit-insurance-value').value = artifact.insuranceValue || 0;
  document.getElementById('edit-location').value = artifact.location || '';
  document.getElementById('edit-has-certificate').value = artifact.hasCertificate ? 'true' : 'false';
  document.getElementById('edit-notes').value = artifact.notes || '';
  
  // 显示弹窗
  editModal.classList.add('active');
}

// 退回藏品
async function returnArtifact(index) {
  if (!confirm('确定要将此藏品标记为退回吗？')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/preview/${currentBatchId}/artifact/${index}/return`, {
      method: 'PUT'
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 更新本地数据
      currentArtifacts[index] = result.data;
      
      // 重新渲染表格
      // 重新获取预览数据以获取最新验证结果
      await refreshPreview();
      
      showToast('藏品已标记为退回', 'success');
    } else {
      showToast(result.message || '操作失败', 'error');
    }
  } catch (error) {
    console.error('退回错误:', error);
    showToast('操作失败: ' + error.message, 'error');
  }
}

// 保存编辑
saveEdit.addEventListener('click', async () => {
  const formData = new FormData(editForm);
  const updatedArtifact = {
    boxNumber: formData.get('boxNumber'),
    artifactNumber: formData.get('artifactNumber'),
    insuranceValue: parseFloat(formData.get('insuranceValue')) || 0,
    location: formData.get('location'),
    hasCertificate: formData.get('hasCertificate') === 'true',
    notes: formData.get('notes')
  };
  
  try {
    const response = await fetch(`${API_BASE}/preview/${currentBatchId}/artifact/${editingIndex}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedArtifact)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 更新本地数据
      currentArtifacts[editingIndex] = result.data;
      
      // 重新渲染表格
      renderPreviewTable(currentArtifacts, result.validation);
      renderValidationSummary(result.validation);
      
      // 关闭弹窗
      editModal.classList.remove('active');
      showToast('保存成功', 'success');
    } else {
      showToast(result.message || '保存失败', 'error');
    }
  } catch (error) {
    console.error('保存错误:', error);
    showToast('保存失败: ' + error.message, 'error');
  }
});

// 关闭弹窗
document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    editModal.classList.remove('active');
  });
});

// 点击弹窗外部关闭
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    editModal.classList.remove('active');
  }
});

// 刷新预览数据
async function refreshPreview() {
  try {
    const response = await fetch(`${API_BASE}/preview/${currentBatchId}`);
    const result = await response.json();
    
    if (result.success) {
      currentArtifacts = result.data;
      renderPreviewTable(result.data, result.validation);
      renderValidationSummary(result.validation);
    }
  } catch (error) {
    console.error('刷新预览错误:', error);
  }
}

// 返回上传页面
document.getElementById('back-to-upload').addEventListener('click', () => {
  if (confirm('确定要返回上传页面吗？当前预览数据将丢失。')) {
    showTab('upload');
    currentBatchId = null;
    currentArtifacts = [];
    fileInput.value = '';
    fileInfo.style.display = 'none';
  }
});

// 确认入库
document.getElementById('confirm-batch').addEventListener('click', async () => {
  const batchName = document.getElementById('batch-name').value.trim();
  const batchNotes = document.getElementById('batch-notes').value.trim();
  
  if (!batchName) {
    showToast('请输入批次名称', 'warning');
    return;
  }
  
  // 检查是否有错误
  const hasErrors = currentArtifacts.some(artifact => 
    artifact.validationErrors && 
    artifact.validationErrors.some(e => e.type === 'error')
  );
  
  if (hasErrors && !confirm('存在验证错误，确定要继续入库吗？')) {
    return;
  }
  
  try {
    showToast('正在确认入库...', 'info');
    
    const response = await fetch(`${API_BASE}/confirm/${currentBatchId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        batchName: batchName,
        notes: batchNotes
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast(`入库成功！共 ${result.totalItems} 件，确认 ${result.confirmedItems} 件，退回 ${result.cancelledItems} 件`, 'success');
      
      // 切换到批次列表页面
      showTab('batches');
      loadBatches();
      
      // 重置状态
      currentBatchId = null;
      currentArtifacts = [];
      fileInput.value = '';
      fileInfo.style.display = 'none';
    } else {
      showToast(result.message || '确认入库失败', 'error');
    }
  } catch (error) {
    console.error('确认入库错误:', error);
    showToast('确认入库失败: ' + error.message, 'error');
  }
});

// 加载批次列表
async function loadBatches() {
  const batchesList = document.getElementById('batches-list');
  
  try {
    const response = await fetch(`${API_BASE}/batches`);
    const result = await response.json();
    
    if (result.success && result.batches.length > 0) {
      batchesList.innerHTML = '';
      
      result.batches.forEach(batch => {
        const card = document.createElement('div');
        card.className = 'batch-card';
        card.onclick = () => viewBatchDetail(batch.id);
        
        const statusClass = batch.status === 'confirmed' ? 'confirmed' : 'pending';
        const statusText = batch.status === 'confirmed' ? '已确认' : '待确认';
        
        card.innerHTML = `
          <div class="batch-card-header">
            <h3>${batch.batch_name}</h3>
            <span class="batch-card-status ${statusClass}">${statusText}</span>
          </div>
          <div class="batch-card-details">
            <div class="batch-card-detail">
              <span>📅</span>
              <span>${new Date(batch.upload_date || batch.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <div class="batch-card-detail">
              <span>📊</span>
              <span>总计 ${batch.total_items} 件</span>
            </div>
            <div class="batch-card-detail">
              <span>✅</span>
              <span>确认 ${batch.confirmed_items} 件</span>
            </div>
            <div class="batch-card-detail">
              <span>🔄</span>
              <span>退回 ${batch.cancelled_items} 件</span>
            </div>
            ${batch.notes ? `<div class="batch-card-detail"><span>📝</span><span>${batch.notes}</span></div>` : ''}
          </div>
        `;
        
        batchesList.appendChild(card);
      });
    } else {
      batchesList.innerHTML = '<p class="loading">暂无入库批次记录</p>';
    }
  } catch (error) {
    console.error('加载批次列表错误:', error);
    batchesList.innerHTML = '<p class="loading" style="color: #dc3545;">加载失败，请刷新重试</p>';
  }
}

// 查看批次详情
async function viewBatchDetail(batchId) {
  currentDetailBatchId = batchId;
  
  try {
    const response = await fetch(`${API_BASE}/batches/${batchId}`);
    const result = await response.json();
    
    if (result.success) {
      // 更新标题
      document.getElementById('detail-batch-name').textContent = `批次详情: ${result.batch.batch_name}`;
      
      // 渲染批次信息
      const batchInfo = document.getElementById('batch-info');
      const totalInsurance = result.artifacts.reduce((sum, a) => sum + (a.insurance_value || a.insuranceValue || 0), 0);
      
      batchInfo.innerHTML = `
        <div class="batch-info-grid">
          <div class="info-item">
            <div class="info-label">批次ID</div>
            <div class="info-value">${result.batch.id}</div>
          </div>
          <div class="info-item">
            <div class="info-label">批次名称</div>
            <div class="info-value">${result.batch.batch_name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">入库时间</div>
            <div class="info-value">${new Date(result.batch.upload_date || result.batch.created_at).toLocaleString('zh-CN')}</div>
          </div>
          <div class="info-item">
            <div class="info-label">状态</div>
            <div class="info-value">${result.batch.status === 'confirmed' ? '已确认' : '待确认'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">总计件数</div>
            <div class="info-value">${result.batch.total_items || result.artifacts.length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">确认入库</div>
            <div class="info-value">${result.batch.confirmed_items || result.artifacts.filter(a => a.status === 'confirmed').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">退回</div>
            <div class="info-value">${result.batch.cancelled_items || result.artifacts.filter(a => a.status === 'returned').length}</div>
          </div>
          <div class="info-item">
            <div class="info-label">总保险值</div>
            <div class="info-value">¥${formatCurrency(totalInsurance)}</div>
          </div>
          ${result.batch.notes ? `
          <div class="info-item" style="grid-column: span 4;">
            <div class="info-label">备注</div>
            <div class="info-value">${result.batch.notes}</div>
          </div>
          ` : ''}
        </div>
      `;
      
      // 渲染藏品表格
      const detailTbody = document.getElementById('detail-tbody');
      detailTbody.innerHTML = '';
      
      result.artifacts.forEach((artifact, index) => {
        const row = document.createElement('tr');
        
        // 检查是否有验证问题
        const hasValidationIssues = artifact.validationErrors && artifact.validationErrors.length > 0;
        const isReturned = artifact.status === 'returned';
        
        if (isReturned) {
          row.classList.add('returned-row');
        }
        
        // 验证问题
        let validationHtml = '-';
        if (hasValidationIssues) {
          validationHtml = '<div class="validation-status">';
          artifact.validationErrors.forEach(error => {
            const icon = error.type === 'error' ? '❌' : '⚠️';
            validationHtml += `<span class="${error.type === 'error' ? 'error-message' : 'warning-message'}">${icon} ${error.message}</span>`;
          });
          validationHtml += '</div>';
        }
        
        // 状态标签
        let statusHtml = '';
        if (artifact.status === 'confirmed') {
          statusHtml = '<span class="status-badge status-confirmed">已确认</span>';
        } else if (artifact.status === 'returned') {
          statusHtml = '<span class="status-badge status-returned">已退回</span>';
        } else {
          statusHtml = '<span class="status-badge status-pending">待确认</span>';
        }
        
        row.innerHTML = `
          <td>${artifact.original_row || artifact.originalRow || index + 1}</td>
          <td>${artifact.box_number || artifact.boxNumber || '-'}</td>
          <td>${artifact.artifact_number || artifact.artifactNumber || '-'}</td>
          <td>¥${formatCurrency(artifact.insurance_value || artifact.insuranceValue)}</td>
          <td>${artifact.location || '-'}</td>
          <td>${(artifact.has_certificate !== undefined ? artifact.has_certificate : artifact.hasCertificate) ? '是' : '否'}</td>
          <td>${statusHtml}</td>
          <td>${validationHtml}</td>
          <td>${artifact.notes || '-'}</td>
        `;
        
        detailTbody.appendChild(row);
      });
      
      // 切换到详情页面
      showTab('batch-detail');
    } else {
      showToast('加载批次详情失败', 'error');
    }
  } catch (error) {
    console.error('加载批次详情错误:', error);
    showToast('加载失败: ' + error.message, 'error');
  }
}

// 返回批次列表
document.getElementById('back-to-batches').addEventListener('click', () => {
  showTab('batches');
  currentDetailBatchId = null;
});

// 导出Markdown
document.getElementById('export-markdown').addEventListener('click', () => {
  if (currentDetailBatchId) {
    window.open(`${API_BASE}/batches/${currentDetailBatchId}/export/markdown`, '_blank');
  }
});

// 导出JSON
document.getElementById('export-json').addEventListener('click', () => {
  if (currentDetailBatchId) {
    window.open(`${API_BASE}/batches/${currentDetailBatchId}/export/json`, '_blank');
  }
});

// 显示指定标签页
function showTab(tabName) {
  // 移除所有活动状态
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  
  // 添加当前活动状态
  const navBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  if (navBtn) {
    navBtn.classList.add('active');
  }
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// 格式化货币
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00';
  }
  return parseFloat(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// 显示提示消息
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 默认显示上传页面
  showTab('upload');
});
