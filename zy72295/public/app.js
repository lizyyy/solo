const API = '/api';

async function apiGet(path) {
  const res = await fetch(API + path);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(API + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return res.json();
}

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function statusLabel(status) {
  const map = {
    draft: '草稿',
    reviewing: '待复核',
    normal: '正常',
    rejected: '已拒绝'
  };
  return map[status] || status || '未知';
}

function statusClass(status) {
  return 'status-' + (status || 'draft');
}

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN');
}

function showModal(contentHtml) {
  $('#modalContent').innerHTML = contentHtml;
  $('#modalMask').style.display = 'flex';
}

function hideModal() {
  $('#modalMask').style.display = 'none';
}

$('#modalMask').addEventListener('click', (e) => {
  if (e.target.id === 'modalMask') hideModal();
});

async function loadHeaderStats() {
  try {
    const stats = await apiGet('/stats');
    $('#headerStats').innerHTML = `
      <span>温区 ${stats.zones}</span>
      <span>图层 ${stats.layers}</span>
      <span>路线 ${stats.routes}</span>
      <span>导出 ${stats.exports}</span>
      <span>seq ${stats.globalSeq}</span>
    `;
  } catch (e) {}
}

const routes = {
  'zones': renderZonesPage,
  'zone': renderZoneDetail,
  'layers': renderLayersPage,
  'layer': renderLayerDetail,
  'routes': renderRoutesPage,
  'route': renderRouteDetail,
  '3d': render3DPage,
  'chart': renderChartPage,
  'exports': renderExportsPage
};

function parseRoute() {
  const hash = location.hash.slice(2) || 'zones';
  const parts = hash.split('/');
  return { name: parts[0], params: parts.slice(1) };
}

async function router() {
  const { name, params } = parseRoute();

  $all('.app-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === name);
  });

  $('#appMain').innerHTML = '<div class="loading">加载中...</div>';

  const handler = routes[name] || renderZonesPage;
  try {
    await handler(...params);
  } catch (e) {
    $('#appMain').innerHTML = `<div class="error">页面加载失败: ${e.message}</div>`;
  }

  loadHeaderStats();
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

async function renderZonesPage() {
  const res = await apiGet('/zones');
  const zones = res.data || [];

  let html = `
    <div class="page-header">
      <h2>📋 温区列表</h2>
      <button class="btn btn-primary" onclick="seedDemoData()">导入演示数据</button>
    </div>
    <div class="card-grid">
  `;

  if (zones.length === 0) {
    html = `<div class="page-header"><h2>📋 温区列表</h2><button class="btn btn-primary" onclick="seedDemoData()">导入演示数据</button></div>
            <div class="empty-state">暂无温区数据，点击上方按钮导入演示样例</div>`;
  } else {
    for (const z of zones) {
      html += `
        <div class="card" onclick="location.hash = '#/zone/${z.id}'">
          <div class="card-title">
            <span class="card-color-dot" style="background:${z.color || '#3498db'}"></span>
            ${escapeHtml(z.name)}
          </div>
          <div class="card-meta">
            温度: ${z.temperatureRange?.min ?? '-'}°C ~ ${z.temperatureRange?.max ?? '-'}°C
          </div>
          <div class="card-meta">
            范围: X ${z.bounds?.minX}-${z.bounds?.maxX} / Y ${z.bounds?.minY}-${z.bounds?.maxY} / Z ${z.bounds?.minZ}-${z.bounds?.maxZ}
          </div>
          <div style="margin-top:8px;">
            <span class="card-status ${statusClass(z.status)}">${statusLabel(z.status)}</span>
          </div>
          ${z.latestOperation ? `
            <div class="card-meta" style="margin-top:8px;">
              最近操作: ${z.latestOperation.operation} by ${z.latestOperation.operator}
              <br>${formatTime(z.latestOperation.timestamp)}
            </div>
          ` : ''}
        </div>
      `;
    }
    html += '</div>';
  }

  $('#appMain').innerHTML = html;
}

async function renderZoneDetail(id) {
  const res = await apiGet('/zones/' + id);
  if (!res.success) {
    $('#appMain').innerHTML = '<div class="empty-state">温区不存在</div>';
    return;
  }

  const { zone, latestSnapshot, history, remarkDiff } = res.data;

  let html = `
    <a class="back-link" href="#/zones">← 返回温区列表</a>
    <div class="page-header">
      <h2>${escapeHtml(zone.name)} 详情</h2>
      <div style="display:flex;gap:8px;">
        <span class="card-status ${statusClass(zone.status)}">${statusLabel(zone.status)}</span>
        <button class="btn btn-default btn-sm" onclick="editZoneRemark('${zone.id}')">修改备注</button>
      </div>
    </div>

    ${latestSnapshot?.context?.reviewRequired ? `
      <div class="review-banner">
        <strong>⚠️ 待复核</strong>
        ${escapeHtml(latestSnapshot.context.reason || '')}
        <br>下一步: ${escapeHtml(latestSnapshot.context.nextStep || '')}
      </div>
    ` : ''}

    <div class="detail-container">
      <div class="detail-card">
        <h3>📐 基本信息</h3>
        <div class="detail-row"><span class="detail-label">温区ID</span><span class="detail-value">${escapeHtml(zone.id)}</span></div>
        <div class="detail-row"><span class="detail-label">名称</span><span class="detail-value">${escapeHtml(zone.name)}</span></div>
        <div class="detail-row"><span class="detail-label">状态</span><span class="detail-value"><span class="card-status ${statusClass(zone.status)}">${statusLabel(zone.status)}</span></span></div>
        <div class="detail-row"><span class="detail-label">创建人</span><span class="detail-value">${escapeHtml(zone.createdBy || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">创建时间</span><span class="detail-value">${formatTime(zone.createdAt)}</span></div>
        <div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${escapeHtml(zone.remark) || '(无)'}</span></div>
      </div>

      <div class="detail-card">
        <h3>🌡️ 温度与范围</h3>
        <div class="detail-row"><span class="detail-label">温度范围</span><span class="detail-value">${zone.temperatureRange?.min ?? '-'}°C ~ ${zone.temperatureRange?.max ?? '-'}°C</span></div>
        <div class="detail-row"><span class="detail-label">X轴范围</span><span class="detail-value">${zone.bounds?.minX}m - ${zone.bounds?.maxX}m</span></div>
        <div class="detail-row"><span class="detail-label">Y轴范围</span><span class="detail-value">${zone.bounds?.minY}m - ${zone.bounds?.maxY}m</span></div>
        <div class="detail-row"><span class="detail-label">Z轴范围</span><span class="detail-value">${zone.bounds?.minZ}m - ${zone.bounds?.maxZ}m</span></div>
        <div class="detail-row"><span class="detail-label">温区高度</span><span class="detail-value">${(zone.bounds?.maxZ - zone.bounds?.minZ).toFixed(2)}m</span></div>
      </div>

      <div class="detail-card">
        <h3>🔗 关联数据</h3>
        <div class="detail-row">
          <span class="detail-label">CAD图层</span>
          <span class="detail-value">
            ${zone.layerId ? `<a href="#/layer/${zone.layerId}" style="color:#3498db">查看关联图层 →</a>` : '未关联'}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">补录路线</span>
          <span class="detail-value">
            ${zone.routeId ? `<a href="#/route/${zone.routeId}" style="color:#3498db">查看关联路线 →</a>` : '未关联'}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">3D回源</span>
          <span class="detail-value">
            <button class="btn btn-default btn-sm" onclick="goTo3D('${zone.id}')">在3D视图中查看</button>
          </span>
        </div>
      </div>

      <div class="detail-card">
        <h3>📝 备注变更历史</h3>
        <div class="history-list">
          ${(remarkDiff || []).length === 0 ? '<div style="color:#95a5a6;font-size:12px;">暂无备注变更记录</div>' :
            (remarkDiff || []).map(r => `
              <div class="history-item">
                <div class="history-head">
                  <span class="history-op">备注变更</span>
                  <span class="history-time">${formatTime(r.timestamp)} · ${escapeHtml(r.operator)}</span>
                </div>
                <div style="font-size:12px;margin-bottom:4px;">
                  <span class="diff-before">改前: ${escapeHtml(r.before ?? '') || '(空)'}</span>
                  →
                  <span class="diff-after">改后: ${escapeHtml(r.after ?? '') || '(空)'}</span>
                </div>
                ${r.context?.reason ? `<div style="font-size:11px;color:#7f8c8d;">原因: ${escapeHtml(r.context.reason)}</div>` : ''}
              </div>
            `).join('')
          }
        </div>
      </div>

      <div class="detail-card full">
        <h3>📜 完整历史记录 (按seq降序，共 ${history.length} 条)</h3>
        <div class="history-list">
          ${(history || []).map(h => `
            <div class="history-item">
              <div class="history-head">
                <span>
                  <span class="badge badge-info">seq ${h.seq}</span>
                  <span class="history-op" style="margin-left:6px;">${escapeHtml(h.operation)}</span>
                </span>
                <span class="history-time">${formatTime(h.timestamp)} · ${escapeHtml(h.operator)}</span>
              </div>
              ${h.diff && Object.keys(h.diff).length > 0 ? `
                <div class="history-diff">
                  ${Object.entries(h.diff).map(([k, v]) => `
                    <div>
                      <span style="color:#7f8c8d;">${k}:</span>
                      <span class="diff-before">${JSON.stringify(v.before)}</span>
                      →
                      <span class="diff-after">${JSON.stringify(v.after)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${h.context ? `
                <div class="history-context">
                  <div><strong>原因:</strong> ${escapeHtml(h.context.reason || '-')}</div>
                  <div><strong>下一步:</strong> ${escapeHtml(h.context.nextStep || '-')}</div>
                  <div><strong>需复核:</strong> ${h.context.reviewRequired ? '是' : '否'}</div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  $('#appMain').innerHTML = html;
}

async function renderLayersPage() {
  const res = await apiGet('/layers');
  const layers = res.data || [];

  let html = `
    <div class="page-header">
      <h2>🗺️ CAD图层</h2>
      <button class="btn btn-primary" onclick="seedDemoData()">导入演示数据</button>
    </div>
    <div class="card-grid">
  `;

  if (layers.length === 0) {
    html = `<div class="page-header"><h2>🗺️ CAD图层</h2><button class="btn btn-primary" onclick="seedDemoData()">导入演示数据</button></div>
            <div class="empty-state">暂无CAD图层数据</div>`;
  } else {
    for (const l of layers) {
      html += `
        <div class="card" onclick="location.hash = '#/layer/${l.id}'">
          <div class="card-title">📁 ${escapeHtml(l.name)}</div>
          <div class="card-meta">导入人: ${escapeHtml(l.importedBy || '-')}</div>
          <div class="card-meta">导入时间: ${formatTime(l.importedAt)}</div>
          <div class="card-meta">温区数: ${(l.zones || []).length}</div>
          <div class="card-meta">版本: v${l.version}</div>
          ${l.isDuplicate ? '<span class="badge badge-warn" style="margin-top:6px;">重复导入</span>' : ''}
        </div>
      `;
    }
    html += '</div>';
  }

  $('#appMain').innerHTML = html;
}

async function renderLayerDetail(id) {
  const res = await apiGet('/layers/' + id);
  if (!res.success) {
    $('#appMain').innerHTML = '<div class="empty-state">图层不存在</div>';
    return;
  }
  const { layer, latestSnapshot, history } = res.data;

  const zonesRes = await apiGet('/zones');
  const layerZones = (zonesRes.data || []).filter(z => z.layerId === id);

  let html = `
    <a class="back-link" href="#/layers">← 返回图层列表</a>
    <div class="page-header">
      <h2>📁 ${escapeHtml(layer.name)}</h2>
      <span class="badge badge-info">v${layer.version}</span>
    </div>

    <div class="detail-container">
      <div class="detail-card">
        <h3>📋 图层信息</h3>
        <div class="detail-row"><span class="detail-label">图层ID</span><span class="detail-value">${escapeHtml(layer.id)}</span></div>
        <div class="detail-row"><span class="detail-label">名称</span><span class="detail-value">${escapeHtml(layer.name)}</span></div>
        <div class="detail-row"><span class="detail-label">导入人</span><span class="detail-value">${escapeHtml(layer.importedBy || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">导入时间</span><span class="detail-value">${formatTime(layer.importedAt)}</span></div>
        <div class="detail-row"><span class="detail-label">源文件</span><span class="detail-value">${escapeHtml(layer.sourceFile) || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">温区数</span><span class="detail-value">${(layer.zones || []).length}</span></div>
      </div>

      <div class="detail-card">
        <h3>❄️ 关联温区 (${layerZones.length})</h3>
        ${layerZones.length === 0 ? '<div style="color:#95a5a6;">暂无关联温区</div>' :
          layerZones.map(z => `
            <div style="padding:8px 0;border-bottom:1px dashed #ecf0f1;cursor:pointer;" onclick="location.hash='#/zone/${z.id}'">
              <span style="display:inline-block;width:10px;height:10px;background:${z.color || '#3498db'};border-radius:2px;margin-right:8px;"></span>
              ${escapeHtml(z.name)}
              <span class="card-status ${statusClass(z.status)}" style="margin-left:8px;">${statusLabel(z.status)}</span>
            </div>
          `).join('')
        }
      </div>

      <div class="detail-card full">
        <h3>📜 历史记录 (${history.length})</h3>
        <div class="history-list">
          ${history.map(h => `
            <div class="history-item">
              <div class="history-head">
                <span>
                  <span class="badge badge-info">seq ${h.seq}</span>
                  <span class="history-op" style="margin-left:6px;">${escapeHtml(h.operation)}</span>
                </span>
                <span class="history-time">${formatTime(h.timestamp)} · ${escapeHtml(h.operator)}</span>
              </div>
              ${h.context ? `
                <div class="history-context">
                  <div><strong>原因:</strong> ${escapeHtml(h.context.reason || '-')}</div>
                  <div><strong>下一步:</strong> ${escapeHtml(h.context.nextStep || '-')}</div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  $('#appMain').innerHTML = html;
}

async function renderRoutesPage() {
  const res = await apiGet('/routes');
  const routes = res.data || [];

  let html = `
    <div class="page-header">
      <h2>📏 补录路线</h2>
      <button class="btn btn-primary" onclick="seedDemoData()">导入演示数据</button>
    </div>
    <div class="card-grid">
  `;

  if (routes.length === 0) {
    html = `<div class="page-header"><h2>📏 补录路线</h2><button class="btn btn-primary" onclick="seedDemoData()">导入演示数据</button></div>
            <div class="empty-state">暂无补录路线数据</div>`;
  } else {
    for (const r of routes) {
      html += `
        <div class="card" onclick="location.hash = '#/route/${r.id}'">
          <div class="card-title">📍 ${escapeHtml(r.name)}</div>
          <div class="card-meta">长度: ${r.length?.toFixed(2) || 0}m ${r.lengthRecalculated ? '✓已重算' : '⚠未重算'}</div>
          <div class="card-meta">创建人: ${escapeHtml(r.createdBy || '-')}</div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <span class="card-status ${statusClass(r.status)}">${statusLabel(r.status)}</span>
            ${r.needsCustomerReview ? '<span class="badge badge-warn">待客户复核</span>' : ''}
          </div>
          ${r.latestOperation?.context?.nextStep ? `
            <div class="card-meta" style="margin-top:8px;color:#b45309;">
              下一步: ${escapeHtml(r.latestOperation.context.nextStep)}
            </div>
          ` : ''}
        </div>
      `;
    }
    html += '</div>';
  }

  $('#appMain').innerHTML = html;
}

async function renderRouteDetail(id) {
  const res = await apiGet('/routes/' + id);
  if (!res.success) {
    $('#appMain').innerHTML = '<div class="empty-state">路线不存在</div>';
    return;
  }

  const { route, measurement, latestSnapshot, history } = res.data;

  let html = `
    <a class="back-link" href="#/routes">← 返回路线列表</a>
    <div class="page-header">
      <h2>📍 ${escapeHtml(route.name)} 详情</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="card-status ${statusClass(route.status)}">${statusLabel(route.status)}</span>
        ${route.needsCustomerReview ? '<span class="badge badge-warn">待客户复核</span>' : '<span class="badge badge-success">复核通过</span>'}
      </div>
    </div>

    ${route.needsCustomerReview ? `
      <div class="review-banner">
        <strong>⚠️ 待客户复核</strong>
        ${latestSnapshot?.context?.reason || '补录路线需要客户复核'}
        <br>下一步: ${escapeHtml(latestSnapshot?.context?.nextStep || '-')}
      </div>
    ` : ''}

    <div class="detail-container">
      <div class="detail-card">
        <h3>📋 路线信息</h3>
        <div class="detail-row"><span class="detail-label">路线ID</span><span class="detail-value">${escapeHtml(route.id)}</span></div>
        <div class="detail-row"><span class="detail-label">名称</span><span class="detail-value">${escapeHtml(route.name)}</span></div>
        <div class="detail-row"><span class="detail-label">长度</span><span class="detail-value">${route.length?.toFixed(2) || 0}m</span></div>
        <div class="detail-row"><span class="detail-label">已重算</span><span class="detail-value">${route.lengthRecalculated ? '是' : '否'}</span></div>
        <div class="detail-row"><span class="detail-label">状态</span><span class="detail-value"><span class="card-status ${statusClass(route.status)}">${statusLabel(route.status)}</span></span></div>
        <div class="detail-row"><span class="detail-label">复核状态</span><span class="detail-value">${route.customerReviewStatus || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">创建人</span><span class="detail-value">${escapeHtml(route.createdBy || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${escapeHtml(route.remark) || '-'}</span></div>
      </div>

      <div class="detail-card">
        <h3>🔗 关联数据</h3>
        <div class="detail-row">
          <span class="detail-label">测距仪记录</span>
          <span class="detail-value">
            ${measurement ? escapeHtml(measurement.deviceId || measurement.id) : '未关联'}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">CAD图层</span>
          <span class="detail-value">
            ${route.linkedCADLayerId ? `<a href="#/layer/${route.linkedCADLayerId}" style="color:#3498db;">查看图层 →</a>` : '未关联'}
          </span>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          ${!route.lengthRecalculated ? `<button class="btn btn-warning" onclick="recalcRoute('${route.id}')">重新计算长度</button>` : ''}
          ${route.needsCustomerReview ? `
            <button class="btn btn-success" onclick="approveRoute('${route.id}')">客户复核通过</button>
            <button class="btn btn-danger" onclick="rejectRoute('${route.id}')">客户拒绝</button>
          ` : ''}
        </div>
      </div>

      <div class="detail-card full">
        <h3>📜 历史记录 (${history.length})</h3>
        <div class="history-list">
          ${history.map(h => `
            <div class="history-item">
              <div class="history-head">
                <span>
                  <span class="badge badge-info">seq ${h.seq}</span>
                  <span class="history-op" style="margin-left:6px;">${escapeHtml(h.operation)}</span>
                </span>
                <span class="history-time">${formatTime(h.timestamp)} · ${escapeHtml(h.operator)}</span>
              </div>
              ${h.diff && Object.keys(h.diff).length > 0 ? `
                <div class="history-diff">
                  ${Object.entries(h.diff).map(([k, v]) => `
                    <div>
                      <span style="color:#7f8c8d;">${k}:</span>
                      <span class="diff-before">${JSON.stringify(v.before)}</span>
                      →
                      <span class="diff-after">${JSON.stringify(v.after)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${h.context ? `
                <div class="history-context">
                  <div><strong>原因:</strong> ${escapeHtml(h.context.reason || '-')}</div>
                  <div><strong>下一步:</strong> ${escapeHtml(h.context.nextStep || '-')}</div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  $('#appMain').innerHTML = html;
}

async function render3DPage() {
  const res = await apiGet('/zones');
  const zones = res.data || [];

  let html = `
    <div class="page-header">
      <h2>🎯 3D视图（点击温区可回源到CAD图层和测距仪记录）</h2>
      <div style="display:flex;gap:8px;">
        <span class="badge badge-info">温区数: ${zones.length}</span>
        <button class="btn btn-default btn-sm" onclick="location.reload()">刷新</button>
      </div>
    </div>

    <div class="view-3d-container">
      <div class="view-3d-header">
        <div>
          <strong>冷链库俯视图 (100m × 100m)</strong>
          <span style="color:#7f8c8d;font-size:12px;margin-left:12px;">点击温区查看详情和回源</span>
        </div>
        <div id="view3DStatus"></div>
      </div>
      <div class="view-3d-canvas" id="view3DCanvas">
        <div class="zone-info-panel" id="zoneInfoPanel" style="display:none;">
        </div>
      </div>
    </div>
  `;

  $('#appMain').innerHTML = html;

  const canvas = $('#view3DCanvas');
  const panel = $('#zoneInfoPanel');
  const status = $('#view3DStatus');

  const WAREHOUSE_W = 100, WAREHOUSE_H = 100;

  const canvasRect = canvas.getBoundingClientRect();
  const padding = 40;
  const plotW = canvasRect.width - padding * 2;
  const plotH = canvasRect.height - padding * 2 - 40;
  const scaleX = plotW / WAREHOUSE_W;
  const scaleY = plotH / WAREHOUSE_H;

  if (zones.length === 0) {
    canvas.innerHTML = '<div style="text-align:center;padding:120px;color:#95a5a6;">暂无温区数据，请先导入演示数据</div>';
    return;
  }

  zones.forEach((z, idx) => {
    const b = z.bounds;
    const zx = padding + b.minX * scaleX;
    const zy = padding + b.minY * scaleY;
    const zw = (b.maxX - b.minX) * scaleX;
    const zh = (b.maxY - b.minY) * scaleY;

    const el = document.createElement('div');
    el.className = 'zone-3d';
    el.style.left = zx + 'px';
    el.style.top = zy + 'px';
    el.style.width = zw + 'px';
    el.style.height = zh + 'px';
    el.style.background = z.color || '#3498db';
    el.style.borderRadius = '4px';
    el.textContent = z.name;
    el.dataset.zoneId = z.id;

    el.addEventListener('click', () => onZoneClick3D(z.id, el));
    canvas.appendChild(el);
  });

  const legend = document.createElement('div');
  legend.style.cssText = 'position:absolute;bottom:16px;left:40px;font-size:12px;color:#7f8c8d;';
  legend.innerHTML = `X: 0-${WAREHOUSE_W}m  |  Y: 0-${WAREHOUSE_H}m  |  每个矩形代表一个温区的投影`;
  canvas.appendChild(legend);

  let selectedEl = null;

  async function onZoneClick3D(zoneId, el) {
    if (selectedEl) selectedEl.classList.remove('selected');
    el.classList.add('selected');
    selectedEl = el;

    const res = await apiGet('/view-3d/click/' + zoneId);
    if (!res.success) {
      panel.style.display = 'block';
      panel.innerHTML = `<div style="color:#e74c3c;">${res.message || '加载失败'}</div>`;
      return;
    }

    const { zoneSummary, sourceData, needsReview, reviewContext } = res;
    const z = res.zone;

    let html = `
      <h4>${escapeHtml(z.name)}</h4>
      <div style="font-size:12px;color:#7f8c8d;margin-bottom:8px;">
        温度: ${z.temperatureRange?.min}-${z.temperatureRange?.max}°C
      </div>
      <div style="font-size:12px;margin-bottom:4px;">
        <strong>状态:</strong> <span class="card-status ${statusClass(z.status)}">${statusLabel(z.status)}</span>
      </div>
      <div style="font-size:12px;margin-bottom:4px;">
        <strong>备注:</strong> ${escapeHtml(z.remark) || '(无)'}
      </div>
    `;

    if (needsReview && reviewContext) {
      html += `
        <div style="background:#fef3c7;padding:8px;border-radius:4px;margin:8px 0;font-size:12px;">
          <strong style="color:#b45309;">⚠️ ${escapeHtml(reviewContext.issue)}</strong>
          <div style="margin-top:4px;color:#92400e;">
            下一步: ${escapeHtml(reviewContext.nextStep || '-')}
          </div>
        </div>
      `;
    }

    html += `
      <div class="zone-info-actions">
        <button class="btn btn-default btn-sm" onclick="location.hash='#/zone/${zone.id}'">详情</button>
        ${sourceData?.layer ? `<button class="btn btn-primary btn-sm" onclick="location.hash='#/layer/${sourceData.layer.id}'">回源CAD图层</button>` : ''}
        ${sourceData?.route ? `<button class="btn btn-success btn-sm" onclick="location.hash='#/route/${sourceData.route.id}'">回源补录路线</button>` : ''}
      </div>
    `;

    if (zoneSummary?.latestOperation) {
      html += `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #ecf0f1;font-size:11px;color:#7f8c8d;">
          <div>最近操作: ${zoneSummary.latestOperation.operation} by ${zoneSummary.latestOperation.operator}</div>
          <div>${formatTime(zoneSummary.latestOperation.timestamp)}</div>
          ${zoneSummary.latestOperation.context?.reason ? `<div>原因: ${escapeHtml(zoneSummary.latestOperation.context.reason)}</div>` : ''}
        </div>
      `;
    }

    panel.innerHTML = html;
    panel.style.display = 'block';

    status.innerHTML = `<span class="badge badge-info">已选中: ${escapeHtml(z.name)}</span>`;
  }
}

async function renderChartPage() {
  const res = await apiGet('/zones');
  const zones = res.data || [];

  let html = `
    <div class="page-header">
      <h2>📊 温度分布图（点击柱状图可回源到对应温区）</h2>
      <span class="badge badge-info">共 ${zones.length} 个温区</span>
    </div>

    <div class="chart-container">
      <div class="chart-bars" id="chartBars">
  `;

  if (zones.length === 0) {
    html = `<div class="page-header"><h2>📊 温度分布图</h2></div>
            <div class="empty-state">暂无温区数据</div>`;
    $('#appMain').innerHTML = html;
    return;
  }

  let maxTemp = 30;
  zones.forEach(z => {
    if (z.temperatureRange?.max > maxTemp) maxTemp = z.temperatureRange.max;
  });

  zones.sort((a, b) => (a.temperatureRange?.min ?? 0) - (b.temperatureRange?.min ?? 0));

  let barsHtml = '';
  for (const z of zones) {
    const minT = z.temperatureRange?.min ?? 0;
    const maxT = z.temperatureRange?.max ?? 0;
    const avgT = (minT + maxT) / 2;
    const heightPct = Math.max(5, (avgT / maxTemp) * 100);

    let level = 'low';
    if (avgT > 15) level = 'mid';
    if (avgT > 25) level = 'high';

    barsHtml += `
      <div class="chart-bar" data-zone-id="${z.id}" onclick="onChartBarClick('${z.id}')">
        <div class="chart-bar-fill ${level}" style="height:${heightPct}%;"></div>
        <div class="chart-bar-value">${minT}~${maxT}°C</div>
        <div class="chart-bar-label" title="${escapeHtml(z.name)}">${escapeHtml(z.name)}</div>
      </div>
    `;
  }

  html = `
    <div class="page-header">
      <h2>📊 温度分布图（点击柱状图可回源到对应温区）</h2>
      <span class="badge badge-info">共 ${zones.length} 个温区</span>
    </div>

    <div class="chart-container">
      <div class="chart-bars" id="chartBars">
        ${barsHtml}
      </div>
      <div style="text-align:center;margin-top:16px;color:#7f8c8d;font-size:12px;">
        按平均温度从低到高排列 · 点击柱子查看温区详情和回源
      </div>
    </div>

    <div id="chartDetail" style="margin-top:20px;"></div>
  `;

  $('#appMain').innerHTML = html;
}

window.onChartBarClick = async function(zoneId) {
  const res = await apiGet('/view-3d/click/' + zoneId);
  if (!res.success) return;

  const { zone, zoneSummary, sourceData, needsReview, reviewContext } = res;

  const detailHtml = `
    <div class="detail-card">
      <h3>🔍 ${escapeHtml(zone.name)}</h3>
      <div class="detail-row"><span class="detail-label">温度范围</span><span class="detail-value">${zone.temperatureRange?.min}-${zone.temperatureRange?.max}°C</span></div>
      <div class="detail-row"><span class="detail-label">状态</span><span class="detail-value"><span class="card-status ${statusClass(zone.status)}">${statusLabel(zone.status)}</span></span></div>
      <div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${escapeHtml(zone.remark) || '(无)'}</span></div>
      <div class="detail-row">
        <span class="detail-label">回源</span>
        <span class="detail-value" style="display:flex;gap:8px;">
          <a class="btn btn-default btn-sm" href="#/zone/${zone.id}">温区详情</a>
          ${sourceData?.layer ? `<a class="btn btn-primary btn-sm" href="#/layer/${sourceData.layer.id}">CAD图层 →</a>` : ''}
          ${sourceData?.route ? `<a class="btn btn-success btn-sm" href="#/route/${sourceData.route.id}">补录路线 →</a>` : ''}
        </span>
      </div>
      ${needsReview ? `
        <div class="review-banner" style="margin-top:12px;">
          <strong>⚠️ 待复核</strong>
          ${escapeHtml(reviewContext?.issue || '')}
          <br>下一步: ${escapeHtml(reviewContext?.nextStep || '')}
        </div>
      ` : ''}
    </div>
  `;

  $('#chartDetail').innerHTML = detailHtml;
  $('#chartDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

async function renderExportsPage() {
  const res = await apiGet('/exports');
  const exports = res.data || [];
  const canRes = await apiGet('/exports/can-export');

  let html = `
    <div class="page-header">
      <h2>🖼️ 导出记录</h2>
      <div style="display:flex;gap:8px;align-items:center;">
        ${canRes.canExport
          ? `<button class="btn btn-success" onclick="doExport()">导出截图</button>`
          : `<span class="badge badge-warn">${canRes.message || '暂不可导出'}</span>`
        }
      </div>
    </div>

    ${!canRes.canExport && canRes.pendingRoutes ? `
      <div class="review-banner">
        <strong>⚠️ 导出被阻止</strong>
        存在 ${canRes.pendingRoutes.length} 条待复核的补录路线，请先完成客户复核
      </div>
    ` : ''}

    <div class="export-list">
  `;

  if (exports.length === 0) {
    html += '<div class="empty-state">暂无导出记录</div>';
  } else {
    for (const exp of exports) {
      html += `
        <div class="export-item">
          <div class="export-thumb">
            <img src="${exp.relativePath}" alt="导出截图" onerror="this.style.display='none'">
          </div>
          <div class="export-info">
            <div class="export-name">${escapeHtml(exp.fileName)}</div>
            <div class="export-meta">
              导出人: ${escapeHtml(exp.exportedBy)} · 
              ${formatTime(exp.exportedAt)} · 
              ${exp.zoneCount} 个温区 · 
              ${(exp.fileSize / 1024).toFixed(1)} KB
            </div>
            <div class="export-meta">
              <span class="badge badge-info">格式: ${exp.format}</span>
              <span class="badge badge-success">状态: ${exp.status}</span>
            </div>
          </div>
          <div class="export-actions">
            <button class="btn btn-default btn-sm" onclick="viewExportDetail('${exp.id}')">查看快照</button>
            <a class="btn btn-primary btn-sm" href="${exp.relativePath}" target="_blank">打开图片</a>
          </div>
        </div>
      `;
    }
  }

  html += '</div>';
  $('#appMain').innerHTML = html;
}

window.viewExportDetail = async function(id) {
  const res = await apiGet('/exports/' + id);
  if (!res.success) return;
  const exp = res.data;

  let zonesHtml = '';
  if (exp.snapshot?.zones) {
    zonesHtml = exp.snapshot.zones.map(z => `
      <div style="padding:6px 0;border-bottom:1px dashed #ecf0f1;">
        <span style="display:inline-block;width:10px;height:10px;background:${z.color || '#3498db'};border-radius:2px;margin-right:6px;"></span>
        <strong>${escapeHtml(z.name)}</strong>
        <span class="card-status ${statusClass(z.status)}" style="margin-left:8px;">${statusLabel(z.status)}</span>
        <div style="font-size:11px;color:#7f8c8d;margin-top:2px;">
          温度: ${z.temperatureRange?.min}-${z.temperatureRange?.max}°C
          ${z.remark ? `· 备注: ${escapeHtml(z.remark)}` : ''}
        </div>
      </div>
    `).join('');
  }

  const content = `
    <div class="modal-header">
      <h3>导出记录快照</h3>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <p style="color:#7f8c8d;font-size:12px;margin-bottom:16px;">
      导出时间: ${formatTime(exp.exportedAt)} · 导出人: ${escapeHtml(exp.exportedBy)}
    </p>
    <div style="margin-bottom:16px;text-align:center;">
      <img src="${exp.relativePath}" style="max-width:100%;max-height:300px;border-radius:4px;border:1px solid #ecf0f1;">
    </div>
    <h4 style="margin-bottom:8px;">温区快照 (${exp.zoneCount || 0})</h4>
    ${zonesHtml || '<div style="color:#95a5a6;">无数据</div>'}
    ${exp.snapshot?.routes ? `
      <h4 style="margin:16px 0 8px;">路线快照 (${exp.snapshot.routes.length})</h4>
      ${exp.snapshot.routes.map(r => `
        <div style="padding:6px 0;border-bottom:1px dashed #ecf0f1;font-size:12px;">
          📍 ${escapeHtml(r.name)} · ${r.length?.toFixed(2)}m
          <span class="card-status ${statusClass(r.status)}" style="margin-left:6px;">${statusLabel(r.status)}</span>
        </div>
      `).join('')}
    ` : ''}
  `;

  showModal(content);
};

window.doExport = async function() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '导出中...';
  try {
    const res = await apiPost('/exports', { exporter: 'web用户' });
    if (res.success) {
      alert('导出成功！');
      renderExportsPage();
    } else {
      alert('导出失败: ' + (res.message || '未知错误'));
    }
  } catch (e) {
    alert('导出失败: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '导出截图';
  }
};

window.editZoneRemark = async function(zoneId) {
  const res = await apiGet('/zones/' + zoneId);
  if (!res.success) return;
  const zone = res.data.zone;

  const newRemark = prompt('请输入新的备注:', zone.remark || '');
  if (newRemark === null) return;

  const updateRes = await apiPut('/zones/' + zoneId, {
    remark: newRemark,
    operator: 'web用户'
  });

  if (updateRes.success) {
    alert('备注已更新');
    renderZoneDetail(zoneId);
  } else {
    alert('更新失败: ' + (updateRes.message || '未知错误'));
  }
};

window.recalcRoute = async function(routeId) {
  if (!confirm('确定重新计算路线长度？')) return;
  const res = await apiPost('/routes/' + routeId + '/recalculate', { operator: 'web用户' });
  if (res.success) {
    alert('长度已重新计算');
    renderRouteDetail(routeId);
  } else {
    alert('操作失败: ' + (res.message || '未知错误'));
  }
};

window.approveRoute = async function(routeId) {
  if (!confirm('确认客户复核通过？')) return;
  const res = await apiPost('/routes/' + routeId + '/complete-review', {
    approved: true,
    operator: 'web用户',
    remark: '客户复核通过'
  });
  if (res.success) {
    alert('复核通过');
    renderRouteDetail(routeId);
  }
};

window.rejectRoute = async function(routeId) {
  const remark = prompt('请输入拒绝原因:', '');
  if (remark === null) return;
  const res = await apiPost('/routes/' + routeId + '/complete-review', {
    approved: false,
    operator: 'web用户',
    remark
  });
  if (res.success) {
    alert('已标记为拒绝');
    renderRouteDetail(routeId);
  }
};

window.goTo3D = function(zoneId) {
  location.hash = '#/3d';
  setTimeout(() => {
    const el = document.querySelector(`[data-zone-id="${zoneId}"]`);
    if (el && el.click) el.click();
  }, 500);
};

window.seedDemoData = async function() {
  if (!confirm('将导入演示数据（CAD图层+温区+补录路线），是否继续？\n注意：不会清除现有数据。')) return;

  const sampleLayer = {
    name: '冷链库-一层-冷冻区',
    sourceFile: 'demo_cold_storage.dwg',
    zones: [
      { name: '冷冻A区-三维', temperatureRange: { min: -20, max: -15 }, color: '#3498db' }
    ]
  };

  const importRes = await apiPost('/layers/import', {
    layers: [sampleLayer],
    operator: '小陶'
  });

  if (importRes.success) {
    const layer = importRes.data.success?.[0];
    if (layer) {
      const zoneData = {
        name: '冷冻A区-三维',
        layerId: layer.id,
        bounds: { minX: 10, maxX: 40, minY: 10, maxY: 35, minZ: 0, maxZ: 8 },
        temperatureRange: { min: -20, max: -15 },
        color: '#3498db',
        remark: '',
        operator: '小陶'
      };
      const zoneRes = await apiPost('/zones', zoneData);
      const zone = zoneRes.zone || zoneRes.data?.zone;

      if (zone) {
        const routeRes = await apiPost('/routes', {
          name: '补录路线-冷冻A区外围',
          points: [
            { x: 10, y: 10, z: 0 },
            { x: 40, y: 10, z: 0 },
            { x: 40, y: 35, z: 0 },
            { x: 10, y: 35, z: 0 }
          ],
          linkedCADLayerId: layer.id,
          operator: '小陶'
        });

        const route = routeRes.data || routeRes.route;
        if (route?.id) {
          await apiPut('/zones/' + zone.id, { routeId: route.id, operator: '小陶' });
          await apiPost('/routes/' + route.id + '/mark-review', {
            operator: '小陶',
            reason: '补录路线未重新计算长度，标记待复核'
          });
        }
      }
    }

    alert('演示数据导入成功！\n已创建：CAD图层 × 1，温区 × 1，补录路线 × 1（待复核状态）\n\n可以走完整流程：\n1. 查看温区详情\n2. 查看补录路线并重新计算长度\n3. 客户复核通过\n4. 导出截图\n5. 3D视图点击回源');
    router();
  }
};

loadHeaderStats();
