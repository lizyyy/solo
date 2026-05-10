const { getDb } = require('../db/database');
const { generateId, formatDate } = require('../utils/generators');
const businessRules = require('../utils/rules');

const claimService = {
    createClaim(reportId, data, operator) {
        const db = getDb();
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        
        if (!report) {
            throw new Error('报案不存在');
        }
        
        if (report.status !== 'INSPECTED') {
            throw new Error('只有已查勘状态可以创建赔付估算');
        }

        const now = formatDate();
        
        const estimatedAmount = businessRules.calculateDamageCost(
            data.affected_area_sqm,
            data.damage_ratio,
            data.unit_price
        );

        const calculationRules = JSON.stringify({
            formula: '受损面积 × 受损比例 × 单位价格',
            parameters: {
                affected_area_sqm: data.affected_area_sqm,
                damage_ratio: data.damage_ratio,
                unit_price: data.unit_price
            },
            result: estimatedAmount
        });

        const claim = {
            id: generateId(),
            report_id: reportId,
            estimated_amount: estimatedAmount,
            actual_amount: null,
            calculation_rules: calculationRules,
            damage_ratio: data.damage_ratio,
            affected_area_sqm: data.affected_area_sqm,
            unit_price: data.unit_price,
            status: 'PENDING',
            approved_by: null,
            approved_at: null,
            created_at: now
        };

        db.prepare(`
            INSERT INTO claims (
                id, report_id, estimated_amount, actual_amount, calculation_rules,
                damage_ratio, affected_area_sqm, unit_price, status, approved_by, approved_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(claim.id, claim.report_id, claim.estimated_amount, claim.actual_amount, claim.calculation_rules, claim.damage_ratio, claim.affected_area_sqm, claim.unit_price, claim.status, claim.approved_by, claim.approved_at, claim.created_at);

        return claim;
    },

    getClaimsByReportId(reportId) {
        const db = getDb();
        return db.prepare('SELECT * FROM claims WHERE report_id = ? ORDER BY created_at DESC').all(reportId);
    },

    getLatestClaim(reportId) {
        const db = getDb();
        return db.prepare('SELECT * FROM claims WHERE report_id = ? ORDER BY created_at DESC').get(reportId);
    },

    approveClaim(claimId, actualAmount, operator) {
        const db = getDb();
        const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
        
        if (!claim) {
            throw new Error('赔付估算不存在');
        }
        
        if (claim.status !== 'PENDING') {
            throw new Error('只有待审批状态可以审批');
        }
        
        const now = formatDate();
        
        db.prepare(`
            UPDATE claims SET 
                actual_amount = ?, 
                status = 'APPROVED', 
                approved_by = ?, 
                approved_at = ? 
            WHERE id = ?
        `).run(actualAmount || claim.estimated_amount, operator, now, claimId);

        return db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
    }
};

module.exports = claimService;
