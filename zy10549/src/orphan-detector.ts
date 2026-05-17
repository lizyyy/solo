import * as path from 'path';
import { RouteConfig, PageFile, OrphanItem, ScanResult, CliOptions } from './types';

export class OrphanDetector {
  private options: CliOptions;
  private sourceDir: string;
  private routes: RouteConfig[] = [];
  private pageFiles: PageFile[] = [];
  private orphans: OrphanItem[] = [];
  private startTime: number = 0;

  constructor(options: CliOptions) {
    this.options = options;
    this.sourceDir = path.resolve(options.source);
  }

  detect(routes: RouteConfig[], pageFiles: PageFile[]): ScanResult {
    this.startTime = Date.now();
    this.routes = this.flattenRoutes(routes);
    this.pageFiles = pageFiles;

    this.detectRoutesWithoutPages();
    this.detectPagesWithoutRoutes();
    this.detectInvalidRoutes();

    return this.buildResult();
  }

  private flattenRoutes(routes: RouteConfig[], parentPath: string = ''): RouteConfig[] {
    const result: RouteConfig[] = [];

    for (const route of routes) {
      const fullPath = this.joinPath(parentPath, route.path);
      const flatRoute = { ...route, path: fullPath };
      result.push(flatRoute);

      if (route.children && route.children.length > 0) {
        result.push(...this.flattenRoutes(route.children, fullPath));
      }
    }

    return result;
  }

  private joinPath(parent: string, child: string): string {
    if (!parent) return child;
    if (child.startsWith('/')) return child;
    return parent.replace(/\/$/, '') + '/' + child;
  }

  private detectRoutesWithoutPages(): void {
    const processedRoutes = new Set<string>();
    
    for (const route of this.routes) {
      if (!route.path || route.path === '*' || route.path.includes('*')) {
        continue;
      }

      if (route.path.startsWith('http:') || route.path.startsWith('https:')) {
        continue;
      }

      if (!route.path.startsWith('/')) {
        continue;
      }

      const routeKey = `${route.path}-${route.name}-${route.importPath}`;
      if (processedRoutes.has(routeKey)) {
        continue;
      }
      processedRoutes.add(routeKey);

      const hasComponent = route.component || route.componentPath || route.importPath;
      
      if (!hasComponent) {
        if (route.children && route.children.length > 0) {
          continue;
        }
        
        this.orphans.push({
          type: 'invalid-route',
          routePath: route.path,
          routeName: route.name,
          reason: '路由缺少组件配置',
          location: {
            file: route.rawSource || 'unknown',
            line: route.rawLine,
            column: route.rawColumn,
            snippet: route.rawSource
          },
          severity: this.options.strict ? 'error' : 'warning'
        });
        continue;
      }

      const matchingPage = this.findMatchingPage(route);
      
      if (!matchingPage) {
        this.orphans.push({
          type: 'route-without-page',
          routePath: route.path,
          routeName: route.name,
          componentPath: route.importPath || route.componentPath || route.component,
          reason: '路由对应的页面文件不存在',
          location: {
            file: route.rawSource || 'unknown',
            line: route.rawLine,
            column: route.rawColumn,
            snippet: route.rawSource
          },
          severity: 'error'
        });
      }
    }
  }

  private findMatchingPage(route: RouteConfig): PageFile | null {
    if (route.importPath) {
      const normalizedImport = route.importPath
        .replace(/@\//g, '')
        .replace(/\.\//g, '')
        .replace(/\.\.\//g, '')
        .toLowerCase();
      
      for (const page of this.pageFiles) {
        const pagePath = page.relativePath.replace(/\.[^.]+$/, '').toLowerCase();
        if (pagePath.includes(normalizedImport) || 
            normalizedImport.includes(pagePath)) {
          return page;
        }
      }
    }

    if (route.component) {
      const componentName = route.component.toLowerCase();
      for (const page of this.pageFiles) {
        const fileName = path.basename(page.filePath).replace(/\.[^.]+$/, '').toLowerCase();
        if (fileName === componentName) {
          return page;
        }
      }
    }

    const pathSegments = route.path.split('/').filter(Boolean);
    
    for (const page of this.pageFiles) {
      const pagePath = page.relativePath.replace(/\.[^.]+$/, '');
      const pageSegments = pagePath.split('/').filter(Boolean);

      if (this.pathSegmentsMatch(pathSegments, pageSegments)) {
        return page;
      }
    }

    return null;
  }

  private pathSegmentsMatch(routeSegments: string[], pageSegments: string[]): boolean {
    const paramRegex = /^[:[]/;
    
    if (routeSegments.length !== pageSegments.length) {
      return false;
    }

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const pageSegment = pageSegments[i];

      if (paramRegex.test(routeSegment)) {
        continue;
      }

      if (routeSegment.toLowerCase() !== pageSegment.toLowerCase()) {
        return false;
      }
    }

    return true;
  }

  private detectPagesWithoutRoutes(): void {
    for (const page of this.pageFiles) {
      if (!page.isPage) continue;

      const matchingRoute = this.findMatchingRoute(page);
      
      if (!matchingRoute) {
        this.orphans.push({
          type: 'page-without-route',
          filePath: page.relativePath,
          reason: '页面文件没有对应路由入口',
          location: {
            file: page.relativePath
          },
          severity: 'warning'
        });
      }
    }
  }

  private findMatchingRoute(page: PageFile): RouteConfig | null {
    const pagePath = page.relativePath.replace(/\.[^.]+$/, '');
    const pageSegments = pagePath.split('/').filter(Boolean);
    const fileName = path.basename(page.filePath).replace(/\.[^.]+$/, '').toLowerCase();

    for (const route of this.routes) {
      if (!route.path.startsWith('/')) {
        continue;
      }
      
      const routeSegments = route.path.split('/').filter(Boolean);
      
      if (route.importPath) {
        const normalizedImport = route.importPath
          .replace(/@\//g, '')
          .replace(/\.\//g, '')
          .replace(/\.\.\//g, '')
          .toLowerCase();
        const pageWithoutExt = page.relativePath.replace(/\.[^.]+$/, '').toLowerCase();
        
        if (pageWithoutExt.includes(normalizedImport) || 
            normalizedImport.includes(pageWithoutExt)) {
          return route;
        }
      }

      if (route.component) {
        const componentName = route.component.toLowerCase();
        if (fileName === componentName) {
          return route;
        }
      }

      if (this.pathSegmentsMatch(routeSegments, pageSegments)) {
        return route;
      }
    }

    return null;
  }

  private detectInvalidRoutes(): void {
    for (const route of this.routes) {
      if (!route.path) {
        this.orphans.push({
          type: 'invalid-route',
          routeName: route.name,
          reason: '路由缺少path配置',
          location: {
            file: route.rawSource || 'unknown',
            line: route.rawLine,
            column: route.rawColumn,
            snippet: route.rawSource
          },
          severity: 'error'
        });
      }
    }
  }

  private buildResult(): ScanResult {
    const summary = {
      totalRoutes: this.routes.length,
      totalPages: this.pageFiles.filter(p => p.isPage).length,
      orphanCount: this.orphans.length,
      routeWithoutPage: this.orphans.filter(o => o.type === 'route-without-page').length,
      pageWithoutRoute: this.orphans.filter(o => o.type === 'page-without-route').length,
      invalidRoute: this.orphans.filter(o => o.type === 'invalid-route').length,
      deadImport: this.orphans.filter(o => o.type === 'dead-import').length
    };

    return {
      routes: this.routes,
      pageFiles: this.pageFiles,
      orphans: this.orphans,
      summary,
      metadata: {
        scanTime: new Date().toISOString(),
        sourceDir: this.sourceDir,
        outputDir: path.resolve(this.options.output),
        durationMs: Date.now() - this.startTime
      }
    };
  }
}