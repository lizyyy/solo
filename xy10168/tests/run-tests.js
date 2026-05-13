#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');

function run(cmd, env = {}) {
  console.log(`\n$ ${cmd}`);
  try {
    const output = execSync(cmd, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log(output);
    return { success: true, output };
  } catch (error) {
    console.error(`命令失败: ${cmd}`);
    console.error(error.stdout?.toString() || '');
    console.error(error.stderr?.toString() || '');
    return { success: false, error };
  }
}

function cleanup() {
  console.log('\n🧹 清理历史数据...');
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(REPORTS_DIR)) {
    fs.rmSync(REPORTS_DIR, { recursive: true, force: true });
  }
}

function assertFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  }
  console.error(`❌ 文件不存在: ${filePath}`);
  return false;
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('🧪 冷库温区盘点 CLI - 自动验收测试');
  console.log('='.repeat(60));
  
  cleanup();
  
  const steps = [
    {
      name: '查看 CLI 帮助',
      cmd: 'node bin/index.js --help',
      check: (out) => out.output.includes('import-inventory') && out.output.includes('analyze')
    },
    {
      name: '导入初始库存清单',
      cmd: 'node bin/index.js import-inventory samples/inventory.csv',
      check: (out) => out.output.includes('成功: 5')
    },
    {
      name: '导入温度记录',
      cmd: 'node bin/index.js import-temperature samples/temperature.csv',
      check: (out) => out.output.includes('成功: 10')
    },
    {
      name: '导入人工盘点数据',
      cmd: 'node bin/index.js import-count samples/manual_count.csv',
      check: (out) => out.output.includes('成功: 4')
    },
    {
      name: '执行综合分析（第1次）',
      cmd: 'node bin/index.js analyze',
      check: (out) => out.output.includes('待处理 (Open):')
    },
    {
      name: '执行综合分析（第2次，验证去重）',
      cmd: 'node bin/index.js analyze',
      check: (out) => {
        const match = out.output.match(/新增: (\d+)/);
        const newCount = match ? parseInt(match[1]) : -1;
        console.log(`  📊 本次新增异常: ${newCount} (期望: 0, 表示去重生效)`);
        return newCount === 0;
      }
    },
    {
      name: '查看异常记录',
      cmd: 'node bin/index.js exceptions -l 3',
      check: (out) => out.output.includes('批号') && out.output.includes('严重度')
    },
    {
      name: '查看导入历史',
      cmd: 'node bin/index.js import-history',
      check: (out) => out.output.includes('inventory.csv')
    },
    {
      name: '生成日报',
      cmd: 'node bin/index.js report',
      check: (out) => out.output.includes('报告生成完成')
    },
    {
      name: '验证报告文件生成',
      cmd: 'echo "检查文件..."',
      check: () => {
        const today = new Date().toISOString().split('T')[0];
        const jsonReport = path.join(REPORTS_DIR, `daily-report-${today}.json`);
        const xlsxReport = path.join(REPORTS_DIR, `daily-report-${today}.xlsx`);
        const ok1 = assertFileExists(jsonReport, 'JSON日报');
        const ok2 = assertFileExists(xlsxReport, 'Excel日报');
        return ok1 && ok2;
      }
    },
    {
      name: '验证数据文件',
      cmd: 'echo "检查数据文件..."',
      check: () => {
        const inv = path.join(DATA_DIR, 'inventory.json');
        const temp = path.join(DATA_DIR, 'temperature.json');
        const exc = path.join(DATA_DIR, 'exceptions.json');
        const hist = path.join(DATA_DIR, 'import-history.jsonl');
        
        let allOk = true;
        allOk = assertFileExists(inv, '库存数据') && allOk;
        allOk = assertFileExists(temp, '温度数据') && allOk;
        allOk = assertFileExists(exc, '异常数据') && allOk;
        allOk = assertFileExists(hist, '导入历史') && allOk;
        return allOk;
      }
    },
    {
      name: '测试可重复导入 - 更新库存',
      cmd: 'node bin/index.js import-inventory samples/inventory-update.csv',
      check: (out) => out.output.includes('成功: 1') && out.output.includes('更新: 2')
    },
    {
      name: '再次分析 - 验证数据变化产生新异常',
      cmd: 'node bin/index.js analyze',
      check: (out) => {
        const match = out.output.match(/新增: (\d+)/);
        const newCount = match ? parseInt(match[1]) : -1;
        console.log(`  📊 数据更新后新增异常: ${newCount} (期望: > 0, 表示能检测到变化)`);
        return newCount > 0;
      }
    },
    {
      name: '测试重置异常',
      cmd: 'node bin/index.js reset -t exceptions -y',
      check: (out) => out.output.includes('已重置异常台账')
    },
    {
      name: '再次分析 - 验证重置后重新生成',
      cmd: 'node bin/index.js analyze',
      check: (out) => {
        const match = out.output.match(/新增: (\d+)/);
        const newCount = match ? parseInt(match[1]) : -1;
        console.log(`  📊 重置后新增异常: ${newCount} (期望: > 0)`);
        return newCount > 0;
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`步骤 ${i + 1}/${steps.length}: ${step.name}`);
    console.log('='.repeat(60));
    
    const result = run(step.cmd);
    
    if (result.success && step.check(result)) {
      console.log(chalkGreen(`✅ PASS: ${step.name}`));
      passed++;
    } else {
      console.log(chalkRed(`❌ FAIL: ${step.name}`));
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 测试结果汇总');
  console.log('='.repeat(60));
  console.log(`  总计: ${steps.length}`);
  console.log(chalkGreen(`  通过: ${passed}`));
  console.log(chalkRed(`  失败: ${failed}`));
  
  if (failed > 0) {
    console.log('\n❌ 部分测试失败，请检查输出');
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试通过！');
    console.log(chalkGreen('\n   核心功能验证:'));
    console.log('   ✅ 导入功能（库存/温度/盘点）');
    console.log('   ✅ 可重复导入（upsert 机制）');
    console.log('   ✅ 分析功能（批号/温度/盘点）');
    console.log('   ✅ 异常去重（重复分析不追加）');
    console.log('   ✅ 日报导出（JSON + Excel）');
    console.log('   ✅ 数据重置功能');
    process.exit(0);
  }
}

function chalkGreen(text) {
  return `\x1b[32m${text}\x1b[0m`;
}

function chalkRed(text) {
  return `\x1b[31m${text}\x1b[0m`;
}

runAllTests();
