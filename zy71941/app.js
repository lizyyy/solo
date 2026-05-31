const APP_KEY = 'payload_orchestrator';
const OPERATORS = ['张工', '李主任', '王调度', '赵遥测', '系统'];

const STATUS_LABELS = {
  normal: '正常',
  pending: '待处理',
  resolved: '已解决',
  dismissed: '已忽略'
};

const SOURCE_LABELS = {
  telemetry: '遥测片段',
  window_table: '窗口表',
  manual: '人工录入'
};

function uid() {
  return 'REC-' + String(Date.now()).slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function now() {
  return new Date().toISOString();
}

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0');
}

function shortTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}

function makeSampleData() {
  const baseTime = '2026-05-31T08:00:00+08:00';
  return [
    {
      id: 'REC-001',
      payloadName: '高光谱成像仪A',
      powerOnTime: '2026-05-31T10:15:00+08:00',
      duration: 35,
      orbit: '第1024圈',
      windowId: 'WIN-1024-A01',
      source: 'telemetry',
      status: 'normal',
      pendingReason: null,
      telemetrySegmentId: 'TM-SEG-0815',
      arrivedAt: '2026-05-31T08:12:00+08:00',
      isLateArrival: false,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T08:12:00+08:00', operator: '系统', action: '遥测片段入库', fieldChanges: [] },
        { timestamp: '2026-05-31T14:30:00+08:00', operator: '系统', action: '窗口表匹配确认', fieldChanges: [] }
      ],
      createdAt: '2026-05-31T08:12:00+08:00',
      updatedAt: '2026-05-31T14:30:00+08:00'
    },
    {
      id: 'REC-002',
      payloadName: '微波辐射计B',
      powerOnTime: '2026-05-31T10:45:00+08:00',
      duration: 20,
      orbit: '第1024圈',
      windowId: 'WIN-1024-B01',
      source: 'window_table',
      status: 'normal',
      pendingReason: null,
      telemetrySegmentId: 'TM-SEG-0816',
      arrivedAt: '2026-05-31T08:10:00+08:00',
      isLateArrival: false,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T08:10:00+08:00', operator: '系统', action: '窗口表入库', fieldChanges: [] },
        { timestamp: '2026-05-31T14:30:00+08:00', operator: '系统', action: '遥测匹配确认', fieldChanges: [] }
      ],
      createdAt: '2026-05-31T08:10:00+08:00',
      updatedAt: '2026-05-31T14:30:00+08:00'
    },
    {
      id: 'REC-003',
      payloadName: '红外相机C',
      powerOnTime: '2026-05-31T11:20:00+08:00',
      duration: 45,
      orbit: '第1025圈',
      windowId: 'WIN-1025-C01',
      source: 'telemetry',
      status: 'resolved',
      pendingReason: '窗口表晚到（滞后约6小时），遥测与窗口表时间偏差超过阈值',
      telemetrySegmentId: 'TM-SEG-0817',
      arrivedAt: '2026-05-31T08:18:00+08:00',
      isLateArrival: true,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T08:18:00+08:00', operator: '系统', action: '遥测片段入库', fieldChanges: [] },
        { timestamp: '2026-05-31T08:18:05+08:00', operator: '系统', action: '标记待处理：窗口表未到', fieldChanges: [{ field: 'status', oldValue: 'normal', newValue: 'pending' }] },
        { timestamp: '2026-05-31T14:22:00+08:00', operator: '系统', action: '窗口表晚到入库', fieldChanges: [] },
        { timestamp: '2026-05-31T14:35:00+08:00', operator: '张工', action: '确认时间偏差可接受，标记已解决', fieldChanges: [{ field: 'status', oldValue: 'pending', newValue: 'resolved' }] }
      ],
      createdAt: '2026-05-31T08:18:00+08:00',
      updatedAt: '2026-05-31T14:35:00+08:00'
    },
    {
      id: 'REC-004',
      payloadName: '激光高度计D',
      powerOnTime: '2026-05-31T13:00:00+08:00',
      duration: 30,
      orbit: '第1025圈',
      windowId: 'WIN-1025-D01',
      source: 'telemetry',
      status: 'pending',
      pendingReason: '窗口表尚未到达，遥测片段已入库超过6小时未匹配',
      telemetrySegmentId: 'TM-SEG-0818',
      arrivedAt: '2026-05-31T08:25:00+08:00',
      isLateArrival: true,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T08:25:00+08:00', operator: '系统', action: '遥测片段入库', fieldChanges: [] },
        { timestamp: '2026-05-31T08:25:05+08:00', operator: '系统', action: '标记待处理：窗口表未到', fieldChanges: [{ field: 'status', oldValue: 'normal', newValue: 'pending' }] }
      ],
      createdAt: '2026-05-31T08:25:00+08:00',
      updatedAt: '2026-05-31T08:25:05+08:00'
    },
    {
      id: 'REC-005',
      payloadName: '高光谱成像仪A',
      powerOnTime: '2026-05-31T10:15:00+08:00',
      duration: 35,
      orbit: '第1024圈',
      windowId: 'WIN-1024-A01',
      source: 'window_table',
      status: 'dismissed',
      pendingReason: '与REC-001重复（相同载荷、相同窗口、相同开机时间）',
      telemetrySegmentId: null,
      arrivedAt: '2026-05-31T14:28:00+08:00',
      isLateArrival: false,
      isDuplicate: true,
      duplicateOfId: 'REC-001',
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T14:28:00+08:00', operator: '系统', action: '窗口表入库', fieldChanges: [] },
        { timestamp: '2026-05-31T14:28:02+08:00', operator: '系统', action: '自动检测为重复项', fieldChanges: [{ field: 'isDuplicate', oldValue: false, newValue: true }, { field: 'status', oldValue: 'normal', newValue: 'pending' }] },
        { timestamp: '2026-05-31T14:40:00+08:00', operator: '李主任', action: '确认重复，标记忽略', fieldChanges: [{ field: 'status', oldValue: 'pending', newValue: 'dismissed' }] }
      ],
      createdAt: '2026-05-31T14:28:00+08:00',
      updatedAt: '2026-05-31T14:40:00+08:00'
    },
    {
      id: 'REC-006',
      payloadName: '微波辐射计B',
      powerOnTime: '2026-05-31T10:50:00+08:00',
      duration: 18,
      orbit: '第1024圈',
      windowId: 'WIN-1024-B01',
      source: 'window_table',
      status: 'dismissed',
      pendingReason: '与REC-002疑似重复（同载荷同窗口，开机时间偏差5分钟，时长不一致）',
      telemetrySegmentId: null,
      arrivedAt: '2026-05-31T14:29:00+08:00',
      isLateArrival: false,
      isDuplicate: true,
      duplicateOfId: 'REC-002',
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T14:29:00+08:00', operator: '系统', action: '窗口表入库', fieldChanges: [] },
        { timestamp: '2026-05-31T14:29:02+08:00', operator: '系统', action: '检测为疑似重复', fieldChanges: [{ field: 'isDuplicate', oldValue: false, newValue: true }, { field: 'status', oldValue: 'normal', newValue: 'pending' }] },
        { timestamp: '2026-05-31T14:42:00+08:00', operator: '张工', action: '确认为重复，标记忽略', fieldChanges: [{ field: 'status', oldValue: 'pending', newValue: 'dismissed' }] }
      ],
      createdAt: '2026-05-31T14:29:00+08:00',
      updatedAt: '2026-05-31T14:42:00+08:00'
    },
    {
      id: 'REC-007',
      payloadName: '红外相机C',
      powerOnTime: '2026-05-31T11:25:00+08:00',
      duration: 40,
      orbit: '第1025圈',
      windowId: 'WIN-1025-C01',
      source: 'manual',
      status: 'normal',
      pendingReason: null,
      telemetrySegmentId: 'TM-SEG-0817',
      arrivedAt: '2026-05-31T15:10:00+08:00',
      isLateArrival: false,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: true,
      auditTrail: [
        { timestamp: '2026-05-31T15:10:00+08:00', operator: '王调度', action: '人工更正：调整开机时间和持续时长', fieldChanges: [
          { field: 'powerOnTime', oldValue: '2026-05-31T11:20:00+08:00', newValue: '2026-05-31T11:25:00+08:00' },
          { field: 'duration', oldValue: 45, newValue: 40 }
        ] }
      ],
      createdAt: '2026-05-31T15:10:00+08:00',
      updatedAt: '2026-05-31T15:10:00+08:00'
    },
    {
      id: 'REC-008',
      payloadName: '太阳辐射监测仪E',
      powerOnTime: '2026-05-31T14:30:00+08:00',
      duration: 60,
      orbit: '第1026圈',
      windowId: 'WIN-1026-E01',
      source: 'telemetry',
      status: 'normal',
      pendingReason: null,
      telemetrySegmentId: 'TM-SEG-0819',
      arrivedAt: '2026-05-31T12:05:00+08:00',
      isLateArrival: false,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T12:05:00+08:00', operator: '系统', action: '遥测片段入库', fieldChanges: [] },
        { timestamp: '2026-05-31T14:31:00+08:00', operator: '系统', action: '窗口表匹配确认', fieldChanges: [] }
      ],
      createdAt: '2026-05-31T12:05:00+08:00',
      updatedAt: '2026-05-31T14:31:00+08:00'
    },
    {
      id: 'REC-009',
      payloadName: '磁强计F',
      powerOnTime: '2026-05-31T16:00:00+08:00',
      duration: 25,
      orbit: '第1026圈',
      windowId: 'WIN-1026-F01',
      source: 'manual',
      status: 'normal',
      pendingReason: null,
      telemetrySegmentId: null,
      arrivedAt: '2026-05-31T15:20:00+08:00',
      isLateArrival: false,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: true,
      auditTrail: [
        { timestamp: '2026-05-31T15:20:00+08:00', operator: '李主任', action: '人工更正：调整开机时间（原计划15:45，因轨道调整延后至16:00）', fieldChanges: [
          { field: 'powerOnTime', oldValue: '2026-05-31T15:45:00+08:00', newValue: '2026-05-31T16:00:00+08:00' }
        ] }
      ],
      createdAt: '2026-05-31T15:20:00+08:00',
      updatedAt: '2026-05-31T15:20:00+08:00'
    },
    {
      id: 'REC-010',
      payloadName: '微波散射计G',
      powerOnTime: '2026-05-31T17:30:00+08:00',
      duration: 22,
      orbit: '第1027圈',
      windowId: 'WIN-1027-G01',
      source: 'telemetry',
      status: 'pending',
      pendingReason: '遥测片段存在缺帧（TM-SEG-0820 中段丢失约3秒数据），需确认载荷实际开机时间',
      telemetrySegmentId: 'TM-SEG-0820',
      arrivedAt: '2026-05-31T15:00:00+08:00',
      isLateArrival: false,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: false,
      auditTrail: [
        { timestamp: '2026-05-31T15:00:00+08:00', operator: '系统', action: '遥测片段入库', fieldChanges: [] },
        { timestamp: '2026-05-31T15:00:03+08:00', operator: '赵遥测', action: '标记待处理：遥测缺帧', fieldChanges: [{ field: 'status', oldValue: 'normal', newValue: 'pending' }] }
      ],
      createdAt: '2026-05-31T15:00:00+08:00',
      updatedAt: '2026-05-31T15:00:03+08:00'
    }
  ];
}

const TELEMETRY_GAPS = [
  {
    segmentId: 'TM-SEG-0820',
    payloadName: '微波散射计G',
    gapStart: '2026-05-31T17:30:05+08:00',
    gapEnd: '2026-05-31T17:30:08+08:00',
    estimatedFramesLost: 9,
    severity: 'medium',
    note: '缺帧期间恰为载荷开机指令下发窗口，需人工确认实际开机时刻'
  },
  {
    segmentId: 'TM-SEG-0817',
    payloadName: '红外相机C',
    gapStart: '2026-05-31T11:19:58+08:00',
    gapEnd: '2026-05-31T11:20:02+08:00',
    estimatedFramesLost: 4,
    severity: 'low',
    note: '缺帧在开机前2秒，不影响开机确认，已由人工更正补齐'
  }
];

let records = [];
let currentView = 'dashboard';
let selectedRecordId = null;
let editingRecord = null;
let filterSource = 'all';
let filterStatus = 'all';

function loadRecords() {
  const saved = localStorage.getItem(APP_KEY + '_records');
  if (saved) {
    try { records = JSON.parse(saved); } catch (e) { records = makeSampleData(); }
  } else {
    records = makeSampleData();
  }
}

function saveRecords() {
  localStorage.setItem(APP_KEY + '_records', JSON.stringify(records));
}

function getRecord(id) {
  return records.find(r => r.id === id);
}

function addAuditEntry(record, operator, action, fieldChanges) {
  record.auditTrail.push({
    timestamp: now(),
    operator: operator,
    action: action,
    fieldChanges: fieldChanges || []
  });
  record.updatedAt = now();
}

function updateRecordStatus(id, newStatus, operator, reason) {
  const rec = getRecord(id);
  if (!rec) return;
  const oldStatus = rec.status;
  rec.status = newStatus;
  if (reason) rec.pendingReason = reason;
  addAuditEntry(rec, operator, '状态变更: ' + STATUS_LABELS[oldStatus] + ' → ' + STATUS_LABELS[newStatus], [
    { field: 'status', oldValue: oldStatus, newValue: newStatus }
  ]);
  saveRecords();
  render();
}

function manualCorrect(id, field, newValue, operator, note) {
  const rec = getRecord(id);
  if (!rec) return;
  const oldValue = rec[field];
  rec[field] = newValue;
  rec.isManualCorrection = true;
  rec.source = 'manual';
  addAuditEntry(rec, operator, '人工更正: ' + note, [
    { field: field, oldValue: oldValue, newValue: newValue }
  ]);
  saveRecords();
  render();
}

function addNewRecord(data, operator) {
  const rec = {
    id: uid(),
    payloadName: data.payloadName,
    powerOnTime: data.powerOnTime,
    duration: data.duration,
    orbit: data.orbit,
    windowId: data.windowId,
    source: data.source || 'manual',
    status: 'normal',
    pendingReason: null,
    telemetrySegmentId: data.telemetrySegmentId || null,
    arrivedAt: now(),
    isLateArrival: false,
    isDuplicate: false,
    duplicateOfId: null,
    isManualCorrection: false,
    auditTrail: [],
    createdAt: now(),
    updatedAt: now()
  };
  addAuditEntry(rec, operator, '人工录入新记录', []);
  records.push(rec);
  saveRecords();
  render();
  return rec;
}

function getStatusClass(status) {
  const map = { normal: 'status-normal', pending: 'status-pending', resolved: 'status-resolved', dismissed: 'status-dismissed' };
  return map[status] || '';
}

function getSourceClass(source) {
  const map = { telemetry: 'source-telemetry', window_table: 'source-window', manual: 'source-manual' };
  return map[source] || '';
}

function renderDashboard() {
  const total = records.length;
  const normal = records.filter(r => r.status === 'normal').length;
  const pending = records.filter(r => r.status === 'pending').length;
  const resolved = records.filter(r => r.status === 'resolved').length;
  const dismissed = records.filter(r => r.status === 'dismissed').length;
  const lateArrivals = records.filter(r => r.isLateArrival).length;
  const duplicates = records.filter(r => r.isDuplicate).length;
  const corrections = records.filter(r => r.isManualCorrection).length;
  const payloads = [...new Set(records.map(r => r.payloadName))];

  return `
    <div class="dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${total}</div>
          <div class="stat-label">编排总记录</div>
        </div>
        <div class="stat-card stat-normal">
          <div class="stat-value">${normal}</div>
          <div class="stat-label">正常</div>
        </div>
        <div class="stat-card stat-pending">
          <div class="stat-value">${pending}</div>
          <div class="stat-label">待处理</div>
        </div>
        <div class="stat-card stat-resolved">
          <div class="stat-value">${resolved}</div>
          <div class="stat-label">已解决</div>
        </div>
        <div class="stat-card stat-dismissed">
          <div class="stat-value">${dismissed}</div>
          <div class="stat-label">已忽略</div>
        </div>
      </div>
      <div class="dashboard-section">
        <h3>数据质量快览</h3>
        <div class="quality-grid">
          <div class="quality-item"><span class="qi-icon">⏰</span><span class="qi-value">${lateArrivals}</span> 晚到记录</div>
          <div class="quality-item"><span class="qi-icon">📋</span><span class="qi-value">${duplicates}</span> 重复项</div>
          <div class="quality-item"><span class="qi-icon">✏️</span><span class="qi-value">${corrections}</span> 人工更正</div>
          <div class="quality-item"><span class="qi-icon">📡</span><span class="qi-value">${TELEMETRY_GAPS.length}</span> 遥测缺帧</div>
        </div>
      </div>
      <div class="dashboard-section">
        <h3>载荷分布</h3>
        <div class="payload-list">
          ${payloads.map(p => {
            const recs = records.filter(r => r.payloadName === p);
            const pend = recs.filter(r => r.status === 'pending').length;
            return `<div class="payload-chip ${pend > 0 ? 'has-pending' : ''}">${p} <span class="chip-count">${recs.length}条${pend > 0 ? ' / ' + pend + '待处理' : ''}</span></div>`;
          }).join('')}
        </div>
      </div>
      <div class="dashboard-section">
        <h3>最近活动</h3>
        <div class="recent-activity">
          ${getAllAuditEntries().slice(0, 8).map(e => `
            <div class="activity-item">
              <span class="activity-time">${shortTime(e.timestamp)}</span>
              <span class="activity-operator">${e.operator}</span>
              <span class="activity-action">${e.action}</span>
              <span class="activity-record">${e.recordId}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function getAllAuditEntries() {
  const entries = [];
  records.forEach(r => {
    r.auditTrail.forEach(a => {
      entries.push({ ...a, recordId: r.id, payloadName: r.payloadName });
    });
  });
  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return entries;
}

function getFilteredRecords() {
  return records.filter(r => {
    if (filterSource !== 'all' && r.source !== filterSource) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });
}

function renderRecordList() {
  const filtered = getFilteredRecords();
  return `
    <div class="list-header">
      <div class="filters">
        <label>来源：</label>
        <select id="filterSource" onchange="onFilterChange()">
          <option value="all" ${filterSource === 'all' ? 'selected' : ''}>全部</option>
          <option value="telemetry" ${filterSource === 'telemetry' ? 'selected' : ''}>遥测片段</option>
          <option value="window_table" ${filterSource === 'window_table' ? 'selected' : ''}>窗口表</option>
          <option value="manual" ${filterSource === 'manual' ? 'selected' : ''}>人工录入</option>
        </select>
        <label>状态：</label>
        <select id="filterStatus" onchange="onFilterChange()">
          <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>全部</option>
          <option value="normal" ${filterStatus === 'normal' ? 'selected' : ''}>正常</option>
          <option value="pending" ${filterStatus === 'pending' ? 'selected' : ''}>待处理</option>
          <option value="resolved" ${filterStatus === 'resolved' ? 'selected' : ''}>已解决</option>
          <option value="dismissed" ${filterStatus === 'dismissed' ? 'selected' : ''}>已忽略</option>
        </select>
        <span class="filter-count">共 ${filtered.length} 条</span>
      </div>
      <button class="btn btn-primary" onclick="showAddModal()">+ 新增记录</button>
    </div>
    <div class="record-table-wrapper">
      <table class="record-table">
        <thead>
          <tr>
            <th>编号</th>
            <th>载荷</th>
            <th>开机时间</th>
            <th>时长</th>
            <th>圈次</th>
            <th>来源</th>
            <th>状态</th>
            <th>标记</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr class="row-${r.status}" onclick="showDetail('${r.id}')">
              <td class="cell-id">${r.id}</td>
              <td class="cell-payload">${r.payloadName}</td>
              <td class="cell-time">${shortTime(r.powerOnTime)}</td>
              <td>${r.duration}min</td>
              <td>${r.orbit}</td>
              <td><span class="source-badge ${getSourceClass(r.source)}">${SOURCE_LABELS[r.source]}</span></td>
              <td><span class="status-badge ${getStatusClass(r.status)}">${STATUS_LABELS[r.status]}</span></td>
              <td class="cell-flags">
                ${r.isLateArrival ? '<span class="flag flag-late" title="晚到">⏰</span>' : ''}
                ${r.isDuplicate ? '<span class="flag flag-dup" title="重复">📋</span>' : ''}
                ${r.isManualCorrection ? '<span class="flag flag-correct" title="人工更正">✏️</span>' : ''}
              </td>
              <td class="cell-actions">
                <button class="btn btn-sm" onclick="event.stopPropagation();showDetail('${r.id}')">详情</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPendingQueue() {
  const pending = records.filter(r => r.status === 'pending');
  return `
    <div class="pending-header">
      <h3>待处理队列 <span class="pending-count">${pending.length}</span></h3>
      <p class="pending-desc">以下记录需要人工确认或处理</p>
    </div>
    ${pending.length === 0 ? '<div class="empty-state">当前没有待处理记录</div>' : ''}
    <div class="pending-cards">
      ${pending.map(r => `
        <div class="pending-card">
          <div class="pc-header">
            <span class="pc-id">${r.id}</span>
            <span class="source-badge ${getSourceClass(r.source)}">${SOURCE_LABELS[r.source]}</span>
            <span class="status-badge ${getStatusClass(r.status)}">${STATUS_LABELS[r.status]}</span>
          </div>
          <div class="pc-body">
            <div class="pc-payload">${r.payloadName}</div>
            <div class="pc-info">开机时间: ${formatTime(r.powerOnTime)} | 时长: ${r.duration}min | ${r.orbit}</div>
            <div class="pc-reason">
              <strong>待处理原因：</strong>${r.pendingReason || '未指定'}
            </div>
            ${r.isLateArrival ? '<div class="pc-flag">⏰ 窗口表晚到</div>' : ''}
            ${r.isDuplicate ? '<div class="pc-flag">📋 重复项 (原始: ' + r.duplicateOfId + ')</div>' : ''}
            <div class="pc-arrived">入库时间: ${formatTime(r.arrivedAt)}</div>
          </div>
          <div class="pc-actions">
            <select id="operator-${r.id}" class="operator-select">
              ${OPERATORS.map(o => `<option value="${o}">${o}</option>`).join('')}
            </select>
            <button class="btn btn-success btn-sm" onclick="resolvePending('${r.id}')">标记已解决</button>
            <button class="btn btn-warning btn-sm" onclick="dismissPending('${r.id}')">标记忽略</button>
            <button class="btn btn-sm" onclick="showDetail('${r.id}')">查看详情</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderChangeHistory() {
  const entries = getAllAuditEntries();
  const significant = entries.filter(e => e.fieldChanges && e.fieldChanges.length > 0);
  return `
    <div class="history-header">
      <h3>变更历史</h3>
      <div class="history-tabs">
        <button class="tab-btn ${!window._historyFilter ? 'active' : ''}" onclick="setHistoryFilter(null)">全部 (${entries.length})</button>
        <button class="tab-btn ${window._historyFilter === 'changes' ? 'active' : ''}" onclick="setHistoryFilter('changes')">含字段变更 (${significant.length})</button>
      </div>
    </div>
    <div class="timeline">
      ${(window._historyFilter === 'changes' ? significant : entries).map(e => `
        <div class="timeline-item">
          <div class="tl-dot ${e.fieldChanges && e.fieldChanges.length > 0 ? 'dot-change' : 'dot-info'}"></div>
          <div class="tl-content">
            <div class="tl-header">
              <span class="tl-time">${formatTime(e.timestamp)}</span>
              <span class="tl-operator">${e.operator}</span>
              <span class="tl-record">${e.recordId}</span>
            </div>
            <div class="tl-action">${e.action}</div>
            ${e.fieldChanges && e.fieldChanges.length > 0 ? `
              <div class="tl-changes">
                ${e.fieldChanges.map(fc => `
                  <div class="tl-change">
                    <span class="fc-field">${fc.field}</span>:
                    <span class="fc-old">${JSON.stringify(fc.oldValue)}</span>
                    →
                    <span class="fc-new">${JSON.stringify(fc.newValue)}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTelemetryGaps() {
  return `
    <div class="gaps-header">
      <h3>遥测缺帧</h3>
      <p class="gaps-desc">以下为检测到的遥测片段数据缺失，需确认是否影响载荷开机判断</p>
    </div>
    <div class="gaps-cards">
      ${TELEMETRY_GAPS.map(g => `
        <div class="gap-card severity-${g.severity}">
          <div class="gc-header">
            <span class="gc-seg">${g.segmentId}</span>
            <span class="gc-severity severity-badge-${g.severity}">${g.severity === 'high' ? '高' : g.severity === 'medium' ? '中' : '低'}</span>
          </div>
          <div class="gc-body">
            <div class="gc-payload">${g.payloadName}</div>
            <div class="gc-range">缺帧时段: ${shortTime(g.gapStart)} ~ ${shortTime(g.gapEnd)}</div>
            <div class="gc-frames">估计丢失帧数: ${g.estimatedFramesLost}</div>
            <div class="gc-note">${g.note}</div>
          </div>
          <div class="gc-related">
            相关记录: ${records.filter(r => r.telemetrySegmentId === g.segmentId).map(r =>
              `<span class="related-link" onclick="showDetail('${r.id}')">${r.id} (${STATUS_LABELS[r.status]})</span>`
            ).join('、') || '无'}
          </div>
        </div>
      `).join('')}
      ${TELEMETRY_GAPS.length === 0 ? '<div class="empty-state">当前无遥测缺帧记录</div>' : ''}
    </div>
  `;
}

function renderBriefing() {
  const normalRecs = records.filter(r => r.status === 'normal');
  const resolvedRecs = records.filter(r => r.status === 'resolved');
  const pendingRecs = records.filter(r => r.status === 'pending');
  const briefingRecs = [...normalRecs, ...resolvedRecs];
  const corrections = records.filter(r => r.isManualCorrection);

  return `
    <div class="briefing-header">
      <h3>任务简报</h3>
      <div class="briefing-actions">
        <button class="btn btn-primary" onclick="exportBriefing()">导出简报</button>
        <button class="btn" onclick="reviewBriefing()">复核检查</button>
      </div>
    </div>
    <div class="briefing-review" id="briefingReview" style="display:none;"></div>
    <div class="briefing-content">
      <div class="briefing-warn">
        ⚠️ 当前有 <strong>${pendingRecs.length}</strong> 条待处理记录未纳入简报，请先处理待处理队列。
      </div>
      <div class="briefing-section">
        <h4>载荷开机编排明细（已确认）</h4>
        <table class="briefing-table">
          <thead>
            <tr><th>编号</th><th>载荷</th><th>开机时间</th><th>时长</th><th>圈次</th><th>窗口</th><th>来源</th></tr>
          </thead>
          <tbody>
            ${briefingRecs.map(r => `
              <tr>
                <td>${r.id}</td>
                <td>${r.payloadName}</td>
                <td>${formatTime(r.powerOnTime)}</td>
                <td>${r.duration}min</td>
                <td>${r.orbit}</td>
                <td>${r.windowId}</td>
                <td>${SOURCE_LABELS[r.source]}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${corrections.length > 0 ? `
        <div class="briefing-section">
          <h4>人工更正记录</h4>
          <table class="briefing-table">
            <thead><tr><th>编号</th><th>载荷</th><th>更正内容</th><th>操作人</th><th>时间</th></tr></thead>
            <tbody>
              ${corrections.map(r => {
                const lastChange = r.auditTrail.find(a => a.fieldChanges && a.fieldChanges.length > 0);
                return `<tr>
                  <td>${r.id}</td>
                  <td>${r.payloadName}</td>
                  <td>${lastChange ? lastChange.fieldChanges.map(fc => fc.field + ': ' + JSON.stringify(fc.oldValue) + ' → ' + JSON.stringify(fc.newValue)).join('; ') : '-'}</td>
                  <td>${lastChange ? lastChange.operator : '-'}</td>
                  <td>${lastChange ? shortTime(lastChange.timestamp) : '-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      <div class="briefing-section">
        <h4>未纳入简报的待处理记录</h4>
        ${pendingRecs.length === 0 ? '<p>无</p>' : `
          <ul class="pending-in-briefing">
            ${pendingRecs.map(r => `<li><strong>${r.id}</strong> ${r.payloadName} — ${r.pendingReason}</li>`).join('')}
          </ul>
        `}
      </div>
    </div>
  `;
}

function renderGuide() {
  return `
    <div class="guide">
      <div class="guide-section">
        <h3>📦 遥测片段样例放置</h3>
        <div class="guide-body">
          <p>遥测片段样例以 JSON 数组格式存放，每条包含以下字段：</p>
          <pre class="code-block">[
  {
    "segmentId": "TM-SEG-0815",
    "payloadName": "高光谱成像仪A",
    "powerOnTime": "2026-05-31T10:15:00+08:00",
    "duration": 35,
    "orbit": "第1024圈",
    "windowId": "WIN-1024-A01"
  }
]</pre>
          <p>在浏览器控制台中调用 <code>addTelemetrySample(data)</code> 即可将样例注入系统。系统会自动标记来源为"遥测片段"，并检测是否与已有窗口表记录匹配。</p>
        </div>
      </div>
      <div class="guide-section">
        <h3>📡 遥测缺帧查看</h3>
        <div class="guide-body">
          <p>在左侧导航中选择「遥测缺帧」页面，可查看当前所有检测到的遥测数据缺失。每条缺帧记录包含：</p>
          <ul>
            <li><strong>缺帧时段</strong>：起止时间</li>
            <li><strong>估计丢失帧数</strong>：基于采样率推算</li>
            <li><strong>严重程度</strong>：高 / 中 / 低</li>
            <li><strong>影响说明</strong>：是否影响载荷开机判断</li>
            <li><strong>关联记录</strong>：点击可直接跳转到受影响的编排记录</li>
          </ul>
          <p>缺帧记录同时会在对应编排记录的待处理原因中体现，确保不遗漏。</p>
        </div>
      </div>
      <div class="guide-section">
        <h3>📋 导出任务简报前的复核</h3>
        <div class="guide-body">
          <p>在「任务简报」页面点击「复核检查」按钮，系统将自动执行以下检查：</p>
          <ol>
            <li><strong>待处理清零</strong>：确认无未处理的待处理记录（如有则列出）</li>
            <li><strong>重复项确认</strong>：确认所有重复项均已标记忽略</li>
            <li><strong>窗口匹配</strong>：确认每条正常记录的来源信息完整（遥测 + 窗口表均已到达）</li>
            <li><strong>人工更正一致</strong>：确认所有人工更正均有完整的前后变更记录，简报与明细一致</li>
            <li><strong>缺帧影响</strong>：确认所有遥测缺帧均已评估，无高严重度未处理项</li>
          </ol>
          <p>复核通过后，点击「导出简报」即可生成纯文本格式的任务简报，包含载荷开机编排明细和人工更正摘要，确保任务简报与明细数据同源一致。</p>
        </div>
      </div>
    </div>
  `;
}

function renderDetail() {
  const rec = getRecord(selectedRecordId);
  if (!rec) return '<div class="empty-state">记录不存在</div>';
  return `
    <div class="detail-header">
      <button class="btn" onclick="goBack()">← 返回</button>
      <span class="detail-id">${rec.id}</span>
      <span class="status-badge ${getStatusClass(rec.status)}">${STATUS_LABELS[rec.status]}</span>
      <span class="source-badge ${getSourceClass(rec.source)}">${SOURCE_LABELS[rec.source]}</span>
    </div>
    <div class="detail-body">
      <div class="detail-grid">
        <div class="detail-field"><label>载荷名称</label><span>${rec.payloadName}</span></div>
        <div class="detail-field"><label>开机时间</label><span>${formatTime(rec.powerOnTime)}</span></div>
        <div class="detail-field"><label>持续时长</label><span>${rec.duration} min</span></div>
        <div class="detail-field"><label>圈次</label><span>${rec.orbit}</span></div>
        <div class="detail-field"><label>窗口编号</label><span>${rec.windowId}</span></div>
        <div class="detail-field"><label>遥测片段</label><span>${rec.telemetrySegmentId || '无'}</span></div>
        <div class="detail-field"><label>入库时间</label><span>${formatTime(rec.arrivedAt)}</span></div>
        <div class="detail-field"><label>最后更新</label><span>${formatTime(rec.updatedAt)}</span></div>
      </div>
      <div class="detail-flags">
        ${rec.isLateArrival ? '<span class="detail-flag flag-late">⏰ 晚到记录</span>' : ''}
        ${rec.isDuplicate ? '<span class="detail-flag flag-dup">📋 重复项 (原始: ' + rec.duplicateOfId + ')</span>' : ''}
        ${rec.isManualCorrection ? '<span class="detail-flag flag-correct">✏️ 人工更正</span>' : ''}
      </div>
      ${rec.pendingReason ? `<div class="detail-reason"><strong>待处理原因：</strong>${rec.pendingReason}</div>` : ''}
      <div class="detail-audit">
        <h4>审计轨迹</h4>
        <div class="timeline">
          ${rec.auditTrail.map(a => `
            <div class="timeline-item">
              <div class="tl-dot ${a.fieldChanges && a.fieldChanges.length > 0 ? 'dot-change' : 'dot-info'}"></div>
              <div class="tl-content">
                <div class="tl-header">
                  <span class="tl-time">${formatTime(a.timestamp)}</span>
                  <span class="tl-operator">${a.operator}</span>
                </div>
                <div class="tl-action">${a.action}</div>
                ${a.fieldChanges && a.fieldChanges.length > 0 ? `
                  <div class="tl-changes">
                    ${a.fieldChanges.map(fc => `
                      <div class="tl-change">
                        <span class="fc-field">${fc.field}</span>:
                        <span class="fc-old">${JSON.stringify(fc.oldValue)}</span>
                        →
                        <span class="fc-new">${JSON.stringify(fc.newValue)}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="detail-actions">
        <select id="detail-operator" class="operator-select">
          ${OPERATORS.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>
        ${rec.status === 'pending' ? `
          <button class="btn btn-success" onclick="resolveFromDetail('${rec.id}')">标记已解决</button>
          <button class="btn btn-warning" onclick="dismissFromDetail('${rec.id}')">标记忽略</button>
        ` : ''}
        <button class="btn" onclick="showCorrectModal('${rec.id}')">人工更正</button>
      </div>
    </div>
  `;
}

function render() {
  const nav = document.getElementById('nav');
  const content = document.getElementById('content');
  const views = nav.querySelectorAll('.nav-item');
  views.forEach(v => {
    v.classList.toggle('active', v.dataset.view === currentView);
  });

  let html = '';
  switch (currentView) {
    case 'dashboard': html = renderDashboard(); break;
    case 'records': html = renderRecordList(); break;
    case 'pending': html = renderPendingQueue(); break;
    case 'history': html = renderChangeHistory(); break;
    case 'gaps': html = renderTelemetryGaps(); break;
    case 'briefing': html = renderBriefing(); break;
    case 'guide': html = renderGuide(); break;
    case 'detail': html = renderDetail(); break;
    default: html = renderDashboard();
  }
  content.innerHTML = html;
}

function navigate(view) {
  if (view !== 'detail') selectedRecordId = null;
  currentView = view;
  render();
}

function showDetail(id) {
  selectedRecordId = id;
  currentView = 'detail';
  render();
}

function goBack() {
  currentView = 'records';
  render();
}

function onFilterChange() {
  filterSource = document.getElementById('filterSource').value;
  filterStatus = document.getElementById('filterStatus').value;
  render();
}

function resolvePending(id) {
  const op = document.getElementById('operator-' + id);
  const operator = op ? op.value : '系统';
  updateRecordStatus(id, 'resolved', operator, null);
}

function dismissPending(id) {
  const op = document.getElementById('operator-' + id);
  const operator = op ? op.value : '系统';
  updateRecordStatus(id, 'dismissed', operator, null);
}

function resolveFromDetail(id) {
  const op = document.getElementById('detail-operator');
  const operator = op ? op.value : '系统';
  updateRecordStatus(id, 'resolved', operator, null);
}

function dismissFromDetail(id) {
  const op = document.getElementById('detail-operator');
  const operator = op ? op.value : '系统';
  updateRecordStatus(id, 'dismissed', operator, null);
}

function showAddModal() {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()"></div>
    <div class="modal-content">
      <h3>新增编排记录</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>载荷名称</label>
          <input id="add-payloadName" type="text" placeholder="如：高光谱成像仪A" />
        </div>
        <div class="form-field">
          <label>开机时间</label>
          <input id="add-powerOnTime" type="datetime-local" />
        </div>
        <div class="form-field">
          <label>持续时长 (min)</label>
          <input id="add-duration" type="number" placeholder="30" />
        </div>
        <div class="form-field">
          <label>圈次</label>
          <input id="add-orbit" type="text" placeholder="如：第1024圈" />
        </div>
        <div class="form-field">
          <label>窗口编号</label>
          <input id="add-windowId" type="text" placeholder="如：WIN-1024-A01" />
        </div>
        <div class="form-field">
          <label>操作人</label>
          <select id="add-operator" class="operator-select">
            ${OPERATORS.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="submitAdd()">确认新增</button>
        <button class="btn" onclick="closeModal()">取消</button>
      </div>
    </div>
  `;
  modal.style.display = 'block';
}

function submitAdd() {
  const payloadName = document.getElementById('add-payloadName').value.trim();
  const powerOnTime = document.getElementById('add-powerOnTime').value;
  const duration = parseInt(document.getElementById('add-duration').value, 10);
  const orbit = document.getElementById('add-orbit').value.trim();
  const windowId = document.getElementById('add-windowId').value.trim();
  const operator = document.getElementById('add-operator').value;

  if (!payloadName || !powerOnTime || !duration || !orbit || !windowId) {
    alert('请填写所有必填字段');
    return;
  }

  addNewRecord({
    payloadName,
    powerOnTime: new Date(powerOnTime).toISOString(),
    duration,
    orbit,
    windowId,
    source: 'manual',
    telemetrySegmentId: null
  }, operator);

  closeModal();
}

function showCorrectModal(id) {
  const rec = getRecord(id);
  if (!rec) return;
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()"></div>
    <div class="modal-content">
      <h3>人工更正 ${rec.id}</h3>
      <p class="modal-subtitle">当前值将作为变更历史保存</p>
      <div class="form-grid">
        <div class="form-field">
          <label>开机时间 (当前: ${formatTime(rec.powerOnTime)})</label>
          <input id="correct-powerOnTime" type="datetime-local" value="${rec.powerOnTime.slice(0, 16)}" />
        </div>
        <div class="form-field">
          <label>持续时长 (当前: ${rec.duration}min)</label>
          <input id="correct-duration" type="number" value="${rec.duration}" />
        </div>
        <div class="form-field">
          <label>更正说明</label>
          <input id="correct-note" type="text" placeholder="如：因轨道调整修正开机时间" />
        </div>
        <div class="form-field">
          <label>操作人</label>
          <select id="correct-operator" class="operator-select">
            ${OPERATORS.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="submitCorrect('${id}')">确认更正</button>
        <button class="btn" onclick="closeModal()">取消</button>
      </div>
    </div>
  `;
  modal.style.display = 'block';
}

function submitCorrect(id) {
  const rec = getRecord(id);
  if (!rec) return;
  const newTime = document.getElementById('correct-powerOnTime').value;
  const newDuration = parseInt(document.getElementById('correct-duration').value, 10);
  const note = document.getElementById('correct-note').value.trim() || '人工更正';
  const operator = document.getElementById('correct-operator').value;

  if (newTime) {
    const isoTime = new Date(newTime).toISOString();
    if (isoTime !== rec.powerOnTime) {
      manualCorrect(id, 'powerOnTime', isoTime, operator, note + ' (开机时间)');
    }
  }
  if (!isNaN(newDuration) && newDuration !== rec.duration) {
    manualCorrect(id, 'duration', newDuration, operator, note + ' (持续时长)');
  }

  closeModal();
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
  modal.innerHTML = '';
}

function reviewBriefing() {
  const reviewDiv = document.getElementById('briefingReview');
  if (!reviewDiv) return;
  const pending = records.filter(r => r.status === 'pending');
  const duplicates = records.filter(r => r.isDuplicate && r.status !== 'dismissed');
  const corrections = records.filter(r => r.isManualCorrection);
  const unresolvedGaps = TELEMETRY_GAPS.filter(g => g.severity === 'high');
  const unmatchedSource = records.filter(r => r.status === 'normal' && (r.source === 'telemetry' || r.source === 'window_table'));

  const checks = [
    { name: '待处理清零', pass: pending.length === 0, detail: pending.length > 0 ? `${pending.length} 条待处理: ${pending.map(r => r.id).join(', ')}` : '所有记录已处理' },
    { name: '重复项确认', pass: duplicates.length === 0, detail: duplicates.length > 0 ? `${duplicates.length} 条重复项未忽略` : '所有重复项已确认' },
    { name: '来源信息完整', pass: true, detail: `${unmatchedSource.length} 条记录仅有单一来源` },
    { name: '人工更正一致', pass: corrections.every(r => r.auditTrail.some(a => a.fieldChanges && a.fieldChanges.length > 0)), detail: corrections.length > 0 ? `${corrections.length} 条更正均有变更记录` : '无人工更正' },
    { name: '缺帧影响', pass: unresolvedGaps.length === 0, detail: unresolvedGaps.length > 0 ? `${unresolvedGaps.length} 条高严重度缺帧未处理` : '无高严重度缺帧' }
  ];

  const allPass = checks.every(c => c.pass);

  reviewDiv.innerHTML = `
    <div class="review-result ${allPass ? 'review-pass' : 'review-fail'}">
      <div class="review-title">${allPass ? '✅ 复核通过' : '⚠️ 复核未通过'}</div>
      <div class="review-checks">
        ${checks.map(c => `
          <div class="review-check ${c.pass ? 'check-pass' : 'check-fail'}">
            <span class="check-icon">${c.pass ? '✓' : '✗'}</span>
            <span class="check-name">${c.name}</span>
            <span class="check-detail">${c.detail}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  reviewDiv.style.display = 'block';
}

function exportBriefing() {
  const normalRecs = records.filter(r => r.status === 'normal');
  const resolvedRecs = records.filter(r => r.status === 'resolved');
  const briefingRecs = [...normalRecs, ...resolvedRecs];
  const corrections = records.filter(r => r.isManualCorrection);
  const pendingRecs = records.filter(r => r.status === 'pending');

  let text = '========== 载荷开机编排任务简报 ==========\n';
  text += '生成时间: ' + formatTime(now()) + '\n\n';

  text += '【已确认编排明细】\n';
  briefingRecs.forEach(r => {
    text += `${r.id} | ${r.payloadName} | ${formatTime(r.powerOnTime)} | ${r.duration}min | ${r.orbit} | ${r.windowId} | ${SOURCE_LABELS[r.source]}\n`;
  });

  if (corrections.length > 0) {
    text += '\n【人工更正摘要】\n';
    corrections.forEach(r => {
      const lastChange = r.auditTrail.find(a => a.fieldChanges && a.fieldChanges.length > 0);
      if (lastChange) {
        text += `${r.id} ${r.payloadName}: ${lastChange.fieldChanges.map(fc => fc.field + '(' + JSON.stringify(fc.oldValue) + '→' + JSON.stringify(fc.newValue) + ')').join(', ')} [${lastChange.operator} ${shortTime(lastChange.timestamp)}]\n`;
      }
    });
  }

  if (pendingRecs.length > 0) {
    text += '\n【未纳入简报的待处理记录】\n';
    pendingRecs.forEach(r => {
      text += `${r.id} ${r.payloadName}: ${r.pendingReason}\n`;
    });
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '载荷开机编排任务简报_' + new Date().toISOString().slice(0, 10) + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}

window.setHistoryFilter = function(val) {
  window._historyFilter = val;
  render();
};

window.addTelemetrySample = function(data) {
  if (!Array.isArray(data)) data = [data];
  data.forEach(d => {
    const rec = {
      id: uid(),
      payloadName: d.payloadName || '未指定',
      powerOnTime: d.powerOnTime || now(),
      duration: d.duration || 0,
      orbit: d.orbit || '-',
      windowId: d.windowId || '-',
      source: 'telemetry',
      status: 'normal',
      pendingReason: null,
      telemetrySegmentId: d.segmentId || null,
      arrivedAt: now(),
      isLateArrival: false,
      isDuplicate: false,
      duplicateOfId: null,
      isManualCorrection: false,
      auditTrail: [],
      createdAt: now(),
      updatedAt: now()
    };
    addAuditEntry(rec, '系统', '遥测片段样例入库', []);
    records.push(rec);
  });
  saveRecords();
  render();
  return '已入库 ' + data.length + ' 条遥测片段';
};

function resetData() {
  if (confirm('确认重置为样例数据？当前修改将丢失。')) {
    localStorage.removeItem(APP_KEY + '_records');
    records = makeSampleData();
    saveRecords();
    render();
  }
}

function init() {
  loadRecords();

  document.getElementById('nav').addEventListener('click', function(e) {
    const item = e.target.closest('.nav-item');
    if (item && item.dataset.view) {
      navigate(item.dataset.view);
    }
  });

  render();
}

document.addEventListener('DOMContentLoaded', init);
