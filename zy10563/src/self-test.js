#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const GitScanner = require('./git-scanner');
const ReportGenerator = require('./report-generator');

console.log('🧪 启动 Git 历史大文件分析工具自检程序...\n');

const testDir = path.join(os.tmpdir(), 'git-large-files-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${error.message}`);
    failed++;
  }
}

try {
  console.log('=== 环境检查 ===\n');
  
  test('Node.js 版本检查', () => {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);
    if (major < 14) throw new Error(`需要 Node.js >= 14, 当前 ${version}`);
  });

  test('Git 安装检查', () => {
    execSync('git --version', { encoding: 'utf8', stdio: 'ignore' });
  });

  test('模块加载检查', () => {
    require.resolve('./git-scanner');
    require.resolve('./report-generator');
  });

  console.log('\n=== 创建测试仓库 ===\n');

  process.chdir(testDir);
  execSync('git init', { stdio: 'ignore' });
  execSync('git config user.name "Test User"', { stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { stdio: 'ignore' });

  const fileSizes = [100, 200, 300, 400, 500];
  for (let i = 0; i < fileSizes.length; i++) {
    const content = 'x'.repeat(1024 * fileSizes[i]);
    fs.writeFileSync(`large${i}.txt`, content);
    execSync(`git add large${i}.txt`, { stdio: 'ignore' });
    execSync(`git commit -m "Add large file ${i}"`, { stdio: 'ignore' });
  }

  fs.writeFileSync('small.txt', 'small content');
  execSync('git add small.txt', { stdio: 'ignore' });
  execSync('git commit -m "Add small file"', { stdio: 'ignore' });

  fs.writeFileSync('README.md', '# Test Repo\n\nThis is a test repository.');
  execSync('git add README.md', { stdio: 'ignore' });
  execSync('git commit -m "Add README"', { stdio: 'ignore' });

  test('创建测试仓库成功', () => {
    const log = execSync('git log --oneline', { encoding: 'utf8' });
    if (log.trim().split('\n').length !== 7) {
      throw new Error(`期望 7 个提交, 实际 ${log.trim().split('\n').length}`);
    }
  });

  console.log('\n=== GitScanner 测试 ===\n');

  let scanner, historyResult, blobResult, detailedResult;

  test('初始化 GitScanner', () => {
    scanner = new GitScanner({ repoPath: testDir, minSize: 1024 });
  });

  test('验证仓库有效性', () => {
    scanner.validateRepo();
  });

  test('scanHistory() - 扫描提交历史', () => {
    historyResult = scanner.scanHistory();
    if (historyResult.commits.length < 7) {
      throw new Error(`期望至少 7 个提交, 实际 ${historyResult.commits.length}`);
    }
    if (historyResult.files.length < 7) {
      throw new Error(`期望至少 7 个文件, 实际 ${historyResult.files.length}`);
    }
  });

  test('scanHistory() - 作者统计', () => {
    if (!historyResult.authors || historyResult.authors.length !== 1) {
      throw new Error('作者统计异常');
    }
  });

  test('scanWithBlobSizes() - 扫描 blob 大小', () => {
    blobResult = scanner.scanWithBlobSizes();
  });

  test('getDetailedHistory() - 获取完整分析结果', () => {
    detailedResult = scanner.getDetailedHistory();
    if (!detailedResult.summary) throw new Error('缺少 summary');
    if (!detailedResult.files) throw new Error('缺少 files');
    if (!detailedResult.authors) throw new Error('缺少 authors');
    if (!Array.isArray(detailedResult.errors)) throw new Error('缺少 errors 数组');
  });

  console.log('\n=== ReportGenerator 测试 ===\n');

  let generator;

  test('初始化 ReportGenerator', () => {
    generator = new ReportGenerator(detailedResult, { topN: 10 });
  });

  test('formatSize() - 大小格式化', () => {
    if (generator.formatSize(1024) !== '1 KB') throw new Error('1 KB 格式化失败');
    if (generator.formatSize(1024 * 1024) !== '1 MB') throw new Error('1 MB 格式化失败');
    if (generator.formatSize(0) !== '0 B') throw new Error('0 B 格式化失败');
  });

  test('generateTerminalSummary() - 生成终端摘要', () => {
    const output = generator.generateTerminalSummary();
    if (!output.includes('Git 历史大文件分析报告')) {
      throw new Error('终端摘要缺少标题');
    }
    if (!output.includes('扫描摘要')) {
      throw new Error('终端摘要缺少扫描摘要部分');
    }
  });

  test('generateJSON() - 生成 JSON 输出', () => {
    const output = generator.generateJSON();
    const parsed = JSON.parse(output);
    if (!parsed.summary) throw new Error('JSON 缺少 summary');
  });

  test('generateMarkdown() - 生成 Markdown 报告', () => {
    const output = generator.generateMarkdown();
    if (!output.startsWith('# Git 历史大文件分析报告')) {
      throw new Error('Markdown 报告标题格式错误');
    }
    if (!output.includes('## 扫描摘要')) {
      throw new Error('Markdown 缺少扫描摘要章节');
    }
  });

  test('saveTerminalSummary() - 保存终端摘要文件', () => {
    const filePath = path.join(testDir, 'summary.txt');
    generator.saveTerminalSummary(filePath);
    if (!fs.existsSync(filePath)) throw new Error('文件未生成');
  });

  test('saveJSON() - 保存 JSON 文件', () => {
    const filePath = path.join(testDir, 'results.json');
    generator.saveJSON(filePath);
    if (!fs.existsSync(filePath)) throw new Error('文件未生成');
    JSON.parse(fs.readFileSync(filePath, 'utf8'));
  });

  test('saveMarkdown() - 保存 Markdown 文件', () => {
    const filePath = path.join(testDir, 'report.md');
    generator.saveMarkdown(filePath);
    if (!fs.existsSync(filePath)) throw new Error('文件未生成');
  });

  test('saveAll() - 保存所有格式报告', () => {
    const outputDir = path.join(testDir, 'reports');
    const files = generator.saveAll(outputDir);
    for (const filePath of Object.values(files)) {
      if (!fs.existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
    }
  });

  console.log('\n=== 边界情况测试 ===\n');

  test('无效仓库检测', () => {
    const badScanner = new GitScanner({ repoPath: '/nonexistent/path' });
    try {
      badScanner.validateRepo();
      throw new Error('应该抛出错误');
    } catch (e) {
      if (!e.message.includes('不是有效的Git仓库')) {
        throw new Error(`错误消息不正确: ${e.message}`);
      }
    }
  });

  test('解析大小参数', () => {
    const cliPath = path.join(__dirname, 'cli.js');
    const result = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
    if (!result.includes('Git 历史大文件分析工具')) {
      throw new Error('帮助信息错误');
    }
  });

  console.log('\n=== CLI 集成测试 ===\n');

  const cliPath = path.join(__dirname, 'cli.js');

  test('CLI --help 正常工作', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
    if (!output.includes('用法')) throw new Error('缺少用法说明');
  });

  test('CLI 扫描当前测试仓库', () => {
    const output = execSync(`node ${cliPath} -r ${testDir} -m 1K -f json`, { encoding: 'utf8' });
    const json = JSON.parse(output);
    if (!json.summary) throw new Error('CLI JSON 输出格式错误');
  });

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！工具运行正常。');
    console.log('\n📝 测试数据目录:', testDir);
    console.log('   你可以查看该目录了解测试过程中生成的文件。\n');
    process.exit(0);
  } else {
    console.log('\n❌ 有测试失败，请检查上面的错误信息。');
    console.log('\n测试目录:', testDir);
    process.exit(1);
  }

} catch (error) {
  console.error('\n💥 自检过程崩溃:', error.message);
  console.error('堆栈:', error.stack);
  console.log('\n测试目录:', testDir);
  process.exit(1);
}
