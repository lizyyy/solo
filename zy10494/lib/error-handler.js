const chalk = require('chalk');

function handleFatalError(error) {
  console.error('\n');
  console.error(chalk.red('══════════════════════════════════════════════════════════════'));
  console.error(chalk.red('                        致命错误发生'));
  console.error(chalk.red('══════════════════════════════════════════════════════════════'));
  console.error('\n');
  
  console.error(chalk.bold('错误类型:'), error.name || 'Unknown');
  console.error(chalk.bold('错误信息:'), error.message || 'No message');
  console.error('\n');
  
  if (error.stack) {
    console.error(chalk.gray('堆栈跟踪:'));
    const stackLines = error.stack.split('\n').slice(0, 10);
    stackLines.forEach(line => {
      console.error(chalk.gray(`  ${line}`));
    });
    if (error.stack.split('\n').length > 10) {
      console.error(chalk.gray('  ... (更多堆栈已省略)'));
    }
    console.error('\n');
  }

  console.error(chalk.yellow('可能的原因:'));
  console.error(chalk.yellow('  1. 输入文件格式不正确或损坏'));
  console.error(chalk.yellow('  2. 输出目录没有写入权限'));
  console.error(chalk.yellow('  3. 依赖包未正确安装'));
  console.error(chalk.yellow('  4. 配置参数错误'));
  console.error('\n');

  console.error(chalk.cyan('排错建议:'));
  console.error(chalk.cyan('  • 使用 --verbose 参数查看详细日志'));
  console.error(chalk.cyan('  • 检查输入文件是否为有效的 CSV/YAML/JSON'));
  console.error(chalk.cyan('  • 运行 npm install 确保依赖完整'));
  console.error(chalk.cyan('  • 查看输出目录是否存在并有写入权限'));
  console.error('\n');

  process.exit(1);
}

function handleParseError(file, line, message, source) {
  return {
    type: 'parse_error',
    file,
    line,
    message,
    source,
    toString() {
      return `[${file}:${line}] ${message}`;
    }
  };
}

function createIssue(type, message, severity = null, source = null) {
  return {
    type,
    message,
    severity,
    source,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  handleFatalError,
  handleParseError,
  createIssue
};
