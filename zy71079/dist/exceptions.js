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
exports.ExceptionLoader = void 0;
exports.loadExceptions = loadExceptions;
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
class ExceptionLoader {
    constructor(filePath) {
        this.rules = [];
        this.filePath = filePath;
    }
    async load() {
        if (!fs.existsSync(this.filePath)) {
            return [];
        }
        const content = await fs.promises.readFile(this.filePath, 'utf-8');
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                this.rules = data.map(this.validateRule.bind(this));
            }
            else if (data.exceptions && Array.isArray(data.exceptions)) {
                this.rules = data.exceptions.map(this.validateRule.bind(this));
            }
        }
        catch (error) {
            throw new Error(`Failed to parse exceptions file: ${error.message}`);
        }
        return this.rules;
    }
    validateRule(rule) {
        if (!rule.path) {
            throw new Error('Exception rule must have a "path" field');
        }
        if (!rule.reason) {
            throw new Error(`Exception rule for path "${rule.path}" must have a "reason" field`);
        }
        if (!rule.createdAt) {
            throw new Error(`Exception rule for path "${rule.path}" must have a "createdAt" field`);
        }
        if (!rule.createdBy) {
            throw new Error(`Exception rule for path "${rule.path}" must have a "createdBy" field`);
        }
        return {
            path: rule.path,
            reason: rule.reason,
            expiresAt: rule.expiresAt,
            createdAt: rule.createdAt,
            createdBy: rule.createdBy,
        };
    }
    getMatchingRule(filePath) {
        const normalizedPath = (0, utils_1.normalizeFilePath)(filePath);
        for (const rule of this.rules) {
            if ((0, utils_1.matchesGlobPattern)(normalizedPath, rule.path)) {
                return rule;
            }
        }
        return undefined;
    }
    getExpiredRules() {
        return this.rules.filter(rule => rule.expiresAt && (0, utils_1.isExpired)(rule.expiresAt));
    }
    getActiveRules() {
        return this.rules.filter(rule => !rule.expiresAt || !(0, utils_1.isExpired)(rule.expiresAt));
    }
    getAllRules() {
        return this.rules;
    }
    isPathExcluded(filePath) {
        const rule = this.getMatchingRule(filePath);
        if (!rule)
            return false;
        if (rule.expiresAt && (0, utils_1.isExpired)(rule.expiresAt))
            return false;
        return true;
    }
}
exports.ExceptionLoader = ExceptionLoader;
async function loadExceptions(filePath) {
    const loader = new ExceptionLoader(filePath);
    await loader.load();
    return loader;
}
//# sourceMappingURL=exceptions.js.map