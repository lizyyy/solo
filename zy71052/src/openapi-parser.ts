import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DeprecatedRoute, ParsedOpenAPI } from './types';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  servers?: Server[];
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  head?: Operation;
  options?: Operation;
  trace?: Operation;
  summary?: string;
  description?: string;
  'x-path-aliases'?: string[];
  'x-deprecated'?: boolean;
}

interface Operation {
  summary?: string;
  description?: string;
  deprecated?: boolean;
  'x-deprecation'?: {
    date?: string;
    sunsetDate?: string;
    reason?: string;
    replacement?: string;
  };
  'x-path-aliases'?: string[];
}

interface Server {
  url: string;
  description?: string;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;

export function parseOpenAPI(filePath: string, globalDeprecationDate?: string): ParsedOpenAPI {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  
  let spec: OpenAPISpec;
  if (ext === '.json') {
    spec = JSON.parse(content);
  } else {
    spec = yaml.load(content) as OpenAPISpec;
  }

  const deprecatedRoutes: DeprecatedRoute[] = [];
  let allRoutesCount = 0;

  for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
    const pathLevelAliases = pathItem['x-path-aliases'] || [];
    const pathLevelDeprecated = pathItem['x-deprecated'] || false;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      
      allRoutesCount++;

      const operationAliases = operation['x-path-aliases'] || [];
      const allAliases = [...new Set([...pathLevelAliases, ...operationAliases])];

      const isDeprecated = pathLevelDeprecated || operation.deprecated;
      
      if (isDeprecated) {
        const deprecationInfo = operation['x-deprecation'];
        
        const route: DeprecatedRoute = {
          path: pathKey,
          method: method.toUpperCase(),
          summary: operation.summary,
          description: operation.description,
          deprecationDate: deprecationInfo?.date || globalDeprecationDate,
          sunsetDate: deprecationInfo?.sunsetDate,
          replacement: deprecationInfo?.replacement,
          xDeprecation: deprecationInfo,
          pathAliases: allAliases,
        };
        
        deprecatedRoutes.push(route);
      }
    }
  }

  return {
    title: spec.info.title,
    version: spec.info.version,
    deprecatedRoutes: sortRoutes(deprecatedRoutes),
    allRoutes: allRoutesCount,
  };
}

export function generatePathPatterns(route: DeprecatedRoute): RegExp[] {
  const patterns: RegExp[] = [];
  
  const allPaths = [route.path, ...route.pathAliases];
  
  for (const p of allPaths) {
    const pattern = p
      .replace(/\{[^}]+\}/g, '[^/]+')
      .replace(/\*/g, '.*');
    
    patterns.push(new RegExp(`^${pattern}$`));
  }
  
  return patterns;
}

export function matchPathToRoute(
  requestPath: string,
  routes: DeprecatedRoute[]
): { route: DeprecatedRoute; isAlias: boolean } | null {
  for (const route of routes) {
    const directPattern = route.path
      .replace(/\{[^}]+\}/g, '[^/]+')
      .replace(/\*/g, '.*');
    
    if (new RegExp(`^${directPattern}$`).test(requestPath)) {
      return { route, isAlias: false };
    }
    
    for (const alias of route.pathAliases) {
      const aliasPattern = alias
        .replace(/\{[^}]+\}/g, '[^/]+')
        .replace(/\*/g, '.*');
      
      if (new RegExp(`^${aliasPattern}$`).test(requestPath)) {
        return { route, isAlias: true };
      }
    }
  }
  
  return null;
}

function sortRoutes(routes: DeprecatedRoute[]): DeprecatedRoute[] {
  return [...routes].sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;
    return a.method.localeCompare(b.method);
  });
}

export function getRouteSignature(route: DeprecatedRoute): string {
  return `${route.method} ${route.path}`;
}
