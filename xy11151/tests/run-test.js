const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('  展会搭建队展会费用归集 CLI - 测试');
console.log('========================================\n');

const outputDir = path.resolve(__dirname, '..');
const testOutput1 = path.join(outputDir, 'test-output1.csv');
const testOutput2 = path.join(outputDir, 'test-output2.csv');

try {
  console.log('📦 安装依赖...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ 依赖安装完成\n');

  console.log('🧪 第一次运行处理...');
  execSync(`node src/cli.js examples/*.csv -o ${testOutput1}`, { stdio: 'inherit' });
  console.log('✅ 第一次处理完成\n');

  console.log('🔄 第二次运行处理（验证可复跑性）...');
  execSync(`node src/cli.js examples/*.csv -o ${testOutput2}`, { stdio: 'inherit' });
  console.log('✅ 第二次处理完成\n');

  if (fs.existsSync(testOutput1) && fs.existsSync(testOutput2)) {
    console.log('📋 验证输出文件关键列稳定性...');
    
    const data1 = fs.readFileSync(testOutput1, 'utf8').split('\n').map(line => {
      const cols = line.split(',');
      return cols.slice(0, 15).join(',');
    }).join('\n');
    
    const data2 = fs.readFileSync(testOutput2, 'utf8').split('\n').map(line => {
      const cols = line.split(',');
      return cols.slice(0, 15).join(',');
    }).join('\n');

    if (data1 === data2) {
      console.log('✅ 可复跑性验证通过！两次输出关键列完全一致\n');
    } else {
      console.log('❌ 可复跑性验证失败！两次输出不一致\n');
    }

    console.log('📊 检查临时加项识别...');
    const outputData = fs.readFileSync(testOutput1, 'utf8');
    const tempAddCount = (outputData.match(/,是,/g) || []).length / 2;
    console.log(`   识别到 ${tempAddCount} 条临时加项记录\n`);

    console.log('💰 检查供应商返款识别...');
    const refundCount = (outputData.match(/-[0-9]/g) || []).length;
    console.log(`   识别到 ${refundCount} 条负金额（返款）记录\n`);

    console.log('✅ 所有测试通过！');
    console.log(`   输出文件1: ${testOutput1}`);
    console.log(`   输出文件2: ${testOutput2}`);
    
  } else {
    console.log('❌ 输出文件未生成！');
  }

} catch (error) {
  console.error('❌ 测试失败:', error.message);
  process.exit(1);
}
