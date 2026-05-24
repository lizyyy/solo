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
exports.loadFlagDefinitions = loadFlagDefinitions;
exports.mergeScanOptions = mergeScanOptions;
exports.parseLanguages = parseLanguages;
exports.parsePatterns = parsePatterns;
exports.ensureOutputDir = ensureOutputDir;
const constants_1 = require("./constants");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadFlagDefinitions(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Flag definitions file not found: ${absolutePath}`);
    }
    const content = fs.readFileSync(absolutePath, 'utf-8');
    try {
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
            throw new Error('Flag definitions must be an array');
        }
        return data.map((item, index) => validateFlagDefinition(item, index));
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON in flag definitions: ${error.message}`);
        }
        throw error;
    }
}
function validateFlagDefinition(item, index) {
    if (typeof item !== 'object' || item === null) {
        throw new Error(`Flag definition at index ${index} must be an object`);
    }
    const obj = item;
    if (typeof obj.name !== 'string' || obj.name.trim() === '') {
        throw new Error(`Flag definition at index ${index} must have a valid 'name' string`);
    }
    if (typeof obj.defaultValue !== 'boolean') {
        throw new Error(`Flag '${obj.name}' must have a boolean 'defaultValue'`);
    }
    if (obj.status !== undefined &&
        !['active', 'completed', 'archived', 'unknown'].includes(obj.status)) {
        throw new Error(`Flag '${obj.name}' has invalid status. Must be: active, completed, archived, unknown`);
    }
    return {
        name: obj.name,
        description: typeof obj.description === 'string' ? obj.description : undefined,
        defaultValue: obj.defaultValue,
        status: obj.status || 'unknown',
        owner: typeof obj.owner === 'string' ? obj.owner : undefined,
        createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
        completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : undefined,
        dynamicPattern: typeof obj.dynamicPattern === 'string' ? obj.dynamicPattern : undefined,
        notes: typeof obj.notes === 'string' ? obj.notes : undefined,
    };
}
function mergeScanOptions(overrides) {
    return {
        sourceDir: overrides.sourceDir || process.cwd(),
        flagDefinitions: overrides.flagDefinitions || [],
        outputDir: path.resolve(overrides.outputDir || constants_1.DEFAULT_OUTPUT_DIR),
        excludePatterns: [...constants_1.DEFAULT_EXCLUDE_PATTERNS, ...(overrides.excludePatterns || [])],
        includePatterns: overrides.includePatterns || ['**/*'],
        languages: overrides.languages || ['typescript', 'javascript', 'python', 'go', 'java'],
        defaultAssumedValue: overrides.defaultAssumedValue,
    };
}
function parseLanguages(languagesStr) {
    if (!languagesStr) {
        return ['typescript', 'javascript', 'python', 'go', 'java'];
    }
    const validLanguages = [
        'typescript', 'javascript', 'python', 'go', 'java', 'kotlin', 'swift', 'rust', 'other'
    ];
    const parsed = languagesStr.split(',').map(l => l.trim().toLowerCase());
    const invalid = parsed.filter(l => !validLanguages.includes(l));
    if (invalid.length > 0) {
        throw new Error(`Invalid languages: ${invalid.join(', ')}. Valid: ${validLanguages.join(', ')}`);
    }
    return parsed;
}
function parsePatterns(patternsStr) {
    if (!patternsStr)
        return [];
    return patternsStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
}
function ensureOutputDir(outputDir) {
    const absolutePath = path.resolve(outputDir);
    if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
    }
}
//# sourceMappingURL=config.js.map