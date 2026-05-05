const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function calculateRisk(baggage) {
  const risks = [];
  
  if (baggage.is_transfer && !baggage.carousel) {
    risks.push({
      type: 'transfer_no_carousel',
      description: '中转行李未分配转盘',
      level: 'high'
    });
  }
  
  if (baggage.is_oversize && !baggage.is_loaded) {
    risks.push({
      type: 'oversize_not_loaded',
      description: '超大件行李未装车',
      level: 'high'
    });
  }
  
  if (baggage.is_transfer && baggage.is_loaded) {
    const loadCheck = db.prepare(`
      SELECT COUNT(*) as count FROM baggage 
      WHERE barcode = ? AND id != ? AND is_loaded = 1
    `).get(baggage.barcode, baggage.id);
    
    if (loadCheck.count > 0) {
      risks.push({
        type: 'duplicate_loaded',
        description: '同一条码重复装车',
        level: 'critical'
      });
    }
  }
  
  if (baggage.is_transfer && baggage.carousel) {
    const transferFlightCheck = db.prepare(`
      SELECT id FROM flights WHERE flight_no = ?
    `).get(baggage.transfer_flight);
    
    if (transferFlightCheck) {
      const expectedCarousel = db.prepare(`
        SELECT carousel_number FROM carousel_assignments 
        WHERE flight_id = ? ORDER BY assigned_at DESC LIMIT 1
      `).get(transferFlightCheck.id);
      
      if (expectedCarousel && expectedCarousel.carousel_number !== baggage.carousel) {
        risks.push({
          type: 'wrong_carousel',
          description: `中转行李可能分配到错误转盘 (应在 ${expectedCarousel.carousel_number} 号, 当前 ${baggage.carousel} 号)`,
          level: 'high'
        });
      }
    }
  }
  
  return risks;
}

function updateRiskAlerts(baggageId) {
  db.prepare('DELETE FROM risk_alerts WHERE baggage_id = ?').run(baggageId);
  
  const baggage = db.prepare(`
    SELECT b.*, f.flight_no 
    FROM baggage b 
    LEFT JOIN flights f ON b.flight_id = f.id 
    WHERE b.id = ?
  `).get(baggageId);
  
  if (!baggage) return;
  
  const risks = calculateRisk(baggage);
  
  risks.forEach(risk => {
    db.prepare(`
      INSERT INTO risk_alerts (id, baggage_id, alert_type, description, risk_level)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), baggageId, risk.type, risk.description, risk.level);
  });
}

app.get('/api/flights', (req, res) => {
  try {
    const flights = db.prepare(`
      SELECT f.*, 
             (SELECT COUNT(*) FROM baggage WHERE flight_id = f.id) as baggage_count,
             (SELECT carousel_number FROM carousel_assignments WHERE flight_id = f.id ORDER BY assigned_at DESC LIMIT 1) as carousel
      FROM flights f
      ORDER BY f.arrival_time DESC
    `).all();
    res.json(flights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/flights/:id', (req, res) => {
  try {
    const flight = db.prepare(`
      SELECT f.*, 
             (SELECT COUNT(*) FROM baggage WHERE flight_id = f.id) as baggage_count,
             (SELECT carousel_number FROM carousel_assignments WHERE flight_id = f.id ORDER BY assigned_at DESC LIMIT 1) as carousel
      FROM flights f
      WHERE f.id = ?
    `).get(req.params.id);
    
    if (!flight) {
      return res.status(404).json({ error: '航班不存在' });
    }
    
    const baggage = db.prepare(`
      SELECT b.*, 
             (SELECT GROUP_CONCAT(alert_type, ',') FROM risk_alerts WHERE baggage_id = b.id) as alerts
      FROM baggage b
      WHERE b.flight_id = ?
      ORDER BY b.created_at DESC
    `).all(flight.id);
    
    res.json({ ...flight, baggage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flights', (req, res) => {
  try {
    const { flight_no, arrival_time, origin, destination } = req.body;
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO flights (id, flight_no, arrival_time, origin, destination)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, flight_no, arrival_time, origin, destination);
    
    res.status(201).json({ id, flight_no, arrival_time, origin, destination });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/baggage', (req, res) => {
  try {
    const { flight_id, carousel, barcode } = req.query;
    let query = `
      SELECT b.*, f.flight_no,
             (SELECT GROUP_CONCAT(alert_type, ',') FROM risk_alerts WHERE baggage_id = b.id) as alerts,
             (SELECT COUNT(*) FROM notes WHERE baggage_id = b.id AND is_resolved = 0) as unresolved_notes
      FROM baggage b
      LEFT JOIN flights f ON b.flight_id = f.id
      WHERE 1=1
    `;
    const params = [];
    
    if (flight_id) {
      query += ' AND b.flight_id = ?';
      params.push(flight_id);
    }
    
    if (carousel) {
      query += ' AND b.carousel = ?';
      params.push(parseInt(carousel));
    }
    
    if (barcode) {
      query += ' AND b.barcode LIKE ?';
      params.push(`%${barcode}%`);
    }
    
    query += ' ORDER BY b.created_at DESC';
    
    const baggage = db.prepare(query).all(...params);
    res.json(baggage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/baggage/:id', (req, res) => {
  try {
    const baggage = db.prepare(`
      SELECT b.*, f.flight_no
      FROM baggage b
      LEFT JOIN flights f ON b.flight_id = f.id
      WHERE b.id = ?
    `).get(req.params.id);
    
    if (!baggage) {
      return res.status(404).json({ error: '行李不存在' });
    }
    
    const notes = db.prepare(`
      SELECT * FROM notes WHERE baggage_id = ? ORDER BY created_at DESC
    `).all(baggage.id);
    
    const alerts = db.prepare(`
      SELECT * FROM risk_alerts WHERE baggage_id = ? ORDER BY risk_level DESC
    `).all(baggage.id);
    
    res.json({ ...baggage, notes, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/baggage', (req, res) => {
  try {
    const { barcode, flight_id, transfer_flight, carousel, is_oversize, is_transfer } = req.body;
    const id = uuidv4();
    
    const existing = db.prepare('SELECT id FROM baggage WHERE barcode = ?').get(barcode);
    if (existing) {
      return res.status(400).json({ error: '条码已存在' });
    }
    
    db.prepare(`
      INSERT INTO baggage (id, barcode, flight_id, transfer_flight, carousel, is_oversize, is_transfer)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, barcode, flight_id, transfer_flight, carousel, is_oversize ? 1 : 0, is_transfer ? 1 : 0);
    
    updateRiskAlerts(id);
    
    res.status(201).json({ id, barcode, flight_id, transfer_flight, carousel, is_oversize, is_transfer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/baggage/:id', (req, res) => {
  try {
    const { transfer_flight, carousel, is_oversize, is_transfer, is_loaded } = req.body;
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM baggage WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '行李不存在' });
    }
    
    db.prepare(`
      UPDATE baggage SET 
        transfer_flight = ?, carousel = ?, is_oversize = ?, is_transfer = ?, 
        is_loaded = ?, loaded_time = CASE WHEN ? = 1 THEN datetime('now') ELSE loaded_time END,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      transfer_flight, 
      carousel, 
      is_oversize ? 1 : 0, 
      is_transfer ? 1 : 0, 
      is_loaded ? 1 : 0,
      is_loaded ? 1 : 0,
      id
    );
    
    updateRiskAlerts(id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/baggage/:id/load', (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM baggage WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '行李不存在' });
    }
    
    if (existing.is_loaded) {
      return res.status(400).json({ error: '行李已装车' });
    }
    
    db.prepare(`
      UPDATE baggage SET is_loaded = 1, loaded_time = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
    
    updateRiskAlerts(id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/carousel-assignments', (req, res) => {
  try {
    const { flight_id, carousel_number, assigned_by } = req.body;
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO carousel_assignments (id, flight_id, carousel_number, assigned_by)
      VALUES (?, ?, ?, ?)
    `).run(id, flight_id, carousel_number, assigned_by);
    
    db.prepare(`
      UPDATE baggage SET carousel = ?, updated_at = datetime('now')
      WHERE flight_id = ?
    `).run(carousel_number, flight_id);
    
    const baggageList = db.prepare('SELECT id FROM baggage WHERE flight_id = ?').all(flight_id);
    baggageList.forEach(b => updateRiskAlerts(b.id));
    
    res.status(201).json({ id, flight_id, carousel_number, assigned_by });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', (req, res) => {
  try {
    const { baggage_id, note_type, content, reviewed_by } = req.body;
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO notes (id, baggage_id, note_type, content, reviewed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, baggage_id, note_type, content, reviewed_by);
    
    updateRiskAlerts(baggage_id);
    
    res.status(201).json({ id, baggage_id, note_type, content, reviewed_by });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notes/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;
    const { reviewed_by } = req.body;
    
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!note) {
      return res.status(404).json({ error: '备注不存在' });
    }
    
    db.prepare(`
      UPDATE notes SET is_resolved = 1, reviewed_at = datetime('now'), reviewed_by = ?
      WHERE id = ?
    `).run(reviewed_by, id);
    
    updateRiskAlerts(note.baggage_id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/risk-alerts', (req, res) => {
  try {
    const { acknowledged } = req.query;
    let query = `
      SELECT ra.*, b.barcode, f.flight_no, b.carousel
      FROM risk_alerts ra
      LEFT JOIN baggage b ON ra.baggage_id = b.id
      LEFT JOIN flights f ON b.flight_id = f.id
    `;
    const params = [];
    
    if (acknowledged !== undefined) {
      query += ' WHERE ra.is_acknowledged = ?';
      params.push(acknowledged === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY CASE ra.risk_level WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END, ra.created_at DESC';
    
    const alerts = db.prepare(query).all(...params);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/risk-alerts/:id/acknowledge', (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledged_by } = req.body;
    
    db.prepare(`
      UPDATE risk_alerts SET 
        is_acknowledged = 1, 
        acknowledged_by = ?, 
        acknowledged_at = datetime('now')
      WHERE id = ?
    `).run(acknowledged_by, id);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/sample', (req, res) => {
  try {
    const transaction = db.transaction(() => {
      const flights = [
        { id: uuidv4(), flight_no: 'CA1234', arrival_time: '2026-05-05 08:30', origin: '北京', destination: '上海' },
        { id: uuidv4(), flight_no: 'MU5678', arrival_time: '2026-05-05 09:15', origin: '广州', destination: '北京' },
        { id: uuidv4(), flight_no: 'CZ9012', arrival_time: '2026-05-05 10:00', origin: '深圳', destination: '成都' }
      ];
      
      flights.forEach(f => {
        db.prepare(`
          INSERT INTO flights (id, flight_no, arrival_time, origin, destination)
          VALUES (?, ?, ?, ?, ?)
        `).run(f.id, f.flight_no, f.arrival_time, f.origin, f.destination);
      });
      
      const baggage = [
        { id: uuidv4(), barcode: 'CA1234001', flight_id: flights[0].id, transfer_flight: 'MU5678', carousel: 3, is_oversize: 0, is_transfer: 1, is_loaded: 0 },
        { id: uuidv4(), barcode: 'CA1234002', flight_id: flights[0].id, transfer_flight: null, carousel: 1, is_oversize: 1, is_transfer: 0, is_loaded: 0 },
        { id: uuidv4(), barcode: 'CA1234003', flight_id: flights[0].id, transfer_flight: 'CZ9012', carousel: 2, is_oversize: 0, is_transfer: 1, is_loaded: 1 },
        { id: uuidv4(), barcode: 'MU5678001', flight_id: flights[1].id, transfer_flight: null, carousel: 4, is_oversize: 0, is_transfer: 0, is_loaded: 0 },
        { id: uuidv4(), barcode: 'MU5678002', flight_id: flights[1].id, transfer_flight: 'CA1234', carousel: 3, is_oversize: 1, is_transfer: 1, is_loaded: 0 },
        { id: uuidv4(), barcode: 'CA1234003', flight_id: flights[2].id, transfer_flight: 'MU5678', carousel: 5, is_oversize: 0, is_transfer: 1, is_loaded: 1 }
      ];
      
      baggage.forEach(b => {
        try {
          db.prepare(`
            INSERT INTO baggage (id, barcode, flight_id, transfer_flight, carousel, is_oversize, is_transfer, is_loaded)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(b.id, b.barcode, b.flight_id, b.transfer_flight, b.carousel, b.is_oversize, b.is_transfer, b.is_loaded);
        } catch (e) {
          // Ignore duplicates for sample data
        }
      });
      
      const carouselAssignments = [
        { id: uuidv4(), flight_id: flights[0].id, carousel_number: 1 },
        { id: uuidv4(), flight_id: flights[1].id, carousel_number: 2 },
        { id: uuidv4(), flight_id: flights[2].id, carousel_number: 3 }
      ];
      
      carouselAssignments.forEach(ca => {
        db.prepare(`
          INSERT INTO carousel_assignments (id, flight_id, carousel_number)
          VALUES (?, ?, ?)
        `).run(ca.id, ca.flight_id, ca.carousel_number);
      });
      
      const notes = [
        { id: uuidv4(), baggage_id: baggage[1].id, note_type: 'damage', content: '行李箱一角有轻微划痕' },
        { id: uuidv4(), baggage_id: baggage[4].id, note_type: 'opening', content: '已人工开箱检查，无异常物品' }
      ];
      
      notes.forEach(n => {
        db.prepare(`
          INSERT INTO notes (id, baggage_id, note_type, content)
          VALUES (?, ?, ?, ?)
        `).run(n.id, n.baggage_id, n.note_type, n.content);
      });
      
      baggage.forEach(b => {
        updateRiskAlerts(b.id);
      });
    });
    
    transaction();
    
    res.json({ success: true, message: '示例数据导入成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/json', (req, res) => {
  try {
    const flights = db.prepare(`
      SELECT f.*, 
             (SELECT carousel_number FROM carousel_assignments WHERE flight_id = f.id ORDER BY assigned_at DESC LIMIT 1) as carousel
      FROM flights f
      ORDER BY f.arrival_time
    `).all();
    
    const baggage = db.prepare(`
      SELECT b.*, f.flight_no,
             (SELECT GROUP_CONCAT(note_type || ': ' || content, '; ') FROM notes WHERE baggage_id = b.id) as notes,
             (SELECT GROUP_CONCAT(alert_type || ' [' || risk_level || ']: ' || description, '; ') FROM risk_alerts WHERE baggage_id = b.id) as alerts
      FROM baggage b
      LEFT JOIN flights f ON b.flight_id = f.id
      ORDER BY f.flight_no, b.created_at
    `).all();
    
    const carouselAssignments = db.prepare(`
      SELECT ca.*, f.flight_no
      FROM carousel_assignments ca
      LEFT JOIN flights f ON ca.flight_id = f.id
      ORDER BY ca.carousel_number
    `).all();
    
    const riskAlerts = db.prepare(`
      SELECT ra.*, b.barcode, f.flight_no
      FROM risk_alerts ra
      LEFT JOIN baggage b ON ra.baggage_id = b.id
      LEFT JOIN flights f ON b.flight_id = f.id
      ORDER BY CASE ra.risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    `).all();
    
    const notes = db.prepare(`
      SELECT n.*, b.barcode, f.flight_no
      FROM notes n
      LEFT JOIN baggage b ON n.baggage_id = b.id
      LEFT JOIN flights f ON b.flight_id = f.id
      ORDER BY n.created_at DESC
    `).all();
    
    res.json({
      export_time: new Date().toISOString(),
      flights,
      baggage,
      carousel_assignments: carouselAssignments,
      risk_alerts: riskAlerts,
      notes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/markdown', (req, res) => {
  try {
    const exportTime = new Date().toLocaleString('zh-CN');
    
    const flights = db.prepare(`
      SELECT f.*, 
             (SELECT COUNT(*) FROM baggage WHERE flight_id = f.id) as baggage_count,
             (SELECT carousel_number FROM carousel_assignments WHERE flight_id = f.id ORDER BY assigned_at DESC LIMIT 1) as carousel
      FROM flights f
      ORDER BY f.arrival_time
    `).all();
    
    const carouselAssignments = db.prepare(`
      SELECT ca.carousel_number, GROUP_CONCAT(f.flight_no, ', ') as flights
      FROM carousel_assignments ca
      LEFT JOIN flights f ON ca.flight_id = f.id
      GROUP BY ca.carousel_number
      ORDER BY ca.carousel_number
    `).all();
    
    const riskAlerts = db.prepare(`
      SELECT ra.*, b.barcode, f.flight_no, b.carousel
      FROM risk_alerts ra
      LEFT JOIN baggage b ON ra.baggage_id = b.id
      LEFT JOIN flights f ON b.flight_id = f.id
      WHERE ra.is_acknowledged = 0
      ORDER BY CASE ra.risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    `).all();
    
    const notes = db.prepare(`
      SELECT n.*, b.barcode, f.flight_no
      FROM notes n
      LEFT JOIN baggage b ON n.baggage_id = b.id
      LEFT JOIN flights f ON b.flight_id = f.id
      WHERE n.is_resolved = 0
      ORDER BY n.created_at DESC
    `).all();
    
    const statistics = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM baggage) as total_baggage,
        (SELECT COUNT(*) FROM baggage WHERE is_transfer = 1) as transfer_baggage,
        (SELECT COUNT(*) FROM baggage WHERE is_oversize = 1) as oversize_baggage,
        (SELECT COUNT(*) FROM baggage WHERE is_loaded = 1) as loaded_baggage,
        (SELECT COUNT(*) FROM risk_alerts WHERE is_acknowledged = 0) as active_alerts
    `).get();
    
    let markdown = `# 行李转运交接单

**导出时间**: ${exportTime}

---

## 统计概览

| 指标 | 数量 |
|------|------|
| 总行李数 | ${statistics.total_baggage} |
| 中转行李 | ${statistics.transfer_baggage} |
| 超大件行李 | ${statistics.oversize_baggage} |
| 已装车 | ${statistics.loaded_baggage} |
| 待处理风险 | ${statistics.active_alerts} |

---

## 到港航班清单

| 航班号 | 到达时间 | 出发地 | 目的地 | 转盘 | 行李数 |
|--------|----------|--------|--------|------|--------|
`;
    
    flights.forEach(f => {
      markdown += `| ${f.flight_no} | ${f.arrival_time} | ${f.origin || '-'} | ${f.destination || '-'} | ${f.carousel || '未分配'} | ${f.baggage_count} |\n`;
    });
    
    markdown += `
---

## 转盘分配表

| 转盘号 | 航班 |
|--------|------|
`;
    
    carouselAssignments.forEach(ca => {
      markdown += `| ${ca.carousel_number} | ${ca.flights} |\n`;
    });
    
    if (riskAlerts.length > 0) {
      markdown += `
---

## ⚠️ 风险预警

| 风险等级 | 类型 | 描述 | 航班 | 条码 | 转盘 |
|----------|------|------|------|------|------|
`;
      
      riskAlerts.forEach(ra => {
        const levelIcon = ra.risk_level === 'critical' ? '🔴' : ra.risk_level === 'high' ? '🟠' : '🟡';
        markdown += `| ${levelIcon} ${ra.risk_level.toUpperCase()} | ${ra.alert_type} | ${ra.description} | ${ra.flight_no || '-'} | ${ra.barcode || '-'} | ${ra.carousel || '-'} |\n`;
      });
    }
    
    if (notes.length > 0) {
      markdown += `
---

## 📝 备注清单

| 类型 | 内容 | 航班 | 条码 | 创建时间 |
|------|------|------|------|----------|
`;
      
      notes.forEach(n => {
        const typeText = n.note_type === 'damage' ? '破损' : n.note_type === 'opening' ? '开箱' : n.note_type;
        markdown += `| ${typeText} | ${n.content} | ${n.flight_no || '-'} | ${n.barcode || '-'} | ${n.created_at} |\n`;
      });
    }
    
    markdown += `
---

*此交接单由行李转运系统自动生成*
`;
    
    res.set('Content-Type', 'text/markdown');
    res.set('Content-Disposition', 'attachment; filename=baggage-transfer-handover.md');
    res.send(markdown);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/statistics', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM flights) as total_flights,
        (SELECT COUNT(*) FROM baggage) as total_baggage,
        (SELECT COUNT(*) FROM baggage WHERE is_transfer = 1) as transfer_baggage,
        (SELECT COUNT(*) FROM baggage WHERE is_oversize = 1) as oversize_baggage,
        (SELECT COUNT(*) FROM baggage WHERE is_loaded = 1) as loaded_baggage,
        (SELECT COUNT(*) FROM risk_alerts WHERE is_acknowledged = 0) as active_alerts,
        (SELECT COUNT(*) FROM risk_alerts WHERE is_acknowledged = 0 AND risk_level = 'critical') as critical_alerts,
        (SELECT COUNT(*) FROM notes WHERE is_resolved = 0) as unresolved_notes
    `).get();
    
    const carouselStats = db.prepare(`
      SELECT carousel, COUNT(*) as count
      FROM baggage
      WHERE carousel IS NOT NULL
      GROUP BY carousel
      ORDER BY carousel
    `).all();
    
    res.json({
      ...stats,
      carousel_stats: carouselStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`行李转运服务运行在 http://localhost:${PORT}`);
});
