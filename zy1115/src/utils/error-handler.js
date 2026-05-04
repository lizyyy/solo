const chalk = require('chalk');
const { BaseError, FileError, ValidationError, ParseError, ConfigError } = require('./errors');

class ErrorHandler {
  handle(error) {
    if (error instanceof BaseError) {
      this.printUserFriendlyError(error);
    } else {
      this.printUnexpectedError(error);
    }
  }

  printUserFriendlyError(error) {
    console.error('');
    
    if (error instanceof FileError) {
      console.error(chalk.red('📁 文件访问错误'));
      console.error(chalk.gray('='.repeat(50)));
    } else if (error instanceof ValidationError) {
      console.error(chalk.red('⚠️  数据验证错误'));
      console.error(chalk.gray('='.repeat(50)));
    } else if (error instanceof ParseError) {
      console.error(chalk.red('🔧 解析错误'));
      console.error(chalk.gray('='.repeat(50)));
    } else if (error instanceof ConfigError) {
      console.error(chalk.red('⚙️  配置错误'));
      console.error(chalk.gray('='.repeat(50)));
    } else {
      console.error(chalk.red('❌ 错误'));
      console.error(chalk.gray('='.repeat(50)));
    }
    
    console.error('');
    
    if (error.userMessage) {
      console.error(error.userMessage);
    } else {
      console.error(chalk.white(error.message));
    }
    
    console.error('');
    this.printHelpHint();
  }

  printUnexpectedError(error) {
    console.error('');
    console.error(chalk.red('💥 意外错误'));
    console.error(chalk.gray('='.repeat(50)));
    console.error('');
    
    console.error(chalk.white(`错误类型: ${error.name || 'Unknown'}`));
    console.error(chalk.white(`错误信息: ${error.message}`));
    
    console.error('');
    console.error(chalk.gray('栈追踪:'));
    console.error(chalk.gray(error.stack));
    
    console.error('');
    console.error(chalk.yellow('💡 这可能是一个工具 bug。请考虑报告此问题。'));
    this.printHelpHint();
  }

  printHelpHint() {
    console.error(chalk.gray('─'.repeat(50)));
    console.error(chalk.cyan('💡 帮助信息:'));
    console.error('');
    console.error(chalk.gray('  使用 schema-drift --help 查看可用命令'));
    console.error(chalk.gray('  使用 schema-drift <command> --help 查看命令详情'));
    console.error('');
    console.error(chalk.gray('  示例:'));
    console.error(chalk.gray('    schema-drift scan -o openapi.json -m ./mocks'));
    console.error(chalk.gray('    schema-drift check -o openapi.json -m ./mocks -f fixtures.json'));
    console.error('');
  }

  wrapAsync(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error);
        process.exit(1);
      }
    };
  }
}

const errorHandler = new ErrorHandler();

process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error(chalk.red('💥 未处理的 Promise 拒绝'));
  console.error(chalk.gray('='.repeat(50)));
  console.error('');
  
  if (reason instanceof Error) {
    errorHandler.handle(reason);
  } else {
    console.error(chalk.white(`原因: ${JSON.stringify(reason, null, 2)}`));
  }
  
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('');
  console.error(chalk.red('💥 未捕获的异常'));
  console.error(chalk.gray('='.repeat(50)));
  console.error('');
  
  errorHandler.handle(error);
  process.exit(1);
});

module.exports = {
  errorHandler,
  ErrorHandler
};
