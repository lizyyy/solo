class App {
  constructor() {
    this.system = null;
    this.lastExport = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.generateSampleData();
  }

  bindEvents() {
    document.getElementById('generateBtn').addEventListener('click', () => this.generateSampleData());
    document.getElementById('runBtn').addEventListener('click', () => this.runIrrigation());
    document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportResults());
    document.getElementById('consistencyBtn').addEventListener('click', () => this.checkConsistency());
    document.getElementById('viewScheduleBtn').addEventListener('click', () => this.viewSchedule());
    document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') this.closeModal();
    });
  }

  generateSampleData() {
    const plotCount = parseInt(document.getElementById('plotCount').value);
    const canalCount = parseInt(document.getElementById('canalCount').value);
    const totalWater = parseInt(document.getElementById('totalWater').value);

    this.system = DataGenerator.generateSampleData(plotCount, canalCount, totalWater);
    this.lastExport = null;
    this.render();
  }

  runIrrigation() {
    if (!this.system) return;

    const results = this.system.runIrrigation();
    this.render();
    this.showNotification('轮灌算法执行完成！');
  }

  reset() {
    if (!this.system) return;
    this.system.reset();
    this.render();
  }

  render() {
    this.renderMap();
    this.renderStats();
    this.renderCanalStats();
  }

  renderMap() {
    const mapElement = document.getElementById('map');
    mapElement.innerHTML = '';

    this.system.canals.forEach(canal => {
      const canalDiv = document.createElement('div');
      canalDiv.className = 'canal horizontal';
      canalDiv.style.left = `${canal.startX}px`;
      canalDiv.style.top = `${canal.startY - 4}px`;
      canalDiv.style.width = `${canal.endX - canal.startX}px`;
      mapElement.appendChild(canalDiv);

      const labelDiv = document.createElement('div');
      labelDiv.className = 'canal-label';
      labelDiv.style.left = `${canal.startX + 10}px`;
      labelDiv.style.top = `${canal.startY - 20}px`;
      labelDiv.textContent = `${canal.name} (${canal.capacity}m³)`;
      mapElement.appendChild(labelDiv);
    });

    this.system.plots.forEach(plot => {
      const plotDiv = document.createElement('div');
      plotDiv.className = 'plot';
      plotDiv.style.left = `${plot.x}px`;
      plotDiv.style.top = `${plot.y}px`;
      plotDiv.style.width = '60px';
      plotDiv.style.height = '60px';
      plotDiv.style.background = plot.status.color;
      plotDiv.innerHTML = `${CropTypes[plot.cropType].icon}`;
      plotDiv.title = `${plot.id} - ${CropTypes[plot.cropType].name}`;
      
      if (plot.irrigationOrder) {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'plot-order';
        orderDiv.textContent = plot.irrigationOrder;
        plotDiv.appendChild(orderDiv);
      }

      plotDiv.addEventListener('click', () => this.showPlotDetail(plot));
      mapElement.appendChild(plotDiv);
    });
  }

  renderStats() {
    const totalDemand = this.system.calculateTotalWaterDemand();
    const totalAvailable = this.system.calculateTotalCanalCapacity();
    const efficiency = totalDemand > 0 
      ? Math.min(100, Math.round((totalAvailable / totalDemand) * 100)) 
      : 0;

    document.getElementById('totalDemand').textContent = Math.round(totalDemand);
    document.getElementById('totalAvailable').textContent = Math.round(totalAvailable);
    document.getElementById('totalShortage').textContent = Math.round(this.system.totalWaterShortage);
    document.getElementById('irrigatedCount').textContent = this.system.irrigatedCount;
    document.getElementById('shortageCount').textContent = this.system.waterShortageCount;
    document.getElementById('efficiency').textContent = `${efficiency}%`;
  }

  renderCanalStats() {
    const canalList = document.getElementById('canalList');
    canalList.innerHTML = '';

    this.system.canals.forEach(canal => {
      const utilization = canal.getUtilizationRate();
      const canalItem = document.createElement('div');
      canalItem.className = 'canal-item';
      canalItem.innerHTML = `
        <div class="canal-item-header">
          <span class="canal-name">${canal.name}</span>
          <span class="canal-utilization">利用率: ${utilization.toFixed(1)}%</span>
        </div>
        <div class="canal-progress">
          <div class="canal-progress-bar" style="width: ${Math.min(100, utilization)}%"></div>
        </div>
        <div class="canal-info">
          <span>当前流量: ${canal.currentFlow.toFixed(1)} m³</span>
          <span>总容量: ${canal.capacity} m³</span>
          <span>服务地块: ${canal.connectedPlots.length} 个</span>
        </div>
      `;
      canalList.appendChild(canalItem);
    });
  }

  showPlotDetail(plot) {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
      <div class="plot-detail">
        <h4>${plot.id} - ${CropTypes[plot.cropType].name}</h4>
        <p><strong>面积:</strong> ${plot.area} 亩</p>
        <p><strong>坡度:</strong> ${plot.slope}%</p>
        <p><strong>海拔:</strong> ${plot.elevation} m</p>
        <p><strong>状态:</strong> ${plot.status.name}</p>
        <p><strong>基础需水量:</strong> ${plot.getWaterDemand().toFixed(1)} m³</p>
        <p><strong>坡度系数:</strong> ${plot.getSlopeFactor().toFixed(2)}</p>
        <p><strong>调整后需水量:</strong> ${plot.getAdjustedWaterDemand().toFixed(1)} m³</p>
        <p><strong>已分配水量:</strong> ${plot.allocatedWater.toFixed(1)} m³</p>
        <p><strong>缺水量:</strong> ${plot.waterShortage.toFixed(1)} m³</p>
        <p><strong>轮灌顺序:</strong> ${plot.irrigationOrder || '未分配'}</p>
        <p><strong>所属渠系:</strong> ${plot.connectedCanal ? plot.connectedCanal.name : '无'}</p>
      </div>
    `;
    document.getElementById('modalTitle').textContent = '地块详情';
    document.getElementById('modal').classList.remove('hidden');
  }

  viewSchedule() {
    if (!this.system.irrigationSchedule.length) {
      this.showNotification('请先运行轮灌算法！');
      return;
    }

    const modalBody = document.getElementById('modalBody');
    let tableHTML = `
      <table class="schedule-table">
        <thead>
          <tr>
            <th>顺序</th>
            <th>地块ID</th>
            <th>渠系</th>
            <th>分配水量(m³)</th>
            <th>缺水量(m³)</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
    `;

    this.system.irrigationSchedule.forEach(item => {
      const canal = this.system.canals.find(c => c.id === item.canalId);
      const statusKey = Object.keys(PlotStatus).find(key => PlotStatus[key].name === item.status.name);
      tableHTML += `
        <tr>
          <td>${item.order}</td>
          <td>${item.plotId}</td>
          <td>${canal ? canal.name : '-'}</td>
          <td>${item.waterAllocated.toFixed(1)}</td>
          <td>${item.waterShortage.toFixed(1)}</td>
          <td><span class="status-badge status-${statusKey}">${item.status.name}</span></td>
        </tr>
      `;
    });

    tableHTML += `
        </tbody>
      </table>
    `;

    modalBody.innerHTML = tableHTML;
    document.getElementById('modalTitle').textContent = '轮灌计划';
    document.getElementById('modal').classList.remove('hidden');
  }

  exportResults() {
    if (!this.system.irrigationSchedule.length) {
      this.showNotification('请先运行轮灌算法！');
      return;
    }

    const exportData = this.system.exportResults();
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `irrigation_results_${Date.now()}.json`;
    link.click();

    this.lastExport = exportData;
    this.showNotification('结果已导出！');
  }

  checkConsistency() {
    if (!this.lastExport) {
      this.showNotification('请先导出一次结果再进行一致性检查！');
      return;
    }

    const result = this.system.checkConsistency(this.lastExport);
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
      <div class="consistency-result ${result.consistent ? '' : 'inconsistent'}">
        <h4>${result.consistent ? '✅ 一致性检查通过' : '❌ 发现不一致'}</h4>
        <p>${result.message}</p>
      </div>
    `;

    document.getElementById('modalTitle').textContent = '一致性检查结果';
    document.getElementById('modal').classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4299e1;
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2000;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
