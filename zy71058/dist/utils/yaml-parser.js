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
exports.parseYamlFile = parseYamlFile;
exports.extractAllValues = extractAllValues;
exports.findYamlFiles = findYamlFiles;
exports.flattenObject = flattenObject;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
const path = __importStar(require("path"));
function parseYamlFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let data;
    try {
        data = yaml.load(content);
    }
    catch (e) {
        throw new Error(`YAML 解析失败 ${filePath}: ${e.message}`);
    }
    return { filePath, content, data, lines };
}
function extractAllValues(data, prefix = '') {
    const results = [];
    if (data === null || data === undefined) {
        return results;
    }
    if (typeof data === 'object') {
        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                const newPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
                results.push(...extractAllValues(item, newPrefix));
            });
        }
        else {
            for (const [key, value] of Object.entries(data)) {
                const newPrefix = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null) {
                    results.push(...extractAllValues(value, newPrefix));
                }
                else if (value !== null && value !== undefined) {
                    results.push({
                        path: newPrefix,
                        value: String(value),
                        line: 0
                    });
                }
            }
        }
    }
    else {
        results.push({
            path: prefix,
            value: String(data),
            line: 0
        });
    }
    return results;
}
function findYamlFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...findYamlFiles(fullPath));
        }
        else if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.tpl')) {
            results.push(fullPath);
        }
    }
    return results;
}
function flattenObject(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, newKey));
        }
        else if (value !== null && value !== undefined) {
            result[newKey] = String(value);
        }
    }
    return result;
}
