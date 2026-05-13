import db from '../database';
import tireService from './tireService';
import vehicleService from './vehicleService';

export function createDemoData() {
  const tireCount = (db.prepare('SELECT COUNT(*) as count FROM tires').get() as any).count;
  if (tireCount > 0) {
    console.log('演示数据已存在，跳过创建');
    return;
  }

  console.log('创建演示数据...');

  const vehicles = [
    { plate_number: '京A12345', model: '东风天龙KL', tire_count: 6 },
    { plate_number: '京B67890', model: '解放J7', tire_count: 6 },
    { plate_number: '京C11111', model: '重汽豪沃', tire_count: 8 },
    { plate_number: '京D22222', model: '欧曼GTL', tire_count: 6 },
  ];

  const vehicleIds: string[] = [];
  vehicles.forEach(v => {
    const vehicle = vehicleService.createVehicle(v);
    vehicleIds.push(vehicle.id);
  });

  const tires = [
    { serial_number: 'TR20240001', brand: '米其林', model: 'X Line Energy', size: '295/80R22.5' },
    { serial_number: 'TR20240002', brand: '米其林', model: 'X Line Energy', size: '295/80R22.5' },
    { serial_number: 'TR20240003', brand: '普利司通', model: 'R156', size: '12R22.5' },
    { serial_number: 'TR20240004', brand: '普利司通', model: 'R156', size: '12R22.5' },
    { serial_number: 'TR20240005', brand: '固特异', model: 'Endurance', size: '12R22.5' },
    { serial_number: 'TR20240006', brand: '固特异', model: 'Endurance', size: '12R22.5' },
    { serial_number: 'TR20240007', brand: '朝阳', model: 'AS578', size: '295/80R22.5' },
    { serial_number: 'TR20240008', brand: '朝阳', model: 'AS578', size: '295/80R22.5' },
    { serial_number: 'TR20240009', brand: '三角', model: 'TR668', size: '12R22.5' },
    { serial_number: 'TR20240010', brand: '三角', model: 'TR668', size: '12R22.5' },
    { serial_number: 'TR20240011', brand: '玲珑', model: 'KTA206', size: '12R22.5' },
    { serial_number: 'TR20240012', brand: '玲珑', model: 'KTA206', size: '12R22.5' },
    { serial_number: 'TR20240013', brand: '米其林', model: 'X Multi', size: '12R22.5' },
    { serial_number: 'TR20240014', brand: '米其林', model: 'X Multi', size: '12R22.5' },
    { serial_number: 'TR20240015', brand: '普利司通', model: 'M726', size: '295/80R22.5' },
    { serial_number: 'TR20240016', brand: '普利司通', model: 'M726', size: '295/80R22.5' },
  ];

  const tireIds: string[] = [];
  tires.forEach(t => {
    const tire = tireService.createTire(t);
    tireIds.push(tire.id);
  });

  tireService.installTire(tireIds[0], vehicleIds[0], '张师傅', '初始装车');
  tireService.installTire(tireIds[1], vehicleIds[0], '张师傅', '初始装车');
  tireService.installTire(tireIds[2], vehicleIds[0], '张师傅', '初始装车');
  tireService.installTire(tireIds[3], vehicleIds[0], '张师傅', '初始装车');
  tireService.installTire(tireIds[4], vehicleIds[0], '张师傅', '初始装车');
  tireService.installTire(tireIds[5], vehicleIds[0], '张师傅', '初始装车');

  tireService.installTire(tireIds[6], vehicleIds[1], '李师傅', '初始装车');
  tireService.installTire(tireIds[7], vehicleIds[1], '李师傅', '初始装车');
  tireService.installTire(tireIds[8], vehicleIds[1], '李师傅', '初始装车');
  tireService.installTire(tireIds[9], vehicleIds[1], '李师傅', '初始装车');

  tireService.removeTire(tireIds[6], '磨损严重', '李师傅', '左前轮花纹深度不足');
  tireService.inspectTire(tireIds[6], 'failed', '花纹深度1.2mm，低于安全标准3mm，需要翻新', 50, '检测员小王');
  tireService.sendToRetread(tireIds[6], 800, '修理厂老赵', '胎面翻新+动平衡');

  tireService.removeTire(tireIds[7], '被钉子扎破', '李师傅', '右后轮漏气');
  tireService.inspectTire(tireIds[7], 'passed', '修补后可正常使用，花纹深度6mm', 50, '检测员小王');

  tireService.installTire(tireIds[10], vehicleIds[2], '王师傅', '初始装车');
  tireService.installTire(tireIds[11], vehicleIds[2], '王师傅', '初始装车');
  tireService.installTire(tireIds[12], vehicleIds[2], '王师傅', '初始装车');

  tireService.removeTire(tireIds[10], '胎侧鼓包', '王师傅', '行驶中撞到路边石');
  tireService.inspectTire(tireIds[10], 'failed', '胎侧结构损坏，无法修复', 50, '检测员小王');
  tireService.scrapTire(tireIds[10], '胎侧鼓包严重，存在安全隐患', '主管老刘');

  tireService.inspectTire(tireIds[13], 'passed', '新胎入库检测合格', 50, '检测员小王');
  
  tireService.sendToRetread(tireIds[14], 750, '修理厂老赵', '批量翻新');
  tireService.completeRetread(tireIds[14], '修理厂老赵', '翻新完成，质量合格');

  console.log('演示数据创建完成');
}
