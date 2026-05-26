import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../database';
import { RetestRule } from '../types';

export async function createRetestRule(rule: Omit<RetestRule, 'id' | 'created_at'>): Promise<RetestRule> {
  const now = new Date().toISOString();
  const id = uuidv4();
  await runQuery(
    `INSERT INTO retest_rules 
     (id, rule_code, rule_name, item_code, fail_threshold,
     retest_count, retest_window_hours, action_on_fail, description, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, rule.rule_code, rule.rule_name, rule.item_code, rule.fail_threshold,
     rule.retest_count, rule.retest_window_hours, rule.action_on_fail, rule.description,
     rule.is_active ? 1 : 0, now]
  );
  return { ...rule, id, created_at: now };
}

export async function getRetestRules(activeOnly = false): Promise<RetestRule[]> {
  const query = activeOnly
    ? `SELECT * FROM retest_rules WHERE is_active = 1 ORDER BY created_at DESC`
    : `SELECT * FROM retest_rules ORDER BY created_at DESC`;
  return getAll<RetestRule>(query);
}

export async function getRetestRuleByCode(ruleCode: string): Promise<RetestRule | undefined> {
  return getOne<RetestRule>(`SELECT * FROM retest_rules WHERE rule_code = ?`, [ruleCode]);
}

export async function getRetestRuleById(id: string): Promise<RetestRule | undefined> {
  return getOne<RetestRule>(`SELECT * FROM retest_rules WHERE id = ?`, [id]);
}

export async function updateRetestRule(id: string, updates: Partial<RetestRule>): Promise<RetestRule | undefined> {
  const existing = await getRetestRuleById(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'created_at' && value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(key === 'is_active' ? (value ? 1 : 0) : value);
    }
  }

  if (fields.length === 0) return existing;

  await runQuery(
    `UPDATE retest_rules SET ${fields.join(', ')} WHERE id = ?`,
    [...params, id]
  );

  return getRetestRuleById(id);
}

export async function deleteRetestRule(id: string): Promise<boolean> {
  const result = await runQuery(`DELETE FROM retest_rules WHERE id = ?`, [id]);
  return result.changes > 0;
}

export async function getRetestRulesForItem(itemCode: string): Promise<RetestRule[]> {
  return getAll<RetestRule>(
    `SELECT * FROM retest_rules WHERE (item_code = ? OR item_code IS NULL) AND is_active = 1`,
    [itemCode]
  );
}
