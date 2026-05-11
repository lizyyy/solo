const App = {
    currentTab: 'dashboard',
    selectedRegistrationId: null,

    init() {
        DataManager.init();
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        document.getElementById('btn-add-registration').addEventListener('click', () => {
            this.showRegistrationModal();
        });

        document.getElementById('btn-add-inspection').addEventListener('click', () => {
            this.showInspectionModal();
        });

        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('btn-reset-demo').addEventListener('click', () => {
            if (confirm('确定要重置所有演示数据吗？此操作不可撤销。')) {
                DataManager.reset();
                this.showToast('数据已重置', 'success');
                this.render();
            }
        });

        document.getElementById('btn-normal-demo').addEventListener('click', () => {
            this.runNormalDemo();
        });

        document.getElementById('btn-abnormal-demo').addEventListener('click', () => {
            this.runAbnormalDemo();
        });

        document.getElementById('registration-filter').addEventListener('change', () => {
            this.renderRegistrationList();
        });

        document.getElementById('inspection-filter').addEventListener('change', () => {
            this.renderInspectionList();
        });

        document.getElementById('history-type-filter').addEventListener('change', () => {
            this.renderHistoryList();
        });

        document.getElementById('history-action-filter').addEventListener('change', () => {
            this.renderHistoryList();
        });
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tab);
        });
        this.render();
    },

    render() {
        this.renderDashboard();
        this.renderRegistrationList();
        this.renderDepositList();
        this.renderInspectionList();
        this.renderRefundList();
        this.renderHistoryList();
    },

    renderDashboard() {
        const stats = DataManager.getStats();
        document.getElementById('stat-registration').textContent = stats.registration;
        document.getElementById('stat-deposit').textContent = stats.deposit;
        document.getElementById('stat-inspection').textContent = stats.inspection;
        document.getElementById('stat-refund').textContent = stats.refund;

        const depositStats = DataManager.getDepositStats();
        document.getElementById('stat-frozen-total').textContent = DataManager.formatCurrency(depositStats.frozenTotal);
        document.getElementById('stat-refunded-total').textContent = DataManager.formatCurrency(depositStats.refundedTotal);
        document.getElementById('stat-pending-refund').textContent = DataManager.formatCurrency(depositStats.pendingRefund);

        const todos = DataManager.getTodoList();
        const todoListEl = document.getElementById('todo-list');
        
        if (todos.length === 0) {
            todoListEl.innerHTML = '<div class="empty-state">暂无待办事项</div>';
            return;
        }

        todoListEl.innerHTML = todos.map(todo => `
            <div class="todo-item ${todo.priority}">
                <span class="todo-priority ${todo.priority}">${this.getPriorityText(todo.priority)}</span>
                <div class="todo-content">
                    <div class="todo-title">${todo.title}</div>
                    <div class="todo-desc">${todo.description}</div>
                </div>
                <span class="todo-action" onclick="App.switchTab('${todo.tab}')">去处理 →</span>
            </div>
        `).join('');
    },

    getPriorityText(priority) {
        const map = { high: '高优先级', medium: '中优先级', low: '低优先级' };
        return map[priority] || priority;
    },

    renderRegistrationList() {
        const filter = document.getElementById('registration-filter').value;
        const registrations = DataManager.getRegistrations(filter);
        const listEl = document.getElementById('registration-list');

        if (registrations.length === 0) {
            listEl.innerHTML = '<div class="empty-state">暂无装修报备记录</div>';
            return;
        }

        listEl.innerHTML = registrations.map(reg => `
            <div class="data-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${reg.roomNumber} - ${reg.ownerName}</div>
                        <div class="card-subtitle">报备编号：R${String(reg.id).padStart(4, '0')} | 提交时间：${DataManager.formatDateTime(reg.createdAt)}</div>
                    </div>
                    <span class="status-badge status-${reg.status}">${DataManager.statusMap.registration[reg.status]}</span>
                </div>
                <div class="card-body">
                    <div class="card-grid two-col">
                        <div class="info-item">
                            <span class="info-label">联系电话</span>
                            <span class="info-value">${reg.ownerPhone}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">装修类型</span>
                            <span class="info-value">${reg.decorationType}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">装修公司</span>
                            <span class="info-value">${reg.decorationCompany}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">预计工期</span>
                            <span class="info-value">${reg.startDate} 至 ${reg.endDate}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">押金金额</span>
                            <span class="info-value">${DataManager.formatCurrency(reg.amount)}</span>
                        </div>
                    </div>
                    ${reg.description ? `
                        <div class="info-item" style="margin-top: 12px;">
                            <span class="info-label">备注说明</span>
                            <span class="info-value">${reg.description}</span>
                        </div>
                    ` : ''}
                    ${reg.rejectReason ? `
                        <div class="alert alert-error" style="margin-top: 12px;">
                            <span>❌</span>
                            <div>
                                <strong>拒绝原因：</strong>${reg.rejectReason}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    ${reg.status === 'pending' ? `
                        <button class="btn btn-text" onclick="App.editRegistration(${reg.id})">修改</button>
                        <button class="btn btn-sm btn-success" onclick="App.approveRegistration(${reg.id})">审核通过</button>
                        <button class="btn btn-sm btn-danger" onclick="App.rejectRegistration(${reg.id})">拒绝</button>
                    ` : ''}
                    ${reg.status === 'rejected' ? `
                        <button class="btn btn-sm btn-primary" onclick="App.withdrawRegistration(${reg.id})">撤回并重新提交</button>
                    ` : ''}
                    ${reg.status === 'approved' ? `
                        <button class="btn btn-text" onclick="App.editRegistration(${reg.id})">查看/修改</button>
                    ` : ''}
                    ${reg.status === 'modified' ? `
                        <button class="btn btn-text" onclick="App.editRegistration(${reg.id})">查看修改</button>
                        <button class="btn btn-sm btn-success" onclick="App.approveRegistration(${reg.id})">审核通过</button>
                        <button class="btn btn-sm btn-danger" onclick="App.rejectRegistration(${reg.id})">拒绝</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    renderDepositList() {
        const deposits = DataManager.getDeposits();
        const listEl = document.getElementById('deposit-list');

        if (deposits.length === 0) {
            listEl.innerHTML = '<div class="empty-state">暂无押金记录</div>';
            return;
        }

        listEl.innerHTML = deposits.map(dep => `
            <div class="data-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${dep.roomNumber} - ${dep.ownerName}</div>
                        <div class="card-subtitle">押金编号：D${String(dep.id).padStart(4, '0')} | 冻结时间：${DataManager.formatDateTime(dep.frozenAt)}</div>
                    </div>
                    <span class="status-badge status-${dep.status}">${DataManager.statusMap.deposit[dep.status]}</span>
                </div>
                <div class="card-body">
                    <div class="card-grid three-col">
                        <div class="info-item">
                            <span class="info-label">冻结金额</span>
                            <span class="info-value">${DataManager.formatCurrency(dep.amount)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">已退还金额</span>
                            <span class="info-value">${dep.refundedAmount ? DataManager.formatCurrency(dep.refundedAmount) : '¥0.00'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">剩余金额</span>
                            <span class="info-value">${dep.remainingAmount !== undefined ? DataManager.formatCurrency(dep.remainingAmount) : DataManager.formatCurrency(dep.amount)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">缴费方式</span>
                            <span class="info-value">${dep.paymentMethod}</span>
                        </div>
                    </div>
                    ${dep.remark ? `
                        <div class="info-item" style="margin-top: 12px;">
                            <span class="info-label">备注</span>
                            <span class="info-value">${dep.remark}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    ${dep.status === 'frozen' || dep.status === 'partial_refund' ? `
                        <button class="btn btn-sm btn-primary" onclick="App.refundDeposit(${dep.id})">申请退还</button>
                    ` : ''}
                    ${dep.status === 'refunded' ? `
                        <span class="info-value" style="color: #67c23a;">已于 ${DataManager.formatDateTime(dep.refundedAt)} 全部退还</span>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    renderInspectionList() {
        const filter = document.getElementById('inspection-filter').value;
        const inspections = DataManager.getInspections(filter);
        const listEl = document.getElementById('inspection-list');

        if (inspections.length === 0) {
            listEl.innerHTML = '<div class="empty-state">暂无巡检记录</div>';
            return;
        }

        listEl.innerHTML = inspections.map(ins => `
            <div class="data-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${ins.roomNumber} - ${ins.issueType}</div>
                        <div class="card-subtitle">巡检编号：I${String(ins.id).padStart(4, '0')} | 发现时间：${DataManager.formatDateTime(ins.discoveredAt)} | 巡检员：${ins.inspector}</div>
                    </div>
                    <span class="status-badge status-${ins.status}">${DataManager.statusMap.inspection[ins.status]}</span>
                </div>
                <div class="card-body">
                    <div class="card-grid three-col">
                        <div class="info-item">
                            <span class="info-label">问题位置</span>
                            <span class="info-value">${ins.location}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">严重程度</span>
                            <span class="info-value" style="color: ${ins.severity === 'high' ? '#f56c6c' : ins.severity === 'medium' ? '#e6a23c' : '#67c23a'};">
                                ${ins.severity === 'high' ? '严重' : ins.severity === 'medium' ? '中等' : '轻微'}
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">状态</span>
                            <span class="info-value">${DataManager.statusMap.inspection[ins.status]}</span>
                        </div>
                    </div>
                    <div class="info-item" style="margin-top: 12px;">
                        <span class="info-label">问题描述</span>
                        <span class="info-value">${ins.description}</span>
                    </div>
                    ${ins.rectifyPlan ? `
                        <div class="info-item" style="margin-top: 12px;">
                            <span class="info-label">整改方案</span>
                            <span class="info-value">${ins.rectifyPlan}</span>
                        </div>
                    ` : ''}
                    ${ins.rectifyDesc ? `
                        <div class="info-item" style="margin-top: 12px;">
                            <span class="info-label">整改说明</span>
                            <span class="info-value">${ins.rectifyDesc}</span>
                        </div>
                    ` : ''}
                    ${ins.rectifyPhotos && ins.rectifyPhotos.length > 0 ? `
                        <div class="info-item" style="margin-top: 12px;">
                            <span class="info-label">整改照片</span>
                            <span class="info-value">${ins.rectifyPhotos.join(', ')}</span>
                        </div>
                    ` : ''}
                    ${ins.reopenReason ? `
                        <div class="alert alert-warning" style="margin-top: 12px;">
                            <span>⚠️</span>
                            <div>
                                <strong>重新整改原因：</strong>${ins.reopenReason}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    ${ins.status === 'open' ? `
                        <button class="btn btn-sm btn-primary" onclick="App.startRectification(${ins.id})">开始整改</button>
                    ` : ''}
                    ${ins.status === 'in_progress' ? `
                        <button class="btn btn-sm btn-warning" onclick="App.submitRectification(${ins.id})">提交整改</button>
                    ` : ''}
                    ${ins.status === 'completed' ? `
                        <button class="btn btn-sm btn-danger" onclick="App.reopenInspection(${ins.id})">整改不合格</button>
                        <button class="btn btn-sm btn-success" onclick="App.closeInspection(${ins.id})">验收通过</button>
                    ` : ''}
                    ${ins.status === 'closed' ? `
                        <span class="info-value" style="color: #67c23a;">已于 ${DataManager.formatDateTime(ins.closedAt)} 验收通过</span>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    renderRefundList() {
        const approvedRegs = DataManager.getRegistrations('approved');
        const listEl = document.getElementById('refund-list');

        const refundable = approvedRegs.filter(reg => {
            const can = DataManager.canRefund(reg.id);
            return can.can;
        });

        if (refundable.length === 0) {
            if (approvedRegs.length === 0) {
                listEl.innerHTML = '<div class="empty-state">暂无可退还的押金</div>';
            } else {
                listEl.innerHTML = `<div class="empty-state">所有已通过报备的押金要么已退还，要么存在未关闭的巡检问题</div>`;
            }
            return;
        }

        listEl.innerHTML = refundable.map(reg => {
            const deposit = DataManager.getDepositByRegistration(reg.id);
            const checklist = DataManager.getRefundChecklist(reg.id);
            const inspections = DataManager.getInspectionsByRegistration(reg.id);
            const openCount = inspections.filter(i => i.status !== 'closed').length;

            return `
                <div class="data-card" style="margin-top: 16px;">
                    <div class="card-header">
                        <div>
                            <div class="card-title">${reg.roomNumber} - ${reg.ownerName}</div>
                            <div class="card-subtitle">押金金额：${DataManager.formatCurrency(deposit.amount)} | 巡检问题：${inspections.length} 条（${openCount} 条待处理）</div>
                        </div>
                        <button class="btn btn-sm btn-success" onclick="App.showRefundChecklist(${reg.id})">核对并退还</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderHistoryList() {
        const typeFilter = document.getElementById('history-type-filter').value;
        const actionFilter = document.getElementById('history-action-filter').value;
        const history = DataManager.getHistory(typeFilter, actionFilter);
        const listEl = document.getElementById('history-list');

        if (history.length === 0) {
            listEl.innerHTML = '<div class="empty-state">暂无历史记录</div>';
            return;
        }

        listEl.innerHTML = history.map(h => `
            <div class="history-item action-${h.action}">
                <div class="history-header">
                    <span class="history-type">${this.getHistoryTypeText(h.type)} | ${this.getHistoryActionText(h.action)}</span>
                    <span class="history-time">${DataManager.formatDateTime(h.timestamp)}</span>
                </div>
                <div class="history-title">${h.title}</div>
                ${h.beforeData || h.afterData ? `
                    <div class="history-diff">
                        ${this.renderDiff(h.beforeData, h.afterData)}
                    </div>
                ` : ''}
            </div>
        `).join('');
    },

    getHistoryTypeText(type) {
        const map = {
            registration: '装修报备',
            deposit: '押金管理',
            inspection: '巡检整改',
            refund: '押金退还'
        };
        return map[type] || type;
    },

    getHistoryActionText(action) {
        const map = {
            create: '新增',
            update: '修改',
            approve: '确认',
            reject: '拒绝',
            withdraw: '撤回',
            refund: '退还'
        };
        return map[action] || action;
    },

    renderDiff(before, after) {
        if (!after) return '<div>新创建记录</div>';
        if (!before) return '<div>初始记录</div>';

        const diffFields = ['status', 'amount', 'decorationCompany', 'description', 'rejectReason', 'rectifyPlan', 'rectifyDesc', 'reopenReason'];
        const diffs = [];

        diffFields.forEach(field => {
            if (before[field] !== after[field]) {
                diffs.push({
                    field,
                    before: before[field] || '(空)',
                    after: after[field] || '(空)'
                });
            }
        });

        if (diffs.length === 0) return '<div>无字段变更</div>';

        return diffs.map(d => `
            <div class="diff-section">
                <div class="diff-label">${this.getFieldLabel(d.field)}</div>
                <div class="diff-values">
                    <span class="diff-old">${d.before}</span>
                    <span>→</span>
                    <span class="diff-new">${d.after}</span>
                </div>
            </div>
        `).join('');
    },

    getFieldLabel(field) {
        const map = {
            status: '状态',
            amount: '金额',
            decorationCompany: '装修公司',
            description: '描述',
            rejectReason: '拒绝原因',
            rectifyPlan: '整改方案',
            rectifyDesc: '整改说明',
            reopenReason: '重新整改原因'
        };
        return map[field] || field;
    },

    showModal(title, content, footer) {
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="modal-overlay" onclick="App.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="App.closeModal()">×</button>
                    </div>
                    <div class="modal-body">${content}</div>
                    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
                </div>
            </div>
        `;
    },

    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('modal-container').innerHTML = '';
    },

    showRegistrationModal(existingData = null) {
        const isEdit = existingData !== null;
        const content = `
            <form id="registration-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">房间号</label>
                        <input type="text" class="form-input" name="roomNumber" value="${existingData?.roomNumber || ''}" required placeholder="例如：1栋1单元101室">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">业主姓名</label>
                        <input type="text" class="form-input" name="ownerName" value="${existingData?.ownerName || ''}" required placeholder="请输入业主姓名">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">联系电话</label>
                        <input type="tel" class="form-input" name="ownerPhone" value="${existingData?.ownerPhone || ''}" required placeholder="请输入联系电话">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">装修类型</label>
                        <select class="form-select" name="decorationType" required>
                            <option value="">请选择</option>
                            <option value="全屋装修" ${existingData?.decorationType === '全屋装修' ? 'selected' : ''}>全屋装修</option>
                            <option value="局部装修" ${existingData?.decorationType === '局部装修' ? 'selected' : ''}>局部装修</option>
                            <option value="精装修" ${existingData?.decorationType === '精装修' ? 'selected' : ''}>精装修</option>
                            <option value="简单装修" ${existingData?.decorationType === '简单装修' ? 'selected' : ''}>简单装修</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required">装修公司</label>
                    <input type="text" class="form-input" name="decorationCompany" value="${existingData?.decorationCompany || ''}" required placeholder="请输入装修公司名称">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">预计开始日期</label>
                        <input type="date" class="form-input" name="startDate" value="${existingData?.startDate || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">预计结束日期</label>
                        <input type="date" class="form-input" name="endDate" value="${existingData?.endDate || ''}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required">装修押金金额（元）</label>
                    <input type="number" class="form-input" name="amount" value="${existingData?.amount || ''}" required placeholder="请输入押金金额">
                </div>
                <div class="form-group">
                    <label class="form-label">备注说明</label>
                    <textarea class="form-textarea" name="description" placeholder="请输入备注说明（可选）">${existingData?.description || ''}</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
            <button class="btn btn-primary" onclick="App.saveRegistration(${existingData?.id || 'null'})">${isEdit ? '保存修改' : '提交报备'}</button>
        `;

        this.showModal(isEdit ? '修改装修报备' : '新增装修报备', content, footer);
    },

    saveRegistration(id) {
        const form = document.getElementById('registration-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.roomNumber || !data.ownerName || !data.ownerPhone || !data.decorationType || !data.startDate || !data.endDate || !data.amount) {
            this.showToast('请填写所有必填项', 'error');
            return;
        }

        if (id) {
            DataManager.updateRegistration(id, data);
            this.showToast('报备信息已更新', 'success');
        } else {
            DataManager.createRegistration(data);
            this.showToast('报备已提交，等待审核', 'success');
        }

        this.closeModal();
        this.render();
    },

    editRegistration(id) {
        const reg = DataManager.getRegistration(id);
        if (reg) {
            this.showRegistrationModal(reg);
        }
    },

    approveRegistration(id) {
        DataManager.approveRegistration(id);
        this.showToast('报备审核通过', 'success');
        this.render();
    },

    rejectRegistration(id) {
        const content = `
            <form id="reject-form">
                <div class="form-group">
                    <label class="form-label required">拒绝原因</label>
                    <textarea class="form-textarea" name="reason" required placeholder="请输入拒绝原因"></textarea>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
            <button class="btn btn-danger" onclick="App.confirmRejectRegistration(${id})">确认拒绝</button>
        `;
        this.showModal('拒绝报备', content, footer);
    },

    confirmRejectRegistration(id) {
        const form = document.getElementById('reject-form');
        const reason = form.reason.value;
        if (!reason) {
            this.showToast('请输入拒绝原因', 'error');
            return;
        }
        DataManager.rejectRegistration(id, reason);
        this.showToast('报备已拒绝', 'success');
        this.closeModal();
        this.render();
    },

    withdrawRegistration(id) {
        DataManager.withdrawRegistration(id);
        this.showToast('已撤回并重新进入待审核状态', 'success');
        this.render();
    },

    showInspectionModal() {
        const approvedRegs = DataManager.getRegistrations('approved');
        
        if (approvedRegs.length === 0) {
            this.showToast('没有已通过审核的报备记录', 'warning');
            return;
        }

        const options = approvedRegs.map(reg => `
            <option value="${reg.id}">${reg.roomNumber} - ${reg.ownerName}</option>
        `).join('');

        const content = `
            <form id="inspection-form">
                <div class="form-group">
                    <label class="form-label required">选择报备记录</label>
                    <select class="form-select" name="registrationId" required>
                        <option value="">请选择</option>
                        ${options}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">问题类型</label>
                        <select class="form-select" name="issueType" required>
                            <option value="">请选择</option>
                            <option value="安全隐患">安全隐患</option>
                            <option value="施工规范">施工规范</option>
                            <option value="违规施工">违规施工</option>
                            <option value="噪音投诉">噪音投诉</option>
                            <option value="环境问题">环境问题</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">严重程度</label>
                        <select class="form-select" name="severity" required>
                            <option value="">请选择</option>
                            <option value="high">严重</option>
                            <option value="medium">中等</option>
                            <option value="low">轻微</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">问题位置</label>
                        <input type="text" class="form-input" name="location" required placeholder="例如：客厅、主卧、厨房">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">巡检员</label>
                        <input type="text" class="form-input" name="inspector" required placeholder="请输入巡检员姓名">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required">问题描述</label>
                    <textarea class="form-textarea" name="description" required placeholder="请详细描述发现的问题"></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
            <button class="btn btn-primary" onclick="App.saveInspection()">提交巡检</button>
        `;

        this.showModal('新增巡检问题', content, footer);
    },

    saveInspection() {
        const form = document.getElementById('inspection-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.registrationId || !data.issueType || !data.severity || !data.location || !data.inspector || !data.description) {
            this.showToast('请填写所有必填项', 'error');
            return;
        }

        const reg = DataManager.getRegistration(Number(data.registrationId));
        data.roomNumber = reg.roomNumber;

        DataManager.createInspection(data);
        this.showToast('巡检问题已记录', 'success');
        this.closeModal();
        this.render();
    },

    startRectification(id) {
        const content = `
            <form id="rectify-plan-form">
                <div class="form-group">
                    <label class="form-label required">整改方案</label>
                    <textarea class="form-textarea" name="plan" required placeholder="请填写整改方案"></textarea>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
            <button class="btn btn-primary" onclick="App.confirmStartRectification(${id})">开始整改</button>
        `;
        this.showModal('开始整改', content, footer);
    },

    confirmStartRectification(id) {
        const form = document.getElementById('rectify-plan-form');
        const plan = form.plan.value;
        if (!plan) {
            this.showToast('请填写整改方案', 'error');
            return;
        }
        DataManager.startRectification(id, plan);
        this.showToast('已开始整改', 'success');
        this.closeModal();
        this.render();
    },

    submitRectification(id) {
        const content = `
            <form id="rectify-submit-form">
                <div class="form-group">
                    <label class="form-label required">整改说明</label>
                    <textarea class="form-textarea" name="desc" required placeholder="请详细说明整改情况"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">整改照片（文件名，用逗号分隔）</label>
                    <input type="text" class="form-input" name="photos" placeholder="例如：photo1.jpg, photo2.jpg">
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
            <button class="btn btn-warning" onclick="App.confirmSubmitRectification(${id})">提交整改</button>
        `;
        this.showModal('提交整改', content, footer);
    },

    confirmSubmitRectification(id) {
        const form = document.getElementById('rectify-submit-form');
        const desc = form.desc.value;
        const photos = form.photos.value.split(',').map(p => p.trim()).filter(p => p);
        if (!desc) {
            this.showToast('请填写整改说明', 'error');
            return;
        }
        DataManager.submitRectification(id, desc, photos);
        this.showToast('整改已提交，等待验收', 'success');
        this.closeModal();
        this.render();
    },

    closeInspection(id) {
        DataManager.closeInspection(id);
        this.showToast('巡检问题验收通过', 'success');
        this.render();
    },

    reopenInspection(id) {
        const content = `
            <form id="reopen-form">
                <div class="form-group">
                    <label class="form-label required">重新整改原因</label>
                    <textarea class="form-textarea" name="reason" required placeholder="请输入重新整改的原因"></textarea>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
            <button class="btn btn-danger" onclick="App.confirmReopenInspection(${id})">确认重新整改</button>
        `;
        this.showModal('整改不合格', content, footer);
    },

    confirmReopenInspection(id) {
        const form = document.getElementById('reopen-form');
        const reason = form.reason.value;
        if (!reason) {
            this.showToast('请输入重新整改原因', 'error');
            return;
        }
        DataManager.reopenInspection(id, reason);
        this.showToast('已要求重新整改', 'success');
        this.closeModal();
        this.render();
    },

    refundDeposit(id) {
        const deposit = DataManager.getDeposit(id);
        const can = DataManager.canRefund(deposit.registrationId);

        if (!can.can) {
            this.showToast(`无法退还押金：${can.reason}`, 'warning');
            return;
        }

        const remainingAmount = deposit.remainingAmount !== undefined ? deposit.remainingAmount : deposit.amount;

        const content = `
            <div class="alert alert-info">
                <span>ℹ️</span>
                <div>
                    <strong>退还核对：</strong>报备已通过，巡检问题已全部关闭，可以申请退还押金。
                </div>
            </div>
            <form id="refund-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">押金总额</label>
                        <input type="text" class="form-input" value="${DataManager.formatCurrency(deposit.amount)}" disabled>
                    </div>
                    <div class="form-group">
                        <label class="form-label">可退还金额</label>
                        <input type="text" class="form-input" value="${DataManager.formatCurrency(remainingAmount)}" disabled>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required">退还金额（元）</label>
                    <input type="number" class="form-input" name="amount" value="${remainingAmount}" max="${remainingAmount}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">退还原因</label>
                    <textarea class="form-textarea" name="reason" placeholder="请输入退还原因（可选）">装修验收合格，押金退还</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
            <button class="btn btn-success" onclick="App.confirmRefundDeposit(${id})">确认退还</button>
        `;

        this.showModal('退还押金', content, footer);
    },

    confirmRefundDeposit(id) {
        const form = document.getElementById('refund-form');
        const amount = Number(form.amount.value);
        const reason = form.reason.value;

        DataManager.refundDeposit(id, amount, reason);
        this.showToast('押金已退还', 'success');
        this.closeModal();
        this.render();
    },

    showRefundChecklist(registrationId) {
        this.selectedRegistrationId = registrationId;
        const reg = DataManager.getRegistration(registrationId);
        const checklist = DataManager.getRefundChecklist(registrationId);
        const can = DataManager.canRefund(registrationId);
        const deposit = DataManager.getDepositByRegistration(registrationId);

        const statusIcon = {
            check: '✅',
            cross: '❌',
            warn: '⚠️'
        };

        const checklistHtml = checklist.map(item => `
            <div class="checklist-item">
                <span class="checklist-icon ${item.status}">${statusIcon[item.status]}</span>
                <div class="checklist-content">
                    <div class="checklist-title">${item.title}</div>
                    <div class="checklist-desc">${item.description}</div>
                    <div class="checklist-detail">${item.detail}</div>
                </div>
            </div>
        `).join('');

        const content = `
            <div class="progress-section">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${can.can ? '100%' : '66%'};"></div>
                </div>
                <div class="progress-label">
                    <span>退还进度</span>
                    <span>${can.can ? '已完成全部核对' : '核对中'}</span>
                </div>
            </div>
            ${checklistHtml}
            ${can.can ? `
                <div class="alert alert-success" style="margin-top: 16px;">
                    <span>✅</span>
                    <div>
                        <strong>可以退还押金</strong>：所有核对项已通过，可以申请退还 ${DataManager.formatCurrency(deposit.amount)} 押金。
                    </div>
                </div>
            ` : `
                <div class="alert alert-error" style="margin-top: 16px;">
                    <span>❌</span>
                    <div>
                        <strong>暂不满足退还条件</strong>：${can.reason}
                    </div>
                </div>
            `}
        `;

        const footer = can.can ? `
            <button class="btn btn-secondary" onclick="App.closeModal()">关闭</button>
            <button class="btn btn-success" onclick="App.refundDeposit(${deposit.id})">申请退还押金</button>
        ` : `
            <button class="btn btn-secondary" onclick="App.closeModal()">关闭</button>
        `;

        this.showModal(`退还核对 - ${reg.roomNumber}`, content, footer);
    },

    runNormalDemo() {
        DataManager.reset();
        DemoData.createNormalDemo();
        this.showToast('正常路径演示数据已加载', 'success');
        this.switchTab('dashboard');
        this.render();
    },

    runAbnormalDemo() {
        DataManager.reset();
        DemoData.createAbnormalDemo();
        this.showToast('异常路径演示数据已加载', 'warning');
        this.switchTab('dashboard');
        this.render();
    },

    exportData() {
        const data = DataManager.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `物业装修押金数据_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('数据已导出', 'success');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${this.getToastIcon(type)}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
