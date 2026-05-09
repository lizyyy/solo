const StorageKeys = {
    DEVICES: 'interpreter_devices',
    BORROW_RECORDS: 'interpreter_borrow_records',
    CHECK_RECORDS: 'interpreter_check_records',
    PROBLEMS: 'interpreter_problems',
    AUDIT_LOG: 'interpreter_audit_log'
};

const CONFIG = {
    MIN_BATTERY_BORROW: 70,
    WARNING_BATTERY: 40,
    CRITICAL_BATTERY: 20,
    MAX_BORROW_DAYS: 7
};

const Utils = {
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('zh-CN');
    },

    parseChannelRange(rangeStr) {
        const match = rangeStr.match(/^(\d+)\s*-\s*(\d+)$/);
        if (match) {
            return {
                min: parseInt(match[1]),
                max: parseInt(match[2]),
                isValid: true
            };
        }
        return { min: null, max: null, isValid: false };
    },

    channelInRange(channel, rangeStr) {
        if (!channel || !rangeStr) return true;
        const range = this.parseChannelRange(rangeStr);
        if (!range.isValid) return true;
        return channel >= range.min && channel <= range.max;
    },

    parseAccessories(accessoryStr) {
        if (!accessoryStr) return [];
        return accessoryStr.split(/[,，、]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    },

    compareAccessories(standard, actual) {
        const stdList = this.parseAccessories(standard);
        const actualList = this.parseAccessories(actual);
        const missing = stdList.filter(s => !actualList.includes(s));
        const extra = actualList.filter(a => !stdList.includes(a));
        return {
            missing,
            extra,
            complete: missing.length === 0 && extra.length === 0
        };
    },

    validateDeviceId(id) {
        if (!id || id.trim().length === 0) {
            return { valid: false, reason: '设备编号不能为空' };
        }
        if (id.length > 50) {
            return { valid: false, reason: '设备编号不能超过50个字符' };
        }
        return { valid: true };
    },

    validateBatteryLevel(level) {
        const num = parseInt(level);
        if (isNaN(num)) {
            return { valid: false, reason: '电量必须是数字' };
        }
        if (num < 0 || num > 100) {
            return { valid: false, reason: '电量必须在0-100之间' };
        }
        return { valid: true };
    },

    validateChannel(channel, rangeStr) {
        if (!channel) return { valid: true };
        const num = parseInt(channel);
        if (isNaN(num)) {
            return { valid: false, reason: '频道必须是数字' };
        }
        if (rangeStr) {
            const range = this.parseChannelRange(rangeStr);
            if (range.isValid && (num < range.min || num > range.max)) {
                return { 
                    valid: false, 
                    reason: `频道超出设备范围 (${range.min}-${range.max})` 
                };
            }
        }
        return { valid: true };
    }
};

const Storage = {
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    getAll() {
        return {
            devices: this.get(StorageKeys.DEVICES, []),
            borrowRecords: this.get(StorageKeys.BORROW_RECORDS, []),
            checkRecords: this.get(StorageKeys.CHECK_RECORDS, []),
            problems: this.get(StorageKeys.PROBLEMS, []),
            auditLog: this.get(StorageKeys.AUDIT_LOG, [])
        };
    }
};

const Audit = {
    log(type, action, details, result) {
        const log = {
            id: Utils.generateId(),
            timestamp: Date.now(),
            type,
            action,
            details,
            result
        };
        
        const logs = Storage.get(StorageKeys.AUDIT_LOG, []);
        logs.unshift(log);
        Storage.set(StorageKeys.AUDIT_LOG, logs.slice(0, 1000));
        
        return log;
    },

    getRecent(count = 10) {
        const logs = Storage.get(StorageKeys.AUDIT_LOG, []);
        return logs.slice(0, count);
    },

    getAll() {
        return Storage.get(StorageKeys.AUDIT_LOG, []);
    }
};

const ProblemManager = {
    create(type, deviceId, description, source, rawData = null) {
        const problem = {
            id: Utils.generateId(),
            type,
            deviceId,
            description,
            source,
            rawData,
            status: 'open',
            createdAt: Date.now(),
            resolvedAt: null,
            resolution: null
        };
        
        const problems = Storage.get(StorageKeys.PROBLEMS, []);
        problems.unshift(problem);
        Storage.set(StorageKeys.PROBLEMS, problems);
        
        Audit.log('problem', 'create', 
            `设备 ${deviceId} 产生问题: ${description}`, 
            'success');
        
        return problem;
    },

    resolve(problemId, resolution) {
        const problems = Storage.get(StorageKeys.PROBLEMS, []);
        const index = problems.findIndex(p => p.id === problemId);
        if (index === -1) {
            return { success: false, reason: '问题记录不存在' };
        }
        
        problems[index].status = 'resolved';
        problems[index].resolvedAt = Date.now();
        problems[index].resolution = resolution;
        
        Storage.set(StorageKeys.PROBLEMS, problems);
        
        Audit.log('problem', 'resolve', 
            `问题 ${problemId} 已解决: ${resolution}`, 
            'success');
        
        return { success: true, problem: problems[index] };
    },

    getAll() {
        return Storage.get(StorageKeys.PROBLEMS, []);
    },

    getOpenCount() {
        const problems = Storage.get(StorageKeys.PROBLEMS, []);
        return problems.filter(p => p.status === 'open').length;
    }
};

const DeviceManager = {
    getAll() {
        return Storage.get(StorageKeys.DEVICES, []);
    },

    getById(id) {
        const devices = this.getAll();
        return devices.find(d => d.id === id);
    },

    getByDeviceId(deviceId) {
        const devices = this.getAll();
        return devices.find(d => d.deviceId === deviceId);
    },

    create(input) {
        const validation = Utils.validateDeviceId(input.deviceId);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }
        
        const existing = this.getByDeviceId(input.deviceId.trim());
        if (existing) {
            return { success: false, reason: `设备编号 ${input.deviceId} 已存在` };
        }
        
        const channelRange = Utils.parseChannelRange(input.channelRange);
        if (!channelRange.isValid) {
            return { success: false, reason: '频道范围格式错误，应为"数字-数字"格式，如"1-16"' };
        }
        
        const batteryValidation = Utils.validateBatteryLevel(input.initialBattery || 100);
        if (!batteryValidation.valid) {
            return { success: false, reason: batteryValidation.reason };
        }
        
        const device = {
            id: Utils.generateId(),
            deviceId: input.deviceId.trim(),
            name: input.name.trim(),
            channelRange: input.channelRange.trim(),
            channelMin: channelRange.min,
            channelMax: channelRange.max,
            standardAccessories: input.accessories ? input.accessories.trim() : '',
            currentBattery: parseInt(input.initialBattery || 100),
            currentChannel: null,
            status: 'available',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            notes: input.notes ? input.notes.trim() : '',
            lastCheckAt: null,
            lastCheckBattery: null
        };
        
        const devices = this.getAll();
        devices.push(device);
        Storage.set(StorageKeys.DEVICES, devices);
        
        Audit.log('device', 'create', 
            `新增设备: ${device.deviceId} - ${device.name}`, 
            'success');
        
        return { success: true, device };
    },

    update(id, updates) {
        const devices = this.getAll();
        const index = devices.findIndex(d => d.id === id);
        if (index === -1) {
            return { success: false, reason: '设备不存在' };
        }
        
        const oldDevice = { ...devices[index] };
        
        if (updates.deviceId && updates.deviceId !== oldDevice.deviceId) {
            const existing = this.getByDeviceId(updates.deviceId.trim());
            if (existing) {
                return { success: false, reason: `设备编号 ${updates.deviceId} 已存在` };
            }
            devices[index].deviceId = updates.deviceId.trim();
        }
        
        if (updates.name) {
            devices[index].name = updates.name.trim();
        }
        
        if (updates.channelRange) {
            const channelRange = Utils.parseChannelRange(updates.channelRange);
            if (!channelRange.isValid) {
                return { success: false, reason: '频道范围格式错误' };
            }
            devices[index].channelRange = updates.channelRange.trim();
            devices[index].channelMin = channelRange.min;
            devices[index].channelMax = channelRange.max;
        }
        
        if (updates.accessories !== undefined) {
            devices[index].standardAccessories = updates.accessories ? updates.accessories.trim() : '';
        }
        
        if (updates.notes !== undefined) {
            devices[index].notes = updates.notes ? updates.notes.trim() : '';
        }
        
        if (updates.status) {
            devices[index].status = updates.status;
        }
        
        if (updates.currentBattery !== undefined) {
            devices[index].currentBattery = parseInt(updates.currentBattery);
        }
        
        if (updates.currentChannel !== undefined) {
            devices[index].currentChannel = updates.currentChannel ? parseInt(updates.currentChannel) : null;
        }
        
        devices[index].updatedAt = Date.now();
        
        Storage.set(StorageKeys.DEVICES, devices);
        
        Audit.log('device', 'update', 
            `更新设备 ${oldDevice.deviceId}`, 
            'success');
        
        return { success: true, device: devices[index] };
    },

    delete(id) {
        const devices = this.getAll();
        const device = devices.find(d => d.id === id);
        if (!device) {
            return { success: false, reason: '设备不存在' };
        }
        
        if (device.status === 'borrowed') {
            return { success: false, reason: '借出中的设备不能删除' };
        }
        
        const filtered = devices.filter(d => d.id !== id);
        Storage.set(StorageKeys.DEVICES, filtered);
        
        Audit.log('device', 'delete', 
            `删除设备: ${device.deviceId} - ${device.name}`, 
            'success');
        
        return { success: true };
    },

    updateBattery(id, battery) {
        const validation = Utils.validateBatteryLevel(battery);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }
        
        return this.update(id, { currentBattery: battery });
    },

    getAvailable() {
        return this.getAll().filter(d => d.status === 'available');
    },

    getBorrowed() {
        return this.getAll().filter(d => d.status === 'borrowed');
    }
};

const BorrowManager = {
    getAll() {
        return Storage.get(StorageKeys.BORROW_RECORDS, []);
    },

    getActiveBorrow(deviceId) {
        const records = this.getAll();
        return records.find(r => r.deviceId === deviceId && r.status === 'active');
    },

    borrow(input) {
        const device = DeviceManager.getByDeviceId(input.deviceId);
        if (!device) {
            return { success: false, reason: '设备不存在' };
        }
        
        if (device.status !== 'available') {
            return { success: false, reason: `设备当前状态为 ${device.status}，无法借出` };
        }
        
        if (!input.borrowerName || input.borrowerName.trim().length === 0) {
            return { success: false, reason: '借用人不能为空' };
        }
        
        if (!input.channel) {
            return { success: false, reason: '借出频道不能为空' };
        }
        
        const channelValidation = Utils.validateChannel(input.channel, device.channelRange);
        if (!channelValidation.valid) {
            return { success: false, reason: channelValidation.reason };
        }
        
        const battery = parseInt(input.battery) || device.currentBattery;
        const batteryValidation = Utils.validateBatteryLevel(battery);
        if (!batteryValidation.valid) {
            return { success: false, reason: batteryValidation.reason };
        }
        
        if (battery < CONFIG.MIN_BATTERY_BORROW) {
            ProblemManager.create(
                'battery',
                device.deviceId,
                `借出时电量过低: ${battery}%，低于建议值 ${CONFIG.MIN_BATTERY_BORROW}%`,
                'borrow',
                { battery, minRequired: CONFIG.MIN_BATTERY_BORROW }
            );
        }
        
        const accessoryCheck = Utils.compareAccessories(
            device.standardAccessories,
            input.accessories
        );
        
        if (accessoryCheck.missing.length > 0) {
            ProblemManager.create(
                'accessory',
                device.deviceId,
                `借出时缺少配件: ${accessoryCheck.missing.join(', ')}`,
                'borrow',
                { standard: device.standardAccessories, actual: input.accessories }
            );
        }
        
        const record = {
            id: Utils.generateId(),
            deviceId: device.deviceId,
            deviceName: device.name,
            borrowerName: input.borrowerName.trim(),
            channel: parseInt(input.channel),
            meetingSession: input.meetingSession ? input.meetingSession.trim() : '',
            borrowBattery: battery,
            borrowAccessories: input.accessories ? input.accessories.trim() : '',
            borrowTime: Date.now(),
            returnTime: null,
            returnerName: null,
            returnBattery: null,
            returnChannel: null,
            returnAccessories: null,
            status: 'active',
            notes: input.notes ? input.notes.trim() : ''
        };
        
        const records = this.getAll();
        records.push(record);
        Storage.set(StorageKeys.BORROW_RECORDS, records);
        
        DeviceManager.update(device.id, {
            status: 'borrowed',
            currentChannel: parseInt(input.channel),
            currentBattery: battery
        });
        
        Audit.log('borrow', 'borrow', 
            `借出设备: ${device.deviceId} 给 ${record.borrowerName}`, 
            'success');
        
        return { 
            success: true, 
            record,
            warnings: {
                lowBattery: battery < CONFIG.MIN_BATTERY_BORROW,
                missingAccessories: accessoryCheck.missing
            }
        };
    },

    return(input) {
        const device = DeviceManager.getByDeviceId(input.deviceId);
        if (!device) {
            return { success: false, reason: '设备不存在' };
        }
        
        const activeRecord = this.getActiveBorrow(device.deviceId);
        if (!activeRecord) {
            return { success: false, reason: '该设备没有借出记录' };
        }
        
        if (!input.battery && input.battery !== 0) {
            return { success: false, reason: '归还电量不能为空' };
        }
        
        const batteryValidation = Utils.validateBatteryLevel(input.battery);
        if (!batteryValidation.valid) {
            return { success: false, reason: batteryValidation.reason };
        }
        
        const battery = parseInt(input.battery);
        if (battery < CONFIG.WARNING_BATTERY) {
            ProblemManager.create(
                'battery',
                device.deviceId,
                `归还时电量过低: ${battery}%`,
                'return',
                { battery, warningLevel: CONFIG.WARNING_BATTERY }
            );
        }
        
        if (input.channel) {
            const channelValidation = Utils.validateChannel(input.channel, device.channelRange);
            if (!channelValidation.valid) {
                ProblemManager.create(
                    'channel',
                    device.deviceId,
                    `归还时频道异常: ${channelValidation.reason}`,
                    'return',
                    { channel: input.channel, range: device.channelRange }
                );
            }
        }
        
        const accessoryCheck = Utils.compareAccessories(
            device.standardAccessories,
            input.accessories
        );
        
        if (accessoryCheck.missing.length > 0) {
            ProblemManager.create(
                'accessory',
                device.deviceId,
                `归还时缺少配件: ${accessoryCheck.missing.join(', ')}`,
                'return',
                { standard: device.standardAccessories, actual: input.accessories }
            );
        }
        
        const records = this.getAll();
        const index = records.findIndex(r => r.id === activeRecord.id);
        
        records[index].status = 'returned';
        records[index].returnTime = Date.now();
        records[index].returnerName = input.returnerName ? input.returnerName.trim() : null;
        records[index].returnBattery = battery;
        records[index].returnChannel = input.channel ? parseInt(input.channel) : null;
        records[index].returnAccessories = input.accessories ? input.accessories.trim() : null;
        
        Storage.set(StorageKeys.BORROW_RECORDS, records);
        
        DeviceManager.update(device.id, {
            status: 'available',
            currentBattery: battery,
            currentChannel: input.channel ? parseInt(input.channel) : null
        });
        
        Audit.log('borrow', 'return', 
            `归还设备: ${device.deviceId}`, 
            'success');
        
        return { 
            success: true, 
            record: records[index],
            warnings: {
                lowBattery: battery < CONFIG.WARNING_BATTERY,
                missingAccessories: accessoryCheck.missing
            }
        };
    }
};

const CheckManager = {
    getAll() {
        return Storage.get(StorageKeys.CHECK_RECORDS, []);
    },

    check(input) {
        const device = DeviceManager.getByDeviceId(input.deviceId);
        if (!device) {
            return { 
                success: false, 
                reason: '设备不存在',
                createProblem: true 
            };
        }
        
        if (!input.battery && input.battery !== 0) {
            return { success: false, reason: '电量不能为空' };
        }
        
        const batteryValidation = Utils.validateBatteryLevel(input.battery);
        if (!batteryValidation.valid) {
            return { success: false, reason: batteryValidation.reason };
        }
        
        const battery = parseInt(input.battery);
        const issues = [];
        let result = 'pass';
        
        if (battery < CONFIG.CRITICAL_BATTERY) {
            issues.push({ type: 'battery', message: `电量严重不足: ${battery}%`, level: 'critical' });
            result = 'fail';
            ProblemManager.create(
                'battery',
                device.deviceId,
                `检查发现电量严重不足: ${battery}%`,
                'check',
                { battery, criticalLevel: CONFIG.CRITICAL_BATTERY }
            );
        } else if (battery < CONFIG.WARNING_BATTERY) {
            issues.push({ type: 'battery', message: `电量偏低: ${battery}%`, level: 'warning' });
            result = 'warning';
            ProblemManager.create(
                'battery',
                device.deviceId,
                `检查发现电量偏低: ${battery}%`,
                'check',
                { battery, warningLevel: CONFIG.WARNING_BATTERY }
            );
        }
        
        if (input.channel) {
            const channelValidation = Utils.validateChannel(input.channel, device.channelRange);
            if (!channelValidation.valid) {
                issues.push({ type: 'channel', message: channelValidation.reason, level: 'warning' });
                if (result === 'pass') result = 'warning';
                ProblemManager.create(
                    'channel',
                    device.deviceId,
                    `检查发现频道异常: ${channelValidation.reason}`,
                    'check',
                    { channel: input.channel, range: device.channelRange }
                );
            }
        }
        
        if (input.accessories) {
            const accessoryCheck = Utils.compareAccessories(
                device.standardAccessories,
                input.accessories
            );
            
            if (accessoryCheck.missing.length > 0) {
                const msg = `缺少配件: ${accessoryCheck.missing.join(', ')}`;
                issues.push({ type: 'accessory', message: msg, level: 'warning' });
                if (result === 'pass') result = 'warning';
                ProblemManager.create(
                    'accessory',
                    device.deviceId,
                    `检查发现${msg}`,
                    'check',
                    { standard: device.standardAccessories, actual: input.accessories }
                );
            }
        }
        
        const record = {
            id: Utils.generateId(),
            deviceId: device.deviceId,
            deviceName: device.name,
            battery,
            channel: input.channel ? parseInt(input.channel) : null,
            accessories: input.accessories ? input.accessories.trim() : '',
            result,
            issues,
            checkedAt: Date.now(),
            notes: input.notes ? input.notes.trim() : ''
        };
        
        const records = this.getAll();
        records.push(record);
        Storage.set(StorageKeys.CHECK_RECORDS, records);
        
        DeviceManager.update(device.id, {
            currentBattery: battery,
            currentChannel: input.channel ? parseInt(input.channel) : device.currentChannel,
            lastCheckAt: Date.now(),
            lastCheckBattery: battery
        });
        
        Audit.log('check', 'check', 
            `检查设备: ${device.deviceId}, 结果: ${result}`, 
            'success');
        
        return { 
            success: true, 
            record,
            result,
            issues
        };
    },

    batchCheck(inputText) {
        const lines = inputText.trim().split('\n').filter(l => l.trim());
        const results = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',').map(p => p.trim());
            
            if (parts.length < 2) {
                ProblemManager.create(
                    'data',
                    `行${i + 1}`,
                    `批量检查数据格式错误: ${line}`,
                    'batch_check',
                    { rawLine: line }
                );
                results.push({
                    success: false,
                    line: i + 1,
                    rawData: line,
                    reason: '格式错误，至少需要设备编号和电量'
                });
                continue;
            }
            
            const [deviceId, battery, channel, ...accessoryParts] = parts;
            const accessories = accessoryParts.join(',');
            
            const checkResult = this.check({
                deviceId,
                battery,
                channel: channel || null,
                accessories: accessories || null
            });
            
            results.push({
                line: i + 1,
                deviceId,
                ...checkResult
            });
        }
        
        return results;
    }
};

const UI = {
    showFeedback(element, type, message, details = null) {
        element.className = `feedback show ${type}`;
        element.innerHTML = details 
            ? `<strong>${message}</strong><div class="feedback-details">${details}</div>`
            : message;
        
        setTimeout(() => {
            element.classList.remove('show');
        }, 8000);
    },

    showToast(type, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    renderStats() {
        const devices = DeviceManager.getAll();
        const available = devices.filter(d => d.status === 'available');
        const borrowed = devices.filter(d => d.status === 'borrowed');
        const openProblems = ProblemManager.getOpenCount();
        
        document.getElementById('stat-total').textContent = devices.length;
        document.getElementById('stat-available').textContent = available.length;
        document.getElementById('stat-borrowed').textContent = borrowed.length;
        document.getElementById('stat-problems').textContent = openProblems;
    },

    renderRecentActivity() {
        const logs = Audit.getRecent(10);
        const container = document.getElementById('recent-activity-list');
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无操作记录</p></div>';
            return;
        }
        
        const typeLabels = {
            device: '设备',
            borrow: '借还',
            check: '检查',
            problem: '问题'
        };
        
        const actionLabels = {
            create: '新增',
            update: '更新',
            delete: '删除',
            borrow: '借出',
            return: '归还',
            check: '检查',
            resolve: '解决'
        };
        
        container.innerHTML = logs.map(log => `
            <div class="activity-item">
                <span>[${typeLabels[log.type] || log.type}] ${actionLabels[log.action] || log.action}: ${log.details}</span>
                <span class="activity-time">${Utils.formatDateTime(log.timestamp)}</span>
            </div>
        `).join('');
    },

    renderDeviceList() {
        const devices = DeviceManager.getAll();
        const search = document.getElementById('deviceSearch').value.toLowerCase();
        const statusFilter = document.getElementById('deviceStatusFilter').value;
        
        const filtered = devices.filter(d => {
            const matchSearch = d.deviceId.toLowerCase().includes(search) ||
                               d.name.toLowerCase().includes(search);
            const matchStatus = statusFilter === 'all' || d.status === statusFilter;
            return matchSearch && matchStatus;
        });
        
        const container = document.getElementById('deviceList');
        
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无设备</p></div>';
            return;
        }
        
        const statusLabels = {
            available: '可用',
            borrowed: '借出中',
            maintenance: '维护中'
        };
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>设备编号</th>
                        <th>设备名称</th>
                        <th>频道范围</th>
                        <th>当前电量</th>
                        <th>状态</th>
                        <th>最后检查</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(d => `
                        <tr class="${d.currentBattery < CONFIG.WARNING_BATTERY ? 'warning-row' : ''}">
                            <td><strong>${d.deviceId}</strong></td>
                            <td>${d.name}</td>
                            <td>${d.channelRange}</td>
                            <td>
                                <span class="status-badge ${d.currentBattery < CONFIG.CRITICAL_BATTERY ? 'result-fail' : d.currentBattery < CONFIG.WARNING_BATTERY ? 'result-warning' : 'result-pass'}">
                                    ${d.currentBattery}%
                                </span>
                            </td>
                            <td><span class="status-badge status-${d.status}">${statusLabels[d.status]}</span></td>
                            <td>${d.lastCheckAt ? Utils.formatDateTime(d.lastCheckAt) : '未检查'}</td>
                            <td>
                                <button class="btn-secondary" onclick="app.editDevice('${d.id}')">编辑</button>
                                <button class="btn-danger" onclick="app.deleteDevice('${d.id}')">删除</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderBorrowSelects() {
        const available = DeviceManager.getAvailable();
        const borrowed = DeviceManager.getBorrowed();
        
        const borrowSelect = document.getElementById('borrowDeviceId');
        borrowSelect.innerHTML = '<option value="">请选择可用设备</option>' +
            available.map(d => `<option value="${d.deviceId}">${d.deviceId} - ${d.name}</option>`).join('');
        
        const returnSelect = document.getElementById('returnDeviceId');
        returnSelect.innerHTML = '<option value="">请选择借出设备</option>' +
            borrowed.map(d => `<option value="${d.deviceId}">${d.deviceId} - ${d.name}</option>`).join('');
        
        const checkSelect = document.getElementById('checkDeviceId');
        const allDevices = DeviceManager.getAll();
        checkSelect.innerHTML = '<option value="">请选择设备</option>' +
            allDevices.map(d => `<option value="${d.deviceId}">${d.deviceId} - ${d.name}</option>`).join('');
    },

    renderBorrowHistory() {
        const records = BorrowManager.getAll().slice().reverse();
        const container = document.getElementById('borrowHistory');
        
        if (records.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无借还记录</p></div>';
            return;
        }
        
        const statusLabels = {
            active: '借出中',
            returned: '已归还'
        };
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>设备编号</th>
                        <th>借用人</th>
                        <th>借出频道</th>
                        <th>借出电量</th>
                        <th>借出时间</th>
                        <th>归还时间</th>
                        <th>归还电量</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(r => `
                        <tr class="${r.status === 'active' ? 'warning-row' : ''}">
                            <td>${r.deviceId}</td>
                            <td>${r.borrowerName}</td>
                            <td>频道 ${r.channel}</td>
                            <td>${r.borrowBattery}%</td>
                            <td>${Utils.formatDateTime(r.borrowTime)}</td>
                            <td>${r.returnTime ? Utils.formatDateTime(r.returnTime) : '-'}</td>
                            <td>${r.returnBattery !== null ? r.returnBattery + '%' : '-'}</td>
                            <td><span class="status-badge status-${r.status}">${statusLabels[r.status]}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderCheckHistory() {
        const records = CheckManager.getAll().slice().reverse();
        const filter = document.getElementById('checkResultFilter').value;
        
        const filtered = filter === 'all' 
            ? records 
            : records.filter(r => r.result === filter);
        
        const container = document.getElementById('checkHistory');
        
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无检查记录</p></div>';
            return;
        }
        
        const resultLabels = {
            pass: '通过',
            warning: '警告',
            fail: '不通过'
        };
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>设备编号</th>
                        <th>检查电量</th>
                        <th>检查频道</th>
                        <th>配件</th>
                        <th>结果</th>
                        <th>问题</th>
                        <th>检查时间</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(r => `
                        <tr class="${r.result === 'fail' ? 'error-row' : r.result === 'warning' ? 'warning-row' : ''}">
                            <td>${r.deviceId}</td>
                            <td><span class="status-badge result-${r.result}">${r.battery}%</span></td>
                            <td>${r.channel || '-'}</td>
                            <td>${r.accessories || '-'}</td>
                            <td><span class="status-badge result-${r.result}">${resultLabels[r.result]}</span></td>
                            <td>${r.issues.length > 0 ? r.issues.map(i => i.message).join('; ') : '无'}</td>
                            <td>${Utils.formatDateTime(r.checkedAt)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderProblemList() {
        const problems = ProblemManager.getAll();
        const typeFilter = document.getElementById('problemTypeFilter').value;
        const statusFilter = document.getElementById('problemStatusFilter').value;
        
        const filtered = problems.filter(p => {
            const matchType = typeFilter === 'all' || p.type === typeFilter;
            const matchStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchType && matchStatus;
        });
        
        const container = document.getElementById('problemList');
        
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无问题记录</p></div>';
            return;
        }
        
        const typeLabels = {
            battery: '电量问题',
            channel: '频道问题',
            accessory: '配件问题',
            data: '数据异常'
        };
        
        const sourceLabels = {
            borrow: '借出检查',
            return: '归还检查',
            check: '电量检查',
            batch_check: '批量检查'
        };
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>设备</th>
                        <th>类型</th>
                        <th>问题描述</th>
                        <th>来源</th>
                        <th>创建时间</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(p => `
                        <tr class="${p.status === 'open' ? 'error-row' : ''}">
                            <td>${p.deviceId}</td>
                            <td><span class="status-badge problem-${p.type}">${typeLabels[p.type] || p.type}</span></td>
                            <td>${p.description}</td>
                            <td>${sourceLabels[p.source] || p.source}</td>
                            <td>${Utils.formatDateTime(p.createdAt)}</td>
                            <td><span class="status-badge status-${p.status}">${p.status === 'open' ? '待处理' : '已解决'}</span></td>
                            <td>
                                ${p.status === 'open' 
                                    ? `<button class="btn-success" onclick="app.resolveProblem('${p.id}')">标记解决</button>`
                                    : '<span class="activity-time">-</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderAuditLog() {
        const logs = Audit.getAll();
        const typeFilter = document.getElementById('auditTypeFilter').value;
        
        const filtered = typeFilter === 'all' 
            ? logs 
            : logs.filter(l => l.type === typeFilter);
        
        const container = document.getElementById('auditLog');
        
        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无操作记录</p></div>';
            return;
        }
        
        const typeLabels = {
            device: '设备',
            borrow: '借还',
            check: '检查',
            problem: '问题'
        };
        
        const actionLabels = {
            create: '新增',
            update: '更新',
            delete: '删除',
            borrow: '借出',
            return: '归还',
            check: '检查',
            resolve: '解决'
        };
        
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>时间</th>
                        <th>类型</th>
                        <th>操作</th>
                        <th>详情</th>
                        <th>结果</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(log => `
                        <tr>
                            <td>${Utils.formatDateTime(log.timestamp)}</td>
                            <td><span class="status-badge">${typeLabels[log.type] || log.type}</span></td>
                            <td>${actionLabels[log.action] || log.action}</td>
                            <td>${log.details}</td>
                            <td><span class="status-badge result-${log.result}">${log.result}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    updateCurrentTime() {
        const now = new Date();
        document.getElementById('currentTime').textContent = now.toLocaleString('zh-CN');
    }
};

const App = {
    init() {
        this.bindEvents();
        this.refreshAll();
        setInterval(() => UI.updateCurrentTime(), 1000);
        UI.updateCurrentTime();
    },

    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        document.querySelectorAll('.tab-sub-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchSubTab(btn.dataset.subtab));
        });
        
        document.getElementById('deviceForm').addEventListener('submit', (e) => this.handleDeviceForm(e));
        document.getElementById('borrowOutForm').addEventListener('submit', (e) => this.handleBorrowOut(e));
        document.getElementById('borrowInForm').addEventListener('submit', (e) => this.handleBorrowIn(e));
        document.getElementById('singleCheckForm').addEventListener('submit', (e) => this.handleSingleCheck(e));
        
        document.getElementById('deviceSearch').addEventListener('input', () => UI.renderDeviceList());
        document.getElementById('deviceStatusFilter').addEventListener('change', () => UI.renderDeviceList());
        document.getElementById('checkResultFilter').addEventListener('change', () => UI.renderCheckHistory());
        document.getElementById('problemTypeFilter').addEventListener('change', () => UI.renderProblemList());
        document.getElementById('problemStatusFilter').addEventListener('change', () => UI.renderProblemList());
        document.getElementById('auditTypeFilter').addEventListener('change', () => UI.renderAuditLog());
        
        document.getElementById('checkMode').addEventListener('change', (e) => {
            document.getElementById('singleCheckPanel').style.display = e.target.value === 'single' ? 'block' : 'none';
            document.getElementById('batchCheckPanel').style.display = e.target.value === 'batch' ? 'block' : 'none';
        });
        
        document.getElementById('batchCheckBtn').addEventListener('click', () => this.handleBatchCheck());
    },

    switchTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        document.querySelector(`.nav-btn[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
        this.refreshByTab(tabName);
    },

    switchSubTab(subtabName) {
        document.querySelectorAll('.tab-sub-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
        
        document.querySelector(`.tab-sub-btn[data-subtab="${subtabName}"]`).classList.add('active');
        document.getElementById(subtabName).classList.add('active');
    },

    refreshAll() {
        UI.renderStats();
        UI.renderRecentActivity();
        UI.renderDeviceList();
        UI.renderBorrowSelects();
        UI.renderBorrowHistory();
        UI.renderCheckHistory();
        UI.renderProblemList();
        UI.renderAuditLog();
    },

    refreshByTab(tabName) {
        switch (tabName) {
            case 'dashboard':
                UI.renderStats();
                UI.renderRecentActivity();
                break;
            case 'devices':
                UI.renderDeviceList();
                break;
            case 'borrow':
                UI.renderBorrowSelects();
                UI.renderBorrowHistory();
                break;
            case 'check':
                UI.renderBorrowSelects();
                UI.renderCheckHistory();
                break;
            case 'problems':
                UI.renderProblemList();
                break;
            case 'audit':
                UI.renderAuditLog();
                break;
        }
    },

    handleDeviceForm(e) {
        e.preventDefault();
        
        const input = {
            deviceId: document.getElementById('deviceId').value,
            name: document.getElementById('deviceName').value,
            channelRange: document.getElementById('channelRange').value,
            accessories: document.getElementById('accessories').value,
            initialBattery: document.getElementById('initialBattery').value,
            notes: document.getElementById('deviceNotes').value
        };
        
        const result = DeviceManager.create(input);
        const feedback = document.getElementById('deviceFormFeedback');
        
        if (result.success) {
            UI.showFeedback(feedback, 'success', `设备 ${result.device.deviceId} 创建成功！`);
            UI.showToast('success', '设备创建成功');
            e.target.reset();
            document.getElementById('initialBattery').value = 100;
            this.refreshAll();
        } else {
            UI.showFeedback(feedback, 'error', '创建设备失败', result.reason);
            UI.showToast('error', result.reason);
        }
    },

    handleBorrowOut(e) {
        e.preventDefault();
        
        const input = {
            deviceId: document.getElementById('borrowDeviceId').value,
            borrowerName: document.getElementById('borrowerName').value,
            channel: document.getElementById('borrowChannel').value,
            meetingSession: document.getElementById('meetingSession').value,
            battery: document.getElementById('borrowBattery').value,
            accessories: document.getElementById('borrowAccessories').value,
            notes: document.getElementById('borrowNotes').value
        };
        
        const result = BorrowManager.borrow(input);
        const feedback = document.getElementById('borrowOutFeedback');
        
        if (result.success) {
            let warningText = '';
            if (result.warnings.lowBattery) {
                warningText += `⚠️ 电量低于建议值 (${CONFIG.MIN_BATTERY_BORROW}%)，已记录问题。`;
            }
            if (result.warnings.missingAccessories.length > 0) {
                warningText += ` ⚠️ 缺少配件: ${result.warnings.missingAccessories.join(', ')}，已记录问题。`;
            }
            
            if (warningText) {
                UI.showFeedback(feedback, 'warning', '借出登记成功，但有警告', warningText);
                UI.showToast('warning', '借出成功，存在警告');
            } else {
                UI.showFeedback(feedback, 'success', '借出登记成功！');
                UI.showToast('success', '借出登记成功');
            }
            
            e.target.reset();
            document.getElementById('borrowBattery').value = 80;
            this.refreshAll();
        } else {
            UI.showFeedback(feedback, 'error', '借出登记失败', result.reason);
            UI.showToast('error', result.reason);
        }
    },

    handleBorrowIn(e) {
        e.preventDefault();
        
        const input = {
            deviceId: document.getElementById('returnDeviceId').value,
            returnerName: document.getElementById('returnerName').value,
            battery: document.getElementById('returnBattery').value,
            channel: document.getElementById('returnChannel').value,
            accessories: document.getElementById('returnAccessories').value,
            notes: document.getElementById('returnNotes').value
        };
        
        const result = BorrowManager.return(input);
        const feedback = document.getElementById('borrowInFeedback');
        
        if (result.success) {
            let warningText = '';
            if (result.warnings.lowBattery) {
                warningText += `⚠️ 电量过低 (${input.battery}%)，已记录问题。`;
            }
            if (result.warnings.missingAccessories.length > 0) {
                warningText += ` ⚠️ 缺少配件: ${result.warnings.missingAccessories.join(', ')}，已记录问题。`;
            }
            
            if (warningText) {
                UI.showFeedback(feedback, 'warning', '归还登记成功，但有警告', warningText);
                UI.showToast('warning', '归还成功，存在警告');
            } else {
                UI.showFeedback(feedback, 'success', '归还登记成功！');
                UI.showToast('success', '归还登记成功');
            }
            
            e.target.reset();
            this.refreshAll();
        } else {
            UI.showFeedback(feedback, 'error', '归还登记失败', result.reason);
            UI.showToast('error', result.reason);
        }
    },

    handleSingleCheck(e) {
        e.preventDefault();
        
        const input = {
            deviceId: document.getElementById('checkDeviceId').value,
            battery: document.getElementById('checkBattery').value,
            channel: document.getElementById('checkChannel').value,
            accessories: document.getElementById('checkAccessories').value,
            notes: document.getElementById('checkNotes').value
        };
        
        const result = CheckManager.check(input);
        const feedback = document.getElementById('singleCheckFeedback');
        
        if (result.success) {
            const resultLabels = { pass: '通过', warning: '警告', fail: '不通过' };
            const resultColors = { pass: 'success', warning: 'warning', fail: 'error' };
            
            let issueText = '';
            if (result.issues.length > 0) {
                issueText = result.issues.map(i => `• ${i.message}`).join('<br>');
            }
            
            UI.showFeedback(
                feedback, 
                resultColors[result.result], 
                `检查完成，结果: ${resultLabels[result.result]}`,
                issueText
            );
            
            UI.showToast(resultColors[result.result], `检查结果: ${resultLabels[result.result]}`);
            
            e.target.reset();
            this.refreshAll();
        } else {
            UI.showFeedback(feedback, 'error', '检查失败', result.reason);
            UI.showToast('error', result.reason);
        }
    },

    handleBatchCheck() {
        const inputText = document.getElementById('batchInput').value;
        if (!inputText.trim()) {
            UI.showToast('error', '请输入批量检查数据');
            return;
        }
        
        const results = CheckManager.batchCheck(inputText);
        const feedback = document.getElementById('batchCheckFeedback');
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        const summary = `批量检查完成: ${successCount} 条成功, ${failCount} 条失败`;
        
        const details = results.map(r => {
            if (r.success) {
                const resultLabels = { pass: '通过', warning: '警告', fail: '不通过' };
                return `行${r.line} (${r.deviceId}): ${resultLabels[r.result]}${r.issues.length > 0 ? ' - ' + r.issues.map(i => i.message).join('; ') : ''}`;
            } else {
                return `行${r.line}: 失败 - ${r.reason}`;
            }
        }).join('<br>');
        
        UI.showFeedback(feedback, failCount > 0 ? 'warning' : 'success', summary, details);
        UI.showToast(failCount > 0 ? 'warning' : 'success', summary);
        
        document.getElementById('batchInput').value = '';
        this.refreshAll();
    },

    editDevice(id) {
        const device = DeviceManager.getById(id);
        if (!device) return;
        
        document.getElementById('deviceId').value = device.deviceId;
        document.getElementById('deviceName').value = device.name;
        document.getElementById('channelRange').value = device.channelRange;
        document.getElementById('accessories').value = device.standardAccessories;
        document.getElementById('initialBattery').value = device.currentBattery;
        document.getElementById('deviceNotes').value = device.notes;
        
        this.switchTab('devices');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        UI.showToast('info', '请修改后点击保存（注意：将创建新设备，如需更新请联系管理员）');
    },

    deleteDevice(id) {
        if (!confirm('确定要删除此设备吗？')) return;
        
        const result = DeviceManager.delete(id);
        if (result.success) {
            UI.showToast('success', '设备已删除');
            this.refreshAll();
        } else {
            UI.showToast('error', result.reason);
        }
    },

    resolveProblem(id) {
        const resolution = prompt('请输入解决说明:');
        if (resolution === null) return;
        
        const result = ProblemManager.resolve(id, resolution || '已处理');
        if (result.success) {
            UI.showToast('success', '问题已标记为解决');
            this.refreshAll();
        } else {
            UI.showToast('error', result.reason);
        }
    }
};

const app = App;
document.addEventListener('DOMContentLoaded', () => app.init());
