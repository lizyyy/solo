import * as fs from 'fs';
import * as path from 'path';

export interface RenderedTemplate {
  filePath: string;
  originalContent: string;
  renderedContent: string;
}

function getObjectByPath(obj: Record<string, unknown>, pathStr: string): unknown {
  const parts = pathStr.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

const templateFunctions: Record<string, (...args: string[]) => string> = {
  b64enc: (value: string) => Buffer.from(value).toString('base64'),
  b64dec: (value: string) => Buffer.from(value, 'base64').toString('utf-8'),
  quote: (value: string) => `"${value}"`,
  upper: (value: string) => value.toUpperCase(),
  lower: (value: string) => value.toLowerCase(),
  trim: (value: string) => value.trim(),
  toString: (value: string) => String(value),
  default: (defaultVal: string, value: string) => value !== undefined && value !== null && value !== '' ? value : defaultVal,
};

interface TemplateContext {
  Values: Record<string, unknown>;
  Release: {
    Name: string;
    Namespace: string;
  };
  Chart: {
    Name: string;
    Version: string;
  };
}

function resolvePathInContext(pathStr: string, context: TemplateContext): unknown {
  const normalizedPath = pathStr.startsWith('.') ? pathStr.substring(1) : pathStr;
  const parts = normalizedPath.split('.');
  
  if (parts.length === 0) return undefined;
  
  const rootKey = parts[0];
  const restPath = parts.slice(1).join('.');
  
  let rootObj: unknown;
  switch (rootKey) {
    case 'Values':
      rootObj = context.Values;
      break;
    case 'Release':
      rootObj = context.Release;
      break;
    case 'Chart':
      rootObj = context.Chart;
      break;
    default:
      rootObj = (context.Values as Record<string, unknown>)[rootKey];
  }
  
  if (restPath === '') {
    return rootObj;
  }
  
  if (rootObj === null || rootObj === undefined || typeof rootObj !== 'object') {
    return undefined;
  }
  
  return getObjectByPath(rootObj as Record<string, unknown>, restPath);
}

function applyPipeline(value: string, pipeline: string[]): string {
  let result = value;
  
  for (const funcCall of pipeline) {
    const trimmed = funcCall.trim();
    if (!trimmed) continue;
    
    const funcParts = trimmed.split(/\s+/);
    const funcName = funcParts[0];
    const funcArgs = funcParts.slice(1);
    
    if (templateFunctions[funcName]) {
      try {
        result = templateFunctions[funcName](result, ...funcArgs);
      } catch {
      }
    }
  }
  
  return result;
}

export function renderTemplate(content: string, values: Record<string, unknown>): string {
  const context: TemplateContext = {
    Values: values,
    Release: {
      Name: 'test-release',
      Namespace: 'default'
    },
    Chart: {
      Name: 'scanned-chart',
      Version: '1.0.0'
    }
  };

  let result = content;
  
  const templateRegex = /\{\{([^}]+)\}\}/g;
  
  result = result.replace(templateRegex, (match, expression) => {
    const expr = expression.trim();
    
    const parts = expr.split(/\s*\|\s*/);
    const valueExpr = parts[0].trim();
    const pipeline = parts.slice(1);
    
    if (valueExpr.startsWith('.')) {
      const resolved = resolvePathInContext(valueExpr, context);
      const stringValue = resolved !== undefined ? String(resolved) : match;
      
      if (pipeline.length > 0) {
        return applyPipeline(stringValue, pipeline);
      }
      
      return stringValue;
    }
    
    if (templateFunctions[valueExpr]) {
      const funcArgs = pipeline.map((p: string) => {
        const trimmed = p.trim();
        if (trimmed.startsWith('.')) {
          const resolved = resolvePathInContext(trimmed, context);
          return resolved !== undefined ? String(resolved) : trimmed;
        }
        return trimmed.replace(/^["']|["']$/g, '');
      });
      
      try {
        return templateFunctions[valueExpr](...funcArgs);
      } catch {
        return match;
      }
    }
    
    return match;
  });
  
  return result;
}

export function renderTemplateFile(filePath: string, values: Record<string, unknown>): RenderedTemplate {
  const originalContent = fs.readFileSync(filePath, 'utf-8');
  const renderedContent = renderTemplate(originalContent, values);
  
  return {
    filePath,
    originalContent,
    renderedContent
  };
}

export function renderTemplateDir(templateDir: string, values: Record<string, unknown>): RenderedTemplate[] {
  const results: RenderedTemplate[] = [];
  
  if (!fs.existsSync(templateDir)) {
    return results;
  }

  const files = fs.readdirSync(templateDir);
  
  for (const file of files) {
    const fullPath = path.join(templateDir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      results.push(...renderTemplateDir(fullPath, values));
    } else if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.tpl')) {
      results.push(renderTemplateFile(fullPath, values));
    }
  }

  return results;
}

export function resolveTemplateReferences(content: string, values: Record<string, unknown>): string {
  return renderTemplate(content, values);
}
