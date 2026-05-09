const { Parser } = require('json2csv');
const LogService = require('./logService');
const AuditLogger = require('../utils/auditLogger');

class ReportService {
    static async generateLogReport(filters = {}, auditContext = {}) {
        const logs = await LogService.getLogs({ ...filters, limit: 10000 });
        const stats = await LogService.getLogStats(filters);

        await AuditLogger.log('GENERATE_REPORT', {
            ...auditContext,
            entityType: 'report',
            newValue: {
                filters,
                logCount: logs.length,
                stats
            }
        });

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                totalLogs: stats.total,
                byLevel: stats.byLevel,
                filters
            },
            logs: logs.map(log => ({
                id: log.id,
                level: log.level,
                source_type: log.source_type,
                message: log.message,
                timestamp: new Date(log.timestamp).toISOString(),
                status: log.status
            }))
        };
    }

    static async generateCSVReport(filters = {}, auditContext = {}) {
        const report = await this.generateLogReport(filters, auditContext);

        const fields = [
            'ID',
            '级别',
            '来源',
            '消息',
            '时间',
            '状态'
        ];

        const data = report.logs.map(log => ({
            'ID': log.id,
            '级别': log.level,
            '来源': log.source_type,
            '消息': log.message,
            '时间': log.timestamp,
            '状态': log.status
        }));

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        return {
            contentType: 'text/csv; charset=utf-8',
            fileName: `log_report_${Date.now()}.csv`,
            content: '\uFEFF' + csv
        };
    }

    static async generateAuditReport(filters = {}, auditContext = {}) {
        const auditLogs = await AuditLogger.getAuditLogs({
            ...filters,
            limit: 5000
        });

        await AuditLogger.log('GENERATE_AUDIT_REPORT', {
            ...auditContext,
            entityType: 'audit_report',
            newValue: {
                filters,
                logCount: auditLogs.length
            }
        });

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                totalRecords: auditLogs.length,
                filters
            },
            records: auditLogs.map(log => ({
                id: log.id,
                action: log.action,
                entityType: log.entity_type,
                entityId: log.entity_id,
                timestamp: new Date(log.timestamp).toISOString(),
                status: log.status
            }))
        };
    }

    static async generateStatisticsReport(filters = {}, auditContext = {}) {
        const logs = await LogService.getLogs({ ...filters, limit: 10000 });
        
        const stats = {
            total: logs.length,
            byLevel: {},
            bySource: {},
            byStatus: {},
            timeline: {}
        };

        logs.forEach(log => {
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            stats.bySource[log.source_type] = (stats.bySource[log.source_type] || 0) + 1;
            stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;

            const hour = new Date(log.timestamp).toISOString().slice(0, 13);
            stats.timeline[hour] = (stats.timeline[hour] || 0) + 1;
        });

        await AuditLogger.log('GENERATE_STATS_REPORT', {
            ...auditContext,
            entityType: 'statistics_report',
            newValue: {
                filters,
                stats: { total: stats.total }
            }
        });

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                totalLogs: stats.total,
                filters
            },
            statistics: stats
        };
    }
}

module.exports = ReportService;
