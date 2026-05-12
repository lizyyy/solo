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
    constructor(baseDir = process.cwd()) {
        this.baseDir = baseDir;
    }
    parse(serviceName, filePath) {
        const anomalies = [];
        const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.baseDir, filePath);
        if (!fs.existsSync(fullPath)) {
            anomalies.push({
                type: 'invalid_contract',
                serviceName,
                message: `OpenAPI 文件不存在: ${fullPath}`,
                source: fullPath
            });
            throw new Error(`OpenAPI 文件不存在: ${fullPath}`);
        }
        let rawSpec;
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            rawSpec = this.parseFile(content, fullPath);
        }
        catch (error) {
            anomalies.push({
                type: 'invalid_contract',
                serviceName,
                message: `OpenAPI 文件解析失败: ${error.message}`,
                source: fullPath
            });
            throw new Error(`OpenAPI 文件解析失败: ${error.message}`);
        }
        if (!rawSpec || !rawSpec.openapi) {
            anomalies.push({
                type: 'invalid_contract',
                serviceName,
                message: `无效的 OpenAPI 规范，缺少 openapi 字段`,
                source: fullPath
            });
            throw new Error('无效的 OpenAPI 规范');
        }
        const parsed = this.parseOpenAPI(serviceName, rawSpec, fullPath, anomalies);
        return { parsed, anomalies };
    }
    parseOpenAPI(serviceName, spec, source, anomalies) {
        const paths = [];
        const schemas = {};
        if (spec.components && spec.components.schemas) {
            for (const [name, schema] of Object.entries(spec.components.schemas)) {
                schemas[name] = this.parseSchema(schema);
            }
        }
        if (spec.paths) {
            const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
            for (const [pathName, pathItem] of Object.entries(spec.paths)) {
                if (!pathItem || typeof pathItem !== 'object')
                    continue;
                for (const method of httpMethods) {
                    const operation = pathItem[method];
                    if (!operation || typeof operation !== 'object')
                        continue;
                    if (!operation.operationId) {
                        anomalies.push({
                            type: 'missing_operation_id',
                            serviceName,
                            path: pathName,
                            method,
                            message: `接口缺少 operationId: ${method.toUpperCase()} ${pathName}`,
                            source
                        });
                    }
                    const parameters = [];
                    const globalParams = pathItem.parameters;
                    if (Array.isArray(globalParams)) {
                        for (const param of globalParams) {
                            parameters.push(this.parseParameter(param));
                        }
                    }
                    if (Array.isArray(operation.parameters)) {
                        for (const param of operation.parameters) {
                            parameters.push(this.parseParameter(param));
                        }
                    }
                    const requestBody = operation.requestBody
                        ? this.parseRequestBody(operation.requestBody)
                        : undefined;
                    const responses = [];
                    if (operation.responses) {
                        for (const [statusCode, response] of Object.entries(operation.responses)) {
                            responses.push({
                                statusCode,
                                description: response.description,
                                content: this.parseResponseContent(response.content)
                            });
                        }
                    }
                    paths.push({
                        path: pathName,
                        method,
                        operationId: operation.operationId,
                        summary: operation.summary,
                        description: operation.description,
                        parameters,
                        requestBody,
                        responses
                    });
                }
            }
        }
        return {
            serviceName,
            version: spec.info?.version || 'unknown',
            paths,
            schemas
        };
    }
    parseParameter(param) {
        return {
            name: param.name,
            in: param.in,
            required: param.required || false,
            schema: param.schema ? this.parseSchema(param.schema) : undefined,
            description: param.description
        };
    }
    parseRequestBody(body) {
        return {
            required: body.required || false,
            content: this.parseResponseContent(body.content),
            description: body.description
        };
    }
    parseResponseContent(content) {
        const result = {};
        if (!content)
            return result;
        for (const [mimeType, schemaObj] of Object.entries(content)) {
            const schema = schemaObj.schema;
            if (schema) {
                result[mimeType] = this.parseSchema(schema);
            }
        }
        return result;
    }
    parseSchema(schema) {
        if (!schema)
            return {};
        if (schema.$ref) {
            return { $ref: schema.$ref };
        }
        const result = {
            type: schema.type,
            nullable: schema.nullable,
            additionalProperties: schema.additionalProperties,
            description: schema.description
        };
        if (schema.properties) {
            result.properties = {};
            for (const [key, value] of Object.entries(schema.properties)) {
                result.properties[key] = this.parseSchema(value);
            }
        }
        if (schema.required) {
            result.required = schema.required;
        }
        if (schema.items) {
            result.items = this.parseSchema(schema.items);
        }
        if (schema.enum) {
            result.enum = schema.enum.map((v) => String(v));
        }
        if (schema.allOf) {
            result.allOf = schema.allOf.map((s) => this.parseSchema(s));
        }
        if (schema.anyOf) {
            result.anyOf = schema.anyOf.map((s) => this.parseSchema(s));
        }
        if (schema.oneOf) {
            result.oneOf = schema.oneOf.map((s) => this.parseSchema(s));
        }
        return result;
    }
    parseFile(content, filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.json') {
            return JSON.parse(content);
        }
        return yaml.load(content);
    }
    resolveSchemaRef(parsed, schema) {
        if (!schema.$ref) {
            return schema;
        }
        const parts = schema.$ref.split('/');
        if (parts.length !== 4 || parts[1] !== 'components' || parts[2] !== 'schemas') {
            return null;
        }
        const schemaName = parts[3];
        const refSchema = parsed.schemas[schemaName];
        if (!refSchema) {
            return null;
        }
        if (refSchema.$ref) {
            return this.resolveSchemaRef(parsed, refSchema);
        }
        return refSchema;
    }
    flattenSchema(parsed, schema) {
        const resolved = this.resolveSchemaRef(parsed, schema);
        if (!resolved)
            return schema;
        const result = { ...resolved };
        if (resolved.allOf) {
            const combined = {};
            const allProperties = {};
            const allRequired = [];
            for (const sub of resolved.allOf) {
                const flattened = this.flattenSchema(parsed, sub);
                if (flattened.properties) {
                    Object.assign(allProperties, flattened.properties);
                }
                if (flattened.required) {
                    allRequired.push(...flattened.required);
                }
                Object.assign(combined, flattened);
            }
            if (Object.keys(allProperties).length > 0) {
                combined.properties = allProperties;
            }
            if (allRequired.length > 0) {
                combined.required = [...new Set(allRequired)];
            }
            delete combined.allOf;
            return combined;
        }
        if (result.properties) {
            const flattenedProps = {};
            for (const [key, prop] of Object.entries(result.properties)) {
                flattenedProps[key] = this.flattenSchema(parsed, prop);
            }
            result.properties = flattenedProps;
        }
        if (result.items) {
            result.items = this.flattenSchema(parsed, result.items);
        }
        return result;
    }
    getSchemaForPath(parsed, path, method) {
        return parsed.paths.find(p => p.path === path && p.method === method);
    }
    getSchemaByOperationId(parsed, operationId) {
        return parsed.paths.find(p => p.operationId === operationId);
    }
}
exports.OpenAPIParser = OpenAPIParser;
//# sourceMappingURL=openapi-parser.js.map