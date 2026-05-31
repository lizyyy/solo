#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_IMAGES_DIR = path.join(PROJECT_ROOT, 'test-images');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const CLI_PATH = path.join(PROJECT_ROOT, 'src/cli.js');

function log(section, message) {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  console.log(`[${timestamp}] [${section}] ${message}`);
}

function run(cmd, cwd = TEST_IMAGES_DIR, input = null) {
  log('EXEC', `${cwd} $ ${cmd}`);
  try {
    const options = {
      cwd,
      encoding: 'utf8',
      stdio: input ? ['pipe', 'pipe', 'pipe'] : 'inherit'
    };
    if (input) {
      const result = execSync(cmd, { ...options, input });
      console.log(result);
      return result;
    } else {
      return execSync(cmd, options);
    }
  } catch (e) {
    if (e.stdout) console.log(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    throw e;
  }
}

function cleanupData() {
  log('CLEANUP', '清除历史数据...');
  const dataDirs = [
    DATA_DIR,
    path.join(TEST_IMAGES_DIR, 'data')
  ];
  dataDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

function resetTestImages() {
  log('CLEANUP', '重置测试图片...');
  const expectedFiles = [
    'IMG_0001.jpg', 'IMG_0002.jpg', 'IMG_0003.png',
    'IMG_0004.gif', 'IMG_0005.webp', 'IMG_0006.jpg',
    'duplicate_target.jpg', 'already_exists.jpg',
    'same_name.jpg', 'circular_a.jpg', 'circular_b.jpg'
  ];

  const currentFiles = fs.readdirSync(TEST_IMAGES_DIR).filter(f => !f.startsWith('.'));

  currentFiles.forEach(f => {
    if (!expectedFiles.includes(f)) {
      const fullPath = path.join(TEST_IMAGES_DIR, f);
      log('CLEANUP', `删除多余: ${f}`);
      if (fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
    }
  });

  expectedFiles.forEach(f => {
    const p = path.join(TEST_IMAGES_DIR, f);
    if (!fs.existsSync(p)) {
      log('CLEANUP', `重新创建: ${f}`);
      fs.closeSync(fs.openSync(p, 'w'));
    }
  });

  log('CLEANUP', `测试目录现有文件: ${fs.readdirSync(TEST_IMAGES_DIR).filter(f => !f.startsWith('.')).join(', ')}`);
}

function assertFileExists(filename, shouldExist = true) {
  const p = path.join(TEST_IMAGES_DIR, filename);
  const exists = fs.existsSync(p);
  if (exists !== shouldExist) {
    throw new Error(`断言失败: ${filename} 应该${shouldExist ? '存在' : '不存在'}，但实际${exists ? '存在' : '不存在'}`);
  }
  log('ASSERT', `✅ ${filename} ${shouldExist ? '存在' : '不存在'}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('批量图片重命名 - 集成测试');
  console.log('='.repeat(80) + '\n');

  cleanupData();
  resetTestImages();

  try {
    log('TEST', '=== 测试1: 帮助命令 ===');
    run(`node ${CLI_PATH} help`, PROJECT_ROOT);

    log('TEST', '=== 测试2: 状态命令（无数据） ===');
    run(`node ${CLI_PATH} status`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试3: 导入完整边界用例 JSON ===');
    run(`node ${CLI_PATH} import ${path.join(PROJECT_ROOT, 'tests/change-order-full.json')}`, TEST_IMAGES_DIR, 'yes\n');

    log('TEST', '=== 测试4: 状态命令（有数据） ===');
    run(`node ${CLI_PATH} status`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试5: 复核 - 检测各种异常 ===');
    run(`node ${CLI_PATH} review`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试6: 试运行（dry-run） ===');
    run(`node ${CLI_PATH} run --dry-run --operator=测试员`, TEST_IMAGES_DIR, 'yes\n');

    log('TEST', '=== 测试7: 导出账本（JSON+MD） ===');
    run(`node ${CLI_PATH} export json`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试8: 清除数据，准备简单用例测试 ===');
    cleanupData();
    resetTestImages();

    log('TEST', '=== 测试9: 导入简单 CSV ===');
    run(`node ${CLI_PATH} import ${path.join(PROJECT_ROOT, 'tests/change-order-simple.csv')}`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试10: 复核简单用例 ===');
    run(`node ${CLI_PATH} review`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试11: 正式执行重命名 ===');
    run(`node ${CLI_PATH} run --operator=张三`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试12: 验证重命名结果 ===');
    assertFileExists('IMG_0001.jpg', false);
    assertFileExists('产品A_正面.jpg', true);
    assertFileExists('IMG_0002.jpg', false);
    assertFileExists('产品A_背面.jpg', true);
    assertFileExists('IMG_0003.png', false);
    assertFileExists('产品B_正面.png', true);

    log('TEST', '=== 测试13: 重复执行 - 幂等性检测 ===');
    run(`node ${CLI_PATH} run --operator=张三`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试14: 查看运行账本列表 ===');
    run(`node ${CLI_PATH} history`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试15: 查看账本详情 ===');
    const ledgerPath = path.join(TEST_IMAGES_DIR, 'data', 'ledger.json');
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    if (ledger.runs.length > 0) {
      run(`node ${CLI_PATH} history ${ledger.runs[0].id}`, TEST_IMAGES_DIR);
    }

    log('TEST', '=== 测试16: 回滚操作 ===');
    if (ledger.runs.length > 0) {
      run(`node ${CLI_PATH} rollback ${ledger.runs[0].id}`, TEST_IMAGES_DIR, 'yes\n');

      log('TEST', '=== 测试17: 验证回滚结果 ===');
      assertFileExists('产品A_正面.jpg', false);
      assertFileExists('IMG_0001.jpg', true);
      assertFileExists('产品A_背面.jpg', false);
      assertFileExists('IMG_0002.jpg', true);
      assertFileExists('产品B_正面.png', false);
      assertFileExists('IMG_0003.png', true);
    }

    log('TEST', '=== 测试18: 重复回滚检测 ===');
    if (ledger.runs.length > 0) {
      run(`node ${CLI_PATH} rollback ${ledger.runs[0].id}`, TEST_IMAGES_DIR);
    }

    log('TEST', '=== 测试19: 导出最终账本 ===');
    run(`node ${CLI_PATH} export md`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试20: 再次执行，测试重复回滚后重新执行 ===');
    run(`node ${CLI_PATH} run --operator=李四`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试21: 导出完整账本 ===');
    run(`node ${CLI_PATH} export json`, TEST_IMAGES_DIR);

    log('TEST', '=== 测试22: 查看最终状态 ===');
    run(`node ${CLI_PATH} status`, TEST_IMAGES_DIR);
    run(`node ${CLI_PATH} history`, TEST_IMAGES_DIR);

    const testDataDir = path.join(TEST_IMAGES_DIR, 'data');
    console.log('\n' + '='.repeat(80));
    console.log('✅ 所有测试通过！');
    console.log('='.repeat(80));
    console.log('\n测试结果:');
    console.log(`  测试目录: ${TEST_IMAGES_DIR}`);
    console.log(`  数据目录: ${testDataDir}`);
    console.log(`  导出文件: ${fs.readdirSync(testDataDir).filter(f => f.startsWith('ledger-')).join(', ')}`);
    console.log('\n下一步: 查看 test-images/data/ 目录下的 ledger-*.md 文件了解完整运行账本');

  } catch (e) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ 测试失败:', e.message);
    console.error('='.repeat(80));
    console.error(e.stack);

    console.log('\n当前测试目录文件:');
    console.log(fs.readdirSync(TEST_IMAGES_DIR).filter(f => !f.startsWith('.')).join(', '));

    const coPath = path.join(TEST_IMAGES_DIR, 'data', 'change-order.json');
    if (fs.existsSync(coPath)) {
      console.log('\n变更单状态:');
      const co = JSON.parse(fs.readFileSync(coPath, 'utf8'));
      console.log(`  ID: ${co.id}, 状态: ${co.status}`);
      co.items.forEach(item => {
        console.log(`  #${item.seq}: ${item.originalName} -> ${item.newName} [${item.status}]`);
      });
    }

    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('未处理的异常:', e);
  process.exit(1);
});
