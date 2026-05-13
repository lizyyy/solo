import { v4 as uuidv4 } from 'uuid';
import { PointRuleVersion, CategoryRule } from '../types';
import { getDbOne, getDbAll, runDb } from '../database';

function dbRowToPointRuleVersion(row: any): PointRuleVersion {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    description: row.description || '',
    rules: JSON.parse(row.rules),
    effectiveAt: row.effective_at,
    isFrozen: row.is_frozen === 1,
    createdAt: row.created_at
  };
}

export async function getPointRuleVersionById(id: string): Promise<PointRuleVersion | undefined> {
  const row = await getDbOne('SELECT * FROM point_rule_versions WHERE id = ?', [id]);
  return row ? dbRowToPointRuleVersion(row) : undefined;
}

export async function getPointRuleVersionByVersion(version: string): Promise<PointRuleVersion | undefined> {
  const row = await getDbOne('SELECT * FROM point_rule_versions WHERE version = ?', [version]);
  return row ? dbRowToPointRuleVersion(row) : undefined;
}

export async function createPointRuleVersion(
  version: string,
  name: string,
  rules: CategoryRule[],
  effectiveAt: string,
  description?: string
): Promise<PointRuleVersion> {
  const now = new Date().toISOString();
  const id = uuidv4();
  
  await runDb(
    'INSERT INTO point_rule_versions (id, version, name, description, rules, effective_at, is_frozen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, version, name, description || '', JSON.stringify(rules), effectiveAt, 0, now]
  );
  
  const ruleVersion = await getPointRuleVersionById(id);
  if (!ruleVersion) {
    throw new Error('Failed to create point rule version');
  }
  return ruleVersion;
}

export async function freezePointRuleVersion(id: string): Promise<void> {
  await runDb(
    'UPDATE point_rule_versions SET is_frozen = 1 WHERE id = ?',
    [id]
  );
}

export async function unfreezePointRuleVersion(id: string): Promise<void> {
  await runDb(
    'UPDATE point_rule_versions SET is_frozen = 0 WHERE id = ?',
    [id]
  );
}

export async function getAllPointRuleVersions(): Promise<PointRuleVersion[]> {
  const rows = await getDbAll('SELECT * FROM point_rule_versions ORDER BY created_at DESC');
  return rows.map(dbRowToPointRuleVersion);
}

export async function getMultiplierForCategory(rules: CategoryRule[], category: string): Promise<number> {
  const rule = rules.find(r => r.category === category);
  return rule ? rule.multiplier : 1;
}

export async function calculatePointsForTransaction(
  amount: number,
  category: string,
  rules: CategoryRule[]
): Promise<number> {
  const multiplier = await getMultiplierForCategory(rules, category);
  return Math.floor(amount * multiplier);
}
