window.FollowupsPage = {};
window.FollowupsPage.currentFilters = { search: '', status: 'all', risk: 'all' };
window.FollowupsPage.currentPage = 1;
window.FollowupsPage.pageSize = 10;

window.FollowupsPage.render = function() {
    var self = this;
    var container = document.getElementById('page-followups');
    var followups = this.getFilteredFollowups();
    var stats = DataService.Followups.getStatistics();

    container.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">随访管理</h2>
            <div class="btn-group">
                <button class="btn btn-outline" onclick="DataService.Export.exportFollowups(); Utils.showToast('导出成功', 'success')">📤 导出</button>
            </div>
        </div>

        <div class="stats-container" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card warning">
                <div class="stat-title">已分配</div>
                <div class="stat-value">${stats.statusCounts.assigned}</div>
                <div class="stat-subtitle">待启动</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">进行中</div>
                <div class="stat-value">${stats.statusCounts.in_progress}</div>
                <div class="stat-subtitle">已逾期 ${stats.overdue} 个</div>
            </div>
            <div class="stat-card success">
                <div class="stat-title">已完成</div>
                <div class="stat-value">${stats.statusCounts.completed}</div>
                <div class="stat-subtitle">案件结案</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-title">需转诊</div>
                <div class="stat-value">${stats.statusCounts.escalated}</div>
                <div class="stat-subtitle">已上报</div>
            </div>
        </div>

        <div class="filter-bar">
            <div class="filter-row">
                <div class="filter-group">
                    <label class="filter-label">搜索</label>
                    <input type="text" class="filter-input" placeholder="居民姓名/责任人" value="${this.currentFilters.search}" oninput="FollowupsPage.handleSearch(this.value)">
                </div>
                <div class="filter-group">
                    <label class="filter-label">状态</label>
                    <select class="filter-select" onchange="FollowupsPage.handleFilterChange('status', this.value)">
                        <option value="all" ${this.currentFilters.status === 'all' ? 'selected' : ''}>全部</option>
                        <option value="assigned" ${this.currentFilters.status === 'assigned' ? 'selected' : ''}>已分配</option>
                        <option value="in_progress" ${this.currentFilters.status === 'in_progress' ? 'selected' : ''}>进行中</option>
                        <option value="completed" ${this.currentFilters.status === 'completed' ? 'selected' : ''}>已完成</option>
                        <option value="escalated" ${this.currentFilters.status === 'escalated' ? 'selected' : ''}>需转诊</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">风险</label>
                    <select class="filter-select" onchange="FollowupsPage.handleFilterChange('risk', this.value)">
                        <option value="all" ${this.currentFilters.risk === 'all' ? 'selected' : ''}>全部</option>
                        <option value="high" ${this.currentFilters.risk === 'high' ? 'selected' : ''}>高危</option>
                        <option value="medium" ${this.currentFilters.risk === 'medium' ? 'selected' : ''}>中危</option>
                        <option value="low" ${this.currentFilters.risk === 'low' ? 'selected' : ''}>低危</option>
                    </select>
                </div>
            </div>
        </div>

        ${this.renderFollowupsTable(followups)}
        ${this.renderPagination(followups)}
    `;
};

window.FollowupsPage.getFilteredFollowups = function() {
    var followups = DataService.Followups.getAll();
    
    if (this.currentFilters.search) {
        var q = this.currentFilters.search.toLowerCase();
        followups = followups.filter(function(f) { 
            return f.residentName.toLowerCase().includes(q) || 
                   (f.assignedToName && f.assignedToName.toLowerCase().includes(q)); 
        });
    }
    
    if (this.currentFilters.status !== 'all') {
        followups = followups.filter(function(f) { return f.status === this.currentFilters.status; }.bind(this));
    }
    
    if (this.currentFilters.risk !== 'all') {
        followups = followups.filter(function(f) { return f.riskLevel === this.currentFilters.risk; }.bind(this));
    }
    
    var order = { assigned: 0, in_progress: 1, completed: 2, escalated: 3 };
    return followups.sort(function(a, b) {
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
};

window.FollowupsPage.renderFollowupsTable = function(followups) {
    if (followups.length === 0) {
        return `
            <div class="table-container">
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">暂无随访任务</div>
                    <div class="empty-state-hint">从"复测管理"中对复测仍异常的居民创建随访任务</div>
                </div>
            </div>
        `;
    }

    var startIndex = (this.currentPage - 1) * this.pageSize;
    var pageData = followups.slice(startIndex, startIndex + this.pageSize);
    var self = this;

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>居民</th>
                        <th>风险</th>
                        <th>责任人</th>
                        <th>优先级</th>
                        <th>计划随访</th>
                        <th>随访次数</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageData.map(function(f) { return self.renderFollowupRow(f); }).join('')}
                </tbody>
            </table>
        </div>
    `;
};

window.FollowupsPage.renderFollowupRow = function(followup) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var scheduled = followup.scheduledDate ? new Date(followup.scheduledDate) : null;
    if (scheduled) scheduled.setHours(0, 0, 0, 0);
    var isOverdue = followup.status === 'in_progress' && scheduled && scheduled < today;

    var riskClass = Utils.getRiskBadgeClass(followup.riskLevel);
    var riskLabel = DataService.Constants.RISK_LABELS[followup.riskLevel];
    var statusClass = Utils.getStatusBadgeClass(followup.status, 'followup');
    var statusLabel = DataService.Constants.FOLLOWUP_STATUS_LABELS[followup.status];
    var priorityClass = followup.priority === 'high' ? 'badge badge-high-risk' : followup.priority === 'low' ? 'badge badge-normal' : 'badge badge-medium-risk';
    var priorityLabel = followup.priority === 'high' ? '高' : followup.priority === 'low' ? '低' : '中';

    var actionButtons = '';
    
    if (followup.status === 'assigned') {
        actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="FollowupsPage.startFollowup('${followup.id}')">开始随访</button>
        `;
    } else if (followup.status === 'in_progress') {
        actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="FollowupsPage.showAddProgressModal('${followup.id}')">添加随访</button>
        `;
    }
    
    actionButtons += `
        <button class="btn btn-sm btn-outline" onclick="FollowupsPage.showDetail('${followup.id}')">详情</button>
    `;

    return `
        <tr style="${isOverdue ? 'background: #fde8e840;' : ''}">
            <td><strong>${Utils.escapeHtml(followup.residentName)}</strong></td>
            <td><span class="badge ${riskClass}">${riskLabel}</span></td>
            <td>${followup.assignedToName || '-'}</td>
            <td><span class="badge ${priorityClass}">${priorityLabel}</span></td>
            <td>
                ${followup.scheduledDate ? DataService.Utils.formatDate(followup.scheduledDate) : '-'}
                ${isOverdue ? '<br><span style="color: #e74c3c; font-size: 0.8rem;">⚠ 已逾期</span>' : ''}
            </td>
            <td>${followup.progress.length} 次</td>
            <td><span class="badge ${statusClass}">${statusLabel}</span></td>
            <td class="action-cell">
                ${actionButtons}
            </td>
        </tr>
    `;
};

window.FollowupsPage.renderPagination = function(followups) {
    var totalPages = Math.ceil(followups.length / this.pageSize);
    if (totalPages <= 1) return '';

    var startIndex = (this.currentPage - 1) * this.pageSize + 1;
    var endIndex = Math.min(this.currentPage * this.pageSize, followups.length);

    var pageButtons = '';
    for (var i = 1; i <= totalPages; i++) {
        pageButtons += '<button class="pagination-btn ' + (i === this.currentPage ? 'active' : '') + '" onclick="FollowupsPage.goToPage(' + i + ')">' + i + '</button>';
    }

    return `
        <div class="pagination">
            <button class="pagination-btn" onclick="FollowupsPage.goToPage(1)" ${this.currentPage === 1 ? 'disabled' : ''}>«</button>
            <button class="pagination-btn" onclick="FollowupsPage.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>
            ${pageButtons}
            <button class="pagination-btn" onclick="FollowupsPage.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>›</button>
            <button class="pagination-btn" onclick="FollowupsPage.goToPage(${totalPages})" ${this.currentPage === totalPages ? 'disabled' : ''}>»</button>
            <span class="pagination-info">${startIndex}-${endIndex} / ${followups.length} 条</span>
        </div>
    `;
};

window.FollowupsPage._searchTimeout = null;
window.FollowupsPage.handleSearch = function(value) {
    var self = this;
    if (this._searchTimeout) clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(function() {
        self.currentFilters.search = value;
        self.currentPage = 1;
        self.render();
    }, 300);
};

window.FollowupsPage.handleFilterChange = function(key, value) {
    this.currentFilters[key] = value;
    this.currentPage = 1;
    this.render();
};

window.FollowupsPage.goToPage = function(page) {
    this.currentPage = page;
    this.render();
};

window.FollowupsPage.startFollowup = function(id) {
    var result = DataService.Followups.start(id);
    if (result.success) {
        Utils.showToast('随访任务已开始', 'success');
        this.render();
        DashboardPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.FollowupsPage.showAddProgressModal = function(followupId) {
    var followup = DataService.Followups.getById(followupId);
    if (!followup) return;

    var today = Utils.getTodayString();

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">随访任务</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${followup.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">责任人</div>
                    <div class="detail-item-value">${followup.assignedToName || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">风险等级</div>
                    <div class="detail-item-value">
                        <span class="badge ${Utils.getRiskBadgeClass(followup.riskLevel)}">
                            ${DataService.Constants.RISK_LABELS[followup.riskLevel]}
                        </span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">已随访次数</div>
                    <div class="detail-item-value">${followup.progress.length} 次</div>
                </div>
            </div>
        </div>

        <form id="progressForm" style="margin-top: 1rem;">
            <input type="hidden" name="followupId" value="${followupId}">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 随访日期</label>
                    <input type="date" class="form-input" name="date" value="${today}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">随访方式</label>
                    <select class="form-select" name="method">
                        <option value="home">上门随访</option>
                        <option value="phone">电话随访</option>
                        <option value="clinic">门诊随访</option>
                        <option value="other">其他</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">本次收缩压 (mmHg)</label>
                    <input type="number" class="form-input" name="systolic" min="40" max="300" placeholder="如: 135" oninput="FollowupsPage.updateProgressRiskPreview()">
                </div>
                <div class="form-group">
                    <label class="form-label">本次舒张压 (mmHg)</label>
                    <input type="number" class="form-input" name="diastolic" min="30" max="200" placeholder="如: 85" oninput="FollowupsPage.updateProgressRiskPreview()">
                </div>
                <div class="form-group">
                    <label class="form-label">心率 (次/分)</label>
                    <input type="number" class="form-input" name="heartRate" min="30" max="200" placeholder="如: 78">
                </div>
            </div>
            <div id="progressRiskPreview" class="chart-card" style="padding: 1rem; margin-bottom: 1rem; display: none;">
                <strong>本次血压风险：</strong><span id="progressRiskPreviewValue"></span>
            </div>
            <div class="form-group">
                <label class="form-label">随访内容</label>
                <textarea class="form-textarea" name="content" placeholder="请输入本次随访内容..." rows="3"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">健康指导</label>
                <textarea class="form-textarea" name="guidance" placeholder="请输入健康指导建议..." rows="2"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">下次随访日期</label>
                <input type="date" class="form-input" name="nextDate">
            </div>
            <div class="form-group">
                <label class="form-label">操作人</label>
                <input type="text" class="form-input" name="operator" placeholder="请输入操作人姓名">
            </div>
            <div class="form-group">
                <label class="form-label">随访结论</label>
                <select class="form-select" name="conclusion">
                    <option value="">继续随访</option>
                    <option value="complete">血压控制达标，完成随访</option>
                    <option value="escalate">需转诊至上级医院</option>
                </select>
            </div>
        </form>
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="FollowupsPage.submitProgress()">提交随访记录</button>
    `;

    Utils.openModal(content, { title: '添加随访记录', large: true, footer });
};

window.FollowupsPage.updateProgressRiskPreview = function() {
    var form = document.getElementById('progressForm');
    if (!form) return;

    var systolic = parseInt(form.systolic.value) || 0;
    var diastolic = parseInt(form.diastolic.value) || 0;
    var followupId = form.followupId.value;

    var preview = document.getElementById('progressRiskPreview');
    var previewValue = document.getElementById('progressRiskPreviewValue');

    if (systolic > 0 && diastolic > 0) {
        var followup = DataService.Followups.getById(followupId);
        var resident = followup ? DataService.Residents.getById(followup.residentId) : null;
        var age = resident ? DataService.Utils.calculateAge(resident.birthDate) : null;
        var hasHistory = resident ? resident.hasHypertensionHistory : false;

        var riskLevel = DataService.Utils.calculateRiskLevel(systolic, diastolic, age, hasHistory);
        var riskLabel = DataService.Constants.RISK_LABELS[riskLevel];
        var riskClass = Utils.getRiskBadgeClass(riskLevel);

        preview.style.display = 'block';
        var extraText = riskLevel === 'normal' 
            ? ' <span style="color: #27ae60; margin-left: 0.5rem;">✓ 控制达标</span>'
            : ' <span style="color: #e74c3c; margin-left: 0.5rem;">⚠ 仍需调整</span>';
        previewValue.innerHTML = '<span class="badge ' + riskClass + '" style="font-size: 0.9rem; padding: 0.3rem 0.75rem;">' + riskLabel + '</span>' + extraText;
    } else {
        preview.style.display = 'none';
    }
};

window.FollowupsPage.submitProgress = function() {
    var form = document.getElementById('progressForm');
    if (!Utils.validateForm(form)) return;

    var data = Utils.getFormData(form);
    var progress = {
        date: data.date,
        method: data.method,
        systolic: data.systolic ? parseInt(data.systolic) : null,
        diastolic: data.diastolic ? parseInt(data.diastolic) : null,
        heartRate: data.heartRate ? parseInt(data.heartRate) : null,
        content: data.content,
        guidance: data.guidance,
        nextDate: data.nextDate,
        operator: data.operator
    };

    var result;
    if (data.conclusion === 'complete') {
        result = DataService.Followups.complete(data.followupId, progress, data.operator);
    } else if (data.conclusion === 'escalate') {
        result = DataService.Followups.escalate(data.followupId, progress, data.operator);
    } else {
        result = DataService.Followups.addProgress(data.followupId, progress);
    }

    if (result.success) {
        Utils.closeModal();
        if (data.conclusion === 'complete') {
            Utils.showToast('随访完成，案件已结案', 'success');
        } else if (data.conclusion === 'escalate') {
            Utils.showToast('已标记为需转诊，请及时上报', 'warning');
        } else {
            Utils.showToast('随访记录已添加', 'success');
        }
        this.render();
        DashboardPage.render();
        RetestsPage.render();
        ScreeningsPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.FollowupsPage.showDetail = function(id) {
    var followup = DataService.Followups.getById(id);
    if (!followup) return;

    var resident = DataService.Residents.getById(followup.residentId);
    var retest = followup.retestId ? DataService.Retests.getById(followup.retestId) : null;

    var riskClass = Utils.getRiskBadgeClass(followup.riskLevel);
    var riskLabel = DataService.Constants.RISK_LABELS[followup.riskLevel];
    var statusClass = Utils.getStatusBadgeClass(followup.status, 'followup');
    var statusLabel = DataService.Constants.FOLLOWUP_STATUS_LABELS[followup.status];
    var priorityClass = followup.priority === 'high' ? 'badge badge-high-risk' : followup.priority === 'low' ? 'badge badge-normal' : 'badge badge-medium-risk';
    var priorityLabel = followup.priority === 'high' ? '高优先级' : followup.priority === 'low' ? '低优先级' : '中优先级';

    var progressHtml = '';
    if (followup.progress.length > 0) {
        var progressItems = followup.progress.slice().reverse().map(function(p) {
            var methodLabels = { home: '上门随访', phone: '电话随访', clinic: '门诊随访', other: '其他' };
            var bp = p.systolic && p.diastolic ? p.systolic + '/' + p.diastolic + ' mmHg' : '-';
            return '<div class="timeline-item"><div class="timeline-item-header"><div class="timeline-item-title">' + (methodLabels[p.method] || '随访记录') + ' - 血压: ' + bp + '</div><div class="timeline-item-time">' + DataService.Utils.formatDate(p.date) + '</div></div><div class="timeline-item-content">' + (p.content || '无记录') + (p.guidance ? '<br><small class="text-muted">指导: ' + p.guidance + '</small>' : '') + (p.operator ? '<br><small class="text-muted">操作人: ' + p.operator + '</small>' : '') + '</div></div>';
        }).join('');
        progressHtml = '<div class="detail-section"><h3 class="detail-section-title">随访记录 (' + followup.progress.length + ' 次)</h3><div class="timeline">' + progressItems + '</div></div>';
    }

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">随访任务</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${followup.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">责任人</div>
                    <div class="detail-item-value">${followup.assignedToName || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">风险等级</div>
                    <div class="detail-item-value">
                        <span class="badge ${riskClass}">${riskLabel}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">状态</div>
                    <div class="detail-item-value">
                        <span class="badge ${statusClass}">${statusLabel}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">优先级</div>
                    <div class="detail-item-value">
                        <span class="badge ${priorityClass}">${priorityLabel}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">计划随访日期</div>
                    <div class="detail-item-value">${followup.scheduledDate ? DataService.Utils.formatDate(followup.scheduledDate) : '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">分配人</div>
                    <div class="detail-item-value">${followup.assignedBy || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">创建时间</div>
                    <div class="detail-item-value">${DataService.Utils.formatDateTime(followup.createdAt)}</div>
                </div>
            </div>
        </div>

        ${retest ? `
            <div class="detail-section">
                <h3 class="detail-section-title">关联复测</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-item-label">复测血压</div>
                        <div class="detail-item-value">${retest.resultSystolic}/${retest.resultDiastolic} mmHg</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">复测时间</div>
                        <div class="detail-item-value">${DataService.Utils.formatDateTime(retest.completedAt)}</div>
                    </div>
                </div>
            </div>
        ` : ''}

        ${progressHtml}
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">关闭</button>
    `;

    Utils.openModal(content, { title: '随访详情', large: true, footer });
};
