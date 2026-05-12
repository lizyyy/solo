const { db, resetDB } = require('./db');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');

function seed() {
  resetDB();
  console.log('Reset database...');

  const today = dayjs();

  const rooms = [
    { id: 'room-standard', name: '标准间（单犬）', type: 'standard', capacity: 3, base_rate: 120, features: '空调、定时遛狗、监控' },
    { id: 'room-deluxe', name: '豪华间（大犬）', type: 'deluxe', capacity: 2, base_rate: 200, features: '独立空间、沙发床、每天2次遛狗' },
    { id: 'room-suite', name: '套房（多宠）', type: 'suite', capacity: 1, base_rate: 350, features: '独立公寓、恒温系统、24h管家、视频监控' },
    { id: 'room-cat', name: '猫咪专属房', type: 'cat', capacity: 4, base_rate: 80, features: '猫爬架、独立猫砂盆、通风系统' }
  ];

  for (const room of rooms) {
    db.prepare(`
      INSERT INTO rooms (id, name, type, capacity, base_rate, features)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(room.id, room.name, room.type, room.capacity, room.base_rate, room.features);

    for (let i = -3; i < 30; i++) {
      const date = today.add(i, 'day').format('YYYY-MM-DD');
      db.prepare(`
        INSERT INTO room_inventory (id, room_id, date, available)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), room.id, date, room.capacity);
    }
  }
  console.log('Created rooms and inventory...');

  const pets = [
    {
      id: 'pet-001',
      name: '旺财',
      species: 'dog',
      breed: '金毛寻回犬',
      age: 3,
      gender: '公',
      weight: 28,
      owner_name: '张小明',
      owner_phone: '13800138001',
      feeding_notes: '每日两餐，早8点晚6点，需定量控制体重',
      allergies: '无',
      medications: '无',
      special_needs: '需要每天至少遛狗1小时'
    },
    {
      id: 'pet-002',
      name: '小黄',
      species: 'dog',
      breed: '柴犬',
      age: 2,
      gender: '母',
      weight: 12,
      owner_name: '李小红',
      owner_phone: '13800138002',
      feeding_notes: '只吃鸡肉味狗粮，不吃牛肉',
      allergies: '牛肉',
      medications: '无',
      special_needs: '性格独立，不喜欢和其他狗打架'
    },
    {
      id: 'pet-003',
      name: '喵喵',
      species: 'cat',
      breed: '英短蓝猫',
      age: 4,
      gender: '公',
      weight: 5.5,
      owner_name: '王大伟',
      owner_phone: '13800138003',
      feeding_notes: '每日定时喂食，不能随便加餐',
      allergies: '无',
      medications: '无',
      special_needs: '需要每天清理猫砂盆'
    },
    {
      id: 'pet-004',
      name: '豆豆',
      species: 'dog',
      breed: '泰迪',
      age: 1,
      gender: '公',
      weight: 4.2,
      owner_name: '赵小芳',
      owner_phone: '13800138004',
      feeding_notes: '幼犬，需要每日3餐',
      allergies: '海鲜',
      medications: '无',
      special_needs: '需要额外关注'
    }
  ];

  for (const pet of pets) {
    db.prepare(`
      INSERT INTO pets (id, name, species, breed, age, gender, weight, owner_name, owner_phone, feeding_notes, allergies, medications, special_needs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pet.id, pet.name, pet.species, pet.breed, pet.age, pet.gender, pet.weight,
      pet.owner_name, pet.owner_phone, pet.feeding_notes, pet.allergies, pet.medications, pet.special_needs
    );
  }
  console.log('Created pets...');

  const vaccines = [
    { petId: 'pet-001', type: '狂犬病', name: '瑞比克', adminDate: today.subtract(6, 'month').format('YYYY-MM-DD'), expiry: today.add(6, 'month').format('YYYY-MM-DD'), clinic: '关爱宠物医院' },
    { petId: 'pet-001', type: '犬瘟热', name: '英特威', adminDate: today.subtract(8, 'month').format('YYYY-MM-DD'), expiry: today.add(4, 'month').format('YYYY-MM-DD'), clinic: '关爱宠物医院' },
    { petId: 'pet-001', type: '细小病毒', name: '英特威', adminDate: today.subtract(8, 'month').format('YYYY-MM-DD'), expiry: today.add(4, 'month').format('YYYY-MM-DD'), clinic: '关爱宠物医院' },
    { petId: 'pet-002', type: '狂犬病', name: '瑞比克', adminDate: today.subtract(3, 'month').format('YYYY-MM-DD'), expiry: today.add(9, 'month').format('YYYY-MM-DD'), clinic: '爱心宠物诊所' },
    { petId: 'pet-002', type: '犬瘟热', name: '英特威', adminDate: today.subtract(10, 'month').format('YYYY-MM-DD'), expiry: today.add(2, 'month').format('YYYY-MM-DD'), clinic: '爱心宠物诊所' },
    { petId: 'pet-002', type: '细小病毒', name: '英特威', adminDate: today.subtract(10, 'month').format('YYYY-MM-DD'), expiry: today.add(2, 'month').format('YYYY-MM-DD'), clinic: '爱心宠物诊所' },
    { petId: 'pet-003', type: '狂犬病', name: '瑞比克', adminDate: today.subtract(2, 'year').format('YYYY-MM-DD'), expiry: today.subtract(10, 'month').format('YYYY-MM-DD'), clinic: '过期疫苗（演示用）' },
    { petId: 'pet-003', type: '猫瘟热', name: '英特威猫三联', adminDate: today.subtract(2, 'year').format('YYYY-MM-DD'), expiry: today.subtract(10, 'month').format('YYYY-MM-DD'), clinic: '过期疫苗（演示用）' },
    { petId: 'pet-003', type: '猫鼻支', name: '英特威猫三联', adminDate: today.subtract(2, 'year').format('YYYY-MM-DD'), expiry: today.subtract(10, 'month').format('YYYY-MM-DD'), clinic: '过期疫苗（演示用）' },
    { petId: 'pet-004', type: '狂犬病', name: '瑞比克', adminDate: today.subtract(1, 'month').format('YYYY-MM-DD'), expiry: today.add(11, 'month').format('YYYY-MM-DD'), clinic: '康宠宠物医院' },
    { petId: 'pet-004', type: '犬瘟热', name: '英特威', adminDate: today.subtract(2, 'month').format('YYYY-MM-DD'), expiry: today.add(10, 'month').format('YYYY-MM-DD'), clinic: '康宠宠物医院' },
    { petId: 'pet-004', type: '细小病毒', name: '英特威', adminDate: today.subtract(2, 'month').format('YYYY-MM-DD'), expiry: today.add(10, 'month').format('YYYY-MM-DD'), clinic: '康宠宠物医院' }
  ];

  for (const v of vaccines) {
    db.prepare(`
      INSERT INTO vaccine_records (id, pet_id, vaccine_type, vaccine_name, administered_date, expiry_date, vet_clinic)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), v.petId, v.type, v.name, v.adminDate, v.expiry, v.clinic);
  }
  console.log('Created vaccine records...');

  const addOns = [
    { id: 'addon-bath', name: '洗澡服务', category: 'grooming', desc: '基础洗澡服务', price: 60, unit: '次' },
    { id: 'addon-grooming', name: '美容造型', category: 'grooming', desc: '专业美容修剪', price: 120, unit: '次' },
    { id: 'addon-walk', name: '额外遛狗', category: 'activity', desc: '每次30分钟户外遛狗', price: 30, unit: '次' },
    { id: 'addon-photo', name: '每日照片', category: 'report', desc: '每日宠物照片更新', price: 20, unit: '天' },
    { id: 'addon-video', name: '视频通话', category: 'report', desc: '与宠物视频通话10分钟', price: 50, unit: '次' },
    { id: 'addon-medicine', name: '喂药服务', category: 'medical', desc: '按医嘱喂药', price: 15, unit: '次' },
    { id: 'addon-tooth', name: '牙齿清洁', category: 'grooming', desc: '口腔清洁护理', price: 80, unit: '次' },
    { id: 'addon-treat', name: '高级零食', category: 'food', desc: '精选进口零食', price: 25, unit: '份' }
  ];

  for (const addon of addOns) {
    db.prepare(`
      INSERT INTO add_ons (id, name, category, description, price, unit)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(addon.id, addon.name, addon.category, addon.desc, addon.price, addon.unit);
  }
  console.log('Created add-on services...');

  const existingBookings = [
    {
      id: 'booking-demo-1',
      no: 'BK20260510001',
      petId: 'pet-002',
      roomId: 'room-standard',
      checkIn: today.subtract(2, 'day').format('YYYY-MM-DD'),
      checkOut: today.add(3, 'day').format('YYYY-MM-DD'),
      actualCheckIn: today.subtract(2, 'day').format('YYYY-MM-DD'),
      status: 'checked_in'
    }
  ];

  for (const b of existingBookings) {
    const roomCharge = 5 * 120;
    db.prepare(`
      INSERT INTO boarding_bookings (id, booking_no, pet_id, room_id, check_in_date, check_out_date, actual_check_in, status, total_amount, paid_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(b.id, b.no, b.petId, b.roomId, b.checkIn, b.checkOut, b.actualCheckIn, b.status, roomCharge, roomCharge);
  }
  console.log('Created demo booking for capacity test...');

  console.log('\n=== Seed Data Summary ===');
  console.log('Rooms:', db.prepare('SELECT COUNT(*) as c FROM rooms').get().c);
  console.log('Pets:', db.prepare('SELECT COUNT(*) as c FROM pets').get().c);
  console.log('Vaccine Records:', db.prepare('SELECT COUNT(*) as c FROM vaccine_records').get().c);
  console.log('Add-ons:', db.prepare('SELECT COUNT(*) as c FROM add_ons').get().c);
  console.log('Demo Bookings:', db.prepare('SELECT COUNT(*) as c FROM boarding_bookings').get().c);
  console.log('\n=== Test Scenarios Available ===');
  console.log('1. 正常预约: pet-001 (旺财) - 所有疫苗有效');
  console.log('2. 疫苗拦截: pet-003 (喵喵) - 疫苗已过期');
  console.log('3. 房型满员: 再订3个标准间会满 (当前已订1个，容量3)');
  console.log('4. 喂养禁忌: pet-002 (小黄) - 对牛肉过敏');
  console.log('5. 加购计费: 可添加洗澡、美容、遛狗等服务');
  console.log('\nSeed completed!');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };