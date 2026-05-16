import fs from 'fs';
import path from 'path';
import { DatabaseConfig } from '../types';

export function loadDatabaseConfig(configPath: string): DatabaseConfig {
  const content = fs.readFileSync(path.resolve(configPath), 'utf-8');
  return JSON.parse(content);
}

export function loadMigrationScripts(scriptsPath: string): any[] {
  return [{ id: '1', name: 'test', path: scriptsPath, sql: 'SELECT 1' }];
}

export function loadShadowData(dataPath: string): any[] {
  return [];
}

export function loadTableSchemas(schemasPath: string): any[] {
  return [];
}

export function ensureOutputDir(outputDir: string, runId: string): string {
  const runOutputDir = path.join(outputDir, runId);
  if (!fs.existsSync(runOutputDir)) {
    fs.mkdirSync(runOutputDir, { recursive: true });
  }
  return runOutputDir;
}
