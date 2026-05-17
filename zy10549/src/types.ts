export interface RouteConfig {
  path: string;
  name?: string;
  component?: string;
  componentPath?: string;
  children?: RouteConfig[];
  lazy?: boolean;
  importPath?: string;
  rawLine?: number;
  rawColumn?: number;
  rawSource?: string;
}

export interface PageFile {
  filePath: string;
  fileName: string;
  relativePath: string;
  exportNames: string[];
  isComponent: boolean;
  isPage: boolean;
  imports: string[];
}

export interface OrphanItem {
  type: 'route-without-page' | 'page-without-route' | 'invalid-route' | 'dead-import';
  routePath?: string;
  routeName?: string;
  componentPath?: string;
  filePath?: string;
  reason: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
    snippet?: string;
  };
  severity: 'error' | 'warning' | 'info';
}

export interface ScanResult {
  routes: RouteConfig[];
  pageFiles: PageFile[];
  orphans: OrphanItem[];
  summary: {
    totalRoutes: number;
    totalPages: number;
    orphanCount: number;
    routeWithoutPage: number;
    pageWithoutRoute: number;
    invalidRoute: number;
    deadImport: number;
  };
  metadata: {
    scanTime: string;
    sourceDir: string;
    outputDir: string;
    durationMs: number;
  };
}

export interface CliOptions {
  source: string;
  output: string;
  routePatterns: string[];
  pagePatterns: string[];
  excludePatterns: string[];
  framework: 'vue' | 'react' | 'auto';
  format: ('terminal' | 'json' | 'html')[];
  strict: boolean;
  quiet: boolean;
}