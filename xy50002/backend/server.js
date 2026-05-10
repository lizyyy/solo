const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { parse } = require('csv-parse/sync');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbPath = path.join(__dirname, 'data', 'support.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  console.log('Database not found. Initializing...');
  const { execSync } = require('child_process');
  execSync('node scripts/init-db.js', { cwd: __dirname, stdio: 'inherit' });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function generateId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function nowISO() {
  return new Date().toISOString();
}

function calculateSlaDeadline(priority, createdAt) {
  const hours = {
    critical: 4,
    high: 24,
    medium: 48,
    low: 72
  };
  const deadline = new Date(createdAt);
  deadline.setHours(deadline.getHours() + (hours[priority] || 24));
  return deadline.toISOString();
}

function calculateRiskLevel(ticket, order, messages) {
  let score = 0;
  let reasons = [];

  if (ticket.ticket_type === 'damage' || ticket.ticket_type === 'return') {
    score += 2;
    reasons.push('Damage/return case');
  }

  if (order && order.total_amount > 1000) {
    score += 2;
    reasons.push('High value order');
  }

  if (ticket.priority === 'critical' || ticket.priority === 'high') {
    score += 1;
  }

  const international = order?.shipping_address && 
    !order.shipping_address.includes('USA') && 
    !order.shipping_address.includes('CA');
  if (international) {
    score += 2;
    reasons.push('International customer');
  }

  if (messages && messages.filter(m => m.message_type === 'customer').length > 3) {
    score += 1;
    reasons.push('High message volume');
  }

  const shippingKeywords = ['shipping', 'freight', 'customs', 'duty', 'return cost', 'shipping cost'];
  if (messages && messages.some(m => 
    shippingKeywords.some(kw => (m.content || '').toLowerCase().includes(kw))
  )) {
    score += 2;
    reasons.push('Shipping/freight dispute concerns');
  }

  if (score >= 5) return { level: 'high', reason: reasons.join('; ') };
  if (score >= 3) return { level: 'medium', reason: reasons.join('; ') };
  return { level: 'low', reason: null };
}

app.get('/api/dashboard', (req, res) => {
  try {
    const openTickets = db.prepare(`
      SELECT COUNT(*) as count FROM support_tickets 
      WHERE status IN ('open', 'in_progress', 'waiting_customer')
    `).get();
    
    const criticalTickets = db.prepare(`
      SELECT COUNT(*) as count FROM support_tickets 
      WHERE priority = 'critical' AND status != 'resolved' AND status != 'closed'
    `).get();

    const highRisk = db.prepare(`
      SELECT COUNT(*) as count FROM support_tickets 
      WHERE risk_level = 'high' AND status != 'resolved' AND status != 'closed'
    `).get();

    const slaBreaching = db.prepare(`
      SELECT COUNT(*) as count FROM support_tickets 
      WHERE sla_deadline < datetime('now') 
      AND status != 'resolved' AND status != 'closed'
    `).get();

    const todayTickets = db.prepare(`
      SELECT COUNT(*) as count FROM support_tickets 
      WHERE date(created_at) = date('now')
    `).get();

    const byType = db.prepare(`
      SELECT ticket_type, COUNT(*) as count 
      FROM support_tickets 
      GROUP BY ticket_type
    `).all();

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM support_tickets 
      GROUP BY status
    `).all();

    const recentTickets = db.prepare(`
      SELECT t.*, o.customer_name, o.total_amount
      FROM support_tickets t
      JOIN orders o ON t.order_id = o.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      openCount: openTickets.count,
      criticalCount: criticalTickets.count,
      highRiskCount: highRisk.count,
      slaBreachingCount: slaBreaching.count,
      todayCount: todayTickets.count,
      byType,
      byStatus,
      recentTickets
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets', (req, res) => {
  try {
    const { status, priority, risk, search } = req.query;
    
    let query = `
      SELECT t.*, o.customer_name, o.order_date, o.total_amount,
             (SELECT COUNT(*) FROM customer_messages m WHERE m.order_id = t.order_id) as message_count
      FROM support_tickets t
      JOIN orders o ON t.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND t.priority = ?';
      params.push(priority);
    }
    if (risk) {
      query += ' AND t.risk_level = ?';
      params.push(risk);
    }
    if (search) {
      query += ' AND (t.title LIKE ? OR o.customer_name LIKE ? OR t.order_id LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    query += ' ORDER BY t.priority = \'critical\' DESC, t.priority = \'high\' DESC, t.sla_deadline ASC';

    const tickets = db.prepare(query).all(...params);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id', (req, res) => {
  try {
    const ticket = db.prepare(`
      SELECT t.*, o.*
      FROM support_tickets t
      JOIN orders o ON t.order_id = o.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const orderItems = db.prepare(`
      SELECT oi.*, p.sku, p.name, p.warranty_months, p.dimensions, p.description
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(ticket.order_id);

    const packages = db.prepare(`
      SELECT * FROM packages WHERE order_id = ?
    `).all(ticket.order_id);

    const logistics = db.prepare(`
      SELECT l.* 
      FROM logistics l
      JOIN packages p ON l.package_id = p.id
      WHERE p.order_id = ?
      ORDER BY l.timestamp ASC
    `).all(ticket.order_id);

    const messages = db.prepare(`
      SELECT * FROM customer_messages 
      WHERE order_id = ? 
      ORDER BY created_at ASC
    `).all(ticket.order_id);

    const actions = db.prepare(`
      SELECT * FROM ticket_actions 
      WHERE ticket_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.id);

    const notes = db.prepare(`
      SELECT * FROM ticket_notes 
      WHERE ticket_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.id);

    const returns = db.prepare(`
      SELECT * FROM returns WHERE ticket_id = ?
    `).all(req.params.id);

    const replacements = db.prepare(`
      SELECT * FROM replacements WHERE ticket_id = ?
    `).all(req.params.id);

    const evidence = messages.filter(m => m.is_evidence === 1);

    const relatedSpareParts = db.prepare(`
      SELECT * FROM spare_parts 
      WHERE product_sku IN (SELECT sku FROM products p JOIN order_items oi ON p.id = oi.product_id WHERE oi.order_id = ?)
         OR product_sku IS NULL
    `).all(ticket.order_id);

    res.json({
      ticket,
      order: {
        ...ticket,
        items: orderItems,
        packages,
        logistics
      },
      messages,
      evidence,
      actions,
      notes,
      returns,
      replacements,
      relatedSpareParts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets', (req, res) => {
  try {
    const { order_id, ticket_type, priority, title, description, assigned_to } = req.body;
    const id = `TKT-${Date.now().toString().slice(-4)}`;
    const createdAt = nowISO();
    const slaDeadline = calculateSlaDeadline(priority, createdAt);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    const messages = db.prepare('SELECT * FROM customer_messages WHERE order_id = ?').all(order_id);
    const { level, reason } = calculateRiskLevel(
      { ticket_type, priority },
      order,
      messages
    );

    db.prepare(`
      INSERT INTO support_tickets 
      (id, order_id, ticket_type, priority, title, description, status, 
       assigned_to, sla_deadline, risk_level, risk_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    `).run(id, order_id, ticket_type, priority, title, description, assigned_to, 
           slaDeadline, level, reason, createdAt, createdAt);

    res.status(201).json({ id, ...req.body, status: 'open', sla_deadline: slaDeadline, risk_level: level });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tickets/:id', (req, res) => {
  try {
    const { status, priority, assigned_to, resolution, risk_level, risk_reason } = req.body;
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const fields = [];
    const values = [];

    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
    if (assigned_to !== undefined) { fields.push('assigned_to = ?'); values.push(assigned_to); }
    if (resolution !== undefined) { fields.push('resolution = ?'); values.push(resolution); }
    if (risk_level !== undefined) { fields.push('risk_level = ?'); values.push(risk_level); }
    if (risk_reason !== undefined) { fields.push('risk_reason = ?'); values.push(risk_reason); }
    
    fields.push('updated_at = ?');
    values.push(nowISO());
    values.push(req.params.id);

    if (fields.length > 1) {
      db.prepare(`UPDATE support_tickets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/notes', (req, res) => {
  try {
    const { content, author, is_internal } = req.body;
    const id = generateId();
    db.prepare(`
      INSERT INTO ticket_notes (id, ticket_id, content, author, is_internal, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, content, author, is_internal ? 1 : 0, nowISO());

    res.status(201).json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/actions', (req, res) => {
  try {
    const { action_type, description, author } = req.body;
    const id = generateId();
    db.prepare(`
      INSERT INTO ticket_actions (id, ticket_id, action_type, description, author, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, action_type, description, author, nowISO());

    db.prepare(`UPDATE support_tickets SET updated_at = ? WHERE id = ?`).run(nowISO(), req.params.id);

    res.status(201).json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/returns', (req, res) => {
  try {
    const { return_type, reason, shipping_cost, shipping_cost_responsibility, refund_amount, notes } = req.body;
    const id = generateId();
    db.prepare(`
      INSERT INTO returns (id, ticket_id, return_type, reason, status, shipping_cost, 
                          shipping_cost_responsibility, refund_amount, notes, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).run(id, req.params.id, return_type, reason, shipping_cost, shipping_cost_responsibility, 
           refund_amount, notes, nowISO());

    res.status(201).json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/replacements', (req, res) => {
  try {
    const { replacement_type, item_sku, item_name, quantity, notes } = req.body;
    const id = generateId();
    db.prepare(`
      INSERT INTO replacements (id, ticket_id, replacement_type, item_sku, item_name, 
                               quantity, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, req.params.id, replacement_type, item_sku, item_name, quantity, notes, nowISO());

    res.status(201).json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT o.*, 
             (SELECT COUNT(*) FROM support_tickets t WHERE t.order_id = o.id) as ticket_count
      FROM orders o
    `;
    const params = [];

    if (search) {
      query += ' WHERE o.id LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    query += ' ORDER BY o.order_date DESC LIMIT 100';

    const orders = db.prepare(query).all(...params);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const { id, customer_name, customer_email, customer_phone, order_date, 
            total_amount, shipping_address, status, notes } = req.body;
    
    const orderId = id || `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const createdAt = nowISO();

    db.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone, order_date, 
                         total_amount, shipping_address, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, customer_name, customer_email, customer_phone, order_date,
           total_amount, shipping_address, status || 'pending', notes, createdAt, createdAt);

    res.status(201).json({ id: orderId, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const { sku, name, category, price, weight, dimensions, warranty_months, description } = req.body;
    const id = generateId();
    
    db.prepare(`
      INSERT INTO products (id, sku, name, category, price, weight, dimensions, warranty_months, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sku, name, category, price, weight, dimensions, warranty_months || 12, description);

    res.status(201).json({ id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/spare-parts', (req, res) => {
  try {
    const parts = db.prepare(`
      SELECT *, (stock - reserved) as available
      FROM spare_parts
      ORDER BY name ASC
    `).all();
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/spare-parts/:sku/reserve', (req, res) => {
  try {
    const { quantity } = req.body;
    const part = db.prepare('SELECT * FROM spare_parts WHERE sku = ?').get(req.params.sku);
    
    if (!part) {
      return res.status(404).json({ error: 'Spare part not found' });
    }
    
    if (part.stock - part.reserved < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    db.prepare('UPDATE spare_parts SET reserved = reserved + ? WHERE sku = ?').run(quantity, req.params.sku);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id/export/markdown', (req, res) => {
  try {
    const data = JSON.parse(req.query.data || '{}');
    const { ticket, order, messages, actions, notes, returns, replacements, evidence } = data;

    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleString();
    };

    let markdown = `# Support Ticket: ${ticket.title}\n\n`;
    markdown += `**Ticket ID:** ${ticket.id}\n`;
    markdown += `**Status:** ${ticket.status}\n`;
    markdown += `**Priority:** ${ticket.priority}\n`;
    markdown += `**Risk Level:** ${ticket.risk_level}\n`;
    markdown += `**Assigned To:** ${ticket.assigned_to || 'Unassigned'}\n`;
    markdown += `**Created:** ${formatDate(ticket.created_at)}\n`;
    markdown += `**SLA Deadline:** ${formatDate(ticket.sla_deadline)}\n\n`;
    markdown += `## Description\n${ticket.description || 'N/A'}\n\n`;

    if (order) {
      markdown += `## Customer & Order Information\n`;
      markdown += `- **Customer:** ${order.customer_name}\n`;
      markdown += `- **Email:** ${order.customer_email || 'N/A'}\n`;
      markdown += `- **Phone:** ${order.customer_phone || 'N/A'}\n`;
      markdown += `- **Order ID:** ${order.id}\n`;
      markdown += `- **Order Date:** ${formatDate(order.order_date)}\n`;
      markdown += `- **Total Amount:** $${order.total_amount?.toFixed(2) || 'N/A'}\n`;
      markdown += `- **Shipping Address:** ${order.shipping_address || 'N/A'}\n\n`;
    }

    if (evidence && evidence.length > 0) {
      markdown += `## Evidence (${evidence.length} items)\n\n`;
      evidence.forEach((e, i) => {
        markdown += `### Evidence ${i + 1}\n`;
        markdown += `- **Date:** ${formatDate(e.created_at)}\n`;
        markdown += `- **From:** ${e.author}\n`;
        markdown += `- **Content:** ${e.content}\n`;
        if (e.attachment_url) markdown += `- **Attachment:** ${e.attachment_url}\n`;
        markdown += '\n';
      });
    }

    if (messages && messages.length > 0) {
      markdown += `## Communication History\n\n`;
      messages.forEach(m => {
        markdown += `### ${m.message_type === 'agent' ? 'Agent' : 'Customer'} - ${formatDate(m.created_at)}\n`;
        markdown += `${m.content}\n\n`;
      });
    }

    if (actions && actions.length > 0) {
      markdown += `## Actions Taken\n\n`;
      actions.forEach(a => {
        markdown += `- [${a.action_type}] ${formatDate(a.created_at)} - ${a.author || 'System'}: ${a.description}\n`;
      });
      markdown += '\n';
    }

    if (returns && returns.length > 0) {
      markdown += `## Returns / Refunds\n\n`;
      returns.forEach(r => {
        markdown += `- **Type:** ${r.return_type}\n`;
        markdown += `  - **Reason:** ${r.reason}\n`;
        markdown += `  - **Status:** ${r.status}\n`;
        markdown += `  - **Refund Amount:** $${r.refund_amount?.toFixed(2) || 'N/A'}\n`;
        markdown += `  - **Shipping Cost:** $${r.shipping_cost?.toFixed(2) || 'N/A'}\n`;
        if (r.shipping_cost_responsibility) markdown += `  - **Cost Responsibility:** ${r.shipping_cost_responsibility}\n`;
        if (r.notes) markdown += `  - **Notes:** ${r.notes}\n`;
      });
      markdown += '\n';
    }

    if (replacements && replacements.length > 0) {
      markdown += `## Replacements\n\n`;
      replacements.forEach(r => {
        markdown += `- **Type:** ${r.replacement_type}\n`;
        markdown += `  - **Item:** ${r.item_name} (${r.item_sku})\n`;
        markdown += `  - **Quantity:** ${r.quantity}\n`;
        markdown += `  - **Status:** ${r.status}\n`;
        if (r.tracking_number) markdown += `  - **Tracking:** ${r.tracking_number}\n`;
        if (r.notes) markdown += `  - **Notes:** ${r.notes}\n`;
      });
      markdown += '\n';
    }

    if (notes && notes.length > 0) {
      markdown += `## Internal Notes\n\n`;
      notes.forEach(n => {
        markdown += `### ${n.author || 'Agent'} - ${formatDate(n.created_at)}\n`;
        markdown += `${n.content}\n\n`;
      });
    }

    if (ticket.resolution) {
      markdown += `## Resolution\n${ticket.resolution}\n`;
    }

    markdown += `\n---\n*Exported at: ${new Date().toLocaleString()}*\n`;

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${ticket.id}.md"`);
    res.send(markdown);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id/export/csv', (req, res) => {
  try {
    const data = JSON.parse(req.query.data || '{}');
    const { ticket, order } = data;

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      return new Date(dateStr).toISOString().slice(0, 19).replace('T', ' ');
    };

    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headers = [
      'Ticket ID', 'Title', 'Type', 'Status', 'Priority', 'Risk Level',
      'Assigned To', 'Created At', 'SLA Deadline',
      'Customer', 'Order ID', 'Order Date', 'Order Amount',
      'Description', 'Resolution'
    ];

    const row = [
      ticket.id, ticket.title, ticket.ticket_type, ticket.status, 
      ticket.priority, ticket.risk_level, ticket.assigned_to || '',
      formatDate(ticket.created_at), formatDate(ticket.sla_deadline),
      order?.customer_name || '', ticket.order_id, formatDate(order?.order_date),
      order?.total_amount?.toFixed(2) || '', ticket.description || '',
      ticket.resolution || ''
    ];

    const csv = headers.join(',') + '\n' + row.map(escape).join(',') + '\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${ticket.id}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/orders', (req, res) => {
  try {
    const { data, format } = req.body;
    
    if (format === 'csv') {
      const records = parse(data, { columns: true, skip_empty_lines: true });
      let imported = 0;
      
      records.forEach(record => {
        try {
          const orderId = record['Order ID'] || record['id'] || generateId();
          db.prepare(`
            INSERT OR REPLACE INTO orders 
            (id, customer_name, customer_email, customer_phone, order_date, 
             total_amount, shipping_address, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            orderId,
            record['Customer Name'] || record['customer_name'] || '',
            record['Email'] || record['customer_email'] || '',
            record['Phone'] || record['customer_phone'] || '',
            record['Order Date'] || record['order_date'] || nowISO(),
            parseFloat(record['Total'] || record['total_amount'] || 0),
            record['Address'] || record['shipping_address'] || '',
            record['Status'] || record['status'] || 'pending',
            record['Notes'] || record['notes'] || '',
            nowISO(),
            nowISO()
          );
          imported++;
        } catch (e) {
          console.warn('Skipping record:', e.message);
        }
      });
      
      res.json({ imported, total: records.length });
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: nowISO() });
});

app.listen(PORT, () => {
  console.log(`Customer Service Backend running on http://localhost:${PORT}`);
});
