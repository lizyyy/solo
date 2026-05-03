import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  FileNotFoundError,
  InvalidFormatError,
  InvalidOpenAPIVersionError
} from './errors.js';

export function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new FileNotFoundError(filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

export function parseOpenAPI(filePath) {
  const content = readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  let spec;
  try {
    if (ext === '.yaml' || ext === '.yml') {
      spec = yaml.load(content);
    } else if (ext === '.json') {
      spec = JSON.parse(content);
    } else {
      throw new InvalidFormatError(`不支持的文件格式: ${ext}`, filePath);
    }
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      throw new InvalidFormatError(`YAML 解析错误: ${err.message}`, filePath);
    } else if (err instanceof SyntaxError) {
      throw new InvalidFormatError(`JSON 解析错误: ${err.message}`, filePath);
    }
    throw new InvalidFormatError(err.message, filePath);
  }
  
  validateOpenAPIVersion(spec, filePath);
  
  return normalizeOpenAPI(spec);
}

function validateOpenAPIVersion(spec, filePath) {
  if (!spec.openapi) {
    throw new InvalidOpenAPIVersionError('undefined', filePath);
  }
  
  const version = spec.openapi;
  if (!version.startsWith('3.')) {
    throw new InvalidOpenAPIVersionError(version, filePath);
  }
}

function normalizeOpenAPI(spec) {
  const normalized = {
    openapi: spec.openapi,
    info: spec.info,
    servers: spec.servers || [],
    paths: {},
    components: normalizeComponents(spec.components)
  };
  
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      normalized.paths[path] = normalizePathItem(pathItem, normalized.components);
    }
  }
  
  return normalized;
}

function normalizePathItem(pathItem, components) {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
  const normalized = {
    summary: pathItem.summary,
    description: pathItem.description,
    parameters: normalizeParameters(pathItem.parameters, components),
    operations: {}
  };
  
  for (const method of methods) {
    if (pathItem[method]) {
      normalized.operations[method.toUpperCase()] = normalizeOperation(
        pathItem[method],
        components,
        normalized.parameters
      );
    }
  }
  
  return normalized;
}

function normalizeOperation(operation, components, pathParams = []) {
  return {
    summary: operation.summary,
    description: operation.description,
    operationId: operation.operationId,
    parameters: [...pathParams, ...normalizeParameters(operation.parameters, components)],
    requestBody: normalizeRequestBody(operation.requestBody, components),
    responses: normalizeResponses(operation.responses, components),
    security: operation.security,
    deprecated: operation.deprecated || false
  };
}

function normalizeParameters(params, components) {
  if (!params) return [];
  return params.map(param => normalizeParameter(param, components));
}

function normalizeParameter(param, components) {
  if (param.$ref) {
    return resolveRef(param.$ref, components);
  }
  return {
    name: param.name,
    in: param.in,
    description: param.description,
    required: param.required || false,
    schema: normalizeSchema(param.schema, components),
    deprecated: param.deprecated || false,
    allowEmptyValue: param.allowEmptyValue
  };
}

function normalizeRequestBody(requestBody, components) {
  if (!requestBody) return null;
  if (requestBody.$ref) {
    return resolveRef(requestBody.$ref, components);
  }
  
  return {
    description: requestBody.description,
    required: requestBody.required || false,
    content: normalizeContent(requestBody.content, components)
  };
}

function normalizeContent(content, components) {
  if (!content) return {};
  const normalized = {};
  for (const [mediaType, mediaTypeObj] of Object.entries(content)) {
    normalized[mediaType] = {
      schema: normalizeSchema(mediaTypeObj.schema, components),
      example: mediaTypeObj.example,
      examples: mediaTypeObj.examples
    };
  }
  return normalized;
}

function normalizeResponses(responses, components) {
  if (!responses) return {};
  const normalized = {};
  for (const [statusCode, response] of Object.entries(responses)) {
    let res = response;
    if (res.$ref) {
      res = resolveRef(res.$ref, components);
    }
    normalized[statusCode] = {
      description: res.description,
      headers: normalizeHeaders(res.headers, components),
      content: normalizeContent(res.content, components)
    };
  }
  return normalized;
}

function normalizeHeaders(headers, components) {
  if (!headers) return {};
  const normalized = {};
  for (const [name, header] of Object.entries(headers)) {
    let h = header;
    if (h.$ref) {
      h = resolveRef(h.$ref, components);
    }
    normalized[name] = {
      description: h.description,
      required: h.required || false,
      deprecated: h.deprecated || false,
      schema: normalizeSchema(h.schema, components)
    };
  }
  return normalized;
}

function normalizeSchema(schema, components) {
  if (!schema) return null;
  
  if (schema.$ref) {
    return {
      $ref: schema.$ref,
      ...resolveRef(schema.$ref, components)
    };
  }
  
  const normalized = {
    type: schema.type,
    format: schema.format,
    description: schema.description,
    nullable: schema.nullable || false,
    enum: schema.enum,
    default: schema.default,
    example: schema.example,
    deprecated: schema.deprecated || false
  };
  
  if (schema.type === 'object' && schema.properties) {
    normalized.properties = {};
    for (const [propName, prop] of Object.entries(schema.properties)) {
      normalized.properties[propName] = normalizeSchema(prop, components);
    }
    normalized.required = schema.required || [];
    normalized.additionalProperties = schema.additionalProperties;
  }
  
  if (schema.type === 'array' && schema.items) {
    normalized.items = normalizeSchema(schema.items, components);
  }
  
  if (schema.allOf) {
    normalized.allOf = schema.allOf.map(s => normalizeSchema(s, components));
  }
  
  if (schema.oneOf) {
    normalized.oneOf = schema.oneOf.map(s => normalizeSchema(s, components));
  }
  
  if (schema.anyOf) {
    normalized.anyOf = schema.anyOf.map(s => normalizeSchema(s, components));
  }
  
  return normalized;
}

function normalizeComponents(components) {
  if (!components) {
    return {
      schemas: {},
      requestBodies: {},
      responses: {},
      parameters: {},
      headers: {},
      securitySchemes: {}
    };
  }
  return {
    schemas: components.schemas || {},
    requestBodies: components.requestBodies || {},
    responses: components.responses || {},
    parameters: components.parameters || {},
    headers: components.headers || {},
    securitySchemes: components.securitySchemes || {}
  };
}

function resolveRef(ref, components) {
  if (!ref.startsWith('#/components/')) {
    return null;
  }
  
  const parts = ref.split('/');
  const type = parts[2];
  const name = parts[3];
  
  const componentMap = {
    schemas: 'schemas',
    requestBodies: 'requestBodies',
    responses: 'responses',
    parameters: 'parameters',
    headers: 'headers',
    securitySchemes: 'securitySchemes'
  };
  
  const key = componentMap[type];
  if (key && components[key] && components[key][name]) {
    return components[key][name];
  }
  
  return null;
}

export function parseSamples(filePath) {
  const content = readFile(filePath);
  let samples;
  
  try {
    samples = JSON.parse(content);
  } catch (err) {
    throw new InvalidFormatError(`JSON 解析错误: ${err.message}`, filePath);
  }
  
  if (!Array.isArray(samples)) {
    return [samples];
  }
  
  return samples;
}
