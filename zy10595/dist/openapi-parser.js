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
exports.OpenApiParser = void 0;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
class OpenApiParser {
    constructor() {
        this.badEntries = [];
        this.enums = [];
    }
    parseFile(filePath) {
        this.badEntries = [];
        this.enums = [];
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            let doc;
            try {
                doc = yaml.load(content);
            }
            catch (e) {
                this.addBadEntry(filePath, e.mark?.line, e.mark?.column, content.substring(0, 100), `YAML解析失败: ${e.message}`);
                return { enums: [], badEntries: this.badEntries };
            }
            if (!doc) {
                this.addBadEntry(filePath, undefined, undefined, '', 'OpenAPI文档为空');
                return { enums: [], badEntries: this.badEntries };
            }
            if (doc.components?.schemas) {
                this.parseSchemas(doc.components.schemas, filePath, lines);
            }
            this.parsePathsForEnums(doc.paths, filePath, lines);
        }
        catch (e) {
            this.addBadEntry(filePath, undefined, undefined, '', `文件读取失败: ${e.message}`);
        }
        return { enums: this.enums, badEntries: this.badEntries };
    }
    parseSchemas(schemas, filePath, lines) {
        for (const [name, schema] of Object.entries(schemas)) {
            this.parseSchemaEnum(name, schema, filePath, lines);
            if (schema.properties) {
                for (const [propName, prop] of Object.entries(schema.properties)) {
                    if (prop.enum) {
                        const enumName = `${name}_${propName}`;
                        this.parseEnumValues(enumName, prop.enum, prop, filePath, lines);
                    }
                }
            }
        }
    }
    parseSchemaEnum(name, schema, filePath, lines) {
        if (schema.enum) {
            this.parseEnumValues(name, schema.enum, schema, filePath, lines);
        }
        if (schema.items?.enum) {
            const enumName = `${name}_items`;
            this.parseEnumValues(enumName, schema.items.enum, schema.items, filePath, lines);
        }
        if (schema.allOf) {
            schema.allOf.forEach((subSchema, index) => {
                this.parseSchemaEnum(`${name}_allOf_${index}`, subSchema, filePath, lines);
            });
        }
        if (schema.oneOf) {
            schema.oneOf.forEach((subSchema, index) => {
                this.parseSchemaEnum(`${name}_oneOf_${index}`, subSchema, filePath, lines);
            });
        }
    }
    parsePathsForEnums(paths, filePath, lines) {
        if (!paths)
            return;
        for (const [path, pathItem] of Object.entries(paths)) {
            for (const [method, operation] of Object.entries(pathItem)) {
                if (operation.parameters) {
                    operation.parameters.forEach((param, index) => {
                        if (param.schema?.enum) {
                            const enumName = `${path.replace(/\//g, '_')}_${method}_${param.name}_param`;
                            this.parseEnumValues(enumName, param.schema.enum, param.schema, filePath, lines);
                        }
                    });
                }
                if (operation.requestBody?.content) {
                    for (const [contentType, content] of Object.entries(operation.requestBody.content)) {
                        if (content.schema?.enum) {
                            const enumName = `${path.replace(/\//g, '_')}_${method}_request`;
                            this.parseEnumValues(enumName, content.schema.enum, content.schema, filePath, lines);
                        }
                    }
                }
                if (operation.responses) {
                    for (const [statusCode, response] of Object.entries(operation.responses)) {
                        if (response.content) {
                            for (const [contentType, content] of Object.entries(response.content)) {
                                if (content.schema?.enum) {
                                    const enumName = `${path.replace(/\//g, '_')}_${method}_response_${statusCode}`;
                                    this.parseEnumValues(enumName, content.schema.enum, content.schema, filePath, lines);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    parseEnumValues(name, enumValues, schema, filePath, lines) {
        const values = [];
        enumValues.forEach((value, index) => {
            const lineInfo = this.findEnumLine(enumValues, index, lines);
            values.push({
                value: value,
                source: 'openapi',
                line: lineInfo.line,
                column: lineInfo.column
            });
        });
        const enumDef = {
            name,
            values,
            source: 'openapi',
            filePath,
            rawContent: JSON.stringify(schema.enum)
        };
        this.enums.push(enumDef);
    }
    findEnumLine(enumValues, index, lines) {
        const targetValue = JSON.stringify(enumValues[index]);
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            const column = line.indexOf(targetValue);
            if (column !== -1) {
                return { line: lineNum + 1, column: column + 1 };
            }
        }
        return {};
    }
    addBadEntry(filePath, line, column, rawContent, reason) {
        this.badEntries.push({
            filePath,
            line,
            column,
            rawContent,
            reason,
            severity: 'error'
        });
    }
}
exports.OpenApiParser = OpenApiParser;
