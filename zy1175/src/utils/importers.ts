import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import csv from 'csv-parser';
import {
  TrackingSchema,
  TrackingEvent,
  RouteInfo,
  ReleaseChange,
  WarehouseSample,
} from '../types';

export async function importYAML(filePath: string): Promise<any> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return yaml.load(content);
  } catch (error) {
    throw new Error(`Failed to import YAML file ${filePath}: ${error}`);
  }
}

export async function importJSONL(filePath: string): Promise<any[]> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON at line ${index + 1}: ${line}`);
      }
    });
  } catch (error) {
    throw new Error(`Failed to import JSONL file ${filePath}: ${error}`);
  }
}

export async function importCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: any) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error: any) => 
        reject(new Error(`Failed to import CSV file ${filePath}: ${error}`))
      );
  });
}

export function importMarkdown(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to import Markdown file ${filePath}: ${error}`);
  }
}

export async function importTrackingSchema(filePath: string): Promise<TrackingSchema> {
  const data = await importYAML(filePath);
  if (!data.version || !data.events) {
    throw new Error(`Invalid tracking schema: missing version or events field`);
  }
  return data as TrackingSchema;
}

export async function importEvents(filePath: string): Promise<TrackingEvent[]> {
  const data = await importJSONL(filePath);
  return data as TrackingEvent[];
}

export async function importRoutes(filePath: string): Promise<RouteInfo[]> {
  const data = await importCSV(filePath);
  return data.map((row: any) => ({
    ...row,
    expected_events: row.expected_events ? row.expected_events.split(',').map((s: string) => s.trim()) : [],
  })) as RouteInfo[];
}

export async function importReleaseChanges(filePath: string): Promise<ReleaseChange[]> {
  const content = importMarkdown(filePath);
  return parseReleaseChanges(content);
}

function parseReleaseChanges(content: string): ReleaseChange[] {
  const releases: ReleaseChange[] = [];
  const lines = content.split('\n');
  
  let currentRelease: ReleaseChange | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('## Version ')) {
      if (currentRelease) {
        releases.push(currentRelease);
      }
      
      const versionMatch = line.match(/## Version ([\d.]+) \((\d{4}-\d{2}-\d{2})\)/);
      if (versionMatch) {
        currentRelease = {
          version: versionMatch[1],
          date: versionMatch[2],
          changes: [],
        };
      }
    } else if (currentRelease && line.startsWith('- **')) {
      const changeTypeMatch = line.match(/- \*\*(\w+)\*\*: (.+)/);
      if (changeTypeMatch) {
        const type = changeTypeMatch[1].toLowerCase() as 'add' | 'remove' | 'rename' | 'modify';
        const description = changeTypeMatch[2];
        
        const change: ReleaseChange['changes'][0] = {
          type,
          description,
        };
        
        const eventMatch = description.match(/`(\w+)`/);
        if (eventMatch) {
          change.event = eventMatch[1];
        }
        
        if (type === 'rename') {
          const renameMatch = description.match(/`(\w+)` → `(\w+)`/);
          if (renameMatch) {
            change.from = renameMatch[1];
            change.to = renameMatch[2];
          }
        }
        
        const fieldMatch = description.match(/field.*`(\w+)`/);
        if (fieldMatch) {
          change.field = fieldMatch[1];
        }
        
        currentRelease.changes.push(change);
      }
    }
  }
  
  if (currentRelease) {
    releases.push(currentRelease);
  }
  
  return releases;
}

export async function importWarehouseSamples(filePath: string): Promise<WarehouseSample[]> {
  const data = await importCSV(filePath);
  return data as WarehouseSample[];
}

export async function importAllFiles(
  schemaPath?: string,
  eventsPath?: string,
  routesPath?: string,
  releasePath?: string,
  warehousePath?: string
): Promise<{
  schema: TrackingSchema | null;
  events: TrackingEvent[];
  routes: RouteInfo[];
  releaseChanges: ReleaseChange[];
  warehouseSamples: WarehouseSample[];
}> {
  const result = {
    schema: null as TrackingSchema | null,
    events: [] as TrackingEvent[],
    routes: [] as RouteInfo[],
    releaseChanges: [] as ReleaseChange[],
    warehouseSamples: [] as WarehouseSample[],
  };
  
  if (schemaPath && fs.existsSync(schemaPath)) {
    result.schema = await importTrackingSchema(schemaPath);
  }
  
  if (eventsPath && fs.existsSync(eventsPath)) {
    result.events = await importEvents(eventsPath);
  }
  
  if (routesPath && fs.existsSync(routesPath)) {
    result.routes = await importRoutes(routesPath);
  }
  
  if (releasePath && fs.existsSync(releasePath)) {
    result.releaseChanges = await importReleaseChanges(releasePath);
  }
  
  if (warehousePath && fs.existsSync(warehousePath)) {
    result.warehouseSamples = await importWarehouseSamples(warehousePath);
  }
  
  return result;
}
