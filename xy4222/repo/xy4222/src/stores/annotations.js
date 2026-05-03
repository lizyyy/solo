import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCurrentProjectStore } from './currentProject'
import { useProjectsStore } from './projects'
import Annotation from '../models/Annotation'
import AnnotationType from '../models/AnnotationType'
import RiskLevel from '../models/RiskLevel'

export const useAnnotationsStore = defineStore('annotations', () => {
  const currentProjectStore = useCurrentProjectStore()
  const projectsStore = useProjectsStore()

  const selectedAnnotationId = ref(null)
  const isDrawing = ref(false)
  const drawingStart = ref({ x: 0, y: 0 })

  const selectedAnnotation = computed(() => {
    if (!selectedAnnotationId.value || !currentProjectStore.selectedImage) {
      return null
    }
    return currentProjectStore.selectedImage.getAnnotation(selectedAnnotationId.value)
  })

  const currentImageAnnotations = computed(() => {
    if (!currentProjectStore.selectedImage) return []
    return currentProjectStore.selectedImage.annotations
  })

  const allProjectAnnotations = computed(() => {
    if (!currentProjectStore.currentProject) return []
    const annotations = []
    currentProjectStore.currentProject.images.forEach(image => {
      image.annotations.forEach(annotation => {
        annotations.push({
          ...annotation.toJSON(),
          image: image.toJSON()
        })
      })
    })
    return annotations
  })

  const annotationCount = computed(() => {
    return allProjectAnnotations.value.length
  })

  // 按风险等级统计
  const annotationsByRisk = computed(() => {
    const stats = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0
    }
    allProjectAnnotations.value.forEach(a => {
      stats[a.riskLevel] = (stats[a.riskLevel] || 0) + 1
    })
    return stats
  })

  // 按类型统计
  const annotationsByType = computed(() => {
    const stats = {}
    allProjectAnnotations.value.forEach(a => {
      stats[a.type] = (stats[a.type] || 0) + 1
    })
    return stats
  })

  // 开始绘制
  function startDrawing(x, y) {
    isDrawing.value = true
    drawingStart.value = { x, y }
  }

  // 结束绘制并创建批注
  function endDrawing(x, y, imageId) {
    if (!isDrawing.value) return null
    
    isDrawing.value = false
    
    const width = Math.abs(x - drawingStart.value.x)
    const height = Math.abs(y - drawingStart.value.y)
    
    // 最小尺寸检查
    if (width < 10 || height < 10) {
      return null
    }
    
    const position = {
      x: Math.min(x, drawingStart.value.x),
      y: Math.min(y, drawingStart.value.y),
      width,
      height
    }
    
    return createAnnotation({
      imageId,
      position,
      type: AnnotationType.CRACK,
      riskLevel: RiskLevel.MEDIUM
    })
  }

  // 创建批注
  function createAnnotation(annotationData) {
    if (!currentProjectStore.selectedImage) return null
    
    const image = currentProjectStore.selectedImage
    const annotation = image.addAnnotation(annotationData)
    projectsStore.saveProjects()
    
    selectedAnnotationId.value = annotation.id
    return annotation
  }

  // 更新批注
  function updateAnnotation(annotationId, data) {
    if (!currentProjectStore.selectedImage) return null
    
    const image = currentProjectStore.selectedImage
    const updatedAnnotation = image.updateAnnotation(annotationId, data)
    if (updatedAnnotation) {
      projectsStore.saveProjects()
    }
    return updatedAnnotation
  }

  // 删除批注
  function removeAnnotation(annotationId) {
    if (!currentProjectStore.selectedImage) return false
    
    const image = currentProjectStore.selectedImage
    const result = image.removeAnnotation(annotationId)
    if (result) {
      if (selectedAnnotationId.value === annotationId) {
        selectedAnnotationId.value = null
      }
      projectsStore.saveProjects()
    }
    return result
  }

  // 选择批注
  function selectAnnotation(annotationId) {
    selectedAnnotationId.value = annotationId
  }

  // 清除选择
  function clearSelection() {
    selectedAnnotationId.value = null
  }

  // 按风险等级过滤批注
  function getAnnotationsByRiskLevel(riskLevel) {
    return allProjectAnnotations.value.filter(a => a.riskLevel === riskLevel)
  }

  // 按类型过滤批注
  function getAnnotationsByType(type) {
    return allProjectAnnotations.value.filter(a => a.type === type)
  }

  // 按风险等级排序
  function sortAnnotationsByRisk(annotations = null) {
    const list = annotations || allProjectAnnotations.value
    return [...list].sort((a, b) => {
      const riskOrder = {
        [RiskLevel.CRITICAL]: 4,
        [RiskLevel.HIGH]: 3,
        [RiskLevel.MEDIUM]: 2,
        [RiskLevel.LOW]: 1
      }
      return riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
    })
  }

  return {
    selectedAnnotationId,
    isDrawing,
    drawingStart,
    selectedAnnotation,
    currentImageAnnotations,
    allProjectAnnotations,
    annotationCount,
    annotationsByRisk,
    annotationsByType,
    startDrawing,
    endDrawing,
    createAnnotation,
    updateAnnotation,
    removeAnnotation,
    selectAnnotation,
    clearSelection,
    getAnnotationsByRiskLevel,
    getAnnotationsByType,
    sortAnnotationsByRisk
  }
})
