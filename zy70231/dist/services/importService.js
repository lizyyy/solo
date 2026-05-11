"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ImportService {
    constructor(storage) {
        this.storage = storage;
    }
    importFromFile(filePath) {
        const fullPath = path_1.default.resolve(filePath);
        if (!fs_1.default.existsSync(fullPath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
        const raw = fs_1.default.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(raw);
        return this.importData(data);
    }
    importData(data) {
        const result = {
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: [],
        };
        if (data.workZones) {
            for (const wz of data.workZones) {
                const exists = this.storage.db.workZones.has(wz.id);
                if (exists) {
                    this.storage.db.workZones.set(wz.id, wz);
                    result.updated++;
                }
                else {
                    this.storage.db.workZones.set(wz.id, wz);
                    result.imported++;
                }
            }
        }
        if (data.blockSections) {
            for (const bs of data.blockSections) {
                const exists = this.storage.db.blockSections.has(bs.id);
                if (exists) {
                    this.storage.db.blockSections.set(bs.id, bs);
                    result.updated++;
                }
                else {
                    this.storage.db.blockSections.set(bs.id, bs);
                    result.imported++;
                }
            }
        }
        if (data.resources) {
            for (const res of data.resources) {
                if (!this.storage.db.workZones.has(res.workZoneId)) {
                    result.errors.push(`资源 ${res.id} 引用了不存在的工区 ${res.workZoneId}`);
                    result.skipped++;
                    continue;
                }
                const exists = this.storage.db.resources.has(res.id);
                if (exists) {
                    this.storage.db.resources.set(res.id, res);
                    result.updated++;
                }
                else {
                    this.storage.db.resources.set(res.id, res);
                    result.imported++;
                }
            }
        }
        if (data.maintenanceWindows) {
            for (const win of data.maintenanceWindows) {
                const invalidSections = win.blockSections.filter(id => !this.storage.db.blockSections.has(id));
                if (invalidSections.length > 0) {
                    result.errors.push(`天窗计划 ${win.id} 引用了不存在的封锁区段: ${invalidSections.join(', ')}`);
                    result.skipped++;
                    continue;
                }
                const exists = this.storage.db.maintenanceWindows.has(win.id);
                if (exists) {
                    this.storage.db.maintenanceWindows.set(win.id, win);
                    result.updated++;
                }
                else {
                    this.storage.db.maintenanceWindows.set(win.id, win);
                    result.imported++;
                }
            }
        }
        if (data.workTasks) {
            for (const task of data.workTasks) {
                if (!this.storage.db.workZones.has(task.workZoneId)) {
                    result.errors.push(`任务 ${task.id} 引用了不存在的工区 ${task.workZoneId}`);
                    result.skipped++;
                    continue;
                }
                const invalidResources = task.requiredResources.filter(r => !this.storage.db.resources.has(r.resourceId));
                if (invalidResources.length > 0) {
                    result.errors.push(`任务 ${task.id} 引用了不存在的资源: ${invalidResources.map(r => r.resourceId).join(', ')}`);
                    result.skipped++;
                    continue;
                }
                const invalidSections = task.requiredBlockSections.filter(id => !this.storage.db.blockSections.has(id));
                if (invalidSections.length > 0) {
                    result.errors.push(`任务 ${task.id} 引用了不存在的封锁区段: ${invalidSections.join(', ')}`);
                    result.skipped++;
                    continue;
                }
                const exists = this.storage.db.workTasks.has(task.id);
                if (exists) {
                    this.storage.db.workTasks.set(task.id, task);
                    result.updated++;
                }
                else {
                    this.storage.db.workTasks.set(task.id, task);
                    result.imported++;
                }
            }
        }
        this.storage.save();
        return result;
    }
    getImportStats() {
        return {
            workZones: this.storage.db.workZones.size,
            blockSections: this.storage.db.blockSections.size,
            resources: this.storage.db.resources.size,
            maintenanceWindows: this.storage.db.maintenanceWindows.size,
            workTasks: this.storage.db.workTasks.size,
        };
    }
}
exports.ImportService = ImportService;
//# sourceMappingURL=importService.js.map