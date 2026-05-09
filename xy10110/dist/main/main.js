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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let mainWindow = null;
let dataDir;
let dataFile;
function initDataPaths() {
    dataDir = path.join(process.cwd(), 'data');
    dataFile = path.join(dataDir, 'data.json');
}
function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}
function loadState() {
    ensureDataDir();
    if (fs.existsSync(dataFile)) {
        try {
            const content = fs.readFileSync(dataFile, 'utf-8');
            return JSON.parse(content);
        }
        catch (e) {
            console.error('Failed to load state:', e);
        }
    }
    return { items: [], history: [] };
}
function saveState(state) {
    ensureDataDir();
    fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), 'utf-8');
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
function addHistory(item, action, details, state) {
    const record = {
        id: generateId(),
        itemId: item.id,
        itemName: item.name,
        action,
        timestamp: new Date().toISOString(),
        details
    };
    state.history.unshift(record);
    return record;
}
function getFileFilter(fileType) {
    const filters = {
        video: [{ name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
        subtitle: [{ name: 'Subtitle Files', extensions: ['srt', 'vtt', 'ass', 'ssa'] }],
        archive: [{ name: 'Archive Files', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] }]
    };
    return filters[fileType];
}
function validateItem(item, allItems) {
    const errors = [];
    const warnings = [];
    if (!item.name.trim()) {
        errors.push('项目名称不能为空');
    }
    if (!item.version.trim()) {
        errors.push('版本号不能为空');
    }
    if (!item.clientName.trim()) {
        errors.push('客户名称不能为空');
    }
    const existingWithSameName = allItems.filter(i => i.name.toLowerCase() === item.name.toLowerCase() && i.id !== item.id);
    if (existingWithSameName.length > 0) {
        const sameVersion = existingWithSameName.filter(i => i.version === item.version);
        if (sameVersion.length > 0) {
            errors.push(`存在同名同版本项目: ${item.name} v${item.version}`);
        }
        else {
            warnings.push(`存在同名不同版本项目: ${item.name}`);
        }
    }
    const missingFiles = [];
    if (!item.videoPath)
        missingFiles.push('视频文件');
    else if (!fs.existsSync(item.videoPath))
        missingFiles.push('视频文件(路径不存在)');
    if (!item.subtitlePath)
        missingFiles.push('字幕文件');
    else if (!fs.existsSync(item.subtitlePath))
        missingFiles.push('字幕文件(路径不存在)');
    if (!item.archivePath)
        missingFiles.push('压缩包');
    else if (!fs.existsSync(item.archivePath))
        missingFiles.push('压缩包(路径不存在)');
    if (missingFiles.length > 0) {
        warnings.push(`缺少文件: ${missingFiles.join(', ')}`);
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
function createWindow() {
    initDataPaths();
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        title: '屏幕录制素材交付归档器',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.on('ready', createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
electron_1.ipcMain.handle('get-state', () => {
    return loadState();
});
electron_1.ipcMain.handle('select-file', async (event, fileType) => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: getFileFilter(fileType)
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});
electron_1.ipcMain.handle('select-multiple-files', async (event, fileType) => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: getFileFilter(fileType)
    });
    if (result.canceled) {
        return [];
    }
    return result.filePaths;
});
electron_1.ipcMain.handle('add-item', (event, itemData) => {
    const state = loadState();
    const now = new Date().toISOString();
    const newItem = {
        ...itemData,
        id: generateId(),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        deliveredAt: null
    };
    const validation = validateItem(newItem, state.items);
    if (!validation.valid) {
        return { success: false, errors: validation.errors, warnings: validation.warnings, item: null };
    }
    state.items.unshift(newItem);
    addHistory(newItem, '创建项目', `创建了新项目: ${newItem.name} v${newItem.version}`, state);
    saveState(state);
    return { success: true, item: newItem, warnings: validation.warnings, errors: [] };
});
electron_1.ipcMain.handle('update-item', (event, id, updates) => {
    const state = loadState();
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return { success: false, error: '项目不存在', item: null };
    }
    const updated = {
        ...state.items[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    const validation = validateItem(updated, state.items);
    if (!validation.valid) {
        return { success: false, errors: validation.errors, warnings: validation.warnings, item: null };
    }
    state.items[index] = updated;
    addHistory(updated, '更新项目', `更新了项目: ${updated.name}`, state);
    saveState(state);
    return { success: true, item: updated, warnings: validation.warnings, errors: [] };
});
electron_1.ipcMain.handle('delete-item', (event, id) => {
    const state = loadState();
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return { success: false, error: '项目不存在' };
    }
    const item = state.items[index];
    state.items.splice(index, 1);
    addHistory(item, '删除项目', `删除了项目: ${item.name} v${item.version}`, state);
    saveState(state);
    return { success: true };
});
electron_1.ipcMain.handle('mark-reviewed', (event, id) => {
    const state = loadState();
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return { success: false, error: '项目不存在', item: null };
    }
    const item = state.items[index];
    const validation = validateItem(item, state.items);
    if (validation.warnings.some(w => w.includes('缺少文件'))) {
        return { success: false, error: '存在缺失文件，无法标记为已复核', warnings: validation.warnings, item: null };
    }
    item.status = 'reviewed';
    item.updatedAt = new Date().toISOString();
    state.items[index] = item;
    addHistory(item, '标记已复核', `项目已复核: ${item.name} v${item.version}`, state);
    saveState(state);
    return { success: true, item, warnings: [], errors: [] };
});
electron_1.ipcMain.handle('mark-delivered', (event, id) => {
    const state = loadState();
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return { success: false, error: '项目不存在', item: null };
    }
    const item = state.items[index];
    if (item.status !== 'reviewed') {
        return { success: false, error: '必须先标记为已复核才能标记为已交付', item: null };
    }
    item.status = 'delivered';
    item.deliveredAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    state.items[index] = item;
    addHistory(item, '标记已交付', `项目已交付: ${item.name} v${item.version}`, state);
    saveState(state);
    return { success: true, item, warnings: [], errors: [] };
});
electron_1.ipcMain.handle('validate-item', (event, item) => {
    const state = loadState();
    return validateItem(item, state.items);
});
electron_1.ipcMain.handle('export-manifest', async (event, itemIds) => {
    const state = loadState();
    const items = state.items.filter(i => itemIds.includes(i.id));
    if (items.length === 0) {
        return { success: false, error: '没有选择项目' };
    }
    const result = await electron_1.dialog.showSaveDialog(mainWindow, {
        title: '导出清单',
        filters: [{ name: 'Text Files', extensions: ['txt'] }, { name: 'CSV Files', extensions: ['csv'] }],
        defaultPath: `交付清单_${new Date().toISOString().slice(0, 10)}.txt`
    });
    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }
    const isCsv = result.filePath.endsWith('.csv');
    let content = '';
    if (isCsv) {
        content = '项目名称,版本,客户,视频,字幕,压缩包,状态,备注,创建时间,交付时间\n';
        items.forEach(item => {
            content += [
                `"${item.name}"`,
                `"${item.version}"`,
                `"${item.clientName}"`,
                `"${item.videoPath || ''}"`,
                `"${item.subtitlePath || ''}"`,
                `"${item.archivePath || ''}"`,
                `"${item.status}"`,
                `"${item.notes}"`,
                `"${item.createdAt}"`,
                `"${item.deliveredAt || ''}"`
            ].join(',') + '\n';
        });
    }
    else {
        content = '='.repeat(60) + '\n';
        content += '    屏幕录制素材交付清单\n';
        content += `    生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
        content += '='.repeat(60) + '\n\n';
        items.forEach((item, index) => {
            content += `【项目 ${index + 1}】\n`;
            content += `项目名称: ${item.name}\n`;
            content += `版本号: ${item.version}\n`;
            content += `客户: ${item.clientName}\n`;
            content += `状态: ${getStatusText(item.status)}\n`;
            content += '\n';
            content += `视频文件: ${item.videoPath || '(未提供)'}\n`;
            content += `字幕文件: ${item.subtitlePath || '(未提供)'}\n`;
            content += `压缩包: ${item.archivePath || '(未提供)'}\n`;
            content += '\n';
            content += `备注: ${item.notes || '(无)'}\n`;
            content += `创建时间: ${new Date(item.createdAt).toLocaleString('zh-CN')}\n`;
            if (item.deliveredAt) {
                content += `交付时间: ${new Date(item.deliveredAt).toLocaleString('zh-CN')}\n`;
            }
            content += '-'.repeat(50) + '\n\n';
        });
        content += `\n总计: ${items.length} 个项目\n`;
    }
    try {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        items.forEach(item => {
            addHistory(item, '导出清单', `导出了项目: ${item.name} v${item.version}`, state);
        });
        saveState(state);
        return { success: true, filePath: result.filePath };
    }
    catch (e) {
        return { success: false, error: '写入文件失败' };
    }
});
function getStatusText(status) {
    const map = {
        pending: '待复核',
        reviewed: '已复核',
        delivered: '已交付',
        missing: '文件缺失'
    };
    return map[status] || status;
}
