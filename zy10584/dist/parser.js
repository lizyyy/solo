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
exports.OpenAPIParser = void 0;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
const path = __importStar(require("path"));
class OpenAPIParser {
    constructor(filePath) {
        this.filePath = filePath;
        this.spec = this.loadSpec();
    }
    loadSpec() {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const ext = path.extname(this.filePath).toLowerCase();
        if (ext === '.yaml' || ext === '.yml') {
            return yaml.load(content);
        }
        else if (ext === '.json') {
            return JSON.parse(content);
        }
        throw new Error(`Unsupported file format: ${ext}. Use .yaml, .yml, or .json`);
    }
    getSpec() {
        return this.spec;
    }
    getFilePath() {
        return this.filePath;
    }
    resolveRef(ref) {
        if (!ref.startsWith('#/')) {
            return null;
        }
        const parts = ref.replace('#/', '').split('/');
        let current = this.spec;
        for (const part of parts) {
            const decodedPart = decodeURIComponent(part);
            if (current && typeof current === 'object' && decodedPart in current) {
                current = current[decodedPart];
            }
            else {
                return null;
            }
        }
        return current;
    }
    resolveSchema(schema) {
        if (!schema)
            return null;
        if (schema.$ref) {
            const resolved = this.resolveRef(schema.$ref);
            return resolved ? this.resolveSchema(resolved) : null;
        }
        return schema;
    }
    getResponseSchema(response) {
        if (!response?.content)
            return null;
        const contentTypes = Object.keys(response.content);
        for (const contentType of contentTypes) {
            if (response.content[contentType]?.schema) {
                return this.resolveSchema(response.content[contentType].schema);
            }
        }
        return null;
    }
    extractResponseFields(schema) {
        if (!schema?.properties)
            return [];
        return Object.keys(schema.properties);
    }
    extractNestedField(schema, fieldPath) {
        if (!schema)
            return null;
        const parts = fieldPath.split('.');
        let current = schema;
        for (const part of parts) {
            if (!current?.properties || !current.properties[part]) {
                return null;
            }
            current = this.resolveSchema(current.properties[part]);
        }
        return fieldPath;
    }
    static getDefaultConfig() {
        return {
            expectedParams: {
                page: ['page', 'pageNum', 'page_number', 'current'],
                pageSize: ['pageSize', 'size', 'per_page', 'limit', 'count']
            },
            expectedResponseFields: {
                data: ['data', 'items', 'list', 'records', 'rows'],
                total: ['total', 'totalCount', 'total_count', 'totalElements'],
                page: ['page', 'pageNum', 'current', 'page_number'],
                pageSize: ['pageSize', 'size', 'per_page', 'limit'],
                totalPages: ['totalPages', 'pages', 'page_count', 'total_pages']
            },
            httpMethods: ['get']
        };
    }
}
exports.OpenAPIParser = OpenAPIParser;
//# sourceMappingURL=parser.js.map