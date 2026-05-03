import { chromium, Browser, Page, BrowserContext, Locator } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  RouteConfig,
  RoutesConfig,
  FocusPathItem,
  ElementInfo,
  RouteResult,
  ScanResult,
  ScanSummary,
  ConfigurationError,
  PageError,
  Severity,
} from '../types';
import { runAllCheckers, defaultCheckers } from '../checkers';
import { generateId, formatTimestamp, getTimestampFilename, resolvePath, isUrl, isHtmlFile, pathToFileUrl } from '../utils';

export interface ScanOptions {
  configPath: string;
  outputDir: string;
  headless: boolean;
  slowMo?: number;
  timeout?: number;
  checkers?: string[];
  viewport?: { width: number; height: number };
  groups?: string[];
  routeIds?: string[];
}

export interface ScannerState {
  browser: Browser | null;
  context: BrowserContext | null;
  isRunning: boolean;
}

export class KeyboardScanner {
  private state: ScannerState = {
    browser: null,
    context: null,
    isRunning: false,
  };

  private options: ScanOptions;
  private config: RoutesConfig;

  constructor(config: RoutesConfig, options: ScanOptions) {
    this.config = config;
    this.options = options;
  }

  async initialize(): Promise<void> {
    this.state.browser = await chromium.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo || 0,
    });

    const defaultViewport = this.options.viewport || 
      this.config.defaultSettings?.viewport || 
      { width: 1280, height: 720 };

    this.state.context = await this.state.browser.newContext({
      viewport: defaultViewport,
      locale: 'zh-CN',
    });

    this.state.isRunning = true;
  }

  async cleanup(): Promise<void> {
    if (this.state.context) {
      await this.state.context.close();
    }
    if (this.state.browser) {
      await this.state.browser.close();
    }
    this.state.isRunning = false;
  }

  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = generateId();
    const timestamp = formatTimestamp();

    const routesToScan = this.getRoutesToScan();
    const totalPages = routesToScan.length;

    const routeResults: RouteResult[] = [];
    const errors: ConfigurationError[] = [];

    for (const route of routesToScan) {
      console.log(`\n📄 正在扫描: ${route.name} (${route.url})`);
      
      try {
        const result = await this.scanRoute(route);
        routeResults.push(result);
        
        const issueCount = result.issues.length;
        if (issueCount > 0) {
          const critical = result.issues.filter(i => i.severity === 'critical').length;
          const high = result.issues.filter(i => i.severity === 'high').length;
          const medium = result.issues.filter(i => i.severity === 'medium').length;
          const low = result.issues.filter(i => i.severity === 'low').length;
          
          console.log(`   ⚠️ 发现 ${issueCount} 个问题 (critical: ${critical}, high: ${high}, medium: ${medium}, low: ${low})`);
        } else {
          console.log(`   ✅ 未发现问题`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        errors.push({
          type: 'page-error',
          message: `扫描页面 "${route.name}" 时出错`,
          details: errorMessage,
          routeId: route.id,
        });

        routeResults.push({
          routeId: route.id,
          routeName: route.name,
          url: route.url,
          status: 'failed',
          error: {
            type: 'other',
            message: errorMessage,
          },
          focusPath: [],
          issues: [],
          duration: 0,
          timestamp: formatTimestamp(),
        });

        console.log(`   ❌ 失败: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    const summary = this.buildSummary(routeResults, duration);

    return {
      id: scanId,
      timestamp,
      version: '1.0',
      summary,
      routes: routeResults,
      errors,
    };
  }

  private getRoutesToScan(): RouteConfig[] {
    let routes = [...this.config.routes];

    routes = routes.filter(route => !route.disabled);

    if (this.options.routeIds && this.options.routeIds.length > 0) {
      routes = routes.filter(route => this.options.routeIds!.includes(route.id));
    }

    if (this.options.groups && this.options.groups.length > 0) {
      routes = routes.filter(route => 
        route.group && this.options.groups!.includes(route.group)
      );
    }

    return routes;
  }

  private async scanRoute(route: RouteConfig): Promise<RouteResult> {
    const startTime = Date.now();
    const page = await this.state.context!.newPage();

    try {
      const url = this.resolveRouteUrl(route);

      console.log(`   🌐 导航到: ${url}`);
      
      const timeout = this.options.timeout || this.config.defaultSettings?.timeout || 30000;
      
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout,
      });

      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      const viewport = route.settings?.viewport || this.options.viewport || this.config.defaultSettings?.viewport;
      if (viewport) {
        await page.setViewportSize(viewport);
      }

      console.log(`   ⌨️  开始键盘导航...`);
      const focusPath = await this.captureFocusPath(page);
      console.log(`   📊 捕获到 ${focusPath.length} 个焦点元素`);

      const checkers = this.options.checkers || this.config.defaultSettings?.checkers || defaultCheckers;
      
      console.log(`   🔍 运行可访问性检查器...`);
      const checkerContext = {
        page,
        url: route.url,
        routeId: route.id,
        routeName: route.name,
        focusPath,
        timeout,
      };

      const { issues, metadata } = await runAllCheckers(checkerContext, checkers);

      const screenshotPath = await this.captureScreenshot(page, route.id);

      const duration = Date.now() - startTime;

      return {
        routeId: route.id,
        routeName: route.name,
        url: route.url,
        status: 'success',
        focusPath,
        issues,
        screenshot: screenshotPath,
        duration,
        timestamp: formatTimestamp(),
      };
    } finally {
      await page.close();
    }
  }

  private resolveRouteUrl(route: RouteConfig): string {
    if (isUrl(route.url)) {
      return route.url;
    }

    if (isHtmlFile(route.url)) {
      const absolutePath = resolvePath(this.options.configPath, route.url);
      return pathToFileUrl(absolutePath);
    }

    return route.url;
  }

  private async captureFocusPath(page: Page): Promise<FocusPathItem[]> {
    const focusPath: FocusPathItem[] = [];
    const visitedSelectors = new Set<string>();
    const maxIterations = 100;

    await page.evaluate(() => {
      document.body.focus();
    });

    for (let i = 0; i < maxIterations; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const focusInfo = await page.evaluate(() => {
        const activeElement = document.activeElement as HTMLElement;
        if (!activeElement || activeElement === document.body || activeElement === document.documentElement) {
          return null;
        }

        const computed = window.getComputedStyle(activeElement);
        const rect = activeElement.getBoundingClientRect();

        const isVisible =
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          parseInt(computed.opacity) > 0 &&
          rect.width > 0 &&
          rect.height > 0;

        const hasVisibleOutline =
          computed.outlineStyle !== 'none' &&
          computed.outlineStyle !== 'hidden' &&
          parseInt(computed.outlineWidth) > 0;

        const generateSelector = (el: HTMLElement): string => {
          const parts: string[] = [];
          let current: HTMLElement | null = el;

          while (current) {
            const tag = current.tagName.toLowerCase();
            let part = tag;

            if (current.id) {
              part = `#${CSS.escape(current.id)}`;
              parts.unshift(part);
              break;
            }

            const siblings = Array.from(current.parentElement?.children || []);
            const sameTagSiblings = siblings.filter(
              (s) => s.tagName.toLowerCase() === tag
            );

            if (sameTagSiblings.length > 1) {
              const index = sameTagSiblings.indexOf(current) + 1;
              part = `${tag}:nth-of-type(${index})`;
            }

            if (current.className && typeof current.className === 'string') {
              const classes = current.className
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((c) => `.${CSS.escape(c)}`)
                .join('');
              if (classes) {
                part = part + classes;
              }
            }

            parts.unshift(part);
            current = current.parentElement;
          }

          return parts.join(' > ');
        };

        const getAccessibleName = (element: HTMLElement): string => {
          if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label')!;
          }
          if (element.getAttribute('aria-labelledby')) {
            const labelledby = element.getAttribute('aria-labelledby')!;
            const labelEl = document.getElementById(labelledby);
            return labelEl?.textContent?.trim() || '';
          }
          if (element.getAttribute('title')) {
            return element.getAttribute('title')!;
          }
          if (element.getAttribute('placeholder')) {
            return element.getAttribute('placeholder')!;
          }
          return element.textContent?.trim() || '';
        };

        const selector = generateSelector(activeElement);
        const tabIndex = activeElement.getAttribute('tabindex');

        return {
          selector,
          elementInfo: {
            tagName: activeElement.tagName.toLowerCase(),
            id: activeElement.id || undefined,
            className: activeElement.className || undefined,
            textContent: activeElement.textContent?.trim() || undefined,
            accessibleName: getAccessibleName(activeElement),
            role: activeElement.getAttribute('role') || undefined,
            type: activeElement.getAttribute('type') || undefined,
            ariaLabel: activeElement.getAttribute('aria-label') || undefined,
            ariaLabelledby: activeElement.getAttribute('aria-labelledby') || undefined,
            placeholder: activeElement.getAttribute('placeholder') || undefined,
            title: activeElement.getAttribute('title') || undefined,
          },
          isVisible,
          focusVisible: computed.getPropertyValue(':focus-visible') !== '' || false,
          hasVisibleOutline,
          tabIndexValue: tabIndex !== null ? parseInt(tabIndex) : null,
        };
      });

      if (!focusInfo) {
        break;
      }

      if (visitedSelectors.has(focusInfo.selector)) {
        break;
      }

      visitedSelectors.add(focusInfo.selector);
      focusPath.push({
        index: focusPath.length,
        ...focusInfo,
      });
    }

    return focusPath;
  }

  private async captureScreenshot(page: Page, routeId: string): Promise<string | undefined> {
    try {
      const screenshotsDir = path.join(this.options.outputDir, 'screenshots');
      await fs.ensureDir(screenshotsDir);

      const filename = `${routeId}-${getTimestampFilename()}.png`;
      const filepath = path.join(screenshotsDir, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true,
        type: 'png',
      });

      return filepath;
    } catch (error) {
      console.warn(`   ⚠️ 截图失败: ${error}`);
      return undefined;
    }
  }

  private buildSummary(routeResults: RouteResult[], duration: number): ScanSummary {
    const scannedPages = routeResults.filter(r => r.status === 'success').length;
    const failedPages = routeResults.filter(r => r.status === 'failed').length;
    
    const allIssues = routeResults.flatMap(r => r.issues);
    const totalIssues = allIssues.length;

    const issuesBySeverity = {
      critical: allIssues.filter(i => i.severity === 'critical').length,
      high: allIssues.filter(i => i.severity === 'high').length,
      medium: allIssues.filter(i => i.severity === 'medium').length,
      low: allIssues.filter(i => i.severity === 'low').length,
    };

    const issuesByType: Record<string, number> = {};
    for (const issue of allIssues) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    }

    return {
      totalPages: routeResults.length,
      scannedPages,
      failedPages,
      totalIssues,
      issuesBySeverity,
      issuesByType,
      duration,
    };
  }
}

export async function runScan(config: RoutesConfig, options: ScanOptions): Promise<ScanResult> {
  const scanner = new KeyboardScanner(config, options);
  
  try {
    await scanner.initialize();
    const result = await scanner.scan();
    return result;
  } finally {
    await scanner.cleanup();
  }
}
