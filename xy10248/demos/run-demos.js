const runSmoothFlow = require('./smooth-flow');
const runInterceptionFlow = require('./interception-flow');
const { logSection } = require('./helpers');

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        自助洗衣店故障赔付 API 演示脚本                   ║');
  console.log('║        Laundry Claim API Demo                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  console.log('请确保 API 服务已启动: npm start');
  console.log('服务地址: http://localhost:3000');
  console.log('\n按 Enter 开始演示...\n');
  
  try {
    logSection('开始演示样例一：顺利赔付流程');
    await runSmoothFlow();
    
    console.log('\n\n');
    logSection('开始演示样例二：拦截与待复核流程');
    await runInterceptionFlow();
    
    console.log('\n\n');
    logSection('🎉 所有演示完成');
    console.log('\n📋 总结：');
    console.log('   样例一展示了：');
    console.log('   ✅ 订单-设备日志-赔付三者一致性');
    console.log('   ✅ 设备故障自动匹配');
    console.log('   ✅ 幂等性保证（重复请求不乱状态');
    console.log('   ✅ 赔付-优惠券关联一致性');
    console.log('');
    console.log('   样例二展示了：');
    console.log('   ⚠️ 无设备日志 → 待复核触发');
    console.log('   ⚠️ 同一订单重复申请拦截');
    console.log('   ⚠️ 赔付金额修正');
    console.log('   ⚠️ 用户撤回申请');
    console.log('   ⚠️ 订单状态非法转换拦截');
    console.log('');
    console.log('\n📊 导出数据: GET http://localhost:3000/api/stats/export');
    console.log('📊 查看统计: GET http://localhost:3000/api/stats');
    console.log('🔄 重置数据: POST http://localhost:3000/api/stats/reset');
    console.log('');
    
  } catch (error) {
    console.error('演示出错:', error);
  }
}

main();
