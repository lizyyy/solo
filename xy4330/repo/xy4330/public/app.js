// 全局变量
let currentArtifactId = null;
let customers = [];
let artifacts = [];

// DOM 元素
const modals = {
    artifact: document.getElementById('artifact-modal'),
    artifactDetail: document.getElementById('artifact-detail-modal'),
    customer: document.getElementById('customer-modal'),
    reminder: document.getElementById('reminder-modal')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModals();
    initForms();
    loadData();
});

// 导航切换
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// 模态框初始化
function initModals() {
    // 关闭按钮
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            hideAllModals();
        });
    });

    // 点击模态框外部关闭
    Object.values(modals).forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideAllModals();
            }
        });
    });

    // 取消按钮
    document.getElementById('cancel-artifact-btn')?.addEventListener('click', () => hideModal('artifact'));
    document.getElementById('cancel-customer-btn')?.addEventListener('click', () => hideModal('customer'));
    document.getElementById('cancel-reminder-btn')?.addEventListener('click', () => hideModal('reminder'));

    // 新增按钮
    document.getElementById('new-artifact-btn')?.addEventListener('click', () => showNewArtifactModal());
    document.getElementById('add-artifact-btn')?.addEventListener('click', () => showNewArtifactModal());
    document.getElementById('add-customer-btn')?.addEventListener('click', () => showNewCustomerModal());
    document.getElementById('add-reminder-btn')?.addEventListener('click', () => showNewReminderModal());

    // 导出按钮
    document.getElementById('export-csv-btn')?.addEventListener('click', exportCSV);

    // 筛选器
    document.getElementById('status-filter')?.addEventListener('change', loadArtifacts);
    document.getElementById('special-filter')?.addEventListener('change', loadArtifacts);
    document.getElementById('reminder-status-filter')?.addEventListener('change', loadReminders);

    // 详情页标签切换
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.detailTab;
            
            document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById('detail-' + tabId).classList.add('active');
        });
    });
}

// 表单初始化
function initForms() {
    // 器物表单
    document.getElementById('artifact-form')?.addEventListener('submit', handleArtifactSubmit);
    
    // 客户表单
    document.getElementById('customer-form')?.addEventListener('submit', handleCustomerSubmit);
    
    // 提醒表单
    document.getElementById('reminder-form')?.addEventListener('submit', handleReminderSubmit);
    
    // 照片上传表单
    document.getElementById('photo-upload-form')?.addEventListener('submit', handlePhotoUpload);
    
    // 状态更新表单
    document.getElementById('status-update-form')?.addEventListener('submit', handleStatusUpdate);
    
    // 报价添加表单
    document.getElementById('quote-add-form')?.addEventListener('submit', handleQuoteAdd);
    
    // 详情页按钮
    document.getElementById('edit-artifact-btn')?.addEventListener('click', editCurrentArtifact);
    document.getElementById('change-status-btn')?.addEventListener('click', () => {
        document.querySelector('.detail-tab[data-detail-tab="status"]')?.click();
    });
    document.getElementById('export-markdown-btn')?.addEventListener('click', exportMarkdown);
}

// 加载所有数据
async function loadData() {
    await Promise.all([
        loadCustomers(),
        loadArtifacts(),
        loadReminders()
    ]);
    updateDashboard();
}

// 加载客户列表
async function loadCustomers() {
    try {
        const response = await fetch('/api/customers');
        customers = await response.json();
        renderCustomers();
        updateCustomerSelects();
    } catch (error) {
        console.error('加载客户失败:', error);
    }
}

// 加载器物列表
async function loadArtifacts() {
    try {
        let url = '/api/artifacts';
        const params = new URLSearchParams();
        
        const statusFilter = document.getElementById('status-filter')?.value;
        const specialFilter = document.getElementById('special-filter')?.value;
        
        if (statusFilter) {
            params.append('status', statusFilter);
        }
        
        if (specialFilter === 'overdue') {
            params.append('overdue', 'true');
        } else if (specialFilter === 'pending_confirmation') {
            params.append('pending_confirmation', 'true');
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        artifacts = await response.json();
        renderArtifacts();
    } catch (error) {
        console.error('加载器物失败:', error);
    }
}

// 加载提醒列表
async function loadReminders() {
    try {
        let url = '/api/reminders';
        const statusFilter = document.getElementById('reminder-status-filter')?.value;
        
        if (statusFilter) {
            url += '?status=' + encodeURIComponent(statusFilter);
        }
        
        const response = await fetch(url);
        const reminders = await response.json();
        renderReminders(reminders);
    } catch (error) {
        console.error('加载提醒失败:', error);
    }
}

// 更新工作台数据
function updateDashboard() {
    const pendingCount = artifacts.filter(a => a.current_status === '待评估').length;
    const repairingCount = artifacts.filter(a => a.current_status === '修复中').length;
    const confirmCount = artifacts.filter(a => a.current_status === '待客户确认').length;
    
    const today = new Date().toISOString().split('T')[0];
    const overdueCount = artifacts.filter(a => {
        return a.estimated_completion_date && 
               a.estimated_completion_date < today && 
               a.current_status !== '已交付';
    }).length;
    
    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-repairing').textContent = repairingCount;
    document.getElementById('stat-confirm').textContent = confirmCount;
    document.getElementById('stat-overdue').textContent = overdueCount;
    
    renderRecentActivities();
}

// 渲染最近活动
function renderRecentActivities() {
    const container = document.getElementById('recent-list');
    if (!container) return;
    
    // 按更新时间排序，取最近5个
    const sorted = [...artifacts].sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
    ).slice(0, 5);
    
    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无修复进度</p></div>';
        return;
    }
    
    container.innerHTML = sorted.map(artifact => `
        <div class="activity-item" onclick="showArtifactDetail(${artifact.id})">
            <div class="activity-header">
                <span class="activity-title">${artifact.name}</span>
                <span class="activity-date">${formatDate(artifact.updated_at)}</span>
            </div>
            <div class="activity-description">
                当前状态：<span class="status-badge ${artifact.current_status}">${artifact.current_status}</span>
                ${artifact.customer_name ? ' | 客户：' + artifact.customer_name : ''}
            </div>
        </div>
    `).join('');
}

// 渲染客户列表
function renderCustomers() {
    const container = document.getElementById('customers-list');
    if (!container) return;
    
    if (customers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无客户数据</p></div>';
        return;
    }
    
    container.innerHTML = customers.map(customer => `
        <div class="customer-card">
            <div class="customer-header">
                <span class="customer-name">${customer.name}</span>
            </div>
            <div class="customer-info">
                ${customer.phone ? `<div class="info-item"><span class="info-label">电话</span><span class="info-value">${customer.phone}</span></div>` : ''}
                ${customer.email ? `<div class="info-item"><span class="info-label">邮箱</span><span class="info-value">${customer.email}</span></div>` : ''}
                ${customer.address ? `<div class="info-item"><span class="info-label">地址</span><span class="info-value">${customer.address}</span></div>` : ''}
                ${customer.notes ? `<div class="info-item"><span class="info-label">备注</span><span class="info-value">${customer.notes}</span></div>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn btn-secondary btn-small" onclick="editCustomer(${customer.id})">编辑</button>
                <button class="btn btn-danger btn-small" onclick="deleteCustomer(${customer.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// 渲染器物列表
function renderArtifacts() {
    const container = document.getElementById('artifacts-list');
    if (!container) return;
    
    if (artifacts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无器物数据</p></div>';
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    container.innerHTML = artifacts.map(artifact => {
        const isOverdue = artifact.estimated_completion_date && 
                          artifact.estimated_completion_date < today && 
                          artifact.current_status !== '已交付';
        
        return `
        <div class="artifact-card">
            <div class="artifact-header">
                <span class="artifact-name">${artifact.name}</span>
                <span class="status-badge ${artifact.current_status}">${artifact.current_status}</span>
            </div>
            <div class="artifact-info">
                ${artifact.customer_name ? `<div class="info-item"><span class="info-label">客户</span><span class="info-value">${artifact.customer_name}</span></div>` : ''}
                ${artifact.type ? `<div class="info-item"><span class="info-label">类型</span><span class="info-value">${artifact.type}</span></div>` : ''}
                ${artifact.era ? `<div class="info-item"><span class="info-label">年代</span><span class="info-value">${artifact.era}</span></div>` : ''}
                ${artifact.estimated_completion_date ? `<div class="info-item"><span class="info-label">预计完成</span><span class="info-value">${artifact.estimated_completion_date}</span></div>` : ''}
                ${isOverdue ? '<div class="overdue-indicator">⚠️ 已超期</div>' : ''}
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="showArtifactDetail(${artifact.id})">详情</button>
                <button class="btn btn-danger btn-small" onclick="deleteArtifact(${artifact.id})">删除</button>
            </div>
        </div>
    `}).join('');
}

// 渲染提醒列表
function renderReminders(reminders) {
    const container = document.getElementById('reminders-list');
    if (!container) return;
    
    if (reminders.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无提醒事项</p></div>';
        return;
    }
    
    container.innerHTML = reminders.map(reminder => `
        <div class="reminder-card">
            <div class="reminder-header">
                <span class="reminder-title">${reminder.title}</span>
                <span class="status-badge ${reminder.status}">${reminder.status}</span>
            </div>
            <div class="reminder-info">
                ${reminder.artifact_name ? `<div class="info-item"><span class="info-label">关联器物</span><span class="info-value">${reminder.artifact_name}</span></div>` : ''}
                ${reminder.reminder_date ? `<div class="info-item"><span class="info-label">提醒日期</span><span class="info-value">${reminder.reminder_date}</span></div>` : ''}
                ${reminder.description ? `<div class="info-item"><span class="info-label">描述</span><span class="info-value">${reminder.description}</span></div>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn btn-secondary btn-small" onclick="editReminder(${reminder.id})">编辑</button>
                <button class="btn btn-danger btn-small" onclick="deleteReminder(${reminder.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// 更新客户选择框
function updateCustomerSelects() {
    const selects = [
        document.getElementById('artifact-customer'),
        document.getElementById('reminder-artifact')
    ];
    
    // 更新客户选择框（器物表单）
    const customerSelect = document.getElementById('artifact-customer');
    if (customerSelect) {
        const currentValue = customerSelect.value;
        customerSelect.innerHTML = '<option value="">请选择客户</option>' + 
            customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (currentValue) customerSelect.value = currentValue;
    }
    
    // 更新器物选择框（提醒表单）
    const artifactSelect = document.getElementById('reminder-artifact');
    if (artifactSelect) {
        const currentValue = artifactSelect.value;
        artifactSelect.innerHTML = '<option value="">无（通用提醒）</option>' + 
            artifacts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        if (currentValue) artifactSelect.value = currentValue;
    }
}

// 模态框控制
function showModal(name) {
    hideAllModals();
    modals[name]?.classList.add('show');
}

function hideModal(name) {
    modals[name]?.classList.remove('show');
}

function hideAllModals() {
    Object.values(modals).forEach(modal => {
        modal?.classList.remove('show');
    });
}

// 新增器物模态框
function showNewArtifactModal() {
    document.getElementById('artifact-modal-title').textContent = '新增修复委托';
    document.getElementById('artifact-form').reset();
    document.getElementById('artifact-id').value = '';
    updateCustomerSelects();
    showModal('artifact');
}

// 新增客户模态框
function showNewCustomerModal() {
    document.getElementById('customer-modal-title').textContent = '新增客户';
    document.getElementById('customer-form').reset();
    document.getElementById('customer-id').value = '';
    showModal('customer');
}

// 新增提醒模态框
function showNewReminderModal() {
    document.getElementById('reminder-modal-title').textContent = '新增提醒';
    document.getElementById('reminder-form').reset();
    document.getElementById('reminder-id').value = '';
    updateCustomerSelects();
    showModal('reminder');
}

// 编辑客户
async function editCustomer(id) {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;
    
    document.getElementById('customer-modal-title').textContent = '编辑客户';
    document.getElementById('customer-id').value = customer.id;
    document.getElementById('customer-name').value = customer.name || '';
    document.getElementById('customer-phone').value = customer.phone || '';
    document.getElementById('customer-email').value = customer.email || '';
    document.getElementById('customer-address').value = customer.address || '';
    document.getElementById('customer-notes').value = customer.notes || '';
    
    showModal('customer');
}

// 编辑提醒
async function editReminder(id) {
    try {
        const response = await fetch('/api/reminders');
        const reminders = await response.json();
        const reminder = reminders.find(r => r.id === id);
        
        if (!reminder) return;
        
        document.getElementById('reminder-modal-title').textContent = '编辑提醒';
        document.getElementById('reminder-id').value = reminder.id;
        document.getElementById('reminder-artifact').value = reminder.artifact_id || '';
        document.getElementById('reminder-title').value = reminder.title || '';
        document.getElementById('reminder-description').value = reminder.description || '';
        document.getElementById('reminder-date').value = reminder.reminder_date || '';
        
        updateCustomerSelects();
        showModal('reminder');
    } catch (error) {
        console.error('加载提醒失败:', error);
    }
}

// 显示器物详情
async function showArtifactDetail(id) {
    currentArtifactId = id;
    
    try {
        // 获取器物基本信息
        const artifactResponse = await fetch(`/api/artifacts/${id}`);
        const artifact = await artifactResponse.json();
        
        // 更新标题
        document.getElementById('detail-title').textContent = artifact.name;
        
        // 填充基本信息
        document.getElementById('detail-customer-name').textContent = artifact.customer_name || '-';
        document.getElementById('detail-customer-phone').textContent = artifact.customer_phone || '-';
        document.getElementById('detail-customer-email').textContent = artifact.customer_email || '-';
        
        document.getElementById('detail-artifact-name').textContent = artifact.name || '-';
        document.getElementById('detail-artifact-type').textContent = artifact.type || '-';
        document.getElementById('detail-artifact-era').textContent = artifact.era || '-';
        document.getElementById('detail-artifact-material').textContent = artifact.material || '-';
        document.getElementById('detail-artifact-size').textContent = artifact.size || '-';
        document.getElementById('detail-artifact-damage').textContent = artifact.damage_description || '-';
        document.getElementById('detail-artifact-completion').textContent = artifact.estimated_completion_date || '-';
        document.getElementById('detail-artifact-created').textContent = formatDate(artifact.created_at);
        
        const statusBadge = document.getElementById('detail-artifact-status');
        statusBadge.textContent = artifact.current_status;
        statusBadge.className = `detail-value status-badge ${artifact.current_status}`;
        
        // 加载照片
        await loadArtifactPhotos(id);
        
        // 加载状态日志
        await loadStatusLogs(id);
        
        // 加载报价
        await loadQuotes(id);
        
        // 切换到基本信息标签
        document.querySelector('.detail-tab[data-detail-tab="info"]')?.click();
        
        showModal('artifactDetail');
    } catch (error) {
        console.error('加载器物详情失败:', error);
        alert('加载详情失败，请重试');
    }
}

// 编辑当前器物
function editCurrentArtifact() {
    if (!currentArtifactId) return;
    
    const artifact = artifacts.find(a => a.id === currentArtifactId);
    if (!artifact) return;
    
    hideModal('artifactDetail');
    
    document.getElementById('artifact-modal-title').textContent = '编辑修复委托';
    document.getElementById('artifact-id').value = artifact.id;
    document.getElementById('artifact-customer').value = artifact.customer_id || '';
    document.getElementById('artifact-name').value = artifact.name || '';
    document.getElementById('artifact-type').value = artifact.type || '';
    document.getElementById('artifact-era').value = artifact.era || '';
    document.getElementById('artifact-material').value = artifact.material || '';
    document.getElementById('artifact-size').value = artifact.size || '';
    document.getElementById('artifact-damage').value = artifact.damage_description || '';
    document.getElementById('artifact-completion').value = artifact.estimated_completion_date || '';
    
    updateCustomerSelects();
    showModal('artifact');
}

// 加载器物照片
async function loadArtifactPhotos(artifactId) {
    try {
        const response = await fetch(`/api/artifacts/${artifactId}/photos`);
        const photos = await response.json();
        
        const container = document.getElementById('photos-gallery');
        if (!container) return;
        
        if (photos.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无照片</p></div>';
            return;
        }
        
        container.innerHTML = photos.map(photo => `
            <div class="photo-item">
                <img src="${photo.file_path}" alt="${photo.file_name || '照片'}">
                <div class="photo-info">
                    <div class="photo-name">${photo.file_name || '照片'}</div>
                    ${photo.description ? `<div class="photo-description">${photo.description}</div>` : ''}
                </div>
                <div class="photo-actions">
                    <button class="btn btn-danger btn-small" onclick="deletePhoto(${photo.id})">删除</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载照片失败:', error);
    }
}

// 加载状态日志
async function loadStatusLogs(artifactId) {
    try {
        const response = await fetch(`/api/artifacts/${artifactId}/status-logs`);
        const logs = await response.json();
        
        const container = document.getElementById('status-logs');
        if (!container) return;
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无状态记录</p></div>';
            return;
        }
        
        container.innerHTML = logs.map(log => `
            <div class="status-log-item">
                <div class="log-status">${log.status}</div>
                <div class="log-meta">
                    <span>${formatDate(log.created_at)}</span>
                    ${log.operator ? `<span>操作人：${log.operator}</span>` : ''}
                </div>
                ${log.description ? `<div class="log-description">${log.description}</div>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('加载状态日志失败:', error);
    }
}

// 加载报价
async function loadQuotes(artifactId) {
    try {
        const response = await fetch(`/api/artifacts/${artifactId}/quotes`);
        const quotes = await response.json();
        
        const container = document.getElementById('quotes-list');
        if (!container) return;
        
        if (quotes.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无报价记录</p></div>';
            return;
        }
        
        container.innerHTML = quotes.map(quote => `
            <div class="quote-item">
                <div class="quote-header">
                    <span class="quote-amount">¥${quote.amount?.toFixed(2) || '0.00'}</span>
                    <span class="quote-status ${quote.status}">${quote.status}</span>
                </div>
                ${quote.description ? `<div class="quote-description">${quote.description}</div>` : ''}
                <div class="quote-meta">
                    <span>${formatDate(quote.created_at)}</span>
                    <div class="quote-actions">
                        ${quote.status === '待确认' ? `
                            <button class="btn btn-primary btn-small" onclick="updateQuoteStatus(${quote.id}, '已确认')">确认</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载报价失败:', error);
    }
}

// 表单处理
async function handleArtifactSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('artifact-id').value;
    const data = {
        customer_id: parseInt(document.getElementById('artifact-customer').value),
        name: document.getElementById('artifact-name').value,
        type: document.getElementById('artifact-type').value,
        era: document.getElementById('artifact-era').value,
        material: document.getElementById('artifact-material').value,
        size: document.getElementById('artifact-size').value,
        damage_description: document.getElementById('artifact-damage').value,
        estimated_completion_date: document.getElementById('artifact-completion').value || null
    };
    
    try {
        let response;
        if (id) {
            // 更新
            response = await fetch(`/api/artifacts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // 新增
            response = await fetch('/api/artifacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        if (response.ok) {
            hideModal('artifact');
            await loadArtifacts();
            await loadCustomers();
            updateDashboard();
            updateCustomerSelects();
            alert(id ? '更新成功' : '新增成功');
        } else {
            const error = await response.json();
            alert('操作失败：' + error.error);
        }
    } catch (error) {
        console.error('保存器物失败:', error);
        alert('保存失败，请重试');
    }
}

async function handleCustomerSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('customer-id').value;
    const data = {
        name: document.getElementById('customer-name').value,
        phone: document.getElementById('customer-phone').value,
        email: document.getElementById('customer-email').value,
        address: document.getElementById('customer-address').value,
        notes: document.getElementById('customer-notes').value
    };
    
    try {
        let response;
        if (id) {
            response = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            response = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        if (response.ok) {
            hideModal('customer');
            await loadCustomers();
            updateCustomerSelects();
            alert(id ? '更新成功' : '新增成功');
        } else {
            const error = await response.json();
            alert('操作失败：' + error.error);
        }
    } catch (error) {
        console.error('保存客户失败:', error);
        alert('保存失败，请重试');
    }
}

async function handleReminderSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('reminder-id').value;
    const artifactId = document.getElementById('reminder-artifact').value;
    const data = {
        artifact_id: artifactId ? parseInt(artifactId) : null,
        title: document.getElementById('reminder-title').value,
        description: document.getElementById('reminder-description').value,
        reminder_date: document.getElementById('reminder-date').value,
        status: '待处理'
    };
    
    try {
        let response;
        if (id) {
            response = await fetch(`/api/reminders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            response = await fetch('/api/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        if (response.ok) {
            hideModal('reminder');
            await loadReminders();
            alert(id ? '更新成功' : '新增成功');
        } else {
            const error = await response.json();
            alert('操作失败：' + error.error);
        }
    } catch (error) {
        console.error('保存提醒失败:', error);
        alert('保存失败，请重试');
    }
}

async function handlePhotoUpload(e) {
    e.preventDefault();
    
    if (!currentArtifactId) return;
    
    const formData = new FormData();
    const fileInput = document.getElementById('photo-file');
    const descriptionInput = document.getElementById('photo-description');
    
    if (fileInput.files.length === 0) {
        alert('请选择要上传的照片');
        return;
    }
    
    formData.append('photo', fileInput.files[0]);
    formData.append('description', descriptionInput.value);
    
    try {
        const response = await fetch(`/api/artifacts/${currentArtifactId}/photos`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            fileInput.value = '';
            descriptionInput.value = '';
            await loadArtifactPhotos(currentArtifactId);
            alert('上传成功');
        } else {
            const error = await response.json();
            alert('上传失败：' + error.error);
        }
    } catch (error) {
        console.error('上传照片失败:', error);
        alert('上传失败，请重试');
    }
}

async function handleStatusUpdate(e) {
    e.preventDefault();
    
    if (!currentArtifactId) return;
    
    const status = document.getElementById('new-status').value;
    if (!status) {
        alert('请选择状态');
        return;
    }
    
    const data = {
        status: status,
        description: document.getElementById('status-description').value,
        operator: document.getElementById('status-operator').value
    };
    
    try {
        const response = await fetch(`/api/artifacts/${currentArtifactId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            document.getElementById('new-status').value = '';
            document.getElementById('status-description').value = '';
            document.getElementById('status-operator').value = '';
            
            await loadStatusLogs(currentArtifactId);
            await loadArtifacts();
            updateDashboard();
            
            // 刷新详情页的状态显示
            await showArtifactDetail(currentArtifactId);
            
            alert('状态更新成功');
        } else {
            const error = await response.json();
            alert('更新失败：' + error.error);
        }
    } catch (error) {
        console.error('更新状态失败:', error);
        alert('更新失败，请重试');
    }
}

async function handleQuoteAdd(e) {
    e.preventDefault();
    
    if (!currentArtifactId) return;
    
    const data = {
        amount: parseFloat(document.getElementById('quote-amount').value),
        description: document.getElementById('quote-description').value
    };
    
    try {
        const response = await fetch(`/api/artifacts/${currentArtifactId}/quotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            document.getElementById('quote-amount').value = '';
            document.getElementById('quote-description').value = '';
            
            await loadQuotes(currentArtifactId);
            alert('报价添加成功');
        } else {
            const error = await response.json();
            alert('添加失败：' + error.error);
        }
    } catch (error) {
        console.error('添加报价失败:', error);
        alert('添加失败，请重试');
    }
}

// 删除操作
async function deleteCustomer(id) {
    if (!confirm('确定要删除此客户吗？')) return;
    
    try {
        const response = await fetch(`/api/customers/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadCustomers();
            updateCustomerSelects();
            alert('删除成功');
        } else {
            const error = await response.json();
            alert('删除失败：' + error.error);
        }
    } catch (error) {
        console.error('删除客户失败:', error);
        alert('删除失败，请重试');
    }
}

async function deleteArtifact(id) {
    if (!confirm('确定要删除此器物吗？相关的照片、日志、报价也会被删除。')) return;
    
    try {
        const response = await fetch(`/api/artifacts/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadArtifacts();
            updateDashboard();
            updateCustomerSelects();
            alert('删除成功');
        } else {
            const error = await response.json();
            alert('删除失败：' + error.error);
        }
    } catch (error) {
        console.error('删除器物失败:', error);
        alert('删除失败，请重试');
    }
}

async function deleteReminder(id) {
    if (!confirm('确定要删除此提醒吗？')) return;
    
    try {
        const response = await fetch(`/api/reminders/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadReminders();
            alert('删除成功');
        } else {
            const error = await response.json();
            alert('删除失败：' + error.error);
        }
    } catch (error) {
        console.error('删除提醒失败:', error);
        alert('删除失败，请重试');
    }
}

async function deletePhoto(id) {
    if (!confirm('确定要删除此照片吗？')) return;
    
    try {
        const response = await fetch(`/api/photos/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            if (currentArtifactId) {
                await loadArtifactPhotos(currentArtifactId);
            }
            alert('删除成功');
        } else {
            const error = await response.json();
            alert('删除失败：' + error.error);
        }
    } catch (error) {
        console.error('删除照片失败:', error);
        alert('删除失败，请重试');
    }
}

// 更新报价状态
async function updateQuoteStatus(id, status) {
    try {
        // 先获取报价信息
        const quoteResponse = await fetch(`/api/artifacts/${currentArtifactId}/quotes`);
        const quotes = await quoteResponse.json();
        const quote = quotes.find(q => q.id === id);
        
        if (!quote) return;
        
        const data = {
            amount: quote.amount,
            description: quote.description,
            status: status
        };
        
        const response = await fetch(`/api/quotes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            await loadQuotes(currentArtifactId);
            alert('状态更新成功');
        } else {
            const error = await response.json();
            alert('更新失败：' + error.error);
        }
    } catch (error) {
        console.error('更新报价状态失败:', error);
        alert('更新失败，请重试');
    }
}

// 导出功能
function exportCSV() {
    window.location.href = '/api/export/todos/csv';
}

function exportMarkdown() {
    if (!currentArtifactId) return;
    window.location.href = `/api/artifacts/${currentArtifactId}/export/markdown`;
}

// 工具函数
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
