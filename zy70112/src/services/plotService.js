const { getDb } = require('../db/database');
const { generateId, formatDate } = require('../utils/generators');

const plotService = {
    addPlot(reportId, data) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        if (report.status !== 'DRAFT') {
            throw new Error('只有草稿状态可以添加地块');
        }

        const now = formatDate();
        const polygonGeojson = typeof data.polygon_geojson === 'string' 
            ? data.polygon_geojson 
            : JSON.stringify(data.polygon_geojson);
        
        const plot = {
            id: generateId(),
            report_id: reportId,
            plot_name: data.plot_name,
            polygon_geojson: polygonGeojson,
            area_sqm: data.area_sqm,
            created_at: now
        };

        db.prepare(`
            INSERT INTO plots (id, report_id, plot_name, polygon_geojson, area_sqm, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(plot.id, plot.report_id, plot.plot_name, plot.polygon_geojson, plot.area_sqm, plot.created_at);

        return plot;
    },

    getPlotsByReportId(reportId) {
        const db = getDb();
        return db.prepare('SELECT * FROM plots WHERE report_id = ?').all(reportId);
    },

    deletePlot(plotId) {
        const db = getDb();
        const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
        
        if (!plot) {
            throw new Error('地块不存在');
        }
        
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(plot.report_id);
        
        if (report.status !== 'DRAFT') {
            throw new Error('只有草稿状态可以删除地块');
        }
        
        db.prepare('DELETE FROM plots WHERE id = ?').run(plotId);
        
        return true;
    }
};

module.exports = plotService;
