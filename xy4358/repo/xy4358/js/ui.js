const UI = {
    currentDate: null,
    currentShift: null,

    init: function() {
        this.bindTabEvents();
        this.bindModalEvents();
        this.bindHeaderEvents();
        this.bindImportEvents();
        this.bindExportEvents();
        this.bindShiftEvents();
        this.initDateSelectors();
        this.refreshAll();
    },

    bindTabEvents: function() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });
    },

    switchTab: function(tabName) {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        tabPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `${tabName}-tab`) {
                panel.classList.add('active');
            }
        });

        this.refreshTabContent(tabName);
    },

    refreshTabContent: function(tabName) {
        switch (tabName) {
            case 'pets':
                this.renderPetsTable();
                break;
            case 'medications':
                this.renderMedicationsTable();
                break;
            case 'shifts':
                this.renderShiftContent();
                break;
            case 'feedings':
                this.renderFeedingRecords();
                break;
            case 'alerts':
                this.renderAlerts();
                break;
            case 'export':
                this.renderDataSummary();
                break;
        }
    },

    refreshAll: function() {
        Validators.runAllChecks();
        this.renderPetsTable();
        this.renderMedicationsTable();
        this.renderFeedingRecords();
        this.renderAlerts();
        this.renderDataSummary();
        this.updateImportStatus();
    },

    bindModalEvents: function() {
        const modal = document.getElementById('modal');
        const closeBtn = document.querySelector('.close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    },

    openModal: function(title, content) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        if (modalTitle) {
            modalTitle.textContent = title;
        }
        if (modalBody) {
            modalBody.innerHTML = content;
        }
        if (modal) {
            modal.classList.add('show');
        }
    },

    closeModal: function() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('show');
        }
    },

    bindHeaderEvents: function() {
        const exportMdBtn = document.getElementById('exportMdBtn');
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const exportJsonBtn = document.getElementById('exportJsonBtn');

        if (exportMdBtn) {
            exportMdBtn.addEventListener('click', () => {
                DataExport.downloadMarkdown({
                    includeSummary: true,
                    includeFeedings: true,
                    includeAlerts: true,
                    includeNotes: true
                });
            });
        }

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                DataExport.downloadCSV({
                    includeDose: true,
                    includeAllergy: true,
                    includeCage: true,
                    includeMissed: true,
                    includeObservations: true
                });
            });
        }

        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                DataExport.downloadJSON({
                    includePets: true,
                    includeMedications: true,
                    includeFeedings: true,
                    includeAlerts: true,
                    includeShifts: true
                });
            });
        }
    },

    bindImportEvents: function() {
        const addPetBtn = document.getElementById('addPetBtn');
        if (addPetBtn) {
            addPetBtn.addEventListener('click', () => {
                this.showAddPetModal();
            });
        }

        const addMedicationBtn = document.getElementById('addMedicationBtn');
        if (addMedicationBtn) {
            addMedicationBtn.addEventListener('click', () => {
                this.showAddMedicationModal();
            });
        }
    },

    bindExportEvents: function() {
        const downloadMdBtn = document.getElementById('downloadMdBtn');
        const downloadCsvBtn = document.getElementById('downloadCsvBtn');
        const downloadJsonBtn = document.getElementById('downloadJsonBtn');

        if (downloadMdBtn) {
            downloadMdBtn.addEventListener('click', () => {
                const options = {
                    includeSummary: document.getElementById('mdIncludeSummary')?.checked ?? true,
                    includeFeedings: document.getElementById('mdIncludeFeedings')?.checked ?? true,
                    includeAlerts: document.getElementById('mdIncludeAlerts')?.checked ?? true,
                    includeNotes: document.getElementById('mdIncludeNotes')?.checked ?? true
                };
                DataExport.downloadMarkdown(options);
            });
        }

        if (downloadCsvBtn) {
            downloadCsvBtn.addEventListener('click', () => {
                const options = {
                    includeDose: document.getElementById('csvIncludeDose')?.checked ?? true,
                    includeAllergy: document.getElementById('csvIncludeAllergy')?.checked ?? true,
                    includeCage: document.getElementById('csvIncludeCage')?.checked ?? true,
                    includeMissed: document.getElementById('csvIncludeMissed')?.checked ?? true,
                    includeObservations: document.getElementById('csvIncludeObservations')?.checked ?? true
                };
                DataExport.downloadCSV(options);
            });
        }

        if (downloadJsonBtn) {
            downloadJsonBtn.addEventListener('click', () => {
                const options = {
                    includePets: document.getElementById('jsonIncludePets')?.checked ?? true,
                    includeMedications: document.getElementById('jsonIncludeMedications')?.checked ?? true,
                    includeFeedings: document.getElementById('jsonIncludeFeedings')?.checked ?? true,
                    includeAlerts: document.getElementById('jsonIncludeAlerts')?.checked ?? true,
                    includeShifts: document.getElementById('jsonIncludeShifts')?.checked ?? true
                };
                DataExport.downloadJSON(options);
            });
        }
    },

    bindShiftEvents: function() {
        const loadShiftBtn = document.getElementById('loadShiftBtn');
        const completeShiftBtn = document.getElementById('completeShiftBtn');

        if (loadShiftBtn) {
            loadShiftBtn.addEventListener('click', () => {
                this.loadCurrentShift();
            });
        }

        if (completeShiftBtn) {
            completeShiftBtn.addEventListener('click', () => {
                this.completeShift();
            });
        }
    },

    initDateSelectors: function() {
        const today = Utils.getToday();
        this.currentDate = today;
        this.currentShift = 'morning';

        const dateSelect = document.getElementById('dateSelect');
        const feedingDateFilter = document.getElementById('feedingDateFilter');

        this.populateDateSelect(dateSelect);
        this.populateDateSelect(feedingDateFilter);

        if (dateSelect) {
            dateSelect.value = today;
        }
    },

    populateDateSelect: function(selectElement) {
        if (!selectElement) return;

        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">选择日期</option>';

        const dates = Storage.getAvailableDates();
        
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            if (date === currentValue) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    },

    loadCurrentShift: function() {
        const dateSelect = document.getElementById('dateSelect');
        const shiftSelect = document.getElementById('shiftSelect');

        this.currentDate = dateSelect?.value || Utils.getToday();
        this.currentShift = shiftSelect?.value || 'morning';

        this.renderShiftContent();
        Utils.showNotification(`已加载 ${this.currentDate} ${Utils.getShiftName(this.currentShift)}`, 'info');
    },

    renderShiftContent: function() {
        const date = this.currentDate || Utils.getToday();
        const shift = this.currentShift || 'morning';

        const plans = Storage.getMedicationPlansByDateAndShift(date, shift);
        const records = Storage.getFeedingRecordsByDateAndShift(date, shift);

        const recordMap = {};
        records.forEach(record => {
            if (record.planId) {
                recordMap[record.planId] = record;
            }
        });

        const shiftSummary = document.getElementById('shiftSummary');
        if (shiftSummary) {
            const total = plans.length;
            const completed = records.filter(r => r.status === 'completed').length;
            const pending = total - completed;
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

            shiftSummary.innerHTML = `
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="label">总任务数</div>
                        <div class="value">${total}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">已完成</div>
                        <div class="value" style="color: var(--success-color)">${completed}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">待完成</div>
                        <div class="value" style="color: var(--warning-color)">${pending}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">完成率</div>
                        <div class="value">${percentage}%</div>
                    </div>
                </div>
            `;
        }

        const container = document.getElementById('shiftTasksContainer');
        if (!container) return;

        if (plans.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📋</div>
                    <p>当前班次没有喂药计划</p>
                </div>
            `;
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>宠物名</th>
                        <th>药品</th>
                        <th>剂量</th>
                        <th>计划时间</th>
                        <th>风险等级</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        plans.forEach(plan => {
            const record = recordMap[plan.id];
            const riskInfo = Validators.checkRiskLevel(plan.id);
            const riskLevel = plan.riskOverride?.level || riskInfo.level;
            const riskClass = this.getRiskClass(riskLevel);
            const riskText = this.getRiskText(riskLevel);

            let status = '待喂';
            let statusClass = 'status-pending';
            let administeredBy = '-';
            let administeredAt = '-';

            if (record) {
                switch (record.status) {
                    case 'completed':
                        status = '已喂';
                        statusClass = 'status-completed';
                        administeredBy = record.administeredBy || '-';
                        administeredAt = record.administeredAt || '-';
                        break;
                    case 'missed':
                        status = '漏喂';
                        statusClass = 'status-missed';
                        break;
                }
            }

            html += `
                <tr data-plan-id="${plan.id}">
                    <td>${plan.petName}</td>
                    <td>${plan.medicationName}</td>
                    <td>${plan.dose}${plan.unit}</td>
                    <td>${plan.time || '-'}</td>
                    <td>
                        <span class="status-badge ${riskClass}" onclick="UI.showRiskDetail('${plan.id}')" style="cursor: pointer;" title="点击查看详情">
                            ${riskText}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${status}</span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                            <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;" 
                                    onclick="UI.showFeedingModal('${plan.id}')">
                                ${record ? '编辑' : '记录'}
                            </button>
                            <button class="btn btn-warning" style="padding: 4px 8px; font-size: 12px;"
                                    onclick="UI.showRiskOverrideModal('${plan.id}')">
                                改判风险
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    },

    showFeedingModal: function(planId) {
        const plans = Storage.getMedicationPlans();
        const plan = plans.find(p => p.id === planId);
        
        if (!plan) {
            Utils.showNotification('找不到喂药计划', 'danger');
            return;
        }

        const records = Storage.getFeedingRecordsByPlanId(planId);
        const latestRecord = records.length > 0 ? records[records.length - 1] : null;

        const content = `
            <form id="feedingForm">
                <div class="form-group">
                    <label>宠物名</label>
                    <input type="text" value="${plan.petName}" readonly class="form-control">
                </div>
                <div class="form-group">
                    <label>药品名称</label>
                    <input type="text" value="${plan.medicationName}" readonly class="form-control">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>计划剂量</label>
                        <input type="text" value="${plan.dose}${plan.unit}" readonly class="form-control">
                    </div>
                    <div class="form-group">
                        <label>实际剂量</label>
                        <input type="number" id="actualDose" value="${latestRecord?.actualDose || plan.dose}" 
                               step="0.01" class="form-control" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>状态</label>
                        <select id="feedingStatus" class="form-control">
                            <option value="pending" ${latestRecord?.status === 'pending' ? 'selected' : ''}>待喂</option>
                            <option value="completed" ${!latestRecord || latestRecord?.status === 'completed' ? 'selected' : ''}>已喂</option>
                            <option value="missed" ${latestRecord?.status === 'missed' ? 'selected' : ''}>漏喂</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>执行人</label>
                        <input type="text" id="administeredBy" value="${latestRecord?.administeredBy || ''}" 
                               placeholder="请输入执行人姓名" class="form-control">
                    </div>
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea id="feedingNotes" class="form-control" 
                              placeholder="请输入喂药备注...">${latestRecord?.notes || ''}</textarea>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn btn-primary">保存记录</button>
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">取消</button>
                </div>
            </form>
        `;

        this.openModal('喂药记录', content);

        setTimeout(() => {
            const form = document.getElementById('feedingForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveFeedingRecord(planId);
                });
            }
        }, 100);
    },

    saveFeedingRecord: function(planId) {
        const plans = Storage.getMedicationPlans();
        const plan = plans.find(p => p.id === planId);
        
        if (!plan) {
            Utils.showNotification('找不到喂药计划', 'danger');
            return;
        }

        const actualDose = parseFloat(document.getElementById('actualDose')?.value);
        const status = document.getElementById('feedingStatus')?.value || 'completed';
        const administeredBy = document.getElementById('administeredBy')?.value || '';
        const notes = document.getElementById('feedingNotes')?.value || '';

        if (isNaN(actualDose)) {
            Utils.showNotification('请输入有效的实际剂量', 'danger');
            return;
        }

        const record = {
            planId: planId,
            petId: plan.petId,
            petName: plan.petName,
            medicationName: plan.medicationName,
            dose: plan.dose,
            actualDose: actualDose,
            unit: plan.unit,
            date: this.currentDate || Utils.getToday(),
            shift: this.currentShift || 'morning',
            status: status,
            administeredBy: administeredBy,
            administeredAt: status === 'completed' ? Utils.formatDateTime(new Date()) : null,
            notes: notes
        };

        Storage.addFeedingRecord(record);
        this.closeModal();
        this.renderShiftContent();
        this.renderFeedingRecords();
        Validators.runAllChecks();
        this.renderAlerts();
        Utils.showNotification('喂药记录已保存', 'success');
    },

    showRiskDetail: function(planId) {
        const riskInfo = Validators.checkRiskLevel(planId);
        const plans = Storage.getMedicationPlans();
        const plan = plans.find(p => p.id === planId);

        if (!plan) return;

        const riskLevel = plan.riskOverride?.level || riskInfo.level;
        const riskText = this.getRiskText(riskLevel);

        let reasonsHtml = '';
        if (riskInfo.reasons && riskInfo.reasons.length > 0) {
            reasonsHtml = '<ul>';
            riskInfo.reasons.forEach(reason => {
                reasonsHtml += `<li>${reason}</li>`;
            });
            reasonsHtml += '</ul>';
        } else {
            reasonsHtml = '<p>暂无风险原因</p>';
        }

        let overrideHtml = '';
        if (plan.riskOverride) {
            overrideHtml = `
                <div style="background: var(--bg-color); padding: 10px; border-radius: var(--border-radius); margin-top: 15px;">
                    <p><strong>人工改判:</strong> ${this.getRiskText(plan.riskOverride.level)}</p>
                    <p><strong>改判原因:</strong> ${plan.riskOverride.reason || '-'}</p>
                    <p><strong>改判时间:</strong> ${plan.riskOverride.overriddenAt}</p>
                </div>
            `;
        }

        const content = `
            <div>
                <h4 style="margin-bottom: 10px;">宠物: ${plan.petName} | 药品: ${plan.medicationName}</h4>
                <p><strong>风险等级:</strong> 
                    <span class="status-badge ${this.getRiskClass(riskLevel)}">${riskText}</span>
                </p>
                <h5 style="margin: 15px 0 10px;">风险原因:</h5>
                ${reasonsHtml}
                ${overrideHtml}
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-warning" onclick="UI.showRiskOverrideModal('${planId}')">改判风险</button>
                    <button class="btn btn-secondary" onclick="UI.closeModal()">关闭</button>
                </div>
            </div>
        `;

        this.openModal('风险详情', content);
    },

    showRiskOverrideModal: function(planId) {
        const plans = Storage.getMedicationPlans();
        const plan = plans.find(p => p.id === planId);

        if (!plan) return;

        const currentLevel = plan.riskOverride?.level || '';

        const content = `
            <form id="riskOverrideForm">
                <div class="form-group">
                    <label>宠物名</label>
                    <input type="text" value="${plan.petName}" readonly class="form-control">
                </div>
                <div class="form-group">
                    <label>药品名称</label>
                    <input type="text" value="${plan.medicationName}" readonly class="form-control">
                </div>
                <div class="form-group">
                    <label>改判风险等级</label>
                    <select id="newRiskLevel" class="form-control" required>
                        <option value="" ${!currentLevel ? 'selected' : ''}>请选择</option>
                        <option value="low" ${currentLevel === 'low' ? 'selected' : ''}>低风险</option>
                        <option value="normal" ${currentLevel === 'normal' ? 'selected' : ''}>正常</option>
                        <option value="medium" ${currentLevel === 'medium' ? 'selected' : ''}>中等风险</option>
                        <option value="high" ${currentLevel === 'high' ? 'selected' : ''}>高风险</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>改判原因</label>
                    <textarea id="riskOverrideReason" class="form-control" 
                              placeholder="请输入改判原因...">${plan.riskOverride?.reason || ''}</textarea>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn btn-primary">确认改判</button>
                    <button type="button" class="btn btn-danger" onclick="UI.clearRiskOverride('${planId}')">清除改判</button>
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">取消</button>
                </div>
            </form>
        `;

        this.openModal('改判风险等级', content);

        setTimeout(() => {
            const form = document.getElementById('riskOverrideForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveRiskOverride(planId);
                });
            }
        }, 100);
    },

    saveRiskOverride: function(planId) {
        const newLevel = document.getElementById('newRiskLevel')?.value;
        const reason = document.getElementById('riskOverrideReason')?.value || '';

        if (!newLevel) {
            Utils.showNotification('请选择风险等级', 'danger');
            return;
        }

        Validators.updateRiskLevel(planId, newLevel, reason);
        this.closeModal();
        this.renderShiftContent();
        this.renderAlerts();
        Utils.showNotification('风险等级已更新', 'success');
    },

    clearRiskOverride: function(planId) {
        const plans = Storage.getMedicationPlans();
        const index = plans.findIndex(p => p.id === planId);
        
        if (index !== -1) {
            delete plans[index].riskOverride;
            plans[index].updatedAt = Utils.formatDateTime(new Date());
            Storage.saveMedicationPlans(plans);
        }

        this.closeModal();
        this.renderShiftContent();
        this.renderAlerts();
        Utils.showNotification('已清除人工改判', 'success');
    },

    completeShift: function() {
        const date = this.currentDate || Utils.getToday();
        const shift = this.currentShift || 'morning';
        const shiftName = Utils.getShiftName(shift);

        const plans = Storage.getMedicationPlansByDateAndShift(date, shift);
        const records = Storage.getFeedingRecordsByDateAndShift(date, shift);

        const completedPlanIds = new Set();
        records.forEach(r => {
            if (r.planId && r.status === 'completed') {
                completedPlanIds.add(r.planId);
            }
        });

        const pendingPlans = plans.filter(p => !completedPlanIds.has(p.id));

        if (pendingPlans.length > 0) {
            const petNames = pendingPlans.map(p => p.petName).join('、');
            const confirmed = confirm(`以下宠物的喂药计划尚未完成:\n${petNames}\n\n确定要结束班次吗？未完成的计划将标记为漏喂。`);
            
            if (!confirmed) return;

            pendingPlans.forEach(plan => {
                const record = {
                    planId: plan.id,
                    petId: plan.petId,
                    petName: plan.petName,
                    medicationName: plan.medicationName,
                    dose: plan.dose,
                    unit: plan.unit,
                    date: date,
                    shift: shift,
                    status: 'missed',
                    notes: `班次结束时未完成，自动标记为漏喂`
                };
                Storage.addFeedingRecord(record);
            });
        }

        const existingShift = Storage.getShiftByDateAndShift(date, shift);
        if (existingShift) {
            Storage.updateShift(existingShift.id, {
                status: 'completed',
                completedAt: Utils.formatDateTime(new Date()),
                completedBy: 'system'
            });
        } else {
            Storage.addShift({
                date: date,
                shift: shift,
                status: 'completed',
                completedAt: Utils.formatDateTime(new Date()),
                completedBy: 'system'
            });
        }

        Validators.runAllChecks();
        this.renderShiftContent();
        this.renderFeedingRecords();
        this.renderAlerts();
        Utils.showNotification(`${date} ${shiftName} 已完成复核`, 'success');
    },

    getRiskClass: function(level) {
        const classMap = {
            'low': 'status-info',
            'normal': 'status-completed',
            'medium': 'status-warning',
            'high': 'status-danger'
        };
        return classMap[level] || 'status-info';
    },

    getRiskText: function(level) {
        const textMap = {
            'low': '低风险',
            'normal': '正常',
            'medium': '中等风险',
            'high': '高风险'
        };
        return textMap[level] || '未知';
    },

    renderPetsTable: function() {
        const container = document.getElementById('petsTableContainer');
        if (!container) return;

        const pets = Storage.getPets();

        if (pets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🐾</div>
                    <p>暂无宠物数据，请先导入寄养协议</p>
                </div>
            `;
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>宠物ID</th>
                        <th>宠物名</th>
                        <th>品种</th>
                        <th>性别</th>
                        <th>体重(kg)</th>
                        <th>过敏史</th>
                        <th>笼位号</th>
                        <th>入住日期</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        pets.forEach(pet => {
            const allergiesText = (pet.allergies && pet.allergies.length > 0) 
                ? pet.allergies.join('、') 
                : '-';

            html += `
                <tr data-pet-id="${pet.id}">
                    <td>${pet.petId}</td>
                    <td>${pet.petName}</td>
                    <td>${pet.breed || pet.species || '-'}</td>
                    <td>${pet.gender || '-'}</td>
                    <td>${pet.weight || '-'}</td>
                    <td>${allergiesText}</td>
                    <td>${pet.cageNumber || '-'}</td>
                    <td>${pet.checkInDate || '-'}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;"
                                    onclick="UI.editPet('${pet.id}')">编辑</button>
                            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;"
                                    onclick="UI.deletePet('${pet.id}')">删除</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    },

    renderMedicationsTable: function() {
        const container = document.getElementById('medicationsTableContainer');
        if (!container) return;

        const medications = Storage.getMedications();

        if (medications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">💊</div>
                    <p>暂无药品数据</p>
                </div>
            `;
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>药品名称</th>
                        <th>分类</th>
                        <th>单位</th>
                        <th>推荐剂量/公斤</th>
                        <th>最小剂量</th>
                        <th>最大剂量</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        medications.forEach(med => {
            html += `
                <tr data-med-id="${med.id}">
                    <td>${med.name}</td>
                    <td>${med.category || '-'}</td>
                    <td>${med.unit || '-'}</td>
                    <td>${med.defaultDose || '-'}</td>
                    <td>${med.minDose || '-'}</td>
                    <td>${med.maxDose || '-'}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;"
                                    onclick="UI.editMedication('${med.id}')">编辑</button>
                            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;"
                                    onclick="UI.deleteMedication('${med.id}')">删除</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    },

    renderFeedingRecords: function() {
        const container = document.getElementById('feedingsTableContainer');
        if (!container) return;

        const dateFilter = document.getElementById('feedingDateFilter')?.value;
        const shiftFilter = document.getElementById('feedingShiftFilter')?.value;
        const statusFilter = document.getElementById('feedingStatusFilter')?.value;

        let records = Storage.getFeedingRecords();

        if (dateFilter) {
            records = records.filter(r => r.date === dateFilter);
        }
        if (shiftFilter) {
            records = records.filter(r => r.shift === shiftFilter);
        }
        if (statusFilter) {
            records = records.filter(r => r.status === statusFilter);
        }

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📝</div>
                    <p>暂无喂药记录</p>
                </div>
            `;
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>班次</th>
                        <th>宠物名</th>
                        <th>药品</th>
                        <th>计划剂量</th>
                        <th>实际剂量</th>
                        <th>状态</th>
                        <th>执行人</th>
                        <th>执行时间</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
        `;

        records.sort((a, b) => {
            const dateCompare = (b.date || '').localeCompare(a.date || '');
            if (dateCompare !== 0) return dateCompare;
            
            const shiftOrder = { 'morning': 0, 'afternoon': 1, 'evening': 2 };
            return (shiftOrder[b.shift] || 0) - (shiftOrder[a.shift] || 0);
        });

        records.forEach(record => {
            const statusClass = Utils.getStatusClass(record.status);
            const statusText = Utils.getStatusName(record.status);

            html += `
                <tr>
                    <td>${record.date || '-'}</td>
                    <td>${Utils.getShiftName(record.shift)}</td>
                    <td>${record.petName || '-'}</td>
                    <td>${record.medicationName || '-'}</td>
                    <td>${record.dose ? record.dose + (record.unit || '') : '-'}</td>
                    <td>${record.actualDose ? record.actualDose + (record.unit || '') : '-'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${record.administeredBy || '-'}</td>
                    <td>${record.administeredAt || '-'}</td>
                    <td>${record.notes || '-'}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

        const feedingDateFilter = document.getElementById('feedingDateFilter');
        if (feedingDateFilter) {
            feedingDateFilter.addEventListener('change', () => {
                this.renderFeedingRecords();
            });
        }

        const feedingShiftFilter = document.getElementById('feedingShiftFilter');
        if (feedingShiftFilter) {
            feedingShiftFilter.addEventListener('change', () => {
                this.renderFeedingRecords();
            });
        }

        const feedingStatusFilter = document.getElementById('feedingStatusFilter');
        if (feedingStatusFilter) {
            feedingStatusFilter.addEventListener('change', () => {
                this.renderFeedingRecords();
            });
        }
    },

    renderAlerts: function() {
        const alerts = Storage.getAlerts();

        const alertStats = document.getElementById('alertStats');
        if (alertStats) {
            const totalDanger = [
                ...(alerts.doseWarnings || []).filter(w => w.severity === 'danger'),
                ...(alerts.allergyWarnings || []).filter(w => w.severity === 'danger'),
                ...(alerts.cageConflicts || []).filter(c => c.severity === 'danger'),
                ...(alerts.missedFeedings || []).filter(m => m.severity === 'danger')
            ].length;

            const totalWarning = [
                ...(alerts.doseWarnings || []).filter(w => w.severity !== 'danger'),
                ...(alerts.allergyWarnings || []).filter(w => w.severity !== 'danger'),
                ...(alerts.cageConflicts || []).filter(c => c.severity !== 'danger'),
                ...(alerts.missedFeedings || []).filter(m => m.severity !== 'danger')
            ].length;

            const totalInfo = (alerts.openObservations || []).length;

            alertStats.innerHTML = `
                <div class="alert-stat danger">
                    <span class="count">${totalDanger}</span>
                    <div>
                        <div class="label">高风险</div>
                    </div>
                </div>
                <div class="alert-stat warning">
                    <span class="count">${totalWarning}</span>
                    <div>
                        <div class="label">警告</div>
                    </div>
                </div>
                <div class="alert-stat info">
                    <span class="count">${totalInfo}</span>
                    <div>
                        <div class="label">未闭环观察</div>
                    </div>
                </div>
            `;
        }

        this.renderAlertCategory('doseAlertsContainer', alerts.doseWarnings || []);
        this.renderAlertCategory('allergyAlertsContainer', alerts.allergyWarnings || []);
        this.renderAlertCategory('cageAlertsContainer', alerts.cageConflicts || []);
        this.renderAlertCategory('missedAlertsContainer', alerts.missedFeedings || []);
        this.renderAlertCategory('observationAlertsContainer', alerts.openObservations || []);
    },

    renderAlertCategory: function(containerId, alerts) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>✅ 暂无此类异常</p>
                </div>
            `;
            return;
        }

        let html = '';
        alerts.forEach(alert => {
            const severityClass = alert.severity === 'danger' ? 'danger' : 
                                 alert.severity === 'warning' ? 'warning' : 'info';

            html += `
                <div class="alert-item ${severityClass}">
                    <h4>${alert.petName || alert.cageNumber || '未知'}</h4>
                    <p>${alert.message || '-'}</p>
                    <p style="font-size: 12px; color: var(--text-secondary);">
                        ${alert.createdAt || ''}
                    </p>
                    <div class="actions">
                        ${alert.planId ? `<button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;"
                            onclick="UI.jumpToPlan('${alert.planId}')">查看计划</button>` : ''}
                        <button class="btn btn-success" style="padding: 4px 8px; font-size: 12px;"
                            onclick="UI.markAlertResolved('${containerId}', '${alert.id}')">标记已处理</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    jumpToPlan: function(planId) {
        const plans = Storage.getMedicationPlans();
        const plan = plans.find(p => p.id === planId);

        if (plan) {
            this.currentDate = plan.date;
            this.currentShift = plan.shift;

            const dateSelect = document.getElementById('dateSelect');
            const shiftSelect = document.getElementById('shiftSelect');

            if (dateSelect) {
                this.populateDateSelect(dateSelect);
                dateSelect.value = plan.date;
            }
            if (shiftSelect) {
                shiftSelect.value = plan.shift;
            }

            this.switchTab('shifts');
            Utils.showNotification('已跳转到对应班次', 'info');
        }
    },

    markAlertResolved: function(containerId, alertId) {
        Utils.showNotification('该功能需手动处理相关风险后刷新', 'info');
    },

    renderDataSummary: function() {
        const container = document.getElementById('dataSummary');
        if (!container) return;

        let summary;
        try {
            if (typeof DataExport !== 'undefined' && DataExport.getDataSummary) {
                summary = DataExport.getDataSummary();
            } else {
                summary = this.getFallbackDataSummary();
            }
        } catch (e) {
            console.error('获取数据概览失败:', e);
            summary = this.getFallbackDataSummary();
        }

        container.innerHTML = `
            <h3>📊 数据概览</h3>
            <div class="summary-grid" style="margin: 15px 0;">
                <div class="summary-item">
                    <div class="label">${summary.pets.label}</div>
                    <div class="value">${summary.pets.count}</div>
                </div>
                <div class="summary-item">
                    <div class="label">${summary.medications.label}</div>
                    <div class="value">${summary.medications.count}</div>
                </div>
                <div class="summary-item">
                    <div class="label">${summary.plans.label}</div>
                    <div class="value">${summary.plans.count}</div>
                </div>
                <div class="summary-item">
                    <div class="label">${summary.records.label}</div>
                    <div class="value">${summary.records.count}</div>
                </div>
            </div>
            
            <h4 style="margin-top: 20px;">今日喂药进度</h4>
            <div class="summary-grid" style="margin: 15px 0;">
                <div class="summary-item">
                    <div class="label">今日计划</div>
                    <div class="value">${summary.today.plans}</div>
                </div>
                <div class="summary-item">
                    <div class="label">已完成</div>
                    <div class="value" style="color: var(--success-color)">${summary.today.completed}</div>
                </div>
                <div class="summary-item">
                    <div class="label">待完成</div>
                    <div class="value" style="color: var(--warning-color)">${summary.today.pending}</div>
                </div>
            </div>
            
            <h4 style="margin-top: 20px;">⚠️ 异常提醒</h4>
            <div class="summary-grid" style="margin: 15px 0;">
                <div class="summary-item">
                    <div class="label">剂量超重</div>
                    <div class="value" style="color: ${summary.alerts.dose > 0 ? 'var(--danger-color)' : 'var(--text-secondary)'}">${summary.alerts.dose}</div>
                </div>
                <div class="summary-item">
                    <div class="label">过敏禁忌</div>
                    <div class="value" style="color: ${summary.alerts.allergy > 0 ? 'var(--danger-color)' : 'var(--text-secondary)'}">${summary.alerts.allergy}</div>
                </div>
                <div class="summary-item">
                    <div class="label">同笼冲突</div>
                    <div class="value" style="color: ${summary.alerts.cage > 0 ? 'var(--warning-color)' : 'var(--text-secondary)'}">${summary.alerts.cage}</div>
                </div>
                <div class="summary-item">
                    <div class="label">漏喂提醒</div>
                    <div class="value" style="color: ${summary.alerts.missed > 0 ? 'var(--danger-color)' : 'var(--text-secondary)'}">${summary.alerts.missed}</div>
                </div>
                <div class="summary-item">
                    <div class="label">未闭环观察</div>
                    <div class="value" style="color: ${summary.alerts.openObservations > 0 ? 'var(--warning-color)' : 'var(--text-secondary)'}">${summary.alerts.openObservations}</div>
                </div>
            </div>
        `;
    },

    showAddPetModal: function() {
        const content = `
            <form id="addPetForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>宠物ID *</label>
                        <input type="text" id="newPetId" class="form-control" placeholder="例如: P001" required>
                    </div>
                    <div class="form-group">
                        <label>宠物名 *</label>
                        <input type="text" id="newPetName" class="form-control" placeholder="例如: 小白" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>主人姓名</label>
                        <input type="text" id="newOwnerName" class="form-control" placeholder="例如: 张三">
                    </div>
                    <div class="form-group">
                        <label>联系电话</label>
                        <input type="tel" id="newOwnerPhone" class="form-control" placeholder="例如: 13800138000">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>物种</label>
                        <select id="newSpecies" class="form-control">
                            <option value="">请选择</option>
                            <option value="狗">狗</option>
                            <option value="猫">猫</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>品种</label>
                        <input type="text" id="newBreed" class="form-control" placeholder="例如: 金毛">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>性别</label>
                        <select id="newGender" class="form-control">
                            <option value="">请选择</option>
                            <option value="公">公</option>
                            <option value="母">母</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>体重(kg)</label>
                        <input type="number" id="newWeight" class="form-control" placeholder="例如: 5.5" step="0.1">
                    </div>
                </div>
                <div class="form-group">
                    <label>过敏原 (用逗号分隔)</label>
                    <input type="text" id="newAllergies" class="form-control" placeholder="例如: 青霉素,花生,海鲜">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>入住日期</label>
                        <input type="date" id="newCheckInDate" class="form-control" value="${Utils.getToday()}">
                    </div>
                    <div class="form-group">
                        <label>离开日期</label>
                        <input type="date" id="newCheckOutDate" class="form-control">
                    </div>
                </div>
                <div class="form-group">
                    <label>笼位号</label>
                    <input type="text" id="newCageNumber" class="form-control" placeholder="例如: A01">
                </div>
                <div class="form-group">
                    <label>特殊说明</label>
                    <textarea id="newSpecialInstructions" class="form-control" placeholder="例如: 性格温顺，喜欢散步"></textarea>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">取消</button>
                </div>
            </form>
        `;

        this.openModal('添加宠物', content);

        setTimeout(() => {
            const form = document.getElementById('addPetForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveNewPet();
                });
            }
        }, 100);
    },

    saveNewPet: function() {
        const pet = {
            petId: document.getElementById('newPetId')?.value?.trim(),
            petName: document.getElementById('newPetName')?.value?.trim(),
            ownerName: document.getElementById('newOwnerName')?.value?.trim(),
            ownerPhone: document.getElementById('newOwnerPhone')?.value?.trim(),
            species: document.getElementById('newSpecies')?.value,
            breed: document.getElementById('newBreed')?.value?.trim(),
            gender: document.getElementById('newGender')?.value,
            weight: parseFloat(document.getElementById('newWeight')?.value) || null,
            allergies: this.parseAllergiesInput(document.getElementById('newAllergies')?.value),
            checkInDate: document.getElementById('newCheckInDate')?.value,
            checkOutDate: document.getElementById('newCheckOutDate')?.value,
            cageNumber: document.getElementById('newCageNumber')?.value?.trim(),
            specialInstructions: document.getElementById('newSpecialInstructions')?.value?.trim(),
            status: 'active'
        };

        if (!pet.petId || !pet.petName) {
            Utils.showNotification('请填写宠物ID和宠物名', 'danger');
            return;
        }

        const existingPet = Storage.getPetByPetId(pet.petId);
        if (existingPet) {
            Utils.showNotification('宠物ID已存在', 'danger');
            return;
        }

        Storage.addPet(pet);
        this.closeModal();
        this.renderPetsTable();
        this.renderDataSummary();
        Validators.runAllChecks();
        this.renderAlerts();
        Utils.showNotification('宠物已添加', 'success');
    },

    editPet: function(petId) {
        const pet = Storage.getPetById(petId);
        if (!pet) return;

        const content = `
            <form id="editPetForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>宠物ID</label>
                        <input type="text" value="${pet.petId}" readonly class="form-control">
                    </div>
                    <div class="form-group">
                        <label>宠物名 *</label>
                        <input type="text" id="editPetName" value="${pet.petName || ''}" class="form-control" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>主人姓名</label>
                        <input type="text" id="editOwnerName" value="${pet.ownerName || ''}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>联系电话</label>
                        <input type="tel" id="editOwnerPhone" value="${pet.ownerPhone || ''}" class="form-control">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>物种</label>
                        <select id="editSpecies" class="form-control">
                            <option value="">请选择</option>
                            <option value="狗" ${pet.species === '狗' ? 'selected' : ''}>狗</option>
                            <option value="猫" ${pet.species === '猫' ? 'selected' : ''}>猫</option>
                            <option value="其他" ${pet.species === '其他' ? 'selected' : ''}>其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>品种</label>
                        <input type="text" id="editBreed" value="${pet.breed || ''}" class="form-control">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>性别</label>
                        <select id="editGender" class="form-control">
                            <option value="">请选择</option>
                            <option value="公" ${pet.gender === '公' ? 'selected' : ''}>公</option>
                            <option value="母" ${pet.gender === '母' ? 'selected' : ''}>母</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>体重(kg)</label>
                        <input type="number" id="editWeight" value="${pet.weight || ''}" class="form-control" step="0.1">
                    </div>
                </div>
                <div class="form-group">
                    <label>过敏原 (用逗号分隔)</label>
                    <input type="text" id="editAllergies" value="${(pet.allergies || []).join(', ')}" class="form-control">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>入住日期</label>
                        <input type="date" id="editCheckInDate" value="${pet.checkInDate || ''}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>离开日期</label>
                        <input type="date" id="editCheckOutDate" value="${pet.checkOutDate || ''}" class="form-control">
                    </div>
                </div>
                <div class="form-group">
                    <label>笼位号</label>
                    <input type="text" id="editCageNumber" value="${pet.cageNumber || ''}" class="form-control">
                </div>
                <div class="form-group">
                    <label>特殊说明</label>
                    <textarea id="editSpecialInstructions" class="form-control">${pet.specialInstructions || ''}</textarea>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">取消</button>
                </div>
            </form>
        `;

        this.openModal('编辑宠物', content);

        setTimeout(() => {
            const form = document.getElementById('editPetForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveEditedPet(petId);
                });
            }
        }, 100);
    },

    saveEditedPet: function(petId) {
        const updates = {
            petName: document.getElementById('editPetName')?.value?.trim(),
            ownerName: document.getElementById('editOwnerName')?.value?.trim(),
            ownerPhone: document.getElementById('editOwnerPhone')?.value?.trim(),
            species: document.getElementById('editSpecies')?.value,
            breed: document.getElementById('editBreed')?.value?.trim(),
            gender: document.getElementById('editGender')?.value,
            weight: parseFloat(document.getElementById('editWeight')?.value) || null,
            allergies: this.parseAllergiesInput(document.getElementById('editAllergies')?.value),
            checkInDate: document.getElementById('editCheckInDate')?.value,
            checkOutDate: document.getElementById('editCheckOutDate')?.value,
            cageNumber: document.getElementById('editCageNumber')?.value?.trim(),
            specialInstructions: document.getElementById('editSpecialInstructions')?.value?.trim()
        };

        if (!updates.petName) {
            Utils.showNotification('请填写宠物名', 'danger');
            return;
        }

        Storage.updatePet(petId, updates);
        this.closeModal();
        this.renderPetsTable();
        this.renderDataSummary();
        Validators.runAllChecks();
        this.renderAlerts();
        Utils.showNotification('宠物信息已更新', 'success');
    },

    deletePet: function(petId) {
        if (confirm('确定要删除这只宠物吗？')) {
            Storage.deletePet(petId);
            this.renderPetsTable();
            this.renderDataSummary();
            Validators.runAllChecks();
            this.renderAlerts();
            Utils.showNotification('宠物已删除', 'success');
        }
    },

    showAddMedicationModal: function() {
        const content = `
            <form id="addMedicationForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>药品名称 *</label>
                        <input type="text" id="newMedName" class="form-control" placeholder="例如: 阿莫西林" required>
                    </div>
                    <div class="form-group">
                        <label>分类</label>
                        <select id="newMedCategory" class="form-control">
                            <option value="">请选择</option>
                            <option value="抗生素">抗生素</option>
                            <option value="止痛药">止痛药</option>
                            <option value="消炎药">消炎药</option>
                            <option value="保健品">保健品</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>单位</label>
                        <select id="newMedUnit" class="form-control">
                            <option value="片">片</option>
                            <option value="粒">粒</option>
                            <option value="ml">ml</option>
                            <option value="mg">mg</option>
                            <option value="g">g</option>
                            <option value="滴">滴</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>推荐剂量/公斤</label>
                        <input type="number" id="newMedDefaultDose" class="form-control" placeholder="例如: 0.08" step="0.01">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>最小剂量</label>
                        <input type="number" id="newMedMinDose" class="form-control" placeholder="例如: 0.5" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>最大剂量</label>
                        <input type="number" id="newMedMaxDose" class="form-control" placeholder="例如: 2.0" step="0.01">
                    </div>
                </div>
                <div class="form-group">
                    <label>禁忌症 (用逗号分隔)</label>
                    <input type="text" id="newMedContraindications" class="form-control" placeholder="例如: 青霉素过敏,孕妇禁用">
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea id="newMedNotes" class="form-control" placeholder="药品说明..."></textarea>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">取消</button>
                </div>
            </form>
        `;

        this.openModal('添加药品', content);

        setTimeout(() => {
            const form = document.getElementById('addMedicationForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveNewMedication();
                });
            }
        }, 100);
    },

    saveNewMedication: function() {
        const medication = {
            name: document.getElementById('newMedName')?.value?.trim(),
            category: document.getElementById('newMedCategory')?.value,
            unit: document.getElementById('newMedUnit')?.value,
            defaultDose: parseFloat(document.getElementById('newMedDefaultDose')?.value) || null,
            minDose: parseFloat(document.getElementById('newMedMinDose')?.value) || null,
            maxDose: parseFloat(document.getElementById('newMedMaxDose')?.value) || null,
            contraindications: this.parseAllergiesInput(document.getElementById('newMedContraindications')?.value),
            notes: document.getElementById('newMedNotes')?.value?.trim()
        };

        if (!medication.name) {
            Utils.showNotification('请填写药品名称', 'danger');
            return;
        }

        const existingMed = Storage.getMedicationByName(medication.name);
        if (existingMed) {
            Utils.showNotification('药品已存在', 'danger');
            return;
        }

        Storage.addMedication(medication);
        this.closeModal();
        this.renderMedicationsTable();
        Utils.showNotification('药品已添加', 'success');
    },

    editMedication: function(medId) {
        const med = Storage.getMedicationById(medId);
        if (!med) return;

        const content = `
            <form id="editMedicationForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>药品名称</label>
                        <input type="text" value="${med.name}" readonly class="form-control">
                    </div>
                    <div class="form-group">
                        <label>分类</label>
                        <select id="editMedCategory" class="form-control">
                            <option value="">请选择</option>
                            <option value="抗生素" ${med.category === '抗生素' ? 'selected' : ''}>抗生素</option>
                            <option value="止痛药" ${med.category === '止痛药' ? 'selected' : ''}>止痛药</option>
                            <option value="消炎药" ${med.category === '消炎药' ? 'selected' : ''}>消炎药</option>
                            <option value="保健品" ${med.category === '保健品' ? 'selected' : ''}>保健品</option>
                            <option value="其他" ${med.category === '其他' ? 'selected' : ''}>其他</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>单位</label>
                        <select id="editMedUnit" class="form-control">
                            <option value="片" ${med.unit === '片' ? 'selected' : ''}>片</option>
                            <option value="粒" ${med.unit === '粒' ? 'selected' : ''}>粒</option>
                            <option value="ml" ${med.unit === 'ml' ? 'selected' : ''}>ml</option>
                            <option value="mg" ${med.unit === 'mg' ? 'selected' : ''}>mg</option>
                            <option value="g" ${med.unit === 'g' ? 'selected' : ''}>g</option>
                            <option value="滴" ${med.unit === '滴' ? 'selected' : ''}>滴</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>推荐剂量/公斤</label>
                        <input type="number" id="editMedDefaultDose" value="${med.defaultDose || ''}" class="form-control" step="0.01">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>最小剂量</label>
                        <input type="number" id="editMedMinDose" value="${med.minDose || ''}" class="form-control" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>最大剂量</label>
                        <input type="number" id="editMedMaxDose" value="${med.maxDose || ''}" class="form-control" step="0.01">
                    </div>
                </div>
                <div class="form-group">
                    <label>禁忌症 (用逗号分隔)</label>
                    <input type="text" id="editMedContraindications" value="${(med.contraindications || []).join(', ')}" class="form-control">
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea id="editMedNotes" class="form-control">${med.notes || ''}</textarea>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">取消</button>
                </div>
            </form>
        `;

        this.openModal('编辑药品', content);

        setTimeout(() => {
            const form = document.getElementById('editMedicationForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveEditedMedication(medId);
                });
            }
        }, 100);
    },

    saveEditedMedication: function(medId) {
        const updates = {
            category: document.getElementById('editMedCategory')?.value,
            unit: document.getElementById('editMedUnit')?.value,
            defaultDose: parseFloat(document.getElementById('editMedDefaultDose')?.value) || null,
            minDose: parseFloat(document.getElementById('editMedMinDose')?.value) || null,
            maxDose: parseFloat(document.getElementById('editMedMaxDose')?.value) || null,
            contraindications: this.parseAllergiesInput(document.getElementById('editMedContraindications')?.value),
            notes: document.getElementById('editMedNotes')?.value?.trim()
        };

        Storage.updateMedication(medId, updates);
        this.closeModal();
        this.renderMedicationsTable();
        Validators.runAllChecks();
        this.renderAlerts();
        Utils.showNotification('药品信息已更新', 'success');
    },

    deleteMedication: function(medId) {
        if (confirm('确定要删除这个药品吗？')) {
            Storage.deleteMedication(medId);
            this.renderMedicationsTable();
            Utils.showNotification('药品已删除', 'success');
        }
    },

    parseAllergiesInput: function(value) {
        if (!value || value.trim() === '') {
            return [];
        }
        
        return value.split(/[,，、;；]/)
                    .map(s => s.trim())
                    .filter(s => s !== '');
    },

    updateImportStatus: function() {
        const history = Storage.getImportHistory();
        const statusList = document.getElementById('importStatusList');
        
        if (!statusList || history.length === 0) return;

        let html = '';
        history.slice(-5).forEach(item => {
            html += `
                <div class="import-status-item">
                    <span class="icon">✅</span>
                    <div>
                        <strong>${this.getImportTypeName(item.type)}</strong> - ${item.description}
                        <br>
                        <span class="time">${item.importedAt}</span>
                    </div>
                </div>
            `;
        });

        statusList.innerHTML = html;
    },

    getImportTypeName: function(type) {
        const nameMap = {
            'agreement': '寄养协议',
            'health': '宠物体重/过敏信息',
            'cage': '笼位表',
            'medication': '每日喂药计划'
        };
        return nameMap[type] || type;
    },

    getFallbackDataSummary: function() {
        const stats = Storage.getStatistics();
        const alerts = Storage.getAlerts();
        
        return {
            pets: {
                count: stats.petsCount,
                label: '在院宠物'
            },
            medications: {
                count: stats.medicationsCount,
                label: '药品种类'
            },
            plans: {
                count: stats.plansCount,
                label: '喂药计划'
            },
            records: {
                count: stats.recordsCount,
                label: '喂药记录'
            },
            today: {
                plans: stats.todayPlansCount,
                completed: stats.completedToday,
                pending: stats.pendingToday
            },
            alerts: {
                total: stats.totalWarnings,
                dose: stats.doseWarnings,
                allergy: stats.allergyWarnings,
                cage: stats.cageConflicts,
                missed: stats.missedFeedings,
                openObservations: stats.openObservations
            }
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}