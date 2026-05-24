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
exports.loadExceptions = loadExceptions;
exports.isPackageExcepted = isPackageExcepted;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadExceptions(filePath) {
    if (!filePath)
        return [];
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`例外清单文件不存在: ${filePath}`);
    }
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
        return data.map(validateExceptionItem);
    }
    if (data.exceptions && Array.isArray(data.exceptions)) {
        return data.exceptions.map(validateExceptionItem);
    }
    throw new Error('例外清单格式无效');
}
function validateExceptionItem(item) {
    if (!item.name || typeof item.name !== 'string') {
        throw new Error('例外项必须包含 name 字段');
    }
    if (!item.reason || typeof item.reason !== 'string') {
        throw new Error(`例外项 ${item.name} 必须包含 reason 字段`);
    }
    return {
        name: item.name,
        version: item.version,
        reason: item.reason,
        approvedBy: item.approvedBy,
        approvedAt: item.approvedAt,
    };
}
function isPackageExcepted(packageName, packageVersion, exceptions) {
    return exceptions.find(ex => {
        if (ex.name !== packageName)
            return false;
        if (ex.version && ex.version !== packageVersion)
            return false;
        return true;
    }) || null;
}
