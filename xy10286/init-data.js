const { db } = require('./database');

async function initData() {
  const floorRow = await db.prepare('SELECT COUNT(*) as count FROM floors').get();
  const floorCount = floorRow.count;
  
  if (floorCount === 0) {
    console.log('开始初始化基础数据...');
    
    const floors = [
      { name: '1F', total: 100, reserved: 20, description: '一层主通道两侧' },
      { name: '2F', total: 150, reserved: 30, description: '二层扶梯口区域' },
      { name: '3F', total: 80, reserved: 15, description: '三层餐饮区外廊' },
      { name: 'B1F', total: 120, reserved: 25, description: '地下一层超市入口' }
    ];
    
    const boothsPerFloor = {
      '1F': ['1F-A01', '1F-A02', '1F-B01', '1F-B02'],
      '2F': ['2F-A01', '2F-A02', '2F-B01'],
      '3F': ['3F-A01', '3F-A02'],
      'B1F': ['B1F-A01', 'B1F-A02', 'B1F-B01']
    };
    
    for (const floor of floors) {
      const result = await db.prepare(`
        INSERT INTO floors (floor_name, total_capacity_kw, reserved_capacity_kw, available_capacity_kw, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        floor.name, 
        floor.total, 
        floor.reserved, 
        floor.total - floor.reserved,
        floor.description
      );
      
      const floorId = result.lastInsertRowid;
      const boothCodes = boothsPerFloor[floor.name] || [];
      
      for (let i = 0; i < boothCodes.length; i++) {
        await db.prepare(`
          INSERT INTO booths (booth_code, floor_id, location_description)
          VALUES (?, ?, ?)
        `).run(boothCodes[i], floorId, `${floor.name} 快闪区域 ${i + 1} 号位`);
      }
      
      console.log(`  已创建楼层: ${floor.name}, 总容量: ${floor.total}kW, 可用: ${floor.total - floor.reserved}kW`);
    }
    
    console.log('\n基础数据初始化完成！');
    console.log('\n可用楼层及摊位信息:');
    
    const floorsWithBooths = await db.prepare(`
      SELECT f.id, f.floor_name, f.total_capacity_kw, f.available_capacity_kw,
             GROUP_CONCAT(b.booth_code, ', ') as booths
      FROM floors f
      LEFT JOIN booths b ON f.id = b.floor_id
      GROUP BY f.id
    `).all();
    
    for (const floor of floorsWithBooths) {
      console.log(`  ${floor.floor_name}: 总容量 ${floor.total_capacity_kw}kW, 可用 ${floor.available_capacity_kw}kW`);
      console.log(`    摊位: ${floor.booths}`);
    }
  } else {
    console.log('基础数据已存在，跳过初始化。');
  }
}

if (require.main === module) {
  initData().catch(console.error);
}

module.exports = { initData };
