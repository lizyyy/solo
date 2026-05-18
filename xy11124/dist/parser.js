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
exports.parseFile = parseFile;
exports.parseFiles = parseFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
function getLineNumber(content, position) {
    return content.substring(0, position).split('\n').length;
}
function parseJsonWithLineNumbers(content, filePath) {
    const errors = [];
    let data = null;
    try {
        data = JSON.parse(content);
    }
    catch (e) {
        const match = e.message.match(/position (\d+)/);
        const position = match ? parseInt(match[1], 10) : 0;
        errors.push({
            file: filePath,
            line: getLineNumber(content, position),
            message: 'JSON解析失败',
            error: e.message
        });
    }
    return { data, errors };
}
function parseYamlWithLineNumbers(content, filePath) {
    const errors = [];
    let data = null;
    try {
        data = yaml.load(content);
    }
    catch (e) {
        errors.push({
            file: filePath,
            line: e.mark?.line ? e.mark.line + 1 : undefined,
            message: 'YAML解析失败',
            error: e.message
        });
    }
    return { data, errors };
}
function validateContraindication(obj, index, filePath) {
    const required = ['id', 'patientId', 'patientName', 'type', 'description', 'level', 'effectiveDate', 'expiryDate', 'status'];
    for (const field of required) {
        if (!(field in obj)) {
            return null;
        }
    }
    return {
        ...obj,
        source: {
            file: filePath,
            line: index + 2
        }
    };
}
function validatePackage(obj, index, filePath) {
    const required = ['id', 'name', 'category', 'treatments', 'contraindications', 'price', 'duration'];
    for (const field of required) {
        if (!(field in obj)) {
            return null;
        }
    }
    return {
        ...obj,
        source: {
            file: filePath,
            line: index + 2
        }
    };
}
function parseFile(filePath) {
    const result = {
        contraindications: [],
        packages: [],
        errors: []
    };
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const ext = path.extname(filePath).toLowerCase();
        let parsed;
        let parseErrors = [];
        if (ext === '.json') {
            const jsonResult = parseJsonWithLineNumbers(content, filePath);
            parsed = jsonResult.data;
            parseErrors = jsonResult.errors;
        }
        else if (ext === '.yaml' || ext === '.yml') {
            const yamlResult = parseYamlWithLineNumbers(content, filePath);
            parsed = yamlResult.data;
            parseErrors = yamlResult.errors;
        }
        else {
            result.errors.push({
                file: filePath,
                message: '不支持的文件格式',
                error: `仅支持 .json, .yaml, .yml 格式`
            });
            return result;
        }
        result.errors.push(...parseErrors);
        if (!parsed) {
            return result;
        }
        if (parsed.contraindications && Array.isArray(parsed.contraindications)) {
            for (let i = 0; i < parsed.contraindications.length; i++) {
                const validated = validateContraindication(parsed.contraindications[i], i, filePath);
                if (validated) {
                    result.contraindications.push(validated);
                }
                else {
                    result.errors.push({
                        file: filePath,
                        line: i + 2,
                        message: '禁忌项数据不完整',
                        error: `第 ${i + 1} 个禁忌项缺少必填字段`
                    });
                }
            }
        }
        if (parsed.packages && Array.isArray(parsed.packages)) {
            for (let i = 0; i < parsed.packages.length; i++) {
                const validated = validatePackage(parsed.packages[i], i, filePath);
                if (validated) {
                    result.packages.push(validated);
                }
                else {
                    result.errors.push({
                        file: filePath,
                        line: i + 2,
                        message: '理疗套餐数据不完整',
                        error: `第 ${i + 1} 个理疗套餐缺少必填字段`
                    });
                }
            }
        }
    }
    catch (e) {
        result.errors.push({
            file: filePath,
            message: '文件读取失败',
            error: e.message
        });
    }
    return result;
}
function parseFiles(filePaths) {
    const combined = {
        contraindications: [],
        packages: [],
        errors: []
    };
    for (const filePath of filePaths) {
        const parsed = parseFile(filePath);
        combined.contraindications.push(...parsed.contraindications);
        combined.packages.push(...parsed.packages);
        combined.errors.push(...parsed.errors);
    }
    return combined;
}
