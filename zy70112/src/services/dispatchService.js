const { getDb } = require('../db/database');
const { generateId, formatDate } = require('../utils/generators');

const dispatchService = {
    createDispatch(reportId, data, operator) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        if (report.status !== 'SUBMITTED') {
            throw new Error('只有已提交状态可以派工');
        }

        const now = formatDate();
        const dispatch = {
            id: generateId(),
            report_id: reportId,
            inspector_id: data.inspector_id,
            inspector_name: data.inspector_name,
            dispatch_time: now,
            scheduled_time: data.scheduled_time || null,
            actual_time: null,
            status: 'PENDING',
            notes: data.notes || '',
            created_at: now
        };

        db.prepare(`
            INSERT INTO dispatches (
                id, report_id, inspector_id, inspector_name, dispatch_time, 
                scheduled_time, actual_time, status, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(dispatch.id, dispatch.report_id, dispatch.inspector_id, dispatch.inspector_name, dispatch.dispatch_time, dispatch.scheduled_time, dispatch.actual_time, dispatch.status, dispatch.notes, dispatch.created_at);

        return dispatch;
    },

    getDispatchesByReportId(reportId) {
        const db = getDb();
        return db.prepare('SELECT * FROM dispatches WHERE report_id = ? ORDER BY created_at').all(reportId);
    },

    updateDispatch(dispatchId, updates) {
        const db = getDb();
        const dispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(dispatchId);
        
        if (!dispatch) {
            throw new Error('派工记录不存在');
        }
        
        const now = formatDate();
        
        const fields = [];
        const values = [];
        
        if (updates.scheduled_time !== undefined) {
            fields.push('scheduled_time = ?');
            values.push(updates.scheduled_time);
        }
        if (updates.actual_time !== undefined) {
            fields.push('actual_time = ?');
            values.push(updates.actual_time);
        }
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.notes !== undefined) {
            fields.push('notes = ?');
            values.push(updates.notes);
        }
        
        if (fields.length === 0) {
            return dispatch;
        }
        
        values.push(dispatchId);
        
        const sql = `UPDATE dispatches SET ${fields.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);
        
        return db.prepare('SELECT * FROM dispatches WHERE id = ?').get(dispatchId);
    }
};

module.exports = dispatchService;
