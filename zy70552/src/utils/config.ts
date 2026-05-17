import fs from 'fs';
import path from 'path';
import { DatabaseConfig, MigrationScript, TableSchema, ShadowData } from '../types';

export function loadDatabaseConfig(configPath: string): DatabaseConfig {
  const resolvedPath = path.resolve(configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Database config file not found: ${resolvedPath}`);
  }
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  return JSON.parse(content);
}

export function loadMigrationScripts(scriptsPath: string): MigrationScript[] {
  const resolvedPath = path.resolve(scriptsPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Migration scripts directory not found: ${resolvedPath}`);
  }
  
  const scripts: MigrationScript[] = [];
  const files = fs.readdirSync(resolvedPath)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(resolvedPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const { upSql, rollbackSql } = parseMigrationSql(content);
    
    scripts.push({
      id: `migration_${String(i + 1).padStart(4, '0')}`,
      name: path.basename(file, '.sql'),
      path: filePath,
      sql: upSql,
      rollbackSql: rollbackSql,
      order: i + 1
    });
  }
  
  return scripts;
}

function parseMigrationSql(content: string): { upSql: string; rollbackSql: string } {
  const upMatch = content.match(/--\s*UP\s*([\s\S]*?)(?=--\s*ROLLBACK|$)/i);
  const rollbackMatch = content.match(/--\s*ROLLBACK\s*([\s\S]*)/i);
  
  return {
    upSql: upMatch ? upMatch[1].trim() : content.trim(),
    rollbackSql: rollbackMatch ? rollbackMatch[1].trim() : ''
  };
}

export function loadShadowData(dataPath: string): ShadowData[] {
  const resolvedPath = path.resolve(dataPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Shadow data directory not found: ${resolvedPath}`);
  }
  
  const shadowDataList: ShadowData[] = [];
  const files = fs.readdirSync(resolvedPath).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(resolvedPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    shadowDataList.push({
      tableName: data.tableName || path.basename(file, '.json'),
      rows: Array.isArray(data.rows) ? data.rows : [data],
      primaryKey: data.primaryKey || []
    });
  }
  
  return shadowDataList;
}

export function loadTableSchemas(schemasPath: string): TableSchema[] {
  const resolvedPath = path.resolve(schemasPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Table schemas directory not found: ${resolvedPath}`);
  }
  
  const schemas: TableSchema[] = [];
  const files = fs.readdirSync(resolvedPath).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(resolvedPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    schemas.push({
      tableName: data.tableName || path.basename(file, '.json'),
      columns: data.columns || [],
      primaryKey: data.primaryKey || [],
      indexes: data.indexes || []
    });
  }
  
  return schemas;
}

export function ensureOutputDir(outputDir: string, runId: string): string {
  const runOutputDir = path.join(path.resolve(outputDir), runId);
  if (!fs.existsSync(runOutputDir)) {
    fs.mkdirSync(runOutputDir, { recursive: true });
  }
  return runOutputDir;
}
