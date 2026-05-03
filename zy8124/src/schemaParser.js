const fs = require('fs');

class SchemaParser {
  constructor() {}

  parse(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return this.normalizeSchema(data);
  }

  normalizeSchema(data) {
    const result = {
      tables: [],
      indexes: [],
      raw: data
    };

    // 处理不同格式的 schema 快照
    if (data.tables && Array.isArray(data.tables)) {
      for (const table of data.tables) {
        result.tables.push(this.normalizeTable(table));
      }
    } else if (data.tables && typeof data.tables === 'object') {
      for (const [tableName, tableData] of Object.entries(data.tables)) {
        result.tables.push(this.normalizeTable({ name: tableName, ...tableData }));
      }
    }

    if (data.indexes && Array.isArray(data.indexes)) {
      for (const index of data.indexes) {
        result.indexes.push(this.normalizeIndex(index));
      }
    } else if (data.indexes && typeof data.indexes === 'object') {
      for (const [indexName, indexData] of Object.entries(data.indexes)) {
        result.indexes.push(this.normalizeIndex({ name: indexName, ...indexData }));
      }
    }

    return result;
  }

  normalizeTable(table) {
    return {
      name: table.name || table.table_name || null,
      schema: table.schema || table.table_schema || 'public',
      columns: this.normalizeColumns(table.columns || table.fields || []),
      rowCount: table.row_count || table.rowCount || 0,
      size: table.size || table.table_size || 0,
      primaryKey: table.primary_key || table.primaryKey || null,
      foreignKeys: table.foreign_keys || table.foreignKeys || [],
      indexes: table.indexes || [],
      hasTriggers: table.has_triggers || table.hasTriggers || false
    };
  }

  normalizeColumns(columns) {
    return columns.map(col => ({
      name: col.name || col.column_name || null,
      type: col.type || col.data_type || col.udt_name || null,
      nullable: col.nullable !== false && (col.is_nullable === 'YES' || col.is_nullable !== 'NO'),
      default: col.default || col.column_default || null,
      isPrimaryKey: col.is_primary_key || col.isPrimaryKey || false,
      isForeignKey: col.is_foreign_key || col.isForeignKey || false
    }));
  }

  normalizeIndex(index) {
    return {
      name: index.name || index.index_name || null,
      table: index.table || index.table_name || null,
      schema: index.schema || index.table_schema || 'public',
      columns: index.columns || index.column_names || [],
      isUnique: index.is_unique || index.unique || false,
      isPrimary: index.is_primary || index.primary || false,
      method: index.method || index.index_method || 'btree',
      size: index.size || index.index_size || 0
    };
  }

  getTableByName(schema, tableName) {
    return schema.tables.find(t => t.name === tableName);
  }

  getTableSize(schema, tableName) {
    const table = this.getTableByName(schema, tableName);
    return table ? table.size : 0;
  }

  getTableRowCount(schema, tableName) {
    const table = this.getTableByName(schema, tableName);
    return table ? table.rowCount : 0;
  }

  hasColumn(schema, tableName, columnName) {
    const table = this.getTableByName(schema, tableName);
    if (!table) return false;
    return table.columns.some(c => c.name === columnName);
  }

  hasIndex(schema, tableName, indexName) {
    return schema.indexes.some(i => i.name === indexName && i.table === tableName);
  }
}

module.exports = SchemaParser;