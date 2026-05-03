import ShootingStage from '../models/ShootingStage'

export function generateCollageLayout(project, options = {}) {
  const {
    columns = 2,
    thumbnailWidth = 200,
    thumbnailHeight = 150,
    padding = 20,
    groupBy = 'part' // 'part', 'stage', 'artifactCode'
  } = options

  const groups = {}
  
  // 按指定方式分组
  project.images.forEach(image => {
    let groupKey = ''
    switch (groupBy) {
      case 'part':
        groupKey = image.part || '未分类'
        break
      case 'stage':
        groupKey = image.stage || '未分类'
        break
      case 'artifactCode':
        groupKey = image.artifactCode || '未分类'
        break
      default:
        groupKey = image.part || '未分类'
    }

    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(image)
  })

  // 为每个组生成布局
  const collageLayout = {
    groups: [],
    totalWidth: 0,
    totalHeight: 0,
    thumbnailWidth,
    thumbnailHeight,
    padding
  }

  let currentY = padding
  const groupKeys = Object.keys(groups).sort()

  groupKeys.forEach(groupKey => {
    const images = groups[groupKey]
    const group = {
      key: groupKey,
      title: getGroupTitle(groupKey, groupBy),
      images: [],
      width: 0,
      height: 0
    }

    // 计算该组的行数
    const rows = Math.ceil(images.length / columns)
    const groupWidth = columns * (thumbnailWidth + padding) + padding
    const groupHeight = rows * (thumbnailHeight + padding) + padding + 40 // +40 for title

    group.width = groupWidth
    group.height = groupHeight

    // 布局每张图片
    images.forEach((image, index) => {
      const row = Math.floor(index / columns)
      const col = index % columns
      
      const imageLayout = {
        image: image,
        x: padding + col * (thumbnailWidth + padding),
        y: currentY + 40 + row * (thumbnailHeight + padding),
        width: thumbnailWidth,
        height: thumbnailHeight,
        annotations: image.annotations.map(a => ({
          id: a.id,
          type: a.type,
          riskLevel: a.riskLevel,
          position: a.position
        }))
      }
      group.images.push(imageLayout)
    })

    collageLayout.groups.push(group)
    currentY += groupHeight + padding
  })

  // 计算整体尺寸
  if (collageLayout.groups.length > 0) {
    collageLayout.totalWidth = Math.max(...collageLayout.groups.map(g => g.width))
    collageLayout.totalHeight = currentY
  }

  return collageLayout
}

function getGroupTitle(key, groupBy) {
  switch (groupBy) {
    case 'part':
      return `部位: ${key}`
    case 'stage':
      const stageLabels = {
        [ShootingStage.BEFORE]: '修复前',
        [ShootingStage.DURING]: '修复中',
        [ShootingStage.AFTER]: '修复后',
        [ShootingStage.COMPARISON]: '对比图'
      }
      return `阶段: ${stageLabels[key] || key}`
    case 'artifactCode':
      return `器物: ${key}`
    default:
      return key
  }
}

// 生成对比布局（修复前 vs 修复后）
export function generateCompareLayout(project, part = null) {
  const layout = {
    pairs: [],
    parts: [],
    totalWidth: 0,
    totalHeight: 0
  }

  // 获取所有部位
  const parts = new Set()
  project.images.forEach(img => {
    if (img.part) {
      parts.add(img.part)
    }
  })
  layout.parts = Array.from(parts)

  // 为每个部位创建对比对
  const targetParts = part ? [part] : layout.parts
  
  targetParts.forEach(p => {
    const beforeImages = project.images.filter(img => 
      img.part === p && img.stage === ShootingStage.BEFORE
    )
    const afterImages = project.images.filter(img => 
      img.part === p && img.stage === ShootingStage.AFTER
    )

    // 尝试匹配修复前和修复后的图片
    const maxPairs = Math.max(beforeImages.length, afterImages.length)
    
    for (let i = 0; i < maxPairs; i++) {
      const pair = {
        part: p,
        before: beforeImages[i] || null,
        after: afterImages[i] || null,
        annotations: {
          before: [],
          after: []
        }
      }

      if (pair.before) {
        pair.annotations.before = pair.before.annotations.map(a => a.toJSON())
      }
      if (pair.after) {
        pair.annotations.after = pair.after.annotations.map(a => a.toJSON())
      }

      layout.pairs.push(pair)
    }
  })

  return layout
}

export default {
  generateCollageLayout,
  generateCompareLayout
}
