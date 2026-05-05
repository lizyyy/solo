import path from 'path';
import fs from 'fs';
import { AppContext } from '../types';
import { importAllFiles } from './importers';

export interface LoadOptions {
  schema?: string;
  events?: string;
  routes?: string;
  release?: string;
  warehouse?: string;
  directory?: string;
}

export async function loadContextData(
  context: AppContext,
  options: LoadOptions
): Promise<void> {
  // If context already has data and no specific paths are provided, use existing data
  const hasExistingData = context.events.length > 0 || context.schema !== null;
  const hasProvidedPaths = 
    options.schema || 
    options.events || 
    options.routes || 
    options.release || 
    options.warehouse;
  
  if (hasExistingData && !hasProvidedPaths) {
    return;
  }
  
  // Determine base directory
  const baseDir = options.directory || process.cwd();
  
  // Build file paths
  const schemaPath = options.schema || 
    (fs.existsSync(path.join(baseDir, 'tracking-schema.yaml')) 
      ? path.join(baseDir, 'tracking-schema.yaml') 
      : undefined);
  
  const eventsPath = options.events || 
    (fs.existsSync(path.join(baseDir, 'events.jsonl')) 
      ? path.join(baseDir, 'events.jsonl') 
      : undefined);
  
  const routesPath = options.routes || 
    (fs.existsSync(path.join(baseDir, 'routes.csv')) 
      ? path.join(baseDir, 'routes.csv') 
      : undefined);
  
  const releasePath = options.release || 
    (fs.existsSync(path.join(baseDir, 'release-changes.md')) 
      ? path.join(baseDir, 'release-changes.md') 
      : undefined);
  
  const warehousePath = options.warehouse || 
    (fs.existsSync(path.join(baseDir, 'warehouse-sample.csv')) 
      ? path.join(baseDir, 'warehouse-sample.csv') 
      : undefined);
  
  // Import data
  const imported = await importAllFiles(
    schemaPath,
    eventsPath,
    routesPath,
    releasePath,
    warehousePath
  );
  
  // Update context
  context.schema = imported.schema;
  context.events = imported.events;
  context.routes = imported.routes;
  context.releaseChanges = imported.releaseChanges;
  context.warehouseSamples = imported.warehouseSamples;
}

export function ensureEventsLoaded(context: AppContext): boolean {
  if (context.events.length === 0) {
    return false;
  }
  return true;
}

export function ensureWarehouseLoaded(context: AppContext): boolean {
  if (context.warehouseSamples.length === 0) {
    return false;
  }
  return true;
}
