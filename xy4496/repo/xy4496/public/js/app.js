const API_BASE = '';

let riskChart = null;
let trendChart = null;
let currentOrderNumber = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    refreshDashboard();
    loadOrders();
    loadOrderSelect();
});

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'dashboard') refreshDashboard();
            if (tabId === 'orders') loadOrders();
            if (tabId === 'detail') loadOrderSelect();
        });
    });
}

async function apiCall(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return await response.json();
    } catch (error) {
        showToast('网络请求失败: ' + error.message, 'error');
        throw error;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function getRiskLabel(risk) {
    const labels = { high: '高风险', medium: '中风险', low: '低风险' };
    return labels[risk] || risk;
}

async function refreshDashboard() {
    try {
        const stats = await apiCall('/api/statistics');
        
        document.getElementById('total-orders').textContent = stats.totalOrders;
        document.getElementById('high-risk').textContent = stats.highRisk;
        document.getElementById('medium-risk').textContent = stats.mediumRisk;
        document.getElementById('low-risk').textContent = stats.lowRisk;
        document.getElementById('reviewed').textContent = stats.reviewed;

        renderRiskChart(stats);
        renderTrendChart();
    } catch (error) {
        console.error('刷新仪表盘失败:', error);
    }
}

function renderRiskChart(stats) {
    const ctx = document.getElementById('riskChart').getContext('2d');
    
    if (riskChart) {
        riskChart.destroy();
    }

    riskChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['高风险', '中风险', '低风险'],
            datasets: [{
                data: [stats.highRisk, stats.mediumRisk, stats.lowRisk],
                backgroundColor: ['#e74c3c', '#f39c12', '#27ae60'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

async function renderTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (trendChart) {
        trendChart.destroy();
    }

    const orders = await apiCall('/api/orders');
    
    const dateGroups = {};
    orders.forEach(order => {
        const date = order.production_date || order.created_at?.split(' ')[0] || '未知';
        if (!dateGroups[date]) {
            dateGroups[date] = { high: 0, medium: 0, low: 0 };
        }
        const risk = order.overall_risk || 'low';
        dateGroups[date][risk]++;
    });

    const sortedDates = Object.keys(dateGroups).sort().slice(-10);

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                {
                    label: '高风险',
                    data: sortedDates.map(d => dateGroups[d].high),
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '中风险',
                    data: sortedDates.map(d => dateGroups[d].medium),
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '低风险',
                    data: sortedDates.map(d => dateGroups[d].low),
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

async function loadOrders() {
    try {
        const orders = await apiCall('/api/orders');
        const riskFilter = document.getElementById('risk-filter').value;
        const searchText = document.getElementById('order-search').value.toLowerCase();

        let filteredOrders = orders;

        if (riskFilter) {
            filteredOrders = filteredOrders.filter(o => o.overall_risk === riskFilter);
        }

        if (searchText) {
            filteredOrders = filteredOrders.filter(o => 
                o.order_number?.toLowerCase().includes(searchText) ||
                o.customer_name?.toLowerCase().includes(searchText)
            );
        }

        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '';

        if (filteredOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: #7f8c8d;">暂无订单数据</td></tr>`;
            return;
        }

        filteredOrders.forEach(order => {
            const tr = document.createElement('tr');
            const finalRisk = order.manual_override || order.overall_risk || 'low';
            
            tr.innerHTML = `
                <td><strong>${order.order_number || '-'}</strong></td>
                <td>${order.box_type || '-'}</td>
                <td>${order.customer_name || '-'}</td>
                <td>${order.quantity || '-'}</td>
                <td><span class="risk-badge ${finalRisk}">${getRiskLabel(finalRisk)}</span></td>
                <td><span class="risk-badge ${order.pressure_risk || 'low'}">${getRiskLabel(order.pressure_risk || 'low')}</span></td>
                <td><span class="risk-badge ${order.moisture_risk || 'low'}">${getRiskLabel(order.moisture_risk || 'low')}</span></td>
                <td><span class="risk-badge ${order.stack_risk || 'low'}">${getRiskLabel(order.stack_risk || 'low')}</span></td>
                <td><span class="review-badge ${order.review_status || 'pending'}">${order.review_status === 'reviewed' ? '已复核' : '待复核'}</span></td>
                <td>
                    <button class="action-btn view" onclick="viewOrderDetail('${order.order_number}')">查看</button>
                    <button class="action-btn override" onclick="openOverrideModal('${order.order_number}', '${order.overall_risk || 'low'}')">改判</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('加载订单失败:', error);
    }
}

function viewOrderDetail(orderNumber) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector('[data-tab="detail"]').classList.add('active');
    document.getElementById('detail').classList.add('active');
    
    document.getElementById('detail-order-select').value = orderNumber;
    loadOrderDetail(orderNumber);
}

async function loadOrderSelect() {
    try {
        const orders = await apiCall('/api/orders');
        const select = document.getElementById('detail-order-select');
        
        select.innerHTML = '<option value="">请选择订单</option>';
        orders.forEach(order => {
            const option = document.createElement('option');
            option.value = order.order_number;
            option.textContent = `${order.order_number} - ${order.customer_name || '未知客户'}`;
            select.appendChild(option);
        });

        if (currentOrderNumber) {
            select.value = currentOrderNumber;
        }
    } catch (error) {
        console.error('加载订单选择器失败:', error);
    }
}

async function loadOrderDetail(orderNumber) {
    if (!orderNumber) {
        orderNumber = document.getElementById('detail-order-select').value;
    }
    
    if (!orderNumber) {
        document.getElementById('order-detail-content').innerHTML = `
            <div class="empty-state">
                <p>请选择一个订单查看详情</p>
            </div>
        `;
        return;
    }

    currentOrderNumber = orderNumber;

    try {
        const data = await apiCall('/api/orders/' + orderNumber);
        const finalRisk = data.assessment?.manual_override || data.assessment?.overall_risk || 'low';
        
        let html = '';

        html += `<div class="detail-card">
            <h3>📋 基本信息</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="label">订单号</span>
                    <span class="value">${data.order?.order_number || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">箱型</span>
                    <span class="value">${data.order?.box_type || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">尺寸</span>
                    <span class="value">${data.order?.box_size || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">客户</span>
                    <span class="value">${data.order?.customer_name || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">数量</span>
                    <span class="value">${data.order?.quantity || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">生产日期</span>
                    <span class="value">${data.order?.production_date || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">综合风险</span>
                    <span class="value"><span class="risk-badge ${finalRisk}">${getRiskLabel(finalRisk)}</span></span>
                </div>
                <div class="detail-item">
                    <span class="label">复核状态</span>
                    <span class="value"><span class="review-badge ${data.assessment?.review_status || 'pending'}">${data.assessment?.review_status === 'reviewed' ? '已复核' : '待复核'}</span></span>
                </div>
            </div>
        </div>`;

        if (data.assessment?.manual_override) {
            html += `<div class="detail-card" style="background: #fff8e1; border-left: 4px solid #f39c12;">
                <h3>⚠️ 人工改判记录</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">原评估</span>
                        <span class="value">${getRiskLabel(data.assessment.overall_risk || 'low')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">改判为</span>
                        <span class="value">${getRiskLabel(data.assessment.manual_override)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">改判人</span>
                        <span class="value">${data.assessment.override_by || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">改判时间</span>
                        <span class="value">${data.assessment.override_date || '-'}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2;">
                        <span class="label">改判理由</span>
                        <span class="value">${data.assessment.override_reason || '-'}</span>
                    </div>
                </div>
            </div>`;
        }

        html += `<div class="detail-card">
            <h3>🎯 风险评估详情</h3>
            <div class="risk-summary">
                <div class="risk-item ${data.assessment?.pressure_risk || 'low'}">
                    <div class="risk-title">抗压风险: <span class="risk-badge ${data.assessment?.pressure_risk || 'low'}">${getRiskLabel(data.assessment?.pressure_risk || 'low')}</span></div>
                    <div class="risk-reason">${data.assessment?.pressure_risk_reason || '-'}</div>
                </div>
                <div class="risk-item ${data.assessment?.moisture_risk || 'low'}">
                    <div class="risk-title">受潮风险: <span class="risk-badge ${data.assessment?.moisture_risk || 'low'}">${getRiskLabel(data.assessment?.moisture_risk || 'low')}</span></div>
                    <div class="risk-reason">${data.assessment?.moisture_risk_reason || '-'}</div>
                </div>
                <div class="risk-item ${data.assessment?.stack_risk || 'low'}">
                    <div class="risk-title">堆码风险: <span class="risk-badge ${data.assessment?.stack_risk || 'low'}">${getRiskLabel(data.assessment?.stack_risk || 'low')}</span></div>
                    <div class="risk-reason">${data.assessment?.stack_risk_reason || '-'}</div>
                </div>
            </div>
        </div>`;

        if (data.testResult) {
            html += `<div class="detail-card">
                <h3>📊 测试数据</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">批次号</span>
                        <span class="value">${data.testResult.batch_number || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">瓦楞类型</span>
                        <span class="value">${data.testResult.corrugated_type || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">纸质等级</span>
                        <span class="value">${data.testResult.paper_grade || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">供应商</span>
                        <span class="value">${data.testResult.manufacturer || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">边压强度</span>
                        <span class="value">${data.testResult.edge_crush || '-'} N/m (标准: ${data.testResult.edge_crush_min || '-'})</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">耐破强度</span>
                        <span class="value">${data.testResult.burst_strength || '-'} kPa (标准: ${data.testResult.burst_strength_min || '-'})</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">测试日期</span>
                        <span class="value">${data.testResult.test_date || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">测试人</span>
                        <span class="value">${data.testResult.tester || '-'}</span>
                    </div>
                </div>
            </div>`;
        }

        if (data.loading) {
            html += `<div class="detail-card">
                <h3>🚛 装车信息</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">车牌号</span>
                        <span class="value">${data.loading.vehicle_number || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">装车日期</span>
                        <span class="value">${data.loading.loading_date || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">堆码层数</span>
                        <span class="value">${data.loading.stack_layers || '-'} 层</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">总重量</span>
                        <span class="value">${data.loading.total_weight || '-'} kg</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2;">
                        <span class="label">目的地</span>
                        <span class="value">${data.loading.destination || '-'}</span>
                    </div>
                </div>
            </div>`;
        }

        html += `<div class="detail-card notes-section">
            <h3>📝 复核备注</h3>
            <div class="notes-form">
                <h4>添加备注</h4>
                <div class="detail-grid">
                    <div class="form-group">
                        <label>备注类型</label>
                        <select id="note-type">
                            <option value="general">一般备注</option>
                            <option value="quality">质量问题</option>
                            <option value="logistics">物流问题</option>
                            <option value="customer">客户反馈</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>复核人</label>
                        <input type="text" id="note-reviewer" placeholder="请输入姓名">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>备注内容</label>
                        <textarea id="note-content" rows="2" placeholder="请输入备注内容..."></textarea>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="addNote('${orderNumber}')">添加备注</button>
            </div>
            <div id="notes-list">`;

        if (data.notes && data.notes.length > 0) {
            data.notes.forEach(note => {
                html += `<div class="note-item">
                    <div class="note-meta">
                        <span>类型: ${note.note_type || '一般'}</span>
                        <span>复核人: ${note.reviewer || '-'}</span>
                        <span>${note.review_date || '-'}</span>
                    </div>
                    <div class="note-content">${note.content || '-'}</div>
                </div>`;
            });
        } else {
            html += `<p style="color: #7f8c8d; text-align: center; padding: 20px;">暂无备注记录</p>`;
        }

        html += `</div></div>`;

        html += `<div class="actions-bar" style="margin-top: 20px;">
            <button class="btn btn-primary" onclick="reAnalyzeOrder('${orderNumber}')">🔍 重新分析</button>
            <button class="action-btn override" onclick="openOverrideModal('${orderNumber}', '${data.assessment?.overall_risk || 'low'}')">✏️ 人工改判</button>
        </div>`;

        document.getElementById('order-detail-content').innerHTML = html;
    } catch (error) {
        console.error('加载订单详情失败:', error);
        document.getElementById('order-detail-content').innerHTML = `
            <div class="empty-state">
                <p>加载订单详情失败</p>
            </div>
        `;
    }
}

function refreshOrderDetail() {
    if (currentOrderNumber) {
        loadOrderDetail(currentOrderNumber);
    }
}

async function reAnalyzeOrder(orderNumber) {
    try {
        showToast('正在分析...', 'info');
        const result = await apiCall('/api/analyze/' + orderNumber, { method: 'POST' });
        showToast('分析完成', 'success');
        loadOrderDetail(orderNumber);
        refreshDashboard();
        loadOrders();
    } catch (error) {
        showToast('分析失败', 'error');
    }
}

async function analyzeAllOrders() {
    try {
        showToast('正在分析所有订单...', 'info');
        const result = await apiCall('/api/analyze-all', { method: 'POST' });
        showToast(`分析完成，共 ${result.length} 个订单`, 'success');
        refreshDashboard();
        loadOrders();
    } catch (error) {
        showToast('分析失败', 'error');
    }
}

async function addNote(orderNumber) {
    const noteType = document.getElementById('note-type').value;
    const noteContent = document.getElementById('note-content').value;
    const noteReviewer = document.getElementById('note-reviewer').value;

    if (!noteContent.trim()) {
        showToast('请输入备注内容', 'error');
        return;
    }

    try {
        const result = await apiCall('/api/orders/' + orderNumber + '/notes', {
            method: 'POST',
            body: JSON.stringify({
                note_type: noteType,
                content: noteContent,
                reviewer: noteReviewer
            })
        });

        if (result.success) {
            showToast('备注添加成功', 'success');
            document.getElementById('note-content').value = '';
            loadOrderDetail(orderNumber);
        } else {
            showToast('添加失败: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('添加失败', 'error');
    }
}

function openOverrideModal(orderNumber, originalRisk) {
    document.getElementById('override-order-number').value = orderNumber;
    document.getElementById('override-original').value = getRiskLabel(originalRisk);
    document.getElementById('override-new').value = originalRisk;
    document.getElementById('override-reason').value = '';
    document.getElementById('override-by').value = '';
    document.getElementById('override-notes').value = '';
    
    document.getElementById('override-modal').classList.add('show');
}

function closeOverrideModal() {
    document.getElementById('override-modal').classList.remove('show');
}

async function submitOverride() {
    const orderNumber = document.getElementById('override-order-number').value;
    const manualOverride = document.getElementById('override-new').value;
    const overrideReason = document.getElementById('override-reason').value;
    const overrideBy = document.getElementById('override-by').value;
    const notes = document.getElementById('override-notes').value;

    if (!overrideReason.trim()) {
        showToast('请输入改判理由', 'error');
        return;
    }

    try {
        const result = await apiCall('/api/orders/' + orderNumber + '/override', {
            method: 'POST',
            body: JSON.stringify({
                manual_override: manualOverride,
                override_reason: overrideReason,
                override_by: overrideBy,
                notes: notes
            })
        });

        if (result.success) {
            showToast('改判成功', 'success');
            closeOverrideModal();
            refreshDashboard();
            loadOrders();
            if (currentOrderNumber === orderNumber) {
                loadOrderDetail(orderNumber);
            }
        } else {
            showToast('改判失败: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('改判失败', 'error');
    }
}

function exportMarkdown() {
    if (!currentOrderNumber) {
        showToast('请先选择订单', 'error');
        return;
    }
    window.open('/api/export/markdown/' + currentOrderNumber, '_blank');
}

function exportJSONAudit() {
    if (!currentOrderNumber) {
        showToast('请先选择订单', 'error');
        return;
    }
    window.open('/api/export/json/' + currentOrderNumber, '_blank');
}

async function importCSV() {
    const dataType = document.getElementById('csv-data-type').value;
    const fileInput = document.getElementById('csv-file');
    
    if (!fileInput.files[0]) {
        showToast('请选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('data_type', dataType);

    try {
        showToast('正在导入...', 'info');
        const response = await fetch('/api/import/csv', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        if (result.success) {
            showToast(`导入成功: ${result.imported} 条记录`, 'success');
            refreshDashboard();
            loadOrders();
            loadOrderSelect();
        } else {
            showToast('导入失败: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('导入失败', 'error');
    }
}

async function importJSON() {
    const fileInput = document.getElementById('json-file');
    
    if (!fileInput.files[0]) {
        showToast('请选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        showToast('正在导入...', 'info');
        const response = await fetch('/api/import/json', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        if (result.success) {
            showToast(`导入成功: ${result.imported} 条记录`, 'success');
            refreshDashboard();
            loadOrders();
            loadOrderSelect();
        } else {
            showToast('导入失败: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('导入失败', 'error');
    }
}

async function importSampleData() {
    try {
        showToast('正在导入示例数据...', 'info');
        
        const sampleOrders = [
            { order_number: 'ORD-2026-001', box_type: 'A楞', box_size: '50x30x40', customer_name: '阿里巴巴', quantity: 500, production_date: '2026-04-20' },
            { order_number: 'ORD-2026-002', box_type: 'B楞', box_size: '40x25x30', customer_name: '腾讯科技', quantity: 1000, production_date: '2026-04-22' },
            { order_number: 'ORD-2026-003', box_type: 'AB楞', box_size: '60x40x50', customer_name: '京东物流', quantity: 300, production_date: '2026-04-15' },
            { order_number: 'ORD-2026-004', box_type: 'E楞', box_size: '30x20x15', customer_name: '拼多多', quantity: 2000, production_date: '2026-04-25' },
            { order_number: 'ORD-2026-005', box_type: 'A楞', box_size: '45x35x45', customer_name: '美团优选', quantity: 800, production_date: '2026-04-10' }
        ];

        for (const order of sampleOrders) {
            try {
                await apiCall('/api/orders', {
                    method: 'POST',
                    body: JSON.stringify(order)
                });
            } catch (e) {
                console.log('订单可能已存在:', order.order_number);
            }
        }

        const sampleBatches = [
            { batch_number: 'CB-2026-001', corrugated_type: 'A楞', paper_grade: 'K级', manufacturer: '华润纸业', production_date: '2026-04-01', expiration_date: '2026-06-30' },
            { batch_number: 'CB-2026-002', corrugated_type: 'B楞', paper_grade: 'A级', manufacturer: '玖龙纸业', production_date: '2026-04-05', expiration_date: '2026-07-05' },
            { batch_number: 'CB-2026-003', corrugated_type: 'AB楞', paper_grade: 'K级', manufacturer: '理文造纸', production_date: '2026-03-20', expiration_date: '2026-06-20' },
            { batch_number: 'CB-2026-004', corrugated_type: 'E楞', paper_grade: 'B级', manufacturer: '山鹰纸业', production_date: '2026-04-10', expiration_date: '2026-07-10' }
        ];

        for (const batch of sampleBatches) {
            try {
                await apiCall('/api/batches', {
                    method: 'POST',
                    body: JSON.stringify(batch)
                });
            } catch (e) {
                console.log('批次可能已存在:', batch.batch_number);
            }
        }

        const sampleTests = [
            { order_number: 'ORD-2026-001', batch_number: 'CB-2026-001', edge_crush: 85, edge_crush_min: 100, burst_strength: 180, burst_strength_min: 200, test_date: '2026-04-21', tester: '张三' },
            { order_number: 'ORD-2026-002', batch_number: 'CB-2026-002', edge_crush: 95, edge_crush_min: 90, burst_strength: 220, burst_strength_min: 180, test_date: '2026-04-23', tester: '李四' },
            { order_number: 'ORD-2026-003', batch_number: 'CB-2026-003', edge_crush: 65, edge_crush_min: 120, burst_strength: 150, burst_strength_min: 250, test_date: '2026-04-16', tester: '王五' },
            { order_number: 'ORD-2026-004', batch_number: 'CB-2026-004', edge_crush: 110, edge_crush_min: 80, burst_strength: 250, burst_strength_min: 150, test_date: '2026-04-26', tester: '赵六' },
            { order_number: 'ORD-2026-005', batch_number: 'CB-2026-001', edge_crush: 90, edge_crush_min: 100, burst_strength: 190, burst_strength_min: 200, test_date: '2026-04-11', tester: '张三' }
        ];

        for (const test of sampleTests) {
            try {
                await apiCall('/api/tests', {
                    method: 'POST',
                    body: JSON.stringify(test)
                });
            } catch (e) {
                console.log('测试记录可能已存在');
            }
        }

        const sampleEnv = [
            { record_date: '2026-04-20', temperature: 22, humidity: 65, location: '仓库A', recorded_by: '管理员' },
            { record_date: '2026-04-21', temperature: 24, humidity: 72, location: '仓库A', recorded_by: '管理员' },
            { record_date: '2026-04-22', temperature: 23, humidity: 68, location: '仓库A', recorded_by: '管理员' },
            { record_date: '2026-04-23', temperature: 25, humidity: 85, location: '仓库B', recorded_by: '管理员' },
            { record_date: '2026-04-24', temperature: 26, humidity: 82, location: '仓库B', recorded_by: '管理员' },
            { record_date: '2026-04-25', temperature: 24, humidity: 70, location: '仓库A', recorded_by: '管理员' },
            { record_date: '2026-04-26', temperature: 38, humidity: 60, location: '仓库C', recorded_by: '管理员' },
            { record_date: '2026-04-27', temperature: 36, humidity: 58, location: '仓库C', recorded_by: '管理员' }
        ];

        for (const env of sampleEnv) {
            try {
                await apiCall('/api/environment', {
                    method: 'POST',
                    body: JSON.stringify(env)
                });
            } catch (e) {
                console.log('环境记录可能已存在');
            }
        }

        const sampleLoading = [
            { order_number: 'ORD-2026-001', vehicle_number: '京A12345', loading_date: '2026-04-25', stack_layers: 8, total_weight: 1500, destination: '杭州' },
            { order_number: 'ORD-2026-002', vehicle_number: '沪B67890', loading_date: '2026-04-26', stack_layers: 4, total_weight: 2200, destination: '深圳' },
            { order_number: 'ORD-2026-003', vehicle_number: '粤C11111', loading_date: '2026-04-20', stack_layers: 6, total_weight: 1800, destination: '广州' },
            { order_number: 'ORD-2026-004', vehicle_number: '苏D22222', loading_date: '2026-04-28', stack_layers: 3, total_weight: 800, destination: '南京' },
            { order_number: 'ORD-2026-005', vehicle_number: '浙E33333', loading_date: '2026-04-15', stack_layers: 5, total_weight: 1200, destination: '上海' }
        ];

        for (const load of sampleLoading) {
            try {
                await apiCall('/api/loading', {
                    method: 'POST',
                    body: JSON.stringify(load)
                });
            } catch (e) {
                console.log('装车记录可能已存在');
            }
        }

        showToast('正在分析订单...', 'info');
        await apiCall('/api/analyze-all', { method: 'POST' });

        showToast('示例数据导入完成！', 'success');
        refreshDashboard();
        loadOrders();
        loadOrderSelect();
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
        console.error(error);
    }
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'override-modal') {
        closeOverrideModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeOverrideModal();
    }
});
