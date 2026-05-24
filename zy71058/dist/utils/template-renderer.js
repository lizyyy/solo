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
exports.renderTemplate = renderTemplate;
exports.renderTemplateFile = renderTemplateFile;
exports.renderTemplateDir = renderTemplateDir;
exports.resolveTemplateReferences = resolveTemplateReferences;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function getObjectByPath(obj, pathStr) {
    const parts = pathStr.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
const templateFunctions = {
    b64enc: (value) => Buffer.from(value).toString('base64'),
    b64dec: (value) => Buffer.from(value, 'base64').toString('utf-8'),
    quote: (value) => `"${value}"`,
    upper: (value) => value.toUpperCase(),
    lower: (value) => value.toLowerCase(),
    trim: (value) => value.trim(),
    toString: (value) => String(value),
    default: (defaultVal, value) => value !== undefined && value !== null && value !== '' ? value : defaultVal,
};
function resolvePathInContext(pathStr, context) {
    const normalizedPath = pathStr.startsWith('.') ? pathStr.substring(1) : pathStr;
    const parts = normalizedPath.split('.');
    if (parts.length === 0)
        return undefined;
    const rootKey = parts[0];
    const restPath = parts.slice(1).join('.');
    let rootObj;
    switch (rootKey) {
        case 'Values':
            rootObj = context.Values;
            break;
        case 'Release':
            rootObj = context.Release;
            break;
        case 'Chart':
            rootObj = context.Chart;
            break;
        default:
            rootObj = context.Values[rootKey];
    }
    if (restPath === '') {
        return rootObj;
    }
    if (rootObj === null || rootObj === undefined || typeof rootObj !== 'object') {
        return undefined;
    }
    return getObjectByPath(rootObj, restPath);
}
function applyPipeline(value, pipeline) {
    let result = value;
    for (const funcCall of pipeline) {
        const trimmed = funcCall.trim();
        if (!trimmed)
            continue;
        const funcParts = trimmed.split(/\s+/);
        const funcName = funcParts[0];
        const funcArgs = funcParts.slice(1);
        if (templateFunctions[funcName]) {
            try {
                result = templateFunctions[funcName](result, ...funcArgs);
            }
            catch {
            }
        }
    }
    return result;
}
function renderTemplate(content, values) {
    const context = {
        Values: values,
        Release: {
            Name: 'test-release',
            Namespace: 'default'
        },
        Chart: {
            Name: 'scanned-chart',
            Version: '1.0.0'
        }
    };
    let result = content;
    const templateRegex = /\{\{([^}]+)\}\}/g;
    result = result.replace(templateRegex, (match, expression) => {
        const expr = expression.trim();
        const parts = expr.split(/\s*\|\s*/);
        const valueExpr = parts[0].trim();
        const pipeline = parts.slice(1);
        if (valueExpr.startsWith('.')) {
            const resolved = resolvePathInContext(valueExpr, context);
            const stringValue = resolved !== undefined ? String(resolved) : match;
            if (pipeline.length > 0) {
                return applyPipeline(stringValue, pipeline);
            }
            return stringValue;
        }
        if (templateFunctions[valueExpr]) {
            const funcArgs = pipeline.map((p) => {
                const trimmed = p.trim();
                if (trimmed.startsWith('.')) {
                    const resolved = resolvePathInContext(trimmed, context);
                    return resolved !== undefined ? String(resolved) : trimmed;
                }
                return trimmed.replace(/^["']|["']$/g, '');
            });
            try {
                return templateFunctions[valueExpr](...funcArgs);
            }
            catch {
                return match;
            }
        }
        return match;
    });
    return result;
}
function renderTemplateFile(filePath, values) {
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const renderedContent = renderTemplate(originalContent, values);
    return {
        filePath,
        originalContent,
        renderedContent
    };
}
function renderTemplateDir(templateDir, values) {
    const results = [];
    if (!fs.existsSync(templateDir)) {
        return results;
    }
    const files = fs.readdirSync(templateDir);
    for (const file of files) {
        const fullPath = path.join(templateDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...renderTemplateDir(fullPath, values));
        }
        else if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.tpl')) {
            results.push(renderTemplateFile(fullPath, values));
        }
    }
    return results;
}
function resolveTemplateReferences(content, values) {
    return renderTemplate(content, values);
}
