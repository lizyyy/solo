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
const Handlebars = __importStar(require("handlebars"));
Handlebars.registerHelper('tpl', function (template, context) {
    try {
        const compiled = Handlebars.compile(template);
        return compiled(context);
    }
    catch {
        return template;
    }
});
Handlebars.registerHelper('default', function (defaultValue, value) {
    return value !== undefined && value !== null ? value : defaultValue;
});
Handlebars.registerHelper('required', function (message, value) {
    if (value === undefined || value === null || value === '') {
        return `[REQUIRED: ${message}]`;
    }
    return value;
});
Handlebars.registerHelper('trimSuffix', function (suffix, str) {
    if (str.endsWith(suffix)) {
        return str.slice(0, -suffix.length);
    }
    return str;
});
Handlebars.registerHelper('trimPrefix', function (prefix, str) {
    if (str.startsWith(prefix)) {
        return str.slice(prefix.length);
    }
    return str;
});
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
Handlebars.registerHelper('include', function (name, context) {
    return `{{ include "${name}" . }}`;
});
Handlebars.registerHelper('toYaml', function (obj) {
    if (obj === null || obj === undefined) {
        return '';
    }
    return JSON.stringify(obj, null, 2);
});
function renderTemplate(content, values) {
    try {
        const compiled = Handlebars.compile(content, {
            strict: false,
            noEscape: true
        });
        const context = {
            ...values,
            Values: values,
            Chart: {
                Name: 'scanned-chart',
                Version: '1.0.0'
            },
            Release: {
                Name: 'test-release',
                Namespace: 'default'
            }
        };
        return compiled(context);
    }
    catch (e) {
        console.warn(`模板渲染警告: ${e.message}`);
        return content;
    }
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
    let result = content;
    const goTemplateRegex = /{{\s*\.Values\.([a-zA-Z0-9_.]+)\s*}}/g;
    result = result.replace(goTemplateRegex, (match, pathStr) => {
        const value = getObjectByPath(values, pathStr);
        return value !== undefined ? String(value) : match;
    });
    const simpleVarRegex = /\$\{([a-zA-Z0-9_.]+)\}/g;
    result = result.replace(simpleVarRegex, (match, varName) => {
        const value = getObjectByPath(values, varName);
        return value !== undefined ? String(value) : match;
    });
    return result;
}
