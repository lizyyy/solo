class App {
  constructor() {
    this.products = new Map();
    this.boxTypes = new Map();
    this.orders = new Map();
    this.reports = [];
    this.constraintEngine = new ConstraintEngine();
    this.exporter = new ReportExporter('standard');
    this._initSampleData();
    this._bindEvents();
    this._render();
  }

  _initSampleData() {
    const boxes = [
      { id: 'BX-S', name: '小箱', innerLength: 200, innerWidth: 150, innerHeight: 150, maxWeight: 5000 },
      { id: 'BX-M', name: '中箱', innerLength: 300, innerWidth: 200, innerHeight: 200, maxWeight: 10000 },
      { id: 'BX-L', name: '大箱', innerLength: 400, innerWidth: 300, innerHeight: 300, maxWeight: 20000 },
      { id: 'BX-XL', name: '特大箱', innerLength: 500, innerWidth: 400, innerHeight: 400, maxWeight: 30000 },
    ];
    boxes.forEach(b => this.boxTypes.set(b.id, new BoxType(b)));

    const products = [
      { id: 'P001', name: '陶瓷茶杯', length: 80, width: 80, height: 95, weight: 280, fragile: true },
      { id: 'P002', name: '书本', length: 210, width: 148, height: 20, weight: 350, fragile: false },
      { id: 'P003', name: '玻璃花瓶', length: 120, width: 120, height: 250, weight: 800, fragile: true },
      { id: 'P004', name: 'T恤', length: 250, width: 200, height: 30, weight: 180, fragile: false },
      { id: 'P005', name: '铁质工具箱', length: 350, width: 150, height: 120, weight: 3500, fragile: false },
      { id: 'P006', name: '塑料收纳盒', length: 180, width: 130, height: 80, weight: 200, fragile: false },
    ];
    products.forEach(p => this.products.set(p.id, new Product(p)));
  }

  _bindEvents() {
    document.getElementById('btn-add-product').addEventListener('click', () => this._addProduct());
    document.getElementById('btn-add-box').addEventListener('click', () => this._addBoxType());
    document.getElementById('btn-pack').addEventListener('click', () => this._runPacking());
    document.getElementById('btn-export-csv').addEventListener('click', () => this._exportCSV());
    document.getElementById('btn-export-json').addEventListener('click', () => this._exportJSON());
    document.getElementById('sel-box').addEventListener('change', () => this._render());
    document.getElementById('sel-order').addEventListener('change', () => this._updateOrderItems());
    document.getElementById('btn-add-order').addEventListener('click', () => this._addOrder());
    document.getElementById('btn-add-item').addEventListener('click', () => this._addOrderItem());
    document.getElementById('toggle-perm').addEventListener('change', (e) => this._togglePermission(e));
    document.getElementById('btn-clear-items').addEventListener('click', () => this._clearOrderItems());
  }

  _addProduct() {
    const f = document.getElementById('product-form');
    const data = {
      id: f.querySelector('[name="id"]').value.trim(),
      name: f.querySelector('[name="name"]').value.trim(),
      length: Number(f.querySelector('[name="length"]').value),
      width: Number(f.querySelector('[name="width"]').value),
      height: Number(f.querySelector('[name="height"]').value),
      weight: Number(f.querySelector('[name="weight"]').value),
      fragile: f.querySelector('[name="fragile"]').checked,
    };
    if (!data.id || !data.name || data.length <= 0 || data.width <= 0 || data.height <= 0 || data.weight < 0) {
      this._log('err', '商品数据不完整或无效，请检查所有字段');
      return;
    }
    try {
      const p = new Product(data);
      this.products.set(p.id, p);
      f.reset();
      this._log('ok', `商品 ${p.name}(${p.id}) 已添加 [来源: 商品主数据]`);
      this._render();
    } catch (e) {
      this._log('err', e.message);
    }
  }

  _addBoxType() {
    const f = document.getElementById('box-form');
    const data = {
      id: f.querySelector('[name="id"]').value.trim(),
      name: f.querySelector('[name="name"]').value.trim(),
      innerLength: Number(f.querySelector('[name="innerLength"]').value),
      innerWidth: Number(f.querySelector('[name="innerWidth"]').value),
      innerHeight: Number(f.querySelector('[name="innerHeight"]').value),
      maxWeight: Number(f.querySelector('[name="maxWeight"]').value),
    };
    if (!data.id || !data.name || data.innerLength <= 0 || data.innerWidth <= 0 || data.innerHeight <= 0 || data.maxWeight <= 0) {
      this._log('err', '箱型数据不完整或无效，请检查所有字段');
      return;
    }
    try {
      const b = new BoxType(data);
      this.boxTypes.set(b.id, b);
      f.reset();
      this._log('ok', `箱型 ${b.name}(${b.id}) 已添加 [来源: 箱型主数据]`);
      this._render();
    } catch (e) {
      this._log('err', e.message);
    }
  }

  _addOrder() {
    const orderId = document.getElementById('order-id').value.trim();
    if (!orderId) { this._log('err', '请输入订单ID'); return; }
    const items = this._collectOrderItems();
    if (items.length === 0) { this._log('err', '请至少添加一个商品行'); return; }
    const order = new Order({ id: orderId, items });
    this.orders.set(order.id, order);
    this._log('ok', `订单 ${order.id} 已创建，含 ${order.totalQuantity()} 件商品 [来源: 订单数据]`);
    document.getElementById('order-id').value = '';
    this._render();
  }

  _addOrderItem() {
    const list = document.getElementById('order-items-list');
    const row = document.createElement('div');
    row.className = 'order-item-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:6px;';
    row.innerHTML = `
      <select name="item-product" style="flex:2">${this._productOptions()}</select>
      <input type="number" name="item-qty" value="1" min="1" style="flex:1;width:60px;" />
      <button class="btn btn-sm btn-danger remove-item" type="button">✕</button>
    `;
    row.querySelector('.remove-item').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  _clearOrderItems() {
    document.getElementById('order-items-list').innerHTML = '';
  }

  _collectOrderItems() {
    const rows = document.querySelectorAll('.order-item-row');
    const items = [];
    rows.forEach(r => {
      const productId = r.querySelector('[name="item-product"]').value;
      const quantity = Number(r.querySelector('[name="item-qty"]').value) || 1;
      if (productId && quantity > 0) items.push({ productId, quantity });
    });
    return items;
  }

  _updateOrderItems() {
    const orderId = document.getElementById('sel-order').value;
    const order = this.orders.get(orderId);
    if (!order) return;
    const list = document.getElementById('order-items-list');
    list.innerHTML = '';
    for (const item of order.items) {
      const row = document.createElement('div');
      row.className = 'order-item-row';
      row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:6px;';
      row.innerHTML = `
        <select name="item-product" style="flex:2">${this._productOptions(item.productId)}</select>
        <input type="number" name="item-qty" value="${item.quantity}" min="1" style="flex:1;width:60px;" />
        <button class="btn btn-sm btn-danger remove-item" type="button">✕</button>
      `;
      row.querySelector('.remove-item').addEventListener('click', () => row.remove());
      list.appendChild(row);
    }
  }

  _productOptions(selectedId) {
    let html = '<option value="">-- 选择商品 --</option>';
    for (const [id, p] of this.products) {
      const sel = id === selectedId ? ' selected' : '';
      html += `<option value="${id}"${sel}>${p.name} (${p.length}×${p.width}×${p.height}${UNIT.LENGTH}, ${p.weight}${UNIT.WEIGHT}${p.fragile ? ' ⚠易碎' : ''})</option>`;
    }
    return html;
  }

  _runPacking() {
    const boxId = document.getElementById('sel-box').value;
    if (!boxId) { this._log('err', '请选择箱型'); return; }

    const boxType = this.boxTypes.get(boxId);
    if (!boxType) { this._log('err', '箱型不存在'); return; }

    const items = this._collectOrderItems();
    if (items.length === 0) { this._log('err', '请添加至少一个商品行'); return; }

    const packItems = [];
    for (const item of items) {
      const product = this.products.get(item.productId);
      if (!product) {
        this._log('warn', `商品 ${item.productId} 不存在，已跳过`);
        continue;
      }
      packItems.push({ product, quantity: item.quantity });
    }

    if (packItems.length === 0) { this._log('err', '无有效商品可装箱'); return; }

    this.constraintEngine.reset();
    const packer = new BinPacker(boxType, this.constraintEngine);
    const report = packer.pack(packItems);

    const orderId = document.getElementById('sel-order').value || null;
    report.orderId = orderId;

    this.reports.push(report);
    this._currentReport = report;

    this._log('ok', `装箱完成: ${report.id} | 状态: ${PACK_STATUS_LABEL[report.status]} | 装入: ${report.placements.length} | 未装: ${report.unpackedItems.length} | 体积利用率: ${(report.utilization * 100).toFixed(1)}% | 重量利用率: ${(report.weightUtilization * 100).toFixed(1)}% [来源: 装箱报告]`);

    for (const f of report.failures) {
      this._log('warn', `失败: ${f.message}`);
    }

    this._renderResults();
  }

  _exportCSV() {
    if (!this._currentReport) { this._log('err', '请先执行装箱'); return; }
    this.exporter.downloadCSV(this._currentReport);
    this._log('ok', `CSV报告已导出: ${this._currentReport.id}`);
  }

  _exportJSON() {
    if (!this._currentReport) { this._log('err', '请先执行装箱'); return; }
    this.exporter.downloadJSON(this._currentReport);
    this._log('ok', `JSON报告已导出: ${this._currentReport.id}`);
  }

  _togglePermission(e) {
    const level = e.target.checked ? 'admin' : 'standard';
    this.exporter = new ReportExporter(level);
    document.querySelector('.perm-badge').textContent = level === 'admin' ? '管理员' : '标准';
    this._log('ok', `权限切换为: ${level}`);
    if (this._currentReport) this._renderResults();
  }

  _log(type, msg) {
    const area = document.getElementById('log-area');
    if (!area) return;
    const cls = type === 'err' ? 'log-err' : type === 'warn' ? 'log-warn' : 'log-ok';
    const ts = new Date().toLocaleTimeString();
    area.innerHTML += `<div class="${cls}">[${ts}] ${msg}</div>`;
    area.scrollTop = area.scrollHeight;
  }

  _render() {
    this._renderBoxSelect();
    this._renderOrderSelect();
    this._renderProductTable();
    this._renderBoxTable();
  }

  _renderBoxSelect() {
    const sel = document.getElementById('sel-box');
    const current = sel.value;
    sel.innerHTML = '<option value="">-- 选择箱型 --</option>';
    for (const [id, b] of this.boxTypes) {
      sel.innerHTML += `<option value="${id}">${b.name} (${b.innerLength}×${b.innerWidth}×${b.innerHeight}${UNIT.LENGTH}, 承重${b.maxWeight}${UNIT.WEIGHT})</option>`;
    }
    if (current) sel.value = current;
  }

  _renderOrderSelect() {
    const sel = document.getElementById('sel-order');
    const current = sel.value;
    sel.innerHTML = '<option value="">-- 自由模式 --</option>';
    for (const [id, o] of this.orders) {
      sel.innerHTML += `<option value="${id}">${id} (${o.totalQuantity()}件)</option>`;
    }
    if (current) sel.value = current;
  }

  _renderProductTable() {
    const tbody = document.getElementById('product-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [id, p] of this.products) {
      const mp = this.exporter._maskIfNeeded(p);
      tbody.innerHTML += `<tr>
        <td>${mp.id}</td><td>${mp.name}</td>
        <td>${p.length}×${p.width}×${p.height} ${UNIT.LENGTH}</td>
        <td>${p.weight} ${UNIT.WEIGHT}</td>
        <td>${p.fragile ? '<span class="badge badge-fragile">易碎</span>' : '—'}</td>
        <td>${p.allowedRotations.length}/6</td>
      </tr>`;
    }
  }

  _renderBoxTable() {
    const tbody = document.getElementById('box-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const [id, b] of this.boxTypes) {
      const mb = this.exporter._maskIfNeeded(b);
      tbody.innerHTML += `<tr>
        <td>${mb.id}</td><td>${mb.name}</td>
        <td>${b.innerLength}×${b.innerWidth}×${b.innerHeight} ${UNIT.LENGTH}</td>
        <td>${b.maxWeight} ${UNIT.WEIGHT}</td>
        <td>${(b.innerVolume() / 1e6).toFixed(2)} L</td>
      </tr>`;
    }
  }

  _renderResults() {
    const r = this._currentReport;
    if (!r) return;

    document.getElementById('stat-placed').textContent = r.placements.length;
    document.getElementById('stat-unpacked').textContent = r.unpackedItems.length;
    document.getElementById('stat-vol').textContent = (r.utilization * 100).toFixed(1) + '%';
    document.getElementById('stat-wt').textContent = (r.weightUtilization * 100).toFixed(1) + '%';
    document.getElementById('stat-weight').textContent = r.totalWeight + UNIT.WEIGHT;

    const statusEl = document.getElementById('stat-status');
    const badgeCls = r.status === PACK_STATUS.SUCCESS ? 'badge-success' : r.unpackedItems.length > 0 ? 'badge-danger' : 'badge-warn';
    statusEl.innerHTML = `<span class="badge ${badgeCls}">${PACK_STATUS_LABEL[r.status]}</span>`;

    this._renderPlacementTable(r);
    this._renderFailures(r);
    this._renderVisualization(r);
  }

  _renderPlacementTable(report) {
    const tbody = document.getElementById('placement-tbody');
    tbody.innerHTML = '';
    for (const p of report.placements) {
      const mp = this.exporter._maskIfNeeded(p);
      tbody.innerHTML += `<tr>
        <td>${mp.productId}</td><td>${mp.productName}</td>
        <td>(${p.position.x}, ${p.position.y}, ${p.position.z})</td>
        <td>${p.dimensions.dx}×${p.dimensions.dy}×${p.dimensions.dz}</td>
        <td>${ROTATION_MAP[p.rotation] ? ROTATION_MAP[p.rotation].label : p.rotation}</td>
        <td>${p.fragile ? '<span class="badge badge-fragile">易碎</span>' : '—'}</td>
        <td>${p.weight}${UNIT.WEIGHT}</td>
      </tr>`;
    }
  }

  _renderFailures(report) {
    const div = document.getElementById('failures-area');
    div.innerHTML = '';
    if (report.failures.length === 0) {
      div.innerHTML = '<div class="empty-msg">无失败项</div>';
      return;
    }
    for (const f of report.failures) {
      div.innerHTML += `<div class="failure-item"><span class="status-code">[${PACK_STATUS_LABEL[f.status]}]</span> ${f.message}</div>`;
    }
  }

  _renderVisualization(report) {
    const canvas = document.getElementById('viz-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const box = this.boxTypes.get(report.boxTypeId);
    if (!box) return;

    const w = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    const h = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    ctx.clearRect(0, 0, cw, ch);

    const scale = Math.min((cw - 40) / box.innerLength, (ch - 40) / box.innerHeight);
    const ox = 20;
    const oy = ch - 20;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy - box.innerHeight * scale, box.innerLength * scale, box.innerHeight * scale);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    let ci = 0;

    for (const p of report.placements) {
      const sx = ox + p.position.x * scale;
      const sy = oy - (p.position.z + p.dimensions.dz) * scale;
      const sw = p.dimensions.dx * scale;
      const sh = p.dimensions.dz * scale;

      ctx.fillStyle = p.fragile ? '#fecdd3' : colors[ci % colors.length] + '40';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = p.fragile ? '#e11d48' : colors[ci % colors.length];
      ctx.lineWidth = p.fragile ? 2 : 1;
      ctx.strokeRect(sx, sy, sw, sh);

      if (sw > 20 && sh > 12) {
        ctx.fillStyle = p.fragile ? '#e11d48' : '#1a1d23';
        ctx.font = '10px sans-serif';
        ctx.fillText(p.productName.slice(0, 4), sx + 3, sy + 12);
      }

      ci++;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
