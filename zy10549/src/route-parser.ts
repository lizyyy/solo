import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { RouteConfig, CliOptions } from './types';

export class RouteParser {
  private options: CliOptions;
  private sourceDir: string;

  constructor(options: CliOptions) {
    this.options = options;
    this.sourceDir = path.resolve(options.source);
  }

  async parseRouteFile(filePath: string): Promise<RouteConfig[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);

    if (ext === '.vue') {
      return this.parseVueRoutes(content, filePath);
    }

    return this.parseJSRoutes(content, filePath);
  }

  private parseVueRoutes(content: string, filePath: string): RouteConfig[] {
    const routes: RouteConfig[] = [];
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    
    if (scriptMatch) {
      return this.parseJSRoutes(scriptMatch[1], filePath);
    }

    return routes;
  }

  private parseJSRoutes(content: string, filePath: string): RouteConfig[] {
    const routes: RouteConfig[] = [];
    
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'dynamicImport']
      });

      traverse(ast, {
        ObjectExpression: (pathNode) => {
          const route = this.extractRouteFromObject(pathNode.node, filePath, content);
          if (route) {
            routes.push(route);
          }
        },
        CallExpression: (pathNode) => {
          const callee = pathNode.node.callee;
          if (
            callee.type === 'Identifier' && 
            (callee.name === 'createRouter' || callee.name === 'createBrowserRouter')
          ) {
            const routesArray = pathNode.node.arguments[0];
            if (routesArray && routesArray.type === 'ObjectExpression') {
              const routesProp = routesArray.properties.find(
                p => p.type === 'ObjectProperty' && 
                p.key.type === 'Identifier' && 
                p.key.name === 'routes'
              );
              if (routesProp && routesProp.type === 'ObjectProperty') {
                const value = routesProp.value;
                if (value.type === 'ArrayExpression') {
                  value.elements.forEach((element) => {
                    if (element && element.type === 'ObjectExpression') {
                      const route = this.extractRouteFromObject(element, filePath, content);
                      if (route) {
                        routes.push(route);
                      }
                    }
                  });
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not parse ${filePath}: ${(error as Error).message}`);
    }

    return routes;
  }

  private extractRouteFromObject(node: any, filePath: string, content: string): RouteConfig | null {
    const props = node.properties;
    const hasPathProp = props.some((p: any) => 
      p.type === 'ObjectProperty' && 
      p.key.type === 'Identifier' && 
      p.key.name === 'path'
    );

    if (!hasPathProp) return null;

    const route: RouteConfig = {
      path: '',
      rawLine: node.loc?.start?.line,
      rawColumn: node.loc?.start?.column,
      rawSource: this.getCodeSnippet(content, node.loc?.start?.line)
    };

    for (const prop of props) {
      if (prop.type !== 'ObjectProperty') continue;

      const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
      const value = prop.value;

      switch (key) {
        case 'path':
          if (value.type === 'StringLiteral') {
            route.path = value.value;
          }
          break;
        case 'name':
          if (value.type === 'StringLiteral') {
            route.name = value.value;
          }
          break;
        case 'component':
        case 'element':
        case 'Component':
          if (value.type === 'StringLiteral') {
            route.componentPath = value.value;
          } else if (value.type === 'Identifier') {
            route.component = value.name;
          } else if (value.type === 'CallExpression') {
            const importPath = this.extractImportPath(value);
            if (importPath) {
              route.importPath = importPath;
              route.lazy = true;
            }
          } else if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') {
            const body = value.body;
            if (body.type === 'CallExpression') {
              const importPath = this.extractImportPath(body);
              if (importPath) {
                route.importPath = importPath;
                route.lazy = true;
              }
            }
          }
          break;
        case 'children':
          if (value.type === 'ArrayExpression') {
            route.children = [];
            for (const element of value.elements) {
              if (element && element.type === 'ObjectExpression') {
                const child = this.extractRouteFromObject(element, filePath, content);
                if (child) {
                  route.children.push(child);
                }
              }
            }
          }
          break;
      }
    }

    return route.path ? route : null;
  }

  private extractImportPath(node: any): string | null {
    if (node.callee && node.callee.type === 'Import') {
      const arg = node.arguments[0];
      if (arg && arg.type === 'StringLiteral') {
        return arg.value;
      }
    }
    
    if (node.callee && node.callee.type === 'Identifier' && node.callee.name === 'lazy') {
      const arg = node.arguments[0];
      if (arg && arg.type === 'ArrowFunctionExpression') {
        return this.extractImportPath(arg.body);
      }
    }

    return null;
  }

  private getCodeSnippet(content: string, line?: number): string {
    if (!line) return '';
    const lines = content.split('\n');
    return lines[line - 1]?.trim() || '';
  }

  resolveComponentPath(route: RouteConfig, routerFilePath: string): string | null {
    if (route.importPath) {
      const routerDir = path.dirname(routerFilePath);
      
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      
      for (const ext of extensions) {
        const fullPath = path.resolve(routerDir, route.importPath + ext);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
      
      const directPath = path.resolve(routerDir, route.importPath);
      if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
        return directPath;
      }
    }

    return null;
  }
}