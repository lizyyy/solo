const API_BASE = '';

let state = {
    flights: [],
    baggage: [],
    carouselStats: [],
    alerts: [],
    stats: {}
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initModal();
    initButtons();
    loadAllData();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.dataset.tab + 'Tab';
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function initModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function openModal(title, contentHTML) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = contentHTML;
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('网络请求失败', 'error');
        throw error;
    }
}

async function loadAllData() {
    try {
        const [stats, flights, baggage, alerts] = await Promise.all([
            apiRequest('/api/statistics'),
            apiRequest('/api/flights'),
            apiRequest('/api/baggage'),
            apiRequest('/api/risk-alerts?acknowledged=false')
        ]);
        
        state.stats = stats;
        state.flights = flights;
        state.baggage = baggage;
        state.alerts = alerts;
        
        updateStats();
        renderFlights();
        renderBaggage();
        renderCarouselStats();
        renderAlerts();
        updateFilterOptions();
    } catch (error) {
        console.error('Load data error:', error);
    }
}

function updateStats() {
    document.getElementById('statFlights').textContent = state.stats.total_flights || 0;
    document.getElementById('statBaggage').textContent = state.stats.total_baggage || 0;
    document.getElementById('statTransfer').textContent = state.stats.transfer_baggage || 0;
    document.getElementById('statOversize').textContent = state.stats.oversize_baggage || 0;
    document.getElementById('statAlerts').textContent = state.stats.active_alerts || 0;
    document.getElementById('statLoaded').textContent = state.stats.loaded_baggage || 0;
}

function updateFilterOptions() {
    const flightSelect = document.getElementById('filterFlight');
    const carouselSelect = document.getElementById('filterCarousel');
    
    const currentFlight = flightSelect.value;
    const currentCarousel = carouselSelect.value;
    
    flightSelect.innerHTML = '<option value="">所有航班</option>';
    carouselSelect.innerHTML = '<option value="">所有转盘</option>';
    
    state.flights.forEach(f => {
        flightSelect.innerHTML += `<option value="${f.id}">${f.flight_no}</option>`;
    });
    
    const carousels = [...new Set(state.baggage.filter(b => b.carousel).map(b => b.carousel))].sort((a, b) => a - b);
    carousels.forEach(c => {
        carouselSelect.innerHTML += `<option value="${c}">${c}号转盘</option>`;
    });
    
    flightSelect.value = currentFlight;
    carouselSelect.value = currentCarousel;
}

function renderFlights() {
    const tbody = document.getElementById('flightsTableBody');
    
    if (state.flights.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <h3>暂无航班数据</h3>
                        <p>点击"添加航班"或"导入示例数据"开始</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = state.flights.map(flight => `
        <tr>
            <td><strong>${flight.flight_no}</strong></td>
            <td>${flight.arrival_time}</td>
            <td>${flight.origin || '-'}</td>
            <td>${flight.destination || '-'}</td>
            <td>
                <span class="badge ${flight.carousel ? 'badge-info' : 'badge-warning'}">
                    ${flight.carousel ? flight.carousel + '号' : '未分配'}
                </span>
            </td>
            <td>${flight.baggage_count || 0}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="viewFlightBaggage('${flight.id}')">查看行李</button>
            </td>
        </tr>
    `).join('');
}

function renderBaggage() {
    const tbody = document.getElementById('baggageTableBody');
    const flightId = document.getElementById('filterFlight').value;
    const carousel = document.getElementById('filterCarousel').value;
    const barcode = document.getElementById('searchBarcode').value.toLowerCase();
    
    let filtered = state.baggage;
    
    if (flightId) {
        filtered = filtered.filter(b => b.flight_id === flightId);
    }
    
    if (carousel) {
        filtered = filtered.filter(b => b.carousel === parseInt(carousel));
    }
    
    if (barcode) {
        filtered = filtered.filter(b => b.barcode.toLowerCase().includes(barcode));
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <h3>暂无行李数据</h3>
                        <p>点击"扫描条码"添加新行李</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filtered.map(bag => `
        <tr>
            <td><strong>${bag.barcode}</strong></td>
            <td>${bag.flight_no || '-'}</td>
            <td>
                <span class="badge ${bag.transfer_flight ? 'badge-info' : 'badge-secondary'}">
                    ${bag.transfer_flight || '无'}
                </span>
            </td>
            <td>
                <span class="badge ${bag.carousel ? 'badge-info' : 'badge-warning'}">
                    ${bag.carousel ? bag.carousel + '号' : '未分配'}
                </span>
            </td>
            <td>
                <span class="badge ${bag.is_transfer ? 'badge-info' : 'badge-secondary'}">
                    ${bag.is_transfer ? '是' : '否'}
                </span>
            </td>
            <td>
                <span class="badge ${bag.is_oversize ? 'badge-warning' : 'badge-secondary'}">
                    ${bag.is_oversize ? '是' : '否'}
                </span>
            </td>
            <td>
                <span class="badge ${bag.is_loaded ? 'badge-success' : 'badge-secondary'}">
                    ${bag.is_loaded ? '已装车' : '待装车'}
                </span>
            </td>
            <td>
                ${bag.alerts ? `<span class="badge badge-danger">异常</span>` : '-'}
            </td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-small btn-secondary" onclick="editBaggage('${bag.id}')">编辑</button>
                    ${!bag.is_loaded ? `<button class="btn btn-small btn-primary" onclick="loadBaggage('${bag.id}')">装车</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderCarouselStats() {
    const tbody = document.getElementById('carouselTableBody');
    
    if (!state.stats.carousel_stats || state.stats.carousel_stats.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <h3>暂无转盘分配</h3>
                        <p>点击"分配转盘"为航班分配转盘</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const carouselData = state.stats.carousel_stats.map(cs => {
        const bags = state.baggage.filter(b => b.carousel === cs.carousel);
        return {
            ...cs,
            flights: [...new Set(bags.filter(b => b.flight_no).map(b => b.flight_no))],
            transferCount: bags.filter(b => b.is_transfer).length,
            oversizeCount: bags.filter(b => b.is_oversize).length
        };
    });
    
    tbody.innerHTML = carouselData.map(cs => `
        <tr>
            <td><strong>${cs.carousel}号</strong></td>
            <td>${cs.flights.length > 0 ? cs.flights.join(', ') : '-'}</td>
            <td>${cs.count}</td>
            <td>
                <span class="badge ${cs.transferCount > 0 ? 'badge-info' : 'badge-secondary'}">
                    ${cs.transferCount}
                </span>
            </td>
            <td>
                <span class="badge ${cs.oversizeCount > 0 ? 'badge-warning' : 'badge-secondary'}">
                    ${cs.oversizeCount}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderAlerts() {
    const container = document.getElementById('alertsContainer');
    
    if (state.alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>暂无风险预警</h3>
                <p>所有行李状态正常</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.alerts.map(alert => `
        <div class="alert-card ${alert.risk_level}">
            <div class="alert-header">
                <span class="alert-title">${alert.description}</span>
                <span class="alert-level ${alert.risk_level}">
                    ${alert.risk_level === 'critical' ? '严重' : alert.risk_level === 'high' ? '高' : '中'}
                </span>
            </div>
            <div class="alert-description">
                类型: ${alert.alert_type}
            </div>
            <div class="alert-details">
                <div class="alert-detail-item">
                    <strong>条码:</strong> ${alert.barcode || '-'}
                </div>
                <div class="alert-detail-item">
                    <strong>航班:</strong> ${alert.flight_no || '-'}
                </div>
                <div class="alert-detail-item">
                    <strong>转盘:</strong> ${alert.carousel ? alert.carousel + '号' : '-'}
                </div>
            </div>
            <div class="alert-actions">
                <button class="btn btn-small btn-primary" onclick="acknowledgeAlert('${alert.id}')">确认处理</button>
                <button class="btn btn-small btn-secondary" onclick="editBaggage('${alert.baggage_id}')">查看行李</button>
            </div>
        </div>
    `).join('');
}

function initButtons() {
    document.getElementById('importSample').addEventListener('click', async () => {
        try {
            const result = await apiRequest('/api/import/sample', { method: 'POST' });
            showToast('示例数据导入成功');
            loadAllData();
        } catch (error) {
            showToast('导入失败', 'error');
        }
    });
    
    document.getElementById('exportJSON').addEventListener('click', () => {
        window.open('/api/export/json', '_blank');
    });
    
    document.getElementById('exportMarkdown').addEventListener('click', () => {
        window.location.href = '/api/export/markdown';
    });
    
    document.getElementById('addFlightBtn').addEventListener('click', showAddFlightModal);
    document.getElementById('addBaggageBtn').addEventListener('click', showAddBaggageModal);
    document.getElementById('assignCarouselBtn').addEventListener('click', showAssignCarouselModal);
    
    document.getElementById('filterFlight').addEventListener('change', renderBaggage);
    document.getElementById('filterCarousel').addEventListener('change', renderBaggage);
    document.getElementById('searchBarcode').addEventListener('input', renderBaggage);
}

function showAddFlightModal() {
    const content = `
        <form id="addFlightForm">
            <div class="form-group">
                <label for="flightNo">航班号 *</label>
                <input type="text" id="flightNo" placeholder="例如: CA1234" required>
            </div>
            <div class="form-group">
                <label for="arrivalTime">到达时间 *</label>
                <input type="datetime-local" id="arrivalTime" required>
            </div>
            <div class="form-group">
                <label for="origin">出发地</label>
                <input type="text" id="origin" placeholder="例如: 北京">
            </div>
            <div class="form-group">
                <label for="destination">目的地</label>
                <input type="text" id="destination" placeholder="例如: 上海">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">添加</button>
            </div>
        </form>
    `;
    
    openModal('添加航班', content);
    
    document.getElementById('addFlightForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const flightData = {
            flight_no: document.getElementById('flightNo').value,
            arrival_time: document.getElementById('arrivalTime').value.replace('T', ' '),
            origin: document.getElementById('origin').value,
            destination: document.getElementById('destination').value
        };
        
        try {
            await apiRequest('/api/flights', {
                method: 'POST',
                body: JSON.stringify(flightData)
            });
            showToast('航班添加成功');
            closeModal();
            loadAllData();
        } catch (error) {
            showToast('添加失败', 'error');
        }
    });
}

function showAddBaggageModal() {
    const flightOptions = state.flights.map(f => 
        `<option value="${f.id}">${f.flight_no} (${f.arrival_time})</option>`
    ).join('');
    
    const content = `
        <form id="addBaggageForm">
            <div class="form-group">
                <label for="barcode">行李条码 *</label>
                <input type="text" id="barcode" placeholder="扫描或输入条码" required autofocus>
            </div>
            <div class="form-group">
                <label for="baggageFlight">所属航班 *</label>
                <select id="baggageFlight" required>
                    <option value="">请选择航班</option>
                    ${flightOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="transferFlight">中转航班 (可选)</label>
                <input type="text" id="transferFlight" placeholder="例如: MU5678">
            </div>
            <div class="form-group">
                <label for="carousel">转盘号</label>
                <input type="number" id="carousel" placeholder="例如: 1">
            </div>
            <div class="form-group">
                <div class="checkbox-group">
                    <label class="checkbox-item">
                        <input type="checkbox" id="isTransfer">
                        <span>中转行李</span>
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" id="isOversize">
                        <span>超大件</span>
                    </label>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">添加</button>
            </div>
        </form>
    `;
    
    openModal('扫描条码', content);
    
    document.getElementById('addBaggageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const baggageData = {
            barcode: document.getElementById('barcode').value,
            flight_id: document.getElementById('baggageFlight').value,
            transfer_flight: document.getElementById('transferFlight').value || null,
            carousel: document.getElementById('carousel').value ? parseInt(document.getElementById('carousel').value) : null,
            is_transfer: document.getElementById('isTransfer').checked,
            is_oversize: document.getElementById('isOversize').checked
        };
        
        try {
            await apiRequest('/api/baggage', {
                method: 'POST',
                body: JSON.stringify(baggageData)
            });
            showToast('行李添加成功');
            closeModal();
            loadAllData();
        } catch (error) {
            const err = await error;
            showToast('添加失败: ' + (err.error || '未知错误'), 'error');
        }
    });
}

function editBaggage(baggageId) {
    const bag = state.baggage.find(b => b.id === baggageId);
    if (!bag) return;
    
    const flightOptions = state.flights.map(f => 
        `<option value="${f.id}" ${f.id === bag.flight_id ? 'selected' : ''}>${f.flight_no}</option>`
    ).join('');
    
    const content = `
        <form id="editBaggageForm">
            <div class="form-group">
                <label for="editBarcode">行李条码</label>
                <input type="text" id="editBarcode" value="${bag.barcode}" readonly>
            </div>
            <div class="form-group">
                <label for="editBaggageFlight">所属航班</label>
                <select id="editBaggageFlight">
                    <option value="">请选择航班</option>
                    ${flightOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="editTransferFlight">中转航班</label>
                <input type="text" id="editTransferFlight" value="${bag.transfer_flight || ''}" placeholder="例如: MU5678">
            </div>
            <div class="form-group">
                <label for="editCarousel">转盘号</label>
                <input type="number" id="editCarousel" value="${bag.carousel || ''}" placeholder="例如: 1">
            </div>
            <div class="form-group">
                <div class="checkbox-group">
                    <label class="checkbox-item">
                        <input type="checkbox" id="editIsTransfer" ${bag.is_transfer ? 'checked' : ''}>
                        <span>中转行李</span>
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" id="editIsOversize" ${bag.is_oversize ? 'checked' : ''}>
                        <span>超大件</span>
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" id="editIsLoaded" ${bag.is_loaded ? 'checked' : ''}>
                        <span>已装车</span>
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label for="noteType">添加备注</label>
                <select id="noteType">
                    <option value="">无</option>
                    <option value="damage">破损</option>
                    <option value="opening">人工开箱</option>
                    <option value="other">其他</option>
                </select>
            </div>
            <div class="form-group" id="noteContentGroup" style="display: none;">
                <label for="noteContent">备注内容</label>
                <textarea id="noteContent" placeholder="输入备注详情..."></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    
    openModal('编辑行李', content);
    
    document.getElementById('noteType').addEventListener('change', (e) => {
        document.getElementById('noteContentGroup').style.display = e.target.value ? 'block' : 'none';
    });
    
    document.getElementById('editBaggageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const baggageData = {
            transfer_flight: document.getElementById('editTransferFlight').value || null,
            carousel: document.getElementById('editCarousel').value ? parseInt(document.getElementById('editCarousel').value) : null,
            is_transfer: document.getElementById('editIsTransfer').checked,
            is_oversize: document.getElementById('editIsOversize').checked,
            is_loaded: document.getElementById('editIsLoaded').checked
        };
        
        try {
            await apiRequest(`/api/baggage/${baggageId}`, {
                method: 'PUT',
                body: JSON.stringify(baggageData)
            });
            
            const noteType = document.getElementById('noteType').value;
            const noteContent = document.getElementById('noteContent').value;
            
            if (noteType && noteContent) {
                await apiRequest('/api/notes', {
                    method: 'POST',
                    body: JSON.stringify({
                        baggage_id: baggageId,
                        note_type: noteType,
                        content: noteContent
                    })
                });
            }
            
            showToast('保存成功');
            closeModal();
            loadAllData();
        } catch (error) {
            showToast('保存失败', 'error');
        }
    });
}

async function loadBaggage(baggageId) {
    try {
        await apiRequest(`/api/baggage/${baggageId}/load`, {
            method: 'POST'
        });
        showToast('已标记为装车');
        loadAllData();
    } catch (error) {
        showToast('操作失败', 'error');
    }
}

function viewFlightBaggage(flightId) {
    document.getElementById('filterFlight').value = flightId;
    renderBaggage();
    document.querySelector('[data-tab="baggage"]').click();
}

function showAssignCarouselModal() {
    const flightOptions = state.flights.map(f => 
        `<option value="${f.id}">${f.flight_no} (${f.baggage_count || 0}件行李)</option>`
    ).join('');
    
    const content = `
        <form id="assignCarouselForm">
            <div class="form-group">
                <label for="assignFlight">选择航班 *</label>
                <select id="assignFlight" required>
                    <option value="">请选择航班</option>
                    ${flightOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="assignCarousel">转盘号 *</label>
                <input type="number" id="assignCarousel" placeholder="例如: 1" required min="1">
            </div>
            <div class="form-group">
                <label for="assignedBy">操作员</label>
                <input type="text" id="assignedBy" placeholder="操作员姓名">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">分配</button>
            </div>
        </form>
    `;
    
    openModal('分配转盘', content);
    
    document.getElementById('assignCarouselForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            flight_id: document.getElementById('assignFlight').value,
            carousel_number: parseInt(document.getElementById('assignCarousel').value),
            assigned_by: document.getElementById('assignedBy').value || null
        };
        
        try {
            await apiRequest('/api/carousel-assignments', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('转盘分配成功');
            closeModal();
            loadAllData();
        } catch (error) {
            showToast('分配失败', 'error');
        }
    });
}

async function acknowledgeAlert(alertId) {
    try {
        await apiRequest(`/api/risk-alerts/${alertId}/acknowledge`, {
            method: 'PUT',
            body: JSON.stringify({ acknowledged_by: '操作员' })
        });
        showToast('已确认处理');
        loadAllData();
    } catch (error) {
        showToast('操作失败', 'error');
    }
}
