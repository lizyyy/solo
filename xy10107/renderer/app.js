let currentInvoices = [];
let selectedInvoiceId = null;
let currentFilters = { status: '', keyword: '' };

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  bindEvents();
  loadInvoices();
  loadStats();
  
  if (window.api) {
    window.api.onMenuImportFiles(() => handleImportFiles());
    window.api.onMenuExport(() => handleExportExcel());
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  document.getElementById('btn-import').addEventListener('click', handleImportFiles);
  document.getElementById('btn-export').addEventListener('click', handleExportExcel);

  document.getElementById('filter-status').addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    loadInvoices();
  });

  document.getElementById('search-input').addEventListener('input', debounce((e) => {
    currentFilters.keyword = e.target.value;
    loadInvoices();
  }, 300));

  document.getElementById('btn-refresh').addEventListener('click', loadInvoices);
  document.getElementById('btn-refresh-history').addEventListener('click', loadHistory);

  document.getElementById('btn-save').addEventListener('click', handleSaveInvoice);
  document.getElementById('btn-review').addEventListener('click', handleReviewInvoice);
  document.getElementById('btn-unreview').addEventListener('click', handleUnreviewInvoice);
  document.getElementById('btn-delete').addEventListener('click', handleDeleteInvoice);

  document.getElementById('btn-open-file').addEventListener('click', handleOpenFile);
  document.getElementById('btn-show-in-folder').addEventListener('click', handleShowInFolder);

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.toggle('active', tab.id === `tab-${tabName}`);
  });

  if (tabName === 'history') {
    loadHistory();
  }
}

async function loadInvoices() {
  try {
    const result = await window.api.getInvoices(currentFilters);
    if (result.success) {
      currentInvoices = result.data;
      renderInvoiceList();
    }
  } catch (err) {
    showToast('加载票据列表失败', 'error');
    console.error(err);
  }
}

async function loadStats() {
  try {
    const result = await window.api.getStats();
    if (result.success) {
      document.getElementById('stat-total').textContent = result.data.total;
      document.getElementById('stat-pending').textContent = result.data.pending;
      document.getElementById('stat-reviewed').textContent = result.data.reviewed;
      document.getElementById('stat-amount').textContent = `¥${result.data.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
    }
  } catch (err) {
    console.error('加载统计数据失败:', err);
  }
}

function renderInvoiceList() {
  const tbody = document.getElementById('invoice-list-body');

  if (currentInvoices.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div class="empty-state">
            <p>暂无票据数据</p>
            <p class="hint">点击"导入票据文件"开始使用</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentInvoices.map(invoice => {
    const isSelected = invoice.id === selectedInvoiceId;
    const statusClass = invoice.status === 'reviewed' ? 'reviewed' : 'pending';
    const statusText = invoice.status === 'reviewed' ? '已复核' : '待复核';
    
    return `
      <tr data-id="${invoice.id}" class="${isSelected ? 'selected' : ''}">
        <td><input type="radio" name="select" ${isSelected ? 'checked' : ''}></td>
        <td class="ellipsis" title="${invoice.filename}">${invoice.filename}</td>
        <td class="ellipsis" title="${invoice.project_no || '-'}">${invoice.project_no || '-'}</td>
        <td class="ellipsis" title="${invoice.approval_no || '-'}">${invoice.approval_no || '-'}</td>
        <td>¥${(invoice.amount || 0).toFixed(2)}</td>
        <td><span class="status-tag ${statusClass}">${statusText}</span></td>
        <td>${formatDate(invoice.created_at)}</td>
        <td>
          <div class="action-buttons">
            ${invoice.status === 'pending' 
              ? `<button class="btn btn-sm btn-success" onclick="quickReview(${invoice.id})">✅</button>`
              : `<button class="btn btn-sm btn-warning" onclick="quickUnreview(${invoice.id})">↩️</button>`
            }
            <button class="btn btn-sm btn-danger" onclick="quickDelete(${invoice.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (!e.target.closest('button') {
        const id = parseInt(row.dataset.id);
        selectInvoice(id);
      }
    });
  });
}

async function selectInvoice(id) {
  selectedInvoiceId = id;
  renderInvoiceList();

  try {
    const result = await window.api.getInvoice(id);
    if (result.success) {
      showInvoiceDetail(result.data);
    }
  } catch (err) {
    showToast('加载票据详情失败', 'error');
    console.error(err);
  }
}

async function showInvoiceDetail(invoice) {
  document.getElementById('detail-empty').style.display = 'none';
  document.getElementById('detail-content').style.display = 'flex';

  document.getElementById('detail-filename').textContent = invoice.filename;

  const statusBadge = document.getElementById('detail-status');
  statusBadge.textContent = invoice.status === 'reviewed' ? '已复核' : '待复核';
  statusBadge.className = `status-badge ${invoice.status === 'reviewed' ? 'reviewed' : 'pending'}`;

  document.getElementById('form-project-no').value = invoice.project_no || '';
  document.getElementById('form-approval-no').value = invoice.approval_no || '';
  document.getElementById('form-amount').value = invoice.amount || '';
  document.getElementById('form-invoice-date').value = invoice.invoice_date || '';
  document.getElementById('form-notes').value = invoice.notes || '';

  const isReviewed = invoice.status === 'reviewed';
  document.getElementById('btn-review').style.display = isReviewed ? 'none' : 'inline-flex';
  document.getElementById('btn-unreview').style.display = isReviewed ? 'inline-flex' : 'none';

  document.getElementById('info-id').textContent = invoice.id;
  document.getElementById('info-path').textContent = invoice.original_path;
  document.getElementById('info-path').title = invoice.original_path;
  document.getElementById('info-created').textContent = formatDateTime(invoice.created_at);
  document.getElementById('info-updated').textContent = formatDateTime(invoice.updated_at);

  const reviewedRow = document.getElementById('info-reviewed-row');
  const reviewerRow = document.getElementById('info-reviewer-row');
  
  if (invoice.reviewed_at) {
    reviewedRow.style.display = 'flex';
    document.getElementById('info-reviewed').textContent = formatDateTime(invoice.reviewed_at);
  } else {
    reviewedRow.style.display = 'none';
  }

  if (invoice.reviewed_by) {
    reviewerRow.style.display = 'flex';
    document.getElementById('info-reviewer').textContent = invoice.reviewed_by;
  } else {
    reviewerRow.style.display = 'none';
  }

  await loadFilePreview(invoice.original_path);
}

async function loadFilePreview(filePath) {
  const previewContainer = document.getElementById('preview-container');
  
  try {
    const result = await window.api.getFilePreview(filePath);
    
    if (!result.success) {
      previewContainer.innerHTML = `
        <div class="preview-placeholder">
          <div class="preview-icon">❌</div>
          <p>${result.error || '无法预览</p>
        </div>
      `;
      return;
    }

    if (result.type === 'image') {
      previewContainer.innerHTML = `<img src="${result.dataUrl}" alt="图片预览">`;
    } else if (result.type === 'pdf') {
      previewContainer.innerHTML = `
        <div class="preview-placeholder">
          <div class="preview-icon">📄</div>
          <p>PDF 文件</p>
          <p style="font-size: 12px; margin-top: 8px;">${result.message}</p>
        </div>
      `;
    } else {
      previewContainer.innerHTML = `
        <div class="preview-placeholder">
          <div class="preview-icon">📁</div>
          <p>${result.message}</p>
        </div>
      `;
    }
  } catch (err) {
    previewContainer.innerHTML = `
      <div class="preview-placeholder">
        <div class="preview-icon">❌</div>
        <p>加载预览失败</p>
      </div>
    `;
  }
}

async function handleImportFiles() {
  try {
    const result = await window.api.importFiles();
    
    if (result.canceled) {
      return;
    }

    if (!result.success) {
      showToast('导入失败', 'error');
      return;
    }

    const { imported, duplicates, errors } = result;

    if (imported.length > 0) {
      showToast(`成功导入 ${imported.length} 个文件`, 'success');
    }

    if (duplicates.length > 0) {
      showImportWarnings(duplicates);
    }

    if (errors.length > 0) {
      showImportErrors(errors);
    }

    await loadInvoices();
    await loadStats();
  } catch (err) {
    showToast('导入失败: ' + err.message, 'error');
    console.error(err);
  }
}

function showImportWarnings(duplicates) {
  const messages = duplicates.map(d => 
    `<li><strong>${d.filename}</strong>
     ${d.existing_project_no ? `已有项目号: ${d.existing_project_no}` : ''}
     ${d.existing_approval_no ? `审批单号: ${d.existing_approval_no}` : ''}
    </li>`
  ).join('');

  showModal({
    title: '⚠️ 存在重复文件',
    body: `
      <p>以下文件已存在于系统中，已自动跳过：</p>
      <div class="error-list">
        <ul>${messages}</ul>
      </div>
    `,
    showCancel: false
  });
}

function showImportErrors(errors) {
  const messages = errors.map(e => `<li><strong>${e.filename}</strong>: ${e.error}</li>`).join('');

  showModal({
    title: '⚠️ 部分文件导入失败',
    body: `
      <p>以下文件导入时出现错误：</p>
      <div class="error-list">
        <ul>${messages}</ul>
      </div>
    `,
    showCancel: false
  });
}

async function handleSaveInvoice() {
  if (!selectedInvoiceId) {
    showToast('请先选择一张票据', 'warning');
    return;
  }

  const data = {
    project_no: document.getElementById('form-project-no').value.trim(),
    approval_no: document.getElementById('form-approval-no').value.trim(),
    amount: parseFloat(document.getElementById('form-amount').value) || 0,
    invoice_date: document.getElementById('form-invoice-date').value || null,
    notes: document.getElementById('form-notes').value.trim()
  };

  try {
    const result = await window.api.saveInvoice(selectedInvoiceId, data);
    
    if (result.success) {
      showToast('保存成功', 'success');
      await loadInvoices();
      await loadStats();
      
      if (selectedInvoiceId) {
        const detailResult = await window.api.getInvoice(selectedInvoiceId);
        if (detailResult.success) {
          showInvoiceDetail(detailResult.data);
        }
      }
    } else {
      if (result.error === '文件缺失') {
        showModal({
          title: '❌ 文件缺失',
          body: `
            <p>无法保存，原文件已不存在：</p>
            <div class="error-list">
              <p>${result.details}</p>
            </div>
            <p style="margin-top: 12px;">建议：</p>
            <ul style="margin-left: 20px;">
              <li>检查文件是否被删除或移动</li>
              <li>确认文件路径正确</li>
              <li>如需重新归档，请重新导入文件</li>
            </ul>
          `,
          showCancel: false
        });
      } else if (result.error === '字段冲突') {
        showFieldConflicts(result.conflicts);
      } else {
        showToast(result.error || '保存失败', 'error');
      }
    }
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
    console.error(err);
  }
}

function showFieldConflicts(conflicts) {
  const conflictHtml = conflicts.map(c => `
    <div class="conflict-item">
      <h5>🔗 ${c.type === 'project_no' ? '项目号' : '审批单号'} 冲突</h5>
      <p>${c.message}</p>
      <p><strong>冲突票据:</strong> ${c.conflict_invoice.filename}</p>
    </div>
  `).join('');

  showModal({
    title: '⚠️ 字段冲突检测',
    body: `
      <p>保存时检测到以下冲突：</p>
      ${conflictHtml}
      <p style="margin-top: 12px;">
        <strong>建议:</strong> 请修改信息或联系相关人员确认。
      </p>
    `,
    showCancel: false
  });
}

async function handleReviewInvoice() {
  if (!selectedInvoiceId) {
    showToast('请先选择一张票据', 'warning');
    return;
  }

  showModal({
    title: '确认复核',
    body: '<p>确定要将此票据标记为"已复核"吗？</p><p>复核后项目号和审批单号将与已锁定，不能被其他票据使用。</p>',
    onConfirm: async () => {
      try {
        const result = await window.api.reviewInvoice(selectedInvoiceId, '当前用户');
        
        if (result.success) {
          showToast('复核成功', 'success');
          await loadInvoices();
          await loadStats();
          
          if (selectedInvoiceId) {
            const detailResult = await window.api.getInvoice(selectedInvoiceId);
            if (detailResult.success) {
              showInvoiceDetail(detailResult.data);
            }
          }
        } else {
          if (result.error === '文件缺失') {
            showModal({
              title: '❌ 文件缺失',
              body: `<p>无法复核，原文件已不存在：</p><div class="error-list"><p>${result.details}</p></div>',
              showCancel: false
            });
          } else if (result.error === '信息不完整') {
            showModal({
              title: '⚠️ 信息不完整',
              body: `<p>${result.details}</p><p>请先填写项目号或审批单号。</p>',
              showCancel: false
            });
          } else if (result.error === '字段冲突') {
            showModal({
              title: '⚠️ 字段冲突',
              body: `<p>${result.details}</p>`,
              showCancel: false
            });
          } else {
            showToast(result.error || '复核失败', 'error');
          }
        }
      } catch (err) {
        showToast('复核失败: ' + err.message, 'error');
        console.error(err);
      }
    }
  });
}

async function handleUnreviewInvoice() {
  if (!selectedInvoiceId) {
    showToast('请先选择一张票据', 'warning');
    return;
  }

  showModal({
    title: '确认取消复核',
    body: '<p>确定要取消此票据的复核状态吗？</p><p>取消后项目号和审批单号将释放，可以被其他票据使用。</p>',
    onConfirm: async () => {
      try {
        const result = await window.api.unreviewInvoice(selectedInvoiceId);
        
        if (result.success) {
          showToast('已取消复核', 'success');
          await loadInvoices();
          await loadStats();
          
          if (selectedInvoiceId) {
            const detailResult = await window.api.getInvoice(selectedInvoiceId);
            if (detailResult.success) {
              showInvoiceDetail(detailResult.data);
            }
          }
        } else {
          showToast(result.error || '操作失败', 'error');
        }
      } catch (err) {
        showToast('操作失败: ' + err.message, 'error');
        console.error(err);
      }
    }
  });
}

async function handleDeleteInvoice() {
  if (!selectedInvoiceId) {
    showToast('请先选择一张票据', 'warning');
    return;
  }

  showModal({
    title: '确认删除',
    body: '<p>确定要删除此票据吗？</p><p><strong>注意：</strong>此操作将同时删除该票据的所有操作记录，且无法恢复。</p>',
    onConfirm: async () => {
      try {
        const result = await window.api.deleteInvoice(selectedInvoiceId);
        
        if (result.success) {
          showToast('删除成功', 'success');
          selectedInvoiceId = null;
          document.getElementById('detail-empty').style.display = 'flex';
          document.getElementById('detail-content').style.display = 'none';
          await loadInvoices();
          await loadStats();
        } else {
          showToast(result.error || '删除失败', 'error');
        }
      } catch (err) {
        showToast('删除失败: ' + err.message, 'error');
        console.error(err);
      }
    }
  });
}

async function quickReview(id) {
  event.stopPropagation();
  
  try {
    const result = await window.api.reviewInvoice(id, '当前用户');
    
    if (result.success) {
      showToast('复核成功', 'success');
      await loadInvoices();
      await loadStats();
      
      if (selectedInvoiceId === id) {
        const detailResult = await window.api.getInvoice(id);
        if (detailResult.success) {
          showInvoiceDetail(detailResult.data);
        }
      }
    } else {
      showToast(result.error || '复核失败', 'error');
    }
  } catch (err) {
    showToast('复核失败: ' + err.message, 'error');
  }
}

async function quickUnreview(id) {
  event.stopPropagation();
  
  try {
    const result = await window.api.unreviewInvoice(id);
    
    if (result.success) {
      showToast('已取消复核', 'success');
      await loadInvoices();
      await loadStats();
      
      if (selectedInvoiceId === id) {
        const detailResult = await window.api.getInvoice(id);
        if (detailResult.success) {
          showInvoiceDetail(detailResult.data);
        }
      }
    } else {
      showToast(result.error || '操作失败', 'error');
    }
  } catch (err) {
    showToast('操作失败: ' + err.message, 'error');
  }
}

async function quickDelete(id) {
  event.stopPropagation();
  
  showModal({
    title: '确认删除',
    body: '<p>确定要删除此票据吗？</p><p><strong>注意：</strong>此操作无法恢复。</p>',
    onConfirm: async () => {
      try {
        const result = await window.api.deleteInvoice(id);
        
        if (result.success) {
          showToast('删除成功', 'success');
          if (selectedInvoiceId === id) {
            selectedInvoiceId = null;
            document.getElementById('detail-empty').style.display = 'flex';
            document.getElementById('detail-content').style.display = 'none';
          }
          await loadInvoices();
          await loadStats();
        } else {
          showToast(result.error || '删除失败', 'error');
        }
      } catch (err) {
        showToast('删除失败: ' + err.message, 'error');
      }
    }
  });
}

async function handleOpenFile() {
  if (!selectedInvoiceId) return;

  const invoice = currentInvoices.find(i => i.id === selectedInvoiceId);
  if (!invoice) return;

  const result = await window.api.openFile(invoice.original_path);
  if (!result.success) {
    showToast(result.error, 'error');
  }
}

async function handleShowInFolder() {
  if (!selectedInvoiceId) return;

  const invoice = currentInvoices.find(i => i.id === selectedInvoiceId);
  if (!invoice) return;

  const result = await window.api.showFileInFolder(invoice.original_path);
  if (!result.success) {
    showToast(result.error, 'error');
  }
}

async function handleExportExcel() {
  showModal({
    title: '导出票据清单',
    body: `
      <p>选择导出条件：</p>
      <div class="form-group" style="margin-top: 12px;">
        <label>状态筛选</label>
        <select id="export-status" class="form-control">
          <option value="">全部</option>
          <option value="pending">待复核</option>
          <option value="reviewed">已复核</option>
        </select>
      </div>
      <div class="form-row" style="margin-top: 12px;">
        <div class="form-group">
          <label>开始日期</label>
          <input type="date" id="export-start" class="form-control">
        </div>
        <div class="form-group">
          <label>结束日期</label>
          <input type="date" id="export-end" class="form-control">
        </div>
      </div>
    `,
    confirmText: '导出',
    onConfirm: async () => {
      const filters = {
        status: document.getElementById('export-status').value || undefined,
        startDate: document.getElementById('export-start').value || undefined,
        endDate: document.getElementById('export-end').value || undefined
      };

      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      try {
        const result = await window.api.exportExcel(filters);
        
        if (result.canceled) {
          return;
        }

        if (result.success) {
          showToast(`已导出 ${result.count} 条记录到 ${result.filePath}`, 'success');
        } else {
          showToast('导出失败', 'error');
        }
      } catch (err) {
        showToast('导出失败: ' + err.message, 'error');
        console.error(err);
      }
    }
  });
}

async function loadHistory() {
  try {
    const result = await window.api.getOperationsLog(200);
    if (result.success) {
      renderHistory(result.data);
    }
  } catch (err) {
    showToast('加载历史记录失败', 'error');
    console.error(err);
  }
}

function renderHistory(logs) {
  const container = document.getElementById('history-list');

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无操作记录</p>
      </div>
    `;
    return;
  }

  const operationIcons = {
    IMPORT: { icon: '📥', title: '导入文件', class: 'import' },
    UPDATE: { icon: '✏️', title: '更新信息', class: 'update' },
    REVIEW: { icon: '✅', title: '复核通过', class: 'review' },
    UNREVIEW: { icon: '↩️', title: '取消复核', class: 'unreview' },
    DELETE: { icon: '🗑️', title: '删除票据', class: 'delete' }
  };

  container.innerHTML = logs.map(log => {
    const info = operationIcons[log.operation] || { icon: '📝', title: log.operation, class: '' };
    let details = '';
    
    if (log.details) {
      try {
        const parsed = JSON.parse(log.details);
        if (parsed.filename) {
          details = `文件: ${parsed.filename}`;
        } else if (log.operation === 'UPDATE') {
          const fields = [];
          if (parsed.project_no !== undefined) fields.push(`项目号`);
          if (parsed.approval_no !== undefined) fields.push(`审批单号`);
          details = `更新了: ${fields.join(', ') || '票据信息'}`;
        } else if (parsed.reviewed_by) {
          details = `复核人: ${parsed.reviewed_by}`;
        }
      } catch (e) {
        details = log.details;
      }
    }

    return `
      <div class="history-item">
        <div class="history-icon ${info.class}">${info.icon}</div>
        <div class="history-content">
          <div class="history-title">${info.title}</div>
          ${log.filename ? `<div class="history-details">${log.filename}</div>` : ''}
          ${details ? `<div class="history-details">${details}</div>` : ''}
          <div class="history-time">${formatDateTime(log.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

let currentModalCallback = null;

function showModal(options) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const footer = document.getElementById('modal-footer');
  const cancelBtn = document.getElementById('modal-cancel');
  const confirmBtn = document.getElementById('modal-confirm');

  title.textContent = options.title || '提示';
  body.innerHTML = options.body || '';

  if (options.showCancel !== false) {
    cancelBtn.style.display = 'inline-flex';
  } else {
    cancelBtn.style.display = 'none';
  }

  confirmBtn.textContent = options.confirmText || '确定';

  currentModalCallback = options.onConfirm || null;

  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
  currentModalCallback = null;
}

document.getElementById('modal-confirm').addEventListener('click', async () => {
  if (currentModalCallback) {
    await currentModalCallback();
  }
  closeModal();
});

function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
