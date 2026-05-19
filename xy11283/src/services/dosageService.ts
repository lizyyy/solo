import { runQuery, getQuery, allQuery } from '../database';
import { DosageRule, DosageCalculationResult } from '../models';
import { createAuditLog } from './auditService';

export async function createDosageRule(
  rule: Omit<DosageRule, 'id' | 'created_at'>,
  operatorId?: string,
  operatorName?: string
): Promise<DosageRule> {
  const result = await runQuery(
    `INSERT INTO dosage_rules (medicine_id, species, min_weight, max_weight, min_dosage, max_dosage, dosage_unit, dosage_per_kg, frequency, route, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rule.medicine_id,
      rule.species,
      rule.min_weight,
      rule.max_weight,
      rule.min_dosage,
      rule.max_dosage,
      rule.dosage_unit,
      rule.dosage_per_kg,
      rule.frequency,
      rule.route,
      rule.notes
    ]
  );

  const newRule = await getDosageRuleById(result.lastID);

  await createAuditLog(
    'dosage_rule',
    result.lastID,
    'create',
    null,
    newRule,
    operatorId,
    operatorName
  );

  return newRule;
}

export async function getDosageRuleById(id: number): Promise<DosageRule> {
  return await getQuery('SELECT * FROM dosage_rules WHERE id = ?', [id]);
}

export async function getDosageRulesByMedicineAndSpecies(
  medicineId: number,
  species: string
): Promise<DosageRule[]> {
  return await allQuery(
    `SELECT * FROM dosage_rules 
     WHERE medicine_id = ? AND (species = ? OR species = '通用')
     ORDER BY min_weight ASC`,
    [medicineId, species]
  );
}

export async function getAllDosageRules(): Promise<DosageRule[]> {
  return await allQuery('SELECT * FROM dosage_rules ORDER BY medicine_id, species, min_weight');
}

export async function updateDosageRule(
  id: number,
  updates: Partial<DosageRule>,
  operatorId?: string,
  operatorName?: string
): Promise<DosageRule> {
  const oldRule = await getDosageRuleById(id);

  const fields = Object.keys(updates).filter(k => k !== 'id');
  const setClause = fields.map(k => `${k} = ?`).join(', ');
  const values = fields.map(k => (updates as any)[k]);

  await runQuery(
    `UPDATE dosage_rules SET ${setClause} WHERE id = ?`,
    [...values, id]
  );

  const updatedRule = await getDosageRuleById(id);

  await createAuditLog(
    'dosage_rule',
    id,
    'update',
    oldRule,
    updatedRule,
    operatorId,
    operatorName
  );

  return updatedRule;
}

export function calculateDosage(
  weight: number,
  weightUnit: string,
  rules: DosageRule[]
): DosageCalculationResult {
  let normalizedWeight = weight;
  if (weightUnit.toLowerCase() === 'g') {
    normalizedWeight = weight / 1000;
  }

  if (normalizedWeight <= 0) {
    return {
      valid: false,
      error: '体重必须大于0'
    };
  }

  const applicableRules = rules.filter(rule => {
    const minOk = rule.min_weight === undefined || normalizedWeight >= rule.min_weight;
    const maxOk = rule.max_weight === undefined || normalizedWeight <= rule.max_weight;
    return minOk && maxOk;
  });

  if (applicableRules.length === 0) {
    return {
      valid: false,
      error: `未找到体重 ${normalizedWeight}kg 适用的剂量规则`
    };
  }

  const rule = applicableRules[0];
  let calculatedDosage: number;

  if (rule.dosage_per_kg !== undefined && rule.dosage_per_kg > 0) {
    calculatedDosage = normalizedWeight * rule.dosage_per_kg;
  } else {
    calculatedDosage = rule.min_dosage;
  }

  const warnings: string[] = [];

  if (calculatedDosage < rule.min_dosage) {
    calculatedDosage = rule.min_dosage;
    warnings.push(`剂量低于最小值，已调整为最小剂量 ${rule.min_dosage}${rule.dosage_unit}`);
  } else if (calculatedDosage > rule.max_dosage) {
    calculatedDosage = rule.max_dosage;
    warnings.push(`剂量超过最大值，已调整为最大剂量 ${rule.max_dosage}${rule.dosage_unit}`);
  }

  if (normalizedWeight < 1) {
    warnings.push(`注意：宠物体重 ${normalizedWeight}kg 较小，请仔细核对剂量`);
  }

  if (rule.min_weight !== undefined && normalizedWeight - rule.min_weight < 0.5) {
    warnings.push(`注意：体重接近剂量区间下限 ${rule.min_weight}kg`);
  }

  if (rule.max_weight !== undefined && rule.max_weight - normalizedWeight < 0.5) {
    warnings.push(`注意：体重接近剂量区间上限 ${rule.max_weight}kg`);
  }

  return {
    valid: true,
    calculatedDosage: Math.round(calculatedDosage * 1000) / 1000,
    warning: warnings.length > 0 ? warnings.join('; ') : undefined,
    rule
  };
}

export function validatePrescriptionDosage(
  prescribedDosage: number,
  calculatedResult: DosageCalculationResult
): { valid: boolean; warning?: string } {
  if (!calculatedResult.valid || !calculatedResult.rule) {
    return { valid: false, warning: calculatedResult.error };
  }

  const rule = calculatedResult.rule;
  const tolerance = 0.1;

  const minAllowed = rule.min_dosage * (1 - tolerance);
  const maxAllowed = rule.max_dosage * (1 + tolerance);

  if (prescribedDosage < minAllowed) {
    return {
      valid: false,
      warning: `处方剂量 ${prescribedDosage}${rule.dosage_unit} 低于最小剂量 ${rule.min_dosage}${rule.dosage_unit}`
    };
  }

  if (prescribedDosage > maxAllowed) {
    return {
      valid: false,
      warning: `处方剂量 ${prescribedDosage}${rule.dosage_unit} 高于最大剂量 ${rule.max_dosage}${rule.dosage_unit}`
    };
  }

  const diff = Math.abs(prescribedDosage - calculatedResult.calculatedDosage!) / calculatedResult.calculatedDosage!;
  if (diff > 0.2) {
    return {
      valid: true,
      warning: `处方剂量与计算剂量差异超过 20%，请确认`
    };
  }

  return { valid: true };
}
