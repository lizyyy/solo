class RepairOrderApp {
    constructor() {
        this.orders = [];
        this.statusInfo = null;
        this.currentEditOrder = null;
        this.init();
    }

    async init() {
        await this.loadStatusInfo();
        await this.loadOrders();
        this.bindEvents();
    }

    async loadStatusInfo() {
        try {
            const response = await fetch('/api/status-info');
            const result = await response.json();
            if (result.success) {
                this.statusInfo = result.data;
            }
        } catch (error) {
            console.error('加载状态信息失败:', error);
        }
    }

    async loadOrders(filters = {}) {
        try {
            let url = '/api/orders';
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);
            if (params.toString()) url += '?' + params.toString();

            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                this.orders = result.data;
                this.renderKanban();
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('加载工单失败:', error);
            this.showToast('加载工单失败', 'error');
        }
    }

    renderKanban() {
        const statusGroups = {
            pending: [],
            quoting: [],
            repairing: [],
            ready: [],
            completed: [],
            cancelled: []
        };

        this.orders.forEach(order => {
            if (statusGroups[order.status]) {
                statusGroups[order.status].push(order);
            }
        });

        Object.keys(statusGroups).forEach(status => {
            const countElement = document.getElementById(`${status}-count`);
            const cardsElement = document.getElementById(`${status}-cards`);
            
            if (countElement) {
                countElement.textContent = statusGroups[status].length;
            }
            
            if (cardsElement) {
                cardsElement.innerHTML = statusGroups[status]
                    .map(order => this.renderCard(order))
                    .join('');
            }
        });
    }

    renderCard(order) {
        const statusColor = this.getStatusColor(order.status);
        const priceText = order.quote_amount ? `¥${order.quote_amount}` : '待报价';
        
        return `
            <div class="card" data-status="${order.status}" data-id="${order.id}">
                <div class="card-header">
                    <span class="card-id">#${order.id}</span>
                </div>
                <div class="card-customer">${order.customer_name}</div>
                <div class="card-device">${order.device_model}</div>
                <div class="card-fault">${this.escapeHtml(order.fault_description)}</div>
                <div class="card-footer">
                    <span class="card-price">${priceText}</span>
                    <span>${this.formatDate(order.created_at)}</span>
                </div>
            </div>
        `;
    }

    getStatusColor(status) {
        const colors = {
            pending: 'f59e0b',
            quoting: '6366f1',
            repairing: '3b82f6',
            ready: '10b981',
            completed: '64748b',
            cancelled: 'ef4444'
        };
        return colors[status] || '64748b';
    }

    getStatusName(status) {
        const names = {
            pending: '待检测',
            quoting: '报价中',
            repairing: '维修中',
            ready: '待取机',
            completed: '已完成',
            cancelled: '已取消'
        };
        return names[status] || status;
    }

    getNextStatuses(status) {
        const flow = {
            pending: ['quoting', 'cancelled'],
            quoting: ['repairing', 'cancelled'],
            repairing: ['ready', 'cancelled'],
            ready: ['completed', 'cancelled'],
            completed: [],
            cancelled: []
        };
        return flow[status] || [];
    }

    getStatusButtonClass(status) {
        const classes = {
            quoting: 'btn-warning',
            repairing: 'btn-secondary',
            ready: 'btn-warning',
            completed: 'btn-success',
            cancelled: 'btn-danger'
        };
        return classes[status] || 'btn-secondary';
    }

    getStatusTransitionReason(fromStatus, toStatus) {
        const nextStatus = this.getNextStatuses(fromStatus);
        if (nextStatus.length === 0) {
            return `当前状态「${this.getStatusName(fromStatus)}」无法进行状态变更`;
        }
        return `当前状态「${this.getStatusName(fromStatus)}」只能变更为：${nextStatus.map(s => this.getStatusName(s)).join('、')}`;
    }

    canTransition(fromStatus, toStatus) {
        const nextStatus = this.getNextStatuses(fromStatus);
        return nextStatus.includes(toStatus);
    }

    bindEvents() {
        document.getElementById('newOrderBtn').addEventListener('click', () => {
            this.openOrderModal();
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeOrderModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeOrderModal();
        });

        document.getElementById('orderForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveOrder();
        });

        document.getElementById('searchBtn').addEventListener('click', () => {
            const searchTerm = document.getElementById('searchInput').value.trim();
            this.loadOrders({ search: searchTerm });
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = document.getElementById('searchInput').value.trim();
                this.loadOrders({ search: searchTerm });
            }
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            window.location.href = '/api/csv/export';
        });

        document.getElementById('importFile').addEventListener('change', async (e) => {
            await this.importCSV(e.target.files[0]);
            e.target.value = '';
        });

        document.getElementById('closeDetailModal').addEventListener('click', () => {
            this.closeDetailModal();
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    if (overlay.id === 'orderModal') {
                        this.closeOrderModal();
                    } else if (overlay.id === 'detailModal') {
                        this.closeDetailModal();
                    }
                }
            });
        });

        document.addEventListener('click', async (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const orderId = card.dataset.id;
                await this.showOrderDetail(orderId);
            }

            if (e.target.classList.contains('status-action-btn')) {
                const orderId = e.target.dataset.orderId;
                const newStatus = e.target.dataset.status;
                await this.updateStatus(orderId, newStatus);
            }

            if (e.target.classList.contains('edit-order-btn')) {
                const orderId = e.target.dataset.orderId;
                await this.editOrder(orderId);
            }
        });
    }

    openOrderModal(order = null) {
        this.currentEditOrder = order;
        const modal = document.getElementById('orderModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('orderForm');

        if (order) {
            title.textContent = '编辑工单';
            this.fillForm(order);
        } else {
            title.textContent = '新建工单';
            form.reset();
        }

        modal.classList.add('active');
    }

    closeOrderModal() {
        const modal = document.getElementById('orderModal');
        modal.classList.remove('active');
        this.currentEditOrder = null;
    }

    fillForm(order) {
        const form = document.getElementById('orderForm');
        form.customer_name.value = order.customer_name || '';
        form.phone.value = order.phone || '';
        form.device_model.value = order.device_model || '';
        form.fault_description.value = order.fault_description || '';
        form.quote_amount.value = order.quote_amount || '';
        form.repair_parts.value = order.repair_parts || '';
        form.notes.value = order.notes || '';
        
        if (order.expected_pickup_time) {
            const date = new Date(order.expected_pickup_time);
            const isoString = date.toISOString().slice(0, 16);
            form.expected_pickup_time.value = isoString;
        } else {
            form.expected_pickup_time.value = '';
        }
    }

    async saveOrder() {
        const form = document.getElementById('orderForm');
        const formData = {
            customer_name: form.customer_name.value.trim(),
            phone: form.phone.value.trim(),
            device_model: form.device_model.value.trim(),
            fault_description: form.fault_description.value.trim(),
            quote_amount: form.quote_amount.value ? parseFloat(form.quote_amount.value) : null,
            repair_parts: form.repair_parts.value.trim() || null,
            expected_pickup_time: form.expected_pickup_time.value || null,
            notes: form.notes.value.trim() || null
        };

        try {
            let url = '/api/orders';
            let method = 'POST';

            if (this.currentEditOrder) {
                url = `/api/orders/${this.currentEditOrder.id}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(result.message, 'success');
                this.closeOrderModal();
                await this.loadOrders();
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('保存工单失败:', error);
            this.showToast('保存工单失败', 'error');
        }
    }

    async editOrder(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}`);
            const result = await response.json();

            if (result.success) {
                this.openOrderModal(result.data);
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('获取工单详情失败:', error);
            this.showToast('获取工单详情失败', 'error');
        }
    }

    async showOrderDetail(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}`);
            const result = await response.json();

            if (result.success) {
                this.renderDetailModal(result.data);
                document.getElementById('detailModal').classList.add('active');
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('获取工单详情失败:', error);
            this.showToast('获取工单详情失败', 'error');
        }
    }

    renderDetailModal(order) {
        const title = document.getElementById('detailModalTitle');
        const content = document.getElementById('detailContent');

        title.textContent = `工单 #${order.id} - ${order.customer_name}`;

        const nextStatuses = this.getNextStatuses(order.status);
        const statusActionsHtml = nextStatuses.map(status => {
            const isAllowed = this.canTransition(order.status, status);
            const buttonClass = this.getStatusButtonClass(status);
            const tooltip = isAllowed ? '' : this.getStatusTransitionReason(order.status, status);

            return `
                <div class="status-action-tooltip">
                    <button class="btn ${buttonClass} status-action-btn" 
                            data-order-id="${order.id}" 
                            data-status="${status}"
                            ${isAllowed ? '' : 'disabled'}>
                        转为${this.getStatusName(status)}
                    </button>
                    ${tooltip ? `<div class="tooltip">${tooltip}</div>` : ''}
                </div>
            `;
        }).join('');

        const auditLogsHtml = order.auditLogs && order.auditLogs.length > 0
            ? order.auditLogs.map(log => `
                <div class="audit-log-item">
                    <div class="audit-log-time">${this.formatDateTime(log.created_at)}</div>
                    <div class="audit-log-action">
                        ${log.action === 'create' ? '创建工单' : 
                          log.action === 'update' ? '更新工单' : 
                          log.action === 'status_change' ? '状态变更' : log.action}
                    </div>
                    <div class="audit-log-note">${this.escapeHtml(log.note || '')}</div>
                </div>
            `).join('')
            : '<p style="color: #94a3b8; font-size: 0.85rem;">暂无操作记录</p>';

        content.innerHTML = `
            <div>
                <div class="detail-section">
                    <h3>基本信息</h3>
                    <div class="detail-row">
                        <span class="detail-label">工单编号</span>
                        <span class="detail-value">#${order.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">客户姓名</span>
                        <span class="detail-value">${order.customer_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">联系电话</span>
                        <span class="detail-value">${order.phone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">设备型号</span>
                        <span class="detail-value">${order.device_model}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">当前状态</span>
                        <span class="detail-value status status-${order.status}">${this.getStatusName(order.status)}</span>
                    </div>
                    <div class="status-actions">
                        ${statusActionsHtml}
                        <button class="btn btn-secondary edit-order-btn" data-order-id="${order.id}">编辑信息</button>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>维修详情</h3>
                    <div class="detail-row">
                        <span class="detail-label">故障描述</span>
                        <span class="detail-value">${this.escapeHtml(order.fault_description)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">报价金额</span>
                        <span class="detail-value">${order.quote_amount ? `¥${order.quote_amount}` : '待报价'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">维修配件</span>
                        <span class="detail-value">${order.repair_parts || '无'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">预计取机</span>
                        <span class="detail-value">${order.expected_pickup_time ? this.formatDateTime(order.expected_pickup_time) : '未设置'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">备注</span>
                        <span class="detail-value">${order.notes || '无'}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>时间信息</h3>
                    <div class="detail-row">
                        <span class="detail-label">创建时间</span>
                        <span class="detail-value">${this.formatDateTime(order.created_at)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">更新时间</span>
                        <span class="detail-value">${this.formatDateTime(order.updated_at)}</span>
                    </div>
                </div>
            </div>

            <div>
                <div class="detail-section">
                    <h3>操作记录</h3>
                    ${auditLogsHtml}
                </div>
            </div>
        `;
    }

    closeDetailModal() {
        document.getElementById('detailModal').classList.remove('active');
    }

    async updateStatus(orderId, newStatus) {
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(`状态已更新为「${this.getStatusName(newStatus)}」`, 'success');
                this.closeDetailModal();
                await this.loadOrders();
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('更新状态失败:', error);
            this.showToast('更新状态失败', 'error');
        }
    }

    async importCSV(file) {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/csv/import', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                let message = result.message;
                if (result.data.errorDetails && result.data.errorDetails.length > 0) {
                    message += '\n\n错误详情：\n' + result.data.errorDetails.join('\n');
                }
                this.showToast(message, result.data.errors > 0 ? 'warning' : 'success');
                await this.loadOrders();
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('导入 CSV 失败:', error);
            this.showToast('导入 CSV 失败', 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RepairOrderApp();
});
