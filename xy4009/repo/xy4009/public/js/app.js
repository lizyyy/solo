const API_BASE = '/api';

let materials = [];
let suppliers = [];
let exchangeRates = [];
let quotationItemIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadDashboard();
  loadMaterials();
  loadSuppliers();
  loadExchangeRates();
  loadQuotations();
  loadPriceComparison();
});

function initNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
      document.getElementById(`page-${page}`).classList.add('active');
      
      if (page === 'quotations') {
        loadQuotationFilters();
      }
      if (page === 'price-comparison') {
        loadPriceComparisonFilters();
      }
    });
  });
}

async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.details || '请求失败');
    }
    
    return data;
  } catch (error) {
    showToast(error.message, 'danger');
    throw error;
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

async function loadDashboard() {
  try {
    const [materialsRes, suppliersRes, quotationsRes, ratesRes] = await Promise.all([
      apiRequest(`${API_BASE}/materials`),
      apiRequest(`${API_BASE}/suppliers`),
      apiRequest(`${API_BASE}/quotations`),
      apiRequest(`${API_BASE}/exchange-rates`)
    ]);
    
    document.getElementById('stat-materials').textContent = materialsRes.data.length;
    document.getElementById('stat-suppliers').textContent = suppliersRes.data.length;
    document.getElementById('stat-quotations').textContent = quotationsRes.data.length;
    document.getElementById('stat-currencies').textContent = ratesRes.data.length;
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

async function loadMaterials() {
  try {
    const response = await apiRequest(`${API_BASE}/materials`);
    materials = response.data;
    renderMaterialsTable(materials);
  } catch (error) {
    console.error('加载物料失败:', error);
  }
}

function renderMaterialsTable(data) {
  const tbody = document.querySelector('#materials-table tbody');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">暂无物料数据，请点击"新增物料"添加</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.spec || '-'}</td>
      <td>${item.unit || '-'}</td>
      <td>${formatDate(item.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-primary" onclick="editMaterial(${item.id})">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteMaterial(${item.id})">删除</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function searchMaterials() {
  const code = document.getElementById('material-search-code').value.toLowerCase();
  const name = document.getElementById('material-search-name').value.toLowerCase();
  
  const filtered = materials.filter(m => {
    const matchCode = !code || m.code.toLowerCase().includes(code);
    const matchName = !name || m.name.toLowerCase().includes(name);
    return matchCode && matchName;
  });
  
  renderMaterialsTable(filtered);
}

function resetMaterialSearch() {
  document.getElementById('material-search-code').value = '';
  document.getElementById('material-search-name').value = '';
  renderMaterialsTable(materials);
}

function openMaterialModal(item = null) {
  const modal = document.getElementById('material-modal');
  const title = document.getElementById('material-modal-title');
  
  if (item) {
    title.textContent = '编辑物料';
    document.getElementById('material-id').value = item.id;
    document.getElementById('material-code').value = item.code;
    document.getElementById('material-name').value = item.name;
    document.getElementById('material-spec').value = item.spec || '';
    document.getElementById('material-unit').value = item.unit || '';
  } else {
    title.textContent = '新增物料';
    document.getElementById('material-form').reset();
    document.getElementById('material-id').value = '';
  }
  
  modal.classList.add('active');
}

function closeMaterialModal() {
  document.getElementById('material-modal').classList.remove('active');
}

async function saveMaterial(event) {
  event.preventDefault();
  
  const id = document.getElementById('material-id').value;
  const data = {
    code: document.getElementById('material-code').value.trim(),
    name: document.getElementById('material-name').value.trim(),
    spec: document.getElementById('material-spec').value.trim(),
    unit: document.getElementById('material-unit').value.trim()
  };
  
  try {
    if (id) {
      await apiRequest(`${API_BASE}/materials/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('更新成功', 'success');
    } else {
      await apiRequest(`${API_BASE}/materials`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('创建成功', 'success');
    }
    
    closeMaterialModal();
    loadMaterials();
    loadDashboard();
  } catch (error) {
    console.error('保存物料失败:', error);
  }
}

async function editMaterial(id) {
  const material = materials.find(m => m.id === id);
  if (material) {
    openMaterialModal(material);
  }
}

async function deleteMaterial(id) {
  if (!confirm('确定要删除这个物料吗？')) return;
  
  try {
    await apiRequest(`${API_BASE}/materials/${id}`, {
      method: 'DELETE'
    });
    showToast('删除成功', 'success');
    loadMaterials();
    loadDashboard();
  } catch (error) {
    console.error('删除物料失败:', error);
  }
}

async function loadSuppliers() {
  try {
    const response = await apiRequest(`${API_BASE}/suppliers`);
    suppliers = response.data;
    renderSuppliersTable(suppliers);
  } catch (error) {
    console.error('加载供应商失败:', error);
  }
}

function renderSuppliersTable(data) {
  const tbody = document.querySelector('#suppliers-table tbody');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">暂无供应商数据，请点击"新增供应商"添加</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.contact_person || '-'}</td>
      <td>${item.phone || '-'}</td>
      <td>${item.email || '-'}</td>
      <td>${item.address || '-'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-primary" onclick="editSupplier(${item.id})">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${item.id})">删除</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function searchSuppliers() {
  const code = document.getElementById('supplier-search-code').value.toLowerCase();
  const name = document.getElementById('supplier-search-name').value.toLowerCase();
  
  const filtered = suppliers.filter(s => {
    const matchCode = !code || s.code.toLowerCase().includes(code);
    const matchName = !name || s.name.toLowerCase().includes(name);
    return matchCode && matchName;
  });
  
  renderSuppliersTable(filtered);
}

function resetSupplierSearch() {
  document.getElementById('supplier-search-code').value = '';
  document.getElementById('supplier-search-name').value = '';
  renderSuppliersTable(suppliers);
}

function openSupplierModal(item = null) {
  const modal = document.getElementById('supplier-modal');
  const title = document.getElementById('supplier-modal-title');
  
  if (item) {
    title.textContent = '编辑供应商';
    document.getElementById('supplier-id').value = item.id;
    document.getElementById('supplier-code').value = item.code;
    document.getElementById('supplier-name').value = item.name;
    document.getElementById('supplier-contact').value = item.contact_person || '';
    document.getElementById('supplier-phone').value = item.phone || '';
    document.getElementById('supplier-email').value = item.email || '';
    document.getElementById('supplier-address').value = item.address || '';
  } else {
    title.textContent = '新增供应商';
    document.getElementById('supplier-form').reset();
    document.getElementById('supplier-id').value = '';
  }
  
  modal.classList.add('active');
}

function closeSupplierModal() {
  document.getElementById('supplier-modal').classList.remove('active');
}

async function saveSupplier(event) {
  event.preventDefault();
  
  const id = document.getElementById('supplier-id').value;
  const data = {
    code: document.getElementById('supplier-code').value.trim(),
    name: document.getElementById('supplier-name').value.trim(),
    contact_person: document.getElementById('supplier-contact').value.trim(),
    phone: document.getElementById('supplier-phone').value.trim(),
    email: document.getElementById('supplier-email').value.trim(),
    address: document.getElementById('supplier-address').value.trim()
  };
  
  try {
    if (id) {
      await apiRequest(`${API_BASE}/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('更新成功', 'success');
    } else {
      await apiRequest(`${API_BASE}/suppliers`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('创建成功', 'success');
    }
    
    closeSupplierModal();
    loadSuppliers();
    loadDashboard();
  } catch (error) {
    console.error('保存供应商失败:', error);
  }
}

async function editSupplier(id) {
  const supplier = suppliers.find(s => s.id === id);
  if (supplier) {
    openSupplierModal(supplier);
  }
}

async function deleteSupplier(id) {
  if (!confirm('确定要删除这个供应商吗？')) return;
  
  try {
    await apiRequest(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE'
    });
    showToast('删除成功', 'success');
    loadSuppliers();
    loadDashboard();
  } catch (error) {
    console.error('删除供应商失败:', error);
  }
}

async function loadExchangeRates() {
  try {
    const response = await apiRequest(`${API_BASE}/exchange-rates`);
    exchangeRates = response.data;
  } catch (error) {
    console.error('加载汇率失败:', error);
  }
}

async function loadQuotations() {
  const supplierId = document.getElementById('quotation-filter-supplier').value;
  const materialId = document.getElementById('quotation-filter-material').value;
  const startDate = document.getElementById('quotation-filter-start-date').value;
  const endDate = document.getElementById('quotation-filter-end-date').value;
  const status = document.getElementById('quotation-filter-status').value;
  
  let url = `${API_BASE}/quotations?`;
  const params = [];
  
  if (supplierId) params.push(`supplier_id=${supplierId}`);
  if (materialId) params.push(`material_id=${materialId}`);
  if (startDate) params.push(`start_date=${startDate}`);
  if (endDate) params.push(`end_date=${endDate}`);
  if (status) params.push(`status=${status}`);
  
  url += params.join('&');
  
  try {
    const response = await apiRequest(url);
    renderQuotationsTable(response.data);
  } catch (error) {
    console.error('加载报价单失败:', error);
  }
}

async function loadQuotationFilters() {
  const supplierSelect = document.getElementById('quotation-filter-supplier');
  const materialSelect = document.getElementById('quotation-filter-material');
  
  supplierSelect.innerHTML = '<option value="">全部</option>' + 
    suppliers.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
  
  materialSelect.innerHTML = '<option value="">全部</option>' + 
    materials.map(m => `<option value="${m.id}">${m.code} - ${m.name}</option>`).join('');
}

function renderQuotationsTable(data) {
  const tbody = document.querySelector('#quotations-table tbody');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">暂无报价单数据</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${item.quotation_no}</td>
      <td>${item.supplier_name || '-'}</td>
      <td>${item.quotation_date}</td>
      <td>${item.currency}</td>
      <td>${item.exchange_rate}</td>
      <td>
        <span class="badge ${item.status === 'active' ? 'badge-success' : 'badge-secondary'}">
          ${item.status === 'active' ? '有效' : '无效'}
        </span>
      </td>
      <td>${item.items ? item.items.length : 0}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-info" onclick="viewQuotationDetail(${item.id})">详情</button>
          <button class="btn btn-sm btn-primary" onclick="editQuotation(${item.id})">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteQuotation(${item.id})">删除</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openQuotationModal(quotation = null) {
  const modal = document.getElementById('quotation-modal');
  const title = document.getElementById('quotation-modal-title');
  
  const supplierSelect = document.getElementById('quotation-supplier');
  supplierSelect.innerHTML = '<option value="">请选择供应商</option>' + 
    suppliers.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
  
  const currencySelect = document.getElementById('quotation-currency');
  currencySelect.innerHTML = '<option value="">请选择币种</option>' + 
    exchangeRates.map(r => `<option value="${r.currency}" data-rate="${r.rate}">${r.currency}</option>`).join('');
  
  quotationItemIndex = 0;
  document.getElementById('quotation-items-body').innerHTML = '';
  
  if (quotation) {
    title.textContent = '编辑报价单';
    document.getElementById('quotation-id').value = quotation.id;
    document.getElementById('quotation-supplier').value = quotation.supplier_id;
    document.getElementById('quotation-date').value = quotation.quotation_date;
    document.getElementById('quotation-currency').value = quotation.currency;
    document.getElementById('quotation-exchange-rate').value = quotation.exchange_rate || '';
    document.getElementById('quotation-tax-rate').value = quotation.tax_rate || 0.13;
    document.getElementById('quotation-status').value = quotation.status;
    document.getElementById('quotation-remarks').value = quotation.remarks || '';
    
    if (quotation.items && quotation.items.length > 0) {
      quotation.items.forEach(item => {
        addQuotationItem(item);
      });
    } else {
      addQuotationItem();
    }
  } else {
    title.textContent = '新增报价单';
    document.getElementById('quotation-form').reset();
    document.getElementById('quotation-id').value = '';
    document.getElementById('quotation-tax-rate').value = 0.13;
    document.getElementById('quotation-date').value = new Date().toISOString().slice(0, 10);
    addQuotationItem();
  }
  
  modal.classList.add('active');
}

function closeQuotationModal() {
  document.getElementById('quotation-modal').classList.remove('active');
}

function onCurrencyChange() {
  const currencySelect = document.getElementById('quotation-currency');
  const selectedOption = currencySelect.options[currencySelect.selectedIndex];
  const rate = selectedOption ? selectedOption.dataset.rate : '';
  
  if (rate && !document.getElementById('quotation-exchange-rate').value) {
    document.getElementById('quotation-exchange-rate').value = rate;
  }
}

function addQuotationItem(item = null) {
  quotationItemIndex++;
  const tbody = document.getElementById('quotation-items-body');
  
  const materialOptions = materials.map(m => 
    `<option value="${m.id}">${m.code} - ${m.name} ${m.spec ? '(' + m.spec + ')' : ''}</option>`
  ).join('');
  
  const tr = document.createElement('tr');
  tr.dataset.index = quotationItemIndex;
  tr.innerHTML = `
    <td>${quotationItemIndex}</td>
    <td>
      <select id="item-material-${quotationItemIndex}" class="item-material" required>
        <option value="">请选择物料</option>
        ${materialOptions}
      </select>
    </td>
    <td>
      <input type="number" id="item-quantity-${quotationItemIndex}" class="item-quantity" step="0.01" min="0.01" value="${item ? item.quantity : 1}">
    </td>
    <td>
      <input type="number" id="item-price-included-${quotationItemIndex}" class="item-price-included" step="0.01" min="0" 
        value="${item ? item.price_tax_included : ''}" onchange="calculateItemPrice(${quotationItemIndex}, 'included')">
    </td>
    <td>
      <input type="number" id="item-price-excluded-${quotationItemIndex}" class="item-price-excluded" step="0.01" min="0"
        value="${item ? item.price_tax_excluded : ''}" onchange="calculateItemPrice(${quotationItemIndex}, 'excluded')">
    </td>
    <td>
      <input type="number" id="item-tax-amount-${quotationItemIndex}" class="item-tax-amount" step="0.01" readonly
        value="${item ? item.tax_amount : ''}">
    </td>
    <td>
      <input type="number" id="item-total-amount-${quotationItemIndex}" class="item-total-amount" step="0.01" readonly
        value="${item ? item.total_amount : ''}">
    </td>
    <td>
      <button type="button" class="btn btn-sm btn-danger" onclick="removeQuotationItem(${quotationItemIndex})">删除</button>
    </td>
  `;
  
  tbody.appendChild(tr);
  
  if (item && item.material_id) {
    document.getElementById(`item-material-${quotationItemIndex}`).value = item.material_id;
  }
}

function removeQuotationItem(index) {
  const tbody = document.getElementById('quotation-items-body');
  const row = tbody.querySelector(`tr[data-index="${index}"]`);
  
  if (tbody.children.length > 1) {
    row.remove();
    renumberQuotationItems();
  } else {
    showToast('至少需要保留一行物料', 'warning');
  }
}

function renumberQuotationItems() {
  const tbody = document.getElementById('quotation-items-body');
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    row.cells[0].textContent = index + 1;
  });
}

function calculateItemPrice(index, type) {
  const taxRate = parseFloat(document.getElementById('quotation-tax-rate').value) || 0.13;
  const quantity = parseFloat(document.getElementById(`item-quantity-${index}`).value) || 1;
  const priceIncludedInput = document.getElementById(`item-price-included-${index}`);
  const priceExcludedInput = document.getElementById(`item-price-excluded-${index}`);
  const taxAmountInput = document.getElementById(`item-tax-amount-${index}`);
  const totalAmountInput = document.getElementById(`item-total-amount-${index}`);
  
  let priceIncluded = parseFloat(priceIncludedInput.value) || null;
  let priceExcluded = parseFloat(priceExcludedInput.value) || null;
  
  if (type === 'included' && priceIncluded !== null) {
    priceExcluded = priceIncluded / (1 + taxRate);
    priceExcludedInput.value = priceExcluded.toFixed(4);
  } else if (type === 'excluded' && priceExcluded !== null) {
    priceIncluded = priceExcluded * (1 + taxRate);
    priceIncludedInput.value = priceIncluded.toFixed(4);
  }
  
  if (priceIncluded !== null && priceExcluded !== null) {
    const taxAmount = (priceIncluded - priceExcluded) * quantity;
    const totalAmount = priceIncluded * quantity;
    taxAmountInput.value = taxAmount.toFixed(2);
    totalAmountInput.value = totalAmount.toFixed(2);
  }
}

async function saveQuotation(event) {
  event.preventDefault();
  
  const id = document.getElementById('quotation-id').value;
  const supplierId = document.getElementById('quotation-supplier').value;
  const quotationDate = document.getElementById('quotation-date').value;
  const currency = document.getElementById('quotation-currency').value;
  const exchangeRate = document.getElementById('quotation-exchange-rate').value;
  const taxRate = document.getElementById('quotation-tax-rate').value;
  const status = document.getElementById('quotation-status').value;
  const remarks = document.getElementById('quotation-remarks').value;
  
  const tbody = document.getElementById('quotation-items-body');
  const rows = tbody.querySelectorAll('tr');
  const items = [];
  
  for (const row of rows) {
    const index = row.dataset.index;
    const materialId = document.getElementById(`item-material-${index}`).value;
    const quantity = document.getElementById(`item-quantity-${index}`).value;
    const priceIncluded = document.getElementById(`item-price-included-${index}`).value;
    const priceExcluded = document.getElementById(`item-price-excluded-${index}`).value;
    
    if (!materialId) {
      showToast('请选择物料', 'warning');
      return;
    }
    
    if (!priceIncluded && !priceExcluded) {
      showToast('请输入含税价或未税价', 'warning');
      return;
    }
    
    items.push({
      material_id: parseInt(materialId),
      quantity: parseFloat(quantity) || 1,
      price_tax_included: priceIncluded ? parseFloat(priceIncluded) : null,
      price_tax_excluded: priceExcluded ? parseFloat(priceExcluded) : null
    });
  }
  
  const data = {
    supplier_id: parseInt(supplierId),
    quotation_date: quotationDate,
    currency: currency,
    exchange_rate: exchangeRate ? parseFloat(exchangeRate) : null,
    tax_rate: taxRate ? parseFloat(taxRate) : 0.13,
    status: status,
    remarks: remarks,
    items: items
  };
  
  try {
    if (id) {
      await apiRequest(`${API_BASE}/quotations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('更新成功', 'success');
    } else {
      await apiRequest(`${API_BASE}/quotations`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('创建成功', 'success');
    }
    
    closeQuotationModal();
    loadQuotations();
    loadDashboard();
  } catch (error) {
    console.error('保存报价单失败:', error);
  }
}

async function editQuotation(id) {
  try {
    const response = await apiRequest(`${API_BASE}/quotations/${id}`);
    openQuotationModal(response.data);
  } catch (error) {
    console.error('加载报价单详情失败:', error);
  }
}

async function viewQuotationDetail(id) {
  try {
    const response = await apiRequest(`${API_BASE}/quotations/${id}`);
    const quotation = response.data;
    
    const content = document.getElementById('quotation-detail-content');
    content.innerHTML = `
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>报价单号:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${quotation.quotation_no}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>供应商:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${quotation.supplier_name || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>报价日期:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${quotation.quotation_date}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>状态:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">
              <span class="badge ${quotation.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                ${quotation.status === 'active' ? '有效' : '无效'}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>币种:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${quotation.currency}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>汇率:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${quotation.exchange_rate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>税率:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${(quotation.tax_rate * 100).toFixed(0)}%</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>备注:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${quotation.remarks || '-'}</td>
          </tr>
        </table>
        
        <h4 style="margin-bottom: 15px;">报价明细</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>物料编码</th>
                <th>物料名称</th>
                <th>规格型号</th>
                <th>单位</th>
                <th>数量</th>
                <th>含税单价</th>
                <th>未税单价</th>
                <th>税额</th>
                <th>价税合计</th>
              </tr>
            </thead>
            <tbody>
              ${quotation.items ? quotation.items.map(item => `
                <tr>
                  <td>${item.material_code || '-'}</td>
                  <td>${item.material_name || '-'}</td>
                  <td>${item.material_spec || '-'}</td>
                  <td>${item.material_unit || '-'}</td>
                  <td>${item.quantity}</td>
                  <td>${item.price_tax_included ? item.price_tax_included.toFixed(2) : '-'}</td>
                  <td>${item.price_tax_excluded ? item.price_tax_excluded.toFixed(2) : '-'}</td>
                  <td>${item.tax_amount ? item.tax_amount.toFixed(2) : '-'}</td>
                  <td>${item.total_amount ? item.total_amount.toFixed(2) : '-'}</td>
                </tr>
              `).join('') : '<tr><td colspan="9" class="empty-state">暂无明细</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.getElementById('quotation-detail-modal').classList.add('active');
  } catch (error) {
    console.error('加载报价单详情失败:', error);
  }
}

function closeQuotationDetailModal() {
  document.getElementById('quotation-detail-modal').classList.remove('active');
}

async function deleteQuotation(id) {
  if (!confirm('确定要删除这个报价单吗？')) return;
  
  try {
    await apiRequest(`${API_BASE}/quotations/${id}`, {
      method: 'DELETE'
    });
    showToast('删除成功', 'success');
    loadQuotations();
    loadDashboard();
  } catch (error) {
    console.error('删除报价单失败:', error);
  }
}

async function loadPriceComparison() {
  const materialId = document.getElementById('comparison-filter-material').value;
  
  let url = `${API_BASE}/quotations/latest-prices`;
  if (materialId) {
    url += `?material_id=${materialId}`;
  }
  
  try {
    const response = await apiRequest(url);
    renderPriceComparisonTable(response.data);
  } catch (error) {
    console.error('加载比价数据失败:', error);
  }
}

async function loadPriceComparisonFilters() {
  const materialSelect = document.getElementById('comparison-filter-material');
  materialSelect.innerHTML = '<option value="">全部物料</option>' + 
    materials.map(m => `<option value="${m.id}">${m.code} - ${m.name}</option>`).join('');
}

function renderPriceComparisonTable(data) {
  const tbody = document.querySelector('#price-comparison-table tbody');
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="13" class="empty-state">暂无比价数据，请先录入报价单</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map(item => {
    let rowClass = '';
    let statusBadge = '';
    
    if (item.is_lowest) {
      rowClass = 'price-lowest';
      statusBadge = '<span class="badge badge-success">最低价</span>';
    } else if (item.is_high) {
      rowClass = 'price-high';
      statusBadge = '<span class="badge badge-danger">高价</span>';
    }
    
    return `
      <tr class="${rowClass}">
        <td>${item.material_code || '-'}</td>
        <td>${item.material_name || '-'}</td>
        <td>${item.material_spec || '-'}</td>
        <td>${item.material_unit || '-'}</td>
        <td>${item.supplier_name || '-'}</td>
        <td>${item.quotation_date}</td>
        <td>${item.currency}</td>
        <td>${item.price_tax_included ? item.price_tax_included.toFixed(4) : '-'}</td>
        <td>${item.price_tax_excluded ? item.price_tax_excluded.toFixed(4) : '-'}</td>
        <td>${item.price_tax_included_cny ? item.price_tax_included_cny.toFixed(4) : '-'}</td>
        <td>${item.price_tax_excluded_cny ? item.price_tax_excluded_cny.toFixed(4) : '-'}</td>
        <td>${item.price_ratio}%</td>
        <td>${statusBadge || '-'}</td>
      </tr>
    `;
  }).join('');
}

function exportMaterials() {
  window.location.href = `${API_BASE}/csv/export/materials`;
}

function exportSuppliers() {
  window.location.href = `${API_BASE}/csv/export/suppliers`;
}

function exportQuotations() {
  window.location.href = `${API_BASE}/csv/export/quotations`;
}

async function importMaterials(input) {
  const file = input.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${API_BASE}/csv/import/materials`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    const resultDiv = document.getElementById('material-import-result');
    if (data.success) {
      resultDiv.innerHTML = `
        <div class="alert alert-success">
          导入成功！共 ${data.data.total} 条，新增 ${data.data.imported} 条，跳过 ${data.data.skipped} 条
          ${data.data.errors.length > 0 ? `<br>错误: ${data.data.errors.join(', ')}` : ''}
        </div>
      `;
      loadMaterials();
      loadDashboard();
    } else {
      resultDiv.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
    }
  } catch (error) {
    document.getElementById('material-import-result').innerHTML = 
      `<div class="alert alert-danger">导入失败: ${error.message}</div>`;
  }
  
  input.value = '';
}

async function importSuppliers(input) {
  const file = input.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${API_BASE}/csv/import/suppliers`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    const resultDiv = document.getElementById('supplier-import-result');
    if (data.success) {
      resultDiv.innerHTML = `
        <div class="alert alert-success">
          导入成功！共 ${data.data.total} 条，新增 ${data.data.imported} 条，跳过 ${data.data.skipped} 条
          ${data.data.errors.length > 0 ? `<br>错误: ${data.data.errors.join(', ')}` : ''}
        </div>
      `;
      loadSuppliers();
      loadDashboard();
    } else {
      resultDiv.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
    }
  } catch (error) {
    document.getElementById('supplier-import-result').innerHTML = 
      `<div class="alert alert-danger">导入失败: ${error.message}</div>`;
  }
  
  input.value = '';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN');
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});
