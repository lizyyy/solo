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
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.fileExists = fileExists;
exports.ensureDir = ensureDir;
exports.hashString = hashString;
exports.parseFieldType = parseFieldType;
exports.formatTypeInfo = formatTypeInfo;
exports.loadConfigFile = loadConfigFile;
exports.validateSchemaPath = validateSchemaPath;
exports.validateQueryPaths = validateQueryPaths;
exports.findQueryFiles = findQueryFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
function readFile(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }
    return fs.readFileSync(absolutePath, 'utf-8');
}
function writeFile(filePath, content) {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absolutePath, content, 'utf-8');
}
function fileExists(filePath) {
    return fs.existsSync(path.resolve(filePath));
}
function ensureDir(dirPath) {
    const absolutePath = path.resolve(dirPath);
    if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
    }
}
function hashString(str) {
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}
function parseFieldType(typeStr) {
    let isNonNull = false;
    let isList = false;
    let listInnerNonNull = false;
    let rawType = typeStr;
    if (rawType.endsWith('!')) {
        isNonNull = true;
        rawType = rawType.slice(0, -1);
    }
    if (rawType.startsWith('[') && rawType.endsWith(']')) {
        isList = true;
        rawType = rawType.slice(1, -1);
        if (rawType.endsWith('!')) {
            listInnerNonNull = true;
            rawType = rawType.slice(0, -1);
        }
    }
    return {
        isNonNull,
        isList,
        innerType: rawType,
        fullType: typeStr,
        rawType,
        listInnerNonNull,
    };
}
function formatTypeInfo(info) {
    let result = info.innerType;
    if (info.isList) {
        result = `[${result}${info.listInnerNonNull ? '!' : ''}]`;
    }
    if (info.isNonNull) {
        result += '!';
    }
    return result;
}
function loadConfigFile(configPath) {
    if (!configPath) {
        const defaultPaths = [
            '.gql-null-drift.json',
            '.gql-null-driftrc',
            'config/gql-null-drift.json',
        ];
        for (const p of defaultPaths) {
            if (fileExists(p)) {
                configPath = p;
                break;
            }
        }
    }
    if (!configPath || !fileExists(configPath)) {
        return null;
    }
    try {
        const content = readFile(configPath);
        return JSON.parse(content);
    }
    catch (e) {
        throw new Error(`配置文件解析失败: ${configPath}`);
    }
}
function validateSchemaPath(filePath) {
    if (!filePath) {
        throw new Error('Schema路径不能为空');
    }
    if (!fileExists(filePath)) {
        throw new Error(`Schema文件不存在: ${filePath}`);
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!['.graphql', '.gql', '.json', '.sdl'].includes(ext)) {
        throw new Error(`不支持的Schema文件格式: ${filePath}`);
    }
}
function validateQueryPaths(paths) {
    for (const p of paths) {
        if (!fileExists(p)) {
            throw new Error(`查询文件不存在: ${p}`);
        }
        const ext = path.extname(p).toLowerCase();
        if (!['.graphql', '.gql'].includes(ext)) {
            throw new Error(`不支持的查询文件格式: ${p}`);
        }
    }
}
function findQueryFiles(patterns) {
    const files = [];
    for (const pattern of patterns) {
        const resolvedPath = path.resolve(pattern);
        if (fs.existsSync(resolvedPath)) {
            const stat = fs.statSync(resolvedPath);
            if (stat.isDirectory()) {
                const walk = (dir) => {
                    const entries = fs.readdirSync(dir);
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry);
                        const entryStat = fs.statSync(fullPath);
                        if (entryStat.isDirectory()) {
                            walk(fullPath);
                        }
                        else if (['.graphql', '.gql'].includes(path.extname(entry).toLowerCase())) {
                            files.push(fullPath);
                        }
                    }
                };
                walk(resolvedPath);
            }
            else if (stat.isFile()) {
                files.push(resolvedPath);
            }
        }
    }
    return [...new Set(files)];
}
//# sourceMappingURL=utils.js.map