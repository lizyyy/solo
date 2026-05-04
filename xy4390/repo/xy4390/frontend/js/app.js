const API_BASE = '/api';
let currentExportData = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeForms();
    loadAllData();
});

// 标签页切换
function initializeTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // 更新按钮状态
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新内容显示
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
            
            // 加载对应数据
            loadTabData(tabId);
        });
    });
}

// 初始化表单提交
function initializeForms() {
    // 老人表单
    document.getElementById('elderly-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveElderly();
    });
    
    // 药品表单
    document.getElementById('medicine-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMedicine();
    });
    
    // 服药计划表单
    document.getElementById('plan-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePlan();
    });
    
    // 交接记录表单
    document.getElementById('handover-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveHandover();
    });
    
    // 库存调整表单
    document.getElementById('inventory-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await adjustInventory();
    });
    
    // 提醒状态表单
    document.getElementById('reminder-status-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updateReminderStatus();
    });
    
    // 补药任务表单
    document.getElementById('replenish-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await completeReplenishTask();
    });
}

// 加载所有初始数据
async function loadAllData() {
    await loadElderly();
    await loadMedicines();
    await loadPlans();
    await loadInventory();
    await loadReplenishTasks();
    await loadHandoverRecords();
    await loadTodayReminders();
    await populateSelects();
}

// 加载标签页数据
async function loadTabData(tabId) {
    switch (tabId) {
        case 'today':
            await loadTodayReminders();
            break;
        case 'plans':
            await loadPlans();
            break;
        case 'elderly':
            await loadElderly();
            break;
        case 'medicines':
            await loadMedicines();
            break;
        case 'inventory':
            await loadInventory();
            break;
        case 'replenish':
            await loadReplenishTasks();
            break;
        case 'handover':
            await loadHandoverRecords();
            break;
        case 'export':
            await populateExportSelect();
            break;
    }
}

// API 调用函数
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: '请求失败' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        alert('操作失败: ' + error.message);
        throw error;
    }
}

// 填充下拉选择框
async function populateSelects() {
    try {
        const [elderly, medicines] = await Promise.all([
            apiRequest('/elderly'),
            apiRequest('/medicines')
        ]);
        
        // 填充计划表单
        const planElderlySelect = document.getElementById('plan-elderly');
        const planMedicineSelect = document.getElementById('plan-medicine');
        
        planElderlySelect.innerHTML = '<option value="">请选择老人</option>';
        elderly.forEach(e => {
            planElderlySelect.innerHTML += `<option value="${e.id}">${e.name} (${e.room || '无房间'})</option>`;
        });
        
        planMedicineSelect.innerHTML = '<option value="">请选择药品</option>';
        medicines.forEach(m => {
            planMedicineSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });
        
        // 填充交接记录表单
        const handoverMedicineSelect = document.getElementById('handover-medicine');
        handoverMedicineSelect.innerHTML = '<option value="">请选择药品</option>';
        medicines.forEach(m => {
            handoverMedicineSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
        });
        
        // 填充导出下拉框
        await populateExportSelect();
        
    } catch (error) {
        console.error('填充下拉框失败:', error);
    }
}

// 填充导出下拉框
async function populateExportSelect() {
    try {
        const elderly = await apiRequest('/elderly');
        const exportSelect = document.getElementById('export-elderly');
        
        exportSelect.innerHTML = '<option value="">请选择老人</option>';
        elderly.forEach(e => {
            exportSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.room || '无房间'})</option>`;
        });
    } catch (error) {
        console.error('填充导出下拉框失败:', error);
    }
}

// 老人管理
async function loadElderly() {
    try {
        const elderly = await apiRequest('/elderly');
        const tbody = document.querySelector('#elderly-table tbody');
        
        if (elderly.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无老人数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = elderly.map(e => `
            <tr>
                <td>${e.name}</td>
                <td>${e.age || '-'}</td>
                <td>${e.room || '-'}</td>
                <td>${e.phone || '-'}</td>
                <td>${e.emergency_contact || '-'}</td>
                <td class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="editElderly('${e.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteElderly('${e.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载老人数据失败:', error);
    }
}

function openElderlyModal(elderly = null) {
    const modal = document.getElementById('elderly-modal');
    const title = document.getElementById('elderly-modal-title');
    const form = document.getElementById('elderly-form');
    
    if (elderly) {
        title.textContent = '编辑老人';
        document.getElementById('elderly-id').value = elderly.id;
        document.getElementById('elderly-name').value = elderly.name;
        document.getElementById('elderly-age').value = elderly.age || '';
        document.getElementById('elderly-room').value = elderly.room || '';
        document.getElementById('elderly-phone').value = elderly.phone || '';
        document.getElementById('elderly-emergency').value = elderly.emergency_contact || '';
        document.getElementById('elderly-notes').value = elderly.notes || '';
    } else {
        title.textContent = '添加老人';
        form.reset();
        document.getElementById('elderly-id').value = '';
    }
    
    modal.classList.add('show');
}

async function editElderly(id) {
    try {
        const elderly = await apiRequest(`/elderly/${id}`);
        openElderlyModal(elderly);
    } catch (error) {
        console.error('获取老人数据失败:', error);
    }
}

async function saveElderly() {
    const id = document.getElementById('elderly-id').value;
    const data = {
        name: document.getElementById('elderly-name').value,
        age: parseInt(document.getElementById('elderly-age').value) || null,
        room: document.getElementById('elderly-room').value || null,
        phone: document.getElementById('elderly-phone').value || null,
        emergency_contact: document.getElementById('elderly-emergency').value || null,
        notes: document.getElementById('elderly-notes').value || null
    };
    
    try {
        if (id) {
            await apiRequest(`/elderly/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            await apiRequest('/elderly', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        closeModal('elderly-modal');
        await loadElderly();
        await populateSelects();
        alert('保存成功！');
    } catch (error) {
        console.error('保存老人数据失败:', error);
    }
}

async function deleteElderly(id) {
    if (!confirm('确定要删除该老人信息吗？')) return;
    
    try {
        await apiRequest(`/elderly/${id}`, { method: 'DELETE' });
        await loadElderly();
        await populateSelects();
        alert('删除成功！');
    } catch (error) {
        console.error('删除老人数据失败:', error);
    }
}

// 药品管理
async function loadMedicines() {
    try {
        const medicines = await apiRequest('/medicines');
        const tbody = document.querySelector('#medicines-table tbody');
        
        if (medicines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无药品数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = medicines.map(m => `
            <tr>
                <td>${m.name}</td>
                <td>${m.specification || '-'}</td>
                <td>${m.manufacturer || '-'}</td>
                <td>${m.category || '-'}</td>
                <td class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="editMedicine('${m.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMedicine('${m.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载药品数据失败:', error);
    }
}

function openMedicineModal(medicine = null) {
    const modal = document.getElementById('medicine-modal');
    const title = document.getElementById('medicine-modal-title');
    const form = document.getElementById('medicine-form');
    
    if (medicine) {
        title.textContent = '编辑药品';
        document.getElementById('medicine-id').value = medicine.id;
        document.getElementById('medicine-name').value = medicine.name;
        document.getElementById('medicine-spec').value = medicine.specification || '';
        document.getElementById('medicine-manufacturer').value = medicine.manufacturer || '';
        document.getElementById('medicine-category').value = medicine.category || '';
        document.getElementById('medicine-description').value = medicine.description || '';
    } else {
        title.textContent = '添加药品';
        form.reset();
        document.getElementById('medicine-id').value = '';
    }
    
    modal.classList.add('show');
}

async function editMedicine(id) {
    try {
        const medicine = await apiRequest(`/medicines/${id}`);
        openMedicineModal(medicine);
    } catch (error) {
        console.error('获取药品数据失败:', error);
    }
}

async function saveMedicine() {
    const id = document.getElementById('medicine-id').value;
    const data = {
        name: document.getElementById('medicine-name').value,
        specification: document.getElementById('medicine-spec').value || null,
        manufacturer: document.getElementById('medicine-manufacturer').value || null,
        category: document.getElementById('medicine-category').value || null,
        description: document.getElementById('medicine-description').value || null
    };
    
    try {
        if (id) {
            await apiRequest(`/medicines/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            await apiRequest('/medicines', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        closeModal('medicine-modal');
        await loadMedicines();
        await loadInventory();
        await populateSelects();
        alert('保存成功！');
    } catch (error) {
        console.error('保存药品数据失败:', error);
    }
}

async function deleteMedicine(id) {
    if (!confirm('确定要删除该药品吗？')) return;
    
    try {
        await apiRequest(`/medicines/${id}`, { method: 'DELETE' });
        await loadMedicines();
        await populateSelects();
        alert('删除成功！');
    } catch (error) {
        console.error('删除药品数据失败:', error);
    }
}

// 服药计划管理
async function loadPlans() {
    try {
        const plans = await apiRequest('/plans');
        const tbody = document.querySelector('#plans-table tbody');
        
        if (plans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">暂无服药计划</td></tr>';
            return;
        }
        
        tbody.innerHTML = plans.map(p => `
            <tr>
                <td>${p.elderly_name || '-'}</td>
                <td>${p.medicine_name || '-'}</td>
                <td>${p.dosage}</td>
                <td>${p.time}</td>
                <td>${p.frequency}</td>
                <td>${p.start_date || '-'}</td>
                <td>${p.end_date || '-'}</td>
                <td><span class="status-badge status-${p.status}">${p.status === 'active' ? '激活' : '停用'}</span></td>
                <td class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="editPlan('${p.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePlan('${p.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载服药计划失败:', error);
    }
}

function openPlanModal(plan = null) {
    const modal = document.getElementById('plan-modal');
    const title = document.getElementById('plan-modal-title');
    const form = document.getElementById('plan-form');
    
    if (plan) {
        title.textContent = '编辑服药计划';
        document.getElementById('plan-id').value = plan.id;
        document.getElementById('plan-elderly').value = plan.elderly_id || '';
        document.getElementById('plan-medicine').value = plan.medicine_id || '';
        document.getElementById('plan-dosage').value = plan.dosage || '';
        document.getElementById('plan-time').value = plan.time || '';
        document.getElementById('plan-frequency').value = plan.frequency || '每天';
        document.getElementById('plan-start').value = plan.start_date || '';
        document.getElementById('plan-end').value = plan.end_date || '';
        document.getElementById('plan-status').value = plan.status || 'active';
        document.getElementById('plan-notes').value = plan.notes || '';
    } else {
        title.textContent = '添加服药计划';
        form.reset();
        document.getElementById('plan-id').value = '';
    }
    
    modal.classList.add('show');
}

async function editPlan(id) {
    try {
        const plan = await apiRequest(`/plans/${id}`);
        openPlanModal(plan);
    } catch (error) {
        console.error('获取服药计划失败:', error);
    }
}

async function savePlan() {
    const id = document.getElementById('plan-id').value;
    const data = {
        elderly_id: document.getElementById('plan-elderly').value,
        medicine_id: document.getElementById('plan-medicine').value,
        dosage: document.getElementById('plan-dosage').value,
        time: document.getElementById('plan-time').value,
        frequency: document.getElementById('plan-frequency').value,
        start_date: document.getElementById('plan-start').value || null,
        end_date: document.getElementById('plan-end').value || null,
        status: document.getElementById('plan-status').value,
        notes: document.getElementById('plan-notes').value || null
    };
    
    try {
        if (id) {
            await apiRequest(`/plans/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            await apiRequest('/plans', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        closeModal('plan-modal');
        await loadPlans();
        alert('保存成功！');
    } catch (error) {
        console.error('保存服药计划失败:', error);
    }
}

async function deletePlan(id) {
    if (!confirm('确定要删除该服药计划吗？')) return;
    
    try {
        await apiRequest(`/plans/${id}`, { method: 'DELETE' });
        await loadPlans();
        alert('删除成功！');
    } catch (error) {
        console.error('删除服药计划失败:', error);
    }
}

// 今日服药清单
async function loadTodayReminders() {
    try {
        const reminders = await apiRequest('/reminders/today');
        const tbody = document.querySelector('#today-table tbody');
        const summary = document.getElementById('today-summary');
        
        if (reminders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无今日提醒</td></tr>';
            summary.textContent = '今日暂无服药提醒';
            return;
        }
        
        const total = reminders.length;
        const reminded = reminders.filter(r => r.status === 'reminded').length;
        const missed = reminders.filter(r => r.status === 'missed').length;
        const pending = total - reminded - missed;
        
        summary.textContent = `今日共 ${total} 条提醒 - 已提醒: ${reminded}, 漏服: ${missed}, 待处理: ${pending}`;
        
        tbody.innerHTML = reminders.map(r => {
            const statusClass = `status-${r.status}`;
            const statusText = {
                'pending': '待处理',
                'reminded': '已提醒',
                'missed': '漏服'
            }[r.status] || r.status;
            
            const actionButtons = r.status === 'pending' 
                ? `<button class="btn btn-success btn-sm" onclick="markReminderStatus('${r.id}', '${r.elderly_name}', '${r.medicine_name}')">标记状态</button>`
                : '-';
            
            return `
            <tr>
                <td>${r.elderly_name || '-'}</td>
                <td>${r.room || '-'}</td>
                <td>${r.medicine_name || '-'}</td>
                <td>${r.dosage || '-'}</td>
                <td>${r.scheduled_time ? new Date(r.scheduled_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="action-buttons">
                    ${actionButtons}
                </td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error('加载今日提醒失败:', error);
    }
}

// 生成今日提醒
async function generateTodayReminders() {
    try {
        const todayPlans = await apiRequest('/plans/today');
        const today = new Date().toISOString().split('T')[0];
        
        const createdCount = 0;
        for (const plan of todayPlans) {
            const scheduledTime = new Date(`${today}T${plan.time}`).toISOString();
            
            // 检查是否已存在该提醒
            try {
                await apiRequest('/reminders', {
                    method: 'POST',
                    body: JSON.stringify({
                        plan_id: plan.id,
                        elderly_id: plan.elderly_id,
                        medicine_id: plan.medicine_id,
                        scheduled_time: scheduledTime,
                        status: 'pending'
                    })
                });
            } catch (e) {
                // 可能已存在，忽略
            }
        }
        
        await loadTodayReminders();
        alert(`已生成今日提醒！共 ${todayPlans.length} 条计划。`);
    } catch (error) {
        console.error('生成今日提醒失败:', error);
    }
}

function markReminderStatus(id, elderlyName, medicineName) {
    const modal = document.getElementById('reminder-status-modal');
    document.getElementById('reminder-id').value = id;
    document.getElementById('reminder-elderly').value = elderlyName;
    document.getElementById('reminder-medicine').value = medicineName;
    document.getElementById('reminder-status').value = 'reminded';
    document.getElementById('reminder-volunteer').value = '';
    document.getElementById('reminder-notes').value = '';
    
    modal.classList.add('show');
}

async function updateReminderStatus() {
    const id = document.getElementById('reminder-id').value;
    const status = document.getElementById('reminder-status').value;
    const volunteerName = document.getElementById('reminder-volunteer').value;
    const notes = document.getElementById('reminder-notes').value;
    
    try {
        const endpoint = status === 'reminded' ? 'reminded' : 'missed';
        await apiRequest(`/reminders/${id}/${endpoint}`, {
            method: 'POST',
            body: JSON.stringify({
                volunteer_name: volunteerName,
                notes: notes
            })
        });
        
        closeModal('reminder-status-modal');
        await loadTodayReminders();
        alert('状态更新成功！');
    } catch (error) {
        console.error('更新提醒状态失败:', error);
    }
}

// 库存管理
async function loadInventory() {
    try {
        const inventory = await apiRequest('/inventory');
        const lowStock = await apiRequest('/inventory/low-stock');
        const tbody = document.querySelector('#inventory-table tbody');
        const alertBox = document.getElementById('low-stock-alert');
        const lowStockCount = document.getElementById('low-stock-count');
        
        if (lowStock.length > 0) {
            alertBox.style.display = 'block';
            lowStockCount.textContent = lowStock.length;
        } else {
            alertBox.style.display = 'none';
        }
        
        if (inventory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无库存数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = inventory.map(i => {
            const isLow = i.quantity <= i.threshold;
            const statusClass = isLow ? 'status-low' : 'status-normal';
            const statusText = isLow ? '库存不足' : '正常';
            
            return `
            <tr>
                <td>${i.medicine_name || '-'}</td>
                <td>${i.specification || '-'}</td>
                <td>${i.quantity} ${i.unit}</td>
                <td>${i.threshold} ${i.unit}</td>
                <td>${i.unit}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${i.last_updated ? new Date(i.last_updated).toLocaleString('zh-CN') : '-'}</td>
                <td class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="openInventoryModal('${i.id}', '${i.medicine_name}', ${i.quantity}, ${i.threshold})">调整</button>
                </td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error('加载库存数据失败:', error);
    }
}

async function checkLowStock() {
    try {
        const lowStock = await apiRequest('/inventory/low-stock');
        if (lowStock.length === 0) {
            alert('所有药品库存充足！');
        } else {
            alert(`发现 ${lowStock.length} 种药品库存不足，请查看库存管理页面。`);
        }
        await loadInventory();
    } catch (error) {
        console.error('检查低库存失败:', error);
    }
}

function openInventoryModal(id, medicineName, currentQuantity, threshold) {
    const modal = document.getElementById('inventory-modal');
    document.getElementById('inventory-id').value = id;
    document.getElementById('inventory-medicine-name').value = medicineName;
    document.getElementById('inventory-current').value = currentQuantity;
    document.getElementById('inventory-quantity').value = '';
    document.getElementById('inventory-action').value = 'add';
    document.getElementById('inventory-threshold').value = threshold;
    document.getElementById('inventory-notes').value = '';
    
    modal.classList.add('show');
}

async function adjustInventory() {
    const id = document.getElementById('inventory-id').value;
    const quantity = parseInt(document.getElementById('inventory-quantity').value);
    const action = document.getElementById('inventory-action').value;
    const threshold = parseInt(document.getElementById('inventory-threshold').value);
    const notes = document.getElementById('inventory-notes').value;
    
    try {
        // 先更新阈值
        await apiRequest(`/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                threshold: threshold,
                notes: notes
            })
        });
        
        // 然后调整数量
        const endpoint = action === 'add' ? 'add' : 'remove';
        await apiRequest(`/inventory/${id}/${endpoint}`, {
            method: 'POST',
            body: JSON.stringify({
                quantity: quantity,
                notes: notes
            })
        });
        
        closeModal('inventory-modal');
        await loadInventory();
        alert('库存调整成功！');
    } catch (error) {
        console.error('调整库存失败:', error);
    }
}

// 补药任务
async function loadReplenishTasks() {
    try {
        const tasks = await apiRequest('/replenish');
        const tbody = document.querySelector('#replenish-table tbody');
        
        if (tasks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无补药任务</td></tr>';
            return;
        }
        
        tbody.innerHTML = tasks.map(t => {
            const statusClass = t.status === 'completed' ? 'status-completed' : 'status-pending';
            const statusText = t.status === 'completed' ? '已完成' : '待处理';
            const actionButtons = t.status === 'pending'
                ? `<button class="btn btn-success btn-sm" onclick="openReplenishModal('${t.id}', '${t.medicine_name}')">完成</button>`
                : '-';
            
            return `
            <tr>
                <td>${t.medicine_name || '-'}</td>
                <td>${t.current_quantity} ${t.unit}</td>
                <td>${t.required_quantity} ${t.unit}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${t.assigned_to || '-'}</td>
                <td>${t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : '-'}</td>
                <td class="action-buttons">
                    ${actionButtons}
                </td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error('加载补药任务失败:', error);
    }
}

async function autoCreateReplenishTasks() {
    try {
        const result = await apiRequest('/replenish/auto-create', { method: 'POST' });
        await loadReplenishTasks();
        await loadInventory();
        alert(result.message);
    } catch (error) {
        console.error('自动创建补药任务失败:', error);
    }
}

function openReplenishModal(id, medicineName) {
    const modal = document.getElementById('replenish-modal');
    document.getElementById('replenish-task-id').value = id;
    document.getElementById('replenish-medicine-name').value = medicineName;
    document.getElementById('replenish-volunteer').value = '';
    document.getElementById('replenish-notes').value = '';
    
    modal.classList.add('show');
}

async function completeReplenishTask() {
    const id = document.getElementById('replenish-task-id').value;
    const volunteer = document.getElementById('replenish-volunteer').value;
    const notes = document.getElementById('replenish-notes').value;
    
    try {
        await apiRequest(`/replenish/${id}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                volunteer_name: volunteer,
                notes: notes
            })
        });
        
        closeModal('replenish-modal');
        await loadReplenishTasks();
        await loadInventory();
        alert('补药任务已完成！');
    } catch (error) {
        console.error('完成补药任务失败:', error);
    }
}

// 交接记录
async function loadHandoverRecords() {
    try {
        const records = await apiRequest('/handover');
        const tbody = document.querySelector('#handover-table tbody');
        
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无交接记录</td></tr>';
            return;
        }
        
        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${r.medicine_name || '-'}</td>
                <td>${r.from_volunteer}</td>
                <td>${r.to_volunteer}</td>
                <td>${r.quantity}</td>
                <td>${r.handover_time ? new Date(r.handover_time).toLocaleString('zh-CN') : '-'}</td>
                <td>${r.notes || '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载交接记录失败:', error);
    }
}

function openHandoverModal() {
    const modal = document.getElementById('handover-modal');
    const form = document.getElementById('handover-form');
    form.reset();
    modal.classList.add('show');
}

async function saveHandover() {
    const data = {
        medicine_id: document.getElementById('handover-medicine').value,
        from_volunteer: document.getElementById('handover-from').value,
        to_volunteer: document.getElementById('handover-to').value,
        quantity: parseInt(document.getElementById('handover-quantity').value),
        notes: document.getElementById('handover-notes').value || null
    };
    
    try {
        await apiRequest('/handover', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        closeModal('handover-modal');
        await loadHandoverRecords();
        alert('交接记录保存成功！');
    } catch (error) {
        console.error('保存交接记录失败:', error);
    }
}

// 数据导出
async function exportElderlyRecords() {
    const elderlyId = document.getElementById('export-elderly').value;
    
    if (!elderlyId) {
        alert('请先选择老人');
        return;
    }
    
    try {
        const result = await apiRequest(`/reminders/export/elderly/${elderlyId}`);
        currentExportData = result;
        
        const resultDiv = document.getElementById('export-result');
        const summaryDiv = document.getElementById('export-summary');
        const tbody = document.querySelector('#export-table tbody');
        
        if (result.records.length === 0) {
            summaryDiv.innerHTML = `<strong>${result.elderly.name}</strong> 近7天暂无提醒记录（${result.start_date} 至 ${result.end_date}）`;
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无数据</td></tr>';
        } else {
            const total = result.records.length;
            const reminded = result.records.filter(r => r.status === 'reminded').length;
            const missed = result.records.filter(r => r.status === 'missed').length;
            
            summaryDiv.innerHTML = `
                <strong>${result.elderly.name}</strong> 近7天提醒记录（${result.start_date} 至 ${result.end_date}）<br>
                总计: ${total} 条 | 已提醒: ${reminded} | 漏服: ${missed} | 异常率: ${total > 0 ? ((missed / total) * 100).toFixed(1) : 0}%
            `;
            
            tbody.innerHTML = result.records.map(r => {
                const statusClass = `status-${r.status}`;
                const statusText = {
                    'pending': '待处理',
                    'reminded': '已提醒',
                    'missed': '漏服'
                }[r.status] || r.status;
                
                return `
                <tr>
                    <td>${r.scheduled_time ? new Date(r.scheduled_time).toLocaleDateString('zh-CN') : '-'}</td>
                    <td>${r.medicine_name || '-'}</td>
                    <td>${r.dosage || '-'}</td>
                    <td>${r.scheduled_time_of_day || '-'}</td>
                    <td>${r.actual_time ? new Date(r.actual_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${r.volunteer_name || '-'}</td>
                    <td>${r.notes || '-'}</td>
                </tr>
            `}).join('');
        }
        
        resultDiv.style.display = 'block';
    } catch (error) {
        console.error('导出数据失败:', error);
    }
}

function downloadExportCSV() {
    if (!currentExportData || !currentExportData.records) {
        alert('没有可导出的数据');
        return;
    }
    
    const headers = ['日期', '药品名称', '剂量', '计划时间', '实际时间', '状态', '志愿者', '备注'];
    const rows = currentExportData.records.map(r => [
        r.scheduled_time ? new Date(r.scheduled_time).toLocaleDateString('zh-CN') : '',
        r.medicine_name || '',
        r.dosage || '',
        r.scheduled_time_of_day || '',
        r.actual_time ? new Date(r.actual_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
        { 'pending': '待处理', 'reminded': '已提醒', 'missed': '漏服' }[r.status] || r.status,
        r.volunteer_name || '',
        r.notes || ''
    ]);
    
    let csv = '\uFEFF'; // BOM for UTF-8
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentExportData.elderly.name}_近7天提醒记录_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 模态框控制
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});
