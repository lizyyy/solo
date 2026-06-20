/* ========================================================================
   流浪动物救助回访追踪 - 前端
   数据来源：Node.js + SQLite 后端 (/api/...)
   核心 API：importRecord / confirmRecord / revokeRecord / getSummary
   ======================================================================== */

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

const FIELD_LABEL = {
  weight: '回访体重',
  weightUnit: '体重单位',
  medReminder: '用药提醒',
  wechatNote: '主人微信备注原文',
  attachment: '晚到附件',
  verbalNote: '临时口头说明',
};

const ANOMALY_LABEL = {
  weight_mix:       { label: '体重单位冲突', cls: 'tag-hang' },
  version_conflict: { label: '口径变更',     cls: 'tag-warn' },
  human_edit:       { label: '人工处理',     cls: 'tag-human' },
};

let currentFilter = 'all';

/* ---------- API 封装 ---------- */

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data;
}

async function importRecord(payload) {
  return api('/records', { method: 'POST', body: JSON.stringify(payload) });
}
async function confirmRecord(id, options = {}) {
  return api(`/records/${encodeURIComponent(id)}/confirm`, {
    method: 'POST', body: JSON.stringify(options || {}),
  });
}
async function revokeRecord(id, options = {}) {
  return api(`/records/${encodeURIComponent(id)}/revoke`, {
    method: 'POST', body: JSON.stringify(options || {}),
  });
}
async function humanPatchRecord(id, patch, options = {}) {
  return api(`/records/${encodeURIComponent(id)}/patch`, {
    method: 'POST', body: JSON.stringify({ ...patch, reason: options.reason }),
  });
}
async function getSummary() {
  return api('/summary');
}
async function listRecords(filter = 'all') {
  return api(`/records?filter=${encodeURIComponent(filter)}`);
}
async function listAnomalies() {
  return api('/anomalies');
}
async function getRecordDetail(id) {
  return api(`/records/${encodeURIComponent(id)}`);
}

/* ---------- 工具 ---------- */
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function diffFields(a, b) {
  const keys = ['weight', 'medReminder', 'wechatNote', 'attachment', 'verbalNote'];
  const diffs = [];
  for (const k of keys) {
    const va = (a && a[k] != null ? a[k] : '') || '';
    const vb = (b && b[k] != null ? b[k] : '') || '';
    if (String(va).trim() !== String(vb).trim()) {
      diffs.push({ field: k, label: FIELD_LABEL[k] || k, before: va, after: vb });
    }
  }
  return diffs;
}

/* ---------- 渲染 ---------- */

function renderSummary(s) {
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
  return (record.flags && record.flags.humanEdited) || record.humanEdited
    ? `<span class="tag tag-human">人工改过</span>` : '';
}

function renderList(list) {
  const host = document.getElementById('record-list');
  if (list.length === 0) {
    host.innerHTML = `<div class="empty-tip">当前筛选条件下暂无记录。</div>`;
    return;
  }
  host.innerHTML = list.map((r) => {
    const L = r.latest || {};
    const verCount = r.versionCount != null ? r.versionCount : (r.versions ? r.versions.length : 1);
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
          版本 ${verCount} · 创建 ${fmtDate(r.createdAt)} · 更新 ${fmtDate(r.updatedAt)}
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

function renderAnomalies(items) {
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
            <div class="diff-field">${d.label || FIELD_LABEL[d.field] || d.field}</div>
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
        <span class="ac-time">${fmtDate(it.createdAt)}</span>
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

/* ---------- 刷新 ---------- */

async function refresh() {
  const [summary, records, anomalies] = await Promise.all([
    getSummary(),
    listRecords(currentFilter),
    listAnomalies(),
  ]);
  renderSummary(summary);
  renderList(records);
  renderAnomalies(anomalies);
}

/* ---------- 交互 ---------- */

async function handleCardAction(act, id) {
  if (act === 'detail') return openDetail(id);
  if (act === 'patch')  return openPatch(id);
  if (act === 'confirm') {
    try {
      const detail = await getRecordDetail(id);
      let note = '';
      if (detail && detail.status === STATUS.HANG) {
        note = prompt('从挂起状态确认，请输入确认说明（会留痕）：', '体重单位已人工核对');
        if (note === null) return;
      }
      await confirmRecord(id, { note });
      flash('已确认放行');
      await refresh();
    } catch (e) { alert(e.message); }
    return;
  }
  if (act === 'revoke') {
    const reason = prompt('撤回原因（会留痕）：', '材料不实/重复导入/其他');
    if (reason === null) return;
    try {
      await revokeRecord(id, { reason });
      flash('已撤回，保留历史留痕');
      await refresh();
    } catch (e) { alert(e.message); }
  }
}

async function openDetail(id) {
  const r = await getRecordDetail(id);
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
            <div class="diff-field">${d.label || FIELD_LABEL[d.field] || d.field}</div>
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

  const anomHtml = r.anomalies && r.anomalies.length > 0 ? `
    <h4>异常时间线</h4>
    <ul class="anom-timeline">
      ${r.anomalies.map((a) => {
        const info = ANOMALY_LABEL[a.type] || { label: a.type, cls: 'tag-warn' };
        return `<li><span class="tag ${info.cls}">${info.label}</span>
          <span class="muted">${fmtDate(a.createdAt)}</span>
          <div>${escapeHtml(a.message)}</div>
        </li>`;
      }).join('')}
    </ul>` : '';

  const body = `
    <div class="detail-head">
      <div>
        <h3 style="margin:0">${escapeHtml(r.ownerWechat)} ${L && L.animalName ? '· ' + escapeHtml(L.animalName) : ''}</h3>
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

async function openPatch(id) {
  const r = await getRecordDetail(id);
  if (!r) return;
  const L = r.latest || {};
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
  form.addEventListener('submit', async (e) => {
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
    };
    try {
      await humanPatchRecord(id, patch, { reason });
      closeModal();
      flash('已保存，生成新版本并标记人工改过');
      await refresh();
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

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await refresh();
  } catch (err) {
    alert('无法加载数据，请确认后端服务已启动：' + err.message);
  }

  document.getElementById('btn-import-entry').addEventListener('click', () => {
    document.getElementById('import-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('确定清空全部数据？此操作不可恢复。')) return;
    alert('清空数据功能暂未开放（API 面保持克制，如需可调用 db.js 直接处理）。');
  });

  document.querySelectorAll('.filter-bar .chip').forEach((ch) => {
    ch.addEventListener('click', async () => {
      document.querySelectorAll('.filter-bar .chip').forEach((x) => x.classList.remove('active'));
      ch.classList.add('active');
      currentFilter = ch.dataset.filter;
      const records = await listRecords(currentFilter);
      renderList(records);
    });
  });

  const form = document.getElementById('form-import');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {};
    fd.forEach((v, k) => { payload[k] = v; });
    try {
      const res = await importRecord(payload);
      let msg = res.created ? '已导入新记录' : '已追加到现有主人记录';
      if (res.warnings && res.warnings.length) msg += `（${res.warnings.join('；')}）`;
      flash(msg);
      form.reset();
      await refresh();
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  });
});

/* 暴露到 window，便于调试（API 面保持克制） */
window.StrayTracker = {
  importRecord,
  confirmRecord,
  revokeRecord,
  humanPatchRecord,
  getSummary,
  listRecords,
  listAnomalies,
  getRecordDetail,
  refresh,
};
