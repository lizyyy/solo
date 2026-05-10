const API_BASE = '/api';

let appData = {
    stores: [],
    products: [],
    batches: [],
    transfers: [],
    operations: []
};

function getStoreName(storeId) {
    const store = appData.stores.find(s => s.id === storeId);
    return store ? store.name : storeId;
}

function getProductName(productId) {
    const product = appData.products.find(p => p.id === productId);
    return product ? product.name : productId;
}

function getBatchStatusClass(status) {
    const map = {
        'normal': 'badge-normal',
        'urgent': 'badge-urgent',
        'critical': 'badge-critical',
        'expired': 'badge-expired'
    };
    return map[status] || 'badge-normal';
}

function getBatchStatusText(status) {
    const map = {
        'normal': '正常',
        'urgent': '临期',
        'critical': '紧急',
        'expired': '已过期'
    };
    return map[status] || status;
}

function getTransferStatusClass(status) {
    const map = {
        'pending': 'badge-pending',
        'approved': 'badge-approved',
        'completed': 'badge-completed',
        'rejected': 'badge-rejected'
    };
    return map[status] || 'badge-pending';
}

function getTransferStatusText(status) {
    const map = {
        'pending': '待审批',
        'approved': '已批准待收货',
        'completed': '已完成',
        'rejected': '已驳回'
    };
    return map[status] || status;
}

function getOperationTypeText(type) {
    const map = {
        'batch_create': '批次创建',
        'batch_import': '批次导入',
        'transfer_create': '创建调拨',
        'transfer_approve': '审批调拨',
        'transfer_reject': '驳回调拨',
        'transfer_complete': '完成收货',
        'discount_sale': '折扣售卖',
        'discard': '商品报损'
    };
    return map[type] || type;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateSimple(dateStr) {
    if (!dateStr) return '-';
    return dateStr;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '请求失败');
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function refreshData() {
    try {
        const data = await apiRequest(`${API_BASE}/data`);
        appData = data;
        updateConnectionStatus(true);
        renderAll();
    } catch (error) {
        updateConnectionStatus(false);
        showToast('数据加载失败: ' + error.message, 'error');
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (connected) {
        indicator.className = 'status-indicator connected';
        indicator.textContent = '已连接';
    } else {
        indicator.className = 'status-indicator disconnected';
        indicator.textContent = '连接断开';
    }
}

async function resetData() {
    if (!confirm('确定要重置所有数据吗？这将恢复到初始状态。')) {
        return;
    }
    
    try {
        await apiRequest(`${API_BASE}/reset`, { method: 'POST' });
        await refreshData();
        showToast('数据已重置', 'success');
    } catch (error) {
        showToast('重置失败: ' + error.message, 'error');
    }
}

function renderAll() {
    renderInventoryTab();
    renderBatchesTab();
    renderTransfersTab();
    renderOperationsTab();
    renderReportTab();
}

async function renderInventoryTab() {
    try {
        const reportData = await apiRequest(`${API_BASE}/report`);
        const inventoryDiff = await apiRequest(`${API_BASE}/inventory/diff`);

        const statsGrid = document.getElementById('statsGrid');
        const urgentDiv = document.getElementById('urgentInventory');
        const tbody = document.querySelector('#inventoryTable tbody');

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">总批次数量</div>
                <div class="stat-value">${reportData.totalBatches}</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-label">临期预警商品</div>
                <div class="stat-value warning">${reportData.urgentInventory.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">总调拨数量</div>
                <div class="stat-value">${reportData.totalTransferQuantity}</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-label">已报损数量</div>
                <div class="stat-value danger">${reportData.totalDiscardQuantity}</div>
            </div>
        `;

        if (reportData.urgentInventory.length === 0) {
            urgentDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <p>暂无临期预警商品</p>
                </div>
            `;
        } else {
            urgentDiv.innerHTML = `<div class="urgent-list">${reportData.urgentInventory.map(b => `
                <div class="urgent-item ${b.status === 'critical' ? 'critical' : ''}">
                    <div class="urgent-info">
                        <h4>${getProductName(b.productId)} (${b.storeName})</h4>
                        <p>批次: ${b.id} | 库存: ${b.quantity} | 有效期: ${b.expiryDate}</p>
                    </div>
                    <span class="badge ${getBatchStatusClass(b.status)}">${getBatchStatusText(b.status)}</span>
                </div>
            `).join('')}</div>`;
        }

        if (inventoryDiff.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7" class="empty-state">暂无库存数据</td></tr>
            `;
        } else {
            tbody.innerHTML = inventoryDiff.map(item => {
                const batchDetails = item.batches.map(b => 
                    `${b.id}: ${b.quantity}件 (有效期${b.expiryDate})`
                ).join('<br>');
                
                return `
                    <tr>
                        <td>${item.storeName}</td>
                        <td>${item.productName}</td>
                        <td>${item.category}</td>
                        <td>${item.quantity} ${item.unit}</td>
                        <td class="${item.urgentCount > 0 ? 'text-danger' : ''}">${item.urgentCount} ${item.unit}</td>
                        <td>
                            ${item.hasUrgent 
                                ? `<span class="badge ${item.batches.some(b => b.status === 'critical') ? 'badge-critical' : 'badge-urgent'}">
                                    ${item.batches.some(b => b.status === 'critical') ? '紧急' : '临期'}
                                   </span>`
                                : `<span class="badge badge-normal">正常</span>`
                            }
                        </td>
                        <td><div class="batch-detail">${batchDetails}</div></td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('渲染库存页失败:', error);
    }
}

function renderBatchesTab() {
    const tbody = document.querySelector('#batchesTable tbody');
    
    if (appData.batches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">暂无批次数据</td></tr>';
        return;
    }

    tbody.innerHTML = appData.batches.map(batch => `
        <tr>
            <td><strong>${batch.id}</strong></td>
            <td>${getStoreName(batch.storeId)}</td>
            <td>${getProductName(batch.productId)}</td>
            <td>${batch.quantity} / ${batch.originalQuantity}</td>
            <td>${formatDateSimple(batch.productionDate)}</td>
            <td>${formatDateSimple(batch.expiryDate)}</td>
            <td>¥${batch.purchasePrice.toFixed(2)}</td>
            <td><span class="badge ${getBatchStatusClass(batch.status)}">${getBatchStatusText(batch.status)}</span></td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="showDiscountModal('${batch.id}')" ${batch.quantity === 0 ? 'disabled' : ''}>折扣</button>
                <button class="btn btn-sm btn-danger" onclick="showDiscardModal('${batch.id}')" ${batch.quantity === 0 ? 'disabled' : ''}>报损</button>
            </td>
        </tr>
    `).join('');
}

function renderTransfersTab() {
    const tbody = document.querySelector('#transfersTable tbody');
    
    if (appData.transfers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无调拨数据</td></tr>';
        return;
    }

    tbody.innerHTML = appData.transfers.map(transfer => `
        <tr>
            <td><strong>${transfer.id}</strong></td>
            <td>${getStoreName(transfer.fromStoreId)}</td>
            <td>${getStoreName(transfer.toStoreId)}</td>
            <td>${transfer.items.reduce((sum, i) => sum + i.quantity, 0)} 件</td>
            <td><span class="badge ${getTransferStatusClass(transfer.status)}">${getTransferStatusText(transfer.status)}</span></td>
            <td>${transfer.initiator}</td>
            <td>${formatDate(transfer.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="showTransferDetail('${transfer.id}')">详情</button>
                ${transfer.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="approveTransfer('${transfer.id}')">审批</button>
                    <button class="btn btn-sm btn-danger" onclick="showRejectModal('${transfer.id}')">驳回</button>
                ` : ''}
                ${transfer.status === 'approved' ? `
                    <button class="btn btn-sm btn-primary" onclick="receiveTransfer('${transfer.id}')">收货</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function renderOperationsTab() {
    const tbody = document.querySelector('#operationsTable tbody');
    
    if (appData.operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">暂无操作记录</td></tr>';
        return;
    }

    const ops = [...appData.operations].reverse().slice(0, 100);

    tbody.innerHTML = ops.map(op => `
        <tr>
            <td>${formatDate(op.timestamp)}</td>
            <td><strong>${getOperationTypeText(op.type)}</strong></td>
            <td>${op.description}</td>
            <td><button class="btn btn-sm btn-secondary" onclick="showOperationDetail('${op.id}')">查看</button></td>
        </tr>
    `).join('');
}

async function renderReportTab() {
    try {
        const reportData = await apiRequest(`${API_BASE}/report`);

        document.getElementById('reportContent').innerHTML = `
            <div class="report-grid">
                <div class="report-item">
                    <div class="report-label">待审批调拨单</div>
                    <div class="report-value">${reportData.transfersByStatus.pending || 0}</div>
                </div>
                <div class="report-item">
                    <div class="report-label">已批准待收货</div>
                    <div class="report-value">${reportData.transfersByStatus.approved || 0}</div>
                </div>
                <div class="report-item success">
                    <div class="report-label">已完成调拨</div>
                    <div class="report-value">${reportData.transfersByStatus.completed || 0}</div>
                </div>
                <div class="report-item danger">
                    <div class="report-label">已驳回调拨</div>
                    <div class="report-value">${reportData.transfersByStatus.rejected || 0}</div>
                </div>
                <div class="report-item warning">
                    <div class="report-label">调拨总数量</div>
                    <div class="report-value">${reportData.totalTransferQuantity} 件</div>
                </div>
                <div class="report-item warning">
                    <div class="report-label">调拨总金额</div>
                    <div class="report-value">¥${reportData.totalTransferValue.toFixed(2)}</div>
                </div>
                <div class="report-item danger">
                    <div class="report-label">折扣损失金额</div>
                    <div class="report-value">¥${reportData.totalDiscountValue.toFixed(2)}</div>
                </div>
                <div class="report-item danger">
                    <div class="report-label">报损损失金额</div>
                    <div class="report-value">¥${reportData.totalDiscardValue.toFixed(2)}</div>
                </div>
            </div>

            ${reportData.urgentInventory.length > 0 ? `
                <h3 style="margin-top: 2rem; margin-bottom: 1rem;">🚨 需要紧急处理的临期商品</h3>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>门店</th>
                                <th>商品</th>
                                <th>批次</th>
                                <th>库存</th>
                                <th>有效期</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.urgentInventory.map(b => `
                                <tr>
                                    <td>${b.storeName}</td>
                                    <td>${getProductName(b.productId)}</td>
                                    <td>${b.id}</td>
                                    <td>${b.quantity}</td>
                                    <td>${b.expiryDate}</td>
                                    <td><span class="badge ${getBatchStatusClass(b.status)}">${getBatchStatusText(b.status)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        `;
    } catch (error) {
        console.error('渲染报表失败:', error);
    }
}

function openModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function showAddBatchModal() {
    const today = new Date().toISOString().split('T')[0];
    const productOptions = appData.products.map(p => 
        `<option value="${p.id}">${p.name} (${p.category})</option>`
    ).join('');
    const storeOptions = appData.stores.map(s => 
        `<option value="${s.id}">${s.name}</option>`
    ).join('');

    openModal('➕ 新增商品批次', `
        <div class="form-group">
            <label class="form-label">商品</label>
            <select class="form-select" id="newBatchProduct">${productOptions}</select>
        </div>
        <div class="form-group">
            <label class="form-label">门店</label>
            <select class="form-select" id="newBatchStore">${storeOptions}</select>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">数量</label>
                <input type="number" class="form-input" id="newBatchQuantity" min="1" value="10">
            </div>
            <div class="form-group">
                <label class="form-label">进价 (元)</label>
                <input type="number" class="form-input" id="newBatchPrice" min="0" step="0.01" value="5">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">生产日期</label>
                <input type="date" class="form-input" id="newBatchProd" value="${today}">
            </div>
            <div class="form-group">
                <label class="form-label">有效期</label>
                <input type="date" class="form-input" id="newBatchExpiry">
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="createBatch()">创建批次</button>
        </div>
    `);
}

async function createBatch() {
    const productId = document.getElementById('newBatchProduct').value;
    const storeId = document.getElementById('newBatchStore').value;
    const quantity = parseInt(document.getElementById('newBatchQuantity').value);
    const purchasePrice = parseFloat(document.getElementById('newBatchPrice').value);
    const productionDate = document.getElementById('newBatchProd').value;
    const expiryDate = document.getElementById('newBatchExpiry').value;

    try {
        await apiRequest(`${API_BASE}/batches`, {
            method: 'POST',
            body: JSON.stringify({ productId, storeId, quantity, productionDate, expiryDate, purchasePrice })
        });
        closeModal();
        await refreshData();
        showToast('批次创建成功', 'success');
    } catch (error) {
        showToast('创建失败: ' + error.message, 'error');
    }
}

function showImportModal() {
    openModal('📥 批量导入批次', `
        <p style="margin-bottom: 1rem;">请输入 JSON 格式的批次数据，例如：</p>
        <pre style="background:#f3f4f6;padding:0.75rem;border-radius:8px;font-size:0.8rem;overflow-x:auto;margin-bottom:1rem;">
[
  {
    "productId": "M001",
    "storeId": "A",
    "quantity": 50,
    "productionDate": "2026-05-05",
    "expiryDate": "2026-05-12",
    "purchasePrice": 3.5
  }
]</pre>
        <div class="form-group">
            <label class="form-label">JSON 数据</label>
            <textarea class="form-textarea" id="importData" placeholder='[{"productId": "M001", "storeId": "A", "quantity": 50, "productionDate": "2026-05-05", "expiryDate": "2026-05-12", "purchasePrice": 3.5}]'></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="importBatches()">导入</button>
        </div>
    `);
}

async function importBatches() {
    try {
        const batches = JSON.parse(document.getElementById('importData').value);
        const result = await apiRequest(`${API_BASE}/batches/import`, {
            method: 'POST',
            body: JSON.stringify({ batches })
        });
        
        let message = `成功导入 ${result.results.success.length} 条`;
        if (result.results.failed.length > 0) {
            message += `，失败 ${result.results.failed.length} 条: ${result.results.failed.map(f => f.reason).join('; ')}`;
            showToast(message, 'warning');
        } else {
            showToast(message, 'success');
        }
        
        closeModal();
        await refreshData();
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

function showCreateTransferModal() {
    const storeOptions = appData.stores.map(s => 
        `<option value="${s.id}">${s.name}</option>`
    ).join('');
    
    const availableBatches = appData.batches.filter(b => b.quantity > 0 && b.status !== 'expired');
    const batchOptions = availableBatches.map(b => 
        `<option value="${b.id}">${b.id} - ${getProductName(b.productId)} (${getStoreName(b.storeId)}) - 库存:${b.quantity}</option>`
    ).join('');

    openModal('📝 发起调拨单', `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">调出门店</label>
                <select class="form-select" id="transferFrom" onchange="filterAvailableBatches()">${storeOptions}</select>
            </div>
            <div class="form-group">
                <label class="form-label">调入门店</label>
                <select class="form-select" id="transferTo">${storeOptions}</select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">调拨原因</label>
            <input type="text" class="form-input" id="transferReason" placeholder="例如：A店临期商品过多，调往销售较好的B店">
        </div>
        
        <div id="transferItemsContainer">
            <div class="form-label">调拨商品</div>
            <div id="transferItemList"></div>
            <button type="button" class="add-item-btn" onclick="addTransferItem()">➕ 添加商品</button>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="createTransfer()">创建调拨单</button>
        </div>
    `);
    
    addTransferItem();
}

function addTransferItem() {
    const fromStore = document.getElementById('transferFrom').value;
    const availableBatches = appData.batches.filter(
        b => b.storeId === fromStore && b.quantity > 0 && b.status !== 'expired'
    );
    
    const batchOptions = availableBatches.map(b => 
        `<option value="${b.id}" data-qty="${b.quantity}">${getProductName(b.productId)} - 库存:${b.quantity} - 有效期:${b.expiryDate}</option>`
    ).join('');

    const list = document.getElementById('transferItemList');
    const itemHtml = `
        <div class="transfer-item-row" style="display:flex;gap:0.5rem;margin-bottom:0.5rem;align-items:center;">
            <select class="form-select item-batch" style="flex:2;">${batchOptions || '<option value="">无可选批次</option>'}</select>
            <input type="number" class="form-input item-qty" style="flex:1;" min="1" value="1" placeholder="数量">
            <button type="button" class="remove-item-btn" onclick="this.parentElement.remove()">×</button>
        </div>
    `;
    list.insertAdjacentHTML('beforeend', itemHtml);
}

function filterAvailableBatches() {
    const fromStore = document.getElementById('transferFrom').value;
    const availableBatches = appData.batches.filter(
        b => b.storeId === fromStore && b.quantity > 0 && b.status !== 'expired'
    );
    
    const batchOptions = availableBatches.map(b => 
        `<option value="${b.id}" data-qty="${b.quantity}">${getProductName(b.productId)} - 库存:${b.quantity} - 有效期:${b.expiryDate}</option>`
    ).join('') || '<option value="">无可选批次</option>';
    
    document.querySelectorAll('.item-batch').forEach(select => {
        select.innerHTML = batchOptions;
    });
}

async function createTransfer() {
    const fromStoreId = document.getElementById('transferFrom').value;
    const toStoreId = document.getElementById('transferTo').value;
    const reason = document.getElementById('transferReason').value;

    const items = [];
    document.querySelectorAll('.transfer-item-row').forEach(row => {
        const batchId = row.querySelector('.item-batch').value;
        const qty = parseInt(row.querySelector('.item-qty').value);
        if (batchId && qty > 0) {
            items.push({ batchId, quantity: qty });
        }
    });

    if (items.length === 0) {
        showToast('请至少添加一个调拨商品', 'warning');
        return;
    }

    try {
        await apiRequest(`${API_BASE}/transfers`, {
            method: 'POST',
            body: JSON.stringify({ fromStoreId, toStoreId, items, reason })
        });
        closeModal();
        await refreshData();
        showToast('调拨单创建成功', 'success');
    } catch (error) {
        showToast('创建失败: ' + error.message, 'error');
    }
}

function showTransferDetail(transferId) {
    const transfer = appData.transfers.find(t => t.id === transferId);
    if (!transfer) return;

    const itemsHtml = transfer.items.map(item => {
        const batch = appData.batches.find(b => b.id === item.batchId);
        return `
            <div class="transfer-item">
                <div>
                    <strong>${getProductName(item.productId)}</strong>
                    <div class="batch-detail">批次: ${item.batchId} | 单价: ¥${item.unitPrice.toFixed(2)}</div>
                </div>
                <div>${item.quantity} 件</div>
            </div>
        `;
    }).join('');

    openModal('📋 调拨单详情', `
        <div style="margin-bottom:1rem;">
            <p><strong>调拨单号:</strong> ${transfer.id}</p>
            <p><strong>状态:</strong> <span class="badge ${getTransferStatusClass(transfer.status)}">${getTransferStatusText(transfer.status)}</span></p>
            <p><strong>调出门店:</strong> ${getStoreName(transfer.fromStoreId)}</p>
            <p><strong>调入门店:</strong> ${getStoreName(transfer.toStoreId)}</p>
            <p><strong>原因:</strong> ${transfer.reason || '-'}</p>
            <p><strong>发起人:</strong> ${transfer.initiator}</p>
            <p><strong>创建时间:</strong> ${formatDate(transfer.createdAt)}</p>
            ${transfer.approvedAt ? `<p><strong>审批时间:</strong> ${formatDate(transfer.approvedAt)} (${transfer.approvedBy})</p>` : ''}
            ${transfer.rejectedAt ? `<p><strong>驳回时间:</strong> ${formatDate(transfer.rejectedAt)} (${transfer.rejectedBy})</p>` : ''}
            ${transfer.rejectReason ? `<p><strong>驳回原因:</strong> ${transfer.rejectReason}</p>` : ''}
            ${transfer.receivedAt ? `<p><strong>收货时间:</strong> ${formatDate(transfer.receivedAt)} (${transfer.receivedBy})</p>` : ''}
        </div>
        <div class="transfer-items">
            <div class="form-label">调拨商品明细</div>
            ${itemsHtml}
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
        </div>
    `);
}

function showOperationDetail(opId) {
    const op = appData.operations.find(o => o.id === opId);
    if (!op) return;

    openModal('📋 操作详情', `
        <p><strong>操作类型:</strong> ${getOperationTypeText(op.type)}</p>
        <p><strong>描述:</strong> ${op.description}</p>
        <p><strong>时间:</strong> ${formatDate(op.timestamp)}</p>
        <div style="margin-top:1rem;">
            <div class="form-label">详细信息</div>
            <pre style="background:#f3f4f6;padding:0.75rem;border-radius:8px;font-size:0.8rem;overflow-x:auto;">${JSON.stringify(op.details, null, 2)}</pre>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
        </div>
    `);
}

function showRejectModal(transferId) {
    openModal('❌ 驳回调拨单', `
        <p style="margin-bottom:1rem;">确定要驳回调拨单 <strong>${transferId}</strong> 吗？</p>
        <div class="form-group">
            <label class="form-label">驳回原因</label>
            <textarea class="form-textarea" id="rejectReason" placeholder="请输入驳回原因..."></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-danger" onclick="rejectTransfer('${transferId}')">确认驳回</button>
        </div>
    `);
}

async function approveTransfer(transferId) {
    if (!confirm(`确定要审批调拨单 ${transferId} 吗？`)) return;
    
    try {
        await apiRequest(`${API_BASE}/transfers/${transferId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ approver: '审批人' })
        });
        await refreshData();
        showToast('调拨单已批准', 'success');
    } catch (error) {
        showToast('审批失败: ' + error.message, 'error');
    }
}

async function rejectTransfer(transferId) {
    const reason = document.getElementById('rejectReason').value;
    
    try {
        await apiRequest(`${API_BASE}/transfers/${transferId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason, rejector: '驳回人' })
        });
        closeModal();
        await refreshData();
        showToast('调拨单已驳回', 'success');
    } catch (error) {
        showToast('驳回失败: ' + error.message, 'error');
    }
}

async function receiveTransfer(transferId) {
    if (!confirm(`确定要接收调拨单 ${transferId} 的商品吗？`)) return;
    
    try {
        await apiRequest(`${API_BASE}/transfers/${transferId}/receive`, {
            method: 'POST',
            body: JSON.stringify({ receiver: '收货人' })
        });
        await refreshData();
        showToast('收货完成', 'success');
    } catch (error) {
        showToast('收货失败: ' + error.message, 'error');
    }
}

function showDiscountModal(batchId) {
    const batch = appData.batches.find(b => b.id === batchId);
    if (!batch) return;

    openModal('💰 折扣售卖', `
        <p><strong>商品:</strong> ${getProductName(batch.productId)}</p>
        <p><strong>当前库存:</strong> ${batch.quantity}</p>
        <p><strong>进价:</strong> ¥${batch.purchasePrice.toFixed(2)}</p>
        <div class="form-group">
            <label class="form-label">售卖数量</label>
            <input type="number" class="form-input" id="discountQty" min="1" max="${batch.quantity}" value="1">
        </div>
        <div class="form-group">
            <label class="form-label">折扣率 (0-1，例如 0.7 表示7折)</label>
            <input type="number" class="form-input" id="discountRate" min="0.1" max="1" step="0.05" value="0.7">
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-warning" onclick="processDiscount('${batchId}')">确认折扣</button>
        </div>
    `);
}

async function processDiscount(batchId) {
    const quantity = parseInt(document.getElementById('discountQty').value);
    const discountRate = parseFloat(document.getElementById('discountRate').value);

    try {
        await apiRequest(`${API_BASE}/batches/${batchId}/discount`, {
            method: 'POST',
            body: JSON.stringify({ quantity, discountRate, operator: '操作员' })
        });
        closeModal();
        await refreshData();
        showToast(`已折扣售卖 ${quantity} 件`, 'success');
    } catch (error) {
        showToast('操作失败: ' + error.message, 'error');
    }
}

function showDiscardModal(batchId) {
    const batch = appData.batches.find(b => b.id === batchId);
    if (!batch) return;

    openModal('🗑️ 商品报损', `
        <p><strong>商品:</strong> ${getProductName(batch.productId)}</p>
        <p><strong>当前库存:</strong> ${batch.quantity}</p>
        <p><strong>进价:</strong> ¥${batch.purchasePrice.toFixed(2)}</p>
        <div class="form-group">
            <label class="form-label">报损数量</label>
            <input type="number" class="form-input" id="discardQty" min="1" max="${batch.quantity}" value="1">
        </div>
        <div class="form-group">
            <label class="form-label">报损原因</label>
            <textarea class="form-textarea" id="discardReason" placeholder="例如：商品过期、包装破损等"></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-danger" onclick="processDiscard('${batchId}')">确认报损</button>
        </div>
    `);
}

async function processDiscard(batchId) {
    const quantity = parseInt(document.getElementById('discardQty').value);
    const reason = document.getElementById('discardReason').value;

    try {
        await apiRequest(`${API_BASE}/batches/${batchId}/discard`, {
            method: 'POST',
            body: JSON.stringify({ quantity, reason, operator: '操作员' })
        });
        closeModal();
        await refreshData();
        showToast(`已报损 ${quantity} 件`, 'success');
    } catch (error) {
        showToast('操作失败: ' + error.message, 'error');
    }
}

async function runNormalDemo1() {
    showToast('正在执行样例1: A店调拨临期饭团到B店...', 'info');
    
    try {
        const aStoreBatches = appData.batches.filter(b => b.storeId === 'A' && b.quantity > 0 && b.status !== 'expired');
        if (aStoreBatches.length === 0) {
            showToast('A店没有可调拨的商品', 'warning');
            return;
        }

        const onigiriBatch = aStoreBatches.find(b => 
            appData.products.find(p => p.id === b.productId)?.category === '饭团'
        );
        
        const targetBatch = onigiriBatch || aStoreBatches[0];
        const transferQty = Math.min(targetBatch.quantity, 10);

        const transfer = await apiRequest(`${API_BASE}/transfers`, {
            method: 'POST',
            body: JSON.stringify({
                fromStoreId: 'A',
                toStoreId: 'B',
                items: [{ batchId: targetBatch.id, quantity: transferQty }],
                reason: 'A店临期饭团过多，调往B店促销'
            })
        });

        await apiRequest(`${API_BASE}/transfers/${transfer.transfer.id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ approver: '演示系统' })
        });

        await apiRequest(`${API_BASE}/transfers/${transfer.transfer.id}/receive`, {
            method: 'POST',
            body: JSON.stringify({ receiver: '演示系统' })
        });

        await refreshData();
        showToast('样例1执行成功: A店→B店调拨已完成', 'success');
    } catch (error) {
        showToast('样例1执行失败: ' + error.message, 'error');
    }
}

async function runNormalDemo2() {
    showToast('正在执行样例2: A店折扣售卖临期牛奶...', 'info');
    
    try {
        const milkBatch = appData.batches.find(b => 
            b.storeId === 'A' && b.quantity > 0 && 
            appData.products.find(p => p.id === b.productId)?.category === '牛奶'
        );

        if (!milkBatch) {
            showToast('A店没有牛奶批次', 'warning');
            return;
        }

        const qty = Math.min(milkBatch.quantity, 5);
        await apiRequest(`${API_BASE}/batches/${milkBatch.id}/discount`, {
            method: 'POST',
            body: JSON.stringify({ quantity: qty, discountRate: 0.7, operator: '演示系统' })
        });

        await refreshData();
        showToast(`样例2执行成功: 已折扣售卖 ${qty} 件牛奶`, 'success');
    } catch (error) {
        showToast('样例2执行失败: ' + error.message, 'error');
    }
}

async function runNormalDemo3() {
    showToast('正在执行样例3: 批量导入多个批次...', 'info');
    
    const today = new Date();
    const addDays = (days) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    const importData = [
        {
            productId: 'M001',
            storeId: 'B',
            quantity: 30,
            productionDate: addDays(-3),
            expiryDate: addDays(4),
            purchasePrice: 3.5
        },
        {
            productId: 'F001',
            storeId: 'C',
            quantity: 20,
            productionDate: addDays(0),
            expiryDate: addDays(2),
            purchasePrice: 5.8
        },
        {
            productId: 'B002',
            storeId: 'A',
            quantity: 15,
            productionDate: addDays(0),
            expiryDate: addDays(1),
            purchasePrice: 15.0
        }
    ];

    try {
        await apiRequest(`${API_BASE}/batches/import`, {
            method: 'POST',
            body: JSON.stringify({ batches: importData })
        });

        await refreshData();
        showToast('样例3执行成功: 批量导入3个批次', 'success');
    } catch (error) {
        showToast('样例3执行失败: ' + error.message, 'error');
    }
}

async function runBadDemo1() {
    showToast('正在尝试拦截样例1: 调拨已过期商品...', 'info');
    
    const today = new Date();
    const addDays = (days) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    try {
        const expiredBatch = {
            productId: 'M001',
            storeId: 'A',
            quantity: 10,
            productionDate: addDays(-10),
            expiryDate: addDays(-1),
            purchasePrice: 3.5
        };

        const importResult = await apiRequest(`${API_BASE}/batches/import`, {
            method: 'POST',
            body: JSON.stringify({ batches: [expiredBatch] })
        });

        const newBatchId = importResult.results.success[0].id;

        await apiRequest(`${API_BASE}/transfers`, {
            method: 'POST',
            body: JSON.stringify({
                fromStoreId: 'A',
                toStoreId: 'B',
                items: [{ batchId: newBatchId, quantity: 5 }]
            })
        });

        showToast('拦截失败! 过期商品应该被拦截', 'error');
    } catch (error) {
        await refreshData();
        showToast('拦截样例1成功: 过期商品无法调拨 - ' + error.message, 'success');
    }
}

async function runBadDemo2() {
    showToast('正在尝试拦截样例2: 调拨库存不足...', 'info');
    
    try {
        const validBatch = appData.batches.find(b => b.quantity > 0 && b.status !== 'expired');
        if (!validBatch) {
            showToast('没有可用批次', 'warning');
            return;
        }

        await apiRequest(`${API_BASE}/transfers`, {
            method: 'POST',
            body: JSON.stringify({
                fromStoreId: validBatch.storeId,
                toStoreId: validBatch.storeId === 'A' ? 'B' : 'A',
                items: [{ batchId: validBatch.id, quantity: validBatch.quantity + 100 }]
            })
        });

        showToast('拦截失败! 库存不足应该被拦截', 'error');
    } catch (error) {
        showToast('拦截样例2成功: 库存不足被拦截 - ' + error.message, 'success');
    }
}

async function runBadDemo3() {
    showToast('正在尝试拦截样例3: 同一批次重复调拨...', 'info');
    
    try {
        const validBatch = appData.batches.find(b => b.quantity > 0 && b.status !== 'expired');
        if (!validBatch) {
            showToast('没有可用批次', 'warning');
            return;
        }

        const toStore = validBatch.storeId === 'A' ? 'B' : 'A';

        await apiRequest(`${API_BASE}/transfers`, {
            method: 'POST',
            body: JSON.stringify({
                fromStoreId: validBatch.storeId,
                toStoreId: toStore,
                items: [{ batchId: validBatch.id, quantity: 1 }]
            })
        });

        await apiRequest(`${API_BASE}/transfers`, {
            method: 'POST',
            body: JSON.stringify({
                fromStoreId: validBatch.storeId,
                toStoreId: toStore,
                items: [{ batchId: validBatch.id, quantity: 1 }]
            })
        });

        showToast('拦截失败! 重复调拨应该被拦截', 'error');
    } catch (error) {
        await refreshData();
        showToast('拦截样例3成功: 重复调拨被拦截 - ' + error.message, 'success');
    }
}

async function runBadDemo4() {
    showToast('正在尝试拦截样例4: 调入调出门店相同...', 'info');
    
    try {
        const validBatch = appData.batches.find(b => b.quantity > 0 && b.status !== 'expired');
        if (!validBatch) {
            showToast('没有可用批次', 'warning');
            return;
        }

        await apiRequest(`${API_BASE}/transfers`, {
            method: 'POST',
            body: JSON.stringify({
                fromStoreId: validBatch.storeId,
                toStoreId: validBatch.storeId,
                items: [{ batchId: validBatch.id, quantity: 1 }]
            })
        });

        showToast('拦截失败! 门店相同应该被拦截', 'error');
    } catch (error) {
        showToast('拦截样例4成功: 门店相同被拦截 - ' + error.message, 'success');
    }
}

async function runBadDemo5() {
    showToast('正在尝试拦截样例5: 导入无效商品数据...', 'info');
    
    const today = new Date();
    const addDays = (days) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    try {
        const invalidData = [
            {
                productId: 'INVALID999',
                storeId: 'A',
                quantity: 10,
                productionDate: addDays(-3),
                expiryDate: addDays(4),
                purchasePrice: 5.0
            },
            {
                productId: 'M001',
                storeId: 'INVALID',
                quantity: 10,
                productionDate: addDays(-3),
                expiryDate: addDays(4),
                purchasePrice: 5.0
            }
        ];

        const result = await apiRequest(`${API_BASE}/batches/import`, {
            method: 'POST',
            body: JSON.stringify({ batches: invalidData })
        });

        if (result.results.failed.length === 2) {
            showToast('拦截样例5成功: 2条无效数据被拦截', 'success');
        } else {
            showToast('部分数据未被正确拦截', 'warning');
        }
        await refreshData();
    } catch (error) {
        showToast('拦截样例5失败: ' + error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');

            if (btn.dataset.tab === 'inventory') renderInventoryTab();
            if (btn.dataset.tab === 'report') renderReportTab();
        });
    });

    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });

    refreshData();
});
