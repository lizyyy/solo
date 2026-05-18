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
exports.InspectionParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class InspectionParser {
    validateRequiredFields(data) {
        const errors = [];
        const obj = data;
        if (!obj.storeId || typeof obj.storeId !== 'string') {
            errors.push('缺少或无效的 storeId 字段');
        }
        if (!obj.storeName || typeof obj.storeName !== 'string') {
            errors.push('缺少或无效的 storeName 字段');
        }
        if (!obj.inspectionDate || typeof obj.inspectionDate !== 'string') {
            errors.push('缺少或无效的 inspectionDate 字段');
        }
        if (!obj.inspector || typeof obj.inspector !== 'string') {
            errors.push('缺少或无效的 inspector 字段');
        }
        if (!Array.isArray(obj.items)) {
            errors.push('items 字段必须是数组');
        }
        if (!Array.isArray(obj.photos)) {
            errors.push('photos 字段必须是数组');
        }
        return errors;
    }
    parseFile(filePath) {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`文件不存在: ${absolutePath}`);
        }
        const content = fs.readFileSync(absolutePath, 'utf-8');
        let data;
        try {
            data = JSON.parse(content);
        }
        catch (e) {
            throw new Error(`JSON 解析失败: ${e.message}`);
        }
        if (Array.isArray(data)) {
            return data.map((item, index) => {
                const errors = this.validateRequiredFields(item);
                if (errors.length > 0) {
                    throw new Error(`第 ${index + 1} 条数据验证失败: ${errors.join(', ')}`);
                }
                return item;
            });
        }
        const errors = this.validateRequiredFields(data);
        if (errors.length > 0) {
            throw new Error(`数据验证失败: ${errors.join(', ')}`);
        }
        return [data];
    }
    sortInspections(inspections) {
        return [...inspections].sort((a, b) => {
            if (a.storeId !== b.storeId) {
                return a.storeId.localeCompare(b.storeId);
            }
            return a.inspectionDate.localeCompare(b.inspectionDate);
        }).map(inspection => ({
            ...inspection,
            items: [...inspection.items].sort((a, b) => a.itemId.localeCompare(b.itemId)),
            photos: [...inspection.photos].sort((a, b) => a.photoId.localeCompare(b.photoId))
        }));
    }
}
exports.InspectionParser = InspectionParser;
