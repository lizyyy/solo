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
exports.DataLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
class DataLoader {
    static loadManifest(filePath) {
        const content = this.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        try {
            let manifest;
            if (ext === '.yaml' || ext === '.yml') {
                manifest = yaml.load(content);
            }
            else {
                manifest = JSON.parse(content);
            }
            this.validateManifest(manifest);
            return manifest;
        }
        catch (error) {
            throw new Error(`加载埋点清单失败: ${error.message}\n文件路径: ${filePath}`);
        }
    }
    static loadEventLog(filePath) {
        const content = this.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        try {
            let eventLog;
            if (ext === '.yaml' || ext === '.yml') {
                eventLog = yaml.load(content);
            }
            else {
                eventLog = JSON.parse(content);
            }
            this.validateEventLog(eventLog);
            return eventLog;
        }
        catch (error) {
            throw new Error(`加载事件日志失败: ${error.message}\n文件路径: ${filePath}`);
        }
    }
    static readFile(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
        try {
            return fs.readFileSync(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`读取文件失败: ${error.message}`);
        }
    }
    static validateManifest(manifest) {
        if (!manifest.version) {
            throw new Error('缺少必填字段: version');
        }
        if (!manifest.releaseVersion) {
            throw new Error('缺少必填字段: releaseVersion');
        }
        if (!manifest.events || !Array.isArray(manifest.events)) {
            throw new Error('缺少必填字段: events (必须为数组)');
        }
        const eventIds = new Set();
        for (const event of manifest.events) {
            if (!event.id) {
                throw new Error('事件缺少必填字段: id');
            }
            if (!event.name) {
                throw new Error(`事件 ${event.id} 缺少必填字段: name`);
            }
            if (eventIds.has(event.id)) {
                throw new Error(`重复的事件ID: ${event.id}`);
            }
            eventIds.add(event.id);
        }
    }
    static validateEventLog(eventLog) {
        if (!eventLog.entries || !Array.isArray(eventLog.entries)) {
            throw new Error('缺少必填字段: entries (必须为数组)');
        }
        for (let i = 0; i < eventLog.entries.length; i++) {
            const entry = eventLog.entries[i];
            if (!entry.eventId && !entry.eventName) {
                throw new Error(`日志条目 ${i} 缺少 eventId 或 eventName`);
            }
            if (!entry.timestamp) {
                throw new Error(`日志条目 ${i} 缺少必填字段: timestamp`);
            }
        }
    }
}
exports.DataLoader = DataLoader;
//# sourceMappingURL=loader.js.map