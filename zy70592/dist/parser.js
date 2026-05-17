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
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
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
        throw new Error(`Unsupported file format: ${ext}`);
    }
    getSpec() {
        return this.spec;
    }
    resolveRef(ref) {
        if (!ref.startsWith('#/components/schemas/')) {
            throw new Error(`Unsupported ref format: ${ref}`);
        }
        const schemaName = ref.replace('#/components/schemas/', '');
        const schema = this.spec.components?.schemas?.[schemaName];
        if (!schema) {
            throw new Error(`Schema not found: ${schemaName}`);
        }
        return this.resolveSchema(schema);
    }
    resolveSchema(schema) {
        if (schema.$ref) {
            return this.resolveRef(schema.$ref);
        }
        if (schema.properties) {
            const resolvedProperties = {};
            for (const [key, value] of Object.entries(schema.properties)) {
                resolvedProperties[key] = this.resolveSchema(value);
            }
            return { ...schema, properties: resolvedProperties };
        }
        return schema;
    }
    extractSchemaFields(schema) {
        const resolved = this.resolveSchema(schema);
        if (resolved.properties) {
            return Object.keys(resolved.properties);
        }
        return [];
    }
    isErrorStatusCode(statusCode) {
        const code = parseInt(statusCode, 10);
        return !isNaN(code) && code >= 400 && code < 600;
    }
    extractErrorResponses() {
        const errorResponses = [];
        for (const [path, pathItem] of Object.entries(this.spec.paths)) {
            const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
            for (const method of methods) {
                const operation = pathItem[method];
                if (!operation?.responses)
                    continue;
                for (const [statusCode, response] of Object.entries(operation.responses)) {
                    if (!this.isErrorStatusCode(statusCode))
                        continue;
                    if (!response.content) {
                        errorResponses.push({
                            path,
                            method: method.toUpperCase(),
                            statusCode,
                            contentType: 'none',
                            schemaFields: [],
                            rawSchema: {},
                            location: {
                                path,
                                method: method.toUpperCase(),
                                statusCode,
                            },
                        });
                        continue;
                    }
                    for (const [contentType, mediaType] of Object.entries(response.content)) {
                        if (mediaType.schema) {
                            const fields = this.extractSchemaFields(mediaType.schema);
                            errorResponses.push({
                                path,
                                method: method.toUpperCase(),
                                statusCode,
                                contentType,
                                schemaFields: fields,
                                rawSchema: mediaType.schema,
                                location: {
                                    path,
                                    method: method.toUpperCase(),
                                    statusCode,
                                },
                            });
                        }
                        else {
                            errorResponses.push({
                                path,
                                method: method.toUpperCase(),
                                statusCode,
                                contentType,
                                schemaFields: [],
                                rawSchema: {},
                                location: {
                                    path,
                                    method: method.toUpperCase(),
                                    statusCode,
                                },
                            });
                        }
                    }
                }
            }
        }
        return errorResponses;
    }
    getTotalEndpoints() {
        let count = 0;
        for (const pathItem of Object.values(this.spec.paths)) {
            const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
            for (const method of methods) {
                if (pathItem[method])
                    count++;
            }
        }
        return count;
    }
}
exports.OpenAPIParser = OpenAPIParser;
