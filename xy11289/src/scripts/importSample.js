const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const sampleData = {
  booths: [
    { id: uuidv4(), name: 'A01-华为', manager: '张三', contact: '13800138001' },
    { id: uuidv4(), name: 'B02-小米', manager: '李四', contact: '13800138002' },
    { id: uuidv4(), name: 'C03-OPPO', manager: '王五', contact: '13800138003' },
    { id: uuidv4(), name: 'D04-仓库', manager: '赵六', contact: '13800138004' }
  ],
  equipments: [
    { id: uuidv4(), barcode: 'TRUSS001', name: '桁架-2米', type: 'truss' },
    { id: uuidv4(), barcode: 'TRUSS002', name: '桁架-3米', type: 'truss' },
    { id: uuidv4(), barcode: 'TRUSS003', name: '桁架-4米', type: 'truss' },
    { id: uuidv4(), barcode: 'LIGHT001', name: '帕灯', type: 'light' },
    { id: uuidv4(), barcode: 'LIGHT002', name: '追光灯', type: 'light' },
    { id: uuidv4(), barcode: 'SCREEN001', name: 'LED屏-55寸', type: 'screen' },
    { id: uuidv4(), barcode: 'SCREEN002', name: 'LED屏-65寸', type: 'screen' }
  ]
};

db.serialize(() => {
  const stmtBooth = db.prepare('INSERT INTO booths (id, name, manager, contact) VALUES (?, ?, ?, ?)');
  sampleData.booths.forEach(booth => {
    stmtBooth.run(booth.id, booth.name, booth.manager, booth.contact);
  });
  stmtBooth.finalize();

  const warehouseId = sampleData.booths.find(b => b.name.includes('仓库')).id;
  const stmtEquip = db.prepare('INSERT INTO equipments (id, barcode, name, type, status, current_booth_id) VALUES (?, ?, ?, ?, ?, ?)');
  sampleData.equipments.forEach(equip => {
    stmtEquip.run(equip.id, equip.barcode, equip.name, equip.type, 'available', warehouseId);
  });
  stmtEquip.finalize();

  console.log('样例数据导入完成');
  console.log('展位:', sampleData.booths.length, '个');
  console.log('设备:', sampleData.equipments.length, '个');
});

db.close();
