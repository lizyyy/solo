const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class SchemaParser {
  constructor(options = {}) {
    this.options = {
      strict: options.strict !== false,
      ...options
    };
  }

  parse(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let content;
    
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`无法读取 Schema 文件: ${filePath}, 错误: ${error.message}`);
    }

    let schema;
    if (ext === '.yaml' || ext === '.yml') {
      schema = this.parseYAML(content, filePath);
    } else if (ext === '.json') {
      schema = this.parseJSON(content, filePath);
    } else {
      schema = this.tryParseUnknownFormat(content, filePath);
    }

    return this.normalizeSchema(schema, filePath);
  }

  parseYAML(content, filePath) {
    try {
      return yaml.parse(content);
    } catch (error) {
      throw new Error(`YAML 解析错误 (${filePath}): ${error.message}`);
    }
  }

  parseJSON(content, filePath) {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`JSON 解析错误 (${filePath}): ${error.message}`);
    }
  }

  tryParseUnknownFormat(content, filePath) {
    try {
      return JSON.parse(content);
    } catch (jsonError) {
      try {
        return yaml.parse(content);
      } catch (yamlError) {
        throw new Error(`无法解析 Schema 文件格式 (${filePath})。尝试了 JSON 和 YAML 都失败了。`);
      }
    }
  }

  normalizeSchema(schema, filePath) {
    const normalized = {
      filePath,
      tools: {},
      raw: schema,
      version: schema.version || '1.0.0'
    };

    if (!schema.tools && !schema.definitions && !schema.endpoints) {
      throw new Error(`Schema 格式无效 (${filePath})。缺少 tools/definitions/endpoints 字段。`);
    }

    const toolsList = schema.tools || schema.definitions || schema.endpoints || [];
    
    for (const tool of toolsList) {
      const normalizedTool = this.normalizeTool(tool);
      if (normalized.tools[normalizedTool.name]) {
        if (this.options.strict) {
          throw new Error(`Schema 中存在重复的工具名称: ${normalizedTool.name} (${filePath})`);
        }
        console.warn(`警告: Schema 中存在重复的工具名称: ${normalizedTool.name}，将使用第一个定义。`);
      } else {
        normalized.tools[normalizedTool.name] = normalizedTool;
      }
    }

    return normalized;
  }

  normalizeTool(tool) {
    return {
      name: tool.name || tool.tool || tool.id,
      description: tool.description || '',
      parameters: this.normalizeParameters(tool.parameters || tool.input || tool.args),
      returns: this.normalizeReturns(tool.returns || tool.output || tool.result),
      deprecated: tool.deprecated === true,
      idempotent: tool.idempotent === true,
      categories: tool.categories || []
    };
  }

  normalizeParameters(params) {
    if (!params) {
      return { type: 'object', properties: {}, required: [] };
    }

    if (params.type && params.type === 'object') {
      return {
        type: 'object',
        properties: params.properties || {},
        required: params.required || []
      };
    }

    const properties = {};
    const required = [];

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'object' && value !== null) {
        properties[key] = {
          type: value.type || 'string',
          description: value.description || '',
          enum: value.enum,
          default: value.default,
          format: value.format
        };
        if (value.required) {
          required.push(key);
        }
      } else {
        properties[key] = { type: typeof value };
      }
    }

    return { type: 'object', properties, required };
  }

  normalizeReturns(returns) {
    if (!returns) {
      return { type: 'object' };
    }

    if (returns.type) {
      return returns;
    }

    return {
      type: 'object',
      properties: returns
    };
  }

  validateToolCall(toolName, parameters, schema) {
    const issues = [];
    const tool = schema.tools[toolName];

    if (!tool) {
      return {
        valid: false,
        issues: [{
          type: 'tool_not_found',
          message: `工具 "${toolName}" 在当前 Schema 中不存在`,
          severity: 'error'
        }]
      };
    }

    if (tool.deprecated) {
      issues.push({
        type: 'deprecated',
        message: `工具 "${toolName}" 已被标记为废弃`,
        severity: 'warning'
      });
    }

    const paramIssues = this.validateParameters(
      parameters,
      tool.parameters,
      toolName
    );
    issues.push(...paramIssues);

    return {
      valid: issues.every(i => i.severity !== 'error'),
      issues,
      tool
    };
  }

  validateParameters(params, schemaParams, toolName) {
    const issues = [];
    const schema = schemaParams || { type: 'object', properties: {}, required: [] };

    if (schema.type === 'object' && schema.properties) {
      for (const required of schema.required || []) {
        if (params[required] === undefined) {
          issues.push({
            type: 'missing_required_parameter',
            parameter: required,
            tool: toolName,
            message: `缺少必需参数 "${required}"`,
            severity: 'error'
          });
        }
      }

      for (const [key, value] of Object.entries(params || {})) {
        const paramSchema = schema.properties[key];
        
        if (!paramSchema) {
          issues.push({
            type: 'unknown_parameter',
            parameter: key,
            tool: toolName,
            message: `未知参数 "${key}"`,
            severity: 'warning'
          });
        } else {
          const typeIssues = this.validateParameterType(key, value, paramSchema, toolName);
          issues.push(...typeIssues);
        }
      }
    }

    return issues;
  }

  validateParameterType(name, value, schema, toolName) {
    const issues = [];
    const expectedType = schema.type;
    const actualType = this.inferType(value);

    if (expectedType && actualType !== expectedType) {
      if (schema.enum && !schema.enum.includes(value)) {
        issues.push({
          type: 'invalid_enum',
          parameter: name,
          tool: toolName,
          expected: schema.enum,
          actual: value,
          message: `参数 "${name}" 的值 "${value}" 不在枚举允许范围内: ${JSON.stringify(schema.enum)}`,
          severity: 'error'
        });
      } else if (this.isTypeCompatible(value, expectedType)) {
      } else {
        issues.push({
          type: 'type_mismatch',
          parameter: name,
          tool: toolName,
          expected: expectedType,
          actual: actualType,
          message: `参数 "${name}" 类型不匹配: 期望 ${expectedType}，实际 ${actualType}`,
          severity: 'error'
        });
      }
    }

    return issues;
  }

  inferType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  isTypeCompatible(value, expectedType) {
    const actualType = this.inferType(value);
    
    if (actualType === expectedType) return true;
    
    if (expectedType === 'integer' && actualType === 'number' && Number.isInteger(value)) {
      return true;
    }
    
    if (expectedType === 'number' && actualType === 'string') {
      return !isNaN(Number(value));
    }
    
    if (expectedType === 'string') {
      return true;
    }
    
    return false;
  }

  detectSchemaDrift(oldSchema, newSchema) {
    const drift = {
      added: [],
      removed: [],
      modified: [],
      renamed: [],
      hasBreakingChanges: false,
      hasNonBreakingChanges: false
    };

    const oldTools = Object.keys(oldSchema.tools);
    const newTools = Object.keys(newSchema.tools);

    for (const toolName of oldTools) {
      if (!newTools.includes(toolName)) {
        drift.removed.push({
          type: 'tool_removed',
          tool: toolName,
          message: `工具 "${toolName}" 已从 Schema 中移除`,
          severity: 'breaking'
        });
        drift.hasBreakingChanges = true;
      }
    }

    for (const toolName of newTools) {
      if (!oldTools.includes(toolName)) {
        drift.added.push({
          type: 'tool_added',
          tool: toolName,
          message: `新增工具 "${toolName}"`,
          severity: 'non_breaking'
        });
        drift.hasNonBreakingChanges = true;
      }
    }

    for (const toolName of oldTools.filter(t => newTools.includes(t))) {
      const oldTool = oldSchema.tools[toolName];
      const newTool = newSchema.tools[toolName];
      const toolDrift = this.compareToolSchemas(oldTool, newTool, toolName);
      
      drift.modified.push(...toolDrift);
      
      if (toolDrift.some(d => d.severity === 'breaking')) {
        drift.hasBreakingChanges = true;
      }
      if (toolDrift.some(d => d.severity === 'non_breaking')) {
        drift.hasNonBreakingChanges = true;
      }
    }

    return drift;
  }

  compareToolSchemas(oldTool, newTool, toolName) {
    const drift = [];

    if (oldTool.description !== newTool.description) {
      drift.push({
        type: 'description_changed',
        tool: toolName,
        message: `工具 "${toolName}" 描述已变更`,
        severity: 'non_breaking'
      });
    }

    if (oldTool.deprecated !== newTool.deprecated) {
      drift.push({
        type: 'deprecated_changed',
        tool: toolName,
        old: oldTool.deprecated,
        new: newTool.deprecated,
        message: newTool.deprecated 
          ? `工具 "${toolName}" 被标记为废弃` 
          : `工具 "${toolName}" 取消废弃标记`,
        severity: newTool.deprecated ? 'breaking' : 'non_breaking'
      });
    }

    if (oldTool.idempotent !== newTool.idempotent) {
      drift.push({
        type: 'idempotent_changed',
        tool: toolName,
        old: oldTool.idempotent,
        new: newTool.idempotent,
        message: `工具 "${toolName}" 幂等性标记已变更`,
        severity: 'non_breaking'
      });
    }

    const paramDrift = this.compareParameters(
      oldTool.parameters,
      newTool.parameters,
      toolName
    );
    drift.push(...paramDrift);

    return drift;
  }

  compareParameters(oldParams, newParams, toolName) {
    const drift = [];
    const oldProps = oldParams?.properties || {};
    const newProps = newParams?.properties || {};
    const oldRequired = new Set(oldParams?.required || []);
    const newRequired = new Set(newParams?.required || []);

    const oldKeys = Object.keys(oldProps);
    const newKeys = Object.keys(newProps);

    for (const key of oldKeys) {
      if (!newKeys.includes(key)) {
        const wasRequired = oldRequired.has(key);
        drift.push({
          type: 'parameter_removed',
          tool: toolName,
          parameter: key,
          wasRequired,
          message: `参数 "${key}" 已从工具 "${toolName}" 中移除`,
          severity: wasRequired ? 'breaking' : 'non_breaking'
        });
      }
    }

    for (const key of newKeys) {
      if (!oldKeys.includes(key)) {
        const isRequired = newRequired.has(key);
        drift.push({
          type: 'parameter_added',
          tool: toolName,
          parameter: key,
          isRequired,
          message: `工具 "${toolName}" 新增参数 "${key}"`,
          severity: isRequired ? 'breaking' : 'non_breaking'
        });
      }
    }

    for (const key of oldKeys.filter(k => newKeys.includes(k))) {
      const oldProp = oldProps[key];
      const newProp = newProps[key];
      
      if (oldProp.type !== newProp.type) {
        drift.push({
          type: 'parameter_type_changed',
          tool: toolName,
          parameter: key,
          oldType: oldProp.type,
          newType: newProp.type,
          message: `参数 "${key}" 类型从 "${oldProp.type}" 变为 "${newProp.type}"`,
          severity: 'breaking'
        });
      }

      if (oldRequired.has(key) && !newRequired.has(key)) {
        drift.push({
          type: 'parameter_optional',
          tool: toolName,
          parameter: key,
          message: `参数 "${key}" 从必需变为可选`,
          severity: 'non_breaking'
        });
      }

      if (!oldRequired.has(key) && newRequired.has(key)) {
        drift.push({
          type: 'parameter_required',
          tool: toolName,
          parameter: key,
          message: `参数 "${key}" 从可选变为必需`,
          severity: 'breaking'
        });
      }

      if (JSON.stringify(oldProp.enum) !== JSON.stringify(newProp.enum)) {
        const removed = (oldProp.enum || []).filter(e => !(newProp.enum || []).includes(e));
        if (removed.length > 0) {
          drift.push({
            type: 'enum_values_removed',
            tool: toolName,
            parameter: key,
            values: removed,
            message: `参数 "${key}" 枚举值移除: ${removed.join(', ')}`,
            severity: 'breaking'
          });
        }
      }
    }

    return drift;
  }
}

module.exports = SchemaParser;
