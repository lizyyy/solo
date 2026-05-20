const fs = require('fs');
const path = require('path');

const APPOINTMENTS_CSV = path.join(__dirname, '../data/appointments.csv');
const INVENTORY_JSON = path.join(__dirname, '../data/inventory.json');
const RULES_JSON = path.join(__dirname, '../data/rules.json');

function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70) + '\n');
}

async function runTest() {
  printHeader('疫苗预约管理API - 本地测试说明');
  
  console.log('📁 准备测试数据:');
  console.log(`   预约文件: ${APPOINTMENTS_CSV}`);
  console.log(`   库存文件: ${INVENTORY_JSON}`);
  console.log(`   规则文件: ${RULES_JSON}\n`);
  
  console.log('🚀 启动服务命令:');
  console.log('   npm start');
  console.log('   或开发模式: npm run dev\n');
  
  console.log('📋 测试用例 - 使用 curl 命令:');
  console.log('─'.repeat(70));
  
  console.log('\n1️⃣  上传预约CSV + 库存JSON + 规则JSON (完整测试)');
  console.log(`   curl -X POST http://localhost:3000/api/appointments/upload \\`);
  console.log(`     -F "appointments=@${APPOINTMENTS_CSV}" \\`);
  console.log(`     -F "inventory=@${INVENTORY_JSON}" \\`);
  console.log(`     -F "rules=@${RULES_JSON}"`);
  
  console.log('\n2️⃣  仅上传预约CSV');
  console.log(`   curl -X POST http://localhost:3000/api/appointments/upload \\`);
  console.log(`     -F "appointments=@${APPOINTMENTS_CSV}"`);
  
  console.log('\n3️⃣  查询疫苗库存');
  console.log('   curl http://localhost:3000/api/appointments/inventory');
  
  console.log('\n4️⃣  查询禁忌规则');
  console.log('   curl http://localhost:3000/api/appointments/rules');
  
  console.log('\n5️⃣  健康检查');
  console.log('   curl http://localhost:3000/health');
  
  console.log('\n' + '─'.repeat(70));
  console.log('\n🎯 预期测试结果分析:');
  console.log('');
  console.log('✅ 正常通过 (success):');
  console.log('   - 张三 (MMR麻腮风): 无禁忌，库存充足');
  console.log('   - 王五 (HBV乙肝): 无禁忌，库存充足');
  console.log('   - 周九 (BCG卡介苗): 无禁忌，库存充足');
  console.log('   - 冯十二 (MMR麻腮风): 无禁忌，库存充足');
  
  console.log('\n⏳ 缺苗候补 (waitlist):');
  console.log('   - 李四 (DPT百白破): 库存为0，但只有鸡蛋过敏(中风险)');
  console.log('   - 孙八 (DPT百白破): 缺苗 + 改签（首次改签允许）');
  
  console.log('\n⚠️  待确认 (needs_confirmation):');
  console.log('   - 钱七 (POLIO脊灰): 有发热症状，需要电话确认');
  
  console.log('\n❌ 失败 (failed):');
  console.log('   - 赵六 (MMR麻腮风): 免疫缺陷(高风险禁忌)');
  console.log('   - 吴十 (MMR麻腮风): 重复改签检测失败');
  console.log('   - 郑十一 (FLU流感): 严重过敏史(高风险禁忌)');
  
  console.log('\n' + '═'.repeat(70));
  console.log('💡 批次去重测试提示:');
  console.log('   重复执行第1条curl命令，将提示"该批文件已处理过"');
  console.log('   并返回历史处理结果，不会重复处理数据');
  console.log('═'.repeat(70) + '\n');
}

runTest().catch(console.error);
