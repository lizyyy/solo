import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import csvParser from 'csv-parser';
import {
  FormSchema,
  DraftRecord,
  EnumMapping,
  MigrationRule,
  InputConfig
} from '../types';

export class Parser {
  private static cache: Map<string, unknown> = new Map();

  static clearCache(): void {
    this.cache.clear();
  }

  static async parseYaml<T>(filePath: string): Promise<T> {
    const cacheKey = `yaml:${filePath}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as T;
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = yaml.parse(content) as T;
    this.cache.set(cacheKey, parsed);
    return parsed;
  }

  static async parseSchema(filePath: string): Promise<FormSchema> {
    const schema = await this.parseYaml<FormSchema>(filePath);
    this.validateSchema(schema);
    return schema;
  }

  static validateSchema(schema: FormSchema): void {
    if (!schema.schemaVersion) {
      throw new Error('Schema is missing schemaVersion');
    }
    if (!schema.formId) {
      throw new Error('Schema is missing formId');
    }
    if (!schema.groups || !Array.isArray(schema.groups)) {
      throw new Error('Schema groups must be an array');
    }

    const allFields: Map<string, { groupId: string; fieldName: string }> = new Map();
    for (const group of schema.groups) {
      for (const field of group.fields) {
        const existing = allFields.get(field.fieldId);
        if (existing && existing.fieldName !== field.fieldName) {
          console.warn(`Warning: Field ${field.fieldId} has different names across groups: "${existing.fieldName}" vs "${field.fieldName}"`);
        }
        allFields.set(field.fieldId, { groupId: group.groupId, fieldName: field.fieldName });
      }
    }
  }

  static async parseJsonl(filePath: string): Promise<DraftRecord[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const drafts: DraftRecord[] = [];
    const versionCounts: Map<string, number> = new Map();

    for (let i = 0; i < lines.length; i++) {
      try {
        const draft = JSON.parse(lines[i]) as DraftRecord;
        drafts.push(draft);

        const count = versionCounts.get(draft.schemaVersion) || 0;
        versionCounts.set(draft.schemaVersion, count + 1);
      } catch (error) {
        console.warn(`Warning: Failed to parse line ${i + 1} in ${filePath}: ${(error as Error).message}`);
      }
    }

    if (versionCounts.size > 1) {
      console.warn('\nWarning: Multiple schema versions detected in drafts:');
      for (const [version, count] of versionCounts.entries()) {
        console.warn(`  - Version ${version}: ${count} draft(s)`);
      }
      console.warn('');
    }

    return drafts;
  }

  static async parseCsv<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const results: T[] = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: T) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  static async parseEnumMapping(filePath: string): Promise<EnumMapping[]> {
    const rows = await this.parseCsv<{
      fieldId: string;
      oldValue: string;
      newValue: string;
      label: string;
      isDefault: string;
    }>(filePath);

    return rows.map(row => ({
      fieldId: row.fieldId,
      oldValue: row.oldValue,
      newValue: row.newValue,
      label: row.label,
      isDefault: row.isDefault?.toLowerCase() === 'true' || row.isDefault === '1'
    }));
  }

  static async parseMigrationRules(filePath: string): Promise<MigrationRule[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.yaml' || ext === '.yml') {
      const content = await this.parseYaml<{ rules: MigrationRule[] }>(filePath);
      return content.rules || [];
    } else if (ext === '.json') {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.rules || parsed || [];
    } else {
      throw new Error(`Unsupported migration rules file format: ${ext}`);
    }
  }

  static async parseAll(config: InputConfig): Promise<{
    oldSchema: FormSchema;
    newSchema: FormSchema;
    drafts: DraftRecord[];
    enumMappings: EnumMapping[];
    migrationRules: MigrationRule[];
  }> {
    const [oldSchema, newSchema, drafts] = await Promise.all([
      this.parseSchema(config.oldSchemaPath),
      this.parseSchema(config.newSchemaPath),
      this.parseJsonl(config.draftsPath)
    ]);

    let enumMappings: EnumMapping[] = [];
    let migrationRules: MigrationRule[] = [];

    if (config.enumMappingPath) {
      if (fs.existsSync(config.enumMappingPath)) {
        enumMappings = await this.parseEnumMapping(config.enumMappingPath);
      } else {
        console.warn(`Warning: Enum mapping file not found: ${config.enumMappingPath}`);
      }
    }

    if (config.migrationRulesPath) {
      if (fs.existsSync(config.migrationRulesPath)) {
        migrationRules = await this.parseMigrationRules(config.migrationRulesPath);
      } else {
        console.warn(`Warning: Migration rules file not found: ${config.migrationRulesPath}`);
      }
    }

    return {
      oldSchema,
      newSchema,
      drafts,
      enumMappings,
      migrationRules
    };
  }
}
