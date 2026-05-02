const db = require('../database/db');

const initRooms = [
  { name: '多功能活动室A', capacity: 30, description: '适合会议、培训、小型聚会' },
  { name: '多功能活动室B', capacity: 20, description: '适合小组讨论、手工活动' },
  { name: '图书阅读室', capacity: 15, description: '安静阅读、自习空间' },
  { name: '健身活动室', capacity: 10, description: '配备基础健身器材' },
  { name: '儿童游戏室', capacity: 8, description: '适合亲子活动、儿童游戏' }
];

const insertRoom = db.prepare(`
  INSERT OR IGNORE INTO rooms (name, capacity, description)
  VALUES (?, ?, ?)
`);

console.log('正在初始化数据库...');

initRooms.forEach(room => {
  const result = insertRoom.run(room.name, room.capacity, room.description);
  if (result.changes > 0) {
    console.log(`✓ 已添加房间: ${room.name}`);
  } else {
    console.log(`- 房间已存在: ${room.name}`);
  }
});

console.log('\n数据库初始化完成！');
console.log('可用房间列表:');
const rooms = db.prepare('SELECT * FROM rooms').all();
rooms.forEach(room => {
  console.log(`  - ${room.name} (容量: ${room.capacity}人)`);
});
