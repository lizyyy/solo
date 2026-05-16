const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
}

const protoParserCode = `const fs = require('fs');
const path = require('path');

class ProtoParser {
  constructor() {
    this.supportedExtensions = ['.proto'];
  }

  parse(filePath) {
    const result = {
      file: path.basename(filePath),
      filePath: filePath,
      packages: [],
      enums: [],
      messages: [],
      errorCodes: [],
      parseErrors: []
    };

    try {
      if (!fs.existsSync(filePath)) {
        result.parseErrors.push({ message: 'File not found: ' + filePath });
        return result;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      return this.parseContent(content, result);
    } catch (err) {
      result.parseErrors.push({ message: err.message });
      return result;
    }
  }

  parseContent(content, result) {
    const lines = content.split('\\n');
    let currentPackage = '';
    let currentEnum = null;
    let braceDepth = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      let line = lines[lineNum];
      line = line.replace(/\\/\\/.*$/, '').trim();
      if (line === '') continue;

      const pkgMatch = line.match(/^package\\s+([a-zA-Z0-9_.]+)\\s*;/);
      if (pkgMatch) {
        currentPackage = pkgMatch[1];
        if (!result.packages.includes(currentPackage)) {
          result.packages.push(currentPackage);
        }
        continue;
      }

      const enumMatch = line.match(/^enum\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\{?/);
      if (enumMatch) {
        currentEnum = {
          name: enumMatch[1],
          package: currentPackage,
          fullName: currentPackage ? currentPackage + '.' + enumMatch[1] : enumMatch[1],
          values: []
        };
        braceDepth = line.includes('{') ? 1 : 0;
        continue;
      }

      if (currentEnum) {
        if (line.includes('{')) braceDepth++;
        if (line.includes('}')) {
          braceDepth--;
          if (braceDepth === 0) {
            result.enums.push(currentEnum);
            currentEnum = null;
            continue;
          }
        }

        const valMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*(-?[0-9]+)\\s*;/);
        if (valMatch) {
          currentEnum.values.push({
            name: valMatch[1],
            value: parseInt(valMatch[2], 10)
          });
        }
      }
    }

    this.extractErrorCodes(result);
    return result;
  }

  extractErrorCodes(result) {
    for (const e of result.enums) {
      const isErrorCodeEnum = this.isErrorCodeEnum(e.name);
      for (const v of e.values) {
        result.errorCodes.push({
          code: v.value,
          name: v.name,
          enumName: e.name,
          fullName: e.fullName,
          package: e.package,
          isErrorCodeEnum: isErrorCodeEnum
        });
      }
    }
  }

  isErrorCodeEnum(enumName) {
    const errorKeywords = ['error', 'code', 'status', 'result'];
    const lowerName = enumName.toLowerCase();
    return errorKeywords.some(keyword => lowerName.includes(keyword));
  }
}

module.exports = ProtoParser;
`;

const matrixBuilderCode = `class MatrixBuilder {
  constructor() {
    this.retryCategories = {
      TRANSIENT: {
        name: 'Transient Errors',
        description: '可重试的临时错误',
        retryable: true,
        codes: []
      },
      PERMANENT: {
        name: 'Permanent Errors',
        description: '不可重试的永久错误',
        retryable: false,
        codes: []
      },
      CLIENT_ERROR: {
        name: 'Client Errors',
        description: '客户端错误，需要检查参数',
        retryable: false,
        codes: []
      },
      SERVER_ERROR: {
        name: 'Server Errors',
        description: '服务端错误',
        retryable: true,
        codes: []
      }
    };
  }

  buildMatrix(protoErrorCodes, sdkDefinitions) {
    sdkDefinitions = sdkDefinitions || {};
    const matrix = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCodes: 0,
        withRetryStrategy: 0,
        withoutRetryStrategy: 0,
        categories: {}
      },
      errorCodes: [],
      categories: this.initializeCategories(),
      conflicts: []
    };

    const allCodes = this.mergeCodes(protoErrorCodes, sdkDefinitions);

    for (const codeData of allCodes) {
      const category = this.categorizeError(codeData);
      const matrixEntry = this.createMatrixEntry(codeData, category);
      matrix.errorCodes.push(matrixEntry);
      matrix.categories[category.key].codes.push(matrixEntry);
    }

    this.calculateSummary(matrix);
    return matrix;
  }

  initializeCategories() {
    const categories = {};
    for (const [key, value] of Object.entries(this.retryCategories)) {
      categories[key] = {
        ...value,
        key: key,
        codes: [],
        count: 0
      };
    }
    return categories;
  }

  mergeCodes(protoCodes, sdkDefinitions) {
    const codeMap = new Map();

    for (const pc of protoCodes) {
      const key = pc.code.toString();
      if (!codeMap.has(key)) {
        codeMap.set(key, {
          code: pc.code,
          name: pc.name,
          proto: {
            enumName: pc.enumName,
            fullName: pc.fullName,
            package: pc.package
          },
          sdks: {}
        });
      }
    }

    if (sdkDefinitions.sdks) {
      for (const [sdkName, sdkData] of Object.entries(sdkDefinitions.sdks)) {
        if (sdkData.errorCodes) {
          for (const [codeName, codeValue] of Object.entries(sdkData.errorCodes)) {
            const key = codeValue.toString();
            if (!codeMap.has(key)) {
              codeMap.set(key, {
                code: codeValue,
                name: codeName,
                proto: null,
                sdks: {}
              });
            }
            const entry = codeMap.get(key);
            entry.sdks[sdkName] = {
              name: codeName,
              value: codeValue
            };
          }
        }
      }
    }

    return Array.from(codeMap.values());
  }

  categorizeError(codeData) {
    const code = codeData.code;
    const name = codeData.name.toLowerCase();

    if (name.includes('not_found') || name.includes('notfound')) {
      return { key: 'PERMANENT', ...this.retryCategories.PERMANENT };
    }

    if (name.includes('invalid') || name.includes('bad_request')) {
      return { key: 'CLIENT_ERROR', ...this.retryCategories.CLIENT_ERROR };
    }

    if (name.includes('unavailable') || name.includes('timeout') || 
        name.includes('internal') || name.includes('deadline')) {
      return { key: 'TRANSIENT', ...this.retryCategories.TRANSIENT };
    }

    if (code >= 50000 && code < 60000) {
      return { key: 'SERVER_ERROR', ...this.retryCategories.SERVER_ERROR };
    }

    if (code >= 40000 && code < 50000) {
      return { key: 'CLIENT_ERROR', ...this.retryCategories.CLIENT_ERROR };
    }

    return { key: 'PERMANENT', ...this.retryCategories.PERMANENT };
  }

  createMatrixEntry(codeData, category) {
    return {
      code: codeData.code,
      name: codeData.name,
      category: category.key,
      retryable: category.retryable,
      retryStrategy: this.getRetryStrategy(category.key, codeData),
      proto: codeData.proto,
      sdks: codeData.sdks,
      sdkConsistency: this.checkSdkConsistency(codeData)
    };
  }

  getRetryStrategy(category, codeData) {
    const strategies = {
      TRANSIENT: {
        maxRetries: 3,
        backoff: 'exponential',
        initialDelay: 100,
        maxDelay: 5000
      },
      SERVER_ERROR: {
        maxRetries: 2,
        backoff: 'linear',
        initialDelay: 500,
        maxDelay: 2000
      },
      CLIENT_ERROR: {
        maxRetries: 0,
        backoff: 'none'
      },
      PERMANENT: {
        maxRetries: 0,
        backoff: 'none'
      }
    };
    return strategies[category] || strategies.PERMANENT;
  }

  checkSdkConsistency(codeData) {
    const sdkNames = Object.keys(codeData.sdks);
    if (sdkNames.length <= 1) return { consistent: true, issues: [] };

    const issues = [];
    const referenceName = codeData.sdks[sdkNames[0]].name;

    for (let i = 1; i < sdkNames.length; i++) {
      const currentName = codeData.sdks[sdkNames[i]].name;
      if (currentName !== referenceName) {
        issues.push({
          sdk1: sdkNames[0],
          sdk2: sdkNames[i],
          name1: referenceName,
          name2: currentName,
          message: 'Naming mismatch: ' + sdkNames[0] + ' uses "' + referenceName + '", ' + sdkNames[i] + ' uses "' + currentName + '"'
        });
      }
    }

    return {
      consistent: issues.length === 0,
      issues: issues
    };
  }

  calculateSummary(matrix) {
    matrix.summary.totalCodes = matrix.errorCodes.length;
    matrix.summary.withRetryStrategy = matrix.errorCodes.filter(e => e.retryStrategy.maxRetries > 0).length;
    matrix.summary.withoutRetryStrategy = matrix.errorCodes.filter(e => e.retryStrategy.maxRetries === 0).length;

    for (const [key, category] of Object.entries(matrix.categories)) {
      category.count = category.codes.length;
      matrix.summary.categories[key] = category.count;
    }
  }

  getRetryableCodes(matrix) {
    return matrix.errorCodes.filter(e => e.retryable);
  }

  getNonRetryableCodes(matrix) {
    return matrix.errorCodes.filter(e => !e.retryable);
  }
}

module.exports = MatrixBuilder;
`;

const reportGeneratorCode = `const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');

class ReportGenerator {
  constructor(options) {
    this.options = options || {};
    this.chalk = new chalk.Instance({ level: 3 });
  }

  generateConsoleReport(matrix) {
    let output = '';
    
    output += this.chalk.bold.blue('\\n╔══════════════════════════════════════════════════════════════╗\\n');
    output += this.chalk.bold.blue('║') + '                    gRPC 错误码矩阵报告                         ' + this.chalk.bold.blue('║\\n');
    output += this.chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝\\n\\n');

    output += this.generateSummarySection(matrix);
    output += this.generateCategorySection(matrix);
    output += this.generateErrorCodesTable(matrix);
    
    return output;
  }

  generateSummarySection(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📊 摘要信息\\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\\n');
    
    const summary = matrix.summary;
    const summaryData = [
      ['总错误码数量', summary.totalCodes.toString()],
      ['含重试策略', summary.withRetryStrategy.toString()],
      ['不含重试策略', summary.withoutRetryStrategy.toString()]
    ];

    for (const [category, count] of Object.entries(summary.categories)) {
      summaryData.push([this.getCategoryDisplayName(category), count.toString()]);
    }

    output += table(summaryData, {
      columns: [{ width: 20 }, { width: 10 }],
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    });
    
    output += '\\n';
    return output;
  }

  generateCategorySection(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📂 错误分类\\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\\n\\n');

    for (const [key, category] of Object.entries(matrix.categories)) {
      const color = category.retryable ? this.chalk.green : this.chalk.red;
      output += color.bold('◆ ' + category.name + ' (' + category.count + ')\\n');
      output += this.chalk.gray('  ' + category.description + '\\n');
      output += this.chalk.gray('  可重试: ' + (category.retryable ? '是 ✓' : '否 ✗') + '\\n');
      
      if (category.codes.length > 0) {
        const sampleCodes = category.codes.slice(0, 5);
        output += this.chalk.gray('  示例: ' + sampleCodes.map(c => c.name + '(' + c.code + ')').join(', ') + '\\n');
      }
      output += '\\n';
    }

    return output;
  }

  generateErrorCodesTable(matrix) {
    let output = '';
    output += this.chalk.bold.yellow('📋 错误码详情\\n');
    output += this.chalk.gray('─────────────────────────────────────────────────────────────\\n\\n');

    const tableData = [
      ['错误码', '名称', '分类', '可重试', '最大重试次数']
    ];

    for (const ec of matrix.errorCodes) {
      const categoryColor = this.getCategoryColor(ec.category);
      tableData.push([
        ec.code.toString(),
        ec.name,
        this.getCategoryDisplayName(ec.category),
        ec.retryable ? '✓' : '✗',
        ec.retryStrategy.maxRetries.toString()
      ]);
    }

    output += table(tableData, {
      columns: [
        { width: 10 },
        { width: 30 },
        { width: 15 },
        { width: 8 },
        { width: 12 }
      ]
    });

    return output;
  }

  getCategoryDisplayName(category) {
    const names = {
      TRANSIENT: '临时错误',
      PERMANENT: '永久错误',
      CLIENT_ERROR: '客户端错误',
      SERVER_ERROR: '服务端错误'
    };
    return names[category] || category;
  }

  getCategoryColor(category) {
    const colors = {
      TRANSIENT: this.chalk.yellow,
      PERMANENT: this.chalk.red,
      CLIENT_ERROR: this.chalk.magenta,
      SERVER_ERROR: this.chalk.blue
    };
    return colors[category] || this.chalk.gray;
  }

  generateJsonReport(matrix, outputPath) {
    const jsonContent = JSON.stringify(matrix, null, 2);
    
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, jsonContent, 'utf8');
    }
    
    return jsonContent;
  }

  generateMarkdownReport(matrix, outputPath) {
    let md = '# gRPC 错误码矩阵报告\\n\\n';
    md += '*生成时间: ' + new Date(matrix.timestamp).toLocaleString() + '*\\n\\n';

    md += '## 摘要\\n\\n';
    md += '| 指标 | 数值 |\\n';
    md += '|------|------|\\n';
    md += '| 总错误码数量 | ' + matrix.summary.totalCodes + ' |\\n';
    md += '| 含重试策略 | ' + matrix.summary.withRetryStrategy + ' |\\n';
    md += '| 不含重试策略 | ' + matrix.summary.withoutRetryStrategy + ' |\\n\\n';

    md += '## 错误分类统计\\n\\n';
    md += '| 分类 | 数量 | 可重试 | 描述 |\\n';
    md += '|------|------|--------|------|\\n';
    for (const [key, category] of Object.entries(matrix.categories)) {
      md += '| ' + category.name + ' | ' + category.count + ' | ' + (category.retryable ? '是' : '否') + ' | ' + category.description + ' |\\n';
    }
    md += '\\n';

    md += '## 错误码详情\\n\\n';
    md += '| 错误码 | 名称 | 分类 | 可重试 | 最大重试次数 | 退避策略 |\\n';
    md += '|--------|------|------|--------|--------------|----------|\\n';

    for (const ec of matrix.errorCodes) {
      md += '| ' + ec.code + ' | ' + ec.name + ' | ' + this.getCategoryDisplayName(ec.category) + ' | ' + (ec.retryable ? '是' : '否') + ' | ' + ec.retryStrategy.maxRetries + ' | ' + ec.retryStrategy.backoff + ' |\\n';
    }
    md += '\\n';

    md += '## SDK 一致性检查\\n\\n';
    const inconsistentCodes = matrix.errorCodes.filter(e => !e.sdkConsistency.consistent);
    
    if (inconsistentCodes.length === 0) {
      md += '✅ 所有 SDK 命名一致\\n';
    } else {
      md += '⚠️ 发现 ' + inconsistentCodes.length + ' 个命名不一致的错误码:\\n\\n';
      for (const ec of inconsistentCodes) {
        md += '### ' + ec.name + ' (' + ec.code + ')\\n\\n';
        for (const issue of ec.sdkConsistency.issues) {
          md += '- ' + issue.message + '\\n';
        }
        md += '\\n';
      }
    }

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, md, 'utf8');
    }

    return md;
  }

  generateAllReports(matrix, outputDir) {
    const reports = {};
    
    reports.console = this.generateConsoleReport(matrix);
    
    if (outputDir) {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      reports.jsonPath = path.join(outputDir, 'error-matrix.json');
      reports.json = this.generateJsonReport(matrix, reports.jsonPath);
      
      reports.markdownPath = path.join(outputDir, 'error-matrix.md');
      reports.markdown = this.generateMarkdownReport(matrix, reports.markdownPath);
    }
    
    return reports;
  }
}

module.exports = ReportGenerator;
`;

const cliCode = `#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const ProtoParser = require('./proto-parser');
const MatrixBuilder = require('./matrix-builder');
const ReportGenerator = require('./report-generator');

const program = new Command();

program
  .name('grpc-error-matrix')
  .description('gRPC 错误码矩阵工具 - 解析 proto 文件、构建错误码矩阵和重试策略')
  .version('1.0.0');

program
  .command('parse')
  .description('解析 proto 文件并提取错误码')
  .requiredOption('-p, --proto <path>', 'proto 文件路径')
  .option('-o, --output <path>', '输出 JSON 文件路径')
  .action((options) => {
    try {
      const parser = new ProtoParser();
      const result = parser.parse(options.proto);
      
      console.log('解析结果:');
      console.log('文件:', result.file);
      console.log('包:', result.packages.join(', '));
      console.log('枚举数量:', result.enums.length);
      console.log('错误码数量:', result.errorCodes.length);
      
      if (result.parseErrors.length > 0) {
        console.error('解析错误:', result.parseErrors);
      }
      
      if (options.output) {
        const dir = path.dirname(options.output);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(options.output, JSON.stringify(result, null, 2), 'utf8');
        console.log('结果已保存到:', options.output);
      } else {
        console.log('错误码:', result.errorCodes);
      }
    } catch (err) {
      console.error('解析失败:', err.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('分析错误码并构建矩阵')
  .requiredOption('-p, --proto <path>', 'proto 文件路径')
  .option('-s, --sdk <path>', 'SDK 定义 JSON 文件路径')
  .option('-o, --output <dir>', '输出目录', 'reports')
  .option('--no-console', '不输出控制台报告')
  .action((options) => {
    try {
      const parser = new ProtoParser();
      const parseResult = parser.parse(options.proto);
      
      if (parseResult.parseErrors.length > 0) {
        console.error('解析警告:', parseResult.parseErrors);
      }
      
      let sdkDefinitions = {};
      if (options.sdk && fs.existsSync(options.sdk)) {
        const sdkContent = fs.readFileSync(options.sdk, 'utf8');
        sdkDefinitions = JSON.parse(sdkContent);
      }
      
      const builder = new MatrixBuilder();
      const matrix = builder.buildMatrix(parseResult.errorCodes, sdkDefinitions);
      
      const generator = new ReportGenerator();
      
      if (options.console) {
        const consoleReport = generator.generateConsoleReport(matrix);
        console.log(consoleReport);
      }
      
      if (options.output) {
        const reports = generator.generateAllReports(matrix, options.output);
        console.log('报告已生成:');
        console.log('  JSON:', reports.jsonPath);
        console.log('  Markdown:', reports.markdownPath);
      }
      
    } catch (err) {
      console.error('分析失败:', err.message);
      process.exit(1);
    }
  });

program
  .command('list-categories')
  .description('列出所有错误码分类')
  .action(() => {
    const builder = new MatrixBuilder();
    console.log('可用的错误码分类:');
    for (const [key, category] of Object.entries(builder.retryCategories)) {
      console.log('');
      console.log(key + ':');
      console.log('  名称:', category.name);
      console.log('  描述:', category.description);
      console.log('  可重试:', category.retryable ? '是' : '否');
    }
  });

program
  .command('self-test')
  .description('自检所有模块是否正常加载')
  .action(() => {
    try {
      console.log('✓ ProtoParser 加载成功');
      console.log('✓ MatrixBuilder 加载成功');
      console.log('✓ ReportGenerator 加载成功');
      console.log('');
      console.log('所有模块加载成功!');
    } catch (err) {
      console.error('自检失败:', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
`;

fs.writeFileSync(path.join(srcDir, 'proto-parser.js'), protoParserCode, 'utf8');
console.log('✓ src/proto-parser.js 创建成功');

fs.writeFileSync(path.join(srcDir, 'matrix-builder.js'), matrixBuilderCode, 'utf8');
console.log('✓ src/matrix-builder.js 创建成功');

fs.writeFileSync(path.join(srcDir, 'report-generator.js'), reportGeneratorCode, 'utf8');
console.log('✓ src/report-generator.js 创建成功');

fs.writeFileSync(path.join(srcDir, 'cli.js'), cliCode, 'utf8');
console.log('✓ src/cli.js 创建成功');

console.log('\n所有文件创建完成!');
