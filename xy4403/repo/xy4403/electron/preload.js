const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getBatches: () => ipcRenderer.invoke('get-all-batches'),
  getBatchById: (id) => ipcRenderer.invoke('get-batch-by-id', id),
  createBatch: (batchData) => ipcRenderer.invoke('create-batch', batchData),
  updateBatchStatus: (data) => ipcRenderer.invoke('update-batch-status', data),
  
  getAppointmentsByBatch: (batchId) => ipcRenderer.invoke('get-appointments-by-batch', batchId),
  getAllAppointments: () => ipcRenderer.invoke('get-all-appointments'),
  createAppointment: (data) => ipcRenderer.invoke('create-appointment', data),
  updateAppointment: (data) => ipcRenderer.invoke('update-appointment', data),
  
  getAllChemicals: () => ipcRenderer.invoke('get-all-chemicals'),
  getActiveChemicals: () => ipcRenderer.invoke('get-active-chemicals'),
  createChemical: (data) => ipcRenderer.invoke('create-chemical', data),
  updateChemicalUsage: (data) => ipcRenderer.invoke('update-chemical-usage', data),
  deactivateChemical: (id) => ipcRenderer.invoke('deactivate-chemical', id),
  
  getAllDarkBags: () => ipcRenderer.invoke('get-all-darkbags'),
  createDarkBag: (data) => ipcRenderer.invoke('create-darkbag', data),
  updateDarkBag: (data) => ipcRenderer.invoke('update-darkbag', data),
  
  createPickup: (data) => ipcRenderer.invoke('create-pickup', data),
  getPickupByAppointment: (appointmentId) => ipcRenderer.invoke('get-pickup-by-appointment', appointmentId),
  
  checkRulesForBatch: (batchId) => ipcRenderer.invoke('check-rules-for-batch', batchId),
  checkPickupMatch: (data) => ipcRenderer.invoke('check-pickup-match', data),
  checkDarkBagDuplicate: (bagNumber, excludeId) => ipcRenderer.invoke('check-darkbag-duplicate', bagNumber, excludeId),
  checkChemicalRules: (chemicalId) => ipcRenderer.invoke('check-chemical-rules', chemicalId),
  
  overrideViolation: (data) => ipcRenderer.invoke('override-violation', data),
  
  getAuditLogs: (limit) => ipcRenderer.invoke('get-audit-logs', limit),
  
  exportJSON: (dataType) => ipcRenderer.invoke('export-json', dataType),
  exportHandoverMD: (batchId) => ipcRenderer.invoke('export-handover-md', batchId)
})
