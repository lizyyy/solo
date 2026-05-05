// 海盐晒场卤水结晶进度管理工具
// 主要应用逻辑

// 全局变量
let appData = {
    ponds: [],
    salinity: [],
    weather: [],
    gateLogs: [],
    harvests: [],
    judgments: {},
    notes: {}
};

const STORAGE_KEY = 'saltworks_data';

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载本地存储的数据
    loadFromLocalStorage();
    
    // 初始化导航功能
    initNavigation();
    
    // 初始化文件导入功能
    initFileImports();
    
    // 初始化按钮功能
    initButtons();
    
    // 更新导入状态显示
    updateImportStatus();
});

// 从本地存储加载数据
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            appData = JSON.parse(savedData);
            console.log('数据已从本地存储加载');
        }
    } catch (error) {
        console.error('加载本地存储数据失败:', error);
    }
}

// 保存数据到本地存储
function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        console.log('数据已保存到本地存储');
    } catch (error) {
        console.error('保存数据到本地存储失败:', error);
    }
}

// 初始化导航功能
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 移除所有活动状态
            navButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            // 添加当前活动状态
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('active');
            
            // 如果是仪表盘标签，更新盐池显示
            if (this.getAttribute('data-tab') === 'dashboard') {
                updatePondOverview();
            }
        });
    });
}

// 初始化文件导入功能
function initFileImports() {
    // 盐池分区表
    document.getElementById('pond-csv').addEventListener('change', function(e) {
        handleFileImport(e, 'ponds');
    });
    
    // 卤度计 CSV
    document.getElementById('salinity-csv').addEventListener('change', function(e) {
        handleFileImport(e, 'salinity');
    });
    
    // 天气站记录
    document.getElementById('weather-csv').addEventListener('change', function(e) {
        handleFileImport(e, 'weather');
    });
    
    // 闸门放卤日志
    document.getElementById('gate-csv').addEventListener('change', function(e) {
        handleFileImport(e, 'gateLogs');
    });
    
    // 收盐批次记录
    document.getElementById('harvest-csv').addEventListener('change', function(e) {
        handleFileImport(e, 'harvests');
    });
}

// 处理文件导入
function handleFileImport(event, dataType) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const parsedData = parseCSV(content, dataType);
            
            // 保存数据
            appData[dataType] = parsedData;
            saveToLocalStorage();
            
            // 更新状态
            updateImportStatus();
            showNotification('导入成功！', 'success');
        } catch (error) {
            console.error('导入失败:', error);
            showNotification('导入失败: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

// 解析 CSV 文件
function parseCSV(content, dataType) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        data.push(row);
    }
    
    // 根据数据类型进行转换
    switch(dataType) {
        case 'ponds':
            return data.map(item => ({
                id: item['盐池编号'] || item.id,
                name: item['分区名称'] || item.name,
                area: parseFloat(item['面积(亩)'] || item.area) || 0,
                depth: parseFloat(item['卤水深度(cm)'] || item.depth) || 0
            }));
        
        case 'salinity':
            return data.map(item => ({
                pondId: item['盐池编号'] || item.pondId,
                time: item['测量时间'] || item.time,
                salinity: parseFloat(item['卤度(°Be\''] || item.salinity) || 0,
                temperature: parseFloat(item['温度(°C)'] || item.temperature) || 0
            }));
        
        case 'weather':
            return data.map(item => ({
                date: item['日期'] || item.date,
                type: item['天气类型'] || item.type,
                temperature: parseFloat(item['气温(°C)'] || item.temperature) || 0,
                humidity: parseFloat(item['湿度(%)'] || item.humidity) || 0,
                windSpeed: parseFloat(item['风速(m/s)'] || item.windSpeed) || 0,
                rainfall: parseFloat(item['降水量(mm)'] || item.rainfall) || 0
            }));
        
        case 'gateLogs':
            return data.map(item => ({
                date: item['日期'] || item.date,
                time: item['操作时间'] || item.time,
                operator: item['操作人'] || item.operator,
                fromPond: item['来源盐池'] || item.fromPond,
                toPond: item['目标盐池'] || item.toPond,
                volume: parseFloat(item['放卤量(m³)'] || item.volume) || 0,
                notes: item['备注'] || item.notes
            }));
        
        case 'harvests':
            return data.map(item => ({
                batchId: item['批次号'] || item.batchId,
                pondId: item['盐池编号'] || item.pondId,
                date: item['收盐日期'] || item.date,
                amount: parseFloat(item['收盐量(吨)'] || item.amount) || 0,
                quality: item['盐质等级'] || item.quality,
                operator: item['操作人'] || item.operator
            }));
        
        default:
            return data;
    }
}

// 初始化按钮功能
function initButtons() {
    // 加载示例数据
    document.getElementById('load-sample-data').addEventListener('click', function() {
        loadSampleData();
    });
    
    // 清除所有数据
    document.getElementById('clear-all-data').addEventListener('click', function() {
        if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
            clearAllData();
        }
    });
    
    // 模态框关闭按钮
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-changes').addEventListener('click', closeModal);
    
    // 点击模态框外部关闭
    document.getElementById('pond-detail-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
    
    // 保存修改按钮
    document.getElementById('save-changes').addEventListener('click', savePondChanges);
    
    // 导出按钮
    document.getElementById('export-markdown').addEventListener('click', exportMarkdown);
    document.getElementById('export-json').addEventListener('click', exportJSON);
}

// 加载示例数据
function loadSampleData() {
    // 盐池分区表
    appData.ponds = [
        { id: 'A-01', name: '东区第一池', area: 15.5, depth: 20 },
        { id: 'A-02', name: '东区第二池', area: 14.2, depth: 18 },
        { id: 'A-03', name: '东区第三池', area: 16.8, depth: 22 },
        { id: 'B-01', name: '西区第一池', area: 13.5, depth: 19 },
        { id: 'B-02', name: '西区第二池', area: 15.0, depth: 21 }
    ];
    
    // 卤度计数据
    const baseSalinity = [
        { pondId: 'A-01', time: '2026-05-01 08:00', salinity: 10.5, temperature: 22 },
        { pondId: 'A-01', time: '2026-05-02 08:00', salinity: 12.3, temperature: 24 },
        { pondId: 'A-01', time: '2026-05-03 08:00', salinity: 14.8, temperature: 26 },
        { pondId: 'A-01', time: '2026-05-04 08:00', salinity: 17.2, temperature: 28 },
        { pondId: 'A-01', time: '2026-05-05 08:00', salinity: 19.5, temperature: 30 },
        
        { pondId: 'A-02', time: '2026-05-01 08:00', salinity: 8.2, temperature: 22 },
        { pondId: 'A-02', time: '2026-05-02 08:00', salinity: 10.1, temperature: 24 },
        { pondId: 'A-02', time: '2026-05-03 08:00', salinity: 9.5, temperature: 25 },
        { pondId: 'A-02', time: '2026-05-04 08:00', salinity: 11.2, temperature: 26 },
        { pondId: 'A-02', time: '2026-05-05 08:00', salinity: 13.8, temperature: 28 },
        
        { pondId: 'A-03', time: '2026-05-01 08:00', salinity: 22.5, temperature: 22 },
        { pondId: 'A-03', time: '2026-05-02 08:00', salinity: 23.8, temperature: 24 },
        { pondId: 'A-03', time: '2026-05-03 08:00', salinity: 24.5, temperature: 26 },
        { pondId: 'A-03', time: '2026-05-04 08:00', salinity: 25.2, temperature: 28 },
        { pondId: 'A-03', time: '2026-05-05 08:00', salinity: 25.8, temperature: 30 },
        
        { pondId: 'B-01', time: '2026-05-01 08:00', salinity: 15.3, temperature: 22 },
        { pondId: 'B-01', time: '2026-05-02 08:00', salinity: 16.8, temperature: 24 },
        { pondId: 'B-01', time: '2026-05-03 08:00', salinity: 18.2, temperature: 26 },
        { pondId: 'B-01', time: '2026-05-04 08:00', salinity: 19.5, temperature: 28 },
        { pondId: 'B-01', time: '2026-05-05 08:00', salinity: 21.2, temperature: 30 },
        
        { pondId: 'B-02', time: '2026-05-01 08:00', salinity: 5.2, temperature: 22 },
        { pondId: 'B-02', time: '2026-05-02 08:00', salinity: 7.1, temperature: 24 },
        { pondId: 'B-02', time: '2026-05-03 08:00', salinity: 6.5, temperature: 25 },
        { pondId: 'B-02', time: '2026-05-04 08:00', salinity: 8.2, temperature: 26 },
        { pondId: 'B-02', time: '2026-05-05 08:00', salinity: 10.5, temperature: 28 }
    ];
    
    appData.salinity = baseSalinity;
    
    // 天气记录
    appData.weather = [
        { date: '2026-05-01', type: '晴', temperature: 25, humidity: 60, windSpeed: 3.2, rainfall: 0 },
        { date: '2026-05-02', type: '晴', temperature: 27, humidity: 55, windSpeed: 2.8, rainfall: 0 },
        { date: '2026-05-03', type: '小雨', temperature: 24, humidity: 85, windSpeed: 4.1, rainfall: 15.2 },
        { date: '2026-05-04', type: '多云', temperature: 26, humidity: 70, windSpeed: 3.5, rainfall: 0 },
        { date: '2026-05-05', type: '晴', temperature: 29, humidity: 50, windSpeed: 2.5, rainfall: 0 }
    ];
    
    // 闸门放卤日志
    appData.gateLogs = [
        { date: '2026-05-03', time: '14:30', operator: '张三', fromPond: 'A-01', toPond: 'A-02', volume: 500, notes: '补充稀释后的卤水' },
        { date: '2026-05-04', time: '09:15', operator: '李四', fromPond: 'B-01', toPond: 'B-02', volume: 300, notes: '调整浓度' },
        { date: '2026-05-05', time: '10:00', operator: '王五', fromPond: 'A-03', toPond: '', volume: 0, notes: '准备收盐，关闭闸门' }
    ];
    
    // 收盐批次记录
    appData.harvests = [
        { batchId: 'H-2026-001', pondId: 'A-03', date: '2026-05-06', amount: 0, quality: '待检测', operator: '待安排' }
    ];
    
    // 保存数据
    saveToLocalStorage();
    
    // 更新显示
    updateImportStatus();
    showNotification('示例数据已加载！', 'success');
}

// 清除所有数据
function clearAllData() {
    appData = {
        ponds: [],
        salinity: [],
        weather: [],
        gateLogs: [],
        harvests: [],
        judgments: {},
        notes: {}
    };
    
    localStorage.removeItem(STORAGE_KEY);
    updateImportStatus();
    showNotification('所有数据已清除！', 'success');
}

// 更新导入状态显示
function updateImportStatus() {
    const statusElements = {
        ponds: 'pond-status',
        salinity: 'salinity-status',
        weather: 'weather-status',
        gateLogs: 'gate-status',
        harvests: 'harvest-status'
    };
    
    Object.keys(statusElements).forEach(key => {
        const element = document.getElementById(statusElements[key]);
        const count = appData[key].length;
        
        if (count > 0) {
            element.textContent = `已导入 ${count} 条记录`;
            element.className = 'import-status success';
        } else {
            element.textContent = '未导入';
            element.className = 'import-status';
        }
    });
    
    // 更新盐池筛选下拉框
    updatePondFilter();
}

// 更新盐池筛选下拉框
function updatePondFilter() {
    const select = document.getElementById('filter-pond');
    select.innerHTML = '<option value="all">所有盐池</option>';
    
    appData.ponds.forEach(pond => {
        const option = document.createElement('option');
        option.value = pond.id;
        option.textContent = `${pond.id} - ${pond.name}`;
        select.appendChild(option);
    });
    
    // 添加筛选事件监听
    select.removeEventListener('change', filterPonds);
    select.addEventListener('change', filterPonds);
    
    // 状态筛选
    const statusSelect = document.getElementById('filter-status');
    statusSelect.removeEventListener('change', filterPonds);
    statusSelect.addEventListener('change', filterPonds);
}

// 过滤盐池
function filterPonds() {
    updatePondOverview();
}

// 更新盐池总览
function updatePondOverview() {
    const container = document.getElementById('pond-overview');
    container.innerHTML = '';
    
    if (appData.ponds.length === 0) {
        container.innerHTML = '<p class="no-data">暂无盐池数据，请先导入盐池分区表。</p>';
        return;
    }
    
    // 获取筛选条件
    const pondFilter = document.getElementById('filter-pond').value;
    const statusFilter = document.getElementById('filter-status').value;
    
    // 过滤并显示盐池
    appData.ponds.forEach(pond => {
        // 盐池过滤
        if (pondFilter !== 'all' && pond.id !== pondFilter) {
            return;
        }
        
        // 计算盐池状态
        const pondStatus = calculatePondStatus(pond.id);
        
        // 状态过滤
        if (statusFilter !== 'all' && pondStatus.status !== statusFilter) {
            return;
        }
        
        // 创建盐池卡片
        const card = createPondCard(pond, pondStatus);
        container.appendChild(card);
    });
}

// 计算盐池状态
function calculatePondStatus(pondId) {
    // 获取该盐池的最新卤度数据
    const pondSalinity = appData.salinity.filter(s => s.pondId === pondId);
    
    if (pondSalinity.length === 0) {
        return {
            status: 'normal',
            progress: 0,
            currentSalinity: 0,
            dilution: null,
            transfer: null,
            risk: null
        };
    }
    
    // 按时间排序
    pondSalinity.sort((a, b) => new Date(a.time) - new Date(b.time));
    const latest = pondSalinity[pondSalinity.length - 1];
    
    // 计算浓缩进度 (假设饱和卤度为25°Be')
    const targetSalinity = 25;
    const progress = Math.min(100, (latest.salinity / targetSalinity) * 100);
    
    // 检查雨后稀释
    let dilution = null;
    const recentRain = appData.weather.filter(w => w.rainfall > 0);
    if (recentRain.length > 0 && pondSalinity.length >= 2) {
        const lastRain = recentRain[recentRain.length - 1];
        const rainDate = new Date(lastRain.date);
        
        // 检查雨后卤度变化
        for (let i = 1; i < pondSalinity.length; i++) {
            const current = pondSalinity[i];
            const previous = pondSalinity[i - 1];
            const currentDate = new Date(current.time.split(' ')[0]);
            
            if (currentDate >= rainDate && current.salinity < previous.salinity) {
                dilution = {
                    rainDate: lastRain.date,
                    rainfall: lastRain.rainfall,
                    previousSalinity: previous.salinity,
                    currentSalinity: current.salinity,
                    decrease: previous.salinity - current.salinity
                };
                break;
            }
        }
    }
    
    // 检查错池放卤
    let transfer = null;
    const recentTransfers = appData.gateLogs.filter(g => 
        g.fromPond === pondId || g.toPond === pondId
    );
    
    if (recentTransfers.length > 0) {
        transfer = recentTransfers[recentTransfers.length - 1];
    }
    
    // 检查可收盐风险
    let risk = null;
    if (latest.salinity >= 24) {
        risk = {
            type: 'high',
            message: '卤度已接近饱和，建议尽快收盐',
            currentSalinity: latest.salinity
        };
    } else if (latest.salinity >= 22) {
        risk = {
            type: 'medium',
            message: '卤度较高，关注天气变化',
            currentSalinity: latest.salinity
        };
    }
    
    // 确定状态
    let status = 'normal';
    
    // 检查人工改判
    if (appData.judgments[pondId]) {
        status = appData.judgments[pondId];
    } else {
        // 自动判断
        if (dilution) {
            status = 'diluted';
        } else if (risk && risk.type === 'high') {
            status = 'risk';
        } else if (progress >= 95) {
            status = 'harvest';
        }
    }
    
    return {
        status,
        progress,
        currentSalinity: latest.salinity,
        temperature: latest.temperature,
        dilution,
        transfer,
        risk,
        history: pondSalinity.slice(-5) // 最近5条记录
    };
}

// 创建盐池卡片
function createPondCard(pond, status) {
    const card = document.createElement('div');
    card.className = `pond-card ${status.status}`;
    card.dataset.pondId = pond.id;
    
    // 状态标签
    const statusLabels = {
        normal: '正常浓缩',
        diluted: '雨后稀释',
        risk: '可收盐风险',
        harvest: '可收盐'
    };
    
    card.innerHTML = `
        <div class="pond-header">
            <span class="pond-id">${pond.id}</span>
            <span class="pond-status ${status.status}">${statusLabels[status.status] || status.status}</span>
        </div>
        <div class="pond-info">
            <p><strong>${pond.name}</strong></p>
            <p>面积: ${pond.area} 亩 | 深度: ${pond.depth} cm</p>
            <p>当前卤度: ${status.currentSalinity.toFixed(1)} °Be'</p>
            <p>温度: ${status.temperature} °C</p>
        </div>
        <div class="pond-progress">
            <div class="progress-label">
                <span>浓缩进度</span>
                <span>${status.progress.toFixed(1)}%</span>
            </div>
            <div class="mini-progress-bar">
                <div class="mini-progress-fill" style="width: ${status.progress}%"></div>
            </div>
        </div>
    `;
    
    // 添加点击事件
    card.addEventListener('click', function() {
        openPondDetail(pond.id);
    });
    
    return card;
}

// 打开盐池详情
let currentPondId = null;

function openPondDetail(pondId) {
    currentPondId = pondId;
    const pond = appData.ponds.find(p => p.id === pondId);
    const status = calculatePondStatus(pondId);
    
    if (!pond) return;
    
    // 设置标题
    document.getElementById('modal-pond-title').textContent = `${pond.id} - ${pond.name}`;
    
    // 基本信息
    const basicInfo = document.getElementById('basic-info');
    basicInfo.innerHTML = `
        <div class="info-item">
            <span class="info-label">盐池编号</span>
            <span class="info-value">${pond.id}</span>
        </div>
        <div class="info-item">
            <span class="info-label">分区名称</span>
            <span class="info-value">${pond.name}</span>
        </div>
        <div class="info-item">
            <span class="info-label">面积</span>
            <span class="info-value">${pond.area} 亩</span>
        </div>
        <div class="info-item">
            <span class="info-label">卤水深度</span>
            <span class="info-value">${pond.depth} cm</span>
        </div>
        <div class="info-item">
            <span class="info-label">当前卤度</span>
            <span class="info-value">${status.currentSalinity.toFixed(1)} °Be'</span>
        </div>
        <div class="info-item">
            <span class="info-label">当前温度</span>
            <span class="info-value">${status.temperature} °C</span>
        </div>
    `;
    
    // 浓缩进度
    const progressFill = document.getElementById('concentration-progress');
    const progressText = document.getElementById('progress-text');
    progressFill.style.width = `${status.progress}%`;
    progressText.textContent = `${status.progress.toFixed(1)}%`;
    
    // 历史图表
    const historyChart = document.getElementById('concentration-history');
    historyChart.innerHTML = '';
    
    if (status.history && status.history.length > 0) {
        const maxSalinity = Math.max(...status.history.map(h => h.salinity), 25);
        
        status.history.forEach(record => {
            const bar = document.createElement('div');
            const height = (record.salinity / maxSalinity) * 100;
            bar.className = 'chart-bar';
            bar.style.height = `${height}%`;
            bar.setAttribute('data-date', record.time.split(' ')[0]);
            bar.title = `${record.time.split(' ')[0]}: ${record.salinity} °Be'`;
            historyChart.appendChild(bar);
        });
    }
    
    // 雨后稀释
    const dilutionInfo = document.getElementById('dilution-info');
    if (status.dilution) {
        dilutionInfo.className = 'info-block warning';
        dilutionInfo.innerHTML = `
            <p><strong>检测到雨后稀释</strong></p>
            <p>降雨日期: ${status.dilution.rainDate}</p>
            <p>降雨量: ${status.dilution.rainfall} mm</p>
            <p>卤度变化: ${status.dilution.previousSalinity.toFixed(1)} → ${status.dilution.currentSalinity.toFixed(1)} °Be' (下降 ${status.dilution.decrease.toFixed(1)})</p>
        `;
    } else {
        dilutionInfo.className = 'info-block';
        dilutionInfo.innerHTML = '<p>近期无雨后稀释情况</p>';
    }
    
    // 错池放卤
    const transferInfo = document.getElementById('transfer-info');
    if (status.transfer) {
        const direction = status.transfer.fromPond === pondId ? '输出' : '输入';
        transferInfo.className = 'info-block';
        transferInfo.innerHTML = `
            <p><strong>近期放卤操作 (${direction})</strong></p>
            <p>日期: ${status.transfer.date} ${status.transfer.time}</p>
            <p>操作人: ${status.transfer.operator}</p>
            <p>放卤量: ${status.transfer.volume} m³</p>
            <p>备注: ${status.transfer.notes || '无'}</p>
        `;
    } else {
        transferInfo.className = 'info-block';
        transferInfo.innerHTML = '<p>近期无放卤操作</p>';
    }
    
    // 可收盐风险
    const riskInfo = document.getElementById('risk-info');
    if (status.risk) {
        const riskClass = status.risk.type === 'high' ? 'danger' : 'warning';
        riskInfo.className = `info-block ${riskClass}`;
        riskInfo.innerHTML = `
            <p><strong>${status.risk.type === 'high' ? '高风险' : '中等风险'}</strong></p>
            <p>${status.risk.message}</p>
            <p>当前卤度: ${status.risk.currentSalinity.toFixed(1)} °Be'</p>
        `;
    } else {
        riskInfo.className = 'info-block success';
        riskInfo.innerHTML = '<p><strong>风险状态: 正常</strong></p><p>卤度在安全范围内</p>';
    }
    
    // 人工改判
    const manualStatus = document.getElementById('manual-status');
    manualStatus.value = appData.judgments[pondId] || '';
    
    // 备注
    const pondNotes = document.getElementById('pond-notes');
    pondNotes.value = appData.notes[pondId] || '';
    
    // 显示模态框
    document.getElementById('pond-detail-modal').classList.add('active');
}

// 关闭模态框
function closeModal() {
    document.getElementById('pond-detail-modal').classList.remove('active');
    currentPondId = null;
}

// 保存盐池修改
function savePondChanges() {
    if (!currentPondId) return;
    
    // 保存人工改判
    const manualStatus = document.getElementById('manual-status').value;
    if (manualStatus) {
        appData.judgments[currentPondId] = manualStatus;
    } else {
        delete appData.judgments[currentPondId];
    }
    
    // 保存备注
    const notes = document.getElementById('pond-notes').value;
    if (notes) {
        appData.notes[currentPondId] = notes;
    } else {
        delete appData.notes[currentPondId];
    }
    
    // 保存到本地存储
    saveToLocalStorage();
    
    // 关闭模态框并更新显示
    closeModal();
    updatePondOverview();
    showNotification('修改已保存！', 'success');
}

// 导出 Markdown 交接单
function exportMarkdown() {
    const previewContent = document.getElementById('export-preview-content');
    
    // 生成 Markdown 内容
    let markdown = `# 海盐晒场卤水结晶进度交接单\n\n`;
    markdown += `**生成日期**: ${new Date().toLocaleDateString('zh-CN')}\n\n`;
    markdown += `---\n\n`;
    
    // 盐池总览
    markdown += `## 盐池总览\n\n`;
    markdown += `| 盐池编号 | 分区名称 | 面积(亩) | 深度(cm) | 当前卤度(°Be') | 浓缩进度 | 状态 |\n`;
    markdown += `|----------|----------|----------|----------|----------------|----------|------|\n`;
    
    appData.ponds.forEach(pond => {
        const status = calculatePondStatus(pond.id);
        const statusLabels = {
            normal: '正常浓缩',
            diluted: '雨后稀释',
            risk: '可收盐风险',
            harvest: '可收盐'
        };
        
        markdown += `| ${pond.id} | ${pond.name} | ${pond.area} | ${pond.depth} | ${status.currentSalinity.toFixed(1)} | ${status.progress.toFixed(1)}% | ${statusLabels[status.status] || status.status} |\n`;
    });
    
    markdown += `\n---\n\n`;
    
    // 详细信息
    markdown += `## 盐池详情\n\n`;
    
    appData.ponds.forEach(pond => {
        const status = calculatePondStatus(pond.id);
        const notes = appData.notes[pond.id];
        const judgment = appData.judgments[pond.id];
        
        markdown += `### ${pond.id} - ${pond.name}\n\n`;
        markdown += `- **面积**: ${pond.area} 亩\n`;
        markdown += `- **卤水深度**: ${pond.depth} cm\n`;
        markdown += `- **当前卤度**: ${status.currentSalinity.toFixed(1)} °Be'\n`;
        markdown += `- **浓缩进度**: ${status.progress.toFixed(1)}%\n`;
        markdown += `- **状态**: ${judgment ? `人工改判: ${judgment}` : '系统判断'}\n`;
        
        // 雨后稀释
        if (status.dilution) {
            markdown += `- **雨后稀释**: 是 (降雨 ${status.dilution.rainfall}mm, 卤度下降 ${status.dilution.decrease.toFixed(1)} °Be')\n`;
        } else {
            markdown += `- **雨后稀释**: 否\n`;
        }
        
        // 放卤操作
        if (status.transfer) {
            markdown += `- **近期放卤**: ${status.transfer.date} ${status.transfer.time} (${status.transfer.volume} m³)\n`;
        }
        
        // 风险
        if (status.risk) {
            markdown += `- **风险提示**: ${status.risk.message}\n`;
        }
        
        // 备注
        if (notes) {
            markdown += `- **备注**: ${notes}\n`;
        }
        
        markdown += `\n`;
    });
    
    // 天气记录
    if (appData.weather.length > 0) {
        markdown += `---\n\n`;
        markdown += `## 近期天气记录\n\n`;
        markdown += `| 日期 | 天气类型 | 气温(°C) | 湿度(%) | 风速(m/s) | 降水量(mm) |\n`;
        markdown += `|------|----------|----------|---------|-----------|------------|\n`;
        
        appData.weather.slice(-5).forEach(w => {
            markdown += `| ${w.date} | ${w.type} | ${w.temperature} | ${w.humidity} | ${w.windSpeed} | ${w.rainfall} |\n`;
        });
        
        markdown += `\n`;
    }
    
    // 预览
    previewContent.textContent = markdown;
    
    // 生成下载
    downloadFile(markdown, `交接单_${new Date().toISOString().split('T')[0]}.md`, 'text/markdown');
    
    showNotification('Markdown 交接单已导出！', 'success');
}

// 导出 JSON 审计明细
function exportJSON() {
    const previewContent = document.getElementById('export-preview-content');
    
    // 构建完整的审计数据
    const auditData = {
        exportTime: new Date().toISOString(),
        ponds: appData.ponds,
        salinity: appData.salinity,
        weather: appData.weather,
        gateLogs: appData.gateLogs,
        harvests: appData.harvests,
        judgments: appData.judgments,
        notes: appData.notes,
        pondStatuses: {}
    };
    
    // 添加每个盐池的计算状态
    appData.ponds.forEach(pond => {
        auditData.pondStatuses[pond.id] = calculatePondStatus(pond.id);
    });
    
    // 格式化 JSON
    const jsonString = JSON.stringify(auditData, null, 2);
    
    // 预览
    previewContent.textContent = jsonString;
    
    // 生成下载
    downloadFile(jsonString, `审计明细_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    
    showNotification('JSON 审计明细已导出！', 'success');
}

// 下载文件
function downloadFile(content, filename, mimeType) {
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

// 显示通知
function showNotification(message, type) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加样式
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '4px',
        color: 'white',
        zIndex: '9999',
        animation: 'slideIn 0.3s ease'
    });
    
    // 背景颜色
    if (type === 'success') {
        notification.style.backgroundColor = '#2ecc71';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#e74c3c';
    }
    
    document.body.appendChild(notification);
    
    // 3秒后移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOut {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.no-data {
    text-align: center;
    padding: 40px;
    color: #7f8c8d;
    font-size: 1.1rem;
}
`;
document.head.appendChild(style);