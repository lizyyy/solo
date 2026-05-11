const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let db;

const DB_FILE = 'parent_child.db';

async function initDB() {
    const SQL = await initSqlJs();
    
    if (fs.existsSync(DB_FILE)) {
        const fileBuffer = fs.readFileSync(DB_FILE);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }
    
    db.run(`
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            location TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            points INTEGER NOT NULL DEFAULT 10,
            status TEXT NOT NULL DEFAULT 'active',
            makeup_window_hours INTEGER NOT NULL DEFAULT 24,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS families (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            total_points INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id INTEGER NOT NULL,
            family_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'registered',
            child_name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_id INTEGER NOT NULL,
            checkin_time TEXT DEFAULT CURRENT_TIMESTAMP,
            checkin_type TEXT NOT NULL DEFAULT 'normal',
            operator TEXT
        );

        CREATE TABLE IF NOT EXISTS makeup_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TEXT,
            reviewer TEXT,
            review_comment TEXT
        );

        CREATE TABLE IF NOT EXISTS points_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id INTEGER NOT NULL,
            activity_id INTEGER,
            points INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS refunds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            registration_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            refunded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            operator TEXT
        );

        CREATE TABLE IF NOT EXISTS exceptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            activity_id INTEGER,
            family_id INTEGER,
            registration_id INTEGER,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    const activityCount = db.exec('SELECT COUNT(*) as count FROM activities')[0].values[0][0];
    
    if (activityCount === 0) {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 86400000);
        const tomorrow = new Date(now.getTime() + 86400000);
        const formatDate = (d) => d.toISOString().split('T')[0];
        
        const stmt = db.prepare(`
            INSERT INTO activities (name, type, date, time, location, capacity, points, makeup_window_hours)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(['奇妙绘本之旅', '绘本课', formatDate(yesterday), '10:00', '绘本室A', 10, 15, 72]);
        stmt.run(['创意手工坊', '手工课', formatDate(now), '14:00', '手工教室', 8, 20, 48]);
        stmt.run(['自然探索营', '户外活动', formatDate(tomorrow), '09:00', '城市公园', 12, 25, 72]);
        stmt.run(['故事小剧场', '绘本课', formatDate(tomorrow), '15:00', '绘本室B', 15, 10, 24]);
    }
    
    const familyCount = db.exec('SELECT COUNT(*) as count FROM families')[0].values[0][0];
    
    if (familyCount === 0) {
        const stmt = db.prepare('INSERT INTO families (name, phone) VALUES (?, ?)');
        stmt.run(['李明家庭', '13800000001']);
        stmt.run(['王芳家庭', '13800000002']);
        stmt.run(['张伟家庭', '13800000003']);
        stmt.run(['刘洋家庭', '13800000004']);
        stmt.run(['陈静家庭', '13800000005']);
    }
    
    const regCount = db.exec('SELECT COUNT(*) as count FROM registrations')[0].values[0][0];
    
    if (regCount === 0) {
        const stmt = db.prepare('INSERT INTO registrations (activity_id, family_id, child_name) VALUES (?, ?, ?)');
        stmt.run([1, 1, '李小宝']);
        stmt.run([1, 2, '王小花']);
        stmt.run([2, 1, '李小宝']);
        stmt.run([2, 3, '张小贝']);
        stmt.run([2, 4, '刘小阳']);
        stmt.run([3, 2, '王小花']);
        stmt.run([3, 5, '陈小豆']);
        stmt.run([4, 3, '张小贝']);
    }
    
    const checkinCount = db.exec('SELECT COUNT(*) as count FROM checkins')[0].values[0][0];
    
    if (checkinCount === 0) {
        db.run('INSERT INTO checkins (registration_id, checkin_type, operator) VALUES (?, ?, ?)', [1, 'normal', '张老师']);
        db.run('INSERT INTO points_records (family_id, activity_id, points, type, description) VALUES (?, ?, ?, ?, ?)', [1, 1, 15, 'earn', '绘本课签到积分']);
        db.run('UPDATE families SET total_points = total_points + ? WHERE id = ?', [15, 1]);
    }
    
    const refundCount = db.exec('SELECT COUNT(*) as count FROM refunds')[0].values[0][0];
    
    if (refundCount === 0) {
        db.run('INSERT INTO refunds (registration_id, reason, operator) VALUES (?, ?, ?)', [2, '孩子身体不适缺席', '李老师']);
        db.run('UPDATE registrations SET status = ? WHERE id = ?', ['refunded', 2]);
    }
    
    const makeupCount = db.exec('SELECT COUNT(*) as count FROM makeup_requests')[0].values[0][0];
    
    if (makeupCount === 0) {
        db.run('INSERT INTO makeup_requests (registration_id, reason) VALUES (?, ?)', [3, '当时堵车迟到未签到，实际已参加']);
    }
    
    const exceptionCount = db.exec('SELECT COUNT(*) as count FROM exceptions')[0].values[0][0];
    
    if (exceptionCount === 0) {
        db.run('INSERT INTO exceptions (type, activity_id, family_id, registration_id, description) VALUES (?, ?, ?, ?, ?)', ['late_makeup', 2, 1, 3, '签到超时，申请补录']);
    }
    
    saveDB();
}

function saveDB() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
}

function query(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function exec(sql, params = []) {
    db.run(sql, params);
    saveDB();
}

function getNow() {
    return new Date().toISOString();
}

app.get('/api/activities', (req, res) => {
    const activities = query(`
        SELECT a.*,
            (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id) as registered_count,
            (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id AND r.status = 'registered') as active_count,
            (SELECT COUNT(*) FROM checkins c
                JOIN registrations r ON c.registration_id = r.id
                WHERE r.activity_id = a.id) as checkedin_count
        FROM activities a
        ORDER BY a.date DESC, a.time DESC
    `);
    res.json(activities);
});

app.post('/api/activities', (req, res) => {
    const { name, type, date, time, location, capacity, points, makeup_window_hours } = req.body;
    exec(`
        INSERT INTO activities (name, type, date, time, location, capacity, points, makeup_window_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, type, date, time, location, capacity, points, makeup_window_hours || 24]);
    
    const result = query('SELECT last_insert_rowid() as id')[0];
    res.json({ id: result.id });
});

app.get('/api/activities/:id', (req, res) => {
    const activity = query(`
        SELECT a.*,
            (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id) as registered_count
        FROM activities a WHERE a.id = ?
    `, [req.params.id])[0];
    
    if (!activity) {
        return res.status(404).json({ error: '活动不存在' });
    }
    
    const registrations = query(`
        SELECT r.*, f.name as family_name, f.phone,
            (SELECT COUNT(*) FROM checkins c WHERE c.registration_id = r.id) as is_checkedin,
            (SELECT mr.status FROM makeup_requests mr WHERE mr.registration_id = r.id ORDER BY mr.id DESC LIMIT 1) as makeup_status,
            (SELECT COUNT(*) FROM refunds ref WHERE ref.registration_id = r.id) as is_refunded
        FROM registrations r
        JOIN families f ON r.family_id = f.id
        WHERE r.activity_id = ?
        ORDER BY r.created_at DESC
    `, [req.params.id]);
    
    res.json({ activity, registrations });
});

app.get('/api/families', (req, res) => {
    const families = query(`
        SELECT f.*,
            (SELECT COUNT(*) FROM registrations r WHERE r.family_id = f.id) as registration_count,
            (SELECT COUNT(*) FROM checkins c
                JOIN registrations r ON c.registration_id = r.id
                WHERE r.family_id = f.id) as checkin_count
        FROM families f
        ORDER BY f.id
    `);
    res.json(families);
});

app.get('/api/families/:id', (req, res) => {
    const family = query('SELECT * FROM families WHERE id = ?', [req.params.id])[0];
    
    if (!family) {
        return res.status(404).json({ error: '家庭不存在' });
    }
    
    const registrations = query(`
        SELECT r.*, a.name as activity_name, a.type as activity_type, a.date as activity_date, a.time as activity_time,
            (SELECT COUNT(*) FROM checkins c WHERE c.registration_id = r.id) as is_checkedin,
            (SELECT c.checkin_time FROM checkins c WHERE c.registration_id = r.id ORDER BY c.id DESC LIMIT 1) as checkin_time,
            (SELECT c.checkin_type FROM checkins c WHERE c.registration_id = r.id ORDER BY c.id DESC LIMIT 1) as checkin_type,
            (SELECT mr.status FROM makeup_requests mr WHERE mr.registration_id = r.id ORDER BY mr.id DESC LIMIT 1) as makeup_status,
            (SELECT COUNT(*) FROM refunds ref WHERE ref.registration_id = r.id) as is_refunded,
            (SELECT ref.reason FROM refunds ref WHERE ref.registration_id = r.id) as refund_reason
        FROM registrations r
        JOIN activities a ON r.activity_id = a.id
        WHERE r.family_id = ?
        ORDER BY a.date DESC, a.time DESC
    `, [req.params.id]);
    
    const pointsHistory = query(`
        SELECT pr.*, a.name as activity_name
        FROM points_records pr
        LEFT JOIN activities a ON pr.activity_id = a.id
        WHERE pr.family_id = ?
        ORDER BY pr.created_at DESC
    `, [req.params.id]);
    
    const makeupRequests = query(`
        SELECT mr.*, a.name as activity_name, a.date as activity_date,
            r.child_name
        FROM makeup_requests mr
        JOIN registrations r ON mr.registration_id = r.id
        JOIN activities a ON r.activity_id = a.id
        WHERE r.family_id = ?
        ORDER BY mr.requested_at DESC
    `, [req.params.id]);
    
    res.json({ family, registrations, pointsHistory, makeupRequests });
});

app.post('/api/registrations', (req, res) => {
    const { activity_id, family_id, child_name } = req.body;
    
    const activity = query('SELECT * FROM activities WHERE id = ?', [activity_id])[0];
    if (!activity) {
        return res.status(400).json({ error: '活动不存在' });
    }
    
    const registeredCount = query(`
        SELECT COUNT(*) as count FROM registrations WHERE activity_id = ? AND status = 'registered'
    `, [activity_id])[0].count;
    
    if (registeredCount >= activity.capacity) {
        return res.status(400).json({ error: '活动名额已满' });
    }
    
    const existing = query(`
        SELECT * FROM registrations WHERE activity_id = ? AND family_id = ?
    `, [activity_id, family_id])[0];
    
    if (existing) {
        return res.status(400).json({ error: '该家庭已报名此活动' });
    }
    
    exec('INSERT INTO registrations (activity_id, family_id, child_name) VALUES (?, ?, ?)', [activity_id, family_id, child_name]);
    const result = query('SELECT last_insert_rowid() as id')[0];
    res.json({ id: result.id });
});

app.post('/api/checkins', (req, res) => {
    const { registration_id, operator } = req.body;
    
    const registration = query('SELECT * FROM registrations WHERE id = ?', [registration_id])[0];
    if (!registration) {
        return res.status(400).json({ error: '报名记录不存在' });
    }
    
    if (registration.status !== 'registered') {
        return res.status(400).json({ error: '报名状态异常，无法签到' });
    }
    
    const existing = query('SELECT * FROM checkins WHERE registration_id = ?', [registration_id])[0];
    if (existing) {
        return res.status(400).json({ error: '已签到，请勿重复操作' });
    }
    
    const refunded = query('SELECT * FROM refunds WHERE registration_id = ?', [registration_id])[0];
    if (refunded) {
        return res.status(400).json({ error: '已退款，无法签到' });
    }
    
    const activity = query('SELECT * FROM activities WHERE id = ?', [registration.activity_id])[0];
    const now = getNow();
    
    exec('INSERT INTO checkins (registration_id, checkin_time, checkin_type, operator) VALUES (?, ?, ?, ?)', 
        [registration_id, now, 'normal', operator || '系统']);
    
    if (activity.points > 0) {
        exec('INSERT INTO points_records (family_id, activity_id, points, type, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [registration.family_id, registration.activity_id, activity.points, 'earn', `${activity.name} 签到积分`, now]);
        exec('UPDATE families SET total_points = total_points + ? WHERE id = ?', [activity.points, registration.family_id]);
    }
    
    res.json({ success: true });
});

app.post('/api/makeup-requests', (req, res) => {
    const { registration_id, reason } = req.body;
    
    const registration = query('SELECT * FROM registrations WHERE id = ?', [registration_id])[0];
    if (!registration) {
        return res.status(400).json({ error: '报名记录不存在' });
    }
    
    const activity = query('SELECT * FROM activities WHERE id = ?', [registration.activity_id])[0];
    
    const activityDateTime = new Date(`${activity.date}T${activity.time}`);
    const now = new Date();
    const hoursDiff = (now - activityDateTime) / (1000 * 60 * 60);
    
    if (hoursDiff < 0) {
        return res.status(400).json({ error: '活动尚未开始，无需补录' });
    }
    
    if (hoursDiff > activity.makeup_window_hours) {
        return res.status(400).json({ error: `超出补录时间窗口（${activity.makeup_window_hours}小时）` });
    }
    
    const existingCheckin = query('SELECT * FROM checkins WHERE registration_id = ?', [registration_id])[0];
    if (existingCheckin) {
        return res.status(400).json({ error: '已签到，无需补录' });
    }
    
    const pending = query(`
        SELECT * FROM makeup_requests WHERE registration_id = ? AND status = 'pending'
    `, [registration_id])[0];
    
    if (pending) {
        return res.status(400).json({ error: '已有补录申请待审核' });
    }
    
    const refunded = query('SELECT * FROM refunds WHERE registration_id = ?', [registration_id])[0];
    if (refunded) {
        return res.status(400).json({ error: '已退款，无法补录' });
    }
    
    const nowStr = getNow();
    exec('INSERT INTO makeup_requests (registration_id, reason, requested_at) VALUES (?, ?, ?)', [registration_id, reason, nowStr]);
    
    exec('INSERT INTO exceptions (type, activity_id, family_id, registration_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
        ['makeup_request', activity.id, registration.family_id, registration_id, `申请补录：${reason}`, nowStr]);
    
    const result = query('SELECT last_insert_rowid() as id')[0];
    res.json({ id: result.id });
});

app.get('/api/makeup-requests', (req, res) => {
    const status = req.query.status;
    
    let sql = `
        SELECT mr.*, a.name as activity_name, a.date as activity_date, a.time as activity_time,
            f.name as family_name, r.child_name
        FROM makeup_requests mr
        JOIN registrations r ON mr.registration_id = r.id
        JOIN activities a ON r.activity_id = a.id
        JOIN families f ON r.family_id = f.id
    `;
    
    const params = [];
    if (status) {
        sql += ' WHERE mr.status = ?';
        params.push(status);
    }
    
    sql += ' ORDER BY mr.requested_at DESC';
    
    const requests = query(sql, params);
    res.json(requests);
});

app.post('/api/makeup-requests/:id/approve', (req, res) => {
    const { reviewer, review_comment } = req.body;
    const requestId = req.params.id;
    
    const request = query('SELECT * FROM makeup_requests WHERE id = ?', [requestId])[0];
    if (!request) {
        return res.status(404).json({ error: '补录申请不存在' });
    }
    
    if (request.status !== 'pending') {
        return res.status(400).json({ error: '该申请已处理' });
    }
    
    const registration = query('SELECT * FROM registrations WHERE id = ?', [request.registration_id])[0];
    const activity = query('SELECT * FROM activities WHERE id = ?', [registration.activity_id])[0];
    
    const existingCheckin = query('SELECT * FROM checkins WHERE registration_id = ?', [registration.id])[0];
    if (existingCheckin) {
        return res.status(400).json({ error: '该报名已签到' });
    }
    
    const refunded = query('SELECT * FROM refunds WHERE registration_id = ?', [registration.id])[0];
    if (refunded) {
        return res.status(400).json({ error: '已退款，无法发放积分' });
    }
    
    const now = getNow();
    exec(`
        UPDATE makeup_requests 
        SET status = 'approved', reviewed_at = ?, reviewer = ?, review_comment = ?
        WHERE id = ?
    `, [now, reviewer || '运营', review_comment || '', requestId]);
    
    exec('INSERT INTO checkins (registration_id, checkin_time, checkin_type, operator) VALUES (?, ?, ?, ?)',
        [request.registration_id, now, 'makeup', reviewer || '运营']);
    
    if (activity.points > 0) {
        exec('INSERT INTO points_records (family_id, activity_id, points, type, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [registration.family_id, registration.activity_id, activity.points, 'earn', `${activity.name} 补录签到积分`, now]);
        exec('UPDATE families SET total_points = total_points + ? WHERE id = ?', [activity.points, registration.family_id]);
    }
    
    exec(`
        UPDATE exceptions SET status = 'resolved'
        WHERE type = 'makeup_request' AND registration_id = ?
    `, [registration.id]);
    
    res.json({ success: true });
});

app.post('/api/makeup-requests/:id/reject', (req, res) => {
    const { reviewer, review_comment } = req.body;
    const requestId = req.params.id;
    
    const request = query('SELECT * FROM makeup_requests WHERE id = ?', [requestId])[0];
    if (!request) {
        return res.status(404).json({ error: '补录申请不存在' });
    }
    
    if (request.status !== 'pending') {
        return res.status(400).json({ error: '该申请已处理' });
    }
    
    const now = getNow();
    exec(`
        UPDATE makeup_requests 
        SET status = 'rejected', reviewed_at = ?, reviewer = ?, review_comment = ?
        WHERE id = ?
    `, [now, reviewer || '运营', review_comment || '资料不足', requestId]);
    
    const registration = query('SELECT * FROM registrations WHERE id = ?', [request.registration_id])[0];
    exec('INSERT INTO exceptions (type, activity_id, family_id, registration_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['makeup_rejected', registration.activity_id, registration.family_id, registration.id, `补录申请被驳回：${review_comment || '资料不足'}`, now]);
    
    res.json({ success: true });
});

app.post('/api/refunds', (req, res) => {
    const { registration_id, reason, operator } = req.body;
    
    const registration = query('SELECT * FROM registrations WHERE id = ?', [registration_id])[0];
    if (!registration) {
        return res.status(400).json({ error: '报名记录不存在' });
    }
    
    const checkin = query('SELECT * FROM checkins WHERE registration_id = ?', [registration_id])[0];
    if (checkin && checkin.checkin_type === 'normal') {
        return res.status(400).json({ error: '已正常签到，无法退款' });
    }
    
    const refunded = query('SELECT * FROM refunds WHERE registration_id = ?', [registration_id])[0];
    if (refunded) {
        return res.status(400).json({ error: '已退款，请勿重复操作' });
    }
    
    const activity = query('SELECT * FROM activities WHERE id = ?', [registration.activity_id])[0];
    const now = getNow();
    
    const existingPoints = query(`
        SELECT * FROM points_records WHERE family_id = ? AND activity_id = ?
    `, [registration.family_id, registration.activity_id])[0];
    
    if (existingPoints && existingPoints.points > 0) {
        exec('INSERT INTO points_records (family_id, activity_id, points, type, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [registration.family_id, registration.activity_id, -existingPoints.points, 'deduct', `${activity.name} 退款扣除积分`, now]);
        exec('UPDATE families SET total_points = total_points + ? WHERE id = ?', [-existingPoints.points, registration.family_id]);
    }
    
    exec('INSERT INTO refunds (registration_id, reason, refunded_at, operator) VALUES (?, ?, ?, ?)', 
        [registration_id, reason, now, operator || '系统']);
    exec('UPDATE registrations SET status = ? WHERE id = ?', ['refunded', registration_id]);
    
    exec('INSERT INTO exceptions (type, activity_id, family_id, registration_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['refund', activity.id, registration.family_id, registration_id, `缺席退款：${reason}`, now]);
    
    res.json({ success: true });
});

app.get('/api/points-records', (req, res) => {
    const records = query(`
        SELECT pr.*, f.name as family_name, a.name as activity_name
        FROM points_records pr
        JOIN families f ON pr.family_id = f.id
        LEFT JOIN activities a ON pr.activity_id = a.id
        ORDER BY pr.created_at DESC
        LIMIT 100
    `);
    res.json(records);
});

app.get('/api/exceptions', (req, res) => {
    const exceptions = query(`
        SELECT e.*, a.name as activity_name, f.name as family_name
        FROM exceptions e
        LEFT JOIN activities a ON e.activity_id = a.id
        LEFT JOIN families f ON e.family_id = f.id
        ORDER BY e.created_at DESC
    `);
    res.json(exceptions);
});

app.get('/api/stats/participation', (req, res) => {
    const stats = query(`
        SELECT 
            a.id as activity_id,
            a.name as activity_name,
            a.type as activity_type,
            a.date as activity_date,
            a.capacity,
            COUNT(DISTINCT r.id) as registered_count,
            COUNT(DISTINCT c.id) as checkedin_count,
            COUNT(DISTINCT ref.id) as refunded_count,
            COUNT(DISTINCT mr.id) as makeup_count
        FROM activities a
        LEFT JOIN registrations r ON a.id = r.activity_id
        LEFT JOIN checkins c ON r.id = c.registration_id
        LEFT JOIN refunds ref ON r.id = ref.registration_id
        LEFT JOIN makeup_requests mr ON r.id = mr.registration_id
        GROUP BY a.id
        ORDER BY a.date DESC, a.time DESC
    `);
    
    res.json(stats);
});

app.get('/api/stats/family-points', (req, res) => {
    const familyId = req.query.family_id;
    
    if (!familyId) {
        return res.status(400).json({ error: '请指定家庭ID' });
    }
    
    const family = query('SELECT * FROM families WHERE id = ?', [familyId])[0];
    if (!family) {
        return res.status(404).json({ error: '家庭不存在' });
    }
    
    const pointsWithDetails = query(`
        SELECT 
            pr.*,
            a.name as activity_name,
            a.points as original_points,
            mr.status as makeup_status,
            CASE 
                WHEN pr.description LIKE '%补录%' THEN 'makeup'
                ELSE 'normal'
            END as earn_type
        FROM points_records pr
        LEFT JOIN activities a ON pr.activity_id = a.id
        LEFT JOIN registrations r ON pr.activity_id = r.activity_id AND pr.family_id = r.family_id
        LEFT JOIN makeup_requests mr ON r.id = mr.registration_id
        WHERE pr.family_id = ?
        ORDER BY pr.created_at DESC
    `, [familyId]);
    
    res.json({
        family: {
            id: family.id,
            name: family.name,
            current_points: family.total_points
        },
        points_history: pointsWithDetails
    });
});

app.get('/api/demo-data', (req, res) => {
    res.json({
        activities: query('SELECT * FROM activities'),
        families: query('SELECT * FROM families'),
        registrations: query(`
            SELECT r.*, a.name as activity_name, f.name as family_name
            FROM registrations r
            JOIN activities a ON r.activity_id = a.id
            JOIN families f ON r.family_id = f.id
        `),
        checkins: query(`
            SELECT c.*, a.name as activity_name, f.name as family_name
            FROM checkins c
            JOIN registrations r ON c.registration_id = r.id
            JOIN activities a ON r.activity_id = a.id
            JOIN families f ON r.family_id = f.id
        `),
        makeup_requests: query('SELECT * FROM makeup_requests'),
        refunds: query('SELECT * FROM refunds'),
        points_records: query('SELECT * FROM points_records'),
        exceptions: query('SELECT * FROM exceptions')
    });
});

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`亲子活动签到补录台运行在 http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('数据库初始化失败:', err);
});
