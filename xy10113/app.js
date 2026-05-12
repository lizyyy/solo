class LabelReviewTool {
    constructor() {
        this.labelData = [];
        this.materialData = [];
        this.reviewRecords = [];
        this.history = [];
        this.fieldMapping = {
            labelBatch: null,
            materialBatch: null,
            labelMaterial: null,
            materialMaterial: null
        };
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.loadHistory();
        this.loadCurrentProgress();
        this.bindEvents();
        this.renderHistory();
        this.initTabs();
    }

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('importLabelBtn').addEventListener('click', () => this.importFile('label'));
        document.getElementById('importMaterialBtn').addEventListener('click', () => this.importFile('material'));
        
        document.getElementById('labelFile').addEventListener('change', (e) => this.updateFileInfo('label', e.target));
        document.getElementById('materialFile').addEventListener('change', (e) => this.updateFileInfo('material', e.target));

        document.getElementById('confirmMappingBtn').addEventListener('click', () => this.confirmFieldMapping());
        
        document.getElementById('reviewFilter').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.renderReviewList();
        });

        document.getElementById('batchPassBtn').addEventListener('click', () => this.batchReview('passed'));
        document.getElementById('batchFailBtn').addEventListener('click', () => this.batchReview('failed'));

        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.confirmClearHistory());
        document.getElementById('importHistoryBtn').addEventListener('click', () => document.getElementById('historyFile').click());
        document.getElementById('historyFile').addEventListener('change', (e) => this.importHistoryData(e.target));

        document.getElementById('exportCurrentCsv').addEventListener('click', () => this.exportCurrent('csv'));
        document.getElementById('exportCurrentJson').addEventListener('click', () => this.exportCurrent('json'));
        document.getElementById('exportCurrentExcel').addEventListener('click', () => this.exportCurrent('excel'));
        
        document.getElementById('exportSummaryCsv').addEventListener('click', () => this.exportSummary('csv'));
        document.getElementById('exportSummaryJson').addEventListener('click', () => this.exportSummary('json'));
        
        document.getElementById('exportFullBackup').addEventListener('click', () => this.exportFullBackup());

        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
    }

    initTabs() {
        this.switchTab('import');
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        if (tabName === 'review') {
            this.renderReviewList();
        } else if (tabName === 'history') {
            this.renderHistory();
        }
    }

    updateFileInfo(type, input) {
        const file = input.files[0];
        const infoDiv = document.getElementById(`${type}FileInfo`);
        
        if (file) {
            const sizeKB = (file.size / 1024).toFixed(2);
            infoDiv.innerHTML = `
                <strong>${file.name}</strong><br>
                ${sizeKB} KB · ${file.type || '未知类型'}
            `;
            infoDiv.style.color = '#11998e';
        } else {
            infoDiv.textContent = '未选择文件';
            infoDiv.style.color = '#666';
        }
    }

    async importFile(type) {
        const fileInput = document.getElementById(`${type}File`);
        const file = fileInput.files[0];

        if (!file) {
            this.showToast('请先选择文件', 'error');
            return;
        }

        try {
            const data = await this.parseFile(file);
            
            if (!data || data.length === 0) {
                this.showToast('文件内容为空', 'error');
                return;
            }

            if (type === 'label') {
                this.labelData = data;
                this.showToast(`成功导入 ${data.length} 条标签数据`, 'success');
            } else {
                this.materialData = data;
                this.showToast(`成功导入 ${data.length} 条物料数据`, 'success');
            }

            this.checkReadyForMapping();
            
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast(`导入失败: ${error.message}`, 'error');
        }
    }

    parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const fileName = file.name.toLowerCase();

            reader.onload = (e) => {
                try {
                    if (fileName.endsWith('.json')) {
                        resolve(JSON.parse(e.target.result));
                    } else if (fileName.endsWith('.csv')) {
                        resolve(this.parseCSV(e.target.result));
                    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                        const workbook = XLSX.read(e.target.result, { type: 'binary' });
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        resolve(XLSX.utils.sheet_to_json(firstSheet));
                    } else {
                        reject(new Error('不支持的文件格式'));
                    }
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('文件读取失败'));

            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                reader.readAsBinaryString(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = this.splitCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.splitCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index].trim();
                });
                data.push(row);
            }
        }

        return data;
    }

    splitCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }

    checkReadyForMapping() {
        if (this.labelData.length > 0 && this.materialData.length > 0) {
            this.showFieldMapping();
            this.showDataPreview();
        }
    }

    showFieldMapping() {
        const mappingSection = document.getElementById('fieldMapping');
        mappingSection.style.display = 'block';

        const labelFields = Object.keys(this.labelData[0] || {});
        const materialFields = Object.keys(this.materialData[0] || {});

        this.populateSelect('labelBatchField', labelFields, ['批次', 'batch', '批号', 'lot', '批次号']);
        this.populateSelect('materialBatchField', materialFields, ['批次', 'batch', '批号', 'lot', '批次号']);
        this.populateSelect('labelMaterialField', labelFields, ['物料', 'material', '物料号', 'item', '物料编码']);
        this.populateSelect('materialMaterialField', materialFields, ['物料', 'material', '物料号', 'item', '物料编码']);
    }

    populateSelect(selectId, fields, preferredKeywords = []) {
        const select = document.getElementById(selectId);
        select.innerHTML = '';

        const lowerKeywords = preferredKeywords.map(k => k.toLowerCase());
        let preferredIndex = -1;

        fields.forEach((field, index) => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = field;
            select.appendChild(option);

            if (preferredIndex === -1) {
                const lowerField = field.toLowerCase();
                if (lowerKeywords.some(keyword => lowerField.includes(keyword))) {
                    preferredIndex = index;
                }
            }
        });

        if (preferredIndex !== -1) {
            select.selectedIndex = preferredIndex;
        }
    }

    showDataPreview() {
        document.getElementById('dataPreview').style.display = 'block';
        document.getElementById('labelCount').textContent = `共 ${this.labelData.length} 条记录`;
        document.getElementById('materialCount').textContent = `共 ${this.materialData.length} 条记录`;

        this.renderDataTable('labelPreview', this.labelData.slice(0, 10));
        this.renderDataTable('materialPreview', this.materialData.slice(0, 10));
    }

    renderDataTable(containerId, data) {
        const container = document.getElementById(containerId);
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无数据</p>';
            return;
        }

        const headers = Object.keys(data[0]);
        let html = '<table class="data-table"><thead><tr>';
        
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            headers.forEach(header => {
                html += `<td>${row[header] || '-'}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    confirmFieldMapping() {
        this.fieldMapping = {
            labelBatch: document.getElementById('labelBatchField').value,
            materialBatch: document.getElementById('materialBatchField').value,
            labelMaterial: document.getElementById('labelMaterialField').value,
            materialMaterial: document.getElementById('materialMaterialField').value
        };

        if (!this.fieldMapping.labelBatch || !this.fieldMapping.materialBatch) {
            this.showToast('请选择批次号字段', 'error');
            return;
        }

        this.createReviewRecords();
        this.showToast('字段映射确认成功，请切换到「复核操作」开始工作', 'success');
        this.switchTab('review');
    }

    createReviewRecords() {
        this.clearCurrentProgress();
        
        const { labelBatch, materialBatch, labelMaterial, materialMaterial } = this.fieldMapping;
        
        this.reviewRecords = [];

        const materialByBatchMatMap = new Map();
        const materialByBatchOnlyMap = new Map();
        const materialByMaterialOnlyMap = new Map();
        
        this.materialData.forEach(mat => {
            const batchMatKey = `${mat[materialBatch] || ''}`;
            const materialKey = `${mat[materialMaterial] || ''}`;
            const fullKey = `${batchMatKey}-${materialKey}`;
            
            materialByBatchMatMap.set(fullKey, mat);
            
            if (batchMatKey && !materialByBatchOnlyMap.has(batchMatKey)) {
                materialByBatchOnlyMap.set(batchMatKey, mat);
            }
            
            if (materialKey && !materialByMaterialOnlyMap.has(materialKey)) {
                materialByMaterialOnlyMap.set(materialKey, mat);
            }
        });

        this.labelData.forEach((label, index) => {
            const labelBatchValue = label[labelBatch] || '';
            const labelMaterialValue = label[labelMaterial] || '';
            const fullKey = `${labelBatchValue}-${labelMaterialValue}`;
            
            let matchedMaterial = null;
            const conflicts = [];
            let matchReason = '';
            
            if (materialByBatchMatMap.has(fullKey)) {
                matchedMaterial = materialByBatchMatMap.get(fullKey);
                matchReason = 'batch-material';
            } else if (labelBatchValue && materialByBatchOnlyMap.has(labelBatchValue)) {
                matchedMaterial = materialByBatchOnlyMap.get(labelBatchValue);
                matchReason = 'batch-only';
                
                if (labelMaterial && materialMaterial) {
                    const matMaterialValue = matchedMaterial[materialMaterial] || '';
                    if (labelMaterialValue && matMaterialValue && labelMaterialValue !== matMaterialValue) {
                        conflicts.push({
                            field: '物料号',
                            labelValue: labelMaterialValue,
                            materialValue: matMaterialValue
                        });
                    }
                }
            } else if (labelMaterialValue && materialByMaterialOnlyMap.has(labelMaterialValue)) {
                matchedMaterial = materialByMaterialOnlyMap.get(labelMaterialValue);
                matchReason = 'material-only';
                
                if (labelBatch && materialBatch) {
                    const matBatchValue = matchedMaterial[materialBatch] || '';
                    if (labelBatchValue && matBatchValue && labelBatchValue !== matBatchValue) {
                        conflicts.push({
                            field: '批次号',
                            labelValue: labelBatchValue,
                            materialValue: matBatchValue
                        });
                    }
                }
            }

            if (matchedMaterial) {
                if (labelMaterial && materialMaterial) {
                    const matMaterialValue = matchedMaterial[materialMaterial] || '';
                    if (labelMaterialValue !== matMaterialValue) {
                        const existing = conflicts.find(c => c.field === '物料号');
                        if (!existing && matchReason === 'batch-material') {
                            conflicts.push({
                                field: '物料号',
                                labelValue: labelMaterialValue,
                                materialValue: matMaterialValue
                            });
                        }
                    }
                }
                if (labelBatch && materialBatch) {
                    const matBatchValue = matchedMaterial[materialBatch] || '';
                    if (labelBatchValue !== matBatchValue) {
                        const existing = conflicts.find(c => c.field === '批次号');
                        if (!existing) {
                            conflicts.push({
                                field: '批次号',
                                labelValue: labelBatchValue,
                                materialValue: matBatchValue
                            });
                        }
                    }
                }
            }

            this.reviewRecords.push({
                id: index + 1,
                label: label,
                material: matchedMaterial,
                status: 'pending',
                conflicts: conflicts,
                remark: '',
                reviewedAt: null,
                matchReason: matchReason
            });
        });

        const unmatched = this.reviewRecords.filter(r => !r.material).length;
        const withConflicts = this.reviewRecords.filter(r => r.conflicts.length > 0).length;
        
        if (unmatched > 0) {
            this.showToast(`有 ${unmatched} 条标签数据未找到匹配的物料记录`, 'warning');
        }
        if (withConflicts > 0) {
            this.showToast(`检测到 ${withConflicts} 条数据存在字段冲突`, 'warning');
        }
        
        this.saveCurrentProgress();
    }

    renderReviewList() {
        const container = document.getElementById('reviewList');
        
        if (this.reviewRecords.length === 0) {
            container.innerHTML = '<p class="empty-tip">请先导入数据并完成字段映射</p>';
            this.updateStats();
            return;
        }

        const filtered = this.reviewRecords.filter(record => {
            if (this.currentFilter === 'all') return true;
            return record.status === this.currentFilter;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-tip">当前筛选条件下没有数据</p>';
            this.updateStats();
            return;
        }

        let html = '';
        filtered.forEach(record => {
            html += this.renderReviewItem(record);
        });

        container.innerHTML = html;
        
        filtered.forEach(record => {
            this.bindReviewItemEvents(record.id);
        });

        this.updateStats();
    }

    renderReviewItem(record) {
        const statusClass = {
            'pending': 'status-pending',
            'passed': 'status-passed',
            'failed': 'status-failed'
        }[record.status];

        const statusText = {
            'pending': '待复核',
            'passed': '已通过',
            'failed': '有问题'
        }[record.status];

        const labelFields = Object.keys(record.label).slice(0, 8);
        const materialFields = record.material ? Object.keys(record.material).slice(0, 8) : [];

        let conflictsHtml = '';
        if (record.conflicts.length > 0) {
            conflictsHtml = `<div class="conflict-warning">
                <strong>⚠️ 检测到字段冲突：</strong>
                ${record.conflicts.map(c => `${c.field}: 标签"${c.labelValue}" vs 物料"${c.materialValue}"`).join('；')}
            </div>`;
        }

        let remarkHtml = '';
        if (record.remark) {
            remarkHtml = `<div class="remark-display"><strong>备注：</strong>${record.remark}</div>`;
        }

        let reviewTimeHtml = '';
        if (record.reviewedAt) {
            reviewTimeHtml = `<div class="review-time">复核时间：${new Date(record.reviewedAt).toLocaleString('zh-CN')}</div>`;
        }

        return `
            <div class="review-item ${record.status}" data-id="${record.id}">
                <div class="review-header">
                    <span class="review-index">#${record.id}</span>
                    <span class="review-status ${statusClass}">${statusText}</span>
                </div>
                
                ${conflictsHtml}
                
                <div class="compare-container">
                    <div class="compare-column label">
                        <h4>📄 标签数据</h4>
                        ${labelFields.map(field => {
                            const conflict = record.conflicts.find(c => 
                                c.labelValue === record.label[field] || 
                                c.field === field
                            );
                            const valueClass = conflict ? 'mismatch' : '';
                            return `<div class="compare-field">
                                <span class="field-name">${field}</span>
                                <span class="field-value ${valueClass}">${record.label[field] || '-'}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    
                    <div class="compare-column material">
                        <h4>📦 物料数据</h4>
                        ${record.material ? materialFields.map(field => {
                            const conflict = record.conflicts.find(c => 
                                c.materialValue === record.material[field] || 
                                c.field === field
                            );
                            const valueClass = conflict ? 'mismatch' : (conflict ? 'mismatch' : '');
                            return `<div class="compare-field">
                                <span class="field-name">${field}</span>
                                <span class="field-value ${valueClass}">${record.material[field] || '-'}</span>
                            </div>`;
                        }).join('') : '<p style="color: #ff416c; text-align: center; padding: 20px;">未找到匹配的物料记录</p>'}
                    </div>
                </div>
                
                ${remarkHtml}
                ${reviewTimeHtml}
                
                <div class="review-actions">
                    <input type="text" class="remark-input" placeholder="输入备注（可选）" value="${record.remark || ''}" data-id="${record.id}">
                    <button class="btn btn-success" onclick="app.updateRecord(${record.id}, 'passed')">✓ 通过</button>
                    <button class="btn btn-danger" onclick="app.updateRecord(${record.id}, 'failed')">✗ 有问题</button>
                </div>
            </div>
        `;
    }

    bindReviewItemEvents(recordId) {
        const item = document.querySelector(`.review-item[data-id="${recordId}"]`);
        if (item) {
            const remarkInput = item.querySelector('.remark-input');
            if (remarkInput) {
                remarkInput.addEventListener('change', (e) => {
                    const record = this.reviewRecords.find(r => r.id === recordId);
                    if (record) {
                        record.remark = e.target.value;
                    }
                });
            }
        }
    }

    updateRecord(id, status) {
        const record = this.reviewRecords.find(r => r.id === id);
        if (!record) return;

        if (record.status !== 'pending') {
            this.showToast('该记录已复核，如需修改请先重新导入数据', 'warning');
            return;
        }

        record.status = status;
        record.reviewedAt = Date.now();
        
        const item = document.querySelector(`.review-item[data-id="${id}"]`);
        if (item) {
            const remarkInput = item.querySelector('.remark-input');
            if (remarkInput) {
                record.remark = remarkInput.value;
            }
        }

        this.saveCurrentProgress();
        this.saveToHistoryIfNeeded();
        this.renderReviewList();
        this.showToast(`记录 #${id} 已${status === 'passed' ? '通过' : '标记为有问题'}`, 'success');
    }

    batchReview(status) {
        const filtered = this.reviewRecords.filter(record => {
            if (this.currentFilter === 'all') {
                return record.status === 'pending';
            }
            return record.status === 'pending' && 
                   (this.currentFilter === 'all' || record.status === this.currentFilter);
        });

        if (filtered.length === 0) {
            this.showToast('当前没有待复核的记录', 'warning');
            return;
        }

        this.showModal(
            '确认批量操作',
            `确定要将 ${filtered.length} 条待复核记录批量标记为「${status === 'passed' ? '已通过' : '有问题'}」吗？`,
            () => {
                filtered.forEach(record => {
                    record.status = status;
                    record.reviewedAt = Date.now();
                });
                
                this.saveCurrentProgress();
                this.saveToHistoryIfNeeded();
                this.renderReviewList();
                this.showToast(`已批量处理 ${filtered.length} 条记录`, 'success');
            }
        );
    }

    updateStats() {
        const total = this.reviewRecords.length;
        const pending = this.reviewRecords.filter(r => r.status === 'pending').length;
        const passed = this.reviewRecords.filter(r => r.status === 'passed').length;
        const failed = this.reviewRecords.filter(r => r.status === 'failed').length;
        const progress = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;

        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('passedCount').textContent = passed;
        document.getElementById('failedCount').textContent = failed;
        document.getElementById('progressPercent').textContent = `${progress}%`;
    }

    saveToHistoryIfNeeded() {
        const allReviewed = this.reviewRecords.every(r => r.status !== 'pending');
        
        if (allReviewed && this.reviewRecords.length > 0) {
            const historyItem = {
                id: Date.now(),
                timestamp: Date.now(),
                labelCount: this.labelData.length,
                materialCount: this.materialData.length,
                fieldMapping: { ...this.fieldMapping },
                records: [...this.reviewRecords],
                stats: {
                    total: this.reviewRecords.length,
                    passed: this.reviewRecords.filter(r => r.status === 'passed').length,
                    failed: this.reviewRecords.filter(r => r.status === 'failed').length
                }
            };
            
            const existingIndex = this.history.findIndex(h => 
                JSON.stringify(h.records.map(r => r.id)) === JSON.stringify(historyItem.records.map(r => r.id))
            );
            
            if (existingIndex !== -1) {
                this.history[existingIndex] = historyItem;
            } else {
                this.history.unshift(historyItem);
            }
            
            this.saveHistory();
        }
    }

    saveHistory() {
        localStorage.setItem('labelReviewHistory', JSON.stringify(this.history));
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('labelReviewHistory');
            if (saved) {
                this.history = JSON.parse(saved);
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
            this.history = [];
        }
    }

    saveCurrentProgress() {
        try {
            const progressData = {
                labelData: this.labelData,
                materialData: this.materialData,
                reviewRecords: this.reviewRecords,
                fieldMapping: this.fieldMapping,
                savedAt: Date.now()
            };
            localStorage.setItem('labelReviewCurrentProgress', JSON.stringify(progressData));
        } catch (error) {
            console.error('保存当前进度失败:', error);
        }
    }

    loadCurrentProgress() {
        try {
            const saved = localStorage.getItem('labelReviewCurrentProgress');
            if (saved) {
                const progressData = JSON.parse(saved);
                
                if (progressData.reviewRecords && progressData.reviewRecords.length > 0) {
                    this.showModal(
                        '检测到未完成的复核任务',
                        `检测到有未完成的复核任务（保存于 ${new Date(progressData.savedAt).toLocaleString('zh-CN')}），是否恢复？`,
                        () => {
                            this.labelData = progressData.labelData || [];
                            this.materialData = progressData.materialData || [];
                            this.reviewRecords = progressData.reviewRecords || [];
                            this.fieldMapping = progressData.fieldMapping || this.fieldMapping;
                            
                            if (this.labelData.length > 0 && this.materialData.length > 0) {
                                this.showDataPreview();
                            }
                            
                            this.renderReviewList();
                            this.showToast('已恢复上次的复核进度', 'success');
                        }
                    );
                }
            }
        } catch (error) {
            console.error('加载当前进度失败:', error);
        }
    }

    clearCurrentProgress() {
        localStorage.removeItem('labelReviewCurrentProgress');
    }

    renderHistory() {
        const container = document.getElementById('historyList');
        
        if (this.history.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无历史记录</p>';
            return;
        }

        let html = '';
        this.history.forEach((item, index) => {
            const date = new Date(item.timestamp);
            html += `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-title">复核任务 #${this.history.length - index}</span>
                        <span class="history-time">${date.toLocaleString('zh-CN')}</span>
                    </div>
                    <div class="history-stats">
                        <span class="history-stat">标签数据：<strong>${item.labelCount}</strong> 条</span>
                        <span class="history-stat">物料数据：<strong>${item.materialCount}</strong> 条</span>
                        <span class="history-stat">通过：<strong style="color: #11998e;">${item.stats.passed}</strong></span>
                        <span class="history-stat">有问题：<strong style="color: #ff416c;">${item.stats.failed}</strong></span>
                    </div>
                    <div class="history-actions">
                        <button class="btn btn-primary" onclick="app.loadFromHistory(${item.id})">📂 加载此任务</button>
                        <button class="btn btn-secondary" onclick="app.exportHistoryItem(${item.id})">📤 导出</button>
                        <button class="btn btn-danger" onclick="app.deleteHistoryItem(${item.id})">🗑️ 删除</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    loadFromHistory(historyId) {
        const item = this.history.find(h => h.id === historyId);
        if (!item) return;

        this.showModal(
            '加载历史任务',
            '加载历史任务将覆盖当前数据，确定要继续吗？',
            () => {
                this.clearCurrentProgress();
                
                this.fieldMapping = { ...item.fieldMapping };
                this.reviewRecords = item.records.map(r => ({ ...r }));
                
                this.labelData = item.records.map(r => r.label);
                this.materialData = item.records.filter(r => r.material).map(r => r.material);
                
                this.showDataPreview();
                this.renderReviewList();
                this.switchTab('review');
                this.showToast('历史任务加载成功', 'success');
            }
        );
    }

    deleteHistoryItem(historyId) {
        this.showModal(
            '删除历史记录',
            '确定要删除这条历史记录吗？此操作不可恢复。',
            () => {
                this.history = this.history.filter(h => h.id !== historyId);
                this.saveHistory();
                this.renderHistory();
                this.showToast('历史记录已删除', 'success');
            }
        );
    }

    confirmClearHistory() {
        this.showModal(
            '清空历史记录',
            '确定要清空所有历史记录吗？此操作不可恢复。',
            () => {
                this.history = [];
                this.saveHistory();
                this.renderHistory();
                this.showToast('历史记录已清空', 'success');
            }
        );
    }

    exportHistoryItem(historyId) {
        const item = this.history.find(h => h.id === historyId);
        if (!item) return;

        const dataStr = JSON.stringify(item, null, 2);
        this.downloadFile(dataStr, `复核任务_${new Date(item.timestamp).toISOString().slice(0, 10)}.json`, 'application/json');
        this.showToast('导出成功', 'success');
    }

    importHistoryData(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!Array.isArray(data)) {
                    if (data.records) {
                        this.history.unshift(data);
                    } else {
                        throw new Error('无效的历史数据格式');
                    }
                } else {
                    this.history = [...data, ...this.history];
                }
                
                this.saveHistory();
                this.renderHistory();
                this.showToast('历史数据导入成功', 'success');
            } catch (error) {
                this.showToast(`导入失败: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    }

    exportCurrent(format) {
        if (this.reviewRecords.length === 0) {
            this.showToast('当前没有数据可导出', 'warning');
            return;
        }

        const exportData = this.reviewRecords.map(record => ({
            '序号': record.id,
            '状态': record.status === 'passed' ? '通过' : (record.status === 'failed' ? '有问题' : '待复核'),
            ...this.flattenObject(record.label, '标签_'),
            ...(record.material ? this.flattenObject(record.material, '物料_') : {}),
            '是否有冲突': record.conflicts.length > 0 ? '是' : '否',
            '冲突详情': record.conflicts.map(c => `${c.field}:${c.labelValue}≠${c.materialValue}`).join(';'),
            '备注': record.remark || '',
            '复核时间': record.reviewedAt ? new Date(record.reviewedAt).toLocaleString('zh-CN') : ''
        }));

        const timestamp = new Date().toISOString().slice(0, 10);

        if (format === 'csv') {
            const csv = this.toCSV(exportData);
            this.downloadFile(csv, `复核结果_${timestamp}.csv`, 'text/csv;charset=utf-8');
        } else if (format === 'json') {
            const json = JSON.stringify(exportData, null, 2);
            this.downloadFile(json, `复核结果_${timestamp}.json`, 'application/json');
        } else if (format === 'excel') {
            this.exportToExcel(exportData, `复核结果_${timestamp}.xlsx`);
        }

        this.showToast('导出成功', 'success');
    }

    exportSummary(format) {
        if (this.reviewRecords.length === 0 && this.history.length === 0) {
            this.showToast('当前没有数据可导出', 'warning');
            return;
        }

        const total = this.reviewRecords.length;
        const pending = this.reviewRecords.filter(r => r.status === 'pending').length;
        const passed = this.reviewRecords.filter(r => r.status === 'passed').length;
        const failed = this.reviewRecords.filter(r => r.status === 'failed').length;
        const conflicts = this.reviewRecords.filter(r => r.conflicts.length > 0).length;
        const unmatched = this.reviewRecords.filter(r => !r.material).length;

        const summary = {
            '导出时间': new Date().toLocaleString('zh-CN'),
            '标签数据总数': this.labelData.length,
            '物料数据总数': this.materialData.length,
            '复核记录总数': total,
            '待复核数量': pending,
            '通过数量': passed,
            '有问题数量': failed,
            '字段冲突数量': conflicts,
            '未匹配物料数量': unmatched,
            '历史任务数量': this.history.length
        };

        const timestamp = new Date().toISOString().slice(0, 10);

        if (format === 'csv') {
            const csv = this.objectToCSV(summary);
            this.downloadFile(csv, `汇总报表_${timestamp}.csv`, 'text/csv;charset=utf-8');
        } else if (format === 'json') {
            const json = JSON.stringify(summary, null, 2);
            this.downloadFile(json, `汇总报表_${timestamp}.json`, 'application/json');
        }

        this.showToast('导出成功', 'success');
    }

    exportFullBackup() {
        const backup = {
            version: '1.0',
            exportTime: Date.now(),
            history: this.history
        };

        const timestamp = new Date().toISOString().slice(0, 10);
        const json = JSON.stringify(backup, null, 2);
        this.downloadFile(json, `完整备份_${timestamp}.json`, 'application/json');
        this.showToast('完整备份导出成功', 'success');
    }

    flattenObject(obj, prefix = '') {
        const result = {};
        Object.keys(obj).forEach(key => {
            result[prefix + key] = obj[key];
        });
        return result;
    }

    toCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const headerLine = headers.map(h => this.escapeCSV(h)).join(',');
        const dataLines = data.map(row => 
            headers.map(h => this.escapeCSV(row[h])).join(',')
        );

        return '\ufeff' + [headerLine, ...dataLines].join('\n');
    }

    objectToCSV(obj) {
        const lines = Object.entries(obj).map(([key, value]) => 
            `${this.escapeCSV(key)},${this.escapeCSV(value)}`
        );
        return '\ufeff' + ['指标,数值', ...lines].join('\n');
    }

    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    exportToExcel(data, filename) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '复核结果');
        XLSX.writeFile(workbook, filename);
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showModal(title, message, onConfirm) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = `<p>${message}</p>`;
        modal.style.display = 'flex';

        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');
        const closeBtn = document.getElementById('modalClose');

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            closeBtn.removeEventListener('click', handleCancel);
        };

        const handleConfirm = () => {
            cleanup();
            this.closeModal();
            if (onConfirm) onConfirm();
        };

        const handleCancel = () => {
            cleanup();
            this.closeModal();
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }
}

const app = new LabelReviewTool();
