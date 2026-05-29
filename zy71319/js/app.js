const App = {
    currentObject: null,
    currentTab: 'normal',
    lastSubmissionQueue: [],

    init: function() {
        this.renderMaterialLibrary();
        this.bindEvents();
        this.updateRecordsList();
        this.updateRecordCounts();
    },

    renderMaterialLibrary: function() {
        const library = document.getElementById('material-library');
        const materials = Storage.getMaterials();
        
        library.innerHTML = '';
        
        for (let i = 0; i < materials.length; i++) {
            const material = materials[i];
            const element = document.createElement('div');
            element.className = 'material-item';
            element.draggable = true;
            element.dataset.material = JSON.stringify(material);
            
            let iconHtml = '<div class="material-icon">' + (material.icon || '📦') + '</div>';
            let nameHtml = '<div class="material-name">' + material.name + '</div>';
            let densityHtml = '<div class="material-density">' + material.density.toFixed(2) + ' g/cm³</div>';
            element.innerHTML = iconHtml + nameHtml + densityHtml;
            
            element.addEventListener('dblclick', (function(mat) {
                return function() {
                    App.fillFormFromMaterial(mat);
                };
            })(material));
            
            library.appendChild(element);
        }
        ChartManager.init();
    },

    bindEvents: function() {
        document.getElementById('input-volume').addEventListener('input', function() { App.validateForm(); });
        document.getElementById('input-mass').addEventListener('input', function() { App.validateForm(); });
        document.getElementById('input-displacement').addEventListener('input', function() { App.validateForm(); });
        document.getElementById('input-liquid-density').addEventListener('change', function(e) {
            Interaction.setLiquidDensity(e.target.value || 1.0);
            App.validateForm();
        });

        document.getElementById('btn-add-material').addEventListener('click', function() { App.addMaterial(); });
        document.getElementById('btn-clear-form').addEventListener('click', function() { App.clearForm(); });
        document.getElementById('btn-clear-tank').addEventListener('click', function() { Interaction.clearTank(); });
        document.getElementById('btn-undo').addEventListener('click', function() { App.undo(); });
        document.getElementById('btn-submit').addEventListener('click', function() { App.submitRecord(); });
        document.getElementById('btn-review').addEventListener('click', function() { App.showReviewModal(); });
        document.getElementById('btn-export').addEventListener('click', function() { App.exportScreenshot(); });
        document.getElementById('btn-save-report').addEventListener('click', function() { App.showReportPreview(); });
        document.getElementById('btn-download-report').addEventListener('click', function() { App.downloadReport(); });

        document.getElementById('close-review').addEventListener('click', function() { App.closeModal('review-modal'); });
        document.getElementById('close-anomaly').addEventListener('click', function() { App.closeModal('anomaly-modal'); });
        document.getElementById('close-report').addEventListener('click', function() { App.closeModal('report-modal'); });

        const modals = document.querySelectorAll('.modal');
        for (let i = 0; i < modals.length; i++) {
            modals[i].addEventListener('click', function(e) {
                if (e.target.classList.contains('modal')) {
                    e.target.classList.remove('active');
                }
            });
        }

        const tabBtns = document.querySelectorAll('.tab-btn');
        for (let i = 0; i < tabBtns.length; i++) {
            tabBtns[i].addEventListener('click', function() {
                const allBtns = document.querySelectorAll('.tab-btn');
                for (let j = 0; j < allBtns.length; j++) {
                    allBtns[j].classList.remove('active');
                }
                this.classList.add('active');
                App.currentTab = this.dataset.tab;
                App.updateRecordsList();
            });
        }
    },

    fillFormFromMaterial: function(material) {
        document.getElementById('input-name').value = material.name;
        document.getElementById('input-volume').value = material.volume;
        document.getElementById('input-mass').value = material.mass;
        this.validateForm();
        this.showToast('已加载"' + material.name + '"的数据，可编辑后添加到材料库或直接拖入水槽实验', 'info');
    },

    validateForm: function() {
        const record = this.getFormData();
        const validation = Physics.validateRecord(record);
        this.showValidationResult(validation);

        const fields = ['name', 'volume', 'mass', 'liquid-density', 'displacement'];
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            const input = document.getElementById('input-' + field);
            if (input) {
                input.classList.remove('error');
            }
        }

        for (let i = 0; i < validation.errors.length; i++) {
            const error = validation.errors[i];
            const fieldId = error.field === 'liquidDensity' ? 'liquid-density' : error.field;
            const input = document.getElementById('input-' + fieldId);
            if (input) {
                input.classList.add('error');
            }
        }

        return validation;
    },

    getFormData: function() {
        return {
            name: document.getElementById('input-name').value.trim(),
            volume: document.getElementById('input-volume').value,
            mass: document.getElementById('input-mass').value,
            liquidDensity: document.getElementById('input-liquid-density').value,
            displacement: document.getElementById('input-displacement').value,
            operator: document.getElementById('input-operator').value.trim(),
            notes: document.getElementById('input-notes').value.trim()
        };
    },

    showValidationResult: function(validation) {
        const container = document.getElementById('validation-result');
        
        if (validation.all.length === 0) {
            container.innerHTML = '<p class="hint">输入数据后自动校验</p>';
            return;
        }

        let html = '';
        for (let i = 0; i < validation.all.length; i++) {
            const item = validation.all[i];
            let icon = 'ℹ️';
            if (item.type === 'error') icon = '❌';
            else if (item.type === 'warning') icon = '⚠️';
            else if (item.type === 'success') icon = '✅';
            
            html += '<div class="validation-item ' + item.type + '">';
            html += '<span>' + icon + '</span>';
            html += '<span>' + item.message + '</span>';
            html += '</div>';
        }
        
        if (validation.isValid) {
            html += '<div class="validation-item success">';
            html += '<span>✅</span>';
            html += '<span>数据校验通过，可以提交</span>';
            html += '</div>';
        }
        
        container.innerHTML = html;
    },

    addMaterial: function() {
        const validation = this.validateForm();
        const record = this.getFormData();

        if (!validation.isValid) {
            this.showToast('请先修正数据错误后再添加', 'error');
            return;
        }

        const volume = Number(record.volume);
        const mass = Number(record.mass);
        const density = Physics.calculateDensity(mass, volume);

        const colors = ['#667eea', '#48bb78', '#ed8936', '#fc8181', '#4299e1', '#9f7aea'];
        const icons = ['📦', '🔷', '🔶', '🟣', '🟢', '🟠'];
        
        const newMaterial = {
            name: record.name,
            volume: volume,
            mass: mass,
            density: density,
            color: colors[Math.floor(Math.random() * colors.length)],
            icon: icons[Math.floor(Math.random() * icons.length)]
        };

        Storage.addMaterial(newMaterial);
        this.renderMaterialLibrary();
        this.clearForm();
        this.showToast('已添加"' + record.name + '"到材料库', 'success');
    },

    clearForm: function() {
        document.getElementById('input-name').value = '';
        document.getElementById('input-volume').value = '';
        document.getElementById('input-mass').value = '';
        document.getElementById('input-liquid-density').value = '1.0';
        document.getElementById('input-displacement').value = '';
        document.getElementById('input-notes').value = '';
        
        const inputs = document.querySelectorAll('input.error, textarea.error');
        for (let i = 0; i < inputs.length; i++) {
            inputs[i].classList.remove('error');
        }
        
        document.getElementById('validation-result').innerHTML = '<p class="hint">输入数据后自动校验</p>';
        
        Interaction.setLiquidDensity(1.0);
    },

    submitRecord: function() {
        const tankData = Interaction.getTankDataForSubmission();
        
        if (tankData.length === 0) {
            this.showToast('请先将物体拖入水槽再提交', 'warning');
            return;
        }

        let submittedCount = 0;
        let anomalyCount = 0;

        for (let i = 0; i < tankData.length; i++) {
            const objData = tankData[i];
            const record = {
                name: objData.name,
                volume: objData.volume,
                mass: objData.mass,
                liquidDensity: objData.liquidDensity,
                displacement: objData.displacement.toFixed(2),
                operator: document.getElementById('input-operator').value.trim(),
                notes: document.getElementById('input-notes').value.trim()
            };

            const validation = Physics.validateRecord(record);
            const analysis = Physics.analyzeRecord(record);

            const result = Storage.addRecord(record, validation, analysis);

            if (result.duplicate) {
                this.showToast('"' + record.name + '"的相同数据1分钟内已提交，已跳过', 'warning');
                continue;
            } else if (result.success) {
                submittedCount++;
                if (validation.isValid) {
                    ChartManager.addDataPoint(result.record);
                } else {
                    anomalyCount++;
                }
            }
        }

        if (submittedCount > 0) {
            this.updateRecordsList();
            this.updateRecordCounts();
            
            if (anomalyCount > 0) {
                this.showToast('已提交' + submittedCount + '条记录（含' + anomalyCount + '条异常）', anomalyCount > 0 ? 'warning' : 'success');
            } else {
                this.showToast('已提交' + submittedCount + '条记录', 'success');
            }
            
            Interaction.clearTank();
        } else {
            this.showToast('没有可提交的记录', 'warning');
        }
    },

    undo: function() {
        const action = Storage.popUndo();
        
        if (!action) {
            this.showToast('没有可撤回的操作', 'warning');
            return;
        }

        if (action.type === 'add_record') {
            ChartManager.removeDataPoint(action.record.id);
            this.updateRecordsList();
            this.updateRecordCounts();
            this.showToast('已撤回"' + action.record.name + '"的记录', 'success');
        }
    },

    updateRecordsList: function() {
        const container = document.getElementById('records-list');
        const records = Storage.getRecords();
        
        let filteredRecords;
        if (this.currentTab === 'normal') {
            filteredRecords = records.filter(function(r) { return r.status === 'normal'; });
        } else if (this.currentTab === 'anomaly') {
            filteredRecords = records.filter(function(r) { return r.status === 'anomaly'; });
        } else {
            filteredRecords = records;
        }

        if (filteredRecords.length === 0) {
            container.innerHTML = '<p class="hint">暂无记录</p>';
            return;
        }

        let html = '';
        const displayRecords = filteredRecords.slice(0, 50);
        for (let i = 0; i < displayRecords.length; i++) {
            const record = displayRecords[i];
            const statusClass = record.status;
            const statusText = record.status === 'normal' ? '正常' : '异常';
            const stateIcon = record.analysis && record.analysis.stateIcon ? record.analysis.stateIcon : '';
            const stateLabel = record.analysis && record.analysis.stateLabel ? record.analysis.stateLabel : '';
            const density = record.analysis && record.analysis.objectDensity ? record.analysis.objectDensity.toFixed(2) : '-';
            const buoyancy = record.analysis && record.analysis.buoyancy ? record.analysis.buoyancy.toFixed(3) : '-';
            const time = new Date(record.timestamp).toLocaleString('zh-CN');
            const operator = record.operator ? ' | ' + record.operator : '';
            
            html += '<div class="record-item ' + statusClass + '" data-record-id="' + record.id + '">';
            html += '<div class="record-header">';
            html += '<span class="record-name">' + record.name + '</span>';
            html += '<span class="record-status ' + statusClass + '">' + statusText + '</span>';
            html += '</div>';
            html += '<div class="record-meta">';
            html += stateIcon + ' ' + stateLabel + ' | ';
            html += 'ρ=' + density + ' g/cm³ | ';
            html += 'F浮=' + buoyancy + ' N';
            html += '</div>';
            html += '<div class="record-time">' + time + operator + '</div>';
            html += '</div>';
        }

        container.innerHTML = html;

        const recordItems = container.querySelectorAll('.record-item');
        for (let i = 0; i < recordItems.length; i++) {
            recordItems[i].addEventListener('click', function() {
                const recordId = this.dataset.recordId;
                App.showRecordDetail(recordId);
            });
        }
    },

    showRecordDetail: function(recordId) {
        const records = Storage.getRecords();
        let record = null;
        for (let i = 0; i < records.length; i++) {
            if (records[i].id === recordId) {
                record = records[i];
                break;
            }
        }
        
        if (!record) return;

        if (record.status === 'anomaly') {
            this.showAnomalyDetail(record);
        } else {
            this.showNormalRecordDetail(record);
        }
    },

    showAnomalyDetail: function(record) {
        const container = document.getElementById('anomaly-detail');
        
        let errorsHtml = '';
        for (let i = 0; i < record.validation.errors.length; i++) {
            const error = record.validation.errors[i];
            errorsHtml += '<div class="anomaly-error-item">⚠️ ' + error.message + '</div>';
        }

        let displacementText = record.displacement !== null ? record.displacement + ' cm³' : '未填写（自动计算）';
        let densityText = record.analysis && record.analysis.objectDensity ? record.analysis.objectDensity.toFixed(4) : '-';
        let operatorText = record.operator || '-';
        let timeText = new Date(record.timestamp).toLocaleString('zh-CN');

        let html = '';
        html += '<div class="anomaly-detail-section">';
        html += '<h3>📝 原始记录数据</h3>';
        html += '<table>';
        html += '<tr><td>物体名称</td><td>' + record.name + '</td></tr>';
        html += '<tr><td>体积</td><td>' + record.volume + ' cm³</td></tr>';
        html += '<tr><td>质量</td><td>' + record.mass + ' g</td></tr>';
        html += '<tr><td>液体密度</td><td>' + record.liquidDensity + ' g/cm³</td></tr>';
        html += '<tr><td>排水量</td><td>' + displacementText + '</td></tr>';
        html += '<tr><td>计算密度</td><td>' + densityText + ' g/cm³</td></tr>';
        html += '<tr><td>操作者</td><td>' + operatorText + '</td></tr>';
        html += '<tr><td>提交时间</td><td>' + timeText + '</td></tr>';
        html += '</table>';
        html += '</div>';
        html += '<div class="anomaly-detail-section">';
        html += '<h3>❌ 检测到的问题</h3>';
        html += '<div class="anomaly-errors">';
        html += errorsHtml;
        html += '</div>';
        html += '</div>';
        
        if (record.notes) {
            html += '<div class="anomaly-detail-section">';
            html += '<h3>📋 备注</h3>';
            html += '<p style="background: #f7fafc; padding: 12px; border-radius: 8px;">' + record.notes + '</p>';
            html += '</div>';
        }

        container.innerHTML = html;

        document.getElementById('anomaly-modal').classList.add('active');
    },

    showNormalRecordDetail: function(record) {
        const container = document.getElementById('anomaly-detail');
        
        const analysis = record.analysis;
        const comparisons = Physics.generateComparison(analysis);

        let comparisonsHtml = '';
        for (let i = 0; i < comparisons.length; i++) {
            const c = comparisons[i];
            comparisonsHtml += '<div style="background: #f7fafc; padding: 12px; border-radius: 8px; margin-bottom: 8px;">';
            comparisonsHtml += '<strong>' + c.label + ':</strong> ' + c.value1 + ' ' + c.relation + ' ' + c.value2;
            comparisonsHtml += '<br>';
            comparisonsHtml += '<span style="color: #48bb78;">→ ' + c.conclusion + '</span>';
            comparisonsHtml += '</div>';
        }

        let html = '';
        html += '<div class="anomaly-detail-section">';
        html += '<h3>📊 实验结果</h3>';
        html += '<table>';
        html += '<tr><td>物体名称</td><td>' + record.name + '</td></tr>';
        html += '<tr><td>体积</td><td>' + record.volume + ' cm³</td></tr>';
        html += '<tr><td>质量</td><td>' + record.mass + ' g</td></tr>';
        html += '<tr><td>物体密度</td><td>' + analysis.objectDensity.toFixed(4) + ' g/cm³</td></tr>';
        html += '<tr><td>液体密度</td><td>' + analysis.liquidDensity.toFixed(4) + ' g/cm³</td></tr>';
        html += '<tr><td>排水量</td><td>' + analysis.displacement.toFixed(2) + ' cm³</td></tr>';
        html += '<tr><td>浮力</td><td>' + analysis.buoyancy.toFixed(4) + ' N</td></tr>';
        html += '<tr><td>重力</td><td>' + analysis.gravity.toFixed(4) + ' N</td></tr>';
        html += '<tr><td>状态</td><td>' + analysis.stateIcon + ' ' + analysis.stateLabel + '</td></tr>';
        html += '<tr><td>水位上升</td><td>' + analysis.waterLevelRise.toFixed(2) + ' cm</td></tr>';
        html += '</table>';
        html += '</div>';
        html += '<div class="anomaly-detail-section">';
        html += '<h3>🔬 数据对比</h3>';
        html += comparisonsHtml;
        html += '</div>';

        container.innerHTML = html;

        document.getElementById('anomaly-modal').querySelector('h2').textContent = '📋 实验记录详情';
        document.getElementById('anomaly-modal').classList.add('active');
    },

    updateRecordCounts: function() {
        const stats = Storage.getRecordStats();
        document.getElementById('count-normal').textContent = stats.normal;
        document.getElementById('count-anomaly').textContent = stats.anomaly;
        document.getElementById('count-all').textContent = stats.total;
    },

    showReviewModal: function() {
        const container = document.getElementById('review-list');
        const history = Storage.getHistory();

        if (history.length === 0) {
            container.innerHTML = '<p class="hint">暂无历史记录</p>';
            document.getElementById('review-modal').classList.add('active');
            return;
        }

        let html = '';
        for (let i = 0; i < history.length; i++) {
            const session = history[i];
            const date = new Date(session.startTime);
            const dateStr = date.toLocaleDateString('zh-CN');
            const timeStr = date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
            
            html += '<div class="review-item" data-session-id="' + session.sessionId + '">';
            html += '<div class="review-item-header">';
            html += '<span class="review-item-title">' + dateStr + ' 的实验</span>';
            html += '<span class="review-item-meta">' + timeStr + '</span>';
            html += '</div>';
            html += '<div class="review-item-stats">';
            html += '<span style="color: #48bb78;">✅ 正常 ' + session.normalCount + '</span>';
            html += '<span style="color: #f56565;">⚠️ 异常 ' + session.anomalyCount + '</span>';
            html += '<span style="color: #667eea;">📊 总计 ' + (session.normalCount + session.anomalyCount) + '</span>';
            html += '</div>';
            html += '</div>';
        }

        container.innerHTML = html;

        const reviewItems = container.querySelectorAll('.review-item');
        for (let i = 0; i < reviewItems.length; i++) {
            reviewItems[i].addEventListener('click', function() {
                const sessionId = this.dataset.sessionId;
                App.loadSession(sessionId);
            });
        }

        document.getElementById('review-modal').classList.add('active');
    },

    loadSession: function(sessionId) {
        const records = Storage.getSessionRecords(sessionId);
        
        if (records.length > 0) {
            this.showToast('已加载历史会话，共' + records.length + '条记录', 'info');
            this.closeModal('review-modal');
        }
    },

    showReportPreview: function() {
        const reportHtml = ReportManager.generateReport();
        document.getElementById('report-content').innerHTML = reportHtml;
        document.getElementById('report-modal').classList.add('active');
    },

    downloadReport: function() {
        const reportHtml = ReportManager.generateReport();
        ReportManager.downloadReport(reportHtml);
        this.showToast('报告已开始下载', 'success');
    },

    exportScreenshot: async function() {
        this.showToast('正在生成截图...', 'info');
        
        const result = await ReportManager.exportScreenshot();
        
        if (result.success) {
            this.showToast('截图已保存：' + result.filename, 'success');
        } else {
            this.showToast('截图导出失败', 'error');
        }
    },

    closeModal: function(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    showToast: function(message, type) {
        if (!type) type = 'info';
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        
        setTimeout(function() {
            toast.classList.remove('show');
        }, 3000);
    },

    updateCurrentObject: function(obj) {
        this.currentObject = obj;
    },

    clearCurrentObject: function() {
        this.currentObject = null;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    Interaction.init();
    App.init();
});
