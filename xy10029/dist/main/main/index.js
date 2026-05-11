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
const database_1 = require("./database");
const userService = __importStar(require("./services/userService"));
const deviceService = __importStar(require("./services/deviceService"));
const logService = __importStar(require("./services/logService"));
const retryService = __importStar(require("./services/retryService"));
const ioService = __importStar(require("./services/ioService"));
const fs = __importStar(require("fs"));
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js')
        }
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    await (0, database_1.initDatabase)();
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
function wrapApi(handler) {
    return Promise.resolve()
        .then(handler)
        .then(data => ({ success: true, data }))
        .catch(error => ({
        success: false,
        error: error instanceof Error ? error.message : String(error)
    }));
}
electron_1.ipcMain.handle('auth:login', async (_event, username, password) => {
    return wrapApi(async () => {
        const user = await userService.verifyUser(username, password);
        if (!user) {
            throw new Error('用户名或密码错误');
        }
        await logService.logInfo('auth', 'login', user.id, user.displayName, `用户登录`);
        return user;
    });
});
electron_1.ipcMain.handle('users:list', async (_event, params) => {
    return wrapApi(async () => await userService.listUsers(params));
});
electron_1.ipcMain.handle('users:create', async (_event, data) => {
    return wrapApi(async () => {
        return await userService.createUser(data.username, data.password, data.displayName, data.role);
    });
});
electron_1.ipcMain.handle('users:update', async (_event, id, updates) => {
    return wrapApi(async () => await userService.updateUser(id, updates));
});
electron_1.ipcMain.handle('users:resetPassword', async (_event, id, newPassword) => {
    return wrapApi(async () => {
        const password = await userService.resetUserPassword(id, newPassword);
        const user = await userService.getUserById(id);
        if (user) {
            await logService.logInfo('auth', 'reset_password', null, null, `重置用户 ${user.username} 密码`);
        }
        return password;
    });
});
electron_1.ipcMain.handle('devices:list', async (_event, params) => {
    return wrapApi(async () => await deviceService.listDevices(params));
});
electron_1.ipcMain.handle('devices:get', async (_event, id) => {
    return wrapApi(async () => await deviceService.getDeviceById(id));
});
electron_1.ipcMain.handle('devices:create', async (_event, data, operator) => {
    return wrapApi(async () => {
        const device = await deviceService.createDevice(data.deviceCode, data.name, data.category, operator, {
            model: data.model,
            serialNumber: data.serialNumber,
            location: data.location,
            description: data.description
        });
        await logService.logInfo('device', 'create', operator.id, operator.displayName, `创建设备 ${data.deviceCode}`);
        return device;
    });
});
electron_1.ipcMain.handle('devices:update', async (_event, id, updates, operator) => {
    return wrapApi(async () => {
        const device = await deviceService.updateDevice(id, updates, operator);
        if (device) {
            await logService.logInfo('device', 'update', operator.id, operator.displayName, `更新设备 ${device.deviceCode}`);
        }
        return device;
    });
});
electron_1.ipcMain.handle('devices:lend', async (_event, deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose) => {
    return wrapApi(async () => {
        const result = await deviceService.lendDevice(deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose);
        if (result) {
            await logService.logInfo('device', 'lend', operator.id, operator.displayName, `借出设备 ${result.device.deviceCode} 给 ${borrowerName}`);
        }
        return result;
    });
});
electron_1.ipcMain.handle('devices:return', async (_event, deviceId, operator, notes) => {
    return wrapApi(async () => {
        const result = await deviceService.returnDevice(deviceId, operator, notes);
        if (result) {
            await logService.logInfo('device', 'return', operator.id, operator.displayName, `归还设备 ${result.device.deviceCode}`);
        }
        return result;
    });
});
electron_1.ipcMain.handle('devices:changeStatus', async (_event, deviceId, newStatus, operator, notes) => {
    return wrapApi(async () => {
        const device = await deviceService.changeDeviceStatus(deviceId, newStatus, operator, notes);
        if (device) {
            await logService.logInfo('device', 'status_change', operator.id, operator.displayName, `设备状态变更 ${device.deviceCode} -> ${newStatus}`);
        }
        return device;
    });
});
electron_1.ipcMain.handle('devices:delete', async (_event, deviceId, operator) => {
    return wrapApi(async () => {
        const success = await deviceService.deleteDevice(deviceId, operator);
        if (success) {
            await logService.logInfo('device', 'delete', operator.id, operator.displayName, `删除设备 ID: ${deviceId}`);
        }
        return success;
    });
});
electron_1.ipcMain.handle('devices:history', async (_event, deviceId) => {
    return wrapApi(async () => await deviceService.getDeviceHistory(deviceId));
});
electron_1.ipcMain.handle('devices:restore', async (_event, historyId, operator) => {
    return wrapApi(async () => {
        const device = await deviceService.restoreDeviceFromHistory(historyId, operator);
        if (device) {
            await logService.logInfo('device', 'restore', operator.id, operator.displayName, `恢复设备 ${device.deviceCode}`);
        }
        return device;
    });
});
electron_1.ipcMain.handle('borrows:list', async (_event, params) => {
    return wrapApi(async () => await deviceService.getBorrowRecords(params));
});
electron_1.ipcMain.handle('logs:list', async (_event, params) => {
    return wrapApi(async () => await logService.getLogs(params));
});
electron_1.ipcMain.handle('retry:list', async (_event, params) => {
    return wrapApi(async () => await retryService.getFailedOperations(params));
});
electron_1.ipcMain.handle('retry:cancel', async (_event, id) => {
    return wrapApi(async () => await retryService.cancelRetry(id));
});
electron_1.ipcMain.handle('batch:list', async (_event, params) => {
    return wrapApi(async () => await ioService.getBatchOperations(params));
});
electron_1.ipcMain.handle('batch:get', async (_event, id) => {
    return wrapApi(async () => await ioService.getBatchOperation(id));
});
electron_1.ipcMain.handle('export:devices', async (_event, options) => {
    return wrapApi(async () => {
        const devices = await deviceService.listDevices({
            page: 1,
            pageSize: 10000,
            ...options.filters
        });
        const exportData = devices.items.map(d => ({
            设备编号: d.deviceCode,
            设备名称: d.name,
            设备类别: d.category,
            型号: d.model,
            序列号: d.serialNumber,
            状态: d.status,
            位置: d.location,
            描述: d.description,
            当前持有人: d.currentHolderName || '',
            借出时间: d.borrowedAt || '',
            预计归还时间: d.expectedReturnAt || '',
            创建时间: d.createdAt
        }));
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: '导出设备数据',
            defaultPath: `devices_${Date.now()}.${options.format === 'excel' ? 'xlsx' : 'csv'}`,
            filters: options.format === 'excel'
                ? [{ name: 'Excel文件', extensions: ['xlsx'] }]
                : [{ name: 'CSV文件', extensions: ['csv'] }]
        });
        if (result.canceled || !result.filePath) {
            throw new Error('用户取消导出');
        }
        if (options.format === 'excel') {
            const buffer = await ioService.exportToExcel(options, () => exportData);
            fs.writeFileSync(result.filePath, buffer);
        }
        else {
            const csv = await ioService.exportToCSV(options, () => exportData);
            fs.writeFileSync(result.filePath, csv, 'utf-8');
        }
        return result.filePath;
    });
});
electron_1.ipcMain.handle('export:borrows', async (_event, options) => {
    return wrapApi(async () => {
        const records = await deviceService.getBorrowRecords({
            page: 1,
            pageSize: 10000,
            ...options.filters
        });
        const exportData = records.items.map(r => ({
            设备编号: r.deviceCode,
            借出人: r.borrowerName,
            操作员: r.operatorName,
            借出时间: r.borrowedAt,
            预计归还时间: r.expectedReturnAt || '',
            实际归还时间: r.returnedAt || '',
            状态: r.status,
            用途: r.purpose || '',
            备注: r.notes || ''
        }));
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: '导出借出记录',
            defaultPath: `borrows_${Date.now()}.${options.format === 'excel' ? 'xlsx' : 'csv'}`,
            filters: options.format === 'excel'
                ? [{ name: 'Excel文件', extensions: ['xlsx'] }]
                : [{ name: 'CSV文件', extensions: ['csv'] }]
        });
        if (result.canceled || !result.filePath) {
            throw new Error('用户取消导出');
        }
        if (options.format === 'excel') {
            const buffer = await ioService.exportToExcel(options, () => exportData);
            fs.writeFileSync(result.filePath, buffer);
        }
        else {
            const csv = await ioService.exportToCSV(options, () => exportData);
            fs.writeFileSync(result.filePath, csv, 'utf-8');
        }
        return result.filePath;
    });
});
electron_1.ipcMain.handle('import:devices', async (_event, operator) => {
    return wrapApi(async () => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: '导入设备数据',
            properties: ['openFile'],
            filters: [
                { name: '支持的文件', extensions: ['xlsx', 'xls', 'csv'] },
                { name: 'Excel文件', extensions: ['xlsx', 'xls'] },
                { name: 'CSV文件', extensions: ['csv'] }
            ]
        });
        if (result.canceled || result.filePaths.length === 0) {
            throw new Error('用户取消导入');
        }
        const filePath = result.filePaths[0];
        let data;
        if (filePath.endsWith('.csv')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            data = ioService.parseCSV(content);
        }
        else {
            data = await ioService.parseExcel(filePath);
        }
        const validation = ioService.validateDeviceData(data);
        const batchOp = await ioService.createBatchOperation('import_devices', validation.valid.length, operator.id, operator.displayName);
        for (const row of validation.valid) {
            try {
                const existing = await deviceService.getDeviceByCode(row.deviceCode);
                let device;
                if (existing) {
                    device = (await deviceService.updateDevice(existing.id, {
                        name: row.name,
                        category: row.category,
                        model: row.model,
                        serialNumber: row.serialNumber,
                        location: row.location,
                        description: row.description
                    }, operator));
                }
                else {
                    device = await deviceService.createDevice(row.deviceCode, row.name, row.category, operator, {
                        model: row.model,
                        serialNumber: row.serialNumber,
                        location: row.location,
                        description: row.description
                    });
                }
                await ioService.addBatchResult(batchOp.id, device.id, device.deviceCode, true);
            }
            catch (error) {
                await ioService.addBatchResult(batchOp.id, '', row.deviceCode || '', false, error instanceof Error ? error.message : String(error));
            }
        }
        const completed = await ioService.completeBatchOperation(batchOp.id);
        await logService.logInfo('import', 'devices', operator.id, operator.displayName, `导入设备数据: 成功 ${completed?.successCount || 0}, 失败 ${completed?.failedCount || 0}, 验证错误 ${validation.errors.length}`);
        return {
            batchOperation: completed,
            validationErrors: validation.errors
        };
    });
});
electron_1.ipcMain.handle('batch:lend', async (_event, deviceIds, borrowerId, borrowerName, operator, expectedReturnAt, purpose) => {
    return wrapApi(async () => {
        const batchOp = await ioService.createBatchOperation('batch_lend', deviceIds.length, operator.id, operator.displayName);
        for (const deviceId of deviceIds) {
            try {
                const result = await deviceService.lendDevice(deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose);
                if (result) {
                    await ioService.addBatchResult(batchOp.id, result.device.id, result.device.deviceCode, true);
                }
                else {
                    throw new Error('借出失败');
                }
            }
            catch (error) {
                const device = await deviceService.getDeviceById(deviceId);
                await ioService.addBatchResult(batchOp.id, deviceId, device?.deviceCode || '', false, error instanceof Error ? error.message : String(error));
            }
        }
        const completed = await ioService.completeBatchOperation(batchOp.id);
        await logService.logInfo('batch', 'lend', operator.id, operator.displayName, `批量借出设备: 成功 ${completed?.successCount || 0}, 失败 ${completed?.failedCount || 0}`);
        return completed;
    });
});
electron_1.ipcMain.handle('batch:return', async (_event, deviceIds, operator) => {
    return wrapApi(async () => {
        const batchOp = await ioService.createBatchOperation('batch_return', deviceIds.length, operator.id, operator.displayName);
        for (const deviceId of deviceIds) {
            try {
                const result = await deviceService.returnDevice(deviceId, operator);
                if (result) {
                    await ioService.addBatchResult(batchOp.id, result.device.id, result.device.deviceCode, true);
                }
                else {
                    throw new Error('归还失败');
                }
            }
            catch (error) {
                const device = await deviceService.getDeviceById(deviceId);
                await ioService.addBatchResult(batchOp.id, deviceId, device?.deviceCode || '', false, error instanceof Error ? error.message : String(error));
            }
        }
        const completed = await ioService.completeBatchOperation(batchOp.id);
        await logService.logInfo('batch', 'return', operator.id, operator.displayName, `批量归还设备: 成功 ${completed?.successCount || 0}, 失败 ${completed?.failedCount || 0}`);
        return completed;
    });
});
//# sourceMappingURL=index.js.map