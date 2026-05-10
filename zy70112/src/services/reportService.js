const { getDb } = require('../db/database');
const { generateReportNo, generateId, formatDate } = require('../utils/generators');
const businessRules = require('../utils/rules');

const reportService = {
    createReport(data, operator) {
        const db = getDb();
        
        if (!businessRules.validateCropType(data.crop_type)) {
            throw new Error(`无效的作物类型: ${data.crop_type}`);
        }
        
        if (!businessRules.validateDisasterType(data.disaster_type)) {
            throw new Error(`无效的灾害类型: ${data.disaster_type}`);
        }

        const now = formatDate();
        const report = {
            id: generateId(),
            report_no: generateReportNo(),
            farmer_name: data.farmer_name,
            farmer_id: data.farmer_id,
            phone: data.phone,
            insurance_policy_no: data.insurance_policy_no,
            crop_type: data.crop_type,
            disaster_type: data.disaster_type,
            disaster_time: data.disaster_time,
            description: data.description || '',
            status: 'DRAFT',
            created_at: now,
            updated_at: now
        };

        db.prepare(`
            INSERT INTO reports (
                id, report_no, farmer_name, farmer_id, phone, 
                insurance_policy_no, crop_type, disaster_type, disaster_time,
                description, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            report.id, report.report_no, report.farmer_name, report.farmer_id,
            report.phone, report.insurance_policy_no, report.crop_type, report.disaster_type,
            report.disaster_time, report.description, report.status, report.created_at, report.updated_at
        );

        this.logStatusChange(report.id, null, 'DRAFT', operator || 'system', '创建报案草稿');

        return report;
    },

    logStatusChange(reportId, fromStatus, toStatus, operator, reason) {
        const db = getDb();
        const log = {
            id: generateId(),
            report_id: reportId,
            from_status: fromStatus,
            to_status: toStatus,
            operator: operator,
            reason: reason,
            timestamp: formatDate()
        };
        
        db.prepare(`
            INSERT INTO status_logs (id, report_id, from_status, to_status, operator, reason, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(log.id, log.report_id, log.from_status, log.to_status, log.operator, log.reason, log.timestamp);
        
        return log;
    },

    getReportById(id) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
        if (!report) {
            return null;
        }
        return this.enrichReport(report);
    },

    getReportByNo(reportNo) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE report_no = ?').get(reportNo);
        if (!report) {
            return null;
        }
        return this.enrichReport(report);
    },

    enrichReport(report) {
        const db = getDb();
        
        const plots = db.prepare('SELECT * FROM plots WHERE report_id = ?').all(report.id);
        const weather = db.prepare('SELECT * FROM weather_evidences WHERE report_id = ?').all(report.id);
        const photos = db.prepare('SELECT * FROM photo_versions WHERE report_id = ? ORDER BY photo_type, version').all(report.id);
        const dispatches = db.prepare('SELECT * FROM dispatches WHERE report_id = ?').all(report.id);
        const claims = db.prepare('SELECT * FROM claims WHERE report_id = ?').all(report.id);
        const statusLogs = db.prepare('SELECT * FROM status_logs WHERE report_id = ? ORDER BY timestamp').all(report.id);

        const activePhotos = photos.filter(p => p.is_active === 1);
        const plotCount = plots.length;
        const weatherCount = weather.length;
        const photoCount = activePhotos.length;
        
        const latestDispatch = dispatches.length > 0 ? dispatches[dispatches.length - 1] : null;
        const latestClaim = claims.length > 0 ? claims[claims.length - 1] : null;

        return {
            ...report,
            plots,
            weather_evidences: weather,
            photos: activePhotos,
            all_photos: photos,
            dispatches,
            claims,
            status_logs: statusLogs,
            summary: {
                plot_count: plotCount,
                weather_count: weatherCount,
                photo_count: photoCount,
                latest_dispatch_status: latestDispatch ? latestDispatch.status : null,
                latest_claim_status: latestClaim ? latestClaim.status : null,
                estimated_amount: latestClaim ? latestClaim.estimated_amount : null
            }
        };
    },

    listReports(filters = {}) {
        const db = getDb();
        
        let sql = 'SELECT * FROM reports WHERE 1=1';
        const params = [];
        
        if (filters.status) {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        
        if (filters.farmer_name) {
            sql += ' AND farmer_name LIKE ?';
            params.push(`%${filters.farmer_name}%`);
        }
        
        if (filters.crop_type) {
            sql += ' AND crop_type = ?';
            params.push(filters.crop_type);
        }
        
        if (filters.disaster_type) {
            sql += ' AND disaster_type = ?';
            params.push(filters.disaster_type);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const reports = db.prepare(sql).all(...params);
        
        return reports.map(report => {
            const enriched = this.enrichReport(report);
            return {
                id: enriched.id,
                report_no: enriched.report_no,
                farmer_name: enriched.farmer_name,
                phone: enriched.phone,
                crop_type: enriched.crop_type,
                disaster_type: enriched.disaster_type,
                status: enriched.status,
                created_at: enriched.created_at,
                summary: enriched.summary
            };
        });
    },

    transitionStatus(reportId, toStatus, operator, reason) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        if (!businessRules.canTransition(report.status, toStatus)) {
            throw new Error(`无法从 ${report.status} 转换到 ${toStatus}`);
        }
        
        const now = formatDate();
        
        db.prepare(`
            UPDATE reports SET status = ?, updated_at = ? WHERE id = ?
        `).run(toStatus, now, reportId);
        
        this.logStatusChange(reportId, report.status, toStatus, operator, reason);
        
        return this.getReportById(reportId);
    },

    updateReport(reportId, updates) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        if (report.status !== 'DRAFT') {
            throw new Error('只有草稿状态可以修改基本信息');
        }
        
        const now = formatDate();
        
        const fields = [];
        const values = [];
        
        if (updates.farmer_name !== undefined) {
            fields.push('farmer_name = ?');
            values.push(updates.farmer_name);
        }
        if (updates.farmer_id !== undefined) {
            fields.push('farmer_id = ?');
            values.push(updates.farmer_id);
        }
        if (updates.phone !== undefined) {
            fields.push('phone = ?');
            values.push(updates.phone);
        }
        if (updates.insurance_policy_no !== undefined) {
            fields.push('insurance_policy_no = ?');
            values.push(updates.insurance_policy_no);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.disaster_time !== undefined) {
            fields.push('disaster_time = ?');
            values.push(updates.disaster_time);
        }
        
        if (fields.length === 0) {
            return this.getReportById(reportId);
        }
        
        fields.push('updated_at = ?');
        values.push(now);
        values.push(reportId);
        
        const sql = `UPDATE reports SET ${fields.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);
        
        return this.getReportById(reportId);
    }
};

module.exports = reportService;
