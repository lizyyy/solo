const { v4: uuidv4 } = require('uuid');

const workOrders = new Map();
const spareParts = new Map();
const inventory = new Map();
const requisitions = new Map();
const costs = new Map();
const maintenanceStaff = new Map();
const equipment = new Map();

function initSampleData() {
  maintenanceStaff.set('S001', {
    id: 'S001',
    name: '张师傅',
    department: '维修组A'
  });
  maintenanceStaff.set('S002', {
    id: 'S002',
    name: '李师傅',
    department: '维修组B'
  });

  equipment.set('E001', {
    id: 'E001',
    name: '中央空调A-01',
    type: 'AC',
    location: '一号楼1层'
  });
  equipment.set('E002', {
    id: 'E002',
    name: '驱动电机M-05',
    type: 'MOTOR',
    location: '二号车间'
  });
  equipment.set('E003', {
    id: 'E003',
    name: '温度传感器TS-12',
    type: 'SENSOR',
    location: '三号车间'
  });

  const parts = [
    { id: 'P001', name: '空调压缩机', category: 'AC', unitPrice: 12000, underWarranty: false },
    { id: 'P002', name: '空调过滤网', category: 'AC', unitPrice: 200, underWarranty: true },
    { id: 'P003', name: '电机定子绕组', category: 'MOTOR', unitPrice: 5000, underWarranty: false },
    { id: 'P004', name: '电机轴承', category: 'MOTOR', unitPrice: 800, underWarranty: true },
    { id: 'P005', name: '温度传感器探头', category: 'SENSOR', unitPrice: 1500, underWarranty: false },
    { id: 'P006', name: '传感器连接线', category: 'SENSOR', unitPrice: 100, underWarranty: true }
  ];

  parts.forEach(part => spareParts.set(part.id, part));

  const stockItems = [
    { partId: 'P001', quantity: 3, minStock: 1 },
    { partId: 'P002', quantity: 20, minStock: 5 },
    { partId: 'P003', quantity: 2, minStock: 1 },
    { partId: 'P004', quantity: 5, minStock: 2 },
    { partId: 'P005', quantity: 1, minStock: 1 },
    { partId: 'P006', quantity: 30, minStock: 10 }
  ];

  stockItems.forEach(item => inventory.set(item.partId, item));
}

function generateId() {
  return uuidv4();
}

module.exports = {
  workOrders,
  spareParts,
  inventory,
  requisitions,
  costs,
  maintenanceStaff,
  equipment,
  initSampleData,
  generateId
};
