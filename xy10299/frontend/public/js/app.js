const API_BASE = 'http://localhost:3001/api';

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw { status: response.status, ...data };
  }
  return data;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatMoney(amount) {
  return `¥${(amount || 0).toFixed(2)}`;
}

function getStatusBadge(status) {
  const map = {
    available: '<span class="badge badge-available">可用</span>',
    occupied: '<span class="badge badge-occupied">已占用</span>',
    pending: '<span class="badge badge-pending">待确认</span>',
    confirmed: '<span class="badge badge-confirmed">已确认</span>',
    rejected: '<span class="badge badge-rejected">已拒绝</span>'
  };
  return map[status] || status;
}

function getZoneTypeText(type) {
  return type === 'chilled' ? '冷藏' : '冷冻';
}

let appState = {
  currentPage: 'dashboard',
  freezers: [],
  zones: [],
  slots: [],
  vendors: [],
  occupancyRecords: [],
  billingRules: [],
  dashboard: null,
  loading: false,
  error: null,
  success: null
};

async function loadAllData() {
  appState.loading = true;
  try {
    const [freezers, zones, slots, vendors, records, rules, dashboard] = await Promise.all([
      apiFetch('/freezers'),
      apiFetch('/zones'),
      apiFetch('/slots'),
      apiFetch('/vendors'),
      apiFetch('/occupancy'),
      apiFetch('/billing-rules'),
      apiFetch('/dashboard')
    ]);
    appState.freezers = freezers;
    appState.zones = zones;
    appState.slots = slots;
    appState.vendors = vendors;
    appState.occupancyRecords = records;
    appState.billingRules = rules;
    appState.dashboard = dashboard;
    render();
  } catch (err) {
    showError(err.error || '加载数据失败');
  } finally {
    appState.loading = false;
  }
}

function showError(message) {
  appState.error = message;
  appState.success = null;
  render();
  setTimeout(() => {
    appState.error = null;
    render();
  }, 5000);
}

function showSuccess(message) {
  appState.success = message;
  appState.error = null;
  render();
  setTimeout(() => {
    appState.success = null;
    render();
  }, 3000);
}

function navigate(page) {
  appState.currentPage = page;
  render();
}

let modals = {};

function openModal(name, data = null) {
  modals[name] = { open: true, data };
  render();
}

function closeModal(name) {
  if (modals[name]) {
    modals[name].open = false;
  }
  render();
}

function render() {
  const root = document.getElementById('root');
  if (!root) return;
  
  let content = '';
  
  if (appState.error) {
    content += `<div class="alert alert-error">${appState.error}</div>`;
  }
  if (appState.success) {
    content += `<div class="alert alert-success">${appState.success}</div>`;
  }
  
  switch (appState.currentPage) {
    case 'dashboard':
      content += renderDashboard();
      break;
    case 'freezer':
      content += renderFreezerPage();
      break;
    case 'slot':
      content += renderSlotPage();
      break;
    case 'vendor':
      content += renderVendorPage();
      break;
    case 'occupancy':
      content += renderOccupancyPage();
      break;
    case 'rule':
      content += renderRulePage();
      break;
    case 'export':
      content += renderExportPage();
      break;
    case 'guide':
      content += renderGuidePage();
      break;
    default:
      content += renderDashboard();
  }
  
  root.innerHTML = renderLayout() + content + renderModals();
  attachEventListeners();
}

function renderLayout() {
  const isEmpty = appState.freezers.length === 0;
  
  return `
    <div class="app-container">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title">市集冷柜结算台</div>
          <div class="sidebar-subtitle">共享冷柜占用管理系统</div>
        </div>
        <ul class="nav-menu">
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'dashboard' ? 'active' : ''}" data-nav="dashboard">📊 总览看板</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'freezer' ? 'active' : ''}" data-nav="freezer">❄️ 冷柜与温区</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'slot' ? 'active' : ''}" data-nav="slot">📦 格口管理</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'vendor' ? 'active' : ''}" data-nav="vendor">👤 摊主管理</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'occupancy' ? 'active' : ''}" data-nav="occupancy">📝 占用登记</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'rule' ? 'active' : ''}" data-nav="rule">💰 计费规则</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'export' ? 'active' : ''}" data-nav="export">📥 数据导出</a>
          </li>
          <li class="nav-item">
            <a class="nav-link ${appState.currentPage === 'guide' ? 'active' : ''}" data-nav="guide">📖 使用引导</a>
          </li>
        </ul>
      </aside>
      <main class="main-content">
  `;
}

function renderDashboard() {
  const d = appState.dashboard || { summary: {}, vendorStats: [], zoneStats: [] };
  const s = d.summary || {};
  const isEmpty = appState.freezers.length === 0;
  
  let gettingStartedSection = '';
  if (isEmpty) {
    gettingStartedSection = `
      <div class="getting-started">
        <div class="getting-started-title">🚀 快速开始：从空数据到结算报表</div>
        <div class="getting-started-steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-title">加载示例数据</div>
            <div class="step-desc">点击下方按钮，一键加载市集冷柜、温区、格口、摊主等示例数据</div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-title">登记冷柜占用</div>
            <div class="step-desc">在占用登记页面，选择摊主、格口和时间，系统自动计算费用</div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-title">确认或拒绝</div>
            <div class="step-desc">管理员审核占用申请，确认后格口自动标记为已占用</div>
          </div>
          <div class="step">
            <div class="step-number">4</div>
            <div class="step-title">查看结算报表</div>
            <div class="step-desc">在总览看板查看温区统计、摊主账单，支持导出CSV报表</div>
          </div>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn btn-success" id="loadSampleBtn">📦 加载示例数据</button>
          <button class="btn btn-secondary" id="clearDataBtn" style="margin-left: 12px;">🗑️ 清空所有数据</button>
        </div>
      </div>
    `;
  }
  
  let freezerVisual = '';
  if (!isEmpty && appState.freezers.length > 0) {
    const freezer = appState.freezers[0];
    const freezerZones = appState.zones.filter(z => z.freezerId === freezer.id);
    const freezerSlots = appState.slots.filter(s => s.freezerId === freezer.id);
    
    let zonesHtml = freezerZones.map(zone => {
      const zoneSlots = freezerSlots.filter(s => s.zoneId === zone.id);
      const slotsHtml = zoneSlots.map(slot => `
        <div class="slot ${slot.status}" data-slot-id="${slot.id}">
          <div class="slot-number">${slot.slotNumber}</div>
          <div class="slot-status">${slot.status === 'available' ? '可用' : '占用'}</div>
        </div>
      `).join('');
      
      return `
        <div class="zone-section">
          <div class="zone-header">
            <span class="zone-name">${zone.name} (${getZoneTypeText(zone.zoneType)})</span>
            <span class="zone-info">${zone.tempRange} · ${formatMoney(zone.pricePerHour)}/小时</span>
          </div>
          <div class="slots-grid">${slotsHtml || '<span style="color: #bdc3c7; font-size: 12px;">暂无格口配置</span>'}</div>
        </div>
      `;
    }).join('');
    
    freezerVisual = `
      <div class="card">
        <div class="card-title">🗄️ 冷柜格口实时状态</div>
        <div style="overflow-x: auto;">
          <div class="freezer-visual">
            <div class="freezer-header">
              <span class="freezer-title">${freezer.name}</span>
              <span style="color: #bdc3c7; font-size: 12px;">${freezer.location}</span>
            </div>
            <div class="zones-container">${zonesHtml}</div>
          </div>
        </div>
        <div class="legend">
          <div class="legend-item"><span class="legend-dot" style="background: #27ae60;"></span>可用格口</div>
          <div class="legend-item"><span class="legend-dot" style="background: #e74c3c;"></span>已占用</div>
        </div>
      </div>
    `;
  }
  
  let statsCards = '';
  if (!isEmpty) {
    statsCards = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">冷柜数量</div>
          <div class="stat-value">${s.totalFreezers || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">总格口数</div>
          <div class="stat-value">${s.totalSlots || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已占用</div>
          <div class="stat-value" style="color: #e74c3c;">${s.occupiedSlots || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">可用格口</div>
          <div class="stat-value" style="color: #27ae60;">${s.availableSlots || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">摊主数量</div>
          <div class="stat-value">${s.totalVendors || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">总收入</div>
          <div class="stat-value revenue">${formatMoney(s.totalRevenue || 0)}</div>
        </div>
      </div>
    `;
  }
  
  let recordStats = '';
  if (!isEmpty) {
    recordStats = `
      <div class="card">
        <div class="card-title">📊 占用记录统计</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">待确认</div>
            <div class="stat-value" style="color: #f39c12;">${s.pendingRecords || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">已确认</div>
            <div class="stat-value" style="color: #27ae60;">${s.confirmedRecords || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">已拒绝</div>
            <div class="stat-value" style="color: #e74c3c;">${s.rejectedRecords || 0}</div>
          </div>
        </div>
      </div>
    `;
  }
  
  let vendorStats = '';
  if (d.vendorStats && d.vendorStats.length > 0) {
    vendorStats = `
      <div class="card">
        <div class="card-title">👥 摊主账单统计</div>
        <table class="table">
          <thead>
            <tr>
              <th>摊主名称</th>
              <th>记录数</th>
              <th>已确认订单</th>
              <th>应付金额</th>
            </tr>
          </thead>
          <tbody>
            ${d.vendorStats.map(v => `
              <tr>
                <td>${v.vendorName}</td>
                <td>${v.totalRecords}</td>
                <td>${v.confirmedRecords}</td>
                <td style="font-weight: bold; color: #e74c3c;">${formatMoney(v.totalCost)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  let zoneStats = '';
  if (d.zoneStats && d.zoneStats.length > 0) {
    zoneStats = `
      <div class="card">
        <div class="card-title">🌡️ 温区收入统计</div>
        <table class="table">
          <thead>
            <tr>
              <th>温区名称</th>
              <th>类型</th>
              <th>单价</th>
              <th>总格口</th>
              <th>已占用</th>
              <th>总收入</th>
            </tr>
          </thead>
          <tbody>
            ${d.zoneStats.map(z => `
              <tr>
                <td>${z.zoneName}</td>
                <td>${getZoneTypeText(z.zoneType)}</td>
                <td>${formatMoney(z.pricePerHour)}/小时</td>
                <td>${z.totalSlots}</td>
                <td>${z.occupiedSlots}</td>
                <td style="font-weight: bold; color: #27ae60;">${formatMoney(z.totalRevenue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  return `
    <div class="page-header">
      <div class="page-title">📊 总览看板</div>
      <div class="page-desc">市集共享冷柜占用结算系统总览，实时掌握冷柜使用情况和结算数据</div>
    </div>
    ${gettingStartedSection}
    ${statsCards}
    ${recordStats}
    ${freezerVisual}
    ${vendorStats}
    ${zoneStats}
  `;
}

function renderFreezerPage() {
  return `
    <div class="page-header">
      <div class="page-title">❄️ 冷柜与温区管理</div>
      <div class="page-desc">管理冷柜设备和温区配置，温区是计费规则的核心依据</div>
    </div>
    
    <div class="progress-steps">
      <div class="progress-step completed">
        <div class="progress-circle">1</div>
        <div class="progress-label">创建冷柜</div>
      </div>
      <div class="progress-step active">
        <div class="progress-circle">2</div>
        <div class="progress-label">配置温区</div>
      </div>
      <div class="progress-step">
        <div class="progress-circle">3</div>
        <div class="progress-label">分配格口</div>
      </div>
      <div class="progress-step">
        <div class="progress-circle">4</div>
        <div class="progress-label">占用登记</div>
      </div>
      <div class="progress-step">
        <div class="progress-circle">5</div>
        <div class="progress-label">结算确认</div>
      </div>
    </div>
    
    <div class="card">
      <div class="actions-bar">
        <div class="card-title" style="margin-bottom: 0;">🗄️ 冷柜列表</div>
        <button class="btn btn-primary" id="addFreezerBtn">+ 新增冷柜</button>
      </div>
      ${appState.freezers.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">❄️</div>
          <div class="empty-text">暂无冷柜设备</div>
          <div class="empty-hint">点击上方按钮添加第一个冷柜，或在总览页面加载示例数据</div>
        </div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>冷柜名称</th>
              <th>位置</th>
              <th>温区数</th>
              <th>格口数</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${appState.freezers.map(f => {
              const zoneCount = appState.zones.filter(z => z.freezerId === f.id).length;
              const slotCount = appState.slots.filter(s => s.freezerId === f.id).length;
              return `
                <tr>
                  <td style="font-weight: 600;">${f.name}</td>
                  <td>${f.location}</td>
                  <td>${zoneCount}</td>
                  <td>${slotCount}</td>
                  <td>${formatDateTime(f.createdAt)}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" data-edit-freezer="${f.id}">编辑</button>
                    <button class="btn btn-sm btn-primary" data-manage-zone="${f.id}" style="margin-left: 4px;">管理温区</button>
                    <button class="btn btn-sm btn-danger" data-delete-freezer="${f.id}" style="margin-left: 4px;">删除</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
    
    <div class="card">
      <div class="actions-bar">
        <div class="card-title" style="margin-bottom: 0;">🌡️ 温区配置（计费依据）</div>
      </div>
      <div class="alert alert-info">
        💡 温区是结算的核心：不同温区（冷藏/冷冻）单价不同，占用时长 × 温区单价 = 结算金额
      </div>
      ${appState.zones.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🌡️</div>
          <div class="empty-text">暂无温区配置</div>
          <div class="empty-hint">先选择一个冷柜，然后点击"管理温区"添加温区</div>
        </div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>所属冷柜</th>
              <th>温区名称</th>
              <th>类型</th>
              <th>单价（元/小时）</th>
              <th>温度范围</th>
              <th>格口数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${appState.zones.map(z => {
              const freezer = appState.freezers.find(f => f.id === z.freezerId);
              const slotCount = appState.slots.filter(s => s.zoneId === z.id).length;
              return `
                <tr>
                  <td>${freezer ? freezer.name : '未知'}</td>
                  <td style="font-weight: 600;">${z.name}</td>
                  <td>${getZoneTypeText(z.zoneType)}</td>
                  <td style="color: #e74c3c; font-weight: bold;">${formatMoney(z.pricePerHour)}</td>
                  <td>${z.tempRange || '-'}</td>
                  <td>${slotCount}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" data-edit-zone="${z.id}">编辑</button>
                    <button class="btn btn-sm btn-danger" data-delete-zone="${z.id}" style="margin-left: 4px;">删除</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function renderSlotPage() {
  return `
    <div class="page-header">
      <div class="page-title">📦 格口管理</div>
      <div class="page-desc">冷柜的最小使用单元，按格口分配给摊主使用</div>
    </div>
    
    <div class="alert alert-info">
      💡 流程：冷柜 → 温区 → 格口。格口必须归属到某个温区，温区决定了该格口的计费单价
    </div>
    
    <div class="card">
      <div class="actions-bar">
        <div class="card-title" style="margin-bottom: 0;">格口列表</div>
        <div class="btn-group">
          <button class="btn btn-primary" id="addSlotBtn">+ 新增格口</button>
        </div>
      </div>
      
      <div class="filter-bar">
        <span class="filter-label">筛选：</span>
        <select class="filter-select" id="slotFreezerFilter">
          <option value="">全部冷柜</option>
          ${appState.freezers.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
        </select>
        <select class="filter-select" id="slotStatusFilter">
          <option value="">全部状态</option>
          <option value="available">可用</option>
          <option value="occupied">已占用</option>
        </select>
      </div>
      
      ${appState.slots.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-text">暂无格口配置</div>
          <div class="empty-hint">先配置冷柜和温区，然后添加格口</div>
        </div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>格口编号</th>
              <th>所属冷柜</th>
              <th>所属温区</th>
              <th>温区单价</th>
              <th>状态</th>
              <th>当前摊主</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="slotTableBody">
            ${appState.slots.map(s => {
              const freezer = appState.freezers.find(f => f.id === s.freezerId);
              const zone = appState.zones.find(z => z.id === s.zoneId);
              const vendor = appState.vendors.find(v => v.id === s.currentVendorId);
              return `
                <tr data-freezer="${s.freezerId}" data-status="${s.status}">
                  <td style="font-weight: 600;">#${s.slotNumber}</td>
                  <td>${freezer ? freezer.name : '未知'}</td>
                  <td>${zone ? zone.name : '未知'}</td>
                  <td>${zone ? formatMoney(zone.pricePerHour) + '/小时' : '-'}</td>
                  <td>${getStatusBadge(s.status)}</td>
                  <td>${vendor ? vendor.name : '-'}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" data-edit-slot="${s.id}">编辑</button>
                    <button class="btn btn-sm btn-danger" data-delete-slot="${s.id}" style="margin-left: 4px;">删除</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function renderVendorPage() {
  return `
    <div class="page-header">
      <div class="page-title">👤 摊主管理</div>
      <div class="page-desc">管理市集摊主信息，占用登记时选择摊主</div>
    </div>
    
    <div class="card">
      <div class="actions-bar">
        <div class="card-title" style="margin-bottom: 0;">摊主列表</div>
        <button class="btn btn-primary" id="addVendorBtn">+ 新增摊主</button>
      </div>
      
      ${appState.vendors.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-text">暂无摊主信息</div>
          <div class="empty-hint">点击上方按钮添加摊主，或加载示例数据</div>
        </div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>摊主名称</th>
              <th>摊号位</th>
              <th>联系电话</th>
              <th>占用记录数</th>
              <th>应付金额</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${appState.vendors.map(v => {
              const records = appState.occupancyRecords.filter(r => r.vendorId === v.id && r.status === 'confirmed');
              const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0);
              return `
                <tr>
                  <td style="font-weight: 600;">${v.name}</td>
                  <td>${v.stallNumber || '-'}</td>
                  <td>${v.phone || '-'}</td>
                  <td>${records.length}</td>
                  <td style="color: #e74c3c; font-weight: bold;">${formatMoney(totalCost)}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" data-edit-vendor="${v.id}">编辑</button>
                    <button class="btn btn-sm btn-danger" data-delete-vendor="${v.id}" style="margin-left: 4px;">删除</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function renderOccupancyPage() {
  const pendingCount = appState.occupancyRecords.filter(r => r.status === 'pending').length;
  
  return `
    <div class="page-header">
      <div class="page-title">📝 占用登记</div>
      <div class="page-desc">登记摊主的冷柜占用，系统自动计算费用，支持审核确认</div>
    </div>
    
    <div class="alert alert-warning">
      ⚠️ 临时挪货争议解决方案：所有占用都需登记留痕，确认后不可修改，拒绝需注明原因，全程可追溯
    </div>
    
    <div class="card">
      <div class="actions-bar">
        <div class="card-title" style="margin-bottom: 0;">
          占用记录
          ${pendingCount > 0 ? `<span class="badge badge-pending" style="margin-left: 8px;">${pendingCount} 待确认</span>` : ''}
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="addOccupancyBtn">+ 新增占用</button>
        </div>
      </div>
      
      <div class="filter-bar">
        <span class="filter-label">筛选：</span>
        <select class="filter-select" id="occupancyVendorFilter">
          <option value="">全部摊主</option>
          ${appState.vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
        </select>
        <select class="filter-select" id="occupancyStatusFilter">
          <option value="">全部状态</option>
          <option value="pending">待确认</option>
          <option value="confirmed">已确认</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>
      
      ${appState.occupancyRecords.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-text">暂无占用记录</div>
          <div class="empty-hint">点击上方按钮登记第一个占用记录</div>
        </div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>摊主</th>
              <th>冷柜</th>
              <th>温区</th>
              <th>格口</th>
              <th>开始时间</th>
              <th>结束时间</th>
              <th>单价</th>
              <th>金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="occupancyTableBody">
            ${appState.occupancyRecords.map(r => {
              const vendor = appState.vendors.find(v => v.id === r.vendorId);
              const freezer = appState.freezers.find(f => f.id === r.freezerId);
              const zone = appState.zones.find(z => z.id === r.zoneId);
              const slot = appState.slots.find(s => s.id === r.slotId);
              return `
                <tr data-vendor="${r.vendorId}" data-status="${r.status}">
                  <td style="font-weight: 600;">${vendor ? vendor.name : '未知'}</td>
                  <td>${freezer ? freezer.name : '未知'}</td>
                  <td>${zone ? zone.name : '未知'}</td>
                  <td>#${slot ? slot.slotNumber : '?'}</td>
                  <td>${formatDateTime(r.startTime)}</td>
                  <td>${formatDateTime(r.endTime)}</td>
                  <td>${formatMoney(r.pricePerHour)}/小时</td>
                  <td style="color: #e74c3c; font-weight: bold;">${formatMoney(r.totalCost)}</td>
                  <td>${getStatusBadge(r.status)}</td>
                  <td>
                    ${r.status === 'pending' ? `
                      <button class="btn btn-sm btn-success" data-confirm="${r.id}">确认</button>
                      <button class="btn btn-sm btn-danger" data-reject="${r.id}" style="margin-left: 4px;">拒绝</button>
                      <button class="btn btn-sm btn-secondary" data-edit-occupancy="${r.id}" style="margin-left: 4px;">编辑</button>
                    ` : `
                      <button class="btn btn-sm btn-secondary" data-view-occupancy="${r.id}">查看</button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>
    
    <div class="card">
      <div class="card-title">🔴 边界情况覆盖</div>
      <div class="alert alert-info" style="margin-bottom: 12px;">
        以下按钮用于测试系统对边界情况的处理能力
      </div>
      <div class="btn-group">
        <button class="btn btn-warning" id="testDuplicate">测试重复提交</button>
        <button class="btn btn-warning" id="testConflict">测试状态冲突</button>
        <button class="btn btn-warning" id="testMissing">测试来源记录缺失</button>
      </div>
    </div>
  `;
}

function renderRulePage() {
  return `
    <div class="page-header">
      <div class="page-title">💰 计费规则</div>
      <div class="page-desc">按温区类型设置计费规则，系统自动计算占用费用</div>
    </div>
    
    <div class="alert alert-info">
      💡 计费公式：占用时长(小时) × 温区单价(元/小时) = 结算金额。温区规则在冷柜温区配置中设置。
    </div>
    
    <div class="card">
      <div class="actions-bar">
        <div class="card-title" style="margin-bottom: 0;">计费规则列表</div>
        <button class="btn btn-primary" id="addRuleBtn">+ 新增规则</button>
      </div>
      
      ${appState.billingRules.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <div class="empty-text">暂无计费规则</div>
          <div class="empty-hint">在冷柜管理中配置温区时自动关联计费单价</div>
        </div>
      ` : `
        <table class="table">
          <thead>
            <tr>
              <th>温区类型</th>
              <th>单价（元/小时）</th>
              <th>最短时长</th>
              <th>最长时长</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${appState.billingRules.map(r => `
              <tr>
                <td style="font-weight: 600;">${getZoneTypeText(r.zoneType)}</td>
                <td style="color: #e74c3c; font-weight: bold;">${formatMoney(r.pricePerHour)}</td>
                <td>${r.minHours || 1}小时</td>
                <td>${r.maxHours || 24}小时</td>
                <td>
                  <button class="btn btn-sm btn-secondary" data-edit-rule="${r.id}">编辑</button>
                  <button class="btn btn-sm btn-danger" data-delete-rule="${r.id}" style="margin-left: 4px;">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

function renderExportPage() {
  return `
    <div class="page-header">
      <div class="page-title">📥 数据导出</div>
      <div class="page-desc">导出结算报表和统计数据，支持CSV格式</div>
    </div>
    
    <div class="card">
      <div class="card-title">📊 结算报表导出</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">状态筛选</label>
          <select class="form-select" id="exportStatus">
            <option value="">全部状态</option>
            <option value="pending">待确认</option>
            <option value="confirmed">已确认</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">摊主筛选</label>
          <select class="form-select" id="exportVendor">
            <option value="">全部摊主</option>
            ${appState.vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-success" id="exportBillingBtn">⬇️ 导出具名细CSV</button>
    </div>
    
    <div class="card">
      <div class="card-title">📈 看板统计数据</div>
      <button class="btn btn-primary" id="exportDashboardBtn">⬇️ 导出统计数据</button>
    </div>
    
    <div class="card">
      <div class="card-title">📦 示例数据管理</div>
      <div class="btn-group">
        <button class="btn btn-success" id="loadSampleBtn2">📦 加载示例数据</button>
        <button class="btn btn-danger" id="clearDataBtn2" style="margin-left: 12px;">🗑️ 清空所有数据</button>
      </div>
    </div>
  `;
}

function renderGuidePage() {
  return `
    <div class="page-header">
      <div class="page-title">📖 使用引导</div>
      <div class="page-desc">从空数据到最终报表的完整操作流程</div>
    </div>
    
    <div class="card">
      <div class="card-title">🎯 业务主线说明</div>
      <div class="alert alert-info">
        <strong>核心主线：</strong>市集摊主共用冷柜 → 按<strong>格口</strong>分配 → 按<strong>温区</strong>定价 → 按<strong>占用时长</strong>计费 → 解决临时挪货<strong>争议</strong>
      </div>
      <div style="font-size: 14px; line-height: 2;">
        <p><strong>格口：</strong>冷柜的最小使用单元，摊主按格口租用</p>
        <p><strong>温区：</strong>同一冷柜可分冷藏区、冷冻区，不同温区单价不同（温区规则）</p>
        <p><strong>占用时长：</strong>从登记开始到结束的小时数</p>
        <p><strong>争议解决：</strong>所有操作留痕、确认后不可修改、拒绝需注明原因、全程可追溯</p>
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">📋 完整操作流程（5步走）</div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2c3e50; margin-bottom: 12px;">第1步：初始化数据</h3>
        <div class="alert alert-success">
          <strong>快速方式：</strong>到「总览看板」或「数据导出」页面，点击「📦 加载示例数据」一键完成初始化
        </div>
        <div style="font-size: 14px; margin-top: 12px;">
          <p>或手动添加：</p>
          <ol style="margin-left: 24px; line-height: 2;">
            <li>「冷柜与温区」→ 新增冷柜（如：市集冷柜A）</li>
            <li>点击冷柜的「管理温区」→ 添加温区（冷藏区 2.5元/小时、冷冻区 3.0元/小时）</li>
            <li>「格口管理」→ 为每个温区分配格口编号</li>
            <li>「摊主管理」→ 添加摊主信息（如：李记生鲜、王记水饺）</li>
          </ol>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2c3e50; margin-bottom: 12px;">第2步：登记占用</h3>
        <div style="font-size: 14px; line-height: 2;">
          <ol style="margin-left: 24px;">
            <li>进入「占用登记」页面</li>
            <li>点击「+ 新增占用」</li>
            <li>选择：摊主 → 冷柜 → 温区 → 格口</li>
            <li>填写：开始时间、结束时间</li>
            <li>系统自动计算：占用时长 × 温区单价 = 预估金额</li>
            <li>提交后状态为「待确认」</li>
          </ol>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2c3e50; margin-bottom: 12px;">第3步：审核确认</h3>
        <div class="alert alert-warning">
          <strong>争议预防机制：</strong>所有占用需管理员审核，确认后格口自动锁定
        </div>
        <div style="font-size: 14px; line-height: 2; margin-top: 12px;">
          <ul style="margin-left: 24px;">
            <li><strong>确认：</strong>状态变为「已确认」，格口状态变为「已占用」，<strong>不可修改</strong></li>
            <li><strong>拒绝：</strong>状态变为「已拒绝」，格口释放，<strong>需注明原因</strong></li>
            <li><strong>留痕：</strong>所有操作记录创建时间和修改时间，全程可追溯</li>
          </ul>
        </div>
      </div>
      
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2c3e50; margin-bottom: 12px;">第4步：查看报表</h3>
        <div style="font-size: 14px; line-height: 2;">
          <p>进入「总览看板」查看：</p>
          <ul style="margin-left: 24px;">
            <li>冷柜格口实时状态图（绿色可用、红色已占用）</li>
            <li>温区收入统计（哪个温区最赚钱）</li>
            <li>摊主账单统计（每个摊主应付多少钱）</li>
            <li>占用记录状态分布（待确认、已确认、已拒绝数量）</li>
          </ul>
        </div>
      </div>
      
      <div>
        <h3 style="color: #2c3e50; margin-bottom: 12px;">第5步：导出结算</h3>
        <div style="font-size: 14px; line-height: 2;">
          <p>进入「数据导出」页面：</p>
          <ul style="margin-left: 24px;">
            <li>按状态/摊主筛选记录</li>
            <li>导出CSV明细报表（可用Excel打开）</li>
            <li>导出统计数据（JSON格式）</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">🔴 边界情况处理</div>
      <div style="font-size: 14px; line-height: 2;">
        <div class="alert alert-warning" style="margin-bottom: 12px;">
          在「占用登记」页面底部有测试按钮，可验证以下边界情况
        </div>
        <ul style="margin-left: 24px;">
          <li><strong>重复提交：</strong>同一温区类型的计费规则不能重复创建</li>
          <li><strong>状态冲突：</strong>
            <ul style="margin-left: 24px;">
              <li>同一格口同一时间段不能重复登记</li>
              <li>已确认的记录不能修改或删除</li>
              <li>已拒绝的记录不能修改</li>
            </ul>
          </li>
          <li><strong>来源记录缺失：</strong>
            <ul style="margin-left: 24px;">
              <li>登记时摊主不存在会提示错误</li>
              <li>格口对应的温区不存在会提示错误</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">🎮 快速体验</div>
      <div style="font-size: 14px; line-height: 2;">
        <ol style="margin-left: 24px;">
          <li>点击左侧「总览看板」</li>
          <li>点击「📦 加载示例数据」</li>
          <li>点击左侧「占用登记」→「+ 新增占用」</li>
          <li>随便填一下，提交测试</li>
          <li>回到「总览看板」看格口状态变化</li>
        </ol>
      </div>
    </div>
  `;
}

function renderModals() {
  let modalHtml = '</main></div>';
  
  if (modals.freezer && modals.freezer.open) {
    const data = modals.freezer.data || {};
    modalHtml += `
      <div class="modal-overlay" data-modal-close="freezer">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">${data.id ? '编辑冷柜' : '新增冷柜'}</div>
            <button class="modal-close" data-modal-close="freezer">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">冷柜名称 *</label>
              <input type="text" class="form-input" id="freezerName" value="${data.name || ''}" placeholder="如：市集冷柜A">
            </div>
            <div class="form-group">
              <label class="form-label">位置 *</label>
              <input type="text" class="form-input" id="freezerLocation" value="${data.location || ''}" placeholder="如：一号入口左侧">
            </div>
            <div class="form-group">
              <label class="form-label">总格口数</label>
              <input type="number" class="form-input" id="freezerSlots" value="${data.totalSlots || 12}" min="1">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close="freezer">取消</button>
            <button class="btn btn-primary" id="saveFreezerBtn">保存</button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (modals.zone && modals.zone.open) {
    const data = modals.zone.data || {};
    const freezerId = data.freezerId || (appState.freezers[0] && appState.freezers[0].id);
    modalHtml += `
      <div class="modal-overlay" data-modal-close="zone">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">${data.id ? '编辑温区' : '新增温区'}</div>
            <button class="modal-close" data-modal-close="zone">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">所属冷柜 *</label>
              <select class="form-select" id="zoneFreezer">
                ${appState.freezers.map(f => `<option value="${f.id}" ${f.id === freezerId ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">温区名称 *</label>
              <input type="text" class="form-input" id="zoneName" value="${data.name || ''}" placeholder="如：冷藏区">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">温区类型 *</label>
                <select class="form-select" id="zoneType">
                  <option value="chilled" ${data.zoneType === 'chilled' ? 'selected' : ''}>冷藏</option>
                  <option value="frozen" ${data.zoneType === 'frozen' ? 'selected' : ''}>冷冻</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">单价（元/小时）*</label>
                <input type="number" class="form-input" id="zonePrice" value="${data.pricePerHour || 2.5}" step="0.1" min="0">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">温度范围</label>
              <input type="text" class="form-input" id="zoneTemp" value="${data.tempRange || ''}" placeholder="如：0-4°C">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close="zone">取消</button>
            <button class="btn btn-primary" id="saveZoneBtn">保存</button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (modals.slot && modals.slot.open) {
    const data = modals.slot.data || {};
    modalHtml += `
      <div class="modal-overlay" data-modal-close="slot">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">${data.id ? '编辑格口' : '新增格口'}</div>
            <button class="modal-close" data-modal-close="slot">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">所属冷柜 *</label>
              <select class="form-select" id="slotFreezer">
                ${appState.freezers.map(f => `<option value="${f.id}" ${f.id === data.freezerId ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">所属温区 *</label>
              <select class="form-select" id="slotZone">
                ${appState.zones.map(z => `<option value="${z.id}" ${z.id === data.zoneId ? 'selected' : ''}>${z.name} (${getZoneTypeText(z.zoneType)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">格口编号 *</label>
              <input type="number" class="form-input" id="slotNumber" value="${data.slotNumber || ''}" min="1" placeholder="如：1">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close="slot">取消</button>
            <button class="btn btn-primary" id="saveSlotBtn">保存</button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (modals.vendor && modals.vendor.open) {
    const data = modals.vendor.data || {};
    modalHtml += `
      <div class="modal-overlay" data-modal-close="vendor">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">${data.id ? '编辑摊主' : '新增摊主'}</div>
            <button class="modal-close" data-modal-close="vendor">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">摊主名称 *</label>
              <input type="text" class="form-input" id="vendorName" value="${data.name || ''}" placeholder="如：李记生鲜">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">摊号位</label>
                <input type="text" class="form-input" id="vendorStall" value="${data.stallNumber || ''}" placeholder="如：A01">
              </div>
              <div class="form-group">
                <label class="form-label">联系电话</label>
                <input type="text" class="form-input" id="vendorPhone" value="${data.phone || ''}" placeholder="如：13800138000">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close="vendor">取消</button>
            <button class="btn btn-primary" id="saveVendorBtn">保存</button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (modals.occupancy && modals.occupancy.open) {
    const data = modals.occupancy.data || {};
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const formatForInput = (d) => d.toISOString().slice(0, 16);
    
    modalHtml += `
      <div class="modal-overlay" data-modal-close="occupancy">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">${data.id ? '编辑占用记录' : '新增占用登记'}</div>
            <button class="modal-close" data-modal-close="occupancy">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">摊主 *</label>
              <select class="form-select" id="occVendor">
                ${appState.vendors.map(v => `<option value="${v.id}" ${v.id === data.vendorId ? 'selected' : ''}>${v.name} (${v.stallNumber || '无摊号'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">冷柜 *</label>
              <select class="form-select" id="occFreezer">
                <option value="">请选择冷柜</option>
                ${appState.freezers.map(f => `<option value="${f.id}" ${f.id === data.freezerId ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">温区 *</label>
              <select class="form-select" id="occZone">
                <option value="">请先选择冷柜</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">格口 *</label>
              <select class="form-select" id="occSlot">
                <option value="">请先选择温区</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">开始时间 *</label>
                <input type="datetime-local" class="form-input" id="occStart" value="${data.startTime ? data.startTime.slice(0, 16) : formatForInput(now)}">
              </div>
              <div class="form-group">
                <label class="form-label">结束时间 *</label>
                <input type="datetime-local" class="form-input" id="occEnd" value="${data.endTime ? data.endTime.slice(0, 16) : formatForInput(later)}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">备注</label>
              <textarea class="form-textarea" id="occNotes" placeholder="临时挪货说明等...">${data.notes || ''}</textarea>
            </div>
            <div id="occPreview" class="alert alert-info" style="display: none;">
              <strong>预估费用：</strong><span id="occCost">¥0.00</span>
              <span style="margin-left: 12px;">单价：<span id="occPrice">-</span>/小时</span>
              <span style="margin-left: 12px;">时长：<span id="occHours">0</span>小时</span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close="occupancy">取消</button>
            <button class="btn btn-primary" id="saveOccupancyBtn">提交</button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (modals.reject && modals.reject.open) {
    modalHtml += `
      <div class="modal-overlay" data-modal-close="reject">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">拒绝占用申请</div>
            <button class="modal-close" data-modal-close="reject">&times;</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              ⚠️ 拒绝后记录不可恢复，请注明原因以便追溯
            </div>
            <div class="form-group">
              <label class="form-label">拒绝原因 *</label>
              <textarea class="form-textarea" id="rejectReason" placeholder="请输入拒绝原因..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close="reject">取消</button>
            <button class="btn btn-danger" id="confirmRejectBtn">确认拒绝</button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (modals.rule && modals.rule.open) {
    const data = modals.rule.data || {};
    modalHtml += `
      <div class="modal-overlay" data-modal-close="rule">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">${data.id ? '编辑规则' : '新增计费规则'}</div>
            <button class="modal-close" data-modal-close="rule">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">温区类型 *</label>
              <select class="form-select" id="ruleType">
                <option value="chilled" ${data.zoneType === 'chilled' ? 'selected' : ''}>冷藏</option>
                <option value="frozen" ${data.zoneType === 'frozen' ? 'selected' : ''}>冷冻</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">单价（元/小时）*</label>
              <input type="number" class="form-input" id="rulePrice" value="${data.pricePerHour || 2.5}" step="0.1" min="0">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">最短时长（小时）</label>
                <input type="number" class="form-input" id="ruleMin" value="${data.minHours || 1}" min="1">
              </div>
              <div class="form-group">
                <label class="form-label">最长时长（小时）</label>
                <input type="number" class="form-input" id="ruleMax" value="${data.maxHours || 24}" min="1">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-modal-close="rule">取消</button>
            <button class="btn btn-primary" id="saveRuleBtn">保存</button>
          </div>
        </div>
      </div>
    `;
  }
  
  return modalHtml;
}

function attachEventListeners() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.nav);
    });
  });
  
  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal(el.dataset.modalClose);
    });
  });
  
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const loadSampleBtn2 = document.getElementById('loadSampleBtn2');
  [loadSampleBtn, loadSampleBtn2].forEach(btn => {
    if (btn) btn.addEventListener('click', async () => {
      try {
        await apiFetch('/sample-data/load', { method: 'POST' });
        showSuccess('示例数据已加载！现在可以体验完整功能');
        await loadAllData();
      } catch (err) {
        showError(err.error || '加载失败');
      }
    });
  });
  
  const clearDataBtn = document.getElementById('clearDataBtn');
  const clearDataBtn2 = document.getElementById('clearDataBtn2');
  [clearDataBtn, clearDataBtn2].forEach(btn => {
    if (btn) btn.addEventListener('click', async () => {
      if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
        try {
          await apiFetch('/sample-data/clear', { method: 'POST' });
          showSuccess('数据已清空');
          await loadAllData();
        } catch (err) {
          showError(err.error || '操作失败');
        }
      }
    });
  });
  
  const addFreezerBtn = document.getElementById('addFreezerBtn');
  if (addFreezerBtn) {
    addFreezerBtn.addEventListener('click', () => openModal('freezer'));
  }
  
  document.querySelectorAll('[data-edit-freezer]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editFreezer;
      const freezer = appState.freezers.find(f => f.id === id);
      openModal('freezer', freezer);
    });
  });
  
  document.querySelectorAll('[data-delete-freezer]').forEach(el => {
    el.addEventListener('click', async () => {
      if (confirm('确定删除此冷柜吗？相关温区数据也会受影响。')) {
        try {
          await apiFetch(`/freezers/${el.dataset.deleteFreezer}`, { method: 'DELETE' });
          showSuccess('冷柜已删除');
          await loadAllData();
        } catch (err) {
          showError(err.error || '删除失败');
        }
      }
    });
  });
  
  document.querySelectorAll('[data-manage-zone]').forEach(el => {
    el.addEventListener('click', () => {
      const freezerId = el.dataset.manageZone;
      openModal('zone', { freezerId });
    });
  });
  
  const addZoneBtn = document.getElementById('addZoneBtn');
  if (addZoneBtn) {
    addZoneBtn.addEventListener('click', () => openModal('zone'));
  }
  
  document.querySelectorAll('[data-edit-zone]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editZone;
      const zone = appState.zones.find(z => z.id === id);
      openModal('zone', zone);
    });
  });
  
  document.querySelectorAll('[data-delete-zone]').forEach(el => {
    el.addEventListener('click', async () => {
      if (confirm('确定删除此温区吗？相关格口数据也会受影响。')) {
        try {
          await apiFetch(`/zones/${el.dataset.deleteZone}`, { method: 'DELETE' });
          showSuccess('温区已删除');
          await loadAllData();
        } catch (err) {
          showError(err.error || '删除失败');
        }
      }
    });
  });
  
  const addSlotBtn = document.getElementById('addSlotBtn');
  if (addSlotBtn) {
    addSlotBtn.addEventListener('click', () => openModal('slot'));
  }
  
  document.querySelectorAll('[data-edit-slot]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editSlot;
      const slot = appState.slots.find(s => s.id === id);
      openModal('slot', slot);
    });
  });
  
  document.querySelectorAll('[data-delete-slot]').forEach(el => {
    el.addEventListener('click', async () => {
      if (confirm('确定删除此格口吗？')) {
        try {
          await apiFetch(`/slots/${el.dataset.deleteSlot}`, { method: 'DELETE' });
          showSuccess('格口已删除');
          await loadAllData();
        } catch (err) {
          showError(err.error || '删除失败');
        }
      }
    });
  });
  
  const addVendorBtn = document.getElementById('addVendorBtn');
  if (addVendorBtn) {
    addVendorBtn.addEventListener('click', () => openModal('vendor'));
  }
  
  document.querySelectorAll('[data-edit-vendor]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editVendor;
      const vendor = appState.vendors.find(v => v.id === id);
      openModal('vendor', vendor);
    });
  });
  
  document.querySelectorAll('[data-delete-vendor]').forEach(el => {
    el.addEventListener('click', async () => {
      if (confirm('确定删除此摊主吗？相关占用记录会保留但显示为未知摊主。')) {
        try {
          await apiFetch(`/vendors/${el.dataset.deleteVendor}`, { method: 'DELETE' });
          showSuccess('摊主已删除');
          await loadAllData();
        } catch (err) {
          showError(err.error || '删除失败');
        }
      }
    });
  });
  
  const addOccupancyBtn = document.getElementById('addOccupancyBtn');
  if (addOccupancyBtn) {
    addOccupancyBtn.addEventListener('click', () => openModal('occupancy'));
  }
  
  document.querySelectorAll('[data-edit-occupancy]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editOccupancy;
      const record = appState.occupancyRecords.find(r => r.id === id);
      openModal('occupancy', record);
    });
  });
  
  document.querySelectorAll('[data-view-occupancy]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.viewOccupancy;
      const record = appState.occupancyRecords.find(r => r.id === id);
      if (record) {
        const vendor = appState.vendors.find(v => v.id === record.vendorId);
        const freezer = appState.freezers.find(f => f.id === record.freezerId);
        const zone = appState.zones.find(z => z.id === record.zoneId);
        const slot = appState.slots.find(s => s.id === record.slotId);
        alert(`占用记录详情\n\n摊主: ${vendor ? vendor.name : '未知'}\n冷柜: ${freezer ? freezer.name : '未知'}\n温区: ${zone ? zone.name : '未知'}\n格口: #${slot ? slot.slotNumber : '?'}\n开始: ${formatDateTime(record.startTime)}\n结束: ${formatDateTime(record.endTime)}\n单价: ${formatMoney(record.pricePerHour)}/小时\n金额: ${formatMoney(record.totalCost)}\n状态: ${record.status}\n备注: ${record.notes || '无'}`);
      }
    });
  });
  
  let pendingRejectId = null;
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', async () => {
      if (confirm('确认此占用申请？确认后格口将被锁定，不可撤销。')) {
        try {
          await apiFetch(`/occupancy/${el.dataset.confirm}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'confirmed' })
          });
          showSuccess('已确认，格口已锁定');
          await loadAllData();
        } catch (err) {
          showError(err.error || '操作失败');
        }
      }
    });
  });
  
  document.querySelectorAll('[data-reject]').forEach(el => {
    el.addEventListener('click', () => {
      pendingRejectId = el.dataset.reject;
      openModal('reject');
    });
  });
  
  const confirmRejectBtn = document.getElementById('confirmRejectBtn');
  if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener('click', async () => {
      const reason = document.getElementById('rejectReason').value;
      if (!reason.trim()) {
        showError('请填写拒绝原因');
        return;
      }
      try {
        await apiFetch(`/occupancy/${pendingRejectId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'rejected', notes: reason })
        });
        closeModal('reject');
        showSuccess('已拒绝，格口已释放');
        await loadAllData();
      } catch (err) {
        showError(err.error || '操作失败');
      }
    });
  }
  
  const addRuleBtn = document.getElementById('addRuleBtn');
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', () => openModal('rule'));
  }
  
  document.querySelectorAll('[data-edit-rule]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editRule;
      const rule = appState.billingRules.find(r => r.id === id);
      openModal('rule', rule);
    });
  });
  
  document.querySelectorAll('[data-delete-rule]').forEach(el => {
    el.addEventListener('click', async () => {
      if (confirm('确定删除此计费规则吗？')) {
        try {
          await apiFetch(`/billing-rules/${el.dataset.deleteRule}`, { method: 'DELETE' });
          showSuccess('规则已删除');
          await loadAllData();
        } catch (err) {
          showError(err.error || '删除失败');
        }
      }
    });
  });
  
  const saveFreezerBtn = document.getElementById('saveFreezerBtn');
  if (saveFreezerBtn) {
    saveFreezerBtn.addEventListener('click', async () => {
      const name = document.getElementById('freezerName').value;
      const location = document.getElementById('freezerLocation').value;
      const totalSlots = parseInt(document.getElementById('freezerSlots').value) || 12;
      
      if (!name || !location) {
        showError('请填写必填项');
        return;
      }
      
      try {
        const existing = modals.freezer.data;
        if (existing && existing.id) {
          await apiFetch(`/freezers/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, location, totalSlots })
          });
          showSuccess('冷柜已更新');
        } else {
          await apiFetch('/freezers', {
            method: 'POST',
            body: JSON.stringify({ name, location, totalSlots })
          });
          showSuccess('冷柜已创建');
        }
        closeModal('freezer');
        await loadAllData();
      } catch (err) {
        showError(err.error || '保存失败');
      }
    });
  }
  
  const saveZoneBtn = document.getElementById('saveZoneBtn');
  if (saveZoneBtn) {
    saveZoneBtn.addEventListener('click', async () => {
      const freezerId = document.getElementById('zoneFreezer').value;
      const name = document.getElementById('zoneName').value;
      const zoneType = document.getElementById('zoneType').value;
      const pricePerHour = parseFloat(document.getElementById('zonePrice').value);
      const tempRange = document.getElementById('zoneTemp').value;
      
      if (!freezerId || !name || !zoneType || isNaN(pricePerHour)) {
        showError('请填写必填项');
        return;
      }
      
      try {
        const existing = modals.zone.data;
        if (existing && existing.id) {
          await apiFetch(`/zones/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, zoneType, pricePerHour, tempRange })
          });
          showSuccess('温区已更新');
        } else {
          await apiFetch('/zones', {
            method: 'POST',
            body: JSON.stringify({ freezerId, name, zoneType, pricePerHour, tempRange })
          });
          showSuccess('温区已创建');
        }
        closeModal('zone');
        await loadAllData();
      } catch (err) {
        showError(err.error || '保存失败');
      }
    });
  }
  
  const saveSlotBtn = document.getElementById('saveSlotBtn');
  if (saveSlotBtn) {
    saveSlotBtn.addEventListener('click', async () => {
      const freezerId = document.getElementById('slotFreezer').value;
      const zoneId = document.getElementById('slotZone').value;
      const slotNumber = parseInt(document.getElementById('slotNumber').value);
      
      if (!freezerId || !zoneId || !slotNumber) {
        showError('请填写必填项');
        return;
      }
      
      try {
        const existing = modals.slot.data;
        if (existing && existing.id) {
          await apiFetch(`/slots/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify({ freezerId, zoneId, slotNumber })
          });
          showSuccess('格口已更新');
        } else {
          await apiFetch('/slots', {
            method: 'POST',
            body: JSON.stringify({ freezerId, zoneId, slotNumber })
          });
          showSuccess('格口已创建');
        }
        closeModal('slot');
        await loadAllData();
      } catch (err) {
        if (err.type === 'DUPLICATE_SLOT') {
          showError('格口编号已存在于该冷柜中');
        } else {
          showError(err.error || '保存失败');
        }
      }
    });
  }
  
  const saveVendorBtn = document.getElementById('saveVendorBtn');
  if (saveVendorBtn) {
    saveVendorBtn.addEventListener('click', async () => {
      const name = document.getElementById('vendorName').value;
      const stallNumber = document.getElementById('vendorStall').value;
      const phone = document.getElementById('vendorPhone').value;
      
      if (!name) {
        showError('请填写摊主名称');
        return;
      }
      
      try {
        const existing = modals.vendor.data;
        if (existing && existing.id) {
          await apiFetch(`/vendors/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, stallNumber, phone })
          });
          showSuccess('摊主已更新');
        } else {
          await apiFetch('/vendors', {
            method: 'POST',
            body: JSON.stringify({ name, stallNumber, phone })
          });
          showSuccess('摊主已创建');
        }
        closeModal('vendor');
        await loadAllData();
      } catch (err) {
        showError(err.error || '保存失败');
      }
    });
  }
  
  const saveOccupancyBtn = document.getElementById('saveOccupancyBtn');
  if (saveOccupancyBtn) {
    saveOccupancyBtn.addEventListener('click', async () => {
      const vendorId = document.getElementById('occVendor').value;
      const slotId = document.getElementById('occSlot').value;
      const startTime = document.getElementById('occStart').value;
      const endTime = document.getElementById('occEnd').value;
      const notes = document.getElementById('occNotes').value;
      
      if (!vendorId || !slotId || !startTime || !endTime) {
        showError('请填写必填项');
        return;
      }
      
      if (new Date(startTime) >= new Date(endTime)) {
        showError('结束时间必须晚于开始时间');
        return;
      }
      
      try {
        const existing = modals.occupancy.data;
        if (existing && existing.id) {
          await apiFetch(`/occupancy/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify({ startTime, endTime, notes })
          });
          showSuccess('记录已更新');
        } else {
          await apiFetch('/occupancy', {
            method: 'POST',
            body: JSON.stringify({ vendorId, slotId, startTime, endTime, notes })
          });
          showSuccess('占用已登记，等待确认');
        }
        closeModal('occupancy');
        await loadAllData();
      } catch (err) {
        if (err.type === 'STATUS_CONFLICT') {
          showError('状态冲突：' + err.error);
        } else if (err.type === 'SOURCE_RECORD_MISSING') {
          showError('来源记录缺失：' + err.error);
        } else {
          showError(err.error || '保存失败');
        }
      }
    });
  }
  
  const saveRuleBtn = document.getElementById('saveRuleBtn');
  if (saveRuleBtn) {
    saveRuleBtn.addEventListener('click', async () => {
      const zoneType = document.getElementById('ruleType').value;
      const pricePerHour = parseFloat(document.getElementById('rulePrice').value);
      const minHours = parseInt(document.getElementById('ruleMin').value) || 1;
      const maxHours = parseInt(document.getElementById('ruleMax').value) || 24;
      
      if (!zoneType || isNaN(pricePerHour)) {
        showError('请填写必填项');
        return;
      }
      
      try {
        const existing = modals.rule.data;
        if (existing && existing.id) {
          await apiFetch(`/billing-rules/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify({ pricePerHour, minHours, maxHours })
          });
          showSuccess('规则已更新');
        } else {
          await apiFetch('/billing-rules', {
            method: 'POST',
            body: JSON.stringify({ zoneType, pricePerHour, minHours, maxHours })
          });
          showSuccess('规则已创建');
        }
        closeModal('rule');
        await loadAllData();
      } catch (err) {
        if (err.type === 'DUPLICATE_SUBMIT') {
          showError('重复提交：' + err.error);
        } else {
          showError(err.error || '保存失败');
        }
      }
    });
  }
  
  const occFreezer = document.getElementById('occFreezer');
  const occZone = document.getElementById('occZone');
  const occSlot = document.getElementById('occSlot');
  const occStart = document.getElementById('occStart');
  const occEnd = document.getElementById('occEnd');
  const occPreview = document.getElementById('occPreview');
  const occCost = document.getElementById('occCost');
  const occPrice = document.getElementById('occPrice');
  const occHours = document.getElementById('occHours');
  
  function updateOccupancyZones() {
    if (!occFreezer || !occZone) return;
    const freezerId = occFreezer.value;
    const zones = appState.zones.filter(z => z.freezerId === freezerId);
    occZone.innerHTML = zones.length > 0 
      ? zones.map(z => `<option value="${z.id}">${z.name} (${formatMoney(z.pricePerHour)}/小时)</option>`).join('')
      : '<option value="">该冷柜暂无温区</option>';
    updateOccupancySlots();
  }
  
  function updateOccupancySlots() {
    if (!occZone || !occSlot) return;
    const zoneId = occZone.value;
    const slots = appState.slots.filter(s => s.zoneId === zoneId && s.status === 'available');
    occSlot.innerHTML = slots.length > 0
      ? slots.map(s => `<option value="${s.id}">格口 #${s.slotNumber}</option>`).join('')
      : '<option value="">该温区暂无可选格口</option>';
    updateOccupancyCost();
  }
  
  function updateOccupancyCost() {
    if (!occZone || !occStart || !occEnd || !occPreview) return;
    
    const zoneId = occZone.value;
    const zone = appState.zones.find(z => z.id === zoneId);
    const start = new Date(occStart.value);
    const end = new Date(occEnd.value);
    
    if (zone && start && end && end > start) {
      const hours = (end - start) / (1000 * 60 * 60);
      const cost = hours * zone.pricePerHour;
      occPrice.textContent = formatMoney(zone.pricePerHour);
      occHours.textContent = hours.toFixed(1);
      occCost.textContent = formatMoney(cost);
      occPreview.style.display = 'block';
    } else {
      occPreview.style.display = 'none';
    }
  }
  
  if (occFreezer) {
    occFreezer.addEventListener('change', updateOccupancyZones);
    const data = modals.occupancy.data;
    if (data && data.freezerId) {
      updateOccupancyZones();
      if (occZone) occZone.value = data.zoneId;
      updateOccupancySlots();
      if (occSlot) occSlot.value = data.slotId;
    }
  }
  if (occZone) occZone.addEventListener('change', updateOccupancySlots);
  if (occStart) occStart.addEventListener('change', updateOccupancyCost);
  if (occEnd) occEnd.addEventListener('change', updateOccupancyCost);
  
  const slotFreezerFilter = document.getElementById('slotFreezerFilter');
  const slotStatusFilter = document.getElementById('slotStatusFilter');
  function filterSlots() {
    const freezerId = slotFreezerFilter ? slotFreezerFilter.value : '';
    const status = slotStatusFilter ? slotStatusFilter.value : '';
    const rows = document.querySelectorAll('#slotTableBody tr');
    rows.forEach(row => {
      const matchFreezer = !freezerId || row.dataset.freezer === freezerId;
      const matchStatus = !status || row.dataset.status === status;
      row.style.display = matchFreezer && matchStatus ? '' : 'none';
    });
  }
  if (slotFreezerFilter) slotFreezerFilter.addEventListener('change', filterSlots);
  if (slotStatusFilter) slotStatusFilter.addEventListener('change', filterSlots);
  
  const occupancyVendorFilter = document.getElementById('occupancyVendorFilter');
  const occupancyStatusFilter = document.getElementById('occupancyStatusFilter');
  function filterOccupancy() {
    const vendorId = occupancyVendorFilter ? occupancyVendorFilter.value : '';
    const status = occupancyStatusFilter ? occupancyStatusFilter.value : '';
    const rows = document.querySelectorAll('#occupancyTableBody tr');
    rows.forEach(row => {
      const matchVendor = !vendorId || row.dataset.vendor === vendorId;
      const matchStatus = !status || row.dataset.status === status;
      row.style.display = matchVendor && matchStatus ? '' : 'none';
    });
  }
  if (occupancyVendorFilter) occupancyVendorFilter.addEventListener('change', filterOccupancy);
  if (occupancyStatusFilter) occupancyStatusFilter.addEventListener('change', filterOccupancy);
  
  const exportBillingBtn = document.getElementById('exportBillingBtn');
  if (exportBillingBtn) {
    exportBillingBtn.addEventListener('click', () => {
      const status = document.getElementById('exportStatus').value;
      const vendor = document.getElementById('exportVendor').value;
      let url = `${API_BASE}/export/billing?`;
      if (status) url += `status=${status}&`;
      if (vendor) url += `vendorId=${vendor}&`;
      window.open(url, '_blank');
    });
  }
  
  const exportDashboardBtn = document.getElementById('exportDashboardBtn');
  if (exportDashboardBtn) {
    exportDashboardBtn.addEventListener('click', async () => {
      try {
        const data = await apiFetch('/export/dashboard');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        showSuccess('统计数据已导出');
      } catch (err) {
        showError(err.error || '导出失败');
      }
    });
  }
  
  const testDuplicate = document.getElementById('testDuplicate');
  if (testDuplicate) {
    testDuplicate.addEventListener('click', async () => {
      try {
        await apiFetch('/billing-rules', {
          method: 'POST',
          body: JSON.stringify({ zoneType: 'chilled', pricePerHour: 2.5 })
        });
        showSuccess('测试通过？应该失败才对');
      } catch (err) {
        if (err.type === 'DUPLICATE_SUBMIT') {
          showSuccess('✅ 边界情况验证通过：检测到重复提交，已阻止');
        } else {
          showError('测试失败：' + (err.error || '未知错误'));
        }
      }
    });
  }
  
  const testConflict = document.getElementById('testConflict');
  if (testConflict) {
    testConflict.addEventListener('click', async () => {
      try {
        const records = appState.occupancyRecords.filter(r => r.status === 'confirmed');
        if (records.length === 0) {
          showError('请先确认一条占用记录，再测试状态冲突');
          return;
        }
        await apiFetch(`/occupancy/${records[0].id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'pending' })
        });
        showSuccess('测试通过？应该失败才对');
      } catch (err) {
        if (err.type === 'STATUS_CONFLICT') {
          showSuccess('✅ 边界情况验证通过：检测到状态冲突，已阻止修改已确认记录');
        } else {
          showError('测试失败：' + (err.error || '未知错误'));
        }
      }
    });
  }
  
  const testMissing = document.getElementById('testMissing');
  if (testMissing) {
    testMissing.addEventListener('click', async () => {
      const slots = appState.slots;
      if (slots.length === 0) {
        showError('请先加载示例数据');
        return;
      }
      try {
        await apiFetch('/occupancy', {
          method: 'POST',
          body: JSON.stringify({
            vendorId: 'non-existent-vendor-id',
            slotId: slots[0].id,
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 3600000).toISOString()
          })
        });
        showSuccess('测试通过？应该失败才对');
      } catch (err) {
        if (err.type === 'SOURCE_RECORD_MISSING') {
          showSuccess('✅ 边界情况验证通过：检测到来源记录缺失（摊主不存在）');
        } else {
          showError('测试失败：' + (err.error || '未知错误'));
        }
      }
    });
  }
  
  document.querySelectorAll('.slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const slotId = slot.dataset.slotId;
      const slotData = appState.slots.find(s => s.id === slotId);
      if (slotData) {
        const zone = appState.zones.find(z => z.id === slotData.zoneId);
        const vendor = appState.vendors.find(v => v.id === slotData.currentVendorId);
        alert(`格口 #${slotData.slotNumber}\n\n状态: ${slotData.status === 'available' ? '可用' : '已占用'}\n温区: ${zone ? zone.name : '未知'}\n单价: ${zone ? formatMoney(zone.pricePerHour) + '/小时' : '-'}\n当前摊主: ${vendor ? vendor.name : '无'}`);
      }
    });
  });
}

window.onload = async () => {
  await loadAllData();
};
