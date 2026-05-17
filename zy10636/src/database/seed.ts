import { DeviceModel } from '../models/Device';
import { InspectorModel } from '../models/Inspector';
import { InspectionService } from '../services/InspectionService';
import './index';

const devices = [
  { code: 'EQ-2024-001', name: '数控机床CNC-001', type: '生产设备', location: 'A车间-1号生产线', department: '生产部', manufacturer: '沈阳机床', model: 'VMC850', installDate: '2023-06-15', warrantyExpireDate: '2026-06-14', status: 'active' as const },
  { code: 'EQ-2024-002', name: '工业机器人Arm-02', type: '自动化设备', location: 'A车间-焊接工位', department: '自动化部', manufacturer: 'ABB', model: 'IRB1200', installDate: '2023-08-20', warrantyExpireDate: '2026-08-19', status: 'active' as const },
  { code: 'EQ-2024-003', name: '空压机AP-03', type: '动力设备', location: '动力站房-1区', department: '设备部', manufacturer: '阿特拉斯', model: 'GA37', installDate: '2022-12-01', warrantyExpireDate: '2025-11-30', status: 'active' as const },
  { code: 'EQ-2024-004', name: '检测仪器QM-04', type: '检测设备', location: '质检室-精密区', department: '质量部', manufacturer: '三丰', model: 'CS-3000', installDate: '2024-01-10', warrantyExpireDate: '2027-01-09', status: 'active' as const },
  { code: 'EQ-2024-005', name: '叉车FT-05', type: '搬运设备', location: '仓库区-装卸区', department: '物流部', manufacturer: '林德', model: 'E16C', installDate: '2023-03-25', warrantyExpireDate: '2026-03-24', status: 'maintenance' as const }
];

const inspectors = [
  { employeeId: 'INS-001', name: '张建国', department: '设备部-巡检组', phone: '13800138001', email: 'zhang.jg@company.com', certificationLevel: '高级', status: 'active' as const },
  { employeeId: 'INS-002', name: '李明华', department: '设备部-巡检组', phone: '13800138002', email: 'li.mh@company.com', certificationLevel: '中级', status: 'active' as const },
  { employeeId: 'INS-003', name: '王秀丽', department: '质量部-检测组', phone: '13800138003', email: 'wang.xl@company.com', certificationLevel: '高级', status: 'active' as const },
  { employeeId: 'INS-004', name: '赵卫东', department: '生产部-维护组', phone: '13800138004', email: 'zhao.wd@company.com', certificationLevel: '中级', status: 'active' as const }
];

async function seed() {
  console.log('🌱 开始初始化种子数据...\n');

  console.log('📦 创建设备数据...');
  const createdDevices = [];
  for (const device of devices) {
    const result = await DeviceModel.create(device);
    createdDevices.push(result);
    console.log(`  ✓ ${device.name}`);
  }

  console.log('\n👤 创建巡检人员数据...');
  const createdInspectors = [];
  for (const inspector of inspectors) {
    const result = await InspectorModel.create(inspector);
    createdInspectors.push(result);
    console.log(`  ✓ ${inspector.name}`);
  }

  console.log('\n📋 创建巡检漏检记录...');
  
  const record1 = await InspectionService.createMissedRecord({
    planId: 'PLAN-2024-05-001',
    deviceId: createdDevices[0].id,
    inspectorId: createdInspectors[0].id,
    planDate: '2024-05-10',
    supplementReason: '巡检人员临时请假，设备交接不及时导致漏检',
    discoveredDate: '2024-05-12',
    createdBy: createdInspectors[1].id,
    createdByName: createdInspectors[1].name
  });
  console.log(`  ✓ 记录1: 漏检待补 - ${devices[0].name}`);

  const record2 = await InspectionService.createMissedRecord({
    planId: 'PLAN-2024-05-002',
    deviceId: createdDevices[1].id,
    inspectorId: createdInspectors[1].id,
    planDate: '2024-05-08',
    supplementReason: '系统故障，巡检计划未推送',
    discoveredDate: '2024-05-11',
    createdBy: createdInspectors[0].id,
    createdByName: createdInspectors[0].name
  });

  if (record2.data) {
    await InspectionService.submitSupplement({
      recordId: record2.data.id,
      actualInspectionDate: '2024-05-11',
      supplementDate: '2024-05-11',
      inspectionResults: {
        '外观检查': '正常',
        '运行声音': '正常',
        '温度检测': '42°C',
        '润滑系统': '正常',
        '安全防护': '正常'
      },
      operatorId: createdInspectors[1].id,
      operatorName: createdInspectors[1].name,
      remarks: '补检完成，设备运行正常'
    });
  }
  console.log(`  ✓ 记录2: 已补录 - ${devices[1].name}`);

  const record3 = await InspectionService.createMissedRecord({
    planId: 'PLAN-2024-05-003',
    deviceId: createdDevices[2].id,
    inspectorId: createdInspectors[2].id,
    planDate: '2024-05-05',
    supplementReason: '设备临时检修，原巡检计划取消',
    discoveredDate: '2024-05-07',
    createdBy: createdInspectors[0].id,
    createdByName: createdInspectors[0].name
  });

  if (record3.data) {
    await InspectionService.submitSupplement({
      recordId: record3.data.id,
      actualInspectionDate: '2024-05-07',
      supplementDate: '2024-05-07',
      inspectionResults: {
        '运行压力': '0.7MPa',
        '油位检查': '正常',
        '温度检测': '65°C',
        '排水检查': '正常'
      },
      operatorId: createdInspectors[2].id,
      operatorName: createdInspectors[2].name
    });
    await InspectionService.confirmRecord({
      recordId: record3.data.id,
      operatorId: createdInspectors[0].id,
      operatorName: createdInspectors[0].name,
      remarks: '补录信息完整，确认通过'
    });
  }
  console.log(`  ✓ 记录3: 已确认 - ${devices[2].name}`);

  const record4 = await InspectionService.createMissedRecord({
    planId: 'PLAN-2024-05-004',
    deviceId: createdDevices[3].id,
    inspectorId: createdInspectors[3].id,
    planDate: '2024-05-03',
    supplementReason: '巡检人员漏填巡检记录',
    discoveredDate: '2024-05-06',
    createdBy: createdInspectors[0].id,
    createdByName: createdInspectors[0].name
  });

  if (record4.data) {
    await InspectionService.submitSupplement({
      recordId: record4.data.id,
      actualInspectionDate: '2024-05-04',
      supplementDate: '2024-05-06',
      inspectionResults: {
        '精度校准': '正常',
        '镜头清洁': '已完成',
        '数据备份': '已完成'
      },
      operatorId: createdInspectors[3].id,
      operatorName: createdInspectors[3].name
    });
    await InspectionService.rejectRecord({
      recordId: record4.data.id,
      operatorId: createdInspectors[0].id,
      operatorName: createdInspectors[0].name,
      remarks: '补录检查项不全，缺少设备运行参数，请补充后重新提交'
    });
  }
  console.log(`  ✓ 记录4: 已驳回 - ${devices[3].name} (驳回流)`);

  const record5 = await InspectionService.createMissedRecord({
    planId: 'PLAN-2024-05-005',
    deviceId: createdDevices[4].id,
    inspectorId: createdInspectors[0].id,
    planDate: '2024-05-01',
    supplementReason: '设备送厂维修，现场无人巡检',
    discoveredDate: '2024-05-05',
    createdBy: createdInspectors[1].id,
    createdByName: createdInspectors[1].name
  });

  if (record5.data) {
    await InspectionService.submitSupplement({
      recordId: record5.data.id,
      actualInspectionDate: '2024-05-03',
      supplementDate: '2024-05-03',
      discoveredDate: '2024-05-05',
      inspectionResults: {
        '电池检查': '正常',
        '轮胎磨损': '正常',
        '刹车测试': '正常',
        '液压系统': '正常'
      },
      operatorId: createdInspectors[0].id,
      operatorName: createdInspectors[0].name
    });
  }
  console.log(`  ✓ 记录5: 人工复核 - ${devices[4].name} (人工复核流，补录时间早于发现时间)`);

  console.log('\n✅ 种子数据初始化完成!');
  console.log(`\n📊 数据统计:`);
  console.log(`  设备: ${createdDevices.length} 台`);
  console.log(`  巡检人员: ${createdInspectors.length} 人`);
  console.log(`  巡检记录: 5 条`);
  console.log(`    - 漏检待补: 1 条`);
  console.log(`    - 已补录: 1 条`);
  console.log(`    - 已确认: 1 条`);
  console.log(`    - 已驳回: 1 条 (驳回流)`);
  console.log(`    - 人工复核: 1 条 (人工复核流)`);
  console.log('\n🚀 可以启动服务器进行验收测试了!\n');

  process.exit(0);
}

setTimeout(seed, 1000);
