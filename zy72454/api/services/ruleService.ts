import db from '../db/init.js';
import { BoundaryRule } from '../../shared/types.js';

export const listRules = (): BoundaryRule[] => {
  const rows = db
    .prepare('SELECT * FROM boundary_rules ORDER BY id ASC')
    .all() as Array<{
    id: string;
    name: string;
    description: string;
    trigger_condition: string;
    judgment_logic: string;
    modification_method: string;
    rollback_method: string;
    is_active: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    triggerCondition: row.trigger_condition,
    judgmentLogic: row.judgment_logic,
    modificationMethod: row.modification_method,
    rollbackMethod: row.rollback_method,
    isActive: row.is_active === 1,
  }));
};

export const getRule = (id: string): BoundaryRule | null => {
  const row = db.prepare('SELECT * FROM boundary_rules WHERE id = ?').get(id) as
    | {
        id: string;
        name: string;
        description: string;
        trigger_condition: string;
        judgment_logic: string;
        modification_method: string;
        rollback_method: string;
        is_active: number;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerCondition: row.trigger_condition,
    judgmentLogic: row.judgment_logic,
    modificationMethod: row.modification_method,
    rollbackMethod: row.rollback_method,
    isActive: row.is_active === 1,
  };
};

export const toggleRule = (id: string, isActive: boolean): boolean => {
  const result = db
    .prepare('UPDATE boundary_rules SET is_active = ? WHERE id = ?')
    .run(isActive ? 1 : 0, id);
  return result.changes > 0;
};
