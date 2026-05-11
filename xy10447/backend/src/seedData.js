const { v4: uuidv4 } = require('uuid');
const { db } = require('./database');

function generateSeats(hallId, rows, cols, vipRows = []) {
  const seats = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const seatCode = `${String.fromCharCode(64 + r)}${c}`;
      seats.push({
        id: uuidv4(),
        hallId,
        rowNo: r,
        colNo: c,
        seatCode,
        isVip: vipRows.includes(r) ? 1 : 0,
        isDisabled: (r === 3 && c === 5) ? 1 : 0
      });
    }
  }
  return seats;
}

function seedData() {
  const existingMovies = db.prepare('SELECT COUNT(*) as count FROM movies').get();
  if (existingMovies && existingMovies.count > 0) return;

  const movie1Id = uuidv4();
  const movie2Id = uuidv4();
  const movie3Id = uuidv4();

  db.prepare(`
    INSERT INTO movies (id, name, duration, genre, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(movie1Id, '星际穿越', 169, '科幻', '一部关于时间与空间的史诗级科幻电影');

  db.prepare(`
    INSERT INTO movies (id, name, duration, genre, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(movie2Id, '流浪地球3', 130, '科幻', '中国科幻巨制');

  db.prepare(`
    INSERT INTO movies (id, name, duration, genre, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(movie3Id, '热辣滚烫', 125, '喜剧', '励志喜剧电影');

  const smallHallId = uuidv4();
  const mediumHallId = uuidv4();
  const largeHallId = uuidv4();
  const vipHallId = uuidv4();

  db.prepare(`
    INSERT INTO halls (id, name, type, rows, cols)
    VALUES (?, ?, 'small', ?, ?)
  `).run(smallHallId, '1号厅(小厅)', 6, 8);

  db.prepare(`
    INSERT INTO halls (id, name, type, rows, cols)
    VALUES (?, ?, 'medium', ?, ?)
  `).run(mediumHallId, '2号厅(中厅)', 8, 12);

  db.prepare(`
    INSERT INTO halls (id, name, type, rows, cols)
    VALUES (?, ?, 'large', ?, ?)
  `).run(largeHallId, '3号厅(大厅)', 10, 16);

  db.prepare(`
    INSERT INTO halls (id, name, type, rows, cols)
    VALUES (?, ?, 'vip', ?, ?)
  `).run(vipHallId, 'VIP厅', 4, 6);

  const smallSeats = generateSeats(smallHallId, 6, 8, [1]);
  const mediumSeats = generateSeats(mediumHallId, 8, 12, [1, 2]);
  const largeSeats = generateSeats(largeHallId, 10, 16, [1, 2, 3]);
  const vipSeats = generateSeats(vipHallId, 4, 6, [1, 2, 3, 4]);

  const seatStmt = db.prepare(`
    INSERT INTO seats (id, hall_id, row_no, col_no, seat_code, is_vip, is_disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  [...smallSeats, ...mediumSeats, ...largeSeats, ...vipSeats].forEach(seat => {
    seatStmt.run(seat.id, seat.hallId, seat.rowNo, seat.colNo, seat.seatCode, seat.isVip, seat.isDisabled);
  });

  const now = new Date();
  const schedule1Start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const schedule1End = new Date(schedule1Start.getTime() + 169 * 60 * 1000);
  
  const schedule2Start = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const schedule2End = new Date(schedule2Start.getTime() + 130 * 60 * 1000);
  
  const schedule3Start = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const schedule3End = new Date(schedule3Start.getTime() + 125 * 60 * 1000);

  const schedule1Id = uuidv4();
  const schedule2Id = uuidv4();
  const schedule3Id = uuidv4();

  db.prepare(`
    INSERT INTO schedules (id, movie_id, hall_id, start_time, end_time, base_price, vip_surcharge, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(schedule1Id, movie1Id, smallHallId, schedule1Start.toISOString(), schedule1End.toISOString(), 35.00, 15.00);

  db.prepare(`
    INSERT INTO schedules (id, movie_id, hall_id, start_time, end_time, base_price, vip_surcharge, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(schedule2Id, movie2Id, largeHallId, schedule2Start.toISOString(), schedule2End.toISOString(), 45.00, 20.00);

  db.prepare(`
    INSERT INTO schedules (id, movie_id, hall_id, start_time, end_time, base_price, vip_surcharge, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(schedule3Id, movie3Id, mediumHallId, schedule3Start.toISOString(), schedule3End.toISOString(), 38.00, 12.00);

  const ticketStmt = db.prepare(`
    INSERT INTO tickets (id, schedule_id, seat_id, price, paid_price, status, customer_name, customer_phone, order_no)
    VALUES (?, ?, ?, ?, ?, 'sold', ?, ?, ?)
  `);

  const smallHallSeats = db.prepare('SELECT * FROM seats WHERE hall_id = ? ORDER BY row_no, col_no').all(smallHallId);
  const largeHallSeats = db.prepare('SELECT * FROM seats WHERE hall_id = ? ORDER BY row_no, col_no').all(largeHallId);
  const mediumHallSeats = db.prepare('SELECT * FROM seats WHERE hall_id = ? ORDER BY row_no, col_no').all(mediumHallId);

  const customers = [
    { name: '张三', phone: '13800138001' },
    { name: '李四', phone: '13800138002' },
    { name: '王五', phone: '13800138003' },
    { name: '赵六', phone: '13800138004' },
    { name: '钱七', phone: '13800138005' },
    { name: '孙八', phone: '13800138006' },
    { name: '周九', phone: '13800138007' },
    { name: '吴十', phone: '13800138008' },
    { name: '郑十一', phone: '13800138009' },
    { name: '王十二', phone: '13800138010' }
  ];

  for (let i = 0; i < 8; i++) {
    const seat = smallHallSeats[i];
    if (seat) {
      const price = seat.is_vip ? 50 : 35;
      ticketStmt.run(
        uuidv4(),
        schedule1Id,
        seat.id,
        price,
        price,
        customers[i % customers.length].name,
        customers[i % customers.length].phone,
        `ORD${String(Date.now() + i).slice(-8)}`
      );
    }
  }

  for (let i = 0; i < 20; i++) {
    const seat = largeHallSeats[i];
    if (seat) {
      const price = seat.is_vip ? 65 : 45;
      ticketStmt.run(
        uuidv4(),
        schedule2Id,
        seat.id,
        price,
        price,
        customers[i % customers.length].name,
        customers[i % customers.length].phone,
        `ORD${String(Date.now() + 100 + i).slice(-8)}`
      );
    }
  }

  for (let i = 0; i < 12; i++) {
    const seat = mediumHallSeats[i];
    if (seat) {
      const price = seat.is_vip ? 50 : 38;
      ticketStmt.run(
        uuidv4(),
        schedule3Id,
        seat.id,
        price,
        price,
        customers[i % customers.length].name,
        customers[i % customers.length].phone,
        `ORD${String(Date.now() + 200 + i).slice(-8)}`
      );
    }
  }

  console.log('示例数据已加载');
}

module.exports = { seedData };
