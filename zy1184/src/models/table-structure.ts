export interface TableStructure {
  tableName: string;
  schema?: string;
  columns: ColumnDefinition[];
  primaryKey?: PrimaryKey;
  indexes: IndexDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  estimatedRowCount?: number;
  comment?: string;
}

export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isUnique: boolean;
  comment?: string;
  characterMaximumLength?: number;
  numericPrecision?: number;
  numericScale?: number;
}

export interface PrimaryKey {
  name?: string;
  columns: string[];
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  type?: 'BTREE' | 'HASH' | 'FULLTEXT' | 'OTHER';
}

export interface ForeignKeyDefinition {
  name?: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';
}

export interface TableStructureParseOptions {
  format?: 'sql' | 'json' | 'yaml';
  includeIndexes?: boolean;
  includeForeignKeys?: boolean;
}
