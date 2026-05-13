const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

const sampleTechnicians = [
  { name: '张师傅', phone: '13800138001', status: '空闲', currentLocation: '朝阳区三里屯', currentLat: 39.9356, currentLng: 116.4541, skills: ['轮胎更换', '电瓶搭电'] },
  { name: '李师傅', phone: '13800138002', status: '忙碌', currentLocation: '海淀区中关村', currentLat: 39.9847, currentLng: 116.3046, skills: ['发动机维修', '电路检测'] },
  { name: '王师傅', phone: '13800138003', status: '空闲', currentLocation: '西直门', currentLat: 39.9421, currentLng: 116.3521, skills: ['拖车服务', '轮胎更换'] }
];

const sampleSpareParts = [
  { name: '普通轮胎', code: 'TYRE-001', quantity: 20, unit: '个', location: 'A库-01', threshold: 5 },
  { name: '防爆轮胎', code: 'TYRE-002', quantity: 8, unit: '个', location: 'A库-02', threshold: 3 },
  { name: '汽车电瓶', code: 'BATT-001', quantity: 15, unit: '个', location: 'B库-01', threshold: 5 },
  { name: '拖车钩', code: 'TOW-001', quantity: 3, unit: '个', location: 'C库-01', threshold: 2 }
];

const sampleOrders = [
  {
    ownerName: '王先生',
    ownerPhone: '13900139001',
    ownerLocation: '朝阳区望京',
    ownerLocationLat: 39.9929,
    ownerLocationLng: 116.4735,
    faultType: '轮胎爆胎',
    faultDescription: '左前胎爆胎，需要更换',
    createdBy: '客服小明'
  },
  {
    ownerName: '李女士',
    ownerPhone: '13900139002',
    ownerLocation: '海淀区五道口',
    ownerLocationLat: 39.9939,
    ownerLocationLng: 116.3456,
    faultType: '电瓶没电',
    faultDescription: '车辆无法启动，需要搭电',
    createdBy: '客服小红'
  },
  {
    ownerName: '张先生',
    ownerPhone: '13900139003',
    ownerLocation: '东城区王府井',
    ownerLocationLat: 39.9147,
    ownerLocationLng: 116.4108,
    faultType: '发动机故障',
    faultDescription: '发动机异响，无法正常行驶',
    createdBy: '客服小明'
  }
];

function generateOrderNo(callback) {
  const db = getDb();
  const date = new Date();
  const prefix = 'RD' + date.getFullYear().toString().slice(-2) +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  db.get('SELECT COUNT(*) as count FROM orders WHERE orderNo LIKE ?', [prefix + '%'], (err, row) => {
    if (err) {
      let counter = 1;
      callback(prefix + counter.toString().padStart(4, '0'));
    } else {
      callback(prefix + (row.count + 1).toString().padStart(4, '0'));
    }
  });
}

function addTimeline(orderId, status, previousStatus, action, reason, operator, changes = {}) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = Date.now();
    db.run(
      'INSERT INTO order_timeline (id, orderId, status, previousStatus, action, reason, operator, changes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, orderId, status, previousStatus, action, reason, operator, JSON.stringify(changes), now],
      (err) => err ? reject(err) : resolve(id)
    );
  });
}

module.exports = function() {
  const db = getDb();
  db.get('SELECT COUNT(*) as count FROM technicians', (err, row) => {
    if (row && row.count === 0) {
      console.log('初始化技师数据...');
      sampleTechnicians.forEach(tech => {
        db.run(
          'INSERT INTO technicians (id, name, phone, status, currentLocation, currentLat, currentLng, skills, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), tech.name, tech.phone, tech.status, tech.currentLocation, tech.currentLat, tech.currentLng, JSON.stringify(tech.skills), Date.now()]
        );
      });
    }
  });

  db.get('SELECT COUNT(*) as count FROM spare_parts', (err, row) => {
    if (row && row.count === 0) {
      console.log('初始化备件数据...');
      sampleSpareParts.forEach(part => {
        db.run(
          'INSERT INTO spare_parts (id, name, code, quantity, unit, location, threshold, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), part.name, part.code, part.quantity, part.unit, part.location, part.threshold, Date.now()]
        );
      });
    }
  });

  db.get('SELECT COUNT(*) as count FROM orders', (err, row) => {
    if (row && row.count === 0) {
      console.log('初始化工单数据...');
      sampleOrders.forEach((order, index) => {
        generateOrderNo((orderNo) => {
          const orderId = uuidv4();
          const now = Date.now();
          db.run(
            'INSERT INTO orders (id, orderNo, ownerName, ownerPhone, ownerLocation, ownerLocationLat, ownerLocationLng, faultType, faultDescription, status, createdAt, updatedAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [orderId, orderNo, order.ownerName, order.ownerPhone, order.ownerLocation, order.ownerLocationLat, order.ownerLocationLng, order.faultType, order.faultDescription, '待派单', now, now, order.createdBy],
            async () => {
              await addTimeline(orderId, '待派单', null, '创建工单', '车主发起救援请求', order.createdBy);
            }
          );
        });
      });
    }
  });
};
