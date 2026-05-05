const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

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
    },
    title: '镶嵌返修复核台',
    icon: path.join(__dirname, '../assets/icon.png')
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'jewelry-repair.db')
  console.log('Database path:', dbPath)
  
  db = new Database(dbPath)
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      phone TEXT,
      repair_type TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      stone_number TEXT NOT NULL,
      certificate_number TEXT,
      stone_type TEXT,
      weight REAL,
      color TEXT,
      clarity TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS weight_records (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      record_type TEXT NOT NULL,
      weight REAL NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS processes (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      process_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      is_reinspected INTEGER DEFAULT 0,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS pickup_deadlines (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      deadline_date DATE NOT NULL,
      is_notified INTEGER DEFAULT 0,
      notified_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS risk_checks (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      risk_type TEXT NOT NULL,
      risk_level TEXT DEFAULT 'warning',
      description TEXT,
      is_resolved INTEGER DEFAULT 0,
      resolved_at DATETIME,
      resolved_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS manual_judgments (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      risk_check_id TEXT,
      judgment_type TEXT NOT NULL,
      note TEXT,
      judged_by TEXT,
      judged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (risk_check_id) REFERENCES risk_checks(id)
    );

    CREATE TABLE IF NOT EXISTS order_notes (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      note TEXT NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_certificates_stone ON certificates(stone_number);
    CREATE INDEX IF NOT EXISTS idx_risk_checks_order ON risk_checks(order_id);
  `)
}

function setupIPC() {
  ipcMain.handle('get-orders', async () => {
    const orders = db.prepare(`
      SELECT o.*, 
             pd.deadline_date,
             pd.is_notified,
             (SELECT COUNT(*) FROM risk_checks WHERE order_id = o.id AND is_resolved = 0) as unresolved_risks
      FROM orders o
      LEFT JOIN pickup_deadlines pd ON o.id = pd.order_id
      ORDER BY o.created_at DESC
    `).all()
    return orders
  })

  ipcMain.handle('get-order-detail', async (event, orderId) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
    if (!order) return null

    const certificates = db.prepare('SELECT * FROM certificates WHERE order_id = ?').all(orderId)
    const weightRecords = db.prepare('SELECT * FROM weight_records WHERE order_id = ? ORDER BY recorded_at').all(orderId)
    const processes = db.prepare('SELECT * FROM processes WHERE order_id = ?').all(orderId)
    const deadline = db.prepare('SELECT * FROM pickup_deadlines WHERE order_id = ?').get(orderId)
    const riskChecks = db.prepare('SELECT * FROM risk_checks WHERE order_id = ? ORDER BY created_at DESC').all(orderId)
    const notes = db.prepare('SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC').all(orderId)
    const judgments = db.prepare(`
      SELECT mj.*, rc.risk_type 
      FROM manual_judgments mj 
      LEFT JOIN risk_checks rc ON mj.risk_check_id = rc.id 
      WHERE mj.order_id = ? 
      ORDER BY mj.judged_at DESC
    `).all(orderId)

    return {
      order,
      certificates,
      weightRecords,
      processes,
      deadline,
      riskChecks,
      notes,
      judgments
    }
  })

  ipcMain.handle('import-data', async (event, data) => {
    const tx = db.transaction(() => {
      data.forEach(item => {
        const { order, certificates, weightRecords, processes, deadline } = item
        
        const existingOrder = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(order.order_number)
        
        if (existingOrder) {
          db.prepare(`
            UPDATE orders SET 
              customer_name = ?, phone = ?, repair_type = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(order.customer_name, order.phone, order.repair_type, order.description, existingOrder.id)
          
          const orderId = existingOrder.id
          
          db.prepare('DELETE FROM certificates WHERE order_id = ?').run(orderId)
          db.prepare('DELETE FROM weight_records WHERE order_id = ?').run(orderId)
          db.prepare('DELETE FROM processes WHERE order_id = ?').run(orderId)
          db.prepare('DELETE FROM pickup_deadlines WHERE order_id = ?').run(orderId)
          db.prepare('DELETE FROM risk_checks WHERE order_id = ?').run(orderId)
          
          insertOrderData(orderId, certificates, weightRecords, processes, deadline)
        } else {
          const orderId = require('uuid').v4()
          db.prepare(`
            INSERT INTO orders (id, order_number, customer_name, phone, repair_type, description)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(orderId, order.order_number, order.customer_name, order.phone, order.repair_type, order.description)
          
          insertOrderData(orderId, certificates, weightRecords, processes, deadline)
        }
      })
    })
    
    tx()
    return { success: true }
  })

  function insertOrderData(orderId, certificates, weightRecords, processes, deadline) {
    if (certificates && certificates.length > 0) {
      const certStmt = db.prepare(`
        INSERT INTO certificates (id, order_id, stone_number, certificate_number, stone_type, weight, color, clarity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      certificates.forEach(cert => {
        certStmt.run(
          require('uuid').v4(),
          orderId,
          cert.stone_number,
          cert.certificate_number,
          cert.stone_type,
          cert.weight,
          cert.color,
          cert.clarity
        )
      })
    }

    if (weightRecords && weightRecords.length > 0) {
      const weightStmt = db.prepare(`
        INSERT INTO weight_records (id, order_id, record_type, weight, recorded_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      weightRecords.forEach(record => {
        weightStmt.run(
          require('uuid').v4(),
          orderId,
          record.record_type,
          record.weight,
          record.recorded_at || new Date().toISOString()
        )
      })
    }

    if (processes && processes.length > 0) {
      const procStmt = db.prepare(`
        INSERT INTO processes (id, order_id, process_name, status, is_reinspected, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      processes.forEach(proc => {
        procStmt.run(
          require('uuid').v4(),
          orderId,
          proc.process_name,
          proc.status || 'pending',
          proc.is_reinspected ? 1 : 0,
          proc.started_at,
          proc.completed_at
        )
      })
    }

    if (deadline) {
      db.prepare(`
        INSERT INTO pickup_deadlines (id, order_id, deadline_date, is_notified, notified_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        require('uuid').v4(),
        orderId,
        deadline.deadline_date,
        deadline.is_notified ? 1 : 0,
        deadline.notified_at
      )
    }
  }

  ipcMain.handle('run-risk-check', async (event, orderId) => {
    const risks = []
    
    const detail = db.prepare(`
      SELECT o.*, 
             (SELECT GROUP_CONCAT(stone_number) FROM certificates WHERE order_id = o.id) as stone_numbers,
             (SELECT GROUP_CONCAT(certificate_number) FROM certificates WHERE order_id = o.id) as certificate_numbers,
             (SELECT COUNT(*) FROM certificates WHERE order_id = o.id AND certificate_number IS NULL) as missing_cert_count,
             pd.deadline_date,
             pd.is_notified
      FROM orders o
      LEFT JOIN pickup_deadlines pd ON o.id = pd.order_id
      WHERE o.id = ?
    `).get(orderId)

    if (!detail) return []

    if (detail.missing_cert_count > 0) {
      risks.push({
        id: require('uuid').v4(),
        order_id: orderId,
        risk_type: 'certificate_mismatch',
        risk_level: 'critical',
        description: `存在 ${detail.missing_cert_count} 颗宝石缺少证书编号`,
        is_resolved: 0
      })
    }

    const weightRecords = db.prepare(`
      SELECT * FROM weight_records WHERE order_id = ? ORDER BY recorded_at
    `).all(orderId)

    if (weightRecords.length >= 2) {
      const beforeWeight = weightRecords.find(r => r.record_type === 'before')?.weight
      const afterWeight = weightRecords.find(r => r.record_type === 'after')?.weight
      
      if (beforeWeight && afterWeight) {
        const diff = Math.abs(beforeWeight - afterWeight)
        const diffPercent = (diff / beforeWeight) * 100
        
        if (diffPercent > 5) {
          risks.push({
            id: require('uuid').v4(),
            order_id: orderId,
            risk_type: 'weight_abnormal',
            risk_level: 'critical',
            description: `维修前后重量差异过大: 维修前 ${beforeWeight}g, 维修后 ${afterWeight}g, 差异 ${diffPercent.toFixed(2)}%`,
            is_resolved: 0
          })
        }
      }
    }

    const clawProcesses = db.prepare(`
      SELECT * FROM processes WHERE order_id = ? AND process_name LIKE '%爪镶%'
    `).all(orderId)

    const unreinspectedClaws = clawProcesses.filter(p => !p.is_reinspected)
    if (unreinspectedClaws.length > 0) {
      risks.push({
        id: require('uuid').v4(),
        order_id: orderId,
        risk_type: 'claw_reinspection_missing',
        risk_level: 'warning',
        description: `存在 ${unreinspectedClaws.length} 项爪镶工序未进行复检`,
        is_resolved: 0
      })
    }

    if (detail.deadline_date) {
      const today = new Date()
      const deadline = new Date(detail.deadline_date)
      const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
      
      if (daysUntilDeadline < 0 && !detail.is_notified) {
        risks.push({
          id: require('uuid').v4(),
          order_id: orderId,
          risk_type: 'overdue_notification_missing',
          risk_level: 'critical',
          description: `订单已逾期 ${Math.abs(daysUntilDeadline)} 天，但尚未通知客户`,
          is_resolved: 0
        })
      } else if (daysUntilDeadline <= 3 && daysUntilDeadline >= 0 && !detail.is_notified) {
        risks.push({
          id: require('uuid').v4(),
          order_id: orderId,
          risk_type: 'deadline_approaching',
          risk_level: 'warning',
          description: `取件期限即将到来，还剩 ${daysUntilDeadline} 天`,
          is_resolved: 0
        })
      }
    }

    if (risks.length > 0) {
      const tx = db.transaction(() => {
        const deleteStmt = db.prepare('DELETE FROM risk_checks WHERE order_id = ?')
        deleteStmt.run(orderId)
        
        const insertStmt = db.prepare(`
          INSERT INTO risk_checks (id, order_id, risk_type, risk_level, description, is_resolved)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        
        risks.forEach(risk => {
          insertStmt.run(risk.id, risk.order_id, risk.risk_type, risk.risk_level, risk.description, risk.is_resolved)
        })
      })
      tx()
    }

    return risks
  })

  ipcMain.handle('save-judgment', async (event, judgment) => {
    const judgmentId = require('uuid').v4()
    
    db.prepare(`
      INSERT INTO manual_judgments (id, order_id, risk_check_id, judgment_type, note, judged_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(judgmentId, judgment.order_id, judgment.risk_check_id, judgment.judgment_type, judgment.note, judgment.judged_by || '系统管理员')

    if (judgment.risk_check_id) {
      db.prepare(`
        UPDATE risk_checks SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_note = ?
        WHERE id = ?
      `).run(judgment.note, judgment.risk_check_id)
    }

    return { success: true, id: judgmentId }
  })

  ipcMain.handle('save-note', async (event, note) => {
    const noteId = require('uuid').v4()
    
    db.prepare(`
      INSERT INTO order_notes (id, order_id, note, created_by)
      VALUES (?, ?, ?, ?)
    `).run(noteId, note.order_id, note.note, note.created_by || '系统管理员')

    return { success: true, id: noteId }
  })

  ipcMain.handle('export-markdown', async (event, orderId) => {
    const detail = db.prepare(`
      SELECT o.*, pd.deadline_date, pd.is_notified
      FROM orders o
      LEFT JOIN pickup_deadlines pd ON o.id = pd.order_id
      WHERE o.id = ?
    `).get(orderId)

    if (!detail) return null

    const certificates = db.prepare('SELECT * FROM certificates WHERE order_id = ?').all(orderId)
    const weightRecords = db.prepare('SELECT * FROM weight_records WHERE order_id = ? ORDER BY recorded_at').all(orderId)
    const processes = db.prepare('SELECT * FROM processes WHERE order_id = ?').all(orderId)
    const riskChecks = db.prepare('SELECT * FROM risk_checks WHERE order_id = ? ORDER BY created_at DESC').all(orderId)
    const notes = db.prepare('SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC').all(orderId)

    let markdown = `# 珠宝维修交付单\n\n`
    markdown += `## 订单信息\n\n`
    markdown += `- **订单编号**: ${detail.order_number}\n`
    markdown += `- **客户姓名**: ${detail.customer_name || '未填写'}\n`
    markdown += `- **联系电话**: ${detail.phone || '未填写'}\n`
    markdown += `- **维修类型**: ${detail.repair_type || '未填写'}\n`
    markdown += `- **问题描述**: ${detail.description || '未填写'}\n`
    if (detail.deadline_date) {
      markdown += `- **取件期限**: ${detail.deadline_date}\n`
      markdown += `- **通知状态**: ${detail.is_notified ? '已通知' : '未通知'}\n`
    }
    markdown += `\n`

    if (certificates.length > 0) {
      markdown += `## 宝石证书\n\n`
      markdown += `| 石号 | 证书编号 | 宝石类型 | 重量(ct) | 颜色 | 净度 |\n`
      markdown += `|------|----------|----------|----------|------|------|\n`
      certificates.forEach(cert => {
        markdown += `| ${cert.stone_number || '-'} | ${cert.certificate_number || '-'} | ${cert.stone_type || '-'} | ${cert.weight || '-'} | ${cert.color || '-'} | ${cert.clarity || '-'} |\n`
      })
      markdown += `\n`
    }

    if (weightRecords.length > 0) {
      markdown += `## 称重记录\n\n`
      markdown += `| 记录类型 | 重量(g) | 记录时间 |\n`
      markdown += `|----------|---------|----------|\n`
      weightRecords.forEach(record => {
        const typeMap = { before: '维修前', after: '维修后', intermediate: '中间记录' }
        markdown += `| ${typeMap[record.record_type] || record.record_type} | ${record.weight} | ${record.recorded_at || '-'} |\n`
      })
      markdown += `\n`
    }

    if (processes.length > 0) {
      markdown += `## 工序记录\n\n`
      markdown += `| 工序名称 | 状态 | 是否已复检 | 开始时间 | 完成时间 |\n`
      markdown += `|----------|------|------------|----------|----------|\n`
      processes.forEach(proc => {
        const statusMap = { pending: '待处理', in_progress: '进行中', completed: '已完成' }
        markdown += `| ${proc.process_name} | ${statusMap[proc.status] || proc.status} | ${proc.is_reinspected ? '是' : '否'} | ${proc.started_at || '-'} | ${proc.completed_at || '-'} |\n`
      })
      markdown += `\n`
    }

    if (riskChecks.length > 0) {
      markdown += `## 风险检测记录\n\n`
      markdown += `| 风险类型 | 风险等级 | 描述 | 状态 |\n`
      markdown += `|----------|----------|------|------|\n`
      riskChecks.forEach(risk => {
        const typeMap = {
          certificate_mismatch: '证书不匹配',
          weight_abnormal: '重量异常',
          claw_reinspection_missing: '爪镶未复检',
          overdue_notification_missing: '逾期未通知',
          deadline_approaching: '期限临近'
        }
        const levelMap = { critical: '严重', warning: '警告', info: '信息' }
        markdown += `| ${typeMap[risk.risk_type] || risk.risk_type} | ${levelMap[risk.risk_level] || risk.risk_level} | ${risk.description} | ${risk.is_resolved ? '已解决' : '未解决'} |\n`
      })
      markdown += `\n`
    }

    if (notes.length > 0) {
      markdown += `## 备注记录\n\n`
      notes.forEach((note, index) => {
        markdown += `### 备注 ${index + 1}\n\n`
        markdown += `**创建人**: ${note.created_by || '系统管理员'}\n\n`
        markdown += `**创建时间**: ${note.created_at}\n\n`
        markdown += `${note.note}\n\n`
      })
    }

    markdown += `\n---\n\n`
    markdown += `*生成时间: ${new Date().toISOString()}*\n`

    return markdown
  })

  ipcMain.handle('export-json', async (event, orderId) => {
    const detail = db.prepare(`
      SELECT o.*, pd.deadline_date, pd.is_notified, pd.notified_at
      FROM orders o
      LEFT JOIN pickup_deadlines pd ON o.id = pd.order_id
      WHERE o.id = ?
    `).get(orderId)

    if (!detail) return null

    const certificates = db.prepare('SELECT * FROM certificates WHERE order_id = ?').all(orderId)
    const weightRecords = db.prepare('SELECT * FROM weight_records WHERE order_id = ? ORDER BY recorded_at').all(orderId)
    const processes = db.prepare('SELECT * FROM processes WHERE order_id = ?').all(orderId)
    const riskChecks = db.prepare('SELECT * FROM risk_checks WHERE order_id = ? ORDER BY created_at DESC').all(orderId)
    const notes = db.prepare('SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC').all(orderId)
    const judgments = db.prepare(`
      SELECT mj.*, rc.risk_type 
      FROM manual_judgments mj 
      LEFT JOIN risk_checks rc ON mj.risk_check_id = rc.id 
      WHERE mj.order_id = ? 
      ORDER BY mj.judged_at DESC
    `).all(orderId)

    const exportData = {
      exportInfo: {
        exportTime: new Date().toISOString(),
        exportType: 'order_audit'
      },
      order: {
        ...detail,
        deadline: detail.deadline_date ? {
          deadline_date: detail.deadline_date,
          is_notified: detail.is_notified,
          notified_at: detail.notified_at
        } : null
      },
      certificates,
      weightRecords,
      processes,
      riskChecks,
      notes,
      manualJudgments: judgments
    }

    return JSON.stringify(exportData, null, 2)
  })

  ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options.title || '保存文件',
      defaultPath: options.defaultPath,
      filters: options.filters || []
    })
    return result
  })

  ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || '选择文件',
      defaultPath: options.defaultPath,
      filters: options.filters || [],
      properties: options.properties || ['openFile']
    })
    return result
  })

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}

app.whenReady().then(() => {
  initDatabase()
  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (db) {
    db.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
