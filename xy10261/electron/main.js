const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const XLSX = require('xlsx');
const { initDatabase, getDb } = require('./database');
const { validateReservation, executeSettlement, retrySettlement, calculateHours } = require('./settlementEngine');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  
  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(startUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(startUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase(app);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIPCHandlers() {
  ipcMain.handle('get:packages', () => {
    const db = getDb();
    return db.prepare('SELECT * FROM packages ORDER BY id').all();
  });

  ipcMain.handle('get:members', () => {
    const db = getDb();
    return db.prepare(`
      SELECT m.*, p.name as package_name, p.total_hours 
      FROM members m 
      LEFT JOIN packages p ON m.package_id = p.id 
      ORDER BY m.id
    `).all();
  });

  ipcMain.handle('get:rooms', () => {
    const db = getDb();
    return db.prepare('SELECT * FROM rooms ORDER BY id').all();
  });

  ipcMain.handle('get:reservations', () => {
    const db = getDb();
    return db.prepare(`
      SELECT r.*, m.name as member_name, rm.name as room_name,
             p.name as package_name,
             (SELECT COUNT(*) FROM access_logs al WHERE al.reservation_id = r.id AND al.event_type = 'check_in') as check_in_count,
             (SELECT COUNT(*) FROM access_logs al WHERE al.reservation_id = r.id AND al.event_type = 'check_out') as check_out_count
      FROM reservations r
      JOIN members m ON r.member_id = m.id
      JOIN rooms rm ON r.room_id = rm.id
      LEFT JOIN packages p ON m.package_id = p.id
      ORDER BY r.scheduled_start DESC
    `).all();
  });

  ipcMain.handle('get:access-logs', (event, reservationId) => {
    const db = getDb();
    if (reservationId) {
      return db.prepare('SELECT * FROM access_logs WHERE reservation_id = ? ORDER BY event_time').all(reservationId);
    }
    return db.prepare(`
      SELECT al.*, m.name as member_name, rm.name as room_name
      FROM access_logs al
      JOIN members m ON al.member_id = m.id
      JOIN rooms rm ON al.room_id = rm.id
      ORDER BY al.event_time DESC
      LIMIT 100
    `).all();
  });

  ipcMain.handle('get:settlements', (event, filters = {}) => {
    const db = getDb();
    let query = `
      SELECT s.*, m.name as member_name, rm.name as room_name,
             r.scheduled_start, r.scheduled_end, r.actual_start, r.actual_end,
             r.is_extended
      FROM settlements s
      JOIN members m ON s.member_id = m.id
      JOIN reservations r ON s.reservation_id = r.id
      JOIN rooms rm ON r.room_id = rm.id
    `;
    const params = [];
    
    if (filters.status) {
      query += ' WHERE s.status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY s.settlement_time DESC';
    
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('get:settlement-detail', (event, settlementId) => {
    const db = getDb();
    const settlement = db.prepare(`
      SELECT s.*, m.name as member_name, rm.name as room_name,
             r.scheduled_start, r.scheduled_end, r.actual_start, r.actual_end,
             r.is_extended, r.original_reservation_id
      FROM settlements s
      JOIN members m ON s.member_id = m.id
      JOIN reservations r ON s.reservation_id = r.id
      JOIN rooms rm ON r.room_id = rm.id
      WHERE s.id = ?
    `).get(settlementId);

    if (settlement) {
      settlement.accessLogs = db.prepare(`
        SELECT * FROM access_logs 
        WHERE reservation_id = ? 
        ORDER BY event_time
      `).all(settlement.reservation_id);

      settlement.history = db.prepare(`
        SELECT * FROM settlement_history 
        WHERE settlement_id = ? 
        ORDER BY created_at
      `).all(settlementId);

      if (settlement.verification_data) {
        try {
          settlement.verification_data = JSON.parse(settlement.verification_data);
        } catch (e) {
          // 保持原样
        }
      }
    }

    return settlement;
  });

  ipcMain.handle('create:member', (event, memberData) => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO members (name, phone, email, package_id, remaining_hours, used_hours)
      VALUES (?, ?, ?, ?, 0, 0)
    `);
    const info = stmt.run(memberData.name, memberData.phone, memberData.email, memberData.package_id);
    
    if (memberData.package_id) {
      const pkg = db.prepare('SELECT total_hours FROM packages WHERE id = ?').get(memberData.package_id);
      if (pkg) {
        db.prepare('UPDATE members SET remaining_hours = ? WHERE id = ?').run(pkg.total_hours, info.lastInsertRowid);
      }
    }
    
    return { success: true, id: info.lastInsertRowid };
  });

  ipcMain.handle('create:reservation', (event, reservationData) => {
    const validation = validateReservation(reservationData);
    
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        verificationData: validation.verificationData
      };
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO reservations 
      (member_id, room_id, scheduled_start, scheduled_end, status, is_extended, original_reservation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      reservationData.member_id,
      reservationData.room_id,
      reservationData.scheduled_start,
      reservationData.scheduled_end,
      'confirmed',
      reservationData.is_extended ? 1 : 0,
      reservationData.original_reservation_id || null
    );

    return {
      success: true,
      id: info.lastInsertRowid,
      verificationData: validation.verificationData
    };
  });

  ipcMain.handle('create:access-log', (event, logData) => {
    const db = getDb();
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(logData.reservation_id);
    
    if (!reservation) {
      return { success: false, error: '预约不存在' };
    }

    const stmt = db.prepare(`
      INSERT INTO access_logs (member_id, room_id, event_type, event_time, reservation_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      logData.member_id || reservation.member_id,
      logData.room_id || reservation.room_id,
      logData.event_type,
      logData.event_time,
      logData.reservation_id
    );

    if (logData.event_type === 'check_in') {
      db.prepare('UPDATE reservations SET actual_start = ?, status = ? WHERE id = ?')
        .run(logData.event_time, 'in_progress', logData.reservation_id);
    } else if (logData.event_type === 'check_out') {
      db.prepare('UPDATE reservations SET actual_end = ? WHERE id = ?')
        .run(logData.event_time, logData.reservation_id);
    }

    return { success: true, id: info.lastInsertRowid };
  });

  ipcMain.handle('execute:settlement', (event, reservationId) => {
    return executeSettlement(reservationId);
  });

  ipcMain.handle('retry:settlement', (event, settlementId, corrections) => {
    return retrySettlement(settlementId, corrections);
  });

  ipcMain.handle('extend:reservation', (event, { reservationId, newEndTime }) => {
    const db = getDb();
    const original = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
    
    if (!original) {
      return { success: false, error: '原预约不存在' };
    }

    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(original.member_id);
    const additionalHours = calculateHours(original.scheduled_end, newEndTime);

    if (member.remaining_hours < additionalHours) {
      return {
        success: false,
        error: `续时需要 ${additionalHours} 小时，剩余 ${member.remaining_hours} 小时`
      };
    }

    const extensionReservation = {
      member_id: original.member_id,
      room_id: original.room_id,
      scheduled_start: original.scheduled_end,
      scheduled_end: newEndTime,
      is_extended: 1,
      original_reservation_id: reservationId
    };

    const validation = validateReservation(extensionReservation);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const stmt = db.prepare(`
      INSERT INTO reservations 
      (member_id, room_id, scheduled_start, scheduled_end, status, is_extended, original_reservation_id)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    
    const info = stmt.run(
      original.member_id,
      original.room_id,
      original.scheduled_end,
      newEndTime,
      'confirmed',
      reservationId
    );

    return {
      success: true,
      id: info.lastInsertRowid,
      additionalHours,
      verificationData: validation.verificationData
    };
  });

  ipcMain.handle('export:settlements', async (event, filters = {}) => {
    const db = getDb();
    let query = `
      SELECT s.id as settlement_id, s.status,
             m.name as member_name, m.phone as member_phone,
             rm.name as room_name,
             r.scheduled_start, r.scheduled_end,
             s.scheduled_hours, s.actual_hours,
             s.package_deduction, s.cash_payment,
             s.error_message, s.settlement_time
      FROM settlements s
      JOIN members m ON s.member_id = m.id
      JOIN reservations r ON s.reservation_id = r.id
      JOIN rooms rm ON r.room_id = rm.id
    `;
    const params = [];
    
    if (filters.status) {
      query += ' WHERE s.status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY s.settlement_time DESC';
    
    const data = db.prepare(query).all(...params);

    const formattedData = data.map(row => ({
      '结算ID': row.settlement_id,
      '状态': {
        'success': '成功',
        'partial_cash': '部分现金',
        'failed': '失败',
        'needs_review': '待人工审核'
      }[row.status] || row.status,
      '会员': row.member_name,
      '电话': row.member_phone,
      '琴房': row.room_name,
      '预约开始': row.scheduled_start,
      '预约结束': row.scheduled_end,
      '预约时长(小时)': row.scheduled_hours,
      '实际时长(小时)': row.actual_hours,
      '套餐扣减(小时)': row.package_deduction,
      '现金支付(元)': row.cash_payment,
      '错误信息': row.error_message || '',
      '结算时间': row.settlement_time
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '结算记录');

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出结算记录',
      defaultPath: `结算记录_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });

    if (filePath) {
      XLSX.writeFile(wb, filePath);
      return { success: true, filePath };
    }

    return { success: false, canceled: true };
  });

  ipcMain.handle('search:history', (event, { startDate, endDate, status, memberId }) => {
    const db = getDb();
    let query = `
      SELECT s.*, m.name as member_name, rm.name as room_name
      FROM settlements s
      JOIN members m ON s.member_id = m.id
      JOIN reservations r ON s.reservation_id = r.id
      JOIN rooms rm ON r.room_id = rm.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      query += ' AND DATE(s.settlement_time) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(s.settlement_time) <= ?';
      params.push(endDate);
    }
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (memberId) {
      query += ' AND s.member_id = ?';
      params.push(memberId);
    }

    query += ' ORDER BY s.settlement_time DESC';

    return db.prepare(query).all(...params);
  });
}

setupIPCHandlers();
