import { ModelData, Issue, InspectionPoint } from '../types'

const calculateDistance = (pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number => {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  )
}

const calculateStringSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  if (s1 === s2) return 1
  if (s1.includes(s2) || s2.includes(s1)) return 0.9
  let matches = 0
  for (const char of s1) {
    if (s2.includes(char)) matches++
  }
  return matches / Math.max(s1.length, s2.length)
}

const isCloseToPI = (angle: number): boolean => {
  const normalized = Math.abs((angle % (Math.PI * 2)) - Math.PI)
  return normalized < 0.2 || Math.abs(normalized - Math.PI * 2) < 0.2
}

export const detectAxisFlipped = (model: ModelData): Issue | null => {
  const hasNegativeScale = model.scale.x < 0 || model.scale.y < 0 || model.scale.z < 0
  const rotationFlipped = isCloseToPI(model.rotation.y)
  
  if (hasNegativeScale || rotationFlipped) {
    return {
      id: '',
      versionId: '',
      modelId: model.id,
      type: 'AXIS_FLIPPED',
      status: 'PENDING',
      reason: `检测到模型可能存在坐标轴翻转${hasNegativeScale ? '（存在负缩放）' : ''}${rotationFlipped ? '（Y轴旋转接近180度）' : ''}，请人工确认朝向是否正确。`,
      nextStep: '请人工确认模型朝向是否正确，如需调整请在3D场景中旋转修正。如确认朝向无误，请标记为正常。',
      createdAt: ''
    }
  }
  return null
}

export const detectDuplicateModels = (models: ModelData[]): Issue[] => {
  const issues: Issue[] = []
  const distanceThreshold = 0.5
  const similarityThreshold = 0.7
  
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const m1 = models[i]
      const m2 = models[j]
      
      if (m1.type !== 'exhibit' || m2.type !== 'exhibit') continue
      
      const distance = calculateDistance(m1.position, m2.position)
      const similarity = calculateStringSimilarity(m1.name, m2.name)
      
      if (distance < distanceThreshold && similarity > similarityThreshold) {
        issues.push({
          id: '',
          versionId: '',
          modelId: m1.id,
          relatedModelId: m2.id,
          type: 'DUPLICATE',
          status: 'PENDING',
          reason: `检测到"${m1.name}"与"${m2.name}"位置过于接近（距离: ${distance.toFixed(2)}m），名称相似度${(similarity * 100).toFixed(0)}%，可能存在重复摆放。`,
          nextStep: '请确认是否为重复摆放，如重复请删除其中一个或调整位置。确认正常请标记为正常。',
          createdAt: ''
        })
      }
    }
  }
  return issues
}

export const detectPathBlocked = (models: ModelData[], path: InspectionPoint[]): Issue[] => {
  const issues: Issue[] = []
  const pathWidth = 1.5
  
  for (const model of models) {
    if (model.type !== 'exhibit') continue
    
    const modelBox = {
      minX: model.position.x - (model.geometry?.dimensions.width || 1) / 2,
      maxX: model.position.x + (model.geometry?.dimensions.width || 1) / 2,
      minZ: model.position.z - (model.geometry?.dimensions.depth || 1) / 2,
      maxZ: model.position.z + (model.geometry?.dimensions.depth || 1) / 2
    }
    
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]
      
      const pathMinX = Math.min(p1.x, p2.x) - pathWidth / 2
      const pathMaxX = Math.max(p1.x, p2.x) + pathWidth / 2
      const pathMinZ = Math.min(p1.z, p2.z) - pathWidth / 2
      const pathMaxZ = Math.max(p1.z, p2.z) + pathWidth / 2
      
      const overlaps = (
        modelBox.minX < pathMaxX &&
        modelBox.maxX > pathMinX &&
        modelBox.minZ < pathMaxZ &&
        modelBox.maxZ > pathMinZ
      )
      
      if (overlaps) {
        issues.push({
          id: '',
          versionId: '',
          modelId: model.id,
          type: 'PATH_BLOCKED',
          status: 'PENDING',
          reason: `检测到"${model.name}"位于巡检路线第${i + 1}段附近，可能遮挡巡视路线。`,
          nextStep: '请确认展品摆放是否影响巡视路线，如影响请调整位置。确认不影响请标记为正常。',
          createdAt: ''
        })
        break
      }
    }
  }
  return issues
}

export const detectAllIssues = (models: ModelData[], path: InspectionPoint[]): Omit<Issue, 'id' | 'createdAt'>[] => {
  const issues: Omit<Issue, 'id' | 'createdAt'>[] = []
  
  for (const model of models) {
    if (model.type !== 'exhibit') continue
    const axisIssue = detectAxisFlipped(model)
    if (axisIssue) {
      issues.push({
        versionId: '',
        modelId: axisIssue.modelId,
        type: axisIssue.type,
        status: axisIssue.status,
        reason: axisIssue.reason,
        nextStep: axisIssue.nextStep
      })
    }
  }
  
  const duplicateIssues = detectDuplicateModels(models)
  for (const issue of duplicateIssues) {
    issues.push({
      versionId: '',
      modelId: issue.modelId,
      relatedModelId: issue.relatedModelId,
      type: issue.type,
      status: issue.status,
      reason: issue.reason,
      nextStep: issue.nextStep
    })
  }
  
  const pathIssues = detectPathBlocked(models, path)
  for (const issue of pathIssues) {
    issues.push({
      versionId: '',
      modelId: issue.modelId,
      type: issue.type,
      status: issue.status,
      reason: issue.reason,
      nextStep: issue.nextStep
    })
  }
  
  return issues
}

export const compareVersions = (oldModels: ModelData[], newModels: ModelData[]) => {
  const changes = []
  
  const oldModelMap = new Map(oldModels.map(m => [m.id, m]))
  const newModelMap = new Map(newModels.map(m => [m.id, m]))
  
  for (const newModel of newModels) {
    const oldModel = oldModelMap.get(newModel.id)
    if (!oldModel) {
      changes.push({
        type: 'added',
        model: newModel,
        message: `新增模型: ${newModel.name}`
      })
    } else {
      const posDiff = calculateDistance(oldModel.position, newModel.position)
      if (posDiff > 0.1) {
        changes.push({
          type: 'position_changed',
          model: newModel,
          oldPosition: oldModel.position,
          newPosition: newModel.position,
          message: `模型"${newModel.name}"位置发生变化`
        })
      }
      
      const rotDiff = Math.abs(oldModel.rotation.y - newModel.rotation.y)
      if (rotDiff > 0.1) {
        changes.push({
          type: 'rotation_changed',
          model: newModel,
          message: `模型"${newModel.name}"朝向发生变化`
        })
      }
    }
  }
  
  for (const oldModel of oldModels) {
    if (!newModelMap.has(oldModel.id)) {
      changes.push({
        type: 'removed',
        model: oldModel,
        message: `删除模型: ${oldModel.name}`
      })
    }
  }
  
  return changes
}

export const getIssueTypeName = (type: string): string => {
  const names: Record<string, string> = {
    AXIS_FLIPPED: '坐标轴翻转',
    DUPLICATE: '模型重复摆放',
    PATH_BLOCKED: '路线被挡住',
    POSITION_SHIFT: '位置偏移'
  }
  return names[type] || type
}

export const getStatusName = (status: string): string => {
  const names: Record<string, string> = {
    PENDING: '待确认',
    CONFIRMED: '已确认',
    RESOLVED: '已解决',
    DISMISSED: '无问题'
  }
  return names[status] || status
}

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-red-100 text-red-800',
    RESOLVED: 'bg-green-100 text-green-800',
    DISMISSED: 'bg-gray-100 text-gray-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}
