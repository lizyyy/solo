class CateringApp {
    constructor() {
        this.currentFlight = null;
        this.cabinConfigCounter = 0;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFlights();
    }

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target));
        });

        document.getElementById('btn-import').addEventListener('click', () => {
            this.showModal('import-modal');
        });

        document.getElementById('btn-import-samples').addEventListener('click', () => {
            this.importSamples();
        });

        document.getElementById('btn-confirm-import').addEventListener('click', () => {
            this.handleImport();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        document.getElementById('btn-run-match').addEventListener('click', () => {
            this.runMatching();
        });

        document.getElementById('btn-export-issues').addEventListener('click', () => {
            this.exportIssues();
        });

        document.getElementById('btn-export-report').addEventListener('click', () => {
            this.exportReport();
        });

        document.getElementById('btn-view-capacity').addEventListener('click', () => {
            this.switchTab(document.querySelector('[data-tab="cabin"]'));
        });

        document.getElementById('btn-add-issue').addEventListener('click', () => {
            this.showModal('issue-modal');
        });

        document.getElementById('btn-confirm-issue').addEventListener('click', () => {
            this.handleAddIssue();
        });

        document.getElementById('btn-add-note').addEventListener('click', () => {
            this.showModal('note-modal');
        });

        document.getElementById('btn-confirm-note').addEventListener('click', () => {
            this.handleAddNote();
        });

        document.getElementById('btn-add-cabin').addEventListener('click', () => {
            this.addCabinConfigField();
        });

        document.getElementById('config-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddConfig();
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    async api(endpoint, options = {}) {
        const url = `/api${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showNotification('请求失败: ' + error.message, 'error');
            throw error;
        }
    }

    async loadFlights() {
        try {
            const result = await this.api('/flights');
            this.renderFlightList(result.flights);
        } catch (error) {
            console.error('Failed to load flights:', error);
        }
    }

    renderFlightList(flights) {
        const container = document.getElementById('flight-list');
        
        if (!flights || flights.length === 0) {
            container.innerHTML = '<p class="loading-text">暂无航班数据，请导入数据</p>';
            return;
        }

        container.innerHTML = flights.map(flight => `
            <div class="flight-item" data-flight="${flight.flight_number}">
                <div class="flight-item-number">${flight.flight_number}</div>
                <div class="flight-item-info">
                    ${flight.aircraft_type || '未知机型'} | ${flight.departure_airport || 'N/A'} → ${flight.arrival_airport || 'N/A'}
                </div>
                <div class="flight-item-badges">
                    ${flight.order_count > 0 ? `<span class="badge badge-info">${flight.order_count} 订单</span>` : ''}
                    ${flight.open_issues > 0 ? `<span class="badge badge-danger">${flight.open_issues} 问题</span>` : ''}
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.flight-item').forEach(item => {
            item.addEventListener('click', () => {
                const flightNumber = item.dataset.flight;
                this.selectFlight(flightNumber);
            });
        });
    }

    async selectFlight(flightNumber) {
        document.querySelectorAll('.flight-item').forEach(item => {
            item.classList.toggle('active', item.dataset.flight === flightNumber);
        });

        this.currentFlight = flightNumber;

        try {
            const result = await this.api(`/flights/${flightNumber}`);
            this.renderFlightDetail(result);
            document.getElementById('no-flight-selected').classList.add('hidden');
            document.getElementById('flight-detail').classList.remove('hidden');
        } catch (error) {
            console.error('Failed to load flight detail:', error);
        }
    }

    renderFlightDetail(data) {
        const flight = data.flight;
        
        document.getElementById('detail-flight-number').textContent = flight.flight_number;
        document.getElementById('detail-route').textContent = `${flight.departure_airport || 'N/A'} → ${flight.arrival_airport || 'N/A'}`;
        document.getElementById('detail-aircraft').textContent = flight.aircraft_type || '未知机型';
        document.getElementById('detail-departure').textContent = `计划: ${flight.scheduled_departure_time || 'N/A'}`;

        const stats = data.match_result || {};
        document.getElementById('stat-total-orders').textContent = flight.order_count || 0;
        document.getElementById('stat-matched').textContent = stats.matched || 0;
        document.getElementById('stat-unmatched-orders').textContent = stats.unmatched_orders || 0;
        document.getElementById('stat-open-issues').textContent = data.open_issues || 0;

        this.renderCabinSummary(data.orders_by_cabin);
        this.renderAircraftChangeAlert(data.aircraft_change);
        this.renderTimeline(data.timeline);
        this.renderCabinCapacity(data.aircraft_change);
        this.renderSpecialMeals(data);
        this.renderTemperatureChecks(data.match_result);
        this.renderIssues(data.issues);
        this.renderNotes(data.notes);

        this.updateRiskBanner(data);
    }

    renderCabinSummary(ordersByCabin) {
        const tbody = document.getElementById('cabin-summary-body');
        
        if (!ordersByCabin || ordersByCabin.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading-text">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = ordersByCabin.map(cabin => `
            <tr>
                <td><strong>${cabin.cabin_class}</strong></td>
                <td>${cabin.count}</td>
                <td>${cabin.total_meals}</td>
                <td><span class="status-ok">正常</span></td>
            </tr>
        `).join('');
    }

    renderAircraftChangeAlert(changeData) {
        const alertBox = document.getElementById('aircraft-change-alert');
        
        if (changeData && changeData.has_change) {
            alertBox.classList.remove('hidden');
            document.getElementById('aircraft-change-message').textContent = changeData.summary;
        } else {
            alertBox.classList.add('hidden');
        }
    }

    renderTimeline(timeline) {
        const container = document.getElementById('timeline-events');
        
        if (!timeline || timeline.length === 0) {
            container.innerHTML = '<p class="loading-text">暂无时间线数据</p>';
            return;
        }

        container.innerHTML = timeline.map(event => `
            <div class="timeline-item ${event.type}">
                <div class="timeline-time">${this.formatTime(event.time)}</div>
                <div class="timeline-title">${event.title}</div>
                <div class="timeline-desc">${event.description}</div>
            </div>
        `).join('');
    }

    renderCabinCapacity(changeData) {
        const originalConfig = document.getElementById('original-config');
        const currentConfig = document.getElementById('current-config');
        const capacityIssues = document.getElementById('capacity-issues');

        if (changeData && changeData.has_change && changeData.original_config.length > 0) {
            originalConfig.classList.remove('hidden');
            originalConfig.classList.add('highlight');
            document.getElementById('original-config-body').innerHTML = 
                changeData.original_config.map(cfg => `
                    <tr>
                        <td><strong>${cfg.cabin_class}</strong></td>
                        <td>${cfg.seats_count}</td>
                        <td>${cfg.meal_capacity || cfg.seats_count}</td>
                    </tr>
                `).join('');
        } else {
            originalConfig.classList.add('hidden');
        }

        const configs = changeData && changeData.current_config && changeData.current_config.length > 0 
            ? changeData.current_config 
            : (changeData && changeData.original_config || []);

        if (configs.length > 0) {
            currentConfig.classList.remove('hidden');
            document.getElementById('current-config-body').innerHTML = 
                configs.map(cfg => `
                    <tr>
                        <td><strong>${cfg.cabin_class}</strong></td>
                        <td>${cfg.seats_count}</td>
                        <td>${cfg.meal_capacity || cfg.seats_count}</td>
                        <td>${cfg.ordered_meals || '-'}</td>
                        <td>
                            ${cfg.ordered_meals > (cfg.meal_capacity || cfg.seats_count) 
                                ? '<span class="status-danger">容量不足</span>' 
                                : '<span class="status-ok">正常</span>'}
                        </td>
                    </tr>
                `).join('');
        } else {
            currentConfig.classList.add('hidden');
        }

        if (changeData && changeData.capacity_issues && changeData.capacity_issues.length > 0) {
            capacityIssues.classList.remove('hidden');
            document.getElementById('capacity-issues-list').innerHTML = 
                changeData.capacity_issues.map(issue => `
                    <div class="capacity-issue-item">
                        <strong>${issue.cabin_class} 舱位</strong>: ${issue.issue}
                        ${issue.seat_diff ? `<br>座位变化: ${issue.original_seats} → ${issue.new_seats} (${issue.seat_diff > 0 ? '+' : ''}${issue.seat_diff})` : ''}
                        ${issue.ordered_meals ? `<br>已订: ${issue.ordered_meals} / 当前容量: ${issue.current_capacity}` : ''}
                    </div>
                `).join('');
        } else {
            capacityIssues.classList.add('hidden');
        }
    }

    async renderSpecialMeals(data) {
        try {
            const result = await this.api(`/flights/${this.currentFlight}/special-meals`);
            
            const mealsList = document.getElementById('special-meals-list');
            const mismatches = document.getElementById('special-mismatches');

            if (result.special_meals && result.special_meals.length > 0) {
                mealsList.innerHTML = result.special_meals.map(meal => `
                    <div class="meal-item special">
                        <div class="meal-info">
                            <span class="meal-type">${meal.special_meal_code || meal.meal_type}</span>
                            <span class="meal-details">
                                座位: ${meal.seat_number || 'N/A'} | 
                                ${meal.cabin_class} 舱 | 
                                ${meal.special_meal_description || meal.meal_type}
                            </span>
                        </div>
                        <div class="meal-status">
                            <span class="badge badge-info">特殊餐</span>
                        </div>
                    </div>
                `).join('');
            } else {
                mealsList.innerHTML = '<p class="loading-text">无特殊餐需求</p>';
            }

            if (result.mismatches && result.mismatches.length > 0) {
                mismatches.classList.remove('hidden');
                document.getElementById('mismatches-list').innerHTML = 
                    result.mismatches.map(m => `
                        <div class="mismatch-item">${m.issue}</div>
                    `).join('');
            } else {
                mismatches.classList.add('hidden');
            }
        } catch (error) {
            console.error('Failed to load special meals:', error);
        }
    }

    renderTemperatureChecks(matchResult) {
        const risksList = document.getElementById('temperature-risks');
        const tbody = document.getElementById('temperature-body');

        const matches = matchResult && matchResult.matches ? matchResult.matches : [];
        
        const riskMatches = matches.filter(m => 
            m.window_check && m.window_check !== 'ok' && m.window_check !== 'unknown'
        );

        if (riskMatches.length > 0) {
            risksList.innerHTML = riskMatches.map(match => {
                const riskClass = match.window_check === 'expired' ? 'expired' : 
                                  match.window_check.includes('hot') ? 'risk-hot' : 'risk-cold';
                const icon = match.window_check === 'expired' ? '🚨' : 
                             match.window_check.includes('hot') ? '🔥' : '❄️';
                
                return `
                    <div class="risk-item ${riskClass}">
                        <span class="risk-icon-large">${icon}</span>
                        <div class="risk-content">
                            <h4>${match.meal_type} (${match.temperature_type})</h4>
                            <p>座位: ${match.order_seat || 'N/A'} | 状态: ${this.formatWindowStatus(match.window_check)}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            risksList.innerHTML = '<p class="loading-text">暂无保温窗口风险</p>';
        }

        if (matches.length > 0) {
            tbody.innerHTML = matches.map(match => {
                const statusClass = match.window_check === 'ok' || match.window_check === 'unknown' 
                    ? 'status-ok' 
                    : (match.window_check === 'expired' ? 'status-danger' : 'status-warning');
                
                return `
                    <tr>
                        <td>${match.meal_type}</td>
                        <td>${match.temperature_type === 'hot' ? '🔥 热餐' : match.temperature_type === 'cold' ? '❄️ 冷餐' : '常温'}</td>
                        <td>${this.formatTime(match.scan_time)}</td>
                        <td>${this.formatTime(match.loading_time)}</td>
                        <td>${match.window_check === 'unknown' ? '-' : this.formatMinutes(match.minutes_since_scan)}</td>
                        <td><span class="${statusClass}">${this.formatWindowStatus(match.window_check)}</span></td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-text">暂无数据</td></tr>';
        }
    }

    renderIssues(issues) {
        const container = document.getElementById('issues-list');
        
        if (!issues || issues.length === 0) {
            container.innerHTML = '<p class="loading-text">暂无问题</p>';
            return;
        }

        container.innerHTML = issues.map(issue => `
            <div class="issue-item ${issue.severity}">
                <div class="issue-header">
                    <div class="issue-title">
                        <span class="issue-type">${issue.issue_type}</span>
                        ${issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : '🟡'}
                        <strong>${issue.description}</strong>
                    </div>
                    <div class="issue-time">${this.formatTime(issue.created_at)}</div>
                </div>
                ${issue.related_order_id || issue.related_scan_id || issue.related_confirm_id ? `
                    <div class="issue-description">
                        关联: ${issue.related_order_id ? `订单: ${issue.related_order_id}` : ''}
                              ${issue.related_scan_id ? `扫码: ${issue.related_scan_id}` : ''}
                              ${issue.related_confirm_id ? `装载: ${issue.related_confirm_id}` : ''}
                    </div>
                ` : ''}
                <div class="issue-actions">
                    <button class="btn btn-sm btn-success" onclick="app.resolveIssue(${issue.id})">
                        标记已解决
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderNotes(notes) {
        const container = document.getElementById('notes-list');
        
        if (!notes || notes.length === 0) {
            container.innerHTML = '<p class="loading-text">暂无备注</p>';
            return;
        }

        container.innerHTML = notes.map(note => `
            <div class="note-item">
                <div class="note-header">
                    <span class="note-type">${note.note_type}</span>
                    <span class="note-author">${note.created_by}</span>
                </div>
                <div class="note-time">${this.formatTime(note.created_at)}</div>
                <div class="note-content">${note.content}</div>
            </div>
        `).join('');
    }

    updateRiskBanner(data) {
        const banner = document.getElementById('risk-banner');
        const message = document.getElementById('risk-message');
        
        let hasRisks = false;
        let riskMessages = [];

        if (data.open_issues > 0) {
            hasRisks = true;
            riskMessages.push(`${data.open_issues} 个待解决问题`);
        }

        if (data.match_result && data.match_result.issues && data.match_result.issues.length > 0) {
            hasRisks = true;
            riskMessages.push('保温窗口风险');
        }

        if (data.aircraft_change && data.aircraft_change.has_change) {
            hasRisks = true;
            riskMessages.push('机型变更');
        }

        if (hasRisks) {
            banner.classList.remove('hidden');
            message.textContent = riskMessages.join(' | ');
        } else {
            banner.classList.add('hidden');
        }
    }

    switchTab(tabBtn) {
        const tabName = tabBtn.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn === tabBtn);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('hidden');
        
        if (modalId === 'import-modal') {
            document.getElementById('import-form').reset();
            document.getElementById('selected-file-name').textContent = '支持: CSV, YAML, JSONL, JSON';
        }
        if (modalId === 'issue-modal') {
            document.getElementById('issue-form').reset();
        }
        if (modalId === 'note-modal') {
            document.getElementById('note-form').reset();
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('selected-file-name').textContent = file.name;
        }
    }

    async handleImport() {
        const fileInput = document.getElementById('import-file');
        const flightNumber = document.getElementById('import-flight-number').value;
        
        if (!fileInput.files || fileInput.files.length === 0) {
            this.showNotification('请选择文件', 'error');
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        if (flightNumber) {
            formData.append('flight_number', flightNumber);
        }

        try {
            const response = await fetch('/api/import', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`导入成功: ${result.imported} 条记录`);
                this.hideModal('import-modal');
                this.loadFlights();
                
                if (result.flight_numbers && result.flight_numbers.length > 0) {
                    setTimeout(() => this.selectFlight(result.flight_numbers[0]), 500);
                }
            } else {
                this.showNotification('导入失败: ' + (result.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('Import failed:', error);
            this.showNotification('导入失败: ' + error.message, 'error');
        }
    }

    async importSamples() {
        try {
            const result = await this.api('/import/samples', { method: 'POST' });
            
            if (result.overall_success) {
                this.showNotification('样本数据导入成功');
                this.loadFlights();
            } else {
                this.showNotification('部分样本导入失败', 'error');
            }
        } catch (error) {
            console.error('Sample import failed:', error);
            this.showNotification('样本导入失败: ' + error.message, 'error');
        }
    }

    async runMatching() {
        if (!this.currentFlight) return;
        
        try {
            const result = await this.api(`/flights/${this.currentFlight}/match`, { method: 'POST' });
            this.showNotification(`匹配完成: ${result.matched} 条已匹配`);
            this.selectFlight(this.currentFlight);
        } catch (error) {
            console.error('Matching failed:', error);
            this.showNotification('匹配失败: ' + error.message, 'error');
        }
    }

    exportIssues() {
        if (!this.currentFlight) return;
        window.open(`/api/export/issues?flight_number=${encodeURIComponent(this.currentFlight)}`, '_blank');
    }

    exportReport() {
        if (!this.currentFlight) return;
        window.open(`/api/export/manifest/${encodeURIComponent(this.currentFlight)}`, '_blank');
    }

    async handleAddIssue() {
        const issueType = document.getElementById('issue-type').value;
        const severity = document.getElementById('issue-severity').value;
        const description = document.getElementById('issue-description').value;

        if (!description) {
            this.showNotification('请输入问题描述', 'error');
            return;
        }

        try {
            const result = await this.api('/issues', {
                method: 'POST',
                body: {
                    flight_number: this.currentFlight,
                    issue_type: issueType,
                    severity: severity,
                    description: description
                }
            });

            if (result.success) {
                this.showNotification('问题已添加');
                this.hideModal('issue-modal');
                this.selectFlight(this.currentFlight);
            } else {
                this.showNotification('添加失败', 'error');
            }
        } catch (error) {
            console.error('Add issue failed:', error);
            this.showNotification('添加失败: ' + error.message, 'error');
        }
    }

    async resolveIssue(issueId) {
        const resolutionNote = prompt('请输入解决说明:');
        if (resolutionNote === null) return;

        try {
            const result = await this.api(`/issues/${issueId}/resolve`, {
                method: 'POST',
                body: {
                    resolution_note: resolutionNote || '已解决'
                }
            });

            if (result.success) {
                this.showNotification('问题已标记为已解决');
                this.selectFlight(this.currentFlight);
            } else {
                this.showNotification('操作失败', 'error');
            }
        } catch (error) {
            console.error('Resolve issue failed:', error);
            this.showNotification('操作失败: ' + error.message, 'error');
        }
    }

    async handleAddNote() {
        const noteType = document.getElementById('note-type').value;
        const content = document.getElementById('note-content').value;

        if (!content) {
            this.showNotification('请输入备注内容', 'error');
            return;
        }

        try {
            const result = await this.api(`/flights/${this.currentFlight}/notes`, {
                method: 'POST',
                body: {
                    note_type: noteType,
                    content: content
                }
            });

            if (result.success) {
                this.showNotification('备注已添加');
                this.hideModal('note-modal');
                this.selectFlight(this.currentFlight);
            } else {
                this.showNotification('添加失败', 'error');
            }
        } catch (error) {
            console.error('Add note failed:', error);
            this.showNotification('添加失败: ' + error.message, 'error');
        }
    }

    addCabinConfigField() {
        this.cabinConfigCounter++;
        const container = document.getElementById('cabin-config-dynamic');
        const html = `
            <div class="cabin-config-item" id="cabin-config-${this.cabinConfigCounter}">
                <div class="cabin-config-header">
                    <h5>舱位配置 #${this.cabinConfigCounter}</h5>
                    <button type="button" class="btn btn-sm btn-danger" onclick="app.removeCabinConfig(${this.cabinConfigCounter})">删除</button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>舱位等级</label>
                        <select class="cabin-class">
                            <option value="First">头等舱</option>
                            <option value="Business">商务舱</option>
                            <option value="Economy">经济舱</option>
                            <option value="Premium Economy">超级经济舱</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>座位数</label>
                        <input type="number" class="seats-count" placeholder="例如: 150" min="1">
                    </div>
                    <div class="form-group">
                        <label>配餐容量</label>
                        <input type="number" class="meal-capacity" placeholder="留空则使用座位数" min="0">
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    }

    removeCabinConfig(id) {
        const element = document.getElementById(`cabin-config-${id}`);
        if (element) {
            element.remove();
        }
    }

    async handleAddConfig() {
        const aircraftType = document.getElementById('config-aircraft-type').value;
        const registration = document.getElementById('config-registration').value;
        const changeReason = document.getElementById('config-change-reason').value;
        const isOriginal = document.getElementById('config-is-original').checked;

        if (!aircraftType) {
            this.showNotification('请输入机型', 'error');
            return;
        }

        const configItems = document.querySelectorAll('.cabin-config-item');
        const cabinConfigs = [];

        configItems.forEach(item => {
            const cabinClass = item.querySelector('.cabin-class').value;
            const seatsCount = item.querySelector('.seats-count').value;
            const mealCapacity = item.querySelector('.meal-capacity').value;

            if (seatsCount) {
                cabinConfigs.push({
                    cabin_class: cabinClass,
                    seats_count: parseInt(seatsCount),
                    meal_capacity: mealCapacity ? parseInt(mealCapacity) : null
                });
            }
        });

        if (cabinConfigs.length === 0) {
            this.showNotification('请至少添加一个舱位配置', 'error');
            return;
        }

        try {
            const result = await this.api(`/flights/${this.currentFlight}/aircraft-config`, {
                method: 'POST',
                body: {
                    aircraft_type: aircraftType,
                    aircraft_registration: registration,
                    change_reason: changeReason,
                    is_original: isOriginal,
                    cabin_configs: cabinConfigs
                }
            });

            if (result.success) {
                this.showNotification(`配置已添加: ${result.added} 条`);
                this.selectFlight(this.currentFlight);
            } else {
                this.showNotification('添加失败', 'error');
            }
        } catch (error) {
            console.error('Add config failed:', error);
            this.showNotification('添加失败: ' + error.message, 'error');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageEl = document.getElementById('notification-message');
        
        messageEl.textContent = message;
        notification.className = `notification ${type === 'error' ? 'error' : ''}`;
        notification.classList.remove('hidden');

        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    formatTime(timeStr) {
        if (!timeStr) return 'N/A';
        try {
            const date = new Date(timeStr.replace('Z', '+00:00'));
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return timeStr.substring(5, 16).replace('T', ' ');
        }
    }

    formatMinutes(minutes) {
        if (!minutes) return 'N/A';
        if (minutes < 60) return `${minutes} 分钟`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }

    formatWindowStatus(status) {
        const statusMap = {
            'ok': '正常',
            'risk_hot': '热餐即将超时',
            'risk_cold': '冷餐即将超时',
            'expired': '已超时',
            'unknown': '未知'
        };
        return statusMap[status] || status;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const app = new CateringApp();
});
