import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // File dialogs
  openFileDialog: (options: { filters?: { name: string; extensions: string[] }[] } = {}) =>
    ipcRenderer.invoke('open-file-dialog', options),
  
  openDirectoryDialog: () =>
    ipcRenderer.invoke('open-directory-dialog'),

  // Parsers
  parseSceneSheet: (filePath: string) =>
    ipcRenderer.invoke('parse-scene-sheet', filePath),
  
  parsePropStatus: (filePath: string) =>
    ipcRenderer.invoke('parse-prop-status', filePath),
  
  parseActorCallSheet: (filePath: string) =>
    ipcRenderer.invoke('parse-actor-call-sheet', filePath),

  // Validators
  validateContinuity: (data: {
    scenes: any[]
    propStatus: any[]
    actorCalls: any[]
    photoDirectory?: string
  }) =>
    ipcRenderer.invoke('validate-continuity', data),

  // Database operations
  getAllReviews: () =>
    ipcRenderer.invoke('get-all-reviews'),
  
  saveReview: (review: any) =>
    ipcRenderer.invoke('save-review', review),
  
  getReviewByIssueId: (issueId: string) =>
    ipcRenderer.invoke('get-review-by-issue-id', issueId),

  getAllProjects: () =>
    ipcRenderer.invoke('get-all-projects'),
  
  saveProject: (project: any) =>
    ipcRenderer.invoke('save-project', project),
  
  getProject: (projectId: string) =>
    ipcRenderer.invoke('get-project', projectId),

  // Export
  exportMarkdown: (data: any, savePath?: string) =>
    ipcRenderer.invoke('export-markdown', data, savePath),
  
  exportCSV: (data: any, savePath?: string) =>
    ipcRenderer.invoke('export-csv', data, savePath),
  
  exportJSON: (data: any, savePath?: string) =>
    ipcRenderer.invoke('export-json', data, savePath),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
