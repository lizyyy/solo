const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./database');
const hallExchangeService = require('./hallExchangeService');

const router = express.Router();

router.get('/movies', (req, res) => {
  const movies = db.prepare('SELECT * FROM movies ORDER BY created_at DESC').all();
  res.json(movies);
});

router.post('/movies', (req, res) => {
  const { name, duration, genre, description } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO movies (id, name, duration, genre, description) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, duration, genre, description);
  res.status(201).json({ id, name, duration, genre, description });
});

router.get('/halls', (req, res) => {
  const halls = db.prepare(`
    SELECT h.*, COUNT(s.id) as seat_count
    FROM halls h
    LEFT JOIN seats s ON h.id = s.hall_id AND s.is_disabled = 0
    GROUP BY h.id
    ORDER BY h.name
  `).all();
  res.json(halls);
});

router.post('/halls', (req, res) => {
  const { name, type, rows, cols } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO halls (id, name, type, rows, cols) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, type || 'normal', rows, cols);
  
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const seatCode = `${String.fromCharCode(64 + r)}${c}`;
      db.prepare('INSERT INTO seats (id, hall_id, row_no, col_no, seat_code) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), id, r, c, seatCode);
    }
  }
  res.status(201).json({ id, name, type, rows, cols });
});

router.get('/halls/:id/seats', (req, res) => {
  const seats = db.prepare(`
    SELECT * FROM seats WHERE hall_id = ? ORDER BY row_no, col_no
  `).all(req.params.id);
  res.json(seats);
});

router.get('/schedules', (req, res) => {
  const schedules = db.prepare(`
    SELECT s.*, m.name as movie_name, h.name as hall_name,
           (SELECT COUNT(*) FROM tickets WHERE schedule_id = s.id AND status = 'sold') as sold_count
    FROM schedules s
    JOIN movies m ON s.movie_id = m.id
    JOIN halls h ON s.hall_id = h.id
    ORDER BY s.start_time DESC
  `).all();
  res.json(schedules);
});

router.post('/schedules', (req, res) => {
  const { movie_id, hall_id, start_time, end_time, base_price, vip_surcharge } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO schedules (id, movie_id, hall_id, start_time, end_time, base_price, vip_surcharge)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, movie_id, hall_id, start_time, end_time, base_price, vip_surcharge || 0);
  res.status(201).json({ id });
});

router.get('/schedules/:id/tickets', (req, res) => {
  const tickets = db.prepare(`
    SELECT t.*, s.seat_code, s.row_no, s.col_no, s.is_vip
    FROM tickets t
    JOIN seats s ON t.seat_id = s.id
    WHERE t.schedule_id = ?
    ORDER BY s.row_no, s.col_no
  `).all(req.params.id);
  res.json(tickets);
});

router.post('/tickets', (req, res) => {
  const { schedule_id, seat_id, price, paid_price, customer_name, customer_phone, order_no } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO tickets (id, schedule_id, seat_id, price, paid_price, customer_name, customer_phone, order_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, schedule_id, seat_id, price, paid_price, customer_name, customer_phone, order_no);
  res.status(201).json({ id });
});

router.post('/hall-exchange', (req, res) => {
  const { original_schedule_id, target_hall_id, reason } = req.body;
  const result = hallExchangeService.createExchangeRequest(original_schedule_id, target_hall_id, reason);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json({ error: result.error });
  }
});

router.get('/hall-exchange/:id', (req, res) => {
  const details = hallExchangeService.getExchangeDetails(req.params.id);
  if (details) {
    res.json(details);
  } else {
    res.status(404).json({ error: '换厅申请不存在' });
  }
});

router.get('/hall-exchange', (req, res) => {
  const requests = db.prepare(`
    SELECT r.*, m.name as movie_name, oh.name as original_hall, th.name as target_hall,
           os.start_time
    FROM hall_exchange_requests r
    JOIN schedules os ON r.original_schedule_id = os.id
    JOIN movies m ON os.movie_id = m.id
    JOIN halls oh ON os.hall_id = oh.id
    JOIN halls th ON r.target_hall_id = th.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(requests);
});

router.post('/hall-exchange/:requestId/mappings/:mappingId/confirm', (req, res) => {
  const result = hallExchangeService.confirmExchangeMapping(req.params.mappingId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json({ error: result.error });
  }
});

router.post('/hall-exchange/:requestId/mappings/:mappingId/assign', (req, res) => {
  const { new_seat_id } = req.body;
  const result = hallExchangeService.resolveManualSeat(req.params.mappingId, new_seat_id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json({ error: result.error });
  }
});

router.post('/hall-exchange/:requestId/mappings/:mappingId/refund', (req, res) => {
  const { reason } = req.body;
  const result = hallExchangeService.processRefund(req.params.mappingId, reason);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json({ error: result.error });
  }
});

router.post('/hall-exchange/:id/complete', (req, res) => {
  const result = hallExchangeService.completeExchangeRequest(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json({ error: result.error });
  }
});

router.get('/notifications', (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(notifications);
});

router.get('/refunds', (req, res) => {
  const refunds = db.prepare(`
    SELECT r.*, t.customer_name, t.order_no
    FROM refunds r
    JOIN tickets t ON r.ticket_id = t.id
    ORDER BY r.created_at DESC
  `).all();
  res.json(refunds);
});

module.exports = router;
