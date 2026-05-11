require('dotenv').config();
const mongoose = require('mongoose');
const Material = require('../models/Material');
const WorkOrder = require('../models/WorkOrder');
const Settlement = require('../models/Settlement');

const materialsData = [
  { name: 'PPR水管(20mm)', category: '水管', unit: '米', unitPrice: 8.5, stock: 100, minStock: 20 },
  { name: 'PPR水管(25mm)', category: '水管', unit: '米', unitPrice: 12.0, stock: 80, minStock: 20 },
  { name: '水龙头', category: '水管', unit: '个', unitPrice: 85.0, stock: 30, minStock: 10 },
  { name: '生料带', category: '水管', unit: '卷', unitPrice: 3.5, stock: 50, minStock: 20 },
  { name: '门禁读卡器', category: '门禁', unit: '个', unitPrice: 180.0, stock: 10, minStock: 5 },
  { name: '门禁卡', category: '门禁', unit: '张', unitPrice: 15.0, stock: 100, minStock: 30 },
  { name: '门锁电池', category: '门禁', unit: '节', unitPrice: 5.0, stock: 80, minStock: 20 },
  { name: 'LED灯泡(9W)', category: '照明', unit: '个', unitPrice: 25.0, stock: 60, minStock: 20 },
  { name: 'LED灯泡(15W)', category: '照明', unit: '个', unitPrice: 35.0, stock: 40, minStock: 15 },
  { name: '开关面板', category: '照明', unit: '个', unitPrice: 18.0, stock: 50, minStock: 20 }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('数据库连接成功，开始清除旧数据...');
    
    await Material.deleteMany({});
    await WorkOrder.deleteMany({});
    await Settlement.deleteMany({});
    
    console.log('旧数据清除完成，开始导入材料数据...');
    const materials = await Material.insertMany(materialsData);
    console.log(`材料数据导入完成，共 ${materials.length} 条`);
    
    const pipeMaterial = materials.find(m => m.name === 'PPR水管(20mm)');
    const faucetMaterial = materials.find(m => m.name === '水龙头');
    const tapeMaterial = materials.find(m => m.name === '生料带');
    const readerMaterial = materials.find(m => m.name === '门禁读卡器');
    const cardMaterial = materials.find(m => m.name === '门禁卡');
    const batteryMaterial = materials.find(m => m.name === '门锁电池');
    const bulbMaterial = materials.find(m => m.name === 'LED灯泡(9W)');
    const switchMaterial = materials.find(m => m.name === '开关面板');
    
    console.log('创建样例工单...');
    
    const now = new Date();
    
    const order1 = new WorkOrder({
      orderNumber: 'WO202605100001',
      repairType: '水管',
      repairCategory: '公共区域',
      location: '1号楼2单元楼道',
      description: '楼道水管漏水',
      reporterName: '物业前台',
      reporterPhone: '010-12345678',
      technician: '张师傅',
      status: '已完成',
      materials: [
        {
          materialId: pipeMaterial._id,
          materialName: pipeMaterial.name,
          unit: pipeMaterial.unit,
          unitPrice: pipeMaterial.unitPrice,
          quantityTaken: 5,
          quantityUsed: 4,
          quantityReturned: 1
        },
        {
          materialId: tapeMaterial._id,
          materialName: tapeMaterial.name,
          unit: tapeMaterial.unit,
          unitPrice: tapeMaterial.unitPrice,
          quantityTaken: 2,
          quantityUsed: 1,
          quantityReturned: 1
        }
      ],
      ownerConfirmed: true,
      confirmedBy: '物业经理',
      confirmedAt: now,
      settled: true,
      settledAt: now,
      settlementType: '公共维修基金',
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    });
    await order1.save();
    
    const order2 = new WorkOrder({
      orderNumber: 'WO202605100002',
      repairType: '水管',
      repairCategory: '住户自费',
      location: '3号楼5层',
      description: '厨房水龙头损坏',
      reporterName: '李先生',
      reporterPhone: '13800138001',
      houseNumber: '3-502',
      technician: '王师傅',
      status: '已完成',
      materials: [
        {
          materialId: faucetMaterial._id,
          materialName: faucetMaterial.name,
          unit: faucetMaterial.unit,
          unitPrice: faucetMaterial.unitPrice,
          quantityTaken: 1,
          quantityUsed: 1,
          quantityReturned: 0
        },
        {
          materialId: tapeMaterial._id,
          materialName: tapeMaterial.name,
          unit: tapeMaterial.unit,
          unitPrice: tapeMaterial.unitPrice,
          quantityTaken: 1,
          quantityUsed: 1,
          quantityReturned: 0
        }
      ],
      ownerConfirmed: true,
      confirmedBy: '李先生',
      confirmedAt: now,
      settled: true,
      settledAt: now,
      settlementType: '业主付费',
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    });
    await order2.save();
    
    const order3 = new WorkOrder({
      orderNumber: 'WO202605100003',
      repairType: '门禁',
      repairCategory: '公共区域',
      location: '2号楼单元门',
      description: '门禁读卡器故障',
      reporterName: '保安队',
      reporterPhone: '010-87654321',
      technician: '李师傅',
      status: '处理中',
      materials: [
        {
          materialId: readerMaterial._id,
          materialName: readerMaterial.name,
          unit: readerMaterial.unit,
          unitPrice: readerMaterial.unitPrice,
          quantityTaken: 2,
          quantityUsed: 0,
          quantityReturned: 0
        }
      ],
      ownerConfirmed: false,
      settled: false,
      createdAt: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000)
    });
    await order3.save();
    
    const order4 = new WorkOrder({
      orderNumber: 'WO202605100004',
      repairType: '照明',
      repairCategory: '住户自费',
      location: '5号楼3层',
      description: '客厅多个灯泡不亮，多领了几个备用',
      reporterName: '张女士',
      reporterPhone: '13900139002',
      houseNumber: '5-301',
      technician: '刘师傅',
      status: '待确认',
      materials: [
        {
          materialId: bulbMaterial._id,
          materialName: bulbMaterial.name,
          unit: bulbMaterial.unit,
          unitPrice: bulbMaterial.unitPrice,
          quantityTaken: 8,
          quantityUsed: 5,
          quantityReturned: 0
        },
        {
          materialId: switchMaterial._id,
          materialName: switchMaterial.name,
          unit: switchMaterial.unit,
          unitPrice: switchMaterial.unitPrice,
          quantityTaken: 3,
          quantityUsed: 2,
          quantityReturned: 0
        }
      ],
      ownerConfirmed: false,
      settled: false,
      createdAt: now
    });
    await order4.save();
    
    const order5 = new WorkOrder({
      orderNumber: 'WO202605100005',
      repairType: '照明',
      repairCategory: '公共区域',
      location: '地下车库B区',
      description: '车库灯光昏暗',
      reporterName: '物业前台',
      reporterPhone: '010-12345678',
      technician: '刘师傅',
      status: '待处理',
      materials: [],
      ownerConfirmed: false,
      settled: false,
      createdAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
    });
    await order5.save();
    
    console.log('创建样例结算记录...');
    
    const settlement1 = new Settlement({
      settlementNumber: 'ST202605100001',
      workOrderId: order1._id,
      workOrderNumber: order1.orderNumber,
      repairCategory: order1.repairCategory,
      repairType: order1.repairType,
      location: order1.location,
      technician: order1.technician,
      settlementType: '公共维修基金',
      items: [
        {
          materialId: pipeMaterial._id,
          materialName: pipeMaterial.name,
          unit: pipeMaterial.unit,
          unitPrice: pipeMaterial.unitPrice,
          quantityUsed: 4,
          amount: 34.0
        },
        {
          materialId: tapeMaterial._id,
          materialName: tapeMaterial.name,
          unit: tapeMaterial.unit,
          unitPrice: tapeMaterial.unitPrice,
          quantityUsed: 1,
          amount: 3.5
        }
      ],
      totalAmount: 37.5,
      createdAt: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000)
    });
    await settlement1.save();
    
    const settlement2 = new Settlement({
      settlementNumber: 'ST202605100002',
      workOrderId: order2._id,
      workOrderNumber: order2.orderNumber,
      repairCategory: order2.repairCategory,
      repairType: order2.repairType,
      location: order2.location,
      technician: order2.technician,
      houseNumber: order2.houseNumber,
      settlementType: '业主付费',
      items: [
        {
          materialId: faucetMaterial._id,
          materialName: faucetMaterial.name,
          unit: faucetMaterial.unit,
          unitPrice: faucetMaterial.unitPrice,
          quantityUsed: 1,
          amount: 85.0
        },
        {
          materialId: tapeMaterial._id,
          materialName: tapeMaterial.name,
          unit: tapeMaterial.unit,
          unitPrice: tapeMaterial.unitPrice,
          quantityUsed: 1,
          amount: 3.5
        }
      ],
      totalAmount: 88.5,
      createdAt: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000)
    });
    await settlement2.save();
    
    console.log('\n========================================');
    console.log('样例数据导入完成！');
    console.log('========================================');
    console.log('\n样例工单说明：');
    console.log('1. WO202605100001 - 公共区域水管维修 (已完成、已结算、材料多领退回1米)');
    console.log('   - 领用PPR水管5米，使用4米，退回1米');
    console.log('   - 结算类型：公共维修基金，金额：37.5元');
    console.log('');
    console.log('2. WO202605100002 - 住户自费水龙头维修 (已完成、已结算)');
    console.log('   - 领用龙头1个，全部使用');
    console.log('   - 结算类型：业主付费，金额：88.5元');
    console.log('');
    console.log('3. WO202605100003 - 公共区域门禁维修 (处理中，领用读卡器2个)');
    console.log('   - 状态：处理中，需确认消耗后确认结算');
    console.log('');
    console.log('4. WO202605100004 - 住户自费照明维修 (待确认，灯泡多领需退回)');
    console.log('   - 领用灯泡8个，使用5个，剩余3个待退回');
    console.log('   - 领用开关3个，使用2个，剩余1个待退回');
    console.log('   - 状态：待业主确认，确认后可结算');
    console.log('');
    console.log('5. WO202605100005 - 公共区域车库照明 (待处理)');
    console.log('   - 状态：待处理，尚未领用材料');
    console.log('========================================\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('种子数据导入失败:', error);
    process.exit(1);
  }
}

seed();
