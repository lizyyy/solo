import { initDatabaseConnection, initDatabaseTables } from './database';
import tireService from './services/tireService';
import vehicleService from './services/vehicleService';
import { getDb } from './database';

console.log('🧪 开始验证轮胎业务规则...\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // 初始化数据库
  initDatabaseConnection();
  initDatabaseTables();

  // 清理测试数据
  const db = getDb();
  db.exec('DELETE FROM tire_costs');
  db.exec('DELETE FROM tire_events');
  db.exec('DELETE FROM tires');
  db.exec('DELETE FROM vehicles');

  // 创建测试车辆
  const vehicle = vehicleService.createVehicle({
    plate_number: 'TEST001',
    model: '测试车型',
    tire_count: 4,
  });
  console.log('✅ 测试车辆已创建');

  // 创建测试轮胎
  const tire = tireService.createTire({
    serial_number: 'TEST-TIRE-001',
    brand: '测试品牌',
    model: '测试型号',
    size: '12R22.5',
  });
  console.log('✅ 测试轮胎已创建');

  // ========== 测试 1: 已装车轮胎不能直接检测 ==========
  console.log('\n📋 测试 1: 已装车轮胎不能直接检测');
  try {
    // 先装车
    tireService.installTire(tire.id, vehicle.id, '测试员', '测试装车');
    console.log('   轮胎已装车');

    // 尝试直接检测
    tireService.inspectTire(tire.id, 'passed', '测试检测', 50, '测试员');
    console.log('   ❌ 失败：竟然允许已装车轮胎直接检测！');
    failed++;
  } catch (error: any) {
    if (error.message.includes('已装车的轮胎不能直接检测')) {
      console.log('   ✅ 通过：正确拒绝已装车轮胎直接检测');
      passed++;
    } else {
      console.log(`   ❌ 失败：${error.message}`);
      failed++;
    }
  }

  // ========== 测试 2: 拆下后可以检测 ==========
  console.log('\n📋 测试 2: 拆下后可以检测');
  try {
    tireService.removeTire(tire.id, '测试拆下原因', '测试员', '测试备注');
    console.log('   轮胎已拆下');
    
    const tireAfterRemove = tireService.getTireById(tire.id)!;
    if (tireAfterRemove.current_vehicle_id === null) {
      console.log('   ✅ 通过：拆下后 current_vehicle_id 已清空');
      passed++;
    } else {
      console.log('   ❌ 失败：拆下后 current_vehicle_id 未清空');
      failed++;
    }

    tireService.inspectTire(tire.id, 'passed', '测试检测通过', 50, '测试员');
    console.log('   ✅ 通过：拆下后可以正常检测');
    passed++;
  } catch (error: any) {
    console.log(`   ❌ 失败：${error.message}`);
    failed++;
  }

  // ========== 测试 3: 送翻新时清空 current_vehicle_id ==========
  console.log('\n📋 测试 3: 送翻新时确保 current_vehicle_id 为空');
  try {
    // 创建另一个轮胎测试送翻新的车辆ID清理
    const tire2 = tireService.createTire({
      serial_number: 'TEST-TIRE-002',
      brand: '测试品牌',
      model: '测试型号',
      size: '12R22.5',
    });
    
    tireService.installTire(tire2.id, vehicle.id, '测试员', '测试装车');
    console.log('   轮胎2已装车');
    
    tireService.removeTire(tire2.id, '磨损严重', '测试员', '测试备注');
    console.log('   轮胎2已拆下');
    
    tireService.inspectTire(tire2.id, 'failed', '需要翻新', 50, '测试员');
    console.log('   轮胎2检测未通过');
    
    // 送翻新
    tireService.sendToRetread(tire2.id, 800, '修理厂', '测试翻新');
    console.log('   轮胎2已送翻新');
    
    const tireAfterRetread = tireService.getTireById(tire2.id)!;
    
    if (tireAfterRetread.current_status === 'retreading') {
      console.log('   ✅ 通过：状态正确更新为翻新中');
      passed++;
    } else {
      console.log(`   ❌ 失败：状态应为 retreading，实际为 ${tireAfterRetread.current_status}`);
      failed++;
    }
    
    if (tireAfterRetread.current_vehicle_id === null) {
      console.log('   ✅ 通过：送翻新后 current_vehicle_id 已清空');
      passed++;
    } else {
      console.log('   ❌ 失败：送翻新后 current_vehicle_id 未清空');
      failed++;
    }
  } catch (error: any) {
    console.log(`   ❌ 失败：${error.message}`);
    failed++;
  }

  // ========== 测试 4: 重复检测幂等性（防重复计费） ==========
  console.log('\n📋 测试 4: 重复检测幂等性（防重复计费）');
  try {
    const tire3 = tireService.createTire({
      serial_number: 'TEST-TIRE-003',
      brand: '测试品牌',
      model: '测试型号',
      size: '12R22.5',
    });

    // 第一次检测
    tireService.inspectTire(tire3.id, 'passed', '重复检测测试', 50, '测试员');
    console.log('   第一次检测成功');
    
    const costsBefore = db.prepare('SELECT COUNT(*) as count FROM tire_costs WHERE tire_id = ?').get(tire3.id) as any;
    console.log(`   当前费用记录数: ${costsBefore.count}`);

    // 尝试重复检测（5分钟内相同参数）
    tireService.inspectTire(tire3.id, 'passed', '重复检测测试', 50, '测试员');
    console.log('   ❌ 失败：竟然允许重复检测！');
    failed++;
  } catch (error: any) {
    if (error.message.includes('请勿重复提交')) {
      console.log('   ✅ 通过：正确拒绝重复检测');
      
      const costsAfter = db.prepare('SELECT COUNT(*) as count FROM tire_costs WHERE tire_id = ?').get(tire.id) as any;
      if (costsAfter.count === 1) {
        console.log('   ✅ 通过：没有重复计费');
        passed += 2;
      } else {
        console.log(`   ❌ 失败：费用记录异常，实际为 ${costsAfter.count}`);
        failed++;
      }
    } else {
      console.log(`   ❌ 失败：${error.message}`);
      failed++;
    }
  }

  // ========== 测试 5: 已装车轮胎不能直接送翻新 ==========
  console.log('\n📋 测试 5: 已装车轮胎不能直接送翻新');
  try {
    const tire4 = tireService.createTire({
      serial_number: 'TEST-TIRE-004',
      brand: '测试品牌',
      model: '测试型号',
      size: '12R22.5',
    });
    
    tireService.installTire(tire4.id, vehicle.id, '测试员', '测试装车');
    console.log('   轮胎4已装车');
    
    tireService.sendToRetread(tire4.id, 800, '修理厂', '测试翻新');
    console.log('   ❌ 失败：竟然允许已装车轮胎直接送翻新！');
    failed++;
  } catch (error: any) {
    if (error.message.includes('已装车的轮胎不能送翻新')) {
      console.log('   ✅ 通过：正确拒绝已装车轮胎直接送翻新');
      passed++;
    } else {
      console.log(`   ❌ 失败：${error.message}`);
      failed++;
    }
  }

  // ========== 测试 6: 已装车轮胎不能直接报废 ==========
  console.log('\n📋 测试 6: 已装车轮胎不能直接报废');
  try {
    const tire5 = tireService.createTire({
      serial_number: 'TEST-TIRE-005',
      brand: '测试品牌',
      model: '测试型号',
      size: '12R22.5',
    });
    
    tireService.installTire(tire5.id, vehicle.id, '测试员', '测试装车');
    console.log('   轮胎5已装车');
    
    tireService.scrapTire(tire5.id, '测试报废原因', '测试员', '测试备注');
    console.log('   ❌ 失败：竟然允许已装车轮胎直接报废！');
    failed++;
  } catch (error: any) {
    if (error.message.includes('已装车的轮胎不能直接报废')) {
      console.log('   ✅ 通过：正确拒绝已装车轮胎直接报废');
      passed++;
    } else {
      console.log(`   ❌ 失败：${error.message}`);
      failed++;
    }
  }

  // ========== 测试 7: 正在翻新中的轮胎不能重复送翻新 ==========
  console.log('\n📋 测试 7: 正在翻新中的轮胎不能重复送翻新');
  try {
    const tire6 = tireService.createTire({
      serial_number: 'TEST-TIRE-006',
      brand: '测试品牌',
      model: '测试型号',
      size: '12R22.5',
    });
    
    tireService.sendToRetread(tire6.id, 800, '修理厂', '第一次翻新');
    console.log('   轮胎6已送翻新');
    
    // 尝试再次送翻新
    tireService.sendToRetread(tire6.id, 800, '修理厂', '第二次翻新');
    console.log('   ❌ 失败：竟然允许正在翻新的轮胎重复送翻新！');
    failed++;
  } catch (error: any) {
    if (error.message.includes('正在翻新中，不能重复送翻新')) {
      console.log('   ✅ 通过：正确拒绝翻新中轮胎重复送翻新');
      passed++;
    } else {
      console.log(`   ❌ 失败：${error.message}`);
      failed++;
    }
  }

  // ========== 输出测试结果 ==========
  console.log('\n' + '='.repeat(50));
  console.log(`📊 测试结果汇总:`);
  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   总计: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！业务规则已正确实现。');
  } else {
    console.log(`\n⚠️  有 ${failed} 个测试未通过，请检查代码。`);
  }
  console.log('='.repeat(50));
}

runTests().catch(console.error);
