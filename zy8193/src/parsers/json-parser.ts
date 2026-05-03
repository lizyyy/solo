import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import { parse } from 'yaml';
import { 
  LocaleMessages, 
  FlatMessages, 
  NestedMessages, 
  RouteEntry, 
  ScreenshotEntry, 
  RulesConfig 
} from '../types';

export class JsonParser {
  static parseLocaleFiles(localeDir: string): LocaleMessages {
    const localeFiles = globSync(path.join(localeDir, '*.json'));
    const locales: LocaleMessages = {};

    for (const filePath of localeFiles) {
      const localeName = path.basename(filePath, '.json');
      const content = fs.readFileSync(filePath, 'utf-8');
      try {
        locales[localeName] = JSON.parse(content);
      } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`);
      }
    }

    return locales;
  }

  static flatten(messages: NestedMessages, prefix: string = ''): FlatMessages {
    const result: FlatMessages = {};

    for (const [key, value] of Object.entries(messages)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        result[fullKey] = value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.flatten(value as NestedMessages, fullKey);
        Object.assign(result, nested);
      }
    }

    return result;
  }

  static unflatten(flat: FlatMessages): NestedMessages {
    const result: NestedMessages = {};

    for (const [key, value] of Object.entries(flat)) {
      const parts = key.split('.');
      let current: NestedMessages = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part] as NestedMessages;
      }

      const lastPart = parts[parts.length - 1];
      current[lastPart] = value;
    }

    return result;
  }
}
