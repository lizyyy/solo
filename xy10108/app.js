class InstrumentManager {
    constructor() {
        this.STORAGE_KEYS = {
            INSTRUMENTS: 'calibration_instruments',
            HISTORY: 'calibration_history'
        };
        this.currentPreviewData = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderDashboard();
        this.renderInstruments();
        this.renderHistory();
    }

    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('select-file-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        const uploadArea = document.getElementById('file-upload-area');
        uploadArea.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        document.getElementById('download-template-json').addEventListener('click', () => {
            this.downloadTemplate('json');
        });
        document.getElementById('download-template-csv').addEventListener('click', () => {
            this.downloadTemplate('csv');
        });

        document.getElementById('cancel-import').addEventListener('click', () => {
            this.cancelImport();
        });
        document.getElementById('confirm-import').addEventListener('click', () => {
            this.confirmImport();
        });

        document.getElementById('add-instrument-btn').addEventListener('click', () => {
            this.showAddInstrumentModal();
        });

        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });

        document.getElementById('search-input').addEventListener('input', () => {
            this.renderInstruments();
        });
        document.getElementById('filter-status').addEventListener('change', () => {
            this.renderInstruments();
        });

        document.getElementById('clear-history').addEventListener('click', () => {
            this.clearHistory();
        });

        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportData('json');
        });
        document.getElementById('export-csv-btn').addEventListener('click', () => {
            this.exportData('csv');
        });

        document.getElementById('export-all').addEventListener('change', (e) => {
            const checked = e.target.checked;
            ['export-expired', 'export-expiring', 'export-valid'].forEach(id => {
                document.getElementById(id).checked = false;
            });
        });
        ['export-expired', 'export-expiring', 'export-valid'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.getElementById('export-all').checked = false;
                }
            });
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
    }

    getInstruments() {
        const data = localStorage.getItem(this.STORAGE_KEYS.INSTRUMENTS);
        return data ? JSON.parse(data) : [];
    }

    saveInstruments(instruments) {
        localStorage.setItem(this.STORAGE_KEYS.INSTRUMENTS, JSON.stringify(instruments));
    }

    getHistory() {
        const data = localStorage.getItem(this.STORAGE_KEYS.HISTORY);
        return data ? JSON.parse(data) : [];
    }

    saveHistory(history) {
        localStorage.setItem(this.STORAGE_KEYS.HISTORY, JSON.stringify(history));
    }

    addHistory(action, details) {
        const history = this.getHistory();
        history.unshift({
            id: Date.now(),
            action,
            details,
            timestamp: new Date().toISOString()
        });
        if (history.length > 500) {
            history.splice(500);
        }
        this.saveHistory(history);
        this.renderHistory();
    }

    getInstrumentStatus(instrument) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const expireDate = new Date(instrument.expireDate);
        expireDate.setHours(0, 0, 0, 0);
        
        const diffTime = expireDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return { status: 'expired', daysLeft: diffDays };
        } else if (diffDays <= 30) {
            return { status: 'expiring', daysLeft: diffDays };
        } else {
            return { status: 'valid', daysLeft: diffDays };
        }
    }

    validateInstrument(data, index, existingInstruments, previewData) {
        const errors = [];
        const warnings = [];
        
        if (!data.id || !data.id.trim()) {
            errors.push('仪器编号不能为空');
        }
        
        if (!data.name || !data.name.trim()) {
            errors.push('仪器名称不能为空');
        }
        
        if (!data.calibrationDate) {
            errors.push('校准日期不能为空');
        } else if (!this.isValidDate(data.calibrationDate)) {
            errors.push('校准日期格式无效');
        }
        
        if (!data.expireDate) {
            errors.push('到期日期不能为空');
        } else if (!this.isValidDate(data.expireDate)) {
            errors.push('到期日期格式无效');
        }
        
        if (data.calibrationDate && data.expireDate && this.isValidDate(data.calibrationDate) && this.isValidDate(data.expireDate)) {
            if (new Date(data.calibrationDate) > new Date(data.expireDate)) {
                errors.push('校准日期不能晚于到期日期');
            }
        }
        
        if (data.id) {
            const duplicateInExisting = existingInstruments.find(inst => inst.id === data.id);
            if (duplicateInExisting) {
                warnings.push(`与已存在的仪器「${duplicateInExisting.name}」编号重复，导入时将更新该仪器`);
            }
            
            const duplicateInPreview = previewData.filter((item, i) => i < index && item.data.id === data.id);
            if (duplicateInPreview.length > 0) {
                warnings.push(`与第 ${duplicateInPreview[0].originalIndex + 1} 条数据编号重复，导入时将以后者为准`);
            }
        }
        
        return { errors, warnings };
    }

    isValidDate(dateStr) {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    }

    async handleFileUpload(file) {
        const fileName = file.name.toLowerCase();
        
        if (!fileName.endsWith('.json') && !fileName.endsWith('.csv')) {
            this.showToast('不支持的文件格式，请上传 JSON 或 CSV 文件', 'error');
            return;
        }
        
        try {
            const content = await this.readFile(file);
            let data;
            
            if (fileName.endsWith('.json')) {
                data = this.parseJSON(content);
            } else {
                data = this.parseCSV(content);
            }
            
            if (!data || data.length === 0) {
                this.showToast('文件中没有有效数据', 'warning');
                return;
            }
            
            this.showPreview(data, fileName.endsWith('.csv'));
        } catch (error) {
            console.error('文件读取失败:', error);
            this.showToast('文件读取失败: ' + error.message, 'error');
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    parseJSON(content) {
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return data;
            } else if (data.instruments && Array.isArray(data.instruments)) {
                return data.instruments;
            } else {
                return [data];
            }
        } catch (e) {
            throw new Error('JSON 格式错误');
        }
    }

    parseCSV(content) {
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV 文件格式错误');
        }
        
        const headers = this.parseCSVLine(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0 || values.every(v => !v)) continue;
            
            const row = {};
            headers.forEach((header, index) => {
                const normalizedHeader = this.normalizeHeader(header);
                row[normalizedHeader] = values[index] || '';
            });
            data.push(row);
        }
        
        return data;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        
        return result;
    }

    normalizeHeader(header) {
        const mapping = {
            'id': 'id',
            '编号': 'id',
            '仪器编号': 'id',
            '仪器id': 'id',
            'name': 'name',
            '名称': 'name',
            '仪器名称': 'name',
            'model': 'model',
            '型号': 'model',
            '仪器型号': 'model',
            'calibrationDate': 'calibrationDate',
            '校准日期': 'calibrationDate',
            '上次校准日期': 'calibrationDate',
            'expireDate': 'expireDate',
            '到期日期': 'expireDate',
            '有效期至': 'expireDate',
            'calibrationAgency': 'calibrationAgency',
            '校准机构': 'calibrationAgency',
            'certificateNumber': 'certificateNumber',
            '证书编号': 'certificateNumber',
            '备注': 'notes',
            'notes': 'notes'
        };
        return mapping[header.trim()] || header.trim();
    }

    showPreview(data, isCSV) {
        const existingInstruments = this.getInstruments();
        this.currentPreviewData = [];
        
        let errorCount = 0;
        let warningCount = 0;
        
        const messagesContainer = document.getElementById('preview-messages');
        const tbody = document.getElementById('preview-body');
        tbody.innerHTML = '';
        messagesContainer.innerHTML = '';
        
        data.forEach((item, index) => {
            const normalized = this.normalizeInstrumentData(item);
            const validation = this.validateInstrument(normalized, index, existingInstruments, this.currentPreviewData);
            
            if (validation.errors.length > 0) errorCount++;
            if (validation.warnings.length > 0) warningCount++;
            
            const previewItem = {
                data: normalized,
                originalIndex: index,
                errors: validation.errors,
                warnings: validation.warnings,
                selected: validation.errors.length === 0
            };
            this.currentPreviewData.push(previewItem);
            
            const status = this.getInstrumentStatus(normalized);
            const row = document.createElement('tr');
            row.className = `preview-row ${validation.errors.length > 0 ? 'error' : ''} ${validation.warnings.length > 0 && validation.errors.length === 0 ? 'duplicate' : ''}`;
            
            row.innerHTML = `
                <td>
                    ${normalized.id || '-'}
                    ${validation.errors.length > 0 ? '<br><span class="error-message">' + validation.errors[0] + '</span>' : ''}
                </td>
                <td>${normalized.name || '-'}</td>
                <td>${normalized.model || '-'}</td>
                <td>${normalized.calibrationDate || '-'}</td>
                <td>${normalized.expireDate || '-'}</td>
                <td>
                    <span class="status-badge ${status.status}">
                        ${this.getStatusText(status.status)}
                    </span>
                </td>
                <td>
                    <input type="checkbox" class="preview-checkbox" data-index="${index}" 
                        ${validation.errors.length === 0 ? 'checked' : ''} 
                        ${validation.errors.length > 0 ? 'disabled' : ''}>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        if (errorCount > 0) {
            this.addPreviewMessage(`发现 ${errorCount} 条数据存在错误，已自动取消勾选`, 'error');
        }
        if (warningCount > 0) {
            this.addPreviewMessage(`发现 ${warningCount} 条数据存在冲突，请仔细确认`, 'warning');
        }
        this.addPreviewMessage(`共 ${data.length} 条数据待导入`, 'info');
        
        document.getElementById('preview-section').style.display = 'block';
        
        document.querySelectorAll('.preview-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (this.currentPreviewData[index]) {
                    this.currentPreviewData[index].selected = e.target.checked;
                }
            });
        });
    }

    normalizeInstrumentData(data) {
        return {
            id: String(data.id || data['id'] || data['仪器编号'] || data['编号'] || '').trim(),
            name: String(data.name || data['name'] || data['仪器名称'] || data['名称'] || '').trim(),
            model: String(data.model || data['model'] || data['仪器型号'] || data['型号'] || '').trim(),
            calibrationDate: this.formatDate(data.calibrationDate || data['校准日期'] || data['calibrationDate']),
            expireDate: this.formatDate(data.expireDate || data['到期日期'] || data['expireDate']),
            calibrationAgency: String(data.calibrationAgency || data['校准机构'] || data['calibrationAgency'] || '').trim(),
            certificateNumber: String(data.certificateNumber || data['证书编号'] || data['certificateNumber'] || '').trim(),
            notes: String(data.notes || data['备注'] || data['notes'] || '').trim()
        };
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);
        return date.toISOString().split('T')[0];
    }

    addPreviewMessage(message, type) {
        const container = document.getElementById('preview-messages');
        const div = document.createElement('div');
        div.className = `preview-message ${type}`;
        div.textContent = message;
        container.appendChild(div);
    }

    cancelImport() {
        this.currentPreviewData = [];
        document.getElementById('preview-section').style.display = 'none';
        document.getElementById('file-input').value = '';
        this.showToast('已取消导入', 'info');
    }

    confirmImport() {
        const selectedItems = this.currentPreviewData.filter(item => item.selected);
        
        if (selectedItems.length === 0) {
            this.showToast('没有选择任何数据可导入', 'warning');
            return;
        }
        
        const existingInstruments = this.getInstruments();
        let updatedCount = 0;
        let addedCount = 0;
        
        selectedItems.forEach(item => {
            const existingIndex = existingInstruments.findIndex(inst => inst.id === item.data.id);
            
            if (existingIndex >= 0) {
                existingInstruments[existingIndex] = {
                    ...item.data,
                    updatedAt: new Date().toISOString()
                };
                updatedCount++;
            } else {
                existingInstruments.push({
                    ...item.data,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                addedCount++;
            }
        });
        
        this.saveInstruments(existingInstruments);
        this.addHistory('导入数据', `成功导入 ${selectedItems.length} 条数据，新增 ${addedCount} 条，更新 ${updatedCount} 条`);
        
        this.currentPreviewData = [];
        document.getElementById('preview-section').style.display = 'none';
        document.getElementById('file-input').value = '';
        
        this.renderDashboard();
        this.renderInstruments();
        
        this.showToast(`导入成功！新增 ${addedCount} 条，更新 ${updatedCount} 条`, 'success');
    }

    getStatusText(status) {
        const mapping = {
            'expired': '已过期',
            'expiring': '即将到期',
            'valid': '有效期内'
        };
        return mapping[status] || status;
    }

    getDaysLeftText(daysLeft) {
        if (daysLeft < 0) {
            return `已过期 ${Math.abs(daysLeft)} 天`;
        } else if (daysLeft === 0) {
            return '今天到期';
        } else {
            return `剩余 ${daysLeft} 天`;
        }
    }

    renderDashboard() {
        const instruments = this.getInstruments();
        
        let expired = 0;
        let expiring = 0;
        let valid = 0;
        const attentionInstruments = [];
        
        instruments.forEach(instrument => {
            const { status, daysLeft } = this.getInstrumentStatus(instrument);
            
            if (status === 'expired') {
                expired++;
                attentionInstruments.push({ ...instrument, status, daysLeft });
            } else if (status === 'expiring') {
                expiring++;
                attentionInstruments.push({ ...instrument, status, daysLeft });
            } else {
                valid++;
            }
        });
        
        document.getElementById('expired-count').textContent = expired;
        document.getElementById('expiring-count').textContent = expiring;
        document.getElementById('valid-count').textContent = valid;
        document.getElementById('total-count').textContent = instruments.length;
        
        const attentionList = document.getElementById('attention-list');
        if (attentionInstruments.length === 0) {
            attentionList.innerHTML = '<p class="empty-state">暂无需要关注的仪器</p>';
        } else {
            attentionInstruments.sort((a, b) => a.daysLeft - b.daysLeft);
            attentionList.innerHTML = attentionInstruments.slice(0, 10).map(instrument => 
                this.renderInstrumentCard(instrument, true)
            ).join('');
        }
    }

    renderInstruments() {
        const instruments = this.getInstruments();
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const filterStatus = document.getElementById('filter-status').value;
        
        let filtered = instruments.map(inst => {
            const { status, daysLeft } = this.getInstrumentStatus(inst);
            return { ...inst, status, daysLeft };
        });
        
        if (searchTerm) {
            filtered = filtered.filter(inst => 
                inst.id.toLowerCase().includes(searchTerm) ||
                inst.name.toLowerCase().includes(searchTerm)
            );
        }
        
        if (filterStatus !== 'all') {
            filtered = filtered.filter(inst => inst.status === filterStatus);
        }
        
        filtered.sort((a, b) => a.daysLeft - b.daysLeft);
        
        const listContainer = document.getElementById('instrument-list');
        if (filtered.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">暂无仪器数据，请先导入或添加</p>';
        } else {
            listContainer.innerHTML = filtered.map(instrument => 
                this.renderInstrumentCard(instrument)
            ).join('');
        }
        
        listContainer.querySelectorAll('[data-action="view"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showInstrumentDetail(btn.dataset.id);
            });
        });
        
        listContainer.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showEditInstrumentModal(btn.dataset.id);
            });
        });
        
        listContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deleteInstrument(btn.dataset.id);
            });
        });
        
        listContainer.querySelectorAll('[data-action="renew"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showRenewModal(btn.dataset.id);
            });
        });
    }

    renderInstrumentCard(instrument, simple = false) {
        const status = instrument.status;
        const daysLeft = instrument.daysLeft;
        
        let actions = '';
        if (!simple) {
            actions = `
                <div class="instrument-actions">
                    <button class="btn-outline" data-action="view" data-id="${instrument.id}">查看详情</button>
                    <button class="btn-outline" data-action="edit" data-id="${instrument.id}">编辑</button>
                    <button class="btn-success" data-action="renew" data-id="${instrument.id}">更新校准</button>
                    <button class="btn-danger" data-action="delete" data-id="${instrument.id}">删除</button>
                </div>
            `;
        }
        
        return `
            <div class="instrument-card ${status}">
                <div class="instrument-header">
                    <div>
                        <div class="instrument-id">编号: ${instrument.id}</div>
                        <div class="instrument-name">${instrument.name}</div>
                        ${instrument.model ? `<div class="instrument-model">型号: ${instrument.model}</div>` : ''}
                    </div>
                    <span class="status-badge ${status}">${this.getStatusText(status)}</span>
                </div>
                <div class="instrument-details">
                    <div class="detail-item">
                        <span class="detail-label">校准日期</span>
                        <span class="detail-value">${instrument.calibrationDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">到期日期</span>
                        <span class="detail-value">${instrument.expireDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">剩余天数</span>
                        <span class="detail-value days-left ${status}">${this.getDaysLeftText(daysLeft)}</span>
                    </div>
                    ${instrument.calibrationAgency ? `
                        <div class="detail-item">
                            <span class="detail-label">校准机构</span>
                            <span class="detail-value">${instrument.calibrationAgency}</span>
                        </div>
                    ` : ''}
                    ${instrument.certificateNumber ? `
                        <div class="detail-item">
                            <span class="detail-label">证书编号</span>
                            <span class="detail-value">${instrument.certificateNumber}</span>
                        </div>
                    ` : ''}
                </div>
                ${actions}
            </div>
        `;
    }

    showAddInstrumentModal() {
        document.getElementById('modal-title').textContent = '新增仪器';
        document.getElementById('modal-body').innerHTML = this.getInstrumentForm();
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn-secondary" onclick="instrumentManager.closeModal()">取消</button>
            <button class="btn-primary" onclick="instrumentManager.saveInstrument()">保存</button>
        `;
        this.openModal();
    }

    showEditInstrumentModal(id) {
        const instruments = this.getInstruments();
        const instrument = instruments.find(inst => inst.id === id);
        
        if (!instrument) {
            this.showToast('仪器不存在', 'error');
            return;
        }
        
        document.getElementById('modal-title').textContent = '编辑仪器';
        document.getElementById('modal-body').innerHTML = this.getInstrumentForm(instrument);
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn-secondary" onclick="instrumentManager.closeModal()">取消</button>
            <button class="btn-primary" onclick="instrumentManager.saveInstrument('${id}')">保存</button>
        `;
        this.openModal();
    }

    showInstrumentDetail(id) {
        const instruments = this.getInstruments();
        const instrument = instruments.find(inst => inst.id === id);
        
        if (!instrument) {
            this.showToast('仪器不存在', 'error');
            return;
        }
        
        const { status, daysLeft } = this.getInstrumentStatus(instrument);
        
        document.getElementById('modal-title').textContent = '仪器详情';
        document.getElementById('modal-body').innerHTML = `
            <div class="instrument-details">
                <div class="detail-item">
                    <span class="detail-label">仪器编号</span>
                    <span class="detail-value">${instrument.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">仪器名称</span>
                    <span class="detail-value">${instrument.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">型号</span>
                    <span class="detail-value">${instrument.model || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">校准日期</span>
                    <span class="detail-value">${instrument.calibrationDate}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">到期日期</span>
                    <span class="detail-value">${instrument.expireDate}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">状态</span>
                    <span class="detail-value">
                        <span class="status-badge ${status}">${this.getStatusText(status)}</span>
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">剩余天数</span>
                    <span class="detail-value days-left ${status}">${this.getDaysLeftText(daysLeft)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">校准机构</span>
                    <span class="detail-value">${instrument.calibrationAgency || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">证书编号</span>
                    <span class="detail-value">${instrument.certificateNumber || '-'}</span>
                </div>
            </div>
            ${instrument.notes ? `
                <div class="form-group" style="margin-top: 20px;">
                    <label>备注</label>
                    <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">${instrument.notes}</div>
                </div>
            ` : ''}
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn-primary" onclick="instrumentManager.closeModal()">关闭</button>
        `;
        this.openModal();
    }

    showRenewModal(id) {
        const instruments = this.getInstruments();
        const instrument = instruments.find(inst => inst.id === id);
        
        if (!instrument) {
            this.showToast('仪器不存在', 'error');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        document.getElementById('modal-title').textContent = '更新校准信息';
        document.getElementById('modal-body').innerHTML = `
            <div class="form-group">
                <label>仪器名称</label>
                <input type="text" value="${instrument.name}" disabled>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>新校准日期<span class="required-flag">*</span></label>
                    <input type="date" id="renew-calibration-date" value="${today}">
                </div>
                <div class="form-group">
                    <label>新到期日期<span class="required-flag">*</span></label>
                    <input type="date" id="renew-expire-date">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>校准机构</label>
                    <input type="text" id="renew-agency" value="${instrument.calibrationAgency || ''}" placeholder="请输入校准机构">
                </div>
                <div class="form-group">
                    <label>证书编号</label>
                    <input type="text" id="renew-certificate" value="${instrument.certificateNumber || ''}" placeholder="请输入证书编号">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="renew-notes" placeholder="可选，填写备注信息"></textarea>
            </div>
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn-secondary" onclick="instrumentManager.closeModal()">取消</button>
            <button class="btn-primary" onclick="instrumentManager.renewCalibration('${id}')">确认更新</button>
        `;
        this.openModal();
    }

    getInstrumentForm(data = {}) {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>仪器编号<span class="required-flag">*</span></label>
                    <input type="text" id="form-id" value="${data.id || ''}" placeholder="请输入仪器编号">
                </div>
                <div class="form-group">
                    <label>仪器名称<span class="required-flag">*</span></label>
                    <input type="text" id="form-name" value="${data.name || ''}" placeholder="请输入仪器名称">
                </div>
            </div>
            <div class="form-group">
                <label>型号</label>
                <input type="text" id="form-model" value="${data.model || ''}" placeholder="请输入仪器型号">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>校准日期<span class="required-flag">*</span></label>
                    <input type="date" id="form-calibration-date" value="${data.calibrationDate || ''}">
                </div>
                <div class="form-group">
                    <label>到期日期<span class="required-flag">*</span></label>
                    <input type="date" id="form-expire-date" value="${data.expireDate || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>校准机构</label>
                    <input type="text" id="form-agency" value="${data.calibrationAgency || ''}" placeholder="请输入校准机构">
                </div>
                <div class="form-group">
                    <label>证书编号</label>
                    <input type="text" id="form-certificate" value="${data.certificateNumber || ''}" placeholder="请输入证书编号">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="form-notes" placeholder="可选，填写备注信息">${data.notes || ''}</textarea>
            </div>
        `;
    }

    saveInstrument(editId = null) {
        const id = document.getElementById('form-id').value.trim();
        const name = document.getElementById('form-name').value.trim();
        const model = document.getElementById('form-model').value.trim();
        const calibrationDate = document.getElementById('form-calibration-date').value;
        const expireDate = document.getElementById('form-expire-date').value;
        const agency = document.getElementById('form-agency').value.trim();
        const certificate = document.getElementById('form-certificate').value.trim();
        const notes = document.getElementById('form-notes').value.trim();
        
        if (!id) {
            this.showToast('仪器编号不能为空', 'error');
            return;
        }
        if (!name) {
            this.showToast('仪器名称不能为空', 'error');
            return;
        }
        if (!calibrationDate) {
            this.showToast('校准日期不能为空', 'error');
            return;
        }
        if (!expireDate) {
            this.showToast('到期日期不能为空', 'error');
            return;
        }
        if (new Date(calibrationDate) > new Date(expireDate)) {
            this.showToast('校准日期不能晚于到期日期', 'error');
            return;
        }
        
        const instruments = this.getInstruments();
        
        if (editId && id !== editId) {
            const existing = instruments.find(inst => inst.id === id);
            if (existing) {
                this.showToast('仪器编号已存在', 'error');
                return;
            }
        } else if (!editId) {
            const existing = instruments.find(inst => inst.id === id);
            if (existing) {
                this.showToast('仪器编号已存在，如需修改请使用编辑功能', 'error');
                return;
            }
        }
        
        const instrumentData = {
            id,
            name,
            model,
            calibrationDate,
            expireDate,
            calibrationAgency: agency,
            certificateNumber: certificate,
            notes
        };
        
        if (editId) {
            const index = instruments.findIndex(inst => inst.id === editId);
            if (index >= 0) {
                instruments[index] = {
                    ...instruments[index],
                    ...instrumentData,
                    updatedAt: new Date().toISOString()
                };
                this.addHistory('编辑仪器', `编辑了仪器「${name}」(${id})`);
                this.showToast('仪器信息已更新', 'success');
            }
        } else {
            instruments.push({
                ...instrumentData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            this.addHistory('新增仪器', `新增了仪器「${name}」(${id})`);
            this.showToast('仪器添加成功', 'success');
        }
        
        this.saveInstruments(instruments);
        this.closeModal();
        this.renderDashboard();
        this.renderInstruments();
    }

    renewCalibration(id) {
        const calibrationDate = document.getElementById('renew-calibration-date').value;
        const expireDate = document.getElementById('renew-expire-date').value;
        const agency = document.getElementById('renew-agency').value.trim();
        const certificate = document.getElementById('renew-certificate').value.trim();
        const notes = document.getElementById('renew-notes').value.trim();
        
        if (!calibrationDate) {
            this.showToast('校准日期不能为空', 'error');
            return;
        }
        if (!expireDate) {
            this.showToast('到期日期不能为空', 'error');
            return;
        }
        if (new Date(calibrationDate) > new Date(expireDate)) {
            this.showToast('校准日期不能晚于到期日期', 'error');
            return;
        }
        
        const instruments = this.getInstruments();
        const index = instruments.findIndex(inst => inst.id === id);
        
        if (index >= 0) {
            instruments[index] = {
                ...instruments[index],
                calibrationDate,
                expireDate,
                calibrationAgency: agency || instruments[index].calibrationAgency,
                certificateNumber: certificate || instruments[index].certificateNumber,
                updatedAt: new Date().toISOString()
            };
            
            this.saveInstruments(instruments);
            this.addHistory('更新校准', `更新了仪器「${instruments[index].name}」(${id}) 的校准信息`);
            this.closeModal();
            this.renderDashboard();
            this.renderInstruments();
            this.showToast('校准信息已更新', 'success');
        }
    }

    deleteInstrument(id) {
        if (!confirm('确定要删除该仪器吗？此操作不可撤销。')) {
            return;
        }
        
        const instruments = this.getInstruments();
        const index = instruments.findIndex(inst => inst.id === id);
        
        if (index >= 0) {
            const deleted = instruments[index];
            instruments.splice(index, 1);
            this.saveInstruments(instruments);
            this.addHistory('删除仪器', `删除了仪器「${deleted.name}」(${id})`);
            this.renderDashboard();
            this.renderInstruments();
            this.showToast('仪器已删除', 'success');
        }
    }

    renderHistory() {
        const history = this.getHistory();
        const container = document.getElementById('history-list');
        
        if (history.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无历史记录</p>';
            return;
        }
        
        container.innerHTML = history.map(item => {
            const date = new Date(item.timestamp);
            const icon = this.getHistoryIcon(item.action);
            
            return `
                <div class="history-item">
                    <div class="history-icon">${icon}</div>
                    <div class="history-content">
                        <div class="history-action">${item.action}</div>
                        <div class="history-detail">${item.details}</div>
                        <div class="history-time">${this.formatDateTime(date)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getHistoryIcon(action) {
        const icons = {
            '新增仪器': '➕',
            '编辑仪器': '✏️',
            '删除仪器': '🗑️',
            '更新校准': '🔄',
            '导入数据': '📥',
            '清空历史': '🧹'
        };
        return icons[action] || '📋';
    }

    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    clearHistory() {
        if (!confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
            return;
        }
        
        this.saveHistory([]);
        this.renderHistory();
        this.showToast('历史记录已清空', 'info');
    }

    exportData(format) {
        const instruments = this.getInstruments();
        
        if (instruments.length === 0) {
            this.showToast('没有可导出的数据', 'warning');
            return;
        }
        
        let filtered = instruments.map(inst => {
            const { status, daysLeft } = this.getInstrumentStatus(inst);
            return { ...inst, status, daysLeft };
        });
        
        const exportAll = document.getElementById('export-all').checked;
        const exportExpired = document.getElementById('export-expired').checked;
        const exportExpiring = document.getElementById('export-expiring').checked;
        const exportValid = document.getElementById('export-valid').checked;
        
        if (!exportAll) {
            const statuses = [];
            if (exportExpired) statuses.push('expired');
            if (exportExpiring) statuses.push('expiring');
            if (exportValid) statuses.push('valid');
            
            if (statuses.length === 0) {
                this.showToast('请至少选择一种导出范围', 'warning');
                return;
            }
            
            filtered = filtered.filter(inst => statuses.includes(inst.status));
        }
        
        if (filtered.length === 0) {
            this.showToast('所选范围内没有数据', 'warning');
            return;
        }
        
        let content, filename, mimeType;
        
        if (format === 'json') {
            const exportData = filtered.map(inst => ({
                id: inst.id,
                name: inst.name,
                model: inst.model,
                calibrationDate: inst.calibrationDate,
                expireDate: inst.expireDate,
                calibrationAgency: inst.calibrationAgency,
                certificateNumber: inst.certificateNumber,
                notes: inst.notes,
                status: this.getStatusText(inst.status),
                daysLeft: inst.daysLeft
            }));
            content = JSON.stringify(exportData, null, 2);
            filename = `仪器校准清单_${this.getDateString()}.json`;
            mimeType = 'application/json';
        } else {
            const headers = ['仪器编号', '仪器名称', '型号', '校准日期', '到期日期', '状态', '剩余天数', '校准机构', '证书编号', '备注'];
            const rows = filtered.map(inst => [
                inst.id,
                inst.name,
                inst.model,
                inst.calibrationDate,
                inst.expireDate,
                this.getStatusText(inst.status),
                this.getDaysLeftText(inst.daysLeft),
                inst.calibrationAgency,
                inst.certificateNumber,
                inst.notes
            ]);
            
            content = [headers, ...rows].map(row => 
                row.map(cell => this.escapeCSV(cell)).join(',')
            ).join('\n');
            filename = `仪器校准清单_${this.getDateString()}.csv`;
            mimeType = 'text/csv;charset=utf-8';
        }
        
        this.downloadFile(content, filename, mimeType);
        this.addHistory('导出数据', `导出了 ${filtered.length} 条仪器数据为 ${format.toUpperCase()} 格式`);
        this.showToast(`成功导出 ${filtered.length} 条数据`, 'success');
    }

    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadTemplate(format) {
        const sampleData = [
            {
                id: 'INST-001',
                name: '电子天平',
                model: 'ME204E',
                calibrationDate: '2025-01-15',
                expireDate: '2026-01-14',
                calibrationAgency: 'XX计量测试研究院',
                certificateNumber: 'JL20250115001',
                notes: '精度: 0.1mg'
            },
            {
                id: 'INST-002',
                name: 'pH计',
                model: 'PHS-3C',
                calibrationDate: '2025-02-20',
                expireDate: '2026-02-19',
                calibrationAgency: 'XX计量测试研究院',
                certificateNumber: 'JL20250220002',
                notes: ''
            }
        ];
        
        let content, filename, mimeType;
        
        if (format === 'json') {
            content = JSON.stringify(sampleData, null, 2);
            filename = '仪器导入模板.json';
            mimeType = 'application/json';
        } else {
            const headers = ['仪器编号', '仪器名称', '型号', '校准日期', '到期日期', '校准机构', '证书编号', '备注'];
            const rows = sampleData.map(inst => [
                inst.id, inst.name, inst.model, inst.calibrationDate, inst.expireDate,
                inst.calibrationAgency, inst.certificateNumber, inst.notes
            ]);
            content = '\ufeff' + [headers, ...rows].map(row => 
                row.map(cell => this.escapeCSV(cell)).join(',')
            ).join('\n');
            filename = '仪器导入模板.csv';
            mimeType = 'text/csv;charset=utf-8';
        }
        
        this.downloadFile(content, filename, mimeType);
        this.showToast(`已下载 ${format.toUpperCase()} 模板`, 'success');
    }

    openModal() {
        document.getElementById('modal-overlay').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('modal-overlay').style.display = 'none';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3500);
    }
}

const instrumentManager = new InstrumentManager();
