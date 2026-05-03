import { Warehouse, SKULocation, Order, RoutePoint, PickerRoute } from './models.js';
import { DataValidator } from './validator.js';
import { DataImporter } from './importer.js';
import { RoutePlanner } from './routePlanner.js';
import { Renderer2D } from './renderer2d.js';
import { ReportGenerator } from './reportGenerator.js';
import { LocalStorage } from './storage.js';

class WarehousePickerApp {
  constructor() {
    this.warehouse = null;
    this.skus = [];
    this.orders = [];
    this.selectedOrders = [];
    this.lastSimulationResult = null;
    this.editMode = false;
    this.currentView = '2d';
    
    this.renderer2D = null;
    this.storage = new LocalStorage();
    this.reportGenerator = new ReportGenerator();
    
    this.init();
  }

  async init() {
    this.bindEvents();
    this.loadSettings();
    
    try {
      await this.loadSampleData();
    } catch (err) {
      console.log('无法自动加载示例数据:', err);
    }
  }

  bindEvents() {
    document.getElementById('loadSamples').addEventListener('click', () => this.loadSampleData());
    document.getElementById('saveDraft').addEventListener('click', () => this.saveDraft());
    document.getElementById('loadDraft').addEventListener('click', () => this.loadDraft());
    
    document.getElementById('warehouseFile').addEventListener('change', (e) => this.handleWarehouseFile(e));
    document.getElementById('skuFile').addEventListener('change', (e) => this.handleSkuFile(e));
    document.getElementById('ordersFile').addEventListener('change', (e) => this.handleOrdersFile(e));
    
    document.getElementById('view2D').addEventListener('click', () => this.switchView('2d'));
    document.getElementById('view3D').addEventListener('click', () => this.switchView('3d'));
    document.getElementById('editMode').addEventListener('click', () => this.toggleEditMode());
    document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
    document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
    document.getElementById('resetView').addEventListener('click', () => this.resetView());
    
    document.getElementById('startSimulation').addEventListener('click', () => this.runSimulation());
    
    document.getElementById('exportMarkdown').addEventListener('click', () => this.exportReport('markdown'));
    document.getElementById('exportHTML').addEventListener('click', () => this.exportReport('html'));
    document.getElementById('previewReport').addEventListener('click', () => this.previewReport());
    document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
    
    window.addEventListener('resize', () => {
      if (this.renderer2D && this.warehouse) {
        this.renderer2D.resizeCanvas();
        this.renderer2D.render();
      }
    });
  }

  loadSettings() {
    const settings = this.storage.loadSettings();
    document.getElementById('pickerCount').value = settings.pickerCount || 1;
    document.getElementById('routeAlgorithm').value = settings.algorithm || 'nearest';
  }

  async loadSampleData() {
    try {
      const warehouseResponse = await fetch('data/warehouse.json');
      const warehouseData = await warehouseResponse.json();
      
      const warehouseValidation = DataValidator.validateWarehouse(warehouseData);
      if (!warehouseValidation.valid) {
        this.showStatus('warehouseStatus', '示例仓库数据校验失败', 'error');
        console.error(DataValidator.formatErrors(warehouseValidation.errors));
        return;
      }
      
      this.warehouse = new Warehouse(warehouseData);
      this.showStatus('warehouseStatus', '仓库数据加载成功', 'success');
      
      const skuResponse = await fetch('data/sku-locations.csv');
      const skuText = await skuResponse.text();
      const skuRawData = DataImporter.parseCSV(skuText);
      
      const skuValidation = DataValidator.validateSKUData(skuRawData);
      if (!skuValidation.valid) {
        this.showStatus('skuStatus', '示例SKU数据校验失败', 'error');
        console.error(DataValidator.formatErrors(skuValidation.errors));
        return;
      }
      
      this.skus = skuValidation.validatedData;
      this.showStatus('skuStatus', `SKU 数据加载成功 (${this.skus.length} 个)`, 'success');
      
      const ordersResponse = await fetch('data/orders.csv');
      const ordersText = await ordersResponse.text();
      const ordersRawData = DataImporter.parseCSV(ordersText);
      
      const ordersValidation = DataValidator.validateOrderData(ordersRawData);
      if (!ordersValidation.valid) {
        this.showStatus('ordersStatus', '示例订单数据校验失败', 'error');
        console.error(DataValidator.formatErrors(ordersValidation.errors));
        return;
      }
      
      this.orders = ordersValidation.validatedData;
      this.showStatus('ordersStatus', `订单数据加载成功 (${this.orders.length} 个)`, 'success');
      
      this.renderWarehouse();
      this.renderOrdersList();
      this.checkInventoryAlerts();
      
    } catch (err) {
      console.error('加载示例数据失败:', err);
      alert('加载示例数据失败: ' + err.message);
    }
  }

  async handleWarehouseFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const result = await DataImporter.importFromFile(file, 'warehouse');
      this.warehouse = result.warehouse;
      
      this.showStatus('warehouseStatus', '仓库数据加载成功', 'success');
      if (result.warnings && result.warnings.length > 0) {
        console.warn(DataValidator.formatWarnings(result.warnings));
      }
      
      this.renderWarehouse();
    } catch (err) {
      let message = '加载失败';
      if (err.type === 'validation' && err.errors) {
        message = DataValidator.formatErrors(err.errors);
      } else if (err.message) {
        message = err.message;
      }
      this.showStatus('warehouseStatus', message, 'error');
    }
  }

  async handleSkuFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const result = await DataImporter.importFromFile(file, 'sku');
      this.skus = result.skus;
      
      this.showStatus('skuStatus', `SKU 数据加载成功 (${this.skus.length} 个)`, 'success');
      if (result.warnings && result.warnings.length > 0) {
        console.warn(DataValidator.formatWarnings(result.warnings));
      }
      
      this.checkInventoryAlerts();
    } catch (err) {
      let message = '加载失败';
      if (err.type === 'validation' && err.errors) {
        message = DataValidator.formatErrors(err.errors);
      } else if (err.message) {
        message = err.message;
      }
      this.showStatus('skuStatus', message, 'error');
    }
  }

  async handleOrdersFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const result = await DataImporter.importFromFile(file, 'orders');
      this.orders = result.orders;
      this.selectedOrders = [];
      
      this.showStatus('ordersStatus', `订单数据加载成功 (${this.orders.length} 个)`, 'success');
      if (result.warnings && result.warnings.length > 0) {
        console.warn(DataValidator.formatWarnings(result.warnings));
      }
      
      this.renderOrdersList();
    } catch (err) {
      let message = '加载失败';
      if (err.type === 'validation' && err.errors) {
        message = DataValidator.formatErrors(err.errors);
      } else if (err.message) {
        message = err.message;
      }
      this.showStatus('ordersStatus', message, 'error');
    }
  }

  showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
  }

  renderWarehouse() {
    if (!this.warehouse) return;
    
    const canvas = document.getElementById('warehouseCanvas2D');
    if (!this.renderer2D) {
      this.renderer2D = new Renderer2D(canvas);
      this.renderer2D.startAnimation();
    }
    
    this.renderer2D.setWarehouse(this.warehouse);
  }

  renderOrdersList() {
    const container = document.getElementById('ordersList');
    
    if (this.orders.length === 0) {
      container.innerHTML = '<p class="no-data">请先导入订单数据</p>';
      return;
    }
    
    container.innerHTML = this.orders.map(order => `
      <div class="order-item ${order.selected ? 'selected' : ''}" data-order-id="${order.orderId}">
        <div class="order-id">${order.orderId}</div>
        <div class="order-info">
          ${order.customerName || '未知客户'} | ${order.items.length} 种商品 | ${order.getTotalQuantity()} 件
        </div>
      </div>
    `).join('');
    
    container.querySelectorAll('.order-item').forEach(item => {
      item.addEventListener('click', () => {
        const orderId = item.dataset.orderId;
        const order = this.orders.find(o => o.orderId === orderId);
        if (order) {
          order.selected = !order.selected;
          item.classList.toggle('selected', order.selected);
          
          this.selectedOrders = this.orders.filter(o => o.selected);
        }
      });
    });
  }

  checkInventoryAlerts() {
    const container = document.getElementById('inventoryAlerts');
    
    const lowStockSKUs = this.skus.filter(sku => sku.isLowStock());
    
    if (lowStockSKUs.length === 0) {
      container.innerHTML = '<p class="no-data">暂无预警</p>';
      return;
    }
    
    container.innerHTML = lowStockSKUs.map(sku => `
      <div class="alert-item ${sku.quantity === 0 ? 'error' : 'warning'}">
        <h4>${sku.skuName || sku.skuCode}</h4>
        <p>货位: ${sku.location} | 库存: ${sku.quantity}/${sku.reorderThreshold}</p>
      </div>
    `).join('');
  }

  switchView(view) {
    this.currentView = view;
    
    const btn2D = document.getElementById('view2D');
    const btn3D = document.getElementById('view3D');
    const canvas2D = document.getElementById('warehouseCanvas2D');
    const view3D = document.getElementById('warehouseView3D');
    
    if (view === '2d') {
      btn2D.classList.add('active');
      btn3D.classList.remove('active');
      canvas2D.classList.remove('hidden');
      view3D.classList.add('hidden');
    } else {
      btn2D.classList.remove('active');
      btn3D.classList.add('active');
      canvas2D.classList.add('hidden');
      view3D.classList.remove('hidden');
      this.render3DView();
    }
  }

  render3DView() {
    const container = document.getElementById('view3DContent');
    if (!this.warehouse) {
      container.innerHTML = '<p class="no-data">请先加载仓库数据</p>';
      return;
    }
    
    const scale = 30;
    const offsetX = 50;
    const offsetY = 50;
    
    let html = `
      <div class="view3d-perspective">
        <div class="view3d-scene" style="width: ${this.warehouse.dimensions.width * scale}px; height: ${this.warehouse.dimensions.height * scale}px;">
          <div class="view3d-floor" style="
            width: ${this.warehouse.dimensions.width * scale}px;
            height: ${this.warehouse.dimensions.height * scale}px;
            left: 0;
            top: 0;
          "></div>
    `;
    
    this.warehouse.aisles.forEach(aisle => {
      html += `
        <div class="view3d-aisle" style="
          left: ${offsetX + aisle.x * scale}px;
          top: ${offsetY + aisle.y * scale}px;
          width: ${aisle.width * scale}px;
          height: ${aisle.depth * scale}px;
        "></div>
      `;
    });
    
    this.warehouse.shelves.forEach(shelf => {
      const x = offsetX + shelf.x * scale;
      const y = offsetY + shelf.y * scale;
      const w = shelf.width * scale;
      const h = shelf.depth * scale;
      
      html += `
        <div class="view3d-shelf" style="left: ${x}px; top: ${y}px;">
          <div class="view3d-shelf-top" style="width: ${w}px; height: ${h}px;"></div>
          <div class="view3d-shelf-front" style="width: ${w}px; height: 40px; top: ${h}px;"></div>
        </div>
      `;
    });
    
    this.warehouse.packingStations.forEach(station => {
      const x = offsetX + station.x * scale;
      const y = offsetY + station.y * scale;
      const w = station.width * scale;
      const h = station.depth * scale;
      
      html += `
        <div class="view3d-packing" style="
          left: ${x}px;
          top: ${y}px;
          width: ${w}px;
          height: ${h}px;
          opacity: ${station.isPrimary ? 1 : 0.7};
        "></div>
      `;
    });
    
    if (this.lastSimulationResult && this.lastSimulationResult.routes) {
      this.lastSimulationResult.routes.forEach((route, routeIndex) => {
        const colors = ['#2196f3', '#9c27b0', '#ff9800', '#4caf50'];
        const color = colors[routeIndex % colors.length];
        
        route.points.forEach(point => {
          const x = offsetX + point.x * scale - 5;
          const y = offsetY + point.y * scale - 5;
          
          html += `
            <div class="view3d-route" style="
              left: ${x}px;
              top: ${y}px;
              width: 10px;
              height: 10px;
              background: ${color};
            "></div>
          `;
        });
      });
    }
    
    if (this.lastSimulationResult && this.lastSimulationResult.hotspots) {
      this.lastSimulationResult.hotspots.forEach(hotspot => {
        const x = offsetX + hotspot.x * scale - 8;
        const y = offsetY + hotspot.y * scale - 8;
        
        html += `
          <div class="view3d-hotspot" style="
            left: ${x}px;
            top: ${y}px;
            width: 16px;
            height: 16px;
          "></div>
        `;
      });
    }
    
    html += `
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    const btn = document.getElementById('editMode');
    btn.textContent = this.editMode ? '✓ 保存编辑' : '✏️ 编辑模式';
    btn.classList.toggle('btn-primary', this.editMode);
    btn.classList.toggle('btn-secondary', !this.editMode);
    
    if (this.renderer2D) {
      this.renderer2D.setEditMode(this.editMode);
    }
  }

  zoomIn() {
    if (this.renderer2D) {
      this.renderer2D.zoomIn();
    }
  }

  zoomOut() {
    if (this.renderer2D) {
      this.renderer2D.zoomOut();
    }
  }

  resetView() {
    if (this.renderer2D) {
      this.renderer2D.resetView();
    }
  }

  runSimulation() {
    if (!this.warehouse) {
      alert('请先加载仓库数据');
      return;
    }
    
    if (this.skus.length === 0) {
      alert('请先加载 SKU 货位数据');
      return;
    }
    
    const ordersToProcess = this.selectedOrders.length > 0 ? this.selectedOrders : this.orders;
    
    if (ordersToProcess.length === 0) {
      alert('请先导入或选择订单');
      return;
    }
    
    const pickerCount = parseInt(document.getElementById('pickerCount').value);
    const algorithm = document.getElementById('routeAlgorithm').value;
    
    const planner = new RoutePlanner(this.warehouse, this.skus, ordersToProcess);
    
    const inventoryCheck = planner.checkInventory(ordersToProcess);
    
    const result = planner.planMultiPickerRoutes(ordersToProcess, pickerCount, algorithm);
    
    result.inventoryCheck = inventoryCheck;
    
    this.lastSimulationResult = result;
    this.storage.saveLastSimulation(result);
    
    if (this.renderer2D) {
      this.renderer2D.setRoutes(result.routes);
      this.renderer2D.setHotspots(result.hotspots);
    }
    
    this.updateRouteAnalysis(result);
    this.updateHotspotAnalysis(result.hotspots);
    this.updateOptimizationSuggestions(result.suggestions);
    
    if (this.currentView === '3d') {
      this.render3DView();
    }
  }

  updateRouteAnalysis(result) {
    const container = document.getElementById('routeAnalysis');
    const { analysis, routes } = result;
    
    if (!analysis) {
      container.innerHTML = '<p class="no-data">分析失败</p>';
      return;
    }
    
    let html = `
      <div class="route-stats">
        <div class="stat">
          <div class="num">${analysis.totalDistance}</div>
          <div class="label">总距离 (米)</div>
        </div>
        <div class="stat">
          <div class="num">${analysis.avgDistancePerPicker}</div>
          <div class="label">人均距离 (米)</div>
        </div>
        <div class="stat">
          <div class="num">${(analysis.backtrackRatio * 100).toFixed(0)}%</div>
          <div class="label">折返率</div>
        </div>
        <div class="stat">
          <div class="num">${analysis.uniqueShelvesVisited}</div>
          <div class="label">访问货架数</div>
        </div>
      </div>
    `;
    
    if (routes && routes.length > 0) {
      html += '<h4 style="margin-top: 16px; margin-bottom: 8px;">各拣货员路线</h4>';
      
      routes.forEach((route, index) => {
        html += `
          <div class="picker-route">
            <h4>拣货员 ${index + 1}</h4>
            <div class="route-details">
              <span>📏 ${route.totalDistance.toFixed(1)} 米</span>
              <span>📦 ${route.visitedShelves ? Array.from(route.visitedShelves).length : 0} 个货架</span>
              <span>📋 ${route.assignedOrders ? route.assignedOrders.length : 0} 个订单</span>
            </div>
          </div>
        `;
      });
    }
    
    container.innerHTML = html;
  }

  updateHotspotAnalysis(hotspots) {
    const container = document.getElementById('hotspotAnalysis');
    
    if (!hotspots || hotspots.length === 0) {
      container.innerHTML = '<p class="no-data">✅ 未发现明显堵点</p>';
      return;
    }
    
    container.innerHTML = hotspots.map((hotspot, index) => `
      <div class="hotspot-item">
        <h4>${hotspot.severity === 'high' ? '🔴 高风险' : '🟡 中风险'} - ${hotspot.name || '拣货点'}</h4>
        <p>${hotspot.description}</p>
        <p style="font-size: 0.75rem; color: #888; margin-top: 4px;">
          位置: (${hotspot.x.toFixed(1)}, ${hotspot.y.toFixed(1)})
          ${hotspot.trafficCount ? `| 通行: ${hotspot.trafficCount} 次` : ''}
          ${hotspot.pickCount ? `| 拣货: ${hotspot.pickCount} 次` : ''}
        </p>
      </div>
    `).join('');
  }

  updateOptimizationSuggestions(suggestions) {
    const container = document.getElementById('optimizationSuggestions');
    
    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '<p class="no-data">✅ 暂无优化建议</p>';
      return;
    }
    
    container.innerHTML = suggestions.map((sug, index) => {
      if (sug.type === 'reorder') {
        return `
          <div class="suggestion-item" style="border-left-color: #ff9800; background: #fff3e0;">
            <h4>📦 补货建议: ${sug.skuName || sug.skuCode}</h4>
            <p>${sug.reason}</p>
            <p style="font-size: 0.75rem; color: #e65100; margin-top: 4px;">
              当前货位: ${sug.currentLocation}
            </p>
          </div>
        `;
      } else {
        return `
          <div class="suggestion-item">
            <h4>📍 货位调整: ${sug.skuName || sug.skuCode}</h4>
            <p>${sug.reason}</p>
            <p style="font-size: 0.75rem; color: #2e7d32; margin-top: 4px;">
              建议: ${sug.currentLocation} → ${sug.suggestedLocation}
              ${sug.estimatedSaving > 0 ? `| 预计节省: 约 ${sug.estimatedSaving} 米/天` : ''}
            </p>
          </div>
        `;
      }
    }).join('');
  }

  getReportData() {
    return {
      warehouse: this.warehouse,
      selectedOrders: this.selectedOrders.length > 0 ? this.selectedOrders : this.orders,
      analysis: this.lastSimulationResult?.analysis,
      hotspots: this.lastSimulationResult?.hotspots,
      suggestions: this.lastSimulationResult?.suggestions,
      inventoryCheck: this.lastSimulationResult?.inventoryCheck
    };
  }

  exportReport(format) {
    if (!this.lastSimulationResult) {
      alert('请先运行路线模拟');
      return;
    }
    
    const data = this.getReportData();
    
    if (format === 'markdown') {
      this.reportGenerator.downloadMarkdown(data);
    } else {
      this.reportGenerator.downloadHTML(data);
    }
  }

  previewReport() {
    if (!this.lastSimulationResult) {
      alert('请先运行路线模拟');
      return;
    }
    
    const data = this.getReportData();
    const htmlContent = this.reportGenerator.generateHTML(data);
    
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = htmlContent.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*?$/, '');
    
    document.getElementById('reportModal').classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('reportModal').classList.add('hidden');
  }

  saveDraft() {
    const result = this.storage.saveDraft({
      warehouse: this.warehouse,
      skus: this.skus,
      orders: this.orders,
      selectedOrderIds: this.selectedOrders.map(o => o.orderId)
    });
    
    if (result.success) {
      alert('草稿保存成功！\n时间: ' + new Date(result.timestamp).toLocaleString('zh-CN'));
    } else {
      alert('保存失败: ' + result.error);
    }
  }

  loadDraft() {
    const result = this.storage.loadDraft();
    
    if (!result.success) {
      alert('加载失败: ' + result.error);
      return;
    }
    
    const draft = result.data;
    
    if (draft.warehouse) {
      this.warehouse = new Warehouse(draft.warehouse);
      this.showStatus('warehouseStatus', '仓库数据已恢复', 'success');
    }
    
    if (draft.skus && draft.skus.length > 0) {
      this.skus = draft.skus.map(s => new SKULocation(s));
      this.showStatus('skuStatus', `SKU 数据已恢复 (${this.skus.length} 个)`, 'success');
    }
    
    if (draft.orders && draft.orders.length > 0) {
      this.orders = draft.orders.map(o => {
        const order = new Order(o);
        if (o.items) {
          o.items.forEach(item => order.addItem(item));
        }
        return order;
      });
      
      if (draft.selectedOrderIds && draft.selectedOrderIds.length > 0) {
        this.orders.forEach(order => {
          order.selected = draft.selectedOrderIds.includes(order.orderId);
        });
        this.selectedOrders = this.orders.filter(o => o.selected);
      }
      
      this.showStatus('ordersStatus', `订单数据已恢复 (${this.orders.length} 个)`, 'success');
    }
    
    this.renderWarehouse();
    this.renderOrdersList();
    this.checkInventoryAlerts();
    
    alert('草稿加载成功！\n保存时间: ' + new Date(draft.timestamp).toLocaleString('zh-CN'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new WarehousePickerApp();
});
