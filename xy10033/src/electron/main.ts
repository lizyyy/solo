import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDatabase, closeDatabase } from './database';
import { initializeSeedData } from './seedData';
import { ROLE_PERMISSIONS, DEFAULT_PAGE_SIZE } from '../shared/constants';
import {
  User,
  UserRole,
  ReissueStatus,
  ReissueQueryParams,
  ImportResult,
  PaginatedResult,
  ReissueOrder,
  ReissueHistory,
  AuditLog,
  FailedOperation,
  OperationType
} from '../shared/types';
import * as userService from './services/userService';
import * as reorderService from './services/reorderService';
import * as batchService from './services/batchService';
import * as auditService from './services/auditService';
import * as importExportService from './services/importExportService';

let mainWindow: BrowserWindow | null = null;
let currentUser: User | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function hasPermission(permission: string): boolean {
  if (!currentUser) return false;
  const permissions = ROLE_PERMISSIONS[currentUser.role] || [];
  return permissions.includes(permission);
}

function requirePermission(permission: string): void {
  if (!hasPermission(permission)) {
    throw new Error('无权限执行此操作');
  }
}

app.whenReady().then(() => {
  getDatabase();
  initializeSeedData();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
  const user = userService.authenticate(username, password);
  if (user) {
    currentUser = user;
    const { password: _p, ...safeUser } = user;
    return { success: true, user: safeUser };
  }
  return { success: false, error: '用户名或密码错误' };
});

ipcMain.handle('auth:logout', async () => {
  currentUser = null;
  return { success: true };
});

ipcMain.handle('auth:getCurrentUser', async () => {
  if (!currentUser) return { success: false, error: '未登录' };
  const { password: _p, ...safeUser } = currentUser;
  return { success: true, user: safeUser };
});

ipcMain.handle('user:list', async () => {
  requirePermission('user.read');
  const users = userService.listUsers();
  return { success: true, data: users.map(u => { const { password: _p, ...safe } = u; return safe; }) };
});

ipcMain.handle('user:create', async (_event, data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
  requirePermission('user.create');
  if (!currentUser) throw new Error('未登录');
  
  const user = userService.createUser(data, currentUser);
  const { password: _p, ...safeUser } = user;
  return { success: true, data: safeUser };
});

ipcMain.handle('user:update', async (_event, id: string, data: Partial<User>) => {
  requirePermission('user.update');
  if (!currentUser) throw new Error('未登录');
  
  const user = userService.updateUser(id, data, currentUser);
  const { password: _p, ...safeUser } = user;
  return { success: true, data: safeUser };
});

ipcMain.handle('user:delete', async (_event, id: string) => {
  requirePermission('user.delete');
  if (!currentUser) throw new Error('未登录');
  
  userService.deleteUser(id, currentUser);
  return { success: true };
});

ipcMain.handle('order:list', async (_event, params: ReissueQueryParams) => {
  requirePermission('order.read');
  const result = reorderService.listOrders({
    ...params,
    pageSize: params.pageSize || DEFAULT_PAGE_SIZE
  });
  return { success: true, data: result };
});

ipcMain.handle('order:get', async (_event, id: string) => {
  requirePermission('order.read');
  const order = reorderService.getOrderById(id);
  if (!order) return { success: false, error: '订单不存在' };
  return { success: true, data: order };
});

ipcMain.handle('order:create', async (_event, data: any) => {
  requirePermission('order.create');
  if (!currentUser) throw new Error('未登录');
  
  const order = reorderService.createOrder(data, currentUser);
  return { success: true, data: order };
});

ipcMain.handle('order:update', async (_event, id: string, data: any) => {
  requirePermission('order.update');
  if (!currentUser) throw new Error('未登录');
  
  const order = reorderService.updateOrder(id, data, currentUser);
  return { success: true, data: order };
});

ipcMain.handle('order:changeStatus', async (_event, id: string, newStatus: ReissueStatus, reason: string | null) => {
  requirePermission('order.update');
  if (!currentUser) throw new Error('未登录');
  
  const order = reorderService.changeOrderStatus(id, newStatus, reason, currentUser);
  return { success: true, data: order };
});

ipcMain.handle('order:delete', async (_event, id: string) => {
  requirePermission('order.delete');
  if (!currentUser) throw new Error('未登录');
  
  reorderService.deleteOrder(id, currentUser);
  return { success: true };
});

ipcMain.handle('order:history', async (_event, orderId: string) => {
  requirePermission('order.read');
  const history = reorderService.getOrderHistory(orderId);
  return { success: true, data: history };
});

ipcMain.handle('batch:changeStatus', async (_event, orderIds: string[], newStatus: ReissueStatus, reason: string | null) => {
  requirePermission('order.batch_update');
  if (!currentUser) throw new Error('未登录');
  
  const result = batchService.batchChangeStatus(orderIds, newStatus, reason, currentUser);
  return { success: true, data: result };
});

ipcMain.handle('batch:assign', async (_event, orderIds: string[], assigneeId: string, assigneeName: string) => {
  requirePermission('order.batch_update');
  if (!currentUser) throw new Error('未登录');
  
  const result = batchService.batchAssignOrders(orderIds, assigneeId, assigneeName, currentUser);
  return { success: true, data: result };
});

ipcMain.handle('failed:list', async () => {
  requirePermission('system.recover');
  const failedOps = batchService.listFailedOperations();
  return { success: true, data: failedOps };
});

ipcMain.handle('failed:retry', async (_event, failedOpId: string) => {
  requirePermission('system.recover');
  if (!currentUser) throw new Error('未登录');
  
  const result = batchService.retryFailedOperation(failedOpId, currentUser);
  return { success: result.success, message: result.message };
});

ipcMain.handle('failed:clear', async (_event, failedOpId: string) => {
  requirePermission('system.recover');
  if (!currentUser) throw new Error('未登录');
  
  const result = batchService.clearFailedOperation(failedOpId, currentUser);
  return { success: result };
});

ipcMain.handle('log:list', async (_event, params: {
  page: number;
  pageSize: number;
  operationType?: OperationType;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  requirePermission('log.read');
  const result = auditService.listAuditLogs({
    ...params,
    pageSize: params.pageSize || DEFAULT_PAGE_SIZE
  });
  return { success: true, data: result };
});

ipcMain.handle('import:excel', async (_event, filePath: string) => {
  requirePermission('order.import');
  if (!currentUser) throw new Error('未登录');
  
  const buffer = fs.readFileSync(filePath);
  const result = importExportService.importFromExcel(buffer, currentUser);
  return { success: true, data: result };
});

ipcMain.handle('import:csv', async (_event, filePath: string) => {
  requirePermission('order.import');
  if (!currentUser) throw new Error('未登录');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = importExportService.importFromCSV(content, currentUser);
  return { success: true, data: result };
});

ipcMain.handle('export:excel', async (_event, orderIds?: string[]) => {
  requirePermission('order.export');
  if (!currentUser) throw new Error('未登录');
  
  let orders: ReissueOrder[];
  if (orderIds && orderIds.length > 0) {
    orders = orderIds.map(id => reorderService.getOrderById(id)).filter(Boolean) as ReissueOrder[];
  } else {
    const result = reorderService.listOrders({ page: 1, pageSize: 10000 });
    orders = result.data;
  }
  
  const buffer = importExportService.exportToExcel(orders);
  
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: '导出Excel',
    defaultPath: `补发订单_${Date.now()}.xlsx`,
    filters: [{ name: 'Excel文件', extensions: ['xlsx'] }]
  });
  
  if (canceled || !filePath) {
    return { success: false, message: '用户取消导出' };
  }
  
  fs.writeFileSync(filePath, buffer);
  return { success: true, data: { filePath, count: orders.length } };
});

ipcMain.handle('export:csv', async (_event, orderIds?: string[]) => {
  requirePermission('order.export');
  if (!currentUser) throw new Error('未登录');
  
  let orders: ReissueOrder[];
  if (orderIds && orderIds.length > 0) {
    orders = orderIds.map(id => reorderService.getOrderById(id)).filter(Boolean) as ReissueOrder[];
  } else {
    const result = reorderService.listOrders({ page: 1, pageSize: 10000 });
    orders = result.data;
  }
  
  const content = importExportService.exportToCSV(orders);
  
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: '导出CSV',
    defaultPath: `补发订单_${Date.now()}.csv`,
    filters: [{ name: 'CSV文件', extensions: ['csv'] }]
  });
  
  if (canceled || !filePath) {
    return { success: false, message: '用户取消导出' };
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
  return { success: true, data: { filePath, count: orders.length } };
});

ipcMain.handle('export:template', async () => {
  const buffer = importExportService.getImportTemplate();
  
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
    title: '下载导入模板',
    defaultPath: '补发订单导入模板.xlsx',
    filters: [{ name: 'Excel文件', extensions: ['xlsx'] }]
  });
  
  if (canceled || !filePath) {
    return { success: false, message: '用户取消下载' };
  }
  
  fs.writeFileSync(filePath, buffer);
  return { success: true, data: { filePath } };
});

ipcMain.handle('file:openDialog', async (_event, options: Electron.OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result;
});
