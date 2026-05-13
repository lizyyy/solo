const API_BASE = '';

const requestCache = new Map();
const CACHE_DURATION = 10000;

let currentFilters = {
  status: '',
  responsiblePerson: '',
  startDate: '',
  endDate: ''
};

function generateRequestKey(url, method, body = null) {
  return `${method}:${url}:${body ? JSON.stringify(body) : ''}`;
}

async function apiRequest(url, options = {}) {
  const method = options.method || 'GET';
  const body = options.body || null;
  const cacheKey = generateRequestKey(url, method, body);

  if (method === 'GET' && requestCache.has(cacheKey)) {
    const cached = requestCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    requestCache.delete(cacheKey);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (method === 'GET' && data.success) {
    requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  return data;
}

function clearCache() {
  requestCache.clear();
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

function showModal(title, content) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('show');
}

function getStatusBadge(status) {
  const statusMap = {
    'pending': '<span class="status-badge pending">待处理</span>',
    'approved': '<span class="status-badge approved">已通过</span>',
    'completed': '<span class="status-badge completed">已完成</span>',
    'resolved': '<span class="status-badge resolved">已解决</span>',
    'pending_approval': '<span class="status-badge pending_approval">待审批</span>',
    'pending_payment': '<span class="status-badge pending_payment">待支付</span>',
    'in_use': '<span class="status-badge approved">使用中</span>',
    'pending_return': '<span class="status-badge pending">待归还</span>',
    'returned': '<span class="status-badge resolved">已归还</span>',
    'damaged': '<span class="status-badge pending_payment">已损坏</span>',
    'active': '<span class="status-badge approved">在职</span>',
    'pending_resignation': '<span class="status-badge pending">待离职</span>',
    'resigned': '<span class="status-badge completed">已离职</span>'
  };
  return statusMap[status] || status;
}

function getTypeLabel(type) {
  const typeMap = {
    'asset_number_change': '资产编号变更',
    'employee_resignation': '员工离职',
    'return_acceptance': '归还验收',
    'loan': '领用',
    'return': '归还',
    'damage_report': '损坏报告',
    'fee_advance': '扣费推进',
    'acceptance': '验收'
  };
  return typeMap[type] || type;
}

async function loadOverview() {
  const response = await apiRequest(`${API_BASE}/api/overview`);
  
  if (response.success) {
    const stats = response.data;
    const statsGrid = document.getElementById('statsGrid');
    
    statsGrid.innerHTML = `
      <div class="stat-card blue">
        <div class="stat-value">${stats.totalAssets}</div>
        <div class="stat-label">总资产数量</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">${stats.inUseAssets}</div>
        <div class="stat-label">使用中资产</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-value">${stats.pendingReturnAssets}</div>
        <div class="stat-label">待归还资产</div>
      </div>
      <div class="stat-card red">
        <div class="stat-value">${stats.pendingReviews}</div>
        <div class="stat-label">待复核记录</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-value">${stats.pendingAcceptances}</div>
        <div class="stat-label">待验收</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">${stats.pendingFees}</div>
        <div class="stat-label">待处理扣费</div>
      </div>
    `;
  }
}

async function loadEmployees() {
  const response = await apiRequest(`${API_BASE}/api/employees`);
  
  if (response.success) {
    const employeeSelect = document.getElementById('employeeSelect');
    const responsibleFilter = document.getElementById('responsiblePersonFilter');
    
    let employeeOptions = '<option value="">选择员工</option>';
    let responsibleOptions = '<option value="">全部责任人</option>';
    
    response.data.forEach(emp => {
      const statusText = emp.status === 'active' ? '' : ` (${emp.status === 'pending_resignation' ? '待离职' : '已离职'})`;
      employeeOptions += `<option value="${emp.id}">${emp.name} - ${emp.department}${statusText}</option>`;
      responsibleOptions += `<option value="${emp.name}">${emp.name}</option>`;
    });
    
    employeeSelect.innerHTML = employeeOptions;
    responsibleFilter.innerHTML = responsibleOptions + '<option value="管理员A">管理员A</option><option value="系统管理员">系统管理员</option>';
  }
}

async function loadReviewRecords() {
  const params = new URLSearchParams();
  if (currentFilters.status) params.append('status', currentFilters.status);
  
  const response = await apiRequest(`${API_BASE}/api/review-records?${params.toString()}`);
  
  if (response.success) {
    const tbody = document.getElementById('reviewsTableBody');
    
    if (response.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无复核记录</td></tr>';
      return;
    }
    
    tbody.innerHTML = response.data.map(item => `
      <tr>
        <td>${getTypeLabel(item.type)}</td>
        <td>${item.assetNumber || '-'}</td>
        <td>${item.employeeName || '-'}</td>
        <td><span class="change-before">${item.oldValue || item.oldStatus || item.oldCondition || '-'}</span></td>
        <td><span class="change-after">${item.newValue || item.newStatus || item.newCondition || '-'}</span></td>
        <td>${getStatusBadge(item.status)}</td>
        <td>
          <button class="btn btn-secondary btn-action" onclick="viewReviewDetail('${item.id}')">详情</button>
        </td>
      </tr>
    `).join('');
  }
}

async function loadAcceptances() {
  const params = new URLSearchParams();
  if (currentFilters.status) params.append('status', currentFilters.status);
  
  const response = await apiRequest(`${API_BASE}/api/return-acceptances?${params.toString()}`);
  
  if (response.success) {
    const tbody = document.getElementById('acceptancesTableBody');
    
    if (response.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无归还验收记录</td></tr>';
      return;
    }
    
    tbody.innerHTML = response.data.map(item => `
      <tr>
        <td>${item.assetNumber}</td>
        <td>${item.employeeName}</td>
        <td>${item.acceptanceDate}</td>
        <td><span class="change-before">${item.oldCondition}</span></td>
        <td><span class="change-after">${item.newCondition}</span></td>
        <td>${getStatusBadge(item.status)}</td>
        <td>
          <button class="btn btn-secondary btn-action" onclick="viewAcceptanceDetail('${item.id}')">详情</button>
        </td>
      </tr>
    `).join('');
  }
}

async function loadFees() {
  const params = new URLSearchParams();
  if (currentFilters.status) params.append('status', currentFilters.status);
  
  const response = await apiRequest(`${API_BASE}/api/damage-fees?${params.toString()}`);
  
  if (response.success) {
    const tbody = document.getElementById('feesTableBody');
    
    if (response.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无损坏扣费记录</td></tr>';
      return;
    }
    
    tbody.innerHTML = response.data.map(item => `
      <tr>
        <td>${item.assetNumber}</td>
        <td>${item.employeeName}</td>
        <td>${item.damageType}</td>
        <td>¥${item.newFeeAmount || item.feeAmount || 0}</td>
        <td><span class="change-before">${item.oldStatus || '-'}</span></td>
        <td><span class="change-after">${item.newStatus || item.status}</span></td>
        <td>${getStatusBadge(item.status)}</td>
        <td>
          <button class="btn btn-primary btn-action" onclick="advanceFee('${item.id}')" ${item.status === 'completed' ? 'disabled' : ''}>推进</button>
          <button class="btn btn-secondary btn-action" onclick="viewFeeDetail('${item.id}')">详情</button>
        </td>
      </tr>
    `).join('');
  }
}

async function loadDifferences() {
  const params = new URLSearchParams();
  if (currentFilters.status) params.append('status', currentFilters.status);
  if (currentFilters.responsiblePerson) params.append('responsiblePerson', currentFilters.responsiblePerson);
  if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
  if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
  
  const response = await apiRequest(`${API_BASE}/api/inventory-differences?${params.toString()}`);
  
  if (response.success) {
    const tbody = document.getElementById('differencesTableBody');
    
    if (response.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无盘点差异记录</td></tr>';
      return;
    }
    
    tbody.innerHTML = response.data.map(item => `
      <tr>
        <td>${item.assetNumber}</td>
        <td>${item.previousAssetNumber || '-'}</td>
        <td>${item.discrepancyType}</td>
        <td>${item.responsiblePersonName}</td>
        <td>${item.reportDate}</td>
        <td>${getStatusBadge(item.status)}</td>
        <td>
          <button class="btn btn-secondary btn-action" onclick="viewDifferenceDetail('${item.id}')">详情</button>
        </td>
      </tr>
    `).join('');
  }
}

async function loadTrails() {
  const response = await apiRequest(`${API_BASE}/api/asset-trails`);
  
  if (response.success) {
    const tbody = document.getElementById('trailsTableBody');
    
    if (response.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无设备轨迹记录</td></tr>';
      return;
    }
    
    tbody.innerHTML = response.data.slice(0, 50).map(item => `
      <tr>
        <td>${item.assetNumber}${item.previousAssetNumber && item.previousAssetNumber !== item.assetNumber ? `<br><small>(${item.previousAssetNumber})</small>` : ''}</td>
        <td>${getTypeLabel(item.action)}</td>
        <td>${item.oldValue || item.oldStatus || item.oldCondition || item.oldLocation || item.oldHolderName || '-'}</td>
        <td>${item.newValue || item.newStatus || item.newCondition || item.newLocation || item.newHolderName || '-'}</td>
        <td>${new Date(item.timestamp).toLocaleString('zh-CN')}</td>
        <td>${item.operatorName || item.operator}</td>
      </tr>
    `).join('');
  }
}

async function viewReviewDetail(id) {
  const response = await apiRequest(`${API_BASE}/api/review-records`);
  
  if (response.success) {
    const item = response.data.find(r => r.id === id);
    if (item) {
      const content = `
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>类型</label><value>${getTypeLabel(item.type)}</value></div>
            <div class="detail-item"><label>状态</label><value>${getStatusBadge(item.status)}</value></div>
            <div class="detail-item"><label>变更日期</label><value>${item.changeDate}</value></div>
          </div>
        </div>
        ${item.assetNumber ? `
        <div class="detail-section">
          <h4>资产信息</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>资产编号</label><value>${item.assetNumber}</value></div>
            ${item.previousAssetNumber ? `<div class="detail-item"><label>旧资产编号</label><value>${item.previousAssetNumber}</value></div>` : ''}
          </div>
        </div>
        ` : ''}
        ${item.employeeName ? `
        <div class="detail-section">
          <h4>员工信息</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>员工</label><value>${item.employeeName}</value></div>
          </div>
        </div>
        ` : ''}
        <div class="detail-section">
          <h4>变更详情</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>变更前</label><value class="change-before">${item.oldValue || item.oldStatus || item.oldCondition || '-'}</value></div>
            <div class="detail-item"><label>变更后</label><value class="change-after">${item.newValue || item.newStatus || item.newCondition || '-'}</value></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>备注</h4>
          <p>${item.notes || '无'}</p>
        </div>
      `;
      showModal('复核记录详情', content);
    }
  }
}

async function viewAcceptanceDetail(id) {
  const response = await apiRequest(`${API_BASE}/api/return-acceptances`);
  
  if (response.success) {
    const item = response.data.find(a => a.id === id);
    if (item) {
      const checkItems = item.checkItems ? `
        <div class="detail-section">
          <h4>验收项目</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>外观检查</label>
              <value>${item.checkItems.appearance ? (item.checkItems.appearance.passed ? '通过' : '不通过') : '-'}</value>
            </div>
            <div class="detail-item">
              <label>功能检查</label>
              <value>${item.checkItems.function ? (item.checkItems.function.passed ? '通过' : '不通过') : '-'}</value>
            </div>
            <div class="detail-item">
              <label>配件检查</label>
              <value>${item.checkItems.accessories ? (item.checkItems.accessories.passed ? '通过' : '不通过') : '-'}</value>
            </div>
          </div>
        </div>
      ` : '';
      
      const content = `
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>资产编号</label><value>${item.assetNumber}</value></div>
            <div class="detail-item"><label>员工</label><value>${item.employeeName}</value></div>
            <div class="detail-item"><label>归还日期</label><value>${item.returnDate}</value></div>
            <div class="detail-item"><label>验收日期</label><value>${item.acceptanceDate}</value></div>
            <div class="detail-item"><label>状态</label><value>${getStatusBadge(item.status)}</value></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>设备状态变更</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>变更前</label><value class="change-before">${item.oldCondition}</value></div>
            <div class="detail-item"><label>变更后</label><value class="change-after">${item.newCondition}</value></div>
          </div>
        </div>
        ${checkItems}
        <div class="detail-section">
          <h4>备注</h4>
          <p>${item.notes || '无'}</p>
        </div>
        <div class="detail-section">
          <h4>操作人</h4>
          <p>${item.operatorName || item.operator}</p>
        </div>
      `;
      showModal('归还验收详情', content);
    }
  }
}

async function viewFeeDetail(id) {
  const response = await apiRequest(`${API_BASE}/api/damage-fees`);
  
  if (response.success) {
    const item = response.data.find(f => f.id === id);
    if (item) {
      const content = `
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>资产编号</label><value>${item.assetNumber}</value></div>
            <div class="detail-item"><label>员工</label><value>${item.employeeName}</value></div>
            <div class="detail-item"><label>损坏类型</label><value>${item.damageType}</value></div>
            <div class="detail-item"><label>费用金额</label><value>¥${item.newFeeAmount || item.feeAmount || 0}</value></div>
            <div class="detail-item"><label>报告日期</label><value>${item.reportDate}</value></div>
            <div class="detail-item"><label>到期日期</label><value>${item.dueDate}</value></div>
            <div class="detail-item"><label>状态</label><value>${getStatusBadge(item.status)}</value></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>状态变更</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>变更前</label><value class="change-before">${item.oldStatus || '-'}</value></div>
            <div class="detail-item"><label>变更后</label><value class="change-after">${item.newStatus || item.status}</value></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>损坏描述</h4>
          <p>${item.description || '无'}</p>
        </div>
        <div class="detail-section">
          <h4>操作人</h4>
          <p>${item.operatorName || item.operator}</p>
        </div>
      `;
      showModal('损坏扣费详情', content);
    }
  }
}

async function viewDifferenceDetail(id) {
  const response = await apiRequest(`${API_BASE}/api/inventory-differences`);
  
  if (response.success) {
    const item = response.data.find(d => d.id === id);
    if (item) {
      const content = `
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>资产编号</label><value>${item.assetNumber}</value></div>
            <div class="detail-item"><label>旧资产编号</label><value>${item.previousAssetNumber || '-'}</value></div>
            <div class="detail-item"><label>盘点周期</label><value>${item.inventoryPeriod}</value></div>
            <div class="detail-item"><label>差异类型</label><value>${item.discrepancyType}</value></div>
            <div class="detail-item"><label>报告日期</label><value>${item.reportDate}</value></div>
            <div class="detail-item"><label>状态</label><value>${getStatusBadge(item.status)}</value></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>位置变更</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>旧位置</label><value class="change-before">${item.oldLocation || '-'}</value></div>
            <div class="detail-item"><label>新位置</label><value class="change-after">${item.newLocation || '-'}</value></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>状态变更</h4>
          <div class="detail-grid">
            <div class="detail-item"><label>旧状态</label><value class="change-before">${item.oldStatus || '-'}</value></div>
            <div class="detail-item"><label>新状态</label><value class="change-after">${item.newStatus || '-'}</value></div>
          </div>
        </div>
        <div class="detail-section">
          <h4>责任人</h4>
          <p>${item.responsiblePersonName}</p>
        </div>
        <div class="detail-section">
          <h4>描述</h4>
          <p>${item.description || '无'}</p>
        </div>
        <div class="detail-section">
          <h4>备注</h4>
          <p>${item.notes || '无'}</p>
        </div>
      `;
      showModal('盘点差异详情', content);
    }
  }
}

async function advanceFee(id) {
  if (!confirm('确定要推进此损坏扣费流程吗？')) return;
  
  const response = await apiRequest(`${API_BASE}/api/damage-fees/${id}/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approver: 'admin-01',
      approverName: '系统管理员'
    })
  });
  
  if (response.success) {
    if (response.data._cached) {
      showToast('请求已处理（重复请求已忽略）', 'info');
    } else {
      showToast(`扣费已从 ${response.data.oldStatus} 推进到 ${response.data.newStatus}`, 'success');
    }
    clearCache();
    loadFees();
    loadOverview();
  } else {
    showToast(response.error || '推进失败', 'error');
  }
}

async function validateResignation() {
  const employeeId = document.getElementById('employeeSelect').value;
  
  if (!employeeId) {
    showToast('请选择员工', 'error');
    return;
  }
  
  const resultDiv = document.getElementById('validationResult');
  resultDiv.innerHTML = '<p>正在校验...</p>';
  
  const response = await apiRequest(`${API_BASE}/api/employees/${employeeId}/validate-resignation`);
  
  if (response.success) {
    const data = response.data;
    let html = '';
    
    if (data.canProceed) {
      html = `
        <div class="validation-success">
          <strong>${data.employeeName}</strong> - 离职校验通过
          <br><br>
          <strong>当前状态：</strong>${getStatusBadge(data.currentStatus)}
          <br>
          <strong>可处理状态：</strong>${data.canProceed ? '是' : '否'}
        </div>
      `;
    } else {
      const issues = [];
      
      if (data.issues.pendingAssets.length > 0) {
        issues.push(`待归还资产: ${data.issues.pendingAssets.length} 项`);
      }
      if (data.issues.pendingAcceptances.length > 0) {
        issues.push(`待验收: ${data.issues.pendingAcceptances.length} 项`);
      }
      if (data.issues.pendingFees.length > 0) {
        issues.push(`待处理扣费: ${data.issues.pendingFees.length} 项`);
      }
      
      html = `
        <div class="validation-warning">
          <strong>${data.employeeName}</strong> - 离职校验发现问题
          <br><br>
          <strong>当前状态：</strong>${getStatusBadge(data.currentStatus)}
          <br><br>
          <strong>发现以下问题：</strong>
          <ul class="issues-list">
            ${issues.map(issue => `<li>${issue}</li>`).join('')}
          </ul>
          <strong>状态变更：</strong><span class="change-before">${data.oldStatus}</span> → <span class="change-after">${data.newStatus}</span>
        </div>
      `;
    }
    
    resultDiv.innerHTML = html;
    showToast('校验完成', 'info');
  } else {
    resultDiv.innerHTML = `<div class="validation-error">校验失败: ${response.error}</div>`;
  }
}

async function saveDifference(e) {
  e.preventDefault();
  
  const formData = {
    assetNumber: document.getElementById('diffAssetNumber').value,
    previousAssetNumber: document.getElementById('diffPrevNumber').value || null,
    inventoryPeriod: document.getElementById('diffPeriod').value,
    oldLocation: document.getElementById('diffOldLocation').value || null,
    newLocation: document.getElementById('diffNewLocation').value || null,
    oldStatus: document.getElementById('diffOldStatus').value || null,
    newStatus: document.getElementById('diffNewStatus').value || null,
    discrepancyType: document.getElementById('diffType').value || null,
    description: document.getElementById('diffDescription').value,
    responsiblePerson: null,
    responsiblePersonName: document.getElementById('diffResponsible').value,
    notes: document.getElementById('diffNotes').value || null
  };
  
  const response = await apiRequest(`${API_BASE}/api/inventory-differences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  
  if (response.success) {
    if (response.data._cached) {
      showToast('数据已保存（重复请求已忽略）', 'info');
    } else if (response.data.isNew) {
      showToast('盘点差异已保存成功', 'success');
    } else {
      showToast('盘点差异已更新', 'info');
    }
    
    e.target.reset();
    clearCache();
    loadDifferences();
    loadOverview();
  } else {
    showToast(response.error || '保存失败', 'error');
  }
}

async function performSearch() {
  const q = document.getElementById('globalSearch').value;
  const type = document.getElementById('searchType').value;
  
  if (!q.trim()) {
    showToast('请输入搜索关键词', 'error');
    return;
  }
  
  const response = await apiRequest(`${API_BASE}/api/search?q=${encodeURIComponent(q)}&type=${type}`);
  
  if (response.success) {
    const data = response.data;
    let totalResults = 0;
    let content = '';
    
    Object.entries(data).forEach(([category, items]) => {
      if (items.length > 0) {
        totalResults += items.length;
        const categoryNames = {
          assets: '资产',
          employees: '员工',
          acceptances: '归还验收',
          fees: '损坏扣费',
          differences: '盘点差异'
        };
        
        content += `
          <div class="detail-section">
            <h4>${categoryNames[category] || category} (${items.length})</h4>
            <ul class="issues-list">
              ${items.map(item => `
                <li>
                  <strong>${item.assetNumber || item.name || item.employeeName || item.responsiblePersonName}</strong>
                  ${item.name ? ` - ${item.name}` : ''}
                  ${item.status ? ` - ${item.status}` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }
    });
    
    if (totalResults === 0) {
      content = '<div class="empty-state">未找到匹配的结果</div>';
    }
    
    showModal(`搜索结果 - 共 ${totalResults} 条`, content);
  }
}

function exportReport() {
  const params = new URLSearchParams();
  if (currentFilters.responsiblePerson) params.append('responsiblePerson', currentFilters.responsiblePerson);
  if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
  if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
  
  window.open(`${API_BASE}/api/export/report?${params.toString()}&format=csv`, '_blank');
  showToast('报告导出中...', 'info');
}

function applyFilters() {
  currentFilters = {
    status: document.getElementById('statusFilter').value,
    responsiblePerson: document.getElementById('responsiblePersonFilter').value,
    startDate: document.getElementById('startDateFilter').value,
    endDate: document.getElementById('endDateFilter').value
  };
  
  clearCache();
  loadAllData();
  showToast('筛选条件已应用', 'info');
}

function resetFilters() {
  document.getElementById('statusFilter').value = '';
  document.getElementById('responsiblePersonFilter').value = '';
  document.getElementById('startDateFilter').value = '';
  document.getElementById('endDateFilter').value = '';
  
  currentFilters = {
    status: '',
    responsiblePerson: '',
    startDate: '',
    endDate: ''
  };
  
  clearCache();
  loadAllData();
  showToast('筛选条件已重置', 'info');
}

function loadAllData() {
  loadOverview();
  loadReviewRecords();
  loadAcceptances();
  loadFees();
  loadDifferences();
  loadTrails();
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
}

function setupEventListeners() {
  document.getElementById('searchBtn').addEventListener('click', performSearch);
  document.getElementById('globalSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  
  document.getElementById('applyFilters').addEventListener('click', applyFilters);
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
  
  document.getElementById('validateBtn').addEventListener('click', validateResignation);
  
  document.getElementById('diffForm').addEventListener('submit', saveDifference);
  
  document.getElementById('exportBtn').addEventListener('click', exportReport);
  
  document.querySelector('.close-modal').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
}

function init() {
  setupTabs();
  setupEventListeners();
  loadEmployees();
  loadAllData();
}

document.addEventListener('DOMContentLoaded', init);
