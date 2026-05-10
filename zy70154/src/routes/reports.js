const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const db = require('../config/database');
const rules = require('../rules/businessRules');

const router = express.Router();

router.get('/impact-analysis', async (req, res, next) => {
    try {
        const { upstream_service_id, notice_id, include_snapshot } = req.query;
        
        let impactData;
        
        if (notice_id) {
            const noticeResult = await db.query(`
                SELECT cn.*, s.service_name as upstream_service_name
                FROM change_notices cn
                JOIN services s ON cn.upstream_service_id = s.service_id
                WHERE cn.notice_id = $1
            `, [notice_id]);
            
            if (noticeResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Notice not found'
                });
            }
            
            const notice = noticeResult.rows[0];
            
            const subscriptionsResult = await db.query(`
                SELECT sc.*, 
                       s.service_name as downstream_service_name,
                       s.service_owner,
                       s.owner_email,
                       d.dependency_strength,
                       d.dependency_type
                FROM subscription_confirmations sc
                JOIN services s ON sc.downstream_service_id = s.service_id
                LEFT JOIN service_dependencies d ON 
                    d.upstream_service_id = $1 AND 
                    d.downstream_service_id = sc.downstream_service_id
                WHERE sc.notice_id = $2
                ORDER BY d.dependency_strength DESC, sc.subscription_date DESC
            `, [notice.upstream_service_id, notice_id]);
            
            const subsWithDeadlines = subscriptionsResult.rows.map(sub => {
                const deadlineCalc = rules.calculateDeadlines({ 
                    notice, 
                    confirmationDate: sub.confirmation_date 
                });
                return {
                    ...sub,
                    deadline_info: deadlineCalc.decision
                };
            });
            
            const statusBreakdown = subsWithDeadlines.reduce((acc, sub) => {
                acc[sub.subscription_status] = (acc[sub.subscription_status] || 0) + 1;
                return acc;
            }, {});
            
            const deadlineBreakdown = subsWithDeadlines.reduce((acc, sub) => {
                const status = sub.deadline_info?.deadlineStatus || 'UNKNOWN';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});
            
            const criticalDownstreams = subsWithDeadlines.filter(sub => 
                sub.dependency_strength === 'CRITICAL'
            );
            
            impactData = {
                notice: {
                    notice_id: notice.notice_id,
                    upstream_service_id: notice.upstream_service_id,
                    upstream_service_name: notice.upstream_service_name,
                    change_type: notice.change_type,
                    change_title: notice.change_title,
                    old_version: notice.old_version,
                    new_version: notice.new_version,
                    is_breaking_change: notice.is_breaking_change,
                    change_date: notice.change_date
                },
                total_downstreams: subsWithDeadlines.length,
                status_breakdown: statusBreakdown,
                deadline_breakdown: deadlineBreakdown,
                critical_downstreams: {
                    count: criticalDownstreams.length,
                    items: criticalDownstreams.map(d => ({
                        service_id: d.downstream_service_id,
                        service_name: d.downstream_service_name,
                        owner: d.service_owner,
                        email: d.owner_email,
                        status: d.subscription_status,
                        deadline_status: d.deadline_info?.deadlineStatus
                    }))
                },
                pending_confirmations: subsWithDeadlines
                    .filter(s => ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(s.subscription_status))
                    .map(s => ({
                        service_id: s.downstream_service_id,
                        service_name: s.downstream_service_name,
                        owner: s.service_owner,
                        status: s.subscription_status,
                        deadline_status: s.deadline_info?.deadlineStatus,
                        days_until_deadline: s.deadline_info?.daysUntilCompatibilityEnd
                    }))
            };
        } else if (upstream_service_id) {
            const noticesResult = await db.query(`
                SELECT * FROM change_notices 
                WHERE upstream_service_id = $1 AND notice_status = 'PUBLISHED'
                ORDER BY change_date DESC
            `, [upstream_service_id]);
            
            const serviceResult = await db.query(
                'SELECT * FROM services WHERE service_id = $1',
                [upstream_service_id]
            );
            
            const allStats = [];
            for (const notice of noticesResult.rows) {
                const subsResult = await db.query(`
                    SELECT subscription_status, COUNT(*) as count
                    FROM subscription_confirmations
                    WHERE notice_id = $1
                    GROUP BY subscription_status
                `, [notice.notice_id]);
                
                const statusCounts = subsResult.rows.reduce((acc, r) => {
                    acc[r.subscription_status] = parseInt(r.count);
                    return acc;
                }, {});
                
                const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
                const completed = (statusCounts['COMPLETED'] || 0) + (statusCounts['NO_ACTION_NEEDED'] || 0);
                const pending = total - completed;
                
                allStats.push({
                    notice_id: notice.notice_id,
                    change_type: notice.change_type,
                    change_title: notice.change_title,
                    new_version: notice.new_version,
                    change_date: notice.change_date,
                    total_downstreams: total,
                    completed_count: completed,
                    pending_count: pending,
                    completion_rate: total > 0 ? (completed / total * 100).toFixed(1) : 0,
                    status_breakdown: statusCounts
                });
            }
            
            impactData = {
                service: serviceResult.rows[0],
                published_notices: allStats.length,
                notices: allStats
            };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Either upstream_service_id or notice_id is required'
            });
        }
        
        let snapshotId = null;
        if (include_snapshot === 'true') {
            snapshotId = uuidv4();
            await db.query(`
                INSERT INTO report_snapshots 
                (snapshot_id, report_type, report_parameters, report_summary, report_details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                snapshotId,
                'IMPACT_ANALYSIS',
                JSON.stringify({ upstream_service_id, notice_id }),
                JSON.stringify({ 
                    total_downstreams: impactData.total_downstreams || impactData.published_notices 
                }),
                JSON.stringify(impactData)
            ]);
        }
        
        res.json({
            success: true,
            data: {
                ...impactData,
                snapshot_id: snapshotId
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/compatibility-status', async (req, res, next) => {
    try {
        const { service_id, days_threshold } = req.query;
        const threshold = parseInt(days_threshold) || 30;
        
        let query = `
            SELECT 
                cn.notice_id,
                cn.change_title,
                cn.change_type,
                cn.new_version,
                cn.old_version,
                cn.is_breaking_change,
                cn.change_date,
                cn.compatibility_start_date,
                cn.compatibility_end_date,
                cn.rollback_window_end_date,
                cn.notice_status,
                us.service_id as upstream_service_id,
                us.service_name as upstream_service_name,
                sc.confirmation_id,
                sc.downstream_service_id,
                ds.service_name as downstream_service_name,
                sc.subscription_status,
                sc.confirmation_date,
                sc.actual_completion_date
            FROM change_notices cn
            JOIN services us ON cn.upstream_service_id = us.service_id
            LEFT JOIN subscription_confirmations sc ON cn.notice_id = sc.notice_id
            LEFT JOIN services ds ON sc.downstream_service_id = ds.service_id
            WHERE cn.notice_status = 'PUBLISHED'
        `;
        const params = [];
        
        if (service_id) {
            query += ` AND (us.service_id = $1 OR ds.service_id = $1)`;
            params.push(service_id);
        }
        
        const result = await db.query(query, params);
        
        const now = new Date();
        const items = result.rows.map(row => {
            const compatEnd = new Date(row.compatibility_end_date);
            const rollbackEnd = new Date(row.rollback_window_end_date);
            
            const daysUntilCompatEnd = Math.ceil((compatEnd - now) / (1000 * 60 * 60 * 24));
            const daysUntilRollbackEnd = Math.ceil((rollbackEnd - now) / (1000 * 60 * 60 * 24));
            
            let status = 'ONGOING';
            if (now > rollbackEnd) status = 'EXPIRED';
            else if (now > compatEnd) status = 'ROLLBACK_ONLY';
            else if (daysUntilCompatEnd <= 7) status = 'URGENT';
            else if (daysUntilCompatEnd <= threshold) status = 'APPROACHING';
            
            return {
                notice_id: row.notice_id,
                upstream_service_id: row.upstream_service_id,
                upstream_service_name: row.upstream_service_name,
                downstream_service_id: row.downstream_service_id,
                downstream_service_name: row.downstream_service_name,
                change_type: row.change_type,
                change_title: row.change_title,
                new_version: row.new_version,
                old_version: row.old_version,
                is_breaking_change: row.is_breaking_change,
                change_date: row.change_date,
                compatibility_end_date: row.compatibility_end_date,
                rollback_window_end_date: row.rollback_window_end_date,
                subscription_status: row.subscription_status,
                compatibility_status: status,
                days_until_compatibility_end: Math.max(0, daysUntilCompatEnd),
                days_until_rollback_end: Math.max(0, daysUntilRollbackEnd)
            };
        });
        
        const activeItems = items.filter(i => i.compatibility_status !== 'EXPIRED');
        const urgentItems = activeItems.filter(i => i.compatibility_status === 'URGENT');
        const upcomingItems = activeItems.filter(i => i.compatibility_status === 'APPROACHING');
        
        const byStatus = items.reduce((acc, item) => {
            acc[item.compatibility_status] = (acc[item.compatibility_status] || 0) + 1;
            return acc;
        }, {});
        
        const bySubscription = items.reduce((acc, item) => {
            if (item.subscription_status) {
                acc[item.subscription_status] = (acc[item.subscription_status] || 0) + 1;
            }
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: {
                items,
                summary: {
                    total: items.length,
                    active: activeItems.length,
                    urgent: urgentItems.length,
                    upcoming: upcomingItems.length,
                    by_compatibility_status: byStatus,
                    by_subscription_status: bySubscription
                },
                filters: {
                    service_id: service_id || null,
                    days_threshold: threshold
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/change-report', async (req, res, next) => {
    try {
        const { from_date, to_date, service_id, notice_status } = req.query;
        
        let query = `
            SELECT 
                cn.*,
                us.service_name as upstream_service_name,
                (SELECT COUNT(*) FROM subscription_confirmations sc WHERE sc.notice_id = cn.notice_id) as total_subscriptions,
                (SELECT COUNT(*) FROM subscription_confirmations sc 
                 WHERE sc.notice_id = cn.notice_id 
                 AND sc.subscription_status IN ('COMPLETED', 'NO_ACTION_NEEDED')) as completed_subscriptions
            FROM change_notices cn
            JOIN services us ON cn.upstream_service_id = us.service_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (from_date) {
            query += ` AND cn.change_date >= $${paramIndex++}`;
            params.push(from_date);
        }
        if (to_date) {
            query += ` AND cn.change_date <= $${paramIndex++}`;
            params.push(to_date);
        }
        if (service_id) {
            query += ` AND cn.upstream_service_id = $${paramIndex++}`;
            params.push(service_id);
        }
        if (notice_status) {
            query += ` AND cn.notice_status = $${paramIndex++}`;
            params.push(notice_status);
        }
        
        query += ' ORDER BY cn.change_date DESC';
        
        const result = await db.query(query, params);
        
        const reports = result.rows.map(row => ({
            notice_id: row.notice_id,
            upstream_service_id: row.upstream_service_id,
            upstream_service_name: row.upstream_service_name,
            change_type: row.change_type,
            change_title: row.change_title,
            change_description: row.change_description,
            old_version: row.old_version,
            new_version: row.new_version,
            is_breaking_change: row.is_breaking_change,
            change_date: row.change_date,
            compatibility_start_date: row.compatibility_start_date,
            compatibility_end_date: row.compatibility_end_date,
            rollback_window_end_date: row.rollback_window_end_date,
            compatibility_deadline_days: row.compatibility_deadline_days,
            rollback_window_days: row.rollback_window_days,
            notice_status: row.notice_status,
            total_subscriptions: parseInt(row.total_subscriptions),
            completed_subscriptions: parseInt(row.completed_subscriptions),
            completion_rate: row.total_subscriptions > 0 
                ? (row.completed_subscriptions / row.total_subscriptions * 100).toFixed(1) 
                : 0
        }));
        
        const byChangeType = reports.reduce((acc, r) => {
            acc[r.change_type] = (acc[r.change_type] || 0) + 1;
            return acc;
        }, {});
        
        const byStatus = reports.reduce((acc, r) => {
            acc[r.notice_status] = (acc[r.notice_status] || 0) + 1;
            return acc;
        }, {});
        
        const breakingChanges = reports.filter(r => r.is_breaking_change);
        const avgCompletionRate = reports.length > 0
            ? (reports.reduce((acc, r) => acc + parseFloat(r.completion_rate), 0) / reports.length).toFixed(1)
            : 0;
        
        res.json({
            success: true,
            data: {
                reports,
                summary: {
                    total_notices: reports.length,
                    breaking_changes: breakingChanges.length,
                    by_change_type: byChangeType,
                    by_notice_status: byStatus,
                    average_completion_rate: avgCompletionRate
                },
                filters: {
                    from_date: from_date || null,
                    to_date: to_date || null,
                    service_id: service_id || null,
                    notice_status: notice_status || null
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/export/subscriptions', async (req, res, next) => {
    try {
        const { 
            downstream_service_id, 
            notice_id,
            subscription_status,
            deadline_status,
            format
        } = req.query;
        
        const exportFormat = format || 'csv';
        
        let query = `
            SELECT 
                sc.confirmation_id,
                sc.notice_id,
                sc.downstream_service_id,
                ds.service_name as downstream_service_name,
                ds.service_owner as downstream_owner,
                ds.owner_email as downstream_email,
                cn.upstream_service_id,
                us.service_name as upstream_service_name,
                cn.change_type,
                cn.change_title,
                cn.old_version,
                cn.new_version,
                cn.is_breaking_change,
                cn.change_date,
                cn.compatibility_end_date,
                cn.rollback_window_end_date,
                sc.subscription_status,
                sc.confirmation_date,
                sc.confirmation_by,
                sc.confirmation_notes,
                sc.mitigation_plan,
                sc.estimated_completion_date,
                sc.actual_completion_date
            FROM subscription_confirmations sc
            JOIN change_notices cn ON sc.notice_id = cn.notice_id
            JOIN services ds ON sc.downstream_service_id = ds.service_id
            JOIN services us ON cn.upstream_service_id = us.service_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (downstream_service_id) {
            query += ` AND sc.downstream_service_id = $${paramIndex++}`;
            params.push(downstream_service_id);
        }
        if (notice_id) {
            query += ` AND sc.notice_id = $${paramIndex++}`;
            params.push(notice_id);
        }
        if (subscription_status) {
            query += ` AND sc.subscription_status = $${paramIndex++}`;
            params.push(subscription_status);
        }
        
        const result = await db.query(query, params);
        
        const now = new Date();
        let items = result.rows.map(row => {
            const compatEnd = new Date(row.compatibility_end_date);
            const rollbackEnd = new Date(row.rollback_window_end_date);
            
            const daysUntilCompatEnd = Math.ceil((compatEnd - now) / (1000 * 60 * 60 * 24));
            const daysUntilRollbackEnd = Math.ceil((rollbackEnd - now) / (1000 * 60 * 60 * 24));
            
            let status = 'ONGOING';
            if (now > rollbackEnd) status = 'EXPIRED';
            else if (now > compatEnd) status = 'ROLLBACK_ONLY';
            else if (daysUntilCompatEnd <= 7) status = 'URGENT';
            else if (daysUntilCompatEnd <= 14) status = 'APPROACHING';
            
            return {
                ...row,
                deadline_status: status,
                days_until_compatibility_end: Math.max(0, daysUntilCompatEnd),
                days_until_rollback_end: Math.max(0, daysUntilRollbackEnd)
            };
        });
        
        if (deadline_status) {
            items = items.filter(item => item.deadline_status === deadline_status);
        }
        
        const exportData = items.map(item => ({
            '确认ID': item.confirmation_id,
            '公告ID': item.notice_id,
            '下游服务ID': item.downstream_service_id,
            '下游服务名称': item.downstream_service_name,
            '下游负责人': item.downstream_owner,
            '下游邮箱': item.downstream_email,
            '上游服务ID': item.upstream_service_id,
            '上游服务名称': item.upstream_service_name,
            '变更类型': item.change_type,
            '变更标题': item.change_title,
            '旧版本': item.old_version || '-',
            '新版本': item.new_version,
            '是否破坏性变更': item.is_breaking_change ? '是' : '否',
            '变更日期': item.change_date,
            '兼容期截止': item.compatibility_end_date,
            '回滚窗口截止': item.rollback_window_end_date,
            '订阅状态': item.subscription_status,
            '截止状态': item.deadline_status,
            '距兼容期截止(天)': item.days_until_compatibility_end,
            '距回滚截止(天)': item.days_until_rollback_end,
            '确认时间': item.confirmation_date || '-',
            '确认人': item.confirmation_by || '-',
            '确认说明': item.confirmation_notes || '-',
            '缓解计划': item.mitigation_plan || '-',
            '预计完成日期': item.estimated_completion_date || '-',
            '实际完成日期': item.actual_completion_date || '-'
        }));
        
        if (exportFormat === 'json') {
            const snapshotId = uuidv4();
            await db.query(`
                INSERT INTO report_snapshots 
                (snapshot_id, report_type, report_parameters, report_summary, report_details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                snapshotId,
                'SUBSCRIPTIONS_EXPORT_JSON',
                JSON.stringify({ downstream_service_id, notice_id, subscription_status, deadline_status }),
                JSON.stringify({ total_records: exportData.length }),
                JSON.stringify(exportData)
            ]);
            
            res.json({
                success: true,
                data: {
                    snapshot_id: snapshotId,
                    export_time: new Date().toISOString(),
                    total_records: exportData.length,
                    records: exportData
                }
            });
        } else {
            const json2csvParser = new Parser({ 
                fields: Object.keys(exportData[0] || {}),
                excelStrings: true
            });
            const csv = json2csvParser.parse(exportData);
            
            const snapshotId = uuidv4();
            await db.query(`
                INSERT INTO report_snapshots 
                (snapshot_id, report_type, report_parameters, report_summary, report_details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                snapshotId,
                'SUBSCRIPTIONS_EXPORT_CSV',
                JSON.stringify({ downstream_service_id, notice_id, subscription_status, deadline_status }),
                JSON.stringify({ total_records: exportData.length }),
                JSON.stringify({ row_count: exportData.length })
            ]);
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=subscriptions_report_${Date.now()}.csv`);
            res.setHeader('X-Snapshot-Id', snapshotId);
            res.send('\uFEFF' + csv);
        }
    } catch (error) {
        next(error);
    }
});

router.get('/export/change-report', async (req, res, next) => {
    try {
        const { from_date, to_date, service_id, notice_status } = req.query;
        
        let query = `
            SELECT 
                cn.notice_id,
                cn.upstream_service_id,
                us.service_name as upstream_service_name,
                us.service_owner as upstream_owner,
                us.owner_email as upstream_email,
                cn.change_type,
                cn.change_title,
                cn.change_description,
                cn.old_version,
                cn.new_version,
                cn.is_breaking_change,
                cn.change_date,
                cn.compatibility_start_date,
                cn.compatibility_end_date,
                cn.compatibility_deadline_days,
                cn.rollback_window_end_date,
                cn.rollback_window_days,
                cn.notice_status,
                cn.created_by,
                cn.created_at,
                cn.published_at,
                (SELECT COUNT(*) FROM subscription_confirmations sc WHERE sc.notice_id = cn.notice_id) as total_subscriptions,
                (SELECT COUNT(*) FROM subscription_confirmations sc 
                 WHERE sc.notice_id = cn.notice_id 
                 AND sc.subscription_status IN ('COMPLETED', 'NO_ACTION_NEEDED')) as completed_subscriptions,
                (SELECT COUNT(*) FROM subscription_confirmations sc 
                 WHERE sc.notice_id = cn.notice_id 
                 AND sc.subscription_status = 'PENDING') as pending_confirmations
            FROM change_notices cn
            JOIN services us ON cn.upstream_service_id = us.service_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (from_date) {
            query += ` AND cn.change_date >= $${paramIndex++}`;
            params.push(from_date);
        }
        if (to_date) {
            query += ` AND cn.change_date <= $${paramIndex++}`;
            params.push(to_date);
        }
        if (service_id) {
            query += ` AND cn.upstream_service_id = $${paramIndex++}`;
            params.push(service_id);
        }
        if (notice_status) {
            query += ` AND cn.notice_status = $${paramIndex++}`;
            params.push(notice_status);
        }
        
        query += ' ORDER BY cn.change_date DESC';
        
        const result = await db.query(query, params);
        
        const exportData = result.rows.map(row => ({
            '公告ID': row.notice_id,
            '上游服务ID': row.upstream_service_id,
            '上游服务名称': row.upstream_service_name,
            '上游负责人': row.upstream_owner,
            '上游邮箱': row.upstream_email,
            '变更类型': row.change_type,
            '变更标题': row.change_title,
            '变更描述': row.change_description || '-',
            '旧版本': row.old_version || '-',
            '新版本': row.new_version,
            '是否破坏性变更': row.is_breaking_change ? '是' : '否',
            '变更日期': row.change_date,
            '兼容期开始': row.compatibility_start_date || '-',
            '兼容期截止': row.compatibility_end_date,
            '兼容期天数': row.compatibility_deadline_days,
            '回滚窗口截止': row.rollback_window_end_date,
            '回滚窗口天数': row.rollback_window_days,
            '公告状态': row.notice_status,
            '创建人': row.created_by || '-',
            '创建时间': row.created_at,
            '发布时间': row.published_at || '-',
            '下游服务总数': parseInt(row.total_subscriptions),
            '已完成确认': parseInt(row.completed_subscriptions),
            '待确认': parseInt(row.pending_confirmations),
            '完成率': row.total_subscriptions > 0 
                ? `${(row.completed_subscriptions / row.total_subscriptions * 100).toFixed(1)}%`
                : '0%'
        }));
        
        const json2csvParser = new Parser({ 
            fields: Object.keys(exportData[0] || {}),
            excelStrings: true
        });
        const csv = json2csvParser.parse(exportData);
        
        const snapshotId = uuidv4();
        await db.query(`
            INSERT INTO report_snapshots 
            (snapshot_id, report_type, report_parameters, report_summary, report_details)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            snapshotId,
            'CHANGE_REPORT_EXPORT',
            JSON.stringify({ from_date, to_date, service_id, notice_status }),
            JSON.stringify({ total_records: exportData.length }),
            JSON.stringify({ row_count: exportData.length })
        ]);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=change_report_${Date.now()}.csv`);
        res.setHeader('X-Snapshot-Id', snapshotId);
        res.send('\uFEFF' + csv);
    } catch (error) {
        next(error);
    }
});

router.get('/snapshots/:snapshotId', async (req, res, next) => {
    try {
        const { snapshotId } = req.params;
        
        const result = await db.query(
            'SELECT * FROM report_snapshots WHERE snapshot_id = $1',
            [snapshotId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Snapshot not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
