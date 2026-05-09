// 全局状态
let inspections = [];
let currentInspection = null;
let modalCallback = null;

// DOM 元素引用
const elements = {
  btnImport: document.getElementById('btn-import'),
  btnRefresh: document.getElementById('btn-refresh'),
  historyList: document.getElementById('history-list'),
  historyCount: document.getElementById('history-count'),
  emptyDetail: document.getElementById('empty-detail'),
  inspectionDetail: document.getElementById('inspection-detail'),
  detailZipname: document.getElementById('detail-zipname'),
  detailStatus: document.getElementById('detail-status'),
  detailTime: document.getElementById('detail-time'),
  photoCount: document.getElementById('photo-count'),
  locationCount: document.getElementById('location-count'),
  formCount: document.getElementById('form-count'),
  photoStatus: document.getElementById('photo-status'),
  locationStatus: document.getElementById('location-status'),
  formStatus: document.getElementById('form-status'),
  photoList: document.getElementById('photo-list'),
  locationList: document.getElementById('location-list'),
  formData: document.getElementById('form-data'),
  photoValidation: document.getElementById('photo-validation'),
  locationValidation: document.getElementById('location-validation'),
  formValidation: document.getElementById('form-validation'),
  photoMissing: document.getElementById('photo-missing'),
  photoMissingList: document.getElementById('photo-missing-list'),
  locationMissing: document.getElementById('location-missing'),
  locationMissingList: document.getElementById('location-missing-list'),
  formMissing: document.getElementById('form-missing'),
  formMissingList: document.getElementById('form-missing-list'),
  formConflicts: document.getElementById('form-conflicts'),
  formConflictsList: document.getElementById('form-conflicts-list'),
  reviewNotes: document.getElementById('review-notes'),
  btnApprove: document.getElementById('btn-approve'),
  btnReject: document.getElementById('btn-reject'),
  btnExport: document.getElementById('btn-export'),
  btnDelete: document.getElementById('btn-delete'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalMessage: document.getElementById('modal-message'),
  modalCancel: document.getElementById('modal-cancel'),
  modalConfirm: document.getElementById('modal-confirm'),
  importProgress: document.getElementById('import-progress'),
  progressMessage: document.getElementById('progress-message'),
  toastContainer: document.getElementById('toast-container')
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadInspections();
});

// 设置事件监听
function setupEventListeners() {
  elements.btnImport.addEventListener('click', handleImport);
  elements.btnRefresh.addEventListener('click', loadInspections);
  elements.btnApprove.addEventListener('click', () => handleReview('valid'));
  elements.btnReject.addEventListener('click', () => handleReview('invalid'));
  elements.btnExport.addEventListener('click', handleExport);
  elements.btnDelete.addEventListener('click', handleDelete);
  elements.modalCancel.addEventListener('click', hideModal);
  elements.modalConfirm.addEventListener('click', confirmModal);
  elements.reviewNotes.addEventListener('input', handleNotesChange);
}

// 加载巡检记录
async function loadInspections() {
  try {
    inspections = await window.api.getInspections();
    renderHistoryList();
  } catch (error) {
    showToast('加载历史记录失败', 'error');
    console.error(error);
  }
}

// 渲染历史记录列表
function renderHistoryList() {
  elements.historyCount.textContent = inspections.length;

  if (inspections.length === 0) {
    elements.historyList.innerHTML = `
      <div class="empty-state">
        <p>暂无历史记录</p>
        <p class="hint">点击右上角「导入巡检包」开始</p>
      </div>
    `;
    return;
  }

  elements.historyList.innerHTML = inspections.map(inspection => `
    <div class="history-item ${currentInspection?.id === inspection.id ? 'active' : ''}" 
         data-id="${inspection.id}">
      <div class="item-title">${inspection.zipName}</div>
      <div class="item-meta">
        <span class="item-time">${formatDateTime(inspection.importTime)}</span>
        <span class="item-status ${inspection.status}">${getStatusText(inspection.status)}</span>
      </div>
    </div>
  `).join('');

  // 添加点击事件
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const inspection = inspections.find(i => i.id === id);
      if (inspection) {
        selectInspection(inspection);
      }
    });
  });
}

// 选择巡检记录
function selectInspection(inspection) {
  currentInspection = inspection;
  renderHistoryList();
  renderInspectionDetail();
}

// 渲染巡检详情
function renderInspectionDetail() {
  if (!currentInspection) {
    elements.emptyDetail.classList.remove('hidden');
    elements.inspectionDetail.classList.add('hidden');
    return;
  }

  elements.emptyDetail.classList.add('hidden');
  elements.inspectionDetail.classList.remove('hidden');

  // 基本信息
  elements.detailZipname.textContent = currentInspection.zipName;
  elements.detailStatus.textContent = getStatusText(currentInspection.status);
  elements.detailStatus.className = `status-badge ${currentInspection.status}`;
  elements.detailTime.textContent = `导入时间：${formatDateTime(currentInspection.importTime)}`;

  // 统计数据
  elements.photoCount.textContent = currentInspection.photos.length;
  elements.locationCount.textContent = currentInspection.locations.length;
  elements.formCount.textContent = currentInspection.forms.length;

  // 状态显示
  updateStatStatus('photo', currentInspection.validation.photos.valid);
  updateStatStatus('location', currentInspection.validation.locations.valid);
  updateStatStatus('form', currentInspection.validation.forms.valid);

  // 验证状态
  updateValidationBadge('photo', currentInspection.validation.photos.valid);
  updateValidationBadge('location', currentInspection.validation.locations.valid);
  updateValidationBadge('form', currentInspection.validation.forms.valid);

  // 照片列表
  renderPhotoList();

  // 定位列表
  renderLocationList();

  // 表单数据
  renderFormData();

  // 缺失和冲突
  renderMissingAndConflicts();

  // 备注
  elements.reviewNotes.value = currentInspection.notes || '';
}

function updateStatStatus(type, valid) {
  const statusEl = type === 'photo' ? elements.photoStatus : 
                   type === 'location' ? elements.locationStatus : elements.formStatus;
  statusEl.textContent = valid ? '✓ 完整' : '✗ 缺失';
  statusEl.className = `stat-status ${valid ? 'valid' : 'invalid'}`;
}

function updateValidationBadge(type, valid) {
  const badgeEl = type === 'photo' ? elements.photoValidation :
                  type === 'location' ? elements.locationValidation : elements.formValidation;
  badgeEl.textContent = valid ? '✓ 完整' : '✗ 不完整';
  badgeEl.className = `validation-badge ${valid ? 'valid' : 'invalid'}`;
}

// 渲染照片列表
async function renderPhotoList() {
  elements.photoList.innerHTML = '';

  for (const photo of currentInspection.photos) {
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';

    try {
      const imageData = await window.api.getPhotoData(photo.path);
      photoItem.innerHTML = `
        <img class="photo-thumbnail" src="${imageData}" alt="${photo.name}">
        <div class="photo-name">${photo.name}</div>
      `;
    } catch (e) {
      photoItem.innerHTML = `
        <div class="photo-thumbnail" style="display:flex;align-items:center;justify-content:center;">
          <span style="font-size:32px;">🖼️</span>
        </div>
        <div class="photo-name">${photo.name}</div>
      `;
    }

    photoItem.addEventListener('click', () => {
      window.api.openPhoto(photo.path);
    });

    elements.photoList.appendChild(photoItem);
  }

  if (currentInspection.photos.length === 0) {
    elements.photoList.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">暂无照片</div>';
  }
}

// 渲染定位列表
function renderLocationList() {
  if (currentInspection.locations.length === 0) {
    elements.locationList.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">暂无定位数据</div>';
    return;
  }

  elements.locationList.innerHTML = currentInspection.locations.map(location => `
    <div class="data-item">
      <div class="item-name">${location.name}</div>
      <div class="item-preview">${truncateText(location.content, 100)}</div>
    </div>
  `).join('');
}

// 渲染表单数据
function renderFormData() {
  if (currentInspection.forms.length === 0) {
    elements.formData.innerHTML = '<div style="grid-column:span 2;color:#999;text-align:center;padding:20px;">暂无表单数据</div>';
    return;
  }

  const formData = currentInspection.forms[0].data;
  const keys = Object.keys(formData);

  if (keys.length === 0) {
    elements.formData.innerHTML = '<div style="grid-column:span 2;color:#999;text-align:center;padding:20px;">表单数据为空</div>';
    return;
  }

  elements.formData.innerHTML = keys.map(key => `
    <div class="form-field">
      <div class="field-label">${key}</div>
      <div class="field-value">${formData[key] || '-'}</div>
    </div>
  `).join('');
}

// 渲染缺失和冲突
function renderMissingAndConflicts() {
  // 照片缺失
  if (currentInspection.validation.photos.missing.length > 0) {
    elements.photoMissing.classList.remove('hidden');
    elements.photoMissingList.innerHTML = currentInspection.validation.photos.missing
      .map(item => `<li>${item}</li>`).join('');
  } else {
    elements.photoMissing.classList.add('hidden');
  }

  // 定位缺失
  if (currentInspection.validation.locations.missing.length > 0) {
    elements.locationMissing.classList.remove('hidden');
    elements.locationMissingList.innerHTML = currentInspection.validation.locations.missing
      .map(item => `<li>${item}</li>`).join('');
  } else {
    elements.locationMissing.classList.add('hidden');
  }

  // 表单缺失
  if (currentInspection.validation.forms.missing.length > 0) {
    elements.formMissing.classList.remove('hidden');
    elements.formMissingList.innerHTML = currentInspection.validation.forms.missing
      .map(item => `<li>${item}</li>`).join('');
  } else {
    elements.formMissing.classList.add('hidden');
  }

  // 表单冲突
  if (currentInspection.validation.forms.conflicts.length > 0) {
    elements.formConflicts.classList.remove('hidden');
    elements.formConflictsList.innerHTML = currentInspection.validation.forms.conflicts
      .map(conflict => `<li><strong>${conflict.field}</strong>: ${conflict.message}</li>`).join('');
  } else {
    elements.formConflicts.classList.add('hidden');
  }
}

// 处理导入
async function handleImport() {
  try {
    const zipPath = await window.api.selectZipFile();
    if (!zipPath) return;

    // 检查重复
    const zipName = zipPath.split(/[\\/]/).pop();
    const duplicate = await window.api.checkDuplicate(zipName);
    
    if (duplicate.exists) {
      const confirmed = await showConfirmModal(
        '重复导入检测',
        `发现同名巡检包已存在：\n${zipName}\n\n是否继续导入？`
      );
      if (!confirmed) return;
    }

    // 显示进度
    elements.importProgress.classList.remove('hidden');
    elements.progressMessage.textContent = `正在导入：${zipName}`;

    // 执行导入
    const result = await window.api.importZip(zipPath);
    elements.importProgress.classList.add('hidden');

    if (!result.success) {
      showToast(`导入失败：${result.error}`, 'error');
      return;
    }

    // 保存并显示
    const newInspection = result.data;
    const updatedList = await window.api.saveInspection(newInspection);
    inspections = updatedList;
    
    selectInspection(newInspection);
    showToast('导入成功', 'success');

    // 显示验证结果提示
    showValidationSummary(newInspection);

  } catch (error) {
    elements.importProgress.classList.add('hidden');
    showToast(`导入失败：${error.message}`, 'error');
    console.error(error);
  }
}

// 显示验证摘要
function showValidationSummary(inspection) {
  const issues = [];
  
  if (inspection.validation.photos.missing.length > 0) {
    issues.push(`照片缺失 ${inspection.validation.photos.missing.length} 项`);
  }
  if (inspection.validation.locations.missing.length > 0) {
    issues.push('定位数据缺失');
  }
  if (inspection.validation.forms.missing.length > 0) {
    issues.push(`表单字段缺失 ${inspection.validation.forms.missing.length} 项`);
  }
  if (inspection.validation.forms.conflicts.length > 0) {
    issues.push(`字段冲突 ${inspection.validation.forms.conflicts.length} 项`);
  }

  if (issues.length > 0) {
    setTimeout(() => {
      showToast(`检测到问题：${issues.join('，')}`, 'warning');
    }, 500);
  }
}

// 处理复核
async function handleReview(status) {
  if (!currentInspection) return;

  const action = status === 'valid' ? '通过' : '不通过';
  const confirmed = await showConfirmModal(
    `复核${action}`,
    `确定将此巡检包标记为【复核${action}】吗？`
  );

  if (!confirmed) return;

  try {
    currentInspection.status = status;
    currentInspection.notes = elements.reviewNotes.value;
    
    const updatedList = await window.api.saveInspection(currentInspection);
    inspections = updatedList;
    
    renderHistoryList();
    renderInspectionDetail();
    showToast(`复核${action}成功`, 'success');
  } catch (error) {
    showToast('操作失败', 'error');
    console.error(error);
  }
}

// 处理备注变化
function handleNotesChange() {
  if (currentInspection) {
    currentInspection.notes = elements.reviewNotes.value;
  }
}

// 处理导出
async function handleExport() {
  if (!currentInspection) return;

  try {
    const result = await window.api.exportInspection(currentInspection);
    if (result) {
      showToast(`导出成功：${result}`, 'success');
    }
  } catch (error) {
    showToast('导出失败', 'error');
    console.error(error);
  }
}

// 处理删除
async function handleDelete() {
  if (!currentInspection) return;

  const confirmed = await showConfirmModal(
    '确认删除',
    `确定删除巡检包「${currentInspection.zipName}」吗？\n此操作不可恢复。`
  );

  if (!confirmed) return;

  try {
    const updatedList = await window.api.deleteInspection(currentInspection.id);
    inspections = updatedList;
    currentInspection = null;
    
    renderHistoryList();
    renderInspectionDetail();
    showToast('删除成功', 'success');
  } catch (error) {
    showToast('删除失败', 'error');
    console.error(error);
  }
}

// 模态框
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    modalCallback = resolve;
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    elements.modal.classList.remove('hidden');
  });
}

function hideModal() {
  elements.modal.classList.add('hidden');
  if (modalCallback) {
    modalCallback(false);
    modalCallback = null;
  }
}

function confirmModal() {
  elements.modal.classList.add('hidden');
  if (modalCallback) {
    modalCallback(true);
    modalCallback = null;
  }
}

// Toast 提示
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// 工具函数
function formatDateTime(isoString) {
  const date = new Date(isoString);
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
    'pending': '待复核',
    'valid': '复核通过',
    'invalid': '复核不通过',
    'reviewed': '已复核'
  };
  return statusMap[status] || status;
}

function truncateText(text, maxLength) {
  if (!text) return '-';
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
