const state = {
    pickupOrders: [],
    careProcesses: [],
    reviewRecords: [],
    expressAppointments: [],
    recheckResults: [],
    overrides: [],
    notes: [],
    currentModalType: null,
    currentEditingOrder: null
};

const API_BASE = '';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFileInputs();
    initFilter();
    loadData();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
    
    if (tabId === 'export') {
        updateDataSummary();
    }
}

function initFileInputs() {
    document.getElementById('pickupFile').addEventListener('change', (e) => handleFileImport(e, 'pickup'));
    document.getElementById('careFile').addEventListener('change', (e) => handleFileImport(e, 'care'));
    document.getElementById('reviewFile').addEventListener('change', (e) => handleFileImport(e, 'review'));
    document.getElementById('expressFile').addEventListener('change', (e) => handleFileImport(e, 'express'));
}

function initFilter() {
    document.getElementById('filterStatus').addEventListener('change', renderRecheckResults);
}

async function loadData() {
    try {
        const response = await fetch(`${API_BASE}/api/data`);
        const data = await response.json();
        
        state.pickupOrders = data.pickupOrders || [];
        state.careProcesses = data.careProcesses || [];
        state.reviewRecords = data.reviewRecords || [];
        state.expressAppointments = data.expressAppointments || [];
        state.recheckResults = data.recheckResults || [];
        state.overrides = data.overrides || [];
        state.notes = data.notes || [];
        
        updateAllPreviews();
        renderRecheckResults();
        updateDataSummary();
        
        showToast('数据已加载', 'success');
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

function handleFileImport(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            let data;
            if (file.name.endsWith('.json')) {
                data = JSON.parse(event.target.result);
            } else if (file.name.endsWith('.csv')) {
                data = parseCSV(event.target.result, type);
            } else {
                showToast('不支持的文件格式', 'error');
                return;
            }

            if (!Array.isArray(data)) {
                data = [data];
            }

            const mappedData = data.map((item, index) => {
                const id = item.id || generateId(type);
                return { ...item, id };
            });

            switch (type) {
                case 'pickup':
                    state.pickupOrders = mappedData;
                    await saveData('pickup-orders', state.pickupOrders);
                    break;
                case 'care':
                    state.careProcesses = mappedData;
                    await saveData('care-processes', state.careProcesses);
                    break;
                case 'review':
                    state.reviewRecords = mappedData;
                    await saveData('review-records', state.reviewRecords);
                    break;
                case 'express':
                    state.expressAppointments = mappedData;
                    await saveData('express-appointments', state.expressAppointments);
                    break;
            }

            updateAllPreviews();
            updateDataSummary();
            showToast(`已导入 ${mappedData.length} 条数据`, 'success');
        } catch (error) {
            console.error('解析文件失败:', error);
            showToast('文件解析失败', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function parseCSV(csvText, type) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const item = {};
        headers.forEach((header, index) => {
            item[header] = values[index] || '';
        });
        data.push(mapCSVItem(item, type));
    }

    return data;
}

function mapCSVItem(item, type) {
    switch (type) {
        case 'pickup':
            return {
                id: item.id || generateId('order'),
                orderNumber: item.ordernumber || item.order_number || item['订单编号'] || '',
                customerName: item.customername || item.customer_name || item['客户姓名'] || '',
                clothingType: item.clothingtype || item.clothing_type || item['衣物类型'] || '婚纱',
                pickupTime: item.pickuptime || item.pickup_time || item['取件时间'] || '',
                deliveryType: item.deliverytype || item.delivery_type || item['交付方式'] || 'pickup'
            };
        case 'care':
            return {
                id: item.id || generateId('care'),
                orderId: item.orderid || item.order_id || item['订单ID'] || '',
                name: item.name || item['工序名称'] || '',
                status: item.status || item['状态'] || 'pending'
            };
        case 'review':
            return {
                id: item.id || generateId('review'),
                orderId: item.orderid || item.order_id || item['订单ID'] || '',
                type: item.type || item['复查类型'] || 'stain',
                description: item.description || item['描述'] || '',
                passed: (item.passed || item['是否通过'] || 'true').toLowerCase() === 'true'
            };
        case 'express':
            return {
                id: item.id || generateId('express'),
                orderId: item.orderid || item.order_id || item['订单ID'] || '',
                company: item.company || item['快递公司'] || '',
                trackingNumber: item.trackingnumber || item.tracking_number || item['运单号'] || '',
                pickupTime: item.pickuptime || item.pickup_time || item['取件时间'] || ''
            };
        default:
            return item;
    }
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function saveData(endpoint, data) {
    try {
        await fetch(`${API_BASE}/api/data/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

function updateAllPreviews() {
    updatePreview('pickup');
    updatePreview('care');
    updatePreview('review');
    updatePreview('express');
}

function updatePreview(type) {
    let data, countId, previewId;
    
    switch (type) {
        case 'pickup':
            data = state.pickupOrders;
            countId = 'pickupCount';
            previewId = 'pickupPreview';
            break;
        case 'care':
            data = state.careProcesses;
            countId = 'careCount';
            previewId = 'carePreview';
            break;
        case 'review':
            data = state.reviewRecords;
            countId = 'reviewCount';
            previewId = 'reviewPreview';
            break;
        case 'express':
            data = state.expressAppointments;
            countId = 'expressCount';
            previewId = 'expressPreview';
            break;
    }

    document.getElementById(countId).textContent = `已导入: ${data.length} 条`;

    const previewEl = document.getElementById(previewId);
    if (data.length === 0) {
        previewEl.innerHTML = '';
        return;
    }

    previewEl.innerHTML = data.map((item, index) => {
        let info = getPreviewInfo(item, type);
        return `
            <div class="data-preview-item">
                <div class="info">
                    <strong>${info.title}</strong>
                    <span>${info.subtitle}</span>
                </div>
                <button class="delete-btn" onclick="deleteItem('${type}', ${index})">删除</button>
            </div>
        `;
    }).join('');
}

function getPreviewInfo(item, type) {
    switch (type) {
        case 'pickup':
            return {
                title: `${item.orderNumber || '未设置'} - ${item.customerName || '未知客户'}`,
                subtitle: `${item.clothingType || '未设置'} | ${item.deliveryType === 'express' ? '快递' : '自取'} | ${item.pickupTime || '未安排'}`
            };
        case 'care':
            const order = state.pickupOrders.find(o => o.id === item.orderId);
            return {
                title: item.name || '未设置工序',
                subtitle: `订单: ${order ? order.orderNumber : item.orderId} | 状态: ${item.status === 'completed' ? '已完成' : '未完成'}`
            };
        case 'review':
            const revOrder = state.pickupOrders.find(o => o.id === item.orderId);
            return {
                title: `${item.type === 'stain' ? '污渍复查' : '破损复查'} - ${item.passed ? '通过' : '未通过'}`,
                subtitle: `订单: ${revOrder ? revOrder.orderNumber : item.orderId} | ${item.description || '无描述'}`
            };
        case 'express':
            const exprOrder = state.pickupOrders.find(o => o.id === item.orderId);
            return {
                title: `${item.company || '未知快递'} - ${item.trackingNumber || '无运单号'}`,
                subtitle: `订单: ${exprOrder ? exprOrder.orderNumber : item.orderId} | 取件时间: ${item.pickupTime || '未安排'}`
            };
        default:
            return { title: JSON.stringify(item), subtitle: '' };
    }
}

function deleteItem(type, index) {
    let data;
    switch (type) {
        case 'pickup':
            data = state.pickupOrders;
            data.splice(index, 1);
            saveData('pickup-orders', data);
            break;
        case 'care':
            data = state.careProcesses;
            data.splice(index, 1);
            saveData('care-processes', data);
            break;
        case 'review':
            data = state.reviewRecords;
            data.splice(index, 1);
            saveData('review-records', data);
            break;
        case 'express':
            data = state.expressAppointments;
            data.splice(index, 1);
            saveData('express-appointments', data);
            break;
    }
    updatePreview(type);
    updateDataSummary();
    showToast('已删除', 'success');
}

function showAddModal(type) {
    state.currentModalType = type;
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    switch (type) {
        case 'pickup':
            title.textContent = '添加取件单';
            body.innerHTML = getPickupForm();
            break;
        case 'care':
            title.textContent = '添加护理工序';
            body.innerHTML = getCareForm();
            break;
        case 'review':
            title.textContent = '添加复查记录';
            body.innerHTML = getReviewForm();
            break;
        case 'express':
            title.textContent = '添加快递预约';
            body.innerHTML = getExpressForm();
            break;
    }

    modal.classList.add('show');
}

function getPickupForm() {
    return `
        <div class="form-group">
            <label>订单编号 *</label>
            <input type="text" id="form-orderNumber" placeholder="例如: HS202401001">
        </div>
        <div class="form-group">
            <label>客户姓名 *</label>
            <input type="text" id="form-customerName" placeholder="例如: 张三">
        </div>
        <div class="form-group">
            <label>衣物类型</label>
            <select id="form-clothingType">
                <option value="婚纱">婚纱</option>
                <option value="礼服">礼服</option>
                <option value="西服">西服</option>
                <option value="其他">其他</option>
            </select>
        </div>
        <div class="form-group">
            <label>取件时间</label>
            <input type="datetime-local" id="form-pickupTime">
        </div>
        <div class="form-group">
            <label>交付方式</label>
            <select id="form-deliveryType">
                <option value="pickup">自取</option>
                <option value="express">快递</option>
            </select>
        </div>
    `;
}

function getCareForm() {
    const orderOptions = state.pickupOrders.map(o => 
        `<option value="${o.id}">${o.orderNumber} - ${o.customerName}</option>`
    ).join('');

    return `
        <div class="form-group">
            <label>关联订单 *</label>
            <select id="form-orderId">
                <option value="">请选择订单</option>
                ${orderOptions}
            </select>
        </div>
        <div class="form-group">
            <label>工序名称 *</label>
            <input type="text" id="form-name" placeholder="例如: 干洗、熨烫、消毒等">
        </div>
        <div class="form-group">
            <label>状态</label>
            <select id="form-status">
                <option value="pending">未完成</option>
                <option value="completed">已完成</option>
            </select>
        </div>
    `;
}

function getReviewForm() {
    const orderOptions = state.pickupOrders.map(o => 
        `<option value="${o.id}">${o.orderNumber} - ${o.customerName}</option>`
    ).join('');

    return `
        <div class="form-group">
            <label>关联订单 *</label>
            <select id="form-orderId">
                <option value="">请选择订单</option>
                ${orderOptions}
            </select>
        </div>
        <div class="form-group">
            <label>复查类型</label>
            <select id="form-type">
                <option value="stain">污渍复查</option>
                <option value="damage">破损复查</option>
            </select>
        </div>
        <div class="form-group">
            <label>描述</label>
            <textarea id="form-description" placeholder="描述复查的具体内容"></textarea>
        </div>
        <div class="form-group">
            <div class="checkbox-group">
                <input type="checkbox" id="form-passed" checked>
                <span>复查通过</span>
            </div>
        </div>
    `;
}

function getExpressForm() {
    const orderOptions = state.pickupOrders.map(o => 
        `<option value="${o.id}">${o.orderNumber} - ${o.customerName}</option>`
    ).join('');

    return `
        <div class="form-group">
            <label>关联订单 *</label>
            <select id="form-orderId">
                <option value="">请选择订单</option>
                ${orderOptions}
            </select>
        </div>
        <div class="form-group">
            <label>快递公司</label>
            <input type="text" id="form-company" placeholder="例如: 顺丰、德邦等">
        </div>
        <div class="form-group">
            <label>运单号</label>
            <input type="text" id="form-trackingNumber" placeholder="快递单号">
        </div>
        <div class="form-group">
            <label>取件时间</label>
            <input type="datetime-local" id="form-pickupTime">
        </div>
    `;
}

async function saveModalData() {
    const type = state.currentModalType;
    let data;

    switch (type) {
        case 'pickup':
            data = {
                id: generateId('order'),
                orderNumber: document.getElementById('form-orderNumber').value.trim(),
                customerName: document.getElementById('form-customerName').value.trim(),
                clothingType: document.getElementById('form-clothingType').value,
                pickupTime: document.getElementById('form-pickupTime').value,
                deliveryType: document.getElementById('form-deliveryType').value
            };
            if (!data.orderNumber || !data.customerName) {
                showToast('请填写必填项', 'error');
                return;
            }
            state.pickupOrders.push(data);
            await saveData('pickup-orders', state.pickupOrders);
            break;
        case 'care':
            data = {
                id: generateId('care'),
                orderId: document.getElementById('form-orderId').value,
                name: document.getElementById('form-name').value.trim(),
                status: document.getElementById('form-status').value
            };
            if (!data.orderId || !data.name) {
                showToast('请填写必填项', 'error');
                return;
            }
            state.careProcesses.push(data);
            await saveData('care-processes', state.careProcesses);
            break;
        case 'review':
            data = {
                id: generateId('review'),
                orderId: document.getElementById('form-orderId').value,
                type: document.getElementById('form-type').value,
                description: document.getElementById('form-description').value.trim(),
                passed: document.getElementById('form-passed').checked
            };
            if (!data.orderId) {
                showToast('请选择订单', 'error');
                return;
            }
            state.reviewRecords.push(data);
            await saveData('review-records', state.reviewRecords);
            break;
        case 'express':
            data = {
                id: generateId('express'),
                orderId: document.getElementById('form-orderId').value,
                company: document.getElementById('form-company').value.trim(),
                trackingNumber: document.getElementById('form-trackingNumber').value.trim(),
                pickupTime: document.getElementById('form-pickupTime').value
            };
            if (!data.orderId) {
                showToast('请选择订单', 'error');
                return;
            }
            state.expressAppointments.push(data);
            await saveData('express-appointments', state.expressAppointments);
            break;
    }

    closeModal();
    updateAllPreviews();
    updateDataSummary();
    showToast('已添加', 'success');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
    state.currentModalType = null;
}

async function runRecheck() {
    if (state.pickupOrders.length === 0) {
        showToast('请先导入取件单数据', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/recheck`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pickupOrders: state.pickupOrders,
                careProcesses: state.careProcesses,
                reviewRecords: state.reviewRecords,
                expressAppointments: state.expressAppointments
            })
        });

        state.recheckResults = await response.json();
        await saveData('recheck-results', state.recheckResults);
        
        renderRecheckResults();
        updateDataSummary();
        switchTab('recheck');
        showToast('复核完成', 'success');
    } catch (error) {
        console.error('复核失败:', error);
        showToast('复核失败', 'error');
    }
}

function renderRecheckResults() {
    const listEl = document.getElementById('recheckList');
    const filter = document.getElementById('filterStatus').value;

    if (state.recheckResults.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>暂无复核结果，请先导入数据并点击"开始复核"</p>
            </div>
        `;
        document.getElementById('totalOrders').textContent = '0';
        document.getElementById('okOrders').textContent = '0';
        document.getElementById('issueOrders').textContent = '0';
        return;
    }

    const issueOrders = state.recheckResults.filter(r => {
        const override = state.overrides.find(o => o.orderId === r.orderId);
        if (override && override.newStatus === 'ok') return false;
        return r.status === 'issues';
    });

    const okOrders = state.recheckResults.filter(r => {
        const override = state.overrides.find(o => o.orderId === r.orderId);
        if (override && override.newStatus === 'ok') return true;
        return r.status === 'ok';
    });

    document.getElementById('totalOrders').textContent = state.recheckResults.length;
    document.getElementById('okOrders').textContent = okOrders.length;
    document.getElementById('issueOrders').textContent = issueOrders.length;

    let filteredResults = state.recheckResults;
    if (filter === 'ok') {
        filteredResults = okOrders;
    } else if (filter === 'issues') {
        filteredResults = issueOrders;
    }

    if (filteredResults.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p>没有符合条件的订单</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filteredResults.map(result => {
        const override = state.overrides.find(o => o.orderId === result.orderId);
        const note = state.notes.find(n => n.orderId === result.orderId);
        
        let cardClass = result.status;
        let statusLabel = result.status === 'ok' ? '可放行' : '存在问题';
        
        if (override) {
            cardClass = 'overridden';
            statusLabel = override.newStatus === 'ok' ? '人工放行' : '人工标记问题';
        }

        const issuesHtml = result.issues.length > 0 ? `
            <div class="issues-list">
                ${result.issues.map(issue => {
                    const icon = issue.severity === 'error' ? '🔴' : '🟡';
                    const detailsHtml = issue.details && Array.isArray(issue.details) ? 
                        `<div class="issue-details"><ul>${issue.details.map(d => `<li>${d}</li>`).join('')}</ul></div>` : '';
                    return `
                        <div class="issue-item">
                            <span class="issue-icon">${icon}</span>
                            <div class="issue-content">
                                <strong>${getIssueTypeText(issue.type)}</strong>
                                <p>${issue.message}</p>
                                ${detailsHtml}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '';

        return `
            <div class="order-card ${cardClass}" data-order-id="${result.orderId}">
                <div class="order-header">
                    <div class="order-info">
                        <h4>${result.orderNumber} - ${result.customerName}</h4>
                        <div class="meta">
                            ${result.clothingType} | ${result.deliveryType === 'express' ? '快递交付' : '自取'} | 取件时间: ${result.pickupTime || '未安排'}
                        </div>
                    </div>
                    <div class="order-status">
                        <span class="status-tag ${cardClass}">${statusLabel}</span>
                        <div class="order-actions">
                            <button class="btn btn-secondary" onclick="toggleOverrideSection('${result.orderId}')">改判</button>
                            <button class="btn btn-secondary" onclick="toggleNoteSection('${result.orderId}')">备注</button>
                        </div>
                    </div>
                </div>
                ${issuesHtml}
                ${getOverrideSection(result.orderId, override)}
                ${getNoteSection(result.orderId, note)}
            </div>
        `;
    }).join('');
}

function getIssueTypeText(type) {
    const typeMap = {
        'missing_care': '缺失护理记录',
        'incomplete_care': '护理未完成',
        'review_failed': '复查未通过',
        'missing_express': '快递信息缺失',
        'time_conflict': '时间冲突'
    };
    return typeMap[type] || type;
}

function getOverrideSection(orderId, override) {
    const isExpanded = state.currentEditingOrder === orderId && window.showingOverride;
    const displayStyle = isExpanded ? 'block' : 'none';
    
    return `
        <div class="override-section" id="override-section-${orderId}" style="display: ${displayStyle}">
            <h5>人工改判</h5>
            <div class="override-options">
                <label class="override-option">
                    <input type="radio" name="override-${orderId}" value="ok" ${override?.newStatus === 'ok' ? 'checked' : ''}>
                    <span>标记为可放行</span>
                </label>
                <label class="override-option">
                    <input type="radio" name="override-${orderId}" value="issues" ${override?.newStatus === 'issues' ? 'checked' : ''}>
                    <span>标记为存在问题</span>
                </label>
                <label class="override-option">
                    <input type="radio" name="override-${orderId}" value="none" ${!override ? 'checked' : ''}>
                    <span>取消改判</span>
                </label>
            </div>
            <textarea class="override-reason" id="override-reason-${orderId}" placeholder="请填写改判原因（可选）">${override?.reason || ''}</textarea>
            <div style="margin-top: 10px;">
                <button class="btn btn-primary" onclick="saveOverride('${orderId}')">保存改判</button>
            </div>
        </div>
    `;
}

function getNoteSection(orderId, note) {
    const isExpanded = state.currentEditingOrder === orderId && window.showingNote;
    const displayStyle = isExpanded ? 'block' : 'none';
    
    return `
        <div class="note-section" id="note-section-${orderId}" style="display: ${displayStyle}">
            <h5>备注</h5>
            <textarea class="note-textarea" id="note-textarea-${orderId}" placeholder="添加备注信息...">${note?.content || ''}</textarea>
            <div style="margin-top: 10px;">
                <button class="btn btn-primary" onclick="saveNote('${orderId}')">保存备注</button>
            </div>
        </div>
    `;
}

function toggleOverrideSection(orderId) {
    window.showingOverride = true;
    window.showingNote = false;
    state.currentEditingOrder = orderId;
    renderRecheckResults();
}

function toggleNoteSection(orderId) {
    window.showingNote = true;
    window.showingOverride = false;
    state.currentEditingOrder = orderId;
    renderRecheckResults();
}

async function saveOverride(orderId) {
    const selectedValue = document.querySelector(`input[name="override-${orderId}"]:checked`)?.value;
    const reason = document.getElementById(`override-reason-${orderId}`).value.trim();

    if (selectedValue === 'none' || !selectedValue) {
        state.overrides = state.overrides.filter(o => o.orderId !== orderId);
    } else {
        const existing = state.overrides.findIndex(o => o.orderId === orderId);
        const overrideData = {
            orderId,
            newStatus: selectedValue,
            reason,
            timestamp: new Date().toISOString()
        };
        
        if (existing >= 0) {
            state.overrides[existing] = overrideData;
        } else {
            state.overrides.push(overrideData);
        }
    }

    await saveData('overrides', state.overrides);
    state.currentEditingOrder = null;
    window.showingOverride = false;
    renderRecheckResults();
    showToast('改判已保存', 'success');
}

async function saveNote(orderId) {
    const content = document.getElementById(`note-textarea-${orderId}`).value.trim();

    if (!content) {
        state.notes = state.notes.filter(n => n.orderId !== orderId);
    } else {
        const existing = state.notes.findIndex(n => n.orderId === orderId);
        const noteData = {
            orderId,
            content,
            timestamp: new Date().toISOString()
        };
        
        if (existing >= 0) {
            state.notes[existing] = noteData;
        } else {
            state.notes.push(noteData);
        }
    }

    await saveData('notes', state.notes);
    state.currentEditingOrder = null;
    window.showingNote = false;
    renderRecheckResults();
    showToast('备注已保存', 'success');
}

async function clearAllData() {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) {
        return;
    }

    state.pickupOrders = [];
    state.careProcesses = [];
    state.reviewRecords = [];
    state.expressAppointments = [];
    state.recheckResults = [];
    state.overrides = [];
    state.notes = [];

    await saveData('pickup-orders', []);
    await saveData('care-processes', []);
    await saveData('review-records', []);
    await saveData('express-appointments', []);
    await saveData('recheck-results', []);
    await saveData('overrides', []);
    await saveData('notes', []);

    updateAllPreviews();
    renderRecheckResults();
    updateDataSummary();
    showToast('所有数据已清空', 'success');
}

function updateDataSummary() {
    document.getElementById('summaryPickup').textContent = state.pickupOrders.length;
    document.getElementById('summaryCare').textContent = state.careProcesses.length;
    document.getElementById('summaryReview').textContent = state.reviewRecords.length;
    document.getElementById('summaryExpress').textContent = state.expressAppointments.length;
    document.getElementById('summaryRecheck').textContent = state.recheckResults.length;

    const issueOrders = state.recheckResults.filter(r => {
        const override = state.overrides.find(o => o.orderId === r.orderId);
        if (override && override.newStatus === 'ok') return false;
        return r.status === 'issues';
    });

    document.getElementById('summaryPickupStatus').textContent = state.pickupOrders.length > 0 ? '已导入' : '-';
    document.getElementById('summaryCareStatus').textContent = state.careProcesses.length > 0 ? '已导入' : '-';
    document.getElementById('summaryReviewStatus').textContent = state.reviewRecords.length > 0 ? '已导入' : '-';
    document.getElementById('summaryExpressStatus').textContent = state.expressAppointments.length > 0 ? '已导入' : '-';
    document.getElementById('summaryRecheckStatus').textContent = state.recheckResults.length > 0 
        ? (issueOrders.length > 0 ? `⚠️ ${issueOrders.length} 个问题` : '✅ 全部通过')
        : '-';
}

async function exportMarkdown() {
    if (state.recheckResults.length === 0) {
        showToast('请先进行复核', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/export/markdown`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pickupOrders: state.pickupOrders,
                careProcesses: state.careProcesses,
                reviewRecords: state.reviewRecords,
                expressAppointments: state.expressAppointments,
                recheckResults: state.recheckResults,
                overrides: state.overrides,
                notes: state.notes
            })
        });

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `复核清单_${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Markdown 已导出', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败', 'error');
    }
}

async function exportJSON() {
    if (state.recheckResults.length === 0) {
        showToast('请先进行复核', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/export/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pickupOrders: state.pickupOrders,
                careProcesses: state.careProcesses,
                reviewRecords: state.reviewRecords,
                expressAppointments: state.expressAppointments,
                recheckResults: state.recheckResults,
                overrides: state.overrides,
                notes: state.notes
            })
        });

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `复核明细_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('JSON 已导出', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败', 'error');
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
