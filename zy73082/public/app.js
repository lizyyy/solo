const API = '/api';
let state = {
  page: 1,
  pageSize: 20,
  keyword: '',
  collisionOnly: false,
  data: [],
  total: 0,
};

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

function toast(msg, type = 'info') {
  const el = $('#toast');
  el.className = 'toast ' + type;
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

async function api(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      return data;
    }
    return res;
  } catch (e) {
    toast(e.message, 'error');
    throw e;
  }
}

async function loadStats() {
  const s = await api(`${API}/materials/stats`);
  $('#statTotal').textContent = s.total || 0;
  $('#statCollision').textContent = s.collision_count || 0;
  $('#statConcluded').textContent = s.concluded_count || 0;
  $('#statRemarked').textContent = s.manual_remarked_count || 0;
}

async function loadList() {
  const params = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize,
    keyword: state.keyword,
    collision_only: state.collisionOnly,
  });
  const { data, total } = await api(`${API}/materials?${params}`);
  state.data = data;
  state.total = total;
  renderTable();
  renderPagination();
}

function renderTable() {
  const tbody = $('#tableBody');
  if (!state.data.length) {
    tbody.innerHTML = `
      <tr><td colspan="14">
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <p><strong>暂无材料记录</strong></p>
          <p>点击"加载演示数据"快速体验，或使用"导入JSON"开始</p>
          <div class="empty-actions">
            <button class="btn btn-primary" onclick="seedDemo()">立即加载演示数据</button>
          </div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = state.data.map((r, idx) => {
    const offset = (state.page - 1) * state.pageSize + idx + 1;
    const isCol = r.is_collision || r.is_duplicate;
    const badges = [];
    if (r.is_collision) badges.push(`<span class="badge badge-collision">⚠ 口径冲突</span>`);
    if (r.is_duplicate) badges.push(`<span class="badge badge-duplicate">♺ 重复导入</span>`);
    if (r.remark_version > 1) badges.push(`<span class="badge badge-ver" data-ver="${r.remark_version}"></span>`);

    const esc = v => {
      if (v === null || v === undefined || v === '') return '';
      return String(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    };

    return `
      <tr class="${isCol ? 'collision-row' : ''}" data-id="${r.id}">
        <td style="color:#9ca3af;font-family:monospace">${offset}</td>
        <td class="node-cell">${esc(r.node_code)}</td>
        <td style="font-family:monospace;color:#6b7280">${esc(r.material_code) || '—'}</td>
        <td class="material-cell">${esc(r.material_name) || '—'}</td>
        <td class="spec-cell">${esc(r.specification) || '—'}</td>
        <td class="qty-cell">${r.quantity !== null ? Number(r.quantity).toLocaleString() : '—'} <span style="color:#9ca3af;font-weight:400">${esc(r.unit) || ''}</span></td>
        <td style="font-size:12px"><div style="font-weight:500">${esc(r.floor) || '—'}</div><div style="color:#9ca3af">${esc(r.area) || ''}</div></td>
        <td class="remark-cell bim">${esc(r.bim_remark)}</td>
        <td class="remark-cell supp">${esc(r.supplementary_remark)}</td>
        <td class="remark-cell verbal">${esc(r.verbal_remark)}</td>
        <td class="remark-cell manual">${esc(r.manual_remark)}</td>
        <td><div class="conclusion-cell">${esc(r.conclusion)}</div>${r.conclusion_author ? `<div style="font-size:11px;color:#9ca3af;margin-top:3px">${esc(r.conclusion_author)} · ${esc(r.conclusion_updated_at) || ''}</div>` : ''}</td>
        <td class="status-cell">${badges.join('') || '<span style="color:#9ca3af;font-size:12px">正常</span>'}</td>
        <td class="action-cell">
          <button class="icon-btn edit" title="编辑记录" onclick="openEdit(${r.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="icon-btn history" title="查看历史" onclick="openEdit(${r.id}, true)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button class="icon-btn flag" title="${isCol ? '取消碰撞标记' : '标记为碰撞'}" onclick="toggleCollision(${r.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${isCol ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const box = $('#pagination');
  const pages = [];
  let start = Math.max(1, state.page - 2);
  let end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);

  const mk = (label, page, opts = {}) =>
    `<button class="page-btn ${opts.active ? 'active' : ''}" ${opts.disabled ? 'disabled' : ''} ${page ? `onclick="gotoPage(${page})"` : ''}>${label}</button>`;

  pages.push(mk('«', state.page - 1, { disabled: state.page === 1 }));
  for (let i = start; i <= end; i++) pages.push(mk(i, i, { active: i === state.page }));
  pages.push(mk('»', state.page + 1, { disabled: state.page === totalPages }));
  pages.push(`<span style="margin-left:10px;color:#9ca3af;font-size:12px">共 ${state.total} 条</span>`);
  box.innerHTML = pages.join('');
}

function gotoPage(p) { state.page = p; loadList(); }
window.gotoPage = gotoPage;

async function openEdit(id, focusHistory = false) {
  const r = await api(`${API}/materials/${id}`);
  const form = $('#editForm');
  form.reset();
  Object.keys(r).forEach(k => {
    const el = form.elements[k];
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!r[k];
    else el.value = r[k] ?? '';
  });

  const meta = $('#conclusionMeta');
  if (r.conclusion_author && r.conclusion_updated_at) {
    meta.textContent = ` · 上次由 ${r.conclusion_author} 于 ${r.conclusion_updated_at} 修改`;
  } else {
    meta.textContent = '';
  }

  $('#modalTitle').textContent = `编辑 · ${r.node_code}${r.material_code ? ' / ' + r.material_code : ''}`;

  const history = await api(`${API}/materials/${id}/history`);
  renderHistory(history);

  $('#editModal').classList.add('active');

  if (focusHistory) {
    setTimeout(() => {
      $('.history-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }
}
window.openEdit = openEdit;

function renderHistory(history) {
  const tl = $('#historyTimeline');
  if (!history.length) {
    tl.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px">暂无修改历史</p>';
    return;
  }
  const fieldLabels = {
    bim_remark: 'BIM模型备注',
    supplementary_remark: '后补备注',
    verbal_remark: '口头说明',
    manual_remark: '人工备注',
    review_remark: '复核备注',
    conclusion: '结论',
    material_name: '材料名称',
    specification: '规格型号',
    quantity: '数量',
    unit: '单位',
    floor: '楼层',
    area: '区域',
  };

  tl.innerHTML = history.map(h => {
    let typeClass = 'type-update';
    if (h.change_type && h.change_type.includes('conclusion')) typeClass = 'type-conclusion';
    else if (h.change_type && (h.change_type.includes('remark') || h.change_type.includes('collision'))) typeClass = 'type-remark';
    else if (h.change_type === 'initial') typeClass = 'type-initial';
    else if (h.change_type && h.change_type.includes('import')) typeClass = 'type-import';
    if (h.change_type === 'collision_merge') typeClass = 'type-collision';

    const label = fieldLabels[h.field_name] || h.field_name;
    const hasDiff = h.old_value || h.new_value;

    let diffHtml = '';
    if (h.change_type === 'initial') {
      diffHtml = `<div class="timeline-diff"><span class="diff-new">初始值：${escapeHtml(h.new_value) || '(空)'}</span></div>`;
    } else if (hasDiff) {
      diffHtml = `
        <div class="timeline-diff">
          ${h.old_value ? `<div><div class="diff-label">修改前</div><div class="diff-old">${escapeHtml(h.old_value)}</div></div>` : ''}
          ${h.new_value ? `<div style="margin-top:4px"><div class="diff-label">修改后</div><div class="diff-new">${escapeHtml(h.new_value)}</div></div>` : ''}
        </div>`;
    }

    return `
      <div class="timeline-item ${typeClass}">
        <div class="timeline-content">
          <div class="timeline-meta">
            <span class="timeline-field">${label}</span>
            <span class="timeline-operator">${escapeHtml(h.operator || '系统')}</span>
            <span class="timeline-time">${escapeHtml(h.changed_at || '')}</span>
          </div>
          ${diffHtml}
        </div>
      </div>`;
  }).join('');
}

function escapeHtml(v) {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function saveEdit(e) {
  e.preventDefault();
  const form = $('#editForm');
  const fd = new FormData(form);
  const id = fd.get('id');
  const operator = fd.get('operator');
  const body = { operator };

  const fields = ['material_name', 'specification', 'quantity', 'unit', 'floor', 'area',
    'bim_remark', 'supplementary_remark', 'verbal_remark', 'manual_remark', 'review_remark',
    'conclusion', 'is_collision', 'is_duplicate'];

  fields.forEach(f => {
    if (fd.has(f)) {
      const v = fd.get(f);
      if (v === 'on') body[f] = true;
      else if (v === '' || v === null) body[f] = null;
      else if (['quantity'].includes(f)) body[f] = v === '' ? null : Number(v);
      else body[f] = v;
    }
  });
  body.is_collision = form.elements.is_collision.checked ? 1 : 0;
  body.is_duplicate = form.elements.is_duplicate.checked ? 1 : 0;

  const result = await api(`${API}/materials/${id}`, { method: 'PUT', body });
  if (result.updated) {
    toast('已保存，后端数据和导出已同步更新', 'success');
    $('#editModal').classList.remove('active');
    await Promise.all([loadStats(), loadList()]);
  } else {
    toast('无实际变更', 'info');
  }
}

async function toggleCollision(id) {
  const rec = state.data.find(r => r.id === id);
  if (!rec) return;
  const next = rec.is_collision || rec.is_duplicate ? 0 : 1;
  await api(`${API}/materials/${id}`, {
    method: 'PUT',
    body: { operator: '复核人', is_collision: next, is_duplicate: next === 1 ? rec.is_duplicate : 0 },
  });
  toast(next ? '已标记为碰撞记录' : '已取消碰撞标记', next ? 'warning' : 'success');
  await Promise.all([loadStats(), loadList()]);
}
window.toggleCollision = toggleCollision;

async function seedDemo() {
  if (!confirm('此操作会清空现有数据并加载演示数据，确定继续？')) return;
  await api(`${API}/seed-demo`, { method: 'POST' });
  toast('演示数据已加载，共12条，含1条碰撞/重复示例', 'success');
  await Promise.all([loadStats(), loadList()]);
}
window.seedDemo = seedDemo;

function openImport() {
  $('#importModal').classList.add('active');
  $('#importResult').classList.remove('show');
  $('#importData').value = JSON.stringify([
    {
      node_code: 'CW-N-011',
      material_code: 'AL-6063-05',
      material_name: '铝合金百叶',
      specification: '6063-T5 75mm',
      quantity: 50,
      unit: 'm²',
      floor: '设备层',
      area: '四面',
      bim_remark: 'BIM模型V2.1 设备层通风百叶',
      supplementary_remark: '',
      verbal_remark: '阿乔口头：注意百叶角度可调',
    },
  ], null, 2);
}

async function doImport() {
  const batchName = $('#importBatchName').value.trim() || '手动导入批次';
  const operator = $('#importOperator').value;
  const raw = $('#importData').value.trim();

  let records;
  try {
    records = JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error('必须是数组格式');
  } catch (e) {
    toast('JSON格式错误：' + e.message, 'error');
    return;
  }

  const result = await api(`${API}/import`, {
    method: 'POST',
    body: { records, batch_name: batchName, operator },
  });

  const box = $('#importResult');
  box.classList.add('show');
  box.innerHTML = `
    <div class="result-card">
      <div class="result-item r-total"><span class="result-num">${result.total}</span><span class="result-label">导入总数</span></div>
      <div class="result-item r-new"><span class="result-num">${result.newCount}</span><span class="result-label">新增记录</span></div>
      <div class="result-item r-upd"><span class="result-num">${result.updatedCount}</span><span class="result-label">更新记录</span></div>
      <div class="result-item r-col"><span class="result-num">${result.collisionCount}</span><span class="result-label">碰撞/冲突</span></div>
      <div class="result-item r-skip"><span class="result-num">${result.skippedCount}</span><span class="result-label">跳过(无变更)</span></div>
    </div>`;

  const summary = [];
  if (result.newCount) summary.push(`${result.newCount}条新增`);
  if (result.updatedCount) summary.push(`${result.updatedCount}条已更新（人工备注未覆盖）`);
  if (result.collisionCount) summary.push(`${result.collisionCount}条碰撞需复核`);
  if (result.skippedCount) summary.push(`${result.skippedCount}条无变更已跳过（未翻倍）`);

  toast('导入完成：' + (summary.join('，') || '无操作'), result.collisionCount ? 'warning' : 'success');
  await Promise.all([loadStats(), loadList()]);
}

function doExport(collisionOnly = false) {
  const params = new URLSearchParams({ collision_only: collisionOnly });
  window.location.href = `${API}/export?${params}`;
  toast(collisionOnly ? '正在导出碰撞清单...' : '正在导出完整Excel...', 'info');
}

function bindEvents() {
  $('#saveBtn').addEventListener('click', saveEdit);
  $('#seedBtn').addEventListener('click', seedDemo);
  $('#importBtn').addEventListener('click', openImport);
  $('#doImportBtn').addEventListener('click', doImport);
  $('#exportBtn').addEventListener('click', () => doExport(false));
  $('#exportCollisionBtn').addEventListener('click', () => doExport(true));

  $('#searchInput').addEventListener('input', debounce(e => {
    state.keyword = e.target.value.trim();
    state.page = 1;
    loadList();
  }, 300));

  $('#collisionOnly').addEventListener('change', e => {
    state.collisionOnly = e.target.checked;
    state.page = 1;
    loadList();
    toast(state.collisionOnly ? '已过滤：仅显示碰撞/重复记录' : '已显示全部记录', 'info');
  });

  $$('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      el.closest('.modal').classList.remove('active');
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $$('.modal.active').forEach(m => m.classList.remove('active'));
    }
  });
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

async function init() {
  bindEvents();
  await Promise.all([loadStats(), loadList()]);
}

init();
