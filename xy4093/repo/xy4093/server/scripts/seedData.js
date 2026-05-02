import { getDatabase, runQuery, getAll, getOne } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

const sampleData = {
  rooms: [
    { room_number: '101', floor: 1, capacity: 2, building: '海景楼' },
    { room_number: '102', floor: 1, capacity: 2, building: '海景楼' },
    { room_number: '103', floor: 1, capacity: 3, building: '海景楼' },
    { room_number: '104', floor: 1, capacity: 2, building: '海景楼' },
    { room_number: '201', floor: 2, capacity: 2, building: '海景楼' },
    { room_number: '202', floor: 2, capacity: 3, building: '海景楼' },
    { room_number: '203', floor: 2, capacity: 2, building: '海景楼' },
    { room_number: '301', floor: 3, capacity: 4, building: '海景楼' },
    { room_number: '302', floor: 3, capacity: 2, building: '海景楼' },
    { room_number: '303', floor: 3, capacity: 2, building: '海景楼' },
  ],
  ships: [
    { name: '和平号', capacity: 30, current_load: 0, status: 'available' },
    { name: '顺风号', capacity: 20, current_load: 0, status: 'available' },
    { name: '应急艇', capacity: 10, current_load: 0, status: 'available' },
  ],
  supplies: [
    { type: 'fuel', name: '发电机柴油', quantity: 80, unit: '升', min_threshold: 100, status: 'low' },
    { type: 'fuel', name: '备用汽油', quantity: 200, unit: '升', min_threshold: 50, status: 'sufficient' },
    { type: 'water', name: '瓶装饮用水', quantity: 120, unit: '瓶', min_threshold: 50, status: 'sufficient' },
    { type: 'water', name: '桶装饮用水', quantity: 15, unit: '桶', min_threshold: 20, status: 'critical' },
    { type: 'food', name: '方便面', quantity: 80, unit: '包', min_threshold: 30, status: 'sufficient' },
    { type: 'food', name: '压缩饼干', quantity: 50, unit: '包', min_threshold: 30, status: 'sufficient' },
    { type: 'food', name: '罐头食品', quantity: 40, unit: '罐', min_threshold: 20, status: 'sufficient' },
    { type: 'medicine', name: '急救包', quantity: 8, unit: '个', min_threshold: 5, status: 'sufficient' },
    { type: 'medicine', name: '退烧药', quantity: 20, unit: '盒', min_threshold: 10, status: 'sufficient' },
    { type: 'medicine', name: '外伤药品', quantity: 15, unit: '盒', min_threshold: 10, status: 'sufficient' },
  ],
  sandbags: [
    { location: '正门入口', quantity: 20, needed: 30, status: 'insufficient' },
    { location: '后门入口', quantity: 15, needed: 20, status: 'insufficient' },
    { location: '地下车库入口', quantity: 0, needed: 25, status: 'empty' },
    { location: '设备间', quantity: 10, needed: 10, status: 'sufficient' },
    { location: '发电机房', quantity: 15, needed: 15, status: 'sufficient' },
  ]
};

const guestsData = [
  { name: '王大明', age: 72, gender: '男', is_elderly: 1, is_child: 0, has_disability: 0, room_index: 0, checkin_date: '2025-07-15' },
  { name: '李秀英', age: 68, gender: '女', is_elderly: 1, is_child: 0, has_disability: 0, room_index: 0, checkin_date: '2025-07-15' },
  { name: '张小华', age: 8, gender: '男', is_elderly: 0, is_child: 1, has_disability: 0, room_index: 1, checkin_date: '2025-07-14' },
  { name: '张丽', age: 35, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 1, checkin_date: '2025-07-14' },
  { name: '张伟', age: 38, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 1, checkin_date: '2025-07-14' },
  { name: '陈志强', age: 45, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 2, checkin_date: '2025-07-16' },
  { name: '陈美琪', age: 42, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 2, checkin_date: '2025-07-16' },
  { name: '陈晓晓', age: 5, gender: '女', is_elderly: 0, is_child: 1, has_disability: 0, room_index: 2, checkin_date: '2025-07-16' },
  { name: '刘建国', age: 75, gender: '男', is_elderly: 1, is_child: 0, has_disability: 1, room_index: 3, checkin_date: '2025-07-13' },
  { name: '赵玉芳', age: 30, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 4, checkin_date: '2025-07-17' },
  { name: '钱明', age: 32, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 4, checkin_date: '2025-07-17' },
  { name: '孙浩', age: 28, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 5, checkin_date: '2025-07-15' },
  { name: '孙婷婷', age: 26, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 5, checkin_date: '2025-07-15' },
  { name: '孙小宝', age: 3, gender: '男', is_elderly: 0, is_child: 1, has_disability: 0, room_index: 5, checkin_date: '2025-07-15' },
  { name: '周涛', age: 50, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 6, checkin_date: '2025-07-16' },
  { name: '周燕', age: 48, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 6, checkin_date: '2025-07-16' },
  { name: '吴梦', age: 25, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 7, checkin_date: '2025-07-14' },
  { name: '吴刚', age: 28, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 7, checkin_date: '2025-07-14' },
  { name: '吴父', age: 60, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 7, checkin_date: '2025-07-14' },
  { name: '吴母', age: 58, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 7, checkin_date: '2025-07-14' },
  { name: '郑文华', age: 33, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 8, checkin_date: '2025-07-17' },
  { name: '郑丽丽', age: 31, gender: '女', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 8, checkin_date: '2025-07-17' },
  { name: '黄志明', age: 40, gender: '男', is_elderly: 0, is_child: 0, has_disability: 0, room_index: 9, checkin_date: '2025-07-15' },
  { name: '黄小雪', age: 10, gender: '女', is_elderly: 0, is_child: 1, has_disability: 0, room_index: 9, checkin_date: '2025-07-15' },
];

function insertSampleData() {
  const db = getDatabase();
  
  const transaction = db.transaction(() => {
    console.log('清空现有数据...');
    
    runQuery('DELETE FROM audit_logs');
    runQuery('DELETE FROM guests');
    runQuery('DELETE FROM evacuation_batches');
    runQuery('DELETE FROM rooms');
    runQuery('DELETE FROM ships');
    runQuery('DELETE FROM supplies');
    runQuery('DELETE FROM sandbags');
    
    console.log('插入房间数据...');
    const roomIds = [];
    for (const room of sampleData.rooms) {
      const id = uuidv4();
      roomIds.push(id);
      runQuery(`
        INSERT INTO rooms (id, room_number, floor, capacity, building, is_occupied, is_evacuated, is_window_sealed)
        VALUES (?, ?, ?, ?, ?, 1, 0, 0)
      `, [id, room.room_number, room.floor, room.capacity, room.building]);
    }
    
    console.log('插入船班数据...');
    for (const ship of sampleData.ships) {
      runQuery(`
        INSERT INTO ships (id, name, capacity, current_load, status)
        VALUES (?, ?, ?, ?, ?)
      `, [uuidv4(), ship.name, ship.capacity, ship.current_load, ship.status]);
    }
    
    console.log('插入物资数据...');
    for (const supply of sampleData.supplies) {
      runQuery(`
        INSERT INTO supplies (id, type, name, quantity, unit, min_threshold, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), 
        supply.type, 
        supply.name, 
        supply.quantity, 
        supply.unit, 
        supply.min_threshold,
        supply.status
      ]);
    }
    
    console.log('插入沙袋数据...');
    for (const sandbag of sampleData.sandbags) {
      runQuery(`
        INSERT INTO sandbags (id, location, quantity, needed, status)
        VALUES (?, ?, ?, ?, ?)
      `, [uuidv4(), sandbag.location, sandbag.quantity, sandbag.needed, sandbag.status]);
    }
    
    console.log('插入住客数据...');
    for (const guest of guestsData) {
      const roomId = roomIds[guest.room_index] || null;
      runQuery(`
        INSERT INTO guests (id, room_id, name, age, gender, is_elderly, is_child, has_disability, checkin_date, is_evacuated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, [
        uuidv4(),
        roomId,
        guest.name,
        guest.age,
        guest.gender,
        guest.is_elderly,
        guest.is_child,
        guest.has_disability,
        guest.checkin_date
      ]);
    }
    
  });
  
  transaction();
  
  const rooms = getAll('SELECT COUNT(*) as count FROM rooms')[0].count;
  const guests = getAll('SELECT COUNT(*) as count FROM guests')[0].count;
  const ships = getAll('SELECT COUNT(*) as count FROM ships')[0].count;
  const supplies = getAll('SELECT COUNT(*) as count FROM supplies')[0].count;
  const sandbags = getAll('SELECT COUNT(*) as count FROM sandbags')[0].count;
  
  console.log('\n=====================================');
  console.log('  示例数据插入完成！');
  console.log('=====================================');
  console.log(`  房间: ${rooms} 间`);
  console.log(`  住客: ${guests} 人`);
  console.log(`  船班: ${ships} 艘`);
  console.log(`  物资: ${supplies} 项`);
  console.log(`  沙袋部署点: ${sandbags} 个`);
  console.log('=====================================');
  
  const priorityGuests = getAll(`
    SELECT COUNT(*) as count FROM guests 
    WHERE is_elderly = 1 OR is_child = 1 OR has_disability = 1
  `)[0].count;
  
  console.log(`  高优先级住客: ${priorityGuests} 人 (老人、儿童、行动不便)`);
  console.log('=====================================');
  
  return { success: true };
}

function clearAllData() {
  const db = getDatabase();
  
  const transaction = db.transaction(() => {
    console.log('清空所有数据...');
    
    runQuery('DELETE FROM audit_logs');
    runQuery('DELETE FROM guests');
    runQuery('DELETE FROM evacuation_batches');
    runQuery('DELETE FROM rooms');
    runQuery('DELETE FROM ships');
    runQuery('DELETE FROM supplies');
    runQuery('DELETE FROM sandbags');
  });
  
  transaction();
  console.log('所有数据已清空');
  return { success: true };
}

const args = process.argv.slice(2);

if (args.includes('--clear')) {
  clearAllData();
} else {
  insertSampleData();
}

export { insertSampleData, clearAllData };
