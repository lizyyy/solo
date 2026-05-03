import * as fs from 'fs';
import { RouteEntry, ScreenshotEntry } from '../types';

export class CsvParser {
  static parseRoutes(csvPath: string): RouteEntry[] {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length < 2) {
      return [];
    }

    const headers = this.parseCsvLine(lines[0]);
    const pathIndex = headers.indexOf('path');
    const keysIndex = headers.indexOf('keys');
    const componentIndex = headers.indexOf('component');

    const routes: RouteEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCsvLine(line);
      const route: RouteEntry = {
        path: values[pathIndex] || '',
        keys: this.parseKeysList(values[keysIndex] || ''),
        component: values[componentIndex] || ''
      };
      
      routes.push(route);
    }

    return routes;
  }

  static parseScreenshotManifest(jsonPath: string): ScreenshotEntry[] {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const manifest = JSON.parse(content);
    
    const screenshots: ScreenshotEntry[] = [];
    
    if (Array.isArray(manifest)) {
      for (const item of manifest) {
        screenshots.push({
          name: item.name || item.id || '',
          path: item.path || item.url || '',
          keys: item.keys || item.i18nKeys || [],
          status: item.status || 'active'
        });
      }
    } else if (manifest.screenshots) {
      for (const item of manifest.screenshots) {
        screenshots.push({
          name: item.name || item.id || '',
          path: item.path || item.url || '',
          keys: item.keys || item.i18nKeys || [],
          status: item.status || 'active'
        });
      }
    }

    return screenshots;
  }

  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private static parseKeysList(keysStr: string): string[] {
    if (!keysStr) return [];
    return keysStr.split(/[,;]/).map(k => k.trim()).filter(Boolean);
  }
}
