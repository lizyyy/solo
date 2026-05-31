import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { Project, Version, ModelData, Issue, IssueStatus, OperationLog, PageType } from '../types'

interface AppState {
  currentPage: PageType
  currentProject: Project | null
  currentVersion: Version | null
  projects: Project[]
  versions: Version[]
  issues: Issue[]
  selectedModelId: string | null
  selectedIssueId: string | null
  operationLogs: OperationLog[]
  
  setCurrentPage: (page: PageType) => void
  createProject: (name: string) => Project
  selectProject: (projectId: string) => void
  createVersion: (versionName: string, models: ModelData[]) => Version
  selectVersion: (versionId: string) => void
  addIssue: (issue: Omit<Issue, 'id' | 'createdAt'>) => void
  updateIssueStatus: (issueId: string, status: IssueStatus, resolvedBy?: string) => void
  updateIssueReason: (issueId: string, reason: string, nextStep: string) => void
  selectModel: (modelId: string | null) => void
  selectIssue: (issueId: string | null) => void
  updateModel: (modelId: string, updates: Partial<ModelData>) => void
  addOperationLog: (log: Omit<OperationLog, 'id' | 'timestamp'>) => void
  loadSampleData: () => void
  exportProjectData: () => string
  importProjectData: (data: string) => void
}

const STORAGE_KEY = 'pipe-gallery-inspection-data'

const saveToStorage = (state: Partial<AppState>) => {
  const data = {
    projects: state.projects,
    versions: state.versions,
    issues: state.issues,
    operationLogs: state.operationLogs
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const loadFromStorage = (): Partial<AppState> | null => {
  const data = localStorage.getItem(STORAGE_KEY)
  if (data) {
    return JSON.parse(data)
  }
  return null
}

export const useStore = create<AppState>((set, get) => {
  const storedData = loadFromStorage()
  
  return {
    currentPage: 'home',
    currentProject: null,
    currentVersion: null,
    projects: storedData?.projects || [],
    versions: storedData?.versions || [],
    issues: storedData?.issues || [],
    selectedModelId: null,
    selectedIssueId: null,
    operationLogs: storedData?.operationLogs || [],
    
    setCurrentPage: (page) => set({ currentPage: page }),
    
    createProject: (name) => {
      const newProject: Project = {
        id: uuidv4(),
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      set((state) => {
        const newProjects = [...state.projects, newProject]
        saveToStorage({ ...state, projects: newProjects })
        return { projects: newProjects, currentProject: newProject }
      })
      return newProject
    },
    
    selectProject: (projectId) => {
      const project = get().projects.find(p => p.id === projectId) || null
      const projectVersions = get().versions.filter(v => v.projectId === projectId)
      const latestVersion = projectVersions.length > 0 
        ? projectVersions.reduce((a, b) => a.versionNumber > b.versionNumber ? a : b)
        : null
      set({ 
        currentProject: project, 
        currentVersion: latestVersion
      })
    },
    
    createVersion: (versionName, models) => {
      const state = get()
      if (!state.currentProject) throw new Error('No project selected')
      
      const projectVersions = state.versions.filter(v => v.projectId === state.currentProject!.id)
      const newVersionNumber = projectVersions.length > 0
        ? Math.max(...projectVersions.map(v => v.versionNumber)) + 1
        : 1
      
      const inspectionPath = [
        { x: -8, y: 0.5, z: 0, order: 0 },
        { x: -4, y: 0.5, z: 0, order: 1 },
        { x: 0, y: 0.5, z: 0, order: 2 },
        { x: 4, y: 0.5, z: 0, order: 3 },
        { x: 8, y: 0.5, z: 0, order: 4 }
      ]
      
      const newVersion: Version = {
        id: uuidv4(),
        projectId: state.currentProject.id,
        name: versionName || `版本 ${newVersionNumber}`,
        versionNumber: newVersionNumber,
        createdAt: new Date().toISOString(),
        models,
        inspectionPath
      }
      
      set((s) => {
        const newVersions = [...s.versions, newVersion]
        saveToStorage({ ...s, versions: newVersions })
        return { versions: newVersions, currentVersion: newVersion }
      })
      
      get().addOperationLog({
        versionId: newVersion.id,
        type: 'VERSION_CREATED',
        description: `创建版本: ${newVersion.name}`,
        operator: '巡检人员'
      })
      
      return newVersion
    },
    
    selectVersion: (versionId) => {
      const version = get().versions.find(v => v.id === versionId) || null
      set({ currentVersion: version })
    },
    
    addIssue: (issue) => {
      const newIssue: Issue = {
        ...issue,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      }
      set((state) => {
        const newIssues = [...state.issues, newIssue]
        saveToStorage({ ...state, issues: newIssues })
        return { issues: newIssues }
      })
    },
    
    updateIssueStatus: (issueId, status, resolvedBy) => {
      const state = get()
      const issue = state.issues.find(i => i.id === issueId)
      if (!issue) return
      
      const oldStatus = issue.status
      set((s) => {
        const newIssues = s.issues.map(i => 
          i.id === issueId 
            ? { ...i, status, resolvedAt: status === 'RESOLVED' ? new Date().toISOString() : undefined, resolvedBy }
            : i
        )
        saveToStorage({ ...s, issues: newIssues })
        return { issues: newIssues }
      })
      
      get().addOperationLog({
        versionId: issue.versionId,
        type: 'ISSUE_STATUS_CHANGE',
        description: `问题状态变更: ${issue.type}`,
        oldValue: oldStatus,
        newValue: status,
        operator: resolvedBy || '巡检人员'
      })
    },
    
    updateIssueReason: (issueId, reason, nextStep) => {
      set((state) => {
        const newIssues = state.issues.map(i =>
          i.id === issueId ? { ...i, reason, nextStep } : i
        )
        saveToStorage({ ...state, issues: newIssues })
        return { issues: newIssues }
      })
    },
    
    selectModel: (modelId) => set({ selectedModelId: modelId }),
    
    selectIssue: (issueId) => set({ selectedIssueId: issueId }),
    
    updateModel: (modelId, updates) => {
      const state = get()
      if (!state.currentVersion) return
      
      const model = state.currentVersion.models.find(m => m.id === modelId)
      
      set((s) => {
        const newVersions = s.versions.map(v => 
          v.id === s.currentVersion?.id
            ? {
                ...v,
                models: v.models.map(m => m.id === modelId ? { ...m, ...updates } : m)
              }
            : v
        )
        const currentVersion = newVersions.find(v => v.id === s.currentVersion?.id) || null
        saveToStorage({ ...s, versions: newVersions })
        return { versions: newVersions, currentVersion }
      })
      
      if (model && updates.position) {
        get().addOperationLog({
          versionId: state.currentVersion.id,
          type: 'MODEL_MODIFIED',
          description: `模型位置变更: ${model.name}`,
          oldValue: JSON.stringify(model.position),
          newValue: JSON.stringify(updates.position),
          operator: '巡检人员'
        })
      }
    },
    
    addOperationLog: (log) => {
      const newLog: OperationLog = {
        ...log,
        id: uuidv4(),
        timestamp: new Date().toISOString()
      }
      set((state) => {
        const newLogs = [...state.operationLogs, newLog]
        saveToStorage({ ...state, operationLogs: newLogs })
        return { operationLogs: newLogs }
      })
    },
    
    loadSampleData: () => {
      const sampleModels: ModelData[] = [
        {
          id: uuidv4(),
          name: '阀门组A',
          type: 'exhibit',
          position: { x: -5, y: 0.5, z: -2 },
          rotation: { x: 0, y: Math.PI, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          geometry: { type: 'box', dimensions: { width: 1.5, height: 1, depth: 1 } },
          color: '#3498db'
        },
        {
          id: uuidv4(),
          name: '阀门组B',
          type: 'exhibit',
          position: { x: -5, y: 0.5, z: -1.9 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          geometry: { type: 'box', dimensions: { width: 1.5, height: 1, depth: 1 } },
          color: '#3498db'
        },
        {
          id: uuidv4(),
          name: '管道展示',
          type: 'exhibit',
          position: { x: 0, y: 0.5, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          geometry: { type: 'cylinder', dimensions: { width: 0, height: 2, depth: 0, radius: 0.5 } },
          color: '#e74c3c'
        },
        {
          id: uuidv4(),
          name: '监控设备',
          type: 'exhibit',
          position: { x: 5, y: 0.8, z: -2 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          geometry: { type: 'box', dimensions: { width: 0.8, height: 1.6, depth: 0.6 } },
          color: '#2ecc71'
        },
        {
          id: uuidv4(),
          name: '管廊墙体',
          type: 'structure',
          position: { x: 0, y: 2, z: -5 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          geometry: { type: 'box', dimensions: { width: 20, height: 4, depth: 0.3 } },
          color: '#95a5a6'
        },
        {
          id: uuidv4(),
          name: '管廊地面',
          type: 'structure',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          geometry: { type: 'box', dimensions: { width: 20, height: 0.1, depth: 10 } },
          color: '#7f8c8d'
        }
      ]
      
      const project = get().createProject('地下管廊展厅项目')
      get().createVersion('初始版本', sampleModels)
    },
    
    exportProjectData: () => {
      const state = get()
      const exportData = {
        projects: state.projects,
        versions: state.versions,
        issues: state.issues,
        operationLogs: state.operationLogs,
        exportedAt: new Date().toISOString()
      }
      return JSON.stringify(exportData, null, 2)
    },
    
    importProjectData: (data) => {
      const parsed = JSON.parse(data)
      set({
        projects: parsed.projects || [],
        versions: parsed.versions || [],
        issues: parsed.issues || [],
        operationLogs: parsed.operationLogs || []
      })
      saveToStorage({
        projects: parsed.projects || [],
        versions: parsed.versions || [],
        issues: parsed.issues || [],
        operationLogs: parsed.operationLogs || []
      })
    }
  }
})
