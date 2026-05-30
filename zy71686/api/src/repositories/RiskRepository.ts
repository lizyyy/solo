import { getDb } from '../db/index.js';
import type { RiskAnalysisResult } from '../../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class RiskRepository {
  createResult(result: Omit<RiskAnalysisResult, 'id'> & Partial<Pick<RiskAnalysisResult, 'id'>>): RiskAnalysisResult {
    const db = getDb();
    const id = (result as RiskAnalysisResult).id || uuidv4();
    
    db.prepare(`
      INSERT INTO risk_analysis_result (
        id, customer_id, customer_name, total_exposure,
        guarantee_chain_risk, cross_guarantee_risk,
        counter_guarantee_coverage, credit_concentration,
        overall_risk_level, risk_factors, risk_score,
        calculation_version, calculation_time, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      result.customerId,
      result.customerName || '',
      result.totalExposure,
      result.guaranteeChainRisk,
      result.crossGuaranteeRisk,
      result.counterGuaranteeCoverage,
      result.creditConcentration,
      result.overallRiskLevel,
      JSON.stringify(result.riskFactors || []),
      result.riskScore,
      result.calculationVersion,
      result.calculationTime,
      result.version
    );
    
    return { ...result, id };
  }

  bulkCreateResults(results: (Omit<RiskAnalysisResult, 'id'> & Partial<Pick<RiskAnalysisResult, 'id'>>)[]): RiskAnalysisResult[] {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO risk_analysis_result (
        id, customer_id, customer_name, total_exposure,
        guarantee_chain_risk, cross_guarantee_risk,
        counter_guarantee_coverage, credit_concentration,
        overall_risk_level, risk_factors, risk_score,
        calculation_version, calculation_time, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result: RiskAnalysisResult[] = [];
    
    const insertMany = db.transaction((items: any[]) => {
      for (const r of items) {
        const id = r.id || uuidv4();
        stmt.run(
          id,
          r.customerId,
          r.customerName || '',
          r.totalExposure,
          r.guaranteeChainRisk,
          r.crossGuaranteeRisk,
          r.counterGuaranteeCoverage,
          r.creditConcentration,
          r.overallRiskLevel,
          JSON.stringify(r.riskFactors || []),
          r.riskScore,
          r.calculationVersion,
          r.calculationTime,
          r.version
        );
        result.push({ ...r, id });
      }
    });
    
    insertMany(results);
    return result;
  }

  findByCustomerId(customerId: string, version?: string): RiskAnalysisResult | null {
    const db = getDb();
    let sql = 'SELECT * FROM risk_analysis_result WHERE customer_id = ?';
    const params: any[] = [customerId];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    sql += ' ORDER BY calculation_time DESC LIMIT 1';
    
    const row = db.prepare(sql).get(...params) as any;
    return row ? this.mapToResult(row) : null;
  }

  findAll(version?: string, limit = 1000): RiskAnalysisResult[] {
    const db = getDb();
    let sql = 'SELECT * FROM risk_analysis_result';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    sql += " ORDER BY overall_risk_level = 'critical' DESC, overall_risk_level = 'high' DESC, risk_score DESC LIMIT ?";
    params.push(limit);
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToResult(row));
  }

  findByRiskLevel(riskLevel: string, version?: string): RiskAnalysisResult[] {
    const db = getDb();
    let sql = 'SELECT * FROM risk_analysis_result WHERE overall_risk_level = ?';
    const params: any[] = [riskLevel];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    sql += ' ORDER BY risk_score DESC';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToResult(row));
  }

  countByRiskLevel(version?: string): Record<string, number> {
    const db = getDb();
    let sql = `
      SELECT overall_risk_level, COUNT(*) as count
      FROM risk_analysis_result
    `;
    
    if (version) {
      sql += ' WHERE version = ?';
    }
    
    sql += ' GROUP BY overall_risk_level';
    
    const params = version ? [version] : [];
    const rows = db.prepare(sql).all(...params) as any[];
    
    const counts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    for (const row of rows) {
      counts[row.overall_risk_level] = row.count;
    }
    
    return counts;
  }

  deleteByVersion(version: string): number {
    const db = getDb();
    const info = db.prepare('DELETE FROM risk_analysis_result WHERE version = ?').run(version);
    return info.changes;
  }

  private mapToResult(row: any): RiskAnalysisResult {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      totalExposure: row.total_exposure,
      guaranteeChainRisk: row.guarantee_chain_risk,
      crossGuaranteeRisk: row.cross_guarantee_risk,
      counterGuaranteeCoverage: row.counter_guarantee_coverage,
      creditConcentration: row.credit_concentration,
      overallRiskLevel: row.overall_risk_level,
      riskFactors: row.risk_factors ? JSON.parse(row.risk_factors) : [],
      riskScore: row.risk_score,
      calculationVersion: row.calculation_version,
      calculationTime: row.calculation_time,
      version: row.version
    };
  }
}

export const riskRepository = new RiskRepository();
