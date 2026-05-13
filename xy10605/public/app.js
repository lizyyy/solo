const API_BASE = '/api';
let workOrders = [];
let contracts = [];
let currentWorkOrder = null;
let currentUser = '系统管理员';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadAllData();
});

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const tab = item.dataset.tab;
      document.querySelectorAll('[id$="-tab"]').forEach(t => t.classList.add('hidden'));
      document.getElementById(`${tab}-tab`).classList.remove('hidden');
      
      if (tab === 'export') {
        loadExportData();
      }
    });
  });
}

async function apiRequest(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  return response.json();
}

async function loadAllData() {
  try {
    const [statsRes, ordersRes, contractsRes, evidenceRes, reworkRes, billsRes] = await Promise.all([
      apiRequest('/statistics'),
      apiRequest('/work-orders'),
      apiRequest('/contracts'),
      apiRequest('/evidence-missing'),
      apiRequest('/rework-relations'),
      apiRequest('/outsourcing-bills')
    ]);

    if (statsRes.success) {
      updateStatistics(statsRes.data);
    }

    if (ordersRes.success) {
      workOrders = ordersRes.data;
      renderWorkOrders(ordersRes.data);
    }

    if (contractsRes.success) {
      contracts = contractsRes.data;
      renderContracts(contractsRes.data);
    }

    if (evidenceRes.success) {
      renderEvidenceMissing(evidenceRes.data);
    }

    if (reworkRes.success) {
      renderReworkRelations(reworkRes.data);
    }

    if (billsRes.success) {
      renderBills(billsRes.data);
    }
  } catch (error) {
    showToast('加载数据失败', 'error');
    console.error(error);
  }
}

function updateStatistics(stats) {
  const wo = stats.work_orders || {};
  const ev = stats.evidence_missing || {};
  const bl = stats.bills || {};

  document.getElementById('stat-total').textContent = wo.total || 0;
  document.getElementById('stat-pending').textContent = wo.pending || 0;
  document.getElementById('stat-inprogress').textContent = wo.in_progress || 0;
  document.getElementById('stat-completed').textContent = wo.completed || 0;
  document.getElementById('stat-reviewed').textContent = wo.reviewed || 0;
  document.getElementById('stat-exception').textContent = wo.exception || 0;
  document.getElementById('stat-amount').textContent = `¥${(wo.total_amount || 0).toLocaleString()}`;

  document.getElementById('stat-evidence-pending').textContent = ev.pending || 0;
  document.getElementById('stat-evidence-resolved').textContent = ev.resolved || 0;

  document.getElementById('stat-bill-draft').textContent = bl.draft || 0;
  document.getElementById('stat-bill-submitted').textContent = bl.submitted || 0;
  document.getElementById('stat-bill-approved').textContent = bl.approved || 0;
  document.getElementById('stat-bill-amount').textContent = `¥${(bl.total_amount || 0).toLocaleString()}`;
}

function getStatusBadge(status) {
  const labels = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
    reviewed: '已复核',
    exception: '异常',
    rejected: '已拒绝',
    draft: '草稿',
    submitted: '已提交',
    approved: '已审批',
    active: '生效中'
  };
  return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
}

function renderWorkOrders(orders) {
  const tbody = document.getElementById('work-orders-table');
  
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td><strong>${order.order_no}</strong></td>
      <td>${order.asset_name}</td>
      <td>${order.vendor_name}</td>
      <td>${order.assigned_worker || '-'}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${order.fault_description}</td>
      <td>${order.actual_hours ? order.actual_hours + 'h' : '-'}</td>
      <td>${order.total_amount ? '¥' + order.total_amount.toLocaleString() : '-'}</td>
      <td>${getStatusBadge(order.status)}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-info" onclick="showWorkOrderDetail('${order.id}')">详情</button>
          ${getActionButtons(order)}
        </div>
      </td>
    </tr>
  `).join('');
}

function getActionButtons(order) {
  let buttons = '';
  
  if (order.status === 'pending') {
    buttons += `<button class="btn btn-sm btn-success" onclick="updateWorkOrderStatus('${order.id}', 'in_progress', '开始处理')">开始</button>`;
  }
  if (order.status === 'in_progress') {
    buttons += `<button class="btn btn-sm btn-success" onclick="updateWorkOrderStatus('${order.id}', 'completed', '维修完成')">完成</button>`;
    buttons += `<button class="btn btn-sm btn-danger" onclick="updateWorkOrderStatus('${order.id}', 'exception', '异常情况')">异常</button>`;
  }
  if (order.status === 'completed') {
    buttons += `<button class="btn btn-sm btn-primary" onclick="updateWorkOrderStatus('${order.id}', 'reviewed', '复核通过')">复核</button>`;
  }
  if (order.status === 'exception') {
    buttons += `<button class="btn btn-sm btn-warning" onclick="updateWorkOrderStatus('${order.id}', 'in_progress', '继续处理')">继续</button>`;
  }
  
  return buttons;
}

function renderContracts(contracts) {
  const tbody = document.getElementById('contracts-table');
  
  if (!contracts.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = contracts.map(c => `
    <tr>
      <td><strong>${c.contract_no}</strong></td>
      <td>${c.vendor_name}</td>
      <td>¥${c.base_price}/小时</td>
      <td>${c.overtime_rate}倍</td>
      <td>${c.repair_hours_limit}小时</td>
      <td>${c.effective_date} ~ ${c.expiry_date}</td>
      <td>${getStatusBadge(c.status)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-info" onclick="showContractDetail('${c.id}')">详情</button>
          <button class="btn btn-sm btn-warning" onclick="showEditContractModal('${c.id}')">编辑</button>
          <button class="btn btn-sm btn-primary" onclick="showContractHistory('${c.id}')">历史</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderEvidenceMissing(records) {
  const tbody = document.getElementById('evidence-table');
  
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => {
    const order = workOrders.find(o => o.id === r.work_order_id);
    return `
      <tr>
        <td>${order ? order.order_no : r.work_order_id}</td>
        <td>${r.missing_type}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${r.description}</td>
        <td><span class="status-badge severity-${r.severity}">${r.severity === 'high' ? '高' : r.severity === 'medium' ? '中' : '低'}</span></td>
        <td>${r.responsible_person || '-'}</td>
        <td>${getStatusBadge(r.status)}</td>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td>
          ${r.status === 'pending' ? 
            `<button class="btn btn-sm btn-success" onclick="resolveEvidence('${r.id}')">标记解决</button>` : 
            '<span class="status-badge status-resolved">已解决</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function renderReworkRelations(relations) {
  const tbody = document.getElementById('rework-table');
  
  if (!relations.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = relations.map(r => `
    <tr>
      <td><strong>${r.original_order_no}</strong></td>
      <td><strong>${r.rework_order_no}</strong></td>
      <td>${r.relation_type === 'rework' ? '复修' : r.relation_type}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${r.reason}</td>
      <td>${r.created_by}</td>
      <td>${new Date(r.created_at).toLocaleString()}</td>
    </tr>
  `).join('');
}

function renderBills(bills) {
  const tbody = document.getElementById('bills-table');
  
  if (!bills.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = bills.map(b => `
    <tr>
      <td><strong>${b.bill_no}</strong></td>
      <td>${b.vendor_name}</td>
      <td>¥${(b.base_total || 0).toLocaleString()}</td>
      <td>¥${(b.overtime_total || 0).toLocaleString()}</td>
      <td class="text-danger">¥${(b.deduction_total || 0).toLocaleString()}</td>
      <td><strong>¥${(b.final_amount || 0).toLocaleString()}</strong></td>
      <td>${getStatusBadge(b.status)}</td>
      <td>${new Date(b.created_at).toLocaleDateString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-info" onclick="showBillDetail('${b.id}')">详情</button>
          ${b.status === 'draft' ? `<button class="btn btn-sm btn-warning" onclick="submitBill('${b.id}')">提交</button>` : ''}
          ${b.status === 'submitted' ? `<button class="btn btn-sm btn-success" onclick="approveBill('${b.id}')">审批</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function showWorkOrderDetail(orderId) {
  try {
    const orderRes = await apiRequest(`/work-orders/${orderId}`);
    const photosRes = await apiRequest(`/work-orders/${orderId}/photos`);
    const deductionsRes = await apiRequest(`/work-orders/${orderId}/overtime-deductions`);
    const evidenceRes = await apiRequest(`/work-orders/${orderId}/evidence-missing`);
    const reworkRes = await apiRequest(`/work-orders/${orderId}/rework-relations`);
    const statusHistoryRes = await apiRequest(`/work-orders/${orderId}/status-history`);
    const historyRes = await apiRequest(`/work-orders/${orderId}/history`);

    if (!orderRes.success) throw new Error(orderRes.error);

    const order = orderRes.data;
    const photos = photosRes.data || [];
    const deductions = deductionsRes.data || [];
    const evidence = evidenceRes.data || [];
    const rework = reworkRes.data || [];
    const statusHistory = statusHistoryRes.data || [];
    const history = historyRes.data || [];

    let activeTab = 'info';
    
    const renderDetail = () => `
      <div class="tabs">
        <div class="tab ${activeTab === 'info' ? 'active' : ''}" onclick="activeTab='info'; renderModal()">基本信息</div>
        <div class="tab ${activeTab === 'photos' ? 'active' : ''}" onclick="activeTab='photos'; renderModal()">到场照片</div>
        <div class="tab ${activeTab === 'deductions' ? 'active' : ''}" onclick="activeTab='deductions'; renderModal()">超时扣款</div>
        <div class="tab ${activeTab === 'rework' ? 'active' : ''}" onclick="activeTab='rework'; renderModal()">复修关联</div>
        <div class="tab ${activeTab === 'history' ? 'active' : ''}" onclick="activeTab='history'; renderModal()">历史记录</div>
      </div>
      
      ${activeTab === 'info' ? `
        <table class="detail-table">
          <tr><th>工单号</th><td>${order.order_no}</td></tr>
          <tr><th>资产名称</th><td>${order.asset_name}</td></tr>
          <tr><th>故障描述</th><td>${order.fault_description}</td></tr>
          <tr><th>外包商</th><td>${order.vendor_name}</td></tr>
          <tr><th>负责人</th><td>${order.assigned_worker || '-'}</td></tr>
          <tr><th>实际工时</th><td>${order.actual_hours ? order.actual_hours + ' 小时' : '-'}</td></tr>
          <tr><th>基础金额</th><td>¥${(order.base_amount || 0).toLocaleString()}</td></tr>
          <tr><th>超时金额</th><td>¥${(order.overtime_amount || 0).toLocaleString()}</td></tr>
          <tr><th>扣款金额</th><td class="text-danger">¥${(order.deduction_amount || 0).toLocaleString()}</td></tr>
          <tr><th>总金额</th><td><strong>¥${(order.total_amount || 0).toLocaleString()}</strong></td></tr>
          <tr><th>状态</th><td>${getStatusBadge(order.status)}</td></tr>
          <tr><th>创建人</th><td>${order.created_by}</td></tr>
          <tr><th>创建时间</th><td>${new Date(order.created_at).toLocaleString()}</td></tr>
        </table>
        
        <h4 style="margin-top: 20px; margin-bottom: 10px;">证据缺失记录</h4>
        ${evidence.length ? evidence.map(e => `
          <div class="history-item">
            <div class="time">${new Date(e.created_at).toLocaleString()} | 严重程度: ${e.severity === 'high' ? '高' : '中'}</div>
            <div class="detail">
              <strong>${e.missing_type}</strong>: ${e.description}
              <br>责任人: ${e.responsible_person || '-'} | 状态: ${e.status}
            </div>
          </div>
        `).join('') : '<p>无证据缺失记录</p>'}
      ` : ''}
      
      ${activeTab === 'photos' ? `
        <h4 style="margin-bottom: 10px;">到场照片 (${photos.length}张)</h4>
        ${photos.length ? `
          <div class="photo-grid">
            ${photos.map(p => `
              <div class="photo-item">
                <img src="${p.photo_url}" alt="${p.photo_name}">
                <div class="photo-info">
                  <strong>${p.photo_name}</strong><br>
                  上传人: ${p.uploaded_by}<br>
                  ${new Date(p.uploaded_at).toLocaleDateString()}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p>暂无到场照片</p>'}
        
        <h4 style="margin-top: 20px; margin-bottom: 10px;">添加照片</h4>
        <div class="form-group">
          <label>照片URL</label>
          <input type="text" id="new-photo-url" placeholder="请输入照片URL">
        </div>
        <div class="form-group">
          <label>照片名称</label>
          <input type="text" id="new-photo-name" placeholder="请输入照片名称">
        </div>
        <button class="btn btn-primary" onclick="addPhoto('${orderId}')">添加照片</button>
      ` : ''}
      
      ${activeTab === 'deductions' ? `
        <h4 style="margin-bottom: 10px;">超时扣款记录 (${deductions.length}条)</h4>
        ${deductions.length ? deductions.map(d => `
          <div class="history-item">
            <div class="time">${new Date(d.created_at).toLocaleString()}</div>
            <div class="detail">
              超时 ${d.overtime_hours} 小时 | 费率: ${d.overtime_rate}倍
              <br>扣款金额: <strong class="text-danger">¥${d.deduction_amount.toLocaleString()}</strong>
              <br>原因: ${d.deduction_reason}
              <br>核实人: ${d.verified_by}
            </div>
          </div>
        `).join('') : '<p>无超时扣款记录</p>'}
      ` : ''}
      
      ${activeTab === 'rework' ? `
        <h4 style="margin-bottom: 10px;">复修关联 (${rework.length}条)</h4>
        ${rework.length ? rework.map(r => `
          <div class="history-item">
            <div class="time">${new Date(r.created_at).toLocaleString()}</div>
            <div class="detail">
              <strong>原工单</strong>: ${r.original_order_no || r.original_work_order_id}
              <br><strong>复修工单</strong>: ${r.rework_order_no || r.rework_work_order_id}
              <br><strong>原因</strong>: ${r.reason}
              <br><strong>创建人</strong>: ${r.created_by}
            </div>
          </div>
        `).join('') : '<p>无复修关联</p>'}
      ` : ''}
      
      ${activeTab === 'history' ? `
        <h4 style="margin-bottom: 10px;">状态变更历史</h4>
        ${statusHistory.length ? statusHistory.map(h => `
          <div class="history-item">
            <div class="time">${new Date(h.changed_at).toLocaleString()} | 操作人: ${h.changed_by}</div>
            <div class="detail">
              ${h.old_status ? `${getStatusBadge(h.old_status)} → ` : ''}${getStatusBadge(h.new_status)}
              <br>${h.remark}
            </div>
          </div>
        `).join('') : '<p>无状态变更记录</p>'}
        
        <h4 style="margin-top: 20px; margin-bottom: 10px;">字段修改历史</h4>
        ${history.length ? history.map(h => `
          <div class="history-item">
            <div class="time">${new Date(h.modified_at).toLocaleString()} | 修改人: ${h.modified_by}</div>
            <div class="detail">
              <strong>${h.field}</strong>: 
              <span class="text-danger" style="text-decoration: line-through;">${h.old_value}</span> 
              → 
              <span class="text-success">${h.new_value}</span>
              <br>原因: ${h.reason}
            </div>
          </div>
        `).join('') : '<p>无字段修改记录</p>'}
      ` : ''}
    `;

    const renderModal = () => {
      showModal('工单详情', renderDetail());
    };

    renderModal();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function showContractDetail(contractId) {
  try {
    const res = await apiRequest(`/contracts/${contractId}`);
    if (!res.success) throw new Error(res.error);
    
    const c = res.data;
    showModal('合同详情', `
      <table class="detail-table">
        <tr><th>合同编号</th><td>${c.contract_no}</td></tr>
        <tr><th>外包商</th><td>${c.vendor_name}</td></tr>
        <tr><th>基础单价</th><td>¥${c.base_price}/小时</td></tr>
        <tr><th>超时费率</th><td>${c.overtime_rate}倍</td></tr>
        <tr><th>限定时长</th><td>${c.repair_hours_limit}小时</td></tr>
        <tr><th>生效日期</th><td>${c.effective_date}</td></tr>
        <tr><th>到期日期</th><td>${c.expiry_date}</td></tr>
        <tr><th>状态</th><td>${getStatusBadge(c.status)}</td></tr>
      </table>
    `);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function showContractHistory(contractId) {
  try {
    const res = await apiRequest(`/contracts/${contractId}/history`);
    const history = res.data || [];
    
    showModal('合同修改历史', `
      <h4 style="margin-bottom: 15px;">修改历史记录</h4>
      ${history.length ? history.map(h => `
        <div class="history-item">
          <div class="time">${new Date(h.modified_at).toLocaleString()} | 修改人: ${h.modified_by}</div>
          <div class="detail">
            <strong>${h.field}</strong>: 
            <span style="text-decoration: line-through; color: #ef4444;">${h.old_value}</span> 
            → 
            <span style="color: #10b981;">${h.new_value}</span>
            <br>原因: ${h.reason}
          </div>
        </div>
      `).join('') : '<p>无修改历史</p>'}
    `);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function showBillDetail(billId) {
  try {
    const res = await apiRequest(`/outsourcing-bills/${billId}`);
    if (!res.success) throw new Error(res.error);
    
    const b = res.data;
    showModal('账单详情', `
      <table class="detail-table">
        <tr><th>账单编号</th><td>${b.bill_no}</td></tr>
        <tr><th>外包商</th><td>${b.vendor_name}</td></tr>
        <tr><th>关联工单</th><td>${b.work_order_ids ? b.work_order_ids.length + ' 个' : '-'}</td></tr>
        <tr><th>基础金额</th><td>¥${(b.base_total || 0).toLocaleString()}</td></tr>
        <tr><th>超时金额</th><td>¥${(b.overtime_total || 0).toLocaleString()}</td></tr>
        <tr><th>扣款金额</th><td style="color: #ef4444;">¥${(b.deduction_total || 0).toLocaleString()}</td></tr>
        <tr><th>最终金额</th><td><strong style="font-size: 18px;">¥${(b.final_amount || 0).toLocaleString()}</strong></td></tr>
        <tr><th>状态</th><td>${getStatusBadge(b.status)}</td></tr>
        <tr><th>创建人</th><td>${b.created_by}</td></tr>
        <tr><th>创建时间</th><td>${new Date(b.created_at).toLocaleString()}</td></tr>
      </table>
      
      <h4 style="margin-top: 20px; margin-bottom: 10px;">明细项</h4>
      ${b.items && b.items.length ? `
        <table class="detail-table">
          <thead>
            <tr>
              <th>工单号</th>
              <th>基础金额</th>
              <th>超时金额</th>
              <th>扣款金额</th>
              <th>小计</th>
            </tr>
          </thead>
          <tbody>
            ${b.items.map(item => `
              <tr>
                <td>${item.work_order_id.substring(0, 8)}...</td>
                <td>¥${item.base_amount.toLocaleString()}</td>
                <td>¥${item.overtime_amount.toLocaleString()}</td>
                <td style="color: #ef4444;">¥${item.deduction_amount.toLocaleString()}</td>
                <td><strong>¥${item.total_amount.toLocaleString()}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>无明细项</p>'}
    `);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function updateWorkOrderStatus(orderId, status, remark) {
  try {
    const res = await apiRequest(`/work-orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, changed_by: currentUser, remark })
    });
    
    if (res.success) {
      showToast('状态更新成功', 'success');
      loadAllData();
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('操作失败', 'error');
  }
}

async function addPhoto(orderId) {
  const url = document.getElementById('new-photo-url').value;
  const name = document.getElementById('new-photo-name').value;
  
  if (!url) {
    showToast('请输入照片URL', 'error');
    return;
  }
  
  try {
    const res = await apiRequest(`/work-orders/${orderId}/photos`, {
      method: 'POST',
      body: JSON.stringify({
        photo_url: url,
        photo_name: name || '现场照片',
        uploaded_by: currentUser
      })
    });
    
    if (res.success) {
      showToast('照片添加成功', 'success');
      closeModal();
      showWorkOrderDetail(orderId);
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('添加失败', 'error');
  }
}

async function resolveEvidence(recordId) {
  try {
    const res = await apiRequest(`/evidence-missing/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'resolved' })
    });
    
    if (res.success) {
      showToast('已标记为已解决', 'success');
      loadAllData();
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('操作失败', 'error');
  }
}

function showCreateWorkOrderModal() {
  const contractOptions = contracts.map(c => `<option value="${c.id}">${c.contract_no} - ${c.vendor_name}</option>`).join('');
  
  showModal('新建工单', `
    <div class="form-group">
      <label>工单号 *</label>
      <input type="text" id="wo-order-no" placeholder="例如: WO20240001">
    </div>
    <div class="form-group">
      <label>合同 *</label>
      <select id="wo-contract">${contractOptions}</select>
    </div>
    <div class="form-group">
      <label>资产名称 *</label>
      <input type="text" id="wo-asset" placeholder="例如: 中央空调机组A">
    </div>
    <div class="form-group">
      <label>故障描述 *</label>
      <textarea id="wo-fault" rows="3" placeholder="请描述故障情况"></textarea>
    </div>
    <div class="form-group">
      <label>负责人</label>
      <input type="text" id="wo-worker" placeholder="例如: 张三">
    </div>
    <div class="form-group">
      <label>计划时间</label>
      <input type="datetime-local" id="wo-scheduled">
    </div>
    <button class="btn btn-primary" onclick="createWorkOrder()">创建工单</button>
  `);
}

async function createWorkOrder() {
  const contractId = document.getElementById('wo-contract').value;
  const contract = contracts.find(c => c.id === contractId);
  
  const data = {
    order_no: document.getElementById('wo-order-no').value,
    contract_id: contractId,
    asset_name: document.getElementById('wo-asset').value,
    asset_id: 'AST-' + Date.now(),
    fault_description: document.getElementById('wo-fault').value,
    vendor_name: contract ? contract.vendor_name : '',
    vendor_id: contract ? contract.vendor_id : '',
    assigned_worker: document.getElementById('wo-worker').value,
    scheduled_at: document.getElementById('wo-scheduled').value,
    created_by: currentUser
  };
  
  try {
    const res = await apiRequest('/work-orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (res.success) {
      showToast('工单创建成功', 'success');
      closeModal();
      loadAllData();
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('创建失败', 'error');
  }
}

function showCreateContractModal() {
  showModal('新建合同', `
    <div class="form-group">
      <label>合同编号 *</label>
      <input type="text" id="ct-no" placeholder="例如: CT2024001">
    </div>
    <div class="form-group">
      <label>外包商名称 *</label>
      <input type="text" id="ct-vendor" placeholder="例如: 华维维修服务有限公司">
    </div>
    <div class="form-group">
      <label>基础单价 (元/小时) *</label>
      <input type="number" id="ct-price" placeholder="150">
    </div>
    <div class="form-group">
      <label>超时费率 (倍)</label>
      <input type="number" id="ct-rate" step="0.1" placeholder="1.5">
    </div>
    <div class="form-group">
      <label>限定时长 (小时)</label>
      <input type="number" id="ct-limit" placeholder="4">
    </div>
    <div class="form-group">
      <label>生效日期</label>
      <input type="date" id="ct-start">
    </div>
    <div class="form-group">
      <label>到期日期</label>
      <input type="date" id="ct-end">
    </div>
    <button class="btn btn-primary" onclick="createContract()">创建合同</button>
  `);
}

async function createContract() {
  const data = {
    contract_no: document.getElementById('ct-no').value,
    vendor_name: document.getElementById('ct-vendor').value,
    vendor_id: 'V-' + Date.now(),
    base_price: parseFloat(document.getElementById('ct-price').value),
    overtime_rate: parseFloat(document.getElementById('ct-rate').value) || 1.5,
    repair_hours_limit: parseInt(document.getElementById('ct-limit').value) || 4,
    effective_date: document.getElementById('ct-start').value,
    expiry_date: document.getElementById('ct-end').value,
    status: 'active'
  };
  
  try {
    const res = await apiRequest('/contracts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (res.success) {
      showToast('合同创建成功', 'success');
      closeModal();
      loadAllData();
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('创建失败', 'error');
  }
}

function showEditContractModal(contractId) {
  const contract = contracts.find(c => c.id === contractId);
  if (!contract) return;
  
  showModal('编辑合同', `
    <div class="form-group">
      <label>合同编号</label>
      <input type="text" value="${contract.contract_no}" disabled>
    </div>
    <div class="form-group">
      <label>外包商名称</label>
      <input type="text" id="edit-vendor" value="${contract.vendor_name}">
    </div>
    <div class="form-group">
      <label>基础单价 (元/小时)</label>
      <input type="number" id="edit-price" value="${contract.base_price}">
    </div>
    <div class="form-group">
      <label>超时费率 (倍)</label>
      <input type="number" id="edit-rate" step="0.1" value="${contract.overtime_rate}">
    </div>
    <div class="form-group">
      <label>修改原因 *</label>
      <input type="text" id="edit-reason" placeholder="请输入修改原因">
    </div>
    <button class="btn btn-primary" onclick="updateContract('${contractId}')">保存修改</button>
  `);
}

async function updateContract(contractId) {
  const reason = document.getElementById('edit-reason').value;
  if (!reason) {
    showToast('请输入修改原因', 'error');
    return;
  }
  
  const data = {
    vendor_name: document.getElementById('edit-vendor').value,
    base_price: parseFloat(document.getElementById('edit-price').value),
    overtime_rate: parseFloat(document.getElementById('edit-rate').value),
    modified_by: currentUser,
    reason: reason
  };
  
  try {
    const res = await apiRequest(`/contracts/${contractId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    if (res.success) {
      showToast('合同更新成功', 'success');
      closeModal();
      loadAllData();
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('更新失败', 'error');
  }
}

function showCreateReworkModal() {
  const orderOptions = workOrders.map(o => `<option value="${o.id}">${o.order_no} - ${o.asset_name}</option>`).join('');
  
  showModal('新建复修关联', `
    <div class="form-group">
      <label>原工单 *</label>
      <select id="rework-original">${orderOptions}</select>
    </div>
    <div class="form-group">
      <label>复修工单 *</label>
      <select id="rework-rework">${orderOptions}</select>
    </div>
    <div class="form-group">
      <label>关联原因 *</label>
      <textarea id="rework-reason" rows="2" placeholder="请说明复修原因"></textarea>
    </div>
    <p style="color: #666; font-size: 12px; margin-top: 5px;">
      注意: 复修工单必须与原工单属于同一外包商
    </p>
    <button class="btn btn-primary" onclick="createReworkRelation()">创建关联</button>
  `);
}

async function createReworkRelation() {
  const data = {
    original_work_order_id: document.getElementById('rework-original').value,
    rework_work_order_id: document.getElementById('rework-rework').value,
    reason: document.getElementById('rework-reason').value,
    created_by: currentUser
  };
  
  try {
    const res = await apiRequest('/rework-relations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (res.success) {
      showToast('复修关联创建成功', 'success');
      closeModal();
      loadAllData();
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('创建失败', 'error');
  }
}

function showCreateBillModal() {
  const contractOptions = contracts.map(c => `<option value="${c.id}">${c.contract_no} - ${c.vendor_name}</option>`).join('');
  const orderOptions = workOrders.map(o => `<option value="${o.id}">${o.order_no} - ¥${(o.total_amount || 0).toLocaleString()}</option>`).join('');
  
  showModal('新建外包账单', `
    <div class="form-group">
      <label>账单编号 *</label>
      <input type="text" id="bill-no" placeholder="例如: BILL20240501">
    </div>
    <div class="form-group">
      <label>合同</label>
      <select id="bill-contract">${contractOptions}</select>
    </div>
    <div class="form-group">
      <label>关联工单 (按住Ctrl多选) *</label>
      <select id="bill-orders" multiple size="5" style="height: auto;">${orderOptions}</select>
    </div>
    <button class="btn btn-primary" onclick="createBill()">创建账单</button>
  `);
}

async function createBill() {
  const contractId = document.getElementById('bill-contract').value;
  const contract = contracts.find(c => c.id === contractId);
  const orderSelect = document.getElementById('bill-orders');
  const orderIds = Array.from(orderSelect.selectedOptions).map(o => o.value);
  
  if (!orderIds.length) {
    showToast('请选择至少一个工单', 'error');
    return;
  }
  
  const data = {
    bill_no: document.getElementById('bill-no').value,
    contract_id: contractId,
    work_order_ids: orderIds,
    vendor_name: contract ? contract.vendor_name : '',
    vendor_id: contract ? contract.vendor_id : '',
    created_by: currentUser
  };
  
  try {
    const res = await apiRequest('/outsourcing-bills', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (res.success) {
      showToast('账单创建成功', 'success');
      closeModal();
      loadAllData();
    } else {
      showToast(res.error, 'error');
    }
  } catch (error) {
    showToast('创建失败', 'error');
  }
}

async function submitBill(billId) {
  if (!confirm('确定提交此账单吗？')) return;
  showToast('账单已提交', 'success');
  loadAllData();
}

async function approveBill(billId) {
  if (!confirm('确定审批通过此账单吗？')) return;
  showToast('账单已审批', 'success');
  loadAllData();
}

async function loadExportData() {
  const workers = [...new Set(workOrders.map(o => o.assigned_worker).filter(Boolean))];
  const select = document.getElementById('export-responsible');
  select.innerHTML = '<option value="">全部</option>' + workers.map(w => `<option value="${w}">${w}</option>`).join('');
}

async function exportData() {
  const params = new URLSearchParams();
  
  const responsible = document.getElementById('export-responsible').value;
  const startDate = document.getElementById('export-start-date').value;
  const endDate = document.getElementById('export-end-date').value;
  
  if (responsible) params.append('responsible_person', responsible);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  try {
    const res = await apiRequest(`/export/work-orders?${params.toString()}`);
    
    if (res.success) {
      const data = res.data;
      const resultDiv = document.getElementById('export-result');
      
      if (!data.length) {
        resultDiv.innerHTML = '<p>没有找到符合条件的数据</p>';
        return;
      }
      
      resultDiv.innerHTML = `
        <h3 style="margin-bottom: 15px;">导出结果 (${data.length} 条记录)</h3>
        <table class="detail-table">
          <thead>
            <tr>
              <th>工单号</th>
              <th>资产</th>
              <th>负责人</th>
              <th>状态</th>
              <th>金额</th>
              <th>照片</th>
              <th>扣款</th>
              <th>证据缺失</th>
              <th>复修</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(o => `
              <tr>
                <td><strong>${o.order_no}</strong></td>
                <td>${o.asset_name}</td>
                <td>${o.assigned_worker || '-'}</td>
                <td>${getStatusBadge(o.status)}</td>
                <td>¥${(o.total_amount || 0).toLocaleString()}</td>
                <td>${o.arrival_photos?.length || 0}张</td>
                <td>${o.overtime_deductions?.length || 0}条</td>
                <td>${o.evidence_missing?.length || 0}条</td>
                <td>${o.rework_relations?.length || 0}条</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p style="margin-top: 15px;">
          <button class="btn btn-primary" onclick="downloadJSON()">下载JSON</button>
          <button class="btn btn-info" onclick="downloadCSV()">下载CSV</button>
        </p>
      `;
      
      window.exportDataCache = data;
    }
  } catch (error) {
    showToast('导出失败', 'error');
  }
}

function downloadJSON() {
  if (!window.exportDataCache) return;
  const blob = new Blob([JSON.stringify(window.exportDataCache, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `work-orders-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function downloadCSV() {
  if (!window.exportDataCache) return;
  const data = window.exportDataCache;
  const headers = ['工单号', '资产名称', '负责人', '状态', '金额', '照片数', '扣款数', '证据缺失数', '复修数', '创建时间'];
  const rows = data.map(o => [
    o.order_no,
    o.asset_name,
    o.assigned_worker || '',
    o.status,
    o.total_amount || 0,
    o.arrival_photos?.length || 0,
    o.overtime_deductions?.length || 0,
    o.evidence_missing?.length || 0,
    o.rework_relations?.length || 0,
    o.created_at
  ]);
  
  const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `work-orders-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function showModal(title, content) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal" onclick="if(event.target === this) closeModal()">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        ${content}
      </div>
    </div>
  `;
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const style = document.createElement('style');
style.textContent = `
  .detail-table {
    width: 100%;
    border-collapse: collapse;
  }
  .detail-table th, .detail-table td {
    padding: 10px;
    border-bottom: 1px solid #f0f0f0;
    text-align: left;
  }
  .detail-table th {
    background: #f8f9fa;
    font-weight: 600;
    width: 120px;
    color: #666;
  }
  .text-danger { color: #ef4444; }
  .text-success { color: #10b981; }
`;
document.head.appendChild(style);
