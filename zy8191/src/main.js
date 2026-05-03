import { DataParser } from './parsers/index.js'
import { Validator } from './validators/index.js'
import { SceneRenderer } from './renderer/sceneRenderer.js'
import { ReportExporter } from './exporters/reportExporter.js'
import { sampleContexts, sampleFinds, sampleRules } from './sampleData.js'

class ArchaeologyVisualizer {
  constructor() {
    this.contexts = null
    this.finds = null
    this.rules = null
    this.validationResult = null
    this.renderer = null

    this.init()
  }

  init() {
    const canvas = document.getElementById('canvas3d')
    this.renderer = new SceneRenderer(canvas)

    this.renderer.onLayerClick = (layerData) => {
      this.showLayerInfo(layerData.context)
      this.renderer.highlightLayer(layerData.layerId)
    }

    this.renderer.onFindClick = (findData) => {
      this.showFindInfo(findData.find)
    }

    this.setupEventListeners()
  }

  setupEventListeners() {
    document.getElementById('contextsFile').addEventListener('change', (e) => {
      this.handleFileSelect(e, 'contexts')
    })

    document.getElementById('findsFile').addEventListener('change', (e) => {
      this.handleFileSelect(e, 'finds')
    })

    document.getElementById('rulesFile').addEventListener('change', (e) => {
      this.handleFileSelect(e, 'rules')
    })

    document.getElementById('loadSampleBtn').addEventListener('click', () => {
      this.loadSampleData()
    })

    document.getElementById('validateBtn').addEventListener('click', () => {
      this.runValidation()
    })

    document.getElementById('exportIssuesBtn').addEventListener('click', () => {
      this.exportIssues()
    })

    document.getElementById('exportReportBtn').addEventListener('click', () => {
      this.exportReport()
    })

    document.getElementById('showWireframe').addEventListener('change', (e) => {
      this.renderer.toggleWireframe(e.target.checked)
    })

    document.getElementById('showAxes').addEventListener('change', (e) => {
      this.renderer.toggleAxes(e.target.checked)
    })

    document.getElementById('showOutlines').addEventListener('change', (e) => {
      this.renderer.toggleOutlines(e.target.checked)
    })

    document.getElementById('closeLayerInfo').addEventListener('click', () => {
      this.hideLayerInfo()
      this.renderer.resetHighlight()
    })
  }

  async handleFileSelect(event, type) {
    const file = event.target.files[0]
    if (!file) return

    try {
      const data = await DataParser.parseFile(file)

      switch (type) {
        case 'contexts':
          this.contexts = data
          this.updateFileStatus('contexts', true)
          break
        case 'finds':
          this.finds = data
          this.updateFileStatus('finds', true)
          break
        case 'rules':
          this.rules = data
          this.updateFileStatus('rules', true)
          break
      }

      this.updateDataOverview()
      this.checkReadyState()
    } catch (error) {
      console.error(`解析 ${type} 文件失败:`, error)
      alert(`文件解析失败: ${error.message}`)
    }
  }

  loadSampleData() {
    this.contexts = sampleContexts
    this.finds = sampleFinds
    this.rules = sampleRules

    this.updateFileStatus('contexts', true)
    this.updateFileStatus('finds', true)
    this.updateFileStatus('rules', true)

    this.updateDataOverview()
    this.checkReadyState()

    this.render3D()

    this.updateStatus('ready', '样例数据已加载')
  }

  updateFileStatus(type, loaded) {
    const statusEl = document.getElementById(`${type}Status`)
    const dot = statusEl.querySelector('.dot')
    const text = statusEl.querySelector('span:last-child')

    if (loaded) {
      dot.classList.remove('missing')
      dot.classList.add('loaded')
      text.textContent = '已加载'
    } else {
      dot.classList.remove('loaded')
      dot.classList.add('missing')
      text.textContent = '未加载'
    }
  }

  updateDataOverview() {
    document.getElementById('layerCount').textContent = this.contexts?.length || 0
    document.getElementById('findsCount').textContent = this.finds?.length || 0

    if (this.rules?.trench?.dimensions) {
      const dim = this.rules.trench.dimensions
      document.getElementById('trenchSize').textContent = 
        `${dim.x_max - dim.x_min}m × ${dim.y_max - dim.y_min}m × ${dim.z_max - dim.z_min}m`
    } else {
      document.getElementById('trenchSize').textContent = '-'
    }
  }

  checkReadyState() {
    const hasContexts = this.contexts && this.contexts.length > 0
    const hasFinds = this.finds && this.finds.length > 0
    const hasRules = this.rules !== null

    const validateBtn = document.getElementById('validateBtn')
    const isReady = hasContexts && hasRules
    validateBtn.disabled = !isReady

    if (isReady) {
      this.render3D()
    }
  }

  render3D() {
    if (!this.contexts || !this.rules) return

    this.renderer.loadData(this.contexts, this.finds, this.rules)
    this.updateStatus('ready', '3D场景已渲染')
  }

  runValidation() {
    if (!this.contexts || !this.rules) {
      alert('请先加载地层数据和规则文件')
      return
    }

    this.validationResult = Validator.validate(
      this.contexts,
      this.finds || [],
      this.rules
    )

    this.displayIssues(this.validationResult.issues)
    this.updateStatus('ready', `校验完成: 发现 ${this.validationResult.summary.total} 个问题`)

    document.getElementById('exportIssuesBtn').disabled = false
    document.getElementById('exportReportBtn').disabled = false
  }

  displayIssues(issues) {
    const container = document.getElementById('issuesList')
    
    if (issues.length === 0) {
      container.innerHTML = `
        <p style="color: #4ade80; font-size: 0.85rem; text-align: center; padding: 20px;">
          ✅ 未检测到问题
        </p>
      `
      return
    }

    let html = ''
    issues.forEach((issue, index) => {
      const typeClass = issue.type === 'error' ? 'error' : 'warning'
      const severityLabel = this.getSeverityLabel(issue.severity)
      
      html += `
        <div class="issue-item ${typeClass}">
          <h4>[${severityLabel}] ${issue.message}</h4>
          <p>${issue.detail}</p>
          ${issue.layerId ? `<p style="margin-top: 5px; color: #e94560;">相关地层: ${issue.layerId}</p>` : ''}
          ${issue.findId ? `<p style="margin-top: 5px; color: #ffa500;">相关出土物: ${issue.findId}</p>` : ''}
        </div>
      `
    })

    container.innerHTML = html
  }

  getSeverityLabel(severity) {
    const labels = {
      'critical': '严重',
      'high': '高',
      'medium': '中',
      'low': '低'
    }
    return labels[severity] || severity
  }

  showLayerInfo(context) {
    const infoPanel = document.getElementById('layerInfo')
    
    document.getElementById('layerTitle').textContent = `地层 ${context.id} - ${context.name}`
    document.getElementById('layerId').textContent = context.id
    document.getElementById('layerAge').textContent = context.age || '未知'
    document.getElementById('layerDescription').textContent = context.description || '无描述'
    document.getElementById('layerInclusions').textContent = 
      context.inclusions?.length > 0 ? context.inclusions.join(', ') : '无'

    const artifactsList = document.getElementById('layerArtifacts')
    const layerFinds = this.finds?.filter(f => f.layerId === context.id) || []
    
    if (layerFinds.length > 0) {
      artifactsList.innerHTML = layerFinds.map(f => 
        `<li>${f.id} - ${f.name} (${f.type})</li>`
      ).join('')
    } else {
      artifactsList.innerHTML = '<li style="color: #999;">无出土物</li>'
    }

    infoPanel.classList.add('visible')
  }

  showFindInfo(find) {
    const infoPanel = document.getElementById('layerInfo')
    
    document.getElementById('layerTitle').textContent = `出土物 ${find.id} - ${find.name}`
    document.getElementById('layerId').textContent = find.layerId || '未关联'
    document.getElementById('layerAge').textContent = find.type || '未知类型'
    document.getElementById('layerDescription').textContent = find.description || '无描述'
    document.getElementById('layerInclusions').textContent = 
      `坐标: (${find.coordinates.x ?? '-'}, ${find.coordinates.y ?? '-'}, ${find.coordinates.z ?? '-'})`

    const artifactsList = document.getElementById('layerArtifacts')
    artifactsList.innerHTML = `
      <li>材质: ${find.material || '未知'}</li>
      <li>保存状况: ${find.condition || '未知'}</li>
      ${find.notes ? `<li>备注: ${find.notes}</li>` : ''}
    `

    infoPanel.classList.add('visible')
  }

  hideLayerInfo() {
    document.getElementById('layerInfo').classList.remove('visible')
  }

  exportIssues() {
    if (!this.validationResult) {
      alert('请先执行校验')
      return
    }

    const csvContent = Validator.toCSV(this.validationResult)
    ReportExporter.downloadCSV(csvContent, 'issues.csv')
  }

  exportReport() {
    if (!this.validationResult) {
      alert('请先执行校验')
      return
    }

    const reportContent = ReportExporter.generateSectionReport(
      this.contexts,
      this.finds,
      this.rules,
      this.validationResult
    )
    ReportExporter.downloadReport(reportContent, 'section_report.md')
  }

  updateStatus(type, message) {
    const statusBar = document.getElementById('statusBar')
    const span = statusBar.querySelector('span')
    
    span.className = type
    span.textContent = message
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ArchaeologyVisualizer()
})
