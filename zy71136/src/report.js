export class ReportExporter {
  constructor(app) {
    this.app = app
  }
  
  export() {
    if (!this.app.data) {
      alert('请先加载数据')
      return
    }
    
    const reportData = this.collectReportData()
    const reportHTML = this.generateReportHTML(reportData)
    this.downloadReport(reportHTML, reportData)
  }
  
  collectReportData() {
    const camera = this.app.camera
    const controls = this.app.controls
    
    return {
      timestamp: new Date().toISOString(),
      currentTime: this.app.currentTime,
      formattedTime: this.formatTime(this.app.currentTime),
      view: {
        type: this.app.currentView,
        cameraPosition: {
          x: camera.position.x.toFixed(2),
          y: camera.position.y.toFixed(2),
          z: camera.position.z.toFixed(2)
        },
        targetPosition: {
          x: controls.target.x.toFixed(2),
          y: controls.target.y.toFixed(2),
          z: controls.target.z.toFixed(2)
        }
      },
      filters: { ...this.app.vehicleFilters },
      vehicles: this.collectVehicleData(),
      conflicts: this.app.conflictDetector.getConflicts(),
      flights: this.app.data.flights || [],
      summary: {
        totalVehicles: this.app.data.vehicles.length,
        visibleVehicles: this.app.vehicleManager.getVehicles().filter(v => v.mesh.visible).length,
        totalConflicts: this.app.conflictDetector.getConflicts().length,
        highSeverityConflicts: this.app.conflictDetector.getConflicts().filter(c => c.severity === 'high').length,
        duration: this.app.data.duration
      }
    }
  }
  
  collectVehicleData() {
    return this.app.vehicleManager.getVehicles().map(vehicle => {
      const currentPos = vehicle.mesh.position
      const schedule = vehicle.schedule
      const status = this.getVehicleStatus(vehicle, this.app.currentTime)
      
      return {
        id: vehicle.id,
        name: vehicle.name,
        type: vehicle.type,
        typeName: this.getTypeName(vehicle.type),
        visible: vehicle.mesh.visible,
        position: {
          x: currentPos.x.toFixed(2),
          z: currentPos.z.toFixed(2)
        },
        schedule: {
          start: this.formatTime(schedule.start),
          end: this.formatTime(schedule.end)
        },
        status: status,
        progress: this.getVehicleProgress(vehicle, this.app.currentTime)
      }
    })
  }
  
  getVehicleStatus(vehicle, currentTime) {
    const schedule = vehicle.schedule
    if (currentTime < schedule.start) return '待出发'
    if (currentTime > schedule.end) return '已完成'
    return '进行中'
  }
  
  getVehicleProgress(vehicle, currentTime) {
    const schedule = vehicle.schedule
    if (currentTime < schedule.start) return 0
    if (currentTime > schedule.end) return 100
    return Math.round(((currentTime - schedule.start) / (schedule.end - schedule.start)) * 100)
  }
  
  getTypeName(type) {
    const names = {
      ferry: '摆渡车',
      fuel: '油车',
      baggage: '行李车'
    }
    return names[type] || type
  }
  
  formatTime(time) {
    const mins = Math.floor(time)
    const secs = Math.floor((time - mins) * 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  generateReportHTML(data) {
    const conflictTypeNames = {
      restricted_zone: '禁区穿越',
      vehicle_collision: '车辆碰撞',
      delay_path: '延误路径未更新'
    }
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>机场地勤车辆路径报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; padding: 40px; }
    .report-container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
    .report-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 40px; }
    .report-header h1 { font-size: 28px; margin-bottom: 10px; }
    .report-header .subtitle { opacity: 0.9; font-size: 14px; }
    .report-content { padding: 40px; }
    .section { margin-bottom: 30px; }
    .section h2 { font-size: 20px; color: #2d3748; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .stat-card { background: #f7fafc; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card .value { font-size: 32px; font-weight: bold; color: #667eea; }
    .stat-card .label { font-size: 12px; color: #718096; margin-top: 5px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .info-box { background: #f7fafc; padding: 15px; border-radius: 8px; }
    .info-box h3 { font-size: 14px; color: #4a5568; margin-bottom: 10px; }
    .info-box p { font-size: 13px; color: #2d3748; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    th { background: #f7fafc; font-weight: 600; color: #4a5568; }
    tr:hover { background: #f7fafc; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-active { background: #d1fae5; color: #065f46; }
    .status-done { background: #dbeafe; color: #1e40af; }
    .conflict-high { border-left: 4px solid #e53e3e; }
    .conflict-medium { border-left: 4px solid #ed8936; }
    .progress-bar { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; transition: width 0.3s; }
    .filter-tags { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-tag { padding: 6px 12px; border-radius: 20px; font-size: 12px; }
    .filter-enabled { background: #c6f6d5; color: #22543d; }
    .filter-disabled { background: #fed7d7; color: #742a2a; text-decoration: line-through; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #718096; font-size: 12px; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <h1>机场地勤车辆路径报告</h1>
      <div class="subtitle">生成时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}</div>
    </div>
    
    <div class="report-content">
      <div class="section">
        <h2>概览统计</h2>
        <div class="grid">
          <div class="stat-card">
            <div class="value">${data.summary.totalVehicles}</div>
            <div class="label">车辆总数</div>
          </div>
          <div class="stat-card">
            <div class="value">${data.summary.visibleVehicles}</div>
            <div class="label">可见车辆</div>
          </div>
          <div class="stat-card">
            <div class="value" style="color: ${data.summary.totalConflicts > 0 ? '#e53e3e' : '#48bb78'};">${data.summary.totalConflicts}</div>
            <div class="label">冲突总数</div>
          </div>
          <div class="stat-card">
            <div class="value">${this.formatTime(data.currentTime)}</div>
            <div class="label">当前时间点</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2>当前视图与筛选</h2>
        <div class="info-grid">
          <div class="info-box">
            <h3>视图信息</h3>
            <p><strong>视角类型:</strong> ${data.view.type === 'top' ? '俯视图' : data.view.type === 'perspective' ? '透视图' : '跟随视图'}</p>
            <p><strong>相机位置:</strong> (${data.view.cameraPosition.x}, ${data.view.cameraPosition.y}, ${data.view.cameraPosition.z})</p>
            <p><strong>目标位置:</strong> (${data.view.targetPosition.x}, ${data.view.targetPosition.y}, ${data.view.targetPosition.z})</p>
          </div>
          <div class="info-box">
            <h3>车辆筛选</h3>
            <div class="filter-tags">
              <span class="filter-tag ${data.filters.ferry ? 'filter-enabled' : 'filter-disabled'}">摆渡车</span>
              <span class="filter-tag ${data.filters.fuel ? 'filter-enabled' : 'filter-disabled'}">油车</span>
              <span class="filter-tag ${data.filters.baggage ? 'filter-enabled' : 'filter-disabled'}">行李车</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2>车辆状态</h2>
        <table>
          <thead>
            <tr>
              <th>车辆名称</th>
              <th>类型</th>
              <th>状态</th>
              <th>进度</th>
              <th>计划时间</th>
              <th>当前位置</th>
            </tr>
          </thead>
          <tbody>
            ${data.vehicles.map(v => `
            <tr style="${!v.visible ? 'opacity: 0.5;' : ''}">
              <td>${v.name}${!v.visible ? ' (已隐藏)' : ''}</td>
              <td>${v.typeName}</td>
              <td><span class="status-badge ${v.status === '待出发' ? 'status-pending' : v.status === '进行中' ? 'status-active' : 'status-done'}">${v.status}</span></td>
              <td style="width: 120px;">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${v.progress}%;"></div>
                </div>
                <div style="font-size: 11px; margin-top: 4px; text-align: right;">${v.progress}%</div>
              </td>
              <td>${v.schedule.start} - ${v.schedule.end}</td>
              <td>(${v.position.x}, ${v.position.z})</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <h2>冲突检测 (${data.conflicts.length})</h2>
        ${data.conflicts.length === 0 ? '<p style="color: #48bb78; padding: 20px; background: #f0fff4; border-radius: 8px;">✓ 未检测到任何冲突</p>' : `
        <table>
          <thead>
            <tr>
              <th>类型</th>
              <th>严重程度</th>
              <th>描述</th>
              <th>发生时间</th>
            </tr>
          </thead>
          <tbody>
            ${data.conflicts.map(c => `
            <tr class="${c.severity === 'high' ? 'conflict-high' : 'conflict-medium'}">
              <td>${conflictTypeNames[c.type] || c.type}</td>
              <td style="color: ${c.severity === 'high' ? '#e53e3e' : '#ed8936'};">${c.severity === 'high' ? '高' : '中'}</td>
              <td>${c.message}</td>
              <td>${this.formatTime(c.time)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
      
      <div class="section">
        <h2>航班信息</h2>
        <table>
          <thead>
            <tr>
              <th>航班号</th>
              <th>航空公司</th>
              <th>到达</th>
              <th>出发</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${data.flights.map(f => `
            <tr>
              <td><strong>${f.id}</strong></td>
              <td>${f.airline}</td>
              <td>${this.formatTime(f.schedule.arrival)}</td>
              <td>${this.formatTime(f.schedule.departure)}</td>
              <td>${f.delayed ? '<span style="color: #e53e3e;">已延误</span>' : '<span style="color: #48bb78;">准点</span>'}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>本报告由机场地勤车辆路径可视化系统自动生成</p>
        <p>报告数据与导出时的可视化状态完全一致</p>
      </div>
    </div>
  </div>
</body>
</html>
    `
  }
  
  downloadReport(reportHTML, reportData) {
    const jsonData = JSON.stringify(reportData, null, 2)
    
    const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `机场地勤车辆路径报告_${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    const jsonBlob = new Blob([jsonData], { type: 'application/json;charset=utf-8' })
    const jsonUrl = URL.createObjectURL(jsonBlob)
    const jsonA = document.createElement('a')
    jsonA.href = jsonUrl
    jsonA.download = `报告数据_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(jsonA)
    jsonA.click()
    document.body.removeChild(jsonA)
    URL.revokeObjectURL(jsonUrl)
  }
}
