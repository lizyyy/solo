// ============================================================
// 深海采样空间标注 - 数据与逻辑
// 模型不精细，保证：空间位置、异常高亮、采样瓶编号来源对应
// ============================================================

// ---------- 模拟采样瓶数据 ----------
const samples = [
  {
    id: 'S-01',
    x: 80, y: 110,
    depth: 15,
    status: 'normal',
    items: { ph: 8.1, do: 7.2, cod: 1.2, tn: 0.35, tp: 0.04 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-001',
    remark: '',
    judge: '可放行',
    judgeLevel: 'ok'
  },
  {
    id: 'S-02',
    x: 180, y: 150,
    depth: 28,
    status: 'abnormal',
    items: { ph: 7.9, do: 4.8, cod: 3.5, tn: 0.82, tp: 0.12 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-002',
    abnormal: ['do', 'cod', 'tn'],
    remark: '近排污口，DO偏低、COD偏高，需核实排污情况。',
    judge: '需补材料：排污口核查记录',
    judgeLevel: 'danger'
  },
  {
    id: 'S-03',
    x: 260, y: 90,
    depth: 12,
    status: 'normal',
    items: { ph: 8.0, do: 6.8, cod: 1.8, tn: 0.42, tp: 0.05 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-003',
    remark: '',
    judge: '可放行',
    judgeLevel: 'ok'
  },
  {
    id: 'S-04',
    x: 310, y: 200,
    depth: 45,
    status: 'normal',
    items: { ph: 7.8, do: 6.5, cod: 1.5, tn: 0.38, tp: 0.03 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-004',
    remark: '',
    judge: '可放行',
    judgeLevel: 'ok'
  },
  {
    id: 'S-05',
    x: 380, y: 140,
    depth: 35,
    status: 'cloud',
    items: { ph: null, do: null, cod: null, tn: null, tp: null },
    source: '卫星遥感反演（云遮挡，数据缺失）',
    sourceId: 'RS-S2-20260614',
    remark: '卫星过境时被云遮挡，无法判断水质。',
    judge: '需补材料：现场采样或下次过境',
    judgeLevel: 'warn'
  },
  {
    id: 'S-06',
    x: 450, y: 220,
    depth: 52,
    status: 'cloud',
    items: { ph: null, do: null, cod: null, tn: null, tp: null },
    source: '卫星遥感反演（云遮挡，数据缺失）',
    sourceId: 'RS-S2-20260614',
    remark: '云遮挡区，需补充现场采样。',
    judge: '需补材料：现场采样或下次过境',
    judgeLevel: 'warn'
  },
  {
    id: 'S-07',
    x: 520, y: 160,
    depth: 38,
    status: 'abnormal',
    items: { ph: 7.6, do: 5.2, cod: 2.8, tn: 0.68, tp: 0.09 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-007',
    abnormal: ['do', 'cod'],
    remark: '近航道区，悬浮物偏高，COD略超。',
    judge: '需关注：航道施工期影响',
    judgeLevel: 'warn'
  },
  {
    id: 'S-08',
    x: 150, y: 280,
    depth: 65,
    status: 'normal',
    items: { ph: 7.9, do: 7.0, cod: 1.1, tn: 0.30, tp: 0.02 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-008',
    remark: '',
    judge: '可放行',
    judgeLevel: 'ok'
  },
  {
    id: 'S-09',
    x: 350, y: 310,
    depth: 78,
    status: 'normal',
    items: { ph: 7.7, do: 6.2, cod: 1.3, tn: 0.33, tp: 0.03 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-009',
    remark: '',
    judge: '可放行',
    judgeLevel: 'ok'
  },
  {
    id: 'S-10',
    x: 500, y: 300,
    depth: 70,
    status: 'abnormal',
    items: { ph: 7.5, do: 4.5, cod: 4.2, tn: 1.05, tp: 0.18 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-010',
    abnormal: ['do', 'cod', 'tn', 'tp'],
    remark: '深水异常区，多项指标超标，疑似底泥释放。',
    judge: '需补材料：底泥采样分析',
    judgeLevel: 'danger'
  },
  {
    id: 'S-11',
    x: 100, y: 360,
    depth: 95,
    status: 'normal',
    items: { ph: 7.8, do: 5.8, cod: 1.0, tn: 0.28, tp: 0.02 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-011',
    remark: '',
    judge: '可放行',
    judgeLevel: 'ok'
  },
  {
    id: 'S-12',
    x: 420, y: 360,
    depth: 88,
    status: 'normal',
    items: { ph: 7.9, do: 6.0, cod: 1.4, tn: 0.36, tp: 0.04 },
    source: '现场采样 + 实验室检测',
    sourceId: 'LAB-20260615-012',
    remark: '',
    judge: '可放行',
    judgeLevel: 'ok'
  }
];

// 标准限值（用于判断超标）
const standards = {
  ph: { min: 7.5, max: 8.5, unit: '', name: 'pH' },
  do: { min: 5.0, max: null, unit: 'mg/L', name: '溶解氧 DO' },
  cod: { min: null, max: 2.0, unit: 'mg/L', name: '化学需氧量 COD' },
  tn: { min: null, max: 0.5, unit: 'mg/L', name: '总氮 TN' },
  tp: { min: null, max: 0.08, unit: 'mg/L', name: '总磷 TP' }
};

// ---------- 状态 ----------
let currentFilter = 'all';
let selectedId = null;
let originalSamples = JSON.parse(JSON.stringify(samples)); // 备份，用于重置

// ---------- 初始化 ----------
function init() {
  renderSummary();
  renderMapPoints();
  renderBottleList();
  bindEvents();
}

// ---------- 汇总卡片 ----------
function renderSummary() {
  const total = samples.length;
  const abnormal = samples.filter(s => s.status === 'abnormal').length;
  const cloud = samples.filter(s => s.status === 'cloud').length;
  const pass = samples.filter(s => s.judgeLevel === 'ok').length;

  document.getElementById('sumTotal').textContent = total;
  document.getElementById('sumAbnormal').textContent = abnormal;
  document.getElementById('sumCloud').textContent = cloud;
  document.getElementById('sumPass').textContent = pass;
}

// ---------- 地图采样点 ----------
function renderMapPoints() {
  const g = document.getElementById('samplePoints');
  g.innerHTML = '';

  const filtered = filterSamples();

  filtered.forEach(s => {
    const color = getStatusColor(s.status);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    circle.setAttribute('class', 'sample-point' + (selectedId === s.id ? ' selected' : ''));
    circle.setAttribute('data-id', s.id);

    // 外环光晕（异常点加脉动效果）
    if (s.status === 'abnormal') {
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('cx', s.x);
      halo.setAttribute('cy', s.y);
      halo.setAttribute('r', '12');
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', color);
      halo.setAttribute('stroke-width', '2');
      halo.setAttribute('opacity', '0.5');
      circle.appendChild(halo);
    }

    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', s.x);
    c.setAttribute('cy', s.y);
    c.setAttribute('r', '8');
    c.setAttribute('fill', color);
    circle.appendChild(c);

    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', s.x);
    t.setAttribute('y', s.y + 1);
    t.textContent = s.id.split('-')[1];
    circle.appendChild(t);

    circle.addEventListener('click', () => selectSample(s.id));
    g.appendChild(circle);
  });
}

function getStatusColor(status) {
  switch (status) {
    case 'normal': return '#10b981';
    case 'abnormal': return '#dc2626';
    case 'cloud': return '#94a3b8';
    default: return '#10b981';
  }
}

// ---------- 采样瓶列表 ----------
function renderBottleList() {
  const list = document.getElementById('bottleList');
  const filtered = filterSamples();

  list.innerHTML = filtered.map(s => `
    <div class="bottle-item ${selectedId === s.id ? 'selected' : ''}" data-id="${s.id}">
      <div>
        <div class="bottle-id">${s.id}</div>
        <div class="bottle-meta">水深 ${s.depth}m · ${s.source.split('+')[0].trim()}</div>
      </div>
      <span class="bottle-status status-${s.status}">${statusText(s.status)}</span>
    </div>
  `).join('');

  list.querySelectorAll('.bottle-item').forEach(el => {
    el.addEventListener('click', () => selectSample(el.dataset.id));
  });
}

function statusText(status) {
  switch (status) {
    case 'normal': return '正常';
    case 'abnormal': return '异常';
    case 'cloud': return '云遮挡';
    default: return status;
  }
}

// ---------- 筛选 ----------
function filterSamples() {
  if (currentFilter === 'all') return samples;
  if (currentFilter === 'abnormal') return samples.filter(s => s.status === 'abnormal');
  if (currentFilter === 'cloud') return samples.filter(s => s.status === 'cloud');
  if (currentFilter === 'pass') return samples.filter(s => s.judgeLevel === 'ok');
  return samples;
}

// ---------- 选中详情 ----------
function selectSample(id) {
  selectedId = id;
  renderMapPoints();
  renderBottleList();
  renderDetail(id);
}

function renderDetail(id) {
  const s = samples.find(x => x.id === id);
  if (!s) return;

  const panel = document.getElementById('detailPanel');

  // 指标行
  const itemRows = Object.keys(s.items).map(key => {
    const val = s.items[key];
    const std = standards[key];
    const isAbn = s.abnormal && s.abnormal.includes(key);
    const valClass = s.status === 'cloud' ? 'cloud' : (isAbn ? 'abnormal' : '');
    const valText = val === null ? '— 数据缺失' : val + (std.unit ? ' ' + std.unit : '');
    const stdText = std.max ? `≤ ${std.max}${std.unit}` : (std.min ? `≥ ${std.min}${std.unit}` : '—');
    return `
      <div class="data-row">
        <span class="label">${std.name}</span>
        <span class="value ${valClass}">${valText} <span style="color:#9ca3af;font-weight:normal;font-size:11px">(标准 ${stdText})</span></span>
      </div>
    `;
  }).join('');

  // 判断等级
  const judgeClass = s.judgeLevel === 'ok' ? 'judge-ok' : (s.judgeLevel === 'warn' ? 'judge-warn' : 'judge-danger');

  // 变更记录
  const changeLog = s.changed ? `
    <div class="detail-section">
      <h4>📋 变更记录（评审会前补充）</h4>
      <div class="change-log">
        <div class="chg-title">${s.changeTitle || '新增备注变更'}</div>
        <div>原判断：${s.oldJudge || '—'}</div>
        <div>现判断：${s.judge}</div>
        <div>变更原因：${s.changeReason || '补充了现场复测数据'}</div>
      </div>
    </div>
  ` : '';

  // 模拟 API 返回
  const apiData = {
    code: 0,
    message: 'ok',
    data: {
      sampleId: s.id,
      depth: s.depth,
      status: s.status,
      items: s.items,
      source: s.source,
      sourceId: s.sourceId,
      remark: s.remark,
      judge: s.judge,
      timestamp: '2026-06-15T10:30:00+08:00'
    }
  };

  panel.innerHTML = `
    <div class="detail-title">
      <span>采样瓶 ${s.id}</span>
      <span class="bottle-status status-${s.status}" style="font-size:11px">${statusText(s.status)}</span>
    </div>
    <div class="detail-sub">水深 ${s.depth}m · 坐标 ${s.x}, ${s.y}</div>

    <div class="detail-section">
      <h4>📊 检测指标</h4>
      ${itemRows}
    </div>

    <div class="detail-section">
      <h4>🔗 数据来源</h4>
      <div class="data-source">${s.source} / 编号：${s.sourceId}</div>
    </div>

    ${s.remark ? `
    <div class="detail-section">
      <h4>📝 备注</h4>
      <div style="font-size:12px;color:#475569">${s.remark}</div>
    </div>
    ` : ''}

    ${changeLog}

    <div class="detail-section">
      <h4>✅ 判断建议（给老何）</h4>
      <div class="judge-box ${judgeClass}">
        <strong>${s.judge}</strong>
        ${s.judgeLevel === 'ok' ? '指标正常，可直接放行。' : ''}
        ${s.judgeLevel === 'warn' ? '资料不全或存疑，需补充材料后再审。' : ''}
        ${s.judgeLevel === 'danger' ? '存在超标项，必须补充核查材料。' : ''}
      </div>
    </div>

    <div class="detail-section">
      <h4>🔌 接口返回</h4>
      <div class="api-response">
        <div class="api-url">GET /api/v1/sample/${s.id}</div>
        <div class="json">${JSON.stringify(apiData, null, 2)}</div>
      </div>
    </div>
  `;
}

// ---------- 事件绑定 ----------
function bindEvents() {
  // 筛选按钮
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderMapPoints();
      renderBottleList();
    });
  });

  // 补一条备注演示
  document.getElementById('addRemarkBtn').addEventListener('click', addDemoRemark);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
}

// ---------- 演示：补一条备注 ----------
function addDemoRemark() {
  const s = samples.find(x => x.id === 'S-07');
  if (!s) return;

  // 保存旧值
  s.oldJudge = s.judge;
  s.oldJudgeLevel = s.judgeLevel;
  s.changed = true;
  s.changeTitle = 'S-07 新增备注：现场复测合格';
  s.changeReason = '评审会前补充现场复测数据，DO、COD 已回落至正常范围';

  // 改判断
  s.judge = '可放行（补充复测后）';
  s.judgeLevel = 'ok';
  s.remark += ' 【评审会补充】6/17 现场复测：DO 6.2mg/L、COD 1.8mg/L，均达标。';

  // 更新状态
  s.status = 'normal';
  s.abnormal = [];

  renderSummary();
  renderMapPoints();
  renderBottleList();
  if (selectedId === 'S-07') renderDetail('S-07');

  // 提示
  alert('已补充 S-07 备注：现场复测合格\n\n变更效果：\n• 原判断：需关注 → 现判断：可放行\n• 汇总卡：异常 -1，可放行 +1\n• 详情页"变更记录"显示变更原因\n\n负责人扫汇总时能看到数字变化，点进去能找到原因。');
}

// ---------- 重置 ----------
function resetAll() {
  // 深拷贝恢复
  for (let i = 0; i < samples.length; i++) {
    Object.assign(samples[i], JSON.parse(JSON.stringify(originalSamples[i])));
  }
  selectedId = null;
  currentFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');

  document.getElementById('detailPanel').innerHTML = '<div class="detail-empty">点击左侧采样点或右侧列表查看详情</div>';

  renderSummary();
  renderMapPoints();
  renderBottleList();
}

// ---------- 启动 ----------
document.addEventListener('DOMContentLoaded', init);
