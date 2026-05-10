const db = require('../config/database');
const { generateId, round2 } = require('../utils/common');

class PlanService {
  createOrganization(name) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO organizations (id, name) 
      VALUES (?, ?)
    `);
    stmt.run(id, name);
    return this.getOrganization(id);
  }

  getOrganization(id) {
    return db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
  }

  listOrganizations() {
    return db.prepare('SELECT * FROM organizations ORDER BY created_at DESC').all();
  }

  createEmployee(organizationId, employeeNo, name, department) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO employees (id, organization_id, employee_no, name, department)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, organizationId, employeeNo, name, department);
    return this.getEmployee(id);
  }

  getEmployee(id) {
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  }

  listEmployees(organizationId) {
    return db.prepare(`
      SELECT * FROM employees 
      WHERE organization_id = ? 
      ORDER BY employee_no
    `).all(organizationId);
  }

  createMealPlan(organizationId, planDate, mealType, plannedCount, unitPrice) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO meal_plans (
        id, organization_id, plan_date, meal_type, 
        planned_count, unit_price
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, organizationId, planDate, mealType, plannedCount, unitPrice);
    return this.getMealPlan(id);
  }

  getMealPlan(id) {
    return db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(id);
  }

  listMealPlans(organizationId, startDate, endDate) {
    const stmt = db.prepare(`
      SELECT * FROM meal_plans 
      WHERE organization_id = ? 
        AND plan_date >= ? 
        AND plan_date <= ?
      ORDER BY plan_date, meal_type
    `);
    return stmt.all(organizationId, startDate, endDate);
  }

  getMealPlansByDate(organizationId, date) {
    return db.prepare(`
      SELECT * FROM meal_plans 
      WHERE organization_id = ? AND plan_date = ?
      ORDER BY meal_type
    `).all(organizationId, date);
  }

  createSubsidyRule(data) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO subsidy_rules (
        id, organization_id, rule_name, rule_type, 
        fixed_amount, percentage, max_amount,
        effective_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.organizationId,
      data.ruleName,
      data.ruleType,
      data.fixedAmount,
      data.percentage,
      data.maxAmount,
      data.effectiveDate,
      data.endDate
    );
    return this.getSubsidyRule(id);
  }

  getSubsidyRule(id) {
    return db.prepare('SELECT * FROM subsidy_rules WHERE id = ?').get(id);
  }

  listActiveSubsidyRules(organizationId, date) {
    return db.prepare(`
      SELECT * FROM subsidy_rules 
      WHERE organization_id = ? 
        AND is_active = 1
        AND effective_date <= ?
        AND (end_date IS NULL OR end_date >= ?)
    `).all(organizationId, date, date);
  }

  listAllSubsidyRules(organizationId) {
    return db.prepare(`
      SELECT * FROM subsidy_rules 
      WHERE organization_id = ?
      ORDER BY effective_date DESC
    `).all(organizationId);
  }

  createMealVerification(data) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO meal_verifications (
        id, organization_id, meal_plan_id, employee_id,
        verification_date, meal_type, verification_time, device_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.organizationId,
      data.mealPlanId,
      data.employeeId,
      data.verificationDate,
      data.mealType,
      data.verificationTime,
      data.deviceNo
    );
    return this.getMealVerification(id);
  }

  getMealVerification(id) {
    return db.prepare('SELECT * FROM meal_verifications WHERE id = ?').get(id);
  }

  listMealVerifications(organizationId, startDate, endDate) {
    return db.prepare(`
      SELECT mv.*, e.name as employee_name, e.employee_no
      FROM meal_verifications mv
      LEFT JOIN employees e ON mv.employee_id = e.id
      WHERE mv.organization_id = ? 
        AND mv.verification_date >= ? 
        AND mv.verification_date <= ?
      ORDER BY mv.verification_date, mv.meal_type, mv.verification_time
    `).all(organizationId, startDate, endDate);
  }

  getVerificationCountByPlan(mealPlanId) {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM meal_verifications
      WHERE meal_plan_id = ? AND status = 'verified'
    `).get(mealPlanId);
    return result.count;
  }

  getVerificationCountByDateAndType(organizationId, date, mealType) {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM meal_verifications
      WHERE organization_id = ? 
        AND verification_date = ? 
        AND meal_type = ?
        AND status = 'verified'
    `).get(organizationId, date, mealType);
    return result.count;
  }
}

module.exports = new PlanService();
