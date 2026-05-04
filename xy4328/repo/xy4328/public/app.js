const API_BASE = '';

let recallData = [];
let selectedRecallItems = new Set();

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}/api${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return await response.json();
    } catch (error) {
        showToast('网络错误: ' + error.message, 'error');
        throw error;
    }
}

async function loadStats() {
    const result = await fetchAPI('/stats');
    if (result.success) {
        const data = result.data;
        document.getElementById('totalPackages').textContent = data.totalPackages;
        document.getElementById('totalCycles').textContent = data.totalCycles;
        document.getElementById('qualifiedCycles').textContent = data.qualifiedCycles;
        document.getElementById('releasedPackages').textContent = data.releasedPackages;
        document.getElementById('distributedPackages').textContent = data.distributedPackages;
        document.getElementById('abnormalCount').textContent = data.abnormalCount;
    }
}

async function refreshPackages() {
    const barcode = document.getElementById('searchBarcode').value;
    const department = document.getElementById('searchDepartment').value;
    const status = document.getElementById('searchStatus').value;

    let url = '/packages';
    const params = [];
    if (barcode) params.push(`barcode=${encodeURIComponent(barcode)}`);
    if (department) params.push(`department=${encodeURIComponent(department)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (params.length > 0) url += '?' + params.join('&');

    const result = await fetchAPI(url);
    if (result.success) {
        renderPackagesTable(result.data);
    }
    loadStats();
}

function searchPackages() {
    refreshPackages();
}

function clearSearch() {
    document.getElementById('searchBarcode').value = '';
    document.getElementById('searchDepartment').value = '';
    document.getElementById('searchStatus').value = '';
    refreshPackages();
}

function renderPackagesTable(packages) {
    const tbody = document.getElementById('packagesTableBody');
    
    if (packages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = packages.map(pkg => {
        const rowClass = pkg.computed_status === '异常' ? 'abnormal-row' : '';
        const issuesHtml = pkg.issues && pkg.issues.length > 0 
            ? `<div class="issues-list">${pkg.issues.join('、')}</div>` 
            : '';
        
        return `
            <tr class="${rowClass}">
                <td>${pkg.barcode}</td>
                <td>${pkg.package_name}</td>
                <td>${pkg.cycle_number}</td>
                <td>${pkg.valid_until}</td>
                <td>
                    <span class="status-badge ${pkg.computed_status}">${pkg.computed_status}</span>
                    ${issuesHtml}
                </td>
                <td>${pkg.release_time || '-'}</td>
                <td>${pkg.department || '-'}</td>
                <td>
                    <div class="action-buttons">
                        ${pkg.computed_status === '待放行' && pkg.cycle_qualified === 1 ? 
                            `<button class="btn btn-success btn-sm" onclick="releasePackage(${pkg.id})">放行</button>` : ''}
                        <button class="btn btn-primary btn-sm" onclick="editPackage(${pkg.id}, '${pkg.barcode}', '${pkg.package_name}', '${pkg.cycle_number}', '${pkg.valid_until}')">编辑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function refreshCycles() {
    const result = await fetchAPI('/cycles');
    if (result.success) {
        renderCyclesTable(result.data);
    }
    loadStats();
}

function renderCyclesTable(cycles) {
    const tbody = document.getElementById('cyclesTableBody');
    
    if (cycles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = cycles.map(cycle => {
        const qualifiedClass = cycle.is_qualified ? 'status-badge 已放行' : 'status-badge 异常';
        const qualifiedText = cycle.is_qualified ? '合格' : '不合格';
        
        return `
            <tr>
                <td>${cycle.cycle_number}</td>
                <td>${cycle.sterilization_date}</td>
                <td>${cycle.physical_monitor || '-'}</td>
                <td>${cycle.chemical_monitor || '-'}</td>
                <td>${cycle.biological_monitor || '-'}</td>
                <td><span class="${qualifiedClass}">${qualifiedText}</span></td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editCycle(${cycle.id}, '${cycle.cycle_number}', '${cycle.sterilization_date}', '${cycle.physical_monitor || ''}', '${cycle.chemical_monitor || ''}', '${cycle.biological_monitor || ''}')">编辑</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function refreshDistributions() {
    const result = await fetchAPI('/distributions');
    if (result.success) {
        renderDistributionsTable(result.data);
    }
    loadStats();
}

function renderDistributionsTable(distributions) {
    const tbody = document.getElementById('distributionsTableBody');
    
    if (distributions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = distributions.map(dist => `
        <tr>
            <td>${dist.package_barcode}</td>
            <td>${dist.package_name}</td>
            <td>${dist.cycle_number}</td>
            <td>${dist.department}</td>
            <td>${dist.receiver || '-'}</td>
            <td>${dist.distribution_time}</td>
        </tr>
    `).join('');
}

function showAddPackageModal() {
    document.getElementById('packageModalTitle').textContent = '新增器械包';
    document.getElementById('packageId').value = '';
    document.getElementById('packageBarcode').value = '';
    document.getElementById('packageName').value = '';
    document.getElementById('packageCycleNumber').value = '';
    document.getElementById('packageValidUntil').value = '';
    document.getElementById('packageModal').classList.add('active');
}

function editPackage(id, barcode, packageName, cycleNumber, validUntil) {
    document.getElementById('packageModalTitle').textContent = '编辑器械包';
    document.getElementById('packageId').value = id;
    document.getElementById('packageBarcode').value = barcode;
    document.getElementById('packageName').value = packageName;
    document.getElementById('packageCycleNumber').value = cycleNumber;
    document.getElementById('packageValidUntil').value = validUntil;
    document.getElementById('packageModal').classList.add('active');
}

function closePackageModal() {
    document.getElementById('packageModal').classList.remove('active');
}

async function savePackage() {
    const id = document.getElementById('packageId').value;
    const data = {
        barcode: document.getElementById('packageBarcode').value.trim(),
        package_name: document.getElementById('packageName').value.trim(),
        cycle_number: document.getElementById('packageCycleNumber').value.trim(),
        valid_until: document.getElementById('packageValidUntil').value
    };

    if (!data.barcode || !data.package_name || !data.cycle_number || !data.valid_until) {
        showToast('请填写所有必填项', 'error');
        return;
    }

    let result;
    if (id) {
        result = await fetchAPI(`/packages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    } else {
        result = await fetchAPI('/packages', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    if (result.success) {
        showToast(result.message, 'success');
        closePackageModal();
        refreshPackages();
    } else {
        showToast(result.message, 'error');
    }
}

async function releasePackage(id) {
    if (!confirm('确定要放行该器械包吗？')) return;

    const result = await fetchAPI(`/packages/${id}/release`, {
        method: 'POST'
    });

    if (result.success) {
        showToast(result.message, 'success');
        refreshPackages();
    } else {
        showToast(result.message, 'error');
    }
}

function showAddCycleModal() {
    document.getElementById('cycleModalTitle').textContent = '新增锅次';
    document.getElementById('cycleId').value = '';
    document.getElementById('cycleNumber').value = '';
    document.getElementById('cycleDate').value = '';
    document.getElementById('cyclePhysical').value = '';
    document.getElementById('cycleChemical').value = '';
    document.getElementById('cycleBiological').value = '';
    document.getElementById('cycleModal').classList.add('active');
}

function editCycle(id, cycleNumber, sterilizationDate, physical, chemical, biological) {
    document.getElementById('cycleModalTitle').textContent = '编辑锅次';
    document.getElementById('cycleId').value = id;
    document.getElementById('cycleNumber').value = cycleNumber;
    document.getElementById('cycleDate').value = sterilizationDate;
    document.getElementById('cyclePhysical').value = physical || '';
    document.getElementById('cycleChemical').value = chemical || '';
    document.getElementById('cycleBiological').value = biological || '';
    document.getElementById('cycleModal').classList.add('active');
}

function closeCycleModal() {
    document.getElementById('cycleModal').classList.remove('active');
}

async function saveCycle() {
    const id = document.getElementById('cycleId').value;
    const data = {
        cycle_number: document.getElementById('cycleNumber').value.trim(),
        sterilization_date: document.getElementById('cycleDate').value,
        physical_monitor: document.getElementById('cyclePhysical').value,
        chemical_monitor: document.getElementById('cycleChemical').value,
        biological_monitor: document.getElementById('cycleBiological').value
    };

    if (!data.cycle_number || !data.sterilization_date) {
        showToast('请填写所有必填项', 'error');
        return;
    }

    let result;
    if (id) {
        result = await fetchAPI(`/cycles/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    } else {
        result = await fetchAPI('/cycles', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeCycleModal();
        refreshCycles();
    } else {
        showToast(result.message, 'error');
    }
}

function showAddDistributionModal() {
    document.getElementById('distributionBarcode').value = '';
    document.getElementById('distributionDepartment').value = '';
    document.getElementById('distributionReceiver').value = '';
    document.getElementById('distributionTime').value = '';
    document.getElementById('distributionModal').classList.add('active');
}

function closeDistributionModal() {
    document.getElementById('distributionModal').classList.remove('active');
}

async function saveDistribution() {
    let distributionTime = document.getElementById('distributionTime').value;
    if (distributionTime) {
        distributionTime = distributionTime.replace('T', ' ') + ':00';
    }

    const data = {
        package_barcode: document.getElementById('distributionBarcode').value.trim(),
        department: document.getElementById('distributionDepartment').value.trim(),
        receiver: document.getElementById('distributionReceiver').value.trim(),
        distribution_time: distributionTime || null
    };

    if (!data.package_barcode || !data.department) {
        showToast('请填写所有必填项', 'error');
        return;
    }

    const result = await fetchAPI('/distributions', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.success) {
        showToast(result.message, 'success');
        closeDistributionModal();
        refreshDistributions();
    } else {
        showToast(result.message, 'error');
    }
}

async function importCycles() {
    const fileInput = document.getElementById('cyclesFile');
    if (!fileInput.files[0]) {
        showToast('请选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch(`${API_BASE}/api/import/cycles`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        showImportResult(result);
        if (result.success) {
            showToast(result.message, 'success');
            refreshCycles();
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

async function importPackages() {
    const fileInput = document.getElementById('packagesFile');
    if (!fileInput.files[0]) {
        showToast('请选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch(`${API_BASE}/api/import/packages`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        showImportResult(result);
        if (result.success) {
            showToast(result.message, 'success');
            refreshPackages();
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

async function importDistributions() {
    const fileInput = document.getElementById('distributionsFile');
    if (!fileInput.files[0]) {
        showToast('请选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch(`${API_BASE}/api/import/distributions`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        showImportResult(result);
        if (result.success) {
            showToast(result.message, 'success');
            refreshDistributions();
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

function showImportResult(result) {
    const resultDiv = document.getElementById('importResult');
    const contentDiv = document.getElementById('importResultContent');
    
    let html = `<p class="import-success">成功导入: ${result.imported || 0} 条</p>`;
    
    if (result.errors && result.errors.length > 0) {
        html += `<p class="import-error">错误 (${result.errors.length} 条):</p>`;
        html += '<ul>';
        result.errors.forEach(err => {
            html += `<li class="import-error">${err}</li>`;
        });
        html += '</ul>';
    }
    
    contentDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
}

async function searchRecall() {
    const cycleNumber = document.getElementById('recallCycleNumber').value;
    const department = document.getElementById('recallDepartment').value;
    const startDate = document.getElementById('recallStartDate').value;
    const endDate = document.getElementById('recallEndDate').value;

    let url = '/recall';
    const params = [];
    if (cycleNumber) params.push(`cycle_number=${encodeURIComponent(cycleNumber)}`);
    if (department) params.push(`department=${encodeURIComponent(department)}`);
    if (startDate) params.push(`start_date=${encodeURIComponent(startDate)}`);
    if (endDate) params.push(`end_date=${encodeURIComponent(endDate)}`);
    if (params.length > 0) url += '?' + params.join('&');

    const result = await fetchAPI(url);
    if (result.success) {
        recallData = result.data;
        selectedRecallItems.clear();
        renderRecallTable(result.data);
    }
}

function renderRecallTable(items) {
    const tbody = document.getElementById('recallTableBody');
    selectedRecallItems.clear();
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = items.map((item, index) => {
        const rowClass = item.is_abnormal ? 'abnormal-row' : '';
        const issuesHtml = item.issues && item.issues.length > 0 ? item.issues.join('、') : '-';
        
        return `
            <tr class="${rowClass}">
                <td><input type="checkbox" class="recall-checkbox" data-index="${index}" onchange="toggleRecallItem(${index})"></td>
                <td>${item.barcode}</td>
                <td>${item.package_name}</td>
                <td>${item.cycle_number}</td>
                <td><span class="status-badge ${item.computed_status}">${item.computed_status}</span></td>
                <td>${issuesHtml}</td>
                <td>${item.department || '-'}</td>
                <td>${item.receiver || '-'}</td>
                <td>${item.distribution_time || '-'}</td>
            </tr>
        `;
    }).join('');
}

function toggleRecallItem(index) {
    if (selectedRecallItems.has(index)) {
        selectedRecallItems.delete(index);
    } else {
        selectedRecallItems.add(index);
    }
}

function toggleSelectAllRecall() {
    const selectAll = document.getElementById('selectAllRecall').checked;
    const checkboxes = document.querySelectorAll('.recall-checkbox');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        const index = parseInt(cb.dataset.index);
        if (selectAll) {
            selectedRecallItems.add(index);
        } else {
            selectedRecallItems.delete(index);
        }
    });
}

function exportRecallCSV() {
    const itemsToExport = Array.from(selectedRecallItems).map(i => recallData[i]);
    
    if (itemsToExport.length === 0) {
        if (recallData.length === 0) {
            showToast('请先查询数据', 'error');
            return;
        }
        if (!confirm('未选择任何项，将导出当前查询的所有数据。是否继续？')) {
            return;
        }
        exportDataToCSV(recallData);
    } else {
        exportDataToCSV(itemsToExport);
    }
}

function exportDataToCSV(data) {
    if (data.length === 0) {
        showToast('没有数据可导出', 'error');
        return;
    }

    const headers = ['条码', '包名称', '锅次号', '状态', '异常原因', '科室', '领用人', '领用时间', '有效期'];
    const rows = data.map(item => [
        item.barcode,
        item.package_name,
        item.cycle_number,
        item.computed_status,
        item.issues ? item.issues.join('; ') : '',
        item.department || '',
        item.receiver || '',
        item.distribution_time || '',
        item.valid_until
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `召回清单_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('导出成功', 'success');
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            if (tabId === 'packages') refreshPackages();
            if (tabId === 'cycles') refreshCycles();
            if (tabId === 'distributions') refreshDistributions();
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadStats();
    refreshPackages();
});
