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
exports.parseJsonOrYaml = parseJsonOrYaml;
exports.ensureDir = ensureDir;
exports.writeFile = writeFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
function readFile(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`文件不存在: ${absolutePath}`);
    }
    return fs.readFileSync(absolutePath, 'utf-8');
}
function parseJsonOrYaml(content, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
        try {
            return JSON.parse(content);
        }
        catch (e) {
            throw new Error(`JSON 解析错误 (${filePath}): ${e.message}`);
        }
    }
    if (ext === '.yaml' || ext === '.yml') {
        try {
            return yaml.load(content);
        }
        catch (e) {
            throw new Error(`YAML 解析错误 (${filePath}): ${e.message}`);
        }
    }
    try {
        return JSON.parse(content);
    }
    catch {
        try {
            return yaml.load(content);
        }
        catch (e) {
            throw new Error(`无法解析文件 (${filePath}): 不是有效的 JSON 或 YAML 格式`);
        }
    }
}
function ensureDir(dirPath) {
    const absolutePath = path.resolve(dirPath);
    if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
    }
}
function writeFile(filePath, content) {
    const absolutePath = path.resolve(filePath);
    ensureDir(path.dirname(absolutePath));
    fs.writeFileSync(absolutePath, content, 'utf-8');
}
