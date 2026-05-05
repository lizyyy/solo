const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class AnalysisResult {
  static create(drillId, data) {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO analysis_results (
        id, drill_id, bottlenecks_json, sql_suggestions_json, 
        index_suggestions_json, connection_pool_json, 
        read_write_routing_json, sharding_risks_json, overall_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, 
      drillId, 
      JSON.stringify(data.bottlenecks || []),
      JSON.stringify(data.sqlSuggestions || []),
      JSON.stringify(data.indexSuggestions || []),
      JSON.stringify(data.connectionPool || {}),
      JSON.stringify(data.readWriteRouting || {}),
      JSON.stringify(data.shardingRisks || []),
      data.overallScore || 0
    );
    
    return this.findByDrillId(drillId);
  }

  static findByDrillId(drillId) {
    const stmt = db.prepare('SELECT * FROM analysis_results WHERE drill_id = ?');
    const result = stmt.get(drillId);
    
    if (result) {
      return {
        ...result,
        bottlenecks: JSON.parse(result.bottlenecks_json || '[]'),
        sqlSuggestions: JSON.parse(result.sql_suggestions_json || '[]'),
        indexSuggestions: JSON.parse(result.index_suggestions_json || '[]'),
        connectionPool: JSON.parse(result.connection_pool_json || '{}'),
        readWriteRouting: JSON.parse(result.read_write_routing_json || '{}'),
        shardingRisks: JSON.parse(result.sharding_risks_json || '[]')
      };
    }
    return null;
  }

  static update(drillId, data) {
    const stmt = db.prepare(`
      UPDATE analysis_results SET 
        bottlenecks_json = ?,
        sql_suggestions_json = ?,
        index_suggestions_json = ?,
        connection_pool_json = ?,
        read_write_routing_json = ?,
        sharding_risks_json = ?,
        overall_score = ?
      WHERE drill_id = ?
    `);
    
    stmt.run(
      JSON.stringify(data.bottlenecks || []),
      JSON.stringify(data.sqlSuggestions || []),
      JSON.stringify(data.indexSuggestions || []),
      JSON.stringify(data.connectionPool || {}),
      JSON.stringify(data.readWriteRouting || {}),
      JSON.stringify(data.shardingRisks || []),
      data.overallScore || 0,
      drillId
    );
    
    return this.findByDrillId(drillId);
  }

  static deleteByDrillId(drillId) {
    const stmt = db.prepare('DELETE FROM analysis_results WHERE drill_id = ?');
    return stmt.run(drillId);
  }
}

module.exports = AnalysisResult;
