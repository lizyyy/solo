const API_BASE = '/api';
const currentOperator = 'nurse';

let currentHandover = null;
let currentDataList = 'donors';

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    try {
        const response = await fetch(url, {
            ...defaultOptions,
            ...options,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || '请求失败');
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

async function apiUpload(endpoint, formData) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '上传失败');
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

function initTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            loadTabData(targetTab);
        });
    });
}

async function loadTabData(tabName) {
    switch (tabName) {
        case 'input':
            loadDataList(currentDataList);
            break;
        case 'matching':
            loadMatches();
            break;
        case 'coldbox':
            loadColdBoxes();
            loadColdBoxSelects();
            break;
        case 'handover':
            loadHandovers();
            break;
        case 'audit':
            loadAuditLogs();
            break;
    }
}

async function loadDataList(listType) {
    const container = document.getElementById('data-list-container');
    currentDataList = listType;
    
    document.querySelectorAll('.data-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.list === listType);
    });
    
    try {
        let data = [];
        let headers = [];
        
        switch (listType) {
            case 'donors':
                data = await apiRequest('/donors');
                headers = ['条码', '姓名', '血型', '创建时间'];
                break;
            case 'bloodbags':
                data = await apiRequest('/blood-bags');
                headers = ['编号', '献血者', '容量', '血型', '采集时间'];
                break;
            case 'sampletubes':
                data = await apiRequest('/sample-tubes');
                headers = ['编号', '献血者', '类型', '创建时间'];
                break;
        }
        
        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据</p></div>';
            return;
        }
        
        let tableHtml = '<table class="data-table"><thead><tr>';
        headers.forEach(h => {
            tableHtml += `<th>${h}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        
        data.forEach(item => {
            tableHtml += '<tr>';
            switch (listType) {
                case 'donors':
                    tableHtml += `<td>${item.donor_code}</td>`;
                    tableHtml += `<td>${item.name || '-'}</td>`;
                    tableHtml += `<td>${item.blood_type || '-'}</td>`;
                    tableHtml += `<td>${item.created_at}</td>`;
                    break;
                case 'bloodbags':
                    tableHtml += `<td>${item.bag_code}</td>`;
                    tableHtml += `<td>${item.donor_code || '-'}</td>`;
                    tableHtml += `<td>${item.volume}ml</td>`;
                    tableHtml += `<td>${item.blood_type || '-'}</td>`;
                    tableHtml += `<td>${item.collection_time || '-'}</td>`;
                    break;
                case 'sampletubes':
                    tableHtml += `<td>${item.tube_code}</td>`;
                    tableHtml += `<td>${item.donor_code || '-'}</td>`;
                    tableHtml += `<td>${item.tube_type || 'standard'}</td>`;
                    tableHtml += `<td>${item.created_at}</td>`;
                    break;
            }
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        container.innerHTML = tableHtml;
        
    } catch (error) {
        container.innerHTML = `<div class="error-detail">加载失败: ${error.message}</div>`;
    }
}

function initInputForms() {
    document.getElementById('donor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            donor_code: formData.get('donor_code'),
            name: formData.get('name') || null,
            blood_type: formData.get('blood_type') || null,
            operator: currentOperator
        };
        
        try {
            await apiRequest('/donors', { method: 'POST', body: data });
            showToast('献血者添加成功', 'success');
            e.target.reset();
            loadDataList('donors');
        } catch (error) {}
    });
    
    document.getElementById('bloodbag-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            bag_code: formData.get('bag_code'),
            donor_code: formData.get('donor_code') || null,
            volume: parseInt(formData.get('volume')) || 400,
            blood_type: formData.get('blood_type') || null,
            operator: currentOperator
        };
        
        try {
            await apiRequest('/blood-bags', { method: 'POST', body: data });
            showToast('血袋添加成功', 'success');
            e.target.reset();
            loadDataList('bloodbags');
        } catch (error) {}
    });
    
    document.getElementById('sampletube-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            tube_code: formData.get('tube_code'),
            donor_code: formData.get('donor_code') || null,
            tube_type: formData.get('tube_type') || 'standard',
            operator: currentOperator
        };
        
        try {
            await apiRequest('/sample-tubes', { method: 'POST', body: data });
            showToast('样本管添加成功', 'success');
            e.target.reset();
            loadDataList('sampletubes');
        } catch (error) {}
    });
    
    document.querySelectorAll('.data-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            loadDataList(btn.dataset.list);
        });
    });
    
    document.getElementById('scan-analyze-btn').addEventListener('click', analyzeScanInput);
    document.getElementById('scan-clear-btn').addEventListener('click', () => {
        document.getElementById('scan-input').value = '';
        document.getElementById('scan-results').innerHTML = '';
    });
    
    initImportForms();
}

function analyzeScanInput() {
    const input = document.getElementById('scan-input').value.trim();
    const lines = input.split('\n').filter(line => line.trim());
    const results = [];
    
    lines.forEach(line => {
        const code = line.trim().toUpperCase();
        let type = '未知';
        let typeClass = '';
        
        if (code.startsWith('D')) {
            type = '献血者';
            typeClass = 'donor';
        } else if (code.startsWith('B')) {
            type = '血袋';
            typeClass = 'bloodbag';
        } else if (code.startsWith('T')) {
            type = '样本管';
            typeClass = 'sampletube';
        }
        
        results.push({ code, type, typeClass });
    });
    
    const container = document.getElementById('scan-results');
    if (results.length === 0) {
        container.innerHTML = '<p class="empty-state">请输入条码</p>';
        return;
    }
    
    let html = `<p>共识别 ${results.length} 个条码：</p>`;
    results.forEach(r => {
        html += `
            <div class="scan-result-item">
                <span class="scan-type ${r.typeClass}">${r.type}</span>
                <span>${r.code}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function initImportForms() {
    document.getElementById('donor-import-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.append('operator', currentOperator);
        
        try {
            const result = await apiUpload('/import/donors', formData);
            showToast(`导入完成: 成功 ${result.successCount}, 失败 ${result.failCount}`, 'success');
            loadDataList('donors');
        } catch (error) {}
    });
    
    document.getElementById('bloodbag-import-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.append('operator', currentOperator);
        
        try {
            const result = await apiUpload('/import/blood-bags', formData);
            showToast(`导入完成: 成功 ${result.successCount}, 失败 ${result.failCount}`, 'success');
            loadDataList('bloodbags');
        } catch (error) {}
    });
    
    document.getElementById('sampletube-import-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.append('operator', currentOperator);
        
        try {
            const result = await apiUpload('/import/sample-tubes', formData);
            showToast(`导入完成: 成功 ${result.successCount}, 失败 ${result.failCount}`, 'success');
            loadDataList('sampletubes');
        } catch (error) {}
    });
}

function initMatchingForms() {
    document.getElementById('match-validate-btn').addEventListener('click', async () => {
        const form = document.getElementById('matching-form');
        const formData = new FormData(form);
        const data = {
            blood_bag_code: formData.get('blood_bag_code'),
            sample_tube_code: formData.get('sample_tube_code')
        };
        
        try {
            const result = await apiRequest('/matches/validate', { method: 'POST', body: data });
            displayValidationResult('match-validation-result', result);
        } catch (error) {}
    });
    
    document.getElementById('matching-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            blood_bag_code: formData.get('blood_bag_code'),
            sample_tube_code: formData.get('sample_tube_code'),
            operator: currentOperator
        };
        
        try {
            await apiRequest('/matches', { method: 'POST', body: data });
            showToast('配对成功', 'success');
            e.target.reset();
            document.getElementById('match-validation-result').innerHTML = '';
            loadMatches();
        } catch (error) {}
    });
    
    document.getElementById('batch-match-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const itemsText = formData.get('batch_items').trim();
        
        if (!itemsText) {
            showToast('请输入配对列表', 'warning');
            return;
        }
        
        const lines = itemsText.split('\n').filter(line => line.trim());
        const items = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            return {
                blood_bag_code: parts[0],
                sample_tube_code: parts[1]
            };
        });
        
        try {
            const result = await apiRequest('/matches/batch', { 
                method: 'POST', 
                body: { items, operator: currentOperator } 
            });
            
            let html = `<p>批量配对结果:</p>`;
            html += `<p>成功: ${result.success}, 失败: ${result.failed}</p>`;
            
            if (result.errors.length > 0) {
                html += '<div class="error-detail">';
                result.errors.forEach(e => {
                    html += `<p>${e.item.blood_bag_code}-${e.item.sample_tube_code}: ${e.error}</p>`;
                });
                html += '</div>';
            }
            
            document.getElementById('batch-match-result').innerHTML = html;
            showToast(`批量配对完成: 成功 ${result.success}`, 'success');
            loadMatches();
        } catch (error) {}
    });
    
    document.getElementById('check-missing-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const donorCode = formData.get('donor_code');
        
        try {
            const bloodBags = await apiRequest(`/blood-bags`);
            const sampleTubes = await apiRequest(`/sample-tubes`);
            const matches = await apiRequest(`/matches`);
            
            const donorBags = bloodBags.filter(b => b.donor_code === donorCode);
            const donorTubes = sampleTubes.filter(t => t.donor_code === donorCode);
            const donorMatches = matches.filter(m => m.donor_code === donorCode);
            
            const matchedBagIds = new Set(donorMatches.map(m => m.blood_bag_id));
            const matchedTubeIds = new Set(donorMatches.map(m => m.sample_tube_id));
            
            const unmatchedBags = donorBags.filter(b => !matchedBagIds.has(b.id));
            const unmatchedTubes = donorTubes.filter(t => !matchedTubeIds.has(t.id));
            
            let result;
            if (unmatchedBags.length > 0 || unmatchedTubes.length > 0) {
                result = {
                    valid: false,
                    error: '存在未配对的血袋或样本管',
                    unmatchedBags,
                    unmatchedTubes
                };
            } else {
                result = { valid: true, message: '所有血袋和样本管均已配对' };
            }
            
            displayValidationResult('missing-result', result);
        } catch (error) {}
    });
    
    document.getElementById('refresh-matches-btn').addEventListener('click', loadMatches);
    document.getElementById('match-status-filter').addEventListener('change', loadMatches);
}

function displayValidationResult(containerId, result) {
    const container = document.getElementById(containerId);
    const type = result.valid ? 'success' : (result.rule?.includes('timeout') ? 'warning' : 'error');
    
    let html = `<div class="validation-result ${type}">`;
    html += `<strong>${result.valid ? '✓ 通过' : '✗ 失败'}</strong>: ${result.message || result.error}`;
    
    if (result.unmatchedBags && result.unmatchedBags.length > 0) {
        html += `<p>未配对血袋: ${result.unmatchedBags.map(b => b.code || b.bag_code).join(', ')}</p>`;
    }
    if (result.unmatchedTubes && result.unmatchedTubes.length > 0) {
        html += `<p>未配对样本管: ${result.unmatchedTubes.map(t => t.code || t.tube_code).join(', ')}</p>`;
    }
    if (result.otherBoxes) {
        html += `<p>涉及其他冷箱: ${result.otherBoxes.join(', ')}</p>`;
    }
    if (result.temperatureExceeds) {
        html += `<p>温度超标次数: ${result.temperatureExceeds.length}</p>`;
        html += `<p>超时时长: ${result.totalOverTempDuration?.toFixed(2)} 小时</p>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function loadMatches() {
    const container = document.getElementById('matches-list');
    const statusFilter = document.getElementById('match-status-filter').value;
    
    try {
        let matches = await apiRequest('/matches');
        
        if (statusFilter) {
            matches = matches.filter(m => m.status === statusFilter);
        }
        
        if (matches.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无配对记录</p></div>';
            return;
        }
        
        let html = '<div class="item-list">';
        html += '<div class="item-header"><span>ID</span><span>血袋</span><span>样本管</span><span>献血者</span><span>状态</span></div>';
        
        matches.forEach(m => {
            html += `<div class="item-row">
                <span>${m.id}</span>
                <span>${m.bag_code || '-'}</span>
                <span>${m.tube_code || '-'}</span>
                <span>${m.donor_code || '-'}</span>
                <span class="handover-status status-${m.status === 'matched' ? 'completed' : 'pending'}">${m.status}</span>
            </div>`;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        container.innerHTML = `<div class="error-detail">加载失败: ${error.message}</div>`;
    }
}

function initColdBoxForms() {
    document.getElementById('coldbox-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            box_code: formData.get('box_code'),
            description: formData.get('description') || null,
            max_temp: parseFloat(formData.get('max_temp')) || 10,
            operator: currentOperator
        };
        
        try {
            await apiRequest('/cold-boxes', { method: 'POST', body: data });
            showToast('冷箱添加成功', 'success');
            e.target.reset();
            loadColdBoxes();
            loadColdBoxSelects();
        } catch (error) {}
    });
    
    document.getElementById('timeline-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const boxCode = formData.get('box_code');
        
        try {
            const data = {
                event_type: formData.get('event_type'),
                temperature: formData.get('temperature') ? parseFloat(formData.get('temperature')) : null,
                blood_bag_code: formData.get('blood_bag_code') || null,
                notes: formData.get('notes') || null,
                operator: currentOperator
            };
            
            await apiRequest(`/cold-boxes/${boxCode}/timeline`, { method: 'POST', body: data });
            showToast('事件记录成功', 'success');
            e.target.reset();
            loadColdBoxes();
        } catch (error) {}
    });
    
    document.getElementById('check-temp-btn').addEventListener('click', async () => {
        const select = document.getElementById('temp-check-box');
        const boxId = select.value;
        
        if (!boxId) {
            showToast('请选择冷箱', 'warning');
            return;
        }
        
        try {
            const result = await apiRequest(`/cold-boxes/${boxId}/check-temperature`);
            displayValidationResult('temp-check-result', result);
        } catch (error) {}
    });
    
    document.getElementById('cross-check-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const boxCode = formData.get('box_code');
        const bloodBagCode = formData.get('blood_bag_code');
        
        try {
            const result = await apiRequest(`/cold-boxes/${boxCode}/check-cross-contamination?blood_bag_code=${bloodBagCode}`);
            displayValidationResult('cross-check-result', result);
        } catch (error) {}
    });
    
    document.getElementById('load-timeline-btn').addEventListener('click', async () => {
        const select = document.getElementById('timeline-box-select');
        const boxCode = select.value;
        
        if (!boxCode) {
            showToast('请选择冷箱', 'warning');
            return;
        }
        
        try {
            const timeline = await apiRequest(`/cold-boxes/${boxCode}/timeline`);
            displayTimeline(timeline);
        } catch (error) {}
    });
}

async function loadColdBoxes() {
    const container = document.getElementById('coldboxes-list');
    
    try {
        const boxes = await apiRequest('/cold-boxes');
        
        if (boxes.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无冷箱</p></div>';
            return;
        }
        
        let html = '';
        boxes.forEach(box => {
            const tempClass = box.current_temp > box.max_temp ? 'temp-danger' : 
                            box.current_temp > box.max_temp * 0.8 ? 'temp-warning' : 'temp-normal';
            
            html += `
                <div class="coldbox-card">
                    <div class="coldbox-info">
                        <h4>${box.box_code}</h4>
                        <p>${box.description || '无描述'}</p>
                        <p>最高允许温度: ${box.max_temp}°C</p>
                    </div>
                    <div class="coldbox-temp">
                        <span class="temp-current ${tempClass}">${box.current_temp !== null ? box.current_temp + '°C' : '-'}</span>
                        <span class="handover-status status-${box.status === 'active' ? 'completed' : 'pending'}">${box.status}</span>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        container.innerHTML = `<div class="error-detail">加载失败: ${error.message}</div>`;
    }
}

async function loadColdBoxSelects() {
    try {
        const boxes = await apiRequest('/cold-boxes');
        
        const tempSelect = document.getElementById('temp-check-box');
        const timelineSelect = document.getElementById('timeline-box-select');
        
        let options = '<option value="">请选择冷箱</option>';
        boxes.forEach(box => {
            options += `<option value="${box.id}">${box.box_code}</option>`;
        });
        
        tempSelect.innerHTML = options;
        timelineSelect.innerHTML = options;
        
    } catch (error) {
        console.error('加载冷箱选项失败:', error);
    }
}

function displayTimeline(timeline) {
    const container = document.getElementById('coldbox-timeline');
    
    if (timeline.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无时间线记录</p></div>';
        return;
    }
    
    const eventTypes = {
        'temp_check': '温度检查',
        'bag_add': '放入血袋',
        'bag_remove': '取出血袋',
        'transport': '运输开始',
        'arrival': '到达'
    };
    
    let html = '';
    timeline.forEach(item => {
        html += `
            <div class="timeline-item ${item.event_type}">
                <div class="timeline-time">${item.event_time}</div>
                <div class="timeline-content">
                    <strong>${eventTypes[item.event_type] || item.event_type}</strong>
                    ${item.temperature !== null ? `<p>温度: ${item.temperature}°C</p>` : ''}
                    ${item.blood_bag_code ? `<p>血袋: ${item.blood_bag_code}</p>` : ''}
                    ${item.notes ? `<p>备注: ${item.notes}</p>` : ''}
                    ${item.operator ? `<p>操作人: ${item.operator}</p>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function initHandoverForms() {
    document.getElementById('handover-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            from_operator: formData.get('from_operator'),
            to_operator: formData.get('to_operator'),
            notes: formData.get('notes') || null,
            operator: currentOperator
        };
        
        try {
            const result = await apiRequest('/handovers', { method: 'POST', body: data });
            showToast('交接创建成功', 'success');
            e.target.reset();
            loadHandovers();
        } catch (error) {}
    });
    
    document.getElementById('refresh-handovers-btn').addEventListener('click', loadHandovers);
    document.getElementById('handover-status-filter').addEventListener('change', loadHandovers);
    
    document.getElementById('add-handover-item-btn').addEventListener('click', async () => {
        if (!currentHandover) {
            showToast('请先选择交接记录', 'warning');
            return;
        }
        
        const form = document.getElementById('handover-item-form');
        const formData = new FormData(form);
        
        const items = [{
            donor_code: formData.get('donor_code') || null,
            blood_bag_code: formData.get('blood_bag_code') || null,
            sample_tube_code: formData.get('sample_tube_code') || null
        }];
        
        try {
            const result = await apiRequest(`/handovers/${currentHandover.handover_code}/items`, { 
                method: 'POST', 
                body: { items, operator: currentOperator } 
            });
            
            showToast(`添加成功: ${result.success} 项`, 'success');
            form.reset();
            loadHandoverItems();
        } catch (error) {}
    });
    
    document.getElementById('batch-item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentHandover) {
            showToast('请先选择交接记录', 'warning');
            return;
        }
        
        const formData = new FormData(e.target);
        const itemsText = formData.get('batch_items').trim();
        
        if (!itemsText) {
            showToast('请输入项目列表', 'warning');
            return;
        }
        
        const lines = itemsText.split('\n').filter(line => line.trim());
        const items = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            return {
                donor_code: parts[0] || null,
                blood_bag_code: parts[1] || null,
                sample_tube_code: parts[2] || null
            };
        });
        
        try {
            const result = await apiRequest(`/handovers/${currentHandover.handover_code}/items`, { 
                method: 'POST', 
                body: { items, operator: currentOperator } 
            });
            
            showToast(`批量添加完成: 成功 ${result.success}, 失败 ${result.failed}`, 'success');
            e.target.reset();
            loadHandoverItems();
        } catch (error) {}
    });
    
    document.getElementById('validate-handover-btn').addEventListener('click', async () => {
        if (!currentHandover) return;
        
        try {
            const result = await apiRequest(`/handovers/${currentHandover.handover_code}/validate`, { method: 'POST' });
            
            let html = `<div class="validation-result ${result.valid ? 'success' : 'error'}">`;
            html += `<h4>${result.valid ? '验证通过' : '验证失败'}</h4>`;
            html += `<p>总项数: ${result.totalItems}, 通过: ${result.validItems}, 失败: ${result.invalidItems}</p>`;
            
            if (result.details && result.details.length > 0) {
                result.details.forEach(d => {
                    if (!d.validation.valid) {
                        html += `<div class="error-detail">`;
                        html += `<p>项: ${d.item.donor_code || d.item.blood_bag_code || d.item.sample_tube_code}</p>`;
                        d.validation.results.forEach(r => {
                            if (!r.valid) {
                                html += `<p>- ${r.error}</p>`;
                            }
                        });
                        html += '</div>';
                    }
                });
            }
            
            html += '</div>';
            document.getElementById('handover-validation-result').innerHTML = html;
        } catch (error) {}
    });
    
    document.getElementById('complete-handover-btn').addEventListener('click', async () => {
        if (!currentHandover) return;
        
        try {
            const result = await apiRequest(`/handovers/${currentHandover.handover_code}/complete`, { 
                method: 'POST', 
                body: { operator: currentOperator } 
            });
            
            showToast('交接完成', 'success');
            currentHandover = result;
            displayHandoverDetail(result);
            loadHandovers();
        } catch (error) {}
    });
    
    document.getElementById('reject-handover-btn').addEventListener('click', async () => {
        if (!currentHandover) return;
        
        const reason = prompt('请输入退回原因:');
        if (reason === null) return;
        
        try {
            const result = await apiRequest(`/handovers/${currentHandover.handover_code}/reject`, { 
                method: 'POST', 
                body: { reason, operator: currentOperator } 
            });
            
            showToast('交接已退回', 'warning');
            currentHandover = result.handover;
            loadHandovers();
        } catch (error) {}
    });
}

async function loadHandovers() {
    const container = document.getElementById('handovers-list');
    const statusFilter = document.getElementById('handover-status-filter').value;
    
    try {
        let handovers = await apiRequest('/handovers');
        
        if (statusFilter) {
            handovers = handovers.filter(h => h.status === statusFilter);
        }
        
        if (handovers.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无交接记录</p></div>';
            return;
        }
        
        let html = '';
        handovers.forEach(h => {
            const statusClass = h.status === 'completed' ? 'completed' : 
                               h.status === 'rejected' ? 'rejected' : 'pending';
            
            html += `
                <div class="handover-card" data-code="${h.handover_code}">
                    <div class="handover-header">
                        <span class="handover-code">${h.handover_code}</span>
                        <span class="handover-status status-${statusClass}">${h.status}</span>
                    </div>
                    <div class="handover-info">
                        <p><span>移交人:</span> ${h.from_operator}</p>
                        <p><span>接收人:</span> ${h.to_operator}</p>
                        <p><span>创建时间:</span> ${h.created_at}</p>
                        ${h.notes ? `<p><span>备注:</span> ${h.notes}</p>` : ''}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        container.querySelectorAll('.handover-card').forEach(card => {
            card.addEventListener('click', () => {
                const code = card.dataset.code;
                const handover = handovers.find(h => h.handover_code === code);
                if (handover) {
                    currentHandover = handover;
                    displayHandoverDetail(handover);
                }
            });
        });
        
    } catch (error) {
        container.innerHTML = `<div class="error-detail">加载失败: ${error.message}</div>`;
    }
}

function displayHandoverDetail(handover) {
    const detailCard = document.getElementById('handover-detail-card');
    const statusClass = handover.status === 'completed' ? 'completed' : 
                       handover.status === 'rejected' ? 'rejected' : 'pending';
    
    let html = `
        <div class="handover-header">
            <span class="handover-code">${handover.handover_code}</span>
            <span class="handover-status status-${statusClass}">${handover.status}</span>
        </div>
        <div class="handover-info">
            <p><span>移交人:</span> ${handover.from_operator}</p>
            <p><span>接收人:</span> ${handover.to_operator}</p>
            <p><span>创建时间:</span> ${handover.created_at}</p>
            ${handover.completed_at ? `<p><span>完成时间:</span> ${handover.completed_at}</p>` : ''}
            ${handover.notes ? `<p><span>备注:</span> ${handover.notes}</p>` : ''}
        </div>
    `;
    
    document.getElementById('handover-detail-info').innerHTML = html;
    detailCard.style.display = 'block';
    
    loadHandoverItems();
}

async function loadHandoverItems() {
    if (!currentHandover) return;
    
    const container = document.getElementById('handover-items-list');
    
    try {
        const items = await apiRequest(`/handovers/${currentHandover.handover_code}/items`);
        
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无交接项</p></div>';
            return;
        }
        
        let html = '<div class="item-list">';
        html += '<div class="item-header"><span>#</span><span>献血者</span><span>血袋</span><span>样本管</span><span>状态</span></div>';
        
        items.forEach((item, index) => {
            const statusClass = item.status === 'passed' ? 'completed' : 
                               item.status === 'failed' ? 'rejected' : 'pending';
            
            html += `<div class="item-row">
                <span>${index + 1}</span>
                <span>${item.donor_code || '-'}</span>
                <span>${item.bag_code || '-'}</span>
                <span>${item.tube_code || '-'}</span>
                <span class="handover-status status-${statusClass}">${item.status || 'pending'}</span>
            </div>`;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        container.innerHTML = `<div class="error-detail">加载失败: ${error.message}</div>`;
    }
}

function initImportExportForms() {
    document.getElementById('export-handover-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const handoverCode = formData.get('handover_code');
        
        try {
            const response = await fetch(`${API_BASE}/export/handover/${handoverCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operator: currentOperator })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `handover_${handoverCode}.md`;
                a.click();
                showToast('报告导出成功', 'success');
            } else {
                const data = await response.json();
                throw new Error(data.error);
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    document.getElementById('export-audit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const data = {
            startTime: formData.get('start_time') || null,
            endTime: formData.get('end_time') || null,
            operator: formData.get('operator') || null,
            operator: currentOperator
        };
        
        try {
            const response = await fetch(`${API_BASE}/export/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit_${Date.now()}.json`;
                a.click();
                showToast('审计包导出成功', 'success');
            } else {
                const errData = await response.json();
                throw new Error(errData.error);
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    document.getElementById('export-timeline-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const data = {
            boxCode: formData.get('box_code') || null,
            startTime: formData.get('start_time') || null,
            endTime: formData.get('end_time') || null,
            operator: currentOperator
        };
        
        try {
            const response = await fetch(`${API_BASE}/export/coldbox-timeline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `coldbox_timeline_${Date.now()}.md`;
                a.click();
                showToast('时间线报告导出成功', 'success');
            } else {
                const errData = await response.json();
                throw new Error(errData.error);
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    document.getElementById('download-donor-template').addEventListener('click', () => {
        showTemplate('donor', 'donor_code,name,blood_type\nD001,张三,A\nD002,李四,B');
    });
    
    document.getElementById('download-bloodbag-template').addEventListener('click', () => {
        showTemplate('bloodbag', 'bag_code,donor_code,volume,blood_type\nB001,D001,400,A\nB002,D002,400,B');
    });
    
    document.getElementById('download-sampletube-template').addEventListener('click', () => {
        showTemplate('sampletube', 'tube_code,donor_code,tube_type\nT001,D001,standard\nT002,D002,edta');
    });
}

function showTemplate(type, content) {
    const display = document.getElementById('template-display');
    display.textContent = content;
    
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    
    showToast(`已下载 ${type} 模板`, 'success');
}

function initAuditForms() {
    document.getElementById('refresh-audit-btn').addEventListener('click', loadAuditLogs);
    
    document.getElementById('audit-filter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const data = {
            startTime: formData.get('start_time') || null,
            endTime: formData.get('end_time') || null,
            operator: formData.get('operator') || null,
            tableName: formData.get('table_name') || null,
            operationType: formData.get('operation_type') || null
        };
        
        try {
            let logs = await apiRequest('/audit-logs');
            
            if (data.operator) {
                logs = logs.filter(l => l.operator === data.operator);
            }
            if (data.tableName) {
                logs = logs.filter(l => l.table_name === data.tableName);
            }
            if (data.operationType) {
                logs = logs.filter(l => l.operation_type === data.operationType);
            }
            if (data.startTime) {
                const startDate = new Date(data.startTime);
                logs = logs.filter(l => new Date(l.operation_time) >= startDate);
            }
            if (data.endTime) {
                const endDate = new Date(data.endTime);
                logs = logs.filter(l => new Date(l.operation_time) <= endDate);
            }
            
            displayAuditLogs(logs);
        } catch (error) {}
    });
}

async function loadAuditLogs() {
    try {
        const logs = await apiRequest('/audit-logs');
        displayAuditLogs(logs);
    } catch (error) {
        document.getElementById('audit-logs-list').innerHTML = 
            `<div class="error-detail">加载失败: ${error.message}</div>`;
    }
}

function displayAuditLogs(logs) {
    const container = document.getElementById('audit-logs-list');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无审计日志</p></div>';
        return;
    }
    
    let html = '';
    logs.forEach(log => {
        html += `
            <div class="audit-log-item">
                <div class="audit-log-header">
                    <span class="audit-type type-${log.operation_type}">${log.operation_type}</span>
                    <span class="audit-log-time">${log.operation_time}</span>
                </div>
                <div class="audit-log-details">
                    ${log.table_name ? `<p><strong>数据表:</strong> ${log.table_name}</p>` : ''}
                    ${log.record_id ? `<p><strong>记录ID:</strong> ${log.record_id}</p>` : ''}
                    ${log.operator ? `<p><strong>操作人:</strong> ${log.operator}</p>` : ''}
                    ${log.notes ? `<p><strong>备注:</strong> ${log.notes}</p>` : ''}
                    ${log.ip_address ? `<p><strong>IP:</strong> ${log.ip_address}</p>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function healthCheck() {
    try {
        const result = await apiRequest('/health');
        console.log('服务健康状态:', result);
        return true;
    } catch (error) {
        console.error('服务连接失败:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initInputForms();
    initMatchingForms();
    initColdBoxForms();
    initHandoverForms();
    initImportExportForms();
    initAuditForms();
    
    const healthy = await healthCheck();
    if (healthy) {
        loadDataList('donors');
        showToast('系统已连接', 'success');
    } else {
        showToast('无法连接到服务器，请检查后端是否启动', 'error');
    }
});
