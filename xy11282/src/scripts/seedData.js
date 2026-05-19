const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/pharmacy.db');
const db = new sqlite3.Database(dbPath);

const medicines = [
  {
    name: '阿莫西林',
    specification: '250mg/片',
    manufacturer: 'XX制药厂',
    dosageMin: 0.01,
    dosageMax: 0.05,
    dosageUnit: 'g/kg',
    frequency: '每日2次',
    contraindications: '["头孢氨苄"]'
  },
  {
    name: '头孢氨苄',
    specification: '125mg/片',
    manufacturer: 'YY制药厂',
    dosageMin: 0.015,
    dosageMax: 0.03,
    dosageUnit: 'g/kg',
    frequency: '每日2次',
    contraindications: '["阿莫西林"]'
  },
  {
    name: '氨溴索',
    specification: '30mg/片',
    manufacturer: 'ZZ制药厂',
    dosageMin: 0.002,
    dosageMax: 0.005,
    dosageUnit: 'g/kg',
    frequency: '每日2次',
    contraindications: '[]'
  },
  {
    name: '庆大霉素',
    specification: '20mg/片',
    manufacturer: 'AA制药厂',
    dosageMin: 0.005,
    dosageMax: 0.01,
    dosageUnit: 'g/kg',
    frequency: '每日1次',
    contraindications: '[]'
  },
  {
    name: '多西环素',
    specification: '100mg/片',
    manufacturer: 'BB制药厂',
    dosageMin: 0.005,
    dosageMax: 0.01,
    dosageUnit: 'g/kg',
    frequency: '每日1次',
    contraindications: '[]'
  }
];

const pets = [
  {
    name: '豆豆',
    species: '犬',
    breed: '金毛',
    weight: 25.5,
    weightUnit: 'kg',
    age: 3,
    gender: '公',
    ownerName: '张三',
    ownerPhone: '13800138000'
  },
  {
    name: '花花',
    species: '犬',
    breed: '泰迪',
    weight: 4.2,
    weightUnit: 'kg',
    age: 2,
    gender: '母',
    ownerName: '李四',
    ownerPhone: '13900139000'
  },
  {
    name: '咪咪',
    species: '猫',
    breed: '英短',
    weight: 5.8,
    weightUnit: 'kg',
    age: 1,
    gender: '公',
    ownerName: '王五',
    ownerPhone: '13700137000'
  }
];

const inventory = [
  {
    medicineId: 1,
    batchNumber: 'BATCH-2025-001',
    quantity: 100,
    unit: '片',
    productionDate: '2025-01-15',
    expiryDate: '2028-01-15'
  },
  {
    medicineId: 2,
    batchNumber: 'BATCH-2025-002',
    quantity: 50,
    unit: '片',
    productionDate: '2025-02-20',
    expiryDate: '2028-02-20'
  },
  {
    medicineId: 3,
    batchNumber: 'BATCH-2025-003',
    quantity: 80,
    unit: '片',
    productionDate: '2025-03-10',
    expiryDate: '2028-03-10'
  },
  {
    medicineId: 3,
    batchNumber: 'BATCH-2023-999',
    quantity: 20,
    unit: '片',
    productionDate: '2023-01-01',
    expiryDate: '2024-01-01'
  }
];

db.serialize(() => {
  console.log('开始导入样例数据...\n');
  
  const medicineStmt = db.prepare(`
    INSERT INTO medicines (name, specification, manufacturer, dosageMin, dosageMax, dosageUnit, frequency, contraindications)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  medicines.forEach(med => {
    medicineStmt.run(
      med.name, med.specification, med.manufacturer,
      med.dosageMin, med.dosageMax, med.dosageUnit,
      med.frequency, med.contraindications
    );
  });
  medicineStmt.finalize();
  console.log('✓ 药品数据导入完成 (5条)');
  
  const petStmt = db.prepare(`
    INSERT INTO pets (name, species, breed, weight, weightUnit, age, gender, ownerName, ownerPhone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  pets.forEach(pet => {
    petStmt.run(
      pet.name, pet.species, pet.breed, pet.weight, pet.weightUnit,
      pet.age, pet.gender, pet.ownerName, pet.ownerPhone
    );
  });
  petStmt.finalize();
  console.log('✓ 宠物数据导入完成 (3条)');
  
  const inventoryStmt = db.prepare(`
    INSERT INTO inventory (medicineId, batchNumber, quantity, unit, productionDate, expiryDate)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  inventory.forEach(inv => {
    inventoryStmt.run(
      inv.medicineId, inv.batchNumber, inv.quantity, inv.unit,
      inv.productionDate, inv.expiryDate
    );
  });
  inventoryStmt.finalize();
  console.log('✓ 库存数据导入完成 (3条，含1条过期)');
  
  console.log('\n✅ 样例数据导入成功!');
  console.log('\n数据摘要:');
  console.log('  - 药品: 阿莫西林、头孢氨苄、氨溴索、庆大霉素、多西环素');
  console.log('  - 宠物: 金毛豆豆(25.5kg)、泰迪花花(4.2kg)、英短咪咪(5.8kg)');
  console.log('  - 库存: 3条记录，其中BATCH-2023-999已过期');
  console.log('\n提示: 阿莫西林与头孢氨苄存在禁忌组合');
});

db.close();
