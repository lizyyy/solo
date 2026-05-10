window.RetestsPage = {};
window.RetestsPage.currentFilters = { search: '', status: 'all' };
window.RetestsPage.currentPage = 1;
window.RetestsPage.pageSize = 10;

window.RetestsPage.render = function() {
    var self = this;
    var container = document.getElementById('page-retests');
    var retests = this.getFilteredRetests();
    var stats = DataService.Retests.getStatistics();

    container.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">复测管理</h2>
            <div class="btn-group">
                <button class="btn btn-outline" onclick="DataService.Export.exportRetests(); Utils.showToast('导出成功', 'success')">📤 导出</button>
            </div>
        </div>

        <div class="stats-container" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card">
                <div class="stat-title">待复测</div>
                <div class="stat-value">${stats.statusCounts.pending}</div>
                <div class="stat-subtitle">逾期 ${stats.overdue} 人</div>
            </div>
            <div class="stat-card success">
                <div class="stat-title">复测正常</div>
                <div class="stat-value">${stats.statusCounts.normal}</div>
                <div class="stat-subtitle">已结案</div>
            </div>
            <div class="stat-card high-risk">
                <div class="stat-title">复测仍异常</div>
                <div class="stat-value">${stats.statusCounts.still_abnormal}</div>
                <div class="stat-subtitle">需安排随访</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">今日待复测</div>
                <div class="stat-value">${stats.upcoming}</div>
                <div class="stat-subtitle">需提醒</div>
            </div>
        </div>

        <div class="filter-bar">
            <div class="filter-row">
                <div class="filter-group">
                    <label class="filter-label">搜索</label>
                    <input type="text" class="filter-input" placeholder="居民姓名" value="${this.currentFilters.search}" oninput="RetestsPage.handleSearch(this.value)">
                </div>
                <div class="filter-group">
                    <label class="filter-label">状态</label>
                    <select class="filter-select" onchange="RetestsPage.handleFilterChange('status', this.value)">
                        <option value="all" ${this.currentFilters.status === 'all' ? 'selected' : ''}>全部</option>
                        <option value="pending" ${this.currentFilters.status === 'pending' ? 'selected' : ''}>待复测</option>
                        <option value="normal" ${this.currentFilters.status === 'normal' ? 'selected' : ''}>复测正常</option>
                        <option value="still_abnormal" ${this.currentFilters.status === 'still_abnormal' ? 'selected' : ''}>复测仍异常</option>
                    </select>
                </div>
            </div>
        </div>

        ${this.renderRetestsTable(retests)}
        ${this.renderPagination(retests)}
    `;
};

window.RetestsPage.getFilteredRetests = function() {
    var retests = DataService.Retests.getAll();
    
    if (this.currentFilters.search) {
        var q = this.currentFilters.search.toLowerCase();
        retests = retests.filter(function(r) { return r.residentName.toLowerCase().includes(q); });
    }
    
    if (this.currentFilters.status !== 'all') {
        retests = retests.filter(function(r) { return r.status === this.currentFilters.status; }.bind(this));
    }
    
    return retests.sort(function(a, b) {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
};

window.RetestsPage.renderRetestsTable = function(retests) {
    if (retests.length === 0) {
        return `
            <div class="table-container">
                <div class="empty-state">
                    <div class="empty-state-icon">🔄</div>
                    <div class="empty-state-text">暂无复测任务</div>
                    <div class="empty-state-hint">从"筛查记录"中对异常血压创建复测任务</div>
                </div>
            </div>
        `;
    }

    var startIndex = (this.currentPage - 1) * this.pageSize;
    var pageData = retests.slice(startIndex, startIndex + this.pageSize);
    var self = this;

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>居民</th>
                        <th>原血压</th>
                        <th>原风险</th>
                        <th>计划复测</th>
                        <th>复测结果</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageData.map(function(r) { return self.renderRetestRow(r); }).join('')}
                </tbody>
            </table>
        </div>
    `;
};

window.RetestsPage.renderRetestRow = function(retest) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var scheduled = new Date(retest.scheduledDate);
    scheduled.setHours(0, 0, 0, 0);
    var isOverdue = retest.status === 'pending' && scheduled < today;

    var originalRiskClass = Utils.getRiskBadgeClass(retest.originalRiskLevel);
    var originalRiskLabel = DataService.Constants.RISK_LABELS[retest.originalRiskLevel];
    var statusClass = Utils.getStatusBadgeClass(retest.status, 'retest');
    var statusLabel = DataService.Constants.RETEST_STATUS_LABELS[retest.status];

    var actionButtons = '';
    
    if (retest.status === 'pending') {
        actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="RetestsPage.showCompleteModal('${retest.id}')">录入结果</button>
            <button class="btn btn-sm btn-outline" onclick="RetestsPage.cancelRetest('${retest.id}')">取消</button>
        `;
    } else if (retest.status === 'still_abnormal') {
        var existingFollowup = DataService.Followups.getByRetestId(retest.id);
        if (existingFollowup.length === 0) {
            actionButtons = `
                <button class="btn btn-sm btn-warning" onclick="RetestsPage.showCreateFollowupModal('${retest.id}')">创建随访</button>
            `;
        } else {
            actionButtons = `
                <button class="btn btn-sm btn-outline" onclick="RetestsPage.showDetail('${retest.id}')">查看</button>
            `;
        }
    } else {
        actionButtons = `
            <button class="btn btn-sm btn-outline" onclick="RetestsPage.showDetail('${retest.id}')">详情</button>
        `;
    }

    return `
        <tr style="${isOverdue ? 'background: #fde8e840;' : ''}">
            <td><strong>${Utils.escapeHtml(retest.residentName)}</strong></td>
            <td>${retest.originalSystolic}/${retest.originalDiastolic} mmHg</td>
            <td><span class="badge ${originalRiskClass}">${originalRiskLabel}</span></td>
            <td>
                ${DataService.Utils.formatDate(retest.scheduledDate)}
                ${retest.scheduledTime ? ' ' + retest.scheduledTime : ''}
                ${isOverdue ? '<br><span style="color: #e74c3c; font-size: 0.8rem;">⚠ 已逾期</span>' : ''}
            </td>
            <td>
                ${retest.status !== 'pending' ? retest.resultSystolic + '/' + retest.resultDiastolic + ' mmHg' : '-'}
            </td>
            <td><span class="badge ${statusClass}">${statusLabel}</span></td>
            <td class="action-cell">
                ${actionButtons}
            </td>
        </tr>
    `;
};

window.RetestsPage.renderPagination = function(retests) {
    var totalPages = Math.ceil(retests.length / this.pageSize);
    if (totalPages <= 1) return '';

    var startIndex = (this.currentPage - 1) * this.pageSize + 1;
    var endIndex = Math.min(this.currentPage * this.pageSize, retests.length);

    var pageButtons = '';
    for (var i = 1; i <= totalPages; i++) {
        pageButtons += '<button class="pagination-btn ' + (i === this.currentPage ? 'active' : '') + '" onclick="RetestsPage.goToPage(' + i + ')">' + i + '</button>';
    }

    return `
        <div class="pagination">
            <button class="pagination-btn" onclick="RetestsPage.goToPage(1)" ${this.currentPage === 1 ? 'disabled' : ''}>«</button>
            <button class="pagination-btn" onclick="RetestsPage.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>
            ${pageButtons}
            <button class="pagination-btn" onclick="RetestsPage.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>›</button>
            <button class="pagination-btn" onclick="RetestsPage.goToPage(${totalPages})" ${this.currentPage === totalPages ? 'disabled' : ''}>»</button>
            <span class="pagination-info">${startIndex}-${endIndex} / ${retests.length} 条</span>
        </div>
    `;
};

window.RetestsPage._searchTimeout = null;
window.RetestsPage.handleSearch = function(value) {
    var self = this;
    if (this._searchTimeout) clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(function() {
        self.currentFilters.search = value;
        self.currentPage = 1;
        self.render();
    }, 300);
};

window.RetestsPage.handleFilterChange = function(key, value) {
    this.currentFilters[key] = value;
    this.currentPage = 1;
    this.render();
};

window.RetestsPage.goToPage = function(page) {
    this.currentPage = page;
    this.render();
};

window.RetestsPage.showCompleteModal = function(id) {
    var retest = DataService.Retests.getById(id);
    if (!retest) return;

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">复测任务信息</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${retest.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">原血压</div>
                    <div class="detail-item-value">${retest.originalSystolic}/${retest.originalDiastolic} mmHg</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">原风险</div>
                    <div class="detail-item-value">
                        <span class="badge ${Utils.getRiskBadgeClass(retest.originalRiskLevel)}">
                            ${DataService.Constants.RISK_LABELS[retest.originalRiskLevel]}
                        </span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">计划时间</div>
                    <div class="detail-item-value">
                        ${DataService.Utils.formatDate(retest.scheduledDate)}
                        ${retest.scheduledTime || ''}
                    </div>
                </div>
            </div>
        </div>

        <form id="completeForm" style="margin-top: 1rem;">
            <input type="hidden" name="retestId" value="${id}">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 收缩压 (mmHg)</label>
                    <input type="number" class="form-input" name="systolic" required min="40" max="300" placeholder="如: 135" oninput="RetestsPage.updateRetestRiskPreview()">
                </div>
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 舒张压 (mmHg)</label>
                    <input type="number" class="form-input" name="diastolic" required min="30" max="200" placeholder="如: 85" oninput="RetestsPage.updateRetestRiskPreview()">
                </div>
                <div class="form-group">
                    <label class="form-label">心率 (次/分)</label>
                    <input type="number" class="form-input" name="heartRate" min="30" max="200" placeholder="如: 78">
                </div>
            </div>
            <div id="retestRiskPreview" class="chart-card" style="padding: 1rem; margin-bottom: 1rem; display: none;">
                <strong>复测风险：</strong><span id="retestRiskPreviewValue"></span>
            </div>
            <div class="form-group">
                <label class="form-label">完成人</label>
                <input type="text" class="form-input" name="operator" placeholder="请输入操作人姓名">
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-textarea" name="notes" placeholder="复测情况说明"></textarea>
            </div>
        </form>
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="RetestsPage.submitComplete()">提交结果</button>
    `;

    Utils.openModal(content, { title: '录入复测结果', large: true, footer });
};

window.RetestsPage.updateRetestRiskPreview = function() {
    var form = document.getElementById('completeForm');
    if (!form) return;

    var systolic = parseInt(form.systolic.value) || 0;
    var diastolic = parseInt(form.diastolic.value) || 0;
    var retestId = form.retestId.value;

    var preview = document.getElementById('retestRiskPreview');
    var previewValue = document.getElementById('retestRiskPreviewValue');

    if (systolic > 0 && diastolic > 0) {
        var retest = DataService.Retests.getById(retestId);
        var resident = retest ? DataService.Residents.getById(retest.residentId) : null;
        var age = resident ? DataService.Utils.calculateAge(resident.birthDate) : null;
        var hasHistory = resident ? resident.hasHypertensionHistory : false;

        var riskLevel = DataService.Utils.calculateRiskLevel(systolic, diastolic, age, hasHistory);
        var riskLabel = DataService.Constants.RISK_LABELS[riskLevel];
        var riskClass = Utils.getRiskBadgeClass(riskLevel);

        preview.style.display = 'block';
        var extraText = riskLevel === 'normal' 
            ? ' <span style="color: #27ae60; margin-left: 0.5rem;">✓ 复测正常，案件将结案</span>'
            : ' <span style="color: #e74c3c; margin-left: 0.5rem;">⚠ 仍异常，需安排随访</span>';
        previewValue.innerHTML = '<span class="badge ' + riskClass + '" style="font-size: 0.9rem; padding: 0.3rem 0.75rem;">' + riskLabel + '</span>' + extraText;
    } else {
        preview.style.display = 'none';
    }
};

window.RetestsPage.submitComplete = function() {
    var form = document.getElementById('completeForm');
    if (!Utils.validateForm(form)) return;

    var data = Utils.getFormData(form);
    var result = DataService.Retests.complete(data.retestId, data, data.operator);

    if (result.success) {
        Utils.closeModal();
        
        var riskLevel = result.data.resultRiskLevel;
        if (riskLevel === 'normal') {
            Utils.showToast('复测正常，案件已结案', 'success');
        } else {
            Utils.showToast('复测仍异常，请安排随访', 'warning');
        }
        
        this.render();
        DashboardPage.render();
        ScreeningsPage.render();
        FollowupsPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.RetestsPage.cancelRetest = function(id) {
    var self = this;
    Utils.showConfirm('确认取消该复测任务？', function(confirmed) {
        if (confirmed) {
            var result = DataService.Retests.cancel(id);
            if (result.success) {
                Utils.showToast('复测任务已取消', 'success');
                self.render();
                DashboardPage.render();
            }
        }
    });
};

window.RetestsPage.showCreateFollowupModal = function(retestId) {
    var retest = DataService.Retests.getById(retestId);
    if (!retest) return;

    var operators = DataService.Operators.getAll();
    var operatorOptions = operators.map(function(o) {
        return '<option value="' + o.id + '" data-name="' + o.name + '">' + o.name + ' - ' + o.department + '</option>';
    }).join('');

    var tomorrow = Utils.addDays(Utils.getTodayString(), 1);

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">复测结果</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${retest.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">复测血压</div>
                    <div class="detail-item-value">${retest.resultSystolic}/${retest.resultDiastolic} mmHg</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">风险等级</div>
                    <div class="detail-item-value">
                        <span class="badge ${Utils.getRiskBadgeClass(retest.resultRiskLevel)}">
                            ${DataService.Constants.RISK_LABELS[retest.resultRiskLevel]}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <form id="followupForm" style="margin-top: 1rem;">
            <input type="hidden" name="retestId" value="${retestId}">
            <div class="form-group">
                <label class="form-label"><span class="required">*</span> 随访责任人</label>
                <select class="form-select" name="assignedTo" required onchange="RetestsPage.updateAssignedToName()">
                    <option value="">请选择责任人</option>
                    ${operatorOptions}
                </select>
                <input type="hidden" name="assignedToName">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 优先级</label>
                    <select class="form-select" name="priority" required>
                        <option value="high">高优先级</option>
                        <option value="medium" selected>中优先级</option>
                        <option value="low">低优先级</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">计划随访日期</label>
                    <input type="date" class="form-input" name="scheduledDate" value="${tomorrow}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">分配人</label>
                <input type="text" class="form-input" name="assignedBy" placeholder="请输入分配人姓名">
            </div>
        </form>
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="RetestsPage.submitFollowup()">创建随访任务</button>
    `;

    Utils.openModal(content, { title: '创建随访任务', large: true, footer });
};

window.RetestsPage.updateAssignedToName = function() {
    var form = document.getElementById('followupForm');
    if (!form) return;
    
    var select = form.assignedTo;
    var option = select.options[select.selectedIndex];
    if (option && option.dataset.name) {
        form.assignedToName.value = option.dataset.name;
    }
};

window.RetestsPage.submitFollowup = function() {
    var form = document.getElementById('followupForm');
    if (!Utils.validateForm(form)) return;

    var data = Utils.getFormData(form);
    var result = DataService.Followups.create(data);

    if (result.success) {
        Utils.closeModal();
        Utils.showToast('随访任务已创建', 'success');
        this.render();
        DashboardPage.render();
        FollowupsPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.RetestsPage.showDetail = function(id) {
    var retest = DataService.Retests.getById(id);
    if (!retest) return;

    var screening = DataService.Screenings.getById(retest.screeningId);
    var followups = DataService.Followups.getByRetestId(id);

    var originalRiskClass = Utils.getRiskBadgeClass(retest.originalRiskLevel);
    var originalRiskLabel = DataService.Constants.RISK_LABELS[retest.originalRiskLevel];
    var statusClass = Utils.getStatusBadgeClass(retest.status, 'retest');
    var statusLabel = DataService.Constants.RETEST_STATUS_LABELS[retest.status];

    var followupHtml = '';
    if (followups.length > 0) {
        var followupItems = followups.map(function(f) {
            return '<div class="timeline-item ' + (f.status === 'escalated' ? 'danger' : f.status === 'completed' ? 'success' : '') + '"><div class="timeline-item-header"><div class="timeline-item-title">' + DataService.Constants.FOLLOWUP_STATUS_LABELS[f.status] + '</div><div class="timeline-item-time">' + DataService.Utils.formatDateTime(f.createdAt) + '</div></div><div class="timeline-item-content">责任人: ' + (f.assignedToName || '-') + (f.progress.length > 0 ? '，随访次数: ' + f.progress.length : '') + '</div></div>';
        }).join('');
        followupHtml = '<div class="detail-section"><h3 class="detail-section-title">随访记录</h3><div class="timeline">' + followupItems + '</div></div>';
    }

    var resultHtml = '';
    if (retest.status !== 'pending') {
        resultHtml = `
            <div class="detail-section">
                <h3 class="detail-section-title">复测结果</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-item-label">复测血压</div>
                        <div class="detail-item-value">${retest.resultSystolic}/${retest.resultDiastolic} mmHg</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">复测心率</div>
                        <div class="detail-item-value">${retest.resultHeartRate ? retest.resultHeartRate + ' 次/分' : '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">复测风险</div>
                        <div class="detail-item-value">
                            <span class="badge ${Utils.getRiskBadgeClass(retest.resultRiskLevel)}">
                                ${DataService.Constants.RISK_LABELS[retest.resultRiskLevel]}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">完成时间</div>
                        <div class="detail-item-value">${DataService.Utils.formatDateTime(retest.completedAt)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">完成人</div>
                        <div class="detail-item-value">${retest.completedBy || '-'}</div>
                    </div>
                    ${retest.notes ? '<div class="detail-item" style="grid-column: span 2;"><div class="detail-item-label">备注</div><div class="detail-item-value">' + retest.notes + '</div></div>' : ''}
                </div>
            </div>
        `;
    }

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">复测任务</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${retest.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">状态</div>
                    <div class="detail-item-value"><span class="badge ${statusClass}">${statusLabel}</span></div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">计划复测日期</div>
                    <div class="detail-item-value">${DataService.Utils.formatDate(retest.scheduledDate)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">计划复测时间</div>
                    <div class="detail-item-value">${retest.scheduledTime || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">复测地点</div>
                    <div class="detail-item-value">${retest.location || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">负责人</div>
                    <div class="detail-item-value">${retest.operator || '-'}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">原筛查信息</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">原血压</div>
                    <div class="detail-item-value">${retest.originalSystolic}/${retest.originalDiastolic} mmHg</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">原风险等级</div>
                    <div class="detail-item-value">
                        <span class="badge ${originalRiskClass}">${originalRiskLabel}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">筛查时间</div>
                    <div class="detail-item-value">${screening ? DataService.Utils.formatDateTime(screening.screeningTime) : '-'}</div>
                </div>
            </div>
        </div>

        ${resultHtml}
        ${followupHtml}
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">关闭</button>
    `;

    Utils.openModal(content, { title: '复测详情', large: true, footer });
};
