const path = require('path');
const fs = require('fs');
const { normalizePath, resolveAssetPath, checkFileExists } = require('./core/path-resolver');
const { parseHTML } = require('./parsers/html-parser');
const { parseCSS } = require('./parsers/css-parser');
const { scanDirectory } = require('./core/scanner');
const { exportJSON } = require('./reporters/json-reporter');
const { exportHTML } = require('./reporters/html-reporter');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

test('路径归一化 - 处理 ../', () => {
  const result = normalizePath('css/../images/test.png');
  assert(result === 'images/test.png', `期望 'images/test.png'，实际 '${result}'`);
});

test('路径归一化 - 处理 ./', () => {
  const result = normalizePath('./images/./test.png');
  assert(result === 'images/test.png', `期望 'images/test.png'，实际 '${result}'`);
});

test('路径归一化 - 处理 //', () => {
  const result = normalizePath('images//test.png');
  assert(result === 'images/test.png', `期望 'images/test.png'，实际 '${result}'`);
});

test('路径解析 - 相对路径', () => {
  const result = resolveAssetPath('../images/test.png', 'css/style.css', '/base');
  assert(result.relativePath === 'images/test.png', `期望 'images/test.png'，实际 '${result.relativePath}'`);
});

test('路径解析 - 绝对路径', () => {
  const result = resolveAssetPath('/images/test.png', 'css/style.css', '/base');
  assert(result.relativePath === 'images/test.png', `期望 'images/test.png'，实际 '${result.relativePath}'`);
});

test('文件存在检测 - 存在的文件', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'js', 'main.js');
  const result = checkFileExists(testFile);
  assert(result.exists === true, `期望 true，实际 ${result.exists}`);
});

test('文件存在检测 - 不存在的文件', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'not-exist.txt');
  const result = checkFileExists(testFile);
  assert(result.exists === false, `期望 false，实际 ${result.exists}`);
});

test('HTML解析 - 提取img src', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'index.html');
  const baseDir = path.dirname(path.dirname(testFile));
  const assets = parseHTML(testFile, baseDir);
  const imgAssets = assets.filter(a => a.pattern === 'imgSrc');
  assert(imgAssets.length >= 3, `期望至少3个img src，实际 ${imgAssets.length}`);
});

test('HTML解析 - 提取link href', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'index.html');
  const baseDir = path.dirname(path.dirname(testFile));
  const assets = parseHTML(testFile, baseDir);
  const linkAssets = assets.filter(a => a.pattern === 'linkHref');
  assert(linkAssets.length >= 2, `期望至少2个link href，实际 ${linkAssets.length}`);
});

test('HTML解析 - 提取script src', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'index.html');
  const baseDir = path.dirname(path.dirname(testFile));
  const assets = parseHTML(testFile, baseDir);
  const scriptAssets = assets.filter(a => a.pattern === 'scriptSrc');
  assert(scriptAssets.length >= 2, `期望至少2个script src，实际 ${scriptAssets.length}`);
});

test('CSS解析 - 提取url()', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'css', 'style.css');
  const baseDir = path.dirname(path.dirname(path.dirname(testFile)));
  const assets = parseCSS(testFile, baseDir);
  const urlAssets = assets.filter(a => a.pattern === 'url');
  assert(urlAssets.length >= 4, `期望至少4个url()，实际 ${urlAssets.length}`);
});

test('完整扫描 - 目录扫描', () => {
  const testDir = path.join(__dirname, '..', 'test', 'fixtures', 'build');
  const results = scanDirectory(testDir);
  assert(results.summary.totalFilesScanned >= 1, `期望至少扫描1个文件，实际 ${results.summary.totalFilesScanned}`);
  assert(results.summary.totalAssetsFound >= 5, `期望至少发现5个资源，实际 ${results.summary.totalAssetsFound}`);
  assert(results.missingAssets.length > 0, `期望检测到缺失的资源`);
});

test('报告导出 - JSON导出', () => {
  const testDir = path.join(__dirname, '..', 'test', 'fixtures', 'build');
  const results = scanDirectory(testDir);
  const outputPath = path.join(__dirname, '..', 'test', 'reports', 'test-report.json');
  exportJSON(results, outputPath);
  assert(fs.existsSync(outputPath), 'JSON报告文件应该存在');
});

test('报告导出 - HTML导出', () => {
  const testDir = path.join(__dirname, '..', 'test', 'fixtures', 'build');
  const results = scanDirectory(testDir);
  const outputPath = path.join(__dirname, '..', 'test', 'reports', 'test-report.html');
  exportHTML(results, outputPath);
  assert(fs.existsSync(outputPath), 'HTML报告文件应该存在');
});

test('边界情况 - 忽略外部URL (http)', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'index.html');
  const baseDir = path.dirname(path.dirname(testFile));
  const assets = parseHTML(testFile, baseDir);
  const httpAssets = assets.filter(a => a.url.startsWith('http://'));
  assert(httpAssets.length === 0, `不应该包含http://开头的URL，实际 ${httpAssets.length} 个`);
});

test('边界情况 - 忽略外部URL (https)', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'index.html');
  const baseDir = path.dirname(path.dirname(testFile));
  const assets = parseHTML(testFile, baseDir);
  const httpsAssets = assets.filter(a => a.url.startsWith('https://'));
  assert(httpsAssets.length === 0, `不应该包含https://开头的URL，实际 ${httpsAssets.length} 个`);
});

test('边界情况 - 忽略data URI', () => {
  const testFile = path.join(__dirname, '..', 'test', 'fixtures', 'build', 'index.html');
  const baseDir = path.dirname(path.dirname(testFile));
  const assets = parseHTML(testFile, baseDir);
  const dataAssets = assets.filter(a => a.url.startsWith('data:'));
  assert(dataAssets.length === 0, `不应该包含data:开头的URI，实际 ${dataAssets.length} 个`);
});

test('结果包含原始位置和原因', () => {
  const testDir = path.join(__dirname, '..', 'test', 'fixtures', 'build');
  const results = scanDirectory(testDir);
  for (const asset of results.missingAssets) {
    assert(asset.occurrences.length > 0, '缺失资源应该有引用位置记录');
    for (const occ of asset.occurrences) {
      assert(occ.line > 0, `应该有行号，实际 ${occ.line}`);
      assert(occ.column > 0, `应该有列号，实际 ${occ.column}`);
      assert(occ.filePath, `应该有文件路径，实际 ${occ.filePath}`);
      assert(occ.context, `应该有上下文代码，实际 ${occ.context}`);
    }
  }
});

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 asset-404-scanner 自测程序');
  console.log('='.repeat(70));
  console.log();

  for (const { name, fn } of tests) {
    process.stdout.write(`  测试: ${name} `);
    try {
      await fn();
      console.log('✅ 通过');
      passed++;
    } catch (error) {
      console.log('❌ 失败');
      console.log(`     错误: ${error.message}`);
      failed++;
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log(`  📊 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(70));
  console.log();

  if (failed > 0) {
    console.log('❌ 部分测试失败，请检查代码是否正确实现');
    process.exit(1);
  } else {
    console.log('✅ 所有测试通过！工具功能正常，可以放心使用。');
    console.log();
    console.log('💡 提示: 现在可以运行以下命令测试完整功能:');
    console.log('   node bin/asset-scan.js --dir test/fixtures/build --report test/reports --html --json');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('自测运行出错:', err);
  process.exit(1);
});
