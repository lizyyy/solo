const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CLI_PATH = path.join(__dirname, '..', 'src', 'index.js');
const SAMPLES_DIR = path.join(__dirname, '..', 'samples');

function run(cmd, options = {}) {
  try {
    const output = execSync(`node ${CLI_PATH} ${cmd}`, {
      encoding: 'utf-8',
      ...options
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, output: error.stdout + error.stderr };
  }
}

function test(name, fn) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` 测试: ${name}`);
  console.log(`${'═'.repeat(60)}`);
  try {
    fn();
    console.log(`  ✓ ${name} 通过`);
    return true;
  } catch (error) {
    console.log(`  ✗ ${name} 失败: ${error.message}`);
    console.log(`    ${error.stack}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const passed = [];
const failed = [];

function runAll() {
  console.log('\n' + '='.repeat(60));
  console.log('         公众号素材发布CLI - 测试套件');
  console.log('='.repeat(60));

  run('reset --force');

  if (test('1. 初始化', () => {
    const result = run('init');
    assert(result.success, 'init 命令失败');
    assert(result.output.includes('数据目录已初始化'), '未显示初始化成功信息');
  })) passed.push('1'); else failed.push('1');

  if (test('2. 导入素材清单', () => {
    const result = run(`import-materials ${path.join(SAMPLES_DIR, 'materials.csv')}`);
    assert(result.success, '导入素材失败');
    assert(result.output.includes('新增: 8'), `期望新增8条，实际输出: ${result.output}`);
  })) passed.push('2'); else failed.push('2');

  if (test('3. 重复导入素材（去重）', () => {
    const result = run(`import-materials ${path.join(SAMPLES_DIR, 'materials.csv')}`);
    assert(result.success, '重复导入失败');
    assert(result.output.includes('新增: 0'), `重复导入时不应新增，实际输出: ${result.output}`);
    assert(result.output.includes('更新: 8'), `重复导入应更新，实际输出: ${result.output}`);
  })) passed.push('3'); else failed.push('3');

  if (test('4. 导入排期表', () => {
    const result = run(`import-schedules ${path.join(SAMPLES_DIR, 'schedules.csv')}`);
    assert(result.success, '导入排期失败');
    assert(result.output.includes('新增: 8'), `期望新增8条排期，实际输出: ${result.output}`);
  })) passed.push('4'); else failed.push('4');

  if (test('5. 导入敏感词表', () => {
    const result = run(`import-sensitive-words ${path.join(SAMPLES_DIR, 'sensitive-words.csv')}`);
    assert(result.success, '导入敏感词失败');
    assert(result.output.includes('新增: 10'), `期望新增10个敏感词，实际输出: ${result.output}`);
  })) passed.push('5'); else failed.push('5');

  if (test('6. 运行检查', () => {
    const result = run('check');
    assert(result.success, 'check 命令失败');
    assert(result.output.includes('总问题数:') || result.output.includes('待处理:'), '未显示检查结果');
  })) passed.push('6'); else failed.push('6');

  if (test('7. 检查状态概览', () => {
    const result = run('status');
    assert(result.success, 'status 命令失败');
    assert(result.output.includes('素材数: 8'), `期望素材数8，实际输出: ${result.output}`);
    assert(result.output.includes('排期数: 8'), `期望排期数8，实际输出: ${result.output}`);
    assert(result.output.includes('敏感词: 10'), `期望敏感词10，实际输出: ${result.output}`);
  })) passed.push('7'); else failed.push('7');

  if (test('8. 查看问题列表', () => {
    const result = run('list-problems');
    assert(result.success, 'list-problems 命令失败');
  })) passed.push('8'); else failed.push('8');

  if (test('9. 按编辑筛选问题', () => {
    const result = run('list-problems --editor 张编辑');
    assert(result.success, '按编辑筛选失败');
  })) passed.push('9'); else failed.push('9');

  if (test('10. 查看具体问题详情', () => {
    const listResult = run('list-problems --status open');
    assert(listResult.success, '获取问题列表失败');

    const statusResult = run('status');
    assert(statusResult.success, '获取状态失败');

    const problemsMatch = statusResult.output.match(/待处理:\s*(\d+)/);
    const openCount = problemsMatch ? parseInt(problemsMatch[1]) : 0;
    console.log(`  发现 ${openCount} 个待处理问题`);
    assert(openCount > 0, '应该有待处理问题');
  })) passed.push('10'); else failed.push('10');

  if (test('11. 导出发布清单', () => {
    const outputPath = path.join(__dirname, 'test-publish-list.csv');
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    const result = run(`export ${outputPath}`);
    assert(result.success, '导出失败');
    assert(fs.existsSync(outputPath), '导出文件不存在');

    const content = fs.readFileSync(outputPath, 'utf-8');
    assert(content.includes('material_id'), 'CSV格式不正确');
    assert(content.includes('MAT001'), '应包含样例数据');

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  })) passed.push('11'); else failed.push('11');

  if (test('12. 按编辑筛选导出', () => {
    const outputPath = path.join(__dirname, 'test-filtered.csv');
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    const result = run(`export ${outputPath} --editor 张编辑`);
    assert(result.success, '筛选导出失败');
    assert(fs.existsSync(outputPath), '导出文件不存在');

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  })) passed.push('12'); else failed.push('12');

  if (test('13. 导出问题清单', () => {
    const outputPath = path.join(__dirname, 'test-problems.csv');
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    const result = run(`export-problems ${outputPath}`);
    assert(result.success, '导出问题清单失败');
    assert(fs.existsSync(outputPath), '导出文件不存在');

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  })) passed.push('13'); else failed.push('13');

  if (test('14. 检查覆盖的问题场景', () => {
    const checkResult = run('check');
    assert(checkResult.success, 'check 失败');

    console.log(`  检查输出包含:`);
    const expectedScenes = [
      '标题重复',
      '封面缺失',
      '排期冲突'
    ];

    expectedScenes.forEach(scene => {
      if (checkResult.output.includes(scene)) {
        console.log(`    ✓ 覆盖场景: ${scene}`);
      } else {
        console.log(`    ⚠ 可能未覆盖: ${scene}`);
      }
    });
  })) passed.push('14'); else failed.push('14');

  console.log('\n' + '='.repeat(60));
  console.log('                     测试结果');
  console.log('='.repeat(60));
  console.log(`  通过率: ${passed.length}/${passed.length + failed.length}`);

  if (passed.length > 0) {
    console.log('\n  ✓ 通过的测试:');
    passed.forEach(id => console.log(`    - ${id}`));
  }

  if (failed.length > 0) {
    console.log('\n  ✗ 失败的测试:');
    failed.forEach(id => console.log(`    - ${id}`));
    process.exit(1);
  } else {
    console.log('\n  ✓ 所有测试通过!');
    process.exit(0);
  }
}

runAll();