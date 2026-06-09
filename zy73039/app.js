/* ========================================================================
   流浪动物救助回访追踪 - 本地数据层 + 核心 API + 交互
   数据存储：localStorage['stray_tracker_v1']
   核心 API：importRecord / confirmRecord / revokeRecord / getSummary
   ======================================================================== */

const STORE_KEY = 'stray_tracker_v1';
const STATUS = {
  PENDING: 'pending',
  CLEARED: 'cleared',
  REVOKED: 'revoked',
  HANG: 'hang',
};
const STATUS_LABEL = {
  pending: '待补证据',
  cleared: '已放行',
  revoked: '已撤回',
  hang:    '挂起中',
};

/* ---------- 存储 ---------- */
const Store = {
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : { records: [] };
    } catch (e) {
      return { records: [] };
    }
  },
  save(state) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(STORE_KEY);
  },
};

let state = Store.load();
if (!state.records) state.records = [];

function persist() { Store.save(state); }

/* ---------- 工具 ---------- */
const uid = () => 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowISO = () => new Date().toISOString();
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function parseWeight(raw) {
  if (!raw) return { value: null, unit: null, raw: '' };
  const str = String(raw).trim().toLowerCase();
  const m = str.match(/^([\d.]+)\s*(kg|kilogram|kilograms|公斤|千克|g|gram|grams|克|lb|lbs|pound|pounds|磅)?$/);
  if (!m) return { value: null, unit: null, raw: str };
  const v = parseFloat(m[1]);
  let u = m[2] || '';
  if (['kg', 'kilogram', 'kilograms', '公斤', '千克'].includes(u)) u = 'kg';
  else if (['g', 'gram', 'grams', '克'].includes(u)) u = 'g';
  else if (['lb', 'lbs', 'pound', 'pounds', '磅'].includes(u)) u = 'lb';
  return { value: isNaN(v) ? null : v, unit: u || null, raw: str };
}

function detectWeightMix(raw) {
  if (!raw) return false;
  const str = String(raw).toLowerCase();
  const has = {
    kg: /(kg|kilogram|公斤|千克)/.test(str),
    g:  /(^|[\d\s.,])(g|克)(?![a-z])/.test(str),
    lb: /(lb|pound|磅)/.test(str),
  };
  return [has.kg, has.g, has.lb].filter(Boolean).length >= 2;
}

function pickKeyFields(d) {
  return {
    weight: d.weight || '',
    weightUnit: d.weightUnit || null,
    medReminder: d.medReminder || '',
    wechatNote: d.wechatNote || '',
    attachment: d.attachment || '',
    verbalNote: d.verbalNote || '',
  };
}

function diffFields(a, b) {
  const ka = pickKeyFields(a);
  const kb = pickKeyFields(b);
  const diffs = [];
  for (const k of Object.keys(ka)) {
    const va = ka[k];
    const vb = kb[k];
    if (String(va).trim() !== String(vb).trim()) {
      diffs.push({ field: k, before: va, after: vb });
    }
  }
  return diffs;
}

/* ========================================================================
   核心 API（保持克制）
   ======================================================================== */

/**
 * 导入一条记录（或向同一主人追加新版本材料）
 * @param {Object} payload 表单原始数据
 * @returns {Object} { record, warnings, created: boolean }
 */
function importRecord(payload) {
  const ownerWechat = (payload.ownerWechat || '').trim();
  if (!ownerWechat) throw new Error('主人微信备注不能为空');

  const wp = parseWeight(payload.weight);
  const weightMix = detectWeightMix(payload.weight);

  const version = {
    vid: 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    createdAt: nowISO(),
    weight: payload.weight || '',
    weightParsed: wp,
    weightUnit: wp.unit,
    weightValue: wp.value,
    animalName: payload.animalName || '',
    visitDate: payload.visitDate || '',
    medReminder: payload.medReminder || '',
    wechatNote: payload.wechatNote || '',
    attachment: payload.attachment || '',
    verbalNote: payload.verbalNote || '',
    source: payload._source || 'import',
    anomalies: [],
  };

  const existing = state.records.find(
    (r) => r.ownerWechat === ownerWechat && r.status !== STATUS.REVOKED
  );

  let record;
  let created = false;
  const warnings = [];

  if (existing) {
    record = existing;
    const lastVer = record.versions[record.versions.length - 1];
    const diffs = diffFields(lastVer, version);

    if (diffs.length > 0) {
      version.anomalies.push({
        type: 'version_conflict',
        message: `与上一版相比有 ${diffs.length} 处口径变更`,
        diffs,
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'version_conflict',
        vid: version.vid,
        message: `版本 ${version.vid} 口径变更 ${diffs.length} 处`,
        diffs,
        at: version.createdAt,
      });
      warnings.push(`检测到与上一版的口径变更 ${diffs.length} 处`);
    }

    if (weightMix) {
      version.anomalies.push({
        type: 'weight_mix',
        message: '体重字段单位混写（kg/g/lb 同时出现），已挂起请确认',
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'weight_mix',
        vid: version.vid,
        message: '体重单位混写，挂起中',
        at: version.createdAt,
      });
      warnings.push('体重单位混写，已自动挂起，请接手同事确认');
    }

    const units = record.versions
      .map((v) => v.weightUnit)
      .filter(Boolean)
      .concat(version.weightUnit ? [version.weightUnit] : []);
    const uniqueUnits = [...new Set(units)];
    if (uniqueUnits.length >= 2) {
      version.anomalies.push({
        type: 'weight_mix',
        message: `历史版本体重单位不一致（${uniqueUnits.join(' / ')}），已挂起`,
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'weight_mix',
        vid: version.vid,
        message: `跨版本体重单位不一致（${uniqueUnits.join(' / ')}）`,
        at: version.createdAt,
      });
      warnings.push('与历史版本体重单位不一致，已自动挂起');
    }

    record.versions.push(version);
    record.updatedAt = version.createdAt;
    record.latest = summarizeLatest(record);

    const hasWeightIssue = record.anomalies.some((a) => a.type === 'weight_mix');
    if (hasWeightIssue) {
      record.status = STATUS.HANG;
    }
  } else {
    created = true;
    record = {
      id: uid(),
      ownerWechat,
      status: STATUS.PENDING,
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
      anomalies: [],
      versions: [version],
      flags: { humanEdited: false },
    };

    if (weightMix) {
      version.anomalies.push({
        type: 'weight_mix',
        message: '体重字段单位混写，已挂起请确认',
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'weight_mix',
        vid: version.vid,
        message: '体重单位混写，挂起中',
        at: version.createdAt,
      });
      record.status = STATUS.HANG;
      warnings.push('体重单位混写，已自动挂起');
    }
    record.latest = summarizeLatest(record);
    state.records.unshift(record);
  }

  persist();
  return { record, warnings, created };
}

function summarizeLatest(record) {
  const v = record.versions[record.versions.length - 1];
  return {
    animalName: v.animalName,
    visitDate: v.visitDate,
    weight: v.weight,
    weightUnit: v.weightUnit,
    weightValue: v.weightValue,
    medReminder: v.medReminder,
    wechatNote: v.wechatNote,
    attachment: v.attachment,
    verbalNote: v.verbalNote,
    vid: v.vid,
  };
}

/**
 * 确认（放行）记录：pending → cleared；hang → cleared（同时视为已人工处理体重问题）
 */
function confirmRecord(id, options = {}) {
  const record = state.records.find((r) => r.id === id);
  if (!record) throw new Error('记录不存在');
  if (record.status === STATUS.REVOKED) throw new Error('已撤回的记录不能再确认');

  if (record.status === STATUS.HANG) {
    record.anomalies.push({
      type: 'human_edit',
      message: options.note
        ? `人工确认放行（挂起）：${options.note}`
        : '人工确认放行（从挂起状态确认）',
      at: nowISO(),
    });
    record.flags.humanEdited = true;
  }

  record.status = STATUS.CLEARED;
  record.updatedAt = nowISO();
  persist();
  return record;
}

/**
 * 撤回记录：cleared / pending / hang → revoked（保留历史版本留痕）
 */
function revokeRecord(id, options = {}) {
  const record = state.records.find((r) => r.id === id);
  if (!record) throw new Error('记录不存在');
  record.status = STATUS.REVOKED;
  record.updatedAt = nowISO();
  record.anomalies.push({
    type: 'human_edit',
    message: options.reason
      ? `撤回：${options.reason}`
      : '撤回（未填原因）',
    at: nowISO(),
  });
  record.flags.humanEdited = true;
  persist();
  return record;
}

/**
 * 人工编辑某个最新版本的关键字段（保留痕迹，标记为人工改过）
 */
function humanPatchRecord(id, patch, options = {}) {
  const record = state.records.find((r) => r.id === id);
  if (!record) throw new Error('记录不存在');
  if (record.status === STATUS.REVOKED) throw new Error('已撤回的记录不可编辑');

  const lastVer = record.versions[record.versions.length - 1];
  const newVer = {
    ...lastVer,
    vid: 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    createdAt: nowISO(),
    source: 'human_edit',
    anomalies: [],
  };
  Object.assign(newVer, patch);

  const wp = parseWeight(patch.weight != null ? patch.weight : newVer.weight);
  newVer.weightParsed = wp;
  newVer.weightUnit = wp.unit;
  newVer.weightValue = wp.value;

  const diffs = diffFields(lastVer, newVer);
  if (diffs.length === 0) return record;

  newVer.anomalies.push({
    type: 'human_edit',
    message: `人工修改 ${diffs.length} 处字段` + (options.reason ? `：${options.reason}` : ''),
    diffs,
    at: newVer.createdAt,
  });
  record.anomalies.push({
    type: 'human_edit',
    vid: newVer.vid,
    message: `人工修改 ${diffs.length} 处`,
    diffs,
    at: newVer.createdAt,
  });

  record.versions.push(newVer);
  record.flags.humanEdited = true;
  record.latest = summarizeLatest(record);
  record.updatedAt = newVer.createdAt;

  const stillWeightIssue = record.versions.some((v) =>
    v.anomalies.some((a) => a.type === 'weight_mix')
  );
  if (stillWeightIssue && record.status !== STATUS.CLEARED && record.status !== STATUS.REVOKED) {
    record.status = STATUS.HANG;
  } else if (record.status === STATUS.HANG && !stillWeightIssue) {
    record.status = STATUS.PENDING;
  }

  persist();
  return record;
}

/**
 * 页面摘要
 */
function getSummary() {
  const out = {
    total: state.records.length,
    cleared: 0,
    pending: 0,
    human: 0,
    hang: 0,
    revoked: 0,
    weightIssues: 0,
    versionConflicts: 0,
  };
  for (const r of state.records) {
    if (r.status === STATUS.CLEARED) out.cleared++;
    else if (r.status === STATUS.PENDING) out.pending++;
    else if (r.status === STATUS.HANG) out.hang++;
    else if (r.status === STATUS.REVOKED) out.revoked++;
    if (r.flags && r.flags.humanEdited) out.human++;
    for (const a of r.anomalies) {
      if (a.type === 'weight_mix') out.weightIssues++;
      if (a.type === 'version_conflict') out.versionConflicts++;
    }
  }
  return out;
}

function listRecords(filter = 'all') {
  let rs = [...state.records];
  if (filter === 'human') {
    rs = rs.filter((r) => r.flags && r.flags.humanEdited);
  } else if (filter !== 'all') {
    rs = rs.filter((r) => r.status === filter);
  }
  return rs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function listAnomalies() {
  const items = [];
  for (const r of state.records) {
    for (const a of r.anomalies) {
      items.push({
        recordId: r.id,
        ownerWechat: r.ownerWechat,
        animalName: r.latest && r.latest.animalName,
        status: r.status,
        vid: a.vid,
        type: a.type,
        message: a.message,
        diffs: a.diffs || null,
        at: a.at,
      });
    }
  }
  return items.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

/* ========================================================================
   UI 渲染
   ======================================================================== */

const FIELD_LABEL = {
  weight: '回访体重',
  weightUnit: '体重单位',
  medReminder: '用药提醒',
  wechatNote: '主人微信备注原文',
  attachment: '晚到附件',
  verbalNote: '临时口头说明',
};

const ANOMALY_LABEL = {
  weight_mix: { label: '体重单位冲突', cls: 'tag-hang' },
  version_conflict: { label: '口径变更', cls: 'tag-warn' },
  human_edit: { label: '人工处理', cls: 'tag-human' },
};

function renderSummary() {
  const s = getSummary();
  document.getElementById('sum-cleared').textContent = s.cleared;
  document.getElementById('sum-pending').textContent = s.pending;
  document.getElementById('sum-human').textContent   = s.human;
  document.getElementById('sum-hang').textContent    = s.hang;
  document.getElementById('sum-revoked').textContent = s.revoked;
  document.getElementById('sum-total').textContent   = s.total;
}

function statusCls(status) {
  return {
    pending: 'st-pending',
    cleared: 'st-cleared',
    hang:    'st-hang',
    revoked: 'st-revoked',
  }[status] || '';
}

function anomalyBadges(record) {
  if (!record.anomalies || record.anomalies.length === 0) return '';
  const counts = {};
  record.anomalies.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
  return Object.entries(counts).map(([t, c]) => {
    const info = ANOMALY_LABEL[t] || { label: t, cls: 'tag-warn' };
    return `<span class="tag ${info.cls}">${info.label} ${c}</span>`;
  }).join('');
}

function humanFlag(record) {
  return (record.flags && record.flags.humanEdited)
    ? `<span class="tag tag-human">人工改过</span>` : '';
}

function renderList(filter = 'all') {
  const list = listRecords(filter);
  const host = document.getElementById('record-list');
  if (list.length === 0) {
    host.innerHTML = `<div class="empty-tip">当前筛选条件下暂无记录。</div>`;
    return;
  }
  host.innerHTML = list.map((r) => {
    const L = r.latest || {};
    return `
    <article class="record-card ${statusCls(r.status)}">
      <header class="rc-head">
        <div class="rc-title">
          <strong>${escapeHtml(r.ownerWechat)}</strong>
          ${L.animalName ? `<span class="rc-sub">${escapeHtml(L.animalName)}</span>` : ''}
        </div>
        <div class="rc-tags">
          <span class="status-pill sp-${r.status}">${STATUS_LABEL[r.status]}</span>
          ${humanFlag(r)}
          ${anomalyBadges(r)}
        </div>
      </header>
      <div class="rc-body">
        <div class="rc-grid">
          <div class="rc-cell"><span class="rc-k">回访体重</span><span class="rc-v">${escapeHtml(L.weight || '—')}</span></div>
          <div class="rc-cell"><span class="rc-k">回访日期</span><span class="rc-v">${escapeHtml(L.visitDate || '—')}</span></div>
          <div class="rc-cell rc-span"><span class="rc-k">用药提醒</span><span class="rc-v pre">${escapeHtml(L.medReminder || '—')}</span></div>
          <div class="rc-cell"><span class="rc-k">微信备注</span><span class="rc-v pre">${escapeHtml(L.wechatNote || '—')}</span></div>
          <div class="rc-cell"><span class="rc-k">晚到附件</span><span class="rc-v pre">${escapeHtml(L.attachment || '—')}</span></div>
          <div class="rc-cell rc-span"><span class="rc-k">口头说明</span><span class="rc-v pre">${escapeHtml(L.verbalNote || '—')}</span></div>
        </div>
      </div>
      <footer class="rc-foot">
        <div class="rc-meta">
          版本 ${r.versions.length} · 创建 ${fmtDate(r.createdAt)} · 更新 ${fmtDate(r.updatedAt)}
        </div>
        <div class="rc-actions">
          <button class="btn btn-sm" data-act="detail" data-id="${r.id}">详情/变更溯源</button>
          ${r.status !== STATUS.REVOKED ? `
            <button class="btn btn-sm btn-primary" data-act="confirm" data-id="${r.id}">确认放行</button>
            <button class="btn btn-sm btn-danger"  data-act="revoke"  data-id="${r.id}">撤回</button>
            <button class="btn btn-sm" data-act="patch" data-id="${r.id}">人工补改</button>
          ` : ''}
        </div>
      </footer>
    </article>`;
  }).join('');

  host.querySelectorAll('button[data-act]').forEach((b) => {
    b.addEventListener('click', () => handleCardAction(b.dataset.act, b.dataset.id));
  });
}

function renderAnomalies() {
  const items = listAnomalies();
  const host = document.getElementById('anomaly-list');
  if (items.length === 0) {
    host.innerHTML = `<div class="empty-tip">暂无异常。所有材料口径与体重单位都一致。</div>`;
    return;
  }
  host.innerHTML = items.map((it) => {
    const info = ANOMALY_LABEL[it.type] || { label: it.type, cls: 'tag-warn' };
    const diffHtml = it.diffs && it.diffs.length > 0 ? `
      <div class="diff-box">
        ${it.diffs.map((d) => `
          <div class="diff-row">
            <div class="diff-field">${FIELD_LABEL[d.field] || d.field}</div>
            <div class="diff-before" title="前值">${escapeHtml(String(d.before || '(空)'))}</div>
            <div class="diff-arrow">→</div>
            <div class="diff-after"  title="后值">${escapeHtml(String(d.after  || '(空)'))}</div>
          </div>
        `).join('')}
      </div>` : '';
    return `
    <article class="anomaly-card">
      <header class="ac-head">
        <span class="tag ${info.cls}">${info.label}</span>
        <strong class="ac-owner">${escapeHtml(it.ownerWechat)}</strong>
        ${it.animalName ? `<span class="ac-sub">${escapeHtml(it.animalName)}</span>` : ''}
        <span class="status-pill sp-${it.status} small">${STATUS_LABEL[it.status]}</span>
        <span class="ac-time">${fmtDate(it.at)}</span>
      </header>
      <div class="ac-msg">${escapeHtml(it.message)}</div>
      ${diffHtml}
      <footer class="ac-foot">
        <button class="btn btn-sm" data-act="detail" data-id="${it.recordId}">跳到记录详情</button>
      </footer>
    </article>`;
  }).join('');

  host.querySelectorAll('button[data-act]').forEach((b) => {
    b.addEventListener('click', () => handleCardAction(b.dataset.act, b.dataset.id));
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- 交互 ---------- */

let currentFilter = 'all';

function refresh() {
  renderSummary();
  renderList(currentFilter);
  renderAnomalies();
}

function handleCardAction(act, id) {
  if (act === 'detail') return openDetail(id);
  if (act === 'patch')  return openPatch(id);
  if (act === 'confirm') {
    const record = state.records.find((r) => r.id === id);
    let note = '';
    if (record && record.status === STATUS.HANG) {
      note = prompt('从挂起状态确认，请输入确认说明（会留痕）：', '体重单位已人工核对');
      if (note === null) return;
    }
    try {
      confirmRecord(id, { note });
      flash('已确认放行');
      refresh();
    } catch (e) { alert(e.message); }
    return;
  }
  if (act === 'revoke') {
    const reason = prompt('撤回原因（会留痕）：', '材料不实/重复导入/其他');
    if (reason === null) return;
    try {
      revokeRecord(id, { reason });
      flash('已撤回，保留历史留痕');
      refresh();
    } catch (e) { alert(e.message); }
  }
}

function openDetail(id) {
  const r = state.records.find((x) => x.id === id);
  if (!r) return;
  const L = r.latest;
  const historyHtml = r.versions.slice().reverse().map((v, idx, arr) => {
    const realIndex = arr.length - 1 - idx;
    const prev = realIndex > 0 ? r.versions[realIndex - 1] : null;
    const diffs = prev ? diffFields(prev, v) : [];
    const diffHtml = diffs.length > 0 ? `
      <div class="diff-box small">
        ${diffs.map((d) => `
          <div class="diff-row">
            <div class="diff-field">${FIELD_LABEL[d.field] || d.field}</div>
            <div class="diff-before">${escapeHtml(String(d.before || '(空)'))}</div>
            <div class="diff-arrow">→</div>
            <div class="diff-after">${escapeHtml(String(d.after || '(空)'))}</div>
          </div>
        `).join('')}
      </div>` : '<div class="diff-none">与上一版相比无关键字段变动</div>';
    const verAnoms = (v.anomalies || []).map((a) => {
      const info = ANOMALY_LABEL[a.type] || { label: a.type, cls: 'tag-warn' };
      return `<span class="tag ${info.cls}">${info.label}</span> ${escapeHtml(a.message)}`;
    }).join(' · ') || '<span class="muted">无异常</span>';
    return `
      <div class="ver-block">
        <div class="ver-head">
          <strong>版本 ${realIndex + 1} · ${v.vid}</strong>
          <span class="muted">${v.source === 'human_edit' ? '（人工修改产生）' : '（导入产生）'}</span>
          <span class="ver-time">${fmtDate(v.createdAt)}</span>
        </div>
        <div class="ver-anoms">${verAnoms}</div>
        <div class="ver-grid">
          <div><span class="rc-k">体重</span> <span class="rc-v">${escapeHtml(v.weight || '—')}</span></div>
          <div><span class="rc-k">回访日期</span> <span class="rc-v">${escapeHtml(v.visitDate || '—')}</span></div>
          <div class="rc-span"><span class="rc-k">用药提醒</span> <div class="pre">${escapeHtml(v.medReminder || '—')}</div></div>
          <div><span class="rc-k">微信备注</span> <div class="pre">${escapeHtml(v.wechatNote || '—')}</div></div>
          <div><span class="rc-k">晚到附件</span> <div class="pre">${escapeHtml(v.attachment || '—')}</div></div>
          <div class="rc-span"><span class="rc-k">口头说明</span> <div class="pre">${escapeHtml(v.verbalNote || '—')}</div></div>
        </div>
        <div class="ver-diff-title">与上一版差异（数字变动溯源）</div>
        ${diffHtml}
      </div>`;
  }).join('');

  const anomHtml = r.anomalies.length > 0 ? `
    <h4>异常时间线</h4>
    <ul class="anom-timeline">
      ${r.anomalies.map((a) => {
        const info = ANOMALY_LABEL[a.type] || { label: a.type, cls: 'tag-warn' };
        return `<li><span class="tag ${info.cls}">${info.label}</span>
          <span class="muted">${fmtDate(a.at)}</span>
          <div>${escapeHtml(a.message)}</div>
        </li>`;
      }).join('')}
    </ul>` : '';

  const body = `
    <div class="detail-head">
      <div>
        <h3 style="margin:0">${escapeHtml(r.ownerWechat)} ${L.animalName ? '· ' + escapeHtml(L.animalName) : ''}</h3>
        <div class="muted small">创建 ${fmtDate(r.createdAt)} · 更新 ${fmtDate(r.updatedAt)}</div>
      </div>
      <div>
        <span class="status-pill sp-${r.status}">${STATUS_LABEL[r.status]}</span>
        ${humanFlag(r)}
      </div>
    </div>
    ${anomHtml}
    <h4>版本历史（从新到旧）</h4>
    ${historyHtml}
  `;
  openModal(`记录详情 · ${escapeHtml(r.ownerWechat)}`, body);
}

function openPatch(id) {
  const r = state.records.find((x) => x.id === id);
  if (!r) return;
  const L = r.latest;
  const body = `
    <p class="muted small">人工补改会生成新版本并标记「人工改过」。可用于：体重单位确认、补充说明、修正录入错误等。</p>
    <form id="form-patch" class="patch-form">
      <div class="form-row">
        <div class="form-col">
          <label>回访体重</label>
          <input type="text" name="weight" value="${escapeHtml(L.weight || '')}" placeholder="确认后的体重，如 5.2kg" />
        </div>
        <div class="form-col">
          <label>回访日期</label>
          <input type="date" name="visitDate" value="${escapeHtml(L.visitDate || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col form-col-full">
          <label>用药提醒</label>
          <textarea name="medReminder" rows="2">${escapeHtml(L.medReminder || '')}</textarea>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>主人微信备注（原文）</label>
          <textarea name="wechatNote" rows="3">${escapeHtml(L.wechatNote || '')}</textarea>
        </div>
        <div class="form-col">
          <label>晚到附件</label>
          <textarea name="attachment" rows="3">${escapeHtml(L.attachment || '')}</textarea>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col form-col-full">
          <label>临时口头说明</label>
          <textarea name="verbalNote" rows="2">${escapeHtml(L.verbalNote || '')}</textarea>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col form-col-full">
          <label>修改原因 <em>*</em></label>
          <input type="text" name="reason" required placeholder="例：主人确认体重为 5.2kg，原录入为克"/>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">保存（生成新版本）</button>
        <button type="button" class="btn btn-ghost" data-close>取消</button>
      </div>
    </form>
  `;
  openModal(`人工补改 · ${escapeHtml(r.ownerWechat)}`, body);
  const form = document.getElementById('form-patch');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const reason = fd.get('reason') || '';
    const patch = {
      weight: fd.get('weight'),
      visitDate: fd.get('visitDate'),
      medReminder: fd.get('medReminder'),
      wechatNote: fd.get('wechatNote'),
      attachment: fd.get('attachment'),
      verbalNote: fd.get('verbalNote'),
      animalName: L.animalName,
    };
    try {
      humanPatchRecord(id, patch, { reason });
      closeModal();
      flash('已保存，生成新版本并标记人工改过');
      refresh();
    } catch (err) { alert(err.message); }
  });
}

/* ---------- Modal ---------- */
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody  = document.getElementById('modal-body');

function openModal(title, bodyHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }
modal.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

/* ---------- Flash ---------- */
function flash(msg) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 1800);
}

/* ---------- 初始化 ---------- */

document.addEventListener('DOMContentLoaded', () => {
  refresh();

  document.getElementById('btn-import-entry').addEventListener('click', () => {
    document.getElementById('import-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('确定清空全部本地数据？此操作不可恢复。')) {
      Store.clear();
      state = { records: [] };
      refresh();
      flash('已清空本地数据');
    }
  });

  document.querySelectorAll('.filter-bar .chip').forEach((ch) => {
    ch.addEventListener('click', () => {
      document.querySelectorAll('.filter-bar .chip').forEach((x) => x.classList.remove('active'));
      ch.classList.add('active');
      currentFilter = ch.dataset.filter;
      renderList(currentFilter);
    });
  });

  const form = document.getElementById('form-import');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {};
    fd.forEach((v, k) => { payload[k] = v; });
    try {
      const res = importRecord(payload);
      let msg = res.created ? '已导入新记录' : '已追加到现有主人记录';
      if (res.warnings.length) msg += `（${res.warnings.join('；')}）`;
      flash(msg);
      form.reset();
      refresh();
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  });
});

/* 暴露到 window，便于调试 / 被其他脚本调用（API 面保持克制） */
window.StrayTracker = {
  importRecord,
  confirmRecord,
  revokeRecord,
  getSummary,
  humanPatchRecord,
  listRecords,
  listAnomalies,
  _clearAll: () => { Store.clear(); state = { records: [] }; refresh(); },
  _state: () => state,
};
