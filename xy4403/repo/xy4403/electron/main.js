const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const Database = require('better-sqlite3')
const fs = require('fs')

let mainWindow
let db

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'darkroom.db')
  console.log('Database path:', dbPath)
  
  db = new Database(dbPath)
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'processing',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      student_name TEXT NOT NULL,
      student_id TEXT NOT NULL,
      film_type TEXT NOT NULL,
      film_count INTEGER NOT NULL,
      appointment_date DATE NOT NULL,
      dark_bag_number TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS chemical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chemical_type TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      concentration REAL NOT NULL,
      total_volume REAL NOT NULL,
      used_count INTEGER DEFAULT 0,
      max_uses INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS dark_bags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bag_number TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'available',
      current_appointment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS pickup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      picker_name TEXT NOT NULL,
      picker_id TEXT NOT NULL,
      pickup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_authorizer_overridden INTEGER DEFAULT 0,
      override_reason TEXT,
      notes TEXT,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    );

    CREATE TABLE IF NOT EXISTS rule_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      violation_type TEXT NOT NULL,
      violation_message TEXT NOT NULL,
      is_overridden INTEGER DEFAULT 0,
      override_reason TEXT,
      overridden_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      operator TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

function logAudit(action, tableName, recordId, oldValues, newValues) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (action, table_name, record_id, old_values, new_values)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(
    action,
    tableName,
    recordId,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null
  )
}

function checkChemicalRules(chemical) {
  const violations = []
  
  if (chemical.used_count >= chemical.max_uses) {
    violations.push({
      type: 'developer_exceeded_life',
      message: `显影液已超过最大使用次数: ${chemical.used_count}/${chemical.max_uses}`
    })
  }
  
  const createdDate = new Date(chemical.created_at)
  const now = new Date()
  const daysDiff = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24))
  
  if (daysDiff > 30 && chemical.chemical_type === 'developer') {
    violations.push({
      type: 'developer_expired',
      message: `显影液已超过30天有效期: 已使用${daysDiff}天`
    })
  }
  
  return violations
}

function checkFixingRules(appointment) {
  const violations = []
  if (appointment.film_type === 'color' && appointment.processing_time < 15) {
    violations.push({
      type: 'fixing_insufficient',
      message: `彩色胶片定影时间不足: ${appointment.processing_time}分钟(建议至少15分钟)`
    })
  }
  return violations
}

function checkDarkBagDuplicate(bagNumber, excludeId = null) {
  let stmt
  if (excludeId) {
    stmt = db.prepare('SELECT * FROM dark_bags WHERE bag_number = ? AND id != ?')
    return stmt.get(bagNumber, excludeId) !== undefined
  } else {
    stmt = db.prepare('SELECT * FROM dark_bags WHERE bag_number = ?')
    return stmt.get(bagNumber) !== undefined
  }
}

function checkAppointmentPickupMatch(appointmentId, pickerName, pickerId) {
  const stmt = db.prepare('SELECT * FROM appointments WHERE id = ?')
  const appointment = stmt.get(appointmentId)
  
  if (!appointment) return { match: false, message: '预约记录不存在' }
  
  const nameMatch = appointment.student_name === pickerName
  const idMatch = appointment.student_id === pickerId
  
  if (nameMatch && idMatch) {
    return { match: true, message: '取片人与预约人一致' }
  } else {
    return { 
      match: false, 
      message: `取片人不一致: 预约人(${appointment.student_name}, ${appointment.student_id}) vs 取片人(${pickerName}, ${pickerId})`
    }
  }
}

function checkAllRulesForBatch(batchId) {
  const violations = []
  
  const appointmentStmt = db.prepare(`
    SELECT a.*, b.batch_number 
    FROM appointments a 
    JOIN batches b ON a.batch_id = b.id 
    WHERE a.batch_id = ?
  `)
  const appointments = appointmentStmt.all(batchId)
  
  const chemicalStmt = db.prepare(`
    SELECT * FROM chemical_records 
    WHERE status = 'active'
  `)
  const chemicals = chemicalStmt.all()
  
  for (const chemical of chemicals) {
    const chemicalViolations = checkChemicalRules(chemical)
    for (const v of chemicalViolations) {
      violations.push({
        ...v,
        record_type: 'chemical',
        record_id: chemical.id
      })
    }
  }
  
  const bagStmt = db.prepare(`
    SELECT bag_number, COUNT(*) as count 
    FROM appointments 
    WHERE batch_id = ? AND dark_bag_number IS NOT NULL
    GROUP BY dark_bag_number
    HAVING count > 1
  `)
  const duplicateBags = bagStmt.all(batchId)
  
  for (const bag of duplicateBags) {
    violations.push({
      type: 'dark_bag_duplicate',
      message: `暗袋编号重复: ${bag.bag_number} 已在本批次中使用${bag.count}次`,
      record_type: 'appointment',
      record_id: null
    })
  }
  
  return violations
}

app.whenReady().then(() => {
  initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (db) db.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('get-all-batches', () => {
  const stmt = db.prepare('SELECT * FROM batches ORDER BY created_at DESC')
  return stmt.all()
})

ipcMain.handle('get-batch-by-id', (event, id) => {
  const stmt = db.prepare('SELECT * FROM batches WHERE id = ?')
  return stmt.get(id)
})

ipcMain.handle('create-batch', (event, batchData) => {
  const stmt = db.prepare('INSERT INTO batches (batch_number, notes) VALUES (?, ?)')
  const result = stmt.run(batchData.batch_number, batchData.notes)
  logAudit('create', 'batches', result.lastInsertRowid, null, batchData)
  return { success: true, id: result.lastInsertRowid }
})

ipcMain.handle('update-batch-status', (event, { id, status, notes }) => {
  const oldStmt = db.prepare('SELECT * FROM batches WHERE id = ?')
  const oldData = oldStmt.get(id)
  
  const stmt = db.prepare('UPDATE batches SET status = ?, notes = ? WHERE id = ?')
  const result = stmt.run(status, notes, id)
  
  logAudit('update', 'batches', id, oldData, { status, notes })
  return { success: true, changes: result.changes }
})

ipcMain.handle('get-appointments-by-batch', (event, batchId) => {
  const stmt = db.prepare(`
    SELECT a.*, p.picker_name, p.pickup_date, p.is_authorizer_overridden
    FROM appointments a
    LEFT JOIN pickup_records p ON a.id = p.appointment_id
    WHERE a.batch_id = ?
    ORDER BY a.created_at DESC
  `)
  return stmt.all(batchId)
})

ipcMain.handle('get-all-appointments', () => {
  const stmt = db.prepare(`
    SELECT a.*, b.batch_number, p.picker_name, p.pickup_date
    FROM appointments a
    LEFT JOIN batches b ON a.batch_id = b.id
    LEFT JOIN pickup_records p ON a.id = p.appointment_id
    ORDER BY a.created_at DESC
  `)
  return stmt.all()
})

ipcMain.handle('create-appointment', (event, appointmentData) => {
  const stmt = db.prepare(`
    INSERT INTO appointments 
    (batch_id, student_name, student_id, film_type, film_count, appointment_date, dark_bag_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    appointmentData.batch_id,
    appointmentData.student_name,
    appointmentData.student_id,
    appointmentData.film_type,
    appointmentData.film_count,
    appointmentData.appointment_date,
    appointmentData.dark_bag_number
  )
  logAudit('create', 'appointments', result.lastInsertRowid, null, appointmentData)
  return { success: true, id: result.lastInsertRowid }
})

ipcMain.handle('update-appointment', (event, { id, ...updateData }) => {
  const oldStmt = db.prepare('SELECT * FROM appointments WHERE id = ?')
  const oldData = oldStmt.get(id)
  
  const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ')
  const values = [...Object.values(updateData), id]
  
  const stmt = db.prepare(`UPDATE appointments SET ${fields} WHERE id = ?`)
  const result = stmt.run(...values)
  
  logAudit('update', 'appointments', id, oldData, updateData)
  return { success: true, changes: result.changes }
})

ipcMain.handle('get-all-chemicals', () => {
  const stmt = db.prepare('SELECT * FROM chemical_records ORDER BY created_at DESC')
  return stmt.all()
})

ipcMain.handle('get-active-chemicals', () => {
  const stmt = db.prepare('SELECT * FROM chemical_records WHERE status = ? ORDER BY created_at DESC')
  return stmt.all('active')
})

ipcMain.handle('create-chemical', (event, chemicalData) => {
  const stmt = db.prepare(`
    INSERT INTO chemical_records 
    (chemical_type, batch_number, concentration, total_volume, max_uses)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    chemicalData.chemical_type,
    chemicalData.batch_number,
    chemicalData.concentration,
    chemicalData.total_volume,
    chemicalData.max_uses
  )
  logAudit('create', 'chemical_records', result.lastInsertRowid, null, chemicalData)
  return { success: true, id: result.lastInsertRowid }
})

ipcMain.handle('update-chemical-usage', (event, { id, used_count }) => {
  const oldStmt = db.prepare('SELECT * FROM chemical_records WHERE id = ?')
  const oldData = oldStmt.get(id)
  
  const stmt = db.prepare(`
    UPDATE chemical_records 
    SET used_count = ?, last_used_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `)
  const result = stmt.run(used_count, id)
  
  logAudit('update', 'chemical_records', id, oldData, { used_count })
  return { success: true, changes: result.changes }
})

ipcMain.handle('deactivate-chemical', (event, id) => {
  const oldStmt = db.prepare('SELECT * FROM chemical_records WHERE id = ?')
  const oldData = oldStmt.get(id)
  
  const stmt = db.prepare('UPDATE chemical_records SET status = ? WHERE id = ?')
  const result = stmt.run('inactive', id)
  
  logAudit('update', 'chemical_records', id, oldData, { status: 'inactive' })
  return { success: true, changes: result.changes }
})

ipcMain.handle('get-all-darkbags', () => {
  const stmt = db.prepare('SELECT * FROM dark_bags ORDER BY bag_number')
  return stmt.all()
})

ipcMain.handle('create-darkbag', (event, bagData) => {
  if (checkDarkBagDuplicate(bagData.bag_number)) {
    return { success: false, error: '暗袋编号已存在' }
  }
  
  const stmt = db.prepare('INSERT INTO dark_bags (bag_number, notes) VALUES (?, ?)')
  const result = stmt.run(bagData.bag_number, bagData.notes)
  logAudit('create', 'dark_bags', result.lastInsertRowid, null, bagData)
  return { success: true, id: result.lastInsertRowid }
})

ipcMain.handle('update-darkbag', (event, { id, ...updateData }) => {
  if (updateData.bag_number && checkDarkBagDuplicate(updateData.bag_number, id)) {
    return { success: false, error: '暗袋编号已存在' }
  }
  
  const oldStmt = db.prepare('SELECT * FROM dark_bags WHERE id = ?')
  const oldData = oldStmt.get(id)
  
  const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ')
  const values = [...Object.values(updateData), id]
  
  const stmt = db.prepare(`UPDATE dark_bags SET ${fields} WHERE id = ?`)
  const result = stmt.run(...values)
  
  logAudit('update', 'dark_bags', id, oldData, updateData)
  return { success: true, changes: result.changes }
})

ipcMain.handle('create-pickup', (event, pickupData) => {
  const matchResult = checkAppointmentPickupMatch(
    pickupData.appointment_id,
    pickupData.picker_name,
    pickupData.picker_id
  )
  
  if (!matchResult.match && !pickupData.is_authorizer_overridden) {
    return { 
      success: false, 
      error: matchResult.message,
      requires_override: true
    }
  }
  
  const stmt = db.prepare(`
    INSERT INTO pickup_records 
    (appointment_id, picker_name, picker_id, is_authorizer_overridden, override_reason, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    pickupData.appointment_id,
    pickupData.picker_name,
    pickupData.picker_id,
    pickupData.is_authorizer_overridden ? 1 : 0,
    pickupData.override_reason,
    pickupData.notes
  )
  
  const appointmentStmt = db.prepare('UPDATE appointments SET status = ? WHERE id = ?')
  appointmentStmt.run('picked_up', pickupData.appointment_id)
  
  logAudit('create', 'pickup_records', result.lastInsertRowid, null, pickupData)
  return { success: true, id: result.lastInsertRowid }
})

ipcMain.handle('check-rules-for-batch', (event, batchId) => {
  return checkAllRulesForBatch(batchId)
})

ipcMain.handle('get-pickup-by-appointment', (event, appointmentId) => {
  const stmt = db.prepare('SELECT * FROM pickup_records WHERE appointment_id = ?')
  return stmt.get(appointmentId)
})

ipcMain.handle('override-violation', (event, { violationId, reason, operator }) => {
  const oldStmt = db.prepare('SELECT * FROM rule_violations WHERE id = ?')
  const oldData = oldStmt.get(violationId)
  
  const stmt = db.prepare(`
    UPDATE rule_violations 
    SET is_overridden = 1, override_reason = ?, overridden_by = ?
    WHERE id = ?
  `)
  const result = stmt.run(reason, operator, violationId)
  
  logAudit('override', 'rule_violations', violationId, oldData, { is_overridden: 1, override_reason: reason })
  return { success: true, changes: result.changes }
})

ipcMain.handle('get-audit-logs', (event, limit = 100) => {
  const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?')
  return stmt.all(limit)
})

ipcMain.handle('export-json', async (event, dataType) => {
  let data, filename
  
  switch (dataType) {
    case 'audit':
      data = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC').all()
      filename = `audit_logs_${new Date().toISOString().split('T')[0]}.json`
      break
    case 'batches':
      data = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all()
      filename = `batches_${new Date().toISOString().split('T')[0]}.json`
      break
    case 'appointments':
      data = db.prepare(`
        SELECT a.*, b.batch_number 
        FROM appointments a 
        LEFT JOIN batches b ON a.batch_id = b.id
        ORDER BY a.created_at DESC
      `).all()
      filename = `appointments_${new Date().toISOString().split('T')[0]}.json`
      break
    default:
      return { success: false, error: '未知的数据类型' }
  }
  
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出 JSON 文件',
    defaultPath: filename,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })
  
  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    logAudit('export', dataType, null, null, { filePath })
    return { success: true, filePath }
  }
  
  return { success: false, canceled: true }
})

ipcMain.handle('export-handover-md', async (event, batchId) => {
  const batchStmt = db.prepare('SELECT * FROM batches WHERE id = ?')
  const batch = batchStmt.get(batchId)
  
  if (!batch) {
    return { success: false, error: '批次不存在' }
  }
  
  const appointmentsStmt = db.prepare(`
    SELECT a.*, p.picker_name, p.pickup_date, p.is_authorizer_overridden, p.notes as pickup_notes
    FROM appointments a
    LEFT JOIN pickup_records p ON a.id = p.appointment_id
    WHERE a.batch_id = ?
    ORDER BY a.created_at
  `)
  const appointments = appointmentsStmt.all(batchId)
  
  const violations = checkAllRulesForBatch(batchId)
  const activeViolations = violations.filter(v => !v.is_overridden)
  
  let mdContent = `# 胶片暗房交接单\n\n`
  mdContent += `## 批次信息\n\n`
  mdContent += `- **批次编号**: ${batch.batch_number}\n`
  mdContent += `- **创建时间**: ${batch.created_at}\n`
  mdContent += `- **当前状态**: ${batch.status}\n`
  if (batch.notes) {
    mdContent += `- **备注**: ${batch.notes}\n`
  }
  mdContent += `\n`
  
  mdContent += `## 预约记录 (共 ${appointments.length} 条)\n\n`
  mdContent += `| 序号 | 学生姓名 | 学号 | 胶片类型 | 数量 | 暗袋编号 | 状态 | 取片人 | 取片时间 |\n`
  mdContent += `|------|----------|------|----------|------|----------|------|--------|----------|\n`
  
  appointments.forEach((a, idx) => {
    const statusText = {
      'pending': '待处理',
      'processing': '冲洗中',
      'ready': '可取',
      'picked_up': '已取片'
    }[a.status] || a.status
    
    mdContent += `| ${idx + 1} | ${a.student_name} | ${a.student_id} | ${a.film_type} | ${a.film_count} | ${a.dark_bag_number || '-'} | ${statusText} | ${a.picker_name || '-'} | ${a.pickup_date || '-'} |\n`
  })
  mdContent += `\n`
  
  if (activeViolations.length > 0) {
    mdContent += `## ⚠️ 规则违规警告\n\n`
    activeViolations.forEach((v, idx) => {
      mdContent += `${idx + 1}. **${v.type}**: ${v.message}\n`
    })
    mdContent += `\n`
  }
  
  mdContent += `---\n`
  mdContent += `*生成时间: ${new Date().toLocaleString('zh-CN')}*\n`
  
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出交接单',
    defaultPath: `交接单_${batch.batch_number}_${new Date().toISOString().split('T')[0]}.md`,
    filters: [{ name: 'Markdown 文件', extensions: ['md'] }]
  })
  
  if (filePath) {
    fs.writeFileSync(filePath, mdContent, 'utf-8')
    logAudit('export_handover', 'batches', batchId, null, { filePath })
    return { success: true, filePath, content: mdContent }
  }
  
  return { success: false, canceled: true }
})

ipcMain.handle('check-pickup-match', (event, { appointmentId, pickerName, pickerId }) => {
  return checkAppointmentPickupMatch(appointmentId, pickerName, pickerId)
})

ipcMain.handle('check-darkbag-duplicate', (event, bagNumber, excludeId) => {
  return checkDarkBagDuplicate(bagNumber, excludeId)
})

ipcMain.handle('check-chemical-rules', (event, chemicalId) => {
  const stmt = db.prepare('SELECT * FROM chemical_records WHERE id = ?')
  const chemical = stmt.get(chemicalId)
  if (!chemical) return []
  return checkChemicalRules(chemical)
})
