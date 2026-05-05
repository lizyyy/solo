// 会展数据分析与可视化工具
// 全局状态管理
const AppState = {
    acceptanceData: [],
    materialData: [],
    photoData: [],
    penaltyData: [],
    mergedData: [],
    reviews: {},
    currentPage: 1,
    pageSize: 10,
    filters: {},
    charts: {
        penaltyReason: null,
        penaltyAmount: null,
        penaltySeverity: null,
        materialReturn: null
    }
};

// 本地存储键名
const STORAGE_KEYS = {
    ACCEPTANCE_DATA: 'exhibition_acceptance_data',
    MATERIAL_DATA: 'exhibition_material_data',
    PHOTO_DATA: 'exhibition_photo_data',
    PENALTY_DATA: 'exhibition_penalty_data',
    REVIEWS: 'exhibition_reviews',
    MERGED_DATA: 'exhibition_merged_data'
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadFromLocalStorage();
    initCharts();
    updateUI();
});

// 初始化事件监听器
function initEventListeners() {
    // 标签页切换
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // 文件上传区域
    setupFileUpload('acceptance');
    setupFileUpload('material');
    setupFileUpload('photo');
    setupFileUpload('penalty');

    // 分析按钮
    document.getElementById('analyzeDataBtn').addEventListener('click', analyzeData);

    // 筛选按钮
    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

    // 分页按钮
    document.getElementById('prevPageBtn').addEventListener('click', goToPrevPage);
    document.getElementById('nextPageBtn').addEventListener('click', goToNextPage);

    // 导出按钮
    document.getElementById('exportMarkdownBtn').addEventListener('click', exportMarkdown);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);

    // 清除数据按钮
    document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

    // 保存复核按钮
    document.getElementById('saveReviewBtn').addEventListener('click', saveReview);

    // 展位选择
    document.getElementById('reviewBoothSelect').addEventListener('change', function() {
        loadBoothReviewDetails(this.value);
    });

    // 模态框关闭
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('boothModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
}

// 设置文件上传
function setupFileUpload(type) {
    const uploadZone = document.getElementById(`${type}UploadZone`);
    const fileInput = document.getElementById(`${type}FileInput`);

    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileUpload(type, e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            handleFileUpload(type, this.files[0]);
        }
    });
}

// 处理文件上传
function handleFileUpload(type, file) {
    const fileInfo = document.getElementById(`${type}FileInfo`);
    fileInfo.textContent = `已选择: ${file.name}`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = parseExcelFile(e.target.result, file.name);
            storeData(type, data);
            fileInfo.textContent += ` (${data.length} 条记录) `;
            fileInfo.classList.add('text-green-600');
        } catch (error) {
            fileInfo.textContent = `解析失败: ${error.message}`;
            fileInfo.classList.add('text-red-600');
        }
    };
    reader.readAsBinaryString(file);
}

// 解析Excel文件
function parseExcelFile(data, fileName) {
    const workbook = XLSX.read(data, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
}

// 存储数据
function storeData(type, data) {
    const processedData = processRawData(type, data);
    
    switch(type) {
        case 'acceptance':
            AppState.acceptanceData = processedData;
            saveToLocalStorage(STORAGE_KEYS.ACCEPTANCE_DATA, processedData);
            break;
        case 'material':
            AppState.materialData = processedData;
            saveToLocalStorage(STORAGE_KEYS.MATERIAL_DATA, processedData);
            break;
        case 'photo':
            AppState.photoData = processedData;
            saveToLocalStorage(STORAGE_KEYS.PHOTO_DATA, processedData);
            break;
        case 'penalty':
            AppState.penaltyData = processedData;
            saveToLocalStorage(STORAGE_KEYS.PENALTY_DATA, processedData);
            break;
    }
}

// 处理原始数据
function processRawData(type, rawData) {
    if (!rawData || rawData.length < 2) return [];
    
    const headers = rawData[0].map(h => String(h).trim());
    const data = [];
    
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.every(cell => !cell)) continue;
        
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : '';
        });
        data.push(obj);
    }
    
    return data;
}

// 分析数据
function analyzeData() {
    if (!AppState.acceptanceData.length === 0 && 
        !AppState.materialData.length === 0 &&
        !AppState.photoData.length === 0 &&
        !AppState.penaltyData.length === 0) {
        alert('请先上传至少一个数据文件');
        return;
    }

    AppState.mergedData = mergeAllData();
    saveToLocalStorage(STORAGE_KEYS.MERGED_DATA, AppState.mergedData);

    // 更新UI
    updateDataPreview();
    updateSummaryCards();
    updateCharts();
    updateBoothDetailsTable();
    updateReviewBoothSelect();

    // 切换到概览标签页
    switchTab('overview');
    alert('数据分析完成！');
}

// 合并所有数据
function mergeAllData() {
    const boothMap = new Map();

    // 处理验收数据
    AppState.acceptanceData.forEach(item => {
        const boothNumber = getBoothNumber(item);
        if (!boothMap.has(boothNumber)) {
            boothMap.set(boothNumber, createBoothObject(boothNumber));
        }
        const booth = boothMap.get(boothNumber);
        booth.acceptance = {
            status: item['验收状态'] || item['状态'] || '未知',
            time: item['验收时间'] || item['时间'] || '',
            person: item['验收人员'] || item['人员'] || ''
        };
    });

    // 处理物料数据
    AppState.materialData.forEach(item => {
        const boothNumber = getBoothNumber(item);
        if (!boothMap.has(boothNumber)) {
            boothMap.set(boothNumber, createBoothObject(boothNumber));
        }
        const booth = boothMap.get(boothNumber);
        if (!booth.materials) booth.materials = [];
        
        booth.materials.push({
            name: item['物料名称'] || item['名称'] || '未知物料',
            borrowed: parseInt(item['借出数量'] || item['借出'] || 0),
            returned: parseInt(item['归还数量'] || item['归还'] || 0),
            status: getMaterialStatus(item)
        });
    });

    // 处理照片数据
    AppState.photoData.forEach(item => {
        const boothNumber = getBoothNumber(item);
        if (!boothMap.has(boothNumber)) {
            boothMap.set(boothNumber, createBoothObject(boothNumber));
        }
        const booth = boothMap.get(boothNumber);
        if (!booth.photos) booth.photos = [];
        
        booth.photos.push({
            id: item['照片编号'] || item['编号'] || '',
            annotation: item['标注内容'] || item['标注'] || '',
            time: item['拍摄时间'] || item['时间'] || ''
        });
    });

    // 处理扣罚数据
    AppState.penaltyData.forEach(item => {
        const boothNumber = getBoothNumber(item);
        if (!boothMap.has(boothNumber)) {
            boothMap.set(boothNumber, createBoothObject(boothNumber));
        }
        const booth = boothMap.get(boothNumber);
        if (!booth.penalties) booth.penalties = [];
        
        const reason = item['扣罚原因'] || item['原因'] || '未知原因';
        const amount = parseFloat(item['扣罚金额'] || item['金额'] || 0);
        
        booth.penalties.push({
            reason: reason,
            amount: amount,
            time: item['扣罚时间'] || item['时间'] || '',
            description: item['备注'] || item['说明'] || ''
        });
        
        booth.totalPenalty += amount;
        booth.hasPenalty = true;
    });

    // 计算严重程度和状态
    boothMap.forEach((booth, boothNumber) => {
        booth.severity = calculateSeverity(booth);
        booth.penaltyReasons = getPenaltyReasons(booth);
        booth.materialStatus = getOverallMaterialStatus(booth);
        booth.photoStatus = getPhotoStatus(booth);
        booth.reviewStatus = AppState.reviews[boothNumber] ? 
            AppState.reviews[boothNumber].status : 'pending';
    });

    return Array.from(boothMap.values());
}

// 获取展位号
function getBoothNumber(item) {
    return String(item['展位号'] || item['展位'] || item['booth'] || item['Booth'] || '未知展位').trim();
}

// 创建展位对象
function createBoothObject(boothNumber) {
    return {
        boothNumber: boothNumber,
        acceptance: { status: '未知', time: '', person: '' },
        materials: [],
        photos: [],
        penalties: [],
        totalPenalty: 0,
        hasPenalty: false,
        severity: 'low',
        penaltyReasons: [],
        materialStatus: 'normal',
        photoStatus: 'sufficient',
        reviewStatus: 'pending'
    };
}

// 获取物料状态
function getMaterialStatus(item) {
    const borrowed = parseInt(item['借出数量'] || item['借出'] || 0);
    const returned = parseInt(item['归还数量'] || item['归还'] || 0);
    
    if (returned === borrowed) return 'returned';
    if (returned === 0) return 'not_returned';
    return 'partial';
}

// 计算严重程度
function calculateSeverity(booth) {
    if (!booth.hasPenalty) return 'low';
    
    // 根据扣罚金额
    if (booth.totalPenalty >= 5000) return 'high';
    if (booth.totalPenalty >= 2000) return 'medium';
    
    // 根据扣罚原因
    const severeReasons = ['墙板破损', '灯具未归还', '超时撤场'];
    for (const penalty of booth.penalties) {
        if (severeReasons.includes(penalty.reason)) {
            return 'medium';
        }
    }
    
    return 'low';
}

// 获取扣罚原因列表
function getPenaltyReasons(booth) {
    if (!booth.penalties || booth.penalties.length === 0) return [];
    return booth.penalties.map(p => p.reason);
}

// 获取整体物料状态
function getOverallMaterialStatus(booth) {
    if (!booth.materials || booth.materials.length === 0) return 'normal';
    
    const notReturned = booth.materials.filter(m => m.status === 'not_returned' || m.status === 'partial');
    if (notReturned.length > 0) return 'missing';
    
    return 'normal';
}

// 获取照片状态
function getPhotoStatus(booth) {
    if (!booth.photos || booth.photos.length === 0) return 'insufficient';
    if (booth.photos.length < 3) return 'limited';
    return 'sufficient';
}

// 更新数据预览
function updateDataPreview() {
    const previewSection = document.getElementById('dataPreview');
    const tableBody = document.getElementById('dataPreviewTableBody');
    
    if (AppState.mergedData.length === 0) {
        previewSection.classList.add('hidden');
        return;
    }
    
    previewSection.classList.remove('hidden');
    tableBody.innerHTML = '';
    
    AppState.mergedData.slice(0, 10).forEach(booth => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${booth.boothNumber}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${booth.acceptance.status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${booth.penaltyReasons.join(', ') || '无'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥${booth.totalPenalty.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${booth.photos ? booth.photos.length : 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${getMaterialStatusText(booth.materialStatus)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// 获取物料状态文本
function getMaterialStatusText(status) {
    const statusMap = {
        'normal': '正常',
        'missing': '缺失',
        'partial': '部分归还'
    };
    return statusMap[status] || '未知';
}

// 更新汇总卡片
function updateSummaryCards() {
    const totalBooths = AppState.mergedData.length;
    const penalizedBooths = AppState.mergedData.filter(b => b.hasPenalty).length;
    const totalPenalty = AppState.mergedData.reduce((sum, b) => sum + b.totalPenalty, 0);
    const pendingReview = AppState.mergedData.filter(b => b.reviewStatus === 'pending').length;

    document.getElementById('totalBooths').textContent = totalBooths;
    document.getElementById('penalizedBooths').textContent = penalizedBooths;
    document.getElementById('totalPenalty').textContent = `¥${totalPenalty.toFixed(2)}`;
    document.getElementById('pendingReview').textContent = pendingReview;
}

// 初始化图表
function initCharts() {
    const ctx1 = document.getElementById('penaltyReasonChart').getContext('2d');
    AppState.charts.penaltyReason = new Chart(ctx1, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    const ctx2 = document.getElementById('penaltyAmountChart').getContext('2d');
    AppState.charts.penaltyAmount = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '扣罚金额',
                data: [],
                backgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    const ctx3 = document.getElementById('penaltySeverityChart').getContext('2d');
    AppState.charts.penaltySeverity = new Chart(ctx3, {
        type: 'doughnut',
        data: {
            labels: ['高', '中', '低'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#ef4444', '#f97316', '#22c55e']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    const ctx4 = document.getElementById('materialReturnChart').getContext('2d');
    AppState.charts.materialReturn = new Chart(ctx4, {
        type: 'bar',
        data: {
            labels: ['已归还', '部分归还', '未归还'],
            datasets: [{
                label: '物料数量',
                data: [0, 0, 0],
                backgroundColor: ['#22c55e', '#f97316', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 更新图表
function updateCharts() {
    if (AppState.mergedData.length === 0) return;

    // 扣罚原因分布
    const reasonCounts = {};
    AppState.mergedData.forEach(booth => {
        booth.penaltyReasons.forEach(reason => {
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });
    });
    
    AppState.charts.penaltyReason.data.labels = Object.keys(reasonCounts);
    AppState.charts.penaltyReason.data.datasets[0].data = Object.values(reasonCounts);
    AppState.charts.penaltyReason.update();

    // 扣罚金额分布（前10个展位）
    const topBooths = AppState.mergedData
        .filter(b => b.hasPenalty)
        .sort((a, b) => b.totalPenalty - a.totalPenalty)
        .slice(0, 10);
    
    AppState.charts.penaltyAmount.data.labels = topBooths.map(b => b.boothNumber);
    AppState.charts.penaltyAmount.data.datasets[0].data = topBooths.map(b => b.totalPenalty);
    AppState.charts.penaltyAmount.update();

    // 严重程度分布
    const highCount = AppState.mergedData.filter(b => b.severity === 'high').length;
    const mediumCount = AppState.mergedData.filter(b => b.severity === 'medium').length;
    const lowCount = AppState.mergedData.filter(b => b.severity === 'low').length;
    
    AppState.charts.penaltySeverity.data.datasets[0].data = [highCount, mediumCount, lowCount];
    AppState.charts.penaltySeverity.update();

    // 物料归还情况
    let returned = 0, partial = 0, notReturned = 0;
    AppState.mergedData.forEach(booth => {
        booth.materials.forEach(material => {
            if (material.status === 'returned') returned++;
            else if (material.status === 'partial') partial++;
            else notReturned++;
        });
    });
    
    AppState.charts.materialReturn.data.datasets[0].data = [returned, partial, notReturned];
    AppState.charts.materialReturn.update();
}

// 更新展位明细表格
function updateBoothDetailsTable() {
    const tableBody = document.getElementById('boothDetailsTableBody');
    tableBody.innerHTML = '';

    let filteredData = [...AppState.mergedData];

    // 应用筛选
    if (AppState.filters.boothNumber) {
        filteredData = filteredData.filter(b => 
            b.boothNumber.toLowerCase().includes(AppState.filters.boothNumber.toLowerCase())
        );
    }
    if (AppState.filters.penaltyReason) {
        filteredData = filteredData.filter(b => 
            b.penaltyReasons.includes(AppState.filters.penaltyReason)
        );
    }
    if (AppState.filters.severity) {
        filteredData = filteredData.filter(b => b.severity === AppState.filters.severity);
    }
    if (AppState.filters.reviewStatus) {
        filteredData = filteredData.filter(b => b.reviewStatus === AppState.filters.reviewStatus);
    }

    // 分页
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / AppState.pageSize);
    const startIndex = (AppState.currentPage - 1) * AppState.pageSize;
    const endIndex = Math.min(startIndex + AppState.pageSize, totalItems);
    const pageData = filteredData.slice(startIndex, endIndex);

    // 更新分页信息
    document.getElementById('currentStart').textContent = totalItems > 0 ? startIndex + 1 : 0;
    document.getElementById('currentEnd').textContent = endIndex;
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('pageIndicator').textContent = `第 ${AppState.currentPage} 页 / 共 ${totalPages || 1} 页`;

    // 更新分页按钮状态
    document.getElementById('prevPageBtn').disabled = AppState.currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = AppState.currentPage >= totalPages;

    // 渲染表格
    pageData.forEach(booth => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${booth.boothNumber}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${booth.penaltyReasons.join(', ') || '无'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥${booth.totalPenalty.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-${booth.severity}">
                    ${getSeverityText(booth.severity)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${booth.photos ? booth.photos.length : 0} 张
                ${booth.photoStatus === 'insufficient' ? '<span class="text-red-600">(不足)</span>' : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge ${booth.materialStatus === 'missing' ? 'status-high' : 'status-low'}">
                    ${getMaterialStatusText(booth.materialStatus)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge ${getReviewStatusBadgeClass(booth.reviewStatus)}">
                    ${getReviewStatusText(booth.reviewStatus)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewBoothDetails('${booth.boothNumber}')" class="text-blue-600 hover:text-blue-900 mr-3">查看</button>
                <button onclick="goToReview('${booth.boothNumber}')" class="text-green-600 hover:text-green-900">复核</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 获取严重程度文本
function getSeverityText(severity) {
    const map = {
        'high': '高',
        'medium': '中',
        'low': '低'
    };
    return map[severity] || '未知';
}

// 获取复核状态徽章类
function getReviewStatusBadgeClass(status) {
    const map = {
        'pending': 'status-medium',
        'reviewed': 'status-resolved',
        'resolved': 'status-low'
    };
    return map[status] || 'status-low';
}

// 获取复核状态文本
function getReviewStatusText(status) {
    const map = {
        'pending': '待复核',
        'reviewed': '已复核',
        'resolved': '已处理'
    };
    return map[status] || '未知';
}

// 应用筛选
function applyFilters() {
    AppState.filters = {
        boothNumber: document.getElementById('filterBoothNumber').value,
        penaltyReason: document.getElementById('filterPenaltyReason').value,
        severity: document.getElementById('filterSeverity').value,
        reviewStatus: document.getElementById('filterReviewStatus').value
    };
    AppState.currentPage = 1;
    updateActiveFilters();
    updateBoothDetailsTable();
}

// 清除筛选
function clearFilters() {
    document.getElementById('filterBoothNumber').value = '';
    document.getElementById('filterPenaltyReason').value = '';
    document.getElementById('filterSeverity').value = '';
    document.getElementById('filterReviewStatus').value = '';
    AppState.filters = {};
    AppState.currentPage = 1;
    updateActiveFilters();
    updateBoothDetailsTable();
}

// 更新活跃筛选标签
function updateActiveFilters() {
    const container = document.getElementById('activeFilters');
    container.innerHTML = '';

    const filters = [];
    if (AppState.filters.boothNumber) filters.push({ label: '展位号', value: AppState.filters.boothNumber, key: 'boothNumber' });
    if (AppState.filters.penaltyReason) filters.push({ label: '扣罚原因', value: AppState.filters.penaltyReason, key: 'penaltyReason' });
    if (AppState.filters.severity) filters.push({ label: '严重程度', value: getSeverityText(AppState.filters.severity), key: 'severity' });
    if (AppState.filters.reviewStatus) filters.push({ label: '复核状态', value: getReviewStatusText(AppState.filters.reviewStatus), key: 'reviewStatus' });

    filters.forEach(filter => {
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        tag.innerHTML = `${filter.label}: ${filter.value} <button onclick="removeFilter('${filter.key}')">×</button>`;
        container.appendChild(tag);
    });
}

// 移除筛选
function removeFilter(key) {
    AppState.filters[key] = '';
    document.getElementById(`filter${key.charAt(0).toUpperCase() + key.slice(1)}`).value = '';
    updateActiveFilters();
    updateBoothDetailsTable();
}

// 分页
function goToPrevPage() {
    if (AppState.currentPage > 1) {
        AppState.currentPage--;
        updateBoothDetailsTable();
    }
}

function goToNextPage() {
    const filteredData = getFilteredData();
    const totalPages = Math.ceil(filteredData.length / AppState.pageSize);
    if (AppState.currentPage < totalPages) {
        AppState.currentPage++;
        updateBoothDetailsTable();
    }
}

// 获取筛选后的数据
function getFilteredData() {
    let filteredData = [...AppState.mergedData];
    if (AppState.filters.boothNumber) {
        filteredData = filteredData.filter(b => 
            b.boothNumber.toLowerCase().includes(AppState.filters.boothNumber.toLowerCase())
        );
    }
    if (AppState.filters.penaltyReason) {
        filteredData = filteredData.filter(b => 
            b.penaltyReasons.includes(AppState.filters.penaltyReason)
        );
    }
    if (AppState.filters.severity) {
        filteredData = filteredData.filter(b => b.severity === AppState.filters.severity);
    }
    if (AppState.filters.reviewStatus) {
        filteredData = filteredData.filter(b => b.reviewStatus === AppState.filters.reviewStatus);
    }
    return filteredData;
}

// 切换标签页
function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-content-${tabName}`).classList.add('active');
}

// 查看展位详情
function viewBoothDetails(boothNumber) {
    const booth = AppState.mergedData.find(b => b.boothNumber === boothNumber);
    if (!booth) return;

    const modal = document.getElementById('boothModal');
    const title = document.getElementById('modalBoothTitle');
    const content = document.getElementById('modalContent');

    title.textContent = `展位 ${boothNumber} 详情`;

    content.innerHTML = `
        <div class="grid grid-cols-2 gap-6">
            <div>
                <h4 class="font-medium text-gray-800 mb-2">基本信息</h4>
                <div class="space-y-2 text-sm">
                    <p><span class="text-gray-600">展位号：</span>${booth.boothNumber}</p>
                    <p><span class="text-gray-600">验收状态：</span>${booth.acceptance.status}</p>
                    <p><span class="text-gray-600">扣罚金额：</span><span class="text-red-600">¥${booth.totalPenalty.toFixed(2)}</span></p>
                    <p><span class="text-gray-600">严重程度：</span>
                        <span class="status-badge status-${booth.severity}">${getSeverityText(booth.severity)}</span>
                    </p>
                </div>
            </div>
            <div>
                <h4 class="font-medium text-gray-800 mb-2">扣罚原因</h4>
                <div class="space-y-2 text-sm">
                    ${booth.penalties.length > 0 ? 
                        booth.penalties.map(p => `
                            <div class="p-2 bg-gray-50 rounded">
                                <p class="font-medium">${p.reason}</p>
                                <p class="text-gray-600">金额：¥${p.amount.toFixed(2)}</p>
                                ${p.time ? `<p class="text-gray-500">时间：${p.time}</p>` : ''}
                                ${p.description ? `<p class="text-gray-500">说明：${p.description}</p>` : ''}
                            </div>
                        `).join('') :
                        '<p class="text-gray-500">无扣罚记录</p>'
                    }
                </div>
            </div>
        </div>

        <div>
            <h4 class="font-medium text-gray-800 mb-2">物料借出归还情况</h4>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">物料名称</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">借出数量</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">归还数量</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${booth.materials.length > 0 ? 
                            booth.materials.map(m => `
                                <tr>
                                    <td class="px-4 py-2 text-sm text-gray-900">${m.name}</td>
                                    <td class="px-4 py-2 text-sm text-gray-500">${m.borrowed}</td>
                                    <td class="px-4 py-2 text-sm text-gray-500">${m.returned}</td>
                                    <td class="px-4 py-2 text-sm">
                                        <span class="status-badge ${m.status === 'returned' ? 'status-low' : m.status === 'partial' ? 'status-medium' : 'status-high'}">
                                            ${m.status === 'returned' ? '已归还' : m.status === 'partial' ? '部分归还' : '未归还'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('') :
                            '<tr><td colspan="4" class="px-4 py-2 text-sm text-gray-500 text-center">无物料记录</td></tr>'
                        }
                    </tbody>
                </table>
            </div>
        </div>

        <div>
            <h4 class="font-medium text-gray-800 mb-2">现场照片标注</h4>
            <div class="space-y-2">
                ${booth.photos.length > 0 ? 
                    booth.photos.map(p => `
                        <div class="p-3 bg-gray-50 rounded">
                            <p class="font-medium">${p.id || '未命名照片'}</p>
                            ${p.annotation ? `<p class="text-gray-600">标注：${p.annotation}</p>` : ''}
                            ${p.time ? `<p class="text-gray-500 text-sm">拍摄时间：${p.time}</p>` : ''}
                        </div>
                    `).join('') :
                    '<p class="text-gray-500">无照片记录</p>'
                }
            </div>
        </div>

        ${AppState.reviews[boothNumber] ? `
        <div>
            <h4 class="font-medium text-gray-800 mb-2">复核记录</h4>
            <div class="p-4 bg-blue-50 rounded">
                <p><span class="text-gray-600">状态：</span>
                    <span class="status-badge ${getReviewStatusBadgeClass(AppState.reviews[boothNumber].status)}">
                        ${getReviewStatusText(AppState.reviews[boothNumber].status)}
                    </span>
                </p>
                ${AppState.reviews[boothNumber].notes ? `<p class="mt-2"><span class="text-gray-600">备注：</span>${AppState.reviews[boothNumber].notes}</p>` : ''}
                ${AppState.reviews[boothNumber].appealSuggestion ? `<p class="mt-2"><span class="text-gray-600">申诉建议：</span>${AppState.reviews[boothNumber].appealSuggestion}</p>` : ''}
            </div>
        </div>
        ` : ''}
    `;

    modal.classList.remove('hidden');
}

// 关闭模态框
function closeModal() {
    document.getElementById('boothModal').classList.add('hidden');
}

// 跳转到复核页面
function goToReview(boothNumber) {
    switchTab('review');
    document.getElementById('reviewBoothSelect').value = boothNumber;
    loadBoothReviewDetails(boothNumber);
}

// 更新复核展位选择
function updateReviewBoothSelect() {
    const select = document.getElementById('reviewBoothSelect');
    select.innerHTML = '<option value="">请选择展位</option>';
    
    AppState.mergedData.forEach(booth => {
        const option = document.createElement('option');
        option.value = booth.boothNumber;
        option.textContent = `${booth.boothNumber}${booth.hasPenalty ? ' (有扣罚)' : ''}`;
        select.appendChild(option);
    });
}

// 加载展位复核详情
function loadBoothReviewDetails(boothNumber) {
    const detailsSection = document.getElementById('boothReviewDetails');
    if (!boothNumber) {
        detailsSection.classList.add('hidden');
        return;
    }

    const booth = AppState.mergedData.find(b => b.boothNumber === boothNumber);
    if (!booth) {
        detailsSection.classList.add('hidden');
        return;
    }

    detailsSection.classList.remove('hidden');

    // 基本信息
    document.getElementById('reviewBoothNumber').textContent = booth.boothNumber;
    document.getElementById('reviewAcceptanceStatus').textContent = booth.acceptance.status;
    document.getElementById('reviewPenaltyAmount').textContent = `¥${booth.totalPenalty.toFixed(2)}`;
    document.getElementById('reviewSeverity').innerHTML = `
        <span class="status-badge status-${booth.severity}">${getSeverityText(booth.severity)}</span>
    `;

    // 扣罚详情
    const penaltyDetails = document.getElementById('reviewPenaltyDetails');
    if (booth.penalties.length > 0) {
        penaltyDetails.innerHTML = booth.penalties.map(p => `
            <div class="p-3 bg-gray-50 rounded">
                <p class="font-medium">${p.reason}</p>
                <p class="text-gray-600">金额：¥${p.amount.toFixed(2)}</p>
                ${p.time ? `<p class="text-gray-500 text-sm">时间：${p.time}</p>` : ''}
                ${p.description ? `<p class="text-gray-500 text-sm">说明：${p.description}</p>` : ''}
            </div>
        `).join('');
    } else {
        penaltyDetails.innerHTML = '<p class="text-gray-500">暂无扣罚记录</p>';
    }

    // 物料详情
    const materialDetails = document.getElementById('reviewMaterialDetails');
    if (booth.materials.length > 0) {
        materialDetails.innerHTML = booth.materials.map(m => `
            <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span>${m.name}</span>
            <span class="text-sm">
                借出: ${m.borrowed} | 归还: ${m.returned}
                <span class="status-badge ${m.status === 'returned' ? 'status-low' : m.status === 'partial' ? 'status-medium' : 'status-high'} ml-2">
                    ${m.status === 'returned' ? '已归还' : m.status === 'partial' ? '部分归还' : '未归还'}
                </span>
            </span>
        </div>
        `).join('');
    } else {
        materialDetails.innerHTML = '<p class="text-gray-500">暂无物料记录</p>';
    }

    // 照片详情
    const photoDetails = document.getElementById('reviewPhotoDetails');
    if (booth.photos.length > 0) {
        photoDetails.innerHTML = booth.photos.map(p => `
            <div class="p-2 bg-gray-50 rounded">
                <p class="font-medium">${p.id || '未命名照片'}</p>
                ${p.annotation ? `<p class="text-gray-600 text-sm">标注：${p.annotation}</p>` : ''}
                ${p.time ? `<p class="text-gray-500 text-xs">拍摄时间：${p.time}</p>` : ''}
            </div>
        `).join('');
    } else {
        photoDetails.innerHTML = '<p class="text-gray-500">暂无照片记录</p>';
    }

    // 加载现有复核记录
    const existingReview = AppState.reviews[boothNumber];
    if (existingReview) {
        document.getElementById('reviewStatusSelect').value = existingReview.status;
        document.getElementById('reviewNotes').value = existingReview.notes || '';
        document.getElementById('reviewAppealSuggestion').value = existingReview.appealSuggestion || '';
    } else {
        document.getElementById('reviewStatusSelect').value = 'pending';
        document.getElementById('reviewNotes').value = '';
        document.getElementById('reviewAppealSuggestion').value = '';
    }

    // 加载历史记录
    updateReviewHistory(boothNumber);
}

// 更新复核历史记录
function updateReviewHistory(boothNumber) {
    const historyContainer = document.getElementById('reviewHistory');
    const history = AppState.reviews[boothNumber]?.history || [];
    
    if (history.length === 0) {
        historyContainer.innerHTML = '<p class="text-gray-500">暂无历史记录</p>';
        return;
    }

    historyContainer.innerHTML = history.map(record => `
        <div class="p-3 bg-gray-50 rounded">
            <div class="flex justify-between items-center mb-2">
                <span class="status-badge ${getReviewStatusBadgeClass(record.status)}">
                    ${getReviewStatusText(record.status)}
                </span>
                <span class="text-sm text-gray-500">${new Date(record.timestamp).toLocaleString()}</span>
            </div>
            ${record.notes ? `<p class="text-sm text-gray-600">备注：${record.notes}</p>` : ''}
            ${record.appealSuggestion ? `<p class="text-sm text-gray-600">申诉建议：${record.appealSuggestion}</p>` : ''}
        </div>
    `).join('');
}

// 保存复核
function saveReview() {
    const boothNumber = document.getElementById('reviewBoothSelect').value;
    if (!boothNumber) {
        alert('请先选择展位');
        return;
    }

    const status = document.getElementById('reviewStatusSelect').value;
    const notes = document.getElementById('reviewNotes').value;
    const appealSuggestion = document.getElementById('reviewAppealSuggestion').value;

    // 创建或更新复核记录
    if (!AppState.reviews[boothNumber]) {
        AppState.reviews[boothNumber] = {
            status: status,
            notes: notes,
            appealSuggestion: appealSuggestion,
            history: []
        };
    } else {
        // 保存历史记录
        AppState.reviews[boothNumber].history.push({
            status: AppState.reviews[boothNumber].status,
            notes: AppState.reviews[boothNumber].notes,
            appealSuggestion: AppState.reviews[boothNumber].appealSuggestion,
            timestamp: new Date().toISOString()
        });

        // 更新当前状态
        AppState.reviews[boothNumber].status = status;
        AppState.reviews[boothNumber].notes = notes;
        AppState.reviews[boothNumber].appealSuggestion = appealSuggestion;
    }

    // 更新合并数据中的状态
    const booth = AppState.mergedData.find(b => b.boothNumber === boothNumber);
    if (booth) {
        booth.reviewStatus = status;
    }

    // 保存到本地存储
    saveToLocalStorage(STORAGE_KEYS.REVIEWS, AppState.reviews);
    saveToLocalStorage(STORAGE_KEYS.MERGED_DATA, AppState.mergedData);

    // 更新UI
    updateSummaryCards();
    updateBoothDetailsTable();
    updateReviewHistory(boothNumber);

    alert('复核记录已保存');
}

// 导出Markdown
function exportMarkdown() {
    if (AppState.mergedData.length === 0) {
        alert('没有数据可导出');
        return;
    }

    // 只导出有扣罚的展位
    const penalizedBooths = AppState.mergedData.filter(b => b.hasPenalty);
    
    if (penalizedBooths.length === 0) {
        alert('没有扣罚记录可导出');
        return;
    }

    let markdown = `# 会展扣罚申诉清单\n\n`;
    markdown += `**生成时间：${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    penalizedBooths.forEach(booth => {
        markdown += `## 展位 ${booth.boothNumber}\n\n`;
        markdown += `**扣罚金额**：¥${booth.totalPenalty.toFixed(2)}\n\n`;
        markdown += `**严重程度**：${getSeverityText(booth.severity)}\n\n`;
        markdown += `**复核状态**：${getReviewStatusText(booth.reviewStatus)}\n\n`;

        if (booth.penalties.length > 0) {
            markdown += `**扣罚详情**：\n\n`;
            booth.penalties.forEach(p => {
                markdown += `- **${p.reason}**：¥${p.amount.toFixed(2)}\n`;
                if (p.description) markdown += `  - 说明：${p.description}\n`;
            });
            markdown += `\n`;
        }

        // 复核记录
        const review = AppState.reviews[booth.boothNumber];
        if (review) {
            if (review.notes) {
                markdown += `**复核备注**：${review.notes}\n\n`;
            }
            if (review.appealSuggestion) {
                markdown += `**申诉建议**：${review.appealSuggestion}\n\n`;
            }
        }

        markdown += `---\n\n`;
    });

    // 统计信息
    markdown += `## 统计信息\n\n`;
    markdown += `- 总扣罚展位数：${penalizedBooths.length}\n`;
    markdown += `- 总扣罚金额：¥${penalizedBooths.reduce((sum, b) => sum + b.totalPenalty, 0).toFixed(2)}\n`;
    markdown += `- 待复核展位数：${penalizedBooths.filter(b => b.reviewStatus === 'pending').length}\n`;

    downloadFile(markdown, '扣罚申诉清单.md', 'text/markdown');
}

// 导出JSON
function exportJson() {
    if (AppState.mergedData.length === 0) {
        alert('没有数据可导出');
        return;
    }

    const exportData = {
        exportTime: new Date().toISOString(),
        booths: AppState.mergedData.map(booth => ({
        boothNumber: booth.boothNumber,
        acceptance: booth.acceptance,
        penalties: booth.penalties,
        totalPenalty: booth.totalPenalty,
        severity: booth.severity,
        materials: booth.materials,
        photos: booth.photos,
        review: AppState.reviews[booth.boothNumber] || null
    })),
    statistics: {
        totalBooths: AppState.mergedData.length,
        penalizedBooths: AppState.mergedData.filter(b => b.hasPenalty).length,
        totalPenalty: AppState.mergedData.reduce((sum, b) => sum + b.totalPenalty, 0),
        pendingReview: AppState.mergedData.filter(b => b.reviewStatus === 'pending').length
    }
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    downloadFile(jsonContent, '会展数据分析.json', 'application/json');
}

// 下载文件
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 清除所有数据
function clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复。')) {
        return;
    }

    // 清除状态
    AppState.acceptanceData = [];
    AppState.materialData = [];
    AppState.photoData = [];
    AppState.penaltyData = [];
    AppState.mergedData = [];
    AppState.reviews = {};
    AppState.currentPage = 1;
    AppState.filters = {};

    // 清除本地存储
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });

    // 重置UI
    document.querySelectorAll('.file-info').forEach(el => el.textContent = '');
    document.getElementById('dataPreview').classList.add('hidden');
    document.getElementById('boothReviewDetails').classList.add('hidden');
    
    updateSummaryCards();
    updateCharts();
    updateBoothDetailsTable();
    updateReviewBoothSelect();

    alert('所有数据已清除');
}

// 本地存储辅助函数
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('保存到本地存储失败:', e);
    }
}

function loadFromLocalStorage() {
    try {
        const acceptanceData = localStorage.getItem(STORAGE_KEYS.ACCEPTANCE_DATA);
        const materialData = localStorage.getItem(STORAGE_KEYS.MATERIAL_DATA);
        const photoData = localStorage.getItem(STORAGE_KEYS.PHOTO_DATA);
        const penaltyData = localStorage.getItem(STORAGE_KEYS.PENALTY_DATA);
        const reviews = localStorage.getItem(STORAGE_KEYS.REVIEWS);
        const mergedData = localStorage.getItem(STORAGE_KEYS.MERGED_DATA);

        if (acceptanceData) AppState.acceptanceData = JSON.parse(acceptanceData);
        if (materialData) AppState.materialData = JSON.parse(materialData);
        if (photoData) AppState.photoData = JSON.parse(photoData);
        if (penaltyData) AppState.penaltyData = JSON.parse(penaltyData);
        if (reviews) AppState.reviews = JSON.parse(reviews);
        if (mergedData) AppState.mergedData = JSON.parse(mergedData);
    } catch (e) {
        console.error('从本地存储加载失败:', e);
    }
}

// 更新UI
function updateUI() {
    if (AppState.mergedData.length > 0) {
        updateDataPreview();
        updateSummaryCards();
        updateCharts();
        updateBoothDetailsTable();
        updateReviewBoothSelect();
    }
}
