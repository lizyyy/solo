const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getOrders: (filters) => ipcRenderer.invoke('getOrders', filters),
  getOrderById: (id) => ipcRenderer.invoke('getOrderById', id),
  getOrderRisks: (orderId) => ipcRenderer.invoke('getOrderRisks', orderId),
  createOrder: (orderData) => ipcRenderer.invoke('createOrder', orderData),
  updateOrder: (id, orderData) => ipcRenderer.invoke('updateOrder', id, orderData),
  updateRiskStatus: (riskId, status, remark) => ipcRenderer.invoke('updateRiskStatus', riskId, status, remark),
  addNote: (orderId, note) => ipcRenderer.invoke('addNote', orderId, note),
  getNotes: (orderId) => ipcRenderer.invoke('getNotes', orderId),
  importExcel: () => ipcRenderer.invoke('importExcel'),
  exportMarkdown: (orderId) => ipcRenderer.invoke('exportMarkdown', orderId),
  exportJSON: () => ipcRenderer.invoke('exportJSON'),
  getRiskStatistics: () => ipcRenderer.invoke('getRiskStatistics'),
  searchOrders: (keyword) => ipcRenderer.invoke('searchOrders', keyword)
});
