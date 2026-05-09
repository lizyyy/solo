const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPackages: () => ipcRenderer.invoke('get:packages'),
  getMembers: () => ipcRenderer.invoke('get:members'),
  getRooms: () => ipcRenderer.invoke('get:rooms'),
  getReservations: () => ipcRenderer.invoke('get:reservations'),
  getAccessLogs: (reservationId) => ipcRenderer.invoke('get:access-logs', reservationId),
  getSettlements: (filters) => ipcRenderer.invoke('get:settlements', filters),
  getSettlementDetail: (settlementId) => ipcRenderer.invoke('get:settlement-detail', settlementId),
  
  createMember: (data) => ipcRenderer.invoke('create:member', data),
  createReservation: (data) => ipcRenderer.invoke('create:reservation', data),
  createAccessLog: (data) => ipcRenderer.invoke('create:access-log', data),
  
  executeSettlement: (reservationId) => ipcRenderer.invoke('execute:settlement', reservationId),
  retrySettlement: (settlementId, corrections) => ipcRenderer.invoke('retry:settlement', settlementId, corrections),
  extendReservation: (data) => ipcRenderer.invoke('extend:reservation', data),
  
  exportSettlements: (filters) => ipcRenderer.invoke('export:settlements', filters),
  searchHistory: (filters) => ipcRenderer.invoke('search:history', filters)
});
