import type { FilterNode, FilterNodeState, ImageSource, ProjectData } from '@/types'

const PROJECT_VERSION = '1.0.0'

export function createProject(
  name: string,
  description: string = '',
  imageSource: ImageSource | null = null,
  filterNodes: FilterNode[] = []
): ProjectData {
  const now = new Date().toISOString()
  return {
    version: PROJECT_VERSION,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    imageSource: imageSource ? serializeImageSource(imageSource) : null,
    filterNodes: filterNodes.map(serializeFilterNode)
  }
}

export function serializeFilterNode(node: FilterNode): FilterNode {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    parameters: { ...node.parameters },
    enabled: node.enabled,
    order: node.order
  }
}

export function deserializeFilterNode(data: any): FilterNode {
  return {
    id: data.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: data.type,
    name: data.name || data.type,
    parameters: { ...data.parameters },
    enabled: data.enabled !== false,
    order: typeof data.order === 'number' ? data.order : 0
  }
}

export function serializeImageSource(source: ImageSource): ImageSource {
  return {
    id: source.id,
    name: source.name,
    width: source.width,
    height: source.height,
    url: source.url,
    imageData: undefined
  }
}

export function validateProjectData(data: any): data is ProjectData {
  if (!data || typeof data !== 'object') return false
  if (typeof data.version !== 'string') return false
  if (typeof data.name !== 'string') return false
  if (!Array.isArray(data.filterNodes)) return false
  return true
}

export function exportProjectToJSON(project: ProjectData): string {
  return JSON.stringify(project, null, 2)
}

export function importProjectFromJSON(json: string): ProjectData | null {
  try {
    const data = JSON.parse(json)
    if (!validateProjectData(data)) {
      console.error('Invalid project data structure')
      return null
    }
    return {
      ...data,
      filterNodes: data.filterNodes.map(deserializeFilterNode)
    }
  } catch (error) {
    console.error('Failed to parse project JSON:', error)
    return null
  }
}

export function downloadProject(project: ProjectData): void {
  const json = exportProjectToJSON(project)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name.replace(/\s+/g, '_')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function loadProjectFromFile(file: File): Promise<ProjectData | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      resolve(importProjectFromJSON(content))
    }
    reader.onerror = () => {
      console.error('Failed to read project file')
      resolve(null)
    }
    reader.readAsText(file)
  })
}

export function migrateProject(data: any): ProjectData {
  if (data.version === PROJECT_VERSION) {
    return data
  }
  
  return {
    version: PROJECT_VERSION,
    name: data.name || 'Unnamed Project',
    description: data.description || '',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    imageSource: data.imageSource || null,
    filterNodes: (data.filterNodes || []).map(deserializeFilterNode)
  }
}
