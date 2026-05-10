const db = require('../config/database');
const { 
  generateId, 
  round2, 
  getMonthRange,
  getMealTypeLabel,
  getDifferenceReasonLabel,
  getAdjustmentTypeLabel
} = require('../utils/common');
const planService = require('./planService');

class SettlementService {
  createSettlementCycle(organizationId, year, month) {
    const existing = db.prepare(`
      SELECT id FROM settlement_cycles 
      WHERE organization_id = ? AND cycle_year = ? AND cycle_month = ?
    `).get(organizationId, year, month);
    
    if (existing) {
      return this.getSettlementCycle(existing.id);
    }
    
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO settlement_cycles (
        id, organization_id, cycle_year, cycle_month, status
      ) VALUES (?, ?, ?, ?, 'pending')
    `);
    stmt.run(id, organizationId, year, month);
    
    this._createWorkflowSteps(id);
    
    return this.getSettlementCycle(id);
  }

  getSettlementCycle(id) {
    return db.prepare('SELECT * FROM settlement_cycles WHERE id = ?').get(id);
  }

  listSettlementCycles(organizationId) {
    return db.prepare(`
      SELECT * FROM settlement_cycles 
      WHERE organization_id = ?
      ORDER BY cycle_year DESC, cycle_month DESC
    `).all(organizationId);
  }

  _createWorkflowSteps(cycleId) {
    const steps = [
      { code: 'data_collect', name: '数据采集', order: 1 },
      { code: 'difference_calc', name: '差异计算', order: 2 },
      { code: 'subsidy_calc', name: '补贴核算', order: 3 },
      { code: 'operator_review', name: '运营审核', order: 4 },
      { code: 'finance_review', name: '财务审核', order: 5 },
      { code: 'adjustment', name: '差异调整', order: 6 },
      { code: 'settlement', name: '最终结算', order: 7 }
    ];
    
    const stmt = db.prepare(`
      INSERT INTO workflow_steps (
        id, settlement_cycle_id, step_code, step_name, step_order, status
      ) VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    
    steps.forEach(step => {
      stmt.run(generateId(), cycleId, step.code, step.name, step.order);
    });
  }

  getWorkflowSteps(cycleId) {
    return db.prepare(`
      SELECT * FROM workflow_steps 
      WHERE settlement_cycle_id = ? 
      ORDER BY step_order
    `).all(cycleId);
  }

  getCurrentStep(cycleId) {
    const steps = this.getWorkflowSteps(cycleId);
    for (const step of steps) {
      if (step.status === 'in_progress' || step.status === 'rejected') {
        return step;
      }
      if (step.status === 'pending') {
        return step;
      }
    }
    return null;
  }

  getPreviousProcessing(cycleId) {
    return db.prepare(`
      SELECT * FROM workflow_history 
      WHERE settlement_cycle_id = ? 
      ORDER BY processed_at DESC
      LIMIT 5
    `).all(cycleId);
  }

  _recordWorkflowHistory(cycleId, stepCode, stepName, action, 
    prevStatus, newStatus, handlerRole, handlerId, handlerName, note) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO workflow_history (
        id, settlement_cycle_id, step_code, step_name, 
        action, previous_status, new_status,
        handler_role, handler_id, handler_name, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, cycleId, stepCode, stepName, action, 
      prevStatus, newStatus, handlerRole, handlerId, handlerName, note);
  }

  _updateWorkflowStepStatus(cycleId, stepCode, status, 
    handlerRole, handlerId, handlerName, rejectionReason) {
    const stmt = db.prepare(`
      UPDATE workflow_steps 
      SET status = ?, 
          handler_role = ?,
          handler_id = ?,
          handler_name = ?,
          rejection_reason = ?,
          processed_at = datetime('now')
      WHERE settlement_cycle_id = ? AND step_code = ?
    `);
    stmt.run(status, handlerRole, handlerId, handlerName, rejectionReason, cycleId, stepCode);
  }

  calculateSettlement(cycleId) {
    const cycle = this.getSettlementCycle(cycleId);
    if (!cycle) {
      throw new Error('结算周期不存在');
    }
    
    const { startDate, endDate } = getMonthRange(cycle.cycle_year, cycle.cycle_month);
    
    db.transaction(() => {
      this._updateWorkflowStepStatus(cycleId, 'data_collect', 'in_progress');
      
      const mealPlans = planService.listMealPlans(
        cycle.organization_id, startDate, endDate
      );
      
      let totalPlannedCount = 0;
      let totalVerifiedCount = 0;
      let totalPlannedAmount = 0;
      let totalSubsidyAmount = 0;
      let totalActualAmount = 0;
      let totalDifferenceAmount = 0;
      
      const deleteStmt = db.prepare(`
        DELETE FROM settlement_records WHERE settlement_cycle_id = ?
      `);
      deleteStmt.run(cycleId);
      
      const insertStmt = db.prepare(`
        INSERT INTO settlement_records (
          id, settlement_cycle_id, meal_plan_id, plan_date, meal_type,
          planned_count, verified_count, unit_price,
          planned_amount, subsidy_amount, actual_amount,
          difference_amount, difference_reason, difference_reason_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      mealPlans.forEach(plan => {
        const verifiedCount = planService.getVerificationCountByPlan(plan.id);
        const plannedAmount = round2(plan.planned_count * plan.unit_price);
        const actualAmount = round2(verifiedCount * plan.unit_price);
        
        const subsidyRules = planService.listActiveSubsidyRules(
          cycle.organization_id, plan.plan_date
        );
        const subsidyAmount = this._calculateSubsidy(
          actualAmount, plan.planned_count, verifiedCount, subsidyRules
        );
        
        const difference = round2(plannedAmount - actualAmount);
        const { reason, code } = this._analyzeDifference(
          plan.planned_count, verifiedCount, plan.unit_price, difference
        );
        
        insertStmt.run(
          generateId(), cycleId, plan.id, plan.plan_date, plan.meal_type,
          plan.planned_count, verifiedCount, plan.unit_price,
          plannedAmount, subsidyAmount, actualAmount,
          difference, reason, code
        );
        
        totalPlannedCount += plan.planned_count;
        totalVerifiedCount += verifiedCount;
        totalPlannedAmount += plannedAmount;
        totalSubsidyAmount += subsidyAmount;
        totalActualAmount += actualAmount;
        totalDifferenceAmount += difference;
      });
      
      const updateCycleStmt = db.prepare(`
        UPDATE settlement_cycles 
        SET status = 'calculated',
            total_planned_count = ?,
            total_verified_count = ?,
            total_planned_amount = ?,
            total_subsidy_amount = ?,
            total_actual_amount = ?,
            total_difference_amount = ?
        WHERE id = ?
      `);
      updateCycleStmt.run(
        totalPlannedCount, totalVerifiedCount, totalPlannedAmount,
        totalSubsidyAmount, totalActualAmount, totalDifferenceAmount, cycleId
      );
      
      this._updateWorkflowStepStatus(cycleId, 'data_collect', 'completed');
      this._updateWorkflowStepStatus(cycleId, 'difference_calc', 'completed');
      this._updateWorkflowStepStatus(cycleId, 'subsidy_calc', 'completed');
      
      this._recordWorkflowHistory(cycleId, 'data_collect', '数据采集', 
        'complete', 'in_progress', 'completed', null, null, null, 
        `采集到 ${mealPlans.length} 条订餐计划记录`);
      this._recordWorkflowHistory(cycleId, 'difference_calc', '差异计算', 
        'complete', 'pending', 'completed', null, null, null, 
        `差异总额: ¥${totalDifferenceAmount.toFixed(2)}`);
      this._recordWorkflowHistory(cycleId, 'subsidy_calc', '补贴核算', 
        'complete', 'pending', 'completed', null, null, null, 
        `补贴总额: ¥${totalSubsidyAmount.toFixed(2)}`);
    });
    
    return this.getSettlementDetail(cycleId);
  }

  _calculateSubsidy(actualAmount, plannedCount, verifiedCount, rules) {
    if (!rules || rules.length === 0) {
      return 0;
    }
    
    let subsidy = 0;
    
    for (const rule of rules) {
      let thisSubsidy = 0;
      
      if (rule.rule_type === 'fixed_per_meal') {
        thisSubsidy = round2(verifiedCount * rule.fixed_amount);
      } else if (rule.rule_type === 'percentage') {
        thisSubsidy = round2(actualAmount * (rule.percentage / 100));
      } else if (rule.rule_type === 'fixed_total') {
        thisSubsidy = rule.fixed_amount;
      }
      
      if (rule.max_amount && thisSubsidy > rule.max_amount) {
        thisSubsidy = rule.max_amount;
      }
      
      subsidy += thisSubsidy;
    }
    
    return round2(subsidy);
  }

  _analyzeDifference(plannedCount, verifiedCount, unitPrice, difference) {
    if (difference === 0) {
      return { reason: '无差异', code: 'NO_DIFFERENCE' };
    }
    
    const countDiff = plannedCount - verifiedCount;
    
    if (countDiff > 0) {
      return { 
        reason: `员工未取餐 ${countDiff} 份，人均 ¥${unitPrice.toFixed(2)}`, 
        code: 'NO_SHOW' 
      };
    }
    
    if (countDiff < 0) {
      return { 
        reason: `超计划取餐 ${Math.abs(countDiff)} 份，人均 ¥${unitPrice.toFixed(2)}`, 
        code: 'EXTRA_VERIFICATION' 
      };
    }
    
    return { reason: '其他差异', code: 'OTHER' };
  }

  getSettlementDetail(cycleId) {
    const cycle = this.getSettlementCycle(cycleId);
    if (!cycle) {
      return null;
    }
    
    const records = db.prepare(`
      SELECT * FROM settlement_records 
      WHERE settlement_cycle_id = ?
      ORDER BY plan_date, meal_type
    `).all(cycleId);
    
    const currentStep = this.getCurrentStep(cycleId);
    const previousHistory = this.getPreviousProcessing(cycleId);
    
    return {
      cycle: cycle,
      records: records,
      currentStep: currentStep,
      previousProcessing: previousHistory,
      summary: {
        plannedCount: cycle.total_planned_count,
        verifiedCount: cycle.total_verified_count,
        differenceCount: cycle.total_planned_count - cycle.total_verified_count,
        plannedAmount: cycle.total_planned_amount,
        subsidyAmount: cycle.total_subsidy_amount,
        actualAmount: cycle.total_actual_amount,
        differenceAmount: cycle.total_difference_amount
      }
    };
  }

  listSettlementRecords(cycleId) {
    return db.prepare(`
      SELECT * FROM settlement_records 
      WHERE settlement_cycle_id = ?
      ORDER BY plan_date, meal_type
    `).all(cycleId);
  }

  submitForReview(cycleId, handlerRole, handlerId, handlerName) {
    const cycle = this.getSettlementCycle(cycleId);
    if (cycle.status !== 'calculated') {
      throw new Error('当前状态不允许提交审核');
    }
    
    db.transaction(() => {
      db.prepare(`
        UPDATE settlement_cycles SET status = 'reviewing' WHERE id = ?
      `).run(cycleId);
      
      this._updateWorkflowStepStatus(cycleId, 'operator_review', 'in_progress',
        handlerRole, handlerId, handlerName);
      
      this._recordWorkflowHistory(cycleId, 'operator_review', '运营审核',
        'submit', 'completed', 'in_progress', handlerRole, handlerId, handlerName,
        '提交运营审核');
    });
    
    return this.getSettlementDetail(cycleId);
  }

  reviewStep(cycleId, stepCode, approved, reason, handlerRole, handlerId, handlerName) {
    const step = db.prepare(`
      SELECT * FROM workflow_steps 
      WHERE settlement_cycle_id = ? AND step_code = ?
    `).get(cycleId, stepCode);
    
    if (!step) {
      throw new Error('流程步骤不存在');
    }
    
    if (step.status !== 'in_progress') {
      throw new Error('当前步骤不在处理中');
    }
    
    db.transaction(() => {
      const newStatus = approved ? 'completed' : 'rejected';
      
      this._updateWorkflowStepStatus(cycleId, stepCode, newStatus,
        handlerRole, handlerId, handlerName, approved ? null : reason);
      
      this._recordWorkflowHistory(cycleId, stepCode, step.step_name,
        approved ? 'approve' : 'reject', step.status, newStatus,
        handlerRole, handlerId, handlerName, approved ? '审核通过' : reason);
      
      if (approved) {
        if (stepCode === 'operator_review') {
          this._updateWorkflowStepStatus(cycleId, 'finance_review', 'in_progress',
            null, null, null);
        } else if (stepCode === 'finance_review') {
          db.prepare(`
            UPDATE settlement_cycles SET status = 'approved' WHERE id = ?
          `).run(cycleId);
        }
      } else {
        db.prepare(`
          UPDATE settlement_cycles SET status = 'rejected' WHERE id = ?
        `).run(cycleId);
      }
    });
    
    return this.getSettlementDetail(cycleId);
  }

  resubmitAfterRejection(cycleId, stepCode, handlerRole, handlerId, handlerName) {
    const cycle = this.getSettlementCycle(cycleId);
    if (cycle.status !== 'rejected') {
      throw new Error('当前状态不允许重新提交');
    }
    
    const steps = this.getWorkflowSteps(cycleId);
    const rejectedStep = steps.find(s => s.status === 'rejected');
    
    if (!rejectedStep) {
      throw new Error('未找到被驳回的步骤');
    }
    
    db.transaction(() => {
      db.prepare(`
        UPDATE workflow_steps 
        SET status = 'in_progress',
            rejection_reason = NULL
        WHERE settlement_cycle_id = ? AND step_code = ?
      `).run(cycleId, rejectedStep.step_code);
      
      db.prepare(`
        UPDATE settlement_cycles SET status = 'reviewing' WHERE id = ?
      `).run(cycleId);
      
      this._recordWorkflowHistory(cycleId, rejectedStep.step_code, rejectedStep.step_name,
        'resubmit', 'rejected', 'in_progress', handlerRole, handlerId, handlerName,
        '重新提交审核');
    });
    
    return this.getSettlementDetail(cycleId);
  }

  createAdjustment(cycleId, recordId, adjustmentType, amount, reason, 
    operatorId, operatorName) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO adjustment_records (
        id, settlement_cycle_id, settlement_record_id,
        adjustment_type, amount, reason, 
        operator_id, operator_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);
    stmt.run(id, cycleId, recordId, adjustmentType, amount, reason, 
      operatorId, operatorName);
    
    return this.getAdjustment(id);
  }

  getAdjustment(id) {
    return db.prepare('SELECT * FROM adjustment_records WHERE id = ?').get(id);
  }

  listAdjustments(cycleId) {
    return db.prepare(`
      SELECT * FROM adjustment_records 
      WHERE settlement_cycle_id = ?
      ORDER BY created_at DESC
    `).all(cycleId);
  }

  approveAdjustment(adjustmentId, approved) {
    const adj = this.getAdjustment(adjustmentId);
    if (!adj) {
      throw new Error('调整记录不存在');
    }
    
    const newStatus = approved ? 'approved' : 'rejected';
    const stmt = db.prepare(`
      UPDATE adjustment_records 
      SET status = ?, approved_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(newStatus, adjustmentId);
    
    if (approved && adj.settlement_record_id) {
      const record = db.prepare(`
        SELECT * FROM settlement_records WHERE id = ?
      `).get(adj.settlement_record_id);
      
      if (record) {
        let adjustmentType;
        if (adj.adjustment_type === 'refund' || adj.adjustment_type === 'waive') {
          adjustmentType = 'refund';
        } else {
          adjustmentType = 'deduction';
        }
        
        const updateStmt = db.prepare(`
          UPDATE settlement_records 
          SET adjustment_type = ?, 
              adjustment_amount = adjustment_amount + ?,
              adjustment_note = ?
          WHERE id = ?
        `);
        updateStmt.run(adjustmentType, adj.amount, adj.reason, adj.settlement_record_id);
        
        const adjAmount = adj.adjustment_type === 'refund' || adj.adjustment_type === 'waive' 
          ? adj.amount 
          : -adj.amount;
        
        db.prepare(`
          UPDATE settlement_cycles 
          SET total_difference_amount = total_difference_amount + ?
          WHERE id = ?
        `).run(adjAmount, adj.settlement_cycle_id);
      }
    }
    
    return this.getAdjustment(adjustmentId);
  }

  finalSettlement(cycleId, handlerRole, handlerId, handlerName) {
    const cycle = this.getSettlementCycle(cycleId);
    if (cycle.status !== 'approved') {
      throw new Error('当前状态不允许最终结算');
    }
    
    db.transaction(() => {
      this._updateWorkflowStepStatus(cycleId, 'adjustment', 'completed');
      this._updateWorkflowStepStatus(cycleId, 'settlement', 'completed',
        handlerRole, handlerId, handlerName);
      
      db.prepare(`
        UPDATE settlement_cycles 
        SET status = 'settled',
            completed_at = datetime('now')
        WHERE id = ?
      `).run(cycleId);
      
      this._recordWorkflowHistory(cycleId, 'adjustment', '差异调整',
        'complete', 'pending', 'completed', handlerRole, handlerId, handlerName,
        '差异调整完成');
      this._recordWorkflowHistory(cycleId, 'settlement', '最终结算',
        'complete', 'pending', 'completed', handlerRole, handlerId, handlerName,
        '结算完成');
    });
    
    return this.getSettlementDetail(cycleId);
  }
}

module.exports = new SettlementService();
