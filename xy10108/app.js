class InstrumentManager {
    constructor() {
        this.STORAGE_KEYS = {
            INSTRUMENTS: 'calibration_instruments',
            HISTORY: 'calibration_history'
        };
        this.currentPreviewData = [];
        this.isElectron = window.electronAPI && window.electronAPI.isElectron;
        this.init();
    }

    async init() {
        if (this.isElectron) {
            this.appPaths = await window.electronAPI.getAppPaths();
            this.setupElectronMenuHandlers();
            document.getElementById('electron-only-section').style.display = 'block';
        }
        this.bindEvents();
        this.renderDashboard();
        this.renderInstruments();
        this.renderHistory();
    }

    setupElectronMenuHandlers() {
        if (!this.isElectron) return;
        
        window.electronAPI.onMenuImportData(() => {
            this.switchTab('import');
            this.showToast('请在下方选择要导入的台账数据文件', 'info');
        });
        
        window.electronAPI.onMenuImportCertificate(() => {
            this.switchTab('instruments');
            this.showToast('请选择一台仪器后添加证书附件', 'info');
        });
        
        window.electronAPI.onMenuExportJson(() => {
            this.switchTab('export');
            this.exportData('json');
        });
        
        window.electronAPI.onMenuExportCsv(() => {
            this.switchTab('export');
            this.exportData('csv');
        });
        
        window.electronAPI.onMenuExportExcel(() => {
            this.switchTab('export');
            this.exportData('excel');
        });
        
        window.electronAPI.onMenuCheckAttachments(() => {
            this.switchTab('export');
            this.checkAllAttachments();
        });
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
        document.getElementById('export-excel-btn').addEventListener('click', () => {
            this.exportData('excel');
        });
        
        document.getElementById('check-all-attachments-btn').addEventListener('click', () => {
            this.checkAllAttachments();
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
            notes: String(data.notes || data['备注'] || data['notes'] || '').trim(),
            attachments: data.attachments || []
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
                    ...existingInstruments[existingIndex],
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
        
        this.bindInstrumentCardEvents();
    }

    bindInstrumentCardEvents() {
        const listContainer = document.getElementById('instrument-list');
        
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
        
        listContainer.querySelectorAll('[data-action="add-attachment"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.addAttachment(btn.dataset.id);
            });
        });
        
        listContainer.querySelectorAll('[data-action="view-attachments"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showInstrumentDetail(btn.dataset.id);
            });
        });
    }

    renderInstrumentCard(instrument, simple = false) {
        const status = instrument.status;
        const daysLeft = instrument.daysLeft;
        const attachmentCount = (instrument.attachments || []).length;
        
        let actions = '';
        if (!simple) {
            actions = `
                <div class="instrument-actions">
                    <button class="btn-outline" data-action="view" data-id="${instrument.id}">查看详情</button>
                    <button class="btn-outline" data-action="edit" data-id="${instrument.id}">编辑</button>
                    <button class="btn-success" data-action="renew" data-id="${instrument.id}">更新校准</button>
                    ${this.isElectron ? `
                        <button class="btn-outline" data-action="add-attachment" data-id="${instrument.id}">
                            📎 添加证书
                        </button>
                    ` : ''}
                    <button class="btn-danger" data-action="delete" data-id="${instrument.id}">删除</button>
                </div>
            `;
        }
        
        const attachmentBadge = attachmentCount > 0 ? 
            `<span class="attachment-badge" title="已绑定 ${attachmentCount} 个证书文件">
                📎 ${attachmentCount}
            </span>` : 
            (this.isElectron ? '<span class="attachment-badge missing" title="未绑定证书文件">📎 无</span>' : '');
        
        return `
            <div class="instrument-card ${status}">
                <div class="instrument-header">
                    <div>
                        <div class="instrument-id">编号: ${instrument.id}</div>
                        <div class="instrument-name">${instrument.name} ${attachmentBadge}</div>
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

    async showInstrumentDetail(id) {
        const instruments = this.getInstruments();
        const instrument = instruments.find(inst => inst.id === id);
        
        if (!instrument) {
            this.showToast('仪器不存在', 'error');
            return;
        }
        
        const { status, daysLeft } = this.getInstrumentStatus(instrument);
        
        let attachmentsHtml = '';
        if (instrument.attachments && instrument.attachments.length > 0) {
            const attachmentList = [];
            for (const attachment of instrument.attachments) {
                let exists = true;
                if (this.isElectron) {
                    const result = await window.electronAPI.checkAttachmentExists(attachment.fileName);
                    exists = result.exists;
                }
                
                attachmentList.push(`
                    <div class="attachment-item ${!exists ? 'missing' : ''}">
                        <span class="attachment-icon">${this.getFileIcon(attachment.originalName)}</span>
                        <div class="attachment-info">
                            <div class="attachment-name">${attachment.originalName}</div>
                            <div class="attachment-date">添加时间: ${this.formatDateTime(new Date(attachment.addedAt))}</div>
                            ${!exists ? '<div class="attachment-missing">⚠️ 文件已缺失</div>' : ''}
                        </div>
                        ${this.isElectron && exists ? `
                            <button class="btn-outline" onclick="instrumentManager.openAttachment('${attachment.fileName}')">打开</button>
                            <button class="btn-outline" onclick="instrumentManager.removeAttachment('${id}', '${attachment.fileName}')">删除</button>
                        ` : ''}
                    </div>
                `);
            }
            attachmentsHtml = `
                <div class="form-group" style="margin-top: 20px;">
                    <label>证书附件 (${instrument.attachments.length})</label>
                    <div class="attachment-list">
                        ${attachmentList.join('')}
                    </div>
                    ${this.isElectron ? `
                        <button class="btn-secondary" style="margin-top: 10px;" onclick="instrumentManager.addAttachment('${id}')">
                            + 添加证书附件
                        </button>
                    ` : ''}
                </div>
            `;
        } else if (this.isElectron) {
            attachmentsHtml = `
                <div class="form-group" style="margin-top: 20px;">
                    <label>证书附件</label>
                    <p style="color: #6c757d; font-size: 14px;">暂无绑定的证书附件</p>
                    <button class="btn-secondary" style="margin-top: 10px;" onclick="instrumentManager.addAttachment('${id}')">
                        + 添加证书附件
                    </button>
                </div>
            `;
        }
        
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
            ${attachmentsHtml}
        `;
        document.getElementById('modal-footer').innerHTML = `
            <button class="btn-primary" onclick="instrumentManager.closeModal()">关闭</button>
        `;
        this.openModal();
    }

    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📕',
            'doc': '📘',
            'docx': '📘',
            'xls': '📗',
            'xlsx': '📗',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'bmp': '🖼️',
            'tif': '🖼️',
            'tiff': '🖼️'
        };
        return icons[ext] || '📄';
    }

    async addAttachment(instrumentId) {
        if (!this.isElectron) {
            this.showToast('证书附件功能仅在桌面应用中可用', 'warning');
            return;
        }
        
        const instruments = this.getInstruments();
        const instrument = instruments.find(inst => inst.id === instrumentId);
        if (!instrument) {
            this.showToast('仪器不存在', 'error');
            return;
        }
        
        const result = await window.electronAPI.openFileDialog({
            title: '选择证书文件',
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: '所有文件', extensions: ['*'] },
                { name: 'PDF 文件', extensions: ['pdf'] },
                { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff'] },
                { name: 'Word 文档', extensions: ['doc', 'docx'] },
                { name: 'Excel 文档', extensions: ['xls', 'xlsx'] }
            ]
        });
        
        if (result.canceled || result.filePaths.length === 0) {
            return;
        }
        
        let addedCount = 0;
        let failedCount = 0;
        
        for (const filePath of result.filePaths) {
            const copyResult = await window.electronAPI.copyAttachment(filePath, instrumentId);
            
            if (copyResult.success) {
                if (!instrument.attachments) {
                    instrument.attachments = [];
                }
                instrument.attachments.push({
                    fileName: copyResult.fileName,
                    originalName: copyResult.originalName,
                    filePath: copyResult.filePath,
                    addedAt: new Date().toISOString()
                });
                addedCount++;
            } else {
                failedCount++;
                console.error('复制文件失败:', copyResult.error);
            }
        }
        
        instrument.updatedAt = new Date().toISOString();
        this.saveInstruments(instruments);
        
        if (addedCount > 0) {
            this.addHistory('添加证书', `为仪器「${instrument.name}」(${instrumentId}) 添加了 ${addedCount} 个证书附件`);
        }
        
        this.renderDashboard();
        this.renderInstruments();
        
        if (addedCount > 0 && failedCount === 0) {
            this.showToast(`成功添加 ${addedCount} 个证书附件`, 'success');
        } else if (addedCount > 0) {
            this.showToast(`添加了 ${addedCount} 个证书，${failedCount} 个失败`, 'warning');
        } else {
            this.showToast('证书添加失败', 'error');
        }
        
        this.closeModal();
        this.showInstrumentDetail(instrumentId);
    }

    async openAttachment(fileName) {
        if (!this.isElectron) return;
        
        const result = await window.electronAPI.openAttachment(fileName);
        if (!result.success) {
            this.showToast('无法打开文件: ' + result.error, 'error');
        }
    }

    async removeAttachment(instrumentId, fileName) {
        if (!this.isElectron) return;
        
        if (!confirm('确定要删除此证书附件吗？此操作不可撤销。')) {
            return;
        }
        
        const instruments = this.getInstruments();
        const instrument = instruments.find(inst => inst.id === instrumentId);
        
        if (!instrument || !instrument.attachments) {
            this.showToast('附件不存在', 'error');
            return;
        }
        
        const attachmentIndex = instrument.attachments.findIndex(a => a.fileName === fileName);
        if (attachmentIndex < 0) {
            this.showToast('附件不存在', 'error');
            return;
        }
        
        const attachment = instrument.attachments[attachmentIndex];
        
        await window.electronAPI.deleteAttachment(fileName);
        instrument.attachments.splice(attachmentIndex, 1);
        instrument.updatedAt = new Date().toISOString();
        
        this.saveInstruments(instruments);
        this.addHistory('删除证书', `从仪器「${instrument.name}」(${instrumentId}) 删除了证书「${attachment.originalName}」`);
        
        this.renderDashboard();
        this.renderInstruments();
        this.showToast('证书附件已删除', 'success');
        
        this.closeModal();
        this.showInstrumentDetail(instrumentId);
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
            ${this.isElectron ? `
                <div class="form-group">
                    <label>更新证书</label>
                    <p style="color: #6c757d; font-size: 13px;">保存后可在仪器详情中添加新的证书附件</p>
                </div>
            ` : ''}
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
                attachments: [],
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

    async deleteInstrument(id) {
        if (!confirm('确定要删除该仪器吗？此操作不可撤销。\n\n注意：绑定的证书附件也将被删除。')) {
            return;
        }
        
        const instruments = this.getInstruments();
        const index = instruments.findIndex(inst => inst.id === id);
        
        if (index >= 0) {
            const deleted = instruments[index];
            
            if (this.isElectron && deleted.attachments) {
                for (const attachment of deleted.attachments) {
                    await window.electronAPI.deleteAttachment(attachment.fileName);
                }
            }
            
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
            '清空历史': '🧹',
            '添加证书': '📎',
            '删除证书': '🗑️',
            '导出数据': '📤'
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

    async exportData(format) {
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
        
        if (format === 'excel') {
            await this.exportExcel(filtered);
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
                attachments: inst.attachments,
                status: this.getStatusText(inst.status),
                daysLeft: inst.daysLeft
            }));
            content = JSON.stringify(exportData, null, 2);
            filename = `仪器校准清单_${this.getDateString()}.json`;
            mimeType = 'application/json';
        } else {
            const headers = ['仪器编号', '仪器名称', '型号', '校准日期', '到期日期', '状态', '剩余天数', '校准机构', '证书编号', '附件数量', '备注'];
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
                (inst.attachments || []).length,
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

    async exportExcel(filtered) {
        if (!this.isElectron) {
            this.showToast('Excel 导出功能仅在桌面应用中可用，请使用 CSV 或 JSON 格式', 'warning');
            return;
        }
        
        const excelData = filtered.map(inst => ({
            '仪器编号': inst.id,
            '仪器名称': inst.name,
            '型号': inst.model || '',
            '校准日期': inst.calibrationDate,
            '到期日期': inst.expireDate,
            '状态': this.getStatusText(inst.status),
            '剩余天数': this.getDaysLeftText(inst.daysLeft),
            '校准机构': inst.calibrationAgency || '',
            '证书编号': inst.certificateNumber || '',
            '附件数量': (inst.attachments || []).length,
            '备注': inst.notes || ''
        }));
        
        const fileName = `仪器校准清单_${this.getDateString()}.xlsx`;
        const result = await window.electronAPI.exportExcel(excelData, fileName);
        
        if (result.success) {
            this.addHistory('导出数据', `导出了 ${filtered.length} 条仪器数据为 Excel 格式`);
            this.showToast(`成功导出 ${filtered.length} 条数据到 Excel`, 'success');
        } else if (!result.canceled) {
            this.showToast('导出失败: ' + result.error, 'error');
        }
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

    async checkAllAttachments() {
        if (!this.isElectron) {
            this.showToast('附件检查功能仅在桌面应用中可用', 'warning');
            return;
        }
        
        const instruments = this.getInstruments();
        const resultContainer = document.getElementById('attachment-check-result');
        
        if (instruments.length === 0) {
            resultContainer.innerHTML = '<p class="empty-state" style="padding: 20px;">暂无仪器数据</p>';
            return;
        }
        
        const totalAttachments = instruments.reduce((sum, inst) => sum + (inst.attachments || []).length, 0);
        
        if (totalAttachments === 0) {
            resultContainer.innerHTML = '<p class="empty-state" style="padding: 20px;">暂无绑定的证书附件</p>';
            return;
        }
        
        this.showToast('正在检查附件完整性...', 'info');
        
        const results = await window.electronAPI.checkAllAttachments(instruments);
        
        const missingFiles = results.filter(r => !r.exists);
        const existingFiles = results.filter(r => r.exists);
        
        let html = '';
        
        if (missingFiles.length > 0) {
            html += `
                <div class="preview-message error" style="margin-bottom: 15px;">
                    ⚠️ 发现 ${missingFiles.length} 个缺失的证书文件！
                </div>
                <div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="margin-bottom: 10px; color: #721c24;">缺失文件列表：</h4>
                    <ul style="list-style: none; padding: 0;">
                        ${missingFiles.map(f => `
                            <li style="padding: 8px 0; border-bottom: 1px solid #f5c6cb;">
                                <strong>${f.instrumentName}</strong> (${f.instrumentId}) - ${f.originalName}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (existingFiles.length > 0) {
            html += `
                <div class="preview-message info">
                    ✅ ${existingFiles.length} 个证书文件完整可用
                </div>
            `;
        }
        
        html += `
            <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 13px;">
                <p><strong>总计：</strong>${totalAttachments} 个附件</p>
                <p><strong>完整：</strong>${existingFiles.length} 个</p>
                <p><strong>缺失：</strong>${missingFiles.length} 个</p>
                <p style="margin-top: 10px; color: #6c757d;">
                    💡 附件存储位置：${this.appPaths ? this.appPaths.attachments : '应用数据目录'}
                </p>
            </div>
        `;
        
        resultContainer.innerHTML = html;
        
        if (missingFiles.length > 0) {
            this.addHistory('检查附件', `检查发现 ${missingFiles.length} 个缺失的证书文件`);
        } else {
            this.addHistory('检查附件', '所有证书附件检查通过，全部完整可用');
        }
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
