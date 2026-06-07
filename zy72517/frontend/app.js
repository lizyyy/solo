const API_BASE = '/api';

const STATUS_LABELS = {
  pending: '待处理',
  normal: '正常',
  duplicate_user: '同一用户重复反馈',
  needs_review: '待标注负责人复核',
  merged: '已归并',
  excluded: '已排除'
};

let state = {
  batches: [],
  currentBatchId: null,
  currentBatch: null,
  records: [],
  selectedRecordIds: [],
  currentRecord: null,
  mergeTargetId: null
};

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
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

async function loadBatches() {
  try {
    const res = await fetch(`${API_BASE}/batches`);
    state.batches = await res.json();
    renderBatchList();
  } catch (e) {
    console.error('加载批次列表失败:', e);
  }
}

function renderBatchList() {
  const container = document.getElementById('batchList');
  
  if (state.batches.length === 0) {
    container.innerHTML = '<p style="color: #999; font-size: 12px; text-align: center; padding: 20px 0;">暂无批次</p>';
    return;
  }
  
  container.innerHTML = state.batches.map(batch => `
    <div class="batch-item ${batch.id === state.currentBatchId ? 'active' : ''}" 
         onclick="selectBatch('${batch.id}')">
      <div class="batch-item-name">${batch.name}</div>
      <div class="batch-item-meta">
        <span>${batch.recordCount} 条记录</span>
        ${batch.issueCount > 0 ? `<span class="batch-item-issue">${batch.issueCount} 个问题</span>` : ''}
      </div>
    </div>
  `).join('');
}

async function selectBatch(batchId) {
  state.currentBatchId = batchId;
  state.selectedRecordIds = [];
  renderBatchList();
  
  try {
    const res = await fetch(`${API_BASE}/batches/${batchId}`);
    const data = await res.json();
    state.currentBatch = data.batch;
    state.records = data.records;
    
    renderBatchDetail();
    renderRecords();
    renderCheckResult(data.checkResult);
    
  } catch (e) {
    console.error('加载批次详情失败:', e);
    showToast('加载批次详情失败', 'error');
  }
}

function renderBatchDetail() {
  const batch = state.currentBatch;
  
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('batchDetail').style.display = 'block';
  
  document.getElementById('batchName').textContent = batch.name;
  document.getElementById('batchFile').textContent = batch.fileName;
  document.getElementById('batchTime').textContent = formatDate(batch.createdAt);
  document.getElementById('batchNotes').value = batch.importNotes || '';
}

function renderRecords() {
  const statusFilter = document.getElementById('statusFilter').value;
  const userIdFilter = document.getElementById('userIdFilter').value.trim().toLowerCase();
  
  let filtered = state.records;
  
  if (statusFilter) {
    filtered = filtered.filter(r => r.status === statusFilter);
  }
  if (userIdFilter) {
    filtered = filtered.filter(r => r.userId.toLowerCase().includes(userIdFilter));
  }
  
  document.getElementById('recordCount').textContent = `共 ${filtered.length} 条`;
  
  const tbody = document.getElementById('recordsTableBody');
  tbody.innerHTML = filtered.map(record => `
    <tr class="${record.status === 'duplicate_user' ? 'duplicate' : ''}">
      <td><input type="checkbox" class="record-checkbox" 
           ${state.selectedRecordIds.includes(record.id) ? 'checked' : ''}
           onchange="toggleRecordSelection('${record.id}')"></td>
      <td><strong>L${record.originalLineNumber}</strong></td>
      <td>${record.userId}</td>
      <td>${record.questionText.length > 60 ? record.questionText.substr(0, 60) + '...' : record.questionText}</td>
      <td><span class="status-tag status-${record.status}">${STATUS_LABELS[record.status]}</span></td>
      <td>${record.statusUpdatedBy || '-'}</td>
      <td>
        <button class="action-btn" onclick="viewRecordDetail('${record.id}')">详情</button>
      </td>
    </tr>
  `).join('');
  
  updateMergeBar();
}

function toggleRecordSelection(recordId) {
  const idx = state.selectedRecordIds.indexOf(recordId);
  if (idx === -1) {
    state.selectedRecordIds.push(recordId);
  } else {
    state.selectedRecordIds.splice(idx, 1);
  }
  
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.record-checkbox');
  selectAll.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
  
  updateMergeBar();
}

function updateMergeBar() {
  const mergeBar = document.getElementById('mergeBar');
  const count = state.selectedRecordIds.length;
  
  if (count > 0) {
    mergeBar.style.display = 'flex';
    document.getElementById('selectedCount').textContent = count;
  } else {
    mergeBar.style.display = 'none';
  }
}

document.getElementById('selectAll').addEventListener('change', (e) => {
  const checkboxes = document.querySelectorAll('.record-checkbox');
  const isChecked = e.target.checked;
  
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const recordId = cb.closest('tr').querySelector('.action-btn').getAttribute('onclick').match(/'([^']+)'/)[1];
    
    const idx = state.selectedRecordIds.indexOf(recordId);
    if (isChecked && idx === -1) {
      state.selectedRecordIds.push(recordId);
    } else if (!isChecked && idx !== -1) {
      state.selectedRecordIds.splice(idx, 1);
    }
  });
  
  updateMergeBar();
});

document.getElementById('cancelSelectBtn').addEventListener('click', () => {
  state.selectedRecordIds = [];
  document.querySelectorAll('.record-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('selectAll').checked = false;
  updateMergeBar();
});

document.getElementById('mergeBtn').addEventListener('click', () => {
  if (state.selectedRecordIds.length < 2) {
    showToast('请至少选择2条记录进行归并', 'warning');
    return;
  }
  renderMergeTargetList();
  openModal('mergeModal');
});

function renderMergeTargetList() {
  const selectedRecords = state.records.filter(r => state.selectedRecordIds.includes(r.id));
  const container = document.getElementById('mergeTargetList');
  state.mergeTargetId = null;
  
  container.innerHTML = selectedRecords.map(record => `
    <div class="merge-target-item" onclick="selectMergeTarget('${record.id}', this)">
      <input type="radio" name="mergeTarget" value="${record.id}">
      <div class="merge-target-question">${record.questionText}</div>
      <div class="merge-target-meta">
        行号: L${record.originalLineNumber} | 用户: ${record.userId} | 状态: ${STATUS_LABELS[record.status]}
      </div>
    </div>
  `).join('');
}

function selectMergeTarget(recordId, element) {
  state.mergeTargetId = recordId;
  document.querySelectorAll('.merge-target-item').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  element.querySelector('input').checked = true;
}

document.getElementById('confirmMergeBtn').addEventListener('click', async () => {
  if (!state.mergeTargetId) {
    showToast('请选择归并目标主记录', 'warning');
    return;
  }
  
  const sourceIds = state.selectedRecordIds.filter(id => id !== state.mergeTargetId);
  
  try {
    const res = await fetch(`${API_BASE}/batches/${state.currentBatchId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceRecordIds: sourceIds,
        targetRecordId: state.mergeTargetId,
        operator: '老唐'
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('归并成功');
      closeModal('mergeModal');
      selectBatch(state.currentBatchId);
    } else {
      showToast(data.error || '归并失败', 'error');
    }
  } catch (e) {
    console.error('归并失败:', e);
    showToast('归并失败', 'error');
  }
});

async function viewRecordDetail(recordId) {
  state.currentRecord = state.records.find(r => r.id === recordId);
  if (!state.currentRecord) return;
  
  const record = state.currentRecord;
  
  document.getElementById('detailLineNumber').textContent = 'L' + record.originalLineNumber;
  document.getElementById('detailUserId').textContent = record.userId;
  document.getElementById('detailUserName').textContent = record.userName || '-';
  document.getElementById('detailFeedbackTime').textContent = record.feedbackTime || '-';
  document.getElementById('detailQuestion').textContent = record.questionText;
  document.getElementById('detailStatus').value = record.status;
  document.getElementById('detailStatusUpdatedBy').textContent = record.statusUpdatedBy || '-';
  document.getElementById('detailStatusUpdatedAt').textContent = formatDate(record.statusUpdatedAt);
  document.getElementById('detailAnnotatorComment').value = record.annotatorComment || '';
  document.getElementById('detailReviewComment').value = record.reviewComment || '';
  
  const changeHistory = document.getElementById('detailChangeHistory');
  if (record.manualChanges && record.manualChanges.length > 0) {
    changeHistory.innerHTML = record.manualChanges.map(change => {
      let changeText = '';
      if (change.field === 'status') {
        changeText = `状态从 <strong>${STATUS_LABELS[change.oldValue] || change.oldValue}</strong> 改为 <strong>${STATUS_LABELS[change.newValue] || change.newValue}</strong>`;
      } else if (change.field === 'annotatorComment') {
        changeText = `更新标注员留言`;
      } else if (change.field === 'reviewComment') {
        changeText = `更新复核意见`;
      } else if (change.field === 'mergedIntoId') {
        changeText = `归并到记录 <strong>${change.newValue}</strong>`;
      } else {
        changeText = `${change.field}: ${change.oldValue || '(空)'} → ${change.newValue}`;
      }
      return `
        <div class="change-item">
          <div class="change-time">${formatDate(change.changedAt)} · ${change.changedBy}</div>
          <div class="change-content"><span class="change-field">${changeText}</span></div>
        </div>
      `;
    }).join('');
  } else {
    changeHistory.innerHTML = '<p style="color: #999; font-size: 13px;">暂无人工改动记录</p>';
  }
  
  const mergeInfoSection = document.getElementById('mergeInfoSection');
  const mergeInfo = document.getElementById('mergeInfo');
  
  if (record.mergedIntoId || (record.mergedFromIds && record.mergedFromIds.length > 0)) {
    mergeInfoSection.style.display = 'block';
    let mergeHtml = '';
    if (record.mergedIntoId) {
      mergeHtml += `<p><strong>已归并到：</strong>${record.mergedIntoId}</p>`;
    }
    if (record.mergedFromIds && record.mergedFromIds.length > 0) {
      mergeHtml += `<p><strong>已合并进来的记录：</strong>${record.mergedFromIds.length} 条</p>`;
      mergeHtml += `<ul>${record.mergedFromIds.map(id => `<li>${id}</li>`).join('')}</ul>`;
    }
    mergeInfo.innerHTML = mergeHtml;
  } else {
    mergeInfoSection.style.display = 'none';
  }
  
  openModal('recordDetailModal');
}

document.getElementById('saveRecordBtn').addEventListener('click', async () => {
  if (!state.currentRecord) return;
  
  const status = document.getElementById('detailStatus').value;
  const annotatorComment = document.getElementById('detailAnnotatorComment').value;
  const reviewComment = document.getElementById('detailReviewComment').value;
  
  try {
    const res = await fetch(`${API_BASE}/batches/${state.currentBatchId}/records/${state.currentRecord.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        annotatorComment,
        reviewComment,
        operator: '老唐'
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('保存成功');
      closeModal('recordDetailModal');
      selectBatch(state.currentBatchId);
    } else {
      showToast(data.error || '保存失败', 'error');
    }
  } catch (e) {
    console.error('保存失败:', e);
    showToast('保存失败', 'error');
  }
});

function renderCheckResult(checkResult) {
  if (!checkResult) {
    document.getElementById('checkResult').style.display = 'none';
    return;
  }
  
  document.getElementById('checkResult').style.display = 'block';
  
  const stats = checkResult.stats;
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statNormal').textContent = stats.normal;
  document.getElementById('statDuplicate').textContent = stats.duplicateUser;
  document.getElementById('statMerged').textContent = stats.merged;
  document.getElementById('statExcluded').textContent = stats.excluded;
  document.getElementById('statPending').textContent = stats.pending;
  
  const exportCheck = checkResult.exportCheck;
  const exportCheckEl = document.getElementById('exportCheck');
  exportCheckEl.textContent = exportCheck.warning;
  exportCheckEl.className = `export-check ${exportCheck.displayCount !== exportCheck.exportableCount ? 'warning' : ''}`;
  
  const issueList = document.getElementById('issueList');
  if (checkResult.issues && checkResult.issues.length > 0) {
    issueList.innerHTML = checkResult.issues.map(issue => `
      <div class="issue-item ${issue.severity === 'warning' ? 'warning' : ''}">
        <span class="issue-type">[${issue.severity === 'warning' ? '警告' : '错误'}]</span>
        ${issue.message}
        ${issue.originalLineNumbers ? `<span style="color: #999;">(行号: ${issue.originalLineNumbers.join(', ')})</span>` : ''}
      </div>
    `).join('');
  } else {
    issueList.innerHTML = '<p style="color: #52c41a; font-size: 13px;">✓ 未发现异常问题</p>';
  }
}

document.getElementById('createBatchBtn').addEventListener('click', () => {
  document.getElementById('newBatchName').value = '';
  document.getElementById('csvFile').value = '';
  openModal('createBatchModal');
});

document.getElementById('confirmCreateBatch').addEventListener('click', async () => {
  const batchName = document.getElementById('newBatchName').value.trim();
  const fileInput = document.getElementById('csvFile');
  const operator = document.getElementById('operatorName').value.trim();
  
  if (!batchName) {
    showToast('请输入批次名称', 'warning');
    return;
  }
  
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('请上传CSV文件', 'warning');
    return;
  }
  
  const formData = new FormData();
  formData.append('batchName', batchName);
  formData.append('file', fileInput.files[0]);
  formData.append('operator', operator);
  
  try {
    const res = await fetch(`${API_BASE}/batches`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast(`导入成功，共 ${data.importedCount} 条记录`);
      closeModal('createBatchModal');
      await loadBatches();
      
      if (data.duplicateIssues && data.duplicateIssues.length > 0) {
        showToast(`检测到 ${data.duplicateIssues.length} 条疑似重复导入`, 'warning');
      }
      
      if (data.batch && data.batch.id) {
        selectBatch(data.batch.id);
      }
    } else {
      showToast(data.error || '导入失败', 'error');
    }
  } catch (e) {
    console.error('导入失败:', e);
    showToast('导入失败: ' + e.message, 'error');
  }
});

document.getElementById('checkBtn').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_BASE}/batches/${state.currentBatchId}/check`);
    const checkResult = await res.json();
    renderCheckResult(checkResult);
    showToast('自检完成');
  } catch (e) {
    console.error('自检失败:', e);
    showToast('自检失败', 'error');
  }
});

document.getElementById('recheckBtn').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_BASE}/batches/${state.currentBatchId}/recheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator: '老唐' })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      selectBatch(state.currentBatchId);
    }
  } catch (e) {
    console.error('重算失败:', e);
    showToast('重算失败', 'error');
  }
});

document.getElementById('saveNotesBtn').addEventListener('click', async () => {
  const notes = document.getElementById('batchNotes').value;
  
  try {
    const res = await fetch(`${API_BASE}/batches/${state.currentBatchId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        importNotes: notes,
        operator: '老唐'
      })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast('备注保存成功');
      state.currentBatch = data.batch;
    }
  } catch (e) {
    console.error('保存备注失败:', e);
    showToast('保存备注失败', 'error');
  }
});

document.getElementById('exportBtn').addEventListener('click', () => {
  window.open(`${API_BASE}/batches/${state.currentBatchId}/export`, '_blank');
});

document.getElementById('statusFilter').addEventListener('change', renderRecords);
document.getElementById('userIdFilter').addEventListener('input', renderRecords);

window.onclick = (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
};

async function init() {
  await loadBatches();
}

init();
