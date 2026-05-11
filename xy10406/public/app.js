const API_BASE = '';

let currentPatient = null;
let currentPrescription = null;
let validationResult = null;
let pendingRequests = [];

document.addEventListener('DOMContentLoaded', function() {
    initRoleSwitch();
    initEventListeners();
    loadInventory();
    setDefaultDate();
});

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('exportDate').value = today;
}

function initRoleSwitch() {
    const clerkBtn = document.getElementById('clerkBtn');
    const pharmacistBtn = document.getElementById('pharmacistBtn');
    const clerkView = document.getElementById('clerkView');
    const pharmacistView = document.getElementById('pharmacistView');

    clerkBtn.addEventListener('click', function() {
        clerkBtn.classList.add('active');
        pharmacistBtn.classList.remove('active');
        clerkView.style.display = 'flex';
        pharmacistView.style.display = 'none';
        loadInventory();
    });

    pharmacistBtn.addEventListener('click', function() {
        pharmacistBtn.classList.add('active');
        clerkBtn.classList.remove('active');
        pharmacistView.style.display = 'flex';
        clerkView.style.display = 'none';
        loadPendingRequests();
        loadTodayStats();
    });
}

function initEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', searchPatients);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchPatients();
    });
    document.getElementById('refreshStockBtn').addEventListener('click', loadInventory);
    document.getElementById('refreshPendingBtn').addEventListener('click', loadPendingRequests);
    document.getElementById('exportBtn').addEventListener('click', exportDailyReport);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
}

async function fetchAPI(endpoint, options) {
    if (!options) options = {};
    const response = await fetch(API_BASE + endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return response.json();
}

function showToast(message, type) {
    if (!type) type = 'success';
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.style.display = 'block';
    setTimeout(function() {
        toast.style.display = 'none';
    }, 3000);
}

function openModal(title, body, onConfirm, confirmText) {
    if (!confirmText) confirmText = '确认';
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalConfirm').textContent = confirmText;

    document.getElementById('modalConfirm').onclick = async function() {
        const result = await onConfirm();
        if (result !== false) {
            closeModal();
        }
    };

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

async function searchPatients() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showToast('请输入搜索内容', 'error');
        return;
    }

    try {
        const patients = await fetchAPI('/api/patients');
        const filtered = patients.filter(function(p) {
            return p.name.includes(query) || p.id_card.includes(query);
        });
        renderPatientList(filtered);
    } catch (error) {
        showToast('搜索失败', 'error');
    }
}

function renderPatientList(patients) {
    const container = document.getElementById('patientList');
    
    if (patients.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">未找到匹配的患者</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < patients.length; i++) {
        const p = patients[i];
        html += '<div class="patient-card">' +
            '<div class="card-header">' +
                '<div>' +
                    '<div class="card-title">' + p.name + ' <span class="badge badge-info">' + p.gender + '</span></div>' +
                    '<div class="card-meta">身份证: ' + p.id_card + ' | 电话: ' + (p.phone || '未填写') + '</div>' +
                '</div>' +
                '<div>' + p.diseases.map(function(d) { return '<span class="badge badge-secondary">' + d + '</span>'; }).join(' ') + '</div>' +
            '</div>' +
            '<div class="card-actions">' +
                '<button onclick="loadPatientPrescriptions(\'' + p.id + '\')">查看处方</button>' +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

async function loadPatientPrescriptions(patientId) {
    currentPatient = patientId;
    try {
        const prescriptions = await fetchAPI('/api/patients/' + patientId + '/prescriptions');
        renderPrescriptions(prescriptions);
    } catch (error) {
        showToast('加载处方失败', 'error');
    }
}

function renderPrescriptions(prescriptions) {
    const section = document.getElementById('prescriptionSection');
    const container = document.getElementById('prescriptionList');
    section.style.display = 'block';

    if (prescriptions.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">该患者暂无处方</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < prescriptions.length; i++) {
        const p = prescriptions[i];
        const isExpired = new Date(p.expiry_date) < new Date();
        const refillsRemaining = p.total_refills - p.used_refills;
        const isRefillsExhausted = refillsRemaining <= 0;

        let statusBadge = '';
        if (isExpired) {
            statusBadge = '<span class="badge badge-danger">已过期</span>';
        } else {
            statusBadge = '<span class="badge badge-success">有效</span>';
        }
        if (isRefillsExhausted) {
            statusBadge += '<span class="badge badge-warning">次数用完</span>';
        }

        let itemsHtml = '<table class="medicine-table"><thead><tr><th>药品</th><th>规格</th><th>数量</th><th>用法</th><th>当前库存</th></tr></thead><tbody>';
        for (let j = 0; j < p.items.length; j++) {
            const item = p.items[j];
            const stockClass = item.stock < item.quantity ? 'stock-low' : 'stock-normal';
            const stockNote = item.stock < item.quantity ? '(不足)' : '';
            itemsHtml += '<tr>' +
                '<td>' + item.name + ' (' + item.generic_name + ')</td>' +
                '<td>' + item.specification + '</td>' +
                '<td>' + item.quantity + ' ' + item.unit + '</td>' +
                '<td>' + item.dosage + ' ' + item.frequency + '</td>' +
                '<td class="' + stockClass + '">' + item.stock + ' ' + item.unit + ' ' + stockNote + '</td>' +
            '</tr>';
        }
        itemsHtml += '</tbody></table>';

        html += '<div class="prescription-card">' +
            '<div class="card-header">' +
                '<div>' +
                    '<div class="card-title">' + p.diagnosis + ' ' + statusBadge + '</div>' +
                    '<div class="card-meta">医生: ' + p.doctor + ' | 开具日期: ' + p.issue_date + ' | 有效期至: ' + p.expiry_date + '</div>' +
                '</div>' +
                '<div><span class="badge badge-info">已用 ' + p.used_refills + '/' + p.total_refills + ' 次</span></div>' +
            '</div>' +
            '<div class="card-body">' + itemsHtml + '</div>' +
            '<div class="card-actions">' +
                '<button onclick="validateRefill(\'' + p.id + '\')">申请续配</button>' +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

async function validateRefill(prescriptionId) {
    currentPrescription = prescriptionId;
    try {
        const result = await fetchAPI('/api/refill-requests/validate', {
            method: 'POST',
            body: JSON.stringify({ prescription_id: prescriptionId })
        });
        validationResult = result;
        renderValidation(result);
    } catch (error) {
        showToast('验证失败', 'error');
    }
}

function renderValidation(result) {
    const section = document.getElementById('validationSection');
    const container = document.getElementById('validationResult');
    section.style.display = 'block';

    let html = '';

    if (result.issues.length > 0) {
        html += '<div class="validation-result error">' +
            '<h4>❌ 无法续配</h4>' +
            '<ul>';
        for (let i = 0; i < result.issues.length; i++) {
            html += '<li>' + result.issues[i].message + '</li>';
        }
        html += '</ul></div>';
    }

    if (result.warnings.length > 0) {
        html += '<div class="validation-result warning">' +
            '<h4>⚠️ 注意事项（需药师复核）</h4>' +
            '<ul>';
        for (let i = 0; i < result.warnings.length; i++) {
            html += '<li>' + result.warnings[i].message + '</li>';
        }
        html += '</ul></div>';
    }

    if (result.issues.length === 0) {
        html += '<div class="validation-result success">' +
            '<h4>✅ 可以续配</h4>' +
            '<p>处方有效，库存充足</p>';
        if (result.needs_pharmacist_review) {
            html += '<p style="margin-top: 0.5rem; color: #92400e;">⚠️ 存在注意事项，需提交药师复核</p>';
        }
        html += '</div>';
    }

    html += '<div class="card-actions" style="margin-top: 1rem;">';
    if (result.can_proceed) {
        const buttonText = result.needs_pharmacist_review ? '提交药师审核' : '确认续配';
        html += '<button onclick="submitRefillRequest()">' + buttonText + '</button>';
    }
    html += '<button class="secondary" onclick="document.getElementById(\'validationSection\').style.display=\'none\'">取消</button>' +
        '</div>';

    container.innerHTML = html;
}

async function submitRefillRequest() {
    try {
        await fetchAPI('/api/refill-requests', {
            method: 'POST',
            body: JSON.stringify({
                prescription_id: currentPrescription,
                patient_id: currentPatient
            })
        });

        if (validationResult.needs_pharmacist_review) {
            showToast('已提交药师审核');
        } else {
            showToast('续配申请已提交，请等待处理');
        }

        document.getElementById('validationSection').style.display = 'none';
        loadPatientPrescriptions(currentPatient);
        loadInventory();
    } catch (error) {
        showToast('提交失败', 'error');
    }
}

async function loadInventory() {
    try {
        const medicines = await fetchAPI('/api/medicines');
        renderInventory(medicines);
    } catch (error) {
        showToast('加载库存失败', 'error');
    }
}

function renderInventory(medicines) {
    const container = document.getElementById('inventoryList');
    let html = '';

    for (let i = 0; i < medicines.length; i++) {
        const m = medicines[i];
        let stockBadgeClass = 'badge-success';
        if (m.stock <= 5) stockBadgeClass = 'badge-danger';
        else if (m.stock <= 10) stockBadgeClass = 'badge-warning';

        html += '<div class="inventory-card">' +
            '<div class="card-header">' +
                '<div>' +
                    '<div class="card-title">' + m.name + ' <span class="badge badge-secondary">' + m.category + '</span></div>' +
                    '<div class="card-meta">' + m.generic_name + ' | ' + m.manufacturer + ' | ' + m.specification + '</div>' +
                '</div>' +
                '<div><span class="badge ' + stockBadgeClass + '">库存: ' + m.stock + ' ' + m.unit + '</span></div>' +
            '</div>' +
            '<div class="card-actions">' +
                '<button class="secondary" onclick="updateStock(\'' + m.id + '\', ' + m.stock + ')">调整库存</button>' +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

function updateStock(medicineId, currentStock) {
    openModal(
        '调整库存',
        '<label style="display: block; margin-bottom: 0.5rem; color: #374151;">当前库存: ' + currentStock + '</label>' +
        '<input type="number" id="newStock" value="' + currentStock + '" min="0" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">',
        async function() {
            const newStock = parseInt(document.getElementById('newStock').value);
            if (isNaN(newStock) || newStock < 0) {
                showToast('请输入有效的库存数量', 'error');
                return false;
            }

            try {
                await fetchAPI('/api/medicines/' + medicineId + '/stock', {
                    method: 'PUT',
                    body: JSON.stringify({ stock: newStock })
                });
                showToast('库存已更新');
                loadInventory();
                return true;
            } catch (error) {
                showToast('更新失败', 'error');
                return false;
            }
        },
        '确认'
    );
}

async function loadPendingRequests() {
    try {
        pendingRequests = await fetchAPI('/api/refill-requests/pending');
        document.getElementById('pendingCount').textContent = '待审核: ' + pendingRequests.length;
        renderPendingRequests(pendingRequests);
    } catch (error) {
        showToast('加载待审核列表失败', 'error');
    }
}

function renderPendingRequests(requests) {
    const container = document.getElementById('pendingList');

    if (requests.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">暂无待审核申请</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < requests.length; i++) {
        const r = requests[i];
        const now = new Date();
        const requestTime = new Date(r.request_date);
        const diffHours = (now - requestTime) / (1000 * 3600);
        const isUrgent = diffHours > 2;

        const cardClass = 'pending-card ' + (isUrgent ? 'urgent' : '');
        let urgentBadge = '';
        if (isUrgent) urgentBadge = '<span class="badge badge-danger">紧急</span>';

        let itemsHtml = '<table class="medicine-table"><thead><tr><th>药品</th><th>规格</th><th>数量</th><th>当前库存</th></tr></thead><tbody>';
        for (let j = 0; j < r.items.length; j++) {
            const item = r.items[j];
            const stockClass = item.current_stock < item.quantity ? 'stock-low' : 'stock-normal';
            const stockNote = item.current_stock < item.quantity ? '(不足)' : '';
            itemsHtml += '<tr>' +
                '<td>' + item.name + '</td>' +
                '<td>' + item.specification + '</td>' +
                '<td>' + item.quantity + ' ' + item.unit + '</td>' +
                '<td class="' + stockClass + '">' + item.current_stock + ' ' + item.unit + ' ' + stockNote + '</td>' +
            '</tr>';
        }
        itemsHtml += '</tbody></table>';

        html += '<div class="' + cardClass + '">' +
            '<div class="card-header">' +
                '<div>' +
                    '<div class="card-title">' + r.patient_name + ' ' + urgentBadge + '</div>' +
                    '<div class="card-meta">身份证: ' + r.patient_id_card + ' | 电话: ' + (r.patient_phone || '未填写') + '</div>' +
                '</div>' +
                '<div><span class="badge badge-warning">待审核</span></div>' +
            '</div>' +
            '<div class="card-body">' +
                '<p><strong>诊断:</strong> ' + r.diagnosis + '</p>' +
                '<p><strong>医生:</strong> ' + r.doctor + '</p>' +
                '<p><strong>申请时间:</strong> ' + new Date(r.request_date).toLocaleString('zh-CN') + '</p>' +
                '<p><strong>处方续配次数:</strong> 已用 ' + r.used_refills + '/' + r.total_refills + ' 次</p>' +
                itemsHtml +
            '</div>' +
            '<div class="card-actions">' +
                '<button class="success" onclick="approveRequest(\'' + r.id + '\')">通过</button>' +
                '<button class="danger" onclick="rejectRequest(\'' + r.id + '\')">拒绝</button>' +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

function approveRequest(requestId) {
    openModal(
        '确认通过',
        '<p>确定要通过该续配申请吗？确认后将扣减库存并更新处方续配次数。</p>',
        async function() {
            try {
                await fetchAPI('/api/refill-requests/' + requestId + '/approve', {
                    method: 'POST',
                    body: JSON.stringify({ reviewer_id: 'pharmacist' })
                });
                showToast('已通过');
                loadPendingRequests();
                loadTodayStats();
                return true;
            } catch (error) {
                showToast('操作失败', 'error');
                return false;
            }
        },
        '确认通过'
    );
}

function rejectRequest(requestId) {
    openModal(
        '拒绝申请',
        '<label style="display: block; margin-bottom: 0.5rem; color: #374151;">请输入拒绝原因:</label>' +
        '<textarea id="rejectReason" placeholder="例如: 处方过期、库存不足、药物相互作用等"></textarea>',
        async function() {
            const reason = document.getElementById('rejectReason').value.trim();
            if (!reason) {
                showToast('请输入拒绝原因', 'error');
                return false;
            }

            try {
                await fetchAPI('/api/refill-requests/' + requestId + '/reject', {
                    method: 'POST',
                    body: JSON.stringify({
                        reason: reason,
                        reviewer_id: 'pharmacist'
                    })
                });
                showToast('已拒绝');
                loadPendingRequests();
                loadTodayStats();
                return true;
            } catch (error) {
                showToast('操作失败', 'error');
                return false;
            }
        },
        '确认拒绝'
    );
}

async function loadTodayStats() {
    const date = document.getElementById('exportDate').value;
    try {
        const requests = await fetchAPI('/api/refill-requests?date=' + date);
        
        const approved = requests.filter(function(r) { return r.status === 'approved'; });
        const rejected = requests.filter(function(r) { return r.status === 'rejected'; });
        const pending = requests.filter(function(r) { return r.status === 'pending'; });

        document.getElementById('todayStats').innerHTML =
            '<div class="stat-card"><div class="stat-value" style="color: #667eea;">' + requests.length + '</div><div class="stat-label">总申请</div></div>' +
            '<div class="stat-card"><div class="stat-value" style="color: #10b981;">' + approved.length + '</div><div class="stat-label">已通过</div></div>' +
            '<div class="stat-card"><div class="stat-value" style="color: #ef4444;">' + rejected.length + '</div><div class="stat-label">已拒绝</div></div>' +
            '<div class="stat-card"><div class="stat-value" style="color: #f59e0b;">' + pending.length + '</div><div class="stat-label">待审核</div></div>';

        renderTodayList(requests);
        renderRejectionList(rejected);
    } catch (error) {
        showToast('加载统计失败', 'error');
    }
}

function renderTodayList(requests) {
    const container = document.getElementById('todayList');

    if (requests.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">今日暂无续配记录</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < requests.length; i++) {
        const r = requests[i];
        let statusBadge = '';
        if (r.status === 'approved') statusBadge = '<span class="badge badge-success">已通过</span>';
        else if (r.status === 'rejected') statusBadge = '<span class="badge badge-danger">已拒绝</span>';
        else statusBadge = '<span class="badge badge-warning">待审核</span>';

        let rejectionHtml = '';
        if (r.rejection_reason) {
            rejectionHtml = '<p style="color: #ef4444; margin-top: 0.5rem;"><strong>拒绝原因:</strong> ' + r.rejection_reason + '</p>';
        }
        let reviewerHtml = '';
        if (r.reviewer_id) {
            reviewerHtml = '<p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.875rem;">审核人: ' + r.reviewer_id + '</p>';
        }

        const itemsStr = r.items.map(function(i) { return i.name + ' x' + i.quantity; }).join(', ');

        html += '<div class="today-card">' +
            '<div class="card-header">' +
                '<div>' +
                    '<div class="card-title">' + r.patient_name + ' ' + statusBadge + '</div>' +
                    '<div class="card-meta">' + new Date(r.request_date).toLocaleString('zh-CN') + ' | 诊断: ' + r.diagnosis + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="card-body">' +
                '<p><strong>药品:</strong> ' + itemsStr + '</p>' +
                rejectionHtml +
                reviewerHtml +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

function renderRejectionList(rejected) {
    const container = document.getElementById('rejectionList');

    if (rejected.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">今日暂无拒绝记录</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < rejected.length; i++) {
        const r = rejected[i];
        html += '<div class="today-card" style="border-left-color: #ef4444;">' +
            '<div class="card-header">' +
                '<div class="card-title">' + r.patient_name + '</div>' +
                '<span class="badge badge-danger">已拒绝</span>' +
            '</div>' +
            '<div class="card-body">' +
                '<p><strong>拒绝原因:</strong> ' + r.rejection_reason + '</p>' +
                '<p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.875rem;">申请时间: ' + new Date(r.request_date).toLocaleString('zh-CN') + '</p>' +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

async function exportDailyReport() {
    const date = document.getElementById('exportDate').value;
    try {
        const result = await fetchAPI('/api/export/daily?date=' + date);
        
        const blob = new Blob(['\ufeff' + result.csv], { type: 'text/csv; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '续配清单_' + date + '.csv';
        a.click();
        URL.revokeObjectURL(url);

        showToast('导出成功');
    } catch (error) {
        showToast('导出失败', 'error');
    }
}
