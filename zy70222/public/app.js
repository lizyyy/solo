const API_BASE = '';
let currentTab = 'exhibits';
let allData = {
    exhibits: [],
    contracts: [],
    insurances: [],
    shipments: [],
    checkpoints: []
};

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    const data = await response.json();
    return { ok: response.ok, data };
}

async function initDemoData() {
    if (!confirm('确定要初始化示例数据吗？这将覆盖所有现有数据。')) {
        return;
    }
    const { ok, data } = await apiRequest(`${API_BASE}/api/init-data`, { method: 'POST' });
    if (ok) {
        showToast('示例数据初始化成功！', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '初始化失败', 'error');
    }
}

async function loadAllData() {
    const [exhibitsRes, contractsRes, insurancesRes, shipmentsRes, checkpointsRes] = await Promise.all([
        apiRequest(`${API_BASE}/api/exhibits`),
        apiRequest(`${API_BASE}/api/contracts`),
        apiRequest(`${API_BASE}/api/insurances`),
        apiRequest(`${API_BASE}/api/shipments`),
        apiRequest(`${API_BASE}/api/checkpoints`)
    ]);

    if (exhibitsRes.ok) allData.exhibits = exhibitsRes.data.data;
    if (contractsRes.ok) allData.contracts = contractsRes.data.data;
    if (insurancesRes.ok) allData.insurances = insurancesRes.data.data;
    if (shipmentsRes.ok) allData.shipments = shipmentsRes.data.data;
    if (checkpointsRes.ok) allData.checkpoints = checkpointsRes.data.data;

    renderAllTables();
    updateShipmentFilter();
}

function renderAllTables() {
    renderExhibitsTable();
    renderContractsTable();
    renderInsurancesTable();
    renderShipmentsTable();
    renderCheckpointsTable();
}

function formatMoney(amount) {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('zh-CN').format(Number(amount));
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}

function getStatusLabel(status) {
    const statusMap = {
        'in_stock': { text: '在库', class: 'status-in_stock' },
        'borrowed': { text: '借出', class: 'status-borrowed' },
        'in_transit': { text: '运输中', class: 'status-in_transit' },
        'active': { text: '有效', class: 'status-active' },
        'delivered': { text: '已送达', class: 'status-delivered' },
        'pending': { text: '待确认', class: 'status-pending' },
        'confirmed': { text: '已确认', class: 'status-confirmed' },
        'rejected': { text: '已拒绝', class: 'status-rejected' }
    };
    const info = statusMap[status] || { text: status, class: '' };
    return `<span class="status-badge ${info.class}">${info.text}</span>`;
}

function getExhibitName(id) {
    const exhibit = allData.exhibits.find(e => e.id === id);
    return exhibit ? exhibit.name : id;
}

function getContractNo(id) {
    const contract = allData.contracts.find(c => c.id === id);
    return contract ? contract.contractNo : id;
}

function getShipmentNo(id) {
    const shipment = allData.shipments.find(s => s.id === id);
    return shipment ? shipment.shipmentNo : id;
}

function renderExhibitsTable() {
    const tbody = document.getElementById('exhibitsTable');
    if (!allData.exhibits.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">暂无数据，点击"初始化示例数据"或"新增展品"开始</td></tr>';
        return;
    }
    tbody.innerHTML = allData.exhibits.map(exhibit => `
        <tr>
            <td>${exhibit.exhibitNo}</td>
            <td>${exhibit.name}</td>
            <td>${exhibit.category}</td>
            <td>${exhibit.era}</td>
            <td>${exhibit.location}</td>
            <td>¥${formatMoney(exhibit.value)}</td>
            <td>${getStatusLabel(exhibit.status)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="openExhibitModal('${exhibit.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteExhibit('${exhibit.id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderContractsTable() {
    const tbody = document.getElementById('contractsTable');
    if (!allData.contracts.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">暂无数据</td></tr>';
        return;
    }
    tbody.innerHTML = allData.contracts.map(contract => `
        <tr>
            <td>${contract.contractNo}</td>
            <td>${getExhibitName(contract.exhibitId)}</td>
            <td>${contract.borrowerInstitution}</td>
            <td>${contract.lenderInstitution}</td>
            <td>${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}</td>
            <td>¥${formatMoney(contract.insuranceAmount)}</td>
            <td>${getStatusLabel(contract.status)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="openContractModal('${contract.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteContract('${contract.id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderInsurancesTable() {
    const tbody = document.getElementById('insurancesTable');
    if (!allData.insurances.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">暂无数据</td></tr>';
        return;
    }
    tbody.innerHTML = allData.insurances.map(insurance => `
        <tr>
            <td>${insurance.policyNo}</td>
            <td>${getContractNo(insurance.contractId)}</td>
            <td>${insurance.insuranceCompany}</td>
            <td>${formatDate(insurance.startDate)} ~ ${formatDate(insurance.endDate)}</td>
            <td>¥${formatMoney(insurance.amount)}</td>
            <td>¥${formatMoney(insurance.premium)}</td>
            <td>${getStatusLabel(insurance.status)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="openInsuranceModal('${insurance.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteInsurance('${insurance.id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderShipmentsTable() {
    const tbody = document.getElementById('shipmentsTable');
    if (!allData.shipments.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999;">暂无数据</td></tr>';
        return;
    }
    tbody.innerHTML = allData.shipments.map(shipment => `
        <tr>
            <td>${shipment.shipmentNo}</td>
            <td>${getContractNo(shipment.contractId)}</td>
            <td>${getExhibitName(shipment.exhibitId)}</td>
            <td>${shipment.logisticsCompany}</td>
            <td>${formatDate(shipment.departureDate)}</td>
            <td>${formatDate(shipment.expectedArrivalDate)}</td>
            <td>${getStatusLabel(shipment.status)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="openShipmentModal('${shipment.id}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteShipment('${shipment.id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderCheckpointsTable(filterShipmentId = '') {
    const tbody = document.getElementById('checkpointsTable');
    let checkpoints = allData.checkpoints;
    if (filterShipmentId) {
        checkpoints = checkpoints.filter(c => c.shipmentId === filterShipmentId);
    }
    if (!checkpoints.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#999;">暂无数据</td></tr>';
        return;
    }
    const typeMap = { 'departure': '出库', 'transit': '中转', 'arrival': '入库' };
    const conditionMap = { 'good': '良好', 'damaged': '损坏', 'unknown': '未知' };
    tbody.innerHTML = checkpoints.map(checkpoint => `
        <tr>
            <td>${checkpoint.checkpointNo}</td>
            <td>${getShipmentNo(checkpoint.shipmentId)}</td>
            <td>${typeMap[checkpoint.checkpointType] || checkpoint.checkpointType}</td>
            <td>${checkpoint.checkpointName}</td>
            <td>${checkpoint.operator}</td>
            <td>${formatDateTime(checkpoint.timestamp)}</td>
            <td>${conditionMap[checkpoint.condition] || checkpoint.condition || '-'}</td>
            <td>${getStatusLabel(checkpoint.status)}</td>
            <td>
                <div class="action-buttons">
                    ${checkpoint.status === 'pending' ? `
                        <button class="btn btn-success btn-sm" onclick="confirmCheckpoint('${checkpoint.id}')">确认</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectCheckpoint('${checkpoint.id}')">拒绝</button>
                    ` : ''}
                    <button class="btn btn-primary btn-sm" onclick="viewCheckpointDetail('${checkpoint.id}')">详情</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCheckpoint('${checkpoint.id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateShipmentFilter() {
    const select = document.getElementById('filterShipment');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">全部运输批次</option>' + 
        allData.shipments.map(s => `<option value="${s.id}">${s.shipmentNo}</option>`).join('');
    if (currentValue) {
        select.value = currentValue;
    }
}

function filterCheckpoints() {
    const select = document.getElementById('filterShipment');
    renderCheckpointsTable(select ? select.value : '');
}

function openModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function openExhibitModal(id = null) {
    const exhibit = id ? allData.exhibits.find(e => e.id === id) : null;
    const title = exhibit ? '编辑展品' : '新增展品';
    const content = `
        <form id="exhibitForm">
            <input type="hidden" id="exhibitId" value="${id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>展品编号 <span class="required">*</span></label>
                    <input type="text" id="exhibitNo" value="${exhibit?.exhibitNo || ''}" required>
                </div>
                <div class="form-group">
                    <label>名称 <span class="required">*</span></label>
                    <input type="text" id="exhibitName" value="${exhibit?.name || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>类别 <span class="required">*</span></label>
                    <select id="exhibitCategory" required>
                        <option value="书画" ${exhibit?.category === '书画' ? 'selected' : ''}>书画</option>
                        <option value="陶瓷" ${exhibit?.category === '陶瓷' ? 'selected' : ''}>陶瓷</option>
                        <option value="瓷器" ${exhibit?.category === '瓷器' ? 'selected' : ''}>瓷器</option>
                        <option value="金属器" ${exhibit?.category === '金属器' ? 'selected' : ''}>金属器</option>
                        <option value="玉石器" ${exhibit?.category === '玉石器' ? 'selected' : ''}>玉石器</option>
                        <option value="其他" ${exhibit?.category === '其他' ? 'selected' : ''}>其他</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>年代 <span class="required">*</span></label>
                    <input type="text" id="exhibitEra" value="${exhibit?.era || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>存放地 <span class="required">*</span></label>
                    <input type="text" id="exhibitLocation" value="${exhibit?.location || ''}" required>
                </div>
                <div class="form-group">
                    <label>估价(元) <span class="required">*</span></label>
                    <input type="number" id="exhibitValue" value="${exhibit?.value || ''}" required>
                </div>
            </div>
            <div class="form-group">
                <label>状态</label>
                <select id="exhibitStatus">
                    <option value="in_stock" ${exhibit?.status === 'in_stock' ? 'selected' : ''}>在库</option>
                    <option value="borrowed" ${exhibit?.status === 'borrowed' ? 'selected' : ''}>借出</option>
                    <option value="in_transit" ${exhibit?.status === 'in_transit' ? 'selected' : ''}>运输中</option>
                </select>
            </div>
            <div class="form-group">
                <label>描述</label>
                <textarea id="exhibitDescription">${exhibit?.description || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    openModal(title, content);
    document.getElementById('exhibitForm').addEventListener('submit', saveExhibit);
}

async function saveExhibit(e) {
    e.preventDefault();
    const id = document.getElementById('exhibitId').value;
    const data = {
        exhibitNo: document.getElementById('exhibitNo').value,
        name: document.getElementById('exhibitName').value,
        category: document.getElementById('exhibitCategory').value,
        era: document.getElementById('exhibitEra').value,
        location: document.getElementById('exhibitLocation').value,
        value: document.getElementById('exhibitValue').value,
        status: document.getElementById('exhibitStatus').value,
        description: document.getElementById('exhibitDescription').value
    };
    const url = id ? `${API_BASE}/api/exhibits/${id}` : `${API_BASE}/api/exhibits`;
    const method = id ? 'PUT' : 'POST';
    const { ok, data: result } = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (ok) {
        showToast('保存成功', 'success');
        closeModal();
        await loadAllData();
    } else {
        showToast(result.message || '保存失败', 'error');
    }
}

async function deleteExhibit(id) {
    if (!confirm('确定要删除这个展品吗？')) return;
    const { ok, data } = await apiRequest(`${API_BASE}/api/exhibits/${id}`, { method: 'DELETE' });
    if (ok) {
        showToast('删除成功', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '删除失败', 'error');
    }
}

function openContractModal(id = null) {
    const contract = id ? allData.contracts.find(c => c.id === id) : null;
    const title = contract ? '编辑合同' : '新增合同';
    const exhibitsOptions = allData.exhibits.map(e => 
        `<option value="${e.id}" ${contract?.exhibitId === e.id ? 'selected' : ''}>${e.exhibitNo} - ${e.name}</option>`
    ).join('');
    const content = `
        <form id="contractForm">
            <input type="hidden" id="contractId" value="${id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>合同编号 <span class="required">*</span></label>
                    <input type="text" id="contractNo" value="${contract?.contractNo || ''}" required>
                </div>
                <div class="form-group">
                    <label>关联展品 <span class="required">*</span></label>
                    <select id="contractExhibitId" required>
                        <option value="">请选择展品</option>
                        ${exhibitsOptions}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>借入方机构 <span class="required">*</span></label>
                    <input type="text" id="contractBorrower" value="${contract?.borrowerInstitution || ''}" required>
                </div>
                <div class="form-group">
                    <label>借出方机构 <span class="required">*</span></label>
                    <input type="text" id="contractLender" value="${contract?.lenderInstitution || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>开始日期 <span class="required">*</span></label>
                    <input type="date" id="contractStartDate" value="${contract?.startDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>结束日期 <span class="required">*</span></label>
                    <input type="date" id="contractEndDate" value="${contract?.endDate || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>保险金额(元) <span class="required">*</span></label>
                    <input type="number" id="contractInsuranceAmount" value="${contract?.insuranceAmount || ''}" required>
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select id="contractStatus">
                        <option value="active" ${contract?.status === 'active' ? 'selected' : ''}>有效</option>
                        <option value="terminated" ${contract?.status === 'terminated' ? 'selected' : ''}>已终止</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>负责人</label>
                    <input type="text" id="contractResponsible" value="${contract?.responsiblePerson || ''}">
                </div>
                <div class="form-group">
                    <label>联系电话</label>
                    <input type="text" id="contractPhone" value="${contract?.phone || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>条款说明</label>
                <textarea id="contractTerms">${contract?.terms || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    openModal(title, content);
    document.getElementById('contractForm').addEventListener('submit', saveContract);
}

async function saveContract(e) {
    e.preventDefault();
    const id = document.getElementById('contractId').value;
    const data = {
        contractNo: document.getElementById('contractNo').value,
        exhibitId: document.getElementById('contractExhibitId').value,
        borrowerInstitution: document.getElementById('contractBorrower').value,
        lenderInstitution: document.getElementById('contractLender').value,
        startDate: document.getElementById('contractStartDate').value,
        endDate: document.getElementById('contractEndDate').value,
        insuranceAmount: document.getElementById('contractInsuranceAmount').value,
        status: document.getElementById('contractStatus').value,
        responsiblePerson: document.getElementById('contractResponsible').value,
        phone: document.getElementById('contractPhone').value,
        terms: document.getElementById('contractTerms').value
    };
    const url = id ? `${API_BASE}/api/contracts/${id}` : `${API_BASE}/api/contracts`;
    const method = id ? 'PUT' : 'POST';
    const { ok, data: result } = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (ok) {
        showToast('保存成功', 'success');
        closeModal();
        await loadAllData();
    } else {
        showToast(result.message || '保存失败', 'error');
    }
}

async function deleteContract(id) {
    if (!confirm('确定要删除这个合同吗？')) return;
    const { ok, data } = await apiRequest(`${API_BASE}/api/contracts/${id}`, { method: 'DELETE' });
    if (ok) {
        showToast('删除成功', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '删除失败', 'error');
    }
}

function openInsuranceModal(id = null) {
    const insurance = id ? allData.insurances.find(i => i.id === id) : null;
    const title = insurance ? '编辑保险' : '新增保险';
    const contractsOptions = allData.contracts.map(c => 
        `<option value="${c.id}" data-amount="${c.insuranceAmount}" ${insurance?.contractId === c.id ? 'selected' : ''}>${c.contractNo} (保险金额: ¥${formatMoney(c.insuranceAmount)})</option>`
    ).join('');
    const exhibitsOptions = allData.exhibits.map(e => 
        `<option value="${e.id}" ${insurance?.exhibitId === e.id ? 'selected' : ''}>${e.exhibitNo} - ${e.name}</option>`
    ).join('');
    const content = `
        <form id="insuranceForm">
            <input type="hidden" id="insuranceId" value="${id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>保单号 <span class="required">*</span></label>
                    <input type="text" id="insurancePolicyNo" value="${insurance?.policyNo || ''}" required>
                </div>
                <div class="form-group">
                    <label>关联合同 <span class="required">*</span></label>
                    <select id="insuranceContractId" onchange="updateInsuranceAmount()" required>
                        <option value="">请选择合同</option>
                        ${contractsOptions}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>关联展品 <span class="required">*</span></label>
                <select id="insuranceExhibitId" required>
                    <option value="">请选择展品</option>
                    ${exhibitsOptions}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>保险公司 <span class="required">*</span></label>
                    <input type="text" id="insuranceCompany" value="${insurance?.insuranceCompany || ''}" required>
                </div>
                <div class="form-group">
                    <label>保费(元)</label>
                    <input type="number" id="insurancePremium" value="${insurance?.premium || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>保险开始日期 <span class="required">*</span></label>
                    <input type="date" id="insuranceStartDate" value="${insurance?.startDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>保险结束日期 <span class="required">*</span></label>
                    <input type="date" id="insuranceEndDate" value="${insurance?.endDate || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>保险金额(元) <span class="required">*</span> <span style="color:#999;font-size:12px;">(必须与合同约定一致)</span></label>
                    <input type="number" id="insuranceAmount" value="${insurance?.amount || ''}" required>
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select id="insuranceStatus">
                        <option value="active" ${insurance?.status === 'active' ? 'selected' : ''}>有效</option>
                        <option value="expired" ${insurance?.status === 'expired' ? 'selected' : ''}>已过期</option>
                        <option value="terminated" ${insurance?.status === 'terminated' ? 'selected' : ''}>已终止</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>保障范围</label>
                <textarea id="insuranceCoverage">${insurance?.coverage || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    openModal(title, content);
    document.getElementById('insuranceForm').addEventListener('submit', saveInsurance);
}

function updateInsuranceAmount() {
    const select = document.getElementById('insuranceContractId');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.dataset.amount) {
        document.getElementById('insuranceAmount').value = selectedOption.dataset.amount;
    }
}

async function saveInsurance(e) {
    e.preventDefault();
    const id = document.getElementById('insuranceId').value;
    const data = {
        policyNo: document.getElementById('insurancePolicyNo').value,
        contractId: document.getElementById('insuranceContractId').value,
        exhibitId: document.getElementById('insuranceExhibitId').value,
        insuranceCompany: document.getElementById('insuranceCompany').value,
        startDate: document.getElementById('insuranceStartDate').value,
        endDate: document.getElementById('insuranceEndDate').value,
        amount: document.getElementById('insuranceAmount').value,
        premium: document.getElementById('insurancePremium').value,
        status: document.getElementById('insuranceStatus').value,
        coverage: document.getElementById('insuranceCoverage').value
    };
    const url = id ? `${API_BASE}/api/insurances/${id}` : `${API_BASE}/api/insurances`;
    const method = id ? 'PUT' : 'POST';
    const { ok, data: result } = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (ok) {
        showToast('保存成功', 'success');
        closeModal();
        await loadAllData();
    } else {
        showToast(result.message || '保存失败', 'error');
    }
}

async function deleteInsurance(id) {
    if (!confirm('确定要删除这个保险记录吗？')) return;
    const { ok, data } = await apiRequest(`${API_BASE}/api/insurances/${id}`, { method: 'DELETE' });
    if (ok) {
        showToast('删除成功', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '删除失败', 'error');
    }
}

function openShipmentModal(id = null) {
    const shipment = id ? allData.shipments.find(s => s.id === id) : null;
    const title = shipment ? '编辑运输' : '新增运输';
    const contractsOptions = allData.contracts.map(c => 
        `<option value="${c.id}" ${shipment?.contractId === c.id ? 'selected' : ''}>${c.contractNo}</option>`
    ).join('');
    const exhibitsOptions = allData.exhibits.map(e => 
        `<option value="${e.id}" ${shipment?.exhibitId === e.id ? 'selected' : ''}>${e.exhibitNo} - ${e.name}</option>`
    ).join('');
    const content = `
        <form id="shipmentForm">
            <input type="hidden" id="shipmentId" value="${id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>运输批次号 <span class="required">*</span></label>
                    <input type="text" id="shipmentNo" value="${shipment?.shipmentNo || ''}" required>
                </div>
                <div class="form-group">
                    <label>关联合同 <span class="required">*</span></label>
                    <select id="shipmentContractId" required>
                        <option value="">请选择合同</option>
                        ${contractsOptions}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>关联展品 <span class="required">*</span></label>
                <select id="shipmentExhibitId" required>
                    <option value="">请选择展品</option>
                    ${exhibitsOptions}
                </select>
            </div>
            <div class="form-group">
                <label>物流公司 <span class="required">*</span></label>
                <input type="text" id="shipmentLogistics" value="${shipment?.logisticsCompany || ''}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>出发日期 <span class="required">*</span></label>
                    <input type="date" id="shipmentDepartureDate" value="${shipment?.departureDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>预计到达日期 <span class="required">*</span></label>
                    <input type="date" id="shipmentExpectedDate" value="${shipment?.expectedArrivalDate || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>实际到达日期</label>
                    <input type="date" id="shipmentActualDate" value="${shipment?.actualArrivalDate || ''}">
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select id="shipmentStatus">
                        <option value="in_transit" ${shipment?.status === 'in_transit' ? 'selected' : ''}>运输中</option>
                        <option value="delivered" ${shipment?.status === 'delivered' ? 'selected' : ''}>已送达</option>
                        <option value="delayed" ${shipment?.status === 'delayed' ? 'selected' : ''}>延误</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>经办人</label>
                    <input type="text" id="shipmentHandler" value="${shipment?.handler || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="shipmentRemark">${shipment?.remark || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    openModal(title, content);
    document.getElementById('shipmentForm').addEventListener('submit', saveShipment);
}

async function saveShipment(e) {
    e.preventDefault();
    const id = document.getElementById('shipmentId').value;
    const data = {
        shipmentNo: document.getElementById('shipmentNo').value,
        contractId: document.getElementById('shipmentContractId').value,
        exhibitId: document.getElementById('shipmentExhibitId').value,
        logisticsCompany: document.getElementById('shipmentLogistics').value,
        departureDate: document.getElementById('shipmentDepartureDate').value,
        expectedArrivalDate: document.getElementById('shipmentExpectedDate').value,
        actualArrivalDate: document.getElementById('shipmentActualDate').value,
        status: document.getElementById('shipmentStatus').value,
        handler: document.getElementById('shipmentHandler').value,
        remark: document.getElementById('shipmentRemark').value
    };
    const url = id ? `${API_BASE}/api/shipments/${id}` : `${API_BASE}/api/shipments`;
    const method = id ? 'PUT' : 'POST';
    const { ok, data: result } = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (ok) {
        showToast('保存成功', 'success');
        closeModal();
        await loadAllData();
    } else {
        showToast(result.message || '保存失败', 'error');
    }
}

async function deleteShipment(id) {
    if (!confirm('确定要删除这个运输批次吗？')) return;
    const { ok, data } = await apiRequest(`${API_BASE}/api/shipments/${id}`, { method: 'DELETE' });
    if (ok) {
        showToast('删除成功', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '删除失败', 'error');
    }
}

function openCheckpointModal(id = null) {
    const checkpoint = id ? allData.checkpoints.find(c => c.id === id) : null;
    const title = checkpoint ? '编辑点交' : '新增点交';
    const shipmentsOptions = allData.shipments.map(s => 
        `<option value="${s.id}" ${checkpoint?.shipmentId === s.id ? 'selected' : ''}>${s.shipmentNo} - ${getExhibitName(s.exhibitId)}</option>`
    ).join('');
    const content = `
        <form id="checkpointForm">
            <input type="hidden" id="checkpointId" value="${id || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label>点交编号 <span class="required">*</span></label>
                    <input type="text" id="checkpointNo" value="${checkpoint?.checkpointNo || ''}" required>
                </div>
                <div class="form-group">
                    <label>关联运输批次 <span class="required">*</span></label>
                    <select id="checkpointShipmentId" required>
                        <option value="">请选择运输批次</option>
                        ${shipmentsOptions}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>点交类型 <span class="required">*</span></label>
                    <select id="checkpointType" required>
                        <option value="departure" ${checkpoint?.checkpointType === 'departure' ? 'selected' : ''}>出库</option>
                        <option value="transit" ${checkpoint?.checkpointType === 'transit' ? 'selected' : ''}>中转</option>
                        <option value="arrival" ${checkpoint?.checkpointType === 'arrival' ? 'selected' : ''}>入库</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>点交名称 <span class="required">*</span></label>
                    <input type="text" id="checkpointName" value="${checkpoint?.checkpointName || ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>操作人 <span class="required">*</span></label>
                    <input type="text" id="checkpointOperator" value="${checkpoint?.operator || ''}" required>
                </div>
                <div class="form-group">
                    <label>状况</label>
                    <select id="checkpointCondition">
                        <option value="good" ${checkpoint?.condition === 'good' ? 'selected' : ''}>良好</option>
                        <option value="damaged" ${checkpoint?.condition === 'damaged' ? 'selected' : ''}>损坏</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>描述</label>
                <textarea id="checkpointDescription">${checkpoint?.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>签名 <span style="color:#999;font-size:12px;">(确认前必须签名)</span></label>
                <input type="text" id="checkpointSignature" value="${checkpoint?.signature || ''}">
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    openModal(title, content);
    document.getElementById('checkpointForm').addEventListener('submit', saveCheckpoint);
}

async function saveCheckpoint(e) {
    e.preventDefault();
    const id = document.getElementById('checkpointId').value;
    const data = {
        checkpointNo: document.getElementById('checkpointNo').value,
        shipmentId: document.getElementById('checkpointShipmentId').value,
        checkpointType: document.getElementById('checkpointType').value,
        checkpointName: document.getElementById('checkpointName').value,
        operator: document.getElementById('checkpointOperator').value,
        condition: document.getElementById('checkpointCondition').value,
        description: document.getElementById('checkpointDescription').value,
        signature: document.getElementById('checkpointSignature').value,
        timestamp: new Date().toISOString()
    };
    const url = id ? `${API_BASE}/api/checkpoints/${id}` : `${API_BASE}/api/checkpoints`;
    const method = id ? 'PUT' : 'POST';
    const { ok, data: result } = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (ok) {
        showToast('保存成功', 'success');
        closeModal();
        await loadAllData();
    } else {
        showToast(result.message || '保存失败', 'error');
    }
}

async function confirmCheckpoint(id) {
    const { ok, data } = await apiRequest(`${API_BASE}/api/checkpoints/${id}/confirm`, { method: 'PUT' });
    if (ok) {
        showToast('点交已确认', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '确认失败', 'error');
    }
}

async function rejectCheckpoint(id) {
    const reason = prompt('请输入拒绝原因：');
    if (!reason) {
        showToast('拒绝原因不能为空', 'warning');
        return;
    }
    const { ok, data } = await apiRequest(`${API_BASE}/api/checkpoints/${id}/reject`, { 
        method: 'PUT', 
        body: JSON.stringify({ rejectReason: reason }) 
    });
    if (ok) {
        showToast('点交已拒绝', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '拒绝失败', 'error');
    }
}

function viewCheckpointDetail(id) {
    const checkpoint = allData.checkpoints.find(c => c.id === id);
    if (!checkpoint) return;
    const typeMap = { 'departure': '出库', 'transit': '中转', 'arrival': '入库' };
    const conditionMap = { 'good': '良好', 'damaged': '损坏' };
    const content = `
        <div class="checkpoint-detail">
            <p><strong>点交编号：</strong>${checkpoint.checkpointNo}</p>
            <p><strong>运输批次：</strong>${getShipmentNo(checkpoint.shipmentId)}</p>
            <p><strong>点交类型：</strong>${typeMap[checkpoint.checkpointType]}</p>
            <p><strong>点交名称：</strong>${checkpoint.checkpointName}</p>
            <p><strong>操作人：</strong>${checkpoint.operator}</p>
            <p><strong>时间：</strong>${formatDateTime(checkpoint.timestamp)}</p>
            <p><strong>状况：</strong>${conditionMap[checkpoint.condition] || '-'}</p>
            <p><strong>状态：</strong>${getStatusLabel(checkpoint.status)}</p>
            <p><strong>描述：</strong>${checkpoint.description || '-'}</p>
            <p><strong>签名：</strong>${checkpoint.signature || '-'}</p>
            ${checkpoint.rejectReason ? `<p><strong>拒绝原因：</strong>${checkpoint.rejectReason}</p>` : ''}
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button>
        </div>
    `;
    openModal('点交详情', content);
}

async function deleteCheckpoint(id) {
    if (!confirm('确定要删除这个点交记录吗？')) return;
    const { ok, data } = await apiRequest(`${API_BASE}/api/checkpoints/${id}`, { method: 'DELETE' });
    if (ok) {
        showToast('删除成功', 'success');
        await loadAllData();
    } else {
        showToast(data.message || '删除失败', 'error');
    }
}

async function testDuplicate() {
    const resultDiv = document.getElementById('duplicateResult');
    resultDiv.className = 'test-result';
    if (allData.exhibits.length === 0) {
        resultDiv.innerHTML = '❌ 请先初始化示例数据';
        resultDiv.className = 'test-result error';
        return;
    }
    const firstExhibit = allData.exhibits[0];
    const testData = {
        exhibitNo: firstExhibit.exhibitNo,
        name: '重复测试展品',
        category: '测试',
        era: '测试',
        location: '测试',
        value: 10000
    };
    const { ok, data } = await apiRequest(`${API_BASE}/api/exhibits`, { method: 'POST', body: JSON.stringify(testData) });
    if (!ok && data.errorType === 'duplicate') {
        resultDiv.innerHTML = `✅ 测试通过！系统正确检测到重复数据：${data.message}`;
        resultDiv.className = 'test-result success';
    } else {
        resultDiv.innerHTML = `❌ 测试失败！未能正确检测重复数据`;
        resultDiv.className = 'test-result error';
    }
}

async function testMissingFields() {
    const resultDiv = document.getElementById('missingResult');
    resultDiv.className = 'test-result';
    const testData = {
        name: '测试展品'
    };
    const { ok, data } = await apiRequest(`${API_BASE}/api/exhibits`, { method: 'POST', body: JSON.stringify(testData) });
    if (!ok && data.errors && data.errors.missingFields) {
        resultDiv.innerHTML = `✅ 测试通过！系统正确检测到缺失字段：${data.errors.missingFields.join(', ')}`;
        resultDiv.className = 'test-result success';
    } else {
        resultDiv.innerHTML = `❌ 测试失败！未能正确检测缺失字段`;
        resultDiv.className = 'test-result error';
    }
}

async function testMismatch() {
    const resultDiv = document.getElementById('mismatchResult');
    resultDiv.className = 'test-result';
    const activeContract = allData.contracts.find(c => c.status === 'active');
    if (!activeContract) {
        resultDiv.innerHTML = '❌ 请先初始化示例数据，确保有有效的合同';
        resultDiv.className = 'test-result error';
        return;
    }
    const testData = {
        policyNo: 'BX-TEST-MISMATCH-' + Date.now(),
        contractId: activeContract.id,
        exhibitId: activeContract.exhibitId,
        insuranceCompany: '测试保险公司',
        startDate: '2026-05-10',
        endDate: '2026-06-10',
        amount: Number(activeContract.insuranceAmount) + 10000
    };
    const { ok, data } = await apiRequest(`${API_BASE}/api/insurances`, { method: 'POST', body: JSON.stringify(testData) });
    if (!ok && data.errorType === 'mismatch') {
        resultDiv.innerHTML = `✅ 测试通过！系统正确检测到保险金额与合同不一致：${data.message}`;
        resultDiv.className = 'test-result success';
    } else {
        resultDiv.innerHTML = `❌ 测试失败！未能正确检测金额不一致`;
        resultDiv.className = 'test-result error';
    }
}

async function exportData(type) {
    const { ok, data } = await apiRequest(`${API_BASE}/api/export/${type}`);
    if (ok) {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('导出成功', 'success');
    } else {
        showToast(data.message || '导出失败', 'error');
    }
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') {
            closeModal();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
    loadAllData();
});
