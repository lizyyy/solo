const SlowLogParser = require('./slowLogParser');
const SchemaAnalyzer = require('./schemaAnalyzer');
const ConnectionPoolAnalyzer = require('./connectionPoolAnalyzer');
const ReadWriteRoutingAnalyzer = require('./readWriteRoutingAnalyzer');
const ShardingAnalyzer = require('./shardingAnalyzer');
const WriteSampleAnalyzer = require('./writeSampleAnalyzer');

class AnalysisEngine {
  static analyze(data) {
    const result = {
      bottlenecks: [],
      sqlSuggestions: [],
      indexSuggestions: [],
      connectionPool: {},
      readWriteRouting: {},
      shardingRisks: [],
      overallScore: 0
    };

    let totalScore = 100;
    let scoreDeductions = [];

    if (data.slowLogs && data.slowLogs.length > 0) {
      const slowLogAnalysis = SlowLogParser.analyze(data.slowLogs);
      result.bottlenecks.push(...slowLogAnalysis.bottlenecks);
      result.sqlSuggestions.push(...slowLogAnalysis.sqlSuggestions);
      scoreDeductions.push(...slowLogAnalysis.scoreDeductions);
    }

    if (data.schema) {
      const schemaAnalysis = SchemaAnalyzer.analyze(data.schema);
      result.bottlenecks.push(...schemaAnalysis.bottlenecks);
      result.indexSuggestions.push(...schemaAnalysis.indexSuggestions);
      scoreDeductions.push(...schemaAnalysis.scoreDeductions);
    }

    if (data.dbProfile) {
      const poolAnalysis = ConnectionPoolAnalyzer.analyze(data.dbProfile);
      result.connectionPool = poolAnalysis;
      if (poolAnalysis.bottlenecks) {
        result.bottlenecks.push(...poolAnalysis.bottlenecks);
      }
      if (poolAnalysis.scoreDeductions) {
        scoreDeductions.push(...poolAnalysis.scoreDeductions);
      }
    }

    if (data.slowLogs && data.slowLogs.length > 0) {
      const routingAnalysis = ReadWriteRoutingAnalyzer.analyze(data.slowLogs);
      result.readWriteRouting = routingAnalysis;
      if (routingAnalysis.bottlenecks) {
        result.bottlenecks.push(...routingAnalysis.bottlenecks);
      }
      if (routingAnalysis.scoreDeductions) {
        scoreDeductions.push(...routingAnalysis.scoreDeductions);
      }
    }

    if (data.schema && data.writeSamples && data.writeSamples.length > 0) {
      const shardingAnalysis = ShardingAnalyzer.analyze(data.schema, data.writeSamples);
      result.shardingRisks = shardingAnalysis.risks;
      if (shardingAnalysis.bottlenecks) {
        result.bottlenecks.push(...shardingAnalysis.bottlenecks);
      }
      if (shardingAnalysis.scoreDeductions) {
        scoreDeductions.push(...shardingAnalysis.scoreDeductions);
      }
    }

    if (data.writeSamples && data.writeSamples.length > 0) {
      const writeAnalysis = WriteSampleAnalyzer.analyze(data.writeSamples);
      if (writeAnalysis.bottlenecks) {
        result.bottlenecks.push(...writeAnalysis.bottlenecks);
      }
      if (writeAnalysis.scoreDeductions) {
        scoreDeductions.push(...writeAnalysis.scoreDeductions);
      }
    }

    result.bottlenecks = AnalysisEngine._deduplicateBottlenecks(result.bottlenecks);
    
    result.bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });

    const totalDeduction = scoreDeductions.reduce((sum, d) => sum + d, 0);
    result.overallScore = Math.max(0, Math.min(100, totalScore - totalDeduction));

    return result;
  }

  static _deduplicateBottlenecks(bottlenecks) {
    const seen = new Set();
    const unique = [];

    for (const bottleneck of bottlenecks) {
      const key = `${bottleneck.category}-${bottleneck.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(bottleneck);
      }
    }

    return unique;
  }
}

module.exports = AnalysisEngine;
