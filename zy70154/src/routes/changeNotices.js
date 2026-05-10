const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const rules = require('../rules/businessRules');

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const { 
            upstream_service_id, 
            notice_status, 
            change_type,
            is_breaking_change,
            from_date,
            to_date
        } = req.query;
        
        let query = `
            SELECT cn.*, s.service_name as upstream_service_name
            FROM change_notices cn
            JOIN services s ON cn.upstream_service_id = s.service_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;
        
        if (upstream_service_id) {
            query += ` AND cn.upstream_service_id = $${paramIndex++}`;
            params.push(upstream_service_id);
        }
        if (notice_status) {
            query += ` AND cn.notice_status = $${paramIndex++}`;
            params.push(notice_status);
        }
        if (change_type) {
            query += ` AND cn.change_type = $${paramIndex++}`;
            params.push(change_type);
        }
        if (is_breaking_change) {
            query += ` AND cn.is_breaking_change = $${paramIndex++}`;
            params.push(is_breaking_change === 'true');
        }
        if (from_date) {
            query += ` AND cn.change_date >= $${paramIndex++}`;
            params.push(from_date);
        }
        if (to_date) {
            query += ` AND cn.change_date <= $${paramIndex++}`;
            params.push(to_date);
        }
        
        query += ' ORDER BY cn.change_date DESC';
        
        const result = await db.query(query, params);
        
        const noticesWithDeadlines = await Promise.all(result.rows.map(async (notice) => {
            if (notice.notice_status === 'PUBLISHED') {
                const deadlineCalc = rules.calculateDeadlines({ notice });
                return {
                    ...notice,
                    deadline_info: deadlineCalc.decision
                };
            }
            return notice;
        }));
        
        res.json({
            success: true,
            data: {
                notices: noticesWithDeadlines,
                total: result.rows.length
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/preview-calculation', async (req, res, next) => {
    try {
        const {
            change_type,
            is_breaking_change,
            dependency_strength,
            change_date,
            custom_start_date,
            custom_end_date,
            custom_rollback_end_date,
            downstream_count
        } = req.query;
        
        const compatibilityInput = {
            changeType: change_type || 'MINOR_UPGRADE',
            isBreakingChange: is_breaking_change === 'true',
            dependencyStrength: dependency_strength || 'NORMAL',
            changeDate: change_date || new Date().toISOString(),
            customStartDate: custom_start_date,
            customEndDate: custom_end_date
        };
        
        const compatResult = rules.calculateCompatibilityPeriod(compatibilityInput);
        
        const rollbackInput = {
            changeType: change_type || 'MINOR_UPGRADE',
            isBreakingChange: is_breaking_change === 'true',
            compatibilityEndDate: compatResult.decision.compatibilityEndDate,
            customRollbackEndDate: custom_rollback_end_date
        };
        
        const rollbackResult = rules.calculateRollbackWindow(rollbackInput);
        
        const impactInput = {
            isBreakingChange: is_breaking_change === 'true',
            changeType: change_type || 'MINOR_UPGRADE',
            dependencyStrength: dependency_strength || 'NORMAL',
            downstreamCount: parseInt(downstream_count) || 0
        };
        
        const impactResult = rules.assessImpact(impactInput);
        
        res.json({
            success: true,
            data: {
                compatibility_period: compatResult,
                rollback_window: rollbackResult,
                impact_assessment: impactResult
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        const {
            upstream_service_id,
            change_type,
            change_title,
            change_description,
            old_version,
            new_version,
            change_date,
            custom_compatibility_start_date,
            custom_compatibility_end_date,
            custom_rollback_end_date,
            compatibility_deadline_days,
            rollback_window_days,
            is_breaking_change,
            created_by
        } = req.body;
        
        if (!upstream_service_id || !change_type || !change_title || !new_version || !change_date) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Required fields: upstream_service_id, change_type, change_title, new_version, change_date'
            });
        }
        
        const depsResult = await client.query(`
            SELECT * FROM service_dependencies 
            WHERE upstream_service_id = $1 AND is_active = true
        `, [upstream_service_id]);
        
        const dependencies = depsResult.rows;
        const avgStrength = dependencies.length > 0 
            ? dependencies[0].dependency_strength 
            : 'NORMAL';
        
        const compatInput = {
            changeType: change_type,
            isBreakingChange: is_breaking_change,
            dependencyStrength: avgStrength,
            changeDate: change_date,
            customStartDate: custom_compatibility_start_date,
            customEndDate: custom_compatibility_end_date
        };
        const compatResult = rules.calculateCompatibilityPeriod(compatInput);
        
        await rules.logDecision(
            'COMPATIBILITY_CALCULATION',
            rules.RULE_VERSIONS.COMPATIBILITY_CALCULATION,
            compatResult.inputs,
            compatResult.decision,
            { triggerSource: 'CREATE_NOTICE_DRAFT' }
        );
        
        const rollbackInput = {
            changeType: change_type,
            isBreakingChange: is_breaking_change,
            compatibilityEndDate: compatResult.decision.compatibilityEndDate,
            customRollbackEndDate: custom_rollback_end_date
        };
        const rollbackResult = rules.calculateRollbackWindow(rollbackInput);
        
        await rules.logDecision(
            'ROLLBACK_WINDOW',
            rules.RULE_VERSIONS.ROLLBACK_WINDOW,
            rollbackResult.inputs,
            rollbackResult.decision,
            { triggerSource: 'CREATE_NOTICE_DRAFT' }
        );
        
        const noticeId = uuidv4();
        
        const result = await client.query(`
            INSERT INTO change_notices 
            (notice_id, upstream_service_id, change_type, change_title, change_description,
             old_version, new_version, change_date, 
             compatibility_start_date, compatibility_end_date, rollback_window_end_date,
             compatibility_deadline_days, rollback_window_days, is_breaking_change,
             notice_status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            noticeId, upstream_service_id, change_type, change_title, change_description,
            old_version, new_version, change_date,
            compatResult.decision.compatibilityStartDate,
            compatResult.decision.compatibilityEndDate,
            rollbackResult.decision.rollbackWindowEndDate,
            compatResult.decision.compatibilityDays,
            rollbackResult.decision.rollbackWindowDays,
            is_breaking_change || false,
            'DRAFT',
            created_by
        ]);
        
        const impactInput = {
            isBreakingChange: is_breaking_change,
            changeType: change_type,
            dependencyStrength: avgStrength,
            downstreamCount: dependencies.length
        };
        const impactResult = rules.assessImpact(impactInput);
        
        await rules.logDecision(
            'IMPACT_ASSESSMENT',
            rules.RULE_VERSIONS.IMPACT_ASSESSMENT,
            impactResult.inputs,
            impactResult.decision,
            { triggerSource: 'CREATE_NOTICE_DRAFT', noticeId }
        );
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            data: {
                notice: result.rows[0],
                calculations: {
                    compatibility_period: compatResult,
                    rollback_window: rollbackResult,
                    impact_assessment: impactResult
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

router.post('/:noticeId/publish', async (req, res, next) => {
    const client = await db.getClient();
    
    try {
        await client.query('BEGIN');
        
        const { noticeId } = req.params;
        const { published_by } = req.body;
        
        const noticeResult = await client.query(
            'SELECT * FROM change_notices WHERE notice_id = $1',
            [noticeId]
        );
        
        if (noticeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Notice not found'
            });
        }
        
        const notice = noticeResult.rows[0];
        
        if (notice.notice_status !== 'DRAFT') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Cannot publish notice in status: ${notice.notice_status}`
            });
        }
        
        const depsResult = await client.query(`
            SELECT * FROM service_dependencies 
            WHERE upstream_service_id = $1 AND is_active = true
        `, [notice.upstream_service_id]);
        
        const dependencies = depsResult.rows;
        
        const subscribeInput = {
            upstreamServiceId: notice.upstream_service_id,
            dependencies,
            notice
        };
        const subscribeResult = rules.determineAutoSubscribeDownstreams(subscribeInput);
        
        await rules.logDecision(
            'SUBSCRIPTION_AUTO_CREATE',
            rules.RULE_VERSIONS.SUBSCRIPTION_AUTO_CREATE,
            subscribeResult.inputs,
            subscribeResult.decision,
            { triggerSource: 'PUBLISH_NOTICE', noticeId }
        );
        
        const updatedNotice = await client.query(`
            UPDATE change_notices 
            SET notice_status = 'PUBLISHED',
                published_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE notice_id = $1
            RETURNING *
        `, [noticeId]);
        
        const createdSubscriptions = [];
        for (const downstream of subscribeResult.decision.autoSubscribeServices) {
            const subId = uuidv4();
            const subResult = await client.query(`
                INSERT INTO subscription_confirmations 
                (confirmation_id, notice_id, downstream_service_id, subscription_status)
                VALUES ($1, $2, $3, 'PENDING')
                RETURNING *
            `, [subId, noticeId, downstream.serviceId]);
            createdSubscriptions.push(subResult.rows[0]);
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            data: {
                notice: updatedNotice.rows[0],
                subscription_decision: subscribeResult,
                created_subscriptions: createdSubscriptions
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

router.get('/:noticeId', async (req, res, next) => {
    try {
        const { noticeId } = req.params;
        
        const noticeResult = await db.query(`
            SELECT cn.*, s.service_name as upstream_service_name
            FROM change_notices cn
            JOIN services s ON cn.upstream_service_id = s.service_id
            WHERE cn.notice_id = $1
        `, [noticeId]);
        
        if (noticeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Notice not found'
            });
        }
        
        const notice = noticeResult.rows[0];
        
        const subscriptionsResult = await db.query(`
            SELECT sc.*, s.service_name as downstream_service_name,
                   s.service_owner, s.owner_email
            FROM subscription_confirmations sc
            JOIN services s ON sc.downstream_service_id = s.service_id
            WHERE sc.notice_id = $1
            ORDER BY sc.subscription_date DESC
        `, [noticeId]);
        
        const subscriptionsWithDeadlines = subscriptionsResult.rows.map(sub => {
            if (notice.notice_status === 'PUBLISHED') {
                const deadlineCalc = rules.calculateDeadlines({ 
                    notice, 
                    subscription: sub,
                    confirmationDate: sub.confirmation_date
                });
                return {
                    ...sub,
                    deadline_info: deadlineCalc.decision
                };
            }
            return sub;
        });
        
        const statusSummary = subscriptionsResult.rows.reduce((acc, sub) => {
            acc[sub.subscription_status] = (acc[sub.subscription_status] || 0) + 1;
            return acc;
        }, {});
        
        const ruleLogsResult = await db.query(`
            SELECT * FROM rule_decision_logs 
            WHERE related_notice_id = $1
            ORDER BY decision_timestamp ASC
        `, [noticeId]);
        
        let deadlineInfo = null;
        if (notice.notice_status === 'PUBLISHED') {
            const deadlineCalc = rules.calculateDeadlines({ notice });
            deadlineInfo = deadlineCalc.decision;
        }
        
        res.json({
            success: true,
            data: {
                notice,
                deadline_info: deadlineInfo,
                subscriptions: {
                    items: subscriptionsWithDeadlines,
                    total: subscriptionsResult.rows.length,
                    summary: statusSummary
                },
                rule_decisions: ruleLogsResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
