export class UIController {
  constructor(app) {
    this.app = app
    this.setupEventListeners()
  }

  setupEventListeners() {
    document.getElementById('btnLoadSample')?.addEventListener('click', () => {
      this.app.loadSampleScene()
    })

    document.getElementById('btnReset')?.addEventListener('click', () => {
      this.app.resetScene()
    })

    document.getElementById('btnTopView')?.addEventListener('click', () => {
      this.app.setView('top')
    })

    document.getElementById('btnFrontView')?.addEventListener('click', () => {
      this.app.setView('front')
    })

    document.getElementById('btnFreeView')?.addEventListener('click', () => {
      this.app.setView('free')
    })

    document.getElementById('btnExportReport')?.addEventListener('click', () => {
      this.app.reportExporter.exportReport()
    })

    const filters = ['Ride', 'Queue', 'Screen', 'Obstacle', 'Viewpoint', 'Sightline']
    filters.forEach(filter => {
      const checkbox = document.getElementById(`filter${filter}`)
      checkbox?.addEventListener('change', (e) => {
        this.app.toggleFilter(filter.toLowerCase(), e.target.checked)
      })
    })
  }

  updateSelectedInfo(obj) {
    const content = document.getElementById('selected-content')
    if (!content) return

    const userData = obj.userData
    let html = ''

    const typeNames = {
      ride: '🎢 游乐设施',
      queue: '🚧 排队栏',
      screen: '📺 提示屏',
      obstacle: '🧱 遮挡物',
      viewpoint: '👁️ 游客视点'
    }

    html += `<div class="detail-item"><span>类型</span><span>${typeNames[userData.type] || userData.type}</span></div>`
    html += `<div class="detail-item"><span>名称</span><span>${userData.name || '未命名'}</span></div>`
    
    const pos = obj.position
    html += `<div class="detail-item"><span>位置</span><span>(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})</span></div>`

    if (userData.screenData) {
      html += `<div class="detail-item"><span>尺寸</span><span>${userData.screenData.width}m × ${userData.screenData.height}m</span></div>`
    }

    if (userData.viewpointData) {
      const analysis = this.app.sightlineAnalyzer.getAnalysisResults()
      const vpAnalysis = analysis.find(a => a.viewpointIndex === userData.index)
      if (vpAnalysis) {
        const status = vpAnalysis.hasVisibleScreen ? '✅ 可见' : '❌ 遮挡'
        html += `<div class="detail-item"><span>视线状态</span><span>${status}</span></div>`
      }
    }

    if (userData.obstacleData) {
      const blockingObstacles = this.app.sightlineAnalyzer.getBlockingObstacles()
      const blockInfo = blockingObstacles[userData.name]
      if (blockInfo) {
        html += `<div class="detail-item"><span>遮挡次数</span><span>${blockInfo.count}</span></div>`
      }
    }

    content.innerHTML = html
  }

  clearSelectedInfo() {
    const content = document.getElementById('selected-content')
    if (content) {
      content.innerHTML = '点击场景中的对象查看详情'
    }
  }

  updateViewpointInfo(vp, analysis) {
    const content = document.getElementById('selected-content')
    if (!content) return

    let html = ''
    html += `<div class="detail-item"><span>类型</span><span>👁️ 游客视点</span></div>`
    html += `<div class="detail-item"><span>名称</span><span>${vp.data.name}</span></div>`
    html += `<div class="detail-item"><span>位置</span><span>(${vp.position.x.toFixed(1)}, ${vp.position.y.toFixed(1)}, ${vp.position.z.toFixed(1)})</span></div>`

    if (analysis) {
      const status = analysis.hasVisibleScreen ? '✅ 可见' : '❌ 完全遮挡'
      html += `<div class="detail-item"><span>整体状态</span><span>${status}</span></div>`
      html += `<br><strong>各屏幕视线:</strong><br>`
      
      analysis.screenResults.forEach(sr => {
        const screenStatus = sr.isVisible ? '🟢' : '🔴'
        html += `<div class="detail-item">`
        html += `<span>${screenStatus} ${sr.screenName}</span>`
        html += `<span>${sr.distance}m</span>`
        html += `</div>`
        if (!sr.isVisible && sr.blockingObject) {
          html += `<div style="color:#f87171;font-size:10px;padding-left:15px;">被 ${sr.blockingObject} 遮挡</div>`
        }
      })
    }

    content.innerHTML = html
  }

  updateStatusDisplay() {
    const stats = this.app.sightlineAnalyzer.getStatistics()
    
    const visibleEl = document.getElementById('visibleCount')
    const blockedEl = document.getElementById('blockedCount')
    const rateEl = document.getElementById('visibilityRate')

    if (visibleEl) visibleEl.textContent = stats.visibleViewpoints
    if (blockedEl) blockedEl.textContent = stats.blockedViewpoints
    if (rateEl) rateEl.textContent = `${stats.visibilityRate}%`
  }

  updateReportPreview() {
    const preview = document.getElementById('reportPreview')
    if (!preview) return

    const stats = this.app.sightlineAnalyzer.getStatistics()
    const blocked = this.app.sightlineAnalyzer.getBlockedViewpoints()
    const obstacles = this.app.sightlineAnalyzer.getBlockingObstacles()

    let html = ''
    html += `<strong>📊 分析概要</strong><br>`
    html += `总视点: ${stats.totalViewpoints}<br>`
    html += `可见: ${stats.visibleViewpoints} | 遮挡: ${stats.blockedViewpoints}<br>`
    html += `可见率: ${stats.visibilityRate}%<br><br>`

    if (blocked.length > 0) {
      html += `<strong>⚠️ 遮挡视点:</strong><br>`
      blocked.forEach(b => {
        html += `• ${b.viewpoint}<br>`
      })
      html += `<br>`
    }

    if (Object.keys(obstacles).length > 0) {
      html += `<strong>🧱 主要遮挡物:</strong><br>`
      Object.entries(obstacles).forEach(([name, info]) => {
        html += `• ${name}: ${info.count}次<br>`
      })
    }

    preview.innerHTML = html
  }
}
