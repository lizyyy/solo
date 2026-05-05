const App = {
    currentAppointmentId: null,
    currentRiskData: null,
    customers: [],
    locations: [],
    tireSets: [],

    init() {
        this.bindEvents();
        this.loadInitialData();
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
        }
    },

    bindEvents() {
        document.getElementById('scan-enter').addEventListener('click', () => {
            this.showScreen('scan-screen');
            this.initScanScreen();
        });

        document.getElementById('view-appointments').addEventListener('click', () => {
            this.showScreen('appointments-screen');
            this.loadAppointments();
        });

        document.getElementById('view-history').addEventListener('click', () => {
            this.showScreen('history-screen');
            this.loadHistoryData();
        });

        document.getElementById('back-from-scan').addEventListener('click', () => {
            this.showScreen('main-menu');
        });

        document.getElementById('back-from-appointments').addEventListener('click', () => {
            this.showScreen('main-menu');
        });

        document.getElementById('back-from-review').addEventListener('click', () => {
            this.showScreen('appointments-screen');
            this.loadAppointments();
        });

        document.getElementById('back-from-history').addEventListener('click', () => {
            this.showScreen('main-menu');
        });

        document.getElementById('lookup-barcode').addEventListener('click', () => this.lookupBarcode());
        document.getElementById('barcode-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.lookupBarcode();
        });

        document.getElementById('save-tire-set').addEventListener('click', () => this.saveTireSet());
        document.getElementById('clear-form').addEventListener('click', () => this.clearTireSetForm());

        document.getElementById('new-customer-btn').addEventListener('click', () => {
            document.getElementById('new-customer-modal').classList.remove('hidden');
        });

        document.getElementById('save-customer').addEventListener('click', () => this.saveNewCustomer());
        document.getElementById('cancel-customer').addEventListener('click', () => {
            document.getElementById('new-customer-modal').classList.add('hidden');
        });

        document.getElementById('filter-date').addEventListener('change', () => this.loadAppointments());
        document.getElementById('filter-status').addEventListener('change', () => this.loadAppointments());

        document.getElementById('new-appointment').addEventListener('click', () => this.showNewAppointmentModal());
        document.getElementById('save-appointment').addEventListener('click', () => this.saveAppointment());
        document.getElementById('cancel-appointment').addEventListener('click', () => {
            document.getElementById('new-appointment-modal').classList.add('hidden');
        });

        document.getElementById('apt-customer').addEventListener('change', (e) => this.loadCustomerTireSets(e.target.value));

        document.getElementById('complete-review').addEventListener('click', () => this.completeReview());
        document.getElementById('export-markdown-btn').addEventListener('click', () => {
            if (this.currentAppointmentId) {
                API.exportMarkdown(this.currentAppointmentId);
            }
        });
        document.getElementById('export-json-btn').addEventListener('click', () => {
            if (this.currentAppointmentId) {
                API.exportJson(this.currentAppointmentId);
            }
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                e.target.classList.add('active');
                document.getElementById(`tab-${e.target.dataset.tab}`).classList.remove('hidden');
            });
        });
    },

    async loadInitialData() {
        try {
            this.locations = await API.getLocations();
            this.customers = await API.getCustomers();
            this.tireSets = await API.getTireSets();
            this.populateLocationSelects();
            this.populateCustomerSelects();
            this.generateQuickBarcodes();
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    },

    populateLocationSelects() {
        const selects = ['form-location', 'apt-location'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = selectId === 'apt-location' ? '<option value="">不指定</option>' : '<option value="">选择仓位</option>';
                this.locations.forEach(loc => {
                    const option = document.createElement('option');
                    option.value = loc.id;
                    option.textContent = loc.name;
                    select.appendChild(option);
                });
                if (currentValue) select.value = currentValue;
            }
        });
    },

    populateCustomerSelects() {
        const selects = ['form-customer', 'apt-customer'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">选择客户</option>';
                this.customers.forEach(cust => {
                    const option = document.createElement('option');
                    option.value = cust.id;
                    option.textContent = `${cust.name} (${cust.vehiclePlate || '无车牌'})`;
                    select.appendChild(option);
                });
                if (currentValue) select.value = currentValue;
            }
        });
    },

    generateQuickBarcodes() {
        const container = document.getElementById('quick-barcodes');
        const existingBarcodes = this.tireSets.map(t => t.barcode);
        const sampleBarcodes = ['TS001', 'TS002', 'TS003', 'TS004', 'TS005'];
        
        container.innerHTML = '';
        sampleBarcodes.forEach(barcode => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-small quick-barcode-btn';
            btn.textContent = barcode;
            if (existingBarcodes.includes(barcode)) {
                btn.classList.add('btn-secondary');
            }
            btn.addEventListener('click', () => {
                document.getElementById('barcode-input').value = barcode;
                this.lookupBarcode();
            });
            container.appendChild(btn);
        });
    },

    initScanScreen() {
        this.clearTireSetForm();
        document.getElementById('barcode-input').focus();
    },

    async lookupBarcode() {
        const barcode = document.getElementById('barcode-input').value.trim();
        if (!barcode) {
            showToast('请输入条码', 'error');
            return;
        }

        try {
            const tireSet = await API.getTireSet(barcode);
            if (tireSet && !tireSet.error) {
                this.fillTireSetForm(tireSet);
                showToast('找到已存轮胎组', 'success');
            } else {
                document.getElementById('form-barcode').value = barcode;
                showToast('新条码，可录入信息', 'info');
            }
        } catch (error) {
            document.getElementById('form-barcode').value = barcode;
            showToast('新条码，可录入信息', 'info');
        }
    },

    async fillTireSetForm(tireSet) {
        document.getElementById('form-barcode').value = tireSet.barcode || '';
        document.getElementById('form-customer').value = tireSet.customerId || '';
        document.getElementById('form-location').value = tireSet.location || '';
        document.getElementById('form-quantity').value = tireSet.quantity || 4;
        document.getElementById('form-notes').value = tireSet.notes || '';

        for (let i = 0; i < 4; i++) {
            document.getElementById(`spec-${i}`).value = (tireSet.specifications && tireSet.specifications[i]) || '';
            document.getElementById(`pattern-${i}`).value = (tireSet.patterns && tireSet.patterns[i]) || '';
            document.getElementById(`brand-${i}`).value = (tireSet.brands && tireSet.brands[i]) || '';
        }

        try {
            const inspections = await API.getInspections(tireSet.id);
            if (inspections && inspections.length > 0) {
                const latest = inspections.sort((a, b) => 
                    new Date(b.inspectedAt) - new Date(a.inspectedAt)
                )[0];
                
                for (let i = 0; i < 4; i++) {
                    const wear = latest.wearDepths && latest.wearDepths[i];
                    const pressure = latest.pressures && latest.pressures[i];
                    document.getElementById(`wear-${i}`).value = wear !== null && wear !== undefined ? wear : '';
                    document.getElementById(`pressure-${i}`).value = pressure !== null && pressure !== undefined ? pressure : '';
                }
            }
        } catch (error) {
            console.error('Failed to load inspections:', error);
        }
    },

    clearTireSetForm() {
        document.getElementById('barcode-input').value = '';
        document.getElementById('form-barcode').value = '';
        document.getElementById('form-customer').value = '';
        document.getElementById('form-location').value = '';
        document.getElementById('form-quantity').value = 4;
        document.getElementById('form-notes').value = '';

        for (let i = 0; i < 4; i++) {
            document.getElementById(`spec-${i}`).value = '';
            document.getElementById(`pattern-${i}`).value = '';
            document.getElementById(`brand-${i}`).value = '';
            document.getElementById(`wear-${i}`).value = '';
            document.getElementById(`pressure-${i}`).value = '';
        }
    },

    async saveTireSet() {
        const barcode = document.getElementById('form-barcode').value.trim();
        if (!barcode) {
            showToast('请输入条码', 'error');
            return;
        }

        const customerId = document.getElementById('form-customer').value;
        if (!customerId) {
            showToast('请选择客户', 'error');
            return;
        }

        const specifications = [];
        const patterns = [];
        const brands = [];
        const wearDepths = [];
        const pressures = [];

        for (let i = 0; i < 4; i++) {
            specifications.push(document.getElementById(`spec-${i}`).value.trim() || null);
            patterns.push(document.getElementById(`pattern-${i}`).value.trim() || null);
            brands.push(document.getElementById(`brand-${i}`).value.trim() || null);
            
            const wearVal = document.getElementById(`wear-${i}`).value;
            wearDepths.push(wearVal !== '' ? parseFloat(wearVal) : null);
            
            const pressureVal = document.getElementById(`pressure-${i}`).value;
            pressures.push(pressureVal !== '' ? parseFloat(pressureVal) : null);
        }

        const tireSetData = {
            barcode,
            customerId,
            location: document.getElementById('form-location').value || null,
            quantity: parseInt(document.getElementById('form-quantity').value) || 4,
            specifications,
            patterns,
            brands,
            notes: document.getElementById('form-notes').value.trim()
        };

        try {
            let existingTireSet = await API.getTireSet(barcode);
            let result;

            if (existingTireSet && !existingTireSet.error) {
                result = await API.updateTireSet(existingTireSet.id, tireSetData);
            } else {
                result = await API.createTireSet(tireSetData);
            }

            if (result.error) {
                showToast(result.error, 'error');
                return;
            }

            const hasInspectionData = wearDepths.some(w => w !== null) || pressures.some(p => p !== null);
            if (hasInspectionData) {
                await API.createInspection({
                    tireSetId: result.id,
                    wearDepths,
                    pressures,
                    inspector: '店员'
                });
            }

            showToast('保存成功', 'success');
            await this.loadInitialData();
        } catch (error) {
            console.error('Save failed:', error);
            showToast('保存失败: ' + (error.message || '未知错误'), 'error');
        }
    },

    async saveNewCustomer() {
        const name = document.getElementById('new-customer-name').value.trim();
        if (!name) {
            showToast('请输入客户姓名', 'error');
            return;
        }

        const customerData = {
            name,
            phone: document.getElementById('new-customer-phone').value.trim() || null,
            vehiclePlate: document.getElementById('new-customer-plate').value.trim() || null,
            vehicleModel: document.getElementById('new-customer-model').value.trim() || null
        };

        try {
            const result = await API.createCustomer(customerData);
            if (result.error) {
                showToast(result.error, 'error');
                return;
            }

            showToast('客户创建成功', 'success');
            document.getElementById('new-customer-modal').classList.add('hidden');
            
            document.getElementById('new-customer-name').value = '';
            document.getElementById('new-customer-phone').value = '';
            document.getElementById('new-customer-plate').value = '';
            document.getElementById('new-customer-model').value = '';

            await this.loadInitialData();
            document.getElementById('form-customer').value = result.id;
        } catch (error) {
            showToast('创建失败', 'error');
        }
    },

    async loadAppointments() {
        const params = {};
        const dateFilter = document.getElementById('filter-date').value;
        const statusFilter = document.getElementById('filter-status').value;

        if (dateFilter) params.date = dateFilter;
        if (statusFilter) params.status = statusFilter;

        try {
            const appointments = await API.getAppointments(params);
            this.renderAppointmentsList(appointments);
        } catch (error) {
            console.error('Failed to load appointments:', error);
            showToast('加载预约列表失败', 'error');
        }
    },

    renderAppointmentsList(appointments) {
        const container = document.getElementById('appointments-list');
        
        if (!appointments || appointments.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无预约记录</p>';
            return;
        }

        const statusColors = {
            'pending': 'status-pending',
            'in_progress': 'status-in-progress',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled'
        };

        const statusNames = {
            'pending': '待装车',
            'in_progress': '装车中',
            'completed': '已完成',
            'cancelled': '已取消'
        };

        let html = '';
        appointments.forEach(apt => {
            const customer = this.customers.find(c => c.id === apt.customerId);
            const statusClass = statusColors[apt.status] || 'status-pending';
            const statusName = statusNames[apt.status] || apt.status;

            html += `
                <div class="appointment-card" data-id="${apt.id}">
                    <div class="appointment-header">
                        <span class="customer-name">${customer ? customer.name : '未知客户'}</span>
                        <span class="status-badge ${statusClass}">${statusName}</span>
                    </div>
                    <div class="appointment-details">
                        <span>📅 ${apt.scheduledDate || '未指定日期'}</span>
                        <span>🔢 ${apt.tireSetIds ? apt.tireSetIds.length : 0} 组轮胎</span>
                        ${apt.expectedLocation ? `<span>📍 ${apt.expectedLocation}</span>` : ''}
                    </div>
                    <div class="appointment-actions">
                        ${apt.status !== 'completed' && apt.status !== 'cancelled' ? 
                            `<button class="btn btn-small btn-primary review-btn" data-id="${apt.id}">开始复核</button>` : 
                            `<button class="btn btn-small view-btn" data-id="${apt.id}">查看详情</button>`}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        container.querySelectorAll('.review-btn, .view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appointmentId = e.target.dataset.id;
                this.startReview(appointmentId);
            });
        });
    },

    async showNewAppointmentModal() {
        const modal = document.getElementById('new-appointment-modal');
        modal.classList.remove('hidden');

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('apt-date').value = today;
        document.getElementById('apt-customer').value = '';
        document.getElementById('apt-location').value = '';
        document.getElementById('apt-notes').value = '';
        document.getElementById('apt-tire-sets').innerHTML = '<p class="empty-message">请先选择客户</p>';

        this.populateCustomerSelects();
        this.populateLocationSelects();
    },

    async loadCustomerTireSets(customerId) {
        const container = document.getElementById('apt-tire-sets');
        
        if (!customerId) {
            container.innerHTML = '<p class="empty-message">请先选择客户</p>';
            return;
        }

        try {
            const tireSets = await API.getTireSets({ customerId, status: 'stored' });
            
            if (!tireSets || tireSets.length === 0) {
                container.innerHTML = '<p class="empty-message">该客户暂无寄存轮胎</p>';
                return;
            }

            let html = '';
            tireSets.forEach(ts => {
                html += `
                    <label class="tire-set-checkbox">
                        <input type="checkbox" value="${ts.id}" class="tire-set-select">
                        <span class="tire-set-info">
                            <strong>${ts.barcode}</strong>
                            <span class="tire-set-detail">仓位: ${ts.location || '未指定'} | 规格: ${(ts.specifications || []).filter(s => s).join(', ') || '未录入'}</span>
                        </span>
                    </label>
                `;
            });

            container.innerHTML = html;
        } catch (error) {
            container.innerHTML = '<p class="empty-message">加载轮胎组失败</p>';
        }
    },

    async saveAppointment() {
        const customerId = document.getElementById('apt-customer').value;
        const scheduledDate = document.getElementById('apt-date').value;
        const selectedTireSets = Array.from(document.querySelectorAll('.tire-set-select:checked')).map(cb => cb.value);

        if (!customerId) {
            showToast('请选择客户', 'error');
            return;
        }

        if (!scheduledDate) {
            showToast('请选择预约日期', 'error');
            return;
        }

        if (selectedTireSets.length === 0) {
            showToast('请选择至少一组轮胎', 'error');
            return;
        }

        const appointmentData = {
            customerId,
            scheduledDate,
            expectedLocation: document.getElementById('apt-location').value || null,
            tireSetIds: selectedTireSets,
            notes: document.getElementById('apt-notes').value.trim()
        };

        try {
            const result = await API.createAppointment(appointmentData);
            if (result.error) {
                showToast(result.error, 'error');
                return;
            }

            showToast('预约创建成功', 'success');
            document.getElementById('new-appointment-modal').classList.add('hidden');
            this.loadAppointments();
        } catch (error) {
            console.error('Create appointment failed:', error);
            showToast('创建失败: ' + (error.message || '未知错误'), 'error');
        }
    },

    async startReview(appointmentId) {
        this.currentAppointmentId = appointmentId;
        this.showScreen('review-screen');

        try {
            const riskData = await API.checkAppointmentRisks(appointmentId);
            this.currentRiskData = riskData;

            const reviews = await API.getReviews(appointmentId);
            this.renderReviewScreen(riskData, reviews);
        } catch (error) {
            console.error('Failed to load review data:', error);
            showToast('加载复核数据失败', 'error');
        }
    },

    renderReviewScreen(riskData, reviews) {
        const { appointment, tireSetDetails, summary } = riskData;
        const customer = this.customers.find(c => c.id === appointment.customerId);

        const infoHtml = `
            <div class="info-row">
                <span class="info-label">客户:</span>
                <span class="info-value">${customer ? customer.name : '未知'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">车牌:</span>
                <span class="info-value">${customer ? (customer.vehiclePlate || '未录入') : '-'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">预约日期:</span>
                <span class="info-value">${appointment.scheduledDate || '未指定'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">预期仓位:</span>
                <span class="info-value">${appointment.expectedLocation || '未指定'}</span>
            </div>
        `;
        document.getElementById('review-info').innerHTML = infoHtml;

        const summaryHtml = `
            <h3>风险汇总</h3>
            <div class="risk-stats">
                <div class="risk-stat critical">
                    <span class="stat-value">${summary.critical}</span>
                    <span class="stat-label">致命</span>
                </div>
                <div class="risk-stat high">
                    <span class="stat-value">${summary.high}</span>
                    <span class="stat-label">高危</span>
                </div>
                <div class="risk-stat medium">
                    <span class="stat-value">${summary.medium}</span>
                    <span class="stat-label">中危</span>
                </div>
            </div>
        `;
        document.getElementById('risk-summary').innerHTML = summaryHtml;

        let tireSetsHtml = '';
        tireSetDetails.forEach((detail, idx) => {
            const { tireSet, latestInspection, risks } = detail;

            tireSetsHtml += `
                <div class="tire-set-review-card">
                    <div class="tire-set-header">
                        <h4>条码: ${tireSet.barcode}</h4>
                        <span class="location-badge">仓位: ${tireSet.location || '未指定'}</span>
                    </div>
                    <div class="tire-set-specs">
                        <div class="spec-row">
                            <span class="spec-label">规格:</span>
                            <span>${(tireSet.specifications || []).filter(s => s).join(' / ') || '未录入'}</span>
                        </div>
                        <div class="spec-row">
                            <span class="spec-label">花纹:</span>
                            <span>${(tireSet.patterns || []).filter(p => p).join(' / ') || '未录入'}</span>
                        </div>
                        <div class="spec-row">
                            <span class="spec-label">品牌:</span>
                            <span>${(tireSet.brands || []).filter(b => b).join(' / ') || '未录入'}</span>
                        </div>
                    </div>
            `;

            if (latestInspection) {
                tireSetsHtml += `
                    <div class="inspection-summary">
                        <h5>最新检测</h5>
                        <div class="inspection-grid-small">
                `;
                const positions = ['左前', '右前', '左后', '右后'];
                for (let i = 0; i < 4; i++) {
                    const wear = latestInspection.wearDepths && latestInspection.wearDepths[i];
                    const pressure = latestInspection.pressures && latestInspection.pressures[i];
                    tireSetsHtml += `
                        <div class="inspection-item-small">
                            <span class="pos-label">${positions[i]}</span>
                            <span class="inspect-value">磨损: ${wear !== null && wear !== undefined ? wear + 'mm' : '-'}</span>
                            <span class="inspect-value">胎压: ${pressure !== null && pressure !== undefined ? pressure + 'bar' : '-'}</span>
                        </div>
                    `;
                }
                tireSetsHtml += `</div></div>`;
            }

            if (risks && risks.length > 0) {
                tireSetsHtml += `<div class="risk-items">`;
                risks.forEach((risk, riskIdx) => {
                    const review = reviews.find(r => r.tireSetId === tireSet.id && r.riskType === risk.type);
                    const decision = review ? review.decision : 'pending';
                    const notes = review ? review.notes : '';

                    const severityClass = risk.severity === 'critical' ? 'risk-critical' : 
                                          risk.severity === 'high' ? 'risk-high' : 'risk-medium';

                    tireSetsHtml += `
                        <div class="risk-item ${severityClass}">
                            <div class="risk-message">
                                <span class="risk-severity">[${this.getSeverityName(risk.severity)}]</span>
                                ${risk.message}
                            </div>
                            <div class="risk-decision">
                                <select class="decision-select" 
                                        data-tire-set-id="${tireSet.id}" 
                                        data-risk-type="${risk.type}">
                                    <option value="pending" ${decision === 'pending' ? 'selected' : ''}>待确认</option>
                                    <option value="confirmed" ${decision === 'confirmed' ? 'selected' : ''}>确认风险</option>
                                    <option value="overruled" ${decision === 'overruled' ? 'selected' : ''}>人工改判</option>
                                </select>
                                <input type="text" class="decision-notes" 
                                       placeholder="备注..." 
                                       value="${notes}"
                                       data-tire-set-id="${tireSet.id}" 
                                       data-risk-type="${risk.type}">
                                <button class="btn btn-small save-decision-btn"
                                        data-tire-set-id="${tireSet.id}" 
                                        data-risk-type="${risk.type}">保存</button>
                            </div>
                        </div>
                    `;
                });
                tireSetsHtml += `</div>`;
            }

            if (tireSet.notes) {
                tireSetsHtml += `
                    <div class="tire-set-notes">
                        <strong>备注:</strong> ${tireSet.notes}
                    </div>
                `;
            }

            tireSetsHtml += `</div>`;
        });

        document.getElementById('tire-sets-review').innerHTML = tireSetsHtml;

        document.querySelectorAll('.save-decision-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tireSetId = e.target.dataset.tireSetId;
                const riskType = e.target.dataset.riskType;
                
                const select = document.querySelector(`.decision-select[data-tire-set-id="${tireSetId}"][data-risk-type="${riskType}"]`);
                const notesInput = document.querySelector(`.decision-notes[data-tire-set-id="${tireSetId}"][data-risk-type="${riskType}"]`);

                try {
                    await API.saveReview({
                        appointmentId: this.currentAppointmentId,
                        tireSetId,
                        riskType,
                        decision: select.value,
                        notes: notesInput.value
                    });
                    showToast('判定已保存', 'success');
                } catch (error) {
                    showToast('保存失败', 'error');
                }
            });
        });
    },

    getSeverityName(severity) {
        const map = {
            'critical': '致命',
            'high': '高危',
            'medium': '中危',
            'low': '低危'
        };
        return map[severity] || severity;
    },

    async completeReview() {
        if (!this.currentAppointmentId) return;

        try {
            await API.updateAppointment(this.currentAppointmentId, {
                status: 'completed'
            });
            showToast('装车完成', 'success');
            this.showScreen('appointments-screen');
            this.loadAppointments();
        } catch (error) {
            showToast('操作失败', 'error');
        }
    },

    async loadHistoryData() {
        try {
            this.customers = await API.getCustomers();
            this.tireSets = await API.getTireSets();
            
            this.renderCustomerHistory();
            this.renderTireSetHistory();
            this.renderAppointmentHistory();
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    },

    renderCustomerHistory() {
        const container = document.getElementById('tab-customers');
        if (!this.customers || this.customers.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无客户数据</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>姓名</th><th>电话</th><th>车牌</th><th>车型</th></tr></thead><tbody>';
        this.customers.forEach(c => {
            html += `<tr><td>${c.name}</td><td>${c.phone || '-'}</td><td>${c.vehiclePlate || '-'}</td><td>${c.vehicleModel || '-'}</td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    renderTireSetHistory() {
        const container = document.getElementById('tab-tire-sets');
        if (!this.tireSets || this.tireSets.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无轮胎组数据</p>';
            return;
        }

        const statusNames = { 'stored': '寄存中', 'retrieved': '已取走' };

        let html = '<table class="data-table"><thead><tr><th>条码</th><th>客户</th><th>仓位</th><th>状态</th><th>规格</th></tr></thead><tbody>';
        this.tireSets.forEach(ts => {
            const customer = this.customers.find(c => c.id === ts.customerId);
            html += `<tr>
                <td>${ts.barcode}</td>
                <td>${customer ? customer.name : '-'}</td>
                <td>${ts.location || '-'}</td>
                <td>${statusNames[ts.status] || ts.status}</td>
                <td>${(ts.specifications || []).filter(s => s).join(', ') || '-'}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    async renderAppointmentHistory() {
        const container = document.getElementById('tab-appointments');
        try {
            const appointments = await API.getAppointments();
            if (!appointments || appointments.length === 0) {
                container.innerHTML = '<p class="empty-message">暂无预约数据</p>';
                return;
            }

            const statusNames = {
                'pending': '待装车',
                'in_progress': '装车中',
                'completed': '已完成',
                'cancelled': '已取消'
            };

            let html = '<table class="data-table"><thead><tr><th>客户</th><th>日期</th><th>轮胎组数</th><th>状态</th><th>操作</th></tr></thead><tbody>';
            appointments.forEach(apt => {
                const customer = this.customers.find(c => c.id === apt.customerId);
                html += `<tr>
                    <td>${customer ? customer.name : '-'}</td>
                    <td>${apt.scheduledDate || '-'}</td>
                    <td>${apt.tireSetIds ? apt.tireSetIds.length : 0}</td>
                    <td>${statusNames[apt.status] || apt.status}</td>
                    <td><button class="btn btn-small view-history-btn" data-id="${apt.id}">查看</button></td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;

            container.querySelectorAll('.view-history-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.startReview(e.target.dataset.id);
                });
            });
        } catch (error) {
            container.innerHTML = '<p class="empty-message">加载预约数据失败</p>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
