import * as XLSX from 'xlsx';

const electronAPI = window.electronAPI;

export const generateId = () => {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
};

export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatFileSize = (bytes) => {
  if (bytes === undefined || bytes === null) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename) => {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const getFileIcon = (filename) => {
  const ext = getFileExtension(filename);
  const iconMap = {
    doc: '📄',
    docx: '📄',
    pdf: '📕',
    xls: '📊',
    xlsx: '📊',
    ppt: '📽️',
    pptx: '📽️',
    txt: '📝',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    zip: '📦',
    rar: '📦',
    mp4: '🎥',
    mp3: '🎵',
  };
  return iconMap[ext] || '📁';
};

export const DISPATCH_STATUS = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  CONFIRMED: 'confirmed',
  SENT: 'sent',
  CANCELLED: 'cancelled',
};

export const DISPATCH_STATUS_LABELS = {
  [DISPATCH_STATUS.PENDING]: '待处理',
  [DISPATCH_STATUS.REVIEWING]: '复核中',
  [DISPATCH_STATUS.CONFIRMED]: '已确认',
  [DISPATCH_STATUS.SENT]: '已发送',
  [DISPATCH_STATUS.CANCELLED]: '已取消',
};

export const DISPATCH_STATUS_COLORS = {
  [DISPATCH_STATUS.PENDING]: 'badge-default',
  [DISPATCH_STATUS.REVIEWING]: 'badge-warning',
  [DISPATCH_STATUS.CONFIRMED]: 'badge-primary',
  [DISPATCH_STATUS.SENT]: 'badge-success',
  [DISPATCH_STATUS.CANCELLED]: 'badge-danger',
};

export const selectFiles = async (options = {}) => {
  const result = await electronAPI.openFileDialog({
    properties: ['openFile', 'multiSelections'],
    ...options,
  });
  return result.canceled ? [] : result.filePaths;
};

export const saveFileDialog = async (options = {}) => {
  const result = await electronAPI.saveFileDialog({
    ...options,
  });
  return result.canceled ? null : result.filePath;
};

export const showMessageBox = async (options) => {
  return await electronAPI.showMessageBox(options);
};

export const confirmAction = async (message, title = '确认操作') => {
  const result = await showMessageBox({
    type: 'question',
    buttons: ['取消', '确定'],
    defaultId: 0,
    title,
    message,
  });
  return result.response === 1;
};

export const showAlert = async (message, type = 'info', title = '提示') => {
  const iconMap = {
    info: 'information',
    success: 'info',
    warning: 'warning',
    error: 'error',
  };
  await showMessageBox({
    type: iconMap[type] || 'information',
    buttons: ['确定'],
    title,
    message,
  });
};

export const copyFile = async (sourcePath, destPath) => {
  return await electronAPI.copyFile(sourcePath, destPath);
};

export const openFileInFolder = async (filePath) => {
  await electronAPI.showItemInFolder(filePath);
};

export const exportToExcel = async (data, fileName, sheetName = 'Sheet1') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const buffer = Buffer.from(excelBuffer);
  
  const filePath = await saveFileDialog({
    title: '保存 Excel 文件',
    defaultPath: `${fileName}.xlsx`,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
  });
  
  if (!filePath) return null;
  
  const fs = require('fs');
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

export const exportToCSV = async (data, fileName) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  
  const filePath = await saveFileDialog({
    title: '保存 CSV 文件',
    defaultPath: `${fileName}.csv`,
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
  });
  
  if (!filePath) return null;
  
  const fs = require('fs');
  fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
  return filePath;
};

export const toast = {
  show(message, type = 'info', duration = 3000) {
    const container = document.querySelector('.toast-container');
    if (!container) {
      const newContainer = document.createElement('div');
      newContainer.className = 'toast-container';
      document.body.appendChild(newContainer);
    }
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    
    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };
    
    toastEl.innerHTML = `
      <span>${iconMap[type] || 'ℹ️'}</span>
      <span>${message}</span>
    `;
    
    document.querySelector('.toast-container').appendChild(toastEl);
    
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(100%)';
      toastEl.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        toastEl.remove();
      }, 300);
    }, duration);
  },
  
  info(message) {
    this.show(message, 'info');
  },
  
  success(message) {
    this.show(message, 'success');
  },
  
  warning(message) {
    this.show(message, 'warning');
  },
  
  error(message) {
    this.show(message, 'error');
  },
};
