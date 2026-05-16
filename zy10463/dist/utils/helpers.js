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
exports.ensureDir = ensureDir;
exports.readJsonFile = readJsonFile;
exports.writeJsonFile = writeJsonFile;
exports.seededRandom = seededRandom;
exports.generateId = generateId;
exports.formatErrorForReport = formatErrorForReport;
exports.getFieldType = getFieldType;
exports.listAllFields = listAllFields;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        throw new Error(`解析JSON文件失败: ${filePath}, 错误: ${error.message}`);
    }
}
function writeJsonFile(filePath, data, pretty = true) {
    ensureDir(path.dirname(filePath));
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    fs.writeFileSync(filePath, content, 'utf-8');
}
function seededRandom(seed) {
    let s = seed;
    return function () {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}
function generateId(seed, index, type) {
    const hash = `${seed}-${index}-${type}-${Date.now()}`;
    return Buffer.from(hash).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
}
function formatErrorForReport(error) {
    const parts = [
        `路径: ${error.instancePath || '/'}`,
        `关键字: ${error.keyword}`,
        `消息: ${error.message}`
    ];
    if (Object.keys(error.params).length > 0) {
        parts.push(`参数: ${JSON.stringify(error.params)}`);
    }
    return parts.join(' | ');
}
function getFieldType(schema, fieldPath) {
    const parts = fieldPath.split('.').filter(Boolean);
    let current = schema;
    for (const part of parts) {
        if (current.properties && typeof current.properties === 'object') {
            const props = current.properties;
            if (props[part]) {
                current = props[part];
            }
            else {
                return 'unknown';
            }
        }
        else if (current.items && typeof current.items === 'object') {
            current = current.items;
        }
    }
    return current.type || 'unknown';
}
function listAllFields(schema, prefix = '') {
    const fields = [];
    if (schema.properties && typeof schema.properties === 'object') {
        const props = schema.properties;
        for (const [key, prop] of Object.entries(props)) {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            fields.push(fullPath);
            if (prop.type === 'object') {
                fields.push(...listAllFields(prop, fullPath));
            }
            else if (prop.type === 'array' && prop.items && typeof prop.items === 'object') {
                const items = prop.items;
                if (items.properties) {
                    fields.push(...listAllFields(items, `${fullPath}[]`));
                }
            }
        }
    }
    return fields;
}
//# sourceMappingURL=helpers.js.map