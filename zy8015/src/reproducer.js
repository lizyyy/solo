const fs = require('fs');
const path = require('path');

class Reproducer {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './reproduction',
      includeSchema: options.includeSchema !== false,
      includeConfig: options.includeConfig !== false,
      ...options
    };
  }

  generate(data, targetCallId = null) {
    const { trace, timeline, schema, plan } = data;

    const minimal = {
      version: '1.0.0',
      type: 'minimal_reproduction',
      generatedAt: new Date().toISOString(),
      targetCallId: targetCallId,
      metadata: {
        originalTrace: trace?.filePath,
        originalSchema: schema?.filePath
      },
      targetCall: null,
      prerequisites: [],
      context: {
        schema: null,
        config: this.options.includeConfig ? this.generateConfig() : null
      }
    };

    if (targetCallId) {
      const targetCall = this.findCallById(trace, targetCallId);
      if (!targetCall) {
        throw new Error(`未找到目标调用: ${targetCallId}`);
      }

      minimal.targetCall = this.simplifyCall(targetCall);

      const prerequisites = this.findPrerequisites(trace, targetCall, timeline);
      minimal.prerequisites = prerequisites.map(p => this.simplifyCall(p));
    } else {
      const failedCalls = trace?.entries?.filter(e => !e.success) || [];
      if (failedCalls.length > 0) {
        minimal.targetCall = this.simplifyCall(failedCalls[0]);
        minimal.targetCallId = failedCalls[0].tool_call_id;
      }
    }

    if (this.options.includeSchema && schema) {
      minimal.context.schema = this.extractRelevantSchema(schema, minimal);
    }

    return minimal;
  }

  findCallById(trace, toolCallId) {
    if (!trace || !trace.entries) return null;
    return trace.entries.find(e => e.tool_call_id === toolCallId || e.id === toolCallId);
  }

  findPrerequisites(trace, targetCall, timeline) {
    const prerequisites = [];
    
    if (!trace || !trace.entries) return prerequisites;

    const targetIndex = trace.entries.findIndex(e => 
      e.tool_call_id === targetCall.tool_call_id || e.id === targetCall.id
    );

    if (targetIndex === -1) return prerequisites;

    const previousCalls = trace.entries.slice(0, targetIndex);

    for (const call of previousCalls) {
      if (this.isLikelyPrerequisite(call, targetCall, timeline)) {
        prerequisites.push(call);
      }
    }

    return prerequisites;
  }

  isLikelyPrerequisite(call, targetCall, timeline) {
    if (!call.tool_name || !targetCall.tool_name) return false;

    const dependencyKeywords = [
      'create', 'get', 'read', 'list', 'search', 'find', 'lookup',
      '创建', '获取', '读取', '列表', '搜索', '查找'
    ];

    const callName = call.tool_name.toLowerCase();
    const targetName = targetCall.tool_name.toLowerCase();

    if (dependencyKeywords.some(kw => callName.includes(kw))) {
      if (targetName.includes('update') || targetName.includes('delete') ||
          targetName.includes('修改') || targetName.includes('删除')) {
        return true;
      }
    }

    const callParams = Object.values(call.parameters || {});
    const targetParams = Object.values(targetCall.parameters || {});

    for (const cp of callParams) {
      for (const tp of targetParams) {
        if (this.valuesMatch(cp, tp)) {
          return true;
        }
      }
    }

    if (call.result) {
      const resultValues = this.extractValues(call.result);
      for (const rv of resultValues) {
        for (const tp of targetParams) {
          if (this.valuesMatch(rv, tp)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  valuesMatch(val1, val2) {
    if (val1 === undefined || val1 === null) return false;
    if (val2 === undefined || val2 === null) return false;

    if (val1 === val2) return true;

    if (typeof val1 === 'string' && typeof val2 === 'string') {
      return val1.includes(val2) || val2.includes(val1);
    }

    if (typeof val1 === 'object' && typeof val2 === 'object') {
      const str1 = JSON.stringify(val1);
      const str2 = JSON.stringify(val2);
      return str1 === str2;
    }

    return false;
  }

  extractValues(obj) {
    const values = [];
    
    if (!obj || typeof obj !== 'object') {
      return values;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        values.push(item);
        values.push(...this.extractValues(item));
      }
    } else {
      for (const value of Object.values(obj)) {
        values.push(value);
        values.push(...this.extractValues(value));
      }
    }

    return values;
  }

  simplifyCall(call) {
    return {
      id: call.id,
      tool_call_id: call.tool_call_id,
      tool_name: call.tool_name,
      parameters: call.parameters,
      result: call.result,
      error: call.error,
      success: call.success,
      timestamp: call.timestamp?.toISOString ? call.timestamp.toISOString() : call.timestamp,
      duration_ms: call.duration_ms
    };
  }

  extractRelevantSchema(schema, minimal) {
    if (!schema || !schema.tools) return null;

    const relevantTools = new Set();

    if (minimal.targetCall?.tool_name) {
      relevantTools.add(minimal.targetCall.tool_name);
    }

    if (minimal.prerequisites) {
      for (const pre of minimal.prerequisites) {
        if (pre.tool_name) {
          relevantTools.add(pre.tool_name);
        }
      }
    }

    const relevantSchema = {
      version: schema.version,
      tools: {}
    };

    for (const toolName of relevantTools) {
      if (schema.tools[toolName]) {
        relevantSchema.tools[toolName] = schema.tools[toolName];
      }
    }

    return relevantSchema;
  }

  generateConfig() {
    return {
      replay: {
        includeRetries: true,
        skipNonIdempotent: false,
        dryRun: true
      },
      validation: {
        strict: true,
        checkSchemaDrift: true
      },
      output: {
        format: 'json',
        includeRawData: true
      }
    };
  }

  savePackage(reproduction, outputPath = null) {
    const outputDir = outputPath || this.options.outputDir;
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const manifestPath = path.join(outputDir, 'MANIFEST.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: reproduction.version,
      type: reproduction.type,
      generatedAt: reproduction.generatedAt,
      targetCallId: reproduction.targetCallId,
      metadata: reproduction.metadata,
      files: {
        reproduction: 'reproduction.json',
        trace: 'trace.jsonl',
        schema: reproduction.context.schema ? 'schema.json' : null,
        config: reproduction.context.config ? 'config.json' : null
      }
    }, null, 2));

    const reproPath = path.join(outputDir, 'reproduction.json');
    fs.writeFileSync(reproPath, JSON.stringify(reproduction, null, 2));

    if (reproduction.targetCall) {
      const traceContent = this.generateMinimalTrace(reproduction);
      const tracePath = path.join(outputDir, 'trace.jsonl');
      fs.writeFileSync(tracePath, traceContent);
    }

    if (reproduction.context.schema) {
      const schemaPath = path.join(outputDir, 'schema.json');
      fs.writeFileSync(schemaPath, JSON.stringify(reproduction.context.schema, null, 2));
    }

    if (reproduction.context.config) {
      const configPath = path.join(outputDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(reproduction.context.config, null, 2));
    }

    const readmePath = path.join(outputDir, 'README.md');
    fs.writeFileSync(readmePath, this.generateReadme(reproduction));

    return outputDir;
  }

  generateMinimalTrace(reproduction) {
    const lines = [];

    for (const pre of reproduction.prerequisites || []) {
      lines.push(JSON.stringify(this.toTraceEntry(pre)));
    }

    if (reproduction.targetCall) {
      lines.push(JSON.stringify(this.toTraceEntry(reproduction.targetCall)));
    }

    return lines.join('\n') + '\n';
  }

  toTraceEntry(simplifiedCall) {
    return {
      id: simplifiedCall.id,
      tool_call_id: simplifiedCall.tool_call_id,
      type: 'tool_call',
      timestamp: simplifiedCall.timestamp,
      tool_name: simplifiedCall.tool_name,
      parameters: simplifiedCall.parameters,
      result: simplifiedCall.result,
      error: simplifiedCall.error,
      success: simplifiedCall.success,
      duration_ms: simplifiedCall.duration_ms
    };
  }

  generateReadme(reproduction) {
    let readme = `# MCP 最小复现包

> 生成时间: ${reproduction.generatedAt}

## 概述

这是一个 MCP 工具调用的最小复现包，用于重现特定的工具调用问题。

## 目标调用

`;

    if (reproduction.targetCall) {
      readme += `
- **工具**: \`${reproduction.targetCall.tool_name}\`
- **tool_call_id**: \`${reproduction.targetCall.tool_call_id || 'N/A'}\`
- **预期结果**: ${reproduction.targetCall.success ? '✅ 成功' : '❌ 失败'}

\`\`\`json
${JSON.stringify(reproduction.targetCall.parameters, null, 2)}
\`\`\`

`;
    }

    if (reproduction.prerequisites && reproduction.prerequisites.length > 0) {
      readme += `## 前置依赖

以下调用可能是目标调用的前置依赖：

| 序号 | 工具 | tool_call_id | 状态 |
|------|------|--------------|------|
`;

      for (let i = 0; i < reproduction.prerequisites.length; i++) {
        const pre = reproduction.prerequisites[i];
        const status = pre.success ? '✅ 成功' : '❌ 失败';
        readme += `| ${i + 1} | ${pre.tool_name} | ${pre.tool_call_id || 'N/A'} | ${status} |\n`;
      }

      readme += '\n';
    }

    readme += `## 文件结构

\`\`\`
${this.options.outputDir || './reproduction'}/
├── MANIFEST.json      # 清单文件
├── reproduction.json  # 完整复现数据
├── trace.jsonl        # 最小化轨迹
├── schema.json        # 相关 Schema（如果有）
├── config.json        # 回放配置
└── README.md          # 本文件
\`\`\`

## 复现步骤

1. 使用 mcp-replay CLI 加载此复现包：

\`\`\`bash
mcp-replay analyze --schema schema.json --trace trace.jsonl --config config.json
\`\`\`

2. 执行 dry-run 验证：

\`\`\`bash
mcp-replay plan --schema schema.json --trace trace.jsonl --output plan.json
\`\`\`

3. 检查生成的报告：

\`\`\`bash
mcp-replay report --schema schema.json --trace trace.jsonl --output report.md
\`\`\`

## 注意事项

- 确保目标 MCP 服务正在运行
- 检查 Schema 是否与目标服务兼容
- 对于非幂等操作，注意数据一致性风险
`;

    return readme;
  }
}

module.exports = Reproducer;
