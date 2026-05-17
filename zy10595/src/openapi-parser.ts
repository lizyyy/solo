import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { EnumDefinition, EnumValue, BadEntry } from './types';

export class OpenApiParser {
  private badEntries: BadEntry[] = [];
  private enums: EnumDefinition[] = [];

  parseFile(filePath: string): { enums: EnumDefinition[]; badEntries: BadEntry[] } {
    this.badEntries = [];
    this.enums = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      let doc: any;
      try {
        doc = yaml.load(content);
      } catch (e: any) {
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

    } catch (e: any) {
      this.addBadEntry(filePath, undefined, undefined, '', `文件读取失败: ${e.message}`);
    }

    return { enums: this.enums, badEntries: this.badEntries };
  }

  private parseSchemas(schemas: any, filePath: string, lines: string[]): void {
    for (const [name, schema] of Object.entries<any>(schemas)) {
      this.parseSchemaEnum(name, schema, filePath, lines);
      
      if (schema.properties) {
        for (const [propName, prop] of Object.entries<any>(schema.properties)) {
          if (prop.enum) {
            const enumName = `${name}_${propName}`;
            this.parseEnumValues(enumName, prop.enum, prop, filePath, lines);
          }
        }
      }
    }
  }

  private parseSchemaEnum(name: string, schema: any, filePath: string, lines: string[]): void {
    if (schema.enum) {
      this.parseEnumValues(name, schema.enum, schema, filePath, lines);
    }

    if (schema.items?.enum) {
      const enumName = `${name}_items`;
      this.parseEnumValues(enumName, schema.items.enum, schema.items, filePath, lines);
    }

    if (schema.allOf) {
      schema.allOf.forEach((subSchema: any, index: number) => {
        this.parseSchemaEnum(`${name}_allOf_${index}`, subSchema, filePath, lines);
      });
    }

    if (schema.oneOf) {
      schema.oneOf.forEach((subSchema: any, index: number) => {
        this.parseSchemaEnum(`${name}_oneOf_${index}`, subSchema, filePath, lines);
      });
    }
  }

  private parsePathsForEnums(paths: any, filePath: string, lines: string[]): void {
    if (!paths) return;

    for (const [path, pathItem] of Object.entries<any>(paths)) {
      for (const [method, operation] of Object.entries<any>(pathItem)) {
        if (operation.parameters) {
          operation.parameters.forEach((param: any, index: number) => {
            if (param.schema?.enum) {
              const enumName = `${path.replace(/\//g, '_')}_${method}_${param.name}_param`;
              this.parseEnumValues(enumName, param.schema.enum, param.schema, filePath, lines);
            }
          });
        }

        if (operation.requestBody?.content) {
          for (const [contentType, content] of Object.entries<any>(operation.requestBody.content)) {
            if (content.schema?.enum) {
              const enumName = `${path.replace(/\//g, '_')}_${method}_request`;
              this.parseEnumValues(enumName, content.schema.enum, content.schema, filePath, lines);
            }
          }
        }

        if (operation.responses) {
          for (const [statusCode, response] of Object.entries<any>(operation.responses)) {
            if (response.content) {
              for (const [contentType, content] of Object.entries<any>(response.content)) {
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

  private parseEnumValues(name: string, enumValues: any[], schema: any, filePath: string, lines: string[]): void {
    const values: EnumValue[] = [];

    enumValues.forEach((value, index) => {
      const lineInfo = this.findEnumLine(enumValues, index, lines);
      values.push({
        value: value,
        source: 'openapi',
        line: lineInfo.line,
        column: lineInfo.column
      });
    });

    const enumDef: EnumDefinition = {
      name,
      values,
      source: 'openapi',
      filePath,
      rawContent: JSON.stringify(schema.enum)
    };

    this.enums.push(enumDef);
  }

  private findEnumLine(enumValues: any[], index: number, lines: string[]): { line?: number; column?: number } {
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

  private addBadEntry(filePath: string, line: number | undefined, column: number | undefined, rawContent: string, reason: string): void {
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
