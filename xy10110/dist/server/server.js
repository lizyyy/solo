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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const multer_1 = __importDefault(require("multer"));
const app = (0, express_1.default)();
const PORT = 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path.join(__dirname, '../renderer')));
app.use('/uploads', express_1.default.static(path.join(process.cwd(), 'data', 'uploads')));
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}
function loadState() {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
        try {
            const content = fs.readFileSync(DATA_FILE, 'utf-8');
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
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
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        ensureDataDir();
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});
const upload = (0, multer_1.default)({ storage });
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
    if (!item.subtitlePath)
        missingFiles.push('字幕文件');
    if (!item.archivePath)
        missingFiles.push('压缩包');
    if (missingFiles.length > 0) {
        warnings.push(`缺少文件: ${missingFiles.join(', ')}`);
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
app.get('/api/state', (req, res) => {
    const state = loadState();
    res.json(state);
});
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        path: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
    });
});
app.post('/api/items', (req, res) => {
    const state = loadState();
    const now = new Date().toISOString();
    const itemData = req.body;
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
        return res.json({ success: false, errors: validation.errors, warnings: validation.warnings, item: null });
    }
    state.items.unshift(newItem);
    addHistory(newItem, '创建项目', `创建了新项目: ${newItem.name} v${newItem.version}`, state);
    saveState(state);
    res.json({ success: true, item: newItem, warnings: validation.warnings, errors: [] });
});
app.put('/api/items/:id', (req, res) => {
    const state = loadState();
    const id = req.params.id;
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return res.json({ success: false, error: '项目不存在', item: null });
    }
    const updated = {
        ...state.items[index],
        ...req.body,
        updatedAt: new Date().toISOString()
    };
    const validation = validateItem(updated, state.items);
    if (!validation.valid) {
        return res.json({ success: false, errors: validation.errors, warnings: validation.warnings, item: null });
    }
    state.items[index] = updated;
    addHistory(updated, '更新项目', `更新了项目: ${updated.name}`, state);
    saveState(state);
    res.json({ success: true, item: updated, warnings: validation.warnings, errors: [] });
});
app.delete('/api/items/:id', (req, res) => {
    const state = loadState();
    const id = req.params.id;
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return res.json({ success: false, error: '项目不存在' });
    }
    const item = state.items[index];
    state.items.splice(index, 1);
    addHistory(item, '删除项目', `删除了项目: ${item.name} v${item.version}`, state);
    saveState(state);
    res.json({ success: true });
});
app.post('/api/items/:id/review', (req, res) => {
    const state = loadState();
    const id = req.params.id;
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return res.json({ success: false, error: '项目不存在', item: null });
    }
    const item = state.items[index];
    const validation = validateItem(item, state.items);
    if (validation.warnings.some(w => w.includes('缺少文件'))) {
        return res.json({ success: false, error: '存在缺失文件，无法标记为已复核', warnings: validation.warnings, item: null });
    }
    item.status = 'reviewed';
    item.updatedAt = new Date().toISOString();
    state.items[index] = item;
    addHistory(item, '标记已复核', `项目已复核: ${item.name} v${item.version}`, state);
    saveState(state);
    res.json({ success: true, item, warnings: [], errors: [] });
});
app.post('/api/items/:id/deliver', (req, res) => {
    const state = loadState();
    const id = req.params.id;
    const index = state.items.findIndex(i => i.id === id);
    if (index === -1) {
        return res.json({ success: false, error: '项目不存在', item: null });
    }
    const item = state.items[index];
    if (item.status !== 'reviewed') {
        return res.json({ success: false, error: '必须先标记为已复核才能标记为已交付', item: null });
    }
    item.status = 'delivered';
    item.deliveredAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    state.items[index] = item;
    addHistory(item, '标记已交付', `项目已交付: ${item.name} v${item.version}`, state);
    saveState(state);
    res.json({ success: true, item, warnings: [], errors: [] });
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
app.post('/api/export', (req, res) => {
    const state = loadState();
    const { itemIds, format, filename } = req.body;
    const items = state.items.filter(i => itemIds.includes(i.id));
    if (items.length === 0) {
        return res.json({ success: false, error: '没有选择项目' });
    }
    const isCsv = format === 'csv';
    const exportDir = path.join(DATA_DIR, 'exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().slice(0, 10);
    const ext = isCsv ? 'csv' : 'txt';
    const exportFile = path.join(exportDir, `${filename || '交付清单'}_${timestamp}.${ext}`);
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
        fs.writeFileSync(exportFile, content, 'utf-8');
        items.forEach(item => {
            addHistory(item, '导出清单', `导出了项目: ${item.name} v${item.version}`, state);
        });
        saveState(state);
        const relativePath = path.relative(DATA_DIR, exportFile);
        res.json({ success: true, filePath: exportFile, relativePath, downloadUrl: `/api/download/${encodeURIComponent(relativePath)}` });
    }
    catch (e) {
        res.json({ success: false, error: '写入文件失败' });
    }
});
app.get('/api/download/:path', (req, res) => {
    const relativePath = decodeURIComponent(req.params.path);
    const filePath = path.join(DATA_DIR, relativePath);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
    }
    res.download(filePath);
});
app.get('/api/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
    }
    res.download(filePath);
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../renderer', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  屏幕录制素材交付归档器已启动`);
    console.log(`  请在浏览器中访问: http://localhost:${PORT}`);
    console.log(`========================================`);
    ensureDataDir();
});
