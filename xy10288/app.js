const STORAGE_KEY = 'market_stall_lottery_workspace';

let workspace = {
    vendors: [],
    stalls: [],
    categories: [],
    constraints: [],
    rules: {
        oldVendorPriority: true,
        categoryConstraint: true,
        randomize: true
    },
    results: [],
    isFrozen: false,
    lotteryLog: []
};

let editingVendorId = null;
let editingStallId = null;
let editingCategoryId = null;
let appealStallId = null;

function init() {
    loadWorkspace();
    bindEvents();
    renderAll();
    showToast('欢迎使用乡镇集市摊位抽签器！', 'info');
}

function loadWorkspace() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            workspace = JSON.parse(saved);
            showToast('已恢复之前的工作区', 'success');
        } catch (e) {
            console.error('Failed to load workspace:', e);
            initDefaultWorkspace();
        }
    } else {
        initDefaultWorkspace();
    }
}

function initDefaultWorkspace() {
    workspace = {
        vendors: [],
        stalls: [],
        categories: [],
        constraints: [],
        rules: {
            oldVendorPriority: true,
            categoryConstraint: true,
            randomize: true
        },
        results: [],
        isFrozen: false,
        lotteryLog: []
    };
}

function saveWorkspace() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('loadSampleSuccess').addEventListener('click', () => loadSampleData('success'));
    document.getElementById('loadSampleConflict').addEventListener('click', () => loadSampleData('conflict'));
    document.getElementById('clearAll').addEventListener('click', clearAll);

    document.getElementById('addVendorBtn').addEventListener('click', showVendorForm);
    document.getElementById('saveVendorBtn').addEventListener('click', saveVendor);
    document.getElementById('cancelVendorBtn').addEventListener('click', hideVendorForm);

    document.getElementById('addStallBtn').addEventListener('click', showStallForm);
    document.getElementById('saveStallBtn').addEventListener('click', saveStall);
    document.getElementById('cancelStallBtn').addEventListener('click', hideStallForm);

    document.getElementById('addCategoryBtn').addEventListener('click', showCategoryForm);
    document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);
    document.getElementById('cancelCategoryBtn').addEventListener('click', hideCategoryForm);

    document.getElementById('addConstraintBtn').addEventListener('click', showConstraintForm);
    document.getElementById('saveConstraintBtn').addEventListener('click', saveConstraint);
    document.getElementById('cancelConstraintBtn').addEventListener('click', hideConstraintForm);

    document.getElementById('runPrecheckBtn').addEventListener('click', runPrecheck);
    document.getElementById('startLotteryBtn').addEventListener('click', startLottery);
    document.getElementById('resetLotteryBtn').addEventListener('click', resetLottery);

    document.getElementById('freezeResultsBtn').addEventListener('click', freezeResults);
    document.getElementById('unfreezeResultsBtn').addEventListener('click', unfreezeResults);
    document.getElementById('saveAppealBtn').addEventListener('click', saveAppeal);
    document.getElementById('cancelAppealBtn').addEventListener('click', hideAppealForm);

    document.getElementById('exportVendorsBtn').addEventListener('click', () => exportToCSV('vendors'));
    document.getElementById('exportStallsBtn').addEventListener('click', () => exportToCSV('stalls'));
    document.getElementById('exportResultsBtn').addEventListener('click', () => exportToCSV('results'));
    document.getElementById('exportWorkspaceBtn').addEventListener('click', exportWorkspace);
    document.getElementById('importWorkspaceBtn').addEventListener('click', importWorkspace);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

function loadSampleData(type) {
    if (confirm('加载样例数据将覆盖当前工作区，确定继续吗？')) {
        workspace = JSON.parse(JSON.stringify(sampleData[type]));
        saveWorkspace();
        renderAll();
        showToast(type === 'success' ? '顺利样例已加载' : '冲突样例已加载', 'success');
    }
}

function clearAll() {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
        initDefaultWorkspace();
        saveWorkspace();
        renderAll();
        showToast('所有数据已清空', 'warning');
    }
}

function renderAll() {
    renderVendors();
    renderStalls();
    renderCategories();
    renderConstraints();
    renderResults();
    updateStats();
    updateFrozenUI();
}

function updateStats() {
    const totalVendors = workspace.vendors.length;
    const oldVendors = workspace.vendors.filter(v => v.type === 'old').length;
    const newVendors = workspace.vendors.filter(v => v.type === 'new').length;
    
    document.getElementById('totalVendors').textContent = totalVendors;
    document.getElementById('oldVendors').textContent = oldVendors;
    document.getElementById('newVendors').textContent = newVendors;
    document.getElementById('totalCategories').textContent = workspace.categories.length;

    const totalStalls = workspace.stalls.length;
    const assignedStalls = workspace.stalls.filter(s => s.status === 'assigned').length;
    const availableStalls = totalStalls - assignedStalls;
    
    document.getElementById('totalStalls').textContent = totalStalls;
    document.getElementById('availableStalls').textContent = availableStalls;
    document.getElementById('assignedStalls').textContent = assignedStalls;

    const results = workspace.results;
    const resultTotal = results.length;
    const resultOld = results.filter(r => r.vendorType === 'old').length;
    const resultNew = results.filter(r => r.vendorType === 'new').length;
    const resultPending = results.filter(r => r.status === 'pending').length;
    
    document.getElementById('resultTotal').textContent = resultTotal;
    document.getElementById('resultOld').textContent = resultOld;
    document.getElementById('resultNew').textContent = resultNew;
    document.getElementById('resultPending').textContent = resultPending;
}

function renderVendors() {
    const tbody = document.querySelector('#vendorTable tbody');
    tbody.innerHTML = '';

    const categorySelect = document.getElementById('vendorCategory');
    categorySelect.innerHTML = '<option value="">请选择品类</option>';
    workspace.categories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });

    workspace.vendors.forEach((vendor, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${vendor.name}</td>
            <td>${vendor.phone || '-'}</td>
            <td>${vendor.category}</td>
            <td><span class="badge ${vendor.type === 'old' ? 'badge-old' : 'badge-new'}">${vendor.type === 'old' ? '老摊主' : '新摊主'}</span></td>
            <td>
                <button class="btn btn-info action-btn" onclick="editVendor('${vendor.id}')">编辑</button>
                <button class="btn btn-danger action-btn" onclick="deleteVendor('${vendor.id}')">删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showVendorForm(vendor = null) {
    editingVendorId = vendor ? vendor.id : null;
    document.getElementById('vendorForm').classList.remove('hidden');
    
    if (vendor) {
        document.getElementById('vendorName').value = vendor.name;
        document.getElementById('vendorPhone').value = vendor.phone || '';
        document.getElementById('vendorCategory').value = vendor.category;
        document.getElementById('vendorType').value = vendor.type;
    } else {
        document.getElementById('vendorName').value = '';
        document.getElementById('vendorPhone').value = '';
        document.getElementById('vendorCategory').value = '';
        document.getElementById('vendorType').value = 'new';
    }
}

function hideVendorForm() {
    editingVendorId = null;
    document.getElementById('vendorForm').classList.add('hidden');
}

function saveVendor() {
    const name = document.getElementById('vendorName').value.trim();
    const phone = document.getElementById('vendorPhone').value.trim();
    const category = document.getElementById('vendorCategory').value;
    const type = document.getElementById('vendorType').value;

    if (!name) {
        showToast('请输入摊主姓名', 'error');
        return;
    }
    if (!category) {
        showToast('请选择经营品类', 'error');
        return;
    }

    if (editingVendorId) {
        const index = workspace.vendors.findIndex(v => v.id === editingVendorId);
        if (index !== -1) {
            workspace.vendors[index] = { ...workspace.vendors[index], name, phone, category, type };
            showToast('摊主信息已更新', 'success');
        }
    } else {
        workspace.vendors.push({
            id: `v${Date.now()}`,
            name,
            phone,
            category,
            type
        });
        showToast('摊主已添加', 'success');
    }

    hideVendorForm();
    saveWorkspace();
    renderAll();
}

function editVendor(id) {
    const vendor = workspace.vendors.find(v => v.id === id);
    if (vendor) {
        showVendorForm(vendor);
    }
}

function deleteVendor(id) {
    if (confirm('确定要删除该摊主吗？')) {
        workspace.vendors = workspace.vendors.filter(v => v.id !== id);
        saveWorkspace();
        renderAll();
        showToast('摊主已删除', 'success');
    }
}

function renderStalls() {
    const tbody = document.querySelector('#stallTable tbody');
    tbody.innerHTML = '';

    workspace.stalls.forEach(stall => {
        const assignedVendor = workspace.vendors.find(v => {
            const result = workspace.results.find(r => r.stallId === stall.id);
            return result && result.vendorId === v.id;
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${stall.number}</td>
            <td>${stall.zone || '-'}</td>
            <td>${stall.position || '-'}</td>
            <td><span class="badge ${stall.status === 'assigned' ? 'badge-success' : 'badge-new'}">${stall.status === 'assigned' ? '已分配' : '可用'}</span></td>
            <td>${assignedVendor ? assignedVendor.name : '-'}</td>
            <td>
                <button class="btn btn-info action-btn" onclick="editStall('${stall.id}')">编辑</button>
                <button class="btn btn-danger action-btn" onclick="deleteStall('${stall.id}')">删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showStallForm(stall = null) {
    editingStallId = stall ? stall.id : null;
    document.getElementById('stallForm').classList.remove('hidden');
    
    if (stall) {
        document.getElementById('stallNumber').value = stall.number;
        document.getElementById('stallZone').value = stall.zone || '';
        document.getElementById('stallPosition').value = stall.position || '';
    } else {
        document.getElementById('stallNumber').value = '';
        document.getElementById('stallZone').value = '';
        document.getElementById('stallPosition').value = '';
    }
}

function hideStallForm() {
    editingStallId = null;
    document.getElementById('stallForm').classList.add('hidden');
}

function saveStall() {
    const number = document.getElementById('stallNumber').value.trim();
    const zone = document.getElementById('stallZone').value.trim();
    const position = document.getElementById('stallPosition').value;

    if (!number) {
        showToast('请输入摊位编号', 'error');
        return;
    }

    if (editingStallId) {
        const index = workspace.stalls.findIndex(s => s.id === editingStallId);
        if (index !== -1) {
            workspace.stalls[index] = { ...workspace.stalls[index], number, zone, position: position ? parseInt(position) : null };
            showToast('摊位信息已更新', 'success');
        }
    } else {
        workspace.stalls.push({
            id: `s${Date.now()}`,
            number,
            zone,
            position: position ? parseInt(position) : null,
            status: 'available'
        });
        showToast('摊位已添加', 'success');
    }

    hideStallForm();
    saveWorkspace();
    renderAll();
}

function editStall(id) {
    const stall = workspace.stalls.find(s => s.id === id);
    if (stall) {
        showStallForm(stall);
    }
}

function deleteStall(id) {
    if (confirm('确定要删除该摊位吗？')) {
        workspace.stalls = workspace.stalls.filter(s => s.id !== id);
        workspace.results = workspace.results.filter(r => r.stallId !== id);
        saveWorkspace();
        renderAll();
        showToast('摊位已删除', 'success');
    }
}

function renderCategories() {
    const tbody = document.querySelector('#categoryTable tbody');
    tbody.innerHTML = '';

    workspace.categories.forEach(cat => {
        const count = workspace.vendors.filter(v => v.category === cat.name).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cat.name}</td>
            <td>${count}</td>
            <td>
                <button class="btn btn-danger action-btn" onclick="deleteCategory('${cat.id}')">删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showCategoryForm() {
    editingCategoryId = null;
    document.getElementById('categoryForm').classList.remove('hidden');
    document.getElementById('categoryName').value = '';
}

function hideCategoryForm() {
    editingCategoryId = null;
    document.getElementById('categoryForm').classList.add('hidden');
}

function saveCategory() {
    const name = document.getElementById('categoryName').value.trim();
    
    if (!name) {
        showToast('请输入品类名称', 'error');
        return;
    }

    if (workspace.categories.some(c => c.name === name)) {
        showToast('该品类已存在', 'error');
        return;
    }

    workspace.categories.push({
        id: `c${Date.now()}`,
        name
    });

    hideCategoryForm();
    saveWorkspace();
    renderAll();
    showToast('品类已添加', 'success');
}

function deleteCategory(id) {
    const category = workspace.categories.find(c => c.id === id);
    if (category) {
        const vendorCount = workspace.vendors.filter(v => v.category === category.name).length;
        if (vendorCount > 0) {
            showToast(`该品类下有 ${vendorCount} 个摊主，无法删除`, 'error');
            return;
        }
        if (confirm('确定要删除该品类吗？')) {
            workspace.categories = workspace.categories.filter(c => c.id !== id);
            workspace.constraints = workspace.constraints.filter(c => 
                c.categoryA !== category.name && c.categoryB !== category.name
            );
            saveWorkspace();
            renderAll();
            showToast('品类已删除', 'success');
        }
    }
}

function renderConstraints() {
    const tbody = document.querySelector('#constraintTable tbody');
    tbody.innerHTML = '';

    const selectA = document.getElementById('constraintCategoryA');
    const selectB = document.getElementById('constraintCategoryB');
    selectA.innerHTML = '<option value="">请选择</option>';
    selectB.innerHTML = '<option value="">请选择</option>';
    workspace.categories.forEach(cat => {
        selectA.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
        selectB.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });

    workspace.constraints.forEach(constraint => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>【${constraint.categoryA}】 ↔ 【${constraint.categoryB}】</td>
            <td>
                <button class="btn btn-danger action-btn" onclick="deleteConstraint('${constraint.id}')">删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showConstraintForm() {
    document.getElementById('constraintForm').classList.remove('hidden');
    document.getElementById('constraintCategoryA').value = '';
    document.getElementById('constraintCategoryB').value = '';
}

function hideConstraintForm() {
    document.getElementById('constraintForm').classList.add('hidden');
}

function saveConstraint() {
    const catA = document.getElementById('constraintCategoryA').value;
    const catB = document.getElementById('constraintCategoryB').value;

    if (!catA || !catB) {
        showToast('请选择两个品类', 'error');
        return;
    }

    if (catA === catB) {
        showToast('不能选择相同的品类', 'error');
        return;
    }

    const exists = workspace.constraints.some(c => 
        (c.categoryA === catA && c.categoryB === catB) ||
        (c.categoryA === catB && c.categoryB === catA)
    );

    if (exists) {
        showToast('该约束已存在', 'error');
        return;
    }

    workspace.constraints.push({
        id: `cons${Date.now()}`,
        categoryA: catA,
        categoryB: catB
    });

    hideConstraintForm();
    saveWorkspace();
    renderAll();
    showToast('约束已添加', 'success');
}

function deleteConstraint(id) {
    if (confirm('确定要删除该约束吗？')) {
        workspace.constraints = workspace.constraints.filter(c => c.id !== id);
        saveWorkspace();
        renderAll();
        showToast('约束已删除', 'success');
    }
}

function runPrecheck() {
    const resultDiv = document.getElementById('precheckResult');
    const errors = [];
    const warnings = [];
    const infos = [];

    if (workspace.vendors.length === 0) {
        errors.push('❌ 请至少添加一位摊主');
    } else {
        infos.push(`✅ 已添加 ${workspace.vendors.length} 位摊主`);
    }

    if (workspace.stalls.length === 0) {
        errors.push('❌ 请至少添加一个摊位');
    } else {
        infos.push(`✅ 已配置 ${workspace.stalls.length} 个摊位`);
    }

    if (workspace.categories.length === 0) {
        errors.push('❌ 请至少添加一个品类');
    } else {
        infos.push(`✅ 已配置 ${workspace.categories.length} 个品类`);
    }

    if (workspace.vendors.length > 0 && workspace.stalls.length > 0) {
        if (workspace.vendors.length > workspace.stalls.length) {
            warnings.push(`⚠️ 摊主数量(${workspace.vendors.length})大于摊位数量(${workspace.stalls.length})，部分摊主可能无法分配`);
        } else if (workspace.vendors.length < workspace.stalls.length) {
            warnings.push(`⚠️ 摊位数量(${workspace.stalls.length})大于摊主数量(${workspace.vendors.length})，部分摊位将空置`);
        }
    }

    const vendorsWithoutCategory = workspace.vendors.filter(v => 
        !workspace.categories.some(c => c.name === v.category)
    );
    if (vendorsWithoutCategory.length > 0) {
        errors.push(`❌ 有 ${vendorsWithoutCategory.length} 位摊主的品类不在品类列表中`);
    }

    if (workspace.constraints.length > 0) {
        infos.push(`✅ 已配置 ${workspace.constraints.length} 条相邻约束`);
    } else {
        warnings.push('⚠️ 未配置任何相邻约束');
    }

    const oldVendors = workspace.vendors.filter(v => v.type === 'old').length;
    const newVendors = workspace.vendors.filter(v => v.type === 'new').length;
    infos.push(`📊 老摊主: ${oldVendors} 位，新摊主: ${newVendors} 位`);

    let html = '';
    if (errors.length > 0) {
        html += '<div class="precheck-error">';
        html += '<strong>❌ 检查失败，请修复以下问题：</strong>';
        html += '<ul>' + errors.map(e => `<li>${e}</li>`).join('') + '</ul>';
        html += '</div>';
    }
    if (warnings.length > 0) {
        html += '<div class="precheck-warning" style="margin-top: 10px;">';
        html += '<strong>⚠️ 警告：</strong>';
        html += '<ul>' + warnings.map(w => `<li>${w}</li>`).join('') + '</ul>';
        html += '</div>';
    }
    if (infos.length > 0) {
        html += '<div class="precheck-success" style="margin-top: 10px;">';
        html += '<strong>📋 检查信息：</strong>';
        html += '<ul>' + infos.map(i => `<li>${i}</li>`).join('') + '</ul>';
        html += '</div>';
    }

    if (errors.length === 0) {
        html = '<div class="precheck-success"><strong>✅ 检查通过，可以开始抽签！</strong></div>' + html;
    }

    resultDiv.innerHTML = html;

    return errors.length === 0;
}

function startLottery() {
    if (!runPrecheck()) {
        showToast('抽签前检查未通过，请先修复问题', 'error');
        return;
    }

    if (workspace.isFrozen) {
        showToast('结果已冻结，请先解冻再重新抽签', 'error');
        return;
    }

    const rules = {
        oldVendorPriority: document.getElementById('ruleOldVendorPriority').checked,
        categoryConstraint: document.getElementById('ruleCategoryConstraint').checked,
        randomize: document.getElementById('ruleRandomize').checked
    };

    workspace.rules = rules;
    workspace.lotteryLog = [];

    const logContainer = document.getElementById('lotteryProcess');
    const logDiv = document.getElementById('lotteryLog');
    logContainer.classList.remove('hidden');
    logDiv.innerHTML = '';

    addLogStep('开始抽签准备...');
    addLogInfo(`老摊主优先: ${rules.oldVendorPriority ? '是' : '否'}`);
    addLogInfo(`品类约束: ${rules.categoryConstraint ? '是' : '否'}`);
    addLogInfo(`随机打乱: ${rules.randomize ? '是' : '否'}`);

    workspace.results = [];
    workspace.stalls.forEach(s => s.status = 'available');

    addLogStep('准备摊主列表...');
    let vendors = [...workspace.vendors];
    let stalls = [...workspace.stalls].sort((a, b) => (a.position || 0) - (b.position || 0));

    if (rules.randomize) {
        addLogInfo('随机打乱摊主顺序...');
        vendors = shuffleArray(vendors);
    }

    let oldVendors = [];
    let newVendors = [];

    if (rules.oldVendorPriority) {
        oldVendors = vendors.filter(v => v.type === 'old');
        newVendors = vendors.filter(v => v.type === 'new');
        addLogInfo(`分离出 ${oldVendors.length} 位老摊主，${newVendors.length} 位新摊主`);
    } else {
        newVendors = vendors;
    }

    let stallAssignment = new Map();
    let availableStalls = [...stalls];

    addLogStep('开始分配老摊主摊位...');
    for (const vendor of oldVendors) {
        const assigned = assignStall(vendor, availableStalls, stallAssignment, rules);
        if (assigned) {
            availableStalls = availableStalls.filter(s => s.id !== assigned.id);
            addLogSuccess(`✓ 老摊主【${vendor.name}】(${vendor.category}) → 摊位 ${assigned.number}`);
        } else {
            addLogWarning(`⚠ 老摊主【${vendor.name}】(${vendor.category}) 无法找到合适摊位`);
        }
    }

    addLogStep('开始分配新摊主摊位...');
    for (const vendor of newVendors) {
        const assigned = assignStall(vendor, availableStalls, stallAssignment, rules);
        if (assigned) {
            availableStalls = availableStalls.filter(s => s.id !== assigned.id);
            addLogSuccess(`✓ 新摊主【${vendor.name}】(${vendor.category}) → 摊位 ${assigned.number}`);
        } else {
            addLogWarning(`⚠ 新摊主【${vendor.name}】(${vendor.category}) 无法找到合适摊位`);
        }
    }

    addLogStep('抽签完成！');
    addLogInfo(`成功分配: ${workspace.results.length} 位`);
    addLogInfo(`未分配: ${workspace.vendors.length - workspace.results.length} 位`);
    addLogInfo(`剩余摊位: ${availableStalls.length} 个`);

    saveWorkspace();
    renderAll();
    showToast('抽签完成！', 'success');
}

function assignStall(vendor, availableStalls, stallAssignment, rules) {
    for (const stall of availableStalls) {
        if (rules.categoryConstraint) {
            const neighbors = getNeighbors(stall, stallAssignment);
            let hasConflict = false;
            
            for (const neighbor of neighbors) {
                if (hasConstraint(vendor.category, neighbor.category)) {
                    hasConflict = true;
                    break;
                }
            }
            
            if (hasConflict) continue;
        }

        stallAssignment.set(stall.id, {
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorCategory: vendor.category,
            vendorType: vendor.type
        });

        const stallIndex = workspace.stalls.findIndex(s => s.id === stall.id);
        if (stallIndex !== -1) {
            workspace.stalls[stallIndex].status = 'assigned';
        }

        workspace.results.push({
            stallId: stall.id,
            stallNumber: stall.number,
            stallZone: stall.zone,
            stallPosition: stall.position,
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorCategory: vendor.category,
            vendorType: vendor.type,
            status: 'success',
            appealReason: ''
        });

        return stall;
    }

    return null;
}

function getNeighbors(stall, stallAssignment) {
    const neighbors = [];
    const pos = stall.position;
    const zone = stall.zone;

    workspace.stalls.forEach(s => {
        if (s.id === stall.id) return;
        if (s.zone !== zone) return;
        if (s.position === pos - 1 || s.position === pos + 1) {
            const assigned = stallAssignment.get(s.id);
            if (assigned) {
                neighbors.push(assigned);
            }
        }
    });

    return neighbors;
}

function hasConstraint(cat1, cat2) {
    return workspace.constraints.some(c => 
        (c.categoryA === cat1 && c.categoryB === cat2) ||
        (c.categoryA === cat2 && c.categoryB === cat1)
    );
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function addLogStep(message) {
    const logDiv = document.getElementById('lotteryLog');
    logDiv.innerHTML += `<div class="log-step">📌 ${message}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    workspace.lotteryLog.push({ type: 'step', message, time: new Date().toISOString() });
}

function addLogInfo(message) {
    const logDiv = document.getElementById('lotteryLog');
    logDiv.innerHTML += `<div class="log-info">ℹ️ ${message}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    workspace.lotteryLog.push({ type: 'info', message, time: new Date().toISOString() });
}

function addLogSuccess(message) {
    const logDiv = document.getElementById('lotteryLog');
    logDiv.innerHTML += `<div class="log-success">${message}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    workspace.lotteryLog.push({ type: 'success', message, time: new Date().toISOString() });
}

function addLogWarning(message) {
    const logDiv = document.getElementById('lotteryLog');
    logDiv.innerHTML += `<div class="log-warning">${message}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    workspace.lotteryLog.push({ type: 'warning', message, time: new Date().toISOString() });
}

function resetLottery() {
    if (workspace.isFrozen) {
        showToast('结果已冻结，无法重置', 'error');
        return;
    }
    if (confirm('确定要重置抽签结果吗？')) {
        workspace.results = [];
        workspace.lotteryLog = [];
        workspace.stalls.forEach(s => s.status = 'available');
        document.getElementById('lotteryProcess').classList.add('hidden');
        saveWorkspace();
        renderAll();
        showToast('抽签结果已重置', 'success');
    }
}

function renderResults() {
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';

    const sortedResults = [...workspace.results].sort((a, b) => {
        const posA = a.stallPosition || 0;
        const posB = b.stallPosition || 0;
        return posA - posB;
    });

    sortedResults.forEach(result => {
        const neighbors = getNeighborCategories(result);
        const statusClass = result.status === 'pending' ? 'badge-pending' : 'badge-success';
        const statusText = result.status === 'pending' ? '待复核' : '正常';
        
        const tr = document.createElement('tr');
        if (result.status === 'pending') {
            tr.classList.add('pending-row');
        }
        tr.innerHTML = `
            <td>${result.stallNumber}</td>
            <td>${result.stallZone || '-'}</td>
            <td>${result.vendorName}</td>
            <td>${result.vendorCategory}</td>
            <td><span class="badge ${result.vendorType === 'old' ? 'badge-old' : 'badge-new'}">${result.vendorType === 'old' ? '老摊主' : '新摊主'}</span></td>
            <td>${neighbors || '-'}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                ${!workspace.isFrozen ? `
                <button class="btn btn-warning action-btn" onclick="showAppealForm('${result.stallId}')">申诉</button>
                ` : '<span class="badge badge-frozen">已冻结</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getNeighborCategories(result) {
    const neighbors = [];
    const pos = result.stallPosition;
    const zone = result.stallZone;

    workspace.results.forEach(r => {
        if (r.stallId === result.stallId) return;
        if (r.stallZone !== zone) return;
        if (r.stallPosition === pos - 1 || r.stallPosition === pos + 1) {
            neighbors.push(r.vendorCategory);
        }
    });

    return neighbors.length > 0 ? neighbors.join(', ') : null;
}

function freezeResults() {
    if (workspace.results.length === 0) {
        showToast('没有可冻结的结果', 'error');
        return;
    }
    if (confirm('确定要冻结结果吗？冻结后将无法修改！')) {
        workspace.isFrozen = true;
        saveWorkspace();
        renderAll();
        showToast('结果已冻结', 'success');
    }
}

function unfreezeResults() {
    if (confirm('确定要解冻结果吗？')) {
        workspace.isFrozen = false;
        saveWorkspace();
        renderAll();
        showToast('结果已解冻', 'success');
    }
}

function updateFrozenUI() {
    const freezeBtn = document.getElementById('freezeResultsBtn');
    const unfreezeBtn = document.getElementById('unfreezeResultsBtn');
    const banner = document.getElementById('frozenBanner');

    if (workspace.isFrozen) {
        freezeBtn.classList.add('hidden');
        unfreezeBtn.classList.remove('hidden');
        banner.classList.remove('hidden');
    } else {
        freezeBtn.classList.remove('hidden');
        unfreezeBtn.classList.add('hidden');
        banner.classList.add('hidden');
    }
}

function showAppealForm(stallId) {
    appealStallId = stallId;
    document.getElementById('appealForm').classList.remove('hidden');
    document.getElementById('appealReason').value = '';
}

function hideAppealForm() {
    appealStallId = null;
    document.getElementById('appealForm').classList.add('hidden');
}

function saveAppeal() {
    const reason = document.getElementById('appealReason').value.trim();
    if (!reason) {
        showToast('请输入申诉原因', 'error');
        return;
    }

    const resultIndex = workspace.results.findIndex(r => r.stallId === appealStallId);
    if (resultIndex !== -1) {
        workspace.results[resultIndex].status = 'pending';
        workspace.results[resultIndex].appealReason = reason;
        saveWorkspace();
        renderAll();
        showToast('已标记为待复核', 'success');
    }

    hideAppealForm();
}

function exportToCSV(type) {
    let data = [];
    let headers = [];
    let filename = '';

    switch (type) {
        case 'vendors':
            headers = ['序号', '姓名', '联系电话', '经营品类', '摊主类型'];
            data = workspace.vendors.map((v, i) => [
                i + 1,
                v.name,
                v.phone || '',
                v.category,
                v.type === 'old' ? '老摊主' : '新摊主'
            ]);
            filename = `摊主名单_${new Date().toISOString().slice(0, 10)}.csv`;
            break;
        case 'stalls':
            headers = ['摊位编号', '区域', '位置', '状态'];
            data = workspace.stalls.map(s => [
                s.number,
                s.zone || '',
                s.position || '',
                s.status === 'assigned' ? '已分配' : '可用'
            ]);
            filename = `摊位信息_${new Date().toISOString().slice(0, 10)}.csv`;
            break;
        case 'results':
            headers = ['摊位编号', '区域', '摊主姓名', '经营品类', '摊主类型', '状态'];
            data = workspace.results.map(r => [
                r.stallNumber,
                r.stallZone || '',
                r.vendorName,
                r.vendorCategory,
                r.vendorType === 'old' ? '老摊主' : '新摊主',
                r.status === 'pending' ? '待复核' : '正常'
            ]);
            filename = `抽签结果_${new Date().toISOString().slice(0, 10)}.csv`;
            break;
    }

    if (data.length === 0) {
        showToast('没有可导出的数据', 'error');
        return;
    }

    const csvContent = [headers.join(','), ...data.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const BOM = '\uFEFF';
    
    downloadFile(BOM + csvContent, filename, 'text/csv;charset=utf-8');
    showToast('导出成功', 'success');
}

function exportWorkspace() {
    const jsonContent = JSON.stringify(workspace, null, 2);
    const filename = `工作区备份_${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(jsonContent, filename, 'application/json');
    showToast('工作区已导出', 'success');
}

function importWorkspace() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('请选择要导入的文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (confirm('导入将覆盖当前工作区，确定继续吗？')) {
                workspace = imported;
                saveWorkspace();
                renderAll();
                showToast('工作区已导入', 'success');
            }
        } catch (err) {
            showToast('文件格式错误，请选择有效的JSON文件', 'error');
        }
    };
    reader.readAsText(file);
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

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
