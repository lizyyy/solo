const Storage = {
    KEYS: {
        PARTICIPANTS: 'race_verifier_participants',
        LOGS: 'race_verifier_logs',
        LAST_VERIFICATION: 'race_verifier_last_verification'
    },

    getParticipants() {
        try {
            const data = localStorage.getItem(this.KEYS.PARTICIPANTS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取参与者数据失败:', e);
            return [];
        }
    },

    setParticipants(participants) {
        try {
            localStorage.setItem(this.KEYS.PARTICIPANTS, JSON.stringify(participants));
            return true;
        } catch (e) {
            console.error('保存参与者数据失败:', e);
            return false;
        }
    },

    getLogs() {
        try {
            const data = localStorage.getItem(this.KEYS.LOGS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取日志数据失败:', e);
            return [];
        }
    },

    setLogs(logs) {
        try {
            localStorage.setItem(this.KEYS.LOGS, JSON.stringify(logs));
            return true;
        } catch (e) {
            console.error('保存日志数据失败:', e);
            return false;
        }
    },

    addLog(log) {
        const logs = this.getLogs();
        logs.unshift({
            ...log,
            id: Date.now(),
            timestamp: new Date().toISOString()
        });
        return this.setLogs(logs);
    },

    clearAllData() {
        try {
            Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
            return true;
        } catch (e) {
            console.error('清空数据失败:', e);
            return false;
        }
    }
};

const UI = {
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showModal(title, content, footerButtons = []) {
        const overlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.getElementById('modal-content');
        const modalFooter = document.getElementById('modal-footer');

        modalTitle.textContent = title;
        modalContent.innerHTML = content;
        
        modalFooter.innerHTML = '';
        footerButtons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class || 'btn-secondary'}`;
            button.textContent = btn.text;
            button.onclick = () => {
                if (btn.onClick) btn.onClick();
                this.hideModal();
            };
            modalFooter.appendChild(button);
        });

        overlay.classList.remove('hidden');
    },

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    },

    getStatusBadge(status) {
        const statusMap = {
            passed: { text: '通过', class: 'status-passed' },
            pending: { text: '待处理', class: 'status-pending' },
            failed: { text: '失败', class: 'status-failed' },
            untested: { text: '未检测', class: 'status-untested' }
        };
        const info = statusMap[status] || statusMap.untested;
        return `<span class="status-badge ${info.class}">${info.text}</span>`;
    },

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
};

const Verification = {
    VALID_ZONES: ['A', 'B', 'C'],
    
    ZONE_RANGES: {
        A: { min: 1, max: 5000, desc: '全程马拉松' },
        B: { min: 5001, max: 15000, desc: '半程马拉松' },
        C: { min: 15001, max: 30000, desc: '迷你马拉松' }
    },

    validateBibFormat(bib) {
        const bibNum = parseInt(bib);
        if (isNaN(bibNum)) return false;
        if (bibNum < 1 || bibNum > 30000) return false;
        return true;
    },

    validateChipFormat(chip) {
        if (!chip || chip.length < 6) return false;
        const pattern = /^[A-Z0-9]+$/i;
        return pattern.test(chip);
    },

    validateZone(zone) {
        return this.VALID_ZONES.includes(zone.toUpperCase());
    },

    getZoneForBib(bib) {
        const bibNum = parseInt(bib);
        for (const [zone, range] of Object.entries(this.ZONE_RANGES)) {
            if (bibNum >= range.min && bibNum <= range.max) {
                return zone;
            }
        }
        return null;
    },

    verifyParticipantList(participants) {
        const results = [];
        const bibMap = new Map();

        participants.forEach((p, index) => {
            const errors = [];
            const warnings = [];
            let status = 'passed';

            if (!p.name || p.name.trim() === '') {
                errors.push('姓名字段为空');
                status = 'failed';
            }

            if (!p.bib || p.bib.trim() === '') {
                errors.push('参赛号码为空');
                status = 'failed';
            } else if (!this.validateBibFormat(p.bib)) {
                errors.push(`参赛号码格式无效: ${p.bib} (应为1-30000的数字)`);
                status = 'failed';
            }

            if (p.bib) {
                if (bibMap.has(p.bib)) {
                    const duplicateIndex = bibMap.get(p.bib);
                    errors.push(`参赛号码重复: ${p.bib} (与第${duplicateIndex + 1}条记录重复)`);
                    status = 'failed';
                } else {
                    bibMap.set(p.bib, index);
                }
            }

            if (p.idcard && p.idcard.length !== 18) {
                warnings.push('身份证号格式不规范，建议人工确认');
                if (status === 'passed') status = 'pending';
            }

            if (p.name && !/^[\u4e00-\u9fa5·]+$/.test(p.name)) {
                warnings.push('姓名包含非中文字符，建议人工确认');
                if (status === 'passed') status = 'pending';
            }

            results.push({
                index,
                participant: p,
                status,
                errors,
                warnings,
                type: 'list'
            });
        });

        return {
            total: participants.length,
            passed: results.filter(r => r.status === 'passed').length,
            pending: results.filter(r => r.status === 'pending').length,
            failed: results.filter(r => r.status === 'failed').length,
            details: results
        };
    },

    verifyChipBinding(participants) {
        const results = [];
        const chipMap = new Map();
        const bibChipMap = new Map();

        participants.forEach((p, index) => {
            const errors = [];
            const warnings = [];
            let status = 'passed';

            if (!p.chip || p.chip.trim() === '') {
                errors.push('芯片号为空');
                status = 'failed';
            } else if (!this.validateChipFormat(p.chip)) {
                errors.push(`芯片号格式无效: ${p.chip} (应为6位以上字母数字组合)`);
                status = 'failed';
            }

            if (p.chip) {
                if (chipMap.has(p.chip)) {
                    const duplicateInfo = chipMap.get(p.chip);
                    if (duplicateInfo.bib !== p.bib) {
                        errors.push(`芯片号${p.chip}已绑定到参赛号码${duplicateInfo.bib}，当前绑定到${p.bib}`);
                        status = 'failed';
                    }
                } else {
                    chipMap.set(p.chip, { bib: p.bib, index });
                }
            }

            if (p.chip && p.bib) {
                const key = `${p.bib}-${p.chip}`;
                if (bibChipMap.has(key)) {
                    warnings.push('芯片绑定关系重复记录');
                    if (status === 'passed') status = 'pending';
                } else {
                    bibChipMap.set(key, true);
                }
            }

            if (p.chip && p.chip.length === 6) {
                warnings.push('芯片号为6位最短格式，建议人工确认是否完整');
                if (status === 'passed') status = 'pending';
            }

            results.push({
                index,
                participant: p,
                status,
                errors,
                warnings,
                type: 'chip'
            });
        });

        return {
            total: participants.length,
            passed: results.filter(r => r.status === 'passed').length,
            pending: results.filter(r => r.status === 'pending').length,
            failed: results.filter(r => r.status === 'failed').length,
            details: results
        };
    },

    verifyZone(participants) {
        const results = [];

        participants.forEach((p, index) => {
            const errors = [];
            const warnings = [];
            let status = 'passed';

            if (!p.zone || p.zone.trim() === '') {
                errors.push('分区信息为空');
                status = 'failed';
            } else if (!this.validateZone(p.zone)) {
                errors.push(`分区无效: ${p.zone} (应为A、B或C)`);
                status = 'failed';
            }

            if (p.bib && p.zone && this.validateBibFormat(p.bib)) {
                const expectedZone = this.getZoneForBib(p.bib);
                const actualZone = p.zone.toUpperCase();
                
                if (expectedZone && expectedZone !== actualZone) {
                    const expectedRange = this.ZONE_RANGES[expectedZone];
                    errors.push(`分区与参赛号段不匹配: 号码${p.bib}应属于${expectedZone}区(${expectedRange.desc})，实际为${actualZone}区`);
                    status = 'failed';
                }
            }

            if (p.bib && this.validateBibFormat(p.bib)) {
                const bibNum = parseInt(p.bib);
                for (const [zone, range] of Object.entries(this.ZONE_RANGES)) {
                    if (bibNum === range.min || bibNum === range.max) {
                        warnings.push(`参赛号码${p.bib}位于${zone}区边界，建议人工确认分区`);
                        if (status === 'passed') status = 'pending';
                    }
                }
            }

            if (p.zone === 'C' && participants.length > 15000) {
                const cZoneCount = participants.filter(x => x.zone === 'C').length;
                if (cZoneCount > 15000) {
                    warnings.push('C区选手数量较多，建议核对分区规则');
                    if (status === 'passed') status = 'pending';
                }
            }

            results.push({
                index,
                participant: p,
                status,
                errors,
                warnings,
                type: 'zone'
            });
        });

        return {
            total: participants.length,
            passed: results.filter(r => r.status === 'passed').length,
            pending: results.filter(r => r.status === 'pending').length,
            failed: results.filter(r => r.status === 'failed').length,
            details: results
        };
    },

    verifyAll(participants) {
        const listResult = this.verifyParticipantList(participants);
        const chipResult = this.verifyChipBinding(participants);
        const zoneResult = this.verifyZone(participants);

        const combinedDetails = participants.map((p, index) => {
            const listDetail = listResult.details[index];
            const chipDetail = chipResult.details[index];
            const zoneDetail = zoneResult.details[index];

            const allErrors = [
                ...listDetail.errors,
                ...chipDetail.errors,
                ...zoneDetail.errors
            ];
            const allWarnings = [
                ...listDetail.warnings,
                ...chipDetail.warnings,
                ...zoneDetail.warnings
            ];

            let status = 'passed';
            if (allErrors.length > 0) status = 'failed';
            else if (allWarnings.length > 0) status = 'pending';

            return {
                index,
                participant: p,
                status,
                errors: allErrors,
                warnings: allWarnings,
                listStatus: listDetail.status,
                chipStatus: chipDetail.status,
                zoneStatus: zoneDetail.status,
                type: 'all'
            };
        });

        return {
            total: participants.length,
            passed: combinedDetails.filter(r => r.status === 'passed').length,
            pending: combinedDetails.filter(r => r.status === 'pending').length,
            failed: combinedDetails.filter(r => r.status === 'failed').length,
            list: listResult,
            chip: chipResult,
            zone: zoneResult,
            details: combinedDetails
        };
    }
};

const FileParser = {
    FIELD_MAPPINGS: {
        '姓名': 'name',
        'name': 'name',
        '参赛号码': 'bib',
        '号码': 'bib',
        'bib': 'bib',
        '号码布': 'bib',
        '芯片号': 'chip',
        '芯片': 'chip',
        'chip': 'chip',
        'chip number': 'chip',
        '分区': 'zone',
        '区域': 'zone',
        'zone': 'zone',
        '身份证号': 'idcard',
        '身份证': 'idcard',
        'idcard': 'idcard',
        '联系电话': 'phone',
        '电话': 'phone',
        'phone': 'phone',
        '手机': 'phone'
    },

    parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) return [];

        const headers = this.parseCSVLine(lines[0]);
        const participants = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const participant = {};
            headers.forEach((header, index) => {
                const normalizedHeader = header.trim().toLowerCase();
                const fieldName = this.FIELD_MAPPINGS[header.trim()] || 
                                  this.FIELD_MAPPINGS[normalizedHeader];
                if (fieldName && values[index]) {
                    participant[fieldName] = values[index].trim();
                }
            });

            if (Object.keys(participant).length > 0) {
                participants.push(participant);
            }
        }

        return participants;
    },

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));

        return result;
    },

    parseExcel(workbook) {
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) return [];

        const headers = jsonData[0];
        const participants = [];

        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.every(cell => !cell)) continue;

            const participant = {};
            headers.forEach((header, index) => {
                if (header && row[index] !== undefined) {
                    const normalizedHeader = String(header).trim().toLowerCase();
                    const fieldName = this.FIELD_MAPPINGS[String(header).trim()] || 
                                      this.FIELD_MAPPINGS[normalizedHeader];
                    if (fieldName) {
                        participant[fieldName] = String(row[index]).trim();
                    }
                }
            });

            if (Object.keys(participant).length > 0) {
                participants.push(participant);
            }
        }

        return participants;
    },

    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    if (file.name.endsWith('.csv')) {
                        const text = e.target.result;
                        resolve(this.parseCSV(text));
                    } else {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        resolve(this.parseExcel(workbook));
                    }
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('文件读取失败'));

            if (file.name.endsWith('.csv')) {
                reader.readAsText(file, 'UTF-8');
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }
};

const App = {
    participants: [],
    currentPreviewData: [],
    lastVerificationResult: null,

    init() {
        this.participants = Storage.getParticipants();
        this.bindEvents();
        this.render();
        Storage.addLog({
            type: 'system',
            details: '系统启动',
            status: 'info'
        });
    },

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                UI.switchTab(btn.dataset.tab);
            });
        });

        document.getElementById('quick-import').addEventListener('click', () => {
            UI.switchTab('data');
        });

        document.getElementById('quick-verify').addEventListener('click', () => {
            UI.switchTab('verification');
        });

        document.getElementById('quick-clear').addEventListener('click', () => {
            this.clearAllData();
        });

        document.getElementById('select-file').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFileUpload(file);
        });

        const fileDrop = document.getElementById('file-drop');
        fileDrop.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDrop.classList.add('dragover');
        });

        fileDrop.addEventListener('dragleave', () => {
            fileDrop.classList.remove('dragover');
        });

        fileDrop.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDrop.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFileUpload(file);
        });

        document.getElementById('confirm-import').addEventListener('click', () => {
            this.confirmImport();
        });

        document.getElementById('manual-entry-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleManualEntry();
        });

        document.getElementById('verify-list').addEventListener('click', () => {
            this.runVerification('list');
        });

        document.getElementById('verify-chip').addEventListener('click', () => {
            this.runVerification('chip');
        });

        document.getElementById('verify-zone').addEventListener('click', () => {
            this.runVerification('zone');
        });

        document.getElementById('verify-all').addEventListener('click', () => {
            this.runVerification('all');
        });

        document.getElementById('log-filter').addEventListener('change', () => {
            this.renderLogs();
        });

        document.getElementById('refresh-logs').addEventListener('click', () => {
            this.renderLogs();
            UI.showToast('日志已刷新', 'success');
        });

        document.getElementById('clear-logs').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('modal-close').addEventListener('click', () => {
            UI.hideModal();
        });

        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                UI.hideModal();
            }
        });
    },

    async handleFileUpload(file) {
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                           'application/vnd.ms-excel',
                           'text/csv'];
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!validExtensions.includes(fileExtension)) {
            UI.showToast('请上传Excel或CSV文件', 'error');
            return;
        }

        try {
            UI.showToast('正在解析文件...', 'info');
            const participants = await FileParser.parseFile(file);
            
            if (participants.length === 0) {
                UI.showToast('文件中没有有效数据', 'warning');
                return;
            }

            this.currentPreviewData = participants;
            this.renderPreview();
            document.getElementById('confirm-import').disabled = false;
            UI.showToast(`成功解析 ${participants.length} 条记录`, 'success');
            
            Storage.addLog({
                type: 'import',
                details: `解析文件 ${file.name}，共 ${participants.length} 条记录`,
                status: 'success'
            });
        } catch (error) {
            console.error('文件解析失败:', error);
            UI.showToast('文件解析失败: ' + error.message, 'error');
            Storage.addLog({
                type: 'error',
                details: `解析文件 ${file.name} 失败: ${error.message}`,
                status: 'failed'
            });
        }
    },

    renderPreview() {
        const table = document.getElementById('preview-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (this.currentPreviewData.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '<tr><td class="placeholder" colspan="6">暂无预览数据</td></tr>';
            return;
        }

        const firstItem = this.currentPreviewData[0];
        thead.innerHTML = `<tr>${Object.keys(firstItem).map(key => `<th>${this.getFieldLabel(key)}</th>`).join('')}</tr>`;

        const displayCount = Math.min(this.currentPreviewData.length, 10);
        tbody.innerHTML = this.currentPreviewData.slice(0, displayCount).map(item => 
            `<tr>${Object.values(item).map(value => `<td>${value || '-'}</td>`).join('')}</tr>`
        ).join('');

        if (this.currentPreviewData.length > 10) {
            tbody.innerHTML += `<tr><td colspan="${Object.keys(firstItem).length}" style="text-align: center; color: var(--text-light);">... 还有 ${this.currentPreviewData.length - 10} 条记录未显示</td></tr>`;
        }
    },

    getFieldLabel(key) {
        const labels = {
            name: '姓名',
            bib: '参赛号码',
            chip: '芯片号',
            zone: '分区',
            idcard: '身份证号',
            phone: '联系电话'
        };
        return labels[key] || key;
    },

    confirmImport() {
        if (this.currentPreviewData.length === 0) {
            UI.showToast('没有可导入的数据', 'warning');
            return;
        }

        const existingBibs = new Set(this.participants.map(p => p.bib));
        const duplicates = this.currentPreviewData.filter(p => existingBibs.has(p.bib));

        if (duplicates.length > 0) {
            UI.showModal(
                '发现重复数据',
                `<p>发现 ${duplicates.length} 条重复的参赛号码：</p>
                 <ul>${duplicates.slice(0, 10).map(d => `<li>号码: ${d.bib}, 姓名: ${d.name}</li>`).join('')}</ul>
                 ${duplicates.length > 10 ? `<p>... 还有 ${duplicates.length - 10} 条重复</p>` : ''}
                 <p>请选择处理方式：</p>`,
                [
                    {
                        text: '取消导入',
                        class: 'btn-secondary',
                        onClick: () => {}
                    },
                    {
                        text: '跳过重复',
                        class: 'btn-warning',
                        onClick: () => {
                            const newData = this.currentPreviewData.filter(p => !existingBibs.has(p.bib));
                            this.importData(newData);
                        }
                    },
                    {
                        text: '覆盖更新',
                        class: 'btn-danger',
                        onClick: () => {
                            this.importData(this.currentPreviewData, true);
                        }
                    }
                ]
            );
        } else {
            this.importData(this.currentPreviewData);
        }
    },

    importData(data, overwrite = false) {
        if (overwrite) {
            const bibMap = new Map(this.participants.map((p, i) => [p.bib, i]));
            data.forEach(p => {
                if (bibMap.has(p.bib)) {
                    this.participants[bibMap.get(p.bib)] = p;
                } else {
                    this.participants.push(p);
                }
            });
        } else {
            this.participants.push(...data);
        }

        Storage.setParticipants(this.participants);
        this.currentPreviewData = [];
        this.renderPreview();
        document.getElementById('confirm-import').disabled = true;
        this.render();
        
        UI.showToast(`成功导入 ${data.length} 条记录`, 'success');
        Storage.addLog({
            type: 'import',
            details: `导入 ${data.length} 条记录${overwrite ? '(覆盖模式)' : ''}`,
            status: 'success'
        });
    },

    handleManualEntry() {
        const name = document.getElementById('entry-name').value.trim();
        const bib = document.getElementById('entry-bib').value.trim();
        const chip = document.getElementById('entry-chip').value.trim();
        const zone = document.getElementById('entry-zone').value.trim();
        const idcard = document.getElementById('entry-idcard').value.trim();
        const phone = document.getElementById('entry-phone').value.trim();

        if (!name || !bib || !chip || !zone) {
            UI.showToast('请填写必填字段', 'warning');
            return;
        }

        const existingBib = this.participants.find(p => p.bib === bib);
        if (existingBib) {
            UI.showModal(
                '参赛号码已存在',
                `<p>参赛号码 ${bib} 已存在：</p>
                 <p>姓名: ${existingBib.name}</p>
                 <p>芯片号: ${existingBib.chip}</p>
                 <p>分区: ${existingBib.zone}</p>
                 <p>是否覆盖？</p>`,
                [
                    {
                        text: '取消',
                        class: 'btn-secondary',
                        onClick: () => {}
                    },
                    {
                        text: '覆盖更新',
                        class: 'btn-warning',
                        onClick: () => {
                            const index = this.participants.indexOf(existingBib);
                            this.participants[index] = { name, bib, chip, zone, idcard, phone };
                            this.saveAndRender();
                            UI.showToast('记录已更新', 'success');
                            Storage.addLog({
                                type: 'modify',
                                details: `更新参赛号码 ${bib} 的记录`,
                                status: 'success'
                            });
                        }
                    }
                ]
            );
            return;
        }

        this.participants.push({ name, bib, chip, zone, idcard, phone });
        this.saveAndRender();
        
        document.getElementById('manual-entry-form').reset();
        UI.showToast('记录添加成功', 'success');
        Storage.addLog({
            type: 'modify',
            details: `添加新记录: ${name} (号码: ${bib})`,
            status: 'success'
        });
    },

    saveAndRender() {
        Storage.setParticipants(this.participants);
        this.render();
    },

    runVerification(type) {
        if (this.participants.length === 0) {
            UI.showToast('没有数据，请先导入或添加参赛记录', 'warning');
            return;
        }

        UI.showToast('正在执行核验...', 'info');

        let result;
        switch (type) {
            case 'list':
                result = Verification.verifyParticipantList(this.participants);
                break;
            case 'chip':
                result = Verification.verifyChipBinding(this.participants);
                break;
            case 'zone':
                result = Verification.verifyZone(this.participants);
                break;
            case 'all':
                result = Verification.verifyAll(this.participants);
                break;
        }

        this.lastVerificationResult = result;
        this.updateParticipantStatuses(result);
        this.renderVerificationResults(result, type);
        this.render();

        const typeNames = {
            list: '参赛名单验证',
            chip: '芯片绑定验证',
            zone: '分区校验',
            all: '全部核验'
        };

        UI.showToast(
            `${typeNames[type]}完成: 通过${result.passed}, 待处理${result.pending}, 失败${result.failed}`,
            result.failed > 0 ? 'warning' : 'success'
        );

        Storage.addLog({
            type: 'verify',
            details: `${typeNames[type]}: 共${result.total}条, 通过${result.passed}, 待处理${result.pending}, 失败${result.failed}`,
            status: result.failed > 0 ? 'warning' : 'success'
        });
    },

    updateParticipantStatuses(result) {
        result.details.forEach((detail, index) => {
            if (this.participants[index]) {
                this.participants[index].verificationStatus = detail.status;
                this.participants[index].verificationErrors = detail.errors;
                this.participants[index].verificationWarnings = detail.warnings;
            }
        });
        Storage.setParticipants(this.participants);
    },

    renderVerificationResults(result, type) {
        document.getElementById('result-passed').textContent = result.passed;
        document.getElementById('result-pending').textContent = result.pending;
        document.getElementById('result-failed').textContent = result.failed;

        const detailsContainer = document.getElementById('results-details');
        
        if (result.passed === result.total) {
            detailsContainer.innerHTML = `
                <div class="result-card passed">
                    <h4>✅ 全部通过核验</h4>
                    <p>所有 ${result.total} 条记录均通过核验，可以发放号码布。</p>
                </div>
            `;
            return;
        }

        let html = '';

        const failedItems = result.details.filter(d => d.status === 'failed');
        const pendingItems = result.details.filter(d => d.status === 'pending');

        if (failedItems.length > 0) {
            html += `<h4 style="margin-bottom: 10px; color: var(--danger-color);">❌ 核验失败 (${failedItems.length}条)</h4>`;
            failedItems.slice(0, 20).forEach(item => {
                html += `
                    <div class="result-card failed">
                        <h4>${item.participant.name} - 号码: ${item.participant.bib}</h4>
                        <ul class="error-list">
                            ${item.errors.map(e => `<li>${e}</li>`).join('')}
                        </ul>
                    </div>
                `;
            });
            if (failedItems.length > 20) {
                html += `<p class="placeholder">... 还有 ${failedItems.length - 20} 条失败记录</p>`;
            }
        }

        if (pendingItems.length > 0) {
            html += `<h4 style="margin: 20px 0 10px; color: var(--warning-color);">⏳ 待人工处理 (${pendingItems.length}条)</h4>`;
            pendingItems.slice(0, 10).forEach(item => {
                html += `
                    <div class="result-card pending">
                        <h4>${item.participant.name} - 号码: ${item.participant.bib}</h4>
                        <ul class="error-list">
                            ${item.warnings.map(w => `<li>${w}</li>`).join('')}
                        </ul>
                    </div>
                `;
            });
            if (pendingItems.length > 10) {
                html += `<p class="placeholder">... 还有 ${pendingItems.length - 10} 条待处理记录</p>`;
            }
        }

        detailsContainer.innerHTML = html || '<p class="placeholder">暂无详细结果</p>';
    },

    clearAllData() {
        UI.showModal(
            '确认清空数据',
            `<p>确定要清空所有数据吗？</p>
             <p>此操作将删除所有参赛记录和核验结果，且无法恢复。</p>`,
            [
                {
                    text: '取消',
                    class: 'btn-secondary',
                    onClick: () => {}
                },
                {
                    text: '确认清空',
                    class: 'btn-danger',
                    onClick: () => {
                        Storage.clearAllData();
                        this.participants = [];
                        this.currentPreviewData = [];
                        this.lastVerificationResult = null;
                        this.render();
                        UI.showToast('所有数据已清空', 'success');
                        Storage.addLog({
                            type: 'system',
                            details: '用户清空了所有数据',
                            status: 'warning'
                        });
                    }
                }
            ]
        );
    },

    clearLogs() {
        UI.showModal(
            '确认清空日志',
            `<p>确定要清空所有操作日志吗？</p>
             <p>此操作无法恢复。</p>`,
            [
                {
                    text: '取消',
                    class: 'btn-secondary',
                    onClick: () => {}
                },
                {
                    text: '确认清空',
                    class: 'btn-danger',
                    onClick: () => {
                        Storage.setLogs([]);
                        this.renderLogs();
                        UI.showToast('日志已清空', 'success');
                    }
                }
            ]
        );
    },

    editParticipant(index) {
        const p = this.participants[index];
        UI.showModal(
            `编辑记录 - ${p.name}`,
            `<form id="edit-form">
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>姓名</label>
                    <input type="text" id="edit-name" value="${p.name || ''}" style="width: 100%;">
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>参赛号码</label>
                    <input type="text" id="edit-bib" value="${p.bib || ''}" style="width: 100%;">
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>芯片号</label>
                    <input type="text" id="edit-chip" value="${p.chip || ''}" style="width: 100%;">
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>分区</label>
                    <select id="edit-zone" style="width: 100%;">
                        <option value="A" ${p.zone === 'A' ? 'selected' : ''}>A区</option>
                        <option value="B" ${p.zone === 'B' ? 'selected' : ''}>B区</option>
                        <option value="C" ${p.zone === 'C' ? 'selected' : ''}>C区</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>身份证号</label>
                    <input type="text" id="edit-idcard" value="${p.idcard || ''}" style="width: 100%;">
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label>联系电话</label>
                    <input type="text" id="edit-phone" value="${p.phone || ''}" style="width: 100%;">
                </div>
            </form>`,
            [
                {
                    text: '取消',
                    class: 'btn-secondary',
                    onClick: () => {}
                },
                {
                    text: '保存',
                    class: 'btn-primary',
                    onClick: () => {
                        this.participants[index] = {
                            name: document.getElementById('edit-name').value.trim(),
                            bib: document.getElementById('edit-bib').value.trim(),
                            chip: document.getElementById('edit-chip').value.trim(),
                            zone: document.getElementById('edit-zone').value,
                            idcard: document.getElementById('edit-idcard').value.trim(),
                            phone: document.getElementById('edit-phone').value.trim()
                        };
                        this.saveAndRender();
                        UI.showToast('记录已更新', 'success');
                        Storage.addLog({
                            type: 'modify',
                            details: `编辑记录: 号码 ${this.participants[index].bib}`,
                            status: 'success'
                        });
                    }
                },
                {
                    text: '保存并重跑核验',
                    class: 'btn-success',
                    onClick: () => {
                        this.participants[index] = {
                            name: document.getElementById('edit-name').value.trim(),
                            bib: document.getElementById('edit-bib').value.trim(),
                            chip: document.getElementById('edit-chip').value.trim(),
                            zone: document.getElementById('edit-zone').value,
                            idcard: document.getElementById('edit-idcard').value.trim(),
                            phone: document.getElementById('edit-phone').value.trim()
                        };
                        this.saveAndRender();
                        setTimeout(() => {
                            UI.switchTab('verification');
                            this.runVerification('all');
                        }, 100);
                        Storage.addLog({
                            type: 'modify',
                            details: `编辑并重跑核验: 号码 ${this.participants[index].bib}`,
                            status: 'success'
                        });
                    }
                }
            ]
        );
    },

    deleteParticipant(index) {
        const p = this.participants[index];
        UI.showModal(
            '确认删除',
            `<p>确定要删除以下记录吗？</p>
             <p><strong>姓名:</strong> ${p.name}</p>
             <p><strong>参赛号码:</strong> ${p.bib}</p>
             <p><strong>芯片号:</strong> ${p.chip}</p>`,
            [
                {
                    text: '取消',
                    class: 'btn-secondary',
                    onClick: () => {}
                },
                {
                    text: '确认删除',
                    class: 'btn-danger',
                    onClick: () => {
                        this.participants.splice(index, 1);
                        this.saveAndRender();
                        UI.showToast('记录已删除', 'success');
                        Storage.addLog({
                            type: 'modify',
                            details: `删除记录: 号码 ${p.bib}`,
                            status: 'warning'
                        });
                    }
                }
            ]
        );
    },

    verifySingleParticipant(index) {
        const p = this.participants[index];
        const singleResult = Verification.verifyAll([p]);
        const detail = singleResult.details[0];

        let statusText = '';
        let statusClass = '';
        if (detail.status === 'passed') {
            statusText = '通过';
            statusClass = 'status-passed';
        } else if (detail.status === 'pending') {
            statusText = '待处理';
            statusClass = 'status-pending';
        } else {
            statusText = '失败';
            statusClass = 'status-failed';
        }

        let detailsHtml = '';
        if (detail.errors.length > 0) {
            detailsHtml += `<h5 style="color: var(--danger-color); margin: 10px 0 5px;">错误:</h5><ul>${detail.errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        }
        if (detail.warnings.length > 0) {
            detailsHtml += `<h5 style="color: var(--warning-color); margin: 10px 0 5px;">警告:</h5><ul>${detail.warnings.map(w => `<li>${w}</li>`).join('')}</ul>`;
        }

        UI.showModal(
            `核验结果 - ${p.name}`,
            `<p><strong>状态:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
             <p><strong>参赛号码:</strong> ${p.bib}</p>
             <p><strong>芯片号:</strong> ${p.chip}</p>
             <p><strong>分区:</strong> ${p.zone}</p>
             ${detailsHtml || '<p>所有核验项目通过</p>'}`,
            [
                {
                    text: '关闭',
                    class: 'btn-secondary',
                    onClick: () => {}
                },
                {
                    text: '编辑记录',
                    class: 'btn-primary',
                    onClick: () => {
                        setTimeout(() => this.editParticipant(index), 100);
                    }
                }
            ]
        );

        this.participants[index].verificationStatus = detail.status;
        this.participants[index].verificationErrors = detail.errors;
        this.participants[index].verificationWarnings = detail.warnings;
        this.saveAndRender();
    },

    render() {
        this.renderDashboard();
        this.renderDataTable();
        this.renderLogs();
    },

    renderDashboard() {
        const total = this.participants.length;
        const passed = this.participants.filter(p => p.verificationStatus === 'passed').length;
        const pending = this.participants.filter(p => p.verificationStatus === 'pending').length;
        const failed = this.participants.filter(p => p.verificationStatus === 'failed').length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-passed').textContent = passed;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-failed').textContent = failed;
    },

    renderDataTable() {
        const tbody = document.querySelector('#data-table tbody');

        if (this.participants.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="placeholder">暂无数据，请先导入或添加参赛记录</td></tr>';
            return;
        }

        tbody.innerHTML = this.participants.map((p, index) => `
            <tr>
                <td>${p.name || '-'}</td>
                <td>${p.bib || '-'}</td>
                <td>${p.chip || '-'}</td>
                <td>${p.zone || '-'}</td>
                <td>${UI.getStatusBadge(p.verificationStatus || 'untested')}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="App.verifySingleParticipant(${index})">核验</button>
                    <button class="btn btn-secondary btn-sm" onclick="App.editParticipant(${index})">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="App.deleteParticipant(${index})">删除</button>
                </td>
            </tr>
        `).join('');
    },

    renderLogs() {
        const logs = Storage.getLogs();
        const filter = document.getElementById('log-filter').value;
        const tbody = document.querySelector('#logs-table tbody');

        let filteredLogs = logs;
        if (filter !== 'all') {
            filteredLogs = logs.filter(log => log.type === filter);
        }

        if (filteredLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="placeholder">暂无操作日志</td></tr>';
            return;
        }

        tbody.innerHTML = filteredLogs.slice(0, 100).map(log => `
            <tr>
                <td>${UI.formatDate(log.timestamp)}</td>
                <td>${this.getLogTypeLabel(log.type)}</td>
                <td>${log.details}</td>
                <td>${UI.getStatusBadge(log.status)}</td>
            </tr>
        `).join('');

        if (filteredLogs.length > 100) {
            tbody.innerHTML += `<tr><td colspan="4" style="text-align: center; color: var(--text-light);">... 还有 ${filteredLogs.length - 100} 条日志未显示</td></tr>`;
        }
    },

    getLogTypeLabel(type) {
        const labels = {
            import: '数据导入',
            verify: '核验操作',
            modify: '数据修改',
            error: '错误记录',
            system: '系统操作'
        };
        return labels[type] || type;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
