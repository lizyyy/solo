#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const HeadingParser = require('../src/heading-parser');
const OwnerMatcher = require('../src/owner-matcher');
const ChapterOwnerParser = require('../src/chapter-owner-parser');
const LinkChecker = require('../src/link-checker');

const chalk = require('chalk');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(chalk.green(`  ✅ ${name}`));
    passed++;
  } catch (error) {
    console.log(chalk.red(`  ❌ ${name}`));
    console.log(chalk.red(`     ${error.message}`));
    failed++;
  }
}

console.log(chalk.bold.blue('\n═══════════════════════════════════════════════════════════════'));
console.log(chalk.bold.blue('                    运行测试套件'));
console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════\n'));

console.log(chalk.bold.yellow('📝 标题解析器测试'));

test('生成 GitHub 风格锚点', () => {
  const anchor = HeadingParser.generateAnchor('项目概述');
  assert.strictEqual(anchor, '项目概述');
});

test('生成带空格标题的锚点', () => {
  const anchor = HeadingParser.generateAnchor('Hello World Test');
  assert.strictEqual(anchor, 'hello-world-test');
});

test('处理特殊字符', () => {
  const anchor = HeadingParser.generateAnchor('如何重置密码？');
  assert.strictEqual(anchor, '如何重置密码');
});

test('解析重复标题生成唯一锚点', () => {
  const parser = new HeadingParser();
  const content = `# 测试标题
# 测试标题`;
  const headings = parser.parseContent(content, 'test.md');
  assert.strictEqual(headings.length, 2);
  assert.strictEqual(headings[0].anchor, '测试标题');
  assert.strictEqual(headings[1].anchor, '测试标题-1');
});

test('解析 ATX 标题', () => {
  const parser = new HeadingParser();
  const content = `# H1
## H2
### H3`;
  const headings = parser.parseContent(content, 'test.md');
  assert.strictEqual(headings.length, 3);
  assert.strictEqual(headings[0].level, 1);
  assert.strictEqual(headings[1].level, 2);
  assert.strictEqual(headings[2].level, 3);
});

test('忽略代码块内的标题', () => {
  const parser = new HeadingParser();
  const content = `# 真实标题
\`\`\`markdown
# 代码块内的标题
\`\`\``;
  const headings = parser.parseContent(content, 'test.md');
  assert.strictEqual(headings.length, 1);
  assert.strictEqual(headings[0].text, '真实标题');
});

console.log('');
console.log(chalk.bold.yellow('👤 负责人匹配器测试'));

test('从 JSON 数组加载负责人', () => {
  const matcher = new OwnerMatcher([
    { name: '张三', aliases: ['小张', 'zs'] }
  ]);
  assert.strictEqual(matcher.getOwnerNames().length, 1);
});

test('精确匹配负责人', () => {
  const matcher = new OwnerMatcher([
    { name: '张三', aliases: ['小张', 'zs'] }
  ]);
  const result = matcher.match('张三');
  assert.strictEqual(result.matched, true);
  assert.strictEqual(result.canonicalName, '张三');
  assert.strictEqual(result.matchType, 'exact');
});

test('通过别名匹配负责人', () => {
  const matcher = new OwnerMatcher([
    { name: '张三', aliases: ['小张', 'zs'] }
  ]);
  const result = matcher.match('小张');
  assert.strictEqual(result.matched, true);
  assert.strictEqual(result.canonicalName, '张三');
  assert.strictEqual(result.matchType, 'alias');
});

test('通过缩写别名匹配负责人', () => {
  const matcher = new OwnerMatcher([
    { name: '张三', aliases: ['小张', 'zs'] }
  ]);
  const result = matcher.match('zs');
  assert.strictEqual(result.matched, true);
  assert.strictEqual(result.canonicalName, '张三');
});

test('不区分大小写匹配', () => {
  const matcher = new OwnerMatcher([
    { name: 'ZhangSan', aliases: [] }
  ]);
  const result = matcher.match('zhangsan');
  assert.strictEqual(result.matched, true);
  assert.strictEqual(result.matchType, 'case-insensitive');
});

test('未知负责人返回建议', () => {
  const matcher = new OwnerMatcher([
    { name: '张三', aliases: [] },
    { name: '李四', aliases: [] }
  ]);
  const result = matcher.match('张');
  assert.strictEqual(result.matched, false);
  assert.ok(result.suggestions.length > 0);
});

test('从文件加载 JSON 配置', () => {
  const configPath = path.join(__dirname, '../examples/owners.json');
  if (fs.existsSync(configPath)) {
    const matcher = new OwnerMatcher(configPath);
    assert.ok(matcher.getOwnerNames().length >= 5);
  }
});

console.log('');
console.log(chalk.bold.yellow('📖 章节归属解析器测试'));

test('解析章节负责人', () => {
  const parser = new ChapterOwnerParser();
  const content = `## 测试章节
- 负责人: 张三
- 状态: 进行中

章节内容...`;
  const headingParser = new HeadingParser();
  const headings = headingParser.parseContent(content, 'test.md');
  const chapters = parser.parseContent(content, 'test.md', headings);
  
  assert.strictEqual(chapters.length, 1);
  assert.strictEqual(chapters[0].owner.name, '张三');
  assert.strictEqual(chapters[0].status, '进行中');
});

test('继承父章节负责人', () => {
  const parser = new ChapterOwnerParser();
  const content = `## 父章节
- 负责人: 张三

### 子章节

子章节内容...`;
  const headingParser = new HeadingParser();
  const headings = headingParser.parseContent(content, 'test.md');
  const chapters = parser.parseContent(content, 'test.md', headings);
  
  assert.strictEqual(chapters.length, 2);
  assert.strictEqual(chapters[1].owner.name, '张三');
  assert.strictEqual(chapters[1].owner.inherited, true);
});

test('解析多个评审人', () => {
  const parser = new ChapterOwnerParser();
  const content = `## 测试章节
- 负责人: 张三
- 评审人: 李四、王五

章节内容...`;
  const headingParser = new HeadingParser();
  const headings = headingParser.parseContent(content, 'test.md');
  const chapters = parser.parseContent(content, 'test.md', headings);
  
  assert.strictEqual(chapters[0].reviewers.length, 2);
  assert.strictEqual(chapters[0].reviewers[0].name, '李四');
  assert.strictEqual(chapters[0].reviewers[1].name, '王五');
});

console.log('');
console.log(chalk.bold.yellow('🔗 链接检查器测试'));

test('解析内联链接', () => {
  const checker = new LinkChecker();
  const content = `请查看 [安装指南](#安装指南) 获取更多信息。`;
  const links = checker.parseContent(content, 'test.md');
  
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].type, 'anchor');
  assert.strictEqual(links[0].text, '安装指南');
  assert.strictEqual(links[0].anchor, '安装指南');
});

test('解析外部链接', () => {
  const checker = new LinkChecker();
  const content = `访问 [官网](https://example.com) 了解更多。`;
  const links = checker.parseContent(content, 'test.md');
  
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].type, 'external');
  assert.strictEqual(links[0].url, 'https://example.com');
});

test('检测断链', async () => {
  const checker = new LinkChecker();
  const content = `请查看 [不存在](#不存在的锚点) 获取更多信息。`;
  
  checker.parseContent(content, 'test.md');
  checker.registerAnchors([
    { anchor: '存在的锚点', text: '存在的锚点', lineNumber: 1, headingLevel: 2 }
  ], 'test.md');
  
  const results = await checker.checkAllLinks();
  const brokenLinks = results.filter(r => r.status === 'error');
  
  assert.strictEqual(brokenLinks.length, 1);
  assert.strictEqual(brokenLinks[0].error, '锚点不存在');
});

test('检测有效锚点', async () => {
  const checker = new LinkChecker();
  const content = `请查看 [存在](#存在的锚点) 获取更多信息。`;
  
  checker.parseContent(content, 'test.md');
  checker.registerAnchors([
    { anchor: '存在的锚点', text: '存在的锚点', lineNumber: 1, headingLevel: 2 }
  ], 'test.md');
  
  const results = await checker.checkAllLinks();
  const okLinks = results.filter(r => r.status === 'ok');
  
  assert.strictEqual(okLinks.length, 1);
});

console.log('');
console.log(chalk.bold.yellow('⚙️  集成测试'));

test('端到端分析示例文档', () => {
  const docPath = path.join(__dirname, '../examples/product-docs.md');
  if (fs.existsSync(docPath)) {
    const headingParser = new HeadingParser();
    const headings = headingParser.parseFile(docPath);
    
    assert.ok(headings.length > 0);
    
    const chapterParser = new ChapterOwnerParser();
    const chapters = chapterParser.parseFile(docPath, headings);
    
    assert.ok(chapters.length > 0);
  }
});

console.log('');
console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
console.log(chalk.bold(`测试结果: ${chalk.green(passed + ' 通过')}, ${chalk.red(failed + ' 失败')}`));
console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════\n'));

process.exit(failed > 0 ? 1 : 0);
