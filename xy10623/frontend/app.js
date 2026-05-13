const API_BASE = 'http://localhost:3001/api';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadDashboard();
    loadFilters();
});

function initNavigation() {
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            
            document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');
            
            const titles = {
                dashboard: '异常看板',
                calendar: '房源日历',
                checkout: '退房事件',
                assignments: '保洁派单',
                rework: '返工记录',
                materials: '物料管理',
                performance: '绩效评分',
                audit: '操作日志'
            };
            document.getElementById('page-title').textContent = titles[page];
            
            loadPageData(page);
        });
    });
}

function loadPageData(page) {
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'calendar':
            loadCalendar();
            break;
        case 'checkout':
            loadCheckoutEvents();
            break;
        case 'assignments':
            loadAssignments();
            break;
        case 'rework':
            loadReworkRecords();
            break;
        case 'materials':
            loadMaterials();
            loadMaterialConsumption();
            break;
        case 'performance':
            loadPerformance();
            break;
        case 'audit':
            loadAuditLogs();
            break;
    }
}

async function loadFilters() {
    try {
        const [properties, cleaners] = await Promise.all([
            fetch(`${API_BASE}/properties`).then(r => r.json()),
            fetch(`${API_BASE}/cleaners`).then(r => r.json())
        ]);
        
        const calPropertySelect = document.getElementById('cal-property-filter');
        const assignPropertySelect = document.getElementById('assign-property-filter');
        const assignCleanerSelect = document.getElementById('assign-cleaner-filter');
        
        properties.forEach(p => {
            calPropertySelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            assignPropertySelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        
        cleaners.forEach(c => {
            assignCleanerSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch(e) {
        console.error('加载筛选器失败', e);
    }
}

async function loadDashboard() {
    try {
        const data = await fetch(`${API_BASE}/dashboard`).then(r => r.json());
        
        document.getElementById('stat-pending').textContent = data.pendingAssignments || 0;
        document.getElementById('stat-rework').textContent = data.pendingReworks || 0;
        document.getElementById('stat-inprogress').textContent = data.inProgressReworks || 0;
        document.getElementById('stat-anomaly').textContent = data.materialAnomalies || 0;
        
        const complaintTable = document.getElementById('recent-complaints');
        complaintTable.innerHTML = (data.recentComplaints || []).map(c => `
            <tr>
                <td>${c.complaint_date}</td>
                <td>${c.complaint_type}</td>
                <td>${c.description.substring(0, 20)}...</td>
                <td><span class="status-badge status-${c.rework_status}">${getStatusText(c.rework_status)}</span></td>
            </tr>
        `).join('');
        
        const assignmentTable = document.getElementById('upcoming-assignments');
        assignmentTable.innerHTML = (data.upcomingAssignments || []).map(a => `
            <tr>
                <td>${a.scheduled_date}</td>
                <td>${a.property_name || '-'}</td>
                <td>${a.cleaner_name}</td>
                <td><span class="status-badge status-${a.status}">${getStatusText(a.status)}</span></td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载看板失败', e);
    }
}

async function loadCalendar() {
    try {
        const propertyId = document.getElementById('cal-property-filter').value;
        const startDate = document.getElementById('cal-start-date').value;
        const endDate = document.getElementById('cal-end-date').value;
        
        let url = `${API_BASE}/calendar?`;
        if (propertyId) url += `propertyId=${propertyId}&`;
        if (startDate) url += `startDate=${startDate}&`;
        if (endDate) url += `endDate=${endDate}`;
        
        const data = await fetch(url).then(r => r.json());
        
        const table = document.getElementById('calendar-table');
        table.innerHTML = data.map(c => `
            <tr>
                <td>${c.date}</td>
                <td>${c.property_name}</td>
                <td>${c.event_type === 'checkin' ? '入住' : '退房'}</td>
                <td>${c.guest_name || '-'}</td>
                <td>${c.check_in || c.check_out || '-'}</td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载日历失败', e);
    }
}

async function loadCheckoutEvents() {
    try {
        const data = await fetch(`${API_BASE}/checkout-events`).then(r => r.json());
        
        const table = document.getElementById('checkout-table');
        table.innerHTML = data.map(c => `
            <tr>
                <td>${c.checkout_date}</td>
                <td>${c.property_name}</td>
                <td>${c.guest_name || '-'}</td>
                <td>${c.actual_checkout_time || '-'}</td>
                <td>${getRoomConditionText(c.room_condition)}</td>
                <td>${c.damage_notes || '-'}</td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载退房事件失败', e);
    }
}

async function loadAssignments() {
    try {
        const status = document.getElementById('assign-status-filter').value;
        const propertyId = document.getElementById('assign-property-filter').value;
        const cleanerId = document.getElementById('assign-cleaner-filter').value;
        
        let url = `${API_BASE}/cleaning-assignments?`;
        if (status) url += `status=${status}&`;
        if (propertyId) url += `propertyId=${propertyId}&`;
        if (cleanerId) url += `cleanerId=${cleanerId}`;
        
        const data = await fetch(url).then(r => r.json());
        
        const table = document.getElementById('assignments-table');
        table.innerHTML = data.map(a => `
            <tr>
                <td>${a.scheduled_date}</td>
                <td>${a.property_name || '-'}</td>
                <td>${a.cleaner_name}</td>
                <td>${a.scheduled_time || '-'}</td>
                <td><span class="status-badge status-${a.status}">${getStatusText(a.status)}</span></td>
                <td>${a.quality_score || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editAssignment(${a.id}, '${a.status}', ${a.quality_score || 'null'}, '${a.inspection_notes || ''}')">
                        编辑
                    </button>
                </td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载派单失败', e);
    }
}

function editAssignment(id, status, score, notes) {
    document.getElementById('edit-assignment-id').value = id;
    document.getElementById('edit-assignment-status').value = status;
    document.getElementById('edit-assignment-score').value = score || '';
    document.getElementById('edit-assignment-notes').value = notes;
    
    new bootstrap.Modal(document.getElementById('editAssignmentModal')).show();
}

async function saveAssignment() {
    const id = document.getElementById('edit-assignment-id').value;
    const status = document.getElementById('edit-assignment-status').value;
    const quality_score = document.getElementById('edit-assignment-score').value;
    const inspection_notes = document.getElementById('edit-assignment-notes').value;
    
    try {
        await fetch(`${API_BASE}/cleaning-assignments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, quality_score, inspection_notes, modified_by: '管理员' })
        });
        
        bootstrap.Modal.getInstance(document.getElementById('editAssignmentModal')).hide();
        loadAssignments();
        loadDashboard();
        alert('保存成功！');
    } catch(e) {
        alert('保存失败！');
    }
}

async function loadReworkRecords() {
    try {
        const status = document.getElementById('rework-status-filter').value;
        const responsible = document.getElementById('rework-responsible-filter').value;
        const startDate = document.getElementById('rework-start-date').value;
        const endDate = document.getElementById('rework-end-date').value;
        
        let url = `${API_BASE}/rework-records?`;
        if (status) url += `status=${status}&`;
        if (responsible) url += `responsible_person=${encodeURIComponent(responsible)}&`;
        if (startDate) url += `startDate=${startDate}&`;
        if (endDate) url += `endDate=${endDate}`;
        
        const data = await fetch(url).then(r => r.json());
        
        const responsibleFilter = document.getElementById('rework-responsible-filter');
        const uniqueResponsible = [...new Set(data.map(r => r.responsible_person))];
        responsibleFilter.innerHTML = '<option value="">全部责任人</option>' + 
            uniqueResponsible.map(r => `<option value="${r}">${r}</option>`).join('');
        
        const table = document.getElementById('rework-table');
        table.innerHTML = data.map(r => `
            <tr>
                <td>${r.complaint_date}</td>
                <td>${r.property_name || '-'}</td>
                <td>${getSourceText(r.complaint_source)}</td>
                <td>${getComplaintTypeText(r.complaint_type)}</td>
                <td>${r.description.substring(0, 30)}...</td>
                <td>${r.responsible_person}</td>
                <td>${r.rework_assign_to || '-'}<br>${r.rework_scheduled_date || ''}</td>
                <td><span class="status-badge status-${r.rework_status}">${getStatusText(r.rework_status)}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editRework(${r.id}, '${r.rework_status}', '${r.rework_completion_date || ''}', '${r.resolution_notes || ''}')">
                        处理
                    </button>
                </td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载返工记录失败', e);
    }
}

async function showAddReworkModal() {
    try {
        const assignments = await fetch(`${API_BASE}/cleaning-assignments`).then(r => r.json());
        const select = document.getElementById('rework-assignment-id');
        select.innerHTML = assignments.map(a => 
            `<option value="${a.id}">${a.property_name || ''} - ${a.cleaner_name} (${a.scheduled_date})</option>`
        ).join('');
        
        document.getElementById('rework-date').value = new Date().toISOString().split('T')[0];
        
        new bootstrap.Modal(document.getElementById('addReworkModal')).show();
    } catch(e) {
        console.error('加载派单失败', e);
    }
}

async function saveRework() {
    const data = {
        cleaning_assignment_id: document.getElementById('rework-assignment-id').value,
        complaint_source: document.getElementById('rework-source').value,
        complaint_date: document.getElementById('rework-date').value,
        complaint_type: document.getElementById('rework-type').value,
        description: document.getElementById('rework-description').value,
        responsible_person: document.getElementById('rework-responsible').value,
        rework_assign_to: document.getElementById('rework-assign-to').value,
        rework_scheduled_date: document.getElementById('rework-scheduled-date').value,
        created_by: '管理员'
    };
    
    try {
        await fetch(`${API_BASE}/rework-records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        bootstrap.Modal.getInstance(document.getElementById('addReworkModal')).hide();
        loadReworkRecords();
        loadDashboard();
        alert('创建成功！');
    } catch(e) {
        alert('创建失败！');
    }
}

function editRework(id, status, completionDate, resolution) {
    document.getElementById('edit-rework-id').value = id;
    document.getElementById('edit-rework-status').value = status;
    document.getElementById('edit-rework-completion-date').value = completionDate;
    document.getElementById('edit-rework-resolution').value = resolution;
    
    new bootstrap.Modal(document.getElementById('editReworkModal')).show();
}

async function updateRework() {
    const id = document.getElementById('edit-rework-id').value;
    const data = {
        rework_status: document.getElementById('edit-rework-status').value,
        rework_completion_date: document.getElementById('edit-rework-completion-date').value,
        resolution_notes: document.getElementById('edit-rework-resolution').value
    };
    
    try {
        await fetch(`${API_BASE}/rework-records/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        bootstrap.Modal.getInstance(document.getElementById('editReworkModal')).hide();
        loadReworkRecords();
        loadDashboard();
        alert('更新成功！');
    } catch(e) {
        alert('更新失败！');
    }
}

function exportRework() {
    const status = document.getElementById('rework-status-filter').value;
    const responsible = document.getElementById('rework-responsible-filter').value;
    const startDate = document.getElementById('rework-start-date').value;
    const endDate = document.getElementById('rework-end-date').value;
    
    let url = `${API_BASE}/export/rework?`;
    if (status) url += `status=${status}&`;
    if (responsible) url += `responsible_person=${encodeURIComponent(responsible)}&`;
    if (startDate) url += `startDate=${startDate}&`;
    if (endDate) url += `endDate=${endDate}`;
    
    window.open(url, '_blank');
}

async function loadMaterials() {
    try {
        const data = await fetch(`${API_BASE}/materials`).then(r => r.json());
        
        const table = document.getElementById('materials-table');
        table.innerHTML = data.map(m => `
            <tr class="${m.stock_quantity < m.threshold ? 'table-danger' : ''}">
                <td>${m.name}</td>
                <td>${m.unit}</td>
                <td>${m.stock_quantity}</td>
                <td>${m.threshold}</td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载物料失败', e);
    }
}

async function loadMaterialConsumption() {
    try {
        const status = document.getElementById('material-status-filter').value;
        const url = status ? `${API_BASE}/material-consumption?status=${status}` : `${API_BASE}/material-consumption`;
        
        const data = await fetch(url).then(r => r.json());
        
        const table = document.getElementById('consumption-table');
        table.innerHTML = data.map(c => `
            <tr class="${c.status === 'anomaly' ? 'table-warning' : ''}">
                <td>${c.material_name}</td>
                <td>${c.cleaner_name}</td>
                <td>${c.quantity}</td>
                <td>${c.expected_quantity || '-'}</td>
                <td>${c.status === 'anomaly' ? '异常' : '正常'}</td>
                <td>${c.anomaly_notes || '-'}</td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载物料消耗失败', e);
    }
}

async function loadPerformance() {
    try {
        const data = await fetch(`${API_BASE}/performance`).then(r => r.json());
        
        const table = document.getElementById('performance-table');
        table.innerHTML = data.map(p => `
            <tr>
                <td>${p.cleaner_name}</td>
                <td>${p.month}</td>
                <td>${p.total_assignments}</td>
                <td>${p.completed_on_time}</td>
                <td>${p.avg_score || '-'}</td>
                <td>${p.rework_count || 0}</td>
                <td>${p.manual_adjustment || 0}</td>
                <td><strong>${p.final_score || '-'}</strong></td>
                <td>
                    ${p.id ? `<button class="btn btn-sm btn-outline-secondary" onclick="adjustPerformance(${p.id})">调整</button>` : '-'}
                </td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载绩效失败', e);
    }
}

function adjustPerformance(id) {
    const adjustment = prompt('请输入调整分数（正负数均可）:');
    const reason = prompt('请输入调整原因:');
    
    if (adjustment !== null && reason !== null) {
        fetch(`${API_BASE}/performance/${id}/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                manual_adjustment: parseInt(adjustment), 
                adjustment_reason: reason,
                adjusted_by: '管理员'
            })
        }).then(() => {
            loadPerformance();
            alert('调整成功！');
        });
    }
}

async function loadAuditLogs() {
    try {
        const data = await fetch(`${API_BASE}/audit-logs`).then(r => r.json());
        
        const table = document.getElementById('audit-table');
        table.innerHTML = data.map(a => `
            <tr>
                <td>${a.modified_at}</td>
                <td>${a.table_name}</td>
                <td>${a.record_id}</td>
                <td>${a.action}</td>
                <td><pre style="font-size:10px;max-width:200px;overflow:hidden">${a.old_values || '-'}</pre></td>
                <td><pre style="font-size:10px;max-width:200px;overflow:hidden">${a.new_values || '-'}</pre></td>
                <td>${a.modified_by || '-'}</td>
            </tr>
        `).join('');
    } catch(e) {
        console.error('加载日志失败', e);
    }
}

function showImportModal() {
    new bootstrap.Modal(document.getElementById('importModal')).show();
}

async function doImport() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择文件！');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE}/import`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        alert(`导入成功！共 ${result.count} 条记录。`);
        bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
    } catch(e) {
        alert('导入失败！');
    }
}

function exportData() {
    if (confirm('导出保洁派单数据？')) {
        window.open(`${API_BASE}/export/cleaning`, '_blank');
    }
}

function getStatusText(status) {
    const map = {
        pending: '待处理',
        in_progress: '进行中',
        completed: '已完成',
        needs_review: '需复审',
        assigned: '已分配'
    };
    return map[status] || status;
}

function getRoomConditionText(condition) {
    const map = { good: '良好', normal: '一般', dirty: '脏乱' };
    return map[condition] || condition;
}

function getSourceText(source) {
    const map = { guest: '客人投诉', inspection: '质检发现', other: '其他' };
    return map[source] || source;
}

function getComplaintTypeText(type) {
    const map = {
        cleanliness: '清洁不彻底',
        forgotten_items: '物品遗漏',
        odor: '异味',
        damage: '物品损坏',
        other: '其他'
    };
    return map[type] || type;
}
