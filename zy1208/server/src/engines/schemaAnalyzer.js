class SchemaAnalyzer {
  static analyze(schemaSql) {
    const result = {
      bottlenecks: [],
      indexSuggestions: [],
      scoreDeductions: []
    };

    const tables = SchemaAnalyzer._parseTables(schemaSql);
    
    for (const table of tables) {
      const tableName = table.name;
      
      if (!table.hasPrimaryKey) {
        result.bottlenecks.push({
          category: '缺失主键',
          severity: 'critical',
          description: `表 ${tableName} 没有定义主键`,
          suggestion: '为表添加主键，推荐使用自增 ID 或 UUID',
          impactScore: 10
        });
        result.scoreDeductions.push(15);
        
        result.indexSuggestions.push({
          tableName: tableName,
          indexName: `pk_${tableName}_id`,
          action: 'create',
          problem: '表没有主键',
          sql: `ALTER TABLE ${tableName} ADD COLUMN id SERIAL PRIMARY KEY;`
        });
      }

      const indexCount = table.indexes.length;
      if (indexCount > 8) {
        result.bottlenecks.push({
          category: '索引过多',
          severity: 'medium',
          description: `表 ${tableName} 有 ${indexCount} 个索引，可能影响写入性能`,
          suggestion: '评估并删除未使用的索引，考虑合并功能重叠的索引',
          impactScore: 5
        });
        result.scoreDeductions.push(5);
      }

      const tableAnalysis = SchemaAnalyzer._analyzeTableStructure(table);
      
      result.bottlenecks.push(...tableAnalysis.bottlenecks);
      result.indexSuggestions.push(...tableAnalysis.indexSuggestions);
      result.scoreDeductions.push(...tableAnalysis.scoreDeductions);
    }

    const fkWithoutIndex = SchemaAnalyzer._findFKWithoutIndex(tables);
    for (const fk of fkWithoutIndex) {
      result.bottlenecks.push({
        category: '外键无索引',
        severity: 'high',
        description: `表 ${fk.table} 的外键列 ${fk.column} 没有索引`,
        suggestion: '为外键列添加索引以加速 JOIN 和删除操作',
        impactScore: 7
      });
      result.scoreDeductions.push(8);
      
      result.indexSuggestions.push({
        tableName: fk.table,
        indexName: `idx_${fk.table}_${fk.column}`,
        action: 'create',
        problem: '外键列缺少索引',
        sql: `CREATE INDEX idx_${fk.table}_${fk.column} ON ${fk.table}(${fk.column});`
      });
    }

    return result;
  }

  static _parseTables(schemaSql) {
    const tables = [];
    const createTableRegex = /CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(([\s\S]*?)\);?/gi;
    const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+([\w.]+)\s*\(([^)]+)\)/gi;
    
    let match;
    
    while ((match = createTableRegex.exec(schemaSql)) !== null) {
      const tableName = match[1];
      const tableContent = match[2];
      
      const table = {
        name: tableName,
        columns: [],
        indexes: [],
        hasPrimaryKey: false,
        foreignKeys: []
      };

      const lines = tableContent.split(',');
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.includes('PRIMARY KEY')) {
          table.hasPrimaryKey = true;
        }
        
        if (trimmed.includes('FOREIGN KEY')) {
          const fkMatch = trimmed.match(/FOREIGN\s+KEY\s*\((\w+)\)\s+REFERENCES\s+([\w.]+)\s*\((\w+)\)/i);
          if (fkMatch) {
            table.foreignKeys.push({
              column: fkMatch[1],
              refTable: fkMatch[2],
              refColumn: fkMatch[3]
            });
          }
        }
      }

      tables.push(table);
    }

    while ((match = indexRegex.exec(schemaSql)) !== null) {
      const indexName = match[1];
      const tableName = match[2];
      const columns = match[3];
      
      const table = tables.find(t => t.name === tableName || tableName.includes(t.name));
      if (table) {
        table.indexes.push({
          name: indexName,
          columns: columns.split(',').map(c => c.trim())
        });
      }
    }

    return tables;
  }

  static _analyzeTableStructure(table) {
    const result = {
      bottlenecks: [],
      indexSuggestions: [],
      scoreDeductions: []
    };

    if (table.name.toLowerCase().includes('order') || 
        table.name.toLowerCase().includes('transaction') ||
        table.name.toLowerCase().includes('log')) {
      if (table.indexes.length < 2) {
        result.bottlenecks.push({
          category: '业务表索引不足',
          severity: 'medium',
          description: `业务表 ${table.name} 索引可能不足`,
          suggestion: '评估查询模式，添加必要的索引',
          impactScore: 4
        });
        result.scoreDeductions.push(3);
      }
    }

    return result;
  }

  static _findFKWithoutIndex(tables) {
    const result = [];
    
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        const hasIndex = table.indexes.some(idx => 
          idx.columns.includes(fk.column) ||
          idx.columns[0] === fk.column
        );
        
        if (!hasIndex) {
          result.push({
            table: table.name,
            column: fk.column
          });
        }
      }
    }
    
    return result;
  }
}

module.exports = SchemaAnalyzer;
