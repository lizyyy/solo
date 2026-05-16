const fs = require('fs');
const path = require('path');

const srcDir = '/Users/lzy/pro/solo/workspaces/zy70553/src';

const protoParserContent = `const fs = require('fs');
const path = require('path');

class ProtoParser {
  constructor() {
    this.result = {
      file: '',
      packages: [],
      enums: [],
      errorCodes: [],
      parseErrors: []
    };
  }

  parse(filePath) {
    this.resetResult();
    this.result.file = path.basename(filePath);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.parseContent(content);
      this.extractErrorCodes();
    } catch (error) {
      this.result.parseErrors.push({ message: error.message });
    }
    return this.result;
  }

  resetResult() {
    this.result = {
      file: '',
      packages: [],
      enums: [],
      errorCodes: [],
      parseErrors: []
    };
  }

  parseContent(content) {
    const lines = content.split('\\n');
    let currentPackage = '';
    let currentEnum = null;
    let braceDepth = 0;
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const rawLine = lines[lineNum];
      const line = rawLine.replace(/\\/\\/.*\$/, '');
      const trimmed = line.trim();
      if (trimmed === '') continue;
      const pkgMatch = trimmed.match(/^package\\s+([a-zA-Z0-9_.]+)\\s*;/);
      if (pkgMatch) {
        currentPackage = pkgMatch[1];
        this.result.packages.push(currentPackage);
        continue;
      }
      const enumMatch = trimmed.match(/^enum\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\{?/);
      if (enumMatch) {
        currentEnum = { name: enumMatch[1], package: currentPackage, values: [] };
        braceDepth = 1;
        continue;
      }
      if (currentEnum && braceDepth > 0) {
        if (trimmed.includes('{')) braceDepth++;
        if (trimmed.includes('}')) {
          braceDepth--;
          if (braceDepth === 0) {
            this.result.enums.push(currentEnum);
            currentEnum = null;
            continue;
          }
        }
        const valMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*(-?[0-9]+)\\s*;/);
        if (valMatch) {
          currentEnum.values.push({
            name: valMatch[1],
            value: parseInt(valMatch[2], 10),
            line: lineNum + 1
          });
        }
        continue;
      }
    }
  }

  extractErrorCodes() {
    for (const e of this.result.enums) {
      for (const v of e.values) {
        this.result.errorCodes.push({
          code: v.value,
          name: v.name,
          enumName: e.name,
          package: e.package
        });
      }
    }
  }

  parseString(content) {
    this.resetResult();
    this.result.file = 'inline';
    this.parseContent(content);
    this.extractErrorCodes();
    return this.result;
  }
}

module.exports = ProtoParser;
`;

const matrixBuilderContent = `class MatrixBuilder {
  constructor() {
    this.matrix = {
      errorCodes: [],
      sdks: [],
      comparisons: [],
      retryStrategies: {}
    };
  }

  build(protoData, sdkDefinitions) {
    this.matrix = {
      errorCodes: [],
      sdks: [],
      comparisons: [],
      retryStrategies: {}
    };

    this.matrix.errorCodes = protoData.errorCodes || [];
    this.matrix.sdks = this.extractSDKs(sdkDefinitions);
    this.matrix.comparisons = this.compareErrorCodes(protoData.errorCodes, sdkDefinitions);
    this.matrix.retryStrategies = this.classifyRetryStrategies(protoData.errorCodes, sdkDefinitions);

    return this.matrix;
  }

  extractSDKs(sdkDefinitions) {
    if (!sdkDefinitions || !sdkDefinitions.sdks) {
      return [];
    }
    return sdkDefinitions.sdks.map(sdk => ({
      name: sdk.name,
      language: sdk.language,
      version: sdk.version
    }));
  }

  compareErrorCodes(errorCodes, sdkDefinitions) {
    const comparisons = [];
    if (!sdkDefinitions || !sdkDefinitions.sdks) {
      return comparisons;
    }

    for (const sdk of sdkDefinitions.sdks) {
      const sdkErrorCodes = sdk.errorCodes || [];
      for (const errorCode of errorCodes) {
        const sdkErrorCode = sdkErrorCodes.find(
          ec => ec.code === errorCode.code || ec.name === errorCode.name
        );
        comparisons.push({
          code: errorCode.code,
          name: errorCode.name,
          sdkName: sdk.name,
          exists: !!sdkErrorCode,
          sdkValue: sdkErrorCode ? sdkErrorCode.value || sdkErrorCode.code : null,
          mismatch: sdkErrorCode && sdkErrorCode.code !== errorCode.code
        });
      }
    }

    return comparisons;
  }

  classifyRetryStrategies(errorCodes, sdkDefinitions) {
    const strategies = {
      retry: [],
      noRetry: [],
      unknown: []
    };

    if (!sdkDefinitions || !sdkDefinitions.retryStrategies) {
      errorCodes.forEach(ec => strategies.unknown.push({
        code: ec.code,
        name: ec.name,
        reason: 'No retry strategy defined'
      }));
      return strategies;
    }

    for (const errorCode of errorCodes) {
      const strategy = sdkDefinitions.retryStrategies.find(
        rs => rs.code === errorCode.code || rs.name === errorCode.name
      );
      
      if (strategy) {
        if (strategy.retry) {
          strategies.retry.push({
            code: errorCode.code,
            name: errorCode.name,
            retryDelay: strategy.retryDelay || 'default'
          });
        } else {
          strategies.noRetry.push({
            code: errorCode.code,
            name: errorCode.name,
            reason: strategy.reason || 'Not retryable'
          });
        }
      } else {
        strategies.unknown.push({
          code: errorCode.code,
          name: errorCode.name,
          reason: 'No strategy found'
        });
      }
    }

    return strategies;
  }

  getMismatches() {
    return this.matrix.comparisons.filter(c => c.mismatch);
  }

  getMissingCodes(sdkName) {
    return this.matrix.comparisons.filter(
      c => c.sdkName === sdkName && !c.exists
    );
  }
}

module.exports = MatrixBuilder;
`;

const reportGeneratorContent = `const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor() {
    this.options = {
      colors: true
    };
  }

  generateTerminalReport(matrix) {
    let output = '';

    output += '\\n========================================\\n';
    output += '        gRPC 错误码矩阵报告\\n';
    output += '========================================\\n\\n';

    output += '错误码统计:\\n';
    output += '  总错误码数量: ' + matrix.errorCodes.length + '\\n';
    output += '  SDK 数量: ' + matrix.sdks.length + '\\n\\n';

    output += '重试策略分类:\\n';
    output += '  可重试: ' + matrix.retryStrategies.retry.length + ' 个\\n';
    output += '  不可重试: ' + matrix.retryStrategies.noRetry.length + ' 个\\n';
    output += '  未知: ' + matrix.retryStrategies.unknown.length + ' 个\\n\\n';

    if (matrix.sdks.length > 0) {
      output += 'SDK 差异分析:\\n';
      for (const sdk of matrix.sdks) {
        const missing = matrix.comparisons.filter(
          c => c.sdkName === sdk.name && !c.exists
        );
        const mismatches = matrix.comparisons.filter(
          c => c.sdkName === sdk.name && c.mismatch
        );
        output += '  ' + sdk.name + ' (' + sdk.language + '):\\n';
        output += '    缺失错误码: ' + missing.length + ' 个\\n';
        output += '    数值不匹配: ' + mismatches.length + ' 个\\n';
      }
    }

    output += '\\n========================================\\n';
    return output;
  }

  generateJSONReport(matrix, outputPath) {
    const jsonData = JSON.stringify(matrix, null, 2);
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, jsonData);
    }
    return jsonData;
  }

  generateMarkdownReport(matrix, outputPath) {
    let md = '# gRPC 错误码矩阵报告\\n\\n';

    md += '## 统计信息\\n\\n';
    md += '- 总错误码数量: ' + matrix.errorCodes.length + '\\n';
    md += '- SDK 数量: ' + matrix.sdks.length + '\\n\\n';

    md += '## 重试策略分类\\n\\n';
    md += '### 可重试 (' + matrix.retryStrategies.retry.length + ')\\n\\n';
    md += '| 错误码 | 名称 | 重试延迟 |\\n';
    md += '|--------|------|----------|\\n';
    for (const item of matrix.retryStrategies.retry) {
      md += '| ' + item.code + ' | ' + item.name + ' | ' + item.retryDelay + ' |\\n';
    }
    md += '\\n';

    md += '### 不可重试 (' + matrix.retryStrategies.noRetry.length + ')\\n\\n';
    md += '| 错误码 | 名称 | 原因 |\\n';
    md += '|--------|------|------|\\n';
    for (const item of matrix.retryStrategies.noRetry) {
      md += '| ' + item.code + ' | ' + item.name + ' | ' + item.reason + ' |\\n';
    }
    md += '\\n';

    if (matrix.sdks.length > 0) {
      md += '## SDK 对比\\n\\n';
      for (const sdk of matrix.sdks) {
        md += '### ' + sdk.name + ' (' + sdk.language + ')\\n\\n';
        const missing = matrix.comparisons.filter(
          c => c.sdkName === sdk.name && !c.exists
        );
        if (missing.length > 0) {
          md += '**缺失的错误码:**\\n\\n';
          for (const m of missing) {
            md += '- ' + m.code + ': ' + m.name + '\\n';
          }
          md += '\\n';
        } else {
          md += '无缺失错误码\\n\\n';
        }
      }
    }

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, md);
    }
    return md;
  }

  generateAllReports(matrix, outputDir) {
    const reports = {
      terminal: this.generateTerminalReport(matrix),
      json: this.generateJSONReport(matrix, outputDir ? path.join(outputDir, 'error-matrix.json') : null),
      markdown: this.generateMarkdownReport(matrix, outputDir ? path.join(outputDir, 'error-matrix.md') : null)
    };
    return reports;
  }
}

module.exports = ReportGenerator;
`;

const cliContent = `#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const ProtoParser = require('./proto-parser');
const MatrixBuilder = require('./matrix-builder');
const ReportGenerator = require('./report-generator');

const program = new Command();

program
  .name('grpc-error-matrix')
  .description('gRPC 错误码矩阵工具')
  .version('1.0.0');

program
  .command('self-test')
  .description('运行自检')
  .action(() => {
    console.log('运行自检...');
    
    const parser = new ProtoParser();
    const builder = new MatrixBuilder();
    const generator = new ReportGenerator();
    
    console.log('✓ 所有模块加载成功');
    
    const testProto = \`
package test.v1;
enum ErrorCode {
  OK = 0;
  CANCELLED = 1;
  UNKNOWN = 2;
  INVALID_ARGUMENT = 3;
}
\`;
    
    const protoResult = parser.parseString(testProto);
    if (protoResult.errorCodes.length === 4) {
      console.log('✓ ProtoParser 测试通过');
    } else {
      console.log('✗ ProtoParser 测试失败');
      process.exit(1);
    }
    
    const sdkDefinitions = {
      sdks: [
        { name: 'Go SDK', language: 'go', version: '1.0.0', errorCodes: [] },
        { name: 'Java SDK', language: 'java', version: '1.0.0', errorCodes: [] }
      ],
      retryStrategies: [
        { code: 0, name: 'OK', retry: false },
        { code: 1, name: 'CANCELLED', retry: true },
        { code: 2, name: 'UNKNOWN', retry: true },
        { code: 3, name: 'INVALID_ARGUMENT', retry: false }
      ]
    };
    
    const matrix = builder.build(protoResult, sdkDefinitions);
    if (matrix.errorCodes.length === 4 && matrix.sdks.length === 2) {
      console.log('✓ MatrixBuilder 测试通过');
    } else {
      console.log('✗ MatrixBuilder 测试失败');
      process.exit(1);
    }
    
    const terminalReport = generator.generateTerminalReport(matrix);
    if (terminalReport.length > 0) {
      console.log('✓ ReportGenerator 测试通过');
    } else {
      console.log('✗ ReportGenerator 测试失败');
      process.exit(1);
    }
    
    console.log('');
    console.log('✓ 所有自检通过!');
  });

program
  .command('analyze')
  .description('分析 proto 文件并生成报告')
  .option('--proto <path>', 'proto 文件路径')
  .option('--sdk <path>', 'SDK 定义 JSON 文件路径')
  .option('--output <dir>', '输出目录')
  .action((options) => {
    console.log('开始分析...');
    
    const parser = new ProtoParser();
    const builder = new MatrixBuilder();
    const generator = new ReportGenerator();
    
    let protoResult;
    if (options.proto && fs.existsSync(options.proto)) {
      protoResult = parser.parse(options.proto);
      console.log('✓ 解析 proto 文件: ' + options.proto);
    } else {
      console.log('使用测试 proto 数据');
      const testProto = \`
package test.v1;
enum ErrorCode {
  OK = 0;
  CANCELLED = 1;
  UNKNOWN = 2;
  INVALID_ARGUMENT = 3;
  DEADLINE_EXCEEDED = 4;
  NOT_FOUND = 5;
  ALREADY_EXISTS = 6;
  PERMISSION_DENIED = 7;
  UNAUTHENTICATED = 16;
  RESOURCE_EXHAUSTED = 8;
  FAILED_PRECONDITION = 9;
  ABORTED = 10;
  OUT_OF_RANGE = 11;
  UNIMPLEMENTED = 12;
  INTERNAL = 13;
  UNAVAILABLE = 14;
  DATA_LOSS = 15;
}
\`;
      protoResult = parser.parseString(testProto);
    }
    
    let sdkDefinitions = {
      sdks: [
        { name: 'Go SDK', language: 'go', version: '1.0.0', errorCodes: protoResult.errorCodes },
        { name: 'Java SDK', language: 'java', version: '1.0.0', errorCodes: protoResult.errorCodes.slice(0, 10) },
        { name: 'Python SDK', language: 'python', version: '1.0.0', errorCodes: protoResult.errorCodes }
      ],
      retryStrategies: [
        { code: 0, name: 'OK', retry: false, reason: 'Success' },
        { code: 1, name: 'CANCELLED', retry: true, retryDelay: '100ms' },
        { code: 2, name: 'UNKNOWN', retry: true, retryDelay: '500ms' },
        { code: 3, name: 'INVALID_ARGUMENT', retry: false, reason: 'Client error' },
        { code: 4, name: 'DEADLINE_EXCEEDED', retry: true, retryDelay: '1s' },
        { code: 5, name: 'NOT_FOUND', retry: false, reason: 'Resource not found' },
        { code: 6, name: 'ALREADY_EXISTS', retry: false, reason: 'Conflict' },
        { code: 7, name: 'PERMISSION_DENIED', retry: false, reason: 'Auth error' },
        { code: 8, name: 'RESOURCE_EXHAUSTED', retry: true, retryDelay: '2s' },
        { code: 9, name: 'FAILED_PRECONDITION', retry: false },
        { code: 10, name: 'ABORTED', retry: true, retryDelay: '500ms' },
        { code: 11, name: 'OUT_OF_RANGE', retry: false },
        { code: 12, name: 'UNIMPLEMENTED', retry: false, reason: 'Not supported' },
        { code: 13, name: 'INTERNAL', retry: true, retryDelay: '1s' },
        { code: 14, name: 'UNAVAILABLE', retry: true, retryDelay: '1s' },
        { code: 15, name: 'DATA_LOSS', retry: false },
        { code: 16, name: 'UNAUTHENTICATED', retry: false, reason: 'Auth required' }
      ]
    };
    
    if (options.sdk && fs.existsSync(options.sdk)) {
      try {
        sdkDefinitions = JSON.parse(fs.readFileSync(options.sdk, 'utf8'));
        console.log('✓ 加载 SDK 定义: ' + options.sdk);
      } catch (e) {
        console.log('✗ 加载 SDK 定义失败，使用默认数据');
      }
    }
    
    const matrix = builder.build(protoResult, sdkDefinitions);
    console.log('✓ 构建错误码矩阵');
    
    const outputDir = options.output || 'reports';
    const reports = generator.generateAllReports(matrix, outputDir);
    console.log('✓ 生成报告到: ' + outputDir);
    
    console.log('');
    console.log(reports.terminal);
    
    if (options.output) {
      console.log('报告已保存到: ' + path.resolve(outputDir));
    }
  });

program.parse(process.argv);
`;

fs.writeFileSync(path.join(srcDir, 'proto-parser.js'), protoParserContent);
console.log('✓ proto-parser.js created');

fs.writeFileSync(path.join(srcDir, 'matrix-builder.js'), matrixBuilderContent);
console.log('✓ matrix-builder.js created');

fs.writeFileSync(path.join(srcDir, 'report-generator.js'), reportGeneratorContent);
console.log('✓ report-generator.js created');

fs.writeFileSync(path.join(srcDir, 'cli.js'), cliContent);
console.log('✓ cli.js created');

console.log('\n所有文件创建成功!');
