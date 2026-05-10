(function() {
    window.ResidentsPage = {};
    window.ResidentsPage.currentFilters = {
        search: '',
        hasHistory: 'all',
        community: 'all'
    };
    window.ResidentsPage.currentPage = 1;
    window.ResidentsPage.pageSize = 10;
    window.ResidentsPage.importData = null;

    window.ResidentsPage.render = function() {
        const self = this;
        const container = document.getElementById('page-residents');
        const residents = this.getFilteredResidents();
        const communities = this.getCommunities();

        container.innerHTML = `
            <div class="page-header">
                <h2 class="page-title">居民档案</h2>
                <div class="btn-group">
                    <button class="btn btn-outline" onclick="ResidentsPage.showImportModal()">📥 导入</button>
                    <button class="btn btn-outline" onclick="DataService.Export.exportResidents(); Utils.showToast('导出成功', 'success')">📤 导出</button>
                    <button class="btn btn-primary" onclick="ResidentsPage.showCreateModal()">+ 新建居民</button>
                </div>
            </div>

            <div class="filter-bar">
                <div class="filter-row">
                    <div class="filter-group">
                        <label class="filter-label">搜索</label>
                        <input type="text" class="filter-input" placeholder="姓名/身份证/电话" 
                               value="${this.currentFilters.search}"
                               oninput="ResidentsPage.handleSearch(this.value)">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">高血压史</label>
                        <select class="filter-select" onchange="ResidentsPage.handleFilterChange('hasHistory', this.value)">
                            <option value="all" ${this.currentFilters.hasHistory === 'all' ? 'selected' : ''}>全部</option>
                            <option value="true" ${this.currentFilters.hasHistory === 'true' ? 'selected' : ''}>有病史</option>
                            <option value="false" ${this.currentFilters.hasHistory === 'false' ? 'selected' : ''}>无病史</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">社区</label>
                        <select class="filter-select" onchange="ResidentsPage.handleFilterChange('community', this.value)">
                            <option value="all" ${this.currentFilters.community === 'all' ? 'selected' : ''}>全部</option>
                            ${communities.map(function(c) { return '<option value="' + c + '" ' + (self.currentFilters.community === c ? 'selected' : '') + '>' + c + '</option>'; }).join('')}
                        </select>
                    </div>
                </div>
            </div>

            ${this.renderResidentsTable(residents)}
            ${this.renderPagination(residents)}
        `;
    };

    window.ResidentsPage.getFilteredResidents = function() {
        let residents = DataService.Residents.getAll();
        
        if (this.currentFilters.search) {
            const q = this.currentFilters.search.toLowerCase();
            residents = residents.filter(function(r) {
                return r.name.toLowerCase().includes(q) ||
                       (r.idCard && r.idCard.includes(q)) ||
                       (r.phone && r.phone.includes(q));
            });
        }
        
        if (this.currentFilters.hasHistory !== 'all') {
            const hasHistory = this.currentFilters.hasHistory === 'true';
            residents = residents.filter(function(r) { return r.hasHypertensionHistory === hasHistory; });
        }
        
        if (this.currentFilters.community !== 'all') {
            const community = this.currentFilters.community;
            residents = residents.filter(function(r) { return r.community === community; });
        }
        
        return residents.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    };

    window.ResidentsPage.getCommunities = function() {
        const communities = new Set();
        DataService.Residents.getAll().forEach(function(r) {
            if (r.community) communities.add(r.community);
        });
        return Array.from(communities);
    };

    window.ResidentsPage.renderResidentsTable = function(residents) {
        if (residents.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div class="empty-state-text">暂无居民档案</div>
                        <div class="empty-state-hint">点击"新建居民"开始录入，或使用"导入"批量导入</div>
                    </div>
                </div>
            `;
        }

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const pageData = residents.slice(startIndex, startIndex + this.pageSize);

        return `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>姓名</th>
                            <th>性别</th>
                            <th>年龄</th>
                            <th>身份证号</th>
                            <th>联系电话</th>
                            <th>社区</th>
                            <th>高血压史</th>
                            <th>建档时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageData.map(function(r) { return window.ResidentsPage.renderResidentRow(r); }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    window.ResidentsPage.renderResidentRow = function(resident) {
        const age = DataService.Utils.calculateAge(resident.birthDate);
        
        return `
            <tr>
                <td><strong>${Utils.escapeHtml(resident.name)}</strong></td>
                <td>${resident.gender === 'male' ? '男' : resident.gender === 'female' ? '女' : '-'}</td>
                <td>${age !== null ? age + '岁' : '-'}</td>
                <td>${resident.idCard ? this.maskIdCard(resident.idCard) : '-'}</td>
                <td>${resident.phone || '-'}</td>
                <td>${resident.community || '-'}</td>
                <td>
                    <span class="badge ${resident.hasHypertensionHistory ? 'badge-warning' : 'badge-success'}">
                        ${resident.hasHypertensionHistory ? '有' : '无'}
                    </span>
                </td>
                <td>${DataService.Utils.formatDate(resident.createdAt)}</td>
                <td class="action-cell">
                    <button class="btn btn-sm btn-outline" onclick="ResidentsPage.showDetail('${resident.id}')">详情</button>
                    <button class="btn btn-sm btn-primary" onclick="ResidentsPage.showEditModal('${resident.id}')">编辑</button>
                </td>
            </tr>
        `;
    };

    window.ResidentsPage.maskIdCard = function(idCard) {
        if (!idCard || idCard.length < 8) return idCard;
        return idCard.substr(0, 4) + '********' + idCard.substr(-4);
    };

    window.ResidentsPage.renderPagination = function(residents) {
        const totalPages = Math.ceil(residents.length / this.pageSize);
        if (totalPages <= 1) return '';

        const startIndex = (this.currentPage - 1) * this.pageSize + 1;
        const endIndex = Math.min(this.currentPage * this.pageSize, residents.length);

        let pageButtons = '';
        for (let i = 1; i <= totalPages; i++) {
            pageButtons += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="ResidentsPage.goToPage(${i})">${i}</button>
            `;
        }

        return `
            <div class="pagination">
                <button class="pagination-btn" onclick="ResidentsPage.goToPage(1)" ${this.currentPage === 1 ? 'disabled' : ''}>«</button>
                <button class="pagination-btn" onclick="ResidentsPage.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>‹</button>
                ${pageButtons}
                <button class="pagination-btn" onclick="ResidentsPage.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>›</button>
                <button class="pagination-btn" onclick="ResidentsPage.goToPage(${totalPages})" ${this.currentPage === totalPages ? 'disabled' : ''}>»</button>
                <span class="pagination-info">${startIndex}-${endIndex} / ${residents.length} 条</span>
            </div>
        `;
    };

    window.ResidentsPage._searchTimeout = null;
    window.ResidentsPage.handleSearch = function(value) {
        const self = this;
        if (this._searchTimeout) clearTimeout(this._searchTimeout);
        this._searchTimeout = setTimeout(function() {
            self.currentFilters.search = value;
            self.currentPage = 1;
            self.render();
        }, 300);
    };

    window.ResidentsPage.handleFilterChange = function(key, value) {
        this.currentFilters[key] = value;
        this.currentPage = 1;
        this.render();
    };

    window.ResidentsPage.goToPage = function(page) {
        this.currentPage = page;
        this.render();
    };

    window.ResidentsPage.showCreateModal = function() {
        const content = `
            <form id="residentForm">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 姓名</label>
                        <input type="text" class="form-input" name="name" required placeholder="请输入姓名">
                    </div>
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 性别</label>
                        <select class="form-select" name="gender" required>
                            <option value="">请选择</option>
                            <option value="male">男</option>
                            <option value="female">女</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 身份证号</label>
                        <input type="text" class="form-input" name="idCard" required maxlength="18" placeholder="18位身份证号">
                    </div>
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 出生日期</label>
                        <input type="date" class="form-input" name="birthDate" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">联系电话</label>
                        <input type="tel" class="form-input" name="phone" placeholder="请输入联系电话">
                    </div>
                    <div class="form-group">
                        <label class="form-label">社区</label>
                        <input type="text" class="form-input" name="community" placeholder="所属社区">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">家庭住址</label>
                    <input type="text" class="form-input" name="address" placeholder="详细住址">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">高血压病史</label>
                        <select class="form-select" name="hasHypertensionHistory">
                            <option value="false">无</option>
                            <option value="true">有</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">糖尿病史</label>
                        <select class="form-select" name="hasDiabetes">
                            <option value="false">无</option>
                            <option value="true">有</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">其他慢性病</label>
                    <input type="text" class="form-input" name="hasOtherChronic" placeholder="如有，请说明">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">紧急联系人</label>
                        <input type="text" class="form-input" name="emergencyContact" placeholder="联系人姓名">
                    </div>
                    <div class="form-group">
                        <label class="form-label">紧急联系电话</label>
                        <input type="tel" class="form-input" name="emergencyPhone" placeholder="联系电话">
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
            <button class="btn btn-primary" onclick="ResidentsPage.submitResident()">保存</button>
        `;

        Utils.openModal(content, { title: '新建居民档案', large: true, footer });
    };

    window.ResidentsPage.showEditModal = function(id) {
        const resident = DataService.Residents.getById(id);
        if (!resident) return;

        const content = `
            <form id="residentForm">
                <input type="hidden" name="id" value="${resident.id}">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 姓名</label>
                        <input type="text" class="form-input" name="name" required value="${Utils.escapeHtml(resident.name)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 性别</label>
                        <select class="form-select" name="gender" required>
                            <option value="">请选择</option>
                            <option value="male" ${resident.gender === 'male' ? 'selected' : ''}>男</option>
                            <option value="female" ${resident.gender === 'female' ? 'selected' : ''}>女</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 身份证号</label>
                        <input type="text" class="form-input" name="idCard" required maxlength="18" value="${resident.idCard || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> 出生日期</label>
                        <input type="date" class="form-input" name="birthDate" required value="${resident.birthDate ? resident.birthDate.split('T')[0] : ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">联系电话</label>
                        <input type="tel" class="form-input" name="phone" value="${resident.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">社区</label>
                        <input type="text" class="form-input" name="community" value="${resident.community || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">家庭住址</label>
                    <input type="text" class="form-input" name="address" value="${resident.address || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">高血压病史</label>
                        <select class="form-select" name="hasHypertensionHistory">
                            <option value="false" ${!resident.hasHypertensionHistory ? 'selected' : ''}>无</option>
                            <option value="true" ${resident.hasHypertensionHistory ? 'selected' : ''}>有</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">糖尿病史</label>
                        <select class="form-select" name="hasDiabetes">
                            <option value="false" ${!resident.hasDiabetes ? 'selected' : ''}>无</option>
                            <option value="true" ${resident.hasDiabetes ? 'selected' : ''}>有</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">其他慢性病</label>
                    <input type="text" class="form-input" name="hasOtherChronic" value="${resident.hasOtherChronic || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">紧急联系人</label>
                        <input type="text" class="form-input" name="emergencyContact" value="${resident.emergencyContact || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">紧急联系电话</label>
                        <input type="tel" class="form-input" name="emergencyPhone" value="${resident.emergencyPhone || ''}">
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
            <button class="btn btn-primary" onclick="ResidentsPage.submitResident()">保存</button>
        `;

        Utils.openModal(content, { title: '编辑居民档案', large: true, footer });
    };

    window.ResidentsPage.submitResident = function() {
        const form = document.getElementById('residentForm');
        if (!Utils.validateForm(form)) return;

        const data = Utils.getFormData(form);
        
        let result;
        if (data.id) {
            result = DataService.Residents.update(data.id, data);
        } else {
            result = DataService.Residents.create(data);
        }

        if (result.success) {
            Utils.closeModal();
            Utils.showToast(data.id ? '居民档案已更新' : '居民档案已创建', 'success');
            this.render();
            DashboardPage.render();
        } else {
            Utils.showToast(result.error, 'error');
        }
    };

    window.ResidentsPage.showDetail = function(id) {
        const resident = DataService.Residents.getById(id);
        if (!resident) return;

        const age = DataService.Utils.calculateAge(resident.birthDate);
        const screenings = DataService.Screenings.getByResidentId(id);
        const retests = DataService.Retests.getByResidentId(id);
        const followups = DataService.Followups.getByResidentId(id);

        const content = `
            <div class="detail-section">
                <h3 class="detail-section-title">基本信息</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-item-label">姓名</div>
                        <div class="detail-item-value">${Utils.escapeHtml(resident.name)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">性别</div>
                        <div class="detail-item-value">${resident.gender === 'male' ? '男' : resident.gender === 'female' ? '女' : '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">年龄</div>
                        <div class="detail-item-value">${age !== null ? age + '岁' : '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">身份证号</div>
                        <div class="detail-item-value">${resident.idCard || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">联系电话</div>
                        <div class="detail-item-value">${resident.phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">社区</div>
                        <div class="detail-item-value">${resident.community || '-'}</div>
                    </div>
                    <div class="detail-item" style="grid-column: span 2;">
                        <div class="detail-item-label">家庭住址</div>
                        <div class="detail-item-value">${resident.address || '-'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3 class="detail-section-title">健康信息</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-item-label">高血压病史</div>
                        <div class="detail-item-value">
                            <span class="badge ${resident.hasHypertensionHistory ? 'badge-warning' : 'badge-success'}">
                                ${resident.hasHypertensionHistory ? '有' : '无'}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">糖尿病史</div>
                        <div class="detail-item-value">
                            <span class="badge ${resident.hasDiabetes ? 'badge-warning' : 'badge-success'}">
                                ${resident.hasDiabetes ? '有' : '无'}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">其他慢性病</div>
                        <div class="detail-item-value">${resident.hasOtherChronic || '无'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item-label">紧急联系人</div>
                        <div class="detail-item-value">${resident.emergencyContact || '-'} ${resident.emergencyPhone || ''}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3 class="detail-section-title">筛查记录 (${screenings.length})</h3>
                ${screenings.length === 0 ? `
                    <div class="empty-state" style="padding: 1.5rem;">
                        <div class="empty-state-text">暂无筛查记录</div>
                    </div>
                ` : `
                    <div class="table-container">
                        <table class="data-table" style="font-size: 0.85rem;">
                            <thead>
                                <tr>
                                    <th>筛查时间</th>
                                    <th>血压</th>
                                    <th>风险等级</th>
                                    <th>状态</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${screenings.slice(0, 5).map(function(s) {
                                    return '<tr><td>' + DataService.Utils.formatDateTime(s.screeningTime) + '</td><td>' + s.systolic + '/' + s.diastolic + '</td><td><span class="badge ' + Utils.getRiskBadgeClass(s.riskLevel) + '">' + DataService.Constants.RISK_LABELS[s.riskLevel] + '</span></td><td><span class="badge ' + Utils.getStatusBadgeClass(s.status, 'screening') + '">' + DataService.Constants.SCREENING_STATUS_LABELS[s.status] + '</span></td></tr>';
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <div class="detail-section">
                <h3 class="detail-section-title">活动轨迹</h3>
                <div class="timeline">
                    ${this.renderTimeline(resident, screenings, retests, followups)}
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Utils.closeModal()">关闭</button>
            <button class="btn btn-primary" onclick="Utils.closeModal(); ResidentsPage.showEditModal('${id}')">编辑档案</button>
        `;

        Utils.openModal(content, { title: '居民详情', large: true, footer });
    };

    window.ResidentsPage.renderTimeline = function(resident, screenings, retests, followups) {
        const events = [
            {
                type: 'create',
                time: resident.createdAt,
                title: '建档',
                content: '居民档案创建成功',
                className: 'success'
            }
        ];

        screenings.forEach(function(s) {
            events.push({
                type: 'screening',
                time: s.screeningTime,
                title: '血压筛查',
                content: '血压 ' + s.systolic + '/' + s.diastolic + ' mmHg，' + DataService.Constants.RISK_LABELS[s.riskLevel],
                className: s.riskLevel === 'high' ? 'danger' : s.riskLevel === 'medium' ? 'warning' : ''
            });
        });

        retests.forEach(function(r) {
            events.push({
                type: 'retest',
                time: r.createdAt,
                title: r.status === 'pending' ? '创建复测' : '完成复测',
                content: r.status === 'pending' 
                    ? '计划复测时间：' + DataService.Utils.formatDate(r.scheduledDate)
                    : '复测结果 ' + r.resultSystolic + '/' + r.resultDiastolic + ' mmHg，' + DataService.Constants.RETEST_STATUS_LABELS[r.status],
                className: r.status === 'still_abnormal' ? 'danger' : r.status === 'normal' ? 'success' : ''
            });
        });

        followups.forEach(function(f) {
            events.push({
                type: 'followup',
                time: f.createdAt,
                title: '随访任务',
                content: '责任人：' + (f.assignedToName || '未指定') + '，' + DataService.Constants.FOLLOWUP_STATUS_LABELS[f.status],
                className: f.status === 'escalated' ? 'danger' : f.status === 'completed' ? 'success' : ''
            });
        });

        events.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

        if (events.length === 0) {
            return '<div class="empty-state"><div class="empty-state-text">暂无活动记录</div></div>';
        }

        return events.slice(0, 10).map(function(e) {
            return '<div class="timeline-item ' + e.className + '"><div class="timeline-item-header"><div class="timeline-item-title">' + e.title + '</div><div class="timeline-item-time">' + DataService.Utils.formatDateTime(e.time) + '</div></div><div class="timeline-item-content">' + e.content + '</div></div>';
        }).join('');
    };

    window.ResidentsPage.showImportModal = function() {
        const content = `
            <div class="file-upload" id="fileUpload">
                <div class="file-upload-icon">📄</div>
                <div class="file-upload-text">点击或拖拽CSV文件到此处上传</div>
                <input type="file" id="csvFile" accept=".csv" style="display: none" onchange="ResidentsPage.handleFileSelect(this)">
                <button class="btn btn-primary" onclick="document.getElementById('csvFile').click()">选择文件</button>
            </div>
            <div class="form-hint">
                <p style="margin-top: 1rem;"><strong>CSV格式要求：</strong></p>
                <p>表头列：姓名,性别,身份证号,出生日期,联系电话,社区,家庭住址,高血压病史,糖尿病史,其他慢性病,紧急联系人,紧急联系电话</p>
                <p>性别：male/female；病史：true/false</p>
            </div>
            <div id="importPreview" style="display: none; margin-top: 1rem;"></div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
            <button class="btn btn-primary" id="importBtn" style="display: none" onclick="ResidentsPage.confirmImport()">确认导入</button>
        `;

        Utils.openModal(content, { title: '导入居民档案', large: true, footer });
        const self = this;

        setTimeout(function() {
            const uploadArea = document.getElementById('fileUpload');
            if (uploadArea) {
                uploadArea.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    uploadArea.classList.add('dragover');
                });
                uploadArea.addEventListener('dragleave', function() {
                    uploadArea.classList.remove('dragover');
                });
                uploadArea.addEventListener('drop', function(e) {
                    e.preventDefault();
                    uploadArea.classList.remove('dragover');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        self.processFile(files[0]);
                    }
                });
            }
        }, 100);
    };

    window.ResidentsPage.handleFileSelect = function(input) {
        if (input.files.length > 0) {
            this.processFile(input.files[0]);
        }
    };

    window.ResidentsPage.processFile = function(file) {
        const self = this;
        if (!file.name.endsWith('.csv')) {
            Utils.showToast('请上传CSV格式文件', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = Utils.parseCSV(e.target.result);
                if (data.length === 0) {
                    Utils.showToast('文件内容为空', 'error');
                    return;
                }

                self.importData = data.map(function(row) {
                    return {
                        name: row['姓名'] || row.name || '',
                        gender: ((row['性别'] || row.gender || '').toLowerCase() === '女' ? 'female' : 'male'),
                        idCard: row['身份证号'] || row.idCard || '',
                        birthDate: row['出生日期'] || row.birthDate || '',
                        phone: row['联系电话'] || row.phone || '',
                        community: row['社区'] || row.community || '',
                        address: row['家庭住址'] || row.address || '',
                        hasHypertensionHistory: ((row['高血压病史'] || row.hasHypertensionHistory || '') === 'true' || (row['高血压病史'] || row.hasHypertensionHistory) === '是'),
                        hasDiabetes: ((row['糖尿病史'] || row.hasDiabetes || '') === 'true' || (row['糖尿病史'] || row.hasDiabetes) === '是'),
                        hasOtherChronic: row['其他慢性病'] || row.hasOtherChronic || '',
                        emergencyContact: row['紧急联系人'] || row.emergencyContact || '',
                        emergencyPhone: row['紧急联系电话'] || row.emergencyPhone || ''
                    };
                }).filter(function(r) { return r.name && r.idCard; });

                const preview = document.getElementById('importPreview');
                const importBtn = document.getElementById('importBtn');
                
                preview.style.display = 'block';
                preview.innerHTML = `
                    <div class="chart-card" style="padding: 1rem;">
                        <p><strong>待导入记录：</strong>${self.importData.length} 条</p>
                        <p style="color: #666; font-size: 0.85rem;">
                            系统将自动跳过重复身份证号的记录
                        </p>
                    </div>
                `;
                
                if (importBtn) importBtn.style.display = 'inline-flex';
            } catch (error) {
                Utils.showToast('文件解析失败：' + error.message, 'error');
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    window.ResidentsPage.confirmImport = function() {
        if (!this.importData || this.importData.length === 0) return;

        const results = DataService.Residents.batchImport(this.importData);
        
        Utils.closeModal();
        
        let message = '成功导入 ' + results.success.length + ' 条';
        if (results.duplicates.length > 0) {
            message += '，跳过重复 ' + results.duplicates.length + ' 条';
        }
        if (results.failed.length > 0) {
            message += '，失败 ' + results.failed.length + ' 条';
        }
        
        Utils.showToast(message, results.success.length > 0 ? 'success' : 'error');
        this.render();
        DashboardPage.render();
        this.importData = null;
    };
})();
