const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbFile = path.join(dbDir, 'shield_review.db');

let SQL;
let db;

async function init() {
    SQL = await initSqlJs();

    if (fs.existsSync(dbFile)) {
        const buf = fs.readFileSync(dbFile);
        db = new SQL.Database(buf);
        console.log('✅ 已加载现有数据库文件');
    } else {
        db = new SQL.Database();
        console.log('🆕 创建新数据库文件');
    }

    db.run(`CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        report_no TEXT NOT NULL UNIQUE,
        project_name TEXT NOT NULL,
        shield_no TEXT NOT NULL,
        cutter_disc_no TEXT,
        shutdown_window_start TEXT,
        shutdown_window_end TEXT,
        current_status TEXT NOT NULL DEFAULT '待复核',
        current_conclusion TEXT,
        risk_level TEXT DEFAULT '中',
        reviewer TEXT,
        created_by TEXT NOT NULL DEFAULT '阿敏',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        remark TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS spare_parts (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        batch_no INTEGER NOT NULL DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 1,
        is_latest INTEGER NOT NULL DEFAULT 1,
        part_no TEXT,
        part_name TEXT NOT NULL,
        model_spec TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT,
        arrival_status TEXT NOT NULL DEFAULT '未到货',
        estimated_arrival TEXT,
        actual_arrival TEXT,
        source_line_no INTEGER,
        remark TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL DEFAULT '阿敏',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_spare_parts_report ON spare_parts(report_id, is_latest, is_deleted)`);

    db.run(`CREATE TABLE IF NOT EXISTS model_replacements (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        spare_part_id TEXT,
        original_model TEXT NOT NULL,
        new_model TEXT NOT NULL,
        affected_line_nos TEXT,
        affected_scope TEXT,
        replacement_reason TEXT,
        approved_by TEXT,
        created_by TEXT NOT NULL DEFAULT '阿敏',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_model_rep_report ON model_replacements(report_id)`);

    db.run(`CREATE TABLE IF NOT EXISTS review_audits (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        field_name TEXT,
        old_value TEXT,
        new_value TEXT,
        change_reason TEXT,
        operator TEXT NOT NULL DEFAULT '阿敏',
        operated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        batch_no INTEGER,
        remark TEXT
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_report ON review_audits(report_id, operated_at DESC)`);

    db.run(`CREATE TABLE IF NOT EXISTS conclusion_snapshots (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        conclusion TEXT NOT NULL,
        old_materials_snapshot TEXT,
        new_remark TEXT,
        change_reason TEXT,
        operator TEXT NOT NULL DEFAULT '阿敏',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL UNIQUE,
        report_id TEXT,
        export_type TEXT NOT NULL DEFAULT '复核说明',
        filter_conditions TEXT NOT NULL,
        export_by TEXT NOT NULL DEFAULT '阿敏',
        exported_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        remark TEXT
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_exports_trace ON exports(trace_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_exports_report ON exports(report_id)`);

    seedDemoData();
    saveDb();
    console.log('✅ 数据库初始化完成');
}

function saveDb() {
    const data = db.export();
    fs.writeFileSync(dbFile, Buffer.from(data));
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

function queryOne(sql, params = []) {
    const r = query(sql, params);
    return r.length ? r[0] : undefined;
}

function run(sql, params = []) {
    db.run(sql, params);
    saveDb();
}

function transaction(fn) {
    try {
        const result = fn();
        saveDb();
        return result;
    } catch (e) {
        console.error('Transaction error, attempted rollback:', e.message);
        saveDb();
        throw e;
    }
}

function seedDemoData() {
    const check = queryOne('SELECT COUNT(*) as cnt FROM reports');
    if (check && check.cnt > 0) return;

    const { v4: uuid } = require('uuid');
    const now = () => new Date().toISOString().replace('T', ' ').substring(0, 19);
    const ts = now();

    const report1Id = uuid();
    run(`INSERT INTO reports (id, report_no, project_name, shield_no, cutter_disc_no, shutdown_window_start, shutdown_window_end, current_status, current_conclusion, risk_level, reviewer, remark, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        report1Id, 'DP-FH-2026-001', 'XX地铁3号线盾构区间', 'S-087', '刀盘#033', '2026-06-15 08:00', '2026-06-17 20:00', '待复核', '初判：部分备件到货时间存疑，需补录', '高', '阿敏', '首次提交，滚刀型号需确认', ts, ts
    ]);

    const parts = [
        ['17寸滚刀', 'φ432×120 标准型', 16, '2026-06-14', '待确认'],
        ['中心滚刀', 'φ400×140 加强型', 8, '2026-06-13', '已到货'],
        ['刮刀', '320×120×60 硬质合金', 48, '2026-06-16', '待确认'],
        ['保径刀', 'φ450×100 耐磨型', 24, '2026-06-20', '到货晚于停机窗口']
    ];

    parts.forEach((p, i) => {
        run(`INSERT INTO spare_parts (id, report_id, batch_no, version, is_latest, part_name, model_spec, quantity, unit, arrival_status, estimated_arrival, source_line_no, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            uuid(), report1Id, 1, 1, 1, p[0], p[1], p[2], '把', p[4], p[3], i + 1, ts
        ]);
    });

    run(`INSERT INTO review_audits (id, report_id, action_type, field_name, old_value, new_value, change_reason, operator, operated_at) VALUES (?,?,?,?,?,?,?,?,?)`, [
        uuid(), report1Id, '创建报告', 'status', '无', '待复核', '项目首次提交刀盘复核报告', '阿敏', ts
    ]);

    const report2Id = uuid();
    run(`INSERT INTO reports (id, report_no, project_name, shield_no, cutter_disc_no, shutdown_window_start, shutdown_window_end, current_status, current_conclusion, risk_level, reviewer, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        report2Id, 'DP-FH-2026-002', 'XX地铁5号线盾构区间', 'S-102', '刀盘#041', '2026-06-20 00:00', '2026-06-22 23:59', '复核中', '已通过第一轮复核，等待备件最终确认', '中', '阿敏', ts, ts
    ]);

    [
        ['滚刀', 'φ432×120 耐磨型', 20, '2026-06-18', '未到货'],
        ['边刮刀', '300×100×50', 32, '2026-06-19', '未到货']
    ].forEach((p, i) => {
        run(`INSERT INTO spare_parts (id, report_id, batch_no, version, is_latest, part_name, model_spec, quantity, unit, arrival_status, estimated_arrival, source_line_no, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            uuid(), report2Id, 1, 1, 1, p[0], p[1], p[2], '把', p[4], p[3], i + 1, ts
        ]);
    });

    console.log('✅ 演示数据已初始化（2份报告，含6条备件+审计记录）');
}

module.exports = {
    init,
    query,
    queryOne,
    run,
    transaction,
    save: saveDb
};
