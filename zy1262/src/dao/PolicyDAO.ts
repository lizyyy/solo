import { db } from '../database';
import { LBPolicy } from '../types';

export class PolicyDAO {
  static create(policy: LBPolicy): LBPolicy {
    const stmt = db.prepare(`
      INSERT INTO lb_policies (version, name, type, config, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      policy.version,
      policy.name,
      policy.type,
      JSON.stringify(policy.config),
      policy