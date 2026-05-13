const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { glob } = require('glob');
const DataStore = require('../dataStore');
const { isCodePathMatch } = require('../utils/codePathMatcher');

async function indexCodeCommand(options) {
  const store = new DataStore();
  const spinner = ora('开始索引源码路径...').start();

  try {
    const testCases = store.loadTestCases();
    
    if (testCases.items.length === 0) {
      spinner.fail('没有找到测试用例数据');
      console.log(chalk.yellow('  提示: 请先映射测试用例'));
      process.exit(1);
    }

    const patterns = store.config.paths.sourceCode || ['**/*.js'];
    spinner.text = `扫描源码文件 (${patterns.length} 个模式)...`;

    const matchedFiles = [];
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: process.cwd(),
          absolute: false,
          nodir: true
        });
        matchedFiles.push(...files);
      } catch (error) {
        console.log(chalk.yellow(`  警告: 模式 "${pattern}" 匹配失败: ${error.message}`));
      }
    }

    const uniqueFiles = [...new Set(matchedFiles)];
    
    if (uniqueFiles.length === 0) {
      spinner.warn('没有找到匹配的源码文件');
      console.log(chalk.yellow(`  搜索模式: ${patterns.join(', ')}`));
      store.addFailure('index_error', 'code-index', '没有找到匹配的源码文件', { patterns });
      process.exit(1);
    }

    spinner.text = `分析 ${uniqueFiles.length} 个源码文件...`;
    
    const codePaths = [];
    const parseErrors = [];

    for (const filePath of uniqueFiles) {
      try {
        const fullPath = path.join(process.cwd(), filePath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const functions = extractFunctions(content, filePath);
        
        functions.forEach(func => {
          codePaths.push({
            path: filePath,
            functionName: func.name,
            startLine: func.startLine,
            endLine: func.endLine,
            testCases: []
          });
        });

        if (functions.length === 0) {
          codePaths.push({
            path: filePath,
            testCases: []
          });
        }
      } catch (error) {
        parseErrors.push({
          file: filePath,
          error: error.message
        });
      }
    }

    if (parseErrors.length > 0) {
      console.log(chalk.yellow('\n  解析警告:'));
      parseErrors.forEach(err => {
        console.log(chalk.yellow(`    ⚠ ${err.file}: ${err.error}`));
      });
    }

    spinner.text = '关联测试用例和代码路径...';
    const linkedCount = linkTestCasesToCode(testCases.items, codePaths, store.config.mappings);

    const coverageData = {
      items: codePaths,
      lastUpdated: new Date().toISOString(),
      stats: {
        totalFiles: uniqueFiles.length,
        totalCodePaths: codePaths.length,
        linkedCodePaths: linkedCount,
        parseErrors: parseErrors.length
      }
    };

    store.saveCoverage(coverageData);

    spinner.succeed('源码路径索引完成');
    console.log(chalk.green('\n  索引统计:'));
    console.log(chalk.green(`    ✓ 扫描文件: ${uniqueFiles.length}`));
    console.log(chalk.green(`    ✓ 代码路径: ${codePaths.length}`));
    console.log(chalk.green(`    ✓ 已关联: ${linkedCount}`));
    console.log(chalk.green(`    ✓ 未关联: ${codePaths.length - linkedCount}`));
    console.log(chalk.green(`    ✓ 解析错误: ${parseErrors.length}`));

    if (options.verbose) {
      console.log(chalk.cyan('\n  代码路径列表:'));
      codePaths.forEach((cp, index) => {
        const funcInfo = cp.functionName ? `:${cp.functionName}` : '';
        const linkedInfo = cp.testCases.length > 0 ? ` (关联 ${cp.testCases.length} 个用例)` : '';
        console.log(chalk.cyan(`    ${index + 1}. ${cp.path}${funcInfo}${linkedInfo}`));
      });
    }

    return coverageData;
  } catch (error) {
    spinner.fail('索引过程出错');
    console.log(chalk.red(`  错误: ${error.message}`));
    console.log(chalk.red(`  堆栈: ${error.stack}`));
    store.addFailure('unexpected_error', 'code-index', '索引源码时发生未知错误', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

function extractFunctions(content, filePath) {
  const functions = [];
  const lines = content.split('\n');
  
  const patterns = [
    /function\s+(\w+)\s*\(/g,
    /const\s+(\w+)\s*=\s*(?:async\s+)?function/g,
    /const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
    /class\s+(\w+)/g,
    /(\w+)\s*:\s*(?:async\s+)?function/g,
    /(\w+)\s*\([^)]*\)\s*\{/g
  ];

  const seen = new Set();

  lines.forEach((line, lineNumber) => {
    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(line)) !== null) {
        const name = match[1];
        if (name && !seen.has(name)) {
          seen.add(name);
          functions.push({
            name,
            startLine: lineNumber + 1,
            endLine: findEndLine(lines, lineNumber + 1)
          });
        }
      }
    });
  });

  return functions;
}

function findEndLine(lines, startLine) {
  let braceCount = 0;
  let foundFirstBrace = false;

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (char === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          return i + 1;
        }
      }
    }
  }

  return lines.length;
}

function linkTestCasesToCode(testCases, codePaths, mappingsConfig) {
  let linkedCount = 0;
  const autoMatch = mappingsConfig.autoMatch !== false;
  const caseSensitive = mappingsConfig.caseSensitive === true;

  testCases.forEach(testCase => {
    if (testCase.codePaths && testCase.codePaths.length > 0) {
      testCase.codePaths.forEach(codePathRef => {
        codePaths.forEach(cp => {
          const match = isCodePathMatch(codePathRef, cp, { caseSensitive });

          if (match && !cp.testCases.includes(testCase.id)) {
            cp.testCases.push(testCase.id);
            linkedCount++;
          }
        });
      });
    }

    if (autoMatch && (!testCase.codePaths || testCase.codePaths.length === 0)) {
      const titleKeywords = extractKeywords(testCase.title);
      codePaths.forEach(cp => {
        const pathKeywords = extractKeywords(cp.path + (cp.functionName || ''));
        const matches = titleKeywords.some(kw => pathKeywords.includes(kw));
        
        if (matches && !cp.testCases.includes(testCase.id)) {
          cp.testCases.push(testCase.id);
          linkedCount++;
        }
      });
    }
  });

  return linkedCount;
}

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

module.exports = indexCodeCommand;
