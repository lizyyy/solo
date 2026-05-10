const fs = require('fs');
const path = require('path');
const { initDatabase, saveDatabase, exec, prepare } = require('../config/database');

async function main() {
  console.log('开始初始化数据库...');
  
  await initDatabase();

  exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      employee_no TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);

    CREATE TABLE IF NOT EXISTS meal_plans (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plan_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      planned_count INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meal_plans_org_date ON meal_plans(organization_id, plan_date);
    CREATE INDEX IF NOT EXISTS idx_meal_plans_date ON meal_plans(plan_date);

    CREATE TABLE IF NOT EXISTS subsidy_rules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      fixed_amount REAL,
      percentage REAL,
      max_amount REAL,
      effective_date TEXT NOT NULL,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_subsidy_rules_org ON subsidy_rules(organization_id);

    CREATE TABLE IF NOT EXISTS meal_verifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      meal_plan_id TEXT,
      employee_id TEXT,
      verification_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      verification_time TEXT,
      device_no TEXT,
      status TEXT NOT NULL DEFAULT 'verified',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_verifications_org_date ON meal_verifications(organization_id, verification_date);
    CREATE INDEX IF NOT EXISTS idx_verifications_plan ON meal_verifications(meal_plan_id);

    CREATE TABLE IF NOT EXISTS settlement_cycles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      cycle_year INTEGER NOT NULL,
      cycle_month INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_planned_count INTEGER NOT NULL DEFAULT 0,
      total_verified_count INTEGER NOT NULL DEFAULT 0,
      total_planned_amount REAL NOT NULL DEFAULT 0,
      total_subsidy_amount REAL NOT NULL DEFAULT 0,
      total_actual_amount REAL NOT NULL DEFAULT 0,
      total_difference_amount REAL NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_settlement_cycles_unique ON settlement_cycles(organization_id, cycle_year, cycle_month);

    CREATE TABLE IF NOT EXISTS settlement_records (
      id TEXT PRIMARY KEY,
      settlement_cycle_id TEXT NOT NULL,
      meal_plan_id TEXT NOT NULL,
      plan_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      planned_count INTEGER NOT NULL,
      verified_count INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      planned_amount REAL NOT NULL,
      subsidy_amount REAL NOT NULL,
      actual_amount REAL NOT NULL,
      difference_amount REAL NOT NULL,
      difference_reason TEXT,
      difference_reason_code TEXT,
      adjustment_type TEXT,
      adjustment_amount REAL NOT NULL DEFAULT 0,
      adjustment_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_settlement_records_cycle ON settlement_records(settlement_cycle_id);
    CREATE INDEX IF NOT EXISTS idx_settlement_records_plan ON settlement_records(meal_plan_id);

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      settlement_cycle_id TEXT NOT NULL,
      step_code TEXT NOT NULL,
      step_name TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      handler_role TEXT,
      handler_id TEXT,
      handler_name TEXT,
      processed_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_cycle ON workflow_steps(settlement_cycle_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_steps(status);

    CREATE TABLE IF NOT EXISTS workflow_history (
      id TEXT PRIMARY KEY,
      settlement_cycle_id TEXT NOT NULL,
      step_code TEXT NOT NULL,
      step_name TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      handler_role TEXT,
      handler_id TEXT,
      handler_name TEXT,
      note TEXT,
      processed_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_history_cycle ON workflow_history(settlement_cycle_id);

    CREATE TABLE IF NOT EXISTS adjustment_records (
      id TEXT PRIMARY KEY,
      settlement_cycle_id TEXT NOT NULL,
      settlement_record_id TEXT,
      adjustment_type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_adjustment_cycle ON adjustment_records(settlement_cycle_id);

    CREATE TABLE IF NOT EXISTS settlement_reports (
      id TEXT PRIMARY KEY,
      settlement_cycle_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      report_content TEXT,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reports_cycle ON settlement_reports(settlement_cycle_id);

    CREATE TABLE IF NOT EXISTS background_tasks (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      task_name TEXT NOT NULL,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      settlement_cycle_id TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON background_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_cycle ON background_tasks(settlement_cycle_id);
  `);

  saveDatabase();

  console.log('数据库初始化完成！');
  console.log('数据库路径:', path.resolve(__dirname, '../../data/meal-settlement.db'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
