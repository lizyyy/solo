const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuid } = require('uuid');
const { init, query, queryOne, run, transaction } = require('./database');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_OPERATOR = '阿敏（维保主管）';

function writeAudit(reportId, actionType, fieldName, oldValue, newValue, reason, batchNo) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    run(`INSERT INTO review_audits (id, report_id, action_type, field_name, old_value, new_value, change_reason, operator, batch_no, operated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, [
        uuid(), reportId, actionType, fieldName,
        oldValue !== undefined && oldValue !== null ? String(oldValue).substring(0, 500) : null,
        newValue !== undefined && newValue !== null ? String(newValue).substring(0, 500) : null,
        reason || null,
        DEFAULT_OPERATOR,
        batchNo || null,
        now
    ]);
}

function updateReportTimestamp(reportId) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    run(`UPDATE reports SET updated_at = ? WHERE id = ?`, [now, reportId]);
}

// ============ 报告相关接口 ============

app.get('/api/reports', (req, res) => {
    const { status, keyword, risk_level } = req.query;
    let sql = `SELECT * FROM reports WHERE 1=1`;
    const params = [];
    if (status && status !== '全部') { sql += ` AND current_status = ?`; params.push(status); }
    if (risk_level && risk_level !== '全部') { sql += ` AND risk_level = ?`; params.push(risk_level); }
    if (keyword) {
        sql += ` AND (report_no LIKE ? OR project_name LIKE ? OR shield_no LIKE ?)`;
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw);
    }
    sql += ` ORDER BY updated_at DESC`;
    const rows = query(sql, params);
    res.json({ code: 0, data: rows });
});

app.get('/api/reports/:id', (req, res) => {
    const report = queryOne(`SELECT * FROM reports WHERE id = ?`, [req.params.id]);
    if (!report) return res.json({ code: 404, message: '报告不存在' });

    const parts = query(`SELECT * FROM spare_parts WHERE report_id = ? AND is_latest = 1 AND is_deleted = 0 ORDER BY source_line_no, id`, [req.params.id]);
    const replacements = query(`SELECT * FROM model_replacements WHERE report_id = ? ORDER BY created_at DESC`, [req.params.id]);
    const audits = query(`SELECT * FROM review_audits WHERE report_id = ? ORDER BY operated_at DESC`, [req.params.id]);
    const snapshots = query(`SELECT * FROM conclusion_snapshots WHERE report_id = ? ORDER BY version DESC`, [req.params.id]);

    res.json({ code: 0, data: { report, parts, replacements, audits, snapshots } });
});

app.post('/api/reports', (req, res) => {
    const { report_no, project_name, shield_no, cutter_disc_no, shutdown_window_start, shutdown_window_end, remark } = req.body;
    if (!report_no || !project_name || !shield_no) return res.json({ code: 400, message: '缺少必要字段' });

    const id = uuid();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    run(`INSERT INTO reports (id, report_no, project_name, shield_no, cutter_disc_no, shutdown_window_start, shutdown_window_end, current_status, current_conclusion, risk_level, reviewer, remark, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        id, report_no, project_name, shield_no, cutter_disc_no || '', shutdown_window_start || '', shutdown_window_end || '',
        '待复核', '新建报告，待录入备件清单', '中', DEFAULT_OPERATOR, remark || '', now, now
    ]);
    writeAudit(id, '创建报告', 'status', '无', '待复核', '新建刀盘复核报告');
    res.json({ code: 0, data: { id } });
});

// ============ 备件清单：分批次 + 版本化，绝不覆盖旧数据 ============

app.post('/api/reports/:id/parts', (req, res) => {
    const reportId = req.params.id;
    const report = queryOne(`SELECT * FROM reports WHERE id = ?`, [reportId]);
    if (!report) return res.json({ code: 404, message: '报告不存在' });

    const { parts, batchRemark, operator } = req.body;
    if (!Array.isArray(parts) || parts.length === 0) return res.json({ code: 400, message: '备件列表为空' });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const maxBatchRow = queryOne(`SELECT COALESCE(MAX(batch_no), 0) as mb FROM spare_parts WHERE report_id = ?`, [reportId]);
    const maxBatch = maxBatchRow ? maxBatchRow.mb : 0;
    const newBatchNo = maxBatch + 1;

    const newPartIds = [];
    const auditRecords = [];

    transaction(() => {
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (p.id && p._action === 'update') {
                const old = queryOne(`SELECT * FROM spare_parts WHERE id = ? AND is_latest = 1`, [p.id]);
                if (old) {
                    run(`UPDATE spare_parts SET is_latest = 0 WHERE id = ?`, [p.id]);
                    const newVersion = old.version + 1;
                    const newPartId = uuid();
                    run(`INSERT INTO spare_parts (id, report_id, batch_no, version, is_latest, part_no, part_name, model_spec, quantity, unit, arrival_status, estimated_arrival, actual_arrival, source_line_no, remark, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                        newPartId, reportId, old.batch_no, newVersion, 1,
                        p.part_no || old.part_no,
                        p.part_name || old.part_name,
                        p.model_spec || old.model_spec,
                        p.quantity ?? old.quantity,
                        p.unit || old.unit,
                        p.arrival_status || old.arrival_status,
                        p.estimated_arrival || old.estimated_arrival,
                        p.actual_arrival || old.actual_arrival,
                        p.source_line_no ?? old.source_line_no,
                        (p.remark || old.remark || '') + (batchRemark ? ` | [批次${newBatchNo}补录]${batchRemark}` : ''),
                        operator || DEFAULT_OPERATOR,
                        now
                    ]);
                    newPartIds.push(newPartId);
                    const fieldsChanged = [];
                    if (p.model_spec && p.model_spec !== old.model_spec) fieldsChanged.push(`规格:${old.model_spec}→${p.model_spec}`);
                    if (p.arrival_status && p.arrival_status !== old.arrival_status) fieldsChanged.push(`到货:${old.arrival_status}→${p.arrival_status}`);
                    if (p.quantity !== undefined && Number(p.quantity) !== Number(old.quantity)) fieldsChanged.push(`数量:${old.quantity}→${p.quantity}`);
                    if (fieldsChanged.length || batchRemark) {
                        auditRecords.push([reportId, '备件更新(版本化)', `备件[${old.part_name}]v${old.version}→v${newVersion}`,
                            JSON.stringify({ model: old.model_spec, status: old.arrival_status, qty: old.quantity }),
                            JSON.stringify({ model: p.model_spec || old.model_spec, status: p.arrival_status || old.arrival_status, qty: p.quantity ?? old.quantity }),
                            batchRemark || fieldsChanged.join('; '), newBatchNo]);
                    }
                }
            } else if (p._action !== 'delete') {
                const newPartId = uuid();
                run(`INSERT INTO spare_parts (id, report_id, batch_no, version, is_latest, part_no, part_name, model_spec, quantity, unit, arrival_status, estimated_arrival, actual_arrival, source_line_no, remark, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    newPartId, reportId, newBatchNo, 1, 1,
                    p.part_no || '', p.part_name || '', p.model_spec || '',
                    p.quantity ?? 1, p.unit || '把',
                    p.arrival_status || '待确认',
                    p.estimated_arrival || '', p.actual_arrival || '',
                    p.source_line_no ?? (i + 1),
                    p.remark || (batchRemark ? `[批次${newBatchNo}]${batchRemark}` : ''),
                    operator || DEFAULT_OPERATOR,
                    now
                ]);
                newPartIds.push(newPartId);
            } else if (p._action === 'delete' && p.id) {
                const old = queryOne(`SELECT * FROM spare_parts WHERE id = ?`, [p.id]);
                run(`UPDATE spare_parts SET is_deleted = 1, is_latest = 0 WHERE id = ?`, [p.id]);
                if (old) {
                    auditRecords.push([reportId, '备件删除(软删除)', `备件[${old.part_name}]`,
                        `存在(batch${old.batch_no}v${old.version})`, '已标记删除',
                        batchRemark || '备件不再需要，移除记录', newBatchNo]);
                }
            }
        }

        auditRecords.forEach(a => writeAudit(...a));

        writeAudit(reportId, '备件批次补录', 'batch', String(maxBatch), String(newBatchNo),
            batchRemark || `补录第${newBatchNo}批次备件，共${parts.length}条(含${newPartIds.length}条新增/更新)`,
            newBatchNo);

        updateReportTimestamp(reportId);
    });

    res.json({ code: 0, data: { batch_no: newBatchNo, new_ids: newPartIds, message: `第${newBatchNo}批次备件已录入，历史版本未覆盖` } });
});

app.get('/api/reports/:id/parts-history', (req, res) => {
    const rows = query(`SELECT * FROM spare_parts WHERE report_id = ? AND is_deleted = 0 ORDER BY batch_no, version, created_at`, [req.params.id]);
    res.json({ code: 0, data: rows });
});

// ============ 改判接口：每次改判留审计 + 结论快照 ============

app.post('/api/reports/:id/review', (req, res) => {
    const reportId = req.params.id;
    const report = queryOne(`SELECT * FROM reports WHERE id = ?`, [reportId]);
    if (!report) return res.json({ code: 404, message: '报告不存在' });

    const { new_status, new_conclusion, change_reason, risk_level, operator } = req.body;
    if (!new_status || !new_conclusion || !change_reason) {
        return res.json({ code: 400, message: '新状态、新结论、改判原因三项必填' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let snapshotVersion;

    transaction(() => {
        const oldStatus = report.current_status;
        const oldConclusion = report.current_conclusion;
        const oldRisk = report.risk_level;
        const finalRisk = risk_level || oldRisk;

        if (finalRisk !== oldRisk) {
            writeAudit(reportId, '风险等级变更', 'risk_level', oldRisk, finalRisk, change_reason);
        }
        if (oldStatus !== new_status) {
            writeAudit(reportId, '复核状态改判', 'current_status', oldStatus, new_status, change_reason);
        }
        if (oldConclusion !== new_conclusion) {
            writeAudit(reportId, '复核结论修改', 'current_conclusion', oldConclusion, new_conclusion, change_reason);
        }

        const vRow = queryOne(`SELECT COALESCE(MAX(version), 0) + 1 as v FROM conclusion_snapshots WHERE report_id = ?`, [reportId]);
        snapshotVersion = vRow ? vRow.v : 1;
        const oldParts = query(`SELECT part_name, model_spec, quantity, arrival_status, estimated_arrival FROM spare_parts WHERE report_id = ? AND is_latest = 1 AND is_deleted = 0`, [reportId]);

        run(`INSERT INTO conclusion_snapshots (id, report_id, version, conclusion, old_materials_snapshot, new_remark, change_reason, operator, created_at) VALUES (?,?,?,?,?,?,?,?,?)`, [
            uuid(), reportId, snapshotVersion,
            new_conclusion,
            JSON.stringify(oldParts, null, 0),
            `v${snapshotVersion}: ${new_conclusion}`,
            change_reason,
            operator || DEFAULT_OPERATOR,
            now
        ]);

        run(`UPDATE reports SET current_status = ?, current_conclusion = ?, risk_level = ?, reviewer = ?, updated_at = ? WHERE id = ?`, [
            new_status, new_conclusion, finalRisk, operator || DEFAULT_OPERATOR, now, reportId
        ]);
    });

    res.json({ code: 0, data: { snapshotVersion, old_status: report.current_status, new_status, message: `改判已记录，生成结论快照v${snapshotVersion}` } });
});

// ============ 型号替换：记录影响范围 + 来源行 ============

app.post('/api/reports/:id/model-replace', (req, res) => {
    const reportId = req.params.id;
    const report = queryOne(`SELECT * FROM reports WHERE id = ?`, [reportId]);
    if (!report) return res.json({ code: 404, message: '报告不存在' });

    const { spare_part_id, original_model, new_model, affected_line_nos, affected_scope, replacement_reason, approved_by } = req.body;
    if (!original_model || !new_model) return res.json({ code: 400, message: '原型号和新型号必填' });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = uuid();
    const lineNosStr = Array.isArray(affected_line_nos) ? affected_line_nos.join(',') : (affected_line_nos || '');

    transaction(() => {
        run(`INSERT INTO model_replacements (id, report_id, spare_part_id, original_model, new_model, affected_line_nos, affected_scope, replacement_reason, approved_by, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
            id, reportId, spare_part_id || null, original_model, new_model,
            lineNosStr,
            affected_scope || '待评估',
            replacement_reason || '原型号停产/缺货，经确认替换',
            approved_by || DEFAULT_OPERATOR,
            DEFAULT_OPERATOR, now
        ]);

        writeAudit(reportId, '型号替换记录',
            lineNosStr ? `来源行号:${lineNosStr}` : '型号',
            original_model, new_model,
            replacement_reason || `影响范围:${affected_scope || '待评估'}`
        );

        if (spare_part_id) {
            const old = queryOne(`SELECT * FROM spare_parts WHERE id = ? AND is_latest = 1`, [spare_part_id]);
            if (old && old.model_spec !== new_model) {
                run(`UPDATE spare_parts SET is_latest = 0 WHERE id = ?`, [spare_part_id]);
                run(`INSERT INTO spare_parts (id, report_id, batch_no, version, is_latest, part_no, part_name, model_spec, quantity, unit, arrival_status, estimated_arrival, actual_arrival, source_line_no, remark, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    uuid(), reportId, old.batch_no, old.version + 1, 1,
                    old.part_no, old.part_name, new_model, old.quantity, old.unit,
                    old.arrival_status, old.estimated_arrival, old.actual_arrival,
                    old.source_line_no,
                    (old.remark || '') + ` | [型号替换]${original_model}→${new_model} 原因:${replacement_reason || '见替换记录'}`,
                    approved_by || DEFAULT_OPERATOR, now
                ]);
            }
        }
        updateReportTimestamp(reportId);
    });

    res.json({ code: 0, data: { id, message: '型号替换已记录，影响范围和来源行号已留存' } });
});

// ============ 导出 + 筛选追溯 ============

app.post('/api/exports', (req, res) => {
    const { report_id, filter_conditions, export_type, remark } = req.body;
    const traceId = 'EXP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = uuid();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    run(`INSERT INTO exports (id, trace_id, report_id, export_type, filter_conditions, export_by, remark, exported_at) VALUES (?,?,?,?,?,?,?,?)`, [
        id, traceId, report_id || null, export_type || '复核说明',
        typeof filter_conditions === 'string' ? filter_conditions : JSON.stringify(filter_conditions || {}),
        DEFAULT_OPERATOR,
        remark || '',
        now
    ]);
    res.json({ code: 0, data: { trace_id: traceId, message: `导出记录已保存，追溯号:${traceId}` } });
});

app.get('/api/exports/:traceId', (req, res) => {
    const row = queryOne(`SELECT * FROM exports WHERE trace_id = ?`, [req.params.traceId]);
    if (!row) return res.json({ code: 404, message: '追溯号不存在' });
    try { row.filter_conditions = JSON.parse(row.filter_conditions); } catch (e) {}
    res.json({ code: 0, data: row });
});

app.get('/api/exports', (req, res) => {
    const rows = query(`SELECT * FROM exports ORDER BY exported_at DESC LIMIT 100`);
    rows.forEach(r => { try { r.filter_conditions = JSON.parse(r.filter_conditions); } catch (e) {} });
    res.json({ code: 0, data: rows });
});

// ============ 审计查询 ============

app.get('/api/reports/:id/audits', (req, res) => {
    const rows = query(`SELECT * FROM review_audits WHERE report_id = ? ORDER BY operated_at DESC`, [req.params.id]);
    res.json({ code: 0, data: rows });
});

app.get('/api/health', (req, res) => res.json({ code: 0, message: '盾构刀盘报告复核系统后端运行正常', time: new Date().toLocaleString('zh-CN') }));

const PORT = process.env.PORT || 3001;

(async function start() {
    try {
        await init();
        app.listen(PORT, () => {
            console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
            console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
        });
    } catch (e) {
        console.error('❌ 启动失败:', e);
        process.exit(1);
    }
})();
