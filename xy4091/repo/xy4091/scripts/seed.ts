import { initDatabase, closeDatabase } from '../src/storage/database';
import { createWard, createBloodBag } from '../src/storage';
import { CreateWardInput, CreateBloodBagInput } from '../src/types';

const sampleWards: CreateWardInput[] = [
  {
    name: '内科ICU',
    code: 'ICU-01',
    department: '内科',
    floor: 5,
    contactPerson: '张医生',
    contactPhone: '13800138001',
  },
  {
    name: '外科ICU',
    code: 'SICU-01',
    department: '外科',
    floor: 6,
    contactPerson: '李医生',
    contactPhone: '13800138002',
  },
  {
    name: '心内科',
    code: 'CARD-01',
    department: '内科',
    floor: 3,
    contactPerson: '王医生',
    contactPhone: '13800138003',
  },
  {
    name: '急诊科',
    code: 'ER-01',
    department: '急诊',
    floor: 1,
    contactPerson: '赵医生',
    contactPhone: '13800138004',
  },
  {
    name: '产科',
    code: 'OB-01',
    department: '妇产科',
    floor: 8,
    contactPerson: '刘医生',
    contactPhone: '13800138005',
  },
];

function getFutureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getPastDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const sampleBloodBags: CreateBloodBagInput[] = [
  {
    bloodType: 'A+',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D001',
    collectionDate: getPastDate(10),
    expiryDate: getFutureDate(25),
    crossMatchStatus: 'COMPATIBLE',
    initialTemperature: 4.0,
    notes: '常规库存',
  },
  {
    bloodType: 'A+',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D002',
    collectionDate: getPastDate(25),
    expiryDate: getFutureDate(5),
    crossMatchStatus: 'COMPATIBLE',
    initialTemperature: 3.8,
    notes: '临期血袋，优先使用',
  },
  {
    bloodType: 'A+',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D003',
    collectionDate: getPastDate(20),
    expiryDate: getFutureDate(15),
    crossMatchStatus: 'COMPATIBLE',
    initialTemperature: 4.2,
    notes: '',
  },
  {
    bloodType: 'A-',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D004',
    collectionDate: getPastDate(5),
    expiryDate: getFutureDate(30),
    crossMatchStatus: 'PENDING',
    initialTemperature: 3.9,
    notes: '稀有血型，待交叉配血',
  },
  {
    bloodType: 'B+',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D005',
    collectionDate: getPastDate(15),
    expiryDate: getFutureDate(20),
    crossMatchStatus: 'COMPATIBLE',
    initialTemperature: 4.1,
    notes: '',
  },
  {
    bloodType: 'B+',
    componentType: 'PLASMA',
    volume: 250,
    donorId: 'D006',
    collectionDate: getPastDate(30),
    expiryDate: getFutureDate(335),
    crossMatchStatus: 'NOT_REQUIRED',
    initialTemperature: -25.0,
    notes: '新鲜冰冻血浆，-25℃保存',
  },
  {
    bloodType: 'O+',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D007',
    collectionDate: getPastDate(8),
    expiryDate: getFutureDate(27),
    crossMatchStatus: 'COMPATIBLE',
    initialTemperature: 3.7,
    notes: '万能供血者',
  },
  {
    bloodType: 'O+',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D008',
    collectionDate: getPastDate(28),
    expiryDate: getFutureDate(2),
    crossMatchStatus: 'COMPATIBLE',
    initialTemperature: 4.0,
    notes: '紧急临期！2天内到期',
  },
  {
    bloodType: 'O-',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D009',
    collectionDate: getPastDate(3),
    expiryDate: getFutureDate(32),
    crossMatchStatus: 'PENDING',
    initialTemperature: 3.8,
    notes: '稀有血型-万能供血者',
  },
  {
    bloodType: 'AB+',
    componentType: 'RED_CELL',
    volume: 200,
    donorId: 'D010',
    collectionDate: getPastDate(12),
    expiryDate: getFutureDate(23),
    crossMatchStatus: 'COMPATIBLE',
    initialTemperature: 4.0,
    notes: '',
  },
  {
    bloodType: 'AB+',
    componentType: 'PLASMA',
    volume: 250,
    donorId: 'D011',
    collectionDate: getPastDate(20),
    expiryDate: getFutureDate(345),
    crossMatchStatus: 'NOT_REQUIRED',
    initialTemperature: -24.5,
    notes: 'AB型血浆，万能受血者',
  },
  {
    bloodType: 'A+',
    componentType: 'PLASMA',
    volume: 250,
    donorId: 'D012',
    collectionDate: getPastDate(10),
    expiryDate: getFutureDate(355),
    crossMatchStatus: 'NOT_REQUIRED',
    initialTemperature: -25.5,
    notes: '',
  },
];

async function seed() {
  console.log('初始化数据库...');
  await initDatabase();

  console.log('创建病区数据...');
  for (const ward of sampleWards) {
    const created = createWard(ward);
    console.log(`  ✓ 病区: ${created.name} (${created.code})`);
  }

  console.log('创建血袋数据...');
  for (const bag of sampleBloodBags) {
    const created = createBloodBag(bag);
    console.log(`  ✓ 血袋: ${created.id} - ${created.bloodType} ${created.componentType}`);
  }

  console.log('');
  console.log('========================================');
  console.log('示例数据创建完成！');
  console.log('========================================');
  console.log(`创建了 ${sampleWards.length} 个病区`);
  console.log(`创建了 ${sampleBloodBags.length} 袋血制品`);
  console.log('========================================');

  closeDatabase();
}

seed().catch((error) => {
  console.error('初始化失败:', error);
  process.exit(1);
});
