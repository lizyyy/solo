"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("./database");
const seedData_1 = require("./seedData");
const constants_1 = require("../shared/constants");
const userService = __importStar(require("./services/userService"));
const reorderService = __importStar(require("./services/reorderService"));
const batchService = __importStar(require("./services/batchService"));
const auditService = __importStar(require("./services/auditService"));
const importExportService = __importStar(require("./services/importExportService"));
let mainWindow = null;
let currentUser = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function hasPermission(permission) {
    if (!currentUser)
        return false;
    const permissions = constants_1.ROLE_PERMISSIONS[currentUser.role] || [];
    return permissions.includes(permission);
}
function requirePermission(permission) {
    if (!hasPermission(permission)) {
        throw new Error('无权限执行此操作');
    }
}
electron_1.app.whenReady().then(() => {
    (0, database_1.getDatabase)();
    (0, seedData_1.initializeSeedData)();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    (0, database_1.closeDatabase)();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.ipcMain.handle('auth:login', async (_event, username, password) => {
    const user = userService.authenticate(username, password);
    if (user) {
        currentUser = user;
        const { password: _p, ...safeUser } = user;
        return { success: true, user: safeUser };
    }
    return { success: false, error: '用户名或密码错误' };
});
electron_1.ipcMain.handle('auth:logout', async () => {
    currentUser = null;
    return { success: true };
});
electron_1.ipcMain.handle('auth:getCurrentUser', async () => {
    if (!currentUser)
        return { success: false, error: '未登录' };
    const { password: _p, ...safeUser } = currentUser;
    return { success: true, user: safeUser };
});
electron_1.ipcMain.handle('user:list', async () => {
    requirePermission('user.read');
    const users = userService.listUsers();
    return { success: true, data: users.map(u => { const { password: _p, ...safe } = u; return safe; }) };
});
electron_1.ipcMain.handle('user:create', async (_event, data) => {
    requirePermission('user.create');
    if (!currentUser)
        throw new Error('未登录');
    const user = userService.createUser(data, currentUser);
    const { password: _p, ...safeUser } = user;
    return { success: true, data: safeUser };
});
electron_1.ipcMain.handle('user:update', async (_event, id, data) => {
    requirePermission('user.update');
    if (!currentUser)
        throw new Error('未登录');
    const user = userService.updateUser(id, data, currentUser);
    const { password: _p, ...safeUser } = user;
    return { success: true, data: safeUser };
});
electron_1.ipcMain.handle('user:delete', async (_event, id) => {
    requirePermission('user.delete');
    if (!currentUser)
        throw new Error('未登录');
    userService.deleteUser(id, currentUser);
    return { success: true };
});
electron_1.ipcMain.handle('order:list', async (_event, params) => {
    requirePermission('order.read');
    const result = reorderService.listOrders({
        ...params,
        pageSize: params.pageSize || constants_1.DEFAULT_PAGE_SIZE
    });
    return { success: true, data: result };
});
electron_1.ipcMain.handle('order:get', async (_event, id) => {
    requirePermission('order.read');
    const order = reorderService.getOrderById(id);
    if (!order)
        return { success: false, error: '订单不存在' };
    return { success: true, data: order };
});
electron_1.ipcMain.handle('order:create', async (_event, data) => {
    requirePermission('order.create');
    if (!currentUser)
        throw new Error('未登录');
    const order = reorderService.createOrder(data, currentUser);
    return { success: true, data: order };
});
electron_1.ipcMain.handle('order:update', async (_event, id, data) => {
    requirePermission('order.update');
    if (!currentUser)
        throw new Error('未登录');
    const order = reorderService.updateOrder(id, data, currentUser);
    return { success: true, data: order };
});
electron_1.ipcMain.handle('order:changeStatus', async (_event, id, newStatus, reason) => {
    requirePermission('order.update');
    if (!currentUser)
        throw new Error('未登录');
    const order = reorderService.changeOrderStatus(id, newStatus, reason, currentUser);
    return { success: true, data: order };
});
electron_1.ipcMain.handle('order:delete', async (_event, id) => {
    requirePermission('order.delete');
    if (!currentUser)
        throw new Error('未登录');
    reorderService.deleteOrder(id, currentUser);
    return { success: true };
});
electron_1.ipcMain.handle('order:history', async (_event, orderId) => {
    requirePermission('order.read');
    const history = reorderService.getOrderHistory(orderId);
    return { success: true, data: history };
});
electron_1.ipcMain.handle('batch:changeStatus', async (_event, orderIds, newStatus, reason) => {
    requirePermission('order.batch_update');
    if (!currentUser)
        throw new Error('未登录');
    const result = batchService.batchChangeStatus(orderIds, newStatus, reason, currentUser);
    return { success: true, data: result };
});
electron_1.ipcMain.handle('batch:assign', async (_event, orderIds, assigneeId, assigneeName) => {
    requirePermission('order.batch_update');
    if (!currentUser)
        throw new Error('未登录');
    const result = batchService.batchAssignOrders(orderIds, assigneeId, assigneeName, currentUser);
    return { success: true, data: result };
});
electron_1.ipcMain.handle('failed:list', async () => {
    requirePermission('system.recover');
    const failedOps = batchService.listFailedOperations();
    return { success: true, data: failedOps };
});
electron_1.ipcMain.handle('failed:retry', async (_event, failedOpId) => {
    requirePermission('system.recover');
    if (!currentUser)
        throw new Error('未登录');
    const result = batchService.retryFailedOperation(failedOpId, currentUser);
    return { success: result.success, message: result.message };
});
electron_1.ipcMain.handle('failed:clear', async (_event, failedOpId) => {
    requirePermission('system.recover');
    if (!currentUser)
        throw new Error('未登录');
    const result = batchService.clearFailedOperation(failedOpId, currentUser);
    return { success: result };
});
electron_1.ipcMain.handle('log:list', async (_event, params) => {
    requirePermission('log.read');
    const result = auditService.listAuditLogs({
        ...params,
        pageSize: params.pageSize || constants_1.DEFAULT_PAGE_SIZE
    });
    return { success: true, data: result };
});
electron_1.ipcMain.handle('import:excel', async (_event, filePath) => {
    requirePermission('order.import');
    if (!currentUser)
        throw new Error('未登录');
    const buffer = fs_1.default.readFileSync(filePath);
    const result = importExportService.importFromExcel(buffer, currentUser);
    return { success: true, data: result };
});
electron_1.ipcMain.handle('import:csv', async (_event, filePath) => {
    requirePermission('order.import');
    if (!currentUser)
        throw new Error('未登录');
    const content = fs_1.default.readFileSync(filePath, 'utf-8');
    const result = importExportService.importFromCSV(content, currentUser);
    return { success: true, data: result };
});
electron_1.ipcMain.handle('export:excel', async (_event, orderIds) => {
    requirePermission('order.export');
    if (!currentUser)
        throw new Error('未登录');
    let orders;
    if (orderIds && orderIds.length > 0) {
        orders = orderIds.map(id => reorderService.getOrderById(id)).filter(Boolean);
    }
    else {
        const result = reorderService.listOrders({ page: 1, pageSize: 10000 });
        orders = result.data;
    }
    const buffer = importExportService.exportToExcel(orders);
    const { canceled, filePath } = await electron_1.dialog.showSaveDialog(mainWindow, {
        title: '导出Excel',
        defaultPath: `补发订单_${Date.now()}.xlsx`,
        filters: [{ name: 'Excel文件', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) {
        return { success: false, message: '用户取消导出' };
    }
    fs_1.default.writeFileSync(filePath, buffer);
    return { success: true, data: { filePath, count: orders.length } };
});
electron_1.ipcMain.handle('export:csv', async (_event, orderIds) => {
    requirePermission('order.export');
    if (!currentUser)
        throw new Error('未登录');
    let orders;
    if (orderIds && orderIds.length > 0) {
        orders = orderIds.map(id => reorderService.getOrderById(id)).filter(Boolean);
    }
    else {
        const result = reorderService.listOrders({ page: 1, pageSize: 10000 });
        orders = result.data;
    }
    const content = importExportService.exportToCSV(orders);
    const { canceled, filePath } = await electron_1.dialog.showSaveDialog(mainWindow, {
        title: '导出CSV',
        defaultPath: `补发订单_${Date.now()}.csv`,
        filters: [{ name: 'CSV文件', extensions: ['csv'] }]
    });
    if (canceled || !filePath) {
        return { success: false, message: '用户取消导出' };
    }
    fs_1.default.writeFileSync(filePath, content, 'utf-8');
    return { success: true, data: { filePath, count: orders.length } };
});
electron_1.ipcMain.handle('export:template', async () => {
    const buffer = importExportService.getImportTemplate();
    const { canceled, filePath } = await electron_1.dialog.showSaveDialog(mainWindow, {
        title: '下载导入模板',
        defaultPath: '补发订单导入模板.xlsx',
        filters: [{ name: 'Excel文件', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) {
        return { success: false, message: '用户取消下载' };
    }
    fs_1.default.writeFileSync(filePath, buffer);
    return { success: true, data: { filePath } };
});
electron_1.ipcMain.handle('file:openDialog', async (_event, options) => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, options);
    return result;
});
