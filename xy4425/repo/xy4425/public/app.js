const API_BASE = '/api';
let currentOrderId = null;

async function apiRequest(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

function showLoading() {
    document.getElementById('main-content').innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>加载中...</p>
        </div>
    `;
}

function showMessage(message, type = 'info') {
    const alertClass = `alert-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    
    const alertHtml = `
        <div class="alert ${alertClass}" style="position: fixed; top: 20px; right: 20px; z-index: 1001; max-width: 400px;">
            ${icon} ${message}
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert[style*="position: fixed"]');
        alerts.forEach(alert => alert.remove());
    }, 3000);
}

async function showOrders() {
    showLoading();
    
    try {
        const orders = await apiRequest('/orders');
        
        if (orders.length === 0) {
            document.getElementById('main-content').innerHTML = `
                <div class="card">
                    <h2>订单列表</h2>
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <h3>暂无订单</h3>
                        <p>点击"新建订单"开始创建您的第一个订单</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <div class="card">
                <h2>订单列表 (${orders.length})</h2>
                <div class="order-list">
        `;

        for (const order of orders) {
            try {
                const orderDetail = await apiRequest(`/orders/${order.id}`);
                const risks = orderDetail.risks || [];
                
                const critical = risks.filter(r => r.severity === 'critical').length;
                const high = risks.filter(r => r.severity === 'high').length;
                const medium = risks.filter(r => r.severity === 'medium').length;
                
                let riskBadges = '';
                if (critical > 0) riskBadges += `<span class="risk-badge risk-critical">🚨 ${critical} 严重</span>`;
                if (high > 0) riskBadges += `<span class="risk-badge risk-high">⚠️ ${high} 高风险</span>`;
                if (medium > 0) riskBadges += `<span class="risk-badge risk-medium">ℹ️ ${medium} 中等</span>`;
                if (risks.length === 0) riskBadges += `<span class="risk-badge risk-none">✅ 无风险</span>`;

                html += `
                    <div class="order-item" onclick="showOrderDetail(${order.id})">
                        <div class="order-header">
                            <span class="order-number">${order.order_number} - ${order.customer_name}</span>
                            <span class="order-status status-${order.status}">${getStatusText(order.status)}</span>
                        </div>
                        <div class="order-details">
                            <strong>类型:</strong> ${getOrderTypeText(order.order_type)}
                        </div>
                        <div class="order-meta">
                            <span>📅 下单: ${order.order_date}</span>
                            ${order.delivery_date ? `<span>🚚 预计发货: ${order.delivery_date}</span>` : ''}
                        </div>
                        <div class="risk-summary">
                            ${riskBadges}
                        </div>
                    </div>
                `;
            } catch (e) {
                console.error('获取订单风险失败:', e);
            }
        }

        html += `</div></div>`;
        document.getElementById('main-content').innerHTML = html;
        
    } catch (error) {
        showMessage('加载订单列表失败: ' + error.message, 'error');
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'processing': '加工中',
        'reviewing': '复核中',
        'approved': '已放行',
        'shipped': '已发货'
    };
    return statusMap[status] || status;
}

function getOrderTypeText(type) {
    const typeMap = {
        'stair': '楼梯踏步',
        'countertop': '台面',
        'both': '楼梯+台面'
    };
    return typeMap[type] || type;
}

function getSeverityText(severity) {
    const map = {
        'critical': '严重',
        'high': '高',
        'medium': '中',
        'normal': '正常'
    };
    return map[severity] || severity;
}

function showNewOrder() {
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('main-content').innerHTML = `
        <div class="card">
            <h2>新建订单</h2>
            <form id="new-order-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>订单号 *</label>
                        <input type="text" name="order_number" required placeholder="例如: ORD-2026-001">
                    </div>
                    <div class="form-group">
                        <label>客户名称 *</label>
                        <input type="text" name="customer_name" required placeholder="客户姓名/公司名称">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>订单类型 *</label>
                        <select name="order_type" required>
                            <option value="stair">楼梯踏步</option>
                            <option value="countertop">台面</option>
                            <option value="both">楼梯+台面</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>订单日期 *</label>
                        <input type="date" name="order_date" required value="${today}">
                    </div>
                    <div class="form-group">
                        <label>预计发货日期</label>
                        <input type="date" name="delivery_date">
                    </div>
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea name="notes" placeholder="订单备注信息..."></textarea>
                </div>
                <div class="btn-group">
                    <button type="submit" class="btn-primary">创建订单</button>
                    <button type="button" class="btn-secondary" onclick="showOrders()">取消</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('new-order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const result = await apiRequest('/orders', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showMessage('订单创建成功!', 'success');
            setTimeout(() => showOrderDetail(result.id), 500);
        } catch (error) {
            showMessage('创建订单失败: ' + error.message, 'error');
        }
    });
}

async function showOrderDetail(orderId) {
    currentOrderId = orderId;
    showLoading();

    try {
        const data = await apiRequest(`/orders/${orderId}`);
        const { order, slabs, cutting_logs, inspections, comments, dimension_specs, risks } = data;

        const criticalCount = risks.filter(r => r.severity === 'critical').length;
        const highCount = risks.filter(r => r.severity === 'high').length;

        let risksHtml = '';
        if (risks.length === 0) {
            risksHtml = `
                <div class="alert alert-success">
                    ✅ <strong>无风险项</strong> - 该订单可以安全发货
                </div>
            `;
        } else {
            risks.forEach(risk => {
                risksHtml += `
                    <div class="risk-item ${risk.severity}">
                        <div class="risk-item-title">
                            ${risk.severity === 'critical' ? '🚨 严重' : risk.severity === 'high' ? '⚠️ 高' : 'ℹ️ 中等'}
                            - ${getRiskTypeText(risk.type)}
                        </div>
                        <div class="risk-item-message">${risk.message}</div>
                    </div>
                `;
            });
        }

        let specsHtml = dimension_specs.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>部件名称</th>
                            <th>规格长度(mm)</th>
                            <th>规格宽度(mm)</th>
                            <th>规格厚度(mm)</th>
                            <th>方向</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dimension_specs.map(s => `
                            <tr>
                                <td>${s.piece_name || '-'}</td>
                                <td>${s.spec_length || '-'}</td>
                                <td>${s.spec_width || '-'}</td>
                                <td>${s.spec_thickness || '-'}</td>
                                <td>${s.direction || '-'}</td>
                                <td>${s.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p class="empty-state">暂无尺寸规格记录</p>';

        let slabsHtml = slabs.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>批次号</th>
                            <th>石板编号</th>
                            <th>颜色</th>
                            <th>厚度(mm)</th>
                            <th>宽度(mm)</th>
                            <th>高度(mm)</th>
                            <th>裂纹</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${slabs.map(s => `
                            <tr>
                                <td>${s.batch_number}</td>
                                <td>${s.slab_number}</td>
                                <td>${s.color || '-'}</td>
                                <td>${s.thickness || '-'}</td>
                                <td>${s.width || '-'}</td>
                                <td>${s.height || '-'}</td>
                                <td>${s.has_cracks ? '❌ 是' : '✅ 否'}</td>
                                <td>${s.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p class="empty-state">暂无石板记录</p>';

        let cutsHtml = cutting_logs.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>部件名称</th>
                            <th>切割类型</th>
                            <th>长度(mm)</th>
                            <th>宽度(mm)</th>
                            <th>方向</th>
                            <th>设备</th>
                            <th>操作员</th>
                            <th>日期</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cutting_logs.map(c => `
                            <tr>
                                <td>${c.piece_name || '-'}</td>
                                <td>${c.cutting_type}</td>
                                <td>${c.length || '-'}</td>
                                <td>${c.width || '-'}</td>
                                <td>${c.direction || '-'}</td>
                                <td>${c.machine || '-'}</td>
                                <td>${c.operator || '-'}</td>
                                <td>${c.cutting_date || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p class="empty-state">暂无切割日志</p>';

        let inspectionsHtml = inspections.length > 0 ? `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>检查类型</th>
                            <th>倒角</th>
                            <th>防滑槽</th>
                            <th>槽距(mm)</th>
                            <th>裂纹</th>
                            <th>尺寸合格</th>
                            <th>检查员</th>
                            <th>结果</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inspections.map(i => `
                            <tr>
                                <td>${i.inspection_type}</td>
                                <td>${i.has_chamfer ? '✅' : '❌'}</td>
                                <td>${i.has_anti_slip_groove ? '✅' : '❌'}</td>
                                <td>${i.groove_distance || '-'}</td>
                                <td>${i.has_cracks ? '❌' : '✅'}</td>
                                <td>${i.dimension_ok ? '✅' : '❌'}</td>
                                <td>${i.inspector || '-'}</td>
                                <td>${i.result || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p class="empty-state">暂无质检记录</p>';

        let commentsHtml = comments.length > 0 ? comments.map(c => `
            <div class="comment-item">
                <div class="comment-header">
                    <span><strong>${c.reviewer || '未填写'}</strong></span>
                    <span class="risk-badge risk-${c.risk_level === 'critical' ? 'critical' : c.risk_level === 'high' ? 'high' : 'medium'}">${getSeverityText(c.risk_level)}</span>
                </div>
                <div class="comment-content">${c.comment}</div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">${c.review_date}</div>
            </div>
        `).join('') : '<p class="empty-state">暂无复核意见</p>';

        document.getElementById('main-content').innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h2 style="margin: 0;">订单详情: ${order.order_number}</h2>
                    <div class="btn-group">
                        ${criticalCount > 0 || highCount > 0 ? 
                            '<button class="btn-danger" disabled style="opacity: 0.6;">⚠️ 存在风险，无法放行</button>' :
                            `<button class="btn-success" onclick="updateOrderStatus(${order.id}, 'approved')">✅ 标记为已放行</button>`
                        }
                        <button class="btn-primary" onclick="exportMarkdown(${order.id})">📄 导出放行单</button>
                        <button class="btn-secondary" onclick="exportJson(${order.id})">📦 导出审计包</button>
                        <button class="btn-secondary" onclick="showOrders()">← 返回列表</button>
                    </div>
                </div>

                <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <div class="form-row">
                        <div><strong>客户:</strong> ${order.customer_name}</div>
                        <div><strong>类型:</strong> ${getOrderTypeText(order.order_type)}</div>
                        <div><strong>状态:</strong> <span class="order-status status-${order.status}">${getStatusText(order.status)}</span></div>
                        <div><strong>下单日期:</strong> ${order.order_date}</div>
                        ${order.delivery_date ? `<div><strong>预计发货:</strong> ${order.delivery_date}</div>` : ''}
                    </div>
                    ${order.notes ? `<div style="margin-top: 0.5rem;"><strong>备注:</strong> ${order.notes}</div>` : ''}
                </div>

                <div class="tabs">
                    <div class="tab active" onclick="switchTab('risks-tab')">🚨 风险检测 (${risks.length})</div>
                    <div class="tab" onclick="switchTab('specs-tab')">📐 尺寸规格 (${dimension_specs.length})</div>
                    <div class="tab" onclick="switchTab('slabs-tab')">🪨 石板批次 (${slabs.length})</div>
                    <div class="tab" onclick="switchTab('cuts-tab')">✂️ 切割日志 (${cutting_logs.length})</div>
                    <div class="tab" onclick="switchTab('inspections-tab')">✅ 质检记录 (${inspections.length})</div>
                    <div class="tab" onclick="switchTab('comments-tab')">📝 复核意见 (${comments.length})</div>
                    <div class="tab" onclick="switchTab('import-tab')">📥 导入数据</div>
                </div>

                <div id="risks-tab" class="tab-content active">
                    <div class="card" style="margin: 0;">
                        <h3>风险检测报告</h3>
                        <div class="alert alert-info">
                            <strong>检测标准:</strong> 防滑槽间距 150-200mm | 尺寸公差 ±2mm
                        </div>
                        ${risksHtml}
                    </div>
                </div>

                <div id="specs-tab" class="tab-content">
                    <div class="card" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">尺寸规格</h3>
                            <button class="btn-primary" onclick="showAddSpecsModal()">+ 添加规格</button>
                        </div>
                        ${specsHtml}
                    </div>
                </div>

                <div id="slabs-tab" class="tab-content">
                    <div class="card" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">石板批次</h3>
                            <button class="btn-primary" onclick="showAddSlabModal()">+ 添加石板</button>
                        </div>
                        ${slabsHtml}
                    </div>
                </div>

                <div id="cuts-tab" class="tab-content">
                    <div class="card" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">切割日志</h3>
                            <button class="btn-primary" onclick="showAddCutModal()">+ 添加切割记录</button>
                        </div>
                        ${cutsHtml}
                    </div>
                </div>

                <div id="inspections-tab" class="tab-content">
                    <div class="card" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">质检记录</h3>
                            <button class="btn-primary" onclick="showAddInspectionModal()">+ 添加质检记录</button>
                        </div>
                        ${inspectionsHtml}
                    </div>
                </div>

                <div id="comments-tab" class="tab-content">
                    <div class="card" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">复核意见</h3>
                            <button class="btn-primary" onclick="showAddCommentModal()">+ 添加意见</button>
                        </div>
                        ${commentsHtml}
                    </div>
                </div>

                <div id="import-tab" class="tab-content">
                    <div class="card" style="margin: 0;">
                        <h3>导入数据</h3>
                        <p style="margin-bottom: 1rem;">支持导入 CSV 或 JSON 格式的数据文件</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                            <div class="import-section">
                                <h4>📐 尺寸规格</h4>
                                <p class="help-text">导入客户尺寸表</p>
                                <input type="file" id="import-specs" accept=".csv,.json" onchange="importData('specs', this)">
                                <label for="import-specs" class="import-label">选择文件</label>
                            </div>

                            <div class="import-section">
                                <h4>🪨 石板批次</h4>
                                <p class="help-text">导入石板批次信息</p>
                                <input type="file" id="import-slabs" accept=".csv,.json" onchange="importData('slabs', this)">
                                <label for="import-slabs" class="import-label">选择文件</label>
                            </div>

                            <div class="import-section">
                                <h4>✂️ 切割日志</h4>
                                <p class="help-text">导入 CNC/水刀切割日志</p>
                                <input type="file" id="import-cuts" accept=".csv,.json" onchange="importData('cuts', this)">
                                <label for="import-cuts" class="import-label">选择文件</label>
                            </div>

                            <div class="import-section">
                                <h4>✅ 质检记录</h4>
                                <p class="help-text">导入质检记录</p>
                                <input type="file" id="import-inspections" accept=".csv,.json" onchange="importData('inspections', this)">
                                <label for="import-inspections" class="import-label">选择文件</label>
                            </div>
                        </div>

                        <div class="alert alert-info" style="margin-top: 1.5rem;">
                            <strong>文件格式说明:</strong><br>
                            - CSV: 首行为表头，列名对应字段名 (如: piece_name, spec_length 等)<br>
                            - JSON: 数组格式，每个元素为一条记录
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        showMessage('加载订单详情失败: ' + error.message, 'error');
    }
}

function getRiskTypeText(type) {
    const map = {
        'direction_error': '方向错误',
        'dimension_error': '尺寸偏差',
        'color_mismatch': '色差混用',
        'cracked_slab': '裂纹石板',
        'groove_distance_error': '槽距不合规',
        'crack_after_cutting': '切割后裂纹',
        'dimension_failed': '尺寸不合格'
    };
    return map[type] || type;
}

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

async function updateOrderStatus(orderId, status) {
    try {
        await apiRequest(`/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        showMessage('订单状态已更新!', 'success');
        showOrderDetail(orderId);
    } catch (error) {
        showMessage('更新状态失败: ' + error.message, 'error');
    }
}

function exportMarkdown(orderId) {
    window.open(`${API_BASE}/orders/${orderId}/export/markdown`, '_blank');
}

function exportJson(orderId) {
    window.open(`${API_BASE}/orders/${orderId}/export/json`, '_blank');
}

function showModal(content) {
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

function showAddSpecsModal() {
    showModal(`
        <h3>添加尺寸规格</h3>
        <form id="add-specs-form" style="margin-top: 1rem;">
            <div class="form-row">
                <div class="form-group">
                    <label>部件名称 *</label>
                    <input type="text" name="piece_name" required placeholder="如: 踏步-1, 台面左">
                </div>
                <div class="form-group">
                    <label>方向</label>
                    <select name="direction">
                        <option value="">未指定</option>
                        <option value="横">横</option>
                        <option value="竖">竖</option>
                        <option value="左">左</option>
                        <option value="右">右</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>规格长度 (mm)</label>
                    <input type="number" name="spec_length" placeholder="长度">
                </div>
                <div class="form-group">
                    <label>规格宽度 (mm)</label>
                    <input type="number" name="spec_width" placeholder="宽度">
                </div>
                <div class="form-group">
                    <label>规格厚度 (mm)</label>
                    <input type="number" name="spec_thickness" placeholder="厚度">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" placeholder="特殊说明..."></textarea>
            </div>
            <div class="btn-group" style="margin-top: 1rem;">
                <button type="submit" class="btn-primary">添加</button>
                <button type="button" class="btn-secondary" onclick="closeModal()">取消</button>
            </div>
        </form>
    `);

    document.getElementById('add-specs-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            await apiRequest(`/orders/${currentOrderId}/specs`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showMessage('尺寸规格添加成功!', 'success');
            closeModal();
            showOrderDetail(currentOrderId);
        } catch (error) {
            showMessage('添加失败: ' + error.message, 'error');
        }
    });
}

function showAddSlabModal() {
    showModal(`
        <h3>添加石板记录</h3>
        <form id="add-slab-form" style="margin-top: 1rem;">
            <div class="form-row">
                <div class="form-group">
                    <label>批次号 *</label>
                    <input type="text" name="batch_number" required placeholder="如: B20260501">
                </div>
                <div class="form-group">
                    <label>石板编号 *</label>
                    <input type="text" name="slab_number" required placeholder="如: S001">
                </div>
                <div class="form-group">
                    <label>颜色</label>
                    <input type="text" name="color" placeholder="如: 米白, 深灰">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>厚度 (mm)</label>
                    <input type="number" name="thickness" placeholder="厚度">
                </div>
                <div class="form-group">
                    <label>宽度 (mm)</label>
                    <input type="number" name="width" placeholder="宽度">
                </div>
                <div class="form-group">
                    <label>高度 (mm)</label>
                    <input type="number" name="height" placeholder="高度">
                </div>
                <div class="form-group">
                    <label>面积 (m²)</label>
                    <input type="number" name="area" step="0.01" placeholder="面积">
                </div>
            </div>
            <div class="form-group checkbox-group">
                <input type="checkbox" id="has_cracks" name="has_cracks">
                <label for="has_cracks">此石板有裂纹</label>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" placeholder="备注..."></textarea>
            </div>
            <div class="btn-group" style="margin-top: 1rem;">
                <button type="submit" class="btn-primary">添加</button>
                <button type="button" class="btn-secondary" onclick="closeModal()">取消</button>
            </div>
        </form>
    `);

    document.getElementById('add-slab-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.has_cracks = formData.has('has_cracks');

        try {
            await apiRequest(`/orders/${currentOrderId}/slabs`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showMessage('石板记录添加成功!', 'success');
            closeModal();
            showOrderDetail(currentOrderId);
        } catch (error) {
            showMessage('添加失败: ' + error.message, 'error');
        }
    });
}

function showAddCutModal() {
    showModal(`
        <h3>添加切割日志</h3>
        <form id="add-cut-form" style="margin-top: 1rem;">
            <div class="form-row">
                <div class="form-group">
                    <label>切割类型 *</label>
                    <select name="cutting_type" required>
                        <option value="CNC">CNC 切割</option>
                        <option value="水刀">水刀切割</option>
                        <option value="手工">手工切割</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>部件名称</label>
                    <input type="text" name="piece_name" placeholder="对应尺寸规格的部件名称">
                </div>
                <div class="form-group">
                    <label>方向</label>
                    <select name="direction">
                        <option value="">未指定</option>
                        <option value="横">横</option>
                        <option value="竖">竖</option>
                        <option value="左">左</option>
                        <option value="右">右</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>实际长度 (mm)</label>
                    <input type="number" name="length" placeholder="切割后长度">
                </div>
                <div class="form-group">
                    <label>实际宽度 (mm)</label>
                    <input type="number" name="width" placeholder="切割后宽度">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>设备</label>
                    <input type="text" name="machine" placeholder="设备编号">
                </div>
                <div class="form-group">
                    <label>操作员</label>
                    <input type="text" name="operator" placeholder="操作员姓名">
                </div>
                <div class="form-group">
                    <label>切割日期</label>
                    <input type="date" name="cutting_date">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" placeholder="切割备注..."></textarea>
            </div>
            <div class="btn-group" style="margin-top: 1rem;">
                <button type="submit" class="btn-primary">添加</button>
                <button type="button" class="btn-secondary" onclick="closeModal()">取消</button>
            </div>
        </form>
    `);

    document.getElementById('add-cut-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            await apiRequest(`/orders/${currentOrderId}/cuts`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showMessage('切割日志添加成功!', 'success');
            closeModal();
            showOrderDetail(currentOrderId);
        } catch (error) {
            showMessage('添加失败: ' + error.message, 'error');
        }
    });
}

function showAddInspectionModal() {
    showModal(`
        <h3>添加质检记录</h3>
        <form id="add-inspection-form" style="margin-top: 1rem;">
            <div class="form-row">
                <div class="form-group">
                    <label>检查类型 *</label>
                    <select name="inspection_type" required>
                        <option value="倒角检查">倒角检查</option>
                        <option value="防滑槽检查">防滑槽检查</option>
                        <option value="尺寸复检">尺寸复检</option>
                        <option value="外观检查">外观检查</option>
                        <option value="综合检查">综合检查</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>检查员</label>
                    <input type="text" name="inspector" placeholder="检查员姓名">
                </div>
                <div class="form-group">
                    <label>检查日期</label>
                    <input type="date" name="inspection_date">
                </div>
            </div>

            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <h4 style="margin-bottom: 0.5rem;">检查项目</h4>
                <div class="form-row">
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="has_chamfer" name="has_chamfer">
                        <label for="has_chamfer">已做倒角</label>
                    </div>
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="has_anti_slip_groove" name="has_anti_slip_groove">
                        <label for="has_anti_slip_groove">已有防滑槽</label>
                    </div>
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="has_cracks_ins" name="has_cracks">
                        <label for="has_cracks_ins">发现裂纹</label>
                    </div>
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="dimension_ok" name="dimension_ok" checked>
                        <label for="dimension_ok">尺寸合格</label>
                    </div>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>防滑槽间距 (mm)</label>
                    <input type="number" name="groove_distance" placeholder="标准: 150-200mm">
                </div>
                <div class="form-group">
                    <label>槽数量</label>
                    <input type="number" name="groove_count" placeholder="槽的数量">
                </div>
                <div class="form-group">
                    <label>检查结果</label>
                    <select name="result">
                        <option value="">未填写</option>
                        <option value="合格">合格</option>
                        <option value="不合格">不合格</option>
                        <option value="待复检">待复检</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>备注</label>
                <textarea name="notes" placeholder="质检备注..."></textarea>
            </div>

            <div class="btn-group" style="margin-top: 1rem;">
                <button type="submit" class="btn-primary">添加</button>
                <button type="button" class="btn-secondary" onclick="closeModal()">取消</button>
            </div>
        </form>
    `);

    document.getElementById('add-inspection-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.has_chamfer = formData.has('has_chamfer');
        data.has_anti_slip_groove = formData.has('has_anti_slip_groove');
        data.has_cracks = formData.has('has_cracks');
        data.dimension_ok = formData.has('dimension_ok');

        try {
            await apiRequest(`/orders/${currentOrderId}/inspections`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showMessage('质检记录添加成功!', 'success');
            closeModal();
            showOrderDetail(currentOrderId);
        } catch (error) {
            showMessage('添加失败: ' + error.message, 'error');
        }
    });
}

function showAddCommentModal() {
    showModal(`
        <h3>添加复核意见</h3>
        <form id="add-comment-form" style="margin-top: 1rem;">
            <div class="form-row">
                <div class="form-group">
                    <label>复核人</label>
                    <input type="text" name="reviewer" placeholder="您的姓名">
                </div>
                <div class="form-group">
                    <label>风险等级</label>
                    <select name="risk_level">
                        <option value="normal">正常</option>
                        <option value="medium">中等风险</option>
                        <option value="high">高风险</option>
                        <option value="critical">严重风险</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>复核意见 *</label>
                <textarea name="comment" required placeholder="请输入复核意见..."></textarea>
            </div>
            <div class="btn-group" style="margin-top: 1rem;">
                <button type="submit" class="btn-primary">提交</button>
                <button type="button" class="btn-secondary" onclick="closeModal()">取消</button>
            </div>
        </form>
    `);

    document.getElementById('add-comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            await apiRequest(`/orders/${currentOrderId}/comments`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showMessage('复核意见添加成功!', 'success');
            closeModal();
            showOrderDetail(currentOrderId);
        } catch (error) {
            showMessage('添加失败: ' + error.message, 'error');
        }
    });
}

async function importData(type, input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('order_id', currentOrderId);

    try {
        showMessage('正在导入...', 'info');
        
        const response = await fetch(`${API_BASE}/import/${type}`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '导入失败');
        }

        showMessage(`导入成功: ${result.imported}/${result.total} 条记录`, 'success');
        input.value = '';
        
        setTimeout(() => showOrderDetail(currentOrderId), 500);
        
    } catch (error) {
        showMessage('导入失败: ' + error.message, 'error');
        input.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showOrders();
});

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
};
