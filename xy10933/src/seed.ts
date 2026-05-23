import { initDatabase, db, generateId, getCurrentTime } from './database';

const sampleEquipment = [
  {
    name: '佳能 EOS R5 全画幅相机',
    category: '相机',
    model: 'EOS R5',
    serial_number: 'CN2023001',
    deposit_amount: 5000,
    daily_rate: 200,
    description: '4500万像素全画幅微单相机，支持8K视频录制',
  },
  {
    name: '索尼 FE 24-70mm F2.8 GM II 镜头',
    category: '镜头',
    model: 'SEL2470GM2',
    serial_number: 'SN2023002',
    deposit_amount: 3000,
    daily_rate: 150,
    description: '标准变焦G大师镜头，F2.8恒定光圈',
  },
  {
    name: '神牛 AD600 Pro 外拍闪光灯',
    category: '灯光',
    model: 'AD600 Pro',
    serial_number: 'GN2023003',
    deposit_amount: 1500,
    daily_rate: 80,
    description: '600Ws大功率外拍闪光灯，内置锂电池',
  },
  {
    name: '曼富图 MT055CXPRO3 三脚架',
    category: '配件',
    model: 'MT055CXPRO3',
    serial_number: 'MF2023004',
    deposit_amount: 800,
    daily_rate: 40,
    description: '碳纤维三脚架，承重9kg',
  },
  {
    name: '罗德 VideoMic NTG 麦克风',
    category: '音频',
    model: 'VideoMic NTG',
    serial_number: 'RD2023005',
    deposit_amount: 500,
    daily_rate: 30,
    description: '枪式麦克风，相机机顶使用',
  },
];

async function clearSampleData(): Promise<void> {
  console.log('清理旧的样例数据...');
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`DELETE FROM rental_accessories`);
      db.run(`DELETE FROM return_inspections`);
      db.run(`DELETE FROM deposit_deductions`);
      db.run(`DELETE FROM manual_corrections`);
      db.run(`DELETE FROM exception_logs`);
      db.run(`DELETE FROM rental_orders`);
      db.run(`DELETE FROM accessories`);
      db.run(`DELETE FROM equipment`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function seedDatabase() {
  console.log('开始填充样例数据...');
  
  await initDatabase();
  await clearSampleData();

  const now = getCurrentTime();
  const equipmentIds: string[] = [];
  const accessoryIds: string[] = [];

  for (const equip of sampleEquipment) {
    const equipId = generateId();
    equipmentIds.push(equipId);
    
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO equipment (id, name, category, model, serial_number, status, deposit_amount, daily_rate, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?)`,
        [equipId, equip.name, equip.category, equip.model, equip.serial_number, equip.deposit_amount, equip.daily_rate, equip.description, now, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const accessories = generateAccessories(equip.category, equipId);
    for (const acc of accessories) {
      const accId = generateId();
      accessoryIds.push(accId);
      
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO accessories (id, equipment_id, name, quantity, status)
           VALUES (?, ?, ?, ?, 'good')`,
          [accId, equipId, acc.name, acc.quantity],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  console.log(`已创建 ${equipmentIds.length} 个器材和 ${accessoryIds.length} 个配件记录`);
  console.log('样例数据填充完成！');
  console.log('\n可使用以下器材ID进行测试:');
  equipmentIds.forEach((id, index) => {
    console.log(`  ${sampleEquipment[index].name}: ${id}`);
  });
  
  process.exit(0);
}

function generateAccessories(category: string, equipmentId: string): Array<{name: string; quantity: number}> {
  switch (category) {
    case '相机':
      return [
        { name: '原装电池', quantity: 2 },
        { name: '相机充电器', quantity: 1 },
        { name: '肩带', quantity: 1 },
        { name: '机身盖', quantity: 1 },
      ];
    case '镜头':
      return [
        { name: '镜头前后盖', quantity: 1 },
        { name: 'UV镜', quantity: 1 },
        { name: '镜头袋', quantity: 1 },
      ];
    case '灯光':
      return [
        { name: '灯头保护罩', quantity: 1 },
        { name: '电源适配器', quantity: 1 },
        { name: '反光板', quantity: 1 },
      ];
    case '配件':
      return [
        { name: '快装板', quantity: 1 },
        { name: '收纳袋', quantity: 1 },
      ];
    case '音频':
      return [
        { name: '防风毛罩', quantity: 1 },
        { name: '3.5mm音频线', quantity: 1 },
      ];
    default:
      return [];
  }
}

seedDatabase().catch((err) => {
  console.error('填充样例数据失败:', err);
  process.exit(1);
});
