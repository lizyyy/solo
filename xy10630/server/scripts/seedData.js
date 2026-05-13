const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

const cards = [
  { card_id: 'C001', student_id: 'S2024001', student_name: '张三', balance: 500 },
  { card_id: 'C002', student_id: 'S2024002', student_name: '李四', balance: 350 },
  { card_id: 'C003', student_id: 'S2024003', student_name: '王五', balance: 280 },
  { card_id: 'C004', student_id: 'S2024004', student_name: '赵六', balance: 420 },
  { card_id: 'C005', student_id: 'S2024005', student_name: '钱七', balance: 150, status: 'frozen' },
];

const canteens = [
  { id: 'CAN001', name: '第一食堂' },
  { id: 'CAN002', name: '第二食堂' },
  { id: 'CAN003', name: '第三食堂' },
];

const devices = [
  { id: 'DEV001', canteen: 'CAN001' },
  { id: 'DEV002', canteen: 'CAN001' },
  { id: 'DEV003', canteen: 'CAN002' },
  { id: 'DEV004', canteen: 'CAN003' },
];

console.log('开始造数...');

db.serialize(() => {
  db.run('BEGIN TRANSACTION');

  cards.forEach(card => {
    db.run(`INSERT INTO cards (card_id, student_id, student_name, balance, status) 
      VALUES (?, ?, ?, ?, ?)`,
      [card.card_id, card.student_id, card.student_name, card.balance, card.status || 'normal']
    );
  });

  const today = new Date();
  for (let i = 0; i < 50; i++) {
    const txId = uuidv4();
    const card = cards[Math.floor(Math.random() * cards.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const canteen = canteens.find(c => c.id === device.canteen);
    const amount = (Math.random() * 30 + 5).toFixed(2);
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(Math.random() * 7));
    date.setHours(Math.floor(Math.random() * 12) + 7);

    db.run(`INSERT INTO offline_transactions 
      (tx_id, card_id, amount, canteen_id, canteen_name, device_id, tx_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, card.card_id, amount, canteen.id, canteen.name, device.id, date.toISOString(), 'completed'],
      function(err) {
        if (err) console.error(err);
      }
    );
  }

  for (let i = 0; i < 15; i++) {
    const orderId = uuidv4();
    const card = cards[Math.floor(Math.random() * cards.length)];
    const amount = Math.floor(Math.random() * 200) + 50;
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(Math.random() * 7));

    db.run(`INSERT INTO recharge_orders 
      (order_id, card_id, amount, recharge_type, status, operator)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, card.card_id, amount, 'online', 'completed', 'admin'],
      function(err) {
        if (err) console.error(err);
      }
    );
  }

  const freezeLogId = uuidv4();
  db.run(`INSERT INTO freeze_logs 
    (log_id, card_id, operation_type, reason, operator, before_status, after_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [freezeLogId, 'C005', 'freeze', '用户申请冻结', 'admin', 'normal', 'frozen']
  );

  db.run('COMMIT', (err) => {
    if (err) {
      console.error('造数失败:', err);
    } else {
      console.log('造数完成！');
      console.log(`- ${cards.length} 张餐卡`);
      console.log(`- 50 条交易记录`);
      console.log(`- 15 条充值记录`);
      console.log(`- 1 条冻结记录`);
    }
    db.close();
  });
});
