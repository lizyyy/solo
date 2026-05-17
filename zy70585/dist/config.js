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
exports.loadConfig = loadConfig;
exports.validateConfig = validateConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_CONFIG = {
    trustedProxies: ['127.0.0.1', '::1'],
    trustDepth: 1,
    trustedHeaders: ['X-Forwarded-For', 'X-Forwarded-Proto', 'X-Forwarded-Host', 'X-Forwarded-Port']
};
function loadConfig(configPath) {
    if (!configPath) {
        return { ...DEFAULT_CONFIG };
    }
    const absolutePath = path.resolve(configPath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`配置文件不存在: ${absolutePath}`);
    }
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const userConfig = JSON.parse(content);
    return {
        trustedProxies: userConfig.trustedProxies || DEFAULT_CONFIG.trustedProxies,
        trustDepth: userConfig.trustDepth ?? DEFAULT_CONFIG.trustDepth,
        trustedHeaders: userConfig.trustedHeaders || DEFAULT_CONFIG.trustedHeaders
    };
}
function validateConfig(config) {
    const errors = [];
    if (!Array.isArray(config.trustedProxies)) {
        errors.push('trustedProxies 必须是数组');
    }
    if (typeof config.trustDepth !== 'number' || config.trustDepth < 0) {
        errors.push('trustDepth 必须是大于等于0的数字');
    }
    if (!Array.isArray(config.trustedHeaders)) {
        errors.push('trustedHeaders 必须是数组');
    }
    return errors;
}
