import { SceneState, CollisionResult, CollisionSeverity, Keyframe } from '@/types'
import { getCollisionTypeName, getSeverityColor } from '@/engine/collisionEngine'

export const exportToMarkdown = (scene: SceneState): string => {
  const criticalCollisions = scene.collisionResults.filter(c => c.severity === 'critical')
  const warningCollisions = scene.collisionResults.filter(c => c.severity === 'warning')
  const infoCollisions = scene.collisionResults.filter(c => c.severity === 'info')

  const md = `# 分段吊装方案 - ${scene.name}

> 生成时间: ${new Date().toLocaleString()}

---

## 一、方案概述

| 项目 | 详情 |
|------|------|
| 方案名称 | ${scene.name} |
| 创建时间 | ${scene.createdAt.toLocaleString()} |
| 更新时间 | ${scene.updatedAt.toLocaleString()} |
| 分段数量 | ${scene.segments.length} |
| 关键帧数量 | ${scene.keyframes.length} |
| 障碍物数量 | ${scene.obstacles.length} |
| 潮位窗口数量 | ${scene.tidalWindows.length} |

---

## 二、风险评估

### 2.1 风险统计

| 风险等级 | 数量 | 状态 |
|----------|------|------|
| 🔴 严重 | ${criticalCollisions.length} | ${criticalCollisions.length > 0 ? '⚠️ 需立即处理' : '✅ 无风险'} |
| 🟠 警告 | ${warningCollisions.length} | ${warningCollisions.length > 0 ? '⚠️ 需关注' : '✅ 无风险'} |
| 🔵 信息 | ${infoCollisions.length} | 常规信息 |

### 2.2 风险详情

${scene.collisionResults.length > 0 
  ? scene.collisionResults.map((collision, index) => `
#### ${index + 1}. ${getCollisionTypeName(collision.type)}

| 属性 | 值 |
|------|-----|
| 风险等级 | ${getSeverityEmoji(collision.severity)} ${getSeverityLabel(collision.severity)} |
| 描述 | ${collision.message} |
${collision.distance !== undefined ? `| 距离 | ${collision.distance.toFixed(2)}m |\n` : ''}
${collision.recommendedAction ? `| 建议措施 | ${collision.recommendedAction} |\n` : ''}
${collision.position ? `| 位置 | (${collision.position.x.toFixed(1)}, ${collision.position.y.toFixed(1)}, ${collision.position.z.toFixed(1)}) |\n` : ''}
`).join('')
  : '> 暂无风险检测结果，请运行碰撞检查。\n'
}

---

## 三、分段信息

${scene.segments.length > 0
  ? scene.segments.map((segment, index) => `
### 3.${index + 1} ${segment.name}

| 属性 | 值 |
|------|-----|
| 尺寸 | ${segment.dimensions.length}m × ${segment.dimensions.width}m × ${segment.dimensions.height}m |
| 重量 | ${segment.weight} t |
| 重心位置 | (${segment.centerOfGravity.x}, ${segment.centerOfGravity.y}, ${segment.centerOfGravity.z}) |
| 吊点数量 | ${segment.liftingPoints.length} |
| 初始位置 | (${segment.initialPosition.x}, ${segment.initialPosition.y}, ${segment.initialPosition.z}) |
| 目标位置 | (${segment.targetPosition.x}, ${segment.targetPosition.y}, ${segment.targetPosition.z}) |
${segment.notes ? `| 备注 | ${segment.notes} |\n` : ''}

${segment.liftingPoints.length > 0 ? `**吊点坐标:**
${segment.liftingPoints.map((lp, i) => 
  `- 吊点 ${i + 1}: (${lp.x.toFixed(2)}, ${lp.y.toFixed(2)}, ${lp.z.toFixed(2)})`
).join('\n')}
` : ''}
`).join('')
  : '> 暂无分段数据。\n'
}

---

## 四、吊装路径

### 4.1 吊车参数

| 参数 | 值 |
|------|-----|
| 吊车名称 | ${scene.crane.name} |
| 最大半径 | ${scene.crane.maxRadius} m |
| 最小半径 | ${scene.crane.minRadius} m |
| 最大高度 | ${scene.crane.maxHeight} m |
| 最大起重量 | ${scene.crane.maxLiftCapacity} t |
| 吊臂长度 | ${scene.crane.boomLength} m |

**起重量曲线:**
${scene.crane.capacityCurve.map(p => 
  `- 半径 ${p.radius}m: ${p.capacity} t`
).join('\n')}

### 4.2 关键帧序列

${scene.keyframes.length > 0
  ? `
| 序号 | 标签 | 位置 (X,Y,Z) | 半径 | 钩高 | 时间 |
|------|------|--------------|------|------|------|
${scene.keyframes.map((kf, index) => 
  `| ${index + 1} | ${kf.label || `K${index + 1}`} | (${kf.position.x.toFixed(1)}, ${kf.position.y.toFixed(1)}, ${kf.position.z.toFixed(1)}) | ${kf.radius.toFixed(1)}m | ${kf.hookHeight.toFixed(1)}m | ${new Date(kf.timestamp).toLocaleTimeString()} |`
).join('\n')}
`
  : '> 暂无关键帧数据。\n'
}

---

## 五、障碍物信息

${scene.obstacles.length > 0
  ? `
| 序号 | 名称 | 类型 | 尺寸 (L×W×H) | 位置 | 是否永久 |
|------|------|------|---------------|------|----------|
${scene.obstacles.map((obs, index) => 
  `| ${index + 1} | ${obs.name} | ${getObstacleTypeLabel(obs.type)} | ${obs.dimensions.length}×${obs.dimensions.width}×${obs.dimensions.height}m | (${obs.position.x}, ${obs.position.y}, ${obs.position.z}) | ${obs.isPermanent ? '是' : '否'} |`
).join('\n')}
`
  : '> 暂无障碍物数据。\n'
}

---

## 六、潮位窗口

${scene.tidalWindows.length > 0
  ? `
| 序号 | 开始时间 | 结束时间 | 最小潮位 | 最大潮位 | 安全净空 |
|------|----------|----------|----------|----------|----------|
${scene.tidalWindows.map((tw, index) => 
  `| ${index + 1} | ${tw.startTime.toLocaleString()} | ${tw.endTime.toLocaleString()} | ${tw.minHeight}m | ${tw.maxHeight}m | ${tw.safeClearance}m |`
).join('\n')}
`
  : '> 暂无潮位数据。\n'
}

---

## 七、复核意见

${scene.comments.length > 0
  ? scene.comments.map((comment, index) => `
### 7.${index + 1} 复核意见

| 属性 | 值 |
|------|-----|
| 作者 | ${comment.author} |
| 时间 | ${comment.timestamp.toLocaleString()} |
| 状态 | ${comment.isResolved ? '✅ 已解决' : '🔴 未解决'} |
${comment.isResolved && comment.resolver ? `| 解决人 | ${comment.resolver} |\n` : ''}
${comment.isResolved && comment.resolvedAt ? `| 解决时间 | ${comment.resolvedAt.toLocaleString()} |\n` : ''}

**意见内容:**
${comment.content}
`).join('')
  : '> 暂无复核意见。\n'
}

---

## 八、附录

### 8.1 图例说明

- 🔴 **严重风险**: 必须立即处理，否则可能导致安全事故
- 🟠 **警告风险**: 需要关注，可能影响吊装作业
- 🔵 **信息提示**: 常规信息，不影响作业

### 8.2 使用说明

1. 所有坐标以船坞中心为原点
2. 长度单位为米 (m)
3. 重量单位为吨 (t)
4. 时间为本地时间

---

> 本方案由「分段吊装避碰沙盘」自动生成
> 请结合实际情况进行人工复核
`

  return md
}

export const exportRiskCSV = (scene: SceneState): string => {
  const headers = ['序号', '风险类型', '风险等级', '描述', '位置X', '位置Y', '位置Z', '距离', '建议措施']
  
  const rows = scene.collisionResults.map((collision, index) => [
    String(index + 1),
    getCollisionTypeName(collision.type),
    getSeverityLabel(collision.severity),
    collision.message,
    collision.position?.x.toFixed(2) || '',
    collision.position?.y.toFixed(2) || '',
    collision.position?.z.toFixed(2) || '',
    collision.distance?.toFixed(2) || '',
    collision.recommendedAction || ''
  ])

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}

export const exportKeyframeCSV = (scene: SceneState): string => {
  const headers = ['序号', '标签', '位置X', '位置Y', '位置Z', '旋转X', '旋转Y', '旋转Z', '钩高', '吊臂角度', '半径', '时间']
  
  const rows = scene.keyframes.map((kf, index) => [
    String(index + 1),
    kf.label || `K${index + 1}`,
    kf.position.x.toFixed(2),
    kf.position.y.toFixed(2),
    kf.position.z.toFixed(2),
    kf.rotation.x.toFixed(2),
    kf.rotation.y.toFixed(2),
    kf.rotation.z.toFixed(2),
    kf.hookHeight.toFixed(2),
    kf.boomAngle.toFixed(2),
    kf.radius.toFixed(2),
    new Date(kf.timestamp).toISOString()
  ])

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}

export const exportSceneJSON = (scene: SceneState): string => {
  const serializedScene = {
    ...scene,
    createdAt: scene.createdAt.toISOString(),
    updatedAt: scene.updatedAt.toISOString(),
    tidalWindows: scene.tidalWindows.map(tw => ({
      ...tw,
      startTime: tw.startTime.toISOString(),
      endTime: tw.endTime.toISOString()
    })),
    comments: scene.comments.map(c => ({
      ...c,
      timestamp: c.timestamp.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString() || null
    }))
  }
  
  return JSON.stringify(serializedScene, null, 2)
}

export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain'): void => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const downloadMarkdown = (scene: SceneState): void => {
  const content = exportToMarkdown(scene)
  const filename = `吊装方案-${scene.name}-${new Date().toISOString().slice(0, 10)}.md`
  downloadFile(content, filename, 'text/markdown')
}

export const downloadRiskCSV = (scene: SceneState): void => {
  const content = exportRiskCSV(scene)
  const filename = `风险清单-${scene.name}-${new Date().toISOString().slice(0, 10)}.csv`
  downloadFile(content, filename, 'text/csv')
}

export const downloadSceneJSON = (scene: SceneState): void => {
  const content = exportSceneJSON(scene)
  const filename = `场景包-${scene.name}-${new Date().toISOString().slice(0, 10)}.json`
  downloadFile(content, filename, 'application/json')
}

function getSeverityEmoji(severity: CollisionSeverity): string {
  switch (severity) {
    case 'critical': return '🔴'
    case 'warning': return '🟠'
    case 'info': return '🔵'
  }
}

function getSeverityLabel(severity: CollisionSeverity): string {
  switch (severity) {
    case 'critical': return '严重'
    case 'warning': return '警告'
    case 'info': return '信息'
  }
}

function getObstacleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    temporary_support: '临时支架',
    transport_route: '转运路线',
    existing_structure: '现有结构',
    other: '其他'
  }
  return labels[type] || type
}
