const { getDb } = require('../db/database');
const { generateId, formatDate } = require('../utils/generators');

const weatherService = {
    addWeatherEvidence(reportId, data) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        if (report.status !== 'DRAFT') {
            throw new Error('只有草稿状态可以添加天气证据');
        }

        const now = formatDate();
        const evidence = {
            id: generateId(),
            report_id: reportId,
            weather_type: data.weather_type,
            occurred_time: data.occurred_time,
            intensity: data.intensity,
            source: data.source,
            raw_data: data.raw_data || '',
            created_at: now
        };

        db.prepare(`
            INSERT INTO weather_evidences (
                id, report_id, weather_type, occurred_time, intensity, source, raw_data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(evidence.id, evidence.report_id, evidence.weather_type, evidence.occurred_time, evidence.intensity, evidence.source, evidence.raw_data, evidence.created_at);

        return evidence;
    },

    getWeatherByReportId(reportId) {
        const db = getDb();
        return db.prepare('SELECT * FROM weather_evidences WHERE report_id = ?').all(reportId);
    },

    deleteWeatherEvidence(evidenceId) {
        const db = getDb();
        const evidence = db.prepare('SELECT * FROM weather_evidences WHERE id = ?').get(evidenceId);
        
        if (!evidence) {
            throw new Error('天气证据不存在');
        }
        
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(evidence.report_id);
        
        if (report.status !== 'DRAFT') {
            throw new Error('只有草稿状态可以删除天气证据');
        }
        
        db.prepare('DELETE FROM weather_evidences WHERE id = ?').run(evidenceId);
        
        return true;
    }
};

module.exports = weatherService;
