import type { 
  ReportData, 
  PixelDifferenceSummary,
  NodeExecutionResult,
  FilterNode
} from '@/types'
import { formatDifferenceSummary } from './pixelComparison'

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return 'N/A'
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatPercentage(value: number): string {
  return `${value.toFixed(4)}%`
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'success': return '✅'
    case 'failed': return '❌'
    case 'skipped': return '⏭️'
    case 'running': return '⏳'
    default: return '⚪'
  }
}

function getNodeStatus(result: NodeExecutionResult | undefined): { status: string; error?: string } {
  if (!result) return { status: 'skipped' }
  if (!result.success) return { status: 'failed', error: result.error }
  return { status: 'success' }
}

export function generateMarkdownReport(reportData: ReportData): string {
  const {
    projectName,
    timestamp,
    webgpuAvailable,
    imageInfo,
    pipelineResult,
    nodeDetails
  } = reportData

  const lines: string[] = []

  lines.push(`# ${projectName}`)
  lines.push('')
  lines.push(`> 生成时间: ${new Date(timestamp).toLocaleString('zh-CN')}`)
  lines.push('')

  lines.push('## 环境信息')
  lines.push('')
  lines.push(`| 项目 | 值 |`)
  lines.push(`|------|-----|`)
  lines.push(`| WebGPU 支持 | ${webgpuAvailable ? '✅ 可用' : '❌ 不可用'} |`)
  lines.push(`| 图片名称 | ${imageInfo.name} |`)
  lines.push(`| 图片尺寸 | ${imageInfo.width} × ${imageInfo.height} |`)
  lines.push('')

  lines.push('## 执行结果摘要')
  lines.push('')
  
  const hasBothResults = pipelineResult.gpuResult && pipelineResult.cpuResult
  
  lines.push(`| 指标 | GPU 路径 | CPU 路径 |`)
  lines.push(`|------|----------|----------|`)
  lines.push(`| 总耗时 | ${formatDuration(pipelineResult.totalGpuTime)} | ${formatDuration(pipelineResult.totalCpuTime)} |`)
  lines.push(`| 输出尺寸 | ${pipelineResult.gpuResult ? `${pipelineResult.gpuResult.width} × ${pipelineResult.gpuResult.height}` : 'N/A'} | ${pipelineResult.cpuResult ? `${pipelineResult.cpuResult.width} × ${pipelineResult.cpuResult.height}` : 'N/A'} |`)
  lines.push('')

  if (pipelineResult.pixelDiff && hasBothResults) {
    lines.push('## 像素差异分析')
    lines.push('')
    lines.push('```')
    lines.push(formatDifferenceSummary(pipelineResult.pixelDiff))
    lines.push('```')
    lines.push('')

    const diff = pipelineResult.pixelDiff
    lines.push('### 差异质量评估')
    lines.push('')
    
    let quality = '未知'
    let qualityColor = '⚪'
    
    if (diff.psnr >= 40) {
      quality = '优秀 (差异可忽略)'
      qualityColor = '🟢'
    } else if (diff.psnr >= 30) {
      quality = '良好 (差异极小)'
      qualityColor = '🟡'
    } else if (diff.psnr >= 20) {
      quality = '一般 (差异明显)'
      qualityColor = '🟠'
    } else {
      quality = '较差 (差异显著)'
      qualityColor = '🔴'
    }
    
    lines.push(`${qualityColor} **质量评级**: ${quality}`)
    lines.push('')
  }

  lines.push('## 节点详细信息')
  lines.push('')

  nodeDetails.forEach(({ node, result }, index) => {
    const { status, error } = getNodeStatus(result)
    
    lines.push(`### ${getStatusEmoji(status)} 节点 ${index + 1}: ${node.name}`)
    lines.push('')
    lines.push(`- **类型**: \`${node.type}\``)
    lines.push(`- **状态**: ${status === 'success' ? '成功' : status === 'failed' ? '失败' : status === 'skipped' ? '跳过' : '未知'}`)
    lines.push(`- **GPU 耗时**: ${formatDuration(result?.gpuTime)}`)
    lines.push(`- **CPU 耗时**: ${formatDuration(result?.cpuTime)}`)
    
    if (result?.gpuTime && result?.cpuTime) {
      const speedup = result.cpuTime / result.gpuTime
      lines.push(`- **GPU 加速比**: ${speedup.toFixed(2)}x`)
    }
    
    lines.push('')
    lines.push('#### 参数')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(node.parameters, null, 2))
    lines.push('```')
    lines.push('')

    if (error) {
      lines.push('#### 错误信息')
      lines.push('')
      lines.push('```')
      lines.push(error)
      lines.push('```')
      lines.push('')
    }
  })

  const failedNodes = nodeDetails.filter(({ result }) => result && !result.success)
  if (failedNodes.length > 0) {
    lines.push('## ⚠️ 失败节点列表')
    lines.push('')
    failedNodes.forEach(({ node, result }, index) => {
      lines.push(`### 节点 ${index + 1}: ${node.name} (ID: ${node.id})`)
      lines.push('')
      lines.push(`**错误**: ${result?.error || '未知错误'}`)
      lines.push('')
      lines.push('**参数**:')
      lines.push('```json')
      lines.push(JSON.stringify(node.parameters, null, 2))
      lines.push('```')
      lines.push('')
    })
  }

  lines.push('## 报告元数据')
  lines.push('')
  lines.push(`- **报告版本**: 1.0.0`)
  lines.push(`- **生成时间戳**: ${timestamp}`)
  lines.push(`- **项目名称**: ${projectName}`)
  lines.push('')

  return lines.join('\n')
}

export function generateHTMLReport(reportData: ReportData): string {
  const {
    projectName,
    timestamp,
    webgpuAvailable,
    imageInfo,
    pipelineResult,
    nodeDetails
  } = reportData

  const failedCount = nodeDetails.filter(({ result }) => result && !result.success).length
  const successCount = nodeDetails.filter(({ result }) => result && result.success).length

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - 滤镜管线检查报告</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #667eea;
      padding-bottom: 15px;
      margin-bottom: 30px;
    }
    h2 {
      color: #2c3e50;
      margin: 30px 0 20px;
      border-left: 4px solid #667eea;
      padding-left: 15px;
    }
    h3 {
      color: #34495e;
      margin: 20px 0 15px;
    }
    .meta {
      color: #7f8c8d;
      font-size: 0.9em;
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }
    tr:hover { background: #f9f9f9; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 500;
    }
    .status-success { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .status-skipped { background: #e2e3e5; color: #383d41; }
    .code-block {
      background: #282c34;
      color: #abb2bf;
      padding: 15px;
      border-radius: 6px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
      overflow-x: auto;
      margin: 15px 0;
    }
    .node-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin: 15px 0;
      transition: box-shadow 0.2s;
    }
    .node-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .node-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .node-title {
      font-size: 1.1em;
      font-weight: 600;
      color: #2c3e50;
    }
    .timing-row {
      display: flex;
      gap: 30px;
      margin: 10px 0;
    }
    .timing-item {
      flex: 1;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .timing-label {
      font-size: 0.85em;
      color: #7f8c8d;
      margin-bottom: 4px;
    }
    .timing-value {
      font-size: 1.3em;
      font-weight: 600;
      color: #667eea;
    }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
    }
    .error-title {
      color: #dc2626;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .summary-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-label {
      font-size: 0.9em;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .summary-value {
      font-size: 1.8em;
      font-weight: 700;
    }
    .diff-quality {
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .quality-excellent { background: #d1fae5; border-left: 4px solid #10b981; }
    .quality-good { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .quality-fair { background: #fed7aa; border-left: 4px solid #f97316; }
    .quality-poor { background: #fee2e2; border-left: 4px solid #ef4444; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #7f8c8d;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${projectName}</h1>
    <div class="meta">生成时间: ${new Date(timestamp).toLocaleString('zh-CN')}</div>

    <h2>环境信息</h2>
    <table>
      <tr><th>项目</th><th>值</th></tr>
      <tr><td>WebGPU 支持</td><td>${webgpuAvailable ? '✅ 可用' : '❌ 不可用'}</td></tr>
      <tr><td>图片名称</td><td>${imageInfo.name}</td></tr>
      <tr><td>图片尺寸</td><td>${imageInfo.width} × ${imageInfo.height} px</td></tr>
    </table>

    <h2>执行结果摘要</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">GPU 总耗时</div>
        <div class="summary-value">${formatDuration(pipelineResult.totalGpuTime)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">CPU 总耗时</div>
        <div class="summary-value">${formatDuration(pipelineResult.totalCpuTime)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">成功节点</div>
        <div class="summary-value">${successCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">失败节点</div>
        <div class="summary-value">${failedCount}</div>
      </div>
    </div>

    <table>
      <tr><th>指标</th><th>GPU 路径</th><th>CPU 路径</th></tr>
      <tr><td>输出尺寸</td><td>${pipelineResult.gpuResult ? `${pipelineResult.gpuResult.width} × ${pipelineResult.gpuResult.height}` : 'N/A'}</td><td>${pipelineResult.cpuResult ? `${pipelineResult.cpuResult.width} × ${pipelineResult.cpuResult.height}` : 'N/A'}</td></tr>
    </table>

    ${pipelineResult.pixelDiff && pipelineResult.gpuResult && pipelineResult.cpuResult ? `
    <h2>像素差异分析</h2>
    <table>
      <tr><th>指标</th><th>值</th></tr>
      <tr><td>总像素数</td><td>${pipelineResult.pixelDiff.totalPixels.toLocaleString()}</td></tr>
      <tr><td>差异像素</td><td>${pipelineResult.pixelDiff.differingPixels.toLocaleString()} (${formatPercentage(pipelineResult.pixelDiff.differingPercent)})</td></tr>
      <tr><td>最大差异</td><td>${pipelineResult.pixelDiff.maxDifference}</td></tr>
      <tr><td>平均差异</td><td>${pipelineResult.pixelDiff.avgDifference.toFixed(2)}</td></tr>
      <tr><td>RMS 差异</td><td>${pipelineResult.pixelDiff.rmsDifference.toFixed(4)}</td></tr>
      <tr><td>PSNR</td><td>${pipelineResult.pixelDiff.psnr === 100 ? '∞' : pipelineResult.pixelDiff.psnr.toFixed(2)} dB</td></tr>
    </table>

    <div class="diff-quality ${getQualityClass(pipelineResult.pixelDiff.psnr)}">
      <strong>质量评级:</strong> ${getQualityText(pipelineResult.pixelDiff.psnr)}
    </div>
    ` : ''}

    <h2>节点详细信息</h2>
    ${nodeDetails.map(({ node, result }, index) => {
      const status = getNodeStatus(result).status
      const statusClass = status === 'success' ? 'status-success' : status === 'failed' ? 'status-failed' : 'status-skipped'
      const statusText = status === 'success' ? '成功' : status === 'failed' ? '失败' : status === 'skipped' ? '跳过' : '未知'
      
      return `
      <div class="node-card">
        <div class="node-header">
          <span class="node-title">节点 ${index + 1}: ${node.name}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <p><strong>类型:</strong> <code>${node.type}</code></p>
        
        <div class="timing-row">
          <div class="timing-item">
            <div class="timing-label">GPU 耗时</div>
            <div class="timing-value">${formatDuration(result?.gpuTime)}</div>
          </div>
          <div class="timing-item">
            <div class="timing-label">CPU 耗时</div>
            <div class="timing-value">${formatDuration(result?.cpuTime)}</div>
          </div>
          ${result?.gpuTime && result?.cpuTime ? `
          <div class="timing-item">
            <div class="timing-label">GPU 加速比</div>
            <div class="timing-value">${(result.cpuTime / result.gpuTime).toFixed(2)}x</div>
          </div>
          ` : ''}
        </div>

        <h4>参数</h4>
        <div class="code-block">${escapeHtml(JSON.stringify(node.parameters, null, 2))}</div>

        ${result?.error ? `
        <div class="error-box">
          <div class="error-title">错误信息</div>
          <div class="code-block">${escapeHtml(result.error)}</div>
        </div>
        ` : ''}
      </div>
      `
    }).join('')}

    ${failedCount > 0 ? `
    <h2>⚠️ 失败节点列表</h2>
    ${nodeDetails.filter(({ result }) => result && !result.success).map(({ node, result }, index) => `
    <div class="error-box">
      <h3>节点 ${index + 1}: ${node.name}</h3>
      <p><strong>错误:</strong> ${result?.error || '未知错误'}</p>
      <h4>参数</h4>
      <div class="code-block">${escapeHtml(JSON.stringify(node.parameters, null, 2))}</div>
    </div>
    `).join('')}
    ` : ''}

    <div class="footer">
      <p>报告版本: 1.0.0 | 生成时间戳: ${timestamp}</p>
    </div>
  </div>
</body>
</html>`

  return html
}

function getQualityClass(psnr: number): string {
  if (psnr >= 40) return 'quality-excellent'
  if (psnr >= 30) return 'quality-good'
  if (psnr >= 20) return 'quality-fair'
  return 'quality-poor'
}

function getQualityText(psnr: number): string {
  if (psnr >= 40) return '优秀 (差异可忽略)'
  if (psnr >= 30) return '良好 (差异极小)'
  if (psnr >= 20) return '一般 (差异明显)'
  return '较差 (差异显著)'
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function downloadReport(content: string, filename: string, format: 'markdown' | 'html'): void {
  const mimeType = format === 'html' ? 'text/html' : 'text/markdown'
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
