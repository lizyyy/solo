import { formatTime } from './timeUtils'
import { MARKER_TYPES, getMarkerType } from '../constants/markerTypes'

export const generateMarkdown = (markers, audioInfo = null) => {
  let content = '# 音频剪辑清单\n\n'
  
  if (audioInfo?.name) {
    content += `**音频文件**: ${audioInfo.name}\n`
  }
  if (audioInfo?.duration) {
    content += `**总时长**: ${formatTime(audioInfo.duration)}\n`
  }
  content += `**标记总数**: ${markers.length}\n\n`
  
  const stats = getMarkersStats(markers)
  content += '## 统计概览\n\n'
  content += '| 类型 | 数量 |\n|------|------|\n'
  Object.entries(stats).forEach(([type, count]) => {
    const typeInfo = getMarkerType(type)
    content += `| ${typeInfo.label} | ${count} |\n`
  })
  content += '\n'
  
  content += '## 标记详情\n\n'
  const sortedMarkers = [...markers].sort((a, b) => a.time - b.time)
  
  sortedMarkers.forEach((marker, index) => {
    const typeInfo = getMarkerType(marker.type)
    content += `### ${index + 1}. ${typeInfo.label} [${formatTime(marker.time)}]\n\n`
    
    if (marker.note) {
      content += `**备注**: ${marker.note}\n\n`
    }
    
    content += '\n'
  })
  
  return content
}

export const generateCSV = (markers, audioInfo = null) => {
  let csv = ''
  
  if (audioInfo) {
    csv += `# 音频剪辑清单\n`
    csv += `# 音频文件: ${audioInfo.name || '未知'}\n`
    csv += `# 总时长: ${audioInfo.duration ? formatTime(audioInfo.duration) : '未知'}\n`
    csv += `# 标记总数: ${markers.length}\n`
    csv += '\n'
  }
  
  csv += '序号,时间码,类型,备注\n'
  
  const sortedMarkers = [...markers].sort((a, b) => a.time - b.time)
  
  sortedMarkers.forEach((marker, index) => {
    const typeInfo = getMarkerType(marker.type)
    const timeCode = formatTime(marker.time)
    const note = (marker.note || '').replace(/"/g, '""')
    
    csv += `${index + 1},"${timeCode}","${typeInfo.label}","${note}"\n`
  })
  
  return csv
}

export const getMarkersStats = (markers) => {
  const stats = {}
  Object.keys(MARKER_TYPES).forEach(type => {
    stats[type] = 0
  })
  
  markers.forEach(marker => {
    if (stats[marker.type] !== undefined) {
      stats[marker.type]++
    }
  })
  
  return stats
}

export const downloadFile = (content, filename, mimeType) => {
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
