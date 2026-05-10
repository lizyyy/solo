window.ScreeningsPage = {};
window.ScreeningsPage.currentFilters = { search: '', riskLevel: 'all', status: 'all' };
window.ScreeningsPage.currentPage = 1;
window.ScreeningsPage.pageSize = 10;

window.ScreeningsPage.render = function() {
    var self = this;
    var container = document.getElementById('page-screenings');
    var screenings = this.getFilteredScreenings();
    var stats = DataService.Screenings.getStatistics();

    container.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">筛查记录</h2>
            <div class="btn-group">
                <button class="btn btn-outline" onclick="ScreeningsPage.showImportModal()">📥 导入</button>
                <button class="btn btn-outline" onclick="DataService.Export.exportScreenings(); Utils.showToast('导出成功', 'success')">📤 导出</button>
                <button class="btn btn-primary" onclick="ScreeningsPage.showCreateModal()">+ 录入血压</button>
            </div>
        </div>

        <div class="stats-container" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card warning">
                <div class="stat-title">待复核</div>
                <div class="stat-value">${stats.statusCounts.pending_review}</div>
                <div class="stat-subtitle">今日 ${stats.todayCount} 条</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">需复测</div>
                <div class="stat-value">${stats.statusCounts.need_retest}</div>
                <div class="stat-subtitle">已创建复测 ${stats.retestsCreated}</div>
            </div>
            <div class="stat-card success">
                <div class="stat-title">已结案</div>
                <div class="stat-value">${stats.statusCounts.resolved}</div>
                <div class="stat-subtitle">无需跟进</div>
            </div>
            <div class="stat-card high-risk">
                <div class="stat-title">高危</div>
                <div class="stat-value">${stats.riskCounts.high}</div>
                <div class="stat-subtitle">需优先处理</div>
            </div>
        </div>

        <div class="filter-bar">
            <div class="filter-row">
                <div class="filter-group">
                    <label class="filter-label">搜索</label>
                    <input type="text" class="filter-input" placeholder="姓名/身份证" value="${this.currentFilters.search}" oninput="ScreeningsPage.handleSearch(this.value)">
                </div>
                <div class="filter-group">
                    <label class="filter-label">风险等级</label>
                    <select class="filter-select" onchange="ScreeningsPage.handleFilterChange('riskLevel', this.value)">
                        <option value="all" ${this.currentFilters.riskLevel === 'all' ? 'selected' : ''}>全部</option>
                        <option value="high" ${this.currentFilters.riskLevel === 'high' ? 'selected' : ''}>高危</option>
                        <option value="medium" ${this.currentFilters.riskLevel === 'medium' ? 'selected' : ''}>中危</option>
                        <option value="low" ${this.currentFilters.riskLevel === 'low' ? 'selected' : ''}>低危</option>
                        <option value="normal" ${this.currentFilters.riskLevel === 'normal' ? 'selected' : ''}>正常</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">状态</label>
                    <select class="filter-select" onchange="ScreeningsPage.handleFilterChange('status', this.value)">
                        <option value="all" ${this.currentFilters.status === 'all' ? 'selected' : ''}>全部</option>
                        <option value="pending_review" ${this.currentFilters.status === 'pending_review' ? 'selected' : ''}>待复核</option>
                        <option value="need_retest" ${this.currentFilters.status === 'need_retest' ? 'selected' : ''}>需复测</option>
                        <option value="resolved" ${this.currentFilters.status === 'resolved' ? 'selected' : ''}>已结案</option>
                    </select>
                </div>
            </div>
        </div>

        ${this.renderScreeningsTable(screenings)}
        ${this.renderPagination(screenings)}
    `;
};

window.ScreeningsPage.getFilteredScreenings = function() {
    var screenings = DataService.Screenings.getAll();
    
    if (this.currentFilters.search) {
        var q = this.currentFilters.search.toLowerCase();
        screenings = screenings.filter(function(s) { 
            return s.residentName.toLowerCase().includes(q) || 
                   s.idCard.toLowerCase().includes(q); 
        });
    }
    
    if (this.currentFilters.riskLevel !== 'all') {
        screenings = screenings.filter(function(s) { return s.riskLevel === this.currentFilters.riskLevel; }.bind(this));
    }
    
    if (this.currentFilters.status !== 'all') {
        screenings = screenings.filter(function(s) { return s.status === this.currentFilters.status; }.bind(this));
    }
    
    return screenings.sort(function(a, b) {
        if (a.status === 'pending_review' && b.status !== 'pending_review') return -1;
        if (a.status !== 'pending_review' && b.status === 'pending_review') return 1;
        return new Date(b.screeningTime) - new Date(a.screeningTime);
    });
};

window.ScreeningsPage.renderScreeningsTable = function(screenings) {
    if (screenings.length === 0) {
        return `
            <div class="table-container">
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">暂无筛查记录</div>
                    <div class="empty-state-hint">点击"录入血压"或导入筛查数据</div>
                </div>
            </div>
        `;
    }

    var startIndex = (this.currentPage - 1) * this.pageSize;
    var pageData = screenings.slice(startIndex, startIndex + this.pageSize);
    var self = this;

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>居民</th>
                        <th>血压</th>
                        <th>风险等级</th>
                        <th>筛查时间</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageData.map(function(s) { return self.renderScreeningRow(s); }).join('')}
                </tbody>
            </table>
        </div>
    `;
};

window.ScreeningsPage.renderScreeningRow = function(screening) {
    var riskClass = Utils.getRiskBadgeClass(screening.riskLevel);
    var riskLabel = DataService.Constants.RISK_LABELS[screening.riskLevel];
    var statusClass = Utils.getStatusBadgeClass(screening.status, 'screening');
    var statusLabel = DataService.Constants.SCREENING_STATUS_LABELS[screening.status];

    var actionButtons = '';
    if (screening.status === 'pending_review') {
        actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="ScreeningsPage.showReviewModal('${screening.id}')">复核</button>
        `;
    }
    
    if (screening.status === 'need_retest') {
        var existingRetest = DataService.Retests.getByScreeningId(screening.id);
        if (existingRetest.length === 0) {
            actionButtons += `<button class="btn btn-sm btn-warning" onclick="ScreeningsPage.showCreateRetestModal('${screening.id}')">创建复测</button>`;
        }
    }
    
    actionButtons += `
        <button class="btn btn-sm btn-outline" onclick="ScreeningsPage.showDetail('${screening.id}')">详情</button>
    `;

    return `
        <tr>
            <td>
                <strong>${Utils.escapeHtml(screening.residentName)}</strong><br>
                <small class="text-muted">${screening.idCard}</small>
            </td>
            <td>
                <span style="font-weight: 600;">${screening.systolic}/${screening.diastolic}</span> mmHg
                ${screening.heartRate ? '<br><small class="text-muted">心率 ' + screening.heartRate + ' 次/分</small>' : ''}
            </td>
            <td><span class="badge ${riskClass}">${riskLabel}</span></td>
            <td>
                ${DataService.Utils.formatDateTime(screening.screeningTime)}
                ${screening.location ? '<br><small class="text-muted">' + screening.location + '</small>' : ''}
            </td>
            <td><span class="badge ${statusClass}">${statusLabel}</span></td>
            <td class="action-cell">
                ${actionButtons}
            </td>
        </tr>
    `;
};

window.ScreeningsPage.renderPagination = function(screenings) {
    var totalPages = Math.ceil(screenings.length / this.pageSize);
    if (totalPages <= 1) return '';

    var startIndex = (this.currentPage - 1) * this.pageSize + 1;
    var endIndex = Math.min(this.currentPage * this.pageSize, screenings.length);

    var pageButtons = '';
    for (var i = 1; i <= totalPages; i++) {
        pageButtons += '<button class="pagination-btn ' + (i === this.currentPage ? 'active' : '') + '" onclick="ScreeningsPage.goToPage(' + i + ')">' + i + '</button>';
    }

    return `
        <div class="pagination">
            <button class="pagination-btn" onclick="ScreeningsPage.goToPage(1)" ${this.currentPage === 1 ? 'disabled' : ''}>«</button>
            <button class="pagination-btn" onclick="ScreeningsPage.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>
            ${pageButtons}
            <button class="pagination-btn" onclick="ScreeningsPage.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>›</button>
            <button class="pagination-btn" onclick="ScreeningsPage.goToPage(${totalPages})" ${this.currentPage === totalPages ? 'disabled' : ''}>»</button>
            <span class="pagination-info">${startIndex}-${endIndex} / ${screenings.length} 条</span>
        </div>
    `;
};

window.ScreeningsPage._searchTimeout = null;
window.ScreeningsPage.handleSearch = function(value) {
    var self = this;
    if (this._searchTimeout) clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(function() {
        self.currentFilters.search = value;
        self.currentPage = 1;
        self.render();
    }, 300);
};

window.ScreeningsPage.handleFilterChange = function(key, value) {
    this.currentFilters[key] = value;
    this.currentPage = 1;
    this.render();
};

window.ScreeningsPage.goToPage = function(page) {
    this.currentPage = page;
    this.render();
};

window.ScreeningsPage.showCreateModal = function() {
    var residents = DataService.Residents.getAll();
    var residentOptions = residents.map(function(r) {
        return '<option value="' + r.id + '" data-name="' + r.name + '" data-idcard="' + r.idCard + '" data-birthdate="' + r.birthDate + '" data-history="' + (r.hasHypertensionHistory ? '1' : '0') + '">' + r.name + ' - ' + r.idCard + '</option>';
    }).join('');

    var now = new Date();
    var nowStr = now.toISOString().slice(0, 16);

    var content = `
        <form id="createForm">
            <div class="form-group">
                <label class="form-label"><span class="required">*</span> 选择居民</label>
                <select class="form-select" name="residentId" required onchange="ScreeningsPage.updateResidentInfo()">
                    <option value="">请选择居民（如未建档请先在"居民档案"中添加）</option>
                    ${residentOptions}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 收缩压 (mmHg)</label>
                    <input type="number" class="form-input" name="systolic" required min="40" max="300" placeholder="如: 135" oninput="ScreeningsPage.updateRiskPreview()">
                </div>
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 舒张压 (mmHg)</label>
                    <input type="number" class="form-input" name="diastolic" required min="30" max="200" placeholder="如: 85" oninput="ScreeningsPage.updateRiskPreview()">
                </div>
                <div class="form-group">
                    <label class="form-label">心率 (次/分)</label>
                    <input type="number" class="form-input" name="heartRate" min="30" max="200" placeholder="如: 78">
                </div>
            </div>
            <div id="riskPreview" class="chart-card" style="padding: 1rem; margin-bottom: 1rem; display: none;">
                <strong>预估风险：</strong><span id="riskPreviewValue"></span>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 筛查时间</label>
                    <input type="datetime-local" class="form-input" name="screeningTime" value="${nowStr}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">筛查地点</label>
                    <input type="text" class="form-input" name="location" placeholder="如: 社区卫生服务中心">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">筛查人</label>
                <input type="text" class="form-input" name="operator" placeholder="请输入筛查人姓名">
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-textarea" name="notes" placeholder="特殊情况说明"></textarea>
            </div>
        </form>
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ScreeningsPage.submitCreate()">录入</button>
    `;

    Utils.openModal(content, { title: '录入血压', large: true, footer });
};

window.ScreeningsPage.updateResidentInfo = function() {
    var form = document.getElementById('createForm');
    if (!form) return;
    this.updateRiskPreview();
};

window.ScreeningsPage.updateRiskPreview = function() {
    var form = document.getElementById('createForm');
    if (!form) return;

    var systolic = parseInt(form.systolic.value) || 0;
    var diastolic = parseInt(form.diastolic.value) || 0;
    var residentSelect = form.residentId;

    var preview = document.getElementById('riskPreview');
    var previewValue = document.getElementById('riskPreviewValue');

    if (systolic > 0 && diastolic > 0) {
        var age = null;
        var hasHistory = false;
        
        if (residentSelect.value) {
            var option = residentSelect.options[residentSelect.selectedIndex];
            var birthDate = option.getAttribute('data-birthdate');
            if (birthDate) {
                age = DataService.Utils.calculateAge(birthDate);
            }
            hasHistory = option.getAttribute('data-history') === '1';
        }

        var riskLevel = DataService.Utils.calculateRiskLevel(systolic, diastolic, age, hasHistory);
        var riskLabel = DataService.Constants.RISK_LABELS[riskLevel];
        var riskClass = Utils.getRiskBadgeClass(riskLevel);

        preview.style.display = 'block';
        var extraText = riskLevel === 'normal' 
            ? ' <span style="color: #27ae60; margin-left: 0.5rem;">✓ 正常血压，提交后自动结案</span>'
            : ' <span style="color: #e74c3c; margin-left: 0.5rem;">⚠ 异常血压，需后续复核</span>';
        previewValue.innerHTML = '<span class="badge ' + riskClass + '" style="font-size: 0.9rem; padding: 0.3rem 0.75rem;">' + riskLabel + '</span>' + extraText;
    } else {
        preview.style.display = 'none';
    }
};

window.ScreeningsPage.submitCreate = function() {
    var form = document.getElementById('createForm');
    if (!Utils.validateForm(form)) return;

    var data = Utils.getFormData(form);
    var result = DataService.Screenings.create(data);

    if (result.success) {
        Utils.closeModal();
        
        var riskLevel = result.data.riskLevel;
        if (riskLevel === 'normal') {
            Utils.showToast('正常血压，已自动结案', 'success');
        } else {
            Utils.showToast('血压异常，请及时复核', 'warning');
        }
        
        this.render();
        DashboardPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.ScreeningsPage.showImportModal = function() {
    var content = `
        <div style="margin-bottom: 1rem;">
            <h4 style="margin-bottom: 0.5rem;">CSV导入说明</h4>
            <p class="text-muted" style="font-size: 0.875rem; margin-bottom: 0.5rem;">
                请确保CSV文件包含以下列：<strong>姓名,身份证号,收缩压,舒张压</strong><br>
                可选列：<strong>心率,筛查时间(YYYY-MM-DD HH:MM),筛查地点,筛查人,备注</strong>
            </p>
            <div class="alert alert-info" style="padding: 0.75rem; background: #e3f2fd; border-radius: 0.375rem; font-size: 0.875rem;">
                <strong>提示：</strong>居民必须已在"居民档案"中建档，匹配依据为身份证号。
            </div>
        </div>
        <input type="file" id="importFile" accept=".csv" style="width: 100%; padding: 0.5rem; border: 2px dashed #ddd; border-radius: 0.375rem;">
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ScreeningsPage.submitImport()">导入</button>
    `;

    Utils.openModal(content, { title: '导入筛查数据', large: true, footer });
};

window.ScreeningsPage.submitImport = function() {
    var fileInput = document.getElementById('importFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        Utils.showToast('请选择文件', 'warning');
        return;
    }

    var file = fileInput.files[0];
    var self = this;
    Utils.parseCSV(file, function(rows) {
        var results = DataService.Screenings.importFromCSV(rows);
        
        Utils.closeModal();
        
        if (results.errors.length > 0) {
            Utils.showToast('部分导入失败，请检查数据格式', 'warning');
            console.error('Import errors:', results.errors);
        } else {
            Utils.showToast('成功导入 ' + results.imported + ' 条记录', 'success');
        }
        
        self.render();
        DashboardPage.render();
        ResidentsPage.render();
    });
};

window.ScreeningsPage.showReviewModal = function(id) {
    var screening = DataService.Screenings.getById(id);
    if (!screening) return;

    var resident = DataService.Residents.getById(screening.residentId);
    var riskClass = Utils.getRiskBadgeClass(screening.riskLevel);
    var riskLabel = DataService.Constants.RISK_LABELS[screening.riskLevel];

    var actionText = screening.riskLevel === 'low' ? '建议复测确认' : 
                    screening.riskLevel === 'medium' ? '需复测后评估' : 
                    screening.riskLevel === 'high' ? '高危，建议立即复测并转诊' : 
                    '正常血压';

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">筛查信息</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${screening.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">身份证</div>
                    <div class="detail-item-value">${screening.idCard}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">血压</div>
                    <div class="detail-item-value" style="font-weight: 600;">${screening.systolic}/${screening.diastolic} mmHg</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">心率</div>
                    <div class="detail-item-value">${screening.heartRate ? screening.heartRate + ' 次/分' : '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">风险等级</div>
                    <div class="detail-item-value">
                        <span class="badge ${riskClass}">${riskLabel}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">筛查时间</div>
                    <div class="detail-item-value">${DataService.Utils.formatDateTime(screening.screeningTime)}</div>
                </div>
            </div>
        </div>

        <div class="alert alert-warning" style="padding: 1rem; background: #fff3cd; border-radius: 0.375rem; margin-top: 1rem;">
            <strong>系统建议：</strong>${actionText}
        </div>

        <div class="detail-section" style="margin-top: 1rem;">
            <h3 class="detail-section-title">复核操作</h3>
            <div class="form-group">
                <label class="form-label">复核人</label>
                <input type="text" id="reviewOperator" class="form-input" placeholder="请输入复核人姓名">
            </div>
            <div class="form-group">
                <label class="form-label">复核备注</label>
                <textarea id="reviewNotes" class="form-textarea" placeholder="复核情况说明"></textarea>
            </div>
        </div>
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
        ${screening.riskLevel === 'normal' ? 
            '<button class="btn btn-success" onclick="ScreeningsPage.confirmReviewAsNormal(\'' + id + '\')">✓ 确认正常结案</button>' :
            '<button class="btn btn-success" onclick="ScreeningsPage.confirmReviewAsNormal(\'' + id + '\')">✓ 确认正常</button>' +
            '<button class="btn btn-warning" onclick="ScreeningsPage.confirmReviewAsAbnormal(\'' + id + '\')">⚠ 需复测</button>'
        }
    `;

    Utils.openModal(content, { title: '复核筛查结果', large: true, footer });
};

window.ScreeningsPage.confirmReviewAsNormal = function(id) {
    var operator = document.getElementById('reviewOperator').value;
    var notes = document.getElementById('reviewNotes').value;
    
    var result = DataService.Screenings.confirmAsNormal(id, notes, operator);
    if (result.success) {
        Utils.closeModal();
        Utils.showToast('已确认正常，案件结案', 'success');
        this.render();
        DashboardPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.ScreeningsPage.confirmReviewAsAbnormal = function(id) {
    var operator = document.getElementById('reviewOperator').value;
    var notes = document.getElementById('reviewNotes').value;
    
    var result = DataService.Screenings.confirmAsAbnormal(id, notes, operator);
    if (result.success) {
        Utils.closeModal();
        Utils.showToast('已标记需复测，请尽快创建复测任务', 'warning');
        this.render();
        DashboardPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.ScreeningsPage.showCreateRetestModal = function(screeningId) {
    var screening = DataService.Screenings.getById(screeningId);
    if (!screening) return;

    var tomorrow = Utils.addDays(Utils.getTodayString(), 1);

    var riskClass = Utils.getRiskBadgeClass(screening.riskLevel);
    var riskLabel = DataService.Constants.RISK_LABELS[screening.riskLevel];

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">原筛查信息</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${screening.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">原血压</div>
                    <div class="detail-item-value">${screening.systolic}/${screening.diastolic} mmHg</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">风险等级</div>
                    <div class="detail-item-value">
                        <span class="badge ${riskClass}">${riskLabel}</span>
                    </div>
                </div>
            </div>
        </div>

        <form id="retestForm" style="margin-top: 1rem;">
            <input type="hidden" name="screeningId" value="${screeningId}">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span> 计划复测日期</label>
                    <input type="date" class="form-input" name="scheduledDate" value="${tomorrow}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">计划复测时间</label>
                    <input type="time" class="form-input" name="scheduledTime">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">复测地点</label>
                <input type="text" class="form-input" name="location" placeholder="如: 社区卫生服务中心">
            </div>
            <div class="form-group">
                <label class="form-label">负责人</label>
                <input type="text" class="form-input" name="operator" placeholder="请输入负责人姓名">
            </div>
            <div class="form-group">
                <label class="form-label">复测要求</label>
                <textarea class="form-textarea" name="notes" placeholder="复测注意事项"></textarea>
            </div>
        </form>
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ScreeningsPage.submitRetest()">创建复测任务</button>
    `;

    Utils.openModal(content, { title: '创建复测任务', large: true, footer });
};

window.ScreeningsPage.submitRetest = function() {
    var form = document.getElementById('retestForm');
    if (!Utils.validateForm(form)) return;

    var data = Utils.getFormData(form);
    var result = DataService.Retests.create(data);

    if (result.success) {
        Utils.closeModal();
        Utils.showToast('复测任务已创建', 'success');
        this.render();
        DashboardPage.render();
        RetestsPage.render();
    } else {
        Utils.showToast(result.error, 'error');
    }
};

window.ScreeningsPage.showDetail = function(id) {
    var screening = DataService.Screenings.getById(id);
    if (!screening) return;

    var resident = DataService.Residents.getById(screening.residentId);
    var retests = DataService.Retests.getByScreeningId(id);

    var riskClass = Utils.getRiskBadgeClass(screening.riskLevel);
    var riskLabel = DataService.Constants.RISK_LABELS[screening.riskLevel];
    var statusClass = Utils.getStatusBadgeClass(screening.status, 'screening');
    var statusLabel = DataService.Constants.SCREENING_STATUS_LABELS[screening.status];

    var timelineHtml = '';
    if (screening.reviewNotes || screening.reviewedBy) {
        timelineHtml = '<div class="timeline-item"><div class="timeline-item-header"><div class="timeline-item-title">复核完成</div><div class="timeline-item-time">' + (screening.reviewedAt ? DataService.Utils.formatDateTime(screening.reviewedAt) : '') + '</div></div><div class="timeline-item-content">' + (screening.reviewedBy ? '复核人: ' + screening.reviewedBy : '') + (screening.reviewNotes ? '<br>' + screening.reviewNotes : '') + '</div></div>';
    }
    timelineHtml = '<div class="timeline-item"><div class="timeline-item-header"><div class="timeline-item-title">血压录入</div><div class="timeline-item-time">' + DataService.Utils.formatDateTime(screening.screeningTime) + '</div></div><div class="timeline-item-content">血压: ' + screening.systolic + '/' + screening.diastolic + ' mmHg' + (screening.heartRate ? '，心率: ' + screening.heartRate + ' 次/分' : '') + (screening.operator ? '，录入人: ' + screening.operator : '') + '</div></div>' + timelineHtml;

    var retestHtml = '';
    if (retests.length > 0) {
        var retestItems = retests.map(function(r) {
            return '<div class="timeline-item ' + (r.status === 'normal' ? 'success' : r.status === 'still_abnormal' ? 'danger' : '') + '"><div class="timeline-item-header"><div class="timeline-item-title">复测: ' + DataService.Constants.RETEST_STATUS_LABELS[r.status] + '</div><div class="timeline-item-time">' + DataService.Utils.formatDateTime(r.createdAt) + '</div></div><div class="timeline-item-content">计划日期: ' + DataService.Utils.formatDate(r.scheduledDate) + (r.status !== 'pending' ? '<br>复测血压: ' + r.resultSystolic + '/' + r.resultDiastolic + ' mmHg' : '') + '</div></div>';
        }).join('');
        retestHtml = '<div class="detail-section"><h3 class="detail-section-title">复测记录</h3><div class="timeline">' + retestItems + '</div></div>';
    }

    var content = `
        <div class="detail-section">
            <h3 class="detail-section-title">筛查记录</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-item-label">居民</div>
                    <div class="detail-item-value">${screening.residentName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">身份证</div>
                    <div class="detail-item-value">${screening.idCard}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">血压</div>
                    <div class="detail-item-value" style="font-weight: 600;">${screening.systolic}/${screening.diastolic} mmHg</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">心率</div>
                    <div class="detail-item-value">${screening.heartRate ? screening.heartRate + ' 次/分' : '-'}</div>
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
                    <div class="detail-item-label">筛查时间</div>
                    <div class="detail-item-value">${DataService.Utils.formatDateTime(screening.screeningTime)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">筛查地点</div>
                    <div class="detail-item-value">${screening.location || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-item-label">筛查人</div>
                    <div class="detail-item-value">${screening.operator || '-'}</div>
                </div>
                ${screening.notes ? '<div class="detail-item" style="grid-column: span 2;"><div class="detail-item-label">备注</div><div class="detail-item-value">' + screening.notes + '</div></div>' : ''}
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">流程时间线</h3>
            <div class="timeline">
                ${timelineHtml}
            </div>
        </div>

        ${retestHtml}
    `;

    var footer = `
        <button class="btn btn-secondary" onclick="Utils.closeModal()">关闭</button>
    `;

    Utils.openModal(content, { title: '筛查详情', large: true, footer });
};
