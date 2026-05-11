const App = {
    elements: {},
    isProcessing: false,

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupTabs();
        this.updateSystemStatus('ready', '系统就绪');
    },

    cacheElements() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            loadSampleBtn: document.getElementById('loadSampleBtn'),
            inputDisplay: document.getElementById('inputDisplay'),
            processIntensityBtn: document.getElementById('processIntensityBtn'),
            generateCleanPlanBtn: document.getElementById('generateCleanPlanBtn'),
            trackDamageBtn: document.getElementById('trackDamageBtn'),
            runAllBtn: document.getElementById('runAllBtn'),
            resetBtn: document.getElementById('resetBtn'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            cleaningContent: document.getElementById('cleaningContent'),
            damageContent: document.getElementById('damageContent'),
            statisticsContent: document.getElementById('statisticsContent'),
            historyContent: document.getElementById('historyContent'),
            exportBtn: document.getElementById('exportBtn'),
            exportStatus: document.getElementById('exportStatus'),
            systemStatus: document.getElementById('systemStatus'),
            lastUpdate: document.getElementById('lastUpdate')
        };
    },

    bindEvents() {
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.elements.loadSampleBtn.addEventListener('click', () => this.loadSampleData());
        this.elements.processIntensityBtn.addEventListener('click', () => this.processIntensity());
        this.elements.generateCleanPlanBtn.addEventListener('click', () => this.generateCleanPlans());
        this.elements.trackDamageBtn.addEventListener('click', () => this.trackDamage());
        this.elements.runAllBtn.addEventListener('click', () => this.runAllProcesses());
        this.elements.resetBtn.addEventListener('click', () => this.resetState());
        this.elements.exportBtn.addEventListener('click', () => this.exportResults());
    },

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                
                tab.classList.add('active');
                const tabName = tab.dataset.tab;
                document.getElementById(tabName + 'Tab').classList.add('active');
            });
        });
    },

    updateSystemStatus(status, text) {
        const indicator = this.elements.systemStatus;
        indicator.className = `status-indicator ${status}`;
        indicator.textContent = text;
        this.elements.lastUpdate.textContent = `最后更新: ${Utils.formatDate(new Date())}`;
    },

    setProgress(percent, text) {
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.progressText.textContent = text;
    },

    setProcessing(processing) {
        this.isProcessing = processing;
        
        const buttons = [
            this.elements.processIntensityBtn,
            this.elements.generateCleanPlanBtn,
            this.elements.trackDamageBtn,
            this.elements.runAllBtn,
            this.elements.resetBtn,
            this.elements.exportBtn,
            this.elements.loadSampleBtn
        ];

        buttons.forEach(btn => {
            btn.disabled = processing;
        });

        this.elements.fileInput.disabled = processing;

        if (processing) {
            this.updateSystemStatus('processing', '处理中...');
        }
    },

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.setProcessing(true);
            this.setProgress(10, '读取文件中...');

            const content = await this.readFile(file);
            const data = JSON.parse(content);

            this.setProgress(30, '验证数据格式...');
            Utils.validateClassroomData(data);

            this.setProgress(50, '加载教室档案...');
            DataService.loadClassrooms(data);

            this.renderInputDisplay();
            this.setProgress(100, '数据加载完成');
            
            Utils.showNotification(`成功加载 ${data.length} 个教室数据`, 'success');
            this.updateSystemStatus('ready', '数据已加载');
        } catch (error) {
            console.error('文件加载失败:', error);
            Utils.showNotification(`数据加载失败: ${error.message}`, 'error');
            this.updateSystemStatus('error', '加载失败');
        } finally {
            this.setProcessing(false);
            event.target.value = '';
        }
    },

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    },

    loadSampleData() {
        try {
            this.setProcessing(true);
            this.setProgress(20, '加载样例数据...');

            const sampleData = BusinessLogic.getSampleData();
            
            this.setProgress(50, '验证数据...');
            Utils.validateClassroomData(sampleData);

            this.setProgress(70, '处理数据...');
            DataService.loadClassrooms(sampleData);

            this.renderInputDisplay();
            this.setProgress(100, '样例数据加载完成');

            Utils.showNotification('样例数据加载成功', 'success');
            this.updateSystemStatus('ready', '数据已加载');
        } catch (error) {
            console.error('样例数据加载失败:', error);
            Utils.showNotification(`加载失败: ${error.message}`, 'error');
            this.updateSystemStatus('error', '加载失败');
        } finally {
            this.setProcessing(false);
        }
    },

    renderInputDisplay() {
        const state = DataService.getState();
        const display = this.elements.inputDisplay;

        if (!state.classrooms || state.classrooms.length === 0) {
            display.innerHTML = '<p class="placeholder">请加载教室档案数据</p>';
            return;
        }

        let html = '';
        for (const classroom of state.classrooms) {
            const intensityClass = classroom.intensity 
                ? `intensity-${classroom.intensity}` 
                : '';
            
            const intensityText = classroom.intensity 
                ? this.getIntensityText(classroom.intensity)
                : '未分析';

            html += `
                <div class="data-item ${intensityClass}">
                    <h4>${Utils.escapeHtml(classroom.name)} (${Utils.escapeHtml(classroom.id)})</h4>
                    <span class="detail">面积: ${classroom.area} ㎡</span>
                    <span class="detail">上次清洁: ${Utils.escapeHtml(classroom.lastCleaningDate)}</span>
                    <span class="detail">课程数: ${classroom.courses.length}</span>
                    <span class="detail">使用强度: <strong>${intensityText}</strong></span>
                    ${classroom.avgWeightedHours ? `<span class="detail">加权小时数: ${classroom.avgWeightedHours}/课程</span>` : ''}
                </div>
            `;
        }

        display.innerHTML = html;
    },

    getIntensityText(intensity) {
        const texts = {
            high: '高强度',
            medium: '中等强度',
            low: '低强度'
        };
        return texts[intensity] || intensity;
    },

    async processIntensity() {
        if (this.isProcessing) return;

        const state = DataService.getState();
        if (!state.classrooms || state.classrooms.length === 0) {
            Utils.showNotification('请先加载教室档案数据', 'error');
            return;
        }

        try {
            this.setProcessing(true);
            this.setProgress(20, '分析课程强度...');

            await this.delay(300);

            this.setProgress(50, '计算加权课程时长...');
            const processedClassrooms = BusinessLogic.processCourseIntensity(state.classrooms);

            this.setProgress(80, '保存分析结果...');
            DataService.setIntensityProcessed(processedClassrooms);

            this.renderInputDisplay();
            this.renderHistory();
            this.setProgress(100, '强度分析完成');

            Utils.showNotification('课程强度分析完成', 'success');
            this.updateSystemStatus('success', '强度分析完成');
        } catch (error) {
            console.error('强度分析失败:', error);
            Utils.showNotification(`强度分析失败: ${error.message}`, 'error');
            this.updateSystemStatus('error', '分析失败');
        } finally {
            this.setProcessing(false);
        }
    },

    async generateCleanPlans() {
        if (this.isProcessing) return;

        const state = DataService.getState();
        if (!state.intensityProcessed) {
            Utils.showNotification('请先处理课程强度', 'error');
            return;
        }

        try {
            this.setProcessing(true);
            this.setProgress(20, '生成清洁计划...');

            await this.delay(300);

            this.setProgress(50, '计算清洁周期...');
            const plans = BusinessLogic.generateCleaningPlans(state.classrooms);

            this.setProgress(80, '保存清洁计划...');
            DataService.setCleaningPlans(plans);

            this.renderCleaningPlans();
            this.renderHistory();
            this.setProgress(100, '清洁计划生成完成');

            Utils.showNotification(`生成了 ${plans.length} 个清洁计划`, 'success');
            this.updateSystemStatus('success', '清洁计划已生成');
        } catch (error) {
            console.error('清洁计划生成失败:', error);
            Utils.showNotification(`生成失败: ${error.message}`, 'error');
            this.updateSystemStatus('error', '生成失败');
        } finally {
            this.setProcessing(false);
        }
    },

    async trackDamage() {
        if (this.isProcessing) return;

        const state = DataService.getState();
        if (!state.intensityProcessed || state.cleaningPlans.length === 0) {
            Utils.showNotification('请先生成清洁计划', 'error');
            return;
        }

        try {
            this.setProcessing(true);
            this.setProgress(20, '分析损伤风险...');

            await this.delay(300);

            this.setProgress(50, '评估各区域风险等级...');
            const records = BusinessLogic.trackDamageAreas(state.classrooms, state.cleaningPlans);

            this.setProgress(80, '保存损伤记录...');
            DataService.setDamageRecords(records);

            this.renderDamageRecords();
            this.renderHistory();
            this.setProgress(100, '损伤追踪完成');

            Utils.showNotification(`追踪到 ${records.length} 个损伤区域`, 'success');
            this.updateSystemStatus('success', '损伤追踪完成');
        } catch (error) {
            console.error('损伤追踪失败:', error);
            Utils.showNotification(`追踪失败: ${error.message}`, 'error');
            this.updateSystemStatus('error', '追踪失败');
        } finally {
            this.setProcessing(false);
        }
    },

    async runAllProcesses() {
        if (this.isProcessing) return;

        const state = DataService.getState();
        if (!state.classrooms || state.classrooms.length === 0) {
            Utils.showNotification('请先加载教室档案数据', 'error');
            return;
        }

        try {
            this.setProcessing(true);

            if (!state.intensityProcessed) {
                this.setProgress(10, '步骤 1/4: 分析课程强度...');
                await this.delay(200);
                const processedClassrooms = BusinessLogic.processCourseIntensity(state.classrooms);
                DataService.setIntensityProcessed(processedClassrooms);
                this.renderInputDisplay();
            }

            const updatedState1 = DataService.getState();
            this.setProgress(35, '步骤 2/4: 生成清洁计划...');
            await this.delay(200);
            const plans = BusinessLogic.generateCleaningPlans(updatedState1.classrooms);
            DataService.setCleaningPlans(plans);
            this.renderCleaningPlans();

            const updatedState2 = DataService.getState();
            this.setProgress(60, '步骤 3/4: 追踪损伤区域...');
            await this.delay(200);
            const records = BusinessLogic.trackDamageAreas(updatedState2.classrooms, updatedState2.cleaningPlans);
            DataService.setDamageRecords(records);
            this.renderDamageRecords();

            const finalState = DataService.getState();
            this.setProgress(85, '步骤 4/4: 计算统计数据...');
            await this.delay(200);
            const stats = BusinessLogic.calculateStatistics(
                finalState.classrooms,
                finalState.cleaningPlans,
                finalState.damageRecords
            );
            DataService.setStatistics(stats);
            this.renderStatistics();

            this.renderHistory();
            this.setProgress(100, '全部流程完成');

            Utils.showNotification('所有处理流程已完成', 'success');
            this.updateSystemStatus('success', '处理完成');
        } catch (error) {
            console.error('流程执行失败:', error);
            Utils.showNotification(`执行失败: ${error.message}`, 'error');
            this.updateSystemStatus('error', '执行失败');
        } finally {
            this.setProcessing(false);
        }
    },

    async resetState() {
        if (this.isProcessing) return;

        const state = DataService.getState();
        if (state.classrooms.length === 0) {
            Utils.showNotification('没有可重置的数据', 'info');
            return;
        }

        try {
            this.setProcessing(true);
            this.setProgress(30, '重置状态...');

            await this.delay(200);

            DataService.resetState();

            this.renderInputDisplay();
            this.renderCleaningPlans();
            this.renderDamageRecords();
            this.renderStatistics();
            this.renderHistory();

            this.setProgress(100, '状态已重置');

            Utils.showNotification('状态已重置，保留输入数据', 'info');
            this.updateSystemStatus('ready', '状态已重置');
        } catch (error) {
            console.error('重置失败:', error);
            Utils.showNotification(`重置失败: ${error.message}`, 'error');
        } finally {
            this.setProcessing(false);
        }
    },

    async exportResults() {
        if (this.isProcessing) return;

        if (!DataService.canExport()) {
            Utils.showNotification('请完成所有处理流程后再导出', 'error');
            return;
        }

        try {
            this.setProcessing(true);
            this.setProgress(30, '准备导出数据...');

            await this.delay(200);

            const exportInfo = DataService.getExportData();

            if (exportInfo.isDuplicate) {
                this.setProgress(50, '检测到重复导出...');
                this.elements.exportStatus.textContent = '数据未变化，无需重复导出';
                Utils.showNotification('导出数据与上次一致，无需重复导出', 'info');
                return;
            }

            this.setProgress(70, '生成导出文件...');
            const filename = `dance-floor-maintenance-${Utils.formatDateShort(new Date())}.json`;
            
            Utils.exportToJSON(exportInfo.data, filename);

            this.setProgress(100, '导出完成');
            this.elements.exportStatus.textContent = `已导出: ${filename}`;

            Utils.showNotification(`成功导出到 ${filename}`, 'success');
        } catch (error) {
            console.error('导出失败:', error);
            Utils.showNotification(`导出失败: ${error.message}`, 'error');
        } finally {
            this.setProcessing(false);
        }
    },

    renderCleaningPlans() {
        const state = DataService.getState();
        const content = this.elements.cleaningContent;

        if (!state.cleaningPlans || state.cleaningPlans.length === 0) {
            content.innerHTML = '<p class="placeholder">暂无清洁计划</p>';
            return;
        }

        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>教室</th>
                        <th>强度</th>
                        <th>优先级</th>
                        <th>上次清洁</th>
                        <th>下次清洁</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const plan of state.cleaningPlans) {
            const priorityBadge = this.getPriorityBadge(plan.priority);
            const intensityText = this.getIntensityText(plan.intensity);

            html += `
                <tr>
                    <td>${Utils.escapeHtml(plan.classroomName)}</td>
                    <td>${Utils.escapeHtml(intensityText)}</td>
                    <td><span class="badge ${priorityBadge.class}">${priorityBadge.text}</span></td>
                    <td>${Utils.escapeHtml(plan.lastCleaningDate)}</td>
                    <td>${Utils.escapeHtml(plan.nextCleaningDate)}</td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
            <div style="margin-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem; font-size: 0.875rem;">清洁任务详情</h4>
        `;

        for (const plan of state.cleaningPlans) {
            html += `
                <div class="data-item" style="margin-bottom: 0.5rem;">
                    <strong>${Utils.escapeHtml(plan.classroomName)}</strong>
                    <span class="detail">${Utils.escapeHtml(plan.interval.description)}</span>
                    <span class="detail">清洁任务:</span>
                    <ul style="margin-left: 1.5rem; font-size: 0.8125rem; color: #495057;">
                        ${plan.tasks.map(t => `<li>${Utils.escapeHtml(t.description)} (${Utils.escapeHtml(t.frequency)})</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        html += '</div>';
        content.innerHTML = html;
    },

    getPriorityBadge(priority) {
        const badges = {
            urgent: { class: 'badge-danger', text: '紧急' },
            high: { class: 'badge-warning', text: '高优先级' },
            normal: { class: 'badge-success', text: '正常' }
        };
        return badges[priority] || badges.normal;
    },

    renderDamageRecords() {
        const state = DataService.getState();
        const content = this.elements.damageContent;

        if (!state.damageRecords || state.damageRecords.length === 0) {
            content.innerHTML = '<p class="placeholder">暂无损伤记录</p>';
            return;
        }

        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>教室</th>
                        <th>区域</th>
                        <th>风险等级</th>
                        <th>维护建议</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const record of state.damageRecords) {
            const riskBadge = this.getRiskBadge(record.risk);

            html += `
                <tr>
                    <td>${Utils.escapeHtml(record.classroomName)}</td>
                    <td>${Utils.escapeHtml(record.area)}</td>
                    <td><span class="badge ${riskBadge.class}">${riskBadge.text}</span></td>
                    <td>${Utils.escapeHtml(record.maintenanceAction)}</td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
        `;

        content.innerHTML = html;
    },

    getRiskBadge(risk) {
        const badges = {
            '紧急': { class: 'badge-danger', text: '紧急' },
            '高风险': { class: 'badge-warning', text: '高风险' },
            '中等风险': { class: 'badge-info', text: '中等' },
            '低风险': { class: 'badge-success', text: '低风险' }
        };
        return badges[risk] || badges['低风险'];
    },

    renderStatistics() {
        const state = DataService.getState();
        const content = this.elements.statisticsContent;

        if (!state.statistics) {
            content.innerHTML = '<p class="placeholder">暂无统计数据</p>';
            return;
        }

        const stats = state.statistics;

        let html = `
            <div class="stat-card">
                <h4>教室概况</h4>
                <div class="stat-row"><span class="label">总教室数</span><span class="value">${stats.summary.totalClassrooms}</span></div>
                <div class="stat-row"><span class="label">高强度</span><span class="value">${stats.summary.highIntensity}</span></div>
                <div class="stat-row"><span class="label">中等强度</span><span class="value">${stats.summary.mediumIntensity}</span></div>
                <div class="stat-row"><span class="label">低强度</span><span class="value">${stats.summary.lowIntensity}</span></div>
            </div>

            <div class="stat-card">
                <h4>清洁计划</h4>
                <div class="stat-row"><span class="label">总计划数</span><span class="value">${stats.cleaning.totalPlans}</span></div>
                <div class="stat-row"><span class="label">紧急</span><span class="value">${stats.cleaning.urgent}</span></div>
                <div class="stat-row"><span class="label">高优先级</span><span class="value">${stats.cleaning.highPriority}</span></div>
                <div class="stat-row"><span class="label">平均未清洁天数</span><span class="value">${stats.cleaning.avgDaysSinceClean} 天</span></div>
            </div>

            <div class="stat-card">
                <h4>损伤风险</h4>
                <div class="stat-row"><span class="label">总记录数</span><span class="value">${stats.damage.totalRecords}</span></div>
                <div class="stat-row"><span class="label">紧急</span><span class="value">${stats.damage.critical}</span></div>
                <div class="stat-row"><span class="label">高风险</span><span class="value">${stats.damage.highRisk}</span></div>
                <div class="stat-row"><span class="label">中等风险</span><span class="value">${stats.damage.mediumRisk}</span></div>
                <div class="stat-row"><span class="label">低风险</span><span class="value">${stats.damage.lowRisk}</span></div>
            </div>
        `;

        if (stats.recommendations.length > 0) {
            html += `
                <div class="stat-card">
                    <h4>重要建议</h4>
                    <ul style="margin-left: 1.5rem; font-size: 0.8125rem; color: #495057;">
                        ${stats.recommendations.map(r => {
                            const badgeClass = r.level === 'critical' ? 'badge-danger' : 
                                              r.level === 'high' ? 'badge-warning' : 'badge-info';
                            return `<li><span class="badge ${badgeClass}">${r.level}</span> ${Utils.escapeHtml(r.text)}</li>`;
                        }).join('')}
                    </ul>
                </div>
            `;
        }

        content.innerHTML = html;
    },

    renderHistory() {
        const state = DataService.getState();
        const content = this.elements.historyContent;

        if (!state.history || state.history.length === 0) {
            content.innerHTML = '<p class="placeholder">暂无变更历史</p>';
            return;
        }

        const sortedHistory = [...state.history].reverse();
        let html = '';

        for (const entry of sortedHistory) {
            html += `
                <div class="history-item">
                    <div class="timestamp">${Utils.formatDate(entry.timestamp)}</div>
                    <div class="action">${Utils.escapeHtml(entry.action)}</div>
                    <div class="details">${Utils.escapeHtml(entry.details)}</div>
                </div>
            `;
        }

        content.innerHTML = html;
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
