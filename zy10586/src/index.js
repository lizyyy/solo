#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const GitReader = require('./git-reader');
const Classifier = require('./classifier');
const PathAnalyzer = require('./path-analyzer');
const ReportGenerator = require('./report-generator');

const program = new Command();

program
  .name('git-classify')
  .description('Git提交信息归类工具 - 自动整理发版说明')
  .version('1.0.0');

program
  .option('-n, --count <number>', '读取最近N条提交', '20')
  .option('-s, --since <date>', '从指定日期开始（如：2024-01-01或"1 week ago"）')
  .option('-u, --until <date>', '到指定日期结束')
  .option('-a, --author <name>', '按作者筛选')
  .option('-b, --branch <name>', '指定分支', 'HEAD')
  .option('--repo <path>', 'Git仓库路径', process.cwd())
  .option('-o, --output <path>', '输出目录', process.cwd())
  .option('--json', '导出JSON格式报告')
  .option('--md', '导出Markdown格式报告')
  .option('--html', '导出HTML格式报告')
  .option('--all', '导出所有格式报告')
  .option('--no-console', '不输出终端摘要')
  .action(async (options) => {
    try {
      const repoPath = path.resolve(options.repo);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(repoPath)) {
        console.error(chalk.red(`✗ 仓库路径不存在: ${repoPath}`));
        process.exit(1);
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const gitReader = new GitReader(repoPath);
      
      if (!gitReader.isGitRepo()) {
        console.error(chalk.red(`✗ 不是有效的Git仓库: ${repoPath}`));
        process.exit(1);
      }

      console.log(chalk.cyan(`📖 正在读取Git提交...`));
      const gitOptions = {
        maxCount: parseInt(options.count),
        since: options.since,
        until: options.until,
        author: options.author,
        branch: options.branch
      };

      const { commits, errors: gitErrors } = gitReader.getCommits(gitOptions);
      
      if (commits.length === 0) {
        console.log(chalk.yellow('⚠️  没有找到任何提交记录'));
        return;
      }

      console.log(chalk.green(`✓ 读取到 ${commits.length} 条提交`));

      console.log(chalk.cyan(`🔍 正在分类提交...`));
      const classifier = new Classifier();
      const { classified: classifiedCommits, errors: classifyErrors } = classifier.classifyAll(commits);
      const groups = classifier.groupByCategory(classifiedCommits);

      console.log(chalk.cyan(`📊 正在分析文件路径...`));
      const pathAnalyzer = new PathAnalyzer();
      const moduleChanges = pathAnalyzer.getModuleChanges(classifiedCommits);
      const { topPathChanges } = pathAnalyzer.analyzeCommitsByPath(classifiedCommits);

      const result = {
        classifiedCommits,
        groups,
        gitErrors,
        classifyErrors,
        pathAnalysis: {
          moduleChanges,
          topPathChanges
        }
      };

      const reportGenerator = new ReportGenerator({ outputDir });

      if (options.console !== false) {
        reportGenerator.printConsoleSummary(result);
      }

      if (options.json || options.all) {
        reportGenerator.exportJson(result);
      }

      if (options.md || options.all) {
        reportGenerator.generateMarkdownReport(result);
      }

      if (options.html || options.all) {
        reportGenerator.generateHtmlReport(result);
      }

      console.log(chalk.green.bold('🎉 处理完成!'));

    } catch (error) {
      console.error(chalk.red(`✗ 处理失败: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program
  .command('categories')
  .description('查看所有分类规则')
  .action(() => {
    console.log('\n');
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('              可用分类规则 '));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log('');

    for (const category of Classifier.DEFAULT_RULES.categories) {
      const colorMethod = chalk[category.color] || chalk.gray;
      console.log(colorMethod.bold(`📁 ${category.name} (${category.key})`));
      console.log(chalk.gray(`   优先级: ${category.priority}`));
      console.log(chalk.gray(`   标题匹配模式 (${category.patterns.length}):`));
      
      for (let i = 0; i < Math.min(3, category.patterns.length); i++) {
        console.log(chalk.gray(`     • ${category.patterns[i].toString()}`));
      }
      
      if (category.patterns.length > 3) {
        console.log(chalk.gray(`     ... 还有 ${category.patterns.length - 3} 个`));
      }

      if (category.filePatterns && category.filePatterns.length > 0) {
        console.log(chalk.gray(`   文件匹配模式 (${category.filePatterns.length}):`));
        for (let i = 0; i < Math.min(2, category.filePatterns.length); i++) {
          console.log(chalk.gray(`     • ${category.filePatterns[i].toString()}`));
        }
      }

      console.log('');
    }

    console.log(chalk.gray(`📦 未分类 (other) - 所有未匹配的提交`));
    console.log('');
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log('');
  });

program
  .command('test')
  .description('使用模拟数据测试分类功能')
  .action(() => {
    console.log(chalk.cyan('🧪 使用模拟数据测试分类功能...\n'));

    const testCommits = [
      {
        hash: 'a1b2c3d',
        shortHash: 'a1b2c3d',
        authorName: '张三',
        authorEmail: 'zhangsan@example.com',
        date: '2024-01-15 10:30:00',
        subject: 'fix: 修复登录页面崩溃问题',
        files: [{ status: 'M', path: 'src/components/Login.vue' }]
      },
      {
        hash: 'b2c3d4e',
        shortHash: 'b2c3d4e',
        authorName: '李四',
        authorEmail: 'lisi@example.com',
        date: '2024-01-15 11:00:00',
        subject: 'feat: 添加用户中心页面',
        files: [{ status: 'A', path: 'src/pages/UserCenter.vue' }]
      },
      {
        hash: 'c3d4e5f',
        shortHash: 'c3d4e5f',
        authorName: '王五',
        authorEmail: 'wangwu@example.com',
        date: '2024-01-15 14:00:00',
        subject: 'refactor: 重构用户认证模块',
        files: [{ status: 'M', path: 'src/services/auth.js' }]
      },
      {
        hash: 'd4e5f6g',
        shortHash: 'd4e5f6g',
        authorName: '赵六',
        authorEmail: 'zhaoliu@example.com',
        date: '2024-01-15 15:30:00',
        subject: '更新配置文件，添加环境变量',
        files: [{ status: 'M', path: '.env.production' }]
      },
      {
        hash: 'e5f6g7h',
        shortHash: 'e5f6g7h',
        authorName: '钱七',
        authorEmail: 'qianqi@example.com',
        date: '2024-01-15 16:00:00',
        subject: '更新README文档，添加部署说明',
        files: [{ status: 'M', path: 'README.md' }]
      },
      {
        hash: 'f6g7h8i',
        shortHash: 'f6g7h8i',
        authorName: '孙八',
        authorEmail: 'sunba@example.com',
        date: '2024-01-15 17:00:00',
        subject: '添加单元测试用例',
        files: [{ status: 'A', path: 'tests/auth.test.js' }]
      },
      {
        hash: 'g7h8i9j',
        shortHash: 'g7h8i9j',
        authorName: '周九',
        authorEmail: 'zhoujiu@example.com',
        date: '2024-01-16 09:00:00',
        subject: '优化数据库查询性能',
        files: [{ status: 'M', path: 'src/models/User.js' }]
      },
      {
        hash: 'h8i9j0k',
        shortHash: 'h8i9j0k',
        authorName: '吴十',
        authorEmail: 'wushi@example.com',
        date: '2024-01-16 10:00:00',
        subject: '调整样式，修复响应式布局问题',
        files: [{ status: 'M', path: 'src/styles/main.css' }]
      },
      {
        hash: 'i9j0k1l',
        shortHash: 'i9j0k1l',
        authorName: '郑十一',
        authorEmail: 'zheng@example.com',
        date: '2024-01-16 11:00:00',
        subject: '更新CI配置，添加代码检查步骤',
        files: [{ status: 'M', path: '.github/workflows/ci.yml' }]
      },
      {
        hash: 'j0k1l2m',
        shortHash: 'j0k1l2m',
        authorName: '王十二',
        authorEmail: 'wang@example.com',
        date: '2024-01-16 12:00:00',
        subject: '回滚上一次提交',
        files: [{ status: 'M', path: 'src/app.js' }]
      },
      {
        hash: 'k1l2m3n',
        shortHash: 'k1l2m3n',
        authorName: '李十三',
        authorEmail: 'li@example.com',
        date: '2024-01-16 13:00:00',
        subject: '随便改了点东西',
        files: [{ status: 'M', path: 'src/utils/helper.js' }]
      }
    ];

    const classifier = new Classifier();
    const { classified: classifiedCommits, errors: classifyErrors } = classifier.classifyAll(testCommits);
    const groups = classifier.groupByCategory(classifiedCommits);

    const pathAnalyzer = new PathAnalyzer();
    const moduleChanges = pathAnalyzer.getModuleChanges(classifiedCommits);

    const result = {
      classifiedCommits,
      groups,
      gitErrors: [],
      classifyErrors,
      pathAnalysis: { moduleChanges }
    };

    const reportGenerator = new ReportGenerator({ outputDir: process.cwd() });
    reportGenerator.printConsoleSummary(result);

    console.log(chalk.cyan('💡 提示: 运行 `git-classify --md` 可以生成Markdown报告'));
    console.log(chalk.cyan('💡 提示: 运行 `git-classify --html` 可以生成HTML报告'));
    console.log('');
  });

program.parse(process.argv);