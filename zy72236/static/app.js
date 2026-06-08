let currentBatchId = null;
let holidayAdjustments = [];

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(this.dataset.tab).classList.add('active');

        if (this.dataset.tab === 'overview') loadOverview();
        if (this.dataset.tab === 'import') loadBatchSelects();
        if (this.dataset.tab === 'holiday') loadBatchSelects();
        if (this.dataset.tab === 'balance') loadBatchSelects();
        if (this.dataset.tab === 'selfcheck') loadBatchSelects();
        if (this.dataset.tab === 'export') loadBatchSelects();
    });
});

window.onload = function() {
    loadOverview();
    loadBatchSelects();
};

async function loadOverview() {
    try {
        const [batchesRes, balanceRes] = await Promise.all([
            fetch('/api/batches'),
            fetch('/api/balance-summary')
        ]);
        const batches = await batchesRes.json();
        const balanceData = await balanceRes.json();

        document.getElementById('stat-batches').textContent = batches.length;
        document.getElementById('stat-completed').textContent = batches.filter(b => b.status === 'balance_updated').length;

        let pendingCount = 0;
        batches.forEach(b => {
            if (b.records) {
                b.records.forEach(r => {
                    if (r.needs_manager_review) pendingCount++;
                });
            }
        });
        document.getElementById('stat-pending').textContent = pendingCount;

        const tbody = document.getElementById('batches-table-body');
        tbody.innerHTML = batches.map(b => `
            <tr class="${b.status === 'needs_manager_review' ? 'warning-row' : ''}">
                <td>${b.batch_number}</td>
                <td>${new Date(b.import_date).toLocaleString()}</td>
                <td>${b.record_count}</td>
                <td>¥${b.total_amount.toFixed(2)}</td>
                <td>${getStatusBadge(b.status)}</td>
                <td>${b.holiday_reviewed ? '<span class="badge badge-success">已审核</span>' : '<span class="badge badge-warning">待审核</span>'}</td>
                <td>
                    <button class="btn-secondary btn-small" onclick="viewBatchRecords(${b.id})">查看</button>
                    <button class="btn-secondary btn-small" onclick="viewAuditTrail(${b.id})">审计</button>
                </td>
            </tr>
        `).join('');

        const balanceTbody = document.getElementById('balance-summary-body');
        if (balanceData.summary.length === 0) {
            balanceTbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无数据</td></tr>';
        } else {
            balanceTbody.innerHTML = balanceData.summary.map(s => `
                <tr>
                    <td>${s.manager_code}</td>
                    <td>${s.manager_name}</td>
                    <td>${s.confirmed_amount_display}</td>
                    <td style="color: #f5576c;">${s.pending_amount_display}</td>
                    <td><strong>${s.current_balance_display}</strong></td>
                    <td>${s.record_count}</td>
                </tr>
            `).join('');
        }

        const totalChanges = balanceData.summary.reduce((sum, s) => sum + s.record_count, 0);
        document.getElementById('stat-balance').textContent = totalChanges;
    } catch (e) {
        console.error('加载概览失败:', e);
    }
}

async function loadBatchSelects() {
    try {
        const res = await fetch('/api/batches');
        const batches = await res.json();
        const options = '<option value="">请选择批次</option>' +
            batches.map(b => `<option value="${b.id}">${b.batch_number} (${b.record_count}条)</option>`).join('');

        ['holiday-batch-select', 'balance-batch-select', 'selfcheck-batch-select', 'export-batch-select'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = options;
        });
    } catch (e) {
        console.error('加载批次列表失败:', e);
    }
}

async function importBatch() {
    const batchNumber = document.getElementById('batch-number').value;
    const importedBy = document.getElementById('imported-by').value;
    const fileInput = document.getElementById('import-file');

    if (!batchNumber) {
        showResult('import-result', '请输入批次号', 'error');
        return;
    }
    if (!fileInput.files.length) {
        showResult('import-result', '请选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('batch_number', batchNumber);
    formData.append('imported_by', importedBy);
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch('/api/batches/import', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        if (res.ok) {
            showResult('import-result', result.message, 'success');
            currentBatchId = result.batch_id;
            loadCurrentBatch();
            loadOverview();
            loadBatchSelects();
        } else {
            showResult('import-result', result.detail || '导入失败', 'error');
        }
    } catch (e) {
        showResult('import-result', '导入失败: ' + e.message, 'error');
    }
}

async function loadCurrentBatch() {
    if (!currentBatchId) return;

    try {
        const [batchRes, recordsRes, workflowRes] = await Promise.all([
            fetch(`/api/batches/${currentBatchId}`),
            fetch(`/api/batches/${currentBatchId}/records`),
            fetch(`/api/batches/${currentBatchId}/workflow`)
        ]);
        const batch = await batchRes.json();
        const recordsData = await recordsRes.json();
        const workflow = await workflowRes.json();

        document.getElementById('current-batch').innerHTML = `
            <div class="result-box info">
                <h4>批次信息</h4>
                <p><strong>批次号:</strong> ${batch.batch_number}</p>
                <p><strong>导入时间:</strong> ${new Date(batch.import_date).toLocaleString()}</p>
                <p><strong>记录数:</strong> ${batch.record_count}</p>
                <p><strong>总金额:</strong> ¥${batch.total_amount.toFixed(2)}</p>
            </div>
            <div class="workflow-steps">
                ${workflow.steps.map((step, idx) => `
                    <div class="workflow-step ${idx < workflow.current_step ? 'completed' : idx === workflow.current_step ? 'current' : 'pending'}">
                        <div class="step-number">${idx + 1}</div>
                        <div class="step-name">${step.step_name}</div>
                        <div class="step-status">${step.status === 'completed' ? '已完成' : step.status === 'in_progress' ? '进行中' : '待处理'}</div>
                    </div>
                `).join('')}
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                    <th>原始行号</th>
                    <th>基金代码</th>
                    <th>客户姓名</th>
                    <th>审批人</th>
                    <th>交易金额</th>
                    <th>最终金额</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
                </thead>
                <tbody>
                    ${recordsData.records.map(r => `
                        <tr class="${r.needs_manager_review || (r.is_duplicate && !r.duplicate_resolved) ? 'warning-row' : ''}">
                            <td>${r.original_line_number}</td>
                            <td>${r.fund_code}</td>
                            <td>${r.customer_name}</td>
                            <td>${r.approval_name}${r.approval_name_is_pinyin ? ' <span class="badge badge-warning">拼音</span>' : ''}</td>
                            <td>¥${r.transaction_amount.toFixed(2)}</td>
                            <td>¥${r.final_amount.toFixed(2)}</td>
                            <td>${getStatusBadge(r.status)}</td>
                            <td>
                                <button class="btn-secondary btn-small" onclick="viewRecordDetail(${r.id})">详情</button>
                                ${r.needs_manager_review ? `<button class="btn-primary btn-small" onclick="reviewRecord(${r.id})">复核</button>` : ''}
                                ${r.is_duplicate && !r.duplicate_resolved ? `<button class="btn-primary btn-small" onclick="resolveDuplicate(${r.id})">处理重复</button>` : ''}
                                ${r.duplicate_resolved ? '<span class="badge badge-success">已处理</span>' : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        console.error('加载批次详情失败:', e);
    }
}

function addAdjustment() {
    const originalDate = document.getElementById('adj-original-date').value;
    const adjustedDate = document.getElementById('adj-adjusted-date').value;
    const reason = document.getElementById('adj-reason').value;

    if (!originalDate || !adjustedDate || !reason) {
        alert('请填写完整的调整信息');
        return;
    }

    holidayAdjustments.push({original_date: originalDate, adjusted_date: adjustedDate, reason: reason});

    const container = document.getElementById('holiday-adjustments');
    const div = document.createElement('div');
    div.className = 'result-box info';
    div.innerHTML = `
        <strong>调整:</strong> ${originalDate} → ${adjustedDate}<br>
        <strong>原因:</strong> ${reason}
        <button class="btn-danger btn-small" style="float:right" onclick="this.parentElement.remove(); holidayAdjustments = holidayAdjustments.filter(a => a.original_date !== '${originalDate}')">删除</button>
    `;
    container.appendChild(div);

    document.getElementById('adj-original-date').value = '';
    document.getElementById('adj-adjusted-date').value = '';
    document.getElementById('adj-reason').value = '';
}

async function submitHolidayReview() {
    const batchId = document.getElementById('holiday-batch-select').value;
    if (!batchId) {
        showResult('holiday-result', '请选择批次', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/batches/${batchId}/holiday-review`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                reviewed_by: '老秦',
                adjustments: holidayAdjustments
            })
        });
        const result = await res.json();

        if (res.ok) {
            showResult('holiday-result', result.message, 'success');
            holidayAdjustments = [];
            loadWorkflowStatus();
            loadOverview();
        } else {
            showResult('holiday-result', result.detail || '审核失败', 'error');
        }
    } catch (e) {
        showResult('holiday-result', '审核失败: ' + e.message, 'error');
    }
}

async function loadWorkflowStatus() {
    const batchId = document.getElementById('holiday-batch-select').value;
    if (!batchId) return;

    try {
        const res = await fetch(`/api/batches/${batchId}/workflow`);
        const workflow = await res.json();

        document.getElementById('workflow-status').innerHTML = `
            <div class="workflow-steps">
                ${workflow.steps.map((step, idx) => `
                    <div class="workflow-step ${idx < workflow.current_step ? 'completed' : idx === workflow.current_step ? 'current' : 'pending'}">
                        <div class="step-number">${idx + 1}</div>
                        <div class="step-name">${step.step_name}</div>
                        <div class="step-status">${step.status === 'completed' ? '已完成' : step.status === 'in_progress' ? '进行中' : '待处理'}</div>
                        ${step.completed_at ? `<div class="step-status">${new Date(step.completed_at).toLocaleString()}</div>` : ''}
                        ${step.performed_by ? `<div class="step-status">操作人: ${step.performed_by}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="result-box ${workflow.overall_status === 'completed' ? 'success' : workflow.overall_status === 'needs_manager_review' ? 'error' : 'info'}">
                <strong>总体状态:</strong> ${getOverallStatusText(workflow.overall_status)}
            </div>
        `;
    } catch (e) {
        console.error('加载工作流状态失败:', e);
    }
}

async function loadBalanceChanges() {
    const batchId = document.getElementById('balance-batch-select').value;
    const includePending = document.getElementById('include-pending').checked;
    const managerFilter = document.getElementById('filter-manager').value;

    if (!batchId) return;

    try {
        const url = `/api/balance-changes?batch_id=${batchId}&include_pending=${includePending}`;
        const res = await fetch(url);
        const data = await res.json();

        let changes = data.changes;
        if (managerFilter) {
            changes = changes.filter(c => c.manager_code.includes(managerFilter) || c.manager_name.includes(managerFilter));
        }

        const tbody = document.getElementById('balance-changes-body');
        if (changes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">暂无余额变化记录</td></tr>';
        } else {
            tbody.innerHTML = changes.map(c => `
                <tr class="${c.is_pending_confirmation ? 'warning-row' : ''}">
                    <td>${c.manager_name} (${c.manager_code})</td>
                    <td>${c.change_type === 'credit' ? '增加' : '减少'}</td>
                    <td style="color: ${c.change_type === 'credit' ? '#28a745' : '#dc3545'}; font-weight: bold;">${c.amount_display}</td>
                    <td>${c.balance_before_display}</td>
                    <td>${c.balance_after_display}</td>
                    <td><span class="badge ${c.source_type === 'clearing_batch' ? 'badge-info' : c.source_type === 'holiday_adjustment' ? 'badge-warning' : 'badge-secondary'}">${c.source_label}</span></td>
                    <td>${c.source_reference}</td>
                    <td>${c.is_pending_confirmation ? '<span class="badge badge-warning">待确认</span>' : '<span class="badge badge-success">已确认</span>'}</td>
                    <td>${new Date(c.recorded_at).toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('加载余额变化失败:', e);
    }
}

async function updateBalance() {
    const batchId = document.getElementById('balance-batch-select').value;
    if (!batchId) {
        alert('请选择批次');
        return;
    }

    try {
        const checkRes = await fetch(`/api/batches/${batchId}/can-balance-update`);
        const check = await checkRes.json();

        if (!check.can_proceed) {
            let msg = '无法更新余额，请先处理以下问题：\n\n';
            check.issues.forEach(issue => {
                msg += '• ' + issue + '\n';
            });
            msg += '\n操作提示：\n';
            if (check.duplicate_count > 0) {
                msg += '→ 重复记录：请到"导入清算批次"页面，点击重复记录的"处理重复"按钮\n';
            }
            if (check.pending_review_count > 0) {
                msg += '→ 审批人拼音：请到"导入清算批次"页面，点击待复核记录的"复核"按钮\n';
            }
            alert(msg);
            return;
        }

        const res = await fetch(`/api/batches/${batchId}/balance-update`, {
            method: 'POST'
        });
        const result = await res.json();

        if (res.ok) {
            alert(result.message);
            loadBalanceChanges();
            loadOverview();
        } else {
            alert('更新失败: ' + (result.detail || result.message));
        }
    } catch (e) {
        alert('更新失败: ' + e.message);
    }
}

async function runSelfCheck() {
    const batchId = document.getElementById('selfcheck-batch-select').value;
    if (!batchId) {
        alert('请选择批次');
        return;
    }

    try {
        const res = await fetch(`/api/batches/${batchId}/self-check`);
        const report = await res.json();

        document.getElementById('selfcheck-result').innerHTML = `
            <div class="result-box ${report.failed_checks > 0 ? 'error' : 'success'}">
                <strong>自检结果:</strong> ${report.passed_checks}/${report.total_checks} 通过
                ${report.failed_checks > 0 ? `，${report.failed_checks} 项需处理` : ''}
            </div>
            ${report.results.map(r => `
                <div class="self-check-item ${r.passed ? 'passed' : 'failed'}">
                    <div class="check-status">${r.passed ? '✓ 通过' : '✗ 未通过'} - ${r.check_name}</div>
                    <div class="check-message">${r.message}</div>
                    ${r.details ? `<div class="check-details">${r.details.replace(/\n/g, '<br>')}</div>` : ''}
                    ${r.affected_record_ids ? `<div class="check-details">影响记录ID: ${r.affected_record_ids}</div>` : ''}
                </div>
            `).join('')}
        `;
    } catch (e) {
        document.getElementById('selfcheck-result').innerHTML = `
            <div class="result-box error">自检失败: ${e.message}</div>
        `;
    }
}

async function exportExcel() {
    const batchId = document.getElementById('export-batch-select').value;
    if (!batchId) {
        alert('请选择批次');
        return;
    }
    window.location.href = `/api/batches/${batchId}/export/excel`;
}

async function exportCSV() {
    const batchId = document.getElementById('export-batch-select').value;
    if (!batchId) {
        alert('请选择批次');
        return;
    }
    window.location.href = `/api/batches/${batchId}/export/csv`;
}

async function verifyExport() {
    const batchId = document.getElementById('export-batch-select').value;
    if (!batchId) {
        alert('请选择批次');
        return;
    }

    try {
        const res = await fetch(`/api/batches/${batchId}/export/verify`);
        const result = await res.json();

        if (result.consistent) {
            showResult('export-result', `数据一致，共${result.total_records}条记录，其中${result.pinyin_records}条拼音审批人记录`, 'success');
        } else {
            showResult('export-result', '数据不一致:\n' + result.issues.join('\n'), 'error');
        }
    } catch (e) {
        showResult('export-result', '验证失败: ' + e.message, 'error');
    }
}

document.getElementById('export-batch-select').addEventListener('change', async function() {
    const batchId = this.value;
    if (!batchId) {
        document.getElementById('records-body').innerHTML = '<tr><td colspan="12" class="text-center">请选择批次查看记录</td></tr>';
        return;
    }

    try {
        const res = await fetch(`/api/batches/${batchId}/records`);
        const data = await res.json();

        document.getElementById('records-body').innerHTML = data.records.map(r => `
            <tr class="${r.needs_manager_review || (r.is_duplicate && !r.duplicate_resolved) ? 'warning-row' : ''}">
                <td>${r.original_line_number}</td>
                <td>${r.fund_code}</td>
                <td>${r.customer_name}</td>
                <td>${r.manager_name}</td>
                <td>${r.approval_name}${r.approval_name_is_pinyin ? ' <span class="badge badge-warning">拼音</span>' : ''}</td>
                <td>${r.transaction_date}</td>
                <td>${r.settlement_date}</td>
                <td>¥${r.transaction_amount.toFixed(2)}</td>
                <td>¥${r.final_amount.toFixed(2)}</td>
                <td><span class="badge ${r.source_type === 'clearing_batch' ? 'badge-info' : r.source_type === 'holiday_adjustment' ? 'badge-warning' : 'badge-secondary'}">${getSourceLabel(r.source_type)}</span></td>
                <td>${getStatusBadge(r.status)}</td>
                <td>
                    <button class="btn-secondary btn-small" onclick="viewRecordDetail(${r.id})">详情</button>
                    <button class="btn-secondary btn-small" onclick="viewAuditTrail(${r.id}, true)">审计</button>
                    ${r.is_duplicate && !r.duplicate_resolved ? `<button class="btn-primary btn-small" onclick="resolveDuplicate(${r.id})">处理重复</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('加载记录失败:', e);
    }
});

async function viewRecordDetail(recordId) {
    try {
        const res = await fetch(`/api/records/${recordId}/audit`);
        const data = await res.json();

        const batchRes = await fetch(`/api/batches`);
        const batches = await batchRes.json();
        const batchRecords = [];
        batches.forEach(b => {
            b.records?.forEach(r => {
                if (r.id === recordId) batchRecords.push(r);
            });
        });
        const record = batchRecords[0];

        if (record) {
            document.getElementById('record-detail').innerHTML = `
                <h3>基本信息</h3>
                <div class="record-detail-grid">
                    <div class="detail-item"><div class="detail-label">原始行号</div><div class="detail-value">${record.original_line_number}</div></div>
                    <div class="detail-item"><div class="detail-label">基金代码</div><div class="detail-value">${record.fund_code}</div></div>
                    <div class="detail-item"><div class="detail-label">基金名称</div><div class="detail-value">${record.fund_name}</div></div>
                    <div class="detail-item"><div class="detail-label">客户姓名</div><div class="detail-value">${record.customer_name}</div></div>
                    <div class="detail-item"><div class="detail-label">客户经理</div><div class="detail-value">${record.manager_name}</div></div>
                    <div class="detail-item"><div class="detail-label">审批人</div><div class="detail-value">${record.approval_name}${record.approval_name_is_pinyin ? ' <span class="badge badge-warning">拼音</span>' : ''}</div></div>
                    <div class="detail-item"><div class="detail-label">交易日期</div><div class="detail-value">${record.transaction_date}</div></div>
                    <div class="detail-item"><div class="detail-label">清算日期</div><div class="detail-value">${record.settlement_date}</div></div>
                    <div class="detail-item"><div class="detail-label">原清算日期</div><div class="detail-value">${record.original_settlement_date}</div></div>
                    <div class="detail-item"><div class="detail-label">交易金额</div><div class="detail-value">¥${record.transaction_amount.toFixed(2)}</div></div>
                    <div class="detail-item"><div class="detail-label">尾佣金额</div><div class="detail-value">¥${record.trail_commission_amount.toFixed(2)}</div></div>
                    <div class="detail-item"><div class="detail-label">最终金额</div><div class="detail-value">¥${record.final_amount.toFixed(2)}</div></div>
                    <div class="detail-item"><div class="detail-label">拆分比例</div><div class="detail-value">${record.split_ratio}</div></div>
                    <div class="detail-item"><div class="detail-label">数据来源</div><div class="detail-value">${getSourceLabel(record.source_type)}</div></div>
                    <div class="detail-item"><div class="detail-label">状态</div><div class="detail-value">${getStatusBadge(record.status)}</div></div>
                    <div class="detail-item"><div class="detail-label">余额更新</div><div class="detail-value">${record.balance_updated ? '是' : '否'}</div></div>
                </div>
                <h3>审计追踪</h3>
                ${data.audit_logs.map(log => `
                    <div class="audit-log">
                        <span class="log-time">${new Date(log.performed_at).toLocaleString()}</span>
                        <span class="log-action">${log.action}</span>
                        ${log.field_name ? `<span>字段: ${log.field_name}</span>` : ''}
                        ${log.old_value ? `<span>${log.old_value} → ${log.new_value}</span>` : ''}
                        <span style="margin-left:10px">操作人: ${log.performed_by}</span>
                        ${log.notes ? `<div style="margin-top:5px;">${log.notes}</div>` : ''}
                    </div>
                `).join('')}
            `;
            document.getElementById('record-modal').style.display = 'block';
        }
    } catch (e) {
        alert('加载记录详情失败: ' + e.message);
    }
}

async function viewAuditTrail(id, isRecord = false) {
    const url = isRecord ? `/api/records/${id}/audit` : `/api/batches/${id}/audit`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const logs = data.audit_logs || [];

        document.getElementById('record-detail').innerHTML = `
            <h3>${isRecord ? '记录' : '批次'}审计追踪</h3>
            ${logs.map(log => `
                <div class="audit-log">
                    <span class="log-time">${new Date(log.performed_at).toLocaleString()}</span>
                    <span class="log-action">${log.action}</span>
                    ${log.field_name ? `<span>字段: ${log.field_name}</span>` : ''}
                    ${log.old_value ? `<span>${log.old_value} → ${log.new_value}</span>` : ''}
                    <span style="margin-left:10px">操作人: ${log.performed_by}</span>
                    ${log.notes ? `<div style="margin-top:5px;">${log.notes}</div>` : ''}
                </div>
            `).join('')}
        `;
        document.getElementById('record-modal').style.display = 'block';
    } catch (e) {
        alert('加载审计日志失败: ' + e.message);
    }
}

async function reviewRecord(recordId) {
    const reviewedBy = prompt('请输入复核人姓名:');
    if (!reviewedBy) return;

    const approved = confirm('确认通过该记录？确定=通过，取消=拒绝');

    try {
        const res = await fetch(`/api/records/${recordId}/manager-review?reviewed_by=${encodeURIComponent(reviewedBy)}&approved=${approved}`, {
            method: 'POST'
        });
        const result = await res.json();

        if (res.ok) {
            alert('复核完成');
            loadCurrentBatch();
            loadOverview();
            closeModal();
        } else {
            alert('复核失败: ' + (result.detail || '未知错误'));
        }
    } catch (e) {
        alert('复核失败: ' + e.message);
    }
}

async function resolveDuplicate(recordId) {
    const action = confirm('该记录被标记为重复。\n\n确定 = 确认跳过（不参与余额计算）\n取消 = 保留该记录（按非重复处理）') ? 'skip' : 'keep';
    const resolvedBy = prompt('请输入处理人姓名:');
    if (!resolvedBy) return;

    try {
        const res = await fetch(`/api/records/${recordId}/resolve-duplicate?action=${action}&resolved_by=${encodeURIComponent(resolvedBy)}`, {
            method: 'POST'
        });
        const result = await res.json();

        if (res.ok) {
            alert(action === 'skip' ? '已确认跳过该重复记录' : '已保留该记录为非重复');
            loadCurrentBatch();
            loadOverview();
            closeModal();
        } else {
            alert('处理失败: ' + (result.detail || '未知错误'));
        }
    } catch (e) {
        alert('处理失败: ' + e.message);
    }
}

async function viewBatchRecords(batchId) {
    currentBatchId = batchId;
    document.querySelector('[data-tab="import"]').click();
    loadCurrentBatch();
}

function closeModal() {
    document.getElementById('record-modal').style.display = 'none';
}

function showResult(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.innerHTML = `<div class="result-box ${type}">${message}</div>`;
}

function getStatusBadge(status) {
    const badges = {
        'imported': '<span class="badge badge-info">已导入</span>',
        'pending_review': '<span class="badge badge-warning">待审核</span>',
        'approved': '<span class="badge badge-success">已通过</span>',
        'holiday_adjusted': '<span class="badge badge-info">节假日已调整</span>',
        'balance_updated': '<span class="badge badge-success">余额已更新</span>',
        'needs_manager_review': '<span class="badge badge-warning">待经理复核</span>',
        'rejected': '<span class="badge badge-danger">已拒绝</span>'
    };
    return badges[status] || `<span class="badge badge-secondary">${status}</span>`;
}

function getOverallStatusText(status) {
    const texts = {
        'pending': '待处理',
        'in_progress': '进行中',
        'completed': '已完成',
        'needs_manager_review': '待客户经理复核',
        'not_found': '未找到'
    };
    return texts[status] || status;
}

function getSourceLabel(source) {
    const labels = {
        'clearing_batch': '清算批次导入',
        'manual_entry': '手工录入',
        'holiday_adjustment': '节假日调整'
    };
    return labels[source] || source;
}

window.onclick = function(event) {
    const modal = document.getElementById('record-modal');
    if (event.target === modal) {
        closeModal();
    }
};
