// 全局状态管理
const AppState = {
    bookingData: [],
    equipmentData: [],
    complaintData: [],
    weatherData: [],
    rules: {},
    overrides: {},
    notes: {},
    preCheckResults: [],
    currentFilter: 'all'
};

// 存储键名
const STORAGE_KEYS = {
    BOOKING_DATA: 'camp_booking_data',
    EQUIPMENT_DATA: 'camp_equipment_data',
    COMPLAINT_DATA: 'camp_complaint_data',
    WEATHER_DATA: 'camp_weather_data',
    RULES: 'camp_rules',
    OVERRIDES: 'camp_overrides',
    NOTES: 'camp_notes'
};

// 默认规则配置
const DEFAULT_RULES = {
    ruleOverbooking: true,
    maxCapacity: 4,
    ruleUnresolvedComplaint: true,
    complaintThreshold: 2,
    ruleHighWind: true,
    windThreshold: 5,
    ruleDryWeather: true,
    humidityThreshold: 30,
    ruleWeatherWarning: true,
    ruleMissingEquipment: true,
    ruleOverdueEquipment: true
};

// 状态枚举
const STATUS_TYPES = {
    NORMAL: 'normal',
    WARNING: 'warning',
    RESTRICTED: 'restricted',
    FIRE_BAN: 'fire-ban'
};

const STATUS_LABELS = {
    normal: '正常入住',
    warning: '需要注意',
    restricted: '限制入住',
    'fire-ban': '禁火'
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadFromStorage();
    loadRuleConfig();
    initToastContainer();
});

// 初始化标签页切换
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName) {
            content.classList.add('active');
        }
    });
}

// ==================== 本地存储相关 ====================
function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.BOOKING_DATA, JSON.stringify(AppState.bookingData));
        localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DATA, JSON.stringify(AppState.equipmentData));
        localStorage.setItem(STORAGE_KEYS.COMPLAINT_DATA, JSON.stringify(AppState.complaintData));
        localStorage.setItem(STORAGE_KEYS.WEATHER_DATA, JSON.stringify(AppState.weatherData));
        localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(AppState.rules));
        localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(AppState.overrides));
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(AppState.notes));
        showToast('数据已保存', 'success');
    } catch (e) {
        showToast('保存失败: ' + e.message, 'error');
    }
}

function loadFromStorage() {
    try {
        const bookingData = localStorage.getItem(STORAGE_KEYS.BOOKING_DATA);
        const equipmentData = localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DATA);
        const complaintData = localStorage.getItem(STORAGE_KEYS.COMPLAINT_DATA);
        const weatherData = localStorage.getItem(STORAGE_KEYS.WEATHER_DATA);
        const rules = localStorage.getItem(STORAGE_KEYS.RULES);
        const overrides = localStorage.getItem(STORAGE_KEYS.OVERRIDES);
        const notes = localStorage.getItem(STORAGE_KEYS.NOTES);

        if (bookingData) AppState.bookingData = JSON.parse(bookingData);
        if (equipmentData) AppState.equipmentData = JSON.parse(equipmentData);
        if (complaintData) AppState.complaintData = JSON.parse(complaintData);
        if (weatherData) AppState.weatherData = JSON.parse(weatherData);
        if (rules) AppState.rules = JSON.parse(rules);
        if (overrides) AppState.overrides = JSON.parse(overrides);
        if (notes) AppState.notes = JSON.parse(notes);

        // 更新预览
        updateDataPreviews();
    } catch (e) {
        console.error('加载数据失败:', e);
    }
}

function clearData(type) {
    if (!confirm(`确定要清空${getTypeName(type)}数据吗？`)) return;

    switch (type) {
        case 'booking':
            AppState.bookingData = [];
            document.getElementById('booking-input').value = '';
            break;
        case 'equipment':
            AppState.equipmentData = [];
            document.getElementById('equipment-input').value = '';
            break;
        case 'complaint':
            AppState.complaintData = [];
            document.getElementById('complaint-input').value = '';
            break;
        case 'weather':
            AppState.weatherData = [];
            document.getElementById('weather-input').value = '';
            break;
    }

    saveToStorage();
    updateDataPreviews();
    showToast('数据已清空', 'success');
}

function getTypeName(type) {
    const names = {
        booking: '预订',
        equipment: '设备',
        complaint: '投诉',
        weather: '天气'
    };
    return names[type] || type;
}

// ==================== 数据导入相关 ====================
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 1) return [];

    // 尝试解析表头
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length > 0 && values[0] !== '') {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
    }

    return data;
}

function importBookingData() {
    const input = document.getElementById('booking-input').value.trim();
    if (!input) {
        showToast('请输入预订数据', 'warning');
        return;
    }

    try {
        // 解析CSV格式
        const lines = input.split('\n');
        const data = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());
            if (values.length >= 5) {
                data.push({
                    siteId: values[0],
                    customerName: values[1],
                    checkInDate: values[2],
                    checkOutDate: values[3],
                    guestCount: parseInt(values[4]) || 1
                });
            }
        }

        if (data.length === 0) {
            showToast('未能解析有效数据', 'warning');
            return;
        }

        AppState.bookingData = data;
        saveToStorage();
        updateDataPreviews();
        showToast(`成功导入 ${data.length} 条预订数据`, 'success');
    } catch (e) {
        showToast('导入失败: ' + e.message, 'error');
    }
}

function importEquipmentData() {
    const input = document.getElementById('equipment-input').value.trim();
    if (!input) {
        showToast('请输入设备数据', 'warning');
        return;
    }

    try {
        const lines = input.split('\n');
        const data = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());
            if (values.length >= 6) {
                data.push({
                    siteId: values[0],
                    equipmentType: values[1],
                    equipmentId: values[2],
                    borrowTime: values[3],
                    expectedReturn: values[4],
                    status: values[5]
                });
            }
        }

        if (data.length === 0) {
            showToast('未能解析有效数据', 'warning');
            return;
        }

        AppState.equipmentData = data;
        saveToStorage();
        updateDataPreviews();
        showToast(`成功导入 ${data.length} 条设备数据`, 'success');
    } catch (e) {
        showToast('导入失败: ' + e.message, 'error');
    }
}

function importComplaintData() {
    const input = document.getElementById('complaint-input').value.trim();
    if (!input) {
        showToast('请输入投诉数据', 'warning');
        return;
    }

    try {
        const lines = input.split('\n');
        const data = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());
            if (values.length >= 6) {
                data.push({
                    complaintDate: values[0],
                    complaintTime: values[1],
                    siteId: values[2],
                    complainant: values[3],
                    content: values[4],
                    status: values[5]
                });
            }
        }

        if (data.length === 0) {
            showToast('未能解析有效数据', 'warning');
            return;
        }

        AppState.complaintData = data;
        saveToStorage();
        updateDataPreviews();
        showToast(`成功导入 ${data.length} 条投诉数据`, 'success');
    } catch (e) {
        showToast('导入失败: ' + e.message, 'error');
    }
}

function importWeatherData() {
    const input = document.getElementById('weather-input').value.trim();
    if (!input) {
        showToast('请输入天气数据', 'warning');
        return;
    }

    try {
        const lines = input.split('\n');
        const data = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());
            if (values.length >= 7) {
                // 解析风力等级
                let windLevel = 0;
                const windMatch = values[3].match(/(\d+)/);
                if (windMatch) {
                    windLevel = parseInt(windMatch[1]);
                }

                // 解析湿度
                let humidity = 50;
                const humidityMatch = values[5].match(/(\d+)/);
                if (humidityMatch) {
                    humidity = parseInt(humidityMatch[1]);
                }

                data.push({
                    date: values[0],
                    timePeriod: values[1],
                    weather: values[2],
                    windLevel: windLevel,
                    temperature: values[4],
                    humidity: humidity,
                    warning: values[6]
                });
            }
        }

        if (data.length === 0) {
            showToast('未能解析有效数据', 'warning');
            return;
        }

        AppState.weatherData = data;
        saveToStorage();
        updateDataPreviews();
        showToast(`成功导入 ${data.length} 条天气数据`, 'success');
    } catch (e) {
        showToast('导入失败: ' + e.message, 'error');
    }
}

function updateDataPreviews() {
    updateBookingPreview();
    updateEquipmentPreview();
    updateComplaintPreview();
    updateWeatherPreview();
}

function updateBookingPreview() {
    const container = document.getElementById('booking-preview');
    if (AppState.bookingData.length === 0) {
        container.innerHTML = '<div class="empty-preview">暂无预订数据</div>';
        return;
    }

    let html = '<table><thead><tr><th>营位号</th><th>预订人</th><th>入住日期</th><th>离店日期</th><th>人数</th></tr></thead><tbody>';
    AppState.bookingData.forEach(item => {
        html += `<tr>
            <td>${item.siteId}</td>
            <td>${item.customerName}</td>
            <td>${item.checkInDate}</td>
            <td>${item.checkOutDate}</td>
            <td>${item.guestCount}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function updateEquipmentPreview() {
    const container = document.getElementById('equipment-preview');
    if (AppState.equipmentData.length === 0) {
        container.innerHTML = '<div class="empty-preview">暂无设备数据</div>';
        return;
    }

    let html = '<table><thead><tr><th>营位号</th><th>设备类型</th><th>设备编号</th><th>借出时间</th><th>预计归还</th><th>状态</th></tr></thead><tbody>';
    AppState.equipmentData.forEach(item => {
        html += `<tr>
            <td>${item.siteId}</td>
            <td>${item.equipmentType}</td>
            <td>${item.equipmentId}</td>
            <td>${item.borrowTime}</td>
            <td>${item.expectedReturn}</td>
            <td>${item.status}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function updateComplaintPreview() {
    const container = document.getElementById('complaint-preview');
    if (AppState.complaintData.length === 0) {
        container.innerHTML = '<div class="empty-preview">暂无投诉数据</div>';
        return;
    }

    let html = '<table><thead><tr><th>日期</th><th>时间</th><th>被投诉营位</th><th>投诉人</th><th>内容</th><th>状态</th></tr></thead><tbody>';
    AppState.complaintData.forEach(item => {
        html += `<tr>
            <td>${item.complaintDate}</td>
            <td>${item.complaintTime}</td>
            <td>${item.siteId}</td>
            <td>${item.complainant}</td>
            <td>${item.content}</td>
            <td>${item.status}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function updateWeatherPreview() {
    const container = document.getElementById('weather-preview');
    if (AppState.weatherData.length === 0) {
        container.innerHTML = '<div class="empty-preview">暂无天气数据</div>';
        return;
    }

    let html = '<table><thead><tr><th>日期</th><th>时间段</th><th>天气</th><th>风力等级</th><th>温度</th><th>湿度</th><th>预警</th></tr></thead><tbody>';
    AppState.weatherData.forEach(item => {
        html += `<tr>
            <td>${item.date}</td>
            <td>${item.timePeriod}</td>
            <td>${item.weather}</td>
            <td>${item.windLevel}级</td>
            <td>${item.temperature}</td>
            <td>${item.humidity}%</td>
            <td>${item.warning}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ==================== 规则配置相关 ====================
function loadRuleConfig() {
    // 如果没有保存的规则，使用默认值
    if (!AppState.rules || Object.keys(AppState.rules).length === 0) {
        AppState.rules = { ...DEFAULT_RULES };
    }

    // 应用到表单
    const rules = AppState.rules;
    
    document.getElementById('rule-overbooking').checked = rules.ruleOverbooking;
    document.getElementById('max-capacity').value = rules.maxCapacity;
    document.getElementById('rule-unresolved-complaint').checked = rules.ruleUnresolvedComplaint;
    document.getElementById('complaint-threshold').value = rules.complaintThreshold;
    document.getElementById('rule-high-wind').checked = rules.ruleHighWind;
    document.getElementById('wind-threshold').value = rules.windThreshold;
    document.getElementById('rule-dry-weather').checked = rules.ruleDryWeather;
    document.getElementById('humidity-threshold').value = rules.humidityThreshold;
    document.getElementById('rule-weather-warning').checked = rules.ruleWeatherWarning;
    document.getElementById('rule-missing-equipment').checked = rules.ruleMissingEquipment;
    document.getElementById('rule-overdue-equipment').checked = rules.ruleOverdueEquipment;
}

function saveRules() {
    AppState.rules = {
        ruleOverbooking: document.getElementById('rule-overbooking').checked,
        maxCapacity: parseInt(document.getElementById('max-capacity').value),
        ruleUnresolvedComplaint: document.getElementById('rule-unresolved-complaint').checked,
        complaintThreshold: parseInt(document.getElementById('complaint-threshold').value),
        ruleHighWind: document.getElementById('rule-high-wind').checked,
        windThreshold: parseInt(document.getElementById('wind-threshold').value),
        ruleDryWeather: document.getElementById('rule-dry-weather').checked,
        humidityThreshold: parseInt(document.getElementById('humidity-threshold').value),
        ruleWeatherWarning: document.getElementById('rule-weather-warning').checked,
        ruleMissingEquipment: document.getElementById('rule-missing-equipment').checked,
        ruleOverdueEquipment: document.getElementById('rule-overdue-equipment').checked
    };

    saveToStorage();
    showToast('规则配置已保存', 'success');
}

function loadDefaultRules() {
    if (!confirm('确定要恢复默认规则配置吗？')) return;
    AppState.rules = { ...DEFAULT_RULES };
    loadRuleConfig();
    saveToStorage();
    showToast('已恢复默认规则', 'success');
}

// ==================== 预检逻辑相关 ====================
function runPreCheck() {
    if (AppState.bookingData.length === 0) {
        showToast('请先导入预订数据', 'warning');
        return;
    }

    const rules = AppState.rules;
    const results = [];

    AppState.bookingData.forEach(booking => {
        const siteId = booking.siteId;
        const alerts = [];
        let status = STATUS_TYPES.NORMAL;
        let fireBan = false;

        // 1. 检查超员
        if (rules.ruleOverbooking && booking.guestCount > rules.maxCapacity) {
            alerts.push({
                type: 'danger',
                message: `超员预警：预订${booking.guestCount}人，超过营位最大容量${rules.maxCapacity}人`
            });
            status = STATUS_TYPES.RESTRICTED;
        }

        // 2. 检查未处理投诉
        const siteComplaints = AppState.complaintData.filter(c => c.siteId === siteId);
        const unresolvedComplaints = siteComplaints.filter(c => c.status !== '已处理');
        
        if (rules.ruleUnresolvedComplaint && unresolvedComplaints.length >= rules.complaintThreshold) {
            alerts.push({
                type: 'danger',
                message: `投诉限制：存在${unresolvedComplaints.length}条未处理噪音投诉，达到限制阈值`
            });
            status = STATUS_TYPES.RESTRICTED;
        } else if (unresolvedComplaints.length > 0) {
            alerts.push({
                type: 'warning',
                message: `注意：存在${unresolvedComplaints.length}条未处理噪音投诉`
            });
            if (status === STATUS_TYPES.NORMAL) {
                status = STATUS_TYPES.WARNING;
            }
        }

        // 3. 检查天气风力 - 禁火规则
        const today = new Date().toISOString().split('T')[0];
        const todayWeather = AppState.weatherData.filter(w => w.date === today || w.date === booking.checkInDate);

        // 检查大风天气
        if (rules.ruleHighWind) {
            const highWindRecords = todayWeather.filter(w => w.windLevel >= rules.windThreshold);
            if (highWindRecords.length > 0) {
                fireBan = true;
                alerts.push({
                    type: 'info',
                    message: `禁火提醒：风力达到${highWindRecords[0].windLevel}级，超过阈值${rules.windThreshold}级`
                });
            }
        }

        // 检查干燥天气
        if (rules.ruleDryWeather) {
            const dryWeatherRecords = todayWeather.filter(w => w.humidity <= rules.humidityThreshold);
            if (dryWeatherRecords.length > 0) {
                fireBan = true;
                alerts.push({
                    type: 'info',
                    message: `禁火提醒：湿度仅${dryWeatherRecords[0].humidity}%，低于阈值${rules.humidityThreshold}%`
                });
            }
        }

        // 检查天气预警
        if (rules.ruleWeatherWarning) {
            const warningRecords = todayWeather.filter(w => w.warning && w.warning !== '无');
            if (warningRecords.length > 0) {
                fireBan = true;
                alerts.push({
                    type: 'info',
                    message: `禁火提醒：存在天气预警 - ${warningRecords[0].warning}`
                });
            }
        }

        // 4. 检查设备情况
        const siteEquipment = AppState.equipmentData.filter(e => e.siteId === siteId);

        // 检查逾期未归还
        if (rules.ruleOverdueEquipment) {
            const now = new Date();
            const overdueEquipment = siteEquipment.filter(e => {
                if (e.status !== '已归还' && e.expectedReturn) {
                    const expectedDate = new Date(e.expectedReturn);
                    return now > expectedDate;
                }
                return false;
            });

            if (overdueEquipment.length > 0) {
                alerts.push({
                    type: 'warning',
                    message: `设备提醒：${overdueEquipment.length}件设备逾期未归还`
                });
                if (status === STATUS_TYPES.NORMAL) {
                    status = STATUS_TYPES.WARNING;
                }
            }
        }

        // 统计设备状态
        const borrowedEquipment = siteEquipment.filter(e => e.status === '借出中');
        const returnedEquipment = siteEquipment.filter(e => e.status === '已归还');

        // 组装结果
        const result = {
            siteId: siteId,
            booking: booking,
            complaints: siteComplaints,
            equipment: siteEquipment,
            borrowedEquipment: borrowedEquipment,
            returnedEquipment: returnedEquipment,
            originalStatus: status,
            status: status,
            fireBan: fireBan,
            alerts: alerts,
            isOverridden: false,
            overrideReason: ''
        };

        // 检查是否有人工改判
        if (AppState.overrides[siteId]) {
            result.status = AppState.overrides[siteId].status;
            result.isOverridden = true;
            result.overrideReason = AppState.overrides[siteId].reason || '';
        }

        // 检查是否有备注
        if (AppState.notes[siteId]) {
            result.notes = AppState.notes[siteId];
        }

        results.push(result);
    });

    // 按营位号排序
    results.sort((a, b) => a.siteId.localeCompare(b.siteId));

    AppState.preCheckResults = results;
    renderChecklist();
    updateStats();
    showToast(`预检完成，共 ${results.length} 个营位`, 'success');
}

function renderChecklist() {
    const container = document.getElementById('checklist-container');
    const results = AppState.preCheckResults;

    if (results.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无营位数据，请先执行预检</p></div>';
        return;
    }

    // 应用筛选
    let filteredResults = results;
    if (AppState.currentFilter !== 'all') {
        filteredResults = results.filter(r => r.status === AppState.currentFilter);
    }

    if (filteredResults.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>当前筛选条件下无营位</p></div>';
        return;
    }

    let html = '';
    filteredResults.forEach(result => {
        const statusLabel = STATUS_LABELS[result.status];
        const statusClass = result.status;

        html += `<div class="site-card" data-site-id="${result.siteId}">
            <div class="site-header">
                <span class="site-id">${result.siteId}</span>
                <span class="site-status ${statusClass}">${statusLabel}${result.isOverridden ? ' (人工改判)' : ''}</span>
            </div>
            
            <div class="site-details">
                <div class="detail-item">
                    <div class="detail-label">预订人</div>
                    <div class="detail-value">${result.booking.customerName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">入住日期</div>
                    <div class="detail-value">${result.booking.checkInDate} 至 ${result.booking.checkOutDate}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">预订人数</div>
                    <div class="detail-value">${result.booking.guestCount} 人</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">设备状态</div>
                    <div class="detail-value">借出: ${result.borrowedEquipment.length} | 已还: ${result.returnedEquipment.length}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">投诉记录</div>
                    <div class="detail-value">总计: ${result.complaints.length} | 未处理: ${result.complaints.filter(c => c.status !== '已处理').length}</div>
                </div>
                ${result.fireBan ? `
                <div class="detail-item">
                    <div class="detail-label">防火状态</div>
                    <div class="detail-value" style="color: #e74c3c;">🔥 禁火</div>
                </div>` : ''}
            </div>`;

        // 显示警告信息
        if (result.alerts.length > 0) {
            html += '<div class="site-alerts">';
            result.alerts.forEach(alert => {
                html += `<div class="alert-item ${alert.type}">${alert.message}</div>`;
            });
            html += '</div>';
        }

        // 显示人工改判原因
        if (result.isOverridden && result.overrideReason) {
            html += `<div class="site-note">
                <div class="note-label">人工改判原因</div>
                <div class="note-content">${result.overrideReason}</div>
            </div>`;
        }

        // 显示备注
        if (result.notes && result.notes.length > 0) {
            html += `<div class="site-note">
                <div class="note-label">备注信息</div>
                <div class="note-content">${result.notes}</div>
            </div>`;
        }

        // 操作按钮
        html += `<div class="site-actions">
            <button class="btn btn-primary" onclick="openOverrideModal('${result.siteId}')">人工改判</button>
            <button class="btn btn-secondary" onclick="openNoteModal('${result.siteId}')">添加备注</button>
        </div>`;

        html += '</div>';
    });

    container.innerHTML = html;
}

function filterChecklist() {
    const select = document.getElementById('status-filter');
    AppState.currentFilter = select.value;
    renderChecklist();
}

function updateStats() {
    const results = AppState.preCheckResults;
    if (results.length === 0) {
        document.getElementById('stat-normal').textContent = '0';
        document.getElementById('stat-warning').textContent = '0';
        document.getElementById('stat-restricted').textContent = '0';
        document.getElementById('stat-fire-ban').textContent = '0';
        return;
    }

    const normalCount = results.filter(r => r.status === STATUS_TYPES.NORMAL).length;
    const warningCount = results.filter(r => r.status === STATUS_TYPES.WARNING).length;
    const restrictedCount = results.filter(r => r.status === STATUS_TYPES.RESTRICTED).length;
    const fireBanCount = results.filter(r => r.fireBan).length;

    document.getElementById('stat-normal').textContent = normalCount;
    document.getElementById('stat-warning').textContent = warningCount;
    document.getElementById('stat-restricted').textContent = restrictedCount;
    document.getElementById('stat-fire-ban').textContent = fireBanCount;
}

// ==================== 人工改判和备注 ====================
let currentEditingSite = null;

function openOverrideModal(siteId) {
    currentEditingSite = siteId;
    const result = AppState.preCheckResults.find(r => r.siteId === siteId);
    if (!result) return;

    document.getElementById('modal-title').textContent = '人工改判 - ' + siteId;
    document.getElementById('modal-site-id').value = siteId;
    document.getElementById('modal-original-status').value = STATUS_LABELS[result.originalStatus];
    document.getElementById('modal-new-status').value = result.status;
    document.getElementById('modal-note').value = result.overrideReason || '';

    document.getElementById('override-modal').classList.add('active');
}

function openNoteModal(siteId) {
    currentEditingSite = siteId;
    const result = AppState.preCheckResults.find(r => r.siteId === siteId);
    if (!result) return;

    document.getElementById('modal-title').textContent = '添加备注 - ' + siteId;
    document.getElementById('modal-site-id').value = siteId;
    document.getElementById('modal-original-status').value = STATUS_LABELS[result.status];
    document.getElementById('modal-new-status').value = result.status;
    document.getElementById('modal-note').value = result.notes || '';

    // 隐藏状态选择，只显示备注
    document.querySelector('.form-group select').style.display = 'none';
    document.getElementById('override-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('override-modal').classList.remove('active');
    currentEditingSite = null;
    // 恢复显示
    document.querySelector('.form-group select').style.display = 'block';
}

function saveOverride() {
    if (!currentEditingSite) return;

    const siteId = currentEditingSite;
    const newStatus = document.getElementById('modal-new-status').value;
    const note = document.getElementById('modal-note').value.trim();

    const isNoteOnly = document.querySelector('.form-group select').style.display === 'none';

    if (isNoteOnly) {
        // 只保存备注
        if (note) {
            AppState.notes[siteId] = note;
        } else {
            delete AppState.notes[siteId];
        }
    } else {
        // 保存改判
        const originalResult = AppState.preCheckResults.find(r => r.siteId === siteId);
        if (originalResult && newStatus !== originalResult.originalStatus) {
            AppState.overrides[siteId] = {
                status: newStatus,
                reason: note,
                originalStatus: originalResult.originalStatus,
                timestamp: new Date().toISOString()
            };
        } else {
            // 如果改回原始状态，删除改判记录
            delete AppState.overrides[siteId];
        }
    }

    saveToStorage();
    
    // 重新渲染
    if (AppState.preCheckResults.length > 0) {
        runPreCheck();
    }

    closeModal();
    showToast(isNoteOnly ? '备注已保存' : '改判已保存', 'success');
}

// 点击弹窗外部关闭
document.addEventListener('click', function(e) {
    const modal = document.getElementById('override-modal');
    if (e.target === modal) {
        closeModal();
    }
});

// ==================== 导出相关 ====================
function generateMarkdown() {
    if (AppState.preCheckResults.length === 0) {
        showToast('请先执行预检', 'warning');
        return;
    }

    const results = AppState.preCheckResults;
    const today = new Date().toLocaleDateString('zh-CN');

    let markdown = `# 露营地营位入住预检交接单\n\n`;
    markdown += `**生成时间：** ${today}\n\n`;
    markdown += `---\n\n`;

    // 统计信息
    const normalCount = results.filter(r => r.status === STATUS_TYPES.NORMAL).length;
    const warningCount = results.filter(r => r.status === STATUS_TYPES.WARNING).length;
    const restrictedCount = results.filter(r => r.status === STATUS_TYPES.RESTRICTED).length;
    const fireBanCount = results.filter(r => r.fireBan).length;

    markdown += `## 统计概览\n\n`;
    markdown += `- **正常入住：** ${normalCount} 个营位\n`;
    markdown += `- **需要注意：** ${warningCount} 个营位\n`;
    markdown += `- **限制入住：** ${restrictedCount} 个营位\n`;
    markdown += `- **禁火状态：** ${fireBanCount} 个营位\n\n`;

    // 按状态分组
    markdown += `---\n\n`;
    markdown += `## 各营位详情\n\n`;

    // 限制入住优先
    const restrictedResults = results.filter(r => r.status === STATUS_TYPES.RESTRICTED);
    if (restrictedResults.length > 0) {
        markdown += `### 🔴 限制入住 (${restrictedResults.length})\n\n`;
        restrictedResults.forEach(r => {
            markdown += `#### ${r.siteId}\n`;
            markdown += `- **预订人：** ${r.booking.customerName}\n`;
            markdown += `- **入住日期：** ${r.booking.checkInDate} 至 ${r.booking.checkOutDate}\n`;
            markdown += `- **人数：** ${r.booking.guestCount} 人\n`;
            if (r.isOverridden) {
                markdown += `- **人工改判：** 是 (${r.overrideReason || '无原因'})\n`;
            }
            if (r.alerts.length > 0) {
                markdown += `- **风险提示：**\n`;
                r.alerts.forEach(a => {
                    markdown += `  - ${a.message}\n`;
                });
            }
            if (r.notes) {
                markdown += `- **备注：** ${r.notes}\n`;
            }
            markdown += `\n`;
        });
    }

    // 需要注意
    const warningResults = results.filter(r => r.status === STATUS_TYPES.WARNING);
    if (warningResults.length > 0) {
        markdown += `### 🟡 需要注意 (${warningResults.length})\n\n`;
        warningResults.forEach(r => {
            markdown += `#### ${r.siteId}\n`;
            markdown += `- **预订人：** ${r.booking.customerName}\n`;
            markdown += `- **入住日期：** ${r.booking.checkInDate} 至 ${r.booking.checkOutDate}\n`;
            markdown += `- **人数：** ${r.booking.guestCount} 人\n`;
            if (r.isOverridden) {
                markdown += `- **人工改判：** 是 (${r.overrideReason || '无原因'})\n`;
            }
            if (r.alerts.length > 0) {
                markdown += `- **注意事项：**\n`;
                r.alerts.forEach(a => {
                    markdown += `  - ${a.message}\n`;
                });
            }
            if (r.notes) {
                markdown += `- **备注：** ${r.notes}\n`;
            }
            markdown += `\n`;
        });
    }

    // 禁火状态
    const fireBanResults = results.filter(r => r.fireBan);
    if (fireBanResults.length > 0) {
        markdown += `### 🔥 禁火营位 (${fireBanResults.length})\n\n`;
        markdown += `以下营位因天气原因禁止使用明火：\n\n`;
        fireBanResults.forEach(r => {
            markdown += `- **${r.siteId}**：${r.booking.customerName}\n`;
        });
        markdown += `\n`;
    }

    // 正常入住
    const normalResults = results.filter(r => r.status === STATUS_TYPES.NORMAL);
    if (normalResults.length > 0) {
        markdown += `### 🟢 正常入住 (${normalResults.length})\n\n`;
        markdown += `以下营位状态正常，可正常入住：\n\n`;
        normalResults.forEach(r => {
            markdown += `- **${r.siteId}**：${r.booking.customerName} (${r.booking.guestCount}人)\n`;
        });
        markdown += `\n`;
    }

    // 待办事项
    markdown += `---\n\n`;
    markdown += `## 待办事项\n\n`;
    
    let todos = [];
    results.forEach(r => {
        if (r.status === STATUS_TYPES.RESTRICTED) {
            todos.push(`[ ] 与营位 ${r.siteId} (${r.booking.customerName}) 沟通限制入住原因`);
        }
        if (r.fireBan) {
            todos.push(`[ ] 告知营位 ${r.siteId} 禁火规定`);
        }
        if (r.borrowedEquipment.length > 0) {
            todos.push(`[ ] 检查营位 ${r.siteId} 设备归还情况 (借出${r.borrowedEquipment.length}件)`);
        }
    });

    if (todos.length > 0) {
        todos.forEach(t => {
            markdown += t + '\n';
        });
    } else {
        markdown += `- 暂无待办事项\n`;
    }

    markdown += `\n---\n\n`;
    markdown += `**交接人：** ________________\n\n`;
    markdown += `**接收人：** ________________\n\n`;
    markdown += `**交接时间：** ________________\n`;

    // 显示预览
    document.getElementById('markdown-preview').innerHTML = `<pre>${escapeHtml(markdown)}</pre>`;
    showToast('Markdown 已生成', 'success');
}

function generateJSON() {
    if (AppState.preCheckResults.length === 0) {
        showToast('请先执行预检', 'warning');
        return;
    }

    const exportData = {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        rules: AppState.rules,
        bookingData: AppState.bookingData,
        equipmentData: AppState.equipmentData,
        complaintData: AppState.complaintData,
        weatherData: AppState.weatherData,
        preCheckResults: AppState.preCheckResults,
        overrides: AppState.overrides,
        notes: AppState.notes,
        statistics: {
            total: AppState.preCheckResults.length,
            normal: AppState.preCheckResults.filter(r => r.status === STATUS_TYPES.NORMAL).length,
            warning: AppState.preCheckResults.filter(r => r.status === STATUS_TYPES.WARNING).length,
            restricted: AppState.preCheckResults.filter(r => r.status === STATUS_TYPES.RESTRICTED).length,
            fireBan: AppState.preCheckResults.filter(r => r.fireBan).length
        }
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    document.getElementById('json-preview').innerHTML = `<pre>${escapeHtml(jsonString)}</pre>`;
    showToast('JSON 已生成', 'success');
}

function copyToClipboard(type) {
    let content = '';
    const preview = type === 'markdown' ? 
        document.getElementById('markdown-preview') : 
        document.getElementById('json-preview');
    
    const preElement = preview.querySelector('pre');
    if (!preElement || preElement.textContent === '导出内容将显示在这里...') {
        showToast('请先生成导出内容', 'warning');
        return;
    }

    content = preElement.textContent;

    navigator.clipboard.writeText(content).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        showToast('复制失败，请手动复制', 'error');
    });
}

function downloadMarkdown() {
    const preview = document.getElementById('markdown-preview');
    const preElement = preview.querySelector('pre');
    if (!preElement || preElement.textContent === '导出内容将显示在这里...') {
        showToast('请先生成导出内容', 'warning');
        return;
    }

    const content = preElement.textContent;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `营位预检交接单_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Markdown 文件已下载', 'success');
}

function downloadJSON() {
    const preview = document.getElementById('json-preview');
    const preElement = preview.querySelector('pre');
    if (!preElement || preElement.textContent === '导出内容将显示在这里...') {
        showToast('请先生成导出内容', 'warning');
        return;
    }

    const content = preElement.textContent;
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `营位预检数据_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSON 文件已下载', 'success');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Toast 提示 ====================
function initToastContainer() {
    if (!document.querySelector('.toast-container')) {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
