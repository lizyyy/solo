import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { cloneDeep } from 'lodash';
import { OpenAPISchema, SchemaWithLocation, SchemaLocation } from '../types';

export class SchemaReader {
  private filePath: string;
  private openapiDoc: OpenAPISchema;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.openapiDoc = this.loadFile();
  }

  private loadFile(): OpenAPISchema {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const ext = path.extname(this.filePath).toLowerCase();

    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content) as OpenAPISchema;
    }

    throw new Error(`Unsupported file format: ${ext}`);
  }

  public getOpenAPIDocument(): OpenAPISchema {
    return cloneDeep(this.openapiDoc);
  }

  public extractSchemasWithExamples(): SchemaWithLocation[] {
    const results: SchemaWithLocation[] = [];

    if (this.openapiDoc.components?.schemas) {
      this.extractFromComponentSchemas(results);
    }

    if (this.openapiDoc.paths) {
      this.extractFromPaths(results);
    }

    return results;
  }

  private extractFromComponentSchemas(results: SchemaWithLocation[]): void {
    const schemas = this.openapiDoc.components!.schemas!;

    for (const [schemaName, schema] of Object.entries(schemas)) {
      const location: SchemaLocation = {
        path: `#/components/schemas/${schemaName}`,
        jsonPath: `$.components.schemas.${schemaName}`,
      };

      if (schema.example || schema.examples) {
        results.push({
          schema: this.resolveSchemaRefs(schema),
          location,
          example: schema.example,
          examples: schema.examples,
        });
      }

      if (schema.properties) {
        this.extractPropertyExamples(results, schema, location);
      }
    }
  }

  private extractFromPaths(results: SchemaWithLocation[]): void {
    const paths = this.openapiDoc.paths!;

    for (const [pathName, pathItem] of Object.entries(paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        if (operation.requestBody) {
          this.extractFromRequestBody(results, operation.requestBody, pathName, method);
        }

        if (operation.responses) {
          this.extractFromResponses(results, operation.responses, pathName, method);
        }
      }
    }
  }

  private extractFromRequestBody(
    results: SchemaWithLocation[],
    requestBody: any,
    pathName: string,
    method: string
  ): void {
    const resolved = this.resolveSchemaRefs(requestBody);
    if (!resolved.content) return;

    for (const [mediaType, mediaTypeObj] of Object.entries(resolved.content) as any) {
      const location: SchemaLocation = {
        path: pathName,
        method,
        mediaType,
        jsonPath: `$.paths.${pathName}.${method}.requestBody.content.${mediaType}`,
      };

      const schema = this.resolveSchemaRefs(mediaTypeObj.schema);
      if (mediaTypeObj.example || mediaTypeObj.examples) {
        results.push({
          schema,
          location,
          example: mediaTypeObj.example,
          examples: mediaTypeObj.examples,
        });
      }

      if (schema?.properties) {
        this.extractPropertyExamples(results, schema, location);
      }
    }
  }

  private extractFromResponses(
    results: SchemaWithLocation[],
    responses: any,
    pathName: string,
    method: string
  ): void {
    for (const [statusCode, response] of Object.entries(responses)) {
      const resolved = this.resolveSchemaRefs(response);
      if (!resolved.content) continue;

      for (const [mediaType, mediaTypeObj] of Object.entries(resolved.content) as any) {
        const location: SchemaLocation = {
          path: pathName,
          method,
          statusCode,
          mediaType,
          jsonPath: `$.paths.${pathName}.${method}.responses.${statusCode}.content.${mediaType}`,
        };

        const schema = this.resolveSchemaRefs(mediaTypeObj.schema);
        if (mediaTypeObj.example || mediaTypeObj.examples) {
          results.push({
            schema,
            location,
            example: mediaTypeObj.example,
            examples: mediaTypeObj.examples,
          });
        }

        if (schema?.properties) {
          this.extractPropertyExamples(results, schema, location);
        }
      }
    }
  }

  private extractPropertyExamples(
    results: SchemaWithLocation[],
    schema: any,
    parentLocation: SchemaLocation
  ): void {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const resolved = this.resolveSchemaRefs(propSchema);
      const location: SchemaLocation = {
        ...parentLocation,
        jsonPath: `${parentLocation.jsonPath}.properties.${propName}`,
      };

      if (resolved.example || resolved.examples) {
        results.push({
          schema: resolved,
          location,
          example: resolved.example,
          examples: resolved.examples,
        });
      }

      if (resolved.properties) {
        this.extractPropertyExamples(results, resolved, location);
      }
    }
  }

  private resolveSchemaRefs(schema: any, visited = new Set<string>()): any {
    if (!schema || typeof schema !== 'object') return schema;

    if (schema.$ref) {
      const ref = schema.$ref;
      if (visited.has(ref)) {
        return {};
      }
      visited.add(ref);

      const resolved = this.dereference(ref);
      return this.resolveSchemaRefs(resolved, visited);
    }

    if (Array.isArray(schema)) {
      return schema.map(item => this.resolveSchemaRefs(item, visited));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(schema)) {
      result[key] = this.resolveSchemaRefs(value, visited);
    }

    return result;
  }

  private dereference(ref: string): any {
    if (!ref.startsWith('#/')) {
      throw new Error(`External refs not supported: ${ref}`);
    }

    const parts = ref.slice(2).split('/');
    let current: any = this.openapiDoc;

    for (const part of parts) {
      const decoded = decodeURIComponent(part);
      if (current[decoded] === undefined) {
        throw new Error(`Cannot resolve ref: ${ref}`);
      }
      current = current[decoded];
    }

    return current;
  }
}
