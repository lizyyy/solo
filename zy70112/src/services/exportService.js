const { getDb } = require('../db/database');
const reportService = require('./reportService');

const exportService = {
    exportReportsForReview(filters = {}) {
        const db = getDb();
        
        const reports = reportService.listReports(filters);
        
        const exportData = reports.map(report => {
            const fullReport = reportService.getReportById(report.id);
            
            const plots = fullReport.plots.map(p => ({
                plot_name: p.plot_name,
                area_sqm: p.area_sqm
            }));
            
            const weather = fullReport.weather_evidences.map(w => ({
                weather_type: w.weather_type,
                intensity: w.intensity,
                occurred_time: w.occurred_time
            }));
            
            const photos = fullReport.photos.map(p => ({
                photo_type: p.photo_type,
                version: p.version,
                upload_time: p.upload_time,
                uploader: p.uploader
            }));
            
            const latestDispatch = fullReport.dispatches.length > 0 
                ? fullReport.dispatches[fullReport.dispatches.length - 1] 
                : null;
            
            const latestClaim = fullReport.claims.length > 0 
                ? fullReport.claims[fullReport.claims.length - 1] 
                : null;
            
            const statusHistory = fullReport.status_logs.map(log => ({
                from: log.from_status || '(无)',
                to: log.to_status,
                operator: log.operator,
                reason: log.reason,
                time: log.timestamp
            }));
            
            return {
                报案编号: report.report_no,
                农户姓名: fullReport.farmer_name,
                农户身份证: fullReport.farmer_id,
                联系电话: fullReport.phone,
                保单号: fullReport.insurance_policy_no,
                作物类型: fullReport.crop_type,
                灾害类型: fullReport.disaster_type,
                灾害发生时间: fullReport.disaster_time,
                当前状态: fullReport.status,
                地块信息: JSON.stringify(plots),
                地块数量: fullReport.summary.plot_count,
                天气证据: JSON.stringify(weather),
                天气证据数量: fullReport.summary.weather_count,
                照片信息: JSON.stringify(photos),
                照片数量: fullReport.summary.photo_count,
                查勘员: latestDispatch ? latestDispatch.inspector_name : '',
                查勘状态: latestDispatch ? latestDispatch.status : '',
                查勘时间: latestDispatch ? latestDispatch.actual_time : '',
                估算赔付金额: latestClaim ? latestClaim.estimated_amount : '',
                实际赔付金额: latestClaim ? latestClaim.actual_amount : '',
                受损面积: latestClaim ? latestClaim.affected_area_sqm : '',
                受损比例: latestClaim ? latestClaim.damage_ratio : '',
                状态变更历史: JSON.stringify(statusHistory),
                创建时间: fullReport.created_at,
                最后更新时间: fullReport.updated_at
            };
        });
        
        return exportData;
    },

    exportSummary(filters = {}) {
        const db = getDb();
        
        let sql = `
            SELECT 
                status,
                COUNT(*) as count
            FROM reports 
            WHERE 1=1
        `;
        const params = [];
        
        if (filters.crop_type) {
            sql += ' AND crop_type = ?';
            params.push(filters.crop_type);
        }
        
        if (filters.disaster_type) {
            sql += ' AND disaster_type = ?';
            params.push(filters.disaster_type);
        }
        
        sql += ' GROUP BY status';
        
        const statusCounts = db.prepare(sql).all(...params);
        
        let claimSql = `
            SELECT 
                SUM(estimated_amount) as total_estimated,
                SUM(actual_amount) as total_actual,
                COUNT(*) as claim_count
            FROM claims
            WHERE status = 'APPROVED'
        `;
        
        const claimSummary = db.prepare(claimSql).get();
        
        const summary = {
            按状态统计: statusCounts.map(s => ({
                状态: s.status,
                数量: s.count
            })),
            赔付汇总: {
                赔付数量: claimSummary.claim_count || 0,
                估算总金额: claimSummary.total_estimated || 0,
                实际总金额: claimSummary.total_actual || 0
            }
        };
        
        return summary;
    }
};

module.exports = exportService;
