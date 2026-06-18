let currentRecords = [];
let selectedFile = null;

document.addEventListener('DOMContentLoaded', function() {
  initTabs();
  initEventListeners();
  loadRecords();
  loadRules();
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });
}

function initEventListeners() {
  document.getElementById('btn-refresh').addEventListener('click', loadRecords);
  document.getElementById('btn-export-json').addEventListener('click', () => exportData('json'));
  document.getElementById('btn-export-excel').addEventListener('click', () => exportData('excel'));
  document.getElementById('btn-export-csv').addEventListener('click', () => exportData('csv'));
  document.getElementById('status-filter').addEventListener('change', filterRecords);

  document.querySelectorAll('input[name="import-type"]').forEach(radio => {
    radio.addEventListener('change', handleImportTypeChange);
  });

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      selectedFile = e.dataTransfer.files[0];
      document.getElementById('file-name').textContent = selectedFile.name;
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      document.getElementById('file-name').textContent = selectedFile.name;
    }
  });

  document.getElementById('btn-import').addEventListener('click', handleImport);
}

function getOperator() {
  return document.getElementById('operator').value || 'system';
}

function loadRecords() {
  const tbody = document.getElementById('records-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="loading">加载中...</td></tr>';

  fetch('/api/records')
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        currentRecords = result.data;
        filterRecords();
        updateSummary();
      } else {
        tbody.innerHTML = '<tr><td colspan="11" class="loading">加载失败</td></tr>';
      }
    })
    .catch(err => {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="11" class="loading">加载失败</td></tr>';
    });
}

function filterRecords() {
  const status = document.getElementById('status-filter').value;
  let records = currentRecords;
  if (status) {
    records = records.filter(r => r.status === status);
  }
  renderRecords(records);
}

function updateSummary() {
  document.getElementById('stat-total').textContent = currentRecords.length;
  document.getElementById('stat-pending').textContent = currentRecords.filter(r => r.status === 'PENDING_MANAGER_REVIEW').length;
  document.getElementById('stat-changed').textContent = currentRecords.filter(r => r.has_manual_change).length;
  document.getElementById('stat-normal').textContent = currentRecords.filter(r => r.status === 'NORMAL').length;
}

function renderRecords(records) {
  const tbody = document.getElementById('records-tbody');
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(record => {
    const rowClass = record.status === 'PENDING_MANAGER_REVIEW' ? 'pending-row' :
                    record.has_manual_change ? 'changed-row' : '';
    const dateChanged = record.original_settlement_date !== record.current_settlement_date;
    const qtyChanged = record.original_quantity !== record.current_quantity;

    return `
      <tr class="${rowClass}">
        <td>${record.batch_id}</td>
        <td><strong>${record.original_line_number}</strong></td>
        <td>${record.fund_name || record.fund_code}</td>
        <td>${record.security_name || record.security_code}</td>
        <td>${record.original_settlement_date || '-'}</td>
        <td class="${dateChanged ? 'detail-value changed' : ''}">
          ${dateChanged ? `<span class="detail-value original">${record.original_settlement_date}</span> → ` : ''}
          ${record.current_settlement_date || '-'}
        </td>
        <td>${record.original_quantity}</td>
        <td class="${qtyChanged ? 'detail-value changed' : ''}">
          ${qtyChanged ? `<span class="detail-value original">${record.original_quantity}</span> → ` : ''}
          ${record.current_quantity}
        </td>
        <td><span class="status-badge status-${record.status}">${record.status_label}</span></td>
        <td>
          ${record.has_manual_change ?
            `<span class="change-badge">${record.change_type_label || '有改动'}</span>` :
            '<span class="change-badge no-change">无</span>'}
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-secondary btn-small" onclick="showDetail(${record.id})">详情</button>
            ${renderActionButtons(record)}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderActionButtons(record) {
  const buttons = [];

  if (record.status === 'IMPORTED') {
    buttons.push(`<button class="btn btn-primary btn-small" onclick="showScreenshotUpload(${record.id})">补看截图</button>`);
  }

  if (record.status === 'IMPORTED' || record.status === 'SCREENSHOT_REVIEWED') {
    buttons.push(`<button class="btn btn-warning btn-small" onclick="showManualChange(${record.id})">记录改动</button>`);
  }

  if (record.status === 'PENDING_MANAGER_REVIEW') {
    buttons.push(`<button class="btn btn-success btn-small" onclick="showManagerReview(${record.id}, true)">复核通过</button>`);
    buttons.push(`<button class="btn btn-danger btn-small" onclick="showManagerReview(${record.id}, false)">复核驳回</button>`);
  }

  if ((record.status === 'SCREENSHOT_REVIEWED' && !record.has_manual_change) || record.status === 'MANAGER_APPROVED') {
    buttons.push(`<button class="btn btn-success btn-small" onclick="finalizeRecord(${record.id})">标记正常</button>`);
  }

  if (record.status !== 'REVERTED') {
    buttons.push(`<button class="btn btn-danger btn-small" onclick="showRevert(${record.id})">回滚</button>`);
  }

  buttons.push(`<button class="btn btn-secondary btn-small" onclick="showNoteUpdate(${record.id})">更新说明</button>`);

  return buttons.join('');
}

function showDetail(id) {
  fetch(`/api/records/${id}`)
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        renderDetailModal(result.data);
        document.getElementById('detail-modal').style.display = 'flex';
      }
    });
}

function renderDetailModal(record) {
  const body = document.getElementById('detail-body');

  const dateChanged = record.original_settlement_date !== record.current_settlement_date;
  const qtyChanged = record.original_quantity !== record.current_quantity;
  const amtChanged = record.original_amount !== record.current_amount;

  let html = `
    <div class="detail-section">
      <h4>基本信息</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">批次号</span><span class="detail-value">${record.batch_id}</span></div>
        <div class="detail-item"><span class="detail-label">原始行号</span><span class="detail-value"><strong>${record.original_line_number}</strong></span></div>
        <div class="detail-item"><span class="detail-label">基金代码</span><span class="detail-value">${record.fund_code || '-'}</span></div>
        <div class="detail-item"><span class="detail-label">基金名称</span><span class="detail-value">${record.fund_name || '-'}</span></div>
        <div class="detail-item"><span class="detail-label">证券代码</span><span class="detail-value">${record.security_code || '-'}</span></div>
        <div class="detail-item"><span class="detail-label">证券名称</span><span class="detail-value">${record.security_name || '-'}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>核对数据 <small style="color: #909399; font-weight: normal;">（原始值 → 当前值，不一致标红）</small></h4>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">到账日</span>
          <span class="detail-value ${dateChanged ? 'changed' : ''}">
            ${dateChanged ? `<span class="detail-value original">${record.original_settlement_date}</span> → ` : ''}
            ${record.current_settlement_date || '-'}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">数量</span>
          <span class="detail-value ${qtyChanged ? 'changed' : ''}">
            ${qtyChanged ? `<span class="detail-value original">${record.original_quantity}</span> → ` : ''}
            ${record.current_quantity}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">金额</span>
          <span class="detail-value ${amtChanged ? 'changed' : ''}">
            ${amtChanged ? `<span class="detail-value original">${record.original_amount}</span> → ` : ''}
            ${record.current_amount}
          </span>
        </div>
        <div class="detail-item"><span class="detail-label">处理状态</span><span class="status-badge status-${record.status}">${record.status_label}</span></div>
        <div class="detail-item"><span class="detail-label">是否人工改动</span><span class="detail-value">${record.has_manual_change ? '是' : '否'}</span></div>
        <div class="detail-item"><span class="detail-label">改动类型</span><span class="detail-value">${record.change_type_label || '-'}</span></div>
      </div>
    </div>
  `;

  if (record.change_logs && record.change_logs.length > 0) {
    html += `
      <div class="detail-section">
        <h4>人工改动日志 <span style="color: #f56c6c;">（证据链）</span></h4>
        ${record.change_logs.map(log => `
          <div class="log-item">
            <div class="log-header">
              <span><strong>${log.operator}</strong> 改动了 ${log.field_label}</span>
              <span>${log.operate_time}</span>
            </div>
            <div><span class="detail-value original">${log.old_value}</span> → <span class="detail-value changed">${log.new_value}</span></div>
            <div style="margin-top: 4px; color: #606266;">原因: ${log.change_reason}</div>
            ${log.evidence_screenshot_url ? `<div style="margin-top: 4px;">证据: <a href="${log.evidence_screenshot_url}" target="_blank">查看截图</a></div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  if (record.status_transitions && record.status_transitions.length > 0) {
    html += `
      <div class="detail-section">
        <h4>状态流转历史</h4>
        ${record.status_transitions.map(t => `
          <div class="transition-item">
            <div class="transition-header">
              <span><strong>${t.operator}</strong></span>
              <span>${t.operate_time}</span>
            </div>
            <div>
              <span class="status-badge status-${t.from_status}">${t.from_status_label}</span>
              <span style="margin: 0 8px;">→</span>
              <span class="status-badge status-${t.to_status}">${t.to_status_label}</span>
            </div>
            <div style="margin-top: 4px; color: #606266;">${t.transition_reason}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (record.ex_right_screenshots && record.ex_right_screenshots.length > 0) {
    html += `
      <div class="detail-section">
        <h4>除权日截图</h4>
        ${record.ex_right_screenshots.map(s => `
          <div class="log-item">
            <div class="log-header">
              <span><strong>${s.upload_operator}</strong> 上传</span>
              <span>${s.upload_time}</span>
            </div>
            <div><a href="${s.screenshot_url}" target="_blank">查看截图</a></div>
            ${s.remark ? `<div style="margin-top: 4px; color: #606266;">备注: ${s.remark}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  if (record.reconciliation_notes && record.reconciliation_notes.length > 0) {
    html += `
      <div class="detail-section">
        <h4>对账说明</h4>
        ${record.reconciliation_notes.map(n => `
          <div class="note-item">
            <div class="note-header">
              <span><strong>${n.operator}</strong></span>
              <span>${n.update_time}</span>
            </div>
            <div>${n.note_content}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  body.innerHTML = html;
}

function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
}

function showActionModal(title, content) {
  document.getElementById('action-modal-title').textContent = title;
  document.getElementById('action-modal-body').innerHTML = content;
  document.getElementById('action-modal').style.display = 'flex';
}

function closeActionModal() {
  document.getElementById('action-modal').style.display = 'none';
}

function showScreenshotUpload(id) {
  const content = `
    <div class="form-group">
      <label>上传除权日截图</label>
      <input type="file" id="screenshot-file" accept="image/*">
    </div>
    <div class="form-group">
      <label>备注</label>
      <textarea id="screenshot-remark" placeholder="可选，填写截图相关说明"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeActionModal()">取消</button>
      <button class="btn btn-primary" onclick="uploadScreenshot(${id})">确认上传</button>
    </div>
  `;
  showActionModal('第二步：补看除权日截图', content);
}

function uploadScreenshot(id) {
  const fileInput = document.getElementById('screenshot-file');
  const remark = document.getElementById('screenshot-remark').value;
  const operator = getOperator();

  if (fileInput.files.length === 0) {
    alert('请选择截图文件');
    return;
  }

  const formData = new FormData();
  formData.append('screenshot', fileInput.files[0]);
  formData.append('operator', operator);
  formData.append('remark', remark);

  fetch(`/api/records/${id}/screenshot`, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert(result.message);
      closeActionModal();
      loadRecords();
    } else {
      alert('操作失败: ' + result.error);
    }
  })
  .catch(err => {
    alert('操作失败: ' + err.message);
  });
}

function showManualChange(id) {
  const record = currentRecords.find(r => r.id === id);
  if (!record) return;

  const content = `
    <div class="form-group">
      <label>改动字段</label>
      <select id="change-field">
        <option value="settlement_date">到账日 (当前: ${record.current_settlement_date})</option>
        <option value="quantity">数量 (当前: ${record.current_quantity})</option>
        <option value="amount">金额 (当前: ${record.current_amount})</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>原值</label>
        <input type="text" id="change-old" value="${record.original_settlement_date}" readonly>
      </div>
      <div class="form-group">
        <label>新值</label>
        <input type="text" id="change-new" placeholder="请输入新值">
      </div>
    </div>
    <div class="form-group">
      <label>改动原因</label>
      <textarea id="change-reason" placeholder="请详细说明改动原因，如：除权日截图显示为T+2"></textarea>
    </div>
    <div class="form-group">
      <label>证据截图（可选）</label>
      <input type="file" id="change-evidence" accept="image/*">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeActionModal()">取消</button>
      <button class="btn btn-warning" onclick="submitManualChange(${id})">确认改动</button>
    </div>
  `;
  showActionModal('记录人工改动', content);

  document.getElementById('change-field').addEventListener('change', function() {
    const field = this.value;
    let oldVal = '';
    if (field === 'settlement_date') oldVal = record.original_settlement_date;
    else if (field === 'quantity') oldVal = record.original_quantity;
    else if (field === 'amount') oldVal = record.original_amount;
    document.getElementById('change-old').value = oldVal;
  });
}

function submitManualChange(id) {
  const fieldName = document.getElementById('change-field').value;
  const oldValue = document.getElementById('change-old').value;
  const newValue = document.getElementById('change-new').value;
  const changeReason = document.getElementById('change-reason').value;
  const operator = getOperator();

  if (!newValue) {
    alert('请输入新值');
    return;
  }
  if (!changeReason) {
    alert('请填写改动原因');
    return;
  }

  const fileInput = document.getElementById('change-evidence');

  const doSubmit = (evidencePath) => {
    fetch(`/api/records/${id}/manual-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        change_reason: changeReason,
        operator: operator,
        evidence_screenshot: evidencePath
      })
    })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        let msg = result.message;
        if (result.data.requires_review) {
          msg += '\n⚠️ 检测到T+1→T+2手工改动，已自动提交基金经理复核，不能直接标记为正常';
        }
        alert(msg);
        closeActionModal();
        loadRecords();
      } else {
        alert('操作失败: ' + result.error);
      }
    })
    .catch(err => {
      alert('操作失败: ' + err.message);
    });
  };

  if (fileInput.files.length > 0) {
    const formData = new FormData();
    formData.append('screenshot', fileInput.files[0]);
    formData.append('operator', operator);

    fetch(`/api/records/${id}/screenshot`, {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        doSubmit(`/uploads/${fileInput.files[0].name}`);
      } else {
        alert('证据上传失败，但仍可记录改动');
        doSubmit(null);
      }
    });
  } else {
    doSubmit(null);
  }
}

function showManagerReview(id, approved) {
  const action = approved ? '复核通过' : '复核驳回';
  const content = `
    <div class="form-group">
      <label>复核意见</label>
      <textarea id="review-comment" placeholder="${approved ? '请填写通过理由' : '请填写驳回理由及修改要求'}"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeActionModal()">取消</button>
      <button class="btn ${approved ? 'btn-success' : 'btn-danger'}" onclick="submitManagerReview(${id}, ${approved})">确认${action}</button>
    </div>
  `;
  showActionModal(`基金经理${action}`, content);
}

function submitManagerReview(id, approved) {
  const reviewComment = document.getElementById('review-comment').value;
  const operator = getOperator();

  fetch(`/api/records/${id}/manager-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approved: approved,
      review_comment: reviewComment,
      operator: operator
    })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert(result.message);
      closeActionModal();
      loadRecords();
    } else {
      alert('操作失败: ' + result.error);
    }
  })
  .catch(err => {
    alert('操作失败: ' + err.message);
  });
}

function finalizeRecord(id) {
  const operator = getOperator();
  if (!confirm('确定要标记为正常吗？此操作表示核对完成。')) {
    return;
  }

  fetch(`/api/records/${id}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator: operator })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert(result.message);
      loadRecords();
    } else {
      alert('操作失败: ' + result.error);
    }
  })
  .catch(err => {
    alert('操作失败: ' + err.message);
  });
}

function showRevert(id) {
  const content = `
    <div class="form-group">
      <label>回滚原因</label>
      <textarea id="revert-reason" placeholder="请填写回滚原因"></textarea>
    </div>
    <p style="color: #f56c6c; margin-top: 12px;">⚠️ 回滚将恢复原始数据，并清除人工改动标记</p>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeActionModal()">取消</button>
      <button class="btn btn-danger" onclick="submitRevert(${id})">确认回滚</button>
    </div>
  `;
  showActionModal('回滚操作', content);
}

function submitRevert(id) {
  const reason = document.getElementById('revert-reason').value;
  const operator = getOperator();

  fetch(`/api/records/${id}/revert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operator: operator,
      reason: reason
    })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert(result.message);
      closeActionModal();
      loadRecords();
    } else {
      alert('操作失败: ' + result.error);
    }
  })
  .catch(err => {
    alert('操作失败: ' + err.message);
  });
}

function showNoteUpdate(id) {
  const content = `
    <div class="form-group">
      <label>对账说明</label>
      <textarea id="note-content" placeholder="请填写对账说明，记录核对过程中的发现和处理方式"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeActionModal()">取消</button>
      <button class="btn btn-primary" onclick="submitNote(${id})">保存说明</button>
    </div>
  `;
  showActionModal('第三步：更新对账说明', content);
}

function submitNote(id) {
  const noteContent = document.getElementById('note-content').value;
  const operator = getOperator();

  if (!noteContent) {
    alert('请填写对账说明');
    return;
  }

  fetch(`/api/records/${id}/note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      note_content: noteContent,
      operator: operator
    })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert(result.message);
      closeActionModal();
      loadRecords();
    } else {
      alert('操作失败: ' + result.error);
    }
  })
  .catch(err => {
    alert('操作失败: ' + err.message);
  });
}

function handleImportTypeChange(e) {
  const type = e.target.value;
  document.getElementById('file-upload-area').style.display = type === 'file' ? 'block' : 'none';
}

function handleImport() {
  const importType = document.querySelector('input[name="import-type"]:checked').value;
  const operator = getOperator();

  if (importType === 'file') {
    if (!selectedFile) {
      alert('请选择要导入的文件');
      return;
    }
    importFromFile(selectedFile, operator);
  } else {
    importDemoData(operator);
  }
}

function importFromFile(file, operator) {
  const formData = new FormData();
  formData.append('custodian_file', file);
  formData.append('operator', operator);

  fetch('/api/records/import', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(result => {
    showImportResult(result);
  })
  .catch(err => {
    showImportResult({ success: false, error: err.message });
  });
}

function importDemoData(operator) {
  const demoRecords = [
    {
      original_line_number: 1,
      fund_code: 'PF001',
      fund_name: '私募精选1号',
      security_code: '600519',
      security_name: '贵州茅台',
      settlement_date: '2026-06-02',
      quantity: 1000,
      amount: 1680000
    },
    {
      original_line_number: 2,
      fund_code: 'PF001',
      fund_name: '私募精选1号',
      security_code: '000858',
      security_name: '五粮液',
      settlement_date: '2026-06-02',
      quantity: 2000,
      amount: 320000
    },
    {
      original_line_number: 3,
      fund_code: 'PF002',
      fund_name: '私募成长2号',
      security_code: '300750',
      security_name: '宁德时代',
      settlement_date: '2026-06-02',
      quantity: 500,
      amount: 1025000
    },
    {
      original_line_number: 4,
      fund_code: 'PF002',
      fund_name: '私募成长2号',
      security_code: '002594',
      security_name: '比亚迪',
      settlement_date: '2026-06-02',
      quantity: 800,
      amount: 208000
    },
    {
      original_line_number: 5,
      fund_code: 'PF001',
      fund_name: '私募精选1号',
      security_code: '601318',
      security_name: '中国平安',
      settlement_date: '2026-06-02',
      quantity: 3000,
      amount: 150000
    }
  ];

  fetch('/api/records/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      records: demoRecords,
      operator: operator
    })
  })
  .then(res => res.json())
  .then(result => {
    showImportResult(result);
  })
  .catch(err => {
    showImportResult({ success: false, error: err.message });
  });
}

function showImportResult(result) {
  const resultArea = document.getElementById('import-result');
  resultArea.style.display = 'block';
  resultArea.className = 'result-area ' + (result.success ? 'success' : 'error');

  if (result.success) {
    resultArea.innerHTML = `
      <h3>✅ 导入成功</h3>
      <p>批次号: <strong>${result.data.batch_id}</strong></p>
      <p>导入记录数: <strong>${result.data.count}</strong> 条</p>
      <p style="margin-top: 12px;">
        <button class="btn btn-primary" onclick="document.querySelector('.tab-btn[data-tab=records]').click(); loadRecords();">查看导入记录</button>
      </p>
    `;
  } else {
    resultArea.innerHTML = `
      <h3>❌ 导入失败</h3>
      <p>错误信息: ${result.error}</p>
    `;
  }
}

function exportData(format) {
  window.open(`/api/export/${format}`, '_blank');
}

function loadRules() {
  fetch('/api/rules')
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        renderRules(result.data);
      }
    });
}

function renderRules(data) {
  const container = document.getElementById('rules-content');
  const process = data.three_step_process;
  const t1t2 = data.t1_to_t2_handling;

  container.innerHTML = `
    <div class="rules-container">
      <h2>私募持仓穿透核对 - 边界规则</h2>

      <div class="rules-section">
        <h3>📍 核心三步流程</h3>
        <div class="flow-diagram">
          <div class="flow-step">1. 导入托管确认页</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step">2. 补看除权日截图</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step">3. 更新对账说明</div>
        </div>
        <div style="background: #f5f7fa; padding: 16px; border-radius: 6px; margin-top: 12px;">
          <p><strong>Step 1:</strong> ${process.step1.description}</p>
          <p><strong>Step 2:</strong> ${process.step2.description}</p>
          <p><strong>Step 3:</strong> ${process.step3.description}</p>
        </div>
      </div>

      <div class="rules-section">
        <h3>⚠️ T+1 → T+2 手工改动特殊处理规则</h3>
        <div style="background: #fdf6ec; padding: 16px; border-radius: 6px; border-left: 4px solid #e6a23c;">
          <p><strong>检测方式:</strong> ${t1t2.detection}</p>
          <p><strong>自动状态流转:</strong> ${t1t2.auto_status}</p>
          <p><strong>复核要求:</strong> <span style="color: #f56c6c; font-weight: bold;">${t1t2.required_review}</span></p>
          <p><strong>标记正常条件:</strong> ${t1t2.finalize_condition}</p>
          <p><strong>回滚机制:</strong> ${t1t2.revert}</p>
        </div>
        <div class="flow-diagram" style="margin-top: 16px;">
          <div class="flow-step">已导入</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step">补看截图</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step warning">待基金经理复核</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step success">复核通过</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step success">正常</div>
        </div>
        <p style="color: #f56c6c; margin-top: 8px;">❌ 禁止：T+1→T+2改动后跳过基金经理复核直接标记为正常</p>
      </div>

      <div class="rules-section">
        <h3>📋 状态定义</h3>
        <div style="margin-top: 12px;">
          ${data.status_definitions.map(s => `
            <span class="status-def">
              <span class="status-badge status-${s.code}">${s.label}</span>
              <small style="color: #909399; margin-left: 4px;">(${s.code})</small>
            </span>
          `).join('')}
        </div>
      </div>

      <div class="rules-section">
        <h3>🔄 允许的状态流转</h3>
        <div class="code-block">${JSON.stringify(data.transitions || {}, null, 2)}</div>
      </div>

      <div class="rules-section">
        <h3>📝 改动类型</h3>
        <ul style="margin-top: 12px; padding-left: 20px;">
          ${data.change_type_definitions.map(c => `
            <li style="margin-bottom: 8px;"><strong>${c.label}</strong> (${c.code})</li>
          `).join('')}
        </ul>
      </div>

      <div class="rules-section">
        <h3>🔙 回滚规则</h3>
        <ul style="margin-top: 12px; padding-left: 20px;">
          <li style="margin-bottom: 8px;">任何状态均可回滚至上一状态</li>
          <li style="margin-bottom: 8px;">回滚后自动恢复原始到账日、数量、金额</li>
          <li style="margin-bottom: 8px;">回滚后清除人工改动标记</li>
          <li style="margin-bottom: 8px;">所有历史日志保留，可追溯</li>
        </ul>
      </div>

      <div class="rules-section">
        <h3>🔍 数据一致性保证</h3>
        <ul style="margin-top: 12px; padding-left: 20px;">
          <li style="margin-bottom: 8px;">页面展示、API接口、文件导出读取同一份数据</li>
          <li style="margin-bottom: 8px;">统一数据服务层：<code>services/unified-data-service.js</code></li>
          <li style="margin-bottom: 8px;">所有人工改动均有日志记录，包含：字段、原值、新值、原因、操作员、时间、证据</li>
          <li style="margin-bottom: 8px;">原始行号永久保留，可回溯至托管确认页原始位置</li>
        </ul>
      </div>
    </div>
  `;
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});
