const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const rules = require('../rules/businessRules');

const router = express.Router();

const VALID_STATUS_TRANSITIONS = {
    'PENDING': ['ACKNOWLEDGED', 'IN_PROGRESS', 'NO_ACTION_NEEDED'],
    'ACKNOWLEDGED': ['IN_PROGRESS', 'COMPLETED', 'DEFERRED', 'NO_ACTION_NEEDED'],
    'IN_PROGRESS': ['COMPLETED', 'DEFERRED', 'BLOCKED'],
    'DEFERRED': ['IN_PROGRESS', 'COMPLETED'],
    'BLOCKED': ['IN_PROGRESS', 'COMPLETED'],
    'NO_ACTION_NEEDED': [],
    'COMPLETED': []
};

router.get('/', async (req, res, next) => {
    try {
        const { 
            downstream_service_id, 
            notice_id,
            subscription_status,
            deadline_status
        } = req.query;
        
        let query = `
            SELECT sc.*, 
                   cn.*,
                   s.service_name as downstream_service_name,
                   us.service_name as upstream_service_name
            FROM subscription_confirmations sc
            JOIN change_notices cn ON sc.notice_id = cn.notice_id
            JOIN services s ON sc.downstream_service_id = s.service_id
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
        
        query += ' ORDER BY sc.subscription_date DESC';
        
        const result = await db.query(query, params);
        
        const items = result.rows.map(row => {
            const notice = {
                notice_id: row.notice_id,
                upstream_service_id: row.upstream_service_id,
                upstream_service_name: row.upstream_service_name,
                change_type: row.change_type,
                change_title: row.change_title,
                new_version: row.new_version,
                old_version: row.old_version,
                change_date: row.change_date,
                compatibility_start_date: row.compatibility_start_date,
                compatibility_end_date: row.compatibility_end_date,
                rollback_window_end_date: row.rollback_window_end_date,
                is_breaking_change: row.is_breaking_change,
                notice_status: row.notice_status
            };
            
            if (row.notice_status === 'PUBLISHED') {
                const deadlineCalc = rules.calculateDeadlines({ 
                    notice, 
                    confirmationDate: row.confirmation_date 
                });
                return {
                    confirmation_id: row.confirmation_id,
                    notice_id: row.notice_id,
                    downstream_service_id: row.downstream_service_id,
                    downstream_service_name: row.downstream_service_name,
                    subscription_date: row.subscription_date,
                    subscription_status: row.subscription_status,
                    confirmation_date: row.confirmation_date,
                    confirmation_by: row.confirmation_by,
                    confirmation_notes: row.confirmation_notes,
                    affected_versions: row.affected_versions,
                    mitigation_plan: row.mitigation_plan,
                    estimated_completion_date: row.estimated_completion_date,
                    actual_completion_date: row.actual_completion_date,
                    notice,
                    deadline_info: deadlineCalc.decision
                };
            }
            
            return {
                confirmation_id: row.confirmation_id,
                notice_id: row.notice_id,
                downstream_service_id: row.downstream_service_id,
                downstream_service_name: row.downstream_service_name,
                subscription_date: row.subscription_date,
                subscription_status: row.subscription_status,
                confirmation_date: row.confirmation_date,
                confirmation_by: row.confirmation_by,
                confirmation_notes: row.confirmation_notes,
                affected_versions: row.affected_versions,
                mitigation_plan: row.mitigation_plan,
                estimated_completion_date: row.estimated_completion_date,
                actual_completion_date: row.actual_completion_date,
                notice
            };
        });
        
        let filteredItems = items;
        if (deadline_status) {
            filteredItems = items.filter(item => 
                item.deadline_info && item.deadline_info.deadlineStatus === deadline_status
            );
        }
        
        const summary = filteredItems.reduce((acc, item) => {
            const status = item.subscription_status;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        
        const statusPriorities = {
            'URGENT': 5,
            'APPROACHING': 4,
            'ONGOING': 3,
            'ROLLBACK_ONLY': 2,
            'EXPIRED': 1
        };
        
        filteredItems.sort((a, b) => {
            if (!a.deadline_info || !b.deadline_info) return 0;
            const priorityA = statusPriorities[a.deadline_info.deadlineStatus] || 0;
            const priorityB = statusPriorities[b.deadline_info.deadlineStatus] || 0;
            return priorityB - priorityA;
        });
        
        res.json({
            success: true,
            data: {
                items: filteredItems,
                total: filteredItems.length,
                summary
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/:confirmationId/confirm', async (req, res, next) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        const { confirmationId } = req.params;
        const { 
            confirmation_by, 
            confirmation_notes,
            new_status,
            affected_versions,
            mitigation_plan,
            estimated_completion_date
        } = req.body;
        
        const currentResult = await client.query(
            'SELECT * FROM subscription_confirmations WHERE confirmation_id = $1',
            [confirmationId]
        );
        
        if (currentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Subscription confirmation not found'
            });
        }
        
        const current = currentResult.rows[0];
        const targetStatus = new_status || 'ACKNOWLEDGED';
        
        const validTransitions = VALID_STATUS_TRANSITIONS[current.subscription_status] || [];
        if (!validTransitions.includes(targetStatus)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Invalid status transition from ${current.subscription_status} to ${targetStatus}. Valid transitions: ${validTransitions.join(', ')}`
            });
        }
        
        let actualCompletionDate = null;
        if (targetStatus === 'COMPLETED' || targetStatus === 'NO_ACTION_NEEDED') {
            actualCompletionDate = new Date().toISOString();
        }
        
        const result = await client.query(`
            UPDATE subscription_confirmations 
            SET subscription_status = $1,
                confirmation_date = CURRENT_TIMESTAMP,
                confirmation_by = COALESCE($2, confirmation_by),
                confirmation_notes = COALESCE($3, confirmation_notes),
                affected_versions = COALESCE($4, affected_versions),
                mitigation_plan = COALESCE($5, mitigation_plan),
                estimated_completion_date = COALESCE($6, estimated_completion_date),
                actual_completion_date = COALESCE($7, actual_completion_date),
                updated_at = CURRENT_TIMESTAMP
            WHERE confirmation_id = $8
            RETURNING *
        `, [
            targetStatus,
            confirmation_by,
            confirmation_notes,
            affected_versions,
            mitigation_plan,
            estimated_completion_date,
            actualCompletionDate,
            confirmationId
        ]);
        
        const noticeResult = await client.query(
            'SELECT * FROM change_notices WHERE notice_id = $1',
            [current.notice_id]
        );
        const notice = noticeResult.rows[0];
        
        const deadlineCalc = rules.calculateDeadlines({ 
            notice, 
            confirmationDate: result.rows[0].confirmation_date 
        });
        
        await rules.logDecision(
            'SUBSCRIPTION_STATUS_CHANGE',
            '1.0',
            {
                confirmationId,
                fromStatus: current.subscription_status,
                toStatus: targetStatus,
                confirmationBy: confirmation_by
            },
            {
                transitionValidated: true,
                validTransitions: VALID_STATUS_TRANSITIONS[current.subscription_status],
                deadlineInfo: deadlineCalc.decision
            },
            { 
                triggerSource: 'MANUAL_CONFIRMATION', 
                noticeId: current.notice_id,
                confirmationId 
            }
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            data: {
                subscription: result.rows[0],
                deadline_info: deadlineCalc.decision,
                transition: {
                    from: current.subscription_status,
                    to: targetStatus,
                    confirmed_by: confirmation_by
                }
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

router.get('/my-subscriptions/:serviceId', async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const { status, include_past } = req.query;
        
        let query = `
            SELECT sc.*,
                   cn.change_type,
                   cn.change_title,
                   cn.change_description,
                   cn.new_version,
                   cn.old_version,
                   cn.change_date,
                   cn.compatibility_start_date,
                   cn.compatibility_end_date,
                   cn.rollback_window_end_date,
                   cn.is_breaking_change,
                   cn.notice_status,
                   us.service_id as upstream_service_id,
                   us.service_name as upstream_service_name
            FROM subscription_confirmations sc
            JOIN change_notices cn ON sc.notice_id = cn.notice_id
            JOIN services us ON cn.upstream_service_id = us.service_id
            WHERE sc.downstream_service_id = $1
        `;
        const params = [serviceId];
        
        if (status) {
            query += ` AND sc.subscription_status = $${params.length + 1}`;
            params.push(status);
        }
        
        if (include_past !== 'true') {
            query += ` AND (cn.rollback_window_end_date > CURRENT_TIMESTAMP OR cn.rollback_window_end_date IS NULL)`;
        }
        
        query += ' ORDER BY cn.compatibility_end_date ASC';
        
        const result = await db.query(query, params);
        
        const items = result.rows.map(row => {
            const notice = {
                notice_id: row.notice_id,
                upstream_service_id: row.upstream_service_id,
                upstream_service_name: row.upstream_service_name,
                change_type: row.change_type,
                change_title: row.change_title,
                new_version: row.new_version,
                compatibility_end_date: row.compatibility_end_date,
                rollback_window_end_date: row.rollback_window_end_date,
                is_breaking_change: row.is_breaking_change
            };
            
            const deadlineCalc = rules.calculateDeadlines({ 
                notice, 
                confirmationDate: row.confirmation_date 
            });
            
            return {
                confirmation_id: row.confirmation_id,
                notice_id: row.notice_id,
                subscription_status: row.subscription_status,
                confirmation_date: row.confirmation_date,
                confirmation_notes: row.confirmation_notes,
                affected_versions: row.affected_versions,
                mitigation_plan: row.mitigation_plan,
                estimated_completion_date: row.estimated_completion_date,
                actual_completion_date: row.actual_completion_date,
                notice,
                deadline_info: deadlineCalc.decision
            };
        });
        
        const pendingCount = items.filter(i => 
            ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.subscription_status)
        ).length;
        
        const urgentCount = items.filter(i => 
            i.deadline_info && 
            i.deadline_info.deadlineStatus === 'URGENT' &&
            ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.subscription_status)
        ).length;
        
        res.json({
            success: true,
            data: {
                service_id: serviceId,
                items,
                total: items.length,
                pending_count: pendingCount,
                urgent_count: urgentCount
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:confirmationId', async (req, res, next) => {
    try {
        const { confirmationId } = req.params;
        
        const result = await db.query(`
            SELECT sc.*,
                   cn.*,
                   s.service_name as downstream_service_name,
                   s.service_owner as downstream_owner,
                   s.owner_email as downstream_email,
                   us.service_name as upstream_service_name
            FROM subscription_confirmations sc
            JOIN change_notices cn ON sc.notice_id = cn.notice_id
            JOIN services s ON sc.downstream_service_id = s.service_id
            JOIN services us ON cn.upstream_service_id = us.service_id
            WHERE sc.confirmation_id = $1
        `, [confirmationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subscription confirmation not found'
            });
        }
        
        const row = result.rows[0];
        
        const notice = {
            notice_id: row.notice_id,
            upstream_service_id: row.upstream_service_id,
            upstream_service_name: row.upstream_service_name,
            change_type: row.change_type,
            change_title: row.change_title,
            change_description: row.change_description,
            new_version: row.new_version,
            old_version: row.old_version,
            change_date: row.change_date,
            compatibility_start_date: row.compatibility_start_date,
            compatibility_end_date: row.compatibility_end_date,
            rollback_window_end_date: row.rollback_window_end_date,
            is_breaking_change: row.is_breaking_change
        };
        
        const deadlineCalc = rules.calculateDeadlines({ 
            notice, 
            confirmationDate: row.confirmation_date 
        });
        
        const ruleLogsResult = await db.query(`
            SELECT * FROM rule_decision_logs 
            WHERE related_confirmation_id = $1
            ORDER BY decision_timestamp ASC
        `, [confirmationId]);
        
        res.json({
            success: true,
            data: {
                confirmation: {
                    confirmation_id: row.confirmation_id,
                    notice_id: row.notice_id,
                    downstream_service_id: row.downstream_service_id,
                    downstream_service_name: row.downstream_service_name,
                    downstream_owner: row.downstream_owner,
                    downstream_email: row.downstream_email,
                    subscription_date: row.subscription_date,
                    subscription_status: row.subscription_status,
                    confirmation_date: row.confirmation_date,
                    confirmation_by: row.confirmation_by,
                    confirmation_notes: row.confirmation_notes,
                    affected_versions: row.affected_versions,
                    mitigation_plan: row.mitigation_plan,
                    estimated_completion_date: row.estimated_completion_date,
                    actual_completion_date: row.actual_completion_date
                },
                notice,
                deadline_info: deadlineCalc.decision,
                status_transitions: VALID_STATUS_TRANSITIONS[row.subscription_status] || [],
                rule_decisions: ruleLogsResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
