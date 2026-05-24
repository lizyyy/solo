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
exports.parseI18nFile = parseI18nFile;
exports.extractPlaceholders = extractPlaceholders;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PLURAL_KEY_PATTERNS = [
    /(.+)_zero$/,
    /(.+)_one$/,
    /(.+)_two$/,
    /(.+)_few$/,
    /(.+)_many$/,
    /(.+)_other$/,
    /(.+)\[zero\]$/,
    /(.+)\[one\]$/,
    /(.+)\[two\]$/,
    /(.+)\[few\]$/,
    /(.+)\[many\]$/,
    /(.+)\[other\]$/,
];
function parseI18nFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');
    const locale = detectLocaleFromPath(filePath);
    let data;
    if (ext === '.json') {
        data = JSON.parse(content);
    }
    else if (ext === '.yaml' || ext === '.yml') {
        data = parseYaml(content);
    }
    else {
        throw new Error(`不支持的文件格式: ${ext}`);
    }
    return flattenObject(data, locale);
}
function parseYaml(content) {
    const result = {};
    const lines = content.split('\n');
    const stack = [];
    let currentObj = result;
    let currentIndent = -1;
    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#'))
            continue;
        const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
        if (!match)
            continue;
        const [, indentStr, key, value] = match;
        const indent = indentStr.length;
        const cleanKey = key.trim().replace(/^['"]|['"]$/g, '');
        const cleanValue = value.trim().replace(/^['"]|['"]$/g, '');
        while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            const popped = stack.pop();
            currentObj = popped.obj;
        }
        if (cleanValue) {
            currentObj[cleanKey] = cleanValue;
        }
        else {
            const newObj = {};
            currentObj[cleanKey] = newObj;
            stack.push({ indent, obj: currentObj, key: cleanKey });
            currentObj = newObj;
        }
    }
    return result;
}
function flattenObject(obj, locale, prefix = '') {
    const entries = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
            const { baseKey, pluralForm } = detectPluralForm(fullKey);
            entries.push({
                key: baseKey,
                value,
                locale,
                pluralForm,
                originalValue: value,
            });
        }
        else if (value && typeof value === 'object') {
            if (isPluralObject(value)) {
                for (const [pluralKey, pluralValue] of Object.entries(value)) {
                    if (typeof pluralValue === 'string') {
                        entries.push({
                            key: fullKey,
                            value: pluralValue,
                            locale,
                            pluralForm: pluralKey,
                            originalValue: pluralValue,
                        });
                    }
                }
            }
            else {
                entries.push(...flattenObject(value, locale, fullKey));
            }
        }
    }
    return entries;
}
function detectPluralForm(key) {
    for (const pattern of PLURAL_KEY_PATTERNS) {
        const match = key.match(pattern);
        if (match) {
            const pluralForm = key.includes('[')
                ? key.match(/\[(.+)\]$/)?.[1]
                : key.split('_').pop();
            return { baseKey: match[1], pluralForm };
        }
    }
    return { baseKey: key };
}
function isPluralObject(obj) {
    const pluralKeys = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const keys = Object.keys(obj);
    return keys.length > 0 && keys.every(k => pluralKeys.includes(k));
}
function detectLocaleFromPath(filePath) {
    const parts = filePath.split(/[/\\]/);
    const filename = path.basename(filePath, path.extname(filePath));
    const localePattern = /^[a-z]{2}([-_][A-Z]{2})?$/;
    if (localePattern.test(filename)) {
        return filename.replace('_', '-');
    }
    for (const part of parts.reverse()) {
        if (localePattern.test(part)) {
            return part.replace('_', '-');
        }
    }
    return 'unknown';
}
function extractPlaceholders(text) {
    const placeholders = [];
    const patterns = [
        /\{(\w+)\}/g,
        /\%\{(\w+)\}/g,
        /\$(\w+)/g,
        /\$(\{(\w+)\})/g,
        /\{\{(\w+)\}\}/g,
        /\%s/g,
        /\%d/g,
        /\%f/g,
    ];
    for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const placeholder = match[0];
            if (!placeholders.includes(placeholder)) {
                placeholders.push(placeholder);
            }
        }
    }
    return placeholders;
}
//# sourceMappingURL=parser.js.map