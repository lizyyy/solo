const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getNow() {
    return new Date().toISOString();
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await dbAll('SELECT * FROM installation_orders ORDER BY created_at DESC');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await dbGet('SELECT * FROM installation_orders WHERE id = ?', [req.params.id]);
        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }
        
        const visits = await dbAll('SELECT * FROM visits WHERE order_id = ? ORDER BY created_at DESC', [req.params.id]);
        const parts = await dbAll('SELECT * FROM parts WHERE order_id = ? ORDER BY created_at DESC', [req.params.id]);
        const reworks = await dbAll('SELECT * FROM reworks WHERE order_id = ? ORDER BY created_at DESC', [req.params.id]);
        const settlements = await dbAll('SELECT * FROM settlements WHERE order_id = ? ORDER BY created_at DESC', [req.params.id]);
        
        res.json({ ...order, visits, parts, reworks, settlements });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { order_no, customer_name, customer_phone, customer_address, product_name, installer_name, install_date } = req.body;
        
        const existing = await dbGet('SELECT id FROM installation_orders WHERE order_no = ?', [order_no]);
        if (existing) {
            return res.status(400).json({ error: '订单号已存在' });
        }
        
        const id = generateId();
        const now = getNow();
        
        await dbRun(`
            INSERT INTO installation_orders (id, order_no, customer_name, customer_phone, customer_address, product_name, installer_name, install_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_visit', ?, ?)
        `, [id, order_no, customer_name, customer_phone, customer_address, product_name, installer_name, install_date, now, now]);
        
        res.json({ id, message: '创建成功' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders/:id/visit', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { visitor_name, satisfaction, feedback, issues } = req.body;
        
        const order = await dbGet('SELECT * FROM installation_orders WHERE id = ?', [orderId]);
        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }
        
        if (order.status === 'closed') {
            return res.status(400).json({ error: '工单已关闭，无法回访' });
        }
        
        const existingVisit = await dbGet('SELECT id FROM visits WHERE order_id = ?', [orderId]);
        if (existingVisit) {
            return res.status(400).json({ error: '该工单已完成回访，不可重复提交' });
        }
        
        const visitId = generateId();
        const now = getNow();
        
        await dbRun(`
            INSERT INTO visits (id, order_id, visitor_name, visit_date, satisfaction, feedback, issues, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [visitId, orderId, visitor_name, now, satisfaction, feedback || null, issues ? (Array.isArray(issues) ? issues.join(',') : issues) : null, now]);
        
        let newStatus = 'visited';
        if (issues && issues.length > 0) {
            newStatus = 'has_issues';
        }
        
        await dbRun('UPDATE installation_orders SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, orderId]);
        
        res.json({ id: visitId, message: '回访记录成功' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: '该工单已完成回访，不可重复提交' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders/:id/parts', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { part_name, quantity } = req.body;
        
        const order = await dbGet('SELECT * FROM installation_orders WHERE id = ?', [orderId]);
        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }
        
        if (order.status === 'closed') {
            return res.status(400).json({ error: '工单已关闭，无法补发配件' });
        }
        
        const existingPart = await dbGet(
            'SELECT id FROM parts WHERE order_id = ? AND part_name = ? AND status IN (?, ?)',
            [orderId, part_name, 'pending', 'sent']
        );
        
        if (existingPart) {
            return res.status(400).json({ error: '该配件已有待处理或已发货的记录' });
        }
        
        const partId = generateId();
        const now = getNow();
        
        await dbRun(`
            INSERT INTO parts (id, order_id, part_name, quantity, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `, [partId, orderId, part_name, quantity, now]);
        
        res.json({ id: partId, message: '配件补发申请已创建' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/parts/:id/send', async (req, res) => {
    try {
        const { sender } = req.body;
        const now = getNow();
        
        const part = await dbGet('SELECT * FROM parts WHERE id = ?', [req.params.id]);
        if (!part) {
            return res.status(404).json({ error: '配件记录不存在' });
        }
        
        if (part.status !== 'pending') {
            return res.status(400).json({ error: '该配件已发货，不可重复发送' });
        }
        
        await dbRun('UPDATE parts SET status = ?, sender = ?, send_date = ? WHERE id = ?',
            ['sent', sender, now, req.params.id]);
        
        res.json({ message: '配件已发货' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders/:id/rework', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason, reworker_name } = req.body;
        
        const order = await dbGet('SELECT * FROM installation_orders WHERE id = ?', [orderId]);
        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }
        
        if (order.status === 'closed') {
            return res.status(400).json({ error: '工单已关闭，无法发起返工' });
        }
        
        const pendingRework = await dbGet(
            'SELECT id FROM reworks WHERE order_id = ? AND status = ?',
            [orderId, 'pending']
        );
        
        if (pendingRework) {
            return res.status(400).json({ error: '该工单已有待处理的返工记录' });
        }
        
        const reworkId = generateId();
        const now = getNow();
        
        await dbRun(`
            INSERT INTO reworks (id, order_id, reason, reworker_name, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `, [reworkId, orderId, reason, reworker_name, now]);
        
        await dbRun('UPDATE installation_orders SET status = ?, updated_at = ? WHERE id = ?',
            ['reworking', now, orderId]);
        
        res.json({ id: reworkId, message: '返工已发起' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reworks/:id/complete', async (req, res) => {
    try {
        const { satisfaction_after } = req.body;
        const now = getNow();
        
        const rework = await dbGet('SELECT * FROM reworks WHERE id = ?', [req.params.id]);
        if (!rework) {
            return res.status(404).json({ error: '返工记录不存在' });
        }
        
        if (rework.status !== 'pending') {
            return res.status(400).json({ error: '该返工已完成' });
        }
        
        await dbRun(`
            UPDATE reworks 
            SET status = ?, rework_date = ?, satisfaction_after = ? 
            WHERE id = ?
        `, ['completed', now, satisfaction_after, req.params.id]);
        
        const order = await dbGet('SELECT * FROM installation_orders WHERE id = ?', [rework.order_id]);
        let newStatus = 'visited';
        if (satisfaction_after < 4) {
            newStatus = 'has_issues';
        }
        
        await dbRun('UPDATE installation_orders SET status = ?, updated_at = ? WHERE id = ?',
            [newStatus, now, rework.order_id]);
        
        res.json({ message: '返工已完成' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders/:id/settle', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { base_amount, deduction, bonus, settled_by, remarks } = req.body;
        
        const order = await dbGet('SELECT * FROM installation_orders WHERE id = ?', [orderId]);
        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }
        
        if (order.status === 'closed') {
            return res.status(400).json({ error: '工单已关闭，不可重复结算' });
        }
        
        const visits = await dbGet('SELECT COUNT(*) as count FROM visits WHERE order_id = ?', [orderId]);
        if (visits.count === 0) {
            return res.status(400).json({ error: '未完成回访，不可结算' });
        }
        
        const pendingRework = await dbGet(
            'SELECT COUNT(*) as count FROM reworks WHERE order_id = ? AND status = ?',
            [orderId, 'pending']
        );
        
        if (pendingRework.count > 0) {
            return res.status(400).json({ error: '有待处理的返工，不可结算' });
        }
        
        const reworks = await dbAll('SELECT * FROM reworks WHERE order_id = ? AND status = ?', [orderId, 'completed']);
        const hasReworkWithoutSatisfaction = reworks.some(r => !r.satisfaction_after);
        if (hasReworkWithoutSatisfaction) {
            return res.status(400).json({ error: '存在返工后未更新满意度的记录' });
        }
        
        const final_amount = base_amount - deduction + bonus;
        const settleId = generateId();
        const now = getNow();
        
        await dbRun(`
            INSERT INTO settlements (id, order_id, base_amount, deduction, bonus, final_amount, settled_by, settle_date, remarks, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [settleId, orderId, base_amount, deduction, bonus, final_amount, settled_by, now, remarks, now]);
        
        await dbRun('UPDATE installation_orders SET status = ?, updated_at = ? WHERE id = ?',
            ['closed', now, orderId]);
        
        res.json({ id: settleId, final_amount, message: '结算完成' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const totalOrders = await dbGet('SELECT COUNT(*) as count FROM installation_orders');
        const closedOrders = await dbGet('SELECT COUNT(*) as count FROM installation_orders WHERE status = ?', ['closed']);
        
        const avgSatisfactionRow = await dbGet(`
            SELECT AVG(v.satisfaction) as avg_satisfaction
            FROM installation_orders o
            JOIN visits v ON o.id = v.order_id
            WHERE o.status = 'closed'
        `);
        const avgSatisfaction = avgSatisfactionRow.avg_satisfaction || 0;
        
        const reworkCountRow = await dbGet(`
            SELECT COUNT(DISTINCT order_id) as count 
            FROM reworks 
            WHERE status = 'completed'
        `);
        const reworkCount = reworkCountRow.count;
        
        const reworkRate = closedOrders.count > 0 ? (reworkCount / closedOrders.count * 100).toFixed(2) : 0;
        
        const settlementStatsRow = await dbGet(`
            SELECT 
                AVG(base_amount) as avg_base,
                AVG(deduction) as avg_deduction,
                AVG(bonus) as avg_bonus,
                AVG(final_amount) as avg_final
            FROM settlements
        `);
        const settlementStats = settlementStatsRow;
        
        const recentOrders = await dbAll(`
            SELECT 
                o.*,
                v.satisfaction,
                s.final_amount,
                CASE WHEN EXISTS (SELECT 1 FROM reworks r WHERE r.order_id = o.id AND r.status = 'completed') THEN 1 ELSE 0 END as has_rework
            FROM installation_orders o
            LEFT JOIN visits v ON o.id = v.order_id
            LEFT JOIN settlements s ON o.id = s.order_id
            ORDER BY o.created_at DESC
            LIMIT 20
        `);
        
        res.json({
            totalOrders: totalOrders.count,
            closedOrders: closedOrders.count,
            avgSatisfaction: avgSatisfaction.toFixed(2),
            reworkRate,
            reworkCount,
            settlementStats,
            recentOrders
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
