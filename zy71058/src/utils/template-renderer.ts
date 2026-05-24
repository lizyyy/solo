import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export interface RenderedTemplate {
  filePath: string;
  originalContent: string;
  renderedContent: string;
}

Handlebars.registerHelper('tpl', function (template: string, context: unknown) {
  try {
    const compiled = Handlebars.compile(template);
    return compiled(context);
  } catch {
    return template;
  }
});

Handlebars.registerHelper('default', function (defaultValue: unknown, value: unknown) {
  return value !== undefined && value !== null ? value : defaultValue;
});

Handlebars.registerHelper('required', function (message: string, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return `[REQUIRED: ${message}]`;
  }
  return value;
});

Handlebars.registerHelper('trimSuffix', function (suffix: string, str: string) {
  if (str.endsWith(suffix)) {
    return str.slice(0, -suffix.length);
  }
  return str;
});

Handlebars.registerHelper('trimPrefix', function (prefix: string, str: string) {
  if (str.startsWith(prefix)) {
    return str.slice(prefix.length);
  }
  return str;
});

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

Handlebars.registerHelper('include', function (name: string, context: unknown) {
  return `{{ include "${name}" . }}`;
});

Handlebars.registerHelper('toYaml', function (obj: unknown) {
  if (obj === null || obj === undefined) {
    return '';
  }
  return JSON.stringify(obj, null, 2);
});

export function renderTemplate(content: string, values: Record<string, unknown>): string {
  try {
    const compiled = Handlebars.compile(content, {
      strict: false,
      noEscape: true
    });
    
    const context = {
      ...values,
      Values: values,
      Chart: {
        Name: 'scanned-chart',
        Version: '1.0.0'
      },
      Release: {
        Name: 'test-release',
        Namespace: 'default'
      }
    };
    
    return compiled(context);
  } catch (e) {
    console.warn(`模板渲染警告: ${(e as Error).message}`);
    return content;
  }
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
  let result = content;
  
  const goTemplateRegex = /{{\s*\.Values\.([a-zA-Z0-9_.]+)\s*}}/g;
  result = result.replace(goTemplateRegex, (match, pathStr) => {
    const value = getObjectByPath(values, pathStr);
    return value !== undefined ? String(value) : match;
  });
  
  const simpleVarRegex = /\$\{([a-zA-Z0-9_.]+)\}/g;
  result = result.replace(simpleVarRegex, (match, varName) => {
    const value = getObjectByPath(values, varName);
    return value !== undefined ? String(value) : match;
  });
  
  return result;
}
