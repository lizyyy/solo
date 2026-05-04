const API_BASE = '/api';
const STORAGE_KEY = 'food_safety_pending_changes';

let currentDate = new Date().toISOString().split('T')[0];
let currentData = {
    stalls: [],
    dishes: [],
    menus: [],
    reviews: [],
    risks: [],
    allergens: []
};
let pendingChanges = {
    reviews: {}
};

document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    document.getElementById('currentDate').value = currentDate;
    loadPendingChanges();
    setupEventListeners();
    loadAllergens();
    refreshData();
}

function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    document.querySelectorAll('.import-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            document.querySelectorAll('.import-type-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.import-form').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`import-${type}`).classList.add('active');
        });
    });

    document.getElementById('currentDate').addEventListener('change', (e) => {
        currentDate = e.target.value;
        refreshData();
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') {
            closeModal();
        }
    });

    document.getElementById('import-menu-date').value = currentDate;
}

function loadPendingChanges() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            pendingChanges = JSON.parse(saved);
        }
    } catch (e) {
        console.error('加载待处理更改失败:', e);
    }
}

function savePendingChanges() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingChanges));
    } catch (e) {
        console.error('保存待处理更改失败:', e);
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    if (tabName === 'review') {
        loadReviews();
    } else if (tabName === 'risks') {
        loadRisks();
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API 调用失败: ${endpoint}`, error);
        throw error;
    }
}

async function refreshData() {
    try {
        showToast('正在刷新数据...', '');

        const [dashboardData, stalls] = await Promise.all([
            apiFetch(`/dashboard?date=${currentDate}`),
            apiFetch('/stalls')
        ]);

        if (dashboardData.success) {
            currentData.menus = dashboardData.data.menus || [];
            currentData.reviews = dashboardData.data.reviews || [];
            currentData.risks = dashboardData.data.risks || [];
            updateDashboard(dashboardData.data.stats);
            updateStallsList(dashboardData.data.stalls || []);
            updateMenusList(currentData.menus);
        }

        if (stalls.success) {
            currentData.stalls = stalls.data || [];
            updateStallSelects();
        }

        showToast('数据已刷新', 'success');
    } catch (error) {
        showToast('数据刷新失败: ' + error.message, 'error');
    }
}

function updateDashboard(stats) {
    document.querySelector('#stat-stalls .stat-value').textContent = stats.total_stalls || 0;
    document.querySelector('#stat-dishes .stat-value').textContent = stats.total_menus || 0;
    
    const riskValue = document.querySelector('#stat-risks .stat-value');
    riskValue.textContent = stats.total_risks || 0;
    if ((stats.critical_risks || 0) > 0 || (stats.high_risks || 0) > 0) {
        riskValue.classList.add('risk-high');
    } else {
        riskValue.classList.remove('risk-high');
    }

    document.querySelector('#stat-review .stat-value').textContent = 
        `${stats.reviewed || 0}/${stats.pending || 0}`;
}

function updateStallsList(stalls) {
    const container = document.getElementById('stalls-list');
    
    if (stalls.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无摊位数据</p>';
        return;
    }

    container.innerHTML = stalls.map(stall => `
        <div class="stall-item">
            <div class="stall-info">
                <span class="stall-name">${stall.name}</span>
                <span class="stall-contact">
                    ${stall.contact_person ? `联系人: ${stall.contact_person}` : ''}
                    ${stall.phone ? ` | 电话: ${stall.phone}` : ''}
                </span>
            </div>
        </div>
    `).join('');
}

function updateMenusList(menus) {
    const container = document.getElementById('menus-list');
    
    if (menus.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无菜单数据</p>';
        return;
    }

    container.innerHTML = menus.map(menu => {
        const allergens = menu.allergens ? menu.allergens.split(',').map(a => a.trim()) : [];
        return `
            <div class="menu-item">
                <div class="dish-info">
                    <span class="dish-name">${menu.dish_name} (${menu.quantity || 1}份)</span>
                    <span class="dish-meta">${menu.stall_name}${menu.notes ? ` | ${menu.notes}` : ''}</span>
                </div>
                ${allergens.length > 0 ? `
                    <div class="allergens-badge">
                        ${allergens.map(a => `<span class="allergen-chip">${a}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function updateStallSelects() {
    const options = currentData.stalls.map(s => 
        `<option value="${s.id}">${s.name}</option>`
    ).join('');

    document.getElementById('import-menu-stall').innerHTML = 
        '<option value="">-- 不指定 --</option>' + options;
    document.getElementById('dish-stall').innerHTML = 
        '<option value="">请选择摊位</option>' + options;
    document.getElementById('review-stall-filter').innerHTML = 
        '<option value="">全部摊位</option>' + options;
}

async function loadAllergens() {
    try {
        const result = await apiFetch('/allergens');
        if (result.success) {
            currentData.allergens = result.data;
            updateAllergensUI();
        }
    } catch (error) {
        console.error('加载过敏源列表失败:', error);
    }
}

function updateAllergensUI() {
    const checkboxContainer = document.getElementById('allergen-checkboxes');
    const standardContainer = document.getElementById('standard-allergens');

    checkboxContainer.innerHTML = currentData.allergens.map(allergen => `
        <div class="checkbox-item">
            <input type="checkbox" id="allergen-${allergen}" value="${allergen}">
            <label for="allergen-${allergen}">${allergen}</label>
        </div>
    `).join('');

    standardContainer.innerHTML = currentData.allergens.map(allergen => 
        `<span class="allergen-tag">${allergen}</span>`
    ).join('');
}

async function runSafetyChecks() {
    try {
        showToast('正在运行安全检查...', '');

        const result = await apiFetch('/risks/run-checks', {
            method: 'POST',
            body: JSON.stringify({ date: currentDate })
        });

        if (result.success) {
            currentData.risks = result.data.risks;
            const stats = result.data.stats;
            showToast(
                `安全检查完成: 发现 ${stats.total} 个风险项 (严重:${stats.critical}, 高:${stats.high}, 中:${stats.medium})`,
                stats.total > 0 ? 'warning' : 'success'
            );
            refreshData();
        }
    } catch (error) {
        showToast('安全检查失败: ' + error.message, 'error');
    }
}

async function loadReviews() {
    try {
        const stallFilter = document.getElementById('review-stall-filter').value;
        const statusFilter = document.getElementById('review-status-filter').value;

        let url = `/reviews?date=${currentDate}`;
        if (stallFilter) url += `&stall_id=${stallFilter}`;

        const result = await apiFetch(url);

        if (result.success) {
            currentData.reviews = result.data || [];
            renderReviews(statusFilter);
        }
    } catch (error) {
        showToast('加载复核数据失败: ' + error.message, 'error');
    }
}

function renderReviews(statusFilter) {
    const container = document.getElementById('reviews-container');
    
    let reviews = currentData.reviews;

    if (statusFilter) {
        reviews = reviews.filter(r => r.overall_status === statusFilter);
    }

    if (reviews.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无复核数据</p>';
        return;
    }

    container.innerHTML = reviews.map(review => {
        const pendingChangesForReview = pendingChanges.reviews[review.id] || {};
        const finalReview = { ...review, ...pendingChangesForReview };

        return `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-title">
                        <h4>${finalReview.dish_name}</h4>
                        <span class="stall-name">${finalReview.stall_name} | 数量: ${finalReview.quantity || 1}份</span>
                        ${finalReview.allergens ? `<span class="stall-name">过敏源: ${finalReview.allergens}</span>` : ''}
                    </div>
                    <span class="review-status-badge status-${finalReview.overall_status}">
                        ${getStatusLabel(finalReview.overall_status)}
                    </span>
                </div>

                <div class="review-item">
                    <label>🔍 过敏源标注</label>
                    <select id="review-${review.id}-allergen" 
                            onchange="updateReviewStatus(${review.id}, 'allergen_status', this.value)">
                        <option value="pending" ${finalReview.allergen_status === 'pending' ? 'selected' : ''}>待复核</option>
                        <option value="passed" ${finalReview.allergen_status === 'passed' ? 'selected' : ''}>✓ 通过</option>
                        <option value="failed" ${finalReview.allergen_status === 'failed' ? 'selected' : ''}>✗ 不通过</option>
                    </select>
                </div>

                <div class="review-item">
                    <label>📷 留样检查</label>
                    <select id="review-${review.id}-sample" 
                            onchange="updateReviewStatus(${review.id}, 'sample_status', this.value)">
                        <option value="pending" ${finalReview.sample_status === 'pending' ? 'selected' : ''}>待复核</option>
                        <option value="passed" ${finalReview.sample_status === 'passed' ? 'selected' : ''}>✓ 通过</option>
                        <option value="failed" ${finalReview.sample_status === 'failed' ? 'selected' : ''}>✗ 不通过</option>
                    </select>
                </div>

                <div class="review-item">
                    <label>🌡️ 冷却记录</label>
                    <select id="review-${review.id}-cooling" 
                            onchange="updateReviewStatus(${review.id}, 'cooling_status', this.value)">
                        <option value="pending" ${finalReview.cooling_status === 'pending' ? 'selected' : ''}>待复核</option>
                        <option value="passed" ${finalReview.cooling_status === 'passed' ? 'selected' : ''}>✓ 通过</option>
                        <option value="failed" ${finalReview.cooling_status === 'failed' ? 'selected' : ''}>✗ 不通过</option>
                    </select>
                </div>

                <div class="review-item">
                    <label>📦 批次追溯</label>
                    <select id="review-${review.id}-batch" 
                            onchange="updateReviewStatus(${review.id}, 'batch_status', this.value)">
                        <option value="pending" ${finalReview.batch_status === 'pending' ? 'selected' : ''}>待复核</option>
                        <option value="passed" ${finalReview.batch_status === 'passed' ? 'selected' : ''}>✓ 通过</option>
                        <option value="failed" ${finalReview.batch_status === 'failed' ? 'selected' : ''}>✗ 不通过</option>
                    </select>
                </div>

                <div class="review-actions">
                    <div class="review-notes">
                        <input type="text" 
                               id="review-${review.id}-notes" 
                               placeholder="复核备注..."
                               value="${finalReview.notes || ''}"
                               onchange="updateReviewStatus(${review.id}, 'notes', this.value)">
                    </div>
                    <button onclick="saveReview(${review.id})" class="btn btn-primary btn-sm">
                        保存复核
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusLabel(status) {
    const labels = {
        'pending': '待复核',
        'passed': '已通过',
        'failed': '不通过'
    };
    return labels[status] || status;
}

function updateReviewStatus(reviewId, field, value) {
    if (!pendingChanges.reviews[reviewId]) {
        pendingChanges.reviews[reviewId] = {};
    }
    
    pendingChanges.reviews[reviewId][field] = value;

    const changes = pendingChanges.reviews[reviewId];
    const allStatuses = ['allergen_status', 'sample_status', 'cooling_status', 'batch_status'];
    
    const currentStatuses = allStatuses.map(s => 
        changes[s] || (currentData.reviews.find(r => r.id === reviewId) || {})[s]
    );

    if (currentStatuses.every(s => s === 'passed')) {
        changes.overall_status = 'passed';
    } else if (currentStatuses.some(s => s === 'failed')) {
        changes.overall_status = 'failed';
    } else {
        changes.overall_status = 'pending';
    }

    savePendingChanges();

    setTimeout(() => loadReviews(), 100);
}

async function saveReview(reviewId) {
    try {
        const changes = pendingChanges.reviews[reviewId];
        if (!changes || Object.keys(changes).length === 0) {
            showToast('没有需要保存的更改', 'warning');
            return;
        }

        const result = await apiFetch(`/reviews/${reviewId}`, {
            method: 'PUT',
            body: JSON.stringify(changes)
        });

        if (result.success) {
            delete pendingChanges.reviews[reviewId];
            savePendingChanges();
            showToast('复核结果已保存', 'success');
            refreshData();
        }
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

async function loadRisks() {
    try {
        const levelFilter = document.getElementById('risk-level-filter').value;
        const statusFilter = document.getElementById('risk-status-filter').value;

        let url = `/risks?date=${currentDate}`;
        if (statusFilter) url += `&status=${statusFilter}`;

        const result = await apiFetch(url);

        if (result.success) {
            let risks = result.data || [];

            if (levelFilter) {
                risks = risks.filter(r => r.risk_level === levelFilter);
            }

            currentData.risks = risks;
            renderRisks();
        }
    } catch (error) {
        showToast('加载风险数据失败: ' + error.message, 'error');
    }
}

function renderRisks() {
    const container = document.getElementById('risks-container');
    
    if (currentData.risks.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无风险记录</p>';
        return;
    }

    container.innerHTML = currentData.risks.map(risk => `
        <div class="risk-card ${risk.risk_level}">
            <div class="risk-header">
                <div class="risk-title">
                    <h4>${getRiskTypeLabel(risk.risk_type)}</h4>
                    <span class="meta">
                        ${risk.stall_name || '未知摊位'} | 
                        ${risk.dish_name || '未知菜品'}
                    </span>
                </div>
                <span class="risk-level ${risk.risk_level}">
                    ${getRiskLevelLabel(risk.risk_level)}
                </span>
            </div>

            <div class="risk-description">
                ${risk.description}
            </div>

            ${risk.suggestion ? `
                <div class="risk-suggestion">
                    💡 建议: ${risk.suggestion}
                </div>
            ` : ''}

            <div class="risk-actions">
                <select id="risk-${risk.id}-status" 
                        class="btn btn-sm btn-secondary"
                        onchange="updateRiskStatus(${risk.id}, this.value)">
                    <option value="open" ${risk.status === 'open' ? 'selected' : ''}>待处理</option>
                    <option value="processing" ${risk.status === 'processing' ? 'selected' : ''}>处理中</option>
                    <option value="resolved" ${risk.status === 'resolved' ? 'selected' : ''}>已解决</option>
                    <option value="dismissed" ${risk.status === 'dismissed' ? 'selected' : ''}>已忽略</option>
                </select>
                <span class="meta">
                    ${risk.status === 'open' ? '⏳' : 
                      risk.status === 'processing' ? '🔄' : 
                      risk.status === 'resolved' ? '✓' : '✗'}
                    ${risk.created_at}
                </span>
            </div>
        </div>
    `).join('');
}

function getRiskTypeLabel(type) {
    const labels = {
        'allergen_missing': '❓ 缺少过敏源标注',
        'allergen_invalid': '⚠️ 过敏源标注不规范',
        'sample_missing': '📷 缺少留样',
        'sample_photo_missing': '🖼️ 缺少留样照片',
        'temperature_missing': '🌡️ 缺少温度记录',
        'cooling_timeout': '⏰ 冷却超时',
        'cooling_incomplete': '❄️ 冷却未达标',
        'batch_missing': '📦 缺少原料批次',
        'batch_number_missing': '🏷️ 缺少批次号',
        'supplier_missing': '🏭 缺少供应商',
        'expiration_missing': '📅 缺少有效期',
        'expired_ingredient': '💀 原料已过期'
    };
    return labels[type] || type;
}

function getRiskLevelLabel(level) {
    const labels = {
        'critical': '🔴 严重',
        'high': '🟠 高',
        'medium': '🟡 中',
        'low': '🟢 低'
    };
    return labels[level] || level;
}

async function updateRiskStatus(riskId, status) {
    try {
        const result = await apiFetch(`/risks/${riskId}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });

        if (result.success) {
            showToast('风险状态已更新', 'success');
            loadRisks();
        }
    } catch (error) {
        showToast('更新失败: ' + error.message, 'error');
    }
}

async function loadSettings() {
    try {
        const [stallsResult, dishesResult] = await Promise.all([
            apiFetch('/stalls'),
            apiFetch('/dishes')
        ]);

        if (stallsResult.success) {
            currentData.stalls = stallsResult.data || [];
            renderStallsManage();
            updateStallSelects();
        }

        if (dishesResult.success) {
            currentData.dishes = dishesResult.data || [];
            renderDishesManage();
        }
    } catch (error) {
        console.error('加载设置数据失败:', error);
    }
}

function renderStallsManage() {
    const container = document.getElementById('stalls-manage-list');
    
    if (currentData.stalls.length === 0) {
        container.innerHTML += '<p class="empty-text">暂无摊位</p>';
        return;
    }

    container.innerHTML += currentData.stalls.map(stall => `
        <div class="stall-item">
            <div class="stall-info">
                <span class="stall-name">${stall.name}</span>
                <span class="stall-contact">
                    ${stall.contact_person ? `联系人: ${stall.contact_person}` : ''}
                    ${stall.phone ? ` | 电话: ${stall.phone}` : ''}
                </span>
            </div>
        </div>
    `).join('');
}

function renderDishesManage() {
    const container = document.getElementById('dishes-manage-list');
    
    if (currentData.dishes.length === 0) {
        container.innerHTML += '<p class="empty-text">暂无菜品</p>';
        return;
    }

    container.innerHTML += currentData.dishes.map(dish => `
        <div class="menu-item">
            <div class="dish-info">
                <span class="dish-name">${dish.name}</span>
                <span class="dish-meta">
                    ${dish.stall_name || '未分配摊位'}
                    ${dish.allergens ? ` | 过敏源: ${dish.allergens}` : ''}
                </span>
            </div>
        </div>
    `).join('');
}

async function addStall() {
    const name = document.getElementById('stall-name').value.trim();
    const contact = document.getElementById('stall-contact').value.trim();
    const phone = document.getElementById('stall-phone').value.trim();

    if (!name) {
        showToast('请输入摊位名称', 'error');
        return;
    }

    try {
        const result = await apiFetch('/stalls', {
            method: 'POST',
            body: JSON.stringify({ name, contact_person: contact, phone })
        });

        if (result.success) {
            document.getElementById('stall-name').value = '';
            document.getElementById('stall-contact').value = '';
            document.getElementById('stall-phone').value = '';
            showToast('摊位已添加', 'success');
            loadSettings();
        }
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

async function addDish() {
    const stallId = document.getElementById('dish-stall').value;
    const name = document.getElementById('dish-name').value.trim();
    
    const selectedAllergens = [];
    document.querySelectorAll('#allergen-checkboxes input:checked').forEach(cb => {
        selectedAllergens.push(cb.value);
    });

    if (!name) {
        showToast('请输入菜品名称', 'error');
        return;
    }

    try {
        const result = await apiFetch('/dishes', {
            method: 'POST',
            body: JSON.stringify({
                stall_id: stallId || null,
                name,
                allergens: selectedAllergens.join(', ')
            })
        });

        if (result.success) {
            document.getElementById('dish-name').value = '';
            document.querySelectorAll('#allergen-checkboxes input').forEach(cb => {
                cb.checked = false;
            });
            showToast('菜品已添加', 'success');
            loadSettings();
        }
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

function parseTextLines(text) {
    return text.trim().split('\n')
        .filter(line => line.trim())
        .map(line => line.split(',').map(item => item.trim()));
}

async function importMenus() {
    const date = document.getElementById('import-menu-date').value || currentDate;
    const stallId = document.getElementById('import-menu-stall').value;
    const text = document.getElementById('import-menu-text').value.trim();

    if (!text) {
        showToast('请输入菜单数据', 'error');
        return;
    }

    const lines = parseTextLines(text);
    const items = [];

    for (const line of lines) {
        const [dishName, quantity, notes, ...allergens] = line;
        if (dishName) {
            items.push({
                date,
                stall_id: stallId || null,
                dish_name: dishName,
                quantity: parseInt(quantity) || 1,
                notes: notes || '',
                allergens: allergens.join(', ') || ''
            });
        }
    }

    if (items.length === 0) {
        showToast('没有解析到有效的菜单数据', 'error');
        return;
    }

    try {
        const result = await apiFetch('/menus/batch', {
            method: 'POST',
            body: JSON.stringify({ items })
        });

        if (result.success) {
            document.getElementById('import-menu-text').value = '';
            showToast(`成功导入 ${result.count} 条菜单`, 'success');
            refreshData();
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

async function importBatches() {
    const text = document.getElementById('import-batch-text').value.trim();

    if (!text) {
        showToast('请输入原料批次数据', 'error');
        return;
    }

    const lines = parseTextLines(text);
    const items = [];

    for (const line of lines) {
        const [name, batchNumber, supplier, expirationDate, quantity, unit, dishName] = line;
        if (name && batchNumber) {
            items.push({
                name,
                batch_number: batchNumber,
                supplier: supplier || '',
                expiration_date: expirationDate || '',
                quantity: quantity || '',
                unit: unit || '',
                dish_name: dishName || ''
            });
        }
    }

    if (items.length === 0) {
        showToast('没有解析到有效的批次数据', 'error');
        return;
    }

    try {
        const result = await apiFetch('/ingredient-batches/batch', {
            method: 'POST',
            body: JSON.stringify({ items })
        });

        if (result.success) {
            document.getElementById('import-batch-text').value = '';
            showToast(`成功导入 ${result.count} 条原料批次`, 'success');
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

async function importTemperatures() {
    const recordType = document.getElementById('import-temp-type').value;
    const text = document.getElementById('import-temp-text').value.trim();

    if (!text) {
        showToast('请输入温度记录数据', 'error');
        return;
    }

    const lines = parseTextLines(text);
    const items = [];

    for (const line of lines) {
        const [dishName, temperature, recordTime, notes] = line;
        if (dishName && temperature) {
            const menuItem = currentData.menus.find(m => 
                m.dish_name === dishName && m.date === currentDate
            );
            
            items.push({
                temperature: parseFloat(temperature),
                record_time: recordTime || new Date().toISOString(),
                record_type: recordType,
                notes: notes || '',
                menu_id: menuItem?.id,
                dish_id: menuItem?.dish_id,
                stall_id: menuItem?.stall_id
            });
        }
    }

    if (items.length === 0) {
        showToast('没有解析到有效的温度数据', 'error');
        return;
    }

    try {
        const result = await apiFetch('/temperature-records/batch', {
            method: 'POST',
            body: JSON.stringify({ items })
        });

        if (result.success) {
            document.getElementById('import-temp-text').value = '';
            showToast(`成功导入 ${result.count} 条温度记录`, 'success');
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

async function importSamples() {
    const text = document.getElementById('import-sample-text').value.trim();

    if (!text) {
        showToast('请输入留样数据', 'error');
        return;
    }

    const lines = parseTextLines(text);
    const items = [];

    for (const line of lines) {
        const [dishName, sampleTime, sampleWeight, keeper, location, photoPath] = line;
        if (dishName) {
            const menuItem = currentData.menus.find(m => 
                m.dish_name === dishName && m.date === currentDate
            );
            
            items.push({
                sample_time: sampleTime || new Date().toISOString(),
                sample_weight: sampleWeight || '',
                keeper: keeper || '',
                location: location || '',
                photo_path: photoPath || '',
                menu_id: menuItem?.id,
                dish_id: menuItem?.dish_id,
                stall_id: menuItem?.stall_id
            });
        }
    }

    if (items.length === 0) {
        showToast('没有解析到有效的留样数据', 'error');
        return;
    }

    try {
        const result = await apiFetch('/samples/batch', {
            method: 'POST',
            body: JSON.stringify({ items })
        });

        if (result.success) {
            document.getElementById('import-sample-text').value = '';
            showToast(`成功导入 ${result.count} 条留样记录`, 'success');
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

async function exportMarkdown() {
    try {
        const dashboard = await apiFetch(`/dashboard?date=${currentDate}`);
        const risks = await apiFetch(`/risks?date=${currentDate}`);
        const reviews = await apiFetch(`/reviews?date=${currentDate}`);

        if (!dashboard.success || !risks.success || !reviews.success) {
            throw new Error('获取数据失败');
        }

        const data = dashboard.data;
        const riskList = risks.data;
        const reviewList = reviews.data;

        let markdown = `# 食品安全交接单\n\n`;
        markdown += `**日期**: ${currentDate}\n\n`;
        markdown += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
        markdown += `---\n\n`;

        markdown += `## 📊 当日概览\n\n`;
        markdown += `- **摊位数量**: ${data.stats.total_stalls || 0}\n`;
        markdown += `- **菜品总数**: ${data.stats.total_menus || 0}\n`;
        markdown += `- **已复核**: ${data.stats.reviewed || 0}\n`;
        markdown += `- **待复核**: ${data.stats.pending || 0}\n`;
        markdown += `- **通过**: ${data.stats.passed || 0}\n`;
        markdown += `- **不通过**: ${data.stats.failed || 0}\n`;
        markdown += `- **风险项总数**: ${data.stats.total_risks || 0}\n`;
        markdown += `  - 严重: ${data.stats.critical_risks || 0}\n`;
        markdown += `  - 高: ${data.stats.high_risks || 0}\n`;
        markdown += `  - 中: ${data.stats.medium_risks || 0}\n\n`;

        markdown += `---\n\n`;
        markdown += `## 🏪 今日摊位\n\n`;

        if (data.stalls && data.stalls.length > 0) {
            data.stalls.forEach(stall => {
                markdown += `### ${stall.name}\n\n`;
                if (stall.contact_person || stall.phone) {
                    markdown += `- 联系人: ${stall.contact_person || '-'}\n`;
                    markdown += `- 电话: ${stall.phone || '-'}\n\n`;
                }

                const stallDishes = data.menus.filter(m => m.stall_id === stall.id);
                if (stallDishes.length > 0) {
                    markdown += `#### 今日菜品\n\n`;
                    stallDishes.forEach(dish => {
                        const review = reviewList.find(r => r.menu_id === dish.id);
                        const status = review ? getStatusLabel(review.overall_status) : '未开始';
                        markdown += `- **${dish.dish_name}** (${dish.quantity || 1}份)`;
                        if (dish.allergens) {
                            markdown += ` - 过敏源: ${dish.allergens}`;
                        }
                        markdown += ` - 复核状态: ${status}\n`;
                    });
                    markdown += `\n`;
                }
            });
        } else {
            markdown += `暂无摊位数据\n\n`;
        }

        markdown += `---\n\n`;
        markdown += `## 🚨 风险清单\n\n`;

        if (riskList.length > 0) {
            const byLevel = {
                critical: riskList.filter(r => r.risk_level === 'critical'),
                high: riskList.filter(r => r.risk_level === 'high'),
                medium: riskList.filter(r => r.risk_level === 'medium'),
                low: riskList.filter(r => r.risk_level === 'low')
            };

            ['critical', 'high', 'medium', 'low'].forEach(level => {
                if (byLevel[level].length > 0) {
                    markdown += `### ${getRiskLevelLabel(level)} (${byLevel[level].length}项)\n\n`;
                    byLevel[level].forEach(risk => {
                        markdown += `#### ${getRiskTypeLabel(risk.risk_type)}\n\n`;
                        markdown += `- **摊位**: ${risk.stall_name || '-'}\n`;
                        markdown += `- **菜品**: ${risk.dish_name || '-'}\n`;
                        markdown += `- **描述**: ${risk.description}\n`;
                        if (risk.suggestion) {
                            markdown += `- **建议**: ${risk.suggestion}\n`;
                        }
                        markdown += `- **状态**: ${risk.status}\n`;
                        markdown += `\n`;
                    });
                }
            });
        } else {
            markdown += `✅ 当日无风险项\n\n`;
        }

        markdown += `---\n\n`;
        markdown += `## 📝 复核记录\n\n`;

        if (reviewList.length > 0) {
            markdown += `| 菜品 | 摊位 | 过敏源 | 留样 | 冷却 | 批次 | 总体 | 备注 |\n`;
            markdown += `|------|------|--------|------|------|------|------|------|\n`;

            reviewList.forEach(review => {
                markdown += `| ${review.dish_name} | ${review.stall_name} | `;
                markdown += `${getStatusLabel(review.allergen_status)} | `;
                markdown += `${getStatusLabel(review.sample_status)} | `;
                markdown += `${getStatusLabel(review.cooling_status)} | `;
                markdown += `${getStatusLabel(review.batch_status)} | `;
                markdown += `${getStatusLabel(review.overall_status)} | `;
                markdown += `${review.notes || '-'} |\n`;
            });
            markdown += `\n`;
        } else {
            markdown += `暂无复核记录\n\n`;
        }

        markdown += `---\n\n`;
        markdown += `## 📋 交接说明\n\n`;
        markdown += `_此交接单由系统自动生成，请核对各项内容。如有问题请及时处理。_\n\n`;
        markdown += `**审核人**: _______________\n\n`;
        markdown += `**日期**: _______________\n`;

        document.getElementById('markdown-content').textContent = markdown;
        document.getElementById('markdown-preview').style.display = 'block';

        downloadFile(markdown, `食安交接单_${currentDate}.md`, 'text/markdown');
        showToast('Markdown 交接单已生成并下载', 'success');

    } catch (error) {
        showToast('生成失败: ' + error.message, 'error');
    }
}

async function exportCSV() {
    try {
        const risks = await apiFetch(`/risks?date=${currentDate}`);

        if (!risks.success) {
            throw new Error('获取数据失败');
        }

        const riskList = risks.data;

        let csv = '\uFEFF';
        csv += '风险类型,风险等级,摊位,菜品,描述,建议,状态,创建时间\n';

        riskList.forEach(risk => {
            csv += `"${getRiskTypeLabel(risk.risk_type)}",`;
            csv += `"${getRiskLevelLabel(risk.risk_level)}",`;
            csv += `"${risk.stall_name || ''}",`;
            csv += `"${risk.dish_name || ''}",`;
            csv += `"${risk.description || ''}",`;
            csv += `"${risk.suggestion || ''}",`;
            csv += `"${risk.status}",`;
            csv += `"${risk.created_at}"\n`;
        });

        downloadFile(csv, `风险清单_${currentDate}.csv`, 'text/csv;charset=utf-8');
        showToast('CSV 风险清单已下载', 'success');

    } catch (error) {
        showToast('生成失败: ' + error.message, 'error');
    }
}

async function exportJSON() {
    try {
        const dashboard = await apiFetch(`/dashboard?date=${currentDate}`);
        const risks = await apiFetch(`/risks?date=${currentDate}`);
        const reviews = await apiFetch(`/reviews?date=${currentDate}`);
        const menus = await apiFetch(`/menus?date=${currentDate}`);

        const [batches, temps, samples] = await Promise.all([
            apiFetch('/ingredient-batches'),
            apiFetch('/temperature-records'),
            apiFetch('/samples')
        ]);

        const auditPackage = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            date: currentDate,
            summary: dashboard.data?.stats,
            stalls: dashboard.data?.stalls || [],
            menus: menus.data || [],
            reviews: reviews.data || [],
            risks: risks.data || [],
            ingredient_batches: batches.data || [],
            temperature_records: temps.data || [],
            samples: samples.data || []
        };

        const json = JSON.stringify(auditPackage, null, 2);
        downloadFile(json, `审计包_${currentDate}.json`, 'application/json');
        showToast('JSON 审计包已下载', 'success');

    } catch (error) {
        showToast('生成失败: ' + error.message, 'error');
    }
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showModal(title, body, footer) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer || '';
    document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toast-message');

    toast.className = 'toast';
    if (type) {
        toast.classList.add(type);
    }

    messageEl.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}
