const fs = require('fs');
const content = `#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const LicenseDiff = require('../src/index');

program
  .name('license-diff')
  .description('NPM许可证差异CLI工具 - 对比依赖升级后的许可证变化')
  .version('1.0.0');

program
  .command('compare')
  .description('对比两个 lockfile 的许可证差异')
  .argument('<old-lockfile>', '旧的 lockfile 路径')
  .argument('<new-lockfile>', '新的 lockfile 路径')
  .option('-j, --json', '输出 JSON 格式报告')
  .option('-m, --markdown', '输出 Markdown 格式报告')
  .option('-o, --output <path>', '输出文件路径')
  .action((oldPath, newPath, options) => {
    try {
      const licenseDiff = new LicenseDiff();
      const oldAbsPath = path.resolve(oldPath);
      const newAbsPath = path.resolve(newPath);

      console.log(chalk.cyan('正在解析 lockfiles...\\n'));

      const result = licenseDiff.run(oldAbsPath, newAbsPath, options);

      if (options.json || options.markdown) {
        const outputPath = options.output || 
          \`license-diff-report.\${options.json ? 'json' : 'md'}\`;
        console.log(chalk.green(\`报告已生成: \${outputPath}\`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ 执行失败:'), error.message);
      process.exit(1);
    }
  });

program.parse();
`;
fs.writeFileSync('./bin/license-diff.js', content);
console.log('CLI file fixed successfully!');
