import { FlagDefinition, ScanOptions, ProgrammingLanguage } from './types';
import { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_OUTPUT_DIR } from './constants';
import * as fs from 'fs';
import * as path from 'path';

export function loadFlagDefinitions(filePath: string): FlagDefinition[] {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Flag definitions file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  
  try {
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) {
      throw new Error('Flag definitions must be an array');
    }

    return data.map((item, index) => validateFlagDefinition(item, index));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in flag definitions: ${error.message}`);
    }
    throw error;
  }
}

function validateFlagDefinition(item: unknown, index: number): FlagDefinition {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`Flag definition at index ${index} must be an object`);
  }

  const obj = item as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new Error(`Flag definition at index ${index} must have a valid 'name' string`);
  }

  if (typeof obj.defaultValue !== 'boolean') {
    throw new Error(`Flag '${obj.name}' must have a boolean 'defaultValue'`);
  }

  if (obj.status !== undefined && 
      !['active', 'completed', 'archived', 'unknown'].includes(obj.status as string)) {
    throw new Error(`Flag '${obj.name}' has invalid status. Must be: active, completed, archived, unknown`);
  }

  return {
    name: obj.name,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    defaultValue: obj.defaultValue,
    status: (obj.status as 'active' | 'completed' | 'archived' | 'unknown') || 'unknown',
    owner: typeof obj.owner === 'string' ? obj.owner : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
    completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : undefined,
    dynamicPattern: typeof obj.dynamicPattern === 'string' ? obj.dynamicPattern : undefined,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
  };
}

export function mergeScanOptions(overrides: Partial<ScanOptions>): ScanOptions {
  return {
    sourceDir: overrides.sourceDir || process.cwd(),
    flagDefinitions: overrides.flagDefinitions || [],
    outputDir: path.resolve(overrides.outputDir || DEFAULT_OUTPUT_DIR),
    excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS, ...(overrides.excludePatterns || [])],
    includePatterns: overrides.includePatterns || ['**/*'],
    languages: overrides.languages || ['typescript', 'javascript', 'python', 'go', 'java'],
    defaultAssumedValue: overrides.defaultAssumedValue,
  };
}

export function parseLanguages(languagesStr?: string): ProgrammingLanguage[] {
  if (!languagesStr) {
    return ['typescript', 'javascript', 'python', 'go', 'java'];
  }

  const validLanguages: ProgrammingLanguage[] = [
    'typescript', 'javascript', 'python', 'go', 'java', 'kotlin', 'swift', 'rust', 'other'
  ];

  const parsed = languagesStr.split(',').map(l => l.trim().toLowerCase() as ProgrammingLanguage);
  
  const invalid = parsed.filter(l => !validLanguages.includes(l));
  if (invalid.length > 0) {
    throw new Error(`Invalid languages: ${invalid.join(', ')}. Valid: ${validLanguages.join(', ')}`);
  }

  return parsed;
}

export function parsePatterns(patternsStr?: string): string[] {
  if (!patternsStr) return [];
  return patternsStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
}

export function ensureOutputDir(outputDir: string): void {
  const absolutePath = path.resolve(outputDir);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}
