const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_URL = 'http://localhost:3000';

async function testImport() {
  console.log('='.repeat(70));
  console.log('港口调度系统 - 导入测试');
  console.log('='.repeat(70));

  try {
    const healthRes = await fetch(`${SERVER_URL}/health`);
    const health = await healthRes.json();
    console.log('✓ 服务器状态:', health.status);
  } catch (e) {
    console.log('✗ 服务器未启动，请先运行 npm run dev');
    console.log('\n启动命令:');
    console.log('  1. npm install');
    console.log('  2. npm run dev');
    process.exit(1);
  }

  const schedulesPath = path.join(__dirname, '../sample-data/schedules.csv');
  const berthsPath = path.join(__dirname, '../sample-data/berths.json');
  const tidesPath = path.join(__dirname, '../sample-data/tides.csv');

  console.log('\n📂 测试数据文件:');
  console.log('  船期表:', schedulesPath);
  console.log('  泊位表:', berthsPath);
  console.log('  潮汐表:', tidesPath);

  console.log('\n🚀 开始导入测试...\n');

  const importResJson = execSync(`curl -s -X POST ${SERVER_URL}/api/import \
    -F "schedules=@${schedulesPath}" \
    -F "berths=@${berthsPath}" \
    -F "tides=@${tidesPath}"`).toString();
  const result = JSON.parse(importResJson);

  if (!result.success) {
    console.log('✗ 导入失败:', result.message);
    return;
  }

  const data = result.data;
  const batchId = data.batchId;

  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│  导入批次ID:'.padEnd(20) + batchId.padEnd(48) + '│');
  console.log('│  导入时间:'.padEnd(20) + new Date(data.importTime).toLocaleString('zh-CN').padEnd(48) + '│');
  console.log('├' + '─'.repeat(68) + '┤');
  console.log('│  总计处理:'.padEnd(20) + String(data.totalProcessed).padEnd(48) + '│');
  console.log('│  ✅ 正常项:'.padEnd(20) + String(data.normal.length).padEnd(48) + '│');
  console.log('│  ⚠️  待确认项:'.padEnd(20) + String(data.pending.length).padEnd(48) + '│');
  console.log('│  ❌ 失败项:'.padEnd(20) + String(data.failed.length).padEnd(48) + '│');
  console.log('│  🔄 重复项:'.padEnd(20) + String(data.duplicates).padEnd(48) + '│');
  console.log('└' + '─'.repeat(68) + '┘\n');

  if (data.normal.length > 0) {
    console.log('✅ 正常项详情:');
    data.normal.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.record.vesselName} (${item.record.vesselImo})`);
      console.log(`     泊位: ${item.record.berthId} | 吃水: ${item.record.draft}m`);
      if (item.record.confirmedByAgent) {
        console.log('     ✓ 船代已确认');
      }
      console.log();
    });
  }

  if (data.pending.length > 0) {
    console.log('⚠️  待确认项详情:');
    data.pending.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.record.vesselName} (${item.record.vesselImo})`);
      console.log(`     原因: ${item.errorReason}`);
      console.log(`     建议: ${item.suggestions?.join('; ')}`);
      console.log();
    });
  }

  if (data.failed.length > 0) {
    console.log('❌ 失败项详情:');
    data.failed.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.record.vesselName || '未知船舶'} (${item.record.vesselImo || 'N/A'})`);
      console.log(`     原始数据: ${JSON.stringify(item.originalData).substring(0, 100)}...`);
      console.log(`     失败原因: ${item.errorReason}`);
      console.log(`     处理建议: ${item.suggestions?.join('; ')}`);
      console.log();
    });
  }

  console.log('='.repeat(70));
  console.log('🔄 验证去重功能 - 再次提交相同数据...\n');

  const importResJson2 = execSync(`curl -s -X POST ${SERVER_URL}/api/import \
    -F "schedules=@${schedulesPath}" \
    -F "berths=@${berthsPath}" \
    -F "tides=@${tidesPath}"`).toString();
  const result2 = JSON.parse(importResJson2);

  if (result2.data.duplicates === data.totalProcessed) {
    console.log('✅ 去重功能验证成功 - 所有记录均被识别为重复');
  } else {
    console.log('⚠️  去重功能部分生效:', result2.data.duplicates, '/', data.totalProcessed);
  }

  console.log('\n🧹 清除批次数据以便重跑...');
  
  execSync(`curl -s -X DELETE ${SERVER_URL}/api/batches/${batchId}`).toString();

  console.log('✅ 批次已清除，可重新导入');

  console.log('\n' + '='.repeat(70));
  console.log('🎉 测试完成！');
  console.log('='.repeat(70));
  console.log('\n📝 复跑命令:');
  console.log('  npm test');
  console.log('\n🔍 查看所有批次:');
  console.log(`  curl ${SERVER_URL}/api/batches`);
  console.log('\n📋 查看批次详情:');
  console.log(`  curl ${SERVER_URL}/api/batches/${batchId}`);
}

testImport().catch(console.error);