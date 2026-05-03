export function exportJSONArchive(project) {
  const archive = {
    version: '1.0.0',
    exportTime: new Date().toISOString(),
    project: null,
    images: [],
    annotations: []
  }

  // 导出项目基本信息
  archive.project = {
    id: project.id,
    name: project.name,
    description: project.description,
    artifactCode: project.artifactCode,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  }

  // 导出图片信息
  const imageMap = {}
  project.images.forEach(image => {
    const imageData = {
      id: image.id,
      projectId: image.projectId,
      filePath: image.filePath,
      fileName: image.fileName,
      artifactCode: image.artifactCode,
      part: image.part,
      stage: image.stage,
      description: image.description,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
      annotationIds: image.annotations.map(a => a.id)
    }
    archive.images.push(imageData)
    imageMap[image.id] = imageData
  })

  // 导出批注信息
  project.images.forEach(image => {
    image.annotations.forEach(annotation => {
      const annotationData = {
        id: annotation.id,
        imageId: annotation.imageId,
        type: annotation.type,
        riskLevel: annotation.riskLevel,
        position: {
          x: annotation.position.x,
          y: annotation.position.y,
          width: annotation.position.width,
          height: annotation.position.height
        },
        comment: annotation.comment,
        suggestion: annotation.suggestion,
        createdAt: annotation.createdAt,
        updatedAt: annotation.updatedAt
      }
      archive.annotations.push(annotationData)
    })
  })

  // 添加统计信息
  archive.statistics = {
    totalImages: archive.images.length,
    totalAnnotations: archive.annotations.length,
    annotationsByRisk: {},
    annotationsByType: {}
  }

  // 按风险等级统计
  archive.annotations.forEach(a => {
    archive.statistics.annotationsByRisk[a.riskLevel] = 
      (archive.statistics.annotationsByRisk[a.riskLevel] || 0) + 1
  })

  // 按类型统计
  archive.annotations.forEach(a => {
    archive.statistics.annotationsByType[a.type] = 
      (archive.statistics.annotationsByType[a.type] || 0) + 1
  })

  return archive
}

export function importJSONArchive(jsonData) {
  // 验证数据结构
  if (!jsonData || !jsonData.project || !jsonData.images) {
    throw new Error('无效的 JSON 归档格式')
  }

  return {
    project: jsonData.project,
    images: jsonData.images,
    annotations: jsonData.annotations,
    statistics: jsonData.statistics
  }
}

export default {
  exportJSONArchive,
  importJSONArchive
}
